# Lane: libraries and civic offices as large recipes (content, 2026-10-13)

The fire stations (13 kazernes, bespoke, `scripts/landmarks/firestations-inventory.json`)
and the police bureaus (17, `police-stations.json`, large recipes) are done.
Next public buildings: the **OBA library branches** (`amenity=library`,
operator OBA; ~25 in Amsterdam; only `oba-oosterdok` is modelled) and the
**civic offices** (`office=government`: the seven stadsdeelkantoren /
stadsloketten such as Stadsloket Centrum on the Amstel 1 side of the
Stopera, Stadsdeelkantoor West at Bos en Lommerplein, Oost at
Oranje-Vrijstraatplein, Zuid at President Kennedylaan, Noord at Buikslotermeerplein,
Nieuw-West at Osdorpplein, Zuidoost at Anton de Komplein). Same pipeline as
the police lanes (`lane-police-bureaus-20261013.md`, `-2-`): a match script
(copy `police-stations-match.ts`; OSM via Overpass with a mirror fallback,
PDOK Locatieserver, BAG WFS → pand ids; drop Amstelveen/Diemen/Weesp/Zaanstad),
then `kind: large` recipes on the 3DBAG massing
(`src/canalRecall/buildingRecipe/{largeIntent,fitLarge,largeCompile,largeGates}.ts`)
with the signature elements inventoried from the panoramas (OBA lettering,
the stadsdeel logo band, canopies, reliefs) and modelled. Check the
catalogue first for anything already modelled (`manualCatalogue.json`).

Lane owns `scripts/landmarks/libraries-match.ts`, `civic-offices-match.ts`,
their JSON lists, the recipes and inventories, any new component (with a
test; default compose byte-identical), contact sheets; tag the entries
`publicBuilding: library|civic` in `landmark-backlog.json` through
`build-poi-backlog.ts`. Catalogue entries only through the large tier's
install path. Do not edit `game.js`, `index.html`, `package.json`, bundles,
`TODO.md`, `HISTORY.md`. Open data only. Your worktree needs
`node_modules` linked: `ln -s /Users/blackmad/Code/map-recall2/node_modules node_modules`
if it is missing.

## Deliverables
1. The two match files with pand ids, panorama years, reference status.
2. Recipes, most central and most photographed first: Stadsloket Centrum,
   OBA Javaplein, OBA Olympisch Kwartier, OBA De Hallen (inside De Hallen:
   skip if the hall model covers it), OBA Linnaeusstraat, OBA Mercatorplein,
   OBA Waterlandplein, OBA Slotermeer, then the stadsdeelkantoren.
   Signature elements listed as modelled / simplified / skipped with a
   reason. Where a branch shares a pand with housing or a mall, model the
   whole pand and say so (or skip with the reason if it is a mall).
3. Per building: pand, triangles (≤ 12k), gates, `audit:glb --only-geometry`
   pass, contact sheet, inventory JSON.

## Checks
`npm run lint`, the large-tier tests, `npm run audit:glb -- --id=<ids>
--only-geometry`, `npm run check:landmark-inventory`, `npm run check:osm-under-models`.
Report: branch, SHA, per-building table, sheet paths, components, unfinished.
