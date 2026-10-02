/**
 * "Near home" quiz scope: restrict the pool to features around the home shared
 * with Canal Recall, and widen the ring as the nearby ones become familiar.
 */
import { StreetFeature } from '../types';
import { calculateHaversineDistanceMeters } from '../utils/geo';
import { getFeatureKey } from '../utils/featureIdentity';

export const HOME_RING_START_M = 1000;
export const HOME_RING_STEP_M = 750;
export const HOME_RING_MAX_M = 12000;
/** Share of in-ring features that must be learned before the ring widens. */
export const HOME_RING_KNOWN_SHARE = 0.6;

const PREFERENCES_KEY = 'canalRecall.preferences.v1';
const GEOCODE_KEY = 'canalRecall.homeGeocodes.v2';

export interface HomePoint { lat: number; lng: number; address: string }

interface Reader { getItem(key: string): string | null }

/** Home saved by Canal Recall: address in preferences, point in its geocode cache. */
export function readSharedHome(store: Reader | null): HomePoint | null {
  if (!store) return null;
  try {
    const prefs = JSON.parse(store.getItem(PREFERENCES_KEY) || '{}');
    const address = typeof prefs.homeAddress === 'string' ? prefs.homeAddress.trim() : '';
    if (!address) return null;
    const cache = JSON.parse(store.getItem(GEOCODE_KEY) || '{}') as Record<string, Partial<HomePoint>>;
    const match = Object.values(cache).find(entry => entry && entry.address?.trim() === address);
    if (!match || !Number.isFinite(match.lat) || !Number.isFinite(match.lng)) return null;
    return { lat: match.lat as number, lng: match.lng as number, address };
  } catch {
    return null;
  }
}

export interface HomeScope { features: StreetFeature[]; radiusM: number }

/**
 * Features inside the current ring around home, nearest first. The ring starts
 * at 1 km and widens by 750 m while most of what is inside has been learned
 * (or while too few features are inside to fill a game).
 */
export function scopeToHome(
  features: StreetFeature[],
  home: { lat: number; lng: number },
  learnedKeys: ReadonlySet<string>,
  minPool: number,
): HomeScope {
  const withDistance = features
    .map(feature => ({ feature, m: calculateHaversineDistanceMeters([home.lat, home.lng], feature.center) }))
    .sort((a, b) => a.m - b.m);
  let radiusM = HOME_RING_START_M;
  while (radiusM < HOME_RING_MAX_M) {
    const inside = withDistance.filter(item => item.m <= radiusM);
    const learned = inside.filter(item => learnedKeys.has(getFeatureKey(item.feature))).length;
    const full = inside.length >= minPool && learned / inside.length >= HOME_RING_KNOWN_SHARE;
    if (inside.length >= minPool && !full) break;
    radiusM += HOME_RING_STEP_M;
  }
  return { features: withDistance.filter(item => item.m <= radiusM).map(item => item.feature), radiusM };
}
