// Colour and texture pop-in on a street ride (lane popin-colour, 2026-11-27): what changes on things already drawn.
//   PORT=4306 node scripts/pop-colour.mjs <out.json> [--route belt|ring] [--measure 60] [--warmup 6] [--speed 9] [--timing]
//     [--qs 'colourFirst=0'] [--frames <dir>] [--explore] [--device desktop|iphone]
//
// pop-bands.mjs counts residency (things arriving, leaving, swapping level); this counts the look of objects that are
// already on screen. After every frame of the shared frame's main pass the scene is walked (traverseVisible, frustum
// test on the bounding sphere) and each drawn object gets a look signature:
//   geometry   the geometry object (a swap to another geometry = LOD/rebuild) and its non-position attribute versions
//              (a colour/tint/layer attribute rewritten in place)
//   material   per material: the object (a material swap), colour, opacity, its map (null, not uploaded, uploaded,
//              version) and every texture uniform (uuid and version), and a per-object `look` key the engine may
//              publish in userData.lookKey (city-look tint state)
// A change of signature between two consecutive drawn frames of the same object is an EVENT, classified by cause:
//   material-swap, colour, map-arrive (no image -> image), map-update, uniform-texture, attr-colour, geometry-swap,
//   and logged with the object's label, its distance from the eye (bounding-sphere centre; the shared frame's world
//   has the eye at the origin), its projected radius in CSS px, whether it is fading (userData.fading, a material
//   `fade` uniform below 1, or opacity < 1), and the seconds since it was first drawn.
// --frames keeps a before/after pair (640x400) for the largest near events.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const out = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'artifacts/pop-colour/pop-colour.json';
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const route = opt('route', 'belt');
const device = opt('device', 'desktop');
const warmup = Number(opt('warmup', '6')), measure = Number(opt('measure', '60'));
const speed = Number(opt('speed', '9'));
const extraQs = opt('qs', '');
const framesDir = opt('frames', null);
const explore = argv.includes('--explore');
const origin = `http://127.0.0.1:${process.env.PORT || 4306}`;
// Routes: start and destination POI (id, or a name regex). belt crosses the canal belt (Herengracht, Keizersgracht,
// Prinsengracht) on the Raadhuisstraat axis; ring rides the 19th-century inner ring.
const ROUTES = {
  belt: { start: '^waag$', dest: 'westerkerk' },
  ring: { start: process.env.RING_START || 'westerkerk', dest: process.env.RING_DEST || 'rijksmuseum' },
};
const R = ROUTES[route] ?? (() => { const [s, d] = route.split(':'); return { start: s, dest: d }; })();

// pop-in.mjs's frame-diff worker (camera motion cancelled by a homography, residual dE76 >= --de, blobs >= --blob px at
// 640x400): a one-frame visible change that no camera motion explains. A dissolve spreads its change over ~40 frames,
// so it seldom passes the threshold; a snap does.
const popSrc = fs.readFileSync(new URL('./pop-in.mjs', import.meta.url), 'utf8');
const WORKER = /const WORKER = `([\s\S]*?)`;\n/.exec(popSrc)[1].replace('__MIN_BLOB__', opt('blob', '16')).replace(/__DE__/g, opt('de', '10'));

const browser = await chromium.launch({ headless: process.env.HEADED !== '1', executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const context = await browser.newContext(device === 'iphone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: Number(process.env.DPR || 2) });
const page = await context.newPage();
if (process.env.BUNDLES_DIR) await context.route(/\/canal-drive\/.*\.bundle\.js/, r => {
  const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(r.request().url())[1]);
  return fs.existsSync(file) ? r.fulfill({ path: file, contentType: 'application/javascript' }) : r.continue();
});
const errors = [];
page.on('pageerror', e => errors.push((e.stack || e.message).split('\n').slice(0, 6).join(' | ')));
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
const qs = `?engine=own${extraQs ? `&${extraQs.replace(/^\?/, '')}` : ''}`;
await page.goto(`${origin}/canal-drive/${qs}`);

const find = (pois, q) => pois.find(p => p.id === q) || pois.find(p => new RegExp(q, 'i').test(p.name || ''));
await page.waitForFunction(() => (window.canalRecallGame?.routePois?.length ?? 0) > 20, null, { timeout: 150_000 });
const ids = await page.evaluate(([s, d]) => {
  const pois = canalRecallGame.routePois, f = q => pois.find(p => p.id === q) || pois.find(p => new RegExp(q, 'i').test(p.name || ''));
  const a = f(s), b = f(d);
  return a && b ? { start: a.id, dest: b.id } : { missing: true, names: pois.map(p => `${p.id}:${p.name}`) };
}, [R.start, R.dest]);
if (ids.missing) { console.log('route POI not found; available:', ids.names.join(' | ')); await browser.close(); process.exit(2); }
void find;
await page.locator('#travel-mode').selectOption('car', { force: true });
await page.locator('#view-mode').selectOption('chase', { force: true });
await page.locator('#poi-destination').selectOption(ids.dest);
await page.evaluate(a => { const g = canalRecallGame; g._pickDestinationNear = () => g.routePois.find(p => p.id === a); }, ids.start);
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, { timeout: 180_000, polling: 100 });
// The rider on the route's rails at --speed m/s (pop-bands.mjs street mode).
await page.evaluate(mps => {
  const g = canalRecallGame, p = g.player, ppm = (0, eval)('PIXELS_PER_METER');
  g._quizFreezesRide = () => false; p.handleInput = () => {};
  let rails = null; try { rails = g.track.findRoute({ x: p.x, y: p.y }, g.track.finishPoint); } catch (_) {}
  if (!rails || rails.length < 2) throw new Error('no route rails');
  const cum = [0]; for (let k = 1; k < rails.length; k++) cum.push(cum[k - 1] + Math.hypot(rails[k].x - rails[k - 1].x, rails[k].y - rails[k - 1].y));
  let at = 0, seg = 1; const v = mps * ppm;
  window.__railsM = Math.round(cum[cum.length - 1] / ppm);
  p.update = function (dt) {
    if (!window.__go) { this.speed = 0; return; }
    at = Math.min(cum[cum.length - 1], at + v * dt);
    while (seg < rails.length - 1 && cum[seg] < at) seg++;
    const a = rails[seg - 1], b = rails[seg], f = (at - cum[seg - 1]) / Math.max(1e-6, cum[seg] - cum[seg - 1]);
    let d = Math.atan2(b.y - a.y, b.x - a.x) - this.angle; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.x = a.x + (b.x - a.x) * f; this.y = a.y + (b.y - a.y) * f; this.angle += d * Math.min(1, dt * 6);
    this.speed = at < cum[cum.length - 1] ? v : 0; this.vx = Math.cos(this.angle) * this.speed; this.vy = Math.sin(this.angle) * this.speed;
  };
}, speed);

// --timing: no probe (no scene walk, frame diff or screenshots). Main-thread busy time from CDP (TaskDuration,
// ScriptDuration) over the measured window, and the landmark yield's own cost (arrivalYield incl. beginYield's
// paint walk, every set, every release) by wrapping its entry points. Run under CANAL_PW_TIMING=1.
if (argv.includes('--timing')) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await page.evaluate(() => {
    const vm = canalRecallGame.vectorMap, tb = vm._threeBuildings, sl = vm._signatureLandmarks;
    const T = window.__yt = { on: false, asked: 0, begun: 0, arriveMs: 0, sets: 0, setMs: 0, releases: 0, releaseMs: 0, frames: 0, maxUsed: 0 };
    const f = sl?.onArrivalYield;
    if (typeof f === 'function') sl.onArrivalYield = e => {
      const t0 = performance.now(); const h = f(e); const dt = performance.now() - t0;
      if (T.on) { T.asked++; T.arriveMs += dt; if (h) T.begun++; T.maxUsed = Math.max(T.maxUsed, tb?.swapSlots?.used ?? 0); }
      if (!h) return h;
      return {
        set: v => { const a = performance.now(); h.set(v); if (T.on) { T.sets++; T.setMs += performance.now() - a; } },
        release: () => { const a = performance.now(); h.release(); if (T.on) { T.releases++; T.releaseMs += performance.now() - a; } },
      };
    };
    const tick = () => { if (T.on) T.frames++; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  });
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  await page.evaluate(() => { window.__go = true; });
  await page.waitForTimeout(warmup * 1000);
  const m0 = await metrics(); const w0 = Date.now();
  await page.evaluate(() => { window.__yt.on = true; });
  await page.waitForTimeout(measure * 1000);
  await page.evaluate(() => { window.__yt.on = false; });
  const m1 = await metrics(); const secs = (Date.now() - w0) / 1000;
  const T = await page.evaluate(() => window.__yt);
  const per = k => +(((m1[k] - m0[k]) * 1000) / secs).toFixed(1);
  const result = { route, qs, device, secs: +secs.toFixed(1), taskMsPerS: per('TaskDuration'), scriptMsPerS: per('ScriptDuration'), layoutMsPerS: per('LayoutDuration'), fps: +(T.frames / secs).toFixed(1), heapMB: +(m1.JSHeapUsedSize / 1048576).toFixed(0),
    yield: { asked: T.asked, begun: T.begun, maxUsed: T.maxUsed, arriveMs: +T.arriveMs.toFixed(2), sets: T.sets, setMs: +T.setMs.toFixed(2), releases: T.releases, releaseMs: +T.releaseMs.toFixed(2), totalMsPerS: +((T.arriveMs + T.setMs + T.releaseMs) / secs).toFixed(3) }, errors: errors.slice(0, 5) };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result, null, 1));
  console.log(`timing ${route} ${qs}: task ${result.taskMsPerS} ms/s, script ${result.scriptMsPerS} ms/s, ${result.fps} fps; yield ${JSON.stringify(result.yield)}`);
  await browser.close();
  process.exit(0);
}

const setup = await page.evaluate(({ explore, keepFrames, seriesEvery, workerSrc }) => {
  const g = canalRecallGame, vm = g.vectorMap, host = vm.map ?? vm.host, sf = vm._sharedFrame, THREE = sf.THREE;
  const P = window.__pc = { on: false, frame: 0, events: [], objs: new Map(), census: null, uniformChurn: {}, pairs: [], frames: 0, walkMs: [] };
  const frustum = new THREE.Frustum(), m4 = new THREE.Matrix4(), sph = new THREE.Sphere(), v = new THREE.Vector3(), v4 = new THREE.Vector4();
  const labelOf = o => {
    const parts = []; let q = o;
    for (let k = 0; k < 4 && q; k++, q = q.parent) { const n = q.userData?.key ?? q.userData?.chunkKey ?? q.name; if (n) parts.push(String(n).slice(0, 48)); }
    return parts.join(' < ') || o.type;
  };
  const texSig = t => t ? `${t.uuid.slice(0, 8)}:${t.version}:${t.image || t.source?.data ? 1 : 0}` : '-';
  // Fields per material: identity, colour, opacity, map, texture uniforms. Numeric uniforms are tracked for churn only.
  const matSig = (m, numeric) => {
    const f = { id: m.uuid.slice(0, 8), type: m.type, col: m.color ? m.color.getHexString() : '', op: m.opacity != null ? +m.opacity.toFixed(2) : 1, map: texSig(m.map) };
    const u = m.uniforms || m.userData?.shader?.uniforms;
    if (u) for (const [k, x] of Object.entries(u)) {
      const val = x?.value;
      if (val?.isTexture) f[`u.${k}`] = texSig(val);
      else if (numeric && val != null) { const s = typeof val === 'number' ? val.toFixed(3) : val.isColor ? val.getHexString() : val.isVector2 || val.isVector3 || val.isVector4 ? val.toArray().map(n => n.toFixed(3)).join(',') : null; if (s != null) numeric[`${m.type}.${k}`] = s; }
    }
    return f;
  };
  const geoSig = geo => {
    const f = { id: geo.uuid.slice(0, 8) };
    for (const [k, a] of Object.entries(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') f[`a.${k}`] = a.version;
    return f;
  };
  const fadingOf = (o, mats) => {
    if (o.userData?.fading) return true;
    for (const m of mats) { if (m.opacity < 0.999 && m.transparent) return true; const u = m.uniforms || m.userData?.shader?.uniforms; if (u) for (const k of ['fade', 'uFade', 'dissolve', 'uDissolve', 'cityFade']) { const x = u[k]?.value; if (typeof x === 'number' && x > 0.001 && x < 0.999) return true; } }
    return false;
  };
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 400;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  let prevShot = null;
  // Residency (pop-bands.mjs's hooks): arrivals, rebuilds, drops and level swaps, with whether they dissolve.
  const pendingRes = [];
  const logRes = (tier, kind, faded, obj, key) => { if (P.on) pendingRes.push({ tier, kind, faded: !!faded, obj, key: String(key ?? '') }); };
  const wrap = (obj, name, fn) => { if (!obj || typeof obj[name] !== 'function') return false; const base = obj[name]; obj[name] = function (...a) { return fn.call(this, base, a); }; return true; };
  const tb = vm._threeBuildings, bc = vm._bakedCoarse, sl = vm._signatureLandmarks, tr = vm._inventoryTrees, og = vm._ownGround;
  const tierOf = key => { const k = String(key); return k.startsWith('near:') ? 'detail' : k.startsWith('coarse') ? 'coarse' : 'chunk'; };
  P.hooked = {
    chunkInstall: wrap(tb, 'install', function (base, a) { const before = this.chunks.get(a[0])?.mesh; const r = base.apply(this, a); const m = this.chunks.get(a[0])?.mesh; if (m && m !== before) logRes(tierOf(a[0]), before ? 'rebuild' : 'arrive', this.fading?.has?.(a[0]), m, a[0]); return r; }),
    chunkDrop: wrap(tb, 'dropChunk', function (base, a) { const m = this.chunks.get(a[0])?.mesh; const r = base.apply(this, a); if (m) logRes(tierOf(a[0]), 'leave', !!a[1] && !!m.parent, m, a[0]); return r; }),
    bakedInstall: wrap(bc, 'install', function (base, a) { const r = base.apply(this, a); const res = this.residents.get(a[0].key); if (res) logRes('baked', 'arrive', !!res.fade, res.mesh, a[0].key); return r; }),
    landmarkAdd: wrap(sl, '_add', function (base, a) { const r = base.apply(this, a); const en = (this._entries || []).find(e => e.spec.id === a[0]?.id); logRes('landmark', 'arrive', !!(en && this._levelFades?.has?.(en)), en?.root ?? en?.group ?? null, a[0]?.id); return r; }),
    landmarkLevel: wrap(sl, '_swapLevel', function (base, a) { const r = base.apply(this, a); logRes('landmark', 'level', !!this._levelFades?.has?.(a[0]), a[0]?.root ?? null, `${a[0]?.spec?.id}:${a[2]}`); return r; }),
    landmarkDrop: wrap(sl, '_dropEntries', function (base, a) { const objs = (this._entries || []).filter(e => a[0]?.has?.(e.spec.id)); for (const e of objs) logRes('landmark', 'leave', false, e.holder ?? null, e.spec.id); return base.apply(this, a); }),
    landmarkCold: wrap(sl, '_dissolveWarm', function (base, a) { const r = base.apply(this, a); if (!r) logRes('landmark', 'cold-dissolve', false, null, ''); return r; }),
    trees: wrap(tr, 'rebuild', function (base, a) { this.lastFade = null; const r = base.apply(this, a); logRes('trees', 'rebuild', !!this.lastFade?.dissolved, null, ''); return r; }),
    ground: wrap(og, 'install', function (base, a) { const before = this.resident?.get?.(a[0]?.key)?.group; const r = base.apply(this, a); const now = this.resident?.get?.(a[0]?.key)?.group; if (now && now !== before) logRes('ground', before ? 'rebuild' : 'arrive', false, now, a[0]?.key); return r; }),
    appearance: wrap(tb, 'setStreetAppearance', function (base, a) { const r = base.apply(this, a); (P.marks ||= []).push({ t: performance.now(), f: P.frame, what: 'street-appearance' }); return r; }),
  };
  // Per building, the look of each tier's copy as installed (before upload frees the arrays): the dominant
  // (layer, tint) by vertex count. When a building's drawn copy changes tier, the two looks are compared (dE76 of the
  // dominant tints, and whether the layer differs): a colour hand-over, dissolved or not.
  const lab = (r, g, b) => { const f = c => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; }; const R = f(r), G = f(g), B = f(b); const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883; const h = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Z))]; };
  const looks = P.looks = new Map(); P.handovers = [];
  const readLooks = (tier, key, mesh, ranges, faded) => {
    const g = mesh?.geometry, t = g?.getAttribute('tint'), l = g?.getAttribute('layer'); if (!t?.array || !ranges) return;
    const ta = t.array, ts = t.itemSize, norm = t.normalized ? 1 : 255, la = l?.array;
    for (const [id, r] of ranges) {
      const hist = new Map();
      for (let i = r.start; i < r.start + r.count; i++) { const k = `${la ? la[i] : 0}|${Math.round(ta[i * ts] * norm)},${Math.round(ta[i * ts + 1] * norm)},${Math.round(ta[i * ts + 2] * norm)}`; hist.set(k, (hist.get(k) || 0) + 1); }
      let top = null, n = 0; for (const [k, c] of hist) if (c > n) { n = c; top = k; }
      if (!top) continue;
      const prev = looks.get(id), now = { tier, key, top };
      looks.set(id, now);
      if (P.on && prev && prev.tier !== tier) {
        const [lp, cp] = prev.top.split('|'), [ln, cn] = top.split('|'), A = lab(...cp.split(',').map(Number)), B = lab(...cn.split(',').map(Number));
        P.handovers.push({ f: P.frame, id, from: prev.tier, to: tier, dE: +Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]).toFixed(1), layerChange: lp !== ln, faded: !!faded, fromTop: prev.top, toTop: top });
      }
    }
  };
  wrap(tb, 'install', function (base, a) { const r = base.apply(this, a); const e = this.chunks.get(a[0]); if (e?.mesh) readLooks(tierOf(a[0]), a[0], e.mesh, e.ranges, this.fading?.has?.(a[0])); return r; });
  wrap(bc, 'install', function (base, a) { const r = base.apply(this, a); const res = this.residents.get(a[0].key); if (res) readLooks('baked', a[0].key, res.mesh, res.ranges, !!res.fade); return r; });
  // Why buildings hide or show: every setHidden / setGhosted reason with the ids that changed, and detail ownership.
  P.hides = [];
  const diffIds = (before, after) => { const on = [], off = []; for (const id of after) if (!before.has(id)) on.push(id); for (const id of before) if (!after.has(id)) off.push(id); return { on, off }; };
  wrap(tb, 'setHidden', function (base, a) { const before = new Set(this.hidden); const r = base.apply(this, a); const d = diffIds(before, this.hidden); if (P.on && (d.on.length || d.off.length)) P.hides.push({ f: P.frame, reason: a[0], hide: d.on.slice(0, 8), show: d.off.slice(0, 8), nHide: d.on.length, nShow: d.off.length }); return r; });
  wrap(tb, 'refreshDetailOwnership', function (base, a) { const before = new Set(this.installedDetailIds); const r = base.apply(this, a); const d = diffIds(before, this.installedDetailIds); if (P.on && (d.on.length || d.off.length)) P.hides.push({ f: P.frame, reason: 'detail-owns', hide: d.on.slice(0, 8), show: d.off.slice(0, 8), nHide: d.on.length, nShow: d.off.length }); return r; });
  P.yields = { begun: 0, refused: 0 };
  wrap(tb, 'beginYield', function (base, a) { const r = base.apply(this, a); if (P.on) { if (r) P.yields.begun++; else P.yields.refused++; } return r; });
  P.slots = { claimed: 0, missed: 0, maxUsed: 0 };
  wrap(tb, 'claimSwapSlot', function (base, a) { const r = base.apply(this, a); if (P.on) { if (r === undefined) P.slots.missed++; else P.slots.claimed++; P.slots.maxUsed = Math.max(P.slots.maxUsed, this.swapSlots?.used ?? 0); } return r; });
  const box = new THREE.Box3();
  const placeRes = (e, cam) => {
    const o = e.obj; e.obj = null; if (!o) return;
    if (o.geometry) { const g = o.geometry; if (!g.boundingSphere) { try { g.computeBoundingSphere(); } catch (_) { return; } } if (!g.boundingSphere) return; o.updateWorldMatrix?.(true, false); sph.copy(g.boundingSphere).applyMatrix4(o.matrixWorld); }
    else { box.setFromObject(o); if (box.isEmpty()) return; box.getBoundingSphere(sph); }
    const d = sph.center.length(); e.dM = +d.toFixed(1); e.nearM = +Math.max(0, d - sph.radius).toFixed(1);
    v4.set(sph.center.x, sph.center.y, sph.center.z, 1).applyMatrix4(cam.matrixWorldInverse).applyMatrix4(cam.projectionMatrix);
    e.px = v4.w > 0 ? Math.round(Math.abs(sph.radius * cam.projectionMatrix.elements[5] / v4.w) * innerHeight / 2) : 0;
    e.onScreen = frustum.intersectsSphere(sph);
  };
  const worker = new Worker(URL.createObjectURL(new Blob([workerSrc], { type: 'text/javascript' })));
  P.diff = []; P.posted = 0;
  worker.onmessage = e => { if (e.data.type !== 'result') return; P.diff.push([e.data.i, e.data.area]); const a = P.shots?.get(e.data.i - 1), b = P.shots?.get(e.data.i); if (a && b && e.data.area >= 120) { (P.diffPairs ||= []).push({ i: e.data.i, area: e.data.area, prev: a, cur: b }); P.diffPairs.sort((x, y) => y.area - x.area); P.diffPairs.length = Math.min(P.diffPairs.length, 16); } };
  P.worker = worker;
  // Walk inside the renderer's main-scene passes (the shared frame toggles each participant's wrapper per pass).
  const renderer = sf.renderer, baseRender = renderer.render.bind(renderer);
  let fEvents = [], numeric = {}, f = 0, now = 0, t0 = 0, walked = 0;
  renderer.render = (scene, camera) => {
    if (scene === sf.scene && !scene.overrideMaterial && (P.on || explore)) { const tw = performance.now(); walk(camera); walked += performance.now() - tw; }
    return baseRender(scene, camera);
  };
  const render = host._render.bind(host);
  host._render = (...a) => {
    if (!P.on && !explore) return render(...a);
    t0 = now = performance.now(); f = ++P.frame; fEvents = []; numeric = {}; walked = 0;
    const r = render(...a);
    after();
    return r;
  };
  function walk(cam) {
    cam.updateMatrixWorld?.();
    m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); frustum.setFromProjectionMatrix(m4);
    sf.scene.traverseVisible(o => {
      if (!(o.isMesh || o.isInstancedMesh || o.isBatchedMesh || o.isPoints || o.isLine || o.isSprite)) return;
      const geo = o.geometry; if (!geo) return;
      if (!geo.boundingSphere) { try { geo.computeBoundingSphere(); } catch (_) { return; } }
      if (!geo.boundingSphere || !Number.isFinite(geo.boundingSphere.radius)) return;
      sph.copy(geo.boundingSphere).applyMatrix4(o.matrixWorld);
      if (o.frustumCulled !== false && !frustum.intersectsSphere(sph)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (P.wantCensus) {
        let q = o; while (q.parent && q.parent !== sf.scene) q = q.parent;
        const k = `${q.name || q.type} | ${o.type} | ${mats.map(m => `${m.type}${m.map ? '+map' : ''}`).join(',')}`;
        const b = (P.census ||= {})[k] ||= { n: 0, uniforms: new Set(), attrs: new Set(), ud: new Set(), names: new Set() };
        b.n++; for (const m of mats) for (const u of Object.keys(m.uniforms || m.userData?.shader?.uniforms || {})) b.uniforms.add(u);
        for (const x of Object.keys(geo.attributes || {})) b.attrs.add(x);
        for (const u of Object.keys(o.userData || {})) b.ud.add(u);
        if (b.names.size < 4) b.names.add(labelOf(o));
      }
      const sig = { g: geoSig(geo), m: mats.map(m => matSig(m, P.on && P.frame % 30 === 0 ? numeric : null)), lk: o.userData?.lookKey ?? '' };
      let rec = P.objs.get(o.uuid);
      if (!rec) { rec = { first: now, firstF: f, label: labelOf(o), sig, lastF: f }; P.objs.set(o.uuid, rec); return; }
      const consecutive = rec.lastF === f - 1; const old = rec.sig; rec.sig = sig; rec.lastF = f;
      if (!consecutive || !P.on) return;
      const changes = [];
      if (old.g.id !== sig.g.id) changes.push('geometry-swap');
      else for (const k of Object.keys(sig.g)) if (k !== 'id' && old.g[k] !== sig.g[k]) changes.push(/col|tint|layer|look|slot|rec/i.test(k) ? `attr-colour:${k}` : `attr:${k}`);
      if (old.lk !== sig.lk) changes.push('look-key');
      const n = Math.max(old.m.length, sig.m.length);
      for (let i = 0; i < n; i++) {
        const a = old.m[i], b = sig.m[i];
        if (!a || !b) { changes.push('material-count'); continue; }
        if (a.id !== b.id) { changes.push(a.col !== b.col || a.map !== b.map ? 'material-swap:look' : 'material-swap'); continue; }
        if (a.col !== b.col) changes.push('colour');
        if (a.map !== b.map) { const [ua, va, ia] = a.map.split(':'), [ub, vb, ib] = b.map.split(':'); changes.push(a.map === '-' ? 'map-set' : b.map === '-' ? 'map-cleared' : ua !== ub ? 'map-swap' : (ia === '0' || va === '0') ? 'map-arrive' : 'map-update'); }
        for (const k of Object.keys(b)) if (k.startsWith('u.') && a[k] !== b[k]) { const [ua, va, ia] = (a[k] || '-::').split(':'); changes.push(`${(ia === '0' || va === '0') ? 'uniform-texture-arrive' : ua !== b[k].split(':')[0] ? 'uniform-texture-swap' : 'uniform-texture-update'}:${k.slice(2)}`); }
      }
      if (!changes.length) return;
      const c = sph.center; v.copy(c); const d = v.length();
      v4.set(c.x, c.y, c.z, 1).applyMatrix4(cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse));
      const w = v4.w, px = w > 0 ? Math.round(Math.abs(sph.radius * cam.projectionMatrix.elements[5] / w) * innerHeight / 2) : 0;
      // Distance from the eye: the bounding sphere's nearest point (a chunk's centre can be far from its near buildings).
      const near = Math.max(0, d - sph.radius);
      fEvents.push({ t: +(now / 1000).toFixed(3), f, id: o.uuid.slice(0, 8), label: rec.label, changes: [...new Set(changes)], dM: +d.toFixed(1), nearM: +near.toFixed(1), rM: +sph.radius.toFixed(1), px, fading: fadingOf(o, mats), ageS: +((now - rec.first) / 1000).toFixed(2), type: o.type });
    });
  }
  function after() {
    if (P.on && P.frame % 30 === 0) for (const [k, val] of Object.entries(numeric)) { const c = P.uniformChurn[k] ||= { last: val, changes: 0 }; if (c.last !== val) { c.changes++; c.last = val; } }
    if (P.on) {
      const cam = sf.camera;
      for (const e of pendingRes) { try { placeRes(e, cam); } catch (_) {} fEvents.push({ t: +(now / 1000).toFixed(3), f, id: '', label: e.key, changes: [`residency:${e.tier}-${e.kind}`], dM: e.dM ?? null, nearM: e.nearM ?? null, px: e.px ?? 0, onScreen: e.onScreen ?? null, fading: e.faded, ageS: null, type: e.tier }); }
      pendingRes.length = 0;
      P.events.push(...fEvents); P.frames++;
      ctx.drawImage(host.getCanvas ? host.getCanvas() : host.canvas, 0, 0, 640, 400);
      const img = ctx.getImageData(0, 0, 640, 400);
      worker.postMessage({ type: 'frame', t: now, i: f, rgba: img.data, keep: false, force: null }, [img.data.buffer]); P.posted++;
      if (keepFrames) {
        const cur = cv.toDataURL('image/jpeg', 0.7);
        const big = fEvents.filter(e => !e.fading && e.px >= 40 && e.nearM != null && e.nearM < 250 && !/treeFade|residency:trees/.test(e.changes.join())).sort((x, y) => y.px - x.px)[0];
        if (big && prevShot && P.pairs.length < 24) P.pairs.push({ f, ev: big, prev: prevShot, cur });
        if (f % seriesEvery === 0 && (P.series?.length ?? 0) < 400) (P.series ||= []).push({ f, cur });
        prevShot = cur; (P.shots ||= new Map()).set(f, cur); if (P.shots.size > 400) P.shots.delete(P.shots.keys().next().value);
      }
    }
    P.walkMs.push(walked);
  }
  if (typeof sl?.onArrivalYield === 'function') { const f = sl.onArrivalYield; sl.onArrivalYield = e => { const r = f(e); if (P.on) { P.yields.asked = (P.yields.asked || 0) + 1; if (!r) P.yields.nullAnswers = (P.yields.nullAnswers || 0) + 1; } return r; }; }
  return { rails: window.__railsM ?? null, wiring: { onArrivalYield: typeof sl?.onArrivalYield, beginYield: typeof tb?.beginYield, suppressing: sl?.suppressing, enabled: sl?.enabled } };
}, { explore, keepFrames: !!framesDir, seriesEvery: Number(opt('series-every', '60')), workerSrc: WORKER });

await page.evaluate(() => { window.__go = true; });
await page.waitForTimeout(warmup * 1000);
if (explore) {
  await page.evaluate(() => { window.__pc.wantCensus = true; });
  await page.waitForTimeout(300);
  const census = await page.evaluate(() => { const P = window.__pc; P.wantCensus = false; return Object.fromEntries(Object.entries(P.census || {}).map(([k, b]) => [k, { n: b.n, uniforms: [...b.uniforms].slice(0, 40), attrs: [...b.attrs], ud: [...b.ud], names: [...b.names] }])); });
  console.log(JSON.stringify(census, null, 1));
}
if (argv.includes('--tier-tints')) {
  // Per building in two tiers at once (a shell copy and a detail copy): mean tint of each copy and their dE76.
  const tt = await page.evaluate(() => {
    const vm = canalRecallGame.vectorMap, tb = vm._threeBuildings, bc = vm._bakedCoarse;
    const lab = ([r, g, b]) => { const f = c => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; }; const R = f(r), G = f(g), B = f(b); const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883; const h = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Z))]; };
    const copies = new Map();
    const take = (tier, mesh, ranges) => {
      const t = mesh?.geometry?.getAttribute('tint'), l = mesh?.geometry?.getAttribute('layer'); if (!t || !ranges) return;
      for (const [id, r] of ranges) {
        const hist = new Map();
        for (let i = r.start; i < r.start + r.count; i++) { const k = `${l ? l.getX(i) : 0}|${Math.round(t.getX(i) * 255)},${Math.round(t.getY(i) * 255)},${Math.round(t.getZ(i) * 255)}`; hist.set(k, (hist.get(k) || 0) + 1); }
        const [top] = [...hist.entries()].sort((a, b) => b[1] - a[1]);
        (copies.get(id) ?? copies.set(id, []).get(id)).push({ tier, top: top[0], n: r.count, kinds: hist.size });
      }
    };
    for (const [key, e] of tb.chunks) take(key.startsWith('near:') ? 'detail' : key.startsWith('coarse') ? 'coarse' : 'chunk', e.mesh, e.ranges);
    for (const [key, r] of bc?.residents ?? []) take('baked', r.mesh, r.ranges ?? r.mesh?.userData?.ranges);
    const pairs = []; const tiers = {};
    for (const [id, cs] of copies) { for (const c of cs) tiers[c.tier] = (tiers[c.tier] || 0) + 1; const d = cs.find(c => c.tier === 'detail'), s = cs.find(c => c.tier !== 'detail'); if (d && s) { const [la, ta] = d.top.split('|'), [lb, tb2] = s.top.split('|'); const A = lab(ta.split(',').map(Number)), B = lab(tb2.split(',').map(Number)); pairs.push({ id, detail: d.top, shell: s.top, shellTier: s.tier, dE: +Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]).toFixed(1), sameLayer: la === lb }); } }
    return { tiers, n: pairs.length, bakedKeys: Object.keys([...(bc?.residents?.values() ?? [])][0] ?? {}), sample: pairs.sort((a, b) => b.dE - a.dE).slice(0, 15), hist: [5, 10, 20, 40].map(t => [t, pairs.filter(p => p.dE >= t).length]), sameLayer: pairs.filter(p => p.sameLayer).length };
  });
  console.log('tier tints', JSON.stringify(tt, null, 1));
}
await page.evaluate(() => { window.__pc.on = true; });
await page.waitForTimeout(measure * 1000);
await page.evaluate(() => { window.__pc.on = false; });
await page.waitForFunction(() => window.__pc.diff.length >= window.__pc.posted - 1, null, { timeout: 900_000, polling: 1000 });
const raw = await page.evaluate(() => {
  const P = window.__pc;
  const w = P.walkMs.slice().sort((a, b) => a - b);
  return { yields: P.yields, hides: P.hides, slots: P.slots, handovers: P.handovers, diffPairs: P.diffPairs || [], diff: P.diff, marks: P.marks || [], hooked: P.hooked, events: P.events, frames: P.frames, objects: P.objs.size, churn: P.uniformChurn, pairs: P.pairs, series: P.series || [], walkP50: w[Math.floor(w.length / 2)], walkP99: w[Math.floor(w.length * 0.99)], railsM: window.__railsM };
});
await browser.close();

// Summary: events by cause, near (<250 m to the nearest point of the bounding sphere) and visible (>= 3 px, not fading).
const byCause = {};
for (const e of raw.events) for (const c of e.changes) {
  const k = c.replace(/:.*$/, (m) => (c.startsWith('attr') || c.startsWith('uniform') ? m : ''));
  const b = byCause[k] ||= { events: 0, visible: 0, near: 0, nearVisible: 0, fading: 0, labels: {} };
  b.events++; if (e.fading) b.fading++;
  const vis = !e.fading && e.px >= 3, near = e.nearM < 250;
  if (vis) b.visible++; if (near) b.near++; if (vis && near) b.nearVisible++;
  const lab = e.label.replace(/[-\d.:/]+/g, '#').slice(0, 60); b.labels[lab] = (b.labels[lab] || 0) + 1;
}
for (const b of Object.values(byCause)) b.labels = Object.fromEntries(Object.entries(b.labels).sort((x, y) => y[1] - x[1]).slice(0, 6));
// Frame diff: each frame's blob area charged to the causes of events in that frame or the one before (split evenly);
// a frame with blobs and no event is 'unexplained' (parallax, animation, the rider).
const byF = new Map(); for (const e of raw.events) { if (/treeFade/.test(e.changes.join())) continue; (byF.get(e.f) ?? byF.set(e.f, []).get(e.f)).push(e); }
const diffBy = {}; let diffTotal = 0, diffFrames = 0;
for (const [i, area] of raw.diff) {
  if (!area) continue; diffTotal += area; diffFrames++;
  const evs = [...(byF.get(i) ?? []), ...(byF.get(i - 1) ?? [])];
  const causes = [...new Set(evs.flatMap(e => e.changes.map(c => c.replace(/:[^-]*$/, m => (c.startsWith('residency') ? m : '')))))];
  if (!causes.length) { diffBy.unexplained = (diffBy.unexplained || 0) + area; continue; }
  for (const c of causes) diffBy[c] = (diffBy[c] || 0) + area / causes.length;
}
for (const k of Object.keys(diffBy)) diffBy[k] = Math.round(diffBy[k]);
// Landmark hand-overs (the signature suppression hiding the buildings a landmark replaces): a CUT is one whose frame
// (or the next) has frame-diff blobs: the old copy was still visible when it went.
const diffAt = new Map(raw.diff.filter(d => d[1]));
const sig = (raw.hides || []).filter(h => h.reason === 'signature' && h.nHide);
const cuts = sig.filter(h => diffAt.get(h.f) || diffAt.get(h.f + 1));
const landmarkHandover = { hides: sig.length, buildings: sig.reduce((n, h) => n + h.nHide, 0), cuts: cuts.length, cutPx: cuts.reduce((n, h) => n + (diffAt.get(h.f) || 0) + (diffAt.get(h.f + 1) || 0), 0), shows: (raw.hides || []).filter(h => h.nShow).length, yields: raw.yields };
const ho = raw.handovers || [];
const handover = { n: ho.length, byPair: {} };
for (const h of ho) { const k = `${h.from}->${h.to}`; const b = handover.byPair[k] ||= { n: 0, dE5: 0, dE10: 0, dE20: 0, layer: 0, faded: 0 }; b.n++; if (h.dE >= 5) b.dE5++; if (h.dE >= 10) b.dE10++; if (h.dE >= 20) b.dE20++; if (h.layerChange) b.layer++; if (h.faded) b.faded++; }
const churn = Object.fromEntries(Object.entries(raw.churn).filter(([, c]) => c.changes > 0).map(([k, c]) => [k, c.changes]));
const summary = { landmarkHandover, slots: raw.slots, handover, diffPx: { total: diffTotal, frames: diffFrames, byCause: diffBy }, marks: raw.marks, hooked: raw.hooked, route, start: ids.start, dest: ids.dest, qs, device, railsM: raw.railsM, frames: raw.frames, objects: raw.objects, walkMs: { p50: +(raw.walkP50 ?? 0).toFixed(2), p99: +(raw.walkP99 ?? 0).toFixed(2) }, byCause, uniformChurn: churn, errors: errors.slice(0, 5) };
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ summary, hides: raw.hides, handovers: ho, diff: raw.diff.filter(d => d[1]), events: raw.events }, null, 1));
if (framesDir) {
  fs.mkdirSync(framesDir, { recursive: true });
  const w = (name, url) => fs.writeFileSync(path.join(framesDir, name), Buffer.from(url.split(',')[1], 'base64'));
  raw.pairs.forEach((p, j) => { const tag = `${route}-${j}-f${p.f}-${p.ev.changes.join('+').replace(/[^\w+-]/g, '_')}-${Math.round(p.ev.nearM)}m-${p.ev.px}px`; w(`${tag}-a.jpg`, p.prev); w(`${tag}-b.jpg`, p.cur); });
  raw.diffPairs.forEach(p => { const evs = raw.events.filter(e => e.f === p.i || e.f === p.i - 1).flatMap(e => e.changes).map(c => c.replace(/[^\w-]/g, '_')); const tag = `${route}-diff-f${p.i}-${p.area}px-${[...new Set(evs)].join('+').slice(0, 80) || 'none'}`; w(`${tag}-a.jpg`, p.prev); w(`${tag}-b.jpg`, p.cur); });
  raw.series.forEach(s => w(`${route}-series-f${String(s.f).padStart(5, '0')}.jpg`, s.cur));
}
console.log(`${route} ${ids.start}->${ids.dest} ${qs}: ${raw.frames} frames, ${raw.objects} objects, rails ${raw.railsM} m, walk p50 ${summary.walkMs.p50} ms`);
console.log('cause                         events visible near nearVisible fading  top labels');
for (const [k, b] of Object.entries(byCause).sort((x, y) => y[1].events - x[1].events)) console.log(`${k.padEnd(30)} ${String(b.events).padStart(6)} ${String(b.visible).padStart(7)} ${String(b.near).padStart(4)} ${String(b.nearVisible).padStart(11)} ${String(b.fading).padStart(6)}  ${JSON.stringify(b.labels)}`);
console.log('frame diff px', diffTotal, 'in', diffFrames, 'frames; by cause', JSON.stringify(diffBy), 'marks', JSON.stringify(raw.marks));
console.log('landmark hand-overs', JSON.stringify(landmarkHandover), 'wiring', JSON.stringify(setup.wiring));
console.log('tier hand-overs', JSON.stringify(handover), 'swap slots', JSON.stringify(raw.slots));
console.log('numeric uniform churn (changes per 30-frame sample)', JSON.stringify(churn));
if (errors.length) console.log('errors', errors.slice(0, 5));
