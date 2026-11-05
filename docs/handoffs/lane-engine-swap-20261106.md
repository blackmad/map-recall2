# Lane R1-A: the shell→detail swap — complementary dissolve, shell roofs, 300 m gate (2026-11-06)

Worktree `/Users/blackmad/Code/map-recall2-worktrees/engine-swap-20261106`, branch `lane/engine-swap-20261106`, port 4640. Issue #223. Plan #222, `docs/handoffs/engine-look-plan-20261106.md`. Model: opus. Rules: `docs/handoffs/LANE-RULES.md` and the engine-lane block at the end of this brief.

## What the user sees

Shots `s1-hoftuin-distance-popin.png` and `s3-weesperstraat-slab-moire.png` in map-recall2-screenshots `engine/2026-11-06-user-shots/` (`?ride=free&engine=own`, build 69d4c65, Mac, DPR 2). S1: from the Hoftuin, high pitch looking NE, detail pops onto buildings that are already there, two to five blocks out. S3: the 1962 slab on Weesperstraat (building card "BUILT 1962"), about 150 m away, shows moving stripes over its window grid while the camera moves.

## What the code does (main at 69d4c65)

- There is no far tier. Every resident building is a full chunk. Coarse z14 shells (`src/canalRecall/threeBuildingFeatures.ts:251-280`, `'coarse'` → `'walls'` mode) have full-height windowed walls and a **flat lid**; the lid colour is the roof-facts colour when present, else `roofColour`, else one of four greys (`threeBuildingMesh.ts:166`, `FLAT_ROOF_GREYS`). Roofs in the detail chunk come from the planned roof (`roofPlanned && !coarse`, `:173`) and are pantile/slate in the roof tone.
- The detail `near:` chunk dissolves in over the **solid** shell for `CHUNK_FADE_MS` 700 ms (`threeBuildingsBrowser.ts:237`, `fadeClone` :242, `fadeIn` :1491, `tickFades` :1529) with the screen-door discard in `look/cityLook.ts:504` (`fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= cityFade`). At `endFade` → `refreshDetailOwnership` (`:1557`, `:1584-1594`) the shell's buildings are hidden by their `hidden` attribute **in one frame**. That frame is the pop: grey lid → pitched coloured roof, extras chunk, shadows start.
- During the 700 ms the detail walls are coplanar with the shell walls and both are depth-tested: depth fighting under a screen-locked dither. That is the first suspect for S3. Second suspect: sub-pixel window-frame geometry on kit/recipe houses (`canalhouseRecipes.ts:606-650`) with no distance fallback; the slab is a streamed block, so check the swap first.
- The swap gate (`engine/swapProbe.ts:23-25`, `tests/e2e/swap-gate.spec.ts`, budget row `popInSwapsNear`) only counts swaps ≥ 400 px² within 120 m. Its own note (`tests/perf/budgets.json:120`) records 63 desktop / 135 iPhone shell→detail swaps at 120–300 m, "faded but not prefetched". That band is S1.

## Do, in this order, each behind a flag and measured

1. **Reproduce first.** Add the S1 and S3 poses as fixed spots (`scripts/world/abSpots.ts`; derive the rider positions from the POIs in the shots: Wind phone Hoftuin / Namenmonument for S1, the Weesperstraat slab for S3). Capture 3 s at S3 with `?swapFade=0`, `?chunkFade=0` and default while a swap is forced (evict the detail chunk and let it re-arrive); diff consecutive frames on the slab's façade (ΔE>20 area). Post the numbers on #223 before fixing. If the stripes are there with fades off, the owner is geometry, not the dissolve: say so and fix that instead (distance fallback for sub-pixel frames: drop grille/mullion boxes below ~1.5 px, keep the glass).
2. **Complementary dissolve** (`?swapComplement=0`): shell and detail use the same per-pixel hash; the shell discards where `fract(hash) < cityFade` and the detail where `>= cityFade`, so no pixel is drawn by both during the fade. The shell needs the same `cityFade` uniform as the detail that replaces it (per building set, from `refreshDetailOwnership`'s mapping); hide the shell at fade end as today. No in-frame program link (one shared program variant, precompiled via `SharedFrame.compileAsync`).
3. **Shell roof silhouette and colour** (`?shellRoofs=0`): in coarse mode stop the walls at the eaves (`wallTopHeightM`) and add the planned roof from the cell's ROOF stream as a low-poly gable/hip/flat in the measured or mapped roof colour, falling back to the detail path's `roofHexFor`, never `FLAT_ROOF_GREYS`. Windows stop at the eaves. Keep garden sheds dropped and extras off. Budget: ≤ +25 % triangles per coarse chunk, `trianglesIpad` ≤ 700k, draws unchanged. After this the swap changes only extras and shading.
4. **Gate reach**: `swapProbe` radius 120 → 300 m; new budget row `popInSwapsMid` (120–300 m, ≥ 400 px²) beside `popInSwapsNear`. Target 0 on the pinned Koninginneweg → Van Gogh ride, desktop and iPhone profile, and on a Free Ride seeded at the S1 pose. If 0 is not reachable, report the residual by cause (fade length vs prefetch distance vs visible delta per swap) and recommend the knob; do not silently raise the target.
5. **Pins**: new `tests/e2e/swap-zfight.spec.ts` (S3, forced fade, consecutive-frame ΔE>20 area on the façade = 0 px); `look-consistency` and `three-buildings-ab` strips unchanged with both flags off (pixel-identical to main).

## Keep

`?swapFade`, `?chunkFade`, `?ringFollow`, `?routeAhead`, `?detailLinger` behaviour; `world-v1-bytes.spec.ts` (Free Ride ≤ 20 cells / 1.5 MB); `popInSwapsNear` 0; no in-frame shader links after warm-up (`inFrameShaderLinksAfterWarmup` 0).

## Hand back on #223

Branch + SHA (pushed); strips at S1 and S3 beside the user's shots, desktop DPR 2 and iPhone profile, flags on/off; the swap table before/after (near and mid); triangle and draw deltas; which bundles to rebuild (`build:canal-engine`, three-buildings worker, whatever `package.json` names) and which test scripts the new spec joins; What's New text for the integrator; what is still open.

## Engine-lane rules (2026-11-05, unchanged)

- Work only in your worktree on your branch with `/usr/bin/git`. Never `git stash`, never `pkill`; stop your dev server by the PID on your port. Never `npm install` in the shared checkout; link `node_modules`.
- Do not edit `game.js`, `index.html`, `package.json`, lockfiles, generated bundles, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `budgets.json`: hand the integrator the text and numbers instead. New tests live in `src/` next to the module.
- Build to a scratch `--outdir` and run through `BUNDLES_DIR`; the Vite dev server full-reloads on any worktree change and silently hangs a harness run.
- Browser runs through the lock: `PW_PORT=4640 /tmp/canal-pw.sh perl -e 'alarm 2400; exec @ARGV' -- npx playwright test <spec> --project=desktop --workers=1 --trace off --reporter=line`; timing runs with `CANAL_PW_EXCLUSIVE=1`.
- Acceptance is a measured ride or a pinned spec beside the user's shot, not a strip alone. Every fix has a `?x=0` flag and a named regression location. Then stop; the integrator merges.
