# Lane: generated data refresh (opencode/DeepSeek, mechanical)

**Goal.** Re-run the generators the integrator usually reruns by hand, check that each is clean on main, and hand back one commit of regenerated outputs. No hand edits to generated files.

**Model.** DeepSeek via opencode (`--auto`). This lane needs no browser.

**Read.** `docs/handoffs/LANE-RULES.md`, this brief. Read nothing else unless a command fails.

**Steps.** Run from a fresh lane worktree on `origin/main`, with `MAP_RECALL_SOURCE_DATA=/Users/blackmad/Code/map-recall2-source-data`. Run them in this order and record the exit code and `git diff --stat` after each.
1. `npm run -s census -- --write`
2. `npm run -s build:content-stats` then `npm run -s check:content-stats`
3. `node --import tsx scripts/build-buurt-pages.ts` then `npm run -s check:buurt-pages`
4. `npm run -s build:explorer-looks` then `npm run -s build:explorer-looks -- --check`
5. `npm run -s build:devlog` then `npm run -s check:devlog`

If a step's check fails after its build, stop. Report the command and the first 30 lines of output. Do not edit the generator.

**Do not touch.** Source code, `index.html`, `game.js`, bundles other than what these scripts write, `TODO.md`, `HISTORY.md`, `package.json`, `covers.json`, goldens. If a generator writes outside its usual outputs, say so in the report.

**Acceptance.** Every check is green. There is one commit, `Data refresh <date>: census, content stats, buurt pages, explorer looks, devlog`. The report gives the diff stat for each step and the census headline number before and after.

**Report block.**
```
DATA-REFRESH <sha>: census headline a -> b, files changed per step (stat), all checks pass | stopped at <step>: <reason>
```
