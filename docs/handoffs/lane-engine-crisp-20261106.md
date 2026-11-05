# Lane R1-B: crisp textures and rails — one texture policy, cellTier follows DPR, mip-safe rail stripes (2026-11-06)

Worktree `/Users/blackmad/Code/map-recall2-worktrees/engine-crisp-20261106`, branch `lane/engine-crisp-20261106`, port 4641. Issue #224. Plan #222, `docs/handoffs/engine-look-plan-20261106.md`. Model: opus. Rules: `docs/handoffs/LANE-RULES.md` and the engine-lane block at the end of `lane-engine-swap-20261106.md` (same rules, port 4641).

Scope fence: this lane and R1-A (#223) both touch `threeBuildingsBrowser.ts`. Keep to texture creation parameters and the `cellTier` setter there; do not touch fades or ownership.

## What the user sees

Shots `s2-da-costakade-fuzzy-windows.png` and `s4-zuidas-rails.png` in map-recall2-screenshots `engine/2026-11-06-user-shots/` (`?ride=free&engine=own`, build 69d4c65, Mac, DPR 2). S2: Da Costakade / Jacob van Lennepkade looking N, windows and trim read soft at the chase distance. S4: the Zuidas rail corridor N of Beatrixpark from the air, rails are faint non-crisp lines on a banded grey/beige corridor.

## What the code does (main at 69d4c65)

- Desktop renders at native DPR with MSAA (`engine/frameHost.ts:156`, `engine/ownWorldView.ts:262-266`); the governor can step the ratio down to a 0.75× floor (`renderGovernor.ts:83-101`); `__canalPerf.tier` says which tier the probe chose. Check the user's Mac is `high` with `?tier=` unset before concluding anything.
- Façade windows are canvas-painted 256 px cells, one per bay-storey (`facadeCells.ts`, `CELL_PX`), in a mipmapped `DataArrayTexture` with anisotropy 16 desktop / 4 touch and 128 px on touch (`threeBuildingsBrowser.ts:295-306,424,637,640`). At the chase distance a 4 m bay covers ~300 device px, so the cells are magnified; at mid range they flatten to the cell's mean colour at 16–30 texels/px × pixel ratio (`roofTier.ts:42-53,84-100`, `textureLod(cells, p, 8.0)`), and the depth fade blends detail out from 250 m (`look/depthFade.ts:118-121`).
- `cellTier` is set once at material creation from `this.pixelRatio()` (`threeBuildingsBrowser.ts:1664-1691`) and nothing updates it when the governor or tier changes the ratio.
- Ground textures are 512 px canvases at 2–4 m repeat with anisotropy 4 (`ownGround/gameGround.ts:756-764`). Rails (`ownGround/railTracks.ts:124-146`): a 3.1 m ballast bed per way with shoulders to 4.6 m, two 0.14 m ridge rails, sleepers and ±0.12 m rail stripes painted into a 256 px / 3.1 m tile (`gameGround.ts:844-855`); sleepers only +16 luma over ballast (#145). Beyond `NEAR_M` 350 m (LOD 1) the ridge rails are dropped (`drawRails = … && !input.far`, `:268`) and only the painted stripes remain, minified at a grazing angle. Cell `-2_-4` has 35 rail+subway ways side by side, each its own bed: the banding. The far ring (`ownGround/farRing.ts`) draws no railway.

## Do, in this order, each behind a flag and measured

1. **One texture policy** (`src/canalRecall/look/texturePolicy.ts`, typed, unit-tested): a single function every texture creation calls (façade cell array, city-look slot array, roof, ground canvases, park noise, water mask excluded) returning `{cellPx, anisotropy, minFilter, magFilter, generateMipmaps}` per tier and pointer type. Desktop `high`: 512 px façade cells, anisotropy `min(gpuMax, 16)` on **all** of them; `mid`/`low`/touch: today's values (256/128 px, 4). `textureLod(…, 8.0)` becomes `log2(cellPx)` so the mean-colour fallback still reads the 1×1 level. Flag `?texturePolicy=0` restores today's values byte-for-byte. Measure: texture MB before/after (new budget row `desktopTextureMB`, report the number), GPU ms at Dam and Westerkerk A/B (`scripts/gpu-load-ipad.mjs` style or `GL_COUNTERS=1 scripts/motion-stutter.mjs`), frame p99 on the seeded ride. The 2026-10-31 A/B put anisotropy 1–8 within ±1 ms; confirm 16 and 512 px are too.
2. **`cellTier` follows the pixel ratio**: one setter called from the governor/tier path that updates the uniform on every live material (unit test with a fake material set).
3. **Sharpness metric**: `scripts/look/sharpness.mts` (Laplacian variance or Sobel edge energy inside the façade band of a frozen frame, same shape as `src/canalRecall/look/busyness.ts` / `scripts/look/busyness.mts`). Run at S2 before/after, desktop DPR 2 and iPhone profile. Report; do not gate yet.
4. **Rails**: (a) stripes become a separate high-contrast layer that survives mips (stripe ≥ 60 luma below ballast; sleepers fade toward ballast with distance instead of mip-averaging into a hatch), (b) ridge rails keep a screen-space minimum width (≥ 1.25 px, as `ownMap/layers.ts` does for overview lines) instead of vanishing at LOD 1, (c) adjacent beds with centres < 5 m merge into one yard bed with one shoulder pair and individual rails (the open item from `lane-rail-look-20261030.md`), (d) the far ring draws rail corridors as a two-tone band so they do not end at 2 km. Flags `?railStripes=0`, `?railMinPx=0`, `?railYard=0`, `?farRail=0`. Strips: the Zuidas spot (add it to `scripts/own-ground/rail-shots.mjs` `SPOTS`) plus the three rail-look spots, orthophoto beside (`scripts/own-ground/rail-strip.ts`). If the extract changes, bump `RAIL_VERSION`, keep the decoder tolerant of v1, rebuild with `scripts/own-ground/build-rail-tracks.ts` and report the diff.

## Keep

`?rails=0`; the Dijksgracht ≥ 6 tracks regression; tunnel and level-crossing rules; `test:own-ground`, `test:look` green; iPhone texture budget `iphoneTextureMB` 22 unchanged (touch keeps today's sizes); `check:canal`.

## Hand back on #224

Branch + SHA (pushed); strips at S2 (with the sharpness numbers) and S4 (+ the three rail spots) beside the user's shots, desktop DPR 2 and iPhone profile, flags on/off; texture MB and GPU ms before/after; bundles to rebuild (`build:canal-own-ground` worker bundle, engine bundle, whatever `package.json` names) and the test scripts the new tests join; What's New text; what is still open.
