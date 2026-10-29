import {chromium, devices} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
// iPad-profile GPU load per shared-frame participant at named places (CANAL-RECALL-7).
const places = (process.env.PLACES || '4.88385,52.37450,180;4.89440,52.37560,190').split(';').map(s => s.split(',').map(Number));
const browser = await chromium.launch({headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
// DESKTOP=1: the same places on a 1440×900 desktop (pointer: fine), to show desktop frames unchanged.
const page = process.env.DESKTOP ? await browser.newPage({viewport: {width: 1440, height: 900}, deviceScaleFactor: 1})
  : await browser.newPage({viewport: {width: 1180, height: 734}, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPad Pro 11'].userAgent});
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
  await page.waitForTimeout(Number(process.env.SETTLE_MS || 20000));
  // SHOTS=dir: a screenshot per place (before/after strips), named by place and the query string.
  if (process.env.SHOTS) { fs.mkdirSync(process.env.SHOTS, {recursive: true}); await page.screenshot({path: path.join(process.env.SHOTS, `${(process.env.LABEL || 'shot')}-${lng.toFixed(4)}_${lat.toFixed(4)}.png`)}); }
  const r = await page.evaluate(() => {
    const vm = canalRecallGame.vectorMap, f = vm._sharedFrame, i = f.renderer.info;
    // The farthest ground on screen from the map centre (the rider), metres: the touch ring must reach it (residency.ts).
    const m = vm.map, c = m.getCenter(), cv = m.getCanvas(), w = cv.clientWidth, h = cv.clientHeight;
    const reachM = Math.round(Math.max(...[[0, 0], [w / 2, 0], [w, 0], [0, h], [w, h]].map(([px, py]) => m.unproject([px, py]).distanceTo(c))));
    return { pitch: Math.round(vm.map.getPitch()), zoom: +vm.map.getZoom().toFixed(2), calls: f.stats.main.calls, tris: f.stats.main.triangles, geometries: i.memory.geometries, textures: i.memory.textures, stats: f.drawStats(), reachM, view: `${w}x${h}`, ground: (({ radiusM, cells, details, buildMsMedian }) => ({ radiusM, cells: cells && Object.keys(cells).length, details, buildMsMedian }))(vm._ownGround?.status?.() || {}) };
  });
  if (process.env.GROUND) console.log(await page.evaluate(() => {
    // Own-ground triangles by mesh name/layer, plus the cell residency settings.
    const f = canalRecallGame.vectorMap._sharedFrame, g = canalRecallGame.vectorMap._ownGround;
    const entry = f.registry.all().find(e => e.id === 'own-ground'), by = {}, byCell = {};
    entry.participant.participant.root.traverseVisible(o => {
      if (!o.isMesh) return;
      const geo = o.geometry, n = Math.floor((geo.index ? geo.index.count : geo.attributes.position.count) / 3);
      const key = (o.name || o.parent?.name || '?').replace(/[-_:]?-?\d[\d.,:_-]*/g, '#');
      (by[key] ??= { meshes: 0, tris: 0, maxTris: 0 }); by[key].meshes++; by[key].tris += n; by[key].maxTris = Math.max(by[key].maxTris, n);
      let p = o.parent; while (p && !/^own-ground\//.test(p.name || '')) p = p.parent;
      const cell = p ? p.name.slice('own-ground/'.length) : '?'; byCell[cell] = (byCell[cell] || 0) + n;
    });
    const st = g?.status?.() || {};
    return JSON.stringify({ byCell, by, cells: st.cells && Object.keys(st.cells).length, far: st.far, keys: Object.keys(st) }, null, 0);
  }));
  const rows = Object.entries(r.stats).sort((a, b) => b[1].triangles - a[1].triangles);
  console.log(`\n${lng},${lat},${bearing}  pitch ${r.pitch} zoom ${r.zoom}  main pass (incl. shadow redraws): ${r.calls} calls ${(r.tris/1e6).toFixed(2)}M tris  geoms ${r.geometries} tex ${r.textures}  view ${r.view} reach ${r.reachM} m  ground ring ${r.ground.radiusM} m, ${r.ground.cells} cells, build median ${r.ground.buildMsMedian} ms, ${JSON.stringify(r.ground.details)}`);
  for (const [id, s] of rows) console.log(`  ${id.padEnd(34)} ${String(s.meshes).padStart(5)} meshes ${(s.triangles/1e3).toFixed(0).padStart(7)}k tris`);
}
await browser.close();
