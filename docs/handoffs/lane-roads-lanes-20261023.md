# Lane: roads, doubled lanes and strange paint (R2 + R3)

Plan §1 item 13. Rules: `LANE-RULES.md`. Model: opus. Needs R0's table.

## R2 — one carriageway, drawn once

In `src/canalRecall/ownGround/streets.ts` and `osmGround.ts`:

1. A way partly covered by a polygon of **any** class yields entirely inside
   the survey (today `coverWays` needs 80 % cover by a compatible class, so a
   part-covered way doubles up beside the polygon).
2. `laneRibbon` (red `cycleway=lane` from OSM tags) draws only where the BGT
   partition has no `cycle` polygon within 2 m **and** the orthophoto reads
   red there (reuse the tone sampling of `scripts/own-ground/road-look-v2.ts`).
   BGT's rijbaan already contains the painted lane; drawing the tag on top is
   the second lane people do not expect.
3. The LOD-1 far ring and the three cells without `roads-v1` draw one grey
   carriageway per way, no lane paint, no sidewalk prior.
4. New probe `scripts/own-ground/probe-doubled-lanes.ts`: ribbon triangles
   over `cycle`-class polygons, band triangles over any polygon; gate at 0 in
   `check-ground-cells`.

## R3 — paint only where something shows it

1. Keep only node-backed marks (`surveyMarkings.ts`); thin zebra clusters
   (Linnaeusstraat) to one per crossing node pair; centre dashes only where a
   sample along the centreline of the orthophoto shows a dashed line.
2. Decide the road grey and the cycle red from orthophoto medians at R0's
   spots (today asphalt luma 144 against the user's remembered ~150; red
   sampled from fietspad polygons in sun), and write both into
   `ownGround/groundLook.ts` with the measurement in a comment.
3. The user's strip: six spots, game frame beside orthophoto, before and
   after, one image. The user decides the grey and the red on that strip.

## Acceptance

Probe at 0; paint-off-evidence triangles at 0 at R0's spots; before/after
beside the orthophoto for every `ROAD_SPOTS` entry written to
`artifacts/roads/<spot>-vs-ortho.jpg` by `check-ground-cells` (that
artefact is the R4 gate); `npm run test:own-ground` and the own-ground e2e
specs alone; ride-perf unchanged. Nothing is called fixed before the user
has seen the strip.
