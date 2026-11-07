# Lane R4-E: the long aerial frames that remain at ~500 draws, real-play pan or harness teleports, then the owner

Worktree `/Users/blackmad/Code/map-recall2-worktrees/engine-aerial-arrivals-20261108`, branch `lane/engine-aerial-arrivals-20261108` from `main` (3e7751012), port 4664. Issue #248. Plan #222. Model: opus. Rules: `docs/handoffs/LANE-RULES.md`.

Engine round 4, after R4-A (#243 baked coarse tier, desktop on), R4-B (#244) and R4-C (#245). Plan #222.

## What is left

With the baked tier, landmark lod2/batch and the chunk merge on, the desktop aerial pan draws about 500 calls at its peak (was 1,371–1,900) and still misses the frame gates: 21 and 52 frames > 100 ms in two quiet-machine runs (gate ≤ 20), p99 worst window 118 and 175 ms (gate ≤ 100), median window 67–75 ms. R4-A's `coarse fading` log and R4-C's framePhases both say the long frames now cluster where `scripts/aerial-pan.mjs` **teleports** the camera to the next leg (a new district: cells, tiles, landmarks and labels all arrive at once), and that they are `game frame` and loading time, not draws.

Today's lesson (#243 follow-up, HISTORY 2026-11-07 night): a harness condition can look like a play bug. The pan harness jumps between legs; a player panning from the air flies continuously, or arrives from the overview by a fly-to. So the first question is whether real play has these frames at all.

## Do, measured first, each change behind a flag

1. **Two pans on your branch, same bundles, baked tier on, desktop headed, under the exclusive lock:** (a) the harness as it is (`--pan 180 --every 5`, framePhases on); (b) a **continuous** variant of the harness (`--continuous` or similar: the same legs reached by a smooth camera flight at a plausible player speed, no teleport; keep the per-5 s sampling and the summary fields). Report per run: frames > 100, p99 worst window, median window, and for every frame over 100 ms its framePhases split (`game frame`, three render main, loading, labels, ground) and the leg time. If (b) has ≤ 20 frames > 100 and p99 ≤ 100, the gates are met in play and the harness's teleports are the owner: fix the harness (make continuous the default, keep `--teleport` for the old numbers), record it in budgets as the lane's hand-back text, and stop there.
2. **If the continuous pan still misses the gates**, find the owner from the phase split: a loading spike (cells / tiles / landmark GLBs / lod2 decode / shells uploading on one frame), a `game frame` spike (tile enrich, label placement, ground slices), or render. For each owner a bounded, flagged fix: spread the arrival (budgeted uploads per frame, as R3-F did for ground bases), prefetch along the camera's heading (the aerial view knows its velocity), or defer the non-visible work. Measure each alone and together.
3. **Measure after**: the two pans again (harness and continuous), both profiles if the iPhone profile is affected; `aerialGlMaxMB`, heap growth, label churn within their budget rows; the 60 s street ride unchanged; `swap-gate`, `baked-fabric`, `rider-cover-bump` green.
4. **Strips** to `blackmad/map-recall2-screenshots` `engine/2026-11-08-r4e/`: the frame-time timeline per run (the harness's `--chart` if it has one, else a quick plot) with the teleports or legs marked, and a mid-arrival frame main | lane at the worst leg.
5. **Tests** beside the modules; `npm run lint`, `npm run test:engine`, and the specs above under the lock.

Pan command (one profile at a time, under the lock; start your own dev server on port 4664 with `PORT=4664 npx tsx server.ts`):
```
PORT=4664 CANAL_PW_EXCLUSIVE=1 /tmp/canal-pw.sh perl -e 'alarm 1500; exec @ARGV' -- \
  node scripts/aerial-pan.mjs artifacts/aerial/<name>.json --device desktop --pan 180 --every 5 --chrome --headed \
  --qs '?ride=free&engine=own&framePhases=1'
```
(`BUNDLES_DIR=<scratch>` for your build.) The A/B rule for a real difference: ≥ 15 more frames > 100 ms or ≥ 20 ms worst window, in both of two alternating pairs; run-to-run spread today was 21–52 frames with the same bundles.

## Fences

Yours: `scripts/aerial-pan.mjs` (the continuous mode and the phase report), the streaming side of `engine/ownWorldView.ts`, `engine/worldStreamer.ts`, `engine/bakedCoarse.ts` only in its fetch/upload scheduling, `landmarks/landmarkResidency.ts` loading cadence, `labelLayer.ts` only in its aerial cadence if labels own a spike, new typed modules with tests. Not yours: `look/*`, `roofTier.ts`, `streetChunks/*`, `signature-landmarks-source.js` beyond load cadence, the published world extract, the shared integration files (`game.js`, `index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `budgets.json`).

## Hand back here

Branch + SHA (pushed, merged with `origin/main`); the harness-vs-continuous table with the phase split of every long frame; the owner(s) and each fix's numbers; the strips' paths; which bundles to rebuild; the tests and scripts they join; What's New text if anything visible changed; what is still open. Then stop; the integrator merges.

Rules: `docs/handoffs/LANE-RULES.md`. `/usr/bin/git` only, never `git stash`, never `pkill` (stop your server with `kill $(lsof -t -iTCP:4664 -sTCP:LISTEN)`), one Playwright run at a time via `/tmp/canal-pw.sh` (`PW_PORT=4664`), timing runs and the push under `CANAL_PW_EXCLUSIVE=1 /tmp/canal-pw.sh`. Wait on background commands in the foreground. Measured results are the acceptance bar, not gates passing.

