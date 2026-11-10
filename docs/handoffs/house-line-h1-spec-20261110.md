# Lane H1: HouseSpec, adapters, extract, generic decorator (2026-11-10)

Part of the house line (`house-line-plan-20261110.md`, approved by the user 2026-11-10). This lane is the critical path: H3, H5, H6 and a1's six canal-belt buurt lanes wait on it. Opus.

The user's ask: "look at a canal house, write a description, pull in some kit parts and have it done in a few minutes." Today a house's facts live in three record types and nine render paths read their own subset, so the Nieuwmarkt 4–22 row renders as flat boxes while `monument-gables.json` and the register both know every gable (user photo vs game, 2026-11-09). This lane gives the game one record per house and makes the generic streamed path read it.

## Step 0 — measure before building (report first, 30 min cap)
Verify on origin/main, with line numbers in the hand-back, every premise below; a wrong premise changes the design and goes to the integrator before any code:
1. `src/canalRecall/blockFace/intent.ts`: `HouseDesign = Omit<CanalHouseIntent, 'schemaVersion'|'kind'|'id'|'pandId'|'address'|'sources'>` and `houseIntents(face)` returns validated `CanalHouseIntent[]` for every house on a face.
2. `src/canalRecall/facade/evidence.ts`: `SOURCE_STRENGTH` order (where `pdok-ortho`, `bag`, `monument-text`, `reviewed` sit), `Measured<T>`, `resolveField`.
3. `src/canalRecall/streetAppearance.ts`: `MeshBuilding.recipe?: ArchitecturalRecipe` exists with `bayScale`, `storeyScale`, `crownShape`, `openingGroup`, `wallHex`, and today is filled only from street-appearance profiles; `streetFacadeRendering.ts frontageLayoutScale` and `streetCrown` read it.
4. `src/canalRecall/world/cellFormat.ts` encodes nested object attributes (so a `specRecipe` object survives the bake).
5. `scripts/world/pipeline.ts`: `GLOBAL_INPUTS` lacks `monument-facts.json`; `CODE` lacks `facade/registerRecipe.ts` and `facade/registerFacts.ts`; `tileInputs(t)` = building-tiles + building-facts + roof-facts.
6. Count the record sources: `scripts/building-recipes/houses/*/intent.json` by `kind`; `scripts/block-face/faces/*/intent.json`; pands in `monument-facts.json`; overlap between them.
7. Reproduce the Nieuwmarkt defect in a frame: which of the four early-return causes applies to pands 4–22 (`decorateFacade` left no `facade`; `roofEavesHeightM` preset; `planRoof` rejected the footprint; coarse/shell). `scripts/register-facts/probe-row.ts` and `nieuwmarkt-row.test.ts` exist, start there.

## Step 1 — the hash fix
Add `monument-facts.json` to `GLOBAL_INPUTS` and the two register modules to `CODE`. Note in the hand-back that this forces one full world recompile at integration (the integrator schedules it).

## Step 2 — the record: `src/canalRecall/houseSpec/spec.ts`
```ts
export type SpecSource = FacadeSource | 'vision-judge' | 'author';
export type Prov = { source: SpecSource; confidence: number; ref: string; at: string | null };
export interface HouseSpec {
  schemaVersion: 1; pandId: string; address?: string;
  design: DeepPartial<HouseDesign>;              // the vocabulary recipes and block faces already speak
  provenance: Record<string, Prov>;              // keyed by field path: "fronts/0/gable", "palette/wall"
  schemaLimits?: string[];                       // `${component}: ${what the kit cannot say}`
  route?: 'generic' | 'recipe';                  // derived: validateIntent passes ⇒ recipe-eligible
}
```
Add `'vision-judge'` to `SOURCE_STRENGTH` between `pdok-ortho` and `bag`; `'author'` ranks as `'reviewed'`. `resolve.ts`: `resolveSpecs(parts: HouseSpec[]): HouseSpec` merges field by field with `resolveField`, strongest source wins, ties to the newer `at`; nothing is invented, a field absent from every part stays absent. `validateSpec` (zod or the existing validator style in `blockFace/intent.ts`). Unit tests for merge order, path keys, and that `toRecipe` round-trips a complete spec to a `CanalHouseIntent` that `validateIntent` accepts.

## Step 3 — adapters: `src/canalRecall/houseSpec/adapters.ts`
Pure functions, each with a unit test on a real record from the repo:
- `fromBlockFace(face, pandId)`: `houseIntents(face)` design; provenance `streetlevel-measured`, ref = the face's `strip.json` path; `rhythm.schemaLimits` + face `limitations` lines mentioning the pand → `schemaLimits`.
- `fromRecipeIntent(intent)`: `kind: 'canal-house'` only; its `sources` become provenance.
- `fromHouseRecord(record)`: gable words trap→step, hals→neck, verhoogde hals→raised-neck, klok→bell, tuit→spout, punt→point, lijst→cornice; bays, storeys, hoist beam, cornice; `Measured` fields keep their provenance.
- `fromRegisterFacts(published, nr)`: gable, facade year → era, finish, elements via `ELEMENT_COMPONENTS`; source `monument-text`, ref = register number. This is a1's `registerRecipe.ts` read as a writer: do not delete `registerRecipe.ts`; the decorator in step 5 sits after it and outranks it.
- `fromJev(judgement)`: bays, pui, gable (confident only), finish; source `vision-judge`, confidence from Jev's probability. Type only; H5 wires the judge.
- `toRecipe(spec): CanalHouseIntent | null` (null when incomplete).

## Step 4 — the extract
`scripts/house-specs/build-house-specs.ts`: for every pand with at least one source, resolve the parts into one spec and write `public/data/extracts/amsterdam/staging/house-specs/14/x/y.json.gz` (compact: resolved fields + per-field source code, not the full provenance; the full specs stay in `scripts/house-specs/<pandId>.json` only for hand-authored ones). `--publish` copies to `house-specs/14/…` after review, like `build-building-facts.ts`. Report coverage: pands per source, per buurt, inside `RIDE_PRIORITY_GEBIEDEN` (move that set to `src/canalRecall/ridePriority.ts`). Add `house-specs/14/${t}.json.gz` to `pipeline.ts tileInputs(t)`.

## Step 5 — the generic path reads it
- `houseSpecEnricher` in `gameTileEnricher.ts`, like roof facts, stamps `p.houseSpec` on raw features; behind `houseSpecsEnabled(search, env)` with `?houseSpecs=0` and `HOUSE_SPECS=0`, default on.
- `houseSpec/decorate.ts withHouseSpec(f)` in `gameFeatureDecorator` directly after the register step: writes properties the chain already honours (`monumentGable`, `constructionYear`, `registerFinish`) and one new `specRecipe` (an `ArchitecturalRecipe` subset: `crownShape`, `period`, `wallHex`, new `bays`).
- `threeBuildingFeatures.ts meshBuildingFor`: `recipe ??= p.specRecipe`. `frontageLayoutScale`: when `bays` is present, bay width = frontage length / bays (clamped to the style's min/max bay).
- `scripts/world/pipeline.ts gameChain` gets the same enricher + decorator so world-v1 cells carry it; `galleryPipeline.ts` too.
- Off must be byte-identical: `world:compile` with `HOUSE_SPECS=0` against the previous staging index = 0 differing cells.

## Step 6 — the Nieuwmarkt frame
Add a `nieuwmarkt-row` spot to `tests/e2e/demo-shots.spec.ts` (desktop DPR 2 and phone) at the user's 2026-11-09 photo pose (`map-recall2-screenshots/engine/2026-11-08-user-shots/nieuwmarkt-row-vs-streetview-*.png`). Before|after frames beside the panorama in the hand-back. The row must show its neck/bell/step gables; if `planRoof` still rejects a footprint, say which rule and leave the rule alone (that is a follow-up, not this lane).

## Step 7 — documentation (user: "well documented in the right places, CLAUDE.md where appropriate, for future claude runs")
Create `docs/house-line.md` with §1 (this record: fields, provenance, trust order, where hand specs live, how to add a source, the flag) and a stub heading per later station. Add the ten-line "House line" section to `CLAUDE.md` under architecture notes (house lanes write specs and stage, never install or recompile; the doc to read; the integrator owns `house:publish`). `HISTORY.md` entry: why the line exists (the plan's Context, three sentences). A lane that ships the code without these is not done.

## Gate
`npm run lint`; new unit tests; `world:compile` off = byte-identical, on = only cells whose tiles hold specs differ (list them); `check:canal` green; the Nieuwmarkt frames; coverage table; doc files present. Hand back SHA, step-0 table, coverage, frames, the full-recompile note, and TODO/HISTORY/What's New text for the integrator.

## Rules
`LANE-RULES.md`; `/usr/bin/git`; own worktree + port; link `node_modules`; browser runs under `/tmp/canal-pw.sh`; dev server stopped by port PID; staging first, `--publish` after review with the coverage diff; do not edit `game.js`, `index.html`, `package.json` beyond the new npm scripts, lockfiles, `TODO.md`, `HISTORY.md` (hand the text back instead).
