# Lane R3-D: the S3 slab wall — anisotropy-aware facade tier (one shader change, measured at the user's pose)

Worktree `/Users/blackmad/Code/map-recall2-worktrees/engine-s3-rho-20261106`, branch `lane/engine-s3-rho-20261106` (cut from `lane/engine-sharp-20261106` at 50760a0cf, R3-B's hand-back), port 4648. Plan #222 round 3 (`docs/handoffs/engine-look-plan-20261106.md`). Model: opus. Rules: `docs/handoffs/LANE-RULES.md` and the engine-lane block at the end of this brief. This lane is small on purpose: one change in one shader, measured at one pose, handed back tonight. The user demos the engine tomorrow morning (2026-11-07); do not start anything that cannot be measured and handed back in a few hours.

## What the user sees

`s3-weesperstraat-slab-moire.png` in map-recall2-screenshots `engine/2026-11-06-user-shots/`: moiré on the 1962 slab on Weesperstraat while the camera moves, and its long street wall drawn blank. Build 69d4c65, Mac, DPR 2, `?ride=free&engine=own`.

## What round 3 established (read these two comments first)

- #230 R3-A step 2 and hand-back: at the user's pose (`s3-slab-user`), **92 % of the moving pixels are the facade texture on the slab's long street (west) wall along Weesperstraat, seen almost edge-on**. Switching the facade texture off (`flatColour=1`) drops aliasPx 47,085 → 3,626. Thin geometry is 8 %. The thin fade (−2.8 %) and SMAA (−33 %) cannot reach the gate there. The blank wall is the facade tier flattening to the mean colour (`roofTier.ts cellTierSample`, `far = smoothstep(cellTier.x, cellTier.y, rho)` with `rho = max(|dFdx|, |dFdy|) × size`, the **major** axis of the footprint). Strips: `engine/2026-11-06-r3/r3a-s3-user-baseline-dpr2.jpg`, `r3a-s3-user-owner-diagnosis.jpg` (rho at DPR 2 and DPR 1).
- #231 R3-A's note "From R3-A (#230)": the lever. With anisotropic filtering the hardware's effective footprint is about `max(minor, major / anisotropy)`; flattening on the major axis alone blanks the wall where the filter could still draw it (DPR 1: magenta, blank), and just under the threshold the grid is drawn where `major / minor` exceeds the anisotropy cap and the filter undersamples along the wall (DPR 2: orange, aliasing). Both faces of the same rule.
- #231 R3-B hand-back: the band-limited analytic windows (`?windowSdf=1`, `|wsdf2`, `cellLodBias −0.6` while on) reduce aliasPx at `s3-slab-user` only 46,934 → 40,878 (−13 %). The SDF fade reads `cellFarTier`/`cellFar` from `CELL_TIER_PROBE`, so a better `far` helps the SDF too. `WINDOW_SDF_DESKTOP_DEFAULT` is still false; the flip is decided tonight by a separate GPU re-measure, not by you.

## The pose

`s3-slab-user` lives on R3-A's branch (`scripts/world/abSpots.ts` on `lane/engine-trim-aa-20261106`, 78651410f) and is being merged to main now. Until `origin/main` has it, pass it inline the way R3-B did (`ZFIGHT_SPOT_JSON`), exactly:

```
{"name":"s3-slab-user","rider":[4.9058,52.3638],"face":[4.9063,52.3651],"eye":[4.906907,52.362617,39],"camera":[4.906301,52.363845],"zoom":18.28,"bearing":-16.8,"pitch":74.7,"viewport":[1448,657],"crop":{"x":193,"y":0,"width":1185,"height":501},"minMaskShare":0.015,"pand":"0363100012185595"}
```

R3-B's `swap-zfight.spec.ts` on your branch takes `ZFIGHT_SPOT_JSON`, `ZFIGHT_ALIAS_ONLY=1`, `ZFIGHT_VARIANTS` (in-page aliasPx per uniform set), `ZFIGHT_SS=2`, `ZFIGHT_DPR=2`. Check whether it honours `eye`/`viewport` from the JSON (R3-A added `eye` handling on its own branch; if your copy ignores `eye`, cherry-pick R3-A's 451a5a695 or port the few lines, and say so). When the integrator pushes main with both lanes merged (tonight), `git merge origin/main` into your branch before hand-back so the integrator's merge is trivial.

## Do

1. **Baseline at the pose, your branch as is**: aliasPx at `s3-slab-user` DPR 2 with `ZFIGHT_SS=2`, variants `painted` (windowSdfMix 0) and `sdf` (windowSdfMix 1, band on, bias −0.6); the `?cellDebug=rho` histogram at DPR 2 and DPR 1 (share of magenta/orange/green inside the slab mask, `cellDebugHistogram` in `look/windowSdf.ts`). Post it on the lane issue (#233).
2. **Anisotropy-aware footprint** in `FACADE_TIER_GLSL` (`roofTier.ts`), define `CELL_TIER_ANISO` on by default, `?cellTierAniso=0` restores the major-axis rule byte-for-byte. Inputs: `major = max(len(dFdx p), len(dFdy p)) × size`, `minor = min(…) × size`, and a new uniform `cellAniso` = the anisotropy actually set on the cells texture (from `lookTexturesOf` / `texturePolicy`, 16 desktop high, 4 coarse or low GPUs; keep the same number the texture got, not a constant). The rule has two parts and both must be measured:
   - **Flatten on the effective footprint**, `rhoEff = max(minor, major / cellAniso)`, in place of `rho` in the `smoothstep(cellTier.x, cellTier.y, …)`. This is what stops the blank wall where the filter can still draw the grid.
   - **Fade the window contrast where the filter undersamples**: `under = major / (cellAniso × max(minor, 1.0))` (texels; `max(minor, 1)` because minification along the minor axis stops at level 0). Where `under` passes 1 the grid along the wall is beating against the pixel grid; blend toward the mean-colour sample as `smoothstep(1.0, 2.0, under)` (sweep the band: [1,2], [0.75,1.5], [1.25,2.5]). Reuse the existing `far` mix so the SDF's `cellFarTier` sees it.
   Record the probe values (`cellRho`, plus new `cellRhoEff`, `cellUnder` under `CELL_TIER_PROBE`) so `?cellDebug=rho` can paint the new classes; add `?cellDebug=under` if cheap.
3. **Measure** the same two variants after, at `s3-slab-user` (gate) and `s3-slab`, `s1-hoftuin`, `westerkerk`, `nassaukade` (no regression): aliasPx DPR 2 `ZFIGHT_SS=2`; the rho/under histograms; `crisp-textures.spec` lapVar at `da-costakade-user`, `da-costakade-chase`, `da-costakade-near` (the S2 numbers must not move by more than ±3 %: this rule must not touch the quay houses, which are near-perpendicular); GPU ms at westerkerk and dam (`crisp-textures` timer, 5 runs, alternate order; `CANAL_PW_EXCLUSIVE=1`). iPhone profile: aliasPx and the histogram at `s3-slab-user` with `cellAniso` 4 (the phone's policy), so the rule is seen to behave at low anisotropy, not only at 16.
4. **Gate**: aliasPx at `s3-slab-user` DPR 2 ≤ 50 % of the painted baseline from step 1 (≈ 23,500 from 47 k), with `painted`, and no worse with `sdf`; the street wall in the after frame shows the window grid where it is not aliasing (not blank at DPR 1 or DPR 2: compare the 4× crops); S2 lapVar within ±3 %; GPU ≤ +0.3 ms; `look-consistency` 0 px with `?cellTierAniso=0`. If the gate is not met, hand back the best band with the table and say what remains and why; do not add a second mechanism.
5. **Strips** in map-recall2-screenshots `engine/2026-11-06-r3/`: `r3d-s3-user-dpr2.jpg` = user shot | before (painted) | after (painted) | after (sdf) at `s3-slab-user`, with the still-pan mid frame and a 4× crop of the street wall under each; `r3d-s3-user-dpr1.jpg` the same at DPR 1 (the blank wall); `r3d-rho-classes.jpg` the rho/under debug views before and after. Commit them there (`/usr/bin/git`, that repo, push).
6. **Tests**: a CPU twin of the two formulas in `roofTier.test.ts` (or next to the existing tier tests): a grazing wall (major 24, minor 0.5, aniso 16) is not flattened by `rhoEff` (1.5) but is faded by `under` (3.0 → 1); a perpendicular wall (major 6, minor 5) is untouched by both; aniso 4 flattens where 16 does not. Before hand-back: `npm run lint`, `npm run test:look`, `npm run test:engine`, and under the lock `PW_PORT=4648 /tmp/canal-pw.sh npx playwright test building-look --project=desktop --workers=1 --trace off --reporter=line` (the integrator found test 2 of that spec hanging after the round-3 injections; yours must pass or you report exactly how it fails).

## Keep

Everything else on the branch as handed back by R3-B (do not touch `windowSdf.ts` defaults, `cellMips`, `cellLodBias`); `threeBuildingMesh.ts`, `facadeOrnaments.ts`, `facadeExtras.ts`, `toonLook.ts`, `ownGround/*` untouched; `HIGH_CELL_PX` 256; `FACADE_TIER_FROM/TO_TEXELS` unchanged (the thresholds are not the lever, the footprint is); the MapLibre engine untouched; no new textures, no new passes.

## Hand back on #233

Branch + SHA (pushed, merged with `origin/main` if the integrator's push has landed); the before/after table (aliasPx per spot and variant, rho/under histograms, S2 lapVar, GPU medians, iPhone profile at the pose); the band sweep; the strips' paths; which bundles to rebuild (the #228 list: three-buildings + worker, three, signature-landmarks, signature-placement, building-types, tile-buildings, building-gallery, house-playground, landmark-gallery, ordinary-buildings-gallery, engine); What's New text ("Window grids on buildings seen edge-on no longer shimmer or go blank"); what is still open. Then stop; the integrator merges after R3-A.

## Engine-lane rules (2026-11-05, unchanged)

- Work only in your worktree on your branch with `/usr/bin/git`. Never `git stash`, never `pkill`; stop your dev server by the PID on your port. Never `npm install` in the shared checkout; link `node_modules` (already linked).
- Do not edit `game.js`, `index.html`, `package.json`, lockfiles, generated bundles, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `budgets.json`: hand the integrator the text and numbers instead. New tests live in `src/` next to the module.
- Build to a scratch `--outdir` and run through `BUNDLES_DIR`; the Vite dev server full-reloads on any worktree change and silently hangs a harness run.
- Browser runs through the lock: `PW_PORT=4648 /tmp/canal-pw.sh perl -e 'alarm 2400; exec @ARGV' -- npx playwright test <spec> --project=desktop --workers=1 --trace off --reporter=line`; timing runs with `CANAL_PW_EXCLUSIVE=1`.
- Acceptance is a measured ride or a pinned spec beside the user's shot, not a strip alone. Every fix has a `?x=0` flag and a named regression location. Then stop; the integrator merges.
