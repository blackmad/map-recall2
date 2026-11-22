/**
 * HERENGRACHT 50-90 (even side, 19 BAG panden, 21 houses): the block pilot (lane belt-block-pilot-20261122). One builder
 * draws the whole face at once on the BAG/3DBAG shells (herengracht-50-90-source.json, prepare.ts), the hand-block way:
 * the 3DBAG LoD2.2 shell of every pand gives party walls, rear walls and roofs; its street walls are dropped and each
 * front is rebuilt from the review's row photo (Gemeente Amsterdam panoramas, CC BY 4.0, rectified at 50 px/m and cut at
 * David's facade edges; review-data/belt-review/herengracht-2-90-even) with row-kit.ts.
 *
 * Every number below is read off that row photo in metres: `s` along the front from the viewer's left edge of the house,
 * `y` above the street. Where a crop is visibly shifted against the BAG span (62, 60, 58, 66, 68, 64, 54) the bays are
 * re-centred on the house; where a photo's scale disagrees with 3DBAG and its twin (70 vs 72, 62, 58) the twin's or the
 * 3DBAG height wins. Gables are drawn symmetric (memory: symmetric gables). Row-level facts used on purpose:
 *  - 72 and 70 are twins (same neo-renaissance stucco storeys and pediment): one design, two ground storeys;
 *  - 78 and 76 are a pair of neck gables on one pand, each its own house;
 *  - 52 (five bays with the white doorcase) and 50 (three bays, segmental heads) share one pand and one roof;
 *  - 68, 66 and 52 share the charcoal paint and the white console cornice with attic lights;
 *  - 58 and 56 share the 1900s banding (white string courses, voussoir arches), in grey and in red brick.
 */
import {arc, box, claw, cornice, edgeStrip, flat, front, gableBody, gables, outlineOf, quads, slabPoly, type Band, type FF, type P2, type Sink, type Win} from './row-kit.ts';
import {planarPolygon} from '../landmarks/worship-shell.ts';

type Surface = {type: string; rings: number[][][]};
type Pand = {pand: string; ring: P2[]; front: {a: P2; b: P2; lengthM: number}; surfaces: Surface[]};
type Src = {pands: Pand[]};

// ---- colours (`word:#hex`; row-kit draws what it is given) ------------------------------------------------------------
const WHITE = 'stone:#efece4', FRAME = 'frame:#f1efe8', GLASS = 'glass:#2a3238', DOOR = 'door:#2b2d2e', SLATE = 'roof:#3e4045', TILE = 'roof:#8a4a36';
const SIDE = 'brick:#5b4a42';

// ---- small helpers ----------------------------------------------------------------------------------------------------
type O = Partial<Win>;
const row = (cs: number[], w: number, y0: number, y1: number, o: O = {}): Win[] => cs.map(s => ({s, w, y0, y1, ...o}));
const door = (s: number, w: number, y0: number, y1: number, o: O = {}): Win => ({s, w, y0, y1, back: DOOR, frame: FRAME, depth: 0.2, ...o});
const sc = (k: number, ws: Win[]): Win[] => ws.map(w => ({...w, y0: w.y0 * k, y1: w.y1 * k}));

type Ctx = {S: Sink; F: FF; L: number};
/** Sub-frame of a pand front from s0, len L. */
const subF = (F: FF, s0: number, L: number): FF => ({o: [F.o[0] + F.t[0] * s0, F.o[1] + F.t[1] * s0], t: F.t, n: F.n, len: L});

/** Thin proud horizontal courses between openings: from t0..t1 at each y (height h), split around `wins`. */
function courses(c: Ctx, ys: number[], h: number, col: string, wins: Win[], proj = 0.03, T0 = 0, T1 = c.L, outline?: P2[]) {
  for (const y of ys) {
    let t0 = T0, t1 = T1;
    if (outline) {
      // the outline's extent at this height (copings and stripes stop at the gable edge)
      const ym = y + h / 2, xs: number[] = [];
      outline.forEach((a, i) => { const b = outline[(i + 1) % outline.length]; if ((a[1] - ym) * (b[1] - ym) <= 0 && a[1] !== b[1]) xs.push(a[0] + (b[0] - a[0]) * (ym - a[1]) / (b[1] - a[1])); });
      if (xs.length < 2) continue;
      t0 = Math.max(t0, Math.min(...xs) + 0.05); t1 = Math.min(t1, Math.max(...xs) - 0.05);
    }
    const cuts = wins.filter(w => w.y0 < y + h && w.y1 > y).map(w => [w.s - w.w / 2 - 0.02, w.s + w.w / 2 + 0.02]).sort((a, b) => a[0] - b[0]);
    let x = t0;
    for (const [a, b] of cuts) { if (a > x + 0.05) box(c.S, c.F, x, a, y, y + h, 0, proj, col); x = Math.max(x, b); }
    if (t1 > x + 0.05) box(c.S, c.F, x, t1, y, y + h, 0, proj, col);
  }
}
/** Neck-gable cap: segmental (or triangular) pediment over the neck with a cornice slab under it. */
function cap(c: Ctx, cx: number, w: number, y: number, h: number, kind: 'seg' | 'tri' | 'round', col: string) {
  box(c.S, c.F, cx - w / 2 - 0.12, cx + w / 2 + 0.12, y, y + 0.18, -0.3, 0.16, col, false);
  const half = w / 2 + 0.1;
  const pts: P2[] = kind === 'tri' ? [[cx - half, y + 0.18], [cx + half, y + 0.18], [cx, y + 0.18 + h]]
    : kind === 'round' ? [[cx - half, y + 0.18], [cx + half, y + 0.18], ...arc(cx, y + 0.18, half, h, 0, Math.PI, 10).slice(1, -1)]
    : (() => { const R = (half * half + h * h) / (2 * h), a = Math.asin(Math.min(1, half / R)); return [[cx - half, y + 0.18], [cx + half, y + 0.18], ...arc(cx, y + 0.18 + h - R, R, R, Math.PI / 2 - a, Math.PI / 2 + a, 10).slice(1, -1)] as P2[]; })();
  slabPoly(c.S, c.F, pts, -0.3, 0.12, col);
}
/** Pilaster strip (proud box) from y0 to y1. */
const pilaster = (c: Ctx, s0: number, s1: number, y0: number, y1: number, col: string, d = 0.08) => box(c.S, c.F, s0, s1, y0, y1, 0, d, col);
/** Awning: a sloped canvas from y (wall) down/out to y - drop at `proj`. */
function awning(c: Ctx, s: number, w: number, y: number, proj: number, drop: number, col: string) {
  quads(c.S, c.F, [[[s - w / 2, y, 0], [s + w / 2, y, 0], [s + w / 2, y - drop, proj], [s - w / 2, y - drop, proj]],
    [[s - w / 2, y - drop, proj], [s + w / 2, y - drop, proj], [s + w / 2, y - drop - 0.3, proj], [s - w / 2, y - drop - 0.3, proj]]], col);
}
/** Cornice front over a whole house: frieze (with optional attic lights cut as dark panels), corona, consoles. */
function entab(c: Ctx, y0: number, f: number, k: number, depth: number, col: string, o: {consoles?: number[]; lights?: {cs: number[]; w: number; y0: number; y1: number}; soffit?: string} = {}) {
  cornice(c.S, c.F, 0, c.L, y0, f, k, depth, col, o.consoles ?? [], o.soffit);
  for (const s of o.lights?.cs ?? []) box(c.S, c.F, s - o.lights!.w / 2, s + o.lights!.w / 2, o.lights!.y0, o.lights!.y1, 0.06, 0.075, GLASS);
}

type House = {id: string; pand: string; s0?: number; L?: number; draw: (c: Ctx) => void};

/** The body of a canal front: outline (body to `eaves` plus a crown outline), colour bands, openings. */
function body(c: Ctx, eaves: number, crown: P2[], bands: Band[], wins: Win[], wall: string) {
  front(c.S, c.F, outlineOf(c.L, eaves, crown), bands.length ? bands : [{y0: 0, y1: 99, c: wall}], wins);
  if (crown.length) gableBody(c.S, c.F, crown, eaves, wall);
}

// ===== the houses, left to right as seen from the canal ==================================================================
const HOUSES: House[] = [
  // ---- Herengracht 90 (1630; front 19th c.): greige painted brick, stucco shop storey with three red awnings,
  // three bays of 4-light sashes, white cornice with a centred segmental attic between scrolls.
  {id: '90', pand: '0363100012175701', draw: c => {
    const wall = 'paint:#a8a48a', stucco = 'stucco:#9b998c', cs = [0.98, 2.83, 4.68];
    const wins = [
      ...row(cs.slice(0, 2), 1.25, 1.5, 4.25, {back: 'glass:#1f2224', cols: 1, frame: 'frame:#3a3633', depth: 0.25}),
      door(cs[2], 1.2, 0.1, 4.25, {transom: 3.2, frame: 'frame:#3a3633'}),
      ...row(cs, 1.3, 6.6, 8.9, {cols: 2, rows: 2, sill: WHITE}), ...row(cs, 1.3, 9.8, 11.6, {cols: 2, rows: 2, sill: WHITE}), ...row(cs, 1.3, 12.4, 13.9, {cols: 2, rows: 2, sill: WHITE}),
    ];
    body(c, 14.5, [], [{y0: 0, y1: 5.7, c: stucco}, {y0: 5.7, y1: 99, c: wall}], wins, wall);
    for (const s of [0.08, 1.9, 3.75, 5.59]) pilaster(c, s - 0.08, s + 0.08, 0.6, 5.5, stucco, 0.12);
    box(c.S, c.F, 0, c.L, 5.45, 5.85, 0, 0.18, stucco);
    for (const s of cs) awning(c, s, 1.4, 5.0, 0.9, 0.55, 'canvas:#8c1f2a');
    entab(c, 14.5, 0.5, 0.4, 0.35, WHITE);
    // the segmental attic between two scrolls, its light in the middle
    const ax = c.L / 2;
    slabPoly(c.S, c.F, [[ax - 0.95, 15.4], [ax + 0.95, 15.4], [ax + 0.95, 16.4], ...arc(ax, 15.6, 0.95, 1.5, 0, Math.PI, 10).slice(1, -1), [ax - 0.95, 16.4]], -0.3, 0.05, WHITE);
    claw(c.S, c.F, ax - 1.55, ax - 0.95, 15.4, 0.9, WHITE);
    claw(c.S, c.F, ax + 1.55, ax + 0.95, 15.4, 0.9, WHITE);
    box(c.S, c.F, ax - 0.32, ax + 0.32, 15.6, 16.5, 0.05, 0.06, GLASS);
  }},
  // ---- 88 (1880): neo-renaissance candy stripes, dark brown brick banded with white stucco, three bays, white frieze with
  // dark panels, a pointed gable with stripes and one window.
  {id: '88', pand: '0363100012169010', draw: c => {
    const wall = 'brick:#4a2e28', cs = [1.4, 3.56, 5.7];
    const gable = gables.spout(3.56, 1.6, 14.3, 0.6, 17.6);
    const wins = [
      ...row(cs.slice(0, 2), 1.35, 1.2, 4.2, {back: 'glass:#1c2023', cols: 1}), door(cs[2], 1.2, 0.1, 4.9, {transom: 3.6}),
      ...row(cs, 1.3, 6.9, 9.5, {cols: 2, rows: 3}), ...row(cs, 1.3, 10.7, 12.5, {cols: 2, rows: 2}),
      {s: 3.56, w: 0.9, y0: 14.8, y1: 16.0, cols: 2, rows: 2},
    ];
    body(c, 14.3, gable, [], wins, wall);
    courses(c, [1.0, 1.6, 2.2, 2.8, 3.4, 4.6, 7.2, 7.75, 8.3, 8.85, 9.4, 11.0, 11.55, 12.1, 14.95, 15.5, 16.05, 16.6], 0.2, WHITE, wins, 0.02, 0, c.L, outlineOf(c.L, 14.3, gable));
    box(c.S, c.F, 0, c.L, 5.9, 6.6, 0, 0.1, WHITE);
    for (const s of cs) awning(c, s, 1.4, 5.0, 0.8, 0.5, 'canvas:#e8e4d8');
    for (const s of cs) edgeStrip(c.S, c.F, arc(s, 9.5, 0.75, 0.45, 0, Math.PI, 8), 0.22, 0, 0.05, WHITE);
    box(c.S, c.F, 0, c.L, 12.8, 13.8, 0, 0.06, WHITE);
    for (const s of cs) box(c.S, c.F, s - 0.75, s + 0.75, 13.05, 13.55, 0.06, 0.08, wall);
    box(c.S, c.F, -0.05, c.L + 0.05, 13.8, 14.3, 0, 0.25, WHITE);
    for (const s of [0.12, c.L - 0.12]) pilaster(c, s - 0.12, s + 0.12, 0, 13.8, WHITE, 0.04);
    edgeStrip(c.S, c.F, gable.slice(1, 4), 0.2, 0, 0.06, WHITE);
  }},
  // ---- 86 (1994 rebuild of a bell gable): red-brown brick, white timber ground front (two tall windows, door with a
  // light over it), brick storeys with relieving arches, bell gable with a pointed cap and a scroll.
  {id: '86', pand: '0363100012175692', draw: c => {
    const wall = 'brick:#7a5546', timber = 'paint:#e6e3dc';
    const crown = gables.bell(c.L, 0.12, 2.2, 13.0, 14.8, 16.9);
    const wins = [
      ...row([0.6, 1.8], 0.95, 2.2, 6.0, {cols: 2, rows: 4}), door(3.68, 1.0, 1.9, 4.6), {s: 3.68, w: 1.0, y0: 4.8, y1: 6.0, cols: 2, rows: 2},
      {s: 1.0, w: 1.35, y0: 7.3, y1: 9.4, cols: 2, rows: 2}, {s: 3.15, w: 1.45, y0: 7.3, y1: 9.4, cols: 2, rows: 2},
      {s: 0.75, w: 0.7, y0: 10.5, y1: 12.3, cols: 1, rows: 2}, {s: 2.1, w: 1.45, y0: 10.5, y1: 12.3, cols: 2, rows: 2}, {s: 3.65, w: 0.8, y0: 10.5, y1: 12.3, cols: 1, rows: 2},
      {s: 2.49, w: 0.9, y0: 13.3, y1: 14.6, cols: 2, rows: 2},
    ];
    body(c, 13.0, crown, [{y0: 0, y1: 6.5, c: timber}, {y0: 6.5, y1: 99, c: wall}], wins, wall);
    for (const [a, b] of [[0, 0.12], [4.86, 4.98]]) pilaster(c, a, b, 0, 6.3, timber, 0.06);
    box(c.S, c.F, 2.4, 2.95, 0.9, 6.15, 0, 0.03, wall);
    box(c.S, c.F, 0, c.L, 6.15, 6.5, 0, 0.14, timber);
    for (const w of [1.0, 3.15]) edgeStrip(c.S, c.F, arc(w, 9.4, 0.8, 0.35, 0, Math.PI, 8), 0.2, 0, 0.03, 'brick:#6a4538');
    edgeStrip(c.S, c.F, crown.slice(0, crown.length), 0.18, 0, 0.06, WHITE);
    cap(c, c.L / 2, 2.2, 16.9, 0.6, 'tri', WHITE);
    slabPoly(c.S, c.F, arc(c.L - 0.35, 13.7, 0.32, 0.32, 0, Math.PI * 2, 12).slice(0, -1), -0.05, 0.16, WHITE);
  }},
  // ---- 84 (1615): step gable in dark purple-brown brick, white blocks over every window, white frames, a tall ground
  // storey with a fanlight door, six steps a side with white corner stones.
  {id: '84', pand: '0363100012175702', draw: c => {
    const wall = 'brick:#403a39', cs = [0.72, 2.8, 4.88];
    const crown = gables.step(c.L, 6, 0.8, 12.7, 17.8);
    const arch = {h: 0.28, c: WHITE, key: WHITE};
    const wins = [
      ...row(cs.slice(0, 2), 1.2, 1.9, 5.6, {cols: 3, rows: 5, sill: WHITE}), door(cs[2], 1.05, 0.6, 5.6, {transom: 3.7}),
      ...row(cs, 1.2, 6.96, 9.1, {cols: 2, rows: 3, head: 'seg', rise: 0.2, lintel: arch}),
      {s: cs[0], w: 0.95, y0: 10.2, y1: 12.0, cols: 2, rows: 2, head: 'seg', rise: 0.18, lintel: arch}, {s: cs[1], w: 1.2, y0: 10.2, y1: 12.0, cols: 2, rows: 3, head: 'seg', rise: 0.2, lintel: arch},
      {s: cs[2], w: 0.95, y0: 10.2, y1: 12.0, cols: 2, rows: 2, head: 'seg', rise: 0.18, lintel: arch},
      {s: c.L / 2, w: 0.9, y0: 13.0, y1: 14.5, cols: 2, rows: 2, head: 'seg', rise: 0.15, lintel: arch},
    ];
    body(c, 12.7, crown, [{y0: 0, y1: 1.2, c: 'stone:#7d7a78'}, {y0: 1.2, y1: 99, c: wall}], wins, wall);
    box(c.S, c.F, 0, c.L, 5.9, 6.25, 0, 0.14, WHITE);
    box(c.S, c.F, 0, c.L, 12.45, 12.6, 0, 0.05, WHITE);
    for (const [a, b] of [[1.32, 1.92], [3.4, 4.05]]) pilaster(c, a + 0.05, b - 0.05, 1.3, 5.7, wall, 0.06);
    // white stone at every step's outer corner
    for (let k = 0; k < crown.length; k += 2) { const [x, y] = crown[k]; if (Math.abs(x - c.L / 2) < 0.5) continue; const dx = x < c.L / 2 ? 1 : -1; box(c.S, c.F, Math.min(x, x + dx * 0.4), Math.max(x, x + dx * 0.4), y - 0.12, y + 0.06, -0.3, 0.08, WHITE); }
    box(c.S, c.F, c.L / 2 - 0.5, c.L / 2 + 0.5, 17.8, 18.0, -0.3, 0.08, WHITE);
  }},
  // ---- 82 (1905): cream plastered cornice house, dark green frames on grey sills, a grey shop fascia ("Bâton"),
  // a plain cornice, red pantiles behind.
  {id: '82', pand: '0363100012175703', draw: c => {
    const wall = 'plaster:#d6d0bd', frame = 'frame:#2b302c', sill = 'stone:#9a978f', cs = [0.94, 2.84, 4.74];
    const o = {frame, sill, cols: 3, rows: 3} as O;
    const wins = [
      {s: 1.1, w: 1.5, y0: 0.6, y1: 3.1, back: 'glass:#1c2023', frame}, {s: 3.15, w: 1.8, y0: 0.6, y1: 3.1, back: 'glass:#1c2023', frame, cols: 2}, door(5.1, 0.95, 0.1, 3.0, {frame}),
      ...row(cs, 1.2, 5.2, 7.2, o), ...row(cs, 1.2, 8.0, 9.8, o), ...row(cs, 1.2, 10.4, 12.0, {...o, rows: 2}),
    ];
    body(c, 12.9, [], [], wins, wall);
    box(c.S, c.F, 0, c.L, 3.3, 4.3, 0, 0.18, 'paint:#7e7a76');
    box(c.S, c.F, 0, c.L, 4.3, 4.45, 0, 0.22, wall);
    entab(c, 12.9, 0.15, 0.3, 0.3, 'plaster:#e2ddcc');
  }},
  // ---- 80 (1905 front, neck gable): brown brick, white timber ground front (two doors with fanlights, a wide window),
  // three bays, neck gable with white claw pieces and a segmental cap.
  {id: '80', pand: '0363100012175783', draw: c => {
    const wall = 'brick:#5a4a41', timber = 'paint:#e8e5dc', cs = [0.6, 2.17, 3.73];
    const crown = gables.neck(c.L / 2, 2.0, 12.0, 14.2);
    const wins = [
      door(0.42, 0.6, 0.4, 3.0), door(1.3, 0.7, 0.4, 3.0), {s: 0.86, w: 1.6, y0: 3.15, y1: 3.75, cols: 2}, {s: 3.0, w: 2.0, y0: 1.2, y1: 3.75, cols: 4, rows: 3},
      ...row(cs, 0.95, 4.5, 6.3, {cols: 2, rows: 2}), ...row(cs, 0.95, 7.1, 8.9, {cols: 2, rows: 3}),
      {s: cs[0], w: 0.9, y0: 9.7, y1: 11.1, cols: 2, rows: 2}, {s: cs[1], w: 1.0, y0: 9.6, y1: 11.4, cols: 2, rows: 2, back: 'glass:#30363a'}, {s: cs[2], w: 0.9, y0: 9.7, y1: 11.1, cols: 2, rows: 2},
      {s: c.L / 2, w: 0.8, y0: 12.15, y1: 13.0, cols: 2, rows: 1},
    ];
    body(c, 12.0, crown, [{y0: 0, y1: 4.2, c: timber}, {y0: 4.2, y1: 99, c: wall}], wins, wall);
    box(c.S, c.F, 0, c.L, 4.0, 4.25, 0, 0.16, timber);
    box(c.S, c.F, -0.05, c.L + 0.05, 11.9, 12.1, -0.3, 0.1, WHITE);
    claw(c.S, c.F, 0.08, c.L / 2 - 1.0, 12.1, 1.4, WHITE);
    claw(c.S, c.F, c.L - 0.08, c.L / 2 + 1.0, 12.1, 1.4, WHITE);
    cap(c, c.L / 2, 2.0, 14.2, 0.45, 'seg', WHITE);
  }},
  // ---- 78 and 76 (one pand, two houses): a pair of neck gables in brown brick with white claw pieces.
  {id: '78', pand: '0363100012175784', s0: 0, L: 4.1, draw: c => {
    const wall = 'brick:#52453d', crown = gables.neck(2.05, 2.1, 9.2, 11.9);
    const wins = [
      door(0.56, 0.9, 0.9, 3.0), {s: 0.56, w: 0.9, y0: 3.1, y1: 3.8, back: 'paint:#3a3b3a'}, {s: 2.48, w: 2.3, y0: 1.2, y1: 3.7, cols: 4, rows: 3},
      {s: 0.9, w: 1.45, y0: 4.5, y1: 6.3, cols: 2, rows: 3}, {s: 2.95, w: 1.5, y0: 4.5, y1: 6.3, cols: 2, rows: 3},
      {s: 0.5, w: 0.85, y0: 7.1, y1: 8.4, cols: 2, rows: 2}, {s: 1.8, w: 1.1, y0: 7.0, y1: 8.4, cols: 2, rows: 1, back: 'glass:#30363a'}, {s: 3.2, w: 0.95, y0: 7.1, y1: 8.4, cols: 2, rows: 2},
      {s: 2.05, w: 0.9, y0: 9.3, y1: 10.2, cols: 2, rows: 2},
    ];
    body(c, 9.2, crown, [], wins, wall);
    box(c.S, c.F, 0, c.L, 9.1, 9.25, -0.3, 0.1, WHITE);
    claw(c.S, c.F, 0.06, 1.0, 9.25, 1.3, WHITE); claw(c.S, c.F, 4.04, 3.1, 9.25, 1.3, WHITE);
    cap(c, 2.05, 2.1, 11.9, 0.5, 'seg', WHITE);
  }},
  {id: '76', pand: '0363100012175784', s0: 4.1, L: 4.27, draw: c => {
    const wall = 'brick:#544941', crown = gables.neck(2.1, 2.0, 9.1, 11.9);
    const wins = [
      door(0.73, 0.9, 0.7, 3.0), {s: 0.73, w: 0.9, y0: 3.1, y1: 3.8, back: 'paint:#3a3b3a', head: 'round'}, {s: 2.58, w: 1.8, y0: 1.6, y1: 3.9, cols: 4, rows: 3},
      {s: 0.98, w: 1.4, y0: 4.5, y1: 6.3, cols: 2, rows: 3}, {s: 2.83, w: 1.3, y0: 4.5, y1: 6.3, cols: 2, rows: 3},
      {s: 0.52, w: 0.85, y0: 7.1, y1: 8.4, cols: 2, rows: 2}, {s: 1.88, w: 1.0, y0: 7.0, y1: 8.4, cols: 2, rows: 1, back: 'glass:#30363a'}, {s: 3.2, w: 0.8, y0: 7.1, y1: 8.4, cols: 2, rows: 2},
      {s: 2.1, w: 0.8, y0: 9.25, y1: 10.2, cols: 2, rows: 2},
    ];
    body(c, 9.1, crown, [], wins, wall);
    box(c.S, c.F, 0, c.L, 9.0, 9.15, -0.3, 0.1, WHITE);
    claw(c.S, c.F, 0.06, 1.1, 9.15, 1.3, WHITE); claw(c.S, c.F, 4.21, 3.1, 9.15, 1.3, WHITE);
    cap(c, 2.1, 2.0, 11.9, 0.55, 'seg', WHITE);
    box(c.S, c.F, 1.9, 2.3, 12.6, 13.0, -0.1, 0.1, WHITE);
  }},
  // ---- 74 (1905): orange-red brick with buff bands, segmental-headed big windows, an arched top gable with a wide
  // attic window, a red door.
  {id: '74', pand: '0363100012175616', draw: c => {
    const wall = 'brick:#94503e', buff = 'stone:#c9b48e', crown = gables.arch(c.L, 0.3, 13.0, 14.6, 16.4);
    const wins = [
      door(1.18, 0.95, 0.9, 4.0, {back: 'door:#7a3020', transom: 2.6}), {s: 3.25, w: 1.75, y0: 1.3, y1: 4.0, cols: 2, rows: 2},
      ...row([1.4, 3.3], 1.45, 5.8, 8.3, {head: 'seg', rise: 0.25, transom: 1.8, sill: buff}), ...row([1.4, 3.3], 1.45, 9.9, 12.2, {head: 'seg', rise: 0.25, transom: 1.6, sill: buff}),
      {s: c.L / 2, w: 2.3, y0: 13.4, y1: 15.3, cols: 4, rows: 2, head: 'seg', rise: 0.35},
    ];
    body(c, 13.0, crown, [{y0: 0, y1: 0.9, c: 'stone:#9a9690'}, {y0: 0.9, y1: 99, c: wall}], wins, wall);
    courses(c, [4.3, 5.6, 8.65, 9.65, 12.6], 0.18, buff, wins, 0.04);
    box(c.S, c.F, 0, c.L, 4.1, 4.5, 0, 0.12, 'stone:#b8b0a2');
    edgeStrip(c.S, c.F, crown.slice(1, -1), 0.22, 0, 0.06, buff);
    for (const s of [0.15, c.L - 0.15]) box(c.S, c.F, s - 0.15, s + 0.15, 13.0, 15.0, -0.1, 0.12, buff);
  }},
  // ---- 72 and 70 (twins, 19th-c. neo-renaissance): dark brown brick between cream stucco entablatures, two bays,
  // oval cartouches under a pedimented top cornice.
  ...(['72', '70'] as const).map((id): House => ({id, pand: id === '72' ? '0363100012175617' : '0363100012175618', draw: c => {
    const wall = 'brick:#46363a', stucco = 'stucco:#ddd5c2', cs = [0.95, 2.95];
    const sur = {w: 0.16, c: stucco, d: 0.05};
    const ground = id === '72'
      ? [{s: 0.9, w: 1.25, y0: 2.4, y1: 6.2, cols: 2, rows: 3}, door(2.9, 1.1, 2.1, 4.6, {surround: {w: 0.22, c: stucco, d: 0.08, cap: 0.2}}), {s: 2.9, w: 1.1, y0: 4.8, y1: 6.0, cols: 2}]
      : [{s: 1.0, w: 1.4, y0: 2.6, y1: 6.2, cols: 2, rows: 3}, {s: 2.95, w: 1.4, y0: 2.6, y1: 6.2, cols: 2, rows: 3}, door(1.0, 1.1, 0.05, 2.1)];
    const wins = [...ground, ...row(cs, 1.3, 7.8, 10.6, {cols: 2, rows: 2, surround: sur}), ...row(cs, 1.3, 11.8, 14.2, {cols: 2, rows: 2, surround: sur}), ...row(cs, 1.15, 15.4, 16.9, {cols: 2, surround: sur})];
    body(c, 18.4, [], [{y0: 0, y1: 2.0, c: 'stone:#8f8a82'}, {y0: 2.0, y1: 99, c: wall}], wins, wall);
    for (const s of [0.08, c.L - 0.08]) pilaster(c, s - 0.08, s + 0.08, 2.0, 18.4, stucco, 0.06);
    for (const [y0, y1] of [[6.5, 6.9], [11.0, 11.4], [14.7, 15.05]]) box(c.S, c.F, -0.02, c.L + 0.02, y0, y1, 0, 0.14, stucco);
    for (const s of cs) slabPoly(c.S, c.F, arc(s, 17.7, 0.55, 0.42, 0, Math.PI * 2, 14).slice(0, -1), -0.05, 0.12, stucco);
    box(c.S, c.F, -0.02, c.L + 0.02, 17.05, 17.25, 0, 0.1, stucco);
    entab(c, 18.4, 0.4, 0.45, 0.4, stucco, {consoles: [0.25, c.L / 2, c.L - 0.25]});
    // the pediment: a stucco frame round a dark tympanum
    slabPoly(c.S, c.F, [[-0.05, 19.25], [c.L + 0.05, 19.25], [c.L / 2, 20.9]], -0.3, 0.1, stucco);
    flat(c.S, c.F, [[0.5, 19.45], [c.L - 0.5, 19.45], [c.L / 2, 20.55]], [], wall, 0.11);
  }})),
  // ---- 68 (1770 front): charcoal-painted brick, four bays, five storeys, white console cornice with attic lights and
  // a low pediment.
  {id: '68', pand: '0363100012175698', draw: c => {
    const wall = 'paint:#4c4844', cs = [1.39, 3.59, 5.79, 7.99];
    const o = {cols: 2, rows: 2} as O;
    const wins = [
      ...row([cs[0], cs[1], cs[3]], 1.35, 1.5, 4.7, {cols: 2, rows: 4}), door(cs[2], 1.2, 0.3, 3.2), {s: cs[2], w: 1.2, y0: 3.4, y1: 4.7, cols: 1},
      ...row(cs, 1.35, 5.9, 8.1, {cols: 2, rows: 3}), ...row(cs, 1.35, 9.1, 11.3, {cols: 2, rows: 3}), ...row(cs, 1.35, 12.2, 14.2, o), ...row(cs, 1.35, 14.9, 16.6, o),
    ];
    body(c, 17.0, [], [], wins, wall);
    box(c.S, c.F, cs[2] - 0.35, cs[2] + 0.35, 5.0, 5.6, 0, 0.06, WHITE);
    entab(c, 17.0, 1.2, 0.5, 0.45, WHITE, {consoles: [0.2, 2.49, 4.69, 6.89, 9.18], lights: {cs, w: 1.0, y0: 17.25, y1: 17.9}});
    slabPoly(c.S, c.F, [[1.6, 18.7], [7.8, 18.7], [4.7, 19.9]], -0.3, 0.25, WHITE);
    for (const s of [0.4, c.L - 0.4]) box(c.S, c.F, s - 0.3, s + 0.3, 18.7, 19.5, -0.3, 0.3, WHITE);
  }},
  // ---- 66 (1990 behind an old front): charcoal paint, three bays, fanlight door left, white console cornice with
  // attic lights and a small crest.
  {id: '66', pand: '0363100012168544', draw: c => {
    const wall = 'paint:#4a4744', cs = [1.15, 3.0, 4.85];
    const wins = [
      door(cs[0], 1.15, 0.2, 2.8, {back: 'door:#7a4a2a'}), {s: cs[0], w: 1.15, y0: 2.95, y1: 4.6, cols: 1, back: 'glass:#30363a'},
      ...row(cs.slice(1), 1.3, 2.0, 4.7, {cols: 2, rows: 4}),
      ...row(cs, 1.3, 5.8, 7.9, {cols: 2, rows: 2}), ...row(cs, 1.3, 8.7, 10.7, {cols: 2, rows: 2}), ...row(cs, 1.3, 11.3, 13.2, {cols: 2, rows: 2}),
    ];
    body(c, 13.8, [], [], wins, wall);
    box(c.S, c.F, cs[0] - 0.4, cs[0] + 0.4, 5.0, 5.25, 0, 0.05, WHITE);
    entab(c, 13.8, 1.1, 0.5, 0.42, WHITE, {consoles: [0.2, 2.07, 3.93, 5.83], lights: {cs, w: 1.1, y0: 14.0, y1: 14.6}});
    box(c.S, c.F, c.L / 2 - 0.4, c.L / 2 + 0.4, 15.4, 16.1, -0.2, 0.2, WHITE);
  }},
  // ---- 64 (1625): salmon brick neck gable with rich white claw pieces, dark green frames, two white cartouches,
  // a segmental cap.
  {id: '64', pand: '0363100012168545', draw: c => {
    const wall = 'brick:#b98066', frame = FRAME, cs = [1.29, 3.49, 5.69];
    const crown = gables.neck(3.49, 3.0, 14.4, 18.0), o = {frame, cols: 2, rows: 2} as O;
    const wins = [
      door(cs[0], 1.25, 0.6, 3.2, {back: 'door:#3c4a44', frame}), {s: cs[0], w: 1.25, y0: 3.4, y1: 5.3, frame, back: 'glass:#30363a'},
      ...row(cs.slice(1), 1.45, 2.2, 5.4, o), ...row(cs, 1.45, 6.3, 8.6, o), ...row(cs, 1.45, 9.1, 11.3, o),
      {s: cs[1], w: 1.4, y0: 12.0, y1: 13.7, ...o}, {s: cs[1], w: 1.4, y0: 14.65, y1: 15.9, ...o},
    ];
    body(c, 14.4, crown, [], wins, wall);
    for (const s of [cs[0], cs[2]]) { slabPoly(c.S, c.F, arc(s, 12.85, 0.55, 0.55, 0, Math.PI * 2, 14).slice(0, -1), -0.05, 0.12, WHITE); }
    box(c.S, c.F, -0.05, 1.95, 14.25, 14.45, -0.3, 0.1, WHITE); box(c.S, c.F, 5.03, c.L + 0.05, 14.25, 14.45, -0.3, 0.1, WHITE);
    claw(c.S, c.F, 0.08, 1.99, 14.45, 3.0, WHITE, 0.16); claw(c.S, c.F, c.L - 0.08, 4.99, 14.45, 3.0, WHITE, 0.16);
    box(c.S, c.F, cs[1] - 0.55, cs[1] + 0.55, 16.4, 17.5, 0, 0.12, WHITE);
    cap(c, 3.49, 3.0, 18.0, 0.55, 'seg', WHITE);
  }},
  // ---- 62 (1740): grey-brown brick cornice house over a basement, three bays, door with a fanlight on the right.
  // The crop sits ~1 m left of the BAG span and reads 10 % tall against 3DBAG: bays re-centred, heights x 0.9.
  {id: '62', pand: '0363100012167493', draw: c => {
    const wall = 'brick:#5e5852', cs = [0.95, 2.7, 4.45], k = 0.9;
    const wins = sc(k, [
      ...row(cs.slice(0, 2), 1.25, 3.1, 6.5, {cols: 2, rows: 3}), door(cs[2], 1.2, 3.1, 5.6), {s: cs[2], w: 1.2, y0: 5.7, y1: 6.5, cols: 2},
      ...row(cs, 1.25, 7.8, 10.5, {cols: 2, rows: 3, sill: WHITE}), ...row(cs, 1.25, 11.8, 13.9, {cols: 2, rows: 2, sill: WHITE}), ...row(cs, 1.25, 15.3, 17.0, {cols: 2, rows: 2, sill: WHITE}),
    ]);
    body(c, 15.9, [], [{y0: 0, y1: 2.0, c: 'stone:#6e6a64'}, {y0: 2.0, y1: 99, c: wall}], wins, wall);
    box(c.S, c.F, cs[0] - 0.7, cs[2] + 0.7, 2.0, 2.15, 0, 0.1, 'stone:#9a968e');
    entab(c, 15.9, 0.9, 0.5, 0.4, WHITE, {consoles: [0.2, 1.82, 3.58, 5.13]});
  }},
  // ---- 60 (1740 front): charcoal brick, two bays, an ornate white entablature with an arched attic light over the
  // left bay.
  {id: '60', pand: '0363100012167492', draw: c => {
    const wall = 'brick:#4a4540', cs = [1.33, 3.53];
    const wins = [...row(cs, 1.5, 2.3, 5.4, {cols: 2, rows: 3, back: 'glass:#1d2124'}), ...row(cs, 1.5, 6.5, 9.2, {cols: 2, rows: 2}), ...row(cs, 1.5, 9.9, 12.1, {cols: 2, rows: 2}), ...row(cs, 1.5, 12.8, 14.7, {cols: 2, rows: 2})];
    body(c, 15.0, [], [{y0: 0, y1: 1.9, c: 'stone:#55504a'}, {y0: 1.9, y1: 99, c: wall}], wins, wall);
    entab(c, 15.0, 1.3, 0.5, 0.42, WHITE, {consoles: [0.2, 2.43, 4.65]});
    slabPoly(c.S, c.F, [[0.35, 16.8], [2.35, 16.8], [2.35, 17.2], ...arc(1.35, 17.2, 1.0, 1.0, 0, Math.PI, 10).slice(1, -1), [0.35, 17.2]], -0.3, 0.1, WHITE);
    flat(c.S, c.F, [[0.85, 16.9], [1.85, 16.9], ...arc(1.35, 17.4, 0.5, 0.5, 0, Math.PI, 8).slice(1, -1)], [], GLASS, 0.11);
    box(c.S, c.F, 3.6, 3.9, 15.6, 16.8, 0.06, 0.25, WHITE);
  }},
  // ---- 58 (1905 front): grey brick with white stucco banding, segmental voussoir arches with keystones, two arched
  // ground windows and a framed door, a deep white console cornice. Photo reads 10 % tall: x 0.9; bays re-centred.
  {id: '58', pand: '0363100012167495', draw: c => {
    const wall = 'brick:#5e5c58', stucco = 'stucco:#e8e4da', cs = [1.27, 3.75, 6.25];
    const arch = {h: 0.3, c: stucco, key: stucco};
    const wins = [
      {s: 1.25, w: 1.35, y0: 2.0, y1: 5.4, cols: 2, rows: 3, head: 'seg', rise: 0.3, lintel: arch}, {s: 3.75, w: 1.5, y0: 2.0, y1: 5.4, cols: 2, rows: 3, head: 'seg', rise: 0.3, lintel: arch},
      door(6.1, 1.2, 0.8, 5.1, {transom: 3.4, surround: {w: 0.35, c: stucco, d: 0.12, cap: 0.3}}),
      ...row(cs, 1.5, 6.75, 8.65, {cols: 2, rows: 3}), ...row(cs, 1.5, 9.7, 11.25, {cols: 2, rows: 2, head: 'seg', rise: 0.15, lintel: arch}), ...row(cs, 1.5, 12.3, 13.6, {cols: 2, rows: 2, head: 'seg', rise: 0.15, lintel: arch}),
    ];
    body(c, 14.3, [], [{y0: 0, y1: 1.6, c: 'stone:#8e8a84'}, {y0: 1.6, y1: 99, c: wall}], wins, wall);
    courses(c, [6.45, 9.45, 11.95, 6.5 + 1.1, 9.7 + 0.8], 0.18, stucco, wins, 0.04);
    box(c.S, c.F, -0.02, c.L + 0.02, 5.85, 6.45, 0, 0.16, stucco);
    entab(c, 14.3, 1.3, 0.6, 0.6, stucco, {consoles: [0.25, 2.5, 5.0, 7.27]});
  }},
  // ---- 56 (1615, 1900s front): red-brown brick with cream bands and voussoir arches, a grey stone portal on the left,
  // two segmental ground windows, a cream frieze with vents.
  {id: '56', pand: '0363100012167494', draw: c => {
    const wall = 'brick:#6e3e33', cream = 'stucco:#e3dccb', stone = 'stone:#8a8784', cs = [1.48, 3.78, 6.08];
    const arch = {h: 0.28, c: cream, key: cream};
    const wins = [
      door(1.25, 1.15, 0.9, 4.5, {transom: 3.6, surround: {w: 0.45, c: stone, d: 0.18, cap: 0.35}}),
      ...row([3.73, 6.03], 1.3, 2.1, 5.5, {cols: 2, rows: 3, head: 'seg', rise: 0.3, lintel: arch}),
      ...row(cs, 1.4, 6.9, 9.1, {cols: 2, rows: 2}), ...row(cs, 1.4, 10.0, 11.7, {cols: 2, rows: 2, head: 'seg', rise: 0.15, lintel: arch}), ...row(cs, 1.4, 12.8, 14.2, {cols: 2, rows: 2}),
    ];
    body(c, 14.8, [], [{y0: 0, y1: 1.8, c: stone}, {y0: 1.8, y1: 99, c: wall}], wins, wall);
    courses(c, [6.55, 9.3, 9.7, 12.0, 12.5], 0.16, cream, wins, 0.04);
    box(c.S, c.F, 0, 2.5, 5.9, 6.9, 0, 0.2, stone);
    entab(c, 14.8, 1.0, 0.5, 0.5, cream, {lights: {cs: [1.2, 3.43, 5.66], w: 0.9, y0: 15.15, y1: 15.45}});
    box(c.S, c.F, -0.02, c.L + 0.02, 16.3, 17.0, -0.3, 0.1, cream);
  }},
  // ---- 54 (1615, neo-classical front): pale stucco over a grey rusticated plinth, a grey stone centre risalit with the
  // arched door, balcony and segmental attic, five bays with white architraves, a deep console cornice.
  {id: '54', pand: '0363100012169218', draw: c => {
    const wall = 'stucco:#c4cbbf', ground = 'stucco:#c9c7a8', stone = 'stone:#8a9599', cs = [1.5, 3.7, 7.02, 10.34, 12.54];
    const sur = {w: 0.22, c: WHITE, d: 0.08, cap: 0.22};
    const wins = [
      ...row([cs[0], cs[1], cs[3], cs[4]], 1.3, 2.3, 5.5, {cols: 2, rows: 3}), door(cs[2], 1.35, 1.6, 5.0, {back: 'door:#5a3424', head: 'round', transom: 2.6}),
      ...row(cs, 1.3, 6.8, 8.8, {cols: 2, rows: 3, surround: sur}), ...row(cs, 1.25, 10.1, 11.3, {cols: 2, rows: 2, surround: sur}),
    ];
    body(c, 12.5, [], [{y0: 0, y1: 1.9, c: 'stone:#8e9190'}, {y0: 1.9, y1: 6.0, c: ground}, {y0: 6.0, y1: 99, c: wall}], wins, wall);
    // risalit: grey stone piers either side of the centre bay, proud of the wall
    for (const [a, b] of [[4.6, 6.1], [7.94, 9.44]]) box(c.S, c.F, a, b, 1.9, 12.5, 0, 0.18, stone);
    box(c.S, c.F, 6.1, 7.94, 5.15, 6.2, 0, 0.18, stone);
    edgeStrip(c.S, c.F, arc(cs[2], 4.33, 0.82, 0.82, 0, Math.PI, 10), 0.25, 0, 0.12, stone);
    box(c.S, c.F, 0, c.L, 5.8, 6.25, 0, 0.18, stone);
    box(c.S, c.F, 5.5, 8.55, 6.25, 6.5, 0, 0.9, stone); box(c.S, c.F, 5.6, 8.45, 6.5, 7.4, 0.78, 0.86, 'metal:#2a2c2e');
    box(c.S, c.F, 5.4, 8.65, 0, 1.6, 0, 1.6, 'stone:#9a9c9a');
    entab(c, 12.5, 1.1, 0.7, 0.7, WHITE, {consoles: Array.from({length: 13}, (_, k) => 0.4 + k * 1.103)});
    const R = (3.2 * 3.2 + 2.0 * 2.0) / 4.0, a = Math.asin(3.2 / R);
    slabPoly(c.S, c.F, [[cs[2] - 3.2, 14.3], [cs[2] + 3.2, 14.3], ...arc(cs[2], 16.3 - R, R, R, Math.PI / 2 - a, Math.PI / 2 + a, 14).slice(1, -1)], -0.4, 0.4, WHITE);
  }},
  // ---- 52 and 50 (one pand, 1979 behind old fronts) -------------------------------------------------------------------
  // 52: charcoal brick, five bays, the white doorcase with an arched fanlight and the window over it, a cream frieze with
  // attic lights under a console cornice.
  {id: '52', pand: '0363100012169272', s0: 0, L: 14.4, draw: c => {
    const wall = 'brick:#45403b', cream = 'stucco:#ece3cb', cs = [1.28, 3.58, 6.92, 10.32, 12.72];
    const side = [cs[0], cs[1], cs[3], cs[4]];
    const wins = [
      ...row(side, 1.45, 1.5, 4.9, {cols: 2, rows: 3}), door(cs[2], 1.3, 0.4, 4.6, {head: 'round', transom: 3.2}),
      ...row(cs, 1.45, 5.9, 8.6, {cols: 2, rows: 3}), ...row(cs, 1.45, 9.4, 11.4, {cols: 2, rows: 2}),
    ];
    body(c, 12.0, [], [], wins, wall);
    for (const [a, b] of [[5.55, 6.0], [7.84, 8.29]]) box(c.S, c.F, a, b, 0, 5.6, 0, 0.14, 'stucco:#e6e2d6');
    box(c.S, c.F, 5.4, 8.44, 5.6, 5.95, 0, 0.3, 'stucco:#e6e2d6');
    edgeStrip(c.S, c.F, arc(cs[2], 3.95, 0.75, 0.75, 0, Math.PI, 10), 0.18, 0, 0.1, 'stucco:#e6e2d6');
    for (const [a, b] of [[5.95, 6.2], [7.64, 7.89]]) box(c.S, c.F, a, b, 5.95, 8.7, 0, 0.1, 'stucco:#e6e2d6');
    box(c.S, c.F, 5.85, 7.99, 8.6, 8.95, 0, 0.25, 'stucco:#e6e2d6');
    entab(c, 12.0, 1.6, 0.5, 0.5, cream, {consoles: Array.from({length: 13}, (_, k) => 0.3 + k * 1.15), lights: {cs: side, w: 1.1, y0: 12.4, y1: 13.0}});
  }},
  // 50: charcoal brick, three bays of segmental-headed windows with white keystones and bracketed white sills, a thin
  // white cornice, a date stone.
  {id: '50', pand: '0363100012169272', s0: 14.4, L: 5.09, draw: c => {
    const wall = 'brick:#46423e', cs = [0.85, 2.55, 4.25];
    const o = {cols: 2, rows: 2, head: 'seg', rise: 0.18, sill: WHITE, lintel: {h: 0.05, c: wall, key: WHITE}} as O;
    const wins = [...row(cs, 1.2, 2.4, 4.6, o), ...row(cs, 1.2, 5.7, 7.9, o), ...row(cs, 1.2, 8.9, 11.1, o), ...row(cs, 1.2, 12.0, 14.0, o)];
    body(c, 14.6, [], [{y0: 0, y1: 1.6, c: 'stone:#6a6662'}, {y0: 1.6, y1: 99, c: wall}], wins, wall);
    for (const y of [5.62, 8.82]) for (const s of cs) box(c.S, c.F, s - 0.7, s + 0.7, y - 0.1, y, 0, 0.14, WHITE);
    box(c.S, c.F, 2.25, 2.85, 11.6, 11.85, 0, 0.04, WHITE);
    entab(c, 14.6, 0.35, 0.3, 0.3, WHITE);
  }},
];

// ===== the shell and the fronts ========================================================================================
function frontFrame(p: Pand): FF {
  const {a, b} = p.front, L = Math.hypot(b[0] - a[0], b[1] - a[1]), t: P2 = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n: P2 = [-t[1], t[0]];
  const cx = p.ring.reduce((s, q) => s + q[0], 0) / p.ring.length, cz = p.ring.reduce((s, q) => s + q[1], 0) / p.ring.length;
  const mid: P2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if ((mid[0] - cx) * n[0] + (mid[1] - cz) * n[1] < 0) throw new Error(`${p.pand}: front a->b does not run left to right as seen (normal points in)`);
  return {o: a, t, n, len: L};
}
/** 3DBAG walls on the measured front line (rebuilt by the fronts): facing the street, within 1 m of the line, inside its span. */
function isFront(s: Surface, F: FF) {
  // anything of the shell standing in front of the rebuilt face (centroid out of the front plane, inside its span):
  // the old front's steps and returns, seen edge-on as stripes across the new front
  const r = s.rings[0], cx = r.reduce((a, q) => a + q[0], 0) / r.length, cz = r.reduce((a, q) => a + q[2], 0) / r.length;
  const co = (cx - F.o[0]) * F.n[0] + (cz - F.o[1]) * F.n[1], ct = (cx - F.o[0]) * F.t[0] + (cz - F.o[1]) * F.t[1];
  if (co > -0.25 && ct > 0 && ct < F.len) return true;
  if (s.type !== 'WallSurface') return false;
  // a street-side wall of the old front's set-backs (any normal but a party wall's), touching the front plane
  if (ct > 0.3 && ct < F.len - 0.3 && Math.max(...r.map(q => (q[0] - F.o[0]) * F.n[0] + (q[2] - F.o[1]) * F.n[1])) > -0.3) {
    let nx = 0, nz = 0;
    for (let k = 0; k < r.length; k++) { const a = r[k], b = r[(k + 1) % r.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
    const nl = Math.hypot(nx, nz) || 1;
    if (Math.abs((nx * F.t[0] + nz * F.t[1]) / nl) < 0.9) return true;
  }
  return s.rings[0].every(q => {
    const dx = q[0] - F.o[0], dz = q[2] - F.o[1], o = dx * F.n[0] + dz * F.n[1], t = dx * F.t[0] + dz * F.t[1];
    return Math.abs(o) < 1.0 && t > -0.5 && t < F.len + 0.5;
  });
}

export function buildBlock(sinkFor: (tag: string) => Sink, src: Src) {
  for (const p of src.pands) {
    const F = frontFrame(p), S = sinkFor(`shell-${p.pand}`);
    const roof = p.pand === '0363100012175703' ? TILE : SLATE;
    for (const s of p.surfaces) {
      if (s.type === 'GroundSurface' || isFront(s, F)) continue;
      const g = planarPolygon(s.rings);
      if (g) S.add(g, s.type === 'RoofSurface' ? roof : SIDE);
    }
  }
  for (const h of HOUSES) {
    const p = src.pands.find(q => q.pand === h.pand);
    if (!p) throw new Error(`${h.id}: pand ${h.pand} not in the source`);
    const PF = frontFrame(p), L = h.L ?? PF.len, F = subF(PF, h.s0 ?? 0, L);
    h.draw({S: sinkFor(`house-${h.id}`), F, L});
  }
}
export const HOUSE_IDS = HOUSES.map(h => ({id: h.id, pand: h.pand, s0: h.s0 ?? 0, L: h.L}));

