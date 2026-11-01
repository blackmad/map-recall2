# Lane: Transvaalbuurt 1926–1928 band-window rows (2026-11-01, #155)

Branch `lane/transvaalbuurt-1926-rows-20261101`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/transvaalbuurt-1926-rows-20261101`, dev port 4539.
Read `docs/handoffs/LANE-RULES.md` first. Use `/usr/bin/git`. Model: opus.

Earlier rounds: `docs/handoffs/lane-transvaalbuurt-kit-20261031.md` (#149),
`lane-transvaalbuurt-types-2-20261031.md` (#151, read its "State": stair-block frontage, the
1911 twins), `lane-transvaalbuurt-install-3-20261101.md` (#152: `roof.rakeClear`,
`match.crownFromType`, crown pins). Method: `docs/buurt-generator-20261016.md` "Transvaalbuurt
lessons" points 1–7. Copy the shape of
`scripts/block-face/types/transvaalbuurt/transvaal-1911-five-storey.json` and
`transvaal-1923-portiek.json`. Do not open HISTORY or TODO.

## Why

Of 848 Transvaalbuurt pands on photographed faces, 380 are vetoed on build year alone because
the library covers two of seven families. This lane covers 1926–1928: 50 pands on 8 intaked
faces, a compact family around Danie Theronstraat and Hofmeyrstraat with long horizontal
window bands (Amsterdam School late phase). Three parallel lanes do the 1929–1931 blocks
(#153), the 1920–1922 rows (#154) and the 1911 variants (#156).

The 164 strips are in `staging/block-face/<face>/strip.jpg`. Do not re-survey. Survey data:
`scripts/block-face/buurten/transvaalbuurt-{west,oost}.json`.

## The family

| face | street | pands | years | st | eaves | width |
|---|---|---|---|---|---|---|
| theron-2-36 | Danie Theronstraat 2–36 | 11 | 1926–28 | 5 | 12.5 | 8.3 |
| theron-9-37 | Danie Theronstraat 9–37 | 10 | 1927–28 | 5 | 12.9 | 9.2 |
| hofmeyr-24-44 | Hofmeyrstraat 24–44 | 10 | 1927–28 | 5 | 14.7 | 7.0 |
| afrikanerplein-14-168 | Afrikanerplein 14–168 | 5 | 1926 (+1992) | 5 | 14.9 | 21.2 |
| viljoen-16-24 | Ben Viljoenstraat 16–24 | 5 | 1926 | 5 | 13.0 | 6.6 |
| steyn-9-19 | President Steynstraat 9–19 | 5 | 1928 | 5 | 13.2 | 6.4 |
| hofmeyr-3-7 | Hofmeyrstraat 3–7 | 2 | 1928 | 4 | 12.6 | 7.3 |
| transvaalkade-130-132 | Transvaalkade 130–132 | 2 | 1928 | 5 | 14.9 | 7.6 |

## Steps

1. Contact sheet of all eight strips in `staging/block-face/transvaalbuurt/1926/`. Measure on
   a 1 m grid: storey heights, the band-window rhythm (continuous bands or grouped windows,
   mullion pitch, sill and head lines), frame colour, brick tone (`measureFacade.ts`), parapet
   or eaves line, roof (flat? setback?), balconies or loggias, stair axes per pand. Decide
   whether it is one design or two.
2. Author `scripts/block-face/types/transvaalbuurt/transvaal-1926-band-row.json` (and a twin
   if needed). Match block: years [1926, 1928], `frontage: {mode: "stair-block", ...}` with the
   measured width range, storeys, axis pitch; `crownFromType`; measured palette with evidence.
   Test next to `transvaalbuurt.test.ts` with two real pands' facts.
3. Kit components the strips need and the kit lacks, typed, tested, byte-identical when absent
   (`roof-golden.ts` 0, `test:building-recipes` 0 changes). Likely: a horizontal band window
   (one opening spanning several axes with mullions), a flat roof with a parapet coping,
   loggias. If the flat roof with a setback storey is what the strips show, add it; it is also
   the known gap on the installed 1923 row (do not re-install that row, say so in the report).
4. Auto-place both buurten (`npm run block-face:auto-place -- --buurt=transvaalbuurt-oost
   --district=transvaalbuurt --review`, then `-west`). Report the family's outcome split for
   1926–1928 pands: vetoed before comparison / compared and held / placed.
5. Compile, GLB audit, review every placement at gallery size beside its strip. Holds with a
   reason each appended to `transvaalbuurt-{oost,west}-review-holds.json`; crown pins to
   `-review-crowns.json`.
6. Batch-install the passing faces, Oost first in ride order
   (`scripts/block-face/batch.ts --name=transvaalbuurt-1926-oost --buurt=transvaalbuurt-oost
   --district=transvaalbuurt --ride --install`, then West). Commit the chunk GLBs and
   `chunks.json`.
7. Before/after sheets of Danie Theronstraat 2–36 and Hofmeyrstraat 24–44 in
   `staging/block-face/transvaalbuurt/1926/` (layout of #152's
   `retief-45-75-strip-over-model.png`), plus one street screenshot per installed row via
   `tests/e2e/demo-shots.spec.ts` (`PW_PORT=4539`, one Playwright run through
   `/tmp/canal-pw.sh`).

## Shared files, four lanes at once

Placement and per-face `auto-place.json` records will conflict between lanes; commit yours,
the integrator regenerates them. `chunks.json`, review-holds and review-crowns are merged as
unions. Do not touch type files you did not create, `autoPlace.ts` beyond what your type needs
(#156 owns the lone-pand rule), `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, bundles,
`covers.json`, goldens, baselines. Do not loosen the GLB audit, likeness gate or review bar.

## Report

LANE-RULES hand-back block, plus: the family outcome split (before: all 50 vetoed on year),
installed faces with pand counts, holds with reasons, what the kit still cannot say, which
installed faces you recompiled to prove byte-identity, INTEGRATOR TODO with the exact covers
and exposure commands (`npx tsx scripts/look/build-chunk-wall-exposure.ts --write`; `node
--max-old-space-size=8192 --import tsx scripts/build-covers.ts
--tiles=public/data/extracts/amsterdam/bag-tiles/14`; `roof-golden.ts --write --face=<run>`
per run). Checks before hand-back: `npm run -s test:block-face`, `npm run -s
test:building-recipes`, `node --import tsx scripts/block-face/roof-golden.ts`, `npm run lint`.
