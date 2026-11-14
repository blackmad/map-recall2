/**
 * Window correspondence: how well a drawn front's openings sit on the photo's traced openings (FrontTrace), as the IoU of
 * the two opening areas within each front, plus an aggregate over a row (sum of intersections / sum of unions, so a big
 * front weighs more than a sliver).
 *
 * Frames: x in metres along the pand's strip span (FrontTrace / SubFront frame), y in metres above the street. A drawn
 * front can be given as rectangles (best: the renderer's own window boxes) or as a mask predicate (e.g. glass pixels
 * classified on a Node render placed on the strip, see scripts/front-records/window-iou.ts).
 */
import type {FrontFields, FrontRecord, FrontRecordTable, Opening} from './frontRecord.ts';

export interface Rect { x: number; w: number; y: number; h: number }
export interface Box { x0: number; x1: number; y0: number; y1: number }
export interface IoU { iou: number; inter: number; union: number; measured: number; drawn: number }

const inRects = (rs: Rect[]) => (x: number, y: number) => rs.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);

/** IoU of two areas given as predicates, sampled on a `res` metre grid over `box` (areas in m²). */
export function iouOn(box: Box, a: (x: number, y: number) => boolean, b: (x: number, y: number) => boolean, res = 0.05): IoU {
  let inter = 0, union = 0, na = 0, nb = 0;
  for (let y = box.y0 + res / 2; y < box.y1; y += res) for (let x = box.x0 + res / 2; x < box.x1; x += res) {
    const pa = a(x, y), pb = b(x, y);
    if (pa) na++; if (pb) nb++; if (pa && pb) inter++; if (pa || pb) union++;
  }
  const c = res * res;
  return {iou: union ? inter / union : 1, inter: inter * c, union: union * c, measured: na * c, drawn: nb * c};
}

/** IoU of measured and drawn opening rectangles within one front's box. */
export function frontIoU(measured: Rect[], drawn: Rect[] | ((x: number, y: number) => boolean), box: Box, res = 0.05): IoU {
  return iouOn(box, inRects(measured), typeof drawn === 'function' ? drawn : inRects(drawn), res);
}

/** Every traced front of a face: key (pandId or pandId#i), address, its box and measured openings (all storeys). */
export function tracedFronts(table: FrontRecordTable, face: string): {key: string; record: FrontRecord; front: FrontFields; box: Box; openings: Opening[]}[] {
  const out: {key: string; record: FrontRecord; front: FrontFields; box: Box; openings: Opening[]}[] = [];
  for (const r of table.records.filter(x => x.face === face)) {
    const parts: [string, FrontFields, number, number][] = r.fronts?.length
      ? r.fronts.map((f, i) => [`${r.pandId}#${i}`, f, f.from, f.to])
      : [[r.pandId, r, 0, r.bagWidthM ?? 0]];
    for (const [key, f, x0, x1] of parts) {
      if (!f.trace || f.trace.confidence === 'low' || f.frontTopM === null) continue;
      const top = Math.max(f.frontTopM, ...f.trace.storeys.flat().map(o => o.y + o.h));
      out.push({key, record: r, front: f, box: {x0, x1, y0: 0, y1: top}, openings: f.trace.storeys.flat()});
    }
  }
  return out;
}

export interface RowScore { fronts: {key: string; address: string | null; iou: number; measuredM2: number; drawnM2: number}[]; aggregate: number; frontsScored: number }

/**
 * Score a drawn row against the traced fronts of a face. `drawn(key, box)` returns the drawn openings of that front
 * (rectangles in the span frame, or a predicate over the same frame), or null when the front is not drawn.
 * `ground: false` leaves the ground storey (shop openings, door) out of both sides.
 */
export function rowScore(table: FrontRecordTable, face: string, drawn: (key: string, box: Box) => Rect[] | ((x: number, y: number) => boolean) | null,
  opts: {ground?: boolean; res?: number} = {}): RowScore {
  const fronts: RowScore['fronts'] = [];
  let inter = 0, union = 0;
  for (const t of tracedFronts(table, face)) {
    const d = drawn(t.key, t.box);
    if (d === null) continue;
    const groundTop = opts.ground === false ? (t.front.trace!.shopBandTopM ?? t.front.groundStoreyTopM ?? 0) : 0;
    const box = {...t.box, y0: groundTop};
    const meas = (opts.ground === false ? t.front.trace!.storeys.slice(1).flat() : t.openings);
    const s = frontIoU(meas, d, box, opts.res);
    inter += s.inter; union += s.union;
    fronts.push({key: t.key, address: t.front === t.record ? t.record.address : (t.record.fronts!.find(f => f === t.front)!.addresses[0] ?? t.record.address), iou: Math.round(s.iou * 1000) / 1000,
      measuredM2: Math.round(s.measured * 100) / 100, drawnM2: Math.round(s.drawn * 100) / 100});
  }
  return {fronts, aggregate: union ? Math.round(inter / union * 1000) / 1000 : 0, frontsScored: fronts.length};
}
