import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider } from 'firebase/app-check';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // React StrictMode or hot reload may initialize Firestore more than once.
    db = getFirestore(app);
  }

  // App Check is a no-op until a reCAPTCHA site key is configured.
  const appCheckSiteKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
  if (appCheckSiteKey) {
    // In dev, App Check attestation needs an explicit debug token.
    if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG_TOKEN) {
      (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
        import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
    }
    const provider = import.meta.env.VITE_APPCHECK_PROVIDER === 'enterprise'
      ? new ReCaptchaEnterpriseProvider(appCheckSiteKey)
      : new ReCaptchaV3Provider(appCheckSiteKey);
    initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
  }
}

export { auth, db };
