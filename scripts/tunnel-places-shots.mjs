// Screenshots of the named tunnel sites in the game (chase view, rider frozen at the place), for before/after review.
//   PORT=4417 node scripts/tunnel-places-shots.mjs <tag> [only,ids]   -> artifacts/tunnel-places/<tag>/<id>.png
// BUNDLES_DIR=<dir> serves bundles built with `node scripts/build-3d-bundles.mjs --only=own-ground-game,own-ground-worker --outdir=<dir>`.
// The sites are the tunnel lane's survey (2026-10-30): motor tunnel approaches the rider cannot use (A) and underpasses they can (B).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [tag = 'x', only] = process.argv.slice(2);
const qs = process.env.QS ?? '';
export const PLACES = {
  // A: motor-only approaches (lng, lat, compass bearing of the camera)
  'ij-tunnel-foeliestraat': [4.9105, 52.3722, 20],      // user report: the IJ-tunnel south ramp up toward NEMO
  'ij-tunnel-ramp': [4.91150, 52.37235, 20],            // beside the ramp, looking at the portal under NEMO
  'ij-tunnel-south': [4.9112, 52.3713, 25],              // Prins Hendrikkade by the Foeliestraat, looking up the ramp
  'ij-tunnel-portal-quay': [4.91285, 52.37270, 345],     // the quay path east of the ramp, toward the portal
  'piet-heintunnel-west': [4.9320, 52.37275, 90],       // Piet Heinkade, west portal
  'spaarndammertunnel-west': [4.8728, 52.3937, 110],
  'michiel-de-ruijtertunnel-west': [4.8962, 52.3812, 120],
  // B: rideable underpasses
  'cuyperspassage': [4.89795, 52.37905, 35],
  'wibautstraat-underpass': [4.9136, 52.35163, 130],
  'molukkenstraat-cycle-underpass': [4.9397, 52.35625, 38],
  'kruislaan-cycle-underpass': [4.9490, 52.35290, 50],
  'centraal-oosttunnel': [4.90105, 52.37805, 35],
};
if (process.argv[1].endsWith('tunnel-places-shots.mjs')) {
  fs.mkdirSync(`artifacts/tunnel-places/${tag}`, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
  if (process.env.BUNDLES_DIR) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
    return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  await page.goto(`http://127.0.0.1:${process.env.PORT || 4417}/canal-drive/` + qs);
  await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, { timeout: 60000 });
  await page.locator('#travel-mode').selectOption('car', { force: true }); await page.locator('#view-mode').selectOption('chase', { force: true });
  await page.waitForFunction(() => canalRecallGame.routePois.some(p => p.id === 'anne-frank') && canalRecallGame.routePois.some(p => p.id === 'rijksmuseum'));
  await page.locator('#poi-destination').selectOption('rijksmuseum');
  await page.evaluate(() => { const g = canalRecallGame; g._pickDestinationNear = () => g.routePois.find(p => p.id === 'anne-frank'); });
  await page.locator('#route-card').evaluate(f => f.requestSubmit());
  await page.waitForFunction(() => canalRecallGame.player?.x && canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, { timeout: 180000 });
  const info = {};
  for (const [id, [lng, lat, bearing]] of Object.entries(PLACES)) {
    if (only && !only.split(',').includes(id)) continue;
    await page.evaluate(({ lng, lat, bearing }) => {
      const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), b = bearing * Math.PI / 180;
      g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
      g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
      g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b)); Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
      g.player.handleInput = () => {};
    }, { lng, lat, bearing });
    await page.waitForFunction(() => !canalRecallGame.vectorMap._ownGround?.status().basemapHidden, null, { timeout: 1500, polling: 16 }).catch(() => {});
    await page.waitForFunction(() => { const g = canalRecallGame.vectorMap._ownGround; if (!g) return true; const s = g.status(); return s.ready && s.basemapHidden && !s.queued && !Object.keys(s.pending).length; }, null, { timeout: 60000, polling: 16 }).catch(() => {});
    await page.waitForTimeout(3000);
    info[id] = await page.evaluate(() => { const vm = canalRecallGame.vectorMap; return { riderZ: vm._riderSurfaceZ ?? null, covered: vm.riderCovered ?? null }; }).catch(e => String(e));
    await page.screenshot({ path: `artifacts/tunnel-places/${tag}/${id}.png` });
  }
  fs.writeFileSync(`artifacts/tunnel-places/${tag}/info.json`, JSON.stringify(info, null, 1));
  console.log(JSON.stringify(info));
  await browser.close();
}
