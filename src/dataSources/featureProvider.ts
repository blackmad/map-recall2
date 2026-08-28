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

export async function fetchQuizAreas(cityId: string): Promise<AdministrativeArea[] | null> {
  if (cityId !== 'amsterdam') return null;
  amsterdamManifestPromise ||= fetch(assetUrl('amsterdam/manifest.json')).then((response) => response.ok ? response.json() : null).catch(() => null);
  const manifest = await amsterdamManifestPromise;
  if (!manifest?.boundaries) return null;
  amsterdamAreasPromise ||= fetch(assetUrl(`amsterdam/${manifest.boundaries.file}`)).then((response) => {
    if (!response.ok) throw new Error(`Amsterdam boundaries failed (${response.status})`);
    return response.json();
  });
  return amsterdamAreasPromise;
}

export async function fetchQuizFeatures(request: FeatureRequest): Promise<StreetFeature[]> {
  if (request.cityId === 'amsterdam' && !request.forceRefresh) {
    request.onProgress?.({ percent: 30, message: 'Loading Amsterdam extract…', subMessage: 'Using the locally hosted quiz dataset' });
    const extracted = await loadAmsterdamExtract(request.category);
    if (extracted) {
      const areas = request.areaId ? await fetchQuizAreas(request.cityId) : null;
      const selectedArea = areas?.find(({ id }) => id === request.areaId);
      const features = selectedArea?.geometry
        ? extracted.filter((feature) => pointInBoundary(feature.center, selectedArea.geometry!)
          || feature.paths?.some((path) => path.some((point) => pointInBoundary(point, selectedArea.geometry!)))
          || feature.path?.some((point) => pointInBoundary(point, selectedArea.geometry!)))
        : extracted.filter((feature) => calculateHaversineDistanceMeters(request.center, feature.center) <= request.radiusMeters);
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
