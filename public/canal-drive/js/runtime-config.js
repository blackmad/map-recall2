// Canal Recall runtime configuration. This checked-in default has empty values
// so every monitoring and abuse-protection feature is a no-op. At deploy time
// scripts/write-runtime-config.mjs rewrites it from SENTRY_DSN, GITHUB_SHA and
// APPCHECK_SITE_KEY (and ANALYTICS_ENDPOINT).
window.CANAL_RUNTIME_CONFIG = {
  sentryDsn: '',
  release: '',
  appCheckSiteKey: '',
  analyticsEndpoint: '',
};
