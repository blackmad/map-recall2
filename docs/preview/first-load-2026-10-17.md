# First load, desktop — 2026-10-17

Cold first load of the assembled public site, measured before the public
preview, with three wins implemented and re-measured.

## Method

- Site: `npm run build && node scripts/assemble-canalrecall-site.mjs`, served by
  `npx firebase-tools@15 serve --only hosting:canalrecall --port 4471` (the
  Hosting emulator applies the real rewrites, headers and brotli/gzip).
- Driver: `node --import tsx scripts/preview/first-load.ts --base http://localhost:4471 --runs 3 [--throttle 20,40]`.
  Each run is a fresh Chrome context (empty HTTP cache, no storage), the
  Playwright "Desktop Chrome" profile at 1440×900, local Google Chrome on
  the development Mac, `Math.random` seeded so every run rides the same route.
- Bytes are CDP `Network.loadingFinished.encodedDataLength`: what crossed the wire,
  compressed as served, headers included. Request time is
  `requestWillBeSent` → `loadingFinished`. Render blocking is Chrome's own
  `renderBlockingStatus` from Resource Timing.
- **Setup visible**: first animation frame in which `#route-card` has a laid-out
  box. The default route is then submitted immediately. **Route started**: first
  frame with the game in `RACING` (state 4). Times are from navigation start.
- **Total**: everything requested until the network has been quiet for 2 s
  (capped at 30 s). Bytes "to setup" / "to start" count requests *started*
  before that mark.
- Two network profiles: **local** (localhost, no shaping: the CPU/parse floor)
  and **20 Mbit/s, 40 ms RTT** via CDP emulation (a modest desktop broadband
  line; the local numbers say nothing about the network). Third-party requests
  (unpkg, Google Fonts, OpenFreeMap, Wikimedia) went to the real internet in both.
- Caveat: the emulator's on-the-fly brotli is a lower level than `brotli -q 11`
  (e.g. signature-placement 361 KB served vs 279 KB at q11); production Hosting
  may serve somewhat smaller text than measured here.

## /ride — before and after (medians of 3)

| Metric | Before, 20 Mbit/40 ms | After, 20 Mbit/40 ms | Before, local | After, local |
|---|---:|---:|---:|---:|
| First contentful paint | 760 ms | 416 ms | 312 ms | 244 ms |
| Setup panel visible | **1482 ms** | **1036 ms** (−30%) | 387 ms | 316 ms |
| Route started (RACING) | **3441 ms** | **2991 ms** (−450 ms) | 1833 ms | 1673 ms |
| Requests to setup visible | 92 | 90 | 92 | 90 |
| Bytes to setup visible | 3.01 MB | 2.07 MB | 4.44 MB | 2.79 MB |
| Requests to route started | 144 | 143 | 183 | 179 |
| Bytes to route started | 6.32 MB | 6.24 MB | 12.93 MB | 11.23 MB |
| Total requests (to network quiet) | 314 | 312 | 316 | 315 |
| **Total bytes (to network quiet)** | **20.83 MB** | **18.96 MB** | 20.64 MB | 19.02 MB |
| Script bytes requested before setup | 2.81 MB (67 files) | 2.04 MB (66 files) | | |

Per-run, 20 Mbit/40 ms. Before: setup 1444 / 1482 / 1523 ms, start 3404 / 3441 / 3490 ms,
total 20.98 / 20.83 / 20.61 MB. After: setup 1047 / 1036 / 1030 ms, start
2991 / 2996 / 2991 ms, total 18.96 / 18.96 / 18.96 MB.

What the 18.96 MB is (after, by CDP resource type): Fetch 10.76 MB in 217
requests (extracts, building tiles, models, OpenFreeMap tiles), Image 5.96 MB
in 14 requests (3.93 MB of it is ten Wikimedia 960 px card photos), Script
2.11 MB in 72 requests, fonts 0.10 MB, CSS 0.02 MB.

### Top 15 requests by bytes (before, 20 Mbit/40 ms, median run)

| # | Request | KB on the wire | Encoding | Time (ms) | Starts at (ms) |
|---:|---|---:|---|---:|---:|
| 1 | `/materials/ambientcg/Bricks057/colour.jpg` | 1438 | none | 5857 | 2790 |
| 2 | `/assets/media/setup-backdrop.jpg` | 1400 | none | 4479 | 1466 |
| 3 | `upload.wikimedia.org/…/002_(NIOD_sign)_2016_(Herengracht_380-382)…` (960 px) | 1297 | none | 3905 | 3456 |
| 4 | `/data/extracts/amsterdam/park-landscape.geojson` | 986 | br | 3610 | 2740 |
| 5 | `/data/extracts/amsterdam/elevation-v1/bridges.json` | 531 | br | 1017 | 6227 |
| 6 | `upload.wikimedia.org/…/Amsterdam_-_Keizersgracht_384.JPG/960px…` | 468 | none | 2365 | 3456 |
| 7 | `upload.wikimedia.org/…/Huis_Marseille…/960px…` | 452 | none | 2309 | 3456 |
| 8 | `upload.wikimedia.org/…/DeKrijtberg_1.JPG/960px…` | 448 | none | 2333 | 3456 |
| 9 | `/data/extracts/amsterdam/facts.json` | 363 | br | 1012 | 2233 |
| 10 | `/js/signature-placement.bundle.js` | 361 | br | 1002 | 57 |
| 11 | `/data/extracts/amsterdam/click-poi-info.json` | 360 | br | 1128 | 2233 |
| 12 | `/data/extracts/amsterdam/building-tiles/14/8414/5384.geojson.gz` | 354 | (pre-gzipped file) | 2656 | 3388 |
| 13 | `/data/extracts/amsterdam/trees.json` | 343 | br | 763 | 1471 |
| 14 | `thumb.wikimedia.org/…/Imagen_de_los_canales_concéntricos…` | 332 | none | 1029 | 2328 |
| 15 | `upload.wikimedia.org/…/Singel_452.JPG/960px…` | 318 | none | 1745 | 3456 |

Just outside the top 15 before the change: `game-presentation.bundle.js` 295 KB,
`game-recall.bundle.js` 275 KB, `game-landmarks.bundle.js` 275 KB,
`route-selection.bundle.js` 237 KB: four copies of the same 1.2 MB manual-model
catalogue (fixed below; a fifth copy is in signature-placement, the one kept).

### Top 15 requests by time (before, 20 Mbit/40 ms, median run)

| # | Request | Time (ms) | KB | Starts at (ms) |
|---:|---|---:|---:|---:|
| 1 | `/materials/ambientcg/Bricks057/colour.jpg` | 5857 | 1438 | 2790 |
| 2 | `/assets/media/setup-backdrop.jpg` | 4479 | 1400 | 1466 |
| 3 | `upload.wikimedia.org/…/002_(NIOD_sign)…` | 3905 | 1297 | 3456 |
| 4 | `/data/extracts/amsterdam/park-landscape.geojson` | 3610 | 986 | 2740 |
| 5 | `/brand-icons/albert-heijn.svg` | 3302 | 1 | 2785 |
| 6 | `/js/own-ground-game.bundle.js` | 3292 | 47 | 2784 |
| 7 | `/js/building-types.bundle.js` | 3131 | 23 | 2781 |
| 8 | `/gvb-metro-51-runtime.glb` | 2723 | 253 | 2784 |
| 9 | `/data/extracts/amsterdam/building-tiles/14/8414/5384.geojson.gz` | 2656 | 354 | 3388 |
| 10 | `upload.wikimedia.org/…/Keizersgracht_384…` | 2365 | 468 | 3456 |
| 11 | `upload.wikimedia.org/…/DeKrijtberg_1…` | 2333 | 448 | 3456 |
| 12 | `upload.wikimedia.org/…/Huis_Marseille…` | 2309 | 452 | 3456 |
| 13 | `/models/niod.glb?asset=cc6c658e4e0ddf79` | 1928 | 30 | 3754 |
| 14 | `/data/extracts/amsterdam/building-facts/14/8415/5385.json.gz` | 1922 | 29 | 3444 |
| 15 | `/omafiets-runtime.glb` | 1905 | 160 | 2783 |

Rows 5–8 are small files queued behind the big images on a saturated line: time
here is mostly waiting for bandwidth, not server work. On the unshaped run the
slowest requests were the third-party critical path instead: `maplibre-gl.js`
354 ms, the unpinned `maplibre-gl@5/…js` and `…css` redirects 174 ms and
168 ms, `maplibre-gl.css` 212 ms, the Google Fonts CSS 155 ms and the woff2
files ~110–170 ms.

## Render-blocking in `<head>` of /ride

In document order (Chrome `renderBlockingStatus: blocking`):

1. `js/runtime-config.js` — sync script, 0.6 KB, same origin. Needed first (Sentry and Firebase config).
2. Google Fonts CSS (Barlow Condensed 500–800, JetBrains Mono 500/700) — third-party, ~100–155 ms.
3. `css/enamel.css` — 3.2 KB, same origin.
4. `maplibre-gl.css` from unpkg — **was** a 302 from `@5` then the file: two serial third-party round trips.
5. `maplibre-gl.js` from unpkg — **was** the same 302 + 270 KB gzip; a sync script in `<head>`, so it blocks parsing of everything after it.
6. ~1200 lines of inline `<style>` (no request).

All ~70 game scripts are synchronous at the end of `<body>`. They do not block
first paint, but the setup panel is rendered by `overlay.bundle.js` near the end
of that list, so "setup visible" waits for every script before it: 2.0 MB of
script (after this change) is the floor for the setup panel.

## Implemented (re-measured above)

| Change | Bytes saved | Effect (20 Mbit/40 ms medians) | Effort |
|---|---:|---|---|
| **Share one manual-model catalogue** across the ride bundles (`scripts/esbuild-ride-bundle.mjs`, `landmarks/manualModelsShared.ts`). route-selection and the three game runtimes no longer inline the 1.2 MB catalogue; they read the copy `signature-placement.bundle.js` already exports. | ~770 KB on the wire (script before setup 2.81 → 2.04 MB), ~4.5 MB less JS to parse | Setup visible 1482 → 1036 ms together with the next two | ½ day; build-time swap, no runtime logic changed, check-game-decomposition still rebuild-compares the bundles |
| **Setup backdrop** re-encoded (mozjpeg q68, same 2400×1800, EXIF stripped) | 1400 → 545 KB | The setup hero photo finishes ~1.1 s after it starts instead of 4.5 s | Minutes; same filename, no code change, visually identical at 1:1 |
| **maplibre-gl pinned to 5.24.0** (the version `@5` resolved to, as explore.html already pins) + preconnect to `tiles.openfreemap.org` | two 302s (~0 KB) | Removes two serial render-blocking third-party round trips (~170 ms each unshaped); FCP 760 → 416 ms shaped | Minutes |

Route started improved 3441 → 2991 ms; total transfer 20.83 → 18.96 MB.

Not needed: a loading-progress indicator. The setup panel is now visible in
~1.0 s at 20 Mbit/s (it was just under the 1.5 s threshold before).

Not changed: cache headers. `/js/**` is already `no-cache` (revalidate) and the
ride's script names are not content-hashed, so `immutable` would serve stale
code after a deploy; `/quiz/assets/**` (hashed by Vite) already has
`max-age=31536000, immutable`.

## Remaining wins, ranked by bytes saved per effort

| # | Win | Est. saving | Effort | Notes |
|---:|---|---:|---|---|
| 1 | `materials/ambientcg/Bricks057/colour.jpg` is a 1024² JPEG at quality ~100: re-encode at q80–85 | ~1.1 MB | Minutes | A rendering texture: confirm with the look-parity shots before shipping. |
| 2 | Landmark card photos are requested at Wikimedia's 960 px thumb (3.93 MB for ten). Cards render ≤ ~400 CSS px: rewrite `…/960px-…` to `…/500px-…` (a standard Wikimedia step) when the card URL is built, and fetch on approach rather than at ride start | ~2.5–2.8 MB | Hours | Third-party bytes; also frees ~3 s of bandwidth contention at ride start (rows 5–8 above). |
| 3 | Lazy-load extracts not needed before the first question: `park-landscape.geojson` 986 KB, `elevation-v1/bridges.json` 531 KB, `facts.json` 363 KB, `click-poi-info.json` 360 KB, `street-name-origins.json` 310 KB | ~1–2.5 MB off the critical path | ½–1 day each | park-landscape could be tiled like building-tiles. |
| 4 | `signature-placement.bundle.js` is now the only catalogue carrier (361 KB br). Move the catalogue to a fetched JSON that resolves before the city loads, out of the parse-blocking script | ~280 KB of blocking script | 1 day | Consumers read it synchronously today; needs an async seam. |
| 5 | Repeat visits: ~70 unhashed `/js/*.js` revalidate on every load (`no-cache`). Content-hash the bundle filenames (or stamp `?v=<hash>` at assemble time) and serve them `immutable` | repeat-load 304 round trips | 1 day | Build-pipeline change; first load unaffected. |
| 6 | Self-host the two font families (or `preload` the three woff2s) to take the Google Fonts CSS off the render-blocking path | ~100–155 ms FCP | Hours | |
| 7 | `--minify --keep-names` for game-presentation / game-recall / game-landmarks | ~23 KB br | Minutes | Small now that the catalogue is shared. |

## Landing page `/` and `/explore` (unchanged by this work; medians of 3)

| Page | Profile | FCP | LCP | Load | Requests | Bytes |
|---|---|---:|---:|---:|---:|---:|
| `/` | local | 124 ms | 124 ms | 165 ms | 11 | 385 KB |
| `/` | 20 Mbit/40 ms | 216 ms | 216 ms | 317 ms | 11 | 385 KB |
| `/explore` | local | 164 ms | 164 ms | 260 ms | 22 | 587 KB |
| `/explore` | 20 Mbit/40 ms | 200 ms | 200 ms | 351 ms | 22 | 587 KB |

`/` is small: 7 KB of HTML, 3 KB CSS, four landing screenshots as WebP (99, 92,
62 and 27 KB; the phone variant, 42 KB, is also fetched on desktop) and two
Barlow woff2s. Render-blocking: the Google Fonts CSS and `enamel.css` only.

`/explore`: `maplibre-gl.js` (270 KB gzip, `defer`) is half the bytes, then
OpenFreeMap sprites and glyph PBFs (~190 KB) and `explorer-index.json` 36 KB.
Render-blocking: Google Fonts CSS, `enamel.css`, `maplibre-gl.css`.

## Reproduce

```sh
npm run build && node scripts/assemble-canalrecall-site.mjs
npx firebase-tools@15 serve --only hosting:canalrecall --port 4471 &
node --import tsx scripts/preview/first-load.ts --base http://localhost:4471 --runs 3 --out /tmp/local.json
node --import tsx scripts/preview/first-load.ts --base http://localhost:4471 --runs 3 --throttle 20,40 --out /tmp/shaped.json
```
