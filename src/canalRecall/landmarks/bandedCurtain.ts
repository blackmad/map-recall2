/**
 * A banded curtain wall in wall-local coordinates: horizontal bands of vision glass and opaque spandrel (or frosted)
 * panels, a transom on every band edge and on any extra floor line, and mullions on a module or on given lines.
 *
 * Why: post-war and modern fronts read by their banding, not by punched windows: the Rietveld building's clear vision
 * bands between frosted bands (1967), the studio glazing on the north face of the Benthem Crouwel building (2006) with
 * its black floor spandrels. The facade systems draw such a front as one ribbon per storey and lose the band rhythm, and
 * bespoke builders kept re-deriving the same quads. Pure geometry, no three.js; the same (t, y) frame as holedWall.ts:
 *   t  along the wall from the viewer's left end (0) to the right end (length), facing the wall from outside;
 *   y  up.
 * Pieces are rectangles; `depth` is how far a transom or mullion stands proud of the panes (panes have depth 0).
 */
export type CurtainBand = {y0: number; y1: number; kind: 'vision' | 'spandrel'; floor?: number};
export type CurtainSpec = {
  length: number;
  /** Clip range of the wall (bands outside are dropped, bands across it are cut). */
  y0: number; y1: number;
  bands: CurtainBand[];
  /** Mullion pitch (the wall is split into round(length / module) equal bays) unless `lines` is given. */
  module?: number;
  /** Explicit mullion positions (metres from t = 0); the two wall ends always get one. */
  lines?: number[];
  /** t ranges glazed as vision in every band (a stair bay, an entrance): spandrels there become vision panes. */
  clear?: [number, number][];
  transom?: {w: number; depth: number};
  mullion?: {w: number; depth: number};
};
export type CurtainPiece = {part: 'vision' | 'spandrel' | 'transom' | 'mullion'; t0: number; t1: number; y0: number; y1: number; depth: number};

const EPS = 1e-6;

/** Every pane, transom and mullion of the wall, panes first, in band order bottom-up. */
export function bandedCurtain(spec: CurtainSpec): CurtainPiece[] {
  const {length: L, y0, y1} = spec;
  if (!(L > 0) || !(y1 > y0)) throw new Error(`bandedCurtain: empty wall (length ${L}, y ${y0}..${y1})`);
  const bands = [...spec.bands].sort((a, b) => a.y0 - b.y0);
  for (const b of bands) if (!(b.y1 > b.y0)) throw new Error(`bandedCurtain: band ${b.y0}..${b.y1} is empty`);
  for (let i = 1; i < bands.length; i++) if (bands[i].y0 < bands[i - 1].y1 - EPS) throw new Error(`bandedCurtain: bands overlap at y ${bands[i].y0}`);
  const tr = spec.transom ?? {w: 0.09, depth: 0.06}, mu = spec.mullion ?? {w: 0.09, depth: 0.1};
  const clear = (spec.clear ?? []).map(([a, b]) => [Math.max(0, Math.min(a, b)), Math.min(L, Math.max(a, b))] as [number, number]).filter(([a, b]) => b - a > EPS);
  const cuts = [...new Set([0, L, ...clear.flat()].map(t => Math.round(t * 1e4) / 1e4))].sort((a, b) => a - b);
  const isClear = (t: number) => clear.some(([a, b]) => t > a && t < b);
  const out: CurtainPiece[] = [];
  for (const b of bands) {
    const ya = Math.max(b.y0, y0), yb = Math.min(b.y1, y1);
    if (yb - ya < EPS) continue;
    for (let i = 0; i + 1 < cuts.length; i++) {
      const t0 = cuts[i], t1 = cuts[i + 1];
      if (t1 - t0 < EPS) continue;
      out.push({part: b.kind === 'spandrel' && isClear((t0 + t1) / 2) ? 'vision' : b.kind, t0, t1, y0: ya, y1: yb, depth: 0});
    }
  }
  // transoms on every band edge and floor line inside the clip range
  const ys = new Set<number>();
  for (const b of bands) { ys.add(b.y0); ys.add(b.y1); if (b.floor !== undefined) ys.add(b.floor); }
  for (const y of [...ys].sort((a, b) => a - b)) {
    if (y < y0 - EPS || y > y1 + EPS) continue;
    const lo = Math.max(y0, y - tr.w / 2), hi = Math.min(y1, y + tr.w / 2);
    if (hi - lo > EPS) out.push({part: 'transom', t0: 0, t1: L, y0: lo, y1: hi, depth: tr.depth});
  }
  // mullions: module bays or explicit lines, always both ends, each kept inside the wall
  const n = spec.lines ? 0 : Math.max(1, Math.round(L / (spec.module ?? 1.8)));
  const lines = spec.lines ?? Array.from({length: n + 1}, (_, i) => i * L / n);
  const ts = [...new Set([0, L, ...lines.filter(t => t > -EPS && t < L + EPS)].map(t => Math.round(t * 1e4) / 1e4))].sort((a, b) => a - b);
  const hw = mu.w / 2;
  for (const t of ts) {
    const c = Math.min(L - hw, Math.max(hw, t));
    out.push({part: 'mullion', t0: c - hw, t1: c + hw, y0, y1, depth: mu.depth});
  }
  return out;
}

/** Storey bands: a spandrel of `spandrel` metres straddling each floor (`below` of it under the floor line), vision above. */
export function storeyBands(floors: number[], top: number, spandrel: number, below: number): CurtainBand[] {
  const fs = [...floors].sort((a, b) => a - b), out: CurtainBand[] = [];
  for (let i = 0; i < fs.length; i++) {
    const s0 = fs[i] - below, s1 = fs[i] - below + spandrel, next = i + 1 < fs.length ? fs[i + 1] - below : top;
    if (!(s1 < next)) throw new Error(`storeyBands: spandrel at floor ${fs[i]} reaches the next floor`);
    out.push({y0: s0, y1: s1, kind: 'spandrel', floor: fs[i]});
    out.push({y0: s1, y1: next, kind: 'vision'});
  }
  return out;
}
