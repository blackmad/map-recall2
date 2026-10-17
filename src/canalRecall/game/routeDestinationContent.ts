// The content floor for a route destination, split out of routeSelection.ts
// so small bundles (POI stamps) can share it without the manual-POI catalogue.

/** The content fields available on a raw landmark-extract destination. */
export interface RouteDestinationFeature {
  funFact?: string;
  wikipediaExtract?: string;
  /** Set to 'wikidata-description' when the blurb is only a thin Wikidata one-liner. */
  wikipediaExtractSource?: string;
  wikipediaImageUrl?: string;
  wikipediaUrl?: string;
}

/**
 * A route destination has to teach something when the player reaches it.
 *
 * This deliberately uses the same content floor as drive-by landmark cards:
 * a name and OSM category alone are not a reward for completing a route. A
 * thin Wikidata description — the one-line fallback written when no real
 * article exists — is not enough on its own: it must be backed by an image or
 * a real article to be worth an arrival card.
 */
export function isTeachableRouteDestination(feature: RouteDestinationFeature): boolean {
  const thin = feature.wikipediaExtractSource === 'wikidata-description';
  const realText = !!(feature.funFact || (feature.wikipediaExtract && !thin));
  const image = !!feature.wikipediaImageUrl;
  const realArticle = !!feature.wikipediaUrl && !thin;
  return realText || image || realArticle;
}
