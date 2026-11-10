// Lane P4 (#330): the street look of `?landmarkHaze` (P3 #328). The rider is placed in Free Ride at a street pose with
// a landmark down a straight street or canal (the player itself is held there, not a detached camera: the detached
// teleport does not hold at street zoom), chase view facing the landmark, and a still is taken per arm.
//   PORT=4750 [BUNDLES_DIR=dir] node scripts/street-haze-shots.mjs <outdir> <tag> [--qs 'landmarkHaze=0'] [--settle 14] [--poses a,b]
// Per pose it logs the landmark's eye distance and screen rect (its model's box projected by the shared frame's camera)
// and writes <pose>-<tag>.png (lossless, for scripts/street-haze-contrast.mjs) and .jpg (q80, for the strip).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [outDir, tag] = process.argv.slice(2);
const opt = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const settle = Number(opt('settle', '14')) * 1000, extra = opt('qs', ''), only = opt('poses', '');
export const STREET_POSES = [
  // Westertoren down the Raadhuisstraat from the Dam, and up the Prinsengracht from the Leidsegracht.
  { name: 'westerkerk-raadhuisstraat', at: [4.8936, 52.3734], landmark: 'westerkerk' },
  { name: 'westerkerk-prinsengracht', at: [4.8833, 52.3669], landmark: 'westerkerk' },
  // Rijksmuseum down the Nieuwe Spiegelstraat from the Herengracht.
  { name: 'rijksmuseum-spiegelstraat', at: [4.8911, 52.3650], landmark: 'rijksmuseum' },
  // Munttoren up the Rokin from the Dam, and from the Damrak (the same axis, further out).
  { name: 'munttoren-dam', at: [4.8929, 52.3724], landmark: 'munttoren-amsterdam' },
  { name: 'munttoren-damrak', at: [4.8956, 52.3764], landmark: 'munttoren-amsterdam' },
];
const poses = only ? STREET_POSES.filter(p => only.split(',').includes(p.name)) : STREET_POSES;

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await context.newPage();
if (process.env.BUNDLES_DIR) await context.route(/\/canal-drive\/.*\.bundle\.js/, route => {
  const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
});
const errors = [];
page.on('pageerror', e => errors.push(String(e.message).slice(0, 200)));
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
await page.goto(`http://127.0.0.1:${process.env.PORT || 4750}/canal-drive/?engine=own&ride=free${extra ? `&${extra}` : ''}`);
await page.waitForFunction(() => window.canalRecallGame?.state === 4 && window.canalRecallGame.camera?.introOverview === 0 && window.canalRecallGame.freeRide, null, { timeout: 180_000 });
fs.mkdirSync(outDir, { recursive: true });
const out = [];
for (const p of poses) {
  await page.evaluate(p => {
    const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), pl = g.player;
    const world = ([lng, lat]) => ({ x: l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y: l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm });
    const spec = g.vectorMap._signatureLandmarks?.models?.find(m => m.id === p.landmark);
    const a = world(p.at), b = world(spec?.surveyed?.anchor || spec?.footprint?.centre);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    g.camera.detached = false; g.camera.viewMode = 'chase';
    pl.update = function () { this.x = a.x; this.y = a.y; this.angle = angle; this.speed = 0; this.vx = 0; this.vy = 0; };
    pl.x = a.x; pl.y = a.y; pl.angle = angle;
  }, p);
  await page.waitForTimeout(settle);
  const info = await page.evaluate(id => {
    const vm = canalRecallGame.vectorMap, sf = vm._sharedFrame, THREE = sf.THREE, sl = vm._signatureLandmarks;
    const entry = sl?._entries?.find(e => e.spec.id === id);
    const lim = window.__canalRecallDrawLimitNow?.() ?? null;
    if (!entry) return { found: false, lim };
    entry.group.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(entry.group), c = box.getCenter(new THREE.Vector3());
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const v = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      v.applyMatrix4(sf.camera.matrixWorldInverse).applyMatrix4(sf.camera.projectionMatrix);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    const W = innerWidth, H = innerHeight, eye = c.clone().applyMatrix4(sf.camera.matrixWorldInverse);
    return { found: true, level: entry.level, d: Math.round(eye.length()), lim,
      rect: [Math.round((x0 + 1) / 2 * W), Math.round((1 - y1) / 2 * H), Math.round((x1 + 1) / 2 * W), Math.round((1 - y0) / 2 * H)] };
  }, p.landmark);
  const png = path.join(outDir, `${p.name}-${tag}.png`), jpg = png.replace(/\.png$/, '.jpg');
  await page.screenshot({ path: png });
  await page.screenshot({ path: jpg, type: 'jpeg', quality: 80 });
  out.push({ ...p, tag, ...info });
  console.log(p.name, tag, JSON.stringify(info));
}
fs.writeFileSync(path.join(outDir, `poses-${tag}.json`), JSON.stringify(out, null, 1));
if (errors.length) console.log('page errors', errors.slice(0, 5));
await browser.close();
