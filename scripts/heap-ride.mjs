// Ride heap by owner (P3 gate, desktop <= 500 MB; issue #130): heap at ride start (racing, intro over, world settled,
// before motion) and N seconds into an autopiloted ride, each after a forced GC, with owners named from a heap snapshot.
//   PORT=4543 node scripts/heap-ride.mjs <out.json> [--device desktop|iphone] [--qs '?engine=own&world=v1&roads=bin']
//     [--ride 60] [--snapshot start,end] [--throttle 1]
// BUNDLES_DIR=<dir> serves *.bundle.js from a local (unminified) build; WORLD_DIR=<dir> serves staged world-v1 cells.
// HEAP_SHOT=<png> saves a screenshot of the settled ride start.
// Per sample: main-thread used/total heap and ArrayBuffer backing (Runtime.getHeapUsage), each worker's heap,
// performance.memory.usedJSHeapSize (what the engine-own spec reports as heapMB), and with --snapshot the retained
// size of every own property of the game and its world view (two levels: `vm._threeBuildings.chunks`) plus self size
// by constructor (scripts/heap-snapshot.mjs). Snapshot files go to $HEAP_TMP (default os.tmpdir()) and are deleted.
// Timeline (lane E2, #215: the own engine crashed Chrome with a V8 OOM): --every 5 samples every 5 s of the ride, each
// after a forced GC in the page and its workers, with the renderer and GPU process RSS (ps), resident GPU bytes
// (engine/glCounters.ts GlResident, on with --gl), three.js renderer.info.memory, building chunks resident and fading,
// and the rAF frame histogram of the window since the previous sample (the GC'd sample itself is left out). Snapshot
// labels may name timeline points (`--snapshot start,t30,t60,t600`). --chrome rides the installed Chrome on Metal (the
// user's browser), else Playwright's Chromium. --via auto:12 carries the rider on rails (motion-stutter.mjs's rails,
// --speed px/s) through 12 POIs of the centre and back again, so a 10-minute ride never stops at a finish.
import { execFileSync } from 'node:child_process';
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { heapSample } from './heap-sample.mjs';
import { analyseSnapshot, takeSnapshot } from './heap-snapshot.mjs';

const argv = process.argv.slice(2);
const out = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'artifacts/perf/heap-ride.json';
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const device = opt('device', 'desktop');
const qs = opt('qs', '?engine=own&world=v1&roads=bin');
const rideS = Number(opt('ride', '60'));
const snapAt = (opt('snapshot', 'start,end') || '').split(',').filter(Boolean);
const throttle = Number(opt('throttle', '1'));
// ORIGIN/PAGE ride another server, e.g. the deployed site: ORIGIN=https://canalrecall-blackmad.web.app PAGE=/ride
const origin = process.env.ORIGIN || `http://127.0.0.1:${process.env.PORT || 4544}`;
const pagePath = process.env.PAGE || '/canal-drive/';
const tmp = process.env.HEAP_TMP || os.tmpdir();
const every = Number(opt('every', '0'));
const via = opt('via', '');
const railSpeed = Number(opt('speed', '120'));
const useChrome = argv.includes('--chrome');
const glOn = argv.includes('--gl');

const browser = await chromium.launch({ args: ['--enable-precise-memory-info', '--js-flags=--expose-gc', ...(useChrome ? ['--use-angle=metal', '--ignore-gpu-blocklist'] : [])],
  ...(useChrome ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
const browserCdp = await browser.newBrowserCDPSession();
/** Resident set of the renderer and GPU processes, MB (SystemInfo names the pids, ps reads their RSS). */
async function processRss() {
  try {
    const { processInfo } = await browserCdp.send('SystemInfo.getProcessInfo');
    const out = {};
    for (const p of processInfo) {
      if (p.type !== 'renderer' && p.type !== 'GPU') continue;
      let kb = 0; try { kb = Number(execFileSync('ps', ['-o', 'rss=', '-p', String(p.id)]).toString().trim()) || 0; } catch (_) {}
      const k = p.type === 'GPU' ? 'gpuMB' : 'rendererMB';
      out[k] = Math.max(out[k] ?? 0, Math.round(kb / 1024));
    }
    return out;
  } catch (e) { return { error: String(e).slice(0, 120) }; }
}
// Desktop: the user's 14-inch MacBook Pro (budgets.json _desktopPerfViewport, 1512x982 at DPR 2); VIEWPORT/DPR override.
const [vw, vh] = (process.env.VIEWPORT || '1512x982').split('x').map(Number);
const context = await browser.newContext(device === 'iphone' ? { ...devices['iPhone 13'] } : { viewport: { width: vw, height: vh }, deviceScaleFactor: Number(process.env.DPR || 2) });
if (process.env.WORLD_DIR) await context.route(/\/data\/extracts\/amsterdam\/world-v1\/([^?]+)/, route => {
  const dir = path.resolve(process.env.WORLD_DIR), file = path.join(dir, /world-v1\/([^?]+)/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file) }) : route.fulfill({ status: 404, body: '' });
});
if (process.env.BUNDLES_DIR) await context.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
  const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: 'application/javascript' }) : route.continue();
});
// SITE_DIR=<dir> serves /canal-drive/<path> from an older checkout's public/canal-drive (index.html, js/) where the
// file exists there, over today's data: replays a past deploy (the 2026-11-02 crash build, lane E2).
if (process.env.SITE_DIR) await context.route(/\/canal-drive\/([^?#]*)/, route => {
  const rel = /\/canal-drive\/([^?#]*)/.exec(route.request().url())[1] || 'index.html';
  const file = path.join(path.resolve(process.env.SITE_DIR), rel);
  if (!file.startsWith(path.resolve(process.env.SITE_DIR)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.continue();
  const type = file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'application/javascript' : file.endsWith('.json') ? 'application/json' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream';
  return route.fulfill({ path: file, contentType: type });
});
const page = await context.newPage();
if (glOn) await page.addInitScript(() => { window.__canalRecallGlCounters = true; });
// rAF intervals for the timeline's frame histograms; __frameSkip marks the forced-GC sample windows (left out).
await page.addInitScript(() => {
  const F = window.__rideFrames = { t: [], skip: [] };
  const tick = now => { F.t.push(now); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
await page.goto(`${origin}${pagePath}${qs}`);
const startPoi = 'anne-frank', destPoi = 'rijksmuseum';
await page.waitForFunction(([a, b]) => window.canalRecallGame?.routePois?.some(p => p.id === a) && window.canalRecallGame.routePois.some(p => p.id === b), [startPoi, destPoi], { timeout: 120_000 });
await page.locator('#travel-mode').selectOption('car', { force: true });
await page.locator('#view-mode').selectOption('chase', { force: true });
await page.locator('#poi-destination').selectOption(destPoi).catch(() => errors.push('destination not in picker'));
await page.evaluate(a => { const g = canalRecallGame; g._pickDestinationNear = () => g.routePois.find(p => p.id === a); }, startPoi);
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, { timeout: 180_000 });
// Hold the rider still until the world settles (nothing loading, no frame pending), then 3 s more.
await page.evaluate(() => { const p = canalRecallGame.player; window.__heldUpdate = p.update; p.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
const settleMs = await page.evaluate(async () => {
  const t = performance.now(), cam = canalRecallGame.vectorMap.camera;
  await Promise.race([cam?.whenIdle?.() ?? Promise.resolve(), new Promise(r => setTimeout(r, 60_000))]);
  return Math.round(performance.now() - t);
});
await page.waitForTimeout(3000);
// HEAP_SHOT=<png>: a screenshot of the settled ride start (before/after shots of a budget change).
if (process.env.HEAP_SHOT) await page.screenshot({ path: process.env.HEAP_SHOT });

const markOwners = () => page.evaluate(async deep => {
  const g = window.canalRecallGame, vm = g.vectorMap, marks = {};
  const isObj = v => v && (typeof v === 'object' || typeof v === 'function') && !(v instanceof Node) && v !== window;
  const add = (prefix, root, depth) => {
    if (!isObj(root) || Array.isArray(root) || ArrayBuffer.isView(root) || root instanceof Map || root instanceof Set || root instanceof WeakMap) return;
    for (const k of Object.keys(root)) {
      let v; try { v = root[k]; } catch (_) { continue; }
      if (!isObj(v) || typeof v === 'function') continue;
      marks[`${prefix}.${k}`] = new WeakRef(v); // weak, so the marks never change who dominates what
      if (depth > 1) add(`${prefix}.${k}`, v, depth - 1);
    }
  };
  add('game', g, 1); add('vm', vm, 2);
  // The big owners one level further (their fields: caches, indexes, per-cell maps).
  for (const k of ['_ownGround', '_completeCity', '_threeBuildings', 'ferryTrack', '_overview', '_labels']) add(`vm.${k}`, vm[k], 2);
  if (vm._ownGround?.store) add('vm._ownGround.store', vm._ownGround.store, deep ? 3 : 1);
  // HEAP_DEEP=1: the ground store per cell. Each Map entry (a cell's settled value, promises included) and its fields
  // are marked as `vm._ownGround.store.<map>[<cell>].<field>`; `deepByField` sums them across cells.
  if (deep && vm._ownGround?.store) {
    const store = vm._ownGround.store;
    const settled = async v => (v && typeof v.then === 'function' ? Promise.race([v, Promise.resolve(undefined)]).catch(() => undefined) : v);
    for (const k of Object.keys(store)) {
      const map = store[k]; if (!(map instanceof Map)) continue;
      for (const [cell, raw] of map) {
        const v = await settled(raw); if (!isObj(v)) continue;
        marks[`vm._ownGround.store.${k}[${cell}]`] = new WeakRef(v);
        if (Array.isArray(v)) continue;
        for (const f of Object.keys(v)) { const x = v[f]; if (isObj(x) && typeof x !== 'function') marks[`vm._ownGround.store.${k}[${cell}].${f}`] = new WeakRef(x); }
      }
    }
  }
  for (const k of Object.keys(window)) if (/^(CanalRecall|maplibregl|THREE|__)/.test(k) && k !== '__heapMarks') { try { if (isObj(window[k])) marks[`window.${k}`] = new WeakRef(window[k]); } catch (_) {} }
  window.__heapMarks = marks;
  return Object.keys(marks).length;
}, Boolean(process.env.HEAP_DEEP));

async function sample(label) {
  const heap = await heapSample(cdp);
  const perf = await page.evaluate(() => ({ usedJSHeapMB: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576), atS: Math.round(performance.now() / 100) / 10,
    player: [Math.round(canalRecallGame.player.x), Math.round(canalRecallGame.player.y)], distancePx: Math.round(canalRecallGame.player.distancePx ?? 0) }));
  // CPU copies three.js still holds for drawn geometry: attribute / index arrays not yet released after upload, per
  // top-level child of the shared frame's scene (name, or type and child index), geometries counted once.
  const scene = await page.evaluate(() => {
    const root = canalRecallGame.vectorMap._sharedFrame?.scene; if (!root) return null;
    const seen = new Set(), groups = {};
    const arrays = g => [...Object.values(g.attributes || {}), g.index, ...Object.values(g.morphAttributes || {}).flat()].filter(Boolean)
      .map(a => a.isInterleavedBufferAttribute ? a.data : a);
    root.children.forEach((top, i) => {
      const key = `${i}:${top.name || top.type}${top.userData?.participant ? `/${top.userData.participant}` : ''}`;
      const row = groups[key] ??= { meshes: 0, geometries: 0, cpuMB: 0, uploadedCpuMB: 0, releasedAttrs: 0 };
      top.traverse(o => {
        if (!o.geometry) return; row.meshes++;
        if (seen.has(o.geometry)) return; seen.add(o.geometry); row.geometries++;
        for (const a of arrays(o.geometry)) {
          if (seen.has(a)) continue; seen.add(a);
          if (!a.array) { row.releasedAttrs++; continue; }
          const mb = a.array.byteLength / 1048576; row.cpuMB += mb; if (a.version > 0 || a.__uploaded) row.uploadedCpuMB += mb;
        }
      });
    });
    for (const r of Object.values(groups)) { r.cpuMB = Math.round(r.cpuMB * 10) / 10; r.uploadedCpuMB = Math.round(r.uploadedCpuMB * 10) / 10; }
    return Object.fromEntries(Object.entries(groups).filter(([, r]) => r.cpuMB >= 0.1).sort((a, b) => b[1].cpuMB - a[1].cpuMB));
  });
  const extra = await page.evaluate(() => {
    const vm = canalRecallGame.vectorMap, tb = vm._threeBuildings, info = vm.host?.renderer?.info ?? vm._sharedFrame?.renderer?.info;
    return { gpu: window.__canalPerf?.gl?.report?.().resident ?? null, three: info ? { ...info.memory, programs: info.programs?.length ?? null } : null,
      chunks: tb?.chunks?.size ?? null, fading: tb?.fading?.size ?? null };
  }).catch(e => ({ error: String(e).slice(0, 120) }));
  const row = { label, ...perf, ...heap, ...(await processRss()), ...extra, scene };
  if (snapAt.includes(label)) {
    row.marks = await markOwners();
    const file = path.join(tmp, `heap-${device}-${label}-${process.pid}.heapsnapshot`);
    const t = Date.now();
    await takeSnapshot(cdp, file);
    row.snapshotMB = Math.round(fs.statSync(file).size / 1048576); row.snapshotS = Math.round((Date.now() - t) / 1000);
    await page.evaluate(() => { delete window.__heapMarks; });
    try { row.owners = analyseSnapshot(file, process.env.HEAP_DEEP ? { top: 100000, digits: 3 } : undefined); } finally { fs.rmSync(file, { force: true }); }
    if (process.env.HEAP_DEEP && row.owners) {
      const by = {};
      for (const m of row.owners.marks) { const k = m.k.replace(/\[[^\]]*\]/, '[*]'); if (k !== m.k) { const b = by[k] ??= { mb: 0, cells: 0 }; b.mb += m.mb; b.cells++; } }
      row.deepByField = Object.fromEntries(Object.entries(by).map(([k, b]) => [k, { mb: Math.round(b.mb * 10) / 10, cells: b.cells }]).sort((a, b) => b[1].mb - a[1].mb));
    }
  }
  console.log(`${device} ${label}: used ${heap.main.usedMB} MB (+${heap.main.backingMB ?? '?'} buffers) workers ${heap.workersUsedMB} MB usedJSHeap ${perf.usedJSHeapMB} MB${row.owners ? ` reachable ${row.owners.reachableMB} MB` : ''}`);
  if (row.owners) for (const m of row.owners.claimed.slice(0, 15)) console.log(`  claimed ${m.mb} MB (${m.buffersMB} buffers) ${m.k}`);
  if (scene) for (const [k, r] of Object.entries(scene).slice(0, 12)) console.log(`  scene ${k}: ${r.cpuMB} MB CPU arrays, ${r.meshes} meshes, ${r.releasedAttrs} released`);
  return row;
}

const start = await sample('start');
// --gl: the ride is the after-warm-up window (uploads, uploads of at least 1 MiB with owners; P4 counters gate #129).
if (glOn) await page.evaluate(() => window.__canalPerf?.gl?.markWarm?.());
// Ride: the autopilot (motion-stutter.mjs's lookahead steer) along the planned route.
await page.evaluate(() => {
  const g = canalRecallGame, p = g.player; p.update = window.__heldUpdate; g._quizFreezesRide = () => false;
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
  };
});
const startRails = () => page.evaluate(([viaArg, v]) => {
  const g = canalRecallGame, p = g.player, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER');
  const world = (lat, lng) => ({ x: l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y: l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm });
  let pois;
  if (viaArg.startsWith('auto:')) {
    // N POIs within 2.2 km of the Dam, sorted by id (deterministic), visited nearest-first from the rider.
    const n = Number(viaArg.slice(5)), dam = { lat: 52.3731, lng: 4.8926 };
    const near = g.routePois.filter(q => Math.hypot((q.lat - dam.lat) * 111320, (q.lng - dam.lng) * 67800) < 2200).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const step = Math.max(1, Math.floor(near.length / n)), pick = near.filter((_, i) => i % step === 0).slice(0, n);
    pois = []; let at = { x: p.x, y: p.y };
    while (pick.length) { let bi = 0, bd = Infinity; pick.forEach((q, i) => { const w = world(q.lat, q.lng), d = Math.hypot(w.x - at.x, w.y - at.y); if (d < bd) { bd = d; bi = i; } }); const q = pick.splice(bi, 1)[0]; pois.push(q); at = world(q.lat, q.lng); }
  } else pois = viaArg.split(',').map(id => g.routePois.find(q => q.id === id)).filter(Boolean);
  const stops = [{ x: p.x, y: p.y }, ...pois.map(q => world(q.lat, q.lng))];
  const path = [];
  for (let k = 1; k < stops.length; k++) { let leg = null; try { leg = g.track.findRoute(stops[k - 1], stops[k]); } catch (_) {} if (leg && leg.length > 1) path.push(...(path.length ? leg.slice(1) : leg)); }
  const cum = [0]; for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + Math.hypot(path[k].x - path[k - 1].x, path[k].y - path[k - 1].y));
  const total = cum[cum.length - 1] || 0;
  window.__rail = { pois: pois.map(q => q.id), px: Math.round(total) };
  let sAt = 0, seg = 1, dir = 1;
  if (path.length > 1) p.update = function (dt) {
    if (window.__railPause) { this.speed = 0; this.vx = 0; this.vy = 0; return; }
    // Ping-pong: out along the tour and back, so a long ride keeps moving (and revisits what it streamed out).
    sAt += dir * v * dt;
    if (sAt >= total) { sAt = total; dir = -1; } else if (sAt <= 0) { sAt = 0; dir = 1; }
    while (seg < path.length - 1 && cum[seg] < sAt) seg++;
    while (seg > 1 && cum[seg - 1] > sAt) seg--;
    const a = path[seg - 1], b = path[seg], f = (sAt - cum[seg - 1]) / Math.max(1e-6, cum[seg] - cum[seg - 1]);
    const ang = Math.atan2((b.y - a.y) * dir, (b.x - a.x) * dir);
    this.x = a.x + (b.x - a.x) * f; this.y = a.y + (b.y - a.y) * f;
    let d = ang - this.angle; d = Math.atan2(Math.sin(d), Math.cos(d)); this.angle += d * Math.min(1, dt * 6);
    this.speed = v; this.vx = Math.cos(this.angle) * v; this.vy = Math.sin(this.angle) * v;
    this.distancePx = (this.distancePx || 0) + v * dt;
  };
}, [via, railSpeed]);
if (via) await startRails();
const rail = via ? await page.evaluate(() => window.__rail) : null;
if (rail) console.log(`rails: ${rail.pois.length} POIs, ${Math.round(rail.px / 3)} m out`);

const pickQ = (v, q) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };
/** Frame intervals since `from` (page ms), leaving out the forced-GC sample windows. */
const frameWindow = from => page.evaluate(from => {
  const F = window.__rideFrames, out = [];
  for (let i = 1; i < F.t.length; i++) {
    if (F.t[i - 1] < from) continue;
    if (F.skip.some(([a, b]) => F.t[i] > a && F.t[i - 1] < b)) continue;
    out.push(F.t[i] - F.t[i - 1]);
  }
  return out;
}, from);
const frameStats = iv => ({ n: iv.length, p50: +pickQ(iv, 0.5).toFixed(1), p99: +pickQ(iv, 0.99).toFixed(1), over33: iv.filter(f => f > 33.4).length,
  over50: iv.filter(f => f > 50).length, over100: iv.filter(f => f > 100).length, longestMs: Math.round(Math.max(0, ...iv)) });
const timeline = [];
const rideT0 = await page.evaluate(() => performance.now());
if (every > 0) {
  // Ride time excludes the samples: the rider holds still while a sample (GC, snapshot) runs, and the next window
  // starts when it ends, so a slow snapshot does not eat the ride.
  let last = rideT0;
  for (let t = every; t <= rideS; t += every) {
    const wait = last + every * 1000 - (await page.evaluate(() => performance.now()));
    if (wait > 0) await page.waitForTimeout(wait);
    const frames = frameStats(await frameWindow(last));
    const a = await page.evaluate(() => { window.__railPause = true; return performance.now(); });
    const label = `t${t}`;
    const row = await sample(label);
    const b = await page.evaluate(() => { window.__railPause = false; return performance.now(); });
    await page.evaluate(([a, b]) => window.__rideFrames.skip.push([a, b + 50]), [a, b]);
    last = b + 50;
    if (!snapAt.includes(label)) delete row.scene;
    timeline.push({ t, ...row, frames });
    console.log(`  t${t}: main ${row.main.usedMB} MB +${row.main.backingMB ?? '?'} buf, workers ${row.workersUsedMB}, renderer RSS ${row.rendererMB}, GPU RSS ${row.gpuMB}, gl ${row.gpu?.totalMB ?? '-'} MB, chunks ${row.chunks} fading ${row.fading}; frames p99 ${frames.p99} >50 ${frames.over50} >100 ${frames.over100} max ${frames.longestMs}`);
  }
} else await page.waitForTimeout(rideS * 1000);
// --rides N: after the ride, N - 1 more rides in the same page (route setup -> a new destination -> ride), each
// --ride seconds, sampled at its end: what a player who keeps playing without reloading holds (lane E2, #215).
const rides = Number(opt('rides', '1'));
const rideRows = [];
for (let r = 2; r <= rides; r++) {
  const dest = await page.evaluate(r => {
    const g = canalRecallGame;
    g._openRouteSetup();
    const ids = [...document.querySelectorAll('#poi-destination option')].map(o => o.value).filter(Boolean);
    const id = ids[(r * 7) % ids.length];
    document.querySelector('#poi-destination').value = id;
    const here = g.routePois.slice().sort((a, b) => Math.hypot(a.lat - 52.3731, a.lng - 4.8926) - Math.hypot(b.lat - 52.3731, b.lng - 4.8926))[r % 10];
    g._pickDestinationNear = () => here;
    return id;
  }, r);
  await page.locator('#route-card').evaluate(f => f.requestSubmit());
  await page.waitForFunction(() => canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, { timeout: 180_000 }).catch(() => errors.push(`ride ${r}: never raced`));
  await page.evaluate(() => { const g = canalRecallGame, p = g.player; g._quizFreezesRide = () => false; p.update = window.__heldUpdate ?? p.update; });
  if (via) await startRails();
  await page.waitForTimeout(rideS * 1000);
  const row = await sample(`ride${r}`);
  delete row.scene;
  rideRows.push({ ride: r, dest, ...row });
  console.log(`  ride ${r} (${dest}): main ${row.main.usedMB} MB +${row.main.backingMB} buf, workers ${row.workers.length}/${row.workersUsedMB} MB, renderer RSS ${row.rendererMB}, gl ${row.gpu?.totalMB ?? '-'}, three ${JSON.stringify(row.three)}`);
}
// --hide S: then another tab in front for S seconds (this page hidden, rAF stopped, workers and timers running), the
// hidden page sampled every --every seconds (default 15): does anything pile up while nobody draws? (lane E2, #215)
const hideS = Number(opt('hide', '0'));
const hiddenRows = [];
if (hideS > 0) {
  const front = await context.newPage();
  await front.goto('about:blank'); await front.bringToFront();
  const step = every > 0 ? every : 15;
  for (let t = step; t <= hideS; t += step) {
    await front.waitForTimeout(step * 1000);
    const vis = await page.evaluate(() => document.visibilityState);
    const row = await sample(`hidden${t}`); delete row.scene;
    hiddenRows.push({ t, visibility: vis, ...row });
    console.log(`  hidden ${t}s (${vis}): main ${row.main.usedMB} MB +${row.main.backingMB} buf, workers ${row.workers.length}/${row.workersUsedMB} MB, renderer RSS ${row.rendererMB}`);
  }
  await page.bringToFront(); await front.close();
}
const rideFrames = frameStats(await frameWindow(rideT0));
const end = await sample('end');
const glRide = glOn ? await page.evaluate(() => {
  const r = window.__canalPerf?.gl?.report?.(); if (!r) return null;
  const owners = {};
  for (const e of r.largeUploads) { const o = owners[e.owner] ??= { n: 0, MB: 0 }; o.n++; o.MB = +(o.MB + e.bytes / 1048576).toFixed(1); }
  return { uploads: r.sinceWarm.uploads, uploadMB: +(r.sinceWarm.uploadBytes / 1048576).toFixed(1), uploadsOver1MBAfterWarmup: r.largeUploads.length,
    over1MBMB: +(r.largeUploads.reduce((a, e) => a + e.bytes, 0) / 1048576).toFixed(1), over1MBOwners: owners };
}) : null;
if (glRide) console.log(`  gl over the ride: ${glRide.uploads} uploads ${glRide.uploadMB} MB, uploadsOver1MBAfterWarmup ${glRide.uploadsOver1MBAfterWarmup} (${glRide.over1MBMB} MB)`);
const result = { device, qs, throttle, rideS, every, chrome: useChrome, rail, settleMs, bundles: process.env.BUNDLES_DIR ?? null, world: process.env.WORLD_DIR ?? null, start, timeline, rideRows, hiddenRows, end, rideFrames, glRide, errors };
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 1));
await browser.close();
