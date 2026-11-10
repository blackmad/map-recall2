# Lane: compress the street chunks and per-house GLBs (2026-11-07, week 1)

Branch `lane/chunks-meshopt-20261107`, own worktree from `scripts/worktrees/new.sh`. Read
`docs/handoffs/LANE-RULES.md` first. Model: **haiku**. Use `/usr/bin/git`; never `pkill`; stop a dev
server by its port's PID. Playwright only through `bash /tmp/canal-pw.sh … --workers=1` with your
`PW_PORT`, one run. Budget: 40 turns.

## Why

The 443 bespoke landmark GLBs are meshopt-compressed and quantized; the 143 block-face street chunks
(`public/canal-drive/models/ordinary-buildings/chunks/*.glb`, 83 MB, median 416 KB, max 2.4 MB) and the
177 per-house GLBs in `models/ordinary-buildings/` (72 MB) are not. They go through the same
`GLTFLoader` in `public/canal-drive/js/signature-landmarks-source.js`, which already has the meshopt
decoder, so compression is a build step, not a runtime change. This is the cheapest bytes win in the
plan (§B2) and it removes an excuse for not scaling the chunk tier.

## Do

1. The chunk GLB is written by `scripts/block-face/compile.ts` (`chunk.glb` in staging, installed by
   `batch.ts --faces`); the loader is `signature-landmarks-source.js:305` (`setMeshoptDecoder`). Find and where the landmark pipeline applies
   `@gltf-transform/functions` `meshopt` + quantization (`scripts/landmarks/build-landmark-lods.ts`
   shows the toolchain; the full-model exporter uses the same encoder). Add one typed helper
   `src/canalRecall/glb/compressGlb.ts` (meshopt + quantize, same options as the landmarks) and call it
   from the chunk writer, so future installs are compressed by construction. Byte-identical output when
   the option is off; unit test with a tiny GLB.
2. One-off script `scripts/glb/compress-existing.ts --dir=<dir> --write` that re-encodes the existing
   chunk and per-house GLBs in place and prints a table: file, bytes before, bytes after, triangles
   (must be unchanged), positions max abs delta (must be ≤ 1 cm from quantization).
3. Update the manifests that carry sizes or hashes for these files (`ordinary-buildings-data/chunks.json`,
   `catalogue.json`, covers hashes if any); run `npm run check:covers` and `npm run check:stale-installs`.
4. Prove the frame is unchanged: one Playwright run of the existing chunk strip spec (Bilderdijkstraat or
   Nassaukade, `tests/e2e/*chunk*` or `recipe-street`) before and after, pixel diff ≤ the spec's own
   tolerance. No new spec needed.

## Numbers to hand back

Bytes before/after for chunks and per-house (total and median), triangles unchanged (yes/no), max
position delta, load time of the chunk tier on the seeded ride if the perf harness reports it
(`scripts/ride-perf-owners.mjs`, optional).

## Hand back

LANE-RULES format. KIT CANNOT YET EXPRESS: n/a. INTEGRATOR TODO: bundle rebuilds if the loader path
changed (it should not), covers if hashes moved.
