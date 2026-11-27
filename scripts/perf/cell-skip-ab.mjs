// Baked-cell hidden skip (lane cell-hidden-skip, 2026-11-27; engine/cellSkip.ts): the same frame drawn twice in one
// task, the cells skipping and then submitting every triangle (BakedCoarse.setCellSkipLive), with the clock frozen, and
// the two drawing buffers compared pixel by pixel. Taken at settled poses (the rider stopped, 3 s) and mid-swap (a
// detail chunk dissolving in or out over the coarse shells while riding). Also the per-swap main-thread cost of the
// index rewrite over the ride (BakedCoarse.skipStats).
//
//   PORT=4633 node scripts/perf/cell-skip-ab.mjs <out.json> [--route belt] [--speed 9] [--poses 24,36,48]
//     [--swaps 8] [--shots <dir>] [--qs 'a=1'] [--dpr 2] [--w 1512] [--h 900] [--warm 15]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const out = argv[0];
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const route = opt('route', 'belt'), speed = Number(opt('speed', '9')), swaps = Number(opt('swaps', '8'));
const poses = opt('poses', '24,36,48').split(',').map(Number);
const DPR = Number(opt('dpr', '2')), W = Number(opt('w', '1512')), H = Number(opt('h', '900'));
const shots = opt('shots', null), extraQs = opt('qs', '');
const origin = `http://127.0.0.1:${process.env.PORT || 4633}`;
const ROUTES = { belt: { start: '^waag$', dest: 'westerkerk' } };
const R = ROUTES[route] ?? (() => { const [s, d] = route.split(':'); return { start: s, dest: d }; })();
setTimeout(() => { console.error('watchdog: giving up'); process.exit(3); }, 900_000).unref();

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
await context.route(/ingest\.(us\.)?sentry\.io|google-analytics|googletagmanager/, r => r.fulfill({ status: 200, body: '{}' }));
if (process.env.BUNDLES_DIR) await context.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, r => {
  const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(r.request().url())[1]);
  return fs.existsSync(file) ? r.fulfill({ body: fs.readFileSync(file), contentType: 'application/javascript' }) : r.continue();
});
await context.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
await page.goto(`${origin}/canal-drive/?engine=own${extraQs ? `&${extraQs.replace(/^[?&]/, '')}` : ''}`);
await page.waitForFunction(() => (window.canalRecallGame?.routePois?.length ?? 0) > 20, null, { timeout: 150_000 });
const ids = await page.evaluate(([s, d]) => {
  const pois = canalRecallGame.routePois, f = q => pois.find(p => p.id === q) || pois.find(p => new RegExp(q, 'i').test(p.name || ''));
  const a = f(s), b = f(d);
  return a && b ? { start: a.id, dest: b.id } : { missing: true };
}, [R.start, R.dest]);
if (ids.missing) { console.log('route POI not found'); await browser.close(); process.exit(2); }
await page.locator('#travel-mode').selectOption('car', { force: true });
await page.locator('#view-mode').selectOption('chase', { force: true });
await page.locator('#poi-destination').selectOption(ids.dest);
await page.evaluate(a => { const g = canalRecallGame; g._pickDestinationNear = () => g.routePois.find(p => p.id === a); }, ids.start);
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, { timeout: 180_000, polling: 100 });
await page.evaluate(mps => {
  const g = canalRecallGame, p = g.player, ppm = (0, eval)('PIXELS_PER_METER');
  g._quizFreezesRide = () => false; p.handleInput = () => {};
  const rails = g.track.findRoute({ x: p.x, y: p.y }, g.track.finishPoint);
  const cum = [0]; for (let k = 1; k < rails.length; k++) cum.push(cum[k - 1] + Math.hypot(rails[k].x - rails[k - 1].x, rails[k].y - rails[k - 1].y));
  let at = 0, seg = 1; const v = mps * ppm;
  window.__ridden = () => at / ppm;
  p.update = function (dt) {
    if (!window.__go) { this.speed = 0; this.vx = 0; this.vy = 0; return; }
    at = Math.min(cum[cum.length - 1], at + v * Math.min(dt, 1 / 30));
    while (seg < rails.length - 1 && cum[seg] < at) seg++;
    const a = rails[seg - 1], b = rails[seg], f = (at - cum[seg - 1]) / Math.max(1e-6, cum[seg] - cum[seg - 1]);
    let d = Math.atan2(b.y - a.y, b.x - a.x) - this.angle; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.x = a.x + (b.x - a.x) * f; this.y = a.y + (b.y - a.y) * f; this.angle += d * Math.min(1, dt * 6);
    this.speed = at < cum[cum.length - 1] ? v : 0; this.vx = Math.cos(this.angle) * this.speed; this.vy = Math.sin(this.angle) * this.speed;
  };
  // The same frame twice in one task: skipping, then every triangle; the clock frozen across both. Returns the diff and,
  // with `keep`, both frames as PNG data URLs.
  window.__abFrame = keep => {
    const vm = g.vectorMap, bc = vm._bakedCoarse, host = vm.host, gl = host.renderer.getContext();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const pn = performance.now, t = pn.call(performance), dn = Date.now, td = dn();
    performance.now = () => t; Date.now = () => td;
    const grab = () => { const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
    let a, b, skipped, full;
    try {
      bc.setCellSkipLive(true); host.redraw(); a = grab(); skipped = bc.skipStats().skippedTriangles;
      bc.setCellSkipLive(false); host.redraw(); b = grab(); full = bc.skipStats().skippedTriangles;
    } finally { performance.now = pn; Date.now = dn; bc.setCellSkipLive(true); }
    let diff = 0, max = 0;
    for (let i = 0; i < a.length; i += 4) {
      const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
      if (d) { diff++; if (d > max) max = d; }
    }
    const png = px => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), im = x.createImageData(w, h);
      for (let y = 0; y < h; y++) im.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4); x.putImageData(im, 0, 0); return c.toDataURL('image/png'); };
    const tb = vm._threeBuildings;
    const swapping = tb ? [...tb.fading.keys()].filter(k => k.startsWith('near:')).length + [...tb.leaving].length : 0;
    return { w, h, diffPx: diff, maxDelta: max, skippedTriangles: skipped, afterOff: full, swapping, ...(keep ? { on: png(a), off: png(b) } : {}) };
  };
}, speed);

const T0 = Date.now(), say = m => console.error(`[${((Date.now() - T0) / 1000).toFixed(0)}s] ${m}`);
await page.waitForFunction(() => (canalRecallGame.vectorMap._bakedCoarse?.residents?.size ?? 1) > 0, null, { timeout: 120_000, polling: 500 }).catch(() => say('no baked cells after 120 s'));
await page.waitForTimeout(Number(opt('warm', '15')) * 1000);
const save = (name, r) => {
  if (!shots || !r.on) return;
  fs.mkdirSync(shots, { recursive: true });
  for (const k of ['on', 'off']) fs.writeFileSync(path.join(shots, `${name}-${k}.png`), Buffer.from(r[k].split(',')[1], 'base64'));
  delete r.on; delete r.off;
};
const results = { qs: extraQs, route, settled: [], midSwap: [], skip: null, errors };
const stats0 = await page.evaluate(() => canalRecallGame.vectorMap._bakedCoarse.skipStats());
await page.evaluate(() => { window.__go = true; });
// Mid-swap captures while riding: whenever a detail chunk is dissolving in or out over the shells.
let next = 0;
for (let i = 0; i < poses.length; i++) {
  const target = poses[i] * speed;
  while (await page.evaluate(m => window.__ridden() < m, target)) {
    if (results.midSwap.length < swaps * (i + 1) / poses.length && Date.now() >= next) {
      const swapping = await page.evaluate(() => { const tb = canalRecallGame.vectorMap._threeBuildings; return tb ? [...tb.fading.keys()].filter(k => k.startsWith('near:')).length + tb.leaving.size : 0; });
      if (swapping) {
        const keep = results.midSwap.length < 2;
        const r = await page.evaluate(k => window.__abFrame(k), keep);
        r.ridden = Math.round(await page.evaluate(() => window.__ridden()));
        save(`swap-${results.midSwap.length}`, r);
        results.midSwap.push(r);
        say(`mid-swap ${results.midSwap.length} at ${r.ridden} m: ${r.swapping} swapping, ${r.diffPx} px differ (max ${r.maxDelta}), ${r.skippedTriangles} tris skipped`);
        next = Date.now() + 1500;
      }
    }
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => { window.__go = false; });
  await page.waitForTimeout(3000);
  const r = await page.evaluate(() => window.__abFrame(true));
  r.ridden = Math.round(await page.evaluate(() => window.__ridden()));
  save(`pose-${poses[i]}s`, r);
  results.settled.push({ s: poses[i], ...r });
  say(`settled ${poses[i]} s at ${r.ridden} m: ${r.diffPx} px differ (max ${r.maxDelta}), ${r.skippedTriangles} tris skipped`);
  await page.evaluate(() => { window.__go = true; });
}
const stats1 = await page.evaluate(() => canalRecallGame.vectorMap._bakedCoarse.skipStats());
results.skip = { start: stats0, end: stats1, syncs: stats1.syncs - stats0.syncs, msPerSync: +((stats1.ms - stats0.ms) / Math.max(1, stats1.syncs - stats0.syncs)).toFixed(3), maxMs: stats1.maxMs };
await browser.close();
fs.writeFileSync(out, JSON.stringify(results, null, 1));
console.log(JSON.stringify({ settled: results.settled.map(s => [s.s, s.diffPx, s.maxDelta, s.skippedTriangles]), midSwap: results.midSwap.map(s => [s.ridden, s.swapping, s.diffPx, s.maxDelta, s.skippedTriangles]), skip: results.skip, errors: errors.slice(0, 3) }, null, 1));
