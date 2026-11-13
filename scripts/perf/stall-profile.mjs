// Ride stall profile (lane LS, 2026-11-13; Sentry CANAL-RECALL-T: a 2253 ms rAF callback 19 s into an own-engine
// ride, heap 1845 MB). Cold load of the deployed ride, headed, on rails (Geldersekade <-> Nieuwmarkt) for --ride s
// after the ride starts, with the main-thread heap and game state every 500 ms and every long animation frame.
//   --mode cpu   CDP Profiler from boot (1 ms samples); long tasks are runs of non-idle samples >= --long ms, each
//                attributed by self and inclusive time to function url:line:col (minified; map with map-profile.mjs).
//                The first ~1.7 s after Profiler.start is the profiler's own stall: ignore it.
//   --mode heap  CDP sampling heap profiler from boot, collected objects included: every allocation (garbage too) by stack.
//   node scripts/perf/stall-profile.mjs <outDir> [--mode cpu|heap] [--engine own|maplibre] [--ride 30] [--w 1440 --h 900
//     --dpr 2] [--long 200] [--headless] [--tabs 1] [--origin https://rideamsterdam.nl]
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const outDir = argv[0];
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const has = k => argv.includes(`--${k}`);
const mode = opt('mode', 'cpu'), engine = opt('engine', 'own'), origin = opt('origin', 'https://rideamsterdam.nl');
const W = Number(opt('w', '1440')), H = Number(opt('h', '900')), DPR = Number(opt('dpr', '2'));
const ride = Number(opt('ride', '30')), longMs = Number(opt('long', '200')), tabs = Number(opt('tabs', '1'));
fs.mkdirSync(outDir, { recursive: true });
const la = () => os.loadavg().map(v => +v.toFixed(1));
const START = [52.37665, 4.90115], FINISH = [52.37265, 4.90035];
const url = `${origin}/ride?travel=car${engine === 'own' ? '&engine=own' : ''}#race=${START[0]},${START[1]},${START[0]},${START[1]},${FINISH[0]},${FINISH[1]}`;

const browser = await chromium.launch({
  headless: has('headless'), executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-precise-memory-info'],
});
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
await context.route(/ingest\.(us\.)?sentry\.io|google-analytics|googletagmanager/, r => r.fulfill({ status: 200, body: '{}' }));
// --bundles <dir>: serve any /js/<file>.js found in <dir> instead of the deployed one (a before/after of a source change).
const bundles = opt('bundles', '');
if (bundles) await context.route(/\/js\/([\w.-]+\.js)(\?.*)?$/, r => {
  const file = path.join(bundles, /\/js\/([\w.-]+\.js)/.exec(r.request().url())[1]);
  return fs.existsSync(file) ? r.fulfill({ path: file, contentType: 'application/javascript' }) : r.continue();
});
await context.addInitScript(() => {
  const w = window; w.__ls = { loaf: [], heap: [], t0: performance.now() };
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.duration >= 150) w.__ls.loaf.push({ start: Math.round(e.startTime), dur: Math.round(e.duration), blocking: Math.round(e.blockingDuration ?? 0), state: w.canalRecallGame?.state ?? null,
      scripts: (e.scripts ?? []).map(s => ({ dur: Math.round(s.duration), invoker: s.invoker, type: s.invokerType, fn: s.sourceFunctionName, url: (s.sourceURL ?? '').split('/').pop(), pos: s.sourceCharPosition, layout: Math.round(s.forcedStyleAndLayoutDuration ?? 0) })) }); })
      .observe({ type: 'long-animation-frame', buffered: true });
  } catch (_) {}
  setInterval(() => { const m = performance.memory; w.__ls.heap.push({ t: Math.round(performance.now()), mb: m ? Math.round(m.usedJSHeapSize / 1048576) : null, totalMb: m ? Math.round(m.totalJSHeapSize / 1048576) : null, state: w.canalRecallGame?.state ?? null }); }, 500);
});
// --warm: one full load first in the same context (HTTP cache warm, as a returning player), then the measured load.
if (has('warm')) {
  const prime = await context.newPage();
  await prime.goto(url, { waitUntil: 'commit' });
  await prime.waitForFunction(() => window.canalRecallGame?.state === 4, null, { timeout: 240_000, polling: 500 });
  await prime.waitForTimeout(20_000);
  await prime.close();
}
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
const log = { bundles: bundles || null, warm: has('warm'), tabs, mode, engine, url, viewport: [W, H], dpr: DPR, loadAtStart: la() };
if (mode === 'cpu') { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start'); }
else if (!has('ride-only')) { await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 32768, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: !has('promoted') }); }
const wall0 = Date.now();
await page.goto(url, { waitUntil: 'commit' });
await page.waitForFunction(() => { const g = window.canalRecallGame; return g && g.state === 4 && (!g.camera || !g.camera.introOverview); }, null, { timeout: 240_000, polling: 250 });
log.rideStartS = (Date.now() - wall0) / 1000;
log.rideStartPageMs = await page.evaluate(() => Math.round(performance.now()));
log.loadAtRideStart = la();
// --ride-only (heap mode): sample allocations from the ride's start, not the boot. --promoted leaves out objects a
// minor GC collects: what is left survives into the old generation and drives the major-GC sawtooth.
if (mode === 'heap' && has('ride-only')) { await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 32768, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: !has('promoted') }); }
// --mode gc: a devtools.timeline + v8.gc trace over the ride (every minor and major GC with heap before and after), to
// see what feeds the old generation: the creep of the after-minor-GC heap is promotion plus direct old-space allocation.
if (mode === 'gc') await cdp.send('Tracing.start', { transferMode: 'ReturnAsStream', traceConfig: { includedCategories: ['devtools.timeline', 'v8', 'disabled-by-default-v8.gc'] } });
await page.evaluate((fin) => {
  const g = window.canalRecallGame, p = g.player, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER');
  g._quizFreezesRide = () => false; p.handleInput = () => {};
  const world = (lat, lng) => ({ x: l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y: l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm });
  const a = { x: p.x, y: p.y };
  let pth = g.track.findRoute(a, world(fin[0], fin[1]));
  if (!pth || pth.length < 2) pth = [a, { x: a.x + 3000, y: a.y }];
  const loop = [...pth, ...pth.slice(0, -1).reverse()];
  const cum = [0]; for (let k = 1; k < loop.length; k++) cum.push(cum[k - 1] + Math.hypot(loop[k].x - loop[k - 1].x, loop[k].y - loop[k - 1].y));
  const total = cum[cum.length - 1]; let at = 0, seg = 1; const v = 120;
  p.update = function (dt) {
    at += v * dt; if (at >= total) { at -= total; seg = 1; }
    while (seg < loop.length - 1 && cum[seg] < at) seg++;
    const s = loop[seg - 1], e = loop[seg], f = (at - cum[seg - 1]) / Math.max(1e-6, cum[seg] - cum[seg - 1]);
    let d = Math.atan2(e.y - s.y, e.x - s.x) - this.angle; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.x = s.x + (e.x - s.x) * f; this.y = s.y + (e.y - s.y) * f; this.angle += d * Math.min(1, dt * 6);
    this.speed = v; this.vx = Math.cos(this.angle) * v; this.vy = Math.sin(this.angle) * v;
  };
}, FINISH);
// --tabs 2: a second game tab, opened 5 s into the ride (does the first tab's heap figure include it?).
const extra = [];
for (let i = 1; i < tabs; i++) { await page.waitForTimeout(5000); const p2 = await context.newPage(); await p2.goto(url, { waitUntil: 'commit' }); extra.push(p2); }
await page.waitForTimeout(ride * 1000);
log.loadAtEnd = la();
if (mode === 'gc') {
  const done = new Promise(r => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.end'); const { stream } = await done;
  let text = ''; for (;;) { const c = await cdp.send('IO.read', { handle: stream }); text += c.base64Encoded ? Buffer.from(c.data, 'base64').toString() : c.data; if (c.eof) break; }
  const ev = JSON.parse(text).traceEvents ?? JSON.parse(text);
  fs.writeFileSync(path.join(outDir, 'gc-trace.json'), JSON.stringify(ev.filter(e => /GC|gc/.test(e.name) || /gc/.test(e.cat))));
  const gcs = ev.filter(e => (e.name === 'MinorGC' || e.name === 'MajorGC') && e.ph === 'X' && e.args?.usedHeapSizeBefore != null).sort((a, b) => a.ts - b.ts);
  const t0 = gcs[0]?.ts ?? 0;
  log.gcs = gcs.map(e => ({ t: +((e.ts - t0) / 1e6).toFixed(2), kind: e.name === 'MajorGC' ? 'major' : 'minor', ms: +(e.dur / 1000).toFixed(1), beforeMB: +(e.args.usedHeapSizeBefore / 1048576).toFixed(1), afterMB: +(e.args.usedHeapSizeAfter / 1048576).toFixed(1), type: e.args.type ?? null }));
}

// Heap now, then after a forced GC (garbage vs live), and the same for each extra tab.
const heapOf = p => p.evaluate(() => Math.round(performance.memory.usedJSHeapSize / 1048576)).catch(() => null);
log.heapBeforeGcMB = await heapOf(page);
if (mode === 'cpu') await cdp.send('HeapProfiler.enable');
await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
log.heapAfterGcMB = await heapOf(page);
log.extraTabsHeapMB = await Promise.all(extra.map(heapOf));
log.rendererPids = await Promise.all([page, ...extra].map(async p => { try { const c = await context.newCDPSession(p); const r = await c.send('SystemInfo.getProcessInfo').catch(() => null); return r ? r.processInfo.filter(x => x.type === 'renderer').length : null; } catch (_) { return null; } }));
const ls = await page.evaluate(() => window.__ls);
log.loaf = ls.loaf; log.heap = ls.heap;
log.end = await page.evaluate(() => { const vm = window.canalRecallGame?.vectorMap; return { roadScratch: !!window.canalRecallGame?.track?._roadScratch, scratchHasCount: !!window.CanalRecallRoadSurface?.nearbyContacts, tier: window.__canalPerf?.tier, workers: window.__canalPerf?.snapshot?.()?.workers ?? null, snapshot: (() => { try { return window.__canalPerf?.snapshot?.(); } catch (e) { return String(e); } })() }; });
if (mode === 'cpu') {
  const { profile } = await cdp.send('Profiler.stop');
  fs.writeFileSync(path.join(outDir, 'ride.cpuprofile'), JSON.stringify(profile));
  // Long tasks: runs of non-idle samples (gaps under 4 ms bridged).
  const byId = new Map(profile.nodes.map(n => [n.id, n]));
  const parent = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const label = n => { const f = n.callFrame; return `${f.functionName || '(anon)'} ${f.url.split('/').pop().split('?')[0]}:${f.lineNumber + 1}:${f.columnNumber + 1}`; };
  const idle = id => { const f = byId.get(id).callFrame.functionName; return f === '(idle)' || f === '(program)' || f === '(garbage collector)' && false; };
  let t = 0; const samples = profile.samples.map((id, i) => { t += profile.timeDeltas[i]; return { id, t: t / 1000 }; });
  const tasks = []; let cur = null;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i], dt = i + 1 < samples.length ? samples[i + 1].t - s.t : 1;
    if (idle(s.id)) { if (cur && s.t - cur.end > 4) { tasks.push(cur); cur = null; } continue; }
    if (!cur) cur = { start: s.t, end: s.t, idx: [] };
    cur.end = s.t + dt; cur.idx.push([s.id, dt]);
  }
  if (cur) tasks.push(cur);
  const rideAt = log.rideStartS * 1000;
  // The longest stretch of consecutive (garbage collector) samples after the ride starts (a GC pause on the main thread).
  { let run = 0, best = 0; for (let i = 0; i < samples.length; i++) { const dt = i + 1 < samples.length ? samples[i + 1].t - samples[i].t : 1; if (samples[i].t >= rideAt && byId.get(samples[i].id).callFrame.functionName === '(garbage collector)') { run += dt; best = Math.max(best, run); } else run = 0; }
    log.longestRideGcMs = Math.round(best);
    log.rideGcMs = Math.round(samples.reduce((a, x, i) => a + (x.t >= rideAt && byId.get(x.id).callFrame.functionName === '(garbage collector)' ? (i + 1 < samples.length ? samples[i + 1].t - x.t : 1) : 0), 0)); }
  log.longTasks = tasks.filter(k => k.end - k.start >= longMs).map(k => {
    const self = new Map(), incl = new Map();
    for (const [id, dt] of k.idx) {
      self.set(label(byId.get(id)), (self.get(label(byId.get(id))) ?? 0) + dt);
      const seen = new Set(); for (let n = id; n != null; n = parent.get(n)) { const l = label(byId.get(n)); if (!seen.has(l)) { seen.add(l); incl.set(l, (incl.get(l) ?? 0) + dt); } }
    }
    const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([fn, ms]) => ({ fn, ms: Math.round(ms) }));
    return { startS: +(k.start / 1000).toFixed(2), sinceRideS: +((k.start - rideAt) / 1000).toFixed(2), ms: Math.round(k.end - k.start), self: top(self, 12), inclusive: top(incl, 25) };
  });
} else {
  const { profile } = await cdp.send('HeapProfiler.getSamplingProfile');
  await cdp.send('HeapProfiler.stopSampling');
  fs.writeFileSync(path.join(outDir, 'ride.heapprofile'), JSON.stringify(profile));
  // Live bytes by allocating function, and by the first frame in our code under it.
  const self = new Map(), ours = new Map();
  const walk = (n, stack) => {
    const f = n.callFrame, l = `${f.functionName || '(anon)'} ${f.url.split('/').pop().split('?')[0]}:${f.lineNumber + 1}:${f.columnNumber + 1}`;
    const st = [...stack, l];
    if (n.selfSize) { self.set(l, (self.get(l) ?? 0) + n.selfSize); const o = [...st].reverse().find(x => /\.js:/.test(x) && !/three\.bundle|maplibre/.test(x)) ?? l; ours.set(o, (ours.get(o) ?? 0) + n.selfSize); }
    for (const c of n.children ?? []) walk(c, st);
  };
  walk(profile.head, []);
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([fn, b]) => ({ fn, mb: +(b / 1048576).toFixed(1) }));
  log.heapLiveMB = +([...self.values()].reduce((a, b) => a + b, 0) / 1048576).toFixed(1);
  log.heapBySelf = top(self, 30); log.heapByOurFrame = top(ours, 30);
}
// Churn while riding (heap every 500 ms): a drop of more than 100 MB between samples is a major GC; the slope is the
// median MB/s of the rising runs between drops; the longest long-animation-frame while riding.
{
  const ride = log.heap.filter(h => h.t >= log.rideStartPageMs && h.mb != null);
  const slopes = []; let runStart = ride[0], majorGCs = 0;
  for (let i = 1; i < ride.length; i++) {
    if (ride[i - 1].mb - ride[i].mb > 100) {
      majorGCs++;
      const a = runStart, b = ride[i - 1];
      if (b.t - a.t >= 3000) slopes.push((b.mb - a.mb) / ((b.t - a.t) / 1000));
      runStart = ride[i];
    }
  }
  const last = ride.at(-1); if (runStart && last && last.t - runStart.t >= 3000) slopes.push((last.mb - runStart.mb) / ((last.t - runStart.t) / 1000));
  slopes.sort((a, b) => a - b);
  log.churn = { slopeMBps: slopes.length ? +slopes[slopes.length >> 1].toFixed(1) : null, slopes: slopes.map(v => +v.toFixed(1)), majorGCs,
    longestRideLoafMs: Math.max(0, ...log.loaf.filter(l => l.start >= log.rideStartPageMs).map(l => l.dur)) };
}
fs.writeFileSync(path.join(outDir, `stall-${mode}.json`), JSON.stringify(log, null, 1));
const peak = Math.max(0, ...log.heap.map(h => h.mb ?? 0));
console.log(JSON.stringify({ warm: has('warm'), tabs, mode, rideStartS: log.rideStartS, loaf: log.loaf.filter(l => l.dur >= 500).map(l => [Math.round((l.start - log.rideStartPageMs) / 100) / 10, l.dur, l.state]), heapPeakMB: peak, churn: log.churn, longestRideGcMs: log.longestRideGcMs, rideGcMs: log.rideGcMs, heapEndMB: log.heap.at(-1)?.mb, heapBeforeGcMB: log.heapBeforeGcMB, heapAfterGcMB: log.heapAfterGcMB, extraTabsHeapMB: log.extraTabsHeapMB, longTasks: log.longTasks?.map(k => [k.sinceRideS, k.ms]), load: [log.loadAtStart[0], log.loadAtRideStart[0], log.loadAtEnd[0]] }));
await browser.close();
