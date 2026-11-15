# Lane P6: tree tile churn from the air, tree shadows switching in one frame, iPhone tree look

Model: opus. Base: main a332381a9 (has P2–P5). Port 4750. Hand back with numbers.

Read HISTORY "P5" and TODO "Pop-in follow-ups". Tools: `scripts/pop-bands.mjs`, P5's tree probes (see #332 comments).

## Tasks
1. **Tile churn.** From the air, the 12-tile tree budget drops tiles and re-fetches the same ones, 10–22 k tree parts each time.
   - Measure drop/refetch counts a minute and the bytes refetched.
   - Add a keep band or hysteresis (an LRU of recently dropped tiles, or a larger keep radius than the build radius) so a tile just dropped isn't refetched within N s.
   - The heap after a forced GC must stay within 5 % of main.
2. **Tree shadows switch on and off in one frame.** Make them fade with the trees, or keep the shadow caster until the tree's fade-out ends.
3. **iPhone aerial tree look.** After P5, the pixel change charged to trees went up (mean 286 k → 483 k) even though nothing pops.
   - Record a short iPhone-profile flight: frames or video, before and after P5.
   - Say whether the fades read worse than the swaps did, e.g. longer visible shimmer. If they do, shorten the fade on touch or tie it to the same frame as the build.

## Acceptance
- **Tables:** pop-bands and refetch counts before and after, aerial desktop and iPhone, n ≥ 3.
- **Gates:** clear band 0; frame time within noise.
- **Strip:** in `ui/2026-11-10-p6-trees/`.
- **What's New:** a draft.
- **INTEGRATOR TODO:** the bundles.
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
