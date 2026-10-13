# Lane: retire the street-survey chunks, fix the lit facade (buildings, 2026-10-13)

User 2026-10-13, Singelgracht screenshot on the deployed build: the
installed street-survey block (`Nassaukade 318 (20 houses)`, a block-face
chunk GLB) renders as a near-black mass with dark windows beside normal
generic extrusions; "you're fixing this, right? feel free to revert/drop
the modeled sections of repetitive buildings if you have a better solution
than the GLBs we had before" and "should we drop all the street survey
models and let you take them over with new generator logic? probably?".
Decision (integrator): yes. The 2026-10-13 plan already replaces per-house
GLBs with recipe tiles (`?recipeTiles=1`, `src/canalRecall/tileBuildings/`,
TODO "Recipe tiles"); the installed chunks are the legacy path.

Inputs: `src/canalRecall/landmarks/ordinaryChunks.ts` (the chunk entries,
`buildingCategory: 'street-survey'`), `ordinaryModels.ts`
(`STREET_SURVEY_HOUSES`), `public/canal-drive/js/signature-landmarks-source.js`
(how ordinary-building assets load and light; the sun lane re-aims each
model's light from `lightRig.ts` `enuDirectionInLocal` at load),
`rendererShared/litFacadeMaterial.ts`, `blockFace/compile.ts`,
`streetChunks/*`, `tileBuildings/*`, `buildingRecipe/*`, the gallery
(`public/canal-drive/models.html`?, "Street surveys" filter), HISTORY
entries "One world-fixed sun" and "recipe tiles". Lane owns the chunk
entries, the ordinary-models loader path for `street-survey`, the lit
facade material, the recipe-tile default flag and its tests; ≤ 10
reported lines in `vector-map.js`. Do not edit `game.js`, `index.html`,
`package.json`, bundles, `TODO.md`, `HISTORY.md`.

## Deliverables
1. **Why black**: reproduce the Nassaukade 318 / De Clercqstraat 22 chunk
   darkness on current main (Playwright shot at the Singelgracht from the
   user's angle) and find the cause (the re-aimed light under the model's
   placement rotation? a slot material without a tint under the city look?
   the baked shade? the `dim` highlight state?). If the same cause darkens
   the 33 recipe houses or any landmark GLB, fix it there first; report
   which models were affected.
2. **Retire the chunks**: the 22+ street-survey chunk entries no longer
   load by default (`?streetChunks=1` keeps them for comparison); their
   `covers` stop suppressing the generic pands so the streets draw like
   their neighbours; the gallery's "Street surveys" filter shows them as
   retired. Keep the block-face recipe data (`faces/*/intent.json`): it is
   the input of the recipe tiles.
3. **Recipe tiles on by default where they exist**: the Bilderdijkstraat
   and Nieuw-West pilot tiles (`?recipeTiles=1`) replace the generic
   extrusions for their pands; measure desktop ride perf on the fixed route
   (`scripts/ride-perf-fixed-route.mjs`) before/after and the per-pand
   highlight in the browser; if the tiles are not ready for default, say
   exactly what blocks them and leave the flag.
4. Shots: Singelgracht (user's angle), Bilderdijkstraat chase, De
   Clercqstraat, before/after.

## Checks
`npm run lint`, `npm run test:tile-buildings`, `npm run test:block-face`,
`npm run test:look`, `npm run check:osm-under-models`, `npm run check:covers`,
`PW_PORT=<yours> npx playwright test building-look recipe-tiles --project=desktop`.
Report: branch, SHA, the cause, shots, perf table, the `vector-map.js`
lines, unfinished.
