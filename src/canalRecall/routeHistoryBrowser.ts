/**
 * Ride-history adapter for the legacy Canal Recall page (`CanalRouteHistory`).
 *
 * game-route.js calls `beginRide(game)` when a ride is set up and game.js
 * calls `recordFinishedRide(game)` on arrival. The record logic is typed and
 * tested in routeHistory.ts; this file only reads the game's fields and hands
 * the record to the recall store for the signed-in cloud copy.
 */
import {
  appendRide, createRideRecord, loadRouteHistory, ROUTE_HISTORY_KEY, type RideRecord,
} from './routeHistory';
import type { CanalRecallStoreGlobal } from './recallStoreBrowser';

interface Poi { id?: string; name?: string; lat?: number; lng?: number }

/** The fields of the untyped Game this reads and writes. */
export interface RideHost {
  travelMode?: string;
  cityId?: string;
  routeFrom?: Poi | null;
  routeTo?: Poi | null;
  quizCorrect?: number;
  quizAttempts?: number;
  quizPoints?: number;
  _shareUrl?: string | null;
  _rideStartedAt?: number;
  _rideNamedNames?: string[];
  _rideRecorded?: boolean;
  _lastRideRecord?: RideRecord | null;
}

const storage = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

export function beginRide(game: RideHost, now = Date.now()): void {
  game._rideStartedAt = now;
  game._rideNamedNames = [];
  game._rideRecorded = false;
}

/** Saves the finished ride (once per ride) and returns its record. */
export function recordFinishedRide(game: RideHost, now = Date.now()): RideRecord | null {
  if (game._rideRecorded) return game._lastRideRecord ?? null;
  game._rideRecorded = true;
  try {
    const record = createRideRecord({
      startedAt: game._rideStartedAt,
      endedAt: now,
      travelMode: game.travelMode,
      cityId: game.cityId,
      from: game.routeFrom,
      to: game.routeTo,
      namedCount: game.quizCorrect,
      askedCount: game.quizAttempts,
      points: game.quizPoints,
      streetsLearned: game._rideNamedNames ?? [],
      shareUrl: game._shareUrl,
    });
    appendRide(storage(), record);
    game._lastRideRecord = record;
    const recall = (window as unknown as { CanalRecallStoreModule?: CanalRecallStoreGlobal }).CanalRecallStoreModule;
    void recall?.store.saveRide(record);
    window.dispatchEvent(new CustomEvent('canal-ride-recorded', { detail: record }));
    return record;
  } catch (reason) {
    console.warn('Could not record ride history:', reason);
    return null;
  }
}

export function history(): RideRecord[] {
  return loadRouteHistory(storage());
}

export { ROUTE_HISTORY_KEY };
