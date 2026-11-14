// Screen fill during a detached-camera drag (feedback 748b1a8f, 2026-11-14: whole blocks bare while the camera was
// panned 1.3 km off the rider; "are we doing anything to prioritize a load that's on screen / cancel ones that are
// off?"). scripts/detached-load.mjs times the fill from the END of a move; a drag shows its bare blocks during the move,
// so this harness samples the screen throughout.
//
// Pass 1 (reference): the rider parked at the note's pose, the camera dragged slowly along the legs, settling every
// --step m of the last leg; every building the complete city held along the way is kept (id -> first vertex).
// Pass 2 (timed, fresh context, cold cache): the same legs at --speed m/s. From the start of the last leg, every
// --every ms: the reference buildings on screen, and the share of them drawn by any tier (a near/coarse chunk mesh or a
// baked cell). Reported: bare share by time, bare screen-seconds (the integral of 1 - share) during the last leg and
// after it, time to 90/100 % after the leg ends, plus every chunk build, world cell read, tile and request in pass 2.
//
//   ORIGIN=https://canalrecall-blackmad.web.app /tmp/canal-pw.sh node scripts/pan-fill.mjs <out.json> --chrome \
//     --look storybook --legs "0,-2500;2500,-2500;3000,1500" --note --speed 300 [--qs 'panAhead=0'] [--shots dir]
// Legs are metres east,north of the rider; --note appends the note's camera (1,072 m E, 711 m N of the rider).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const out = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'artifacts/perf/pan-fill.json';
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const speed = Number(opt('speed', '300'));
const refSpeed = Number(opt('ref-speed', '150'));
const stepM = Number(opt('step', '350'));
const holdS = Number(opt('hold', '20'));
const everyMs = Number(opt('every', '150'));
const extraQs = opt('qs', '');
const look = opt('look', 'storybook');
const shotsDir = opt('shots', '');
const latencyMs = Number(opt('latency', '0')), mbps = Number(opt('mbps', '0'));
const skipRef = opt('ref', '');
// --trace <file>: a Chrome performance trace of the last leg and 3 s after it.
const traceOut = opt('trace', '');
const origin = process.env.ORIGIN || `http://127.0.0.1:${process.env.PORT || 4453}`;
const gamePath = process.env.GAME_PATH || (process.env.ORIGIN ? '/ride' : '/canal-drive/');
const POSE = { lngLat: [4.864062, 52.367576], angle: -0.39889684834280237, zoom: 0.65, tilt: 15 };
const NOTE_M = [(-4009.536989249451 - -7225.5288260432935) / 3, -(-6045.270088931345 - -3912.532768026519) / 3];
const legs = (opt('legs', '') ? opt('legs', '').split(';').map(l => l.split(',').map(Number)) : []);
if (argv.includes('--note')) legs.push(NOTE_M);
if (!legs.length) legs.push(NOTE_M);

const useChrome = argv.includes('--chrome');
const browser = await chromium.launch({
  headless: !argv.includes('--headed'),
  args: ['--enable-precise-memory-info', '--host-resolver-rules=MAP *.ingest.sentry.io 127.0.0.1, MAP *.ingest.us.sentry.io 127.0.0.1, MAP *.ingest.de.sentry.io 127.0.0.1',
    ...(useChrome ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : [])],
  ...(useChrome ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}),
});
const [vw, vh] = (process.env.VIEWPORT || '1326x761').split('x').map(Number);
const qs = `?ride=free&engine=own&buildings3d=${look}${extraQs ? `&${extraQs.replace(/^\?/, '')}` : ''}`;
const errors = [];

const INIT = () => {
  let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  // Drag the camera anchor to `toM` (metres east, north of the rider) at `speed` m/s, as Camera.pan does.
  window.__dragTo = (toM, speed) => new Promise(resolve => {
    const g = canalRecallGame, c = g.camera, ppm = (0, eval)('PIXELS_PER_METER');
    c.pan(0.0001, 0);
    const x0 = c.anchorX ?? c.x, y0 = c.anchorY ?? c.y;
    const x1 = g.player.x + toM[0] * ppm, y1 = g.player.y - toM[1] * ppm;
    const total = Math.hypot(x1 - x0, y1 - y0) / ppm, t0 = performance.now();
    const step = () => {
      const f = speed > 0 && total > 0 ? Math.min(1, (performance.now() - t0) / 1000 * speed / total) : 1;
      c.anchorX = x0 + (x1 - x0) * f; c.anchorY = y0 + (y1 - y0) * f;
      if (f < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
};

async function open() {
  const context = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: Number(process.env.DPR || 2) });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  await page.addInitScript(INIT);
  if (argv.includes('--diag')) await page.addInitScript(() => { window.__pfDiag = true; });
  if (latencyMs || mbps) {
    const cdp = await context.newCDPSession(page);
    const bps = mbps > 0 ? mbps * 1e6 / 8 : -1;
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: latencyMs, downloadThroughput: bps, uploadThroughput: bps });
  }
  await page.goto(`${origin}${gamePath}${qs}`);
  await page.waitForFunction(() => window.canalRecallGame?.state === 4 && window.canalRecallGame.camera?.introOverview === 0 && window.canalRecallGame.freeRide, null, { timeout: 180_000 });
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
  const settled = await settle(page, 90);
  await page.waitForTimeout(1500);
  return { context, page, settled };
}
const settle = (page, maxS, minS = 0) => page.evaluate(async ([maxS, minS]) => {
  const t = performance.now(); let run = 0;
  while (performance.now() - t < maxS * 1000) {
    run = canalRecallGame.vectorMap.worldSettled?.()?.settled ? run + 1 : 0;
    if (run >= 4 && performance.now() - t >= minS * 1000) return Math.round(performance.now() - t);
    await new Promise(r => setTimeout(r, 250));
  }
  return -1;
}, [maxS, minS]);

// ---- Pass 1: the reference set.
let ref;
if (skipRef && fs.existsSync(skipRef)) ref = JSON.parse(fs.readFileSync(skipRef, 'utf8'));
else {
  const { context, page } = await open();
  await page.evaluate(() => {
    const city = canalRecallGame.vectorMap._completeCity;
    const first = f => { let c = f.geometry?.coordinates; while (Array.isArray(c?.[0])) c = c[0]; return c; };
    window.__ref = new Map();
    window.__collect = () => { for (const f of city?.cache?.collection?.().features ?? []) { const id = f.properties?.id ?? f.id; if (id == null || window.__ref.has(id)) continue; const p = first(f); if (p) window.__ref.set(id, [+p[0].toFixed(6), +p[1].toFixed(6), String(id)]); } };
    window.__collectTimer = setInterval(window.__collect, 400);
  });
  for (let i = 0; i < legs.length - 1; i++) await page.evaluate(([to, s]) => window.__dragTo(to, s), [legs[i], refSpeed]);
  // The last leg in --step stops, each settled.
  const from = legs.length > 1 ? legs.at(-2) : [0, 0], to = legs.at(-1);
  const n = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / stepM));
  for (let k = 1; k <= n; k++) {
    const p = [from[0] + (to[0] - from[0]) * k / n, from[1] + (to[1] - from[1]) * k / n];
    await page.evaluate(([to, s]) => window.__dragTo(to, s), [p, refSpeed]);
    await settle(page, 20, 1.5);
    await page.evaluate(() => window.__collect());
  }
  ref = await page.evaluate(() => { clearInterval(window.__collectTimer); return [...window.__ref.values()]; });
  await context.close();
  if (skipRef) fs.writeFileSync(skipRef, JSON.stringify(ref));
}
console.error(`reference: ${ref.length} buildings`);

// ---- Pass 2: timed.
const { context, page, settled: riderSettle } = await open();
const gpu = await page.evaluate(() => { try { const gl = canalRecallGame.vectorMap.host?.renderer?.getContext?.(); const ext = gl?.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null; } catch (e) { return String(e); } });
for (let i = 0; i < legs.length - 1; i++) await page.evaluate(([to, s]) => window.__dragTo(to, s), [legs[i], speed]);
// Requests from the start of the last leg.
const net = [];
let netT0 = await page.evaluate(() => Date.now());
page.on('requestfinished', async req => {
  const url = req.url(); if (url.startsWith('data:') || url.startsWith('blob:')) return;
  const t = req.timing(); let res = null; try { res = await req.response(); } catch { /* */ }
  const h = res ? await res.allHeaders().catch(() => ({})) : {};
  let size = null; try { size = (await req.sizes()).responseBodySize; } catch { /* */ }
  net.push({ url: url.replace(origin, ''), status: res?.status() ?? null, start: Math.round(t.startTime - netT0), ttfb: t.responseStart >= 0 ? Math.round(t.responseStart - Math.max(0, t.requestStart)) : null, total: t.responseEnd >= 0 ? Math.round(t.responseEnd) : null, size, xcache: h['x-cache'] ?? null, cc: h['cache-control'] ?? null });
});
await page.evaluate(([ref, everyMs]) => {
  const g = canalRecallGame, vm = g.vectorMap, tb = vm._threeBuildings, baked = vm._bakedCoarse, city = vm._completeCity;
  const cam = vm.cameraMap.camera, canvas = vm.cameraMap.getCanvas();
  const T0 = performance.now(), now = () => Math.round(performance.now() - T0);
  const R = window.__pf = { samples: [], events: [], diag: {} };
  const tileAt = (lng, lat, z) => { const n = 2 ** z, rad = lat * Math.PI / 180; return `${Math.floor(((lng + 180) / 360) * n)}/${Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)}`; };
  const cellOf = tb.groupOf?.bind(tb);
  const pts = ref.map(([lng, lat, id]) => ({ lng, lat, id, near: `near:${tileAt(lng, lat, tb.detailZoom)}`, coarse: `coarse:${tileAt(lng, lat, 14)}`, cell: cellOf ? cellOf({ properties: { id: 'probe' }, geometry: { type: 'Polygon', coordinates: [[[lng, lat], [lng + 1e-6, lat], [lng, lat + 1e-6], [lng, lat]]] } }).cell : null }));
  const ev = (kind, key, phase, extra = {}) => R.events.push({ t: now(), kind, key, phase, ...extra });
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
  if (city) {
    const mark = city.markTile.bind(city);
    city.markTile = (key, what, n) => { ev('tile', key, what, { buildings: n }); return mark(key, what, n); };
    const q = city.world?.queue;
    if (q) { const read = q.read; q.read = key => { ev('cell', key, 'start'); return read(key).then(v => { ev('cell', key, 'done'); return v; }); }; }
  }
  const sample = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight, memo = new Map();
    // Drawn = the building's id is in an installed chunk (or a drawn baked cell): the same test for one shell per
    // tile and one per cell (a tile-level test counted a tile's non-resident buildings as drawn).
    const ids = new Set();
    for (const entry of tb.chunks.values()) if (entry.mesh) for (const id of entry.ranges.keys()) ids.add(id);
    for (const entry of tb.bakedEntries?.values?.() ?? []) for (const id of entry.ranges?.keys?.() ?? []) ids.add(id);
    let on = 0, drawn = 0, nb = 0, db = 0;
    for (const p of pts) {
      const s = cam.project([p.lng, p.lat]);
      if (!(s.depth > 0) || s.x < 0 || s.x > w || s.y < 0 || s.y > h) continue;
      const sig = p.near + p.coarse + p.cell;
      let d = p.id !== undefined ? ids.has(p.id) : memo.get(sig);
      // tierAt reads the near chunk, else the coarse shell (split per world cell under ?coarseSplit); then the baked cell.
      if (d === undefined) { d = tb.tierAt(p.lng, p.lat).owner !== 'none' || (!!p.cell && !!baked?.drawn?.(p.cell)); memo.set(sig, d); }
      on++; if (d) drawn++;
      if (!d && window.__pfDiag && R.samples.length % 10 === 0) {
        const tile = p.coarse.slice(7), key = tb.coarseSplit && p.cell ? `coarse:${tile}~${p.cell}` : p.coarse;
        const st = tb.chunks.has(key) ? (tb.chunks.get(key).mesh ? 'mesh' : 'empty') : tb.inflight.has(key) ? 'inflight' : tb.pending.has(key) ? 'pending' : tb.staged.some(j => j.key === key) ? 'staged' : tb.sourceGroups.has(key) ? 'grouped' : 'nogroup';
        const dg = R.diag[R.samples.length] ??= { t: now(), by: {}, ex: {} };
        dg.by[st] = (dg.by[st] ?? 0) + 1; if (!dg.ex[st]) dg.ex[st] = [key, p.lng, p.lat];
      }
      if (s.y > h * 0.4) { nb++; if (d) db++; }
    }
    const c = vm.cameraMap.getCenter();
    R.samples.push([now(), on, on ? +(drawn / on).toFixed(3) : 1, nb ? +(db / nb).toFixed(3) : 1, +c.lng.toFixed(5), +c.lat.toFixed(5)]);
  };
  R.timer = setInterval(sample, everyMs);
}, [ref, everyMs]);
netT0 = await page.evaluate(() => Date.now());
if (traceOut) await browser.startTracing(page, { path: traceOut, screenshots: false, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute', 'blink.user_timing', 'loading', 'disabled-by-default-v8.cpu_profiler'] });
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
const shots = shotsDir ? (async () => {
  const t0 = Date.now();
  for (const t of [1000, 2000, 3000, 4000, 5000, 6000, 8000, 10000, 14000]) {
    const wait = t - (Date.now() - t0); if (wait > 0) await new Promise(r => setTimeout(r, wait));
    await page.screenshot({ path: path.join(shotsDir, `t${String(t).padStart(5, '0')}.jpg`), quality: 60 }).catch(() => {});
  }
})() : null;
await page.evaluate(([to, s]) => window.__dragTo(to, s), [legs.at(-1), speed]);
if (traceOut) { await page.waitForTimeout(3000); await browser.stopTracing(); }
const legEndMs = await page.evaluate(() => window.__pf.samples.at(-1)?.[0] ?? 0);
// Hold until the screen is full and the world settled (or --hold s).
await page.evaluate(async holdS => {
  const t = performance.now();
  while (performance.now() - t < holdS * 1000) {
    const s = window.__pf.samples.at(-1);
    if (s && s[2] >= 1 && canalRecallGame.vectorMap.worldSettled?.()?.settled && performance.now() - t > 1000) break;
    await new Promise(r => setTimeout(r, 200));
  }
  clearInterval(window.__pf.timer);
}, holdS);
if (shots) await shots;
const R = await page.evaluate(() => ({ samples: window.__pf.samples, events: window.__pf.events, diag: window.__pf.diag }));
// Parked at the end: the coarse chunk count and the frame's draw calls / triangles (the split's cost).
const parked = await page.evaluate(async () => {
  const vm = canalRecallGame.vectorMap, tb = vm._threeBuildings, r = vm.host?.renderer ?? vm._ownHost?.renderer;
  await new Promise(res => setTimeout(res, 1000));
  const gl = window.__canalPerf?.gl;
  if (gl) { const d0 = gl.report().total; let frames = 0; const t0 = performance.now(); while (performance.now() - t0 < 3000) { await new Promise(res => requestAnimationFrame(res)); frames++; } const r = gl.report(), d1 = r.total; return { frames, drawsPerFrame: +((d1.draws - d0.draws) / frames).toFixed(1), trianglesPerFrame: Math.round((d1.triangles - d0.triangles) / frames), coarseChunks: [...tb.chunks.keys()].filter(k => k.startsWith('coarse:')).length, draws: r.frames.draws, triangles: r.frames.triangles, residentMB: r.resident?.totalMB ?? null, byOwner: r.byOwner.slice(0, 6) }; }
  const calls = [], tris = [];
  for (let i = 0; i < 20; i++) { await new Promise(res => requestAnimationFrame(res)); if (r?.info?.render) { calls.push(r.info.render.calls); tris.push(r.info.render.triangles); } }
  const med = a => a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : null;
  const keys = [...(tb?.chunks?.keys?.() ?? [])];
  return { coarseChunks: keys.filter(k => k.startsWith('coarse:')).length, chunks: keys.length, drawCalls: med(calls), triangles: med(tris), stats: tb?.stats?.() ? (({ chunks, buildings, drawCalls, triangles, geometryMB }) => ({ chunks, buildings, drawCalls, triangles, geometryMB }))(tb.stats()) : null };
}).catch(e => ({ error: String(e) }));
await page.waitForTimeout(300);
await context.close();
await browser.close();

const S = R.samples;
const integ = (a, b) => { let s = 0; for (let i = 1; i < S.length; i++) { const [t0] = S[i - 1], [t1, , sh] = S[i]; if (t1 <= a || t0 >= b) continue; s += (Math.min(t1, b) - Math.max(t0, a)) / 1000 * (1 - sh); } return +s.toFixed(2); };
const after = S.filter(s => s[0] >= legEndMs);
const tAt = share => { const s = after.find(r => r[2] >= share); return s ? s[0] - legEndMs : null; };
const ev = R.events;
const byKey = kind => { const m = new Map(); for (const e of ev.filter(e => e.kind === kind)) { const o = m.get(e.key) ?? {}; if (!(e.phase in o)) o[e.phase] = e.t; if (e.ms != null) o.ms = e.ms; m.set(e.key, o); } return m; };
const chunks = byKey('chunk'), cells = byKey('cell'), tiles = byKey('tile');
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const report = {
  origin, qs, gpu, speed, legs, riderSettle, parked, refBuildings: ref.length, legEndMs,
  bare: { duringLeg: integ(0, legEndMs), afterLeg: integ(legEndMs, Infinity), minShareDuringLeg: Math.min(...S.filter(s => s[0] <= legEndMs).map(s => s[2])), shareAtLegEnd: after[0]?.[2] ?? null, t90AfterLeg: tAt(0.9), t100AfterLeg: tAt(1) },
  work: {
    chunkBuilds: [...chunks.values()].filter(c => c.done != null).length,
    chunkBuildMs: [...chunks.values()].reduce((s, c) => s + (c.ms || 0), 0),
    chunkWaitMed: med([...chunks.values()].filter(c => c.queued != null && c.start != null).map(c => c.start - c.queued)),
    chunkBuildMed: med([...chunks.values()].filter(c => c.ms != null).map(c => c.ms)),
    chunkBuildMax: Math.max(0, ...[...chunks.values()].filter(c => c.ms != null).map(c => c.ms)),
    cellReads: cells.size, cellReadMed: med([...cells.values()].filter(c => c.done != null).map(c => c.done - c.start)),
    tileLoads: [...tiles.values()].filter(t => t.requested != null).length, tileMed: med([...tiles.values()].filter(t => t.resident != null && t.requested != null).map(t => t.resident - t.requested)),
    requests: net.length,
  },
  samples: S, diag: R.diag, events: ev, net, errors,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ out, parked, refBuildings: report.refBuildings, legEndMs, bare: report.bare, work: report.work, errors: errors.length }, null, 1));
