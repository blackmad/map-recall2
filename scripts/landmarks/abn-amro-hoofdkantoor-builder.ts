import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import type {Surface} from './worship-shell';
import {gridFacade, roofPrism, type GridOptions} from './roof-prism-kit';
import {faceWall, frameFromBearing, wallAwayFrom} from './modern-kit';
import type {Wall} from './worship-walls';
import {letters, poly, setSink, slab, type Frame} from './nearbar-kit';
import {openTopPrism, upwardRoofPlane} from './house-geometry';
import source from './abn-amro-hoofdkantoor-footprints.json';

/**
 * ABN AMRO hoofdkantoor, Gustav Mahlerlaan 10 (Pei Cobb Freed & Partners, 1999; BAG pand 0363100012146659, one pand
 * of 11,850 m2). Native east/south metres from the BAG vertex average, y above local ground (3DBAG b3_h_maaiveld).
 *
 * Massing from the 3DBAG LoD2.2 roof planes (scripts/landmarks/abn-amro-hoofdkantoor-footprints.json):
 *  - the main tower: a polished dark granite slab (x -62.8..-14.0, z -42.5..-26.8) to 107.5 m, with a curved glass
 *    volume on its north side and a straight glass volume on its south side, both to 96 m, so the granite slab stands
 *    above them as the crown (Commons photos ABN AMRO1-4, Headquarters Amsterdam);
 *  - the south-east tower: a granite L (A, B) to 70-72 m and a curved, pale banded volume (C) on its south-west, 69 m
 *    (panorama w12-90, Commons ABN AMRO5);
 *  - the low wings round the atrium (12-33 m): the 3DBAG shell, aluminium panels with ribbon windows over a granite
 *    plinth (panoramas w08-270, w28-271, w23-145); the entrance pavilion at the north-west in granite (w14-168, w27-267).
 * Signature items: the granite crown with its open frame at the east end, the shield logo and the ABN AMRO lettering on
 * the crown, the lettering on the entrance pavilion, the curved glass volumes.
 */
type Pt = [number, number];
const src = source as unknown as {surfaces: Surface[]; nativeRing: number[][]};
const topOf = (s: Surface) => Math.max(...s.rings[0].map(p => p[1]));
const midOf = (s: Surface): Pt => {
  const r = s.rings[0];
  return [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[2], 0) / r.length];
};

// ---- tower outlines (simplified from the 3DBAG roof unions; edges that meet another volume are tucked 0.4-0.5 m inside it) ----
const SLAB = {x0: -62.8, x1: -13.6, z0: -42.5, z1: -26.8, top: 107.5};
const smooth = (pts: Pt[], n: number): Pt[] => {
  const c = new T.CatmullRomCurve3(pts.map(([x, z]) => new T.Vector3(x, 0, z)), false, 'centripetal');
  return c.getPoints(n).map(v => [v.x, v.z] as Pt);
};
const NORTH_GLASS: Pt[] = [
  [-69.9, -56.4], [-68.0, -56.0], [-68.0, -51.2], [-60.4, -51.0], [-60.4, -42.0], [-30.5, -42.0],
  ...smooth([[-30.5, -42.6], [-38.1, -48.7], [-46.6, -53.3], [-55.9, -56.1], [-66.4, -57.0]], 14).slice(1),
];
const SOUTH_GLASS: Pt[] = [[-32.5, -27.3], [-14.5, -27.3], [-15.0, -24.1], [-16.0, -19.6], [-29.3, -20.0]];
const SE_A = {x0: 44.4, x1: 57.7, z0: 26.0, z1: 48.6, top: 72};
/** The thin granite fin the 3DBAG roof shows running west off tower A's south end (x 38.6..45.2, z 47.7..48.7). */
const SE_FIN = {x0: 38.6, x1: 44.6, z0: 47.7, z1: 48.55, top: 66};
const SE_B = {x0: 57.2, x1: 93.7, z0: 33.0, z1: 48.6, top: 70};
const SE_C: Pt[] = [...smooth([[63.4, 43.8], [69.2, 49.2], [76.0, 53.5], [83.5, 56.5], [91.4, 58.1]], 12), [91.4, 43.5], [62.5, 43.5]];
const TOWERS: Pt[][] = [
  [[SLAB.x0, SLAB.z0], [SLAB.x1, SLAB.z0], [SLAB.x1, SLAB.z1], [SLAB.x0, SLAB.z1]], NORTH_GLASS, SOUTH_GLASS,
  [[SE_A.x0, SE_A.z0], [SE_A.x1, SE_A.z0], [SE_A.x1, SE_A.z1], [SE_A.x0, SE_A.z1]],
  [[SE_B.x0, SE_B.z0], [SE_B.x1, SE_B.z0], [SE_B.x1, SE_B.z1], [SE_B.x0, SE_B.z1]], SE_C,
];

function inPoly(x: number, z: number, r: number[][]) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = [r[i][0], r[i].length > 2 ? r[i][2] : r[i][1]], [xj, zj] = [r[j][0], r[j].length > 2 ? r[j][2] : r[j][1]];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}
const roofs = src.surfaces.filter(s => s.type === 'RoofSurface').map(s => ({ring: s.rings[0], h: s.rings[0].reduce((a, p) => a + p[1], 0) / s.rings[0].length}));
/** Is the point (x, y, z) inside the building: under a 3DBAG roof that is higher, or inside a tower outline? */
/** Height of the building at (x, z): the highest 3DBAG roof over it, Infinity inside a tower, 0 in the open. */
const heightAt = (x: number, z: number) => TOWERS.some(t => inPoly(x, z, t)) ? Infinity : roofs.reduce((h, r) => inPoly(x, z, r.ring) ? Math.max(h, r.h) : h, 0);
const solidAt = (x: number, y: number, z: number) => TOWERS.some(t => inPoly(x, z, t)) || roofs.some(r => r.h > y && inPoly(x, z, r.ring));

const shape = (pts: Pt[]) => new T.Shape(pts.map(([x, z]) => new T.Vector2(x, z)));
const area = (pts: Pt[]) => pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
/** Mitred outward offset of a simple polygon. */
function offset(pts: Pt[], d: number): Pt[] {
  const s = area(pts) > 0 ? 1 : -1, n = pts.length;
  const nrm = (a: Pt, q: Pt): Pt => { const dx = q[0] - a[0], dz = q[1] - a[1], l = Math.hypot(dx, dz); return [s * dz / l, -s * dx / l]; };
  return pts.map((p, i) => {
    const a = nrm(pts[(i - 1 + n) % n], p), c = nrm(p, pts[(i + 1) % n]);
    const k = d / Math.max(0.35, 1 + a[0] * c[0] + a[1] * c[1]);
    return [p[0] + (a[0] + c[0]) * k, p[1] + (a[1] + c[1]) * k] as Pt;
  });
}
/** A closed band round a volume: outer face `out` m proud, inner face hidden 0.3 m inside, from y to y + h. */
function band(b: BuildingTools, pts: Pt[], y: number, h: number, out: number, colour: string) {
  const s = shape(offset(pts, out));
  s.holes.push(new T.Path(offset(pts, -0.3).map(([x, z]) => new T.Vector2(x, z))));
  const g = new T.ExtrudeGeometry(s, {depth: h, bevelEnabled: false});
  g.rotateX(Math.PI / 2); g.translate(0, y + h, 0);
  b.add(g, colour as never);
}
/** A tower volume: open-top prism plus its own upward roof. */
function volume(b: BuildingTools, pts: Pt[], top: number, wall: string, roof: string) {
  b.add(openTopPrism(shape(pts), 0, top), wall as never);
  b.add(upwardRoofPlane(shape(pts), top), roof as never);
}
const box = (b: BuildingTools, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, c: string) =>
  b.add(new T.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), c as never, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
/** The ABN AMRO shield: a square split on the diagonal, green over yellow. */
function shield(b: BuildingTools, f: Frame, t: number, y: number, s: number, out: number, upper = 'green', lower = 'gold') {
  poly(b, f, t - s / 2, y, [[0, s], [s, s], [0, 0]], 0.08, upper, out);
  poly(b, f, t - s / 2, y, [[s, s], [s, s * 0.15], [s * 0.5, -s * 0.2], [0, 0]], 0.08, lower, out + 0.06);
}

export function buildAbnAmroHoofdkantoor(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  // ---- low wings: the 3DBAG shell below 40 m; granite for the entrance pavilion (x < -66), aluminium elsewhere ----
  const pavilion = (s: Surface) => midOf(s)[0] < -66;
  // One closed prism per 3DBAG roof plane under 40 m (walls from the ground to the roof edge, the roof plane itself, a
  // floor): the single-part 3DBAG shell cannot lose its tower walls without leaving open edges round every tower.
  for (const s of src.surfaces) if (s.type === 'RoofSurface' && topOf(s) < 40) roofPrism(b, s.rings, pavilion(s) ? 'dark' : 'concrete', 'slate');

  // ---- main tower ----
  const S = SLAB, open = {x0: -21.8, x1: -17.2, y0: 94, y1: 104};
  box(b, S.x0, S.x1, S.z0, S.z1, 0, open.y0, 'dark');
  box(b, S.x0, open.x0, S.z0, S.z1, open.y0 - 0.1, S.top, 'dark');
  box(b, open.x1, S.x1, S.z0, S.z1, open.y0 - 0.1, S.top, 'dark');
  box(b, open.x0 - 0.1, open.x1 + 0.1, S.z0, S.z1, open.y1, S.top - 0.05, 'dark');
  volume(b, offset(NORTH_GLASS, 0.3), 96, 'canopyGlass', 'slate');
  volume(b, offset(SOUTH_GLASS, 0.3), 96, 'canopyGlass', 'slate');
  // ---- south-east tower ----
  box(b, SE_A.x0, SE_A.x1, SE_A.z0, SE_A.z1, 0, SE_A.top, 'dark');
  box(b, SE_B.x0, SE_B.x1, SE_B.z0, SE_B.z1, 0, SE_B.top, 'dark');
  box(b, SE_FIN.x0, SE_FIN.x1, SE_FIN.z0, SE_FIN.z1, 0, SE_FIN.top, 'dark');
  volume(b, SE_C, 69, 'glass', 'slate');
  b.mark?.('shell');

  // ---- granite punched facades: square windows on 2.0 m axes, 3.9 m floors over a 6 m ground storey ----
  setSink(0.9);
  const granite: GridOptions = {y0: 6, pitch: 3.9, colPitch: 2.0, pierW: 0.5, pierD: 0.14, winBottom: 0.95, winH: 2.0, pier: 'dark', glass: 'glass', ground: 'dark', margin: 1.0};
  const faces: [Pt, number, number, number, number][] = [
    // main slab: north (the part beside the curved glass), south (west of the glass volume), east and west ends
    [[S.x1, S.z0], 0, 16.4, 33, 92.5],
    [[S.x0, S.z1], 180, 30.2, 0, 92.5],
    [[S.x0, S.z0], 270, S.z1 - S.z0, 0, 92.5],
    // south-east tower A and B
    [[SE_A.x0, SE_A.z0], 270, SE_A.z1 - SE_A.z0, 28, SE_A.top - 2],
    [[SE_A.x1, SE_A.z0], 0, SE_A.x1 - SE_A.x0, 26, SE_A.top - 2],
    [[SE_A.x0, SE_A.z1], 180, 10.6, 0, SE_A.top - 2],
    [[SE_B.x1, SE_B.z0], 0, SE_B.x1 - SE_B.x0 - 0.6, 0, SE_B.top - 2],
    [[SE_B.x1, SE_B.z1], 90, SE_B.z1 - SE_B.z0, 0, SE_B.top - 2],
  ];
  setSink(0.05);
  for (const [o, bearing, len, y0, y1] of faces) gridFacade(b, faceWall(o, bearing, len, y0, y1), granite);
  // East end (Commons ABN AMRO3): a blank granite strip on the south third, three wide window axes on the rest.
  gridFacade(b, faceWall([S.x1, S.z1 - 5.6], 90, S.z1 - S.z0 - 5.6, 31, 92.5), {...granite, colPitch: 3.25, pierW: 0.95, margin: 0.4});

  // ---- glass volumes: silver spandrel band per floor; the SE curve is pale stone with ribbon windows ----
  for (let y = 6 + 2.9; y < 95; y += 3.9) {
    band(b, NORTH_GLASS, y, 0.9, 0.42, 'concrete');
    band(b, SOUTH_GLASS, y, 0.9, 0.42, 'concrete');
  }
  for (let y = 6; y < 68; y += 3.9) band(b, SE_C, y, 1.6, 0.14, 'stone');
  band(b, SE_C, 0, 6, 0.14, 'stone');

  // ---- crown: the open frame, the glazed top of the east end, the shield and the lettering ----
  const east = frameFromBearing([S.x1, S.z1], 90);
  slab(b, east, 10.65, 92.8, 9.7, 9.4, 0.1, 'canopyGlass');
  shield(b, east, 14.0, 103.6, 2.8, 0);
  const north = frameFromBearing([S.x1, S.z0], 0);
  letters(b, north, 'ABN AMRO', 19.4, 99.3, 0, 0.42, 0.12, 'white');
  shield(b, north, 31.6, 99.6, 3.2, 0);

  // ---- low wings: aluminium with ribbon windows over a granite ground storey; granite pavilion with punched windows ----
  setSink(0.12);
  const ribbon: GridOptions = {y0: 4.5, pitch: 3.6, colPitch: 1.8, pierW: 0.1, pierD: 0.12, winBottom: 1.0, winH: 1.9, pier: 'frame', glass: 'glass', ground: 'dark', margin: 0.5};
  // Entrance pavilion: blank polished granite (w14-168, w27-267) except the glazed box on its north side (w13-8).
  const pav: GridOptions = {y0: 0.3, pitch: 3.6, colPitch: 1.8, pierW: 0.12, pierD: 0.12, winBottom: 0.1, winH: 3.3, pier: 'frame', glass: 'canopyGlass', margin: 0.3};
  const cands: {w: Wall; pav: boolean}[] = [], pavWalls: {w: Wall; m: Pt}[] = [];
  src.surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface' || topOf(s) > 40) return;
    const r = s.rings[0], lo = Math.min(...r.map(p => p[1])), hi = topOf(s);
    if (hi - lo < 5) return;
    const [mx, mz] = midOf(s), ym = (lo + hi) / 2;
    const w0 = wallAwayFrom(s, i, [mx, mz + 1e-3]);
    if (!w0 || w0.length < 6) return;
    // The outward side is the lower one; a wall rising above a lower neighbour is dressed only above that roof.
    const hA = heightAt(mx + w0.n[0] * 1.2, mz + w0.n[1] * 1.2), hB = heightAt(mx - w0.n[0] * 1.2, mz - w0.n[1] * 1.2);
    const hOut = Math.min(hA, hB);
    if (Math.abs(hA - hB) < 1 || hOut > hi - 4) return;
    const inside: Pt = hA < hB ? [mx - w0.n[0] * 5, mz - w0.n[1] * 5] : [mx + w0.n[0] * 5, mz + w0.n[1] * 5];
    const w1 = wallAwayFrom(s, i, inside);
    if (!w1) return;
    const w = hOut > 0.5 ? {...w1, base: Math.max(w1.base, hOut + 0.3)} : w1;
    void ym;
    if (pavilion(s)) pavWalls.push({w, m: [mx, mz]});
    if (!pavilion(s) || w.n[1] < -0.7) cands.push({w, pav: pavilion(s)});
  });
  // 3DBAG often splits one facade into near-parallel pieces a few cm apart: dress only the front-most piece of such a stack.
  const proj = (w: Wall, p: Pt) => (p[0] - w.origin[0]) * w.tangent[0] + (p[1] - w.origin[1]) * w.tangent[1];
  for (const c of cands) {
    const d0 = c.w.origin[0] * c.w.n[0] + c.w.origin[1] * c.w.n[1];
    const behind = cands.some(o => {
      if (o === c || o.w.n[0] * c.w.n[0] + o.w.n[1] * c.w.n[1] < 0.98) return false;
      const dd = o.w.origin[0] * c.w.n[0] + o.w.origin[1] * c.w.n[1] - d0;
      if (dd < -0.02 || dd > 0.9 || (dd <= 0.02 && o.w.length <= c.w.length)) return false;
      const a = proj(c.w, o.w.origin), e = a + o.w.length * (o.w.tangent[0] * c.w.tangent[0] + o.w.tangent[1] * c.w.tangent[1]);
      return Math.min(c.w.length, Math.max(a, e)) - Math.max(0, Math.min(a, e)) > 0.5;
    });
    if (!behind) gridFacade(b, c.w, c.pav ? pav : ribbon);
  }

  // ---- entrance pavilion lettering (w14-168) and the west canopy at the foot of the tower (w09-270) ----
  const pw = pavWalls.filter(q => q.w.length > 6 && Math.hypot(q.m[0] + 74.6, q.m[1] + 49.9) < 6 && q.w.n[1] > 0.8)[0];
  if (pw?.w) {
    const top = Math.max(...pw.w.poly.map(p => p[1]));
    letters(b, pw.w, 'ABN AMRO', pw.w.length / 2 + 1.0, top - 2.2, 0, 0.13, 0.06, 'white');
    shield(b, pw.w, pw.w.length / 2 - 2.9, top - 2.1, 1.0, 0, 'white', 'white');
  }
  const west = frameFromBearing([S.x0, S.z0], 270);
  slab(b, west, 7.85, 6.0, 11, 0.5, 4.5, 'frame');
  for (const t of [3.0, 12.7]) b.add(new T.CylinderGeometry(0.18, 0.18, 6, 10), 'frame' as never, S.x0 - 4.2, 3, S.z0 + t);
  setSink(0);
}
