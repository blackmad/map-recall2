import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {planarPolygon} from './worship-shell';
import type {Surface} from './worship-shell';
import {archSlab, put, setSink, slab} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import {facePoly} from './worship-kit';
import source from './waag-footprints.json';

/**
 * De Waag (Sint-Antoniespoort, 1488), Nieuwmarkt. One BAG pand: a steep-roofed central block 22.8 m long (bearing 154) with a
 * round corner turret at each end of both short sides, and a big round tower in the middle of each long side. Massing is the
 * 3DBAG LoD2.2 shell, walls only: its roof planes are too ragged to draw, so the roofs are rebuilt as clean slate planes on their
 * measured heights (see FRONT/REAR/DECK/SPIRE), and the turret cones (the shell lacks the south-west one) are rebuilt too.
 * Local frame (u, v) from the centre c0: u along bearing 154 (towards the Nieuwmarkt front), v along bearing 64.
 * Detail is measured by eye from the 2020-2025 municipal panoramas:
 *  - SSE front (u = 11.26): between the two front turrets, a zinc canopy over the terrace (in the shell), three openings at street
 *    level (a glazed entrance flanked by two red leaf doors), three four-light mullioned windows with red shutters above, a pale cornice;
 *  - NNW rear (u = -11.28): the stone gate arch (3 m span) with red leaf doors, a big eight-light window with shutters above it, a
 *    window each side, the two rear turrets on the corners;
 *  - ENE and WSW long sides: the big tower in the middle (stone bands, windows with shutters, a cream cornice and a slate cone), a stone
 *    gate arch on the north-west side of it, windows with shutters;
 *  - turrets: stone bands, a corbelled arcade of round arches under a cream cornice, narrow slit windows, slate cones.
 */
const C0: [number, number] = [-2.565, -4.815];
const rad = (d: number) => d * Math.PI / 180;
const EU: [number, number] = [Math.sin(rad(154)), -Math.cos(rad(154))];
const EV: [number, number] = [Math.sin(rad(64)), -Math.cos(rad(64))];
const world = (u: number, v: number): [number, number] => [C0[0] + EU[0] * u + EV[0] * v, C0[1] + EU[1] * u + EV[1] * v];
const frame = (n: [number, number], u: number, v: number): Frame => ({origin: world(u, v), tangent: [n[1], -n[0]], n});
const neg = (a: [number, number]): [number, number] => [-a[0], -a[1]];
const localU = (x: number, z: number) => (x - C0[0]) * EU[0] + (z - C0[1]) * EU[1];

// The four corner turrets (centre u, v, radius) and the two big towers.
const TURRETS: {u: number; v: number; r: number; top: number; apex: number; name: string}[] = [
  {name: 'S', u: 11.39, v: -5.92, r: 1.8, top: 10.7, apex: 16.9},
  {name: 'E', u: 11.37, v: 6.2, r: 1.74, top: 10.7, apex: 16.9},
  {name: 'N', u: -11.43, v: 6.47, r: 1.92, top: 12.9, apex: 17.3},
  {name: 'W', u: -11.33, v: -6.75, r: 1.87, top: 12.9, apex: 17.3},
];
const BIG = [{name: 'A', u: 1.64, v: -7.55, r: 3.57, top: 11.6}, {name: 'B', u: 1.52, v: 7.77, r: 3.71, top: 11.6}];

/**
 * Roofs, fitted to the 3DBAG roof planes (heights above local ground) and checked against the four panoramas:
 *  - front (SSE) block, the 1617 weigh house: a truncated hip, eaves 10.4 just over the front cornice, pitch 1.45, a flat lead top
 *    at 16.7 (3DBAG: top u 4.6..6.9, v -1.6..2.7) with a finial at each top corner and a shuttered dormer in the middle of the front;
 *  - rear (NNW) block over the gate: a hip with gentle sides (pitch 0.6, the 3DBAG 11.3..14.7 side planes) and a steep end over the
 *    NNW gate (pitch 2.1, 12.9..17.0), eaves 12.6, ridge 16.8;
 *  - a flat lead deck at 13.1 between the two big towers (3DBAG flat u -1.3..5.7);
 *  - the tall central spire over the old gate hall: an octagonal pyramid, apex 25.6 (3DBAG 25.4..25.7) at u -2.8, v 0.45, rising
 *    from the 13.1 deck at pitch 2.4 (3DBAG's four diagonal planes; the panoramas show a facet with a dormer on the WSW side).
 */
const FRONT = {u0: 0.25, u1: 11.3, v0: -5.75, v1: 6.67, eave: 10.4, pitch: 1.45, top: 16.7};
const REAR = {u0: -11.3, u1: -1.0, v0: -6.77, v1: 7.33, eave: 12.6, side: 0.6, end: 2.1, ridge: 16.8};
const DECK = {u0: -1.0, u1: 4.6, v0: -5.6, v1: 6.5, y: 13.1};
const SPIRE = {u: -2.8, v: 0.45, base: 13.1, apex: 25.6, pitch: 2.4};

export function buildWaag(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  setSink(0.2);
  // Shell walls only, clipped at each part's eaves (turret cornice, tower cornice, main eaves); the shell's roofs and the hip infill
  // above the eaves are 3DBAG artefacts, replaced below by clean slate roofs, so no brick shows above the eaves.
  const eaveAt = (x: number, z: number) => {
    for (const t of TURRETS) { const [cx, cz] = world(t.u, t.v); if (Math.hypot(x - cx, z - cz) < t.r + 0.7) return t.top - 0.2; }
    for (const t of BIG) { const [cx, cz] = world(t.u, t.v); if (Math.hypot(x - cx, z - cz) < t.r + 0.7) return t.top - 0.3; }
    const u = localU(x, z);
    return u > DECK.u1 ? FRONT.eave : u > REAR.u1 ? DECK.y : REAR.eave;
  };
  for (const surf of (source as {surfaces: Surface[]}).surfaces) {
    if (surf.type !== 'WallSurface') continue;
    const g = planarPolygon(surf.rings);
    if (!g) continue;
    const pos = g.getAttribute('position'), idx = g.getIndex()!, out: number[] = [];
    for (let k = 0; k < idx.count; k += 3) {
      const P = [0, 1, 2].map(j => [pos.getX(idx.getX(k + j)), pos.getY(idx.getX(k + j)), pos.getZ(idx.getX(k + j))]);
      const cx = (P[0][0] + P[1][0] + P[2][0]) / 3, cz = (P[0][2] + P[1][2] + P[2][2]) / 3, h = eaveAt(cx, cz);
      const poly: number[][] = [];
      for (let j = 0; j < 3; j++) {
        const A = P[j], B = P[(j + 1) % 3], ia = A[1] <= h, ib = B[1] <= h;
        if (ia) poly.push(A);
        if (ia !== ib) { const q = (h - A[1]) / (B[1] - A[1]); poly.push([A[0] + (B[0] - A[0]) * q, h, A[2] + (B[2] - A[2]) * q]); }
      }
      for (let j = 1; j + 1 < poly.length; j++) out.push(...poly[0], ...poly[j], ...poly[j + 1]);
    }
    if (!out.length) continue;
    const cg = new T.BufferGeometry();
    cg.setAttribute('position', new T.Float32BufferAttribute(out, 3));
    cg.computeVertexNormals();
    b.add(cg, 'brick' as never);
  }
  // ---- roofs ----
  const P = (u: number, v: number, y: number) => { const [x, z] = world(u, v); return [x, y, z]; };
  const up = (n: [number, number], k: number) => [n[0], k, n[1]];
  /** Hipped roof over the (u, v) rectangle: each edge rises at its own pitch to the inner rectangle at height `top`, which is a flat
   * lead cap when it has area. Insets are clamped so opposite slopes meet at a ridge instead of crossing. */
  const hip = (u0: number, u1: number, v0: number, v1: number, eave: number, top: number, pu0: number, pu1: number, pv0: number, pv1: number) => {
    const h = top - eave;
    let a0 = h / pu0, a1 = h / pu1, b0 = h / pv0, b1 = h / pv1;
    if (a0 + a1 > u1 - u0) { const k = (u1 - u0) / (a0 + a1); a0 *= k; a1 *= k; }
    if (b0 + b1 > v1 - v0) { const k = (v1 - v0) / (b0 + b1); b0 *= k; b1 *= k; }
    const iu0 = u0 + a0, iu1 = u1 - a1, iv0 = v0 + b0, iv1 = v1 - b1;
    facePoly(b, [P(u1, v0, eave), P(u1, v1, eave), P(iu1, iv1, top), P(iu1, iv0, top)], 'slate', up(EU, 1), 'roof');
    facePoly(b, [P(u0, v1, eave), P(u0, v0, eave), P(iu0, iv0, top), P(iu0, iv1, top)], 'slate', up(neg(EU), 1), 'roof');
    facePoly(b, [P(u1, v1, eave), P(u0, v1, eave), P(iu0, iv1, top), P(iu1, iv1, top)], 'slate', up(EV, 1), 'roof');
    facePoly(b, [P(u0, v0, eave), P(u1, v0, eave), P(iu1, iv0, top), P(iu0, iv0, top)], 'slate', up(neg(EV), 1), 'roof');
    if (iu1 - iu0 > 0.05 && iv1 - iv0 > 0.05) facePoly(b, [P(iu0, iv0, top), P(iu1, iv0, top), P(iu1, iv1, top), P(iu0, iv1, top)], 'slate', [0, 1, 0], 'roof');
    return {iu0, iu1, iv0, iv1};
  };
  {
    const F = FRONT, k = F.pitch;
    const t = hip(F.u0, F.u1, F.v0, F.v1, F.eave, F.top, k, k, k, k);
    // finials on the four top corners
    for (const [u, v] of [[t.iu0, t.iv0], [t.iu0, t.iv1], [t.iu1, t.iv0], [t.iu1, t.iv1]]) {
      const [x, z] = world(u, v);
      b.add(new T.CylinderGeometry(0.05, 0.08, 0.7, 6).translate(x, F.top + 0.35, z), 'gold' as never);
      b.add(new T.SphereGeometry(0.11, 8, 6).translate(x, F.top + 0.75, z), 'gold' as never);
    }
  }
  { const R = REAR; hip(R.u0, R.u1, R.v0, R.v1, R.eave, R.ridge, R.end, R.end, R.side, R.side); }
  {
    // the deck runs the full width behind the front roof, and over it only where the front roof's side slopes are below the deck
    const D = DECK, F = FRONT, rise = (D.y - F.eave) / F.pitch;
    const rect = (u0: number, u1: number, v0: number, v1: number) =>
      facePoly(b, [P(u0, v0, D.y), P(u1, v0, D.y), P(u1, v1, D.y), P(u0, v1, D.y)], 'slate', [0, 1, 0], 'roof');
    rect(D.u0, F.u0, D.v0, D.v1);
    rect(F.u0, D.u1, F.v0 + rise, F.v1 - rise);
  }
  {
    const S = SPIRE, apo = (S.apex - S.base) / S.pitch, rr = apo / Math.cos(Math.PI / 8), apex = P(S.u, S.v, S.apex);
    for (let k = 0; k < 8; k++) {
      const a0 = (k - 0.5) * Math.PI / 4, a1 = (k + 0.5) * Math.PI / 4, am = k * Math.PI / 4;
      const n: [number, number] = [EU[0] * Math.cos(am) + EV[0] * Math.sin(am), EU[1] * Math.cos(am) + EV[1] * Math.sin(am)];
      facePoly(b, [P(S.u + rr * Math.cos(a0), S.v + rr * Math.sin(a0), S.base), P(S.u + rr * Math.cos(a1), S.v + rr * Math.sin(a1), S.base), apex], 'slate', up(n, 1 / S.pitch), 'roof');
    }
    const [x, z] = world(S.u, S.v);
    b.add(new T.CylinderGeometry(0.06, 0.1, 1.6, 6).translate(x, S.apex + 0.8, z), 'gold' as never);
    b.add(new T.SphereGeometry(0.16, 8, 6).translate(x, S.apex + 0.5, z), 'gold' as never);
  }
  b.mark?.('shell');

  const quad = (f: Frame, t: number, y: number, w: number, h: number, out: number, colour: string) =>
    put(b, f, new T.PlaneGeometry(w, h).translate(0, h / 2, 0), t, y, out, colour);
  const archQuad = (f: Frame, t: number, y: number, w: number, h: number, out: number, colour: string) => {
    const s = new T.Shape(), r = w / 2;
    s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r); s.absarc(0, h - r, r, 0, Math.PI, false); s.lineTo(-r, 0);
    put(b, f, new T.ShapeGeometry(s, 6), t, y, out, colour);
  };
  /** Mullioned window: cream frame, glass, a centre post and a transom, red shutters either side, stone sill. */
  const win = (f: Frame, t: number, y: number, w: number, h: number, shutters: boolean | -1 | 1 = true, lights = 2) => {
    slab(b, f, t, y - 0.1, w + 0.3, h + 0.2, 0.06, 'frame');
    quad(f, t, y, w, h, 0.09, 'glass');
    for (let k = 1; k < lights; k++) quad(f, t - w / 2 + w * k / lights, y, 0.06, h, 0.12, 'frame');
    quad(f, t, y + h * 0.5 - 0.03, w, 0.06, 0.12, 'frame');
    slab(b, f, t, y - 0.2, w + 0.5, 0.1, 0.16, 'stone');
    if (shutters) for (const s of shutters === true ? [-1, 1] : [shutters]) slab(b, f, t + s * (w / 2 + 0.3), y - 0.05, 0.42, h + 0.1, 0.07, 'red', 0.02);
  };
  /** Round-headed stone gate: stone surround, dark opening and two red leaf doors folded back against the wall. */
  const gate = (f: Frame, t: number, w: number, h: number, leaves = true) => {
    archQuad(f, t, 0, w + 1.0, h + 0.5, 0.06, 'sandstone');
    archQuad(f, t, 0, w, h, 0.1, 'dark');
    quad(f, t, 0, w - 0.5, h * 0.55, 0.13, 'glass');
    if (leaves) for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 + 0.85), 0.2, 1.3, h - 0.9, 0.07, 'red', 0.04);
  };
  const band = (cx: number, cz: number, r: number, y: number, h: number, colour: string, over = 0.12) =>
    b.add(new T.CylinderGeometry(r + over, r + over, h, 28).translate(cx, y + h / 2, cz), colour as never);

  // ---- turrets ----
  for (const t of TURRETS) {
    const [cx, cz] = world(t.u, t.v);
    for (const y of [2.2, 4.8, 7.4]) band(cx, cz, t.r, y, 0.3, 'sandstone');
    band(cx, cz, t.r, t.top - 1.7, 0.35, 'sandstone', 0.2);
    // corbelled arcade of round arches under the cornice
    const n = 10;
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2, nx = Math.sin(a), nz = Math.cos(a);
      const f: Frame = {origin: [cx + nx * (t.r + 0.01), cz + nz * (t.r + 0.01)], tangent: [nz, -nx], n: [nx, nz]};
      archQuad(f, 0, t.top - 1.35, 0.5, 0.8, 0.02, 'greyBrick');
    }
    // cream cornice and the slate cone with a gilt finial
    b.add(new T.CylinderGeometry(t.r + 0.5, t.r + 0.5, 0.45, 28).translate(cx, t.top - 0.2, cz), 'stone' as never);
    b.add(new T.ConeGeometry(t.r + 0.45, t.apex - t.top - 0.1, 28).translate(cx, t.top + 0.25 + (t.apex - t.top - 0.1) / 2, cz), 'slate' as never);
    b.add(new T.SphereGeometry(0.16, 8, 6).translate(cx, t.apex + 0.1, cz), 'gold' as never);
    // slit windows
    for (const a of t.name === 'S' || t.name === 'E' ? [rad(154)] : [rad(334)]) {
      const nx = Math.sin(a), nz = -Math.cos(a), f: Frame = {origin: [cx + nx * t.r, cz + nz * t.r], tangent: [nz, -nx], n: [nx, nz]};
      archSlab(b, f, 0, 6.2, 0.45, 1.1, 0.05, 'dark');
    }
  }

  // ---- big towers: bands, a cream cornice below the cone, windows with shutters on the outward half ----
  for (const t of BIG) {
    const [cx, cz] = world(t.u, t.v), s = Math.sign(t.v);
    setSink(0.5);   // flat frames on a round wall: the chord edges stand off the cylinder, so the backs go deeper
    for (const y of [1.9, 4.3, 6.7, 9.1]) band(cx, cz, t.r, y, 0.3, 'sandstone');
    band(cx, cz, t.r, t.top - 0.3, 0.5, 'stone', 0.3);
    // octagonal slate roof to the 3DBAG apex (20.0), flaring a little over the cornice
    const hc = 20.0 - (t.top + 0.2);
    b.add(new T.ConeGeometry(t.r + 0.7, hc, 8).rotateY(rad(-154) + Math.PI / 8).translate(cx, t.top + 0.2 + hc / 2, cz), 'slate' as never);
    b.add(new T.SphereGeometry(0.16, 8, 6).translate(cx, 20.1, cz), 'gold' as never);
    for (const [da, y] of [[-0.5, 4.8], [0.5, 4.8], [-0.55, 7.4], [0.55, 7.4]] as [number, number][]) {
      const a = rad(s > 0 ? 64 : 244) + da, nx = Math.sin(a), nz = -Math.cos(a);
      const f: Frame = {origin: [cx + nx * t.r, cz + nz * t.r], tangent: [nz, -nx], n: [nx, nz]};
      win(f, 0, y, 0.8, 1.3, true, 2);
    }
    setSink(0.2);
  }

  // ---- SSE front: u = 11.26, t = v ----
  {
    const f = frame(EU, 11.26, 0);
    for (const t of [-2.7, 0, 2.7]) win(f, t + 0.1, 5.9, 1.55, 2.1, true, 4);
    for (const t of [-2.3, 2.3]) slab(b, f, t + 0.1, 0.0, 1.35, 2.6, 0.08, 'red', 0.03);
    archSlab(b, f, 0.1, 0.0, 1.8, 2.7, 0.09, 'dark', 0.03);
    quad(f, 0.1, 0.1, 1.4, 2.0, 0.14, 'glass');
    slab(b, f, 0.1, 9.9, 8.9, 0.5, 0.45, 'stone');
    // zinc canopy of the terrace: a sloping plane from the wall (5.1 m) out to a lip 2.7 m in front (3.4 m), with two hip triangles
    const P = (t: number, y: number, out: number) => [f.origin[0] + f.tangent[0] * t + f.n[0] * out, y, f.origin[1] + f.tangent[1] * t + f.n[1] * out];
    const t0 = -4.4, t1 = 4.5;
    facePoly(b, [P(t0, 5.1, 0), P(t1, 5.1, 0), P(t1 + 0.6, 3.4, 2.7), P(t0 - 0.6, 3.4, 2.7)], 'concrete', [f.n[0], 1, f.n[1]], 'roof');
    facePoly(b, [P(t0, 5.1, 0), P(t0 - 0.6, 3.4, 2.7), P(t0, 3.4, 0)], 'concrete', [-f.tangent[0], 0, -f.tangent[1]]);
    facePoly(b, [P(t1, 5.1, 0), P(t1, 3.4, 0), P(t1 + 0.6, 3.4, 2.7)], 'concrete', [f.tangent[0], 0, f.tangent[1]]);
    slab(b, f, 0, 3.15, 10.2, 0.25, 0.2, 'sandstone', 2.55);
  }
  // ---- NNW rear: u = -11.28, t = -v ----
  {
    const f = frame(neg(EU), -11.28, 0);
    gate(f, 0, 1.9, 3.5);
    win(f, 0, 5.9, 2.2, 1.6, true, 4);
    for (const t of [-3.9, 3.9]) { win(f, t, 1.2, 1.0, 1.5, true, 2); win(f, t, 3.8, 1.0, 1.5, true, 2); win(f, t, 6.4, 1.0, 1.6, true, 2); }
    slab(b, f, 0, REAR.eave - 0.5, 10.2, 0.5, 0.45, 'stone');
  }
  // ---- ENE long side (v = +): north segment u -9.9..-3.7 at v = 7.33, south segment u 4.7..9.6 at v = 6.67; t = -u ----
  {
    const fn = frame(EV, 0, 7.33), fs = frame(EV, 0, 6.67);
    gate(fn, 6.7, 2.0, 3.6, true);
    win(fn, 6.0, 5.6, 1.0, 1.7, -1, 2); win(fn, 7.4, 5.6, 1.0, 1.7, 1, 2);
    win(fs, -7.1, 2.6, 1.0, 1.7, true, 2);
    win(fs, -7.1, 6.3, 1.3, 1.9, true, 2);
    slab(b, fn, 6.8, REAR.eave - 0.5, 6.2, 0.5, 0.4, 'stone');
    slab(b, fs, -7.1, FRONT.eave - 0.5, 4.9, 0.5, 0.4, 'stone');
  }
  // ---- WSW long side (v = -): north segment u -9.9..-2.8 at v = -6.77, south segment u 4.7..9.4 at v = -5.75; t = u ----
  {
    const fn = frame(neg(EV), 0, -6.77), fs = frame(neg(EV), 0, -5.75);
    gate(fn, -6.4, 2.0, 3.6, true);
    win(fn, -7.1, 5.6, 1.0, 1.7, -1, 2); win(fn, -5.7, 5.6, 1.0, 1.7, 1, 2);
    win(fn, -3.5, 6.0, 1.0, 1.8, true, 2);
    win(fs, 7.0, 2.6, 1.0, 1.7, true, 2);
    win(fs, 7.0, 6.3, 1.3, 1.9, true, 2);
    slab(b, fn, -6.4, REAR.eave - 0.5, 7.0, 0.5, 0.4, 'stone');
    slab(b, fs, 7.0, FRONT.eave - 0.5, 4.7, 0.5, 0.4, 'stone');
  }
  // ---- dormers: brick front with a shuttered window and a thin slate cap, set back into the slope so the cap ends inside the roof ----
  /** `f` lies on the eave line of a roof plane rising inward at `pitch` from `eave`; the window sill is at `y`. */
  const dormer = (f: Frame, t: number, eave: number, pitch: number, y: number, w: number, h: number, lights = 2) => {
    const d0 = (y - 0.35 - eave) / pitch, top = y + h + 0.3, depth = (top + 0.4 - eave) / pitch - d0 + 0.3;
    const ff: Frame = {...f, origin: [f.origin[0] - f.n[0] * d0, f.origin[1] - f.n[1] * d0]};
    slab(b, ff, t, y - 0.7, w + 0.7, top - y + 0.7, depth, 'brick', -depth);
    win(ff, t, y, w, h, true, lights);
    slab(b, ff, t, top - 0.16, w + 0.85, 0.16, 0.2, 'stone');
    slab(b, ff, t, top, w + 1.0, 0.18, depth + 0.28, 'slate', -depth);
  };
  dormer(frame(EU, FRONT.u1, 0), 0.1, FRONT.eave, FRONT.pitch, 11.1, 1.5, 1.9, 4);   // SSE, above the three front windows
  dormer(frame(EV, 0, FRONT.v1), -7.4, FRONT.eave, FRONT.pitch, 11.0, 0.9, 1.3);      // ENE side of the weigh house
  dormer(frame(neg(EV), 0, FRONT.v0), 7.4, FRONT.eave, FRONT.pitch, 11.0, 0.9, 1.3);  // WSW side of the weigh house
  dormer(frame(EV, 0, REAR.v1), 7.6, REAR.eave, REAR.side, 13.1, 0.8, 1.1);          // ENE side of the gate block
  {
    const apo = (SPIRE.apex - SPIRE.base) / SPIRE.pitch;
    dormer(frame(neg(EV), SPIRE.u, SPIRE.v - apo), 0, SPIRE.base, SPIRE.pitch, 17.6, 0.8, 1.2);   // WSW facet of the spire
  }
  setSink(0);
  void facePoly;
}
