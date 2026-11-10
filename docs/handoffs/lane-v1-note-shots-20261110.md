# Lane V1: screenshots for three What's New notes, plus S3 strips at the user's poses

Model: sonnet. Base: main 3ce65889f. Port 4752. Mechanical capture lane: no code changes to the game; small capture scripts under `scripts/` are fine.

These notes in `public/canal-drive/whats-new-notes.json` have `"images": []`:
1. **"Roofs stay on their walls"** (S3 #315, register gables #316).
   - The user's poses: `engine/2026-11-08-user-shots/roofs-overhang-kalverstraat-spui-ef73a29-20261109-{a,b}.png` in the screenshots repo, plus the Hobbemastraat and Weteringschans poses listed in HISTORY "roofs offset" (#257).
   - Before = main at `6a901ba06`; after = current main. Use a detached worktree per side, or build both bundle sets to scratch dirs with `BUNDLES_DIR` (see `tests/e2e/helpers.ts`).
   - Before uses the world-v1 data from before the republish: check out `public/data/extracts/amsterdam/world-v1/` at `6a901ba06` in the before worktree.
   - Also do one Nieuwmarkt 4–22 register-gable pair.
2. **"Bike paths through parks"** (D2 #322).
   - The Javaplantsoen promenade path, on the ride's map or minimap: before, the route stops short; after, the path leads on.
   - Read HISTORY "D2" for the poses and the pinned junctions.
3. **"More Dutch on Dutch cards"** (N1 #323).
   - One landmark card in the Dutch game (`?lang=nl` or whatever `src/canalRecall/i18n` uses; check), before (English fact) and after (Dutch sentence with its nl.wikipedia link).
   - Pick a landmark from the 56 in `public/data/extracts/amsterdam/staging/facts.dutch-20261109.json`.

## Rules for the frames
- Desktop 1440×900 and iPhone. The same pose, same time of day and same camera on both sides.
- Hold the world settled (`settleWorld()` in the e2e helpers) before shooting.
- Look at every frame before publishing. A pair whose poses differ is not a pair; redo it.
- **Publish** under `ui/2026-11-10-note-shots/` in map-recall2-screenshots.

## Hand back
- **The note image objects:** for each note, the exact `images` JSON objects (`{src, alt, caption}`, src relative to the screenshots repo root) so the integrator can paste them in.
- **Issue comment:** the hand-back goes on your issue.
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
