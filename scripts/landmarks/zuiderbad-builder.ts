/**
 * Zuiderbad, Hobbemastraat 26 (BAG 0363100012233523; built 1911 as the Velox cycling school, a public pool since 1912;
 * Rijksmonument 505901). Every part below comes from the rectified Gemeente Amsterdam panoramas (CC BY 4.0) listed in
 * scripts/landmarks/zuiderbad-inventory.json, the PDOK orthophoto (roof colour, solar field) and the 3DBAG LoD2.2
 * walls and roofs (CC BY 4.0); nothing is described from memory. Measurements are at the crops' 50 px/m.
 *
 *  - Hobbemakade front (east, w07-w15): nine 4.9 m bays between pilasters (BAG ring jogs 0.29 m), each with one large
 *    white three-light first-floor window (5.15-8.3 m) and one ground opening under yellow segmental arches with
 *    lozenge tympana; yellow brick courses about every metre; a corbel frieze, cornice and brick balustrade at
 *    9.3-10.95 m; pinnacles on every pilaster. Bays 3 and 7 (from the south) carry stepped gables to 16 m with five
 *    blind round-headed niches over a lozenge band (3DBAG cross-gable roofs 107-109/108-112 sit behind them).
 *  - North front (w03): symmetric three-bay front, round-arched light groups, the stone entrance surround with the
 *    ZUIDERBAD name panel (w03.alt, 2016), balustrade with four piers; behind it the hall gable tower (north end of
 *    the roof lantern) with the large lunette and a balustraded top; crow-stepped shoulders down to the eaves.
 *  - South gable (w04): crow steps over a yellow corbel band, the lantern end with paired round-arched windows, one
 *    first-floor window; the round tapering chimney at the south-east corner (triangulated from two panoramas, ~21 m).
 *  - Rounded north-east corner (w11): one storey, curved balustrade at 4.8 m, two windows under paired arches.
 *  - North-west annex (w06, w05): one storey, three round-arched lights, balustrade.
 *  - Roof: 3DBAG hall slopes and the raised lantern (glazed clerestory sides, w05.alt), grey standing-seam metal and a
 *    solar field on the west slope (PDOK orthophoto). The west wall (courtyard) has no photo and stays plain.
 *
 * Frame: x east, z south, y up from the 3DBAG ground, origin = vertex average of the BAG outer ring (RD)
 * (scripts/landmarks/zuiderbad-prepare.ts writes zuiderbad-footprints.json).
 */
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {raisedLettering} from './ornament-kit';
import {planarPolygon} from './worship-shell';
import {setSink, slab, ledgeStrip, archSlab, archBand, put, poly, segBand, type Frame} from './nearbar-kit';
import plan from './zuiderbad-footprints.json';

type V = [number, number];
type W3 = {id: string; ring: number[][]; top: number; bearing: number};
let b: BuildingTools;

const ring = plan.ring as V[];
const walls = plan.walls as W3[];
const sub = (p: V, q: V): V => [p[0] - q[0], p[1] - q[1]];
const unit = (p: V): V => { const l = Math.hypot(p[0], p[1]); return [p[0] / l, p[1] / l]; };
/** Frame from p (viewer's left) to q; n = outward for this ring's winding. */
function frameOf(p: V, q: V): {fr: Frame; L: number} {
  const d = unit(sub(q, p));
  return {fr: {origin: p, n: [-d[1], d[0]], tangent: d}, L: Math.hypot(...sub(q, p))};
}
const along = (fr: Frame, p: V) => (p[0] - fr.origin[0]) * fr.tangent[0] + (p[1] - fr.origin[1]) * fr.tangent[1];
const outOf = (fr: Frame, p: V) => (p[0] - fr.origin[0]) * fr.n[0] + (p[1] - fr.origin[1]) * fr.n[1];

// Course heights (yellow brick bands) read on w13/w04 at 50 px/m.
const COURSES = [0.45, 1.4, 2.4, 3.4, 4.2, 6.1, 7.1, 9.1];
type Gap = [number, number, number, number]; // t0, t1, y0, y1

/** Yellow courses along [t0, t1], interrupted wherever an opening surround stands. */
function courses(fr: Frame, t0: number, t1: number, ys: number[], gaps: Gap[], out = 0, h = 0.12) {
  for (const y of ys) {
    const cuts = gaps.filter(g => y + h > g[2] && y < g[3]).map(g => [g[0], g[1]] as V).sort((a, c) => a[0] - c[0]);
    let s = t0;
    for (const [a, c] of [...cuts, [t1, t1] as V]) {
      if (a - s > 0.12) ledgeStrip(b, fr, (s + Math.min(a, t1)) / 2, y, Math.min(a, t1) - s, h, 0.06, 'ochre', out);
      s = Math.max(s, c);
    }
  }
}

/** Rectangular window with a yellow surround, a segmental yellow arch over a lozenge tympanum, white frame and bars. */
function squareWindow(fr: Frame, t: number, y0: number, w: number, h: number, o: {lights?: number; transom?: number; out?: number; gaps?: Gap[]; tympanum?: boolean}) {
  const out = o.out ?? 0, lights = o.lights ?? 3, sw = w + 0.5;
  slab(b, fr, t, y0 - 0.15, sw, h + 0.25, 0.05, 'ochre', out);                     // surround
  if (o.tympanum !== false) {
    segBand(b, fr, t, y0 + h + 0.38, sw, 0.42, 0.26, 0.1, 'ochre', out);           // segmental arch
    for (const k of [-1, 0, 1]) diamond(fr, t + k * w * 0.3, y0 + h + 0.32, 0.2, out);
  }
  slab(b, fr, t, y0 - 0.06, w + 0.2, h + 0.12, 0.1, 'white', out);                  // frame
  slab(b, fr, t, y0, w, h, 0.15, 'glass', out);
  for (let k = 1; k < lights; k++) slab(b, fr, t - w / 2 + (w * k) / lights, y0, 0.1, h, 0.2, 'white', out);
  if (o.transom) slab(b, fr, t, o.transom, w, 0.08, 0.2, 'white', out);
  if (o.transom) for (let k = 0; k < lights; k++) slab(b, fr, t - w / 2 + (w * (k + 0.5)) / lights, o.transom, 0.04, y0 + h - o.transom, 0.2, 'white', out);
  slab(b, fr, t, y0 - 0.14, w + 0.4, 0.1, 0.24, 'stone', out);                      // sill
  o.gaps?.push([t - sw / 2 - 0.05, t + sw / 2 + 0.05, y0 - 0.15, y0 + h + 0.9]);
}
/** Ground door(s): yellow surround, segmental arch, white frame, transom glazing, red leaves (glazed when `glazed`). */
function doorway(fr: Frame, t: number, w: number, leaves: number, glazed: boolean, gaps: Gap[], out = 0) {
  const top = 3.4, sw = w + 0.5;
  slab(b, fr, t, 0.1, sw, top + 0.1, 0.05, 'ochre', out);
  segBand(b, fr, t, top + 0.38, sw, 0.42, 0.26, 0.1, 'ochre', out);
  for (const k of [-1, 0, 1]) diamond(fr, t + k * w * 0.3, top + 0.32, 0.2, out);
  slab(b, fr, t, 0.15, w + 0.12, top - 0.1, 0.1, 'white', out);
  slab(b, fr, t, 2.8, w, top - 2.85, 0.15, 'glass', out);                            // transom lights
  for (let k = 1; k < leaves; k++) slab(b, fr, t - w / 2 + (w * k) / leaves, 2.8, 0.06, top - 2.85, 0.2, 'white', out);
  const lw = w / leaves;
  for (let k = 0; k < leaves; k++) {
    const c = t - w / 2 + lw * (k + 0.5);
    slab(b, fr, c, 0.2, lw - 0.08, 2.52, 0.15, 'frame', out);
    if (glazed) slab(b, fr, c, 1.25, lw - 0.36, 1.3, 0.2, 'glass', out);
  }
  gaps.push([t - sw / 2 - 0.05, t + sw / 2 + 0.05, 0, top + 0.9]);
}
/** A raised yellow lozenge (diamond) of half-diagonal r. */
function diamond(fr: Frame, t: number, y: number, r: number, out: number) {
  poly(b, fr, t, y, [[0, -r], [r, 0], [0, r], [-r, 0]], 0.06, 'ochre', out);
}
/**
 * Light group under round brick arches: n lights of width w, yellow arch bands. `rect` (north front, annex: w03, w06)
 * glazes only the rectangle below the springing and leaves a brick tympanum in each arch; otherwise the glass is
 * round-headed (south lantern end, w04). Records the gap it occupies.
 */
function archGroup(fr: Frame, t: number, y0: number, n: number, w: number, h: number, gaps: Gap[], out = 0, door = -1, rect = false) {
  const pitch = w + 0.08, x0 = t - (pitch * (n - 1)) / 2;
  for (let k = 0; k < n; k++) {
    const c = x0 + pitch * k, isDoor = k === door, y = isDoor ? 0.15 : y0, hh = isDoor ? h + y0 - 0.15 : h, spring = hh - w / 2;
    archBand(b, fr, c, y, w + 0.3, hh + 0.15, 0.15, 0.12, 'ochre', out, 8);
    if (rect || isDoor) {
      slab(b, fr, c, y - 0.04, w + 0.06, spring + 0.06, 0.08, 'white', out);
      if (isDoor) {
        slab(b, fr, c, y, w - 0.1, spring - 0.45, 0.13, 'frame', out);
        slab(b, fr, c, y + spring - 0.4, w - 0.1, 0.36, 0.13, 'glass', out);
      } else {
        slab(b, fr, c, y, w - 0.1, spring - 0.04, 0.13, 'glass', out);
        slab(b, fr, c, y + spring * 0.62, w - 0.1, 0.06, 0.18, 'white', out);
        slab(b, fr, c, y, 0.05, spring - 0.04, 0.18, 'white', out);
      }
      continue;
    }
    archSlab(b, fr, c, y - 0.04, w + 0.06, hh + 0.05, 0.08, 'white', out, 8);
    archSlab(b, fr, c, y, w - 0.1, hh - 0.05, 0.13, 'glass', out, 8);
    slab(b, fr, c, y + spring * 0.62, w - 0.1, 0.06, 0.18, 'white', out);
    slab(b, fr, c, y, 0.05, spring, 0.18, 'white', out);
  }
  const half = (pitch * (n - 1)) / 2 + w / 2 + 0.2;
  gaps.push([t - half, t + half, y0 - 0.2, y0 + h + 0.3]);
  if (door >= 0) gaps.push([t - half, t + half, 0, y0 + h + 0.3]);
}
/** Brick balustrade along [t0, t1]: base course, balusters on a 0.32 m pitch, rail. */
function balustrade(fr: Frame, t0: number, t1: number, y: number, out = 0, h = 0.9) {
  const L = t1 - t0, m = (t0 + t1) / 2;
  if (L < 0.3) return;
  slab(b, fr, m, y, L, 0.16, 0.26, 'brick', out);
  const n = Math.max(1, Math.round(L / 0.32));
  for (let k = 0; k < n; k++) slab(b, fr, t0 + (L * (k + 0.5)) / n, y + 0.16, 0.13, h - 0.36, 0.18, 'brick', out);
  slab(b, fr, m, y + h - 0.2, L, 0.2, 0.28, 'brick', out);
  ledgeStrip(b, fr, m, y + h - 0.2, L, 0.06, 0.34, 'ochre', out);
}
/** Square pier with a cap and a four-sided pinnacle. */
function pier(fr: Frame, t: number, y0: number, y1: number, w: number, d: number, out = 0) {
  slab(b, fr, t, y0, w, y1 - y0, d, 'brick', out);
  slab(b, fr, t, y1, w + 0.12, 0.14, d + 0.08, 'ochre', out);
  const cone = new T.ConeGeometry((w * 0.95) / Math.SQRT2, 0.75, 4, 1).rotateY(Math.PI / 4).translate(0, 0.375, 0);
  put(b, fr, cone, t, y1 + 0.14, out + d / 2, 'brick');
}
/** Corbel frieze (yellow band and corbel blocks) and the projecting cornice above it. */
function cornice(fr: Frame, t0: number, t1: number, y: number, out = 0, d = 0.42) {
  ledgeStrip(b, fr, (t0 + t1) / 2, y, t1 - t0, 0.1, 0.06, 'ochre', out);
  const n = Math.round((t1 - t0) / 0.36);
  for (let k = 0; k < n; k++) slab(b, fr, t0 + ((t1 - t0) * (k + 0.5)) / n, y + 0.12, 0.14, 0.28, 0.14, 'ochre', out);
  slab(b, fr, (t0 + t1) / 2, y + 0.4, t1 - t0, 0.2, d, 'brick', out);
}

// ---------------------------------------------------------------------------------------------------- shell
const LANTERN_SIDES = new Set(['57', '104']);
function shell() {
  for (const w of walls) {
    const g = planarPolygon([w.ring]);
    if (g) b.add(g, (LANTERN_SIDES.has(String(w.id)) ? 'glass' : 'brick') as never);
  }
  for (const r of plan.roofs) {
    const g = planarPolygon(r.rings);
    if (g) b.add(g, 'slate' as never);
  }
  // Lantern clerestory mullions (w05.alt, 2024): white bars on both glazed sides.
  for (const [p, q] of [[[-9.4, 33.5], [-6.3, -16.4]], [[-14.3, -17.5], [-17.3, 33.3]]] as [V, V][]) {
    const {fr, L} = frameOf(p, q);
    for (let t = 2.0; t < L - 1.0; t += 1.25) slab(b, fr, t, 15.9, 0.09, 2.1, 0.07, 'white');
    slab(b, fr, L / 2, 15.9, L - 2, 0.1, 0.08, 'white');
  }
  solarField();
}
/** Solar panels on the west hall slope (roof 115): PDOK orthophoto, x -26.9..-14.9, z -14.3..29.9. */
function solarField() {
  const r = plan.roofs.find(s => String(s.id) === '115')!.rings[0];
  // Least-squares plane y = a x + c z + e through the roof ring.
  let sxx = 0, sxz = 0, szz = 0, sx = 0, sz = 0, n = 0, sxy = 0, szy = 0, sy = 0;
  for (const [x, y, z] of r) { sxx += x * x; sxz += x * z; szz += z * z; sx += x; sz += z; n++; sxy += x * y; szy += z * y; sy += y; }
  const M = new T.Matrix3().set(sxx, sxz, sx, sxz, szz, sz, sx, sz, n).invert();
  const v = new T.Vector3(sxy, szy, sy).applyMatrix3(M);
  const yAt = (x: number, z: number) => v.x * x + v.y * z + v.z;
  const xe = (z: number) => -27.37 - 0.0605 * (z - 9.51) + 0.9, xr = (z: number) => -14.3 - 0.059 * (z + 17.5) - 2.2;
  // A closed slab 12 cm proud of the slope whose underside sinks 10 cm into it, so it neither hovers nor leaves an open rim.
  const corners = [[xe(-14), -14], [xe(29.5), 29.5], [xr(29.5), 29.5], [xr(-14), -14]];
  const top = corners.map(([x, z]) => new T.Vector3(x, yAt(x, z) + 0.12, z)), bot = corners.map(([x, z]) => new T.Vector3(x, yAt(x, z) - 0.1, z));
  const centre = top.concat(bot).reduce((a, p) => a.add(p), new T.Vector3()).multiplyScalar(1 / 8), pos: number[] = [];
  const tri = (A: T.Vector3, B: T.Vector3, C: T.Vector3) => {
    const nrm = B.clone().sub(A).cross(C.clone().sub(A)), mid = A.clone().add(B).add(C).multiplyScalar(1 / 3);
    for (const P of nrm.dot(mid.sub(centre)) >= 0 ? [A, B, C] : [A, C, B]) pos.push(P.x, P.y, P.z);
  };
  const quad = (A: T.Vector3, B: T.Vector3, C: T.Vector3, D: T.Vector3) => { tri(A, B, C); tri(A, C, D); };
  quad(top[0], top[1], top[2], top[3]); quad(bot[0], bot[1], bot[2], bot[3]);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(top[i], top[j], bot[j], bot[i]); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  b.add(g, 'dark' as never);
}

// ---------------------------------------------------------------------------------------------------- Hobbemakade front
/** Bays south to north (ring index pairs of the recessed wall between pilasters) and their ground openings. */
const BAYS: [number, number][] = [[48, 49], [52, 53], [56, 57], [60, 61], [64, 65], [68, 0], [3, 4], [7, 8], [11, 12]];
const GROUND = ['window', 'door1', 'door2', 'window', 'door3', 'door1', 'door3', 'window', 'window'] as const;
const GABLES = new Set([2, 6]);
function eastFront() {
  const {fr} = frameOf(ring[48], ring[12]);
  const span = BAYS.map(([i, j]) => [along(fr, ring[i]), along(fr, ring[j])] as V);
  const pilOut = outOf(fr, ring[50]);
  // Pilasters: the two corners and the eight between bays.
  const pil: {t: number; w: number; gable: boolean}[] = [{t: span[0][0] - 0.3, w: 0.62, gable: false}];
  for (let k = 0; k + 1 < span.length; k++) pil.push({t: (span[k][1] + span[k + 1][0]) / 2, w: span[k + 1][0] - span[k][1], gable: GABLES.has(k) || GABLES.has(k + 1)});
  pil.push({t: span[8][1] + 0.27, w: 0.54, gable: false});
  for (const p of pil) {
    pier(fr, p.t, 9.9, p.gable ? 13.1 : 11.25, p.w, pilOut + 0.06);
    courses(fr, p.t - p.w / 2, p.t + p.w / 2, COURSES, [], pilOut);
  }
  span.forEach(([t0, t1], k) => {
    const c = (t0 + t1) / 2, gaps: Gap[] = [];
    squareWindow(fr, c, 5.15, 2.6, 3.15, {transom: 7.0, gaps});
    const g = GROUND[k];
    if (g === 'window') squareWindow(fr, c, 1.6, 1.85, 2.05, {lights: 2, transom: 3.0, gaps});
    else if (g === 'door1') doorway(fr, c, 1.3, 1, false, gaps);
    else if (g === 'door2') doorway(fr, c, 2.1, 2, false, gaps);
    else doorway(fr, c, 2.8, 3, true, gaps);
    if (k === 8) for (const s of [-1, 1]) { slab(b, fr, c + s * 1.75, 2.3, 0.5, 0.55, 0.08, 'white'); slab(b, fr, c + s * 1.75, 2.35, 0.4, 0.45, 0.13, 'glass'); gaps.push([c + s * 1.75 - 0.3, c + s * 1.75 + 0.3, 2.3, 2.85]); }
    courses(fr, t0, t1, COURSES, gaps);
    cornice(fr, t0, t1, 9.3);
    if (GABLES.has(k)) eastGable(fr, c, t1 - t0);
    else balustrade(fr, t0, t1, 9.9);
  });
}
/** w13/w09: stepped-shoulder gable with five blind niches over a lozenge band and a finial. */
function eastGable(fr: Frame, c: number, w: number) {
  const h = w / 2, d = 0.3;
  const prof: V[] = [[-h, 9.9], [h, 9.9], [h, 13.1], [h - 0.45, 13.1], [0.6, 14.95], [0.6, 15.25], [-0.6, 15.25], [-0.6, 14.95], [-h + 0.45, 13.1], [-h, 13.1]];
  poly(b, fr, c, 0, prof, d, 'brick');
  for (const y of [10.0, 11.05]) ledgeStrip(b, fr, c, y, w, 0.1, 0.06, 'ochre', d);
  for (let k = 0; k < 6; k++) diamond(fr, c - h + (w * (k + 0.5)) / 6, 10.58, 0.26, d);
  // five round-headed blind niches, outlined in yellow, heights following the slope
  for (const [x, top] of [[-1.62, 12.8], [-0.81, 13.55], [0, 14.4], [0.81, 13.55], [1.62, 12.8]]) archBand(b, fr, c + x, 11.3, 0.62, top - 11.3, 0.09, 0.06, 'ochre', d, 6);
  // coping on the shoulders and the rakes
  for (const s of [-1, 1]) {
    slab(b, fr, c + s * (h - 0.22), 13.1, 0.55, 0.12, d + 0.08, 'ochre');
    poly(b, fr, c, 0, s < 0 ? [[-h + 0.4, 13.05], [-0.62, 14.9], [-0.62, 15.1], [-h + 0.4, 13.25]] : [[h - 0.4, 13.05], [h - 0.4, 13.25], [0.62, 15.1], [0.62, 14.9]], d + 0.08, 'ochre');
  }
  slab(b, fr, c, 15.25, 1.35, 0.12, d + 0.08, 'ochre');
  pier(fr, c, 15.37, 15.6, 0.36, d);
}

// ---------------------------------------------------------------------------------------------------- north front
function northFront() {
  const {fr, L} = frameOf(ring[35], ring[36]);
  const gaps: Gap[] = [], mid = L / 2;
  // first floor: three-light groups in the side bays, two lights in the centre
  archGroup(fr, mid - 5.4, 5.0, 3, 0.8, 3.8, gaps, 0, -1, true);
  archGroup(fr, mid + 5.4, 5.0, 3, 0.8, 3.8, gaps, 0, -1, true);
  archGroup(fr, mid, 5.0, 2, 0.95, 3.85, gaps, 0, -1, true);
  // ground: east bay window-door-window under three arches; west bay one wide window
  archGroup(fr, mid - 5.4, 1.0, 3, 0.72, 2.9, gaps, 0, 1, true);
  squareWindow(fr, mid + 5.4, 1.0, 2.7, 2.2, {lights: 3, transom: 2.55, gaps});
  // entrance: pale stone surround, name panel under a segmental hood, door and two narrow side lights
  slab(b, fr, mid, 0, 4.0, 0.3, 0.12, 'stone');
  for (const s of [-1, 1]) slab(b, fr, mid + s * 1.82, 0.3, 0.36, 3.3, 0.12, 'stone');
  slab(b, fr, mid, 3.55, 4.0, 0.2, 0.16, 'stone');
  slab(b, fr, mid, 3.75, 2.1, 0.55, 0.1, 'stone');
  segBand(b, fr, mid, 4.42, 3.8, 0.4, 0.22, 0.16, 'stone');
  const name = raisedLettering({text: 'ZUIDERBAD', heightM: 0.3, maxWidthM: 1.7, depthM: 0.06});
  name.geometry.translate(-name.widthM / 2, 0, 0);
  put(b, fr, name.geometry, mid, 3.88, 0.1, 'bronze');
  slab(b, fr, mid, 0.3, 1.5, 3.25, 0.08, 'white');
  slab(b, fr, mid, 0.35, 1.3, 2.35, 0.13, 'frame');
  slab(b, fr, mid, 2.8, 1.3, 0.65, 0.13, 'glass');
  for (const s of [-1, 1]) { slab(b, fr, mid + s * 1.34, 1.75, 0.66, 1.5, 0.08, 'white'); slab(b, fr, mid + s * 1.34, 1.8, 0.56, 1.4, 0.13, 'glass'); }
  gaps.push([mid - 2.1, mid + 2.1, 0, 4.9]);
  courses(fr, 0, L, COURSES.filter(y => y < 9), gaps);
  cornice(fr, 0, L, 9.0, 0, 0.34);
  const piers = [0.25, mid - 2.69, mid + 2.69, L - 0.25];
  for (const t of piers) pier(fr, t, 9.6, 11.0, 0.5, 0.42);
  for (let k = 0; k + 1 < piers.length; k++) balustrade(fr, piers[k] + 0.25, piers[k + 1] - 0.25, 9.6, 0, 0.95);
}
/** North end of the roof lantern: brick tower face with the lunette, balustraded top, corner piers, crest, flagpoles. */
function northTower() {
  const {fr, L} = frameOf([-6.3, -16.4], [-14.3, -17.5]);
  const c = L / 2, d = 0.3;
  slab(b, fr, c, 13.6, L, 20.15 - 13.6, d, 'brick');
  slab(b, fr, c, 13.45, L + 0.1, 0.15, d + 0.08, 'ochre');
  for (const y of [15.0, 17.1, 18.2]) courses(fr, 0, L, [y], y < 17 ? [[c - 2.95, c + 2.95, 13, 17]] : [], d);
  archBand(b, fr, c, 14.1, 5.6, 2.8, 0.3, 0.08, 'ochre', d, 16);
  archSlab(b, fr, c, 14.1, 5.06, 2.53, 0.08, 'white', d, 16);
  archSlab(b, fr, c, 14.14, 4.9, 2.45, 0.13, 'glass', d, 16);
  for (const a of [-60, -20, 20, 60]) {
    const g = new T.BoxGeometry(0.07, 2.4, 0.06).translate(0, 1.2, 0.03).rotateZ((a * Math.PI) / 180);
    put(b, fr, g, c, 14.14, d + 0.13, 'white');
  }
  slab(b, fr, c, 14.1, 5.0, 0.08, 0.18, 'white', d);
  slab(b, fr, c, 20.15, L, 0.2, d + 0.14, 'brick');
  balustrade(fr, 0.7, L - 0.7, 20.35, 0, 0.85);
  for (const t of [0.35, L - 0.35]) pier(fr, t, 13.6, 21.4, 0.7, d + 0.12);
  slab(b, fr, c, 21.0, 1.5, 0.45, d, 'brick');
  slab(b, fr, c, 21.45, 0.9, 0.35, d, 'brick');
  slab(b, fr, c, 21.8, 1.0, 0.1, d + 0.06, 'ochre');
  for (const t of [1.6, L - 1.6]) slab(b, fr, t, 20.3, 0.08, 6.0, 0.08, 'white', -1.2);
}
/** South end of the roof lantern (w04): paired round-arched windows, balustraded top, corner piers. */
function southTower() {
  const {fr, L} = frameOf([-17.3, 33.95], [-9.4, 34.15]);
  const c = L / 2, d = 0.3;
  slab(b, fr, c, 15.4, L, 20.15 - 15.4, d + 0.6, 'brick', -0.6);
  const gaps: Gap[] = [];
  archGroup(fr, c, 16.0, 2, 1.15, 2.7, gaps, d);
  courses(fr, 0, L, [15.6, 17.1, 18.9], gaps, d);
  slab(b, fr, c, 20.15, L, 0.2, d + 0.14, 'brick');
  balustrade(fr, 0.7, L - 0.7, 20.35, 0, 0.85);
  for (const t of [0.35, L - 0.35]) pier(fr, t, 15.4, 21.4, 0.7, d + 0.12);
}
/** Crow steps over a raking yellow corbel band, from (tA, yA) to (tB, yB) along a 3DBAG gable wall. */
function crowSteps(fr: Frame, tA: number, yA: number, tB: number, yB: number, n: number, d = 0.35) {
  const yAt = (t: number) => yA + ((yB - yA) * (t - tA)) / (tB - tA);
  for (let k = 0; k < n; k++) {
    const t0 = tA + ((tB - tA) * k) / n, t1 = tA + ((tB - tA) * (k + 1)) / n, lo = Math.min(yAt(t0), yAt(t1)) - 0.3, hi = Math.max(yAt(t0), yAt(t1)) + 0.75;
    slab(b, fr, (t0 + t1) / 2, lo, Math.abs(t1 - t0), hi - lo, d, 'brick');
    slab(b, fr, (t0 + t1) / 2, hi, Math.abs(t1 - t0) + 0.08, 0.1, d + 0.07, 'ochre');
  }
  const off = 0.62;
  poly(b, fr, 0, 0, [[tA, yA - off], [tB, yB - off], [tB, yB - off + 0.24], [tA, yA - off + 0.24]], 0.12, 'ochre');
}
function gables() {
  // North hall gable: east and west shoulders either side of the tower (3DBAG walls 105 and 86/33).
  { const {fr, L} = frameOf([3.5, -15.3], [-6.3, -16.5]); crowSteps(fr, 0.4, 10.0, L, 15.7, 6); }
  { const {fr, L} = frameOf([-14.3, -17.5], [-25.3, -18.9]); crowSteps(fr, 0, 15.8, L - 0.4, 10.1, 7); pier(fr, L - 0.3, 9.9, 11.0, 0.6, 0.4); }
  // South hall gable (w04): west part (wall 98) and east part (wall 77) with its first-floor window.
  { const {fr, L} = frameOf([-28.7, 33.0], [-17.4, 33.7]); crowSteps(fr, 0.4, 10.0, L, 15.8, 8); pier(fr, 0.3, 9.9, 11.25, 0.6, 0.4);
    courses(fr, 0, L, [...COURSES, 11.5], []); }
  { const {fr, L} = frameOf([-9.5, 34.2], [1.9, 34.85]); crowSteps(fr, 0, 15.7, L - 0.5, 10.0, 8);
    const gaps: Gap[] = [];
    squareWindow(fr, 2.33, 5.2, 2.6, 3.1, {transom: 7.0, gaps});
    squareWindow(fr, 2.25, 1.7, 1.8, 2.0, {lights: 2, transom: 3.0, gaps});
    courses(fr, 0, L - 0.3, [...COURSES, 11.5], gaps); }
}
/** Round tapering chimney at the south-east corner, ~21 m (panoramas 002359 / 004125 triangulated). */
function chimney() {
  const x = 0.9, z = 33.3, y0 = 9.0, y1 = 20.4, r0 = 0.72, r1 = 0.52;
  b.add(new T.CylinderGeometry(r1, r0, y1 - y0, 12, 1, true).translate(0, (y0 + y1) / 2, 0), 'brick' as never, x, 0, z);
  for (const y of [12.5, 15.0, 17.5, 19.6]) {
    const r = r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    b.add(new T.CylinderGeometry(r + 0.06, r + 0.06, 0.22, 12).translate(0, y + 0.11, 0), 'greyBrick' as never, x, 0, z);
  }
  b.add(new T.CylinderGeometry(0.66, 0.57, 0.5, 12).translate(0, y1 + 0.25, 0), 'brick' as never, x, 0, z);
  b.add(new T.CylinderGeometry(0.42, 0.42, 0.06, 12).translate(0, y1 + 0.53, 0), 'greyBrick' as never, x, 0, z);
}

// ---------------------------------------------------------------------------------------------------- corners and annex
/** Rounded north-east corner (w11): curved one-storey wall with a balustrade at 4.8 m and two windows under paired arches. */
function roundCorner() {
  const segs: {fr: Frame; L: number}[] = [];
  for (let i = 15; i < 34; i++) segs.push(frameOf(ring[i], ring[i + 1]));
  for (const {fr, L} of segs) {
    courses(fr, 0, L, [0.45, 4.2], []);
    slab(b, fr, L / 2, 4.5, L + 0.02, 0.22, 0.3, 'brick');
    slab(b, fr, L / 2, 4.72, L + 0.02, 0.24, 0.24, 'brick');
    slab(b, fr, L / 2, 4.96, 0.13, 0.5, 0.18, 'brick');
    slab(b, fr, L / 2, 5.46, L + 0.02, 0.18, 0.26, 'brick');
  }
  // two windows on chords of the arc, a glazed door at the north end
  for (const [i, j, door] of [[18, 21, false], [24, 27, false], [30, 33, true]] as [number, number, boolean][]) {
    const {fr, L} = frameOf(ring[i], ring[j]);
    if (door) { slab(b, fr, L / 2, 0.1, 1.15, 2.8, 0.14, 'white'); slab(b, fr, L / 2, 0.15, 0.95, 2.6, 0.19, 'glass'); continue; }
    const w = L - 0.25;
    slab(b, fr, L / 2, 1.0, w + 0.14, 2.7, 0.14, 'white');
    slab(b, fr, L / 2, 1.06, w, 2.58, 0.19, 'glass');
    slab(b, fr, L / 2, 1.06, 0.07, 2.58, 0.24, 'white');
    slab(b, fr, L / 2, 2.85, w, 0.07, 0.24, 'white');
    for (const s of [-1, 1]) archBand(b, fr, L / 2 + (s * w) / 4, 3.55, w / 2, 0.45, 0.12, 0.2, 'ochre', 0, 6);
  }
}
function northWest() {
  // west side of the north block over the annex (w05): two three-light groups, balustrade
  { const {fr, L} = frameOf([-19.3, -27.8], [-19.6, -18.2]); const gaps: Gap[] = [];
    archGroup(fr, 2.1, 5.4, 3, 0.6, 2.7, gaps, 0, -1, true); archGroup(fr, 6.2, 5.4, 3, 0.6, 2.7, gaps, 0, -1, true);
    courses(fr, 0.2, L, COURSES.filter(y => y > 4.8 && y < 9), gaps); cornice(fr, 0, L, 9.0, 0, 0.34); balustrade(fr, 0, L, 9.6, 0, 0.95); }
  // annex north (w06) and west (w05) faces: three round-arched lights, courses, balustrade, end piers
  for (const [p, q, t] of [[ring[37], ring[38], 3.05], [ring[38], ring[39], 4.35]] as [V, V, number][]) {
    const {fr, L} = frameOf(p, q), gaps: Gap[] = [];
    archGroup(fr, t, 0.9, 3, 0.9, 2.9, gaps, 0, -1, true);
    courses(fr, 0, L, COURSES.filter(y => y < 4), gaps);
    ledgeStrip(b, fr, L / 2, 4.05, L, 0.1, 0.06, 'ochre');
    slab(b, fr, L / 2, 4.15, L, 0.6, 0.3, 'brick');
    balustrade(fr, 0.3, L - 0.3, 4.75, 0, 0.8);
    for (const s of [0.15, L - 0.15]) pier(fr, s, 4.15, 5.6, 0.3, 0.34);
  }
}
/** North block above the rounded corner (3DBAG wall 101): one three-light group under the parapet balustrade. */
function northEastBlock() {
  const w = walls.find(x => String(x.id) === '101')!;
  const pts = w.ring.filter(p => p[1] < 5.5).map(p => [p[0], p[2]] as V);
  const [p, q] = pts.sort((a, c) => a[0] - c[0]);
  const {fr, L} = frameOf(q, p), gaps: Gap[] = [];
  archGroup(fr, L / 2, 5.6, 3, 0.62, 2.8, gaps, 0, -1, true);
  courses(fr, 0, L, [6.1], gaps);
  cornice(fr, 0, L, 9.0, 0, 0.34);
  balustrade(fr, 0, L, 9.6, 0, 0.95);
}

export function buildZuiderbad(_w: number, _d: number, tools: BuildingTools) {
  b = tools; setSink(0.12, true);
  shell();
  eastFront();
  northFront();
  northTower();
  southTower();
  gables();
  chimney();
  roundCorner();
  northWest();
  northEastBlock();
  setSink(0);
}
