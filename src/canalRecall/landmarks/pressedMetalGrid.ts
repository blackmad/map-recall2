/**
 * The shadow lines of a pressed (dimpled) metal cladding field as rectangles in wall-local coordinates, cut round the
 * openings in the field.
 *
 * Why: the Benthem Crouwel building of the Gerrit Rietveld Academie (2006) is clad all over in dark grey pressed-metal
 * panels whose dimples (about 0.3 m) give the box its texture; a plain grey box loses the one thing a rider remembers.
 * No material slot carries a texture, and a pyramid per dimple would cost tens of thousands of triangles, so the field
 * is drawn as a grid of thin proud lines at a chosen pitch (horizontal shadow lines under each dimple row, vertical
 * lines between the columns) that stop at ribbon windows and other openings. Pure geometry, no three.js; the same
 * (t, y) frame as holedWall.ts (t from the viewer's left end, y up).
 */
export type GridOpening = {t0: number; t1: number; y0: number; y1: number};
export type GridLine = {dir: 'h' | 'v'; t0: number; t1: number; y0: number; y1: number};
export type GridSpec = {
  length: number; y0: number; y1: number;
  /** Line spacing along t and y (metres). */
  pitch: number | {t: number; y: number};
  /** Line widths: horizontal lines are `h` tall, vertical lines `v` wide. */
  width: {h: number; v: number};
  openings?: GridOpening[];
  /** Clear gap kept between a line and an opening edge. */
  margin?: number;
};

const EPS = 1e-6;

/** Subtract the blocked intervals from [a, b]; pieces shorter than `min` are dropped. */
function subtract(a: number, b: number, blocked: [number, number][], min: number): [number, number][] {
  let pieces: [number, number][] = [[a, b]];
  for (const [c, d] of blocked) {
    const next: [number, number][] = [];
    for (const [p, q] of pieces) {
      if (d <= p || c >= q) { next.push([p, q]); continue; }
      if (c > p) next.push([p, c]);
      if (d < q) next.push([d, q]);
    }
    pieces = next;
  }
  return pieces.filter(([p, q]) => q - p >= min);
}

/** Horizontal lines bottom-up, then vertical lines left to right, each split round the openings. */
export function pressedMetalGrid(spec: GridSpec): GridLine[] {
  const {length: L, y0, y1} = spec;
  if (!(L > 0) || !(y1 > y0)) throw new Error(`pressedMetalGrid: empty field (length ${L}, y ${y0}..${y1})`);
  const pt = typeof spec.pitch === 'number' ? spec.pitch : spec.pitch.t, py = typeof spec.pitch === 'number' ? spec.pitch : spec.pitch.y;
  if (!(pt > 0) || !(py > 0)) throw new Error('pressedMetalGrid: pitch must be positive');
  const {h, v} = spec.width;
  if (!(h > 0 && h < py) || !(v > 0 && v < pt)) throw new Error('pressedMetalGrid: line widths must be positive and below the pitch');
  const m = spec.margin ?? 0.05, ops = spec.openings ?? [];
  const out: GridLine[] = [];
  // rows and columns centred in their cells: as many whole pitches as fit, the remainder split at both ends
  const nRows = Math.floor((y1 - y0) / py + EPS), offY = y0 + ((y1 - y0) - nRows * py) / 2;
  for (let k = 1; k < nRows + 1; k++) {
    const yc = offY + k * py - py / 2, lo = yc - h / 2, hi = yc + h / 2;
    const blocked = ops.filter(o => hi > o.y0 - m && lo < o.y1 + m).map(o => [o.t0 - m, o.t1 + m] as [number, number]);
    for (const [t0, t1] of subtract(0, L, blocked, Math.max(v, 0.05))) out.push({dir: 'h', t0, t1, y0: lo, y1: hi});
  }
  const nCols = Math.floor(L / pt + EPS), offT = (L - nCols * pt) / 2;
  for (let k = 0; k < nCols; k++) {
    const tc = offT + (k + 0.5) * pt;
    const t0 = tc - v / 2, t1 = tc + v / 2;
    const blocked = ops.filter(o => t1 > o.t0 - m && t0 < o.t1 + m).map(o => [o.y0 - m, o.y1 + m] as [number, number]);
    for (const [ya, yb] of subtract(y0, y1, blocked, Math.max(h, 0.05))) out.push({dir: 'v', t0, t1, y0: ya, y1: yb});
  }
  return out;
}
