# Lane H5: spec writers — register, pixels, Jev, BAG (2026-11-10)

Part of the house line (`house-line-plan-20261110.md`). Sonnet. Starts when H1 (spec + adapters) and H4 (pilot crops) have merged.

The describe step is the one that scales: thousands of houses need a spec and nobody will type them. This lane writes `npm run house:describe -- <pandId|--buurt <code>> [--writers register,pixel,jev,bag] [--jev-budget-usd 2] [--dry-run]`, which fills a spec from the sources in trust order and stops where the evidence stops.

## Step 0 — measure before building (report first, 30 min cap)
1. `facade/evidence.ts FIELD_SOURCES`/`SOURCE_STRENGTH` after H1 (which sources may fill which fields; `vision-judge` rank).
2. `buildingRecipe/measure.ts` + `measureFacade.ts`: what they measure from a rectified crop today (palette, glazing share per storey, columns, storeys, window class; the known glazing undercount for white frames) and the input they expect (px/m, size).
3. The Jev spike's findings (`docs/handoffs/` J1 hand-back, memory `jev-typed-judge`): bays ±1 reliable, shopfront 85 %, gable confident-only (42 % coverage), finish 85 %, unusable for stone bands/basement/dormer; the `/v1/decisions` call shape, the image header, cost per image. The key is `TYPESAFE_API_KEY` in the user's login shell; presence check only, never print it.
4. `registerRecipe.ts`/`registerFacts.ts` published fields per pand in `monument-facts.json`; how many of the pilot buurt's pands are listed.
5. The hand truth set: a1's staged intents in the pilot buurt (count, which fields they fix). This is the agreement gate's reference.

## Deliverable
- `scripts/house-specs/describe.ts` with one writer module each in `src/canalRecall/houseSpec/writers/`: `register.ts` (uses `fromRegisterFacts`), `pixel.ts` (crop → `measureFacade` → palette/wall hex, glazing, storeys, bays from column count where confidence allows), `jev.ts` (typed judgements for `bays`, `pui`, `gable` only above the confidence the spike measured, `finish`; a hard USD budget per run and per buurt; the prompt/schema in a fixture so it is testable; responses cached by crop hash in the source-data archive), `bag.ts` (heights, year, footprint from `3dbag.json`/`facts.json`). Each writer returns a partial `HouseSpec`; `resolveSpecs` merges them; a writer never overwrites a stronger source and never invents.
- Disagreement log: when two writers disagree on a field, record both in `provenance` notes and pick by strength; print a per-field disagreement count per buurt.
- Output: `scripts/house-specs/generated/<buurt>/<pandId>.json` (full provenance) and the staging extract via `build-house-specs.ts`; `--stage` runs `house:stage` with the H2 receipt for each.
- `scripts/house-specs/agreement.ts`: writer-vs-hand table per field (bays, gable, finish, storeys, pui, wall hex ΔL) against the hand intents in the buurt; precision/recall per writer and merged.

## Gate
On the pilot buurt: coverage per field per writer; merged agreement with the hand intents ≥ 0.85 for bays, gable (where the register or a confident Jev read exists) and finish; Jev spend printed and under the budget; the twelve worst disagreements shown as crop + render + both values for the user to judge; `npm run lint`; unit tests per writer on fixtures (no network in tests).

## Documentation
`docs/house-line.md` §4b: the command, flags, writer order and what each may write, the budget flag, the cache, how to add a writer, and the agreement report. `--help` from the same `HELP` constant.

## Rules
`LANE-RULES.md`; `/usr/bin/git`; own worktree + port; link `node_modules`; Jev calls only with the budget flag set and the spend printed; never print or copy the API key; crops come from the H4 archive, no new panorama fetches in this lane; no edits to `game.js`, `index.html`, lockfiles, `TODO.md`, `HISTORY.md`; `package.json` only for `house:describe`; hand back SHA, step-0 table, agreement table, the twelve sheets, spend, and TODO/HISTORY text.
