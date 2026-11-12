# Ground audit, 2026-11-10 (lane G0 of the Ground v2 plan)

Base 34e809901 (main), compared with a1's rails branch db0b2658a. Tool: `node --import tsx scripts/own-ground/audit-ground.ts --help` (`ground:audit` once the integrator adds the script). Pure detector: `src/canalRecall/ownGround/groundAudit.ts`, named places: `groundRegressions.ts`. Baseline for G2: `artifacts/ground-audit/baseline.json` (all 294 cells, per-tile top 200, causes), `named.json` (gate + A/B), `spots-rails-branch-db0b2658a.json`.

## Verdicts
1. **Open ground share of shard area at the named places: 16.2 % by A/B (open ground off removes 10,944 of 67,668 m2), and 21.4 % by containment (shard area lying inside an open-ground-v1 polygon: 14,515 m2).** The two readings straddle the 20 % rule. A/B is the causal one (off hands the polygons back to land, which has defects of its own) and is below 20 %; containment counts defects of every layer inside the polygons and is above. Open ground's clearest signature is z-fight (off: z-fight 6,385 to 4,038 m2, -37 %) and thin slivers (-16 %); it does not drive 5 cm poke-through. Integrator decides which reading applies; I read the rule causally, so no flip by this number alone.
2. **Gate failed: the named places do not rank in the top 50.** See the ranking section. The detector at the plan's definitions finds defects everywhere (city total 28,510,328 m2 shard area, 96,974 m2 per cell), and the named places are inside the first 1 to 25 % of tiles, not the top 50 of 17,321.
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
