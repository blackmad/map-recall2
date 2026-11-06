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
//     [--qs '?ride=free&engine=own'] [--chrome] [--headed] [--census]
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
const speed = Number(opt('speed', '300'));
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
  const tick = now => { F.t.push(now); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
});
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
const cdp = await context.newCDPSession(page);
const qs = `?ride=free&engine=own&framePhases=1${extraQs ? `&${extraQs.replace(/^\?/, '')}` : ''}`;
const t0 = Date.now();
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


// The pan driver: a rAF loop that moves the detached camera's anchor along the waypoints at `speed` m/s and eases the
// zoom, tilt and bearing toward each leg's pose. `window.__aerialPause` holds it still while a sample runs.
await page.evaluate(([wps, poses, v]) => {
  const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), cam = g.camera, vm = g.vectorMap;
  const world = ([lng, lat]) => ({ x: l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y: l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm });
  const pts = wps.map(w => ({ ...w, p: world(w.at) }));
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].p.x - pts[i - 1].p.x, pts[i].p.y - pts[i - 1].p.y));
  const total = cum[cum.length - 1];
  const A = window.__aerial = { s: 0, laps: 0, leg: 0, poseChanges: [], totalM: Math.round(total / ppm) };
  cam.pan(1, 0);
  let last = performance.now(), tilt = 0;
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
}, [WAYPOINTS, POSES, speed]);

const pickQ = (v, q) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };
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
    gl: (() => { const rep = window.__canalPerf?.gl?.report?.(); return rep ? { residentMB: rep.resident.totalMB, bufferMB: rep.resident.bufferMB, textureMB: rep.resident.textureMB, buffers: rep.resident.buffers, textures: rep.resident.textures, uploadMB: Math.round(rep.sinceWarm.uploadBytes / 1048576), uploads: rep.sinceWarm.uploads, compiles: rep.sinceWarm.compiles } : null; })(),
    chunks: size(tb?.chunks), chunkKinds: kinds, fading: size(tb?.fading),
    cityTiles: size(city?.cache?.tiles), cityFeatures: size(city?.cache?.list), cityRing: size(city?.ring), worldInterned: size(city?.world?.interned),
    contextFeatures: size(tb?.contextFeatures), contextChanges: size(tb?.contextChanges), contextCache: size(tb?.contextCache), pendingJobs: size(tb?.pending?.jobs),
    landmarks: size(sig?._entries), landmarksShown: size(sig?.shown), roofs: size(vm.extras?.roofs?._entries),
    trees: size(trees?.tiles), groundCells: size(ground?.resident), groundPrepared: size(ground?.prepared), farRing: size(ground?.far),
    labelsPlaced: size(vm._labels?.placed), labelCandidates: vm._labels?.stats?.candidates ?? null, labelAerial: vm.labelAerial ?? null, occlusionIndexed: size(vm.labelOcclusion?.indexed),
    // Draw calls and triangles of the last main + overlay pass (sharedFrame stats), the own ground's far radius, the far
    // tier's resident cells / MB / draws (engine/farShells.ts, lane R2-B #229).
    draws: (vm._sharedFrame?.stats?.main?.calls ?? 0) + (vm._sharedFrame?.stats?.overlay?.calls ?? 0), drawTriangles: (vm._sharedFrame?.stats?.main?.triangles ?? 0) + (vm._sharedFrame?.stats?.overlay?.triangles ?? 0),
    farRadiusM: ground?.farRadius ?? null, farShells: vm._farShells?.stats?.() ?? null,
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
  const spots = [{ name: 's1-hoftuin', at: [4.9065, 52.3655], ...POSES.s1 }, { name: 's4-zuidas', at: [4.8775, 52.3385], ...POSES.s4 }];
  fs.mkdirSync(shotsDir || 'artifacts/perf/aerial-spots', { recursive: true });
  const rows = [];
  await page.evaluate(() => { window.__aerialPause = true; });
  for (const spot of spots) {
    await page.evaluate(sp => {
      const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), cam = g.camera;
      const x = l._lastOffsetX + (sp.at[0] - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y = l._lastOffsetY - (sp.at[1] - l._lastCenterLat) * 111320 * ppm;
      cam.pan(1, 0); cam.detached = true; cam.anchorX = cam.x = x; cam.anchorY = cam.y = y; cam.zoom = sp.zoom; cam.rotation = sp.bearing * Math.PI / 180;
      g.vectorMap.setCameraTilt?.(sp.tilt); g.vectorMap._cameraTilt = sp.tilt;
    }, spot);
    await page.waitForTimeout(1500);
    await page.evaluate(async () => { const cam = canalRecallGame.vectorMap.camera; await Promise.race([cam?.whenIdle?.() ?? Promise.resolve(), new Promise(r => setTimeout(r, 60_000))]); });
    await page.waitForTimeout(4000);
    const file = path.join(shotsDir || 'artifacts/perf/aerial-spots', `${device}-spot-${spot.name}.png`);
    await page.screenshot({ path: file });
    rows.push({ spot: spot.name, file, ...(await residents(false)) });
    console.log(`${device} spot ${spot.name}: ${file} lm ${rows.at(-1).landmarks} geo ${rows.at(-1).geometries} gl ${rows.at(-1).gl?.residentMB} MB`);
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ device, qs, spots: rows, errors }, null, 1));
  await browser.close();
  process.exit(0);
}

const timeline = [];
const shots = [];
let lastPoseCount = 0;
let last = await page.evaluate(() => performance.now());
const panT0 = last;
for (let t = every; t <= panS; t += every) {
  const wait = last + every * 1000 - (await page.evaluate(() => performance.now()));
  if (wait > 0) await page.waitForTimeout(wait);
  const frames = frameStats(await frameWindow(last));
  const worst = await page.evaluate(() => {
    const rec = window.__canalRecallFramePhaseRecorder; if (!rec) return null;
    const w = rec.worst.slice(0, 3).map(x => ({ ms: Math.round(x.ms), phases: Object.fromEntries(Object.entries(x.phases).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => [k, Math.round(v)])) }));
    rec.worst.length = 0; return w;
  });
  const a = await page.evaluate(() => { window.__aerialPause = true; return performance.now(); });
  const heap = await heapSample(cdp);
  const res = await residents(censusOn);
  const rss = await processRss();
  const aerial = await page.evaluate(() => ({ laps: window.__aerial.laps, km: Math.round((window.__aerial.laps * window.__aerial.totalM + window.__aerial.s / 3) / 100) / 10, poses: window.__aerial.poseChanges.length, leg: window.__aerial.poseChanges.at(-1)?.to }));
  if (shotsDir && aerial.poses !== lastPoseCount) {
    fs.mkdirSync(shotsDir, { recursive: true });
    const file = path.join(shotsDir, `${device}-t${t}-${aerial.leg}.png`);
    await page.screenshot({ path: file }); shots.push(file); lastPoseCount = aerial.poses;
  }
  const b = await page.evaluate(() => { window.__aerialPause = false; return performance.now(); });
  await page.evaluate(([a, b]) => window.__aerialFrames.skip.push([a, b + 50]), [a, b]);
  last = b + 50;
  const row = { t, ...aerial, heapMB: heap.main.usedMB, bufMB: heap.main.backingMB, workersMB: heap.workersUsedMB, ...rss, ...res, frames, worst };
  timeline.push(row);
  console.log(`${device} t${t} ${aerial.leg ?? '-'} z${res.zoom} p${res.pitch}: heap ${heap.main.usedMB}+${heap.main.backingMB ?? '?'} MB, wk ${heap.workersUsedMB} MB, rss ${rss.rendererRssMB}/${rss.gpuRssMB}, geo ${res.geometries} tex ${res.textures} gl ${res.gl?.residentMB} MB (+${res.gl?.uploadMB} MB up), chunks ${res.chunks} tiles ${res.cityTiles} feats ${res.cityFeatures} ctxCh ${res.contextChanges} lm ${res.landmarks} trees ${res.trees} ground ${res.groundCells} far ${res.farRing} r${res.farRadiusM} fs ${res.farShells?.cells ?? '-'}/${res.farShells?.partsShown ?? '-'} draws ${res.draws} labels ${res.labelsPlaced} wkrs ${res.workers}; p99 ${frames.p99} >100 ${frames.over100} >250 ${frames.over250} max ${frames.longestMs}${worst?.[0] ? ` worst ${JSON.stringify(worst[0].phases)}` : ''}`);
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
  aerialUploadGB: Math.round((m3.gl?.uploadMB ?? 0) / 102.4) / 10,
  aerialGeometriesMax: Math.max(...timeline.map(r => r.geometries ?? 0)),
  aerialTexturesMax: Math.max(...timeline.map(r => r.textures ?? 0)),
  aerialHeapMaxMB: Math.max(...timeline.map(r => r.heapMB ?? 0)),
  aerialGlMaxMB: Math.max(...timeline.map(r => r.gl?.residentMB ?? 0)),
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
// Who uploaded: the large uploads (glCounters.ts, >= its largeBytes) since warm-up, MB by owner.
summary.uploadOwnersMB = await page.evaluate(() => {
  const rep = window.__canalPerf?.gl?.report?.(); if (!rep) return null;
  const by = {};
  for (const e of rep.largeUploads) { const k = String(e.owner).replace(/:\d+(:\d+)?\)?$/, '').split('/').pop().slice(0, 80); by[k] = (by[k] ?? 0) + e.bytes; }
  return Object.fromEntries(Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => [k, Math.round(v / 1048576)]));
}).catch(() => null);
console.log(JSON.stringify(summary));
const result = { device, qs, panS, every, speed, chrome: useChrome, headed, settleMs, loadS: Math.round((Date.now() - t0) / 1000), bundles: process.env.BUNDLES_DIR ?? null, waypoints: WAYPOINTS, poses: POSES, timeline, summary, shots, errors };
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 1));
await browser.close();
void panT0;
