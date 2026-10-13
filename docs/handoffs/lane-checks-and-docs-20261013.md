# Lane: failing checks fixed or retired, docs compacted (process R5, 2026-10-13)

Plan: `docs/plans/digital-twin-direction-20261013.md` §6 "Process". Lane owns
test baselines, `scripts/check-*.ts` that are failing, and `docs/`. Do not
edit `game.js`, `index.html`, `package.json`, bundles, catalogues, `TODO.md`,
`HISTORY.md` (report the lines the integrator should change instead). Do not
change product behaviour to make a check pass; fix the check, refresh a
baseline only when the new render is the intended one and say why.

## Deliverables
1. **`storybook-visual` baselines**: 37 of 40 fail on main (Feedback button
   and HUD attribution text changed; the riding-prompt stories added
   2026-10-13 have fresh baselines). Confirm the diffs are only those two
   elements, re-record the baselines (`PW_PORT=4431`), and report any story
   whose diff is something else.
2. **`scripts/check-three-buildings.ts`** fails with "canal houses have flat
   lintels; arched hoods are 19th century" on main. Find the commit that
   changed the output (bisect over `src/canalRecall/threeBuildingFeatures.ts`
   / `look/palette.ts` history), decide whether the rule or the model is
   wrong, fix the right one.
3. **Checks named in TODO that fail or are not wired**:
   `check-building-look-transition`, `check-cinema-facade-surfaces`,
   `check-manual-landmarks`, `review-ride`. For each: run it, report
   pass/fail and runtime; if it passes and is cheap, propose adding it to
   `check:canal` (report the package.json line; do not edit package.json); if
   it is dead, propose deleting it with the reason.
4. **Docs compaction**: ~135 files under `docs/`. Produce
   `docs/README.md` as the index: four living documents
   (`docs/buildings-pipeline.md`, `docs/elevation.md`, `docs/LOOK.md`,
   `docs/gameplay/loop.md` — write the last one from
   `src/canalRecall/game/{questionBudget,ridingPrompt,teachingPacer}.ts` and
   the 2026-10-13 HISTORY entry), the plan, the handoffs, and a dated
   "research and spikes" list for the rest with one line each. Move nothing
   and delete nothing in this lane; mark in the index which research docs are
   superseded by a living document so the integrator can archive them later.

## Checks
`npm run lint`, `npm run build-storybook`, `PW_PORT=4431 npx playwright test storybook-visual`,
the fixed checks. Report: branch, SHA, per-check results, the proposed
`check:canal` line, the index, and what is unfinished.
