# Lane: large-tier components the batches keep asking for (buildings, 2026-10-13)

The dominant-building batches (`lane-dominant-large-20261013.md`, `-2-`)
and the police lanes each listed the same missing components; every batch
simplified or skipped them. Add them once, with a test each, default compose
byte-identical (`test:fit-golden`, `test:building-recipes`,
`test:block-kit-installed` all identical), then re-author the batch-2
houses that need them and re-install.

Inputs: `src/canalRecall/blockBuilding/{compose,components,systems,spec,gates,arch}.ts`,
`src/canalRecall/buildingRecipe/{largeIntent,fitLarge,largeCompile,largeGates,largeTier.test}.ts`,
`scripts/building-recipes/houses/*/intent.json` (batch 2:
`beursplein-5-165051`, `warmoesstraat-garage-165687`, `engelsesteeg-165098`,
`oz-achterburgwal-233-180196`, `westerdok-186086`, `oude-turfmarkt-168172`,
`damrak-77-165746`), `docs/buildings-pipeline.md` (large tier), HISTORY
"Dominant buildings, batch 2" and "The frame-sheet z-fight class". Lane
owns the kit modules above, the batch-2 recipes it re-authors, and
`install-large.ts --install` for those houses in its branch. Do not edit
`game.js`, `index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`.

## Deliverables
1. **Rounded / curved corners**: a wall group whose panel follows the
   3DBAG arc (segments from the fitted polyline), with the window rhythm
   continuing round the curve (OZ Achterburgwal 233, Westerdok 536,
   Engelsesteeg).
2. **Per-group `wallMaterial`** (brick variants, stucco, stone, white
   render) with `materialSlot` + `tint` (Oude Turfmarkt's white block,
   Damrak 77's white bands as string courses in stone).
3. **Tilted bay-window row** and **perforated-brick screen** (Warmoesstraat
   garage) as components with their z-fight-safe depths (≥ 4.5 cm sheets,
   closed boxes).
4. **Signage mount under the cornice** and **a carved portal with crest**
   (stroke-font lettering exists; the portal as a stone surround with a
   tympanum block), plus string-course ends and the Beursplein cornice
   closed (no open edges in `topology()`).
5. Re-author and re-install the batch-2 houses that gain from 1–4
   (Beursplein 5 first: stone pilasters, lantern), with contact sheets
   before/after and the gates/audit per house.

## Checks
`npm run lint`, `npm run test:building-recipes`, `npm run test:fit-golden`,
`npm run test:block-kit-installed`, `npm run test:geometry-audit`,
`npm run audit:glb -- --id=<ids> --only-geometry`, `npm run check:osm-under-models`.
Report: branch, SHA, component list with tests, per-house table, sheets,
unfinished.
