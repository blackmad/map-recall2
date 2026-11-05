import * as Sentry from '@sentry/browser';
import { PENDING_GRAPHICS_FAILURES } from './mapGuard';
import { IGNORED_ERRORS } from './monitoringFilters';
import { PeerTabs, RideHeartbeat, phaseName, unendedReport } from './rideHeartbeat';

/**
 * Canal Recall error monitoring.
 *
 * This is a legacy static page with no Vite build, so it reads its configuration
 * from `window.CANAL_RUNTIME_CONFIG` (written by `js/runtime-config.js` at deploy
 * time). Every feature here is a no-op until a Sentry DSN is present.
 */

interface CanalRuntimeConfig {
  sentryDsn?: string;
  release?: string;
  appCheckSiteKey?: string;
  /** Consent-free gameplay analytics beacon URL (analytics/browser.ts); empty = off. */
  analyticsEndpoint?: string;
}

declare global {
  interface Window {
    CANAL_RUNTIME_CONFIG?: CanalRuntimeConfig;
    canalRecallMonitoring?: {
      reportGraphicsFailure(detail: Record<string, unknown>): void;
    };
  }
}

interface CanalRecallGameGlobals {
  state?: unknown;
  player?: { distancePx?: unknown } | null;
  cityId?: unknown;
  travelMode?: unknown;
  viewMode?: unknown;
  themeMode?: unknown;
  routeTo?: { id?: unknown };
  vectorMap?: { engine?: unknown; qualityTier?: { tier?: unknown } | null } | null;
}

const config: CanalRuntimeConfig = window.CANAL_RUNTIME_CONFIG ?? {};
const enabled = Boolean(config.sentryDsn);

if (enabled) {
  Sentry.init({
    dsn: config.sentryDsn,
    environment: 'production',
    release: config.release,
    tracesSampleRate: 0.05,
    // Sentry v11 equivalent of `sendDefaultPii: false`: do not attach user PII.
    dataCollection: { userInfo: false },
    initialScope: { tags: { app: 'canal-recall' } },
    // Third-party and dead-GPU noise; see monitoringFilters.ts (unit-tested).
    ignoreErrors: [...IGNORED_ERRORS],
    // Sentry's own global handlers capture uncaught errors and unhandled
    // rejections; the route tags ride on every event from here. (The page
    // used to capture them a second time from its own listeners below, so
    // every one arrived twice: CANAL-RECALL-F was -G's duplicate.)
    beforeSend(event) {
      event.tags = { ...routeTags(), ...event.tags };
      return event;
    },
  });
}

const GRAPHICS_FAILURES: Record<string, { message: string; tag: string }> = {
  'webgl-context-lost': { message: 'MapLibre lost the WebGL context', tag: 'context-lost' },
  'webgl-context-restored': { message: 'MapLibre restored the WebGL context', tag: 'context-restored' },
  'dead-gpu-shader': { message: 'MapLibre lost the GPU while compiling a shader', tag: 'dead-gpu' },
  'webgl-unavailable': { message: 'The browser refused a WebGL context', tag: 'webgl-unavailable' },
};

/** One diagnostics hook for `mapGuard`; it reports once per event, not per frame. */
window.canalRecallMonitoring = {
  reportGraphicsFailure(detail) {
    if (!enabled) return;
    const kind = GRAPHICS_FAILURES[String(detail.event)] ?? GRAPHICS_FAILURES['dead-gpu-shader'];
    // The own engine's frame host reports through the same guard (engine/frameGuards.ts): name the engine that lost it.
    const own = routeTags().engine === 'own';
    Sentry.captureMessage(
      own ? kind.message.replace(/^MapLibre/, 'The own engine') : kind.message,
      {
        level: 'warning',
        tags: { ...routeTags(), graphics: kind.tag },
        extra: { ...detail },
        fingerprint: ['canal-recall', 'graphics-failure', String(detail.event)],
      },
    );
  },
};

/** Cheap route/mode tags from the legacy game global, when it exists. */
function routeTags(): Record<string, string> {
  const game = (window as unknown as { canalRecallGame?: CanalRecallGameGlobals }).canalRecallGame;
  if (!game) return {};
  const tags: Record<string, string> = {};
  if (game.cityId) tags.city = String(game.cityId);
  if (game.travelMode) tags.travelMode = String(game.travelMode);
  if (game.viewMode) tags.viewMode = String(game.viewMode);
  if (game.themeMode) tags.themeMode = String(game.themeMode);
  if (game.routeTo?.id) tags.route = String(game.routeTo.id);
  // Which world view drew the frame (`own` for ?engine=own, else MapLibre) and the own engine's quality tier: the
  // Amsterdam flip's staged rollout splits graphics failures by these (#129 flip checklist).
  tags.engine = game.vectorMap?.engine === 'own' ? 'own' : 'maplibre';
  if (game.vectorMap?.qualityTier?.tier) tags.tier = String(game.vectorMap.qualityTier.tier);
  return tags;
}

let severeCount = 0;

/** Console-only severe-error counter. Never written to the feedback queue. */
function noteSevere(kind: string, detail: unknown): void {
  severeCount += 1;
  // eslint-disable-next-line no-console
  console.error(`[canal-recall:monitoring] ${kind} (#${severeCount})`, detail);
}

// Console only: Sentry's global handlers already send these (see `beforeSend`).
window.addEventListener('error', (event) => {
  noteSevere('error', { message: event.message, filename: event.filename, lineno: event.lineno, colno: event.colno });
});

window.addEventListener('unhandledrejection', (event) => {
  noteSevere('unhandledrejection', event.reason);
});

// Graphics failures from before this bundle arrived (it loads async; a WebGL refusal happens at `load`).
{
  const root = window as unknown as Record<string, Record<string, unknown>[] | undefined>;
  const pending = root[PENDING_GRAPHICS_FAILURES];
  root[PENDING_GRAPHICS_FAILURES] = undefined;
  for (const detail of pending ?? []) window.canalRecallMonitoring?.reportGraphicsFailure(detail);
}

/** The page's dedicated workers: the shared pool (engine/workerPool.ts) plus the own ground's worker. */
function workerCount(game: CanalRecallGameGlobals | undefined): number | undefined {
  const pool = (window as unknown as { __canalRecallWorkerPool?: { live?: number } | null }).__canalRecallWorkerPool;
  const ground = (game?.vectorMap as { _ownGround?: { worker?: unknown } | null } | null | undefined)?._ownGround;
  if (pool == null && !ground) return undefined;
  return (pool?.live ?? 0) + (ground?.worker ? 1 : 0);
}

// Ride heartbeat (lane E2, #215; rideHeartbeat.ts): a renderer killed for memory sends nothing, so the next load of the
// same tab reports the previous page that never reached pagehide, with the engine, tier and phase it was in.
// `?heartbeat=0` turns it off.
if (enabled && !/[?&]heartbeat=0\b/.test(location.search)) {
  let storage: Storage | null = null;
  try { storage = window.sessionStorage; } catch { /* blocked storage */ }
  const peers = new PeerTabs(Math.random().toString(36).slice(2));
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel('canal-recall-heartbeat');
    channel.onmessage = event => { if (typeof event.data?.id === 'string') peers.heard(event.data.id, Date.now()); };
  } catch { /* no BroadcastChannel */ }
  const heartbeat = new RideHeartbeat({
    storage,
    sample: () => {
      const game = (window as unknown as { canalRecallGame?: CanalRecallGameGlobals }).canalRecallGame;
      const tags = routeTags();
      const memory = (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory;
      const distancePx = Number(game?.player?.distancePx);
      return {
        engine: tags.engine, tier: tags.tier, phase: phaseName(game?.state),
        heapMB: memory?.usedJSHeapSize ? Math.round(memory.usedJSHeapSize / 1048576) : undefined,
        // PIXELS_PER_METER is 3 in the legacy game.
        distanceM: Number.isFinite(distancePx) ? Math.round(distancePx / 3) : undefined,
        workers: workerCount(game),
        tabs: (() => { try { channel?.postMessage({ id: peers.id }); } catch { /* closed */ } return peers.count(Date.now()); })(),
      };
    },
  });
  const previous = heartbeat.start(document.visibilityState !== 'hidden');
  const report = unendedReport(previous, Date.now());
  if (report) Sentry.captureMessage(report.message, { level: 'error', tags: report.tags, extra: report.extra, fingerprint: ['canal-recall', 'unended-ride', report.tags.engine ?? 'unknown'] });
  document.addEventListener('visibilitychange', () => heartbeat.setVisible(document.visibilityState !== 'hidden'));
  window.addEventListener('pagehide', () => heartbeat.end());
  window.addEventListener('pageshow', event => { if (event.persisted) heartbeat.resume(); });
}
