# Lane: Transvaalbuurt 1920–1922 rows, two families (2026-11-01, #154)

Branch `lane/transvaalbuurt-1920-rows-20261101`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/transvaalbuurt-1920-rows-20261101`, dev port 4524.
Read `docs/handoffs/LANE-RULES.md` first. Use `/usr/bin/git`. Model: opus.

Earlier rounds: `docs/handoffs/lane-transvaalbuurt-kit-20261031.md` (#149),
`lane-transvaalbuurt-types-2-20261031.md` (#151, read its "State": stair-block frontage, the
1911 twins), `lane-transvaalbuurt-install-3-20261101.md` (#152: `roof.rakeClear`,
`match.crownFromType`, crown pins). Method: `docs/buurt-generator-20261016.md` "Transvaalbuurt
lessons" points 1–7. Copy the shape of
`scripts/block-face/types/transvaalbuurt/transvaal-1911-five-storey.json` (match block with
`frontage: {mode: "stair-block"}`, `crownFromType`, measured palette, body, roof). Do not open
HISTORY or TODO.

## Why

Of 848 Transvaalbuurt pands on photographed faces, 380 are vetoed on build year alone because
the library covers two of seven families. This lane covers the 1920–1922 years: 129 pands on
28 intaked faces, in two clearly different families. Three parallel lanes do the 1929–1931
blocks (#153), the 1926–1928 rows (#155) and the 1911 variants (#156).

The 164 strips are in `staging/block-face/<face>/strip.jpg`. Do not re-survey. Survey data:
`scripts/block-face/buurten/transvaalbuurt-{west,oost}.json`.

## Family A: 1920–1922 three-storey rows (about 60 pands)

Low rows of narrow houses, 3DBAG eaves 5–8.5 m, widths about 6 m, one house per pand (so the
house-width veto, not the stair-block mode, may be right here; decide from the strips).

| face | street | pands | years | eaves | width |
|---|---|---|---|---|---|
| kraaipan-53-61 | Kraaipanstraat 53–61 | 5 | 1920 | 6.8 | 6.2 |
| kraaipan-42-48 | Kraaipanstraat 42–48 | 4 | 1920 | 8.2 | 5.9 |
| kraaipan-23-29 | Kraaipanstraat 23–29 | 4 | 1920–21 | 6.5 | 6.2 |
| kraaipan-5-9 | Kraaipanstraat 5–9 | 3 | 1921 | 5.8 | 6.0 |
| reij-28-42 | De la Reijstraat 28–42 | 6 | 1920 | 6.1 | 6.2 |
| reij-25-39 | De la Reijstraat 25–39 | 6 | 1900–21 | 5.0 | 6.2 |
| transvaal-131-143 | Transvaalstraat 131–143 | 7 | 1922 | 6.2 | 6.3 |
| colenso-14-28, colenso-13-25 | Colensostraat | 4 + 4 | 1922 | 5.0–5.8 | 6.0 |
| vaalrivier-15-21 | Vaalrivierstraat 15–21 | 4 | 1920 | 5.7 | 6.0 |
| nek-60-162 | Laing's Nekstraat 60–162 | 4 | 1922 | 8.5 | 10.6 |

## Family B: 1921–1922 five-storey rows (about 44 pands)

| face | street | pands | years | eaves | width |
|---|---|---|---|---|---|
| transvaal-106-140 | Transvaalstraat 106–140 | 16 | 1913–22 mixed | 13.4 | 7.8 |
| retief-194-268 | Retiefstraat 194–268 | 9 | 1921 | 12.9 | 7.1 |
| retief-2-28 | Retiefstraat 2–28 | 8 | 1922 | 13.6 | 13.1 |
| tugelaweg-19-31 | Tugelaweg 19–31 | 7 | 1922 | 12.8 | 16.6 |
| cronj-1-17 | Cronjéstraat 1–17 | 7 | 1922–29 | 9.3 (4 st) | 9.8 |

Round 2 found Retiefstraat 194–268 and Tugelaweg 19–31 are "plain flat rows" and "oriel rows
with roof dormers", not the 1923 portiek design; Transvaalstraat 106–140 was "the 1925 lisene
design". So family B may be two or three designs. Author what the strips show, one type per
design that has 8 or more pands; smaller designs are reported, not authored.

## Steps

1. Contact sheets per family in `staging/block-face/transvaalbuurt/1920/`. Measure on a 1 m
   grid: storey heights, axes per house or stair block, window shape, frame colour, brick tone
   (`measureFacade.ts`), eaves or parapet line, roof kind and pitch, dormers, balconies.
2. Author `scripts/block-face/types/transvaalbuurt/transvaal-1920-three-storey.json` and
   `transvaal-1921-five-storey*.json` (one per design). Match block: years, frontage mode you
   decided, storeys, axis pitch, `crownFromType`, measured palette with evidence. Tests next to
   `transvaalbuurt.test.ts` with two real pands' facts per type.
3. Kit components the strips need and the kit lacks: typed, tested, byte-identical when absent
   (`roof-golden.ts` 0, `test:building-recipes` 0 changes). Likely: a shallow mansard or tile
   roof with wall dormers on the three-storey rows, oriels on the 1922 rows, lisenes.
4. Auto-place both buurten (`npm run block-face:auto-place -- --buurt=transvaalbuurt-oost
   --district=transvaalbuurt --review`, then `-west`). Report the outcome split per family for
   1920–1922 pands: vetoed before comparison / compared and held / placed.
5. Compile, GLB audit, review every placement at gallery size beside its strip. Holds with a
   reason each appended to `transvaalbuurt-{oost,west}-review-holds.json`; crown pins to
   `-review-crowns.json`.
6. Batch-install the passing faces, Oost first in ride order
   (`scripts/block-face/batch.ts --name=transvaalbuurt-1920-oost --buurt=transvaalbuurt-oost
   --district=transvaalbuurt --ride --install`, then West). Commit the chunk GLBs and
   `chunks.json`.
7. Before/after sheets of Retiefstraat 194–268 and Kraaipanstraat 53–61 in
   `staging/block-face/transvaalbuurt/1920/` (layout of #152's
   `retief-45-75-strip-over-model.png`), plus one street screenshot per installed row via
   `tests/e2e/demo-shots.spec.ts` (`PW_PORT=4524`, one Playwright run through
   `/tmp/canal-pw.sh`).

## Shared files, four lanes at once

Placement and per-face `auto-place.json` records will conflict between lanes; commit yours,
the integrator regenerates them. `chunks.json`, review-holds and review-crowns are merged as
unions. Do not touch type files you did not create, `autoPlace.ts` beyond what your types need
(#156 owns the lone-pand rule), `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, bundles,
`covers.json`, goldens, baselines. Do not loosen the GLB audit, likeness gate or review bar.

## Report

LANE-RULES hand-back block, plus: outcome split per family (before: all vetoed on year),
installed faces with pand counts, holds with reasons, what the kit still cannot say, which
installed faces you recompiled to prove byte-identity, INTEGRATOR TODO with the exact covers
and exposure commands (`npx tsx scripts/look/build-chunk-wall-exposure.ts --write`; `node
--max-old-space-size=8192 --import tsx scripts/build-covers.ts
--tiles=public/data/extracts/amsterdam/bag-tiles/14`; `roof-golden.ts --write --face=<run>`
per run). Checks before hand-back: `npm run -s test:block-face`, `npm run -s
test:building-recipes`, `node --import tsx scripts/block-face/roof-golden.ts`, `npm run lint`.
