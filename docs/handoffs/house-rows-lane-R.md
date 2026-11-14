# House rows, lane R: renderer (issue #387, opus)

Branch `lane/house-rows-r-20261114`, worktree `map-recall2-worktrees/house-rows-r-20261114`, port 4612.

## Goal

The programme brief's "Lane R" section. While you run, you are the sole owner of `houseLine/rowFront.ts`, `roofMesh.ts`, `houseSpec/decorate.ts`, `facadeExtras.ts`, `facadeOrnaments.ts` and `bayLook.ts`. Every described house draws through the row-front path.

## Deliverables

1. **Row front for any pand with a row record:**
   - the wall top sits at the series cornice line, never the pand's own 3DBAG height;
   - sub-fronts for two-number pands;
   - extras come only from `ROW_FRONT_EXTRAS` plus what the type states;
   - one bay preset and one wall family per series, seeded by the series id.
2. **Roof storey behind a cornice:** a slate mansard face with N dormers per front (gabled, pediment or plain; hoist beam optional); a flat lid otherwise. The cornice branch of `buildRoofTriangles` currently returns before any dormer call (`roofMesh.ts` ~735–753); fix that.
3. **No hash roof on a described house.** A member with no crown takes the series roof; a lone described house takes a cornice lid at its front top.
4. **Head dressings per row** (block course, keystone, dentil lintel, segmental tympanum) and the tall window cell. The white heads are what make these rows recognisable.
5. **Belt crowns** at the measured top through `houseLine/crownProfile.ts`. This is round 2 scope: start only after round 1 renders.
6. **Byte-identical for a pand with no row record.** Prove it with a hash over the generic meshes of a sample and report it. Also report triangles and bytes per row.
7. **Records come from lane D** (`lane/house-rows-d-20261114`, which pushes `src/canalRecall/houseSpec/row/types.ts` first; merge that branch to get the types). Until it lands, hand-build a round-1 fixture from `scripts/block-face/faces/kinker-86-110/intent.json` under test fixtures, so you are not blocked.
8. **Round-1 target on the drawn strip:**
   - Kinkerstraat: one cornice line at ~14.2 m across 110–90; 106–108 and 92–94 as two 3-bay fronts each; red-brown brick throughout; a dormer per front on a slate mansard; the three head variants; no balconies, flower boxes or centre strip.
   - Weteringschans 168096–171218: two cornice fronts and two mansards with pedimented dormers, and no pointed gable on 169016.
9. **Confirm or refute** the brief's inferred claim that the centre glazed strip on 236027 is the oriel or bay-window dice.
10. **Node previews** of both rows (`scripts/house-preview` or `render.ts`): before and after at the same scale.

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
