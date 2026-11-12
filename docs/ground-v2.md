# Ground v2: the baked surface (as built by G2a)

The spec is `docs/handoffs/ground-v2-design-20261110.md`, and the plan is `ground-v2-plan-20261110.md`. This page covers what G2a landed: how to run the bake, what the files are, how the runtime reads them, and what was measured. Phase 1 bakes the **surface only**: one clipped, draped partition per cell. Overlays (paint, tram, bollards, water, quays, decks, rails) stay worker-built.

## Commands

| What | Command |
|---|---|
| Bake the ride-priority set (G0 places, seam pin, canal belt and inner ring: 47 cells) | `npx tsx scripts/own-ground/bake-ground.ts --set=priority [--shard=i/n]`, then `--index` |
| Bake LOD 1 | `… --set=priority --lod=1` |
| Rebake only changed cells | `… --changed` (compares input and code hashes in `meta/`) |
| Byte projection for the whole city (do not bake all: judgement ruling 3) | `… --set=all --sample=30 --no-write` |
| Audit: slivers, overlap, z-fight, poke-through, cracks, float, every neighbour seam | `npx tsx scripts/own-ground/audit-ground-v2.ts [--dir] [--lod] [--seams-only]` |
| Typed check: seam pin plus regression pairs, frame header, cracks | `npx tsx scripts/own-ground/check-ground-v2.ts [--bake] [--determinism]` |
| Decode and pose-index cost | `npx tsx scripts/own-ground/bench-ground-v2.ts` |
| Before/after frames at the 8 places | `GROUND_V2_FRAMES=1 [GROUND_V2_BEFORE=1] BUNDLES_DIR=… PW_PORT=… bash /tmp/canal-pw.sh npx playwright test tests/e2e/ground-v2-frames.spec.ts --project=desktop --workers=1`, then `npx tsx scripts/own-ground/ground-v2-strip.ts` |

Every script prints its options with `--help` (a `HELP` constant). The bake writes to `artifacts/ground-v2/staging/`. The integrator publishes reviewed files to `public/data/extracts/amsterdam/ground-v2/`; the bake never writes the extract tree.

## Files

- `src/canalRecall/ownGround/groundConstraints.ts`: the design's constraint types. G2c fills in the providers.
- `groundV2Sources.ts`: feeds the bake. It turns roads-v1 (with the worker's RoadIndex overrides), the kerb band, parks, courtyards, open ground, OSM areas and water into ranked groups and features over the cell's 5×5 neighbourhood.
- `groundPartition.ts`: the bake itself.
  1. Arrange by precedence (polygon-clipping, integer mm, canonical seam stops).
  2. Quantise to the u16 grid, node, add the seam grid, densify.
  3. Add Steiner points from the relief quadtree, with per-class tolerance.
  4. Triangulate with constrainautor and refine.
  5. Classify triangles; triangles on a seam edge take `seamClassifier`'s class.
  6. Duplicate vertices per level and add step strips.
  7. Set heights and analytic normals.
- `groundV2Format.ts`: GRD2. Its header records the frame origin, transform, scale and format version, and the cell rect. `frameMismatch` is the loader's refusal test. The pinned RD round trip lives in `groundV2Format.test.ts`.
- `groundV2Loader.ts`: the phase-1 runtime. It swaps the worker's surface triangles for the baked ones where the baked surface covers them within 0.6 m (so deck tops stay), and refuses any file baked in another frame, rect or version.
- `groundV2Pose.ts`: the 4 m bucket pose index (G2b wires it into `riderPose`).
- `groundV2Audit.ts`, `groundV2Places.ts`: the audit measures, the 8 named places, the seam pin and the seam regressions.
- `scripts/own-ground/groundV2BakeCell.ts`: one cell from the store to GRD2 bytes. The bake and the check share it.

## Runtime (`?groundV2=1`, default off)

`gameGround.ts` passes the flag to the ground worker. The worker reads `ground-v2/index.json`. For each listed cell at LOD 0 and full detail, it builds the cell as today and then applies the baked surface. `cellStats(key).groundV2` reports `v2:<baked triangles>/<worker triangles dropped>` or `fallback:<why>`. This saves no worker CPU yet; it exists so the look can be judged. G2b replaces it with `buildCell({ surface: false })` plus a decode-only path.

## Seams

Both neighbours must hold bitwise-identical seam vertices: the same position, height and normal. Five things guarantee it:

- **5×5 inputs.** A polygon owned by a cell two away can still cross the seam.
- **Canonical crossings.** `splitAtLines` gives ring/side crossings as integers, and the stops are inserted in both cells.
- **The global 2 m seam grid.**
- **Interior clamping.** Off-side points are clamped one quantum inside: `uOf`/`vOf`, and the crossing splits.
- **`seamClassifier`.** A triangle on a seam edge takes the class the sources give at the edge's midpoint, and the edge's vertices sit at that class's level.

Without `seamClassifier`, a feature ending a few mm or cm past the seam leaves a one-quantum sliver in the neighbour. Its triangles took the class beside them, so the seam's levels differed by 110 mm, or a vertex existed in one cell only. In the first bake, 34 of 76 pairs were affected. Both cases are pinned in `GROUND_V2_SEAM_REGRESSIONS`.

Two more inputs made the seams depend on the neighbourhood, and both are fixed:

- **Kerb runs.** Two road cells can store one kerb run with the same ends and point count but different interior points. The dedupe now keys on the whole line.
- **Park paths.** Park paths were ranked level with the BGT footways. They now have their own rank, `parkFoot`, under the footways, as the worker's lifts order them.

The audit compares the vertices on seam *edges*. A vertex that touches a side only at a triangle corner, where both cells are water along the side, carries no shared edge.

## Measured (2026-11-12, 49 ride-priority cells, load 40–80 on 14 cores)

| | LOD 0 | LOD 1 |
|---|---|---|
| Total (meshopt + vertex-cache reorder, gzip) | 64.6 MB | 23.9 MB |
| Per cell p50 / p95 / max | 1.37 / 1.68 / 1.99 MB | 0.51 / 0.62 / 0.78 MB |
| Same cells, raw u16 + gzip | 171.0 MB | 56.7 MB |
| Same cells, meshopt without the reorder | 153.6 MB | 49.8 MB |
| Design budget per cell | p50 ≤ 1.1, p95 ≤ 1.5 MB | ≤ 0.3 MB |
| Bake per cell, p50 / p95 | 167 / 302 s | 21 / 74 s |

Mitigation trials on `-4_-3`, LOD 0:

| Variant | Bytes | Triangles | Slivers in the cell |
|---|---|---|---|
| 7.5 cm flat, no sliver repair | 0.61 MB | 141 k | 14,887 |
| 5 cm, 6 sliver rounds with the Ruppert split (the default) | 1.19 MB | 321 k | about 300 |
| 7.5 cm flat, 6 sliver rounds | 1.14 MB | 305 k | about 300 |

The 7.5 cm flat tolerance saves 4 %, but it leaves 228–485 m² per place window over the 5 cm float gate, so the default is 5 cm. Sliver repair doubles the bytes, and that is what pushes LOD 0 over its budget.

Runtime cost per cell (`bench-ground-v2.ts`), p50 / p95:

| Measure | p50 | p95 |
|---|---|---|
| Decode (gunzip + meshopt + dequantise) | about 21 ms | about 39 ms |
| Pose-index build | 38.5 ms | 71.9 ms |
| Pose query | 0.18 µs | |
| Pose index CPU memory | 10.4 MB | 12.1 MB |
| GPU memory | 8.2 MB | 10.1 MB |

The design estimates were 1.5 MB of CPU and 3–4 MB of GPU per cell, against 9.4–9.8 MB for today's partition layers.

Seams: all 79 baked neighbour pairs are identical (51,188 seam vertices). The pinned pairs pass in `check-ground-v2`.

At G0's nine places (150 m windows): poke-through, z-fight and crack are 0 at all nine. Each window still has 17–45 slivers (2–39 m²), down from 800–1,850. Each also has 16–322 m² over 5 cm of float (max 63–156 mm), which this audit does not yet separate from the step lines.

Bake-all projection (`--set=all --sample=30 --no-write`; 10 of the 294 cells sampled): 6.14 MB of LOD0, p50 0.59 MB and p95 1.57 MB per cell. That projects to about 181 MB of LOD0 for the whole city, against about 474 MB as raw u16 + gzip. The ruling stands: bake by ride priority, not the whole city.
