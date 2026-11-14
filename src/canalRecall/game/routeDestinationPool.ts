// The ride's destination pool, built from the landmark extract.
//
// This was inline in game-route.js `_loadRoutePoiCatalogNow` and copied into
// three scripts (check-poi-notability, sim-home-picks, the pool audit), so a
// change to one rule (dedupe, ordering) silently diverged from the others.
// The game and the scripts now call this.

import { normaliseAnswer } from '../answerPath';
import { dedupeDestinations, type DuplicateRemoval } from './destinationDedupe';
import { manualPoiForCuratedId } from './manualPoiCatalog';
import { isTeachableRouteDestination } from './routeDestinationContent';
import { notabilityScore } from './poiNotability';
import { kmBetween, type RoutePoi } from './surprisePick';
import type { LandmarkFeature } from './extracts';

/** Extract destinations further than this from the city centre stay map geometry
 *  (game.js ROUTE_POI_MAX_KM_FROM_CENTRE; modelled ones are always in). */
export const ROUTE_POI_MAX_KM_FROM_CENTRE = 4;

export interface PoolPoi extends RoutePoi {
  prominence?: number;
  type?: string;
}

type Feature = LandmarkFeature & Record<string, any>;

/** Copy the fields the notability scorer reads (was `_attachNotability`). */
export function attachNotability(poi: PoolPoi, feature: Feature): void {
  if (feature.wikidata) poi.wikidata = feature.wikidata;
  if (feature.wikidataSitelinks) poi.sitelinks = feature.wikidataSitelinks;
  if (feature.wikipediaPageviews60d != null) poi.pageviews60d = feature.wikipediaPageviews60d;
  if (feature.heritage) poi.heritage = feature.heritage;
  if (feature.wikidataInstanceOf) poi.wikidataInstanceOf = feature.wikidataInstanceOf;
  if (feature.type) poi.type = feature.type;
  if (feature.manualPoi) poi.manualPoi = feature.manualPoi;
}

export interface RouteDestinationPool {
  pois: PoolPoi[];
  curatedCount: number;
  extrasCount: number;
  /** Destinations folded into a twin (same QID, article, building, or a tower of a church). */
  removed: DuplicateRemoval[];
}

/**
 * Curated destinations first (mutated in place: they gain `landmarkId`, the
 * model's entrance, and notability), then every teachable, deduplicated
 * extract feature within range, most notable first.
 */
export function buildRouteDestinationPool(
  merged: readonly Feature[],
  curated: PoolPoi[],
  options: { center: { lat: number; lng: number }; maxKmFromCentre?: number; cityId?: string },
): RouteDestinationPool {
  const maxKm = options.maxKmFromCentre ?? ROUTE_POI_MAX_KM_FROM_CENTRE;
  const { kept: features, removed } = dedupeDestinations(merged);
  const mapCurated = (id: string) => (options.cityId && options.cityId !== 'amsterdam' ? undefined : manualPoiForCuratedId(id));
  for (const poi of curated) {
    const modelId = mapCurated(poi.id);
    // Resolve the installed model first: an earlier raw name alias must not
    // steal its arrival card and signature highlight.
    const model = modelId ? features.find(feature => feature.modelId === modelId) : undefined;
    const match = model || features.find(feature => normaliseAnswer(feature.name) === normaliseAnswer(poi.name));
    if (!match) continue;
    poi.landmarkId = match.id;
    const centre = model && (model.routeCenter || model.center);
    if (centre) [poi.lat, poi.lng] = centre as [number, number];
    attachNotability(poi, match);
  }
  const seen = new Set(curated.map(poi => normaliseAnswer(poi.name)));
  const claimed = new Set(curated.map(poi => poi.landmarkId).filter(Boolean));
  const curatedModels = new Set(curated.map(poi => mapCurated(poi.id)).filter(Boolean));
  const extras: PoolPoi[] = [];
  for (const feature of features) {
    const centre = (feature.routeCenter || feature.center) as [number, number] | undefined;
    if (!centre || !feature.name) continue;
    if (feature.modelId && curatedModels.has(feature.modelId)) continue;
    if (claimed.has(feature.id)) continue;
    // Completing a route must reveal something worth learning.
    if (!isTeachableRouteDestination(feature)) continue;
    const key = normaliseAnswer(feature.name);
    if (seen.has(key)) continue;
    const poi: PoolPoi = {
      id: `lm-${feature.id}`, landmarkId: feature.id, name: feature.name, lat: centre[0], lng: centre[1],
      prominence: feature.prominenceScore || 0, type: feature.type || 'landmark',
    };
    attachNotability(poi, feature);
    if (!feature.manualPoi && kmBetween(poi, options.center) > maxKm) continue;
    seen.add(key);
    extras.push(poi);
  }
  // Most notable first: the dropdown order, and the order any "first N" reads.
  const score = new Map(extras.map(poi => [poi, notabilityScore(poi)]));
  extras.sort((a, b) => score.get(b)! - score.get(a)!);
  return { pois: [...curated, ...extras], curatedCount: curated.length, extrasCount: extras.length, removed };
}
