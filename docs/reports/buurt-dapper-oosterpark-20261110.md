# Dapperbuurt-Noord (ME01) and Oosterparkbuurt-Noordwest (MC01), 2026-11-10

Lane `lane/buurt-dapper-oosterpark-20261110`. Sheets and strips: `/Users/blackmad/Code/map-recall2-source-data/block-face-strips/dapper-oosterpark-20261110/`
(`sheet-<run>.png` = photo / model / overlay per pand, `strip-<face>.jpg` = rectified face strips).

## Census

Survey (BAG pands whose units lie in the buurt): Dapperbuurt-Noord 308 pands, 173 built by 1945, 89 proposed faces; Oosterparkbuurt-Noordwest 314 pands,
216 built by 1945, 73 faces. Intake (strip, uses, facts) ran for the 22 + 23 faces of 4+ pands. Both buurten are far more post-war than the CBS decade suggests:
most Dapper faces (Commelinstraat 322-538, Swinden 5-229, Vlaming 101-207 and 206-282, Linnaeus 13-21, Zeldenrust, Roomtuintjes) are 1950-1997 rebuilds or flats,
and the 1900s Oosterpark rows are a patchwork of individual neo-renaissance fronts (s-Gravesandeplein, Bonn, Tilanus 2-36). Coherent pre-war families found:

| design | faces | pands | status |
|---|---|---|---|
| Eerste Van Swindenstraat 391-401 (1882): plain brick, shop ground, 3 upper storeys, 3 axes on 5 m, panelled cream cornice, slate mansard, pointed dormer | swinden-383-581 | 6 | type `dapper-1882-plain-dormer`, installed |
| Ruyschstraat 72-98 and 307-393 (1898-1904): 5.6 m brick fronts, centre balconettes, cambered heads, box dormer in a mansard | ruysch-64-124, ruysch-307-393 | ~14 of ~28 | type `oosterpark-1900-balcony-camber`, 9 installed |
| Swinden 383-387 (speklagen arches), Dapperstraat 3-9 (stone dormer, dark frames), Vlamingstraat 36-56 (1883 stepped gables, 3 designs) | | ~15 | no type (several designs, no run of 4) |
| Ruyschstraat 49-105 white stucco block (arched windows), Blasius 100-110 (4.1-4.3 m fronts, 2 or 3 axes, box dormers; photo is a sunlit 2025 strip) | | ~14 | no type authored (stucco; mixed axes) |
| Bonn 2-24 (1921-24), Zeldenrust, Commelin 322-538 | | | other decades, out of scope |

## Yield (split)

| outcome | Dapper (swinden face) | Oosterpark (two Ruysch faces) |
|---|---|---|
| vetoed before comparison (year / frontage / storeys / evidence gate) | 3 | 11 (incl. the ten 1983 / 10 m pands) |
| compared and held (score, likeness, run of one, review) | 2 (Swinden 383A, 385) + 3 Dapperstraat reviewed holds | 24 (see holds) |
| placed and installed | 6 | 9 |

Other faces of both buurten were only run through the library: nothing placed worth installing (the library types that matched Vlaming 40-44, Dapperstraat 4-8, Bonn 1-25
(photo is scaffolding netting) or s-Gravesandeplein 21-23 are not the photographed design, so they were not installed).

## Types

1. `dapper-1882-plain-dormer` (years 1881-82, 4.6-5.5 m). Measured from the 2022-01-12 strip: storey heights 3.0/2.85 m, windows 1.0 x 1.9 m, heads 5.0/7.8/10.6 m,
   cornice 11.1-12.2 m, dormer ridge 14.0 m. The dormer needed `setback 1.0` (0.3 pierces the 70 degree attic: GLB audit `opening-outside`).
2. `oosterpark-1900-balcony-camber` (years 1897-1906, 5.0-6.2 m, `frontEavesM 13.5`, `frontEavesAtLine`). The 3DBAG eaves (15.8-17.9 m) read the mansard top; the photo
   cornice stands at 13.5 m. Window rows 0.3-2.5, 3.5-5.6, 6.5-8.75, 9.6-11.7 m, so the storey weights are 3.4/3.1/3.0/3.9 and the top storey carries a 1.7 m brick frieze.
   Pinned per face in `buurten/oosterparkbuurt-noordwest-review-types.json` because the stucco mansard type tied it on year and width.

No close existing type: the Kinker/Nassau types reject the 1881-82 year and read the Ruysch eaves wrongly; `kinker-1902-balcony-axis` is the nearest relative of type 2.

## Kit additions

* `match.frontEavesAtLine` (autoPlace.ts, test in autoPlace.test.ts): with `frontEavesM`, draw each pand at the line instead of its skyline reading within 1 m.
  Reason: a dormer top read as the cornice lifted houses of one row 1 m over their neighbours. Absent = byte-identical (322 block-face tests pass).
* Windows/heights use existing `windowShare`, `headLines`, `storeyHeights` (new use, no code change).

## Holds

Swinden 383A/385 (other designs; 385 and 387 are speklagen fronts), 387 (10 m, two fronts), 423, 511 (post-war). Dapperstraat 4, 6, 8 (different design, wall read green).
Ruysch 98 (pointed gable, yellow brick), 94 (white ornamental brick bands), 92 (bell gable), 96 and 72 (runs of one), 84 and 74 (edge NCC 0.13 and 0.146 under 0.15),
323 and 371 (curved gables), 363G (footprint-vs-3DBAG gate), 355 (NCC 0.139), 379 (run of one), 68, 66, 64A (frontage 10.6 m, or 1983).

## What the kit cannot say

* the cornice frieze panels (Swinden) and the brick frieze under the cornice (Ruysch);
* shallow cambered window heads: the `segmental` head draws a visibly rounder arch;
* speklagen arch bands that follow the window heads (Swinden 385-395, Ruysch 94) at triangle budget;
* a wide white box dormer with a flat cap (Ruysch) and a taller pointed dormer: both are drawn smaller than the photo;
* per-house ground floors (shop, door, arch) under a 3-axis front: the ground storey is a generic window row on the Ruysch fronts;
* bell and curved neck gables placed per pand inside a run of box dormers (they split the run, so those pands are held).

## Integrator

`npx tsx scripts/look/build-chunk-wall-exposure.ts --write`, covers, bake-frontages, buurt pages, explorer-looks. `roof-golden.json` was written by the batch (CHANGED names only these faces).
Note: some auto-place and review runs used the headless renderer without `canal-pw.sh` before I noticed the queue; every batch install ran under it.

## Round 2 (2026-11-10): the Opus strip verdict applied

Source: `docs/reports/dapper-oosterpark-strip-verdict-20261110.md`. Same 15 pands re-placed with `auto-place --replace` and re-installed with `compile.ts --install`
(the batch skips a face that already has chunks); sheets re-made in the archive folder, now labelled `No <house number> · <BAG id>`.

* New kit: `blockFace/reviewFronts.ts` (`<buurt>-review-fronts.json`): per-pand `ground` (door bay and arch, shopfront merged field by field, door colour/side) and
  `overrides` (body fields, `null` removes) pins, tested in `reviewFronts.test.ts`. Absent file = byte-identical.
* Swinden 391-401: cream `#e6e1d2` shopfront frame and fascia, cream house doors (391, 393, 397, 399), 399's house door on the right, Cosme black; the cornice is an
  `entablature` of 1.25 m (cap 0.3 m, flush frieze).
* Ruyschstraat: every pand has its street door (88 R, 86 L, 82 R, 80 L, 78 R arched, 76 L arched, 331 R, 339 L; 80's double leaf is drawn as one leaf); 90 has a cream shopfront
  with a door at each side, no lower balcony, stone keystones; top-storey heads flat except 78 and 76 (`axisHeads`); cornice `#a29d95`; bricks 82 / 78 / 339 set through
  `fit-wall-palette.ts` so the rendered wall lands on the verdict colours; the other pands keep the wall refits the first batch measured, now as palette pins.
* Still limits: double-leaf door (80), brick frieze and carved brackets, tall tympanum heads (76, 78), the cream house door of 395 and 401 not changed (awning hid it).
* `roof-golden.json` re-recorded: 6 Swinden pands reclassed (the deeper entablature moved their front hash), 4 intents changed, all in these faces.
