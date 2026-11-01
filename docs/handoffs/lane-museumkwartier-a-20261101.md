# Lane: Museumkwartier survey A, Cornelis Schuytbuurt and Concertgebouwbuurt (2026-11-01, #159)

Branch `lane/museumkwartier-museum-a-20261101`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/museumkwartier-museum-a-20261101`, dev port 4659.
Read `docs/handoffs/LANE-RULES.md` first. Use `/usr/bin/git`. Model: opus.

Method, read in full: `docs/buurt-generator-20261016.md` (the Bellamy recipe and the ten
"Transvaalbuurt lessons"). Briefs to copy the shape of:
`docs/handoffs/lane-transvaalbuurt-kit-20261031.md` (a first buurt lane: survey, exemplar,
type, install) and `lane-transvaalbuurt-1926-rows-20261101.md` (a family lane). Type examples:
`scripts/block-face/types/oud-west/*.json` (14 types, 1890–1910 rows across the Vondelpark),
`scripts/block-face/types/helmersbuurt/*.json`, `scripts/block-face/types/transvaalbuurt/transvaal-1926-band-row.json`
(the current match-block shape: `frontage`, `crownFromType`, measured palette with evidence).
Do not open HISTORY or TODO.

## Why

Museumkwartier is the most-ridden wijk inside the ring with no type library: 2,892 pands, 1 %
modelled, repetition 0.31, built 1890–1910, the same stock as Helmersbuurt and Oud-West across
the park, which have measured types already. This lane takes the two buurten around the
Concertgebouw and Van Baerlestraat; lane #160 takes Hondecoeterbuurt, Johannes Vermeerbuurt and
Duivelseiland in parallel. Both write new types into one new library directory,
`scripts/block-face/types/museumkwartier/`, in separate files; coordinate names by prefixing
yours `museum-cs-` (Cornelis Schuyt) or `museum-cg-` (Concertgebouw).

| buurt | code | pands | repetition | decade | top clusters (w×d×year) |
|---|---|---|---|---|---|
| Cornelis Schuytbuurt | KD02 | 742 | 0.36 | 1900 | 6×15×1900 ×99, 5×12×1900 ×75, 6×12×1900 ×75 |
| Concertgebouwbuurt | KD03 | 503 | 0.21 | 1890 | 6×15×1895 ×38, 6×15×1900 ×33, 5×12×1895 ×28 |

## Steps

1. **Survey with intake**, one buurt at a time, in the background with an 1800 s timeout:
   `npm run block-face:buurt-survey -- --buurt="Cornelis Schuytbuurt" --slug=cornelis-schuytbuurt --intake`
   then the same for `Concertgebouwbuurt` / `concertgebouwbuurt` (the `--buurt` value is the
   gebieden API name; check `scripts/block-face/buurt-survey.ts` for the exact matching if it
   fails). The survey writes `scripts/block-face/buurten/<slug>.json` and the strips to
   `staging/block-face/<face>/strip.jpg`. Report faces proposed / intaked / failed intake and
   why (the bend split at 11° is in; expect trees and oblique panos).
2. **Cluster by build-year family** from the survey's `yearMode` per face: a family of 8 or
   more faces is a type candidate. Contact sheet per family in
   `staging/block-face/museumkwartier/a/` and three strips per family looked at; count the
   designs inside each family (round 4 found a year band holds up to eight designs).
3. **Try the existing libraries first.** Run auto-place against `oud-west`, then
   `helmersbuurt`, then `de-pijp`, then `bellamy`:
   `npm run block-face:auto-place -- --buurt=cornelis-schuytbuurt --district=oud-west --review --photo-decides`
   (and the other buurt). Report, per library and per family, the outcome split: vetoed before
   comparison / compared and held / placed. A library whose types place with edge NCC ≥ 0.15
   on a family is reused as-is (install from it, library `oud-west`); do not copy types across
   libraries.
4. **Author one measured type** for the largest family no library fits: 1 m gridded strips,
   storey heights, axes, window kind and head, frames, brick tone (measured, with evidence),
   speklagen and white accents (the user's standing priority for this era), cornice or gable,
   roof. Match block with the frontage mode the pands justify (one house per pand here, most
   likely: the house-width veto), `crownFromType`, test with two real pands' facts. Add the
   kit parts the strips need, typed, tested, byte-identical when absent (`roof-golden.ts` 0,
   `test:building-recipes` 0 changes).
5. Auto-place with the new type (`--district=museumkwartier`), compile, GLB audit, review
   every placement at gallery size beside its strip, holds with reasons in
   `scripts/block-face/buurten/<slug>-review-holds.json`, crown/door pins in the matching
   review files. Install what passes with the batch's judge steps per reviewed run (lane
   #155's driver pattern), ride order first; commit chunk GLBs and `chunks.json`. Do not run
   `batch.ts --buurt` (it ignores `--faces` and re-places every face; lane #157 is fixing it).
6. Before/after strip-over-model sheets of the two largest faces per buurt in
   `staging/block-face/museumkwartier/a/`, and one street screenshot per installed row
   (`tests/e2e/demo-shots.spec.ts`, `PW_PORT=4659`, one Playwright run through
   `/tmp/canal-pw.sh`).

## Pipeline traps (until #157 lands)

Auto-place re-runs overwrite installed run dirs (restore from HEAD); measure one brick per row
from tree-free columns, the batch's per-pand refit reads hedge green; OSM street furniture
becomes a false shopfront (hold such pands with that reason); keep every strip (the integrator
archives `staging/block-face/*/strip.jpg` to source-data).

## Report

LANE-RULES hand-back block plus: survey counts, the family table (years, faces, pands,
designs seen), the outcome split per library and per family, the type(s) authored, installed
faces with pand counts, holds with reasons, what the kit cannot say, INTEGRATOR TODO with the
covers, exposure, roof-golden and buurt-page commands (`npx tsx
scripts/look/build-chunk-wall-exposure.ts --write`; `node --max-old-space-size=8192 --import
tsx scripts/build-covers.ts --tiles=public/data/extracts/amsterdam/bag-tiles/14`;
`roof-golden.ts --write --face=<run>`; `npm run build:buurt-pages`). Checks before hand-back:
`npm run -s test:block-face`, `npm run -s test:building-recipes`, `node --import tsx
scripts/block-face/roof-golden.ts`, `npm run lint`. Do not touch `TODO.md`, `HISTORY.md`,
`whats-new-notes.json`, bundles, `covers.json`, goldens, baselines, or lane #160's type files.
