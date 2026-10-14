// Still frames at named places, for live-play reports (boat by default).
//   PORT=4515 node scripts/live-play-shots.mjs <outDir> "<query>" <name>=<lng,lat,bearing>[,camera] ...
// Boots a ride in MODE (boat|car|bike, default boat) toward DEST (a route POI id or name fragment, default "IJ-toren"),
// teleports the player to each place, waits until the own ground (when on) has no pending cells and the frame
// has settled, and writes <outDir>/<name>.png plus <outDir>/shots.json (position, own-ground status, tile-building
// counts). CAMZOOM=<z> sets the game camera zoom (0.16 is the aerial demo spot). Same seed, viewport 1280x800, chase view.
import { chromium } from 'playwright';
import fs from 'node:fs';

const [out = 'artifacts/live-play', qs = '?ownGround=1', ...places] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const mode = process.env.MODE || 'boat', dest = process.env.DEST || 'IJ-toren', settle = Number(process.env.SETTLE_MS || 6000);
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
await page.goto(`http://127.0.0.1:${process.env.PORT || 4515}/canal-drive/` + qs);
await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, { timeout: 90000 });
await page.locator('#travel-mode').selectOption(mode, { force: true });
await page.locator('#view-mode').selectOption(process.env.VIEW || 'chase', { force: true });
const picked = await page.evaluate((dest) => {
  const g = canalRecallGame, d = dest.toLowerCase();
  const poi = g.routePois.find(p => p.id === dest) || g.routePois.find(p => (p.name || '').toLowerCase().includes(d));
  if (poi) { try { g._overlay.store.setState({ destinationId: poi.id }); } catch (_) {} const sel = document.querySelector('#poi-destination'); if (sel) sel.value = poi.id; }
  return poi ? poi.id : null;
}, dest);
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => canalRecallGame.player?.x && canalRecallGame.camera.introOverview === 0, null, { timeout: 180000 });
await page.evaluate(() => { canalRecallGame.state = 4; });
const shots = [];
for (const spec of places) {
  const [name, where] = spec.split('=');
  const [lng, lat, bearing] = where.split(',').map(Number);
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b)); Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    // Hide quiz cards so they do not cover the frame.
    window.__hideCards = () => document.querySelectorAll('.question-card, #question-card, .quiz-card').forEach(e => { e.style.visibility = 'hidden'; });
  }, { lng, lat, bearing });
  if (process.env.CAMZOOM) await page.evaluate(z => { canalRecallGame.camera.zoom = z; }, Number(process.env.CAMZOOM));
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => { const g = canalRecallGame.vectorMap._ownGround; if (!g) return true; const s = g.status(); return s.ready && !s.queued && !Object.keys(s.pending).length; }, null, { timeout: 180000 }).catch(() => {});
  // Hold the pose: re-apply each frame in case the boat physics nudges it.
  await page.waitForTimeout(settle);
  await page.evaluate(() => window.__hideCards && window.__hideCards());
  // TIER=from,to overrides the facade cells' screen-footprint tier (roofTier.ts) on every resident chunk (A/B only).
  if (process.env.TIER) { await page.evaluate((tier) => { for (const e of canalRecallGame.vectorMap._threeBuildings.chunks.values()) { const u = e.mesh?.material?.uniforms; if (u?.cellTier) u.cellTier.value = tier; } canalRecallGame.vectorMap.map.triggerRepaint(); }, process.env.TIER.split(',').map(Number)); await page.waitForTimeout(500); }
  const info = await page.evaluate(() => {
    const g = canalRecallGame, vm = g.vectorMap, og = vm._ownGround, map = vm.map;
    const tb = vm._tileBuildings || vm._recipeTiles || null;
    let camera = null;
    try { const t = map.transform, c = map.getCenter(), mpp = 40075016.686 * Math.cos(c.lat * Math.PI / 180) / (512 * 2 ** map.getZoom()), d = (t.cameraToCenterDistance ?? 1.5 * map.getCanvas().clientHeight) * mpp, pitch = map.getPitch(); camera = { centre: [c.lng, c.lat], zoom: map.getZoom(), pitch, bearing: map.getBearing(), eyeToCentreM: +d.toFixed(1), eyeHeightM: +(d * Math.cos(pitch * Math.PI / 180)).toFixed(1), groundDistM: +(d * Math.sin(pitch * Math.PI / 180)).toFixed(1) }; } catch (e) { camera = String(e); }
    return { travelMode: g.travelMode, camera, ownGround: og ? (({ triangles, cells, pending }) => ({ triangles, cells, pending }))(og.status()) : null, tileBuildings: tb && tb.stats ? tb.stats() : null, threeBuildings: vm._threeBuildings?.stats ? vm._threeBuildings.stats() : null };
  });
  await page.screenshot({ path: `${out}/${name}.png` });
  shots.push({ name, lng, lat, bearing, info });
}
fs.writeFileSync(`${out}/shots.json`, JSON.stringify({ qs, mode, dest: picked, errors, shots }, null, 1));
console.log(out, 'shots', shots.length, 'dest', picked, 'errors', errors.length, errors.slice(0, 3));
await browser.close();
