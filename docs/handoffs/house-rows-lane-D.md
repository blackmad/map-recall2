# House rows, lane D: row records (issue #386, opus)

Branch `lane/house-rows-d-20261114`, worktree `map-recall2-worktrees/house-rows-d-20261114`, port 4611.

## Goal

The programme brief's "Lane D" section, for round 1: Kinkerstraat 86–110 (even side; face `scripts/block-face/faces/kinker-86-110/intent.json`) and Weteringschans 168096–171218.

## Deliverables

1. **The shared contract, first.** `src/canalRecall/houseSpec/row/types.ts` holds RowRecord, Series and member fronts (with sub-fronts for multi-number pands), the solved per-series design (cornice line in metres, storeys, bays and window cell, head dressings, wall family from the 11 families, roof storey such as mansard with N dormers of a kind, extras allow-list), and per-field provenance (reviewed > face intent > series consensus > single read > period default), plus a "read, not drawn" list.
   - Commit and push it early; lane R (`lane/house-rows-r-20261114`) builds on it.
   - Agree changes by message through the integrator; R owns `RowFrontRecord` in `houseLine/rowFront.ts`.
2. **Row solve** (`houseSpec/row/solve.ts`): per series, the mode of class fields and the median of metre fields.
   - A class disagreement between a face intent and the D1 consensus flags the row; never resolve it silently.
   - Fronts read through scaffold or netting are not staged (236213 / Kinkerstraat 92–94).
3. **`npm run house:rows -- <face|street-range>`** (`scripts/house-specs/rows/`) writes `artifacts/house-rows/staging/<row>.json` (row record, `RowFrontRecord`s for rowFront, and HouseSpecs through `houseSpec/fromFace.ts`) plus a per-row report: the source of each field, members overruled, fields read and not drawn.
4. **Wall colour:** one family per series via `judgedColour.ts`. Take the file from `lane/d1-colour-judged-20261114` (3b371395d), code only. No sampled hex.
5. **Scores:** D1 series consensus against the face intents on Kinkerstraat's 208 pands, per field (a JSON plus a table in the hand-back).
6. **Batch-1 restore plan:**
   - The 293 batch-1 fronts are recorded in `artifacts/house-specs/published/d1-streets-1/` on main (copy: `_pruned-sheets/d1-streets-1.sources.json`; commit 030accc11 / 36182f238).
   - Write `scripts/house-specs/rows/batch1-restore.ts`: it lists every batch-1 front not redone by round 1 and produces what restores its pre-D1 look (spec files to delete or revert, and tiles to rebuild).
   - Dry-run report only; the integrator executes it.
7. Typed tests in `test:house-spec`, including the named regressions:
   - 236027 (Kinkerstraat 106–108) is two fronts;
   - 159635, 152925 and 160809 resolve to one design;
   - 236213 has nothing staged from the scaffold read;
   - 169016 has a mansard with a pedimented dormer.
8. Confirm or refute the brief's inferred claim that candidate-r2 used the no-brick staging.

## Common rules (all house-rows lanes)

- Read `docs/handoffs/house-rows-plan-20261114.md` first; its rules 1–7 bind you. Also `docs/house-line.md`.
- Use `/usr/bin/git` only; never a bare `git stash`. Commit with `/usr/bin/git -c core.hooksPath=/dev/null commit`, and end messages with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_011MSpAwdr7AP748FfuXEo5M`.
  Push only your lane branch, never main.
- The integrator (integrator-lanes) owns `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `game.js`, `index.html`, lockfiles, the world compile, `house:publish`, merges and pushes.
  - `package.json`: you may add scripts and test files only.
  - Stage; never publish.
- Iterate in Node. Browser runs go through `/tmp/canal-pw.sh` with your own `PW_PORT`, one at a time; `house:frames` runs unwrapped.
- Stop your dev server by its port PID (`lsof -ti tcp:PORT`), never with pkill.
- Never `npm install` into the shared node_modules.
- Data rules:
  - Open data only.
  - Request headers carry `MapRecall/1.0 (+https://github.com/blackmad/map-recall2)`, never an email.
  - Keys only from `zsh -lic`; never print them.
- D1 answers (canonical): `/Users/blackmad/Code/map-recall2-worktrees/d1-tranche-ring-20261114/artifacts/describer-d1/` (ring-20261114/answers, answers-ah07, …). Read-only; copy what you need into your own artifacts/.
- Screenshots go to a worktree of `~/Code/map-recall2-screenshots` on your own branch, under `ui/2026-11-14-house-rows/<lane>/`. Also copy sheets to `/Users/blackmad/Code/map-recall2-worktrees/_pruned-sheets/house-rows-<lane>/`.
- Hand back: commit SHA(s), what changed, tests and checks run, sheet paths, open questions.
