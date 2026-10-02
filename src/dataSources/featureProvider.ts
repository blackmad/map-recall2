import { AdministrativeArea, FeatureCategory, LoadingProgress, LocationScope, StreetFeature } from '../types';
import { calculateHaversineDistanceMeters } from '../utils/geo';
import { fetchCategorySpecificOSMFeatures } from '../utils/osm';
import { attachLocalFacts } from '../mapRecall/localFacts';
import type { FactsFile } from '../canalRecall/facts/factTypes';
import {
  attachNameOrigins, attachNeighborhoodTrivia, nearestAreaNames,
  type NeighborhoodHistoryEntry, type NeighborhoodPhoto, type StreetNameOrigin,
} from '../mapRecall/trivia';
import { extractCityFor, type ExtractCity } from '../mapRecall/cityExtracts';

interface FeatureRequest {
  cityId: string;
  center: [number, number];
  placeName: string;
  category: FeatureCategory;
  scope: LocationScope;
  radiusMeters: number;
  areaId?: number;
  forceRefresh?: boolean;
  onProgress?: (progress: LoadingProgress) => void;
}

interface ExtractPartition {
  file: string;
  count: number;
  bytes: number;
  linkedCount: number;
}

interface ExtractManifest {
  cityId: string;
  generatedAt: string;
  partitions: Partial<Record<FeatureCategory, ExtractPartition>>;
  boundaries?: { file: string; count: number };
}

// One set of cached loads per extract city (Amsterdam, Utrecht, Rotterdam, Den Haag).
const manifestPromises = new Map<string, Promise<ExtractManifest | null>>();
const partitionPromises = new Map<string, Promise<StreetFeature[]>>();
const areasPromises = new Map<string, Promise<AdministrativeArea[]>>();
const factsPromises = new Map<string, Promise<FactsFile | null>>();
const originsPromises = new Map<string, Promise<{ origins?: StreetNameOrigin[] } | null>>();
const historyPromises = new Map<string, Promise<{ neighborhoods?: NeighborhoodHistoryEntry[] } | null>>();
const photosPromises = new Map<string, Promise<NeighborhoodPhoto[] | null>>();

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}data/extracts/${path}`;

/** Optional trivia files: a missing one means fewer facts, never a failed quiz. */
const optionalJson = <T>(path: string): Promise<T | null> => fetch(assetUrl(path))
  .then((response) => response.ok ? response.json() as Promise<T> : null)
  .catch(() => null);

const cached = <T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> => {
  if (!cache.has(key)) cache.set(key, load());
  return cache.get(key)!;
};

const loadManifest = (city: ExtractCity) => cached(manifestPromises, city.id, () => fetch(assetUrl(`${city.id}/manifest.json`))
  .then((response) => response.ok ? response.json() as Promise<ExtractManifest> : null)
  .catch(() => null));

async function loadExtract(city: ExtractCity, category: FeatureCategory): Promise<StreetFeature[] | null> {
  const manifest = await loadManifest(city);
  const partition = manifest?.partitions[category];
  if (!partition) return null;
  const key = `${city.id}:${category}:${manifest.generatedAt}`;
  const features = await cached(partitionPromises, key, () => fetch(assetUrl(`${city.id}/${partition.file}`)).then((response) => {
    if (!response.ok) throw new Error(`${city.name} extract failed (${response.status})`);
    return response.json();
  }));
  const facts = await cached(factsPromises, city.id, () => fetch(assetUrl(`${city.id}/facts.json`))
    .then(async (response) => response.ok ? response.json() as Promise<FactsFile> : null)
    .catch(() => null));
  const origins = await cached(originsPromises, city.id, () => optionalJson(`${city.id}/street-name-origins.json`));
  return attachNameOrigins(attachLocalFacts(features, facts, city.id), origins?.origins);
}

function pointInRing([lat, lon]: [number, number], ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInBoundary(point: [number, number], polygons: [number, number][][][]): boolean {
  return polygons.some((polygon) => pointInRing(point, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(point, hole)));
}

async function loadAreas(city: ExtractCity): Promise<AdministrativeArea[] | null> {
  const manifest = await loadManifest(city);
  if (!manifest?.boundaries) return null;
  return cached(areasPromises, city.id, () => fetch(assetUrl(`${city.id}/${manifest.boundaries!.file}`)).then((response) => {
    if (!response.ok) throw new Error(`${city.name} boundaries failed (${response.status})`);
    return response.json();
  }));
}

export async function fetchQuizAreas(cityId: string, center?: [number, number]): Promise<AdministrativeArea[] | null> {
  const city = extractCityFor(cityId, center);
  if (!city) return null;
  const areas = await loadAreas(city).catch(() => null);
  if (cityId === city.id) return areas;
  // A place found by coordinates must lie inside the municipality, not merely its box.
  const municipality = areas?.find(({ kind }) => kind === 'municipality');
  return center && municipality?.geometry && pointInBoundary(center, municipality.geometry) ? areas : null;
}

async function loadLocalCity(city: ExtractCity, request: FeatureRequest): Promise<{ areas: AdministrativeArea[] | null; extracted: StreetFeature[] } | null> {
  request.onProgress?.({ percent: 30, message: `Loading ${city.name} extract…`, subMessage: 'Using the locally hosted quiz dataset' });
  try {
    const areas = await loadAreas(city);
    // Neighbourhoods are the boundary areas themselves, added by the caller; there is
    // no feature partition for them.
    const extracted = request.category === 'neighborhoods' ? [] : await loadExtract(city, request.category);
    if (extracted) return { areas, extracted };
  } catch (error) {
    if (city.id === 'amsterdam') throw error;
  }
  if (city.id === 'amsterdam') throw new Error(`The local Amsterdam ${request.category} dataset is unavailable. No Overpass request was made.`);
  return null;
}

export async function fetchQuizFeatures(request: FeatureRequest): Promise<StreetFeature[]> {
  const city = extractCityFor(request.cityId, request.center);
  // Amsterdam has always been extract-only. Other cities use their extract when it loads
  // and otherwise fall back to live OpenStreetMap, as they did before they had one.
  const local = city ? await loadLocalCity(city, request) : null;
  if (city && local) {
    const amsterdamAreas = local.areas;
    const extracted = local.extracted;
    {
      const neighborhoods = (amsterdamAreas || []).filter(({ kind, geometry }) => kind !== 'municipality' && geometry);
      const enriched = extracted.map((feature) => {
        const containing = neighborhoods.filter(({ geometry }) => pointInBoundary(feature.center, geometry!)).sort((a, b) => {
          const size = (area: AdministrativeArea) => area.bounds
            ? (area.bounds.maxlat - area.bounds.minlat) * (area.bounds.maxlon - area.bounds.minlon)
            : Infinity;
          return size(a) - size(b);
        });
        const neighborhood = containing[0];
        const centerOf = (area: AdministrativeArea): [number, number] => [
          ((area.bounds?.minlat || 0) + (area.bounds?.maxlat || 0)) / 2,
          ((area.bounds?.minlon || 0) + (area.bounds?.maxlon || 0)) / 2,
        ];
        const distractors = neighborhoods.filter(({ id }) => id !== neighborhood?.id)
          .sort((a, b) => calculateHaversineDistanceMeters(feature.center, centerOf(a)) - calculateHaversineDistanceMeters(feature.center, centerOf(b)));
        return { ...feature, neighborhood: neighborhood?.name, neighborhoodDistractors: distractors.slice(0, 6).map(({ name }) => name) };
      });
      const neighborhoodFeatures: StreetFeature[] = neighborhoods
        .filter(({ kind }) => ['neighborhood', 'neighbourhood', 'quarter'].includes(kind || ''))
        .map((area) => ({
          id: `extract_neighborhood_${area.id}`,
          name: area.name,
          type: 'neighborhood',
          cityId: city.id,
          center: area.bounds
            ? [(area.bounds.minlat + area.bounds.maxlat) / 2, (area.bounds.minlon + area.bounds.maxlon) / 2]
            : request.center,
          paths: area.geometry?.flatMap((polygon) => polygon) || [],
          areaGeometry: area.geometry,
          funFact: '',
          clues: [],
          distractors: [],
          difficulty: 'medium',
          prominenceScore: area.kind === 'quarter' ? 65 : 55,
        }));
      // Guess Name needs choices: the nearest other areas, which are the
      // plausible confusions. Trivia is joined by exact name.
      const historyFile = await cached(historyPromises, city.id, () => optionalJson(`${city.id}/neighborhood-history.json`));
      const photosFile = await cached(photosPromises, city.id, () => optionalJson(`${city.id}/neighborhoods-enriched.json`));
      const withChoices = neighborhoodFeatures.map((feature) => ({ ...feature, distractors: nearestAreaNames(neighborhoodFeatures, feature, 6) }));
      const withTrivia = attachNeighborhoodTrivia(withChoices, historyFile?.neighborhoods, photosFile);
      const selectedArea = amsterdamAreas?.find(({ id }) => id === request.areaId);
      const allFeatures = [...enriched, ...withTrivia];
      const features = selectedArea?.geometry
        ? allFeatures.filter((feature) => pointInBoundary(feature.center, selectedArea.geometry!)
          || feature.paths?.some((path) => path.some((point) => pointInBoundary(point, selectedArea.geometry!)))
          || feature.path?.some((point) => pointInBoundary(point, selectedArea.geometry!)))
        : allFeatures.filter((feature) => calculateHaversineDistanceMeters(request.center, feature.center) <= request.radiusMeters);
      request.onProgress?.({ percent: 100, message: `Loaded ${features.length} ${city.name} features`, subMessage: 'No Overpass request needed' });
      return features;
    }
  }

  // Live OSM has no reliable neighbourhood polygons; the areas come from a
  // city extract's boundaries.
  if (request.category === 'neighborhoods') {
    throw new Error('Neighborhood quizzes need a local city extract; this city does not have one yet.');
  }
  return fetchCategorySpecificOSMFeatures(
    request.center[0],
    request.center[1],
    request.placeName,
    request.category,
    request.scope,
    request.onProgress,
    request.forceRefresh,
    request.radiusMeters,
    request.areaId
  );
}
