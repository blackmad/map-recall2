// G4 (#369): the far ring's ground near the rider. PORT=4462 node scripts/g4-near.mjs <tag> "<query>" [lng,lat]
import { chromium } from 'playwright';
import fs from 'node:fs';
const [tag = 'x', qs = '', at = '4.8420,52.3588'] = process.argv.slice(2);
const [lng, lat] = at.split(',').map(Number);
fs.mkdirSync(`artifacts/g4/${tag}`, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
if (process.env.BUNDLES_DIR) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
  const file = `${process.env.BUNDLES_DIR}/${/\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]}`;
  return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
});
await page.goto(`http://127.0.0.1:${process.env.PORT || 4462}/canal-drive/?ride=free&engine=own${qs}`);
await page.waitForFunction(() => { const g = window.canalRecallGame; return g?.state === 4 && g.camera?.introOverview === 0 && g.freeRide && g.vectorMap?._ownGround?.ready; }, null, { timeout: 180000 });
const ZOOM = Number(process.env.ZOOM || 0.25), TILT = Number(process.env.TILT ?? 15);
await page.evaluate(({ lng, lat, ZOOM, TILT }) => {
  const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), cam = g.camera, vm = g.vectorMap;
  g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; };
  const x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
  const y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
  cam.pan(1, 0);
  const step = () => { cam.detached = true; cam.anchorX = x; cam.anchorY = y; cam.zoom = ZOOM; vm.setCameraTilt?.(TILT); vm._cameraTilt = TILT; cam.rotation = 0; requestAnimationFrame(step); };
  requestAnimationFrame(step);
}, { lng, lat, ZOOM, TILT });
const sample = () => page.evaluate(() => { const g = canalRecallGame.vectorMap._ownGround, s = g.status(); return { cells: Object.keys(s.cells).length, pending: Object.keys(s.pending).length, far: { ...s.far, nearRider: undefined }, nearRider: s.far.nearRider, zoom: s.zoom, basemapHidden: s.basemapHidden, aerial: canalRecallGame.vectorMap.labelAerial }; });
for (let i = 0; i < 14; i++) { await page.waitForTimeout(1000); console.log(i, JSON.stringify(await sample())); }
await page.screenshot({ path: `artifacts/g4/${tag}/${lng}_${lat}.png` });
await browser.close();
