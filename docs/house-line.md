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
| §4 Describe at scale (crops → facts → spec) | H4, H5 | stub |
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

### What `bays` means (H1b, #349)

`bays` is the number of **columns of window openings per facade** on the storeys above the ground floor (`frontBays`:
the axis grid when stated, else the per-storey maximum above the ground). It is not a count of windows (a 2-window
texture cell is 2 bays, not 1) and not a count of grid cells. The generic path draws a front as whole texture cells, each
carrying `openings.upper.axes.length` columns (2 for almost every canal/c19 style, 3 for a few canal ones), so the drawn
count is cells x axes. `streetFacadeRendering.ts` `specCellCount` picks the cell count whose drawn count is nearest
`bays`, a tie going to the fewer, held to `MIN_COLUMN_M` (1.8 m) per column and to what the bay-scale clamp lets
`layoutWall` reproduce. An odd count on 2-axis cells therefore draws the even number below it (3 -> 2, 5 -> 4);
the generic cells have no plain 3-window c19 style and no 1-window canal/c19 style, which is the kit limit behind that.
A street-appearance recipe's own `bays` keep the old cell fit.

**Still held** (`decorate.ts SPEC_BAYS_HELD = true`, judgement ruling on #349): the fix removed the doubling but on the 19
scorable #348 pands after = before, because 2-axis cells cannot draw the commonest canal rhythm (3 bays). H1c #350 adds
odd-axis cells and audits the bay sources; the hold lifts after its gate (strictly closer on >= 60 %, worse on none).

The 2026-11-10 doubling (photo 3 drawn 6, photo 2 drawn 4, photo 3 drawn 4 on the #348 sample) was `Math.round(bays /
axes)`: 5/2 = 2.5 rounded up to 3 cells = 6 columns, 3/2 = 1.5 up to 2 cells = 4. Trace of 0363100012169901
(Bloemgracht, front 8.87 m): block-face intent `fronts/0/bays: 5` -> house-specs view `bays: 5` -> `specRecipe.bays: 5`
(decorate) -> `specBays {bays 5, axesPerCell 2}` (mesher) -> `frontageLayoutScale` cells 3 (old) / 2 (now) -> `layoutWall`
cells -> drawn columns 6 (old) / 4 (now); the preview's `measureFacade` read 6 and 4, the photo is 3.
`scripts/house-specs/trace-bays.ts <pand>` prints this chain; `scripts/house-specs/bays-gate.ts` is the #348 sample gate
(hand-grid photo counts in `bays-gate-photo.json`). The source `bays` is itself sometimes high (5 for a 4-column
front; doorBay included), so a nearer count is not always the photo's.

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

Stub (lanes H4, H5): `house:crops`, `house:describe`, the writers in trust order.

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

## §5 The kit-gap queue

Stub (lane H6): `kit-gaps.ts` aggregates `schemaLimits` by `component`; the horizon rule.
