import type {BuildingTools} from './cultural-builders';
import {frameOf, slab} from './nearbar-kit';
import {wallTop, type BayOptions, type Wall} from './worship-walls';

export type CleanBayOptions = BayOptions & {
  /** Fixed number of columns (defaults to the addBays rule: 3 above 1.6 m, 2 above 0.9 m, else 1). */
  cols?: number;
  /** Fixed number of rows (defaults to one per 1.2 m of height). */
  rows?: number;
  /** Explicit t positions along the wall (overrides margin/pitch). */
  at?: number[];
  /** Brick/stone surround projecting beyond the pane on each side (m), drawn as jambs in `trim`. */
  jamb?: number;
  /** How far the trim and bars stand proud of the wall (m). */
  proud?: number;
};

/**
 * Window bays like worship-walls `addBays`, but built from sunk, inset solids so none of the stone, frame or glass faces is
 * coplanar with the 3DBAG shell or with another part. The landmark audit counts coplanar faces as z-fight; `addBays` draws sills,
 * lintels and edge bars flush with the wall plane and the pane, which fails it on any model with more than a few bays.
 */
export function addBaysClean(b: BuildingTools, w: Wall, o: CleanBayOptions) {
  const f = frameOf(w), S = 0.04, proud = o.proud ?? 0.16, trim = o.trim ?? 'stone', frame = o.frame ?? 'frame', glass = o.glass ?? 'glass';
  let ts = o.at;
  if (!ts) {
    const margin = o.margin ?? 1, usable = w.length - 2 * margin;
    if (usable < o.wd) return 0;
    const n = Math.max(1, Math.floor((usable - o.wd) / o.pitch) + 1), start = w.length / 2 - ((n - 1) * o.pitch) / 2;
    ts = Array.from({length: n}, (_, i) => start + i * o.pitch);
  }
  let placed = 0;
  for (const t of ts) {
    const y = w.base + o.y;
    if (wallTop(w, t - o.wd / 2) < y + o.h + 0.5 || wallTop(w, t + o.wd / 2) < y + o.h + 0.5) continue;
    slab(b, f, t, y - 0.12, o.wd + 0.3 + (o.jamb ?? 0) * 2, 0.14, proud + S, trim, -S);
    slab(b, f, t, y + o.h, o.wd + 0.3 + (o.jamb ?? 0) * 2, 0.16, proud + S, trim, -S);
    if (o.jamb) for (const sg of [-1, 1]) slab(b, f, t + sg * (o.wd / 2 + o.jamb / 2 + 0.01), y - 0.12, o.jamb, o.h + 0.28, proud * 0.75 + S, trim, -S);
    slab(b, f, t, y, o.wd, o.h, 0.08, glass, 0.02);
    const rows = o.rows ?? Math.max(1, Math.round(o.h / 1.2)), cols = o.cols ?? (o.wd > 1.6 ? 3 : o.wd > 0.9 ? 2 : 1);
    for (let k = 1; k < rows; k++) slab(b, f, t, y + (o.h * k) / rows - 0.03, o.wd - 0.04, 0.06, 0.12, frame, 0.02);
    for (let k = 0; k <= cols; k++) {
      const edge = k === 0 ? -1 : k === cols ? 1 : 0;
      slab(b, f, t + (edge ? edge * (o.wd / 2 - 0.02) : -o.wd / 2 + (o.wd * k) / cols), y + 0.01, 0.08, o.h - 0.02, 0.12, frame, 0.02);
    }
    placed++;
  }
  return placed;
}
