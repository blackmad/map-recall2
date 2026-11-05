# Lane E5: ride-start stalls under the own engine (2026-11-05)

Worktree `/Users/blackmad/Code/map-recall2-worktrees/engine-ride-start-20261105`, branch `lane/engine-ride-start-20261105`, port 4625. Plan: #213 item D, the part lane E2 (#215) left red.

## Evidence (E2 hand-back, HISTORY "The own engine does not leak", 2026-11-05)
- In motion the own engine is fine: desktop p99 10.4 ms, 0 frames over 100 ms in 60 s; iPhone profile at 4× p99 33.4 ms.
- The stalls are at ride start: the ride-start game frame was 97–112 ms desktop / 215–234 iPhone; the staged ground hook (`?stagedGroundHook=0` to disable) brought the worst ride-start frame to 59/67 ms, but 2–3 frames over 100 ms remain in the first seconds: **first draw 35–84 ms** and **label rebuilds 45 ms desktop / 164 ms iPhone**.
- The user's verdict "janky" was given on this Mac's Chrome on the deployed site with `?engine=own`; the first seconds after Start are what a player feels most, and the game restarts a ride at every respawn and every new route.
- `engine/framePhases.ts` attributes frames by phase (install, ground, labels at `ev(vm._labelOverlay,'frame','labels')`, render listeners); the label layer is `engine/overlays/labelLayer.ts` with `engine/labelOcclusion.ts`. Harnesses: `scripts/motion-stutter.mjs`, `tests/e2e/ride-perf.spec.ts`, `scripts/heap-ride.mjs` (timeline columns from E2). Use or extend them; do not write a fourth.

## Measure first (no code changes until the table exists)
1. Ten ride starts (seeded default route, then Free Ride, then a route change mid-ride, then a respawn after a wrong turn) on this Mac's Chrome at the desktop perf viewport and on the iPhone profile at 4× (memory `perf-profiling-method`: ignore the ~1.7 s Profiler.start stall). For each: every frame over 50 ms in the first 10 s, attributed by phase, with what the frame did (label rebuild of N labels, first draw of N chunks, N ground slices, program links, texture uploads, GC).
2. The label rebuild: why 164 ms on iPhone. Count labels laid out, glyph atlas uploads, occlusion queries per rebuild, and how often a rebuild runs in the first 10 s.
Post the table on the lane issue before fixing anything.

## Then fix in owner order, each behind a flag with the number before/after
- Label rebuild: incremental layout (only labels whose tile or occlusion changed), layout over frames under a ms budget, glyph atlas prewarmed before Start, no rebuild while the camera settles.
- First draw: program links and texture uploads moved into the pre-Start settle (the start screen is on screen for seconds; `renderer.compile` the materials then), chunk install ≤ 2 ms a frame at ride start as in motion.
- Ground slices, GC, anything else the table names.
Gate to record for the integrator (budgets.json is theirs): 0 frames over 100 ms and at most 2 over 50 ms in the first 10 s of a ride start, desktop; iPhone profile 0 over 200 ms, at most 3 over 100 ms; measured over 5 starts each, and the motion numbers above unchanged.

## Rules for every engine lane (2026-11-05)
- Work only in your worktree (given above), on your branch, with `/usr/bin/git`. Never `git stash`, never `pkill`; stop your dev server by the PID on your port. Never `npm install` in the shared checkout.
- Do not edit integration hotspots: `game.js`, `index.html`, `package.json`, lockfiles, generated bundles under `public/canal-drive/js/*.bundle.js`, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `budgets.json`. Put new tests in `src/` next to the module; tell the integrator which npm test script and which bundle build they belong to.
- Browser runs go through the shared lock: `PW_PORT=4625 /tmp/canal-pw.sh perl -e 'alarm 2400; exec @ARGV' -- npx playwright test <spec> --project=desktop --workers=1 --trace off --reporter=line`. One run at a time. Timing measurements use `CANAL_PW_EXCLUSIVE=1`.
- The own engine is `?engine=own`; the default is still MapLibre. Measure both when the change can touch both.
- Acceptance is a measured ride start, not a strip. Every fix gets a named regression (a spec or a harness mode the integrator can rerun) and a flag to turn it off (`?x=0`).
- Hand back on your lane issue as a comment: branch + SHA (pushed), what changed, numbers before/after, the bundles to rebuild, the tests to wire, and what is still open. Then stop. The integrator merges; do not merge main into your branch unless you need something from it (then say so).
- The user plays on this Mac in Chrome and on an iPhone. "Works in the strip" is not done.
