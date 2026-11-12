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
| §4 Describe at scale (crops → facts → spec) | H4 (§4a), H5 (§4b), H5h (§4c hand set) | landed on the AB07 pilot |
| §5 The kit-gap queue | H6, F4 | the critic histogram ranks it (§9, `kit-gaps.ts`) |
| §6 Worked example: the timed pilot (Nieuwmarkt, Bloemgracht, Nassaukade) | H7 | landed (staged batch `pilot-20261110`) |
| §6b The standing acceptance set (easy houses) | H9 | landed |
| §7 Review in the game (`house:frames`) | H10 | landed |
| §8 Browser-free GLB passes | H12 | landed (gate: raster metrics; verdicts advisory, judgement ruling 2026-11-10) |
| §9 Facade benchmark and blind critic (`house:critic`) | F4 | landed (round 0 = baseline) |

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
  raw feature as `p.houseSpec` = `{gable, year, wallMaterial, wallHex, wallFamily, bays, storeys, crownRiseM, stoop, groundM, look, shop, shopHex, src}` (`crownRiseM`: 3DBAG ridge - eaves, for pands with a gable or a historic gable; `groundM`, `look`, `shop`, `shopHex` are H11's, held, see "Design fields on the generic path").
- `withHouseSpec` runs right after the register step (before `decorateFacade`): it moves `constructionYear` only on an
  era change (the register's rule), sets `registerFinish` from `wallMaterial`, and writes `specRecipe`
  `{bays, storeys, wallHex, period, crownShape}` when the spec has bays, storeys or a wall colour.
- `withHouseSpecCrown` runs after `withMonumentGable` (which would otherwise restore the register's gable). Since H5h
  round 4 (ruling on #351) it applies the crown in trust order and then the **register gable gate**:
  - a photo reading (`PHOTO_GABLE_SOURCES`: `vision-judge`, `streetlevel-measured`, `reviewed`, `author`) sets
    `monumentGable` over the register's; a photo front with no planner gable drops the register's; an `author` flat front over a register gable takes the
    `cornice` crown instead (H9, the Raadhuisstraat arcade 0363100012176346), the register's kept as `historicGable`;
  - otherwise a source above `monument-text` replaces it, a weaker one only fills a gap (as before);
  - then, mode `gated` (the default, `?registerGable=drawn|gated|hint`, `REGISTER_GABLE` in Node): a raised gable that
    did not come from a photo is drawn only when 3DBAG shows a crown above the eaves (`crownInGeometry`: ridge - eaves
    >= 2 m, from `p.eaves`/`p.ridge` or the view's `crownRiseM`, which `build-house-specs.ts` writes from bag-facts
    because the live building tiles carry neither), or, with no ridge, when the roof planner alone would plan a
    `gable` or `pitched` roof. A cornice is always drawn. A held gable is removed and kept as `historicGable` on the
    feature; mode `hint` holds every register gable, `drawn` is the chain before round 4.
  - The same order holds in the merge: `resolve.ts strongerProv(a, b, path)` ranks a photo source over `monument-text`
    on `fronts/N/gable` only; every other field keeps the ladder.
- `facts/historicGable` (spec.ts, validated against GABLES) is the register's gable with its `rce:<nr>` receipt, written
  by `fromRegisterFacts` beside `fronts/0/gable`, for cards and trivia; it is never the drawn crown.
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
  and `specRecipe.storeys`; `specStoreyFit` (exact mode; `specStoreyScale` is its storey) sets the storey pitch so
  `layoutWall` draws that count on the street run's wall (pitch 0.75–1.45 of the style's storey; outside it the style's
  own count stands). H11's nearest mode extends the same fit (held; "Design fields on the generic path"). The register never states
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
2. **`specWallDisplay(hex, {fromPixel})`, the drawn tint** (round 3, the ruling on round 2: "relative darkness is lost and
   the hue drifts to orange").
   - Lightness: `L' = 1 - (1 - L)(1 - k)`, with `k = 0.2` ramped in over OKLab L 0.30-0.50 (`darkLift`) and dark neutral
     paint taking none (`liftShare`). The lift is monotone, `dL'/dL = (1 - k) + (1 - L) k' > 0`, so it never reorders.
     It widens the gap between a dark brown reading (L 0.41) and a red one (L 0.45), where a uniform lift compressed it.
   - Chroma on a warm pixel reading: up to ×2.4, scaled by:
     - the lift share;
     - near-neutral readings: none;
     - dark readings (OKLab L 0.38-0.46, about HSL 0.30-0.36): 35 % of the gain, so dark brown is not raised into
       terracotta;
     - pale readings (L 0.65-0.72 and up): none, so beige stays beige.
   - Cool casts keep 35 % of their chroma.
   - Hue: half of the shift past 40 degrees (the brick edge of the orange band) comes back on mid readings. Dark and pale
     readings keep their hue.
   - A hue cap (0.12 red, 0.06 yellow-brown) applies, then the gamut fit.
   - A family tone gets lightness only.

`SPEC_WALL_HOLD` holds a pand's wall by pand number. It is empty: 182857 renders red-brown.

Gates, round 3 (2026-11-10, `house:preview` lit look, merged main 1fd7e82bd with bays released, measure profile
houseLine).
- **Two runs.** The Node render is deterministic: both runs gave identical numbers. The ±0.02 seen in round 2 was code
  drift between runs, not noise.
- **Two render readings.**
  - The preview's render measure (`render.wall`).
  - The dominant non-glass, non-trim colour of the upper storeys (the wall-mode reading; the render measure still picks
    the white trim on some fronts, e.g. 182848 drawn L 0.34, measured 0.77).

| Gate | Before (period) | Round 3 |
|---|---|---|
| Spearman, photo measure vs render measure (n 31) | 0.32 | 0.29 |
| Spearman, photo measure vs render wall-mode | 0.28 | 0.62 |
| Spearman, spec photo reading vs render wall-mode (n 29) | 0.43 | **0.885** |
| Photo-dark third below render median (wall-mode) | 7/10 | **9/10** (236219: photo measure 0.17, spec reading 0.65) |
| Hue share in 40-60 degrees (wall-mode / render measure) | 0.39 / 0.29 | **0.26** / 0.35 |
| Kinkerstraat 244-332, HSL L (render measure) | 0.376 | 0.359 (−0.017; the original bar is −0.03) |
| Kinkerstraat, OKLab L (wall-mode) | 0.416 | 0.437 (+0.021) |
| Kinkerstraat, OKLab C (render / wall-mode) | 0.065 / 0.074 | 0.045 / 0.048 (round 2's ≥ 0.058 not met) |

The Kinkerstraat pands are the dark browns the ruling names (12158666, 12155496, 12236481 and 12236531 are
kinker-315-35 and kinker-244-332). Kept dark brown, they cannot reach the period palette's chroma, which belongs to a
saturated dark red-brown (#572816). That conflict is the user's call: `darkGain` and `darkLift` are the knobs.

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

### Held walls fall back to brick, and re-measured hand-authored bricks (lane H9g, #345)

* **The re-measure.** Kinkerstraat 33-47 (`kinker-31-49`) was hand-authored at #856c57, #91735c, #c9a080, #c9a080 (41, 43, 45, 47) and
  #d0ab8d (49) in the #98 pass ("sunlit red brick ... through the city tint"). Those were read on the right half of the 2024-12-11
  strip, which is stitched from a brighter exposure: `wall-fit.ts` on that strip returns #772d1b, #9a765d, #b79175, #b59075, #b59376
  for 41-49 and #413b2d, #453022 for 33, 35, a gradient that is the stitch, not the row. The street-level panorama of the row
  (overcast, one uniform dark brown with white frames) fitted per pand with `fitWallColour` gives 37 #453b34, 39 #42352f, 41 #443530,
  43 #41322b, 45 #42352e, 47 #423934, 49 #47403a (corner, mixed with its speklagen). 37 and 39 had no override and drew the type's
  orange-red. The intent note records the source. A strip is only a wall vote when its exposure is uniform over the face:
  compare the strip's left and right halves before trusting a gradient. Other faces named `red-brown-sunlit` carry a family palette
  name, not an authored hex, and their bricks are measured (kinker-56-84, kinker-206-242); kinker-49-63 57 and 59 still draw the
  name (strip votes #745945, #7f624c).
* **The fallback.** A pand the pale-warm guard holds keeps its period colour, and the colour the mesher resolved (buurt profile,
  period-wall enricher, material prior) was a slate grey for Kinkerstraat 154359. `heldBrickWall(fallback, palette, pick)`
  (`wallColour.ts`): a held pand that is not stated light (`heldTakesBrick`: wallMaterial brick, or no material and register finish
  not light) whose fallback is not a brick family (`brick-dark/red/brown`) takes a brick-family entry of `PERIOD_WALLS.photo[archetype]`,
  picked by the id hash. `decorate.ts` marks it `specRecipe.heldBrick`; `threeBuildingFeatures.ts` applies it after the sourced-wall
  step (a `measured-accepted` side colour is left alone). A fallback already brick, a drawn wall and every pand without the flag are
  byte-identical. `npx tsx scripts/house-specs/held-wall-audit.ts` counts it on the game chain: 91 held pands (the published
  extract, installed models and kits excluded), 30 drew a neutral wall (2 with a stated brick finish, 28 with none), 0 after.
* **Held count, 57 vs 91.** One population, two answers: both count the same 419 generic-path pands that carry a spec wall (1,364 views
  with a wall hex, 945 hidden by an installed model, none excluded as measured/kit/large). H9f's "57 of 419" ran the rule with
  `brick: true` for a pand whose material and register finish are both unstated (305 of the 308 held-by-hex pands, 391 of the 419):
  `specWallSource` then swaps a reading lighter than its family's tone for the family tone, which is darker, so fewer drawn colours are
  pale-warm. The game does not assume brick there (`decorate.ts specWallColour`: `brick = view.wallMaterial ? ... : registerFinish === 'brick'`,
  false when unstated), so the pixel reading is lifted as it stands and 91 are held. Re-running the audit with `brick: true` gives exactly 57.
  **The true number is 91 pands** (pands, not walls: one view per pand, no duplicates; the published extract, not staging). Treat 57 as the count
  under a "brick unless stated" assumption the game does not make; whether the game should make it is a ruling for the judgement session
  (it would hold 34 fewer pands and draw their trim-misread family tone instead of the period colour).

### What `bays` means (H1b, #349)

`bays` is the number of **columns of window openings per facade** on the storeys above the ground floor (`frontBays`:
the axis grid when stated, else the per-storey maximum above the ground). It is not a count of windows (a 2-window
texture cell is 2 bays, not 1) and not a count of grid cells. The generic path draws a front as whole texture cells, each
carrying `openings.upper.axes.length` columns (2 for almost every canal/c19 style, 3 for a few canal ones), so the drawn
count is cells x axes. `streetFacadeRendering.ts` `specCellCount` picks the cell count whose drawn count is nearest
`bays`, a tie going to the fewer, held to `MIN_COLUMN_M` (1.8 m) per column and to what the bay-scale clamp lets
`layoutWall` reproduce. An odd count on 2-axis cells drew the even number below it (3 -> 2, 5 -> 4) until H1c's axis units ("Odd bays" below).
A street-appearance recipe's own `bays` keep the old cell fit.

**Released 2026-11-10** (H1c #350): odd counts draw as half-cell axis units (see "Odd bays"); the #348 gate passed 12/19 closer, 0 worse.

The 2026-11-10 doubling (photo 3 drawn 6, photo 2 drawn 4, photo 3 drawn 4 on the #348 sample) was `Math.round(bays /
axes)`: 5/2 = 2.5 rounded up to 3 cells = 6 columns, 3/2 = 1.5 up to 2 cells = 4. Trace of 0363100012169901
(Bloemgracht, front 8.87 m): block-face intent `fronts/0/bays: 5` -> house-specs view `bays: 5` -> `specRecipe.bays: 5`
(decorate) -> `specBays {bays 5, axesPerCell 2}` (mesher) -> `frontageLayoutScale` cells 3 (old) / 2 (now) -> `layoutWall`
cells -> drawn columns 6 (old) / 4 (now); the preview's `measureFacade` read 6 and 4, the photo is 3.
`scripts/house-specs/trace-bays.ts <pand>` prints this chain; `scripts/house-specs/bays-gate.ts` is the #348 sample gate
(hand-grid photo counts in `bays-gate-photo.json`). The source `bays` is itself sometimes high (5 for a 4-column
front; doorBay included), so a nearer count is not always the photo's.

### Where a source's bays go wrong (H1c audit, #350)

`scripts/house-specs/bays-audit.ts` (HELP: `--help`) scores every bays source against photo window columns on the H4
crop archive (source-data eba1f2132 `pand-crops/`): the H1c hand grid of 126 crops
(`scripts/house-specs/bays-audit-photo.json`, plus `bays-gate-photo.json`), or with `--hand-set` H5h's hand set
(`data/house-line/hand-set-v1.json`, §4c). The `measureFacade` `houseLine` meter is not a truth (22 of 38 exact against
the hand grid). Per source against the hand grid, 2026-11-10 (n, exact, over, under, mean signed):

| Source | n | exact | over | under | mean signed |
|---|---|---|---|---|---|
| block face, authored or strip-confirmed | 21 | 21 | 0 | 0 | 0 |
| block face, auto-placed type default | 8 | 6 | 1 | 1 | 0 |
| recipe intent | 8 | 6 | 2 | 0 | +0.38 |
| author / house record | 0 | | | | |
| register text (`registerBays`: "drie vensterassen", "5 traveeën") | 0 on crops, 258 city-wide | | | | |
| Jev (`jevBays`) | 95 | 86 | 7 | 2 | +0.06 |

Jev at p >= 0.8 is 77 of 78 exact. Against the H5h hand set (74 readable pands with axes, 31 shared with the grid, 29
equal) Jev is 24 of 33 exact, mean signed -0.24. The hand set counts the **maximum** over the upper storeys (H5h,
0363100012170031: 4 lights on storey 2, 2 above; the grid read 2), the same rule as `frontBays`, so that convention makes
a source look low, not high: it does not explain the over-counts.

What the over-counts were:
- **0363100012169901** (Bloemgracht, spec 5, photo 3) is the recipe intent
  `scripts/building-recipes/houses/bloemgracht-90/intent.json` (`bays: 5, doorBay: 2`), not a block face as the H1b trace
  said. The data needs a fix (3 bays, door bay 1), the integrator's to make.
- **Auto-placed type defaults.** `autoPlace.ts baysFor` is the type's width rule; when the strip's column match was not 1
  (`columns X` in the citation) the count is the type's guess. `fromBlockFace` now records those `fronts/0/bays` and
  `axisGrid` as source `default` (confidence `TYPE_DEFAULT_BAYS_CONFIDENCE` 0.3), so any measured source outranks them and
  the runtime view leaves them out (`build-house-specs.ts viewOf`): 1,348 view bays became 917.

### Odd bays: half-cell axis units (H1c, #350)

The generic canal/c19 cells paint two windows on axes 0.25 and 0.75 (`facadeOpenings.ts`), so each half of a cell is a
one-window cell with the same sill, head, frame, lintel, speklagen and keystones. A spec'd street run whose stated count
is odd on such a cell is laid out in **axis units** (`streetFacadeRendering.ts axisUnitPlan`): `layoutWall` lays exactly
`bays` units (`doorEvery` doubled, `LayoutScale.doorMinBayM` 1.2 m so a unit can hold the door), and the mesher samples
the texture half a cell per unit (`AXIS_UNIT_U` 0.5), so 3 draws three windows and 1 draws one. The door unit samples the
half of the door cell around the door (`axisUnitOpenings` `doorU`), `DOOR_UNIT_CLEARANCE` off the side window.
No atlas layer is added: `BAY_LAYER_COUNT` and every roof/slot/surface layer ordinal are unchanged.

Limits: the axis pitch must be at least `MIN_AXIS_PITCH_M` 1.45 m for up to 3 bays (the 10th percentile of 80 hand-counted
three-axis fronts, median 1.85 m) and `MIN_COLUMN_M` above, and at most half the style's bay times `SPEC_BAY_SCALE.max`;
a cell whose windows are not centred in its halves, a ribbon, or a door too wide for half a cell keeps the whole-cell fit
(`specCellCount`). Kill switch: `ODD_AXIS_CELLS=0` in Node (world compile, gate, hash). `?oddAxisCells=0` reaches only a main-thread build:
the building worker's `location` is its script URL, so on the live path the page flag does not reach the meshes (seen
2026-11-10: the two ride frames came out identical). Roll back in the browser by holding `SPEC_BAYS_HELD`.

Proof (`scripts/house-specs/odd-cells-hash.ts`, per-building hashes of walls, extras and shell over the 55 house-spec
tiles, 411,709 entries): with bays held the mesh is byte-identical to the base; with bays forced and `ODD_AXIS_CELLS=0`
it equals the base forced run. With units on, 400 buildings differ: 397 spec'd with odd bays, and 3 neighbours
(0363100012172887, 0363100012221819, w750932749) whose flat-roof surface piece the chunk-wide R5-E budget (a share of the
chunk's triangles) now admits. Gate (`bays-gate.ts --dir=staging/house-specs`, #348 sample): closer on 12 of 19 scorable
pands (63 %), further on none.

What the kit still cannot say: a 3-axis front on a cell whose windows sit off the quarter axes (the three-window canal
styles keep their own cells), an asymmetric front (door axis plus two windows unevenly spaced), and a front whose storeys
differ in axis count (170031: 4 on storey 2, 2 above) - a front draws one axis count for every storey.

### Design fields on the generic path (H11, #361)

Haarlemmer #356 found the spec route drew only `gable` and `palette.brick` (and, since H1c, the bays) of a HouseSpec; the
other design fields reached a render only through the recipe route (a per-house GLB). H11 widens the generic consumer
with the fields the bay-look kit can already express. `houseSpec/view.ts specView` builds the runtime view (shared by
`build-house-specs.ts` and `house:preview --spec`), `decorate.ts houseSpecPatch` turns it into properties, and the mesher
reads them. A key no source stated, or only a type default (`default`) stated, stays out of the view: a pand without them
draws as before (`decorate.test.ts` "H11", `bayLookFor` with no spec look = the pick before).

| View key | From (field paths) | Reaches | Kit part |
|---|---|---|---|
| `storeys` (H9), `groundM` | `fronts/0/storeys`, `storeyHeights[0]` | H9: `specRecipe.storeys` -> `streetFacadeRendering.ts specStoreyFit` exact mode on street runs (live). H11: `specRecipe.storeysFit` + `groundM` -> the same function's `nearest` mode on every ground-level run | `storeys - 1` upper storeys over the ground: exact gives up outside `SPEC_STOREY_SCALE` 0.75-1.45; nearest takes the stated ground height (`SPEC_GROUND_SCALE`), shrinks the ground to `SPEC_GROUND_SCALE.min` before the count gives way, then clamps the pitch |
| `look` `{pale, dark, arch, tall}` | `windowSurround` (stone-lintel, full-frame, keystone, eared-keystone = white trim; sill, none = none), `speklagen`, `palette.frame` (luma < 0.35 = dark), `windowHead` (most upper storeys; a stated window kind with no head = flat), `windows: arched`, `windowProportion: tall` | `specRecipe.look` -> `bayLook.ts bayLookFor(..., spec)` -> `bayStyleForTraits` | the bay preset among the plain presets, as a buurt profile's traits pick it; with stated bays only presets whose window count divides them |
| `shop`, `shopHex` | `fronts/0/shopfront` (its `colour`), else `facts.pui`; a photo source's full front with no shopfront = quiet | `specShop` -> `threeBuildingFeatures.ts shopfrontOf`; `specRecipe.shopHex` -> the shop's `groundHex` | a stated shop keeps the shopfront extract's kind (a named café stays a café) or draws `shopWindow`; a stated quiet front drops the extract's OSM shop |

**Held** (integrator ruling, 2026-11-10, corrected the same day): `decorate.ts SPEC_DESIGN_HELD = { storeys: false,
look: true, shop: true }`. Storeys are live: H9 r3 already draws the stated count, so the one storey path ships with
H11's nearest fit and `groundM` released. Look and shop stay held until the integrator reads the H10 `house:frames`
pairs; each releases on its own (a world-v1 recompile carries it). In Node `HOUSE_SPEC_DESIGN=1` releases all three,
`HOUSE_SPEC_DESIGN=look` only that field (storeys then held, the exact H9 fit), `HOUSE_SPEC_DESIGN=0` holds all, which
is exactly H9's and K-stoep's `specRecipe` (world compile, `house:preview`, the gates). The view keys (`groundM`,
`look`, `shop`, `shopHex`) are in the staged extract either way.
`house:preview` writes the pand's drawn grid as `measure.json layout` (`threeBuildingMesh.ts layoutProbe`).

Coverage (`npm run house:specs`, 2026-11-10): 1,354 pands carry storeys, look and shop (the block-face houses); 410 of
them are on the generic path (no installed model). The register gives none of the three.

**Gate** (`scripts/house-specs/design-gate.ts`, 19 belt pairs: Haarlemmer 9 + GG-Zuid 4 staged specs and H7's Nassaukade
row 6; generic route held vs on, against the spec, the recipe route and the photo; measured before the H9 merge, so
"before" there had no storey count):

| Field | Before -> after | Cost (own vertices, 19 pands) |
|---|---|---|
| storeys | drawn storeys = spec 6/19 -> 19/19; preview PASS 5 -> 6 | +180 (+1.1 %) |
| look | window shape = recipe 5/19 -> 5/19 alone, 7/19 with storeys; pale surrounds -> plain white frames where the spec says `sill` (visible on all 9 Haarlemmer fronts) | -36 |
| shop | shop paint on 8 of 8 shop fronts (the extract already had them as shops); 11 quiet fronts unchanged | 0 |
| all three | storeys 19/19, columns 17/19 (unchanged), window shape 7/19, PASS 6 (5), wall dL vs recipe 0.127 (0.125) | +162 (+0.95 %) |

After the H9 merge (`HOUSE_SPEC_DESIGN=0`, H9's exact fit, against the shipped default, storeys released): drawn
storeys = spec 15/19 -> 19/19, columns 17/19 (unchanged), window shape = recipe 6/19 -> 8/19, PASS 6 -> 8, FAIL 9 -> 7,
wall dL vs recipe 0.111 -> 0.107, +210 own vertices (+1.2 %). With look and shop released too (`HOUSE_SPEC_DESIGN=1`):
storeys 19/19, window shape 7/19, PASS 6, +198. City-wide, `HOUSE_SPEC_DESIGN=0` is byte-identical to the pre-merge
base (505a72837, all-hash `5c9c67420c530297`); the shipped default changes 1,335 buildings (the spec'd block-face houses
with a stated storey count) at +4 wall and -2,898 extra vertices (0.0 % and -0.5 % of those buildings), shell vertex
count unchanged; `HOUSE_SPEC_DESIGN=1` at -296 wall and -5,394 extra vertices.

Wall-colour verdicts dominate the preview's FAIL (12 of the 19 reasons are `wall dL`) and are advisory until H2e and H9.
City-wide (`odd-cells-hash.ts` over the 55 house-spec tiles, staged extract, 411,708 entries): held
(`HOUSE_SPEC_DESIGN=0`) is byte-identical to the published extract (0 differ); on, 1,325 buildings differ (the spec'd
block-face houses, installed ones included), at -296 wall and -5,586 extra vertices (-0.1 % and -0.8 % of those
buildings; fewer pale-trim extras), shell unchanged. No per-cell triangle budget grows.

**Not wired** (still recipe-route only), ranked by how visible in a ride frame:
1. `eavesHeight`: the wall top is 3DBAG's (Haarlemmerdijk 18: 7.94 m against an 11.0 m measured cornice). The generic mass
   would have to rise above 3DBAG's height; the storey fit draws the stated count on the shorter wall instead.
2. Crown shape detail (`crownCap`, `crownCapSpan`, `crownShoulder`, neck width): the roof planner draws `monumentGable`
   from its own outline; a neck or bell reads as a square neck box (176066, 171144).
3. `roof.form`/`hip`/`pitchDeg`/`material`: the roof planner's plan is 3DBAG's.
4. `cornice` depth and `crownCap` pieces: no cornice-depth or cap component in the generic cells.
5. `doorBay`, `basement`/`souterrain`, `hoist`, `palette.door`, `windowHeights`, `headLines`, `windowShare`: no per-pand
   control in the bay cells (one door position rule, one opening box per preset).
6. `palette.stone`, `palette.cornice`, `palette.frame` as a colour (only its tone picks the preset), `palette.brick` (held,
   `SPEC_WALLS_HELD`).

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
  --strip <dir>       take this strip first (a directory holding strip.json + strip.jpg, e.g. a leaf-off capture day
                      from scripts/block-face/intake.ts --date, staged under staging/block-face/<face>-w<year>)
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
                      normal bearing is nearest, e.g. 215deg. Sets the front and the 3/4 view's wall; overrides the reference's wall;
                      "face": the frontage of the block face that lists the pand (its facts.json fronts[0], the chord over an erker)
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

Verdict: wall colour family (dL, hue), window column count, storey count and window shape decide; glazing is printed
(information), never a PASS or a FAIL.

Output: <out>/front.png, threeq.png (--threeq), photo.png + compare.png (--photo), measure.json (route, timings, wall,
overrides, measurements, verdict). The sheet header names the route and the look. Render and photo are both blurred
by PRE_BLUR_PX (1.5 px Gaussian sigma at 50 px/m) before measureFacade. Atlas cache:
artifacts/house-preview/atlas-<look>-<size>-<painter hash>.bin (first run paints, later runs load).

Overrides: fronts[0].gable -> monumentGable, palette.wall (or palette.brick) hex -> facadeMappedColour, the bays,
fronts[0].basement stoop (with its stoop fields) -> specStoop, and through the game's own decorator (houseSpec/view.ts
specView -> withHouseSpec) the storeys (lane H9, with lane H11's storeyHeights[0] and nearest-count storey fit) and,
held until released (decorate.ts SPEC_DESIGN_HELD; in Node HOUSE_SPEC_DESIGN=1 releases all, =look only that, =0 holds
storeys too), lane H11's window look (windowSurround, speklagen, windowHead, windows, windowProportion, palette.frame)
and shopfront. Every other
design field is listed under overrides.notApplied in measure.json (the generic path has no property for it yet).
measure.json `layout` is the pand's street-run grid as the mesher laid it: drawn storeys (ground included), upper
storey pitch, window columns.

Not reproduced: the far and roof distance tiers, mipmaps, cast shadows (a wall in another building's shadow draws
sunlit), fog, the analytic window SDF, the ground lift, post-processing, the GLB slot cells (an installed GLB draws
its game colours flat). When those matter, use scripts/building-recipes/render.ts (its sheets draw the slot cells
in Node since lane H12, docs/house-line.md §8; --browser for headless Chromium) or a ride frame.
```

### Belt specs, the recipe route, and what the spec route ignores (lane belt-haarlemmer, #356)

**Route for belt houses.** Belt builders stage specs for the recipe route: `route: 'recipe'` in the spec (`withRoute`; a spec
whose design is a complete canal-house intent), preview with `house:preview <pand> --recipe --photo`, stage, and the
integrator's `house:publish` compiles and installs one GLB per house (batches of about 20 GLBs). The Haarlemmerbuurt lane's nine
houses (`scripts/house-specs/belt/haarlemmer.ts`; `--help`) are nine recipe GLBs. `belt/recipe-dir.ts` writes the scratch
`houses/spec-<pand>/` directories the preview needs (publish step 3 makes them for real; `--clean` removes them).

**The spec route is not a likeness check.** `house:preview --spec` applies two fields only (`fronts[0].gable` ->
`monumentGable`, `palette.brick` -> `facadeMappedColour`); everything else lands in `overrides.notApplied` of `measure.json` and the
generic path draws its own cream curtain-wall front. Judge a belt house on the recipe route. Fields the spec route ignores, ranked by
how visible they are in a ride frame (house where it bit; "all 9" = every Haarlemmerbuurt house):

| # | Field path | Bites on | Visible as |
|---|---|---|---|
| 1 | `fronts[0].storeys`, `storeyHeights`, `eavesHeight` | all 9 (H4 `eavesHeight` 9.8 m vs 3DBAG rear roof 7-8 m) | facade height, storey count |
| 2 | `fronts[0].shopfront` (colour, fascia, entrance, glazing, stallriser) | 8 (all but Hstraat 52) | the ground storey: dark/cream shop paint, door side |
| 3 | `roof.form`, `roof.source`, `roof.hip`, `roof.pitchDeg`, `roof.material` | H6, H16, H18, H131 (form/source/hip) | a hip or saddle over a cornice where the strip shows sky |
| 4 | `fronts[0].bays` | all 9 (H20 `[2,2,3]`) | window columns |
| 5 | `fronts[0].windows`, `windowSurround`, `windowHeights`, `headLines`, `windowShare` | all 9 | window kind, white surrounds, head lines |
| 6 | `palette.frame`, `stone`, `cornice`, `stoneMaterial` | all 9 | white frames, cornice band, painted stone |
| 7 | `fronts[0].cornice`, `crownCap`, `crownCapSpan`, `crownCapRise`, `crownRise`, `atticWindows` | H6, H18, H131 (cap); H4, H20, H54, H52, H133A (attic light) | cornice depth, crown piece, gable neck light |
| 8 | `fronts[0].doorBay`, `basement` | H52 (doorBay 1), all 9 | door position, souterrain |
| 9 | `fronts[0].hoist`, `partyClip`, `street`; `palette.door`; `notes`; `roof.squareSaddle` | all 9 (`squareSaddle` H4, H20, H52, H54, H133A) | hoist beam, party-wall clipping, door colour |

This is the seed of lane H11 (apply the design fields in the spec route, or retire the route for belt work).

**Kit components added (belt-haarlemmer).**
- `FrontIntent.eavesHeight` (metres above the pand's ground; named without the `M` suffix like `crownRise`, the intent contract scan
  rejects `*M` keys): a photo-measured eaves line, applied by `blockFace/houseFrontRoof.ts` `withMeasuredEaves` as
  `facts.measuredEavesM[front.id]` when the facts carry none. Absent = the same facts object. Without it a cornice or gable front
  reads 3DBAG's 10th-percentile roof edge, the rear roof (Haarlemmerdijk 6: 8.9 m against an 11.0 m cornice). Block faces already
  carried this as `continuity.measuredEaves`; a lone house had no way to say it.
- `roof.form` and `roof.source: 'front'` on a canal-house intent compiled alone: `withFrontRoof` runs the block faces' front roof
  (`frontRoofSpecs` -> `recipeRoofFacts`) for the house, so 3DBAG keeps the footprint and an upper bound only. Typed, tested in
  `blockFace/houseFrontRoof.test.ts` (Haarlemmerdijk 6 pinned: roof top <= the 11.0 m cornice + 0.3 m where 3DBAG stands 11.8 m), and
  byte-identical when absent: `test:fit-golden` "all 207 house recipes identical" (no committed house carries either field).
- `buildingRecipe/gates.ts`: with `facts.measuredEavesM` the `eaves-vs-3dbag` gate compares the model to the measured line, and `ridge-vs-3dbag`
  lets the roof reach it (a cornice top over a parapet stands above 3DBAG's roof edge: Haarlemmerdijk 16, 11.6 m against a 10.4 m roof max), and a
  front-derived roof (`roofSource`) may stand under 3DBAG's. Absent = the same gate (`fit-golden` unchanged for all 207 committed houses).

**Frames and the staged world (lane belt-haarlemmer, batch 1, 2026-11-10).** `house:publish` in the lane worktree installed 8 of 9 recipe
GLBs (131, 0363100012173479, is held: `open-edges` 3 edges / 5.2 m, independent of eaves, roof form, crown cap, windows and door) and a full
`--shell` bake took 491 s into `artifacts/world/staging`; the "after" frames ran with `WORLD_DIR` on it, then `public/` was reverted so the
branch carries specs only. The `[suppress]` step failed on its self-check, not on a pand of the batch: it still expects Nassaukade
0363100012116526 to be blank and main now draws it.

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
   house directory that already carries the pand (its earlier sources are kept), else `spec-<pandId>`; a new directory takes the
   block face's `pands/<pand>/facts.json` when a face lists the pand (`blockFaceFactsFor`, `publishPlan.ts`: the frontage chord over an
   erker; BAG's own front of Nassaukade 146 is the 1.61 m erker side), else `facts.ts` fills it; `install.ts --house=<ids>` compiles and installs; then `build-covers`, the covers copy to `models/covers.json` and
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

**The register gable gate (round 4, ruling on #351).** The register is ranked below the photo writers for the crown and
drawn only over a 3DBAG crown (§1 "The generic path reads it"). Scored on the 60 gable rows (the hand set's AB07 rows,
reader A, and the gable rows, B2): the **gated register gable states 52 of 60 and agrees on 36/52 = 0.69 [0.56, 0.80]**,
under the 0.76 gate (and n < 60): by the ruling that makes it a hint, not the fallback writer. By register type: cornice
15/18, neck 7/9, step 3/4, point 4/7, bell 7/14. The gate held 8 rows, every one a register gable the photo contradicts;
its misses are the cornice fronts under a pitched roof (3DBAG's ridge is the roof behind the front, so the test passes).

But "hint only" means the planner's own odds draw those crowns, and they are worse. The drawn crown through the game's
chain and roof planner (`scripts/house-audit/register-gable-gate.ts`) against the same 60 readings (a raised reading must
match exactly; a cornice or flat reading matches any crown that is not a raised gable):

| mode | agrees with the photo reading | raised readings kept | cornice/flat readings | live houses changed (of 4,634 register pands) |
|---|---|---|---|---|
| drawn (before) | 38/60 | 22/29 | 16/31 | - |
| **gated (default)** | **44/60** | 22/29 | 22/31 | 125 |
| hint (register never drawn) | 28/60 | 1/29 | 27/31 | 4,077 |

So the default is `gated`: it keeps every raised gable the photos confirm and fixes six flat fronts, while `hint` loses 21
of the 22 correct raised gables. `?registerGable=hint` stays available; whether the ruling's "hint only" should
apply to the drawn crown is an open question for the judgement session. Gated transitions (live, top): neck -> flat 21,
bell -> flat 18, neck -> mansard 12, point -> flat 11, bell -> hipped 7. Before/after sheet (photo | drawn | gated):
`map-recall2-screenshots/ui/2026-11-10-register-gable-gate/before-after-1.jpg`, `-2.jpg` (`scripts/house-audit/
register-gable-sheet.ts` over `house:preview --route generic` renders with `REGISTER_GABLE=drawn|gated`).

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

### Stoops (lane K-stoep, #360)

A front stoop (bordes, steps and iron railing) is a typed component, `buildingRecipe/stoop.ts`. A front gets one when
its basement is `stoop*` and it carries a `stoop` object. Every field is optional, and an absent `stoop` leaves every
recipe, face chunk and generic wall byte-identical (fit goldens, `world:verify` 0 differing).

| Field | Values (default) | Meaning |
|---|---|---|
| `flight` | `front` \| `side-left` \| `side-right` \| `double` (front) | Where the steps run from the landing. Side flights run along the wall to the viewer's left or right; `double` has one each way. |
| `steps` | 2..16 (sill / 0.18 m) | Risers from the pavement to the door sill. |
| `riseM`, `treadM` | 0.12..0.25, 0.2..0.4 (0.18, 0.28) | The rise is derived when `steps` is given. Both given must meet the sill within 6 cm. |
| `widthM` | (door + 0.4 m front, 1 m side) | The flight's width. |
| `landing` | `{depth, width}` (0.9 x door + 0.6 front, 1.2 x door + 0.4 side) | The bordes in front of the door. |
| `material` | `stone` \| `brick` \| `painted` (stone) | Treads and landing. |
| `rail` | `iron` \| `stone` \| `none` (iron) | Guard on the flights and the landing. Iron is `#1d1f22`, its own material. |
| `railStyle` | `plain` \| `bars` \| `ornate` (bars) | Handrail on posts; bars at 13 cm; or ornate (a second rail, 11 cm bars, heavy newels with finials). Only an iron rail has a style. |
| `under` | `door` \| `window` \| `closed` (closed) | The souterrain opening under the landing. A door needs a sill of 1.4 m or more, a window 0.8 m or more. |
| `zone` | metres | The measured stoep zone (BGT or a hand read). The flight's projection must fit it. |

**Validation.** `stoopProblems` in `intent.ts validateIntent` checks shapes, ranges and the basement/door pairing.
`planStoop` checks geometry against the front. The landing meets the sill as steps x rise. The flights stay on the
front. The projection fits the zone. A souterrain door or window has headroom. Basement lights under the flight are
removed: `stoopBlocks` reports them, and a blocked upper opening throws. The railing is shared with oudWest's
timber-balcony guard (`ironRailing.ts`: `guardRun` is the old loop, byte-identical).

**Recipe and face path.** `fit.ts` plans the stoop in place of the library entrance, per module (mirrored modules
mirror it). `compile.ts addStoops` builds `stoop[-m<k>]/{body,iron,under}` meshes as component `entrance`.
`houseType.ts GROUND_KEYS` includes `stoop`.

**Spec and generic path.** These carry the stoop to the streamed world:

- **Sources.** Register `stoep`, a Jev `stoop` yes (p ≥ 0.875), or a hand/measured `fronts[0].stoop`.
- **Spec build.** `build-house-specs` writes the runtime view `stoop` (`{}` when only the presence is known).
  `decorate.ts` stamps `specStoop`; `SPEC_STOOPS_HELD` turns that off.
- **Mesh.** `threeBuildingMesh` gives the stoop to **one** wall: the longest door wall within 4 m of the nearest
  road's distance (like pickWall). That wall dresses right after the defining walls, with `stoop` forced first, and it
  may spend `EXTRA_BUDGET.stoopWall` (60) past the 180-triangle street-wall cap, still inside the 230-triangle
  building budget.
- **Drawing.** `stoopExtra.ts` draws the plan in stream mode: bars as single quads at a 26 cm pitch at least, and no
  hidden faces.
  - The generic sill is `steps x rise`, else 0.9 m, and at most 0.42 x the ground storey.
  - The reach is the wall-to-centreline distance less 1.5 m (half the BGT residential p10 carriageway).
  - A stated flight that does not fit falls back without its measured landing and width: the stated flight, then
    front, then toward the longer free side, then the other side.
  - A railing over the wall's free triangles steps down ornate -> bars -> plain (an ornate side flight is ~216
    triangles).
  - With no room, the old three-slab dice stoop stands in.

`house:preview` maps `fronts[0].basement stoop*` plus its `stoop` fields to `specStoop` (see "Overrides").

**Scripts.**
- `scripts/kit-stoep/views.ts`: oblique panorama crops from both sides of the street wall, where a flight's direction
  and steps read (a rectified front cannot show them). `--register-stoops --streets=…` lists candidates.
- `scripts/kit-stoep/cell-cost.ts`: triangles per z14 tile with `specStoop` stripped vs kept.
- `scripts/kit-stoep/validation/*.json`: five hand-read Herengracht/Keizersgracht specs (front, side-left,
  side-right, double).

**Measured (2026-11-10).** 21 belt tiles, 398 stoop pands: 19,246,287 -> 19,246,959 triangles (max +0.02 % per
tile). 332 typed stoops drawn, 49 with no room. The stoop displaces trim inside the building budget rather than adding
triangles.

**The kit cannot yet say:**
- curved or winged flights (Herengracht 0363100012167958 is drawn straight);
- a stair inside a portal recess (Nassaukade 150, 0363100012164843);
- cast-iron scroll newels and urns;
- a real souterrain shopfront under the landing (only a dark door or window panel);
- per-pand BGT pavement depth (`zone` is hand-read; the generic path uses a street proxy).

On the generic path the painted door is not raised, so the landing covers its lower part.

## §5 The kit-gap queue

Stub (lane H6): `kit-gaps.ts` aggregates `schemaLimits` by `component`; the horizon rule.

Since lane F4 (#379) the queue is measured: `scripts/house-line/kit-gaps.ts` ranks the blind critic's gap histogram
(§9) by severity sum, names the renderer feature that closes each gap, and says what the benchmark photos show for it.

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
  and the corner 151-152 (0363100012116526, below). Round 2 staged 146 (the face facts, below).

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

### Round 2 (the judgement ruling on #354)

**Wall colour (`src/canalRecall/blockFace/wallFit.ts`, `scripts/block-face/wall-fit.ts`).** The round-1 palettes were per-channel
medians (`measureStripPalette`) of the 2024-11-21 strip: golden hour, a yellow cast (white reads 240,240,192) and foliage, so the
painted-black fronts read olive-khaki, red-brown brick read mauve and 145 pale peach. `fitWallColour` replaces the median for a wall
colour: leaf and light-trim masks on the white-balanced pixel, a deterministic 2-means in Lab, the darker (dominant) cluster unless
the paler one covers at least 60 % of the wall mask, a brick/joint split on chroma for bare brick, the median Lab of what is left;
a painted wall at L* 40 or below is a neutral near-black (a = b = 0, never lifted), and any lift scales chroma with L
(`liftWithChroma`). `combineWallFits` votes over captures; `npm run test:block-face` pins the three cases (`wallFit.test.ts`).
`wall-fit.ts --face=<id> --crops <archive>/pand-crops --years 2018,2021,2022 --strips <dir>` prints one vote per leaf-off capture
and the combined hex (it writes nothing); its result went into `nassau-145-152/intent.json` (`paletteOverrides.brick`, source
`wall-fit-2019-2022`). Light varies by capture (145 reads L* 64, 81, 32 and 37), so take votes from several leaf-off years.

| Nassaukade | photo wall-fit (4 leaf-off votes) | render round 1 | dE | render round 2 | dE |
|---|---|---|---|---|---|
| 151-152 corner | #564543 | #8a6b61 | 18.6 | #705a57 | 9.6 |
| 150 | #404040 | #524b3d | 10.7 | #404040 | 0.0 |
| 149 | #4d4d4d | #6a685d | 13.0 | #4d4d4d | 0.0 |
| 148 | #665648 | #96816f | 17.8 | #806c5a | 9.6 |
| 147 | #535353 | #615a47 | 12.4 | #535353 | 0.0 |
| 146 | #957d73 (strip only) | #ba9378 | 14.9 | #a48f87 | 7.0 |
| 145 | #886957 | #ba9378 | 17.6 | #9e7c68 | 7.8 |

Render = the flat wall pixel of the front (`artifacts/house-line/tools/colour-table.ts`). The brick remainder is the look's wall-tint
lightness lift (hue within 1 degree, chroma kept).

**Leaf-off evidence.** `scripts/block-face/intake.ts --date 2019-01-09` builds a winter strip
(`staging/block-face/nassau-145-152-w2019/`); `house:preview --strip <dir>` takes it as the photo. None of the Nassaukade verdicts is
NO EVIDENCE for foliage any more: 150, 148 PASS; 147 PASS on the chunk route; 149 FAILs dL -0.12 because the preview's wall metric
takes in the white bands (the four wall-fit votes agree at L* 30-34); 145 and 146 are NO EVIDENCE for a washed-out sky band.

**146.** `house:preview --wall face` frames the block face's frontage chord. The recipe compile failed on BAG's erker front
("Opening escapes its wall"); with the face facts (above) it compiles and 146 is staged.

**Corner 151-152: new kit components.** The photo's Nassaukade front has two tall stone dormer towers rising through the eaves and
three wall rosettes, which no field said. `FrontIntent.towers[]` (`{bays, rise, cap, finish: 'stone', lightRise, lightSill}`, in the
facade plane, one per entry; the old `tower` is one per front) and `FrontIntent.rosettes[]` (`{bays, storeys, diameter}`: a stone
ring, wall field and boss in place of the window, `src/canalRecall/buildingRecipe/rosettes.ts`) are typed, validated and
byte-identical when absent (`test:fit-golden`: all 207 recipes identical). The pediment dormers were dropped: the attic is extruded
along front0's street, so the Nassaukade end of it is a vertical face and dormers set behind the facade are buried in it. The front
takes `palette.brick` from the Nassaukade wall-fit; storeys 4 (STOREYS_DEFINITION). Preview on the chunk route: PASS (wall #675350
vs #594b48, dL 0.043, 7 vs 8 columns). Still unsaid: the attic face shows wall-coloured wedges beside each tower (the single
`tower` does the same), and the corner's roof end.


### Round 3 (the GLB audit on install, #354)

Installing the round-2 chunks failed the GLB audit (`scripts/audit-glb-quality.ts`): nassau-145-152 opening-outside 18 parts
1.09 m2 and coplanar 1.6 m2; clercq-236681 opening-outside 18 parts 5.92 m2, zfight-tight 6.9 m2, geometry-regression 7.2 m2.
Compiling main's pre-H7 intents gives the same opening-outside and coplanar numbers, so only the tight pairs were H7's (tower and
rosette stone 2-3 cm on the brick, and a front-level `palette.brick` that drew a second wall 5 cm over the shell). The fixes, all
at the source:

* **Towers and rosettes at the relief step.** The tower facing is stone pieces 9 cm proud (two 4.5 cm kit steps,
  `TOWER_FACING_DEPTH_M`): piers either side and panels below, between and above the lights, never over a light or the raised
  profile's 8 cm edge trim (`fit.ts`). A rosette is a ring of two half annuli and a boss, both 9 cm proud; the field disc is gone
  (`rosettes.ts`).
* **One palette per house.** A palette on a front of a multi-front house draws a second shell; the corner's Nassaukade colour
  went to `design.palette.brick` (`clercq-236681/intent.json` notes).
* **A `paint` slot.** Painted timber (the Oud-West timber balconies' platform and guard) took the `trim`/`door` surfaces, which are
  opening slots that the audit holds to a wall; it now exports as `paint` (`soup.ts`, `building-recipes/compile.ts`), which the
  look already draws like frame. This is the #81 precedent.
* **Projecting balcony returns** (`canalhouseRecipes.ts`). On a platform the side returns run along the centre of its stone
  piers, in stone. A 0.6 m door-slot bar falls under the 2 m handrail exemption and was judged as a loose sill.
* **Mansard party ends** (`historicPasses.ts addMansards`) are a mesh of their own in the shell material, not slate in the plane
  of the neighbour's brick (Nassaukade 147: 1.4 m2 coplanar).
* **Dormers with a stone or timber front** (`dormerBody`) stand `DORMER_HOST_FRONT_SETBACK_M` (0.14 m) behind the frontage on a
  mansard. At 5 cm their stone heads were in the cornice's plane. The installed (quantized) GLB then judged two panes against the
  cornice (2 parts, 0.51 m2) even though the plain staging GLB passed. The clercq types take `dormerBody: "timber"`: with
  `stone` the front glass had no host wall.
* **The corner roof hips** (`recipeRoof.ts` `sideFronts`, filled by `blockFace/compile.ts`). A corner pand's attic also falls to
  its fronts on other streets and to a chamfer of 0.3-6 m between them. Each roof piece is cut where its plane meets the side's
  steep face, so every part stays planar. This removes the wall wedges beside the towers, the vertical slate end on the
  Nassaukade, and the 2 m brick gable over the chamfer.
* **One owner per pand.** nassau-145-152 and clercq-236681 both suppressed the corner 116526, and `--install` replaces any chunk
  that shares a suppressed pand, so each install dropped the other face. The corner stays with clercq-236681, which models both its
  fronts. nassau-145-152 is trimmed to 6 pands: its span, uses, discovery member and pand facts are removed, and the strip image
  keeps its full width. `batch.ts trimShared` does the same thing for batch runs.

How to measure, per face:

```
npm run block-face:compile -- --face=<id>                           # gates + audit on the plain staging GLB
zsh scripts/house-specs/pilot-20261110/audit/zpatches.sh <id>                     # every tight / coplanar patch
node --import tsx scripts/house-specs/pilot-20261110/audit/outside.ts staging/block-face/<id>/chunk.glb
node --import tsx scripts/house-specs/pilot-20261110/audit/installed-audit.ts <id> <dir>   # the audit on the bytes --install writes
node --import tsx scripts/house-specs/pilot-20261110/audit/far-tier.ts staging/block-face/<id>/chunk.glb <out.lod2.glb>   # far tier
node --import tsx scripts/house-specs/pilot-20261110/audit/far-raw.ts <out.lod2.glb>       # material-blind, the lod2 has no names
```

After: both faces install with `--install` (nassau first, "replaced nothing"; then clercq, which replaces only itself). The
installed GLBs fail only `holes`, the party-wall loops that main's installed chunks also show. Near tier: coplanar 0.08 / 0 m2
(slivers under the patch minimum), tight 0 / 0.07 m2, opening-outside 0 / 0. Far tier (lod2): gated coplanar and tight 0 on both.
The lod2 has no material names, and the material-blind tight area on the corner's Nassaukade end is 1.43 m2 (25 m2 before).
`test:block-face` roof golden CHANGED lists these two faces only.

Still unsaid: the corner's 2.3 m chamfer is a blank brick face with no cornice. The photo shows a narrow bevel with windows,
and no front covers a chamfer.

### Round 4 (in-game follow-ups, #354, 2026-11-10)

The judgement session read the round-3 frame pairs. Three follow-ups, all on the Nassaukade corner row:

- **116526's Nassaukade ground floor** drew one dark glass box (`shopfront.bays [0,2]`, `glazing transom`, nothing else). The photo
  (pano 2021-03-24 8.2 m, "The Kiwi") shows a café front: a dark awning over the corner glazing, a pale painted fascia band over the
  glass, three tall glazed bays and the glazed door at the right end of the span. `clercq-236681/intent.json` now sets
  `fascia: true` + `fasciaColour #d9d1c5`, `displayWindows: 3`, `entrance: right`, `stallriser low` and a `fabric-dutch` awning
  (`#1f1f22`, extent 0-0.3). Nothing in the kit was missing for this; what it still cannot say is the round "THE KIWI" board
  hanging on the corner pier, the beer sign, and the multi-light transom row (white-framed small panes over the black-framed glass).
  Compile: `passWithPartyExemption` stays true; roof golden changes on clercq-236681 alone. After frame (not installed):
  `npm run house:preview -- 0363100012116526 --wall 75deg --chunk clercq-236681` beside the same call without `--chunk`.
- **The chamfered corner** (the photo's left edge: a canted corner with balconies on every storey) is a kit gap, not drawn:
  `docs/handoffs/kit-gaps.md` "Corner chamfer", with a count of the corner pands it affects.
- **`house:frames` `chord`**: 160704's Nassaukade front is stepped in edges under 3 m (stoop and bay line), so `exposedWalls`
  drops it and the pose took the rear (a 2023 Da Costakade close-up at 34.9 m). A `--list` entry may now give the wall's two end
  points, `"chord": [[lng, lat], [lng, lat]]` with a `bearing` for the outward side; 160704 then poses from the 2021-03-24 Nassaukade
  panorama at 8.2 m.

## §6b The standing acceptance set: the user's easy houses (lane H9)

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

## §7 Review in the game (`house:frames`)

Every earlier check looks at a house outside the game: `house:preview` draws a flat elevation, `install-large` a GLB in
SwiftShader. The failures the user keeps catching are in-game only (116526 drawn as a blank wall by another model's cover
while its elevation was fine; roofs off their walls; GLB fronts 0.1 L darker under the lit look; neighbours, trees, the
camera itself). `npm run house:frames` (lane H10, #358) puts the game's first-person camera where a street panorama was
taken, looking where the panorama looks, and sets the frame beside the panorama cut to the same pose.

**Builders are accepted on these pairs, read by opus or a human; the elevation verdict (`house:preview`, likeness gates)
is a pre-filter. Sonnet does not accept its own pairs.** The integrator runs the frames for a batch at publish time
(before = the published world, or `--query '?world=live&houseSpecs=0'`; after = `?world=live`, or the staged world via
`WORLD_DIR`/`BUNDLES_DIR`). `?houseSpecs=0` alone changes nothing: the baked world-v1 cells already carry the specs
(measured: of the 20 house poses run with and without it, 18 drew byte-identical frames and two moved under 1.5 % of
pixels by more than 20 levels). That also says two runs of one pose agree, so a before/after difference is the change.

```sh
npm run house:frames -- --pands 0363100012116526 --label before
npm run house:frames -- --face nassau-145-152 --query '?world=live&houseSpecs=0' --label before   # spec off, live tiles
npm run house:frames -- --face nassau-145-152 --season winter --label after
npm run house:frames -- --list scripts/house-frames/validation.json --out artifacts/house-frames/validation
npm run house:frames -- --buurt AB07 --max 60 --prep-only        # pick, pose and cut only (no browser)
npm run house:frames -- --list my.json --out <dir> --post-only    # redo checks, pairs and sheets
npm run house:frames -- --lists a.json:<outA>,b.json:<outB>       # several lists, one browser session (below)
npm run house:frames -- --list my.json --out <dir> --reuse-photos --query '?world=live'  # after-run: game frames only
```

Run it unwrapped with your `PW_PORT`: the tool takes its own `/tmp/canal-pw.sh` slot for the browser part only
(docs/browser-queue.md).

**Batched runs (`--lists`, lane Q1 #378).** One browser session (one queue slot, one Playwright start, one dev-server
boot) for several lanes' lists: each list is picked, posed and cut into its own out dir, every pose goes into one job
(`<first out>/batch-job.json`, list after list), the page re-opens at each list (carried-over page state moved water
shadows and a POI label on 3-8 % of the pixels when it did not), and each out dir gets the same `photo.jpg`,
`game.png`, `pose.json`, `pair.jpg`, sheets and `summary.json` a separate `--list` run writes. Measured on two
lists (Nieuwmarkt 4 pands + Bloemgracht 3) against two separate runs: see the Q1 hand-back on #378. **F4's critic
uses `--lists` from day one**, and so should the integrator's before/after frames for a round of builder lanes: one
batch per label, not one run per lane.

**`--reuse-photos`.** Every run caches its pick, pose and photo cut (`HOUSE_FRAMES_CACHE`, default the main checkout's
`.cache/house-frames`: `prep/<entry hash>.json`, `photos/<pose hash>.jpg`). The keys include the entry, `--bearing`,
`--year`, `--season`, `--pano-size` and a hash of `frames.ts`, `pose.ts`, `photo.ts` and `pand-reference/select.ts`.
With the flag, a cached entry skips the panorama listing, the glare/foliage pre-pass and the cut; only the game frame
is rendered (the route line is recomputed, it depends on `--query`). Use it for the after-run of a before/after pair
and for critic re-runs. A run without the flag recomputes everything and refreshes the cache.

**`--before <dir>`: a before/after must prove it changed the wall (lane wall-colour-truth, 2026-11-12).** The
2026-11-10 "House walls take their photo colour" pairs showed before == after on every pand: both runs used
`?world=live`, but the committed bundles of that evening were built from `SPEC_WALLS_HELD = true` (ae430fc27, 21:23;
the flip to false at 21:37 reached the bundles only at 23:03), so `?specWalls=0` and the default drew the same period
colour; and the pand on the note (Egelantiersgracht 172620) is held by the pale-warm guard, so it cannot change with the
spec flag at all. With `--before <dir>` (an earlier run of the same list) each pose's `pose.json` gets `compare`: the
share of target-wall pixels changed (OKLab distance > 0.02 on a 48 x 32 grid over the projected wall), the mean
distance, the wall's OKLab L/C/hue in the photo, before and after (`analyse.ts wallLab`: the colour band, 30-70 %
lightness quantiles), and what the page decorated the pand with in each run (`game.json drawn`: the page query,
`specRecipe.wallHex`, `heldBrick`, the spec reading). `<key>/triple.jpg` sets photo | before | after side by side at
gallery size. Under 2 % changed (`WALL_SAME_PCT`; render noise on an unchanged wall measured 0 %) the pair is flagged
`sameAsBefore` and printed as a WARNING: the flag compared did not reach the pixels. Check, in order: the bundles (built
from the source you think you are testing?), the world (baked world-v1 cells ignore runtime decorate flags such as
`?houseSpecs=0` and `?specWalls=0`; use `?world=live`), the mesh worker's flags (`meshBuildingFor` runs in the pool
worker, whose `location.search` is its own script URL: a flag it reads must be in `engine/workerPool.ts
withWorkerFlags`; `brickLift` was not, so `?brickLift=v1` changed nothing on the generic houses), and the pand's guard
(`game.json drawn.heldBrick`). `scripts/house-frames/trace-wall.ts <ids>` prints the Node side of the same path
(spec reading, decorated wall, mesher wall) under `SPEC_WALLS` / `BRICK_LIFT`.

Output per pand (or per `key` of a `--list` entry): `<out>/<key>/{photo.jpg, game.png, pair.jpg, pose.json}`; per six pairs
`<out>/contact-N.jpg` (left: the panorama cut, right: the game, cyan: the BAG wall outline, a three-line caption); and
`<out>/summary.json` (alignment distribution, flags, throughput). `--help` prints the command's `HELP`
(`scripts/house-frames/frames.ts`).

### How a pair is made

| Step | Where | What |
|---|---|---|
| wall | `pand-reference/select.ts pickWall` | the street wall (`--bearing`, or a `--list` entry's `bearing`/`at` for one wall of a large pand; a front drawn as a bay or in short jogs is taken as the chord of the ring edges facing the bearing, e.g. Nassaukade 146 = 160704 with `bearing` 96) |
| panorama | `rankPanos` (5-35 m, obliquity <= 55) | `--year` filter; `--season winter` puts Nov-Mar first; a 2000 px pre-pass over the first three (up to eight while fewer than two pass) rejects sun glare (> 12 % of the frame 0-20 deg below the horizon blown out, min RGB > 225: `GLARE_MAX`; the band stops above the recording car's bonnet, white on some captures) and a washed-out wall (> 30 % bright and colourless, `washedOutFraction`'s rule, where another candidate reads 25 % less: a white front is not rejected), even in winter; then least foliage on the wall, then rank. The caption's `why` lists what was rejected |
| pose | `scripts/house-frames/pose.ts aimPose` | at the panorama, eye 2.44 m over the ground (`lensFor`'s datum), heading at the wall centre, 5-30 deg down, the narrowest vertical FOV in 45-120 deg that fits the wall and 1.5 m above it |
| photo | `photo.ts cutPerspective` | a pinhole cut of the equirectangular panorama (4000 px; `--pano-size`) with the game's camera frame, rays turned onto the RD grid (`gridConvergenceDeg`, about -0.4 deg) |
| game | `tests/e2e/house-frames.spec.ts` | one page for the list (`?engine=own&cam=fps` + `--query`), re-opened every 40 poses or after a crash; per pose: teleport, the pose handed to the engine, `settleWorld`, HUD hidden, screenshot, `inspectBuilding` picks over the wall |

The game camera cannot look up (`MAX_PITCH_DEG` 85: at least 5 deg below the horizon), so a tall front close to the
panorama is fitted by widening the lens, not by pitching; a front still too tall at 120 deg says `clipped top` on the
caption. Both halves share the pose, so the distortion of a wide lens is the same on both. The camera is set from
outside: the spec replaces the live view's `solveFps` with one that returns the job's pose (the first-person solve's
clearance and yaw smoothing are skipped); nothing in `src/` changes and the game gains no global. The tool drives the own
engine (`?engine=own`), the engine the house line builds for; pass `--query '?engine=maplibre'` only to see the legacy view
(no first-person camera there: the spec stops with a message).

### Alignment check (what makes a pair trustworthy)

The pand's BAG wall (footprint edge x tile height) is projected into both halves with the one pose (`pose.ts frameFor`,
the engine's own `fpsPose` + `cameraFrame`) and drawn as a thin cyan line. `analyse.ts edgeOffsets` searches +-6 % of the
width around each projected wall end (from 35 % of the height to the top) and the crown line for the strongest edge whose
gradient keeps one sign along its length; `found` when it stands 1.8x over the window's median. `pose.json` records the
offsets in % of the image width for the photo (is the panorama where we think?) and the game (is the camera where we put
it?). Gate: median photo offset <= 2 % over the validation set, any pose > 3 % investigated.

### Flags (advisory, on the caption)

| Flag | Rule |
|---|---|
| missing | >= 50 % of 35 wall picks hit sky or ground |
| other building | >= 50 % of the wall picks hit another building or model (a cover that does not draw this wall; a neighbour in front) |
| roof offset | the game's skyline over the wall (median of 7 columns, read on the wall plane) sits more than 1 m from the projected crown line (tile height) while the photo's sits within 1 m of it; or a model's surface stands >= 1.2 m over the crown line on 2 of 7 columns |
| wall colour | relative, the H9 rule: in each half, rel = the pand's wall L / the mean of its neighbours' (strips 3-5 m past each wall end on the wall's line; L = trimmed 30-70 % mean of HSL lightness from 3 m to min(12 m, 85 % of the height), leaves and, on the neighbours, sky dropped). A strip counts when it reads in both halves with < 25 % sky; with one strip the caption says `left only` / `right only`, with none `wall colour: no ref`. Fires on an inversion across 1.0 (each side > 10 % from it, `INVERSION_BAND`: lighter than the neighbours in one half, darker in the other) or when \|ln(rel game / rel photo)\| > 0.35 (`COLOUR_REL_MAX`); never on a missing / other-building pair. Exposure and white balance cancel; the absolute \|dL\| > 0.12 rule it replaced fired on 24 of 35 |

Opening counts (photo and game, `measureFacade` houseLine profile on the wall rectified out of each half at 25 px/m) are printed as advisory only, with a `possible blank wall` note where the game reads <= 1 and the photo >= 3; no flag fires from them. Measured against the H5h hand counts (`data/house-line/hand-set-v1.json`, 69 readable single fronts, photo halves): columns read on 33, equal to the hand axes on 14 and within one on 25; openings / (axes x storeys) median 1.44 (p10 0.67, p90 2.5), within 30 % on 20 of 61. Not good enough to flag on |

Generic houses pick as footprint prisms (`threeBuildingsBrowser.ts inspectAtScreen`), so picks say who owns the wall,
not what its roof looks like; installed models (chunks, ordinary, landmarks) are ray-cast on their meshes.

### Reviewer checklist (each pair)

One line per item; the countable ones carry the H5h blind reader ceiling (§4c), the agreement a careful reader reaches.

1. Crown and gable type: does the game's crown (step, neck, bell, spout, point, cornice, flat) match the photo? (ceiling 0.86)
2. Storeys: same count above the ground storey? (ceiling 1.00)
3. Window axes: same number of bays, roughly where the photo has them? (ceiling 1.00)
4. Colour family and darkness: wall family (ceiling 0.81) and tone (ceiling 0.89), judged against the neighbours in the same frame, not in absolute terms.
5. Blank or missing wall: is there a front where the photo has one, with openings? (the missing flag; the `possible blank wall` note is advisory)
6. Roof offset: does the roof sit on the walls, at the photo's height? (the roof flag)
7. Shopfront (pui): shop vs residential ground storey (ceiling 0.88).
8. Kit gaps: anything the photo shows that the kit cannot say (oriel, balcony type, ornament, painted bands) goes to the kit-gap queue (§5) as a `schemaLimits` entry, not into the nearest option.

Read the outline first: a pair whose cyan line misses the photo's facade (edge offsets > 3 %) is not evidence; note it and
re-run with another panorama (`--year`) or `--bearing`.

### Validation (2026-11-10)

Run: `npm run house:frames -- --list scripts/house-frames/validation.json --query '?houseSpecs=0' --label before` (35 walls),
then the 20 house cases again on the default world (`--label after`). Sheets: `map-recall2-screenshots`
`ui/2026-11-10-house-frames/`. Main 1fd7e82bd, the user's Mac with other lanes' gates running (load 10-40).

| Case | Expect | Read from the pairs |
|---|---|---|
| 116526 Nassaukade corner, `?houseSpecs=0` | blank wall shows, flag fires | shows (chunk-face-clercq-236681 draws a bare brick slab where the photo has 36 openings); `blankWall` fires (game 1 opening, the slab's edge) |
| Nieuwmarkt 4-22 (182850-182858) | register gables visible, crowns match | gables visible on all nine (step, neck, bell); crowns match on 6 of 9; Nieuwmarkt 20-22 (182857) is a double step-gable front drawn as one step gable (a kit gap: two crowns on one pand) |
| Nassaukade 145-152 (H7's row) | before frames; after once H7 publishes | before: 7 pairs; `roofOffset` fires on 4 (the game's skyline 2-3 m under the crown line the photo confirms); 160704's wall is the rear (the pick saw only 157610: `otherBuilding`). After: H7 not published at this run |
| 169916 (H1c, three windows) | 3 columns in game and photo | 3 columns in both (a tree stands in front in the photo) |
| live before/after: 169916 + Nieuwmarkt, `?world=live&houseSpecs=0` vs `?world=live` | the spec's change shows, nothing else moves | 169916: the game goes from 2 to 3 window columns (openings 9 to 16; 3.4 % of pixels move by more than 20 levels); the nine Nieuwmarkt frames are identical to the byte (no spec there). The wall-colour flag stays on 169916 (dL 0.59): the game draws it cream, the photo is dark brown brick, a real catch for the spec's wallHex |
| Houthavenkade 26 (large recipe, 12 of 510 surfaces) | the missing surfaces show | shows: the photo's dark grey front panel is absent in the game; the outline frames the model's brick walls set back behind it and open pavement under them. No flag fires (the picks hit the same model further back): a reader's catch, and a case for a depth check (OPEN) |
| two roof-offset shots (2026-11-08) | the offset flag fires | does not fire, rightly: #257 was fixed on main (5ce1b11f2, shell roofs trimmed at the walls) and the defect lived in the far/shell tier, which a 12-22 m street pose does not draw. Stadhouderskade 233471 and Prins Hendrikkade 178053 draw on their walls |
| 15 walls of the #341 blank-wall audit | false-positive rate | 11 readable: 4 real (the four Funenpark 184743 walls: the ordinary model's front floats above the ground, the lower storeys are sky), 7 drawn in the game (186003, 063603, 151240, 088589, 244160-e13, 237838-e8, and 237838-e2 where the Eye's wall is blank in reality too): **false-positive rate 7/11 = 64 %**. Unreadable 4: 129127 (a neighbour in front), 104378 (the panorama, 2018, predates the building), 244160-e0 and 239853 (the wall stands off the frame or behind a plaza) |

Alignment (photo, wall ends found by the edge search): 37 edges, **median 1.18 %**, p90 4.0 %; game half median 1.18 %.
Six edges over 3 %, read pair by pair: in every Nieuwmarkt and Geldersekade case the outline sits on the facade and the
search took a stronger nearby edge (a white pilaster, a shopfront edge, the neighbour's quoin), so the offset is the
detector, not the pose. One over 5 %: 104378 (5.4 %), whose 2018 panorama predates the building; the edge found is the
neighbour's. Throughput: 35 poses in 165 s in one page (one open), **12.7 pairs/min** including the 11 s open; settle
median 3.0 s; under a shared slot with a check:canal gate queued.

Gate: `check:canal` green on this branch (162 checks, EXIT 0, 2026-11-10 20:01, `CANAL_PW_EXCLUSIVE=1`).

Flags on the 35 (before, first rules): blankWall 1 (116526), missing 2, otherBuilding 3, roofOffset 4, wallColour 24.

### Round 3 (2026-11-10): inversions, one-strip references, clipped skylines

- The judgement session caught 116526 (H7 r4 frames) silent at photo rel 1.27 vs game 0.85: lighter than its neighbour in
  the photo, darker in the game. Round 2 demanded both neighbour strips and only one read. Now one strip is used when only
  one reads (`ref right only` on the caption), no strip prints `no ref`, and an inversion across 1.0 fires whatever the log
  score. It fires on 116526 (pinned in `pose.test.ts` with the measured values).
- The inversion takes a 10 % band either side of 1.0: the literal rule fired on 4 of H7's 15 (read as right) at noise such
  as 236262, 1.024 vs 0.998, and 156960, 0.96 vs 1.07. With the band, **H7 false positives: 0 of 15** on the clercq set,
  H7's Nassaukade run and the round-2 rerun; 116526 is the one flag, a true one.
- Skyline columns whose frame top sits under the crown line (+0.5 m) read `clipped`, not a height, so a clipped-top pose
  cannot raise a roof offset (160704 from Nassaukade had photo 12.72 m from white bay-window tops against the frame edge;
  it now reads `skyline ... clipped`). H7's clercq set keeps its two roof offsets (157618, 156454: the game's skyline 1.1-1.3
  m under the crown the photo confirms), which H7's own summary already had.
- `--post-only --out <dir>` re-runs every check and flag on an existing frame dir (prepared.json, job.json and the
  frames), writing pose.json, pair.jpg, the sheets and summary.json there.
- Not caught: the lens-flare arc on 160704's 2021-03-24 panorama. A thin arc blows out under 1 % of the band, far under the
  12 % glare rule; it needs a streak detector (OPEN).

### Round 2 (2026-11-10): relative wall colour, glare, advisory openings, Nassaukade 146

- **Wall colour**, relative (rule above). Calibrated on H7's set, which the judgement session read as right: Nassaukade
  145-152 (rerun, 6 pairs) and Clercqstraat 236681 (9 pairs). 11 of the 15 read with both neighbour strips; their largest
  |score| is 0.27 (164843), so the 0.35 threshold leaves them quiet: **H7 false positives 0 of 15**. (116526 reads 0.39 on one strip
  only, the neighbour's dark-with-white-trim front rather than the pand: why one strip is not enough. H7's first Nassaukade
  run picked 160704's Da Costakade rear wall, -0.36, which the other-building guard keeps quiet.) On the 35 validation walls it
  reads 10 with both strips and fires on 5: 169916 (cream for dark brown brick) and Nieuwmarkt 182850, 182853, 182854,
  182855, generic fronts whose colour is visibly wrong on the sheet (a white front for dark brick, pink brick for dark
  grey). The trim is the 30-70 % quantiles: 40-90 % let a dark front's white trim lift it (164843 on the rerun, 0.38).
- **Pose pick.** 164843's 2019-01-09 pick had flare over the left third: 16 % of the frame 0-20 deg below the horizon
  blown out in the pre-pass (on the full cuts: 16 %; the next highest of 60 photos reads 10 %, Nieuwmarkt 182857's white
  ground storey, a thin margin). The rerun rejects it (`rejected 2019-01-09 glare 16%`) and takes another 2019-01-09
  panorama with 0 %. Without the 20 deg band the recording car's white bonnet read as glare (244160-e13's 2016 capture,
  18 %). On an any-season pick the washed-out rule now also drops 244160-e13's 2016-07-29 capture (62 %, the tower's
  glazing under construction) for 2021-04-30.
- **Nassaukade 146 (160704)** from the Nassaukade side: `--list` entry `{"bearing": 96, "at": [4.87384, 52.37225]}`. Its
  front is drawn as a bay (edges of 2.7, 1.1 and 1.7 m), which `exposedWalls` drops, so `wallAt` now takes the chord of the
  facing edges (6.3 m). The 2021-03-24 panorama 8.2 m off; picks on chunk-face-nassau-145-152, no flags, colour score -0.10.

## §8 Browser-free GLB passes (lane H12, #362)

**First passes are Node; browsers are for in-game frames (`house:frames`), rides and timing.** A first look at a GLB
(a recipe house, a block-face chunk, a large recipe, a landmark) no longer waits for a `/tmp/canal-pw.sh` slot.

### What draws in Node

`src/canalRecall/glbRaster/` is a pure GLB rasteriser (no DOM, no GL, no globals; byte-deterministic):

- `load.ts`: `@gltf-transform/core` + the meshopt decoder (EXT_meshopt_compression, KHR_mesh_quantization), the node
  hierarchy flattened, normals by the inverse transpose, TEXCOORD_0 (KHR_texture_transform applied), COLOR_0, base
  colour factor and texture (decoded by sharp), emissive, alpha mode/cutoff, doubleSided, KHR_materials_unlit and the
  material extras (three.js userData: `materialSlot`, `tint`, ...).
- `look.ts`: the browser pages' looks as data. `recipe` is render-page.ts's default: slot-tagged materials become the
  recipe look's unlit cell shader, built by the game's own `createRecipeLook` (`cityLook: false`) on the real three.js
  namespace with a `@napi-rs/canvas` document passed in, so cells, tints and uv scale are the game's. `flat` is
  `--flat`; `game` is landmark-views' Lambert (normaliseLandmarkMaterials, the glass sky tint); `gallery` the
  GLTFLoader standard materials. The rigs (render-page's hemisphere + sun + ground, landmark-views' game and gallery
  lights) are constants beside them.
- `raster.ts`: houseSpec/softRaster.ts's loop (edge functions, perspective-correct attributes, z-buffer) generalised to
  per-primitive materials and three.js cameras (render.ts `RenderView`: eye, target, vertical fov, optional ortho
  extents). It samples the standard 4x MSAA pattern and shades once per pixel at its centre, as the browser's
  `antialias: true` does (the regular 2x2 grid of softRaster drew mullion edges differently and moved measureFacade's
  glazing by up to 0.5 on cw-heren-175702). Textures are mipmapped and sampled trilinearly at one level of detail per
  triangle. The standard material's direct GGX specular (three.js BRDF_GGX) is reproduced; it is what lit the
  Westerkerk roof (pixel |Δ| 0.45 -> 0.13 once added). BLEND draws after the opaque pass, far to near, without depth
  writes; MASK discards below the cutoff; triangles crossing the near plane are clipped.
- `views.ts`: one view vocabulary, the JSON landmark-views.mjs takes: `orbit` (gallery camera), `street`, `front` (the
  orthographic elevation of a wall a -> b at N px/m, a on the left, rows from the top: the axis of
  `scripts/pand-reference/rectify.ts rectifyWall`, so a rectified photo and the render overlay), `threeq` (render.ts
  frontViews' 3/4). `gallerySheetViews()` is the fixed sheet: gallery card, front, top, back.

### Call sites and the flag

| Call site | Default now | `--browser` |
|---|---|---|
| `scripts/building-recipes/render.ts` `renderModels` (every importer: block-face review, auto-place, batch, draft-preview, ortho-compare, run-views, door-reveal-sheet; large.ts sheets; measure.ts, closeup.ts, measurement-sheet.ts, index-row-sheet.ts, roof-tidy-cards.ts; landmark `*-strip.ts`; mercatorplein, haparandaweg, street-chunks, street-surveys) | Node | Chromium (also `GLB_RENDER=browser`, `useBrowserRenderer()`) |
| `render.ts` with `{city: true}` (`--city-look`, index-row-sheet.ts) | Chromium, always (Node has no city-look atlas shader) | - |
| `scripts/landmarks/landmark-views.mjs` | Node (`scripts/glb-raster/views.ts`, no dev server) | Chromium + dev server on PORT |
| `scripts/landmarks/review-sheet.ts` GLB tiles | Node (the page's own lights, ground, DoubleSide) | Chromium; the in-game frame stays a browser frame |
| `scripts/house-preview/gate.ts` | Chromium (it is the Node-preview-vs-Chromium cross-check) | - |
| `house:preview --recipe` | Node, unchanged (flat game colours: H2 calibrated them against the ride frame) | - |
| `large.ts` likeness / `install-large.ts` likeness gate | Node already (modelElevation on the material soup); no install step launches Chromium for a check that is not a picture | - |

Left in the browser, and why: `kit-sheets.ts` (renders kits from the kit code in the page, not a GLB);
`building-types/camera-sheets.ts` and `coverage/build-look-thumbs.ts` (building-types render-page.ts: the lit
recipe look `lit: true` under the sunny rig and its review look; the cell path is here, the lit-cell Lambert and the
sunny rig are the next step); `big-camrender`/`big-camshot` and every `*-game*.mjs` / ride capture (in-game frames).

### Commands

`node --import tsx scripts/glb-raster/views.ts` (INTEGRATOR TODO: `npm run glb:views`):

```
node --import tsx scripts/glb-raster/views.ts <id | file.glb> <views.json | - | sheet> <outDir> [flags]

Renders a GLB in Node (src/canalRecall/glbRaster: no browser, no dev server, no lock) from a list of views, the JSON
scripts/landmarks/landmark-views.mjs takes: [{name, light?, w?, hgt?, kind, ...}] with kind
  orbit  {theta, phi, zoom?}            the landmark gallery camera (vertical fov 32, fitted to the bounding sphere)
  street {x, z, h, fov, eye?, pitch?}   camera at x/z, heading h deg from north, horizontal fov, eye height (2.5 m)
  front  {a: [x, z], b: [x, z], ppm?, v0?, v1?, pad?}  orthographic elevation of the wall a -> b (a on the left),
                                        ppm px/m (50), the axis of pand-reference/rectify.ts rectifyWall
  threeq {a, b, heightM?}               render.ts frontViews' three-quarter view of that wall
light: game (default: normaliseLandmarkMaterials' Lambert under the game's hemisphere/sun/fill, the floor) or gallery
(the GLTFLoader standard materials under the gallery light, the sun following theta, no floor). Coordinates are the
GLB's own (x east, y up, z south for our models).

  <id>              public/canal-drive/models/<id>.glb; or a path to any .glb
  views.json        the view list; '-' = landmark-views.mjs's defaults (gallery card, game card, three game orbits);
                    'sheet' = the fixed sheet (gallery card, front, top, back) composed into <outDir>/sheet.png
  --wall=ax,az,bx,bz  the sheet's front wall (else the box's south face is an orbit)
  --look=<look>     override the dressing: game | gallery | recipe (render.ts's recipe look) | flat
  --ss=<n>          samples per pixel side (default 2, the 4x MSAA pattern)
  --help            this text

Writes <outDir>/<name>.png per view and prints each path with its time. Not drawn: cast shadows, anisotropic
filtering, the city-look atlas shader (use render.ts --browser or landmark-views.mjs --browser for those).
```

`node --import tsx scripts/glb-raster/agreement.ts` (INTEGRATOR TODO: `npm run glb:agreement`):

```
node --import tsx scripts/glb-raster/agreement.ts [flags]

Renders the lane H12 agreement set (10 canal houses incl. the Nassaukade 506 block and Haarlemmerdijk 2-58, 5 block-face
chunks, 5 large recipes incl. Houthavenkade 26, 5 landmarks incl. glass/leaves) in Node and in Chromium, measures each
front elevation (measureFacade, 1.5 px blur) and judges Node against Chromium (previewVerdict, reference
'render'). Chromium: run under /tmp/canal-pw.sh with your PW_PORT.

  --out=<dir>       output directory (default artifacts/glb-raster/agreement): agreement.json, sheet-*.png, per-id PNGs
  --only=<id,...>   these set ids only
  --ss=<n>          Node supersampling (default: the renderer's)
  --reuse-browser=<dir>  measure against the Chromium PNGs of an earlier run in <dir> (no browser)
  --node-only       time the Node side only (no Chromium)
  --browser-only    time the Chromium side only (today's path, the before numbers)
  --help            this text
```

### Agreement (2026-11-10, 25 GLBs)

Set: 8 recipe canal houses + the Nassaukade 145-152 face (the Nassaukade 506 bar) + Haarlemmerdijk 2-58 r1 (holds
Haarlemmerdijk 6, from lane/belt-haarlemmer-20261110); 5 block-face chunks; 5 large recipes incl. Houthavenkade 26;
5 landmarks incl. the Conservatorium (glass, BLEND) and the Lensbomen (BLEND leaves). The front elevation at up to
50 px/m, measured with measureFacade after the 1.5 px blur, Node judged against Chromium (previewVerdict, reference
`render`). Controls: each renderer against itself with the camera moved a quarter pixel.

| Measure | Result |
|---|---|
| Pixel |Δ| (mean over the front, 0-255), median of 25 | 0.53 (max 0.98, clercq-236681) |
| Wall ΔL median / hue median | 0.002 / 0.2° |
| Verdict PASS, one frame each | 19 / 25 |
| Verdict PASS within the renderers' quarter-pixel envelopes (some pair of {Node, Node 1/4 px} x {Chromium, Chromium 1/4 px}) | 23 / 25 |
| Chromium PASS against itself 1/4 px over | 20 / 25 |
| Columns equal (one frame) | 20 / 25 |

The strict gate (verdicts equal on 23 of 25 single frames) is not met: 19. Every disagreement is a measureFacade
decision on a knife edge, not a drawing difference (the renders differ by under 1/255 on average, edges only):

- Chromium disagrees with itself a quarter pixel over on 5 fronts (callenburg-3-63, houthavenkade-26, entrepotdok,
  westerkerk, conservatorium), so no renderer can score more than ~20/25 single-frame against it.
- houthavenkade-26 (window shape none vs tall), westerkerk (wall pick flips between the stone tower and the brick
  nave: ΔL 0.25 on the same pixels), conservatorium (window shape): Chromium's own 1/4 px control fails the same way.
- nassau-145-152 (columns 24 vs 6) and rijksmuseum (columns 39 vs 77, period halving): Node's own 1/4 px frame flips
  back to Chromium's reading (nassau inside the envelope).
- clercq-236681 (window shape wide vs square: opening width 0.8 vs 0.6 m at aspect 0.62 vs 0.81, the 0.7 boundary)
  and rijksmuseum stay outside the envelope; the crops are identical to the eye (sheet 2).

Speed (the user's Mac, warm unless said): the 4-view sheet of cw-heren-175702 in 0.33-0.41 s (`views.ts ... sheet`,
1.0 s for the whole command from a cold `node`); Chromium 1.5 s cold (launch + bundle), 0.07-0.09 s warm, plus any
wait for a slot. A large recipe (Houthavenkade 26, `large.ts`, all wall and aerial sheets) 6.1 s in Node, 4.9 s with
`--browser` on a free slot. Block-face `review` (bilder-081118-155417) 2.2 s Node, 4.7 s Chromium, identical review
lines. Both completed with `PLAYWRIGHT_BROWSERS_PATH` pointing nowhere (no Chromium can start). The 25-GLB agreement:
Node 32 s, Chromium 8 s (most of the Node time is the ortho fronts at 1800 px).

Not reproduced: the city-look atlas shader, anisotropic filtering, cast shadows, environment maps. The release review
"at gallery size from all sides" can use the Node orbit (`views.ts <id> -`) for its first look; the release decision
itself should stay on a Chromium or in-game frame until the measureFacade knife edges above are hardened (OPEN).
## §9 Oud-West period-palette measurement and brickLift v2 (lane #373, 2026-11-10 / 2026-11-12)

Question: whole 1875-1910 rows that panoramas show as dark purple-brown brick drew bright orange-red. Tools: `scripts/house-specs/oudwest-palette.ts`
(`select`, `measure`), `oudwest-palette-report.ts` (`report`, `pairs`) and `oudwest-profile-trace.ts`; Node only, staging in `staging/oudwest-palette/`.
Wall = `measureStripWallFit` on a 50 px/m rectified winter panorama (obliquity under 30 deg; windows, trim, foliage masked, wallFit's white balance);
drawn = `bayLookFor` (with `buurtProfileAt`) -> `cityLookTint` -> `photoMatchedWallTint`, the runtime functions, run once with `BRICK_LIFT=v1` and once
with the default. 59 plain-brick c19 pands of the Oud-West / De Baarsjes gebied (Nov-Mar captures; 096181 a relaxed pick, 160809 washed out).

**Finding.** Measured mean L* 30.3 (C* 10.8); drawn under v1 54.5 (C* 27.0); dL mean +24.3, median +25.1, p10 +8.5, p90 +37.3. All 59 draw from a buurt
profile wall, not the bare period palette. The profile pools hold bright and grey entries (pool mean L* 48); `cityWallTint` (0.12 + 0.9 l, floor 0.3) adds ~4 L*
and cannot draw darker than ~L* 37 (measured walls sit at 21-35).

**brickLift v2 (default on since 2026-11-12; the user: "go for correctness, we can lighten it later").** `?brickLift=v1` (BRICK_LIFT=v1 in Node) restores the
old lift byte-for-byte. `src/canalRecall/look/brickLift.ts`: (1) a dark brick (HSL l under 0.62, light buff excepted) lifts by `l' = clamp(l + 0.05, 0.14, 0.6)`,
hue kept, grey stays grey; (2) a buurt profile's dark brick wall takes a 0.4 linear-light gain first; (3) `C19_WALLS_V2` replaces the c19 period brick entries
(`#564543 #564543 #654a34 #594940 #594b40 | #d3b184 #e2d5ba #e2d5ba #d9c5a4 | #764e2e`, buff / cream / stucco entries unchanged); (4) a pand with no stated
material and no register finish counts as brick for the trim-misread rule (`decorate.ts specWallIsBrick`; 83 % of the unstated c19 pands read brick:
58 brick, 1 pale render, 11 grey, 19 unmeasurable). Scope: only the generic building tiles ask for it (`writeTile.ts appendBuckets` passes `brickLift`);
recipe, landmark and GLB brick tints never move. Pinned by `look/brickLift.test.ts`: stucco, white and buff (#e2d5ba #d9c5a4 #d3b184 #f2f2ee #e4ddcd #d8d8d2 #c9b79a)
draw byte-identically on every slot. Result on the 59 pands: dL mean +8.4, median +6.0, p10 -8.5, p90 +31.1 (the tail is pale greige profile walls, left alone);
mean chroma 21.0. Held pale-warm walls (`held-wall-audit.ts`, SPEC_WALLS=1): v1 84 held, v2 51 held, all brick, no grey brick.
Caveat: H9 spec walls on the generic path take the v2 lift too (up to ~4 L* darker at mid lightness). The baked world-v1 cells keep the old tints until a recompile.

**Where the grey and pale pool entries come from** (`oudwest-profile-trace.ts`, thumbnail-only so approximate). Grey entries (#8d8d90, #787878, #818181, #757574,
#7b7c7d, #9a9896) are dark brick under an overcast cast: raw #555554 / #646768 with no real trim take the city white-point gain, normalise to L* >= 62 and were
called painted. Fixed at the source: `paintClass.ts DARK_NEUTRAL_RAW` (raw L* < 55, C* < 10, trim via the city white point: brick); 170 of 1,049 painted thumbnail
walls city-wide flip. Cream entries (#e2d8d4, #dfd9d7, #ece8e1, #eae8e7) come from raw L* 87+ thumbnails: real render. The orange top brick slice (#c07f61, #ab7252,
#a97863) is sunlit brick whose wall median includes the pale speklagen, then the profile's brick chroma calibration. `buurt-profiles.json` is NOT republished: re-run
`scripts/buurt-profiles/derive.ts` after the v2 palette lands (its calibration reference is the median of `PERIOD_WALLS.photo` bricks).

**Frames not yet run** (house:frames on 12 pands and the Kinkerstraat / Bellamystraat / JP Heijestraat / Helmersbuurt street frames, v1 vs v2): the tile worker is
loaded by URL, so a page query never reaches it; compare two scratch bundle builds (`BUNDLES_DIR`, three-buildings + worker) with the default constant flipped.
Pairs of the measurement: screenshots repo `ui/2026-11-10-oudwest-palette/`.

## §10 Facade benchmark and blind critic (`house:critic`, lane F4, #379)

Acceptance for generic-path pands moves from per pand to per feature (docs/plans/facade-programme-20261112.md, F4): a
fixed benchmark is framed in the game every round, a fresh critic names the single biggest gap per pair from a closed
vocabulary, and the ranked gap histogram is the kit-gap queue (§5). Landmarks keep gallery-size review.

| Piece | Where |
|---|---|
| Groups (contiguous blocks) | `scripts/house-line/benchmark/groups-v1.json` |
| Pands from BAG addresses (PDOK locatieserver + verblijfsobject, cached) | `scripts/house-line/benchmark/select.ts` |
| The benchmark: 199 pands, wall overrides, the photo each was read from, hand labels | `scripts/house-line/benchmark/benchmark-v1.json` (`build.ts` keeps labels when re-run) |
| The house:frames list | `scripts/house-line/benchmark/benchmark-v1.frames.json` |
| Reading convention, label type and validator | `scripts/house-line/benchmark/labels.md`, `src/canalRecall/houseSpec/critic/labels.ts` |
| Labelling sheets, label merge (refuses a label read from a photo the pose no longer uses) | `label-sheets.ts`, `merge-labels.ts` |
| Vocabulary, side shuffle, masks, parser/scorer/stop rule | `src/canalRecall/houseSpec/critic/{vocabulary,shuffle,mask,score}.ts`, `critic.test.ts` |
| Round harness | `scripts/house-line/critic.ts` (`prepare`, `score`, `plot`) |
| Queue | `scripts/house-line/kit-gaps.ts` |

### Pose rule

`--season winter --prefer-obliquity 30`: winter captures first; then captures whose pose fits the whole wall (no
`clipped`); then obliquity under 30 deg, squarest first. Canal fronts (`kind` canal belt / kit standard) are framed with
`maxDistM: 60` from the far quay: from the near quay (5 m) a 120 deg lens cannot hold a canal house's crown. With either
flag house:frames drops a capture whose sight line to the wall (two of the middle and quarter points, 0.6 m out) crosses
another footprint: without it 62 of 198 poses (Jordaan, Haarlemmer, Nieuwmarkt) stood on the next street with houses in
between (the readers marked 36 of 37 Jordaan pands unreadable). Narrow streets have no square view: their poses are
40-55 deg oblique. A pose flagged `otherBuilding` is re-picked with the entry's `notPanos`.

### A round

```sh
# 1. frames (one run for the whole benchmark; house:frames takes its own browser slot: never wrap it in /tmp/canal-pw.sh)
PW_PORT=<port> npm run house:frames -- --list scripts/house-line/benchmark/benchmark-v1.frames.json \
  --season winter --prefer-obliquity 30 --label round-N --out artifacts/critic/frames-round-N [--query ...]
# 2. masked, shuffled pairs; sheets of two pairs; one prompt per chunk; the key goes to artifacts/critic/keys/ (never to the critic)
node --import tsx scripts/house-line/critic.ts prepare --frames artifacts/critic/frames-round-N --round N
# 3. one FRESH Claude opus agent per chunk, prompt = artifacts/critic/round-N/prompts/chunk-K.md, nothing else
#    (no specs, no labels, no history; Jev and Gemini may pre-sort pairs but are never the critic)
# 4. parse and score: answers.json, histogram.json, fooled-rate.json; artifacts/critic/fooled-rate.{svg,png,json}
node --import tsx scripts/house-line/critic.ts score --round N
# 5. the queue
node --import tsx scripts/house-line/kit-gaps.ts --round N --md artifacts/kit-gaps/critic-queue.md
```

Masks (identical on both halves): everything under 1.5 m above the wall foot is grey (cars, bikes, people, the street;
stoops and stallrisers go with it); leaf pixels of either half, dilated 3 px, are grey on both; each half's own sky is
painted one flat colour (a union would draw the photo's skyline into the game half, and the skyline is evidence). The
wall outline is drawn on both. The fooled-rate is the share of answered pairs where the critic named the photo as the game
(0.5 = cannot tell them apart). Stop rule: flat (|change| < 0.03) for two rounds, restart with a fresh critic (new seed,
new chunking) before reading more into the curve. Archive every round's photo/game pairs to the source-data repo
(`experiments/facade-benchmark/round-N/`): J3 could not re-run likeness because its render sources had been pruned.

### Round 0 (2026-11-12, baseline before F1)

Main at 659f8fc72 plus this lane's pose rule; default world; 193 of 199 pands posed (6 have no capture with a line of
sight in 5-35 m, one is not in the building tiles), 193 framed in one run (12.2 min, 15.8 pairs/min); 157 generic, 23
installed models, 13 spec recipes. Four fresh Opus critics, about 50 pairs each.

- **Fooled-rate 0 of 193 (0.0 %).** The critic named the game every time (high 82, med 65, low 46): today's render is
  told apart at a glance, so the curve has room. Rate per group and the full histogram: `artifacts/critic/round-0/`.
- **The queue** (severity sum): wall colour/tone 87 pairs (153), crown/gable type 24 (55), window columns 15 (30),
  brick vs render 11 (25), window kind 14 (21), white surrounds/bands 12 (18), roof/dormer 9 (16), storey count 7 (15),
  wrong building 3, pane layout 2, blank wall 1, shopfront form 1; none 7. Wall colour leads on every group.
- **Shopfronts are under-read**: the 1.5 m street band hides stallrisers, doors and most of the display glass, so
  "shopfront present" was never named although 105 of 158 readable pands have one. Round 1 should drop the band to
  ~0.9 m on the shop groups (or mask vehicles only) before reading the F2 gap.
- Labels: 158 of 193 readable (canal fronts from the far quay read best; Nassaukade 506 is 2 of 7, branches in front
  of the 2020 winter captures; narrow streets are 40-55 deg oblique).
- Frames flags: otherBuilding 17 (re-pick with `notPanos` next round), roofOffset 46, wallColour 70; photo edge
  alignment median 2.2 % (p90 5.1 %).

Archive: source-data `experiments/facade-benchmark/round-0/` (frames, critic pairs and key, labels, queue). Sheets:
map-recall2-screenshots `ui/2026-11-12-facade-benchmark/round-0/`.

## §11 Wall colour per stage, and the measured wall pool (lane W1, 2026-11-12)

The user (2026-11-12): "every house is the wrong color". Ruling: correctness first, measured dark brick ships even if the
city reads darker.

### Where the error arises: `scripts/house-frames/wall-stages.ts`

```sh
node --import tsx scripts/house-frames/wall-stages.ts <house:frames out> [--keys a,b] [--json f] [--md f]
```

Per pand of a frames run, OKLab at every stage of the generic path against the photo half of the same pose
(`analyse.ts wallLab`): photo; the spec reading (`houseSpec.wallHex`); the source the period path draws without one (the
buurt profile's era wall, or `PERIOD_WALLS`' hash pick); decorated (`specRecipe.wallHex`, else the source); mesher
(`meshBuildingFor` wallHex); pixel (wallLab on `game.png`). Classes: `spec` (a drawn reading), `held` (the pale-warm
guard), `profile`, `period`, `model` (an installed chunk/landmark: no Node-side stage).

F4 round 0 (193 pands, default world, main 659f8fc72), stage table with the pool off (`WALL_POOL=0`), means:

| class | stage | n | dL | dC | dh (median) | dE |
|---|---|---|---|---|---|---|
| spec | reading vs photo | 12 | -0.010 | +0.010 | +14 | 0.112 |
| spec | decorated vs reading | 12 | +0.040 | +0.028 | -4 | 0.080 |
| spec | mesher vs decorated | 12 | 0 | 0 | 0 | 0 |
| spec | pixel vs mesher | 12 | -0.006 | -0.010 | +3 | 0.043 |
| spec | **pixel vs photo** | 12 | +0.024 | +0.027 | +11 | **0.067** |
| profile | source vs photo | 152 | **+0.137** | +0.027 | -26 | **0.210** |
| profile | mesher vs decorated | 153 | +0.004 | 0 | 0 | 0.012 |
| profile | pixel vs mesher | 153 | -0.080 | -0.015 | +1 | 0.116 |
| profile | **pixel vs photo** | 152 | +0.061 | +0.012 | -11 | **0.134** |
| held | reading vs photo | 4 | +0.174 | +0.018 | +9 | 0.176 |
| held | mesher vs decorated (heldBrickWall) | 4 | -0.100 | +0.022 | 0 | 0.102 |
| held | pixel vs photo | 4 | -0.068 | +0.026 | -9 | 0.144 |
| model | pixel vs photo | 23 | +0.030 | +0.016 | +18 | 0.077 |

Read:
- **The error is the source, on pands without a reading.** 152 of the 193 drew a buurt-profile swatch, none the bare
  period palette. Their drawn wall is uncorrelated with the photo (Pearson r on OKLab L: photo vs mesher 0.000, photo vs
  pixel 0.07); photo walls sit at L 0.42 ± 0.09, C 0.016, the profile swatches at L 0.55 ± 0.20 (whites #e1dbd3,
  #e3e0e1, slate greys #7c7c7d, #696a6d, terracotta #bc7f5e). All 87 critic wall-colour pairs are profile or installed
  pands; the critic named wall colour on **0 of the 13** spec-wall pairs.
- **The spec walls are not 0.10 L darker than the photo**: pixel vs photo dL +0.024 (n 12). The 0.10 figure was pixel
  vs mesher on the wall-colour-truth set, whose 11 non-spec walls were pale profile swatches: the render compresses
  lightness (pixel L = 0.43 x mesher L + 0.24 over 169 walls; +0.03 at mesher L 0.3-0.4, -0.06 at 0.5-0.6, -0.34 at
  0.9+), so a white swatch draws mid grey and a dark brick draws as itself. **No lift change**: on a dark measured wall
  the lift is near identity; a lighter lift would only hide the source error.
- **Brick drawn as render** (wall-colour-truth's three, 165826, 157089, 233628; also 167816): not a material flag. The
  wall cell is brick; the profile picked a painted swatch (#e1dad4, #dfd9d7, #ece8e1, #e2e9ec), and a near-white tint on
  the brick cell reads as render. Fixed at the source below (#896558, #7c502d, #a35a30, #575351).
- The profile pools cannot be re-derived here: `derive.ts` reads 558 archived panorama walls but the panorama thumbnails
  it was published from are not archived (`panorama thumbnails used 0`; 104 of 466 profiles would survive). §9's
  `paintClass` fix is still unpublished for that reason.

### The measured wall pool (`look/measuredWallPool.ts`, flag `?wallPool=0`, `WALL_POOL=0`, default on)

- **Table:** `scripts/house-specs/measured-wall-pool.ts --publish` writes `look/measured-wall-pool.json`: 1,051 spec'd
  pre-1945 pands whose reading draws (the decorated colour, `decorate.ts specWallColour`, under the default flags), with
  centroid and archetype. Excluded: 268 held readings, 2 readings drawn as their family tone (trim misread) and 43
  post-1945 pands. A pand an installed model hides enters (945): its reading is of the real front.
- **Unmeasured pand** (`bayLook.ts bayLookFor`, `at`): photo look, no recipe/modern vocabulary, archetype canal, c19 or
  school. Candidates are the measured walls within 600 m of the same archetype (any pre-1945 archetype when fewer than
  6). It takes the 12 nearest, keeps the 3 nearest their median colour (per OKLab axis), and picks by id hash. (A 35-65 %
  lightness band, the first try, drew orange-red outliers such as #783721 beside low-chroma brown photos.) The pick replaces the profile
  swatch and outranks a material prior as a profile wall does (`profileWall`). With fewer than 6 candidates the profile
  stands.
- **Period palette** (`brickLift.ts periodWallList` → `measuredPeriodList`): the city-wide L deciles of each archetype's
  measured walls replace `PERIOD_WALLS.photo` (and brickLift v2's c19 list) for pands with no profile and no neighbours,
  and for `heldBrickWall`'s brick fallback. canal (n 58) #3a3735 .. #f0d5ac, c19 (n 559) #3f362d .. #96958f, school
  (n 434) #383838 .. #988a87; no #b05a40/#bd6a45 terracotta, no #3e4a40/#5d605a slate.
- **Chroma at the decoration stage** (`houseSpec/wallColour.ts specWallDisplay`, flag `?wallChroma=0`, `WALL_CHROMA=0`,
  default on). With the pool on and the round-3 decoration, the 96 changed pairs drew pixel C 0.043 at hue 48 against
  the photos' 0.016 at hue 62: orange-red where the photo is brown. The readings sit near the photo's chroma (reading vs
  photo dC +0.01). The round-3 gain (up to x2.4, hue pulled toward 40) matched the old period palette's chroma, not the
  photo; it added +0.028 C. Now a warm pixel reading keeps its chroma and hue, and only the lightness lift stays. A
  reading of #6e4b44 drew #a35042 and now draws a muted red-brown. It reaches every spec wall (1,364 readings), and it
  moves the pale-warm guard: 268 held instead of 301.
- **Reach:** both the live path and the baked world-v1 path (the worker forwards `wallPool`, `engine/workerPool.ts`);
  the integrator rebuilds world-v1. F1's `?shaderFacades=1` draws record walls at 1.0 x wallHex, so it gets the change.
- **Off is byte-identical** (`measuredWallPool.test.ts`: bayLookFor with and without a location under `WALL_POOL=0`).

### Result on the W1 pairs (`scripts/house-frames/wall-colour-w1.json`, 114 pairs)

The 114 pairs are F4's 87 wall-colour and 11 brick-vs-render pairs plus the 16 wall-colour-truth pands (with 157926 and
154359). The run used `house:frames --before`, `?world=live`, and before = the committed bundles. After = scratch
bundles served via `BUNDLES_DIR`.

| | before | after |
|---|---|---|
| mean wall dE (pixel vs photo) | 0.151 | **0.097** |
| changed pairs (98) mean dE | 0.155 | 0.092 |
| pixel L (photo 0.427) | 0.506 | 0.463 |
| pixel C (photo 0.016) | 0.031 | 0.025 |
| better / worse > 0.02 / same | | 61 / **15 (13 %)** / 16 |

- **Gate:** the mean dE went down. The rule "no more than 1 in 10 pairs worse by more than 0.02" **fails** at 15 of 114.
  - Most of the 15 are pands where the before swatch happened to land near a dark photo, or where the pool's median is
    lighter than a near-black painted front.
  - One is a 1986 pand that BAG dates post-war and that still draws a pre-war list.
- **Unchanged (intended):**
  - the installed chunks (nassau-145-152, kinker-206-242);
  - the spec pands whose dark readings gain little chroma either way (154359, 157926, 161457).
- **Critic round 101** (opus, blind, `artifacts/critic/round-101`): wall colour/tone was the gap on **36 of 114**
  pairs. On these same pairs it was 87 in round 0. Of round 0's 87, 32 still name wall colour.
  - The remaining complaints: near-black painted fronts drawn brown, purple-red brick drawn olive-brown, and orange
    reds that are still too bright.
  - The critic was fooled once.

Still wrong:
- A row of unmeasured pands now draws a uniform grey-brown. The reds and the odd pale stucco front of a canal row are lost.
- Painted black or white fronts with no reading draw brown.
- The pool covers only areas with spec readings. Elsewhere the profile swatches remain.
- A held reading still draws heldBrickWall.
- The reading stage is one photo per pand: 154359 reads 0.24 L darker than its frame.


## §12 Wall variety and painted fronts (lane W2, 2026-11-12, flag `?wallVariety=`, default off)

The integrator's reading of the W1 triples: W1 fixed the mean but drew rows in one colour. 176005's Herengracht row (red
brick, dark target, white stucco, red-brown) drew four grey-browns, and W1's row lightness spread was 0.70 of the photos'.

### The draw (`look/measuredWallPool.ts drawFor`, `POOL_DRAW`)

- **Candidates:** the 24 nearest measured walls, same archetype as in W1.
  - A colour repeated within 40 m counts once, because a split building carries one reading on each pand.
  - City-wide repeats stay: the readings are quantised (#6d5743 is 22 pands).
  - The candidates are sorted by OKLab L, then hue.
  - Each is weighted exp(-(d - d0) / (15 m + d0)), where d0 is the nearest candidate's distance.
- **Quantile:** a rank-1 lattice over 7 m cells (golden and plastic ratios) plus a 5 % id-hash jitter. Consecutive pands
  along a row of any direction take well-spread quantiles. The band keeps the central share of the CDF: 0 is the weighted
  median, 1 is the whole distribution.
- **Query point:** with variety on, the pool is queried at the ring's vertex mean, which is where the table's points
  are. With variety off it uses the first vertex, as W1 shipped. **Off is identical to W1:** `wall-predict.ts` gives 0
  changed walls on the 114 pairs.

**Why a kernel:** leave-one-out on the 1,051 measured walls.

| pick | LOO wall dE | LOO without same-colour neighbours |
|---|---|---|
| W1 (3 nearest the median) | 0.058 | 0.076 |
| nearest within 25 m | 0.041 | |
| kernel 15 m (k 24) | 0.048 | 0.079 |
| uniform of 24 | 0.095 | 0.095 |

Most of the nearest-neighbour gain is split buildings. The frames' pands sit a median **160 m** from a reading, so
for them the draw is close to the neighbourhood's distribution and carries no per-pand evidence. No other signal I
tested predicts the wall:
- the identity-palette `sideColour`: r 0.12 against the drawn wall L;
- the `canal-prior*` facade class: ±0.02 L;
- the register finish: present on 36 of the 1,051 readings.

### Painted fronts (kit addition)

- **The table** (v2) marks a measured wall painted when its reading is stucco, its register finish is light, or its
  drawn L is 0.62 or more. No brick reading reaches 0.58. 78 walls are marked: canal 10 of 58, c19 42 of 559, school 26
  of 434.
- **The kit could not say it.** Every pre-1945 bay cell was brick, so a white front could only be a pale tint on brick
  courses.
- **The new cells:** `bayLook.ts paintedLayers` adds 8 smooth cells (upper, ground, door and plain) for canal and c19.
  They use one preset per archetype: style 1, transom sashes, no trim.
  - They are appended after the masonry cell, so no earlier layer moves.
  - They exist only with the shared restrained shop cells (newbuildFamily, default on). `?newbuildFamily=0` keeps 191
    bay cells and exactly 256 procedural layers.
- **Still missing:** school has no painted cell (the byte layers are full), and a painted pand loses its own window
  preset.

### Result on the 114 W1 pairs (`house:frames --before artifacts/w1/after2`, all four scratch bundles)

| | W1 | band 0.5 | band 1 |
|---|---|---|---|
| mean wall dE | 0.097 | 0.104 | 0.128 |
| worse than W1 by > 0.02 / better | | 36 / 23 | 49 / 18 |
| worse than pre-W1 by > 0.02 / better | 15 / 61 | 26 / 61 | 31 / 47 |
| row L std / photo's (11 rows of 3+ pairs; photo 0.071) | 0.70 | 0.83 | 1.16 |
| pixel L (photo 0.426) / C (photo 0.016) | 0.466 / 0.025 | 0.453 / 0.021 | 0.454 / 0.024 |
| critic: wall colour / brick vs render / fooled | 36 / 12 / 1 | 37 / 10 / 0 | |

- **Gate: not met at any band.** Band 0 (the weighted median) predicts 0.096 but 16 pairs worse than W1, with no added
  spread.
- **The pair set is biased toward dark photos.** The 87 F4 pairs were picked where the game drew pale over dark brick,
  and only 1 of 114 photos is pale. A draw true to the neighbourhood's spread (7.5 % painted) therefore scores worse on
  them by construction. Painted draws went to dark photos: band 1, 19 painted at dE 0.169.
- **Render compression:** pixel L is about 0.43 x mesher L + 0.24, so mesher spread reaches the pixel at under half its
  size. A painted white draws mid grey; see 176005's band-1 neighbour.
- `scripts/house-frames/wall-predict.ts` screens a pick-rule change in Node from a reference wall-stages run. It was
  optimistic by about 0.016 dE against the browser.
- **Trap:** the committed `own-ground-game` and `building-tiles` bundles forward worker flags. A scratch run must rebuild
  them, or the worker never sees a new flag; the first band 0.5 run was really band 1.

**Default off.** `?wallVariety=0.5` turns it on at band 0.5, `?wallVariety=1` gives the whole distribution, and
`WALL_VARIETY` does the same in Node.
