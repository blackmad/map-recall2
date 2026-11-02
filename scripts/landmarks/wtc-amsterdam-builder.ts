import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {upwardRoofPlane} from './house-geometry';
import type {Frame} from './nearbar-kit';
import {frameFromBearing} from './modern-kit';
import {Acc, edgeBox, fin, flatLetters, inside, roof, strip, tube, wallQuad, type C} from './tier-kit';
import {edgeNormal, roofTiers, type PlanPoint, type RoofPlane} from '../../src/canalRecall/landmarks/roofTiers';
import source from './wtc-amsterdam-footprints.json';

/**
 * World Trade Center Amsterdam, Strawinskylaan / Zuidplein (1985; stripped and reclad in glass 2002-04; Tower Ten by
 * OZ architects 2018-22). One BAG pand, 0363100012096613, about 200 x 95 m. Native east/south metres from the BAG
 * vertex average (scripts/landmarks/wtc-amsterdam-footprints.json, modern-prepare.mjs), y above local ground.
 *
 * Massing: the 3DBAG LoD2.2 roof planes (AHN4, 2020) snapped to measured levels and stacked as nested tiers
 * (src/canalRecall/landmarks/roofTiers.ts): the 62-68 m central towers, the 67-68 m south-east tower, the 45-51 m west
 * tower, the 41 m north-east block, the 18-21 m glass-roofed atrium and the 7-14 m podium. Two parts are authored
 * because 3DBAG cannot give them:
 *  - Tower Ten (2022, 78 m, nl.wikipedia) was a 41 m construction stage in the 2020 point cloud; its plan is the dark
 *    roof with the white rim on the PDOK orthophoto, its skin the white vertical fins of panoramas
 *    recording_2025-07-29_10-56-07_00309 (lobby with the WTC logo) and recording_2025-07-29_10-56-07_00938;
 *  - the west wing on the Zuidplein: brick blocks ending in the two brick drums (w17 north, w18 south) inside a glass
 *    hall (w05, w06), from the panoramas.
 * The signature is the steel canopy of tilted aluminium wings on V-columns along the Strawinskylaan front (w01, w28),
 * over the south service court (w11), along the west tower's south podium (w04) and on the rims of the drums (w17) and
 * the north-east block (recording_2025-07-29_10-56-07_00938); then the curved glass towers and the WTC logo signs.
 */
type Surface = {type: string; rings: number[][][]};
const src = source as unknown as {surfaces: Surface[]; nativeRing: number[][]};

// ---- zones (native metres) ------------------------------------------------------------------------------------------
/** Tower Ten: the orthophoto roof x 82..118, z -9..12 widened to the lobby front of w29 (ring bump x 113.8, z -7.6..1.9). */
const TT = {x0: 83, x1: 116.5, z0: -13, z1: 13, top: 78, r: 5};
/** West wing: everything west of x = -57 (glass hall and the brick blocks inside it), authored. */
const WEST_X = -57.5;
const FLOOR = 3.6, GROUND = 4.4;
/**
 * The north-east quadrant was a construction site in the 2020 point cloud (one 41 m plane over x 56..101, z -27..23):
 * cut from the tiers and authored from the 2025 panoramas and the orthophoto: the brick-pier block on the Strawinskylaan
 * (41 m, wings on its rim; the north front steps out to z -35.5 east of x 85, w21), the glass-roofed court to 20.5 m and
 * Tower Ten.
 */
const NE_CUT: PlanPoint[] = [[55.6, -37], [118, -37], [118, 20.3], [55.6, 20.3]];
const NE_BLOCK: PlanPoint[] = [[55.3, -12.7], [117, -12.7], [117, -35.5], [85, -35.5], [85, -27], [55.3, -27]].reverse() as PlanPoint[];
const NE_TOP = 41.4;
const COURT: PlanPoint[] = [[55.3, -13], [83.3, -13], [83.3, 20.6], [55.3, 20.6]];
/** The glazed bridge between the central and south-east towers over the service drive (w12), cut from the 3DBAG tiers. */
const BRIDGE: PlanPoint[] = [[54.3, 20], [71.6, 20], [71.6, 38.4], [54.3, 38.4]];
const BRIDGE_BODY: PlanPoint[] = [[54, 20], [71.9, 20], [71.9, 38.4], [54, 38.4]];

const rect = (x0: number, x1: number, z0: number, z1: number): PlanPoint[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
/** Rounded rectangle, counter-clockwise in (x, z) as roofTiers winds outer rings. */
function roundRect(x0: number, x1: number, z0: number, z1: number, r: number, seg = 4): PlanPoint[] {
  const out: PlanPoint[] = [];
  const corners: [number, number, number][] = [[x1 - r, z0 + r, -90], [x1 - r, z1 - r, 0], [x0 + r, z1 - r, 90], [x0 + r, z0 + r, 180]];
  for (const [cx, cz, a0] of corners) for (let i = 0; i <= seg; i++) {
    const a = (a0 + 90 * i / seg) * Math.PI / 180;
    out.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
  }
  return out;
}

// ---- geometry accumulator: one buffer per colour --------------------------------------------------------------------



// ---- facade systems ------------------------------------------------------------------------------------------------
/** Curtain-wall dressing of one slab edge: floor transoms all along, mullions on a pitch, both clear of the corners. */
function curtain(acc: Acc, a: PlanPoint, b: PlanPoint, y0: number, y1: number, o: {pitch: number; mullion: C; transom: C; mullionD?: number; corner0?: boolean; corner1?: boolean}) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (L < 3) return;   // a stub edge (a step in the 3DBAG outline) carries no grid: its strips cost more than they show
  // Transoms stop 0.3 m short of a real corner (one grid per face) but run on through a straight joint, where the 3DBAG
  // outline merely steps, so a long face reads as one band.
  const t0 = o.corner0 === false ? 0 : 0.3, t1 = o.corner1 === false ? L : L - 0.3;
  if (t1 - t0 > 0.4) for (let k = 0; ; k++) {
    const y = k === 0 ? GROUND : GROUND + k * FLOOR;
    if (y > y1 - 0.4) break;
    if (y < y0 + 0.3) continue;
    strip(acc, o.transom, a, b, t0, t1, y - 0.16, y + 0.16, 0.1);
  }
  if (L < o.pitch * 1.2) return;
  const n = Math.round(L / o.pitch), p = L / n;
  for (let i = 1; i < n; i++) fin(acc, o.mullion, a, b, i * p, 0.12, y0 + 0.05, y1 - 0.3, o.mullionD ?? 0.16);
}

// ---- the wing canopy (signature) -----------------------------------------------------------------------------------
/**
 * A row of the WTC's tilted wings along a plan path, on a steel ring beam at `y`: each wing a thin panel `len` long
 * leaning out over the front at `tilt` (radians from vertical), one per `pitch`, each on a strut from the beam. V-columns
 * from the ground carry the beam every `colPitch` metres (0 = none, the beam sits on the roof edge).
 */
function wingRow(b: BuildingTools, acc: Acc, path: PlanPoint[], o: {y: number | ((t: number) => number); pitch: number; len: number; width: number; tilt: number; colPitch?: number; out?: number; roll?: number; inner?: number}) {
  const yAt = (t: number) => (typeof o.y === 'number' ? o.y : o.y(t));
  const segs = path.slice(1).map((p, i) => ({a: path[i], b: p, L: Math.hypot(p[0] - path[i][0], p[1] - path[i][1])}));
  const total = segs.reduce((s, q) => s + q.L, 0);
  const at = (t: number) => {
    let s = 0;
    for (const q of segs) { if (t <= s + q.L || q === segs[segs.length - 1]) { const f = (t - s) / q.L; return {p: [q.a[0] + (q.b[0] - q.a[0]) * f, q.a[1] + (q.b[1] - q.a[1]) * f] as PlanPoint, n: edgeNormal(q.a, q.b), u: [(q.b[0] - q.a[0]) / q.L, (q.b[1] - q.a[1]) / q.L]}; } s += q.L; }
    throw Error('unreachable');
  };
  const out = o.out ?? 0.12;
  // ring beam: a square tube along the path (sampled every ~3 m so a climbing beam follows y(t)), its face in the wall plane
  {
    const m = Math.max(1, Math.ceil(total / 3)), pts = Array.from({length: m + 1}, (_, i) => { const t = Math.min(total - 0.005, Math.max(0.005, total * i / m)), q = at(t); return {p: [q.p[0] + q.n[0] * out, q.p[1] + q.n[1] * out] as PlanPoint, y: yAt(t)}; });
    for (let i = 0; i < m; i++) b.add(tube(pts[i].p, pts[i].y, pts[i + 1].p, pts[i + 1].y, 0.22), 'concrete');
  }
  const n = Math.max(1, Math.round(total / o.pitch)), p = total / n;
  for (let i = 0; i <= n; i++) {
    const t = Math.min(total - 0.01, Math.max(0.01, i * p)), {p: c, n: nn, u} = at(t), y = yAt(t);
    // wing: a thin box, its inner end on the beam, leaning out and up
    const g = new T.BoxGeometry(o.width, o.len, 0.14);
    g.translate(0, o.len / 2 - (o.inner ?? 0), 0);
    g.rotateY(o.roll ?? 0.55);               // blade turned about its own long axis: the sawtooth seen along the row
    g.rotateX(o.tilt);                       // lean towards +z (local outward)
    const ang = Math.atan2(nn[0], nn[1]);
    g.rotateY(ang);
    g.translate(c[0] + nn[0] * out, y + 0.15, c[1] + nn[1] * out);
    g.computeBoundingBox();
    const bc = g.boundingBox!.getCenter(new T.Vector3());
    b.add(g, 'white');
    // strut from the ring beam into the middle of the wing, so blade, strut and beam are one connected frame
    b.add(tube([c[0] + nn[0] * out, c[1] + nn[1] * out], y, [bc.x, bc.z], bc.y, 0.08, 4), 'concrete');
    void u;
  }
  if (o.colPitch) {
    const m = Math.max(1, Math.round(total / o.colPitch)), q = total / m;
    for (let i = 0; i <= m; i++) {
      const t = Math.min(total - 0.01, Math.max(0.01, i * q)), {p: c, n: nn, u} = at(t), y = yAt(t);
      const foot: PlanPoint = [c[0] + nn[0] * (out + 1.8), c[1] + nn[1] * (out + 1.8)], fork = y * 0.55;
      // the trunk runs 0.8 m past the fork so both branches leave through its side (one connected tree)
      b.add(tube(foot, 0, foot, fork + 0.8, 0.28, 8), 'concrete');
      for (const s of [-1, 1]) {
        const tb = Math.min(total - 0.01, Math.max(0.01, t + s * 3.2)), q = at(tb);
        b.add(tube(foot, fork, [q.p[0] + q.n[0] * out, q.p[1] + q.n[1] * out], yAt(tb) - 0.1, 0.12, 6), 'concrete');
      }
    }
  }
}

// ---- the WTC logo: two globes and the name ---------------------------------------------------------------------------
function logoSign(b: BuildingTools, acc: Acc, f: Frame, t: number, y: number, W: number, panel: C | null, lines: string[]) {
  const H = W * 0.3, rot = Math.atan2(f.n[0], f.n[1]);
  if (panel) b.add(new T.BoxGeometry(W, H, 0.16).translate(0, H / 2, 0.08).rotateY(rot).translate(f.origin[0] + f.tangent[0] * t, y, f.origin[1] + f.tangent[1] * t), panel);
  const out = panel ? 0.16 : 0, r = H * 0.24;
  // the WTCA mark: two globes side by side
  for (const k of [0, 1]) {
    const g = new T.CylinderGeometry(r, r, 0.08, 14).rotateX(Math.PI / 2).translate(0, 0, 0.04 + k * 0.01).rotateY(rot);
    const tt = t - W / 2 + H * 0.12 + r * (1 + k * 1.75);
    g.translate(f.origin[0] + f.tangent[0] * tt + f.n[0] * out, y + H / 2, f.origin[1] + f.tangent[1] * tt + f.n[1] * out);
    b.add(g, 'white');
  }
  const x0 = t - W / 2 + H * 0.12 + r * 3.9, chars = Math.max(...lines.map(l => l.length));
  const px = Math.min((t + W / 2 - 0.15 - x0) / (chars * 6 - 1), H / (lines.length * 9 + 1));
  const mid = x0 + (chars * 6 - 1) * px / 2, top = y + H / 2 + (lines.length * 9 - 2) * px / 2;
  lines.forEach((line, i) => flatLetters(acc, f, line, mid, top - (i + 1) * 9 * px + 2 * px, out + 0.02, px, 'white'));
}

// ---- builder --------------------------------------------------------------------------------------------------------
export function buildWtcAmsterdam(_w: number, _d: number, b: BuildingTools) {
  const acc = new Acc(b);
  const ttPlan = roundRect(TT.x0, TT.x1, TT.z0, TT.z1, TT.r);
  // 3DBAG roof planes outside the authored west wing; sloped planes (> 4 m rise: canopy slopes the lidar caught) dropped.
  const planes: RoofPlane[] = [];
  for (const s of src.surfaces) {
    if (s.type !== 'RoofSurface') continue;
    const r = s.rings[0], ys = r.map(p => p[1]), cx = r.reduce((a, p) => a + p[0], 0) / r.length;
    if (cx < WEST_X || Math.max(...ys) - Math.min(...ys) > 4) continue;
    planes.push({ring: r.map(p => [p[0], p[2]] as PlanPoint), height: ys.reduce((a, v) => a + v, 0) / ys.length});
  }
  const tiers = roofTiers(planes, {levels: [6.8, 9.5, 13.6, 20, 41.2, 45.5, 48.8, 62.2, 66.5], minAreaM2: 10, simplifyM: 0.6,
    cuts: [[NE_CUT], [rect(-200, WEST_X - 0.3, -200, 200)], [BRIDGE]]});
  /** Authored volumes and their tops: a tier edge buried in one of them below its top is not drawn. */
  const authored: [PlanPoint[], number][] = [[ttPlan, TT.top], [NE_BLOCK, NE_TOP], [COURT, 20.5], [BRIDGE_BODY, 18.6], [rect(-83, WEST_X, -29.5, 40), 28.2]];

  // ---- shell and skins of the tiers ----
  const atrium = (x: number, z: number) => x > -36 && x < 22 && z > -34 && z < 31;
  for (const t of tiers) {
    const tower = t.top > 38;
    for (const poly of t.plan) for (const ring of poly) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length], mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
      const n = edgeNormal(a, c), probe: PlanPoint = [mx + n[0] * 0.5, mz + n[1] * 0.5];
      wallQuad(acc, 'glass', a, c, t.bottom, t.top);
      if (authored.some(([r, top]) => top >= t.top - 0.01 && inside(probe, r))) continue;   // buried in an authored volume
      const turn = (p: PlanPoint, q: PlanPoint, r: PlanPoint) => { const u = edgeNormal(p, q), v = edgeNormal(q, r); return u[0] * v[0] + u[1] * v[1] < Math.cos(15 * Math.PI / 180); };
      const corner0 = turn(ring[(i - 1 + ring.length) % ring.length], a, c), corner1 = turn(a, c, ring[(i + 2) % ring.length]);
      curtain(acc, a, c, t.bottom, t.top, {pitch: tower ? 1.8 : 3.6, mullion: 'frame', transom: 'frame', corner0, corner1});
    }
    const roofC: C = t.top > 18 && t.top < 22 ? 'canopyGlass' : 'slate';
    // the glass atrium roof (orthophoto) is canopyGlass; elsewhere slate
    const glassRoof = t.roof.filter(p => atrium(p[0].reduce((s, q) => s + q[0], 0) / p[0].length, p[0].reduce((s, q) => s + q[1], 0) / p[0].length));
    roof(b, glassRoof, t.top, roofC);
    roof(b, t.roof.filter(p => !glassRoof.includes(p)), t.top, 'slate');
  }

  // ---- north-east block (brick piers, 41 m) and the glass-roofed court ----
  for (let i = 0; i < NE_BLOCK.length; i++) {
    const a = NE_BLOCK[i], c = NE_BLOCK[(i + 1) % NE_BLOCK.length];
    wallQuad(acc, 'glass', a, c, 0, NE_TOP);
    pierFacade(acc, a, c, GROUND, NE_TOP);
  }
  roof(b, [[NE_BLOCK]], NE_TOP, 'slate');
  for (let i = 0; i < 4; i++) {
    const a = COURT[i], c = COURT[(i + 1) % 4];
    wallQuad(acc, 'glass', a, c, 0, 20.5);
    curtain(acc, a, c, 0, 20.5, {pitch: 7.2, mullion: 'frame', transom: 'frame'});
  }
  roof(b, [[COURT]], 20.5, 'canopyGlass');

  // ---- Tower Ten: rounded glass prism with white vertical fins over a double-height glazed lobby ----
  for (let i = 0; i < ttPlan.length; i++) {
    const a = ttPlan[i], c = ttPlan[(i + 1) % ttPlan.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    wallQuad(acc, 'glass', a, c, 0, TT.top);
    curtain(acc, a, c, 9, TT.top, {pitch: 99, mullion: 'frame', transom: 'frame'});
    const n = Math.max(1, Math.round(L / 1.5)), p = L / n;
    for (let k = 0; k < n; k++) edgeBox(b, 'white', a, c, (k + 0.5) * p - 0.15, (k + 0.5) * p + 0.15, 9.2, TT.top - 0.4, -0.1, 0.6);
    const trim = L * 0.12;   // facet ends: neighbouring bands round the rounded corners must not cross
    strip(acc, 'white', a, c, trim, L - trim, 8.4, 9.2, 0.9);        // lobby soffit band
    strip(acc, 'white', a, c, trim * 0.7, L - trim * 0.7, TT.top - 1.2, TT.top - 0.05, 0.6);  // crown band
  }
  roof(b, [[ttPlan]], TT.top + 0.01, 'slate');

  // ---- the bridge over the service drive (w12): glass storeys from 8 m, wings on its south rim ----
  for (let i = 0; i < 4; i++) {
    const a = BRIDGE_BODY[i], c = BRIDGE_BODY[(i + 1) % 4];
    wallQuad(acc, 'glass', a, c, 8, 18.6);
    curtain(acc, a, c, 8, 18.6, {pitch: 4.4, mullion: 'frame', transom: 'frame'});
    strip(acc, 'frame', a, c, 0.3, Math.hypot(c[0] - a[0], c[1] - a[1]) - 0.3, 8.02, 8.7, 0.35);
  }
  {
    const [p0, p1, p2, p3] = BRIDGE_BODY;   // soffit facing down
    acc.quad('concrete', [p0[0], 8, p0[1]], [p3[0], 8, p3[1]], [p2[0], 8, p2[1]], [p1[0], 8, p1[1]]);
    roof(b, [[BRIDGE_BODY]], 18.6, 'slate');
    for (const x of [57.5, 68.5]) for (const z of [24, 34.5]) b.add(tube([x, z], 0, [x, z], 8, 0.35, 8), 'stone');
    wingRow(b, acc, [[71.9, 38.4], [54, 38.4]], {y: 18.65, pitch: 3.4, len: 3.6, width: 1.3, tilt: 0.9});
  }
  // ---- white columns under the south-east tower's overhang (w02, w13) ----
  colonnade(b, acc, [117.234, 41.43], [72.778, 44.188], 7.2, 8.2);
  colonnade(b, acc, [116.14, 23.83], [117.234, 41.43], 7.2, 8.2);

  // ---- west wing: glass hall to 28 m over two brick blocks with drum ends ----
  westWing(b, acc);

  // ---- canopies of tilted wings ----
  // Strawinskylaan front (w01, w28): over the atrium's north wall, on V-columns in the forecourt.
  wingRow(b, acc, [[-46, -32.2], [6, -35.2]], {y: 20.05, pitch: 3.3, len: 10, inner: 2, width: 2.4, tilt: 1.1, colPitch: 13});
  // south service court (w11): the atrium's south end
  wingRow(b, acc, [[9.5, 29.2], [-11, 30.2]], {y: 20.05, pitch: 3.3, len: 9, inner: 2, width: 2.4, tilt: 1.1, colPitch: 10});
  // south of the west tower over its two-storey podium (w04): the row climbs from the podium to the tower
  wingRow(b, acc, [[-11, 46], [-54, 47.6]], {y: (t: number) => 8 + 12 * Math.sin(Math.max(0, 1 - t / 43) * Math.PI * 0.5), pitch: 3.3, len: 8, inner: 1.5, width: 2.3, tilt: 1.0, colPitch: 10.5});
  // rim of the north-east block (recording_2025-07-29_10-56-07_00938)
  wingRow(b, acc, [[55.3, -27], [85, -27], [85, -35.5], [117, -35.5]], {y: NE_TOP + 0.05, pitch: 3.6, len: 4, width: 1.2, tilt: 0.9});

  // ---- logo signs ----
  // w11: navy panel over the service entrance, south end of the atrium
  logoSign(b, acc, frameFromBearing([-6.3, 29.964], 176.4), 0, 4.6, 3.8, 'dark', ['WORLD TRADE', 'CENTER AMSTERDAM']);
  // w28: the free-standing name wall in the north forecourt
  const nf = frameFromBearing([-51, -44.6], 357);
  b.add(new T.BoxGeometry(9, 2.6, 0.5).translate(0, 1.3, -0.25).rotateY(Math.atan2(nf.n[0], nf.n[1])).translate(nf.origin[0] + nf.tangent[0] * 4.5, 0, nf.origin[1] + nf.tangent[1] * 4.5), 'dark');
  logoSign(b, acc, nf, 4.5, 0.15, 8.6, null, ['WORLD TRADE', 'CENTER AMSTERDAM']);
  // w29: Tower Ten lobby
  logoSign(b, acc, frameFromBearing([TT.x1, -4], 90), 0, 5.2, 5.4, null, ['WORLD TRADE CENTER', 'AMSTERDAM']);
  acc.flush();
}

/**
 * The Zuidplein wing (x -83..-57): two brick office blocks, each ending in a brick drum on pilotis (w17, w18: four storeys
 * of tall windows between brick piers over a recessed glazed ground floor, wings on the rim), standing inside a glass
 * hall that runs the length of the Zuidplein front (w05, w06) to 28 m.
 */
function westWing(b: BuildingTools, acc: Acc) {
  const hall = rect(-83, WEST_X, -29.5, 40);
  // glass hall
  for (let i = 0; i < 4; i++) {
    const a = hall[i], c = hall[(i + 1) % 4];
    wallQuad(acc, 'glass', a, c, 0, 28.2);
    curtain(acc, a, c, 0, 28.2, {pitch: 4.5, mullion: 'frame', transom: 'frame'});
  }
  roof(b, [[hall]], 28.21, 'canopyGlass');
  // the vault ribs of the Zuidplein face (w05, w06)
  for (let z = -27; z <= 38; z += 6.5) fin(acc, 'frame', [-83, 40], [-83, -29.5], 40 - z, 0.2, 9, 28.1, 0.3);
  // brick-pier blocks at both ends (w23, w26), each ending in a drum (w17, w18)
  for (const [blk, top] of [[rect(-82, -66.5, -37, -29.5), 24], [rect(-80, -61.5, 40, 47), 24]] as [PlanPoint[], number][]) {
    for (let i = 0; i < 4; i++) {
      const a = blk[i], c = blk[(i + 1) % 4];
      wallQuad(acc, 'glass', a, c, 0, top);
      pierFacade(acc, a, c, 4.6, top);
    }
    roof(b, [[blk]], top, 'slate');
  }
  drum(b, acc, [-74.25, -37], 0, 7.75, 4.6);
  drum(b, acc, [-68.6, 47], 180, 7.6, 4.6);
  // wings along the hall's top edge on the Zuidplein (w05, w17) and on the north block (w23, w30)
  wingRow(b, acc, [[-83, 39.5], [-83, -29]], {y: 28.25, pitch: 3.6, len: 4.2, width: 1.3, tilt: 0.85});
  wingRow(b, acc, [[-66.5, -36.6], [-66.5, -29.9]], {y: 24.05, pitch: 3.4, len: 4, width: 1.3, tilt: 0.9});
}

/** Round white columns `pitch` apart, 1.1 m in front of a ground storey, under a soffit band at `top`. */
function colonnade(b: BuildingTools, acc: Acc, a: PlanPoint, c: PlanPoint, top: number, pitch: number) {
  const L = Math.hypot(c[0] - a[0], c[1] - a[1]), n = edgeNormal(a, c), u = [(c[0] - a[0]) / L, (c[1] - a[1]) / L];
  edgeBox(b, 'white', a, c, 0.3, L - 0.3, top, top + 0.7, -0.4, 1.5);
  const k = Math.max(1, Math.round(L / pitch)), p = L / k;
  for (let i = 0; i <= k; i++) {
    const t = Math.min(L - 0.8, Math.max(0.8, i * p)), q: PlanPoint = [a[0] + u[0] * t + n[0] * 1.1, a[1] + u[1] * t + n[1] * 1.1];
    b.add(tube(q, 0, q, top + 0.05, 0.33, 10), 'white');
  }
}

/** The brick-pier front of the west blocks and the north-east block (w17, w23, 00938): red-brown piers between glass, pale floor bands. */
function pierFacade(acc: Acc, a: PlanPoint, c: PlanPoint, y0: number, y1: number) {
  const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
  if (L < 1.5) return;
  for (let y = GROUND; y < y1 - 0.5; y += 3.9) if (y >= y0 - 0.01) strip(acc, 'stone', a, c, 0.02, L - 0.02, y - 0.22, y + 0.1, 0.3);
  strip(acc, 'stone', a, c, 0.02, L - 0.02, y1 - 0.55, y1 - 0.05, 0.3);
  const n = Math.max(1, Math.round(L / 2.7)), p = L / n;
  // narrow brown piers (tt-ne panorama: about a fifth of the 2.7 m bay) and a slim mullion splitting each glazed bay
  for (let i = 0; i <= n; i++) fin(acc, 'brick', a, c, Math.min(L - 0.3, Math.max(0.3, i * p)), 0.55, y0 + 0.15, y1 - 0.45, 0.22);
  for (let i = 0; i < n; i++) fin(acc, 'frame', a, c, (i + 0.5) * p, 0.08, y0 + 0.15, y1 - 0.45, 0.1);
}

/**
 * A brick drum: half a cylinder bulging `bulge` m out of the plan chord centred at `c` (normal bearing `bearing`),
 * chord half-width `half`; a recessed glazed ground floor on pilotis, four storeys of tall windows between brick piers,
 * a coping and a rim of wings.
 */
function drum(b: BuildingTools, acc: Acc, c: PlanPoint, bearing: number, half: number, bulge: number) {
  const R = (half * half + bulge * bulge) / (2 * bulge), phi = Math.asin(half / R);
  const a0 = bearing * Math.PI / 180, nx = Math.sin(a0), nz = -Math.cos(a0);
  const centre: PlanPoint = [c[0] - nx * (R - bulge), c[1] - nz * (R - bulge)];
  const base = Math.atan2(nz, nx);
  const segs = 14, y0 = 5, y1 = 20.6, floors = 4;
  const P = (i: number, r: number): PlanPoint => { const a = base - phi + 2 * phi * i / segs; return [centre[0] + r * Math.cos(a), centre[1] + r * Math.sin(a)]; };
  for (let i = 0; i < segs; i++) {
    // P runs counter-clockwise in (x, z) maths angle, which is clockwise seen from above with z south: wind a->b so the normal points out
    const a = P(i, R), e = P(i + 1, R);
    wallQuad(acc, 'brick', a, e, y0, y1);
    const gi = P(i, R - 1.6), ge = P(i + 1, R - 1.6);
    wallQuad(acc, 'glass', gi, ge, 0, y0);
    // windows: one per segment per storey, standing 8 cm proud
    for (let k = 0; k < floors; k++) {
      const yb = y0 + 0.6 + k * 3.8;
      strip(acc, 'glass', a, e, 0.35, Math.hypot(e[0] - a[0], e[1] - a[1]) - 0.35, yb, yb + 2.9, 0.08);
    }
    // floor bands
    for (let k = 0; k <= floors; k++) strip(acc, 'stone', a, e, 0, Math.hypot(e[0] - a[0], e[1] - a[1]), Math.max(y0 + 0.02, y0 + k * 3.8 - 0.3), y0 + k * 3.8 + (k === 0 ? 0.3 : 0.05), 0.18);
  }
  // soffit over the recessed ground floor and the roof cap
  const ring = (r: number) => Array.from({length: segs + 1}, (_, i) => P(i, r));
  const capOuter = ring(R + 0.05), capInner = ring(R - 1.6);
  for (let i = 0; i < segs; i++) {
    acc.quad('stone', [capOuter[i][0], y0, capOuter[i][1]], [capInner[i][0], y0, capInner[i][1]], [capInner[i + 1][0], y0, capInner[i + 1][1]], [capOuter[i + 1][0], y0, capOuter[i + 1][1]]);
  }
  // closures: the chord back wall 2 cm inside the block it stands against, and the two ends of the ground-floor recess
  wallQuad(acc, 'brick', P(segs, R), P(0, R), 0, y1, 0.02);
  for (const [i, s] of [[0, 1], [segs, -1]] as [number, number][]) {
    const o = P(i, R), q = P(i, R - 1.6);
    if (s > 0) wallQuad(acc, 'glass', q, o, 0, y0); else wallQuad(acc, 'glass', o, q, 0, y0);
  }
  const cap = new T.Shape(ring(R).map(([x, z]) => new T.Vector2(x, z)));
  b.add(upwardRoofPlane(cap, y1), 'slate');
  // pilotis round the glazed ground floor
  for (let i = 1; i < segs; i += 3) { const p = P(i, R - 0.6); b.add(tube(p, 0, p, y0, 0.3, 8), 'stone'); }
  // wing rim
  wingRow(b, acc, ring(R), {y: y1 + 0.05, pitch: 3.2, len: 3.4, width: 1.2, tilt: 0.95});
}
