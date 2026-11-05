# Lane E2: the own engine crashes Chrome within a minute and feels janky (2026-11-05)

Worktree `/Users/blackmad/Code/map-recall2-worktrees/engine-crash-jank-20261105`, branch `lane/engine-crash-jank-20261105`, port 4621. Plan: #213 (items A and D).

## Evidence
- Chrome crash dumps on this Mac: `~/Library/Application Support/Google/Chrome/Crashpad/completed/`, 2026-11-02 08:48 (contains `OOM` and `canalrecall-blackmad.web.app`) and 2026-11-04 22:23. The user played the deployed site with `?engine=own` on this Mac. Sentry has zero events with the engine tag in four days: a tab crash sends nothing.
- Known heap owners (iPhone profile, TODO "P0 — pop-in" block): `_canalSharedFrame` 101 MB, OverviewLayer decoded data + closures 45.6 MB, facade CPU arrays 27 MB, `roadIndex.segments` 20, landmarks CPU arrays 12; iPhone heap gate RED 300 vs 250.
- Suspects for growth inside the first minute: chunk fade-in clones a material per arriving chunk (`threeBuildingsBrowser.ts` `fadeIn`, `fading` map, CHUNK_FADE_MS 350) and once linked a program in-frame; the road world cache packs a 17.6 MB record at graph build and writes it to IndexedDB ~3 s into the ride (`routing/roadWorldCache.ts`); worker-pool transfer buffers (`engine/workerPool.ts`); overview + world cells both resident.

## Measure first (no code changes until the table exists)
1. A 60 s own-engine ride on this Mac's Chrome, desktop viewport (`_desktopPerfViewport` in budgets.json), seeded route: JS heap every 5 s with a forced GC (`scripts/heap-ride.mjs`, extend to a timeline), GPU texture and geometry bytes (`engine/glCounters.ts`, `?glCounters=1`), renderer memory if the harness can read it (`performance.measureUserAgentSpecificMemory` under COOP/COEP, else the CDP Memory domain). Then a 10-minute ride. Then the same on the iPhone profile at 4× throttle (memory `perf-profiling-method`: ignore the ~1.7 s Profiler.start stall).
2. Frame-time histogram and long tasks over the 60 s ride, attributed by `engine/framePhases.ts` (install, ground cell build, label layout, GC, program link). `scripts/motion-stutter.mjs` and `tests/e2e/ride-perf.spec.ts` are the existing harnesses; use them or extend them, do not write a third.
Post the table on the lane issue before fixing anything: heap by owner at 0/30/60/600 s, the growth slope, the top three stall owners with ms per occurrence and count.

## Then fix in owner order, each behind a flag with the number before/after
- Free fade clones when the fade ends (or share one uniform-driven material); compile the fade program at startup.
- Move the road-cache pack + write out of the ride (after the settle, in idle slices, or chunked) and drop the extra copies.
- OverviewLayer: drop the retained decode after geometry build.
- Install budget: ≤ 2 ms of chunk install per frame, geometry upload budgeted, program links only at startup.
- Anything else the table names.
Gates to record for the integrator (budgets.json is theirs): desktop heap flat ±10 % after minute 1 over 10 minutes; p99 frame ≤ 33 ms and 0 frames > 100 ms over 60 s on this Mac; iPhone profile p99 ≤ 50 ms; three 5-minute rides with no crash.

## Telemetry (small, do it early)
- A ride heartbeat: stamp sessionStorage every 5 s with engine/tier/ride phase; on the next load, if the last stamp has no matching unload, send one Sentry event "previous ride ended without unload" with those tags (`src/canalRecall/monitoring.ts` owns Sentry; keep it typed and tested).
- `webglcontextlost` / restored → a Sentry event with the engine tag (frameHost.ts already has the listeners).

## Rules for every engine lane (2026-11-05)
- Work only in your worktree (given above), on your branch, with `/usr/bin/git`. Never `git stash`, never `pkill`; stop your dev server by the PID on your port. Never `npm install` in the shared checkout.
- Do not edit integration hotspots: `game.js`, `index.html`, `package.json`, lockfiles, generated bundles under `public/canal-drive/js/*.bundle.js`, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `budgets.json`. Put new tests in `src/` next to the module; tell the integrator which npm test script and which bundle build they belong to.
- Browser runs go through the shared lock: `PW_PORT=<your port> /tmp/canal-pw.sh perl -e 'alarm 2400; exec @ARGV' -- npx playwright test <spec> --project=desktop --workers=1 --trace off --reporter=line`. One run at a time per lane. Timing measurements (stutter, heap) use `CANAL_PW_EXCLUSIVE=1`.
- The own engine is `?engine=own`; the default is still MapLibre. Measure both when the change can touch both.
- Acceptance is a measured ride or a pinned spec, not a strip. Every fix gets a named regression location and a flag to turn it off (`?x=0`) so the integrator can A/B it.
- Hand back on your lane issue as a comment: branch + SHA (pushed), what changed, numbers before/after, the bundles to rebuild, the tests to wire, and what is still open. Then stop. The integrator merges; do not merge main into your branch unless you need something from it (then say so).
- The user plays on this Mac in Chrome and on an iPhone. "Works in the strip" is not done.
