# Lane: `kind: large` recipes — fitLarge() and the first customers (2026-10-13)

Plan: `docs/plans/digital-twin-direction-20261013.md` §7 ("not flat
buildings") and `docs/buildings-pipeline.md` "Large tier (planned)". Lane owns
`src/canalRecall/buildingRecipe/{intent,fit,compile,gates}.ts` for the `large`
kind, `src/canalRecall/blockBuilding/*` as the facade-system geometry library,
`scripts/building-recipes/*` CLIs for large recipes, and the recipe JSON under
`scripts/building-recipes/houses/<id>/`. Do not edit `recipeLook.ts` or
`bayTextures.ts` (another lane owns the look), `game.js`, `index.html`,
`package.json`, bundles, catalogues (`ordinary-buildings-data/*.json`,
`manualCatalogue.json`), TODO or HISTORY. Report integrator steps instead.

## Goal
A `LargeBuildingIntent` (typed in `intent.ts`, rejected by the validator
today) compiles to real per-wall geometry on the exact 3DBAG LoD2.2 massing:
recessed windows with reveals and sills, projecting piers, string courses and
cornices, balconies (slab/rail/cheeks at depth), entrance recesses and
canopies, roof plant, stroke-font signage (`signage.ts`). Budget ≤ 12k
triangles, ≤ 30 min authoring. The flat `largeBuildingTier.ts` facade stays
untouched (it is the mid/far LOD).

## Deliverables
1. `fitLarge()` in `fit.ts`: 3DBAG LoD2.2 walls via `extractFacadeWallPlanes`
   (already decoded in `facts.ts`), per-wall-group assignment of a facade
   system by `walls[].wallSurfaces`, storey heights from the intent or civic
   defaults (4.2 m pre-1945 / 3.6 m after), ground floor system
   (plinth-shopfronts | glazed | blank), entrance per street run, roof plant on
   flat roofs. Deterministic, metres only from facts.
2. Dispatch on `kind` in `compileBuilding`; the facade systems come from
   `blockBuilding/compose.ts` (`brick-bay-grid`, `ribbon-windows`,
   `curtain-wall`, `plinth-shopfronts`, `blank`), extended where a customer
   needs it. Every emitted material carries `materialSlot` + `tint`.
3. Gates: footprint IoU ≥ 0.9 against BAG, eaves/ridge within ±0.3 m of
   3DBAG, ≤ 12k tris, `geometryAudit` hard gates, `compare:facades` where a
   rhythm spec exists.
4. First customers, with recipe JSON, contact sheets and audit output:
   Leidsestraat 67 (ribbon front, named in `docs/buildings-pipeline.md`), two
   of the 25 elevation skeletons with photos (`scripts/landmarks/*-elevations.json`;
   pick the two clearest), and **one police station** from the 23 matched in
   staging (TODO "Public buildings, next"; photos from the Amsterdam panorama
   API, CC BY 4.0, via `npm run pand-reference`). Police signature elements
   become components: blue-and-white striped "POLITIE" fascia band, blue lamp,
   garage doors, entrance canopy.
5. Document the schema and fit rules in `docs/buildings-pipeline.md` ("Large
   tier") and add `scripts/building-recipes/README` notes for authoring one.

## Checks
`npm run lint`, `npm run test:building-recipes`, `npm run test:fit-golden`
(re-record only if a canal-house fit legitimately changes; say why),
`npm run test:geometry-audit`, `npm run audit:glb -- --id=<id>` per customer.
Return SHA, triangle counts, gate results, sheet paths, and the catalogue
entries the integrator should add.
