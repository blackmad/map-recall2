/**
 * The kit's one iron railing (K-stoep #360): posts, rails, newels and an optional baluster pattern, shared by the timber
 * balconies (oudWest.ts `timberBalconyGeometry`, its iron grille and turned balusters) and the stoops (stoop.ts).
 *
 * Facade frame, as every post-library pass: x along the front, y up, z outward from the wall plane. Geometry goes to a
 * caller's sink, so the same members draw into a GLB triangle soup (recipe houses, block-face chunks) and into the
 * generic streamed path's ExtraSink (facadeExtras.ts):
 *   - `guardRun`  a level guard (a handrail, a foot rail and bars or turned balusters at a pitch), the code the timber
 *                 balcony drew before it moved here, unchanged byte for byte (the balcony goldens pin it);
 *   - `slopedRun` a raking guard up a stair flight: handrail and foot rail parallel to the nosing line, vertical bars,
 *                 a newel at the foot. `plain` is a handrail on posts about a metre apart, `bars` adds the bars,
 *                 `ornate` adds a second (lower) rail, closer bars and a heavier newel with a finial.
 */
export type V3 = [number, number, number];
/** An axis-aligned box from (x0, y0, z0) to (x1, y1, z1); `skip` leaves out hidden faces ('top', 'bottom', 'back'). */
export type BoxFn = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, skip?: string[]) => void;
/** A planar quad; `n` is any vector on its outer side (the sink orients the winding by it). */
export type QuadFn = (a: V3, b: V3, c: V3, d: V3, n: V3) => void;
export interface RailSink { box: BoxFn; quad: QuadFn }

/** Baluster and guard proportions of a timber balcony (metres); the iron bar and pitch serve the stoop's level guards too. */
export const BALUSTER = {shaftM: 0.045, bulbM: 0.08, bulbHM: 0.26, bulbAtK: 0.42, railHM: 0.06, railDM: 0.08, baseHM: 0.07, insetM: 0.04, ironBarM: 0.018, ironPitchM: 0.14, turnedPitchM: 0.16};

/** One level guard run: along x (in front of the wall, at z = `at`) or along z (a return, at x = `at`), from `a` to `c`. */
export interface LevelRun { along: 'x' | 'z'; a: number; c: number; at: number }

/**
 * A level guard from `y` (its foot) to `top`: handrail, foot rail and the infill (`iron` bars or `turned` balusters).
 * Faces against the rails and the inner (back) faces are left out. Returns the balusters drawn.
 */
export function guardRun(box: BoxFn, r: LevelRun, y: number, top: number, kind: 'iron' | 'turned', guardM: number): number {
  const B = BALUSTER;
  const rail = (ya: number, yb: number, w: number) => r.along === 'x' ? box(r.a - w / 2, r.c + w / 2, ya, yb, r.at - w / 2, r.at + w / 2, ['back']) : box(r.at - w / 2, r.at + w / 2, ya, yb, r.a, r.c, ['back']);
  rail(top - B.railHM, top, B.railDM);
  rail(y, y + B.baseHM, B.railDM * 0.8);
  const pitch = kind === 'iron' ? B.ironPitchM : B.turnedPitchM, count = Math.max(1, Math.floor((r.c - r.a) / pitch));
  let balusters = 0;
  for (let k = 1; k < count; k++) {
    const t = r.a + (r.c - r.a) * k / count;
    const post = (w: number, ya: number, yb: number, skip: string[]) => r.along === 'x' ? box(t - w / 2, t + w / 2, ya, yb, r.at - w / 2, r.at + w / 2, skip) : box(r.at - w / 2, r.at + w / 2, ya, yb, t - w / 2, t + w / 2, skip);
    // Faces against the rails, and the inner (back) faces nobody sees from the street, are left out: 6 triangles a bar.
    if (kind === 'iron') post(B.ironBarM, y + B.baseHM, top - B.railHM, ['top', 'bottom', 'back']);
    else {
      // Turned baluster: a slim shaft and a bulb, both square in plan (12 triangles).
      const span = guardM - B.railHM - B.baseHM, mid = y + B.baseHM + span * B.bulbAtK;
      post(B.shaftM, y + B.baseHM, top - B.railHM, ['top', 'bottom', 'back']);
      post(B.bulbM, mid - B.bulbHM / 2, mid + B.bulbHM / 2, ['top', 'bottom', 'back']);
    }
    balusters++;
  }
  return balusters;
}

export type RailStyle = 'plain' | 'bars' | 'ornate';
/** Iron stair-guard proportions (metres): Herengracht/Keizersgracht stoop balustrades, 0.85-0.95 m over the nosings. */
export const STAIR_RAIL = {
  heightM: 0.9, railM: 0.045, footRailAboveM: 0.1, barM: 0.02,
  /** Bar pitch per style; `plain` has posts only, one a metre. */
  pitch: {plain: 1.0, bars: 0.13, ornate: 0.11} as Record<RailStyle, number>,
  /** `ornate`: the lower rail at this share of the guard height, a newel this wide with a finial this tall. */
  ornateRailK: 0.28, newelM: 0.07, ornateNewelM: 0.1, finialM: 0.12,
  /** The streamed path draws bars at this pitch at the least (a 13 cm grille aliases to grey at street distance). */
  streamPitchM: 0.26,
} as const;

/** A prism along a centre line (`p` to `q`, varying in one horizontal axis and y), `w` wide across and `h` tall (vertical section). */
function rakingBar(s: RailSink, p: V3, q: V3, w: number, h: number, along: 'x' | 'z'): void {
  const across = (pt: V3, d: number, dy: number): V3 => along === 'x' ? [pt[0], pt[1] + dy, pt[2] + d] : [pt[0] + d, pt[1] + dy, pt[2]];
  const lo = -w / 2, hi = w / 2, b = -h / 2, t = h / 2, nOut: V3 = along === 'x' ? [0, 0, 1] : [1, 0, 0], nIn: V3 = along === 'x' ? [0, 0, -1] : [-1, 0, 0];
  s.quad(across(p, lo, t), across(q, lo, t), across(q, hi, t), across(p, hi, t), [0, 1, 0]);
  s.quad(across(p, hi, b), across(q, hi, b), across(q, hi, t), across(p, hi, t), nOut);
  s.quad(across(p, lo, t), across(q, lo, t), across(q, lo, b), across(p, lo, b), nIn);
  s.quad(across(p, lo, b), across(p, hi, b), across(q, hi, b), across(q, lo, b), [0, -1, 0]);
}

/**
 * A raking guard on a stair flight. `foot0` and `foot1` are the walking line at the guard (the nosings), low end first;
 * they differ in one horizontal axis (`along`). `stream`: the streamed path's budget (bars as single outward quads, a
 * coarser pitch, no foot rail on `bars`). Returns the members drawn (handrail and rails count as one each).
 */
export function slopedRun(s: RailSink, foot0: V3, foot1: V3, style: RailStyle, opts: {heightM?: number; stream?: boolean; newel?: boolean} = {}): number {
  const R = STAIR_RAIL, H = opts.heightM ?? R.heightM, along: 'x' | 'z' = Math.abs(foot1[0] - foot0[0]) >= Math.abs(foot1[2] - foot0[2]) ? 'x' : 'z';
  const up = (pt: V3, dy: number): V3 => [pt[0], pt[1] + dy, pt[2]];
  let members = 0;
  rakingBar(s, up(foot0, H - R.railM / 2), up(foot1, H - R.railM / 2), R.railM, R.railM, along); members++;
  if (!(opts.stream && style !== 'ornate') && style !== 'plain') { rakingBar(s, up(foot0, R.footRailAboveM), up(foot1, R.footRailAboveM), R.railM * 0.8, R.railM * 0.8, along); members++; }
  if (style === 'ornate') { rakingBar(s, up(foot0, H * R.ornateRailK), up(foot1, H * R.ornateRailK), R.railM * 0.8, R.railM * 0.8, along); members++; }
  const run = Math.hypot(foot1[0] - foot0[0], foot1[2] - foot0[2]);
  const pitch = opts.stream ? Math.max(R.streamPitchM, R.pitch[style]) : R.pitch[style];
  const count = Math.max(1, Math.round(run / pitch)), bw = style === 'plain' ? R.railM : R.barM;
  for (let k = 1; k < count; k++) {
    const f = k / count, at: V3 = [foot0[0] + (foot1[0] - foot0[0]) * f, foot0[1] + (foot1[1] - foot0[1]) * f, foot0[2] + (foot1[2] - foot0[2]) * f];
    const y0 = at[1] + (style === 'plain' ? 0 : R.footRailAboveM), y1 = at[1] + H - R.railM;
    if (opts.stream) {
      // One flat bar facing out of the guard's plane (2 triangles).
      const d = bw / 2, n: V3 = along === 'x' ? [0, 0, 1] : [1, 0, 0];
      const p = (u: number, y: number): V3 => along === 'x' ? [at[0] + u, y, at[2]] : [at[0], y, at[2] + u];
      s.quad(p(-d, y0), p(d, y0), p(d, y1), p(-d, y1), n);
    } else s.box(at[0] - bw / 2, at[0] + bw / 2, y0, y1, at[2] - bw / 2, at[2] + bw / 2, ['top', 'bottom']);
    members++;
  }
  // The newel at the foot: a square post to the handrail (with a finial when ornate).
  if (opts.newel !== false) {
    const n = (style === 'ornate' ? R.ornateNewelM : R.newelM) / 2, top = foot0[1] + H + (style === 'ornate' ? R.finialM : 0.02);
    s.box(foot0[0] - n, foot0[0] + n, foot0[1], top, foot0[2] - n, foot0[2] + n, ['bottom']);
    members++;
  }
  return members;
}

/**
 * A level guard for a stoop landing in the given style: `bars` and `ornate` are the balcony's iron guard (guardRun),
 * `ornate` with a third rail; `plain` is a handrail on two end posts. `stream`: posts and handrail only, plus bars at
 * the stream pitch as single quads.
 */
export function landingRun(s: RailSink, r: LevelRun, y: number, style: RailStyle, opts: {heightM?: number; stream?: boolean} = {}): number {
  const H = opts.heightM ?? STAIR_RAIL.heightM, top = y + H;
  if (!opts.stream && style !== 'plain') {
    const bars = guardRun(s.box, r, y, top, 'iron', H);
    if (style === 'ornate') { const w = BALUSTER.railDM * 0.6, yy = y + H * STAIR_RAIL.ornateRailK; if (r.along === 'x') s.box(r.a, r.c, yy - w / 2, yy + w / 2, r.at - w / 2, r.at + w / 2, ['back']); else s.box(r.at - w / 2, r.at + w / 2, yy - w / 2, yy + w / 2, r.a, r.c, ['back']); }
    return bars + 2;
  }
  const p0: V3 = r.along === 'x' ? [r.a, y, r.at] : [r.at, y, r.a], p1: V3 = r.along === 'x' ? [r.c, y, r.at] : [r.at, y, r.c];
  // A level run is a raking run with no rake.
  return slopedRun(s, p0, p1, opts.stream ? style : 'plain', {heightM: H, stream: opts.stream, newel: false});
}
