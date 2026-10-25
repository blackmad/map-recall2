/**
 * Per-storey opening sequences of a wall/not-wall cell mask (`MASK` values, row 0 at `box.v1`), for the likeness gate
 * (likeness.ts). The bay grid (measureFacade `analyseMask`) reduces a front to one typical window on one pitch; a row
 * that repeats a wide 3-4-light window and two narrow slots (Stadsloket Zuidoost, GitHub #58) folds into a single
 * "wide" or "tall" window and a pitch that counts every slot as a bay, so the photo and an exact model disagree. Here
 * every upper storey keeps its own sequence of openings:
 *
 * - the storey band's column profile (opening share of the usable cells, per 10 cm column) is cut at
 *   `max(0.12, 0.45 x the band's p95)`; runs narrower than 0.25 m are noise, runs parted by less than 0.2 m of wall
 *   are one opening (a mullion read as wall);
 * - each opening keeps its width, its height (the rows of the band where at least half its columns are openings) and
 *   its shape class (height / width: tall > 1.4, wide < 0.7, else square); an opening touching an unseen column or the
 *   box edge is `partial` (counted, not measured);
 * - only window storeys are judged: a band glazed over `glazedStorey` (0.68, the curtain-wall class: a glazed arcade
 *   or hall storey, whose rhythm is its piers) or without an opening is left out. Every other storey, attic friezes
 *   included, adds its openings: the front is the sequence of all of them;
 * - with the photo's `wallLike` cells (GitHub #61), a would-be ribbon (>= 8 m) is cut where >= 0.3 m of it is
 *   wall-coloured: a ribbon is glass along its length, not brick or a sill course joining two window groups.
 *
 * `compareRowOpenings` judges a model against the photo on those, storey by storey first: a storey where one side has a
 * ribbon (an opening >= 8 m) and the other a punched row under that ribbon's span (two or more windows lying in it, all
 * under 4 m, covering under 60 % of the span: windows between thin piers are a ribbon too, and a photo ribbon read
 * through branches over such a row is not a mismatch, Spinoza Lyceum walls[0]; windows elsewhere in the storey are no
 * contradiction, Stadsloket Zuidoost walls[0]) is a row mismatch (Politie Postjesweg
 * walls[1]: a 20 m ribbon window over a row of slots, modelled as six paired windows), which likeness.ts FAILs. Then
 * over all window storeys: the median count of openings per window storey
 * (within 20 %, the column tolerance), the per-opening shape mix (total variation distance <= 0.35 between the
 * tall/square/wide fractions) and the width spread (median and p90 width within a factor 1.5). likeness.ts lets a
 * match on all three overrule the folded window only where the photo's row is mixed in width (no class holds
 * `uniformShare` of the openings and the p90 width is at least `mixedWidthRatio` x the median). Pure: no I/O.
 */
import {MASK, type FacadeBox} from './measureFacade.ts';

export type OpeningShape = 'tall' | 'square' | 'wide';
export interface RowOpening { u0: number; u1: number; w: number; h: number; shape: OpeningShape; partial: boolean }
export interface OpeningRow { storey: number; lo: number; hi: number; share: number; openings: RowOpening[];
  /** summed opening width over the seen width of the storey: a punched row ~0.2-0.5, a ribbon or a row broken only by thin piers ~0.8+ */
  cover: number }
export interface RowOpeningSummary {
  /** window storeys only (see the module comment) */
  rows: OpeningRow[];
  /** median openings per window storey; null without a window storey */
  count: number | null;
  /** fractions of the measured (not partial) openings per shape class */
  mix: Record<OpeningShape, number>;
  /** median and p90 of the measured opening widths (m) */
  widthP50: number | null; widthP90: number | null;
  measured: number;
}

export const ROW_OPENINGS = {minShare: 0.12, relShare: 0.45, minWidthM: 0.25, mergeGapM: 0.2, glazedStorey: 0.68, uniformShare: 0.8, mixedWidthRatio: 1.8,
  minStoreyM: 2, count: 0.2, mixTv: 0.35, widthRatio: 1.5, minMeasured: 4, ribbonM: 8, windowMaxM: 4, punchedCover: 0.6,
  wallLikeShare: 0.6, wallLikeRunM: 0.3, spanOverlap: 0.5} as const;

const isOpening = (m: number) => m === MASK.dark || m === MASK.frame;
const shapeOf = (aspect: number): OpeningShape => (aspect > 1.4 ? 'tall' : aspect < 0.7 ? 'wide' : 'square');
const quantile = (v: number[], q: number) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))] : NaN; };

export function rowOpenings(a: {mask: Uint8Array; cols: number; rows: number; cell: number; box: FacadeBox; lines: number[]; groundBandM?: number;
  /** 1 where the photo's colour cluster at the cell is a wall cluster (measureFacade `labels`/`clusters[].wall`): a ribbon is split where it is wall-coloured */
  wallLike?: Uint8Array}): RowOpeningSummary {
  const {mask, cols, rows, cell, box, lines, wallLike} = a, gb = a.groundBandM ?? 2.5, R = ROW_OPENINGS;
  const vOf = (j: number) => box.v1 - (j + 0.5) * cell;
  const all: OpeningRow[] = [];
  for (let s = 1; s + 1 < lines.length; s++) {
    const lo = Math.max(lines[s], gb, box.v0), hi = Math.min(lines[s + 1], box.v1 - 0.3);
    if (hi - lo < R.minStoreyM) continue;
    const js: number[] = [];
    for (let j = 0; j < rows; j++) { const v = vOf(j); if (v >= lo && v < hi) js.push(j); }
    // column profile: opening share of the usable cells; NaN where under half the column is seen
    const prof = new Array<number>(cols).fill(NaN);
    let seen = 0, open = 0;
    for (let i = 0; i < cols; i++) {
      let n = 0, o = 0;
      for (const j of js) { const m = mask[j * cols + i]; if (m === MASK.unusable) continue; n++; if (isOpening(m)) o++; }
      seen += n; open += o;
      if (n >= js.length * 0.5) prof[i] = o / n;
    }
    if (seen < js.length * cols * 0.4) continue;
    const finite = prof.filter(Number.isFinite), thr = Math.max(R.minShare, R.relShare * quantile(finite, 0.95));
    // runs over the threshold, gaps under mergeGapM closed
    const on = prof.map(p => Number.isFinite(p) && p > thr);
    const gapMax = Math.round(R.mergeGapM / cell);
    for (let i = 0; i < cols;) {
      if (on[i]) { i++; continue; }
      let k = i; while (k < cols && !on[k] && Number.isFinite(prof[k])) k++;
      if (i > 0 && k < cols && on[k] && on[i - 1] && k - i < gapMax) for (let x = i; x < k; x++) on[x] = true;
      i = Math.max(k, i + 1);
    }
    // A ribbon is glass along its length: where a run of a would-be ribbon (>= ribbonM) is wall-coloured over >= wallLikeRunM
    // (>= wallLikeShare of its opening cells in a wall colour cluster), it is wall the opening pass joined to the windows
    // beside it (Utrechtsestraat 15 walls[2]: brick and a sill course between two three-light groups read as a 10.9 m
    // ribbon), and the run is cut there. Only ribbons are cut, so every other opening is as before.
    if (wallLike) {
      const ribbonCells = Math.round(R.ribbonM / cell), runCells = Math.round(R.wallLikeRunM / cell);
      for (let i = 0; i < cols;) {
        if (!on[i]) { i++; continue; }
        let k = i; while (k < cols && on[k]) k++;
        if (k - i >= ribbonCells) {
          const wl = (x: number) => { let o = 0, w = 0; for (const j of js) { const q = j * cols + x; if (!isOpening(mask[q])) continue; o++; if (wallLike[q]) w++; } return o > 0 && w / o >= R.wallLikeShare; };
          for (let x = i; x < k;) {
            if (!wl(x)) { x++; continue; }
            let y = x; while (y < k && wl(y)) y++;
            if (y - x >= runCells) for (let z = x; z < y; z++) on[z] = false;
            x = y;
          }
        }
        i = k;
      }
    }
    const openings: RowOpening[] = [];
    for (let i = 0; i < cols;) {
      if (!on[i]) { i++; continue; }
      let k = i; while (k < cols && on[k]) k++;
      const w = (k - i) * cell;
      if (w >= R.minWidthM - 1e-9) {
        const partial = i === 0 || k === cols || !Number.isFinite(prof[i - 1]) || !Number.isFinite(prof[k]);
        let hRows = 0;
        for (const j of js) { let o = 0, n = 0; for (let x = i; x < k; x++) { const m = mask[j * cols + x]; if (m === MASK.unusable) continue; n++; if (isOpening(m)) o++; } if (n && o / n >= 0.5) hRows++; }
        const h = hRows * cell;
        openings.push({u0: +(box.u0 + i * cell).toFixed(2), u1: +(box.u0 + k * cell).toFixed(2), w: +w.toFixed(2), h: +h.toFixed(2), shape: shapeOf(h / w), partial});
      }
      i = k;
    }
    const seenW = prof.filter(Number.isFinite).length * cell;
    all.push({storey: s, lo: +lo.toFixed(2), hi: +hi.toFixed(2), share: seen ? +(open / seen).toFixed(3) : 0, openings, cover: seenW > 0 ? +(openings.reduce((x, o) => x + o.w, 0) / seenW).toFixed(3) : 0});
  }
  const rowsW = all.filter(r => r.share < R.glazedStorey && r.openings.length > 0);
  const measuredOpenings = rowsW.flatMap(r => r.openings.filter(o => !o.partial));
  const mix: Record<OpeningShape, number> = {tall: 0, square: 0, wide: 0};
  for (const o of measuredOpenings) mix[o.shape] += 1 / measuredOpenings.length;
  const widths = measuredOpenings.map(o => o.w);
  return {rows: rowsW, count: rowsW.length ? quantile(rowsW.map(r => r.openings.length), 0.5) : null,
    mix: {tall: +mix.tall.toFixed(3), square: +mix.square.toFixed(3), wide: +mix.wide.toFixed(3)},
    widthP50: widths.length ? +quantile(widths, 0.5).toFixed(2) : null, widthP90: widths.length ? +quantile(widths, 0.9).toFixed(2) : null, measured: measuredOpenings.length};
}

export interface RowOpeningsComparison {
  photo: {count: number | null; mix: Record<OpeningShape, number>; widthP50: number | null; widthP90: number | null; measured: number};
  model: {count: number | null; mix: Record<OpeningShape, number>; widthP50: number | null; widthP90: number | null; measured: number};
  /** null: the photo has too few measured openings to judge (the caller falls back to the bay grid) */
  countPass: boolean | null; mixTv: number | null; mixPass: boolean | null; widthPass: boolean | null;
  /** storeys where one side has a ribbon (an opening >= `ribbonM`) and the other a punched row: at least two openings, all
   *  under `windowMaxM`, covering under `punchedCover` of the storey (windows between thin piers read as a ribbon) */
  rowMismatch: {storey: number; photoMaxM: number; modelMaxM: number}[];
  reasons: string[];
}

/** Judge the model's opening sequences against the photo's (see the module comment). */
export function compareRowOpenings(photo: RowOpeningSummary, model: RowOpeningSummary): RowOpeningsComparison {
  const R = ROW_OPENINGS, strip = (s: RowOpeningSummary) => ({count: s.count, mix: s.mix, widthP50: s.widthP50, widthP90: s.widthP90, measured: s.measured});
  // row by row: a ribbon on one side where the other has windows (or the reverse) in the same storey
  const rowMismatch: RowOpeningsComparison['rowMismatch'] = [];
  for (const pr of photo.rows) {
    const mr = model.rows.find(r => r.storey === pr.storey);
    if (!mr) continue;
    const pMax = Math.max(0, ...pr.openings.map(o => o.w)), mMax = Math.max(0, ...mr.openings.map(o => o.w));
    // judged under the ribbon itself: the other side's openings that lie (>= spanOverlap of their width) inside the
    // ribbon's span are a punched row when there are two or more, all under windowMaxM, covering under punchedCover of
    // the span. Windows elsewhere in the storey do not contradict a ribbon (Stadsloket Zuidoost walls[0]: an 18 m window
    // box in a storey of punched windows, whose glass the photo reads as wall, against windows beside the box).
    const punchedUnder = (rib: RowOpening, other: OpeningRow) => {
      const inside = other.openings.filter(o => Math.min(o.u1, rib.u1) - Math.max(o.u0, rib.u0) >= R.spanOverlap * o.w);
      const cover = inside.reduce((x, o) => x + Math.min(o.u1, rib.u1) - Math.max(o.u0, rib.u0), 0) / Math.max(1e-6, rib.w);
      return inside.length >= 2 && inside.every(o => o.w < R.windowMaxM) && cover < R.punchedCover;
    };
    const against = (a: OpeningRow, b: OpeningRow) => a.openings.some(o => o.w >= R.ribbonM && punchedUnder(o, b));
    if (against(pr, mr) || against(mr, pr)) rowMismatch.push({storey: pr.storey, photoMaxM: pMax, modelMaxM: mMax});
  }
  const rowReasons = rowMismatch.map(r => `storey ${r.storey}: widest opening ${r.modelMaxM.toFixed(1)} m vs photo ${r.photoMaxM.toFixed(1)} m (a ribbon against windows)`);
  const judged = photo.measured >= R.minMeasured && photo.count !== null;
  if (!judged) return {photo: strip(photo), model: strip(model), countPass: null, mixTv: null, mixPass: null, widthPass: null, rowMismatch, reasons: rowReasons};
  const reasons: string[] = [...rowReasons];
  const countPass = model.count !== null && Math.abs(model.count - photo.count!) <= R.count * photo.count!;
  if (!countPass) reasons.push(`openings per storey ${model.count ?? 'none'} vs photo ${photo.count}`);
  const mixTv = model.measured ? +(0.5 * (['tall', 'square', 'wide'] as const).reduce((s, k) => s + Math.abs(model.mix[k] - photo.mix[k]), 0)).toFixed(3) : 1;
  const mixPass = mixTv <= R.mixTv;
  const fmt = (m: Record<OpeningShape, number>) => `${Math.round(m.tall * 100)}/${Math.round(m.square * 100)}/${Math.round(m.wide * 100)}`;
  if (!mixPass) reasons.push(`opening shapes tall/square/wide ${model.measured ? fmt(model.mix) : 'none'} vs photo ${fmt(photo.mix)} %`);
  const within = (x: number | null, y: number | null) => x !== null && y !== null && Math.max(x, y) <= R.widthRatio * Math.min(x, y);
  const widthPass = within(model.widthP50, photo.widthP50) && within(model.widthP90, photo.widthP90);
  if (!widthPass) reasons.push(`opening widths p50/p90 ${model.widthP50 ?? '-'}/${model.widthP90 ?? '-'} m vs photo ${photo.widthP50}/${photo.widthP90} m`);
  return {photo: strip(photo), model: strip(model), countPass, mixTv, mixPass, widthPass, rowMismatch, reasons};
}
