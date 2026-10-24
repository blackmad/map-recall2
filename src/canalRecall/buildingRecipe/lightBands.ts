/**
 * Light horizontal bands in a measured facade mask (speklagen, stone string courses): rows of the cell mask where the
 * solid wall across most of the front is the lighter `trim` cluster, in a run no thicker than half a metre, with plain
 * wall above and below. Measurement proposes `dressings.bands` from them only when the crop shows clear bands at the same
 * place in at least two storeys; a light wall, a stone storey or white window frames (MASK.frame) never count.
 */
import {GROUND_BAND_M, MASK, rgbToLab, type FacadeImage, type FacadeMeasurement, type Rgb} from './measureFacade.ts';
import type {StoneDressings} from '../blockBuilding/dressings.ts';

export interface LightBand { v0: number; v1: number; share: number; storey: number; at: 'floor' | 'sill' | 'head' | 'mid' }

/** Thresholds: solid share of a band row, trim share of its solid cells, plain wall around it, thickest run (m), floor snap (m). */
export const LIGHT_BAND = {coverage: 0.5, trim: 0.6, around: 0.3, maxM: 0.5, floorSnapM: 0.35, lowM: GROUND_BAND_M, lighterL: 20} as const;

type MaskLike = Pick<FacadeMeasurement, 'mask' | 'cols' | 'rows' | 'cell' | 'box'>;

/**
 * Bands found in the mask (bottom to top); `lines` are the fitted storey lines [0, ground top, ..., top]. With the photo
 * (`image`, its box at u0 = 0 and `topM`, and the wall colour) a cell is light when its mean pixel is `lighterL` L* over
 * the wall, which also counts stone the colour clustering left unusable (overcast crops put white stone there); without
 * it, the mask's trim class decides. Openings (dark glass, frames) are never wall.
 */
export function lightBands(m: MaskLike, lines: number[], photo?: {image: FacadeImage; wall: Rgb}): LightBand[] {
  const L = LIGHT_BAND, rowStat: {coverage: number; trim: number}[] = [];
  const im = photo?.image, wallL = photo ? rgbToLab(photo.wall)[0] : 0;
  const lightAt = (r: number, c: number): boolean | null => {
    if (!im) return null;
    const v1 = m.box.v1 - r * m.cell, u0 = m.box.u0 + c * m.cell;
    const y0 = Math.max(0, Math.round((im.topM - v1) * im.ppm)), y1 = Math.min(im.height, Math.round((im.topM - v1 + m.cell) * im.ppm));
    const x0 = Math.max(0, Math.round(u0 * im.ppm)), x1 = Math.min(im.width, Math.round((u0 + m.cell) * im.ppm));
    let n = 0, R = 0, G = 0, B = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const k = y * im.width + x; if (im.valid && !im.valid[k]) continue; R += im.rgb[k * 3]; G += im.rgb[k * 3 + 1]; B += im.rgb[k * 3 + 2]; n++; }
    return n ? rgbToLab([R / n, G / n, B / n])[0] > wallL + L.lighterL : null;
  };
  for (let r = 0; r < m.rows; r++) {
    let solid = 0, trim = 0;
    for (let c = 0; c < m.cols; c++) {
      const q = m.mask[r * m.cols + c];
      if (im) { if (q === MASK.dark || q === MASK.frame) continue; const l = lightAt(r, c); if (l === null) continue; solid++; if (l) trim++; continue; }
      if (q === MASK.wall || q === MASK.trim) { solid++; if (q === MASK.trim) trim++; }
    }
    rowStat.push({coverage: solid / Math.max(1, m.cols), trim: solid ? trim / solid : 0});
  }
  const isBand = (r: number) => rowStat[r].coverage >= L.coverage && rowStat[r].trim >= L.trim;
  const vOf = (r: number) => m.box.v1 - (r + 0.5) * m.cell, maxRows = Math.round(L.maxM / m.cell), out: LightBand[] = [];
  for (let r = 0; r < m.rows; r++) {
    if (!isBand(r)) continue;
    let e = r;
    while (e + 1 < m.rows && isBand(e + 1)) e++;
    const run = e - r + 1, above = r - 2, below = e + 2;
    const plain = (k: number) => k >= 0 && k < m.rows && rowStat[k].coverage >= L.coverage && rowStat[k].trim < L.around;
    const v1 = vOf(r) + m.cell / 2, v0 = vOf(e) - m.cell / 2, mid = (v0 + v1) / 2;
    if (run <= maxRows && plain(above) && plain(below) && v0 >= L.lowM) {
      const share = rowStat.slice(r, e + 1).reduce((s, x) => s + x.trim, 0) / run;
      out.push({v0: +v0.toFixed(2), v1: +v1.toFixed(2), share: +share.toFixed(2), ...placeBand(mid, lines)});
    }
    r = e;
  }
  return out.reverse();
}

/** Where a band at height `v` sits: on a storey line (floor), or low/high/middle in its storey. */
export function placeBand(v: number, lines: number[]): {storey: number; at: LightBand['at']} {
  for (let k = 1; k + 1 < lines.length; k++) if (Math.abs(v - lines[k]) <= LIGHT_BAND.floorSnapM) return {storey: k, at: 'floor'};
  let s = 0;
  while (s + 2 < lines.length && v >= lines[s + 1]) s++;
  const f = (v - lines[s]) / Math.max(0.1, lines[s + 1] - lines[s]);
  return {storey: s, at: f < 0.4 ? 'sill' : f > 0.6 ? 'head' : 'mid'};
}

/**
 * `dressings.bands` from the bands found: the positions (floor, sill, head) seen in at least two storeys, on the storeys
 * where any of them was seen; null when the crop shows no such repeated band.
 */
export function proposeBands(bands: readonly LightBand[]): NonNullable<StoneDressings['bands']> | null {
  const at: ('floor' | 'sill' | 'head')[] = [], storeys = new Set<number>();
  for (const kind of ['floor', 'sill', 'head'] as const) {
    const where = new Set(bands.filter(b => b.at === kind).map(b => b.storey));
    if (where.size >= 2) { at.push(kind); for (const s of where) storeys.add(s); }
  }
  return at.length ? {at, storeys: [...storeys].sort((a, b) => a - b)} : null;
}
