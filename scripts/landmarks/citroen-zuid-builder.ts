import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {setSink, slab, letters, wallProbe, ringFrame, type Frame} from './nearbar-kit';
import {quad, addShellTess, beginFacade} from './big-facade';
import {planarPolygon} from './worship-shell';
import source from './citroen-zuid-footprints.json';

/**
 * The 1931 Citroën garage on the Stadionplein (Jan Wils; BAG pand 0363100012080490, bouwjaar 1931), today the MOVE
 * mobility building. Massing is the 3DBAG LoD2.2 shell (CC BY 4.0) of that pand in the native frame of
 * scripts/landmarks/citroen-zuid-footprints.json (x east, z south, y up from the 0.8 m NAP ground; written by
 * citroen-zuid-prepare.ts). Facade details are measured on rectified Gemeente Amsterdam panorama crops (CC BY 4.0, 50 px/m;
 * wall ends from staging/citroen-zuid/walls25/.../walls.json, RD), listed per wall in scripts/landmarks/citroen-zuid-inventory.json:
 *  - east front (w05-78 + w03-78, one straight 44.4 m plane, TMX7316010203-002475_pano_0000_000039 and -002120_pano_0000_004476):
 *    white brick; a first floor of six large steel windows 4.3 m wide on a 4.95 m pitch (sill 4.8 m, head 7.6 m) under a thin
 *    cantilevered roof slab (8.2-8.6 m); four ground-floor shop windows between dark tile piers; north of them a blank wall and a
 *    glazed shopfront behind three dark tile columns; at the south end the stair block with two square windows, a low ribbon,
 *    the chimney and corner balconies with tubular railings;
 *  - the steel ring sculpture on the 12 m roof about 5 m behind the east front's south end (both east views, 3.8 m across);
 *  - north front (w04-348, TMX7316010203-002460_pano_0003_000188): MOVE lettering, two storeys of six steel windows, glazed plinth;
 *    at its west end the rounded glazed stair tower (w11-348, b_20241105_0934_Track14_Sphere_00029) with a glass-block strip beside it;
 *  - south (w06-168 curved white brick, recording_2025-07-30_06-07-02_01768): two storeys of three windows and a small one, the dark
 *    louvre band; the 2010s extension (w02-168, _01769): a first-floor ribbon of four windows, a double door, the terrace rail;
 *  - west front (w01-258, b_20241105_0934_Track07_Sphere_00072, rebuilt 2017-2018): two glazed storeys between dark bands over a
 *    glazed ground floor, a white end block with punched windows;
 *  - north-east corner (w07-78/w08-78): the two-storey rounded glass shopfront under a curved canopy, the high ribbon window, the
 *    vertical MOVE sign.
 * The tall chimney of the west block is the 3DBAG roof part at 21 m (x -36..-34, z -5..-1).
 */
type Src = {anchorRD: number[]; surfaces: {type: string; rings: number[][][]}[]; nativeRing: number[][]; facadeRing: number[][]};
const src = source as unknown as Src;
const [AX, AY] = src.anchorRD;
const nat = (p: number[]): [number, number] => [p[0] - AX, -(p[1] - AY)];
/** Wall frame from RD end points a (viewer's left) to b: tangent a->b, n outward (viewer's right is +t). */
function rdFrame(a: number[], b: number[]): {f: Frame; len: number} {
  const p = nat(a), q = nat(b), len = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const tx = (q[0] - p[0]) / len, tz = (q[1] - p[1]) / len;
  return {f: {origin: p, tangent: [tx, tz], n: [-tz, tx]}, len};
}
// Wall ends (RD) from walls.json; the east front joins w05 (south) and w03 (north), which are one plane.
const EAST = rdFrame([118863.72, 484024.04], [118854.43, 484067.5]);
const NORTH = rdFrame([118842.56, 484084.83], [118818.27, 484079.67]);
const SOUTH_CURVE = rdFrame([118847.75, 484020.71], [118863.72, 484024.04]);
const SOUTH_EXT = rdFrame([118815.95, 484015.26], [118847.49, 484021.93]);
const WEST = rdFrame([118801.63, 484068.89], [118813.22, 484014.73]);
const NE_W08 = rdFrame([118847.93, 484072.78], [118846.54, 484079.13]);
const NW_TOWER = rdFrame([118815.33, 484079.03], [118811.24, 484078.17]);

type Probe = ReturnType<typeof wallProbe>;
let probe: Probe;
/** The frame shifted onto the shell wall: median probe offset over the given (t, y) samples. */
function onWall(f: Frame, samples: [number, number][]): Frame {
  const offs = samples.map(([t, y]) => probe.offset(f, t, y)).filter((o): o is number => o !== null).sort((a, c) => a - c);
  const off = offs.length ? offs[Math.floor(offs.length / 2)] : 0;
  return {...f, origin: [f.origin[0] + f.n[0] * off, f.origin[1] + f.n[1] * off]};
}
/** A local frame on a curved shell wall at (t, y): origin at the hit point, turned to the hit normal; place at t = 0. */
function localAt(f: Frame, t: number, y: number): Frame | null {
  const h = probe.hit(f, t, y);
  if (!h) return null;
  const l = Math.hypot(h.normal[0], h.normal[2]), n: [number, number] = [h.normal[0] / l, h.normal[2] / l];
  const px = f.origin[0] + f.tangent[0] * t + f.n[0] * h.offset, pz = f.origin[1] + f.tangent[1] * t + f.n[1] * h.offset;
  return {origin: [px, pz], tangent: [n[1], -n[0]], n};
}

/** Steel-framed window: dark frame sheet, glass, vertical glazing bars about every `bar` m and transoms at the given fractions. */
function steel(b: BuildingTools, f: Frame, t0: number, t1: number, y0: number, y1: number, bar = 0.5, transoms: number[] = [0.3, 0.72], tol = 0.08, lift = 0): boolean {
  const w = t1 - t0, h = y1 - y0, c = (t0 + t1) / 2;
  // only where the shell wall really is under the whole window (3DBAG facets step and recess): every corner within tol of the
  // median wall offset, and the window is moved onto that offset
  const offs = [[t0 + 0.1, y0 + 0.1], [t1 - 0.1, y0 + 0.1], [t0 + 0.1, y1 - 0.1], [t1 - 0.1, y1 - 0.1], [c, (y0 + y1) / 2]].map(([t, y]) => probe.offset(f, t, y));
  const known = offs.filter((o): o is number => o !== null).sort((p, q) => p - q), med = known[known.length >> 1] ?? 0;
  if (known.length < offs.length || known.some(o => Math.abs(o - med) > tol)) {
    if (process.env.LANDMARK_DEBUG) console.warn('steel skipped', f.n.map(v => v.toFixed(2)).join(','), t0.toFixed(2), t1.toFixed(2), y0, y1, 'offsets', offs.map(o => o?.toFixed(2)).join(' '));
    return false;
  }
  if (Math.abs(med) > 0.01) f = {...f, origin: [f.origin[0] + f.n[0] * med, f.origin[1] + f.n[1] * med]};
  // `lift` moves the whole stack out where the shell wall has a second facet a few cm behind the first
  const g = lift ? 0.09 + lift : 0.04, m = lift ? 0.135 + lift : 0.06;
  slab(b, f, c, y0 - 0.07, w + 0.14, h + 0.14, 0.045 + lift, 'frame');
  quad(b, f, c, y0, w, h, 'glass', g);
  const n = Math.max(1, Math.round(w / bar));
  for (let k = 1; k < n; k++) quad(b, f, t0 + k * w / n, y0, 0.05, h, 'frame', m);
  for (const r of transoms) quad(b, f, c, y0 + r * h - 0.025, w, 0.05, 'frame', m);
  return true;
}
/** Tubular railing: three rails and posts every ~1.3 m, `len` along t, standing on y, `out` from the wall. */
function railing(b: BuildingTools, f: Frame, t0: number, t1: number, y: number, out: number) {
  const L = t1 - t0, c = (t0 + t1) / 2;
  for (const dy of [0.35, 0.7, 1.05]) slab(b, f, c, y + dy, L, 0.05, 0.05, 'bronze', out);
  const n = Math.max(1, Math.round(L / 1.3));
  for (let k = 0; k <= n; k++) slab(b, f, t0 + k * L / n, y, 0.05, 1.1, 0.05, 'bronze', out);
}

function eastFront(b: BuildingTools) {
  const f = onWall(EAST.f, [[10, 2], [10, 6], [25, 6], [40, 6], [3, 6]]);
  const L = EAST.len; // 44.4 m; t from the south end
  // first floor: six steel windows on a 4.95 m pitch (w05 crop px 333/578/822, w03 crop px 0/240/485/730), sill 4.8, head 7.6
  for (let k = 0; k < 6; k++) { const t0 = 6.66 + k * 4.95; steel(b, f, t0, t0 + 4.3, 4.8, 7.6, 0.48); }
  // ground floor: four shop windows (0.5-3.1 m) with dark tile piers between, then blank wall, then the colonnade shopfront
  for (let k = 0; k < 4; k++) {
    const t0 = 6.66 + k * 4.95;
    steel(b, f, t0, t0 + 4.3, 0.5, 3.1, 0.48, [0.75]);
    slab(b, f, t0 + 4.625, 0, 0.46, 3.15, 0.08, 'dark');
  }
  for (const [t0, t1] of [[29.0, 36.6], [36.7, L - 0.6]] as [number, number][]) steel(b, f, t0, t1, 0.3, 3.05, 2.4, [0.82]);
  for (const t of [31.2, 36.0, 40.7]) { slab(b, f, t, 0, 0.5, 3.45, 0.6, 'dark'); slab(b, f, t, 2.95, 0.54, 0.06, 0.64, 'gold'); }
  // thin cantilevered roof slab over the first floor (8.2-8.6 m) and the terrace rail behind its edge
  slab(b, f, (6.4 + 36.2) / 2, 8.2, 36.2 - 6.4, 0.4, 0.7, 'stone');
  railing(b, f, 6.6, 36.0, 8.6, -0.25);
  // stair block (t 1.3-6.6): two square windows with a dark tile panel beside them, a low ribbon window with a dark pier
  for (const [y0, y1] of [[4.5, 6.1], [7.8, 9.4]]) { steel(b, f, 3.14, 4.54, y0, y1, 0.7, [0.5]); slab(b, f, 4.85, y0 + 0.55, 0.4, 0.42, 0.07, 'dark'); }
  steel(b, f, 1.5, 5.8, 2.1, 3.06, 0.55, []);
  slab(b, f, 6.23, 2.1, 0.62, 0.96, 0.07, 'dark');
  // corner balconies (slabs at 4.3 and 7.9 m) wrapping the south-east corner, railings on both faces
  const s = onWall(SOUTH_CURVE.f, [[15, 6], [12, 6]]);
  for (const y of [4.3, 7.9]) {
    slab(b, f, 1.3, y, 2.6, 0.15, 1.4, 'concrete'); railing(b, f, 0.05, 2.6, y + 0.15, 1.35);
    slab(b, s, SOUTH_CURVE.len - 1.3, y, 2.6, 0.15, 1.4, 'concrete'); railing(b, s, SOUTH_CURVE.len - 2.6, SOUTH_CURVE.len - 0.05, y + 0.15, 1.35);
  }
}

/** The ring sculpture: 12 hollow rectangular cells between an outer and an inner rim, standing upright on the 12 m roof. */
function roofRing(b: BuildingTools) {
  const [cx, cz] = [11.5, 29.0], base = 12.3, Ro = 1.9, Ri = 1.3, D = 0.9, N = 12, bar = 0.09;
  const facing = 108 * Math.PI / 180; // ring normal toward bearing 108 (both east views show it about 30 degrees off square-on)
  const nrm = new T.Vector3(Math.sin(facing), 0, -Math.cos(facing)), side = new T.Vector3(Math.cos(facing), 0, Math.sin(facing));
  const centre = new T.Vector3(cx, base + Ro + 0.15, cz);
  const at = (a: number, r: number, d: number) => centre.clone().addScaledVector(side, r * Math.cos(a)).add(new T.Vector3(0, r * Math.sin(a), 0)).addScaledVector(nrm, d);
  const strut = (p: T.Vector3, q: T.Vector3) => {
    const delta = q.clone().sub(p), g = new T.BoxGeometry(bar, delta.length() + bar, bar);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), delta.clone().normalize()));
    const m = p.clone().add(q).multiplyScalar(0.5); g.translate(m.x, m.y, m.z); b.add(g, 'bronze');
  };
  for (let k = 0; k < N; k++) {
    const a0 = (k / N) * Math.PI * 2 + Math.PI / 2, a1 = ((k + 1) / N) * Math.PI * 2 + Math.PI / 2;
    for (const d of [-D / 2, D / 2]) { strut(at(a0, Ro, d), at(a1, Ro, d)); strut(at(a0, Ri, d), at(a1, Ri, d)); strut(at(a0, Ri, d), at(a0, Ro, d)); }
    strut(at(a0, Ro, -D / 2), at(a0, Ro, D / 2)); strut(at(a0, Ri, -D / 2), at(a0, Ri, D / 2));
  }
  // two feet down to the roof
  for (const s of [-1, 1]) { const p = at(-Math.PI / 2 + s * 0.5, Ro, 0); b.add(new T.BoxGeometry(0.2, p.y - base + 0.05, 0.6).translate(p.x, (p.y + base) / 2, p.z), 'bronze'); }
}

function northFront(b: BuildingTools) {
  const f = onWall(NORTH.f, [[6, 4], [12, 8], [18, 12], [22, 6]]);
  // two storeys of six steel windows (w04 crop px 95-197 small, five 3.45 m windows), dark spandrel panels at both ends
  const cols: [number, number][] = [[1.9, 3.94], [4.84, 8.34], [8.8, 12.24], [12.74, 16.2], [16.7, 20.14], [20.64, 24.1]];
  for (const [y0, y1] of [[5.8, 7.7], [9.1, 11.0]]) {
    for (const [t0, t1] of cols) steel(b, f, t0, t1, y0, y1, 0.5, [0.5]);
    slab(b, f, 4.39, y0, 0.74, y1 - y0, 0.07, 'dark'); slab(b, f, 24.5, y0, 0.6, y1 - y0, 0.07, 'dark');
  }
  // glazed plinth with dark end panel and the entrance canopy
  steel(b, f, 0.9, 1.9, 0.65, 3.55, 0.8, [0.8]);
  for (const [t0, t1] of [[2.2, 12.2], [12.3, 22.3]] as [number, number][]) steel(b, f, t0, t1, 0.65, 3.55, 2.0, [0.8]);
  slab(b, f, 23.4, 0.3, 1.9, 3.25, 0.07, 'dark');
  slab(b, f, 12.1, 3.7, 5.3, 0.15, 1.2, 'stone');
  // MOVE (w04 crop px 237-520, py 95-165: 12.35-13.75 m)
  letters(b, f, 'MOVE', 7.57, 12.35, 0, 0.25, 0.08, 'bronze', 0.2);
}

/** Rounded glazed stair tower on w11 (the north front's west end) and the glass-block strip on the wall beside it. */
function northWestTower(b: BuildingTools) {
  const {f, len} = NW_TOWER, c = len / 2, R = 2.05;
  const p = [f.origin[0] + f.tangent[0] * c, f.origin[1] + f.tangent[1] * c];
  const off = probe.offset(f, c, 8) ?? 0, cx = p[0] + f.n[0] * off, cz = p[1] + f.n[1] * off;
  const rot = Math.atan2(f.n[0], f.n[1]);
  const drum = (r: number, y0: number, y1: number, colour: string) => {
    const g = new T.CylinderGeometry(r, r, y1 - y0, 12, 1, true, -Math.PI / 2, Math.PI);
    g.rotateY(rot); g.translate(cx, (y0 + y1) / 2, cz); b.add(g, colour as never);
  };
  for (let y = 3.7; y < 15.9; y += 3.3) drum(R, y, Math.min(16.0, y + 3.3), 'glass');
  for (const y of [7.0, 10.3, 13.6]) drum(R + 0.06, y - 0.12, y + 0.12, 'stone');
  const cap = new T.CylinderGeometry(R + 0.2, R + 0.2, 0.6, 12, 1, false, -Math.PI / 2, Math.PI); cap.rotateY(rot); cap.translate(cx, 16.3, cz); b.add(cap, 'stone');
  const base = new T.CylinderGeometry(R + 0.6, R + 0.6, 0.2, 12, 1, false, -Math.PI / 2, Math.PI); base.rotateY(rot); base.translate(cx, 3.6, cz); b.add(base, 'stone');
  // glass-block strip on the 3 m wall between the tower and the north front (w11 thumb, 0.6 x 4.5 m)
  const g = rdFrame([118818.27, 484079.67], [118815.33, 484079.03]);
  const gf = onWall(g.f, [[1.5, 6], [1.5, 10]]);
  slab(b, gf, 1.2, 6.4, 0.7, 4.6, 0.045, 'frame'); quad(b, gf, 1.2, 6.5, 0.6, 4.4, 'glass', 0.04);
  for (let k = 1; k < 10; k++) quad(b, gf, 1.2, 6.5 + k * 0.44 - 0.02, 0.6, 0.04, 'frame', 0.06);
}

function southFronts(b: BuildingTools) {
  // curved white brick wall: windows placed in local frames on the shell (w06 crop px; pavement py 790)
  const C = SOUTH_CURVE;
  const at = (t: number, y: number) => localAt(C.f, t, y);
  for (const [y0, y1] of [[4.6, 6.3], [8.04, 9.7]]) {
    for (const [t0, t1] of [[3.34, 5.4], [6.0, 9.5], [10.1, 13.6]] as [number, number][]) {
      const lf = at((t0 + t1) / 2, (y0 + y1) / 2); if (!lf) continue;
      steel(b, lf, -(t1 - t0) / 2, (t1 - t0) / 2, y0, y1, 0.5, [0.5]);
    }
    const lf = at(2.6, (y0 + y1) / 2);
    if (lf) { steel(b, lf, -0.6, -0.1, y0 + 0.5, y1 - 0.4, 0.5, []); slab(b, lf, 0.36, y0 + 0.5, 0.76, y1 - y0 - 0.9, 0.07, 'dark'); }
  }
  // dark louvre band 2.08-3.1 m: three louvre panels with dark piers
  for (const [t0, t1] of [[1.4, 5.7], [5.7, 9.85], [9.85, 13.64]] as [number, number][]) {
    const lf = at((t0 + t1) / 2, 2.6); if (!lf) continue;
    slab(b, lf, 0, 2.08, t1 - t0, 1.02, 0.045, 'dark');
    for (let y = 2.2; y < 3.05; y += 0.12) quad(b, lf, 0, y, t1 - t0 - 0.5, 0.04, 'frame', 0.04);
  }
  // chimney on the stair block (w06 crop px 560-680, top 13.0 m) over the 11 m roof
  { const lf = at(12.4, 9); if (lf) slab(b, lf, 0, 10.9, 2.4, 2.1, 1.6, 'stone', -1.9); if (lf) slab(b, lf, 0, 12.6, 2.6, 0.18, 1.8, 'bronze', -2.0); }
  // 2010s extension: first-floor ribbon of four windows (4.8-6.9 m), double door, glass-block strip at the east end, terrace rail
  const E = onWall(SOUTH_EXT.f, [[12, 5], [20, 5], [26, 3]]);
  for (const [t0, t1] of [[9.9, 14.1], [14.8, 19.1], [19.8, 24.2], [24.8, 27.15], [27.25, 28.3]] as [number, number][]) steel(b, E, t0, t1, 4.8, 6.9, 1.4, [], 0.08, 0.04);
  slab(b, E, 17.0, 0.05, 2.6, 2.95, 0.045, 'dark');
  slab(b, E, 31.05, 2.7, 1.6, 7.3, 0.045, 'frame'); quad(b, E, 31.05, 2.8, 1.5, 7.1, 'glass', 0.04);
  for (let k = 1; k < 16; k++) quad(b, E, 31.05, 2.8 + k * 0.444 - 0.02, 1.5, 0.04, 'frame', 0.06);
  railing(b, E, 6.5, 28.6, 8.95, -0.3);
}

function westFront(b: BuildingTools) {
  const f = onWall(WEST.f, [[20, 6], [30, 6], [45, 6], [20, 10]]);
  // curtain wall (t 9.9-53.6, 2024 crop at 45 px/m): two glazed storeys (4.5-7.6, 8.4-11.5) between dark bands, glazed ground floor
  // the 3DBAG west wall steps 0.23 m back at t 40.5 (probe profile); every run snaps to its own facet
  const runs: [number, number][] = [[9.9, 18.6], [18.7, 27.4], [27.5, 36.2], [36.3, 39.7], [41.4, 44.0], [45.0, 48.3]];
  for (const [t0, t1] of runs) {
    const f = onWall(WEST.f, [[t0 + 0.5, 6], [(t0 + t1) / 2, 6], [t1 - 0.5, 6]]);
    if (!steel(b, f, t0, t1, 4.5, 7.6, 1.6, [])) continue;
    steel(b, f, t0, t1, 8.4, 11.5, 1.6, []);
    steel(b, f, t0, t1, 0.2, 3.0, 2.4, []);
    for (const [y0, y1] of [[3.7, 4.41], [7.69, 8.31], [11.59, 12.05]]) slab(b, f, (t0 + t1) / 2, y0, t1 - t0 + 0.1, y1 - y0, 0.07, 'dark');
  }
  // white end block (t 0-9.7): punched windows
  for (const [y0, y1] of [[5.0, 6.5], [8.85, 10.4]]) steel(b, f, 2.8, 6.4, y0, y1, 0.9, []);
  steel(b, f, 1.0, 4.2, 0.3, 3.1, 1.0, []);
}

function northEastCorner(b: BuildingTools) {
  // two-storey rounded glass shopfront on the facets of the corner (facade ring (8.9,2.4) .. (4.9,-3.4)), canopy at 6.3 m
  const R = src.facadeRing, k0 = R.findIndex(p => Math.abs(p[0] - 8.9) < 0.3 && Math.abs(p[1] - 2.4) < 0.3);
  for (let i = k0; i >= 0 && i < k0 + 6; i++) {
    const r = ringFrame(R, i), L = r.len; if (L < 1.2) continue;
    let f = r.f;
    const off = probe.offset(f, L / 2, 3) ?? 0; f = {...f, origin: [f.origin[0] + f.n[0] * off, f.origin[1] + f.n[1] * off]};
    const n = Math.max(1, Math.round((L - 0.3) / 1.6)), u = (L - 0.3) / n;
    for (let k = 0; k < n; k++) steel(b, f, 0.15 + k * u + 0.05, 0.15 + (k + 1) * u - 0.05, 0.3, 5.9, 2.0, [0.5]);
    slab(b, f, L / 2, 6.1, L, 0.2, 1.0, 'stone');
  }
  // high ribbon window and the stacked MOVE sign on the curved wall (w08)
  const f = onWall(NE_W08.f, [[3, 9], [3, 5]]);
  steel(b, f, 0.3, 6.2, 9.0, 10.4, 0.45, []);
  steel(b, f, 2.0, 4.6, 5.0, 6.2, 0.5, []);
  const m = {...f, n: f.n} as Frame;
  slab(b, m, 5.6, 5.5, 0.18, 9.6, 0.5, 'stone');
  const word = ['M', 'O', 'V', 'E'];
  word.forEach((ch, i) => letters(b, m, ch, 5.6, 13.4 - i * 1.9, 0.5, 0.22, 0.06, 'stone', 0.22));
}

export function buildCitroenZuid(_w: number, _d: number, b: BuildingTools) {
  addShellTess(b, src as never, {wall: 'stone', roof: 'slate'});
  beginFacade(src as never);
  setSink(0.3);
  probe = wallProbe(src.surfaces.filter(s => s.type === 'WallSurface').map(s => planarPolygon(s.rings)).filter((g): g is T.BufferGeometry => !!g));
  eastFront(b);
  roofRing(b);
  northFront(b);
  northWestTower(b);
  southFronts(b);
  westFront(b);
  northEastCorner(b);
}
