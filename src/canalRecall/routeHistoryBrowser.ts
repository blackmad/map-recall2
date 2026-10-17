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
import {
  buildRouteShare, parseRaceHash, privatePlacesFromHomeCache, shareOrCopy, shareToastText,
  type ShareOutcome, type SharePoi,
} from './shareRoute';
import { HOME_GEOCODE_CACHE_KEY } from './game/progressStore';

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

/** The game fields "Share this route" reads (game.js `_runFinishAction` / `_runPauseAction`). */
export interface ShareHost {
  travelMode?: string;
  routeFrom?: Poi | null;
  routeTo?: Poi | null;
  routePois?: SharePoi[];
  homeBase?: Poi | null;
  gpsOrigin?: Poi | null;
  _shareUrl?: string | null;
  _tour?: { tour?: { id?: string }; completed?: boolean } | null;
  _copiedTimer?: number;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

/** A small status line above the bottom edge; one at a time, gone after two seconds. */
export function showToast(text: string, doc: Document = document): void {
  if (!text) return;
  let toast = doc.getElementById('canal-share-toast');
  if (!toast) {
    toast = doc.createElement('div');
    toast.id = 'canal-share-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText = 'position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);'
      + 'z-index:2147483000;padding:10px 16px;border-radius:8px;background:rgba(31,28,23,.92);color:#fbf6ea;'
      + 'font:600 15px/1.2 system-ui,-apple-system,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.28);pointer-events:none;'
      + 'transition:opacity 160ms;max-width:calc(100vw - 32px);text-align:center';
    doc.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { if (toast) toast.style.opacity = '0'; }, 2000);
}

/**
 * "Share this route" on the arrival and pause cards: the system share sheet, or
 * the clipboard and a "Link copied" toast. Home and Here starts share from a
 * public stand-in (shareRoute.ts); a route with none is reported, not leaked.
 */
export async function shareRide(game: ShareHost): Promise<ShareOutcome> {
  let homes: unknown[] = [];
  try { homes = privatePlacesFromHomeCache(storage()?.getItem(HOME_GEOCODE_CACHE_KEY)); } catch { /* blocked */ }
  const tour = game._tour && !game._tour.completed ? game._tour.tour?.id : null;
  const share = buildRouteShare({
    origin: window.location.origin,
    pathname: window.location.pathname,
    travelMode: game.travelMode,
    tourId: tour || null,
    race: parseRaceHash(game._shareUrl),
    from: game.routeFrom,
    to: game.routeTo,
    publicPois: game.routePois ?? [],
    privatePlaces: [game.homeBase, game.gpsOrigin, ...homes].filter(Boolean),
  });
  if (!share) {
    showToast('This route starts at a private place, so it cannot be shared');
    return 'failed';
  }
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  const outcome = await shareOrCopy(share, {
    share: typeof nav.share === 'function' ? data => nav.share(data) : undefined,
    canShare: typeof nav.canShare === 'function' ? data => nav.canShare!(data) : undefined,
    clipboard: nav.clipboard ?? null,
  });
  if (outcome === 'copied') game._copiedTimer = 2;
  showToast(share.neutralised && outcome === 'copied' ? 'Link copied · it starts at a nearby landmark, not your own start' : shareToastText(outcome));
  (window as unknown as { __canalLastShare?: { url: string; outcome: ShareOutcome } }).__canalLastShare = { url: share.url, outcome };
  return outcome;
}

export function history(): RideRecord[] {
  return loadRouteHistory(storage());
}

export { ROUTE_HISTORY_KEY };
