# Own ground on AHN relief (2026-10-09)

Phase 2 of `own-renderer-spike-20261009.md`: can three.js draw the riding-view
ground itself, with height, so streets, the route, bridges and quays agree?
With `?elevation=1` MapLibre paints roads, casings and the route line flat at
z = 0: street lines run straight across sunken water, bridge decks are grey
slabs that join neither the road nor the quay, and nothing has relief.

Branch `render/own-ground-20261009`. Page `public/canal-drive/own-ground.html`
(standalone, not wired into the game). Two boxes, 1.5 km each:
`box=nassaukade` (Nassaukade / Kostverlorenvaart / Bilderdijkstraat) and
`box=leidsegracht` (Herengracht / Leidsegracht).

## What was built

| File | What |
|---|---|
| `scripts/own-ground/build-ground-height.ts` | AHN `dtm_05m` from PDOK's WCS (500 m GeoTIFFs, cached in `artifacts/own-ground/raw/ahn`) → 2 m RD grid, 1 km tiles, int16 cm delta-coded + gzip; staging dir + `report.json` |
| `scripts/own-ground/fetch-osm-ground.ts` | Overpass at build time: highways with cross-section tags, parks/grass/squares/parking; staging + coverage report |
| `src/canalRecall/ownGround/geotiff.ts` | minimal float32 GeoTIFF reader (deflate, floating-point predictor) — no deps |
| `heightField.ts` | downsample, pull-push hole fill, 3×3 smoothing, tile codec, `GroundField` (bilinear across seams), quadratic local→RD fit |
| `surface.ts` | `GroundSurface.height(x, y)`: relief + measured deck spans, the one function everything drapes on; `riderPose` |
| `osmGround.ts` | OSM tags → bands: carriageway (width/lanes/priors), painted cycle lanes, raised cycle tracks, raised sidewalks, paths; paint lines; source tracking (tag vs prior) |
| `streets.ts` | draped bands, kerbs and end caps, raised bands cut back at side streets on their side only, junction discs, lane paint, `routeRibbon` |
| `drape.ts` | mitred ribbons, walls, caps, subdivided draped polygons, relief grid |
| `water.ts` | signed-distance water mask (R: water, G: water minus bridge decks), water plane, quay walls whose top follows the surface |
| `decks.ts` | measured deck bodies (fascia, buried abutments, parapets, soffit, masonry vault) and flat footprint decks |
| `placement.ts` | building/tree/landmark base heights (footprint minimum), per-building range lift in merged chunks |
| `route.ts` | deterministic route ahead over the OSM graph (prototype only) |
| `sharedFrameGround.ts` | adapter: the ground as a `rendererShared` participant (same local→Mercator transform as the facades), `GROUND_ORDER = -10` |
| `main.ts` | the page (lighting/sky/shadows copied from the renderer spike) |
| `ownGround.test.ts` | 20 tests incl. named regressions BRU0166 (Nassaukade), BRU0044 (Leidsegracht arch), relief Postjeskade vs Herengracht |

Data (published after review): `public/data/extracts/amsterdam/ground-height-v1/`
(10 tiles, 1.46 MB) and `own-ground-osm-v1/` (two boxes, 0.15–0.19 MB gzipped each).

### Key decisions

- **Field is frame-neutral** (RD New + NAP cm). The page fits a quadratic
  local→RD map per area (the game's equirectangular frame is 0.21 m off an
  affine fit over ±1 km; the quadratic is < 1 cm).
- **Scene datum z = 0 at +1.37 m NAP** (canal level −0.40 + the elevation
  layer's 1.77 m freeboard), so canal-belt quays stay near the old z = 0 and
  water stays at −1.77.
- **Water is blanked before averaging**: the DTM keeps returns off the water
  surface near quays; averaged into 2 m cells they notched the quay tops down
  to the water. Pixels in the `elevation-v1` water polygons (+0.5 m) and
  canal-level pixels within 2 m of them are holes, then pull-push filled.
- **No stencil.** Land, parks and squares discard where the mask's R channel
  says water; street bands use the G channel (water minus deck footprints), so
  they cross bridges but never overhang a quay. Water, quay walls and deck
  bodies are ordinary depth-tested meshes. Nothing touches private renderer state.
- **Decks join by construction.** The relief carries the approach ramps (DTM);
  a measured profile lifts only its DSM deck span, re-based on our relief at
  the approach ends and eased in over 2.5 m. Checked against the bridge
  pipeline: our relief at the 48+100 approach ends matches its AHN to
  **0.10 m max**; crowns land at the measured height (BRU0166 0.83 m, BRU0044
  1.64 m, within 0.25/0.3 m), no 0.5 m step on BRU0166 exceeds 0.15 m.
- **Route and highlight are draped ribbons** sampling the same surface, so the
  route rides over humped decks instead of vanishing under them. The
  question-street highlight (`highlight=<name>`) is the same ribbon with no
  label; nothing in the ground draws a name.
- **Models on the relief**: buildings take their footprint's lowest relief
  (no floating; up to 3.2 m footprint spread in the Nassaukade box), applied
  per building via the chunk's vertex ranges (6,239 ranges lifted); trees at
  the relief under the trunk; landmark GLBs at the lowest relief in a 6 m
  square round the anchor (logged per landmark in `status.landmarks.bases`).

## Measurements

Playwright, Mac GPU; `iphone` = iPhone 13 profile, 4× CPU throttle, DPR 1.5;
12 s autopilot ride; `OWN_GROUND=1 PW_PORT=4407 npx playwright test own-ground`.
Area built = box + 250 m pad = 2 km × 2 km.

| | render CPU median / p95 (ms) | draw calls | triangles drawn | JS heap |
|---|---|---|---|---|
| iphone, Nassaukade, all effects (shadows/sky/fog) | 2.1 / 2.6 | 112 | 2.26 M | 258 MB |
| iphone, Nassaukade, effects off | 1.1 / 1.6 | 59 | 1.54 M | 253 MB |
| iphone, Nassaukade, ground only (no buildings) | 1.2 / 1.8 | 60 | 1.87 M | 115 MB |
| iphone, Leidsegracht, all effects | 4.4 / 5.6 | 242 | 2.54 M | 314 MB |
| desktop, Nassaukade, all effects | 1.0 / 1.3 | 245 | 4.56 M | 264 MB |
| desktop, Leidsegracht, all effects | 2.2 / 2.6 | 641 | 5.26 M | 311 MB |

Frame time is vsync-bound at 16.7 ms everywhere (p95 16.7–16.8, no frame
> 50 ms). Compare the game at 7.1 ms `map._render` and the spike at 2.6 ms
(same method). The Leidsegracht cost is the canal-belt buildings (detail
chunks), not the ground. GPU time is not measured (no timer queries here).

Ground per 4 km² area: **0.99 M (Nassaukade) / 1.09 M (Leidsegracht)
triangles**, ~40–46 MB of geometry arrays (positions, normals, uvs, indices).
Biggest layers: land grid 0.30 M (5 m), parks 0.16 M, paving 0.12 M, kerbs
0.10 M. Build: **0.55–0.7 s unthrottled, 2.0–3.7 s at 4× throttle** on the
main thread (streets ~0.6 s, water mask + decks ~0.5 s, relief 0.2 s at 4×).

### City-wide extrapolation

- Relief: 263 one-km tiles touch the municipality (`--city --dry`; 1,052 WCS
  requests ≈ 1.6 GB of AHN to fetch once). At 2 m / 1 cm: **146 KB/km² gz →
  ≈ 38 MB** for the city; at 4 m: 45 KB/km² → **≈ 12 MB**. A rider needs
  ~9 tiles resident (≈ 1.3 MB download, 4.5 MB decoded int16).
- OSM ground: ≈ 50 KB/km² gz in the dense core → ≤ 11 MB city, to be tiled
  like `streets-routing`.
- Geometry: ~0.25 M triangles and ~10 MB of arrays per km². Streaming a 1 km
  radius (≈ 3 km²) keeps ~0.8 M ground triangles / 30 MB resident; beyond it
  a coarser ring (10 m relief grid, carriageways only) would cost ~0.1 M per km².
- Build: ~0.5–0.9 s per km² at 4× throttle — must move into the chunk worker
  (all modules are DOM-free); at 5.5 m/s a new 1 km cell is needed every
  ~3 min, so the budget is generous once off the main thread.

## Screenshots (`artifacts/own-ground/`, regenerate with the spec)

Chase camera on Nassaukade (4.87445, 52.37286, bearing 40°) toward the
Bilderdijkgracht-mouth bridge BRU0166.

- `*-1-maplibre-elevation.png` — game, `?elevation=1`: the bridge is a grey
  slab, the yellow route line stops at it, roads are flat strokes.
- `*-2-own-same-camera.png` — ours, MapLibre's camera replayed: carriageway,
  cycle tracks, sidewalks and the route ribbon continue over the deck; quays
  and sunken water; relief under everything.
- `*-3-own-chase.png` / `*-4-own-chase-flat.png` — our chase camera with and
  without relief (`relief=0`).
- `*-5-leidsegracht-chase.png`, `*-6-leidsegracht-map.png` — klinker street,
  raised kerbed sidewalks, quay walls, masonry arch bridges with the route over them.
- `*-7-arch-from-water.png` — BRU0044 from canal level: vault, fascia and
  parapets meeting the quay walls, no gap where deck meets quay.

## Go / no-go

**Go for replacing MapLibre's ground in the riding view, behind a flag, in the
shared frame.** The prototype fixes exactly what `?elevation=1` cannot:
streets and the route follow decks and relief, decks meet roads and quays,
and it costs ~1.2 ms CPU per throttled phone frame for 4 km² of ground. It
needs no MapLibre private state.

Not yet good enough to ship as is:
- Junctions are band unions, not intersection polygons: overlapping
  sidewalk/cycle-track pieces and odd patches at complex junctions
  (Nassaukade/Bilderdijkstraat). BGT *wegdeel* polygons would fix this and the
  width priors (only 14 % of ways tag `width`; widths/sidewalks elsewhere are priors).
- One canal level everywhere; park banks and polder water get vertical quay walls.
- Parapet geometry on some short decks reads oddly; flat footprint decks carry no parapets.
- Building bases sink the uphill side (by design) — on dikes a plinth would read better.
- Real-device GPU cost (shadow map + 1–2 M triangles) still unmeasured.

## What remains, with estimates

| Work | Estimate |
|---|---|
| Streaming: tile the relief/OSM/water per 1 km cell, build in the chunk worker, LOD ring, register via `sharedFrameGround.ts` | 4–6 days |
| Hide MapLibre fills/lines inside the radius (existing spoiler/quiet filters), keep them beyond | 1 day |
| Game overlays as draped ribbons: route gradient, active/answered streets, cycle-track bonus, neighbourhood outlines | 2–3 days |
| Labels in our frame (POI/brand/neighbourhood; the ground draws no street names, so the question rule holds) — or keep MapLibre symbol layers on top | 2–4 days |
| Re-base buildings/trees/landmarks/vehicles in the game on the relief (bases already computed here); bike physics stays 2D, pose from `riderPose` | 2 days |
| BGT road polygons instead of priors (data work) | 3–5 days |
| Overview zoom and minimap: keep MapLibre (flat cartography); hide our ground below ~z16 | 0.5 day |
| City relief build + review (1.6 GB AHN fetch, 38 MB at 2 m or 12 MB at 4 m) | 1 day |

Total to a flag-gated riding view with our ground: **~3 weeks**, plus BGT if
widths must be honest before it is a learning tool.

## In the game behind `?ownGround=1` (2026-10-10)

Branch `render/own-ground-game-20261010`. `?ownGround=1` (or
`window.__canalRecallOwnGround = true`) implies `?sharedFrame=1` and replaces
the `?elevation=1` stencil layer (that layer is not loaded at all).

| Part | Where | What |
|---|---|---|
| Data | `ground-height-v1` (25 RD tiles, 3.4 MB gz) and `own-ground-osm-v1/cells/` (39 elevation-v1 cells, 1.1 MB gz) | area `west` in `boxes.ts`: canal belt, Jordaan, Oud-West, Westerpark; `--area west` on both build scripts, via staging, reports in the extract dirs |
| Store | `groundStore.ts` (DOM-free) | one `GroundSurface` for the streamed area (local→RD quadratic about the origin over ±9 km, < 5 mm residual at 8 km); per cell: relief + 350 m pad, its decks (and neighbours' decks that reach in), water and OSM of the 3×3 neighbourhood |
| Cell | `groundCell.ts` | the prototype's layers restricted to what the cell owns (land grid on the cell rectangle on global step multiples, its water/quays/decks, ways by midpoint, areas by bbox centre) + mask; LOD 1 = 10 m land, carriageways only; normals in the worker |
| Worker | `groundWorker.ts` → `own-ground-worker.bundle.js` | builds cells nearest first |
| Game | `gameGround.ts` → `own-ground-game.bundle.js` (`CanalRecallOwnGround`) | residency (LOD 0 ≤ 350 m from the rider to a cell's edge, LOD 1 ≤ 1.4 km, one install per frame, relief evicted beyond 3.6 km), shared-frame participant (order −10), per-cell mask materials, draped route/casing, question-street highlight (geometry only), destination ring; rider pose and model bases on the same surface |
| Adapter | `vector-map.js` | the only MapLibre-touching code: `GroundHost` (repaint; basemap ground fills/lines of transportation/landuse/landcover/park/aeroway/waterway and the flat route/active-street/cycle-track overlays to opacity 0 while the ground covers the rider's 3×3 cells — water stays, `isWater()` queries it; restored below z 15, i.e. start flight/overview/minimap) |
| Models | `ThreeBuildings.setGroundBase`, `InventoryTrees.setGroundBase`, `SignatureLandmarks.setGroundBase` | buildings lifted per building (lowest footprint relief) before upload, CPU positions kept only while a building waits for its relief; trees at the trunk; landmark GLBs and street chunks at the lowest relief in a 6 m square round the anchor; bike pose from `riderPose` (contacts), boat at −1.77 |

Measured (`scripts/own-ground/check-ground-cells.ts --all`, node, unthrottled):
16 fully covered cells, **265 k triangles / 13.5 MB per LOD 0 cell**, LOD 1
71 k / 4.4 MB, worker build median 238 ms (max 331). In the browser the
worker reports 78–92 ms per cell (CDP throttling probably does not reach the
worker — unverified). Install (geometry upload) median 2.5 ms per cell.
Resident on the fixed route: **1.31 M triangles, 59 MB** geometry.

Ride cost (`scripts/ride-perf-fixed-route.mjs`, Anne Frank Huis → Rijksmuseum,
iPhone 13 profile, 4× CPU, 12 s, 3 interleaved runs each):

| | frame median / p95 | `map._render` median (runs) | shared-frame passes / frame | draw calls | heap |
|---|---|---|---|---|---|
| off | 16.7 / 16.8 | 7.6, 8.2, 9.3 | 3.1–3.7 ms (own layers) | 310–327 | 575–681 MB |
| `?sharedFrame=1` | 16.7 / 16.8 | 7.6, 9.2, 8.1 | 3.6–4.6 ms | 310–327 | 373–660 MB |
| `?ownGround=1` | 16.7 / 16.8 (one run p95 33.2) | 8.7, 10.7, 10.8 | 4.9–6.2 ms | 301–318 | 477–639 MB |

Desktop: `map._render` 2.1 → 2.5 ms. So the ground costs **~+1.7 ms** of
throttled-phone CPU per frame over `sharedFrame` (mostly three's per-mesh
overhead: ~15 meshes per resident cell); frames stay vsync-bound. GPU time on
a real iPhone is still unmeasured.

Verified: `tests/e2e/own-ground-game.spec.ts` (OWN_GROUND=1; desktop + iphone):
BRU0166 and BRU0044 in game (rider surface on the crown 1.28 / 1.49 m vs the
surface crown 1.28 / 1.50 m), a chase ride over BRU0166, BRU0044 and BRU0067
(rider surface step per frame ≤ 0.045 m, route ribbon continuous over each
deck), the question street draped with no rendered label spelling it, the
start flight (basemap over the overview, ground on landing, no
`canal-elevation` layer even with `?elevation=1`). Screenshots in
`artifacts/own-ground-game/`.

Still open: labels stay MapLibre symbol layers (they draw over our ground);
widths are OSM priors (BGT not done); one water level (polder banks get quay
walls); street chunks/block faces take one base at the anchor (not per pand);
landmark kits inside facade chunks and the tram/ferry stay at street level;
partly covered cells at the area's edge are not drawn (basemap shows); the
canvas destination pin and question-feature overlay project at z = 0 (the
draped destination ring gives the ground contact); city-wide relief/OSM build
not run (area `west` only).

## City-wide (2026-10-10, branch `render/own-ground-citywide-20261010`)

**Area.** The game's riding area is every elevation-v1 1 km cell the routing
network passes through (`scripts/own-ground/game-cells.ts`): 294 cells.

**Data published** (gzip, what the browser downloads; budget was ≤ 30 MB because
Firebase Hosting storage is over quota):

| Extract | Content | gz |
|---|---|---|
| `ground-height-v1` | 413 RD tiles (game cells + 150 m): 52 at 2 m within 4 km of the Dam (5.83 MB), 361 at 4 m beyond (14.73 MB), planar predictor | 20.56 MB |
| `own-ground-osm-v1/cells` | 294 cells, 116,888 ways, 55,378 areas, coordinates to 1e-6° (`--digits 6`, −16 %) | 8.54 MB |
| total | (replaces 4.5 MB for area `west`; net +24.6 MB) | **29.1 MB** |

Format: a tile entry may carry a 4th field (stored step); 4 m tiles are 2×2
means of the finished 2 m grid and are upsampled bilinearly on decode, so the
field stays one 2 m grid. `predictor: 'planar'` (left + below − below-left)
cuts gz ~21 % against delta-x. Options if size must drop further: 4 m
everywhere (~−4 MB), 8 m beyond 8 km, or drop the 150 m pad tiles (−42 tiles).

AHN: 1,500+ 500 m WCS requests (~1.9 GB cached under `artifacts/own-ground/raw/ahn`),
58 min. Overpass: 92 chunks (2×2 cells), mirrors rotated on 429/504, per-chunk cache.

**Cells.** All 294 build (`check-ground-cells --all`): 351 k triangles / 14.5 MB
per LOD 0 cell, worker build median 236 ms, max 972 ms (node, unthrottled).
Partly covered cells are now drawn: `covers()` needs only some relief, and a
missing tile next to extract tiles is extended by pull-push (`extendTile`,
deterministic from extract tiles only), so the relief continues at the edge.

**Fixes.**
- Phone stair steps at quays: the land's water cut is a per-pixel discard (no
  MSAA); its seam with the wall top showed the clear colour in jagged steps.
  Quay walls now carry a 0.35 m coping cap a centimetre over the land
  (`QUAY_CAP_M`), real geometry over the seam. Mask UV is formed per vertex
  (highp) since scene metres reach ±15 km.
- BRU0067: the deck top is the street band at 27/27 probes across the
  carriageway (klinker, with the OSM-tagged paving sidewalks either side, which
  read pale grey). Its real defect was a 0.175 m kink per 0.5 m at the deck
  start (DTM approach 0.5 m under the DSM deck): the ease now lengthens to cap
  the grade at 20 % (`DECK_EASE_MAX_GRADE`), now 0.129 m.
- Street chunks: each pand on the lowest relief under its own ground-level
  vertices (`chunkBases.ts`; shared vertices split first). Needs the
  signature-landmarks bundle rebuilt.
- Canvas pins (destination, question feature) shifted onto the surface
  (`OwnGround.screenLift`); tram rides the relief; ferry floats at the sunken water.
- Kit parts: measured as lifted already (181–294 ranges, none pending).

**BGT widths: not done.** PDOK's OGC API (`api.pdok.nl/lv/bgt/ogc/v1`,
`wegdeel`) answers a 340 × 330 m box in 13 s with 629 polygons / 98 k vertices
(4.6 MB JSON, ~56 KB gz compacted). City-wide that is tens of MB and a polygon
renderer. Cheaper path: sample BGT carriageway width at each OSM way's midpoint
offline and add a `width` per way to the OSM cells (a few bytes per way).

**Ride cost** (`scripts/ride-perf-fixed-route.mjs`, iPhone 13, 4× CPU, 12 s, 3 interleaved runs):

| | frame median / p95 | `map._render` median (runs) | three layers ms/frame | draw calls | resident ground |
|---|---|---|---|---|---|
| off | 16.7 / 16.7–16.8 | 7.8, 7.0, 7.0 | 3.0–3.6 | 310 | — |
| `?sharedFrame=1` | 16.7 / 16.7–16.8 | 7.2, 7.5, 8.4 | 3.5–4.2 | 310 | — |
| `?ownGround=1` | 16.7 / 16.7–16.8 | 8.0, 7.0, 8.0 | 4.1–4.6 | 301 | 12 cells, 1.35 M tris, 63 MB |

**Screenshots** (`artifacts/own-ground-game/`, `own-ground-citywide.spec.ts`):
De Pijp, Oost, Noord, Zuid, Nieuw-West (desktop + iphone), BRU0067 deck top,
Bilderdijkstraat chunks.

**Open.** One water level everywhere: polders (Osdorpplein rider surface
−2.17 m, i.e. below the −1.77 m water plane) need per-polder levels; vacant
plots read as grey paving (Noord); labels are MapLibre symbols; real-iPhone
GPU time unmeasured; BGT widths.

## Commands

```sh
npx tsx scripts/own-ground/build-ground-height.ts            # boxes → artifacts/own-ground/staging/ground-height-v1
npx tsx scripts/own-ground/fetch-osm-ground.ts               # boxes → artifacts/own-ground/staging/own-ground-osm-v1
npx esbuild src/canalRecall/ownGround/main.ts --bundle --format=esm --loader:.json=json --minify \
  --outfile=public/canal-drive/js/own-ground.bundle.js
node --import tsx --test src/canalRecall/ownGround/ownGround.test.ts
OWN_GROUND=1 PW_PORT=4407 npx playwright test own-ground --project=desktop --project=iphone
```

Page params: `box`, `cam=chase|map|free`, `mapcam`, `rider`, `eye`/`look`,
`route`, `highlight`, `buildings`, `relief`, `exag`, `hide`, `land`, `fx`.
