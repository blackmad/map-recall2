# Lane E7: the garbage-collection pause at a cold start, the iPhone's first ride frame, and the route-change flush (2026-11-05)

Worktree `/Users/blackmad/Code/map-recall2-worktrees/engine-gc-start-20261105`, branch `lane/engine-gc-start-20261105`, port 4628. Plan: #213 item D, what lanes E5 (#218) and E6 (#219) left red. HISTORY entries "The cold first start stalls less" and "Ride starts stall less under the own engine" are the context.

## Evidence (E6 hand-back on #219, 2026-11-05, 3 runs each, fresh browser per run)
- Desktop cold start: 1 frame over 100 ms per run, and it is a **major GC of 125–165 ms**, 0.1–0.6 s after RACING. iPhone 13 at 4×: 7–8 frames over 100 ms, one of them the same GC at 200–250 ms.
- **The iPhone's first ride frame** is 117–133 ms: camera solve/clearance 25–28 ms (the resident list changes right at landing, before the idle prewarm of `engine/cameraClearance.ts` catches up), then `_render` and `setFerryTerminals`.
- **The following label frame** on the iPhone is 133 ms: labels 51 ms, of which occlusion index 19 (`engine/labelOcclusion.ts`, idle-built since E6 but not ready by the first placement) and policy 16.
- **Route change:** the building-tiles flush into three-buildings `setFeatures` is 86–101 ms on the iPhone (`changedBoxes`, two 36k Sets per flush, and the context pass in `threeBuildingsBrowser.ts`); the coalesced tree rebuild is a separate 20–35 ms task at 4×.
- Shader precompile: no stalled frame compiled a program in E6's runs; leave it unless your profile shows one.
- Harness: `scripts/motion-stutter.mjs --runs cold --seconds 0 --starts default,change` with `?engine=own&world=v1&roads=bin&framePhases=1`, `CANAL_PW_EXCLUSIVE=1`; `scripts/heap-ride.mjs` has the heap timeline; `HEAP_OWNERS=1` is the allocation-owner mode E6 named.

## Measure first
1. A heap-allocation profile of the load and the first second of the ride (Chrome allocation sampling through CDP, or `HEAP_OWNERS=1`), desktop and iPhone profile: which owners allocate the garbage that the first major GC collects (suspects: decoded world cells and their transfer buffers, overview/facade CPU arrays freed after upload, the road cache pack, label layout scratch, chunk fade clones). Post the table on the lane issue: owner, MB allocated before RACING, MB still live after the GC.
2. The iPhone first ride frame and the following label frame, attributed as E6 did.

## Then fix in owner order, each behind a flag with the number before/after
- Cut the garbage before RACING (reuse buffers, transfer instead of copy, free CPU copies before the ride rather than letting the GC find them), or move the pause to the start screen (allocate and release before Start, so the major GC runs while the setup form is up; a forced `gc()` is not available in production, so measure whether an earlier allocation peak moves the GC).
- First frame: start the clearance and occlusion prewarms from the landing position before the flight ends, not from the resident list change at landing; split `setFerryTerminals`.
- Route-change flush: `changedBoxes` as an incremental diff keyed by tile, not two 36k Sets; the context pass only over changed tiles.
- Anything else the profile names.
Gate to record for the integrator (budgets.json is theirs): desktop cold start 0 frames over 100 ms in the first 10 s after RACING; iPhone profile ≤ 5 over 100 ms and 0 over 200 ms; iPhone route change ≤ 2 over 100 ms; over 3 runs each; motion unchanged.

## Rules for every engine lane (2026-11-05)
- Work only in your worktree (given above), on your branch, with `/usr/bin/git`. Never `git stash`, never `pkill`; stop your dev server by the PID on your port. Never `npm install` in the shared checkout.
- Do not edit integration hotspots: `game.js`, `index.html`, `package.json`, lockfiles, generated bundles under `public/canal-drive/js/*.bundle.js`, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `budgets.json`. Put new tests in `src/` next to the module; tell the integrator which npm test script and which bundle build they belong to. A flag reader in a shared module must tolerate a non-browser global, because the structure gate evaluates bundles in Node.
- **Harness trap:** the Vite dev server full-reloads the page on any file change in the worktree and silently hangs a harness run. Build bundles to a scratch `--outdir`, run through `BUNDLES_DIR`, and do not edit files while a run is in flight.
- Browser runs go through the shared lock: `PW_PORT=4628 /tmp/canal-pw.sh perl -e 'alarm 2400; exec @ARGV' -- npx playwright test <spec> --project=desktop --workers=1 --trace off --reporter=line`. One run at a time. Timing measurements use `CANAL_PW_EXCLUSIVE=1`.
- The own engine is `?engine=own`; the default is still MapLibre. Measure both when the change can touch both.
- Acceptance is a measured ride start, not a strip. Every fix gets a named regression and a flag to turn it off (`?x=0`).
- Hand back on your lane issue as a comment: branch + SHA (pushed), what changed, numbers before/after (3 runs each, both profiles), the bundles to rebuild, the tests to wire, and what is still open. Then stop. The integrator merges; do not merge main into your branch unless you need something from it (then say so).
- The user plays on this Mac in Chrome and on an iPhone. "Works in the strip" is not done.
