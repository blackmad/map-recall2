/**
 * Register gaps: BAG pands that stand (status in use) but that the city tiles do not draw.
 *
 * The city layer (building-tiles / bag-tiles z14) is built from the cached 3DBAG
 * release plus a few OSM tiers (scripts/build-lod1-city.ts). A pand that 3DBAG
 * never reconstructed is not in the tiles, and the OSM outline over it is
 * dropped too: build-lod1-city keeps an unmatched OSM outline inside BAG
 * coverage only when it is a part, stacked or named ("digitisation
 * disagreement" rule, `suppressedUnmatched`). Result: an empty paved lot where
 * a block stands. User report 2026-10-16: Prinsengracht 221-227
 * (NL.IMBAG.Pand.0363100012169308, 1939, 53 dwellings, ~2,300 m2) is absent
 * from 3DBAG v20250903 and from both tile sets, so the game drew a bare lot
 * between the Prinsengracht 211-217 warehouses and the Leliegracht corner.
 *
 * This module is the pure half: which register pands are gaps, and the tile
 * feature that fills one from the BAG footprint and an AHN-measured height.
 * The CLIs are scripts/survey-bag-gaps.ts (survey + heights, staging),
 * scripts/publish-bag-gaps.ts (append to the tiles) and scripts/check-bag-gaps.ts.
 */
import { overlapFraction, ringAreaM2, type Footprint, type LngLat, type Ring, type TileBuilding } from './landmarks/osmUnderModels';

export const PAND_PREFIX = 'NL.IMBAG.Pand.';

/** BAG statuses of a building that physically stands. Permits / started builds / demolished are not gaps. */
export const STANDING_STATUSES: ReadonlySet<string> = new Set([
  'Pand in gebruik', 'Pand in gebruik (niet ingemeten)', 'Verbouwing pand', 'Sloopvergunning verleend', 'Pand buiten gebruik',
]);

/** A pand is drawn by the tiles when this share of its area lies under tile features (any id). */
export const MIN_TILE_COVER = 0.5;
/** Smaller footprints are reported but not filled (sheds, meter cabinets, digitisation slivers). */
export const MIN_FILL_AREA_M2 = 10;
/** AHN must see a structure at least this tall above the ground, or the pand is not filled. */
export const MIN_FILL_HEIGHT_M = 2;
/** A gap already this much under other tile features is a digitisation disagreement; filling it would z-fight. */
export const MAX_FILL_TILE_COVER = 0.2;
/**
 * PDOK's AHN dsm_05m is AHN4 (Amsterdam flown 2020): a pand built later may show its
 * predecessor or a building site, so it is listed for review, not filled.
 */
export const MAX_FILL_YEAR = 2019;
/** Bigger complexes (a 3 ha campus slab) need a look before one flat p70 box stands in for them. */
export const MAX_FILL_AREA_M2 = 5000;

/** A gap partly under a drawn model (an annex in a church's notch) is the model lane's call, not a box's. */
export const MAX_FILL_MODEL_COVER = 0.05;

export type FillDecision = 'fill' | 'too-small' | 'half-drawn' | 'under-model' | 'newer-than-ahn' | 'too-large' | 'no-ahn' | 'ahn-flat';

/** Whether a gap is filled from BAG + AHN, or why not (bounded and explainable: each reason is a count in the report). */
export function fillDecision(gap: BagGap, heights: AhnHeights | null): FillDecision {
  if (gap.areaM2 < MIN_FILL_AREA_M2) return 'too-small';
  if (gap.tileCover > MAX_FILL_TILE_COVER) return 'half-drawn';
  if ((gap.modelCover ?? 0) > MAX_FILL_MODEL_COVER) return 'under-model';
  if (gap.year !== null && gap.year > MAX_FILL_YEAR) return 'newer-than-ahn';
  if (gap.areaM2 > MAX_FILL_AREA_M2) return 'too-large';
  if (!heights) return 'no-ahn';
  if (heights.height < MIN_FILL_HEIGHT_M) return 'ahn-flat';
  return 'fill';
}

export interface RegisterPand { id: string; status: string; year: number | null; rings: Ring[] }

export interface BagGap {
  id: string;
  status: string;
  year: number | null;
  areaM2: number;
  /** Share of the pand's area under tile features of other ids (0..1). */
  tileCover: number;
  centre: LngLat;
  /** Largest share of the pand under one drawn model's footprint (set by the survey). */
  modelCover?: number;
}

export const pandAreaM2 = (rings: readonly Ring[]): number => rings.reduce((a, r) => a + ringAreaM2(r), 0);

/** Area-weighted share of `rings` covered by `footprint`. */
export function coveredShare(rings: readonly Ring[], footprint: Footprint | readonly Ring[]): number {
  let total = 0, inside = 0;
  for (const r of rings) { const a = ringAreaM2(r); total += a; inside += a * overlapFraction(r, footprint); }
  return total ? inside / total : 0;
}

const centreOf = (rings: readonly Ring[]): LngLat => {
  const r = rings[0];
  let x = 0, y = 0;
  for (const [lng, lat] of r) { x += lng; y += lat; }
  return [x / r.length, y / r.length];
};

/**
 * Register pands the tiles do not draw: standing, not present by id, and less than
 * MIN_TILE_COVER of their area under tile features. `tilesNear` returns the tile
 * buildings around a pand (bounds lookup); `tileIds` is every id in the tiles.
 */
export function findBagGaps(
  pands: Iterable<RegisterPand>, tileIds: ReadonlySet<string>, tilesNear: (rings: readonly Ring[]) => readonly TileBuilding[],
): BagGap[] {
  const out: BagGap[] = [];
  for (const p of pands) {
    if (!STANDING_STATUSES.has(p.status) || !p.rings.length) continue;
    const id = p.id.startsWith(PAND_PREFIX) ? p.id : `${PAND_PREFIX}${p.id}`;
    if (tileIds.has(id)) continue;
    const near = tilesNear(p.rings).filter(b => b.id !== id).flatMap(b => b.rings);
    const tileCover = near.length ? coveredShare(p.rings, near) : 0;
    if (tileCover >= MIN_TILE_COVER) continue;
    out.push({ id, status: p.status, year: p.year, areaM2: Math.round(pandAreaM2(p.rings) * 10) / 10, tileCover: Math.round(tileCover * 1000) / 1000, centre: centreOf(p.rings) });
  }
  return out.sort((a, b) => b.areaM2 - a.areaM2);
}

/** Linear-interpolated quantile of finite values (q in 0..1); null when none. */
export function quantile(values: readonly number[], q: number): number | null {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const i = (v.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return v[lo] + (v[hi] - v[lo]) * (i - lo);
}

export interface AhnHeights { groundNap: number; height: number; eaves: number; ridge: number; samples: number }

/**
 * Heights above ground from AHN samples: `roofNap` = DSM inside the footprint,
 * `groundNap` = DTM around it (AHN's DTM is void under buildings). `height` is the
 * 70th percentile roof point like the 3DBAG `b3_h_dak_70p` the tiles carry; eaves
 * p10, ridge p95. Null when either side has too few samples.
 */
export function ahnHeights(roofNap: readonly number[], groundNap: readonly number[], minSamples = 8): AhnHeights | null {
  const roof = roofNap.filter(Number.isFinite), ground = groundNap.filter(Number.isFinite);
  if (roof.length < minSamples || ground.length < 3) return null;
  const g = quantile(ground, 0.5)!;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return { groundNap: r2(g), height: r2(quantile(roof, 0.7)! - g), eaves: r2(quantile(roof, 0.1)! - g), ridge: r2(quantile(roof, 0.95)! - g), samples: roof.length };
}

export interface SupplementFeature {
  type: 'Feature';
  properties: { id: string; tier: 3; minHeight: 0; height: number; heightSource: 'ahn-dsm-p70'; bagGap: true; year?: number; eaves?: number; ridge?: number };
  geometry: { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };
}

/** The tile feature that fills a gap; null when it should stay empty (too small, half drawn already, AHN sees nothing). */
export function supplementFeature(gap: BagGap, rings: readonly Ring[], heights: AhnHeights | null): SupplementFeature | null {
  if (fillDecision(gap, heights) !== 'fill' || !heights) return null;
  const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
  const polys = rings.map(r => [r.map(([x, y]) => [r6(x), r6(y)])]);
  return {
    type: 'Feature',
    properties: {
      id: gap.id, tier: 3, minHeight: 0, height: heights.height, heightSource: 'ahn-dsm-p70', bagGap: true,
      ...(gap.year && gap.year > 1100 ? { year: gap.year } : {}),
      ...(heights.eaves >= MIN_FILL_HEIGHT_M ? { eaves: heights.eaves } : {}), // p10 on a courtyard pand is the yard, not an eave
      ...(heights.ridge > heights.height ? { ridge: heights.ridge } : {}),
    },
    geometry: polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys },
  };
}

/** The building-tiles copy carries only the drawing keys (bag-tiles also keeps year/eaves/ridge). */
export const forBuildingTiles = (f: SupplementFeature): SupplementFeature => ({
  ...f, properties: { id: f.properties.id, tier: 3, minHeight: 0, height: f.properties.height, heightSource: 'ahn-dsm-p70', bagGap: true },
});

/**
 * Appends supplement features to one tile's features: idempotent (an id already
 * present is left alone) and disjoint (a feature already >= MIN_TILE_COVER under
 * existing features is skipped, so a later 3DBAG release that draws it wins).
 */
export function appendSupplement<T extends { properties: { id?: unknown }; geometry: unknown }>(
  existing: T[], additions: readonly SupplementFeature[], ringsOf: (g: unknown) => Ring[],
): { features: (T | SupplementFeature)[]; added: string[]; skipped: string[] } {
  const ids = new Set(existing.map(f => String(f.properties.id ?? '')));
  const rings = existing.flatMap(f => ringsOf(f.geometry));
  const features: (T | SupplementFeature)[] = [...existing], added: string[] = [], skipped: string[] = [];
  for (const a of additions) {
    if (ids.has(a.properties.id)) { skipped.push(a.properties.id); continue; }
    const own = ringsOf(a.geometry);
    if (rings.length && coveredShare(own, rings) >= MIN_TILE_COVER) { skipped.push(a.properties.id); continue; }
    features.push(a); added.push(a.properties.id); ids.add(a.properties.id);
  }
  return { features, added, skipped };
}
