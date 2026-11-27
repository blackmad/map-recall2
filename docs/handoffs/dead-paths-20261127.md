# Dead paths, flags and the MapLibre removal (2026-11-27)

Lane `lane/dead-paths-20261127`, based on `origin/lane/loading-lines-20261127` (the own-engine default). It answers
David's questions 3 and 4 from the 2026-11-27 engine round. His decision the same morning: drop Utrecht, Rotterdam
and Den Haag for now, so the game is Amsterdam only. That turned the MapLibre plan into the removal itself.

## What landed (one commit per step, so the integrator can take them separately)

| Commit | Step | Lines | Bytes off every ride |
|---|---|---|---|
| `b364ff497a` | Amsterdam only: the three cities are no longer playable | +21 / -10 in source (+ 4 rebuilt bundles) | 0 |
| `3c3ebdf056` | Dead global `__canalRecallTileBuildings` removed | -1 (+ rebuilt bundle) | ~0 |
| `b3a1ca88a7` | The MapLibre world view deleted | +131 / -7,540 in 67 files | 220,452 B raw, 63,174 B gzip |

### 1. The cities (commit `b364ff497a`)

- The city picker has been gone since 2026-10-22, and `game-route.js` already forces `cityId = 'amsterdam'`
  (`ride-locked-to-amsterdam.spec.ts`). So **no player could ride Utrecht, Rotterdam or Den Haag for 36 days**. There is
  no Sentry, analytics or feedback data in the repo that breaks rides down by city. The Sentry `city` tag
  (`monitoring.ts:111`) would show it, but the Sentry MCP needs authorising (`/mcp`) and this lane did not query it.
- `cities.ts`: the three are `playable: false`, and `parseCityId` maps them to Amsterdam. So `cityById`, `extractPath`
  and `extractUrl` can no longer reach their extracts. Their catalogue entries and `public/data/extracts/<city>/` stay
  in the repo, so the cities can come back as own-engine cities by flipping `playable`.
- Regression: `scripts/check-canal-cities.ts` (`npm run test:canal-cities`) checks, for each of the three, that the id
  parses to Amsterdam, that `cityById` gives Amsterdam, that the extract path is Amsterdam's, and that `playable` is
  false.
- Not touched: `roadExtract.test.ts` still checks that each city's published roads binary matches its JSON (the data
  stays). `quiz.spec.ts` (Utrecht/Rotterdam/Den Haag) tests the separate Map Recall app at `/`, not Canal Recall.
  `CANAL_CITY_IDS` stays the analytics city enum.

### 2. The MapLibre world view (commit `b3a1ca88a7`)

**Runtime**
- `game.js`: `this.vectorMap = engine ? new engine.OwnWorldView(...) : null`. The `VectorBasemap` branch and the
  `engineFlag` call are gone. The `_loop` rAF fallback stays for a page without the engine bundle. Three comment hunks
  changed.
- `index.html` no longer loads `js/maplibre-loader.bundle.js`, `js/map-guard.bundle.js`, `js/park-landscape.js` or
  `js/vector-map.js`, and the loader comment is gone.
- `worldViewApi.ts`: `engineFlag`, `engineForCity`, `OWN_ENGINE_CITIES` and `ENGINE_ROLLBACK` are removed.
  `OWN_ENGINE_FILES` stays. `engine/browser.ts` stops exporting `engineFlag`. `?engine=` and
  `window.__canalRecallEngine` now choose nothing.
- Deleted: `public/canal-drive/js/vector-map.js` (3,581 lines), `maplibre-loader.bundle.js`, `map-guard.bundle.js`,
  `src/canalRecall/engine/mapLibreLoader.ts` and its test, and `src/canalRecall/mapHealthBrowser.ts`.
  `scripts/build-canal-engine.mjs` no longer builds the loader.
- **Kept on purpose:**
  - `mapGuard.ts` and `renderGovernor.ts`: the own engine's `frameGuards.ts` wraps the frame host with both, and
    monitoring and analytics drain the `PENDING_*` queues.
  - `park-landscape.js`: `park-landscape.html`, a MapLibre review page that is still linked from What's New and the
    landmark pages, uses it. `check-park-landscape-streaming` and `check-brasa-tunnel-filters` test it.
  - The MapLibre tool pages (`explore.html`, `building-compare.html`, `facade-recipe-lab.html`, `rgb-city-demo.html`,
    `signature-landmark-demo.html`) load maplibre-gl from unpkg and are unaffected.

**Bytes.** The ride no longer downloads or parses vector-map.js (201,878 B, 56,167 B gzip), park-landscape.js (9,844 /
3,124), map-guard.bundle.js (8,133 / 3,486) or maplibre-loader.bundle.js (597 / 397). That is **220,452 B raw,
63,174 B gzip**. `engine.bundle.js` shrinks 298 B. maplibre-gl itself (about 800 KB minified from unpkg) was already
loaded only under `?engine=maplibre`, which is gone now.

**npm.** `maplibre-gl` is removed from `package.json`. Two packages that code imports directly were only installed
because maplibre-gl pulled them in, so they are now pinned as devDependencies at their locked versions:
- `earcut` (gardenRooms.ts, houseboats.ts) at 3.2.3;
- `@maplibre/maplibre-gl-style-spec` (`check-three-buildings.ts`, `check-brasa-tunnel-filters.mjs`) at 24.10.0.

`package-lock.json` was relocked with `npm install --package-lock-only`, which leaves `node_modules` alone. The relock
drops 12 packages: maplibre-gl, @mapbox/tiny-sdf, unitbezier, whoots-js, @maplibre/geojson-vt, mlt, vt-pbf,
gl-matrix, kdbush, murmurhash-js, pbf and potpack.

**package.json hunks**
- `build:canal-map-guard` is removed, along with its step in `build`.
- `check:signature-fallback` is removed, along with its step in `check:canal:rest`.
- `test:prism-pick` drops `tsx scripts/check-poi-click-selection.ts`.
- The dependency changes above.

**Scripts.** Five scripts ran `vector-map.js` in a VM and could only test MapLibre, so they are deleted:
`check-signature-fallback-refresh.mjs`, `check-poi-click-selection.ts`, `check-manual-map-pins.mjs`,
`check-host-opening-availability.ts` and `landmarks/check-landmark-suppression.mjs`. Other script changes:
- `check-signature-pyramidal-roofs.mjs` keeps its PyramidalRoofs half.
- `check-centrale-markthal-geometry.ts` gets an inline copy of MapLibre's Mercator, and its output is byte-identical
  before and after.
- Four street-appearance review scripts stop hashing vector-map.js.
- Two own-ground probes stop setting `__canalRecallEngine`.
- `scripts/review/capture-thousand-building-game.mjs` is left alone: it was already broken, because
  `study-facades.bundle.js` is missing.

**Perf budgets.** `cameraParityPx` (enforced by the deleted engine-parity spec) and `iphoneMapLibreWorkersMB` are
removed from `tests/perf/budgets.json` and `scripts/perf-gate-lib.mjs`. `perfGate.test.mjs` now pins its "enforced by"
line on `iphoneTextureMB`.

**Regression:** `engine.test.ts` gains two tests:
- "the own engine is the only world view: no MapLibre path, no ?engine=maplibre rollback". It checks that game.js has
  no `VectorBasemap` or `engineFlag`, that index.html loads none of the four files, that vector-map.js is gone, and that
  the API names are gone.
- "Amsterdam, the only city, has the own map and the roads binary".

### e2e specs that named MapLibre

**Deleted whole (17 files).** They are `engine-parity`, `no-maplibre`, `answered-street-name`, `bike-xray`,
`block-face`, `boat-model`, `centre-feedback`, `complete-city`, `facade-trees-look`, `facade-trees-perf`,
`filler-buildings`, `own-ground-route-line`, `poi-lift`, `sun-heading`, `three-buildings-ab`, `touch-shader-warmup`
and `white-flash-probe`. Every test in them was a `test.skip(OWN, 'MapLibre style assertion: deleted with the default
path at P5')`, or a MapLibre-versus-own camera comparison.

**Trimmed (MapLibre-only blocks removed, the rest kept).**
- `building-look`: 8 → 7 tests.
- `canal-recall`: 19 → 16.
- `engine-own`: 4 → 2, keeping "maplibregl.Map is never constructed and maplibre-gl is never fetched" as a regression.
- `highlight`: 3 → 1, plus its empty `FRAMES` loop.
- `labels`: 2 → 1.
- `landmark-highlight`: 5 → 1.
- `overview-transition`: 3 → 2.
- `own-ground-game`: 4 → 3.
- `own-ground-roads`: 2 → 1.

**Re-pinned to the own engine only.**
- `covered-passage`: the `if (OWN)` branch is now the test.
- `governor-no-flash`: always `?tier=high`.
- `distance-haze` and `streaming-gaps`: the `test.skip(!OWN)` guard is dropped.
- `own-label-fade` and `rail-beds`: they no longer set the engine global.
- `three-buildings-no-flash`: it no longer serves MapLibre offline.
- `building-click-perf`: its BEFORE=1 set drops vector-map.js.

**Helpers.**
- `worldCam.ts` loses `OWN`. Its `vm.map ?? vm.cameraMap` idiom still reads right.
- `helpers.ts`: `useEngine` only applies `BUNDLES_DIR`. `openRoute` asserts `vectorMap.engine === 'own'`.
  `serveMapLibreOffline` and `PW_OFFLINE_MAP` are gone. Three specs still mention `PW_OFFLINE_MAP` in comments, and it
  is a no-op now.

**Left as is.**
- `poi-labels-production` (`POI_ENGINE`, which measures prod), `sky-flicker-capture` (`SKY_ENGINE`) and
  `weak-gpu-perf` (an output filename) still mention the engine. `?engine=` is ignored now.
- Many specs still read `vectorMap.map ?? vectorMap.cameraMap` or mention MapLibre in comments. They work.

### Follow-ups this lane did not do

1. **Dead exports in shared bundles.** Exports whose only caller was vector-map.js:
   - `CanalRecallBuildings.buildingColorExpression`, `buildingLight`, `buildingOpacity` and
     `dedupeAppearanceFeatures` (buildingStyle.ts);
   - `CanalRecallOrientationPois.basemapOrientationPoiLayerIds`;
   - `CanalRecallStreets.streetOverlayLayers` and `ANSWERED_STREET_SOURCE_ID`;
   - `mapGuard.reportWebglUnavailable`;
   - `labels/labelOverlay.ts` (mounted only by vector-map.js);
   - `sculptures/browser.ts`. `?sculptures=1` was a no-op under the own engine (`UNIMPLEMENTED`).

   Removing them takes bundle rebuilds and their unit tests. It is a separate, mechanical lane.
2. **`UNIMPLEMENTED`** in ownWorldView.ts still lists "park landscape (MapLibre style layers)" and "recipe tiles
   (?recipeTiles=1)": features the MapLibre ride had and the own engine never drew. Decide whether either should come
   back. The recipe tiles are still used by the explorer page.
3. **The `vectorMap` name** (`game.vectorMap`) is kept because about 200 game and spec sites read it. A rename to
   `worldView` would be a churn-only change.
4. **TODO.md and HISTORY.md** need the integrator: P5 "delete MapLibre" is done, and the three cities are parked with
   their data.

## Option (a), for the record: own-engine extracts for the three cities

David chose (b), dropping them. This is the cost of bringing them back. Each city already has the two files the own
engine refuses to start without (`own-map-v1/overview.json.gz` and `roads-v2/streets-routing.bin.gz`). What it lacks
is everything that makes the Amsterdam ride look like Amsterdam. Amsterdam has 85 extract entries (327 MB), against 24
or 25 for each of the others (19–29 MB). The missing layers are:

- **Ground:** `own-ground-osm-v1`, `ground-height-v1`, `elevation-v1`, `open-ground-v1/v2`, `piers-v1`, `rail-v1`,
  `road-marks-v1`, `parks-v1` and `terraces-v1`. These are a scripts/own-ground plus scripts/roads pipeline run per
  city, from OSM, BGT, AHN and PDOK, all open national data.
- **Buildings:** `building-tiles`, `bag-tiles`, `building-overview`, `overview-tiles-v1`, `world-v1` (baked cells and
  shells), `house-specs`, `roof-facts` and `ridge-axes`. These come from 3DBAG and BAG (national) through the
  building-tiles, bake-frontages and world-compile steps (`--no-policy --shell`).
- **Content:** `orientation-pois`, `street-name-origins`, `monument-facts`, `building-facts`/`articles`, `tours`,
  `transit-*`, shopfronts and street furniture. Most of this has Amsterdam-only sources (the BAG `beschrijvingNaam` for
  street names, Amsterdam's own photo sources and the Ordekaart), so the other cities would get a thinner version.

**Estimate per city:**
- Mechanical pipeline runs (ground, buildings, world compile): about 1–2 lane-days each. Most of that is compute and
  review of the first ride, not code. The pipelines are city-agnostic in name (`--city`), but several steps hard-code
  Amsterdam bounds or sources. Expect a day of fixes for the first city.
- A content pass to make a ride worth playing: 2–5 lane-days.
- Extract size: about 60–120 MB per city, scaling Amsterdam's 327 MB by built area.
- The kit and buurt look work (the colour, glazing and roofline quality bar) does not transfer: those cities would
  draw with generic kits.

**Total:** about 1 week for the first city and 3–4 days for each of the next two, before any look work.
**Option (b):** done in this lane at the cost of the 200 KB of MapLibre code above. The data stays, so the decision is
reversible.

## Flag inventory

Method:
- Typed and legacy sources in `src/canalRecall` and `public/canal-drive/js` (bundles, tests and stories excluded) were
  scanned for `URLSearchParams(...).get/has`, `queryFlag`, regex `[?&]x=` reads, the shared flag helpers (`flag`,
  `flagOn`, `numberFlag`, `pageFlag`, `pageParam`, `flagOf`, `tapsParam`, `canalRecallLookFlag`, `on`) and
  `__canalRecall*` globals.
- localStorage holds data, not toggles. The one toggle is `canalRecallCam` (the first-person camera,
  `ownWorldView.ts:1553`), which is kept.
- "Used by" counts the files under `tests/` (spec), stories, `scripts/`, docs `*.md` and `public/canal-drive/*.html`
  that write `?name=` (or name the global).
- "Last touched" is `git blame` of the reading line, measured on the base before this lane's commits.
- A URL flag and its mirror global (`?x` / `__canalRecallX`) share one row.

Verdicts:
- **retire**: an off-switch (`!== '0'`) or opt-in (`=== '1'`) whose reading line has not changed in more than 7 days.
  The default is chosen, so the switch and the other branch can go. Where a spec or script uses it, re-pin that first.
  None of these were removed in this lane: they all have readers, and the lane rule wants off-switches for behaviour
  changes. This is the list for an integrator decision.
- **knob**: a value parameter (a budget, distance, mode or tier), or a flag whose default the scan could not read from
  one line, older than 7 days. Fold the measured value into a constant when it is no longer tuned.
- **removed**: read only by vector-map.js or the loader, so it went with them. msaa, governor, facades, trees3d and
  the other `canalRecallLookFlag` reads in vector-map.js went too, although their names are also read elsewhere.
- **dead**: no reader or no writer anywhere. Only `__canalRecallTileBuildings` qualified, and it is removed.
- **lever**: a global read in code that only the `POPIN_FLAGS` / `pop-in.mjs --flags` A/B harness can set (it sets any
  `__canalRecall<Name>`). It is not dead by that definition. `__canalRecallExtractPath`, `__canalRecallReliefIds` and
  `__canalRecallStandIns` look like hooks nobody sets any more; check them before removing.
- **keep**: a setting, entry link, diagnostic, review-page input, an off-switch younger than 7 days, or a global that
  carries state or a spec oracle.

Counts: retire 54, knob 198, removed 9 (plus the look flags inside vector-map.js), dead 1, lever 12, keep 134. The
counts are from a heuristic scan; check a row's line before acting on it.

| Verdict | Flag | Default | Where | Used by | Last touched | Why |
|---|---|---|---|---|---|---|
| retire | `?treeCull / __canalRecallTreeCull` | on (?x=0 off) | public/canal-drive/js/inventory-trees-source.js:76 | doc:1 | 2026-11-01 (26 d) | off-switch; default on for over 7 days |
| retire | `?landmarkSpecular / __canalRecallLandmarkSpecular` | off (?x=1 on) | public/canal-drive/js/signature-landmarks-source.js:1018 | spec:1 doc:1 | 2026-10-10 (48 d) | opt-in experiment; default off for over 7 days (delete the opt-in branch or adopt it); re-pin 1 spec(s)/0 script(s) first |
| retire | `?buildingTypes / __canalRecallBuildingTypes` | on (?x=0 off) | public/canal-drive/js/signature-landmarks-source.js:237 | spec:3 doc:3 | 2026-10-16 (42 d) | off-switch; default on for over 7 days; re-pin 3 spec(s)/0 script(s) first |
| retire | `?landmarkGate` | on (?x=0 off) | public/canal-drive/js/signature-landmarks-source.js:772 | doc:2 | 2026-11-01 (26 d) | off-switch; default on for over 7 days |
| retire | `?furniture` | on (?x=0 off) | public/canal-drive/js/street-furniture-source.js:22 | spec:1 script:1 doc:2 | 2026-11-01 (26 d) | off-switch; default on for over 7 days; re-pin 1 spec(s)/1 script(s) first |
| retire | `?buurtProfiles / __canalRecallBuurtProfiles` | on (?x=0 off) | src/canalRecall/buurtProfiles/data.ts:10 | doc:3 | 2026-10-29 (29 d) | off-switch; default on for over 7 days |
| retire | `?newbuildFamily / __canalRecallNewbuildFamily` | on (?x=0 off) | src/canalRecall/contemporaryFamily.ts:31 | doc:3 | 2026-11-10 (17 d) | off-switch; default on for over 7 days |
| retire | `?designUnits / __canalRecallDesignUnits` | off (?x=1 on) | src/canalRecall/designUnits/draw.ts:37 | script:3 doc:5 | 2026-11-19 (8 d) | opt-in experiment; default off for over 7 days (delete the opt-in branch or adopt it); re-pin 0 spec(s)/3 script(s) first |
| retire | `?detailFreezeAerial / __canalRecallDetailFreezeAerial` | off (?x=1 on) | src/canalRecall/detailRing.ts:114 | doc:3 | 2026-11-07 (20 d) | opt-in experiment; default off for over 7 days (delete the opt-in branch or adopt it) |
| retire | `?detailLinger / __canalRecallDetailLinger` | on (?x=0 off) | src/canalRecall/detailRing.ts:52 | spec:1 doc:1 | 2026-11-05 (22 d) | off-switch; default on for over 7 days; re-pin 1 spec(s)/0 script(s) first |
| retire | `?aerialScale / __canalRecallAerialScale` | off (?x=1 on) | src/canalRecall/engine/aerialPower.ts:88 | doc:3 | 2026-11-08 (19 d) | opt-in experiment; default off for over 7 days (delete the opt-in branch or adopt it) |
| retire | `?aerialShadowMap / __canalRecallAerialShadowMap` | off (?x=1 on) | src/canalRecall/engine/aerialPower.ts:91 | doc:1 | 2026-11-08 (19 d) | opt-in experiment; default off for over 7 days (delete the opt-in branch or adopt it) |
| retire | `?lineCull / __canalRecallLineCull` | on (?x=0 off) | src/canalRecall/engine/overlays/flatLines.ts:102 | doc:1 | 2026-11-01 (26 d) | off-switch; default on for over 7 days |
| retire | `?featureGroupCache / __canalRecallFeatureGroupCache` | on (?x=0 off) | src/canalRecall/engine/overviewFootprints.ts:60 | doc:1 | 2026-11-05 (22 d) | off-switch; default on for over 7 days |
| retire | `?eyeClear` | on (?x=0 off) | src/canalRecall/engine/ownWorldView.ts:1619 | doc:1 | 2026-11-09 (18 d) | off-switch; default on for over 7 days |
| retire | `?coverDim` | on (?x=0 off) | src/canalRecall/engine/ownWorldView.ts:1652 | doc:1 | 2026-11-05 (22 d) | off-switch; default on for over 7 days |
| retire | `?routeAhead / __canalRecallRouteAhead` | on (?x=0 off) | src/canalRecall/engine/routeAhead.ts:119 | spec:1 doc:1 | 2026-11-05 (22 d) | off-switch; default on for over 7 days; re-pin 1 spec(s)/0 script(s) first |
| retire | `?yardFill` | off (?x=1 on) | src/canalRecall/engine/yardFillLayer.ts:8 | spec:1 script:1 doc:4 | 2026-11-09 (18 d) | opt-in experiment; default off for over 7 days (delete the opt-in branch or adopt it); re-pin 1 spec(s)/1 script(s) first |
| retire | `?rowFrontSteps` | on (?x=0 off) | src/canalRecall/houseLine/rowFront.ts:548 | - | 2026-11-13 (14 d) | off-switch; default on for over 7 days |
| retire | `?rowFront` | off (?x=1 on) | src/canalRecall/houseLine/rowFrontFlag.ts:7 | script:1 doc:3 | 2026-11-14 (13 d) | opt-in experiment; default off for over 7 days (delete the opt-in branch or adopt it); re-pin 0 spec(s)/1 script(s) first |
| retire | `?wallChroma` | off (?x=1 on) | src/canalRecall/houseSpec/wallColour.ts:50 | doc:2 | 2026-11-12 (15 d) | opt-in experiment; default off for over 7 days (delete the opt-in branch or adopt it) |
| retire | `?roadShields` | on (?x=0 off) | src/canalRecall/labels/roadShields.ts:28 | doc:1 | 2026-11-08 (19 d) | off-switch; default on for over 7 days |
| retire | `?cellMipSharpen` | on (?x=0 off) | src/canalRecall/look/cellMips.ts:59 | - | 2026-11-06 (21 d) | off-switch; default on for over 7 days |
| retire | `?windowSdfTent` | off (?x=1 on) | src/canalRecall/look/windowSdf.ts:222 | doc:1 | 2026-11-06 (21 d) | opt-in experiment; default off for over 7 days (delete the opt-in branch or adopt it) |
| retire | `?modernFacades / __canalRecallModernFacades` | on (?x=0 off) | src/canalRecall/modernFacades.ts:35 | doc:1 | 2026-10-29 (29 d) | off-switch; default on for over 7 days |
| retire | `?farHorizon` | on (?x=0 off) | src/canalRecall/ownGround/farRing.ts:279 | doc:1 | 2026-11-06 (21 d) | off-switch; default on for over 7 days |
| retire | `?groundQueuedInstall` | on (?x=0 off) | src/canalRecall/ownGround/gameGround.ts:461 | doc:1 | 2026-11-08 (19 d) | off-switch; default on for over 7 days |
| retire | `?groundShare / __canalRecallGroundShare` | off (?x=1 on) | src/canalRecall/ownGround/groundShare.ts:36 | doc:2 | 2026-11-13 (14 d) | opt-in experiment; default off for over 7 days (delete the opt-in branch or adopt it) |
| retire | `?groundShareMain` | on (?x=0 off) | src/canalRecall/ownGround/groundShare.ts:46 | - | 2026-11-13 (14 d) | off-switch; default on for over 7 days |
| retire | `?groundAffinity / __canalRecallGroundAffinity` | on (?x=0 off) | src/canalRecall/ownGround/groundWorkers.ts:109 | doc:1 | 2026-11-08 (19 d) | off-switch; default on for over 7 days |
| retire | `?groundAffinityLod / __canalRecallGroundAffinityLod` | on (?x=0 off) | src/canalRecall/ownGround/groundWorkers.ts:122 | doc:1 | 2026-11-08 (19 d) | off-switch; default on for over 7 days |
| retire | `?groundBlockFirst / __canalRecallGroundBlockFirst` | on (?x=0 off) | src/canalRecall/ownGround/groundWorkers.ts:135 | doc:1 | 2026-11-08 (19 d) | off-switch; default on for over 7 days |
| retire | `?groundFocus / __canalRecallGroundFocus` | on (?x=0 off) | src/canalRecall/ownGround/groundWorkers.ts:50 | doc:1 | 2026-11-08 (19 d) | off-switch; default on for over 7 days |
| retire | `?groundQuick / __canalRecallGroundQuick` | off (?x=1 on) | src/canalRecall/ownGround/groundWorkers.ts:73 | doc:1 | 2026-11-08 (19 d) | opt-in experiment; default off for over 7 days (delete the opt-in branch or adopt it) |
| retire | `?groundPull / __canalRecallGroundPull` | on (?x=0 off) | src/canalRecall/ownGround/groundWorkers.ts:93 | doc:1 | 2026-11-08 (19 d) | off-switch; default on for over 7 days |
| retire | `?wallsPerArea / __canalRecallWallsPerArea` | off (?x=1 on) | src/canalRecall/pendingWalls.ts:46 | doc:2 | 2026-11-14 (13 d) | opt-in experiment; default off for over 7 days (delete the opt-in branch or adopt it) |
| retire | `?treeCaps / __canalRecallTreeCaps` | off (?x=1 on) | src/canalRecall/rendererShared/trunkGeometry.ts:22 | doc:1 | 2026-11-01 (26 d) | opt-in experiment; default off for over 7 days (delete the opt-in branch or adopt it) |
| retire | `?retailRealAll / __canalRecallRetailRealAll` | off (?x=1 on) | src/canalRecall/retailPages.ts:50 | doc:1 | 2026-11-16 (11 d) | opt-in experiment; default off for over 7 days (delete the opt-in branch or adopt it) |
| retire | `?retailParts / __canalRecallRetailParts` | off (?x=1 on) | src/canalRecall/retailPages.ts:59 | script:1 doc:1 | 2026-11-16 (11 d) | opt-in experiment; default off for over 7 days (delete the opt-in branch or adopt it); re-pin 0 spec(s)/1 script(s) first |
| retire | `?flatRoofSurface` | on (?x=0 off) | src/canalRecall/roofs/flatRoofSurface.ts:32 | script:1 doc:4 | 2026-11-08 (19 d) | off-switch; default on for over 7 days; re-pin 0 spec(s)/1 script(s) first |
| retire | `?flatRoofTone` | on (?x=0 off) | src/canalRecall/roofs/flatRoofTone.ts:29 | script:1 doc:4 | 2026-11-08 (19 d) | off-switch; default on for over 7 days; re-pin 0 spec(s)/1 script(s) first |
| retire | `?roofFacts` | on (?x=0 off) | src/canalRecall/roofs/roofFacts.ts:24 | spec:1 doc:1 | 2026-10-13 (45 d) | off-switch; default on for over 7 days; re-pin 1 spec(s)/0 script(s) first |
| retire | `?shopGrammar / __canalRecallShopGrammar` | off (?x=1 on) | src/canalRecall/shopGrammar.ts:19 | doc:1 | 2026-11-10 (17 d) | opt-in experiment; default off for over 7 days (delete the opt-in branch or adopt it) |
| retire | `?stampCard` | on (?x=0 off) | src/canalRecall/stampArrival.ts:16 | doc:1 | 2026-11-08 (19 d) | off-switch; default on for over 7 days |
| retire | `?lookAhead / __canalRecallLookAhead` | on (?x=0 off) | src/canalRecall/streamingLookAhead.ts:119 | doc:2 | 2026-10-16 (42 d) | off-switch; default on for over 7 days |
| retire | `?oddAxisCells` | on (?x=0 off) | src/canalRecall/streetFacadeRendering.ts:254 | spec:1 doc:3 | 2026-11-10 (17 d) | off-switch; default on for over 7 days; re-pin 1 spec(s)/0 script(s) first |
| retire | `?swapComplement / __canalRecallSwapComplement` | on (?x=0 off) | src/canalRecall/swapComplement.ts:17 | spec:2 doc:3 | 2026-11-05 (22 d) | off-switch; default on for over 7 days; re-pin 2 spec(s)/0 script(s) first |
| retire | `?chunkFade / __canalRecallChunkFade` | on (?x=0 off) | src/canalRecall/threeBuildingsBrowser.ts:259 | doc:4 | 2026-10-16 (42 d) | off-switch; default on for over 7 days |
| retire | `?swapFade / __canalRecallSwapFade` | on (?x=0 off) | src/canalRecall/threeBuildingsBrowser.ts:274 | spec:1 doc:3 | 2026-11-05 (22 d) | off-switch; default on for over 7 days; re-pin 1 spec(s)/0 script(s) first |
| retire | `?shellRoofs / __canalRecallShellRoofs` | on (?x=0 off) | src/canalRecall/threeBuildingsBrowser.ts:293 | spec:1 doc:4 | 2026-11-05 (22 d) | off-switch; default on for over 7 days; re-pin 1 spec(s)/0 script(s) first |
| retire | `?cellMipsKeep` | off (?x=1 on) | src/canalRecall/threeBuildingsBrowser.ts:794 | spec:2 | 2026-11-06 (21 d) | opt-in experiment; default off for over 7 days (delete the opt-in branch or adopt it); re-pin 2 spec(s)/0 script(s) first |
| retire | `?keepVerts` | off (?x=1 on) | src/canalRecall/threeBuildingsBrowser.ts:98 | spec:1 | 2026-11-13 (14 d) | opt-in experiment; default off for over 7 days (delete the opt-in branch or adopt it); re-pin 1 spec(s)/0 script(s) first |
| retire | `?ringFollow / __canalRecallRingFollow` | on (?x=0 off) | src/canalRecall/world/worldRing.ts:114 | spec:2 doc:1 | 2026-11-05 (22 d) | off-switch; default on for over 7 days; re-pin 2 spec(s)/0 script(s) first |
| retire | `?worldRing` | on (?x=0 off) | src/canalRecall/world/worldRing.ts:32 | doc:1 | 2026-11-01 (26 d) | off-switch; default on for over 7 days |
| knob | `?worldPrewarm` | value | public/canal-drive/js/game-route.js:1635 | doc:1 | 2026-11-01 (26 d) | tuning knob; fold the chosen value into a constant |
| knob | `?landmarkRelease` | value | public/canal-drive/js/signature-landmarks-source.js:1354 | doc:1 | 2026-11-01 (26 d) | tuning knob; fold the chosen value into a constant |
| knob | `?ordinaryLod` | value | public/canal-drive/js/signature-landmarks-source.js:1391 | doc:2 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?landmarkLod2` | value | public/canal-drive/js/signature-landmarks-source.js:1401 | doc:2 | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?chunkLod2` | value | public/canal-drive/js/signature-landmarks-source.js:1416 | doc:4 | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?landmarkBatch` | value | public/canal-drive/js/signature-landmarks-source.js:1422 | doc:3 | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?landmarkLod2Px` | value | public/canal-drive/js/signature-landmarks-source.js:1430 | doc:1 | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?landmarkLod2M` | value | public/canal-drive/js/signature-landmarks-source.js:1430 | doc:1 | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?chunkLod2Px` | value | public/canal-drive/js/signature-landmarks-source.js:1441 | doc:2 | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?landmarkMergeLod1` | value | public/canal-drive/js/signature-landmarks-source.js:1539 | doc:1 | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?landmarkMergeShared` | value | public/canal-drive/js/signature-landmarks-source.js:1560 | - | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?chunkMerge` | value | public/canal-drive/js/signature-landmarks-source.js:1569 | doc:4 | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?asset` | value | public/canal-drive/js/signature-landmarks-source.js:53 | script:3 doc:4 html:1 | 2026-10-09 (49 d) | tuning knob; fold the chosen value into a constant |
| knob | `?msaa / __canalRecallMsaa` | value | public/canal-drive/js/vector-map.js:118 | spec:1 doc:2 | 2026-10-23 (35 d) | tuning knob; fold the chosen value into a constant |
| knob | `?facades / __canalRecallFacades` | value | public/canal-drive/js/vector-map.js:157 | spec:1 doc:1 | 2026-10-02 (56 d) | tuning knob; fold the chosen value into a constant |
| knob | `?trees3d / __canalRecallTrees3d` | value | public/canal-drive/js/vector-map.js:158 | spec:1 script:4 doc:2 | 2026-10-02 (56 d) | tuning knob; fold the chosen value into a constant |
| knob | `?coverRoute / __canalRecallCoverRoute` | value | public/canal-drive/js/vector-map.js:3185 | spec:1 doc:2 | 2026-11-09 (18 d) | tuning knob; fold the chosen value into a constant |
| knob | `?governor / __canalRecallGovernor` | value | public/canal-drive/js/vector-map.js:322 | spec:11 script:2 doc:1 | 2026-10-23 (35 d) | tuning knob; fold the chosen value into a constant |
| knob | `?shadows / __canalRecallShadows` | value | public/canal-drive/js/vector-map.js:324 | spec:1 doc:1 | 2026-10-30 (28 d) | tuning knob; fold the chosen value into a constant |
| knob | `?transition / __canalRecallTransition` | value | public/canal-drive/js/vector-map.js:443 | spec:1 script:1 doc:2 | 2026-10-16 (42 d) | tuning knob; fold the chosen value into a constant |
| knob | `?bagTiles` | value | src/canalRecall/bagTiles.ts:284 | spec:1 script:2 doc:9 | 2026-10-13 (45 d) | tuning knob; fold the chosen value into a constant |
| knob | `?tileBudget` | value | src/canalRecall/buildingTilesBrowser.ts:199 | spec:1 doc:2 | 2026-10-23 (35 d) | tuning knob; fold the chosen value into a constant |
| knob | `?buurtKit / __canalRecallBuurtKit` | value | src/canalRecall/buurtGenerator/kitFlag.ts:12 | doc:2 | 2026-11-15 (12 d) | tuning knob; fold the chosen value into a constant |
| knob | `?coarseSplit / __canalRecallCoarseSplit` | value | src/canalRecall/coarseSplit.ts:31 | - | 2026-11-14 (13 d) | tuning knob; fold the chosen value into a constant |
| knob | `?aerialFps / __canalRecallAerialFps` | value | src/canalRecall/engine/aerialPower.ts:86 | doc:2 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?aerialShadows / __canalRecallAerialShadows` | value | src/canalRecall/engine/aerialPower.ts:89 | doc:2 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?arrivalPace / __canalRecallArrivalPace` | value | src/canalRecall/engine/arrivalPace.ts:54 | spec:1 doc:2 | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?bakedCoarse / __canalRecallBakedCoarse` | value | src/canalRecall/engine/bakedCoarse.ts:62 | spec:3 doc:4 | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?bakedBytes / __canalRecallBakedBytes` | value | src/canalRecall/engine/bakedCoarse.ts:78 | doc:1 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?bakedRelease / __canalRecallBakedRelease` | value | src/canalRecall/engine/bakedCoarse.ts:96 | spec:1 doc:3 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?corridorFocus / __canalRecallCorridorFocus` | value | src/canalRecall/engine/corridorFocus.ts:17 | doc:1 | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?landmarkHaze / __canalRecallLandmarkHaze` | value | src/canalRecall/engine/drawLimit.ts:122 | - | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?drawLimit / __canalRecallDrawLimit` | value | src/canalRecall/engine/drawLimit.ts:40 | script:1 doc:1 | 2026-11-09 (18 d) | tuning knob; fold the chosen value into a constant |
| knob | `?drawLimitM / __canalRecallDrawLimitM` | value | src/canalRecall/engine/drawLimit.ts:47 | - | 2026-11-09 (18 d) | tuning knob; fold the chosen value into a constant |
| knob | `?drawLimitAirM / __canalRecallDrawLimitAirM` | value | src/canalRecall/engine/drawLimit.ts:48 | doc:2 | 2026-11-09 (18 d) | tuning knob; fold the chosen value into a constant |
| knob | `?farShells / __canalRecallFarShells` | value | src/canalRecall/engine/farShells.ts:25 | spec:1 doc:4 | 2026-11-06 (21 d) | tuning knob; fold the chosen value into a constant |
| knob | `?coverGridIdle` | value | src/canalRecall/engine/idleBoxGrid.ts:76 | doc:1 | 2026-11-05 (22 d) | tuning knob; fold the chosen value into a constant |
| knob | `?landmarkDissolve / __canalRecallLandmarkDissolve` | value | src/canalRecall/engine/levelDissolve.ts:27 | - | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?landmarkArrive / __canalRecallLandmarkArrive` | value | src/canalRecall/engine/levelDissolve.ts:43 | - | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?landmarkHold / __canalRecallLandmarkHold` | value | src/canalRecall/engine/levelDissolve.ts:58 | - | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?engine / __canalRecallEngine` | value | src/canalRecall/engine/mapLibreLoader.ts:27 | spec:43 script:38 doc:51 html:2 | 2026-10-31 (27 d) | tuning knob; fold the chosen value into a constant |
| knob | `?overviewSpans` | value | src/canalRecall/engine/overviewLayer.ts:195 | doc:1 | 2026-11-01 (26 d) | tuning knob; fold the chosen value into a constant |
| knob | `?overviewCull / __canalRecallOverviewCull` | value | src/canalRecall/engine/overviewLayer.ts:384 | spec:1 doc:1 | 2026-11-01 (26 d) | tuning knob; fold the chosen value into a constant |
| knob | `?labelAerialPois / __canalRecallLabelAerialPois` | value | src/canalRecall/engine/ownWorldView.ts:117 | spec:1 doc:2 | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?revealSwap / __canalRecallRevealSwap` | value | src/canalRecall/engine/ownWorldView.ts:1374 | doc:1 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?revealSwapN` | value | src/canalRecall/engine/ownWorldView.ts:1395 | doc:1 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?spoilerSources / __canalRecallSpoilerSources` | value | src/canalRecall/engine/ownWorldView.ts:1854 | doc:1 | 2026-11-05 (22 d) | tuning knob; fold the chosen value into a constant |
| knob | `?stagedGroundHook / __canalRecallStagedGroundHook` | value | src/canalRecall/engine/ownWorldView.ts:246 | doc:2 | 2026-11-05 (22 d) | tuning knob; fold the chosen value into a constant |
| knob | `?labelOcclusion / __canalRecallLabelOcclusion` | value | src/canalRecall/engine/ownWorldView.ts:266 | - | 2026-11-01 (26 d) | tuning knob; fold the chosen value into a constant |
| knob | `?labelAerialCap / __canalRecallLabelAerialCap` | value | src/canalRecall/engine/ownWorldView.ts:268 | doc:3 | 2026-11-06 (21 d) | tuning knob; fold the chosen value into a constant |
| knob | `?labelSticky / __canalRecallLabelSticky` | value | src/canalRecall/engine/ownWorldView.ts:270 | spec:1 doc:1 | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?labelClipTries / __canalRecallLabelClipTries` | value | src/canalRecall/engine/ownWorldView.ts:277 | doc:1 | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?labelBudget / __canalRecallLabelBudget` | value | src/canalRecall/engine/ownWorldView.ts:280 | doc:2 | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?labelBudget / __canalRecallLabelBudget` | value | src/canalRecall/engine/ownWorldView.ts:282 | doc:2 | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?groundBasesAerial / __canalRecallGroundBasesAerial` | value | src/canalRecall/engine/ownWorldView.ts:290 | spec:2 doc:2 | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?labelIndexIdle / __canalRecallLabelIndexIdle` | value | src/canalRecall/engine/ownWorldView.ts:303 | doc:1 | 2026-11-05 (22 d) | tuning knob; fold the chosen value into a constant |
| knob | `?clearanceIdle / __canalRecallClearanceIdle` | value | src/canalRecall/engine/ownWorldView.ts:315 | doc:1 | 2026-11-05 (22 d) | tuning knob; fold the chosen value into a constant |
| knob | `?renderOnChange / __canalRecallRenderOnChange` | value | src/canalRecall/engine/ownWorldView.ts:389 | spec:1 doc:2 | 2026-11-05 (22 d) | tuning knob; fold the chosen value into a constant |
| knob | `?skyClear / __canalRecallSkyClear` | value | src/canalRecall/engine/ownWorldView.ts:389 | spec:1 doc:1 | 2026-11-05 (22 d) | tuning knob; fold the chosen value into a constant |
| knob | `?facadeDetail / __canalRecallFacadeDetail` | value | src/canalRecall/engine/ownWorldView.ts:469 | script:1 doc:2 | 2026-10-31 (27 d) | tuning knob; fold the chosen value into a constant |
| knob | `?groundDetail / __canalRecallGroundDetail` | value | src/canalRecall/engine/ownWorldView.ts:472 | spec:1 doc:2 | 2026-10-31 (27 d) | tuning knob; fold the chosen value into a constant |
| knob | `?groundNear / __canalRecallGroundNear` | value | src/canalRecall/engine/ownWorldView.ts:473 | spec:1 | 2026-10-31 (27 d) | tuning knob; fold the chosen value into a constant |
| knob | `?groundRing / __canalRecallGroundRing` | value | src/canalRecall/engine/ownWorldView.ts:474 | spec:1 script:1 doc:1 | 2026-10-31 (27 d) | tuning knob; fold the chosen value into a constant |
| knob | `?tierRecheck / __canalRecallTierRecheck` | value | src/canalRecall/engine/ownWorldView.ts:516 | - | 2026-11-13 (14 d) | tuning knob; fold the chosen value into a constant |
| knob | `?labelLazyPolicy / __canalRecallLabelLazyPolicy` | value | src/canalRecall/engine/ownWorldView.ts:541 | doc:1 | 2026-11-09 (18 d) | tuning knob; fold the chosen value into a constant |
| knob | `?labelFade / __canalRecallLabelFade` | value | src/canalRecall/engine/ownWorldView.ts:541 | doc:1 | 2026-11-09 (18 d) | tuning knob; fold the chosen value into a constant |
| knob | `?cellTierFollow / __canalRecallCellTierFollow` | value | src/canalRecall/engine/ownWorldView.ts:674 | doc:3 | 2026-11-05 (22 d) | tuning knob; fold the chosen value into a constant |
| knob | `?revealLight / __canalRecallRevealLight` | value | src/canalRecall/engine/ownWorldView.ts:899 | doc:1 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?kitFade / __canalRecallKitFade` | value | src/canalRecall/engine/popFade.ts:24 | doc:1 | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?farHandFade / __canalRecallFarHandFade` | value | src/canalRecall/engine/popFade.ts:76 | - | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?popFade / __canalRecallPopFade` | value | src/canalRecall/engine/popFade.ts:9 | doc:1 | 2026-11-09 (18 d) | tuning knob; fold the chosen value into a constant |
| knob | `?toonBands / __canalRecallToonBands` | value | src/canalRecall/engine/toonLook.ts:30 | doc:1 | 2026-11-01 (26 d) | tuning knob; fold the chosen value into a constant |
| knob | `?viewPriority / __canalRecallViewPriority` | value | src/canalRecall/engine/viewPriority.ts:104 | - | 2026-11-14 (13 d) | tuning knob; fold the chosen value into a constant |
| knob | `?registerFacts` | value | src/canalRecall/facade/registerRecipe.ts:27 | spec:1 doc:4 | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?landmarkQuestions` | value | src/canalRecall/game/landmarkQuestion.ts:195 | spec:9 doc:1 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?groundFloor / __canalRecallGroundFloor` | value | src/canalRecall/groundFloor/extract.ts:11 | spec:1 script:2 doc:3 | 2026-11-16 (11 d) | tuning knob; fold the chosen value into a constant |
| knob | `?houseSpecs` | value | src/canalRecall/houseSpec/decorate.ts:124 | spec:2 script:2 doc:2 | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?registerGable` | value | src/canalRecall/houseSpec/decorate.ts:360 | doc:2 | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?specFields` | value | src/canalRecall/houseSpec/routeAFields.ts:120 | doc:1 | 2026-11-13 (14 d) | tuning knob; fold the chosen value into a constant |
| knob | `?specTemplateFill` | value | src/canalRecall/houseSpec/routeAFields.ts:140 | doc:1 | 2026-11-13 (14 d) | tuning knob; fold the chosen value into a constant |
| knob | `?storeyGuard` | value | src/canalRecall/houseSpec/storeyPlan.ts:178 | doc:1 | 2026-11-13 (14 d) | tuning knob; fold the chosen value into a constant |
| knob | `?structurePrior` | value | src/canalRecall/houseSpec/structurePrior.ts:40 | script:1 doc:2 | 2026-11-13 (14 d) | tuning knob; fold the chosen value into a constant |
| knob | `?specWalls` | value | src/canalRecall/houseSpec/wallColour.ts:64 | spec:1 doc:2 | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?wallExposure` | value | src/canalRecall/houseSpec/wallExposure.ts:61 | script:1 doc:1 | 2026-11-13 (14 d) | tuning knob; fold the chosen value into a constant |
| knob | `?wallFinish` | value | src/canalRecall/houseSpec/wallExposure.ts:92 | doc:1 | 2026-11-13 (14 d) | tuning knob; fold the chosen value into a constant |
| knob | `?wallSample` | value | src/canalRecall/houseSpec/wallSample.ts:80 | doc:1 | 2026-11-14 (13 d) | tuning knob; fold the chosen value into a constant |
| knob | `?industrialKit / __canalRecallIndustrialKit` | value | src/canalRecall/industrial/industrialKit.ts:30 | doc:1 | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?bareFronts / __canalRecallBareFronts` | value | src/canalRecall/landmarks/blankInstalls.ts:38 | spec:1 doc:2 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?blankInstall` | value | src/canalRecall/landmarks/blankInstalls.ts:46 | script:1 doc:1 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?landmarkBudget` | value | src/canalRecall/landmarks/landmarkResidency.ts:49 | doc:1 | 2026-10-23 (35 d) | tuning knob; fold the chosen value into a constant |
| knob | `?landmarkReach` | value | src/canalRecall/landmarks/landmarkResidency.ts:65 | doc:2 | 2026-11-05 (22 d) | tuning knob; fold the chosen value into a constant |
| knob | `?landmarkTexCap / __canalRecallLandmarkTexCap` | value | src/canalRecall/landmarks/landmarkTexCap.ts:35 | spec:1 doc:3 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?streetChunks` | value | src/canalRecall/landmarks/ordinaryChunks.ts:37 | spec:13 script:2 doc:7 html:1 | 2026-10-13 (45 d) | tuning knob; fold the chosen value into a constant |
| knob | `?brickLift` | value | src/canalRecall/look/brickLift.ts:46 | script:1 doc:3 | 2026-11-12 (15 d) | tuning knob; fold the chosen value into a constant |
| knob | `?treeCalm / __canalRecallTreeCalm` | value | src/canalRecall/look/calmTones.ts:31 | doc:1 | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?roofFamily / __canalRecallRoofFamily` | value | src/canalRecall/look/calmTones.ts:32 | doc:1 | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?cellRolloff / __canalRecallCellRolloff` | value | src/canalRecall/look/cellMips.ts:238 | spec:2 doc:3 | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?cellRolloffPitch` | value | src/canalRecall/look/cellMips.ts:246 | doc:2 | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?cellRolloffLinear` | value | src/canalRecall/look/cellMips.ts:246 | - | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?cellRolloffMask` | value | src/canalRecall/look/cellMips.ts:246 | - | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?cellMips / __canalRecallCellMips` | value | src/canalRecall/look/cellMips.ts:40 | doc:4 | 2026-11-06 (21 d) | tuning knob; fold the chosen value into a constant |
| knob | `?cellTierBand / __canalRecallCellTierBand` | value | src/canalRecall/look/cellMips.ts:490 | doc:1 | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?cellLodBias / __canalRecallCellLodBias` | value | src/canalRecall/look/cellMips.ts:51 | doc:2 | 2026-11-06 (21 d) | tuning knob; fold the chosen value into a constant |
| knob | `?cellMipLinear` | value | src/canalRecall/look/cellMips.ts:60 | - | 2026-11-06 (21 d) | tuning knob; fold the chosen value into a constant |
| knob | `?cellMipLobes` | value | src/canalRecall/look/cellMips.ts:60 | - | 2026-11-06 (21 d) | tuning knob; fold the chosen value into a constant |
| knob | `?depthFade / __canalRecallDepthFade` | value | src/canalRecall/look/depthFade.ts:52 | doc:4 | 2026-11-01 (26 d) | tuning knob; fold the chosen value into a constant |
| knob | `?fadeStrength / __canalRecallFadeStrength` | value | src/canalRecall/look/depthFade.ts:65 | doc:2 | 2026-11-05 (22 d) | tuning knob; fold the chosen value into a constant |
| knob | `?depthFadeRange / __canalRecallDepthFadeRange` | value | src/canalRecall/look/depthFade.ts:88 | - | 2026-11-01 (26 d) | tuning knob; fold the chosen value into a constant |
| knob | `?depthFadeMinNear / __canalRecallDepthFadeMinNear` | value | src/canalRecall/look/depthFade.ts:95 | doc:1 | 2026-11-05 (22 d) | tuning knob; fold the chosen value into a constant |
| knob | `?markingFade / __canalRecallMarkingFade` | value | src/canalRecall/look/markingFade.ts:31 | doc:1 | 2026-11-01 (26 d) | tuning knob; fold the chosen value into a constant |
| knob | `?maskFormat / __canalRecallMaskFormat` | value | src/canalRecall/look/maskPacking.ts:18 | doc:1 | 2026-11-01 (26 d) | tuning knob; fold the chosen value into a constant |
| knob | `?measuredSingleGain` | value | src/canalRecall/look/measuredSingleGain.ts:14 | doc:1 | 2026-11-16 (11 d) | tuning knob; fold the chosen value into a constant |
| knob | `?wallVariety` | value | src/canalRecall/look/measuredWallPool.ts:100 | doc:2 | 2026-11-12 (15 d) | tuning knob; fold the chosen value into a constant |
| knob | `?wallPool` | value | src/canalRecall/look/measuredWallPool.ts:44 | doc:2 | 2026-11-12 (15 d) | tuning knob; fold the chosen value into a constant |
| knob | `?walls` | value | src/canalRecall/look/measuredWalls.ts:40 | spec:1 doc:1 | 2026-10-24 (34 d) | tuning knob; fold the chosen value into a constant |
| knob | `?modelWallFloor` | value | src/canalRecall/look/modelWallFloor.ts:19 | script:1 doc:1 | 2026-11-13 (14 d) | tuning knob; fold the chosen value into a constant |
| knob | `?paletteLevel / __canalRecallPaletteLevel` | value | src/canalRecall/look/paletteLevel.ts:21 | script:1 doc:3 | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?pilasterTone` | value | src/canalRecall/look/pilasterTone.ts:24 | doc:1 | 2026-11-14 (13 d) | tuning knob; fold the chosen value into a constant |
| knob | `?realLook / __canalRecallRealLook` | value | src/canalRecall/look/realLook.ts:42 | doc:2 | 2026-11-14 (13 d) | tuning knob; fold the chosen value into a constant |
| knob | `?texturePolicy / __canalRecallTexturePolicy` | value | src/canalRecall/look/texturePolicy.ts:108 | doc:3 | 2026-11-05 (22 d) | tuning knob; fold the chosen value into a constant |
| knob | `?cellPx / __canalRecallCellPx` | value | src/canalRecall/look/texturePolicy.ts:117 | doc:1 | 2026-11-05 (22 d) | tuning knob; fold the chosen value into a constant |
| knob | `?thinFade / __canalRecallThinFade` | value | src/canalRecall/look/thinFade.ts:102 | doc:4 | 2026-11-06 (21 d) | tuning knob; fold the chosen value into a constant |
| knob | `?toonFronts / __canalRecallToonFronts` | value | src/canalRecall/look/toonFronts.ts:33 | doc:1 | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?wallRule` | value | src/canalRecall/look/wallRule.ts:20 | script:1 doc:2 | 2026-11-13 (14 d) | tuning knob; fold the chosen value into a constant |
| knob | `?windowSdf / __canalRecallWindowSdf` | value | src/canalRecall/look/windowSdf.ts:125 | doc:7 | 2026-11-06 (21 d) | tuning knob; fold the chosen value into a constant |
| knob | `?farWindows / __canalRecallFarWindows` | value | src/canalRecall/look/windowSdf.ts:154 | doc:1 | 2026-11-14 (13 d) | tuning knob; fold the chosen value into a constant |
| knob | `?windowSdfBand / __canalRecallWindowSdfBand` | value | src/canalRecall/look/windowSdf.ts:205 | doc:2 | 2026-11-06 (21 d) | tuning knob; fold the chosen value into a constant |
| knob | `?windowSdfFoot` | value | src/canalRecall/look/windowSdf.ts:218 | - | 2026-11-06 (21 d) | tuning knob; fold the chosen value into a constant |
| knob | `?windowSdfFade` | value | src/canalRecall/look/windowSdf.ts:219 | - | 2026-11-06 (21 d) | tuning knob; fold the chosen value into a constant |
| knob | `?windowSdfFrameMin` | value | src/canalRecall/look/windowSdf.ts:220 | - | 2026-11-06 (21 d) | tuning knob; fold the chosen value into a constant |
| knob | `?windowSdfBar` | value | src/canalRecall/look/windowSdf.ts:221 | - | 2026-11-06 (21 d) | tuning knob; fold the chosen value into a constant |
| knob | `?railStripes / __canalRecallRailStripes` | value | src/canalRecall/nodeFrame/ground.ts:149 | spec:1 doc:4 | 2026-11-15 (12 d) | tuning knob; fold the chosen value into a constant |
| knob | `?overviewStreetFade / __canalRecallOverviewStreetFade` | value | src/canalRecall/overviewTiles/tileset.ts:94 | doc:1 | 2026-11-13 (14 d) | tuning knob; fold the chosen value into a constant |
| knob | `?transition / __canalRecallTransition` | value | src/canalRecall/overviewTransition/blend.ts:27 | spec:1 script:1 doc:2 | 2026-10-16 (42 d) | tuning knob; fold the chosen value into a constant |
| knob | `?groundFrameBudget / __canalRecallGroundFrameBudget` | value | src/canalRecall/ownGround/frameBudget.ts:75 | doc:1 | 2026-11-05 (22 d) | tuning knob; fold the chosen value into a constant |
| knob | `?groundBudgetGate` | value | src/canalRecall/ownGround/frameBudget.ts:88 | doc:1 | 2026-11-05 (22 d) | tuning knob; fold the chosen value into a constant |
| knob | `?groundNearTiles / __canalRecallGroundNearTiles` | value | src/canalRecall/ownGround/gameGround.ts:170 | doc:1 | 2026-11-01 (26 d) | tuning knob; fold the chosen value into a constant |
| knob | `?groundReach / __canalRecallGroundReach` | value | src/canalRecall/ownGround/gameGround.ts:185 | doc:1 | 2026-11-01 (26 d) | tuning knob; fold the chosen value into a constant |
| knob | `?groundTiles / __canalRecallGroundTiles` | value | src/canalRecall/ownGround/gameGround.ts:194 | doc:1 | 2026-10-29 (29 d) | tuning knob; fold the chosen value into a constant |
| knob | `?dryWayDecks / __canalRecallDryWayDecks` | value | src/canalRecall/ownGround/gameGround.ts:220 | doc:5 | 2026-11-01 (26 d) | tuning knob; fold the chosen value into a constant |
| knob | `?railSpans / __canalRecallRailSpans` | value | src/canalRecall/ownGround/gameGround.ts:226 | doc:3 | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?railDecks / __canalRecallRailDecks` | value | src/canalRecall/ownGround/gameGround.ts:232 | doc:3 | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?openGround / __canalRecallOpenGround` | value | src/canalRecall/ownGround/gameGround.ts:238 | spec:1 script:1 doc:4 | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?bridgeCarry / __canalRecallBridgeCarry` | value | src/canalRecall/ownGround/gameGround.ts:244 | script:1 doc:2 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?redDedupe / __canalRecallRedDedupe` | value | src/canalRecall/ownGround/gameGround.ts:250 | spec:1 script:1 doc:2 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?portalClip / __canalRecallPortalClip` | value | src/canalRecall/ownGround/gameGround.ts:256 | doc:4 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?crossings / __canalRecallCrossings` | value | src/canalRecall/ownGround/gameGround.ts:262 | doc:3 | 2026-11-12 (15 d) | tuning knob; fold the chosen value into a constant |
| knob | `?portalEnds / __canalRecallPortalEnds` | value | src/canalRecall/ownGround/gameGround.ts:268 | doc:3 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?groundPlanShare / __canalRecallGroundPlanShare` | value | src/canalRecall/ownGround/gameGround.ts:274 | doc:2 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?groundDeterministic / __canalRecallGroundDeterministic` | value | src/canalRecall/ownGround/gameGround.ts:280 | doc:2 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?rampGaps / __canalRecallRampGaps` | value | src/canalRecall/ownGround/gameGround.ts:286 | doc:2 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?roadSlivers / __canalRecallRoadSlivers` | value | src/canalRecall/ownGround/gameGround.ts:292 | spec:1 script:1 doc:2 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?bridgeGaps / __canalRecallBridgeGaps` | value | src/canalRecall/ownGround/gameGround.ts:298 | script:1 doc:2 | 2026-11-01 (26 d) | tuning knob; fold the chosen value into a constant |
| knob | `?rails / __canalRecallRails` | value | src/canalRecall/ownGround/gameGround.ts:323 | script:1 doc:6 | 2026-10-30 (28 d) | tuning knob; fold the chosen value into a constant |
| knob | `?roadLook / __canalRecallRoadLook` | value | src/canalRecall/ownGround/gameGround.ts:335 | doc:1 | 2026-10-29 (29 d) | tuning knob; fold the chosen value into a constant |
| knob | `?parks / __canalRecallParks` | value | src/canalRecall/ownGround/gameGround.ts:344 | doc:3 | 2026-10-13 (45 d) | tuning knob; fold the chosen value into a constant |
| knob | `?railOffset / __canalRecallRailOffset` | value | src/canalRecall/ownGround/gameGround.ts:418 | doc:3 | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?groundFronts / __canalRecallGroundFronts` | value | src/canalRecall/ownGround/gameGround.ts:430 | doc:1 | 2026-11-13 (14 d) | tuning knob; fold the chosen value into a constant |
| knob | `?groundPrefetch / __canalRecallGroundPrefetch` | value | src/canalRecall/ownGround/groundPrefetch.ts:29 | doc:1 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?groundView` | value | src/canalRecall/ownGround/groundResidency.ts:33 | doc:2 | 2026-11-06 (21 d) | tuning knob; fold the chosen value into a constant |
| knob | `?railRetry` | value | src/canalRecall/ownGround/groundResidency.ts:38 | script:1 doc:2 | 2026-11-06 (21 d) | tuning knob; fold the chosen value into a constant |
| knob | `?groundEarlyWorkers` | value | src/canalRecall/ownGround/groundResidency.ts:48 | doc:1 | 2026-11-13 (14 d) | tuning knob; fold the chosen value into a constant |
| knob | `?groundFirstAlone` | value | src/canalRecall/ownGround/groundResidency.ts:56 | doc:1 | 2026-11-14 (13 d) | tuning knob; fold the chosen value into a constant |
| knob | `?groundParallelInit` | value | src/canalRecall/ownGround/groundResidency.ts:61 | doc:1 | 2026-11-13 (14 d) | tuning knob; fold the chosen value into a constant |
| knob | `?groundRequeue` | value | src/canalRecall/ownGround/groundResidency.ts:66 | script:1 doc:2 | 2026-11-06 (21 d) | tuning knob; fold the chosen value into a constant |
| knob | `?groundShareMB` | value | src/canalRecall/ownGround/groundShare.ts:52 | doc:1 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?groundWorkers / __canalRecallGroundWorkers` | value | src/canalRecall/ownGround/groundWorkers.ts:15 | doc:1 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?railStripes / __canalRecallRailStripes` | value | src/canalRecall/ownGround/railStripes.ts:109 | spec:1 doc:4 | 2026-11-05 (22 d) | tuning knob; fold the chosen value into a constant |
| knob | `?railMinPx / __canalRecallRailMinPx` | value | src/canalRecall/ownGround/railStripes.ts:111 | spec:1 doc:3 | 2026-11-05 (22 d) | tuning knob; fold the chosen value into a constant |
| knob | `?farRail / __canalRecallFarRail` | value | src/canalRecall/ownGround/railStripes.ts:114 | spec:1 doc:3 | 2026-11-05 (22 d) | tuning knob; fold the chosen value into a constant |
| knob | `?farRailDrape / __canalRecallFarRailDrape` | value | src/canalRecall/ownGround/railStripes.ts:117 | script:1 doc:1 | 2026-11-06 (21 d) | tuning knob; fold the chosen value into a constant |
| knob | `?labelCalm / __canalRecallLabelCalm` | value | src/canalRecall/ownMap/labelCalm.ts:67 | spec:1 doc:2 | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?overviewRail` | value | src/canalRecall/ownMap/style.ts:115 | script:1 doc:3 | 2026-11-06 (21 d) | tuning knob; fold the chosen value into a constant |
| knob | `?precompile / __canalRecallPrecompile` | value | src/canalRecall/rendererShared/compileBudget.ts:57 | spec:1 doc:1 | 2026-10-29 (29 d) | tuning knob; fold the chosen value into a constant |
| knob | `?lightHier / __canalRecallLightHier` | value | src/canalRecall/rendererShared/lightHierarchy.ts:14 | doc:1 | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?coverPause / __canalRecallCoverPause` | value | src/canalRecall/rendererShared/mapCover.ts:102 | spec:2 script:1 doc:1 | 2026-10-29 (29 d) | tuning knob; fold the chosen value into a constant |
| knob | `?extrasRebuild` | value | src/canalRecall/rendererShared/rebuildCoalescer.ts:117 | doc:1 | 2026-11-05 (22 d) | tuning knob; fold the chosen value into a constant |
| knob | `?frameViewCheck / __canalRecallFrameViewCheck` | value | src/canalRecall/rendererShared/sharedFrame.ts:64 | doc:1 | 2026-11-01 (26 d) | tuning knob; fold the chosen value into a constant |
| knob | `?shadowPrimer / __canalRecallShadowPrimer` | value | src/canalRecall/rendererShared/sharedFrame.ts:799 | doc:1 | 2026-11-01 (26 d) | tuning knob; fold the chosen value into a constant |
| knob | `?tileWhole / __canalRecallTileWhole` | value | src/canalRecall/rendererShared/sharedFrame.ts:88 | - | 2026-11-01 (26 d) | tuning knob; fold the chosen value into a constant |
| knob | `?tileDraw / __canalRecallTileDraw` | value | src/canalRecall/rendererShared/tiledGeometry.ts:53 | doc:1 | 2026-10-29 (29 d) | tuning knob; fold the chosen value into a constant |
| knob | `?treeFade / __canalRecallTreeFade` | value | src/canalRecall/rendererShared/treeFade.ts:23 | - | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?treesIncremental / __canalRecallTreesIncremental` | value | src/canalRecall/rendererShared/treeInstances.ts:274 | doc:1 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| knob | `?retailReal / __canalRecallRetailReal` | value | src/canalRecall/retailPages.ts:20 | script:1 doc:1 | 2026-11-15 (12 d) | tuning knob; fold the chosen value into a constant |
| knob | `?retailBrand / __canalRecallRetailBrand` | value | src/canalRecall/retailPages.ts:71 | doc:1 | 2026-11-16 (11 d) | tuning knob; fold the chosen value into a constant |
| knob | `?retailGround / __canalRecallRetailGround` | value | src/canalRecall/retailTemplates.ts:22 | script:1 doc:3 | 2026-11-14 (13 d) | tuning knob; fold the chosen value into a constant |
| knob | `?ridgeAxes` | value | src/canalRecall/roofs/ridgeFacts.ts:17 | doc:1 | 2026-11-13 (14 d) | tuning knob; fold the chosen value into a constant |
| knob | `?cellTaps / __canalRecallCellTaps` | value | src/canalRecall/roofTier.ts:191 | doc:3 | 2026-11-07 (20 d) | tuning knob; fold the chosen value into a constant |
| knob | `?cellTierAniso / __canalRecallCellTierAniso` | value | src/canalRecall/roofTier.ts:362 | doc:2 | 2026-11-06 (21 d) | tuning knob; fold the chosen value into a constant |
| knob | `?shopPass / __canalRecallShopPass` | value | src/canalRecall/shopProps/flags.ts:17 | doc:2 | 2026-11-19 (8 d) | tuning knob; fold the chosen value into a constant |
| knob | `?shopInteriors / __canalRecallShopInteriors` | value | src/canalRecall/shopProps/flags.ts:19 | doc:2 | 2026-11-19 (8 d) | tuning knob; fold the chosen value into a constant |
| knob | `?terraces / __canalRecallTerraces` | value | src/canalRecall/terraces/extract.ts:28 | spec:1 script:1 doc:2 | 2026-11-14 (13 d) | tuning knob; fold the chosen value into a constant |
| knob | `?facadeTiles / __canalRecallFacadeTiles` | value | src/canalRecall/threeBuildingsBrowser.ts:140 | doc:1 | 2026-10-29 (29 d) | tuning knob; fold the chosen value into a constant |
| knob | `?chunkBuilds` | value | src/canalRecall/threeBuildingsBrowser.ts:1848 | doc:1 | 2026-10-31 (27 d) | tuning knob; fold the chosen value into a constant |
| knob | `?uploadBudget` | value | src/canalRecall/threeBuildingsBrowser.ts:445 | doc:1 | 2026-10-30 (28 d) | tuning knob; fold the chosen value into a constant |
| knob | `?treeShape / __canalRecallTreeShape` | value | src/canalRecall/trees/treeShape.ts:32 | spec:1 script:3 doc:2 | 2026-11-10 (17 d) | tuning knob; fold the chosen value into a constant |
| knob | `?worldWorker` | value | src/canalRecall/world/worldCells.ts:362 | spec:1 doc:1 | 2026-10-30 (28 d) | tuning knob; fold the chosen value into a constant |
| knob | `?ringFootprint / __canalRecallRingFootprint` | value | src/canalRecall/world/worldRing.ts:78 | doc:1 | 2026-11-08 (19 d) | tuning knob; fold the chosen value into a constant |
| dead (removed) | `__canalRecallTileBuildings` | - | src/canalRecall/tileBuildings/browser.ts:54 | - | 2026-10-13 (45 d) | written, never read anywhere |
| removed | `?ownGround / __canalRecallOwnGround` | value | public/canal-drive/js/vector-map.js:159 | spec:12 script:9 doc:19 | 2026-10-30 (28 d) | read only by vector-map.js / park-landscape.js (deleted in this lane) |
| removed | `?recipeTiles / __canalRecallRecipeTiles` | value | public/canal-drive/js/vector-map.js:161 | spec:3 script:2 doc:9 | 2026-10-13 (45 d) | read only by vector-map.js / park-landscape.js (deleted in this lane) |
| removed | `?sculptures / __canalRecallSculptures` | value | public/canal-drive/js/vector-map.js:162 | spec:1 script:1 doc:6 | 2026-10-13 (45 d) | read only by vector-map.js / park-landscape.js (deleted in this lane) |
| removed | `__canalRecallHoldBasemap` | - | public/canal-drive/js/vector-map.js:2149 | doc:2 | 2026-10-16 (42 d) | MapLibre path only (deleted in this lane) |
| removed | `?overviewTiles / __canalRecallOverviewTiles` | value | public/canal-drive/js/vector-map.js:2271 | doc:2 | 2026-10-16 (42 d) | read only by vector-map.js / park-landscape.js (deleted in this lane) |
| removed | `?shopNames` | value | public/canal-drive/js/vector-map.js:2880 | spec:1 doc:1 | 2026-10-30 (28 d) | read only by vector-map.js / park-landscape.js (deleted in this lane) |
| removed | `?buildingSource` | value | public/canal-drive/js/vector-map.js:87 | doc:1 | 2026-10-24 (34 d) | read only by vector-map.js / park-landscape.js (deleted in this lane) |
| removed | `?groundRadius` | value | public/canal-drive/js/vector-map.js:99 | doc:1 | 2026-10-23 (35 d) | read only by vector-map.js / park-landscape.js (deleted in this lane) |
| removed | `__canalRecallMapLibreLoad` | - | src/canalRecall/engine/mapLibreLoader.ts:39 | - | 2026-10-31 (27 d) | MapLibre path only (deleted in this lane) |
| lever | `__canalRecallViewPriority_state` | - | src/canalRecall/engine/viewPriority.ts:113 | - | 2026-11-14 (13 d) | read in code, set only by the POPIN_FLAGS / pop-in.mjs --flags harness |
| lever | `__canalRecallShaderFacades` | - | src/canalRecall/look/facadeShader.ts:15 | doc:1 | 2026-11-12 (15 d) | read in code, set only by the POPIN_FLAGS / pop-in.mjs --flags harness |
| lever | `__canalRecallHighlightExtent` | - | src/canalRecall/look/highlight.ts:150 | - | 2026-10-16 (42 d) | read in code, set only by the POPIN_FLAGS / pop-in.mjs --flags harness |
| lever | `__canalRecallHighlightAccent` | - | src/canalRecall/look/highlight.ts:39 | - | 2026-10-13 (45 d) | read in code, set only by the POPIN_FLAGS / pop-in.mjs --flags harness |
| keep | `__canalRecallPendingGraphicsFailures` | - | src/canalRecall/mapGuard.ts:270 | - | 2026-10-24 (34 d) | early-error queue: mapGuard writes it through the PENDING_* constant, monitoring and analytics drain it |
| keep | `__canalRecallPendingAnalyticsGraphics` | - | src/canalRecall/mapGuard.ts:273 | - | 2026-10-29 (29 d) | early-error queue: mapGuard writes it through the PENDING_* constant, monitoring and analytics drain it |
| lever | `__canalRecallReliefIds` | - | src/canalRecall/ownGround/reliefDecode.ts:33 | - | 2026-10-31 (27 d) | read in code, set only by the POPIN_FLAGS / pop-in.mjs --flags harness |
| lever | `__canalRecallStandIns` | - | src/canalRecall/rendererShared/shadowStandIns.ts:279 | - | 2026-11-01 (26 d) | read in code, set only by the POPIN_FLAGS / pop-in.mjs --flags harness |
| lever | `__canalRecallRetailBrandAll` | - | src/canalRecall/retailPages.ts:75 | - | 2026-11-16 (11 d) | read in code, set only by the POPIN_FLAGS / pop-in.mjs --flags harness |
| lever | `__canalRecallShopInteriorsAll` | - | src/canalRecall/shopProps/flags.ts:22 | - | 2026-11-19 (8 d) | read in code, set only by the POPIN_FLAGS / pop-in.mjs --flags harness |
| lever | `__canalRecallExtractPath` | - | src/canalRecall/threeBuildingsBrowser.ts:319 | - | 2026-11-12 (15 d) | read in code, set only by the POPIN_FLAGS / pop-in.mjs --flags harness |
| lever | `__canalRecallRecipeTilesBase` | - | src/canalRecall/tileBuildings/browser.ts:17 | - | 2026-10-13 (45 d) | read in code, set only by the POPIN_FLAGS / pop-in.mjs --flags harness |
| keep | `?source` | value | public/canal-drive/js/facade-photo-lab.js:320 | - | 2026-09-10 (78 d) | review/tool page input |
| keep | `?run` | on (?x=0 off) | public/canal-drive/js/facade-photo-lab.js:4 | spec:4 story:1 script:4 doc:2 html:1 | 2026-09-10 (78 d) | setting, entry link or diagnostic |
| keep | `?ride` | value | public/canal-drive/js/game-route.js:1322 | spec:22 script:24 doc:29 html:1 | 2026-11-08 (19 d) | setting, entry link or diagnostic |
| keep | `?tour` | value | public/canal-drive/js/game-route.js:1348 | spec:1 doc:3 html:3 | 2026-10-17 (41 d) | setting, entry link or diagnostic |
| keep | `__canalRecallSession` | - | public/canal-drive/js/game-route.js:1374 | spec:7 doc:2 | 2026-11-08 (19 d) | oracle/hook: set in code, read by specs or scripts |
| keep | `?ferry` | value | public/canal-drive/js/game-route.js:1386 | spec:2 doc:3 | 2026-10-09 (49 d) | setting, entry link or diagnostic |
| keep | `?travel` | value | public/canal-drive/js/game-route.js:1409 | spec:13 script:4 doc:1 html:82 | 2026-10-13 (45 d) | setting, entry link or diagnostic |
| keep | `?start` | value | public/canal-drive/js/game-route.js:1418 | spec:1 script:1 | 2026-10-17 (41 d) | setting, entry link or diagnostic |
| keep | `__canalRecallDistanceHaze` | - | public/canal-drive/js/game-route.js:198 | spec:1 doc:1 | 2026-11-05 (22 d) | oracle/hook: set in code, read by specs or scripts |
| keep | `?queue` | value | public/canal-drive/js/neighbourhood-review-assisted.js:67 | script:1 doc:4 html:1 | 2026-09-10 (78 d) | review/tool page input |
| keep | `?roads / __canalRecallRoads` | value | public/canal-drive/js/osm-loader.js:33 | spec:1 script:4 doc:6 | 2026-11-01 (26 d) | setting, entry link or diagnostic |
| keep | `__canalRecallFpsHidePin` | - | public/canal-drive/js/renderer.js:162 | spec:1 doc:2 | 2026-11-10 (17 d) | oracle/hook: set in code, read by specs or scripts |
| keep | `?worldCache` | value | public/canal-drive/js/road-network.js:57 | doc:1 | 2026-11-01 (26 d) | setting, entry link or diagnostic |
| keep | `__canalRecallLandmarkGateCheck` | - | public/canal-drive/js/signature-landmarks-source.js:777 | doc:1 | 2026-11-01 (26 d) | runtime state shared between modules |
| keep | `__canalRecall` | - | public/canal-drive/js/signature-landmarks-source.js:79 | spec:1 script:1 | 2026-11-07 (20 d) | spec hook: set by specs, read in code |
| keep | `__canalRecallLandmarkRequests` | - | public/canal-drive/js/signature-landmarks-source.js:790 | - | 2026-11-01 (26 d) | runtime state shared between modules |
| keep | `?buildings3d / __canalRecallBuildings3d` | value | public/canal-drive/js/vector-map.js:125 | spec:4 script:4 doc:1 html:1 | 2026-10-02 (56 d) | setting, entry link or diagnostic |
| keep | `?dpr` | value | public/canal-drive/js/vector-map.js:64 | spec:1 script:2 doc:4 | 2026-10-23 (35 d) | setting, entry link or diagnostic |
| keep | `?chasePitch` | value | public/canal-drive/js/vector-map.js:670 | spec:2 doc:1 | 2026-10-25 (33 d) | setting, entry link or diagnostic |
| keep | `__canalRecallKeepGroundArrays` | - | public/canal-drive/js/vector-map.js:79 | spec:5 doc:2 | 2026-10-23 (35 d) | spec hook: set by specs, read in code |
| keep | `?steppedFronts` | value | src/canalRecall/bentFrontFacets.ts:122 | - | 2026-11-20 (7 d) | tuning knob under measurement |
| keep | `?packet` | value | src/canalRecall/case24GableCityPreview.ts:18 | - | 2026-09-24 (64 d) | review/tool page input |
| keep | `?area` | value | src/canalRecall/cityAppearanceViewer.ts:15 | script:5 doc:3 html:3 | 2026-09-10 (78 d) | review/tool page input |
| keep | `?release` | value | src/canalRecall/cityAppearanceViewer.ts:16 | script:6 doc:1 | 2026-09-24 (64 d) | review/tool page input |
| keep | `?frontage` | value | src/canalRecall/cityAppearanceViewer.ts:204 | script:8 | 2026-09-24 (64 d) | review/tool page input |
| keep | `?inspect` | value | src/canalRecall/cityAppearanceViewer.ts:204 | - | 2026-09-24 (64 d) | review/tool page input |
| keep | `?sourceTier` | value | src/canalRecall/cityAppearanceViewer.ts:238 | - | 2026-09-24 (64 d) | review/tool page input |
| keep | `?cameraPreset` | value | src/canalRecall/cityAppearanceViewer.ts:239 | - | 2026-09-24 (64 d) | review/tool page input |
| keep | `?camera` | value | src/canalRecall/cityAppearanceViewer.ts:68 | - | 2026-09-24 (64 d) | review/tool page input |
| keep | `?staged` | off (?x=1 on) | src/canalRecall/coverage/page.ts:100 | - | 2026-11-14 (13 d) | review/tool page input |
| keep | `?own` | off (?x=1 on) | src/canalRecall/coverage/page.ts:101 | doc:1 | 2026-10-16 (42 d) | review/tool page input |
| keep | `?mark` | on (?x=0 off) | src/canalRecall/coverage/page.ts:102 | doc:1 | 2026-10-16 (42 d) | review/tool page input |
| keep | `?buurt` | value | src/canalRecall/coverage/page.ts:295 | spec:2 script:2 doc:1 | 2026-10-16 (42 d) | review/tool page input |
| keep | `?colour` | value | src/canalRecall/coverage/page.ts:92 | spec:1 script:1 doc:1 | 2026-10-16 (42 d) | review/tool page input |
| keep | `?desc` | on (?x=0 off) | src/canalRecall/coverage/page.ts:99 | - | 2026-11-14 (13 d) | review/tool page input |
| keep | `?roofEdge / __canalRecallRoofEdge` | off (?x=1 on) | src/canalRecall/engine/bakedCoarse.ts:68 | doc:2 | 2026-11-20 (7 d) | off-switch younger than 7 days (lane rule) |
| keep | `__canalRecallDrawLimitNowValue` | - | src/canalRecall/engine/drawLimit.ts:136 | - | 2026-11-09 (18 d) | runtime state shared between modules |
| keep | `__canalRecallDrawLimitNow` | - | src/canalRecall/engine/drawLimit.ts:136 | script:3 | 2026-11-09 (18 d) | oracle/hook: set in code, read by specs or scripts |
| keep | `?cam` | value | src/canalRecall/engine/fpsCamera.ts:114 | spec:8 script:2 doc:3 | 2026-11-10 (17 d) | setting, entry link or diagnostic |
| keep | `__canalRecallFramePhaseRecorder` | - | src/canalRecall/engine/framePhases.ts:40 | script:2 | 2026-11-01 (26 d) | oracle/hook: set in code, read by specs or scripts |
| keep | `?framePhases / __canalRecallFramePhases` | value | src/canalRecall/engine/framePhases.ts:42 | script:2 doc:15 | 2026-11-01 (26 d) | setting, entry link or diagnostic |
| keep | `?markets` | value | src/canalRecall/engine/marketLayer.ts:26 | spec:1 script:2 doc:2 | 2026-11-14 (13 d) | setting, entry link or diagnostic |
| keep | `?marketDay` | value | src/canalRecall/engine/marketLayer.ts:81 | spec:2 doc:1 | 2026-11-20 (7 d) | setting, entry link or diagnostic |
| keep | `?startHold / __canalRecallStartHold` | value | src/canalRecall/engine/ownWorldView.ts:1145 | doc:1 | 2026-11-09 (18 d) | setting, entry link or diagnostic |
| keep | `?startSettle / __canalRecallStartSettle` | value | src/canalRecall/engine/ownWorldView.ts:1192 | doc:2 | 2026-11-08 (19 d) | setting, entry link or diagnostic |
| keep | `?startSettleGround / __canalRecallStartSettleGround` | value | src/canalRecall/engine/ownWorldView.ts:1193 | doc:1 | 2026-11-08 (19 d) | setting, entry link or diagnostic |
| keep | `?bob` | off (?x=1 on) | src/canalRecall/engine/ownWorldView.ts:1554 | doc:2 | 2026-11-10 (17 d) | setting, entry link or diagnostic |
| keep | `?glCounters / __canalRecallGlCounters` | value | src/canalRecall/engine/ownWorldView.ts:391 | spec:2 doc:4 | 2026-11-01 (26 d) | setting, entry link or diagnostic |
| keep | `?tier` | value | src/canalRecall/engine/ownWorldView.ts:458 | spec:6 script:3 doc:3 | 2026-10-31 (27 d) | setting, entry link or diagnostic |
| keep | `?worldShells` | value | src/canalRecall/engine/ownWorldView.ts:849 | doc:1 | 2026-11-07 (20 d) | setting, entry link or diagnostic |
| keep | `?perfHud / __canalRecallPerfHud` | value | src/canalRecall/engine/perfHud.ts:57 | doc:6 | 2026-11-05 (22 d) | setting, entry link or diagnostic |
| keep | `?smaa / __canalRecallSmaa` | value | src/canalRecall/engine/postAA.ts:18 | doc:5 | 2026-11-06 (21 d) | setting, entry link or diagnostic |
| keep | `?look / __canalRecallLook` | value | src/canalRecall/engine/toonLook.ts:11 | spec:2 script:1 doc:5 | 2026-11-10 (17 d) | setting, entry link or diagnostic |
| keep | `?workerPool / __canalRecallWorkerPool` | value | src/canalRecall/engine/workerPool.ts:96 | script:1 doc:1 | 2026-10-31 (27 d) | setting, entry link or diagnostic |
| keep | `?model` | value | src/canalRecall/explorer/panel.ts:90 | spec:1 script:1 html:1 | 2026-10-17 (41 d) | review/tool page input |
| keep | `?task` | value | src/canalRecall/facade/panoAnchorBrowser.ts:557 | script:2 doc:2 html:2 | 2026-09-24 (64 d) | review/tool page input |
| keep | `?scope` | value | src/canalRecall/facade/wallMaterialDemo.ts:12 | doc:2 html:1 | 2026-09-26 (62 d) | review/tool page input |
| keep | `?owner` | off (?x=1 on) | src/canalRecall/facade/wallMaterialDemo.ts:85 | doc:1 html:1 | 2026-09-26 (62 d) | review/tool page input |
| keep | `?isolated` | off (?x=1 on) | src/canalRecall/facade/wallMaterialDemo.ts:85 | - | 2026-09-26 (62 d) | review/tool page input |
| keep | `?r` | value | src/canalRecall/facadeCompareViewer.ts:140 | spec:2 doc:1 | 2026-10-02 (56 d) | review/tool page input |
| keep | `?az` | value | src/canalRecall/facadeCompareViewer.ts:140 | script:2 doc:1 | 2026-10-02 (56 d) | review/tool page input |
| keep | `?el` | value | src/canalRecall/facadeCompareViewer.ts:140 | script:4 doc:1 | 2026-10-02 (56 d) | review/tool page input |
| keep | `?storefront` | value | src/canalRecall/facadeCompareViewer.ts:40 | script:2 doc:1 | 2026-10-02 (56 d) | review/tool page input |
| keep | `?name` | value | src/canalRecall/facadeCompareViewer.ts:42 | doc:1 | 2026-10-02 (56 d) | review/tool page input |
| keep | `?collection` | value | src/canalRecall/featureFlags.ts:39 | spec:3 doc:4 | 2026-11-09 (18 d) | setting, entry link or diagnostic |
| keep | `?freeRideQuiz` | value | src/canalRecall/featureFlags.ts:43 | doc:3 | 2026-11-09 (18 d) | setting, entry link or diagnostic |
| keep | `?dailyDate` | value | src/canalRecall/game/dailyRide.ts:40 | spec:2 doc:1 | 2026-11-08 (19 d) | setting, entry link or diagnostic |
| keep | `__canalRecallLabelLedger` | - | src/canalRecall/game/labelDrawLedger.ts:11 | spec:1 doc:1 | 2026-11-08 (19 d) | spec hook: set by specs, read in code |
| keep | `__canalRecallForceIntro` | - | src/canalRecall/game/presentationRuntime.ts:134 | spec:12 script:2 doc:1 | 2026-09-27 (61 d) | spec hook: set by specs, read in code |
| keep | `?startHoldCap` | value | src/canalRecall/game/presentationRuntime.ts:223 | doc:1 | 2026-11-09 (18 d) | setting, entry link or diagnostic |
| keep | `?id` | value | src/canalRecall/housePlayground.ts:153 | spec:1 script:8 doc:1 | 2026-10-03 (55 d) | review/tool page input |
| keep | `?at` | value | src/canalRecall/housePlayground.ts:260 | - | 2026-10-03 (55 d) | review/tool page input |
| keep | `?mode` | value | src/canalRecall/housePlayground.ts:56 | spec:5 script:20 doc:1 | 2026-10-03 (55 d) | review/tool page input |
| keep | `?landing` | on (?x=0 off) | src/canalRecall/landing/landingModel.ts:37 | spec:1 doc:1 html:1 | 2026-11-08 (19 d) | review/tool page input |
| keep | `?kit` | value | src/canalRecall/landmarkGallery.ts:166 | script:2 doc:1 html:11 | 2026-10-03 (55 d) | review/tool page input |
| keep | `?d` | value | src/canalRecall/landmarkKitsViewer.ts:11 | - | 2026-10-02 (56 d) | review/tool page input |
| keep | `?y` | value | src/canalRecall/landmarkKitsViewer.ts:76 | script:2 doc:1 | 2026-10-02 (56 d) | review/tool page input |
| keep | `__canalRecallAtlasAerial` | - | src/canalRecall/look/atlasAerial.ts:29 | - | 2026-11-08 (19 d) | runtime state shared between modules |
| keep | `__canalRecallCityLookShared` | - | src/canalRecall/look/cityLook.ts:1009 | script:2 | 2026-10-13 (45 d) | spec hook: set by specs, read in code |
| keep | `__canalRecallCityLook` | - | src/canalRecall/look/cityLook.ts:69 | doc:1 | 2026-10-30 (28 d) | runtime state shared between modules |
| keep | `__canalRecallGlassReflect` | - | src/canalRecall/look/glassReflect.ts:29 | - | 2026-11-16 (11 d) | oracle/hook: set in code, read by specs or scripts |
| keep | `__canalRecallHighlightBoost` | - | src/canalRecall/look/highlight.ts:28 | spec:1 | 2026-10-13 (45 d) | spec hook: set by specs, read in code |
| keep | `__canalRecallHighlightOutlinePx` | - | src/canalRecall/look/highlight.ts:494 | script:1 doc:1 | 2026-10-13 (45 d) | spec hook: set by specs, read in code |
| keep | `?v` | value | src/canalRecall/look/lookAtlas.ts:104 | script:5 doc:5 html:3 | 2026-11-01 (26 d) | setting, entry link or diagnostic |
| keep | `?lookAtlas / __canalRecallLookAtlas` | value | src/canalRecall/look/lookAtlas.ts:51 | doc:1 | 2026-11-01 (26 d) | setting, entry link or diagnostic |
| keep | `__canalRecallMarkingFadeUniforms` | - | src/canalRecall/look/markingFade.ts:52 | - | 2026-11-01 (26 d) | runtime state shared between modules |
| keep | `?texAniso / __canalRecallTexAniso` | value | src/canalRecall/look/texturePolicy.ts:99 | doc:2 | 2026-11-07 (20 d) | setting, entry link or diagnostic |
| keep | `?thinDebug / __canalRecallThinDebug` | value | src/canalRecall/look/thinFade.ts:109 | spec:1 doc:1 | 2026-11-06 (21 d) | setting, entry link or diagnostic |
| keep | `?cellDebug / __canalRecallCellDebug` | value | src/canalRecall/look/windowSdf.ts:112 | spec:1 doc:8 | 2026-11-06 (21 d) | setting, entry link or diagnostic |
| keep | `?heartbeat` | value | src/canalRecall/monitoring.ts:172 | doc:3 | 2026-11-05 (22 d) | setting, entry link or diagnostic |
| keep | `?heartbeatShared` | value | src/canalRecall/monitoring.ts:177 | doc:1 | 2026-11-05 (22 d) | setting, entry link or diagnostic |
| keep | `?stallReport` | value | src/canalRecall/monitoring.ts:215 | doc:1 | 2026-11-05 (22 d) | setting, entry link or diagnostic |
| keep | `?sentryWrap` | off (?x=1 on) | src/canalRecall/monitoring.ts:46 | doc:1 | 2026-11-14 (13 d) | setting, entry link or diagnostic |
| keep | `?storybook` | value | src/canalRecall/onboarding/dom.ts:268 | story:2 | 2026-10-17 (41 d) | setting, entry link or diagnostic |
| keep | `__canalRecallOnboarding` | - | src/canalRecall/onboarding/dom.ts:271 | spec:2 doc:2 | 2026-10-17 (41 d) | oracle/hook: set in code, read by specs or scripts |
| keep | `__canalRecallCompactGround` | - | src/canalRecall/ownGround/gameGround.ts:312 | spec:1 doc:1 | 2026-10-24 (34 d) | oracle/hook: set in code, read by specs or scripts |
| keep | `__canalRecallGroundFixes` | - | src/canalRecall/ownGround/groundFixes.ts:4 | - | 2026-11-12 (15 d) | runtime state shared between modules |
| keep | `?hide` | value | src/canalRecall/ownGround/main.ts:209 | - | 2026-10-09 (49 d) | review/tool page input |
| keep | `?rider` | value | src/canalRecall/ownGround/main.ts:497 | spec:2 | 2026-10-09 (49 d) | review/tool page input |
| keep | `?mapcam` | value | src/canalRecall/ownGround/main.ts:499 | spec:3 | 2026-10-09 (49 d) | review/tool page input |
| keep | `?eye` | value | src/canalRecall/ownGround/main.ts:500 | spec:1 script:1 | 2026-10-09 (49 d) | review/tool page input |
| keep | `?fx` | value | src/canalRecall/ownGround/main.ts:52 | spec:2 | 2026-10-09 (49 d) | review/tool page input |
| keep | `?box` | value | src/canalRecall/ownGround/main.ts:53 | doc:1 | 2026-10-09 (49 d) | review/tool page input |
| keep | `?auto` | value | src/canalRecall/ownGround/main.ts:57 | spec:2 script:1 | 2026-10-09 (49 d) | review/tool page input |
| keep | `?hud` | value | src/canalRecall/ownGround/main.ts:57 | spec:4 | 2026-10-09 (49 d) | review/tool page input |
| keep | `?route` | value | src/canalRecall/ownGround/main.ts:57 | spec:1 html:1 | 2026-10-09 (49 d) | review/tool page input |
| keep | `?buildings` | value | src/canalRecall/ownGround/main.ts:57 | spec:1 | 2026-10-09 (49 d) | review/tool page input |
| keep | `?highlight / __canalRecallHighlight` | value | src/canalRecall/ownGround/main.ts:58 | spec:6 story:1 script:1 doc:4 | 2026-10-09 (49 d) | review/tool page input |
| keep | `?relief` | value | src/canalRecall/ownGround/main.ts:58 | - | 2026-10-09 (49 d) | review/tool page input |
| keep | `?ao` | value | src/canalRecall/ownGround/main.ts:59 | spec:1 | 2026-10-09 (49 d) | review/tool page input |
| keep | `?prefer` | value | src/canalRecall/ownGround/main.ts:591 | spec:1 | 2026-10-09 (49 d) | review/tool page input |
| keep | `?view` | value | src/canalRecall/ownMap/main.ts:40 | script:11 doc:1 | 2026-10-10 (48 d) | review/tool page input |
| keep | `?route` | value | src/canalRecall/ownMap/main.ts:41 | spec:1 html:1 | 2026-10-10 (48 d) | review/tool page input |
| keep | `?path` | value | src/canalRecall/ownMap/main.ts:42 | - | 2026-10-31 (27 d) | review/tool page input |
| keep | `?near` | value | src/canalRecall/ownMap/main.ts:42 | script:26 doc:3 | 2026-10-31 (27 d) | review/tool page input |
| keep | `?mini` | value | src/canalRecall/ownMap/main.ts:42 | - | 2026-10-31 (27 d) | review/tool page input |
| keep | `?worker` | value | src/canalRecall/ownMap/main.ts:42 | - | 2026-10-31 (27 d) | review/tool page input |
| keep | `?labels` | value | src/canalRecall/ownMap/main.ts:44 | spec:6 doc:2 | 2026-10-10 (48 d) | review/tool page input |
| keep | `?quiet` | value | src/canalRecall/ownMap/main.ts:44 | - | 2026-10-10 (48 d) | review/tool page input |
| keep | `?ask` | value | src/canalRecall/ownMap/main.ts:45 | spec:1 doc:1 | 2026-10-10 (48 d) | review/tool page input |
| keep | `?learned` | value | src/canalRecall/ownMap/main.ts:50 | - | 2026-10-10 (48 d) | review/tool page input |
| keep | `?postwarKit / __canalRecallPostwarKit` | value | src/canalRecall/postwarKit/flag.ts:12 | doc:2 | 2026-11-20 (7 d) | tuning knob under measurement |
| keep | `?postwarSiblings / __canalRecallPostwarSiblings` | value | src/canalRecall/postwarKit/flag.ts:29 | doc:2 | 2026-11-21 (6 d) | tuning knob under measurement |
| keep | `__canalRecallTiles` | - | src/canalRecall/rendererShared/tiledGeometry.ts:88 | - | 2026-10-29 (29 d) | runtime state shared between modules |
| keep | `?door` | value | src/canalRecall/renderingSpike.ts:227 | doc:1 | 2026-10-02 (56 d) | review/tool page input |
| keep | `?ui` | on (?x=0 off) | src/canalRecall/renderingSpike.ts:235 | - | 2026-10-02 (56 d) | review/tool page input |
| keep | `?retailFit / __canalRecallRetailFit` | value | src/canalRecall/retailFit/flag.ts:7 | doc:2 | 2026-11-20 (7 d) | tuning knob under measurement |
| keep | `?shareCard` | on (?x=0 off) | src/canalRecall/routeHistoryBrowser.ts:131 | spec:2 doc:1 | 2026-11-08 (19 d) | setting, entry link or diagnostic |
| keep | `?shopRun / __canalRecallShopRun` | value | src/canalRecall/shopRun.ts:37 | script:1 doc:1 | 2026-11-21 (6 d) | tuning knob under measurement |
| keep | `?shopVariety / __canalRecallShopVariety` | value | src/canalRecall/shopVariety.ts:25 | doc:1 | 2026-11-20 (7 d) | tuning knob under measurement |
| keep | `?terraceRows / __canalRecallTerraceRows` | off (?x=1 on) | src/canalRecall/terraceRows.ts:27 | doc:2 | 2026-11-20 (7 d) | off-switch younger than 7 days (lane rule) |
| keep | `__canalRecallAtlasAerialSwitch` | - | src/canalRecall/threeBuildingsBrowser.ts:833 | spec:1 script:1 | 2026-11-08 (19 d) | oracle/hook: set in code, read by specs or scripts |
| keep | `?worldCells` | value | src/canalRecall/world/worldCells.ts:316 | - | 2026-10-31 (27 d) | setting, entry link or diagnostic |
| keep | `?world` | value | src/canalRecall/world/worldCells.ts:54 | spec:11 script:17 doc:18 | 2026-11-13 (14 d) | setting, entry link or diagnostic |
