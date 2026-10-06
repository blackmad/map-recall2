# Batched road projection and driving-surface setup

Requested after ec6c3720, 2026-10-06. Fresh baseline at 9d93cf27 identifies a 339 ms synchronous road projection/snap-index call and a 119.5 ms surface-grid call. Constructor geometry, bounds and labels added another 37 ms in that baseline.

Projection, recentering, nearest-road index construction and driving-surface grid construction now use staged generators and an 8 ms main-thread budget. Synchronous APIs remain available and share the builders. The nearest-road tree partitions at the median instead of using an uninterruptible array sort; its source-order tie break is retained. Graph construction reuses the same budget/cancellation helper.

The loader publishes its projection offsets and matching snap index atomically only after completion. Superseded loads stop between batches. The game prepares the surface grid before creating the road network, then supplies that grid to its constructor. Surface spans keep the same points, widths, connector identities and insertion order. Reused worlds keep their existing network/index.

Fixed Anne Frank–Rijksmuseum route in Chrome/ANGLE Metal on Apple M4 Pro:

| Measurement | Before | After |
| --- | ---: | ---: |
| Desktop largest startup long task | 447 ms | 176 ms |
| Touch-emulated largest startup long task | 388 ms | 160 ms |
| Desktop boot / city ready | 6.56 / 8.24 s | 6.13 / 7.77 s |
| Touch boot / city ready | 5.07 / 6.06 s | 5.36 / 6.17 s |

This reduces blocking bursts; total startup time remains variable. Yielding may increase total setup wall time, especially with timer clamping. `loader.projection.wall` and `roads.surface.wall` in the profiler are asynchronous elapsed time and must not be presented as main-thread blocking durations. Smaller startup tasks remain, along with wider tile-arrival work outside this scope. Physical-phone timing remains unmeasured.

The real Amsterdam fixture preserves every projected segment/offset across 72,330 segments, matches 473 indexed snaps exactly to full scans, and produces the identical cell/span sequence across 147,133 driving-surface cells. Surface hash and source paths are recorded in road-setup-equivalence.json. Unit checks also preserve road tags, widths, connector order, surface classification, exact ties and cancellation at each stage. An adapter regression confirms cancelled loads retain the previous center, offsets and snap index.

Validation: TypeScript; seven startup/queue/snap/graph tests; stale look/worker tests; road projection and surface regressions; desktop route start and restarted-load progress tests. Root inspected actual desktop/touch stationary-rider pan and min-zoom views: windows, doors, roofs and open spaces remain visible, without stippling or new shader/page errors.

Evidence is in `artifacts/city-performance/2026-10-06/`: road-setup-reference, road-setup-batched, road-setup-accepted and road-setup-validation. The first road-setup-batched touch pass overlapped browser regression tests, so the serial road-setup-accepted touch pass is used for acceptance. Raw startup CPU profiles and long-task arrays are retained.
