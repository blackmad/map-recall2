// Before/after in-game shots of tower-podium pands. TILES_DIR=<staging> serves building-tiles/bag-tiles/bag-facts from there.
//   PORT=4475 [TILES_DIR=artifacts/tower-podium/staging] node scripts/tower-podium-shots.mjs <tag>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [tag = 'x', qs = ''] = process.argv.slice(2);
// target [lng, lat], the side to look from (degrees from the target), and the distance (m).
const TARGETS = {
  'hotelschool-0363100012148630-se': [4.8438, 52.3685, 150, 200],
  'hotelschool-0363100012148630-s': [4.8438, 52.3685, 185, 170],
  'zuidas-vu-0363100012136232': [4.8660, 52.3344, 190, 150],
  'zuidas-0363100012244160': [4.8697, 52.3403, 200, 140],
};
const PLACES = Object.fromEntries(Object.entries(TARGETS).map(([id, [lng, lat, from, d]]) => {
  const b = from * Math.PI / 180, dy = Math.cos(b) * d, dx = Math.sin(b) * d;
  return [id, [lng + dx / (111320 * Math.cos(lat * Math.PI / 180)), lat + dy / 111320, (from + 180) % 360]];
}));
const out = `artifacts/tower-podium/shots/${tag}`;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
let served = 0;
// BUNDLES_DIR=<dir> serves *.bundle.js built from this checkout's source (the integrator rebuilds the committed ones).
if (process.env.BUNDLES_DIR) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
  const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
});
if (process.env.TILES_DIR) await page.route(/\/data\/extracts\/amsterdam\/(building-tiles|bag-tiles|bag-facts)\/(.+?)(\?.*)?$/, route => {
  const m = /\/data\/extracts\/amsterdam\/(building-tiles|bag-tiles|bag-facts)\/([^?]+)/.exec(route.request().url());
  const file = path.join(process.env.TILES_DIR, m[1], m[2]);
  if (!fs.existsSync(file)) return route.continue();
  served++;
  return route.fulfill({ path: file, contentType: file.endsWith('.json') ? 'application/json' : 'application/octet-stream' });
});
await page.goto(`http://127.0.0.1:${process.env.PORT || 4475}/canal-drive/` + qs);
await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, { timeout: 90000 });
await page.locator('#travel-mode').selectOption('car', { force: true }); await page.locator('#view-mode').selectOption('chase', { force: true });
await page.waitForFunction(() => canalRecallGame.routePois.some(p => p.id === 'anne-frank') && canalRecallGame.routePois.some(p => p.id === 'rijksmuseum'));
await page.locator('#poi-destination').selectOption('rijksmuseum');
await page.evaluate(() => { const g = canalRecallGame; g._pickDestinationNear = () => g.routePois.find(p => p.id === 'anne-frank'); });
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => canalRecallGame.player?.x && canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, { timeout: 180000 });
for (const [id, [lng, lat, bearing]] of Object.entries(PLACES)) {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b)); Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, { lng, lat, bearing });
  await page.waitForTimeout(Number(process.env.WAIT_MS || 20000));
  await page.screenshot({ path: `${out}/${id}.png` });
}
console.log(JSON.stringify({ tag, served }));
await browser.close();
