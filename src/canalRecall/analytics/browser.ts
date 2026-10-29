/**
 * Browser adapter for consent-free gameplay analytics (`js/analytics.bundle.js`).
 *
 * A no-op unless `window.CANAL_RUNTIME_CONFIG.analyticsEndpoint` is set. It
 * exposes `window.CanalRecallAnalytics` for the game's one-line hooks, looks
 * at the game every two seconds while a ride is active, and sends batches by
 * `navigator.sendBeacon` when the tab is hidden or closed and at ride end.
 *
 * It sets no cookie and touches no localStorage, sessionStorage or IndexedDB.
 */
import { PENDING_ANALYTICS_GRAPHICS } from '../mapGuard';
import { buurtLocator, bboxOf, polygonsOf, type Buurt } from '../coverage/coverage';
import { AnalyticsClient, randomSessionId } from './client';
import { deviceClass } from './device';
import { RideTracker, type GameLike } from './rideTracker';
import { GRAPHICS_FAILURES, type AnalyticsEvent } from './schema';

const SAMPLE_MS = 2000;

export interface CanalRecallAnalyticsApi {
  enabled: boolean;
  /** The legacy `Game`; read through `GameLike`. */
  rideStart(game: object): void;
  rideFinish(game: object): void;
  answer(game: object, correct: boolean, noIdea?: boolean): void;
  graphicsFailure(kind: string): void;
  /** Tests and devtools: queue state, no data. */
  status(): { pending: number; sentBatches: number; rejected: number };
}

declare global {
  interface Window {
    CanalRecallAnalytics?: CanalRecallAnalyticsApi;
  }
}

type Locate = (pt: [number, number]) => string | null;

function extractPath(cityId: string): string {
  const prefs = (window as unknown as { CanalRecallPreferences?: { cityById?: (id: string) => { extractPath?: string } } }).CanalRecallPreferences;
  return prefs?.cityById?.(cityId)?.extractPath || `../data/extracts/${cityId}`;
}

function install(): CanalRecallAnalyticsApi {
  const endpoint = window.CANAL_RUNTIME_CONFIG?.analyticsEndpoint || '';
  const noop: CanalRecallAnalyticsApi = {
    enabled: false, rideStart() {}, rideFinish() {}, answer() {}, graphicsFailure() {},
    status: () => ({ pending: 0, sentBatches: 0, rejected: 0 }),
  };
  if (!endpoint || typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return noop;

  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  const device = deviceClass({ userAgent: nav.userAgent, mobile: nav.userAgentData?.mobile, maxTouchPoints: nav.maxTouchPoints });
  const client = new AnalyticsClient({
    endpoint,
    sessionId: randomSessionId(),
    // A Blob would set application/json and need a CORS preflight off-origin; a string is text/plain.
    send: (url, body) => navigator.sendBeacon(url, body),
  });
  const emit = (event: AnalyticsEvent) => { client.track(event); };

  // Buurt index: fetched once, only when a ride in Amsterdam starts, off the critical path.
  let locate: Locate | null = null;
  let loading = false;
  const loadBuurten = (cityId: string) => {
    if (locate || loading || cityId !== 'amsterdam') return;
    loading = true;
    const run = () => {
      fetch(`${extractPath(cityId)}/coverage-v1/buurten.json`, { credentials: 'omit' })
        .then(r => (r.ok ? r.json() : null))
        .then((fc: { features?: Array<{ properties?: { code?: string; name?: string }; geometry?: { type: string; coordinates: unknown } }> } | null) => {
          const buurten: Buurt[] = [];
          for (const f of fc?.features ?? []) {
            if (!f.properties?.code || !f.geometry) continue;
            const polygons = polygonsOf(f.geometry);
            if (polygons.length) buurten.push({ code: f.properties.code, name: f.properties.name ?? '', polygons, bbox: bboxOf(polygons) });
          }
          if (buurten.length) locate = buurtLocator(buurten);
        })
        .catch(() => { /* No buurt counts this tab; everything else still works. */ })
        .finally(() => { loading = false; });
    };
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    if (idle) idle(run, { timeout: 5000 }); else setTimeout(run, 1500);
  };

  const tracker = new RideTracker({
    emit,
    device,
    now: () => performance.now() / 1000,
    buurtAt: (lng, lat, cityId) => (cityId === 'amsterdam' && locate ? locate([lng, lat]) : null),
  });

  emit({ t: 'session', device });

  let timer: ReturnType<typeof setInterval> | null = null;
  const tick = () => {
    tracker.sample();
    if (!tracker.active && timer !== null) { clearInterval(timer); timer = null; client.flush(); }
  };

  const api: CanalRecallAnalyticsApi = {
    enabled: true,
    rideStart(raw) {
      const game = raw as GameLike;
      tracker.rideStart(game);
      loadBuurten(game.cityId || 'amsterdam');
      if (timer === null) timer = setInterval(tick, SAMPLE_MS);
    },
    rideFinish(game) {
      tracker.rideFinish(game as GameLike);
      client.flush();
    },
    answer(game, correct, noIdea = false) {
      tracker.answer(game as GameLike, correct, noIdea);
    },
    graphicsFailure(kind) {
      if ((GRAPHICS_FAILURES as readonly string[]).includes(kind)) emit({ t: 'graphics_failure', device, kind: kind as typeof GRAPHICS_FAILURES[number] });
    },
    status: () => ({ pending: client.pending, sentBatches: client.sentBatches, rejected: client.rejected }),
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') client.flush();
  });
  window.addEventListener('pagehide', () => {
    tracker.pageHide();
    client.flush();
  });

  // Graphics failures from before this bundle arrived (mapGuard queues the kind only).
  const root = window as unknown as Record<string, string[] | undefined>;
  const pending = root[PENDING_ANALYTICS_GRAPHICS];
  root[PENDING_ANALYTICS_GRAPHICS] = undefined;
  for (const kind of pending ?? []) api.graphicsFailure(kind);

  return api;
}

window.CanalRecallAnalytics = install();
