# Lane: roads, the gaps (R1) — BGT islands, berms and squares into roads-v1

Plan §1 item 13. Rules: `LANE-RULES.md`. Model: haiku (data lane). Starts
after R0's table says where the bare land is; do not wait for it to fetch.

`roads-v1` (`scripts/own-ground/fetch-bgt-roads.ts`, `build-bgt-roads.ts`,
schema `src/canalRecall/ownGround/roadCells.ts`) carries only BGT `wegdeel`.
Traffic islands, berms, parking verges (`ondersteunendwegdeel`) and paved
squares, forecourts and yards (`onbegroeidterreindeel`, verhard classes) were
never fetched for roads, so they draw as bare land or as the OSM fallback.
This is phase 3 of `docs/plans/road-surfaces-roof-rules-20261016.md`.
Raw pulls for parks and courtyards already exist in the source archive
(`~/Code/map-recall2-source-data/datasets/`); `scripts/own-ground/add-bgt-courtyards.ts`
is the staging pattern.

## Steps

1. Fetch city-wide `ondersteunendwegdeel` and verhard `onbegroeidterreindeel`
   (PDOK BGT, CC0) into the source archive, same cell grid as `roads-v1`.
2. Extend the cell schema with classes `island | berm | verge | square`
   (mesh from `fysiekVoorkomen`: klinker, tegels, asfalt, gras/groen), bump the
   version, keep old cells readable; `topoSimplify.ts` shares edges with the
   `wegdeel` rings.
3. Runtime (`roadSurfaces.ts`): draw them at the foot lift with kerbs where
   they meet a carriageway; green classes take the park grass material;
   pockets are skipped where a new polygon exists.
4. Metric in `scripts/own-ground/check-ground-cells.ts`: bare land within 6 m
   of a carriageway, m² per cell and city total; print before/after.
5. `npm run test:own-ground`; the own-ground e2e specs on your port, alone;
   the triangle budget gate (≤ 1.15× per cell) must still pass: report the
   worst cells.

## Acceptance

City-wide bare-land-near-carriageway down ≥ 80 %; the Mosplein roundabout
centre and the Linnaeusstraat berms drawn; before/after frames beside the
orthophoto at R0's spots (`artifacts/roads/gaps/<spot>.png`). Extract size
and cell build time in the report.
