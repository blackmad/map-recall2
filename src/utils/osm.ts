import { StreetFeature, LocationScope, LoadingProgress, FeatureCategory, FEATURE_CATEGORIES, AdministrativeArea } from '../types';
import {
  getCachedOSMFeatures,
  setCachedOSMFeatures,
  getCachedGeocode,
  setCachedGeocode,
  addSearchHistoryEntry,
} from './featureCache';

interface NominatimResponse {
  lat?: string;
  lon?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    neighbourhood?: string;
    quarter?: string;
    borough?: string;
    district?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
    road?: string;
  };
  display_name?: string;
}

export interface GeocodedSearchResult {
  name: string;
  lat: number;
  lon: number;
  boundingBox?: [number, number, number, number];
}

export async function geocodeLocationSearch(query: string): Promise<GeocodedSearchResult | null> {
  const normalized = query.trim();
  if (!normalized) return null;
  const cacheKey = `guess_map_forward_geo_v1_${normalized.toLowerCase()}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    // Continue without storage.
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(normalized)}`,
    { headers: { 'Accept-Language': 'en' } }
  );
  if (!response.ok) throw new Error(`Location search failed (${response.status})`);
  const results = await response.json();
  const first = results[0];
  if (!first?.lat || !first?.lon) return null;
  const result: GeocodedSearchResult = {
    name: first.display_name || normalized,
    lat: Number(first.lat),
    lon: Number(first.lon),
    boundingBox: first.boundingbox?.map(Number),
  };
  try {
    localStorage.setItem(cacheKey, JSON.stringify(result));
  } catch {
    // Continue without storage.
  }
  return result;
}

export interface OverpassElement {
  type: 'way' | 'node' | 'relation' | 'area';
  id: number;
  lat?: number;
  lon?: number;
  geometry?: Array<{ lat: number; lon: number }>;
  center?: { lat: number; lon: number };
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  members?: Array<{
    type: string;
    ref: number;
    role?: string;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
  tags?: {
    [key: string]: string | undefined;
    name?: string;
    'name:en'?: string;
    highway?: string;
    waterway?: string;
    natural?: string;
    water?: string;
    bridge?: string;
    man_made?: string;
    tourism?: string;
    amenity?: string;
    leisure?: string;
    historic?: string;
    place?: string;
    landuse?: string;
    description?: string;
    boundary?: string;
    admin_level?: string;
    wikidata?: string;
    wikipedia?: string;
  };
}

export interface GeocodedLocation {
  name: string;
  neighborhood: string;
  city: string;
  country: string;
  countryCode: string;
  scope: LocationScope;
  radiusMeters: number;
  defaultZoom: number;
}

/**
 * Reverse-geocodes coordinate to get the local town/city, neighborhood, and country
 */
export async function reverseGeocodeLocation(
  lat: number,
  lon: number,
  scope: LocationScope = 'city',
  forceRefresh = false
): Promise<GeocodedLocation> {
  if (!forceRefresh) {
    const cached = getCachedGeocode(lat, lon, scope);
    if (cached) return cached;
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
        },
      }
    );
    if (!res.ok) throw new Error('Nominatim request failed');
    const data: NominatimResponse = await res.json();
    const addr = data.address || {};

    const city = addr.city || addr.town || addr.municipality || addr.county || 'Local Area';
    const neighborhood = addr.suburb || addr.neighbourhood || addr.quarter || addr.borough || addr.district || addr.village || city;
    const country = addr.country || 'Local Area';
    const countryCode = (addr.country_code || 'LOC').toUpperCase();

    const region = addr.state || addr.county || city;
    const name = scope === 'neighborhood'
      ? (neighborhood !== city ? `${city} - ${neighborhood}` : neighborhood)
      : scope === 'region' ? region : city;
    const radiusMeters = scope === 'neighborhood' ? 2200 : scope === 'region' ? 15000 : 4500;
    const defaultZoom = scope === 'neighborhood' ? 15 : scope === 'region' ? 10 : 13;

    const result: GeocodedLocation = {
      name,
      neighborhood,
      city,
      country,
      countryCode,
      scope,
      radiusMeters,
      defaultZoom,
    };

    setCachedGeocode(lat, lon, scope, result);
    return result;
  } catch (err) {
    console.warn('Reverse geocoding error:', err);
    return {
      name: scope === 'neighborhood' ? 'Local Neighborhood' : 'Local City',
      neighborhood: 'Local Neighborhood',
      city: 'Local City',
      country: 'Current Area',
      countryCode: 'LOC',
      scope,
      radiusMeters: scope === 'neighborhood' ? 2200 : scope === 'region' ? 15000 : 4500,
      defaultZoom: scope === 'neighborhood' ? 15 : scope === 'region' ? 10 : 13,
    };
  }
}

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
];

const ADMIN_CACHE_PREFIX = 'guess_map_admin_v1_';

export async function fetchContainingAdministrativeAreas(lat: number, lon: number): Promise<AdministrativeArea[]> {
  const cacheKey = `${ADMIN_CACHE_PREFIX}${lat.toFixed(3)}_${lon.toFixed(3)}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    // Continue without persistent cache.
  }

  const query = `[out:json][timeout:20];
is_in(${lat}, ${lon})->.containing;
area.containing["boundary"="administrative"]["admin_level"]["name"];
out tags bb;`;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) continue;
      const data = await response.json();
      const areas: AdministrativeArea[] = (data.elements || [])
        .map((element: OverpassElement) => ({
          id: element.id,
          name: element.tags?.name || '',
          adminLevel: Number(element.tags?.admin_level),
          bounds: element.bounds,
        }))
        .filter((area: AdministrativeArea) => area.name && Number.isFinite(area.adminLevel))
        .sort((a: AdministrativeArea, b: AdministrativeArea) => b.adminLevel - a.adminLevel);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(areas));
      } catch {
        // Memory-only use is fine if storage is unavailable.
      }
      return areas;
    } catch (error) {
      console.warn(`Administrative area lookup failed on ${endpoint}:`, error);
    }
  }
  return [];
}

/**
 * Builds Overpass QL query specifically targeting categories or all features.
 */
export function buildOverpassQuery(
  lat: number,
  lon: number,
  radius: number,
  category: FeatureCategory,
  areaId?: number
): string {
  const applyArea = (query: string) => {
    if (!areaId) return query;
    return query
      .replace('\n(', `\narea(id:${areaId})->.searchArea;\n(`)
      .split(`around:${radius}, ${lat}, ${lon}`).join('area.searchArea');
  };
  if (category === 'water') {
    // Quiz features must have names. Filtering at the server avoids downloading
    // thousands of anonymous water polygons that the parser would discard.
    return applyArea(`[out:json][timeout:45];
(
  way["waterway"~"canal|river|stream|drain|dock|ditch"]["name"](around:${radius}, ${lat}, ${lon});
  relation["waterway"~"canal|river|stream|drain|dock|ditch"]["name"](around:${radius}, ${lat}, ${lon});
  way["natural"="water"]["name"](around:${radius}, ${lat}, ${lon});
  relation["natural"="water"]["name"](around:${radius}, ${lat}, ${lon});
  way["water"~"canal|river|basin|moat|pond|lake|reflecting_pool|oxbow"]["name"](around:${radius}, ${lat}, ${lon});
  relation["water"~"canal|river|basin|moat|pond|lake|reflecting_pool|oxbow"]["name"](around:${radius}, ${lat}, ${lon});
  way["landuse"="basin"]["name"](around:${radius}, ${lat}, ${lon});
);
out body geom;`);
  }

  if (category === 'bridges') {
    return applyArea(`[out:json][timeout:30];
(
  way["bridge"="yes"](around:${radius}, ${lat}, ${lon});
  way["man_made"="bridge"](around:${radius}, ${lat}, ${lon});
  node["bridge"](around:${radius}, ${lat}, ${lon});
  relation["bridge"](around:${radius}, ${lat}, ${lon});
  way["name"~"brug|bridge|pont|ponte|brücke|viaduct", i](around:${radius}, ${lat}, ${lon});
);
out body geom;`);
  }

  if (category === 'squares') {
    return applyArea(`[out:json][timeout:30];
(
  node["place"="square"](around:${radius}, ${lat}, ${lon});
  way["place"="square"](around:${radius}, ${lat}, ${lon});
  node["amenity"="marketplace"](around:${radius}, ${lat}, ${lon});
  way["amenity"="marketplace"](around:${radius}, ${lat}, ${lon});
  node["name"~"plein|square|place|piazza|platz|plaza|markt", i](around:${radius}, ${lat}, ${lon});
  way["name"~"plein|square|place|piazza|platz|plaza|markt", i](around:${radius}, ${lat}, ${lon});
);
out body geom;`);
  }

  if (category === 'parks') {
    return applyArea(`[out:json][timeout:30];
(
  way["leisure"~"park|garden|nature_reserve"](around:${radius}, ${lat}, ${lon});
  relation["leisure"~"park|garden"](around:${radius}, ${lat}, ${lon});
  way["landuse"~"forest|meadow|grass"](around:${radius}, ${lat}, ${lon});
  node["leisure"~"park|garden"](around:${radius}, ${lat}, ${lon});
);
out body geom;`);
  }

  if (category === 'streets') {
    return applyArea(`[out:json][timeout:30];
(
  way["highway"~"primary|secondary|tertiary|pedestrian|living_street|residential"]["name"](around:${radius}, ${lat}, ${lon});
);
out body geom;`);
  }

  if (category === 'landmarks') {
    return applyArea(`[out:json][timeout:30];
(
  node["tourism"~"attraction|museum|viewpoint|monument|gallery"](around:${radius}, ${lat}, ${lon});
  way["tourism"~"attraction|museum"](around:${radius}, ${lat}, ${lon});
  node["historic"](around:${radius}, ${lat}, ${lon});
  way["historic"](around:${radius}, ${lat}, ${lon});
  node["amenity"~"theatre|arts_centre|townhall"](around:${radius}, ${lat}, ${lon});
  way["amenity"~"theatre|arts_centre|townhall"](around:${radius}, ${lat}, ${lon});
);
out body geom;`);
  }

  // All features general mix
  return applyArea(`[out:json][timeout:30];
(
  way["highway"~"primary|secondary|tertiary|pedestrian|living_street"]["name"](around:${radius}, ${lat}, ${lon});
  way["waterway"~"canal|river|stream|dock"](around:${radius}, ${lat}, ${lon});
  relation["waterway"~"canal|river|stream|dock"](around:${radius}, ${lat}, ${lon});
  way["natural"="water"](around:${radius}, ${lat}, ${lon});
  way["water"~"canal|river|basin|moat"](around:${radius}, ${lat}, ${lon});
  way["bridge"="yes"]["name"](around:${radius}, ${lat}, ${lon});
  node["place"="square"]["name"](around:${radius}, ${lat}, ${lon});
  way["place"="square"]["name"](around:${radius}, ${lat}, ${lon});
  way["leisure"~"park|garden"]["name"](around:${radius}, ${lat}, ${lon});
  node["tourism"~"attraction|museum|viewpoint|monument"]["name"](around:${radius}, ${lat}, ${lon});
  way["name"~"gracht|canal|burgwal|singel|river|amstel|dock|dok|vaart|wetering|haven|kade", i](around:${radius}, ${lat}, ${lon});
);
out body geom;`);
}

/**
 * Directly executes a raw Overpass QL query and returns parsed JSON (for testing and replay)
 */
export async function executeCustomOverpassQuery(
  query: string,
  locationName = 'Custom Query',
  lat = 52.3676,
  lon = 4.9041,
  preferredEndpoint?: string
): Promise<{
  elements: OverpassElement[];
  elementsCount: number;
  features: StreetFeature[];
  endpoint: string;
  durationMs: number;
}> {
  const endpoints = preferredEndpoint ? [preferredEndpoint, ...OVERPASS_ENDPOINTS.filter((e) => e !== preferredEndpoint)] : OVERPASS_ENDPOINTS;
  const startTime = Date.now();

  let lastError: any = null;
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 14000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const data = await res.json();
      const elements = data.elements || [];
      const parsedFeatures = parseOverpassElements(elements, locationName, lat, lon);

      return {
        elements,
        elementsCount: elements.length,
        features: parsedFeatures,
        endpoint,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      lastError = err;
      console.warn(`Endpoint ${endpoint} failed:`, err);
    }
  }

  throw lastError || new Error('All Overpass servers failed to respond');
}

/**
 * Deep-fetches features specifically for a selected category from OpenStreetMap Overpass API
 * (e.g. Canals & Waterways, Bridges, Squares, Streets, Landmarks), checking local cache first.
 */
export async function fetchCategorySpecificOSMFeatures(
  lat: number,
  lon: number,
  locationName: string,
  category: FeatureCategory,
  scope: LocationScope = 'city',
  onProgress?: (progress: LoadingProgress) => void,
  forceRefresh = false,
  radiusOverride?: number,
  areaId?: number
): Promise<StreetFeature[]> {
  const radius = radiusOverride ?? (scope === 'neighborhood' ? 2200 : scope === 'region' ? 15000 : 4500);
  const categoryName = FEATURE_CATEGORIES.find((c) => c.id === category)?.label || 'Features';
  const overpassQuery = buildOverpassQuery(lat, lon, radius, category, areaId);
  const startTime = Date.now();
  const failures: string[] = [];
  // 1. Check local persistent cache
  if (!forceRefresh) {
    const cached = getCachedOSMFeatures(lat, lon, scope, category, areaId || radius);
    // An exact completed query is authoritative even when the area genuinely
    // contains only a few matches. Synthetic timeout fallbacks remain eligible
    // for a live retry instead of masquerading as an Overpass result.
    if (cached && cached.features.length > 0 && cached.entry.source !== 'fallback') {
      // Record cache hit in search history
      addSearchHistoryEntry({
        timestamp: Date.now(),
        placeName: locationName,
        lat,
        lon,
        scope,
        category,
        radiusMeters: radius,
        status: 'cache_hit',
        featuresCount: cached.features.length,
        executionTimeMs: 5,
        overpassQuery,
      });

      onProgress?.({
        percent: 100,
        message: `Loaded ${cached.features.length} ${categoryName} instantly from cache!`,
        subMessage: `Retrieved offline copy for ${cached.entry.placeName || locationName}`,
      });
      return cached.features;
    }
  }

  onProgress?.({
    percent: 25,
    message: `Deep querying OpenStreetMap for ${categoryName}...`,
    subMessage: `Searching within ${scope === 'neighborhood' ? '2.2 km neighborhood' : '4.5 km citywide'} radius of ${locationName}...`,
  });

  for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
    const endpoint = OVERPASS_ENDPOINTS[i];
    try {
      onProgress?.({
        percent: 40 + i * 15,
        message: `Querying Overpass Server (${i + 1}/${OVERPASS_ENDPOINTS.length})...`,
        subMessage: `Extracting all ${categoryName.toLowerCase()}...`,
      });

      const controller = new AbortController();
      // The query itself allows 45s. Give a healthy server enough client-side
      // time to answer instead of aborting it at 12s and caching a fallback.
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        failures.push(`${new URL(endpoint).hostname}: HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const elements: OverpassElement[] = data.elements || [];

      if (!elements || elements.length === 0) continue;

      onProgress?.({
        percent: 85,
        message: `Processing ${elements.length} OSM elements for ${categoryName.toLowerCase()}...`,
        subMessage: 'Stitching topological line segments and generating clues...',
      });

      const features = parseOverpassElements(elements, locationName, lat, lon);

      if (features.length > 0) {
        // Save to persistent cache
        setCachedOSMFeatures(lat, lon, scope, category, locationName, features, undefined, areaId || radius);

        // Record in Search History
        addSearchHistoryEntry({
          timestamp: Date.now(),
          placeName: locationName,
          lat,
          lon,
          scope,
          category,
          radiusMeters: radius,
          status: 'success',
          featuresCount: features.length,
          endpointUsed: endpoint,
          executionTimeMs: Date.now() - startTime,
          overpassQuery,
        });

        onProgress?.({
          percent: 100,
          message: `Loaded & cached ${features.length} ${categoryName}!`,
          subMessage: 'Saved to local storage for instant offline replay',
        });
        return features;
      }
    } catch (err) {
      console.warn(`Overpass attempt on ${endpoint} failed:`, err);
      failures.push(`${new URL(endpoint).hostname}: ${err instanceof Error && err.name === 'AbortError' ? 'timed out' : 'network error'}`);
    }
  }

  addSearchHistoryEntry({
    timestamp: Date.now(),
    placeName: locationName,
    lat,
    lon,
    scope,
    category,
    radiusMeters: radius,
    status: 'error',
    featuresCount: 0,
    executionTimeMs: Date.now() - startTime,
    overpassQuery,
    errorMessage: failures.join('; ') || 'No Overpass server returned usable data.',
  });
  throw new Error(`OpenStreetMap search failed. ${failures.join('; ') || 'No Overpass server returned usable data.'}`);
}

/**
 * Standard fetch of local OSM features for "My Location" or city
 */
export async function fetchLocalOSMFeatures(
  lat: number,
  lon: number,
  locationName: string,
  scope: LocationScope = 'city',
  onProgress?: (progress: LoadingProgress) => void,
  forceRefresh = false,
  radiusOverride?: number,
  areaId?: number
): Promise<StreetFeature[]> {
  return fetchCategorySpecificOSMFeatures(lat, lon, locationName, 'all', scope, onProgress, forceRefresh, radiusOverride, areaId);
}

/**
 * Calculates Euclidean distance in meters between two coordinates.
 */
function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = (a.lat - b.lat) * 111320;
  const avgLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const dLon = (a.lon - b.lon) * 111320 * Math.cos(avgLat);
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

/**
 * Deduplicates adjacent or near-identical consecutive points while preserving true curve fidelity
 */
function cleanPolyline(points: Array<{ lat: number; lon: number }>): Array<[number, number]> {
  if (points.length <= 1) {
    return points.map((p) => [Number(p.lat.toFixed(6)), Number(p.lon.toFixed(6))]);
  }

  const cleaned: Array<[number, number]> = [[Number(points[0].lat.toFixed(6)), Number(points[0].lon.toFixed(6))]];

  for (let i = 1; i < points.length; i++) {
    const prev = cleaned[cleaned.length - 1];
    const curr = points[i];
    const d = distanceMeters({ lat: prev[0], lon: prev[1] }, curr);
    // Keep point if more than 0.8 meters from previous point
    if (d > 0.8) {
      cleaned.push([Number(curr.lat.toFixed(6)), Number(curr.lon.toFixed(6))]);
    }
  }

  return cleaned;
}

/**
 * Topologically groups and stitches way segments sharing the same street/canal name
 * into clean continuous paths, keeping disconnected components as distinct polylines
 * without creating artificial straight lines across unrelated blocks.
 */
function groupAndStitchSegments(
  segments: Array<Array<{ lat: number; lon: number }>>
): { path?: [number, number][]; paths?: [number, number][][] } {
  const valid = segments
    .map((s) => s.filter((p) => p && typeof p.lat === 'number' && typeof p.lon === 'number'))
    .filter((s) => s.length >= 2);

  if (valid.length === 0) return {};
  if (valid.length === 1) {
    const cleaned = cleanPolyline(valid[0]);
    return { path: cleaned };
  }

  // Clone remaining segments
  const remaining = valid.map((s) => [...s]);
  // Sort longest segments first
  remaining.sort((a, b) => b.length - a.length);

  const chains: Array<Array<{ lat: number; lon: number }>> = [];

  while (remaining.length > 0) {
    const currentChain: Array<{ lat: number; lon: number }> = [...remaining.shift()!];
    let expanded = true;

    while (expanded && remaining.length > 0) {
      expanded = false;
      const chainStart = currentChain[0];
      const chainEnd = currentChain[currentChain.length - 1];

      let bestIdx = -1;
      let bestDist = 28; // Connection threshold in meters
      let attachMode: 'append' | 'append_reverse' | 'prepend' | 'prepend_reverse' = 'append';

      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        const segStart = seg[0];
        const segEnd = seg[seg.length - 1];

        // 1. chainEnd -> segStart
        const d1 = distanceMeters(chainEnd, segStart);
        if (d1 < bestDist) {
          bestDist = d1;
          bestIdx = i;
          attachMode = 'append';
        }

        // 2. chainEnd -> segEnd (reverse segment)
        const d2 = distanceMeters(chainEnd, segEnd);
        if (d2 < bestDist) {
          bestDist = d2;
          bestIdx = i;
          attachMode = 'append_reverse';
        }

        // 3. segEnd -> chainStart
        const d3 = distanceMeters(segEnd, chainStart);
        if (d3 < bestDist) {
          bestDist = d3;
          bestIdx = i;
          attachMode = 'prepend';
        }

        // 4. segStart -> chainStart (reverse segment)
        const d4 = distanceMeters(segStart, chainStart);
        if (d4 < bestDist) {
          bestDist = d4;
          bestIdx = i;
          attachMode = 'prepend_reverse';
        }
      }

      if (bestIdx >= 0) {
        expanded = true;
        const matchedSeg = remaining.splice(bestIdx, 1)[0];
        if (attachMode === 'append') {
          currentChain.push(...matchedSeg.slice(1));
        } else if (attachMode === 'append_reverse') {
          const rev = [...matchedSeg].reverse();
          currentChain.push(...rev.slice(1));
        } else if (attachMode === 'prepend') {
          currentChain.unshift(...matchedSeg.slice(0, -1));
        } else if (attachMode === 'prepend_reverse') {
          const rev = [...matchedSeg].reverse();
          currentChain.unshift(...rev.slice(0, -1));
        }
      }
    }

    chains.push(currentChain);
  }

  // Convert chains to clean coordinate arrays
  const cleanedChains = chains.map(cleanPolyline).filter((c) => c.length >= 2);
  if (cleanedChains.length === 0) return {};

  // Sort chains by point length descending (longest main artery first)
  cleanedChains.sort((a, b) => b.length - a.length);

  if (cleanedChains.length === 1) {
    return { path: cleanedChains[0] };
  }

  return {
    path: cleanedChains[0], // primary longest section
    paths: cleanedChains,   // all disjoint sections preserved without fake bridge lines
  };
}

/**
 * Parses raw Overpass JSON elements into structured StreetFeature objects.
 */
export function parseOverpassElements(
  elements: OverpassElement[],
  locationName: string,
  centerLat: number,
  centerLon: number
): StreetFeature[] {
  const semanticClass = (element: OverpassElement): string => {
    const tags = element.tags || {};
    if (tags.waterway || tags.natural === 'water' || tags.water || tags.landuse === 'basin') return 'water';
    if (tags.bridge || tags.man_made === 'bridge') return 'bridge';
    if (tags.highway) return 'street';
    if (tags.leisure || tags.landuse) return 'green';
    if (tags.place === 'square' || tags.amenity === 'marketplace') return 'square';
    return 'place';
  };

  // Group elements by normalized lowercase name
  const nameGroups = new Map<
    string,
    {
      cleanName: string;
      elements: OverpassElement[];
    }
  >();

  for (const el of elements) {
    const rawName =
      el.tags?.name?.trim() ||
      el.tags?.['name:nl']?.trim() ||
      el.tags?.['name:en']?.trim() ||
      el.tags?.['loc_name']?.trim() ||
      el.tags?.['alt_name']?.trim() ||
      el.tags?.['official_name']?.trim() ||
      el.tags?.['int_name']?.trim();
    if (!rawName || rawName.length < 2) continue;

    // Filter out generic numeric highway shields or route codes
    if (/^[A-Z]?\d+$/.test(rawName)) continue;

    const cleanName = rawName.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ');
    // A canal and an adjacent street often share a name (e.g. Singel). They
    // must never be stitched into the same geometry.
    const nameKey = `${cleanName.toLowerCase()}::${semanticClass(el)}`;

    if (!nameGroups.has(nameKey)) {
      nameGroups.set(nameKey, { cleanName, elements: [] });
    }
    nameGroups.get(nameKey)!.elements.push(el);
  }

  const featureMap = new Map<string, StreetFeature>();
  const prominenceScores = new Map<string, number>();
  const allNames: string[] = [];

  for (const [nameKey, group] of nameGroups.entries()) {
    const { cleanName, elements: groupElements } = group;
    const nameLower = cleanName.toLowerCase();

    // 1. Gather all way geometry segments for this feature
    const segments: Array<Array<{ lat: number; lon: number }>> = [];
    let nodeCenter: [number, number] | null = null;
    let primaryTagObj: OverpassElement['tags'] = undefined;

    for (const el of groupElements) {
      if (el.tags) {
        primaryTagObj = { ...(primaryTagObj || {}), ...el.tags };
      }

      if (el.type === 'way' && el.geometry && el.geometry.length > 1) {
        segments.push(el.geometry);
      } else if (el.type === 'relation' && el.members) {
        for (const m of el.members) {
          if (m.geometry && m.geometry.length > 1) {
            segments.push(m.geometry);
          }
        }
      } else if (el.type === 'node' && el.lat && el.lon) {
        nodeCenter = [Number(el.lat.toFixed(6)), Number(el.lon.toFixed(6))];
      }
    }

    // 2. Stitch way segments into continuous polyline & multi-paths
    const { path, paths } = segments.length > 0 ? groupAndStitchSegments(segments) : { path: undefined, paths: undefined };

    // 3. Determine feature center
    let center: [number, number] = [centerLat, centerLon];
    if (path && path.length > 0) {
      const midIdx = Math.floor(path.length / 2);
      center = path[midIdx];
    } else if (nodeCenter) {
      center = nodeCenter;
    } else {
      const firstWithCenter = groupElements.find((e) => e.center || e.lat);
      if (firstWithCenter?.center) {
        center = [Number(firstWithCenter.center.lat.toFixed(6)), Number(firstWithCenter.center.lon.toFixed(6))];
      } else if (firstWithCenter?.lat && firstWithCenter?.lon) {
        center = [Number(firstWithCenter.lat.toFixed(6)), Number(firstWithCenter.lon.toFixed(6))];
      }
    }

    // 4. Infer feature type accurately from tags and name
    let type: StreetFeature['type'] = 'street';
    const tags = primaryTagObj || {};

    if (
      tags.waterway === 'canal' ||
      tags.waterway === 'dock' ||
      tags.water === 'canal' ||
      tags.water === 'basin' ||
      tags.landuse === 'basin' ||
      /(gracht|canal|burgwal|singel|dok|haven|vaart|wetering|kade)/i.test(nameLower)
    ) {
      type = 'canal';
    } else if (
      tags.waterway === 'river' ||
      tags.waterway === 'stream' ||
      tags.natural === 'water' ||
      tags.water ||
      /(river|fleuve|amstel|seine|thames|tiber|lake|water|sea|ij)/i.test(nameLower)
    ) {
      type = 'water';
    } else if (
      tags.bridge ||
      tags.man_made === 'bridge' ||
      /(brug|bridge|pont|ponte|brücke|viaduct)/i.test(nameLower)
    ) {
      type = 'bridge';
    } else if (
      tags.leisure === 'park' ||
      tags.leisure === 'garden' ||
      tags.landuse === 'forest' ||
      /(park|garden|tuin|jardin|parc|bos|parken)/i.test(nameLower)
    ) {
      type = 'park';
    } else if (
      tags.place === 'square' ||
      tags.amenity === 'marketplace' ||
      /(plein|square|place|piazza|platz|plaza|markt)/i.test(nameLower)
    ) {
      type = 'square';
    } else if (tags.highway === 'primary' || tags.highway === 'trunk' || /(boulevard|avenue|laan|allee)/i.test(nameLower)) {
      type = 'avenue';
    } else if (tags.tourism === 'museum') {
      type = 'museum';
    } else if (tags.tourism === 'attraction' || tags.historic) {
      type = 'landmark';
    } else {
      type = 'street';
    }

    const typeLabel =
      type === 'canal'
        ? 'Canal'
        : type === 'water'
        ? 'Waterway / River'
        : type === 'bridge'
        ? 'Bridge'
        : type === 'square'
        ? 'Square'
        : type === 'avenue'
        ? 'Avenue'
        : type === 'park'
        ? 'Park / Garden'
        : 'Landmark';

    allNames.push(cleanName);

    const feat: StreetFeature = {
      id: `osm_${groupElements[0]?.id || Math.random().toString(36).substring(2, 8)}`,
      name: cleanName,
      type,
      cityId: 'my_location',
      center,
      path,
      paths,
      radius: !path && (type === 'square' || type === 'park') ? 80 : undefined,
      funFact: `Located in ${locationName}. A prominent ${typeLabel.toLowerCase()} in the urban geography.`,
      // Spatial hints are derived at play time from the actual geometry and
      // active search center; OSM does not provide reliable authored trivia.
      clues: [],
      distractors: [],
      difficulty: 'medium',
    };

    featureMap.set(nameKey, feat);

    // OSM has no universal importance field. Rank by stable prominence proxies:
    // linked reference data, relation membership, waterway class, and mapped
    // geometry length. Fetching remains complete; this only orders the results.
    const mappedLengthMeters = segments.reduce((total, segment) => {
      for (let index = 1; index < segment.length; index++) {
        total += distanceMeters(segment[index - 1], segment[index]);
      }
      return total;
    }, 0);
    const hasReference = groupElements.some((element) => element.tags?.wikidata || element.tags?.wikipedia);
    const isRelation = groupElements.some((element) => element.type === 'relation');
    const classBonus = tags.waterway === 'river' ? 35 : tags.waterway === 'canal' ? 30 : 0;
    prominenceScores.set(
      nameKey,
      (hasReference ? 100 : 0) + (isRelation ? 50 : 0) + classBonus + Math.log10(Math.max(10, mappedLengthMeters)) * 10
    );
  }

  // Populate rich distractors for each feature
  const rankedFeatures = Array.from(featureMap.entries())
    .sort((a, b) => (prominenceScores.get(b[0]) || 0) - (prominenceScores.get(a[0]) || 0))
    .map(([, feature]) => feature);
  const seenNames = new Set<string>();
  const parsedFeatures = rankedFeatures.filter((feature) => {
    const normalizedName = feature.name.toLowerCase().trim();
    if (seenNames.has(normalizedName)) return false;
    seenNames.add(normalizedName);
    return true;
  });
  for (const feat of parsedFeatures) {
    const sameType = parsedFeatures
      .filter((f) => f.name !== feat.name && f.type === feat.type)
      .map((f) => f.name);
    const otherType = parsedFeatures
      .filter((f) => f.name !== feat.name && f.type !== feat.type)
      .map((f) => f.name);

    const pool = [...sameType, ...otherType];
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    feat.distractors = shuffled.slice(0, 4);

    if (feat.distractors.length < 3) {
      const genericDistractors = [
        'Main Street',
        'Grand Avenue',
        'Central Boulevard',
        'Riverside Promenade',
        'Market Square',
      ];
      feat.distractors.push(...genericDistractors.slice(0, 4 - feat.distractors.length));
    }
  }

  return parsedFeatures;
}
