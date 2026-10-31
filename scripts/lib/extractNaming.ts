// How the Amsterdam extract classifies an OSM feature and which of its names
// it shows. Shared by `build-amsterdam-extract.ts` (the generator) and
// `patch-local-street-names.ts` (the name-only patch to a published extract),
// so the two cannot disagree on which features keep the local name.

import type { FeatureCategory, FeatureType } from '../../src/types.ts';

export type OsmTags = Record<string, string | undefined>;

// OSM amenity value -> the type the card shows on its badge.
export const CIVIC_TYPES: Record<string, FeatureType> = {
  cinema: 'cinema',
  library: 'library',
  university: 'university',
  college: 'university',
  music_venue: 'music venue',
  community_centre: 'landmark',
};

export function classify(tags: OsmTags): { type: FeatureType; category: FeatureCategory } | null {
  if (tags.bridge === 'yes' || tags.man_made === 'bridge') return { type: 'bridge', category: 'bridges' };
  if (tags.waterway || tags.natural === 'water' || tags.water || tags.landuse === 'basin') {
    return { type: tags.waterway === 'river' || tags.natural === 'water' ? 'water' : 'canal', category: 'water' };
  }
  if (tags.place === 'square' || tags.amenity === 'marketplace') return { type: 'square', category: 'squares' };
  if (tags.leisure || ['forest', 'meadow', 'grass'].includes(tags.landuse || '')) return { type: 'park', category: 'parks' };
  if (tags.tourism === 'museum') return { type: 'museum', category: 'landmarks' };
  if (tags.tourism === 'zoo') return { type: 'landmark', category: 'landmarks' };
  // Everyday civic venues. A cinema, a library or a faculty building is often
  // the thing a resident actually navigates by, and OSM rarely gives any of
  // them a Wikidata link, so they need both a class of their own and a
  // prominence floor (CIVIC_CLASS_SCORE) to survive the per-category cap.
  const civic = CIVIC_TYPES[tags.amenity || ''];
  // "P" is a real OSM name on a university building. It is not a name anyone
  // can learn a city by, and unlike a canal or a street a civic venue has no
  // geometry to make it recognisable, so hold them to a readable name.
  if (civic) {
    const civicName = englishName(tags);
    return civicName.length >= 3 ? { type: civic, category: 'landmarks' } : null;
  }
  if (tags.tourism || tags.historic || ['theatre', 'arts_centre', 'townhall', 'place_of_worship'].includes(tags.amenity || '')) return { type: 'landmark', category: 'landmarks' };
  if (tags.highway) return { type: ['primary', 'secondary', 'tertiary'].includes(tags.highway) ? 'avenue' : 'street', category: 'streets' };
  return null;
}

/** The name on the sign; `name:en` only when OSM has no local name. */
export function localName(tags: OsmTags): string {
  return (tags.name || tags['name:nl'] || tags['name:en'] || '').trim();
}

/** The English name when OSM has one. */
export function englishName(tags: OsmTags): string {
  return (tags['name:en'] || tags.name || tags['name:nl'] || '').trim();
}

// Streets, squares, waterways and bridges keep the name on the sign: the game
// teaches Amsterdam's geography, so `name:en` ("New Market" for the
// Nieuwmarkt, TODO P0 2026-10-30) only fills in when OSM has no local name.
// Landmarks and parks stay English ("Weepers' Tower", "Royal Palace"), as do
// venues. Applied to every category the rule renamed 59 landmarks to Dutch
// (Schreierstoren, Koninklijk Paleis), so it is scoped by category. The
// routing graph always uses the local name (`localName`).
export const LOCAL_NAME_CATEGORIES: ReadonlySet<FeatureCategory> = new Set<FeatureCategory>(['streets', 'squares', 'water', 'bridges']);

/** The name a classified (or unclassified) feature carries in the extract. */
export function extractName(tags: OsmTags, category: FeatureCategory | undefined): string {
  return !category || LOCAL_NAME_CATEGORIES.has(category) ? localName(tags) : englishName(tags);
}
