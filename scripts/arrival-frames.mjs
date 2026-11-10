// Lane P5 (#332): an arriving landmark's dissolve as a frame sequence (0 / 150 / 300 / 600 ms after it starts), to
// show whether the building it replaces holds until the dissolve ends (`?landmarkHold`, default on) or leaves at once.
//   PORT=4750 [BUNDLES_DIR=dir] node scripts/arrival-frames.mjs <outdir> <tag> [--qs 'landmarkHold=0'] [--pose munttoren-dam]
// The rider is held at a street pose (street-haze-shots.mjs's poses); once the landmark is resident and its dissolve
// programs warm, it is dropped and re-requested, and the dissolve clock is frozen at each step for a still (the
// clock, not the wall time: a screenshot takes longer than 150 ms). Writes <pose>-<tag>-<ms>ms.jpg cropped round it.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [outDir, tag] = process.argv.slice(2);
const opt = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const extra = opt('qs', ''), poseName = opt('pose', 'munttoren-dam'), settle = Number(opt('settle', '16')) * 1000;
const POSES = {
  'munttoren-dam': { at: [4.8929, 52.3724], landmark: 'munttoren-amsterdam' },
  'munttoren-rokin': { at: [4.8925, 52.3690], landmark: 'munttoren-amsterdam' },
};
const p = POSES[poseName];
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
await page.evaluate(p => {
  const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), pl = g.player;
  const world = ([lng, lat]) => ({ x: l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y: l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm });
  const spec = g.vectorMap._signatureLandmarks?.models?.find(m => m.id === p.landmark);
  const a = world(p.at), b = world(spec?.surveyed?.anchor || spec?.footprint?.centre);
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const vm = g.vectorMap, hold = () => { g.camera.detached = false; g.camera.viewMode = 'chase'; g.camera.zoom = g.camera.maxZoom; vm.setCameraTilt?.(72); vm._cameraTilt = 72; };
  clearInterval(window.__hazeHold); hold(); window.__hazeHold = setInterval(hold, 250);
  pl.update = function () { this.x = a.x; this.y = a.y; this.angle = angle; this.speed = 0; this.vx = 0; this.vy = 0; };
  pl.x = a.x; pl.y = a.y; pl.angle = angle;
}, p);
await page.waitForTimeout(settle);
const resident = id => canalRecallGame.vectorMap._signatureLandmarks?._entries?.some(e => e.spec.id === id);
await page.waitForFunction(resident, p.landmark, { timeout: 60_000 });
const cycle = async () => {
  // Drop it and let the walk bring it back (the first arrival also warms the dissolve programs).
  await page.evaluate(id => {
    const sl = canalRecallGame.vectorMap._signatureLandmarks;
    if (!sl.__p5Hooked) {
      sl.__p5Hooked = true;
      const start = sl._startArrivalDissolve;
      sl._startArrivalDissolve = function (entry) {
        const r = start.call(this, entry);
        if (entry.spec.id === id) window.__arrival = { dissolved: r, arriving: !!entry.arriving };
        if (r && entry.spec.id === id) {
          const lf = this._levelFades, f = lf.fades.get(entry);
          window.__arrStart = f.start; window.__arrFake = f.start;
          if (!lf.__p5) { lf.__p5 = true; const step = lf.step; lf.step = function () { return step.call(this, window.__arrFake ?? performance.now()); }; }
        }
        return r;
      };
    }
    window.__arrival = null; window.__arrFake = null;
    sl._dropEntries(new Set([id])); sl._requestModels();
  }, p.landmark);
  await page.waitForFunction(() => window.__arrival, null, { timeout: 60_000 });
  return page.evaluate(() => window.__arrival);
};
let arrival = await cycle();
if (!arrival.dissolved) { await page.waitForTimeout(3000); arrival = await cycle(); }
console.log('arrival', JSON.stringify(arrival));
const rect = await page.evaluate(id => {
  const vm = canalRecallGame.vectorMap, sf = vm._sharedFrame, THREE = sf.THREE;
  const entry = vm._signatureLandmarks._entries.find(e => e.spec.id === id);
  entry.group.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(entry.group);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const v = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
    v.applyMatrix4(sf.camera.matrixWorldInverse).applyMatrix4(sf.camera.projectionMatrix);
    x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
  }
  return [(x0 + 1) / 2 * innerWidth, (1 - y1) / 2 * innerHeight, (x1 + 1) / 2 * innerWidth, (1 - y0) / 2 * innerHeight];
}, p.landmark);
const pad = 60, W = 1280, H = 800;
const x = Math.max(0, Math.floor(rect[0] - pad)), y = Math.max(0, Math.floor(rect[1] - pad));
const clip = { x, y, width: Math.min(W - x, Math.ceil(rect[2] - rect[0] + 2 * pad)), height: Math.min(H - y, Math.ceil(rect[3] - rect[1] + 2 * pad)) };
const shots = [];
for (const ms of [0, 150, 300, 600]) {
  await page.evaluate(ms => { window.__arrFake = window.__arrStart + ms; }, ms);
  await page.waitForTimeout(ms === 600 ? 1500 : 400);
  const state = await page.evaluate(id => { const sl = canalRecallGame.vectorMap._signatureLandmarks, e = sl._entries.find(x => x.spec.id === id); return { fading: !!sl._levelFades?.has(e), arriving: !!e?.arriving, suppressed: sl.shownSuppressOsmIds().some(o => e.spec.suppressOsmIds.includes(o)) }; }, p.landmark);
  const file = path.join(outDir, `${poseName}-${tag}-${ms}ms.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 85, clip });
  await page.screenshot({ path: file.replace(/\.jpg$/, '-full.jpg'), type: 'jpeg', quality: 80 });
  shots.push({ ms, file, ...state });
  console.log(ms, JSON.stringify(state));
}
fs.writeFileSync(path.join(outDir, `${poseName}-${tag}.json`), JSON.stringify({ arrival, rect, clip, shots, errors }, null, 1));
if (errors.length) console.log('page errors', errors.slice(0, 5));
await browser.close();
