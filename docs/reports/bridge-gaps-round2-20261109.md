# Bridge gaps, round 2 (lane bridge-gaps-2, 2026-11-09, issue #178)

Probe: `scripts/roads/probe-bridge-gaps.ts` on main 4613bedb5 (steps 1-2 on, step 3 `dryWayDecks` off), all 5,434 OSM bridge ways in the own-ground cells, 0.5 m stations, LOD 0. Street, cycle and motorway ways (2,919) count toward the totals; footways (2,515 ways, 71,798 m2) are reported but excluded, as in round 1. Raw tables: `artifacts/roads/bridge-gaps/r2before/` (table.csv, summary.json, histogram.png), not committed.

**City gap today (road ways): 173,751 m2** of carriageway that does not read as road from above (round 1 closed at 205,941 m2 on its own set; data and cells moved since).

## Histogram of the carriageway gap per way, before (m2)

| gap m2 | 0-1 | 1-5 | 5-10 | 10-25 | 25-50 | 50-100 | 100-200 | >=200 |
|---|---|---|---|---|---|---|---|---|
| ways | 867 | 358 | 241 | 435 | 380 | 292 | 179 | 167 |

## Where the gap lives

Carrier of the way on its centreline (what deck the probe found under it) against the road survey (roads-v1) under the sample:

| carrier | ways | ways with gap >= 5 m2 | gap m2 |
|---|---|---|---|
| measured | 974 | 293 | 6,905 |
| side | 128 | 36 | 13,769 |
| claim | 16 | 10 | 275 |
| way | 772 | 559 | 48,381 |
| flat | 290 | 151 | 6,064 |
| none | 739 | 645 | 98,358 |

Why the sample is not road: no road triangle there (`missing`) 160,316, buried under another surface 88,231, masked by water 5,065 samples. Survey class under a gap sample (carrier/survey): `none/deck` 138,852 samples, `none/ground` 36,233, `none/none` 33,353, `way/*` and `measured/*` a few thousand each.

**Dominant cause (139k of ~250k gap samples, 55 %, and 14 of the top 20): a bridge way over land with no deck carrier, where the survey draws a deck-level polygon (`none/deck`).** The viaduct exists in the survey and in OSM, the world draws nothing on it. Movable bridges: none in the gap set (hint table has no hit).

## Top 20 worst bridges (before), with cause pattern

| way | name | kind | length m | gap m2 | cause pattern |
|---|---|---|---|---|---|
| 140826822 | Westrandweg | motorway | 3047.3 | 14297.4 | deck missing; long curving viaduct chain (3 km), dry deck refused: chord/straightness, no deck heights |
| 130106320 | Westrandweg | motorway | 2920.9 | 12762 | same viaduct, side:way carrier (second carriageway), same refusal |
| 682669315 | Vertrekpassage | primary | 409.5 | 3020.7 | deck missing: survey deck polygon, no way deck (viaduct over land, Schiphol) |
| 1093974657 | Westrandweg | motorway | 289.3 | 2779.5 | deck missing: viaduct over land (Westrandweg piece) |
| 23335549 | Vertrekpassage | primary | 247.5 | 2329.2 | deck missing (Schiphol viaduct) |
| 140826821 | Westrandweg | motorway | 230.9 | 2037.5 | deck missing (Westrandweg piece) |
| 7377783 | Ringweg-Noord | motorway_link | 284.1 | 1577.7 | deck missing: motorway slip viaduct over land |
| 1381638070 | De Eendenpullenbrug | cycleway | 373.6 | 1561.3 | water polygon: bridge over a polder water body, no survey deck (hole/water level), data missing |
| 1275368974 | Nieuwe Leeuwarderweg | primary | 178.7 | 1364.4 | deck missing: narrow viaduct over metro |
| 115021650 | Coentunnelweg | motorway_link | 177.1 | 1134 | deck missing: motorway slip viaduct |
| 7045278 | Zuiderzeeweg | secondary | 1114.3 | 1038.8 | deck missing; long way (1.1 km) chain over rail |
| 7391533 | Vertrekpassage | unclassified | 178.4 | 1023.7 | deck missing (Schiphol viaduct) |
| 6609981 | Westzanerweg | primary | 106.8 | 973.8 | width/deck mismatch: way deck exists but sides cut at the water polygon (hole 570) |
| 23063764 | Vertrekpassage | primary | 176.7 | 919.8 | deck missing (Schiphol viaduct) |
| 7050184 | - | motorway_link | 158 | 873.9 | deck missing: motorway slip viaduct |
| 26956988 | Ringweg-West | motorway_link | 126.5 | 871.2 | deck missing: motorway slip viaduct |
| 31105860 | Coentunnelweg | motorway | 81 | 870.7 | deck missing, partly none/none (Coentunnel approach, tunnel layer) |
| 792949606 | - | motorway | 149 | 858.1 | deck missing: motorway viaduct |
| 221205615 | Ringweg-West | motorway | 51.5 | 840.4 | deck missing: motorway viaduct |
| 845068193 | - | service | 96.6 | 826 | deck missing: service way on a structure |

None of the top 20 is a deck shorter than its way or a band clipped at a water polygon alone (those were round 1); 14 of 20 are viaducts over land with no deck carrier (step 3 closes all 14), 3 are long chains (the two Westrandweg ways and the Zuiderzeeweg) that need deck heights, 1 is a service way on a structure with no survey deck under part of it, 1 a water-body/data case (Eendenpullenbrug) and 1 a width/water-clip case (Westzanerweg).

## Fix: step 3 narrowed (`?dryWayDecks=1`, still off by default)

Step 3 (dry way decks over land) is the largest systemic fix and was measured here at the whole city: **173,751 -> 99,433 m2** (-43 %). Its known regression (54 ways worse, Ringweg-Zuid +178 m2) came from a dry deck keeping the OSM half-width (10.1 m on 7381715) while the survey deck polygon ended near 5 m: a deck never draws narrower than its half-width, so it covered ground-level road with bare deck. `narrowDryDeck` (wayDecks.ts, `DRY_CORE_HALF_M` 1.5 m) now gives a dry deck a core width, skips the road-surface edge search for it, and lets `surveyDeckEdges` (which stops at ground-level road) set each side. Typed, unit-tested (`bridgeGaps.test.ts`), flag-gated: nothing changes with `dryWayDecks` off (no profile is dry).

| run | road-way gap m2 | ways worse by > 2 m2 vs before |
|---|---|---|
| before (main) | 173,751 | - |
| step 3 as merged | 99,433 | 31 |
| step 3 + narrowing (this lane) | 98,779 | 26 |

Ridden in the world: Ringweg-Zuid 7381715 328 -> 75 m2 (before step 3: 150), 7374867 374 -> 222, 7370137 300 -> 213. Remaining small regressions (Bijlmerdreef 7051250 +49, Diemerbospad +30, Geerdinkhofpad +30, the Ringweg-Oost links +20) are ground-level roads inside the deck polygon notches; listed for the next round.

## After: histogram and top 20 (step 3 + narrowing)

| gap m2 | 0-1 | 1-5 | 5-10 | 10-25 | 25-50 | 50-100 | 100-200 | >=200 |
|---|---|---|---|---|---|---|---|---|
| ways | 943 | 408 | 276 | 509 | 418 | 235 | 81 | 49 |

| way | name | length m | before | after | what is left |
|---|---|---|---|---|---|
| 140826822 | Westrandweg | 3047.3 | 14297.4 | 14297.4 | Westrandweg chain: needs heights (AHN DSM) |
| 130106320 | Westrandweg | 2920.9 | 12762 | 12762 | same |
| 1381638070 | De Eendenpullenbrug | 373.6 | 1561.3 | 1561.3 | polder water body, no deck data |
| 7045278 | Zuiderzeeweg | 1114.3 | 1038.8 | 1039.6 | 1.1 km way over rail, chord grade too steep |
| 6609981 | Westzanerweg | 106.8 | 973.8 | 973.8 | water clip |
| 845068193 | - | 96.6 | 826 | 826 | no survey deck on 174 samples, none/none |
| 1359663062 | Ringweg-Zuid | 241.9 | 665 | 665 | ground-level road / survey none beside the deck |
| 7370159 | Ringweg-Zuid | 241.1 | 609.9 | 609.9 | ground-level road / survey none beside the deck |
| 409282361 | Gaasperdammerweg | 189.4 | 609.5 | 609.5 | ground-level road / survey none beside the deck |
| 221381760 | Ringweg-West | 164.8 | 618.4 | 592.9 | ground-level road / survey none beside the deck |
| 491573242 | Ringweg-West | 123.3 | 486.7 | 486.7 | ground-level road / survey none beside the deck |
| 1068355416 | Vertrekpassage | 523.1 | 637 | 481.4 | ground-level road / survey none beside the deck |
| 114684582 | - | 287.9 | 473 | 473 | ground-level road / survey none beside the deck |
| 293658307 | Ringweg-West | 37.6 | 641.8 | 437.2 | ground-level road / survey none beside the deck |
| 1549883472 | Ringweg-Zuid | 96.8 | 436.6 | 436.6 | ground-level road / survey none beside the deck |
| 722734399 | Nieuwe Haagseweg | 82.3 | 427.2 | 427.2 | ground-level road / survey none beside the deck |
| 424265007 | - | 53.5 | 402.8 | 402.8 | ground-level road / survey none beside the deck |
| 38249624 | Ringweg-West | 91.4 | 669.4 | 395.2 | ground-level road / survey none beside the deck |
| 424265004 | - | 53.7 | 350.6 | 350.6 | ground-level road / survey none beside the deck |
| 1221605945 | Nieuwe Leeuwarderweg | 111.8 | 359.1 | 345.6 | ground-level road / survey none beside the deck |

**Not fixed:** the two Westrandweg viaduct chains (27,059 m2, 27 % of what is left) are 3 km long and curve; a deck laid on the chord between its ends cannot follow them. They need a height source (AHN DSM) as the issue already says. Footways are excluded from the totals.

## Evidence

Orthophoto | steps 1-2 | step 3 + narrowing, top-down own ground (`scripts/roads/bridge-gaps-ortho.ts --step3`): `docs/images/roads/bridge-gaps-2/` da-costakade.jpg (unchanged, still continuous), vertrekpassage.jpg (no road -> the Schiphol viaduct), ringweg-zuid-7381715.jpg (no covered ground road), westrandweg-1093974657.jpg (the viaduct appears, flat grey: lane markings are not drawn on a dry deck).

## Default

Step 3 stays off by default: the grey deck has no lane markings and its sides come from survey polygons; the user judges roads against the orthophoto and the earlier review of Centraal and the IJtunnel trench is still open. Turning it on is `dryWayDecks` in `gameGround.ts` plus recompiling the world cells.
