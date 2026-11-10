# Weesperbuurt (AJ01) and Sarphatistrook (AJ03), 2026-11-10

Lane `lane/buurt-weesper-20261110`, MODEL: opus-class session (sonnet 5.5). Sheets and strips:
`/Users/blackmad/Code/map-recall2-source-data/block-face-strips/weesperbuurt-20261110/` (`sheet-<run>.jpg` = photo, model, overlay per pand;
`held-evidence/` = photo and overlay crops of the runs that were held after review; `strip-dates/` = every candidate strip date looked at).

## Result
**6 pands installed, all Sarphatistrook** (Sarphatistraat 167, 169, 171 and 175, 177, 179: runs `sarphati-163-213-r1`, `-r2`). **Weesperbuurt: 0 installed.**
Neither buurt is a family buurt; the one coherent design is the 1909-10 block of Sarphatistraat 163-193.

## Census (survey `buurten/weesperbuurt.json` 356 pands / 63 faces, `buurten/sarphatistrook.json` 246 pands / 60 faces)
* Weesperbuurt: 275 built by 1945, 114 five-storey pitched 1900-06 pands (5.8 m), 39 four-storey, 39 five-storey flat; the post-war Weesperstraat blocks
  are a handful of huge pands (20-112 m) and are not kit material. Along the ridden streets (Nieuwe Prinsengracht, Nieuwe Keizersgracht,
  Nieuwe Achtergracht, Roetersstraat) the 1890s fronts are individual: every four to six pands change ornament (cream pilaster pairs, dark band
  fronts, step gables, dormer pairs). Strips (all 2021-01-22, the only dates with full coverage besides 2016/2017 summer) are blown out or leafy.
  No family of 4+ identical pands read cleanly: Nieuwe Prinsengracht 64-124 (31 pands) has at least six designs; Keizersgracht 15-69 is a gable row of
  one-offs; Achtergracht 81-117 (2021-01-22 blown out, 2017-07-06 scaffolding and leaves; both strips in `strip-dates/`).
* Sarphatistrook: 198 built by 1945, 93 five-storey pitched 1900-06. Sarphatistraat 25-125 is a row of individual grand houses (viewed, no family).
  Sarphatistraat 163-213 (1909-10, 26 pands, 6.5 m) is one design in mirrored pairs and the family this lane built.

## Type: `sarphati-1910-arched-tower-pair` (`types/weesperbuurt/`)
6.5 m red-brown brick, 4 storeys over a 4.1 m ground storey, cornice at 14.4 m; wide two-light window (2.75 m) beside a narrow one per storey, narrow axis on
the door side, arched house doors in pairs at the party wall (span 1.8, apex 3.75), brick wall dormer (tower) over each door pair, 2.6 m per house.
Measured on a gridded 40 px/m crop (heads 6.6/10.05/13.25, sills 4.5/7.8/11.1, ground windows 1.1-3.5, cornice 14.25-14.75, tower to 17.4).
Door sides are pinned from the strip (`sarphatistrook-review-doors.json`: 163 R, 165A L, 167 R, 169 L ... alternating); the detector read them at
random on this row and edge NCC rose from 0.18-0.30 to 0.35-0.47 after the pins.

## Yield (sarphati-163-213, 16 pands in the face; 26 in the buurt row, 10 not in the discovered face: 195-213)
* vetoed before comparison: 191 (2.8 m frontage), 181 (strip evidence gate, a tree over the front): 2
* compared and held: 163 (face seam, grey no-data band beside it, corner section), 165A (stepped gable and a different window layout), 183 and 185 (a splayed
  bend of the street: curved mansard, no tower, heavy foliage; also a 1.02 m2 roof z-fight), 173 (roof z-fights 0.24 m2 with 171, and the geometry audit
  fails the whole run; lowest NCC 0.17), 187 (shop and garage entrance), 189 and 193 (runs of one): 8, all pinned in `sarphatistrook-review-holds.json`
* placed: **6** on 2 runs. The batch (`batch.ts --install --photo-decides --no-restrip`) passed both runs: NCC min 0.33 / med 0.35, stripOverDrawn 0.85 and 1.20.

## Strip date (looked at before use)
2024-12-11 (the survey's) falls 2.5x in exposure along the face (raw brick medians #c59a6a left, #4d3c22 right): the batch refused it (stripOverDrawn 3.0 and 0.58).
Candidates viewed in `strip-dates/`: 2019-05-14 (leaves), 2022-06-10 (leaves), 2025-06-19 (leaves), 2019-01-10 (fogged, cars), 2021-03-19 (sunlit, cold cast gate),
2020-01-07 (golden-hour tops), **2017-03-31 chosen** (even exposure, bare enough, neutral). Restripping was run with `--no-restrip`.

## Kit and pipeline additions (typed, tested in `src/canalRecall/blockFace/weesperbuurt.test.ts`, byte-identical when absent)
* `match.columnsUnscored`: the strip's window-column count is no evidence where a wide two-light window beside a narrow one reads 3-6 columns on one design.
* `match.frontEavesFixed`: draw every pand at the type's line, never at the strip skyline within 1 m of it (the skyline read 15.1-15.4 m over a 14.4 m cornice and
  lifted single houses); auto-place now writes `measuredEaves` for these types even where 3DBAG is within the minimum delta, so the held neighbours' lower 3DBAG
  eaves no longer pull a house down (175 and 183 were 1 m low in the first sheets).

## What the kit cannot say (photo shows, kit lacks)
* iron balconies on storeys 1-2 under one light of the wide window or both (some houses; slab bracket corbels);
* the speklagen (cream bands) and the dark relief lintel blocks over each window (triangle budget, as Indische);
* the double-leaf arched doors with a fanlight tracery (drawn as an arched leaf);
* a splayed (bent) front with a curved mansard (183|185) and a stepped end gable (165A);
* per-light transoms of the wide window (storeys 1-2 french windows) distinct from storey 3.

## Open problems
* 171|173: equal 3DBAG ridges (18.62 m) make the recipe roofs coplanar across the party wall (roofZFight 0.24 m2, gate FAIL, audit coplanar 0.6 m2). Same
  family of problem as the Vogelbuurt step-gable audit; a roof fix (differing front-roof ridge for a tower pair) would release 173.
* The strip exposure falls 2.5x on 2024-12-11; later panoramas for Sarphatistraat 163-213 are needed for the right half if 2017-03-31 is ever retired.
* Sarphatistraat 195-213 (1910 design, same family on the photo thumbnails) are outside the discovered face: a second intake with `--from=181390` is the next step.

## Integrator rebuild
`npx tsx scripts/look/build-chunk-wall-exposure.ts --write`; covers (`build-covers` then `check:covers`); bake-frontages; buurt pages / explorer-looks;
archive: strips already written to the source-data folder above.
