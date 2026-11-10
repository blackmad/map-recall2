# Frederik Hendrikbuurt-Zuidoost (EJ03), 2026-11-10

Lane `lane/buurt-frederikhendrik-20261110`, MODEL: sonnet. 9 pands installed (4 chunks). Sheets and strips:
`/Users/blackmad/Code/map-recall2-source-data/block-face-strips/frederik-hendrikbuurt-20261110/` (`sheet-<run>.png`, `strip-<face>.jpg`).

## Census
421 BAG pands in the survey (the ride-ring table says 482 by units), 77 proposed faces, no library before. Build years: 1880s 144, 1890s 141, 1900s 85, 1910s 19, later 30.
Intake ran for 8 faces: houweningen-1-31, houweningen-2-38, reigersbergen-1-37, hendrik-134-154 (all 1887-88), hogerbeets-111-135 (1901-10), groot-3-19, oldenbarneveldt-47-87 and -82-112.
Only the first four were run through auto-place; the last four have strips but were not read or typed.

## Designs (read off the strips)
| design | faces | pands | type |
|---|---|---|---|
| 1885-90 four storeys over a red-door ground: 3 axes on ~4.7 m, white dentil lintels, white cornice, one pediment dormer, some pointed gables | houweningen-1-31 (odd side), hendrik-134-154, reigersbergen-1-37 (compile failure) | ~45 | `fh-1887-dentil-pediment` (new, `types/frederik-hendrikbuurt/`) |
| Houweningenstraat 2-38 (even side, 1888): wide paired casements, ribbon read by the era guard | houweningen-2-38 | 19 | NO TYPE |
| Hogerbeetsstraat 111-135 (1901-10): arched twin windows, step gables | hogerbeets-111-135 | 13 | NO TYPE, not attempted |
| groot-3-19, oldenbarneveldt faces | | | not reviewed |

## Yield (houweningen-1-31, hendrik-134-154 = 29 pands; reigersbergen-1-37 19; houweningen-2-38 19)
* vetoed before comparison: 4 frontage (double-width pands), 3 era guard (ribbon windows) on houweningen-1-31; houweningen-2-38 19 held with no type (era guard and low NCC)
* compared and held: NCC 0.111-0.146 under the 0.15 gate (11), likeness FAIL, run of one between held neighbours (3); reigersbergen-1-37 17 held: the run does not compile ("Roof partition must preserve surveyed footprint", pand 166918)
* placed 18 by auto-place, **installed 9** (batch: houweningen-1-31-r2 2, -r3 3, hendrik-134-154-r1 2, -r2 2). houweningen-1-31-r1 failed the GLB audit, -r4 failed likeness (159954 NCC 0.138).

## Likeness (my own look at every sheet; not an Opus review)
Right: four storeys, three axes, rhythm, brick tone, white frames, slate roof, centre pediment dormer, red door pair on the correct side (mirrors pinned from the photos).
Wrong or missing: the white dentil lintels and white sill bands (drawn as a plain stone lintel), the double door is one narrow door, the ground window is two plain lights instead of a wide casement, pointed gables on 159954, 158307, 152931 were pinned but the pands were held on NCC so they are not installed, arched ground and storey heads on the gable pands.
The marginal holds (NCC 0.144-0.146) were not rescued by weakening the gate.

## Review pins (lane; an Opus reviewer must check)
`buurten/frederik-hendrikbuurt-zuidoost-review-types.json` (6 mirrors) and `-review-crowns.json` (3 gable pins).

## Kit cannot yet express
* white dentil lintels (stepped brick-and-stone teeth) over windows;
* a pair of doors under one transom (double door 1.3 m);
* a wide ground casement beside the doors;
* round-arched window heads with dressed keystones on the gable pands (Houweningenstraat 31);
* pointed gable with a flanking shouldered step as on Frederik Hendrikstraat 134.

## Integrator notes
Rebuild: `npx tsx scripts/look/build-chunk-wall-exposure.ts --write`, covers, bake-frontages, buurt pages, explorer-looks; commit the source-data repo. `roof-golden.json` re-recorded (4 new runs only). `npm run test:block-face` 322/322, `npm run lint` clean.
