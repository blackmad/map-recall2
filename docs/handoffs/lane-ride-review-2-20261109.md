# Lane: ride review round 2 — the merged gameplay programme on main (2026-11-09)

Model: opus. Worktree: `/Users/blackmad/Code/map-recall2-worktrees/ride-review-2-20261109`, branch `lane/ride-review-2-20261109`, port 4717. Base: main at 1146d4d05 (G1–G7, L1–L5, #287–#297 all merged).

## Goal
A fresh, honest play review of Canal Recall as a player meets it today, on desktop (1440×900) and iPhone (390×844 and 390×664), producing a judged defect list the integrator can turn into lanes. The previous review (#280, strip `ui/2026-11-09-ride-review-gameplay/`, 75 frames, 12 defects) was done before L1–L5 landed; this round checks those fixes held and looks at what the new features do together.

## Do
1. Read `public/canal-drive/HISTORY.md` top 25 entries and `docs/handoffs/gameplay-ui-plan-20261108.md` so you know what each feature is supposed to do (its "gates").
2. Ride at least these, each on desktop and iphone, capturing a frame at every state change (landing, start flight, first question, answer, drive-by card, landmark question, arrival, run card, next stop, postcard, knowledge map, stamp album, share card, pause card, What's New):
   - a guest first visit → Today's ride (the landing hook) → ride to arrival → Next stop → End run → run card → Share.
   - Free Ride with the collection on: open ≥ 2 places, see the plaque checklist, the stamp.
   - a Dutch (`?lang=nl`) ride end to end.
   - the knowledge map and stamp album after the above (centre and outer-district names).
   - `ENGINE=own` for one desktop ride (`?engine=own`), so both engines are covered.
   Use `tests/e2e/helpers.ts` `openRoute` and the existing specs (chained-run, run-points, free-ride-collection, knowledge-map, phone-cards) as the way to reach states deterministically; add a capture-only spec `tests/e2e/ride-review-2.spec.ts` that writes frames to a directory from `SHOTS=<dir>` (skip when unset) so the strip is reproducible.
3. Judge every frame against the product principles in CLAUDE.md (the question's street or canal is never revealed by HUD or map before the answer; the corridor stays visible; cards are compact at the bottom; cycling presentation; English encyclopedia text in the English game; Dutch strings complete in the Dutch game) and against each feature's gates. Also look for: overlapping cards, text truncation/ellipses, buttons under 44 px on the phone, wrong or stale numbers (points, stamps, stops), inconsistent names across cards, empty states, anything a player would find confusing.
4. Write the review as `docs/reviews/ride-review-2-20261109.md`: one table row per defect (id, where, frame path, what is wrong, which principle/gate, severity P1/P2/P3, suggested owner lane), then "what held from #280" (each of the 12 earlier defects: fixed / regressed / not reachable), then three sentences of overall verdict a user could read.
5. Publish the strip to the screenshots repo under `ui/2026-11-09-ride-review-2/` with an index.md listing frames in ride order.

## Hand back
On the issue. The DEFECTS table in full, the held-from-#280 list, strip path, spec path, and your verdict. No fixes in this lane; it produces the list.
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
