// Aerial pan (lane R1-C, #225): the user panned around the whole city from the air in Free Ride on the own engine
// (build 69d4c65, Mac, DPR 2) and the tab became "practically locked". This replays that: Free Ride, the camera
// dragged off the rider (camera.detached, as a trackpad scroll does through Camera.pan), up at the S1 pose (high pitch
// over Hoftuin) and the S4 pose (from the air over the Zuidas rails), sweeping Centrum -> Zuid -> West -> Oost and back
// for --pan seconds at --speed m/s. Every --every s (default 5), after a forced GC in the page and its workers:
// JS heap, renderer.info.memory geometries/textures/programs, resident GPU bytes and cumulative texImage/bufferData
// bytes (glCounters), resident counts (world cells, building chunks by kind, landmark models, labels placed, trees,
// ground cells, far-ring blocks), worker count, renderer/GPU process RSS, and the frames of the window since the
// previous sample (p99, > 100 ms, > 250 ms) with the slowest frames' phases (`framePhases=1`).
//
//   PORT=4642 node scripts/aerial-pan.mjs <out.json> [--device desktop|iphone] [--pan 180] [--every 5] [--speed 300]
//     [--qs '?ride=free&engine=own'] [--chrome] [--headed] [--census] [--land]
// BUNDLES_DIR=<dir> serves *.bundle.js from a scratch build (the Vite reload trap: never build into the worktree).
// WORLD_DIR=<dir> serves world-v1 (tiles.json, cells, far/, shells/) from a staged compile (artifacts/world/staging).
// SHOTS=<dir> saves a frame at each pose change (the before/after strips at the user's spots).
// --census dumps every Map/Set/Array size under the world view's big owners at each sample (finds an unnamed grower).
// Gates (tests/perf/budgets.json aerial* rows, integrator-owned): see `summary` at the end of the output.
import { execFileSync } from 'node:child_process';
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { heapSample } from './heap-sample.mjs';

const argv = process.argv.slice(2);
const out = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'artifacts/perf/aerial-pan.json';
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const device = opt('device', 'desktop');
const panS = Number(opt('pan', '180'));
const every = Number(opt('every', '5'));
// --continuous (lane R4-E #248): a player-like flight over the same legs: each leg flown as a fly-to (ease in, cruise at
// --speed, ease out to the waypoint, a --dwell s look), the pose blended across the leg instead of eased at its start,
// the camera starting at the first waypoint. Default speed 120 m/s there (one lap in ~180 s); the harness keeps 300.
const continuous = argv.includes('--continuous');
const speed = Number(opt('speed', continuous ? '120' : '300'));
const dwellS = Number(opt('dwell', '2'));
const accelS = Number(opt('accel', '3'));
const extraQs = opt('qs', '');
const useChrome = argv.includes('--chrome');
const headed = argv.includes('--headed');
const censusOn = argv.includes('--census');
const origin = process.env.ORIGIN || `http://127.0.0.1:${process.env.PORT || 4642}`;
const pagePath = process.env.PAGE || '/canal-drive/';
const shotsDir = process.env.SHOTS || '';

// The sweep: Dam -> S1 Hoftuin -> S4 Zuidas -> West -> Oost -> Dam (lng, lat), each leg flown at a pose.
// S1: high pitch looking NE over Nieuwmarktbuurt; S4: from the air looking N over the rails N of Beatrixpark.
const POSES = { s1: { zoom: 0.45, tilt: 12, bearing: 30 }, s4: { zoom: 0.25, tilt: 15, bearing: 0 } };
const WAYPOINTS = [
  { name: 'dam', at: [4.8926, 52.3731], pose: 's1' },
  { name: 's1-hoftuin', at: [4.9065, 52.3655], pose: 's1' },
  { name: 's4-zuidas', at: [4.8775, 52.3385], pose: 's4' },
  { name: 'west-bos-en-lommer', at: [4.8530, 52.3780], pose: 's4' },
  { name: 'oost-dapperbuurt', at: [4.9300, 52.3640], pose: 's1' },
  { name: 'dam', at: [4.8926, 52.3731], pose: 's1' },
];

const browser = await chromium.launch({
  headless: !headed,
  args: ['--enable-precise-memory-info', '--js-flags=--expose-gc', ...(useChrome ? ['--use-angle=metal', '--ignore-gpu-blocklist'] : [])],
  ...(useChrome ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}),
});
const browserCdp = await browser.newBrowserCDPSession();
async function processRss() {
  try {
    const { processInfo } = await browserCdp.send('SystemInfo.getProcessInfo');
    const o = {};
    for (const p of processInfo) {
      if (p.type !== 'renderer' && p.type !== 'GPU') continue;
      let kb = 0; try { kb = Number(execFileSync('ps', ['-o', 'rss=', '-p', String(p.id)]).toString().trim()) || 0; } catch (_) {}
      const k = p.type === 'GPU' ? 'gpuRssMB' : 'rendererRssMB';
      o[k] = Math.max(o[k] ?? 0, Math.round(kb / 1024));
    }
    return o;
  } catch (e) { return { rssError: String(e).slice(0, 120) }; }
}
const [vw, vh] = (process.env.VIEWPORT || '1512x982').split('x').map(Number);
const context = await browser.newContext(device === 'iphone' ? { ...devices['iPhone 13'] } : { viewport: { width: vw, height: vh }, deviceScaleFactor: Number(process.env.DPR || 2) });
if (process.env.BUNDLES_DIR) await context.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
  const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: 'application/javascript' }) : route.continue();
});
if (process.env.WORLD_DIR) await context.route(/\/data\/extracts\/amsterdam\/world-v1\/([\w/.-]+?)(\?.*)?$/, route => {
  const file = path.join(process.env.WORLD_DIR, /\/world-v1\/([\w/.-]+?)(\?.*)?$/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.json') ? 'application/json' : 'application/octet-stream' }) : route.fulfill({ status: 404, body: '' });
});
// Sentry stays out of a harness run.
await context.route(/ingest\.(us\.)?sentry\.io/, route => route.fulfill({ status: 200, body: '{}' }));
const page = await context.newPage();
await page.addInitScript(() => {
  window.__canalRecallGlCounters = true;
  const F = window.__aerialFrames = { t: [], skip: [] };
  // Long animation frames (lane R3-F #241): which main-thread scripts sit in the long frames, and how much of a long
  // rAF interval the main thread was busy at all (the rest is GPU / compositor).
  const L = window.__aerialLoaf = [];
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        if (e.duration < 50) continue;
        L.push({ start: e.startTime, duration: e.duration, renderStart: e.renderStart, styleAndLayoutStart: e.styleAndLayoutStart, blocking: e.blockingDuration,
          scripts: (e.scripts ?? []).map(sc => ({ invoker: String(sc.invoker ?? '').slice(0, 120), type: sc.invokerType, fn: sc.sourceFunctionName, url: String(sc.sourceURL ?? '').split('/').pop().split('?')[0], char: sc.sourceCharPosition, duration: Math.round(sc.duration), layout: Math.round(sc.forcedStyleAndLayoutDuration ?? 0) })) });
      }
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch (_) { /* no LoAF */ }
  // Every rendered frame's framePhases split whose callback took > 30 ms, stamped (lane R4-E #248): a long rAF interval
  // is matched to the callback that ran inside it, and the rest of the interval (tasks between frames: fetch / worker
  // results / decode / GC; or GPU back-pressure) is reported as `outside`. The recorder is created lazily by the engine
  // (framePhases.ts), so its `end` is wrapped when the engine assigns it.
  const PF = window.__aerialPhaseFrames = [];
  let rec;
  Object.defineProperty(window, '__canalRecallFramePhaseRecorder', { configurable: true, get: () => rec, set: v => {
    rec = v;
    if (v && typeof v.end === 'function') {
      const end = v.end.bind(v);
      v.end = ms => { const phases = v.current ? { ...v.current } : {}; end(ms); if (ms > 30) PF.push({ at: performance.now(), ms, phases }); };
    }
  } });
  const tick = now => { F.t.push(now); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
});
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
const cdp = await context.newCDPSession(page);
const qs = `?ride=free&engine=own&framePhases=1${extraQs ? `&${extraQs.replace(/^\?/, '')}` : ''}`;
const t0 = Date.now();
if (process.env.ORDINARY_DEBUG) await page.addInitScript(() => { window.__ordinaryDebug = true; });
await page.goto(`${origin}${pagePath}${qs}`);
await page.waitForFunction(() => window.canalRecallGame?.state === 4 && window.canalRecallGame.camera?.introOverview === 0 && window.canalRecallGame.freeRide, null, { timeout: 180_000 });
// Chase (the Free Ride default on the user's Mac), the rider held still: the camera does the travelling.
await page.evaluate(() => {
  const g = canalRecallGame, p = g.player;
  g.camera.viewMode = 'chase';
  p.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; };
});
const settleMs = await page.evaluate(async () => {
  const t = performance.now(), cam = canalRecallGame.vectorMap.camera;
  await Promise.race([cam?.whenIdle?.() ?? Promise.resolve(), new Promise(r => setTimeout(r, 60_000))]);
  return Math.round(performance.now() - t);
});
await page.waitForTimeout(2000);
await page.evaluate(() => window.__canalPerf?.gl?.markWarm?.());
// Every upload's bytes by owner (the counters keep only the last 200 large events): uploads of 64 KiB and more are
// named (glCounters ownerNow, a stack walk), smaller ones are summed by GL call.
await page.evaluate(() => {
  const gl = window.__canalPerf?.gl?.counters; if (!gl?.upload || window.__uploadByOwner) return;
  const by = window.__uploadByOwner = {}, base = gl.upload.bind(gl);
  // Stamped GL events for the long-frame report (lane R4-E #248): uploads of 64 KiB and more with their owner, small
  // uploads summed into the next stamped event, and every shader compile / program link.
  const ev = window.__glEvents = []; let small = 0;
  gl.upload = (fn, bytes) => {
    let owner = `small ${fn}`;
    if (bytes >= 65536) { try { owner = gl.ownerNow().replace(/^.*?\) @ /, ''); } catch { owner = `? ${fn}`; } }
    const o = by[owner] ??= { n: 0, MB: 0 }; o.n++; o.MB += bytes / 1048576;
    if (bytes >= 65536) { ev.push({ at: performance.now(), kind: 'upload', bytes, owner, small }); small = 0; } else small += bytes;
    return base(fn, bytes);
  };
  if (typeof gl.program === 'function') {
    const prog = gl.program.bind(gl);
    gl.program = (kind, fn) => { let owner = '?'; try { owner = gl.ownerNow().replace(/^.*?\) @ /, ''); } catch { /* */ } ev.push({ at: performance.now(), kind, bytes: 0, owner, small: 0 }); return prog(kind, fn); };
  }
});


// Lane R4-F (#249): the fetch ring's size over time, every 250 ms (the 5 s samples miss a jump's shape): cells held,
// cells the unpaced ring wants (planRing(true)), and the trees' rebuild times since the last read.
await page.evaluate(() => {
  if (window.__ringSeries) return;
  const s = window.__ringSeries = [], city = () => canalRecallGame.vectorMap._completeCity;
  setInterval(() => {
    const c = city(); if (!c) return;
    let full = null; try { full = c.planRing?.(true)?.size ?? null; } catch { /* no world */ }
    s.push([Math.round(performance.now()), c.ring?.size ?? null, full]);
  }, 250);
  // Every inventory-trees rebuild's time (wrapped here, so any bundle is measured): [at, ms, trees].
  const trees = canalRecallGame.vectorMap._inventoryTrees, times = window.__treeRebuilds = [];
  if (trees?.rebuild) {
    const base = trees.rebuild.bind(trees);
    trees.rebuild = (...a) => { const t = performance.now(); const r = base(...a); times.push([Math.round(t), +(performance.now() - t).toFixed(1), trees.debugTrees ?? null]); return r; };
  }
});

// The chase pose the ride settled at (the --land leg drops back to it).
await page.evaluate(() => { const g = canalRecallGame; window.__chasePose = { zoom: g.camera.zoom, tilt: g.vectorMap._cameraTilt ?? null, rotation: g.camera.rotation }; });

// The pan driver: a rAF loop that moves the detached camera's anchor along the waypoints at `speed` m/s and eases the
// zoom, tilt and bearing toward each leg's pose. `window.__aerialPause` holds it still while a sample runs.
await page.evaluate(([wps, poses, v, flight]) => {
  const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), cam = g.camera, vm = g.vectorMap;
  const world = ([lng, lat]) => ({ x: l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y: l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm });
  const pts = wps.map(w => ({ ...w, p: world(w.at) }));
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].p.x - pts[i - 1].p.x, pts[i].p.y - pts[i - 1].p.y));
  const total = cum[cum.length - 1];
  const A = window.__aerial = { s: 0, laps: 0, leg: 0, poseChanges: [], totalM: Math.round(total / ppm) };
  cam.pan(1, 0);
  let last = performance.now(), tilt = 0;
  if (flight.continuous) {
    // Fly-to legs: distance along leg i follows a trapezoid (accelerate over accelS, cruise at v, decelerate over accelS
    // to the waypoint), then a dwell. The camera starts at the first waypoint at its pose (no initial jump).
    const p0 = pts[0], pose0 = poses[p0.pose];
    cam.detached = true; cam.anchorX = cam.x = p0.p.x; cam.anchorY = cam.y = p0.p.y; cam.zoom = pose0.zoom; cam.rotation = pose0.bearing * Math.PI / 180;
    tilt = pose0.tilt; vm.setCameraTilt?.(tilt); vm._cameraTilt = tilt;
    const legs = pts.slice(1).map((b, k) => {
      const a = pts[k], len = cum[k + 1] - cum[k], vpx = v * ppm, ta = flight.accelS;
      // A short leg never reaches cruise: a triangle with peak sqrt(len * vpx / ta).
      const reach = vpx * ta; const peak = len >= reach ? vpx : Math.sqrt(len * vpx / ta), tRamp = peak / vpx * ta, tCruise = Math.max(0, (len - peak * tRamp) / Math.max(1e-6, peak));
      return { a, b, len, peak, tRamp, tCruise, tMove: 2 * tRamp + tCruise, tAll: 2 * tRamp + tCruise + flight.dwellS, from: poses[a.pose], to: poses[b.pose] };
    });
    const along = (L, t) => {
      if (t <= L.tRamp) return 0.5 * (L.peak / L.tRamp) * t * t;
      if (t <= L.tRamp + L.tCruise) return 0.5 * L.peak * L.tRamp + L.peak * (t - L.tRamp);
      if (t <= L.tMove) { const u = L.tMove - t; return L.len - 0.5 * (L.peak / L.tRamp) * u * u; }
      return L.len;
    };
    const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
    let legT = 0, k = 0;
    A.leg = 1; A.poseChanges.push({ at: performance.now(), to: legs[0].b.name, pose: legs[0].b.pose });
    const step = now => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!window.__aerialPause) {
        legT += dt;
        while (legT >= legs[k].tAll) {
          legT -= legs[k].tAll; k++;
          if (k >= legs.length) { k = 0; A.laps++; }
          A.leg = k + 1; A.poseChanges.push({ at: performance.now(), to: legs[k].b.name, pose: legs[k].b.pose });
        }
        const L = legs[k], d = along(L, legT), f = d / Math.max(1e-6, L.len);
        A.s = cum[k] + d; A.speedMps = legT < L.tMove ? Math.round((legT <= L.tRamp ? L.peak * legT / L.tRamp : legT <= L.tRamp + L.tCruise ? L.peak : L.peak * (L.tMove - legT) / L.tRamp) / ppm) : 0;
        cam.detached = true;
        cam.anchorX = L.a.p.x + (L.b.p.x - L.a.p.x) * f; cam.anchorY = L.a.p.y + (L.b.p.y - L.a.p.y) * f;
        // The pose changes across the leg's flight (a player zooms while panning), not in the first 2 s of it.
        const w = smooth(f);
        cam.zoom = L.from.zoom + (L.to.zoom - L.from.zoom) * w;
        tilt = L.from.tilt + (L.to.tilt - L.from.tilt) * w;
        vm.setCameraTilt?.(tilt); vm._cameraTilt = tilt;
        let db = (L.to.bearing - L.from.bearing) * Math.PI / 180; db = Math.atan2(Math.sin(db), Math.cos(db));
        cam.rotation = L.from.bearing * Math.PI / 180 + db * w;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return;
  }
  const step = now => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!window.__aerialPause) {
      A.s += v * ppm * dt;
      if (A.s >= total) { A.s -= total; A.laps++; }
      let i = 1; while (i < pts.length - 1 && cum[i] < A.s) i++;
      const a = pts[i - 1].p, b = pts[i].p, f = (A.s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
      if (i !== A.leg) { A.leg = i; A.poseChanges.push({ at: performance.now(), to: pts[i].name, pose: pts[i].pose }); }
      const pose = poses[pts[i].pose];
      cam.detached = true;
      cam.anchorX = a.x + (b.x - a.x) * f; cam.anchorY = a.y + (b.y - a.y) * f;
      cam.zoom += (pose.zoom - cam.zoom) * Math.min(1, dt * 1.5);
      tilt += (pose.tilt - tilt) * Math.min(1, dt * 1.5);
      vm.setCameraTilt?.(tilt); vm._cameraTilt = tilt;
      let d = pose.bearing * Math.PI / 180 - cam.rotation; d = Math.atan2(Math.sin(d), Math.cos(d));
      cam.rotation += d * Math.min(1, dt * 1.2);
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}, [WAYPOINTS, POSES, speed, { continuous, dwellS, accelS }]);

const pickQ = (v, q) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };
/**
 * Every rAF interval over 100 ms since `from` (lane R4-E #248), with the framePhases split of the callback that ran in
 * it (`cb`: its ms and top phases; game frame / three render main / labels / sync: ground ... ), `outside` (interval minus
 * callback: tasks between frames such as fetch / worker results / decode / GC, or GPU back-pressure), the long-animation-
 * frame scripts overlapping it, the leg it fell in and the seconds since that leg began, and the seconds since the last
 * sample's pause ended. Call before frameWindow (which trims the timeline).
 */
const longFrames = (from, resumedAt) => page.evaluate(([from, resumedAt]) => {
  const F = window.__aerialFrames, PF = window.__aerialPhaseFrames ?? [], L = window.__aerialLoaf ?? [], A = window.__aerial, out = [];
  for (let i = 1; i < F.t.length; i++) {
    const a = F.t[i - 1], b = F.t[i];
    if (a < from || b - a <= 100) continue;
    if (F.skip.some(([x, y]) => b > x && a < y)) continue;
    const cb = PF.find(p => p.at > a && p.at <= b + 2);
    // GL work issued in the callback before this interval and inside it (the GPU process runs it while rAF waits).
    const gev = (window.__glEvents ?? []).filter(e => e.at > a - 40 && e.at <= b);
    const gOwners = {}; let gMB = 0, compiles = 0;
    for (const e of gev) {
      gMB += (e.bytes + e.small) / 1048576;
      if (e.kind === 'upload') { const k = e.owner.replace(/ \(new geometry\)| \[\w+\]/g, '').slice(0, 60); gOwners[k] = (gOwners[k] ?? 0) + e.bytes / 1048576; }
      else if (e.kind === 'compile') compiles++;
    }
    const leg = [...(A?.poseChanges ?? [])].reverse().find(c => c.at <= a);
    const scripts = L.filter(e => e.start < b && e.start + e.duration > a).flatMap(e => e.scripts.filter(sc => sc.duration >= 10).map(sc => `${sc.type}:${sc.fn || '?'}@${sc.url}:${sc.char} ${sc.duration}`)).slice(0, 4);
    const ph = cb ? Object.fromEntries(Object.entries(cb.phases).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => [k, Math.round(v)])) : null;
    const sum = re => cb ? Math.round(Object.entries(cb.phases).filter(([k]) => re.test(k)).reduce((s, [, v]) => s + v, 0)) : 0;
    out.push({ at: Math.round(b), ms: Math.round(b - a), cbMs: cb ? Math.round(cb.ms) : 0, outside: Math.round(b - a - (cb?.ms ?? 0)),
      split: { gameFrame: sum(/^game frame$/), renderMain: sum(/^three render (main|overlay)$/), labels: sum(/^labels$/), ground: sum(/^sync: ground update/), beforeRender: sum(/^beforeRender /), listeners: sum(/listener: /) },
      glMB: Math.round(gMB * 10) / 10, compiles, glOwners: Object.fromEntries(Object.entries(gOwners).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, v]) => [k, Math.round(v * 10) / 10])),
      phases: ph, scripts, leg: leg?.to ?? null, legS: leg ? Math.round((a - leg.at) / 100) / 10 : null, sinceResumeS: resumedAt ? Math.round((a - resumedAt) / 100) / 10 : null, speedMps: A?.speedMps ?? null });
  }
  { const k = PF.findIndex(p => p.at >= (F.t.at(-1) ?? 0) - 1000); PF.splice(0, k < 0 ? PF.length : k); }
  const GE = window.__glEvents; if (GE) { const k = GE.findIndex(e => e.at >= (F.t.at(-1) ?? 0) - 1000); GE.splice(0, k < 0 ? GE.length : k); }
  return out;
}, [from, resumedAt]);
const frameWindow = from => page.evaluate(from => {
  const F = window.__aerialFrames, o = [];
  for (let i = 1; i < F.t.length; i++) {
    if (F.t[i - 1] < from) continue;
    if (F.skip.some(([a, b]) => F.t[i] > a && F.t[i - 1] < b)) continue;
    o.push(F.t[i] - F.t[i - 1]);
  }
  // Keep the timeline small over a long run.
  const keepFrom = F.t.findIndex(t => t >= from - 1000); if (keepFrom > 0) F.t.splice(0, keepFrom);
  return o;
}, from);
const frameStats = iv => ({ n: iv.length, p50: +pickQ(iv, 0.5).toFixed(1), p99: +pickQ(iv, 0.99).toFixed(1),
  over50: iv.filter(f => f > 50).length, over100: iv.filter(f => f > 100).length, over250: iv.filter(f => f > 250).length, longestMs: Math.round(Math.max(0, ...iv)) });

/**
 * Draws per kind in the last rendered frame (lane R4-A #243): every renderBufferDirect is tallied under its shared-frame
 * participant (`shared-frame/<name>`), the facade layer's meshes split by chunk kind (coarse, near, extras, boats, kits),
 * baked coarse cells and far cells; shadow-map draws are counted apart. Installed once, on the first sample.
 */
const drawKinds = () => page.evaluate(() => {
  const vm = canalRecallGame.vectorMap, renderer = vm.host?.renderer;
  if (!renderer) return null;
  const D = window.__drawKinds ??= (() => {
    const st = { frame: 0, cur: {}, last: {}, at: -1 };
    const tick = () => { st.frame++; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    const kind = (o, material) => {
      const shadow = material?.isMeshDepthMaterial || material?.isMeshDistanceMaterial ? ' (shadow)' : '';
      let k;
      {
        let part = '', near = '', chunk = '';
        for (let p = o; p; p = p.parent) {
          const n = typeof p.name === 'string' ? p.name : '';
          if (p.userData?.bakedCoarse) chunk = 'baked-coarse';
          else if (p.userData?.farShell) chunk = 'far-shells';
          else if (!chunk && p.userData?.chunkKind) chunk = p.userData.chunkKind;
          if (n.startsWith('shared-frame/')) { part = n.slice(13); break; }
          if (!near && n) near = n.split(/[:/#]/)[0];
        }
        k = `${part || 'unwrapped'}:${chunk || near || o.type}`;
      }
      return k + shadow;
    };
    const rbd = renderer.renderBufferDirect.bind(renderer);
    renderer.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
      if (st.at !== st.frame) { st.last = st.cur; st.cur = {}; st.at = st.frame; }
      const k = kind(object, material); st.cur[k] = (st.cur[k] ?? 0) + 1;
      return rbd(camera, scene, geometry, material, object, group);
    };
    return st;
  })();
  // The facade layer's chunk meshes (and their culled tile children) carry their key's kind.
  const tb = vm._threeBuildings;
  if (tb?.chunks) for (const [key, c] of tb.chunks) { const m = c?.mesh; if (!m || m.userData.chunkKind) continue; const kind = key.includes(':') ? key.split(':')[0] : key.replace(/^_+/, ''); m.userData.chunkKind = kind; m.traverse?.(x => { x.userData.chunkKind = kind; }); }
  return D.last;
});

/**
 * The landmark owner's draws in one rendered frame by model kind (lane R4-C #245): street chunks, ordinary one-off
 * buildings, catalogue landmarks, the lod2 batch; main pass and shadow pass apart. Also resident models per kind and
 * level. Forces two repaints and counts the second frame.
 */
const landmarkDraws = () => page.evaluate(async () => {
  const vm = canalRecallGame.vectorMap, renderer = vm.host?.renderer, sig = vm._signatureLandmarks;
  if (!renderer || !sig?._entries) return null;
  const models = {};
  for (const e of sig._entries) {
    const kind = e.spec.chunkPands ? 'chunk' : e.spec.assetKind === 'ordinary-building' ? 'ordinary' : 'catalogue';
    e.holder.userData.lmKind = kind;
    const m = models[kind] ??= { resident: 0, visible: 0, levels: {} };
    m.resident++; if (e.holder.visible) { m.visible++; m.levels[e.level] = (m.levels[e.level] ?? 0) + 1; }
  }
  // One frame's draws: a persistent hook buckets them per animation frame (as drawKinds); the last whole frame is read.
  const D = window.__landmarkDrawKinds ??= (() => {
    const st = { frame: 0, at: -1, cur: {}, last: {} };
    const tick = () => { st.frame++; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    const rbd = renderer.renderBufferDirect.bind(renderer);
    renderer.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
      if (st.at !== st.frame) { st.last = st.cur; st.cur = {}; st.at = st.frame; }
      let kind = null;
      for (let p = object; p; p = p.parent) {
        if (p.userData?.lmKind) { kind = p.userData.lmKind; break; }
        if (typeof p.name === 'string' && p.name.startsWith('landmark-batch')) { kind = 'batch'; break; }
        if (typeof p.name === 'string' && p.name.startsWith('shared-frame/')) break;
      }
      if (kind) {
        const shadow = material?.isMeshDepthMaterial || material?.isMeshDistanceMaterial;
        const k = shadow ? `${kind} (shadow)` : kind; st.cur[k] = (st.cur[k] ?? 0) + 1;
      }
      return rbd(camera, scene, geometry, material, object, group);
    };
    return st;
  })();
  for (let i = 0; i < 4; i++) await new Promise(r => { (vm.map ?? vm.cameraMap)?.triggerRepaint?.(); requestAnimationFrame(r); });
  const count = { ...D.last };
  const main = Object.entries(count).filter(([k]) => !k.endsWith('(shadow)')).reduce((a, [, v]) => a + v, 0);
  return { main, byKind: count, models, batch: sig._batch?.stats?.() ?? null };
});

/** Resident counts by owner, read off the world view (names from the modules; `null` when an owner is absent). */
const residents = census => page.evaluate(census => {
  const g = canalRecallGame, vm = g.vectorMap, tb = vm._threeBuildings, city = vm._completeCity, ground = vm._ownGround;
  const size = v => v == null ? null : v instanceof Map || v instanceof Set ? v.size : Array.isArray(v) ? v.length : typeof v === 'object' && typeof v.size === 'number' ? v.size : null;
  const kinds = {};
  if (tb?.chunks) for (const [, c] of tb.chunks) { const k = c?.kind ?? c?.tier ?? (c?.coarse ? 'coarse' : c?.detail ? 'detail' : 'chunk'); kinds[k] = (kinds[k] ?? 0) + 1; }
  const info = vm.host?.renderer?.info;
  const sig = vm._signatureLandmarks, trees = vm._inventoryTrees;
  const pool = window.__canalRecallWorkerPool;
  const r = {
    zoom: Math.round(vm.camera.zoom() * 10) / 10, pitch: Math.round(vm.camera.pitch()), centre: vm.camera.center ? (c => [+c.lng.toFixed(4), +c.lat.toFixed(4)])(vm.camera.center()) : null,
    tier: vm.qualityTier?.tier ?? null, dpr: vm.host?.getPixelRatio?.() ?? null,
    geometries: info?.memory?.geometries ?? null, textures: info?.memory?.textures ?? null, programs: info?.programs?.length ?? null,
    gl: (() => { const rep = window.__canalPerf?.gl?.report?.(); return rep ? { residentMB: rep.resident.totalMB, decodedMB: rep.resident.totalDecodedMB ?? null, bufferMB: rep.resident.bufferMB, textureMB: rep.resident.textureMB, buffers: rep.resident.buffers, textures: rep.resident.textures, uploadMB: Math.round(rep.sinceWarm.uploadBytes / 1048576), uploads: rep.sinceWarm.uploads, compiles: rep.sinceWarm.compiles } : null; })(),
    chunks: size(tb?.chunks), chunkKinds: kinds, fading: size(tb?.fading), detailInstallsTotal: tb?.detailInstalls ?? null, detailTiles: size(tb?.detailTiles),
    // MB of the resident detail (`near:`) and extras chunks (their geometry bytes: the copy uploaded to the GPU).
    detailMB: tb?.chunks ? Math.round([...tb.chunks].filter(([k]) => k.startsWith('near:') || k.startsWith('extras:')).reduce((a, [, c]) => a + (c?.info?.bytes ?? 0), 0) / 1048576 * 10) / 10 : null,
    cityTiles: size(city?.cache?.tiles), cityFeatures: size(city?.cache?.list), cityRing: size(city?.ring), cityRingDeferred: city?.ringPacer?.deferred ?? null, worldInterned: size(city?.world?.interned),
    contextFeatures: size(tb?.contextFeatures), contextChanges: size(tb?.contextChanges), contextCache: size(tb?.contextCache), pendingJobs: size(tb?.pending?.jobs),
    landmarks: size(sig?._entries), landmarksShown: size(sig?.shown), texCap: sig?.texCapStats?.(true) ?? null, roofs: size(vm.extras?.roofs?._entries),
    // Lane R4-H (#252): the ordinary installs with lod rows (modelLods.json `ordinary`) by the level they are drawn at.
    ordinaryLevels: (() => { const lods = window.CanalRecallSignatureLandmarks?.MODEL_LODS; if (!sig?._entries || !lods) return null; const o = {}; for (const e of sig._entries) { const r = lods[e.spec?.id]; if (r?.ordinary || r?.lod2?.ordinary) o[e.level] = (o[e.level] ?? 0) + 1; } return o; })(),
    // ...and why (ORDINARY_DEBUG=1): each one's level, on screen, projected radius and lod1 boundary as the runtime sees them.
    ordinaryDebug: (() => { const lods = window.CanalRecallSignatureLandmarks?.MODEL_LODS; if (!window.__ordinaryDebug || !sig?._entries || !lods) return undefined; const v = sig._lod2On() ? sig._levelView() : null; return sig._entries.filter(e => lods[e.spec?.id]?.ordinary).map(e => { const i = sig._levelInputs(e.spec, e.radiusMetres, e.placement.anchor, v); return [e.spec.id.slice(-8), e.level, sig._nearby(e.spec, e.placement.anchor, sig._viewBounds()) ? 'in' : 'out', Math.round(i.radiusPixels), Math.round(i.lod1DowngradePx ?? -1), e.levelLoading ? 'loading' : '', e.lodFailed ? 'failed' : '']; }); })(),
    trees: size(trees?.tiles), groundCells: size(ground?.resident), groundPrepared: size(ground?.prepared), farRing: size(ground?.far),
    labelsPlaced: size(vm._labels?.placed), labelsByKind: (vm._labels?.placed ?? []).reduce((o, l) => { o[l.kind] = (o[l.kind] ?? 0) + 1; return o; }, {}), labelCandidates: vm._labels?.stats?.candidates ?? null, labelAerial: vm.labelAerial ?? null, occlusionIndexed: size(vm.labelOcclusion?.indexed),
    // Draw calls and triangles of the last main + overlay pass (sharedFrame stats), the own ground's far radius, the far
    // tier's resident cells / MB / draws (engine/farShells.ts, lane R2-B #229).
    draws: (vm._sharedFrame?.stats?.main?.calls ?? 0) + (vm._sharedFrame?.stats?.overlay?.calls ?? 0), drawTriangles: (vm._sharedFrame?.stats?.main?.triangles ?? 0) + (vm._sharedFrame?.stats?.overlay?.triangles ?? 0),
    farRadiusM: ground?.farRadius ?? null, farShells: vm._farShells?.stats?.() ?? null,
    bakedCoarse: vm._bakedCoarse?.stats?.() ?? null, bakedCoarseOff: vm.bakedCoarseOff ?? null,
    // Lane R4-I (#253): the baked cells' GPU bytes by attribute, and cells / vertices / MB by distance from the camera
    // eye (nearest cell edge) in bands: < 1, 1–2, 2–3, 3–4, ≥ 4 km.
    bakedAttr: (() => {
      const bc = vm._bakedCoarse; if (!bc?.residentDetail) return null;
      const e = vm.cameraMap?.camera?.eye?.() ?? vm.camera?.eye?.(), at = e ? [e.lng, e.lat] : null;
      const rows = bc.residentDetail(at), sum = { cells: rows.length, vertices: 0, float32Cells: 0, float32Vertices: 0, index32Cells: 0 }, mb = {};
      const keys = ['position', 'uv', 'layer', 'tint', 'accent', 'thin', 'hidden', 'swapSlot', 'index'];
      const bands = [1000, 2000, 3000, 4000, Infinity].map(max => ({ max, cells: 0, vertices: 0, mb: 0 }));
      for (const r of rows) {
        sum.vertices += r.vertices; if (r.float32) { sum.float32Cells++; sum.float32Vertices += r.vertices; } if (r.index32) sum.index32Cells++;
        let bytes = 0; for (const k of keys) { mb[k] = (mb[k] ?? 0) + r[k]; bytes += r[k]; }
        const b = bands.find(b => (r.distanceM ?? 0) < b.max); b.cells++; b.vertices += r.vertices; b.mb += bytes / 1048576;
      }
      for (const k of keys) mb[k] = Math.round((mb[k] ?? 0) / 1048576 * 10) / 10;
      mb.total = Math.round(keys.reduce((a, k) => a + mb[k], 0) * 10) / 10;
      return { ...sum, mb, bands: bands.map(b => ({ ...b, max: b.max === Infinity ? null : b.max, mb: Math.round(b.mb * 10) / 10 })), eyeAltM: e?.altitudeM != null ? Math.round(e.altitudeM) : null };
    })(),
    // Lane R4-J (#254): the facade atlas switch (look/atlasAerial.ts, `?atlasAerial=1`): mode, level floor, counters.
    atlasAerial: (() => { const sw = window.__canalRecallAtlasAerialSwitch; if (!sw) return null; const { curve, ...rest } = sw.stats; return rest; })(),
    coarseChunks: tb?.chunks ? [...tb.chunks.keys()].filter(k => k.startsWith('coarse:')).length : null,
    // Lane R4-A (#243), the coarse rebuild wave: coarse meshes dissolving in now (runtime `coarse:` chunks in the facade
    // layer's fades, plus baked cells), and every coarse dissolve so far (the facade layer's fade map is counted from the
    // first sample on; baked cells count their own).
    coarseFading: (tb?.fading ? [...tb.fading.keys()].filter(k => String(k).startsWith('coarse:')).length : 0) + (vm._bakedCoarse?.stats?.()?.fading ?? 0),
    coarseFadeInsTotal: (() => {
      const f = tb?.fading;
      if (f && !f.__coarseCount) { const set = f.set.bind(f); f.__coarseCount = { n: 0 }; f.set = (k, v) => { if (String(k).startsWith('coarse:') && !f.has(k)) f.__coarseCount.n++; return set(k, v); }; }
      return (f?.__coarseCount?.n ?? 0) + (vm._bakedCoarse?.stats?.()?.fadeIns ?? 0);
    })(),
    // Lane R3-F (#241): the last frame's draws by owner (facade chunks by kind), resident GPU MB by owner (glCounters
    // tagging; absent on older bundles), the held/sliced ground re-base and the budgeted label placements.
    ...(() => { const rep = window.__canalPerf?.gl?.report?.(); return { drawsByOwner: rep?.lastFrameByOwner ?? null, glOwners: rep?.resident?.byOwner?.slice(0, 40) ?? null, bakedOwnerMB: rep?.resident?.byOwner ? Math.round(rep.resident.byOwner.filter(o => /baked-coarse/.test(o.owner)).reduce((a, o) => a + o.MB, 0) * 10) / 10 : null, bakedOwnerObjects: rep?.resident?.byOwner ? rep.resident.byOwner.filter(o => /baked-coarse/.test(o.owner)).reduce((a, o) => a + o.objects, 0) : null }; })(),
    groundBases: vm.groundBaseStats ? { ...vm.groundBaseStats } : null,
    labelStats: vm._labels?.stats ? { full: vm._labels.stats.full, slicedFrames: vm._labels.stats.slicedFrames ?? null, lastFullMs: Math.round(vm._labels.stats.lastFullMs), churn: vm._labels.stats.churn ?? null } : null,
    workers: (pool?.live ?? 0) + (ground?.worker ? 1 : 0),
  };
  if (census) {
    // Every Map/Set/Array (and their sizes) two levels under the big owners: whatever grows is named here.
    const c = {};
    const visit = (prefix, o, depth, seen) => {
      if (!o || typeof o !== 'object' || seen.has(o) || o instanceof Node || o === window) return; seen.add(o);
      let keys; try { keys = Object.keys(o); } catch (_) { return; }
      for (const k of keys) {
        let v; try { v = o[k]; } catch (_) { continue; }
        if (!v || typeof v !== 'object' || ArrayBuffer.isView(v)) continue;
        const n = size(v);
        if (n != null && n >= 4 && (v instanceof Map || v instanceof Set || Array.isArray(v))) c[`${prefix}.${k}`] = n;
        if (depth > 1 && !(v instanceof Map || v instanceof Set || Array.isArray(v))) visit(`${prefix}.${k}`, v, depth - 1, seen);
      }
    };
    const seen = new Set();
    for (const k of ['_threeBuildings', '_completeCity', '_ownGround', 'extras', '_labels', '_sharedFrame', '_overview', 'labelOcclusion']) visit(`vm.${k}`, vm[k], 3, seen);
    r.census = c;
  }
  return r;
}, census);

// --spots: still frames at the user's spots (S1 Hoftuin, S4 Zuidas), each after the camera parks and the world settles
// (whenIdle, then 4 s), into SHOTS; no pan. The before/after strip beside the user's shots.
if (argv.includes('--spots')) {
  // West: Bos en Lommer looking west to the horizon (the far side of the pan; lane R2-B #229).
  // Sarphatipark looking north (lane R3-F #241): the user's pitched overview with ~90 shop and café names (2026-11-07).
  // The user's two label shots (2026-11-07): retail names over the Jacob van Lennepkanaal looking north to the
  // Chassébuurt (CHASSÉBUURT placed twice), and the "bouncing labels" over the Amstelkanaal looking north.
  const USER = { chassebuurt: { name: 'chassebuurt-north', at: [4.8665, 52.3625], ...POSES.s4, bearing: 0 }, amstelkanaal: { name: 'amstelkanaal-north', at: [4.8930, 52.3480], ...POSES.s4, bearing: 0 } };
  // SPOT_SET=parked (lane R4-C #245): R4-B's parked landmark spots from the air at the S1 pose (Westerkerk, Rijksmuseum,
  // the Amstel churches) plus S1 and S4; each row carries `landmarkDraws` (the landmark owner's draws by model kind).
  const PARKED = [{ name: 's1-hoftuin', at: [4.9065, 52.3655], ...POSES.s1 }, { name: 's4-zuidas', at: [4.8775, 52.3385], ...POSES.s4 },
    { name: 'westerkerk', at: [4.8839, 52.3745], ...POSES.s1 }, { name: 'rijksmuseum', at: [4.8852, 52.3600], ...POSES.s1 },
    { name: 'amstel', at: [4.9030, 52.3600], ...POSES.s1 },
    // Wide variants (R4-B's Westerkerk strip looked west over the Jordaan to Van Galenbuurt, the chunk rows in view).
    { name: 'westerkerk-wide-west', at: [4.8839, 52.3745], ...POSES.s4, bearing: 270 }, { name: 'rijksmuseum-wide-south', at: [4.8852, 52.3600], ...POSES.s4, bearing: 180 },
    { name: 'rijksmuseum-wide-west', at: [4.8852, 52.3600], ...POSES.s4, bearing: 270 }];
  // SPOT_SET=chunkstreet (lane R4-C #245): chase poses in front of two installed street chunks (Transvaalstraat 42-48,
  // Pretoriusstraat 71-95), for the street-level pixel identity of the chunk merge; both sides of each street.
  const CHUNK_STREET = [['transvaal-42-48', [4.925689639209945, 52.3551321520268], 318], ['pretorius-71-95', [4.921325184261987, 52.35453393870728], 153]]
    .flatMap(([name, target, b]) => [0, 180].map(flip => ({ name: `${name}-street-${(b + flip) % 360}`, street: { target, bearing: (b + flip) % 360, distM: 45 } })));
  const spots = process.env.SPOT_SET === 'chunkstreet' ? CHUNK_STREET : process.env.SPOT_SET === 'parked' ? PARKED : process.env.SPOT_SET === 'identity'
    // SPOT_SET=identity (lane R4-A #243): S1, the user's two aerial shots, and one street pose (look-consistency's
    // Westerkerk, as a chase pose).
    ? [{ name: 's1-hoftuin', at: [4.9065, 52.3655], ...POSES.s1 }, USER.amstelkanaal, USER.chassebuurt,
      { name: 'westerkerk-street', street: { target: [4.88390, 52.37450], bearing: 200, distM: 140, altM: 45, targetAltM: 15 } }]
    : [{ name: 's1-hoftuin', at: [4.9065, 52.3655], ...POSES.s1 }, { name: 's4-zuidas', at: [4.8775, 52.3385], ...POSES.s4 }, { name: 'west-bos-en-lommer', at: [4.8530, 52.3780], ...POSES.s4, bearing: 270 },
      { name: 'sarphatipark-north', at: [4.8960, 52.3545], ...POSES.s4, bearing: 0 }, USER.chassebuurt, USER.amstelkanaal];
  fs.mkdirSync(shotsDir || 'artifacts/perf/aerial-spots', { recursive: true });
  const rows = [];
  await page.evaluate(() => { window.__aerialPause = true; const g = canalRecallGame; window.__aerialRideCam = { zoom: g.camera.zoom, tilt: g.vectorMap._cameraTilt }; });
  for (const spot of spots) {
    if (spot.street) await page.evaluate(v => {
      // A street chase pose: the rider stands at the eye facing the target, the chase camera at its ride zoom and tilt
      // (recorded before the first spot), so the world view keeps updating as on a ride.
      const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), cam = g.camera, p = g.player, r = v.bearing * Math.PI / 180;
      const px = ([lng, lat]) => [l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm];
      const eye = [v.target[0] + Math.sin(r) * v.distM / (111320 * Math.cos(v.target[1] * Math.PI / 180)), v.target[1] + Math.cos(r) * v.distM / 111320];
      const [ex, ey] = px(eye), [tx, ty] = px(v.target), ride = window.__aerialRideCam;
      p.x = ex; p.y = ey; p.angle = Math.atan2(ty - ey, tx - ex);
      cam.detached = false; cam.zoom = ride.zoom; g.vectorMap.setCameraTilt?.(ride.tilt); g.vectorMap._cameraTilt = ride.tilt;
    }, spot.street);
    else await page.evaluate(sp => {
      const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), cam = g.camera;
      const x = l._lastOffsetX + (sp.at[0] - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y = l._lastOffsetY - (sp.at[1] - l._lastCenterLat) * 111320 * ppm;
      cam.pan(1, 0); cam.detached = true; cam.anchorX = cam.x = x; cam.anchorY = cam.y = y; cam.zoom = sp.zoom; cam.rotation = sp.bearing * Math.PI / 180;
      g.vectorMap.setCameraTilt?.(sp.tilt); g.vectorMap._cameraTilt = sp.tilt;
    }, spot);
    await page.waitForTimeout(1500);
    await page.evaluate(async () => { const cam = canalRecallGame.vectorMap.camera; await Promise.race([cam?.whenIdle?.() ?? Promise.resolve(), new Promise(r => setTimeout(r, 60_000))]); });
    await page.waitForTimeout(Number(process.env.SPOT_SETTLE_MS ?? 4000)); // SPOT_SETTLE_MS: longer, for identity pairs
    const file = path.join(shotsDir || 'artifacts/perf/aerial-spots', `${device}-spot-${spot.name}.png`);
    if (['identity', 'chunkstreet', 'parked'].includes(process.env.SPOT_SET)) await page.evaluate(() => {
      // Only the 3D frame is compared: no labels, HUD or minimap (as look-consistency's quiet()).
      const vm = canalRecallGame.vectorMap, canvas = (vm.map ?? vm.cameraMap).getCanvas();
      vm.setLabelsVisible?.(false);
      for (const e of document.body.querySelectorAll('*')) if (e !== canvas && !e.contains(canvas)) e.style.visibility = 'hidden';
    });
    if (['identity', 'chunkstreet', 'parked'].includes(process.env.SPOT_SET)) await page.waitForTimeout(1500);
    await page.screenshot({ path: file });
    const overlap = await page.evaluate(() => { const vm = canalRecallGame.vectorMap, tb = vm._threeBuildings; const coarse = new Set([...(tb?.chunks?.keys?.() ?? [])].filter(k => k.startsWith('coarse:')).map(k => k.slice(7))); const near = [...(tb?.chunks?.keys?.() ?? [])].filter(k => k.startsWith('near:')).length; const shown = vm._farShells?.shownTiles?.() ?? []; const bc = vm._bakedCoarse; let farShownOverBaked = 0; for (const [key, r] of vm._farShells?.residents ?? []) if (bc?.drawn?.(key)) farShownOverBaked += r.parts.filter(p => !p.hidden).length; return { coarseTiles: coarse.size, nearChunks: near, farShown: shown.length, farShownOverCoarse: shown.filter(t => coarse.has(t)), farShownOverBaked, coarseSample: [...coarse].slice(0, 5) }; });
    rows.push({ spot: spot.name, file, overlap, ...(await residents(false)), landmarkDraws: await landmarkDraws() });
    if (rows.at(-1).landmarkDraws) console.log(`${device} spot ${spot.name} landmark draws ${JSON.stringify(rows.at(-1).landmarkDraws)}`);
    console.log(`${device} spot ${spot.name} overlap ${JSON.stringify(overlap)}`);
    console.log(`${device} spot ${spot.name}: z${rows.at(-1).zoom} p${rows.at(-1).pitch} labels ${JSON.stringify(rows.at(-1).labelsByKind)} aerial ${rows.at(-1).labelAerial}; ${file} lm ${rows.at(-1).landmarks} geo ${rows.at(-1).geometries} gl ${rows.at(-1).gl?.residentMB} MB draws ${rows.at(-1).draws} fs ${rows.at(-1).farShells?.cells ?? '-'}/${rows.at(-1).farShells?.partsShown ?? '-'} r${rows.at(-1).farRadiusM}`);
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ device, qs, spots: rows, errors }, null, 1));
  await browser.close();
  process.exit(0);
}

// --land (lane R3-G #242): pan from the air for --pan s, park at the S1 pose over Hoftuin with the rider moved there
// for 6 s, then drop to the settled chase pose (camera reattached, chase zoom and tilt) and time the detail
// block: `detailInstalls` and the resident `near:` chunks every 100 ms until 3 s pass with no install and nothing
// fading (or 30 s). SHOTS gets the landing frame at +0, +1, +2 s.
if (argv.includes('--land')) {
  const hoftuin = WAYPOINTS[1];
  await page.waitForTimeout(panS * 1000);
  const snap = () => page.evaluate(() => { const vm = canalRecallGame.vectorMap, tb = vm._threeBuildings; const keys = [...(tb?.chunks?.keys?.() ?? [])]; return { t: performance.now(), installs: tb?.detailInstalls ?? null, near: keys.filter(k => k.startsWith('near:')).length, nearDrawn: keys.filter(k => k.startsWith('near:') && tb.chunks.get(k)?.mesh).length, detailTiles: tb?.detailTiles?.size ?? null, fading: tb?.fading?.size ?? null, zoom: Math.round(vm.camera.zoom() * 10) / 10, pitch: Math.round(vm.camera.pitch()) }; });
  await page.evaluate(sp => {
    window.__aerialPause = true;
    const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), cam = g.camera;
    const x = l._lastOffsetX + (sp.at[0] - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y = l._lastOffsetY - (sp.at[1] - l._lastCenterLat) * 111320 * ppm;
    cam.detached = true; cam.anchorX = x; cam.anchorY = y; cam.zoom = sp.zoom; cam.rotation = sp.bearing * Math.PI / 180;
    g.vectorMap.setCameraTilt?.(sp.tilt); g.vectorMap._cameraTilt = sp.tilt;
    // The detail block follows the vehicle (view.subject is camera.targetX/Y), so the rider moves under the aerial
    // camera: a ride that rode on (or was moved) while the view was up. Landing then reattaches the camera to it.
    g.player.x = x; g.player.y = y;
  }, { at: hoftuin.at, ...POSES.s1 });
  const airStart = await snap();
  await page.waitForTimeout(6000);
  const airEnd = await snap();
  if (shotsDir) { fs.mkdirSync(shotsDir, { recursive: true }); await page.screenshot({ path: path.join(shotsDir, `${device}-land-air.png`) }); }
  await page.evaluate(() => { const rec = window.__canalRecallFramePhaseRecorder; if (rec) rec.worst.length = 0; });
  const l0 = await page.evaluate(() => { const g = canalRecallGame, p = window.__chasePose; g.camera.detached = false; g.camera.zoom = p.zoom; g.camera.rotation = p.rotation; if (p.tilt != null) { g.vectorMap.setCameraTilt?.(p.tilt); g.vectorMap._cameraTilt = p.tilt; } return performance.now(); });
  const samples = [];
  let lastInstallAt = l0, lastInstalls = null, shot = 0;
  for (;;) {
    const r = await snap();
    const dt = r.t - l0;
    if (lastInstalls !== null && r.installs !== lastInstalls) lastInstallAt = r.t;
    lastInstalls = r.installs;
    samples.push({ ...r, ms: Math.round(dt) });
    if (shotsDir && shot <= 2 && dt >= shot * 1000) { await page.screenshot({ path: path.join(shotsDir, `${device}-land-plus${shot}s.png`) }); shot++; }
    if ((r.t - lastInstallAt > 3000 && !r.fading && dt > 3000) || dt > 30_000) break;
    await page.waitForTimeout(100);
  }
  const frames = frameStats(await frameWindow(l0));
  const worst = await page.evaluate(() => { const rec = window.__canalRecallFramePhaseRecorder; return rec ? rec.worst.slice(0, 3).map(x => ({ ms: Math.round(x.ms), phases: Object.fromEntries(Object.entries(x.phases).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => [k, Math.round(v)])) })) : null; });
  const land = { worst, airInstalls: airEnd.installs - airStart.installs, landInstalls: samples.at(-1).installs - airEnd.installs, detailResidentMs: Math.round(lastInstallAt - l0), settledAtMs: samples.at(-1).ms, nearAtEnd: samples.at(-1).near, frames, airStart, airEnd };
  console.log(`${device} land ${JSON.stringify(land)}`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ device, qs, panS, land, samples, errors }, null, 1));
  await browser.close();
  process.exit(0);
}

// --trace <from>-<to> (lane R4-E #248): a Chrome trace (renderer + GPU process) from pan second <from> to <to>, written
// beside the output as <out>.trace.json: what the GPU process does in the long frames where the main thread is idle.
const traceArg = opt('trace', '');
const [traceFrom, traceTo] = traceArg ? traceArg.split('-').map(Number) : [null, null];
let tracing = null;
const traceChunks = [];
async function traceStart() {
  const c = await browser.newBrowserCDPSession();
  c.on('Tracing.dataCollected', e => { for (const ev of e.value) traceChunks.push(ev); });
  await c.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { recordMode: 'recordContinuously', includedCategories: ['toplevel', 'gpu', 'gpu.service', 'gpu.angle', 'viz', 'cc', 'blink', 'v8', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-gpu.service', 'disabled-by-default-gpu.decoder'] } });
  tracing = c;
}
async function traceStop() {
  const c = tracing; tracing = null;
  const done = new Promise(r => c.once('Tracing.tracingComplete', r));
  await c.send('Tracing.end'); await done;
  const file = out.replace(/\.json$/, '') + '.trace.json';
  fs.writeFileSync(file, JSON.stringify({ traceEvents: traceChunks }));
  console.log(`trace ${traceChunks.length} events -> ${file}`);
}
// --profile <from>-<to> (lane R4-E #248): a V8 CPU profile of the page's main thread over those pan seconds, written as
// <out>.cpuprofile (Profiler.start stalls ~1.7 s once; ignore that window's spike).
const profArg = opt('profile', '');
const [profFrom, profTo] = profArg ? profArg.split('-').map(Number) : [null, null];
let profiling = false;
const timeline = [];
const shots = [];
const baseInstalls = await page.evaluate(() => canalRecallGame.vectorMap._threeBuildings?.detailInstalls ?? null);
let lastPoseCount = 0;
let last = await page.evaluate(() => performance.now());
const panT0 = last;
for (let t = every; t <= panS; t += every) {
  const wait = last + every * 1000 - (await page.evaluate(() => performance.now()));
  if (traceFrom != null && !tracing && t - every >= traceFrom && t - every < traceTo) await traceStart();
  if (profFrom != null && !profiling && t - every >= profFrom && t - every < profTo) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); profiling = true; }
  if (wait > 0) await page.waitForTimeout(wait);
  if (tracing && t >= traceTo) await traceStop();
  if (profiling && t >= profTo) { const { profile } = await cdp.send('Profiler.stop'); profiling = false; const file = out.replace(/\.json$/, '') + '.cpuprofile'; fs.writeFileSync(file, JSON.stringify(profile)); console.log(`profile -> ${file}`); }
  const long = await longFrames(last, timeline.length ? last : null);
  const frames = frameStats(await frameWindow(last));
  const worst = await page.evaluate(() => {
    const rec = window.__canalRecallFramePhaseRecorder; if (!rec) return null;
    const w = rec.worst.slice(0, 3).map(x => ({ ms: Math.round(x.ms), phases: Object.fromEntries(Object.entries(x.phases).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => [k, Math.round(v)])) }));
    rec.worst.length = 0; return w;
  });
  // The window's long animation frames: count over 100 ms, main-thread script time in them by script, and the
  // part of those frames before rendering (tasks) vs rendering (rAF callbacks, style, paint, GPU submit).
  const loaf = await page.evaluate(from => {
    // Trimmed in place: the observer pushes into this same array (reassigning it left every window after the first
    // with no LoAF entries; lane R4-E #248 found R3-F's "0-4 main-thread frames > 100 ms" read was that).
    const L = window.__aerialLoaf ?? [], mine = L.filter(e => e.start >= from);
    { const k = L.findIndex(e => e.start >= from - 1000); L.splice(0, k < 0 ? L.length : k); }
    const over = mine.filter(e => e.duration > 100), by = {};
    let scriptMs = 0, renderMs = 0, durMs = 0;
    for (const e of over) {
      durMs += e.duration; renderMs += e.renderStart ? e.duration - (e.renderStart - e.start) : 0;
      for (const sc of e.scripts) { const k = `${sc.type}:${sc.invoker.slice(0, 60)} ${sc.fn || '?'}@${sc.url}:${sc.char}`; by[k] = (by[k] ?? 0) + sc.duration; scriptMs += sc.duration; }
    }
    return { over50: mine.length, over100: over.length, over100Ms: Math.round(durMs), over100ScriptMs: Math.round(scriptMs), over100RenderMs: Math.round(renderMs),
      topScripts: Object.fromEntries(Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 6)) };
  }, last);
  const a = await page.evaluate(() => { window.__aerialPause = true; return performance.now(); });
  const heap = await heapSample(cdp);
  const res = await residents(censusOn);
  res.drawKinds = await drawKinds();
  const rss = await processRss();
  const aerial = await page.evaluate(() => ({ routeM: Math.round(window.__aerial.s / (0, eval)('PIXELS_PER_METER')), laps: window.__aerial.laps, km: Math.round((window.__aerial.laps * window.__aerial.totalM + window.__aerial.s / 3) / 100) / 10, poses: window.__aerial.poseChanges.length, leg: window.__aerial.poseChanges.at(-1)?.to }));
  // SHOT_AT=80,120 (lane R4-E #248): also a frame at these pan seconds (mid-arrival strips).
  if (shotsDir && (process.env.SHOT_AT ?? '').split(',').map(Number).includes(t)) { fs.mkdirSync(shotsDir, { recursive: true }); const file = path.join(shotsDir, `${device}-t${t}-at.png`); await page.screenshot({ path: file }); shots.push(file); }
  if (shotsDir && aerial.poses !== lastPoseCount) {
    fs.mkdirSync(shotsDir, { recursive: true });
    const file = path.join(shotsDir, `${device}-t${t}-${aerial.leg}.png`);
    await page.screenshot({ path: file }); shots.push(file); lastPoseCount = aerial.poses;
  }
  const b = await page.evaluate(() => { window.__aerialPause = false; return performance.now(); });
  await page.evaluate(([a, b]) => window.__aerialFrames.skip.push([a, b + 50]), [a, b]);
  last = b + 50;
  // Per-sample deltas: detail chunks installed and MB uploaded to the GPU since the previous sample.
  res.detailInstalls = res.detailInstallsTotal == null ? null : res.detailInstallsTotal - (timeline.at(-1)?.detailInstallsTotal ?? baseInstalls ?? 0);
  res.coarseFadeIns = res.coarseFadeInsTotal - (timeline.at(-1)?.coarseFadeInsTotal ?? res.coarseFadeInsTotal);
  res.uploadMBDelta = res.gl?.uploadMB == null ? null : res.gl.uploadMB - (timeline.at(-1)?.gl?.uploadMB ?? 0);
  const row = { t, at: Math.round(a), pauseMs: Math.round(b + 50 - a), ...aerial, heapMB: heap.main.usedMB, bufMB: heap.main.backingMB, workersMB: heap.workersUsedMB, ...rss, ...res, frames, worst, loaf, long };
  for (const f of long) console.log(`${device}   long ${f.ms} ms (cb ${f.cbMs}, outside ${f.outside}) leg ${f.leg} +${f.legS}s resume +${f.sinceResumeS}s v${f.speedMps ?? '-'} gl ${f.glMB} MB ${f.compiles} compiles ${JSON.stringify(f.glOwners)} ${JSON.stringify(f.split)}${f.scripts.length ? ` scripts ${f.scripts.join(' | ')}` : ''}`);
  timeline.push(row);
  console.log(`${device} t${t} ${aerial.leg ?? '-'} z${res.zoom} p${res.pitch}: heap ${heap.main.usedMB}+${heap.main.backingMB ?? '?'} MB, wk ${heap.workersUsedMB} MB, rss ${rss.rendererRssMB}/${rss.gpuRssMB}, geo ${res.geometries} tex ${res.textures} gl ${res.gl?.residentMB} MB (+${res.gl?.uploadMB} MB up), chunks ${res.chunks} tiles ${res.cityTiles} feats ${res.cityFeatures} ctxCh ${res.contextChanges} lm ${res.landmarks} trees ${res.trees} ground ${res.groundCells} far ${res.farRing} r${res.farRadiusM} fs ${res.farShells?.cells ?? '-'}/${res.farShells?.partsShown ?? '-'} draws ${res.draws} bc ${res.bakedCoarse ? `${res.bakedCoarse.drawn}/${res.bakedCoarse.cells}` : '-'} cc ${res.coarseChunks} labels ${res.labelsPlaced} wkrs ${res.workers} detail +${res.detailInstalls} (${res.detailTiles} tiles, ${res.detailMB} MB) fading ${res.fading} coarse fading ${res.coarseFading} (+${res.coarseFadeIns}) up +${res.uploadMBDelta} MB; p99 ${frames.p99} >100 ${frames.over100} >250 ${frames.over250} max ${frames.longestMs}${worst?.[0] ? ` worst ${JSON.stringify(worst[0].phases)}` : ''}`);
}

// Gates: minute 1 is the reference (the sweep has reached every district once by then at the default speed).
const at = s => timeline.reduce((best, r) => (Math.abs(r.t - s) < Math.abs(best.t - s) ? r : best), timeline[0]);
const m1 = at(60), m3 = timeline[timeline.length - 1];
const allFrames = timeline.map(r => r.frames);
const growth = (a, b) => (a && b != null ? Math.round((b - a) / a * 1000) / 10 : null);
// Growth compares the peak of the last minute with the peak of the first: a sample sits wherever the sweep happens to
// be (the West leg holds twice the Dam's geometry), so single samples at t60 and t180 compare different districts.
const peak = (get, a, b) => Math.max(0, ...timeline.filter(r => r.t > a && r.t <= b).map(r => get(r) ?? 0));
const lastT = timeline[timeline.length - 1].t;
const first = (get) => peak(get, 0, 60), final = (get) => peak(get, lastT - 60, lastT);
const summary = {
  minute1: { t: m1.t, heapMB: m1.heapMB, geometries: m1.geometries, textures: m1.textures, glMB: m1.gl?.residentMB ?? null },
  end: { t: m3.t, heapMB: m3.heapMB, geometries: m3.geometries, textures: m3.textures, glMB: m3.gl?.residentMB ?? null },
  aerialHeapGrowthPct: growth(first(r => r.heapMB), final(r => r.heapMB)),
  aerialGeometriesGrowthPct: growth(first(r => r.geometries), final(r => r.geometries)),
  aerialTexturesGrowthPct: growth(first(r => r.textures), final(r => r.textures)),
  aerialGlMBGrowthPct: growth(first(r => r.gl?.residentMB), final(r => r.gl?.residentMB)),
  aerialLandmarksMax: Math.max(...timeline.map(r => r.landmarks ?? 0)),
  // Lane R4-A (#243): the coarse rebuild wave over the pan (coarse dissolves after the first sample; most at once).
  coarseFadeIns: (m3.coarseFadeInsTotal ?? 0) - (timeline[0]?.coarseFadeInsTotal ?? 0),
  coarseFadingMax: Math.max(...timeline.map(r => r.coarseFading ?? 0)),
  coarseFadingSamples: timeline.filter(r => r.coarseFading > 0).length,
  aerialUploadGB: Math.round((m3.gl?.uploadMB ?? 0) / 102.4) / 10,
  aerialGeometriesMax: Math.max(...timeline.map(r => r.geometries ?? 0)),
  aerialTexturesMax: Math.max(...timeline.map(r => r.textures ?? 0)),
  aerialHeapMaxMB: Math.max(...timeline.map(r => r.heapMB ?? 0)),
  aerialGlMaxMB: Math.max(...timeline.map(r => r.gl?.residentMB ?? 0)),
  // Lane R4-G (#250): the same peak with each texel at its format's size (R8 masks 1 byte, not 4; glCounters texelBytes).
  aerialGlDecodedMaxMB: Math.max(...timeline.map(r => r.gl?.decodedMB ?? 0)),
  // Lane R4-H (#252): the most ordinary installs drawn at each level in any sample.
  ordinaryLevelsMax: ['full', 'lod1', 'lod2'].reduce((o, k) => ({ ...o, [k]: Math.max(0, ...timeline.map(r => r.ordinaryLevels?.[k] ?? 0)) }), {}),
  aerialP99Ms: Math.max(...allFrames.map(f => f.p99)),
  aerialP99MedianWindowMs: pickQ(allFrames.map(f => f.p99), 0.5),
  aerialFramesOver100Ms: allFrames.reduce((a, f) => a + f.over100, 0),
  aerialFramesOver250Ms: allFrames.reduce((a, f) => a + f.over250, 0),
  aerialDrawsMax: Math.max(...timeline.map(r => r.draws ?? 0)),
  aerialFarRadiusMax: Math.max(...timeline.map(r => r.farRadiusM ?? 0)),
  farShellCellsMax: Math.max(...timeline.map(r => r.farShells?.cells ?? 0)),
  farShellMBMax: Math.max(...timeline.map(r => r.farShells?.gpuMB ?? 0)),
  farShellFetchedMB: Math.max(...timeline.map(r => r.farShells?.fetchedMB ?? 0)),
  // The slowest label phase in any window's worst frames (labels: occlusion index / placement, engine/overlays).
  labelsWorstMs: Math.max(0, ...timeline.flatMap(r => (r.worst ?? []).flatMap(w => Object.entries(w.phases).filter(([k]) => /label/i.test(k)).map(([, v]) => v)))),
  labelCandidatesMax: Math.max(0, ...timeline.map(r => r.labelCandidates ?? 0)),
  aerialLongestFrameMs: Math.max(...allFrames.map(f => f.longestMs)),
  km: m3.km,
};
// Lane R4-I (#253): the baked cells' bytes by attribute and distance band at the GL peak sample and at the sample where
// the baked tier itself held the most, plus the baked-coarse owner row's peak (glCounters).
{
  const glPeak = timeline.reduce((b, r) => ((r.gl?.residentMB ?? 0) > (b.gl?.residentMB ?? 0) ? r : b), timeline[0]);
  const bakedPeak = timeline.reduce((b, r) => ((r.bakedAttr?.mb?.total ?? 0) > (b.bakedAttr?.mb?.total ?? 0) ? r : b), timeline[0]);
  const bakedOwner = r => r.bakedOwnerMB ?? 0;
  summary.bakedAttrAtGlPeak = glPeak?.bakedAttr ? { t: glPeak.t, leg: glPeak.leg ?? null, ...glPeak.bakedAttr } : null;
  summary.bakedAttrAtBakedPeak = bakedPeak?.bakedAttr ? { t: bakedPeak.t, leg: bakedPeak.leg ?? null, ...bakedPeak.bakedAttr } : null;
  summary.bakedOwnerMBAtGlPeak = Math.round(bakedOwner(glPeak) * 10) / 10;
  summary.bakedOwnerMBMax = Math.round(Math.max(0, ...timeline.map(bakedOwner)) * 10) / 10;
}
// Lane R4-E (#248): where the long frames are and what owns them. `outside` dominates when the interval is mostly spent
// outside the engine's frame callback (loading tasks, GC, GPU back-pressure); `callback` when inside it, then by its
// largest top-level phase. `nearLegStart`: within 5 s of a leg's start; `nearResume`: within 1 s of a sample's pause.
{
  const L = timeline.flatMap(r => r.long ?? []);
  const owner = f => {
    if (f.outside >= f.cbMs) return 'outside';
    const [k] = Object.entries(f.split).sort((a, b) => b[1] - a[1])[0] ?? ['?'];
    return `callback:${k}`;
  };
  summary.longFrames = L.length;
  summary.longFramesByOwner = L.reduce((o, f) => { const k = owner(f); o[k] = (o[k] ?? 0) + 1; return o; }, {});
  summary.longFramesNearLegStart = L.filter(f => f.legS != null && f.legS < 5).length;
  summary.longFramesNearResume = L.filter(f => f.sinceResumeS != null && f.sinceResumeS < 1).length;
  summary.longFramesByLeg = L.reduce((o, f) => { o[f.leg ?? '-'] = (o[f.leg ?? '-'] ?? 0) + 1; return o; }, {});
}
// Who uploaded: the large uploads (glCounters.ts, >= its largeBytes) since warm-up, MB by owner.
summary.uploadBytesByOwnerMB = await page.evaluate(() => Object.fromEntries(Object.entries(window.__uploadByOwner ?? {}).map(([k, v]) => [k.slice(0, 90), { n: v.n, MB: Math.round(v.MB) }]).sort((a, b) => b[1].MB - a[1].MB).slice(0, 25)));
summary.uploadOwnersMB = await page.evaluate(() => {
  const rep = window.__canalPerf?.gl?.report?.(); if (!rep) return null;
  const by = {};
  for (const e of rep.largeUploads) { const k = String(e.owner).replace(/:\d+(:\d+)?\)?$/, '').split('/').pop().slice(0, 80); by[k] = (by[k] ?? 0) + e.bytes; }
  return Object.fromEntries(Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => [k, Math.round(v / 1048576)]));
}).catch(() => null);
let ringSeries = null, treeRebuilds = null;
// Lane R4-F (#249): the ring-size timeline (cells held / wanted every 250 ms from the pan's start) and its steps: the
// largest rise of the held ring within one second, and how many seconds saw a rise of more than RING_STEP cells.
{
  const series = await page.evaluate(() => window.__ringSeries ?? []).catch(() => []);
  const rows = series.filter(r => r[0] >= panT0).map(([t, held, full]) => [Math.round((t - panT0) / 100) / 10, held, full]);
  let maxRise = 0, stepSeconds = 0;
  for (let i = 0, j = 0; i < rows.length; i++) {
    while (rows[i][0] - rows[j][0] > 1) j++;
    const rise = (rows[i][1] ?? 0) - Math.min(...rows.slice(j, i + 1).map(r => r[1] ?? 0));
    maxRise = Math.max(maxRise, rise);
  }
  for (let s = 0; s < (rows.at(-1)?.[0] ?? 0); s++) {
    const w = rows.filter(r => r[0] >= s && r[0] < s + 1).map(r => r[1] ?? 0);
    if (w.length && Math.max(...w) - Math.min(...w) > 12) stepSeconds++;
  }
  summary.ringHeldMax = Math.max(0, ...rows.map(r => r[1] ?? 0));
  summary.ringWantedMax = Math.max(0, ...rows.map(r => r[2] ?? 0));
  summary.ringMaxRisePerSecond = maxRise;
  summary.ringStepSeconds = stepSeconds;
  ringSeries = rows;
  const trees = (await page.evaluate(() => window.__treeRebuilds ?? []).catch(() => [])).filter(r => r[0] >= panT0);
  const ms = trees.map(r => r[1]);
  summary.treeRebuilds = ms.length;
  summary.treeRebuildMedianMs = ms.length ? pickQ(ms, 0.5) : null;
  summary.treeRebuildP90Ms = ms.length ? pickQ(ms, 0.9) : null;
  summary.treeRebuildMaxMs = ms.length ? Math.max(...ms) : null;
  treeRebuilds = trees.map(([t, m, n]) => [Math.round((t - panT0) / 100) / 10, m, n]);
}
// Lane R4-J (#254): the atlas switch over the pan: drops, restores, soft frames (must be 0), the slowest slice, and the
// per-frame level-floor curve ([t ms since the pan's start, eye m, floor, nearest-chunk estimate, mode, aerial]).
let atlasCurve = null;
{
  const st = await page.evaluate(() => { const sw = window.__canalRecallAtlasAerialSwitch; return sw ? sw.stats : null; }).catch(() => null);
  if (st) {
    const { curve, ...rest } = st;
    summary.atlasAerial = rest;
    atlasCurve = curve.filter(r => r[0] >= panT0).map(([t, ...r]) => [Math.round((t - panT0) / 100) / 10, ...r]);
  }
}
console.log(JSON.stringify(summary));
// The legs' start times and the pan's start (performance.now): the timeline chart marks the legs against `long[].at`.
const legStarts = await page.evaluate(() => window.__aerial.poseChanges).catch(() => null);
const result = { panT0: Math.round(panT0), legStarts, device, qs, panS, every, speed, continuous, dwellS: continuous ? dwellS : null, accelS: continuous ? accelS : null, chrome: useChrome, headed, settleMs, loadS: Math.round((Date.now() - t0) / 1000), bundles: process.env.BUNDLES_DIR ?? null, waypoints: WAYPOINTS, poses: POSES, timeline, ringSeries, treeRebuilds, atlasCurve, summary, shots, errors };
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 1));
await browser.close();
