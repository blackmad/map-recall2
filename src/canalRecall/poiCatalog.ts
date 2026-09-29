/**
 * Which OSM places the game's own POI layer draws, and how strongly.
 *
 * The basemap's POI layer drew what OpenMapTiles ranks for a general map: bins,
 * toilets and bus-stop icons in every park, and names we could not screen for
 * spoilers before they drew (user requests 2026-09-29, "should we just
 * implement our own POI later?" and "for POI layer we can also do our own
 * filtering"). Here a place earns a label by being something a rider orients
 * by: a museum, a church, a school, a market, a bike shop, a named shop front.
 *
 * Food and drink are here too: the restaurant, café and bar names were the
 * basemap's most useful cues ("the corner with the pancake house"), and the
 * `local-food` labels from `branded-pois.json` only show with every label on.
 * Albert Heijn keeps its brand icon, and landmarks keep their own dots and
 * cards, so neither is repeated here.
 */

export type PoiCategory =
  | 'culture' | 'worship' | 'education' | 'health' | 'civic'
  | 'lodging' | 'shop' | 'bike' | 'leisure' | 'market' | 'food';

export const POI_CATEGORIES: readonly PoiCategory[] = [
  'culture', 'worship', 'education', 'health', 'civic', 'lodging', 'shop', 'bike', 'leisure', 'market', 'food',
];

export interface PoiClass { category: PoiCategory; weight: number }

/** Base weight by tag value; a higher weight wins a crowded block. */
const RULES: Array<[key: string, values: Record<string, PoiClass>]> = [
  ['tourism', {
    museum: { category: 'culture', weight: 80 },
    gallery: { category: 'culture', weight: 55 },
    hotel: { category: 'lodging', weight: 35 },
    hostel: { category: 'lodging', weight: 30 },
    guest_house: { category: 'lodging', weight: 15 },
    zoo: { category: 'leisure', weight: 70 },
    attraction: { category: 'culture', weight: 50 },
  }],
  ['amenity', {
    theatre: { category: 'culture', weight: 70 },
    cinema: { category: 'culture', weight: 65 },
    arts_centre: { category: 'culture', weight: 60 },
    library: { category: 'culture', weight: 55 },
    concert_hall: { category: 'culture', weight: 70 },
    music_venue: { category: 'culture', weight: 50 },
    nightclub: { category: 'culture', weight: 35 },
    community_centre: { category: 'civic', weight: 30 },
    place_of_worship: { category: 'worship', weight: 60 },
    university: { category: 'education', weight: 60 },
    college: { category: 'education', weight: 45 },
    school: { category: 'education', weight: 40 },
    kindergarten: { category: 'education', weight: 10 },
    hospital: { category: 'health', weight: 70 },
    clinic: { category: 'health', weight: 25 },
    pharmacy: { category: 'health', weight: 30 },
    townhall: { category: 'civic', weight: 60 },
    police: { category: 'civic', weight: 40 },
    fire_station: { category: 'civic', weight: 40 },
    post_office: { category: 'civic', weight: 25 },
    courthouse: { category: 'civic', weight: 50 },
    marketplace: { category: 'market', weight: 60 },
    bicycle_rental: { category: 'bike', weight: 25 },
    ferry_terminal: { category: 'civic', weight: 45 },
    restaurant: { category: 'food', weight: 22 },
    cafe: { category: 'food', weight: 24 },
    pub: { category: 'food', weight: 24 },
    bar: { category: 'food', weight: 20 },
    ice_cream: { category: 'food', weight: 14 },
    fast_food: { category: 'food', weight: 8 },
  }],
  ['shop', {
    bicycle: { category: 'bike', weight: 40 },
    books: { category: 'shop', weight: 30 },
    department_store: { category: 'shop', weight: 50 },
    mall: { category: 'shop', weight: 50 },
    bakery: { category: 'shop', weight: 25 },
    cheese: { category: 'shop', weight: 25 },
    florist: { category: 'shop', weight: 18 },
    clothes: { category: 'shop', weight: 15 },
    shoes: { category: 'shop', weight: 12 },
    antiques: { category: 'shop', weight: 20 },
    art: { category: 'shop', weight: 20 },
    music: { category: 'shop', weight: 20 },
    hardware: { category: 'shop', weight: 18 },
    doityourself: { category: 'shop', weight: 20 },
    butcher: { category: 'shop', weight: 18 },
    greengrocer: { category: 'shop', weight: 18 },
    deli: { category: 'shop', weight: 18 },
    chocolate: { category: 'shop', weight: 18 },
    toys: { category: 'shop', weight: 15 },
    gift: { category: 'shop', weight: 10 },
    furniture: { category: 'shop', weight: 12 },
  }],
  ['leisure', {
    park: { category: 'leisure', weight: 45 },
    stadium: { category: 'leisure', weight: 60 },
    sports_centre: { category: 'leisure', weight: 30 },
    swimming_pool: { category: 'leisure', weight: 30 },
    playground: { category: 'leisure', weight: 8 },
    garden: { category: 'leisure', weight: 20 },
  }],
];

/** The class of a named OSM place, or null when the game does not draw it.
 *  The first matching key wins, so a museum shop is a museum. */
export function classifyPoi(tags: Readonly<Record<string, string>>): PoiClass | null {
  if (!tags.name) return null;
  // Closed, disused, or a proposal: not a place a rider can see.
  if (Object.keys(tags).some(key => /^(disused|abandoned|was|proposed|construction):/.test(key))) return null;
  for (const [key, values] of RULES) {
    const value = tags[key];
    if (value && values[value]) return values[value];
  }
  return null;
}

/** Rank within a crowded block: base weight, plus fame (Wikidata, Wikipedia)
 *  and a small bonus for a visible building-scale presence. */
export function rankPoi(tags: Readonly<Record<string, string>>, poiClass: PoiClass, isArea: boolean): number {
  return poiClass.weight
    + (tags.wikidata ? 25 : 0)
    + (tags.wikipedia ? 10 : 0)
    + (isArea ? 8 : 0);
}

/** Which roofline a label is lifted to: the building's height, banded so each
 *  band is one map layer (a symbol's translate cannot vary per feature). */
export type HeightBand = 'ground' | 'low' | 'mid' | 'high';
export const HEIGHT_BAND_METRES: Record<HeightBand, number> = { ground: 0, low: 7, mid: 13, high: 22 };

export function heightBand(heightMetres: number | null | undefined): HeightBand {
  if (heightMetres == null || !(heightMetres > 0)) return 'ground';
  if (heightMetres < 10) return 'low';
  if (heightMetres < 17) return 'mid';
  return 'high';
}

/** Dot colour per category, muted to sit under the route and the landmark
 *  dots. Labels stay the map's ink; the colour is the category cue. */
export const POI_CATEGORY_COLOURS: Record<PoiCategory, string> = {
  culture: '#8e5bb5',
  worship: '#8a7560',
  education: '#4a7bb7',
  health: '#c4504a',
  civic: '#5b6b7a',
  lodging: '#3b8f8a',
  shop: '#c08a2c',
  bike: '#d46b2c',
  leisure: '#4f9a52',
  market: '#b3702f',
  food: '#c2553b',
};
