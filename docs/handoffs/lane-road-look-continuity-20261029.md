# Lane: road look, one grey per level and edges that survive the phone

Rules: `LANE-RULES.md`. Model: **opus** (judgement, the tone and edge
decisions, the strip reading); haiku for the sheets and the data refetch.
Branch `lane/road-look-continuity-20261029`. Budget: one opus session, one
haiku session for step 5's data.

User 2026-10-29, iPhone screenshot riding north on the Witte de Withstraat at
the Van Kinsbergenstraat tram stop (An-Nour mosque): "the roads still look
weird and half broken, like why isn't the grey continuous? … focus on the
look over accuracy". Standing rules still apply: the strip is judged beside
the orthophoto and the user decides tones (2026-10-24); city-wide fixes, no
per-junction photo lanes (2026-10-25). This brief trades accuracy for look
where it says so.

## What the frames say (do not re-diagnose; verify by rendering)

Spot `witte-de-withstraat-van-kinsbergenstraat` is pinned in
`src/canalRecall/ownGround/roadRegressions.ts` ROAD_SPOTS (user frame, source
map, orthophoto and desktop/iPhone frames in
`artifacts/roads/diagnose-20261029/` and `artifacts/own-ground-roads/witte-20261029/`).

- **The partition is fine; the drawing is not.** R1 gaps 14.7 m², R2 lanes 0,
  R3 paint 3.7 m², no doubled ribbons. BGT carriageway is one continuous
  polygon through the junction.
- **Seven greys, one invisible edge.** Within the 90 m box the ground draws
  asphalt 146/144/137, pavement 183/174/161, island paving 194/184/167,
  square 198/187/169, land 185/174/156, brick 162/155/147 and the OSM parking
  126/125/120 (`groundLook.ts` bright), each its own material (`gameGround.ts`
  makeMaterials, `roadSurfaces.ts` surfaceLayer). The joins *within* the
  pavement level are visible (pale wedges at the corners, the square against
  the footway); the step *between* levels is a 0.15 m granite line plus a
  0.14 m shadow tint (`roadSurfaces.ts` KERB_LINE_M, KERB_SHADOW_M), under a
  pixel from the phone chase camera. So the road grey runs into the pavement
  grey and stops at the next material: that is "not continuous".
- **The asphalt is as light as the pavement.** Luma 144 against 175 after the
  flat-ground gain; the neighbourhood card's own photo of this junction shows
  dark asphalt against light pavements.
- **No tram rails on a tram street.** OSM way 323258151 has no
  `embedded_rails`; `streets.ts` L540 draws rails only from that tag and
  `scripts/own-ground/fetch-osm-ground.ts` never fetches `railway=tram`.
- **Red stops in notches** at every junction mouth (BGT: the crossing is
  rijbaan); the corner islands/berms draw as pale paving wedges into the
  junction.
- **Saturated lawn in every courtyard** (OSM `leisure=garden`/`grass` →
  `osmGround.ts` kind park, drawn with the park lawn material) against the
  grey corridor.

## Steps, in order of look per token

1. **One material per level.** In `surfaceLayer`: every pavement-level class
   (foot, pedestrian, island, berm, paved verge, square, driveway) draws the
   one `paving` material; every carriage-level class draws asphalt or klinker
   by surface only (parking bays included; no `brick`). Land within 4 m of a
   road polygon takes the pavement tone. Grass verges stay lawn. Count the
   materials touching each ROAD_SPOTS box before and after (target ≤ 4:
   asphalt, klinker, paving, cycle, plus lawn/water).
2. **Edges that survive the phone.** Make the level step read at chase
   distance: the kerb shadow becomes a gradient on the carriageway side
   (KERB_SHADOW_M 0.14 → ~0.45, vertex tint ramping from the groove tone to
   none; the kerb mesh already carries vertex colours, L483–L557) and the
   granite line 0.15 → 0.25 m. Measure ground pixels per metre at the
   junction centre on the iPhone project frame and size the two so the edge
   is ≥ 1.5 px there. If geometry cannot do it, prototype an `fwidth` edge in
   the ground shader on one cell and report the cost; do not ship it in
   this lane.
3. **Carriageway darker than pavement.** Three asphalt lumas on the strip,
   today's 144 and two darker (about 130 and 118) with the pavement unchanged;
   the C1 klinker/cycle tones of issue #7 stay. The user picks on the strip.
4. **Red through the junction (look over accuracy).** Where an OSM cycleway
   or `cycleway=track` way continues through a junction node (both sides
   within 25 m, straight within 30°), draw a red band the fietspad's width
   over the carriageway at the cycle-lane lift, clipped to the carriageway
   polygon, instead of the notch. Keep the zebra over it. Count bands drawn
   and skipped city-wide.
5. **Tram rails from `railway=tram`** (haiku, data): add `way[railway=tram]`
   to the fetch, version the extract, and draw grooves along them in
   `streets.ts` where over a carriageway polygon (the existing clip). Report
   tram streets gained (Witte de Withstraat, Jan Evertsenstraat, …) and the
   triangle delta.
6. **Courtyard green.** An OSM park/grass/wood area that touches no road
   polygon within 3 m is a courtyard: draw it in a muted garden tone (lawn
   desaturated ~40 %, luma −15) with no mowing stripes. Parks unchanged.
7. **Asphalt grain on phones.** If the strip shows blotching at phone scale,
   halve `mottle` (2.5 → 1.25) in `gameGround.ts` asphalt; otherwise leave it.

## Not in scope

New BGT data; per-junction photo fixes; the ground-raster spike (lane F);
paint rules (R3); `game.js`, `index.html`, bundles, goldens, TODO/HISTORY.

## Acceptance

One strip, orthophoto | before | after, desktop **and** iPhone frames, at
`witte-de-withstraat-van-kinsbergenstraat`, `kinkerstraat-bilderdijkstraat`,
`haarlemmerplein`, `spiegelgracht-prinsengracht`,
`ceintuurbaan-van-woustraat` and `mosplein`, plus the user's screenshot
beside the after iPhone frame of the Witte de Withstraat
(`scripts/own-ground/road-strip.ts frames`, `scripts/ground-look-sheet.mjs`
with `--region` luma tables for road and pavement). Three asphalt lumas on
one extra row. Nothing is called fixed before the user has looked at the
strip. Gaps (R1) must not grow at any spot; ride-perf p95 and the iPad
triangle count within their budgets.

## Checks

```
npm run lint
npm run test:own-ground
npm run check:own-ground-cells
npx tsx scripts/own-ground/render-road-sources.ts --out=artifacts/roads/diagnose-<date>
OWN_GROUND=1 PW_PORT=<port> ROADS_ONLY=<ids> /tmp/canal-pw.sh npx playwright test own-ground-roads --project=desktop --project=iphone --grep "roads: shots"
PW_PORT=<port> /tmp/canal-pw.sh npx playwright test ride-perf
```

## Hand back

The LANE-RULES block, plus: materials per spot before/after, kerb edge px on
the iPhone frame, red bands drawn/skipped, tram streets gained, triangles and
ride-perf before/after, and the strip path. Integrator rebuilds
`node scripts/build-3d-bundles.mjs --only=own-ground-game,own-ground-worker`
and re-aims any golden the strip changes.
