// Load stutter: the first 90 s of a seeded ride from a cold and a warm HTTP cache, with stall attribution.
//   PORT=4544 node scripts/motion-stutter.mjs <out.json> [--throttle 1,4] [--seconds 90] [--device desktop|iphone|ipad] [--runs cold,warm]
//   motion: --start <poi id> --dest <poi id> --warmup 30 --measure 60 (Jordaan: Noorderkerk -> Westermoskee)
// Route: Anne Frank Huis -> Rijksmuseum, car, chase, seeded Math.random (as ride-perf-fixed-route.mjs). The route is
// submitted as soon as the start card is ready and, once the intro overview ends, an autopilot steers along the
// planned route at cruise speed (the driving harness's lookahead steer). The clock starts at navigation.
// Per run: rAF frame intervals (histogram, p50/p95/p99, frames > 50/100 ms, longest, stalled seconds = summed length
// of frames over 50 ms), long-animation-frame entries with their script entry points, long tasks, and a V8 sampling
// profile started on a same-origin blank page before navigation (so the ~1.7 s Profiler.start stall is outside the
// window), aligned to performance.now() with a busy-loop marker, then aggregated over the stalled frames by self
// function, by category (gc, json, shader, upload, ...) and by owning app function.
// INIT_JS=<file> adds an init script; DUMP_JS=<expression> stores its value at the end of the run as `dump`.
// GL_COUNTERS=1 with --warmup: GL work after the warm-up (compiles, uploads > 1 MiB with owners, draws and triangles per
// frame and per participant), as `gl`. The P4 counters gate: --qs '?engine=own' --start lm-extract_landmarks_433737872
// --dest lm-extract_landmarks_1632187034 --via lm-extract_landmarks_1632187034 --warmup 10 --measure 40 (DPR=2 desktop, --device ipad).
// STALL_MS=16 attributes every frame over 16 ms (default 50). Desktop default is the user's 14-inch MacBook Pro: 1512x982 CSS px at DPR 2 (3024x1964 device px, 2026-11-01); DPR sets the device scale, VIEWPORT=1800x1100
// the desktop viewport, HEADED=1 runs a visible Chrome window (the real-GPU set-up of #129).
// BUNDLES_DIR=<dir> serves *.bundle.js from a local build; WORLD_DIR=<dir> serves staged world-v1 cells. PROFILE=0 skips the profiler. KEEP_PROFILE=1 writes the raw
// profile next to the output.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { heapSample, heapOwners, startHeapSampling } from './heap-sample.mjs';

const argv = process.argv.slice(2);
const out = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'artifacts/perf/load-stutter.json';
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const throttles = opt('throttle', '1,4').split(',').map(Number);
const seconds = Number(opt('seconds', '90'));
const device = opt('device', 'desktop');
const runKinds = opt('runs', 'cold,warm').split(',');
const qs = opt('qs', '');
// Motion mode (--warmup S --measure S): ride from --start to --dest, skip the warm-up after the ride starts,
// then measure the next S seconds only (the user's "herky-jerky while moving").
const warmup = opt('warmup', null) != null ? Number(opt('warmup')) : null;
const measure = Number(opt('measure', '60'));
const startPoi = opt('start', 'anne-frank'), destPoi = opt('dest', 'rijksmuseum');
// --via a,b,c: POI ids the rider is carried through on rails (road-graph legs, constant --speed px/s). Physics-free,
// so a wedge at a kerb or a question card cannot stop the measurement; the camera, streaming and rendering are the game's.
const via = opt('via', '') ? opt('via').split(',') : [];
const railSpeed = Number(opt('speed', '120'));
const port = process.env.PORT || 4544;
const origin = `http://127.0.0.1:${port}`;
const profiling = process.env.PROFILE !== '0';
// HEAP=0 skips the GC'd heap samples at ride start and end of ride (each forces a GC in the page and its workers).
const heapRows = process.env.HEAP !== '0';
// HEAP_OWNERS=1: sampling heap profiler from navigation; live bytes by allocating app frame at ride start (use unminified bundles).
const heapOwnerRows = process.env.HEAP_OWNERS === '1';
const stallMs = Number(process.env.STALL_MS || 50);
const glCounters = process.env.GL_COUNTERS === '1';
// Ride starts (lane E5, #218): --starts default,change,wrongturn,free,next,... rides the seeded default route, then each
// listed start in turn in the same page: `change` opens route setup mid-ride and starts the game's own next route,
// `free` starts Free Ride, `wrongturn` steers off the route until the game re-plans it, `next` arrives (the rider is set
// down on the finish) and rides on from the finish card. Per start: every frame over STALL_MS (default 50) in the first
// --start-window seconds (default 10) after the game enters RACING (for `wrongturn`, after the re-plan), attributed by
// frame phase (needs `--qs '...&framePhases=1'`), GL work, label rebuilds/placements, streaming events, LoAF scripts and
// the CPU profile of that frame. Pair with --runs warm and --seconds 0.
const starts = opt('starts', '') ? opt('starts').split(',') : null;
const startWindowS = Number(opt('start-window', '10'));

const pick = (v, q) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };
const r1 = v => +v.toFixed(1);

function frameStats(intervals) {
  const over = ms => intervals.filter(f => f > ms);
  const hist = { '<=17': 0, '17-33': 0, '33-50': 0, '50-100': 0, '100-250': 0, '250-500': 0, '>500': 0 };
  for (const f of intervals) {
    if (f <= 17.5) hist['<=17']++; else if (f <= 34) hist['17-33']++; else if (f <= 50) hist['33-50']++;
    else if (f <= 100) hist['50-100']++; else if (f <= 250) hist['100-250']++; else if (f <= 500) hist['250-500']++; else hist['>500']++;
  }
  return {
    n: intervals.length, p50: r1(pick(intervals, 0.5)), p95: r1(pick(intervals, 0.95)), p99: r1(pick(intervals, 0.99)),
    over50: over(50).length, over100: over(100).length, longestMs: r1(Math.max(0, ...intervals)),
    stalledS: +(over(50).reduce((a, b) => a + b, 0) / 1000).toFixed(2), hist,
  };
}

const CATS = [
  ['gc', f => f.fn === '(garbage collector)'],
  ['shader compile/link', f => /^(compileShader|linkProgram|getProgramParameter|getShaderParameter|getProgramInfoLog|getShaderInfoLog|getUniformLocation|getAttribLocation|getActiveUniform|getActiveAttrib|useProgram)$/.test(f.fn)],
  ['gpu upload', f => /^(texImage2D|texSubImage2D|texImage3D|texSubImage3D|texStorage2D|texStorage3D|bufferData|bufferSubData|compressedTex\w*|generateMipmap)$/.test(f.fn)],
  ['gl draw/state', f => !f.url && /^(draw\w*|clear|bindBuffer|bindTexture|bindVertexArray|uniform\w*|vertexAttrib\w*|enable|disable|blendFunc\w*|depthFunc|readPixels|getError|getParameter|getExtension|framebufferTexture2D|bindFramebuffer|viewport|scissor|colorMask|depthMask|stencil\w*)$/.test(f.fn)],
  ['json parse', f => !f.url && /^(parse|json)$/.test(f.fn)],
  ['image decode', f => /createImageBitmap|decode/.test(f.fn) && !f.url],
  ['(program) native', f => f.fn === '(program)'],
  ['idle', f => f.fn === '(idle)'],
];
const LIB = /^(three\.bundle\.js|maplibre-gl\.js|maplibre-gl-csp\.js)$/;

function attribute(profile, windows, offsetMs) {
  // windows: [{start, end}] in performance.now() ms; offsetMs maps profile ms -> page ms.
  const nodes = new Map(profile.nodes.map(n => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const info = id => { const n = nodes.get(id); const f = n.callFrame; return { fn: f.functionName || '(anon)', url: f.url ? f.url.split('/').pop().split('?')[0] : '', line: f.lineNumber }; };
  const ownerCache = new Map();
  const owner = id => {
    if (ownerCache.has(id)) return ownerCache.get(id);
    let cur = id, found = null; const chain = [];
    while (cur != null) {
      const f = info(cur);
      if (f.url && !LIB.test(f.url)) { found = `${f.fn} ${f.url}:${f.line}`; break; }
      chain.push(cur); cur = parent.get(cur);
    }
    const res = found || (info(id).url ? `${info(id).fn} ${info(id).url}` : info(id).fn);
    ownerCache.set(id, res); return res;
  };
  // The first three app (non-library) frames, innermost first: who asked for the work.
  const stackCache = new Map();
  const appStack = id => {
    if (stackCache.has(id)) return stackCache.get(id);
    const parts = []; let cur = id;
    while (cur != null && parts.length < 3) { const f = info(cur); if (f.url && !LIB.test(f.url)) parts.push(`${f.fn} ${f.url}:${f.line}`); cur = parent.get(cur); }
    const res = parts.join(' < ') || info(id).fn; stackCache.set(id, res); return res;
  };
  const ws = [...windows].sort((a, b) => a.start - b.start);
  const self = new Map(), cats = new Map(), owners = new Map(), stacks = new Map();
  let t = profile.startTime / 1000 + offsetMs, wi = 0, total = 0;
  const add = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
  for (let i = 0; i < profile.samples.length; i++) {
    const dt = (profile.timeDeltas[i + 1] ?? 0) / 1000; // sample i lasts until the next sample
    t += (profile.timeDeltas[i] ?? 0) / 1000;
    while (wi < ws.length && ws[wi].end < t) wi++;
    if (wi >= ws.length) break;
    if (t < ws[wi].start) continue;
    const id = profile.samples[i], f = info(id);
    total += dt;
    add(self, `${f.fn}${f.url ? ` ${f.url}:${f.line}` : ''}`, dt);
    const cat = CATS.find(([, test]) => test(f))?.[0] || (f.url ? (LIB.test(f.url) ? `lib ${f.url}` : `js ${f.url}`) : 'other native');
    add(cats, cat, dt);
    add(owners, owner(id), dt);
    add(stacks, appStack(id), dt);
  }
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ k, ms: Math.round(v) }));
  return { sampledMs: Math.round(total), categories: top(cats, 25), owners: top(owners, 30), stacks: top(stacks, 30), self: top(self, 30) };
}

async function run(browser, kind, throttle, context) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // WORLD_DIR=<dir> serves staged world-v1 cells at /data/extracts/amsterdam/world-v1/ (for `--qs '?world=v1'`; nothing is
  // published). On the context, so the cell fetches of a worker are routed too.
  if (process.env.WORLD_DIR) await context.route(/\/data\/extracts\/amsterdam\/world-v1\/([^?]+)/, route => {
    const dir = path.resolve(process.env.WORLD_DIR), file = path.join(dir, /world-v1\/([^?]+)/.exec(route.request().url())[1]);
    return file.startsWith(dir) && fs.existsSync(file) ? route.fulfill({ path: file, contentType: file.endsWith('.json') ? 'application/json' : 'application/octet-stream' }) : route.fulfill({ status: 404, body: '' });
  });
  if (process.env.BUNDLES_DIR) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
    return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  // INIT_JS=<file>: an extra init script (e.g. the landmark request log / gate check, #129); DUMP_JS=<expression>: its
  // value at the end of the run is the result's `dump`.
  if (process.env.INIT_JS) await page.addInitScript({ path: process.env.INIT_JS });
  // GL_COUNTERS=1 (P4 counters gate, #129): engine/glCounters.ts on (?engine=own), its window starts at motionStart
  // (the end of --warmup), and the report lands in the result as `gl`.
  if (glCounters) await page.addInitScript(() => { window.__canalRecallGlCounters = true; });
  await page.addInitScript(ms => { window.__lsStallMs = ms; }, stallMs);
  await page.addInitScript(() => {
    let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
    if (!/^\/canal-drive\/?(index\.html)?$/.test(location.pathname)) return;
    const L = window.__ls = { frames: [], loaf: [], longtask: [], marks: {} };
    try {
      new PerformanceObserver(list => { for (const e of list.getEntries()) L.loaf.push({ start: e.startTime, dur: e.duration, blocking: e.blockingDuration, renderStart: e.renderStart, styleStart: e.styleAndLayoutStart, scripts: (e.scripts || []).map(x => ({ inv: x.invoker, type: x.invokerType, src: (x.sourceURL || '').split('/').pop(), fn: x.sourceFunctionName, start: x.startTime, dur: x.duration, forced: x.forcedStyleAndLayoutDuration })) }); }).observe({ type: 'long-animation-frame', buffered: true });
    } catch (_) {}
    try { new PerformanceObserver(list => { for (const e of list.getEntries()) L.longtask.push({ start: e.startTime, dur: e.duration }); }).observe({ type: 'longtask', buffered: true }); } catch (_) {}
    // Ride starts (--starts, lane E5 #218): game state and route changes with their time, and every frame-host frame
    // over the stall threshold with its framePhases (`?framePhases=1`) and the GL work it did (programs, textures,
    // geometries added, draw calls), so a stall is named by what that frame did, not by the session's worst list.
    L.states = []; L.paths = []; L.host = [];
    const stallMs = window.__lsStallMs || 50;
    let lastState, lastPath;
    const watch = now => {
      const g = window.canalRecallGame;
      if (g) {
        if (g.state !== lastState) { lastState = g.state; L.states.push([now, g.state]); }
        if (g.routePath !== lastPath) { lastPath = g.routePath; L.paths.push([now, g.routePath ? g.routePath.length : 0]); }
      }
      const rec = window.__canalRecallFramePhaseRecorder;
      if (rec && !rec.__lsWrapped) {
        rec.__lsWrapped = true;
        const end = rec.end.bind(rec);
        let gl0 = null;
        rec.end = ms => {
          const info = window.canalRecallGame?.vectorMap?.host?.renderer?.info;
          const gl = info ? { prog: info.programs?.length ?? 0, tex: info.memory?.textures ?? 0, geo: info.memory?.geometries ?? 0, calls: info.render?.calls ?? 0 } : null;
          if (ms > Math.min(8, stallMs)) { // every host frame worth naming, so a stall's frame-host share shows
            const d = gl && gl0 ? { prog: gl.prog - gl0.prog, tex: gl.tex - gl0.tex, geo: gl.geo - gl0.geo, calls: gl.calls } : null;
            // Programs linked in this frame, by three's name (the material type or the ShaderMaterial's name).
            if (d && d.prog > 0) d.programs = (info.programs || []).slice(-d.prog).map(q => q.name || q.cacheKey?.slice(0, 40) || '?');
            L.host.push({ at: performance.now(), ms, phases: { ...rec.current }, gl: d });
          }
          gl0 = gl;
          return end(ms);
        };
      }
    };
    const tick = now => { L.frames.push(now); try { watch(now); } catch (_) {} if (!L.stop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.goto(`${origin}/canal-drive/js/build-stamp.js`).catch(() => {});
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  if (profiling) {
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start');
    await page.waitForTimeout(2500); // the Profiler.start stall lands here, before navigation
  }
  if (heapOwnerRows) await startHeapSampling(cdp);
  // WATCHDOG=<s>: when the page stops answering for that long, pause it through the debugger and print where its
  // main thread is (a JS loop that never yields), with the last 2 s of console, then end the run.
  const consoleLog = [];
  page.on('console', m => { consoleLog.push({ t: Date.now(), text: `${m.type()} ${m.text().slice(0, 300)}` }); if (consoleLog.length > 400) consoleLog.shift(); });
  let watchdog = null;
  if (process.env.WATCHDOG) {
    const limitMs = Number(process.env.WATCHDOG) * 1000;
    await cdp.send('Debugger.enable');
    let busy = false;
    watchdog = setInterval(async () => {
      if (busy) return; busy = true;
      const alive = await Promise.race([page.evaluate(() => 1).then(() => true, () => true), new Promise(r => setTimeout(() => r(false), limitMs))]);
      if (!alive) {
        clearInterval(watchdog);
        const paused = new Promise(r => cdp.once('Debugger.paused', r));
        await cdp.send('Debugger.pause').catch(e => console.error('pause failed', e.message));
        const ev = await Promise.race([paused, new Promise(r => setTimeout(() => r(null), 10_000))]);
        const frames = ev ? ev.callFrames.map(f => `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.location.lineNumber + 1}:${f.location.columnNumber + 1}`) : ['(no pause event)'];
        const now = Date.now();
        console.error(JSON.stringify({ watchdog: `page did not answer for ${limitMs / 1000} s`, frames, console: consoleLog.filter(c => now - c.t < limitMs + 2000).map(c => c.text) }, null, 1));
        if (process.env.WATCHDOG_OUT) fs.writeFileSync(process.env.WATCHDOG_OUT, JSON.stringify({ frames, callFrames: ev?.callFrames?.map(f => ({ fn: f.functionName, url: f.url, line: f.location.lineNumber, col: f.location.columnNumber, scopes: f.scopeChain.map(s => s.type) })) }, null, 1));
        process.exit(3);
      }
      busy = false;
    }, 2000);
  }
  const navAt = Date.now();
  await page.goto(`${origin}/canal-drive/${qs}`);
  const sync = async label => page.evaluate(label => {
    const s = performance.now(); const fn = window.__lsSync || (window.__lsSync = function __lsSync() { const t = performance.now(); let x = 0; while (performance.now() - t < 25) x += Math.sqrt(x + 1); return x; });
    fn(); window.__ls.marks[label] = s; return s;
  }, label);
  const sync0 = profiling ? await sync('sync0') : null;
  const mark = label => page.evaluate(label => { window.__ls.marks[label] = performance.now(); }, label);
  let deadline = navAt + (starts ? 1_800_000 : warmup != null ? 180_000 : seconds * 1000);
  const left = () => Math.max(1000, deadline - Date.now());
  let reached = 'nav', heapAtStart = null, startPlan = null;
  try {
    await page.waitForFunction(([a, b]) => window.canalRecallGame?.routePois?.some(p => p.id === a) && window.canalRecallGame.routePois.some(p => p.id === b), [startPoi, destPoi], { timeout: left() });
    await mark('menuReady'); reached = 'menu';
    await page.locator('#travel-mode').selectOption('car', { force: true });
    await page.locator('#view-mode').selectOption('chase', { force: true });
    const hasOption = await page.evaluate(b => [...document.querySelectorAll('#poi-destination option')].some(o => o.value === b), destPoi);
    if (hasOption) await page.locator('#poi-destination').selectOption(destPoi);
    else errors.push(`destination ${destPoi} not in the picker`);
    await page.evaluate(([a, b]) => {
      const g = canalRecallGame; g._pickDestinationNear = () => g.routePois.find(p => p.id === a);
      if (document.querySelector('#poi-destination')?.value === b) return;
      try { g._overlay.store.setState({ destinationId: b }); } catch (_) {}
      const sel = document.querySelector('#poi-destination');
      if (sel && ![...sel.options].some(o => o.value === b)) { const o = document.createElement('option'); o.value = b; o.textContent = b; sel.appendChild(o); }
      if (sel) sel.value = b;
    }, [startPoi, destPoi]);
    await page.locator('#route-card').evaluate(f => f.requestSubmit());
    await mark('submitted'); reached = 'submitted';
    await page.waitForFunction(() => canalRecallGame.player?.x, null, { timeout: left() });
    await mark('player'); reached = 'player';
    await page.waitForFunction(() => canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, { timeout: left() });
    await mark('racing'); reached = 'racing';
    // Ride-start heap (L4 gate, issue #136): once the first four building tiles are resident, before the rail moves the rider.
    if (heapRows) {
      await page.waitForFunction(() => [...(canalRecallGame.vectorMap?._completeCity?.tileTimes?.values() ?? [])].filter(t => t.resident != null).length >= 4, null, { timeout: left() }).catch(() => {});
      heapAtStart = { atS: +(((await page.evaluate(() => performance.now())) / 1000).toFixed(2)), ...(await heapSample(cdp)) };
      if (heapOwnerRows) heapAtStart.owners = await heapOwners(cdp);
    }
    await page.evaluate(([viaIds, speed]) => { window.__via = viaIds; window.__railSpeed = speed; }, [via, railSpeed]);
    await page.evaluate(() => {
      const g = canalRecallGame, p = g.player, L = window.__ls, vm = g.vectorMap, map = vm.map ?? vm.host; // ?engine=own: the frame host's _render
      // Questions still appear (their cards and layout are part of play) but do not hold the rider for an answer.
      g._quizFreezesRide = () => false;
      // Cadence: each MapLibre render with the rider pose it drew, each game-loop tick, and timed streaming events.
      L.renders = []; L.ticks = []; L.events = [];
      const render = map._render.bind(map);
      map._render = (...a) => { L.renders.push([performance.now(), p.x, p.y, p.speed]); return render(...a); };
      const loop = g._loop.bind(g);
      g._loop = (t) => { L.ticks.push(performance.now()); return loop(t); };
      // ?engine=own: the frame host calls the game's `_frame` (through an arrow that looks it up each frame).
      if (vm.engine === 'own' && typeof g._frame === 'function') { const frame = g._frame.bind(g); g._frame = (dt) => { L.ticks.push(performance.now()); return frame(dt); }; }
      const ev = (obj, key, label) => {
        if (!obj || typeof obj[key] !== 'function') return;
        const o = obj[key].bind(obj);
        obj[key] = (...a) => { const s = performance.now(); try { return o(...a); } finally { const d = performance.now() - s; if (d > 1) L.events.push([s, label, d]); } };
      };
      ev(vm._completeCity, 'flush', 'tileFlush');
      ev(vm._threeBuildings, 'install', 'chunkInstall');
      ev(vm._threeBuildings, 'setFeatures', 'setFeatures');
      ev(vm._threeBuildings, 'refreshGroundBases', 'groundBases');
      ev(vm._ownGround, 'install', 'groundInstall');
      ev(vm._ownGround, 'installFar', 'farInstall');
      ev(vm._ownGround, 'rebuildOverlays', 'groundOverlays');
      ev(vm._ownGround?.store, 'placeDecks', 'groundDecks');
      ev(vm._ownGround?.store?.field, 'addTile', 'groundRelief');
      ev(vm._signatureLandmarks, '_requestModels', 'landmarkRequest');
      ev(vm._inventoryTrees, 'rebuild', 'treesRebuild');
      ev(vm._labelOverlay, 'frame', 'labels');
      // ?engine=own: the label canvas (engine/overlays/labelLayer.ts). A rebuild logs the candidates it bucketed; a draw
      // logs whether it was a full placement and how many labels it placed.
      const labels = vm._labels;
      if (labels && typeof labels.rebuild === 'function') {
        L.labelLog = [];
        const rebuild = labels.rebuild.bind(labels), draw = labels.draw.bind(labels);
        labels.rebuild = (...a) => {
          const s = performance.now(); const r = rebuild(...a);
          const seen = new Set(); for (const list of labels.buckets.values()) for (const c of list) seen.add(c.c ?? c);
          L.labelLog.push([s, 'rebuild', performance.now() - s, seen.size]); return r;
        };
        labels.draw = (...a) => {
          const s = performance.now(), full0 = labels.stats.full; const r = draw(...a); const d = performance.now() - s;
          if (d > 2) L.labelLog.push([s, labels.stats.full > full0 ? 'draw full' : 'draw', d, labels.placed.length]); return r;
        };
      }
      let route = null, index = 1, finish = null;
      p.handleInput = () => {
        // --starts: a new route (new finish) re-plans the autopilot; `__apWrong` (until that time) steers off the route.
        if (g.track.finishPoint !== finish) { finish = g.track.finishPoint; route = null; }
        if (window.__apWrong && performance.now() < window.__apWrong) {
          const turning = performance.now() > window.__apWrong - 5000 && performance.now() < window.__apWrong - 3500;
          p.steerInput = turning ? 1 : 0; p.throttle = p.speed < 120 ? 1 : 0; p.brake = 0; p.handbrake = false; route = null; return;
        }
        if (!route || route.length < 2) { try { route = g.track.findRoute({ x: p.x, y: p.y }, g.track.finishPoint); } catch (_) { route = null; } index = 1; if (!route || route.length < 2) { p.throttle = 1; return; } }
        let best = Infinity;
        for (let i = Math.max(0, index - 4); i < Math.min(route.length, index + 24); i++) { const d = Math.hypot(route[i].x - p.x, route[i].y - p.y); if (d < best) { best = d; index = i; } }
        let look = 0, ti = index;
        while (ti < route.length - 1 && look < 120) { look += Math.hypot(route[ti + 1].x - route[ti].x, route[ti + 1].y - route[ti].y); ti++; }
        const tg = route[ti]; let err = Math.atan2(tg.y - p.y, tg.x - p.x) - p.angle; err = Math.atan2(Math.sin(err), Math.cos(err));
        const cruise = Math.abs(err) > 0.5 ? 60 : 170;
        p.steerInput = Math.max(-1, Math.min(1, err * 2.5)); p.throttle = p.speed < cruise ? 1 : 0; p.brake = p.speed > cruise * 1.6 ? 1 : 0; p.handbrake = false;
        if (Math.hypot(g.track.finishPoint.x - p.x, g.track.finishPoint.y - p.y) < 80) p.throttle = 0;
      };
      if (window.__via && window.__via.length) {
        const l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER');
        const world = (lat, lng) => ({ x: l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y: l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm });
        const stops = [{ x: p.x, y: p.y }, ...window.__via.map(id => g.routePois.find(q => q.id === id)).filter(Boolean).map(q => world(q.lat, q.lng))];
        const path = [];
        for (let k = 1; k < stops.length; k++) { let leg = null; try { leg = g.track.findRoute(stops[k - 1], stops[k]); } catch (_) {} if (leg && leg.length > 1) path.push(...(path.length ? leg.slice(1) : leg)); }
        const cum = [0]; for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + Math.hypot(path[k].x - path[k - 1].x, path[k].y - path[k - 1].y));
        L.railPx = Math.round(cum[cum.length - 1] || 0);
        let sAt = 0, seg = 1; const v = window.__railSpeed;
        if (path.length > 1) p.update = function (dt) {
          sAt = Math.min(cum[cum.length - 1], sAt + v * dt);
          while (seg < path.length - 1 && cum[seg] < sAt) seg++;
          const a = path[seg - 1], b = path[seg], f = (sAt - cum[seg - 1]) / Math.max(1e-6, cum[seg] - cum[seg - 1]);
          const ang = Math.atan2(b.y - a.y, b.x - a.x);
          this.x = a.x + (b.x - a.x) * f; this.y = a.y + (b.y - a.y) * f;
          // Ease the heading so corners turn like a rider would, not in one frame.
          let d = ang - this.angle; d = Math.atan2(Math.sin(d), Math.cos(d)); this.angle += d * Math.min(1, dt * 6);
          this.speed = sAt < cum[cum.length - 1] ? v : 0; this.vx = Math.cos(this.angle) * this.speed; this.vy = Math.sin(this.angle) * this.speed;
          this.distancePx = (this.distancePx || 0) + this.speed * dt;
        };
      }
    });
    if (warmup != null) {
      await page.waitForTimeout(warmup * 1000);
      await mark('motionStart');
      if (glCounters) await page.evaluate(() => window.__canalPerf?.gl?.markWarm());
      await page.waitForTimeout(measure * 1000);
      await mark('motionEnd');
      deadline = Date.now();
    }
    if (starts) {
      // The first start is the seeded default route the flow above just rode into.
      if (starts[0] !== 'default') errors.push('--starts must begin with default');
      const until = (fn, arg, ms = 240_000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 });
      const now = () => page.evaluate(() => performance.now());
      const plan = [{ kind: 'default', trigger: await page.evaluate(() => window.__ls.marks.submitted) }];
      await page.waitForTimeout((startWindowS + 4) * 1000);
      for (const kind of starts.slice(1)) {
        const entry = { kind, trigger: await now() };
        try {
          if (kind === 'change' || kind === 'free') {
            await page.evaluate(free => {
              const g = canalRecallGame;
              delete g._pickDestinationNear; // the game's own start pick (seeded Math.random)
              g._openRouteSetup();
              g._overlay.store.patchPrefs({ routePattern: free ? 'free' : 'surprise' }, g._overlayZoom());
            }, kind === 'free');
            await page.waitForTimeout(1500);
            entry.trigger = await now();
            await page.locator('#route-card').evaluate(f => f.requestSubmit());
            await until(t => canalRecallGame.state === 4 && window.__ls.states.some(([at, st]) => at > t && st === 4), entry.trigger);
          } else if (kind === 'next') {
            await page.evaluate(() => { const g = canalRecallGame, f = g.track.finishPoint; g.player.x = f.x; g.player.y = f.y; g.player.speed = 0; });
            await until(() => canalRecallGame.state === 5, null, 30_000);
            await page.waitForTimeout(1500);
            entry.trigger = await now();
            await page.evaluate(() => canalRecallGame._runFinishAction('again'));
            await until(t => canalRecallGame.state === 4 && window.__ls.states.some(([at, st]) => at > t && st === 4), entry.trigger);
          } else if (kind === 'wrongturn') {
            // The game re-plans only with the route line on (medium difficulty has it off): a wrong turn with the line off
            // changes nothing. The line is turned on for this start, as a player who rides with it.
            await page.evaluate(() => { const g = canalRecallGame; if (!g.routeOptions.line) { g.routeOptions.line = true; g.vectorMap.setRoute(g.routePath, g.osmLoader, true); } });
            await page.waitForTimeout(1000);
            entry.trigger = await now();
            await page.evaluate(() => { window.__apWrong = performance.now() + 9000; });
            await until(t => window.__ls.paths.some(([at]) => at > t), entry.trigger, 20_000).catch(() => { entry.noReplan = true; });
          } else errors.push(`unknown start ${kind}`);
        } catch (e) { entry.error = e.message.split('\n')[0]; }
        plan.push(entry);
        await page.waitForTimeout((startWindowS + 4) * 1000);
        if (kind === 'wrongturn') await page.evaluate(() => { const g = canalRecallGame; g.routeOptions.line = false; g.vectorMap.setRoute(g.routePath, g.osmLoader, false); });
      }
      startPlan = plan;
      deadline = Date.now();
    }
    errors.push(`route ${await page.evaluate(() => { const g = canalRecallGame, f = g.track.finishPoint; return `finish dist ${Math.round(Math.hypot(f.x - g.player.x, f.y - g.player.y))}px dest ${document.querySelector('#poi-destination')?.value}`; })}`);
  } catch (e) {
    errors.push(`flow stopped after ${reached}: ${e.message.split('\n')[0]}`);
    // --starts sets a 30-minute deadline for the whole plan: a flow that stopped early ends the run now (lane E6).
    if (starts) { deadline = Date.now(); console.error(`run ${kind}: flow stopped after ${reached}: ${e.message.split('\n')[0]}`); }
  }
  await page.waitForTimeout(Math.max(0, deadline - Date.now()));
  const sync1 = profiling ? await sync('sync1') : null;
  const gl = glCounters ? await page.evaluate(() => {
    const perf = window.__canalPerf, vm = window.canalRecallGame?.vectorMap;
    return perf?.gl ? { ...perf.gl.report(), tier: perf.tier ?? null, pitch: vm?.camera?.pitch?.() ?? null, pixelRatio: vm?.host?.getPixelRatio?.() ?? null, programCount: vm?.host?.renderer?.info?.programs?.length ?? null } : null;
  }).catch(e => ({ error: String(e) })) : undefined;
  const dump = process.env.DUMP_JS ? await page.evaluate(expr => (0, eval)(expr), process.env.DUMP_JS).catch(e => ({ error: String(e) })) : undefined;
  const raw = await page.evaluate(() => {
    const L = window.__ls; L.stop = true; const g = window.canalRecallGame, vm = g?.vectorMap;
    const og = vm?._ownGround?.status?.(); const mem = performance.memory;
    return { ...L, heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null, distancePx: g?.player?.distancePx ?? null, state: g?.state,
      ownGround: og ? { cells: og.cells && Object.keys(og.cells).length, built: og.built, buildMsMedian: og.buildMsMedian, installMsMedian: og.installMsMedian, reliefTiles: og.reliefTiles, errors: (vm._ownGround.stats?.errors ?? []).slice(0, 3) } : null,
      lift: vm?._threeBuildings?.groundLiftStats?.() ?? null,
      // `?world=v1`: where cells decoded, the main-thread decode tasks (main) or reply messages (worker), ms.
      world: (w => w ? { thread: w.decodeThread, cells: w.decodeMs.size, decodeMsMax: Math.round(Math.max(0, ...w.decodeMs.values()) * 10) / 10, inflateMsMax: Math.round(Math.max(0, ...w.inflateMs.values())), messages: w.messages ?? null, longestMessageMs: w.longestMessageMs != null ? Math.round(w.longestMessageMs * 10) / 10 : null } : null)(vm?._completeCity?.world) };
  });
  const heapAtEnd = heapRows ? await heapSample(cdp).catch(e => ({ error: e.message })) : null;
  let profile = null;
  if (profiling) ({ profile } = await cdp.send('Profiler.stop'));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.close();

  const end = raw.marks.sync1 ?? (starts ? Infinity : seconds * 1000);
  const ts = raw.frames.filter(t => t <= end);
  const intervals = []; const iv = [];
  for (let i = 1; i < ts.length; i++) {
    // skip the busy-loop markers
    const inSync = ['sync0', 'sync1'].some(k => raw.marks[k] != null && ts[i] >= raw.marks[k] && ts[i - 1] <= raw.marks[k] + 30);
    if (inSync) continue;
    intervals.push(ts[i] - ts[i - 1]); iv.push({ at: ts[i - 1], ms: ts[i] - ts[i - 1] });
  }
  const phase = (a, b) => frameStats(iv.filter(f => f.at >= (raw.marks[a] ?? Infinity) && f.at < (b ? (raw.marks[b] ?? end) : end)).map(f => f.ms));
  const inMotion = f => warmup == null || (f.at >= raw.marks.motionStart && f.at < raw.marks.motionEnd);
  const stallWindows = iv.filter(f => f.ms > stallMs && inMotion(f)).map(f => ({ start: f.at, end: f.at + f.ms }));
  let motion = null;
  if (warmup != null && raw.marks.motionStart != null) {
    const a = raw.marks.motionStart, b = raw.marks.motionEnd ?? end, mins = (b - a) / 60000;
    const fr = iv.filter(inMotion);
    const st = frameStats(fr.map(f => f.ms));
    // Cadence: renders and game ticks per display frame; rider step per render against speed.
    const renders = (raw.renders || []).filter(r => r[0] >= a && r[0] < b), ticks = (raw.ticks || []).filter(t => t >= a && t < b);
    const steps = []; for (let i = 1; i < renders.length; i++) steps.push(Math.hypot(renders[i][1] - renders[i - 1][1], renders[i][2] - renders[i - 1][2]));
    const moving = renders.filter(r => r[3] > 20).length;
    const stillAtSpeed = renders.filter((r, i) => i > 0 && r[3] > 20 && steps[i - 1] === 0).length;
    // Bursts: share of hitches with a streaming event (>1 ms) overlapping the hitch frame, by event kind.
    const events = (raw.events || []).filter(e => e[0] >= a - 200 && e[0] < b);
    const hitches = fr.filter(f => f.ms > 50);
    const byKind = {}; let aligned = 0;
    for (const h of hitches) {
      const hit = events.filter(e => e[0] < h.at + h.ms && e[0] + e[2] > h.at - 17);
      if (hit.length) aligned++;
      for (const e of hit) { const k = byKind[e[1]] ||= { hitches: 0, ms: 0 }; k.hitches++; k.ms += e[2]; }
    }
    for (const k of Object.values(byKind)) k.ms = Math.round(k.ms);
    const evTotals = {}; for (const e of events) { const k = evTotals[e[1]] ||= { n: 0, ms: 0, maxMs: 0 }; k.n++; k.ms += e[2]; k.maxMs = Math.max(k.maxMs, e[2]); }
    for (const k of Object.values(evTotals)) { k.ms = Math.round(k.ms); k.maxMs = r1(k.maxMs); }
    const gaps = []; for (let i = 1; i < hitches.length; i++) gaps.push(r1((hitches[i].at - hitches[i - 1].at) / 1000));
    motion = { seconds: +((b - a) / 1000).toFixed(1), frames: st, hitchesPerMin: { over50: +(st.over50 / mins).toFixed(1), over100: +(st.over100 / mins).toFixed(1) },
      cadence: { rafFrames: fr.length, renders: renders.length, gameTicks: ticks.length, renderPerFrame: +(renders.length / Math.max(1, fr.length)).toFixed(3), movingRenders: moving, renderedWithoutRiderStep: stillAtSpeed,
        stepPx: { p50: r1(pick(steps, 0.5)), p95: r1(pick(steps, 0.95)), max: r1(Math.max(0, ...steps)) } },
      track: renders.filter((r, i) => i % 120 === 0).map(r => [Math.round(r[1]), Math.round(r[2]), Math.round(r[3])]),
      bursts: { hitches: hitches.length, alignedWithStreaming: aligned, byKind, gapsS: gaps }, events: evTotals,
      longTasks: (() => { const lt = raw.longtask.filter(l => l.start >= a && l.start < b); return { n: lt.length, totalMs: Math.round(lt.reduce((x, l) => x + l.dur, 0)), over100: lt.filter(l => l.dur > 100).length, longestMs: Math.round(Math.max(0, ...lt.map(l => l.dur))) }; })() };
  }
  // Ride starts: each start's window, its stalled frames and what they did.
  let rideStarts = null;
  const startWindows = [];
  if (startPlan) {
    rideStarts = startPlan.map((st, i) => {
      const next = startPlan[i + 1]?.trigger ?? end;
      const racing = st.kind === 'wrongturn' ? (raw.paths.find(([at]) => at > st.trigger && at < next)?.[0] ?? st.trigger)
        : (raw.states.find(([at, s]) => at > st.trigger && s === 4)?.[0] ?? null);
      const a = racing ?? st.trigger, b = Math.min(a + startWindowS * 1000, next);
      const fr = iv.filter(f => f.at >= a && f.at < b), load = iv.filter(f => f.at >= st.trigger && f.at < a);
      const stalls = fr.filter(f => f.ms > stallMs).map(f => {
        const fEnd = f.at + f.ms;
        // Frame-host frames that overlap this interval by 10 ms or more (rAF timestamps are frame begin times, so a long
        // host frame can straddle two intervals; it is listed under both).
        const host = raw.host.filter(h => Math.min(h.at, fEnd) - Math.max(h.at - h.ms, f.at) >= Math.min(10, h.ms * 0.5)).map(h => ({ ms: r1(h.ms), gl: h.gl,
          phases: Object.fromEntries(Object.entries(h.phases).sort((x, y) => y[1] - x[1]).slice(0, 8).filter(([, v]) => v >= 1).map(([k, v]) => [k, r1(v)])) }));
        const events = (raw.events || []).filter(e => e[0] < fEnd && e[0] + e[2] > f.at).map(e => `${e[1]} ${r1(e[2])}`);
        const labels = (raw.labelLog || []).filter(e => e[0] < fEnd && e[0] + e[2] > f.at).map(e => `${e[1]} ${r1(e[2])}ms n=${e[3]}`);
        const l = raw.loaf.filter(x => x.start < fEnd && x.start + x.dur > f.at).sort((x, y) => y.dur - x.dur)[0];
        startWindows.push({ start: f.at, end: fEnd, key: `${i}@${r1(f.at)}` });
        return { atS: r1((f.at - a) / 1000), ms: Math.round(f.ms), host, events, labels,
          loaf: l ? { dur: Math.round(l.dur), render: Math.round(l.start + l.dur - (l.renderStart || l.start + l.dur)), scripts: l.scripts.sort((x, y) => y.dur - x.dur).slice(0, 4).map(x => `${Math.round(x.dur)}ms ${x.inv}${x.fn ? ` ${x.fn}` : ''} @${x.src}`) } : null, key: `${i}@${r1(f.at)}` };
      });
      const lr = (raw.labelLog || []).filter(e => e[0] >= a && e[0] < b);
      return { i, kind: st.kind, error: st.error, noReplan: st.noReplan, loadS: racing != null ? r1((racing - st.trigger) / 1000) : null,
        frames: frameStats(fr.map(f => f.ms)), loadFrames: { over50: load.filter(f => f.ms > 50).length, over100: load.filter(f => f.ms > 100).length },
        labelRebuilds: lr.filter(e => e[1] === 'rebuild').map(e => `${r1(e[2])}ms n=${e[3]}`), labelFullDraws: lr.filter(e => e[1] === 'draw full').map(e => `${r1(e[2])}ms placed=${e[3]}`), stalls };
    });
  }
  // Profile alignment: first sample inside __lsSync <-> marks.sync0.
  let attribution = null, alignErrMs = null;
  if (profile) {
    const ids = new Set(profile.nodes.filter(n => n.callFrame.functionName === '__lsSync').map(n => n.id));
    let tt = profile.startTime / 1000; const hits = [];
    for (let i = 0; i < profile.samples.length; i++) { tt += (profile.timeDeltas[i] ?? 0) / 1000; if (ids.has(profile.samples[i])) hits.push(tt); }
    if (hits.length) {
      const first = hits[0], offset = sync0 - first;
      const second = hits.find(h => h > first + 1000);
      alignErrMs = second != null ? r1(second + offset - sync1) : null;
      if (rideStarts) for (const st of rideStarts) for (const f of st.stalls) {
        const w = startWindows.find(x => x.key === f.key); if (!w) continue;
        const at = attribute(profile, [w], offset);
        f.profile = { categories: at.categories.slice(0, 6).filter(c => c.ms >= 2), owners: at.owners.slice(0, 6).filter(c => c.ms >= 2) };
      }
      attribution = {
        stalls: attribute(profile, stallWindows, offset),
        whole: attribute(profile, [{ start: 0, end }], offset),
      };
    }
    if (process.env.KEEP_PROFILE) fs.writeFileSync(out.replace(/\.json$/, `-${kind}-x${throttle}.cpuprofile`), JSON.stringify(profile));
  }
  // LoAF script entry points over the stalled frames, summed by entry.
  const entries = new Map();
  for (const l of raw.loaf) if (l.dur > 50) for (const s of l.scripts) { const k = `${s.type} ${s.inv} @ ${s.src}${s.fn ? ` ${s.fn}` : ''}`; entries.set(k, (entries.get(k) || 0) + s.dur); }
  const loafRender = raw.loaf.filter(l => l.dur > 50).reduce((a, l) => a + (l.start + l.dur - (l.renderStart || l.start + l.dur)), 0);
  const worst = iv.filter(f => f.ms > stallMs && inMotion(f)).sort((a, b) => b.ms - a.ms).map(f => {
    const l = raw.loaf.filter(x => x.start < f.at + f.ms && x.start + x.dur > f.at).sort((a, b) => b.dur - a.dur)[0];
    return { atS: r1(f.at / 1000), ms: Math.round(f.ms), scripts: l ? l.scripts.sort((a, b) => b.dur - a.dur).slice(0, 3).map(s => `${Math.round(s.dur)}ms ${s.inv}${s.fn ? ` ${s.fn}` : ''} @${s.src}`) : [] };
  });
  if (watchdog) clearInterval(watchdog);
  return {
    kind, throttle, device, qs, errors: errors.slice(0, 5), reached,
    marksS: Object.fromEntries(Object.entries(raw.marks).map(([k, v]) => [k, +(v / 1000).toFixed(2)])),
    frames: frameStats(intervals),
    phases: { load: phase('sync0', 'racing'), ride: phase('racing') }, motion,
    longTasks: { n: raw.longtask.length, totalMs: Math.round(raw.longtask.reduce((a, b) => a + b.dur, 0)), over100: raw.longtask.filter(l => l.dur > 100).length, longestMs: Math.round(Math.max(0, ...raw.longtask.map(l => l.dur))) },
    loaf: { over50: raw.loaf.filter(l => l.dur > 50).length, renderMsInStalls: Math.round(loafRender), entries: [...entries].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => ({ k, ms: Math.round(v) })) },
    dump, gl, worst, rideStarts, attribution, alignErrMs, heapMB: raw.heapMB, heapAtStart, heapAtEnd, distanceM: raw.distancePx != null ? Math.round(raw.distancePx / 3) : null, railM: raw.railPx != null ? Math.round(raw.railPx / 3) : null, ownGround: raw.ownGround, lift: raw.lift, world: raw.world,
  };
}

const browser = await chromium.launch({ headless: process.env.HEADED !== '1', executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const results = [];
for (const throttle of throttles) {
  // ipad: the iPad profile of scripts/gpu-load-ipad.mjs (iPad Pro 11 landscape, touch: the phone/tablet device defaults).
  const ipad = { viewport: { width: 1180, height: 734 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPad Pro 11'].userAgent };
  const context = await browser.newContext(device === 'iphone' ? { ...devices['iPhone 13'] } : device === 'ipad' ? ipad : { viewport: { width: Number((process.env.VIEWPORT || '1512x982').split('x')[0]), height: Number((process.env.VIEWPORT || '1512x982').split('x')[1]) }, deviceScaleFactor: Number(process.env.DPR || 1) });
  for (const kind of runKinds) {
    const r = await run(browser, kind, throttle, context);
    results.push(r);
    const f = r.frames;
    if (r.motion) { const m = r.motion, f = m.frames; console.log(`motion ${kind} x${throttle}: ${m.seconds}s p50 ${f.p50} p95 ${f.p95} p99 ${f.p99} >50/min ${m.hitchesPerMin.over50} >100/min ${m.hitchesPerMin.over100} longest ${f.longestMs} stalled ${f.stalledS}s LT ${m.longTasks.n} aligned ${m.bursts.alignedWithStreaming}/${m.bursts.hitches} renders/frame ${m.cadence.renderPerFrame} dist ${r.distanceM}m errors ${r.errors.join(';')}`); }
    if (r.rideStarts) for (const st of r.rideStarts) console.log(`start ${st.i} ${st.kind}${st.error ? ` ERROR ${st.error}` : ''}: load ${st.loadS}s >50 ${st.frames.over50} >100 ${st.frames.over100} >200 ${st.frames.hist['250-500'] + st.frames.hist['>500'] + st.stalls.filter(f => f.ms > 200 && f.ms <= 250).length} longest ${st.frames.longestMs} | ${st.stalls.map(f => `${f.ms}@${f.atS}`).join(' ')}`);
    if (r.heapAtStart) console.log(`heap ${kind} x${throttle}: start main ${r.heapAtStart.main.usedMB} MB (+${r.heapAtStart.main.backingMB ?? '?'} buffers) workers ${r.heapAtStart.workersUsedMB} MB @${r.heapAtStart.atS}s; end main ${r.heapAtEnd?.main?.usedMB} MB (+${r.heapAtEnd?.main?.backingMB ?? '?'}) workers ${r.heapAtEnd?.workersUsedMB} MB`);
    console.log(`${kind} x${throttle}: p50 ${f.p50} p95 ${f.p95} p99 ${f.p99} >50 ${f.over50} >100 ${f.over100} longest ${f.longestMs} stalled ${f.stalledS}s racing@${r.marksS.racing} align ${r.alignErrMs} errors ${r.errors.length}`);
  }
  await context.close();
}
await browser.close();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ when: new Date().toISOString(), seconds, device, results }, null, 1));
console.log('wrote', out);
