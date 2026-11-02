import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {put, ringFrame, setSink, slab, poly, segBand, type Frame} from './nearbar-kit';
import {upwardRoofPlane} from './house-geometry';
import {holedWall, type HoledOpening, type WallQuad} from '../../src/canalRecall/landmarks/holedWall';
import {corbelArcadeOutline, crenellationOutline} from '../../src/canalRecall/landmarks/crenellation';
import source from './graansilo-korthals-altes-footprints.json';

/**
 * Graansilo Korthals Altes ("De Stenen Silo"), Silodam, BAG pand 0363100012233585 (BAG bouwjaar 1898; Silodam 100-251).
 * Rijksmonument 422518: grain silo by J.F. Klinkhamer and A.L. van Gendt, 1896-98, for J.Ph. Korthals Altes; converted
 * around 2000 (nl.wikipedia: to André van Stigt's design, in use since 2001) to 92 dwellings and about 4,500 m2 of work
 * space. BAG: 103 woonfunctie and 30 kantoorfunctie units.
 *
 * Register text (cited in graansilo-korthals-altes-brief.md / -inventory.json): a largely symmetric brick building on a
 * plinth, recessed panels closed by round-arch friezes and lesenes, an attic; in the middle the six-storey cleaning
 * building under a slate tent roof, either side a twelve-bay storage wing under a saddle roof with roof light and
 * dormers, the two end bays set back under a mansard; rosette anchors mark the panels; a ground storey of segmental
 * arched openings; brick cornices, corbel turrets (arkeltorentjes); at the north (IJ) end the former boiler house and the
 * L-shaped service house (two storeys, mansard with dormers, short flat-roofed wing).
 *
 * Plan (scripts/landmarks/graansilo-korthals-altes-footprints.json, 3DBAG LoD2.2, CC BY 4.0, BAG CC0) in an axis frame:
 * u along the building (bearing 345.25, u = 0 at the BAG vertex average, north positive), v across (bearing 75.25, east
 * positive). Ring: wings 38.7 m (u -35.0..3.7 and 15.0..53.7), centre tower 11.3 m (3.7..15.0), end bays 8.0 / 7.4 m set
 * back 1.6 m on the west, east front straight at v = 10.0 with a 1.9 m glazed terrace strip to the BAG line at 11.9,
 * north complex u 61.1..77.4 (3DBAG roofs 7-10 m, the white residential box 22.8 m), a small stair block at the SE corner.
 * Heights: 3DBAG wall tops 17.4 (wing eaves) / 20.9 (end bays) / 24.4 (tower) m, roof 24-25 m, tent apex 34.5 m;
 * storeys and bays read from Commons "Silodam, Stenen graansilo foto 2" (Alf van Beem, public domain) at 33.6 px/m and
 * the rectified panorama crops w02/w03/w08/w09 (Gemeente Amsterdam, CC BY 4.0).
 */
type V2 = [number, number];
type C = 'brick' | 'red' | 'stone' | 'ochre' | 'white' | 'glass' | 'frame' | 'dark' | 'slate' | 'bronze' | 'copper' | 'concrete';
const fp = source as {nativeRing: number[][]};
void fp;
let b: BuildingTools;

/* ------------------------------------------------------------------ axis frame */
const AX: V2 = [Math.sin(345.25 * Math.PI / 180), -Math.cos(345.25 * Math.PI / 180)];   // u: along, to the north
const CR: V2 = [Math.sin(75.25 * Math.PI / 180), -Math.cos(75.25 * Math.PI / 180)];     // v: across, to the east
const N = (u: number, v: number): V2 => [u * AX[0] + v * CR[0], u * AX[1] + v * CR[1]];
const rectUV = (u0: number, u1: number, v0: number, v1: number): V2[] => [N(u0, v0), N(u1, v0), N(u1, v1), N(u0, v1)];
const polyUV = (pts: V2[]): V2[] => pts.map(([u, v]) => N(u, v));
const along = (f: Frame, p: V2) => (p[0] - f.origin[0]) * f.tangent[0] + (p[1] - f.origin[1]) * f.tangent[1];

/* ------------------------------------------------------------------ measured heights (m above the street) */
const EAVE = 18.4;             // wing cornice top (3DBAG wall 17.4 at the gutter line behind the cornice; photo 17.9-18.8)
const END_TOP = 20.9;          // end-bay walls (3DBAG 20.9)
const TOWER_BODY = 19.9;       // tower flanks (turrets at the wing cornice, Commons foto 3)
const MID_TOP = 22.0;          // the middle tower under its parapet; parapet to 24.6 (3DBAG walls 24.4)
const TENT_BASE = 22.6;        // eaves of the tent roof over a zinc-clad storey (Commons foto 2 / 3)
const APEX = 34.5;             // tent roof (3DBAG ridge)
const PLINTH = 3.1;            // plinth band
const PANEL: [number, number] = [3.4, 13.5];     // recessed panel (spaarveld) glazing (Commons foto 2 at 33.6 px/m, cornice at 18.4)
const FRIEZE = 13.5;           // corbel arcade under the panel head
const ATTIC: [number, number] = [15.2, 17.0];    // attic window
const TERRACE = 21.0, PENT = 24.4;               // roof terrace and the converted roof storey
const FLOORS = [5.95, 8.5, 11.05];               // floor edges behind the panel glazing (four rows of glazing)

/* ------------------------------------------------------------------ volumes (u, v) */
const V_E = 10.0;
const WS = rectUV(-35.0, 3.7, -10.7, V_E);
const ES = rectUV(-43.0, -35.0, -9.05, V_E);
const TW = rectUV(3.7, 15.0, -10.8, 10.4);
const WN = rectUV(15.0, 53.7, -10.6, V_E);
const EN = rectUV(53.7, 61.1, -8.95, V_E);
const BOX = rectUV(61.1, 66.8, -7.0, 5.0);
const DIENST = rectUV(66.8, 77.4, -10.6, -1.0);
const DSHORT = rectUV(61.1, 66.8, -10.6, -7.0);
const KETEL = polyUV([[61.1, 5.0], [66.8, 5.0], [66.8, -1.0], [77.4, -1.0], [77.4, V_E], [61.1, V_E]]);
const ANNEX = polyUV([[-43.0, 5.6], [-45.5, 5.6], [-46.0, 8.8], [-44.0, 11.4], [-40.6, 11.8], [-40.6, V_E], [-43.0, V_E]]);
const TERR = rectUV(-40.6, 65.4, V_E, 11.9);

/* ------------------------------------------------------------------ mesh helpers (pakhuis-australie-builder.ts) */
class Mesh {
  private tris = new Map<C, number[]>();
  quad(f: Frame, q: WallQuad, c: C) {
    const w = q.pts.map(([t, y, o]) => [f.origin[0] + f.tangent[0] * t + f.n[0] * o, y, f.origin[1] + f.tangent[1] * t + f.n[1] * o]);
    const a = this.tris.get(c) ?? [];
    a.push(...w[0], ...w[1], ...w[2], ...w[0], ...w[2], ...w[3]);
    this.tris.set(c, a);
  }
  rect(f: Frame, t0: number, t1: number, y0: number, y1: number, o: number, c: C) {
    this.quad(f, {pts: [[t0, y0, o], [t1, y0, o], [t1, y1, o], [t0, y1, o]], normal: [0, 0, 1]}, c);
  }
  /** Triangle in native (x, y, z), wound so its normal points along `dir` (default up). */
  tri(p: number[], q: number[], r: number[], c: C, dir: number[] = [0, 1, 0]) {
    const e1 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], e2 = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const a = this.tris.get(c) ?? [];
    if (n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2] >= 0) a.push(...p, ...q, ...r); else a.push(...p, ...r, ...q);
    this.tris.set(c, a);
  }
  flush() {
    for (const [c, pos] of this.tris) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      b.add(g, c);
    }
    this.tris.clear();
  }
}
let m: Mesh;
type Cut = HoledOpening & {back: C; reveal?: C};
function wall(polygon: V2[], i: number, y0: number, y1: number, c: C, cuts: Cut[] = [], ta?: number, tb?: number): {f: Frame; len: number} {
  const {f, len} = ringFrame(polygon, i), a = ta ?? 0, z = tb ?? len;
  const g: Frame = {...f, origin: [f.origin[0] + f.tangent[0] * a, f.origin[1] + f.tangent[1] * a]};
  const hw = holedWall(z - a, y0, y1, cuts);
  for (const q of hw.face) m.quad(g, q, c);
  hw.reveals.forEach((qs, k) => qs.forEach(q => m.quad(g, q, cuts[k].reveal ?? c)));
  hw.backs.forEach((q, k) => m.quad(g, q, cuts[k].back));
  m.flush(); // wall faces before their trim: the exported soup then meets the large, exactly oriented wall triangles first
  return {f: g, len: z - a};
}
function roof(polygon: V2[], h: number, c: C) {
  b.add(upwardRoofPlane(new T.Shape(polygon.map(p => new T.Vector2(p[0], p[1]))), h), c);
}
/** Small low-poly disc (rosette anchor) facing out of the wall. */
function rosette(f: Frame, t: number, y: number) {
  put(b, f, new T.CylinderGeometry(0.13, 0.13, 0.08, 6).rotateX(Math.PI / 2).translate(0, 0, 0.04), t, y, 0, 'dark');
}
const native3 = (p: V2, y: number) => [p[0], y, p[1]];
/** Wall-plane outline extruded `d` out of the wall with its back cap dropped (it sits in the wall): front face + sides only. */
function front(f: Frame, t: number, y: number, pts: [number, number][], d: number, c: C, out = 0) {
  const k = 0.02, contour = pts.map(p => new T.Vector2(p[0], p[1])), faces = T.ShapeUtils.triangulateShape(contour, []), pos: number[] = [];
  const P = (q: [number, number], z: number) => [q[0], q[1], z];
  for (const [a, b2, c2] of faces) {
    const [A, B, C2] = [pts[a], pts[b2], pts[c2]], z = (B[0] - A[0]) * (C2[1] - A[1]) - (B[1] - A[1]) * (C2[0] - A[0]);
    if (z >= 0) pos.push(...P(A, d), ...P(B, d), ...P(C2, d)); else pos.push(...P(A, d), ...P(C2, d), ...P(B, d));
  }
  const ccw = T.ShapeUtils.isClockWise(contour) ? -1 : 1;
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[i], p1 = pts[(i + 1) % pts.length];
    const A = P(p0, -k), B = P(p1, -k), C2 = P(p1, d), D = P(p0, d);
    if (ccw > 0) pos.push(...A, ...B, ...C2, ...A, ...C2, ...D); else pos.push(...A, ...C2, ...B, ...A, ...D, ...C2);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  put(b, f, g, t, y, out, c);
}
/** Segmental arch band (chord W, rise, thickness th) springing at y, four segments, front-only extrusion. */
function seg(f: Frame, t: number, y: number, W: number, rise: number, th: number, d: number, c: C, out = 0) {
  const R = (W * W / 4 + rise * rise) / (2 * rise), n = 4, pts: [number, number][] = [];
  const yo = (x: number) => rise - R + Math.sqrt(R * R - x * x);
  for (let i = n; i >= 0; i--) { const x = -W / 2 + W * i / n; pts.push([x, yo(x) - th]); }
  for (let i = 0; i <= n; i++) { const x = -W / 2 + W * i / n; pts.push([x, yo(x)]); }
  pts.reverse();
  front(f, t, y, pts, d, c, out);
}

/* ------------------------------------------------------------------ the silo-wing bay system */
/**
 * One wing face: `bays` equal bays over t in [0, len] of the face frame (lesenes between). Per bay (w02/w03, Commons foto 2):
 * a segmental-arched door in the plinth, the recessed panel glazed in the conversion (two lights, floor edges), a corbel
 * arcade of five arches under the panel head, rosette anchors on the lesenes, the attic window in a white frame with a
 * white hood, and a stone cornice on brackets. `top` is the wall top (EAVE for the wings, END_TOP for the end bays).
 */
function bayFace(polygon: V2[], edge: number, bays: number, top: number, o: {ta?: number; tb?: number; plinthDoors?: boolean; plinthSill?: number} = {}) {
  const {len: full} = ringFrame(polygon, edge), ta = o.ta ?? 0, tb = o.tb ?? full, len = tb - ta, p = len / bays;
  const centres = [...Array(bays)].map((_, k) => (k + 0.5) * p);
  const pw = Math.min(2.75, p - 1.05);                    // panel width (lesene 1.0-1.2 m on photo)
  const cuts: Cut[] = [];
  for (const c of centres) {
    cuts.push({t0: c - pw / 2, t1: c + pw / 2, y0: PANEL[0], y1: PANEL[1], depth: 0.32, back: 'glass', reveal: 'brick'});
    cuts.push({t0: c - 0.58, t1: c + 0.58, y0: ATTIC[0], y1: ATTIC[1], depth: 0.18, back: 'glass', reveal: 'white'});
    if (o.plinthDoors !== false) cuts.push({t0: c - 0.62, t1: c + 0.62, y0: o.plinthSill ?? 0.25, y1: 2.3, depth: 0.28, back: 'glass', reveal: 'brick'});
    if (top > EAVE + 1) cuts.push({t0: c - 0.55, t1: c + 0.55, y0: 18.75, y1: 20.15, depth: 0.18, back: 'glass', reveal: 'white'});
  }
  const {f} = wall(polygon, edge, 0, top, 'brick', cuts, ta, tb);
  for (const c of centres) {
    // panel glazing: grey mullion, side frames and the floor edges (the conversion's storeys)
    m.rect(f, c - 0.04, c + 0.04, PANEL[0], PANEL[1], -0.26, 'frame');
    for (const y of FLOORS) m.rect(f, c - pw / 2, c + pw / 2, y - 0.17, y + 0.17, -0.26, 'frame');
    m.rect(f, c - pw / 2, c + pw / 2, PANEL[0], PANEL[0] + 0.12, -0.26, 'frame');
    // corbel arcade (rondboogfries) closing the panel, buff corbels and arch rim
    front(f, c - pw / 2 - 0.06, 0, corbelArcadeOutline({t0: 0, t1: pw + 0.12, y0: FRIEZE - 0.05, y1: FRIEZE + 0.55, arches: 5, corbel: 0.13, drop: 0.14, segments: 3}), 0.12, 'ochre');
    // panel sill
    slab(b, f, c, PANEL[0] - 0.22, pw + 0.2, 0.14, 0.12, 'stone');
    // attic window: white sill and segmental hood
    slab(b, f, c, ATTIC[0] - 0.12, 1.45, 0.12, 0.14, 'white');
    seg(f, c, ATTIC[1] + 0.02, 1.5, 0.22, 0.18, 0.12, 'white');
    m.rect(f, c - 0.03, c + 0.03, ATTIC[0], ATTIC[1], -0.12, 'white');
    // plinth door: segmental arch of buff headers over a brick infill, glazed door with a mullion
    if (o.plinthDoors !== false) {
      seg(f, c, 2.32, 1.5, 0.32, 0.22, 0.08, 'ochre');
      m.rect(f, c - 0.03, c + 0.03, o.plinthSill ?? 0.25, 2.25, -0.2, 'frame');
    }
    if (top > EAVE + 1) { slab(b, f, c, 18.63, 1.35, 0.12, 0.14, 'white'); m.rect(f, c - 0.03, c + 0.03, 18.75, 20.15, -0.12, 'white'); }
  }
  // lesenes: rosette anchors (two per lesene, between the floor edges)
  for (let k = 0; k <= bays; k++) {
    const t = Math.min(len - 0.35, Math.max(0.35, k * p));
    for (const y of [7.2, 9.8]) rosette(f, t, y);
  }
  // horizontal courses over the whole face: plinth band, frieze course, attic sill course, cornice frieze
  slab(b, f, len / 2, PLINTH - 0.2, len, 0.2, 0.1, 'ochre');
  slab(b, f, len / 2, 14.15, len, 0.3, 0.14, 'brick');
  slab(b, f, len / 2, 14.45, len, 0.12, 0.08, 'ochre');
  // cornice: stone slab on one bracket per lesene (at the wing cornice line also on the taller end bays)
  const ct = EAVE - 0.45;
  slab(b, f, len / 2, ct, len + 0.3, 0.45, 0.5, 'stone');
  for (let k = 0; k <= bays; k++) slab(b, f, Math.min(len - 0.2, Math.max(0.2, k * p)), ct - 0.42, 0.24, 0.42, 0.36, 'stone');
  return {f, len, centres};
}

/* ------------------------------------------------------------------ wing roofs: slope with dormers, terrace, roof storey */
/**
 * Cross-section of a wing roof (3DBAG LoD2.2 and Commons foto 2): slate slope from the cornice (EAVE at the wall) to
 * the terrace at TERRACE, 3.35 m in; a 2 m roof terrace with a mesh railing; the converted roof storey (aluminium and
 * glass, flat roof at PENT) 5 m either side of the ridge line, with white ventilation stacks; one zinc dormer per bay.
 */
function wingRoof(u0: number, u1: number, vW: number, vE: number, bays: number, stacks: number[], cap0: boolean, cap1: boolean) {
  const vc = (vW + vE) / 2, hw = (vE - vW) / 2, inn = 3.35, hp = 5.0;
  const P = (u: number, v: number, y: number) => native3(N(u, v), y);
  for (const s of [-1, 1]) {
    const vEdge = vc + s * hw, vIn = vc + s * (hw - inn), vP = vc + s * hp;
    // slope
    m.tri(P(u0, vEdge, EAVE), P(u1, vEdge, EAVE), P(u1, vIn, TERRACE), 'slate');
    m.tri(P(u0, vEdge, EAVE), P(u1, vIn, TERRACE), P(u0, vIn, TERRACE), 'slate');
    void vP;
  }
  // terrace, across the whole width so the roof storey stands on it
  {
    const a = vc - (hw - inn), c = vc + (hw - inn);
    m.tri(P(u0, a, TERRACE), P(u1, a, TERRACE), P(u1, c, TERRACE), 'concrete');
    m.tri(P(u0, a, TERRACE), P(u1, c, TERRACE), P(u0, c, TERRACE), 'concrete');
  }
  // roof storey: closed box from TERRACE to PENT, glazed long faces in alternating glass and grey panels
  const pu0 = u0 + (cap0 ? 0 : 0.35), pu1 = u1 - (cap1 ? 0 : 0.35);
  const box = rectUV(pu0, pu1, vc - hp, vc + hp);
  for (let i = 0; i < 4; i++) {
    const {f, len} = ringFrame(box, i);
    if (len < 12) { wall(box, i, TERRACE, PENT, 'copper'); continue; }
    const n = bays, p = len / n, cuts: Cut[] = [];
    for (let k = 0; k < n; k++) cuts.push({t0: k * p + 0.35, t1: (k + 1) * p - 0.35, y0: TERRACE + 0.15, y1: PENT - 0.55, depth: 0.15, back: 'glass', reveal: 'copper'});
    wall(box, i, TERRACE, PENT, 'copper', cuts);
    for (let k = 0; k < n; k++) m.rect(f, (k + 0.5) * p - 0.03, (k + 0.5) * p + 0.03, TERRACE + 0.15, PENT - 0.55, -0.08, 'frame');
  }
  roof(box, PENT, 'concrete');
  for (const s of [-1, 1]) {
    const vR = vc + s * (hw - inn - 0.1);
    const a = N(u0 + 0.2, vR), c = N(u1 - 0.2, vR), L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    b.add(new T.BoxGeometry(L, 1.1, 0.04).rotateY(-Math.atan2(c[1] - a[1], c[0] - a[0])).translate((a[0] + c[0]) / 2, TERRACE + 0.55, (a[1] + c[1]) / 2), 'frame');
  }
  // roof profile closed over the 1.6 m strip where the end bays are set back on the west (brick gable piece)
  for (const [u, vS] of [[u0, cap0 ? NaN : -9.05], [u1, cap1 ? NaN : -8.95]] as [number, number][]) {
    if (!Number.isFinite(vS) || Math.abs(u - 3.7) < 0.1 || Math.abs(u - 15.0) < 0.1) continue;
    const yS = EAVE + (vS - vW) * (TERRACE - EAVE) / inn, dir = [AX[0] * Math.sign(u - (u0 + u1) / 2), 0, AX[1] * Math.sign(u - (u0 + u1) / 2)];
    m.tri(P(u, vW, EAVE), P(u, vS, EAVE), P(u, vS, yS), 'brick', dir);
  }
  // ventilation stacks on the roof storey (white rendered boxes, Commons foto 2: pairs over the wings)
  for (const u of stacks) { const p = N(u, vc - 1.5); b.add(new T.BoxGeometry(0.9, 1.9, 1.1).rotateY(-Math.atan2(AX[1], AX[0])).translate(p[0], PENT + 0.95, p[1]), 'white'); }
  // dormers: one per bay on each slope
  const p = (u1 - u0) / bays;
  for (let k = 0; k < bays; k++) for (const s of [-1, 1]) {
    const u = u0 + (k + 0.5) * p, vFront = vc + s * (hw - 1.15), vBack = vc + s * (hw - inn + 0.3);
    const a = N(u, vFront), c = N(u, vBack), d = Math.hypot(c[0] - a[0], c[1] - a[1]), mid: V2 = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
    const yb = EAVE + 0.55, yt = 20.5, ang = -Math.atan2(c[1] - a[1], c[0] - a[0]);
    // zinc dormer as four walls and a flat top; the front carries the window in a white reveal (glass set back 10 cm)
    void d; void mid; void ang;
    const R = rectUV(u - 0.75, u + 0.75, Math.min(vFront, vBack), Math.max(vFront, vBack));
    for (let e = 0; e < 4; e++) {
      const dn = ringFrame(R, e).f.n[0] * CR[0] + ringFrame(R, e).f.n[1] * CR[1];
      if (dn * s > 0.99) wall(R, e, yb, yt, 'copper', [{t0: 0.22, t1: 1.28, y0: yb + 0.4, y1: yb + 1.35, depth: 0.1, back: 'glass', reveal: 'white'}]);
      else if (Math.abs(dn) < 0.05) wall(R, e, yb, yt, 'copper');
    }
    roof(R, yt, 'copper');
  }
}

/* ------------------------------------------------------------------ the centre tower (reinigingsgebouw) */
/**
 * The centre building (w08-256, w01-75, Commons foto 2/3/4): brick flanks to TOWER_BODY with corbel turrets at the wing
 * cornice, a 5.8 m middle tower 0.4 m proud of both long fronts rising to a corbel arcade and a crenellated parapet with
 * corbel turrets at its corners, and behind the parapets a zinc-clad storey under the slate tent roof (eaves 22.6 m,
 * apex 34.5 m) with dormers and an apex lantern with two finials.
 * Street (west) front of the middle tower: arched door, arched window, two storeys of triple narrow windows, a recessed
 * field of three tall round-arched lights, a small window. Water (east) front (w01-75): glazed entrance, three storeys of
 * paired windows, the same three lights.
 */
const TU = 9.35, CW = 5.8;
const MID = rectUV(TU - CW / 2, TU + CW / 2, -11.2, 10.8);
function towerFront(edge: number, water: boolean) {
  const {f, len} = ringFrame(TW, edge), fw = (len - CW) / 2;
  const fc = [fw / 2, len - fw / 2];
  const cuts: Cut[] = [];
  for (const t of fc) {
    for (const [y0, y1] of [[3.6, 5.9], [6.8, 12.6], [14.3, 16.7]] as [number, number][]) cuts.push({t0: t - 0.5, t1: t + 0.5, y0, y1, depth: 0.22, back: 'glass', reveal: 'brick'});
    cuts.push({t0: t - 0.6, t1: t + 0.6, y0: water ? 1.25 : 0.05, y1: 2.3, depth: 0.28, back: 'glass', reveal: 'brick'});
  }
  wall(TW, edge, 0, TOWER_BODY, 'brick', cuts.filter(k => k.t1 < fw + 1e-6 || k.t0 > len - fw - 1e-6));
  for (const t of fc) {
    for (const y of [8.7, 10.6]) m.rect(f, t - 0.5, t + 0.5, y, y + 0.08, -0.16, 'frame');
    seg(f, t, 2.3, 1.45, 0.3, 0.22, 0.08, 'ochre');
    slab(b, f, t, PLINTH - 0.2, fw, 0.2, 0.1, 'ochre');
    slab(b, f, t, EAVE - 0.45, fw + 0.2, 0.45, 0.5, 'stone');
    for (const y of [6.6, 12.8]) slab(b, f, t, y, 1.25, 0.12, 0.1, 'stone');
  }
  slab(b, f, len / 2, TOWER_BODY - 0.05, len + 0.1, 0.35, 0.12, 'stone');                    // coping 10 cm over the flat roof
  // the middle tower's front, 0.4 m proud: its own holed wall from the street to MID_TOP
  const {f: g, len: gl} = ringFrame(MID, [0, 1, 2, 3].find(i => ringFrame(MID, i).len < 7 && ringFrame(MID, i).f.n[0] * f.n[0] + ringFrame(MID, i).f.n[1] * f.n[1] > 0.99)!);
  const h = gl / 2, cc: Cut[] = [];
  const add = (dt: number, w: number, y0: number, y1: number, depth = 0.25) => cc.push({t0: h + dt - w / 2, t1: h + dt + w / 2, y0, y1, depth, back: 'glass', reveal: 'brick'});
  if (water) {
    add(0, 2.6, 0.05, 4.2, 0.35);                                                           // glazed entrance
    for (const [y0, y1] of [[5.9, 7.6], [9.1, 10.8], [12.0, 13.7]]) for (const dt of [-0.55, 0.55]) add(dt, 0.7, y0, y1);
  } else {
    add(0, 1.6, 0.05, 2.6, 0.35);                                                           // arched door
    add(0, 1.3, 3.4, 5.8);                                                                  // arched window
    for (const [y0, y1] of [[7.4, 9.2], [11.0, 12.8]]) for (const dt of [-1.0, 0, 1.0]) add(dt, 0.55, y0, y1);
  }
  add(0, 3.3, 15.0, 18.6, 0.45);                                                            // recessed field of the three lights
  add(0, 0.8, 19.3, 20.0);                                                                  // small window over the field
  const field = cc.length - 2;
  const hw = holedWall(gl, 0, MID_TOP, cc);
  for (const q of hw.face) m.quad(g, q, 'brick');
  hw.reveals.forEach((qs, k) => qs.forEach(q => m.quad(g, q, cc[k].reveal ?? 'brick')));
  hw.backs.forEach((q, k) => m.quad(g, q, cc[k].back));
  if (!water) { seg(g, h, 2.1, 1.9, 0.5, 0.25, 0.1, 'ochre'); seg(g, h, 5.3, 1.6, 0.5, 0.25, 0.1, 'ochre'); }
  else for (const y of [7.6, 10.8, 13.7]) slab(b, g, h, y, 2.1, 0.14, 0.1, 'stone');
  // the three round-arched lights in the field: brick piers between them, round heads, glazing bars
  void field;
  for (const dt of [-0.52, 0.52]) put(b, g, new T.BoxGeometry(0.34, 3.6, 0.3).translate(0, 1.8, 0.15), h + dt, 15.0, -0.45, 'brick');
  for (const dt of [-1.04, 0, 1.04]) archHorns(g, h + dt, 18.15, 0.35, -0.45);
  for (const dt of [-1.04, 0, 1.04]) m.rect(g, h + dt - 0.02, h + dt + 0.02, 15.0, 18.15, -0.4, 'frame');
  for (const y of [3.25, 14.8]) slab(b, g, h, y - 0.16, gl + 0.1, 0.16, 0.1, 'ochre');
  slab(b, g, h, 14.15, gl + 0.1, 0.3, 0.14, 'brick');
  // corbel arcade and crenellated parapet (MID_TOP to 24.6 m): the parapet is a 0.45 m thick solid on the front line
  front(g, 0, 0, corbelArcadeOutline({t0: 0, t1: gl, y0: 20.6, y1: MID_TOP, arches: 7, corbel: 0.16, drop: 0.25, segments: 3}), 0.18, 'brick');
  slab(b, g, h, MID_TOP - 0.02, gl + 0.1, 0.2, 0.24, 'stone');
  poly(b, g, 0, 0, crenellationOutline({t0: 0, t1: gl, y0: MID_TOP + 0.1, yCrenel: 23.75, y1: 24.6, merlons: 5, ratio: 0.55}), 0.45, 'brick', -0.45);
  // corbel turrets (arkeltorentjes): round shafts on stone corbels with stone caps, parapet corners and flank lesenes
  for (const [fr, t, y0, y1] of [[g, 0, 21.0, 25.1], [g, gl, 21.0, 25.1], [f, 0.35, 18.4, 20.6], [f, len - 0.35, 18.4, 20.6]] as [Frame, number, number, number][]) {
    put(b, fr, new T.CylinderGeometry(0.36, 0.2, 0.5, 8).translate(0, 0.25, 0), t, y0 - 0.5, 0.12, 'stone');
    put(b, fr, new T.CylinderGeometry(0.36, 0.36, y1 - y0, 8).translate(0, (y1 - y0) / 2, 0), t, y0, 0.12, 'brick');
    put(b, fr, new T.ConeGeometry(0.46, 0.8, 8).translate(0, 0.4, 0), t, y1, 0.12, 'stone');
  }
}
/** Round head of an arched light: the two brick horns between the semicircle and its square, at offset `out`. */
function archHorns(f: Frame, t: number, spring: number, r: number, out: number) {
  const s = new T.Shape();
  s.moveTo(-r, 0); s.lineTo(-r, r + 0.1); s.lineTo(r, r + 0.1); s.lineTo(r, 0); s.absarc(0, 0, r, 0, Math.PI, false);
  put(b, f, new T.ExtrudeGeometry(s, {depth: 0.3, bevelEnabled: false, curveSegments: 4}), t, spring, out, 'brick');
}

function tower() {
  for (let i = 0; i < 4; i++) {
    const {f, len} = ringFrame(TW, i);
    if (len < 12) towerFront(i, f.n[0] * CR[0] + f.n[1] * CR[1] > 0);
    else wall(TW, i, 0, TOWER_BODY, 'brick');                         // ends: above the wing roofs, and the 0.4 m steps
  }
  roof(TW, TOWER_BODY, 'concrete');
  // the middle tower's sides (the fronts are built by towerFront)
  for (let i = 0; i < 4; i++) { const {len} = ringFrame(MID, i); if (len > 7) wall(MID, i, 0, MID_TOP, 'brick'); }
  roof(MID, MID_TOP, 'concrete');
  // zinc-clad storey under the tent roof, behind the parapets
  const hu = 5.0, hv = 6.6, vc = 0.0;
  const ZB = rectUV(TU - hu, TU + hu, vc - hv, vc + hv);
  for (let i = 0; i < 4; i++) {
    const {f, len} = ringFrame(ZB, i), cuts: Cut[] = [];
    for (let t = 1.3; t < len - 1; t += 2.6) cuts.push({t0: t - 0.5, t1: t + 0.5, y0: TOWER_BODY + 0.6, y1: TENT_BASE - 0.5, depth: 0.15, back: 'glass', reveal: 'white'});
    wall(ZB, i, TOWER_BODY, TENT_BASE, 'copper', cuts.filter(c => !(len < 12 && Math.abs((c.t0 + c.t1) / 2 - len / 2) < CW / 2 + 0.6)));
    void f;
  }
  // tent roof: eaves 0.4 m over the zinc storey, slate, truncated under the apex lantern
  const eu = hu + 0.4, ev = hv + 0.4, top = APEX - 0.9, k = (top - TENT_BASE) / (APEX - TENT_BASE), inset = 1 - k;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([su, sv]) => native3(N(TU + su * eu, vc + sv * ev), TENT_BASE));
  const tops = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([su, sv]) => native3(N(TU + su * eu * inset, vc + sv * ev * inset), top));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    m.tri(corners[i], corners[j], tops[j], 'bronze'); m.tri(corners[i], tops[j], tops[i], 'bronze');
  }
  // eaves soffit (the overhang seen from below)
  const ring0 = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([su, sv]) => native3(N(TU + su * eu, vc + sv * ev), TENT_BASE));
  m.tri(ring0[0], ring0[1], ring0[2], 'white', [0, -1, 0]); m.tri(ring0[0], ring0[2], ring0[3], 'white', [0, -1, 0]);
  m.tri(tops[0], tops[1], tops[2], 'bronze'); m.tri(tops[0], tops[2], tops[3], 'bronze');
  const ap = N(TU, vc);
  b.add(new T.BoxGeometry(2 * eu * inset * 0.8, 0.9, 2 * ev * inset * 0.8).rotateY(-Math.atan2(AX[1], AX[0])).translate(ap[0], top + 0.45, ap[1]), 'white');
  for (const s of [-1, 1]) { const p = N(TU, vc + s * 0.8); b.add(new T.CylinderGeometry(0.08, 0.12, 1.4, 6).translate(p[0], top + 0.9 + 0.7, p[1]), 'stone'); b.add(new T.SphereGeometry(0.2, 6, 4).translate(p[0], top + 0.9 + 1.5, p[1]), 'stone'); }
  // tent-roof dormers: two on each long face (Commons foto 3: white pedimented, on the street and water slopes)
  for (const sv of [-1, 1]) for (const du of [-2.0, 2.0]) {
    const fr = 0.35, vF = vc + sv * ev * (1 - fr), y = TENT_BASE + (APEX - TENT_BASE) * fr;
    const p = N(TU + du, vF), q = N(TU + du, vF - sv * 1.6), mid: V2 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const ang = -Math.atan2(q[1] - p[1], q[0] - p[0]);
    b.add(new T.BoxGeometry(1.6, 1.6, 1.2).rotateY(ang).translate(mid[0], y + 0.1, mid[1]), 'white');
    b.add(new T.ConeGeometry(0.95, 0.6, 4, 1).rotateY(Math.PI / 4).scale(1.0, 1, 0.75).rotateY(ang).translate(mid[0], y + 1.2, mid[1]), 'white');
    const out: V2 = [CR[0] * sv, CR[1] * sv];
    put(b, {origin: p, tangent: [out[1], -out[0]], n: out}, new T.BoxGeometry(0.85, 0.95, 0.12).translate(0, 0.475, 0.06), 0, y - 0.3, 0, 'glass');
  }
}

/* ------------------------------------------------------------------ the north complex */
function northComplex() {
  // white residential box on the former elevator tower: brick base to 10 m, light panels to 22.8 m, window grid
  for (let i = 0; i < 4; i++) {
    const {f, len} = ringFrame(BOX, i);
    if (f.n[0] * AX[0] + f.n[1] * AX[1] < -0.99) { wall(BOX, i, 20.5, 22.8, 'concrete'); continue; }   // over the north end bay's wall
    const westOrEast = Math.abs(f.n[0] * CR[0] + f.n[1] * CR[1]) > 0.99;
    wall(BOX, i, 6.8, 10.0, 'brick');
    const cols = westOrEast ? [len * 0.33, len * 0.72] : [len * 0.2, len * 0.35, len * 0.65, len * 0.8];
    const cuts: Cut[] = [];
    for (let r = 0; r < 5; r++) for (const t of cols) cuts.push({t0: t - 0.55, t1: t + 0.55, y0: 10.6 + r * 2.5, y1: 12.5 + r * 2.5, depth: 0.15, back: 'glass', reveal: 'concrete'});
    wall(BOX, i, 10.0, 22.8, 'concrete', cuts);
    for (const c of cuts) m.rect(f, (c.t0 + c.t1) / 2 - 0.03, (c.t0 + c.t1) / 2 + 0.03, c.y0, c.y1, -0.08, 'frame');
    slab(b, f, len / 2, 22.8 - 0.2, len + 0.1, 0.3, 0.08, 'stone');
  }
  roof(BOX, 22.8, 'concrete');
  // railing on the box roof
  for (let i = 0; i < 4; i++) { const {f, len} = ringFrame(BOX, i); put(b, f, new T.BoxGeometry(len - 0.4, 1.0, 0.04).translate(0, 0.5, 0), len / 2, 22.8, -0.3, 'frame'); }

  // service house (dienstwoning): two brick storeys to 7.0 m, white eaves cornice, tile mansard with white dormers
  const DH = 7.0;
  for (let i = 0; i < 4; i++) {
    const {f, len} = ringFrame(DIENST, i);
    const nu = f.n[0] * AX[0] + f.n[1] * AX[1], nv = f.n[0] * CR[0] + f.n[1] * CR[1];
    if (nu < -0.99) continue;                                          // south: against the box and the short wing
    const n = Math.max(2, Math.round(len / 2.4)), p = len / n, cuts: Cut[] = [];
    if (nv > 0.99) { wall(DIENST, i, 0, DH, 'brick'); continue; }      // east: against the boiler house
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) * p;
      cuts.push({t0: t - 0.48, t1: t + 0.48, y0: k % 3 === 0 ? 0.05 : 0.9, y1: 2.5, depth: 0.2, back: k % 3 === 0 ? 'dark' : 'glass', reveal: 'white'});
      cuts.push({t0: t - 0.48, t1: t + 0.48, y0: 3.9, y1: 5.9, depth: 0.2, back: 'glass', reveal: 'white'});
    }
    wall(DIENST, i, 0, DH, 'brick', cuts);
    for (const c of cuts) segBand(b, f, (c.t0 + c.t1) / 2, c.y1 - 0.05, 1.25, 0.18, 0.2, 0.08, 'ochre');
    slab(b, f, len / 2, 3.25, len, 0.15, 0.1, 'ochre');
    slab(b, f, len / 2, DH - 0.35, len + 0.4, 0.35, 0.45, 'white');
  }
  // mansard: steep lower slope 7.0 -> 9.4 (1.0 m in), shallow top to 10.0
  const uc = (66.8 + 77.4) / 2, vc = (-10.6 + -1.0) / 2, hu = 5.3, hv = 4.8;
  const ring = (iu: number, iv: number, y: number) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([su, sv]) => native3(N(uc + su * (hu - iu), vc + sv * (hv - iv)), y));
  const r0 = ring(-0.15, -0.15, DH), r1 = ring(1.0, 1.0, 9.4), r2 = ring(3.5, 3.0, 10.0);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; m.tri(r0[i], r0[j], r1[j], 'red'); m.tri(r0[i], r1[j], r1[i], 'red'); m.tri(r1[i], r1[j], r2[j], 'red'); m.tri(r1[i], r2[j], r2[i], 'red'); }
  m.tri(r2[0], r2[1], r2[2], 'red'); m.tri(r2[0], r2[2], r2[3], 'red');
  // white pedimented dormers: four on the west slope (w05), two on the north slope (w04)
  const dorm = (u: number, v: number, nu: number, nv: number) => {
    const p = N(u, v), ang = Math.atan2(nu * AX[0] + nv * CR[0], nu * AX[1] + nv * CR[1]);
    b.add(new T.BoxGeometry(1.2, 1.3, 1.2).translate(0, 0.65, 0).rotateY(ang).translate(p[0], 7.75, p[1]), 'white');
    b.add(new T.ConeGeometry(0.85, 0.5, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.7).rotateY(ang).translate(p[0], 9.3, p[1]), 'white');
    const q = N(u + nu * 0.62, v + nv * 0.62);
    b.add(new T.BoxGeometry(0.75, 0.8, 0.06).rotateY(ang).translate(q[0], 8.4, q[1]), 'glass');
  };
  for (const u of [68.6, 71.2, 73.4, 75.6]) dorm(u, -10.6 + 0.85, 0, -1);
  for (const v of [-8.0, -3.6]) dorm(77.4 - 0.85, v, 1, 0);
  // short flat-roofed wing (register: "de korte vleugel plat afgedekt")
  for (let i = 0; i < 4; i++) {
    const {f, len} = ringFrame(DSHORT, i);
    const nu = f.n[0] * AX[0] + f.n[1] * AX[1], nv = f.n[0] * CR[0] + f.n[1] * CR[1];
    if (nv > 0.99 || nu > 0.99) continue;                               // against the box and the service house
    if (nu < -0.99) { const t1 = along(f, N(61.1, -10.6)), t2 = along(f, N(61.1, -8.95)); wall(DSHORT, i, 0, DH, 'brick', [], Math.min(t1, t2), Math.max(t1, t2)); continue; }
    const cuts: Cut[] = [{t0: len * 0.3 - 0.5, t1: len * 0.3 + 0.5, y0: 0.05, y1: 2.5, depth: 0.25, back: 'dark', reveal: 'white'}, {t0: len * 0.7 - 0.48, t1: len * 0.7 + 0.48, y0: 0.9, y1: 2.5, depth: 0.2, back: 'glass', reveal: 'white'},
      {t0: len * 0.3 - 0.48, t1: len * 0.3 + 0.48, y0: 3.9, y1: 5.9, depth: 0.2, back: 'glass', reveal: 'white'}, {t0: len * 0.7 - 0.48, t1: len * 0.7 + 0.48, y0: 3.9, y1: 5.9, depth: 0.2, back: 'glass', reveal: 'white'}];
    wall(DSHORT, i, 0, DH, 'brick', cuts);
    slab(b, f, len / 2, DH - 0.3, len + 0.2, 0.4, 0.45, 'white');
  }
  roof(DSHORT, DH, 'concrete');

  // boiler house (ketelhuis): one tall storey to 6.8 m, round-arched windows, corbel arcade, roof terrace with glass rail
  const KH = 6.8;
  for (let i = 0; i < KETEL.length; i++) {
    const {f, len} = ringFrame(KETEL, i);
    const nu = f.n[0] * AX[0] + f.n[1] * AX[1], nv = f.n[0] * CR[0] + f.n[1] * CR[1];
    void nu; void nv;
    if (i !== 3 && i !== 4) continue;                                  // edges 0-2 and 5 abut the box, the service house and the north end bays
    const n = Math.max(1, Math.round(len / 3.6)), p = len / n, cuts: Cut[] = [];
    for (let k = 0; k < n; k++) cuts.push({t0: (k + 0.5) * p - 0.8, t1: (k + 0.5) * p + 0.8, y0: 0.6, y1: 4.0, depth: 0.3, back: 'glass', reveal: 'brick'});
    wall(KETEL, i, 0, KH, 'brick', cuts);
    for (const c of cuts) { const t = (c.t0 + c.t1) / 2; segBand(b, f, t, 3.95, 1.85, 0.9, 0.28, 0.1, 'ochre'); m.rect(f, t - 0.03, t + 0.03, 0.6, 4.0, -0.22, 'frame'); m.rect(f, c.t0, c.t1, 2.6, 2.66, -0.22, 'frame'); }
    poly(b, f, 0.1, 0, corbelArcadeOutline({t0: 0, t1: len - 0.2, y0: 5.2, y1: 5.85, arches: Math.max(3, Math.round(len / 0.9)), corbel: 0.14, drop: 0.12, segments: 4}), 0.12, 'brick');
    for (let k = 0; k <= n; k++) slab(b, f, Math.min(len - 0.3, Math.max(0.3, k * p)), 0, 0.55, KH - 0.4, 0.14, 'brick');
    slab(b, f, len / 2, KH - 0.3, len + 0.2, 0.4, 0.18, 'stone');
    put(b, f, new T.BoxGeometry(len - 0.4, 1.0, 0.04).translate(0, 0.5, 0), len / 2, KH, -0.35, 'glass');
  }
  roof(KETEL, KH, 'concrete');
}

/* ------------------------------------------------------------------ build */
export function buildGraansiloKorthalsAltes(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  m = new Mesh();
  setSink(0.15, true);
  const nu = (f: Frame) => f.n[0] * AX[0] + f.n[1] * AX[1], nv = (f: Frame) => f.n[0] * CR[0] + f.n[1] * CR[1];
  // wings: long faces (10 bays), the 1.6 m steps where the end bays are set back on the west
  for (const [W, uEnd] of [[WS, -35.0], [WN, 53.7]] as [V2[], number][]) {
    for (let i = 0; i < 4; i++) {
      const {f, len} = ringFrame(W, i);
      if (len > 30) { bayFace(W, i, 10, EAVE, nv(f) > 0.99 ? {plinthSill: 1.25} : {}); continue; }
      // short edge at the outer end: only the 1.6 m strip west of the set-back end bay is exposed
      const mid = [(W[i][0] + W[(i + 1) % 4][0]) / 2, (W[i][1] + W[(i + 1) % 4][1]) / 2], um = mid[0] * AX[0] + mid[1] * AX[1];
      if (Math.abs(um - uEnd) > 0.5) continue;
      const vW = uEnd < 0 ? -10.7 : -10.6, vS = uEnd < 0 ? -9.05 : -8.95;
      const t1 = along(f, N(uEnd, vW)), t2 = along(f, N(uEnd, vS));
      void len;
      wall(W, i, 0, EAVE, 'brick', [], Math.min(t1, t2), Math.max(t1, t2));
    }
  }
  // end bays: west and east fronts (2 bays), the south and north end walls
  for (const [E, outU] of [[ES, -43.0], [EN, 61.1]] as [V2[], number][]) {
    for (let i = 0; i < 4; i++) {
      const {f, len} = ringFrame(E, i);
      if (Math.abs(nv(f)) > 0.99) bayFace(E, i, 2, END_TOP, nv(f) > 0.99 ? {plinthSill: 1.25} : {});
      else if (nu(f) * Math.sign(outU) > 0.99) {
        if (outU < 0) {
          // south end: four bays up to the stair annex (v 5.6), the annex covers the rest
          const t1 = along(f, N(outU, -9.05)), t2 = along(f, N(outU, 5.6));
          bayFace(E, i, 4, END_TOP, {ta: Math.min(t1, t2), tb: Math.max(t1, t2)});
          const t3 = along(f, N(outU, V_E));
          wall(E, i, 16.5, END_TOP, 'brick', [], Math.min(t2, t3), Math.max(t2, t3));
        } else {
          // north end: behind the white box and the low north buildings; plain brick with two rows of anchors
          wall(E, i, 0, END_TOP, 'brick');
        }
      } else wall(E, i, 17.5, END_TOP, 'brick');                           // wing side: above the wing roof
    }
    // end-bay roof: mansard (steep 20.9 -> 23.4, 1.2 m in), flat top
    const u0 = Math.min(...[-43.0, -35.0, 53.7, 61.1].filter(u => Math.abs(u - outU) < 9)), u1 = Math.max(...[-43.0, -35.0, 53.7, 61.1].filter(u => Math.abs(u - outU) < 9));
    const vW = outU < 0 ? -9.05 : -8.95;
    const R = (iu0: number, iu1: number, iv: number, y: number) => [[u0 + iu0, vW + iv], [u1 - iu1, vW + iv], [u1 - iu1, V_E - iv], [u0 + iu0, V_E - iv]].map(([u, v]) => native3(N(u, v), y));
    const inner0 = outU < 0 ? 1.2 : 0, inner1 = outU < 0 ? 0 : 1.2;
    const r0 = R(0, 0, 0, END_TOP), r1 = R(inner0, inner1, 1.2, 23.4);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; m.tri(r0[i], r0[j], r1[j], 'slate'); m.tri(r0[i], r1[j], r1[i], 'slate'); }
    m.tri(r1[0], r1[1], r1[2], 'concrete'); m.tri(r1[0], r1[2], r1[3], 'concrete');
    // the end bays' white bracketed eaves canopy (Commons foto 3, w01): a white board under the mansard on the west
    for (const s of [-1, 1]) {
      const v = s < 0 ? vW : V_E, a = N(u0, v), c = N(u1, v), L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const p = N((u0 + u1) / 2, v + s * 0.35);
      b.add(new T.BoxGeometry(L + 0.4, 0.22, 0.8).rotateY(-Math.atan2(c[1] - a[1], c[0] - a[0])).translate(p[0], END_TOP + 0.02, p[1]), 'white');
    }
  }
  wingRoof(-35.0, 3.7, -10.7, V_E, 10, [-29.2, -26.0, -13.5, -9.6], false, false);
  wingRoof(15.0, 53.7, -10.6, V_E, 10, [21.0, 24.6, 42.0, 45.5], false, false);
  tower();
  northComplex();
  // SE stair annex (3DBAG 16-18 m; no close photograph: plain brick with a slot window column, flat roof)
  for (let i = 0; i < ANNEX.length; i++) {
    const {f, len} = ringFrame(ANNEX, i);
    if (len < 1.2) { wall(ANNEX, i, 0, 16.5, 'brick'); continue; }
    if (nu(f) > 0.99 && len > 4) continue;                                // against the south end bays
    const cuts: Cut[] = len > 2.4 ? [3.5, 6.6, 9.7, 12.8].map(y => ({t0: len / 2 - 0.45, t1: len / 2 + 0.45, y0: y, y1: y + 1.6, depth: 0.2, back: 'glass' as C, reveal: 'brick' as C})) : [];
    wall(ANNEX, i, 0, 16.5, 'brick', cuts);
    slab(b, f, len / 2, 16.1, len + 0.2, 0.5, 0.2, 'stone');
  }
  roof(ANNEX, 16.5, 'concrete');
  // east terrace strip (v 10.0-11.9): glazed front of the winter gardens on the Westerdok side, up to the street datum + 1 m
  {
    for (let i = 0; i < 4; i++) {
      const {f, len} = ringFrame(TERR, i);
      if (nv(f) < -0.99) continue;
      if (len < 3) { wall(TERR, i, 0, 1.0, 'white'); continue; }
      wall(TERR, i, 0, 1.0, 'glass');
      for (let t = 0.1; t < len; t += 1.95) m.rect(f, t, Math.min(len, t + 0.1), 0, 1.0, 0.06, 'white');
    }
    roof(TERR, 1.0, 'frame');
  }
  // wing and tower plinth on the south end wall of the set-back step: nothing else
  m.flush();
  setSink(0);
}
