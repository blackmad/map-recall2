# Stationary camera and city-building performance, 2026-10-06

This pass reduces tile-arrival CPU work and off-camera draws while keeping ordinary facade geometry and textures intact. Building contexts use a spatial index and share an identical lookup between near and extras chunks. Results retain the previous full-scan ordering and exclusions. Chunk bounding spheres computed before CPU-buffer disposal now enable Three.js camera culling.

## Fixed-route comparison

Chrome on Apple M4 Pro / ANGLE Metal, desktop 1440×900 and emulated iPhone 13 (map DPR 1.5). Both versions start at Anne Frank House and route to Rijksmuseum; the rider remains stationary. Captures include the street, a detached camera pan, zoom 16 and diagnostic zoom 14.8. The final acceptance run also checks the actual minimum camera zoom and real mouse/touch drag input.

| Measurement | Before | After |
| --- | ---: | ---: |
| Desktop neighboring-footprint CPU, total | 621 ms | 147 ms |
| Desktop neighboring-footprint CPU, largest call | 29.5 ms | 6.2 ms |
| Desktop tile-update CPU, total | 722 ms | 292 ms |
| Desktop tile-update CPU, largest call | 231 ms | 76 ms |
| Touch neighboring-footprint CPU, total | 105 ms | 40 ms |
| Touch tile-update CPU, largest call | 85 ms | 38 ms |
| Desktop street building draws | 28 | 15 |
| Desktop detached-pan building draws | 28 | 13 |
| Desktop overview building draws | 44 | 27 |
| Desktop overview triangles | 2,817,889 | 2,652,356 |

Resident geometry and texture memory remain the same. Desktop overview holds about 233 MiB of geometry and a 97.5 MiB atlas; touch atlas is 24.375 MiB. This does not claim a memory reduction or physical-phone performance acceptance.

Baseline startup / city-ready were 7.5 / 9.3 seconds desktop and 4.5 / 6.4 seconds touch. Startup and GPU timings vary between runs; frame intervals generally remain near 16.7 ms. The desktop long-task count did not improve (15 before, 19 after), so this is a measured reduction in context work, not a claim that all startup stalls are solved. Wider visible chunks still dominate rendering. Same-scene culling off/on checks retain identical central scene pixels; raw GPU timer results are recorded without a broad FPS-speedup claim.

## Visual review and validation

Root inspected desktop and touch stationary-pan and zoomed-out renders. Ordinary surrounding shells retain windows, ground-floor doors, roof colors and open courts. Actual mouse and touch input detaches the camera without moving the rider. The pre-existing stippled overview fade is unchanged. The 14.8 diagnostic view extends beyond the normal camera minimum; zoom 16 and the minimum stage cover the user-accessible wide view.

Neighbor-index tests compare output to the old full scan at bin seams, disjoint groups, large overlapping footprints, exclusions and resident replacement. A five-tile real-data comparison (20,081 footprints) also matched output exactly: 341 ms full scan versus 41 ms indexed on Node. `npm run lint`, `npm run test:building-context`, `npm run test:building-lod`, desktop startup/route smoke and shell ownership checks pass. Real 6,298-building LOD fixture retains textured windows/doors and reduces vertices by 67.1%.

## Reproduce and evidence

Run serially, with a dev server on 4403 (or set `CITY_REVIEW_URL`):

```sh
node scripts/review-city-performance.mjs review desktop
CITY_CULLING_AB=1 CITY_GESTURE_REVIEW=1 node scripts/review-city-performance.mjs review desktop
CITY_GESTURE_REVIEW=1 node scripts/review-city-performance.mjs review touch
```

Committed summary files accompany this report. Screenshots and raw profiling arrays are in `artifacts/city-performance/2026-10-06/`, including final acceptance captures. Earlier `baseline` and `spatial-culling` runs used different random routes and are not comparable. The rejected `spatial-fixed` index queried a whole chunk rectangle and regressed CPU time; its evidence is retained. An initial strict pixel-equality check also failed on a single pixel at the slightly drifting START label; the scene comparison now allows fewer than 0.001% changed pixels and keeps the failed capture. The final index queries individual footprint bins instead.
