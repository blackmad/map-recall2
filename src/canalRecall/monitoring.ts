import * as Sentry from '@sentry/browser';

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
    // A dead GPU process makes every shader query answer false with an empty
    // info log; MapLibre 5 then throws this from every render frame. `mapGuard`
    // handles maps we own, and this keeps unguarded pages from flooding the
    // project. A real shader bug carries a GLSL log and still reports.
    ignoreErrors: [/Could not compile (fragment|vertex) shader:\s*(null)?$/, /Program failed to link:\s*(null)?$/],
  });
}

/** One diagnostics hook for `mapGuard`; it reports once per event, not per frame. */
window.canalRecallMonitoring = {
  reportGraphicsFailure(detail) {
    if (!enabled) return;
    const contextLost = detail.event === 'webgl-context-lost';
    Sentry.captureMessage(
      contextLost ? 'MapLibre lost the WebGL context' : 'MapLibre lost the GPU while compiling a shader',
      {
        level: 'warning',
        tags: { ...routeTags(), graphics: contextLost ? 'context-lost' : 'dead-gpu' },
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

window.addEventListener('error', (event) => {
  if (enabled) {
    Sentry.captureException(event.error ?? event.message, { tags: routeTags() });
  }
  noteSevere('error', { message: event.message, filename: event.filename, lineno: event.lineno, colno: event.colno });
});

window.addEventListener('unhandledrejection', (event) => {
  if (enabled) {
    Sentry.captureException(event.reason, { tags: routeTags() });
  }
  noteSevere('unhandledrejection', event.reason);
});
