# Flip inventory: what still ties Canal Recall to MapLibre (2026-10-31, #129)

Lane L1 (engine host). This is an inventory for P5 ("Flip and delete",
`docs/handoffs/engine-programme-20261030.md`). It lists everything that still
runs MapLibre code under `?engine=own`, or that blocks making `own` the default.
For each item it gives the file:line, what it does, the replacement, and the
order to delete in. Line numbers are at `lane/engine-host-20261030`
(2c60e3ab6).

Method:

- **Static:** grep across `public/canal-drive/` and `src/canalRecall/`.
- **Runtime trace** (section 1): a 1440×900 desktop page under `?engine=own`
  with the start flight forced, a 10 s chase ride, and a building tap.
  - Every member read on `window.maplibregl` and every call into the CameraMap
    shim is logged with the calling bundle.
  - The probe is
    `/private/tmp/claude-501/-Users-blackmad-Code-map-recall2-worktrees-integrator-lanes/b860014d-cb27-484d-b62b-ee67d791303f/scratchpad/l1/probe-flip.mjs`.

## 1. What runs under `?engine=own` today (runtime trace)

The run on 2026-10-31 used a desktop page at 1440×900 under `?engine=own` with
the start flight forced. The game stayed in the briefing (state 2) for 45 s, so
the probe set racing itself; then a 10 s chase ride and one building tap.

**MapLibre library: 0 member reads.** `window.maplibregl` was wrapped in a
Proxy before its script ran, and nothing read it. No `maplibregl.Map` was
constructed (`engine-own.spec`: `maplibreMaps 0`).

**MapLibre download: still happens.** There are 2 requests to
`unpkg.com/maplibre-gl@5.24.0/dist` (the JS and the CSS). Removing them is B1
below. The other third-party requests are Google Fonts and Wikimedia card
images; neither has anything to do with MapLibre.

**Calls into the MapLibre-shaped CameraMap shim** (`engine/cameraMap.ts`),
counted by the calling bundle. Every one is answered by the engine camera;
none reaches MapLibre. They are listed because each caller is P5 shim debt.

| Calls | Member | Caller | Note |
|---|---|---|---|
| 747 | `project` | engine (`ownWorldView.projectWorld`, reached from `camera.js:199` `camera.projector`) | The engine's own path. Move it to `EngineCamera.project` when the shim shrinks. |
| 570 / 412 / 330 / 228 / 66 / 25 | `getZoom` | engine / inventory-trees / artis-animals / three-buildings / signature-landmarks / building-tiles | Should be `camera.zoom()`. |
| 356 / 35 / 24 / 17 / 9 / 6 / 1 | `triggerRepaint` | player-vehicles / inventory-trees / own-ground / signature-landmarks / detailed / three-buildings / three | Should be the frame host's `triggerRepaint` (the same call; only the name of the object changes). |
| 244 / 111 / 36 / 30 | `getBounds` (`contains`, `getWest()`…) | artis-animals / signature-landmarks / inventory-trees / building-tiles | Should be `camera.bounds()`, which returns plain numbers. |
| 285 / 27 | `checkIdle`, `pendingWork` | engine (the settle checks) | Engine-internal; stays. |
| 236 / 25 / 16 / 3 | `getCenter` | engine / building-tiles / inventory-trees / signature-landmarks | Should be `camera.center()`. |
| 142 | `getContainer` | player-vehicles | Should be `frameCanvas()`'s parent. |
| 74 / 2 | `jumpTo` | game-presentation / game-route | The WorldView `camera.jumpTo` (already on the API). |
| 2 | `whenIdle` | game-route (`_waitForMapSettle`, with the settle patch) | Already the WorldView API. |
| 1 | `unproject` | game-landmarks (the building tap) | Already `camera.unproject`. |

`on('moveend')` registrations happen at construction, before the probe hooked
in, so they are not counted above. Statically they are: `artis-animals.js:26`,
`inventory-trees-source.js:57`, `signature-landmarks-source.js:280` and
`buildingTilesBrowser.ts:310`.

## 2. What still blocks the flip

The game-side WorldView API is complete. Every `vectorMap.*` member that
game.js, game-route.js and `src/canalRecall/game/*` read exists on
`OwnWorldView`. The only member it lacks is `setBuildingsLook`, and only
vector-map.js calls that, on itself. So nothing on the game side needs
MapLibre. What remains is loading, shims, MapLibre-only features, the default
switch, and the specs.

| # | Where | What it does | Replacement | Blocks the flip? |
|---|---|---|---|---|
| B1 | `public/canal-drive/index.html:36-37` | Loads `maplibre-gl@5.24.0` JS and CSS from unpkg on every page load, `?engine=own` included: a third-party fetch on the critical path, then the parse. | Under `own`, do not load it. Either a tag written only when `engineFlag() !== 'own'`, or a dynamic loader in `VectorBasemap._installMap`. Delete the tag at the flip. | **Yes**, for the P1 gate "MapLibre workers 0 MB / never constructed". Today nothing constructs a map, but the library is still downloaded. |
| B2 | `public/canal-drive/js/game.js:107-110` | Picks `OwnWorldView` only under `?engine=own`; MapLibre stays the default. | Default to `own`; keep `?engine=maplibre` as a dev fallback until P5 deletes it. | **Yes**: the flip itself (integrator). |
| B3 | `public/canal-drive/js/game-route.js:1897-1902`, `:1936`, `:1955` `_waitForMapSettle` | Waits for MapLibre's first idle at the spawn and the overview. | Under `own`, already answered by `camera.whenIdle()` and the settle checks (`engine/settle.ts`, 71703e7b5, with the settle patch applied). At P5, delete the MapLibre branch and the 450 ms breathing pause. | No: own already works through it. |
| B4 | `public/canal-drive/js/game-route.js:1628` | Comment and loading message "MapLibre supplies a continuously rendered vector basemap". | Text only: fix it when the branch goes. | No. |
| B5 | `src/canalRecall/engine/ownWorldView.ts:59-66` `MercatorCoordinate` (`MERCATOR`) | MapLibre's `MercatorCoordinate` re-implemented. It is passed as the `maplibregl` argument to every legacy participant (`ownWorldView.ts:234-237,277`; `cityExtras.ts:62,71,91,96`). | Keep it until each participant takes `FrameDriverApi.mercatorFromLocal` or `toLocal` from the frame. It already has no MapLibre code in it. | No, but it is the seam to delete at P5. |
| B6 | `src/canalRecall/engine/cameraMap.ts:222-304` (the MapLibre-shaped `CameraMap`) | A `jumpTo`/`getZoom`/`getBounds`/`on('moveend')`/`transform` shim, so the MapLibre-era participants run unchanged. `getStyle`, `getLayer`, `getSource` and `queryRenderedFeatures` return empty. | Move each participant onto `WorldCamera` (`camera.bounds()`, `onFrame`, `whenIdle`), then shrink the shim. The participants that still read it are below. | No, but every caller is a P5 deletion. |
| B7 | `public/canal-drive/js/vector-map.js` (3,433 lines, `new maplibregl.Map` at `:257`) | The MapLibre world view: style layers, feature-state highlight, `queryRenderedFeatures` picking, the `poi-labels` symbol layer, the extrusion fallback, the `_cameraFacade` (`:236`). | `OwnWorldView`. Delete the whole file at P5. It is frozen apart from fixes (2026-10-31: the deck-lift `_drawn` fix). | Removed by the flip, not a blocker. |
| B8 | `src/canalRecall/labels/labelOverlay.ts:62,301` | Reads `window.maplibregl.MercatorCoordinate` and `map.transform.getProjectionDataForCustomLayer`. Mounted only by vector-map.js (`:348`). | `engine/overlays/labelLayer.ts` (own). Delete at P5. | No (it does not run under own). |
| B9 | `src/canalRecall/buildingTilesBrowser.ts:46,310,505-529` `BuildingTileStreamer` | Constructed on the shim under own (`ownWorldView.ts:281`). It reads `getCenter`, `getZoom`, `getBounds` and `on('moveend')`. Its MapLibre GeoJSON source path (`:381,396`) is dead under own, because the shim's `getSource` returns undefined. | P3's one streamer (`engine/worldStreamer.ts`). Delete the source path at P5 and the streamer when P3 lands. | No. |
| B10 | `public/canal-drive/js/park-landscape.js` | MapLibre fill layers for parks. Mounted only by vector-map.js (`:341`); own-ground draws parks under own. | Own-ground parks (`own-ground-parks.spec.ts`). Delete at P5. | No. |
| B11 | `src/canalRecall/mapGuard.ts` | WebGL failure guard. **Shared**: own uses it through `engine/frameGuards.ts:7` (`guardMapRender` on the frame host). | **Do not delete it whole at P5**, unlike the programme doc's P5 list says. Delete only the `new maplibregl.Map` wrapper and probe (`:303-`); keep `guardMapRender` and `isDeadGpuShaderError`. | No. |
| B12 | `src/canalRecall/rendererShared/sharedFrame.ts:241-242,353` | The MapLibre custom-layer driver. Own drives the frame from the host (`:97-99`). | Delete the custom-layer driver at P5. | No. |
| B13 | `package.json:600,628` (`leaflet`, `maplibre-gl`) | Dependencies. | **Do not drop them yet**. These pages still use them: `src/components/MapComponent.tsx` (the Map Recall app), and the lab pages `explore.html`, `park-landscape.html`, `signature-landmark-demo.html`, `building-compare.html`, `facade-recipe-lab.html`, `rgb-city-demo.html`, `material-demo.html` and `facade-world-demo.html` (all `public/canal-drive/`). `src/canalRecall/explorer/liveTiles.ts:46` constructs a map. | Only for removing the dependency, not for the flip. |
| B14 | `src/canalRecall/mapHealthBrowser.ts`, `mapStyle.ts`, the MapLibre half of `streetOverlayStyle.ts`, `basemap-hide-ids.json` | Basemap health, style and duplicate hiding. Reached only from vector-map.js. | Delete at P5 with vector-map.js. | No. |

### Participants that still read the CameraMap shim (B6)

Each item below reads a MapLibre-shaped member. Under own it works because the
shim answers.

- **`artis-animals.js`**
  - Reads: `getBounds().contains` (`:39,44,57,70`), `on('moveend')` (`:26`), `MercatorCoordinate` (`:13,68`).
  - Replacement: `camera.bounds()` with a plain contains, plus `onFrame`.
- **`inventory-trees-source.js`**
  - Reads: `getBounds` (`:14`), `on('moveend')` (`:57`), `MercatorCoordinate` (`:49,147,173`).
  - Replacement: P3 tree streaming moves into the world streamer; the file's streaming is deleted then.
- **`signature-landmarks-source.js`**
  - Reads: `on('moveend')` (`:280`), `getBounds` (`:587,624`), `MercatorCoordinate` (`:829,883`).
  - Replacement: `landmarkResidency` through the world streamer (P3).
- **`detailed-buildings-source.js`**
  - Reads: `MercatorCoordinate` (`:75,151`).
  - Replacement: the frame's `toLocal`.
- **`pyramidal-roofs-source.js`**
  - Reads: `MercatorCoordinate` (`:55`).
  - Replacement: `toLocal`.
- **`player-vehicles-source.js`**
  - Reads: `MercatorCoordinate` (`:171`).
  - Replacement: `toLocal`.
- **`threeBuildingsBrowser.ts`**
  - Reads: `getZoom` (`:764,1462,1565,1611`), `MercatorCoordinate` (`:1525`).
  - Replacement: `camera.zoom()` and `toLocal`.
- **`sharedFrame.ts`**
  - Reads: `getBounds` (`:474`).
  - Replacement: `camera.bounds()`.
- **`buildingTilesBrowser.ts`**
  - The B9 streamer above.

## 3. Deletion order for P5

Each step leaves the game working and all specs green.

1. **Stop loading MapLibre under own (B1).** Either an index.html tag guarded by
   `engineFlag()`, or a lazy loader in `VectorBasemap`. Check: under own, a
   network trace shows no unpkg request, and `engine-own.spec` still reports
   `maplibreMaps 0`.
2. **Specs off `vectorMap.map`** (section 4, lane L2). This must come before the
   default switch: these specs read MapLibre internals and would fail or skip
   under own.
3. **Default `own` (B2),** keeping `?engine=maplibre` for a staged rollout. This
   needs the gates in the programme doc's P5 row (the Android PSS gate and
   Sentry per ride) and the `needs-david` flip issue.
4. **Delete the MapLibre-only paths in game-route.js** (B3 and B4; the
   `_waitForMapSettle` MapLibre branch).
5. **Move the participants off the shim (B6)**, one commit each, every one
   byte-identical in look (`three-buildings-ab.spec`, `look-consistency`).
   Then shrink `CameraMap` to the `WorldCamera` surface and delete `MERCATOR`
   (B5).
6. **Delete vector-map.js (B7)** with what only it reaches: `labelOverlay.ts`
   (B8), `park-landscape.js` (B10), the basemap files (B14), the
   `sharedFrame` custom-layer driver (B12), the MapLibre wrapper in
   `mapGuard.ts` (B11, keeping the shared guard), and the index.html tags. Also
   delete `rendererShared/drawnProjection.ts` and its three.bundle export,
   which exist only for vector-map.js.
7. **`package.json` (B13),** only after the lab pages and the Map Recall app
   have moved off maplibre and leaflet, or been retired. That is a separate
   decision for the user (the lab pages are allowed to stay public).

## 4. Specs and scripts that still read `vectorMap.map`

Count of `vectorMap.map`, `vm.map` and `basemap.map` reads per file (not
`.map(` array calls), with the count in brackets. Under `?engine=own`,
`vectorMap.map` is undefined. These all need to move to `vectorMap.camera` or
the WorldView API (lane L2) before step 3.

- `engine-parity.spec.ts` and `engine-own.spec.ts` read it on purpose: the
  MapLibre oracle page. They keep it until P5 deletes the oracle.
- `no-maplibre.spec.ts` reads it on the MapLibre comparison page. It becomes
  the main spec at P5.

**tests/e2e (75 files, 218 reads):**

`building-click-perf.spec.ts` (9), `canal-recall.spec.ts` (8), `sun-heading.spec.ts` (7), `street-chunks.spec.ts` (6), `recipe-tiles.spec.ts` (6), `own-ground-roads.spec.ts` (6), `own-ground-defects.spec.ts` (6), `overview-transition.spec.ts` (6), `facade-tone.spec.ts` (6), `shadow-fill.spec.ts` (5), `poi-lift.spec.ts` (5), `mood-shots.spec.ts` (5), `look-consistency.spec.ts` (5), `white-flash-probe.spec.ts` (4), `street-survey-retire.spec.ts` (4), `street-art-landmark-cards.spec.ts` (4), `sculptures.spec.ts` (4), `recipe-street.spec.ts` (4), `period-walls-strip.spec.ts` (4), `intro-trace.spec.ts` (4), `highlight.spec.ts` (4), `generic-gap-strip.spec.ts` (4), `facade-trees-look.spec.ts` (4), `complete-city.spec.ts` (4), `building-article-card.spec.ts` (4), `bike-xray.spec.ts` (4), `bag-tiles.spec.ts` (4), `three-buildings-ab.spec.ts` (3), `roof-facts-shots.spec.ts` (3), `own-ground-bridge-fidelity.spec.ts` (3), `landmark-lod-perf.spec.ts` (3), `labels.spec.ts` (3), `filler-buildings.spec.ts` (3), `covered-passage.spec.ts` (3), `context-restore.spec.ts` (3), `building-types-runtime.spec.ts` (3), `block-face.spec.ts` (3), `weak-gpu-perf.spec.ts` (2), `recipe-street-perf.spec.ts` (2), `recipe-shops.spec.ts` (2), `own-ground-parks.spec.ts` (2), `osm-under-models.spec.ts` (2), `no-maplibre.spec.ts` (2), `landmark-shading.spec.ts` (2), `intro-flight.spec.ts` (2), `governor-no-flash.spec.ts` (2), `feedback.spec.ts` (2), `engine-parity.spec.ts` (2), `centre-feedback.spec.ts` (2), `briefing-pause.spec.ts` (2), `answered-street-name.spec.ts` (2), `westerpark-south-frames.spec.ts` (1), `vondelpark-south-frames.spec.ts` (1), `touch-shader-warmup.spec.ts` (1), `rosarium-roses.spec.ts` (1), `ride-perf.spec.ts` (1), `review-sheet-ingame.spec.ts` (1), `renderer-spike.spec.ts` (1), `phone-memory.spec.ts` (1), `own-ground-route-line.spec.ts` (1), `own-ground-prinsengracht-probe.spec.ts` (1), `own-ground-marnix-bridge.spec.ts` (1), `own-ground-game.spec.ts` (1), `own-ground-citywide.spec.ts` (1), `own-ground-bridges.spec.ts` (1), `labels-free-ride-20261030.spec.ts` (1), `intro-perf.spec.ts` (1), `highlight-shots.spec.ts` (1), `haparandaweg-street.spec.ts` (1), `ferry-crossings.spec.ts` (1), `facade-trees-perf.spec.ts` (1), `engine-own.spec.ts` (1), `city-startup-lod.spec.ts` (1), `building-look.spec.ts` (1), `boat-start-zoom.spec.ts` (1).

**scripts (49 files):** review, perf and landmark scripts (for example
`scripts/gpu-load-ipad.mjs` (5), `scripts/check-artis-animals.mjs` (5),
`scripts/look/brick-tone-frames.ts` (4), `scripts/ride-perf-owners.mjs` (3),
`scripts/pop-in.mjs` (3), `scripts/perf-frozen-frames.mjs` (3)). To regenerate
the full list:

```
grep -rcP "(vectorMap\??\.map|\bvm\??\.map|basemap\??\.map)\b(?!\s*\()" tests scripts | grep -v ":0$" | sort -t: -k2 -rn
```
