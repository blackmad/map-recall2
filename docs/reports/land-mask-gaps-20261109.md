# Land-mask gaps, 2026-11-09 (lane houthaven-land)

Trigger: desktop Free Ride feedback, item 4 "bridge missing" (Gevlebrug stub, Karlskrona-eiland, Houthaven) and item 7 "missing land?"
(a building on Haparandadam drawn floating on water). Open data only (BGT and the PDOK luchtfoto via PDOK, AHN, BAG, OSM).

## What the mask is and what was wrong

The game's water is `elevation-v1` (cells decoded from the OpenFreeMap z14 water snapshot 20261004, built by
`scripts/elevation/build-canal-elevation.py`); everything else (ground, roads, decks, baked cells) cuts against it. The hypothesis
"Houthaven islands (2018+) are missing from the mask" is only half right: the *islands are in the mask as land*, but the **Houthaven
basin polygon (OSM id 991513322 and its neighbours) still covers the filled/dry parts of the inner docks**: Karlskrona-eiland and
Libau-eiland sand, the building blocks on them and the bridge underneath. BGT waterdeel (CC0) is equally stale there, so the BGT
mask is not the fix. What shows the truth is AHN (+1.0..+1.6 m NAP inside "water", canal level is -0.4) and the orthophoto
(`ortho-gevlebrug.jpg`, `before-gevlebrug-mask.jpg`: red = mask water drawn over sand, courtyards and the bridge).

The "bridge missing" at Gevlebrug is **not a routing gap**: OSM way 991513319 (75 m, bridge=yes) joins Karlskrona-eiland to the
Pontsteiger road and is in `streets-routing` (reachability: component 0, see below). It is a deck gap: the AHN `deckRangeM` and the
municipal footprint are 28-31 m (deck 23.83-52.13 m along the way) while the mask has water over 0.46-72.56 m, so about 23 m of road
at each end ran over open water with no deck. `audit-deck-ends` saw water at 99 of 378 end probes.

The Haparandadam building (BAG pand 0363100012240915, 909 m², 1966) is **entirely inside the OSM and the BGT water** and is
OSM way 96706553, tagged as a **houseboat**: a moored vessel on a platform at the dam. It really floats, so the mask is right and the
houseboat-land regression (`ownGround.test.ts`) forbids covering it. A first attempt (a land apron under the footprint) was dropped
for that reason; the user's "floating on water" is correct, and `check-land-mask.ts` pins that it stays on water. No change.

## Measurements (before)

| Measure | Result |
| --- | --- |
| BAG/OSM pand footprints (349,335 unique ids) with representative point in mask water and ≥ 50 % of the area inside | **410 pands, 86,914 m²** (`scripts/land-mask/measure-land-mask-gaps.py`) |
| of which: Sloterdijk/Westpoort 52.40,4.78-4.79 (14 pands) | 31,728 m² (industrial piers; unreviewed) |
| IJburg Waterbuurt 52.36,4.98-4.99 | 139 pands, 8,423 m² (floating homes; correctly on water) |
| Houthaven / Haparandadam (52.396-52.40, 4.87-4.89) | 10 pands, 6,007 m²; the 909 m² one is the user's building |
| Mask water vs current BGT waterdeel (game bbox) | OSM 110.4 km², BGT 112.8 km²; mask water with no BGT water within 3 m: **74 ha**; BGT water with no mask water: 178 ha (mostly tile-edge/IJ clipping, not land the player sees) |
| Largest "mask water, BGT land" clusters | IJburg east 5.0095,52.3797 (5.5 ha), 5.036,52.361 (4.8 ha), Houthaven 4.8817,52.3919 (0.9 ha) |
| AHN-filled water (DTM > +0.8 m NAP inside mask water, ≥ 400 m², ≥ 5 m wide): city-wide scan of 247 z14 tiles | 54 raw polygons, **37 merged candidates, 8.3 ha** |
| ... corroborated by current BGT land objects (≥ 40 % cover) | 8 (2.7 ha); 29 left unconfirmed (BGT lags new land: Houthaven sand 0 %) |
| Bridges (measured, 1,046 with water) whose deck is ≥ 15 m shorter than their water crossing | 9: Gevlebrug BRU2430 and BRU0620, 0985, 0374, 0583, 0736, 2022, 2198, 2264 (the others unreviewed; a way running along water also looks like this) |

Not found: unrouted bridges. Gevlebrug, Lübeckbrug, Karlskrona-eiland and Haparandadam are all in the routing graph.

## What was changed (staging only; the integrator publishes)

* `scripts/elevation/build-canal-elevation.py` gets `--land-fixes <geojson>` and `--land-patches <json>`: polygons are cut out of
  the water union after simplification, per touched polygon. Without the flags the output is byte-identical to the published
  cells (verified: a flag-less run reproduces `elevation-v1` exactly except `bridges.json`, which the published tree extends with
  `--extra-profiles`).
* `--keep-water-under houseboats.json` (+ `--berth-m 4`): houseboat footprints (+4 m berth for detected fills, +1 m for patches)
  are removed from every cut so moored boats stay on water; checked: no detected fill touches a boat, only the dropped
  Haparandadam apron did.
* `scripts/land-mask/find-filled-water.py` (AHN + BGT corroboration, writes `artifacts/land-mask/staging/filled-water.geojson`),
  `land-rejects.json` (3 eyeballed false positives: two Zuidoost ponds and the Westpoort quay water; AHN interpolates over open water),
  `land-patches.json` (3 eyeballed fills with BGT share 0-0.02: Karlskrona-eiland N and E sand, the
  Passenger Terminal quay), `deck-extensions.json` + `extend-decks.py` (BRU2430 deck 23.83-52.13 → 0.46-73.56, patched into
  `bridges.json` textually), `diff-cells.py` (geometric per-cell diff; the builder's STRtree order shifts ring order in ~330
  cells when the polygon count changes, so only cells whose water really changed are published).
* Evidence tools: `measure-land-mask-gaps.py`, `compare-water-mask.py`, `fetch-bgt-water.py`, `ortho-overlay.py`.

## Result (staged vs published)

* **11 cells change; 41,558 m² (4.16 ha) of water becomes land** (11 m² added, simplification noise): -2_2 Houthaven 12,319 m²,
  7_-2 IJburg 10,896, 1_0 Oostenburg quay 7,761, -10_5 Westpoort 5,664, 0_0 1,787, 8_-3 853, -6_6 828, 8_-2 502, 4_0 476, -11_5 454,
  -2_1 18. Per-cell numbers in `artifacts/land-mask/diff-cells.log`.
* Pands in mask water: 410 → about 407 (a 1,811 m² 1912 building leaves; the Haparandadam houseboat stays).
* Gevlebrug deck now spans its water crossing; `audit-deck-ends` for cells -2_2/-2_3: 6 → 5 failing decks, Gevlebrug gone (water 99 → 0
  probes). Remaining there: Pilaubrug 22/378, Kolbergbrug 18, Wisbybrug 8, Windaubrug 4, Robiënnabrug 3 (all deck-top probes, not
  water).
* Reachability (`npm run test:reachability`): unchanged component structure; three new named places (Gevlebrug, Karlskrona-eiland,
  Haparandadam) all in the Dam's component.
* Pins: `scripts/land-mask/check-land-mask.ts` (Houthaven fill points, Gevlebrug deck vs water, Haparandadam houseboat stays on
  water); fails on the unfixed extract (4 of 6), passes staged. `npm run test:own-ground` passes with the staged cells.

## Not done / follow-ups

* 29 unconfirmed AHN candidates (`filled-water-unconfirmed.geojson`, 5.6 ha): the largest are the Passenger Terminal quay (patched),
  the Westpoort quay (rejected), IJburg fills at 5.018,52.350 (5,384 m², BGT 30 %), Zuidoost; a review lane could patch the
  true ones. The 8 flagged bridges need the same eyeballing as Gevlebrug before their decks are extended.
* Buildings left standing in mask water (Sloterdijk piers, 31,728 m²) are a different problem (platform or stilts); no generic rule
  is safe because IJburg's floating homes are legitimately on water.
* The ground-height AHN tiles blank every pixel inside mask water, so the newly freed land has no measured relief until
  `build-ground-height` is re-run for those tiles; the existing relief there is the pull-push fill from the old water rim.

## Evidence frames (before / after, proto `own-ground.html`, `tests/e2e/land-mask-frames.spec.ts`)

* `docs/reports/land-mask-gaps-20261109/before|after/gevlebrug-aerial.jpg`, `gevlebrug-low.jpg`: before, the bridge is a stub in a lake
  and the island floats; after, sand/land fills the basin and the deck spans the remaining pond.
* `before|after/haparandadam-pand.jpg`: the after frame is from the dropped apron attempt; with the final set it equals before (the boat floats).
* Orthophoto (PDOK luchtfoto, open data) beside the mask: `ortho-gevlebrug.jpg`, `ortho-haparandadam.jpg`;
  `before-gevlebrug-mask.jpg` / `after-gevlebrug-mask.jpg` draw the mask outline (red) on it.
* Candidate review sheets: `cand-*.jpg` (green = AHN fill polygon).
