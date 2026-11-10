# Lane: roofs sit offset from their walls (user shots 2026-11-08)

Worktree `/Users/blackmad/Code/map-recall2-worktrees/engine-roofs-offset-20261108`, branch `lane/engine-roofs-offset-20261108` from `main` (11cbb47a7 or later), port 4672. Issue #257. Model: opus. Rules: `docs/handoffs/LANE-RULES.md`.

The user, riding the live build 7cda9af on 2026-11-08: "what's up with these roofs not lining up with the buildings?" and "yeah roof decoding being weird". Two shots in `blackmad/map-recall2-screenshots` under `user-shots/2026-11-08/`:
- `roofs-offset-weteringschans-singelgracht.png`: camera over Max Euweplein / Leidseplein looking south-east along the Singelgracht toward Hobbemastraat and Stadhouderskade (labels Weteringschans, Singelgracht, Hobbemastraat, Blue Boat, Herepoort). A huge flat grey roof plane over the Hobbemastraat block extends well past its walls; a dark roof hangs to the left of a house by the canal-side trees, over nothing; the curved Max Euweplein arcade building's roof is offset from its walls; a roof slab sits at the bottom edge over the canal.
- `roofs-offset-geldersekade.png`: Geldersekade / Oudezijds Kolk (Weepers' Tower label), a close pitched view. The row of gabled roofs sits one building row behind the street facades; the facades at the quay have flat tops with roofs floating behind them.
In both the rider stood at the Marineterrein (HUD "Nieuwe Vaart, Marineterrein, 0.00 km") with the camera detached in Free Ride, so these are not the rider's own detail block; which tier drew them is the first question.

## What is wanted

1. **Attribute before fixing**, and post the finding on #257. Reproduce the two poses (`?ride=free&engine=own`, detach the camera as `scripts/aerial-pan.mjs` does for a spot: `cam.detached = true`, anchor, zoom, rotation, `setCameraTilt`), screenshot, then isolate the tier and the change:
   - tiers: `?bakedCoarse=0` (runtime coarse shells instead of the baked SHEL cells, `engine/bakedCoarse.ts`), `?farShells=0`, `?chunkMerge=0&chunkLod2=0` (R4-C street chunks), the roof extras (`engine/cityExtras.ts` roofs, `roofTier.ts`, the ROOF stream's `roofPlanForFeature`), the detail tier (`threeBuildingsBrowser.ts`); note whether the camera-detached detail subject follows the camera or the rider;
   - changes: bundles of earlier shas served with `BUNDLES_DIR=<dir>` (build them from throwaway worktrees named `tmp-roofs-*` into a scratch dir, never into a served worktree): 37836ba75 (before R4-I), a043f6724 (before R4-A, baked coarse), and one from 2026-11-05; the shells were published 2026-11-07 (`public/data/extracts/amsterdam/world-v1/shells`), so a data-side cause is possible too (a shell baked from a different footprint set than the walls; the board's P1 "re-bake shells after every landmark or kit install").
   The deliverable of this step is one sentence: which mesh carries the offset roofs, since which commit or data publish, and the mechanism (a cell-origin vs absolute-metres mix like `bakedCoarse.ts install`'s `absolute` path, a roof plan placed in tile coordinates while walls are in cell coordinates, a stale shell, a lift applied to walls but not roofs, or 3DBAG roof planes wider than the OSM footprint).
2. **Fix it** in typed code with a test that pins the mechanism (a geometry test on the offending transform is better than a screenshot).
3. **Verify at the user's poses and the pinned ones.** Both shots before | after at 2× crops; `crisp-textures` at S1–S4 and the Da Costakade poses identical or explained; `swap-gate`, `swap-zfight`, `baked-fabric.spec.ts` unchanged; the aerial pan's frames and GL max not worse (one run each mode).
4. **Strips** to `blackmad/map-recall2-screenshots` `engine/2026-11-08-roofs-offset/`. **What's New text** for the visible fix (the integrator adds it), e.g. "Roofs sit back on their houses along the Geldersekade and the Singelgracht."

## Fences

Yours: the module the attribution names (`engine/bakedCoarse.ts`, `engine/cityExtras.ts`, `roofTier.ts`, `world/shellMesh.ts`, `scripts/world/shellBake.ts`, `threeBuildingsBrowser.ts`: the smallest change), tests. If the cause is a stale or wrongly baked shell set, re-bake into a staging dir (`npm run -s world:compile -- --shell --out=$PWD/<dir>`, 134 s) and report; the integrator publishes. Not yours: the published extracts, the shared integration files (`game.js`, `index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `budgets.json`, `covers.json`). Lanes R4-K (`farShells.ts` / `bakedCoarse.ts` release, port 4670) and R4-L (swap-zfight, port 4671) run at the same time: if your fix lands in `bakedCoarse.ts`, keep it to the install/transform lines and say so in the hand-back.

## Hand back here

Branch + SHA (pushed, merged with `origin/main`); the attribution sentence; the mechanism and the fix; before | after at both poses; the crisp, swap and pan numbers; strip paths; which bundles to rebuild (and whether shells need a republish); tests joined; What's New text; what is still open. Then stop; the integrator merges.

Rules: `docs/handoffs/LANE-RULES.md`. `/usr/bin/git` only, never `git stash`, never `pkill` (stop your server with `kill $(lsof -t -iTCP:4672 -sTCP:LISTEN)`), one Playwright run at a time via `/tmp/canal-pw.sh` (`PW_PORT=4672`), timing runs and the push under `CANAL_PW_EXCLUSIVE=1 /tmp/canal-pw.sh`. Wait on background commands in the foreground. Likeness at the user's poses is the acceptance bar. Budget: about 120 turns; hand back what is measured when it runs out.
