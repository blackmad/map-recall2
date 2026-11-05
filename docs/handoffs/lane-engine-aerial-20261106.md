# Lane R1-C: the aerial-pan scenario — memory and frame gates, perf HUD, heartbeat check (2026-11-06)

Worktree `/Users/blackmad/Code/map-recall2-worktrees/engine-aerial-20261106`, branch `lane/engine-aerial-20261106`, port 4642. Issue #225. Plan #222, `docs/handoffs/engine-look-plan-20261106.md`. Model: opus. Rules: `docs/handoffs/LANE-RULES.md` and the engine-lane block at the end of `lane-engine-swap-20261106.md` (same rules, port 4642).

## What the user saw

On `https://rideamsterdam.nl/ride?ride=free&engine=own` (build 69d4c65, Mac, DPR 2) the user "scrolled around a ton in the city" from the air (poses like `s1-hoftuin-distance-popin.png` and `s4-zuidas-rails.png` in map-recall2-screenshots `engine/2026-11-06-user-shots/`) and the tab became "practically locked". Question: did we load too much into memory and not unload enough? Nobody could attach to the tab; Sentry (org whizziwig, project canal-recall) had no event at all in the previous 24 h, so the heartbeat from lane E2 had not reported anything either.

## What the code does (main at 69d4c65)

- Lane E2 measured the **ride** heap flat (~380 MB over 10 min, 8 rides). The aerial pan is not a measured scenario anywhere (`scripts/heap-ride.mjs`, `scripts/motion-stutter.mjs`, `tests/e2e/phone-memory.spec.ts` all ride a route).
- From the air the ground resident ring grows in 400 m steps to 2000 m (`ownGround/gameGround.ts:299-307`, `engine/worldStreamer.ts:186-205`); check whether it ever shrinks back. The far ring reaches 7 km in 1 km blocks (`farRing.ts:29-35,207-217`). Building residency: up to 12 coarse z14 tiles + 6–8 detail tiles + route-ahead (`buildingTilesBrowser.ts:169-178`, `detailRing.ts`), 24 decoded / 36 resident world cells (`world/worldCells.ts:44,48`). Landmark models: 72 resident on desktop, evicted off-view furthest-first (`landmarks/landmarkResidency.ts:33-44`); the old note "25–40 landmark models load during the spawn settle because the pitched view's bounds reach the horizon" (TODO) still applies. Labels: every POI in a horizon-deep view is laid out (S4 shows dozens). GPU bytes (`renderer.info.memory`, `glCounters` texImage/bufferData) are gated only for the iPhone texture MB.
- Telemetry: the ride heartbeat and `webglcontextlost` → Sentry landed in E2 (`2c573136d`); `?heartbeat=0` turns it off.

## Do, in this order

1. **Scenario script** `scripts/aerial-pan.mjs` (same harness shape as `scripts/heap-ride.mjs` / `motion-stutter.mjs`, headed Chrome on this Mac at 1512×982 DPR 2, then the iPhone profile): a 3-minute Free Ride that takes the S1 pose (high pitch) and the S4 pose (from the air) and pans Centrum → Zuid → West → Oost at a hand-scroll speed, recording every 5 s: JS heap after forced GC, `renderer.info.memory.geometries/textures`, cumulative `texImage`/`bufferData` bytes (`?glCounters=1`), resident counts (world cells, chunks by kind, landmark models, labels placed, trees, ground cells, far-ring blocks), worker count, frame p99, frames > 100 and > 250 ms, attributed by `framePhases`. Post the table on #225 **before** changing code.
2. **Gates** (new rows in `tests/perf/budgets.json`, numbers from step 1 as the baseline): `aerialHeapGrowthPct` ≤ 10 after minute 1; `aerialGeometriesMax` and `aerialTexturesMax` bounded (no monotonic growth across the sweep: the value at minute 3 within 10 % of minute 1); `aerialP99Ms` ≤ 33 desktop / 50 iPhone; `aerialFramesOver250Ms` 0.
3. **Fix the owners the run names**, largest first, each behind a flag: the likely list is the ground ring never shrinking back from 2 km, landmark models thrashing at the 72 cap (re-fetch on every sweep: add a decoded-model cache or a hysteresis), label index rebuilds per pan step, chunk fade clones kept alive, far-ring blocks never released. Do not guess: fix what the table shows.
4. **Perf HUD**: `?perfHud=1` and a "Show performance" toggle under Comfort & detail (`overlay/OverlayApp.tsx`, strings in `i18n/messages/en.ts`, preference in `game/preferences.ts`, phone and desktop Storybook stories): one small mono line, bottom-left above the attribution, with tier, pixel ratio, heap MB, GPU MB estimate (geometries + textures), resident cells/chunks/models, frame p99 over the last 5 s. Off by default; the build stamp stays as is. It must cost < 0.2 ms a frame (update at 1 Hz).
5. **Heartbeat check**: confirm from Sentry that a ride on the deployed build sends the heartbeat and that an unclean end would be reported (`sentry-cli --org whizziwig` or the Sentry MCP); if the deployed build is not sending, that is the P0 of this lane and goes first. Report what the next locked tab will leave in Sentry.

## Keep

Ride gates unchanged (`desktopRideHeapGrowthPct` 10, `desktopMotionP99Ms` 33, `iphoneMotionP99Ms` 50, start-stall rows); `world-v1-bytes.spec.ts`; `phone-memory.spec.ts`; the heartbeat.

## Hand back on #225

Branch + SHA (pushed); the aerial table before/after (desktop and iPhone), the owners found and what each flag does; HUD screenshots on desktop and phone; the Sentry finding; bundles to rebuild and test scripts to wire; What's New text ("Show performance" is user-visible); what is still open.
