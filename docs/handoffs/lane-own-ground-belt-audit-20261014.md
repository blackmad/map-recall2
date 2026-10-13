# Lane: own-ground belt audit findings and the far field (ground, 2026-10-14)

Open items from the own-ground board (TODO "Own ground after the 2026-10-13
lanes"): (1) `check:own-ground-belt` reports 15–18 findings where tram rails
top the street probe on bridges (BRU0030, BRU0041, BRU0001…): decide whether
the audit should count `tram` as a street surface or the rails should sit
below the deck top, fix one of the two and make the belt audit clean; (2)
land shows at Rozengracht corners with no mapped sidewalk: fill the corner
between two sidewalks with pavement when both kerbs meet within 6 m; (3)
the Melkmeisjesbrug's water polygon stops at the bridge so a quay wall and
a land strip cross the canal under it: extend water under footbridges
whose deck spans mapped water on both sides (data fix in the water layer
or a rule in `streets.ts`/`decks.ts` consumer, not in the bridge kit); (4)
a coarse far ring beyond the 2,000 m resident cap: one low-poly land/water/
park/street-band mesh per 2 km cell at ≤ 20k tris so aerial views over
Nieuw-West and Noord have no visible edge, measured in MB and ms; (5) the
hidden OSM park fill under BGT park surfaces (20–160k tris per park cell):
skip it where the BGT polygons cover ≥ 90 % of the park. Inputs:
`src/canalRecall/ownGround/*`, `scripts/own-ground/check-ground-cells.ts`,
`check-own-ground-belt`, the defects lane's `residency.ts` and the parks
lane's `parks.ts` (HISTORY 2026-10-13/14). Own-ground bundles rebuilt
locally only; do not edit `bridgeKit.ts` beyond the one consumer line.

## Checks
`npm run lint`, `npm run test:own-ground`, `npm run check:own-ground-cells`,
`npm run check:own-ground-belt` (clean), `OWN_GROUND=1 PW_PORT=<yours> npx
playwright test own-ground-game own-ground-defects own-ground-parks --project=desktop`.
Report: branch, SHA, per-item before/after, the far-ring cost table, shots,
unfinished.
