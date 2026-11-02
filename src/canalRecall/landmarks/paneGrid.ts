/**
 * Multi-pane window grid: the outer frame and the glazing bars of a window divided into `cols` x `rows` panes, as flat
 * rectangles in the window's own plane (x across, 0 at the window's centre line; y up, 0 at the sill).
 *
 * Why (2026-11-02, Het Sieraad lane #201): Amsterdam School schools and offices (Westerman's Vierde Ambachtsschool,
 * 1921-24) glaze each bay with a wide cream timber frame of 15 to 25 small panes, often with a heavier transom where a
 * lower row of panes opens separately. The kit's `sashWindows` draws two-by-two sashes and the landmark builders hand-place
 * one cross bar; neither can say "five by four panes with a heavy transom over the bottom row". Pure geometry, no three.js.
 */
export interface PaneGridOptions {
  /** Clear width and height of the opening (m). */
  width: number;
  height: number;
  /** Panes across and up (>= 1). */
  cols: number;
  rows: number;
  /** Glazing bar width (m). */
  bar: number;
  /** Outer frame width (m), drawn inside the opening; 0 for no frame. */
  frame: number;
  /** Row indices (counted from the bottom, 1 .. rows-1) whose lower bar is a heavy transom of `transom` width. */
  transomRows?: number[];
  transom?: number;
  /** Relative pane heights per row from the bottom (default equal); length must equal `rows`. */
  rowWeights?: number[];
}

/** One bar or frame member: centre x, bottom y, width, height. */
export interface PaneRect {x: number; y: number; w: number; h: number}

export function paneGrid(o: PaneGridOptions): PaneRect[] {
  const {width: W, height: H, cols, rows, bar, frame: F} = o;
  if (!(W > 0 && H > 0 && cols >= 1 && rows >= 1 && Number.isInteger(cols) && Number.isInteger(rows))) throw Error('paneGrid: positive size and integer cols/rows required');
  if (o.rowWeights && o.rowWeights.length !== rows) throw Error('paneGrid: rowWeights length must equal rows');
  const out: PaneRect[] = [];
  if (F > 0) {
    out.push({x: 0, y: 0, w: W, h: F}, {x: 0, y: H - F, w: W, h: F});
    out.push({x: -W / 2 + F / 2, y: F, w: F, h: H - 2 * F}, {x: W / 2 - F / 2, y: F, w: F, h: H - 2 * F});
  }
  const iw = W - 2 * F, ih = H - 2 * F;
  for (let k = 1; k < cols; k++) out.push({x: -iw / 2 + (iw * k) / cols, y: F, w: bar, h: ih});
  const wts = o.rowWeights ?? Array.from({length: rows}, () => 1);
  const sum = wts.reduce((a, v) => a + v, 0);
  let acc = 0;
  for (let k = 1; k < rows; k++) {
    acc += wts[k - 1];
    const heavy = o.transomRows?.includes(k);
    const bw = heavy ? (o.transom ?? bar * 2) : bar;
    out.push({x: 0, y: F + (ih * acc) / sum - bw / 2, w: iw, h: bw});
  }
  return out;
}
