# Lane: BAG-keyed base tiles + `covers` (migration step 1, 2026-10-13)

Plan: `docs/plans/digital-twin-direction-20261013.md` §2 "Target architecture"
and migration step 1. Lane owns `scripts/build-bag-buildings.ts`,
`src/canalRecall/bag3dTiles.ts`, `bag3dTileIndex.ts`, `buildingTileSource.ts`,
`buildingTilesBrowser.ts`, a new facts sidecar, and the join checks. Do not
edit `game.js`, `index.html`, `package.json`, lockfiles, bundles, catalogues,
`TODO.md`, `HISTORY.md`; list integrator steps in the report. Flag-gated:
`?bagTiles=1`; with the flag off the game must render byte-identically.

## Why
The base building layer is OSM-keyed (336,784 buildings in z14 tiles, heights
only). Every landmark, recipe house, block face and `large` recipe must then
carry a hand-kept `suppressOsmIds` list (813 models, `check:osm-under-models`)
to hide the OSM extrusion under it. Keying the base tiles by BAG pand id makes
"this pand is covered by model X" a join, not a list, and gives every pand the
3DBAG facts (eaves, ridge, roof type, year) the mid-LOD descriptor needs.

## Deliverables
1. **BAG-keyed base tiles**: extend `build-bag-buildings.ts` to write z14 (or
   z15, measure) tiles keyed by `NL.IMBAG.Pand.*` with footprint, eaves/ridge
   from 3DBAG LoD1.2/2.2 (`bag3dCityJson.ts`), `bouwjaar`, roof type, and the
   OSM way/relation ids that overlap ≥ 60% (so the OSM-keyed consumers can keep
   working during the transition). Staging under `artifacts/bag-tiles/` first;
   report coverage (pands with 3DBAG facts / all pands; pands with no OSM
   match; OSM buildings with no pand) and gzip size against the current
   `buildings` tiles. Publish into `public/data/extracts/amsterdam/` only after
   the coverage report is in the handback.
2. **Facts sidecar** per tile: the ~40-byte mid descriptor inputs (archetype
   guess from `buildingAppearance.ts` era prior via `look/palette.ts` periods,
   storeys from eaves, roof type) so step 4 can read them without the CityJSON.
3. **`covers[]`**: a build-time join that maps every installed model
   (manual catalogue, ordinary catalogue, recipe houses, block faces, building
   types) to the pand ids it covers by footprint overlap (≥ 50% of the pand
   or the model footprint contains the pand centroid). Write
   `public/canal-drive/models/covers.json` (staging first) and a check
   `scripts/check-covers.ts` that compares it with today's `suppressOsmIds`
   via the OSM↔pand map from deliverable 1: list pands covered by a model but
   not suppressed today (hidden bugs) and OSM ids suppressed today with no
   covering model (stale entries). Numbers in the report.
4. **Runtime behind `?bagTiles=1`**: `buildingTileSource.ts` /
   `buildingTilesBrowser.ts` read the BAG tiles and hide pands in `covers`
   instead of filtering by `suppressOsmIds`. Same visual result on the seeded
   Anne Frank → Rijksmuseum ride (fixed-camera shots at 4 spots, compare with
   `scripts/compare-look-shots.mjs`, report pixel diffs).
5. Tests: unit tests for the join and the tile reader; a Playwright spec
   `tests/e2e/bag-tiles.spec.ts` (flag on vs off at two spots).

## Checks
`npm run lint`, `npm run check:osm-under-models`, `npm run test:osm-under-models`,
the new tests, `npm run check:canal`. Report: branch, SHA, coverage numbers,
sizes, pixel diffs, the integrator steps (bundles to rebuild, extracts to
publish), and anything you could not finish.
