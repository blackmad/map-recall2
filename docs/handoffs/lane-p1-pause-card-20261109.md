# Lane P1: the pause card — "ugly and uncentered" (user, 2026-11-09)

Model: opus. Worktree `/Users/blackmad/Code/map-recall2-worktrees/p1-pause-card-20261109`, branch `lane/p1-pause-card-20261109`, port 4736. Base: main (5003c7b5a or later; #304's two-row keycap wrap is in).

## The user's word (2026-11-09, desktop Free Ride, pause card): "ugly and uncentered"
Shot: screenshots repo `engine/2026-11-08-user-shots/pause-card-ugly-uncentered-20261109.jpg`. What it shows: a wide card with a huge PAUSED heading, one keycap row (P / ESC Resume · M Route setup · C Share this route) that ran off the right edge on that build (the overflow itself is R2-6, fixed in #304 by wrapping to two rows — check main first and measure), a stats line "11:33.386 · 15.97 km · 0 of 0 named" that in Free Ride reports a quiz tally that does not exist, and a large empty band below. Nothing is visually centred on the card: the keycap row starts left of centre and ends clipped, the stats line sits off-centre under it.

## Measure first (desktop 1440×900 and 1280×720, iphone 390×844 and 390×664, en and nl, Free Ride and a quiz ride)
Card width/height; heading size; for each row the content bounding box's left/right margins to the card's inner edges (centred means equal within 4 px); any element past the inner edge; the empty band below the last row; the stats line text in Free Ride.

## Design (the arrival card is the visual language: `presentationRuntime.ts` arrival card, `hudSurface` fonts, `keycapAction.ts` `drawKeycapAction` / `measureKeycapAction` / `wrapKeycapRows`)
- The card hugs its content: width = widest row + padding, height = rows + padding, no empty band; centred on the viewport.
- Heading one step smaller, same weight; a one-line subtitle under it with the ride context (destination or "Free Ride · buurt") in the muted colour.
- Actions as a vertical list of keycap rows or as centred rows that never exceed the inner width (reuse the wrap); each row centred; keycap + label pairs aligned on one baseline; phone keeps the tappable 44 px rows without keycaps (phones have no keys, see mobile-overlays spec "tappable actions, not keys a phone does not have").
- Stats: time · distance always; the tally only when a quiz ride has attempts (Free Ride and 0-attempt rides omit it); centred.
- Dutch strings through i18n (`ride.pauseSummary` and friends), `test:canal-i18n` green.
- Keep the hover highlight (#301) and the keycap click targets (#278).

## Checks and gate
Unit tests for the layout function (a pure `pauseCardLayout(measure, strings, viewport)` returning rows and the card rect) including the centring invariant; `npm run test:hud`; a measured spec case in `tests/e2e/phone-polish.spec.ts` or a new `pause-card.spec.ts`: every row centred within 4 px, nothing past the inner edge, no tally in Free Ride, on the four sizes × en/nl. Storybook: the pause card has no canvas story harness today — add the smallest harness that can draw it (a canvas-in-story with the layout function and a fixed measure), desktop + phone, Free Ride + quiz. Strip `ui/2026-11-09-p1-pause-card/` before/after at the four sizes. Browser runs only after the integrator says "resume" (the user is playing on this machine); do the layout function, tests and stories first and post an interim hand-back.
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
