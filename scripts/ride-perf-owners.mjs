// Per-owner frame profile of the fixed ride (Anne Frank Huis -> Rijksmuseum), desktop first.
//   PORT=4465 node scripts/ride-perf-owners.mjs <label> "<query>" [chase|aerial] [seconds] [desktop|touch]
// e.g. "" / "?ownGround=1" / "?sharedFrame=1&cityLook=1", and `aerial` (camera held ~300 m up, rider stopped).
//
// Same route and seeded Math.random as ride-perf-fixed-route.mjs. On top of its frame and map
// timers it records, per rAF frame:
//   - exclusive ms by owner: every prototype method of the game, HUD, vector map and each render
//     component (three buildings, own ground, labels, shared frame, landmarks, trees, ...) is wrapped
//     with a stack timer, so nested owners are not double-counted; MapLibre's own `_render` time is
//     what is left after the custom layers and `render` listeners it calls;
//   - each MapLibre custom layer's render/prerender as `layer:<id>`;
//   - GL work: draw calls, triangles drawn, texture uploads (count, MB), buffer uploads (MB),
//     shader compiles and program links;
//   - frames over 33 ms with their top owners, GL work and the long-animation-frame entry (scripts,
//     style/layout) that covers them;
//   - GC and the hottest functions from a CDP CPU profile started before the warm-up (its ~1.7 s
//     start stall falls outside the measured window).
// BUNDLES_DIR=<dir> serves *.bundle.js from a local build (measure a source change before the integrator
// rebuilds bundles). NO_WRAP=1 keeps only the frame/map timers (overhead control).
// Appends to artifacts/perf-owners/ride.jsonl and writes artifacts/perf-owners/<label>.json.
import {chromium, devices} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [label = 'x', qs = '', view = 'chase', secs = '12', device = 'desktop'] = process.argv.slice(2);
const browser = await chromium.launch({headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: (process.env.CHROME_ARGS || '').split(' ').filter(Boolean)});
const page = await browser.newPage(device === 'touch' ? devices['iPhone 13'] : {viewport: {width: 1440, height: 900}});
fs.mkdirSync('artifacts/perf-owners', {recursive: true});
const errors = [];
page.on('pageerror', e => errors.push(`${e.message} @ ${(e.stack || '').split('\n').slice(1, 4).join(' | ')}`));
if (process.env.BUNDLES_DIR) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
  const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({path: file, contentType: 'application/javascript'}) : route.continue();
});
// OVERRIDES='js/road-network.js=artifacts/x.js,...': serve these canal-drive files from disk instead (A/B of plain scripts).
for (const pair of (process.env.OVERRIDES || '').split(',').filter(Boolean)) {
  const [rel, file] = pair.split('=');
  await page.route(url => new URL(url).pathname === `/canal-drive/${rel}`, route => route.fulfill({path: file, contentType: 'application/javascript'}));
}
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
await page.goto(`http://127.0.0.1:${process.env.PORT || 4465}/canal-drive/` + qs);
await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, {timeout: 60000});
await page.locator('#travel-mode').selectOption('car', {force: true}); await page.locator('#view-mode').selectOption('chase', {force: true});
await page.waitForFunction(() => canalRecallGame.routePois.some(p => p.id === 'anne-frank') && canalRecallGame.routePois.some(p => p.id === 'rijksmuseum'));
await page.locator('#poi-destination').selectOption('rijksmuseum');
await page.evaluate(() => { const g = canalRecallGame; g._pickDestinationNear = () => g.routePois.find(p => p.id === 'anne-frank'); });
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => canalRecallGame.player?.x && canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, {timeout: 180000});
if (view === 'aerial') {
  // Zoom the game camera out until MapLibre's camera stands ~300 m above the ground.
  const alt = await page.evaluate(async () => {
    const g = canalRecallGame, map = g.vectorMap.map, wait = () => new Promise(r => setTimeout(r, 400));
    let lo = g.camera.minZoom, hi = g.camera.zoom;
    for (let i = 0; i < 14; i++) {
      const z = (lo + hi) / 2; g.camera.zoom = z; g._zoomTouchedByPlayer = true; await wait();
      const a = map.transform.getCameraAltitude();
      if (a > 300) lo = z; else hi = z;
    }
    return {zoom: g.camera.zoom, altitude: map.transform.getCameraAltitude(), mapZoom: map.getZoom(), pitch: map.getPitch()};
  });
  console.error('aerial camera', JSON.stringify(alt));
}
await page.waitForFunction(() => { const t = canalRecallGame.vectorMap._threeBuildings; return !t || (t.ready && t.chunks.size && !t.pending.length && !t.inflight.size); }, null, {timeout: 180000});
await page.waitForFunction(() => { const g = canalRecallGame.vectorMap._ownGround; if (!g) return true; const s = g.status(); return s.ready && !s.queued && !Object.keys(s.pending).length && Object.values(s.cells).includes(0); }, null, {timeout: 180000});
const cdp = await page.context().newCDPSession(page);
const profiling = !process.env.NO_PROFILE;
if (profiling) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', {interval: 250}); await cdp.send('Profiler.start'); }
await page.waitForTimeout(6000);
const start = await page.evaluate(() => ({x: canalRecallGame.player.x, y: canalRecallGame.player.y}));
await cdp.send('Emulation.setCPUThrottlingRate', {rate: device === 'touch' ? 4 : 1});
const tStart = await page.evaluate((noWrap) => {
  const w = window, game = canalRecallGame, vm = game.vectorMap, map = vm.map;
  const P = w.__own = {frames: [], methods: {}, loaf: [], heap: []};
  let cur = {owners: {}, calls: {}, gl: {draws: 0, tris: 0, tex: 0, texMB: 0, bufMB: 0, compile: 0, link: 0}};
  const stack = [];
  // A method called more than HOT_CALLS times is a leaf helper (a lookup, a predicate): its wrapper
  // would cost more than it measures, so it is put back and its time stays with its caller.
  const HOT_CALLS = 20000;
  const timed = (key, owner, fn, self, restore) => function (...a) {
    const m0 = P.methods[key];
    if (restore && m0 && m0.n > HOT_CALLS && !m0.restored) { m0.restored = true; restore(); }
    const s = performance.now(); stack.push(0);
    try { return fn.apply(this === undefined ? self : this, a); } finally {
      const dur = performance.now() - s, child = stack.pop();
      if (stack.length) stack[stack.length - 1] += dur;
      const ex = dur - child;
      cur.owners[owner] = (cur.owners[owner] || 0) + ex;
      const m = P.methods[key] || (P.methods[key] = {owner, n: 0, ex: 0, inc: 0, max: 0});
      m.n++; m.ex += ex; m.inc += dur; if (dur > m.max) m.max = dur;
      cur.calls[key] = (cur.calls[key] || 0) + 1;
    }
  };
  const skip = new Set(['constructor']);
  const wrapAll = (obj, owner) => {
    if (!obj || obj.__ownWrapped) return; obj.__ownWrapped = true;
    for (let proto = Object.getPrototypeOf(obj); proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (skip.has(name) || Object.prototype.hasOwnProperty.call(obj, name)) continue;
        const d = Object.getOwnPropertyDescriptor(proto, name);
        if (!d || typeof d.value !== 'function') continue;
        obj[name] = timed(`${owner}.${name}`, owner, d.value, obj, () => { delete obj[name]; });
      }
    }
  };
  const wrapOne = (obj, name, owner, key = `${owner}.${name}`) => { if (obj && typeof obj[name] === 'function') obj[name] = timed(key, owner, obj[name], obj); };
  if (!noWrap) {
    wrapAll(game, 'game'); wrapAll(game.hud, 'hud'); wrapAll(game.camera, 'camera'); wrapAll(game.player, 'player'); wrapAll(game.track, 'track');
    const comps = {
      vectorMap: vm, labels: vm._labelOverlay, threeBuildings: vm._threeBuildings, ownGround: vm._ownGround, sharedFrame: vm._sharedFrame,
      highlight: vm._highlightMarker, landmarks: vm._signatureLandmarks, trees: vm._inventoryTrees, artis: vm._artisAnimals, roofs: vm._pyramidalRoofs,
      parks: vm._parkLandscape, detailed: vm._detailedBuildings, tileBuildings: vm._tileBuildings, completeCity: vm._completeCity, elevation: vm._elevation,
      bike: vm._playerBike, ferry: vm._playerFerry, boat: vm._playerBoat, transit: vm._playerTransit,
    };
    for (const [owner, obj] of Object.entries(comps)) wrapAll(obj, owner);
    // Every custom layer by id (the legacy per-feature layers, or the shared frame's two passes).
    for (const id of map.style._order) {
      const impl = map.style._layers[id]?.implementation; if (!impl) continue;
      for (const fn of ['render', 'prerender']) if (typeof impl[fn] === 'function') impl[fn] = timed(`layer:${id}.${fn}`, `layer:${id}`, impl[fn], impl);
    }
  }
  map._render = timed('maplibre._render', 'maplibre', map._render, map);
  // GL work, counted on the one context MapLibre and every three.js renderer share.
  const gl = map.painter.context.gl;
  const tri = (mode, count) => mode === 4 ? count / 3 : (mode === 5 || mode === 6) ? Math.max(0, count - 2) : 0;
  const hook = (fn, f) => { const o = gl[fn]?.bind(gl); if (o) gl[fn] = (...a) => { f(a); return o(...a); }; };
  hook('drawArrays', a => { cur.gl.draws++; cur.gl.tris += tri(a[0], a[2]); });
  hook('drawElements', a => { cur.gl.draws++; cur.gl.tris += tri(a[0], a[1]); });
  hook('drawArraysInstanced', a => { cur.gl.draws++; cur.gl.tris += tri(a[0], a[2]) * a[3]; });
  hook('drawElementsInstanced', a => { cur.gl.draws++; cur.gl.tris += tri(a[0], a[1]) * a[4]; });
  hook('drawRangeElements', a => { cur.gl.draws++; cur.gl.tris += tri(a[0], a[3]); });
  const texBytes = a => { const v = a.find(x => ArrayBuffer.isView(x)); if (v) return v.byteLength; const img = a.find(x => x && typeof x === 'object' && 'width' in x && 'height' in x); if (img) return img.width * img.height * 4;
    const nums = a.filter(x => typeof x === 'number'); return nums.length >= 5 ? nums[3] * nums[4] * 4 : 0; };
  for (const fn of ['texImage2D', 'texSubImage2D', 'texImage3D', 'texSubImage3D', 'compressedTexImage2D', 'compressedTexSubImage2D', 'compressedTexImage3D', 'compressedTexSubImage3D'])
    hook(fn, a => { cur.gl.tex++; cur.gl.texMB += texBytes(a) / 1048576; });
  for (const fn of ['bufferData', 'bufferSubData']) hook(fn, a => { const v = a[2]; cur.gl.bufMB += (ArrayBuffer.isView(v) || v instanceof ArrayBuffer ? v.byteLength : typeof v === 'number' && fn === 'bufferData' ? v : 0) / 1048576; });
  hook('compileShader', () => { cur.gl.compile++; });
  hook('linkProgram', () => { cur.gl.link++; });
  try { new PerformanceObserver(list => { for (const e of list.getEntries()) P.loaf.push({start: e.startTime, dur: e.duration, block: e.blockingDuration, render: e.renderStart ? e.startTime + e.duration - e.renderStart : 0, styleLayout: e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0,
    scripts: [...(e.scripts || [])].sort((a, b) => b.duration - a.duration).slice(0, 4).map(s => ({d: +s.duration.toFixed(1), inv: s.invoker, fn: s.sourceFunctionName, src: (s.sourceURL || '').split('/').pop(), pos: s.sourceCharPosition, fsl: +(s.forcedStyleAndLayoutDuration || 0).toFixed(1)}))}); }).observe({type: 'long-animation-frame'}); } catch (_) {}
  const og = () => vm._ownGround?.status?.(), tb = () => vm._threeBuildings;
  let last = performance.now();
  // Wall time at the callback, not the rAF frame-start stamp: work that ran earlier in this frame (other
  // rAF callbacks) then lands in this frame's bucket, and the interval that it lengthened is this one.
  const tick = () => {
    const now = performance.now();
    const tbs = tb();
    P.frames.push({t: now, dt: now - last, ab: w.__abMode ?? null, owners: cur.owners, calls: cur.calls, gl: cur.gl, chunks: tbs?.chunks?.size ?? 0, pending: tbs?.pending?.length ?? 0, redraws: vm._sharedFrame?.shadowRedraws ?? null});
    cur = {owners: {}, calls: {}, gl: {draws: 0, tris: 0, tex: 0, texMB: 0, bufMB: 0, compile: 0, link: 0}};
    last = now;
    if (P.frames.length % 60 === 0 && performance.memory) P.heap.push(+(performance.memory.usedJSHeapSize / 1048576).toFixed(1));
    if (!w.__stop) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return performance.now();
}, !!process.env.NO_WRAP);
// AB_ON='<js>' AB_OFF='<js>': in-page A/B, switching every AB_MS (default 500) ms through the window; every frame is
// tagged with the mode in force, and `ab` in the result has the frame times and owners per mode (same page, same
// machine state: drift between runs cancels). The frame right after a switch is left out.
if (process.env.AB_ON && process.env.AB_OFF) await page.evaluate(({on, off, ms}) => {
  const w = window; w.__abMode = 1; (0, eval)(on);
  w.__abTimer = setInterval(() => { w.__abMode = w.__abMode ? 0 : 1; (0, eval)(w.__abMode ? on : off); w.__abSwitchAt = performance.now(); }, ms);
}, {on: process.env.AB_ON, off: process.env.AB_OFF, ms: Number(process.env.AB_MS || 500)});
const wallStart = Date.now();
if (view !== 'aerial') await page.keyboard.down('ArrowUp');
// TRACE=1: a 4 s devtools timeline trace from the middle of the window (artifacts/perf-owners/<label>.trace.json).
if (process.env.TRACE) {
  await page.waitForTimeout(Number(secs) * 400);
  const events = [];
  cdp.on('Tracing.dataCollected', e => events.push(...e.value));
  const done = new Promise(r => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.start', {transferMode: 'ReportEvents', traceConfig: {includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'v8', 'blink', 'gpu', 'cc', 'viz', 'toplevel', 'disabled-by-default-v8.gc']}});
  await page.waitForTimeout(4000);
  await cdp.send('Tracing.end'); await done;
  fs.writeFileSync(`artifacts/perf-owners/${label}.trace.json`, JSON.stringify({traceEvents: events}));
  await page.waitForTimeout(Number(secs) * 200);
} else await page.waitForTimeout(Number(secs) * 1000);
if (view !== 'aerial') await page.keyboard.up('ArrowUp');
const raw = await page.evaluate(() => {
  window.__stop = true; const vm = canalRecallGame.vectorMap, og = vm._ownGround?.status?.(), tb = vm._threeBuildings?.stats?.();
  return {P: window.__own, end: {x: canalRecallGame.player.x, y: canalRecallGame.player.y}, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
    resident: {buildingVertices: tb?.vertices ?? null, buildingChunks: tb?.chunks ?? null, buildingGeometryMB: tb ? +tb.geometryMB.toFixed(1) : null, textureMB: tb ? +tb.textureMB.toFixed(1) : null, ownGroundTriangles: og?.triangles ?? null, ownGroundMB: og?.geometryMB ?? null},
    labels: vm._labelOverlay?.stats ?? null, now: performance.now()};
});
// EXTRA_EVAL='<js expression>': evaluated in the page after the window, printed (ad-hoc probes).
if (process.env.EXTRA_EVAL) console.log('extra', JSON.stringify(await page.evaluate(process.env.EXTRA_EVAL)));
let hot = [], gcMs = null, profileMs = null;
if (profiling) {
  const windowMs = Date.now() - wallStart;
  const {profile} = await cdp.send('Profiler.stop');
  // Only samples inside the measured window (the profiler's start stall is before it).
  const byId = new Map(profile.nodes.map(n => [n.id, n])), self = new Map();
  // Sample times, walked back from the last sample: the measured window is the last `windowMs`.
  const times = []; let t = profile.startTime;
  for (const d of profile.timeDeltas) { t += d; times.push(t); }
  const winStart = times[times.length - 1] - windowMs * 1000;
  let total = 0;
  profile.samples.forEach((id, i) => {
    if (times[i] < winStart) return;
    const d = (profile.timeDeltas[i + 1] ?? 0) / 1000; const f = byId.get(id).callFrame;
    const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop().replace(/\?.*/, '')}:${f.lineNumber}:${f.columnNumber}`;
    self.set(key, (self.get(key) || 0) + d); total += d;
  });
  if (process.env.SAVE_PROFILE) fs.writeFileSync(`artifacts/perf-owners/${label}.cpuprofile`, JSON.stringify(profile));
  hot = [...self].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([fn, ms]) => ({fn, selfMs: +ms.toFixed(1)}));
  gcMs = +([...self].filter(([k]) => k.startsWith('(garbage collector)')).reduce((s, [, v]) => s + v, 0)).toFixed(1);
  profileMs = +total.toFixed(0);
}
await cdp.send('Emulation.setCPUThrottlingRate', {rate: 1});

const pick = (v, q) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0; };
const sum = v => v.reduce((a, b) => a + b, 0);
const r2 = v => +v.toFixed(2);
const frames = raw.P.frames.slice(5);
const dts = frames.map(f => f.dt);
const ownerNames = [...new Set(frames.flatMap(f => Object.keys(f.owners)))];
const owners = Object.fromEntries(ownerNames.map(o => { const v = frames.map(f => f.owners[o] || 0); return [o, {meanMs: r2(sum(v) / frames.length), p95Ms: r2(pick(v, .95)), maxMs: r2(Math.max(...v))}]; })
  .sort((a, b) => b[1].meanMs - a[1].meanMs));
const methods = Object.entries(raw.P.methods).map(([k, m]) => ({k, n: m.n, exPerFrame: r2(m.ex / frames.length), incPerFrame: r2(m.inc / frames.length), maxMs: r2(m.max)}))
  .sort((a, b) => b.exPerFrame - a.exPerFrame).slice(0, 45);
const glOf = k => frames.map(f => f.gl[k]);
const long = frames.filter(f => f.dt > 33).map(f => {
  const top = Object.entries(f.owners).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([o, ms]) => `${o} ${ms.toFixed(1)}`);
  const calls = Object.entries(f.calls).filter(([k]) => /install|rebuild|plan|drop|onWorker|setFeatures|load|apply|compile|redraw/i.test(k)).map(([k, n]) => `${k}×${n}`);
  const loaf = raw.P.loaf.find(e => e.start <= f.t && e.start + e.dur >= f.t - f.dt);
  return {t: Math.round(f.t), dt: r2(f.dt), top, calls, gl: {draws: f.gl.draws, link: f.gl.link, compile: f.gl.compile, tex: f.gl.tex, texMB: r2(f.gl.texMB), bufMB: r2(f.gl.bufMB)},
    loaf: loaf ? {dur: Math.round(loaf.dur), styleLayout: Math.round(loaf.styleLayout), scripts: loaf.scripts} : null};
});
const ab = !(process.env.AB_ON && process.env.AB_OFF) ? null : Object.fromEntries([['on', 1], ['off', 0]].map(([name, mode]) => {
  const fs_ = frames.filter((f, i) => f.ab === mode && frames[i - 1]?.ab === mode);
  const names = [...new Set(fs_.flatMap(f => Object.keys(f.owners)))];
  const own = Object.fromEntries(names.map(o => [o, r2(sum(fs_.map(f => f.owners[o] || 0)) / fs_.length)]).sort((a, b) => b[1] - a[1]));
  const d = fs_.map(f => f.dt);
  return [name, {n: fs_.length, median: r2(pick(d, .5)), p95: r2(pick(d, .95)), ownedMsPerFrame: r2(sum(fs_.map(f => sum(Object.values(f.owners)))) / fs_.length),
    drawCallsMedian: pick(fs_.map(f => f.gl.draws), .5), owners: own}];
}));
const result = {label, view, device, qs, at: new Date().toISOString(), noWrap: !!process.env.NO_WRAP, ab,
  frames: {n: dts.length, median: r2(pick(dts, .5)), p95: r2(pick(dts, .95)), p99: r2(pick(dts, .99)), mean: r2(sum(dts) / dts.length), over33: dts.filter(d => d > 33).length, over50: dts.filter(d => d > 50).length, over100: dts.filter(d => d > 100).length},
  ownedMsPerFrame: r2(sum(frames.map(f => sum(Object.values(f.owners)))) / frames.length),
  ownedP99Ms: r2(pick(frames.map(f => sum(Object.values(f.owners))), .99)), ownedMaxMs: r2(Math.max(...frames.map(f => sum(Object.values(f.owners))))),
  owners, gl: {drawCallsMedian: pick(glOf('draws'), .5), drawCallsP95: pick(glOf('draws'), .95), trianglesMedian: Math.round(pick(glOf('tris'), .5)), trianglesP95: Math.round(pick(glOf('tris'), .95)),
    texUploads: sum(glOf('tex')), texMB: r2(sum(glOf('texMB'))), bufMB: r2(sum(glOf('bufMB'))), shaderCompiles: sum(glOf('compile')), programLinks: sum(glOf('link'))},
  resident: raw.resident, labels: raw.labels, heapMB: raw.heapMB, heapSeries: raw.P.heap, gcMs, profileMs, longFrames: long, methods, hot,
  start: {x: Math.round(start.x), y: Math.round(start.y)}, end: {x: Math.round(raw.end.x), y: Math.round(raw.end.y)}, errors: errors.slice(0, 5)};
console.log(JSON.stringify({label, frames: result.frames, ownedMsPerFrame: result.ownedMsPerFrame, gl: result.gl, gcMs, errors: errors.length}));
if (ab) console.log(JSON.stringify(Object.fromEntries(Object.entries(ab).map(([k, v]) => [k, {n: v.n, median: v.median, p95: v.p95, owned: v.ownedMsPerFrame, draws: v.drawCallsMedian, top: Object.fromEntries(Object.entries(v.owners).slice(0, 8))}]))));
fs.mkdirSync('artifacts/perf-owners', {recursive: true});
fs.appendFileSync('artifacts/perf-owners/ride.jsonl', JSON.stringify(result) + '\n');
fs.writeFileSync(`artifacts/perf-owners/${label}.json`, JSON.stringify(result, null, 1));
await browser.close();
