# Lane: ground data for own-ground default-on (2026-10-13)

Plan: `docs/plans/digital-twin-direction-20261013.md` §3 (R3). Lane owns
`scripts/own-ground/*`, `scripts/elevation/*`, `src/canalRecall/ownGround/*`
data and extracts under `public/data/extracts/amsterdam/{ground-height-v1,
own-ground-osm-v1,elevation-v1}` via staging + report. Open data only
(PDOK/AHN/BGT/waterschap). No `game.js`/`index.html`/bundles/TODO/HISTORY.

## Tasks, in order
1. **Per-polder water levels.** Source: the waterschap peilgebieden open
   dataset (AGV/Waternet "peilbesluiten"/"peilgebieden", via PDOK or the
   waterschap WFS; record the URL and licence in the report). Join each
   elevation-v1 water polygon to its peilgebied; store `waterLevelNap` per
   water polygon (or per 1 km cell when uniform). `groundStore.ts` /
   `water.ts` read it instead of the single `WATER_Z = -1.77`. Regression:
   Osdorpplein rider surface (−2.17 m) must sit above its local water;
   canal belt stays at −1.77 relative to +1.37 NAP datum. Named test in
   `ownGround.test.ts`.
2. **Width per way from BGT.** For every way in `own-ground-osm-v1/cells`,
   sample the BGT `wegdeel` (and `voetpad`/`fietspad` where separate)
   polygon width at the way midpoint offline (PDOK OGC API
   `api.pdok.nl/lv/bgt/ogc/v1`; cache responses under
   `artifacts/own-ground/raw/bgt`). Store one `widthM` (+ `sidewalkM`,
   `cycleM` when found, and `source: bgt|tag|prior`) per way. Report coverage
   (% ways with a BGT width) and the distribution vs the current priors.
   `osmGround.crossSection` prefers it. Provide the same field for the 2D
   physics table consumer (`constants.js ROAD_WIDTHS` reader) as a JSON the
   integrator can wire.
3. **AHN profiles for the 891 unmeasured bridge footprints** using the
   `feat/measured-bridges` pipeline (`scripts/elevation/`, see
   `docs/elevation.md` Data). Output into staging `bridge-surfaces-v2.json`
   with a report (how many got a hump > 0.3 m). Movable bridges stay flat
   unless measured.

## Checks
`node --import tsx --test src/canalRecall/ownGround/ownGround.test.ts`,
`npm run test:canal-elevation`, `scripts/own-ground/check-ground-cells.ts --all`,
`OWN_GROUND=1 PW_PORT=<private> npx playwright test own-ground-game`. Return
SHA, reports and extract size deltas (hosting budget is tight: say the MB).
