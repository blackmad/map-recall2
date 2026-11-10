# Lane H8: documentation sweep and the cold-start test (2026-11-10)

Part of the house line (`house-line-plan-20261110.md`). Haiku. Last, after H7. User, 2026-11-10: "make sure the pipeline you build is well documented in the right places, CLAUDE.md where appropriate, for future claude runs to pick up."

## Deliverable
- `docs/house-line.md` read end to end against the code: every `house:*` npm script, every flag, every path (staging, published, archive, artifacts), the trust order, the horizon rule, the batch rule, the worked example; fix drift; one page map at the top ("new here? read in this order").
- `CLAUDE.md`: the "House line" section is ten lines or fewer, states the five commands, the two rules (lanes stage and never publish; kit gaps go to the queue), and the doc to read. Remove or point to superseded guidance in `docs/START-HERE-buildings.md`, `docs/buildings-pipeline.md` and `scripts/building-recipes/README.md` (a one-line pointer at the top of each; delete only steps the line replaces, keep the rest).
- `scripts/check-house-line-docs.ts` → `npm run test:house-line-docs`, in `check:canal`: every `house:*` script in `package.json` appears in the doc with every flag its `HELP` constant lists; every path the doc names exists or is a documented output; the CLAUDE.md section is present and under its line budget.
- Memory for the next sessions is the integrator's: hand back three lines for `MEMORY.md` (what the line is, where the doc is, the two rules).

## Cold-start gate
The integrator starts a fresh haiku lane with only `docs/house-line.md`, `CLAUDE.md` and one pand id from the H4 buurt, and asks it to reach a staged spec with a compare sheet. It must get there without reading any other doc or asking a question; every place it had to read code instead is a doc defect, fixed in this lane, then the test is run again.

## Rules
`LANE-RULES.md`; `/usr/bin/git`; own worktree; link `node_modules`; `CLAUDE.md` edits are in scope for this lane only (the integrator merges them); no edits to `game.js`, `index.html`, lockfiles, `TODO.md`, `HISTORY.md`; hand back SHA, the doc diff, the test, and the cold-start transcript summary.
