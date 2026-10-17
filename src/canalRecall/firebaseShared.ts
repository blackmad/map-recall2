/**
 * One Firebase app per static Canal Recall page.
 *
 * The ride loads Firebase from two independently built bundles: the recall
 * store (spaced review, ride history sync) and the feedback form. Each used
 * to call `initializeApp` with its own copy of the SDK, so a page could hold
 * two apps, two Auth instances and two Firestore clients, and only the
 * feedback one turned App Check on. They now share whichever instance is
 * created first: the handle, including the SDK namespaces it was made with,
 * is memoised on `window`, and callers must use `handle.authApi` /
 * `handle.firestoreApi` rather than their own imports, because one SDK copy's
 * functions do not accept another copy's instances.
 *
 * The config is `firebase-config.json`, written from the same VITE_FIREBASE_*
 * env Map Quest is built with (scripts/write-canal-firebase-config.ts), and
 * the app keeps Firebase's default name. On one origin both apps therefore
 * persist the signed-in user under the same IndexedDB key, so signing in on
 * the ride, the quiz or the progress page signs in all three.
 */
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

export interface CanalFirebase {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  authApi: typeof import('firebase/auth');
  firestoreApi: typeof import('firebase/firestore');
}

declare global {
  interface Window {
    __canalFirebase?: Promise<CanalFirebase | null>;
  }
}

const CONFIG_URL = 'firebase-config.json';

async function create(): Promise<CanalFirebase | null> {
  const response = await fetch(new URL(CONFIG_URL, window.location.href), { cache: 'no-store' });
  if (!response.ok) return null; // guest mode: no Firebase configured
  const config = await response.json();
  if (!config?.apiKey || !config?.projectId) return null;
  const [appApi, authApi, firestoreApi] = await Promise.all([
    import('firebase/app'), import('firebase/auth'), import('firebase/firestore'),
  ]);
  const app = appApi.getApps().length ? appApi.getApp() : appApi.initializeApp(config);
  // App Check is a no-op until a reCAPTCHA site key is provided via runtime-config.js.
  const appCheckSiteKey = (window as unknown as { CANAL_RUNTIME_CONFIG?: { appCheckSiteKey?: string } }).CANAL_RUNTIME_CONFIG?.appCheckSiteKey;
  if (appCheckSiteKey) {
    const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');
    initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey), isTokenAutoRefreshEnabled: true });
  }
  return { app, auth: authApi.getAuth(app), db: firestoreApi.getFirestore(app), authApi, firestoreApi };
}

/** The page's shared Firebase handle, or null in guest mode / when it fails to load. */
export function canalFirebase(): Promise<CanalFirebase | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!window.__canalFirebase) {
    window.__canalFirebase = create().catch((reason) => {
      console.warn('Canal Recall: Firebase unavailable, progress stays on this device.', reason);
      window.__canalFirebase = undefined; // a later call may retry
      return null;
    });
  }
  return window.__canalFirebase;
}
