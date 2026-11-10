// Lane P2 (#325): still frames at fixed Free Ride poses (the user's complaint: the ride's opening aerial pose; the
// Westerkerk and Rijksmuseum from the air) for side-by-side strips of the draw limit. JPEG q80, 1280x800 CSS px.
//   PORT=4750 [BUNDLES_DIR=dir] node scripts/pop-pose-shots.mjs <outdir> <tag> [--qs 'drawLimit=0'] [--settle 14]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [outDir, tag] = process.argv.slice(2);
const opt = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const settle = Number(opt('settle', '14')) * 1000, extra = opt('qs', '');
const POSES = [
  { name: 'start', at: null },
  { name: 'westerkerk-air', at: [4.8840, 52.3700], zoom: 0.45, tilt: 12, bearing: 0 },
  { name: 'rijksmuseum-air', at: [4.8852, 52.3550], zoom: 0.45, tilt: 12, bearing: 330 },
];
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await context.newPage();
if (process.env.BUNDLES_DIR) await context.route(/\/canal-drive\/.*\.bundle\.js/, route => {
  const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
});
await page.goto(`http://127.0.0.1:${process.env.PORT || 4750}/canal-drive/?engine=own&ride=free${extra ? `&${extra}` : ''}`);
await page.waitForFunction(() => window.canalRecallGame?.state === 4 && window.canalRecallGame.camera?.introOverview === 0 && window.canalRecallGame.freeRide, null, { timeout: 180_000 });
fs.mkdirSync(outDir, { recursive: true });
for (const p of POSES) {
  if (p.at) await page.evaluate(p => {
    const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), cam = g.camera, vm = g.vectorMap;
    g.player.update = function () { this.speed = 0; };
    const x = l._lastOffsetX + (p.at[0] - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y = l._lastOffsetY - (p.at[1] - l._lastCenterLat) * 111320 * ppm;
    cam.pan(1, 0); cam.detached = true; cam.anchorX = cam.x = x; cam.anchorY = cam.y = y; cam.zoom = p.zoom; cam.rotation = p.bearing * Math.PI / 180;
    vm.setCameraTilt?.(p.tilt); vm._cameraTilt = p.tilt;
  }, p);
  await page.waitForTimeout(settle);
  const file = path.join(outDir, `${p.name}-${tag}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 80 });
  const info = await page.evaluate(() => ({ limit: window.__canalRecallDrawLimitNow?.() ?? null, far: canalRecallGame.vectorMap._farShells?.stats?.().cells ?? null }));
  console.log(file, JSON.stringify(info));
}
await browser.close();
