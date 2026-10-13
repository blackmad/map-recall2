# Dropping MapLibre: inventory and a proof of the map views (2026-10-10)

Question: can Canal Recall drop MapLibre entirely? The riding-view ground is
being moved into our own three.js frame by the `render/own-ground-game-20261010`
lane (`src/canalRecall/ownGround/`, `vector-map.js`). This lane proves the
*rest*: city overview, route preview, minimap, labels with the spoiler rules,
camera + gestures and the project/unproject helpers, from our own extracts with
no third-party tiles at runtime.

Branch `render/no-maplibre-views-20261010`. Page
`public/canal-drive/no-maplibre.html`, typed modules in
`src/canalRecall/ownMap/`, generator `scripts/own-map/build-own-map.ts`,
extract `public/data/extracts/amsterdam/own-map-v1/overview.json.gz`.

**Verdict: go.** Everything MapLibre does for the map screens was reproduced
with ~1,400 lines of typed code; at the game's own cameras the own map lands
within 1.1–3.2 px of where MapLibre puts the same ground point, costs
1.9 ms (desktop) / 5.8 ms (iPhone 4× CPU) per frame on a city→street path, and
needs 1.6 MB (gzip) for the whole city. Estimate to remove MapLibre from the
game: **~3–4 weeks** on top of the own-ground lane's riding-view ground (§6).

## 1. Inventory: every MapLibre use in the game runtime

Paths are `public/canal-drive/js/…` unless stated. "Own" = what replaces it
(the module that does it on the proof page, or the plan).

### Map, style, sources

| Use | Where | Replacement |
|---|---|---|
| `new maplibregl.Map`, style **`https://tiles.openfreemap.org/styles/liberty`** (live third-party tiles), `interactive: false`, pixelRatio rule | `vector-map.js:134-145`; CSS/JS from unpkg in `index.html:11-12` | `THREE.WebGLRenderer` + `ownMap/main.ts`; cartography in `ownMap/style.ts`; city data in `own-map-v1/overview.json.gz` (water, parks, streets by class, water centrelines, neighbourhood names) built from our extracts |
| Basemap fills/lines (land, water, parks, roads by class, rail, landuse) | Liberty style | `layers.ts` `polygonGeometry` (water, parks) and `lineGeometry` + `lineMaterial` (px-width lines, MapLibre zoom stops) — **gaps: rail/tram, footways (routing extract has 16), landuse other than parks, piers** |
| Basemap building layers hidden/duplicated against ours: `basemap-hide-ids`, `querySourceFeatures('openmaptiles', building)`, `setFilter` | `vector-map.js:641-795, 736, 768, 1207-1229` | Deleted: no basemap buildings to hide |
| Building overview raster source/layer (z12 PNG pyramid, ours) | `vector-map.js:574-596` | `layers.ts tileQuadGeometry/rasterMaterial` (same PNGs, Mercator-correct rows), fades out 13.4→14.1 |
| Coloured building fill-extrusions (`osm-colored-building*`, `building-3d`), `setLight`, feature-state highlight | `vector-map.js:494-570, 1120-1160, 2228-2295 (setFeatureState 2234/2269), 2867-2930` | Footprints from z14 building tiles (`footprintGeometry`) on the page; in the game the three.js chunks already draw the buildings (`threeBuildingsBrowser`), highlight = a material uniform |
| Park landscape fill/line/extrusion layers | `park-landscape.js:25-45, 84-151` | polygon/line meshes from `park-landscape.geojson` (not built here; same as parks) |
| Trees fill-extrusion/circle layers | `vector-map.js:465-492, 1668-1736` | Already have the three.js `InventoryTrees`; the fallback layer goes |
| Transit network corridors + Liberty rail emphasis (`getStyle`, `setPaintProperty`) | `vector-map.js:328-428` | line meshes (`lineGeometry`) per mode; rail needs a rail extract (gap) |
| Route line (`navigation-route*`, line casing) | `vector-map.js:280-297, 2089-2106` | `lineGeometry` + casing, z = 0.3 m (under buildings, as today under `building-3d`); in the riding view the own-ground `routeRibbon` drapes it |
| Cycle tracks layer | `vector-map.js:288-292, 299-305` | `lineGeometry` (colour from `orientationPois.CYCLE_TRACK_*`) |
| Active street highlight, answered-street road lettering | `vector-map.js:312-326, 2123-2187`; `streetOverlayStyle.ts:11, 536` | line mesh; road lettering as a CanvasTexture decal (or the label engine with `pitch-alignment: map` maths) — not built |
| Active landmark line/point | `vector-map.js:2221-2296` | line mesh + overlay marker |
| Neighbourhood boundaries (dashed) | `vector-map.js:1434` | line mesh with dash in the shader |
| Theme palettes (`applyTheme`, `_captureBasePaint/_restoreBasePaint`) | `vector-map.js:2198-2219, 2867-2930` | a palette object per theme fed to `style.ts` |

### Labels / symbols and the spoiler & quiet rules

| Use | Where | Replacement |
|---|---|---|
| All basemap symbol layers hidden (roads/water would spoil recall) | `_hideLabels` `vector-map.js:2325-2336`, `toggleLabels` 2350 (`D` key, `game.js:377`) | never created; a "show all labels" debug is `labels=all` |
| Basemap POI layers kept, spoiler-filtered by `basemapSpoilerFilter` | `vector-map.js:1609-1622`; `orientationPois.ts:51, 178` | own POI layer only (`ownPoiFeatures`, `ownPois.ts:27`), screened by `poiLabelVisible` |
| Own POI labels per roofline band, `roofLiftTranslate` | `vector-map.js:1562-1607, 1484-1519` | label engine, anchor at `z = HEIGHT_BAND_METRES[band]` in `project()` (no screen translate hack) — not wired on the page |
| `poi-labels`, brand icons (`addImage`), brand/local-food labels, neighbourhood labels, ferry terminal labels | `vector-map.js:1427-1442, 1521-1535, 1624-1666, 1982-2004` | `labels.ts` point labels; icons = `drawImage` of the same SVGs in the overlay pass |
| Layer ordering hacks (`moveLayer`, `getLayersOrder`, `styledata`) | `vector-map.js:1450-1482, 2136` | none: labels are a 2D pass over the frame |
| Quiz quiet map | `setQuizQuietMap` `vector-map.js:2361-2384` | `LabelContext.quizQuiet` |
| Street/water names (earned only) | **not MapLibre**: `road-network.js:608-660` canvas, rule `presentationRuntime.ts:629-631` | same rule in `labelPolicy.ts streetLabelVisible`, now curved along the street |

### Camera, projection, hit-testing, lifecycle

| Use | Where | Replacement |
|---|---|---|
| `jumpTo` every frame from the game camera (zoom from px/m, pitch per view mode, clearance guard) | `vector-map.js:2403-2536` (jump 2507) | `mapCamera.ts` `CameraState` + `cameraFrame` (MapLibre's zoom/fov/pitch model, tested equal to `rendererSpike/ride.ts mapLibreEye`) |
| Intro/start flight: flat overview → land, `introOverview` | `vector-map.js:2419-2533`; `presentationRuntime.ts:98-215`; `introFlight.ts` | `easeCamera` (zoom-space ease, scale-proportional centre) on `pathCamera`; `cameraForPoints` = the flight's framing |
| `aimAtWorld` / spawn `jumpTo`; briefing `jumpTo` city centre | `vector-map.js:2819-2844`; `game-route.js:130-136, 1222-1229, 1517-1523` | set `CameraState` |
| `map.project` for overlay pins/HUD (`camera.projector`, `projectWorld`) | `vector-map.js:2533-2535, 2846-2854`; `camera.js:129`; `road-network.js:625` | `project(frame, p)` (`S.project` on the page) |
| `map.unproject`, `queryRenderedFeatures` for POI tap and building inspect | `vector-map.js:2036-2087` | `unproject` + label hit boxes from `placeLabels`; buildings already raycast (`inspectAtScreen`) |
| `isWater` = `queryRenderedFeatures` on water fills (boat corridor, ferry, boat track test) | `vector-map.js:2856-2865`; `game.js:664`; `game-route.js:1461`; `boatCorridor.ts:3,72` | `geometry.ts PolygonGrid` over the overview water (regression: Singelgracht at the Da Costagracht mouth) — deterministic, works off screen |
| Rider-cover (passage under a building) via `queryRenderedFeatures` on extrusions | `vector-map.js:2554-2605` | footprint point-in-polygon (already in `coveredPassage.ts` helpers) |
| Camera clearance from building footprints (`jumpTo` probes) | `vector-map.js:2651-2753` | pure maths on `cameraFrame` |
| `getBounds` for streamer/landing planning | `vector-map.js:1864, 2547-2552` | `visibleBounds(frame)` |
| `getZoom`, `moveend`/`sourcedata`/`styledata`/`render`/`idle`, `triggerRepaint`, `areTilesLoaded` | `vector-map.js:699-712, 1349, 2781-2810`; `game-route.js:1645-1676` (`_waitForMapSettle`); `park-landscape.js:25-27`; `feedback/browser.ts:123` | our loop: explicit "data ready" promises (the page's `status.loaded`) and a render callback for the feedback capture |
| `resize` | `vector-map.js:2386-2401` | `renderer.setSize` |
| **14 custom layers** handed `(map, maplibregl)` and `MercatorCoordinate`: three buildings, detailed buildings, signature landmarks, pyramidal roofs, vehicles ×4, inventory trees, ARTIS animals, elevation, Google tiles, study roofs/facades/trees/public-realm | `vector-map.js:168-216, 661, 955, 1330, 1793, 1928`; `artis-animals.js:5-18,87`; `src/canalRecall/*Browser.ts` | `rendererShared/` already hosts 9 of them as participants; the rest (elevation, detailed 3DBAG, Google tiles, study layers) move to it; `MercatorCoordinate` → `frame.ts` local metres |
| Attribution (`© OSM · © CARTO`) | style | static credit line from extract metadata (page bottom-right) |

### Not MapLibre already

* **Minimap** (`hud.js:500-608`, `src/canalRecall/game/cityOverview.ts`) is our
  own canvas, fixed to the whole city. The page adds a local heading-up one
  (`minimap.ts`) from the overview extract.
* **Destination/custom-city picker** (`map-picker.js:217-250`) is **Leaflet with
  live `tile.openstreetmap.org` raster tiles** — another runtime third-party
  dependency; for Amsterdam it could use the own map, other cities need
  extracts (below).

## 2. What was built

| File | What |
|---|---|
| `scripts/own-map/build-own-map.ts` | extracts → `own-map-v1/overview.json.gz` (staging `artifacts/own-map/staging/` + `report.json`): elevation-v1 water polygons (1.2 m DP), parks.json, streets-routing.json by class (1.0 m DP), water.json centrelines, neighbourhood label points; 0.5 m ints, delta-coded |
| `ownMap/frame.ts` | the local frame (= `galleryPipeline.toLocal`, tested equal) |
| `ownMap/overviewFormat.ts` | format, class mapping, decode |
| `ownMap/mapCamera.ts` | MapLibre camera model; `project`, `unproject`, `visibleBounds`, `cameraForPoints` (fitBounds with padding, any bearing/pitch), `easeCamera` |
| `ownMap/gestures.ts` | pure `panBy` (grab), `zoomAround`, `rotateAround`, `pitchBy`, `pinch` (zoom+twist+two-finger pitch), `bindGestures` (pointer/wheel/right-drag) |
| `ownMap/style.ts` | palette, per-class px width stops (exponential interpolation as MapLibre), fades |
| `ownMap/layers.ts` | three.js: polygon fills, screen-width lines (vertex-shader extrusion; perspective thinning for free), z12 raster tiles, z14 footprint extrusions; shared **handover** uniforms |
| `ownMap/nearField.ts` | the near field from `ownGround/` (`prepareWays`, `buildStreets`, `drapeTriangles`, `waterSurfaceMesh`, `quayWallMesh`) + elevation-v1 shorelines, flat |
| `ownMap/labels.ts` | label engine: priority order, grid collision, same-name repeat distance, point labels, **glyph-by-glyph curved line labels** (upright, max turn per glyph), lazy measurement; canvas drawing |
| `ownMap/labelPolicy.ts` | the game's rules composed: `streetLabelVisible`, `poiLabelVisible`, `neighbourhoodLabelVisible`, `gameLabelContext` |
| `ownMap/minimap.ts` | heading-up local minimap, bucketed |
| `ownMap/main.ts`, `no-maplibre.html` | the page (`view=city|district|route|street`, `cam=` MapLibre camera, `route=`, `rider=`, `learned=`, `ask=`, `labels=all`, `quiet=1`, `path=1`) |
| `ownMap/ownMap.test.ts` | 11 tests incl. named regressions on the real extract |
| `tests/e2e/no-maplibre.spec.ts` | game-vs-own screenshots at the game's own cameras + probe misfit, label rule over the whole path, perf |
| `public/canal-drive/own-map-fixtures/route-game-{desktop,iphone}.json` | the seeded game routes, captured by the spec |

### Text approach

**Canvas 2D overlay**, not SDF. Labels are a screen-space pass after the WebGL
frame: `fillText`/`strokeText` per glyph for curved names, halo by stroke.
Reasons: no font asset or worker to ship (troika-three-text would need
bundling plus a font file, and by default fetches its font from a CDN, which
the brief rules out), crisp at any DPR with the system font the game's own
street labels already use (`road-network.js` draws Arial on a canvas),
collision is screen-space anyway, and MapLibre itself draws the game's labels
`viewport`-aligned (`text-translate-anchor: viewport`). Cost is measured below
(0.6 ms median desktop, 1.1 ms iPhone 4×). What it cannot do: labels occluded
by buildings (MapLibre does not either), and text lying *on* the road
(answered-street lettering) — that one should be a CanvasTexture decal on the
road mesh. If labels ever need depth, troika bundled with a local font is the
fallback.

### Spoiler rules (cited, reused, tested)

* Street/water names: drawn only where earned —
  `isLabelled(text,x,y) = _mapLabelNames.has(text) || _isPlaceKnown(text,x,y)`
  (`presentationRuntime.ts:629-631`, `recallRules.ts:51 isPlaceKnown`) — and the
  name under question (`quizPromptName || quizCandidateName`) never, also when
  earned, compared normalised as well as exactly (`road-network.js:630`
  compares `===`).
* POIs: `poiNameSpoils` against `buildSpoilerIndex` (`orientationPois.ts:143,164`)
  via the game's `ownPoiFeatures` chain (`ownPois.ts:27`), plus the asked name
  itself; hidden in quiz-quiet (`vector-map.js:2361`).
* Neighbourhood names: hidden in quiz-quiet.
* Regression tests: `ownMap.test.ts` "with every name earned, Nassaukade under
  question is never placed at Nassaukade" (real extract, plan view and the
  game's chase camera) and e2e "labels: the street under question is never
  drawn" (`labels=all&ask=Nassaukade`, whole 22 s camera path, collects every
  placed label).

### Handover to the near field

Flat overview layers do not write depth and sit in three's transparent list in
cartographic order; the 3D near field and buildings are opaque and draw first.
Between zoom 16.0 and 16.8 a shared uniform dissolves (screen-door dither) the
overview inside 550 m of the rider and the own-ground meshes appear: street
bands by OSM cross-section, cycle tracks, kerbs, parks, canal water at −1.77 m
with quay walls on the true shorelines. Same frame, no transform. Only inside
the two own-ground boxes (the own-ground lane will make that citywide).

## 3. Measurements

Playwright, local Chrome on the Mac GPU. `iphone` = iPhone 13 profile,
**4× CPU throttle**, DPR 1.5; desktop 1440×900 DPR 1. Fixed camera path, 20 s:
city hold → ease to route preview → ease to street with the handover (pitch
0→55°) → orbit. `NO_MAPLIBRE=1 PW_PORT=4419 npx playwright test no-maplibre`.
"frame CPU" = our camera + uniforms + `renderer.render` + labels + overlay +
minimap per frame. GPU time not measured (no timer queries).

| | frame interval median / p95 / p99 (ms) | frame CPU median / p95 / p99 / max | label CPU median / p95 | labels per frame median / max | draw calls / triangles (street end) | JS heap |
|---|---|---|---|---|---|---|
| desktop, game rules | 16.7 / 16.7 / 16.8 | **1.9** / 2.2 / 2.4 / 2.6 | 0.6 / 1.1 | 18 / 54 | 38 / 1.76 M | 158 MB |
| desktop, every name labelled | 16.7 / 16.8 / 33.3 | 3.0 / 4.1 / 4.8 / 11.2 | 1.8 / 2.8 | 32 / 68 | 38 / 1.76 M | 161 MB |
| iPhone 4×, game rules | 16.7 / 16.8 / 33.3 | **5.8** / 8.0 / 9.9 / 43.6 | 1.1 / 2.9 | 2 / 15 | 32 / 1.30 M | 111 MB |
| iPhone 4×, every name labelled | 16.7 / 33.4 / 33.4 | 7.3 / 10.5 / 11.5 / 24.3 | 2.3 / 4.9 | 3 / 19 | 32 / 1.30 M | 109 MB |

For scale (different scene, `own-renderer-spike-20261009.md`): the game's
`map._render` alone is 7.1 ms median on the iPhone 4× ride.

**Data and load** (unthrottled, local server; transfer sizes from resource timing):

| | bytes on the wire | when |
|---|---|---|
| city overview (`overview.json.gz`: 12,077 water polygons, 223 parks, 72,327 street lines, 1,597 water lines, 5,859 names) | **1.58 MB** (4.4 MB JSON) | first frame |
| coarse buildings (z12 raster, 30 tiles) | 0.93 MB | first second |
| z14 footprint tiles along the path | 1.1 MB (phone) – 3.6 MB (desktop) | zoom ≥ 13.5, by view |
| own-ground near field (Nassaukade box) | 0.16 MB | zoom ≥ 16 |
| POIs (`orientation-pois.json`) | 0.18 MB | zoom ≥ 16.3 |

Overview fetched + inflated + decoded + meshed in **~165 ms**; **first frame
~230 ms** after script start; everything for the city view ~400 ms (desktop
and the unthrottled phone profile alike; under 4× CPU expect ~4× the CPU
parts, ≈ 0.7 s — not measured). Near field 0.07–0.24 s incl. 41 ms build.
z14 footprint meshes are built on the main thread (the game has a worker).

**Camera parity.** At each of the game's own MapLibre cameras (city z 11.6,
district z 14.5, route preview z 13.6/13.0, street z 18.4/18.2 pitch 48°),
five ground points that MapLibre `unproject`s and `project`s land in the own
camera within **1.5 / 1.6 / 1.6 / 3.2 px** (desktop) and **1.1 / 1.2 / 1.2 /
1.6 px** (iPhone). The remaining px are the frame's linear lat scale vs
Mercator.

## 4. Screenshots (looked at)

`artifacts/own-map/` (not committed; regenerate with the spec):
`<desktop|iphone>-<city|district|route|street>-{maplibre,own,side-by-side}.png`.

* **City** (z 11.6): same city; water, parks, motorway ring and arterials read
  like Liberty. Ours has no ferry/transit stop labels (the game shows ferry
  terminals) and no city-level names (the game shows none either: basemap
  labels are hidden).
* **District** (z 14.5) and **route preview**: geometry lines up (pins, canals,
  Centraal); ours has vector footprints instead of the game's 3D chunks and
  curved names for earned streets/canals; the question street (`Kinkerstraat`
  in the demo) is absent although "earned". Ours draws the route line; the game
  draws a dotted line to the destination. Between z 13.4 and 14.1 the 12 m/px
  raster is soft before the vector footprints take over.
* **Street** (z 18.4, pitch 48°, bike on Nassaukade): the near field (own-ground
  bands, dark sunken water, quay walls) instead of MapLibre's flat strokes; the
  game additionally has its three.js houses, trees and houseboats, which the
  page does not load (they are already ours, `rendererShared`).
* Phone: HUD buttons wrap to two lines on narrow screens; the minimap shrinks to
  112 px.

## 5. Gaps found (what the own map does not have yet)

1. Rail, tram tracks, footways/paths, landuse (cemeteries, sports, industrial),
   piers: not in our extracts. Needs a build-time OSM extract (Overpass, as
   `scripts/own-ground/fetch-osm-ground.ts` does) for the whole city.
2. Other cities (Utrecht, Rotterdam, Den Haag) have streets/parks/water names
   but **no water polygons and no building-overview raster** — the generator
   needs a water-polygon extract per city.
3. Brand icons, roofline-band lift, answered-street road lettering, ferry
   terminal labels, transit overlays, neighbourhood dashed boundaries: designed
   above, not built.
4. Footprint tiles on the main thread; label placement every frame (fine at
   these counts; MapLibre throttles placement to ~300 ms).
5. The Leaflet picker's OSM tiles.

## 6. Go / no-go and estimate

**Go.** The map screens are not where MapLibre earns its keep: with our
extracts and ~1.4 k lines we get the same views at the same cameras, cheaper,
with the spoiler rules in one tested place, and no runtime tile host.

Remaining work to remove MapLibre from the game, assuming the own-ground lane
delivers the riding-view ground (citywide streaming) separately:

| Work | Estimate |
|---|---|
| Own frame owns the canvas: replace `jumpTo`/`project`/`getBounds`/events in `vector-map.js` with `CameraState`/`cameraFrame`; intro flight, aim, clearance, settle promises | 4–5 days |
| Move the remaining custom layers (elevation, 3DBAG detailed, Google tiles, study layers, park landscape) onto `rendererShared`; drop `MercatorCoordinate` | 4–5 days |
| Overlays as meshes: route, active street, cycle tracks, transit, neighbourhood lines, active landmark | 2–3 days |
| Labels in the game: POI bands at roofline z, brand icons, ferry labels, answered-street decal, tap hit-testing | 3–4 days |
| `isWater` / rider cover / POI tap via `PolygonGrid` & raycasts; feedback capture | 1–2 days |
| Overview extract per city + rail/footway/landuse extract | 2–3 days |
| Delete basemap-duplicate machinery, themes as palettes, update e2e specs that read `vectorMap.map` (intro-flight, own-ground, ride-perf, …) | 2–3 days |
| **Total** | **≈ 3–4 weeks** |

Risks: real-device GPU (only CPU measured), the Leaflet picker, and specs that
use `vectorMap.map.project` as their oracle (they need the own `project`, whose
parity with MapLibre is now a test).
