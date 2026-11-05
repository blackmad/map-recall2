# Engine look-and-robustness plan (2026-11-06) — for the Opus integrator

Issues: plan #222; lanes #223 (R1-A swap), #224 (R1-B crisp), #225 (R1-C aerial). Lane briefs: `docs/handoffs/lane-engine-{swap,crisp,aerial}-20261106.md`. User shots archived in map-recall2-screenshots `engine/2026-11-06-user-shots/` (s1–s4).

## Context

The user rode `https://rideamsterdam.nl/ride?ride=free&engine=own` (build 69d4c65,
2026-11-05, desktop, DPR 2) and sent four screenshots with four complaints, plus a
locked tab after panning around the whole city from the air:

| # | Shot | Complaint | Where |
|---|---|---|---|
| S1 | image 1 | detail pops onto distant buildings that are already there | Hoftuin / Weesperstraat, high pitch looking NE over Nieuwmarktbuurt |
| S2 | image 3 | windows and trim look fuzzy | Da Costakade / Jacob van Lennepkade looking N |
| S3 | image 4 | moiré on the regular window grid of the 1962 slab while the camera moves | Weesperstraat slab (card "BUILT 1962"), ~150 m |
| S4 | image 5 | railway lines are not crisp; banded grey/beige corridor | Zuidas rail corridor N of Beatrixpark, looking N from the air |
| S5 | — | tab "practically locked" after scrolling around the city | aerial pan, Free Ride |

Session screenshots are archived (done 2026-11-06) in `blackmad/map-recall2-screenshots` under
`engine/2026-11-06-user-shots/` as `s1-hoftuin-distance-popin.png`, `s2-da-costakade-fuzzy-windows.png`, `s3-weesperstraat-slab-moire.png`, `s4-zuidas-rails.png`; they are the acceptance
references.

The user also asked whether the week spent on the engine programme was misdirected
and whether an existing engine should have been used. Budget decision (user,
2026-11-06): **medium — three opus lanes now, two more after the user reviews
round one.** The landmark programme stays paused (memory: programme-paused-20261105).

Current main is `69d4c6593`; worktree `integrator-transvaal-20261031` tracks it (HEAD
there is already a few local commits ahead). E1–E6 are merged; E7 (#220, GC at cold
start) is running. The flip branch `lane/engine-flip-20261105` is held until the
user's 60 s ride on Mac + iPhone is green.

## Answer to "should we have used an existing engine?"

No, and do not switch now. Every symptom here is a standard real-time-rendering
choice that Unity/Unreal/Godot would give *defaults* for (HLOD, impostors, TAA,
texture import with mips and 16× anisotropy) but would not fix for free, and their
web exports cost 30–100 MB of download, worse iOS Safari memory, and a full port of
the content pipeline (world cells, kits, 300+ GLB builders, own ground, labels,
spoiler rules). CesiumJS/3D Tiles would solve far-tier streaming but replace the
look. three.js is the right substrate; what the programme skipped is **engine
discipline**: a baked far tier instead of runtime shells, a texture policy (size,
mips, anisotropy, per-tier), one cross-dissolve rule, and a quality HUD the user can
read. Where the ecosystem has a drop-in, use it instead of hand-rolling:
`postprocessing` (SMAA/TAA) only if MSAA proves insufficient, meshoptimizer (already
used for landmark lod1) for baked shells, KTX2 for atlases later.

## Diagnosis (from code on main; measured nothing yet)

Renderer facts: desktop own engine renders at native DPR with MSAA
(`engine/frameHost.ts:156`, `engine/ownWorldView.ts:262-266`); no post pass; façade
cells are 256 px per bay-storey in a mipmapped `DataArrayTexture`, anisotropy 16
desktop (`threeBuildingsBrowser.ts:295-306,424,637`). So resolution is not the owner
on the user's Mac — unless the governor stepped the ratio down (floor 0.75×,
`renderGovernor.ts:83-101`); `__canalPerf.tier` tells.

**S1 pop-in.** The own engine has no far tier: every resident building is a full
chunk. Coarse z14 shells (`threeBuildingFeatures.ts:251-280`) have full-height walls
with windows and a **flat lid** in one of four greys when there is no roof-facts
colour (`threeBuildingMesh.ts:166`). The detail chunk dissolves in over the solid
shell for 700 ms, then `endFade → refreshDetailOwnership`
(`threeBuildingsBrowser.ts:1557,1584-1594`) hides the shell **in one frame**: grey
lid → pitched terracotta roof + extras + shadows. The swap gate only looks within
120 m (`engine/swapProbe.ts:23-25`); its own note records 63 desktop / 135 iPhone
such swaps at 120–300 m per 60 s ride (`tests/perf/budgets.json:120`). That band is
exactly what S1 shows.

**S3 moiré.** During the 700 ms dissolve the detail walls are drawn **coplanar over
the solid shell walls** with a screen-locked dither (`look/cityLook.ts:504`): depth
fighting plus screen-door = moving stripes on any flat regular façade. A second
owner is sub-pixel window-frame geometry on kit/recipe houses with no distance
fallback (`canalhouseRecipes.ts:606-650`), but the 1962 slab is a streamed block, so
the swap is the first suspect. Verify by A/B `?swapFade=0` and `?chunkFade=0` at S3.

**S2 fuzz.** Windows are canvas-painted 256 px cells, bilinear-magnified at chase
range (a 4 m bay is ~300 device px), trilinear-blurred at mid range, flattened to the
cell's mean colour at 16–30 texels/px (`roofTier.ts:42-53,84-100`) and blended out
from 250 m by the depth fade (`look/depthFade.ts:118-121`). Also `cellTier` is set
once at material creation from the then pixel ratio (`threeBuildingsBrowser.ts:1664-1691`)
and never updated when the governor changes the ratio.

**S4 rails.** Rails are 0.14 m ridge meshes plus ±0.12 m stripes painted in a 256 px
/ 3.1 m ballast texture (`ownGround/railTracks.ts:124-146`); beyond 350 m (LOD 1)
the ridge rails are dropped and only the stripes remain, minified at a grazing angle
with ground-texture anisotropy **4** (`gameGround.ts:756-764`); sleepers are +16 luma
over ballast so mips average them to mush (#145). Each of 35 rail+subway ways in cell
`-2_-4` is its own 3.1 m bed with shoulders → the beige/grey banding. The far ring
(> 1.4–2 km) has no railway at all.

**S5 locked tab.** The ride heap is measured flat (~380 MB over 10 min, lane E2),
but **the aerial pan across the city is not a measured scenario.** From the air the
ground ring grows to 2 km (`gameGround.ts:299-307`), up to 12 coarse z14 tiles + 6–8
detail tiles stay resident, 72 landmark models (`landmarks/landmarkResidency.ts:44`),
every POI label in a horizon-deep view (S4 shows dozens), and GPU bytes are not gated
on desktop at all. Sentry has no canal-recall event in the last 24 h, so the
heartbeat has not yet seen an unclean end; the Chrome extension was not connected,
so the tab could not be inspected from here. The plan adds the scenario and a
user-readable perf HUD so this question is answerable next time.

## Round 1 — three opus lanes, one worktree and port each

Common rules for every lane brief (`LANE-RULES.md` applies): `/usr/bin/git`; link
`node_modules` into the worktree; nohup dev server, stop it by port PID; browser
runs only under `/tmp/canal-pw.sh` with a private `PW_PORT`; build to a scratch
`--outdir` and run through `BUNDLES_DIR` (the Vite reload trap); every change behind
a `?flag=0` off switch and byte-identical when off; acceptance is a before/after
strip at the user's spots next to the user's shot, desktop DPR 2 **and** the iPhone
profile; hand back a SHA, the strips, the numbers, and the TODO/HISTORY/What's New
text for the integrator. Model: opus for all three (design judgement); haiku only for
the screenshot archiving and budgets rows.

### Lane R1-A — the swap: cross-dissolve, shell roofs, 300 m gate (S1, S3)
Files: `src/canalRecall/threeBuildingsBrowser.ts` (fade/ownership),
`threeBuildingFeatures.ts`, `threeBuildingMesh.ts` (coarse mode), `look/cityLook.ts`
(dither), `engine/swapProbe.ts`, `tests/e2e/swap-gate.spec.ts`, `tests/perf/budgets.json`.
1. **Complementary dissolve.** Shell and detail use the same per-pixel hash; the
   shell discards where the detail draws (`fract(hash) < cityFade` on one, `>=` on
   the other), so no pixel is drawn twice during the fade — kills the coplanar
   z-fight and halves fade overdraw. Shell is hidden at fade end as today.
   Flag `?swapComplement=0`.
2. **Shell roof silhouette and colour.** Coarse mode stops walls at the eaves and
   adds the planned roof from the ROOF stream (already in the cells) as a low-poly
   gable/hip/flat in the measured or mapped `roofColour` (fallback: the detail
   path's `roofHexFor`, not `FLAT_ROOF_GREYS`). Windows stop at the eaves. Budget:
   ≤ +25 % triangles per coarse chunk (measure; `trianglesIpad` stays ≤ 700k).
   Then the swap changes only extras + shading, and distant roofs stop being grey.
   Flag `?shellRoofs=0`.
3. **Gate reach.** `swapProbe` radius 120 → 300 m; new budget row
   `popInSwapsMid` (120–300 m, ≥ 400 px²); target 0 desktop and iPhone on the
   pinned Koninginneweg → Van Gogh ride; also run it on a Free Ride seeded at the
   S1 pose. If 0 is not reachable, report the residual by cause (fade length vs
   prefetch distance vs visible delta) and recommend the knob.
4. Pins: S1 and S3 frozen frames (`AB_CAMERA=fixed` style, add spots to
   `scripts/world/abSpots.ts`): consecutive-frame ΔE>20 area on the slab's façade
   during a forced fade = 0 px (new spec `swap-zfight.spec.ts`), `look-consistency`
   and `three-buildings-ab` strips unchanged with flags off.

### Lane R1-B — crisp textures and rails (S2, S4)
Files: `threeBuildingsBrowser.ts` (cell size, `cellTier`), `facadeCells.ts`,
`roofTier.ts`, `look/depthFade.ts`, `ownGround/gameGround.ts` (texture params),
`ownGround/railTracks.ts`, `ownGround/groundCell.ts`, `scripts/own-ground/rail-shots.mjs`.
1. **Texture policy, one place.** A `texturePolicy.ts` (typed, tested) that every
   texture creation calls: desktop high tier = 512 px façade cells, anisotropy 16 on
   **all** ground/façade/roof textures, `LinearMipmapLinear`; mid/low/touch keep
   today's 256/128 and 4. Measure the cost: +texture MB (budget row
   `desktopTextureMB`), GPU ms at Dam/Westerkerk (`gpu-load-ipad.mjs` style A/B);
   the earlier A/B said anisotropy 1–8 is within ±1 ms. `textureLod(…, 8.0)` must
   become `log2(size)` so the mean-colour fallback still hits the 1×1 level.
2. **`cellTier` follows the pixel ratio.** Update the uniform when the governor or
   tier changes it (one setter; test).
3. **Window sharpness measurement.** A `scripts/look/sharpness.mts` (Laplacian
   variance / edge energy inside the façade band of a frozen frame, like
   `busyness.mts`), run at S2 before/after. Report, do not gate yet.
4. **Rails.** (a) Rail stripes become a separate high-contrast layer that survives
   mips (stripe tone ≥ 60 luma below ballast; sleepers fade with distance instead
   of averaging), (b) ridge rails get a screen-space minimum width (≥ 1.25 px, like
   the overview lines) instead of vanishing at LOD 1, (c) adjacent beds < 5 m
   apart merge into one yard bed (the open item from `lane-rail-look-20261030.md`),
   (d) the far ring draws rail corridors as a 2-tone band so corridors do not end
   at 2 km. Strips at the Zuidas spot + the three rail-look spots, orthophoto beside
   (`rail-strip.ts`); `?rails=0` and the Dijksgracht ≥ 6 tracks regression kept;
   `RAIL_VERSION` bump if the extract changes.

### Lane R1-C — the aerial pan scenario, memory gates, perf HUD (S5)
Files: new `scripts/aerial-pan.mjs`, `src/canalRecall/engine/glCounters.ts`,
`engine/ownWorldView.ts` (HUD), `tests/perf/budgets.json`, `landmarks/landmarkResidency.ts`,
`ownGround/gameGround.ts` ring growth, label policy.
1. **Scenario.** A scripted 3-minute Free Ride aerial pan (pitch and altitude of S1
   and S4, sweeping Centrum → Zuid → West → Oost at the user's scroll speed),
   recording every 5 s: JS heap (forced GC), `renderer.info.memory` geometries and
   textures, cumulative `texImage`/`bufferData` bytes, resident counts (world cells,
   chunks by kind, landmark models, labels placed, trees), worker count, frame p99,
   frames > 100/250 ms. Desktop DPR 2 and iPhone profile.
2. **Gates (new budget rows):** `aerialHeapGrowthPct` ≤ 10 after minute 1,
   `aerialGeometriesMax` / `aerialTexturesMax` bounded (no monotonic growth over
   the pan), `aerialP99Ms` ≤ 33 desktop, 0 frames > 250 ms. Fix the owners the run
   names, in order (likely: ring growth to 2 km never shrinking back, landmark
   models at the 72 cap re-fetching on every sweep, label index rebuilds, chunk
   fade clones), each behind a flag.
3. **Perf HUD.** `?perfHud=1` (and a toggle under Comfort & detail labelled "Show
   performance") draws a small mono line: tier, pixel ratio, heap MB, GPU MB
   (geometries+textures estimate), resident cells/chunks/models, fps p99. The user
   can then report numbers when a tab locks. Keep it off by default and out of
   screenshots unless asked.
4. **Heartbeat check.** Confirm in Sentry that a ride on 69d4c65 produced a
   heartbeat at all (none in the last 24 h); if the deployed build is not sending,
   that is a P0 for this lane.

## Round 2 — after the user reviews round one's strips (two opus lanes)

### Lane R2-A — resolution-independent windows
Replace the painted window rectangles with analytic SDF cells in the façade shader
(window/frame/sill/head as rectangles with `fwidth` anti-aliasing, the painted layer
kept for brick/stucco/texture), keep the mean-colour fallback below ~2 px per cell,
`?windowSdf=0` byte-identical. Measure GPU ms (the façade shader is the fill owner;
the earlier A/B found no cheap win except resolution, so this must be ≤ +1 ms at
Dam/Westerkerk) and sharpness at S2. Only if R1-B's 512 px cells still read soft.

### Lane R2-B — baked far tier (the pre-generation the user asked about)
A `SHELL` stream in `world:compile` (`scripts/world/compile.ts`, the same pure
`buildFeatureChunk` already runs in Node): per 1 km cell, one merged low-poly mesh
with roof silhouettes and vertex colours (wall tint + roof colour), meshoptimizer-
simplified, ≤ 1 draw per cell, loaded for every cell inside the fetch horizon and out
to the far ring so the city no longer ends at 12 z14 tiles from the air. Replaces
runtime coarse chunk builds (removes a stall owner and the `uploadsOver1MBAfterWarmup`
red). Gate: strips at S1 from the air, draws ≤ 400 at 60° pitch, city MB ≤ 10 + the
SHELL bytes reported.

## Integrator (Opus session, `integrator-opus` worktree)

- Shots archived and issues #223–#225 opened (2026-11-06). Spawn the lanes with
  `scripts/worktrees/new.sh` on the worktree/branch/port each issue names.
- Merge order: R1-A, then R1-B, then R1-C (A and B both touch
  `threeBuildingsBrowser.ts`; brief B to keep to texture params + `cellTier`).
- After each merge: rebuild bundles, `npm run lint`, `test:engine`, `test:own-ground`,
  `test:world-format`, `test:canal-game-structure`, `check:canal`; one browser smoke
  (`test:e2e:engine-own` + the lane's spec) under the lock; push only after the gate
  passes; `triage.sh --remove-merged` after each push; What's New note per visible
  change with before/after links in the screenshots repo; dev-log comment on #68;
  TODO/HISTORY in the same commit.
- Do not touch the flip branch except to re-rebase; the flip gate stays the user's
  60 s ride on Mac + iPhone with the round-one strips accepted.
- Questions for the user go to a `needs-david` issue, not chat.

## Verification (end to end)

1. Each lane: its named spec green on both projects, strips at the user's spots with
   the user's shot beside them, the flag-off run pixel-identical to main.
2. Integrator, after round one: `?engine=own` Free Ride on `rideamsterdam.nl` at the
   four spots on the user's Mac and iPhone — S1 no roof/lid pop within 300 m, S3 no
   moving stripes during a swap, S2 sharpness number up and windows legible at the
   chase distance, S4 rails read as two continuous dark lines; then the 3-minute
   aerial pan with `?perfHud=1` reporting flat heap and bounded GPU memory.
3. Budgets rows recorded before/after in `budgets.json`; the table posted on #68.

## What the user can do right now about the locked tab

Chrome task manager (Shift+Esc) shows the tab's memory footprint and GPU memory; if
the tab still responds, `__canalPerf` in the DevTools console gives tier, pixel ratio
and GL counters. If the tab dies, the next load of the site reports it to Sentry via
the heartbeat; nothing has arrived there in the last 24 h.
