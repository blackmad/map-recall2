# Engine programme: one frame, one world model (2026-10-30)

The user asked (2026-10-30): we still have performance and rendering issues;
should we make larger architectural changes so the engine is more like a game
engine, less hand-written, less MapLibre, so performance is good without
constant worry? Answer: yes. This is the execution programme. It supersedes the
pace question on issue #107 and the lane-A brief's long-lived-branch rule.

Decisions (user, 2026-10-30):
- **Delivery:** a second implementation behind the existing `VectorMap` facade,
  flag `?engine=own`, weekly flag-gated steps on main. `vector-map.js` is frozen
  to fixes from P1 and deleted whole at the flip.
- **Scope:** all of MapLibre goes: ride, overview, route preview, the Leaflet
  picker. Other cities get own-map extracts.
- **Devices:** no real-device rides for now; gates use the iPhone/Android
  emulator profiles and the SwiftShader weak-GPU proxy (risk recorded below).
- **Delete** the Google photoreal tiles layer and spike.
- **Content lanes keep merging** through P2/P3; each integration runs
  `world:compile --changed` and the integrator publishes the staged cells.

## Why a programme and not another perf lane

October's perf lanes (desktop 10-13/10-14, motion stutter and pop-in 10-16,
phones 10-23/10-24, touch triangles #100) each bought a measured improvement and
each left the same three causes in place:

1. **No frame ownership.** MapLibre owns the GL context, the camera (`jumpTo`
   every frame, Mercator, pitch cap), cadence and context loss; three.js is a
   guest in two custom layers (`rendererShared/sharedFrame.ts`). Two rAF loops
   (`game.js:244` and MapLibre's). 1.5–2 ms a frame of MapLibre overhead outside
   its style layers; the Liberty basemap drawn full-screen *under* the own ground
   (overdraw on fill-rate-bound laptops: "fine on my M4, too slow on their
   computers"); 94 MB of MapLibre workers on phones; pinned at 5.24 with
   `mapGuard.ts` as a stopgap for upstream #8607; `isWater` and rider cover via
   `queryRenderedFeatures`; buildings pushed to a MapLibre GeoJSON source only so
   queries work (`sendToSource` is a top stutter owner); camera maths in ~8
   places; three pickers in separate clip spaces.
2. **The world is computed at runtime, in parallel models.** GeoJSON z14 tiles
   parsed on the main thread (`buildingTilesBrowser.ts readGzippedGeoJson`),
   roof-planned, decorator-styled and regrouped at runtime
   (`threeBuildingsBrowser.ts` `planRoof`/`decorate*`/`setFeatures`), then fed to
   both MapLibre and the chunk worker. Whole-city roads in heap at ride start
   (47 + 43 + 23 MB). Six streamers with six residency policies. Every stall
   left in `docs/perf-motion-stutter-20261016.md` is this runtime work.
3. **No engine-level quality tiers or budgets.** `renderGovernor.ts` only steps
   down; perf is measured on an M4 with CPU throttling.

What this does not buy: the M4 is already vsync-bound, so the win there is
stalls, heap and startup, not fps; weak-GPU fill rate moves only with tiers
(P4); spoiler rules, labels, overview cartography and context loss become our
code (tests exist: `ownMap.test.ts`, `no-maplibre.spec.ts`).

Evidence: `docs/archive/research/own-renderer-spike-20261009.md`,
`docs/research/drop-maplibre-20261010.md` (own map within 1.1–3.2 px of
MapLibre's cameras, 1.9 ms desktop frame CPU), `docs/handoffs/slop-newyork-plan-20261029.md`,
`docs/performance/desktop-20261014.md`, `docs/perf-motion-stutter-20261016.md`,
`docs/perf-pop-in-20261016.md`. Verified seams: `sharedFrame.ts` touches MapLibre
only at its custom-layer driver (`type:'custom'`/`onAdd`, `mainMatrix`); game code
reaches `vectorMap.map` directly only at `game-route.js:174,1963` and
`feedback/browser.ts:69,98,149`; `VectorMap` has 56 public methods; 101 spec and
script files read `vectorMap.map` as their oracle.

## Target

- **One frame host** `src/canalRecall/engine/frameHost.ts`: one canvas, one
  `WebGLRenderer`, one rAF with a fixed-step accumulator (lane E's substeps run
  inside it; `game.js _loop` becomes `engine.tick`); context loss and restore
  owned here. `SharedFrame` gains `drive(frameMatrices)`; the MapLibre custom
  layer is the second driver until deleted. Participants render unchanged.
- **One camera** `ownMap/mapCamera.ts` (`CameraState`, `cameraFrame`,
  `easeCamera`) exposed as `vectorMap.camera = {project, unproject, center,
  zoom, bounds, pitch, bearing}`; every other camera maths deleted.
- **One world model**: a build-time compiler emits per-cell binary streams on
  the own-ground 1 km `i_j` grid with strict decoders; one `WorldStreamer` with
  one residency/look-ahead/upload budget and one worker pool.
- **One material system** with a program budget; shader facades for the
  ordinary ring (lane B); instanced kits; shadow stand-ins and size-based
  culling (lane D).
- **Quality tiers** {low, mid, high} from a startup probe; the governor steps up
  and down inside a tier.
- **Perf as CI gates**: counts hard (draws, programs, triangles, uploads after
  warm-up), times soft on one fixed machine.

## Phases

### P0 — Seams, deletions, budgets (week 1)
- `engine/worldViewApi.ts`: typed interface of the ~56 `VectorMap` methods the
  game uses; `vector-map.js` conforms via JSDoc.
- Close leaks: `game-route.js:174` → `aimAtWorld`; `game-route.js:1963` and
  `feedback/browser.ts` → `worldView.captureFrame()` / `center()`.
- `vectorMap.camera`; migrate the 101 specs/scripts from `.map.` to `.camera.`.
- Delete: `studyFacadesBrowser.ts`, `studyRoofsBrowser.ts`, `studyTreesBrowser.ts`,
  `studyPublicRealmBrowser.ts`, `_updateStudyAreaResidency`; `google-tiles-source.js`,
  `google-tiles-spike*`, `setGoogleTilesEnabled`, the `canal:google-tiles-config`
  build step; the legacy `_makeLayer` branches in every participant and
  `SHARED_FRAME_DEFAULT` (the shared frame is already forced on by own ground).
- `tests/perf/budgets.json` + `scripts/perf-gate.mjs` wrapping
  `ride-perf-owners.mjs`, `motion-stutter.mjs`, `pop-in.mjs`; baselines recorded.
- Freeze rule from P1: `vector-map.js` takes fixes only; new behaviour goes to
  a typed module both implementations call (rider cover, camera clearance,
  `inspectBuilding` are lifted first).

### P1 — Engine owns the frame behind `?engine=own` (weeks 1–4)
`engine/frameHost.ts`, `engine/ownWorldView.ts` implementing `WorldView`, chosen
in `game.js`. Reused as is: `ownMap/mapCamera.ts`, `gestures.ts`, `layers.ts`
(overview + far field), `labels.ts` + `labelPolicy.ts` (replacing
`labels/labelOverlay.ts`), `geometry.ts PolygonGrid` (`isWater`),
`coveredPassage.ts`, `ownGround/gameGround.ts` + `farRing.ts`, `prismPick.ts`,
`renderGovernor.ts`. New `engine/overlays/`: route, active street, cycle tracks,
transit, neighbourhood lines, active landmark, ferry pins. Re-port from
`render/drop-maplibre-step1-20261010` one commit at a time: the
rail/footway/landuse/pier overview extract, the own picker replacing Leaflet,
the footprint worker. Extracts for Utrecht/Rotterdam/Den Haag.

### P2 — World compiler v1 behind `?world=v1` (weeks 2–5, parallel)
Absorbs lane C. 1 km cells keyed like `roads-v1/cells.json`;
`world-v1/cells/<i>_<j>.bin` + `world-v1/index.json` (bounds, stream offsets,
source SHA-256s, compiler version); `src/canalRecall/world/cellFormat.ts` with
strict decoders. Streams: FOOT (footprints 0.1 m, Morton, zigzag-varint, pand id
table, eaves/ridge 0.25 m, year), ROOF (serialized `RoofPlan`), STYL (palette,
wall material, window kind, kit id, front/shopfront/monument-gable/kit-roof
flags), GRP (group + party-wall neighbours), HIDE (ids hidden by models), LMRK
(model id, transform, LOD URLs, bounds), WATR (water polygons + level +
`PolygonGrid` buckets), ROAD (centrelines with BGT widths, class, bridge
flags), TREE, LABL (POIs, neighbourhood points, normalised spoiler keys; the
decisions stay runtime in `labelPolicy.ts`). `three-buildings-worker` reads
cells directly. `npm run world:compile -- --changed` hashes inputs per cell,
writes `artifacts/world/staging/` with a diff report; the integrator publishes.
Rule: a new kit attribute = a STYL field + version bump + decoder test;
byte-identical output when absent. Deleted after the flip: `building-tiles/`,
`bag-tiles/` (34 MB), `municipal-trees` tiles, `buildings-colored.geojson`.

### P3 — One streamer, one worker pool, road graph as CSR (weeks 4–6)
`engine/worldStreamer.ts` (one cell priority queue from `viewResidency.ts`,
`streamingLookAhead.ts`, `landmarkResidency.ts` budgets; one upload budget per
frame; one worker pool of min(cores − 1, 3)). `streets-routing.json` and the
segment geometry become a compiled CSR binary read without objects. Deleted:
`chunkBuildQueue.ts`, `ownGround/residency.ts`, `rendererShared/residency.ts`,
tree streaming in `inventory-trees-source.js`, the building tile streamer, the
second own-ground worker instance.

### P4 — Materials, shadows, culling, tiers (weeks 5–8)
Lane B shader facades (reads FOOT + STYL; measured colours kept; strips at
60/150/400 m). Lane D shadow stand-ins, size-based cull, frozen matrices,
pipeline precompile with progress. Governor tiers. One material registry with a
program budget.

### P5 — Flip and delete
`?engine=own` and `?world=v1` default; delete `vector-map.js`,
`_waitForMapSettle`, `maplibre-gl` + Leaflet from `index.html`/`package.json`,
`mapGuard.ts`, `labels/labelOverlay.ts`, `mapHealthBrowser.ts`, `mapStyle.ts`,
the MapLibre parts of `streetOverlayStyle.ts`, the custom-layer driver in
`sharedFrame.ts`, `park-landscape.js` MapLibre layers, `basemap-hide-ids.json`
and the basemap-duplicate machinery; `no-maplibre.spec.ts` becomes the main
spec.

## Gates (emulator + SwiftShader)

| Phase | Gate |
|---|---|
| P0 | Baselines in `budgets.json`: draws 851, programs 32, desktop heap at ride start, time-to-ride 7.5 s, iPhone profile heap 245 MB / ArrayBuffers 67 MB / GL buffers 140 MB / MapLibre workers 94 MB, `MOTION_BUDGET {200,1,4}`; all specs green on `.camera`; `check:canal` green. |
| P1 | Camera parity ≤ 3.2 px on the intro path and Anne Frank → Rijksmuseum; `look-consistency`, `start-heading`, `open-squares`, `labels`, `answered-street-name`, `intro-perf`, `context-restore` green desktop + iPhone under the flag; draws ≤ 700; programs ≤ 32; MapLibre workers 0 MB; main-thread frame CPU median ≥ 1.5 ms below default (in-page A/B). |
| P2 | Buildings ≤ 4 MB gz (from 34 MB); cell decode ≤ 5 ms in the worker at 4×; `motion-stutter.mjs`: no streaming-attributed task > 16 ms (1×) / > 50 ms (4×); sentinel pands pinned; `three-buildings-ab.spec.ts` strips identical. |
| P3 | Desktop heap at ride start ≤ 500 MB; iPhone profile JS heap ≤ 160 MB; time-to-ride ≤ 4 s; `pop-in.mjs`: zero cells installed within 150 m of the rider; road graph heap ≤ 30 MB. |
| P4 | Programs ≤ 24; draws ≤ 400 at 60° pitch; iPad triangles ≤ 700k; 0 shader compiles and 0 uploads > 1 MB after warm-up; `weak-gpu-perf.spec.ts` low tier p95 ≤ 33 ms; likeness strips accepted. |
| P5 | Android emulator PSS ≤ 900 MB; Sentry CANAL-RECALL-7/J per ride ≤ the prior week after a staged rollout; a `needs-david` issue for the flip stating the real-device gate was deferred. |

New counters on `__canalPerf`: draws, programs, triangles, `texImage`/`bufferData`
bytes per frame, shader compiles after warm-up, heap at ride start,
time-to-ride, worker heap.

## Lanes

| Lane | Brief | Files | Days | Model |
|---|---|---|---|---|
| L0 integrator | this doc | `game.js`, `index.html`, `package.json`, bundles, flags, budgets baselines, cell publishing, TODO/HISTORY, issues | ongoing | opus |
| L1 engine host (#129) | `lane-engine-host-20261030.md` | `src/canalRecall/engine/*`, `rendererShared/sharedFrame.ts` (sole owner), `ownMap/*`, participants' shared paths | 12–15 | opus |
| L2 oracle migration + P0 deletions (#128) | `lane-oracle-migration-20261030.md` | `tests/e2e/*`, `scripts/*` readers, study/Google files, `vector-map.js` only for `camera` and deletions | 3 | haiku |
| L3 world compiler (#130) | `lane-world-compiler-20261030.md` | `scripts/world/*`, `src/canalRecall/world/*` | 8–10 | opus format, haiku runs |
| L4 streamer, pool, road CSR | (after L3) | `engine/worldStreamer.ts`, `threeBuildingsWorker.ts`, `ownGround/groundWorker.ts`, `routing/*` | 8 | opus |
| L5 overlays + labels | (after L1 host) | `engine/overlays/*`, `ownMap/labels.ts`, `labelPolicy.ts` | 5 | opus |
| L6 facade shader | `lane-facade-shader-20261029.md` (after FOOT/STYL) | `litFacadeMaterial.ts`, new facade material files | 7–10 | opus |
| L7 shadows, culling, loading | `lane-shadow-standins-culling-20261029.md` | `lightRig.ts`, `shadowFit.ts`, `compileBudget.ts` | 5 | opus |
| L8 driving feel (#131) | `lane-driving-feel-20261029.md` | typed physics substep, `cameraYaw.ts`, `camera.js` | 4 | opus |

Order: L2 first (week 1); L1 + L3 + L8 in parallel; L4 and L5 once L3's format
and L1's host exist; L6/L7 after L4. Lane F (ground raster) stays a spike.

## Risks
- Double maintenance during P1 (freeze rule; keep P1 to ~3 weeks).
- Gates can be green while real phones still crash (no real-device rides for
  now); the flip issue says so; staged rollout watches Sentry context-loss.
- Losing the Liberty basemap loses rail/tram/landuse until the overview extract
  re-port lands (P1).
- Compiled cells add a build step to content merges: SHA assertions at runtime
  and a `?world=live` dev fallback until P5.

## Verification
Every lane: `npm run lint`, `npm run check:canal`, named specs under
`/tmp/canal-pw.sh` with a private `PW_PORT`, desktop and iPhone projects. Every
step: in-page A/B (`?engine=own` vs default, `?world=v1` vs default) via
`scripts/ride-perf-owners.mjs AB_ON/AB_OFF`, `scripts/motion-stutter.mjs`,
`scripts/pop-in.mjs`, `tests/e2e/phone-memory.spec.ts`, `weak-gpu-perf.spec.ts`;
frozen-frame pixel checks (`scripts/perf-frozen-frames.mjs`) for "no visible
change" steps. `scripts/perf-gate.mjs` records every gate number into
`budgets.json`; the integrator posts the before/after table on issue #68 after
each round.
