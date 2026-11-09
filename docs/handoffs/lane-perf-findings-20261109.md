# Lane: perf-gate findings — GL programs 38 against 32 and desktop motion p99 33.3 against 33 (2026-11-09)

Model: opus. Worktree: `/Users/blackmad/Code/map-recall2-worktrees/perf-findings-20261109`, branch `lane/perf-findings-20261109`, port 4718. Base: main at 1146d4d05.

## Context
`npm run` script `perf-gate` (`scripts/perf-gate.mjs`, library `scripts/perf-gate-lib.mjs`, budgets `tests/perf/budgets.json`) was repaired in #294 and run against a live dev server. Two rows failed:
- `programs`: 38 GL programs compiled against the budget of 32 (budget source: HISTORY "Own ground compiles half the shaders", 68 → 32, 2026-10-26).
- `desktopMotionP99Ms`: 33.3 ms against 33 (budget source: lane E2 2026-11-05, 10.4 ms headed at 120 Hz, 16.8 ms headless).
Additionally 29 budget rows are classified `external` (EXTERNAL in `perf-gate-lib.mjs`) because the gate cannot measure them in-process; they are listed but never evaluated.

Rule from the integrator: name candidates, not causes. Measure before you touch anything (`docs/handoffs/LANE-RULES.md`). Desktop performance matters about ten times more than iPhone here.

## Do
1. Reproduce: `PORT=4718 npm run dev` (nohup) then `PORT=4718 node scripts/perf-gate.mjs ""` three times; record each row's value and spread. The motion p99 reading at 33.3 vs 33 may be noise: report the three readings and the machine load (`uptime`) at each.
2. Programs: enumerate the 38 programs. Hook `WebGLRenderer.info.programs` (or `renderer.info.programs` through `window.canalRecallGame.vectorMap`) in a small Playwright or Node-driven page script and list each program's material type/defines, and which feature introduced it (bisect by `?` flags if the features have them: `labelFade`, `windowSdf`, `texCap`, `treesIncremental`, `collection`, engine `own` vs default). Produce a table: program → material/defines → owner feature → first HISTORY entry that added it. Then decide, with evidence: (a) programs that are duplicates (same shader, different define ordering, or a material cloned per instance where one shared material would do) → fold them, measure again; (b) programs that are real new features since 2026-10-26 → propose a new budget value with the list as justification (the integrator edits `budgets.json`, you do not). Do not raise a budget without the table.
3. Motion p99: if the three readings straddle 33, run the 60 s own-engine ride timeline (`scripts/heap-ride.mjs`, see the budgets row's `unit`) under `CANAL_PW_EXCLUSIVE`-free conditions when load < 8, three runs, and report p50/p95/p99 and the longest frames with their causes (trace the top three long frames: which system ran, via the existing frame-time attribution in `ride-perf.spec.ts`/`PERF_LABEL_SPLIT`). If a real regression against E2's 10.4/16.8 exists, name the candidate subsystems with numbers and fix the cheapest one if it is contained; otherwise say "noise" with the evidence.
4. External rows: for each of the 29, say in one line what measures it today (an npm script, a spec, a manual procedure, or nothing). Propose, in the hand-back, which rows should move to a `report-only` section, which have a cheap in-process measurement the gate could run, and which are dead. Implement the cheap ones if there are ≤ 3 and each is under ~40 lines, with unit tests in `tests/perf/perfGate.test.mjs` (that file is yours to extend; keep `node --test tests/perf/perfGate.test.mjs` green).
5. Checks: `npm run lint`, `npm run test:perf-gate`, and `PW_PORT=4718 /tmp/canal-pw.sh npx playwright test tests/e2e/ride-perf.spec.ts --project=desktop` (through the lock) before and after any shader fold.

## Hand back
The program table, the three gate readings, the motion analysis, the external-rows table, and the proposed budget edits as exact JSON snippets for the integrator.
## Lane rules (binding)

- Work only in your worktree and on your branch. Never push to or merge `main`. Never edit `public/canal-drive/game.js`, `game-route.js`, `index.html`, `package.json`, lockfiles, any `*.bundle.js`, `covers.json`, goldens, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `tests/perf/budgets.json` or published extracts under `public/data/extracts/` (stage new data under `public/data/extracts/amsterdam/staging/` and say so). The integrator owns those; put what they must do under INTEGRATOR TODO in your hand-back.
- Git: use `/usr/bin/git` for every git command (the `git` wrapper is broken). Never `git stash`. Commit as you go; end every commit message with `Co-Authored-By: Claude <your model> 5.5 <noreply@anthropic.com>`.
- Dev server: `echo <port> > .worktree-port` is done; start with `nohup env PORT=<port> npm run dev > /tmp/<lane>-dev.log 2>&1 &`. Stop it by its port's PID (`/usr/sbin/lsof -tiTCP:<port> -sTCP:LISTEN | xargs kill`), never `pkill`.
- Browser runs: exactly one Playwright run at a time on this machine, through the lock: `PW_PORT=<port> /tmp/canal-pw.sh npx playwright test <spec> --project=<desktop|iphone> --reporter=line`. The lock may hold you for 10–30 minutes while a gate runs; block on it with ONE long wait (timeout 1,800,000 ms), never poll in a loop and never give up on it. Run `npx playwright test` only through the lock.
- Shell quirk: some shells start with a stripped PATH; use absolute paths (`/usr/bin/python3`, `/usr/bin/wc`, `/opt/homebrew/bin/gh`).
- Measurement first: before changing anything, measure the thing you are about to change and write the number down; after, measure again. A claim without a number is not a result.
- Screenshots: clone or `git worktree add` the `blackmad/map-recall2-screenshots` repo (clone at `/Users/blackmad/Code/map-recall2-screenshots`; make your own worktree `/Users/blackmad/Code/map-recall2-screenshots-<lane>` on a branch, merge to its main and push). Put frames under `ui/<YYYY-MM-DD>-<slug>/`, each image ≤ 400 kB (JPEG q≈80, ≤ 1600 px wide), never rewrite a published file. Never add images to the game repo.
- Storybook: add desktop and phone stories for every new HUD/card state; `npm run build-storybook` must pass.
- Budget: at most 60 turns. If you run out of road, hand back what you have with honest status rather than guess.
- Hand back as a comment on your issue with these headings: LANE, MEASURED (before numbers), DID, NUMBERS (after), CHECKS (commands + exit codes), STORYBOOK, SPEC, STRIP (screenshot paths), WHAT'S NEW (a draft note: title, text, image paths), INTEGRATOR TODO (bundles to rebuild, tests to join, data to publish), OPEN. Then return the final commit SHA and a five-line summary as your final message.
