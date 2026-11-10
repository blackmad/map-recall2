# Lane S2: in Free Ride, landmark clicks and bridge pins stay out of the waterways (2026-11-09)

Model: opus. Worktree `/Users/blackmad/Code/map-recall2-worktrees/s2-water-taps-20261109`, branch `lane/s2-water-taps-20261109`, port 4731. Base: main (6a901ba06 or later).

## The user's word (2026-11-09, Free Ride on build ef73a29): "in free ride, get the landmark clicks out of the waterways"
Shot: screenshots repo `engine/2026-11-08-user-shots/start-westermarkt-grey-shells-ef73a29-20261109.png` (bridge pins such as Niek Engelschmanbrug and Nieuwe-Wercksbrug sit mid-canal). Two readings; step 1 measures both before any code:
- **Reading A:** taps on the water surface open landmark/bridge cards because the landmark pick radius or the marker hit area extends over the canal.
- **Reading B:** bridge pins and labels (blue-dot pins) sit mid-canal and clutter the waterways.

## Step 1 — measure
In Free Ride by boat and by bike, at the shot's pose and two more canal-side poses (Prinsengracht/Brouwersgracht, Amstel/Blauwbrug), tap/click 30 points on water near bridges and quays and 30 on streets, desktop and iphone; log what opens (card kind, landmark id, distance from tap to the marker/pill, whether the tap point is inside the water polygon from `water.json`). Use the existing pick code (`tests/e2e/check-poi-click-selection` / `poi-click` specs show how taps are driven). Table: pose × surface × device → cards opened off-pill / 30.

## Fix per the measurement
A tap on water never opens a card unless it lands on the pill itself; bridge markers anchor on the deck (the bridge way's centreline point on land/deck, not the water centroid); bridge label pins draw only when a bridge is within ~150 m or on hover; the pick radius excludes the water polygon. Typed pick/anchor logic in `src/` with unit tests; nothing changes in quiz modes except shared pick code, whose specs (`check-poi-click-selection`, `landmark-question`, `one-bottom-card`, `free-ride-collection`) stay green.

## Gate
0 of 30 water taps open a card off-pill, boat and bike, desktop and iphone; the strip at the shot's pose shows no pin on open water; quiz-mode specs green. Specs through the lock with `PW_PORT=4731`. Note: lane F1 (#311) is removing the "0 of 9 places" plaque line and the Free Ride collection by default at the same time — do not touch the collection code; rebase onto main when F1 lands if your branches collide. Strip `ui/2026-11-09-s2-water-taps/` before/after.
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
