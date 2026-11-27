# Hidden buildings skipped in the baked cells; `onViewChange` at 10 Hz (2026-11-27)

Lane cell-hidden-skip, from the "Triangles and draws by layer" table in `desktop-power-20261127.md` (lane
landmark-residency): 44–56 % of the vertices of the baked coarse cells under the rider belong to buildings the detail
chunks replace. The vertex shader collapsed them (`hidden == 1`, look/cityLook.ts VERTEX_HIDE) but every one was
submitted every frame.

## What changed

| change | off-switch | tests |
|---|---|---|
| **Baked cells skip hidden buildings.** The world worker lists each cell index's building runs (`world/bakedCellArrays.ts indexRuns`; a SHEL draws a building in ~2 runs, walls then roof). The cell keeps its index on the CPU as a permutation of those runs (`engine/cellSkip.ts HiddenRunSkip`): drawn runs first, in their original order, hidden runs after; the draw range ends at the drawn runs. It is synced from the `hidden` bytes in the cell mesh's `onBeforeRender`, so exactly what the shader would collapse on that draw is skipped: through a swap's complementary dissolve the coarse copy stays `drawn` (its swap slot yields) and is drawn, and it is skipped from the draw after the dissolve ends. A change rewrites the index from the first changed run and uploads only the drawn part of that tail. | `?cellSkip=0`, `window.__canalRecallCellSkip=false` (index released after upload, as before); live: `vm._bakedCoarse.setCellSkipLive(false)` | `engine/cellSkip.test.ts` (runs; permutation vs drawing all and collapsing, 5 seeds × 60 random hide/show steps, the GPU buffer updated only over the reported range; MIXED runs never skipped; only `HIDDEN.hide` skipped; BakedCoarse wiring and the live switch; 205 k-triangle cell cost; the compiled SHELs have no triangle across two buildings) |
| **`onViewChange` at most 10 a second** while the view moves (`engine/worldCameraOf.ts`): the first change runs at once, the last always runs (the next frame past the interval, or a timer when the view stops); the view is compared as numbers, no key string a frame. Its callers (landmarks' evict/request/levels, the building streamer's re-plan, the Artis animals) only ask for loads and levels that arrive later. | `?viewChangeHz=0` (every changed frame, as before), `?viewChangeHz=<n>`; live: `window.__canalRecallViewChangeHz` | `engine/worldCameraOf.test.ts` (rate over a 60 fps second, the trailing call by timer, a redraw does nothing, hz 0) |

CPU cost: the CPU index copies are 9–13 MB on the belt ride (`skipStats().cpuIndexMB`, 8 cells resident).

## Measured

Belt ride (Waag → Westerkerk, chase, 9 m/s), 1512×900 at dpr 2, headless Chrome on Metal (M4 Pro), dev server on this
worktree. "off" = `?cellSkip=0&viewChangeHz=0` (the code before, exactly).

### Triangles and draws by layer (`scripts/perf/layer-tris.mjs`, n = 2 an arm, normal slot)

Rider stopped at each pose, 3 s settle, 30 forced frames; ride = the mean over the whole moving ride. Thousands of
triangles a frame / draws a frame; both runs of each arm agreed to ±1 k on the poses (the totals differ by ≤ 60 k from
landmark arrivals).

| | ride mean | pose 24 s (216 m) | pose 36 s (324 m) | pose 48 s (433 m) |
|---|---|---|---|---|
| total, off | 2,388 / 279 · 2,373 / 278 | 1,950 / 270 · 1,950 / 270 | 2,653 / 263 · 2,610 / 260 | 2,592 / 234 · 2,532 / 231 |
| total, on | **2,207 / 279 · 2,162 / 275** | **1,743 / 270 · 1,743 / 270** | **2,478 / 264 · 2,418 / 260** | **2,436 / 235 · 2,338 / 231** |
| baked cells, off | 792 · 794 | 675 | 1,135 | 1,135 |
| baked cells, on | 612 · 613 | 468 | 942 | 942 |
| — cells under the rider (0–150 m), off | 470 · 473 | 371 | 675 | 573 |
| — cells under the rider (0–150 m), on | 306 · 307 | 197 | 482 | 385 |

−180 k triangles a frame on the ride (−7.6 %), −207 / −193 / −188 k at the poses; the off arm reproduces the
landmark-residency table exactly (675 / 1,135 / 1,135 k baked; 371 / 675 / 573 k under the rider). Draws unchanged.

### Frames: the same frame drawn twice (`scripts/perf/cell-skip-ab.mjs`, n = 2)

At each pose and mid-swap the page draws one frame skipping and the same frame with every triangle
(`setCellSkipLive`), the clock frozen across both, and compares the drawing buffers (3024×1800).

| | run 1 | run 2 |
|---|---|---|
| settled 24 / 36 / 48 s: differing px (max channel Δ) | 0 / 0 / 0 (0) | 0 / 0 / 0 (0) |
| triangles skipped in those frames | 207 k / 194 k / 193 k | 207 k / 194 k / 193 k |
| mid-swap (detail chunks dissolving over the shells): differing px | 0 (1 swapping, 195 m), 0 (4 swapping, 259 m) | 0 (197 m), 0 (258 m) |

`swap-zfight` (s3-slab, the detail chunk evicted and dissolving back in over the shell, 24 held steps): the per-step
ΔE>20 areas of the swap pan are **identical** with `?cellSkip=0&viewChangeHz=0` and with the default
(`[0,0,0,0,9,5,1,0,6,3,7,7,5,1,3,0,11,9,0,4,6,10,7,4]`, excess 98 px, shell yield 0.479 in both).

### Swap cost (main thread, `skipStats`, the belt ride, n = 2)

| | run 1 | run 2 |
|---|---|---|
| index rewrites | 216 | 222 |
| ms per rewrite, mean | 0.20 | 0.18 |
| max | 6.4 (one, load 15) | 1.0 |
| over 1 ms / over 4 ms | — | 0 / 0 |
| index bytes uploaded over the ride | 253 MB | 258 MB |

The upload is the drawn tail after the first changed run, ~1.2 MB a rewrite, ~5 MB/s while riding.

### Desktop power (`scripts/perf/desktop-power.mjs`, 20 s warm, 60 s measured, 60 fps cap, exclusive timing slot)

Two machine states: runs 1–2 of each arm (load 11–30) had the Apple GPU busy with other work (GPU p50 31–35 ms a frame,
86–93 % utilisation, ~52 fps): not comparable to the quiet runs and not used for GPU numbers. Quiet runs:

| | off 2 | off 3 | on 3 | on 4 |
|---|---|---|---|---|
| drawn frames / s | 59.9 | 60.0 | 60.0 | 60.0 |
| CPU, all processes (cores) | 1.294 | 1.300 | 1.278 | 1.286 |
| main thread busy | 24.6 % | 24.5 % | **23.2 %** | **23.2 %** |
| `onViewChange` listener (ms/s) | 18.3 | 17.3 | **3.1** | **3.2** |
| GPU / drawn frame p50 | 5.16 ms | 5.09 ms | **5.00 ms** | **4.98 ms** |
| GPU ms / s | 316 | 308 | 309 | 307 |
| triangles / drawn frame | 2.47 M | 2.48 M | **2.30 M** | **2.30 M** |
| draws / drawn frame | 301 | 302 | 299 | 299 |
| load (start, end) | 66, 36 | 26, 13 | 23, 22 | 10, 8 |

In the busy-GPU runs the listener read 24.6 ms/s off against 4.0–4.3 on.

### GPU time of the same frame (`cell-skip-ab.mjs` `__gpuAB`, exclusive slot)

At each settled pose: one frame redrawn in alternating blocks of 10 (skipping / every triangle; the first 3 draws after
each switch untimed, where the switch's own index upload lands), `EXT_disjoint_timer_query_webgl2` around each timed
redraw, medians of 56 a mode; no index rewrite or upload fell inside a timed draw (`timedSyncs` 0).

| pose | on | off | change |
|---|---|---|---|
| 24 s (207 k skipped) | 4.57 ms | 4.72 ms | −3.1 % |
| 36 s (194 k skipped) | 5.18 ms | 5.38 ms | −3.7 % |
| 48 s (193 k skipped), alone | 5.00 ms | 5.19 ms | −3.6 % |

The 48 s pose read +16 % and +36 % in the two runs that measured it last after the other poses, with landmark arrivals
still landing (the block design does not protect against work arriving in one block); taken alone it agrees with the
others. The 6-window in-page ride A/Bs of `desktop-power.mjs` (`--ab-on/--ab-off`, four runs: both switches, skip only,
rate only) could not resolve 3 %: per-window GPU ms a frame ranged 4.2–6.4 with the position on the ping-pong rails, and
every run read the "on" windows higher in CPU by 0.07–0.4 cores including the rate-only run, which cannot cost CPU: a
position bias of the window order, not a measurement of either change. Their main-thread reading for the rate alone:
22.4 % on against 24.7 % off.

## What is left

- The GPU saving is small next to the triangle saving: a collapsed vertex was already cheap (shaded, then clipped
  before rasterisation), so −7.6 % triangles is −3 to −4 % GPU per frame (and −2 % on the ride's p50). The frame is not as triangle-bound as the
  triangle count suggested; the remaining 2.3 M a frame should be costed by GPU time per layer before the next cut.
- `swap-zfight` still fails its last gate (ΔE>20 excess on the slab during the swap: 77–98 px over 24 steps, ≤ 11 px a
  step, the same with the skip off): pre-existing, not this lane's.
- The index upload (~5 MB/s while riding) could shrink by deferring hide-only changes (a hidden building is collapsed by
  the shader anyway) and batching them; shows must stay immediate.

## Commands

```
PORT=<port> /tmp/canal-pw.sh node scripts/perf/layer-tris.mjs out.json --poses 24,36,48 --frames 30 [--qs 'cellSkip=0&viewChangeHz=0']
PORT=<port> /tmp/canal-pw.sh node scripts/perf/cell-skip-ab.mjs out.json --swaps 12 --shots <dir> [--gpu-n 60]
PORT=<port> CANAL_PW_TIMING=1 /tmp/canal-pw.sh node scripts/perf/desktop-power.mjs out.json --warm 20 --ride 60 [--qs 'cellSkip=0&viewChangeHz=0']
PW_PORT=<port> ZFIGHT_REPORT_ONLY=1 [ZFIGHT_QS='cellSkip=0&viewChangeHz=0'] /tmp/canal-pw.sh npx playwright test tests/e2e/swap-zfight.spec.ts --project=desktop --workers=1
```
