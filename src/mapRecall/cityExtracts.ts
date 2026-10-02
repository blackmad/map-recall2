/**
 * The cities Map Recall has a local extract for, and which one a place falls
 * in. Quizzes for these cities read the hosted extract (no Overpass request);
 * any other place falls back to live OpenStreetMap.
 */
export type ExtractCityId = 'amsterdam' | 'utrecht' | 'rotterdam' | 'den-haag';

export interface ExtractCity {
  id: ExtractCityId;
  /** Name as people write it, also used in search terms. */
  name: string;
  /** Other names the city appears under in articles. */
  aliases: string[];
  wikidata: string;
  /** Rough box around the municipality: lat/lng min and max. */
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
}

export const EXTRACT_CITIES: readonly ExtractCity[] = [
  // Amsterdam keeps the box the game has always used (it reaches Diemen and Amstelveen).
  { id: 'amsterdam', name: 'Amsterdam', aliases: [], wikidata: 'Q9899', bbox: { minLat: 52.27, maxLat: 52.45, minLng: 4.70, maxLng: 5.11 } },
  { id: 'utrecht', name: 'Utrecht', aliases: [], wikidata: 'Q803', bbox: { minLat: 52.02, maxLat: 52.15, minLng: 4.96, maxLng: 5.20 } },
  { id: 'rotterdam', name: 'Rotterdam', aliases: [], wikidata: 'Q647', bbox: { minLat: 51.83, maxLat: 52.00, minLng: 3.93, maxLng: 4.61 } },
  { id: 'den-haag', name: 'Den Haag', aliases: ["'s-Gravenhage", 'The Hague', 'Den Haag'], wikidata: 'Q36600', bbox: { minLat: 52.01, maxLat: 52.14, minLng: 4.18, maxLng: 4.43 } },
];

export const extractCityById = (id: string): ExtractCity | undefined => EXTRACT_CITIES.find(c => c.id === id);

/** The extract city for a request: by id (`amsterdam`) or, for "my location", by coordinates. */
export function extractCityFor(cityId: string, center?: readonly [number, number]): ExtractCity | undefined {
  const byId = extractCityById(cityId);
  if (byId) return byId;
  if (!center) return undefined;
  return EXTRACT_CITIES.find(c => center[0] >= c.bbox.minLat && center[0] <= c.bbox.maxLat && center[1] >= c.bbox.minLng && center[1] <= c.bbox.maxLng);
}

/** A regex source matching the city by any of its names, for "is this article about the city?" checks. */
export const cityNamePattern = (city: ExtractCity): string =>
  [city.name, ...city.aliases].map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
