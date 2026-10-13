# Lane: Amsterdam fire stations as large recipes (content, 2026-10-13)

The police bureaus went through two passes (`lane-police-bureaus-20261013.md`,
`lane-police-bureaus-2-20261013.md`, both merged): a match script
(`scripts/landmarks/police-stations-match.ts`: OSM `amenity=police` →
PDOK Locatieserver → BAG WFS → pand ids, written to
`scripts/landmarks/police-stations.json`), then `kind: large` recipes on the
3DBAG massing (`src/canalRecall/buildingRecipe/{largeIntent,fitLarge,largeCompile,largeGates}.ts`,
install path in HISTORY "large tier"), with the building's signature
elements modelled from the panoramas (user rule 2026-10-13: inventory
ornaments, signs and reliefs from photos and model them). Fire stations are
next on the public-buildings list (TODO "Public buildings, next": 19 matched
in 2026-10-03 staging that no longer exists; re-match). Three bespoke fire
stations already exist (`fire-station-anton`, `fire-station-hendrik`,
`fire-station-willem` builders; the Hendrik and Willem lanes are the photo
sourcing template: Amsterdam panoramas CC BY 4.0 via `scripts/pand-reference`).

Lane owns: a `fire-stations-match.ts` (copy the police one, `amenity=fire_station`,
Amsterdam only: Brandweer Amsterdam-Amstelland kazernes inside the
municipality; drop Amstelveen/Diemen/Zaanstad/Weesp), `scripts/landmarks/fire-stations.json`,
the recipes, any new large-tier component (with a test; default compose
byte-identical), contact sheets. Tag entries `publicBuilding: fire` in
`landmark-backlog.json` via `build-poi-backlog.ts`. Do not edit `game.js`,
`index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`; catalogue
entries go in your branch's `manualCatalogue.json` only through the large
tier's install path (the integrator merges catalogues by id). Open data only.

## Deliverables
1. The match: every Amsterdam kazerne with pand ids, panorama years,
   reference status; skip the three bespoke ones.
2. Recipes for the rest, most central and most photographed first
   (Dirk, Nico, Teunis, Victor, Pieter, Osdorp, Zebra, IJsbrand, Diemen-not).
   Signature elements per station, listed as modelled / simplified /
   skipped with a reason: the red roller doors (glass colour per row fix
   from the fire-station kit), the "BRANDWEER" lettering or plate, the
   hose/drill tower where one exists, the canopy, any crest or relief.
   Where a kazerne shares a pand, model the whole pand and say so.
3. Per station: pand, triangles (≤ 12k), gates, `audit:glb --only-geometry`
   pass, contact sheet (ortho + panorama + render), signature-inventory
   JSON (`scripts/landmarks/<id>-inventory.json`, the gate in
   `landmark-inventory-gate.ts`).

## Checks
`npm run lint`, `npm run test:large-tier` (or the large-tier test script in
`package.json`), `npm run audit:glb -- --id=<ids> --only-geometry`,
`npm run check:landmark-inventory`, `npm run check:osm-under-models`.
Report: branch, SHA, per-station table, sheet paths, components added,
unfinished.
