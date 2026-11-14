// Which landmark-class OSM features the extract keeps.
//
// The extract used to keep the top 420 by a prominence that gave +200 for
// carrying a wikidata/wikipedia tag at all, so a neighbourhood mosque with 250
// views in 60 days ranked above the Westerkerk and well-known places fell off
// the cut. Selection is now a notability floor over the same score the route
// pickers use (poiNotability.ts), so the size of the file follows how many
// places are worth knowing, not a round number.

import { notabilityScore, isAList, type PoiNotability } from './poiNotability';

/** The extract fields the notability score reads, by their extract names. */
export interface LandmarkNotabilityFields {
  name: string;
  wikidata?: string;
  wikidataSitelinks?: number;
  wikipediaPageviews60d?: number;
  heritage?: string[];
  wikidataInstanceOf?: string[];
  type?: string;
  tourism?: string;
  amenity?: string;
  historic?: string;
  manualPoi?: boolean;
}

/** Extract feature -> the notability inputs (routeDestinationPool.attachNotability). */
export function notabilityInput(feature: LandmarkNotabilityFields): PoiNotability {
  return {
    name: feature.name,
    wikidata: feature.wikidata,
    sitelinks: feature.wikidataSitelinks,
    pageviews60d: feature.wikipediaPageviews60d,
    heritage: feature.heritage,
    wikidataInstanceOf: feature.wikidataInstanceOf,
    type: feature.type,
    tourism: feature.tourism,
    amenity: feature.amenity,
    historic: feature.historic,
    manualPoi: feature.manualPoi,
  };
}

export function landmarkNotability(feature: LandmarkNotabilityFields): number {
  return notabilityScore(notabilityInput(feature));
}

/**
 * Notability a newly admitted landmark must reach. Measured 2026-11-13: the
 * user's examples of places too obscure to ride to score El Tawheed 3.8 and
 * Meerpadkerk 5.3; a floor of 6 admits 18 of the 110 notable Wikidata
 * buildings the extract lacked (Bijbels Museum via the A-list, the smallest
 * house, De Bazel, Museum Geelvinck-Hinlopen …) and keeps out the rest
 * (single canal houses, demolished stadiums, a lock). The extract's old 420
 * cap only ever cut OSM features with no Wikidata link, which carry no
 * article and so were never destinations.
 */
export const LANDMARK_NOTABILITY_FLOOR = 6;

export interface LandmarkCandidate extends LandmarkNotabilityFields {
  notability: number;
  /** An English Wikipedia intro exists (the English game shows English text). */
  hasEnglishArticle: boolean;
}

export type AdmitVerdict = { admit: true } | { admit: false; reason: 'no English article' | 'below floor' };

/** Whether a landmark not yet in the extract is worth adding. A-list places always are. */
export function admitLandmarkCandidate(candidate: LandmarkCandidate, floor = LANDMARK_NOTABILITY_FLOOR): AdmitVerdict {
  if (!candidate.hasEnglishArticle) return { admit: false, reason: 'no English article' };
  if (isAList(candidate)) return { admit: true };
  if (candidate.notability < floor) return { admit: false, reason: 'below floor' };
  return { admit: true };
}
