import { AdministrativeArea, FeatureCategory, LoadingProgress, LocationScope, StreetFeature } from '../types';
import { calculateHaversineDistanceMeters } from '../utils/geo';
import { fetchCategorySpecificOSMFeatures } from '../utils/osm';

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

let amsterdamManifestPromise: Promise<ExtractManifest | null> | null = null;
const partitionPromises = new Map<string, Promise<StreetFeature[]>>();
let amsterdamAreasPromise: Promise<AdministrativeArea[]> | null = null;

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}data/extracts/${path}`;

async function loadAmsterdamExtract(category: FeatureCategory): Promise<StreetFeature[] | null> {
  amsterdamManifestPromise ||= fetch(assetUrl('amsterdam/manifest.json'))
    .then((response) => response.ok ? response.json() : null)
    .catch(() => null);
  const manifest = await amsterdamManifestPromise;
  const partition = manifest?.partitions[category];
  if (!partition) return null;
  const key = `amsterdam:${category}:${manifest.generatedAt}`;
  if (!partitionPromises.has(key)) {
    partitionPromises.set(key, fetch(assetUrl(`amsterdam/${partition.file}`)).then((response) => {
      if (!response.ok) throw new Error(`Amsterdam extract failed (${response.status})`);
      return response.json();
    }));
  }
  return partitionPromises.get(key)!;
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

async function loadAmsterdamAreas(): Promise<AdministrativeArea[] | null> {
  amsterdamManifestPromise ||= fetch(assetUrl('amsterdam/manifest.json')).then((response) => response.ok ? response.json() : null).catch(() => null);
  const manifest = await amsterdamManifestPromise;
  if (!manifest?.boundaries) return null;
  amsterdamAreasPromise ||= fetch(assetUrl(`amsterdam/${manifest.boundaries.file}`)).then((response) => {
    if (!response.ok) throw new Error(`Amsterdam boundaries failed (${response.status})`);
    return response.json();
  });
  return amsterdamAreasPromise;
}

export async function fetchQuizAreas(cityId: string, center?: [number, number]): Promise<AdministrativeArea[] | null> {
  const nearAmsterdam = center && center[0] >= 52.27 && center[0] <= 52.45 && center[1] >= 4.70 && center[1] <= 5.05;
  if (cityId !== 'amsterdam' && !nearAmsterdam) return null;
  const areas = await loadAmsterdamAreas();
  const municipality = areas?.find(({ kind }) => kind === 'municipality');
  return cityId === 'amsterdam' || (center && municipality?.geometry && pointInBoundary(center, municipality.geometry)) ? areas : null;
}

export async function fetchQuizFeatures(request: FeatureRequest): Promise<StreetFeature[]> {
  const inAmsterdamExtract = request.cityId === 'amsterdam'
    || (request.center[0] >= 52.27 && request.center[0] <= 52.45 && request.center[1] >= 4.70 && request.center[1] <= 5.11);
  if (inAmsterdamExtract) {
    request.onProgress?.({ percent: 30, message: 'Loading Amsterdam extract…', subMessage: 'Using the locally hosted quiz dataset' });
    const amsterdamAreas = await loadAmsterdamAreas();
    const extracted = await loadAmsterdamExtract(request.category);
    if (!extracted) throw new Error(`The local Amsterdam ${request.category} dataset is unavailable. No Overpass request was made.`);
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
          cityId: 'amsterdam',
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
      const selectedArea = amsterdamAreas?.find(({ id }) => id === request.areaId);
      const allFeatures = [...enriched, ...neighborhoodFeatures];
      const features = selectedArea?.geometry
        ? allFeatures.filter((feature) => pointInBoundary(feature.center, selectedArea.geometry!)
          || feature.paths?.some((path) => path.some((point) => pointInBoundary(point, selectedArea.geometry!)))
          || feature.path?.some((point) => pointInBoundary(point, selectedArea.geometry!)))
        : allFeatures.filter((feature) => calculateHaversineDistanceMeters(request.center, feature.center) <= request.radiusMeters);
      request.onProgress?.({ percent: 100, message: `Loaded ${features.length} Amsterdam features`, subMessage: 'No Overpass request needed' });
      return features;
    }
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
