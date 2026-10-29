# Slop New York, read for Canal Recall (2026-10-29)

Evidence file for `docs/handoffs/slop-newyork-plan-20261029.md`. Read it for
numbers and file references, not for instructions. Repo:
https://github.com/mrdoob/slop-newyork at commit `e35c06c` (2026-10-29);
paths and line numbers below are from that commit. Four opus readers each
took one slice (buildings; rendering/perf/loading; movement/traffic/audio;
geodata/tests/process) and read only; none of the repo's code was run.

**What it is.** A 1:1 Manhattan (129th St to the Battery) in plain ES-module
JavaScript, ~33.5k lines, three.js `WebGPURenderer` + TSL pinned to a jsDelivr
commit hash through an import map. Walk, drive, cycle or fly. 147 commits in
ten days (2026-10-20 to 10-29, ~15 a day), one idea per commit, measured
numbers in the few commit bodies. No map library, no image textures, no audio
files, no package.json, no CI, no TODO. Data: NYC Open Data (CSCL centrelines,
building footprints, tree points, boroughs, parks), MTA entrances, OSM via
Overpass (coastline, piers, landmarks, Central Park). Remixes catalogued at
https://github.com/zz85/slop-cities (no Amsterdam; Utrecht by bertt uses the
Portolan tree GeoParquet; Copenhagen textures facades from Skråfoto with a
48 MiB / 224-texture budget over a 14–150 m band; `Denzy7/slop-newyork` adds a
WebGL 2 fallback profile and settings menu; `slop-newyork-mini` runs Midtown on
an iPhone 14 Pro by cutting the world to a 2 km circle, 256 → 16 lights, no
shadows/AA/SSR, heap 800 → 320 MB; the whole island loaded at 57 fps standing
still and lost the GPU once driving).

## 1. Buildings: two triangles per wall, everything else in the shader

- **Data (`tools/build-buildings.py`, `js/building-geodata.js`).** 37,353
  footprints, 661 courtyard holes, 279,930 vertices. Heights to 1 m, year to
  the decade, Shapely `simplify(0.5)` then a 0.5 m grid, Morton order, three
  streams (metadata varints; X and Z zigzag-varint deltas that run across
  building boundaries), gzip -6 with `mtime=0`. 770 KB raw → **441 KB gz,
  11.8 B per building, 1.6 B per vertex.** Browser: top-level-await fetch,
  gzip magic sniff → `DecompressionStream`, strict decode (magic, offsets,
  count bound, varint length, leftover bytes all throw). Not cut into cells in
  the file; cells (1 km, 288) are made at mesh build.
- **Geometry (`js/building-footprints.js:24-100`).** One quad per footprint
  edge from y 0.22 (kerb) to the roof, roof by `ShapeUtils.triangulateShape`.
  Merged per 1 km cell per material (5 materials by year: <1945 limestone 80 %
  / red brick 20 %; <1980 limestone 55 % / bronze glass 45 %; else teal 60 % /
  silver 40 %). **No UVs.** Two attributes: `box` = (wallWidth, height,
  exposedHeight, seed) where `floor(seed)` is the building id and
  `fract(seed)` 0.1–0.9 a tone, and `facadeWall` = (u along the wall, metres
  below the top, wallKind shop/front/rear/lotLine). Only the first chunk
  compiles; the rest carry `userData.sharesPipelineWith`.
- **Party walls (`:5-21`).** Three probes (t 0.15/0.5/0.85) 1 m outside each
  edge; all three inside a neighbour → `lotLine`, blank brick, exposed height
  = top − tallest neighbour. Masonry ≤ 60 m only, 128 m reserve grid. A
  corner touch keeps the windows (tested).
- **Facade shader (`js/tsl-materials.js:395-480, 850-1195`).** `bays =
  round(wallWidth / windowWidth)`, `gridU = u·bays + wallSeed`, storeys from
  world y / floor height, a solid parapet for a partial storey, coping 0.32 m,
  corner piers; ground floor by kind (storefront glazing / solid + entrance /
  common brick / blank brick with parging). Colour composes running-bond brick
  with per-brick tint (faded once a brick is ~1 px), a band course every 6
  floors, double-hung sash bars, sills, lintel and jamb shading, AC units on
  12 % of cells, soot, a warm canyon-bounce band 0–75 m, bump relief fading
  with distance, interior-mapped rooms 2–3 bays wide with curtains, parallax
  and per-room lamps, ghost signs on lotLine walls sized to the exposed
  height (glyphs from hashed strokes, no texture), storefront modules ~7.5 m
  (door, display, transom, kick plate, a sign from an 8-label canvas atlas,
  a 3.6 m 2D interior), entrances one per ~28 m. Every periodic term goes
  through `filteredPulse` (`:148-155`), an exact box filter of a periodic
  step over `fwidth`, so window grids settle to their mean coverage instead
  of moiré; `distantWindowLight` (`:166-187`) clusters lit windows into
  power-of-two 1–2 px blobs with world-anchored cross-fading scales.
- **3D details (`js/building-details.js`, `js/buildings.js:312-376,
  494-836`).** Placed once on the CPU into a quadtree with a reserve grid:
  cornices on the 16 longest edges, water towers (25 % of masonry ≥ 14 m),
  HVAC 35 %, awnings/sheds ~1 per 10 m at 22 %, fire escapes (year < 1945,
  ≤ 30 m, ≥ 3 floors). Streamed after 18 m of movement, 560 m radius,
  nearest first, into fixed pools (cornices 7,000, towers 1,400, HVAC 1,600,
  awnings 1,800, sheds 300) uploading only the used prefix
  (`addUpdateRange(0, count·itemSize)`). ~13 instanced draws + 17 fire-escape
  buckets. Fire escapes: one merged geometry, per-instance (storey height,
  total height) stretches planes and collapses unused storeys to a point in
  the vertex stage; ironwork is an alpha mask; the near bucket (115 m) casts
  shadows, 16 far cells do not.
- **Landmarks (`js/landmarks.js`).** ~12 hand-built groups, `fitToSite`
  scales to real height and the OSM outline's bounding box (≤ 1.06× width);
  their `BoxGeometry` parts are re-emitted as instanced facade boxes so they
  get the same bay layout. Survey footprints under a landmark are dropped.
- **No mesh LOD.** Detail fades by pixel footprint inside the shader; detail
  pools exist only within 560 m. Every roof is flat. Materials come from the
  year alone. Landmarks fit a bounding box, not the footprint.
- **Collision (`js/building-collision.js`).** One collider per polygon
  {AABB, maxY, polygon}, 48 m lazy grid; circles by nearest edge with sign
  (≤ 4 iterations); cars by per-edge slab clip and the shortest escape vector
  that clears the whole outline (no catching on internal seams);
  `polygonSegmentFraction` for audio occlusion through courtyards.

## 2. Rendering, culling, lighting, loading

- **Culling (`js/scene-culling.js`).** Instanced meshes with ≥ 64 instances,
  ≥ 40k triangles and radius ≥ 1,500 m are cut into per-cell `InstancedMesh`es
  sharing index, attributes and material (one pipeline). Cell =
  `clamp(cullDist·0.5, 250, 600)` m; cull distance per mesh =
  `max(300, size90th · 1100)` m (×3 for glowing materials); bigger things are
  cut at 1 km for frustum culling only. Per frame: a flat `d² < maxDist²`
  loop. `scene.matrixWorldAutoUpdate = false`, only listed dynamic roots
  update (`js/main.js:177-186, 714`).
- **Trees (`js/trees.js:806-1210`).** 200 m cells, one `InstancedMesh` per
  species × variant × LOD (3×2×3), bands < 105 m / < 420 m / up to 950–3,000 m
  by tier with 6 m hysteresis; update only after 4 m of camera movement; a
  cell wholly inside one band is set uniformly, only straddling cells test
  trees; dirty cells repack with `addUpdateRange`; empty cells
  `group.visible = false`. Static buffer usage on purpose
  (`DynamicDrawUsage` re-uploaded ~7 MB a frame across two cascades + main).
- **Shadow stand-ins (`js/scene-culling.js:202-338`).** Large static casters
  get position-only copies re-cut into 500 m cells with one black basic
  material per side setting, on a layer only the cascade cameras enable; the
  originals stop casting. Commit c4ab18f: 35–50 shadow draws a frame saved
  because 283 of 288 cells had been drawing the full facade shader into both
  cascades. Lamp posts cast with 16 triangles instead of 120 (~500k shadow
  triangles). **WebGL caveat (verified in three 0.185.1,
  `WebGLShadowMap.js:511`): the shadow pass tests `object.layers` against the
  main camera's layers, so a shadow-only layer needs a manual
  `shadowMap.render` with the layer toggled, or `onBeforeShadow`/
  `onAfterShadow` (present in 0.185.1).**
- **Materials (`js/tsl-materials.js`).** ~130 node-material constructions
  but styles are uniforms, not defines: "every masonry style compiles to one
  shader" (`:879`), cached by an options string. One tree, one road, one
  sidewalk, one paint material. Variety from `positionWorld.xz`, per-vertex
  or per-instance seeds, `hash2D`, value noise. No surface image textures.
  Asphalt (`:1867-2042`): wear noise at 0.045 (~25 % worn), Voronoi
  alligator cracks only inside `If(worn && px < 0.04)`, utility patches on
  11 m cells (50 %), potholes 7 m, tar snakes, oil, manholes 14 m; wetness as
  a threshold over noise, puddles roughness 0.1. Sidewalk (`:2113-2244`):
  1.524 m flags, 6 mm joints, per-flag tone, 1 in 7 replaced, 1 in 8
  cracked, heave tilt in the bump, gum on 0.32 m cells. Water
  (`:2691-3044`): a 256² CPU FFT slope/variance tile sampled 4× at 61/23.3/
  8.7/3.3 m, mip variance → roughness (LEAN), a night skyline raycast inside
  `If(night > 0)`. Road paint (`:2044-2111`): per-quad (u, period, duty),
  vertex-stage widening to ≥ 1.5 px with opacity ÷ widen, box-filtered dashes,
  fade 1,300–1,650 m.
- **Light (`js/lighting.js`).** Four presets (golden, midday, twilight,
  midnight): sun, hemisphere, Preetham sky, fog density, shared uniforms
  (interior glow, wetness, canyon bounce). Fog colour = the sky PMREM sampled
  at roughness 0 along the view direction with elevation ≥ 0.015, density
  height-integrated (`createAerialFogNode`, `:223-239`). Analytic canyon AO
  0.44 at street level → 1 at 68 m. `SunLight` with 2 cascades in one atlas
  (3072² tiles if the device allows, else 2048²), far 300 m at street level
  to 720 m aloft. `ClusteredLighting(256, …)` (WebGPU) feeding fixed pools:
  36 street spots, 48 points, 28 storefront spots, ranked by distance with a
  behind-camera penalty, faded 62–100 % of cutoff, unused lights parked at
  y −1000. Post: MRT normals + metal/rough, half-res SSR, half-res bloom with
  a peak clamp of 8, split-tone grade, 12 % vignette, ACES once.
- **Loading (`index.html`, `js/main.js:38-50, 589-665`).** `preconnect`, an
  import map, ~47 `modulepreload`s before the stylesheets, `preload
  as=fetch` for the two `.bin.gz`; `tests/boot.test.cjs` enforces the order.
  Stages yield (rAF + `setTimeout(0)`, 100 ms timeout for hidden tabs) and
  log one `[init]` timing line. Precompile: one empty frame so the post chain
  configures targets, then one representative per pipeline
  (`sharesPipelineWith` skipped) through 16 concurrent `compileAsync` jobs
  with a "N / M" progress bar, then a warm-up frame with culling off so the
  shadow variants compile, then `onSubmittedWorkDone` before the loader hides.
- **Mobile.** `setPixelRatio(1.0)` for every device; no quality tiers; the
  only coarse-pointer check is audio voice limits.

## 3. Movement, camera, controls, traffic, pedestrians, audio

- **Car (`js/controllers.js:37-65, 1159-1250`).** Kinematic bicycle model,
  `steps = ceil(dt·120)` substeps, every response `1 − exp(−k·step)`.
  **Test: 30/60/120/144 Hz paths agree within 10 cm, 0.01 rad, 0.05 m/s
  (`tests/controllers.test.cjs:382`).** Lock: `turn = L·cornering (2.76·10.5)`,
  `maxSteer = atan(turn / max(v², turn / tan 0.60))`, eased 10/s; yaw target
  `v·tan δ / L` clamped `grip/|v|`; friction circle `grip = sqrt(9.5² −
  a_long²)`; momentum not rotated with the chassis, slip removed 4/s; braking
  against motion is a handbrake. Building hits: push-out + 0.42 reflected,
  head-on bounce −0.25 v, glancing speed × (1 − 0.62·headOn) + yaw kick.
- **Cyclist (`:43-46, 1252-1288`).** Arcade: 19 m/s top (68 km/h), constant
  2.15 rad/s yaw whatever the speed (do not copy), lean
  `−turn · min(1, |v|/9) · 0.34` eased 9/s, wheel 0.35 m, cadence
  `pedalPhase += wheelDelta / 3.2` only under throttle (freewheel), rider
  IK to grips and pedals, skipped when unchanged.
- **Touch (`js/touch-controls.js`).** One 136 px stick bottom-left, knob
  44 px, radial dead zone 0.15 rescaled; y throttle, x steer; no smoothing;
  not split on touch (the gamepad is: stick x only, triggers throttle/brake,
  commit 67ef6be). Per-source input maps (keyboard/touch/gamepad) blended by
  `max`; reset on blur/resize/visibilitychange; touch UI on
  `(any-pointer: coarse)` or the first `pointerType === 'touch'`; controls
  `preventDefault` + `stopPropagation` + `setPointerCapture` so the canvas
  orbit never sees them (tested, `tests/cameras.test.cjs:84-220`).
- **Camera (`js/cameras.js:191-208, 333-352`).** First-order smoothing
  `k = 1 − exp(−8.5·dt)` applied to the **offset relative to the entity**
  (a world-space follower trails by speed·dt and surges on uneven frames);
  only y eased in world space. Distance `base · zoom · (1 + min(0.25,
  0.01·v̄))` + 0.1·v̄ lag; look target 5.2 m ahead; car 6.9/2.12 m, bike
  4.8/2.05 m; never below y 0.55. Yaw follows the heading directly: **no dead
  band, no rate cap, no building avoidance.** Orbit decays 2.2/s after a 4 s
  timer, only while moving. 11 presets (chase FOV 56, action 60, pov 68, 7
  scenic, 1 drone orbit).
- **Traffic (`js/road-network.js`, `js/traffic.js`).** Lanes = lateral
  offsets of the centreline, blocked lanes dropped; L/S/R movements, no
  U-turns, non-crossing lane assignment; cubic Bézier connectors (handles
  0.552·d, 17-entry arc table, max curvature); **only the largest strongly
  connected component is kept, so no car reaches a dead end.** IDM (a 2, b 3,
  T 1.2, s0 2, 70 m look-ahead), bend speed `sqrt(3.5/κ)`, MOBIL lane changes
  every 0.4–0.7 s, Frenet (s, lateral) state, Stanley steering through
  simulated front wheels (commit 17c0973). One global 60 s signal cycle
  (avenue 0–26 green, street 30–56; WALK first 7 s). Player dodge: swept
  threat over 1.8 s, reaction 0.6–1.0 s, commit ≥ 1.2 s, brake/floor/swerve
  2.2 or 1.2 m where clear; the player is an IDM leader. 200 cars + 12 buses
  all simulated every frame (no sim LOD); recycled beyond 380 m, 4 respawn
  attempts a frame at 100–350 m out of view; full model < 90 m, ~250-tri proxy
  beyond.
- **Pedestrians (`js/pedestrian-system.js`, `js/pedestrian-routes.js`).**
  340 within 320 m; sidewalk tracks 1.7 and 2.8 m beyond each road edge;
  detours only when blocked, cached per edge; crosswalks only at signalised
  nodes; greedy legs to a goal re-chosen every 120–300 s; curb queues 0.62 m;
  per-person WALK reaction 0.2–1.5 s; 15-bone poses in a **storage buffer
  (WebGPU only)**; near LOD ≤ 34 m casts shadows; off-screen < 50 m advance
  the gait without solving bones, > 50 m skip the rig.
- **Audio (`js/audio-*.js`).** Fully procedural, no files: baked four-stroke
  engine buffers with two RPM banks crossfaded, a 5-ratio gearbox; **a bicycle
  voice of tyre hiss, a freewheel ratchet only when coasting and chain
  friction only when pedalling, tied to the 0.35 m wheel (~60 lines + two
  buffers)**; wind from two noise channels gust-modulated, sheltered by
  street enclosure, rising with speed; horns, crashes, footsteps on
  foot-phase wrap, WALK ticks. Every `AudioParam` k-rate, params at 10 Hz,
  HRTF panners, Doppler via playbackRate, voice limits 6/1/5 on coarse
  pointers; occlusion by three rays through the collision grid (no mesh
  raycasts), obstruction `1 − exp(−0.45 d)`, enclosure from 8 rising probes
  into one shared 0.7 s synthetic reverb.

## 4. Geodata, streets, tests, process

- **Frame (`tools/geo-base.mjs:23-50, 273-318`).** Local tangent plane in
  metres rotated 29.02°, the length-weighted median avenue bearing measured
  from the data; the Python builders import the JS `toWorld` through node and
  fit an affine from three probes, so there is one projection.
- **Fetching.** Raw inputs committed (~15 MB); `tools/overpass.sh` rotates
  three mirrors, 12 tries with back-off, writes to `mktemp`, validates with
  node (parses, has `elements`, no `remark`), then `mv`; the stub-curl test
  matrix proves every failure leaves the previous file byte-identical. Tree
  and building snapshots are not committed; their SHA-256 sits in the
  generated module header.
- **Output.** `js/nyc-geodata.js` one ESM JSON, coordinates to 0.1 m,
  **1.13 MB raw / 394 KB gz** (blocks 432 KB for 2,691; roads 218 KB for
  3,246 polylines; road graph 117 KB for 2,144 nodes / 3,030 links with
  interned names). Trees `NYT1`: 70,680 points, Morton-sorted, zigzag-varint
  deltas on 0.5 m, **123 KB**. RDP per layer 0.4–1.6 m (6–8 m for the other
  boroughs).
- **Blocks and sidewalks by raster (`tools/geo-blocks.mjs`).** Erode the
  bulkhead 20 m (exact EDT), stamp every at-grade roadway on a 1 m raster as a
  capsule of half the curb-to-curb width (defaults 18 m avenues, 9.1 m
  streets), label 4-connected components (curb islands), corner-walk trace +
  `destair` + RDP 0.5, square erosion by 4.6 m for the sidewalk, greedy
  largest-rectangle lot fill (≤ 8, 93 %), irregular blocks re-rasterised per
  dominant edge direction. Runtime curbs: two unit-box `InstancedMesh`es for
  rectangular blocks (curb 0.17 m, slab inset 0.25 m, top 0.22 m).
- **Shoreline (`tools/geo-base.mjs:350-372`).** Rasterise the borough polygon
  at 2 m, subtract piers grown 4 m, open 9 m, close 5 m, largest component,
  trace, RDP 1.6 m → 687 points; `getIslandBoundsAtZ` 2 m lookup for an O(1)
  on-land test.
- **Drivable network from the rendered ground (`js/road-network.js`).**
  Avenue corridors from the modal curb gap in 2 m samples; lanes from the
  half-width (≥ 10 → 5 lanes at 3.6 m, ≥ 8.5 → 4, ≥ 6.8 → 3, ≥ 4.4 → 2);
  junctions union-found under 14 m (merges divided roads and offset corners),
  snapped within 12 m; bends > 12° become shape nodes; dead ends pruned to the
  largest SCC. Road paint is generated from the network edges (same-direction
  dashes 0.13 m, 12 m period, 25 % duty; double yellow only where
  `isRoadClear`; stop bars 0.45 m; continental crosswalks 2.5 m deep, 1.2 m
  period) and chunked at 1.2 km.
- **Placement predicates (`js/street-details.js`).** All through `blockAt`
  (64 m grid point-in-polygon): `isOnCurbIsland` = point + four 0.55 m probes
  in a non-median block; `isOnSidewalk` adds < 60 % park and > 1 m from a
  plaza; `isClearOfPoles` 6–6.5 m via an 8 m hash; signal masts only where
  the arm overhangs road; streetlight heads must land over road; carts by a
  ring search 2–40 m; surveyed trees snapped 0.9 m in from the curb,
  corrections > 3 m rejected, pit 1.7 × 2.6 m wholly in one block, dedup 3 m;
  subway entrances by spiral search on a 0.75 m grid, never across a street.
  Every prop registers a footprint that the network and pedestrians avoid.
- **Tests.** Plain `node:test`, 28 files, ~191 tests, 60 of 147 commits
  touch tests. `tests/helpers/module.cjs` regex-rewrites ESM imports into a
  `vm.runInNewContext` call with mandatory per-specifier stubs, so untyped
  production functions run unchanged without three. `geodata.test.mjs` runs
  the whole build in a temp dir (spaces and CJK in the path) and pins
  `blockAt(-575, -225) === null` (Times Square plaza). `teleports.test.cjs`:
  every HUD destination is off-block, ≥ 8 m inside the shore and within a
  road's half-width. Perf as tests: chunking, shared pipelines, "zero uploads
  after warm-up", derivatives never inside a branch (WGSL uniformity, 772
  lines). `facade-projection.test.cjs` evaluates TSL slices with a numeric
  fake node rounding through `Math.fround` and proves a 45° wall keeps one
  window axis over 720 yaws. No headless whole-scene boot; `boot.test.cjs`
  parses `index.html`.
- **Process.** ~66 feature/content, 28 fix, 27 perf, 26 cleanup commits;
  generator, regenerated artefact and regression in one commit; authored
  coordinates migrated with a piecewise-linear `fromOldFrame`; three bumped
  in dedicated commits, one removing workarounds after an upstream fix.
