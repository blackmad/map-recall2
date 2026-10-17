import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';
import { AuthProvider } from './AuthContext';
import { CardGallery } from './CardGallery';
import { isProgressPath } from './progress/route';

const ProgressPage = React.lazy(() => import('./progress/ProgressPage').then(({ ProgressPage }) => ({ default: ProgressPage })));

// Error monitoring is a no-op until a Sentry DSN is configured.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_RELEASE,
    tracesSampleRate: 0.05,
    // Sentry v11 equivalent of `sendDefaultPii: false`: do not attach user PII.
    dataCollection: { userInfo: false },
    // Map Quest reports to its own Sentry project (map-quest); tag the app too.
    initialScope: { tags: { app: 'map-quest' } },
  });
}

function ErrorFallback() {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '100dvh',
        padding: 24,
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>Something went wrong</h1>
        <p style={{ margin: '0 0 16px', color: '#555' }}>The app hit an unexpected error. Reload to try again.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ padding: '10px 18px', cursor: 'pointer' }}
        >
          Reload
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      {new URLSearchParams(window.location.search).get('gallery') === 'cards' ? <CardGallery />
        : isProgressPath(window.location.pathname)
          ? <AuthProvider><React.Suspense fallback={null}><ProgressPage /></React.Suspense></AuthProvider>
          : <AuthProvider><App /></AuthProvider>}
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
