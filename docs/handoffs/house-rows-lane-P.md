# House rows, lane P: row strip sheet, check:rows, blind review, docs (issue #388, sonnet tooling)

Branch `lane/house-rows-p-20261114`, worktree `map-recall2-worktrees/house-rows-p-20261114`, port 4613.

## Goal

The programme brief's "Lane P" section.

## Deliverables

1. **`npm run house:row-sheet -- <row>`** shows three strips at one scale, for one street side, consecutive, with every front:
   - the photo strip (the captures the D1 reader actually saw, not `pickLikeness`'s);
   - the drawn strip (Node);
   - this morning's drawing.

   Reuse `scripts/block-face/ortho-compare.ts`, `review.ts` and `scripts/house-preview`. Rows: Kinkerstraat 86–110 and Weteringschans 168096–171218. The drawn strip takes lane R's renderer once it lands (`lane/house-rows-r-20261114`); build the page now on today's drawing so it is ready. Also identify which staged set the Weteringschans wall-colour sheet (`ui/2026-11-14-d1-wall-colour/round2/`) drew; the brief marks this as inferred.
2. **`npm run check:rows`** in Node, wired into `check:canal:rest` (add it to that script's list; tell the integrator):
   - members of a series resolve to one design (allowed per-house fields listed);
   - the cornice step inside a series is ≤ 0.2 m;
   - no extra outside the allow-list on a row member;
   - no hash roof on a row member;
   - every read field is drawn, settled or reported.

   Named regressions:
   - 0363100012236027 is two fronts;
   - 159635, 152925 and 160809 are identical;
   - 236213 has nothing staged from the scaffold read;
   - 169016 has a mansard with a dormer and no pointed gable.

   Build it against lane D's types (`lane/house-rows-d-20261114`, `src/canalRecall/houseSpec/row/types.ts`) and its staging output. It may report "no records" until those exist, but the tests use fixtures.
3. **Blind row review protocol:** `scripts/house-specs/rows/blind-review.md` plus a prompt file. A fresh agent gets only the two strips and answers in visible order, pass or fail, with the house number, on:
   - same houses drawn the same;
   - roof line;
   - colour family;
   - roof storey and dormers;
   - window rhythm and white dressings;
   - anything invented.

   A fail in the first three blocks the row. The integrator runs the reviewer (fresh opus); you write the protocol and a parser for its answer.
4. **Docs:** a "Rows" section in `docs/house-line.md` (records, solve, gates, sheet), and a short "House rows" paragraph for `CLAUDE.md` carrying the brief's rules 1–5. CLAUDE.md is integrator-owned, so put the paragraph in your hand-back and in `docs/handoffs/house-rows-claude-md.txt`. A lane without its doc diff is not done.

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
