# Lane: recipe tiles become the default, GLBs become tile entries (S2)

Plan §2. Rules: `LANE-RULES.md`. This is the loader 1000 buildings need:
today each landmark is its own GLB, fetched two at a time, ~8 draw calls each,
never evicted. Recipe tiles stream per z16 tile with shared instanced units
(`src/canalRecall/tileBuildings/runtime.ts`, compiler
`scripts/building-tiles/compile-recipes.ts`, HISTORY "Migration step 3").
Measured on the pilot: Bilderdijkstraat draws 301 → 144, heap −38 MB, iPhone
4× 7.1 → 6.7 ms; pixel-identical where no tile exists. Debt: the published
tiles are stale against main, 2 of 15 chunks differ, the instanced highlight
was never checked by eye, slot instancing found 0 repeats.

Model: opus for steps 1–3 and 5, haiku for step 4.

## Steps

1. **Quantise before hashing.** In the fitter (`src/canalRecall/buildingRecipe/fit.ts`
   where widths, eaves and crown are fitted) or in `tileBuildings/writeTile.ts`
   before the slot-level content hash, round to 5 cm. Re-run the pilot
   compile (`npm run build:recipe-tiles`) and report repeats found per unit
   kind; the Marnixstraat batch (4 of 5 houses sharing a mesh) says there
   should be some. `fit-golden` moves only by the rounding; say by how much.
2. **Recompile from main**, diff against the installed chunks
   (`ordinary-buildings-data/chunks.json`), explain the two Bilderdijk
   differences (`bilder-079721-x2`, `bilder-159426-165632`) or accept them with
   a contact sheet.
3. **Highlight check** in the browser (`?recipeTiles=1`): pick a Bilderdijk
   pand and a Nieuw-West type instance; the yellow highlight must follow the
   pand, not the unit. Screenshot both.
4. **`kind: glb` conversion** (haiku, scripted): every entry of
   `manualCatalogue.json` and the ordinary catalogue becomes a `kind: glb`
   tile entry with baked placement (`signaturePlacement.placementFor`) and
   `covers[]` from `covers.json`, lod1 as its mid unit; gates unchanged
   (`audit:glb`, `check:osm-under-models` 0). Batches of 50; the compiler
   emits review pages only for changed pands.
5. **Flip** `public/canal-drive/js/vector-map.js` (recipe tiles on unless
   `?recipeTiles=0`); add a "near hides mid" probe (no pand drawn by both the
   near tile and the legacy loader); `tests/e2e/recipe-tiles.spec.ts` alone;
   desktop ride-perf alone at the four places.

## Acceptance

Draw calls and heap at the four ride-perf places ≤ today's rows; the probe
at 0; the user looks at one strip: Bilderdijkstraat, Dam, Rijksmuseum,
Osdorper Ban, flag off beside on. Only then does the integrator flip and
delete the per-GLB request path (`_requestModels`) in a follow-up.
