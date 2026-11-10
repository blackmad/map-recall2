# Block-face type libraries, round 2 (#113), 2026-11-09

Lane `lane/block-face-libs-20261109`, MODEL sonnet. Dry run only: nothing installed, no manifest write. Tabulation:
`scripts/block-face/libs-report.ts` over `scripts/block-face/batch/{jordaan,pijp}-{base,after,after2}-20261109.json`
(base = main 6961a53c9; after = this lane). Buckets: **vetoed** = held before any comparison (no strip data, no front on
the strip, every type vetoed on year/frontage/crown/material); **held** = compared and held (best type under the
score, likeness gate, run rule, review hold); **placed** = placed by auto-place. "Would place" = the whole run passes
the install verdict (compile gates, GLB audit, NCC, stripOverDrawn, evidence).

Scope: 15 of the 63 Jordaan faces and 8 of the 37 Frans Halsbuurt faces (the four reviewed no-front cases, the faces
that compiled on Oct 29, the Dou/Hals/Stalpert/Saenredam/Quellijn/Ruysdaelkade De Pijp faces). A full buurt is about
4 min a face under load; the cluster counts below use the committed Oct 29 `auto-place.json` of all 63 Jordaan faces.

## Findings that no longer reproduce on main

- **NCC evidence floor**: exists since #120 (`stripEvidence.ts`, sky over the roof in >= 75 % of columns, wired into
  `decidePand` as stage `evidence`). The four no-front cases are held today (bloem-128-206 r2, akoleien-2-10, lelie-150-194,
  bloemgracht-53-95: "no front on the strip" and the buurt review holds). The gap left: authored intents bypass auto-place,
  so `installVerdict` now also takes the finished run's evidence verdict (`no-front:` reason).
- **Storey count off by one / arches over flat heads / slate mansard over flat cornice (De Pijp)**: the likeness gate
  (glazing storey band, era guard for ribbon windows) holds these today (dou-1-7: 5 pands under the era guard, 2 under
  the glazing-storey band). The runs that do compile die on `compile-gates storey-height` (stalpert-2-36, saenredam-2-22),
  not on likeness. No De Pijp change in this lane; De Pijp numbers before = after (byte-identical).

## Changes

1. `wallMaterial.ts` + `match.materialVeto` (opt-in): trim-normalised strip wall near-black neutral (HSL L < 0.12, S < 0.12)
   or `palette.stucco` vetoes a type that is not `blackPaint` / `stucco: true`. Threshold calibrated on 4,578 auto-placed
   pands in the faces: 10 read near-black at 0.12/0.12, all already held; 0.15/0.10 would catch one placed Helmersbuurt pand.
   Dark brick is not told from black paint by tone alone, so the limits are tight. The veto did not fire on this sample
   (the grey-painted Bloemstraat 3-25 and black-painted Bloemgracht 121-197 fronts are already held by buurt review holds).
2. `match.crownStrict` (opt-in, with `crownMatch`): a sky-bounded, confident skyline that fits no crown of the type vetoes it.
   Both Jordaan types set it; the cornice dormer rise is capped at 2.0 m (gable types start at 2.0 m; ranges overlapped 2.0-2.2).
3. New Jordaan type `jordaan-1900-gable-rebuild` (bell/point gable, years 1871-2025). Cluster, from held pands whose skyline
   was read under clean sky: narrow gable pands built 1871-1910 (16 pands, 11 faces; eaves median 10.9 m, width 4.7 m, rise
   3.2 m, top 0.5 m) and after 1910 (16 pands, 10 faces; 11.3 m, 5.2 m, 2.8 m, 0.4 m). Body is the neck-gable's; likeness of
   that body to these fronts is **not verified**: review the strips before any install.
4. `installVerdict(evidence)` + `batch.ts` call `runEvidence` on every run.

## Numbers (dry run)

| Jordaan, 15 faces | before | after |
|---|---|---|
| vetoed before comparison (pands) | 80 | 63 |
| compared and held | 88 | 102 |
| placed by auto-place | 13 | 16 |
| runs that would place | 0 | 0 |

9-face subset re-run after the eaves-pitch fix of the new type: vetoed 61 -> 45, held 71 -> 85, placed by auto-place 6 -> 8,
would place 0 -> 0. De Pijp (8 faces): 25 / 36 / 18 / 0 before and after.

The new type moves 17-19 pands from "vetoed on year" to "compared", and 2 more pands place inside runs, but no run passes
the install verdict: the blockers are downstream (compile-gates storey-height and roof-behind-crown, glb-audit,
stripOverDrawn). Nothing is offered for install.

## Strips

No face would place, so there is no install strip set. Review sheets (photo beside render) of the runs that came closest
(compiled, NCC 0.17-0.30, failed a gate) are in `https://raw.githubusercontent.com/blackmad/map-recall2-screenshots/main/buildings/2026-11-09-block-face-libs/`:
bloemgracht-80-128-r1 (glb-audit), rozengracht-30-82-r1 (storey-height), bloem-128-206-r1 (roof-behind-crown),
bloemgracht-16-32-r1, lelie-83-141-r1, stalpert-2-36-r1, saenredam-2-22-r1.

### Jordaan Bloemgrachtbuurt BEFORE (main 6961a53c9)

faces 15; pands 181: vetoed-before-comparison 80, compared-and-held 88, placed by auto-place 13; runs that would place 0 (0 pands)

Hold reasons (pands):

- 21 x match: every type vetoed (built #, type #-#)
- 21 x run: a single placed pand between held neighbours or the face end: a block face needs two house
- 20 x evidence: strip # % without panorama data
- 19 x match: every type vetoed (built #, type #-#; frontage # m, type #-# m)
- 14 x likeness: no photo evidence (usable photo # % < # %) and no passing same-type neighbour
- 13 x match: best jordaan-#-cornice-house scores # < # (#DBAG eaves # m = # storeys of # m vs the type'
- 12 x evidence: no front on the strip: sky over the roof in # % of columns (< # %): the strip shows a near
- 8 x match: every type vetoed (frontage # m, type #-# m)
- 7 x match: best jordaan-#-neck-gable scores # < # (#DBAG eaves # m = # storeys of # m vs the type's #
- 6 x likeness: run did not compile
- 4 x match: best jordaan-#-cornice-house scores # < # (skyline crown rise # m, top # m fits no crown o
- 2 x review: review: Akoleienstraat #-# (strip): a close oblique crop of a modern brick block, no #th-c
- 2 x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: glazing storey band off by # mean #
- 2 x likeness: edge NCC # < # (photo vs model body; likeness#ts NO EVIDENCE: washed out # % > # %)

| run | street | pands | vetoed | held | placed | outcome | reasons |
|---|---|---|---|---|---|---|---|
| akoleien-2-10 | Akoleienstraat | 6 | 4 | 2 | 0 | held | no-type: 0/6 placed (2x evidence: no front on the strip: sky over the roof in # % of columns (< # %): th; 2x evidence: strip # % without panorama data; 2x review: review: Akoleienstraat #-# (strip): a |
| akoleien-1-9 | Akoleienstraat | 4 | 2 | 2 | 0 | held | no-type: 0/4 placed (1x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: wall dL +#; gla; 1x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: glazing storey ; 1x eviden |
| bloemgracht-4-10 | Bloemgracht | 4 | 1 | 3 | 0 | held | no-type: 0/4 placed (2x likeness: no photo evidence (usable photo # % < # %) and no passing same-type ne; 1x match: every type vetoed (best jordaan-#-neck-gable: built #, type #-#); 1x run: a single p |
| bloemgracht-16-32-r1 | Bloemgracht | 9 | 3 | 4 | 2 | held (NCC 0.197) | compile-gates: 173350/storey-height ; strip-over-drawn-high: 3.041 > 1.25 (walls drawn darker than the photo) |
| bloemgracht-32-74 | Bloemgracht | 16 | ? | ? | ? | failed | intake-failed: Seed 0363100012173354 has no frontage on Bloemgracht: sightline to Bloemgracht crosses 0363100012172857 |
| bloemgracht-80-128-r1 | Bloemgracht | 19 | 3 | 14 | 2 | held (NCC 0.242) | glb-audit: failed (see report.json audit) |
| bloemgracht-1-51 | Bloemgracht | 19 | 7 | 12 | 0 | held | no-type: 0/19 placed (4x match: every type vetoed (best jordaan-#-neck-gable: built #, type #-#; front; 4x run: a single placed pand between held neighbours or the face end: a block ; 4x likeness: no  |
| bloemgracht-53-95 | Bloemgracht | 14 | 8 | 6 | 0 | held | no-type: 0/14 placed (4x match: every type vetoed (best jordaan-#-neck-gable: built #, type #-#); 3x run: a single placed pand between held neighbours or the face end: a block ; 2x review: review: Blo |
| bloemgracht-121-197 | Bloemgracht | 8 | 2 | 6 | 0 | held | no-type: 0/8 placed (2x match: every type vetoed (best jordaan-#-neck-gable: built #, type #-#; front; 2x review: review: Bloemgracht #-# (strip): a black-painted front drawn green, an; 1x likeness: n |
| bloem-128-206-r1 | Bloemstraat | 14 | 7 | 5 | 2 | held | compile-error: page.evaluate: Target page, context or browser has been closed |
| bloem-3-25 | Bloemstraat | 8 | 1 | 7 | 0 | held | no-type: 0/8 placed (4x likeness: run did not compile; 2x review: review: Bloemstraat #-# (strip): two tall grey-painted ornamented fron; 1x match: every type vetoed (best jordaan-#-neck-gable: built  |
| egelantiersgracht-47-101 | Egelantiersgracht | 22 | 11 | 11 | 0 | held | no-type: 0/22 placed (6x match: every type vetoed (best jordaan-#-neck-gable: built #, type #-#); 4x match: best jordaan-#-cornice-house scores # < # (#DBAG eaves # m = # storeys; 4x run: a single pla |
| lelie-150-194 | Nieuwe Leliestraat | 18 | 16 | 2 | 0 | held | no-type: 0/18 placed (14x evidence: strip # % without panorama data; 2x review: review: Nieuwe Leliestraat #-# (strip): a close oblique crop of brick ; 1x evidence: no front on the strip: sky over the |
| lelie-83-141-r1 | Nieuwe Leliestraat | 16 | 8 | 3 | 5 | held (NCC 0.174) | compile-gates: 168148/roof-behind-crown; 168148/roof-under-crown |
| lelie-83-141-r2 | Nieuwe Leliestraat | 0 | 0 | 0 | 0 | held (NCC 0.188) | compile-gates: 169849/storey-height |
| rozengracht-30-82-r1 | Rozengracht | 20 | 7 | 11 | 2 | held (NCC 0.297) | compile-gates: 168605/storey-height |

### Jordaan Bloemgrachtbuurt AFTER (this lane)

faces 15; pands 181: vetoed-before-comparison 63, compared-and-held 102, placed by auto-place 16; runs that would place 0 (0 pands)

Hold reasons (pands):

- 20 x evidence: strip # % without panorama data
- 20 x likeness: no photo evidence (usable photo # % < # %) and no passing same-type neighbour
- 20 x run: a single placed pand between held neighbours or the face end: a block face needs two house
- 19 x match: every type vetoed (built #, type #-#; frontage # m, type #-# m)
- 12 x evidence: no front on the strip: sky over the roof in # % of columns (< # %): the strip shows a near
- 12 x match: best jordaan-#-gable-rebuild scores # < # (#DBAG eaves # m = # storeys of # m vs the type'
- 8 x match: every type vetoed (frontage # m, type #-# m)
- 7 x match: best jordaan-#-neck-gable scores # < # (#DBAG eaves # m = # storeys of # m vs the type's #
- 5 x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: glazing storey band off by # mean #
- 4 x match: best jordaan-#-cornice-house scores # < # (#DBAG eaves # m = # storeys of # m vs the type'
- 3 x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: wall dL +#; glazing storey band off
- 3 x match: best jordaan-#-gable-rebuild scores # < # (skyline crown rise # m, top # m fits no crown o
- 2 x review: review: Akoleienstraat #-# (strip): a close oblique crop of a modern brick block, no #th-c
- 2 x likeness: edge NCC # < # (photo vs model body; likeness#ts NO EVIDENCE: washed out # % > # %)

| run | street | pands | vetoed | held | placed | outcome | reasons |
|---|---|---|---|---|---|---|---|
| akoleien-2-10 | Akoleienstraat | 6 | 4 | 2 | 0 | held | no-type: 0/6 placed (2x evidence: no front on the strip: sky over the roof in # % of columns (< # %): th; 2x evidence: strip # % without panorama data; 2x review: review: Akoleienstraat #-# (strip): a |
| akoleien-1-9 | Akoleienstraat | 4 | 2 | 2 | 0 | held | no-type: 0/4 placed (1x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: wall dL +#; gla; 1x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: glazing storey ; 1x eviden |
| bloemgracht-4-10 | Bloemgracht | 4 | 0 | 4 | 0 | held | no-type: 0/4 placed (4x likeness: no photo evidence (usable photo # % < # %) and no passing same-type ne) |
| bloemgracht-16-32-r1 | Bloemgracht | 9 | 3 | 4 | 2 | held (NCC 0.197) | compile-gates: 173350/storey-height ; strip-over-drawn-high: 3.041 > 1.25 (walls drawn darker than the photo) |
| bloemgracht-32-74 | Bloemgracht | 16 | ? | ? | ? | failed | intake-failed: Seed 0363100012173354 has no frontage on Bloemgracht: sightline to Bloemgracht crosses 0363100012172857 |
| bloemgracht-80-128-r1 | Bloemgracht | 19 | 2 | 15 | 2 | held (NCC 0.242) | glb-audit: failed (see report.json audit) |
| bloemgracht-1-51 | Bloemgracht | 19 | 6 | 13 | 0 | held | no-type: 0/19 placed (4x match: every type vetoed (best jordaan-#-neck-gable: built #, type #-#; front; 4x run: a single placed pand between held neighbours or the face end: a block ; 4x likeness: no  |
| bloemgracht-53-95 | Bloemgracht | 14 | 5 | 9 | 0 | held | no-type: 0/14 placed (4x run: a single placed pand between held neighbours or the face end: a block ; 2x match: best jordaan-#-gable-rebuild scores # < # (skyline crown rise # m, top; 2x review: revie |
| bloemgracht-121-197 | Bloemgracht | 8 | 2 | 6 | 0 | held | no-type: 0/8 placed (2x match: every type vetoed (best jordaan-#-neck-gable: built #, type #-#; front; 2x review: review: Bloemgracht #-# (strip): a black-painted front drawn green, an; 1x likeness: n |
| bloem-128-206-r1 | Bloemstraat | 14 | 5 | 7 | 2 | held (NCC 0.174) | compile-gates: 174650/roof-behind-crown; 174650/roof-under-crown |
| bloem-3-25 | Bloemstraat | 8 | 1 | 7 | 0 | held | no-type: 0/8 placed (3x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: glazing storey ; 2x review: review: Bloemstraat #-# (strip): two tall grey-painted ornamented fron; 1x match: e |
| egelantiersgracht-47-101 | Egelantiersgracht | 22 | 6 | 16 | 0 | held | no-type: 0/22 placed (5x match: best jordaan-#-gable-rebuild scores # < # (#DBAG eaves # m = # storeys; 3x match: every type vetoed (best jordaan-#-neck-gable: frontage # m, type #-# m; 3x run: a sing |
| lelie-150-194 | Nieuwe Leliestraat | 18 | 15 | 3 | 0 | held | no-type: 0/18 placed (14x evidence: strip # % without panorama data; 2x review: review: Nieuwe Leliestraat #-# (strip): a close oblique crop of brick ; 1x evidence: no front on the strip: sky over the |
| lelie-83-141-r1 | Nieuwe Leliestraat | 16 | 8 | 3 | 5 | held (NCC 0.174) | compile-gates: 168148/roof-behind-crown; 168148/roof-under-crown |
| lelie-83-141-r2 | Nieuwe Leliestraat | 0 | 0 | 0 | 0 | held (NCC 0.188) | compile-gates: 169849/storey-height |
| rozengracht-30-82-r1 | Rozengracht | 20 | 4 | 11 | 5 | held (NCC 0.198) | compile-gates: 168605/storey-height ; strip-over-drawn-low: 0.531 < 0.8 (walls drawn lighter than the photo) |

### Jordaan AFTER2 (eaves-pitch fix)

faces 9; pands 138: vetoed-before-comparison 45, compared-and-held 85, placed by auto-place 8; runs that would place 0 (0 pands)

Hold reasons (pands):

- 19 x likeness: no photo evidence (usable photo # % < # %) and no passing same-type neighbour
- 18 x run: a single placed pand between held neighbours or the face end: a block face needs two house
- 15 x evidence: strip # % without panorama data
- 12 x match: every type vetoed (built #, type #-#; frontage # m, type #-# m)
- 11 x match: best jordaan-#-gable-rebuild scores # < # (#DBAG eaves # m = # storeys of # m vs the type'
- 8 x evidence: no front on the strip: sky over the roof in # % of columns (< # %): the strip shows a near
- 7 x match: every type vetoed (frontage # m, type #-# m)
- 5 x match: best jordaan-#-neck-gable scores # < # (#DBAG eaves # m = # storeys of # m vs the type's #
- 4 x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: wall dL +#; glazing storey band off
- 3 x match: best jordaan-#-cornice-house scores # < # (#DBAG eaves # m = # storeys of # m vs the type'
- 3 x match: best jordaan-#-gable-rebuild scores # < # (skyline crown rise # m, top # m fits no crown o
- 3 x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: glazing storey band off by # mean #
- 2 x review: review: Bloemgracht #-# (strip): the right pand is behind a fence and a tree; no front to 
- 2 x review: review: Bloemstraat #-# (#-#-# strip): a close crop of two storeys (brick arches over a wh

| run | street | pands | vetoed | held | placed | outcome | reasons |
|---|---|---|---|---|---|---|---|
| bloemgracht-4-10 | Bloemgracht | 4 | 0 | 4 | 0 | held | no-type: 0/4 placed (2x likeness: no photo evidence (usable photo # % < # %) and no passing same-type ne; 1x match: best jordaan-#-gable-rebuild scores # < # (#DBAG eaves # m = # storeys; 1x run: a si |
| bloemgracht-80-128-r1 | Bloemgracht | 19 | 2 | 15 | 2 | held (NCC 0.242) | glb-audit: failed (see report.json audit) |
| bloemgracht-1-51 | Bloemgracht | 19 | 6 | 13 | 0 | held | no-type: 0/19 placed (4x match: every type vetoed (best jordaan-#-neck-gable: built #, type #-#; front; 4x run: a single placed pand between held neighbours or the face end: a block ; 4x likeness: no  |
| bloemgracht-53-95 | Bloemgracht | 14 | 5 | 9 | 0 | held | no-type: 0/14 placed (3x run: a single placed pand between held neighbours or the face end: a block ; 2x match: best jordaan-#-gable-rebuild scores # < # (skyline crown rise # m, top; 2x review: revie |
| bloem-128-206-r1 | Bloemstraat | 14 | 5 | 7 | 2 | held (NCC 0.174) | compile-gates: 174650/roof-behind-crown; 174650/roof-under-crown |
| bloem-3-25 | Bloemstraat | 8 | 1 | 7 | 0 | held | no-type: 0/8 placed (3x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: glazing storey ; 2x review: review: Bloemstraat #-# (strip): two tall grey-painted ornamented fron; 1x match: e |
| egelantiersgracht-47-101 | Egelantiersgracht | 22 | 6 | 16 | 0 | held | no-type: 0/22 placed (5x run: a single placed pand between held neighbours or the face end: a block ; 4x match: best jordaan-#-gable-rebuild scores # < # (#DBAG eaves # m = # storeys; 3x match: every  |
| lelie-150-194 | Nieuwe Leliestraat | 18 | 15 | 3 | 0 | held | no-type: 0/18 placed (14x evidence: strip # % without panorama data; 2x review: review: Nieuwe Leliestraat #-# (strip): a close oblique crop of brick ; 1x evidence: no front on the strip: sky over the |
| rozengracht-30-82-r1 | Rozengracht | 20 | 5 | 11 | 4 | held (NCC 0.231) | compile-gates: 168605/storey-height |

### De Pijp Frans Halsbuurt BEFORE

faces 8; pands 79: vetoed-before-comparison 25, compared-and-held 36, placed by auto-place 18; runs that would place 0 (0 pands)

Hold reasons (pands):

- 13 x match: every type vetoed (built #, type #-#)
- 7 x run: a single placed pand between held neighbours or the face end: a block face needs two house
- 6 x match: best pijp-#-five-low scores # < # (strip cornice # m vs the type's # m (wall-dormer skylin
- 6 x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: glazing storey band off by # mean #
- 5 x match: every type vetoed (built #, type #-#; frontage # m, type #-# m)
- 4 x evidence: no front on the strip: sky over the roof in # % of columns (< # %): the strip shows a near
- 4 x match: era guard: Gerard Doustraat # (same # row) reads ribbon windows; pijp-#-bracketed-hood is 
- 3 x match: every type vetoed (frontage # m, type #-# m)
- 2 x match: best pijp-#-shop-dormer scores # < # (#DBAG eaves # m = # storeys of # m vs the type's # m
- 2 x likeness: no photo evidence (usable photo # % < # %) and no passing same-type neighbour
- 2 x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: glazing storey band off by #)
- 1 x likeness: edge NCC # < # (photo vs model body; likeness#ts WARN: mask IoU # < #)
- 1 x match: era guard: the strip reads ribbon windows; pijp-#-shop-dormer is a punched-window type
- 1 x match: era guard: Frans Halsstraat # (same # row) reads ribbon windows; pijp-#-hood-frieze is a p

| run | street | pands | vetoed | held | placed | outcome | reasons |
|---|---|---|---|---|---|---|---|
| stalpert-2-36-r1 | Daniël Stalpertstraat | 15 | 1 | 1 | 13 | held (NCC 0.189) | compile-gates: 160596/storey-height; 164898/storey-height; 166489/storey-height; 154148/storey-height |
| hals-2-26 | Frans Halsstraat | 12 | 6 | 6 | 0 | held | no-type: 0/12 placed (4x match: every type vetoed (best pijp-#-shop-dormer: built #, type #-#); 2x likeness: no photo evidence (usable photo # % < # %) and no passing same-type ne; 1x match: best pijp |
| hals-28-40 | Frans Halsstraat | 7 | 4 | 3 | 0 | held | no-type: 0/7 placed (3x evidence: no front on the strip: sky over the roof in # % of columns (< # %): th; 1x run: a single placed pand between held neighbours or the face end: a block ; 1x match: era  |
| dou-1-7 | Gerard Doustraat | 11 | 2 | 9 | 0 | held | no-type: 0/11 placed (5x match: era guard: Gerard Doustraat # (same # row) reads ribbon windows; pijp-; 2x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: glazing storey ; 1x match: e |
| dou-9-39 | Gerard Doustraat | 17 | ? | ? | ? | failed | intake-failed: Houses of one chunk must front the same direction (frontages differ by more than ~11 degrees) |
| quellijn-32-56 | Quellijnstraat | 9 | 1 | 8 | 0 | held | no-type: 0/9 placed (4x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: glazing storey ; 1x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: wall dL +#; gla; 1x run: a |
| ruysdaelkade-15-55 | Ruysdaelkade | 14 | 9 | 5 | 0 | held | no-type: 0/14 placed (8x match: every type vetoed (best pijp-#-shop-dormer: built #, type #-#); 2x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: glazing storey ; 2x run: a single pl |
| saenredam-2-22-r1 | Saenredamstraat | 11 | 2 | 4 | 5 | held (NCC 0.183) | compile-gates: 166578/storey-height; 155728/storey-height; 162009/storey-height; 164404/storey-height |

### De Pijp Frans Halsbuurt AFTER

faces 8; pands 79: vetoed-before-comparison 25, compared-and-held 36, placed by auto-place 18; runs that would place 0 (0 pands)

Hold reasons (pands):

- 13 x match: every type vetoed (built #, type #-#)
- 7 x run: a single placed pand between held neighbours or the face end: a block face needs two house
- 6 x match: best pijp-#-five-low scores # < # (strip cornice # m vs the type's # m (wall-dormer skylin
- 6 x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: glazing storey band off by # mean #
- 5 x match: every type vetoed (built #, type #-#; frontage # m, type #-# m)
- 4 x evidence: no front on the strip: sky over the roof in # % of columns (< # %): the strip shows a near
- 4 x match: era guard: Gerard Doustraat # (same # row) reads ribbon windows; pijp-#-bracketed-hood is 
- 3 x match: every type vetoed (frontage # m, type #-# m)
- 2 x match: best pijp-#-shop-dormer scores # < # (#DBAG eaves # m = # storeys of # m vs the type's # m
- 2 x likeness: no photo evidence (usable photo # % < # %) and no passing same-type neighbour
- 2 x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: glazing storey band off by #)
- 1 x likeness: edge NCC # < # (photo vs model body; likeness#ts WARN: mask IoU # < #)
- 1 x match: era guard: the strip reads ribbon windows; pijp-#-shop-dormer is a punched-window type
- 1 x match: era guard: Frans Halsstraat # (same # row) reads ribbon windows; pijp-#-hood-frieze is a p

| run | street | pands | vetoed | held | placed | outcome | reasons |
|---|---|---|---|---|---|---|---|
| stalpert-2-36-r1 | Daniël Stalpertstraat | 15 | 1 | 1 | 13 | held (NCC 0.189) | compile-gates: 160596/storey-height; 164898/storey-height; 166489/storey-height; 154148/storey-height |
| hals-2-26 | Frans Halsstraat | 12 | 6 | 6 | 0 | held | no-type: 0/12 placed (4x match: every type vetoed (best pijp-#-shop-dormer: built #, type #-#); 2x likeness: no photo evidence (usable photo # % < # %) and no passing same-type ne; 1x match: best pijp |
| hals-28-40 | Frans Halsstraat | 7 | 4 | 3 | 0 | held | no-type: 0/7 placed (3x evidence: no front on the strip: sky over the roof in # % of columns (< # %): th; 1x run: a single placed pand between held neighbours or the face end: a block ; 1x match: era  |
| dou-1-7 | Gerard Doustraat | 11 | 2 | 9 | 0 | held | no-type: 0/11 placed (5x match: era guard: Gerard Doustraat # (same # row) reads ribbon windows; pijp-; 2x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: glazing storey ; 1x match: e |
| dou-9-39 | Gerard Doustraat | 17 | ? | ? | ? | failed | intake-failed: Houses of one chunk must front the same direction (frontages differ by more than ~11 degrees) |
| quellijn-32-56 | Quellijnstraat | 9 | 1 | 8 | 0 | held | no-type: 0/9 placed (4x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: glazing storey ; 1x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: wall dL +#; gla; 1x run: a |
| ruysdaelkade-15-55 | Ruysdaelkade | 14 | 9 | 5 | 0 | held | no-type: 0/14 placed (8x match: every type vetoed (best pijp-#-shop-dormer: built #, type #-#); 2x likeness: edge NCC # < # (photo vs model body; likeness#ts FAIL: glazing storey ; 2x run: a single pl |
| saenredam-2-22-r1 | Saenredamstraat | 11 | 2 | 4 | 5 | held (NCC 0.183) | compile-gates: 166578/storey-height; 155728/storey-height; 162009/storey-height; 164404/storey-height |

