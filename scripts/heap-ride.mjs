// Ride heap by owner (P3 gate, desktop <= 500 MB; issue #130): heap at ride start (racing, intro over, world settled,
// before motion) and N seconds into an autopiloted ride, each after a forced GC, with owners named from a heap snapshot.
//   PORT=4543 node scripts/heap-ride.mjs <out.json> [--device desktop|iphone] [--qs '?engine=own&world=v1&roads=bin']
//     [--ride 60] [--snapshot start,end] [--throttle 1]
// BUNDLES_DIR=<dir> serves *.bundle.js from a local (unminified) build; WORLD_DIR=<dir> serves staged world-v1 cells.
// Per sample: main-thread used/total heap and ArrayBuffer backing (Runtime.getHeapUsage), each worker's heap,
// performance.memory.usedJSHeapSize (what the engine-own spec reports as heapMB), and with --snapshot the retained
// size of every own property of the game and its world view (two levels: `vm._threeBuildings.chunks`) plus self size
// by constructor (scripts/heap-snapshot.mjs). Snapshot files go to $HEAP_TMP (default os.tmpdir()) and are deleted.
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
const origin = `http://127.0.0.1:${process.env.PORT || 4544}`;
const tmp = process.env.HEAP_TMP || os.tmpdir();

const browser = await chromium.launch({ args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const context = await browser.newContext(device === 'iphone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 } });
if (process.env.WORLD_DIR) await context.route(/\/data\/extracts\/amsterdam\/world-v1\/([^?]+)/, route => {
  const dir = path.resolve(process.env.WORLD_DIR), file = path.join(dir, /world-v1\/([^?]+)/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file) }) : route.fulfill({ status: 404, body: '' });
});
if (process.env.BUNDLES_DIR) await context.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
  const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: 'application/javascript' }) : route.continue();
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
await page.goto(`${origin}/canal-drive/${qs}`);
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

const markOwners = () => page.evaluate(() => {
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
  if (vm._ownGround?.store) add('vm._ownGround.store', vm._ownGround.store, 1);
  for (const k of Object.keys(window)) if (/^(CanalRecall|maplibregl|THREE|__)/.test(k) && k !== '__heapMarks') { try { if (isObj(window[k])) marks[`window.${k}`] = new WeakRef(window[k]); } catch (_) {} }
  window.__heapMarks = marks;
  return Object.keys(marks).length;
});

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
  const row = { label, ...perf, ...heap, scene };
  if (snapAt.includes(label)) {
    row.marks = await markOwners();
    const file = path.join(tmp, `heap-${device}-${label}-${process.pid}.heapsnapshot`);
    const t = Date.now();
    await takeSnapshot(cdp, file);
    row.snapshotMB = Math.round(fs.statSync(file).size / 1048576); row.snapshotS = Math.round((Date.now() - t) / 1000);
    await page.evaluate(() => { delete window.__heapMarks; });
    try { row.owners = analyseSnapshot(file); } finally { fs.rmSync(file, { force: true }); }
  }
  console.log(`${device} ${label}: used ${heap.main.usedMB} MB (+${heap.main.backingMB ?? '?'} buffers) workers ${heap.workersUsedMB} MB usedJSHeap ${perf.usedJSHeapMB} MB${row.owners ? ` reachable ${row.owners.reachableMB} MB` : ''}`);
  if (row.owners) for (const m of row.owners.claimed.slice(0, 15)) console.log(`  claimed ${m.mb} MB (${m.buffersMB} buffers) ${m.k}`);
  if (scene) for (const [k, r] of Object.entries(scene).slice(0, 12)) console.log(`  scene ${k}: ${r.cpuMB} MB CPU arrays, ${r.meshes} meshes, ${r.releasedAttrs} released`);
  return row;
}

const start = await sample('start');
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
await page.waitForTimeout(rideS * 1000);
const end = await sample('end');
const result = { device, qs, throttle, rideS, settleMs, bundles: process.env.BUNDLES_DIR ?? null, world: process.env.WORLD_DIR ?? null, start, end, errors };
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 1));
await browser.close();
