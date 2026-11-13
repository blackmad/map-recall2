import * as T from 'three';
import polygonClipping, {type MultiPolygon, type Polygon} from 'polygon-clipping';
import type {BuildingTools} from './cultural-builders';
import {letters, poly, put, setSink, slab, type Frame} from './nearbar-kit';
import {roofPrism} from './roof-prism-kit';
import {openTopPrism, upwardRoofPlane} from './house-geometry';
import source from './radion-footprints.json' with {type: 'json'};
import canopySource from './radion-canopy-footprints.json' with {type: 'json'};

/**
 * RADION in the former ACTA building (Academisch Centrum Tandheelkunde Amsterdam), Louwesweg 1, Slotervaart. BAG pand
 * 0363100012114496 (bouwjaar 1969; RVO gives 1971; 27,000 m2), plus the detached 1971 canopy pand 0363100012188556 north
 * of it that carries the RADION fascia signs. De Alliantie owns it since 2010 and turned it into temporary homes for about
 * 460 residents, 65 work units and venues in 2012 (https://www.rvo.nl/transformatievoorbeelden/acta-gebouw); RADION moved
 * in in 2014 (https://www.radionamsterdam.nl/).
 *
 * Read from Gemeente Amsterdam panoramas (CC BY 4.0; radion-inventory.json names each one). Most walls stand behind
 * trees, so the winter and long-range captures carry the read:
 *  - the slab (3DBAG 36.8 m side strips either side of a 41.0 m core, the gable blocks full height at both ends): long
 *    fronts of light concrete spandrels and continuous dark window ribbons, eleven storeys of about 3.3 m
 *    (_20241204_0806_Track106_Sphere_00616 east, TMX7316010203-002466_pano_0002_001806 west); dark brown stair cores at
 *    the strip ends and on the west face.
 *  - the north gable (w08-359t, 2022-03-22, rectified at 50 px/m): painted black, crossed by a white lattice of 1.5 m
 *    bands: verticals centred 2.7 and 13.9 m from the east corner, horizontals at 11.1, 23.3 and 35.4 m and the top edge,
 *    and diagonals of slope 12.15/11.2 through the nodes (2.7, 35.4), (13.9, 23.3), (2.7, 11.1) and (13.9, -0.9); a column
 *    of small grilled windows 5.5-8.3 m from the east corner.
 *  - the south gable (w09-179t, 2022-03-22): warm grey glass tiles with one column of small windows 4.5 m from the west
 *    corner; beige concrete strip ends either side.
 *  - the low west wing (9.4, 8.6-8.9, 11.7 m blocks; 7.4 and 4.4 m links): light concrete, mostly hidden; drawn with one
 *    window ribbon per storey, inferred.
 *  - the canopy (w02-359 of pand 0363100012188556, 2025-07-16, 50 px/m): a concrete fascia 1.45 m deep with outlined
 *    "RADION" lettering and chevrons in a frame, round teal columns about 5.25 m apart, a graffiti-covered dark wall with
 *    a blue band behind; a second "RADION" sign on the set-back east part (recording_2025-07-16_11-08-20_01191).
 * Graffiti and murals at the gable feet are temporary and not modelled.
 *
 * Native frame of radion-footprints.json (bag-shell-prepare.ts, anchor = BAG ring vertex average): x east, z south, y up
 * from the -0.55 m NAP ground. The canopy (radion-canopy-footprints.json) is moved into this frame by the RD offset of
 * its anchor and stands on its own -0.80 m NAP ground.
 */
type XZ = [number, number];
type Surf = {type: string; rings: number[][][]};
const SRC = source as unknown as {anchorRD: XZ; groundNAP: number; facadeRing: XZ[]; surfaces: Surf[]};
const CAN = canopySource as unknown as {anchorRD: XZ; groundNAP: number; facadeRing: XZ[]; surfaces: Surf[]};
const RING = SRC.facadeRing;
const ROOFS = SRC.surfaces.filter(s => s.type === 'RoofSurface');
const CDX = CAN.anchorRD[0] - SRC.anchorRD[0], CDZ = -(CAN.anchorRD[1] - SRC.anchorRD[1]), CDY = CAN.groundNAP - SRC.groundNAP;
const CRING: XZ[] = CAN.facadeRing.map(([x, z]) => [x + CDX, z + CDZ]);

const STRIP = 36.8, CORE = 41.0;
const FLOOR0 = 0.4, PITCH = 3.3;                 // eleven storeys to the 36.8 m strip roofs
const WIN0 = 1.25, WIN_H = 1.3;                  // window ribbon within each storey
const MULL = 2.4;

function inRing(r: XZ[], p: XZ) {
  let yes = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i], c = r[j];
    if ((a[1] > p[1]) !== (c[1] > p[1]) && p[0] < (c[0] - a[0]) * (p[1] - a[1]) / (c[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
}
/** Wall frame on ring edge a -> b with its normal pointing out of the footprint; t = 0 at the viewer's left. */
function edge(r: XZ[], a: XZ, b: XZ): {f: Frame; len: number} {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), t: XZ = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const n: XZ = [-t[1], t[0]], mid: XZ = [(a[0] + b[0]) / 2 + n[0] * 0.5, (a[1] + b[1]) / 2 + n[1] * 0.5];
  return inRing(r, mid) ? {f: {origin: b, tangent: [-t[0], -t[1]], n: [t[1], -t[0]]}, len} : {f: {origin: a, tangent: t, n}, len};
}
/** Continuous window ribbons with mullions, one per storey, between y0 and y1 (spandrels are the concrete shell). */
function ribbons(b: BuildingTools, f: Frame, t0: number, t1: number, y0: number, y1: number, opts: {floor0?: number; pitch?: number; win0?: number; winH?: number} = {}) {
  const fl = opts.floor0 ?? FLOOR0, p = opts.pitch ?? PITCH, w0 = opts.win0 ?? WIN0, wh = opts.winH ?? WIN_H;
  const L = t1 - t0;
  if (L < 1.2) return;
  for (let y = fl; y + w0 + wh <= y1 - 0.2; y += p) {
    if (y + w0 < y0 + 0.2) continue;
    slab(b, f, (t0 + t1) / 2, y + w0, L - 0.4, wh, 0.1, 'glass');
    const n = Math.max(1, Math.round((L - 0.4) / MULL));
    for (let k = 1; k < n; k++) slab(b, f, t0 + 0.2 + k * (L - 0.4) / n, y + w0, 0.12, wh, 0.17, 'frame');
    slab(b, f, (t0 + t1) / 2, y + w0 - 0.12, L - 0.3, 0.12, 0.2, 'frame');   // sill
  }
}

/** The north gable: black paint and the white lattice (w08-359t). Bands are unioned so no two white faces overlap. */
function northGable(b: BuildingTools, f: Frame, L: number) {
  const H = CORE, W = 1.5, K = 12.15 / 11.2;
  const rect: Polygon = [[[END, 0], [L - END, 0], [L - END, H], [END, H], [END, 0]]];
  const band = (a: [number, number], c: [number, number]): Polygon => {
    const dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy), nx = -dy / l * W / 2, ny = dx / l * W / 2;
    return [[[a[0] + nx, a[1] + ny], [c[0] + nx, c[1] + ny], [c[0] - nx, c[1] - ny], [a[0] - nx, a[1] - ny], [a[0] + nx, a[1] + ny]]];
  };
  const diag = (t0: number, y0: number, s: number) => band([t0 - 30, y0 - s * K * 30], [t0 + 30, y0 + s * K * 30]);
  const bands: Polygon[] = [
    band([2.7, -1], [2.7, H + 1]), band([13.9, -1], [13.9, H + 1]),
    band([-1, 11.1], [L + 1, 11.1]), band([-1, 23.3], [L + 1, 23.3]), band([-1, 35.4], [L + 1, 35.4]),
    [[[-1, H - 0.7], [L + 1, H - 0.7], [L + 1, H + 1], [-1, H + 1], [-1, H - 0.7]]],
    diag(2.7, 35.4, -1), diag(2.7, 11.1, -1), diag(2.7, 11.1, 1), diag(2.7, 35.4, 1), diag(13.9, -0.9, 1),
  ];
  const lattice = polygonClipping.intersection(polygonClipping.union(...bands.map(p => [p] as MultiPolygon)), [rect]);
  slab(b, f, L / 2, -0.3, L - 2 * END, H + 0.3 - 0.12, 0.1, 'pink');              // black paint
  extrudeOnWall(b, f, lattice, 0.1, 0.1, 'white');
  // grilled windows in the black fields, clipped clear of the bands
  for (let y = 4.0; y < H - 2; y += 4.2) {
    const win: MultiPolygon = [[[[5.5, y], [8.3, y], [8.3, y + 0.6], [5.5, y + 0.6], [5.5, y]]]];
    extrudeOnWall(b, f, polygonClipping.difference(win, lattice), 0.1, 0.05, 'glass');
  }
}
/** Extrude wall-plane polygons (t, y) outward from `out` by `d`. */
function extrudeOnWall(b: BuildingTools, f: Frame, mp: MultiPolygon, out: number, d: number, c: string) {
  for (const pg of mp) {
    const outer = pg[0].slice(0, -1);
    if (outer.length < 3) continue;
    const s = new T.Shape(outer.map(([t, y]) => new T.Vector2(t, y)));
    for (const h of pg.slice(1)) s.holes.push(new T.Path(h.slice(0, -1).map(([t, y]) => new T.Vector2(t, y))));
    put(b, f, new T.ExtrudeGeometry(s, {depth: d, bevelEnabled: false}), 0, 0, out, c);
  }
}

/** The canopy pand: fascia, teal columns, enclosed back, RADION signs (w02-359, 2025-07-16). */
function canopy(b: BuildingTools) {
  const Y0 = CDY, TOPC = CDY + 5.1, FAS = 1.45, SOFF = TOPC - FAS;
  const shape = new T.Shape(CRING.map(([x, z]) => new T.Vector2(x, z)));
  b.add(openTopPrism(shape, SOFF, TOPC), 'concrete');                  // fascia ring
  b.add(upwardRoofPlane(shape, TOPC), 'slate');
  const soffit = upwardRoofPlane(shape, SOFF); flipDown(soffit); b.add(soffit, 'concrete');
  // the enclosed back: the ring pulled in 1.2 m from every edge
  const inner = insetRing(CRING, 1.2);
  const ishape = new T.Shape(inner.map(([x, z]) => new T.Vector2(x, z)));
  b.add(openTopPrism(ishape, Y0 - 0.05, SOFF), 'dark');
  // columns 0.6 m in from the fascia line, about 5.25 m apart along every edge
  const cols: XZ[] = [];
  for (let i = 0; i < CRING.length; i++) {
    const {f, len} = edge(CRING, CRING[i], CRING[(i + 1) % CRING.length]);
    const n = Math.max(1, Math.round(len / 5.25));
    for (let k = 0; k <= n; k++) {
      const t = 0.35 + k * (len - 0.7) / n, p: XZ = [f.origin[0] + f.tangent[0] * t - f.n[0] * 0.45, f.origin[1] + f.tangent[1] * t - f.n[1] * 0.45];
      if (!inRing(CRING, p) || inRing(inner, p) || cols.some(c => Math.hypot(c[0] - p[0], c[1] - p[1]) < 1.5)) continue;
      cols.push(p);
      b.add(new T.CylinderGeometry(0.17, 0.17, SOFF - Y0 + 0.05, 8).translate(0, (SOFF - Y0 + 0.05) / 2, 0), 'green', p[0], Y0 - 0.05, p[1]);
    }
    // fascia panel joints every 2.6 m and, where the back wall faces out, the blue band
    for (let t = 2.6; t < len - 0.3; t += 2.6) slab(b, f, t, SOFF + 0.05, 0.05, FAS - 0.1, 0.06, 'frame');
    const fi = insetFrame(f, 1.2);
    if (len > 3.4) slab(b, fi, len / 2, Y0 + 0.3, Math.max(0.5, len - 3.0), 0.9, 0.08, 'blue');
  }
  // signs on the fascia: north face of the main part (t 2.4-6.9 m from the east end) and the east part
  const north = edge(CRING, CRING[2], CRING[3]);
  radionSign(b, north.f, 4.65, SOFF + 0.38, 'after');
  const tab = edge(CRING, CRING[0], CRING[1]);
  radionSign(b, tab.f, tab.len / 2, SOFF + 0.38, 'before');
}
/** Outlined RADION lettering with three chevrons, inside a white frame (approximate stencil face, 0.68 m capitals). */
function radionSign(b: BuildingTools, f: Frame, t: number, y: number, chev: 'before' | 'after') {
  const px = 0.097, w = 4.5, h = 0.84;
  for (const [tt, yy, ww, hh] of [[t, y, w, 0.05], [t, y + h - 0.05, w, 0.05], [t - w / 2 + 0.025, y, 0.05, h], [t + w / 2 - 0.025, y, 0.05, h]] as const) slab(b, f, tt, yy, ww, hh, 0.07, 'white');
  const tx = chev === 'after' ? t - 0.35 : t + 0.35;
  letters(b, f, 'RADION', tx, y + 0.08, 0, px, 0.07, 'white');
  const c0 = chev === 'after' ? t + 1.45 : t - 2.05;
  for (let k = 0; k < 3; k++) {
    const u = c0 + k * 0.2, dir = 1;                 // the chevrons point east on both signs
    poly(b, f, u, y + 0.12, [[0, 0], [0.07, 0], [0.07 + 0.22 * dir, 0.3], [0.07, 0.6], [0, 0.6], [0.22 * dir, 0.3]], 0.07, 'white');
  }
}
function insetFrame(f: Frame, d: number): Frame { return {...f, origin: [f.origin[0] - f.n[0] * d, f.origin[1] - f.n[1] * d]}; }
function flipDown(g: T.BufferGeometry) {
  const idx = g.index!;
  for (let i = 0; i < idx.count; i += 3) { const j = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, j); }
  g.computeVertexNormals();
}
/** Offset a simple orthogonal-ish ring inward by d (miter on each vertex). */
function insetRing(r: XZ[], d: number): XZ[] {
  const area = r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0), sg = Math.sign(area);
  const lines = r.map((p, i) => {
    const q = r[(i + 1) % r.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]), tx = (q[0] - p[0]) / l, tz = (q[1] - p[1]) / l;
    const n: XZ = [-tz * sg, tx * sg];  // inward for this winding
    return {p: [p[0] + n[0] * d, p[1] + n[1] * d] as XZ, t: [tx, tz] as XZ};
  });
  return lines.map((L1, i) => {
    const L0 = lines[(i + lines.length - 1) % lines.length];
    const den = L0.t[0] * L1.t[1] - L0.t[1] * L1.t[0];
    if (Math.abs(den) < 1e-6) return L1.p;
    const s = ((L1.p[0] - L0.p[0]) * L1.t[1] - (L1.p[1] - L0.p[1]) * L1.t[0]) / den;
    return [L0.p[0] + L0.t[0] * s, L0.p[1] + L0.t[1] * s] as XZ;
  });
}

/** Roof height at a point: the highest 3DBAG piece containing it (outside its holes), 0 on open ground. */
function roofAt(p: XZ): number {
  let best = 0;
  for (const s of ROOFS) {
    if (inRing(s.rings[0].map(q => [q[0], q[2]] as XZ), p) && !s.rings.slice(1).some(h => inRing(h.map(q => [q[0], q[2]] as XZ), p))) best = Math.max(best, ...s.rings[0].map(q => q[1]));
  }
  return best;
}
/** Outer ring of a roof piece without the closing point, consecutive collinear edges merged. */
function mergedRing(r: number[][]): number[][] {
  let q = r.length > 1 && r[0].every((v, i) => v === r[r.length - 1][i]) ? r.slice(0, -1) : r.slice();
  for (let changed = true; changed && q.length > 3;) {
    changed = false;
    for (let i = 0; i < q.length; i++) {
      const a = q[(i + q.length - 1) % q.length], m = q[i], c = q[(i + 1) % q.length];
      const d1 = Math.atan2(m[2] - a[2], m[0] - a[0]), d2 = Math.atan2(c[2] - m[2], c[0] - m[0]);
      let dd = Math.abs(d1 - d2); if (dd > Math.PI) dd = 2 * Math.PI - dd;
      if (dd < 4 * Math.PI / 180 || Math.hypot(c[0] - m[0], c[2] - m[2]) < 0.05) { q.splice(i, 1); changed = true; break; }
    }
  }
  return q;
}
const mid = (a: XZ, c: XZ): XZ => [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
const NORTH_GABLE = mid(RING[19], RING[20]), SOUTH_GABLE = mid(RING[9], RING[10]);
const END = 0.15;                                     // full-height panels stop short of the corners so no end face lies in a neighbouring wall

export function buildRadion(_w: number, _d: number, b: BuildingTools) {
  // ---- massing: one closed prism per 3DBAG LoD2.2 roof piece ----
  for (const s of ROOFS) {
    const top = Math.max(...s.rings[0].map(q => q[1]));
    const area = Math.abs(s.rings[0].reduce((a, p, i) => { const q = s.rings[0][(i + 1) % s.rings[0].length]; return a + p[0] * q[2] - q[0] * p[2]; }, 0)) / 2;
    const wall = top > 30 ? (area < 20 ? 'copper' : 'concrete') : 'ochre';
    roofPrism(b, s.rings, wall, 'slate');
  }
  setSink(0.05);

  // ---- every exposed wall of the slab and the low wing, read off the roof pieces themselves ----
  for (const s of ROOFS) {
    const o = s.rings[0];
    const area = Math.abs(o.reduce((a, p, i) => { const q = o[(i + 1) % o.length]; return a + p[0] * q[2] - q[0] * p[2]; }, 0)) / 2;
    if (area < 60) continue;                                            // rooftop plant and small sheds keep the plain shell
    const q = mergedRing(o), rxz = q.map(p => [p[0], p[2]] as XZ);
    for (let i = 0; i < q.length; i++) {
      const a = q[i], c = q[(i + 1) % q.length];
      const {f, len} = edge(rxz, [a[0], a[2]], [c[0], c[2]]);
      if (len < 1) continue;
      const top = Math.min(a[1], c[1]);
      const at = (t: number): XZ => [f.origin[0] + f.tangent[0] * t + f.n[0] * 0.6, f.origin[1] + f.tangent[1] * t + f.n[1] * 0.6];
      const base = Math.max(roofAt(at(len * 0.15)), roofAt(at(len / 2)), roofAt(at(len * 0.85)));
      if (top - base < 2) continue;
      const inside = (t: number): XZ => [f.origin[0] + f.tangent[0] * t - f.n[0] * 0.6, f.origin[1] + f.tangent[1] * t - f.n[1] * 0.6];
      if (![0.25, 0.5, 0.75].every(k => inRing(rxz, inside(len * k)))) continue;   // slivers along a neighbouring piece
      const m = mid([a[0], a[2]], [c[0], c[2]]), y0 = base > 0 ? base : -0.3;
      if (top > 30 && Math.hypot(m[0] - NORTH_GABLE[0], m[1] - NORTH_GABLE[1]) < 3) { northGable(b, f, len); continue; }
      if (top > 30 && Math.hypot(m[0] - SOUTH_GABLE[0], m[1] - SOUTH_GABLE[1]) < 3) {   // glass tiles, one column of small windows
        slab(b, f, len / 2, -0.3, len - 2 * END, top + 0.3 - 0.12, 0.1, 'stone');
        for (let y = FLOOR0 + 1.9; y < top - 1.5; y += PITCH) slab(b, f, 4.5, y, 0.7, 0.45, 0.08, 'glass', 0.1);
        continue;
      }
      if (top > 30 && len > 15) { ribbons(b, f, 0, len, y0, top, top > 38 && base > 30 ? {floor0: STRIP, pitch: 4.2, win0: 1.4, winH: 1.5} : {}); continue; }
      if (top > 30) {                                                    // stair cores (brown) and strip ends (beige)
        slab(b, f, len / 2, y0, len - 2 * END, top - y0 - 0.12, 0.1, Math.abs(f.n[1]) > 0.7 ? 'ochre' : 'greyBrick');
        continue;
      }
      // low west wing (inferred): a window ribbon per 3.5 m storey under a concrete fascia course
      ribbons(b, f, 0, len, y0, top - 0.8, {floor0: 0, pitch: 3.5, win0: 1.0, winH: 1.4});
      if (len > 2 * END + 0.5) slab(b, f, len / 2, top - 0.75, len - 2 * END, 0.6, 0.08, 'concrete');
    }
  }
  setSink(0);

  canopy(b);
}
