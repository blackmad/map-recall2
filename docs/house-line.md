# The house line

One pipeline from "look at a house" to "it is in the game": describe, preview, compare, stage, publish. This document
is the canonical reference; `CLAUDE.md` carries only the ten-line summary. Plan and rationale:
`docs/handoffs/house-line-plan-20261110.md` (approved by the user 2026-11-10, issue #337 onwards).

```
describe ──► preview ──► compare ──► stage ──► publish
(spec)       (PNG, 3 s)  (likeness)  (staging) (batch, integrator)
```

| Station | Lane | Status |
|---|---|---|
| §1 The record (HouseSpec) and the generic path | H1 | landed (this section) |
| §2 Preview in Node | H2 | stub |
| §3 Stage and publish | H3 | stub |
| §4 Describe at scale (crops → facts → spec) | H4 (§4a), H5 (§4b), H5h (§4c hand set) | landed on the AB07 pilot |
| §5 The kit-gap queue | H6 | stub |

## §1 The record: HouseSpec

### Why

Before the line, a house's facts lived in three record types (`facade/houseRecord.ts` `CanalHouse`, recipe intents in
`scripts/building-recipes/houses/<id>/intent.json`, block-face intents in `scripts/block-face/faces/<id>/intent.json`)
plus the monuments register (`facade/registerRecipe.ts`), and each render path read its own subset. A HouseSpec is the
one record per pand that every source writes into and every path can read.

### The fields (`src/canalRecall/houseSpec/spec.ts`)

```ts
interface HouseSpec {
  schemaVersion: 1;
  pandId: string;                       // 16 digits, no NL.IMBAG.Pand. prefix
  address?: string;
  design: DeepPartial<HouseDesign>;     // CanalHouseIntent minus identity: fronts[], roof, palette, notes
  facts?: { facadeYear?: number; elements?: string[]; pui?: 'shop' | 'residential' | 'warehouse' };
  provenance: Record<string, Prov>;     // keyed by field path
  schemaLimits?: { component: string; what: string }[];
  route?: 'generic' | 'recipe';         // derived by toRecipe.ts withRoute
}
type Prov = { source: SpecSource; confidence: number /* 0..1 */; ref: string; at: string | null /* YYYY-MM-DD */ };
```

- **Vocabulary.** `design` is the vocabulary recipes and block faces already speak (`buildingRecipe/intent.ts`
  `FrontIntent`, `RoofIntent`, `PaletteIntent`). Nothing new to learn; every field is optional.
- **`facts`** holds what a source states that the design has no field for: the year the street front dates to (drives
  the era palette), the register's elements as wall-extra component ids, the ground-floor kind a judge saw.
- **Field paths** (the unit of provenance and of the merge): one key of one front (`fronts/0/gable`), one key of the
  roof or palette (`roof/material`, `palette/brick`), `notes`, one key of `facts` (`facts/facadeYear`). Values below
  that level (a `windowHead` object, a per-storey `bays` list) are atomic: two sources never splice one window head.
- **Provenance** is keyed by field path; an ancestor key covers every field under it (`fronts/0`, or `` for the whole
  record, which is what an adapter for a single-source record writes). `resolveSpecs` writes one key per field.
- **`schemaLimits`**: what the photo shows that the kit cannot say, one `{component, what}` per kit part (the shape of
  `BlockFaceIntent.schemaLimits` on a1's belt lanes). `component` is the kit part (`gable ornament`, `ground storey`,
  `palette`); the kit-gap queue (§5) keys on it. Legacy `"component: what"` strings are read by `toSpecLimit`; a line with
  no component is filed under `facade`. Never fit the nearest option instead of recording the limit.
- **Several fronts on one facade** (`design.fronts[]`, H5h round 3): a pand whose street wall carries more than one house front
  has one `fronts[]` entry per front, left to right, each with its `share` of the wall (0..1). `specProblems` checks it per
  facade (fronts grouped by `street`; no street = one facade): two or more fronts on a facade each state `share` and the shares
  sum to 1 (+-0.02); one front per street needs none; `share` is 0..1 and `street` a name. Schema and validator only: no renderer
  change, and every staged and generated spec validates byte-identically (the staged house-specs tiles hash the same before and
  after). The hand set's six separable multi pands are `data/house-line/hand-set-v1.multi-specs.json`.
- **`storeys`** (`fronts/N/storeys`) has one definition, used by every writer, reader and checker (H5, H9, H1c):
  **full street-facing storeys, counting neither a souterrain nor an attic in the crown**
  (`STOREYS_DEFINITION`, `handSet.ts`). The ground storey counts once however tall; an entresol inside it, gable, crown and
  roof windows, dormers and a set-back roof storey do not count; a bel-etage over a souterrain is storey 1. Heights stay BAG's
  (eaves, ridge); the storey count of the front is not derived from them (§4c).
- **`route`**: `recipe` when `toRecipe(spec)` returns a `CanalHouseIntent` that `validateIntent` accepts (complete
  fronts, roof and palette, and at least one dated receipt that maps to an intent source kind), else `generic`.

### Trust order

`facade/evidence.ts` `SOURCE_STRENGTH`, weakest first:

`default` < `osm` < `3dbag` < `ahn` < `pdok-ortho` < **`vision-judge`** < `bag` < `monument-text` <
`streetlevel-measured` < `reviewed` (= **`author`**)

`vision-judge` (a Jev typed judgement of a street crop) was added 2026-11-10 between `pdok-ortho` and `bag`; `author`
(a hand-written spec) ranks as `reviewed`. `resolveSpecs(parts)` (`resolve.ts`) picks, per field, the strongest source,
then the higher confidence, then the newer evidence date (`resolveField`'s order); a full tie keeps the earlier part.
Nothing is invented: a field no part states stays absent.

### Sources today (`adapters.ts`)

| Adapter | Reads | Source | Ref |
|---|---|---|---|
| `fromRegisterFacts(facts, nr, pandId)` | `monument-facts.json`: gable, facade year, finish → `palette.wallMaterial` (stone → a schema limit), hoist beam, stoop, elements → `facts.elements` | `monument-text` (gable 0.8, year 0.7, a period 0.5) | `rce:<nr>` |
| `fromBlockFace(face, pandId)` | one house of a face via `houseIntents`; limits from `rhythm.schemaLimits`, face `schemaLimits` naming the pand (or naming no pand: face-wide), face `limitations` naming the pand | `streetlevel-measured` (0.85 authored, 0.6 auto-placed) | the face's `strip.json` |
| `fromRecipeIntent(intent)` | `kind: canal-house` only (large/landmark return null) | its strongest `sources[]` kind | `<intent path>#<source id>` |
| `fromHouseRecord(record)` | facade-twin `CanalHouse`: observed fields only; trap→step, hals→neck, verhoogde hals→raised-neck, klok→bell, tuit→spout, punt→point, lijst→cornice | each field's own receipt | its observation id |
| `fromJev(judgement)` | bays, pui, a *confident* gable, finish; answers under p 0.5 dropped | `vision-judge`, confidence = p | the crop |

Hand-written specs live in `scripts/house-specs/specs/<pandId>.json` (validated by `validateSpec`; use source `author`).

### How to add a source

1. Write a pure adapter in `adapters.ts` that returns a partial `HouseSpec`: set only the fields the source states,
   each with a receipt (`provenance[path]`, or `provenance['']` when one receipt covers the record).
2. If the source is a new kind of evidence, place it on `SOURCE_STRENGTH` with a comment saying why it ranks there.
3. Unit-test it on a real record from the repo (`adapters.test.ts`).
4. Read it in `scripts/house-specs/build-house-specs.ts` (one `add(...)` loop) and rerun `npm run house:specs`; the
   coverage report counts pands per source.

### The extract

`npm run house:specs` (`scripts/house-specs/build-house-specs.ts`, `--help`) resolves every pand with a source and
stages `public/data/extracts/amsterdam/staging/house-specs/14/<x>/<y>.json.gz`:
`{version: 1, buildings: {"NL.IMBAG.Pand.<id>": {d, x, s, l, r, v}}}` = resolved design, facts, winning source per
field, limits, route and the runtime view `v`. The coverage report goes to `staging/house-specs.coverage.json`.
`--publish` copies the staged tiles to `house-specs/14/` (integrator only, after reviewing the coverage diff).
`scripts/world/pipeline.ts tileInputs(t)` hashes `house-specs/14/<t>.json.gz`, so a spec edit recompiles only the cells
of its tile.

First run (2026-11-10): 7,224 pands (register 5,958; 280 block faces = 1,314 houses; 35 canal-house intents),
7,150 in 55 tiles, 300 kB gz; 1,296 recipe-route, 5,928 generic.

### The generic path reads it (flag `?houseSpecs=0`, `HOUSE_SPECS=0`)

- `houseSpec/decorate.ts houseSpecEnricher`, composed last in `gameTileEnricher.ts`, stamps the runtime view on each
  raw feature as `p.houseSpec` = `{gable, year, wallMaterial, wallHex, bays, src}`.
- `withHouseSpec` runs right after the register step (before `decorateFacade`): it moves `constructionYear` only on an
  era change (the register's rule), sets `registerFinish` from `wallMaterial`, and writes `specRecipe`
  `{bays, wallHex, period, crownShape}` when the spec has bays or a wall colour.
- `withHouseSpecCrown` runs after `withMonumentGable` (which would otherwise restore the register's gable): it sets
  `monumentGable` when the spec's gable source outranks `monument-text`, or when nothing named a gable.
- The view carries a street-measured gable to the roof planner only for a full-width step/neck/raised-neck/bell/
  spout/point crown on a roof that is not flat; a cornice or flat front, or a crown over some bays, stays in the record
  (the roof planner draws a monument gable as a canal house's whole roof; measured on the first full compile, cornice
  fronts gave 681 flat-roofed 1890s pands a pitched canal roof).
- `threeBuildingFeatures.ts meshBuildingFor` keeps `specRecipe` as `MeshBuilding.specRecipe` (not `.recipe`: that slot
  switches every wall to recipe openings and street-crown recolouring). A measured `wallHex` would be a sourced wall in
  the photo look, but it is **held** (`decorate.ts SPEC_WALLS_HELD`): strip colours are overcast readings and drew
  Kinkerstraat 244-332 darker than the generic palette. Release after a white-point pass and a panorama side-by-side. `streetFacadeRendering.ts frontageLayoutScale` fits a street run to the stated bays:
  cells = round(bays / window axes per cell), clamped to 0.7–1.5 of the style's bay. The generic cells carry two or
  three window axes, so an odd bay count on a two-axis cell rounds (a limit of the generic path, not of the spec).
- Byte-identical off: with `HOUSE_SPECS=0` the world compile is identical to origin/main (605 of 605 cell files).
  On: 85 of 604 cells differ, only in the 7,134 spec'd buildings (+31 kB gz). On the generic path (pands no installed
  model hides, `scripts/house-specs/measure-generic-effect.ts`): 403 carry bays, about 175 of them change cell count;
  29 change gable.
- The live paths compose the same steps: `public/canal-drive/js/vector-map.js` (the page's tile streamer) and
  `engine/ownWorldView.ts`, through the `CanalRecallThreeBuildings` globals (`houseSpecEnricher`, `withHouseSpec`,
  `withHouseSpecCrown`, `houseSpecsEnabled`). World-v1 cells carry the bake; `?houseSpecs=0` only affects `?world=live`.

### Which specs a world carries

`world:compile` writes the stamp into world-v1 `index.json` (`houseSpec/extractStamp.ts`, via
`pipeline.ts houseSpecsIndexStamp`): `"houseSpecs": "on"` plus
`"houseSpecsExtract": {"dir": "house-specs", "tiles": 55, "hash": "<sha256>"}`, or `"houseSpecs": "off"` alone. The hash
is sha256 over the sorted `path:sha256(bytes)` lines of `<dir>/14/**`, so it changes only when a spec tile's name or
content changes. Only `index.json` carries it. `tiles.json` and the cell `.bin` files are unchanged by the stamp.

### Rollback

**On the baked default world, `?houseSpecs=0` does nothing**: the specs are compiled into the world-v1 cells. To roll
back, recompile with `HOUSE_SPECS=0` (`HOUSE_SPECS=0 npm run world:compile -- --shell`; its `index.json` then says
`"houseSpecs": "off"`) and republish that world-v1, or republish the previous world-v1. `?houseSpecs=0` works only
with `?world=live`, where the live tile streamer runs the decorators in the browser.

### Where to look next

`spec.ts` (types, paths, validation), `resolve.ts` (merge), `toRecipe.ts` (recipe route), `adapters.ts` (sources),
`decorate.ts` (runtime), tests beside each (`npm run test:house-spec`).

## §2 Preview in Node (`house:preview`)

Seeing a house used to mean a world recompile, a bundle rebuild, a dev server and Playwright: minutes per look.
`npm run house:preview` renders one house's front elevation in Node through the game's own code and by the route
the game draws it (installed GLB or generic chunk), in the ride's lit city look, in about two seconds from a cold
start and 0.1–0.3 s per re-render in `--watch`.

```sh
npm run house:preview -- 0363100012164843                 # front.png + measure.json
npm run house:preview -- 0363100012164843 --photo --threeq # + compare.png (render | photo) and a 3/4 view
npm run house:preview -- --intent scripts/building-recipes/houses/cw-heren-175702/intent.json --watch
npm run house:preview -- 0363100012175702 --recipe --photo # the recipe route (compiled GLB)
npm run house:preview -- 0363100012236681 --threeq         # installed chunk (covers.json) by default
npm run house:preview -- 0363100012236681 --route generic  # what the generic path would draw there
npm run house:preview -- 0363100012164843 --unlit          # the legacy unlit look (H2's first sheets)
```

### Routes

| Route | When (default) | What renders |
|---|---|---|
| `installed` | `public/canal-drive/models/covers.json` lists the pand under a `chunk-*` or `ordinary-*` model | the model's GLB (`loadMaterialSoup`), placed as the runtime places it (`ordinary-buildings-data/chunks.json` `instance`, or the ordinary catalogue's `instance ?? anchor`: +X toward bearing 90 + `northOffsetDegrees`, +Z out of the front, `mirror` flips X), each material in its game colour (`likeness.ts` `gameColour`) |
| `spec` | `--spec`/`--intent` given | the generic path with the override on the source properties (until H1's resolver) |
| `generic` | nothing installed | the streamed generic chunk below |
| `recipe` | `--recipe` | the recipe compiler's GLB, placed from `report.anchorRD` (RD → WGS84 per vertex) |

`--route generic|spec|installed` forces one. A landmark cover is not rendered: the default falls back to `generic` and
says so. The route and why it was chosen are printed, written to `measure.json` (`route`, `routeWhy`) and shown in
the sheet header.

### Look

The default is the ride's lit city look (`look/cityLook.ts` `createCityLookMaterial`, lit, flat-shaded, under
`rendererShared/lightRig.ts` `SUNNY_LIGHT_RIG`), computed by `houseSpec/previewLight.ts` and drawn by
`softRaster.ts`: `cityC = cell × mix(1, tint, m.r) × mix(1, accent, m.g) × mix(1, wallGain, m.r)` with
`wallGain = litFacadeWallGain(photo) × CITY_LIT_LEVELS.sunny` (1.186), albedo `cityC^2.2`, Lambert
`albedo / π × (sun · max(n·l, 0) + mix(ground, sky, ½ n_z + ½))` with the rig's linear colours × intensities (sun
azimuth 215°, elevation 40°), `SKY_TINT` emissive on dark untinted texels, then sRGB. The baked shade in `tint.a` is
not used (the lit path ignores it, as the game's does). A GLB route's front draws flat game colours
(`renderElevation`), because that is what matched the ride: the rig's Lambert on game colours drew the installed
wall 0.11 L dark (`--glb-lit` opts into it; the 3/4 view of a GLB is always lit, for shape). `--unlit` keeps the legacy look: the near-tier unlit shader with the baked shade for chunks, `renderElevation` flat
colours × its facing shade for GLBs.

**Gate (lane H2b):** the preview's wall is within ΔL 0.03 of the same wall in a ride frame
(`tests/e2e/demo-shots.spec.ts` spots `house-preview-*`, `DEMO_SPOTS=… PW_PORT=… /tmp/canal-pw.sh npx playwright
test tests/e2e/demo-shots.spec.ts --project=desktop`). Median of a hand-picked wall-only patch, HSL L, 2026-11-10:

| Wall | Preview | Ride frame | ΔL |
|---|---|---|---|
| Nassaukade 0363100012164843, generic, faces 85° (sky only), lit | `#3d2722` L 0.186 | `#3c2721` L 0.182 | +0.004 pass |
| same, `--unlit` | L 0.192 | | +0.010 |
| Nassaukade face of 0363100012116526, installed `chunk-face-clercq-236681`, flat game colours | `#8a6b61` L 0.461 | `#856b62` L 0.453 | +0.008 pass |
| same, `--glb-lit` (rig Lambert on game colours) | L 0.347 | | −0.106 fail |

Not yet gated: a sun-facing wall (the `house-preview-169916` frame did not show 0363100012169916's front clearly
enough to pick a patch). The 116526 frame also confirms what the installed route drew: the corner chunk's Nassaukade
face is a blank wall in the game.

### Glazing: one pre-blur

`PRE_BLUR_PX = 1.5` (`houseSpec/previewVerdict.ts`, a Gaussian sigma in px at 50 px/m) blurs every image, the
preview, the `render.ts` frame and the photo, before `measureFacade`. The raster's hard-edged mullions and the
Chromium frame's antialiased ones fell either side of the glazing threshold; a photo is soft at the lens already.

### Wall vs trim (lane H2c)

`measureFacade` reports the **wall** colour: the dominant colour by area outside the openings. Cornices, sills, window
frames, quoins and speklagen are **trim**: thin, pale bands that run in the floor zones. White still wins when it is the
dominant area (a plastered or white-painted front), because the rule only fires when something darker outweighs the band.

Before H2c, on a dark front with white bands (the Nassaukade 0363100012164843 render: brown wall `#3d2722`) the pale band
cluster is enriched in the floor zones and the dark wall is not (enrichment 0.83 < 0.9), so the band was taken as the wall
(`#b0a99a`) and the real wall counted as glazing. `src/canalRecall/buildingRecipe/wallTrim.ts` `wallVsTrim` is the one rule,
with the named constants `WALL_VS_TRIM`: a cluster in the wall set is a **band** when it is pale (L* >= 45), near-neutral
(chroma < 12) and thin (< 35 % of its cells have all eight neighbours in it). A band leaves the wall set when a cluster that is
**not glass-like, warm (a + b > 12, b > 4), solid (>= 35 %), at least 20 L* darker, at least 15 % of the clustered cells and no
smaller than the band** exists; that cluster (and the tones within dE 12 of it) is the wall. The two guards beyond the area
test came from the large-tier replay: without "warm" and "neutral band" the rule moved eight installed photo groups, among
them a glass front read as dark wall (Zuidoost Gaasperdam walls[0], Schaafstraat 17 walls[1]); with them it moves none.

`wallVsTrim: false` on `MeasureInput` (`--no-wall-vs-trim` on `preview.ts`, `gate.ts` and `likeness-replay.ts --replay`)
is the pre-H2c reading. Pinned by `wallTrim.test.ts`: eight hand-labelled fronts (`fixtures/wall-trim/cases.json`: the
Nassaukade render and photo, 161422, the two recipe fronts, the 116526 strip crop, two white-painted slabs) with a wall
colour radius, trim yes/no and glazing +-0.1, plus the rule on cluster statistics. Known limit at H2c, worked on in lane H2d below: on a
dark front the opening pass filled every storey into one frame (glazing 0.86; hand-drawn openings say 0.37, not the 0.25 first
read by eye).

The replay behind the no-flip claim: `likeness-replay.ts --dump` (needs `MAP_RECALL_SOURCE_DATA`), then `--replay` with and
without `--no-wall-vs-trim`, then `--diff`: 448 groups of 160 installed large houses, 0 verdicts and 0 reasons moved.

### Openings and a stable wall (lane H2d)

H2c fixed which cluster is the wall. Two gaps were left, and H7 (the timed pilot) is judged on both: glazing on dark fronts,
and a wall estimate that moves when the box moves. `measureFacade` now takes `openingSplit` (true = all four parts, false = the
pre-H2d reading, or an object naming parts; `--no-opening-split` / `--opening-split=<parts>` on `preview.ts`, `gate.ts` and
`likeness-replay.ts --replay`). Parts, each behind its own switch because each was measured on the 448-group replay alone:

| Part | What it does | Replay (448 groups) | Default |
|---|---|---|---|
| `groups` | `facadeOpenings.ts` step 1: the frame-like ring test runs per material group (wall clusters within dE 12), not per cluster. A dark front's wall splits into a body cluster and a lighter one dithered with it; the lighter one touched every opening, so it read as a ring and the whole storey filled into one frame (0.86 glazing, eye 0.37). | 0 verdicts moved, 3 reasons | on |
| `solidBody` | `wallTrim.ts` rule B: a thin picked cluster (< 35 % solid) gives way to a solid wall-set cluster of at least 15 % and 0.8 x its share (slate wall #353240 against the cornice, lintel and sill cluster that is enriched 2-3x in the floor zones); and rule A's area test takes a 20 % smaller dark body (0.222 against 0.229 split a render on a 10 cm box change). | 0 verdicts moved, 4 reasons | on |
| `core` | step 4a: an opening piece is its dark glass core (dark cells, and pale cells of a solid cluster: a sky-lit pane) plus a one-cell frame; a lintel, sill or surround strip of <= 0.5 m beyond the glass is trim. Pale upper sashes of a muntined window are as wide as the glass and taller than a strip, so they are never cut. | **8 verdicts moved** (7 worse, 1 better), 66 reasons | off |
| `clusterWall` | the wall colour is the median over the picked wall cluster's own cells (with the wall-set clusters within dE 12 of it), whatever the opening pass made of them, not over the body cluster with the most interior cells: that count moved with a 10 cm box change and swapped a slate wall for its lintels. | **5 verdicts moved**, 88 reasons | off |

`core` and `clusterWall` would flip installed verdicts, so they stay behind the flag (`OPENING_SPLIT_DEFAULT` in
`measureFacade.ts`); `OPENING_SPLIT_ALL` is what the gate below judges.

**Labels.** `src/canalRecall/buildingRecipe/fixtures/wall-trim/openings-labels.json` holds, per front, the window openings drawn by
hand on a metric grid over the crop (lattices of equal windows and loose rects in box metres, glass and frame, not the lintel or
sill) and `handLabels.ts` turns them into a glazing share of the counted band (v >= 2.5 m up to the wall's top). This replaces H2c's
"about 0.25 by eye": drawn out, the Nassaukade 164843 render is 0.375 (two windows of 1.6 x 2.1 m on a 3.1 x 5.5 m storey), 161422 is
0.41 and Haarlemmerweg 940 is 0.27, not 0.40. Twelve fronts: H2c's eight plus four H4 Bloemgrachtbuurt (AB07) crops, copied into
the fixtures (`ab07-*.jpg`, Amsterdam panoramas CC BY 4.0): 0363100012173056 (a white-painted canal house, strip route),
0363100012168006 (black wall, white frames, the dark case the brief names), 0363100012168698 and 0363100012169846 (dark grey and
dark brick). Raw wall labels for these are the median of a hand-chosen bare-wall patch (`wallPatch`); the measured raw wall agrees to
dE < 6 on all four.

**Gate** (`node --import tsx scripts/house-preview/openings-gate.ts`, the 12 fronts; box jittered +-10 cm on u0, u1 and v1, one edge at
a time and every corner, 15 boxes):

| front | hand | glazing: before | default | all four parts | wall HSL L spread: before | default | all |
|---|---|---|---|---|---|---|---|
| nassau-164843-render | 0.375 | 0.864 | 0.592 | **0.473** | 0.437 | 0.002 | 0.004 |
| nassau-164843-photo | 0.368 | 0.699 | 0.728 | 0.728 miss | 0.341 | 0.304 | **0.014** |
| nassau-161422-render | 0.408 | 0.797 | 0.546 | **0.404** | 0 | 0 | 0.002 |
| heren-175702-render | 0.443 | 0.338 | 0.338 | 0.338 (-0.105, miss by 0.005) | 0.002 | 0.002 | 0.002 |
| keizers-171052-render | 0.52 | 0.479 | 0.479 | 0.401 (-0.12, miss) | 0.01 | 0.01 | 0.01 |
| nassau-116526-strip | 0.357 | 0.304 | 0.304 | 0.293 | 0.004 | 0.004 | 0.004 |
| haarlemmerweg-940-white | 0.27 | 0.259 | 0.259 | 0.259 | 0 | 0 | 0.002 |
| marnixstraat-248-white | 0.45 | 0.42 | 0.42 | 0.42 | 0 | 0 | 0 |
| ab07-168006-dark | 0.401 | 0.701 | 0.701 | 0.557 miss | 0.006 | 0.006 | 0.004 |
| ab07-173056-white | 0.441 | 0.38 | 0.38 | 0.38 | 0.002 | 0.002 | 0.002 |
| ab07-168698-dark | 0.498 | 0.18 | 0.18 | 0.18 miss | 0.002 | 0.002 | 0.002 |
| ab07-169846-dark | 0.555 | 0.806 | 0.806 | 0.716 miss | 0.02 | 0.02 | 0.02 |
| within +-0.10 | | 5/12 (1 of 7 dark) | 5/12 | **6/12 (2 of 6 dark)** | max 0.437 | max 0.304 | **max 0.02** |

The wall spread gate (<= 0.02) is met with all four parts on. The glazing gate is **not** met: 6 of 12 fronts are within +-0.10 and
the dark ones are 2 of 6 (the render and 161422). `handLabels.test.ts` pins the six misses at today's reading (+-0.02) so the test
fails when one is fixed and the label is promoted. Causes, traced: the photo's panes are lighter than its wall and split between
clusters (164843 photo, 168006: a light pane block that merges with the cornice and with its neighbour); the windows of 168698 read
as one wall-coloured cluster (the colours cannot separate a black pane from a black wall; the white frames would, and a frame-ring
detector was tried on 168006 and found nothing because its panes are light blocks, not rings); muntined windows with pale upper
sashes lose 0.05-0.10 against the label (heren, keizers). The 0.10-wide gate is tight against hand rectangles that include the frame.

**Replay.** `likeness-replay.ts --dump`, then `--replay` per reading, then `--diff` against the H2c baseline (FAIL 263, NO EVIDENCE
94, WARN 69, PASS 22): default (`groups` + `solidBody`): **0 verdicts moved**, 7 reasons moved, 441 same (FAIL 263, NO EVIDENCE 94, WARN 69, PASS 22, unchanged);
all four parts: 13 verdicts moved, 139 reasons moved (FAIL 270, NO EVIDENCE 94, WARN 62, PASS 22): the model side of the comparison is frozen
in the dump and counts its windows whole, so a photo that now reads fewer, trimmed windows drifts from it. Whether the comparator or the
reading is right is the integrator's call; nothing is flipped until then. `groups` and `solidBody` alone: 0 moved each.

### Glazing does not decide a likeness verdict (house line)

In every house-line verdict (`previewVerdict`: `house:preview --photo`, its gate, and later `house:describe`, H7 and H9) glazing is
**informational**: printed (`glazing (info) a vs b` in the sheet title, `verdict.glazing` in `measure.json`), never a PASS or a FAIL.
The verdict is decided by the **wall colour family** (dL <= 0.12, hue <= 12 degrees), the **window column count** (+-20 %), the
**storey count** and the window shape class. A column or storey miss is a FAIL (the column miss used to be a WARN). Reason: glazing
is the least reliable number the measurer produces on a photo (the hand-drawn gate in "Openings and a stable wall" has six pinned
misses of 0.1-0.36), while the installed-house gate (`likenessGate`, `install-large`) keeps its own glazing tolerance untouched.

**Measure profiles** (`measureFacade.ts` `MEASURE_PROFILES`): `installGate` = groups + solidBody, the 0-flip reading (the 448-group replay
moves no verdict; it is the `measureFacade` default, so `likenessGate`, `install-large` and every caller that names no profile use it);
`houseLine` = groups + solidBody + core + clusterWall, used by `house:preview` and its gate. Every sheet header prints
`measure profile <name>`, and `measure.json` carries `profile`. `--no-opening-split` and `--opening-split=<parts>` override it (the
header then says `pre-H2d` or `custom`).

### 3/4 view

`--threeq`: a 20° vertical field of view from 38° off the wall's normal, far enough to hold 1.6 × the wall, eye at
0.9 × the house's height, over a flat ground plane at the median of the drawn buildings' lowest vertices (the GLB's
base on the installed route), pavement-coloured under the same light.

### What it runs

| Step | Code (the runtime's own) |
|---|---|
| Source + decorators | `scripts/world/pipeline.ts` `gameChain()` + `loadTile()` (`useBrowserMath` first, as the compiler) |
| Chunk and context | the pand's z14 tile buildings within 30 m of it, in tile order (`--whole-tile`: the whole tile, the runtime's group); party-wall context from `BuildingContextIndex` over that tile and any adjacent tile within 60 m, with the runtime's exclusion rule |
| Street fronts | `scripts/world/shellBake.ts` `shellStreets` / `shellProfiles` |
| Mesh | `threeBuildingFeatures.ts` `buildFeatureChunk(…, 'walls')` then `'extras'` (ORIGIN-local metres, x east, y north, z up) |
| Atlas | `look/paintLookAtlas.ts` `paintLookArrays` under `scripts/house-preview/nodeDom.ts` stubs (@napi-rs/canvas) |
| Raster | `src/canalRecall/houseSpec/softRaster.ts`: perspective-correct uv, `fract` wrap, bilinear colour + mask by vertex layer, the lit city look (see "Look") or the unlit shader's `c *= mix(1, tint, m.r) * mix(1, accent, m.g)` × the shade in `tint.a`, z-buffer, back faces culled (drawn for GLBs), 2×2 supersampling |
| Front wall | `staging/pand-reference/<pand>/reference.json`'s wall when there is one (photo and render share one axis at 50 px/m), else `scripts/pand-reference/select.ts` `pickWall` (the rule `rectifyWall`'s callers use) |
| Likeness | `buildingRecipe/measureFacade.ts` on render and photo, both blurred by `PRE_BLUR_PX` first, judged by `houseSpec/previewVerdict.ts` with `likeness.ts`'s tolerances: wall ΔL ≤ 0.12, hue ≤ 12° (both saturated), mean glazing ± 0.15, window columns ± 20 % (a WARN), window shape class |

The recipe route (`--recipe`) compiles `scripts/building-recipes/houses/<id>` with `compile.ts` and renders its GLB
like an installed one, then the same measurement. One command covers every route.

### Output and cache

- `artifacts/house-preview/<pand>/front.png`, `threeq.png` (`--threeq`), `photo.png` + `compare.png` (`--photo`), `measure.json`
  (wall, heights and storey lines, chunk counts, the decorated properties, overrides applied and not applied, both
  measurements, the verdict, timings).
- Atlas cache: `artifacts/house-preview/atlas-<look>-<size>-<hash>.bin`, colour RGBA then mask RG
  (`look/lookAtlas.ts` byte layout). The hash covers the painter's import closure, the brick photo and the Node
  stubs; the first run paints (~0.8 s), later runs load (~0.1 s).
- Pand → tile index: `artifacts/house-preview/pand-tiles.json`, built by one scan of the building tiles (~0.3 s) the
  first time a pand is missing from it.
- Photos: `staging/pand-reference/<pand>/front.jpg` (make one with
  `npx tsx scripts/pand-reference/run.ts --name=<run> --ids=<pand>`; set `PAND_REFERENCE_CACHE` to the main
  checkout's `.cache/pand-reference` to reuse its panoramas), else the block-face strip crop of the wall
  (`scripts/block-face/faces/*/strip.json`, image from `staging/block-face/<face>/strip.jpg` or
  `$MAP_RECALL_SOURCE_DATA/block-face-strips/<face>/strip.jpg`).

### What the raster does not reproduce

The far and roof distance tiers, mipmaps and the cell-tap prefilter, cast shadows (a wall in another building's
shadow draws sunlit; the rig's shadow fill is 0.5), fog, the analytic window SDF, the ground lift and
post-processing. GLBs draw their materials' game colours flat: the slot cells (brick grain, stucco, glass panes)
and per-slot lit gains of the city look are not sampled. The chunk holds the pand's row (its tile's
buildings within 30 m), not the whole group tile: a building's mesh depends on its chunk-mates (alone, with the row
only as context, the Nassaukade pand lost its window heads and balconies), and the row drew byte-identical pixels to
`--whole-tile` there; use `--whole-tile` (~4 s a render) when in doubt. Overrides: until H1's resolver lands, only the front's
gable (`monumentGable`) and the wall hex (`palette.wall`/`palette.brick` → `facadeMappedColour`) reach the generic
path; every other design field is listed under `overrides.notApplied` in `measure.json`.

**When to fall back to `render.ts`:** when the question is cast shadow, a distance tier or a GLB's slot materials,
render the GLB with `scripts/building-recipes/render.ts` (headless Chromium under `/tmp/canal-pw.sh`) or take a
ride frame; for shape, rhythm, openings and wall colour, the preview is the tool.

### Measured (2026-11-10, the user's Mac, other lanes running)

| Run | Time |
|---|---|
| Cold, atlas cached (`time npm run house:preview -- 0363100012164843`) | 1.5–1.8 s wall (0.95–1.3 s in the script; Node + tsx start the rest) |
| First run, atlas painted (186 layers at 256 px) | 3.7 s wall (paint 0.8–1.2 s) |
| `--watch` re-render, front only | 0.09–0.20 s |
| `--watch` re-render with `--photo` (two measurements + sheet) | 0.18–0.35 s |
| `--whole-tile` (6,364 buildings in the chunk) | ~4.8 s |
| `render.ts` (Chromium + SwiftShader): first frame in-process, browser launch and bundle included | 1.76 s |
| `render.ts` further frames in the same browser | 0.06–0.13 s |

`render.ts` is not slower per frame; it renders a GLB, and the generic streamed path (most of the city) has none.
The preview's gain is that it needs no GLB, no compile, no dev server and no browser lock (`/tmp/canal-pw.sh`
waits measured 40 s on 2026-11-10).

Acceptance sheets: `scripts/house-preview/gate.ts` puts the preview beside the `render.ts` frame of the same pand's
GLB and the photo (`/tmp/canal-pw.sh node --import tsx scripts/house-preview/gate.ts --face=<face>:<pand> --recipe=<house>`).

### Suppressed-face audit (issue #341)

`node --import tsx scripts/house-audit/suppressed-faces.ts` (its HELP is `--help`; an npm script is the integrator's to add) lists every pand that a chunk-*, ordinary-* or landmark-* model suppresses in `models/covers.json` and checks its street-facing BAG walls (at least 4 m, on a named road in `streets-routing.json`, not party walls) against the placed model at 25 %, 50 % and 80 % of the BAG height (the roof maximum). A wall is blank when it is blank at 25 % or 50 %: no outward geometry, or a bare slab (every outward plane vertex on the wall's two ends, the H2b blank wall). A wall blank only at 80 % stops short of the eaves: a setback, gable or mansard may stand above it, so it is reported apart. The self-check must pass before the numbers count: 0363100012116526's Nassaukade walls are bare slabs (blank), 0363100012236681's De Clercqstraat face is drawn. `scripts/house-audit/contact-sheet.ts` draws the rows: each top-20 blank wall and three stops-short examples, framed on the flagged wall with `house:preview --wall <edge>` (`scripts/house-preview/wallSelect.ts`), plus the ride frames of the audit spots. Output: `artifacts/house-audit/suppressed-faces.json` (gitignored); sheets under `ui/2026-11-10-suppressed-faces/` in the screenshots repo.

### `--help`

The command prints this text (`HELP` in `scripts/house-preview/preview.ts`; `scripts/house-preview/help.test.ts`
fails when the two differ):

```text
npm run house:preview -- <pandId | spec.json> [flags]

Renders one house's front elevation in Node through the route the game draws it by: the installed GLB (chunk or
ordinary model) when models/covers.json covers the pand, else the game's own chunk builder (threeBuildingFeatures
buildFeatureChunk, the decorator chain of scripts/world/pipeline.ts) and facade atlas painter. A software rasteriser
(src/canalRecall/houseSpec/softRaster.ts) draws it in the ride's lit city look. No dev server, no browser.

  <pandId>            BAG pand id (0363100012164843 or NL.IMBAG.Pand.0363100012164843)
  <spec.json>         a house spec file: { "pandId": "...", "design": { fronts, roof, palette, ... } }
                      (same as --spec <file>)

Flags
  --route <route>     generic | spec | installed. Default: spec when --spec/--intent is given, else installed when
                      models/covers.json covers the pand with a chunk-* or ordinary-* model, else generic (what the
                      game draws). A landmark cover is not rendered (generic, with a note)
  --spec <path>       apply a house spec's design to the pand before the decorators run (see "Overrides")
  --intent <path>     apply a CanalHouseIntent (scripts/building-recipes/houses/<id>/intent.json or a block-face
                      house intent) the same way; its pandId names the pand when no pand id is given
  --photo             add the reference photo: staging/pand-reference/<pand>/front.jpg, else the block-face strip
                      crop of the pand's wall (scripts/block-face/faces/*/strip.json); writes compare.png and prints
                      the likeness verdict (wall dL/hue, glazing, columns, window shape) of render vs photo
  --threeq            add a three-quarter perspective view (threeq.png): 20 degree field of view, flat ground at
                      the median ground height of the drawn buildings
  --recipe [<id>]     the recipe route: compile scripts/building-recipes/houses/<id> (default: the house whose
                      intent names this pand) with the recipe compiler and render its GLB
  --unlit             the legacy unlit look: the near-tier facade shader with its baked shade for generic chunks,
                      renderElevation in flat game colours for GLBs (default: the lit city look for generic chunks,
                      sun and sky of the ride's sunny rig, wall gain, sky tint on glazing)
  --no-wall-vs-trim   measure the wall as before lane H2c: a pale thin band may be picked as the wall on a dark front
                      (default: wallTrim.ts, the dark body outweighing the bands is the wall)
  --opening-split=<p> measure with the named opening-split parts only (groups, core, solidBody, clusterWall; comma-separated)
                      instead of the house-line profile (all four parts); every sheet header names the profile used
  --no-opening-split  measure as before lane H2d: every storey of a dark front fills into one frame, the wall colour is the
                      median of the body cluster with the most interior cells (default: each opening is its glass plus
                      a one-cell frame, lintels and sills are trim, the wall is the median over the picked wall cluster)
  --glb-lit           draw a GLB route's front through the rig's Lambert too (default: flat game colours,
                      which matched the ride frame; the Lambert drew an installed wall 0.11 L dark)
  --wall <edge|deg>   frame this footprint wall: an edge index of the outer ring (the audit's edge field) or the edge whose outward
                      normal bearing is nearest, e.g. 215deg. Sets the front and the 3/4 view's wall; overrides the reference's wall
  --whole-tile        build the chunk from every building of the pand's z14 tile, exactly as the runtime groups
                      it (~4 s a render); by default the chunk holds the tile's buildings within 30 m of the pand,
                      which drew the same pixels as the whole tile at Nassaukade (0363100012164843)
  --watch             keep tile, neighbours, streets and atlas in memory and re-render whenever the spec/intent
                      file changes (needs --spec or --intent)
  --look <look>       atlas look (default photo)
  --ppm <n>           pixels per metre of the front elevation (default 50, the rectified photos' scale)
  --out <dir>         output directory (default artifacts/house-preview/<pand>)
  --help              this text

Verdict: wall colour family (dL, hue), window column count, storey count and window shape decide; glazing is printed
(information), never a PASS or a FAIL.

Output: <out>/front.png, threeq.png (--threeq), photo.png + compare.png (--photo), measure.json (route, timings, wall,
overrides, measurements, verdict). The sheet header names the route and the look. Render and photo are both blurred
by PRE_BLUR_PX (1.5 px Gaussian sigma at 50 px/m) before measureFacade. Atlas cache:
artifacts/house-preview/atlas-<look>-<size>-<painter hash>.bin (first run paints, later runs load).

Overrides (until the HouseSpec resolver of lane H1 lands): fronts[0].gable -> monumentGable, palette.wall (or
palette.brick) hex -> facadeMappedColour; every other design field is listed under overrides.notApplied in
measure.json (the generic path has no property for it yet).

Not reproduced: the far and roof distance tiers, mipmaps, cast shadows (a wall in another building's shadow draws
sunlit), fog, the analytic window SDF, the ground lift, post-processing, the GLB slot cells (an installed GLB draws
its game colours flat). When those matter, fall back to scripts/building-recipes/render.ts (headless
Chromium) or a ride frame.
```

## §3 Stage and publish

Stub (lane H3): `house:stage`, `house:publish`, per-tile covers, golden allowlists.

## §4 Describe at scale

`house:crops` (§4a, H4) cuts one quality-flagged crop per pand; `house:describe` (§4b, H5) reads it, the register and BAG through four writers in trust order.

### §4a Crops: `npm run house:crops`

Station "describe at scale", first half: one rectified, quality-flagged facade image per street-facing pand of a buurt,
so that pixel measurement and the Jev typed judge (H5) and the preview compare sheet (H2 `--photo`) read a photo
instead of a hand-run block. Manual crops covered 887 strips + 571 reference walls against 192,567 pands; this makes
the crop a city-scale, resumable step.

### Command

```
npm run house:crops -- --buurt <code> [--pand <id>] [--resume] [--dry-run] [--rate-ms 500]
                       [--archive <dir>] [--limit <n>] [--years <n>] [--restart] [--rejudge] [--report]
```

`npm run house:crops -- --help` prints the same text (the `HELP` constant in `scripts/house-crops/crops.ts`).

| Flag | Meaning |
|---|---|
| `--buurt <key>` | required. CBS buurt by 4-letter code (`AB07`), CBS code (`BU0363AB07`) or name (`Bloemgrachtbuurt`), from `public/data/extracts/amsterdam/coverage-v1/buurten.json`. Pands are the BAG pands whose footprint centroid lies inside the outline. |
| `--pand <id,id>` | only these pands (16-digit BAG ids, with or without `NL.IMBAG.Pand.`); they must lie in the buurt. |
| `--years <n>` | best of up to n mission years per pand, default 6; `--years 1` is the single-year baseline. |
| `--rejudge` | recompute `usable`/`reasons` for every manifest entry from its stored flags (no network); after a THRESHOLDS-only change. A change to what a crop *is* bumps `RULES_VERSION` (manifest.ts) and needs `--restart`; `--resume` refuses an older manifest. |
| `--resume` | continue from the manifest: pands with status `ok`, `no-wall`, `no-pano` are skipped, `error` is retried. A kill between the archive write and the manifest write is healed from the archived `front.json`. Without `--resume` an existing manifest stops the run. |
| `--restart` | throw the manifest away and start over (cached API responses are still reused, so this repeats no requests). |
| `--dry-run` | no network, no writes: walls found, how many take the strip route, panorama-list cells, estimated requests and minutes. |
| `--rate-ms <ms>` | minimum gap between the starts of two network requests, default 500. Cache hits cost nothing. |
| `--archive <dir>` | root of the `map-recall2-source-data` checkout or lane worktree; default env `HOUSE_CROPS_ARCHIVE`. Required unless `--dry-run`. |
| `--limit <n>` | stop after n pands this session (smoke runs). |
| `--report` | print the coverage table and write the contact sheet from the manifest, nothing else. |

Set `PAND_REFERENCE_CACHE=/Users/blackmad/Code/map-recall2/.cache/pand-reference` so every worktree shares one panorama cache
(a re-run, or a neighbouring buurt, then downloads only what is new).

### What it does per pand

1. **Wall.** `scripts/pand-reference/select.ts pickWall`: the longest exposed (not party-wall) BAG edge whose normal faces the
   nearest road or quay.
2. **Panoramas.** One panorama list per 30 m cell (radius 57 m, one request set shared by every pand in the cell), then
   `rankPanos`: camera 5-35 m from the wall (8-25 m preferred), obliquity <= 55 degrees, standoff > 2 m. Each candidate is ray-checked: a camera ray to the wall centre that crosses another BAG footprint is `blocked` (alley and neighbour views).
   One representative per mission year (up to `--years`, 2016-2025) is ranked: clear ray and <= 35 degrees first, then leaf-off months (Nov-Apr), then newer years.
3. **Route.** Normal: `rectifyWall` onto the BAG wall at 50 px/m. Strip fallback (`planStrip`, `block-face/intake.ts` method): the
   wall is under 4 m, or the best view is over 35 degrees oblique (a mid-row pand on a narrow street, camera beside the wall). The
   pand's block face (collinear neighbouring walls, `groupFaces`) is planned on one capture day, up to 3 panoramas >= 2.5 m apart are
   median-fused at 40 px/m over the pand's span plus 1 m each side, and the pand's span is cut out (`spanPixels`, `cutSpan`).
4. **Best of N years.** The years are rectified in that order and the first crop that passes every check wins, so extra panoramas are fetched only for fronts that need them; if none passes, the crop with the fewest broken caps is kept. `front.json` records `chosenYear`, `candidates` (year, panorama, verdict, reasons) and `missionYearsAvailable`. A cross-year median that masks occluders was not built (optional in the brief): on the labels the failures are bare trees and wrong walls, which a median over years does not fix, and it would risk blending colour across years.
5. **Flags and archive** as below.

### Flags and `usable`

All thresholds live in the `THRESHOLDS` constant of `scripts/house-crops/flags.ts`; `usable` is true when none is broken.

| Flag | Measures | Cap |
|---|---|---|
| `voidShare` | share of pixels not sampled from the panorama, rows 10-90 % of the crop | <= 0.35 (as `auto-place.ts`) |
| `foliage` | leaf-coloured share after a1's white balance (`src/canalRecall/blockFace/stripWhiteBalance.ts`, copied unchanged; it removes the green-cast false positives). `foliagePlain` is the unbalanced share | <= 0.30 (as `auto-place.ts`) |
| `washedOut` | **highlight clipping** (H4c): share of mid-wall pixels (rows 20-90 %) with a channel at 254-255. Overexposure, sheeting and a blown sky clip; a correctly exposed white-painted front sits at 200-245 and does not. The H4b brightness measure fired on 59 of the 150 labels and threw away 28 good fronts, white canal houses first | <= 0.25 |
| `occluderShare` | largest connected dark blob in the lower third. **A proxy** for a parked van or scaffold: dark shopfront glass trips it, pale vans and bare trunks do not | <= 0.35 |
| `obliquity` | angle between wall normal and wall-to-camera ray | <= 55 usable (H4c); `straightDeg` 35 only ranks a view first and decides the wall route versus the strip route |
| `cameraDistance` | camera to wall centre, metres | 5-35 |
| `rayBlocked` | the camera ray to the wall centre crosses another BAG footprint | must be false |
| `wallWidthM` | BAG wall length | >= 3.5 m (slivers) |
| `heightCover` | valid rows counted up from the ground, share of crop height | >= 0.85 (never fired on AB07) |
| `edgeDensity` | share of mid-crop pixels with a luma gradient > 20 (blank wall) | >= 0.04 |
| `seamStep` | largest mean-luma step between adjacent bands | recorded, **not a gate** (no separation on the labels) |
| `missing` | share of invalid pixels over the whole crop | informational |

Known blind spots: the flags do not see bare winter trees in front of a front (the largest group of "marginal" crops), a white van,
or a window close-up of a tall wall. **`usable` is a flag verdict, not a quality verdict**; the label evaluation below measures how far apart they are.

### Hand labels and evaluation

`scripts/house-crops/label-sheet.ts` draws blind numbered sheets (no flags), a judge calls each crop good / marginal / bad into
`scripts/house-crops/labels/<code>.json` (with the panorama ids, so a label counts only while the crop is unchanged), and
`scripts/house-crops/evaluate.ts --buurt <code> [--sweep]` prints, per flag, precision and recall as a defect detector and the precision/recall of `usable` for `good`. good = a full, straight front, ground floor to roof, no heavy occlusion; marginal = mostly good but flawed (tree, truck, cut top); bad = wrong wall, close-up, blank, oblique, smeared. Marginal counts as not good.

AB07 labels (150 crops: the 48 on the first sheet plus 102 random; labelled blind by a Claude judging session, not a human, so the user should spot-check `artifacts/house-crops/label/AB07-*.png`):
good 64, marginal 43, bad 43; true good rate 42.7 % (95 % CI 35-51). `usable` flagged 106 (70.7 % of the labelled set), **precision for good 50.9 %, recall 84.4 %**. Per flag as a defect detector: blocked 20 fired / 95 % real defects, blank 5 / 100 %, narrow 6 / 83 %, oblique 25 / 68 % (but it threw 8 good fronts away: narrow Jordaan streets only have oblique panoramas), seam 17 / 47 % (worse than the base rate, so removed as a gate), foliage / washed-out / occluder / void / distance / short fired on none of the labelled set after the changes.
Raising the obliquity cap from 35 to 55 lifts recall from 0.84 to 0.97 at the same precision (0.49 vs 0.51); H4c made that change (see "H4c" below).
**Gate not met**: precision for good 0.51 (< 0.9) and a human-good share of about 43 % (< 70 %). The remaining gap is bare trees (the largest marginal group), alley/side walls that are not blocked by a footprint, and window close-ups; none has a cheap flag.

### H4c: the Jev judge, and `usable` is a pre-filter

**`usable` is a pre-filter, not a quality verdict.** H5 must not take a crop on `usable` alone: on the AB07 labels it has precision 0.50 for good.
The picker is the Jev judge (`scripts/house-crops/judge.ts`, jev-1.14.0, the J1 spike's call: `/v1/systemone`, header `TypeSafe-Danger-Zone-Images`):
one request per cached crop, no panorama fetched, three yes/no questions: `full_front` (a full front of ONE building, straight on, ground to roofline,
not a close-up, side wall or street view), `occluded` (a large part hidden by a tree, branches, van, scaffold, crowd) and `close_up`. The score is
`quality = P(full_front) x (1 - P(occluded))` (judge.ts `quality`; on the labels this raised the AUC for good from 0.84 to 0.89, `close_up` added nothing).
A crop is **judged good** when it passes the hard flags (`HARD_REASONS` in flags.ts: void, oblique 55, distance, blocked, narrow, short, blank) and
`quality >= JUDGE_GOOD` (0.4). foliage, washed-out and occluder stay in `usable` for crops that were never judged, but they no longer decide a judged one.
Cost $0.0001 per crop; the key is read only from `TYPESAFE_API_KEY`, never printed or stored (judge.ts fails closed on 401/403).

```
zsh -lic 'node --import tsx scripts/house-crops/judge.ts --buurt <code> --archive <dir> [--labelled] [--pand a,b] [--limit n] [--budget 2]'   # -> scripts/house-crops/judge/<code>.json
node --import tsx scripts/house-crops/evaluate-judge.ts --buurt <code>      # AUC, threshold table, precision/recall, split-half, the 20 disagreements
node --import tsx scripts/house-crops/disagree-sheet.ts --buurt <code> --archive <dir>
node --import tsx scripts/house-crops/remeasure.ts --buurt <code> --archive <dir>   # recompute washedOut from the archived JPEGs, no network
npm run house:crops -- --buurt <code> --pand <ids> --all-years --offline --restart  # per-year crops from the cache only, with HOUSE_CROPS_MANIFEST_DIR and --archive pointing at scratch
zsh -lic 'node --import tsx scripts/house-crops/pick.ts --buurt <code> --from <scratch archive> --archive <dir>'   # judge every year crop, pick the best -> judge/<code>-picks.json
```

Results are keyed by pand id and the crop's panorama ids, so a score or a label counts only for the crop that was judged.

**AB07 results** (jev-1.14.0, 2026-11-10; total Jev spend $0.0281 for 426 requests, budget $2; the judge reads the cached crops, 0 panorama requests):

| | on the 150 H4b labels |
|---|---|
| AUC of `quality` for good | 0.893 (`full_front` alone 0.842) |
| usable flag (H4b) | precision 0.50, recall 0.95 |
| judged good at 0.4 | 34 picks, precision 0.941, recall 0.50 |
| judged good at 0.5 | 26 picks, precision 0.923, recall 0.375 |
| split-half (choose the threshold on one half, test on the other) | held-out precision 0.78 and 0.905 at thresholds 0.285 and 0.367: the 0.9 gate is not stable out of sample |

**The picker** (`pick.ts`): per pand, every mission year whose panorama is already in the cache is re-rectified (`crops.ts --all-years --offline`, 0 requests; 137 of the 150 labelled pands could be rebuilt, 3.2 year crops each, 440 in all), the hard-flag survivors are judged, and the highest `quality` wins (ties: newer year). 111 of the 137 pands have a hard-passing candidate; 26 do not (blocked, blank, narrow or too oblique in every year).
The 78 picks that were not already labelled were labelled blind by a Claude judging session (`labels/AB07-picks.json`; as before not a human, so spot-check `ui/2026-11-10-house-crops-ab07-h4c/pick-label-*.jpg`).

* **True good rate of the picked crop per pand: 56 % (62 of 111) against 50.5 % (56 of 111) for the H4b flag-chosen crop on the same pands.** The judge is a modest gain as a picker (+5 points): the years of one pand mostly share the same tree or the same wrong angle.
* **Judged good** (a pick with `quality >= 0.5`): 31 of the 137 pands (22.6 %), 28 of them good = **precision 0.90 of the picks**; at 0.4: 48 pands (35 %), precision 0.79.
* Over the pool of all 228 labelled crops (the 150 plus the 78 picks) the thresholds give: 0.4 -> precision 0.86, recall 0.57; **0.5 -> precision 0.94 (45/48), recall 0.42**; 0.6 -> 0.95, recall 0.19. `JUDGE_GOOD` is 0.5 because the best of several years is a winner's-curse selection: a threshold tuned on the 150 alone (0.4) falls to 0.79 on the picks.
* **So the gate "precision >= 0.9" is met at 0.5 (0.90-0.94) with a recall of about 0.4**: the judge is conservative and mostly says "not sure" to dark, glare-lit and narrow fronts that a human calls good (the 18 misses on `ui/.../disagree-20.jpg`; three of the "good" labels there are close-ups, i.e. label errors). The share of pands with a crop a human calls good is about **45 % of the 137** (62 of 137) if H5 takes every pick, 20 % if it takes only judged-good picks. The 70 % target is not reached; a tree-lined canal is the worst case, and pands without a judged-good crop fall back to register + BAG + block-face strips in H5.


### Multi-year (best of N) against one year

Same 150 pands, same rules: flag-usable one year 80 / 150 vs best of N 106 / 150; buurt-wide 45.8 % vs 63.9 % of pands with a wall. **True good rate one year 43.3 % vs best of N 42.7 %** (42 of the 150 crops differ; I labelled both): best of N satisfies the flags more often but does not produce better-looking fronts, because what fails is trees and wrong walls, not the capture year. Cost: 89 min, 1,719 requests, 3.8 GB for N <= 6 (2.9 crops tried per pand on average) against 29 min, 955 requests, 1.7 GB for one year plus a second try. The shared panorama cache holds the downloads (49 GB total at the end of the pilot; the disk was at 4.6 GB free).

Pilot (Bloemgrachtbuurt AB07, 662 pands, final run 2026-11-10): 659 walls, 652 crops, 421 flag-usable (63.9 % of pands with a wall); rejected (primary) oblique 135, blocked 71, narrow 12, occluder 9, blank 3, foliage 1; 7 no panorama, 3 no exposed wall; 0 x 429. The strip route: 64/88 flag-usable.

### Archive and manifest

* Crops: `map-recall2-source-data/pand-crops/<pandId>/front.jpg` (JPEG q80, rectified: x along the wall left to right seen from the
  street, y up from the ground, 50 px/m or 40 px/m on the strip route) and `front.json`: panorama id(s) with timestamp, camera
  distance, obliquity and source URL (`https://api.data.amsterdam.nl/panorama/panoramas/<id>/`), mission date, the wall in RD
  (EPSG:28992), crop size / scale / ground height, flags, `usable`, `rejectedBecause`, the thresholds used, attribution (Gemeente
  Amsterdam, CC BY 4.0). Every crop is archived, usable or not, so rejections can be judged by eye.
* Game repo: `scripts/house-crops/manifests/<buurt code>.json`: buurt, thresholds, one record per pand (`status` `ok` /
  `no-wall` / `no-pano` / `error`, `method` `wall` or `strip`, `usable`, `reasons`, `flags`, `archive` path, `panoIds`, `date`,
  `ppm`) and one entry per run session (requests, bytes, retries, 429s, wall seconds). This is what H5's `house:describe --buurt`
  and H2's `--photo` read to find a pand's crop.
* The lane commits the archive on a branch of a dedicated `map-recall2-source-data` worktree; the integrator pushes it.

### Disk rule (every crops run)

The panorama cache is the thing that fills the disk (AB07: 38 GB shared cache; the volume was at 4.6 GB free). So:
1. **Keep** the rectified crops (`front.jpg`, `years/<year>.jpg`) and the panorama ids in `front.json` and the manifest: that is all H5 needs, and the source panoramas can be fetched again by id.
2. **Purge** the run's source panoramas once the buurt is rectified: `crops.ts` records every panorama JPEG it touches (`panoTracker` in `scripts/pand-reference/core.ts`) and deletes them at the end of a finished run; `--keep-panoramas` opts out, and a run stopped early purges nothing (it needs them to `--resume`). The cached list/JSON responses are tiny and stay.
3. **Check `df` first**: before any download the tool reads the free space of the cache volume, adds its own estimate (requests x 2.3 MB), prints both and **refuses to start (exit 4) if less than 15 GB would remain** (`diskGate`, `DISK_FLOOR_BYTES` in flags.ts). `--offline` runs skip the check because they download nothing.

### Rate rule

One request start per 500 ms process-wide (`http.minGapMs` in `scripts/pand-reference/core.ts`, off by default so older scripts are
unchanged), at most 3 in flight, up to 6 attempts with exponential backoff (400 ms x 2^n) on 429 and 5xx, `Retry-After`
honoured. User-Agent `MapRecall-HouseCrops/1.0 (+repo URL; Gemeente Amsterdam panoramas CC BY 4.0)`. The request, byte, retry
and 429 counts are in the manifest sessions and the report. A 429 in a log is a failure of this rule: stop and raise `--rate-ms`.

### Report

`--report` (also printed at the end of every run) gives the coverage table: pands, walls found, crops made, usable, rejected by
reason (primary and every broken cap), by route, API requests, bytes, wall time; and writes
`artifacts/house-crops/<code>-report.md` and `<code>-sheet.png`, a contact sheet of 48 random crops (fixed seed) labelled with
route, verdict and flags (green frame usable, red rejected).

### Running the next buurt

1. `node --import tsx scripts/house-crops/crops.ts --buurt <code> --dry-run`: pands, narrow-wall count, estimate.
2. Make a source-data worktree: `git -C ~/Code/map-recall2-source-data worktree add --no-checkout -b lane/<lane>-pand-crops-<date> ~/Code/map-recall2-source-data-<lane> origin/main`, then in it `git sparse-checkout init --cone && git sparse-checkout set pand-crops && git checkout`.
3. `PAND_REFERENCE_CACHE=... HOUSE_CROPS_ARCHIVE=<that worktree> nohup npm run house:crops -- --buurt <code> > artifacts/house-crops/<code>-run.log 2>&1 &` (the log lives in the worktree; zero bytes means working; kill with Ctrl-C or by PID, then `--resume`).
4. Read the sheet, commit the archive in the source-data worktree, commit the manifest in the game repo.
5. Pick buurten by where players ride (centre and inner ring, `RIDE_PRIORITY_GEBIEDEN`), then by the number of staged hand intents (they let H5 score writer-versus-hand agreement).

Tests: `node --import tsx --test scripts/house-crops/flags.test.ts` (thresholds, clipping, hard flags, judge parsing and sizing, disk gate, threshold choice, span cut, face grouping).

### §4b Describe: `npm run house:describe`

Station "describe at scale", second half (lane H5, #346): fill a spec from the sources in trust order and stop where the evidence
stops. Four writers, one per source, each returning a partial `HouseSpec` with a receipt per field; `resolveSpecs` merges them
(strongest source, then confidence, then the newer date), so a writer never overwrites a stronger source and a field nobody states
stays absent. Nothing is invented.

```text
house:describe: fill a HouseSpec from the sources in trust order, and stop where the evidence stops.

  npm run house:describe -- <pandId>                       one pand (16 digits, with or without NL.IMBAG.Pand.)
  npm run house:describe -- --buurt <code> [flags]         every pand of a CBS buurt (4-letter code, CBS code or name)

  --writers register,bag,pixel,jev   which writers run (default: all four). Order does not matter: fields merge by the evidence
                                     ladder (facade/evidence.ts SOURCE_STRENGTH), then confidence, then the newer date.
  --jev-budget-usd <n>               hard cap on Jev spend for THIS run (default 2). No Jev call is made without it being printed.
  --jev-buurt-budget-usd <n>         hard cap on the buurt's cumulative describe spend, read from <archive>/jev-cache/ledger.json (default 3)
  --archive <dir>                    source-data checkout holding pand-crops/<id>/front.jpg and, for Jev, jev-cache/ (default env
                                     HOUSE_CROPS_ARCHIVE, else ~/Code/map-recall2-source-data-h5)
  --good-threshold <q>               judge quality for the good crop tier (default 0.5, JUDGE_GOOD in scripts/house-crops/flags.ts)
  --dry-run                          no network, no writes: crop tiers, the writers that would run, Jev calls to make, cached, estimated USD
  --stage                            after writing, run the staging extract (npm run house:specs). npm run house:stage (H3) has not landed:
                                     when it exists --stage names it in the output but does not call it
  --out <dir>                        output root (default scripts/house-specs/generated)
  --help                             this text

Writers (src/canalRecall/houseSpec/writers/), what each may write, source and rank:
  register  monument-text   gable, facade year, finish, hoist beam, stoop, elements (no crop needed)
  bag       bag             facts/facadeYear (0.5); storeys off (H5h: eaves / 3 m agreed 0.43 with the hand set, 0.55 with offsets)
  pixel     streetlevel-measured   wall colour + brick material + rhythmic window columns (bays) + measured storeys; measureFacade
                                   'houseLine' profile; fallback-tier crops write only colour and storeys, at lower confidence
  jev       vision-judge    bays (p>=0.55), a confident gable (p>=0.75), finish (p>=0.9), shop/residential (p>=0.875); good-tier crops only
Jev answers are cached by crop hash in <archive>/jev-cache/, so a re-run costs nothing. The key is read only from TYPESAFE_API_KEY
(run the command through zsh -lic); it is never printed, logged or cached, and a 401/403 stops the run.
Output: scripts/house-specs/generated/<buurt>/<pandId>.json = {crop, writers, spec (merged, full provenance), disagreements}.
build-house-specs.ts reads the merged specs; scripts/house-specs/agreement.ts compares the writers with the hand intents.
```

#### Writers (`src/canalRecall/houseSpec/writers/`)

| Writer | Needs a crop | Source | May write |
|---|---|---|---|
| `register.ts` | no | `monument-text` | gable 0.8, facade year 0.7 (a period 0.5), finish 0.7, hoist beam, stoop, elements 0.6 (`fromRegisterFacts`) |
| `bag.ts` | no | `bag` / `3dbag` | `facts/facadeYear` 0.5 (the building's year, not the front's), `fronts/0/storeys` **off** (`BAG_WRITES_STOREYS`; eaves / 3 m agreed 0.43 with the §4c hand set, 0.55 with -1 for a pitched crown, below the 0.80 fallback bar; `bagStoreys` keeps the arithmetic). BAG stays the source for heights |
| `pixel.ts` | good or fallback | `streetlevel-measured` | `palette/brick` (wall colour, 0.55 good / 0.45 fallback, `houseLine` profile, not when L > 0.95), `palette/wallMaterial` brick when course lines resolve, `fronts/0/bays` only on a good crop with a resolved column pitch (`pitchScore >= 0.6`, `columns == windowColumns`), `fronts/0/storeys` **off** (`PIXEL_WRITES_STOREYS`) |
| `jev.ts` | good only | `vision-judge` | bays (word form, p >= 0.55), gable (p >= 0.75 and only `step`/`plain`), finish brick / painted-brick / stucco (p >= 0.9), shop / residential (answer p >= 0.875) |

Glazing is printed by the sheets, never written, never part of a confidence (H2d verdict). The Jev prompt, schema, model, header
name and accept thresholds are in `src/canalRecall/houseSpec/writers/fixtures/jev-questions.json` (a change bumps `version`, which
is part of every cache key); a recorded response is `fixtures/jev-response.json`. Stone bands, basement and dormer are not asked
(below baseline in the J1 spike). Bays use the word form only: the picture form needs five reference images and about five times
the tokens, and the word form was within +-1 on every front.

#### Crop tiers

`usable` is a pre-filter, not a quality verdict (§4a). `scripts/house-specs/tier.ts`:

| Tier | Rule | Who may read it |
|---|---|---|
| good | hard flags pass and judge quality >= `--good-threshold` (default `JUDGE_GOOD` 0.5) | every writer |
| fallback | hard flags pass, judge below the threshold or unscored | pixel only: wall colour at 0.45, no bays, no material; Jev skips it |
| none | a hard flag fails (void, oblique 55, distance, blocked, narrow, short, blank) | nobody |

A pand's crop is the best of its candidates (the manifest crop and the best-of-years crops of `judge/<code>-picks.json`): highest
tier, then judge quality, then the newer year. The tier is in every pixel field's `ref` (`...front.jpg#good`) and in the envelope's `crop`.

#### Budget and cache (Jev)

`--jev-budget-usd` (default 2) caps one run; `--jev-buurt-budget-usd` (default 3) caps the buurt's cumulative describe spend, kept in
`<archive>/jev-cache/ledger.json`. Both are hard: when either is reached the remaining crops are skipped and counted. Answers are
cached by the sha256 of the image that is sent plus the question version (`<archive>/jev-cache/<hash>.json`: parsed answers, token
count, pand, date; no headers, no key), so a re-run, or a resumed one, costs nothing; `--dry-run` prints the calls it would make and
the estimate. Spend is `tokens x $0.042 / 1M`, input and output priced alike (can only overstate). A crop too narrow for Jev's 280 px
rule is padded with mid-grey at both sides (the house stays in the middle); one that still cannot be sent is skipped and counted.
The key is read only from `TYPESAFE_API_KEY` in the environment, so run through `zsh -lic '<command>'`; it is never printed, logged or
cached, and a 401/403 stops the run (exit 3). The archive is a `map-recall2-source-data` worktree (`jev-cache/` beside `pand-crops/`,
see §4a "Running the next buurt"); the integrator commits and pushes it.

#### Output, staging and `house:stage`

`scripts/house-specs/generated/<buurt>/<pandId>.json`: `{crop, writers: {register, bag, pixel, jev}, spec, disagreements, jev}`. `spec` is the
merge with full provenance; when two writers state a field with different values both are recorded in `disagreements` (path, each
writer's value, source and confidence, who won) and as a `describe:` line in `design.notes`. `build-house-specs.ts` reads `spec`
from every generated file (counted as `generated specs` in its report) and stages the extract; a hand source on the same pand
outranks the writers by the ladder. `--stage` runs that staging (`npm run house:specs`). `npm run house:stage` (H3) has not landed,
so the per-pand H2 receipt step is not wired: when the script exists `--stage` names it and does not call it.

#### How to add a writer

1. A pure function in `src/canalRecall/houseSpec/writers/<name>.ts` returning a partial `HouseSpec` (set only what the source states, a
   receipt per field, `validateSpec` in its test); if the source is new evidence place it on `SOURCE_STRENGTH` first (§1).
2. Tests on a recorded fixture, no network (`writers.test.ts`).
3. Add the name to `WRITERS` in `describe.ts` and one branch in `main()` that builds its input and pushes `{writer, spec}` onto `parts`;
   `agreement.ts` reads `envelope.writers[name]`, so it gets a column for free (add the name to `names` in `tabulate`).
4. Run `describe --dry-run`, then a real run, then `agreement.ts`; the new writer ships only with its agreement numbers.

#### Agreement report

`node --import tsx scripts/house-specs/agreement.ts --buurt <code> [--out file.json]` compares every writer and the merged spec with
the hand intents of the buurt (block-face intents, authored and auto-placed, and canal-house recipe intents), per field: how many pands
have a hand value, how many the writer stated, how many agree, precision (agree / stated) and recall (agree / hand); wall colour agrees
within HSL lightness 0.12. It also prints the register as a reference for the listed pands (which is how Jev's gable was checked) and
the worst disagreements; `worst-sheet.ts` draws them as contact sheets (crop, preview render of the merged spec, both values).
**The hand set is thin and mostly not a photo reading**: on AB07, 33 of its 39 pands are auto-placed block-face intents (a type
library's gable, bays and colour), 6 are authored recipes, none states a finish. The photo-read hand set of §4c replaces it as the gate set
(`scripts/house-specs/hand-set/score.ts`).

#### Measured on AB07 (2026-11-10, Bloemgrachtbuurt, 662 pands)

Crops: good 120, fallback 433, hard-flag fail 99, no crop 10. Coverage, pands with the field per writer: gable register 174, Jev 6;
bays Jev 112, pixel 31; wall colour pixel 495; wall material Jev 72, register 3; pui Jev 42; facade year bag 637, register 183;
storeys bag 657 (before H5h; BAG storeys are now off, so no writer states facade storeys). Disagreements between writers: facade year 171 (BAG's building year against the register's front year, expected),
bays 2. Jev: 120 calls, $0.0104 (cap $2 per run, $3 per buurt); this lane's total with the judge passes $0.07 of $3.

Against the 39 hand pands (all-pands table; the authored subset is 6 pands, the good-tier subset 5):

| field | hand | merged stated / agree | precision / recall | note |
|---|---|---|---|---|
| bays | 39 | 4 / 3 | 0.75 / 0.08 | Jev 3 of 4; pixel 1 of 1. Jev wrote bays on 112 pands, only 4 of them hand pands (hand pands mostly lack a good crop) |
| gable | 39 | 14 / 9 | 0.64 / 0.23 | register only; the 5 misses are a hand `cornice` or `bell` auto-placed on a front whose crop shows the register's neck gable |
| finish | 0 | | | no hand intent states a finish |
| storeys | 39 | 39 / 19 | 0.49 / 0.49 | 3DBAG count; it overcounts by one on 16 of 39 (tall ground storey) |
| pui | 30 | 0 / 0 | | Jev answered none of the hand pands (they have no good crop) |
| wall colour | 39 | 35 / 15 | 0.43 / 0.39, median dL 0.147 | against type-library swatches and measured strip colours; pixel reads dark on overcast crops |

**The gate (merged agreement >= 0.85 for bays, gable, finish) is not assessable and not met on this hand set**: n is 4, 14 and 0 for
the fields it names. Jev's gable was checked against the register on the 14 pands both name instead: 8 agree, and its `cornice`
contradicted the register's bell or neck 5 times of 8 (3 at p >= 0.96), so the writer now writes only step and plain
(`fixtures/jev-questions.json gableClasses`). Pixel storeys (7/16 where the BAG count was 7/16 on the same pands) and pixel bays without a
resolved pitch (11/22) were measured and gated off. A visible Jev miss at p 0.74: 0363100012173345 reads 3 bays where the front has 2.

#### Step 0b: the judge recall pass (2026-11-10)

Labels corrected in `scripts/house-crops/labels/AB07.json` (150: good 64 -> 58, marginal 43 -> 47, bad 43 -> 45): 12168013 good;
12172859, 12174042, 12170216 bad; 12169899, 12168440, 12168604, 12173350 marginal. `judge.ts`/`pick.ts` take `--prompt v1|v2` (own
store per version); `recall-pass.ts` compares them. v2 says dark painted brick, narrow canal fronts and sky glare are normal and asks
"one building, straight on, whole" apart from obstruction.

| score (150 corrected labels) | AUC | lowest t with precision >= 0.9, in sample | A->B held out | B->A held out |
|---|---|---|---|---|
| v1 (H4c prompt) | 0.950 | 0.297: 44 picks, p 0.909, r 0.690 | t 0.223: p 0.767, r 0.920 | t 0.367: p 0.952, r 0.606 |
| v2 | 0.926 | 0.644: 44 picks, p 0.909, r 0.690 | t 0.599: p 0.818, r 0.720 | t 0.684: p 0.955, r 0.636 |
| mean of both | 0.946 | 0.460: p 0.911, r 0.707 | t 0.408: p 0.833, r 0.800 | t 0.480: p 0.957, r 0.667 |

v2 does what it was written for (the 11 rejected full fronts rise from 0.08-0.24 to 0.32-0.74) but lifts the negatives as much, so the AUC falls.
On the pool of 228 labelled crops (the 150 plus the 78 labelled year picks) v1 gives precision 0.886 / recall 0.608 at 0.4 and
0.958 / 0.451 at 0.5; v2 at 0.7 gives 0.873 / 0.608. **Target (recall >= 0.6 at precision >= 0.9, held out) not met**: the in-sample
threshold reaches it, one half-split fails on precision, and the pool stays under 0.9 at recall 0.6. `JUDGE_GOOD` stays 0.5 and v1 stays
the default (a judgement call: 0.4 costs about 0.07 precision for 0.16 recall); `--good-threshold 0.4` on `house:describe` is the
switch. No re-pick was run: `pick.ts --prompt v2` re-judges the existing candidates (279 year crops, no panorama request).

### §4c The photo-read hand set (lane H5h, #351)

`data/house-line/hand-set-v1.json`: 80 pands read by hand from archived crops on a metre grid, the truth set for the describe
writers (H5), H1c's bay counts (#350) and H9's easy houses (#345). It replaces agreement.ts's hand intents as the gate set: of the
39 H5 hand pands 33 were auto-placed type placements, not photo readings. Schema, validator and the convention text:
`src/canalRecall/houseSpec/handSet.ts` (`validateHandSet`, `READING_CONVENTION`, test `handSet.test.ts`).

**The pands.** 60 AB07 pands drawn by `scripts/house-specs/hand-set/select.ts` (seed 351, `hand-set-v1.selection.json`), stratified
before reading on proxies: crop tier (good 36, fallback 24), the register's gable group (step 3, neck 10, bell 10, point/spout 4,
cornice 10, unlisted 23), dark vs light front (pixel wall HSL L < 0.38: dark 25, light 19, unknown 16; alternated within each cell)
and Jev's finish (brick 22, stucco 1, unknown 37; rotated within each cell); crops labelled `bad` were skipped (14) and each cell
keeps six reserves. 13 of H9's easy houses (the brief list less the shopfront-only 171851 and 171854). The 7 pands of block face
`nassau-145-152` (the brief said 8; the face has 7 houses). Realised strata from the readings (reader A, 76 of 80 readable): gable
cornice 35, neck 11, point 9, bell 7, flat 7, step 4, not visible 3; finish brick 62, painted-brick 12, stucco 2; wall red-brown 26,
brown 21, dark 15, red 6, grey 4, orange 2, white 1, buff 1; tone (brown or dark = dark) dark 36, light 40; axes confidence high 55,
med 11, low 10. White and stucco fronts are scarce in AB07 and the easy set: a later set should add them.

**Images.** `sheets.ts` draws one sheet per pand: up to three archived panels (the describe crop first, then the manifest front and
the best-of-years crops; the easy houses' `front` and `front-alt`; the Nassaukade strip cut by its span pixels with 1 m margins),
each at least native size under a metre grid. No writer value, label or register fact is drawn. Every field records the panel it
was read from (`ref`, a `source-data://` path, plus the file's sha256 in `images`). Refs resolve in `map-recall2-source-data`:
`pand-crops/` (H4), `pand-reference-easy-houses/` (archived by this lane from H9's `staging/pand-reference`),
`block-face-strips/nassau-145-152/strip.jpg#px=a-b`. No panorama was fetched.

**The convention** (`READING_CONVENTION`, verbatim what the readers were given; round 2 of 2026-11-10 is the current text):

- **axes** (= HouseSpec `bays`, `frontBays`): window columns of the upper storeys, **the storey with the most columns** (the
  maximum, not the typical storey; `axesPerStorey` from storey 2 up when storeys differ). One axis per separate masonry opening: a
  mullioned pair of lights is one, two openings with a brick pier between are two; a balcony door counts; an erker is one axis; the
  ground storey is not counted. A front with no upper storey has axes unknown.
- **storeys** (= FrontIntent `storeys`): the one definition of §1, **full street-facing storeys, counting neither a souterrain nor
  an attic in the crown**. The ground storey counts once however tall. Not counted: a **souterrain** (half below the pavement,
  windows at knee height, usually under a stoop; `souterrain: true`), an **entresol** inside a tall ground storey (`entresol: true`),
  windows in the gable, crown or roof, dormers, a set-back roof storey (`atticInCrown: true`). A **bel-etage** over a souterrain is
  storey 1. A full top storey in the front plane under a cornice counts.
- **gable**: GABLES (spout, neck, raised-neck, bell, step, point, cornice, flat, shouldered); unknown when the crown is not in view.
- **finish**: brick, painted-brick (coursing still visible), stucco, stone; the upper wall, not the ground storey.
- **wall**: white, grey, buff, orange, red, red-brown, brown, dark (the main upper wall). Tone: brown and dark read dark.
- **pui**: shop, residential, warehouse. **confidence** per field: high, med, low.
- **unknown**: a field the crop cannot show (crown out of view, top cut so storeys cannot be counted, ground storey hidden) is
  `"unknown"`, never a low-confidence guess. **unknown is never scored**, for readers or writers; the validator rejects `null`.
- **extent**: `multi` when the pand's wall carries more than one house front (two or three gables, a row of fronts). A multi pand's
  fields are recorded but **left out of every score** (the scorer uses reader A's extent for every reader). The tell: more than 5 axes
  on a canal house. The crop is the pand's own BAG wall (`front.json wallWidthM` = the crop width, 168085 14.1 m), so a single-front
  re-crop does not exist; no panorama was fetched. Multi in v1: 168085, 174923, 174696, 169899, 174173, 174080 (AB07) and 116526
  (Nassaukade). 182857 is single with 5 axes (ruling).
- **readable** false when no panel shows the front; every value is then unknown.
- **crowns** (round 3): one front carrying several crowns of one gable type records `crowns: n` (n >= 2) beside `gable`; the gable
  is scored on its type only, and a renderer draws n crowns. 182857 (ruling: one pand, 5 axes) is `gable: step, crowns: 2`.
- **fronts** (round 3): a multi pand records its fronts left to right (`fronts[]`: share of the wall plus the same readings), from
  `hand-set-v1.reader-a.fronts.json`. Six of the seven have them; 174173 has none (a tree hides the split; it may be one
  double-house front, 5 axes about a central door). Multi pands stay out of every score.

Round 2 (judgement ruling, 2026-11-10) also re-read the 7 Nassaukade rows (the user's benchmark) at 2x against the blind reader:
164843, 161422 and 160273 are painted-brick / dark (reader B; the authored face intent agrees), 157426 stays brick / brown; 170031's
gable is unknown (crown cut). Realised strata now (reader A, 76 of 80 readable, 7 multi): gable cornice 34, neck 8, point 8, bell 7,
flat 7, step 4, unknown 8; finish brick 59, painted-brick 15, stucco 2; wall red-brown 26, brown 18, dark 18, red 6, grey 4, orange 2,
white 1, buff 1; unknown axes 5, storeys 7, pui 4.

**Reader ceiling.** Reader A built the set and saw the register's gable group in the draw, so the ceiling is the **blind pair**:
reader B (round 1, `hand-set-v1.reader-b.json`) and a fresh reader C (round 2, `hand-set-v1.reader-c.json`, given only the round-2
convention and the same 30 sheets: 20 AB07, 5 easy, 5 Nassaukade, `hand-set-v1.reader-b-pands.json`). Neither saw another reader's
values. Over pands both stated (not unknown, single-front by reader A; 2 multi left out); Wilson 95 % intervals:

| field | B vs C (the ceiling) | A vs B | A vs C |
|---|---|---|---|
| axes | 25/25 = 1.00 [0.87, 1.00] | 24/24 = 1.00 | 24/24 = 1.00 |
| storeys | 25/25 = 1.00 [0.87, 1.00] | 25/25 = 1.00 | 24/24 = 1.00 |
| gable | 21/25 = 0.84 [0.65, 0.94] | 24/25 = 0.96 | 19/24 = 0.79 |
| finish | 24/26 = 0.92 [0.76, 0.98] | 23/26 = 0.89 | 24/25 = 0.96 |
| pui | 22/25 = 0.88 [0.70, 0.96] | 21/24 = 0.88 | 24/24 = 1.00 |
| wall family | 21/26 = 0.81 [0.62, 0.92] | 21/26 = 0.81 | 23/25 = 0.92 |
| wall tone | 23/26 = 0.89 [0.71, 0.96] | 24/26 = 0.92 | 24/25 = 0.96 |

B-C disagreements: gable cornice / flat (2), bell / neck, bell / point; pui shop / residential on big ground-storey glazing (3);
painted vs bare brick (2); neighbouring colour words (red-brown / brown 3, brown / dark 2). Gable is the field readers
agree on least (cornice vs flat and the neck / bell / point family); round 3 widened its ceiling with the gable-only rows below.

**Gable-only rows** (round 3; `select-gable.ts`, seed 352): the gable gate needs n >= 60 register-stated gables and the 60-pand set
has 28, so 40 more AB07 pands with a register gable and a good or fallback crop (not in the set, not labelled bad; round-robin over
the register's group: bell 11, cornice 10, neck 10, point 7, step 2) were cut as **crown crops** (`sheets.ts --gable`: the top half of
each panel, the grid still measured from the ground) and read for the gable type only by two fresh blind readers, B2 (the record,
`hand-set-v1.gable-b2.json`) and C2 (`hand-set-v1.gable-c2.json`), given only the round-2 convention. 32 of 40 read by each (8
unknown: top cut, tree, close-up). B2 vs C2: 28/32 = 0.88 [0.72, 0.95]; the four splits are spout / cornice, neck / raised-neck,
neck / bell, spout / point. 40, not 30, so that the stated n reaches 60 after the unknowns.

**Gates** (`scripts/house-specs/agreement.ts` `gateFor`, `GATE_MARGIN`, `MIN_N`, `wilson`, `verdict`): per field, **gate = blind
reader ceiling - 0.1**, recomputed whenever the ceiling is re-measured (round 3: the round-2 floors came from the first ceiling and
are gone). A writer's precision gets a Wilson 95 % interval; it **fails only when the top of the interval is under the gate**, passes
when the bottom is at or over it, and is **open** in between. **Gable gives no pass or fail under n = 60** (`MIN_N`). The gable
ceiling pools B vs C (21/25) with B2 vs C2 (28/32): 49/57 = 0.86 [0.75, 0.93] (B vs C alone was 0.84, gate 0.74).

| field | blind ceiling | gate |
|---|---|---|
| axes (bays) | 1.00 (B vs C 25/25) | 0.90 |
| storeys | 1.00 (25/25) | 0.90 |
| gable | 0.86 (pooled 49/57) | 0.76, n >= 60 |
| finish | 0.92 (24/26) | 0.82 |
| pui | 0.88 (22/25) | 0.78 |
| wall tone | 0.89 (23/26) | 0.79 |
| wall family | 0.81 (21/26) | 0.71 |

**Writers against the hand set** (`score.ts`; AB07, 60 pands, 51 readable single-front; agree / stated, Wilson 95 %, verdict):

| field | gate | register | pixel | Jev | merged |
|---|---|---|---|---|---|
| bays | 0.90 | | 5/5 [0.57, 1.00] open | 25/30 = 0.83 [0.66, 0.93] open (+-1: 29/30) | 25/30 open |
| storeys | 0.90 | | (off) | measured, not a writer: good tier 30/34 = 0.88 [0.73, 0.95] open; all crops 48/63 = 0.76 [0.64, 0.85] fail | none: BAG off |
| gable | 0.76 | gable-type writer on 60: 36/60 = 0.60 [0.47, 0.71] **fail** (set 17/28 + rows 19/32) | | 1/1 open | (n < 60) open |
| finish | 0.82 | 1/2 open | | 23/23 = 1.00 [0.86, 1.00] **pass** | 23/24 open |
| pui | 0.78 | | | 10/11 = 0.91 [0.62, 0.98] open | 10/11 open |
| wall tone | 0.79 | | 28/37 = 0.76 [0.60, 0.87] open | | 28/37 open |
| wall family | 0.71 | | (hex not mapped to a word) | | |

- **BAG storeys** (eaves / 3 m, reader A, 47 pands): raw 20/47 = 0.43 [0.29, 0.57]; -1 for a pitched crown (BAG roof code 3)
  26/47 = 0.55 [0.41, 0.69]; -1 for the register's stoop (souterrain) never fires on AB07; with the hand souterrain flag (an oracle,
  not deployable) 25/47 = 0.53. All under the 0.80 fallback bar, so **BAG no longer writes `fronts/0/storeys`**
  (`BAG_WRITES_STOREYS = false`, `bagStoreys` keeps the offsets for a later writer); it stays the source for heights. Within one
  storey it is 0.98-1.00: BAG's eaves overcount a tall ground storey or a cornice attic by one. Facade storeys now come from no
  writer; Jev and the register are ranked above BAG for the field, and neither asks it yet.
- **The register as the gable-type writer** (round 3 re-scope): measured on 60 stated gables, the hand set's 28 (reader A) and the
  gable rows' 32 (B2; with C2 as the row truth the same 36/60), it agrees 0.60 [0.47, 0.71], under the 0.76 gate: **fail**. On the
  rows its misses are bell / neck / point where the crown is a cornice or flat front today (9 of 13) and point against spout (2): the
  register names the monument's historic gable type, not always today's crown. It should not write `fronts/0/gable` above the
  vision and photo writers; a later step could keep it as a prior for the neck / bell family only, re-measured.
- **Jev storeys** (round 3, `writers/jevStoreys.ts`, `fixtures/jev-storeys.json`, measured by `hand-set/jev-storeys.ts`; 63 calls,
  $0.004): the question states STOREYS_DEFINITION. Good-tier AB07 crops (what the Jev writer sees) 30/34 = 0.88 [0.73, 0.95]
  **open**; all crops 48/63 = 0.76 [0.64, 0.85] **fail** (fallback 10/14, easy 6/9, Nassaukade strip 2/6); within one storey 63/63.
  Good tier at p >= 0.6: 22/23 [0.79, 0.99] (a threshold read off this set, not a result). `JEV_WRITES_STOREYS` stays false: facade
  storeys stay unwritten and the generic path keeps its height-derived default until a larger good-tier set clears 0.90 (about 35
  agreeing of 35 needed for the interval's bottom to reach it).
- **Pui and wall tone rows** were not grown this round (the crown crops do not show the ground storey); the next set should add
  ground-storey crops for pui (Jev stated 11) and more pixel-tone pands.
- Jev's five bay misses: narrow fronts whose top storey is one three-light window (it says 3, the front has 2) and 170031, whose
  glazed storey 2 has 4 lights against 2 above (Jev gave the typical storey; `bays` is the maximum).
- The register's gable agrees on 17 of 28: neck or bell where the photo shows a cornice or flat front, neck against bell, cornice
  against point, and a step gable no longer on the front (174168). The register describes the monument, not always today's front.
- Wall colour: a writer hex is compared as a tone only (dark under HSL L 0.38, fixed before reading); a hex is **not** mapped to a
  family word (a mapping fitted on this set would be scored on it). Median pixel colour per read family: brown h32 s0.17 l0.32 (n8),
  red-brown h28 s0.17 l0.44 (15), red h27 s0.26 l0.55 (5), dark l0.31 (7): overcast crops pull every brick to hue 27-32, so pixel
  colour separates lightness, not red from brown.

**Old hand truth against the hand set** (11 of the 80 have an intent): authored block faces (the Nassaukade row) bays 6/6, storeys
6/6, gable 5/6, wall tone 4/6; auto-placed faces bays 4/4, storeys 3/4, gable 1/4, pui 2/4. **H9's review values**: bays 9/11
(182857: H9 8, the readers 5), storeys 2/8 exact and 8/8 within one (H9 counted the souterrain or the attic band; the §1 definition
counts neither), gable 6/6.

**Judge recall (step 0b on this set).** A describe crop is *good* when reader A read axes, storeys and gable from it at med/high (41 of
60). Jev v1 quality: AUC 0.776; at `JUDGE_GOOD` 0.5 36 picks, precision 0.83, recall 0.73; at 0.4 precision 0.84, recall 0.76; the
lowest threshold with precision >= 0.9 is 0.61. v2 scored only 18 of these crops (AUC 0.31, not usable). `JUDGE_GOOD` stays 0.5 and
v1 stays the default (judgement ruling); these are numbers only.

```
node --import tsx scripts/house-specs/hand-set/select.ts     # the AB07 draw (hand-set-v1.selection.json)
node --import tsx scripts/house-specs/hand-set/select-gable.ts   # the 40 gable-only rows (hand-set-v1.gable-selection.json)
node --import tsx scripts/house-specs/hand-set/sheets.ts --gable --out <dir>   # their crown crops
node --import tsx scripts/house-specs/hand-set/sheets.ts     # reading sheets -> artifacts/hand-set/sheets/<id>.jpg
node --import tsx scripts/house-specs/hand-set/build.ts      # reader-a.tsv (+ .fronts.json) + reader-{b,c}.raw.json + gable-{b2,c2}.raw.json -> hand-set-v1.json, reader-b/c.json, gable-b2/c2.json, multi-specs.json (validated)
zsh -lic 'node --import tsx scripts/house-specs/hand-set/jev-storeys.ts --budget-usd 1'   # Jev storeys -> hand-set-v1.jev-storeys.json
node --import tsx scripts/house-specs/hand-set/score.ts      # ceiling, gates, writers, BAG variants, old truth, H9, judge recall -> hand-set-v1.scores.json
node --import tsx scripts/house-specs/agreement.ts --hand-set  # the same report from the agreement entry point
node --import tsx scripts/house-specs/hand-set/contact.ts --pands <12 ids> --out <dir>   # the spot-check sheets
```

Archive: `HOUSE_CROPS_ARCHIVE` (default `~/Code/map-recall2-source-data-h5h`) and `SOURCE_DATA_MAIN` (default
`~/Code/map-recall2-source-data`, for the block-face strip). Spot-check sheets for the user:
`map-recall2-screenshots/ui/2026-11-10-house-h5h/contact-1.jpg`, `contact-2.jpg` (round 1), `contact-r2-1.jpg`, `contact-r2-2.jpg` (round 2, multi-front and unknown marked). To extend the set, add rows to
`hand-set-v1.reader-a.tsv` (columns in build.ts), rebuild, and have two blind readers read a third of the new pands (the ceiling is the blind pair).

## §5 The kit-gap queue

Stub (lane H6): `kit-gaps.ts` aggregates `schemaLimits` by `component`; the horizon rule.
