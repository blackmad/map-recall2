# Lane R4-H: lod1/lod2 for the ordinary-building installs, so their 2048-wide atlases leave the aerial peak

Worktree `/Users/blackmad/Code/map-recall2-worktrees/engine-ordinary-lods-20261108`, branch `lane/engine-ordinary-lods-20261108` from `main` (after the R4-G merge), port 4667. Issue #252. Plan #222. Model: opus. Rules: `docs/handoffs/LANE-RULES.md`.

Engine round 4, after R4-G (#250, HISTORY 2026-11-08 "R4-G GPU memory"). R4-G found that the 115 MB of "landmark textures" at the aerial GPU peak are not landmark GLBs: they are the embedded facade-atlas PNGs (2048 × 256 up to 2048 × 1792) of about 20 of the 175 **ordinary-building installs** in `public/canal-drive/ordinary-buildings-data/catalogue.json` (`modelUrl` → `models/ordinary-buildings/<pand>.glb`, dispatched by `src/canalRecall/landmarks/ordinaryModels.ts`), plus the GVB metro's 1024². None of these models has a lod1 or lod2, so they are resident at full texture size from 3 km away. A runtime texture cap (`?landmarkTexCap`) failed the A/B rule and stays off.

The landmark lod pipeline already does the right thing for curated landmarks: `scripts/landmarks/build-landmark-lods.ts` writes `<id>.lod1.glb` (~15 % triangles, textures resized to `LOD1_MAX_TEXTURE_SIZE` 256, meshopt) and `<id>.lod2.glb` (one merged primitive, colour baked to COLOR_0, ≤ 1,500 triangles) beside each GLB, records them in `src/canalRecall/landmarks/modelLods.json`, and `signature-landmarks-source.js` picks the level per frame by projected size (`landmarkLod.ts chooseLandmarkLevel`). The ordinary installs are simply not in its input set (`LOD1_MIN_SOURCE_TRIANGLES` 3000 would also skip most of them, since their cost is texture, not triangles).

## What is wanted

1. **The pipeline covers the ordinary installs.** `build-landmark-lods.ts --ordinary` (or the catalogue joined to its input): for every catalogue model with an embedded texture whose longest side is over 512 px, a `lod1.glb` with the atlas resized to ≤ 512 (keep LOD1_MAX_TEXTURE_SIZE 256 for curated landmarks; a new `ORDINARY_LOD1_MAX_TEXTURE_SIZE` 512, since these atlases carry the whole façade), triangles kept unless the model is over LOD1_MIN_SOURCE_TRIANGLES, and a `lod2.glb` by the existing lod2 rule where the model has no explicit material slots. Resumable by fingerprint like the rest; records in `modelLods.json`; `check-landmark-lods.ts` covers them. Do not change any source GLB.
2. **The runtime picks the level for them.** `ordinaryModels.ts` / `signature-landmarks-source.js`: the ordinary installs go through the same `chooseLandmarkLevel` as the landmarks (they may already, if `modelLods.json` has a row; verify). The distance at which lod1 replaces the full model must keep the façade crisp where the user looks: at the Da Costakade chase poses and S1–S4 the nearest installs must still be at the full level, and from 300 m a 512 px atlas over a 20 m frontage is ~1 texel per 4 cm, finer than the screen can show. Measure, do not assume: a strip of the three installs with the largest atlases at 50 / 150 / 300 / 600 m, full | lod1, 2× crops.
3. **Measured on the pans:** both modes, two runs each, `aerialGlMaxMB` and `aerialGlDecodedMaxMB`, the owner table (landmark textures row), frames > 100, p99 worst window; the A/B rule for memory from R4-G (≥ 40 MB lower in both pairs; expect ~75–90 MB from the atlases alone). The 60 s street ride unchanged; `crisp-textures` at S1–S4 and the Da Costakade poses within noise; `test:landmark-lod`, `test:landmark-residency`, `check-landmark-lods`, `check:covers` green (covers.json is the integrator's; report if it needs a rebuild).
4. **Strips** to `blackmad/map-recall2-screenshots` `engine/2026-11-08-r4h/`: the owner bars off | on, the distance strip from (2), the oost and Dam aerial frames main | lane.
5. **Tests** beside the modules; `npm run lint`, `npm run test:engine`.

Pan command (one profile at a time, under the lock; your own dev server on 4667 with `PORT=4667 npx tsx server.ts`):
```
PORT=4667 CANAL_PW_EXCLUSIVE=1 /tmp/canal-pw.sh perl -e 'alarm 1500; exec @ARGV' -- \
  node scripts/aerial-pan.mjs artifacts/aerial/<name>.json --device desktop --pan 180 --every 5 --chrome --headed [--continuous] \
  --qs '?ride=free&engine=own&framePhases=1'
```
(`BUNDLES_DIR=<scratch>` for your build; the lod GLBs are data the dev server serves from your worktree, so they are measured live. The Vite dev server reloads on any worktree file change and silently hangs a run.)

## Fences

Yours: `scripts/landmarks/build-landmark-lods.ts` and `check-landmark-lods.ts`, `src/canalRecall/landmarks/landmarkLod.ts` (new constants and the ordinary rule), `modelLods.json`, new `models/ordinary-buildings/<pand>.lod1.glb` / `.lod2.glb` files (generated, versioned by fingerprint; commit them on your branch, they are data the integrator publishes with the merge), `ordinaryModels.ts`, the level-choice lines of `signature-landmarks-source.js`, `scripts/aerial-pan.mjs` reporting only. Not yours: the source GLBs, the catalogue's model records, `landmarkTexCap.ts`, `glCounters.ts`, `bakedCoarse.ts`, the published world extract, the shared integration files (`game.js`, `index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `budgets.json`, `covers.json`).

## Hand back here

Branch + SHA (pushed, merged with `origin/main`); how many installs got a lod1 / lod2 and the bytes added; the owner table and memory numbers before and after (both modes, two runs); the frame numbers; the distance strip and the crisp-textures numbers; the strips' paths; which bundles to rebuild and whether covers.json needs one; tests and scripts joined; What's New text if anything visible changed (if the switch distance is right, nothing is); what is still open. Then stop; the integrator merges.

Rules: `docs/handoffs/LANE-RULES.md`. `/usr/bin/git` only, never `git stash`, never `pkill` (stop your server with `kill $(lsof -t -iTCP:4667 -sTCP:LISTEN)`), one Playwright run at a time via `/tmp/canal-pw.sh` (`PW_PORT=4667`), timing runs and the push under `CANAL_PW_EXCLUSIVE=1 /tmp/canal-pw.sh`. Wait on background commands in the foreground. Measured results and likeness at the user's poses are the acceptance bar, not gates passing. Budget: about 120 turns; hand back what is measured when it runs out.
