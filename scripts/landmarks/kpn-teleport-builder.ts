import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {letters, slab, type Frame} from './nearbar-kit';
import {trayStack, type P2, type Rect, type TrayPlan, type TrayRecess} from '../../src/canalRecall/landmarks/trayStack';

/**
 * KPN office, Teleportboulevard 121-135, Sloterdijk / Teleport (BAG pand 0363100012165158: construction started 2010-09/11, in use
 * 2014-02, oorspronkelijk bouwjaar 2014, eight bouwlagen -1..6, eight office units, kantoorfunctie). nl.wikipedia: "Kingsfordweg"
 * names a KPN office on the west side of the street; "XS4ALL" gives Teleportboulevard 121 as the head office of KPN's internet
 * brand. Design: de Jong Gortemaker Algra architects (ArchDaily 493166, "KPN Dutch Telecom Company"), developer OVG.
 *
 * Native frame of scripts/landmarks/kpn-teleport-footprints.json (x east, z south, y up from the 3DBAG ground 0.856 m NAP; origin
 * = vertex average of the BAG ring). The plan is a 60.1 x 84.15 m rectangle turned 0.23 degrees clockwise: a along the north
 * face to the east, b along the west face to the south, origin the north-west BAG corner. The middle third of the north face
 * (a 20.43-39.48) stands 1.08 m back (BAG ring). The 3DBAG LoD2.2 roof parts (CC BY 4.0) give the main roof at 28.85 m and a
 * courtyard deck at 3.1 m, a 16.7-43.3 / b 16.45-66.95, over the car park.
 *
 * Section, measured on the rectified Gemeente Amsterdam panorama crops (CC BY 4.0; w04-360 at 50 px/m): a half-sunken car park
 * behind a row of round columns (0-2.2 m) and its slab edge (2.2-3.0), a tall glazed ground storey (3.0-6.2, a transom at 4.0)
 * under its slab edge (6.2-7.0), then six office storeys of 3.6 m: a lavender spandrel panel (0.8), a glazed ribbon (2.0) on a
 * 3.6 m mullion module (a wide light, a narrow vent light, a wide light), and the dark anthracite slab edge (0.8). Every face
 * pulls single storeys back 3 m behind the slab edge (loggias on round columns), two corners open two storeys high behind
 * horizontal louvres, and the entrance on the Teleportboulevard is a three-storey glazed hall up a flight of steps under two
 * louvre banks. Per face and storey in kpn-teleport-inventory.json and RECESSES below.
 */
type Col = Parameters<BuildingTools['add']>[1];

// ---- plan frame -----------------------------------------------------------------------------------------------------------
const O: P2 = [-25.614, -29.557], E: P2 = [0.999992, -0.003945], S: P2 = [0.003945, 0.999992];
const X = (a: number, b: number): P2 => [O[0] + a * E[0] + b * S[0], O[1] + a * E[1] + b * S[1]];
const VEC = (va: number, vb: number): P2 => [va * E[0] + vb * S[0], va * E[1] + vb * S[1]];
const A = 60.1, B = 84.15, NOTCH = {a0: 20.43, a1: 39.48, d: 1.08};
const COURT: Rect = {a0: 16.7, a1: 43.3, b0: 16.45, b1: 66.95};
const D = 3.0, PITCH = 3.6;

// ---- storeys: P (car park), L0 (ground), L1-L6 -------------------------------------------------------------------------------
const LEVELS = [
  {name: 'P', y0: 0, glassTop: 2.2, y1: 3.0},
  {name: 'L0', y0: 3.0, glassTop: 6.2, y1: 7.0},
  ...[1, 2, 3, 4, 5].map(i => ({name: `L${i}`, y0: 7 + 3.6 * (i - 1), glassTop: 7 + 3.6 * (i - 1) + 2.8, y1: 7 + 3.6 * i})),
  {name: 'L6', y0: 25.0, glassTop: 27.8, y1: 28.85},
];
const P = 0, L0 = 1, L2 = 3, L4 = 5, L5 = 6;
const SPANDREL = (k: number) => (k >= 2 ? 0.8 : 0);

/** A strip along the north face from a0 to a1, depth d behind the face (which steps back 1.08 m in the middle third). */
function north(a0: number, a1: number, d: number): Rect[] {
  const cuts = [a0, ...[NOTCH.a0, NOTCH.a1].filter(x => x > a0 && x < a1), a1];
  return cuts.slice(0, -1).map((x, i) => {
    const mid = (x + cuts[i + 1]) / 2, back = mid > NOTCH.a0 && mid < NOTCH.a1 ? NOTCH.d : 0;
    return {a0: x, a1: cuts[i + 1], b0: 0, b1: back + d};
  });
}
const east = (b0: number, b1: number, d: number): Rect => ({a0: A - d, a1: A, b0, b1});
const south = (a0: number, a1: number, d: number): Rect => ({a0, a1, b0: B - d, b1: B});
const west = (b0: number, b1: number, d: number): Rect => ({a0: 0, a1: d, b0, b1});
const many = (rs: Rect[], levels: number[], extra: Partial<TrayRecess> = {}): TrayRecess[] => rs.map(rect => ({rect, levels, ...extra}));

/**
 * Recesses per face, in face coordinates read off the crops (viewer-left origin: N from the east corner, E from the south,
 * S from the west, W from the north) and converted to (a, b) here.
 */
const ENTRANCE = {a0: 23.7, a1: 36.3, depth: 4.3};
/**
 * Column positions read off the crops. North face (a): w05 (west third) 2.5-19.9 on a 3.5 m pitch, w06 (middle) an irregular
 * four at 23.4, 27.3, 33.2, 37.2, w04 (east third) 40.1-57.6; the colonnade, the L2 and L4 loggias and the north-west void
 * share them. South face (a): w03, the L4 loggia's thirteen from 2.4 m and the south-east void's three, the L2 loggia's first six.
 */
const NCOLS = [2.5, 6.0, 9.4, 12.9, 16.4, 19.9, 23.4, 27.3, 33.2, 37.2, 40.1, 43.7, 47.3, 50.7, 54.1, 57.6];
const SCOLS = [2.4, 6.05, 9.55, 13.1, 16.7, 20.4, 23.9, 27.4, 30.9, 34.4, 37.9, 41.4, 44.9, 50.3, 53.8, 57.3];
const RECESSES: TrayRecess[] = [
  // car park: the glass line (here dark car-park openings) 1.5 m behind a row of round columns on every face (w01, w04, w05)
  // (not on the south face: there the street is higher and the car park shows as a low dark strip on the wall line, w03)
  ...many(north(0, A, 1.5), [P], {columns: NCOLS}), ...many([east(0, B, 1.5), west(0, B, 1.5)], [P]),
  // north face, west two thirds (u 20.6-60 from the east, w05 + w06) and the west face's first 25 m (Commons 2021): car park and
  // ground storey behind one colonnade of storey-and-a-half columns, no slab between them
  ...many(north(0, 39.5, D), [P, L0], {open: true, columns: NCOLS}), ...many([west(0, 25, D)], [P, L0], {open: true}),
  // north face L2 recessed over its east 24 m (w04 full width, w06 its east 3.7 m)
  ...many(north(A - 24, A, D), [L2], {columns: NCOLS}),
  // L4 recessed along the whole north face (w04, w06, w05) and the whole south face (w03), and the north 18 m of the east face (w01)
  ...many(north(0, A, D), [L4], {columns: NCOLS}), ...many([south(0, A, D)], [L4], {columns: SCOLS}), ...many([east(0, 17.85, D)], [L4]),
  // the north-west corner open through L4 and L5: north face u 47.8-60 (w05), west face 0-25 m (Commons 2021, XS4ALL sign)
  ...many(north(0, 12.3, D), [L4, L5], {open: true, columns: NCOLS}), ...many([west(0, 25, D)], [L4, L5], {open: true}),
  // the south-east corner open through L4 and L5: south face u 47.5-60 (w03), east face 0-15 m from the south (w01)
  ...many([south(47.5, A, D)], [L4, L5], {open: true, columns: SCOLS}), ...many([east(B - 15, B, D)], [L4, L5], {open: true}),
  // south face L2 recessed over its west 22.3 m (w03); east face L2 recessed 18-60 m from the south (w01)
  ...many([south(0, 22.3, D)], [L2], {columns: SCOLS}), ...many([east(B - 60, B - 18, D)], [L2]),
  // the entrance hall: car park to L2 open, 4.3 m deep, four round columns on the slab edge (w03)
  {rect: south(ENTRANCE.a0, ENTRANCE.a1, ENTRANCE.depth), levels: [P, L0, 2, L2], open: true, columns: [23.95, 27.4, 32.6, 36.05]},
];
export const KPN_TELEPORT_PLAN: TrayPlan = {
  outer: [{a0: 0, a1: NOTCH.a0, b0: 0, b1: B}, {a0: NOTCH.a0, a1: NOTCH.a1, b0: NOTCH.d, b1: B}, {a0: NOTCH.a1, a1: A, b0: 0, b1: B}],
  holes: [{rect: COURT, levels: [1, 2, 3, 4, 5, 6, 7]}],
  levels: LEVELS,
  recesses: RECESSES,
};

// ---- triangle accumulation in native coordinates ------------------------------------------------------------------------------
let ACC = new Map<Col, number[]>();
type V3 = [number, number, number];
const v3 = (a: number, b: number, y: number): V3 => { const p = X(a, b); return [p[0], y, p[1]]; };
function tri(c: Col, p: V3, q: V3, r: V3, want: V3) {
  const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const arr = ACC.get(c) ?? []; ACC.set(c, arr);
  if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] >= 0) arr.push(...p, ...q, ...r); else arr.push(...p, ...r, ...q);
}
const quad = (c: Col, p: V3, q: V3, r: V3, s: V3, want: V3) => { tri(c, p, q, r, want); tri(c, p, r, s, want); };
/** Native outward vector of a plan normal (a, b). */
const nOut = (n: P2): V3 => { const w = VEC(n[0], n[1]); return [w[0], 0, w[1]]; };
function flush(b: BuildingTools) {
  for (const [c, pos] of ACC) {
    if (!pos.length) continue;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); b.add(g, c);
  }
  ACC = new Map();
}

/** A vertical rectangle on a plan line from p to q (plan), at offset `o` along the outward normal n, between y0 and y1. */
function wallQuad(c: Col, p: P2, q: P2, n: P2, o: number, y0: number, y1: number) {
  const P0: P2 = [p[0] + n[0] * o, p[1] + n[1] * o], Q0: P2 = [q[0] + n[0] * o, q[1] + n[1] * o];
  quad(c, v3(P0[0], P0[1], y0), v3(Q0[0], Q0[1], y0), v3(Q0[0], Q0[1], y1), v3(P0[0], P0[1], y1), nOut(n));
}
/** Horizontal strip between offsets o0 and o1 off the line p-q at height y, facing up or down. */
function ledge(c: Col, p: P2, q: P2, n: P2, o0: number, o1: number, y: number, up: boolean) {
  const at = (r: P2, o: number) => v3(r[0] + n[0] * o, r[1] + n[1] * o, y);
  quad(c, at(p, o0), at(q, o0), at(q, o1), at(p, o1), [0, up ? 1 : -1, 0]);
}
/**
 * Vertical fin (a mullion or a glazing bar seen edge-on): front at `front`, sides back to `back`, width w, no end faces (its top
 * and bottom die into the slab-edge bands, so end faces would only lie coplanar with the band caps).
 */
function fin(c: Col, at: P2, t: P2, n: P2, back: number, front: number, w: number, y0: number, y1: number) {
  const l: P2 = [at[0] - t[0] * w / 2, at[1] - t[1] * w / 2], r: P2 = [at[0] + t[0] * w / 2, at[1] + t[1] * w / 2];
  wallQuad(c, l, r, n, front, y0, y1);
  const side = (s: P2, dir: P2) => { const p: P2 = [s[0] + n[0] * back, s[1] + n[1] * back], q: P2 = [s[0] + n[0] * front, s[1] + n[1] * front]; quad(c, v3(p[0], p[1], y0), v3(q[0], q[1], y0), v3(q[0], q[1], y1), v3(p[0], p[1], y1), nOut(dir)); };
  side(l, [-t[0], -t[1]]); side(r, t);
}
/** Closed box on a plan frame: centre at `at` + n*o, length across n, depth along n. */
function planBox(c: Col, at: P2, n: P2, o: number, len: number, depth: number, y0: number, h: number) {
  const ang = Math.atan2(VEC(n[0], n[1])[0], VEC(n[0], n[1])[1]);
  const p = X(at[0] + n[0] * o, at[1] + n[1] * o), g = new T.BoxGeometry(len, h, depth);
  g.rotateY(ang); g.translate(p[0], y0 + h / 2, p[1]);
  const pos = g.toNonIndexed().getAttribute('position').array, arr = ACC.get(c) ?? []; ACC.set(c, arr);
  for (let i = 0; i < pos.length; i++) arr.push(pos[i]);
}
/** A plan rectangle as a horizontal cap (up = roof, floor; down = soffit). */
function cap(c: Col, r: Rect, y: number, up: boolean) {
  quad(c, v3(r.a0, r.b0, y), v3(r.a1, r.b0, y), v3(r.a1, r.b1, y), v3(r.a0, r.b1, y), [0, up ? 1 : -1, 0]);
}

// ---- the stack ----------------------------------------------------------------------------------------------------------------
const GLASS_IN = 0.12, BAND_OUT = 0.1, POST = 0.18;
const MODULE = [0, 1.7, 2.15];
/** Mullion positions along a run: the 3.6 m module counted from the plan axis (a for north/south faces, b for east/west). */
function mullions(p: P2, q: P2, margin: number): P2[] {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]), t: P2 = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
  const alongA = Math.abs(t[0]) > 0.5, c0 = alongA ? p[0] : p[1], dir = alongA ? t[0] : t[1];
  const lo = Math.min(c0, c0 + dir * len), hi = Math.max(c0, c0 + dir * len), out: P2[] = [];
  for (let m = Math.floor(lo / PITCH) * PITCH; m < hi; m += PITCH) for (const off of MODULE) {
    const c = m + off; if (c < lo + margin || c > hi - margin) continue;
    const s = (c - c0) / dir; out.push([p[0] + t[0] * s, p[1] + t[1] * s]);
  }
  return out;
}

function stack(b: BuildingTools) {
  const storeys = trayStack(KPN_TELEPORT_PLAN, {columnPitch: PITCH, columnInset: 0.5, columnMargin: 0.6});
  const posts: {at: P2; k: number}[] = [];
  for (const st of storeys) {
    const {y0, glassTop, y1} = st.level, k = st.index, sp = SPANDREL(k);
    for (const w of st.walls) {
      const len = Math.hypot(w.q[0] - w.p[0], w.q[1] - w.p[1]), t: P2 = [(w.q[0] - w.p[0]) / len, (w.q[1] - w.p[1]) / len];
      if (k === P) { wallQuad('dark', w.p, w.q, w.n, 0, y0, glassTop); continue; }
      if (w.kind === 'inner') {
        // loggia back wall or return: storey-high glass on the wall line, slim mullions 9 cm proud
        wallQuad('glass', w.p, w.q, w.n, 0, y0, glassTop);
        for (const m of mullions(w.p, w.q, 0.3)) fin('frame', m, t, w.n, 0, 0.09, 0.07, y0, glassTop);
        continue;
      }
      // on the slab edge: spandrel panel, the ribbon set 12 cm in with its sill and head, mullions 9 cm proud over both
      if (sp > 0) wallQuad('pink', w.p, w.q, w.n, 0, y0, y0 + sp);
      wallQuad('glass', w.p, w.q, w.n, -GLASS_IN, y0 + sp, glassTop);
      ledge('frame', w.p, w.q, w.n, -GLASS_IN, 0, y0 + sp, true);
      ledge('frame', w.p, w.q, w.n, -GLASS_IN, 0, glassTop, false);
      for (const m of mullions(w.p, w.q, POST + 0.1)) fin('frame', m, t, w.n, -GLASS_IN - 0.02, 0.09, 0.07, y0, glassTop);
      if (k === L0) {
        // the ground storey's transom (w04: 4.0 m), a horizontal bar from the glass to 9 cm proud
        const p: P2 = [w.p[0] + t[0] * POST, w.p[1] + t[1] * POST], q: P2 = [w.q[0] - t[0] * POST, w.q[1] - t[1] * POST];
        wallQuad('frame', p, q, w.n, 0.09, 3.97, 4.03);
        ledge('frame', p, q, w.n, -GLASS_IN, 0.09, 4.03, true);
        ledge('frame', p, q, w.n, -GLASS_IN, 0.09, 3.97, false);
      }
      posts.push({at: w.p, k}, {at: w.q, k});
    }
    // corner and junction posts of the ribbons: square, centred on the turn
    const seen = new Set<string>();
    for (const {at, k: pk} of posts.filter(x => x.k === k)) {
      const id = `${at[0].toFixed(3)},${at[1].toFixed(3)}`; if (seen.has(id)) continue; seen.add(id);
      const g = new T.BoxGeometry(2 * POST, LEVELS[pk].glassTop - LEVELS[pk].y0, 2 * POST), p = X(at[0], at[1]);
      g.rotateY(Math.atan2(E[1], E[0]) * -1); g.translate(p[0], (LEVELS[pk].y0 + LEVELS[pk].glassTop) / 2, p[1]);
      const pos = g.toNonIndexed().getAttribute('position').array, arr = ACC.get('frame') ?? []; ACC.set('frame', arr);
      // keep the side faces only: the top and bottom die into the slab bands
      for (let i = 0; i < pos.length; i += 9) if (Math.abs(pos[i + 1] - pos[i + 4]) > 1e-6 || Math.abs(pos[i + 1] - pos[i + 7]) > 1e-6) for (let j = 0; j < 9; j++) arr.push(pos[i + j]);
    }
    for (const r of st.floors) cap('concrete', r, y0, true);
    for (const r of st.soffits) cap('concrete', r, glassTop, false);
    for (const r of st.roofs) cap(k === P ? 'stone' : 'slate', r, y1, true);
    // slab-edge band: a 10 cm proud anthracite strip round every slab, glassTop..y1
    for (const loop of st.bandLoops) {
      const n = loop.length;
      for (let i = 0; i < n; i++) {
        const p = loop[i], q = loop[(i + 1) % n], len = Math.hypot(q[0] - p[0], q[1] - p[1]), t: P2 = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
        const nn: P2 = [-t[1], t[0]], po = offsetPoint(loop, i), qo = offsetPoint(loop, (i + 1) % n);
        quad('frame', v3(po[0], po[1], glassTop), v3(qo[0], qo[1], glassTop), v3(qo[0], qo[1], y1), v3(po[0], po[1], y1), nOut(nn));
        quad('frame', v3(p[0], p[1], y1), v3(q[0], q[1], y1), v3(qo[0], qo[1], y1), v3(po[0], po[1], y1), [0, 1, 0]);
        quad('frame', v3(p[0], p[1], glassTop), v3(q[0], q[1], glassTop), v3(qo[0], qo[1], glassTop), v3(po[0], po[1], glassTop), [0, -1, 0]);
      }
    }
    for (const c of st.columns) {
      const p = X(c.at[0], c.at[1]), h = c.y1 - c.y0, g = new T.CylinderGeometry(0.2, 0.2, h, 10, 1, true);
      g.translate(p[0], c.y0 + h / 2, p[1]); b.add(g, 'frame');
    }
  }
}
function offsetPoint(loop: P2[], i: number): P2 {
  const n = loop.length, v = loop[i], a = loop[(i - 1 + n) % n], c = loop[(i + 1) % n];
  const nrm = (p: P2, q: P2): P2 => { const l = Math.hypot(q[0] - p[0], q[1] - p[1]); return [-(q[1] - p[1]) / l, (q[0] - p[0]) / l]; };
  const n1 = nrm(a, v), n2 = nrm(v, c), par = Math.abs(n1[0] * n2[0] + n1[1] * n2[1]) > 0.999;
  return par ? [v[0] + BAND_OUT * n1[0], v[1] + BAND_OUT * n1[1]] : [v[0] + BAND_OUT * (n1[0] + n2[0]), v[1] + BAND_OUT * (n1[1] + n2[1])];
}

// ---- louvres, the entrance, signs and roof plant --------------------------------------------------------------------------------
/** Horizontal louvre slats along a plan segment p-q (outward n), from `o0` to `o1` off the slab edge. */
function louvres(p: P2, q: P2, n: P2, y0: number, y1: number, count: number, o0: number, o1: number) {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]), mid: P2 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  for (let i = 0; i < count; i++) planBox('frame', mid, n, (o0 + o1) / 2, len, o1 - o0, y0 + (y1 - y0 - 0.06) * i / (count - 1), 0.06);
}
function details(b: BuildingTools) {
  const nN: P2 = [0, -1], nE: P2 = [1, 0], nS: P2 = [0, 1], nW: P2 = [-1, 0];
  const l4 = LEVELS[L4];
  // corner voids: six slats across the L4 slab-edge zone (w03 19.6-21.2 m; Commons 2021 at the north-west corner)
  const ly0 = l4.glassTop - 0.8, ly1 = l4.y1 - 0.05;
  louvres([0, -0.15], [0, 24.8], nW, ly0, ly1, 6, -0.2, 0.15);
  louvres([12.1, 0], [0.25, 0], nN, ly0, ly1, 6, -0.2, 0.15);
  louvres([47.7, B], [A + 0.15, B], nS, ly0, ly1, 6, -0.2, 0.15);
  louvres([A, B - 0.25], [A, B - 14.8], nE, ly0, ly1, 6, -0.2, 0.15);
  // the entrance canopies: two banks of five slats in front of the hall at L1 and L2 (w03), 15.4 m wide
  louvres([22.3, B], [37.7, B], nS, 7.2, 8.6, 5, 0.2, 0.55);
  louvres([22.3, B], [37.7, B], nS, 10.8, 12.2, 5, 0.2, 0.55);
  // the entrance steps: fifteen risers from the pavement to the hall floor at 3.0 m, between the hall's side walls
  {
    const n = 15, run = ENTRANCE.depth - 0.15, tread = run / n, sh = new T.Shape();
    sh.moveTo(0, 0); for (let i = 0; i < n; i++) { sh.lineTo(i * tread, (i + 1) * 0.2); sh.lineTo((i + 1) * tread, (i + 1) * 0.2); }
    sh.lineTo(run, 0); sh.closePath();
    const w = ENTRANCE.a1 - ENTRANCE.a0 - 0.3, g = new T.ExtrudeGeometry(sh, {depth: w, bevelEnabled: false}).toNonIndexed();
    g.computeVertexNormals();
    // shape x = distance in from the slab edge (towards -b), shape y = up, extrusion along +a; each triangle is wound to face
    // its own (mapped) normal
    const pos = g.getAttribute('position').array as ArrayLike<number>, nrm = g.getAttribute('normal').array as ArrayLike<number>;
    const map = (i: number) => v3(ENTRANCE.a0 + 0.15 + pos[i + 2], B - pos[i], pos[i + 1]);
    for (let i = 0; i < pos.length; i += 9) {
      const nn = nOut([nrm[i + 2], -nrm[i]]);
      tri('stone', map(i), map(i + 3), map(i + 6), [nn[0], nrm[i + 1], nn[2]]);
    }
  }
  // SIMYO in pale pink capitals through the L1 glass (from 2 cm behind it) beside the north-west corner, north face (w05, 2025) and west face (Commons 2021)
  const l1 = LEVELS[2], px = 0.23, yL = l1.y0 + SPANDREL(2) + (2.0 - 7 * px) / 2;
  {
    // north face, viewer-left = east: the word centred 4.6 m from the west corner
    const f: Frame = {origin: X(0, 0), tangent: VEC(-1, 0), n: VEC(0, -1)};
    letters(b, f, 'SIMYO', -4.6, yL, -GLASS_IN - 0.02, px, 0.11, 'white');
  }
  { const f: Frame = {origin: X(0, 0), tangent: VEC(0, 1), n: VEC(-1, 0)}; letters(b, f, 'SIMYO', 6.0, yL, -GLASS_IN - 0.02, px, 0.11, 'white'); }
  // XS4ALL: an orange-lit box sign on the north-west corner louvres, west face, 5-8.5 m from the corner (Commons 2021)
  {
    const f: Frame = {origin: X(0, 0), tangent: VEC(0, 1), n: VEC(-1, 0)}, yS = l4.glassTop - 0.75;
    slab(b, f, 6.8, yS, 3.4, 1.05, 0.14, 'frame', 0.2);
    for (const [t, y, w, h] of [[6.8, yS + 0.05, 3.25, 0.06], [6.8, yS + 0.94, 3.25, 0.06], [5.2, yS + 0.05, 0.06, 0.95], [8.4, yS + 0.05, 0.06, 0.95]] as const) slab(b, f, t, y, w, h, 0.05, 'gold', 0.34);
    letters(b, f, 'XS4ALL', 6.8, yS + 0.22, 0.34, 0.085, 0.05, 'gold');
  }
  // the kpn wordmark and its green logo on a steel frame at the north-east corner of the roof, facing east (Commons 2021 from
  // behind; its green top shows over the parapet in w01, 2025)
  {
    const top = LEVELS[LEVELS.length - 1].y1, f: Frame = {origin: X(54, 13.5), tangent: VEC(0, -1), n: VEC(1, 0)};
    for (const t of [0.6, 6.9]) slab(b, f, t, top - 0.05, 0.12, 4.0, 0.12, 'bronze', -0.3);
    slab(b, f, 3.75, top + 1.0, 6.5, 0.12, 0.12, 'bronze', -0.3);
    letters(b, f, 'kpn', 4.6, top + 1.25, -0.12, 0.3, 0.1, 'green');
    slab(b, f, 1.2, top + 1.4, 1.5, 1.5, 0.1, 'green', -0.12);
  }
  // roof plant: the 3DBAG roof parts standing 0.9-1.4 m above the main roof (a, b of their bounding boxes)
  for (const [a0, a1, b0, b1, h] of [[31.9, 35.2, 11.95, 16.2, 0.9], [10.5, 14.0, 26.65, 29.25, 1.4], [46.6, 49.1, 54.85, 57.15, 1.4], [11.4, 13.2, 53.35, 54.85, 1.4],
    [10.3, 15.9, 12.35, 13.95, 1.4], [12.0, 14.2, 67.05, 72.55, 1.4], [45.8, 49.1, 26.75, 28.85, 1.4], [32.1, 35.6, 67.05, 71.95, 0.9]] as const) {
    planBox('concrete', [(a0 + a1) / 2, (b0 + b1) / 2], [0, 1], 0, a1 - a0, b1 - b0, LEVELS[LEVELS.length - 1].y1 - 0.05, h + 0.05);
  }
}

export function buildKpnTeleport(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  ACC = new Map();
  stack(b); flush(b); b.mark?.('stack');
  details(b); flush(b); b.mark?.('details');
}
