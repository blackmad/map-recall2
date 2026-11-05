# Lane E6: the cold first start under the own engine (2026-11-05)

Worktree `/Users/blackmad/Code/map-recall2-worktrees/engine-cold-start-20261105`, branch `lane/engine-cold-start-20261105`, port 4627. Plan: #213 item D, what lane E5 (#218, HISTORY "Ride starts stall less under the own engine") left red.

## Evidence (E5 hand-back on #218, 2026-11-05)
- Warm starts are green: route change, Free Ride and next-from-finish have 0 frames over 100 ms on desktop; the iPhone profile at 4× has 0 frames over 200 ms at any start.
- The **cold first start** is red: desktop 1 frame over 100 ms (7–10 over 50 ms); iPhone 15 frames over 100 ms (longest 200 ms). The first route change on the iPhone also has 1–7 over 100 ms.
- Owners, largest first, from `scripts/motion-stutter.mjs --starts default,change,next,free` (per-frame attribution: frame phases, GL work with program names, labels, streaming, LoAF, CPU profile; JSON under `artifacts/perf/e5/` on the E5 branch `lane/engine-ride-start-20261105`):
  1. **Own-ground main-thread slices** of 30–40 ms at 4× on the cold start and first route change: 50 of the 70 remaining iPhone frames over 100 ms. The per-frame budget (`ownGround/frameBudget.ts`, on by default) only splits work between slices; single slices are too big. Candidates: smaller slices, or move the indexing into the ground worker (`own-ground-worker` bundle, `ownGround/groundStore.ts`).
  2. **The first ride-start frame** 80–130 ms on the iPhone: inventory trees re-base every tree in one call (`public/canal-drive/js/inventory-trees-source.js`, hooked from `engine/cityExtras.ts` `hookGround`, already staged one consumer per frame by E2) 34–38 ms; rider cover 13–17 ms (`riderCover.ts` / `coveredPassage.ts`).
  3. **Shader compiles during starts:** 1–2 programs per run (`masonry`, `city-look/lit|slot|uv`, `city-look/lit|slot|box`); one caused a 142 ms first draw on a desktop `next` start. Precompile through `rendererShared/sharedFrame.ts` `compileAsync` before the ride, during the start screen.
  4. **building-tiles flush → `setFeatures`** 60–100 ms once per route change on the iPhone: `changedBoxes` (two 36k Sets per flush) and the context pass in `threeBuildingsBrowser.ts`.
  5. **Label occlusion index** 9–20 ms on the first full placement after a jump (`engine/labelOcclusion.ts`): build it in idle time.

## Measure first, briefly
Re-run the E5 harness on origin/main for the cold start and the first route change, desktop perf viewport and the iPhone profile at 4× (memory `perf-profiling-method`: ignore the ~1.7 s Profiler.start stall), 3 runs each, and post the table on the lane issue. Then fix in owner order, each behind a flag with the number before and after.

## Gate to record for the integrator (budgets.json is theirs)
Cold first start: desktop 0 frames over 100 ms and at most 3 over 50 ms in the first 10 s after RACING; iPhone profile at most 5 over 100 ms, 0 over 200 ms; over 3 runs each; warm starts and motion unchanged (`iphoneRideStartOver200Ms` 0, `desktopRideStartOver100MsWarm` 0, desktop motion p99 ≤ 33 ms).

## Rules for every engine lane (2026-11-05)
- Work only in your worktree (given above), on your branch, with `/usr/bin/git`. Never `git stash`, never `pkill`; stop your dev server by the PID on your port. Never `npm install` in the shared checkout.
- Do not edit integration hotspots: `game.js`, `index.html`, `package.json`, lockfiles, generated bundles under `public/canal-drive/js/*.bundle.js`, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `budgets.json`. Put new tests in `src/` next to the module; tell the integrator which npm test script and which bundle build they belong to. A flag reader in a shared module must tolerate a non-browser global (`typeof URLSearchParams`), because the structure gate evaluates bundles in Node.
- Browser runs go through the shared lock: `PW_PORT=4627 /tmp/canal-pw.sh perl -e 'alarm 2400; exec @ARGV' -- npx playwright test <spec> --project=desktop --workers=1 --trace off --reporter=line`. One run at a time. Timing measurements use `CANAL_PW_EXCLUSIVE=1`.
- The own engine is `?engine=own`; the default is still MapLibre. Measure both when the change can touch both.
- Acceptance is a measured ride start, not a strip. Every fix gets a named regression (a spec or a harness mode the integrator can rerun) and a flag to turn it off (`?x=0`).
- Hand back on your lane issue as a comment: branch + SHA (pushed), what changed, numbers before/after, the bundles to rebuild, the tests to wire, and what is still open. Then stop. The integrator merges; do not merge main into your branch unless you need something from it (then say so).
- The user plays on this Mac in Chrome and on an iPhone. "Works in the strip" is not done.
