// Desktop power (lane desktop-perf, 2026-11-27): "the game runs my Mac fan". A fan is a power question, so this measures
// the work per SECOND of a steady ride at David's settings (dpr 2, 120 Hz, default quality), not only frame time:
//   - rAF intervals (p50/p95/p99) and the frame host's rendered / idle / paced frames per second;
//   - main-thread busy % (CDP Performance TaskDuration / wall), script %, GC from a sampled profile (--profile);
//   - CPU seconds per second of the renderer, GPU and browser processes (SystemInfo.getProcessInfo);
//   - GPU ms per rendered frame and per second (EXT_disjoint_timer_query_webgl2 around FrameHost._render), and the
//     Apple GPU's own "Device Utilization %" from ioreg (machine-wide: take it under CANAL_PW_TIMING=1 only);
//   - draws and triangles per rendered frame, resident texture + renderbuffer MB (tracked from page start), JS heap after a
//     forced GC at ride start and end, three's renderer.info.memory;
//   - the own engine's ?framePhases=1 owners (ms per second).
// Headless Chrome on the Mac's GPU (ANGLE Metal). --hz 120 (default) uncaps Chrome's frame rate and paces rAF to 120 Hz in
// the page (a ProMotion display's vsync); --hz 0 leaves Chrome's own 60 Hz. --floor measures the harness alone on a blank
// page (the uncapped compositor's own CPU), to subtract.
//
//   PORT=4646 node scripts/perf/desktop-power.mjs <out.json> [--dpr 2] [--w 1512] [--h 900] [--hz 120] [--warm 15]
//     [--ride 60] [--qs 'a=1'] [--profile] [--trace 5] [--floor] [--still 0 (seconds stopped after the ride)]
// BUNDLES_DIR=<dir> serves *.bundle.js from a scratch build. Rides on rails (tier-ride.mjs): the race route Geldersekade <->
// Nieuwmarkt at a steady 120 px/s, input ignored, questions never hold the ride.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const out = argv[0];
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const has = k => argv.includes(`--${k}`);
const DPR = Number(opt('dpr', '2')), W = Number(opt('w', '1512')), H = Number(opt('h', '900')), HZ = Number(opt('hz', '120'));
const warm = Number(opt('warm', '15')), ride = Number(opt('ride', '60')), traceS = Number(opt('trace', '0')), stillS = Number(opt('still', '0'));
const origin = process.env.ORIGIN || `http://127.0.0.1:${process.env.PORT || 4646}`;
const T0 = Date.now(), say = m => console.error(`[${((Date.now() - T0) / 1000).toFixed(0)}s] ${m}`);
// A hung page (a blocked main thread never answers an evaluate) must not hold the timing lock for ever.
setTimeout(() => { console.error('watchdog: giving up'); process.exit(3); }, Number(opt('watchdog', '900')) * 1000).unref();
const la = () => os.loadavg().map(v => +v.toFixed(1));
const log = { at: new Date().toISOString(), dpr: DPR, viewport: [W, H], hz: HZ, qs: opt('qs', ''), bundles: process.env.BUNDLES_DIR ?? null, loadAtStart: la() };

const args = ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'];
if (HZ > 0) args.push('--disable-gpu-vsync', '--disable-frame-rate-limit');
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
await context.route(/ingest\.(us\.)?sentry\.io|google-analytics|googletagmanager/, r => r.fulfill({ status: 200, body: '{}' }));
if (process.env.BUNDLES_DIR) await context.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
  const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: 'application/javascript' }) : route.continue();
});
// rAF at HZ: one native pump, callbacks batched and delivered on the first native frame at least a period after the last
// delivery (a display's vsync). Resident GPU memory: texture and renderbuffer allocations tracked per object from page start.
await context.addInitScript(({ hz }) => {
  let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  if (hz > 0) {
    // A vsync clock on timers: Chrome's uncapped BeginFrames run at ~1,200 fps only while every frame draws, and fall back
    // to 60 Hz after a frame without damage, so a pump on native rAF that skipped frames read ~45 fps (measured).
    const period = 1000 / hz;
    let queue = new Map(), next = 1, armed = false, tick = 0;
    const fire = () => {
      armed = false;
      const now = performance.now();
      // The next vsync after this one; a late callback (a long frame) skips the vsyncs it missed, as a display does.
      tick = Math.max(tick + period, now);
      const q = queue; queue = new Map();
      for (const cb of q.values()) { try { cb(tick); } catch (e) { setTimeout(() => { throw e; }); } }
      if (queue.size) arm();
    };
    const arm = () => {
      if (armed) return; armed = true;
      const now = performance.now();
      let at = tick + period; while (at < now) at += period;
      setTimeout(fire, Math.max(0, at - now - 0.3));
    };
    window.requestAnimationFrame = cb => { const id = next++; queue.set(id, cb); arm(); return id; };
    window.cancelAnimationFrame = id => { queue.delete(id); };
  }
  // Worker traffic by message kind, and how often the same chunk key is asked for again (rebuild churn).
  const WM = window.__wmsg = { kinds: {}, keys: {} };
  const post = Worker.prototype.postMessage;
  Worker.prototype.postMessage = function (data, ...rest) {
    try {
      const k = data?.type ?? data?.kind ?? (data?.key != null ? `job ${data.special ?? data.mode ?? 'walls'}` : Object.keys(data ?? {}).slice(0, 3).join(','));
      WM.kinds[k] = (WM.kinds[k] ?? 0) + 1;
      if (data?.key != null) WM.keys[`${data.mode ?? data.special ?? 'walls'}|${data.key}`] = (WM.keys[`${data.mode ?? data.special ?? 'walls'}|${data.key}`] ?? 0) + 1;
    } catch (_) {}
    return post.call(this, data, ...rest);
  };
  const M = window.__gpuMem = { tex: new Map(), rb: new Map(), draws: 0, tris: 0 };
  const P = WebGL2RenderingContext.prototype, bound = new WeakMap();
  const unitKey = (gl, target) => { const st = bound.get(gl) || (bound.set(gl, { unit: 0, b: {} }), bound.get(gl)); return [st, `${st.unit}:${target}`]; };
  const faceTarget = (gl, t) => (t >= gl.TEXTURE_CUBE_MAP_POSITIVE_X && t <= gl.TEXTURE_CUBE_MAP_NEGATIVE_Z ? gl.TEXTURE_CUBE_MAP : t);
  const bpp = f => ({ 0x8814: 16, 0x881A: 8, 0x822E: 4, 0x8230: 8, 0x822D: 2, 0x8229: 1, 0x822B: 2, 0x8D48: 1, 0x81A5: 2, 0x81A6: 3, 0x88F0: 4, 0x8CAC: 4, 0x8CAD: 8, 0x8051: 3, 0x1907: 3 })[f] ?? 4;
  const wrap = (name, f) => { const o = P[name]; if (o) P[name] = function (...a) { try { f(this, a); } catch (_) {} return o.apply(this, a); }; };
  wrap('activeTexture', (gl, a) => { unitKey(gl, 0)[0].unit = a[0] - gl.TEXTURE0; });
  wrap('bindTexture', (gl, a) => { const [st, k] = unitKey(gl, a[0]); st.b[k] = a[1]; });
  const texAt = (gl, target) => { const [st, k] = unitKey(gl, faceTarget(gl, target)); return st.b[k]; };
  const put = (tex, key, bytes) => { if (!tex) return; const e = M.tex.get(tex) || (M.tex.set(tex, new Map()), M.tex.get(tex)); e.set(key, bytes); };
  wrap('texImage2D', (gl, a) => { const t = texAt(gl, a[0]); if (a.length >= 8 && typeof a[3] === 'number') put(t, `${a[0]}:${a[1]}`, a[3] * a[4] * bpp(a[2])); else { const img = a[a.length - 1]; put(t, `${a[0]}:${a[1]}`, (img?.width ?? 0) * (img?.height ?? 0) * 4); } });
  wrap('texImage3D', (gl, a) => { put(texAt(gl, a[0]), `${a[0]}:${a[1]}`, a[3] * a[4] * a[5] * bpp(a[2])); });
  wrap('texStorage2D', (gl, a) => { const t = texAt(gl, a[0]), faces = a[0] === gl.TEXTURE_CUBE_MAP ? 6 : 1; put(t, 'storage', a[3] * a[4] * bpp(a[2]) * faces * (a[1] > 1 ? 4 / 3 : 1)); });
  wrap('texStorage3D', (gl, a) => { put(texAt(gl, a[0]), 'storage', a[3] * a[4] * a[5] * bpp(a[2]) * (a[1] > 1 ? 4 / 3 : 1)); });
  wrap('compressedTexImage2D', (gl, a) => { const d = a.find(x => ArrayBuffer.isView(x)); put(texAt(gl, a[0]), `${a[0]}:${a[1]}`, d ? d.byteLength : a[3] * a[4]); });
  wrap('generateMipmap', (gl, a) => { const t = texAt(gl, a[0]); const e = t && M.tex.get(t); if (e) { const base = e.get(`${a[0]}:0`); if (base) e.set('mips', base / 3); } });
  wrap('deleteTexture', (gl, a) => { M.tex.delete(a[0]); });
  let rbBound = null;
  wrap('bindRenderbuffer', (gl, a) => { rbBound = a[1]; });
  wrap('renderbufferStorage', (gl, a) => { if (rbBound) M.rb.set(rbBound, a[2] * a[3] * bpp(a[1])); });
  wrap('renderbufferStorageMultisample', (gl, a) => { if (rbBound) M.rb.set(rbBound, a[3] * a[4] * bpp(a[2]) * Math.max(1, a[1])); });
  wrap('deleteRenderbuffer', (gl, a) => { M.rb.delete(a[0]); });
  const tri = (mode, n) => (mode === 4 ? n / 3 : mode === 5 || mode === 6 ? Math.max(0, n - 2) : 0);
  wrap('drawArrays', (gl, a) => { M.draws++; M.tris += tri(a[0], a[2]); });
  wrap('drawElements', (gl, a) => { M.draws++; M.tris += tri(a[0], a[1]); });
  wrap('drawArraysInstanced', (gl, a) => { M.draws++; M.tris += tri(a[0], a[2]) * a[3]; });
  wrap('drawElementsInstanced', (gl, a) => { M.draws++; M.tris += tri(a[0], a[1]) * a[4]; });
  wrap('drawRangeElements', (gl, a) => { M.draws++; M.tris += tri(a[0], a[3]); });
  window.__gpuMemMB = () => {
    let tex = 0; for (const e of M.tex.values()) for (const b of e.values()) tex += b;
    let rb = 0; for (const b of M.rb.values()) rb += b;
    return { textures: M.tex.size, textureMB: +(tex / 1048576).toFixed(1), renderbuffers: M.rb.size, renderbufferMB: +(rb / 1048576).toFixed(1) };
  };
}, { hz: HZ });

const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
const cdp = await context.newCDPSession(page);
const bcdp = await browser.newBrowserCDPSession();
await cdp.send('Performance.enable', { timeDomain: 'timeTicks' });
const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
const procs = async () => { try { return (await bcdp.send('SystemInfo.getProcessInfo')).processInfo; } catch (e) { return null; } };
const gpuUtil = () => { try { const s = execFileSync('ioreg', ['-r', '-d', '1', '-w', '0', '-c', 'IOAccelerator'], { encoding: 'utf8' }); const m = /"Device Utilization %"=(\d+)/.exec(s); return m ? Number(m[1]) : null; } catch { return null; } };

if (has('floor')) {
  // The harness alone: a blank page with the same flags and a rAF loop that does nothing.
  await page.setContent('<canvas></canvas><script>const f=()=>requestAnimationFrame(f);requestAnimationFrame(f);</script>');
  await page.waitForTimeout(3000);
  const m0 = await metrics(), p0 = await procs(), t0 = Date.now(); const util = [];
  for (let i = 0; i < ride; i++) { await page.waitForTimeout(1000); util.push(gpuUtil()); }
  const m1 = await metrics(), p1 = await procs(), wall = (Date.now() - t0) / 1000;
  log.floor = { mainBusyPct: +((m1.TaskDuration - m0.TaskDuration) / wall * 100).toFixed(1), cpuPerS: cpuPerS(p0, p1, wall), gpuUtilMean: mean(util) };
  fs.writeFileSync(out, JSON.stringify(log, null, 1));
  console.log(JSON.stringify(log.floor));
  await browser.close();
  process.exit(0);
}

const START = [52.37665, 4.90115], FINISH = [52.37265, 4.90035];
const hash = `#race=${START[0]},${START[1]},${START[0]},${START[1]},${FINISH[0]},${FINISH[1]}`;
const qs = `?travel=car&framePhases=1${log.qs ? `&${log.qs.replace(/^[?&]/, '')}` : ''}`;
const tLoad = Date.now();
await page.goto(`${origin}/canal-drive/${qs}${hash}`, { waitUntil: 'commit' });
await page.waitForFunction(() => { const g = window.canalRecallGame; return g && g.state === 4 && (!g.camera || !g.camera.introOverview); }, null, { timeout: 240_000, polling: 500 });
log.rideStartS = (Date.now() - tLoad) / 1000;
say(`ride started after ${log.rideStartS} s`);
await cdp.send('HeapProfiler.enable');
await cdp.send('HeapProfiler.collectGarbage');
log.heapAtRideStartMB = await page.evaluate(() => Math.round(performance.memory.usedJSHeapSize / 1048576));
log.railPx = await page.evaluate((fin) => {
  const g = window.canalRecallGame, p = g.player, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER');
  g._quizFreezesRide = () => false; p.handleInput = () => {};
  const world = (lat, lng) => ({ x: l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y: l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm });
  const a = { x: p.x, y: p.y };
  let route = g.track.findRoute(a, world(fin[0], fin[1]));
  if (!route || route.length < 2) route = [a, { x: a.x + 3000, y: a.y }];
  const loop = [...route, ...route.slice(0, -1).reverse()];
  const cum = [0]; for (let k = 1; k < loop.length; k++) cum.push(cum[k - 1] + Math.hypot(loop[k].x - loop[k - 1].x, loop[k].y - loop[k - 1].y));
  const total = cum[cum.length - 1]; let at = 0, seg = 1; const v = 120;
  window.__rails = { stop: false };
  p.update = function (dt) {
    if (window.__rails.stop) { this.speed = 0; this.vx = 0; this.vy = 0; return; }
    at += v * dt; if (at >= total) { at -= total; seg = 1; }
    while (seg < loop.length - 1 && cum[seg] < at) seg++;
    const s = loop[seg - 1], e = loop[seg], f = (at - cum[seg - 1]) / Math.max(1e-6, cum[seg] - cum[seg - 1]);
    let d = Math.atan2(e.y - s.y, e.x - s.x) - this.angle; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.x = s.x + (e.x - s.x) * f; this.y = s.y + (e.y - s.y) * f; this.angle += d * Math.min(1, dt * 6);
    this.speed = v; this.vx = Math.cos(this.angle) * v; this.vy = Math.sin(this.angle) * v;
  };
  return Math.round(total);
}, FINISH);
// GPU time per rendered frame (TIME_ELAPSED around the frame host's draw).
log.timer = await page.evaluate(() => {
  const vm = canalRecallGame.vectorMap, host = vm.host, gl = host.renderer.getContext();
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const T = window.__gpuT = { frames: [], pending: [], recording: false };
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const info = { ext: !!ext, renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), msaa: gl.getContextAttributes().antialias, samples: gl.getParameter(gl.SAMPLES) };
  if (!ext) return info;
  const base = host._render;
  host._render = function () {
    if (!T.recording) return base.call(this);
    const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    try { return base.call(this); } finally { gl.endQuery(ext.TIME_ELAPSED_EXT); T.pending.push(q); }
  };
  const poll = () => {
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    while (T.pending.length && gl.getQueryParameter(T.pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = T.pending.shift(), ns = gl.getQueryParameter(q, gl.QUERY_RESULT); gl.deleteQuery(q);
      if (!disjoint) T.frames.push(ns / 1e6);
    }
    setTimeout(poll, 50);
  };
  poll();
  return info;
});
say('rails on, warming');
await page.waitForTimeout(warm * 1000);
say('measuring');

const state = () => page.evaluate(() => {
  const vm = canalRecallGame.vectorMap, h = vm.host, p = window.__canalPerf ?? {}, r = h.renderer;
  return { tier: p.tier ?? null, tierReasons: p.tierReasons ?? null, pixelRatio: h.getPixelRatio(), canvas: [h.canvas.width, h.canvas.height], hostStats: { ...h.stats }, minFrameMs: h.minFrameMs,
    threeMemory: { ...r.info.memory }, programs: r.info.programs?.length ?? null, gpuMem: window.__gpuMemMB(), draws: window.__gpuMem.draws, tris: window.__gpuMem.tris,
    wmsg: JSON.parse(JSON.stringify(window.__wmsg)), governor: vm._renderGovernor ? { pixelRatio: vm._renderGovernor.pixelRatio ?? null, steps: vm._renderGovernor.steps?.length ?? 0 } : null };
});
// Measure.
const phases0 = await page.evaluate(() => window.__canalRecallFramePhases?.() ?? null);
await page.evaluate(() => { const w = window; w.__gpuT.recording = true; w.__fr = []; w.__rf = []; let lastR = performance.now(); canalRecallGame.vectorMap.host.on('render', () => { const n = performance.now(); if (!w.__frStop) w.__rf.push(n - lastR); lastR = n; }); let last = performance.now(); const tick = n => { w.__fr.push(n - last); last = n; if (!w.__frStop) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
if (has('profile')) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
// --alloc: V8's sampling heap profiler over the window (what allocates the garbage the GC then sweeps), by function.
if (has('alloc')) await cdp.send('HeapProfiler.startSampling', { samplingInterval: 32768, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
const s0 = await state(), m0 = await metrics(), p0 = await procs(), t0 = Date.now();
log.loadAtMeasure = la();
const util = [];
let traceEvents = null;
// --ab-on '<js>' --ab-off '<js>' [--ab-s 5]: an in-page A/B on one page, switching every ab-s seconds, the first
// second after each switch left out; per mode the process CPU, main-thread busy, GPU timer ms and drawn frames per
// second. Drift (other lanes' load, the route's content) lands on both modes alike.
const abOn = opt('ab-on', null), abOff = opt('ab-off', null), abS = Number(opt('ab-s', '5'));
const ab = abOn && abOff ? { on: [], off: [] } : null;
if (ab) {
  await page.evaluate(() => { const w = window; w.__abGpu = 0; w.__abGpuN = 0; const T = w.__gpuT; const push = T.frames.push.bind(T.frames); T.frames.push = v => { w.__abGpu += v; w.__abGpuN++; return push(v); }; });
  const read = async () => ({ m: await metrics(), p: await procs(), t: Date.now(), x: await page.evaluate(() => ({ gpu: window.__abGpu, gpuN: window.__abGpuN, frames: canalRecallGame.vectorMap.host.stats.frames })) });
  for (let k = 0, mode = 'on'; k * abS < ride; k++, mode = mode === 'on' ? 'off' : 'on') {
    await page.evaluate(js => (0, eval)(js), mode === 'on' ? abOn : abOff);
    await page.waitForTimeout(1000);
    const a = await read();
    await page.waitForTimeout((abS - 1) * 1000); util.push(gpuUtil());
    const b = await read(), w = (b.t - a.t) / 1000;
    ab[mode].push({ s: w, cpu: cpuPerS(a.p, b.p, w), mainPct: (b.m.TaskDuration - a.m.TaskDuration) / w * 100, gpuMsPerS: (b.x.gpu - a.x.gpu) / w, drawnPerS: (b.x.frames - a.x.frames) / w, gpuPerFrame: (b.x.gpu - a.x.gpu) / Math.max(1, b.x.gpuN - a.x.gpuN) });
  }
}
for (let i = ab ? ride : 0; i < ride; i++) {
  if (traceS && i === Math.floor(ride / 2)) {
    traceEvents = [];
    cdp.on('Tracing.dataCollected', e => traceEvents.push(...e.value));
    const done = new Promise(r => cdp.once('Tracing.tracingComplete', r));
    await cdp.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'v8', 'v8.execute', 'blink', 'gpu', 'cc', 'viz', 'toplevel', 'disabled-by-default-v8.gc'] } });
    await page.waitForTimeout(traceS * 1000);
    await cdp.send('Tracing.end'); await done;
    i += traceS - 1; util.push(gpuUtil());
    continue;
  }
  await page.waitForTimeout(1000); util.push(gpuUtil());
  if (i % 10 === 9) say(`measured ${i + 1} s, renderer heap ${await page.evaluate(() => Math.round(performance.memory.usedJSHeapSize / 1048576))} MB`);
}
const s1 = await state(), m1 = await metrics(), p1 = await procs(), wall = (Date.now() - t0) / 1000;
const raw = await page.evaluate(() => { const w = window; w.__frStop = true; w.__gpuT.recording = false; return { rf: w.__rf.slice(1), fr: w.__fr.slice(1), gpu: w.__gpuT.frames.slice(), phases: w.__canalRecallFramePhases?.() ?? null }; });
log.loadAtEnd = la();
let hot = null, gcMs = null;
if (has('profile')) {
  const { profile } = await cdp.send('Profiler.stop');
  const byId = new Map(profile.nodes.map(n => [n.id, n])), self = new Map();
  profile.samples.forEach((id, i) => { const f = byId.get(id).callFrame, d = (profile.timeDeltas[i + 1] ?? 0) / 1000; const k = `${f.functionName || '(anon)'} ${f.url.split('/').pop().replace(/\?.*/, '')}:${f.lineNumber}`; self.set(k, (self.get(k) || 0) + d); });
  hot = [...self].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([fn, ms]) => ({ fn, msPerS: +(ms / wall).toFixed(2) }));
  gcMs = +([...self].filter(([k]) => k.startsWith('(garbage collector)')).reduce((s, [, v]) => s + v, 0) / wall).toFixed(2);
  fs.writeFileSync(out.replace(/\.json$/, '.cpuprofile'), JSON.stringify(profile));
}
let alloc = null;
if (has('alloc')) {
  const { profile } = await cdp.send('HeapProfiler.stopSampling');
  const self = new Map();
  const walk = n => { const f = n.callFrame, k = `${f.functionName || '(anon)'} ${f.url.split('/').pop().replace(/\?.*/, '')}:${f.lineNumber}`; self.set(k, (self.get(k) || 0) + n.selfSize); (n.children || []).forEach(walk); };
  walk(profile.head);
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  alloc = { mbPerS: +(total / 1048576 / wall).toFixed(2), top: [...self].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([fn, b]) => ({ fn, mbPerS: +(b / 1048576 / wall).toFixed(3) })) };
}
if (traceEvents) fs.writeFileSync(out.replace(/\.json$/, '.trace.json'), JSON.stringify({ traceEvents }));
if (stillS) {
  // Stopped (the rider at rest, a menu open over a still world): the work per second when nothing moves.
  await page.evaluate(() => { window.__rails.stop = true; });
  await page.waitForTimeout(3000);
  const a = await state(), ma = await metrics(), pa = await procs(), ta = Date.now(), u = [];
  for (let i = 0; i < stillS; i++) { await page.waitForTimeout(1000); u.push(gpuUtil()); }
  const b = await state(), mb = await metrics(), pb = await procs(), ws = (Date.now() - ta) / 1000;
  log.still = { seconds: ws, renderedPerS: +((b.hostStats.frames - a.hostStats.frames) / ws).toFixed(1), mainBusyPct: +((mb.TaskDuration - ma.TaskDuration) / ws * 100).toFixed(1), cpuPerS: cpuPerS(pa, pb, ws), gpuUtilMean: mean(u) };
}
await cdp.send('HeapProfiler.collectGarbage');
log.heapAtEndMB = await page.evaluate(() => Math.round(performance.memory.usedJSHeapSize / 1048576));

function mean(v) { const x = v.filter(n => n != null); return x.length ? +(x.reduce((a, b) => a + b, 0) / x.length).toFixed(1) : null; }
function cpuPerS(a, b, w) {
  if (!a || !b) return null;
  const by = (list) => { const o = {}; for (const p of list) o[p.type] = (o[p.type] ?? 0) + p.cpuTime; return o; };
  const A = by(a), B = by(b), res = {};
  for (const k of Object.keys(B)) res[k] = +(((B[k] - (A[k] ?? 0)) / w)).toFixed(3);
  res.total = +Object.values(res).reduce((x, y) => x + y, 0).toFixed(3);
  return res;
}
const q = (v, f) => { const s = [...v].sort((a, b) => a - b); return +(s[Math.min(s.length - 1, Math.floor(s.length * f))] ?? 0).toFixed(2); };
const rendered = s1.hostStats.frames - s0.hostStats.frames;
const phaseTotals = raw.phases && phases0 ? Object.fromEntries(Object.entries(raw.phases.totals).map(([k, v]) => [k, +((v - (phases0.totals[k] ?? 0)) / wall).toFixed(1)]).sort((a, b) => b[1] - a[1]).slice(0, 25)) : null;
Object.assign(log, {
  wallS: wall, renderer: log.timer?.renderer, tier: s1.tier, tierReasons: s1.tierReasons, pixelRatio: s1.pixelRatio, canvas: s1.canvas, governor: s1.governor,
  frames: { n: raw.fr.length, fps: +(raw.fr.length / wall).toFixed(1), p50: q(raw.fr, 0.5), p95: q(raw.fr, 0.95), p99: q(raw.fr, 0.99), over17: raw.fr.filter(f => f > 17).length, over33: raw.fr.filter(f => f > 33.4).length, longest: +Math.max(0, ...raw.fr).toFixed(1) },
  // Between drawn frames (what the eye sees; the rAF intervals above are the display's clock under a cap).
  drawnFrames: { n: raw.rf.length, p50: q(raw.rf, 0.5), p95: q(raw.rf, 0.95), p99: q(raw.rf, 0.99), over20: raw.rf.filter(f => f > 20).length, over34: raw.rf.filter(f => f > 34).length },
  renderedPerS: +(rendered / wall).toFixed(1), idlePerS: +((s1.hostStats.idleFrames - s0.hostStats.idleFrames) / wall).toFixed(1), pacedPerS: +((s1.hostStats.pacedSkips - s0.hostStats.pacedSkips) / wall).toFixed(1),
  renderMsLast: +s1.hostStats.renderMs.toFixed(2),
  mainBusyPct: +((m1.TaskDuration - m0.TaskDuration) / wall * 100).toFixed(1), scriptPct: +((m1.ScriptDuration - m0.ScriptDuration) / wall * 100).toFixed(1),
  layoutPct: +(((m1.LayoutDuration - m0.LayoutDuration) + (m1.RecalcStyleDuration - m0.RecalcStyleDuration)) / wall * 100).toFixed(1),
  cpuPerS: cpuPerS(p0, p1, wall),
  gpu: { framesTimed: raw.gpu.length, msPerFrameP50: q(raw.gpu, 0.5), msPerFrameP95: q(raw.gpu, 0.95), msPerS: +(raw.gpu.reduce((a, b) => a + b, 0) / Math.max(1, raw.gpu.length) * rendered / wall).toFixed(1), utilMeanPct: mean(util), utilSeries: util },
  drawsPerFrame: rendered ? Math.round((s1.draws - s0.draws) / rendered) : null, trisPerFrame: rendered ? Math.round((s1.tris - s0.tris) / rendered) : null,
  gpuMem: s1.gpuMem, threeMemory: s1.threeMemory, programs: s1.programs,
  jsHeapTotalMB: Math.round(m1.JSHeapTotalSize / 1048576), gcMsPerS: gcMs, phasesMsPerS: phaseTotals, phasesFrames: raw.phases ? raw.phases.frames - (phases0?.frames ?? 0) : null,
  workerMsgs: (() => { const d = {}; for (const [k, v] of Object.entries(s1.wmsg.kinds)) { const n = v - (s0.wmsg.kinds[k] ?? 0); if (n) d[k] = n; } return d; })(),
  workerRepeatKeys: (() => { let again = 0, keys = 0; for (const [k, v] of Object.entries(s1.wmsg.keys)) { const n = v - (s0.wmsg.keys[k] ?? 0); if (n) { keys++; if ((s0.wmsg.keys[k] ?? 0) > 0 || n > 1) again++; } } return { keysAsked: keys, askedBefore: again }; })(),
  ab: ab && Object.fromEntries(Object.entries(ab).map(([k, v]) => {
    const med = f => { const x = v.map(f).sort((a, b) => a - b); return +(x[Math.floor(x.length / 2)] ?? 0).toFixed(2); };
    return [k, { windows: v.length, totalCpuPerS: med(r => r.cpu?.total ?? 0), rendererCpuPerS: med(r => r.cpu?.renderer ?? 0), gpuProcCpuPerS: med(r => r.cpu?.GPU ?? 0), mainPct: med(r => r.mainPct), gpuMsPerS: med(r => r.gpuMsPerS), gpuMsPerFrame: med(r => r.gpuPerFrame), drawnPerS: med(r => r.drawnPerS), raw: v }];
  })),
  hot, alloc, errors: errors.slice(0, 5),
});
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(log, null, 1));
console.log(JSON.stringify({ hz: HZ, dpr: DPR, qs: log.qs, tier: log.tier, pr: log.pixelRatio, frames: log.frames, drawn: log.drawnFrames, renderedPerS: log.renderedPerS, mainBusyPct: log.mainBusyPct, cpuPerS: log.cpuPerS, gpu: { p50: log.gpu.msPerFrameP50, msPerS: log.gpu.msPerS, util: log.gpu.utilMeanPct }, draws: log.drawsPerFrame, tris: log.trisPerFrame, heap: [log.heapAtRideStartMB, log.heapAtEndMB], gpuMem: log.gpuMem, workerMsgs: log.workerMsgs, workerRepeatKeys: log.workerRepeatKeys, ab: log.ab && Object.fromEntries(Object.entries(log.ab).map(([k, v]) => [k, { ...v, raw: undefined }])), still: log.still ?? null, load: [log.loadAtMeasure[0], log.loadAtEnd[0]] }));
await browser.close();
