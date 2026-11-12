# Ground v2: the baked surface (as built by G2a)

The spec is `docs/handoffs/ground-v2-design-20261110.md`, and the plan is `ground-v2-plan-20261110.md`. This page covers what G2a landed: how to run the bake, what the files are, how the runtime reads them, and what was measured. Phase 1 bakes the **surface only**: one clipped, draped partition per cell. Overlays (paint, tram, bollards, water, quays, decks, rails) stay worker-built.

## Commands

| What | Command |
|---|---|
| Bake the ride-priority set (G0 places, seam pin, canal belt and inner ring: 47 cells) | `npx tsx scripts/own-ground/bake-ground.ts --set=priority [--shard=i/n]`, then `--index` |
| Bake LOD 1 | `… --set=priority --lod=1` |
| Rebake only changed cells | `… --changed` (compares input and code hashes in `meta/`) |
| Byte projection for the whole city (do not bake all: judgement ruling 3) | `… --set=all --sample=30 --no-write` |
| Audit: slivers, overlap, z-fight, poke-through, cracks, float, every neighbour seam | `npx tsx scripts/own-ground/audit-ground-v2.ts [--dir] [--lod] [--seams-only] [--places] [--no-caps]` |
| Typed check: seam pin plus regression pairs, frame header, cracks | `npx tsx scripts/own-ground/check-ground-v2.ts [--bake] [--determinism]` |
| Decode and pose-index cost | `npx tsx scripts/own-ground/bench-ground-v2.ts` |
| Before/after frames at the 10 places (`GROUND_V2_STRIPS=<audit json>` adds the thin strips' on-screen width) | `GROUND_V2_FRAMES=1 [GROUND_V2_BEFORE=1] BUNDLES_DIR=… PW_PORT=… bash /tmp/canal-pw.sh npx playwright test tests/e2e/ground-v2-frames.spec.ts --project=desktop --workers=1`, then `npx tsx scripts/own-ground/ground-v2-strip.ts` |

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
- `groundV2Pose.ts`: the compact pose index, 16 m buckets (G2b wires it into `riderPose`).
- `groundV2Caps.ts`: floor caps from G3's crossing register (`crossings.ts floorCaps`): under a reviewed deck the relief is min(street level, relief).
- `groundV2Audit.ts`, `groundV2Places.ts`: the audit measures, the 10 named places (G0's nine and the A10 deck over the Piet Kranenbergpad), the seam pin and the seam regressions.
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

## Round 2 (2026-11-12): bytes, memory, caps, float, slivers

The ruling: no publish yet. Bring bytes and memory to budget, use G3's register for the A10 deck over the Piet Kranenbergpad (the judgement session's "Radarweg south abutment"), find why the Radarweg places never settled, take float off the step lines, and get slivers to zero or show they are invisible.

### Levers, measured on `-4_-3` (LOD 0 unless noted)

| Lever | Bytes | Triangles | What it bought |
|---|---|---|---|
| Round 1 default (5 cm, 6 sliver rounds) | 1.19 MB | 321 k | baseline |
| No sliver rounds | 0.65 MB | 153 k | −45 % bytes; float off the steps rose (centroid-only refinement) |
| + 0.5 m relief lattice, 8 rounds, own-edge split | 0.68 MB | | float off the steps over 5 cm 2–25 m² per place window |
| + remnants under 0.25 m absorbed | 0.67 MB | | thin strip slivers per place from 30–104 to 2–40 |
| + 4 cm tolerance (the default) | 0.74 MB | 187 k | float over 5 cm: 0 at 5 places, 0.25–1.5 m² at 4 |
| + own-edge split on the grid point nearest the edge | 0.74 MB | 186 k | the last float samples gone (52 → 42 mm max at the Kranenbergpad) |
| 3.5 cm tolerance (not taken) | 0.79 MB | 202 k | no float change; +7 % bytes |
| 12 refinement rounds (not taken) | 0.74 MB | 186 k | identical to 8: the refinement has converged |
| LOD 1: 25 cm, no sliver rounds | 444 → 250 kB | | −44 % |
| Pose index: quantised, bucket-major u16 offsets, exact SAT overlap | 10.4 → 2.50 MB (8 m), 1.91 MB (16 m) | | the floor is about 6 bytes per vertex + 6 per triangle |
| GPU: one u16-indexed mesh per 3×3 tile | 5.09 → 2.43 MB | | flat Float32 + Uint32 was 7.3 MB |

### Floor caps (`groundV2Caps.ts`)

G3's register (`data/crossings/*.json`, `crossings.ts floorCaps`) gives each reviewed deck polygon with the street level under it. AHN has no ground under a deck and interpolates across it from the embankment tops: under the A10 deck over the Piet Kranenbergpad the relief stood at 1.44 scene m against the record's street level of −0.75 (0.62 NAP), a 2.2 m saddle rising into the soffit. The bake now reads min(street level, relief) inside each cap ring:

- The ring is a constraint edge, so no triangle straddles it.
- With steps, capped triangles take their own levels (level + 2). Where the relief outside is higher (the abutment), a `quay` step strip joins the two copies of each ring vertex and faces into the cap. Where the cap is not below the relief, no wall is drawn.
- A cap only lowers. Under the Orlyplein deck at Sloterdijk the record's street level (0.80 NAP, the track bed) lies above the relief's median, and lifting the ground there would bury the rails and building bases, which read the worker's relief.
- Without caps the bake is byte-identical (`groundPartition.test.ts`). Bake with `--no-caps` and audit with `--no-caps` to compare.

The worker surface does not cap (G1 owns that; `crossings.ts` says so). Under a cap, the pose index and the drawn ground follow the cap, while the worker's rails and buildings still follow the relief.

### Why the Radarweg places never settled

Cell `-5_2` took 61 s to build in Node. The 2.3 km A10 way-deck (OSM 130106320, 4,660 points at 0.5 m) was registered in every 25 m bucket of its 2,165 × 443 m bbox, so every height query in that box ran a linear nearest-segment scan: `GroundSurface.locate` took 41.6 s of self time. Two fixes, both exact:

- Decks are registered only in the buckets within their reach of the centreline: the widest half-width + `DECK_BLEND_M` + 0.5 m. `height` and `deckWeight` give a deck no weight past that.
- Profiles of 64 points or more answer the nearest segment from a 16 m segment grid.

`-5_2` now builds in 11.4 s, and both the Radarweg and the A10 places settle in the frames run.

### Naming

G0's `radarweg-south-abutment` pin (4.83455, 52.38484, cell `-5_1`) is the Sloterdijk bridge over the Haarlemmertrekvaart. G3's register names the A10 deck over the Piet Kranenbergpad (`-4_-4`) as the judgement session's "Radarweg south abutment". No register record lies within 400 m of G0's pin. Both places are kept: the tenth, `kranenbergpad-a10-abutment`, is the register's deck.

### Measured (round 2, 49 ride-priority cells, load 60–140 on 14 cores)

| | Round 1 | Round 2 | Budget |
|---|---|---|---|
| LOD 0 total | 64.6 MB | 43.9 MB | |
| LOD 0 per cell p50 / p95 / max | 1.37 / 1.68 / 1.99 MB | 0.91 / 1.12 / 1.33 MB | p50 ≤ 1.1, p95 ≤ 1.5 |
| LOD 1 total | 23.9 MB | 13.6 MB | |
| LOD 1 per cell p50 / p95 / max | 0.51 / 0.62 / 0.78 MB | 0.29 / 0.36 / 0.43 MB | ≤ 0.3 |
| Pose index, LOD 0, p50 / p95 | 10.4 / 12.1 MB | 2.70 / 3.29 MB | ≤ 1.5 |
| GPU, LOD 0, p50 / p95 (tiled, u16) | 8.2 / 10.1 MB | 3.52 / 4.35 MB | 3–4 |
| Decode, pose build, pose query (LOD 0 p50) | 21 ms, 38.5 ms, 0.18 µs | 25.6 ms, 49 ms, 1.4 µs (desktop Node under load 100+) | |
| Bake per cell p50 / p95 | 167 / 302 s | 86 / 126 s | |

Still over budget:

- **LOD 1 p95** is 0.36 MB. Its bytes are the partition, not the relief. On the three largest cells, 40 cm tolerance saved 7 %, 8 m squares with 1 m simplification 5 %, and 2 m simplification 9 %. Reaching 0.3 MB needs fewer classes at LOD 1, such as merging kerb, garden and paving into their neighbours.
- **The pose index** is at its floor for this layout: about 6 bytes per vertex and 6 per triangle, with 226 k triangles at p50. Sharing the decoded vertex arrays the GPU upload already holds would save about 0.6 MB. Below that it needs a coarser surface, which the rider would then not stand on.

At the ten places (150 m windows), against the capped relief:

- Float over 5 cm off the step lines: **0 m² at all ten** (max 40–46 mm).
- Poke-through, z-fight and crack: 0.
- Seams: all 79 neighbour pairs are bit-identical at LOD 0 (51,210 vertices) and LOD 1 (18,183).
- Slivers remain (920–2,160 per window). They are classified below.

### Slivers

| Class (per window) | Count | What it is |
|---|---|---|
| internal: the same layer across all three edges | 250–1,180 | a long thin triangle inside one material; nothing to see |
| edge: the same layer across a long edge | 630–1,110 | thin along a boundary; it draws as its neighbour does |
| strip: a different layer across both long edges | 3–43 | a band of its own material |
| thin strip: under 0.5 m high | 3–43 | the "torn" kind |

Splitting a sliver (round 1's six sliver rounds) only cuts it into more triangles of the same material on the same plane. It doubled the bytes and changed no colour on screen, which is why round 2 dropped it. Only a strip can show, as a band of its own material. Remnant absorption removes the strips that come from gaps between BGT polygons, down to 0.25 m. Each remaining thin strip's on-screen width in the ride frame is measured by the frames spec (`GROUND_V2_STRIPS`: the strip's height laid east and north, projected).

- 116 thin strips in the ten windows; 93 are in frame.
- 81 are under 1 px wide; they cannot be seen.
- 12 are 1–3.1 px wide. These are bands of real BGT material 0.12–0.5 m wide (a pond edge, garden and klinker strips), not gaps. The widest is the pond edge at the Piet Kranenbergpad: 0.50 m, 3.1 px.

The `ok` flag in `--places` still counts every sliver, so all ten places print FAIL on slivers alone.
