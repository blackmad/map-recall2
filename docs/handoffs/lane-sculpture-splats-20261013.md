# Lane: sculpture splats and impostors, De Dokwerker pilot (2026-10-13)

Plan: `docs/plans/digital-twin-direction-20261013.md` §7 "Sculpture splat
track continues"; `docs/landmark-splat-reference-pilot.md`; TODO
"Sculptures and statues → splats/impostors" (38 backlog items tagged
`treatment: sculpture`, filter "Sculpture (splat)" in `landmark-queue.html`).
Open data only: Wikimedia Commons photos (record licence per file, CC BY /
CC BY-SA / PD only), Amsterdam panoramas (CC BY 4.0, crops via
`npm run pand-reference` / the pano lookup in `docs/research/amsterdam-open-sources-20261009.md`),
no Google or Apple imagery. Desktop first (user: ~10× iPhone); record the
iPhone-4× number as pending.

Lane owns `src/canalRecall/sculptures/*`, `scripts/sculptures/*`,
`public/canal-drive/sculptures/` (new), a mount behind `?sculptures=1` (≤ 20
lines in `vector-map.js` or the landmark layer, reported). Do not edit
`game.js`, `index.html`, `package.json`, bundles, catalogues, `TODO.md`,
`HISTORY.md`. Flag off byte-identical.

## Deliverables
1. **Photo set for De Dokwerker** (Jonas Daniël Meijerplein): every usable
   Commons photo + panorama crop with licence and author in
   `scripts/sculptures/dokwerker/sources.json`. Report the count and angular
   coverage; 30–60 photos spanning the statue is the splat threshold.
2. **Reconstruction**: if the set is sufficient, a Gaussian splat (any open
   pipeline you can run locally with `uv run`; record the exact tool and
   version; keep raw outputs out of the repo, archive them to
   `~/Code/map-recall2-source-data/experiments/sculptures/dokwerker/`
   per the archive rule) pruned to the statue, ≤ 150k splats, with the
   plinth as a mesh. Otherwise a **baked impostor**: 8–16 views rendered to a
   sprite sheet from the best available photos, billboarded, with a mesh
   plinth. Either way the existing hand model stays as the far LOD.
3. **Runtime**: a small three.js splat or impostor renderer in the shared
   frame (`rendererShared`), shown within ~50 m, swapped to the hand model
   beyond; picking returns the landmark id. Measure desktop ms per frame
   with and without, at the statue; `scripts/ride-perf-fixed-route.mjs` for
   the ride, a Playwright shot for the look at 1.7 m and at gallery size.
4. A `docs/sculptures.md` page: pipeline, licences, numbers, what the next
   37 need.

## Checks
`npm run lint`, new unit tests for the loader/LOD switch, a Playwright spec
`tests/e2e/sculptures.spec.ts` (flag off pixel-identical at the square, flag
on shows the statue). Report: branch, SHA, photo coverage, the chosen path and
why, perf numbers, shots, what is unfinished.
