# Lane L4: world-v1 in the worker, identical to the default path, then one streamer

Rules: `LANE-RULES.md`. Programme: `engine-programme-20261030.md` §P2–P3.
Model: opus. Follows L3 (`lane-world-compiler-20261030.md`, merged 2026-10-30,
`src/canalRecall/world/*`, `scripts/world/*`, consumer in
`buildingTilesBrowser.ts` behind `?world=v1`). Staged cells:
`/Users/blackmad/Code/map-recall2-worktrees/world-compiler-20261030/artifacts/world/staging/`
(regenerate with `npm run world:compile`; nothing is published).

## What the browser A/B found (integrator, 2026-10-30, desktop)

`WORLD_AB=1 WORLD_DIR=<staging> PW_PORT=<port> /tmp/canal-pw.sh npx playwright
test world-v1-ab --project=desktop --workers=1` → `artifacts/world/ab/compare.json`:

- At every spot the same four tiles differ in styled features:
  `14/8413/5383`, `14/8414/5383`, `14/8414/5384`, `14/8413/5384`. The world
  path holds more: Westerkerk 31,492 buildings / 36 chunks vs 27,123 / 33 on
  the default path; walls 178k vs 158k. Pixels differing 35–99 %.
- The Node identity test (`worldStreamer.test.ts`) passed at the sentinels, so
  the difference is in something the browser does that Node does not: the
  runtime hide/suppress steps applied after features arrive
  (`_signatureSuppressOsmIds`, covers from loaded models, `basemap-hide-ids`,
  landmark/kit `exceptLandmarks`), a look or theme the cells baked
  differently from the live page (the cells carry the default look only), or
  the `tileCells` assembly pulling buildings from neighbouring cells into a
  tile. Find out which, with the compare.json feature-id diff per tile.
- Decode on the main thread: cells `-1_1`, `-1_2`, `-2_1`, `-2_2` take
  1,239–1,248 ms each; the rest 12–68 ms. That is the ≥ 1 s hitch the
  programme exists to remove.

## Build

1. **Identity in the browser.** Extend `tests/e2e/world-v1-ab.spec.ts` to dump
   the per-tile feature-id sets both ways (ids only in world, only in default,
   styled differently) into `artifacts/world/ab/`. Diagnose and fix so the four
   tiles match; the fix belongs in the compiler or the consumer, never in the
   default path. Gate: `tilesWithDifferentFeatures` empty at all five spots,
   pixel diff at the frozen-frame noise floor (`scripts/perf-frozen-frames.mjs`).
2. **Decode in the worker.** `threeBuildingsWorker.ts` reads cells directly
   (fetch + `DecompressionStream` + `decodeCell` off the main thread); the main
   thread receives typed arrays and the styled-feature summary only. Gate:
   no main-thread task > 16 ms attributable to a cell at 1×, ≤ 50 ms at 4×
   (`scripts/motion-stutter.mjs` with `?world=v1`); the four dense cells
   included.
3. **Bytes.** Drop ATTR and STRS from the runtime read path (keep them in the
   file only if a consumer needs them; otherwise make them `--debug` streams),
   so the fetched bytes approach FOOT + STYL + GRP + HIDE ≈ 11 MB; report the
   before/after row. The ≤ 4 MB target stays recorded as not met until the
   footprint stream itself changes.
4. **One streamer** (after L1's `engine/frameHost.ts` is on main):
   `engine/worldStreamer.ts` with one cell priority queue fed by
   `viewResidency.ts`, `streamingLookAhead.ts` `MotionEstimate` and the
   `landmarkResidency.ts` budgets; one upload budget per frame (ms and bytes)
   on `compileBudget.ts` / `buildScheduling.ts`; one worker pool of
   min(cores − 1, 3). Delete `chunkBuildQueue.ts`, `ownGround/residency.ts`,
   `rendererShared/residency.ts` and the second own-ground worker instance
   when the pool takes their work. Gate: desktop heap at ride start ≤ 500 MB,
   `pop-in.mjs` zero cells installed within 150 m of the rider.
5. **Road graph as CSR** (last): `streets-routing.json` + segment geometry →
   compiled Int32/Float32 arrays read by `road-network.js` and `routing/*`
   without objects. Gate: road graph heap ≤ 30 MB, `test:canal-car` and
   `test:reachability` green.

## Checks

`npm run lint`; `npm run test:world-format`; `npm run test:city-startup`;
`WORLD_AB=1 … world-v1-ab --project=desktop` and `--project=iphone`;
`scripts/motion-stutter.mjs` default vs `?world=v1`; `phone-memory pop-in
--project=iphone` with `?world=v1`. One browser run at a time, ≤ 20 minutes
each, under `/tmp/canal-pw.sh`.

## Hand back

The `LANE-RULES.md` block after step 1 (identity) and again after step 2,
with the per-tile diagnosis, the decode table before/after, the byte row, and
the exact `package.json` / bundle lines for the integrator.
