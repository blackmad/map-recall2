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
| §2 Preview in Node | H2 | landed |
| §3 Stage and publish | H3 | landed |
| §4 Describe at scale (crops → facts → spec) | H4 (§4a), H5 (§4b) | landed on the AB07 pilot |
| §5 The kit-gap queue | H6 | stub |
| §6 Worked example: the timed pilot (Nieuwmarkt, Bloemgracht, Nassaukade) | H7 | landed (staged batch `pilot-20261110`) |

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
                      crop of the pand's wall (scripts/block-face/faces/*/strip.json), else the house:crops crop
                      (--crops); writes compare.png and prints the likeness verdict (wall dL/hue, glazing, columns,
                      window shape) of render vs photo
  --crops <dir>       the house:crops archive (a map-recall2-source-data checkout holding pand-crops/<pand>/front.jpg;
                      default env HOUSE_CROPS_ARCHIVE); the describe envelope's best-of-years pick is used when present
  --prefer-crop       take the house:crops crop before the block-face strip
  --chunk <face>      render the block face compiled by scripts/block-face/compile.ts --face=<face> and not installed
                      (staging/block-face/<face>/chunk.glb, placed by its manifest-entry.json) instead of the route the
                      game draws today: the after frame of a chunk change before the integrator installs it
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

Lanes stage, the integrator publishes once per batch. Nothing a lane does under `house:stage` touches `public/`.

```
lane:        spec ──► house:preview ──► house:stage ──► artifacts/house-specs/staging/<pandId>.json
integrator:  house:publish  (one batch: merge → recipe route → compile touched cells → goldens → guard → check:canal → record)
```

### Layout

| Path | Written by | What |
|---|---|---|
| `artifacts/house-specs/staging/<pandId>.json` | `house:stage` | `{spec, stagedAt, by, note, receipt}`; one file per pand, restaged = replaced |
| `artifacts/house-specs/work/<batch>/{specs,intents}/` | `house:publish` | the batch's specs as plain files for `build-house-specs --extra-specs`; recipe-route intents (`toRecipe`) |
| `artifacts/house-specs/logs/<batch>-<step>.log`, `<batch>-nightly.log` | `house:publish`, `nightly.sh` | one log per step |
| `artifacts/house-specs/published/<batch>.json` | `house:publish` | what landed: specs, receipts, pand records, touched tiles and cells, cell files that changed, covers delta, installs, holds, the golden allow-list, per-step timings, wall time against the 15 min budget |
| `artifacts/house-specs/published/<batch>/<pandId>/{staged.json,measure.json,compare.png}` | `house:publish` | the staged files moved here, with the receipt files |
| `scripts/house-specs/specs/<pandId>.json` | `house:publish` (step 2) | the published specs, the durable source `build-house-specs` rebuilds the extract from (commit them) |
| `<map-recall2-source-data>/house-specs/<batch>/` | `house:publish --archive` | the published directory copied for the archive worktree; the integrator commits and pushes it |

### A receipt

The receipt is what proves the spec was looked at: the `measure.json` and `compare.png` that `house:preview` wrote for this spec
(`artifacts/house-preview/<pandId>/`), with their sha256 and the verdict word. `house:stage` refuses a spec with no preview
output, or with a `measure.json` older than the spec file (re-run the preview). `--no-receipt "<reason>"` stages without one and
records the reason (the preview cannot draw this house, or H2 is not merged); `house:publish` prints the count of each kind and
refuses a receipt whose files changed after staging.

### Commands and flags

`--help` of each script prints exactly this text (the `HELP` constant of the script).

```
house:stage: validate a HouseSpec, attach the preview receipt, write it to the staging directory.

  npm run house:stage -- <spec.json|pandId> [--note "..."] [--by <name>] [--preview-dir <dir>]
                                           [--no-receipt "<reason>"] [--stale-receipt]
  --help                                   this text

<spec.json|pandId>   a spec file, or a 16-digit pand id read from scripts/house-specs/specs/<pandId>.json
--note "..."         free text kept with the staged spec (shown in the publish table)
--by <name>          who staged it (default: git user.name, else $USER)
--preview-dir <dir>  where house:preview wrote this pand's measure.json and compare.png
                     (default artifacts/house-preview/<pandId>)
--no-receipt "<r>"   stage without a preview receipt; the reason is recorded and shown at publish (use it only when the
                     preview cannot draw this house, and say what stands in for it)
--stale-receipt      accept a measure.json older than the spec file (default: refused, the receipt must be of this spec)

Writes artifacts/house-specs/staging/<pandId>.json = {spec, stagedAt, by, note, receipt}. Lanes stop here: house:publish is
the integrator's (batch, covers, goldens, check:canal). A pand already staged is replaced.

house:publish: publish the staged HouseSpecs as one batch (the integrator's command; lanes stop at house:stage).

  npm run house:publish -- [--dry-run [--compile]] [--batch <name>] [--allow-extra <pandIds>]
                           [--world-out <dir>] [--full-bake] [--goldens] [--archive <dir>]
                           [--verbose] [--skip-check-canal "<reason>"] [--skip-suppression "<reason>"]
  --help                   this text

  --dry-run [--compile]     step 1 only (with --compile also a rehearsal of step 4 in a scratch copy of --world-out, compiled
                           against the staged extract; nothing under public/ changes): merge the staged specs into a STAGED extract (public/data/extracts/amsterdam/staging/
                           house-specs), print the per-pand field diff, the touched z14 tiles and the cells they rebuild, and
                           the commands a real run would use. Nothing is published, installed or compiled.
  --batch <name>           the batch name (default batch-YYYYMMDD-HHMM); names artifacts/house-specs/{published,logs}/<name>*
  --allow-extra <ids>      pand ids whose extract record may change although no staged spec names them (default: any such
                           change refuses the batch, it means a source drifted since the last publish)
  --world-out <dir>        the world:compile staging directory (default artifacts/world/staging); needs a previous
                           index.json there for --changed
  --full-bake              when the shell code changed since that compile (world:compile --shell --changed refuses), run a full
                           world:compile --shell instead of stopping
  --goldens                run the four goldens even for a generic-route-only batch (default: only when a spec has route recipe)
  --archive <dir>          the map-recall2-source-data checkout (default $MAP_RECALL_SOURCE_DATA): specs + receipts are copied
                           to <dir>/house-specs/<batch>/ (the integrator commits and pushes that worktree)
  --verbose                list every staged spec and every field of the diff (default: the first eight)
  --skip-check-canal "<r>" do not run check:canal (a rehearsal only; the reason is recorded in published/<batch>.json)
  --skip-suppression "<r>" do not run the suppression guard (same)

Steps, in order (each timed in published/<batch>.json; logs in artifacts/house-specs/logs/<batch>-<step>.log):
  1 merge      build-house-specs --extra-specs <batch dir>: staged tiles, diff vs the published extract, extra-pand refusal
  2 write      copy the specs to scripts/house-specs/specs/, build-house-specs --publish (the published extract changes here)
  3 recipe     only if a spec has route recipe: toRecipe -> houses/<id>/intent.json, facts, install.ts, build-covers,
               copy covers.json, check:covers (covers.json changes here)
  4 compile    world:compile --changed --shell (touched cells only; each tile hashes its own slice of covers.json); the cell
               files that changed must all belong to a touched tile
  5 goldens    fit-golden, large-mesh-hashes, roof-golden, block-kit-installed with --allow=<batch ids>; check:stale-installs
  6 suppress   the #341 audit (house:audit) for every pand the batch's covers newly hide, plus recipe-route pands: a street wall
               of 4 m or more left blank refuses the batch
  7 check      check:canal once
  8 record     published/<batch>.json, staged files moved to published/<batch>/, archive copy, the HISTORY/What's New paragraph,
               and the commands that copy the compiled world into public/data/extracts/amsterdam/world-v1
Exit code is non-zero on any gate failure; the working tree is left as it is for the integrator to inspect (git status).
```

### The batch rule

Lanes never publish. A lane's last step is `house:stage`; it returns the staged pand ids in its hand-back. The integrator runs one
`house:publish` for everything staged (`scripts/house-specs/nightly.sh` is that command with a log, for whenever the integrator
chooses; the repo installs no cron). One batch = one commit, one HISTORY entry, one What's New note (the command prints drafts).

### What each step does

1. **merge.** The staged specs are written as plain files and `build-house-specs --extra-specs` resolves them with every other source
   into the STAGED tiles (`public/data/extracts/amsterdam/staging/house-specs`). The staged tiles are diffed against the published
   ones, field by field, per pand. A record that changes although no staged spec names that pand refuses the batch (a source drifted
   since the last publish); `--allow-extra <ids>` accepts named ones. A staged pand that lies in no building tile also refuses.
   `--dry-run` stops here and prints the diff, the touched z14 tiles and the cells that list them. `--dry-run --compile` also
   rehearses step 4 in a scratch copy of the compile directory against the staged extract.
2. **write.** The specs are copied to `scripts/house-specs/specs/` and `build-house-specs --publish` replaces the published
   `house-specs/14`. This is the first step that changes `public/`.
3. **recipe route.** Only for specs that resolve to `route: 'recipe'`. The intent is `toRecipe(resolved spec)` under the id of the
   house directory that already carries the pand (its earlier sources are kept), else `spec-<pandId>`; `facts.ts` fills the facts of a new
   directory; `install.ts --house=<ids>` compiles and installs; then `build-covers`, the covers copy to `models/covers.json` and
   `check:covers`. **Stale installs:** a reinstall that fails its gates keeps the old GLB and writes `held-installs.json` with the
   reason `staged spec <date>` (`check:stale-installs` then passes with the hold explicit); a new house that fails stops the batch.
4. **compile.** `world:compile --changed --shell` into the compile directory. Every tile hashes its own inputs and its own slice of
   `covers.json` (below), so only the cells that list a touched tile rebuild. After the compile the cell, shell and far files that
   differ from the previous `index.json` are compared with the cells of the touched tiles; any file outside them fails the batch. If the shell code
   changed since the last compile the compiler refuses `--shell --changed`; the command then stops and says so, or with `--full-bake`
   runs a full `--shell` bake.
5. **goldens.** `fit-golden`, `large-mesh-hashes`, `block-face/roof-golden` and `haparandaweg/check-installed` run with
   `--allow=<ids>`: the batch's pand ids plus the house directories, block faces and block-kit specs that mention one. A change inside
   the list is re-recorded; a change outside it fails the batch and its ids are printed. `check:stale-installs` runs last. Skipped for
   a generic-route batch (no intent, face or kit spec changes); the per-cell compare of step 4 is the guard there. `--goldens` forces them.
6. **suppression guard.** For every pand the batch newly hides (the covers delta) and every recipe-route pand, the #341 audit
   (`scripts/house-audit/suppressed-faces.ts`, bare-slab test included) runs on this checkout; a street-facing BAG wall of 4 m or more
   on a named street left blank (no outward geometry, or a bare slab) refuses the batch and prints pand, street and wall length. A
   wall that only stops short of the eaves (a setback or gable) passes. The command calls the audit through the `SuppressionAudit`
   interface (`publishPlan.ts`): it shells out to the script and reads `walls[]` of its JSON. It fails closed when the script is not on the branch.
7. **check:canal**, once.
8. **record.** `published/<batch>.json`, the staged files moved to `published/<batch>/`, the archive copy, and printed drafts of the HISTORY
   line and the What's New note.

### Covers per tile (`src/canalRecall/world/tileCovers.ts`)

`covers.json` used to be a global compile input, so one install rebuilt the city. It reaches the world only through each cell's
`hide` list, so it is now hashed per tile: the slice of `covers.json` that names a building of the tile (`coversHides`, the hide entries
in compile order) is hashed beside the tile's own inputs and stored in `index.json` as `tileCovers`. The ids of each tile come from
`<out>.tile-ids.json` (beside the compile directory, not in it, so publishing the directory does not carry it), keyed by the sha256 of the tile
file and reused while the file is unchanged. A first run parses the tile files (about the cost of one full load). `--against`
compares hidden lists per cell: a cell's hide list is compared when the reference's slice of every tile it lists equals ours (a
reference compiled before this change is compared on the whole-file hash as before). `world:verify` also fails on a tile whose slice moved
since the compile (`staleCovers`). Not hashed: the order of models inside `covers.json` across tiles (a reorder with no content change is not
seen; run a full compile after one). `COVERS_FILE=<path>` points the compiler at another covers file (rehearsals, measurements).

### Measured (2026-11-10, lane H3, 14-core Mac with other lanes running: load average 10 to 40 during the runs)

What `world:compile` and the gates cost before the change and after it. A 50-spec batch is the 50 canal-belt pands of tiles
8412/5384, 8413/5382 to 8413/5386 (generic route, one `bays` field each, author source), staged with `house:stage`.

| Step | Before | After |
|---|---|---|
| `world:compile` full, no shell | 46 s | same cells (0 of 604 files differ) |
| `world:compile --shell` full | 262 s | 199 s and 262 s (load 15); cells, shells and far files byte-identical to before (0 differing of 604, 564, 604) |
| a **covers.json change** (one model, 2 pands in 2 tiles), `--changed --shell` | every cell: 604 cells, a full bake (~262 s) | 2 tiles changed, 12 cells rebuilt, **19 s**; 2 cell files differ, 11 shell and 10 far files |
| a 50-spec batch, `--changed --shell` (6 tiles) | 6 tiles (spec files were already per tile) | 24 cells rebuilt, 22 cell/shell/far files differ, **33.8 s** |
| `house:publish --dry-run --compile` for the 50 specs | n/a | **37 s** end to end (merge 1.8 s + compile 33.8 s) |
| `world:verify` on that rehearsal | n/a | 8 s: 295 tiles, 350,337 buildings, 0 differing, 0 stale, 0 staleCovers |
| `build-covers` / `check:covers` | 9 s / 1 s | same |
| `test:fit-golden` / `large-mesh-hashes` / `roof-golden` / `test:block-kit-installed` / `check:stale-installs` | 5 s / 13 s / 9 s / under 1 s / 1 s | same, now with `--allow` |
| #341 audit (`suppressed-faces.ts`, 2,636 walls) | n/a | 37 s |
| `check:canal` | did not finish: stopped by hand at 25.8 min, 158 checks had passed, inside `check:rail-street` (8.5 min at 99 % CPU when load averaged 20 to 40); the brief's "about 6 min" does not hold on a loaded machine | not part of the batch timing |

Gate arithmetic: merge 2 s + write 2 s + compile 34 s + verify 8 s is about a minute for the 50-spec batch, with the goldens skipped (generic
route) and no suppression change; a recipe batch adds the installs, `build-covers` (9 s) and four goldens (under 30 s) plus the audit (37 s). The
15 min budget is met by everything except `check:canal`, which alone took more than 15 min on this machine under this load; the integrator's
timing of a batch is therefore its `check:canal` timing plus about a minute, and `--skip-check-canal "<reason>"` exists for rehearsals only.

Decoded equivalence: the `--changed` rehearsal compiled into a scratch copy of the staging directory verifies against the default tile path
(`world:verify`, `HOUSE_SPECS_DIR=staging/house-specs`) with 0 differing tiles. Two full compiles with different specs do not match byte for byte
(604 of 604 cell files differ) because the shared string table is chosen from the cells' strings; a `--changed` run keeps the earlier table, which is
why only the rebuilt cells differ in the numbers above.

What was not run end to end: step 2 onwards of a real `house:publish` (writing `public/`, the recipe route's installs, the goldens'
re-recording through the publish command, the suppression guard through the audit, `check:canal` inside the command). Each piece ran on its
own: `--allow` against a deliberately altered golden for all four scripts (inside the list re-recorded to the exact original, outside it exit 1 with nothing
written); the audit against its real JSON (219 blank street walls of 4 m or more in the existing suppressed set; the guard only looks at a batch's own pands);
the compile and the verify as above. The first real batch is the integrator's and should be a small one.

### The integrator's checklist for a batch

1. `npm run house:publish -- --dry-run --compile` and read the diff, the receipts count and the cells it rebuilds. Unstage anything unexpected (delete its file in `artifacts/house-specs/staging/`).
2. `npm run house:publish` (or `scripts/house-specs/nightly.sh`). Exit non-zero = a gate failed; the message names it, the step log is in `artifacts/house-specs/logs/`, and the working tree is as the batch left it.
3. Copy the compiled world: `for d in cells shells far; do rsync -a --delete artifacts/world/staging/$d/ public/data/extracts/amsterdam/world-v1/$d/; done; cp artifacts/world/staging/{index.json,tiles.json,strings.bin} public/data/extracts/amsterdam/world-v1/`; then `npm run world:verify` (globalFresh true, 0 stale, 0 staleCovers, 0 differing) and `npm run test:world-format`.
4. Recipe batches: rebuild covers-dependent bundles and stamps, `npm run test:canal-game-structure`, re-publish landmark cards if an extract regenerated.
5. Commit specs, the published extract, world-v1 (and houses, GLBs, catalogue, covers, goldens for a recipe batch); push the archive worktree; paste the HISTORY and What's New drafts.


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
| `--prefer-bearing <deg>` | pick the street wall whose outward normal is within 50 degrees of this bearing (`select.ts options.preferBearingDeg`). For a row on a square, where the nearest-road rule picks a side or back wall (Nieuwmarkt 6-22: 293, lane H7). Applies to every pand of the run, so use it with `--pand`. |

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

**Publishing is opt-in per buurt.** `house:specs` reads `scripts/house-specs/generated/<buurt>/` only for buurten named in
`--generated=<buurt,...>` (default none). AB07 is generated but not published: H5's agreement gate could not be assessed,
because 33 of its 39 hand pands are type placements rather than photo readings. A buurt is named only after its writers pass
agreement against the photo-read hand set (H5h #351).

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
  bag       bag / 3dbag     facts/facadeYear (0.5), fronts/0/storeys (0.4, eaves at 3 m a storey)
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
| `bag.ts` | no | `bag` / `3dbag` | `facts/facadeYear` 0.5 (the building's year, not the front's), `fronts/0/storeys` 0.4 (eaves at 3 m a storey, `bag-facts` descriptor) |
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
library's gable, bays and colour), 6 are authored recipes, none states a finish.

#### Measured on AB07 (2026-11-10, Bloemgrachtbuurt, 662 pands)

Crops: good 120, fallback 433, hard-flag fail 99, no crop 10. Coverage, pands with the field per writer: gable register 174, Jev 6;
bays Jev 112, pixel 31; wall colour pixel 495; wall material Jev 72, register 3; pui Jev 42; facade year bag 637, register 183;
storeys bag 657. Disagreements between writers: facade year 171 (BAG's building year against the register's front year, expected),
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

## §5 The kit-gap queue

Stub (lane H6): `kit-gaps.ts` aggregates `schemaLimits` by `component`; the horizon rule.

## §6 Worked example: the H7 timed pilot (lane H7, #354, 2026-11-10)

Three rows went crop → describe → preview → compare → stage, timed: Nieuwmarkt 6-22 (7 pands, AE03), Bloemgracht 121-197
(face `bloemgracht-121-197`, 8 pands, AB07: the H4 buurt is Jordaan, not Grachtengordel-West; it is the AB07 row of 8-12 houses
with the most register entries and at least two hand intents) and Nassaukade 152-145 (face `nassau-145-152`, 7 pands, EQ01).
Specs and readings: `scripts/house-specs/pilot-20261110/` (`readings.json` -> `make-specs.py` -> `specs/<pandId>.json`).

### One house, every command: Nieuwmarkt 6 (0363100012171851)

```sh
# 1. crop (54 s for the 7 pands of the row, 3-27 requests each)
PAND_REFERENCE_CACHE=~/Code/map-recall2/.cache/pand-reference HOUSE_CROPS_ARCHIVE=~/Code/map-recall2-source-data-h7 \
  npm run house:crops -- --buurt AE03 --pand 0363100012171851,...   # -> "7 12171851 ok wall rejected:blocked+blank"
```

The crop was of a side wall: the row's fronts face the square (outward normal 114 degrees), and `pickWall` takes the longest
wall on the nearest *road*, which on Nieuwmarkt is an alley or the back street for 5 of the 7 pands (two were close-ups of a door).
`--prefer-bearing 114` (new in H7) picks the wall facing the square, falling back to the longest exposed wall within 50 degrees of
the bearing when no road-facing wall is there; re-cropped in 36 s, all 7 usable.

```sh
npm run house:crops -- --buurt AE03 --pand <the 7> --prefer-bearing 114 --restart     # -> "7 12171851 ok wall usable"
zsh -lic 'node --import tsx scripts/house-crops/judge.ts --buurt AE03 --archive <archive> --pand <the 7> --budget 0.5'  # quality 0.59
# 2. describe (0.7-1.1 s a pand): register step gable, Jev bays 2 + wallMaterial brick, pixel colour, BAG storeys
zsh -lic 'npm run house:describe -- 0363100012171851 --archive ~/Code/map-recall2-source-data-h7'
# 3. preview the game today beside the crop (1.7 s); --wall frames the same wall as the crop
npm run house:preview -- 0363100012171851 --photo --wall 114deg --crops ~/Code/map-recall2-source-data-h7
```

The sheet shows the game already draws the register's step gable on the square front (the generic path, since H1) with two
window axes; the photo has two axes, bare orange brick and white speklagen through the gable. The verdict is FAIL (columns 3 vs 2,
wall hue -159 degrees): the render's wall patch is read on glass, so the verdict is not taken on its own; the reading is by eye.

4. **Correct.** `readings.json` gets `fronts/0/gable: step` (confirms the register), `fronts/0/bays: 2` (held, `SPEC_BAYS_HELD`),
`palette/wallMaterial: brick` and the limit `{palette: speklagen ...}`; `make-specs.py` writes the spec with `author` receipts.

```sh
# 5. preview the spec as the game will draw it after publish (staged extract; 1.8 s a pand after a 1.7 s merge)
node --import tsx scripts/house-preview/resolved.ts --specs scripts/house-specs/pilot-20261110/specs 0363100012171851 \
  --photo --wall 114deg --crops ~/Code/map-recall2-source-data-h7
# 6. stage (0.3 s)
npm run house:stage -- scripts/house-specs/pilot-20261110/specs/0363100012171851.json --by "lane H7"
```

The after render is byte-identical to the before: on the generic path a spec draws only the gable (already drawn), the era and
`registerFinish`, and a brick finish on a canal-style front changes no pixel. Time for this house: about 2 minutes of lane time
(its share of the row's crop and re-crop, 0.7 s describe, two 2 s previews, one reading, 0.3 s stage).

### What the pilot measured

| Row | Houses | Staged | Route after publish | Render changed by the spec |
|---|---|---|---|---|
| Nieuwmarkt 6-22 | 7 | 7 | generic (all) | 0 of 7 (byte-identical previews) |
| Bloemgracht 121-197 | 8 | 6 | generic 4, recipe 2 (168006, 174828) | 2 of 8 (the recipe pands; 168006 needed a wall-colour and roof correction) |
| Nassaukade 152-145 | 7 | 5 (+ the corner by the chunk route) | recipe 5, chunk 1, none 1 | 6 of 7 |

* Lane time from the first crop request (16:10) to the 18th staged spec (16:32): 22 minutes for 22 houses, including two tool
  fixes (`--prefer-bearing`, `resolved.ts`) and the corner chunk; median about 1 minute a house, the slowest the corner (6 minutes).
* Per step: crop 6-8 s a pand (network), judge 0.05 s, describe 0.5-1.4 s, preview 1.5-2.2 s (generic) or 2.5-10 s (recipe compile),
  stage 0.3 s. One hand-correction iteration took 5 s (spec edit -> resolved preview).
* Not staged: Bloemgracht 174173 (a tree covers the front: no evidence), 174177 (the crop shows a pointed brick gable where the
  register says cornice and plaster: crop or pand link unresolved), Nassaukade 146 (0363100012160704: the resolved spec fails the
  recipe compile, "Opening escapes its wall", because BAG draws the erker into the footprint; a staged spec would stop the batch),
  and the corner 151-152 (0363100012116526, below).

### The corner pand 0363100012116526 (multi-front)

`chunk-face-clercq-236681` suppressed it and modelled only its De Clercqstraat front; its Nassaukade face was a bare slab. Route
chosen: **chunk extension** (block-face route). Its house in `clercq-236681/intent.json` became a two-front `design`: `front0` the
resolved De Clercqstraat type (`clercq-nassaukade-corner`), front `nassaukade` the face read on `nassau-145-152` (6 axes in two
halves, 5 storeys with a tall ground storey, bracketed white cornice, two pediment dormers, bar front over the left three axes);
`pands/0363100012116526/facts.json` gained the Nassaukade frontage. The face compiles with every gate and interference check
passing (27,660 triangles). `npm run house:preview -- 0363100012116526 --chunk clercq-236681 --photo` draws the front: 6 vs 7
columns, tall windows (verdict FAIL on wall dL +0.14: one palette per pand, the De Clercqstraat type's #715850 is kept). Narrowing
the suppression was not chosen: the generic path would draw a second shell over the chunk's (the pand stays in the chunk for its
other front), and the HouseSpec recipe route compiles one street front per pand (its resolved spec is the clercq record, street
De Clercqstraat, and fails "facts.json has no frontage for De Clercqstraat").

What a `fronts[]` HouseSpec field needs to say for such a pand: one entry per street facade with its `street` (the key the
recipe fit uses to find the frontage in facts), its own gable/cornice, storeys, bays, door axis, shopfront and dormers, and the
receipt per front (`fronts/1/bays` from the Nassaukade strip, `fronts/0/*` from the De Clercqstraat strip); a shared palette or a
per-front palette (the two reads differ by about dE 5); and a rule for which front's roof line wins at the corner (the chunk planned
the attic from front0's 14.65 m eaves, so the Nassaukade dormers are not drawn). Today the resolver keeps whichever face's adapter
wins per field path, so two faces naming one pand merge into one front (bays 1 from the clercq record).

### The tools H7 added

* `house:crops --prefer-bearing <deg>`: §4a table.
* `house:preview --crops <dir>` (the house:crops archive as the photo; the describe envelope's best-of-years pick when present),
  `--prefer-crop`, `--chunk <face>` (a compiled, not installed block face): §2 `--help`.
* `scripts/house-preview/resolved.ts` (`--help`): a spec batch rendered as the game will draw it after publish. `house:preview --spec`
  writes the gable and the wall colour onto the pand directly, so it draws a wall colour the game holds and never shows the recipe
  route; `resolved.ts` runs the publish merge (`build-house-specs --extra-specs`) and renders by the resolved route. Use it for receipts.
* `scripts/house-specs/pilot-20261110/demo-bundle.ts`: the Nassaukade demo bundle (per house: photo crop, before/after render,
  compare sheets and measureFacade before/after, the spec with provenance, `fields.json` = field, value, source, evidence, what it
  changed; plus the row strips and `index.json`) into `artifacts/house-line/demo-nassaukade/` (gitignored). The archived copy, JPEG,
  paths flattened to `<pandId>-<file>`, is `ui/2026-11-10-house-line-nassaukade/` in the screenshots repo.
