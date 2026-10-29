# Lane: ground from a raster — a measured spike, not a rollout

Rules: `LANE-RULES.md`. Plan: `slop-newyork-plan-20261029.md` §4 lane F.
Evidence: `docs/research/slop-newyork-20261029.md` §4. Model: opus for the
method and the reading; haiku for the sheets. Standing user rules: roads
are judged beside the orthophoto or panorama, never presented as fixed
(2026-10-24); no per-junction photo-judged road lanes, cheap city-wide
fixes welcome (2026-10-25).

## What slop does

Blocks, curbs and sidewalks are not offset polygons; they come from a
raster. Erode the shoreline 20 m with an exact distance transform, stamp
every roadway on a 1 m raster as a capsule of half its curb-to-curb width,
label the 4-connected components (curb islands), trace each with a corner
walk, remove stair steps, RDP at 0.5 m, erode by the sidewalk width with a
square kernel so grid blocks stay rectangular (`tools/geo-blocks.mjs`). The
shoreline itself is rasterised at 2 m, piers subtracted, opened 9 m and
closed 5 m so necks, fender lines and pile fields vanish
(`tools/geo-base.mjs:350-372`). Then the **drivable network is derived from
the rendered ground**: corridors from the modal curb gap, junctions
union-found under 14 m, bends over 12° as shape nodes, and only the largest
strongly connected component kept, so no car can reach a dead end
(`js/road-network.js`). Road paint is generated from that network with the
dashes in the shader (per-quad u, period, duty; `fwidth` box filter;
≥ 1.5 px widening).

## Three cheap, city-wide questions

1. **Does a raster give a cleaner kerb line than BGT + OSM bands at the
   13 ROAD_SPOTS?** `scripts/own-ground/raster-blocks-spike.ts`: BGT land
   and water plus OSM carriageway centrelines stamped as capsules at the
   measured widths (`bgt-width-by-class.json`, the staged
   `bgt-way-widths.json`), 0.5 m raster, EDT, open/close radii as the
   measured tolerance, label, trace, destair, RDP. Output per spot: a sheet
   orthophoto | today | raster at the same camera, and a table of bare land
   m², kerb breaks, sidewalk area, triangles. Spiegelgracht's ~500 m² paved
   corner and De Clercqstraat's bare land are the two to watch.
2. **Where does our car graph have unreachable or dead-end components?**
   SCC analysis of `routing/roadGraph.ts` for the car and bike graphs; list
   components by size with a street name each; compare with
   `test:reachability` and the named `check-canal-car` locations. Pure
   analysis, one table, no code change in the game.
3. **Would shader dashes cut mark geometry?** Count triangles of the
   `blocks` kind in `ownGround/roadMarks.ts` at the 13 spots and estimate the
   quad count with per-quad (u, period, duty) attributes; a 50-line GLSL
   prototype on one cell is enough.

## Not in scope

Installing anything. Changing the look. Judging a junction without its
photo beside it.

## Acceptance

The sheets and the three tables in the hand-back; the user decides whether
question 1 becomes a lane. A finding of "BGT already beats the raster at
all 13 spots" is a good outcome.

## Checks

`npm run lint`; `npm run test:own-ground`; `npm run check:own-ground-cells`
(unchanged, since nothing is installed).
