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
| §5 The kit-gap queue | H6 | landed (this section) |

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

## §2 Preview in Node

Stub (lane H2): `house:preview <pandId|spec.json> [--watch] [--photo]`.

## §3 Stage and publish

Stub (lane H3): `house:stage`, `house:publish`, per-tile covers, golden allowlists.

## §4 Describe at scale

Stub (lanes H4, H5): `house:crops`, `house:describe`, the writers in trust order.

## §5 The kit-gap queue

Every kit limit the house line records is a `schemaLimits` line: on a house spec (§1, `{component, what}`), or on a
block-face type (`scripts/block-face/types/**`, applied to each house that uses the type). The queue classifies each
line to the kit's own part names and a canonical wording, counts it per pand, and ranks the result, so the kit session
chooses from counts instead of from whatever a lane last hit.

### The command

`npm run house:kit-gaps` (`scripts/house-specs/kit-gaps.ts`, `--help`) reads the published spec extract
(`house-specs/14`), the block faces (`scripts/block-face/faces/*/intent.json`, for each house's type, its photo strip and
its evidence date) and the type library. It writes:

- `artifacts/kit-gaps/queue.json`: an array of `{gap, component, weightedCount, pandCount, priorityPandCount, pands,
  examples: [{pandId, cropPath, intentPath}] (up to 3), firstSeen, lastSeen}`, sorted by `weightedCount`;
- `artifacts/kit-gaps/sources.json`: the sighting counts per source, the components, the gap counts before and after
  classification, the unmapped share and the unmapped list;
- `docs/handoffs/kit-gaps.md`: the generated table (the top 30, plus every entry at the threshold) and the horizon
  rule. Its `## Notes` section is hand-kept and carried over on every run. The script refuses to overwrite a
  hand-written doc that has no Notes heading.

`artifacts/` is not committed; the doc is.

### The classifier

`scripts/house-specs/kitGapVocabulary.ts` maps a prose line to `{component, what}` with ordered keyword rules, Dutch and
English, and no model, so the output is reproducible. Component vocabulary (the kit's own part names):
`openings`, `pui` (shopfront and signs), `crown` (gable forms), `cornice`, `ornament`, `wall` (brick, finish, massing),
`balcony`, `dormer`, `roof`, `door`, and `other`. Dutch and English variants (`muurankers`, `erker`, `dakkapel`,
`glasblok`, `portiek` ...) fold onto one English keyword first (`SYNONYMS`). Then the first matching rule names the
line (`RULES`; order matters, and the file's comments say why). A line no rule names is `other` and keeps its folded
text, so it appears in the unmapped list. Tests: `node --import tsx --test scripts/house-specs/kitGapVocabulary.test.ts`
and `src/canalRecall/houseSpec/kitGaps.test.ts`.

A pand counts once per gap. Its weight is 3 inside a ride-priority gebied (`src/canalRecall/ridePriority.ts`,
`isRidePriority`), else 1. Its gebied is the buurt whose polygon holds the pand's building-tile footprint centroid
(`coverage-v1/buurten.json`, the same join as `build-house-specs.ts`).

### The horizon rule

- A gap goes to a kit lane when its weighted count reaches 50, or when one landmark needs it.
- Below that, the house ships with the nearest kit option and the limit stays on its spec. A house lane does not fit
  the nearest option silently.
- The weekly kit session takes the top two entries of the queue.
- House lanes do not extend the kit themselves. They record the limit in `schemaLimits` and the queue carries it.

### Measured on 2026-11-10

Before classification (raw wording, one gap per distinct sentence): 650 gaps. After: 71 gaps, 39 at or over 50. 4,317
sightings (1,454 spec lines, 2,863 type lines) on 1,342 pands; 1,134 of them (85 %) in a ride-priority gebied.
Unmapped (`other`): 48 sightings (1.1 %, gate 15 %), mostly garden, hedge and measurement notes. The top of the
classified queue is in the generated doc.

### Known limits of the queue

- A family is a keyword family, not a single kit part. "dormer caps and pediments" holds a few gable lines that mention a
  pediment; "frieze and dentils" holds a few plain-wall mentions. The rules are the place to correct them.
- Measurement and placement notes (a tree hiding a storey, a module placement, a basement depth) are not kit gaps. They
  classify as their nearest part, so they still count. They should move off the kit queue when someone sorts them.
- `toSpecLimit` reads a `"component: what"` line by its first colon, so some prose becomes a component (`a`, `b`).
  The classifier reads the `what` text, so it does not depend on that; the adapter still needs fixing.
- Type lines reach the queue but not the house specs: `fromBlockFace` reads a house's rhythm and the face limits, not
  its type's `schemaLimits`. 17 houses name a type with no library file.
