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
| §6 The standing acceptance set (easy houses) | H9 | landed |

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
  raw feature as `p.houseSpec` = `{gable, year, wallMaterial, wallHex, bays, storeys, src}`.
- `withHouseSpec` runs right after the register step (before `decorateFacade`): it moves `constructionYear` only on an
  era change (the register's rule), sets `registerFinish` from `wallMaterial`, and writes `specRecipe`
  `{bays, storeys, wallHex, period, crownShape}` when the spec has bays, storeys or a wall colour.
- `withHouseSpecCrown` runs after `withMonumentGable` (which would otherwise restore the register's gable): it sets
  `monumentGable` when the spec's gable source outranks `monument-text`, or when nothing named a gable.
- The view carries a street-measured gable to the roof planner only for a full-width step/neck/raised-neck/bell/
  spout/point crown on a roof that is not flat; a cornice or flat front, or a crown over some bays, stays in the record
  (the roof planner draws a monument gable as a canal house's whole roof; measured on the first full compile, cornice
  fronts gave 681 flat-roofed 1890s pands a pitched canal roof).
- `threeBuildingFeatures.ts meshBuildingFor` keeps `specRecipe` as `MeshBuilding.specRecipe` (not `.recipe`: that slot
  switches every wall to recipe openings and street-crown recolouring). A measured `wallHex` is a sourced wall in the
  photo look, drawn through the wall-colour rule below (H1 held it; lane H9 released it). `streetFacadeRendering.ts
  frontageLayoutScale` fits a street run to the stated bays: cells = round(bays / window axes per cell), clamped to
  0.7–1.5 of the style's bay. The generic cells carry two or three window axes, so an odd bay count on a two-axis cell
  rounds (a limit of the generic path, not of the spec). **Held** (`SPEC_BAYS_HELD`, 2026-11-10, #348: H1's bay
  counts doubled on canal houses near the Dam, photo 3 drawn 6; lane H1b owns the cause): no spec bay count reaches
  the mesher. Storeys, wall, gable, year and finish are unaffected.
- **Storeys** (lane H9): `fronts/0/storeys` (storeys below the crown, ground included) reaches the view as `storeys`
  and `specRecipe.storeys`; `specStoreyScale` sets the storey pitch so `layoutWall` draws that count on the run's wall
  (pitch 0.75–1.45 of the style's storey; outside it the style's own count stands). The register never states
  storeys; block faces and authored specs do (1,342 views).
- **Flat crowns** (lane H9): a `flat` front from a source stronger than `monument-text` turns a register gable into
  the cornice crown (a straight top over the roof behind); without a register gable nothing changes, so a flat front
  never gains a pitched roof. 422 views state flat; one of them (Raadhuisstraat 0363100012176346) had a register gable.
- **Painted brick** with a measured colour keeps the brick cells (`registerFinish: 'brick'`): the courses show through
  the paint, and plaster cells drew a near-black painted front as render. Without a measured colour the register's
  rule (painted = a light finish) stands.

### The wall colour (lane H9, `houseSpec/wallColour.ts`, flag `?specWalls=0`, `SPEC_WALLS=0`)

Why: H1 held the measured wall colours because the overcast strip readings drew Kinkerstraat 244-332 darker than the
period palette, against the user's brighter-palette priority (2026-10-16). Held, every measured house fell back to its
period colour, which is the wrong colour *family*: the user's easy-houses sheet (2026-11-10, §6) showed near-black
painted fronts as white plaster or orange brick and pale salmon brick as dark maroon.

The rule (round 2, the judgement session's ruling on #345: "brighter, not dour"; the trim misread), constants in
`SPEC_WALL_LIFT`, two functions:

1. **`specWallSource(measured, {family, brick})`, pixel or family tone.** A reading lighter than its family's usual tone
   (`FAMILY_TONE`, OKLab L + 0.05), on a front whose finish is brick (spec `wallMaterial` or the register's
   `registerFinish`), or against a reader's family (`facts.wallFamily`, from the H5h hand set) that disagrees with the
   pixel's, has caught white speklagen, frames or glare. It draws the family tone. Without a reader family, a brick
   finish compares with the nearest brick family. For example, Nieuwmarkt 0363100012182857, red brick with white bands,
   read #ceb8ae and drew pale pink-beige; it now renders #a45b4f.
2. **`specWallDisplay(hex, {fromPixel})`, the drawn tint.**
   - Lightness: one monotone lift, `L' = 1 - (1 - L)(1 - k)` with `k = 0.25`, floor 0.34 and ceiling 0.93. Dark
     neutral paint takes no lift (`liftShare`).
   - Chroma on a pixel reading: ×2.4 with the same lift share, on warm hues only (20-85 degrees).
     - Near-neutral readings (C < 0.015 to 0.03) keep theirs.
     - A cool cast (blue, green) keeps 35 % of its chroma.
     - Yellow-shifted hues come half way back towards the brown tone (46 degrees): overcast readings sit 15-20 degrees
       yellower than brick, and J2 found the pixel turns red-brown into dull brown.
     - A hue-dependent cap (0.12 at red, 0.06 at yellow-brown) stops a lifted brown turning ochre.
     - Finally the colour is fitted to the gamut at the same lightness and hue.
   - A family tone gets lightness only.

`SPEC_WALL_HOLD` holds a pand's wall by pand number. It is empty: 182857 passes.

Gate, both ways (2026-11-10, `house:preview` lit look, wall = `measureFacade` H2c reading of the render; spec bays held):

| Set | Before (period colour) | Round 1 (hue kept, chroma 1) | Round 2 (final) |
|---|---|---|---|
| Kinkerstraat 244-332, 26 generic pands: HSL L | 0.395 | 0.436 (+0.041) | 0.413 (**+0.018**, gate ≥ 0) |
| same: OKLab C | 0.065 | 0.032 | **0.059** (gate ≥ 0.058) |
| 24 random pands (seed 345): HSL L | 0.389 | 0.486 | 0.464 (+0.075) |
| same: OKLab C | 0.059 | 0.033 | 0.062 |

The render measure moves by about 0.02 L between near-identical runs. The trim rule fires on 4 pands city-wide (176346,
180181, 182849, 182857, each with a hand-set family). The register-brick branch fires on none today. Easy-houses
families against the hand set: 9 of 12 exact, 3 adjacent, 0 wrong.

City-wide reach: the rule changes the wall of **425 generic-path pands** (the coverage report's
`genericVisibleBy.wallHex`; 1,367 views carry a wall colour, 1,183 pands are hidden by installed models). The
easy-houses set's colour families are in §6.
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
colour radius, trim yes/no and glazing +-0.1, plus the rule on cluster statistics. Known limit, outside the wall pick: on a
dark front the opening pass still fills every storey into one frame, so glazing reads 0.86 where the eye says 0.25; four
labelled fronts pin that miss (`knownMiss`) until the opening pass is fixed.

The replay behind the no-flip claim: `likeness-replay.ts --dump` (needs `MAP_RECALL_SOURCE_DATA`), then `--replay` with and
without `--no-wall-vs-trim`, then `--diff`: 448 groups of 160 installed large houses, 0 verdicts and 0 reasons moved.

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
  --glb-lit           draw a GLB route's front through the rig's Lambert too (default: flat game colours,
                      which matched the ride frame; the Lambert drew an installed wall 0.11 L dark)
  --wall <edge|deg>   frame this footprint wall: an edge index of the outer ring (the audit's edge field) or the edge whose outward
                      normal bearing is nearest, e.g. 215deg. Sets the front and the 3/4 view's wall; overrides the reference's wall
  --set <set.json>    render every pand of a house-line set (scripts/house-specs/sets/*.json, e.g. the standing
                      easy-houses-20261110 acceptance set) in one session, each into <out>/<pand> (default
                      artifacts/house-preview/sets/<set name>/<pand>), other flags applied to each
  --whole-tile        build the chunk from every building of the pand's z14 tile, exactly as the runtime groups
                      it (~4 s a render); by default the chunk holds the tile's buildings within 30 m of the pand,
                      which drew the same pixels as the whole tile at Nassaukade (0363100012164843)
  --watch             keep tile, neighbours, streets and atlas in memory and re-render whenever the spec/intent
                      file changes (needs --spec or --intent)
  --look <look>       atlas look (default photo)
  --ppm <n>           pixels per metre of the front elevation (default 50, the rectified photos' scale)
  --out <dir>         output directory (default artifacts/house-preview/<pand>)
  --help              this text

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

## §5 The kit-gap queue

Stub (lane H6): `kit-gaps.ts` aggregates `schemaLimits` by `component`; the horizon rule.

## §6 The standing acceptance set: the user's easy houses (lane H9)

The user, 2026-11-10, on `map-recall2-screenshots/whats-new/2026-11-10-facade-extras.jpg` (photo | before | after, 10
rows): "these are good examples of houses that I think should be easy to model but are currently wrong shape and
color". Those houses are the line's first user-named acceptance set. **Re-run it on every look or spec change.**

| Piece | Where |
|---|---|
| The set: 15 pands, reviewed crop choice and box per pand, the reviewer's storeys / bays / gable / wall reads | `scripts/house-specs/sets/easy-houses-20261110.json` |
| The 19 cameras (panorama spot, heading, photo URL), copied from the screenshots repo | `scripts/house-specs/sets/easy-houses-20261110.cams.json` |
| Step 0: what the game draws and why (route, spec, register, decorated wall and roof, roof-planner rule, drawn storeys, camera order) | `npx tsx scripts/house-specs/diagnose-set.ts <set>` |
| The photo readings (measureFacade H2c on the reviewed crop, family, rule tint) | `npx tsx scripts/house-specs/measure-set.ts <set>` |
| Node renders of all 15 | `npm run house:preview -- --set <set> --photo` |
| Ride frames at the panorama poses (photo \| render) | `REG_CAMS=<cams> REG_OUT=<dir> REG_QUERY='&world=live' PW_PORT=<port> /tmp/canal-pw.sh npx playwright test tests/e2e/register-frontal-strip.spec.ts --project=desktop --workers=1` |
| Chase frames, desktop DPR 2 and phone | `DEMO_SPOTS='easy-houses-*' DEMO_DPR=2 … demo-shots.spec.ts --project=desktop`, and `--project=iphone` |
| The specs the set carries | `scripts/house-specs/specs/<pandId>.json` (13; 171851 and 171854 have no usable crop) |

The crops come from `scripts/pand-reference/run.ts --ids=<the 15>` (staging, gitignored); where the default crop is
unusable the set names the other year (`front-alt`) or a wall box below the sky / above a parasol.

Gate (likeness first): the user's sheet re-made with a fourth column (photo | before | after a1 | after H9), colour
family right on every pand with a photo reading, gable right where the register or the crop shows one, storeys ±0,
bays ±1, Kinkerstraat 244-332 not darker than ΔL −0.03 (§1 "The wall colour"). Glazing is printed for information only
(integrator ruling, H2d #342). Until H2d's `houseLine` measureFacade profile lands, the readings are H2c's.
