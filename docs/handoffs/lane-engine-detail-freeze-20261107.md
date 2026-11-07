# Lane R3-G: freeze the detail block from the air

Worktree `/Users/blackmad/Code/map-recall2-worktrees/engine-detail-freeze-20261107`, branch `lane/engine-detail-freeze-20261107` from `origin/main` (0bd68d450), port 4657. Issue #242. Plan #222 (`docs/handoffs/engine-look-plan-20261106.md`, S5). Model: opus. Rules: `docs/handoffs/LANE-RULES.md` and the engine-lane block at the end of this brief. Runs in parallel with R3-F #241 (aerial bases + labels; fences below) and after it in merge order.

## What the user sees

Two shots in map-recall2-screenshots `engine/2026-11-07-user-shots/` (`aerial-amstelkanaal-labels-bounce.png`, `aerial-chassebuurt-retail-labels.png`): Free Ride, pitch ~74°, eye ~150 m, panning across the city. "Why do we still get so much pop-in at that zoom level?" From 150 m up the edge of the detail block and the edge of the coarse ring are both inside the frame, and both hand over continuously while the camera subject moves.

## The measurement (quiet machine, 2026-11-07 08:19, main cf0f9d02e, `scripts/aerial-pan.mjs --chrome --headed`, `artifacts/perf/quiet/aerial-desktop.json` in worktree `engine-demo-check-20261106`)

The baked world is 18 MB gzipped (cells 11 MB, far prisms 6.8 MB). The 3-minute pan uploaded **17.8 GB** to the GPU (`gl.uploadMB` delta summed over the 36 samples; 10,686 uploads at the last sample). The top upload owner at every sample is `facades:three-building-facades (new geometry)` (220 MB in one sample): the detail and coarse tiers are built from cells and uploaded again every time the subject moves across a tile edge, then dropped. Per sample: 22–29 chunks resident, 8–13 z14 tiles, 24–37 k buildings, fading 0–10 chunks; far prisms constant at 151 cells / 80 MB.

The detail tier is the part this lane owns:

- `engine/ownWorldView.ts:896` calls `this._threeBuildings?.setDetailCentre?.(view.subject[0], view.subject[1])` every frame; `view.subject` is the camera anchor, which moves with the pan when the camera is detached from the rider (`:910` only moves the rider when `!view.detached`).
- `threeBuildingsBrowser.ts:1127-1135 setDetailCentre` re-plans `detailBlock(...)` (`detailRing.ts:80`; `DETAIL_MAX_TILES` 6 at z16 on desktop, 8 at z17 on touch, `DETAIL_LEAD_M` 110 / 160, `DETAIL_LINGER_M` 160 via `detailLingerEnabled`, touch only today) and installs the new tiles: each is a worker layout (10–30 ms), an upload, a 700 ms dissolve (`CHUNK_FADE_MS`), and the extras and trees chunks that follow it (`cityExtras.ts`, 12 tree chunks in the samples).
- From 150 m the detail tile's difference from the coarse shell is roof extras and window detail a few pixels wide. Nobody can see the swap, but everybody sees the dissolve wave and pays the uploads.

## Do

1. **Baseline on your branch**: the aerial pan, desktop and iPhone, headed, framePhases on (command below). Add two stats to the samples if they are not there already: `detailInstalls` (detail chunks installed since the last sample) and `uploadMBDelta`. Post the table: uploads over the pan, detail installs, chunks resident, fading, frames > 100 ms, p99 worst window, GL max, draws max.
2. **Freeze the detail block while aerial.** `?detailFreezeAerial=0` restores today. The aerial predicate is `rendererShared/aerialView.ts isAerialView(zoom, pitch, lat)` (the same one labels and the far ring use; `AERIAL_EYE_MIN_M` 60, `AERIAL_REACH_MIN_M` 1500). While it is true, `setDetailCentre` keeps the last planned block: no new detail tiles are requested, the resident ones stay (linger is unbounded while aerial), their extras and trees stay, and the coarse and far tiers cover the rest exactly as they do today beyond the block. When the view leaves the air (lands, or the camera reattaches), plan from the current subject as today; the 700 ms dissolve on landing is accepted. If the ride *starts* aerial (no previous block), plan once at the entry pose, then freeze. Pass the predicate in from `ownWorldView.ts:896` (one argument; compute it there with the camera's zoom, pitch and lat), keep the rule itself in `detailRing.ts` as a pure function (`detailBlockFrozen(previous, aerial)` or similar) with unit tests: frozen while aerial, re-planned on exit, first plan when there is no previous block, and `?detailFreezeAerial=0` identical to today.
3. **Do not drop the resident detail tiles from the air.** Dropping them would save GPU bytes but re-build them on landing; the churn is the complaint. Report their GPU bytes from the air (glCounters owners) so the integrator can decide later.
4. **Measure after** (same harness, both profiles): the table from step 1; `SHOTS=<dir>` frames at every pose change before/after; then the landing case: a Free Ride that pans from the air to the S1 pose and drops to street level (`scripts/aerial-pan.mjs` has the poses; add a `--land` leg if there is none, or script it in `tests/e2e/`): time from landing to the detail block being resident (`detailInstalls` settles), the 60 s street ride p99 (`scripts/heap-ride.mjs --ride 60 --chrome`), `swap-gate.spec.ts` (`PERF_SWAPS=1`), `rider-cover-bump.spec.ts`, all unchanged.
5. **Gate**: detail installs while aerial = 0 after the entry plan; uploads over the 3-minute pan ≤ 60 % of your baseline (the coarse tier's share stays until R4-A #243); frames > 100 ms and p99 worst window not worse than baseline on either profile; GL max within `aerialGlMaxMB` (700 / 400); street-level rows unchanged; the SHOTS frames show the same city from the air (the frozen detail edge may sit elsewhere; no holes, no doubled buildings). If a gate is not met, hand back the table and the residual.
6. **Strips**: map-recall2-screenshots `engine/2026-11-07-r3g/`: the two user poses, main | frozen, mid-pan frame, plus the landing frame at S1 at +0, +1, +2 s.
7. **Tests**: `detailRing.test.ts` (or the file beside `detailRing.ts`) gains the freeze rule; `npm run lint`, `npm run test:engine`, `npm run test:canal-game-structure`; under the lock `PW_PORT=4657 /tmp/canal-pw.sh npx playwright test swap-gate rider-cover-bump --project=desktop --workers=1 --trace off --reporter=line`.

The pan command (under the exclusive lock, one profile at a time, headed Chrome opens a window on the user's screen; that is the budget's method):

```
PORT=4657 CANAL_PW_EXCLUSIVE=1 /tmp/canal-pw.sh perl -e 'alarm 1500; exec @ARGV' -- \
  node scripts/aerial-pan.mjs artifacts/aerial/<name>.json --device desktop --pan 180 --every 5 --chrome --headed \
  --qs '?ride=free&engine=own&framePhases=1'
```
(`--device iphone` for the phone profile; `BUNDLES_DIR=<scratch>` for your build.)

## Keep (fences)

Edit only `detailRing.ts` (+ test), `threeBuildingsBrowser.ts setDetailCentre` and the one call site at `ownWorldView.ts:896`. R3-F #241 owns `ownWorldView.ts syncGround` and the label section (`:700-740`), `engine/overlays/labelLayer.ts`, `refreshGroundBases` and its scheduler: do not touch them. R3-E #240 owns `look/*`, `roofTier.ts`, `cellMips.ts`. R4-A #243 owns the coarse tier (`world/*`, `farShells.ts`, the `coarse:` request path): leave the coarse ring following the subject. `?farShells`, `?labelAerialCap`, `?groundView`, `?detailLinger` semantics unchanged; the MapLibre engine untouched.

## Hand back on #242

Branch + SHA (pushed, merged with `origin/main` first); the before/after table per profile; the landing numbers; the strips' paths; which bundles to rebuild (`three-buildings` + worker, `engine`); the new test and which script it joins; What's New text ("Panning across the city from the air no longer rebuilds the nearby streets as you move"); what is still open (the coarse tier's share of the uploads, R4-A). Then stop; the integrator merges.

## Engine-lane rules (2026-11-05, unchanged)

- Work only in your worktree on your branch with `/usr/bin/git`. Never `git stash`, never `pkill`; stop your dev server by the PID on your port (`kill $(lsof -t -iTCP:4657 -sTCP:LISTEN)`). Never `npm install` in the shared checkout; `node_modules` is already linked.
- Do not edit `game.js`, `index.html`, `package.json`, lockfiles, generated bundles, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `budgets.json`: hand the integrator the text and numbers instead. New tests live in `src/` next to the module.
- Build to a scratch `--outdir` and run through `BUNDLES_DIR`; the Vite dev server full-reloads on any worktree change and silently hangs a harness run. `scripts/build-canal-engine.mjs` has no `--help`: it builds into `public/` when run.
- Browser runs through the lock: `PW_PORT=4657 /tmp/canal-pw.sh perl -e 'alarm 2400; exec @ARGV' -- npx playwright test <spec> --project=desktop --workers=1 --trace off --reporter=line`; timing runs with `CANAL_PW_EXCLUSIVE=1`. Wrap `git push` in `CANAL_PW_EXCLUSIVE=1 /tmp/canal-pw.sh` (the pre-push hook runs a browser smoke test).
- Acceptance is a measured pan or a pinned spec beside the user's shot, not a strip alone. Every fix has a `?x=0` flag and a named regression location. Then stop; the integrator merges.
