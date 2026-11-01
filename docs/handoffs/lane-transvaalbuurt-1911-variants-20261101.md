# Lane: Transvaalbuurt 1911 sub-variants and the lone-pand rule (2026-11-01, #156)

Branch `lane/transvaalbuurt-1911-variants-20261101`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/transvaalbuurt-1911-variants-20261101`, dev port 4693.
Read `docs/handoffs/LANE-RULES.md` first. Use `/usr/bin/git`. Model: opus.

Earlier rounds: `docs/handoffs/lane-transvaalbuurt-types-2-20261031.md` (#151, "State": the
1911 twins, stair-block frontage), `lane-transvaalbuurt-install-3-20261101.md` (#152:
`roof.rakeClear`, `match.crownFromType`, `stripSkyBound.ts`, crown pins, the holds). Method:
`docs/buurt-generator-20261016.md` "Transvaalbuurt lessons" points 1–7. Do not open HISTORY or
TODO.

## Why

Round 3 installed 10 of the 274 pands of the 1908–1914 family. Inside that family the holds
name the same few things again and again, and the auto-place rule that a run of one pand is
not installed holds 57 pands across the buurt (43 Oost, 14 West). This lane adds the kit
variants and the opt-in that release them, then re-runs the family. Three parallel lanes
author the other families (#153 1929–1931, #154 1920–1922, #155 1926–1928); you own
`autoPlace.ts` for the lone-pand change, they do not touch it.

The 164 strips are in `staging/block-face/<face>/strip.jpg`. Do not re-survey. The round-3
holds, with the exact pands, are in
`scripts/block-face/buurten/transvaalbuurt-oost-review-holds.json`; the round-3 review sheets
are archived in `/Users/blackmad/Code/map-recall2-source-data/block-face-strips/transvaalbuurt-round3/`.

## Kit variants (typed, tested, byte-identical when absent: `roof-golden.ts` 0, `test:building-recipes` 0 changes)

1. **Low shouldered gable.** Retiefstraat 71D–73A and most 1911 gables are low and broad with
   shoulders (a short vertical at each side, then a shallow slope to a flat or pointed top),
   not the kit's steep point gable. Add it as a gable kind (e.g. `gable: "shouldered"` with
   `shoulderM` and `riseM`), with `roof.rakeClear` behaving the same under it. Measure the
   shoulder height and rise on the strips of Retiefstraat 45–75 and Transvaalstraat 3–47. Then
   the 1911 types' default crown becomes this gable where the strips show it; re-review the
   three installed Retiefstraat pands and say whether their crowns should change (do not
   re-install them yourself; report).
2. **One gable over two pands.** Transvaalstraat 42–44 (and others) carry one ornamented gable
   centred on the party wall of two pands. Add a face-level intent (`sharedCrown` across two
   adjacent pands, or a `crownSpan: 2` on the first pand) so the compile draws one crown over
   both; the GLB audit must stay clean at the party line.
3. **Dormer whose glass stays inside the roof plane.** Transvaalstraat 39–41 and 43B–45A show a
   white timber dormer; drawn today its glass passes the roof plane (GLB audit opening-outside,
   2.5 m²). Fix the dormer body so its window sits in the dormer's own front wall above the
   roof plane, and add the white timber body option if `dormerBody` lacks it.
4. **Lone pand opt-in.** In `autoPlace.ts` (or `batch.ts`, wherever "a single placed pand
   between held neighbours or the face end" is decided) add a per-type opt-in, e.g.
   `match.frontage.minRun: 1` for stair-block types, defaulting to today's rule for every other
   type (Bellamy records byte-identical; test it with two real Bellamy faces' records and two
   Transvaalbuurt ones). A stair block of 5 m or more stands on its own; keep the rule for
   pands narrower than 5 m. Both 1911 types and both 1923 types opt in.

## Then

5. Re-run auto-place for both buurten (`npm run block-face:auto-place --
   --buurt=transvaalbuurt-oost --district=transvaalbuurt --review`, then `-west`). Report the
   1908–1914 family's outcome split against round 3 (Oost 147 vetoed / 284 held / 10 installed)
   and how many lone pands the opt-in released.
6. Compile, GLB audit, review every new placement at gallery size beside its strip. Holds with
   a reason each appended to the review-holds files; crown pins to `-review-crowns.json`.
7. Batch-install the passing faces, Oost first in ride order
   (`scripts/block-face/batch.ts --name=transvaalbuurt-1911b-oost --buurt=transvaalbuurt-oost
   --district=transvaalbuurt --ride --install`, then West). Commit the chunk GLBs and
   `chunks.json`. The batch skips faces marked `covered` in the buurt doc (`transvaal-3-47`,
   `transvaal-49-63`, `pretorius-53-69`); run those by hand.
8. Before/after sheets of Transvaalstraat 3–47 and Retiefstraat 45–75 in
   `staging/block-face/transvaalbuurt/1911b/` (layout of #152's
   `retief-45-75-strip-over-model.png`), plus one street screenshot per installed row via
   `tests/e2e/demo-shots.spec.ts` (`PW_PORT=4693`, one Playwright run through
   `/tmp/canal-pw.sh`).

## Shared files, four lanes at once

Placement and per-face `auto-place.json` records will conflict between lanes; commit yours,
the integrator regenerates them. `chunks.json`, review-holds and review-crowns are merged as
unions. Do not touch type files of other families, `TODO.md`, `HISTORY.md`,
`whats-new-notes.json`, bundles, `covers.json`, goldens, baselines. Do not loosen the GLB
audit, likeness gate or review bar.

## Report

LANE-RULES hand-back block, plus: the family outcome split before/after, lone pands released,
installed faces with pand counts, holds with reasons, one sentence per kit variant, whether the
installed Retiefstraat crowns should change, which installed faces you recompiled to prove
byte-identity, INTEGRATOR TODO with the exact covers and exposure commands (`npx tsx
scripts/look/build-chunk-wall-exposure.ts --write`; `node --max-old-space-size=8192 --import
tsx scripts/build-covers.ts --tiles=public/data/extracts/amsterdam/bag-tiles/14`;
`roof-golden.ts --write --face=<run>` per run). Checks before hand-back: `npm run -s
test:block-face`, `npm run -s test:building-recipes`, `node --import tsx
scripts/block-face/roof-golden.ts`, `npm run lint`.
