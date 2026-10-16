# Motion stutter while riding (2026-10-16)

The user, on desktop: "the game isn't so much stuttering on loading as it's stuttering during
motion/play, feels herky-jerky". This pass measures the hitches while riding, attributes them,
fixes the top causes and records the before and after numbers. Desktop comes first; the phone
numbers are for information only.

## Method

`scripts/motion-stutter.mjs` drives the riding measurements. The configuration:

- Local Chrome, headless, `--use-angle=metal`, viewport 1280×800, seeded `Math.random`.
- Car, chase view. The rider starts at the Noorderkerk and is carried on rails at a constant
  120 px/s along road-graph legs: Westerstraat (Pianola Museum), the Tweede Leliedwarsstraat
  (Electric Ladyland), the Westerkerk, the Prinsengracht (Houseboat Museum), Rozengracht (Fatih),
  De Hallen, Kinkerstraat (P.W. Janssen), the Westermoskee and the Chassékerk.
- Rails rather than physics, so that a kerb wedge or a question card cannot stop the measurement.
  Questions still appear but no longer hold the ride.
- The camera, streaming and rendering are the game's own.
- After the ride starts there is a 10 s warm-up, then 60 s are measured. In that window the rider
  covers about 2.7 km through the Jordaan and onto Kinkerstraat, and the facade tiles, the own-ground
  cells and the landmark models stream in as the ring moves.

The script records:

- **rAF intervals**: the histogram, p50/p95/p99, frames over 50 and over 100 ms, the longest frame,
  and the stalled seconds (the sum of frames over 50 ms).
- **Long tasks.**
- **Long-animation-frame entries**, with their script entry points.
- **Wrappers around the streaming steps**: tile flush, chunk install, regroup (`setFeatures`),
  ground install, ground bases, tree rebuilds, labels and landmark requests. These give the
  main-thread milliseconds per event, and show whether each hitch overlaps a streaming event.
- **Per-render rider pose and game-loop ticks**, to check cadence.

For attribution, a V8 sampling profile (1 ms) starts on a same-origin page before navigation, so the
~1.7 s `Profiler.start` stall falls outside the window. It is aligned with `performance.now()` by a
25 ms busy-loop marker; the alignment error was under 2.2 ms. Its samples are aggregated over the
stalled frames by the innermost app frames, using unminified keep-names builds of the same source.

Each configuration was run 3 times: a cold HTTP cache, then twice warm in the same context. Columns
are no throttle and 4× CPU throttle. The machine is shared with other lanes (load average about 6),
so single runs vary.

- Before: the committed bundles at `7ca9feb8e`.
- After: this branch.
- Raw files: `artifacts/perf/motion-stutter-before.json` and `artifacts/perf/motion-stutter-after.json`.

## Findings before the fixes

- **Cadence is not the problem.** There is exactly one MapLibre render per display frame (renders per
  rAF frame 1.000–1.001 at 1×), the rider moves on every render (0 renders without a step), and the
  camera follows the rider in the game's own rAF. Nothing runs on a timer or is tied to tile arrival.
  At 4× the game loop sometimes renders twice in one display frame (1.2 renders per frame).
- **The jerk is long frames in bursts as the city streams.** All hitches at 1× and 79–91 % at 4×
  overlap a streaming event, and they cluster at cell and tile boundaries rather than at a regular
  period.
- **The rider slows visibly in a long frame.** The game clamps `dt` to 50 ms, so a 300 ms frame moves
  the rider only 50 ms worth.

Attribution inside stalled frames, as the innermost app frame (desktop, profiled run):

| cause | 1× ms in stalls | 4× ms in stalls |
|---|---|---|
| Facade chunk install in the worker reply (`install`: ground lift via `footprintBase` → `sampleAt`, three's `computeBoundingSphere`) | 55 + 103 sampleAt | 1980 + 1296 sampleAt |
| Roof planning in the tile flush (`planBuildingRoof` → `uncoveredShare`, `rectHangM`, `fitRect`) | 165 | 625+ |
| Regroup (`setFeatures` → `contextFor`/`neighbors`, tile keys; on flush and every detail-centre move) | 61 | 1694 |
| Own-ground cell install (`geometry`: per-vertex sRGB pow, bounding sphere) | – | 899 |
| MapLibre diff (`sendToSource` deep clone + worker serialisation) | 69 | ~500 |
| Legacy `_refreshColoredBuildingFilter` on landmark load | – | 511 |
| GC | 60 | 611 |

Main-thread ms per 60 s by streaming event (median of 3 runs):

| event | 1× | 4× |
|---|---|---|
| chunk install | 886 (max 105/event) | 3205 (max 490) |
| regroup (`setFeatures`) | 562 (max 61) | 2011 (max 276) |
| tile flush | 333 (max 446) | 1064 (max 606) |
| ground install | 186 (max 23) | 583 (max 101) |
| labels | 385 | 1495 |
| tree rebuilds | 113 | 382 |

Two further causes sit outside the steady window, in the first seconds of the ride:

- **Shader link waits** (three's `onFirstUse`): 580–750 ms in total, in 100–190 ms frames.
- **The tile decorator swap**: up to four swaps as shopfronts, monument gables and landmark ids
  arrive. Each swap re-planned every resident roof, resent the city to MapLibre and rebuilt every
  three.js chunk.

## Fixes (one commit each, in order)

| commit | fix | measured effect (motion window unless noted) |
|---|---|---|
| `66dc5dbb1` | **Decorator swap keeps unchanged buildings.** Roof plans are memoised per footprint and planning inputs. A restyled building that equals its old copy keeps its object, so only changed buildings go to MapLibre (`updateData`) and to the regroup. | 4×: frames over 50 ms 112 → 36 /min, stalled 14.8 → 5.1 s. 1×: 5 → 1 /min. Most of the 4× win comes from no longer rebuilding every chunk after each swap. |
| `32468dfe2` | **Chunk installs staged.** The worker reply is queued; the ground lift runs in 4 ms slices per frame, then the chunk swaps in, one install per frame. Bounding spheres are computed over plain arrays (exactly three's result). `GroundField` uses numeric tile keys. | Chunk install: 4× 2120 (max 253) → 224 (max 10) ms; 1× 556 (max 61) → 25 (max 2.5) ms. 4× hitches 36 → 20 /min. |
| `4dc3ec7a3` | **Own-ground shaders precompiled and kept.** Every layer's base, water-cut and dissolve programs are compiled when the frame first draws, with the cells' attribute set, and keeper materials hold them. | Three.js program links in the first 25 s: 94 (80 after the ride starts) → 66 (1 after). Neutral in the steady window. |
| `5b98c4fc7` | **Relief tiles decoded in a worker.** The main-thread surface's relief tiles are fetched, gunzipped and decoded in a second ground-worker instance and transferred back. | `readGroundTile`/`decodeTile`/`maybeGunzip` leave the main thread: 50–100 ms bursts before, none after in the profile. Headline neutral at that step. |
| `34ba92b81` | **Tile flush time-sliced.** Arrivals are styled 5 ms per frame before publishing. The camera clearance reads cached, already-styled buildings instead of styling the whole set on demand. The three.js regroup runs a frame after MapLibre's diff. `uncoveredShare` uses a scanline form with identical results. | Tile flush: 4× 889 (max 483) → 103 ms; 1× 262 → 27 ms. Longest frame 4× 1100 → 350 ms, 1× 333 → 67 ms. |
| `0d08e2570` | **Regroup reuses unchanged contexts.** A group's neighbour context is kept unless a building that arrived, left or was restyled lies within its bounds. Tile keys are memoised per ring. | Regroup: 4× 1173 → 587 ms; 1× 359 → 154 ms. 4× frames over 100 ms 12 → 5 /min. |
| `30f545d9e` | **Desktop motion budget in `tests/e2e/ride-perf.spec.ts`.** | Fails on the pre-fix bundles (longest 250 ms, 2 frames over 100 ms); passes now (66.7 ms, 0). |

Correctness checks:

- Every change that alters what is computed keeps it identical, and unit tests in
  `src/canalRecall/streamingPerf.test.ts` cover the memo, the bounding sphere and the scanline.
- The only behavioural change is timing. A new tile's buildings appear a few frames later (styled
  5 ms a frame), a staged chunk swaps in once lifted, and the three.js regroup lands one frame after
  the MapLibre diff.

## Before and after

All figures are the median of 3 runs, with the range in brackets.

### Desktop, no throttle

| metric | before | after |
|---|---|---|
| frame p50 ms | 16.7 | 16.7 |
| frame p95 ms | 16.8 | 16.8 |
| frame p99 ms | 16.8 | 16.8 |
| frames >50 ms per minute | 5 (4–6) | 1 (1–3) |
| frames >100 ms per minute | 2 (1–3) | 0 (0–0) |
| longest frame ms | 383 (333–600) | 67 (67–67) |
| stalled s per 60 s | 0.88 (0.62–0.90) | 0.07 (0.07–0.18) |
| long tasks per 60 s | 13 (7–16) | 2 (1–2) |
| long-task ms per 60 s | 1281 (745–1372) | 124 (70–132) |

At the 60 Hz display cadence p95 and p99 do not move: 99 % of frames already fit before. The hitch
counts and the longest frame are the visible change.

Histogram, median counts per run:

- Before: ≤17 3503, 17–33 10, 33–50 8, 50–100 3, 100–250 1, 250–500 1.
- After: ≤17 3587, 17–33 1, 33–50 2, 50–100 1.

### Desktop, 4× CPU throttle

| metric | before | after |
|---|---|---|
| frame p50 ms | 16.8 (16.7–33.3) | 16.7 |
| frame p95 ms | 66.7 (50–83) | 33.3 (16.8–33.3) |
| frame p99 ms | 150 (117–183) | 33.4 (33.4–50) |
| frames >50 ms per minute | 112 (89–119) | 16 (7–18) |
| frames >100 ms per minute | 34 (28–38) | 5 (4–5) |
| longest frame ms | 1367 (1317–2083) | 317 (283–333) |
| stalled s per 60 s | 14.5 (11.2–14.8) | 1.6 (1.0–1.9) |
| long tasks per 60 s | 66 (51–77) | 17 (13–18) |
| long-task ms per 60 s | 8924 (7423–10230) | 1523 (1210–1693) |

Histogram, median counts per run:

- Before: ≤17 787, 17–33 591, 33–50 66, 50–100 74, 100–250 28, 250–500 5, >500 2.
- After: ≤17 3154, 17–33 157, 33–50 18, 50–100 11, 100–250 4, 250–500 1.

### Start of the ride (first ~34 s after the intro, 1 cold run each)

| | before | after |
|---|---|---|
| 1×: frames over 50 / 100 ms, longest | 7 / 3, 133 ms | 0 / 0, 50 ms |
| 4×: frames over 50 / 100 ms, longest, stalled | 44 / 15, 433 ms, 5.4 s | 16 / 5, 367 ms, 1.9 s |

### iPhone 13 project, 4× throttle (information, 1 run each)

| | before | after |
|---|---|---|
| frames >50 ms per minute | 40 | 12 |
| frames >100 ms per minute | 12 | 7 |
| longest frame | 1183 ms | 217 ms |
| stalled | 6.4 s | 1.5 s |
| p95 / p99 | 33.4 / 83.3 ms | 16.8 / 33.4 ms |

## What still stalls, and why

These are from the after profile at 4×, 1.3 s in stalled frames per 60 s against 23.6 s before
(both profiled):

- **The MapLibre diff on tile arrival** (`sendToSource`, about 100 ms at 4×, 27 ms at 1×). New
  buildings are deep-cloned for the GeoJSON source and MapLibre serialises them to its worker. The
  three.js looks hide those extrusions, so a lighter source (ids and heights only), or not feeding
  MapLibre at all in the three.js looks, would remove it.
- **The chunk `rebuild` post** (about 100 ms at 4×). Every feature of a coarse chunk is
  structured-cloned to the chunk worker on each rebuild. Sending ids against a worker-side feature
  cache would avoid it.
- **The neighbour walk for genuinely new groups** (about 60 ms at 4×), once per tile.
- **Tile parsing** (`readGzippedGeoJson`, the per-feature `JSON.parse(JSON.stringify(geometry))`
  copy, `dropNestedDuplicates`), 70–140 ms at 4× per tile. It is a candidate for the building-tiles
  worker.
- **Labels** (the POI overlay plan, about 0.9 s per 60 s at 4×) and inventory-tree rebuilds when the
  ground bases refresh (about 0.3 s per 60 s at 4×). These are steady costs, not bursts.
- **Legacy `_refreshColoredBuildingFilter`** when a landmark model loads (0.5 s at 4× before). It
  rebuilds every colour-layer filter and the signature hide list. It is not touched here because it
  is legacy `vector-map.js`.
- **The `dt` clamp** (50 ms in `game.js` `_loop`) still makes the rider visibly slow down during any
  remaining long frame.
- **The phone is not measured on a real device.** These numbers are emulated (Chromium, iPhone 13
  viewport, 4× CPU).
