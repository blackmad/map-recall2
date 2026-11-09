# Missing pands and bare yards, 2026-11-09 (lane new-bag-prisms)

## Verdict on the hypothesis
- Partly true for pands, not the cause of the three spots. Live PDOK BAG (CC0) has 17764 pands with bouwjaar >= 2020; **1110 of them (294406 m2) are not drawn** by our z14 tiles (bagGaps.ts holds all post-2019 pands back as `newer-than-ahn` because AHN4 predates them; the 2026-10-30 survey listed 1,325 / 366,336 m2 of them, the live number is lower because 3DBAG v20250903 and other fills already draw some).
- By bouwjaar (n / m2): 2020 34/4427, 2021 25/4993, 2022 51/8684, 2023 140/21620, 2024 70/29031, 2025 428/93841, 2026 362/131810.
- By area (buurt/gebied from boundaries.json, which covers only 77 areas; the rest is `(outside boundaries)`): (outside boundaries) 933/171593, Nieuw-West 42/31270, Overhoeks 5/20726, Centrum 5/17337, Noord 27/15524, Frederik Hendrikbuurt 1/11933, Zuidoost 17/10514, Oost 17/4260. Full table: `scripts/data/bag-gaps/new-pands.report.json`.
- Heights: BAG carries none. 453 pands (248585 m2) get the median of measured 3DBAG neighbours within 120 m (clamped 6-30 m); 657 (45821 m2) get 3 m (< 40 m2) or 9 m. The source is on every feature (`heightSource`). The latest 3DBAG release could not be listed (data.3dbag.nl returned 403 to curl); the cached v20250903 does not draw these pands. AHN6 was not tried.
- Moermanskkade (item 8): live BAG shows 93 pands in the box, 9 pre-2020 pands not in the tiles by id (all under 50 percent cover or tiny, not the lot), none from 2020+. The lot looks genuinely empty in BAG: no missing-pand fix applies. Needs the panorama to confirm (not done, no renderer path).
- Hornweg (item 22): all 103 BAG pands are drawn. The terminal is landuse=industrial with 17-35 private service aisles (the stripes) and no OSM container tag: pure yard problem.
- Zaanstraat (item 11): 15 pre-2020 undrawn pands in the box (small), the beige is a rail yard: 160 `railway=rail service=yard` segments, no ballast drawn.

## What was built (all staged, nothing published, nothing rendered)
- `src/canalRecall/newPandPrisms.ts` + test: height rule and feature builder. `scripts/survey-new-pands.ts` writes `scripts/data/bag-gaps/new-pands-supplement.geojson` (1110 features, tier 3, `bagGap`, `newPand`) and `new-pands.report.json`. Same append path as the AHN fills (`publish-bag-gaps.ts`); existing pands untouched (disjoint/idempotent).
- `src/canalRecall/yardFill.ts` + test, `scripts/build-yard-fill.ts`: container stacks (12.2 x 2.44 m, 1-4 high, 8 colours, deterministic) and siding lines, written to `scripts/data/yard-fill/`. Hornweg: 2,198 boxes over a 23 ha aisle hull. Zaanstraat: 89 siding lines. The first run used an "industrial + private aisles" rule that put stacks on 20 substations, fuel depots and waste sites, so it was dropped for reviewed anchors (`ANCHORS` in the script). OSM has no container-terminal tag; each further terminal needs an anchor.
- The renderer adapter (`?yardFill=1`, default off) is not written: it needs game.js / engine files that are the integrator's.

## Evidence
No before/after ride frames: nothing renders the yard data yet and the orthophoto/panorama was not compared. Schematics: `docs/reports/missing-pands-yards-20261109-hornweg.svg`, `...-zaanstraat.svg`. Pinned: `yardFill.test.ts` (staged fills exist at Hornweg and Zaanstraat).
