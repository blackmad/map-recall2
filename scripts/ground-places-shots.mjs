// Screenshots of named ground locations in the game (chase view, rider frozen at the place), for before/after review.
//   PORT=4447 node scripts/ground-places-shots.mjs <tag> "<query>" [only,ids]   -> artifacts/ground-places/<tag>/<id>.png
// Places are the user-reported ground defects of 2026-10-13 plus the named bridge regressions.
import { chromium } from 'playwright';
import fs from 'node:fs';
const [tag = 'x', qs = '?ownGround=1&sharedFrame=1', only] = process.argv.slice(2);
const PLACES = {
  'rozengracht-marnixstraat': [4.8760, 52.3722, 100],   // junction by the fire station
  'rozengracht-lijnbaansgracht': [4.8742, 52.3718, 100],
  'westerkerk-bridge': [4.8830, 52.3742, 80],            // Rozengracht over the Prinsengracht, east end
  'ryckerbrug': [4.8695, 52.3708, 60],                   // De Clercqstraat over the Kostverlorenvaart
  'declercq-plaza': [4.8725, 52.3716, 60],
  'allotments-westerpark': [4.8590, 52.3860, 0],         // Westerpark / Sloterdijkermeer allotments
  'allotments-chasse': [4.8527, 52.3735, 90],
  'BRU0166': [4.87445, 52.37286, 40],
};
fs.mkdirSync(`artifacts/ground-places/${tag}`, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
await page.goto(`http://127.0.0.1:${process.env.PORT || 4447}/canal-drive/` + qs);
await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, { timeout: 60000 });
await page.locator('#travel-mode').selectOption('car', { force: true }); await page.locator('#view-mode').selectOption('chase', { force: true });
await page.waitForFunction(() => canalRecallGame.routePois.some(p => p.id === 'anne-frank') && canalRecallGame.routePois.some(p => p.id === 'rijksmuseum'));
await page.locator('#poi-destination').selectOption('rijksmuseum');
await page.evaluate(() => { const g = canalRecallGame; g._pickDestinationNear = () => g.routePois.find(p => p.id === 'anne-frank'); });
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => canalRecallGame.player?.x && canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, { timeout: 180000 });
const latencies = {};
for (const [id, [lng, lat, bearing]] of Object.entries(PLACES)) {
  if (only && !only.split(',').includes(id)) continue;
  const t0 = Date.now();
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b)); Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, { lng, lat, bearing });
  // Cell-load latency: time until the rider's cell is resident at LOD 0 and nothing is queued (or 60 s).
  const ready = await page.waitForFunction(() => { const g = canalRecallGame.vectorMap._ownGround; if (!g) return true; const s = g.status(); return s.ready && !s.queued && !Object.keys(s.pending).length && Object.values(s.cells).includes(0); }, null, { timeout: 60000, polling: 100 }).then(() => true).catch(() => false);
  latencies[id] = { ms: Date.now() - t0, ready };
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `artifacts/ground-places/${tag}/${id}.png` });
}
fs.writeFileSync(`artifacts/ground-places/${tag}/latency.json`, JSON.stringify(latencies, null, 1));
console.log(JSON.stringify(latencies));
await browser.close();
