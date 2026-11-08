# Lane R4-F: the fetch ring's root trigger and the inventory-trees rebuild, the two owners R4-E left

Worktree `/Users/blackmad/Code/map-recall2-worktrees/engine-ring-footprint-20261108`, branch `lane/engine-ring-footprint-20261108` from `main` (after 983f4d957), port 4665. Issue #249. Plan #222. Model: opus. Rules: `docs/handoffs/LANE-RULES.md`.

Engine round 4, after R4-E (#248, HISTORY 2026-11-08 "R4-E aerial arrivals"): `?arrivalPace` is desktop-on and the continuous 120 m/s pan meets both aerial gates (8 / 12 frames > 100 ms, p99 worst window 91.7 / 91.6). The harness pan at 300 m/s sits on the p99 gate (100.0 / 100.2) with 20 / 27 frames, and R4-E named what is left: the ring's root trigger and the trees' full rebuild.

## What is left

1. **`worldRing.rideBox` is the trigger of every ring jump.** It keeps a ride-sized stand-in round the parked rider while the rider is inside the view's bounding box. A pitched aerial view's box reaches kilometres, so the fetch ring stays at 4 or 25 cells and then reads the whole view at once (132 cells on the west leg, 378–462 on the oost leg). R4-E paces the jump; it does not remove it. A ring that follows the view's **near footprint** (the ground the view actually resolves, say within the far-tier distance or where a cell is ≥ N px) instead of its whole bounding box, or a box capped at pitch, grows by a row at the leading edge as the camera flies and never jumps. Keep the stand-in at street level (the rider's own ring) exactly as it is: `ringSignature` / `ringFollowEnabled` behaviour there is byte-identical with the flag off.
2. **The inventory-trees rebuild is the largest script in every remaining long frame** (70–235 ms from the air, 8 of 8 continuous and 19 of 20 harness long frames with `?arrivalPace=1`). `InventoryTrees.rebuild()` rebuilds every resident instance on any input (a tree tile, a ground re-base, the view leaving its built bounds). Make it incremental: per-tile instance ranges that only the changed tiles rewrite, or a chunked rebuild spread over frames with a budget, in a typed module beside `rendererShared/rebuildCoalescer.ts` with tests; `inventory-trees-source.js` gets the adapter only. Trees must look the same: no missing or doubled trunks at tile seams, caps and culling unchanged (`check-inventory-tree-streaming.mjs`, `check-rose-gardens.mjs`, `check-tree-shape-cache.mjs` green).
3. **Report-only:** `aerialGlMaxMB` is 752–798 against the 700 budget with R4-E off or on; say which resident set owns the excess from the air (detail chunks, baked cells, landmark GLBs, ground) with the counters, no fix unless it is a one-liner.

## Do, measured first, each change behind a flag

- Measure on your branch before anything: continuous pan (`--continuous`) and harness pan, desktop headed, baked tier + arrivalPace default (on), two runs each, under the exclusive lock; record frames > 100, p99 worst window, median window, the ring size over time (cells wanted per 5 s sample; add it to the summary if it is not there) and for every long frame its largest script.
- `?ringFootprint=1` (or the name you choose): the near-footprint ring. Show the ring-size timeline flat-growing instead of stepping; show the resident bytes from the air do not grow past today's (the footprint must not pull *more* cells than the box did at the peak).
- `?treesIncremental=1`: the incremental rebuild. Show the per-rebuild time from the air, and a tree-count parity check (same instances before/after at three poses, street and air).
- After: the two pans, each flag alone and both together with arrivalPace on, A/B rule (≥ 15 fewer frames > 100 ms or ≥ 20 ms worst window, in both of two alternating pairs); the 60 s street ride unchanged; `swap-gate`, `baked-fabric`, `rider-cover-bump` (`ENGINE=own`) green; `npm run lint`, `npm run test:engine`.
- Strips to `blackmad/map-recall2-screenshots` `engine/2026-11-08-r4f/`: the frame-time and ring-size timelines off | on, and a mid-flight frame main | lane at the oost leg with the trees visible.

Pan command (one profile at a time, under the lock; your own dev server on 4665 with `PORT=4665 npx tsx server.ts`):
```
PORT=4665 CANAL_PW_EXCLUSIVE=1 /tmp/canal-pw.sh perl -e 'alarm 1500; exec @ARGV' -- \
  node scripts/aerial-pan.mjs artifacts/aerial/<name>.json --device desktop --pan 180 --every 5 --chrome --headed --continuous \
  --qs '?ride=free&engine=own&framePhases=1'
```
(`BUNDLES_DIR=<scratch>` for your build; the Vite dev server reloads on any worktree file change and silently hangs a run.)

## Fences

Yours: `src/canalRecall/world/worldRing.ts`, the ring side of `src/canalRecall/buildingTilesBrowser.ts`, `src/canalRecall/engine/arrivalPace.ts`, a new typed tree-instance module under `src/canalRecall/rendererShared/` with the adapter lines in `public/canal-drive/js/inventory-trees-source.js`, `scripts/aerial-pan.mjs` (ring-size sample, nothing else). Not yours: `look/*`, `roofTier.ts`, `streetChunks/*`, `bakedCoarse.ts`, the published world extract, the shared integration files (`game.js`, `index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `budgets.json`, `covers.json`).

## Hand back here

Branch + SHA (pushed, merged with `origin/main`); the before/after table (both pans, each flag alone and together); the ring-size timelines; the tree parity check; the GPU-memory owner; strips' paths; which bundles to rebuild (building-tiles, inventory-trees, engine as touched); tests and scripts joined; What's New text if anything visible changed; your default recommendation per flag; what is still open. Then stop; the integrator merges.

Rules: `docs/handoffs/LANE-RULES.md`. `/usr/bin/git` only, never `git stash`, never `pkill` (stop your server with `kill $(lsof -t -iTCP:4665 -sTCP:LISTEN)`), one Playwright run at a time via `/tmp/canal-pw.sh` (`PW_PORT=4665`), timing runs and the push under `CANAL_PW_EXCLUSIVE=1 /tmp/canal-pw.sh`. Wait on background commands in the foreground. Measured results are the acceptance bar, not gates passing. Budget: about 120 turns; hand back what is measured when it runs out.
