import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {roofPrism} from './roof-prism-kit';
import {letters, poly, slab, type Frame} from './nearbar-kit';
import source from './vu-hoofdgebouw-footprints.json';

type Colour = Parameters<BuildingTools['add']>[1];
type Pt = [number, number];

/**
 * Hoofdgebouw Vrije Universiteit, De Boelelaan 1105, Buitenveldert (BAG pand 0363100012136232, bouwjaar 1973; opened by
 * Queen Juliana 1973-04-12, Nationaal Archief / Anefo CC0; brutalist exposed concrete, nl.wikipedia "Hoofdgebouw Vrije
 * Universiteit", CC BY-SA 4.0). Native east/south metres from the BAG vertex average
 * (scripts/landmarks/vu-hoofdgebouw-footprints.json, citroen-zuid-prepare.ts --id=vu-hoofdgebouw), y above the 3DBAG
 * ground (-3.53 m NAP).
 *
 * Massing: the low wings are the 3DBAG LoD2.2 roof parts under 40 m (11-23 m), one closed prism per part (roofPrism);
 * the tower is authored from the 3DBAG roof parts over 40 m as five boxes: the east block with the griffin (T1, 61.2 m,
 * its south strip a storey lower), the connector with the stair slot and the roof plant (T2, 61.1 / 66.1 m), the
 * north head of the west slab with its glazed, chamfered top storey (T3, 67.0 m), the west slab (T4, 61.2 m, 103 m long
 * north-south) and the lattice lamp box on the head (72 m).
 *
 * Elevations from the rectified Gemeente Amsterdam panoramas (CC BY 4.0) and Wikimedia Commons photographs:
 *  - low wings (w01-90, 24 px/m): a basement window band, storeys on a 3.7 m pitch from 1.5 m, two-pane windows between
 *    concrete piers on a 4.1 m pitch, a concrete ledge at every floor and a deep fascia at the roof;
 *  - tower (Commons "VU Amsterdam.jpg", "Gebouw van de Vrije Universiteit in Amsterdam.jpg", w03-0): projecting
 *    concrete ledges with an upstand at every 3.4 m storey and ribbon windows behind them; the east block's north and
 *    south faces glazed only every second storey (blank concrete between), its east end with a ledge at every storey;
 *  - the blue griffin on its steel frame at the NE corner of the east block and the "vrije Universiteit" lettering beside it;
 *  - the main entrance on De Boelelaan (w14-0, Commons "De Boelelaan VU - panoramio.jpg"): a glazed hall front under a
 *    projecting canopy (soffit 10.9 m up, about 8.8 m deep by projection on the rectified crop; drawn 8 m), the frosted
 *    glass box with the lettering above.
 */
const src = source as unknown as {facadeRing: number[][]; surfaces: {type: string; rings: number[][][]}[]};
const RING = src.facadeRing.map(p => [p[0], p[1]] as Pt);
const roofs = src.surfaces.filter(s => s.type === 'RoofSurface').map(s => ({rings: s.rings, h: s.rings[0].reduce((a, p) => a + p[1], 0) / s.rings[0].length, top: Math.max(...s.rings[0].map(p => p[1]))}));
const LOW = roofs.filter(r => r.top < 40);

function inPoly(x: number, z: number, r: number[][], zi = 2) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zz] = [r[i][0], r[i][zi]], [xj, zj] = [r[j][0], r[j][zi]];
    if ((zz > z) !== (zj > z) && x < (xj - xi) * (z - zz) / (zj - zz) + xi) c = !c;
  }
  return c;
}
/** The low-wing roof over (x, z), 0 in the open. */
const lowRoofAt = (x: number, z: number) => LOW.reduce((h, r) => inPoly(x, z, r.rings[0]) ? Math.max(h, r.h) : h, 0);

type Box = {x0: number; x1: number; z0: number; z1: number; top: number};
const T1: Box = {x0: 24.5, x1: 58.0, z0: -31.0, z1: -12.5, top: 61.2};
const T1S: Box = {x0: 24.5, x1: 58.0, z0: -12.5, z1: -4.3, top: 57.6};
const T2: Box = {x0: 4.3, x1: 21.0, z0: -29.6, z1: -4.3, top: 61.1};
const SLOT: Box = {x0: 20.9, x1: 24.6, z0: -26.6, z1: -4.3, top: 61.1};
const PLANT2: Box = {x0: 4.3, x1: 24.5, z0: -21.5, z1: -8.6, top: 66.1};
const T3: Box = {x0: -7.6, x1: 4.4, z0: -30.0, z1: -16.6, top: 61.2};
const T4: Box = {x0: -9.0, x1: 12.7, z0: -16.7, z1: 73.3, top: 61.2};
const PLANT4: Box = {x0: -1.0, x1: 5.0, z0: 23.6, z1: 53.0, top: 66.1};
const HEAD_TOP = 67.0;
const TOWERS = [T1, T1S, T2, SLOT, T3, T4];
/** Is (x, z) at height y inside a tower volume (another box covers this stretch of face)? */
const inTower = (x: number, z: number, y: number) => TOWERS.some(q => x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1 && y < q.top);
const LAMP = {x: 2.7, z: -27.3, s: 3.0, y0: HEAD_TOP, y1: 72.0};

const box = (b: BuildingTools, q: Box, y0: number, c: Colour) =>
  b.add(new T.BoxGeometry(q.x1 - q.x0, q.top - y0, q.z1 - q.z0), c, (q.x0 + q.x1) / 2, (q.top + y0) / 2, (q.z0 + q.z1) / 2);
/** Frame on a box face, t from the viewer's left end (tangent = (n.z, -n.x), as frameFromBearing). */
function face(q: Box, side: 'N' | 'E' | 'S' | 'W'): Frame & {len: number} {
  if (side === 'N') return {origin: [q.x1, q.z0], tangent: [-1, 0], n: [0, -1], len: q.x1 - q.x0};
  if (side === 'E') return {origin: [q.x1, q.z1], tangent: [0, -1], n: [1, 0], len: q.z1 - q.z0};
  if (side === 'S') return {origin: [q.x0, q.z1], tangent: [1, 0], n: [0, 1], len: q.x1 - q.x0};
  return {origin: [q.x0, q.z0], tangent: [0, 1], n: [-1, 0], len: q.z1 - q.z0};
}
const at = (f: Frame, t: number, out: number): Pt => [f.origin[0] + f.tangent[0] * t + f.n[0] * out, f.origin[1] + f.tangent[1] * t + f.n[1] * out];

/** Runs [t0, t1] along a face where the low roof outside it stays below y (sampled every metre, 1.6 m out). */
function runsAbove(f: Frame & {len: number}, y: number, margin = 0.6): [number, number][] {
  const out: [number, number][] = [];
  let s = -1;
  for (let t = margin; t <= f.len - margin + 1e-6; t += 1) {
    const tt = Math.min(t, f.len - margin), [x, z] = at(f, tt, 1.6), [x2, z2] = at(f, tt, 0.4);
    const ok = lowRoofAt(x, z) < y - 0.2 && lowRoofAt(x2, z2) < y - 0.2 && !inTower(x2, z2, y);
    if (ok && s < 0) s = t;
    if (!ok && s >= 0) { if (t - 1 - s > 1.5) out.push([s, t - 1]); s = -1; }
  }
  if (s >= 0 && f.len - margin - s > 1.5) out.push([s, f.len - margin]);
  return out;
}

const STOREY = 3.4, Y_TOWER = 15.4;
/**
 * Tower face: a projecting ledge (1.1 m deep, 0.3 m thick) with a 0.9 m upstand at every storey line `ledgeEvery`,
 * a window ribbon above every `glassEvery`-th ledge, and wall piers on a `pierPitch` in front of the glass.
 */
function towerFace(b: BuildingTools, f: Frame & {len: number}, top: number, o: {ledgeEvery: number; glassEvery: number; pierPitch: number}) {
  let yLo = Infinity, yHi = -Infinity;
  for (let k = 0; ; k++) {
    const y = Y_TOWER + k * STOREY;
    if (y > top - 2.2) break;
    if (k % o.ledgeEvery) continue;
    for (const [t0, t1] of runsAbove(f, y, 0.25)) {
      const w = t1 - t0, t = (t0 + t1) / 2;
      slab(b, f, t, y, w, 0.3, 1.1, 'concrete');
      slab(b, f, t, y + 0.3, w, 0.85, 0.14, 'concrete', 1.06);
      if ((k / o.ledgeEvery) % (o.glassEvery / o.ledgeEvery) === 0 && y + 2.8 < top - 0.4) {
        slab(b, f, t, y + 0.75, w, 1.85, 0.09, 'glass');
        yLo = Math.min(yLo, y + 0.75); yHi = Math.max(yHi, y + 2.6);
      }
    }
  }
  if (!Number.isFinite(yLo)) return;
  const nb = Math.max(1, Math.round(f.len / o.pierPitch)), pp = f.len / nb;
  for (let t = pp; t < f.len - 0.8; t += pp) {
    const runs = runsAbove(f, yLo, 0.25).filter(([a, c]) => t > a && t < c);
    if (runs.length) slab(b, f, t, yLo, 0.45, yHi - yLo, 0.2, 'concrete');
  }
}

const WALLS = src.surfaces.filter(s => s.type === 'WallSurface').map(s => s.rings[0]);
/**
 * The 3DBAG wall a ring face section stands on: its offset along n (front-most plane within 1 m of the ring), the
 * longest continuous stretch of that plane over [t0, t1] (pieces set back by a jog end the stretch) and its top
 * (median of the piece tops over 6 m, so short stacked pieces do not pull it down). null when no wall is there.
 */
function wallOffset(f: Frame, t0: number, t1: number) {
  const pieces: {off: number; lo: number; hi: number; top: number; bottom: number}[] = [];
  for (const r of WALLS) {
    if (r.length < 3) continue;
    const ts = r.map(p => (p[0] - f.origin[0]) * f.tangent[0] + (p[2] - f.origin[1]) * f.tangent[1]);
    const os = r.map(p => (p[0] - f.origin[0]) * f.n[0] + (p[2] - f.origin[1]) * f.n[1]);
    if (Math.max(...os) - Math.min(...os) > 0.15 || Math.abs(os[0]) > 1.0) continue;
    const lo = Math.min(...ts), hi = Math.max(...ts);
    if (Math.min(hi, t1) - Math.max(lo, t0) < 0.1) continue;
    pieces.push({off: os.reduce((a, v) => a + v, 0) / os.length, lo, hi, top: Math.max(...r.map(p => p[1])), bottom: Math.min(...r.map(p => p[1]))});
  }
  if (!pieces.length) return null;
  const tall = pieces.filter(p => p.top - p.bottom > 6);
  if (!tall.length) return null;
  const best = Math.max(...tall.map(p => p.off));
  const front = pieces.filter(p => best - p.off < 0.06 && p.top - p.bottom > 6).sort((a, c) => a.lo - c.lo);
  const runs: {lo: number; hi: number; tops: number[]}[] = [];
  for (const p of front) {
    const last = runs[runs.length - 1];
    if (last && p.lo <= last.hi + 0.3) { last.hi = Math.max(last.hi, p.hi); if (p.top - p.bottom > 6) last.tops.push(p.top); }
    else runs.push({lo: p.lo, hi: p.hi, tops: p.top - p.bottom > 6 ? [p.top] : []});
  }
  const run = runs.sort((a, c) => (Math.min(c.hi, t1) - Math.max(c.lo, t0)) - (Math.min(a.hi, t1) - Math.max(a.lo, t0)))[0];
  if (!run.tops.length) return null;
  const tops = run.tops.sort((a, c) => a - c);
  return {off: best, lo: run.lo, hi: run.hi, top: tops[Math.floor(tops.length / 2)]};
}

/** Low-wing elevation on a ring edge section of roof height h (w01-90). */
function wingFace(b: BuildingTools, f0: Frame, a0: number, a1: number, h: number) {
  // Stand on the 3DBAG wall, which can sit a few cm off the BAG ring and stop short of it.
  const wall = wallOffset(f0, a0, a1);
  if (!wall) return;
  const t0 = Math.max(a0, wall.lo + 0.3), t1 = Math.min(a1, wall.hi - 0.3), w = t1 - t0, t = (t0 + t1) / 2;
  if (w < 3) return;
  h = Math.min(h, wall.top);
  const f: Frame = {origin: at(f0, 0, wall.off), tangent: f0.tangent, n: f0.n};
  slab(b, f, t, h - 1.0, w + 0.3, 1.0, 0.35, 'stone');  // fascia
  if (h > 4) slab(b, f, t, 0.25, w - 0.4, 0.9, 0.13, 'dark');  // basement window band
  // A stub section under 5 m (a roof-height step a few metres long) is a closed stone bay in the photo, not a window
  // column: w01-90 counts 19 bays per storey on the 82.6 m east face.
  if (w < 5) return;
  let top = 0;
  for (let y = 1.5; y + 3.0 < h - 1.0; y += 3.7) {
    if (y > 1.5) slab(b, f, t, y - 0.3, w, 0.3, 0.6, 'stone');
    slab(b, f, t, y + 0.3, w - 0.6, 2.3, 0.09, 'canopyGlass');  // pale: blinds behind the panes (w01-90)
    top = y + 2.6;
  }
  if (!top) return;
  const n = Math.max(1, Math.round(w / 4.1)), p = w / n;
  for (let i = 0; i <= n; i++) slab(b, f, t0 + i * p, 1.4, 0.5, top - 1.4, 0.2, 'stone');
}

/**
 * The VU griffin, rampant and facing left with its wings swept up to the right (Commons "VU Amsterdam.jpg"): a flat blue
 * silhouette in two layers, the body layer 0.12 m proud of the wing fan (head, forelegs, haunch, hind feet, tail).
 */
function griffin(b: BuildingTools, f: Frame, t: number, y: number, s: number, out: number) {
  // Silhouette coordinates run viewer-left to right; the frame's tangent runs that way too.
  const P = (pts: number[][]) => pts.map(([u, v]) => [u * s, v * s] as [number, number]);
  poly(b, f, t, y, P([[0.40, 0.62], [0.30, 1.15], [0.42, 1.0], [0.50, 1.22], [0.58, 1.02], [0.72, 1.17], [0.72, 0.98], [0.95, 1.02], [0.62, 0.62]]), 0.12, 'blue', out);
  poly(b, f, t, y, P([[0.06, 0.62], [0.18, 0.60], [0.28, 0.52], [0.18, 0.50], [0.28, 0.45], [0.40, 0.40], [0.52, 0.22], [0.50, 0.05], [0.58, 0.0], [0.68, 0.12], [0.80, 0.0], [0.92, 0.05], [0.82, 0.20], [0.84, 0.30], [0.96, 0.44], [1.0, 0.5], [0.98, 0.35], [0.86, 0.22], [0.80, 0.22], [0.75, 0.40], [0.62, 0.58], [0.42, 0.66], [0.34, 0.76], [0.22, 0.78], [0.14, 0.68]]), 0.12, 'blue', out + 0.12);
}

export function buildVuHoofdgebouw(_w: number, _d: number, b: BuildingTools) {
  // ---- low wings: one closed prism per 3DBAG roof part under 40 m ----
  for (const r of LOW) roofPrism(b, r.rings, 'stone', 'slate');

  // ---- tower volumes ----
  for (const q of [T1, T1S, T2, SLOT, T4]) box(b, q, 0, 'concrete');
  for (const q of [PLANT2, PLANT4]) box(b, q, q === PLANT2 ? T2.top - 0.4 : T4.top - 0.4, 'concrete');
  // T3: the head of the west slab, its top storey chamfered on the west (Commons "VU Amsterdam.jpg", 3DBAG).
  box(b, T3, 0, 'concrete');
  {
    // 3DBAG: the head roof is flat at 67.0 m except a slope down to 64.0 m over its west 3.6 m.
    const c = 3.0, s = new T.Shape([new T.Vector2(T3.x0, T3.top - 0.3), new T.Vector2(T3.x1, T3.top - 0.3), new T.Vector2(T3.x1, HEAD_TOP), new T.Vector2(T3.x0 + 3.6, HEAD_TOP), new T.Vector2(T3.x0, HEAD_TOP - c)]);
    const g = new T.ExtrudeGeometry(s, {depth: T3.z1 - T3.z0, bevelEnabled: false});
    g.translate(0, 0, T3.z0);
    b.add(g, 'concrete');
    // The big four-pane window of the top storey, north face.
    const n = face(T3, 'N');
    slab(b, n, n.len / 2 - 1.2, T3.top + 0.4, 3.2, 4.4, 0.1, 'glass');
    slab(b, n, n.len / 2 - 1.2, T3.top + 2.5, 3.4, 0.18, 0.16, 'frame');
    slab(b, n, n.len / 2 - 1.2, T3.top + 0.4, 0.18, 4.4, 0.16, 'frame');
  }
  // The steel lattice lamp box on the head.
  {
    const {x, z, s, y0, y1} = LAMP;
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.add(new T.BoxGeometry(0.2, y1 - y0 + 0.3, 0.2), 'bronze', x + dx * s / 2, (y0 + y1) / 2 - 0.15, z + dz * s / 2);
    for (let y = y0 + 1; y <= y1 + 0.01; y += 1.25) for (const [dx, dz, w, d] of [[0, -1, s, 0.14], [0, 1, s, 0.14], [-1, 0, 0.14, s], [1, 0, 0.14, s]]) b.add(new T.BoxGeometry(w, 0.14, d), 'bronze', x + dx * s / 2, y - 0.07, z + dz * s / 2);
  }

  // ---- tower faces ----
  // East block: glazed every second storey on its long faces, a ledge every storey on its east end.
  towerFace(b, face(T1, 'N'), T1.top, {ledgeEvery: 2, glassEvery: 2, pierPitch: 3.8});
  towerFace(b, face(T1, 'E'), T1.top, {ledgeEvery: 1, glassEvery: 2, pierPitch: 3.8});
  towerFace(b, face(T1S, 'E'), T1S.top, {ledgeEvery: 1, glassEvery: 2, pierPitch: 3.8});
  towerFace(b, face(T1S, 'S'), T1S.top, {ledgeEvery: 2, glassEvery: 2, pierPitch: 3.8});
  // Connector, head and west slab: a ledge and a window ribbon at every storey.
  const every = {ledgeEvery: 1, glassEvery: 1, pierPitch: 3.6};
  towerFace(b, face(T2, 'N'), T2.top, every);
  towerFace(b, face(T3, 'N'), T3.top, every);
  towerFace(b, face(T3, 'W'), T3.top, every);
  towerFace(b, face(T4, 'W'), T4.top, every);
  towerFace(b, face(T4, 'S'), T4.top, every);
  towerFace(b, face(T4, 'E'), T4.top, every);
  towerFace(b, face(T2, 'S'), T2.top, every);
  // The stair slot between the east block and the connector: a narrow window per storey, recessed 3 m.
  {
    const f = face(SLOT, 'N');
    for (let y = Y_TOWER + 0.8; y < SLOT.top - 2.5; y += STOREY) slab(b, f, f.len / 2, y, 1.6, 1.9, 0.12, 'glass');
  }

  // ---- the griffin on its frame and the lettering, north face of the east block ----
  {
    const n = face(T1, 'N');
    const gt = 3.0, gs = 11.0, gy = T1.top - 8.2;
    for (const dt of [0.8, 4.4, 8.0, 10.6]) slab(b, n, gt + dt, gy - 0.5, 0.18, T1.top + 3.4 - gy, 0.18, 'bronze', 1.2);
    for (const dy of [0, 3.4, 6.8, 10.2]) slab(b, n, gt + 5.7, gy - 0.5 + dy, 10.6, 0.16, 0.18, 'bronze', 1.2);
    griffin(b, n, gt, gy, gs, 1.38);
    letters(b, n, 'VRIJE UNIVERSITEIT', 23.0, T1.top - 2.05, 0, 0.17, 0.1, 'white');
  }

  // ---- low wings: the ring faces outside the tower ----
  const area = RING.reduce((a, p, i) => { const q = RING[(i + 1) % RING.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0);
  const sgn = area > 0 ? 1 : -1;
  for (let i = 0; i < RING.length; i++) {
    const a = RING[i], c = RING[(i + 1) % RING.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (len < 4) continue;
    const tg: Pt = [(c[0] - a[0]) / len, (c[1] - a[1]) / len], nOut: Pt = [sgn * tg[1], -sgn * tg[0]];
    // Origin at the viewer's left end so the frame keeps tangent = (n.z, -n.x).
    const flip = Math.abs(tg[0] - nOut[1]) > 0.5 || Math.abs(tg[1] + nOut[0]) > 0.5;
    const f: Frame = flip ? {origin: c, tangent: [-tg[0], -tg[1]], n: nOut} : {origin: a, tangent: tg, n: nOut};
    // Sections of constant roof height, sampled 1 m inside.
    let s0 = 0, h0 = -1;
    const hAt = (t: number) => { const [x, z] = at(f, t, -1.0); return Math.round(lowRoofAt(x, z) * 2) / 2; };
    for (let t = 0.5; ; t += 0.5) {
      const end = t >= len, h = end ? -2 : hAt(t);
      if (h0 < 0) { h0 = h; s0 = t - 0.5; continue; }
      if (Math.abs(h - h0) > 0.6) {
        if (h0 > 3 && !isEntrance(f, s0, t - 0.5)) wingFace(b, f, s0 + 0.3, t - 0.8, h0);
        h0 = h; s0 = t - 0.5;
      }
      if (end) break;
    }
  }

  // ---- main entrance on De Boelelaan: glazed hall front, canopy, frosted glass box with the lettering ----
  {
    const f: Frame & {len: number} = {origin: [-20.46, -46.27], tangent: [-1, 0], n: [0, -1], len: 16.18};
    slab(b, f, f.len / 2, 0.1, f.len - 0.4, 9.9, 0.12, 'glass');
    for (let t = 0.2; t <= f.len; t += 2.0) slab(b, f, t, 0.1, 0.14, 9.9, 0.2, 'frame');
    slab(b, f, f.len / 2, 3.6, f.len - 0.2, 0.2, 0.22, 'frame');
    slab(b, f, f.len / 2 - 1.0, 10.0, f.len + 6.0, 0.9, 8.0, 'dark');
    slab(b, f, f.len / 2, 10.9, f.len - 0.4, 9.4, 0.15, 'canopyGlass');
    letters(b, f, 'VRIJE UNIVERSITEIT', f.len / 2, 17.3, 0.15, 0.13, 0.08, 'dark');
  }
}

function isEntrance(f: Frame, t0: number, t1: number) {
  const [x0, z0] = at(f, t0, 0), [x1, z1] = at(f, t1, 0);
  return Math.max(z0, z1) < -45.5 && Math.min(x0, x1) > -37.0 && Math.max(x0, x1) < -19.0;
}

