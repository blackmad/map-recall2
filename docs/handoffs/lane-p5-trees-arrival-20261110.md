# Lane P5: trees rebuild whole; arriving landmarks see-through for 600 ms

Model: opus. Base: main 3f24fbf20 (has P2, P3, P4 and the fog-depth fix). Port 4750. Hand back with numbers.

Read HISTORY "P2", "P3", "P4", "Sky-blue ground fixed" and TODO "Pop-in follow-ups". Tools on main: `scripts/pop-bands.mjs` (pops by band) and `scripts/street-haze-shots.mjs`.

## Tasks
1. **Trees.** From the air, about 29 whole tree rebuilds a minute (P2 table, "trees (rebuilds)"); street desktop about 10.
   - Find what triggers a rebuild: residency moves, LOD, or `treesIncremental`, which is on for desktop and off for touch.
   - Make tree changes incremental or dissolved, so a rebuild doesn't swap every tree in one frame.
   - Measure pops and frame p99, desktop and iPhone, aerial and street, n ≥ 3.
2. **Arriving landmark transparency** (P4 `?landmarkArrive`). For 600 ms an arriving landmark is part-transparent, because the facade or kit building it replaces leaves at once.
   - Hold the replaced building until the dissolve ends, or cross-fade both.
   - Show it in a frame sequence: 0, 150, 300 and 600 ms.
3. **iPhone street pop-bands,** never run in P4, n ≥ 2. Report them.

## Acceptance
- **Gates:** clear band 0 pops inside 250 m; frame time within noise; heap after a forced GC within 5 % of main.
- **Strip:** in `ui/2026-11-10-p5-trees/`.
- **What's New:** a draft in English and Dutch.
- **INTEGRATOR TODO:** the bundles, listed together.
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
