# Lane R3-F: the aerial pan — take the main-thread owners out of the worst frames

Worktree `/Users/blackmad/Code/map-recall2-worktrees/engine-aerial-20261107`, branch `lane/engine-aerial-20261107` from `origin/main` (cf0f9d02e or later), port 4656. Issue #241. Plan #222 (`docs/handoffs/engine-look-plan-20261106.md`, S5 and the aerial rows of `tests/perf/budgets.json`). Model: opus. Rules: `docs/handoffs/LANE-RULES.md` and the engine-lane block at the end of this brief. The user asked this morning: "can we get better aerial pan?" Yes: the worst frames are named below, and two of the three owners are main-thread work that does not need to run on those frames at all.

## The measurement to beat (2026-11-07 08:19–08:28, main cf0f9d02e, `scripts/aerial-pan.mjs` with `--chrome --headed`, the budget's method, framePhases on; outputs `artifacts/perf/quiet/aerial-{desktop,iphone}.json` in worktree `engine-demo-check-20261106`)

| row | budget | desktop | iPhone 13 profile |
|---|---|---|---|
| p99 frame, worst 5 s window | 33 / 50 (report-only; round 2: 167 / 117) | **158 ms** | **108 ms** |
| p99, median window | | 83 | 58 |
| frames > 100 ms in 180 s | | **56** | **24** |
| frames > 250 ms | 0 | 0 | 0 |
| draws, max | 400 (report-only) | 1,780 | 829 |
| GL resident, max | 700 / 400 MB | **711** | 358 |
| landmarks resident, max | 260 / 130 | 255 | 125 |
| heap growth | 10 % | −15 % | −4 % |
| labels, worst frame | | **122 ms** | 29 ms |

**Phases of the slowest frame of each sample, summed over the 36 samples (ms):**

| phase | desktop | iPhone |
|---|---|---|
| `sync: ground update: building bases` | **571** | **789** |
| `three render main` (GPU fill; shadow map inside it 87 / 147) | 511 | 494 |
| `labels` (`labels: place (full)` 122 in one frame) | 175 | 47 |
| `beforeRender trees` | 42 | — |
| `beforeRender own-ground` | 16 | 28 |

The worst desktop windows (p99 > 100) sit over `west-bos-en-lommer` and `oost-dapperbuurt`, where the pan crosses tile edges and the own ground installs cells continuously.

## The owners, in the code

1. **Building bases.** `engine/ownWorldView.ts` `syncGround` (around `:645-655`): whenever the ground's `surfaceRevision` changes (every own-ground cell install or relief tile during a pan; throttled to one per 400 ms) it calls `tb.refreshGroundBases()` and then `extras.refreshGroundBases()`, both synchronous on the frame: every resident chunk's pands are re-lifted to the sampled ground (`ownGround/chunkBases.ts liftPands`, `groundVertices`; the per-feature `setGroundBase` callback samples `ground.footprintBase(ring)` per pand). From the air there are 13 tiles and tens of thousands of pands resident, the result is invisible at 60+ m eye height (the lift is centimetres), and the ring keeps changing, so the frame pays 50–150 ms every 400 ms for nothing anyone sees.
2. **Labels.** `engine/overlays/labelLayer.ts` `place` (`:300-340`): a full placement runs when the camera moved enough or every 400 ms; R2-B's aerial cap (`labelAerialCap`, `ownWorldView.ts:720`) limits candidates by priority but one full placement still took 122 ms on desktop (the pose where the aerial flag flips, or a tile edge with thousands of candidates: `labelCandidatesMax` 3,022 in the night run).
3. **Draws.** 1,780 draw calls at the worst sample (budget 400, report-only since R2-B): the resident tier draws every building chunk separately from the air. R2-B's unfinished step 3 (resident coarse from the SHEL stream, one merged mesh per cell) is the real fix; it is a lane of its own, not this one.

## Do, each behind a flag, byte-identical off, measured with the same harness and method

1. **Baseline on your branch** with the exact command below (headed Chrome, both profiles, framePhases on); post the table above re-measured, so your deltas are against your own run, not mine.
2. **Bases: never on an aerial frame.** `?groundBasesAerial=0` restores today. When `isAerialView` (`rendererShared/aerialView.ts`) is true, `syncGround` records the revision as pending and does not rebase; when the view leaves aerial (or the camera reattaches), one rebase runs, **time-sliced**: `refreshGroundBases` takes a budget (e.g. 4 ms per frame, chunks in distance order, nearest first) and continues next frame; `extras.refreshGroundBases` the same. Keep the existing 400 ms throttle for street-level rides. Unit-test the slicing (a pure scheduler in `ownGround/baseRefreshBudget.ts` or next to `chunkBases.ts`: N chunks, budget B, deterministic order, resumes where it stopped, a revision bump restarts from the nearest). Check the street-level ride is unchanged: `heap-ride.mjs --ride 60` p99 and `rider-cover-bump.spec.ts` (bases matter there) green.
3. **Labels: a per-frame budget for full placements.** `?labelBudget=0` restores. A full placement that would exceed `LABEL_PLACE_BUDGET_MS` (sweep 4, 8) stops after the budget with the winners so far and finishes next frame (candidates already sorted by priority, so the visible result is the same set a frame later); from the air, also lower the full-placement cadence to 800 ms while the camera is moving at pan speed. Measure `labelsWorstMs` and the `labels` phase total before/after on both profiles; the placed-label count at the S1 and S4 poses must not drop (`labels placed` in the samples).
4. **GL max.** Desktop peaked at 711 MB against 700 with round 5's landmarks resident at 255 of the 260 cap. Report what holds the bytes at the peak sample (`glCounters` owners in the JSON) and whether `landmarks/landmarkResidency.ts` should drop farthest-first at a lower cap from the air (e.g. 200 desktop); propose, do not change the cap unless the pan shows no visible loss in the SHOTS frames.
5. **Draws.** Report only: draws per kind at the worst sample (chunks by kind, landmarks, ground, far shells, labels), so the follow-up lane for resident coarse from SHEL has its target table.
6. **Gate** (headed, both profiles, 3-min pan): frames > 100 ms ≤ 20 desktop / ≤ 10 iPhone (from 56 / 24); p99 worst window ≤ 100 / ≤ 80 ms (from 158 / 108); `sync: ground update: building bases` absent from the worst-frame phases while aerial; frames > 250 ms stays 0; heap growth, GL max, landmarks, far cells within their rows; street-level ride p99 and cover-bump unchanged. If a gate is not met, hand back the table and the residual by phase.
7. **Strips**: the harness's `SHOTS=<dir>` frames at each pose change before/after (the look must not change from the air); commit to map-recall2-screenshots `engine/2026-11-07-r3f/`.

The command (under the exclusive lock, one profile at a time):

```
PORT=4656 CANAL_PW_EXCLUSIVE=1 /tmp/canal-pw.sh perl -e 'alarm 1500; exec @ARGV' -- \
  node scripts/aerial-pan.mjs artifacts/aerial/<name>.json --device desktop --pan 180 --every 5 --chrome --headed \
  --qs '?ride=free&engine=own&framePhases=1'
```
(`--device iphone` for the phone profile; `BUNDLES_DIR=<scratch>` for your build.) Headed Chrome opens a window on the user's screen; that is the budget's method, keep it.

## Keep

`?farShells`, `?labelAerialCap`, `?groundView` semantics; the ride-start and motion rows (`desktopColdStartOver200Ms`, `desktopMotionP99Ms`, `iphoneMotionP99Ms`) unchanged; `ownGround/*` untouched except a new pure scheduler module (R3-E #240 does not touch ownGround, but keep to `gameGround.ts` consumers if you must); `threeBuildingsBrowser.ts` edits limited to `refreshGroundBases` taking a budget; `roofTier.ts`, `look/*`, `windowSdf.ts` untouched (R3-E's fence); the MapLibre engine untouched.

## Hand back on #241

Branch + SHA (pushed, merged with `origin/main` first); the before/after table per profile (the rows above plus the phase sums and `labelsWorstMs`); the budget sweep; the GL-peak owner table and the draws-per-kind table; the strips' paths; which bundles to rebuild (`engine` via `build:canal-engine`, `three-buildings` + worker if touched); new tests and which script they join; What's New text ("Panning across the city from the air is smoother"); what is still open (draws from the air). Then stop; the integrator merges.

## Engine-lane rules (2026-11-05, unchanged)

- Work only in your worktree on your branch with `/usr/bin/git`. Never `git stash`, never `pkill`; stop your dev server by the PID on your port. Never `npm install` in the shared checkout; link `node_modules` (already linked).
- Do not edit `game.js`, `index.html`, `package.json`, lockfiles, generated bundles, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `budgets.json`: hand the integrator the text and numbers instead. New tests live in `src/` next to the module.
- Build to a scratch `--outdir` and run through `BUNDLES_DIR`; the Vite dev server full-reloads on any worktree change and silently hangs a harness run. `scripts/build-canal-engine.mjs` has no `--help`: it builds into `public/` when run.
- Browser runs through the lock: `PW_PORT=4656 /tmp/canal-pw.sh perl -e 'alarm 2400; exec @ARGV' -- npx playwright test <spec> --project=desktop --workers=1 --trace off --reporter=line`; timing runs with `CANAL_PW_EXCLUSIVE=1`. Wrap `git push` in `CANAL_PW_EXCLUSIVE=1 /tmp/canal-pw.sh` (the pre-push hook runs a browser smoke test).
- Acceptance is a measured ride or a pinned spec beside the user's shot, not a strip alone. Every fix has a `?x=0` flag and a named regression location. Then stop; the integrator merges.
