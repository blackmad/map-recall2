/**
 * Browser entry for themed tours. Bundle (npm run build:canal-tours):
 *   esbuild src/canalRecall/game/toursBrowser.ts --bundle --format=iife --global-name=CanalRecallTours \
 *     --outfile=public/canal-drive/js/tours.bundle.js --minify
 * See docs/preview/tours-and-stamps-wiring.md for where the ride calls these.
 */
import type { Tour } from './tourRoute';

export {
  MAX_TOUR_LEG_KM, advanceOnArrival, isComplete, legKm, nextLeg, startTour, stopAsRoutePoi,
  tourLegs, tourProgressLabel, withinLegCap,
} from './tourRoute';
export type { Tour, TourLeg, TourState, TourStop } from './tourRoute';

/** Fetch tours.json from the city extract folder (e.g. city.extractPath). Never throws. */
export async function loadTours(extractPath = '../data/extracts/amsterdam'): Promise<Tour[]> {
  try {
    const response = await fetch(new URL(`${extractPath}/tours.json`, window.location.href));
    if (!response.ok) return [];
    const data = await response.json() as { tours?: Tour[] };
    return Array.isArray(data.tours) ? data.tours : [];
  } catch {
    return [];
  }
}

const STATE_KEY = 'canalRecall.tourState.v1';

/** The tour in progress survives a reload; storage failures just forget it. */
export function saveTourState(state: unknown): void {
  try { window.localStorage.setItem(STATE_KEY, JSON.stringify(state ?? null)); } catch { /* ignore */ }
}

export function loadTourState(): { tourId: string; legIndex: number; completedStops: number[] } | null {
  try {
    const raw = window.localStorage.getItem(STATE_KEY);
    const state = raw ? JSON.parse(raw) : null;
    if (state && typeof state.tourId === 'string' && Number.isInteger(state.legIndex) && Array.isArray(state.completedStops)) return state;
    return null;
  } catch {
    return null;
  }
}
