/**
 * The outline of one street front from its record, in metres: x along the pand's strip span, y above the street, from
 * the bottom-left corner clockwise to the bottom-right. The full width rises to frontTopM; a gable narrows from the
 * shoulder (or the front top) to its neck/cap width up to crown.topM (a point gable as a triangle); over a cornice, a
 * raised dormer, a raised crown or an ornament adds a centred band. Null without a measured front top.
 */
import type {FrontFields} from './frontRecord.ts';

export function outlineOf(f: Pick<FrontFields, 'frontTopM' | 'crown'>, x0: number, x1: number): [number, number][] | null {
  if (f.frontTopM === null) return null;
  const top = f.frontTopM, c = f.crown, mid = (x0 + x1) / 2, w = x1 - x0;
  const r = (v: number) => Math.round(v * 100) / 100;
  const pts: [number, number][] = [[x0, 0], [x0, top]];
  const gable = c.family !== null && ['neck', 'bell', 'point', 'step', 'spout'].includes(c.family) && c.topM !== null && c.topM > top;
  if (gable && c.family === 'point') pts.push([mid, c.topM!]);
  else if (gable) {
    const capW = Math.min(w, c.neckWidthM ?? c.widthM ?? 0.4 * w);
    const sh = Math.max(top, Math.min(c.shoulderM ?? top, c.topM! - 0.3));
    pts.push([mid - capW / 2, sh], [mid - capW / 2, c.topM!], [mid + capW / 2, c.topM!], [mid + capW / 2, sh]);
  } else {
    const d = c.dormer;
    const band = d && d.topM !== null && d.topM > top ? {t: d.topM, w: 0.35 * w}
      : c.topM !== null && c.topM > top + 0.2 ? {t: c.topM, w: Math.min(w, c.widthM ?? 0.35 * w)}
      : c.ornamentTopM !== null && c.ornamentTopM > top ? {t: c.ornamentTopM, w: 0.25 * w} : null;
    if (band) pts.push([mid - band.w / 2, top], [mid - band.w / 2, band.t], [mid + band.w / 2, band.t], [mid + band.w / 2, top]);
  }
  pts.push([x1, top], [x1, 0]);
  return pts.map(([x, y]) => [r(x), r(y)]);
}
