# Lane R4-G: GPU memory from the air under its 700 MB budget, with the same picture

Worktree `/Users/blackmad/Code/map-recall2-worktrees/engine-gpu-memory-20261108`, branch `lane/engine-gpu-memory-20261108` from `main` (after the R4-F merge), port 4666. Issue #250. Plan #222. Model: opus. Rules: `docs/handoffs/LANE-RULES.md`.

Engine round 4, after R4-E (#248) and R4-F (#249, HISTORY 2026-11-08). The desktop aerial pan now meets both frame gates in both harness modes. The one aerial budget still red is `aerialGlMaxMB`: 757 MB on the continuous pan and 774–801 on the harness pan against 700 (`tests/perf/budgets.json`), and R4-F named the owners at the 798 MB peak before its ring fix:

| owner | MB | what it is |
|---|---|---|
| baked coarse buffers | 196 → 171 after R4-F (106 → 56 cells) | `engine/bakedCoarse.ts` SHEL meshes, one per world cell |
| facades | 165, of which a fixed 139 MB atlas | `threeBuildingsBrowser.ts lookTexturesOf`: a `DataArrayTexture` RGBA colour + R8 mask, 256 px cells × every look layer, mipmapped (`look/lookAtlas.ts`, `look/texturePolicy.ts`) |
| landmarks | 152, of which 109 MB textures | the signature landmark GLBs' textures (find which: `glCounters` tags each allocation with an owner, `window.__canalPerf.gl.report().resident.byOwner`) |
| ground | 126 | own ground relief + surface |
| overview | 34 | |
| far shells | 28 | `engine/farShells.ts` |

## What is wanted

The 3-minute desktop pans (both modes) peak at or under 700 MB resident GPU memory, with no visible change at the user's poses: the S1–S4 poses and the Da Costakade chase poses of `tests/e2e/crisp-textures.spec.ts`, judged by the likeness metrics those specs already compute (`laplacianVar`, edge, acutance; `baked-fabric` ratio) and by a strip the integrator can look at. No frame-time regression: the continuous pan stays at ≤ 2 frames > 100 ms and p99 worst window ≤ 60, the harness pan at ≤ 6 and ≤ 80 (two runs each); the 60 s street ride p99 unchanged.

## Do, measured first, each change behind a flag

1. **Attribute first.** One pan with `glOwners` on the oost-leg peak: the top 40 owners by MB, textures split from buffers, and for the landmark textures the models and texture sizes (a GLB with a 4096² RGBA texture uploads 85 MB with mipmaps; a 2048² one 21 MB). Post the table before changing anything.
2. **Landmark textures (likely the biggest cheap win):** cap the resident resolution from the air (a GLB's texture can be loaded at its next mip when the model is farther than its lod1 distance; three.js `texture.image` downscale before upload, or `KTX2`/basis supercompression via `gltf-transform` in the model pipeline if the loaders are set up: check `scripts/build-3d-bundles.mjs` and the landmark pipeline under `scripts/landmarks/` before choosing; no loader exists today). Textures shared across models (kit sheets) must stay shared. Flag: `?landmarkTexCap=2048|1024`.
3. **The facade atlas:** it is fixed at 139 MB because every look layer is resident at 256 px with mipmaps. Options to measure: drop the top mip level from the air only (half the bytes, the cells are under 1 px per texel there anyway: `texturePolicy.ts` pins the tier per pose), or load the atlas at 128 px while aerial and re-upload the 256 px one on the way down (the `atlasSource` restore path already paints in slices). Flag: `?atlasAerial=half|128`. Likeness at the street poses must be byte-identical (the atlas on the ground is the same), and at the S4 aerial pose within the `crisp-textures` noise.
4. **Ground 126 MB:** report what it is (relief tiles × bytes, surface textures); a fix only if it is a one-liner (a stale ring, an unreleased buffer).
5. **Measure after:** both pans two runs each with `aerialGlMaxMB`, frames > 100, p99 worst window, `aerialDrawsMax`; the four crisp-textures poses and `baked-fabric` on | off; the street ride; `swap-gate`, `rider-cover-bump` (`ENGINE=own`), `landmark` specs that load the models (`test:landmark-lod`, `test:landmark-residency`).
6. **Strips** to `blackmad/map-recall2-screenshots` `engine/2026-11-08-r4g/`: the owner table as a bar chart off | on, the S4 and oost aerial frames main | lane, and a 2× crop of the nearest landmark in each with its texture cap on | off.
7. **Tests** beside the modules; `npm run lint`, `npm run test:engine`.

Pan command (one profile at a time, under the lock; your own dev server on 4666 with `PORT=4666 npx tsx server.ts`):
```
PORT=4666 CANAL_PW_EXCLUSIVE=1 /tmp/canal-pw.sh perl -e 'alarm 1500; exec @ARGV' -- \
  node scripts/aerial-pan.mjs artifacts/aerial/<name>.json --device desktop --pan 180 --every 5 --chrome --headed [--continuous] \
  --qs '?ride=free&engine=own&framePhases=1'
```
(`BUNDLES_DIR=<scratch>` for your build; the Vite dev server reloads on any worktree file change and silently hangs a run.) The A/B rule for memory: ≥ 40 MB lower peak in both of two alternating pairs; for frames the rule from R4-E (≥ 15 fewer frames > 100 ms or ≥ 20 ms worst window, both pairs) applies to any regression claim.

## Fences

Yours: `src/canalRecall/engine/glCounters.ts` (reporting only), the landmark loading side of `src/canalRecall/landmarks/*` and `public/canal-drive/js/signature-landmarks-source.js` (texture handling only, no model changes), `src/canalRecall/look/texturePolicy.ts` and `look/lookAtlas.ts` for the aerial atlas option, `threeBuildingsBrowser.ts lookTexturesOf` and the atlas restore path only, new typed modules with tests, `scripts/aerial-pan.mjs` reporting only. Not yours: the models and their GLBs (a pipeline step that re-encodes textures is fine if it is byte-identical for the mesh and reversible; name it, do not run it over the catalogue without the integrator), `roofTier.ts`, `streetChunks/*`, `bakedCoarse.ts`, `worldRing.ts`, the published world extract, the shared integration files (`game.js`, `index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `budgets.json`, `covers.json`).

## Hand back here

Branch + SHA (pushed, merged with `origin/main`); the owner table before and after; each flag's memory and frame numbers (two runs each, both modes); the likeness numbers at the poses; the strips' paths; which bundles to rebuild; tests and scripts joined; What's New text if anything visible changed; your default recommendation per flag; what is still open. Then stop; the integrator merges.

Rules: `docs/handoffs/LANE-RULES.md`. `/usr/bin/git` only, never `git stash`, never `pkill` (stop your server with `kill $(lsof -t -iTCP:4666 -sTCP:LISTEN)`), one Playwright run at a time via `/tmp/canal-pw.sh` (`PW_PORT=4666`), timing runs and the push under `CANAL_PW_EXCLUSIVE=1 /tmp/canal-pw.sh`. Wait on background commands in the foreground. Measured results and likeness are the acceptance bar, not gates passing. Budget: about 120 turns; hand back what is measured when it runs out.
