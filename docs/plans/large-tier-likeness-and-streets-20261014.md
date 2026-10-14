<!-- Approved 2026-10-14 (integrator session). Source: ~/.claude/plans/parsed-inventing-magpie.md. Supersedes the large-tier and street sections of digital-twin-direction-20261013.md; that plan's tiling and look sections stand. -->

# Large tier to photo likeness; commercial streets with a district style

## Context

On 2026-10-14 the user rejected two product lines on the demo page: the
large-recipe "dominant buildings" batches ("these both totally miss the tone
of these windows", "horrible", "awful reconstruction", "please revisit") and
the kit-built statues ("bizarre"). The user then asked for a plan on the
large tier's quality and on modelling commercial streets with distinctive
architecture (Kinkerstraat, Jan Evertsenstraat), and asked whether the brick
bridges are modelled accurately.

Root causes, verified in code: the large tier (`kind: large`, ~100 installed,
654k tris) paints a hand-typed kit on 3DBAG massing: palettes are guessed
hexes, glass is hard-coded `#2a3a42`, systems default to `brick-bay-grid`
(234 of 333 groups) with small punched windows whatever the photo shows, the
runtime `cityWallTint` clamps brick lightness to 0.3–0.6 so dark or pale walls
render tan/brown anyway, the contact sheet pairs photos to wall groups
positionally (`large.ts:70`, a bug) and shows a grey tile when crops are
missing (crops live only in gitignored `staging/` of pruned worktrees), and
every gate is geometry-only. The integrator passed these in review. Statues
went through a primitive figure kit although the plan put sculptures on a
reconstruction track. Bridges are a parametric kit by type (arch count by
water width, 600-tri budget) behind `?ownGround=1`; 931 decks have measured
AHN humps, 689 draw flat.

User decisions (AskUserQuestion, 2026-10-14): a stylised photo-derived
texture is acceptable where the kit cannot express a front; fix the installed
large tier first; Kinkerstraat is the first street. The design review found
strong reasons not to ship a texture (below), so it is a bounded prototype,
not a commitment.

Existing direction plan: `docs/plans/digital-twin-direction-20261013.md`
(recipe tiles per z14, faces and types as the authoring unit, `cityLook`
atlas). Everything below is recipe data or tooling that plan already
consumes; nothing is installed as a per-house GLB on the street side.

## Acceptance bar (applies to every lane below)

A kit or face front is accepted only side by side with its rectified
panorama crop: wall colour family and lightness, glazing fraction per storey,
window shape class and column rhythm must read the same at gallery size, and
the sheet carries the numbers and a PASS / WARN / FAIL / NO EVIDENCE line.
Geometry gates passing is not acceptance. No sheet with a photo on it, no
merge. Ornamented historic fronts go to bespoke builders; a wrong kit is
worse than the plain 3DBAG box, so "uninstall" is a valid outcome.

---

## Part 1. Large tier: measured fit, likeness gate, triage

### Lane A: measurement and likeness tooling (2.5–3 days)

- Crops persisted: `scripts/pand-reference/all-walls.ts --archive` writes
  `<MAP_RECALL_SOURCE_DATA>/pand-reference-walls/<pand>/w<NN>-<bearing>.{jpg,mask.png,thumb.jpg}`
  plus `walls.json` extended with `foliage`, `missingFraction`, `baseZ`,
  camera RD, heading, wall endpoints RD, `sha256` (the rectifier already
  computes foliage and alpha in `rectify.ts:41` and drops them).
  `scripts/pand-reference/core.ts` honours `PAND_REFERENCE_CACHE` (the 4.3 GB
  panorama cache is only in the main checkout's `.cache`; worktrees
  re-download today). `intent.json` `sources[].image` becomes
  `source-data://pand-reference-walls/<pand>/<file>` with `sha256`;
  `large.ts` and `measure.ts` resolve it through the env var and fail loudly.
- Crop-to-panel mapping: new `src/canalRecall/buildingRecipe/cropToPanel.ts`
  projects each fitted panel's `uMin..uMax` back to RD via `anchorRD` and
  matches crop walls with the thresholds in
  `src/canalRecall/facade/wallSurfaceMatch.ts` (offset ≤ 0.5 m, angle ≤ 5°,
  along-overlap ≥ 60 %); output `{tag, uOffsetM, vOffsetM, coverage}` per
  panel, per group via `recipe.panelGroup`. Unit test on a synthetic
  L-footprint pins the `exposedWalls` orientation sign. Replaces the
  positional `sources[g.index]`.
- Measurement: `src/canalRecall/buildingRecipe/measureFacade.ts` on the
  50 px/m crop resampled to a 10 cm grid: exposure white point from light
  trim (frames/sills; kerb fallback; record which); masks for missing,
  foliage, washed-out, above-roofline, ground band 0–2.5 m (measured
  separately, never pooled); wall vs not-wall clustering (reuse
  `src/canalRecall/facade/dominantWallColour.ts`); glazing fraction per
  storey band; column count from the autocorrelation of the upper-storey
  not-wall profile; shape class from the median not-wall component aspect
  (tall > 1.4, square, wide < 0.7); classify punched / ribbon / curtain /
  glazed-columns. Dark brick with dark glass needs the light-trim class and
  edge profiles, not wall-vs-glass alone. Unit tests on synthetic crops
  (known pitch; dark-brick case; 40 % foliage abstains).
- Likeness: `src/canalRecall/buildingRecipe/likeness.ts`. Model side via
  `renderElevation` in `src/canalRecall/landmarks/facadeCompare.ts` along the
  panel normal at 10 cm cells, material class per cell, colours through
  `cityLookTint` (what the game draws). Photo side placed by the mapping with
  a bounded ±0.5 m u-shift maximising not-wall IoU (report the shift). Gated
  numbers per group: (1) wall colour family (`src/canalRecall/facade/materials.ts`
  families) and |ΔL| ≤ 0.12 after trim normalisation, hue only when both
  saturations > 0.08 (as `blockFace/wallColour.ts`); (2) glazing fraction per
  upper band within 0.15, mean within 0.10; (3) columns within 20 % and same
  shape class; (4) mask IoU report-only (warn < 0.45). Abstain = NO EVIDENCE
  when usable upper cells < 40 %, foliage > 25 %, washed-out > 30 %,
  obliquity > 45°, or camera < 8 m for a wall over 15 m.
- Schema (`intent.ts`, `largeIntent.ts`): `palette.glass` (house and group),
  `windowShape {w, h, sill}` as fractions, per-group `measured` record, a
  `hand` list of protected fields. `scripts/building-recipes/measure.ts
  --house=<id> [--write]` writes measured fields into the intent and a debug
  image per group; the committed artefact is
  `scripts/building-recipes/houses/<id>/measured.json` (crop id/sha, mapping,
  measurements, likeness, abstain reasons, hand overrides).
- Sheet rewrite in `scripts/building-recipes/large.ts`: per evidenced group,
  row 1 crop (masks hatched) | model ortho elevation in game tints at the same
  px/m | 50 % overlay (the rows `scripts/block-face/review.ts` already
  draws); row 2 swatches (photo wall raw / normalised / model tint / photo
  not-wall / model glass) and the numbers with a large verdict line; row 3 the
  existing front and 3/4 views. `report.json.likeness` carries the same.
  `install-large.ts` refuses FAIL or NO EVIDENCE on a street-facing group;
  `--allow-inferred=<gi>` needs a note and sets
  `reviewState: 'large-recipe-likeness-inferred'` plus a `limitations` entry.
- Returns: `measured.json` and sheets for the five pilots (Apollohal,
  Waagdragerhof, Houthavenkade 26, Spinoza Lyceum, Wibautstraat 78) and a
  table of measured vs hand-counted columns, glazing and family.

### Lane B: measured tint in the look (1 day, parallel with A)

Do not move the `cityWallTint` clamp (it protects 343k streamed buildings)
and do not re-slot measured walls to stucco. Add the existing bypass pattern:
`scripts/canalhouse-recipes/export-glb.ts` writes `tintSource: 'measured'`
into material extras when the palette entry is measured; `cityLookTint` in
`src/canalRecall/look/cityLook.ts:212-220` returns the authored hex divided by
the brick cell mean for measured brick/accent (as `SLATE_KEEP_FROM_L` does),
allowing L down to 0.18; same path in `buildingRecipe/recipeLook.ts` so the
headless sheet matches the game. Tests in `palette.test.ts`, `cityLook.test.ts`,
one case in `tests/e2e/building-look.spec.ts`; unmeasured output
byte-identical. Returns an in-game swatch sheet before/after for the pilots.

### Lane C: kit vocabulary (2–3 days, after A's schema)

`src/canalRecall/blockBuilding/systems.ts` and `components.ts`: `glazed-hall`
(full-height glazing band with a mullion grid at measured pitch over a brick
base; Apollohal), `glazed-columns` (full-height glass stripes between brick
piers, balcony slabs optional; Houthavenkade 26), `french-window-ledge`
(windows 0.7–0.8 of the storey with a continuous ledge per storey;
Waagdragerhof), ribbon with measured pier width, `windowShape` fractions,
`palette.glass` dark vs grey-blue reflective. `largeTier.test.ts`;
`large-mesh-golden.json` unchanged for existing houses. Returns the five
pilots re-fitted to likeness PASS with triangle counts (the 13×11 tower is
the budget risk: one slab per storey run). Also fix the opening that
straddles the seam between coplanar merged 3DBAG surfaces (Singel 457 case):
cut across merged coplanar surfaces instead of laying the quad proud.

### Texture prototype (bounded, after C; user decision 2026-10-14)

The design review's finding: a posterised crop would have fixed the tone on
all three complaints, but as a shipped surface it drops out of the
one-shader city look (`cityLook.slotIneligible` on textured materials),
breaks the exporter's texture-free contract (`export-glb.ts:59`), the
"No reference-photo pixels" attribution and the registration rule
(`facade/fixtures/street-derived-invalidation.json`), costs ~80 MB GPU for
100 buildings without an atlas, and reads as a blurry billboard at gallery
size (16 px/m). Plan: after lane C, one lane renders the three complaint
houses with a palette-posterised 8 px/m texture (atlas, KTX2) next to the
measured-kit versions, in the game frame; the user decides on the sheet.
Default outcome if the measured kit passes likeness: no texture.

### Lane D: triage of the installed houses and the ranking (1.5–2 days, after A)

- Regenerate crops for all 100 installed pands into the archive, run
  `measure.ts` on each, write `artifacts/building-recipes/likeness/report.md`
  ranked worst-first by the worst street-facing group.
- Rule per house: all groups PASS → keep; FAIL on colour or glazing with the
  vocabulary present → re-fit (cheap); FAIL needing a new system → re-fit
  after C; ornament or irregular fenestration → uninstall, bespoke only if
  ride-visible; NO EVIDENCE on a ride-visible wall → uninstall until a crop
  exists, on a hidden wall → record as inferred.
- Held branches `large/dominant-7-20261014` and
  `large/public-buildings-4-20261014` stay held; cherry-pick their tooling
  commits now (`55196db1` garageBays, `4d579552` installer aliases); run the
  likeness pass on their 16 houses afterwards and merge only passers.
- Replace footprint ÷ distance with ride visibility:
  `scripts/building-recipes/ride-visibility.ts` samples routes between the
  catalogue destinations, counts route metres within 60 m with line of sight
  (footprints as occluders, as `neighbourhood-core.ts`), weighted by
  facing-wall length, written as `rideVisibility` into
  `public/canal-drive/dominant-building-backlog.json`. Batch 7's industrial
  picks (Nieuwe Hemweg, Isolatorweg) are what the old ranking produces.

### Integrator now

Cherry-pick `55196db1` and `4d579552`; point `PAND_REFERENCE_CACHE` at the
main checkout's cache; add the acceptance bar and the no-sheet-no-merge rule
to `docs/buildings-pipeline.md` (replacing the "Scope and acceptance"
paragraph staged in the pending merge chain); fix the stale line saying large
recipes are not installed. Calendar: about two weeks with A and B parallel,
C overlapping A's second half, D last.

### Where Part 1 will disappoint

Colour is good to a family and ~0.05 L, not a hex; trim normalisation fails
on fronts with no light trim. Dark brick with dark glass may abstain on
rhythm (hand counts on 10–20 % of groups, kept in `hand`). Crops smear above
~20 m from a 10 m camera; towers measure their lower storeys. Ground floors
(78 % differently coloured) are measured separately but the kit has no ground
colour slot yet (follow-up).

---

## Part 2. Commercial streets: Kinkerstraat first, Jan Evertsenstraat second

### What the repo settles

Block faces are the authoring unit (`scripts/block-face/faces/<id>/{intent,discovery,strip,uses}.json`,
23 faces exist) and `scripts/building-tiles/compile-recipes.ts` already reads
faces by prefix and emits a changed-pands review page: author faces, never
`compile.ts --install`. `scripts/block-face/faces/clercq-236681/intent.json`
is De Clercqstraat 1898–1901: 3 house types, 7 identical modules, real shop
names and signs; that is the Kinkerstraat vocabulary (segmental arches via
`windows: 'arched'` + `archRings`, `windowSurround: 'keystone'`,
`cornice: 'bracketed'|'heavy'`, towers, step gables, stucco wall material,
dormers, shopfronts with fabric awnings). `scripts/research/detect-house-types.ts`
clusters body/crown by NCC on the strip. Types are face-local today
(`BlockFaceIntent.types?`); a shared library is the one schema change.
Review: `scripts/block-face/review.ts` (strip | ortho | overlay | per-pand
facade-compare and `measureWallColour`). Survey: `scripts/street-surveys/street-pands.ts`,
`scripts/pand-reference/run.ts --street=` (set `--limit`, default 40
truncates), `scripts/block-face/intake.ts`. The prior Jan Evertsenstraat
pilot used a Google Street View screenshot and failed; retire it.

### Programme per street

Survey → shared type library per district style → faces of ~10 pands →
review → tiles. Bespoke only where the kits cannot express it.

1. **Schema: shared type library** (day 1). `src/canalRecall/blockFace/intent.ts`
   `types?: (HouseTypeIntent | string)[]`; strings resolve to
   `scripts/block-face/types/<district>/<id>.json`; `validateBlockFace` and
   `houseIntents` take a loader; `compile-recipes.ts` and
   `scripts/block-face/compile.ts` pass it and hash the library into
   `sources.types`. Existing faces byte-identical (`fit-golden`,
   `tileBuildings/golden.test.ts`).
2. **Survey lane, Kinkerstraat.** `street-pands.ts --street=Kinkerstraat`,
   `pand-reference run.ts --street=Kinkerstraat --limit=250` (crops into the
   archive per Part 1 lane A), index extended per pand (side, year group,
   3DBAG eaves/ridge, frontage width, OSM business via `blockFace/uses.ts`,
   crop path and date, proposed face id by cross street from
   `streets-routing.json`), contact sheet per side, `block-face:intake` per
   face. Style groups: 1880s–1900s revolutiebouw (161 pands), 1910s (13),
   1980s urban-renewal infill (31). Output: `scripts/street-surveys/streets/kinkerstraat.json`,
   `faces/kinker-*/{discovery,strip,uses}.json`, a table of pands needing
   large or bespoke treatment (De Hallen as `kind: large` with arched
   openings; corner blocks with 4+ fronts and infill wider than ~12 m as
   large recipes measured per Part 1).
3. **Type-library lane, Oud-West.** `detect-house-types.ts` on each strip;
   5–7 types under `scripts/block-face/types/oud-west/`: `kinker-1890-brick-arched`
   (2–3 axes, segmental arches, keystone surrounds, heavy cream stucco
   cornice, crowns none / dormer-pediment / step-gable-centre / tower-flat,
   shop ground per house), `kinker-1900-stucco-front` (stucco wall, parapet
   cap, pediment dormers), `kinker-1985-infill` (flat gable, no cornice, plain
   windows, projecting balcony stacks, bitumen roof). Palettes written from
   the strip medians (extend `review.ts` or a new
   `scripts/block-face/palette-from-strip.ts` printing per pand wall / frame /
   fascia medians), `evidence` citing strips, `schemaLimits` listing what the
   1890s vocabulary cannot do (festoons, consoles).
4. **Face lanes, Kinkerstraat** (2–3 parallel, ~10 pands each, ~35 min per
   face including a second pass): typed placements, per-house shops read from
   zoom crops (names when legible, else OSM, `agreement` recorded);
   `compile.ts --face=` (no install) → strip sheet → pass 2 → review.
5. **Review lane.** Extend `review.ts` with a camera-matched row (render the
   staged chunk from each strip panorama's position via
   `scripts/building-recipes/render.ts renderModels` over the raw crop at
   50 %), the likeness numbers from Part 1 lane A (calibrated first on the
   accepted Bilderdijkstraat and De Clercqstraat faces; expect 0.5–0.7) and a
   verdict per pand (`photoRows` match, wall colour within tolerance,
   likeness, gates, interference → pass | hold(reason)). A face passes when
   every pand passes or fails only on a listed `schemaLimits` item. Then
   `compile-recipes.ts --faces=kinker-` into `artifacts/recipe-tiles/`, the
   changed-pand page, and ride shots: `scripts/ground-ride-shots.mjs` with
   `PLACE=lng,lat,bearing` at five points per street (both ends, two mid
   points, the square), desktop 1280×800 first, looked at at gallery size.
6. **Component lane, Amsterdam School** (parallel with 2–5; 4–6 days):
   rigid continuous canopy (`AWNING_STYLES` + `'rigid'`: slab 1.0–1.3 m
   deep, 0.12–0.2 m thick, 0.25–0.35 m nose fascia at the shop-glass head;
   `continuity.canopy` joins neighbours' slabs across the party wall as one
   slab per group cut per pand; port proportions from
   `src/canalRecall/shopCanopies.ts` then retire it); ladder window
   (`WINDOWS` + `'ladder'`: narrow light with 4–6 horizontal bars, paired per
   bay); multi-bay erker (`bayWindows.bays {from, to}`, 0.55 m deep, cap
   hip|flat|none, stallriser per storey); brick course banding
   (`bands: 'courses'` + `courseStoreys`); corner tower (`tower.corner: true`,
   square plan across both fronts, cap pyramid|flat|stepped). Each with a test
   in `streetComponents.test.ts` and byte-identity when absent. Retire the
   pilot: delete `scripts/jan-evertsen-pilot/`, `src/canalRecall/interwar*Frontage*.ts`,
   the `jan-evertsen-canopy-candidate-native-pair` profile,
   `public/canal-drive/jan-evertsen-pilot.html`; keep
   `docs/references/jan-evertsen-pilot/{beeldbank-acquisition,bag-rollout-inventory}.json`
   as survey inputs. Out of reach and stated as `schemaLimits`: sculptural
   brick, curved corner masses, recessed loggias, Berlage's arcades.
7. **Jan Evertsenstraat**: repeat 2–5 with `scripts/block-face/types/de-baarsjes/`
   (`evertsen-1925-school-erker`: lintel bands with dark plinth brick,
   two-bay erker, ladder windows, rigid canopy, crowns parapet /
   tower-pyramid-corner / raised-centre; `evertsen-1925-school-plain`),
   Beeldbank for upper storeys where trees block the panoramas; style
   groups 1920s (117), 1910s (18).
8. **Landmark lanes**: Mercatorplein twin towers and arcades (bespoke,
   photo-first inventory per `docs/buildings-pipeline.md:598`), De Hallen
   (`kind: large`), the infill large recipes; OBA Mercatorplein is installed
   and gets the Part 1 likeness pass.
9. **District look lane** (3–4 days): `DistrictStyle` table in
   `src/canalRecall/look/palette.ts` keyed by CBS buurt (walls, band, roof
   slot bias, ground paint, canopy none|fabric|rigid) with Oud-West and De
   Baarsjes entries whose values come from the face lanes' measured medians;
   a per-pand district index in the facts sidecar (`MidDescriptor`,
   `src/canalRecall/bagTiles.ts:191`, built by `build-bag-buildings.ts`) read
   by `contextualBuildingPalette` and `bayLook.ts`; the streamed tier's rigid
   canopy from the generalised `shopCanopies.ts` for `district.canopy ===
   'rigid' && shopKind` (shop kinds already come from `shopfronts.json`);
   spots at both streets in `tests/e2e/building-look.spec.ts`.
10. **Teaching check** (small): `street-knowledge.json` and
    `neighborhood-stories.json` entries for both streets, and a destination
    on each street (De Hallen, OBA Mercatorplein) so a seeded ride passes
    them; later a seeded ride spec modelled on `tests/e2e/ride-perf.spec.ts`.

### Cost

Kinkerstraat (~209 pands, 18–22 faces): ~50–60 lane-hours, about one week
with 4–5 parallel lanes. Jan Evertsenstraat (~168 pands, 12–16 faces):
~80–100 lane-hours, about two weeks after the component lane, components
dominating. Budget 20–30 % overrun from held faces (trees over 1890s ground
floors, 3DBAG misreading mansards as eaves → `measuredEaves` on a second
pass). Street lanes take the Part 1 measurement tooling as it lands; faces
are recipe data the tile compiler already consumes, so no rework against
the migration.

---

## Part 3. Bridges: from type kit to per-bridge fidelity (after Part 1 lane A)

Today: `src/canalRecall/ownGround/bridgeKit.ts` draws arch / girder /
footbridge / bascule on the measured deck spine, typed from the municipal
register via `bridgeHints.ts`; arch count is a rule by water width (one under
12 m, three to 60 m, five beyond); 600 tris per bridge (Blauwbrug and BRU0063
degrade to 4–5 segment arches, no lamps); one palette per type; 931 measured
decks, 689 flat (128 AHN gaps under trees, 127 without an OSM way through
the footprint, 111 under 2 m wide, 100 viaduct-like, 29 over 65 m, 25
unnumbered register rows, 118 movable kept flat by design); all behind
`?ownGround=1`.

Lane (3–4 days): (1) per-bridge arch count, material and railing type from
the register fields plus the nearest panoramas aimed at the bridge
(`scripts/pand-reference` select/rectify generalised to a bridge axis), with
the measured values in `bridgeHints.ts` and a `hand` override; (2) a
likeness check for bridges reusing Part 1's elevation compare (arch count,
spandrel colour family, parapet class) with a sheet per bridge; (3) budget
tiers by ride visibility (1,500 tris for named canal-belt bridges); (4) the
flat 689: a BGT bridge-polygon axis for the 127 without an OSM way, AHN DSM
for the 128 tree gaps, per-span profiles for the viaducts
(`scripts/elevation/build-bridge-surfaces-v2.ts --extra-profiles`). Named
regression: the Seven Bridges stretch of the Reguliersgracht and the
Torensluis. Default-on steps unchanged (hosting quota, desktop ride-perf).

---

## Part 4. Sculptures: reconstruction, not kits (resume the paused lane)

The prototype lane found the city's mobile-mapping point cloud catalogued
(`api.data.amsterdam.nl/v1/puntenwolk/v2`, 2025 Georizon tiles,
~2,000 pts/m²) but its download host (`files.lidar.data.amsterdam.nl`) is
NXDOMAIN (same blocker as September; contact datateam.geo@amsterdam.nl). It
set up two substitutes: PDOK's 2025 8 cm RGB surface-model cloud (CC BY 4.0,
aerial, top-down only) and TripoSR (MIT) on the M4 Pro with MPS and
scikit-image marching cubes. Resume it: PDOK clouds cut to 8 m around
Gandhi, Theo Thijssen and De Dokwerker (density, segmentation, Open3D
reconstruction, 3–8k tris), TripoSR from a licensed frontal Commons photo per
statue (timing, back and sides judged), gallery strips kit vs A vs B under
`artifacts/sculpture-reconstruction/<id>/`, `docs/sculpture-reconstruction-20261014.md`
with the route per statue class and cost. Email the point-cloud host blocker
to the city (the user's call). No statue ships without the user's look; no
more figure-kit statues.

---

## Sequencing

1. Now: finish the pending merge chain (queue 10, Tropenmuseum 3, x-ray spec,
   Singel 457 uninstall); cherry-pick the two held tooling commits; point the
   crop cache; acceptance bar into `docs/buildings-pipeline.md`.
2. Week 1: Part 1 lanes A and B; Part 4 resumed; street step 1 (type library
   schema) and the Kinkerstraat survey lane; the Amsterdam School component
   lane starts.
3. Week 2: Part 1 lane C and the texture prototype; lane D triage and
   re-fits; Kinkerstraat type library and face lanes; review lane.
4. Week 3: Part 1 held-branch re-run; Kinkerstraat tiles and ride shots;
   Jan Evertsenstraat survey; bridges lane.
5. Week 4: Jan Evertsenstraat faces, Mercatorplein bespoke, district look.

## Verification

- Unit: synthetic-crop tests for `measureFacade` (columns exact, glazing
  within 0.05, abstain at 40 % foliage), `cropToPanel` orientation,
  `likeness` thresholds, `cityLookTint` measured branch; `npm run
  test:building-recipes`, `test:fit-golden`, `large-mesh-hashes.ts` unchanged
  for untouched houses, `check:stale-installs` at 0, `test:block-kit-installed`,
  `test:geometry-audit`, `audit:glb --only-geometry` per re-fit house.
- Pilots: the five large houses hand-counted; the tool matches columns on
  4/5 and glazing within 0.10 on 4/5 before lane D runs on 100; the user
  judges the five sheets against the photos, and that is the acceptance.
- Streets: every face sheet with the camera-matched row and verdict;
  likeness calibrated on accepted faces first; ride shots at five points per
  street at gallery size; `compile-recipes.ts` changed-pand page;
  `tests/e2e/building-look.spec.ts` spots; `PW_PORT=4427 npm run check:canal`
  green on main at every merge.
- Bridges: sheet per named bridge; Reguliersgracht and Torensluis regressions
  in the own-ground e2e.
- Process: HISTORY entry per merge names the sheets viewed and the verdicts;
  the demo page shows before/after sheets, never "gates pass" alone.
