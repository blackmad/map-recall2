// Pop-in while riding: screen area that appears or changes abruptly between consecutive frames and that camera
// motion does not explain, attributed to the streaming layer that changed.
//   PORT=4562 node scripts/pop-in.mjs [out.json] [--route car|boat] [--warmup 10] [--measure 60] [--frames dir] [--qs '?x=1']
//
// Ride: the car route is the motion-stutter route (Noorderkerk -> Westerstraat -> Leliegracht -> Westerkerk ->
// Prinsengracht -> Rozengracht -> De Hallen -> Kinkerstraat -> Westermoskee -> Chassékerk), carried on rails at 120 px/s
// in chase view; the boat route is the boat's own planned route (Westerkerk start, Amstel Hotel destination) on rails at
// 60 px/s. Desktop Chrome 1280x800, seeded Math.random, questions shown but not holding the ride.
//
// Metric. After every MapLibre render the WebGL canvas is copied at half size (640x400) and handed to a worker:
//  1. Both frames go to CIE Lab at 320x200.
//  2. Camera motion is cancelled per 8x8 block (block matching on luma at 160x100, +-8 px = +-64 screen px, then
//     refined at 320x200) - a local warp of the previous frame by the camera.
//  3. A pixel is a residual when no pixel of the warped previous frame within 1 px is within dE76 20 of it.
//  4. The residual is opened with a 3x3 element (parallax slivers and edge shimmer are thinner than 12 screen px) and
//     only connected blobs of >= 12 px (192 screen px) count.
//  Pop-in = the blob area, in screen pixels (x16), per frame and per second.
// Attribution: every streaming step that changes what is drawn is timestamped (own-ground cell arrive / LOD swap /
// far block, generic building chunk install, tile flush, regroup, ground re-base, landmark/chunk model arrive and LOD
// swap, tree rebuild, basemap tile). A frame's blobs are charged to the steps between the previous capture and this
// one (or the one before); a frame with blobs and no step is "unexplained" (motion residual, animation).
// Output: the per-source table, per-second series, and with --frames <dir> strips of the largest events (previous,
// current, residual mask) as PNG.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const out = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'artifacts/pop-in/pop-in.json';
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const route = opt('route', 'car');
const warmup = Number(opt('warmup', '10')), measure = Number(opt('measure', '60'));
const framesDir = opt('frames', null);
const qs = opt('qs', '');
const runs = Number(opt('runs', '1'));
const port = process.env.PORT || 4562;
const origin = `http://127.0.0.1:${port}`;

const ROUTES = {
  car: { mode: 'car', start: 'lm-extract_landmarks_433737872', dest: 'lm-extract_landmarks_1632187034', speed: 120,
    via: ['lm-extract_landmarks_660242980', 'lm-extract_landmarks_238467800', 'westerkerk', 'lm-extract_landmarks_941219842',
      'lm-extract_landmarks_1997051448', 'lm-extract_landmarks_564717297', 'lm-extract_landmarks_155371643', 'lm-extract_landmarks_1632187034', 'lm-requested-chassekerk'] },
  boat: { mode: 'boat', start: 'westerkerk', dest: 'lm-amstel-hotel', speed: 60, via: [] },
};
const R = ROUTES[route];
if (!R) throw new Error(`unknown route ${route}`);
if (opt('speed', null)) R.speed = Number(opt('speed'));

// ------------------------------------------------------------------ analysis worker (runs in the page)
const WORKER = `
// Frames arrive at 640x400 (2 screen px per pixel). Motion: 8x8 blocks on luma at 160x100 (+-8 = +-64 screen px),
// then 4x4 blocks at 320x200 choosing among the neighbouring coarse motions; residual at 640x400.
const FW = 640, FH = 400, W = 320, H = 200, CW = 160, CH = 100, B = 8, SR = 8;
const lin = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; lin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
function lab(rgba) {
  const n = FW * FH, L = new Float32Array(n), A = new Float32Array(n), Bb = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4, r = lin[rgba[o]], g = lin[rgba[o + 1]], b = lin[rgba[o + 2]];
    const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    const fx = f(X), fy = f(Y), fz = f(Z);
    L[i] = 116 * fy - 16; A[i] = 500 * (fx - fy); Bb[i] = 200 * (fy - fz);
  }
  const down = (src, w, h) => { const o = new Float32Array((w / 2) * (h / 2)); for (let y = 0; y < h / 2; y++) for (let x = 0; x < w / 2; x++) { const i = y * 2 * w + x * 2; o[y * (w / 2) + x] = (src[i] + src[i + 1] + src[i + w] + src[i + w + 1]) / 4; } return o; };
  const ML = down(L, FW, FH), MA = down(A, FW, FH), MB = down(Bb, FW, FH);
  return { FL: L, FA: A, FB: Bb, L: ML, A: MA, B: MB, C: down(ML, W, H) };
}
let prev = null, prevRgba = null;
const keep = []; const KEEP = 24; const forced = [];
function sad(cur, pv, bx, by, sx, sy, w, h, b, best) {
  let s = 0;
  for (let y = by; y < by + b && y < h; y++) {
    const yy = Math.min(h - 1, Math.max(0, y + sy));
    for (let x = bx; x < bx + b && x < w; x++) { const xx = Math.min(w - 1, Math.max(0, x + sx)); s += Math.abs(cur[y * w + x] - pv[yy * w + xx]); }
    if (s >= best) return s;
  }
  return s;
}

function solve(A, bb) { // Gaussian elimination, n x n
  const n = bb.length;
  for (let c0 = 0; c0 < n; c0++) {
    let piv = c0; for (let r = c0 + 1; r < n; r++) if (Math.abs(A[r][c0]) > Math.abs(A[piv][c0])) piv = r;
    if (Math.abs(A[piv][c0]) < 1e-12) return null;
    [A[c0], A[piv]] = [A[piv], A[c0]]; [bb[c0], bb[piv]] = [bb[piv], bb[c0]];
    for (let r = c0 + 1; r < n; r++) { const f = A[r][c0] / A[c0][c0]; for (let k = c0; k < n; k++) A[r][k] -= f * A[c0][k]; bb[r] -= f * bb[c0]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = bb[r]; for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k]; x[r] = s / A[r][r]; }
  return x;
}
function homographyLS(ps) { // least squares, h33 = 1; coordinates normalised by 1/640
  const S = 1 / 640, A = Array.from({ length: 8 }, () => new Array(8).fill(0)), bb = new Array(8).fill(0);
  for (const [x0, y0, u0, v0] of ps) {
    const x = x0 * S, y = y0 * S, u = u0 * S, v = v0 * S;
    for (const [row, rhs] of [[[x, y, 1, 0, 0, 0, -x * u, -y * u], u], [[0, 0, 0, x, y, 1, -x * v, -y * v], v]]) {
      for (let r = 0; r < 8; r++) { bb[r] += row[r] * rhs; for (let k = 0; k < 8; k++) A[r][k] += row[r] * row[k]; }
    }
  }
  const h = solve(A, bb); if (!h) return null;
  // back to pixel units: H_px = D^-1 H D with D = diag(S, S, 1)
  return [h[0], h[1], h[2] / S, h[3], h[4], h[5] / S, h[6] * S, h[7] * S];
}
const apply = (H, x, y) => { const w = H[6] * x + H[7] * y + 1; return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]; };
let seed = 1; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
function fitHomography(ps) {
  const I = [1, 0, 0, 0, 1, 0, 0, 0];
  if (ps.length < 8) return I;
  let best = null, bestIn = -1;
  for (let it = 0; it < 150; it++) {
    const s4 = []; for (let k = 0; k < 4; k++) s4.push(ps[(rnd() * ps.length) | 0]);
    const H = homographyLS(s4); if (!H) continue;
    let n = 0; for (const q of ps) { const [u, v] = apply(H, q[0], q[1]); if ((u - q[2]) ** 2 + (v - q[3]) ** 2 < 25) n++; }
    if (n > bestIn) { bestIn = n; best = H; }
  }
  if (!best) return I;
  const inl = ps.filter(q => { const [u, v] = apply(best, q[0], q[1]); return (u - q[2]) ** 2 + (v - q[3]) ** 2 < 25; });
  return (inl.length >= 8 && homographyLS(inl)) || best;
}
function analyse(c, p) {
  const nbx = Math.ceil(CW / B), nby = Math.ceil(CH / B);
  const shift = new Int8Array(nbx * nby * 2);
  for (let j = 0; j < nby; j++) for (let i = 0; i < nbx; i++) {
    const bx = i * B, by = j * B;
    let best = sad(c.C, p.C, bx, by, 0, 0, CW, CH, B, Infinity), bsx = 0, bsy = 0;
    for (let sy = -SR; sy <= SR; sy += 2) for (let sx = -SR; sx <= SR; sx += 2) { const s = sad(c.C, p.C, bx, by, sx, sy, CW, CH, B, best); if (s < best) { best = s; bsx = sx; bsy = sy; } }
    const cx = bsx, cy = bsy;
    for (let sy = cy - 1; sy <= cy + 1; sy++) for (let sx = cx - 1; sx <= cx + 1; sx++) { const s = sad(c.C, p.C, bx, by, sx, sy, CW, CH, B, best); if (s < best) { best = s; bsx = sx; bsy = sy; } }
    shift[(j * nbx + i) * 2] = bsx * 2; shift[(j * nbx + i) * 2 + 1] = bsy * 2;
  }
  // Camera motion as one homography (the ground plane's image motion; buildings deviate by their parallax, a
  // pixel or two per frame at riding speed): RANSAC over the textured blocks' vectors, then a least-squares refit.
  const pts = [];
  for (let j = 0; j < nby; j++) for (let i = 0; i < nbx; i++) {
    const bx = i * B, by = j * B; let m = 0, v = 0, n = 0;
    for (let y = by; y < by + B && y < CH; y++) for (let x = bx; x < bx + B && x < CW; x++) { const q = c.C[y * CW + x]; m += q; v += q * q; n++; }
    m /= n; v = v / n - m * m;
    if (v < 4) continue; // flat block: its motion is unknown
    const x = (bx + B / 2) * 4, y = (by + B / 2) * 4; // 640x400 coordinates
    pts.push([x, y, x + shift[(j * nbx + i) * 2] * 2, y + shift[(j * nbx + i) * 2 + 1] * 2]);
  }
  const H = fitHomography(pts);
  // Residual at 640x400: no pixel of the warped previous frame within 2 px (4 screen px) is within dE of it, and
  // nor is the same pixel of the previous frame (screen-fixed: the rider).
  const res = new Uint8Array(FW * FH);
  const ferr = (i, q) => { const dl = c.FL[i] - p.FL[q], da = c.FA[i] - p.FA[q], db = c.FB[i] - p.FB[q]; return dl * dl + da * da + db * db; };
  const EDGE = 16; // 32 screen px at the frame edge: content entering the view is not judged
  for (let y = EDGE; y < FH - EDGE; y++) for (let x = EDGE; x < FW - EDGE; x++) {
    const i = y * FW + x;
    let ok = false;
    for (let dy = -1; dy <= 1 && !ok; dy++) for (let dx = -1; dx <= 1 && !ok; dx++) if (ferr(i, (y + dy) * FW + x + dx) <= DE2) ok = true;
    if (ok) continue;
    const w = H[6] * x + H[7] * y + 1, wx = Math.round((H[0] * x + H[1] * y + H[2]) / w), wy = Math.round((H[3] * x + H[4] * y + H[5]) / w);
    for (let dy = -2; dy <= 2 && !ok; dy++) for (let dx = -2; dx <= 2 && !ok; dx++) {
      const xx = wx + dx, yy = wy + dy;
      if (xx < 0 || yy < 0 || xx >= FW || yy >= FH) { ok = true; break; } // entering from outside the frame: not judged
      if (ferr(i, yy * FW + xx) <= DE2) ok = true;
    }
    if (!ok) res[i] = 1;
  }
  // Opening with a 3x3 element: slivers under 6 screen px (parallax, edge shimmer) go.
  const er = new Uint8Array(FW * FH);
  for (let y = 1; y < FH - 1; y++) for (let x = 1; x < FW - 1; x++) {
    const i = y * FW + x; if (!res[i]) continue;
    if (res[i - 1] && res[i + 1] && res[i - FW] && res[i + FW] && res[i - FW - 1] && res[i - FW + 1] && res[i + FW - 1] && res[i + FW + 1]) er[i] = 1;
  }
  const op = new Uint8Array(FW * FH);
  for (let y = 1; y < FH - 1; y++) for (let x = 1; x < FW - 1; x++) {
    const i = y * FW + x; if (!er[i]) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) op[i + dy * FW + dx] = 1;
  }
  const labl = new Int32Array(FW * FH); const blobs = []; const stack = [];
  for (let s0 = 0; s0 < FW * FH; s0++) {
    if (!op[s0] || labl[s0]) continue;
    const id = blobs.length + 1; let n = 0, x0 = FW, y0 = FH, x1 = 0, y1 = 0; stack.push(s0); labl[s0] = id;
    while (stack.length) {
      const i = stack.pop(), x = i % FW, y = (i / FW) | 0; n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= FW || yy >= FH) continue;
        const q = yy * FW + xx; if (op[q] && !labl[q]) { labl[q] = id; stack.push(q); }
      }
    }
    blobs.push({ id, n, x0, y0, x1, y1 });
  }
  // Blobs of >= 16 px (64 screen px, an 8x8 patch) count.
  const kept = blobs.filter(b => b.n >= MIN_BLOB);
  const keepIds = new Set(kept.map(b => b.id));
  const mask = new Uint8Array(FW * FH);
  if (kept.length) for (let i = 0; i < FW * FH; i++) if (keepIds.has(labl[i])) mask[i] = 1;
  return { area: kept.reduce((a, b) => a + b.n, 0) * 4, raw: res.reduce((a, b) => a + b, 0) * 4, blobs: kept.sort((a, b) => b.n - a.n).slice(0, 4).map(b => ({ n: b.n * 4, box: [b.x0 * 2, b.y0 * 2, (b.x1 + 1) * 2, (b.y1 + 1) * 2] })), mask };
}
const MIN_BLOB = __MIN_BLOB__, DE2 = __DE__ * __DE__;
onmessage = e => {
  const m = e.data;
  if (m.type === 'frame') {
    const cur = lab(m.rgba);
    let r = null;
    if (prev) {
      r = analyse(cur, prev);
      if (m.force && forced.length < 40) forced.push({ t: m.t, i: m.i, area: r.area, prev: prevRgba, cur: m.rgba, mask: r.mask, blobs: r.blobs, force: m.force });
      if (r.area >= 400 && m.keep && (keep.length < KEEP || r.area > keep[keep.length - 1].area)) {
        keep.push({ t: m.t, i: m.i, area: r.area, prev: prevRgba, cur: m.rgba, mask: r.mask, blobs: r.blobs });
        keep.sort((a, b) => b.area - a.area); if (keep.length > KEEP) keep.length = KEEP;
      }
      postMessage({ type: 'result', t: m.t, i: m.i, area: r.area, raw: r.raw, blobs: r.blobs });
    }
    prev = cur; prevRgba = m.rgba;
  } else if (m.type === 'reset') { prev = null; prevRgba = null; }
  else if (m.type === 'dump') postMessage({ type: 'dump', keep: [...keep, ...forced] });
};
`;

async function run(browser, n) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push((e.stack || e.message).split('\n').slice(0, 14).join(' | ')));
  let bytes = 0, requests = 0;
  page.on('response', async r => { try { const len = Number(r.headers()['content-length'] || 0); bytes += len; requests++; } catch (_) {} });
  // The game skips the start-of-ride flight under automation; a player always has it (--no-intro skips it too).
  // --flags k=v,...: window.__canalRecall<K> = v before the game boots (e.g. LookAhead=false for the A/B).
  const flags = Object.fromEntries((opt('flags', '') || '').split(',').filter(Boolean).map(kv => { const [k, v] = kv.split('='); return [`__canalRecall${k}`, v === 'true' ? true : v === 'false' ? false : Number.isFinite(Number(v)) ? Number(v) : v]; }));
  await page.addInitScript(([intro, flags]) => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; if (intro) window.__canalRecallForceIntro = true; Object.assign(window, flags); }, [!argv.includes('--no-intro'), flags]);
  // --net <latency ms>,<Mbit/s>: a player's connection to the hosted game (localhost serves every tile at once).
  const net = opt('net', null);
  if (net) {
    const [latency, mbps] = net.split(',').map(Number);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency, downloadThroughput: mbps * 125000, uploadThroughput: mbps * 125000 / 4 });
  }
  // --cpu <rate>: a slower machine (CDP CPU throttling of the page's main thread), so streaming falls behind the way
  // it does on a loaded or older computer, deterministically instead of by whatever else the machine runs.
  const cpu = Number(opt('cpu', '1'));
  if (cpu > 1) { const c = await context.newCDPSession(page); await c.send('Emulation.setCPUThrottlingRate', { rate: cpu }); }
  await page.goto(`${origin}/canal-drive/${qs}`);
  await page.waitForFunction(([a, b]) => window.canalRecallGame?.routePois?.some(p => p.id === a) && window.canalRecallGame.routePois.some(p => p.id === b), [R.start, R.dest], { timeout: 120_000 });
  await page.locator('#travel-mode').selectOption(R.mode, { force: true });
  await page.locator('#view-mode').selectOption('chase', { force: true });
  await page.locator('#poi-destination').selectOption(R.dest);
  await page.evaluate(a => { const g = canalRecallGame; g._pickDestinationNear = () => g.routePois.find(p => p.id === a); }, R.start);
  await page.locator('#route-card').evaluate(f => f.requestSubmit());
  // --from flight: measure from the start of the flight (the rider is held until it lands); default: from the landing.
  await page.waitForFunction(fromFlight => canalRecallGame.state === 4 && (fromFlight || canalRecallGame.camera.introOverview === 0), opt('from', 'landing') === 'flight', { timeout: 150_000, polling: 16 });
  const setup = await page.evaluate(([via, speed, workerSrc]) => {
    const g = canalRecallGame, p = g.player, vm = g.vectorMap, map = vm.map;
    g._quizFreezesRide = () => false;
    p.handleInput = () => {};
    const l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER');
    const world = (lat, lng) => ({ x: l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y: l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm });
    const stops = [{ x: p.x, y: p.y }, ...(via.length ? via.map(id => g.routePois.find(q => q.id === id)).filter(Boolean).map(q => world(q.lat, q.lng)) : [g.track.finishPoint])];
    const path = [];
    for (let k = 1; k < stops.length; k++) { let leg = null; try { leg = g.track.findRoute(stops[k - 1], stops[k]); } catch (_) {} if (leg && leg.length > 1) path.push(...(path.length ? leg.slice(1) : leg)); }
    const cum = [0]; for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + Math.hypot(path[k].x - path[k - 1].x, path[k].y - path[k - 1].y));
    let at = 0, seg = 1;
    if (path.length > 1) p.update = function (dt) {
      at = Math.min(cum[cum.length - 1], at + speed * dt);
      while (seg < path.length - 1 && cum[seg] < at) seg++;
      const a = path[seg - 1], b = path[seg], f = (at - cum[seg - 1]) / Math.max(1e-6, cum[seg] - cum[seg - 1]);
      let d = Math.atan2(b.y - a.y, b.x - a.x) - this.angle; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.x = a.x + (b.x - a.x) * f; this.y = a.y + (b.y - a.y) * f; this.angle += d * Math.min(1, dt * 6);
      this.speed = at < cum[cum.length - 1] ? speed : 0; this.vx = Math.cos(this.angle) * this.speed; this.vy = Math.sin(this.angle) * this.speed;
    };
    // Streaming steps that change the picture.
    const P = window.__pop = { events: [], results: [], captures: [], on: false, frame: 0 };
    const ev = (obj, key, kind, detail) => {
      if (!obj || typeof obj[key] !== 'function') return false;
      const o = obj[key];
      obj[key] = function (...a) { const k = typeof kind === 'function' ? kind.apply(this, a) : kind; const r = o.apply(this, a); if (k && P.on) { P.events.push([performance.now(), k, detail ? detail.apply(this, a) : '']); if (P.watch && P.watch.includes(k)) P.force = { kind: k, left: 2 }; } return r; };
      return true;
    };
    const og = vm._ownGround, tb = vm._threeBuildings, sl = vm._signatureLandmarks;
    const hooked = {
      groundCell: ev(og, 'install', function (cell) { return this.resident.has(cell.key) ? 'ground-lod' : 'ground-cell'; }, cell => `${cell.key}/lod${cell.lod}`),
      groundFar: ev(og, 'installFar', 'ground-far', b => b.key),
      groundOverlays: ev(og, 'rebuildOverlays', 'ground-overlays'),
      chunk: ev(tb, 'install', function (key) { return String(key).startsWith('coarse') ? 'buildings-coarse' : 'buildings-chunk'; }, key => String(key)),
      tileFlush: ev(vm._completeCity, 'flush', 'tile-flush'),
      regroup: ev(tb, 'setFeatures', 'regroup'),
      bases: ev(tb, 'refreshGroundBases', 'buildings-rebase'),
      landmark: ev(sl, '_add', (scene, spec) => spec.buildingCategory === 'street-survey' || spec.assetKind === 'ordinary-building' ? 'street-chunk-model' : 'landmark-model', (scene, spec) => spec.id),
      landmarkLod: ev(sl, '_swapLevel', 'landmark-lod', (entry, inc, level) => `${entry.spec.id}:${level}`),
      trees: ev(vm._inventoryTrees, 'rebuild', 'trees'),
    };
    map.on('data', e => { if (P.on && e.dataType === 'source' && e.tile && e.sourceId) P.events.push([performance.now(), 'basemap-tile', e.sourceId]); });
    // Capture after every render.
    const worker = new Worker(URL.createObjectURL(new Blob([workerSrc], { type: 'text/javascript' })));
    P.worker = worker;
    worker.onmessage = e => { if (e.data.type === 'result') P.results.push(e.data); else if (e.data.type === 'dump') P.dump = e.data.keep; };
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 400;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const render = map._render.bind(map);
    map._render = (...a) => {
      const r = render(...a);
      if (P.on) {
        const t = performance.now();
        ctx.drawImage(map.getCanvas(), 0, 0, 640, 400);
        const img = ctx.getImageData(0, 0, 640, 400);
        if (P.shots === undefined) { P.shots = (window.__popShots || []).slice(); P.shotUrls = []; }
        P.captureMs = (P.captureMs || 0) + performance.now() - t;
        const i = P.frame++;
        if (i % 60 === 0) { const c = map.getCenter(); P.track = P.track || []; P.track.push([+(t / 1000).toFixed(1), +c.lat.toFixed(5), +c.lng.toFixed(5), +map.getZoom().toFixed(2), +map.getPitch().toFixed(0)]); }
        const cap = [i, t, p.x, p.y, map.getBearing(), map.getPitch(), map.getZoom(), g.camera.introOverview || 0], last = P.captures[P.captures.length - 1];
        P.captures.push(cap);
        // Frames the summary does not judge (hitch, turn; see summarise) are not kept as strips either.
        const turned = last && !(cap[7] > 0 || last[7] > 0) && (Math.abs(((cap[4] - last[4] + 540) % 360) - 180) > 2 || Math.abs(cap[5] - last[5]) > 1 || Math.abs(cap[6] - last[6]) > 0.02);
        const unjudged = !last || t - last[1] > 50 || turned;
        // --shots: the whole frame at fixed seconds into the measurement (the start of a ride, side by side).
        if (P.shots && P.shots.length) { P.t0 ??= t; if (t - P.t0 >= P.shots[0] * 1000) { const sec = P.shots.shift(); const sc = document.createElement('canvas'); sc.width = 480; sc.height = 300; sc.getContext('2d').drawImage(cv, 0, 0, 480, 300); P.shotUrls.push([sec, sc]); } }
        let force = null; if (P.force && P.force.left-- > 0) force = P.force.kind; else P.force = null;
        worker.postMessage({ type: 'frame', t, i, rgba: img.data, keep: P.keepFrames && !unjudged, force }, [img.data.buffer]);
      }
      return r;
    };
    const c0 = map.getCenter();
    return { railPx: Math.round(cum[cum.length - 1] || 0), hooked, ppm, startLngLat: [+c0.lng.toFixed(5), +c0.lat.toFixed(5)] };
  }, [R.via, R.speed, WORKER.replace('__MIN_BLOB__', opt('min-blob', '16')).replace(/__DE__/g, opt('de', '20'))]);
  await page.waitForTimeout(warmup * 1000);
  const heap0 = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
  const net0 = { bytes, requests };
  // --watch kind,kind: also keep the two frames after each such step, whatever their pop-in (to check the detector).
  await page.evaluate(shots => { window.__popShots = shots; }, opt('shots', '').split(',').filter(Boolean).map(Number));
  await page.evaluate(([keepFrames, watch]) => { window.__pop.keepFrames = keepFrames; window.__pop.watch = watch; window.__pop.on = true; }, [!!framesDir, opt('watch', '').split(',').filter(Boolean)]);
  // --calibrate: known pops (trees off and on, then every landmark off and on) to check the detector sees them.
  if (argv.includes('--calibrate')) await page.evaluate(() => {
    const vm = canalRecallGame.vectorMap, P = window.__pop, mark = k => P.events.push([performance.now(), k, '']);
    const tr = vm._inventoryTrees, sl = vm._signatureLandmarks, tb = vm._threeBuildings;
    setTimeout(() => { tr.enabled = false; vm.map.triggerRepaint(); mark('calib-trees-off'); }, 4000);
    setTimeout(() => { tr.enabled = true; vm.map.triggerRepaint(); mark('calib-trees-on'); }, 5000);
    setTimeout(() => { tb.setVisible(false); mark('calib-buildings-off'); }, 8000);
    setTimeout(() => { tb.setVisible(true); mark('calib-buildings-on'); }, 9000);
  });
  await page.waitForTimeout(measure * 1000);
  await page.evaluate(() => { window.__pop.on = false; window.__pop.worker.postMessage({ type: 'dump' }); });
  await page.waitForFunction(() => window.__pop.dump && window.__pop.results.length >= window.__pop.captures.length - 1, null, { timeout: 600_000, polling: 1000 });
  const raw = await page.evaluate(() => {
    const P = window.__pop;
    return { events: P.events, results: P.results, captures: P.captures, track: P.track, captureMs: P.captureMs, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
      distancePx: null, og: canalRecallGame.vectorMap._ownGround?.status?.() ?? null };
  });
  // Strips (previous | current | residual blobs in magenta) composed in the page, returned as PNG data URLs.
  const dump = framesDir ? await page.evaluate(() => window.__pop.dump.filter((k, j) => j < 12 || k.force).map(k => {
    const W = 640, H = 400, cv = document.createElement('canvas'); cv.width = W * 3 + 8; cv.height = H;
    const g = cv.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, cv.width, H);
    const ov = new Uint8ClampedArray(k.cur);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!k.mask[y * W + x]) continue;
      const o = (y * W + x) * 4; ov[o] = ov[o] * 0.4 + 153; ov[o + 1] = ov[o + 1] * 0.4; ov[o + 2] = ov[o + 2] * 0.4 + 153;
    }
    g.putImageData(new ImageData(new Uint8ClampedArray(k.prev), W, H), 0, 0);
    g.putImageData(new ImageData(new Uint8ClampedArray(k.cur), W, H), W + 4, 0);
    g.putImageData(new ImageData(ov, W, H), 2 * W + 8, 0);
    return { i: k.i, t: k.t, area: k.area, force: k.force, png: cv.toDataURL('image/png') };
  })) : [];
  // The --shots contact sheet: 4 across, each labelled with its second.
  const sheet = await page.evaluate(() => {
    const shots = window.__pop.shotUrls || [];
    if (!shots.length) return null;
    const cols = 4, rows = Math.ceil(shots.length / cols), W = 480, H = 300;
    const cv = document.createElement('canvas'); cv.width = cols * (W + 4); cv.height = rows * (H + 4);
    const g = cv.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, cv.width, cv.height);
    shots.forEach(([sec, c], j) => { const x = (j % cols) * (W + 4), y = Math.floor(j / cols) * (H + 4); g.drawImage(c, x, y); g.fillStyle = '#000a'; g.fillRect(x, y, 70, 26); g.fillStyle = '#fff'; g.font = 'bold 18px sans-serif'; g.fillText(`${sec} s`, x + 8, y + 19); });
    return cv.toDataURL('image/png');
  });
  if (sheet && framesDir) { fs.mkdirSync(framesDir, { recursive: true }); fs.writeFileSync(path.join(framesDir, `${route}-run${n}-shots.png`), Buffer.from(sheet.split(',')[1], 'base64')); }
  await context.close();
  return { n, setup, raw, dump, errors, heap0, net: { bytes: bytes - net0.bytes, requests: requests - net0.requests } };
}

const HITCH_MS = 50, TURN_DEG = 2, TILT_DEG = 1, ZOOM_STEP = 0.02;
function summarise(r) {
  const { raw } = r;
  const caps = raw.captures; // [i, t, x, y]
  const byI = new Map(raw.results.map(x => [x.i, x]));
  const evs = raw.events.sort((a, b) => a[0] - b[0]);
  const t0 = caps[0][1], t1 = caps[caps.length - 1][1], secs = (t1 - t0) / 1000;
  const sources = {}; const add = (k, area, solo) => { const s = sources[k] ||= { frames: 0, area: 0, soloFrames: 0, soloArea: 0, events: 0 }; s.frames++; s.area += area; if (solo) { s.soloFrames++; s.soloArea += area; } };
  for (const e of evs) (sources[e[1]] ||= { frames: 0, area: 0, soloFrames: 0, soloArea: 0, events: 0 }).events++;
  const perSecond = Array.from({ length: Math.ceil(secs) + 1 }, () => 0);
  const events = [];
  let ei = 0, total = 0, framesWithPop = 0, hitches = 0, hitchArea = 0, turns = 0, turnArea = 0;
  for (let k = 1; k < caps.length; k++) {
    const res = byI.get(caps[k][0]); if (!res) continue;
    const lo = caps[Math.max(0, k - 2)][1], hi = caps[k][1];
    // A long frame moves the camera further than the motion search reaches (and is a stutter, not a pop): not judged.
    if (hi - caps[k - 1][1] > HITCH_MS) { hitches++; hitchArea += res.area; continue; }
    // A camera that turned, tilted or zoomed by more than a homography explains for a tall scene (the chase
    // camera orbits the rider, so a turn is parallax, not a plane): not judged either.
    const db = Math.abs(((caps[k][4] - caps[k - 1][4] + 540) % 360) - 180);
    // (Not during the start flight: it zooms every frame by design, looking straight down at a flat city.)
    const flying = caps[k][7] > 0 || caps[k - 1][7] > 0;
    if (!flying && (db > TURN_DEG || Math.abs(caps[k][5] - caps[k - 1][5]) > TILT_DEG || Math.abs(caps[k][6] - caps[k - 1][6]) > ZOOM_STEP)) { turns++; turnArea += res.area; continue; }
    while (ei < evs.length && evs[ei][0] <= lo) ei++;
    const kinds = new Set(); for (let j = ei; j < evs.length && evs[j][0] <= hi; j++) kinds.add(evs[j][1]);
    if (!res.area) continue;
    framesWithPop++; total += res.area;
    perSecond[Math.floor((hi - t0) / 1000)] += res.area;
    // Basemap tiles land nearly every frame (dozens a second) and mostly far off: they are charged only alone.
    if (kinds.size > 1) kinds.delete('basemap-tile');
    const ks = kinds.size ? [...kinds] : ['unexplained'];
    // Area is split evenly between the steps that coincide; "solo" counts frames with a single step.
    for (const kd of ks) add(kd, res.area / ks.length, ks.length === 1);
    events.push({ i: caps[k][0], atS: +((hi - t0) / 1000).toFixed(2), area: res.area, kinds: ks, blobs: res.blobs });
  }
  for (const s of Object.values(sources)) { s.area = Math.round(s.area); s.soloArea = Math.round(s.soloArea); s.pxPerS = Math.round(s.area / secs); }
  const frameArea = 1280 * 800;
  return {
    seconds: +secs.toFixed(1), frames: caps.length, analysed: raw.results.length, hitchFramesSkipped: hitches, hitchFramesPopPx: hitchArea, turnFramesSkipped: turns, turnFramesPopPx: turnArea, captureMsPerFrame: +(raw.captureMs / caps.length).toFixed(2),
    popPxPerS: Math.round(total / secs), popScreensPerMin: +((total / frameArea) / secs * 60).toFixed(3), framesWithPop,
    bigEvents: events.filter(e => e.area >= 1280 * 800 * 0.005).length,
    sources: Object.fromEntries(Object.entries(sources).sort((a, b) => b[1].area - a[1].area)),
    perSecond: perSecond.map(Math.round),
    top: events.sort((a, b) => b.area - a.area).slice(0, 25),
    track: raw.track, ground: raw.og ? { built: raw.og.built, buildMsMedian: raw.og.buildMsMedian, latencyMsMedian: raw.og.latencyMsMedian, latencyMsMax: raw.og.latencyMsMax } : null, heapMB: { start: r.heap0, end: raw.heapMB }, net: r.net, railPx: r.setup.railPx, startLngLat: r.setup.startLngLat, hooked: r.setup.hooked, errors: r.errors.slice(0, 5),
  };
}

async function strips(dump, dir, tag) {
  fs.mkdirSync(dir, { recursive: true });
  return dump.map((k, j) => {
    const file = path.join(dir, `${tag}-${k.force ? `watch-${k.force}-` : ''}${String(j).padStart(2, '0')}-f${k.i}-${k.area}px.png`);
    fs.writeFileSync(file, Buffer.from(k.png.split(',')[1], 'base64'));
    return file;
  });
}

const report = s => {
  console.log(`${route} run ${s.run}: ${s.seconds}s pop ${s.popPxPerS} px/s (${s.popScreensPerMin} screens/min), frames with pop ${s.framesWithPop}/${s.frames} (skipped: hitches ${s.hitchFramesSkipped}, turns ${s.turnFramesSkipped}; capture ${s.captureMsPerFrame} ms/frame), big ${s.bigEvents}, heap ${s.heapMB.start}->${s.heapMB.end} MB, net ${(s.net.bytes / 1e6).toFixed(1)} MB/${s.net.requests} req`);
  for (const [k, v] of Object.entries(s.sources)) console.log(`  ${k.padEnd(20)} ${String(v.pxPerS).padStart(7)} px/s  frames ${v.frames} (solo ${v.soloFrames}, ${v.soloArea} px)  events ${v.events}`);
  if (s.errors.length) console.log('  errors', s.errors);
};
// --resummarise <json>: recompute the summaries from a run's saved raw data (filters tuned after the fact).
if (opt('resummarise', null)) {
  const saved = JSON.parse(fs.readFileSync(opt('resummarise'), 'utf8'));
  saved.results = saved.results.map((s, n) => { const again = { ...summarise(s.rawRun), run: n, raw: undefined, rawRun: s.rawRun, strips: s.strips }; report(again); return again; });
  fs.writeFileSync(out, JSON.stringify(saved, null, 1));
  console.log('wrote', out);
  process.exit(0);
}
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const results = [];
for (let n = 0; n < runs; n++) {
  const r = await run(browser, n);
  const s = { ...summarise(r), run: n };
  if (framesDir) s.strips = await strips(r.dump, framesDir, `${route}-run${n}`);
  // The raw series, for --resummarise: captures, per-frame results (no masks) and the streaming steps.
  s.rawRun = { raw: { captures: r.raw.captures, results: r.raw.results, events: r.raw.events, track: r.raw.track, captureMs: r.raw.captureMs, heapMB: r.raw.heapMB, og: r.raw.og }, setup: r.setup, errors: r.errors, heap0: r.heap0, net: r.net };
  results.push(s);
  report(s);
}
await browser.close();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ when: new Date().toISOString(), route, qs, flags: opt('flags', ''), net: opt('net', ''), cpu: opt('cpu', '1'), speed: R.speed, warmup, measure, results }, null, 1));
console.log('wrote', out);
