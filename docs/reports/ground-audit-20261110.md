# Ground audit, 2026-11-10 (lane G0 of the Ground v2 plan)

Base 34e809901 (main), compared with a1's rails branch db0b2658a. Tool: `node --import tsx scripts/own-ground/audit-ground.ts --help` (`ground:audit` once the integrator adds the script). Pure detector: `src/canalRecall/ownGround/groundAudit.ts`, named places: `groundRegressions.ts`. Baseline for G2: `artifacts/ground-audit/baseline.json` (all 294 cells, per-tile top 200, causes), `named.json` (gate + A/B), `spots-rails-branch-db0b2658a.json`.

## Verdicts
1. **Open ground share of shard area at the named places: 16.2 % by A/B (open ground off removes 10,944 of 67,668 m2), and 21.4 % by containment (shard area lying inside an open-ground-v1 polygon: 14,515 m2).** The two readings straddle the 20 % rule. A/B is the causal one (off hands the polygons back to land, which has defects of its own) and is below 20 %; containment counts defects of every layer inside the polygons and is above. Open ground's clearest signature is z-fight (off: z-fight 6,385 to 4,038 m2, -37 %) and thin slivers (-16 %); it does not drive 5 cm poke-through. Integrator decides which reading applies; I read the rule causally, so no flip by this number alone.
2. **Gate failed (area score, superseded by G0 r2 at the end of this report, which also fails: 0 of 9 in the top 50): the named places do not rank in the top 50.** See the ranking section. The detector at the plan's definitions finds defects everywhere (city total 28,510,328 m2 shard area, 96,974 m2 per cell), and the named places are inside the first 1 to 25 % of tiles, not the top 50 of 17,321.
3. **a1's rails branch changes no shard area at any named place** (|delta| <= 10 m2 of about 10,000 per window). Split: rails fixed by a1 = 0 m2 at Kranenbergpad; ground (ours) = all of it. Kranenbergpad's 9,950 m2 in 150 m is poke-through, z-fight, float and thin slivers on the land and green layers, not the false span. `?railOffset=0` is a render polygon-offset flag and is not measurable in Node.

## What is measured
Per cell, LOD 0, from the worker's own path (`GroundStore.cellInput` then `buildCell`, production defaults: parks, roads, rails on; dry way decks off). A 0.5 m raster of every surface layer's height per 125 m tile, plus triangles and welded boundary edges. Layers ranked by the plan's precedence (carriageway > cycle > footway > rail bed > parking > courtyard > park > open ground > land); paint, kerb, bollard, furniture, hedge, tram, water, quay are overlays and are left out.

| Measure | Definition | City total |
|---|---|---|
| sliver | aspect > 20, area > 0.05 m2 | 18,834,894 triangles, 14,514,799 m2 (mostly long road and path ribbons; reported, not summed) |
| thin | sliver whose height over its longest edge < 0.5 m (narrower than any lane: the torn kind) | 10,484,956 m2 |
| poke | lower-precedence layer above a higher one by > 5 mm, up to 1 m (more is another level: underpass, deck) | 2,278,288 m2; > 5 cm: 691,416 m2 |
| z-fight | two layers within 5 mm | 5,857,748 m2 |
| crack | uncovered raster samples in a hole at most 6 m wide | 648,116 m2 (wider voids, 8,094,366 m2, are off-map or unmodelled and not summed) |
| float | natural ground > 0.10 m over the DTM, not on a deck or rail bed | 9,241,250 m2; > 30 cm: 364,563 m2 |
| T-junction | same-layer vertex on a boundary edge, >= 5 mm off it | 4,029,509; >= 5 cm: 800,778 (counts, not in shard area) |
| shard area | thin + poke + z-fight + crack + float | 28,510,328 m2 |

Portals: 207 cuts in 62 cells, 57 closed mouths (all on DTM-scanned motor ramps, none on a tunnel-tagged way itself). 4 mouths have no tunnel-tagged way within 25 m ahead: cells 2_3 (1), -3_4 (2), -4_-4 (1, the Jachthavenweg ramp). Per-cell rows are in baseline.json.

## Ranking
Score `tear` = poke > 5 cm + crack + 20 x severe T-junctions (m2-equivalent), weighted by 1 + ride-priority share (ridePriority.ts). Best tile within 150 m of each place, of 17,321 tiles (125 m), under every score computed:

| place | cell | shard | tear | severe | poke5cm | poke5mm | thin | float | zfight |
|---|---|---|---|---|---|---|---|---|---|
| piet-kranenbergpad | -4_-3 | 369 | 542 | 466 | 93 | 91 | 416 | 1288 | 1204 |
| amstelveenseweg-viaduct | -3_-4 | 7357 | 4518 | 6220 | 793 | 566 | 5564 | 7335 | 7101 |
| schinkel-jachthavenweg | -4_-4 | 2146 | 1264 | 1362 | 602 | 701 | 3715 | 1057 | 3452 |
| overschiestraat | -5_-3 | 2246 | 1876 | 2112 | 498 | 1275 | 1467 | 621 | 9388 |
| sportparklaan | -5_-3 | 2787 | 3000 | 3640 | 498 | 1275 | 2444 | 1575 | 5935 |
| anthony-fokkerweg | -4_-3 | 162 | 322 | 291 | 229 | 285 | 558 | 70 | 2159 |
| vlaardingenlaan-naaldwijkstraat | -4_-3 | 1357 | 2799 | 2282 | 4215 | 3539 | 705 | 708 | 1925 |
| lelylaan-delflandlaan | -5_-2 | 337 | 444 | 399 | 191 | 242 | 795 | 242 | 2253 |
| radarweg-south-abutment | -5_1 | 2406 | 3915 | 4121 | 315 | 387 | 3216 | 1346 | 2361 |

Best rank anywhere: poke > 5 cm at Kranenbergpad, 93rd. Anthony Fokkerweg is 162nd on shard area. Cell ranking (tear): Kranenbergpad/Anthony Fokkerweg/Vlaardingenlaan share cell -4_-3 at rank 92, Amstelveenseweg 97, Jachthavenweg 62; the others are outside the stored top 100.
Why it fails: raw defect area is dominated by what the cell contains (parks, lawn float, ribbons). A tile with a green field outranks a tile with a torn underpass. Defects the eye reads as torn are local and structural (near decks, cuts, rail beds), so G2 should rank by concentration near structures, not by area. I did not tune a score to the 9 places; the table shows every score as measured.

Top 20 cells by score (full top 100 in baseline.json):

| rank | cell | score | shard m2 |
|---|---|---|---|
| 1 | 3_-3 | 661,569 | 158,824 |
| 2 | 1_-3 | 374,867 | 150,979 |
| 3 | -3_2 | 365,941 | 141,010 |
| 4 | 1_-1 | 334,405 | 113,730 |
| 5 | 4_-7 | 320,989 | 247,319 |
| 6 | 3_-8 | 303,565 | 160,713 |
| 7 | 8_-6 | 295,984 | 108,541 |
| 8 | -1_-4 | 286,857 | 116,689 |
| 9 | 1_0 | 279,736 | 80,599 |
| 10 | 4_-6 | 264,184 | 131,167 |
| 11 | -2_2 | 227,151 | 99,799 |
| 12 | -1_2 | 217,462 | 26,183 |
| 13 | -1_1 | 217,410 | 74,269 |
| 14 | 4_-10 | 208,280 | 108,768 |
| 15 | 4_-3 | 206,770 | 233,992 |
| 16 | 2_0 | 205,883 | 95,166 |
| 17 | -9_-2 | 201,532 | 128,101 |
| 18 | 3_-2 | 195,182 | 136,468 |
| 19 | 2_-4 | 192,870 | 142,300 |
| 20 | -2_1 | 190,781 | 110,139 |

## A/B by layer, summed over the 9 named places (150 m windows, 67,668 m2 default)

| variant | shard m2 | delta | share | z-fight | thin | > 5 cm poke |
|---|---|---|---|---|---|---|
| ?openGround=0 | 56,724 | 10,944 | 16.2 % | 4,038 | 21,148 | 4,312 |
| ?parks=0 | 64,507 | 3,161 | 4.7 % | 4,470 | 24,086 | 4,147 |
| ?courtyards=0 | 66,987 | 681 | 1 % | 6,225 | 24,802 | 4,401 |
| ?roads=0 | 46,538 | 21,130 | 31.2 % | 9,468 | 9,013 | 3,939 |
| ?rails=0 | 66,625 | 1,043 | 1.5 % | 6,336 | 24,917 | 3,605 |
| ?tunnels=0 | 67,012 | 656 | 1 % | 6,387 | 25,297 | 3,726 |
| ?portalEnds=0 | 67,668 | 0 | 0 % | 6,385 | 25,269 | 4,401 |
| ?portalClip=0 | 67,668 | 0 | 0 % | 6,385 | 25,269 | 4,401 |
| ?dryWayDecks=1 | 68,140 | -472 | -0.7 % | 6,343 | 24,748 | 4,863 |
| ?railDecks=0 | 67,668 | 0 | 0 % | 6,385 | 25,269 | 4,401 |

Share is the drop when the layer is off (negative: it gets worse). roads-v1 carries 31 %: with it off the roads draw as OSM bands, so this is the size of the road layer's stake, not a defect to remove. Open ground 16.2 %, parks 4.7 %, rails 1.5 %, courtyards 1 %, tunnels 1 %. portalEnds, portalClip and railDecks move nothing at these windows (their effect is at the tunnel mouths themselves, outside the 150 m windows or on cells with none); dry way decks add 0.7 %.

Per place (default, m2): piet-kranenbergpad 9,950 (open ground inside: 412); anthony-fokkerweg 10,391 (open ground inside: 4,046); vlaardingenlaan-naaldwijkstraat 7,082 (open ground inside: 1,889); amstelveenseweg-viaduct 4,139 (open ground inside: 681); schinkel-jachthavenweg 10,009 (open ground inside: 2,774); overschiestraat 3,986 (open ground inside: 1,007); sportparklaan 7,151 (open ground inside: 2,005); lelylaan-delflandlaan 5,657 (open ground inside: 553); radarweg-south-abutment 9,303 (open ground inside: 1,147).

## Main vs a1's rails branch (db0b2658a)

| place | main m2 | branch m2 | delta |
|---|---|---|---|
| piet-kranenbergpad | 9,950 | 9,950 | 0.0 |
| anthony-fokkerweg | 10,391 | 10,391 | 0.0 |
| vlaardingenlaan-naaldwijkstraat | 7,082 | 7,082 | 0.0 |
| amstelveenseweg-viaduct | 4,139 | 4,139 | 0.0 |
| schinkel-jachthavenweg | 10,009 | 10,001 | 8.4 |
| overschiestraat | 3,986 | 3,986 | 0.0 |
| sportparklaan | 7,151 | 7,151 | 0.0 |
| lelylaan-delflandlaan | 5,657 | 5,667 | -9.9 |
| radarweg-south-abutment | 9,303 | 9,303 | 0.0 |

The branch's `railSpans=0` run (f67cf4b9a) equals its default exactly, so no span is left at these places; `railDecks=0` moves Schinkel by +25 m2 only. The user-visible Kranenbergpad saddle (deck and embankment ends, a1's after frame) is a DTM fill under the deck: here it reads as poke/float on land and ballast, which G1 step 1 (caps under decks) targets.

## Limits
- Raster step 0.5 m; cracks narrower than that show only through T-junction counts. Cells built at LOD 0, full detail; touch/far tiers not audited. Window = 150 m radius around the position on the named OSM way; the user's exact standpoints may differ.
- Near coverage (G4) is not measured here: every covered cell builds a near mesh. The blur at Cornelis Lelylaan / Delflandlaan is a runtime tier question; the audit cannot see it.
- Vlaardingenlaan (flat ground) is one of the worst-ranked places on poke > 5 cm (rank 4,215) and 2,799th on tear: its scraps are small overlaps between surveyed road layers, which a tile-area score cannot isolate.

## G0 r2: visibility-weighted concentration score (2026-11-11)

Ruling from the judgement session: replace area ranking with weighted concentration. Implemented in `groundVisibility.ts` (typed unit test `groundVisibility.test.ts`, 5 cases), used by `audit-ground.ts` as score `visibility`:

- visibility weight: 1 within 15 m of a rideable way centreline (cycleway, path, footway, pedestrian, living_street, residential, unclassified, tertiary, secondary, primary and links, track, bridleway), linear to 0 at 60 m;
- crossing weight x3 within 30 m of a deck footprint edge, cut centreline, portal, or rail track (G3 records do not exist yet: no lane/ground-g3-crossings branch, so tunnels.ts cuts, deck rings and rail-v1 tracks stand in);
- priority 1 + ride-priority share of the cell;
- score = weighted defect m2 x (1 + priority) per hectare of weighted area (area floored at 0.5 ha so a tile far from any way cannot score on a sliver). Defects = thin + poke + z-fight + crack + float, as before.

**Own gate: at least 7 of the 9 named places in the top 50 of 17,321 tiles. Result: 0 of 9. FAILED.** Weights were not tuned.

| place | best tile rank | best tile score |
|---|---|---|
| piet-kranenbergpad | 235 | 4,813 |
| amstelveenseweg-viaduct | 4509 | 1,681 |
| schinkel-jachthavenweg | 1032 | 3,235 |
| overschiestraat | 1832 | 2,650 |
| sportparklaan | 2986 | 2,132 |
| anthony-fokkerweg | 182 | 5,143 |
| vlaardingenlaan-naaldwijkstraat | 1606 | 2,774 |
| lelylaan-delflandlaan | 534 | 3,919 |
| radarweg-south-abutment | 2206 | 2,458 |

Score scale over the 17,321 tiles: #1 11,599; #50 7,097; #200 5,029; #1000 3,261; median 954. The named places sit at 1,700 to 5,100, within about 2x of the 50th tile, but the field is flat near the top (about 200 tiles above 5,000), so a score within 2x ranks 182nd to 4,509th.

**Which term is missing: defect kind.** The weights (visibility, crossing, priority) do their job but cannot separate the named places from the rest, because the composition of the defect differs:

| share of shard area | z-fight | float | thin sliver | poke over 5 cm |
|---|---|---|---|---|
| all 17,321 tiles | 21 % | 32 % | 37 % | 2.4 % |
| top 50 tiles by this score | **59 %** | 11 % | 14 % | 3.4 % |
| tiles within 150 m of the 9 places | 9 % | **41 %** | 36 % | 5.9 % |

The top 50 are z-fight tiles (layers within 5 mm of each other: inner-city road, courtyard and park overlaps that the render-time polygon offsets resolve), not torn ground. The named places are float over the DTM and thin slivers with twice the city's share of 5 cm poke-through: relief and layer mismatch. A fourth term is needed: weight defect kinds by whether the renderer can hide them (z-fight within the polygon-offset ranks: low; 5 cm poke, float over 0.3 m, step T-junctions: high), or count only kinds that survive the offsets. I did not add it here because that is tuning against the nine places without independent evidence; the user's eye on a z-fight-versus-poke sample would supply that evidence. The crossing term also did not lift the places: G3's records would sharpen it, but at the places themselves (Kranenbergpad 3.8 weighted ha, 10 k weighted m2) the structure weight is already applied.

### Top 50 tiles by score (125 m tiles; x, y in the game frame)

| rank | cell | tile | x | y | weighted defect m2 | weighted ha | score |
|---|---|---|---|---|---|---|---|
| 1 | -3_2 | 5_2 | -2312 | 2298 | 12,039 | 1.76 | 11,599 |
| 2 | -4_-2 | 2_6 | -3688 | -1173 | 10,613 | 1.59 | 10,782 |
| 3 | 0_-4 | 6_6 | 813 | -3159 | 9,518 | 1.52 | 10,592 |
| 4 | -4_-2 | 3_6 | -3563 | -1173 | 14,008 | 2.20 | 10,326 |
| 5 | -4_-1 | 1_1 | -3813 | -805 | 10,779 | 1.60 | 9,756 |
| 6 | -2_-2 | 2_6 | -1688 | -1173 | 7,017 | 1.47 | 9,519 |
| 7 | -4_-2 | 2_7 | -3688 | -1048 | 13,273 | 2.29 | 9,374 |
| 8 | 4_6 | 5_4 | 4688 | 6520 | 9,656 | 1.05 | 9,233 |
| 9 | -4_-1 | 1_0 | -3813 | -930 | 10,612 | 1.68 | 9,165 |
| 10 | -2_1 | 4_6 | -1438 | 1805 | 7,537 | 1.65 | 9,119 |
| 11 | -4_-1 | 1_5 | -3813 | -305 | 9,483 | 1.52 | 9,056 |
| 12 | -2_2 | 2_1 | -1688 | 2173 | 6,961 | 1.44 | 9,020 |
| 13 | -4_-1 | 4_3 | -3438 | -555 | 8,833 | 1.45 | 8,809 |
| 14 | -2_1 | 3_7 | -1563 | 1930 | 10,382 | 2.46 | 8,455 |
| 15 | 1_-1 | 2_3 | 1312 | -555 | 7,726 | 1.85 | 8,363 |
| 16 | -4_-1 | 3_5 | -3563 | -305 | 12,450 | 2.18 | 8,283 |
| 17 | -4_-1 | 3_2 | -3563 | -680 | 17,942 | 3.17 | 8,217 |
| 18 | 0_-4 | 3_5 | 438 | -3284 | 13,937 | 2.87 | 8,217 |
| 19 | -2_-2 | 0_6 | -1938 | -1173 | 10,932 | 2.66 | 8,207 |
| 20 | 4_-8 | 2_6 | 4313 | -7131 | 11,276 | 1.38 | 8,181 |
| 21 | -3_-2 | 5_4 | -2312 | -1423 | 4,065 | 0.99 | 8,176 |
| 22 | -2_-2 | 3_7 | -1563 | -1048 | 11,266 | 2.76 | 8,170 |
| 23 | -12_6 | 3_1 | -11562 | 6145 | 5,156 | 0.64 | 8,089 |
| 24 | -4_-1 | 2_2 | -3688 | -680 | 8,772 | 1.58 | 8,070 |
| 25 | 4_6 | 4_6 | 4563 | 6770 | 5,456 | 0.68 | 8,037 |
| 26 | -3_-2 | 5_3 | -2312 | -1548 | 5,945 | 1.49 | 7,965 |
| 27 | -1_-2 | 7_7 | -62 | -1048 | 9,051 | 2.28 | 7,942 |
| 28 | 5_-1 | 1_7 | 5187 | -55 | 3,969 | 0.46 | 7,937 |
| 29 | -3_-2 | 5_5 | -2312 | -1298 | 6,169 | 1.57 | 7,875 |
| 30 | -4_-1 | 1_4 | -3813 | -430 | 8,451 | 1.56 | 7,865 |
| 31 | -12_6 | 4_1 | -11437 | 6145 | 10,221 | 1.30 | 7,861 |
| 32 | -13_6 | 5_5 | -12313 | 6645 | 3,898 | 0.47 | 7,795 |
| 33 | -12_6 | 4_0 | -11437 | 6020 | 9,491 | 1.22 | 7,769 |
| 34 | 2_-3 | 1_6 | 2188 | -2166 | 28,722 | 3.71 | 7,736 |
| 35 | 0_-1 | 4_5 | 563 | -305 | 12,551 | 3.25 | 7,717 |
| 36 | 0_0 | 1_7 | 188 | 938 | 10,468 | 2.67 | 7,566 |
| 37 | 2_0 | 3_2 | 2438 | 313 | 29,910 | 4.25 | 7,522 |
| 38 | -2_1 | 2_7 | -1688 | 1930 | 6,633 | 1.77 | 7,484 |
| 39 | -10_3 | 6_6 | -9187 | 3791 | 5,677 | 0.76 | 7,477 |
| 40 | -12_6 | 3_2 | -11562 | 6270 | 6,662 | 0.90 | 7,363 |
| 41 | 0_-2 | 2_6 | 313 | -1173 | 9,746 | 2.67 | 7,308 |
| 42 | -4_-1 | 3_6 | -3563 | -180 | 9,838 | 1.96 | 7,291 |
| 43 | 0_-4 | 3_4 | 438 | -3409 | 5,807 | 1.35 | 7,290 |
| 44 | -4_-1 | 4_4 | -3438 | -430 | 7,157 | 1.43 | 7,269 |
| 45 | -2_2 | 1_0 | -1813 | 2048 | 7,659 | 1.96 | 7,265 |
| 46 | -3_-2 | 6_6 | -2187 | -1173 | 3,946 | 1.11 | 7,139 |
| 47 | 6_-5 | 6_2 | 6813 | -4652 | 15,143 | 2.12 | 7,136 |
| 48 | -7_-3 | 0_2 | -6938 | -2666 | 6,204 | 0.87 | 7,127 |
| 49 | -5_-5 | 2_2 | -4687 | -4652 | 5,928 | 0.83 | 7,117 |
| 50 | 5_-7 | 3_3 | 5437 | -6513 | 10,465 | 1.47 | 7,097 |

Baseline.json now carries `spotRanks` (best tile per place under every score including `visibility`), per-cell and per-tile weighted defect and weighted area, and the top 200 tiles. The earlier A/B and main-vs-rails numbers above are unchanged (they do not depend on the score). The A/B re-run on a main containing a1's push is still pending the coordinator's signal.
