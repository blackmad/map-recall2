import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './noorderkerk-footprints.json';

/**
 * Noorderkerk, Noordermarkt 44 (BAG 0363100012177304; Hendrick de Keyser, begun 1620, finished 1623 by Hendrick Staets and Cornelis Danckertsz:
 * the first Protestant church built as a Greek cross, four equal arms round a crossing under one bell turret).
 *
 * Plan and heights: the BAG/3DBAG footprint of noorderkerk-footprints.json (native east/south metres from the BAG anchor) and the LoD2.2 roof
 * surfaces (eaves 15.0 m, ridge 27.8 m, gable tops 22.0 m, turret to 38.8 m). Ornament from the RCE photographs of the gables (Commons, CC BY-SA 4.0;
 * Han van Gool, W. Kramer), Hnapel/Marcelmulder68 photographs (CC BY-SA) and the Gemeente Amsterdam panoramas (CC BY 4.0):
 * each of the four gables has two tall double-arched mullioned windows, a quatrefoil roundel in a cream ring, scrolls on the shoulders, a balustrade
 * with urns and a dentilled string course; the south arm carries the low flat-roofed annex, the south-west corner the consistory lean-to with a
 * dormer and arms cartouche and the arched portal. Own frame (u, v): u along bearing 346 deg, v along bearing 76 deg, origin the BAG anchor.
 * See scripts/landmarks/noorderkerk-inventory.json for every item with its plan.
 */
type Colour = Parameters<BuildingTools['add']>[1];
const BEAR = 346 * Math.PI / 180;
const E1 = [Math.sin(BEAR), -Math.cos(BEAR)], E2 = [-E1[1], E1[0]];
const xz = (u: number, v: number): [number, number] => [u * E1[0] + v * E2[0], u * E1[1] + v * E2[1]];
/** Crossing centre in (u, v); arms are 14.8 m wide. */
const CU = 6.6, CV = 3.0, HW = 7.4;
/** Distance from the centre to each arm's gable plane (3DBAG walls), by outward direction in (u, v). */
const ARMS: {name: string; n: [number, number]; R: number}[] = [
  {name: 'north', n: [1, 0], R: 18.95}, {name: 'east', n: [0, 1], R: 18.5}, {name: 'south', n: [-1, 0], R: 17.9}, {name: 'west', n: [0, -1], R: 19.05},
];
const EAVE = 15.0, GABLE_TOP = 22.0, RIDGE = 27.8, HIP_BACK = 4.5, TOP_HALF = 3.45;

export interface NoorderkerkStats {arms: number; windows: number; roundels: number; turret: boolean; cornerHouses?: number; cornerWindows?: number; dormers?: number}

export function buildNoorderkerk(_w: number, _d: number, b: BuildingTools, stats: NoorderkerkStats = {arms: 0, windows: 0, roundels: 0, turret: false}) {
  const add = (g: T.BufferGeometry, c: Colour) => b.add(g, c);
  /** Extrude a plan polygon (x, z) from y0 to y1. */
  const prism = (pts: [number, number][], y0: number, y1: number, c: Colour) => {
    const g = new T.ExtrudeGeometry(new T.Shape(pts.map(p => new T.Vector2(p[0], p[1]))), {depth: y1 - y0, bevelEnabled: false});
    g.rotateX(Math.PI / 2); g.translate(0, y1, 0); add(g, c);
  };
  const uvPrism = (pts: [number, number][], y0: number, y1: number, c: Colour) => prism(pts.map(p => xz(p[0], p[1])), y0, y1, c);
  /** Upward-facing sheet from 3D points (u, v, y), fan-triangulated. */
  const sheet = (pts: [number, number, number][], c: Colour) => {
    const P = pts.map(([u, v, y]) => { const [x, z] = xz(u, v); return new T.Vector3(x, y, z); });
    const pos: number[] = [];
    for (let i = 1; i + 1 < P.length; i++) {
      const n = new T.Vector3().subVectors(P[i], P[0]).cross(new T.Vector3().subVectors(P[i + 1], P[0]));
      const tri = n.y >= 0 ? [P[0], P[i], P[i + 1]] : [P[0], P[i + 1], P[i]];
      tri.forEach(p => pos.push(p.x, p.y, p.z));
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); add(g, c);
  };

  // Cross-shaped walls to the eaves: one prism, no overlapping caps.
  const cross: [number, number][] = [];
  {
    const [N, E, S, W] = ARMS, h = HW;
    const pt = (a: {n: [number, number]; R: number}, side: number, depth: number): [number, number] => {
      // point at distance `depth` out along arm a, offset `side` (+1 = left of outward in (u, v)) by h
      const t: [number, number] = [-a.n[1], a.n[0]];
      return [CU + a.n[0] * depth + t[0] * side * h, CV + a.n[1] * depth + t[1] * side * h];
    };
    // counter-clockwise in (u, v): north arm right side -> east ... going round
    cross.push(pt(N, -1, N.R), pt(N, 1, N.R), pt(N, 1, h), pt(E, -1, h), pt(E, -1, E.R), pt(E, 1, E.R), pt(E, 1, h), pt(S, -1, h), pt(S, -1, S.R), pt(S, 1, S.R), pt(S, 1, h), pt(W, -1, h), pt(W, -1, W.R), pt(W, 1, W.R), pt(W, 1, h), pt(N, -1, h));
  }
  uvPrism(cross, 0, EAVE, 'brick');

  // Roof: four ridged arms over the cross, each side plane clipped on the valley diagonal, hip peaks behind the gable balustrades.
  const roof = (s: number, w: number, y: number, a: typeof ARMS[number]): [number, number, number] => {
    const t: [number, number] = [-a.n[1], a.n[0]];
    return [CU + a.n[0] * s + t[0] * w, CV + a.n[1] * s + t[1] * w, y];
  };
  const slope = (RIDGE - EAVE) / HW;
  for (const a of ARMS) {
    for (const side of [-1, 1]) {
      const yAt = (w: number) => RIDGE - slope * Math.abs(w);
      sheet([roof(0, 0, RIDGE, a), roof(a.R - HIP_BACK, 0, RIDGE, a), roof(a.R, side * TOP_HALF, yAt(TOP_HALF), a), roof(a.R, side * HW, EAVE, a), roof(HW, side * HW, EAVE, a)], 'slate');
    }
    sheet([roof(a.R, -TOP_HALF, GABLE_TOP, a), roof(a.R, TOP_HALF, GABLE_TOP, a), roof(a.R - HIP_BACK, 0, RIDGE, a)], 'slate');
  }

  // Gable frames: put geometry built with x across the gable (t), y up, z out of the wall plane.
  for (const a of ARMS) {
    stats.arms++;
    const nx = a.n[0] * E1[0] + a.n[1] * E2[0], nz = a.n[0] * E1[1] + a.n[1] * E2[1], tx = nz, tz = -nx, ang = Math.atan2(-tz, tx);
    const [cx, cz] = xz(CU, CV);
    const put = (g: T.BufferGeometry, t: number, y: number, d: number, c: Colour) => {
      g.rotateY(ang); g.translate(cx + nx * (a.R + d) + tx * t, y, cz + nz * (a.R + d) + tz * t); add(g, c);
    };
    const box = (t: number, y0: number, d0: number, w: number, h: number, dep: number, c: Colour) => put(new T.BoxGeometry(w, h, dep), t, y0 + h / 2, d0 + dep / 2, c);
    const ext = (shape: T.Shape, d0: number, dep: number, c: Colour) => put(new T.ExtrudeGeometry(shape, {depth: dep, bevelEnabled: false}), 0, 0, d0, c);
    const archPts = (t0: number, w: number, y0: number, spring: number, seg = 10): [number, number][] => {
      const r = w / 2, p: [number, number][] = [[t0 - r, y0], [t0 + r, y0], [t0 + r, spring]];
      for (let i = 1; i < seg; i++) { const th = Math.PI * i / seg; p.push([t0 + r * Math.cos(th), spring + r * Math.sin(th)]); }
      p.push([t0 - r, spring]); return p;
    };
    const shapeOf = (p: [number, number][]) => new T.Shape(p.map(q => new T.Vector2(q[0], q[1])));

    // Brick gable plate between the shoulders, set 5 cm inside the roof planes.
    const inset = 0.06;
    ext(shapeOf([[-HW, EAVE], [HW, EAVE], [TOP_HALF + inset, GABLE_TOP], [-TOP_HALF - inset, GABLE_TOP]].map(([t, y], i) => i < 2 ? [t as number, y as number] : [t as number, y as number]) as [number, number][]), -0.5, 0.5, 'brick');
    // String course along the eaves (dentilled in the photographs) and the cornice over the basement.
    box(0, EAVE - 0.45, 0, 2 * HW + 0.5, 0.45, 0.22, 'stone');
    box(0, 5.0, 0, 2 * HW + 0.5, 0.45, 0.28, 'stone');
    for (let t = -HW + 0.3; t < HW; t += 0.6) box(t, EAVE - 0.75, 0, 0.3, 0.3, 0.16, 'stone');
    // Two tall double-arched windows: cream arch ring, glass, mullion, two arched lights with a rosette head, transoms.
    for (const t0 of [-3.7, 3.7]) {
      stats.windows++;
      const outer = archPts(t0, 3.3, 5.9, 12.8), inner = archPts(t0, 2.6, 6.3, 12.8);
      const ring = shapeOf(outer); ring.holes.push(new T.Path(inner.map(q => new T.Vector2(q[0], q[1]))));
      ext(ring, 0, 0.16, 'stone');
      ext(shapeOf(inner), 0, 0.09, 'glass');
      box(t0, 6.4, 0.07, 0.12, 6.4, 0.07, 'white');
      for (const dt of [-0.65, 0.65]) box(t0 + dt, 6.4, 0.07, 0.08, 6.4, 0.07, 'white');
      for (let y = 7.0; y < 12.8; y += 0.62) box(t0, y, 0.07, 2.5, 0.05, 0.06, 'white');
      for (const dt of [-0.65, 0.65]) { const g = new T.TorusGeometry(0.5, 0.04, 4, 10, Math.PI); put(g, t0 + dt, 12.8, 0.12, 'white'); }
      const g = new T.TorusGeometry(0.4, 0.045, 4, 12); put(g, t0, 13.65, 0.12, 'white');
    }
    // Quatrefoil roundel in a cream ring.
    stats.roundels++;
    {
      const cy = 18.2, ringS = new T.Shape(); ringS.absarc(0, cy, 2.15, 0, Math.PI * 2, false);
      const hole = new T.Path(); hole.absarc(0, cy, 1.7, 0, Math.PI * 2, true); ringS.holes.push(hole);
      ext(ringS, 0, 0.16, 'stone');
      const disc = new T.Shape(); disc.absarc(0, cy, 1.7, 0, Math.PI * 2, false); ext(disc, 0, 0.09, 'glass');
      for (const [dx, dy] of [[0.72, 0], [-0.72, 0], [0, 0.72], [0, -0.72]]) put(new T.TorusGeometry(0.62, 0.05, 4, 10), dx, cy + dy, 0.12, 'white');
      put(new T.TorusGeometry(0.3, 0.05, 4, 8), 0, cy, 0.12, 'white');
      put(new T.TorusGeometry(1.55, 0.04, 4, 16), 0, cy, 0.12, 'white');
    }
    // Cream bands under the roundel, scrolls on the shoulders, raking coping along both shoulders.
    box(-3.4, 16.0, 0, 3.2, 0.3, 0.2, 'stone'); box(3.4, 16.0, 0, 3.2, 0.3, 0.2, 'stone');
    box(0, 20.0, 0, 2 * TOP_HALF + 1.0, 0.4, 0.22, 'stone');
    for (const s of [-1, 1]) {
      put(new T.TorusGeometry(0.42, 0.14, 5, 10), s * 5.3, 17.6, 0.12, 'stone');
      box(s * 5.3, 17.0, 0, 0.3, 0.9, 0.2, 'stone');
      const len = Math.hypot(HW - TOP_HALF, GABLE_TOP - EAVE), th = Math.atan2(GABLE_TOP - EAVE, HW - TOP_HALF);
      const g = new T.BoxGeometry(len, 0.3, 0.2); g.rotateZ(s > 0 ? -th : th);
      put(g, s * (HW + TOP_HALF) / 2, (EAVE + GABLE_TOP) / 2 + 0.2, 0.1, 'stone');
      // shoulder pier with a ball finial
      box(s * 7.15, EAVE, 0, 0.9, 1.6, 0.9, 'stone'); box(s * 7.15, EAVE + 1.6, 0, 1.1, 0.2, 1.1, 'stone');
      put(new T.SphereGeometry(0.3, 8, 6), s * 7.15, EAVE + 2.1, 0.45, 'stone');
    }
    // Segmental pediment relief under the balustrade.
    { const sh = new T.Shape(); sh.absarc(0, 20.4, 1.7, 0, Math.PI, false); sh.closePath(); ext(sh, 0, 0.12, 'stone'); }
    // Balustrade with end urns on the gable top.
    box(0, GABLE_TOP, -0.1, 2 * TOP_HALF + 0.6, 0.3, 0.7, 'stone');
    box(0, GABLE_TOP + 1.05, -0.1, 2 * TOP_HALF + 0.6, 0.18, 0.5, 'stone');
    for (let t = -TOP_HALF; t <= TOP_HALF + 0.01; t += 0.55) put(new T.CylinderGeometry(0.1, 0.13, 0.75, 6), t, GABLE_TOP + 0.3 + 0.375, 0.15, 'stone');
    for (const s of [-1, 1]) { box(s * (TOP_HALF + 0.1), GABLE_TOP + 0.3, 0.0, 0.4, 0.75, 0.4, 'stone'); put(new T.SphereGeometry(0.25, 8, 6), s * (TOP_HALF + 0.1), GABLE_TOP + 1.5, 0.15, 'stone'); }
    // Basement: two rows of small windows and a plank door. The east gable's foot is inside the one-storey annex of the north-east corner
    // house (BAG 0363100012177303, panorama recording_2025-07-03_07-31-54_00556), so it has none.
    if (a.name !== 'east') for (const [t, y0] of [[-5.3, 3.0], [-2.6, 3.0], [2.6, 3.0], [5.3, 3.0], [-5.3, 1.0], [5.3, 1.0]] as [number, number][]) {
      box(t, y0 - 0.12, 0, 1.55, 1.3, 0.06, 'stone'); box(t, y0, 0.06, 1.25, 1.06, 0.05, 'glass');
      box(t, y0 + 0.5, 0.11, 1.25, 0.04, 0.03, 'white'); box(t, y0, 0.11, 0.04, 1.06, 0.03, 'white');
    }
    if (a.name !== 'east') { box(0, 0, 0, 1.9, 2.8, 0.1, 'stone'); box(0, 0, 0.1, 1.5, 2.55, 0.05, 'dark'); }
  }

  // Annexes: the south arm's flat-roofed base (5.2 m) and the south-west consistory lean-to, from the BAG ring.
  const annexWest: [number, number][] = [[-11.3, -4.4], [-12.68, -4.38], [-16.01, -4.37], [-18.88, -2.94], [-18.86, 10.45], [-15.98, 13.41], [-12.86, 10.29], [-11.3, 10.3]];
  uvPrism(annexWest, 0, 5.2, 'brick');
  {
    const out = annexWest;
    for (let i = 1; i < out.length - 1; i++) {
      const p = out[i], q = out[(i + 1) % out.length], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (len < 1) continue;
      const [x0, z0] = xz(p[0], p[1]), [x1, z1] = xz(q[0], q[1]), ang = Math.atan2(-(z1 - z0), x1 - x0);
      b.box((x0 + x1) / 2, 5.0, (z0 + z1) / 2, len, 0.4, 0.3, 'stone', ang);
    }
  }
  const lean: [number, number][] = [[-12.68, -4.38], [-8.02, -9.09], [-4.76, -12.4], [-1.23, -15.96], [-0.9, -4.4]];
  uvPrism(lean, 0, 8.7, 'brick');
  {
    const apex: [number, number, number] = [-0.9, -4.4, 14.4];
    for (let i = 0; i + 1 < lean.length - 1; i++) sheet([apex, [lean[i][0], lean[i][1], 8.7], [lean[i + 1][0], lean[i + 1][1], 8.7]], 'slate');
    // Dormer with the red-shuttered window and the arms cartouche (seen on the lean-to in every photograph).
    const mid = xz(-6.2, -8.0);
    b.box(mid[0], 9.6, mid[1], 1.6, 1.8, 1.1, 'stone', Math.atan2(0.7, 0.7) + 0.3);
    b.box(mid[0], 11.4, mid[1], 1.2, 0.5, 0.9, 'stone', Math.atan2(0.7, 0.7) + 0.3);
    b.box(mid[0] + 0.2, 9.9, mid[1] + 0.3, 0.6, 0.9, 0.2, 'red', Math.atan2(0.7, 0.7) + 0.3);
    // Arched portal with steps on the lean-to's diagonal wall, shuttered windows beside it.
    const a0 = lean[1], a1 = lean[2], pm = xz((a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2);
    const [px0, pz0] = xz(a0[0], a0[1]), [px1, pz1] = xz(a1[0], a1[1]), wang = Math.atan2(-(pz1 - pz0), px1 - px0);
    const wl = Math.hypot(px1 - px0, pz1 - pz0), tx = (px1 - px0) / wl, tz = (pz1 - pz0) / wl, nx = tz, nz = -tx;
    // outward normal: away from the lean-to interior (toward negative u, negative v of the arms' corner)
    const sgn = (nx * (pm[0] - xz(-4, -4)[0]) + nz * (pm[1] - xz(-4, -4)[1])) >= 0 ? 1 : -1;
    const at = (t: number, y: number, d: number, w: number, h: number, dep: number, c: Colour) =>
      b.box(pm[0] + tx * t + sgn * nx * (d + dep / 2), y, pm[1] + tz * t + sgn * nz * (d + dep / 2), w, h, dep, c, wang);
    at(0, 0.0, 0, 2.6, 3.3, 0.18, 'stone'); at(0, 0.0, 0.18, 1.8, 2.8, 0.06, 'dark');
    for (const s of [-1, 1]) {
      at(s * 2.1, 2.2, 0, 1.3, 2.0, 0.08, 'stone'); at(s * 2.1, 2.3, 0.08, 1.0, 1.6, 0.05, 'glass');
      at(s * 2.1, 5.6, 0, 1.3, 2.0, 0.08, 'stone'); at(s * 2.1, 5.7, 0.08, 1.0, 1.6, 0.05, 'glass');
    }
    for (let k = 0; k < 3; k++) at(0, k * 0.16, 0.2 + (2 - k) * 0.3, 3.4, 0.16, 0.3, 'concrete');
  }

  // Bell turret on the crossing: square clock stage with four dials, open lantern with bells, domed cap, ball and weathercock.
  {
    const [cx, cz] = xz(6.55, 3.5), yaw = BEAR - Math.PI;
    const box = (y0: number, w: number, h: number, c: Colour, d = w) => b.box(cx, y0, cz, w, h, d, c, yaw);
    box(27.0, 3.8, 4.2, 'slate'); box(31.2, 4.2, 0.4, 'stone'); box(26.9, 4.2, 0.2, 'stone');
    for (const k of [0, 1, 2, 3]) {
      const a = yaw + k * Math.PI / 2, ox = Math.sin(a) * 1.95, oz = Math.cos(a) * 1.95;
      const g = new T.CylinderGeometry(0.85, 0.85, 0.1, 14); g.rotateX(Math.PI / 2); g.rotateY(a);
      b.add(g, 'dark', cx + ox + Math.sin(a) * 0.04, 29.2, cz + oz + Math.cos(a) * 0.04);
      const r = new T.TorusGeometry(0.88, 0.06, 4, 14); r.rotateY(a); b.add(r, 'gold', cx + ox + Math.sin(a) * 0.07, 29.2, cz + oz + Math.cos(a) * 0.07);
      b.box(cx + Math.sin(a) * 2.02 + Math.cos(a) * 0.0, 29.15, cz + Math.cos(a) * 2.02, 0.08, 0.7, 0.05, 'gold', a + 0.4);
    }
    box(31.6, 2.6, 3.4, 'stone'); box(35.0, 3.1, 0.3, 'stone');
    for (const k of [0, 1, 2, 3]) {
      const a = yaw + k * Math.PI / 2;
      b.box(cx + Math.sin(a) * 1.32, 32.2, cz + Math.cos(a) * 1.32, 1.2, 2.0, 0.08, 'dark', a);
    }
    for (const k of [0, 1, 2, 3]) { const a = yaw + Math.PI / 4 + k * Math.PI / 2; b.box(cx + Math.sin(a) * 1.25, 31.6, cz + Math.cos(a) * 1.25, 0.25, 3.4, 0.25, 'stone', a); }
    const dome = new T.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1.55, 1.9, 1.55); b.add(dome, 'slate', cx, 35.3, cz);
    b.add(new T.SphereGeometry(0.28, 8, 6), 'gold', cx, 37.4, cz);
    b.add(new T.CylinderGeometry(0.03, 0.03, 1.5, 4), 'gold', cx, 38.1, cz);
    b.box(cx, 38.0, cz, 0.7, 0.35, 0.04, 'gold', yaw + 0.5);
    stats.turret = true;
  }

  buildCornerHouses(b, stats);
}

// ---------------------------------------------------------------------------------------------------------------------
// The three service houses in the north-east, south-east and north-west angles of the cross (BAG pands 0363100012177303,
// 0363100012176942, 0363100012176956, bouwjaar 1623; RCE register 3923: "met diagonaal tussen de armen geplaatste dienstwoningen").
// Rings and 3DBAG heights are in noorderkerk-footprints.json `cornerHouses`; the polygons below are those rings in the (u, v) frame.
// Photographs: Gemeente Amsterdam panoramas b_20241216_0911_Track34_Sphere_00017 / 00014 / 00026, recording_2025-07-03_07-31-54_00556,
// TMX7316010203-001673_pano_0000_002448 (2020) and the Stadsarchief Beeldbank 2006 series (Martin Alberts, "Kosterij (bijgebouw)",
// "Bijgebouw"). Each house is brick, two storeys under a slate hipped roof that dies into the arm walls, with a cream eave cornice,
// white-framed small-pane sashes, a stone dormer carrying a red-framed window and the arms cartouche over the door.
// Each angle is described in a half-plane frame (a, b): a = su (u - cu), b = sv (v - cv) from the re-entrant corner (cu, cv),
// so the diagonal fronts are the lines a + b = k (k = 11.85 m for NE and SE; the NW house is a chamfered square reaching both gable planes).
type UV = [number, number];
interface Angle {C: UV; su: number; sv: number}
const abUV = (h: Angle, a: number, b: number): UV => [h.C[0] + h.su * a, h.C[1] + h.sv * b];
const NE: Angle = {C: [14.0, 10.4], su: 1, sv: 1};
const SE: Angle = {C: [-0.95, 10.3], su: -1, sv: 1};
const NW: Angle = {C: [13.77, -4.4], su: 1, sv: -1};

/** Keep the part of a convex polygon where f(p) >= 0 (f linear). */
function clip(poly: UV[], f: (p: UV) => number): UV[] {
  const out: UV[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], fp = f(p), fq = f(q);
    if (fp >= 0) out.push(p);
    if ((fp >= 0) !== (fq >= 0)) { const s = fp / (fp - fq); out.push([p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s]); }
  }
  return out;
}

/** Even-odd point-in-polygon test in the plane. */
function pointIn(poly: UV[], p: UV): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function buildCornerHouses(b: BuildingTools, stats: NoorderkerkStats) {
  stats.cornerHouses = 0; stats.cornerWindows = 0; stats.dormers = 0;
  const V = (u: number, v: number, y: number) => { const [x, z] = xz(u, v); return new T.Vector3(x, y, z); };
  /** Triangles to one geometry, each wound so its normal points to `up` (+1 up, -1 down) or, for walls, away from `out`. */
  const emit = (tris: T.Vector3[][], c: Colour) => {
    const pos: number[] = [];
    for (const t of tris) t.forEach(p => pos.push(p.x, p.y, p.z));
    if (!pos.length) return;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); b.add(g, c);
  };
  const facing = (a: T.Vector3, b2: T.Vector3, c: T.Vector3, want: T.Vector3) => {
    const n = new T.Vector3().subVectors(b2, a).cross(new T.Vector3().subVectors(c, a));
    if (n.length() < 1e-4) return null; // sliver from clipping
    return n.dot(want) >= 0 ? [a, b2, c] : [a, c, b2];
  };
  const UP = new T.Vector3(0, 1, 0), DOWN = new T.Vector3(0, -1, 0);
  /**
   * A closed brick block on a plan (u, v) from y0: walls on every edge, a bottom cap, and either a flat slate top at `top` or, for a
   * convex plan, a hipped roof: one plane per eave edge rising at `slope` from `top`, clipped against the others, and a flat lead deck
   * where all of them pass `ridge`. Edges that are not eaves (against the church walls or a taller wing) rise as cheek walls to the roof
   * line, split at the roof's own vertices, so every edge is shared by two faces (no open boundary loops); blocks that touch share
   * only opposite-facing planes.
   */
  const block = (poly: UV[], y0: number, top: number, roof?: {eaves: boolean[]; ridge: number; slope: number}) => {
    const faces: [number, number, number][][] = [];
    if (roof) {
      const cu = poly.reduce((acc, q) => acc + q[0], 0) / poly.length, cv = poly.reduce((acc, q) => acc + q[1], 0) / poly.length;
      const lines = poly.map((q0, i) => {
        const q1 = poly[(i + 1) % poly.length], L = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]);
        let n: UV = [-(q1[1] - q0[1]) / L, (q1[0] - q0[0]) / L];
        if (n[0] * (cu - q0[0]) + n[1] * (cv - q0[1]) < 0) n = [-n[0], -n[1]];
        return (r: UV) => n[0] * (r[0] - q0[0]) + n[1] * (r[1] - q0[1]);
      });
      const t = Math.tan(roof.slope * Math.PI / 180), hd = (roof.ridge - top) / t, eaves = lines.filter((_, i) => roof.eaves[i]);
      for (const d of eaves) {
        let r = clip(poly, q => hd - d(q));
        for (const o of eaves) if (o !== d) r = clip(r, q => o(q) - d(q));
        if (r.length >= 3) faces.push(r.map(q => [q[0], q[1], top + t * d(q)]));
      }
      let deck = poly;
      for (const d of eaves) deck = clip(deck, q => d(q) - hd);
      if (deck.length >= 3) faces.push(deck.map(q => [q[0], q[1], roof.ridge]));
    }
    // Ring of (u, v, roof height) with every roof vertex that lies on an edge.
    const verts = faces.flat();
    const yAt = (q: UV) => verts.find(w => Math.hypot(w[0] - q[0], w[1] - q[1]) < 1e-6)?.[2] ?? top;
    const ring: [number, number, number][] = [];
    poly.forEach((q0, i) => {
      const q1 = poly[(i + 1) % poly.length], L2 = (q1[0] - q0[0]) ** 2 + (q1[1] - q0[1]) ** 2;
      ring.push([q0[0], q0[1], yAt(q0)]);
      const mid = verts.map(w => ({w, s: ((w[0] - q0[0]) * (q1[0] - q0[0]) + (w[1] - q0[1]) * (q1[1] - q0[1])) / L2}))
        .filter(({w, s: sp}) => sp > 1e-6 && sp < 1 - 1e-6 && Math.abs((w[0] - q0[0]) * (q1[1] - q0[1]) - (w[1] - q0[1]) * (q1[0] - q0[0])) / Math.sqrt(L2) < 1e-6)
        .sort((x, y) => x.s - y.s);
      for (const {w, s: sp} of mid) if (!mid.some(o => o.s < sp && sp - o.s < 1e-6)) ring.push([w[0], w[1], w[2]]);
    });
    const plan2d = ring.map(r => { const [x, z] = xz(r[0], r[1]); return [x, z] as UV; });
    const wallTris: T.Vector3[][] = [];
    ring.forEach((r0, i) => {
      const r1 = ring[(i + 1) % ring.length], a0 = V(r0[0], r0[1], y0), a1 = V(r1[0], r1[1], y0), t0 = V(r0[0], r0[1], r0[2]), t1 = V(r1[0], r1[1], r1[2]);
      // Outward: the edge normal whose 5 cm probe falls outside the plan (works for the concave annex too).
      const en = new T.Vector3(-(a1.z - a0.z), 0, a1.x - a0.x);
      const probe = new T.Vector3().addVectors(a0, a1).multiplyScalar(0.5).add(en.clone().normalize().multiplyScalar(0.05));
      const want = pointIn(plan2d, [probe.x, probe.z]) ? en.clone().negate() : en;
      for (const tri of [facing(a0, a1, t1, want), facing(a0, t1, t0, want)]) if (tri) wallTris.push(tri);
    });
    emit(wallTris, 'brick');
    const contour = ring.map(r => { const [x, z] = xz(r[0], r[1]); return new T.Vector2(x, z); });
    const capTris = (y: number, want: T.Vector3) => T.ShapeUtils.triangulateShape(contour, []).map(([i0, i1, i2]) => facing(new T.Vector3(contour[i0].x, y, contour[i0].y), new T.Vector3(contour[i1].x, y, contour[i1].y), new T.Vector3(contour[i2].x, y, contour[i2].y), want)).filter((x): x is T.Vector3[] => !!x);
    emit(capTris(y0, DOWN), 'brick');
    if (!roof) emit(capTris(top, UP), 'slate');
    else emit(faces.flatMap(f => { const P = f.map(w => V(w[0], w[1], w[2])); const out: T.Vector3[][] = []; for (let k = 1; k + 1 < P.length; k++) { const tri = facing(P[0], P[k], P[k + 1], UP); if (tri) out.push(tri); } return out; }), 'slate');
  };
  /** Edge i of a plan in (a, b) is an eave unless it lies on an arm wall (a = 0 or b = 0) or on the line b = wingB. */
  const eavesOf = (plan: UV[], wingB?: number) => plan.map((q0, i) => {
    const q1 = plan[(i + 1) % plan.length];
    return !((q0[0] === 0 && q1[0] === 0) || (q0[1] === 0 && q1[1] === 0) || (wingB !== undefined && Math.abs(q0[1] - wingB) < 1e-6 && Math.abs(q1[1] - wingB) < 1e-6));
  });
  /** A wall from P0 to P1 (u, v) with `out` pointing away from `inside`: t metres from P0 along the wall, d metres out of it. */
  const wall = (P0: UV, P1: UV, inside: UV) => {
    const [x0, z0] = xz(P0[0], P0[1]), [x1, z1] = xz(P1[0], P1[1]), [ix, iz] = xz(inside[0], inside[1]);
    const L = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / L, dz = (z1 - z0) / L;
    let ox = -dz, oz = dx;
    if (ox * ((x0 + x1) / 2 - ix) + oz * ((z0 + z1) / 2 - iz) < 0) { ox = dz; oz = -dx; }
    // rotateY(ang) sends local x to (cos, -sin) and local z to (sin, cos) = (-ez, ex): run the local frame backwards when `out` is the other side.
    const flip = Math.abs(ox + dz) > 1e-6, ex = flip ? -dx : dx, ez = flip ? -dz : dz, ang = Math.atan2(-ez, ex);
    const at = (t: number, d: number): [number, number] => [x0 + dx * t + ox * d, z0 + dz * t + oz * d];
    const box = (t: number, y: number, d: number, w: number, h: number, dep: number, c: Colour) => { const [x, z] = at(t, d + dep / 2); b.box(x, y, z, w, h, dep, c, ang); };
    const put = (g: T.BufferGeometry, t: number, y: number, d: number, c: Colour) => { const [x, z] = at(t, d); b.add(g, c, x, y, z, ang); };
    return {L, box, put};
  };
  type Wall = ReturnType<typeof wall>;
  const arch = (w: number, y0: number, spring: number): T.Shape => {
    const r = w / 2, s = new T.Shape();
    s.moveTo(-r, y0); s.lineTo(r, y0); s.lineTo(r, spring); s.absarc(0, spring, r, 0, Math.PI, false); s.lineTo(-r, y0);
    return s;
  };
  /** White-framed small-pane sash: frame, glass, meeting rail, glazing bars, stone sill; optional shutters and a brick relieving arch. */
  const sash = (W: Wall, t: number, y0: number, w: number, h: number, o: {shutters?: Colour; relieving?: boolean; cols?: number} = {}) => {
    stats.cornerWindows!++;
    W.box(t, y0 - 0.08, 0, w + 0.18, h + 0.16, 0.05, 'white');
    W.box(t, y0, 0.05, w - 0.06, h, 0.07, 'glass'); // glass 7 cm proud of the frame, bars on its face: no two faces closer than 3 cm
    W.box(t, y0 + h / 2 - 0.03, 0.12, w - 0.06, 0.07, 0.04, 'white');
    const cols = o.cols ?? 3;
    for (let i = 1; i < cols; i++) W.box(t - w / 2 + i * w / cols, y0, 0.12, 0.035, h, 0.03, 'white');
    for (const f of [0.25, 0.75]) W.box(t, y0 + h * f, 0.12, w - 0.06, 0.035, 0.03, 'white');
    W.box(t, y0 - 0.14, 0, w + 0.3, 0.1, 0.16, 'stone');
    if (o.shutters) for (const s of [-1, 1]) W.box(t + s * (w * 0.75 + 0.1), y0, 0, w / 2, h, 0.06, o.shutters);
    if (o.relieving) {
      const ring = new T.Shape(); ring.absarc(0, 0, w / 2 + 0.38, 0, Math.PI, false); ring.absarc(0, 0, w / 2 + 0.06, Math.PI, 0, true);
      W.put(new T.ExtrudeGeometry(ring, {depth: 0.03, bevelEnabled: false, curveSegments: 8}), t, y0 + h + 0.05, 0.03, 'red');
      W.box(t, y0 + h + 0.12 + w / 2, 0, 0.28, 0.3, 0.07, 'stone');
      for (const s of [-1, 1]) W.box(t + s * (w / 2 + 0.2), y0 + h - 0.05, 0, 0.3, 0.18, 0.07, 'stone');
    }
  };
  const cornice = (W: Wall, y: number) => { W.box(W.L / 2, y - 0.32, 0, W.L + 0.2, 0.32, 0.26, 'stone'); W.box(W.L / 2, y - 0.5, 0, W.L, 0.18, 0.12, 'white'); };
  /** Stone dormer standing on the front slope with a red-framed window and the arms cartouche on its curved head (all three houses). */
  const dormer = (W: Wall, t: number, eave: number) => {
    stats.dormers!++;
    W.box(t, eave - 0.1, -2.1, 1.9, 2.3, 1.75, 'stone');
    const head = new T.Shape(); head.absarc(0, 0, 0.95, 0, Math.PI, false); head.lineTo(0.95, 0);
    const g = new T.ExtrudeGeometry(head, {depth: 1.75, bevelEnabled: false}); W.put(g, t, eave + 2.2, -2.1, 'stone');
    W.box(t, eave + 0.45, -0.35, 0.95, 1.15, 0.05, 'red');
    W.box(t, eave + 0.58, -0.3, 0.62, 0.86, 0.08, 'glass');
    W.box(t, eave + 0.58, -0.22, 0.04, 0.86, 0.03, 'white'); W.box(t, eave + 1.0, -0.22, 0.62, 0.04, 0.03, 'white');
    const cart = new T.CylinderGeometry(0.3, 0.3, 0.08, 10); cart.rotateX(Math.PI / 2); cart.scale(1, 1.25, 1); W.put(cart, t, eave + 2.25, -0.3, 'stone');
    const arms = new T.CylinderGeometry(0.2, 0.2, 0.06, 8); arms.rotateX(Math.PI / 2); arms.scale(1, 1.3, 1); W.put(arms, t, eave + 2.25, -0.25, 'red');
  };
  const mainHouse = (h: Angle, plan: [number, number][], front: [UV, UV], eave: number, ridge: number, slope: number) => {
    stats.cornerHouses!++;
    const poly = plan.map(([a, bb]) => abUV(h, a, bb));
    block(poly, 0, eave, {eaves: eavesOf(plan), ridge, slope});
    const W = wall(front[0], front[1], h.C);
    return W;
  };

  // North-east: diagonal front (25.54, 10.74) - (16.64, 19.59), 12.6 m, faces 31 deg. Rectified panoramas 00017 (2024) and 001673/002448 (2020):
  // ground floor sash, round-arched portal in a cream surround with steps, sash; three sashes above; oculus over the door, brick
  // relieving arches with cream keystones over the ground-floor sashes; dormer over the door; a white timber shaft with a capped top
  // rising from the roof against the north arm to the church gutter. t is measured from the south end (16.64, 19.59).
  {
    const W = mainHouse(NE, [[0, 0], [11.5, 0], [11.5, 0.35], [0.6, 11.25], [0, 11.25]], [[16.64, 19.59], [25.54, 10.74]], 8.5, 14.0, 47);
    cornice(wall(abUV(NE, 0.6, 11.25), abUV(NE, 11.5, 0.35), NE.C), 8.5);
    for (const t of [0.85, 7.5]) { sash(W, t, 1.6, 1.3, 2.7, {relieving: true}); sash(W, t, 5.7, 1.3, 2.35); }
    sash(W, 4.1, 5.7, 1.3, 2.35);
    // Portal: cream surround, dark double door under a round head, three steps.
    { const ring = arch(3.0, 0, 3.0); ring.holes.push(new T.Path(arch(2.0, 0.35, 3.0).getPoints(10))); W.put(new T.ExtrudeGeometry(ring, {depth: 0.18, bevelEnabled: false}), 4.1, 0, 0, 'stone'); }
    W.put(new T.ExtrudeGeometry(arch(2.0, 0.35, 3.0), {depth: 0.06, bevelEnabled: false}), 4.1, 0, 0.0, 'dark');
    W.box(4.1, 0.35, 0.06, 0.05, 3.6, 0.03, 'bronze');
    for (let k = 0; k < 2; k++) W.box(4.1, k * 0.17, 0.18 + (1 - k) * 0.3, 2.6, 0.17, 0.35, 'stone');
    { const o = new T.TorusGeometry(0.4, 0.09, 4, 12); W.put(o, 4.1, 5.0, 0.05, 'stone'); const d = new T.CylinderGeometry(0.33, 0.33, 0.05, 12); d.rotateX(Math.PI / 2); W.put(d, 4.1, 5.0, 0.02, 'dark'); }
    for (const s of [-1, 1]) W.box(4.1 + s * 2.0, 3.2, 0.02, 0.12, 0.35, 0.18, 'dark'); // wall lanterns either side of the portal
    dormer(W, 4.1, 8.5);
    // White timber shaft (2020 rectified panorama: 1.6 m wide, from the roof to the church gutter, a cornice cap and one small window).
    const [su, sv] = abUV(NE, 6.97, 2.77), [sx, sz] = xz(su, sv);
    b.box(sx, 9.0, sz, 1.6, 6.3, 1.6, 'white', BEAR); b.box(sx, 15.3, sz, 1.85, 0.25, 1.85, 'white', BEAR);
    b.box(sx, 13.4, sz, 0.45, 0.6, 1.66, 'dark', BEAR);
    // One-storey annex in front of the east gable (BAG ring, flat roof 4.1 m): shuttered sashes and the side door (panorama 00556).
    const annex: UV[] = [[16.64, 19.59], [17.53, 20.52], [17.58, 21.32], [17.49, 21.4], [16.46, 22.42], [14.59, 24.27], [12.45, 26.39], [11.59, 26.28], [10.78, 25.41], [6.46, 29.7], [2.01, 25.18], [0.07, 23.24], [-1.19, 21.96], [-0.88, 21.65], [14.6, 21.65]];
    block(annex, 0, 4.1);
    const A1 = wall([16.46, 22.42], [12.45, 26.39], [10, 22]), A2 = wall([10.78, 25.41], [6.46, 29.7], [6, 24]), A3 = wall([17.53, 20.52], [17.58, 21.32], [15, 21]);
    for (const A of [A1, A2]) cornice(A, 4.1);
    A3.box(A3.L / 2, 3.78, 0, A3.L + 0.2, 0.32, 0.26, 'stone');
    sash(A1, 1.6, 1.0, 1.25, 2.1, {shutters: 'bronze'});
    A1.box(4.2, 0, 0, 1.3, 2.5, 0.08, 'stone'); A1.box(4.2, 0, 0.08, 1.0, 2.3, 0.05, 'bronze');
    for (const t of [1.6, 4.1]) sash(A2, t, 1.0, 1.25, 2.1, {shutters: 'bronze'});
  }

  // South-east: diagonal front between two one-storey wings, (-9.99, 13.11) - (-3.66, 19.5), 9.0 m, faces 121 deg (panorama
  // TMX7316010203-002960 2023, Beeldbank "Bijgebouw" 2006): sash, red double door in a white doorcase under two round-headed lights,
  // sash; three sashes above; the dormer over the door. t from the south-west end.
  {
    const W = mainHouse(SE, [[0, 0], [11.84, 0], [0.49, 11.35], [0, 11.35]], [[-9.99, 13.11], [-3.66, 19.5]], 8.3, 13.9, 48);
    cornice(wall(abUV(SE, 11.84, 0), abUV(SE, 0.49, 11.35), SE.C), 8.3);
    for (const t of [1.9, 7.1]) sash(W, t, 1.2, 1.3, 2.4);
    for (const t of [1.9, 4.5, 7.1]) sash(W, t, 5.2, 1.3, 2.3);
    W.box(4.5, 0, 0, 1.9, 3.5, 0.08, 'white');
    W.box(4.5, 0, 0.08, 1.5, 2.3, 0.05, 'red'); W.box(4.5, 0, 0.13, 0.05, 2.3, 0.03, 'white');
    for (const s of [-1, 1]) {
      W.put(new T.ExtrudeGeometry(arch(0.62, 2.45, 2.75), {depth: 0.05, bevelEnabled: false}), 4.5 + s * 0.38, 0, 0.08, 'glass');
      W.put(new T.TorusGeometry(0.31, 0.04, 3, 8, Math.PI), 4.5 + s * 0.38, 2.75, 0.12, 'white');
    }
    dormer(W, 4.5, 8.3);
    const wings: [UV[], number][] = [
      [[[-12.86, 10.29], [-15.98, 13.41], [-13.22, 16.24], [-9.99, 13.11]], 4.3],
      [[[-3.66, 19.5], [-6.89, 22.64], [-3.15, 26.36], [0.07, 23.24], [-1.19, 21.96], [-0.88, 21.64], [-1.44, 21.65]], 4.5],
    ];
    for (const [poly, hgt] of wings) block(poly, 0, hgt);
    for (const [P0, P1, inside, hgt] of [[[-15.98, 13.41], [-13.22, 16.24], [-12, 12], 4.3], [[-13.22, 16.24], [-9.99, 13.11], [-13, 13], 4.3],
      [[-3.66, 19.5], [-6.89, 22.64], [-3, 22], 4.5], [[-6.89, 22.64], [-3.15, 26.36], [-2, 22], 4.5]] as [UV, UV, UV, number][]) {
      const A = wall(P0, P1, inside); cornice(A, hgt); sash(A, A.L / 2, 1.0, 1.3, 2.4);
    }
  }

  // North-west, the kosterij: chamfered square to both gable planes; diagonal (25.39, -9.85) - (19.24, -16.0), 8.7 m, faces 302 deg
  // (panorama b_20241216_0911_Track34_Sphere_00026, Beeldbank "Kosterij (bijgebouw)" 2006). One-storey entrance block (5.8 m, 3DBAG flat
  // roof) across the diagonal with a sash, a small light, the pilastered cream doorcase with a gridded fanlight and a dark door, a small
  // light; the upper storey and its dormer stand 2.5 m back; the west end rises as a taller wing with large sashes on two floors and a
  // steep slate pyramid. t from the north end.
  {
    stats.cornerHouses!++;
    const k = 17.07, A = 11.62, B = 11.6, setback = 2.5 * Math.SQRT2, wingB = 9.3;
    const full: [number, number][] = [[0, 0], [A, 0], [A, k - A], [k - B, B], [0, B]];
    const toUV = (p: [number, number][]) => p.map(([a, bb]) => abUV(NW, a, bb));
    // Entrance block and ground storey: the plan short of the wing, walls on the exposed edges only.
    const low = clip(full.map(p => [p[0], p[1]] as UV), p => wingB - p[1]);
    block(toUV(low as [number, number][]), 0, 5.8);
    // Upper storey: behind the setback line and short of the wing.
    let upper: UV[] = full.map(p => [p[0], p[1]]);
    upper = clip(upper, p => (k - setback) - p[0] - p[1]); upper = clip(upper, p => wingB - p[1]);
    block(toUV(upper as [number, number][]), 5.8, 8.2, {eaves: eavesOf(upper, wingB), ridge: 13.7, slope: 46});
    // The entrance block's flat slate top is the lead roof in front of the upper storey.
    // Tall west wing.
    const wing = clip(full.map(p => [p[0], p[1]] as UV), p => p[1] - wingB);
    block(toUV(wing as [number, number][]), 0, 9.0, {eaves: wing.map((q0, i) => { const q1 = wing[(i + 1) % wing.length]; return !(q0[0] === 0 && q1[0] === 0); }), ridge: 12.4, slope: 60});
    const PN = abUV(NW, A, k - A), PW = abUV(NW, k - B, B), inner = NW.C;
    const G = wall(PN, PW, inner);
    // Entrance block front: cornice, sash, small lights, doorcase.
    const wingT = (A - (k - wingB)) * Math.SQRT2; // where the wing starts along the diagonal
    G.box(wingT / 2, 5.48, 0, wingT + 0.1, 0.32, 0.26, 'stone'); G.box(wingT / 2, 5.3, 0, wingT, 0.18, 0.12, 'white');
    sash(G, 1.2, 1.1, 1.45, 1.5, {cols: 4});
    for (const t of [2.65, 5.45]) sash(G, t, 1.3, 0.5, 0.9, {cols: 2});
    G.box(4.1, 0, 0, 2.3, 4.3, 0.12, 'stone');
    for (const s of [-1, 1]) G.box(4.1 + s * 1.0, 0, 0.12, 0.3, 4.0, 0.08, 'stone');
    G.box(4.1, 4.0, 0.12, 2.5, 0.35, 0.14, 'stone');
    G.box(4.1, 0, 0.12, 1.3, 2.6, 0.05, 'dark');
    G.box(4.1, 2.75, 0.12, 1.3, 1.15, 0.04, 'glass');
    for (let i = 1; i < 4; i++) G.box(4.1 - 0.65 + i * 1.3 / 4, 2.75, 0.16, 0.03, 1.15, 0.02, 'white');
    for (let i = 1; i < 3; i++) G.box(4.1, 2.75 + i * 1.15 / 3, 0.16, 1.3, 0.03, 0.02, 'white');
    // Upper front, set back: two small sashes and the dormer.
    const U = wall(abUV(NW, A - setback / 2, k - A - setback / 2), abUV(NW, k - B - setback / 2, B - setback / 2), inner);
    for (const t of [1.8, 4.3]) sash(U, t, 6.1, 1.2, 1.4);
    U.box((wingT - 2.5) / 2, 7.88, 0, wingT + 2.5, 0.32, 0.26, 'stone');
    dormer(U, 4.3, 8.2);
    // Wing: large sashes on two floors on the diagonal and on the west return.
    const wingMid = (wingT + G.L) / 2;
    sash(G, wingMid, 1.9, 1.45, 2.6, {cols: 4}); sash(G, wingMid, 5.9, 1.45, 2.4, {cols: 4});
    const Wret = wall(abUV(NW, k - B, B), abUV(NW, 0, B), inner);
    sash(Wret, Wret.L / 2, 1.9, 1.35, 2.6); sash(Wret, Wret.L / 2, 5.9, 1.35, 2.4);
    for (const Wx of [Wret]) Wx.box(Wx.L / 2, 8.68, 0, Wx.L + 0.2, 0.32, 0.26, 'stone');
    G.box((wingT + G.L) / 2, 8.68, 0, G.L - wingT + 0.2, 0.32, 0.26, 'stone');
    // North return on the north gable plane: the block's cornice continues.
    const Nret = wall(abUV(NW, A, 0), PN, inner);
    Nret.box(Nret.L / 2, 5.48, 0, Nret.L + 0.2, 0.32, 0.26, 'stone');
    sash(Nret, Nret.L / 2, 1.3, 1.2, 2.2);
  }
}
