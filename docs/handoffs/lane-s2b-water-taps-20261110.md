# Lane S2b: pins that still open from open water in Free Ride (#314, round 2)

Worktree `/Users/blackmad/Code/map-recall2-worktrees/s2-water-taps-20261109`, branch `lane/s2-water-taps-20261109` (HEAD 07e33b4a1), port 4731. Model: opus. No turn cap (budget lifted 2026-11-09), but hand back when the gate passes.

## Where it stands
Read issue #314 in full: the brief, the first lane's interim and addendum, and the integrator's measurement (comment 6757141722).
- The first lane wrote `src/canalRecall/game/freeRideWater.ts`:
  - `bridgeMarkerAnchor`, `landAnchor`, `tapOnOpenWater`, `freeRideWayTapAllowed`;
  - the runtime changes in `freeRideRuntime.ts`;
  - a stem-only `markerAt` hit;
  - a text-only `labelOverlay.hitTest`.
- The integrator ran the lane's own gate, `S2_GATE=1`, with the rebuilt bundles. It fails on desktop and iPhone, own engine and default engine:
  - Nieuwe-Wercksbrug, Westertoren, Blauwbrug and the Joods Verzetsmonument still open a landmark or bridge card from a water tap that is off every pill.
  - The iPhone bike Brouwersgracht pose samples 0 water taps, so "enough water taps" fails.
- Building and street-art cards from water taps are gone, and so is the bike street name. Keep both.

## Task
1. **Measure first.** Build the lane bundles to a scratch dir:
   ```
   node scripts/esbuild-ride-bundle.mjs src/canalRecall/game/presentationRuntime.ts <B>/game-presentation.bundle.js
   npx esbuild src/canalRecall/orientationPois.ts --bundle --format=iife --global-name=CanalRecallOrientationPois --outfile=<B>/orientation-pois.bundle.js --minify
   ```
   Then at Westermarkt, find where the drawn Nieuwe-Wercksbrug and Westertoren markers' anchors are on screen and in lng/lat. Check each against the water polygon, and find which code path opens the card from the failing tap: `markerAt`, the label hit, or `_inspectBuildingAt`.
2. **Fix the real cause.** No pin opens from a tap on open water, and no pin's anchor dot sits on water. A boat's tap on its own canal may still name the canal; that was the first lane's choice, and the integrator keeps it.
3. **Fix the iPhone Brouwersgracht pose** in the spec so it samples water taps, or swap in another named water pose and say why.
4. **Run the gate.** Both projects, on the own and default engines, with `BUNDLES_DIR=<B>`; it must pass:
   ```
   S2_GATE=1 BUNDLES_DIR=<B> [ENGINE=own] S2_OUT=<scratch> PW_PORT=4731 /tmp/canal-pw.sh npx playwright test tests/e2e/free-ride-water-taps.spec.ts --project=desktop --project=iphone --workers=1 --reporter=line
   ```
   Then run the quiz-mode specs listed in the first lane's interim with the lane bundles.
5. **Unit tests:**
   ```
   node --import tsx --test src/canalRecall/game/freeRideWater.test.ts src/canalRecall/game/freeRide.test.ts src/canalRecall/game/freeRideCollection.test.ts
   ```
   Also run `npm run lint` and `npx tsx scripts/check-poi-click-selection.ts`.
6. **Strip.** Westermarkt before and after, desktop and phone, as a strip at `ui/2026-11-10-s2-water-taps/`. Include a What's New draft in English and Dutch.

## INTEGRATOR TODO to include
- the bundles to rebuild;
- `freeRideWater.test.ts` for `test:hud`;
- anything else.
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
