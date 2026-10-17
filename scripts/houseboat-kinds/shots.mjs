// In-game frames of houseboat quays (chase view, rider frozen on the quay), for before/after
// review next to the orthophoto crops from quay.ts.
//   PORT=4565 [BUNDLES_DIR=artifacts/houseboat-kinds/bundles] node scripts/houseboat-kinds/shots.mjs <tag>
//   -> artifacts/houseboat-kinds/shots/<tag>/<place>.png
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [tag = 'x', qs = '?ownGround=1&sharedFrame=1', only] = process.argv.slice(2);
// [lng, lat, bearing°] on the quay street, looking along the moored boats.
const PLACES = {
  'prinsengracht-noordermarkt': [4.88736, 52.37913, 202], // east quay, looking SSW at w266604434/36/50
  'prinsengracht-westermarkt': [4.88553, 52.37763, 30],   // west quay, looking NNE at w266555542, w266555540
  'prinsengracht-amstelveld': [4.89721, 52.36194, 75],    // Amstelveld quay, looking ENE along five hullboxes
  'amstel-blauwbrug': [4.90080, 52.36693, 303],          // Amstel east quay by the Blauwbrug, looking WNW at w268782272/65/67
  'brouwersgracht': [4.88735, 52.38082, 331],            // Brouwersgracht south quay, looking NNW at w266550794 and the dinghy berth
};
const out = `artifacts/houseboat-kinds/shots/${tag}`;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', e => console.error('pageerror', e.message)); page.on('console', m => m.type() === 'error' && console.error('console', m.text().slice(0, 200)));
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
if (process.env.BUNDLES_DIR) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
  const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
});
await page.goto(`http://127.0.0.1:${process.env.PORT || 4565}/canal-drive/` + qs);
await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, { timeout: 60000 });
await page.locator('#travel-mode').selectOption('car', { force: true }); await page.locator('#view-mode').selectOption('chase', { force: true });
await page.waitForFunction(() => canalRecallGame.routePois.some(p => p.id === 'anne-frank') && canalRecallGame.routePois.some(p => p.id === 'rijksmuseum'));
await page.locator('#poi-destination').selectOption('rijksmuseum');
await page.evaluate(() => { const g = canalRecallGame; g._pickDestinationNear = () => g.routePois.find(p => p.id === 'anne-frank'); });
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => canalRecallGame.player?.x && canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, { timeout: 180000 });
for (const [id, [lng, lat, bearing]] of Object.entries(PLACES)) {
  if (only && !only.split(',').includes(id)) continue;
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b)); Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
    // Close in on the boats (wheel-zoom range), so a wheelhouse reads against a box cabin.
    g.camera.zoom = Math.min(g.camera.maxZoom, g.camera.zoom * 3);
  }, { lng, lat, bearing });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: `${out}/${id}.png` });
}
await browser.close();
console.log(out);
