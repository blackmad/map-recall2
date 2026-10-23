# Monitoring & abuse protection

Error monitoring (Sentry) and abuse protection (Firebase App Check) are wired in
but **completely inactive until their keys exist**. Every feature is a no-op
when its environment variable is unset, so local builds and the e2e smoke test
run exactly as before with no keys.

| Feature | App | Source of truth | Env var(s) |
| --- | --- | --- | --- |
| Sentry | Map Quest (`src/main.tsx`) | `import.meta.env` | `VITE_SENTRY_DSN`, `VITE_RELEASE` |
| Sentry | Canal Recall (`src/canalRecall/monitoring.ts`) | `window.CANAL_RUNTIME_CONFIG` | `SENTRY_DSN`, `GITHUB_SHA` |
| App Check | Map Quest (`src/firebase.ts`) | `import.meta.env` | `VITE_APPCHECK_SITE_KEY`, `VITE_APPCHECK_DEBUG_TOKEN` |
| App Check | Canal Recall (`src/canalRecall/feedback/cloud.ts`) | `window.CANAL_RUNTIME_CONFIG` | `APPCHECK_SITE_KEY` |

## 1. Sentry

### What to create at sentry.io

Org `whizziwig`, two projects (with the official `sentry` CLI, after `npx sentry@latest auth login`):

```sh
npx sentry@latest project create whizziwig/canal-recall:javascript whizziwig/map-quest:javascript-react
npx sentry@latest project view whizziwig/canal-recall   # prints the DSN
npx sentry@latest project view whizziwig/map-quest
```

### GitHub secrets to add

| Secret | Value | Used for |
| --- | --- | --- |
| `SENTRY_DSN` | `canal-recall` DSN | Canal Recall's runtime config |
| `SENTRY_DSN_MAP_QUEST` | `map-quest` DSN | `VITE_SENTRY_DSN` (Map Quest) |
| `SENTRY_AUTH_TOKEN` | org auth token (Settings → Auth Tokens, scope `project:releases`) | source-map uploads for both projects; gates both upload steps |

The org slug (`whizziwig`) and upload projects (`map-quest`, `canal-recall`)
are written in the workflow; they are not secrets.

The deploy workflow maps `GITHUB_SHA` to `VITE_RELEASE` and to the release used
by `npx @sentry/cli sourcemaps upload`, so every deployed revision gets its own
release.

## 2. Firebase App Check

### Create a reCAPTCHA Enterprise key

Both apps use `ReCaptchaEnterpriseProvider` (the reCAPTCHA Enterprise API is
enabled on `map-recall2-blackmad`). Create a score-based website key:

```sh
gcloud recaptcha keys create --project=map-recall2-blackmad \
  --display-name="canal-recall web" --web --integration-type=score \
  --domains=rideamsterdam.nl,www.rideamsterdam.nl,canalrecall.blackmad.com,canalrecall-blackmad.web.app,edumap-blackmad.web.app,localhost
```

or Google Cloud console → Security → reCAPTCHA → **Create key** (Website,
score-based, no checkbox challenge), with the same domains.

### Register it in the Firebase console

1. Firebase console → project `map-recall2-blackmad` → **App Check** → **Apps**.
2. Register both web apps (edumap and canalrecall) with **reCAPTCHA Enterprise**
   and paste the key ID from above.

The key is the **site key** (public), not the secret key. Store it as:

- `APPCHECK_SITE_KEY` (GitHub secret → `VITE_APPCHECK_SITE_KEY` and Canal
  Recall's runtime config).

### Run unenforced, then enforce

App Check starts in **unenforced / monitor mode** by default: requests carry the
token but nothing is rejected. This is the correct state for the first few days
so a bad key cannot lock real users out.

When you are ready:

1. Firebase console → App Check → **APIs** → **Cloud Firestore**.
2. Switch **Enforcement** from *Unenforced* to *Enforced*.

`firestore.rules` is intentionally unchanged by this work; enforcement is
switched on in the console, not in the rules file.

### Debug token for e2e / CI

reCAPTCHA cannot complete attestation on `localhost` without a debug token. To
use App Check locally, generate a token with
`firebase apps:sdkconfig appcheck` / `firebase appcheck:token` and set it in
`.env.local`:

```sh
VITE_APPCHECK_DEBUG_TOKEN=...
```

When Vite is in dev mode (`import.meta.env.DEV`) and this token is present,
`src/firebase.ts` sets `self.FIREBASE_APPCHECK_DEBUG_TOKEN` before calling
`initializeAppCheck`, so the debug token is attached to attestation requests.
The debug token is never read in production builds.

## How the pieces fit together

- **Map Quest** is a Vite app: it reads `import.meta.env` directly. Sentry is
  initialized in `src/main.tsx`, wrapped in `Sentry.ErrorBoundary`. App Check is
  initialized in `src/firebase.ts` after `initializeApp`.
- **Canal Recall** is a legacy static page. `scripts/write-runtime-config.mjs`
  writes `public/canal-drive/js/runtime-config.js` from `SENTRY_DSN`,
  `GITHUB_SHA`, and `APPCHECK_SITE_KEY` at deploy time. The checked-in default
  has empty values, so nothing activates without keys. `index.html` loads
  `runtime-config.js` then `monitoring.bundle.js` (built by
  `npm run build:monitoring`) at the top of `<head>`.
- **A dead GPU is reported once, not once per frame**: MapLibre 5.24 throws
  `Could not compile fragment shader: ` from its render loop when the device's
  GPU process dies (the info log is empty because no query answers).
  `src/canalRecall/mapGuard.ts` wraps `map._render` on the ride and explorer
  maps: it swallows only those empty-log errors, holds a frame, and sends one
  warning ("MapLibre lost the GPU while compiling a shader", fingerprint
  `canal-recall / graphics-failure / dead-gpu-shader`) with the GPU
  renderer/vendor and `isContextLost`. It also reports `webglcontextlost` as
  its own one-shot warning ("MapLibre lost the WebGL context", fingerprint
  `… / webgl-context-lost`) even when no shader threw — that is what a GPU
  process killed for memory looks like from inside the page — with
  `performance.memory.usedJSHeapSize`, `navigator.deviceMemory`,
  `hardwareConcurrency`, the canvas CSS/backing sizes and the drawing buffer.
  `monitoring.ts` also lists the empty-log shader errors in `ignoreErrors` as a
  backstop for pages without the guard. Real GLSL errors keep their log and
  still report.
- **Source maps**: `vite.config.ts` sets `build.sourcemap: 'hidden'` for Map
  Quest, and every Canal Recall esbuild bundle is built with
  `--sourcemap=external` / `sourcemap: 'external'`, so neither writes a
  `sourceMappingURL` comment. The deploy workflow runs `@sentry/cli sourcemaps
  inject` + `upload` for `dist-quiz` (`map-quest`) and for the collected ride
  scripts (`canal-recall`), then deletes every `.map` from `dist/`, `dist-quiz/`
  and `public/canal-drive/js/` so maps never deploy. See the next bullet.
- **Canal Recall source maps**: `scripts/sentry/collect-canal-bundles.mjs` copies
  the scripts `index.html` loads (scripts referenced with a `?v=` query
  included), the lazily loaded `monitoring.bundle.js`, and any relative ESM
  imports (split `recall-store` chunks) that have a `.map`, into
  `.tmp/sentry-canal-recall/`. Checked-in scripts such as `game.js` ship readable
  source and are left out. Only those files are uploaded: the gallery and
  evaluation pages never initialise Sentry, so their maps would be uploaded on
  every deploy for nothing. The step fails when a `*.bundle.js` the ride loads
  has no map, which is how a build step that lost `--sourcemap=external` gets
  caught. Upload injects debug IDs into the staged copies; the workflow then
  copies them back over `dist/canal-drive/js/` so the deployed JavaScript is
  byte-identical to what Sentry holds.
