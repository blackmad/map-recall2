// Triangles and draw calls per frame by layer (lane landmark-residency, 2026-11-27, Part B): what the GPU draws on the
// belt ride, main pass and shadow pass apart. Every GL draw (drawElements/Arrays[Instanced], drawRangeElements, the
// WEBGL_multi_draw entry points a BatchedMesh uses) is charged to the object three is drawing (renderBufferDirect), and
// that object to its shared-frame participant (`shared-frame/<id>`) plus a sub-layer:
//   landmarks  the model's drawn level (full / lod1 / lod2), its lod2 batch, its shadow stand-in
//   others     the first named node under the participant root (chunk tiers, shells, ...), else the object type
//
//   PORT=4363 node scripts/perf/layer-tris.mjs <out.json> [--route belt] [--speed 9] [--poses 12,24,36,48] [--frames 20]
//     [--qs 'a=1'] [--shots <dir>] [--dpr 2] [--w 1512] [--h 900] [--warm 15 (s parked at the start first)]
// At each pose (seconds of riding) the rider stops, the world settles 3 s, then --frames frames are drawn and counted
// (each forced with a repaint), and with --shots a PNG of the canvas is kept for before/after diffs. The whole ride is
// also counted (moving), so the table has both a still pose and the ride's mean.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const out = argv[0];
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const route = opt('route', 'belt'), speed = Number(opt('speed', '9')), frames = Number(opt('frames', '20'));
const poses = opt('poses', '12,24,36,48').split(',').map(Number);
const DPR = Number(opt('dpr', '2')), W = Number(opt('w', '1512')), H = Number(opt('h', '900'));
const shots = opt('shots', null), extraQs = opt('qs', '');
const origin = `http://127.0.0.1:${process.env.PORT || 4363}`;
const ROUTES = { belt: { start: '^waag$', dest: 'westerkerk' } };
const R = ROUTES[route] ?? (() => { const [s, d] = route.split(':'); return { start: s, dest: d }; })();
setTimeout(() => { console.error('watchdog: giving up'); process.exit(3); }, 900_000).unref();

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
await context.route(/ingest\.(us\.)?sentry\.io|google-analytics|googletagmanager/, r => r.fulfill({ status: 200, body: '{}' }));
if (process.env.BUNDLES_DIR) await context.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, r => {
  const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(r.request().url())[1]);
  return fs.existsSync(file) ? r.fulfill({ body: fs.readFileSync(file), contentType: 'application/javascript' }) : r.continue();
});
await context.addInitScript(() => {
  let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  const C = window.__lt = { on: false, cur: 'unattributed', pass: 'main', acc: new Map() };
  const tri = (mode, n) => (mode === 4 ? n / 3 : mode === 5 || mode === 6 ? Math.max(0, n - 2) : 0);
  const charge = (t, d = 1) => { if (!C.on) return; const k = `${C.pass}|${C.cur}`; const e = C.acc.get(k) || (C.acc.set(k, [0, 0]), C.acc.get(k)); e[0] += d; e[1] += t; };
  const P = WebGL2RenderingContext.prototype;
  const wrap = (o, name, f) => { const b = o[name]; if (b) o[name] = function (...a) { try { f(a); } catch (_) {} return b.apply(this, a); }; };
  wrap(P, 'drawArrays', a => charge(tri(a[0], a[2])));
  wrap(P, 'drawElements', a => charge(tri(a[0], a[1])));
  wrap(P, 'drawArraysInstanced', a => charge(tri(a[0], a[2]) * a[3]));
  wrap(P, 'drawElementsInstanced', a => charge(tri(a[0], a[1]) * a[4]));
  wrap(P, 'drawRangeElements', a => charge(tri(a[0], a[3])));
  const ge = P.getExtension;
  P.getExtension = function (name) {
    const ext = ge.call(this, name);
    if (ext && name === 'WEBGL_multi_draw' && !ext.__lt) {
      ext.__lt = true;
      const sum = (counts, off, n) => { let t = 0; for (let i = 0; i < n; i++) t += counts[off + i]; return t; };
      wrap(ext, 'multiDrawElementsWEBGL', a => charge(tri(a[0], sum(a[1], a[2], a[5])), a[5]));
      wrap(ext, 'multiDrawArraysWEBGL', a => charge(tri(a[0], sum(a[2], a[3], a[4])), a[4]));
      wrap(ext, 'multiDrawElementsInstancedWEBGL', a => { let t = 0; for (let i = 0; i < a[7]; i++) t += tri(a[0], a[1][a[2] + i]) * a[5][a[6] + i]; charge(t, a[7]); });
      wrap(ext, 'multiDrawArraysInstancedWEBGL', a => { let t = 0; for (let i = 0; i < a[6]; i++) t += tri(a[0], a[2][a[3] + i]) * a[4][a[5] + i]; charge(t, a[6]); });
    }
    return ext;
  };
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
await page.goto(`${origin}/canal-drive/?engine=own${extraQs ? `&${extraQs.replace(/^[?&]/, '')}` : ''}`);
await page.waitForFunction(() => (window.canalRecallGame?.routePois?.length ?? 0) > 20, null, { timeout: 150_000 });
const ids = await page.evaluate(([s, d]) => {
  const pois = canalRecallGame.routePois, f = q => pois.find(p => p.id === q) || pois.find(p => new RegExp(q, 'i').test(p.name || ''));
  const a = f(s), b = f(d);
  return a && b ? { start: a.id, dest: b.id } : { missing: true };
}, [R.start, R.dest]);
if (ids.missing) { console.log('route POI not found'); await browser.close(); process.exit(2); }
await page.locator('#travel-mode').selectOption('car', { force: true });
await page.locator('#view-mode').selectOption('chase', { force: true });
await page.locator('#poi-destination').selectOption(ids.dest);
await page.evaluate(a => { const g = canalRecallGame; g._pickDestinationNear = () => g.routePois.find(p => p.id === a); }, ids.start);
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, { timeout: 180_000, polling: 100 });
await page.evaluate(mps => {
  const g = canalRecallGame, p = g.player, ppm = (0, eval)('PIXELS_PER_METER');
  g._quizFreezesRide = () => false; p.handleInput = () => {};
  const rails = g.track.findRoute({ x: p.x, y: p.y }, g.track.finishPoint);
  const cum = [0]; for (let k = 1; k < rails.length; k++) cum.push(cum[k - 1] + Math.hypot(rails[k].x - rails[k - 1].x, rails[k].y - rails[k - 1].y));
  let at = 0, seg = 1; const v = mps * ppm;
  // Ridden distance, not wall time, sets the pose: a slow frame does not move it.
  window.__ridden = () => at / ppm;
  p.update = function (dt) {
    if (!window.__go) { this.speed = 0; this.vx = 0; this.vy = 0; return; }
    at = Math.min(cum[cum.length - 1], at + v * Math.min(dt, 1 / 30));
    while (seg < rails.length - 1 && cum[seg] < at) seg++;
    const a = rails[seg - 1], b = rails[seg], f = (at - cum[seg - 1]) / Math.max(1e-6, cum[seg] - cum[seg - 1]);
    let d = Math.atan2(b.y - a.y, b.x - a.x) - this.angle; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.x = a.x + (b.x - a.x) * f; this.y = a.y + (b.y - a.y) * f; this.angle += d * Math.min(1, dt * 6);
    this.speed = at < cum[cum.length - 1] ? v : 0; this.vx = Math.cos(this.angle) * this.speed; this.vy = Math.sin(this.angle) * this.speed;
  };
  // Attribution: the object three draws, its participant and sub-layer.
  const vm = g.vectorMap, sf = vm.sharedFrame || vm._sharedFrame || vm.host?.sharedFrame, r = vm.host.renderer, C = window.__lt, sl = vm._signatureLandmarks;
  const levelOf = new WeakMap(), sub = new WeakMap();
  window.__ltRefresh = () => {
    for (const e of sl?._entries || []) {
      e.imported?.traverse(o => { if (o.isMesh) levelOf.set(o, e.level); });
      if (e.spare && e.spare !== e.imported) e.spare.traverse(o => { if (o.isMesh) levelOf.set(o, `spare-${e.spareLevel}`); });
    }
  };
  const classify = o => {
    if (sub.has(o)) return sub.get(o);
    let n = o, below = null, layer = null;
    while (n) {
      if (n.name?.startsWith('shared-frame/')) { layer = n.name.slice(13); break; }
      if (n.parent?.name?.startsWith('shared-frame/')) { /* participant root */ } else if (n.name) below = n.name;
      n = n.parent;
    }
    let k;
    if (layer === 'landmarks') {
      const lvl = levelOf.get(o);
      k = o.userData?.shadowStandIn || /stand-?in/i.test(o.name || '') ? 'landmarks/standIn' : lvl ? `landmarks/${lvl}` : o.isBatchedMesh || /batch/i.test(o.name || '') ? 'landmarks/lod2-batch' : `landmarks/other:${(o.name || o.type).slice(0, 30)}`;
      return k;
    }
    k = `${layer ?? 'scene'}/${(below || o.name || o.type).replace(/[\d.:-]+/g, '#').slice(0, 40)}`;
    sub.set(o, k);
    return k;
  };
  // Landmark draws also by distance from the eye (bounding-sphere centre; the main camera, in the shadow pass too).
  const eye = { x: 0, y: 0, z: 0 };
  const band = (object, geometry, camera) => {
    if (C.pass === 'main') { const e = camera.matrixWorld.elements; eye.x = e[12]; eye.y = e[13]; eye.z = e[14]; }
    const bs = geometry.boundingSphere; if (!bs) return '@?';
    const m = object.matrixWorld.elements, c = bs.center;
    const x = m[0] * c.x + m[4] * c.y + m[8] * c.z + m[12], y = m[1] * c.x + m[5] * c.y + m[9] * c.z + m[13], z = m[2] * c.x + m[6] * c.y + m[10] * c.z + m[14];
    const d = Math.max(0, Math.hypot(x - eye.x, y - eye.y, z - eye.z) - (object.name?.startsWith('baked') || !object.name ? bs.radius * Math.max(object.matrixWorld.getMaxScaleOnAxis?.() ?? 1, 0) : 0));
    return d < 150 ? '@0-150' : d < 300 ? '@150-300' : d < 600 ? '@300-600' : d < 1200 ? '@600-1200' : '@1200+';
  };
  const rbd = r.renderBufferDirect.bind(r);
  r.renderBufferDirect = function (camera, scene, geometry, material, object, group) { C.cur = classify(object); if ((C.cur.startsWith('landmarks/') && C.cur !== 'landmarks/standIn') || C.cur.startsWith('facades/')) C.cur += band(object, geometry, camera); try { return rbd(camera, scene, geometry, material, object, group); } finally { C.cur = 'unattributed'; } };
  const sm = r.shadowMap, smr = sm.render.bind(sm);
  sm.render = function (...a) { C.pass = 'shadow'; try { return smr(...a); } finally { C.pass = 'main'; } };
  setInterval(() => { try { window.__ltRefresh(); } catch (_) {} }, 500);
  // Baked coarse cells at a pose: triangles, nearest eye distance, share of vertices hidden (covered by detail).
  window.__bakedCensus = () => {
    const bc = vm._bakedCoarse, cam = sf?.camera ?? null, out = [];
    if (!bc?.residents) return out;
    const e = cam ? cam.matrixWorld.elements : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const [key, r] of bc.residents) {
      const m = r.mesh; if (!m?.geometry) continue;
      const g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
      const c = g.boundingSphere.center.clone().applyMatrix4(m.matrixWorld);
      const dist = Math.hypot(c.x - e[12], c.y - e[13], c.z - e[14]), near = Math.max(0, dist - g.boundingSphere.radius);
      const h = g.getAttribute('hidden'); let hid = 0; if (h?.array?.length) { for (let i = 0; i < h.array.length; i++) if (h.array[i]) hid++; }
      out.push({ key, visible: m.visible, tris: Math.round((g.index ? g.index.count : g.attributes.position.count) / 3), nearM: Math.round(near), centreM: Math.round(dist), hiddenShare: h?.array?.length ? +(hid / h.array.length).toFixed(2) : null });
    }
    return out.sort((a, b) => a.nearM - b.nearM);
  };
  // Frames drawn by the host.
  C.frames = 0; vm.host.on('render', () => { if (C.on) C.frames++; });
  window.__ltTake = () => { const o = {}; for (const [k, [d, t]] of C.acc) o[k] = [d, t]; const f = C.frames; C.acc = new Map(); C.frames = 0; return { frames: f, by: o }; };
}, speed);

const T0 = Date.now(), say = m => console.error(`[${((Date.now() - T0) / 1000).toFixed(0)}s] ${m}`);
// Settle at the start before riding (a loaded machine fills the world late): --warm seconds, and the baked cells in.
await page.waitForFunction(() => (canalRecallGame.vectorMap._bakedCoarse?.residents?.size ?? 1) > 0, null, { timeout: 120_000, polling: 500 }).catch(() => say('no baked cells after 120 s'));
await page.waitForTimeout(Number(opt('warm', '15')) * 1000);
await page.evaluate(() => { window.__go = true; window.__ltRefresh(); window.__lt.on = true; });
const results = { qs: extraQs, route, poses: [], ride: null, errors };
const metresPerPose = poses.map(s => s * speed);
let rideAcc = { frames: 0, by: {} };
const addInto = (dst, src) => { dst.frames += src.frames; for (const [k, [d, t]] of Object.entries(src.by)) { const e = dst.by[k] ||= [0, 0]; e[0] += d; e[1] += t; } };
for (let i = 0; i < poses.length; i++) {
  await page.waitForFunction(m => window.__ridden() >= m, metresPerPose[i], { timeout: 300_000, polling: 100 });
  addInto(rideAcc, await page.evaluate(() => window.__ltTake()));
  await page.evaluate(() => { window.__go = false; window.__lt.on = false; });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { window.__ltRefresh(); window.__lt.on = true; window.__ltTake(); });
  const still = await page.evaluate(async n => {
    const vm = canalRecallGame.vectorMap;
    for (let k = 0; k < n; k++) { vm.map?.triggerRepaint?.(); vm.host?.requestRender?.(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }
    return window.__ltTake();
  }, frames);
  let shot = null;
  if (shots) {
    fs.mkdirSync(shots, { recursive: true });
    shot = path.join(shots, `pose-${i}-${poses[i]}s.png`);
    await page.screenshot({ path: shot });
  }
  const meta = await page.evaluate(() => ({ ridden: Math.round(window.__ridden()), baked: window.__bakedCensus(), residency: canalRecallGame.vectorMap._signatureLandmarks?.residencyStats?.() ?? null }));
  results.poses.push({ s: poses[i], ...meta, shot, frames: still.frames, perFrame: perFrame(still) });
  say(`pose ${i} at ${meta.ridden} m: ${still.frames} frames`);
  await page.evaluate(() => { window.__lt.on = true; window.__ltTake(); window.__go = true; });
}
addInto(rideAcc, await page.evaluate(() => window.__ltTake()));
results.ride = { frames: rideAcc.frames, perFrame: perFrame(rideAcc) };
await browser.close();
fs.writeFileSync(out, JSON.stringify(results, null, 1));

function perFrame({ frames: f, by }) {
  const o = {};
  for (const [k, [d, t]] of Object.entries(by)) o[k] = { draws: +(d / Math.max(1, f)).toFixed(1), tris: Math.round(t / Math.max(1, f)) };
  return Object.fromEntries(Object.entries(o).sort((a, b) => b[1].tris - a[1].tris));
}
const show = (label, pf) => {
  const tot = Object.values(pf).reduce((a, v) => [a[0] + v.draws, a[1] + v.tris], [0, 0]);
  console.log(`${label}: ${tot[0].toFixed(0)} draws, ${(tot[1] / 1e6).toFixed(2)} M tris`);
  for (const [k, v] of Object.entries(pf).slice(0, 30)) console.log(`  ${k.padEnd(60)} ${String(v.draws).padStart(7)} ${String(v.tris).padStart(9)}`);
};
show(`ride mean (${results.ride.frames} frames)`, results.ride.perFrame);
for (const p of results.poses) { show(`pose ${p.s}s ${p.ridden} m (${p.frames} frames)`, p.perFrame); console.log('  baked cells', JSON.stringify(p.baked)); }
if (errors.length) console.log('errors', errors.slice(0, 3));
