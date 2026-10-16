// Load stutter: the first 90 s of a seeded ride from a cold and a warm HTTP cache, with stall attribution.
//   PORT=4544 node scripts/motion-stutter.mjs <out.json> [--throttle 1,4] [--seconds 90] [--device desktop|iphone] [--runs cold,warm]
//   motion: --start <poi id> --dest <poi id> --warmup 30 --measure 60 (Jordaan: Noorderkerk -> Westermoskee)
// Route: Anne Frank Huis -> Rijksmuseum, car, chase, seeded Math.random (as ride-perf-fixed-route.mjs). The route is
// submitted as soon as the start card is ready and, once the intro overview ends, an autopilot steers along the
// planned route at cruise speed (the driving harness's lookahead steer). The clock starts at navigation.
// Per run: rAF frame intervals (histogram, p50/p95/p99, frames > 50/100 ms, longest, stalled seconds = summed length
// of frames over 50 ms), long-animation-frame entries with their script entry points, long tasks, and a V8 sampling
// profile started on a same-origin blank page before navigation (so the ~1.7 s Profiler.start stall is outside the
// window), aligned to performance.now() with a busy-loop marker, then aggregated over the stalled frames by self
// function, by category (gc, json, shader, upload, ...) and by owning app function.
// BUNDLES_DIR=<dir> serves *.bundle.js from a local build. PROFILE=0 skips the profiler. KEEP_PROFILE=1 writes the raw
// profile next to the output.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

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
  if (process.env.BUNDLES_DIR) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
    return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  await page.addInitScript(() => {
    let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
    if (!/^\/canal-drive\/?(index\.html)?$/.test(location.pathname)) return;
    const L = window.__ls = { frames: [], loaf: [], longtask: [], marks: {} };
    try {
      new PerformanceObserver(list => { for (const e of list.getEntries()) L.loaf.push({ start: e.startTime, dur: e.duration, blocking: e.blockingDuration, renderStart: e.renderStart, styleStart: e.styleAndLayoutStart, scripts: (e.scripts || []).map(x => ({ inv: x.invoker, type: x.invokerType, src: (x.sourceURL || '').split('/').pop(), fn: x.sourceFunctionName, start: x.startTime, dur: x.duration, forced: x.forcedStyleAndLayoutDuration })) }); }).observe({ type: 'long-animation-frame', buffered: true });
    } catch (_) {}
    try { new PerformanceObserver(list => { for (const e of list.getEntries()) L.longtask.push({ start: e.startTime, dur: e.duration }); }).observe({ type: 'longtask', buffered: true }); } catch (_) {}
    const tick = now => { L.frames.push(now); if (!L.stop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.goto(`${origin}/canal-drive/js/build-stamp.js`).catch(() => {});
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  if (profiling) {
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start');
    await page.waitForTimeout(2500); // the Profiler.start stall lands here, before navigation
  }
  const navAt = Date.now();
  await page.goto(`${origin}/canal-drive/${qs}`);
  const sync = async label => page.evaluate(label => {
    const s = performance.now(); const fn = window.__lsSync || (window.__lsSync = function __lsSync() { const t = performance.now(); let x = 0; while (performance.now() - t < 25) x += Math.sqrt(x + 1); return x; });
    fn(); window.__ls.marks[label] = s; return s;
  }, label);
  const sync0 = profiling ? await sync('sync0') : null;
  const mark = label => page.evaluate(label => { window.__ls.marks[label] = performance.now(); }, label);
  let deadline = navAt + (warmup != null ? 180_000 : seconds * 1000);
  const left = () => Math.max(1000, deadline - Date.now());
  let reached = 'nav';
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
    await page.evaluate(([viaIds, speed]) => { window.__via = viaIds; window.__railSpeed = speed; }, [via, railSpeed]);
    await page.evaluate(() => {
      const g = canalRecallGame, p = g.player, L = window.__ls, vm = g.vectorMap, map = vm.map;
      // Questions still appear (their cards and layout are part of play) but do not hold the rider for an answer.
      g._quizFreezesRide = () => false;
      // Cadence: each MapLibre render with the rider pose it drew, each game-loop tick, and timed streaming events.
      L.renders = []; L.ticks = []; L.events = [];
      const render = map._render.bind(map);
      map._render = (...a) => { L.renders.push([performance.now(), p.x, p.y, p.speed]); return render(...a); };
      const loop = g._loop.bind(g);
      g._loop = (t) => { L.ticks.push(performance.now()); return loop(t); };
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
      let route = null, index = 1;
      p.handleInput = () => {
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
      await page.waitForTimeout(measure * 1000);
      await mark('motionEnd');
      deadline = Date.now();
    }
    errors.push(`route ${await page.evaluate(() => { const g = canalRecallGame, f = g.track.finishPoint; return `finish dist ${Math.round(Math.hypot(f.x - g.player.x, f.y - g.player.y))}px dest ${document.querySelector('#poi-destination')?.value}`; })}`);
  } catch (e) { errors.push(`flow stopped after ${reached}: ${e.message.split('\n')[0]}`); }
  await page.waitForTimeout(Math.max(0, deadline - Date.now()));
  const sync1 = profiling ? await sync('sync1') : null;
  const raw = await page.evaluate(() => {
    const L = window.__ls; L.stop = true; const g = window.canalRecallGame, vm = g?.vectorMap;
    const og = vm?._ownGround?.status?.(); const mem = performance.memory;
    return { ...L, heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null, distancePx: g?.player?.distancePx ?? null, state: g?.state,
      ownGround: og ? { cells: og.cells && Object.keys(og.cells).length, built: og.built, buildMsMedian: og.buildMsMedian, installMsMedian: og.installMsMedian } : null };
  });
  let profile = null;
  if (profiling) ({ profile } = await cdp.send('Profiler.stop'));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.close();

  const end = raw.marks.sync1 ?? (seconds * 1000);
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
  const stallWindows = iv.filter(f => f.ms > 50 && inMotion(f)).map(f => ({ start: f.at, end: f.at + f.ms }));
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
  const worst = iv.filter(f => f.ms > 50 && inMotion(f)).sort((a, b) => b.ms - a.ms).map(f => {
    const l = raw.loaf.filter(x => x.start < f.at + f.ms && x.start + x.dur > f.at).sort((a, b) => b.dur - a.dur)[0];
    return { atS: r1(f.at / 1000), ms: Math.round(f.ms), scripts: l ? l.scripts.sort((a, b) => b.dur - a.dur).slice(0, 3).map(s => `${Math.round(s.dur)}ms ${s.inv}${s.fn ? ` ${s.fn}` : ''} @${s.src}`) : [] };
  });
  return {
    kind, throttle, device, qs, errors: errors.slice(0, 5), reached,
    marksS: Object.fromEntries(Object.entries(raw.marks).map(([k, v]) => [k, +(v / 1000).toFixed(2)])),
    frames: frameStats(intervals),
    phases: { load: phase('sync0', 'racing'), ride: phase('racing') }, motion,
    longTasks: { n: raw.longtask.length, totalMs: Math.round(raw.longtask.reduce((a, b) => a + b.dur, 0)), over100: raw.longtask.filter(l => l.dur > 100).length, longestMs: Math.round(Math.max(0, ...raw.longtask.map(l => l.dur))) },
    loaf: { over50: raw.loaf.filter(l => l.dur > 50).length, renderMsInStalls: Math.round(loafRender), entries: [...entries].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => ({ k, ms: Math.round(v) })) },
    worst, attribution, alignErrMs, heapMB: raw.heapMB, distanceM: raw.distancePx != null ? Math.round(raw.distancePx / 3) : null, railM: raw.railPx != null ? Math.round(raw.railPx / 3) : null, ownGround: raw.ownGround,
  };
}

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const results = [];
for (const throttle of throttles) {
  const context = await browser.newContext(device === 'iphone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 } });
  for (const kind of runKinds) {
    const r = await run(browser, kind, throttle, context);
    results.push(r);
    const f = r.frames;
    if (r.motion) { const m = r.motion, f = m.frames; console.log(`motion ${kind} x${throttle}: ${m.seconds}s p50 ${f.p50} p95 ${f.p95} p99 ${f.p99} >50/min ${m.hitchesPerMin.over50} >100/min ${m.hitchesPerMin.over100} longest ${f.longestMs} stalled ${f.stalledS}s LT ${m.longTasks.n} aligned ${m.bursts.alignedWithStreaming}/${m.bursts.hitches} renders/frame ${m.cadence.renderPerFrame} dist ${r.distanceM}m errors ${r.errors.join(';')}`); }
    console.log(`${kind} x${throttle}: p50 ${f.p50} p95 ${f.p95} p99 ${f.p99} >50 ${f.over50} >100 ${f.over100} longest ${f.longestMs} stalled ${f.stalledS}s racing@${r.marksS.racing} align ${r.alignErrMs} errors ${r.errors.length}`);
  }
  await context.close();
}
await browser.close();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ when: new Date().toISOString(), seconds, device, results }, null, 1));
console.log('wrote', out);
