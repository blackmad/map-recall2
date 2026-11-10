# Feedback triage, 2026-11-10 (lane feedback-triage-20261110)

Seven in-game notes from build 6a901ba (2026-11-09, desktop Free Ride, chase view, storybook look). Each note carries
`context.player` (game px, 3 px per metre) and `context.mapCenter` (lng/lat of the camera). The rider's lat/lng is
mapCenter plus (player - camera) / 3 m: that is how the positions below were derived. Evidence images are in
`/Users/blackmad/Code/map-recall2-screenshots-a1/feedback/2026-11-10-triage/` (`evidence/`: the user shots, the PDOK
luchtfoto with BAG/3DBAG footprints drawn in yellow, the 2025-09-29 panorama; `before/`: ride frames at the user's pose
when the browser queue allowed, see the end).

Probes added (evidence tools, not shipped logic): `scripts/feedback/probe-routing-near.ts` (routing ways near a point),
`scripts/feedback/footprints-near.ts` (BAG/3DBAG tile footprints as GeoJSON for `scripts/land-mask/ortho-overlay.py`),
`scripts/feedback/dump.ts` (routing features by id).

## 6d9d7ddd "I should probably be able to bike through here" - fixed already (D2), now pinned

Location 52.36221, 4.92250: the Oosterpark path east of the Royal Tropical Institute. OSM has a `bicycle=yes` footway
chain there (routing_47919, routing_48136, routing_48135, ex-OSM w376383016 and neighbours). The routing extract left it
out until lane D2 (#322, graphRevision 2, merged 2026-11-09 after the build in the note) re-admitted rideable footways.
Checked: on today's extract the rider position is 3.1 m from routing_47919; with the 273 D2-appended features removed
(streets-routing index >= 47259) the 45 m of path west of it is off every corridor. Cause: routing (a dropped way).
Pin: `scripts/check-canal-car.ts`, plaza block, "Oosterpark path by the Tropenmuseum (6d9d7ddd)": blocked metres before
(without the D2 features) > 20, after 0. The reachability audit already carries the named place (nearest node 9.7 m).

## 637f346b and 4f47f105 "should be able to ride here" - briefed (not a data bug; open design gap)

637f346b: ASC SDW forecourt off Heathrowstraat, 52.38597, 4.83250. 4f47f105: the office courtyard off Barajasweg,
52.38745, 4.83346 (the build's `mapCenter` of 4f47f105 is also D2's "Radarweg office courtyard" pin).
Checked: both riders stand on the outer edge of a corridor (Heathrowstraat 17.1 of 17 m; Barajasweg service road 13.0
of 13 m), and in 8 to 19 of 24 directions at 12 m the paving beside them is off every corridor. In OSM there is no
rideable way inside either space: the only ways are unmarked `highway=footway surface=paving_stones` (w1444682609 8 m
from ASC; w1425820505-7 around Barajasweg), which are foot-only in Dutch law, no `bicycle=*` tag, no
`highway=pedestrian`/`place=square` area, and the parking aisles are 26-40 m away. The orthophoto
(`evidence/637f346b-4f47f105-asc-radarweg-ortho-bag.jpg`) shows lawns, paths, a playground and car parks. The game
draws every un-classified ground in the same light grey as paving, so open land reads as rideable. Not a missing way.
Cause: routing by design (corridors only) plus a look that does not tell rideable from non-rideable ground.
Options for a lane, cheapest first: (a) a `pavedLinks.ts` ring per space (precedent: Brug 228, feedback 3e7f0aa4), but
the brief rule "no per-junction photo-judged road lanes" argues against; (b) a ground look that gives non-rideable
open ground a distinct tint or kerb, so the bike stopping at a corridor edge reads as intended; (c) admit
`area=yes` squares and forecourts from BGT `verharding` class 'pleintje/voetgangersgebied' (city-wide, needs a
coverage report). Pin (ratchet, documents the gap): `scripts/check-canal-car.ts`, "ASC SDW forecourt (637f346b)" and
"Radarweg office courtyard (4f47f105)": the report position is on a corridor and >= 8 of 24 directions at 12 m are
blocked. Flip the assertion when (a)-(c) lands.

## fc427560 "there's some texture fighting here" - briefed

Location 52.38415, 4.89501: the passage between the IJdok blocks, looking north (De Ruijterkade label, IJ beyond). The
shot shows dark-blue rectangular panels laid over the windows of two facades and a brown vertical strip. Checked:
this is the OSM `building:part` stack of the IJdok blocks (ids 1088833542-548, 1088847349-358, 1088859454-459,
heights 13 to 46 m, `minHeight` 0 to 39). Shapely finds many pairs whose footprints overlap by 100 to 1,400 m2 with the
lower part standing on the ground (minHeight 0) while the taller part overlaps it (1088833542 with 546 and 547;
1088847356 with 350 and 351): the walls of both prisms stand in the same space and the one that is not hidden shows
through the facade in its own colour. `scripts/audit-near-coplanar-walls.ts` on tile 14/8414/5383 finds only 22 m2 of
true near-coplanar walls (5 pairs, max offset 0.005 to 0.47 m), so classic z-fighting is not the cause; this is
interpenetrating parts (intersection, not coincidence). Fix is not cheap: clip the lower of two overlapping ground parts
by the taller part's footprint where the walls would be inside it, in `dropNestedDuplicates`' neighbour
(`src/canalRecall/buildingNesting.ts`), with the regression pinned at this location; needs a city-wide count of
overlapping min-height-0 pairs first (the 'overlap, not nested' class). Brief it as a lane; recommended Firestore status
in-progress.

## 020e2132 "is there really no building here?" - not-a-bug for the building, a ground-look gap

Location 52.39733, 4.87307, Moermanskkade (Westpoort). The lot the note points at (52.3976, 4.8721) is empty in BAG, in
3DBAG and in OSM. The 2025 PDOK luchtfoto (`evidence/020e2132-moermanskkade-ortho-bag.jpg`) shows rough grass and
reeds, and the data.amsterdam.nl panorama of 2025-09-29 (`pano 2025_09_29_07_54_42_00451`, heading 335,
`evidence/020e2132-moermanskkade-panorama-2025-09-29.jpg`) looks straight at it: reeds and meadow in front of the
student block, no building, no construction. So it truly is empty. The remaining oddity is that the game draws the lot as
grey paving instead of meadow. Cause: a truly empty lot; the ground cover (landuse unknown to OSM) falls back to the
paving grey. Recommended status: resolved with that note. Follow-up for the ground-look lane: an unclassified-ground
tint (BGT `onbegroeid terreindeel` grass/rough) instead of paving grey would answer the same question for the whole city.

## 28ae61fb "nothing herE?" (deferred) - not a Moermanskkade note; different place, briefed to the yard line

The brief called this Moermanskkade, but the note's context is Sloterdijkerweg, 52.38744, 4.84600, looking at the
grey flat expanse north of the cycle path (the rail yard and the empty ground by the viaduct pillars). The clicked
pand in the context (0363100012120807, the Lijnwerkplaats Zaanstraat, built 1931) lies 2 km east, so it is the feed-card
target, not what the user looked at. The orthophoto (`evidence/28ae61fb-sloterdijkerweg-ortho-bag.jpg`) shows tracks
and woodland on the north side; BAG/3DBAG have no pand there. Cause: rail yard / ground drawn as flat default grey
(the Zaanstraat rail yard case of feedback C item 11, `?yardFill=1` behind a flag). Recommended Firestore status:
deferred, linked to the yard-fill follow-up in TODO. Moermanskkade itself is 020e2132.

## 0773d2a5 "is there really nothing here?" - briefed to the yard line

Location 52.40548, 4.80412, Hornweg (Westpoort), the card is a 1991 industrial building 800 m away. The ground there is
the Hornweg container terminal: stack aisles, rails and an open apron. There is no pand in BAG, 3DBAG or OSM for the
containers (they are not buildings); the data in the extract is the aisle hull from feedback C item 22. Cause: a yard
with no 3D objects. `?yardFill=1` draws deterministic container boxes there (default off after the 2026-11-10 review).
Recommended Firestore status: deferred with the yard-fill follow-up.

## Regression pins

- `scripts/check-canal-car.ts` (in `npm run test:canal-car`): Oosterpark path (6d9d7ddd) before/after D2; ASC SDW
  forecourt (637f346b) and Radarweg courtyard (4f47f105) ratchets. `plazaWorld` takes an optional `skipStreet` filter
  for before/after runs on a subset of the routing extract.
- `scripts/check-road-reachability.ts` already carried all three places (D2).

## What the integrator rebuilds

Nothing generated: no extract, bundle, cover or golden changed. Only `scripts/check-canal-car.ts` and the three
`scripts/feedback/*.ts` probes. TODO: the 637f346b/4f47f105 design gap (items a-c above), fc427560 part-overlap clipping
lane, and an unclassified-ground tint for empty lots (020e2132) belong on the board.
