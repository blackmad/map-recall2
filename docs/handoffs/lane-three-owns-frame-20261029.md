# Lane: three.js owns the frame (revive drop-MapLibre in flag-gated steps)

Rules: `LANE-RULES.md`. Plan: `slop-newyork-plan-20261029.md` §4 lane A.
Model: opus. The user said go on 2026-10-10 ("why would we still keep
MapLibre at all?"); the verdict and the work table are in
`docs/research/drop-maplibre-20261010.md` §6. What stalled was execution:
branch `render/drop-maplibre-step1-20261010` has 8 commits, all from that
day, and is 2,036 commits behind main. Slop New York is the existence proof
that a city this size runs with three.js owning canvas, camera, picking and
labels (`js/main.js`, `js/cameras.js`): no tile host, no second renderer,
no `queryRenderedFeatures`.

## Why now

- MapLibre is pinned at 5.24.0 (6.x removes `map.transform`, used by
  `labels/labelOverlay.ts`); `mapGuard.ts` is a stopgap for upstream #8607
  (a dead GPU throws a shader error every frame).
- Its workers hold 37 + 50 + 7 MB at ride start on the iPhone profile; its
  basemap is a live third-party dependency (OpenFreeMap); elevation relies
  on private stencil fields; pitch is capped at 60°.
- Lanes B, D and F in the plan all get simpler once the shared frame is the
  only renderer.

## Steps (each lands on main behind a flag within days; no long-lived branch)

1. **Step 1 again, on today's main.** New worktree off main. Port the eight
   commits one at a time (`/usr/bin/git log main..render/drop-maplibre-step1-20261010`):
   the rail/footway/landuse/pier overview extract, `?ownMap=1` (own
   cartography in the shared frame, own label layer, `src/canalRecall/ownMap/`),
   the footprint worker, the own map picker replacing Leaflet and live OSM
   tiles (`map-picker.js`). Parity oracle: the own `project()` against
   `map.project` within 3.2 px along the intro path and the Anne Frank →
   Rijksmuseum ride (the e2e that `drop-maplibre-20261010.md` §3 describes).
   Hand back when `?ownMap=1` rides on desktop and the iPhone project with
   the spoiler rules intact (`look-consistency`, `start-heading`,
   `open-squares` specs green under the flag).
2. **Camera owns the frame.** Replace `jumpTo`/`project`/`unproject`/
   `getBounds` and the clearance probes in `vector-map.js` with
   `ownMap/frame.ts` `CameraState`/`cameraFrame`; intro flight and `aimAt`
   on `easeCamera`. Slop's camera (`js/cameras.js:333-352`) smooths the
   offset relative to the rider; ours keeps `cameraYaw.ts` on top.
3. **Overlays and labels as ours.** Route, active street, cycle tracks,
   transit, neighbourhood lines, active landmark as meshes; POI labels at
   roofline z, brand icons, ferry labels, answered-street lettering through
   `ownMap/labels.ts`; `isWater` and rider cover through `PolygonGrid` and
   footprint point-in-polygon; POI tap through label hit boxes and the
   existing `inspectAtScreen` raycast.
4. **Remove.** Basemap-duplicate machinery (`basemap-hide-ids`,
   `setFilter`, feature-state highlight), themes become palettes, the
   OpenFreeMap style, `maplibre-gl` from `index.html`, specs that read
   `vectorMap.map` move to the own `project`. Extracts for Utrecht,
   Rotterdam and Den Haag from `scripts/own-map/build-own-map.ts`.

## Gate for default-on

Real devices, not the emulator: one iPhone and one low-end Android ride of
5 minutes each with `?ownMap=1` (perf-phones item 1 has never been done);
Sentry context-loss events per ride not above the week before; desktop
`node scripts/ride-perf-fixed-route.mjs` frames vsync-bound and draws ≤ 851;
`phone-memory.spec.ts` showing the MapLibre workers gone. Until then the
flag stays opt-in. Ask the user (issue, needs-david) before the flip.

## Checks

`npm run lint`; `npm run check:canal`; `PW_PORT=<port> npx playwright test
look-consistency start-heading open-squares intro-perf --project=desktop`
and the same `--project=iphone`, each under `/tmp/canal-pw.sh`.

## Hand back

The `LANE-RULES.md` block, plus: parity table (px) per camera on the intro
path, the step landed, the list of `vectorMap.map` uses still open from
`drop-maplibre-20261010.md` §1.
