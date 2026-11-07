# Lane R4-D: the S3 slab residual, a footprint prefilter of the facade cell sample, then a temporal probe

Worktree `/Users/blackmad/Code/map-recall2-worktrees/engine-s3-taps-20261107`, branch `lane/engine-s3-taps-20261107` from `main` (d73545bb3), port 4662. Issue #246. Plan #222. Model: opus. Rules: `docs/handoffs/LANE-RULES.md`.

Engine round 4. The user's word today was "do moire"; four lanes (R3-A #230, R3-B #231, R3-D #233, R3-E #240) found the owner and took the slab's alias down, but the gate is not met. Plan #222.

## Where it stands (desktop DPR 2, pose `s3-slab-user` in `scripts/world/abSpots.ts`, `swap-zfight.spec.ts` with `ZFIGHT_SS=2 ZFIGHT_ALIAS_ONLY=1 ZFIGHT_VARIANTS`, aliasPx = pixels that flip between 0.35 px pan steps where a 2× supersampled reference does not)

| state | sdf (desktop default since 2026-11-07) | painted (touch) |
|---|--:|--:|
| R3-E baseline | 39,500 | ~47,000 |
| aniso 4 (shipped, `HIGH_FACADE_ANISOTROPY`) | **30,003** | ~45,000 |
| gate | ≤ 22,822 | ≤ 23,500 |

Established: the slab's long street wall is plain minification at 16–32 texels per device pixel on both axes (footprint under 4:1), so the sampler reads mip 4–5 of the 256 px cell where the window pitch is near the texel pitch; GL's box chain keeps ~71 % of that contrast per level. Sharper mip chains made it worse (R3-B), a roll-off chain cannot reach it without blurring S2 (R3-E), the anisotropy rule made it worse (R3-D). The window SDF already filters its edges by `fwidth` (`look/windowSdf.ts` footprint / tent knobs, `?windowSdfTent=1`); what still aliases with sdf on is the cell texture under the windows and the glazing bars at near-Nyquist pitch. R3-E's hand-back names the two levers left, both outside its fence: a shader prefilter of the sample by the pixel footprint, or temporal accumulation.

## Do, each behind a flag, byte-identical off

1. **Baseline on your branch**: aliasPx at `s3-slab-user` for `sdf` and `painted`; `crisp-textures.spec` lapVar / edge / acutance at `da-costakade-user`, `da-costakade-chase`, `da-costakade-near` (`CRISP=1 CRISP_DPR=2 CRISP_MIX='painted=0;sdf=1'`); GPU frame time at the pose (`?perfHud=1` or the heap-ride `--gl` read). Post on this issue.
2. **Footprint prefilter in `roofTier.ts cellTierSample`** (`?cellTaps=0` restores, `CELL_TAPS_DEFAULT` off until the gate holds): where rho (texels per pixel, already computed for the tier) exceeds a threshold (sweep 8 / 12 / 16), take 2 × 2 or 4 taps of the facade cell sample spread over the pixel footprint (`dFdx` / `dFdy` of the cell UV, tent weights) and average them before the tier mix; the same taps feed the window SDF's body colour so the glazing bars are filtered with the wall. Below the threshold one tap, as today. Measure the cost per tap count at the pose and at S2 (the quay walls must sit below the threshold: lapVar within −1 %).
3. **Tier interaction**: with taps on, re-measure the tier band [32,60] vs [24,45] (`cellTier` is a live uniform; set it as `ZFIGHT_VARIANTS` sets `windowSdfMix`). Report, do not change the constant.
4. **Temporal probe, only if step 2 misses the gate**: jittered sub-pixel camera offset per frame with an exponential history blend on the facade pass only (`?facadeTaa=1`, history clamp by neighbourhood min/max, reprojection from the previous view-projection; no depth buffer read if the camera is static enough, but a pan must not smear: measure ghosting as the ΔE > 20 count between the TAA frame and a converged still). Report cost, aliasPx and ghosting; it ships only if ghosting is 0 at the pan speed of `swap-zfight` and the cost is ≤ 1.5 ms desktop.
5. **Measure after**: aliasPx at `s3-slab-user` (gate), `s3-slab`, `s1-hoftuin`, `westerkerk`, `nassaukade` (no regression), both variants; S2 lapVar at the three Da Costakade spots (≥ −3 %); iPhone profile at `s3-slab-user` and `da-costakade-user` (touch is painted, so step 2 is its only lever); GPU ms at the pose; `look-consistency` 0 px with the flags off.
6. **Gate**: aliasPx at `s3-slab-user` DPR 2 ≤ 22,822 with sdf and ≤ 23,500 with painted; the mid-pan 4× crop shows a grid or a calm tone, not shimmer; S2 lapVar ≥ −3 %; desktop cost ≤ 1.0 ms for step 2 alone. If the gate is not met, hand back the best setting with the table.
7. **Strips** to `blackmad/map-recall2-screenshots` `engine/2026-11-07-r4d/`: `r4d-s3-user-dpr2.jpg` = user shot | main | taps | taps + best band (and TAA if built), mid-pan frame, 4× crop of the street wall under each; `r4d-s2-user-dpr2.jpg` = main | taps at `da-costakade-user` with a 4× bay crop.
8. **Tests**: `roofTier.test.ts` (the tap offsets and weights as a pure function, threshold behaviour), `npm run lint`, `npm run test:look`, `npm run test:engine`, `npm run test:roofs`; under the lock `building-look crisp-textures swap-zfight`.

## Fences

Yours: `roofTier.ts` (the sample function and its GLSL), `rendererShared/litFacadeMaterial.ts` for the new uniforms, `look/windowSdf.ts` only where the body colour sample is taken, a new `rendererShared/facadeTaa.ts` if step 4 runs, tests beside them. Not yours: `look/cellMips.ts`, `look/texturePolicy.ts` (aniso 4 stays), `FACADE_TIER_*` / `HIGH_CELL_PX`, `windowSdf` defaults, `threeBuildingMesh.ts`, `facadeOrnaments.ts`, `labelLayer.ts`, `engine/bakedCoarse.ts`, `signature-landmarks-source.js` and `streetChunks/` (R4-C #245 is in them now), and the shared integration files (`game.js`, `index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `budgets.json`).

## Hand back here

Branch + SHA (pushed, merged with `origin/main`); the before/after table (aliasPx per spot and variant, S2 lapVar, iPhone profile, GPU ms per setting); the threshold and tap sweep; the band A/B; the TAA probe's numbers if run; the strips' paths; which bundles to rebuild (the #228 list: three-buildings + worker, three, signature-landmarks, signature-placement, building-types, tile-buildings, own-ground-game, engine, the galleries); the tests and the scripts they join; What's New text; what is still open. Then stop; the integrator merges.

Rules: `docs/handoffs/LANE-RULES.md`. `/usr/bin/git` only, never `git stash`, never `pkill` (stop your server with `kill $(lsof -t -iTCP:4662 -sTCP:LISTEN)`), one Playwright run at a time via `/tmp/canal-pw.sh` (`PW_PORT=4662`), timing runs and the push under `CANAL_PW_EXCLUSIVE=1 /tmp/canal-pw.sh`. Build to a scratch dir and serve via `BUNDLES_DIR`. Likeness and measured results are the acceptance bar, not gates passing.

