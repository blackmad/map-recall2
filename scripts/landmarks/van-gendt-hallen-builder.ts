import type {BuildingTools} from './cultural-builders';
import {facePoly, wallBetween} from './worship-kit';
import type {Wall} from './worship-walls';
import {archWindows, setSink, slab, type Frame} from './nearbar-kit';

/**
 * Van Gendt Hallen (Hallen van Stork), Oostenburg: five parallel factory halls by A.L. van Gendt (1898-1910), 157 m long.
 * The BAG pand (0363100012169224) is a 157 x 83 m rectangle; 3DBAG's roofs there are noisy (a bulging arc, a flat cut-off), so the
 * halls are rebuilt as five clean gabled prisms on the BAG footprint, with ridge and eave heights read from the 3DBAG LoD2.2
 * wall tops and roof samples (ground = 0). Detail follows the 2018-2024 municipal panoramas:
 *  - end gables (NE and SW), one per hall: a stepped corbel frieze following the rake, pilasters, three tall rectangular
 *    multi-pane steel windows at mid height, a group of three small windows near the apex and a green loading door;
 *  - NW water front (hall 1): tall boarded openings under small arched upper windows between plinth, string course and cornice;
 *  - SE front (hall 5): 26 bays of tall round-arched windows in two storeys between brick pilasters;
 *  - a glazed lantern along every ridge.
 */
type P2 = [number, number];
const ne = wallBetween([2.69, -52.17], [59.79, 7.36], 20, [0.7216, -0.6921]);          // t = 0 at the east end, towards the north-west
/** Halls from the east (t along the NE end): span, ridge and eave heights. */
const HALLS: {a: number; c: number; ridge: number; eave: number; big: boolean}[] = [
  {a: 0, c: 19, ridge: 17.2, eave: 10.9, big: true},
  {a: 19, c: 35.6, ridge: 17.9, eave: 10.5, big: false},
  {a: 35.6, c: 51.2, ridge: 13.5, eave: 10.0, big: true},
  {a: 51.2, c: 66.9, ridge: 18.0, eave: 10.5, big: false},
  {a: 66.9, c: 82.5, ridge: 13.5, eave: 9.5, big: true},
];
// Gables are shallow segmental arcs (sagitta about 0.45 of the half-width, as in the panoramas); the crown keeps the 3DBAG ridge height.
for (const h of HALLS) h.eave = +(h.ridge - 0.45 * (h.c - h.a) / 2).toFixed(2);
const LONG = (ne.origin[0] + 110.43) * ne.n[0] + (ne.origin[1] - 56.77) * ne.n[1];   // distance between the two end planes
const ARC = 10;
/** Segmental-arc gable/roof profile: eave height at the hall edges, ridge at the crown; u is across the hall from its centre. */
const arcY = (h: {c: number; a: number; ridge: number; eave: number}, u: number) => {
  const half = (h.c - h.a) / 2, sag = h.ridge - h.eave, r = (half * half + sag * sag) / (2 * sag);
  return h.ridge - r + Math.sqrt(Math.max(0, r * r - u * u));
};
const at = (w: Wall, t: number): P2 => [w.origin[0] + w.tangent[0] * t, w.origin[1] + w.tangent[1] * t];
const NEW = 82.5;
const nwCorner = at(ne, NEW), seCorner = at(ne, 0);
/** Frames sit exactly on the prism walls: x along the wall, z out of it. */
const neF: Frame = {origin: seCorner, tangent: ne.tangent, n: ne.n};
const swF: Frame = {origin: [nwCorner[0] - ne.n[0] * LONG, nwCorner[1] - ne.n[1] * LONG], tangent: [-ne.tangent[0], -ne.tangent[1]], n: [-ne.n[0], -ne.n[1]]};
const nwF: Frame = {origin: nwCorner, tangent: [-ne.n[0], -ne.n[1]], n: ne.tangent};
const seF: Frame = {origin: [seCorner[0] - ne.n[0] * LONG, seCorner[1] - ne.n[1] * LONG], tangent: ne.n, n: [-ne.tangent[0], -ne.tangent[1]]};

/** A long thin slab cut into runs of at most 30 m (giant thin boxes are not welded by the GLB quality audit). */
function longSlab(b: BuildingTools, f: Frame, t0: number, t1: number, y: number, h: number, d: number, colour: string, out = 0) {
  const n = Math.ceil((t1 - t0) / 30), len = (t1 - t0) / n;
  for (let k = 0; k < n; k++) slab(b, f, t0 + (k + 0.5) * len, y, len + 0.02, h, d, colour, out);
}

/** Rectangular multi-pane steel window: dark frame, glass, mullions, stone sill. */
function steelWindow(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, cols: number, rows: number) {
  slab(b, f, t, y - 0.12, w + 0.5, 0.14, 0.2, 'stone');
  slab(b, f, t, y, w, h, 0.08, 'glass', 0.02);
  const fr = 0.07;
  slab(b, f, t - w / 2 + fr / 2, y, fr, h, 0.12, 'frame', 0.02);
  slab(b, f, t + w / 2 - fr / 2, y, fr, h, 0.12, 'frame', 0.02);
  slab(b, f, t, y, w, fr, 0.12, 'frame', 0.02);
  slab(b, f, t, y + h - fr, w, fr, 0.12, 'frame', 0.02);
  for (let k = 1; k < cols; k++) slab(b, f, t - w / 2 + (w * k) / cols, y, 0.05, h, 0.1, 'frame', 0.02);
  for (let k = 1; k < rows; k++) slab(b, f, t, y + (h * k) / rows - 0.025, w, 0.05, 0.1, 'frame', 0.02);
}

export function buildVanGendtHallen(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  // ---- five clean gabled prisms (ridges run from the NE end to the SW end) ----
  // Long faces are cut into panels of at most 15 m: the GLB quality audit cannot weld details onto giant triangles.
  const NSEG = Math.ceil(LONG / 15);
  const lerp = (p: P2, q: P2, u: number): P2 => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
  /** Panels between two lines running NE -> SW, each given as [NE point, height, SW point, height]. */
  const panel = (lineA: [P2, number, P2, number], lineB: [P2, number, P2, number], colour: string, out: number[], role?: 'roof', seg = NSEG) => {
    // lineX = [NE point, height there, SW point, height there]; panels are cut along the ridge direction
    for (let k = 0; k < seg; k++) {
      const u0 = k / seg, u1 = (k + 1) / seg;
      const a0 = lerp(lineA[0], lineA[2], u0), a1 = lerp(lineA[0], lineA[2], u1), b0 = lerp(lineB[0], lineB[2], u0), b1 = lerp(lineB[0], lineB[2], u1);
      const ya0 = lineA[1] + (lineA[3] - lineA[1]) * u0, ya1 = lineA[1] + (lineA[3] - lineA[1]) * u1, yb0 = lineB[1] + (lineB[3] - lineB[1]) * u0, yb1 = lineB[1] + (lineB[3] - lineB[1]) * u1;
      facePoly(b, [[a0[0], ya0, a0[1]], [a1[0], ya1, a1[1]], [b1[0], yb1, b1[1]], [b0[0], yb0, b0[1]]], colour, out, role);
    }
  };
  HALLS.forEach((h, i) => {
    const A = at(ne, h.a), C = at(ne, h.c), M = at(ne, (h.a + h.c) / 2);
    const sw2 = (q: P2): P2 => [q[0] - ne.n[0] * LONG, q[1] - ne.n[1] * LONG];
    const A2 = sw2(A), C2 = sw2(C), M2 = sw2(M);
    const nIn = [-ne.n[0], 0, -ne.n[1]];
    // gable ends: rectangle to the eave plus a segmental arc to the crown (NE faces +n, SW faces -n)
    const half = (h.c - h.a) / 2, pts: {u: number; y: number}[] = [];
    for (let k = 0; k <= ARC; k++) { const u = -half + (2 * half * k) / ARC; pts.push({u, y: arcY(h, u)}); }
    const at3 = (E: P2, Mm: P2, u: number): P2 => [Mm[0] + ne.tangent[0] * u, Mm[1] + ne.tangent[1] * u];
    const topNE = pts.map(q => { const c = at3(A, M, q.u); return [c[0], q.y, c[1]]; });
    // u runs from the SE side (u = -half, towards A) to the NW side (towards C)
    facePoly(b, [[A[0], 0, A[1]], [C[0], 0, C[1]], ...topNE.slice().reverse()], 'brick', [ne.n[0], 0, ne.n[1]]);
    const topSW = pts.map(q => { const c = at3(A2, M2, q.u); return [c[0], q.y, c[1]]; });
    facePoly(b, [[A2[0], 0, A2[1]], [C2[0], 0, C2[1]], ...topSW.slice().reverse()], 'brick', nIn);
    // curved roof: ARC strips from eave to crown to eave
    const roofSeg = Math.ceil(LONG / 26);
    for (let k = 0; k < ARC; k++) {
      const u0 = pts[k].u, u1 = pts[k + 1].u;
      const p0 = at3(A, M, u0), p1 = at3(A, M, u1), q0 = at3(A2, M2, u0), q1 = at3(A2, M2, u1);
      panel([p0, pts[k].y, q0, pts[k].y], [p1, pts[k + 1].y, q1, pts[k + 1].y], 'slate', [0, 1, 0], 'roof', roofSeg);
    }
    // exterior long walls
    if (i === 0) panel([A, 0, A2, 0], [A, h.eave, A2, h.eave], 'brick', [-ne.tangent[0], 0, -ne.tangent[1]]);
    if (i === HALLS.length - 1) panel([C, 0, C2, 0], [C, h.eave, C2, h.eave], 'brick', [ne.tangent[0], 0, ne.tangent[1]]);
    // wall between neighbouring halls of different eave height
    const nx = HALLS[i + 1];
    if (nx && Math.abs(nx.eave - h.eave) > 0.05) {
      const lo = Math.min(h.eave, nx.eave), hi = Math.max(h.eave, nx.eave), taller = h.eave > nx.eave ? 1 : -1;
      panel([C, lo, C2, lo], [C, hi, C2, hi], 'brick', [taller * ne.tangent[0], 0, taller * ne.tangent[1]]);
    }
  });
  b.mark?.('shell');
  setSink(0);

  // ---- glazed lanterns along the ridges ----
  for (const h of HALLS) {
    const f: Frame = {origin: at(ne, (h.a + h.c) / 2), tangent: [-ne.n[0], -ne.n[1]], n: [ne.tangent[0], ne.tangent[1]]};
    // frame runs along the ridge: t = distance from the NE end, out = towards the north-west side
    const L = LONG - 4;
    longSlab(b, f, 2, L, h.ridge - 0.35, 1.5, 0.9, 'glass', -0.45);
    longSlab(b, f, 2, L, h.ridge + 1.15, 0.12, 1.2, 'concrete', -0.6);
  }

  // ---- end gables ----
  const endGables = (fr: Frame, mirror: boolean) => {
    const W = NEW;
    HALLS.forEach(h => {
      const [a, c] = mirror ? [W - h.c, W - h.a] : [h.a, h.c];
      const mid = (a + c) / 2, half = (c - a) / 2;
      const rake = (t: number) => arcY(h, Math.max(-half, Math.min(half, t - mid)));
      // stepped corbel frieze: two staircase courses following each rake
      for (const sgn of [-1, 1]) {
        for (let s = 0.7; s < half - 1.0; s += 1.3) {
          const t = mid + sgn * s, base = rake(t + sgn * 0.45);
          for (const [drop, par] of [[0.75, 0], [1.6, 1]]) {
            const y = Math.round((base - drop - 0.1) / 0.3) * 0.3 + par * 0.15;
            slab(b, fr, t, y, 1.3, 0.2, 0.14, 'greyBrick');
          }
        }
      }
      // pilasters
      for (const t of [a + 0.45, c - 0.45]) {
        slab(b, fr, t, 0, 0.55, h.eave - 0.3, 0.14, 'greyBrick');
        slab(b, fr, t, h.eave - 0.45, 0.8, 0.18, 0.2, 'stone');
      }
      slab(b, fr, mid, 3.5, c - a - 1.8, 0.1, 0.1, 'stone');
      // three tall steel windows at mid height, loading door below the middle one
      const ww = Math.min(2.0, (c - a) * 0.12);
      steelWindow(b, fr, mid - (c - a) * 0.3, 4.3, ww, 4.4, 2, 4);
      steelWindow(b, fr, mid + (c - a) * 0.3, 4.3, ww, 4.4, 2, 4);
      steelWindow(b, fr, mid, 4.9, ww * 1.2, 4.0, 2, 4);
      for (const s of [-1, 1]) steelWindow(b, fr, mid + s * (c - a) * 0.3, 1.0, ww * 0.85, 1.9, 2, 2);
      slab(b, fr, mid, 0, 2.6, 3.4, 0.1, 'green', 0.02);
      slab(b, fr, mid, 3.4, 3.0, 0.2, 0.18, 'stone');
      // three small rectangular windows near the apex, the middle one larger
      const ys = Math.min(h.ridge - 4.4, h.eave + 0.6);
      steelWindow(b, fr, mid - 1.5, ys, 0.75, 1.3, 1, 2);
      steelWindow(b, fr, mid + 1.5, ys, 0.75, 1.3, 1, 2);
      steelWindow(b, fr, mid, ys, 1.0, 1.7, 1, 3);
    });
  };
  endGables(neF, false);
  endGables(swF, true);

  // ---- NW water front: tall boarded openings, small arched upper windows ----
  {
    const f = nwF, L = LONG;
    longSlab(b, f, 0, L, 0, 0.7, 0.12, 'stone');
    longSlab(b, f, 0, L, 5.3, 0.14, 0.1, 'stone');
    longSlab(b, f, 0, L, 9.55, 0.4, 0.2, 'greyBrick');
    const ts: number[] = [];
    for (let t = 2.0; t < L - 1.5; t += 3.6) ts.push(t);
    for (const t of ts) slab(b, f, t, 1.2, 1.9, 3.7, 0.1, 'dark', 0.02);
    archWindows(b, f, ts.map(t => t + 1.8), {y: 6.7, w: 0.9, h: 1.4, frame: 'frame', bars: 0, rows: 0});
  }
  // ---- SE front: two storeys of round-arched windows between pilasters ----
  {
    const f = seF, L = LONG, pitch = L / 26;
    longSlab(b, f, 0, L, 0, 0.6, 0.12, 'stone');
    longSlab(b, f, 0, L, 6.5, 0.14, 0.1, 'stone');
    longSlab(b, f, 0, L, 12.3, 0.4, 0.2, 'greyBrick');
    const ts: number[] = [];
    for (let k = 0; k < 26; k++) ts.push((k + 0.5) * pitch);
    archWindows(b, f, ts, {y: 1.4, w: 3.0, h: 4.8, frame: 'frame', bars: 1, rows: 2, sill: 'stone'});
    archWindows(b, f, ts, {y: 7.5, w: 2.6, h: 3.6, frame: 'frame', bars: 1, rows: 0});
    for (let k = 0; k <= 26; k++) slab(b, f, Math.min(L - 0.3, Math.max(0.3, k * pitch)), 0, 0.6, 12.2, 0.14, 'greyBrick');
  }
}
