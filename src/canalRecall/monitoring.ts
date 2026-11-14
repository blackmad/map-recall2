import * as Sentry from '@sentry/browser';
import { PENDING_GRAPHICS_FAILURES } from './mapGuard';
import { IGNORED_ERRORS } from './monitoringFilters';
import { type HeartbeatSample, type KeyedStorage, PeerTabs, RideHeartbeat, SHARED_HEARTBEAT_PREFIX, StallWatch, orphanReport, phaseName, takeOrphans, unendedReport } from './rideHeartbeat';

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

/** `?sentryWrap=1`: keep Sentry's BrowserApiErrors callback wrapping (off by default since 2026-11-14). */
function sentryWrap(): boolean {
  try { return new URLSearchParams(window.location.search).get('sentryWrap') === '1'; } catch { return false; }
}
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
    // No BrowserApiErrors (lane LS, 2026-11-14): it wraps every setTimeout, setInterval, requestAnimationFrame,
    // addEventListener and XHR callback in a try/catch, so Long Animation Frame attributions named
    // monitoring.bundle.js instead of the callback that ran long (the CANAL-RECALL-T stall hunt). Uncaught errors
    // in those callbacks still reach Sentry through GlobalHandlers (window.onerror / unhandledrejection) with the
    // same stack; what goes is the `auto.browser.browserapierrors.*` mechanism (the callback kind) and the full
    // Error from a cross-origin script loaded without `crossorigin` (that arrives as "Script error."). Our ride
    // scripts are same-origin. `?sentryWrap=1` puts the wrapping back.
    integrations: defaults => (sentryWrap() ? defaults : defaults.filter(i => i.name !== 'BrowserApiErrors')),
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

/** What the own engine holds (engine/perfHud.ts `__canalPerf.snapshot()`), for the heartbeat; empty under MapLibre. */
function perfSample(): Partial<HeartbeatSample> {
  const snap = (window as unknown as { __canalPerf?: { snapshot?: () => Record<string, number | null> } }).__canalPerf?.snapshot?.();
  if (!snap) return {};
  const out: Partial<HeartbeatSample> = {};
  for (const k of ['gpuMB', 'geometries', 'textures', 'cells', 'chunks', 'models', 'dpr'] as const) {
    const v = snap[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v * 10) / 10;
  }
  return out;
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
  // The shared copy (rideHeartbeat.ts takeOrphans): a hung tab that is closed takes its sessionStorage with it.
  let shared: KeyedStorage | null = null;
  if (!/[?&]heartbeatShared=0\b/.test(location.search)) { try { shared = window.localStorage; } catch { /* blocked storage */ } }
  const peers = new PeerTabs(Math.random().toString(36).slice(2));
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel('canal-recall-heartbeat');
    channel.onmessage = event => { if (typeof event.data?.id === 'string') peers.heard(event.data.id, Date.now()); };
  } catch { /* no BroadcastChannel */ }
  const heartbeat = new RideHeartbeat({
    storage,
    shared,
    id: peers.id,
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
        ...perfSample(),
      };
    },
  });
  const previous = heartbeat.start(document.visibilityState !== 'hidden');
  const report = unendedReport(previous, Date.now());
  if (report) Sentry.captureMessage(report.message, { level: 'error', tags: report.tags, extra: report.extra, fingerprint: ['canal-recall', 'unended-ride', report.tags.engine ?? 'unknown'] });
  // The previous page of this tab is reported above (or ended cleanly): its shared copy is not an orphan.
  if (previous?.id) { try { shared?.removeItem(SHARED_HEARTBEAT_PREFIX + previous.id); } catch { /* */ } }
  for (const orphan of takeOrphans(shared, peers.id, Date.now())) {
    const r = orphanReport(orphan, Date.now());
    if (r) Sentry.captureMessage(r.message, { level: 'error', tags: r.tags, extra: r.extra, fingerprint: ['canal-recall', 'orphaned-ride', r.tags.engine ?? 'unknown'] });
  }
  // Stall report (rideHeartbeat.ts StallWatch): a tab that is practically locked but alive, reported while it can still
  // send, with what the page holds. `?stallReport=0` turns it off.
  if (!/[?&]stallReport=0\b/.test(location.search) && typeof PerformanceObserver === 'function') {
    const watch = new StallWatch();
    const onEntry = (entry: PerformanceEntry & { scripts?: Array<{ sourceURL?: string; sourceFunctionName?: string; invoker?: string; duration?: number }> }) => {
      // Riding only (GameState.RACING): the load and the menu have their own long tasks and their own gates.
      if ((window as unknown as { canalRecallGame?: CanalRecallGameGlobals }).canalRecallGame?.state !== 4) return;
      const stall = watch.note(entry.startTime, entry.duration);
      if (!stall) return;
      heartbeat.beat();
      const now = heartbeat.current();
      const scripts = (entry.scripts ?? []).slice().sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0)).slice(0, 3)
        .map(s => `${Math.round(s.duration ?? 0)} ms ${s.invoker ?? ''} ${s.sourceFunctionName ?? ''} ${(s.sourceURL ?? '').split('/').pop()}`.trim());
      Sentry.captureMessage('ride stalled: long frames', {
        level: 'warning',
        tags: { ...routeTags(), heartbeat: 'stall', phase: now?.phase ?? 'unknown' },
        extra: { ...stall, heapMB: now?.heapMB ?? null, peakHeapMB: now?.peakHeapMB ?? null, gpuMB: now?.gpuMB ?? null, geometries: now?.geometries ?? null,
          textures: now?.textures ?? null, cells: now?.cells ?? null, chunks: now?.chunks ?? null, models: now?.models ?? null, dpr: now?.dpr ?? null,
          workers: now?.workers ?? null, tabs: now?.tabs ?? null, uptimeS: now ? Math.round((now.at - now.startedAt) / 1000) : null, lastFrameScripts: scripts },
        fingerprint: ['canal-recall', 'ride-stall', routeTags().engine ?? 'unknown'],
      });
    };
    const observe = (type: string) => {
      try { new PerformanceObserver(list => { for (const e of list.getEntries()) onEntry(e as never); }).observe({ type, buffered: false }); return true; } catch { return false; }
    };
    // long-animation-frame (Chrome 123+) names the scripts; longtask elsewhere; Safari has neither (nothing to watch).
    if (!(PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame') && observe('long-animation-frame'))) observe('longtask');
  }
  document.addEventListener('visibilitychange', () => heartbeat.setVisible(document.visibilityState !== 'hidden'));
  window.addEventListener('pagehide', () => heartbeat.end());
  window.addEventListener('pageshow', event => { if (event.persisted) heartbeat.resume(); });
}
