# Lane L1: the engine owns the frame (`?engine=own`)

Rules: `LANE-RULES.md`. Programme: `engine-programme-20261030.md` (read §Target
and §P1 only). Model: opus. Replaces the delivery shape of
`lane-three-owns-frame-20261029.md`: not edits to `vector-map.js`, not a fresh
page, but a **second implementation behind the existing `VectorMap` facade**.
`vector-map.js` is frozen to fixes; you do not edit it except to add the
`WorldView` JSDoc conformance line. The user decided this on 2026-10-30.

## The seam (verified)

- `rendererShared/sharedFrame.ts` touches MapLibre only at its custom-layer
  driver (`type:'custom'` / `onAdd` ~l.309, `defaultProjectionData.mainMatrix`
  ~l.418) and through `frameMath.ts` Mercator wrappers. Give it a second driver
  and every participant renders unchanged.
- Game code reaches `vectorMap.map` directly only at `game-route.js:174,1963`
  and `src/canalRecall/feedback/browser.ts:69,98,149`. Everything else goes
  through ~56 public `VectorMap` methods (`sync`, `setRoute`,
  `setActiveLandmark`, `setStreetHighlights`, `isWater`, `screenToWorld`,
  `projectWorld`, `inspectBuilding`, `setPlayer*`, `aimAtWorld`, …).
- `src/canalRecall/ownMap/mapCamera.ts` already reproduces MapLibre's camera
  model within 1.1–3.2 px (`docs/research/drop-maplibre-20261010.md` §3).

## Build (land each step on main behind the flag; hand back after each)

1. **Interface.** `src/canalRecall/engine/worldViewApi.ts`: the typed
   `WorldView` interface from the public methods of `VectorMap` that
   `game.js`, `game-route.js`, `hud.js`, `presentationRuntime.ts`,
   `recallRuntime.ts`, `landmarkRuntime.ts` and the overlay call (grep the
   call sites; list the ones you leave out and why). Include
   `camera: {project, unproject, center, zoom, bounds, pitch, bearing}` and
   `captureFrame()`. Report the two `game-route.js` leaks and the feedback
   leaks as exact replacement lines for the integrator (you do not edit
   `game.js`; `game-route.js` and `feedback/browser.ts` you may edit).
2. **Frame host.** `engine/frameHost.ts`: one canvas, one `WebGLRenderer`, one
   rAF loop with a fixed-step accumulator (`tick(dtFixed)` hook for lane E,
   `render(alpha)`), context loss/restore (move the semantics from
   `sharedFrame.ts` l.176–213 and the `mapGuard` one-shot Sentry report), the
   render governor attached (`renderGovernor.ts`). `SharedFrame.drive(matrices)`
   so the host drives it; the custom-layer driver stays until P5.
3. **Own world view.** `engine/ownWorldView.ts implements WorldView`, chosen in
   `game.js` by `?engine=own` (report the 3-line `game.js` change for the
   integrator). Camera from `ownMap/mapCamera.ts` (`CameraState`, `cameraFrame`,
   `easeCamera` for the intro flight and `aimAtWorld`); ground everywhere from
   `ownGround/gameGround.ts` + `farRing.ts`; overview/far field from
   `ownMap/layers.ts` with the own-map extract; `isWater` from
   `ownMap/geometry.ts PolygonGrid` over the overview water (regression:
   Singelgracht at the Da Costagracht mouth); rider cover from
   `coveredPassage.ts`; picking from `prismPick.ts` / `inspectAtScreen`;
   labels from `ownMap/labels.ts` + `labelPolicy.ts` (the DOM
   `labels/labelOverlay.ts` is not used under the flag). Lift the MapLibre-free
   logic out of `vector-map.js` into typed modules both implementations call:
   rider cover (~l.3153), camera clearance (~l.3258–3360), `inspectBuilding`
   (~l.2556). Under the flag `maplibregl` is never constructed.
4. **Overlays.** `engine/overlays/`: route (gradient + casing), active street,
   cycle tracks, transit corridors, neighbourhood dashed lines, active
   landmark, ferry pins/labels as meshes or label entries. Under own ground the
   route and question street already drape (`routeRibbon`); reuse.
5. **Re-port** from the local branch `render/drop-maplibre-step1-20261010`
   (`/usr/bin/git log main..render/drop-maplibre-step1-20261010`, 8 commits),
   one at a time, by hand onto today's code: the rail/footway/landuse/pier
   overview extract (`scripts/own-map/fetch-osm-extras.ts`, `build-own-map.ts`),
   the own map picker replacing Leaflet (`ownMap/mapPicker.ts`; `map-picker.js`
   becomes an adapter), the footprint worker. Extracts for Utrecht, Rotterdam,
   Den Haag need water polygons: report what is missing per city.
6. **Delete now** (P0): the legacy `_makeLayer` / own-renderer branches in every
   participant source (`threeBuildingsBrowser.ts`, `player-vehicles-source.js`,
   `signature-landmarks-source.js`, `inventory-trees-source.js`,
   `pyramidal-roofs-source.js`, `artis-animals.js`, `detailed-buildings-source.js`,
   `look/highlightMarker.ts`) and `SHARED_FRAME_DEFAULT` handling in
   `sharedFrame.ts` (the shared frame is forced on by own ground already). List
   the deleted lines in the hand-back; the bundles are rebuilt by the integrator.

## Parity oracle

`vectorMap.camera.project` under `?engine=own` against the MapLibre
implementation at the same `CameraState`, within 3.2 px, along the intro path
and the Anne Frank → Rijksmuseum ride (`tests/e2e/no-maplibre.spec.ts` has the
method; extend it to run in-game). Spoiler rule under the flag: "with every
name earned, the street under question is never drawn" (`ownMap.test.ts`,
e2e `labels`).

## Gate for the step hand-back

`look-consistency`, `start-heading`, `open-squares`, `labels`,
`answered-street-name`, `intro-perf`, `context-restore` green on desktop and
iPhone under `?engine=own`; draws ≤ 700; programs ≤ 32; `phone-memory.spec.ts`
shows 0 MB of MapLibre workers under the flag; `ride-perf.spec.ts` in-page A/B
(`AB_ON`/`AB_OFF` via `scripts/ride-perf-owners.mjs`) main-thread frame CPU
median ≥ 1.5 ms lower than default. Never weaken a budget.

## Checks

`npm run lint`; `npm run check:canal`; `npm run test:own-map`;
`PW_PORT=<port> npx playwright test look-consistency start-heading open-squares
labels intro-perf context-restore --project=desktop` and `--project=iphone`,
each under `/tmp/canal-pw.sh`.

## Hand back

The `LANE-RULES.md` block, plus: the parity table (px) per camera, the step
landed, the `WorldView` methods still unimplemented under the flag, the exact
`game.js` / `package.json` lines for the integrator, and the deletion list.
