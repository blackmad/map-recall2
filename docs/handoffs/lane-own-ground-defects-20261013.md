# Lane: own-ground defects before the belt default-on (ground, 2026-10-13)

Own ground (`?ownGround=1`, `src/canalRecall/ownGround/*`, bundles via
`node scripts/build-3d-bundles.mjs --only=own-ground-game,own-ground-worker`)
is the default-on candidate for the canal belt on desktop. TODO.md "Own
ground after the 2026-10-13 lanes" lists what still shows. This lane takes
the four visual defects; perf, hosting quota and physics stay on the board.

Inputs: `streets.ts` (cross-section bands: carriageway lift 0.03, cycle
0.036), `groundCell.ts`, `decks.ts` (bridges, movable frames),
`gameGround.ts` (materials, `STREET_GROUND`/`GROUND_TONES`), `drape.ts`,
`roadRegressions.ts` (named regression spots; add to it), the OSM cells in
`public/data/extracts/amsterdam/own-ground/`, `scripts/own-ground/*`
(`check-ground-cells.ts`, `audit-belt.ts --probe`). Lane owns
`src/canalRecall/ownGround/*`, its tests, the own-ground extract builder
and the ground specs; ≤ 10 reported lines in `vector-map.js`. Do not edit
`game.js`, `index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`.

## Deliverables
1. **Junction cycle-lane smear** at Rozengracht/Marnixstraat (and the brown
   holes there): the red cycle bands at lift 0.036 over carriageway 0.03
   are coplanar at junction polygons. Build the junction disc from the
   cross-sections once (the roads lane's junction polygons), clip the cycle
   bands at the disc edge, and give every layer an offset rank that the
   depth buffer separates at 300 m (measure with the z-fight calibration:
   ≥ 3 cm, or polygonOffset). Pin the junction in `roadRegressions.ts`.
2. **De Clercqstraat `area:highway`**: keep the value but draw carriageway
   areas as asphalt (and cycleway areas as red asphalt), not square paving;
   pin De Clercqstraat 22–2 and the Bilderdijkstraat crossing.
3. **Far-ring cells pop in with no fade**: fade a cell's materials over
   ~400 ms on arrival (opacity ramp or a one-frame-per-cell stagger), no
   per-frame cost when idle; measure with the ride-perf spec.
4. **Magere Brug's two movable frames read as one white gantry**: the
   extract needs `bridge:movable` and `colour` refetched (the bridge is
   white, the frames are two separate balance-beam gantries 4 m apart);
   draw them as two; railings take `colour` when tagged (Magere Brug white,
   most belt bridges dark green); pin BRU0044/Magere Brug in the bridge
   regressions. BRU0077's suspect 1.7 m hump: check the measured deck
   against AHN and pin or correct.

## Checks
`npm run lint`, `npm run test:own-ground`, `npm run check:own-ground-cells`,
`npm run check:own-ground-belt`, `OWN_GROUND=1 PW_PORT=<yours> npx
playwright test own-ground-game --project=desktop`, before/after shots at
each spot (chase and 300 m). Report: branch, SHA, shots, the
`vector-map.js` lines, perf delta, unfinished.
