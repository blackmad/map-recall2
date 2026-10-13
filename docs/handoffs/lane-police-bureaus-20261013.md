# Lane: police bureaus as `kind: large` recipes (content, 2026-10-13)

Plan: `docs/plans/digital-twin-direction-20261013.md` §7 "To-build list
additions: police stations"; `docs/buildings-pipeline.md` "Large tier";
`scripts/building-recipes/README.md`. The first customer,
`politie-van-leijenberghlaan`, is installed on main (2026-10-13) and is the
template: `scripts/building-recipes/houses/politie-van-leijenberghlaan/`.
Lane owns new recipe folders under `scripts/building-recipes/houses/`, the
police components in `src/canalRecall/blockBuilding/components.ts` where a
station needs more, and `scripts/landmarks/build-poi-backlog.ts` tagging. Do
not write to catalogues or `public/` models, `game.js`, `index.html`,
`package.json`, bundles, `TODO.md`, `HISTORY.md`; the integrator installs with
`scripts/building-recipes/install-large.ts --house=<id> --install` from your
report. Open data only: BAG, 3DBAG, Amsterdam panoramas (CC BY 4.0, via
`npm run pand-reference`), OSM `amenity=police`.

## Deliverables
1. **The list**: every Amsterdam police bureau (OSM `amenity=police` within
   the municipality, plus the Politie location list if open) matched to its
   BAG pand(s) by address/centroid. Write `scripts/landmarks/police-stations.json`
   (name, address, pand ids, OSM id, panorama years available, which police
   signature elements the panoramas show: striped band, blue lamp, canopy,
   garage doors, lettering). Expect ~23; report how many matched cleanly.
2. **Backlog tag**: add them to `landmark-backlog.json` via
   `build-poi-backlog.ts` with `publicBuilding: police` so
   `landmark-queue.html` can filter them (report the diff; the integrator
   commits the generated file).
3. **Recipes**: author `large` recipes for as many bureaus as pass the gates
   in the lane's time, starting with the ones that *do* show the signature
   elements (so the police kit is exercised on real walls), then the plain
   blocks. Per bureau: intent JSON with `notes` citing the panoramas, all
   gates pass, `audit:glb` PASS, contact sheets under
   `artifacts/building-recipes/<id>/`. Extend the kit components where a
   bureau needs it (e.g. a corner entrance, a drive-through canopy) and keep
   the default compose output byte-identical (`npm run test:block-kit-installed`).
   Skip the Elandsgracht headquarters: it is a bespoke-builder item.
4. **Report** per bureau: pand, triangles, gates, audit score, sheet paths,
   what the panorama shows vs what the recipe has, and the install command.

## Checks
`npm run lint`, `npm run test:building-recipes`, `npm run test:fit-golden`
(re-record with `--write` only for new houses; no existing hash may move),
`npm run test:geometry-audit`, `npm run test:block-kit-installed`,
`npm run audit:glb -- --id=<id>` per bureau.
