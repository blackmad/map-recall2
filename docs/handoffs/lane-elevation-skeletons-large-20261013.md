# Lane: the 25 elevation skeletons as `kind: large` recipes (content, 2026-10-13)

Inputs: `scripts/landmarks/*-elevations.json` (25 facade skeletons with
photos under `artifacts/landmark-lanes/<id>/` in the main checkout; copy what
you need), `docs/buildings-pipeline.md` "Large tier",
`scripts/building-recipes/README.md`, the installed large customers
(`scripts/building-recipes/houses/{politie-van-leijenberghlaan,leidsestraat-67-large,de-balie-large,social-history-large,politie-oost-zeeburg,politie-zuidoost-gaasperdam}/`),
and the Hoofdbureau builder for how a bespoke builder calls the large systems
(`scripts/landmarks/hoofdbureau-elandsgracht-builder.ts`, `largeCompile.ts`
hooks). Lane owns new recipe folders under `scripts/building-recipes/houses/`
and any new facade-system components in `src/canalRecall/blockBuilding/`
(default compose output must stay byte-identical:
`npm run test:block-kit-installed`). Do not write to catalogues or `public/`
models, `game.js`, `index.html`, `package.json`, bundles, `TODO.md`,
`HISTORY.md`; the integrator installs with
`scripts/building-recipes/install-large.ts --house=<id> --install` and
rebuilds `covers.json` and the signature bundle.

## Deliverables
1. Triage the 25 skeletons: which already have a hand model on main (skip
   those — list them), which have a usable front photo, which need a second
   front (a front-only recipe fails the blank-wall gate on a long side wall;
   check `npm run pand-reference -- <pand>` for a second panorama).
2. Author `large` recipes for every skeleton that can pass the gates, most
   photographed first. Use the elevations file's rhythm (bays, storeys,
   openings per row) as the intent; where a feature has no component
   (arched portal, colonnade, curved front) add the component once in
   `components.ts`/`compose.ts` with a test, so every later building gets it.
   Per recipe: intent `notes` citing panorama ids and licence (CC BY 4.0),
   gates pass, `audit:glb` PASS, `compare:facades` where the rhythm spec
   exists, contact sheets under `artifacts/building-recipes/<id>/`.
3. Report per building: pand, triangles, gates, audit score, what the photo
   shows vs what the recipe has, sheet paths, install command; and the
   component additions with before/after `test:block-kit-installed` output.

## Checks
`npm run lint`, `npm run test:building-recipes`, `npm run test:fit-golden`
(record new houses with `--write`; no existing hash may move),
`npm run test:geometry-audit`, `npm run test:block-kit-installed`.
