# Lane E1: buildings vanish on bump, and the far fade is too stark (2026-11-05)

Worktree `/Users/blackmad/Code/map-recall2-worktrees/engine-cover-fade-20261105`, branch `lane/engine-cover-fade-20261105`, port 4620. Plan: #213 (items B and E).

## B. Buildings disappear when the rider bumps into them (own engine)
Cause (read first): `src/canalRecall/coveredPassage.ts` decides "covered" when the rider's point is inside a footprint whose base is ≤ 2.5 m (Cuyperspassage rule, user report 2026-10-01). `src/canalRecall/engine/riderCover.ts` runs it every 0.12 s. Under MapLibre (`vector-map.js _updateRiderCover`) the query was rendered extrusions at the rider's screen point and the result was opacity 0.28. Under own, `src/canalRecall/engine/ownWorldView.ts:770` queries `city.featuresAt(rider)` exactly and calls `_threeBuildings.setHidden('cover', [id])`: the house vanishes outright. Bumping into a wall puts the rider inside the footprint.
Fix (typed, tested in `coveredPassage.test.ts` or a new test beside it):
1. Cover only when the rider is at least 1.5 m inside the footprint edge **and** the route ahead (next ~15 m of the route polyline, or the heading-ahead point) is also inside it. Passages are on the route; bumps are not.
2. Dim to `COVERED_BUILDING_OPACITY` (0.28) under own as MapLibre did, not hidden. If `setHidden` is the only lever in threeBuildingsBrowser, add a per-id opacity path (typed) and report it.
3. Check the physics clamp: if the bike can get more than ~1 m into a building footprint, say so with a measurement (the fix belongs to the road lane; do not do it here).
Pins: `tests/e2e/covered-passage.spec.ts` must still pass under both engines. Add a named pin for the bump: ride into a Prinsengracht/Bloemgracht house front under own and assert 0 ids hidden/dimmed, with the location in the spec name. Flag: `?coverRoute=0` restores the old rule.

## E. Far fade too stark (user: "gentle far haze for now, but make it turn-off-able")
`src/canalRecall/look/depthFade.ts`: DEPTH_FADE_NEAR 0.8 × eye-to-centre (min 80 m), FAR 3.5 ×, DESATURATE 0.7, HAZE 0.55, DETAIL 150–320 m. Start from: NEAR 2.0 (min 200 m), FAR 6.0, DESATURATE 0.4, HAZE 0.3, DETAIL 250–600 m. Add a `?fadeStrength=0..1` dev knob that scales desaturate/haze/detail together so the user can dial it. Keep the measured gain: busyness far/near (`scripts/look/busyness.mts`, reference table #129 comment 6565709571) must keep at least half of lever 1's improvement at the five spots; report the numbers off | old | new, desktop and iPhone, plus the strips.
**User-facing toggle:** a "Distance haze" switch in the game's advanced settings (find the existing look/3D toggles in the settings panel; the settings module persists to localStorage) that maps to `?depthFade=0` at runtime without a reload if the shader uniforms allow it, else on next ride. Default on. Tell the integrator the Storybook state to add (desktop + mobile) if the panel has stories.
Landmarks keep their opt-out. Marking fade (`look/markingFade.ts`) starts at the later of 120 m and the depth-fade start, so it moves with NEAR; check it still reads right.

## Rules for every engine lane (2026-11-05)
- Work only in your worktree (given above), on your branch, with `/usr/bin/git`. Never `git stash`, never `pkill`; stop your dev server by the PID on your port. Never `npm install` in the shared checkout.
- Do not edit integration hotspots: `game.js`, `index.html`, `package.json`, lockfiles, generated bundles under `public/canal-drive/js/*.bundle.js`, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `budgets.json`. Put new tests in `src/` next to the module; tell the integrator which npm test script and which bundle build they belong to.
- Browser runs go through the shared lock: `PW_PORT=<your port> /tmp/canal-pw.sh perl -e 'alarm 2400; exec @ARGV' -- npx playwright test <spec> --project=desktop --workers=1 --trace off --reporter=line`. One run at a time per lane. Timing measurements (stutter, heap) use `CANAL_PW_EXCLUSIVE=1`.
- The own engine is `?engine=own`; the default is still MapLibre. Measure both when the change can touch both.
- Acceptance is a measured ride or a pinned spec, not a strip. Every fix gets a named regression location and a flag to turn it off (`?x=0`) so the integrator can A/B it.
- Hand back on your lane issue as a comment: branch + SHA (pushed), what changed, numbers before/after, the bundles to rebuild, the tests to wire, and what is still open. Then stop. The integrator merges; do not merge main into your branch unless you need something from it (then say so).
- The user plays on this Mac in Chrome and on an iPhone. "Works in the strip" is not done.
