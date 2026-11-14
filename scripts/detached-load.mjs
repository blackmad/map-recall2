// Detached-camera load (feedback 748b1a8f, 2026-11-14: "why do chunks of the city sometimes take so long to load? are
// we doing anything to prioritize a load that's on screen / cancel ones that are off?"). Free Ride on the own engine,
// the rider parked at the note's pose (Kinkerbuurt, looking ENE), the world settled; then the camera is detached and
// jumped --pan metres (default 800) along the view direction, as a trackpad drag does through Camera.pan, and held.
//
// Recorded from the jump on:
//  - every building chunk build (request, start in a worker, done, installed), every baked coarse cell (request,
//    installed), every complete-city tile (requested, resident) and every world cell read (start, done), each tagged
//    with whether it overlapped the screen when it was asked for and in the final view;
//  - every --every ms (default 200), the share of the final view's on-screen buildings that draw (any tier), overall
//    and in the bottom half of the screen (the near ground, largest on screen).
// The final view is the settled frame (worldSettled, or --hold s). Reported: time to 50/90/100 % of the on-screen
// buildings drawn, and the work spent on chunks/cells/tiles that are off screen in the final view.
//
//   PORT=4453 node scripts/detached-load.mjs <out.json> [--pan 800] [--side 0] [--hold 60] [--qs '...'] [--look photo]
// Run through the browser queue: /tmp/canal-pw.sh node scripts/detached-load.mjs ...
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const out = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'artifacts/perf/detached-load.json';
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const panM = Number(opt('pan', '800'));
const sideM = Number(opt('side', '0'));
const holdS = Number(opt('hold', '60'));
const everyMs = Number(opt('every', '200'));
const extraQs = opt('qs', '');
// --drag <m/s>: drag the camera there at this speed (0: jump). Fill times count from the end of the drag.
const dragSpeed = Number(opt('drag', '0'));
// --note: the feedback note's own camera offset from the rider (748b1a8f: camera - player = 3216, -2133 game px, i.e.
// 1,072 m east and 711 m north at 3 px/m, 1.29 km; the earlier "3.9 km" read the px as metres). Overrides --pan/--side.
const noteOffset = argv.includes('--note') ? [-4009.536989249451 - -7225.5288260432935, -6045.270088931345 - -3912.532768026519] : null;
// --legs "e,n;e,n;...": a wander, metres east/north of the rider, dragged in turn at --drag m/s (default 300); the
// fill is timed from the end of the last leg. Ends at the note's camera with --note as the last leg.
const legsArg = opt('legs', '');
const legs = legsArg ? legsArg.split(';').map(l => l.split(',').map(Number)).map(([e, n]) => [e * 3, -n * 3]) : null;
if (legs && noteOffset) legs.push(noteOffset);
// --shots <dir>: pass 2 screenshots at 0.5, 1, 2, 4, 8, 16 s after the move and at the end.
const shotsDir = opt('shots', '');
// --latency <ms> --mbps <n>: the network as the deployed site sees it (CDP emulation on every page; 0: local speed).
const latencyMs = Number(opt('latency', '0')), mbps = Number(opt('mbps', '0'));
const throttle = async p => {
  if (!latencyMs && !mbps) return;
  const cdp = await p.context().newCDPSession(p);
  const bps = mbps > 0 ? mbps * 1e6 / 8 : -1;
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: latencyMs, downloadThroughput: bps, uploadThroughput: bps });
};
const look = opt('look', '');
const origin = process.env.ORIGIN || `http://127.0.0.1:${process.env.PORT || 4453}`;
// The game's path: /canal-drive/ on the dev server, /ride on the deployed site (Firebase rewrites /ride to ride.html).
const gamePath = process.env.GAME_PATH || (process.env.ORIGIN ? '/ride' : '/canal-drive/');
// --trace <file>: a Chrome performance trace of pass 2's pan (from the move to fill or --trace-s seconds).
const traceOut = opt('trace', '');
const traceS = Number(opt('trace-s', '20'));
// Every finished request of pass 2 after the move: url, size, timing phases and cache headers (CDN hit/miss, age).
const netLog = [];
let netT0 = null;
const watchNet = p => {
  const onDone = async (req, failed) => {
    if (netT0 == null) return;
    const url = req.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    const t = req.timing();
    let res = null; try { res = await req.response(); } catch { /* */ }
    const h = res ? await res.allHeaders().catch(() => ({})) : {};
    let size = null; try { size = (await req.sizes()).responseBodySize; } catch { /* */ }
    netLog.push({ url: url.replace(origin, ''), status: res?.status() ?? null, failed: failed || null, fromCache: res ? (await res.fromServiceWorker?.()) || null : null,
      start: Math.round(t.startTime - netT0), dns: t.domainLookupEnd >= 0 ? Math.round(t.domainLookupEnd - t.domainLookupStart) : null,
      connect: t.connectEnd >= 0 ? Math.round(t.connectEnd - t.connectStart) : null,
      ttfb: t.responseStart >= 0 ? Math.round(t.responseStart - Math.max(0, t.requestStart)) : null,
      queued: t.requestStart >= 0 ? Math.round(t.requestStart) : null,
      total: t.responseEnd >= 0 ? Math.round(t.responseEnd) : null, size,
      cc: h['cache-control'] ?? null, xcache: h['x-cache'] ?? null, age: h['age'] ?? null, enc: h['content-encoding'] ?? null });
  };
  p.on('requestfinished', r => onDone(r, null));
  p.on('requestfailed', r => onDone(r, r.failure()?.errorText ?? 'failed'));
};
// The note's rider pose (player x/y/angle) and camera zoom; tilt 15 (pitch 75) as in its context.world.
// The note's x/y are in its ride's loader frame; the rider is placed by lng/lat (the note's camera centre less the
// camera-to-player offset at 3 px/m: 4.864062, 52.367576, Kinkerbuurt by the Bilderdijkkade).
const POSE = { lngLat: [4.864062, 52.367576], angle: -0.39889684834280237, zoom: 0.65, tilt: 15 };

// --chrome: the installed Chrome on the Metal GPU (headless Chromium renders on SwiftShader: seconds a frame at dpr 2).
const useChrome = argv.includes('--chrome');
const browser = await chromium.launch({
  headless: !argv.includes('--headed'),
  args: ['--enable-precise-memory-info', '--host-resolver-rules=MAP *.ingest.sentry.io 127.0.0.1, MAP *.ingest.us.sentry.io 127.0.0.1, MAP *.ingest.de.sentry.io 127.0.0.1', ...(useChrome ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : [])],
  ...(useChrome ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}),
});
const [vw, vh] = (process.env.VIEWPORT || '1326x761').split('x').map(Number);
const context = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: Number(process.env.DPR || 2) });
// No context.route: a routed context runs with the HTTP cache off (duplicate downloads); Sentry is resolved away above.
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
const MOVER = () => {
  let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  // Detach the camera and take its anchor `panM` ahead along the view and `sideM` to its right: at once (speed 0), or
  // dragged there at `speed` m/s (a trackpad drag moves the anchor through Camera.pan; the eased camera follows).
  window.__moveCam = (panM, sideM, speed, offsetPx) => new Promise(resolve => {
    const g = canalRecallGame, c = g.camera, ppm = (0, eval)('PIXELS_PER_METER'), rot = c.rotation;
    const fwd = [Math.sin(rot), -Math.cos(rot)], right = [Math.cos(rot), Math.sin(rot)];
    c.pan(0.0001, 0);
    let x0 = c.x, y0 = c.y, dx = (fwd[0] * panM + right[0] * sideM) * ppm, dy = (fwd[1] * panM + right[1] * sideM) * ppm;
    if (offsetPx) { dx = g.player.x + offsetPx[0] - x0; dy = g.player.y + offsetPx[1] - y0; }
    const total = Math.hypot(dx, dy) / ppm;
    if (!(speed > 0)) { c.anchorX = c.x = x0 + dx; c.anchorY = c.y = y0 + dy; resolve(); return; }
    const t0 = performance.now();
    const step = () => {
      const f = Math.min(1, (performance.now() - t0) / 1000 * speed / total);
      c.anchorX = x0 + dx * f; c.anchorY = y0 + dy * f;
      if (f < 1) requestAnimationFrame(step); else { c.x = c.anchorX; c.y = c.anchorY; resolve(); }
    };
    requestAnimationFrame(step);
  });
};
await page.addInitScript(MOVER);
const MOVE = async (pg, extra = '') => pg.evaluate(async ([panM, sideM, speed, off, legs]) => {
  if (legs) { for (const l of legs) await window.__moveCam(0, 0, speed || 300, l); return; }
  await window.__moveCam(panM, sideM, speed, off);
}, [panM, sideM, dragSpeed, noteOffset, legs]);
const qs = `?ride=free&engine=own${look ? `&buildings3d=${look}` : ''}${extraQs ? `&${extraQs.replace(/^\?/, '')}` : ''}`;
await throttle(page);
await page.goto(`${origin}${gamePath}${qs}`);
await page.waitForFunction(() => window.canalRecallGame?.state === 4 && window.canalRecallGame.camera?.introOverview === 0 && window.canalRecallGame.freeRide, null, { timeout: 180_000 });

// Park the rider at the note's pose, chase, and let the world settle there.
await page.evaluate(p => {
  const g = canalRecallGame;
  g.vectorMap.setCameraTilt?.(p.tilt); g.vectorMap._cameraTilt = p.tilt;
  const l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER');
  g.player.x = l._lastOffsetX + (p.lngLat[0] - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
  g.player.y = l._lastOffsetY - (p.lngLat[1] - l._lastCenterLat) * 111320 * ppm;
  g.player.angle = p.angle;
  g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; };
  g.viewMode = 'chase'; g.camera.viewMode = 'chase'; g.camera.northUp = false;
  g.camera.zoom = p.zoom; if (g.camera.targetZoom != null) g.camera.targetZoom = p.zoom;
  g.camera.resetForRide?.(g.player);
}, POSE);
const settle = async (label, maxS, minS = 0) => page.evaluate(async ([label, maxS, minS]) => {
  const t = performance.now();
  let run = 0;
  while (performance.now() - t < maxS * 1000) {
    const s = canalRecallGame.vectorMap.worldSettled?.();
    run = s?.settled ? run + 1 : 0;
    if (run >= 4 && performance.now() - t >= minS * 1000) return { label, ms: Math.round(performance.now() - t), settled: true };
    await new Promise(r => setTimeout(r, 250));
  }
  return { label, ms: Math.round(performance.now() - t), settled: false, state: canalRecallGame.vectorMap.worldSettled?.() };
}, [label, maxS, minS]);
const riderSettle = await settle('rider', 90);
const gpu = await page.evaluate(() => { try { const gl = canalRecallGame.vectorMap.host?.renderer?.getContext?.(); const ext = gl?.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER); } catch (e) { return String(e); } });
const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 2000) requestAnimationFrame(f); else r(+(n / ((performance.now() - t) / 1000)).toFixed(1)); }; requestAnimationFrame(f); }));
console.error(`gpu ${gpu}, ${fps} fps parked`);
await page.waitForTimeout(2000);

// Instrument the loaders (wrapping their methods: works on any bundle), then jump.
await page.evaluate(([panM, sideM, everyMs]) => {
  const g = canalRecallGame, vm = g.vectorMap, tb = vm._threeBuildings, city = vm._completeCity, baked = vm._bakedCoarse;
  const cam = vm.cameraMap.camera, canvas = vm.cameraMap.getCanvas();
  const T0 = performance.now();
  const R = window.__detached = { t0: T0, events: [], samples: [], keys: {} };
  const now = () => Math.round(performance.now() - T0);
  const tileBox = (z, x, y) => {
    const n = 2 ** z, lat = t => Math.atan(Math.sinh(Math.PI * (1 - 2 * t / n))) * 180 / Math.PI;
    return [x / n * 360 - 180, lat(y + 1), (x + 1) / n * 360 - 180, lat(y)];
  };
  // Screen overlap of a lng/lat box on the ground (corners + centre projected; any point in the viewport, or the
  // projected hull straddling it). Area: the clipped projected bbox in CSS px² (a size order, not exact).
  const screenOf = box => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const pts = [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]], [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2]]
      .map(p => cam.project(p)).filter(s => s.depth > 0 && Number.isFinite(s.x));
    if (!pts.length) return { on: false, area: 0 };
    const x0 = Math.max(0, Math.min(...pts.map(p => p.x))), x1 = Math.min(w, Math.max(...pts.map(p => p.x)));
    const y0 = Math.max(0, Math.min(...pts.map(p => p.y))), y1 = Math.min(h, Math.max(...pts.map(p => p.y)));
    const on = x1 > x0 && y1 > y0;
    return { on, area: on ? Math.round((x1 - x0) * (y1 - y0)) : 0 };
  };
  const boxOfChunk = key => {
    const m = /^(?:coarse:|near:|extras:|boat:)?(\d+)\/(\d+)$/.exec(key.replace(/^[a-z]+:/, ''));
    if (!m) return null;
    const z = key.startsWith('near:') || key.startsWith('extras:') ? tb.detailZoom : 14;
    return tileBox(z, +m[1], +m[2]);
  };
  const ev = (kind, key, phase, extra = {}) => {
    const box = kind === 'chunk' ? boxOfChunk(key) : kind === 'tile' ? (m => m ? tileBox(+m[1], +m[2], +m[3]) : null)(/^(\d+)\/(\d+)\/(\d+)$/.exec(key)) : null;
    const s = box ? screenOf(box) : null;
    R.events.push({ t: now(), kind, key, phase, on: s?.on ?? null, area: s?.area ?? null, ...extra });
  };
  R.screenOf = screenOf; R.boxOfChunk = boxOfChunk; R.tileBox = tileBox;
  if (tb) {
    const push = tb.pending.push.bind(tb.pending);
    tb.pending.push = (key, job) => { if (!tb.pending.has(key)) ev('chunk', key, 'queued'); return push(key, job); };
    const post = tb.rebuild.bind(tb);
    tb.rebuild = (key, source) => { const before = tb.inflight.has(key); const r = post(key, source); if (tb.inflight.has(key) && !before) ev('chunk', key, 'start'); return r; };
    const onChunk = tb.onChunk.bind(tb);
    tb.onChunk = (reply, w) => { ev('chunk', reply.key, 'done', { ms: Math.round(reply.ms ?? 0), stale: tb.gens.get(reply.key) !== reply.gen }); return onChunk(reply, w); };
    const install = tb.install.bind(tb);
    tb.install = (key, ...a) => { ev('chunk', key, 'installed'); return install(key, ...a); };
    const drop = tb.dropChunk.bind(tb);
    tb.dropChunk = (key, ...a) => { if (tb.chunks.has(key) || tb.inflight.has(key)) ev('chunk', key, 'dropped'); return drop(key, ...a); };
  }
  if (baked) {
    const req = baked.request.bind(baked);
    baked.request = (key, relift) => { R.events.push({ t: now(), kind: 'baked', key, phase: 'start' }); return req(key, relift); };
    const inst = baked.install.bind(baked);
    baked.install = (data, relift) => { R.events.push({ t: now(), kind: 'baked', key: data.key, phase: 'installed', tris: data.triangles }); return inst(data, relift); };
    const drop = baked.drop.bind(baked);
    baked.drop = key => { R.events.push({ t: now(), kind: 'baked', key, phase: 'dropped' }); return drop(key); };
  }
  if (city) {
    const mark = city.markTile.bind(city);
    city.markTile = (key, what, n) => { ev('tile', key, what, { buildings: n }); return mark(key, what, n); };
    const q = city.world?.queue;
    if (q) { const read = q.read; q.read = key => { R.events.push({ t: now(), kind: 'cell', key, phase: 'start' }); return read(key).then(v => { R.events.push({ t: now(), kind: 'cell', key, phase: 'done' }); return v; }); }; }
    const w = city.world;
    if (w) { const plan = w.plan.bind(w); w.plan = (tiles, rider, dir, only) => { R.lastPlan = { t: now(), tiles: [...tiles], only: only ? [...only] : null }; return plan(tiles, rider, dir, only); }; }
  }
  R.jump = { panM, sideM, rotation: g.camera.rotation };
}, [panM, sideM, everyMs]);
await MOVE(page);
const arrivedAt = await page.evaluate(() => Math.round(performance.now() - window.__detached.t0));

// Settle at the new view (or hold), then take the final on-screen building set.
const detachedSettle = await settle('detached', holdS, 4);
await page.waitForTimeout(1500);
const final = await page.evaluate(() => {
  const g = canalRecallGame, vm = g.vectorMap, tb = vm._threeBuildings, city = vm._completeCity, cam = vm.cameraMap.camera, canvas = vm.cameraMap.getCanvas();
  const w = canvas.clientWidth, h = canvas.clientHeight, R = window.__detached;
  const feats = city?.cache?.collection?.().features ?? [];
  const first = f => { let c = f.geometry?.coordinates; while (Array.isArray(c?.[0])) c = c[0]; return c; };
  const on = [];
  for (const f of feats) {
    const p = first(f); if (!p) continue;
    const s = cam.project(p);
    if (!(s.depth > 0) || s.x < 0 || s.x > w || s.y < 0 || s.y > h) continue;
    on.push({ lng: p[0], lat: p[1], bottom: s.y > h * 0.4 });
  }
  R.final = on;
  // Every chunk / tile the run touched: on screen in the final view?
  R.finalOn = {};
  for (const e of R.events) if ((e.kind === 'chunk' || e.kind === 'tile') && !(e.key in R.finalOn)) {
    const box = e.kind === 'chunk' ? R.boxOfChunk(e.key) : (m => m ? R.tileBox(+m[1], +m[2], +m[3]) : null)(/^(\d+)\/(\d+)\/(\d+)$/.exec(e.key));
    R.finalOn[e.key] = box ? R.screenOf(box).on : null;
  }
  R.view = { w, h, centre: vm.cameraMap.getCenter(), zoom: cam.zoom, pitch: cam.pitch, bounds: cam.bounds() };
  return { onScreen: on.length, bottom: on.filter(b => b.bottom).length, view: R.view };
});

// Replay: re-run the jump on a fresh page to sample coverage against the final set? Simpler and as fair: coverage is
// sampled live in a second pass below, so the first pass gives the set. Here the first pass also logged every event;
// the coverage timeline is taken from a second identical run with the set known up front.
const firstEvents = await page.evaluate(() => { const R = window.__detached; return { events: R.events, jump: R.jump, lastPlan: R.lastPlan, finalOn: R.finalOn }; });
const finalSet = await page.evaluate(() => window.__detached.final);
await context.close();

// Pass 2: the same jump, sampling the share of `finalSet` drawn every `everyMs`.
const context2 = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: Number(process.env.DPR || 2) });
const page2 = await context2.newPage();
page2.on('pageerror', e => errors.push(String(e).slice(0, 300)));
await page2.addInitScript(MOVER);
await throttle(page2);
watchNet(page2);
await page2.goto(`${origin}${gamePath}${qs}`);
await page2.waitForFunction(() => window.canalRecallGame?.state === 4 && window.canalRecallGame.camera?.introOverview === 0 && window.canalRecallGame.freeRide, null, { timeout: 180_000 });
await page2.evaluate(p => {
  const g = canalRecallGame;
  g.vectorMap.setCameraTilt?.(p.tilt); g.vectorMap._cameraTilt = p.tilt;
  const l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER');
  g.player.x = l._lastOffsetX + (p.lngLat[0] - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
  g.player.y = l._lastOffsetY - (p.lngLat[1] - l._lastCenterLat) * 111320 * ppm;
  g.player.angle = p.angle;
  g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; };
  g.viewMode = 'chase'; g.camera.viewMode = 'chase'; g.camera.northUp = false;
  g.camera.zoom = p.zoom; if (g.camera.targetZoom != null) g.camera.targetZoom = p.zoom;
  g.camera.resetForRide?.(g.player);
}, POSE);
const settle2 = async (label, maxS) => page2.evaluate(async ([label, maxS]) => {
  const t = performance.now();
  while (performance.now() - t < maxS * 1000) {
    if (canalRecallGame.vectorMap.worldSettled?.()?.settled) return { label, ms: Math.round(performance.now() - t), settled: true };
    await new Promise(r => setTimeout(r, 250));
  }
  return { label, ms: Math.round(performance.now() - t), settled: false };
}, [label, maxS]);
const riderSettle2 = await settle2('rider', 90);
await page2.waitForTimeout(2000);
// The wander's legs run before the timed pass-2 evaluate; the timed move is the last leg (or the single move).
const lastLeg = legs ? legs.at(-1) : noteOffset;
if (legs && legs.length > 1) await page2.evaluate(async ([legs, speed]) => { for (const l of legs.slice(0, -1)) await window.__moveCam(0, 0, speed || 300, l); }, [legs, dragSpeed]);
netT0 = await page2.evaluate(() => Date.now()); // request timing startTime is wall-clock ms
if (traceOut) await browser.startTracing(page2, { path: traceOut, screenshots: true, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'v8.execute', 'blink.user_timing', 'loading', 'netlog', 'disabled-by-default-v8.cpu_profiler', 'gpu'] });
const traceStop = traceOut ? setTimeout(() => browser.stopTracing().catch(() => {}), traceS * 1000) : null;
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
const shotTimes = [500, 1000, 2000, 4000, 8000, 16000];
const shotTimer = shotsDir ? (async () => {
  const t0 = Date.now();
  for (const t of shotTimes) {
    const wait = t - (Date.now() - t0); if (wait > 0) await new Promise(r => setTimeout(r, wait));
    await page2.screenshot({ path: path.join(shotsDir, `t${String(t).padStart(5, '0')}.jpg`), quality: 70 }).catch(() => {});
  }
})() : null;
const timeline = await page2.evaluate(async ([finalSet, panM, sideM, everyMs, holdS, speed, off]) => {
  const g = canalRecallGame, vm = g.vectorMap, tb = vm._threeBuildings, baked = vm._bakedCoarse;
  // Which tier draws at a point: a near/coarse chunk (tierAt) or a drawn baked cell (its key from the facade layer's grouping).
  const cellAt = (() => { const info = tb.groupOf?.bind(tb); return (lng, lat) => info ? info({ properties: { id: 'probe' }, geometry: { type: 'Polygon', coordinates: [[[lng, lat], [lng + 1e-6, lat], [lng, lat + 1e-6], [lng, lat]]] } }).cell : null; })();
  const tileAt = (lng, lat, z) => { const n = 2 ** z, rad = lat * Math.PI / 180; return `${Math.floor(((lng + 180) / 360) * n)}/${Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)}`; };
  // Keys precomputed once (tierAt's rule: a drawn near: chunk, else the z14 coarse: chunk; or the baked cell drawn).
  const pts = finalSet.map(b => ({ bottom: b.bottom, sig: `near:${tileAt(b.lng, b.lat, tb.detailZoom)}|coarse:${tileAt(b.lng, b.lat, 14)}|${cellAt(b.lng, b.lat) ?? ''}` }));
  const drawnSig = new Map();
  const drawnAt = b => {
    let d = drawnSig.get(b.sig);
    if (d === undefined) { const [near, coarse, cell] = b.sig.split('|'); d = !!tb.chunks.get(near)?.mesh || !!tb.chunks.get(coarse)?.mesh || (!!cell && !!baked?.drawn?.(cell)); drawnSig.set(b.sig, d); }
    return d;
  };
  await window.__moveCam(panM, sideM, speed, off);
  const T0 = performance.now(), samples = [];
  while (performance.now() - T0 < holdS * 1000) {
    await new Promise(r => setTimeout(r, everyMs));
    let all = 0, bottom = 0, nb = 0;
    drawnSig.clear();
    for (const b of pts) { const d = drawnAt(b); if (d) all++; if (b.bottom) { nb++; if (d) bottom++; } }
    const t = Math.round(performance.now() - T0);
    samples.push([t, pts.length ? all / pts.length : 1, nb ? bottom / nb : 1]);
    if (all === pts.length && vm.worldSettled?.()?.settled) break;
  }
  return samples;
}, [finalSet, panM, sideM, everyMs, holdS, legs ? (dragSpeed || 300) : dragSpeed, lastLeg]);
if (shotTimer) { await shotTimer; await page2.screenshot({ path: path.join(shotsDir, 'end.jpg'), quality: 70 }).catch(() => {}); }
if (traceOut) { clearTimeout(traceStop); await browser.stopTracing().catch(() => {}); }
await page2.waitForTimeout(500);
await context2.close();
await browser.close();

const at = (i, share) => { const s = timeline.find(r => r[i] >= share); return s ? s[0] : null; };
const ev = firstEvents.events;
const chunkKeys = [...new Set(ev.filter(e => e.kind === 'chunk').map(e => e.key))];
const chunks = chunkKeys.map(key => {
  const of = ev.filter(e => e.kind === 'chunk' && e.key === key);
  const firstOf = p => of.find(e => e.phase === p);
  return { key, onFinal: firstEvents.finalOn?.[key] ?? null, onAtQueue: firstOf('queued')?.on ?? firstOf('start')?.on ?? null, area: firstOf('queued')?.area ?? null, queued: firstOf('queued')?.t ?? null, start: firstOf('start')?.t ?? null, done: firstOf('done')?.t ?? null, installed: firstOf('installed')?.t ?? null, buildMs: firstOf('done')?.ms ?? null, stale: of.some(e => e.phase === 'done' && e.stale), dropped: of.some(e => e.phase === 'dropped') };
});
const sum = (a, f) => a.reduce((s, x) => s + (f(x) || 0), 0);
const built = chunks.filter(c => c.done != null);
const offBuilt = built.filter(c => c.onFinal === false);
const report = {
  pose: POSE, gpu, fps, panM, sideM, dragSpeed, latencyMs, mbps, arrivedAt, look: look || 'default', qs, settle: { rider: riderSettle, detached: detachedSettle, rider2: riderSettle2 },
  final,
  fill: { t50: at(1, 0.5), t90: at(1, 0.9), t100: at(1, 1), bottomT50: at(2, 0.5), bottomT90: at(2, 0.9), bottomT100: at(2, 1), lastShare: timeline.at(-1) },
  work: {
    chunkBuilds: built.length, chunkBuildMs: sum(built, c => c.buildMs),
    offScreenBuilds: offBuilt.length, offScreenBuildMs: sum(offBuilt, c => c.buildMs),
    staleBuilds: built.filter(c => c.stale).length, droppedChunks: chunks.filter(c => c.dropped).length,
    onScreenInstalls: chunks.filter(c => c.onAtQueue && c.installed != null).map(c => c.installed).sort((a, b) => a - b),
    cellReads: ev.filter(e => e.kind === 'cell' && e.phase === 'start').length,
    tilesRequested: ev.filter(e => e.kind === 'tile' && e.phase === 'requested').length,
    offScreenTiles: ev.filter(e => e.kind === 'tile' && e.phase === 'requested' && firstEvents.finalOn?.[e.key] === false).length,
    onScreenBuildWaitMs: built.filter(c => c.onFinal && c.queued != null && c.start != null).map(c => c.start - c.queued),
    firstOnScreenStart: Math.min(...built.filter(c => c.onFinal && c.start != null).map(c => c.start)), lastOnScreenDone: Math.max(...built.filter(c => c.onFinal).map(c => c.done)),
    bakedStarts: ev.filter(e => e.kind === 'baked' && e.phase === 'start').length,
    bakedInstalls: ev.filter(e => e.kind === 'baked' && e.phase === 'installed').length,
    bakedDropped: ev.filter(e => e.kind === 'baked' && e.phase === 'dropped').length,
  },
  chunks, timeline, net: netLog, events: ev, lastPlan: firstEvents.lastPlan, errors,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ out, final: report.final.onScreen, bottom: report.final.bottom, settle: report.settle, fill: report.fill, work: { ...report.work, onScreenInstalls: report.work.onScreenInstalls.length } }, null, 1));
