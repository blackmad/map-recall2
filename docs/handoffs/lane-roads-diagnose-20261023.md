# Lane: roads, diagnose by source layer (R0)

Plan §1 item 13. Rules: `LANE-RULES.md`. User 2026-10-23: "our roads still
look like shit: too many weird gaps and strange paints and multiple lanes
where people don't expect". Standing rule (memory, 2026-10-16): road work is
judged beside the 8 cm PDOK orthophoto or a municipal panorama at a named
spot; a bug list all green is not acceptance.

What the survey found (do not re-survey; verify by rendering):
- BGT roads are the default since 2026-10-16 (`src/canalRecall/ownGround/gameGround.ts`,
  `?roads=0` opts out): `roads-v1` holds only `wegdeel`, 291 cells, 224k
  polygons (`src/canalRecall/ownGround/roadCells.ts`, `roadSurfaces.ts`).
- Still drawn **over** the polygons from OSM tags (`ownGround/streets.ts`,
  `osmGround.ts`): red `cycleway=lane` ribbons (`laneRibbon`), bands for any
  way less than 80 % covered by a polygon (`coverWays`), full lane-painted
  bands in the LOD-1 far ring and the three cells without the extract, tram
  rails, pockets (`pockets.ts`).
- Paint on the survey comes from OSM nodes (`surveyMarkings.ts`: zebras,
  stop lines, teeth, centre dashes on ≥ 6 m two-way carriageways), fietsstraat
  red per section, klinker tones redder than the orthophoto.
- Never fetched: `ondersteunendwegdeel` (islands, berms, verges) and verhard
  `onbegroeidterreindeel` (squares); ~12,000 m² of berms and tree pits the
  bands used to pave draw as bare land.

Model: opus, one session.

## Steps

1. Extend `scripts/own-ground/render-topdown.ts` (or write
   `render-road-sources.ts`) to colour each ground pixel by its source: BGT
   polygon class, pocket, OSM band fallback, cycle ribbon, node paint,
   fietsstraat red, rails, bare land. Render it at: Kinkerstraat ×
   Bilderdijkstraat, Marnixstraat busway, Rozengracht × Marnixstraat, De
   Clercqstraat × Bilderdijkstraat, Linnaeusstraat, Mosplein, one Nieuw-West
   junction (Osdorper Ban) and one Zuid junction (Ceintuurbaan × Van
   Woustraat), each beside the orthophoto crop and the game frame.
2. Table per spot: m² per source class, m² of bare land within 6 m of a
   carriageway, count of cycle-ribbon triangles over a `cycle` polygon, count
   of paint triangles off node evidence.
3. Rank the three complaints by m² and say which lane (R1 gaps, R2 lanes, R3
   paint) owns the largest share at each spot. Add the spots to `ROAD_SPOTS`
   in `src/canalRecall/ownGround/roadRegressions.ts`.

## Acceptance

One sheet per spot (`artifacts/roads/diagnose/<spot>.png`: sources |
orthophoto | frame), the table, the ranked causes. No fixes in this lane.
