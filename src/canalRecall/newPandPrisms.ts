/**
 * Prisms for pands built after the AHN flight (BAG bouwjaar >= 2020) that the
 * city tiles do not draw. bagGaps.ts holds them back as 'newer-than-ahn' because
 * AHN4 may still show the predecessor; the register footprint is nevertheless
 * the truth, so they get a plain prism at a recorded fallback height:
 *
 *   1. 'neighbour-median': median `height` of drawn tile buildings whose centres lie
 *      within NEIGHBOUR_RADIUS_M, clamped to [6, 30] (needs >= 3 neighbours);
 *   2. 'area-default': 3 m under SHED_AREA_M2 (sheds, substations), else 9 m.
 *
 * The height source is written on the feature, so a later 3DBAG release or an AHN6
 * measurement replaces it without guessing which fills were measured.
 */
import { quantile, type BagGap } from './bagGaps';
import type { Ring } from './landmarks/osmUnderModels';

export const NEIGHBOUR_RADIUS_M = 120;
export const MIN_NEIGHBOURS = 3;
export const SHED_AREA_M2 = 40;
export const SHED_HEIGHT_M = 3;
export const DEFAULT_HEIGHT_M = 9;
export const MIN_NEIGHBOUR_HEIGHT_M = 6;
export const MAX_NEIGHBOUR_HEIGHT_M = 30;
export const MIN_NEW_PAND_AREA_M2 = 10;
export const MIN_NEW_PAND_YEAR = 2020;

export type NewPandHeightSource = 'neighbour-median' | 'area-default';
export interface NewPandHeight { height: number; source: NewPandHeightSource; neighbours: number }

export function newPandHeight(areaM2: number, neighbourHeights: readonly number[]): NewPandHeight {
  const usable = neighbourHeights.filter(h => Number.isFinite(h) && h > 0);
  if (areaM2 < SHED_AREA_M2) return { height: SHED_HEIGHT_M, source: 'area-default', neighbours: usable.length };
  if (usable.length >= MIN_NEIGHBOURS) {
    const m = quantile(usable, 0.5)!;
    return { height: Math.round(Math.min(MAX_NEIGHBOUR_HEIGHT_M, Math.max(MIN_NEIGHBOUR_HEIGHT_M, m)) * 10) / 10, source: 'neighbour-median', neighbours: usable.length };
  }
  return { height: DEFAULT_HEIGHT_M, source: 'area-default', neighbours: usable.length };
}

/** Whether a gap is a post-AHN pand this lane fills (the complement of bagGaps' 'newer-than-ahn'). */
export const isNewPandGap = (gap: BagGap): boolean =>
  gap.year !== null && gap.year >= MIN_NEW_PAND_YEAR && gap.areaM2 >= MIN_NEW_PAND_AREA_M2 && gap.tileCover <= 0.2 && (gap.modelCover ?? 0) <= 0.05;

export interface NewPandFeature {
  type: 'Feature';
  properties: { id: string; tier: 3; minHeight: 0; height: number; heightSource: NewPandHeightSource; bagGap: true; newPand: true; year: number; neighbours: number };
  geometry: { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };
}

export function newPandFeature(gap: BagGap, rings: readonly Ring[], h: NewPandHeight): NewPandFeature {
  const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
  const polys = rings.map(r => [r.map(([x, y]) => [r6(x), r6(y)])]);
  return {
    type: 'Feature',
    properties: { id: gap.id, tier: 3, minHeight: 0, height: h.height, heightSource: h.source, bagGap: true, newPand: true, year: gap.year!, neighbours: h.neighbours },
    geometry: polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys },
  };
}
