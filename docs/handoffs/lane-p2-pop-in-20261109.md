# Lane P2: pop-in at every distance — a horizon instead of an edge (2026-11-09)

Model: opus. Worktree `/Users/blackmad/Code/map-recall2-worktrees/p2-pop-in-20261109`, branch `lane/p2-pop-in-20261109`, port 4750. Base: integrator 1f2b5053a (push 96: S1 start hold #313 is in, world-v1 republished).

## The user's word (2026-11-09 night, "spin it up")
"I see stuff wayyyy in the distance popping in and out, not just 250 m" (desktop Free Ride, build ef73a29). Two pops: the near detail swap at 250–300 m, and far tiers arriving as blocks (coarse z14 tiles and baked cells install with no dissolve; far-shell cells are one mesh per km² and appear at once; landmark models swap in/out at the residency cap with no hysteresis; trees rebuild per cell). The depth fade never reaches opaque, so a block appearing 1.5 km away is visible through thin haze.

## Step 1 — measure (report the table before code)
60 s street ride Nieuwmarkt → Waag and 60 s aerial pan (the R5 poses), desktop DPR 2 + iPhone profile: count pop events per frame by distance band (0–250, 250–600, 600–1200, >1200 m) and by tier (detail swap, coarse, baked, far shell, landmark model, trees; labels excluded), using frame-diff clusters attributed to the tier that changed residency that frame. Post the table on the issue as an interim before changing code.

## Then
(a) Fog that reaches full sky colour at a fixed draw limit (street ~2 km, aerial further; flags for both), and nothing drawn beyond it (far ring, far shells, landmark residency and label reach all clamp to the limit), so arrivals happen inside the opaque band and the world gets a horizon instead of an edge.
(b) 600 ms fade-in for coarse, baked and far-shell cells (reuse the detail dissolve; complementary where a tier replaces another).
(c) Hysteresis on landmark residency: enter at the cap distance, leave at cap × 1.25, minimum dwell 10 s.
(d) Trees fade in behind the same band.
(e) Street rides: the haze band starts ~180 m so the detail swap sits inside it; aerial unchanged.
All behind `?popFade=0` / `?drawLimit=0`, byte-identical when off. Typed logic in `src/canalRecall/engine/` with unit tests.

## Gate
Zero pop events inside the clear band in both 60 s runs on both profiles; the table before/after per tier; GPU ms delta at the two poses (expect a saving from the draw limit); heap and GL memory not worse; landmark and skyline silhouettes still visible through the haze at the Westerkerk and Rijksmuseum poses (strips side by side with the user's complaint pose); S1's start hold (#313, `scripts/start-tier-probe.mjs`) measured again with the limit, since it changes what "stand-in within 600 m" sees. Strip `ui/2026-11-09-p2-pop-in/`.
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
