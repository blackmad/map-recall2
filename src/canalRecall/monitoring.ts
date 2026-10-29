import * as Sentry from '@sentry/browser';
import { PENDING_GRAPHICS_FAILURES } from './mapGuard';
import { IGNORED_ERRORS } from './monitoringFilters';

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
  cityId?: unknown;
  travelMode?: unknown;
  viewMode?: unknown;
  themeMode?: unknown;
  routeTo?: { id?: unknown };
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
    Sentry.captureMessage(
      kind.message,
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
