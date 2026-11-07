# Lane R4-C: installed street chunks from the air, one draw per chunk and a stand-in in the batch

Worktree `/Users/blackmad/Code/map-recall2-worktrees/engine-street-chunks-20261107`, branch `lane/engine-street-chunks-20261107` from `main` (1716d3c70), port 4661. Issue #245. Plan #222. Model: opus. Rules: `docs/handoffs/LANE-RULES.md`.

Engine round 4, after R4-A (#243, baked coarse tier) and R4-B (#244, landmark lod2 + batch). Plan #222.

## What is left

R4-B's draws-per-kind at the parked aerial spots (desktop, lane bundles): Westerkerk has 40 installed street chunks drawing **793 meshes**, Rijksmuseum 76 chunks drawing **1,255 meshes**; catalogue landmarks are down to 21–90 draws at S1/S4 but the `landmarks` owner still draws 504 at Westerkerk and 639 at Rijksmuseum against the ≤ 150 gate, and the street chunks are most of it. The aerial p99 is GPU-bound and tracks the draw count (R3-F, R4-B).

A chunk (`public/canal-drive/models/ordinary-buildings/chunks/<id>.glb`, 143 installed, manifest `public/canal-drive/ordinary-buildings-data/chunks.json`) is one node, one mesh, **one primitive per material** (10–20: `836e61_brick`, `d9d6cc_stone`, `e6e2d8_frame`, `3a2a24_door`, `2a3a42_glass`, `7a4a3c_roofTile` …), 4–6k triangles, no textures, POSITION/NORMAL/TEXCOORD_0, `extras.pandRanges` per primitive and `extras.streetChunk` on the node (`streetChunks/gltf.ts`, `extras.ts`). The city look dresses them by slot, so after the look many primitives share one material object. R4-B's `?landmarkMergeShared` merges such siblings into one mesh for full/lod1 landmarks but **excludes chunks** (`signature-landmarks-source.js` `:1300`, `spec.chunkPands`), and lod2/batch exclude them too (`:1193`), because the per-pand ground lift (`_applyChunkPandBases` `:985–1060`: `separatePands` / `liftPands` per primitive by `pandRanges`) and hover/pick (`pandIndexForFace`) are indexed per primitive.

## Do, each behind a flag, byte-identical off, measured with R3-F's harness and method

1. **Baseline on your branch**: aerial-pan both profiles (command below), draws per kind at the parked spots and at the user's two aerial poses (`SPOT_SET=identity`), plus a 60 s street ride.
2. **Merge a chunk's primitives per shared city material at load**, chunks included (`?chunkMerge=0` restores): concatenate the primitives the look gave one material, re-base and concatenate their `pandRanges` so `separatePands`, `liftPands` and `pandIndexForFace` keep working on the merged geometry (typed helper in `streetChunks/` with tests: ranges round-trip, a pick on a merged face returns the right pand, the lift moves only that pand's vertices). Street level must be pixel-identical: a look-consistency run at a street pose in front of a chunk (Transvaal 42–48, Pretorius 71–95) against main within noise.
3. **A chunk stand-in from the air**: an offline `<id>.lod2.glb` per chunk in `scripts/landmarks/build-landmark-lods.ts`'s pattern (meshopt simplify, one primitive per city material, ≤ 1,500 triangles, pandRanges kept per merged primitive, `check:landmark-lods`-style validation), chosen by R4-B's rules (`landmarkLod.ts chooseLevel`: lod2 below 12 px or aerial beyond 500 m) and added to R4-B's `landmarkBatch.ts` batches, lifted once by the chunk's lowest pand base (one matrix per chunk; the per-pand lift is a street-level feature). `?chunkLod2=0` restores. The swap must not pop (fade like R4-B's, ΔE counted).
4. **Measure after**: draws per kind at the parked spots (chunks 793 → ≤ 80 at Westerkerk, 1,255 → ≤ 150 at Rijksmuseum; `landmarks` owner ≤ 150 desktop at every parked spot), frames > 100 ms in the 180 s pan ≤ 20 desktop / ≤ 10 iPhone, p99 worst window and `three render main` reported; `aerialGlMaxMB`, heap growth within their rows; street ride p99 unchanged; `swap-gate`, `rider-cover-bump`, `landmark-highlight` and the POI click probe (`npm run test:prism-pick`) green.
5. **Strips** to `blackmad/map-recall2-screenshots` `engine/2026-11-07-r4c/`: the user's two aerial poses and Westerkerk / Rijksmuseum parked, main | merge | merge + lod2, with 4× crops of a chunk row at each; two street poses in front of chunks, main | lane, pixel diff count.
6. **Tests** beside the modules; `npm run lint`, `npm run test:landmarks`, `npm run test:engine`, `npm run test:prism-pick`, `npm run check:landmark-lods`.

Pan command (under the exclusive lock, one profile at a time):
```
PORT=4661 CANAL_PW_EXCLUSIVE=1 /tmp/canal-pw.sh perl -e 'alarm 1500; exec @ARGV' -- \
  node scripts/aerial-pan.mjs artifacts/aerial/<name>.json --device desktop --pan 180 --every 5 --chrome --headed \
  --qs '?ride=free&engine=own&framePhases=1'
```
(`--device iphone` for the phone; `BUNDLES_DIR=<scratch>` for your build; `SPOT_SET=identity` for the user's poses.) Baked shells are on by default on desktop since R4-A; keep them on in every run.

## Fences

Yours: `streetChunks/` (new merge helper + tests), `scripts/landmarks/build-landmark-lods.ts` for the chunk lod2 (+ its check), `landmarks/landmarkLod.ts` and `landmarks/landmarkBatch.ts` for chunks, `signature-landmarks-source.js` in the merge/lod2/batch gating and `_applyChunkPandBases`. Not yours: `game.js`, `index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `budgets.json`, `covers.json`, the chunk GLBs themselves (lod2 files are new files beside them, committed on your branch with manifest rows), the published world extract, `engine/bakedCoarse.ts`, `labelLayer.ts`, `look/*`.

## Hand back here

Branch + SHA (pushed, merged with `origin/main`); before/after tables per profile (pan and ride); draws per kind at each spot; the chunk lod2 size table; the pixel diffs at street level; the strips' paths; which bundles to rebuild (`signature-landmarks` and `signature-placement` together, `three-buildings` if touched); the tests and the scripts they join; What's New text; what is still open. Then stop; the integrator merges.

Rules: `docs/handoffs/LANE-RULES.md`. `/usr/bin/git` only, never `git stash`, never `pkill` (stop your server by `kill $(lsof -t -iTCP:4661 -sTCP:LISTEN)`), one Playwright run at a time via `/tmp/canal-pw.sh`, push under `CANAL_PW_EXCLUSIVE=1 /tmp/canal-pw.sh`. Likeness and measured results are the acceptance bar, not gates passing.

