import {chromium, devices} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
// iPad-profile GPU load per shared-frame participant at named places (CANAL-RECALL-7).
const places = (process.env.PLACES || '4.88385,52.37450,180;4.89440,52.37560,190').split(';').map(s => s.split(',').map(Number));
const browser = await chromium.launch({headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
// DESKTOP=1: the same places on a 1440×900 desktop (pointer: fine), to show desktop frames unchanged.
const page = process.env.DESKTOP ? await browser.newPage({viewport: {width: 1440, height: 900}, deviceScaleFactor: 1})
  : await browser.newPage({viewport: {width: 1180, height: 734}, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPad Pro 11'].userAgent});
// BUNDLES_DIR=dir: serve *.bundle.js from there (e.g. main's bundles), as the ride-perf spec does, for cross-build A/B.
if (process.env.BUNDLES_DIR) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
  const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
});
// FIXED_TIME=ms: freeze Date.now / performance-independent clocks for the sun and day cycle (cross-run pixel A/B).
if (process.env.FIXED_TIME) await page.clock.setFixedTime(Number(process.env.FIXED_TIME));
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
  const r = await page.evaluate(() => {
    const vm = canalRecallGame.vectorMap, f = vm._sharedFrame, i = f.renderer.info;
    // The farthest ground on screen from the map centre (the rider), metres: the touch ring must reach it (residency.ts).
    const m = vm.map, c = m.getCenter(), cv = m.getCanvas(), w = cv.clientWidth, h = cv.clientHeight;
    const reachM = Math.round(Math.max(...[[0, 0], [w / 2, 0], [w, 0], [0, h], [w, h]].map(([px, py]) => m.unproject([px, py]).distanceTo(c))));
    return { tileDraws: f.tileDraws, pitch: Math.round(vm.map.getPitch()), zoom: +vm.map.getZoom().toFixed(2), calls: f.stats.main.calls, tris: f.stats.main.triangles, geometries: i.memory.geometries, textures: i.memory.textures, stats: f.drawStats(), reachM, view: `${w}x${h}`, ground: (({ radiusM, cells, details, buildMsMedian }) => ({ radiusM, cells: cells && Object.keys(cells).length, details, buildMsMedian }))(vm._ownGround?.status?.() || {}) };
  });
  // SHOTS=dir: a screenshot per place (before/after strips), named by place and the query string.
  if (process.env.SHOTS) { fs.mkdirSync(process.env.SHOTS, {recursive: true}); await page.screenshot({path: path.join(process.env.SHOTS, `${(process.env.LABEL || 'shot')}-${lng.toFixed(4)}_${lat.toFixed(4)}.png`)}); }
  // ONLY=<participant id> (e.g. own-ground, facades): a second shot with every other shared-frame participant, the
  // map's labels and the HUD hidden, for pixel-exact before/after of one participant. Restored afterwards.
  if (process.env.SHOTS && process.env.ONLY) {
    await page.evaluate((only) => {
      const vm = canalRecallGame.vectorMap, f = vm._sharedFrame, m = vm.map;
      window.__only = { roots: [], layers: [], els: [] };
      // Freeze the simulation (the chase camera's settle and the rider's bob move the view sub-pixel between shots).
      const g = canalRecallGame; window.__only.update = Object.prototype.hasOwnProperty.call(g, '_update') ? g._update : null; g._update = () => {};
      for (const e of f.registry.all()) { const root = e.participant?.participant?.root ?? e.participant?.root; if (root && only !== 'all' && e.id !== only && root.visible) { root.visible = false; window.__only.roots.push(root); } }
      for (const l of m.getStyle().layers) if (l.type === 'symbol' && m.getLayoutProperty(l.id, 'visibility') !== 'none') { m.setLayoutProperty(l.id, 'visibility', 'none'); window.__only.layers.push(l.id); }
      for (const el of document.querySelectorAll('body *')) { window.__only.els.push([el, el.style.visibility]); el.style.visibility = 'hidden'; }
      let el = m.getCanvas(); while (el) { el.style.visibility = 'visible'; el = el.parentElement; }
      f.invalidateShadows?.(); m.triggerRepaint();
    }, process.env.ONLY);
    await page.waitForTimeout(1500);
    await page.screenshot({path: path.join(process.env.SHOTS, `${(process.env.LABEL || 'shot')}-${process.env.ONLY}-${lng.toFixed(4)}_${lat.toFixed(4)}.png`)});
    // RETILE=js: an expression run in the page between two ONLY shots (e.g. `vm._ownGround.retile(3)`), so the same
    // frame is shot before and after a mesh partition: pixel-exact, no run-to-run noise (sun, route, streaming).
    if (process.env.RETILE) for (const [step, js] of process.env.RETILE.split('||').entries()) {
      const n = await page.evaluate((js) => { const vm = canalRecallGame.vectorMap; const out = (0, eval)(`(vm) => (${js})`)(vm); vm._sharedFrame.invalidateShadows?.(); vm.map.triggerRepaint(); return out; }, js);
      await page.waitForTimeout(1500);
      await page.screenshot({path: path.join(process.env.SHOTS, `${(process.env.LABEL || 'shot')}-${process.env.ONLY}-retiled${step || ''}-${lng.toFixed(4)}_${lat.toFixed(4)}.png`)});
      const after = await page.evaluate(() => { const f = canalRecallGame.vectorMap._sharedFrame; return { calls: f.stats.main.calls, tiles: f.tileDraws, stats: f.drawStats() }; });
      console.log(`  RETILE[${step}] ${js} -> ${JSON.stringify(n)}; ONLY-frame calls ${after.calls} tiles ${JSON.stringify(after.tiles)}; ${Object.entries(after.stats).filter(([, v]) => v.meshes).map(([k, v]) => `${k} ${v.meshes} meshes ${(v.triangles / 1e3).toFixed(0)}k`).join(', ')}`);
    }
    await page.evaluate(() => {
      const o = window.__only, m = canalRecallGame.vectorMap.map;
      if (o.update) canalRecallGame._update = o.update; else delete canalRecallGame._update;
      for (const r of o.roots) r.visible = true; for (const id of o.layers) m.setLayoutProperty(id, 'visibility', 'visible'); for (const [el, v] of o.els) el.style.visibility = v;
      canalRecallGame.vectorMap._sharedFrame.invalidateShadows?.(); m.triggerRepaint();
    });
  }
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
  console.log(`\n${lng},${lat},${bearing}  pitch ${r.pitch} zoom ${r.zoom}  main pass (incl. shadow redraws): ${r.calls} calls ${(r.tris/1e6).toFixed(2)}M tris  geoms ${r.geometries} tex ${r.textures}  tiles ${JSON.stringify(r.tileDraws)}  view ${r.view} reach ${r.reachM} m  ground ring ${r.ground.radiusM} m, ${r.ground.cells} cells, build median ${r.ground.buildMsMedian} ms, ${JSON.stringify(r.ground.details)}`);
  for (const [id, s] of rows) console.log(`  ${id.padEnd(34)} ${String(s.meshes).padStart(5)} meshes ${(s.triangles/1e3).toFixed(0).padStart(7)}k tris`);
}
await browser.close();
