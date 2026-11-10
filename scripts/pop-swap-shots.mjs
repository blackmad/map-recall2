// Lane P3 (#328): stills of one landmark level swap from the air, for a before/after strip of the level dissolve.
// Free Ride, the camera at the Westerkerk air pose (pop-pose-shots.mjs) drifting east at --speed m/s; the first swap of a
// landmark on screen is shot at its frame and 150 / 300 / 700 ms after (each a 640x400 crop centred on the landmark).
//   PORT=4750 [BUNDLES_DIR=dir] node scripts/pop-swap-shots.mjs <outdir> <tag> [--qs 'landmarkDissolve=0'] [--speed 60]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [outDir, tag] = process.argv.slice(2);
const opt = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const extra = opt('qs', ''), speed = Number(opt('speed', '60'));
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await context.newPage();
if (process.env.BUNDLES_DIR) await context.route(/\/canal-drive\/.*\.bundle\.js/, route => {
  const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
});
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
await page.goto(`http://127.0.0.1:${process.env.PORT || 4750}/canal-drive/?engine=own&ride=free${extra ? `&${extra}` : ''}`);
await page.waitForFunction(() => window.canalRecallGame?.state === 4 && window.canalRecallGame.camera?.introOverview === 0 && window.canalRecallGame.freeRide, null, { timeout: 180_000 });
fs.mkdirSync(outDir, { recursive: true });
await page.evaluate(() => {
  const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), cam = g.camera, vm = g.vectorMap;
  g.player.update = function () { this.speed = 0; };
  const at = [4.8840, 52.3700];
  const x = l._lastOffsetX + (at[0] - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y = l._lastOffsetY - (at[1] - l._lastCenterLat) * 111320 * ppm;
  cam.pan(1, 0); cam.detached = true; cam.anchorX = cam.x = x; cam.anchorY = cam.y = y; cam.zoom = 0.45; cam.rotation = 0;
  vm.setCameraTilt?.(12); vm._cameraTilt = 12;
  window.__swapPose = { x, y, ppm };
});
await page.waitForTimeout(14_000);
// Arm: drift east, and record the first swap of a landmark on screen (its anchor projected through the frame's camera).
await page.evaluate(mps => {
  const g = canalRecallGame, vm = g.vectorMap, cam = g.camera, sl = vm._signatureLandmarks, sf = vm._sharedFrame, THREE = sf.THREE, P = window.__swapPose;
  const merc = ([lng, lat]) => [(lng + 180) / 360, (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))) / 360];
  const base = sl._swapLevel;
  window.__swap = null;
  sl._swapLevel = function (entry, incoming, level) {
    const r = base.call(this, entry, incoming, level);
    if (!window.__swap && entry.holder?.visible) {
      const an = entry.placement?.anchor; const [mx, my] = merc(an);
      const v = new THREE.Vector3(mx, my, 0).applyMatrix4(sf.worldFromMercatorM), d = v.length();
      v.applyMatrix4(sf.camera.projectionMatrix);
      if (d > 500 && Math.abs(v.x) < 0.7 && Math.abs(v.y) < 0.7) window.__swap = { id: entry.spec.id, level, d: Math.round(d), x: v.x, y: -v.y, t: performance.now(), faded: !!this._levelFades?.has?.(entry) };
    }
    return r;
  };
  let last = performance.now();
  const step = now => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!window.__swap) { P.x += mps * P.ppm * dt; cam.detached = true; cam.anchorX = P.x; cam.anchorY = P.y; }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}, speed);
await page.waitForFunction(() => window.__swap, null, { timeout: 120_000, polling: 'raf' });
const swap = await page.evaluate(() => window.__swap);
console.log(JSON.stringify(swap));
const W = 1280, H = 800, cx = Math.round((swap.x + 1) / 2 * W), cy = Math.round((swap.y + 1) / 2 * H);
const clip = { x: Math.max(0, Math.min(W - 640, cx - 320)), y: Math.max(0, Math.min(H - 400, cy - 200)), width: 640, height: 400 };
for (const ms of [0, 150, 300, 700]) {
  const wait = swap.t + ms - await page.evaluate(() => performance.now());
  if (wait > 0) await page.waitForTimeout(wait);
  const file = path.join(outDir, `swap-${tag}-${String(ms).padStart(3, '0')}ms.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 80, clip });
  console.log(file);
}
await browser.close();
