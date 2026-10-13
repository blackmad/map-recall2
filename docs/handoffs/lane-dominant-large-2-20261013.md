# Lane: dominant mid-sized buildings as large recipes, batch 2 (content, 2026-10-13)

The large tier (`kind: large`, `src/canalRecall/buildingRecipe/{largeIntent,fitLarge,largeCompile,largeGates}.ts`;
HISTORY "large tier", "arches") keeps the 3DBAG LoD2.2 massing and emits real
facade geometry per wall from `blockBuilding/compose.ts`. Customers are the
unmodelled mid-sized pands in `public/canal-drive/dominant-building-backlog.json`
(1,828; every entry `priority: low` / `needs-identification-and-research`, so
rank by footprint ÷ distance from the centre). Batch 1 (`lane/dominant-large-20261013`,
merged) installed the Kattenburg quadrangle and the Heinekenplein block;
the arches lane installed Entrepotdok 164981, Reade Overtoom 283, Eden Hotel
Amstel 144, Nieuwpoortstraat 80-98. Shell probes that passed baseline but
are not authored: 243844 (Gillis van Ledenberchstraat 38), 165427 (hidden by
scaffolding). TODO "Large tier" has the rest of the state.

Lane owns the recipes, any new component (with a test; default compose
byte-identical), the install into your branch's catalogue through the large
tier's path, contact sheets. Photo sources: `scripts/pand-reference` (Amsterdam
panoramas CC BY 4.0), the Beeldbank for history. Do not edit `game.js`,
`index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`. Open data only.

## Deliverables
1. Rank the backlog (footprint ÷ distance from the Dam, unmodelled, not
   covered by a signature model, two fronts preferred); take the next 12.
   Identify each (address, function, year; BAG + panoramas) and write the
   recipe; signature elements (entrance, canopy, cornice, lettering, relief)
   listed as modelled / simplified / skipped with a reason.
2. Per pand: triangles (≤ 12k), gates, `audit:glb --only-geometry` pass
   (the z-fight gate is 0.5 m² for a new export: frames ≥ 3 cm proud or in a
   reveal), contact sheet (ortho + panorama + render), inventory JSON.
3. Any component the batch needed (e.g. shop band, balcony row, corner
   turret) added once with a test.

## Checks
`npm run lint`, the large-tier tests, `npm run audit:glb -- --id=<ids>
--only-geometry`, `npm run check:landmark-inventory`, `npm run check:osm-under-models`.
Report: branch, SHA, per-pand table, sheet paths, components, unfinished.
