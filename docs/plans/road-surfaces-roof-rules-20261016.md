# Road rendering from surveyed surfaces; roofs follow the front; two landmark fixes

## Context

On 2026-10-16 the user sent a screenshot of the own-ground roads at the
Marnixstraat / Lijnbaansgracht bridge by the Tweede Marnixplantsoen: red
cycle bands overlapping each other and the grey carriageway, running onto
the pavement and ending abruptly; pavement-coloured wedges inside the
junction; grey bands of different widths overlapping; dashed centre lines
and a zebra running through the junction and across each other; a flat
grey deck slab wider than the road; tram rails on a different grey.
"Road rendering needs to get fixed."

Verified cause (`src/canalRecall/ownGround/streets.ts`, `osmGround.ts`):
every OSM way is drawn as its own cross-section bands; the only junction
model is one fill polygon per OSM node where carriageways share a vertex
(`junctionGeometry`), with trims capped at 18 m or 45 % of the arm; ways
that cross without a shared node, compound junctions of several nodes,
dual carriageways on both quays, separate cycleways and paths get no
treatment; nothing clips one band against another (cycle outranks asphalt
in the depth tie-break, so red always wins); `footway=crossing` ways and
tram rails are never cut; asphalt and klinker share a polygon-offset rank
and z-fight; pockets paved by majority vote read as pavement because the
land colour and the paving colour are 4 units apart. At the screenshot's
junction the 9 m busway meets the 5.3 m red cycle street at 18°, so there
is no kerb corner and both trims hit the 18 m cap. At Kinkerstraat ×
Da Costakade `probe-junction-overlap.ts` counts 114 cycle triangles
inside the two junction polygons.

The repo already fetches the municipality's surveyed road partition: BGT
`wegdeel` polygons (Kadaster via PDOK, CC0; `scripts/own-ground/fetch-bgt.ts`,
61,429 features city-wide, 884 MB raw archived in
`map-recall2-source-data/datasets/own-ground-20261013/bgt-wegdeel/`), but
uses them only to measure per-way widths (`bgtWidth.ts`, `OsmWay.bw`). The
parks already draw BGT polygons as surfaces (`parks.ts`), and the cells
have a staging-then-publish pattern for new polygon layers
(`add-bgt-courtyards.ts`, `fetch-bgt-parks.ts`). Earlier notes deferred
full road polygons on size ("tens of MB city-wide") and the hosting quota.

The same day the user gave four more corrections that this plan carries
because the same lanes will execute them: (1) "don't give so much
credence to 3DBAG roofs" (roof masses above measured parapets, hipped
roofs where the photo has a flat parapet, raised blocks not in the photo);
(2) "stepped gables are almost universally symmetric, you keep making this
mistake"; (3) "you probably could have guessed that one house here isn't
higher than the rest" (one pand's 3DBAG ridge in a uniform 1902 row);
(4) the Homomonument "still looks wrong (missing a triangle, sticks into
the canal)" and the Krijtberg's windows "shouldn't overshoot the geometry
of the building… fixed in this building but also in our build pipeline".

Standing priorities (2026-10-15): kits and repeated buildings over
one-off houses; motion performance; a sunnier palette. Open data only.

## Part 1. Roads: draw the surveyed surface, keep OSM for routing and paint

User decision 2026-10-16: BGT `wegdeel` polygons become the near-ring road
surface; OSM centreline bands stay only as the fallback (far ring, cells
without the extract). Measured over the archived tiles: 748k kept polygons
city-wide (carriage 201k, foot 317k, cycle 59k, parking 127k, inrit 38k,
pedestrian 6k; `relatieve_hoogteligging` 1–2 on 22k), 14.7 M vertices after
0.1 m simplification, ≈ 40 B per polygon encoded as parks-v1 does, a dense
Oud-West cell 190–317 KB gz, city ≈ 25–30 MB gz. The archive lacks
`lokaal_id` and `fysiek_voorkomen`, so a re-fetch is needed (15–25 min).
No polygon-boolean library exists and none is added: the partition is drawn
as-is, linework is clipped by point-in-polygon, kerbs come from shared edges.

**Data lane** (`roads-v1`, the parks-v1 pattern):
- `scripts/own-ground/fetch-bgt-roads.ts`: per cell with a 30 m pad from
  `https://api.pdok.nl/lv/bgt/ogc/v1/collections/wegdeel/items` (paging by
  `next`, as `fetch-bgt.ts`), keeping `lokaal_id, functie, fysiek_voorkomen,
  plus_fysiek_voorkomen, relatieve_hoogteligging, status, eind_registratie`;
  cache `artifacts/own-ground/raw/bgt-roads/<cell>.json.gz`; `--cells`,
  `--offline`; archive the raw tiles to source-data
  `datasets/bgt-roads-20261016/`.
- `scripts/own-ground/build-bgt-roads.ts` → `artifacts/own-ground/staging/roads-v1/`:
  dedupe by `lokaal_id`; drop non-`bestaand`, functie outside `KEEP_FUNCTIE`,
  `h < 0`; owner cell by `interiorPoint` (`parks.ts`); class by `classOf`
  (`bgtWidth.ts`); mesh: carriage/parking/driveway gesloten → asphalt, open
  → klinker, half/onverhard → gravel; foot/pedestrian/inrit → paving; cycle
  → cycle; OSM override `isFietsstraat` → cycle; `kerbs` = shared edges
  between carriage/parking/cycle and foot/pedestrian at equal `h` (exact
  vertex hash before simplification, merged runs); `coverWays` = OSM ways
  whose 2 m stations lie ≥ 80 % inside compatible polygons (`ownClasses`),
  so the runtime suppresses their bands without point tests; rings 0.1 m
  simplified and `encodeLine`d. Cell `{version, key, surfaces: {k, c, h,
  r}[], kerbs, coverWays}`; manifest with `attribution: 'BGT © Kadaster
  (CC0 1.0)'`; `report.json` (polygons by class/h, gz per cell, coverWays
  share by highway class, `h ≥ 1` polygons over no measured deck). Budget
  ≤ 350 KB per cell, ≤ 30 MB total (levers: 0.15 m, fold `inrit` into
  foot). Publish by copy into `public/data/extracts/amsterdam/roads-v1/`,
  in its own commit with the report in the message. Hosting: phase 1 is
  seven cells (≈ 2 MB); the city-wide publish waits for the measured
  total and the deploy prune (memory: hosting-quota-prune).

**Runtime lane** (`src/canalRecall/ownGround/roadSurfaces.ts`, new, pure):
- `RoadIndex` = `SurfaceIndex` (parks.ts) over cell + 3×3: `find`,
  `classAt`, `heightAt`; a 1 m `raster()` over the cell for land culling.
- `buildRoadSurfaces(cell, height, overWater, lod)`: `flatten` → `earcut`
  with holes → `drapeBisect` (8 m) into the existing layers; `h = 0` on
  `onLand`, `h ≥ 1` on `surface.height` when `deckWeight > 0` or over
  water, else skipped and counted; lifts carriage/parking 0.03, cycle 0.04,
  foot/pedestrian/inrit at the sidewalk top (`raisedBase + 0.11`). One
  partition: nothing coplanar overlaps; kerb `edgeWall` + 0.15 m granite
  ribbon along `cell.kerbs` facing the lower side (by `classAt` 0.2 m
  either side); Amsterdammertjes via the existing `canalSide` test.
- `groundStore.cellInput`: load `roadCell()` + neighbours; add `h ≥ 1`
  rings to `deckRingsAround` so the water mask never cuts a bridge surface;
  `underOwnSurface` also takes the road raster. Owner cell draws whole
  polygons; far ring (LOD 1) and cells without the extract keep bands.
- `buildStreets(…, {roads: {index, covered}})`: covered ways emit no bands
  but stay in the junction graph; node fills and `cornerPatches` skipped
  where `index.find(n.p) >= 0`; pockets unchanged.
- Flag plumbing as `parks`: `OwnGroundOptions.roads`, worker `init`,
  `GroundStore` option, `EXTRACTS.roads = 'roads-v1'`; `?roads=bgt` in
  phase 1, default on with `?roads=0` in phase 2.
- Markings: every paint piece from `dashed()` (centre dashes, edge lines,
  lane edges, zebra, cycle-crossing blocks) kept only when its midpoint is
  in a carriage/parking polygon, so zebras stop at the kerb; new
  `crossCuts(w, grid)` cuts carriageway paint where the centreline passes
  within `other.coreHalfWidth + 1` m of a non-continuation carriageway
  (bridge ends, crossings without a shared node; reuse the 20 m grid from
  `shadowedWays`); painted `cycleway=lane` as a red ribbon at 0.036 clipped
  to carriage polygons, only where `classAt` 1 m outward is not `cycle`;
  lane-link strips and `strip` fills off in BGT mode; stop lines and teeth
  stay and are clipped; `cyclePathCrossings` blocks only where the gap
  midpoint is carriage.
- Tram rails: ribbon pieces over 1 m stations dropped where `classAt` is
  not carriage; rails on `h ≥ 1` polygons drape on `surface.height`; the
  "second grey" is the deck top beside a 12.6 m band on a 19.8 m deck,
  which the next point removes; verify `UNGAINED` rail colour with
  `layersAt` and fix the palette if it is the rail.
- Bridges: `measuredDeckTop(…, {sides: false})` when the cell has `h ≥ 1`
  polygons over the deck: the top stays within the road half-width, the
  BGT bridge polygons are the visible deck out to the parapet; take the
  uncommitted `deckWidths`/`clipDecks` hunks from the ride-fix lane
  (worktree agent-a9367e73629fa0bba, `decks.ts` +91) for cells without
  polygons.

**Tests and measurement:** unit (synthetic cross: 2 carriage, 4 foot
corners, 1 fietspad: no centroid of one layer inside a triangle of another
within 2 cm; kerbs only on carriage/foot edges; zebra outside carriage
dropped; `crossCuts` at an unshared crossing; `h ≥ 1` over no deck
skipped; a covered way emits no bands but keeps its stop line).
`roadRegressions.ts`: `JUNCTIONS` += Kinkerstraat × Da Costakade west
(4.87323, 52.367545) and east (4.87383, 52.367724) asphalt ≥ 0.9 in 4 m;
`STRAYS` += probes on the Da Costagracht bridge deck (way 753774987) and
both quay mouths forbidding cycle and paving; a `ZEBRAS` probe (every
paint centroid within 15 m of the Bilderdijkgracht crossing ways
1239242881/1239242873 lies over carriage); the screenshot's spot, the
Marnixstraat busway × red cycle street by the Tweede Marnixplantsoen
(≈ 4.8767, 52.3747, both trims at the 18 m cap today) as a `JUNCTIONS`
entry; Rozengracht/Marnixstraat and Nassaukade n2306196651 unchanged;
`own-ground-paint.spec.ts` ≥ 1.25 % kept. `probe-junction-overlap.ts
--pairs` (layer A centroids inside layer B triangles, |dz| < 2 cm): 0 at
the named junctions. `check-ground-cells.ts --all` table before/after:
triangles per cell (≤ 1.15×), build ms median (≤ 1.3×), roads gz per cell
(≤ 350 KB), a `noRoads` store for the pin-is-live checks. Frames with
`scripts/ride-review-shots.mjs` (on main) extras at the three spots, both
bearings, `BUNDLES_DIR`/`DATA_DIR` for the before; `own-ground-roads.spec.ts`
`ROAD_SPOTS` += `kinkerstraat-dacostagracht` and `marnixstraat-plantsoen`.

**Phasing:** (1) pilot cells `-3_-1, -2_-1, -3_0, -2_0, -1_-1, -1_0, -2_1`
behind `?roads=bgt`, frames reviewed at gallery size; (2) all 294 cells,
budgets measured, default on; HISTORY entry with the numbers.

**Risks:** BGT lags construction (filter `status`/`eind_registratie`);
kerb matching across bronhouder borders needs a tolerance hash; squares
and yards that are `onbegroeidterreindeel` not `wegdeel` show as today
(the courtyard lane's data covers interiors; a phase 3 adds open-verharding
terrain); `h ≥ 1` over unmeasured overpasses skipped; routing, quiz and
belt-audit inputs untouched (OSM cells unchanged), audit numbers
re-baseline.

**Effort:** ≈ 8 lane-days ± 2, two lanes in parallel (data; runtime on the
archived tiles until the re-fetch lands).

## Part 2. Kit rules: roofs follow the front, gables symmetric, rows coherent

Verified: the crown profiles (`canalhouseCrownProfile('trap', …)` and the
others in `buildingRecipe/fit.ts` ~498–518) are exactly mirror-symmetric;
the lopsided step gables on kinker-56-84 (pand 236441, Kinkerstraat
56-62, "OTEMBA ramen"; 236325; 161359) are the 3DBAG LoD2.2 roof planes
(32 surfaces at 48–65°, front profile wandering 13.2–16.6 m) showing
above the symmetric crown through `crownVerges`. On kinker-315-359 (18
adjoining 1903 pands of `kinker-1902-balcony-axis`) 3DBAG eaves split into
12.9–13.9 m (true cornice) and 14.5–16.1 m (the flat top carried to the
facade); the lane hand-fixed 8 with `continuity.measuredEaves`; the
bell-gable pand 153447 (no. 343) has the row's largest excess (eaves 16.01
vs row 13.4) and without the hand entry its crown would top at 18.6 m.

One kit lane, targets on `main` (`src/canalRecall/blockFace/{recipeRoof,
compile,houseType,intent,gableFromStrip}.ts`, `buildingRecipe/{intent,
facts}.ts`):
- **Schema (opt-in, defaults derived):** `CanalHouseIntent.roof` gains
  `source?: 'front' | '3dbag'`, `pitchDeg?`, `form?: 'saddle' | 'flat' |
  'attic'`, `evidence?`; `HousePlacement.roof?` overrides the type's;
  `continuity.rowCoherence?: false | {thresholdM}` (default on, 0.8 m);
  facts `roofSource.kind: 'recipe' | 'front'`, `crownTopM`, `rowClamp`.
- **(a) Front over 3DBAG:** `roofSourceFor(intent, fit, facts, face)` in
  `compile.ts` → `'front'` when a street front has a measured crown (a
  gable read off the strip, `measuredEavesM`, a `frontRoof` entry, or a
  wide-capped cornice = parapet); plain cornice fronts keep the face rule
  (byte-identical). `recipeRoof.ts`: refactor the plumbing into shared
  helpers (prove `recipeRoofFacts` byte-identical by golden), add pure
  `saddleUnderProfile(profile, w, E, {pitchDeg?, margin 0.1, side pitch
  30–65°})` (ridge at `w/2`, the smallest slope keeping the roof 3 cm
  under every profile vertex and riser; null when `sideEavesM < E − 1`)
  and `frontRoofFacts` (per front band: saddle for gable fronts, flat for
  parapet/measured-eaves fronts, attic for `frontRoof {topRow, pitchDeg}`
  without the 3DBAG p95 cap; rear wings from 3DBAG levels clamped to
  `min(E, sideEavesM)`, never above the crown line). `withRoofs` runs per
  pand (survey / recipe / front); `frontRoof` becomes a hint instead of
  the line-112 precondition; gates: `height-vs-3dbag` variant for front
  roofs (`roofMax ≤ max(crownTopM) + 0.02`), new `roof-under-crown`
  (facade line every 0.1 m: roof ≤ profile + 0.03); report and `review.ts`
  info row gain `roof: front saddle 16.1 (3DBAG 16.7)`.
- **(b) Gable symmetry:** guard test `gableSymmetry.test.ts` (every
  `GableIntent`, caps, finials, `crownSteps 1..6`: each profile vertex has
  its mirror within 1e-6; `saddleUnderProfile` under every type; ridge x
  = module centre); `gableFromStrip.ts` `crownSteps = round(mean(L, R))`,
  `max` when one flank's coverage < 0.7; named regression kinker-56-84
  (236325 m0/m1, 236441 m2, 161359 m0 are `front`/saddle, roof heights at
  `c ± t` equal within 2 cm, `roof-under-crown` passes, no roof z-fight
  > 5 dm² at the party lines, the plain-cornice modules keep their 3DBAG
  roofs byte-identical).
- **(d) Row coherence:** new `rowCoherence.ts`: `findRows` (consecutive
  houses of one type with `builtYear` within ±2 of the modal year, ≥ 3
  members), `rowLines` (eaves = median of strip measurements if any, else
  of 3DBAG `fitEaves`; ridge = median `ridgeM`), `applyRowCoherence`
  (unmeasured member > 0.8 m off the row eaves and not confirmed by its
  photo skyline within 0.4 m → `measuredEavesM = rowEaves`, tagged `row`;
  ridge/roofMax > 0.8 m over the row ridge → capped at `rowRidge + 0.1`,
  survey vertices clamped), in `planFaceGround` after cornice groups and
  before explicit `measuredEaves` (explicit wins); every clamp printed in
  the report and on the sheet. Threshold rationale: LoD2.2 noise within one
  cornice is 2–8 cm (up to the accepted 0.8 m group spread), the misread is
  2.5–3.5 m, a real difference between same-type same-year neighbours is ≥
  a half storey (1.15 m). Named regression kinker-315-359 with the 8 hand
  entries removed in memory: one row of 18, the infill 080487 excluded, row
  eaves ≈ 13.4, clamped set exactly {156907, 165777, 153818, 153447,
  159990, 236156, 167386, 236481}, no. 343's crown within 0.1 m of its
  neighbour's, 155496's roofMax 16.31 → ≤ 16.06, `rowCoherence: false`
  reproduces today's facts byte for byte.
- **(c) Identity proof:** step 0 on main records `scripts/block-face/
  roof-golden.json` (`sha256` of `roofsRD, heights, measuredEavesM` per pand
  plus its class survey/recipe/front/row) via a new `prepareFaceFacts`
  export; the test asserts survey/recipe pands without a measured crown or
  row clamp are unchanged and lists the rest; `houseIntents` deepEqual for
  faces without `roof.source`; `fit-golden`, `tileBuildings` tests and
  `buildFacts`/`bagTileBuild.ts` untouched (city-tier massing must not
  move); the partition test extended to the front forms (roof area =
  footprint area ≤ 2e-4 m²). Sheets before/after: kinker-56-84, 315-359
  (then drop the 8 hand entries), 65-87, 206-242 (drop `keepSurvey`),
  bilder-081118-155417, bilder-236022-167243; doc
  `docs/front-roofs-20261016.md`. Out of scope: Mercatorplein's raised roof
  block is large-tier `roofPlant` (`houses/mercatorplein-*`), noted for the
  large-tier follow-up.
- Risks: defaulting `front` re-renders every face with a gable or measured
  eaves (the golden diff lists which; recompile and re-install after the
  sheets); saddle side eaves under steep step gables can sit one riser
  below the cornice (clamped at `E − 1`, else flat + note); dormered gable
  fronts fall back to attic; a genuinely lower house in a typed row would
  be clamped (photo-skyline check and the explicit escape cover it, and
  every clamp is on the sheet).

## Part 3. Homomonument and the Krijtberg windows, with a pipeline gate

**Homomonument** (`scripts/landmarks/memorial-builders.ts`,
`memorial-specs.json` id `homomonument`, ground polygon from
`build-homomonument-ground.ts`, review in `homomonument-ground-review.md`).
The spec says the waterside stair-platform tip "intentionally extends
into Keizersgracht", which is true of the real monument, but the render
shows it as a flat pink slab hovering over the water with a hard shadow,
and only two of the three triangles read. Lane: (a) inventory from open
sources (the RCE description, the municipal panoramas, BGT `wegdeel` /
`ondersteunendwegdeel` polygons at the spot): three equilateral granite
triangles of 10 m forming a 36 m triangle: one raised 0.6 m as a podium
(toward the Westerkerk), one flush with the square (pointing to the
Prinsengracht/Anne Frank Huis), one descending in steps to the water on
the Keizersgracht; (b) rebuild the memorial as those three with the
quay-side one as real steps from quay level to 0.3 m above water, its
side walls meeting the quay wall, the podium one with its riser, the
flush one 2 cm proud of the paving; pink granite as a measured tint;
(c) the own-ground quay must not cut through the steps (the deck/shore
rule in `groundStore` gets the step polygon as a landed platform, as
`movableApproaches` does for leaves); (d) before/after frames from the
user's angle (`ride-review-shots.mjs` extra at 4.8847, 52.3744, bearing
~140) and from the boat; a `check:manual-landmarks` entry pinning three
parts and the step count.

**Krijtberg windows** (`scripts/landmarks/krijtberg-builder.ts`): the
clerestory lancets and the lower windows rise into the roof planes and
over the aisle walls. Fix the builder: every window's head stays under
the hosting wall's eaves or the gable's rake at its u, by reading the
wall's top profile instead of a fixed y0 + h; shorten or drop a window
that would not fit. **Pipeline gate** (the user asked for both): in
`src/canalRecall/landmarks/geometryAudit.ts` a new hard check
`openingsWithinWalls`: for every opening part (glass, frame, ring slots)
the part's outline projected onto its host wall must lie inside the wall
raster's silhouette (`inSilhouette` exists, line ~327; use tol 0.05 m)
and must not pierce any roof-class surface; report the m² outside per
part and fail on > 0.02 m². Wire it into `audit:glb` for landmarks and
into the kit's `roofChecks.ts` for block faces and large recipes (the
same rule catches the De Baarsjes lane's roof-above-parapet case from the
other direction). Run it over all 354 manual landmarks and the installed
kit houses, list the offenders, fix the top ones that are ride-visible
(Krijtberg first), and record the rest on the board.

## Lanes and sequencing

- **Now, on exit from plan mode:** resume the eight paused lanes (rears:
  commit + sheet; measurement limits: delete the two temp files, commit;
  De Baarsjes types: tests, hashes, sheets, doc, commits; Kinkerstraat
  colour: sheet, doc, commits; ride fixes J8/P4/J2/J3 (J3 may touch
  `vector-map.js` for the pitch lift, approved here); courtyards: tests,
  regression, all cells, publish, frames; palette: `sunny.ts` tokens, rig,
  wall normalisation, after frames; transition: blend module, e2e; perf:
  motion measurement then the five fixes) and merge each with the usual
  gates. Record the three user rules in memory
  (`roofs-from-photo-not-3dbag`, `symmetric-gables`, `row-coherence`).
- **Roads, two lanes in parallel (Part 1):** data lane (fetch, build,
  report, pilot publish, archive) and runtime lane (`roadSurfaces.ts`,
  store/worker/flag, markings, rails, decks, tests, frames) on the
  archived tiles until the re-fetch lands; ports 4547/4548; the integrator
  merges runtime first behind the flag, then data, then default-on.
- **Kit rules lane (Part 2)** on main; port 4549. It runs while the even
  and odd faces are already merged, so its golden diff is the review list.
- **Landmark lane (Part 3)**: Homomonument + Krijtberg + the
  `openingsWithinWalls` gate over all landmarks; port 4550.
- Paused per-house lanes stay paused (Artis gate, eleven re-installs, De
  Pijp review) until the above are merged.

## Verification

- Roads: `npm run test:own-ground` (new synthetic cases), `check:own-ground-cells`
  (named junctions, strays, zebras, the `--all` budget table),
  `check:own-ground-belt` all KNOWN, `probe-junction-overlap.ts --pairs` 0
  at the three named junctions, `OWN_GROUND=1 PW_PORT=<port> npx playwright
  test tests/e2e/own-ground-paint.spec.ts tests/e2e/own-ground-roads.spec.ts
  tests/e2e/own-ground-bridge-fidelity.spec.ts --project=desktop`, ride-perf
  desktop unchanged within budget; before/after frames at the screenshot's
  junction, Kinkerstraat × Da Costakade and the Bilderdijkgracht crossing,
  both bearings, reviewed at gallery size: no red on grey, no wedges, the
  zebra across the carriageway only, the deck within the parapet, rails on
  the same grey.
- Kit rules: `roof-golden` identity for untouched pands, `test:block-face`
  (gable symmetry, row coherence, kinker-56-84 and 315-359 regressions),
  `test:building-recipes`, `test:fit-golden` identical, `test:tile-buildings`
  identical; the six faces' before/after sheets with the roof and row lines
  in the info row; gallery-size check that every step gable reads symmetric
  with no roof plane above the crown, and no. 343 sits level with its row.
- Landmarks: `check:manual-landmarks`, `check:landmark-lods`, `audit:glb`
  with the new `openingsWithinWalls` hard check (0 m² outside on the
  Krijtberg, the offenders list for the rest), frames at the Homomonument
  from the user's angle and from the boat, and at the Krijtberg from the
  Singel.
- Process: HISTORY entry per merge naming the sheets viewed; TODO updated
  in the same change; demo page sections with before/after for roads, the
  roof rules and the two landmarks.
