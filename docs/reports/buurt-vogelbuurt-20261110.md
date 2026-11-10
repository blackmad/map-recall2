# Vogelbuurt-Noord (NL01, Noord), 2026-11-10

Lane `lane/buurt-vogelbuurt-20261110`, MODEL: sonnet. Survey, four measured types, placements and sheets; **nothing installed**.
Sheets and strips: `/Users/blackmad/Code/map-recall2-source-data/block-face-strips/vogelbuurt-20261110/` (`sheet-<run>.jpg`, `strip-<face>.jpg`).

## What the buurt is
456 BAG pands, 446 built by 1945, 209 proposed faces, no library before. A Tuindorp: 255 one-storey 1918-19 cottages
(3DBAG eaves 3.3-4.3 m, 5-6 m fronts, many 10 m BAG pands holding two cottages) and about 155 two-storey rows of 1921-28 (eaves 6.4-7.3 m, 6.3-6.6 m). Intake ran for the 63 faces of 3+ pands (291 pands, coverage 1.0 except vogel-22-34 0.6); vogel-14-22 and vogel-19-31 failed intake (no frontage on the street at the seed).

## Designs (read off the strips, not year bands)
| design | faces | type | pands placed |
|---|---|---|---|
| 1918-19 brick cottages, plain gutter (Brede, Derde, Eerste, Korte, Tweede, Vierde, Vijfde Vogelstraat) | 22 | `vogel-1918-cottage-3axis` (7) / `-2axis` (4) | 11 |
| 1918-19 cottages with a dark boarded band 3.0-4.0 m and a wide cream box dormer (Zamenhofstraat, Lange Vogelstraat, Vogelplantsoen) | 13 | `vogel-1918-timber-band-cottage` | 23 |
| 1921-28 two-storey rows: wide upper window over a ground window, narrow window over paired doors, flat dormers, pointed gable block ends (Flamingo, Kalkoen, Pelikaan, Pluvier, Meeuwenplein) | 20 | `vogel-1921-two-storey-dormer-row` | 45 |
| Meeuwenlaan 281-327, Merelstraat (14 m, four-storey blocks) | 5 | NO TYPE (not attempted) | 0 |

## Yield (252 pands run through auto-place; 20 Meeuwenlaan/Merel pands and 10 vogel-21-39 sheds not run)
* vetoed before comparison: 36 frontage (double-width pands, 9.9-10.6 m, two cottages in one BAG pand), 41 strip evidence gate (side walls, trees, fences, 5 with no panorama): 77
* compared and held: 27 score < 0.7 (skyline cornice or columns), 23 likeness FAIL, 17 likeness abstains (usable photo < 50 %, hedges), 28 run of one between held neighbours, 1 reviewer (Kalkoenstraat 12, shows the side wall): 96
* placed: **79** on 27 runs (30 sheets). The 3DBAG-verdict "placed" is not an Opus pass: see the open problems.

## Pipeline fixes (typed, tested in `vogelbuurt.test.ts`, byte-identical for eaves over 6 m)
The measurers assumed a shopfront storey and a tall front, so a low front read as 100 % void and every dark window as a balcony:
`stripEvidence.bodyBandM`, `stripLikeness.bodyFromFor`, `stripStructure` (body from 1.0 m, no balcony on one storey), `stripPalette` default band,
`stripFoot` `maxM` (a dark timber band read as a 2.3 m facade foot), auto-place `eavesM` for fronts <= 5 m (own gutter, not dak70p), `doorSide` band for one storey fronts.
New match fields: `keepSurveyRoof` (no frontRoof re-pitch under 3DBAG's mean eaves), `frontEavesUnscored` (the skyline reads gable apexes and dormer tops, not the cornice).

## Colour (Indische lessons)
Strips of one date differ 2x in exposure (raw brick medians 77-221 on 2025-09-22), and the trim normalisation locks onto hedges and the dark band, so `measuredWall` is off on both cottage types: one brick tone `#8f6a58` (median of the 8 darker strips lifted x1.5), flagged in each type. The 1921 type measures per pand; the cyan 2025 cast (Pluvierplein read green) and a purple 2021 wall are pinned in `vogelbuurt-noord-review-palettes.json`.

## Review pins (lane, from the sheets; an Opus reviewer must check them)
`vogelbuurt-noord-review-{types,crowns,palettes,holds}.json`: types per face, 11 block-end gable crowns, 12 mirrors read from the window pair, 6 palette rows, 1 hold.

## Open problems
* Every `step-gable` run fails the geometry-audit gate: coplanar overlap 1.0 m2 per gable (wall against the saddle roof tile at the free end of the run, y 9.3-9.5) against the 0.5 m2 `geometry-audit-baseline.json` allowance. Not weakened. `roof.source: 3dbag` fails "Shell top exceeds observed frontage body". Needs a kit fix in the saddle-under-gable roof or the audit's treatment of a run's free end before any gable run can install.
* Mirrors of the unpinned runs come from edge NCC (doors are hidden by hedges); several cottage runs have door/window order not confirmed.
* The 10 m double pands (36 vetoed) need a two-front placement (`fronts` with `share`), not automated in auto-place.

## Round 3 (Opus verdict applied, 2026-11-10)

- Verdict fixes applied: timber-band stone #d6d9cc and dormerAt {0.10, 0.72}; brick #74584a on the three 1918 types; crown pins (Flamingostraat 6 removed, Pelikaanstraat 3 and 9 added); every HOLD pinned in `vogelbuurt-noord-review-holds.json` (32 holds: the 7 step-gable runs in full, Pelikaanstraat 3 and 9, Kalkoenstraat 12, and the listed cottage and timber-band pands).
- Kit: `dormerLights` (intent field, validated 2..8, crown key in houseType) replaces fit.ts's fixed single bar; timber-band 5 lights, 1921 row 4. Absent = `[.5]`, byte-identical. Test in vogelbuurt.test.ts.
- Re-sheets: `source-data/block-face-strips/vogelbuurt-20261110/resheet/` (18 runs; the held runs have no sheet now).
- Install via the batch judge steps (`batch.ts --install --photo-decides`): only the four Meeuwenplein runs (11 pands) passed every gate on the strips Opus reviewed. 14 of the other verdict-install pands failed the batch strip-quality gate (cold cast / blown / cyan cast on the 2025-09-22 strips; list in `resheet/batch-gates-all17.log`, run before the faces were reset). The batch restripped 5 faces to other dates (vogel-1-15, vogelplantsoen-8-12, vogel-2-16-122155, zamenhof-6-12, pelikaan-3-9) and installed 4 runs on those unreviewed photos; those installs were backed out (chunks, GLBs and golden restored) because Opus never saw those strips and vogel-1-15 split differently (2+3 instead of 3). Four verdict pands are single survivors of their run (Vierde Vogelstraat 4, Derde Vogelstraat 11, Zamenhofstraat 50, 82) and cannot be a block face ("needs two houses").
