// Pop events by tier and distance band (lane P2, #325): what appears, vanishes or swaps without a dissolve, where.
//   PORT=4750 node scripts/pop-bands.mjs <out.json> --mode street|aerial [--device desktop|iphone] [--measure 60]
//     [--warmup 8] [--qs 'popFade=0&drawLimit=0'] [--frames <dir>]
//
// street: a game route from the Waag (Nieuwmarkt) to the Westerkerk, the rider carried on the route's rails at
//         --speed m/s (default 9) in chase view; aerial: Free Ride, the camera detached and flown at --speed m/s
//         (default 120) over Dam -> Nieuwmarkt (S1) -> Oost -> Dam at the S1 pose (aerial-pan.mjs's poses).
// Desktop is 1280x800 at DPR 2 (DPR= env overrides), iphone the iPhone 13 profile.
//
// Two counts per tier and band (metres from the eye, 0-250 / 250-600 / 600-1200 / >1200):
//  - residency events (analytic): every install, drop, level swap and far/coarse hand-over the streaming tiers make,
//    hooked in the page: detail ('near:' facade chunks), coarse (runtime z14 shells), baked (baked coarse cells), far
//    (far shell cells, and their per-tile hand-over to the coarse tier), landmark (catalogue/installed models: arrive,
//    leave, level swap), trees (rebuild), ground (own-ground cells). Each is placed the frame after it happens: the
//    object's bounding-sphere centre in the shared frame's eye-relative metres (the eye is the origin), on screen or
//    not (clip test), and its projected radius in CSS px. A POP is an event on screen, >= 3 px, that did not dissolve
//    (arrivals into a running fade and drops that fade out are dissolves). The fog weight at the object (the depth
//    fade's range, and the draw limit's when on) is logged too: a pop behind a weight >= 0.98 cannot be seen.
//  - frame diff: pop-in.mjs's detector (camera motion cancelled per block, dE76 20, blobs >= 192 screen px) on every
//    frame; a frame's blob area is charged to the tiers whose on-screen events landed in that frame or the one before
//    (split evenly), in the band of the nearest such event. Frames with no event are 'unexplained' (motion residual).
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const out = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'artifacts/pop-bands/pop-bands.json';
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const mode = opt('mode', 'street');
const device = opt('device', 'desktop');
const warmup = Number(opt('warmup', '8')), measure = Number(opt('measure', '60'));
const speed = Number(opt('speed', mode === 'aerial' ? '120' : '9'));
const extraQs = opt('qs', '');
const framesDir = opt('frames', null);
const origin = `http://127.0.0.1:${process.env.PORT || 4750}`;
const BANDS = [250, 600, 1200];
const bandOf = d => d == null ? 'unplaced' : d < 250 ? '0-250' : d < 600 ? '250-600' : d < 1200 ? '600-1200' : '>1200';

// The frame-diff worker of pop-in.mjs, verbatim (one detector for both scripts).
const popSrc = fs.readFileSync(new URL('./pop-in.mjs', import.meta.url), 'utf8');
const WORKER = /const WORKER = `([\s\S]*?)`;\n/.exec(popSrc)[1].replace('__MIN_BLOB__', '16').replace(/__DE__/g, '20');

const browser = await chromium.launch({ headless: process.env.HEADED !== '1', executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const context = await browser.newContext(device === 'iphone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: Number(process.env.DPR || 2) });
const page = await context.newPage();
if (process.env.BUNDLES_DIR) await context.route(/\/canal-drive\/.*\.bundle\.js/, route => {
  const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
});
const errors = [];
page.on('pageerror', e => errors.push((e.stack || e.message).split('\n').slice(0, 6).join(' | ')));
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
const qs = `?engine=own${mode === 'aerial' ? '&ride=free' : ''}${extraQs ? `&${extraQs.replace(/^\?/, '')}` : ''}`;
await page.goto(`${origin}/canal-drive/${qs}`);

if (mode === 'street') {
  await page.waitForFunction(() => window.canalRecallGame?.routePois?.some(p => /^waag$/i.test(p.name || '')) && window.canalRecallGame.routePois.some(p => p.id === 'westerkerk'), null, { timeout: 150_000 });
  const ids = await page.evaluate(() => ({ start: canalRecallGame.routePois.find(p => /^waag$/i.test(p.name || '')).id, dest: 'westerkerk' }));
  await page.locator('#travel-mode').selectOption('car', { force: true });
  await page.locator('#view-mode').selectOption('chase', { force: true });
  await page.locator('#poi-destination').selectOption(ids.dest);
  await page.evaluate(a => { const g = canalRecallGame; g._pickDestinationNear = () => g.routePois.find(p => p.id === a); }, ids.start);
  await page.locator('#route-card').evaluate(f => f.requestSubmit());
  await page.waitForFunction(() => canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, { timeout: 180_000, polling: 100 });
  await page.evaluate(mps => {
    const g = canalRecallGame, p = g.player, ppm = (0, eval)('PIXELS_PER_METER');
    g._quizFreezesRide = () => false; p.handleInput = () => {};
    let path = null; try { path = g.track.findRoute({ x: p.x, y: p.y }, g.track.finishPoint); } catch (_) {}
    if (!path || path.length < 2) throw new Error('no route rails');
    const cum = [0]; for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + Math.hypot(path[k].x - path[k - 1].x, path[k].y - path[k - 1].y));
    let at = 0, seg = 1; const v = mps * ppm;
    window.__railsM = Math.round(cum[cum.length - 1] / ppm);
    p.update = function (dt) {
      if (!window.__go) { this.speed = 0; return; }
      at = Math.min(cum[cum.length - 1], at + v * dt);
      while (seg < path.length - 1 && cum[seg] < at) seg++;
      const a = path[seg - 1], b = path[seg], f = (at - cum[seg - 1]) / Math.max(1e-6, cum[seg] - cum[seg - 1]);
      let d = Math.atan2(b.y - a.y, b.x - a.x) - this.angle; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.x = a.x + (b.x - a.x) * f; this.y = a.y + (b.y - a.y) * f; this.angle += d * Math.min(1, dt * 6);
      this.speed = at < cum[cum.length - 1] ? v : 0; this.vx = Math.cos(this.angle) * this.speed; this.vy = Math.sin(this.angle) * this.speed;
    };
  }, speed);
} else {
  await page.waitForFunction(() => window.canalRecallGame?.state === 4 && window.canalRecallGame.camera?.introOverview === 0 && window.canalRecallGame.freeRide, null, { timeout: 180_000 });
  await page.evaluate(mps => {
    const g = canalRecallGame, p = g.player, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), cam = g.camera, vm = g.vectorMap;
    g.camera.viewMode = 'chase';
    p.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; };
    const world = ([lng, lat]) => ({ x: l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y: l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm });
    const pts = [[4.8926, 52.3731], [4.9065, 52.3655], [4.9300, 52.3640], [4.8926, 52.3731]].map(world);
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const pose = { zoom: 0.45, tilt: 12, bearing: 30 };
    cam.pan(1, 0); cam.detached = true; cam.anchorX = cam.x = pts[0].x; cam.anchorY = cam.y = pts[0].y; cam.zoom = pose.zoom; cam.rotation = pose.bearing * Math.PI / 180;
    vm.setCameraTilt?.(pose.tilt); vm._cameraTilt = pose.tilt;
    let s = 0, last = performance.now();
    const step = now => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (window.__go) { s = (s + mps * ppm * dt) % cum[cum.length - 1]; }
      let i = 1; while (i < pts.length - 1 && cum[i] < s) i++;
      const a = pts[i - 1], b = pts[i], f = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
      cam.detached = true; cam.anchorX = a.x + (b.x - a.x) * f; cam.anchorY = a.y + (b.y - a.y) * f;
      cam.zoom = pose.zoom; cam.rotation = pose.bearing * Math.PI / 180; vm.setCameraTilt?.(pose.tilt); vm._cameraTilt = pose.tilt;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, speed);
}

// Hooks and capture.
const setup = await page.evaluate(workerSrc => {
  const g = canalRecallGame, vm = g.vectorMap, host = vm.map ?? vm.host, sf = vm._sharedFrame, THREE = sf.THREE;
  const P = window.__pb = { events: [], pending: [], results: [], captures: [], on: false, frame: 0 };
  const v = new THREE.Vector3(), v4 = new THREE.Vector4();
  // Placed after the frame's render: eye-relative metres (the shared frame's world has the eye at the origin).
  const merc = ([lng, lat]) => [(lng + 180) / 360, (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))) / 360];
  const place = e => {
    const o = e.obj; e.obj = null;
    if (e.anchor) { // a model's anchor (batched landmarks draw through a BatchedMesh: their own nodes keep stale matrices)
      const [mx, my] = merc(e.anchor); v.set(mx, my, 0).applyMatrix4(sf.worldFromMercatorM); e.d = +v.length().toFixed(1);
      v4.set(v.x, v.y, v.z, 1).applyMatrix4(sf.camera.projectionMatrix);
      const w = v4.w; e.onScreen = w > 0 && Math.abs(v4.x / w) < 1.05 && Math.abs(v4.y / w) < 1.05; e.px = w > 0 ? Math.round(Math.abs(20 * sf.camera.projectionMatrix.elements[5] / w) * innerHeight / 2) : 0; delete e.anchor;
      const fog = sf.scene.fog; if (fog) { const t = Math.max(0, Math.min(1, (e.d - fog.near) / (fog.far - fog.near))); e.fogW = +(t * t * (3 - 2 * t)).toFixed(3); }
      const lim = window.__canalRecallDrawLimitNow?.(); if (lim) { const t = Math.max(0, Math.min(1, (e.d - lim.from) / (lim.to - lim.from))); e.limitW = +(t * t * (3 - 2 * t)).toFixed(3); }
      return;
    }
    const geo = o?.geometry; let c = null, r = 0;
    if (geo) { if (!geo.boundingSphere) geo.computeBoundingSphere?.(); if (geo.boundingSphere) { c = geo.boundingSphere.center; r = geo.boundingSphere.radius; } }
    if (!c && o) { const box = new THREE.Box3().setFromObject(o); if (!box.isEmpty()) { const s = box.getBoundingSphere(new THREE.Sphere()); v.copy(s.center); r = s.radius; e.d = v.length(); } else return; }
    else if (c) { o.updateWorldMatrix?.(true, false); v.copy(c).applyMatrix4(o.matrixWorld); const sc = o.matrixWorld.getMaxScaleOnAxis(); r *= sc; }
    else return;
    e.d = +v.length().toFixed(1);
    v4.set(v.x, v.y, v.z, 1).applyMatrix4(sf.camera.projectionMatrix);
    const w = v4.w, H = innerHeight;
    if (w <= 0) { e.onScreen = false; e.px = 0; }
    else {
      const x = v4.x / w, y = v4.y / w, pr = Math.abs(r * sf.camera.projectionMatrix.elements[5] / w); // NDC radius (the frame's y may be flipped)
      e.px = Math.round(pr * H / 2);
      e.onScreen = Math.abs(x) - pr < 1 && Math.abs(y) - pr < 1;
    }
    const fog = sf.scene.fog;
    if (fog) { const t = Math.max(0, Math.min(1, (e.d - fog.near) / (fog.far - fog.near))); e.fogW = +(t * t * (3 - 2 * t)).toFixed(3); }
    const lim = window.__canalRecallDrawLimitNow?.(); if (lim) { const t = Math.max(0, Math.min(1, (e.d - lim.from) / (lim.to - lim.from))); e.limitW = +(t * t * (3 - 2 * t)).toFixed(3); }
  };
  const log = (tier, kind, faded, obj, key, anchor) => { if (!P.on) return; const e = { t: performance.now(), f: P.frame, tier, kind, faded: !!faded, key: String(key ?? ''), obj, anchor }; P.events.push(e); P.pending.push(e); };
  const wrap = (obj, name, fn) => { if (!obj || typeof obj[name] !== 'function') return false; const base = obj[name]; obj[name] = function (...a) { return fn.call(this, base, a); }; return true; };
  const tb = vm._threeBuildings, bc = vm._bakedCoarse, fs = vm._farShells, sl = vm._signatureLandmarks, tr = vm._inventoryTrees, og = vm._ownGround;
  const anchorOf = (spec, entry) => entry?.placement?.anchor || spec?.surveyed?.anchor || spec?.footprint?.centre || null;
  const tierOf = key => { const k = String(key); return k.startsWith('near:') ? 'detail' : k.startsWith('coarse') ? 'coarse' : 'chunk'; };
  const hooked = {
    chunkInstall: wrap(tb, 'install', function (base, a) { const before = this.chunks.get(a[0])?.mesh; const r = base.apply(this, a); const m = this.chunks.get(a[0])?.mesh; if (m && m !== before) log(tierOf(a[0]), before ? 'swap' : 'arrive', this.fading?.has?.(a[0]), m, a[0]); return r; }),
    chunkDrop: wrap(tb, 'dropChunk', function (base, a) { const m = this.chunks.get(a[0])?.mesh; const r = base.apply(this, a); if (m) log(tierOf(a[0]), 'leave', !!a[1] && !!m.parent, m, a[0]); return r; }),
    bakedInstall: wrap(bc, 'install', function (base, a) { const r = base.apply(this, a); const res = this.residents.get(a[0].key); if (res) log('baked', 'arrive', !!res.fade, res.mesh, a[0].key); return r; }),
    bakedDrop: wrap(bc, 'drop', function (base, a) { const res = this.residents.get(a[0]); const r = base.apply(this, a); if (res && res.drawn !== false) log('baked', 'leave', !!res.mesh.parent, res.mesh, a[0]); return r; }),
    farInstall: wrap(fs, 'install', function (base, a) { const r = base.apply(this, a); const res = this.residents.get(a[0].key); if (res) log('far', 'arrive', !!res.fade, res.mesh, a[0].key); return r; }),
    farDrop: wrap(fs, 'drop', function (base, a) { const res = this.residents.get(a[0]); const r = base.apply(this, a); if (res) log('far', 'leave', !!res.mesh.parent, res.mesh, a[0]); return r; }),
    farHandover: wrap(fs, 'applyHidden', function (base, a) { const res = a[0]; if (a[1]) return base.apply(this, a); const r = base.apply(this, a); if (r && !res.fade) log('far-handover', 'swap', !!res.handFade, res.mesh, res.key); return r; }),
    landmarkAdd: wrap(sl, '_add', function (base, a) { const r = base.apply(this, a); log('landmark', 'arrive', false, null, a[0]?.id, anchorOf(a[0])); return r; }),
    landmarkDrop: wrap(sl, '_dropEntries', function (base, a) { const objs = (this._entries || []).filter(e => a[0]?.has?.(e.spec.id)).map(e => [e.spec.id, anchorOf(e.spec, e)]); const r = base.apply(this, a); for (const [id, an] of objs) log('landmark', 'leave', false, null, id, an); return r; }),
    landmarkLevel: wrap(sl, '_swapLevel', function (base, a) { const r = base.apply(this, a); log('landmark', 'swap', false, null, `${a[0]?.spec?.id}:${a[2]}`, anchorOf(a[0]?.spec, a[0])); return r; }),
    trees: wrap(tr, 'rebuild', function (base, a) { const r = base.apply(this, a); log('trees', 'rebuild', false, null, ''); return r; }),
    ground: wrap(og, 'install', function (base, a) { const before = this.resident?.get?.(a[0]?.key)?.group; const r = base.apply(this, a); const now = this.resident?.get?.(a[0]?.key)?.group; if (now && now !== before) log('ground', before ? 'swap' : 'arrive', false, now, a[0]?.key); return r; }),
  };
  const worker = new Worker(URL.createObjectURL(new Blob([workerSrc], { type: 'text/javascript' })));
  P.worker = worker;
  worker.onmessage = e => { if (e.data.type === 'result') P.results.push({ i: e.data.i, area: e.data.area }); else if (e.data.type === 'dump') P.dump = e.data.keep; };
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 400;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const render = host._render.bind(host);
  host._render = (...a) => {
    const t0 = performance.now();
    const r = render(...a);
    if (P.on) (P.renderMs ||= []).push(performance.now() - t0);
    if (P.on) {
      for (const e of P.pending) { try { place(e); } catch (err) { e.err = String(err).slice(0, 80); } }
      P.pending.length = 0;
      ctx.drawImage(host.getCanvas ? host.getCanvas() : host.canvas, 0, 0, 640, 400);
      const img = ctx.getImageData(0, 0, 640, 400);
      const i = P.frame++;
      if (i % 120 === 0) { let sum = 0; for (let q = 0; q < img.data.length; q += 4000) sum += img.data[q + 1]; (P.dbg ||= []).push([i, Math.round(sum / (img.data.length / 4000)), Math.round(g.player.x), Math.round(g.player.y), +g.camera.x?.toFixed?.(0)]); }
      P.captures.push([i, performance.now()]);
      worker.postMessage({ type: 'frame', t: performance.now(), i, rgba: img.data, keep: !!window.__pbKeep, force: null }, [img.data.buffer]);
    }
    return r;
  };
  return { hooked, rails: window.__railsM ?? null };
}, WORKER);

await page.evaluate(() => { window.__go = true; });
await page.waitForTimeout(warmup * 1000);
if (framesDir) await page.evaluate(() => { window.__pbKeep = true; });
const heap0 = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
await page.evaluate(() => { window.__pb.on = true; });
await page.waitForTimeout(measure * 1000);
await page.evaluate(() => { window.__pb.on = false; window.__pb.worker.postMessage({ type: 'dump' }); });
await page.waitForFunction(() => window.__pb.dump && window.__pb.results.length >= window.__pb.captures.length - 1, null, { timeout: 900_000, polling: 1000 });
const raw = await page.evaluate(() => {
  const P = window.__pb, vm = canalRecallGame.vectorMap;
  return { events: P.events.map(({ obj, ...e }) => e), results: P.results, captures: P.captures, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
    fog: vm._sharedFrame.scene.fog ? { near: Math.round(vm._sharedFrame.scene.fog.near), far: Math.round(vm._sharedFrame.scene.fog.far) } : null,
    limit: window.__canalRecallDrawLimitNow?.() ?? null, dbg: P.dbg,
    // Frame cost: the shared frame's main-pass wall time (ms, CPU side of three's render) and the frame gaps.
    renderMs: (() => { const q = (P.renderMs || []).slice().sort((a, b) => a - b); const at = f => q.length ? +q[Math.min(q.length - 1, Math.floor(q.length * f))].toFixed(2) : null; return { n: q.length, p50: at(0.5), p95: at(0.95), p99: at(0.99) }; })(),
    gaps: (() => { const c = P.captures, d = []; for (let k = 1; k < c.length; k++) d.push(c[k][1] - c[k - 1][1]); d.sort((a, b) => a - b); const at = f => d.length ? +d[Math.min(d.length - 1, Math.floor(d.length * f))].toFixed(1) : null; return { p50: at(0.5), p99: at(0.99), over33: d.filter(x => x > 33).length }; })(),
    info: (() => { const r = vm._sharedFrame?.renderer ?? vm.host?.renderer; const m = r?.info?.memory; return { geometries: m?.geometries ?? null, textures: m?.textures ?? null, calls: r?.info?.render?.calls ?? null, triangles: r?.info?.render?.triangles ?? null }; })(),
    gl: (() => { try { const c = window.__canalPerf?.gl; const t = c?.resident?.totals?.() ?? c?.counters?.totals?.() ?? null; return t; } catch { return null; } })(),
    stats: { far: vm._farShells?.stats?.() ?? null, baked: vm._bakedCoarse?.stats?.() ?? null, groundFar: vm._ownGround?.farRadiusM ?? null } };
});
const dump = framesDir ? await page.evaluate(() => window.__pb.dump.slice(0, 8).map(k => {
  const W = 640, H = 400, cv = document.createElement('canvas'); cv.width = W * 2 + 4; cv.height = H;
  const g = cv.getContext('2d');
  g.putImageData(new ImageData(new Uint8ClampedArray(k.prev), W, H), 0, 0);
  const ov = new Uint8ClampedArray(k.cur);
  for (let p = 0; p < W * H; p++) if (k.mask[p]) { ov[p * 4] = 255; ov[p * 4 + 1] *= 0.4; ov[p * 4 + 2] = 255; }
  g.putImageData(new ImageData(ov, W, H), W + 4, 0);
  return { i: k.i, area: k.area, jpg: cv.toDataURL('image/jpeg', 0.8) };
})) : [];
await browser.close();

// Summary.
const tiers = {}, cell = (tier, band) => ((tiers[tier] ||= {})[band] ||= { events: 0, onScreen: 0, faded: 0, pops: 0, popsVisible: 0, diffPx: 0, diffFrames: 0 });
const isPop = e => e.onScreen && (e.px ?? 0) >= 3 && !e.faded;
const hidden = e => Math.max(e.fogW ?? 0, e.limitW ?? 0) >= 0.98;
for (const e of raw.events) {
  const c = cell(e.tier, bandOf(e.d));
  c.events++; if (e.onScreen) c.onScreen++; if (e.faded) c.faded++;
  if (e.tier === 'trees') { c.pops++; continue; } // a rebuild of every tree: placed nowhere, counted as one pop
  if (isPop(e)) { c.pops++; if (!hidden(e)) c.popsVisible++; }
}
const byFrame = new Map(); for (const e of raw.events) { if (!(e.onScreen || e.tier === 'trees')) continue; (byFrame.get(e.f) ?? byFrame.set(e.f, []).get(e.f)).push(e); }
const area = new Map(raw.results.map(r => [r.i, r.area]));
let unexplained = 0, total = 0;
for (const [i] of raw.captures) {
  const a = area.get(i); if (!a) continue; total += a;
  const evs = [...(byFrame.get(i) ?? []), ...(byFrame.get(i - 1) ?? [])];
  if (!evs.length) { unexplained += a; continue; }
  const ts = [...new Set(evs.map(e => e.tier))];
  for (const t of ts) { const nearest = evs.filter(e => e.tier === t).reduce((m, e) => (e.d != null && (m == null || e.d < m) ? e.d : m), null); const c = cell(t, bandOf(nearest)); c.diffPx += a / ts.length; c.diffFrames++; }
}
for (const t of Object.values(tiers)) for (const c of Object.values(t)) c.diffPx = Math.round(c.diffPx);
const secs = (raw.captures.at(-1)[1] - raw.captures[0][1]) / 1000;
const summary = { renderMs: raw.renderMs, gaps: raw.gaps, info: raw.info, gl: raw.gl, stats: raw.stats, mode, device, qs, seconds: +secs.toFixed(1), frames: raw.captures.length, fog: raw.fog, limit: raw.limit, heapMB: { start: heap0, end: raw.heapMB }, diffPxTotal: total, diffPxUnexplained: unexplained, tiers, hooked: setup.hooked, rails: setup.rails, errors };
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ summary, events: raw.events }, null, 1));
if (framesDir) { fs.mkdirSync(framesDir, { recursive: true }); dump.forEach((k, j) => fs.writeFileSync(path.join(framesDir, `${mode}-${device}-${j}-f${k.i}-${k.area}px.jpg`), Buffer.from(k.jpg.split(',')[1], 'base64'))); }
console.log(`${mode} ${device} ${qs}: ${summary.seconds}s ${summary.frames} frames; fog ${JSON.stringify(raw.fog)} limit ${JSON.stringify(raw.limit)}; diff px ${total} (unexplained ${unexplained}); heap ${heap0}->${raw.heapMB} MB`);
console.log(`render ms ${JSON.stringify(raw.renderMs)} gaps ${JSON.stringify(raw.gaps)} info ${JSON.stringify(raw.info)} far ${JSON.stringify(raw.stats.far)} groundFar ${raw.stats.groundFar}`);
console.log('tier          band       events onScreen faded POPS (visible) diffPx diffFrames');
for (const [t, bands] of Object.entries(tiers)) for (const b of ['0-250', '250-600', '600-1200', '>1200', 'unplaced']) { const c = bands[b]; if (c) console.log(`${t.padEnd(13)} ${b.padEnd(10)} ${String(c.events).padStart(6)} ${String(c.onScreen).padStart(8)} ${String(c.faded).padStart(5)} ${String(c.pops).padStart(4)} (${c.popsVisible}) ${String(c.diffPx).padStart(7)} ${c.diffFrames}`); }
if (errors.length) console.log('errors', errors.slice(0, 5));
console.log('hooked', JSON.stringify(setup.hooked));
console.log('dbg [frame, meanG, px, py, camx]', JSON.stringify(raw.dbg), 'sample events', JSON.stringify(raw.events.slice(0, 4)));
