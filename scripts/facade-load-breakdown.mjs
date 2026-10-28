import {chromium, devices} from 'playwright';
// Facade chunk breakdown at named places (CANAL-RECALL-7, facade touch LOD lane).
//
// The `facades` shared-frame participant is 15 merged meshes: the z14 city shells
// (`coarse:`), the detailed z16/z17 walls around the rider (`near:`), their facade
// extras (`extras:`), landmark kits and houseboats. This script lists each resident
// chunk with its drawn triangles, its distance from the rider and, when the bundle
// carries them (`mesh.userData.kinds`), the per-content-kind triangle tally the
// chunk builder recorded (walls, ground floor, roof slopes, lids, crowns, frontage
// relief, extras).
//
// Usage: PORT=4437 PLACES=4.88385,52.37450,180 node scripts/facade-load-breakdown.mjs
const places = (process.env.PLACES || '4.88385,52.37450,180').split(';').map(s => s.split(',').map(Number));
const browser = await chromium.launch({headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page = await browser.newPage({viewport: {width: 1180, height: 734}, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPad Pro 11'].userAgent});
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
await page.goto(`http://127.0.0.1:${process.env.PORT || 4471}/canal-drive/` + (process.env.QS || ''));
await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, {timeout: 60000});
await page.locator('#travel-mode').selectOption('car', {force: true}); await page.locator('#view-mode').selectOption('chase', {force: true});
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => canalRecallGame.player?.x && canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, {timeout: 180000});
for (const [lng, lat, bearing] of places) {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)("PIXELS_PER_METER"), b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b)); Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
  }, { lng, lat, bearing });
  await page.waitForTimeout(20000);
  const r = await page.evaluate(() => {
    const g = canalRecallGame, f = g.vectorMap._sharedFrame, tb = g.vectorMap._threeBuildings;
    const l = g.osmLoader, ppm = (0, eval)("PIXELS_PER_METER");
    // The rider in the chunks' own frame (metres east/north of ORIGIN), from its pixel position.
    const riderLng = l._lastCenterLng + (g.player.x - l._lastOffsetX) / (111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm);
    const riderLat = l._lastCenterLat - (g.player.y - l._lastOffsetY) / (111320 * ppm);
    const kx = 111320 * Math.cos(52.37 * Math.PI / 180), ky = 110540;
    const px = (riderLng - 4.9) * kx, py = (riderLat - 52.37) * ky;
    // Three's own frame test, so a row's `vis` is what the GPU actually draws (drawStats does the same).
    const THREE = window.CanalRecallThree.THREE, frustum = new THREE.Frustum().setFromProjectionMatrix(f.camera.projectionMatrix);
    const sphere = new THREE.Sphere();
    const rows = [];
    for (const [key, entry] of tb.chunks) {
      const mesh = entry.mesh;
      if (!mesh?.geometry) { rows.push({ key, tris: 0, meshes: 0, kinds: null, note: 'empty' }); continue; }
      const geo = mesh.geometry, index = geo.index, pos = geo.attributes.position;
      const count = index ? index.count : pos?.count ?? 0;
      // The position array is freed on upload; install() stored the sphere it measured.
      const c = geo.boundingSphere?.center ?? { x: 0, y: 0, z: 0 };
      const d = Math.round(Math.hypot(c.x - px, c.y - py));
      const drawn = !mesh.frustumCulled || frustum.intersectsSphere(sphere.copy(geo.boundingSphere).applyMatrix4(mesh.matrixWorld));
      rows.push({
        key, tris: Math.floor(count / 3), drawn: drawn ? Math.floor(count / 3) : 0, meshes: 1, distanceM: d,
        radiusM: Math.round(geo.boundingSphere?.radius ?? 0), buildings: entry.source?.length ?? 0,
        kinds: mesh.userData.kinds ?? null,
      });
    }
    rows.sort((a, b) => b.drawn - a.drawn || b.tris - a.tris);
    const byKind = {};
    for (const row of rows) for (const [k, v] of Object.entries(row.kinds ?? {})) byKind[k] = (byKind[k] ?? 0) + v;
    const detail = [...(tb.detailTiles ?? [])];
    return { rider: [riderLng.toFixed(5), riderLat.toFixed(5)], detailTiles: detail, rows, byKind, stats: f.drawStats() };
  });
  console.log(`\n=== ${lng},${lat} bearing ${bearing}`);
  console.log(`detail tiles: ${r.detailTiles.join(' ') || '(none)'}`);
  console.log(`${'chunk'.padEnd(22)} ${'drawn'.padStart(8)} ${'tris'.padStart(8)} ${'dist'.padStart(6)} ${'r'.padStart(5)} ${'bldgs'.padStart(6)}  kinds`);
  for (const row of r.rows) {
    const kinds = row.kinds ? Object.entries(row.kinds).filter(([, v]) => v).map(([k, v]) => `${k} ${(v / 1e3).toFixed(0)}k`).join(' ') : '';
    console.log(`${row.key.padEnd(22)} ${String(row.drawn ?? 0).padStart(8)} ${String(row.tris).padStart(8)} ${String(row.distanceM ?? '-').padStart(6)} ${String(row.radiusM ?? '-').padStart(5)} ${String(row.buildings).padStart(6)}  ${kinds}`);
  }
  const byKindDrawn = {};
  for (const row of r.rows) { const share = row.tris ? row.drawn / row.tris : 0; for (const [k, v] of Object.entries(row.kinds ?? {})) byKindDrawn[k] = (byKindDrawn[k] ?? 0) + v * share; }
  console.log(`drawn by kind: ${Object.entries(byKindDrawn).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / 1e3).toFixed(0)}k`).join(', ')}`);
  console.log(`by kind: ${Object.entries(r.byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / 1e3).toFixed(0)}k`).join(', ') || '(bundle has no kinds tally)'}`);
  console.log(`participants: ${Object.entries(r.stats).sort((a, b) => b[1].triangles - a[1].triangles).map(([k, v]) => `${k} ${(v.triangles / 1e3).toFixed(0)}k`).join(', ')}`);
}
await browser.close();
