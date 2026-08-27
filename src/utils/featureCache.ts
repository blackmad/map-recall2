import { StreetFeature, LocationScope, FeatureCategory, SearchHistoryEntry } from '../types';
import { GeocodedLocation } from './osm';

export interface CachedFeatureEntry {
  id: string;
  placeName: string;
  lat: number;
  lon: number;
  scope: LocationScope;
  category: FeatureCategory;
  radiusMeters: number;
  features: StreetFeature[];
  timestamp: number;
  expiresAt: number;
}

export interface CachedGeocodeEntry {
  key: string;
  lat: number;
  lon: number;
  scope: LocationScope;
  data: GeocodedLocation;
  timestamp: number;
}

// Version cached results alongside the query/parser contract. This prevents a
// previously timed-out or sparse dataset from masking improved searches.
const STORAGE_PREFIX = 'guess_map_cache_v4_';
const FEATURES_INDEX_KEY = `${STORAGE_PREFIX}features_index`;
const GEOCODE_INDEX_KEY = `${STORAGE_PREFIX}geocode_index`;
const DEFAULT_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days cache

// In-memory fallback if localStorage is unavailable
const memoryCache = new Map<string, CachedFeatureEntry>();
const memoryGeocodeCache = new Map<string, CachedGeocodeEntry>();

/**
 * Normalizes coordinates to ~100m grid for deterministic cache lookups
 */
export function getCoordCacheKey(lat: number, lon: number, scope: LocationScope, category: FeatureCategory, radiusMeters = 0): string {
  const normLat = lat.toFixed(3);
  const normLon = lon.toFixed(3);
  return `${normLat}_${normLon}_${scope}_${category}_${Math.round(radiusMeters)}`;
}

/**
 * Calculates distance in kilometers between two lat/lon points
 */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Retrieves cached OSM features if available and not expired
 */
export function getCachedOSMFeatures(
  lat: number,
  lon: number,
  scope: LocationScope,
  category: FeatureCategory,
  radiusMeters = 0
): { features: StreetFeature[]; entry: CachedFeatureEntry } | null {
  const exactKey = getCoordCacheKey(lat, lon, scope, category, radiusMeters);

  // Check memory cache first
  const mem = memoryCache.get(exactKey);
  if (mem && mem.expiresAt > Date.now()) {
    return { features: mem.features, entry: mem };
  }

  try {
    const rawIndex = localStorage.getItem(FEATURES_INDEX_KEY);
    if (!rawIndex) return null;
    const keys: string[] = JSON.parse(rawIndex);

    // 1. Check exact key match
    const storageKey = `${STORAGE_PREFIX}feat_${exactKey}`;
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const entry: CachedFeatureEntry = JSON.parse(raw);
      if (entry.expiresAt > Date.now() && entry.features && entry.features.length > 0) {
        memoryCache.set(exactKey, entry);
        return { features: entry.features, entry };
      }
    }

    // 2. Check nearby spatial match (within 250 meters for same scope & category)
    for (const k of keys) {
      const sKey = `${STORAGE_PREFIX}feat_${k}`;
      const itemRaw = localStorage.getItem(sKey);
      if (!itemRaw) continue;
      const entry: CachedFeatureEntry = JSON.parse(itemRaw);

      if (
        entry.expiresAt > Date.now() &&
        entry.scope === scope &&
        entry.category === category &&
        entry.radiusMeters === radiusMeters &&
        entry.features &&
        entry.features.length > 0
      ) {
        const dist = distanceKm(lat, lon, entry.lat, entry.lon);
        // If within 0.35 km, reuse existing cached dataset
        if (dist <= 0.35) {
          memoryCache.set(exactKey, entry);
          return { features: entry.features, entry };
        }
      }
    }
  } catch (err) {
    console.warn('Error reading from local feature cache:', err);
  }

  return null;
}

/**
 * Stores fetched OSM features in localStorage with automatic index management
 */
export function setCachedOSMFeatures(
  lat: number,
  lon: number,
  scope: LocationScope,
  category: FeatureCategory,
  placeName: string,
  features: StreetFeature[],
  ttlMs = DEFAULT_TTL_MS,
  radiusMeters = 0
): CachedFeatureEntry {
  const exactKey = getCoordCacheKey(lat, lon, scope, category, radiusMeters);
  const now = Date.now();
  const entry: CachedFeatureEntry = {
    id: exactKey,
    placeName,
    lat,
    lon,
    scope,
    category,
    radiusMeters,
    features,
    timestamp: now,
    expiresAt: now + ttlMs,
  };

  // Set in memory cache
  memoryCache.set(exactKey, entry);

  try {
    const storageKey = `${STORAGE_PREFIX}feat_${exactKey}`;
    localStorage.setItem(storageKey, JSON.stringify(entry));

    // Update keys index
    const rawIndex = localStorage.getItem(FEATURES_INDEX_KEY);
    const keys: string[] = rawIndex ? JSON.parse(rawIndex) : [];
    if (!keys.includes(exactKey)) {
      keys.push(exactKey);
      localStorage.setItem(FEATURES_INDEX_KEY, JSON.stringify(keys));
    }
  } catch (err) {
    console.warn('Error writing to local feature cache (quota might be full):', err);
  }

  return entry;
}

/**
 * Retrieves cached reverse geocode result
 */
export function getCachedGeocode(lat: number, lon: number, scope: LocationScope): GeocodedLocation | null {
  const key = `${lat.toFixed(3)}_${lon.toFixed(3)}_${scope}`;
  const mem = memoryGeocodeCache.get(key);
  if (mem) return mem.data;

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}geo_${key}`);
    if (raw) {
      const parsed: CachedGeocodeEntry = JSON.parse(raw);
      memoryGeocodeCache.set(key, parsed);
      return parsed.data;
    }
  } catch (err) {
    console.warn('Error reading geocode cache:', err);
  }
  return null;
}

/**
 * Stores reverse geocode result in cache
 */
export function setCachedGeocode(lat: number, lon: number, scope: LocationScope, data: GeocodedLocation): void {
  const key = `${lat.toFixed(3)}_${lon.toFixed(3)}_${scope}`;
  const entry: CachedGeocodeEntry = {
    key,
    lat,
    lon,
    scope,
    data,
    timestamp: Date.now(),
  };

  memoryGeocodeCache.set(key, entry);

  try {
    localStorage.setItem(`${STORAGE_PREFIX}geo_${key}`, JSON.stringify(entry));

    const rawIndex = localStorage.getItem(GEOCODE_INDEX_KEY);
    const keys: string[] = rawIndex ? JSON.parse(rawIndex) : [];
    if (!keys.includes(key)) {
      keys.push(key);
      localStorage.setItem(GEOCODE_INDEX_KEY, JSON.stringify(keys));
    }
  } catch (err) {
    console.warn('Error saving geocode cache:', err);
  }
}

/**
 * Returns all active cached feature entries
 */
export function getAllCachedFeatureEntries(): CachedFeatureEntry[] {
  const entries: CachedFeatureEntry[] = [];
  try {
    const rawIndex = localStorage.getItem(FEATURES_INDEX_KEY);
    if (!rawIndex) return Array.from(memoryCache.values());
    const keys: string[] = JSON.parse(rawIndex);

    for (const k of keys) {
      const sKey = `${STORAGE_PREFIX}feat_${k}`;
      const raw = localStorage.getItem(sKey);
      if (raw) {
        entries.push(JSON.parse(raw));
      }
    }
  } catch (err) {
    console.warn('Error listing cached feature entries:', err);
    return Array.from(memoryCache.values());
  }
  return entries;
}

/**
 * Computes storage and count statistics for the local feature cache
 */
export function getCacheStorageStats(): {
  totalEntries: number;
  totalFeatures: number;
  approxBytes: number;
  formattedSize: string;
} {
  let totalFeatures = 0;
  let approxBytes = 0;
  const entries = getAllCachedFeatureEntries();

  entries.forEach((e) => {
    totalFeatures += e.features?.length || 0;
    try {
      approxBytes += JSON.stringify(e).length * 2; // UTF-16 approx
    } catch {
      approxBytes += 1024;
    }
  });

  const formattedSize =
    approxBytes > 1024 * 1024
      ? `${(approxBytes / (1024 * 1024)).toFixed(2)} MB`
      : `${Math.round(approxBytes / 1024)} KB`;

  return {
    totalEntries: entries.length,
    totalFeatures,
    approxBytes,
    formattedSize,
  };
}

/**
 * Clears all cached features and geocoding from localStorage
 */
export function clearAllFeatureCache(): void {
  memoryCache.clear();
  memoryGeocodeCache.clear();

  try {
    const featIndexRaw = localStorage.getItem(FEATURES_INDEX_KEY);
    if (featIndexRaw) {
      const keys: string[] = JSON.parse(featIndexRaw);
      keys.forEach((k) => localStorage.removeItem(`${STORAGE_PREFIX}feat_${k}`));
      localStorage.removeItem(FEATURES_INDEX_KEY);
    }

    const geoIndexRaw = localStorage.getItem(GEOCODE_INDEX_KEY);
    if (geoIndexRaw) {
      const keys: string[] = JSON.parse(geoIndexRaw);
      keys.forEach((k) => localStorage.removeItem(`${STORAGE_PREFIX}geo_${k}`));
      localStorage.removeItem(GEOCODE_INDEX_KEY);
    }
  } catch (err) {
    console.warn('Error clearing feature cache:', err);
  }
}

/**
 * Removes an individual cache entry
 */
export function removeCacheEntry(id: string): void {
  memoryCache.delete(id);
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}feat_${id}`);
    const rawIndex = localStorage.getItem(FEATURES_INDEX_KEY);
    if (rawIndex) {
      const keys: string[] = JSON.parse(rawIndex);
      const filtered = keys.filter((k) => k !== id);
      localStorage.setItem(FEATURES_INDEX_KEY, JSON.stringify(filtered));
    }
  } catch (err) {
    console.warn('Error removing cache entry:', err);
  }
}

const SEARCH_HISTORY_KEY = `${STORAGE_PREFIX}search_history`;

/**
 * Retrieves past Overpass search history logs
 */
export function getSearchHistory(): SearchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const entries: SearchHistoryEntry[] = JSON.parse(raw);
    return entries.sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.warn('Error loading search history:', err);
    return [];
  }
}

/**
 * Records a new Overpass search attempt or cache retrieval in history (keeps last 40 entries)
 */
export function addSearchHistoryEntry(entry: Omit<SearchHistoryEntry, 'id'>): SearchHistoryEntry {
  const newEntry: SearchHistoryEntry = {
    ...entry,
    id: `search_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  };

  try {
    const existing = getSearchHistory();
    const updated = [newEntry, ...existing.filter((e) => e.id !== newEntry.id)].slice(0, 40);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Error saving search history entry:', err);
  }

  return newEntry;
}

/**
 * Clears search history
 */
export function clearSearchHistory(): void {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch (err) {
    console.warn('Error clearing search history:', err);
  }
}
