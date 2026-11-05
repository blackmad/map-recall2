# Lane E4: pop-in is detail switching on buildings already there (2026-11-05)

Worktree `/Users/blackmad/Code/map-recall2-worktrees/engine-popin-20261105`, branch `lane/engine-popin-20261105`, port 4623. Plan: #213 (item F); closes #168.

The user's answer (5 Nov): the pop-in is **detail switching on buildings that are already there**, not whole buildings or the ground. That is the coarse shell → detailed chunk swap: `src/canalRecall/threeBuildingsBrowser.ts` installs z14 coarse shells first (`COARSE_PREFIX`, `COARSE_HOLE_BONUS_M` 400) and later the detailed walls/extras chunks; the arriving chunk fades in over `CHUNK_FADE_MS` 350 ms (`fadeIn`), and the shell under it goes at once. Facade textures, roof extras, kits and landmark LODs (`engine/cityExtras.ts`, `landmarks/modelLods.json`) may swap the same way. Both existing detectors (`scripts/pop-in.mjs`, `tests/e2e/pop-in.spec.ts`) read ~0 because they count arrivals, not visible swaps.

## Measure the thing the user sees
Build the depth-aware detector that was parked (TODO "depth-aware pop-in detector"): on a 60 s seeded ride (desktop under own, then the iPhone profile), for every chunk/extra/LOD swap record the distance to the rider and the on-screen pixel area of the swapped geometry at the moment it swaps (own exposes `vectorMap._sharedFrame.{scene,camera,renderer}`). Report a table: swaps by kind (shell→detail, extras, facade texture, landmark LOD, trees), distance histogram, area histogram, and the ten largest. Post it on the lane issue before fixing.

## Then fix, each behind a flag, numbers before/after
- Cross-fade the swap: keep the shell drawn while the detail fades in (or fade the shell out over the same window), and lengthen the fade to ~700 ms; make sure the fade does not link programs in-frame (lane D caught that once).
- Install detail further out along the route: the fetch ring is the view (`engine/worldStreamer.ts`, world ring); add a route-ahead prefetch so detail for the next ~200 m of the route is resident before it is within ~120 m. Keep Free Ride bytes within the world-v1-bytes cap (16 cells / 1.5 MB, `tests/e2e/world-v1-bytes.spec.ts`).
- If a kind other than shell→detail dominates the table, fix that first and say so.
Gate: 0 swaps with on-screen area ≥ 400 px² within 120 m on the seeded ride, desktop and iPhone profile; pin it as the new pop-in spec.

## Rules for every engine lane (2026-11-05)
- Work only in your worktree (given above), on your branch, with `/usr/bin/git`. Never `git stash`, never `pkill`; stop your dev server by the PID on your port. Never `npm install` in the shared checkout.
- Do not edit integration hotspots: `game.js`, `index.html`, `package.json`, lockfiles, generated bundles under `public/canal-drive/js/*.bundle.js`, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `budgets.json`. Put new tests in `src/` next to the module; tell the integrator which npm test script and which bundle build they belong to.
- Browser runs go through the shared lock: `PW_PORT=<your port> /tmp/canal-pw.sh perl -e 'alarm 2400; exec @ARGV' -- npx playwright test <spec> --project=desktop --workers=1 --trace off --reporter=line`. One run at a time per lane. Timing measurements (stutter, heap) use `CANAL_PW_EXCLUSIVE=1`.
- The own engine is `?engine=own`; the default is still MapLibre. Measure both when the change can touch both.
- Acceptance is a measured ride or a pinned spec, not a strip. Every fix gets a named regression location and a flag to turn it off (`?x=0`) so the integrator can A/B it.
- Hand back on your lane issue as a comment: branch + SHA (pushed), what changed, numbers before/after, the bundles to rebuild, the tests to wire, and what is still open. Then stop. The integrator merges; do not merge main into your branch unless you need something from it (then say so).
- The user plays on this Mac in Chrome and on an iPhone. "Works in the strip" is not done.
