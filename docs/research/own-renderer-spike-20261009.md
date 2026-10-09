# Own renderer spike (2026-10-09)

Question: *"At what point do we just rewrite the entire renderer ourselves — is
MapLibre holding us back from this looking really good?"*

Short answer: **MapLibre is no longer what draws the parts that make Canal
Recall look good, and it is now the thing that blocks the next step (light).**
A pure three.js frame built from our own extracts took one session, looks
clearly better at street level, and is cheaper per frame than the game. But
the game still leans on MapLibre for ~a dozen things that are not rendering
(tile streaming of the basemap, the minimap, label collision, hit-testing,
`project`/`unproject`, the camera model). Recommendation at the end: a phased
inversion — three.js owns the frame, MapLibre is demoted to an offscreen
service and then removed — not a big-bang rewrite.

Branch `spike/own-renderer-20261009`. Page `public/canal-drive/renderer-spike.html`.

## Context we could not fetch

Both reference posts (r/vibecoding "planet-scale casual driving sim",
r/BeamNG Kyiv map) are blocked to this sandbox (reddit refuses WebFetch and
plain curl). The comparison below is therefore against the general class they
represent: game-engine frames (own camera, sun + shadow + sky + fog +
post-processing) over OSM/LiDAR-derived geometry, rather than a slippy map
with 3D layers.

## 1. Inventory: what MapLibre does for us today

| Job | Today | Ours already? |
|---|---|---|
| **Basemap fills** (water, landuse, parks, road lines by class, bridges/tunnels, rail) | OpenFreeMap `liberty` style, **fetched live from tiles.openfreemap.org** (a runtime third-party dependency the CLAUDE.md principles discourage) | Water: yes (`elevation-v1` cells, the basemap's own z14 shoreline, 8 MB). Parks: yes (`parks.json`, `park-landscape*.geojson`). Roads: centrelines + `highway` class only (`streets-routing.json`, 15 MB); **no carriageway widths, sidewalks, lane counts, tram tracks, rail, landuse other than parks** |
| **Basemap labels with collision** | All basemap symbol layers are **hidden** (`_hideLabels`, spoiler rule). Only the game's own GeoJSON symbol layers draw: POI labels, branded POI icons/labels, local-food, neighbourhood labels, ferry terminals (≈10 layers) | Data yes (POI/brand/neighbourhood extracts); the *collision engine* and glyph/sprite pipeline are MapLibre's |
| **Camera / projection** | Mercator, `jumpTo` every frame (fires `moveend` per frame), chase pitch 48°, cockpit 84°, `project`/`unproject`, padding | No |
| **2D overlays** | Route line (line-gradient), active street, answered streets, cycle tracks, neighbourhood polygons, active landmark highlight, transit overlays, stylised trees, building appearance fill-extrusions, building overview | Data yes (all GeoJSON we generate) |
| **Minimap / overview**, attribution | MapLibre (`© OSM · © CARTO`) | Attribution strings exist per extract |
| **Hit-testing** | `queryRenderedFeatures`, POI click | Partly (`ThreeBuildings.inspectAtScreen` raycasts our own meshes) |

What we already draw ourselves in three.js, inside MapLibre custom layers (14
of them across the game and its study pages: `threeBuildingsBrowser`, `elevationBrowser`, signature/detailed
landmarks, pyramidal roofs, player vehicles, inventory/study trees, facade
recipes, google tiles, …): **every building wall and roof, every landmark
GLB, bridges/quays/sunken water, the bike/boat/ferry, the 3D trees**. In the
chase view that is most of the pixels. MapLibre's own contribution to the
picture is the flat ground: water fill, road strokes, a beige land colour.

### Where MapLibre costs us (measured or already documented)

- The elevation layer must clear MapLibre's stencil and **reset private painter
  fields** (`currentStencilSource`, `nextStencilID`) and read its cached
  depth range; every MapLibre upgrade is a re-check (`docs/elevation.md`).
- Each custom layer gets MapLibre's projection matrix and renders with
  `renderer.resetState()`; the landmark layer renders **one THREE.Scene per
  model**; nothing can share a shadow map, light rig or post chain across
  layers, because there is no frame we own end to end.
- Road paint, water and labels are MapLibre layers, so 3D (sunken canals,
  humped decks) fights draw order: route line and street highlights vanish
  under humped decks (`docs/elevation.md`, known gaps).
- No shadows, AO, sky, fog, tone mapping or bloom: the facade shader bakes a
  fixed "sun" into vertex shade; elevation meshes bake light into colours.
- Camera: `jumpTo` per frame fires `moveend` per frame (ride-perf instruments
  it); pitch capped at 85°; MapLibre's mercator fov/zoom model instead of a
  free camera (no low chase cam, no camera collision, no roll).
- Heap: the game sits at **~660–710 MB** JS heap during a ride (ride-perf);
  the spike sits at **~220 MB** for the neighbourhood (not like-for-like: the
  game streams far more city; see §3).

## 2. The spike

`public/canal-drive/renderer-spike.html` + `src/canalRecall/rendererSpike/`:

| File | What |
|---|---|
| `main.ts` | page: loads one neighbourhood (r = 700 m, default centre Prinsengracht/Westermarkt), renderer, light rig, camera, HUD, `window.__spike` |
| `facadeMaterial.ts` | the game's facade chunks (`buildFeatureChunk`, same attributes and texture arrays from `buildLookTextures`) on a **lit** `MeshStandardMaterial` via `onBeforeCompile`; dark glass gets low roughness so windows pick up the sky |
| `streetMesh.ts` | street ribbons + lane paint from `streets-routing.json` centrelines; per-class width/surface priors (klinker, asphalt, red cycle asphalt, paving) |
| `ride.ts` | deterministic autopilot over the street graph; `mapLibreEye()` converts a MapLibre camera (centre/zoom/pitch/bearing/fov) to an eye position, so the spike can reproduce the game's exact view |
| `rendererSpike.test.ts` | winding/width/z-order of ribbons, deterministic ride, camera maths |

Reused unchanged: the game's building decoration chain
(`galleryPipeline.gameDecorator` → `buildFeatureChunk`, photo look),
elevation `waterSurface`/`quayWalls`/`measuredDeckMesh`/fallback decks,
`MANUAL_LANDMARKS` + `placementFor` (32 GLBs in the area, Westerkerk, Anne
Frank House, Homomonument…), municipal tree tiles (heights), the omafiets GLB.

Added because we own the frame:
- **Sun shadows**: one 2048² (phone 1024²) PCF shadow map, ±140 m ortho box
  following the view, texel-snapped. Buildings, trees, landmarks, bike cast.
- **Sky + IBL**: `Sky` (Preetham) baked once to a PMREM environment, used as
  background and image-based light; hemisphere fill.
- **Fog** (260–1300 m), **tone mapping** (Neutral), **GTAO** (desktop default,
  `ao=1` on phone), **water**: glossy dark-teal surface with scrolling ripple
  normals reflecting the sky, 1.77 m below the street.
- **Sunken canals without hacks**: a stencil "opening" pass (water at z = 0)
  and a ground plane drawn where stencil ≠ 1. Same idea as the MapLibre layer,
  but ten lines and no private state, because we own the stencil.
- Own **chase camera** (7.5 m behind, 3.4 m up, fov 55°) — the game cannot
  do this view; plus `cam=map` reproducing MapLibre's camera exactly.

Build (not in package.json, per the integration rule):

```sh
npx esbuild src/canalRecall/rendererSpike/main.ts --bundle --format=esm \
  --loader:.json=json --minify --outfile=public/canal-drive/js/renderer-spike.bundle.js
```

Run: `/canal-drive/renderer-spike.html?lat=52.3747&lng=4.8850` (params in
`main.ts` header: `cam=chase|map`, `mapcam=lng,lat,zoom,pitch,bearing,fov`,
`rider=lng,lat,bearing`, `auto=0|1`, `fx=0`, `shadows`, `ao`, `dpr`, `hud`).
Checks: `RENDERER_SPIKE=1 PW_PORT=4415 npx playwright test renderer-spike
--project=desktop` (and `--project=iphone`);
`node --import tsx --test src/canalRecall/rendererSpike/rendererSpike.test.ts`.

## 3. Performance

Method: Playwright, local Chrome with the Mac GPU. iphone project = iPhone 13
profile with **4× CPU throttle**, desktop = 1440×900 unthrottled. 12 s ride
in each case. Game: `PERF_RIDE=1 npx playwright test ride-perf -g "default$"`
(seeded route, chase view, MapLibre `map._render` timed). Spike:
`renderer-spike.spec.ts "ride cost"` (autopilot ride through the Jordaan at
5.5 m/s, `composer.render` timed). Both pages use the same pixel-ratio rule
(phones capped at 1.5).

| | frame median / p95 / p99 (ms) | render CPU median / p95 (ms) | draw calls | triangles | JS heap |
|---|---|---|---|---|---|
| **game, iphone 4×** | 16.7 / 16.8 / 33.3 (2 frames > 50 ms) | 7.1 / 9.3 (`map._render`) | 279 * | 0.65 M * | 664 MB |
| spike, iphone 4×, chase, shadows+sky+fog+tone | 16.7 / 16.7 / 16.8 | **2.6 / 3.2** | 170 | 1.40 M | 218 MB |
| spike, iphone 4×, + GTAO forced | 16.7 / 16.7 / 16.8 | 4.1 / 5.1 | 341 | 2.79 M | 227 MB |
| spike, iphone 4×, MapLibre camera | 16.7 / 16.8 / 16.8 | 2.7 / 3.6 | 153 | 1.32 M | 220 MB |
| spike, iphone 4×, effects off | 16.7 / 16.8 / 16.8 | 1.5 / 2.0 | 63 | 0.57 M | (332 MB, GC timing) |
| **game, desktop** | 16.7 / 16.7 / 16.8 | 1.7 / 2.0 | 489 * | 1.57 M * | 711 MB |
| spike, desktop, all effects incl. GTAO, MSAA 4× | 16.7 / 16.7 / 16.8 | **1.2 / 1.4** | 381 | 2.88 M | 233 MB |
| spike, desktop, effects off | 16.7 / 16.7 / 16.8 | 0.5 / 0.6 | 81 | 0.61 M | 225 MB |

\* Game draw calls/triangles: WebGL call counter at the Westerkerk viewpoint
(stationary, same camera as the screenshots), all layers incl. MapLibre's;
ride-perf itself only reports the facade layer (11 calls). Spike counts
include the shadow pass (and GTAO's normal pass when on).

Reading it:
- Everything is **vsync-bound at 60 fps** on this machine; the real signal
  is CPU per frame, which the 4× throttle makes honest. The spike spends
  **~2.6 ms** per throttled frame drawing a lit, shadowed scene; the game
  spends **~7 ms** in MapLibre's render (style layers, symbol placement,
  a dozen custom layers each resetting GL state) before game logic.
- The spike is **not like-for-like**: no streaming, no route/labels/HUD, no
  game logic, one 1.4 km disc already resident (5,395 buildings, 1.75 M
  vertices, 1,942 trees, 32 GLBs). The game streams 17–18 k buildings. The
  honest conclusion is "rendering is not where the budget goes", not "the
  spike is 3× faster".
- Effects cost: shadows ≈ +1 ms CPU / ×2 draw calls; GTAO ≈ +1.5 ms CPU on
  the throttled phone and an unknown GPU cost (Mac GPU here). **GPU time is
  not measured** (timer queries are unavailable in this Chrome); a real
  device run is the gating test.
- Heap: 220 MB for the spike vs 660–710 MB for the game. Partly scope, partly
  that the spike holds no MapLibre tile pyramid. `streets-routing.json`
  (15 MB, parsed whole) is the spike's biggest single cost — it must be tiled.
- Load: the neighbourhood is ready in ~2.7 s (buildings 2.3–3.1 s of that,
  on the main thread; the game already has a worker for it).

## 4. Screenshots

`artifacts/renderer-spike/` (not committed; regenerate with the spec). The
bike is teleported to Raadhuisstraat by the Westerkerk (4.88475, 52.37395,
heading 355°), the game's MapLibre camera is read back and replayed in the
spike with `mapLibreEye()`.

| | desktop 1440×900 | iphone 390×664 @3 (DPR 1.5 rendered) |
|---|---|---|
| game (MapLibre + custom layers) | `desktop-1-game.png` | `iphone-1-game.png` |
| spike, same MapLibre camera | `desktop-2-spike-same-camera.png` | `iphone-2-spike-same-camera.png` |
| spike, own chase camera | `desktop-3-spike-chase.png` | `iphone-3-spike-chase.png` |
| spike, effects off (`fx=0`) | `desktop-4-spike-chase-no-effects.png` | `iphone-4-spike-chase-no-effects.png` |

What looks better, and why:
- **Contact and depth.** Building and tree shadows on the paving and *on
  the canal water* are the single biggest change; they anchor every tree and
  facade to the ground, and the sun direction reads as time of day. The game
  has none — trees float on a beige plane.
- **The canals read as canals.** Dark glossy water 1.77 m down, quay walls,
  sky reflection and ripple normals, versus a flat light-blue fill. (The
  game's `?elevation=1` has the quay geometry but no light on it.)
- **Ground material.** Klinker, asphalt, red cycle asphalt and paving
  textures in world space carry scale at street level; the basemap's flat
  colours carry none. At the chase camera this is most of the screen.
- **Atmosphere.** Sky + fog give a horizon and aerial perspective, which is
  what makes the "driving sim" references feel big. MapLibre's sky/fog is
  separate from our three.js layers and would not fog them consistently.
- **Windows.** The same facade atlas, lit by the sun and sky, with glossy
  dark glass, gains depth for free.

What is worse or missing in the spike (honest list):
- No route line, labels, POIs, minimap, HUD — the game screenshot carries
  them, the spike does not. The game's picture is *more useful* today.
- Road widths are class priors; the Westermarkt junction is cruder than
  the basemap's road strokes. Humped bridge decks are a plain grey slab (the
  elevation layer's deck colours, no road paint on top).
- On the iPhone profile the spike's replay of the game camera is tighter
  than the game's real framing (the game applies phone-specific
  zoom/padding the spike does not replicate); desktop matches closely.
- Trees are icosahedra; tone, fog distance and sun strength were tuned by eye
  in one pass.

## 5. What would be lost / need rebuilding

Ordered by how much work it is, not by how visible it is.

1. **City-wide streaming of everything we now draw from the basemap.** The
   spike loads one 1.4 km disc up front (3 s, ~220 MB heap). The game
   already streams buildings (z14 tiles, `BuildingTileStreamer`) and
   elevation (1 km cells); streets (15 MB monolithic JSON), parks and trees
   would need the same: cut `streets-routing` into z14/z15 tiles, build
   ribbons in the existing chunk worker, LOD by distance. Medium.
2. **Road surface detail.** The basemap draws road widths by class, tram
   tracks, rail, footpaths, landuse (cemeteries, sports pitches, sand),
   piers and tunnel portals. We have centrelines + class only. Rebuilding
   carriageways properly means a new extract (OSM `width`/`lanes`/`sidewalk`,
   BGT *wegdeel* polygons from the municipality/PDOK, which are surveyed road
   and pavement polygons for all of Amsterdam) — that would be *better* than
   the basemap, but it is new data work. Medium-large.
3. **The game's 2D overlays** (route line with gradient, active/answered
   streets, cycle tracks, neighbourhood polygons, landmark highlight, transit
   overlays): each becomes a ribbon/polygon mesh like `streetMesh.ts`. Easy
   individually, ~10 of them. In exchange they stop vanishing under humped
   decks — they can drape over the deck profile.
4. **Labels.** Basemap labels are already hidden, so this is only the game's
   ~10 symbol layers (POI, brand icons, neighbourhood names, ferry terminals).
   Need: SDF text (troika-three-text) or DOM labels, screen-space collision
   (a greedy box packer sorted by priority is ~150 lines and enough for tens
   of labels), sprite icons. Medium.
5. **Camera and geo utilities.** `project`/`unproject`, `jumpTo`, padding,
   `getBounds`, the zoom model used by HUD/zoom logic, `queryRenderedFeatures`
   for taps. A local ENU frame + raycasting replaces them; the game's world
   coordinates are already metres. Medium, wide but shallow (many call sites
   in `vector-map.js`, ~2.8k lines).
6. **Minimap / overview and attribution.** The minimap can stay a separate
   tiny MapLibre (it is already a separate canvas) — it is a 2D map, the job
   MapLibre is best at. Attribution becomes a static credit line from
   extract metadata. Easy.
7. **Zoomed-out / overview modes** (route preview, top-down): flat 2D
   cartography at city scale is where MapLibre still wins outright. Keep a
   MapLibre view for those screens, or render the overview from our own
   extracts as flat polygons. Policy decision more than work.
8. **Themes** (`applyTheme`, quiet/spoiler filters) — the theme becomes
   material parameters; spoiler filtering becomes "do not build the label".

What we would *not* lose: buildings, landmarks, trees, bridges, water,
vehicles are already ours; this spike drew them all in one frame from the
same code paths.

## 6. Migration plan

**Phase 0 (done here): spike.** Proves the extracts suffice for the ground,
the lit facade material works with the existing chunks, and the frame is
cheaper. ~1 day.

**Phase 1 — one shared frame inside MapLibre (2–4 days, low risk, reversible).**
Collapse the ~dozen three.js custom layers into *one* custom layer with one
`WebGLRenderer`, one scene graph, one light rig. Landmarks stop being one
scene per model. Turn on the lit facade material (`facadeMaterial.ts`) and
sun shadows for buildings/trees/landmarks in that single pass; shadows land on
our own meshes (not yet on MapLibre's ground). This removes most "draw order
fights" between our own layers and is valuable even if we never go further.

**Phase 2 — three.js owns the ground near the rider (1–2 weeks).** Add
street ribbons, parks and paved ground from our extracts within the
streaming radius; the canal opening becomes our own stencil (no more private
painter state). MapLibre keeps drawing beyond that radius and in overview
zoom; inside it its fill/line layers are hidden by the existing spoiler/quiet
filters. Shadows and AO now land on the ground. Overlays (route, highlights)
move to meshes. Gate behind a flag (`?ownframe=1`) with ride-perf and the
reachability/driving harnesses unchanged (they are 2D and do not read the
renderer).

**Phase 3 — invert ownership (1–2 weeks).** Our `requestAnimationFrame`
drives the frame and the camera (free chase cam, collision, roll); MapLibre
becomes a non-interactive service: the minimap, the overview screen, and
optionally a far-field flat texture (render MapLibre offscreen to a texture
draped on a distant ground ring, or drop it and use fog). Rebuild labels and
`project/unproject` on our camera. Remove `jumpTo`-per-frame.

**Phase 4 — remove MapLibre from the riding view** once overview/minimap are
the only users. Drop the live OpenFreeMap dependency for gameplay.

Total realistic estimate: **4–6 focused weeks** to reach Phase 3 with parity,
most of it in streaming, overlays/labels and the long tail of
`vector-map.js` call sites — not in rendering.

## 7. Risks

- **Mobile GPU.** Our numbers are Playwright's iPhone profile on a Mac GPU
  with 4× CPU throttle: they measure CPU cost faithfully and GPU cost not at
  all. Shadow map + PBR + fog on a real iPhone 12-13 at DPR 1.5 needs a
  device test before Phase 2. Mitigations exist (1024² shadow, no AO,
  Lambert instead of Standard, half-rate shadow update, baked AO).
- **Data honesty.** Street widths/surfaces are priors; drawing them more
  convincingly makes a wrong width look more authoritative than a basemap
  stroke. Needs BGT/OSM width data before it is a learning tool.
- **The geographic-learning rule.** MapLibre's spoiler filtering is
  layer-based and battle-tested; with our own labels it becomes code we must
  test (no street name may render before the answer). Add a named check.
- **Scope creep.** "Looks really good" has no bottom (leaf cards, wet
  roads, reflections, bloom). Keep effects bounded by the product principle
  that the driving corridor stays readable.
- **Overview / route-preview screens** genuinely need a 2D map. Dropping
  MapLibre entirely would mean rebuilding cartography we do not want to own.
- **Two renderers during migration** cost memory; Phase 1 alone must not
  regress ride-perf.

## 8. Recommendation

**Do not do a big-bang rewrite. Do invert ownership, in phases, starting now
with Phase 1.**

1. MapLibre is already not the renderer of what players look at: buildings,
   landmarks, trees, bridges, water and the bike are ours. What it still
   draws is a flat ground and labels, and the price is a frame we cannot
   light, shadow, fog or sequence.
2. The spike shows the lighting gap is the visible gap: same buildings, same
   data, plus sun shadows, sky light, fog and real water, reads like a game
   rather than a map — at ~2.6 ms CPU per throttled phone frame.
3. The cost of switching is not rendering, it is plumbing: streaming the
   ground, ~10 overlays, label collision, `project/unproject`, and the
   `vector-map.js` call sites. 4–6 focused weeks to parity, flag-gated.
4. Phase 1 (one shared three.js frame inside the custom layer, lit facades,
   shadows on our meshes) is worth doing regardless, takes days, and
   de-risks everything after it. Phase 2's ground-in-our-frame is the point
   of no return and should wait for a real-iPhone GPU measurement.
5. Keep MapLibre for what it is best at: the minimap and the overview/route
   preview screens. Remove it from the riding view only (Phase 4), which
   also removes the live OpenFreeMap dependency from gameplay.
