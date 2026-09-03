/**
 * One owner per building composition.
 *
 * OSM often carries both a parent `building=*` outline and several
 * `building:part` footprints for the same landmark. Drawing both produces
 * coplanar fill-extrusions — the brown/blue shimmer on Oude Kerk and the
 * flattened Waag silhouette. Government BAG boxes have the same problem when
 * they replace a hand-mapped part graph.
 *
 * Rules used by the LoD1 ladder and by the live coloured overlay:
 *
 *   1. A composition is any set of overlapping footprints that either stacks
 *      (`minHeight > 0`) or carries at least two distinct extrusion heights.
 *   2. When a composition has parts, the parent outline is suppressed.
 *   3. Ownership never overlaps: suppressed ids are not drawn at any tier.
 */

import {
  pointInRing,
  ringCentroid,
  type Ring,
} from './buildingGeometry.js';

const HEIGHT_SPAN_M = 3;

/** Enough of an OSM footprint for composition decisions. */
export type CompositionFeature = {
  osmId: string;
  rings: Ring[];
  minHeightM: number;
  heightM: number;
  /** True when OSM tagged this as `building:part`. */
  isPart?: boolean;
};

/** Distinct heights among features, ignoring near-duplicates. */
export function distinctHeights(features: readonly { heightM: number }[], toleranceM = 0.5): number[] {
  const heights = [...features.map(f => f.heightM).filter(h => Number.isFinite(h) && h > 0)]
    .sort((a, b) => a - b);
  const kept: number[] = [];
  for (const height of heights) {
    if (!kept.length || Math.abs(height - kept[kept.length - 1]) > toleranceM) kept.push(height);
  }
  return kept;
}

/**
 * Whether these overlapping footprints are a hand-mapped 3D composition.
 *
 * Stacked parts (`minHeight > 0`) are the strong signal. Multiple distinct
 * heights spanning more than a few metres are the Magna Plaza / Oude Kerk
 * case — mappers modelled wings and towers without raising them off the
 * ground with `min_height`.
 */
export function isHandMappedComposition(features: readonly CompositionFeature[]): boolean {
  if (features.some(feature => feature.minHeightM > 0)) return true;
  if (features.length < 2) return false;
  const heights = distinctHeights(features);
  if (heights.length < 2) return false;
  return heights[heights.length - 1] - heights[0] >= HEIGHT_SPAN_M;
}

/** Centroid of a multi-ring footprint. */
export function footprintCentroid(rings: Ring[]): [number, number] {
  return ringCentroid(rings[0]);
}

/**
 * True when `inner`'s centroid sits inside any ring of `outer`.
 *
 * Used to recognise a parent outline that contains its parts.
 */
export function footprintContainsCentroid(outer: CompositionFeature, inner: CompositionFeature): boolean {
  const centre = footprintCentroid(inner.rings);
  return outer.rings.some(ring => pointInRing(centre, ring));
}

/**
 * OSM ids to draw for a composition; parent outlines are dropped when parts
 * exist so one massing owns the pixels.
 *
 * Preference order for "this is a part":
 *   1. explicit `isPart`
 *   2. otherwise, any feature whose centroid sits inside a larger sibling
 *      counts as a part, and the container is the outline
 */
export function compositionDrawIds(features: readonly CompositionFeature[]): string[] {
  if (!features.length) return [];
  if (!isHandMappedComposition(features)) {
    return features.map(feature => feature.osmId);
  }

  const parts = features.filter(feature => feature.isPart);
  if (parts.length > 0) {
    // Keep ground-level members of the composition that are not the outline:
    // a part with minHeight 0 is still a part of the model.
    const outlineIds = new Set(
      features
        .filter(feature => !feature.isPart)
        .filter(outline => parts.some(part => footprintContainsCentroid(outline, part)))
        .map(outline => outline.osmId),
    );
    return features.filter(feature => !outlineIds.has(feature.osmId)).map(feature => feature.osmId);
  }

  // No explicit part tags: drop any footprint that contains ≥2 siblings with
  // a different height — that footprint is acting as the outline shell.
  const suppress = new Set<string>();
  for (const candidate of features) {
    const contained = features.filter(
      other => other.osmId !== candidate.osmId && footprintContainsCentroid(candidate, other),
    );
    if (contained.length < 2) continue;
    const span = distinctHeights([candidate, ...contained]);
    if (span.length >= 2 && span[span.length - 1] - span[0] >= HEIGHT_SPAN_M) {
      suppress.add(candidate.osmId);
    }
  }
  const kept = features.filter(feature => !suppress.has(feature.osmId));
  return (kept.length ? kept : features).map(feature => feature.osmId);
}

/**
 * Filter a flat feature list so overlapping compositions keep one massing.
 *
 * Features that do not participate in a composition pass through unchanged.
 * Members of a composition are reduced to {@link compositionDrawIds}.
 */
export function selectRenderableBuildings<T extends CompositionFeature>(
  features: readonly T[],
  near: (feature: T) => readonly T[],
): T[] {
  const selected = new Set<string>();
  const rejected = new Set<string>();
  const byId = new Map(features.map(feature => [feature.osmId, feature]));

  for (const feature of features) {
    if (selected.has(feature.osmId) || rejected.has(feature.osmId)) continue;
    const cluster = dedupeById([feature, ...near(feature)]);
    if (!isHandMappedComposition(cluster)) {
      selected.add(feature.osmId);
      continue;
    }
    const keep = new Set(compositionDrawIds(cluster));
    for (const member of cluster) {
      if (keep.has(member.osmId)) selected.add(member.osmId);
      else rejected.add(member.osmId);
    }
  }

  return [...selected].map(id => byId.get(id)!).filter(Boolean);
}

function dedupeById<T extends { osmId: string }>(features: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const feature of features) {
    if (!feature.osmId || seen.has(feature.osmId)) continue;
    seen.add(feature.osmId);
    out.push(feature);
  }
  return out;
}
