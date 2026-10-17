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
  });
}

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
