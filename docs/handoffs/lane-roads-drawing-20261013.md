# Lane: how we draw roads and junctions (presentation, 2026-10-13)

User 2026-10-13, with screenshots at the Nassaukade / Raampoort junction,
the Rozengracht / Marnixstraat junction and the Ryckerbrug: "our road
network needs drawing help", "bad roads", "doesn't look/feel enough like
AMS streets", "why is half of De Clercqstraat missing here?" What the
shots show: cycle lanes as flat red smears that pool into blobs at
junctions and stop short of kerbs; junction fills as grey patches with
stray red triangles; lane markings that run into each other and across
junctions; centre lines drawn on one-way cycle streets; no kerb line
between road, cycle path and pavement; no tram tracks; one block of De
Clercqstraat (at the Bilderdijkstraat / Ryckerbrug end, in the own-ground
build) rendered as an open grey plaza where the street continues.

Inputs: `docs/elevation.md`, `docs/research/own-ground-20261009.md`
(cross-section bands per way, BGT widths), `src/canalRecall/ownGround/*`
(`osmGround.crossSection`), the MapLibre road style in `public/canal-drive/`
(`vector-map.js`, style JSON), `streets-routing.json`, the BGT `wegdeel`
polygons already fetched to `~/Code/map-recall2-source-data/datasets/own-ground-20261013/`
(1,176 tiles), `constants.js ROAD_WIDTHS`. Open data only (BGT CC0, OSM).
Lane owns the ground/road drawing modules under `src/canalRecall/ownGround/`
and the road style; ≤ 30 reported lines in `vector-map.js`. Do not edit
`game.js`, `index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`.
Work behind the existing `?ownGround=1` (that is where the user looks) and
keep the MapLibre default path's pixels unchanged unless a fix is clearly
needed there too (say so).

## Deliverables
1. **De Clercqstraat**: find why the block is missing under own ground
   (filtered way class? tram-only segment? cross-section band dropped? BGT
   `wegdeel` function?), fix at the data or band level, add it as a named
   regression in the ground harness.
2. **Junction geometry**: build junction fills from the union of the
   incoming cross-sections (or straight from BGT `wegdeel` polygons where
   available — the canal belt is covered), so cycle lanes end at the stop
   line and junction interiors are one surface with no stray triangles;
   markings stop at the junction edge; one-way cycle streets get no centre
   line; crossings (zebra, cycle crossing) only where OSM/BGT say so.
3. **The Amsterdam street vocabulary**, each as a cheap band or decal, on by
   default under own ground: red asphalt cycle paths with a clean white edge
   line where separated, klinker (brick) pavements with a kerb line, tram
   tracks on tram streets (two rails per track, from OSM `railway=tram`),
   bollards (Amsterdammertjes) along canal-side pavements at the OSM spacing
   if cheap, tiled bike-lane ends. Pick colours from `look/palette.ts`; the
   look lane's LOOK.md is the art direction.
4. **Before/after** at the three user spots and the three ground regressions
   (BRU0166, BRU0044, BRU0067), desktop, plus one phone-width shot each;
   draw-call and ms-per-frame delta on `scripts/ride-perf-fixed-route.mjs`.

5. **Far field under own ground** (user screenshot 2026-10-13 from the
   Chassébuurt looking west over the Westerpark allotments): beyond the
   resident own-ground cells the ground is bare white with no road, water
   or landuse fills at all, only buildings and trees. Until the next cells
   load, the MapLibre fills (or a cheap far-field road band from the
   routing graph) must stay visible; measure the cell load latency on the
   fixed route and make the handover invisible.

## Checks
`npm run lint`, `npm run test:canal-car`, `npm run test:reachability`,
the ground harness, `PW_PORT=<yours> npx playwright test own-ground
--project=desktop` (or the spec that exists). Report: branch, SHA, the De
Clercqstraat cause, shots, perf delta, the `vector-map.js` lines, unfinished.
