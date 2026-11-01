# Lane: Transvaalbuurt 1929–1931 blocks (2026-11-01, #153)

Branch `lane/transvaalbuurt-1929-blocks-20261101`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/transvaalbuurt-1929-blocks-20261101`, dev port 4605.
Read `docs/handoffs/LANE-RULES.md` first. Use `/usr/bin/git`. Model: opus.

Earlier rounds: `docs/handoffs/lane-transvaalbuurt-kit-20261031.md` (#149, the 1923 portiek
types), `lane-transvaalbuurt-types-2-20261031.md` (#151, the stair-block frontage and the 1911
twins, read its "State"), `lane-transvaalbuurt-install-3-20261101.md` (#152, `roof.rakeClear`,
`match.crownFromType`, crown pins; read its "State" if present, else the HISTORY entry quoted
there is not for you: do not open HISTORY). Method: `docs/buurt-generator-20261016.md`
"Transvaalbuurt lessons" points 1–7. Type examples to copy the shape of:
`scripts/block-face/types/transvaalbuurt/transvaal-1911-five-storey.json` and
`transvaal-1923-portiek-tower.json` (match block with `frontage: {mode: "stair-block"}`,
`crownFromType`, measured palette, body, roof).

## Why

The user asked why so few Transvaalbuurt buildings are modelled. Of 848 pands on photographed
faces, 380 are vetoed on build year alone because the library has types for two of the buurt's
seven families. This lane authors the 1929–1931 family: 120 pands on 22 intaked faces, the
largest uncovered family. Three parallel lanes do the other families and the 1911 variants
(#154, #155, #156); you share the library directory with them but not any type file.

The 164 strips of both buurten are in `staging/block-face/<face>/strip.jpg` already. Do not
re-survey. Survey data: `scripts/block-face/buurten/transvaalbuurt-{west,oost}.json` (faces,
`yearMode`, storeys, eaves, widths, intake reasons).

## The family

Five-storey blocks of 1929–1931, mostly on the ring streets, with round or polygonal corner
towers at the junctions (the design the user's photo of Albert Luthulistraat 29–31 stands
opposite). Faces, by pand count, with the survey's storeys / 3DBAG eaves / mean width:

| face | street | pands | years | st | eaves | width |
|---|---|---|---|---|---|---|
| tugelaweg-91-112 | Tugelaweg 91–112 | 11 | 1929 | 5 | 12.7 | 14.2 |
| burger-45-131 | Schalk Burgerstraat 45–131 | 9 | 1931 | 5 | 13.8 | 9.2 |
| afrikanerplein-1-15 | Afrikanerplein 1–15 | 7 | 1929 | 5 | 15.6 | 5.9 |
| wet-116-220 | Christiaan de Wetstraat 116–220 | 7 | 1928–29 | 5 | 14.1 | 13.0 |
| kruger-5-27 | Krugerstraat 5–27 | 6 | 1930 | 5 | 12.2 | 13.5 |
| luthuli-6-20 | Albert Luthulistraat 6–20 | 4 | 1930 | 5 | 13.7 | 14.1 |
| wet-230-272 | Christiaan de Wetstraat 230–272 | 4 | 1929 | 5 | 12.7 | 8.0 |
| joubert-19-25 | Joubertstraat 19–25 | 4 | 1929 | 5 | 13.0 | 6.3 |
| kruger-32-40, kruger-29-35 | Krugerstraat | 4 + 4 | 1929–31 | 5 | 13.4–14.9 | 6.5–8 |
| tugelaweg-113-120 | Tugelaweg 113–120 | 4 | 1929 | 5 | 12.2 | 14.3 |
| afrikanerplein-25-55 | Afrikanerplein 25–55 | 14 | 1931 (+1989 infill) | 5 | 14.9 | 8.2 |
| reij-8-24 | De la Reijstraat 8–24 | 7 | 1920–31 mixed | 5 | 12.1 | 7.5 |
| vaalrivier-2-14, vaalrivier-3-9 | Vaalrivierstraat | 7 + 6 | 1931 | 3 | 6.7–7.5 | 7–8.7 |

Expect one five-storey block design (possibly a low-ground and tall-ground twin as in 1911),
a corner-tower variant where the pand is the junction pand, and a separate three-storey 1931
row on Vaalrivierstraat (13 pands; author it only if its strips show one design).

## Steps

1. Look at the strips of the five largest faces side by side (make a contact sheet in
   `staging/block-face/transvaalbuurt/1929/`). Write down, in metres from a 1 m grid on the
   strip, the storey heights, window axes per stair block, window shape and frame colour, brick
   tone (measured, `measureFacade.ts`), parapet or eaves line, roof (flat with setback storey?
   tile?), balconies, the tower's plan and height. Decide the sub-types before writing JSON.
2. Author `scripts/block-face/types/transvaalbuurt/transvaal-1929-block.json` (and `-tower` /
   `-tall` / `vaalrivier-1931-row` if the strips demand them). Match block: years [1928, 1931],
   `frontage: {mode: "stair-block", ...}` with the width range you measured, storeys, axis
   pitch; `crownFromType` as in the 1911 types; measured palette with evidence. Test file next
   to the library's existing test (`transvaalbuurt.test.ts`) with the facts of two real pands
   per type.
3. Kit components the strips need and the kit lacks: add them typed, tested, byte-identical
   when absent (`roof-golden.ts` 0, `test:building-recipes` 0 changes). Likely: a round or
   polygonal corner tower with its own window rhythm, a flat roof with a setback top storey
   (also the known gap on the installed 1923 row; if you add it, say so, do not re-install that
   row), horizontal band windows. Reuse `parapet.band`, `tower`, `balconies` where they fit.
4. Auto-place: `npm run block-face:auto-place -- --buurt=transvaalbuurt-oost
   --district=transvaalbuurt --review`, then `-west`. Report the family's outcome split: vetoed
   before comparison / compared and held / placed, for 1928–1931 pands only, and the buurt
   totals.
5. Compile every placed face, GLB audit, review every placement at gallery size beside its strip
   (`review.ts --face=`, `review/strip-sheet.png`). Holds with one-line reasons go into
   `scripts/block-face/buurten/transvaalbuurt-{oost,west}-review-holds.json` (append; three
   other lanes append too, keep your entries at the end). Crown pins in `-review-crowns.json`
   the same way.
6. Batch-install the faces that pass, Oost first in ride order
   (`scripts/block-face/batch.ts --name=transvaalbuurt-1929-oost --buurt=transvaalbuurt-oost
   --district=transvaalbuurt --ride --install`, then West). Commit the chunk GLBs and
   `chunks.json`. The buurt batch skips faces marked `covered` in the buurt doc; re-run those by
   hand if they are in your family.
7. Before/after for the user: strip-over-model sheets of Tugelaweg 91–112 and Schalk
   Burgerstraat 45–131 in `staging/block-face/transvaalbuurt/1929/`, same layout as round 3's
   (`retief-45-75-strip-over-model.png` in the #152 state), and one street screenshot per
   installed row via `tests/e2e/demo-shots.spec.ts` (add your spots as #152 did,
   `PW_PORT=4605`, one Playwright run through `/tmp/canal-pw.sh`).

## Shared files, four lanes at once

`transvaalbuurt-{oost,west}-placement.json` and the per-face `auto-place.json` records will
conflict between lanes; commit yours anyway, the integrator regenerates them after the merge.
`chunks.json` and the review-holds/crowns files are merged as unions. Do not touch any type
file you did not create, `autoPlace.ts` beyond what your type needs (lane #156 owns the
lone-pand rule), `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, bundles, `covers.json`,
goldens, baselines. Do not loosen the GLB audit, the likeness gate or the review bar.

## Report

LANE-RULES hand-back block, plus: the family outcome split (before: all 120 vetoed on year),
installed faces with pand counts, holds with reasons, what the kit still cannot say for this
family, which installed faces you recompiled to prove byte-identity, and INTEGRATOR TODO with
the exact covers and exposure commands (`npx tsx scripts/look/build-chunk-wall-exposure.ts
--write`; `node --max-old-space-size=8192 --import tsx scripts/build-covers.ts
--tiles=public/data/extracts/amsterdam/bag-tiles/14`; roof goldens per run with
`roof-golden.ts --write --face=<run>`). Checks before hand-back: `npm run -s test:block-face`,
`npm run -s test:building-recipes`, `node --import tsx scripts/block-face/roof-golden.ts`,
`npm run lint`.
