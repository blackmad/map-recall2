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

export interface NoorderkerkStats {arms: number; windows: number; roundels: number; turret: boolean}

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
    // Basement: two rows of small windows and a plank door.
    for (const [t, y0] of [[-5.3, 3.0], [-2.6, 3.0], [2.6, 3.0], [5.3, 3.0], [-5.3, 1.0], [5.3, 1.0]] as [number, number][]) {
      box(t, y0 - 0.12, 0, 1.55, 1.3, 0.06, 'stone'); box(t, y0, 0.06, 1.25, 1.06, 0.05, 'glass');
      box(t, y0 + 0.5, 0.11, 1.25, 0.04, 0.03, 'white'); box(t, y0, 0.11, 0.04, 1.06, 0.03, 'white');
    }
    box(0, 0, 0, 1.9, 2.8, 0.1, 'stone'); box(0, 0, 0.1, 1.5, 2.55, 0.05, 'dark');
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
}
