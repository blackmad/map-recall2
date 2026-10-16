# Pop-in while riding (2026-10-16)

The user: "there's a lot of pop-in in the game, is that something we can improve without harming perf?"
This pass measures pop-in on scripted rides, attributes it to the streaming step that changed, fixes the
top sources and checks the desktop frame budget. Desktop first.

## Method: `scripts/pop-in.mjs`

The script drives a ride and measures every rendered frame.

- **Rides.**
  - The car ride is the motion-stutter route: Noorderkerk to the Westermoskee via the Jordaan and
    Kinkerstraat, in chase view, on rails at 120 px/s (`--speed 200` for a fast ride).
  - The boat ride goes from the Westerkerk to the Amstel Hotel.
  - Both run in headless Chrome (Metal) at 1280×800 with seeded randomness.
  - `--net latency,Mbit/s` sets a player's connection; localhost serves every tile at once.
  - `--cpu N` sets a slower machine through CDP CPU throttling.
  - `--no-intro`, `--warmup` and `--measure` choose the measured window.
- **Capture.** The WebGL canvas is copied (640×400) after every `map._render`. A page worker compares
  the frame with the previous one.
- **Camera cancellation.** Block motion vectors are matched on luma and a RANSAC homography is fitted,
  which models the camera's motion over the ground plane. A pixel counts as residual when no pixel
  within ±2 px of the warped previous frame is within ΔE76 20, and the same-position test fails too
  (that test covers the rider, which is fixed on screen). After a 3×3 opening, blobs of at least 8×8
  screen px count as pop-in.
- **Frames not judged.**
  - Hitches: the frame interval is over 50 ms.
  - Turns: the camera turned more than 2°, tilted more than 1° or zoomed more than 0.02 in one frame.
    The plane model cannot cancel the parallax of a tall scene.
  - Neither kind is kept as a strip. Both are reported separately.
- **Attribution.** Each judged frame is charged to the streaming steps hooked between the previous
  capture and this one:
  - own-ground cell, LOD, far block and overlays;
  - facade chunk (coarse and detail);
  - tile flush and regroup;
  - landmark and street-chunk models, and landmark LOD;
  - trees;
  - basemap tiles.

  A frame with no step is "unexplained" (mostly tall-tower parallax).
- **Calibration** (`--calibrate`). Toggling the trees finds about 25k px, and toggling the buildings
  finds 145k–329k px. Steady frames are near zero.
- **Outputs.**
  - Pop-in in px per second, overall and per source.
  - Own-ground cell latency (request to install) and heap.
  - Network bytes and requests.
  - Strips of the worst frames (previous | current | residual in magenta).
  - `--shots`: a contact sheet of whole frames at fixed seconds.
  - `--flags K=V` turns each fix off for an A/B.

The machine was shared with up to eight lanes, at load 10–160. Every number below was taken under the
shared browser lock (`/tmp/canal-pw.sh`). Each run records `uptime`. Numbers taken under load were
redone.

## What popped in (before)

The top sources were these, with the frames that show each:

1. **The start of a ride is an empty city.** The basemap extrusion hid at the first streamed building
   tile. The three.js coarse shells build 1–4 s later in the worker, one at a time. The ride therefore
   started on empty ground, and then whole z14 districts appeared at once:
   - `artifacts/pop-in/shots2/off2/car-run0-shots.png`: empty from 0.3 to 1.5 s;
   - `artifacts/pop-in/start1/off2/car-run0-00-f230-150988px.png`: 150k px in one frame.

   On a loaded machine (load 105) the start measured 29.8k px/s, mostly buildings-chunk.
2. **Streaming falls behind at speed.** At 200 px/s on a 60 ms / 40 Mbit/s connection under load:
   - a whole coarse chunk popped in around the rider (320k px);
   - landmarks appeared on empty ground (287k px);
   - basemap roads and water arrived late on bare beige (211k px).

   The base car-steady run totalled 25.4k px/s:

   | source | px/s |
   |---|---|
   | basemap-tile | 8.7k |
   | landmark-model | 5.5k |
   | buildings-coarse | 5.2k |

   Own-ground cells were built FIFO, including cells the rider had already left. Their latency was 7.9 s
   median and 18.9 s worst.
3. **Coarse-to-detail swaps in view.** The 2×2 detail block was centred on the rider and flipped at a
   hard tile midline. Tiles ahead turned detailed only about 190 m before the rider reached them, and
   tiles that left the block dropped back to coarse while still on screen. Each swap happened in one
   frame.
4. **Intro landing.** Pop-in at landing is dominated by the overview-to-city ground blend and the
   landmark LODs during the descent. It is not addressed here.
5. **A crash, not pop-in.** On the boat ride a houseboat chunk froze the game: highlight passes read
   positions three.js had already released. This is fixed in `bef643cdb`.

## Fixes (each on by default, each with an off switch)

| commit | fix | off switch |
|---|---|---|
| `35e77cf11` | Streaming look-ahead (`streamingLookAhead.ts`). EMA motion of the rider, look-ahead points 5–12 s ahead. Building tiles under them load after the view's tiles and are kept while still ahead. Facade chunk builds go nearest-ahead first; a missing coarse shell beats detail by about 400 m. The ground worker queue replaces stale requests, takes the residency pass's ahead-first order and drops cells it no longer wants. The detail block leads 110 m, uses hysteresis at the midline and lets a tile linger within 160 m. | `?lookAhead=0` / `__canalRecallLookAhead=false` |
| `b2e717abd` | The basemap's extrusion stays until the coarse shells under the screen's bottom corners and centre line draw (8 s cap), then hands over once. It is a hard swap, because fading the extrusion was measured worse (its depth hid the shells for the whole fade). | `__canalRecallHoldBasemap=false` |
| `afe9f2636` | Arriving facade chunks dissolve in over 350 ms (the overview's screen-door dither, on a per-chunk material clone that shares the program). Detail keeps the coarse shells drawn until its dissolve ends. | `?chunkFade=0` / `__canalRecallChunkFade=false` |

## Results

All rides are the car route at 200 px/s on a 60 ms / 40 Mbit/s connection. The tables give px/s of
pop-in in judged frames, as means over runs. "Attributed" excludes the unexplained residue.

### Loaded machine, start of a ride (before the merge with main; 25 s from the first frame, no intro)

Two runs per side, `artifacts/pop-in/start1`, load 13–164 (runs at load over 100 are counted with that
caveat).

| source | fixes off | fixes on |
|---|---|---|
| buildings-chunk | 14,429 | 593 |
| basemap-tile | 629 | 481 |
| buildings-coarse, rebase, overlays, trees | 88 | 2,084 (one coarse install frame) |
| ground-cell | 28 | 27 |
| **attributed total** | **15,179** | **3,193** |
| own-ground cell latency, median | 8.6 s | 3.3 s |

### Light load (main `565f0ec5a` merged, load under 20, 2 runs per side)

**Start of a ride** (CPU ×2, 12 s, `artifacts/pop-in/m-shots`):

| source | fixes off | fixes on |
|---|---|---|
| buildings-chunk | 1,072 | 217 |
| basemap-tile | 39 | 3,817 (the one-frame basemap-to-shell handover, run 2 only) |
| trees, rebase, overlays, coarse | 105 | 10 |
| ground-cell | 36 | 0 |
| **attributed total** | **1,251** | **4,043** |
| own-ground cell latency, median | 7.5 s | 7.1 s |

The metric does not judge the frame in which the fixes-off city arrives: the city arrives all at once
in a hitch frame (35–39 hitches per run). The contact sheets show the difference:

- `artifacts/pop-in/m-shots/off2/car-run0-shots.png`: empty ground at 0.3 s, then the whole city at
  0.6 s.
- `artifacts/pop-in/m-shots/on2/car-run0-shots.png`: basemap silhouettes, then a single swap to the
  textured shells, shown in `on2/car-run0-00-f21-90152px.png`.

On a loaded machine, without the fixes, the empty city lasted 1.5–4 s (`shots2/off2`, `start1/off2`).

**Steady ride** (60 s after 10 s, `artifacts/pop-in/m-steady`):

| source | fixes off | fixes on |
|---|---|---|
| basemap-tile | 264 | 221 |
| buildings-chunk | 124 | 219 |
| regroup | 5 | 34 |
| landmark and street-chunk models | 8 | 11 |
| **attributed total** | **405** | **486** |
| unexplained | 948 | 787 |
| own-ground cell latency, median | 934 ms | 820 ms |

At light load the steady ride has little pop-in left either way, and the difference is within the
run-to-run spread. The fixes pay off when streaming falls behind (a loaded or slower machine, or the
start of a ride). There they keep the city around the rider drawn.

### Network and memory (steady ride, end of 60 s)

- Bytes and requests do not go up: fixes off 26.4–28.1 MB in 688–740 requests, fixes on
  23.2–26.5 MB in 618–671 requests.
- Building tiles held go from 4 to 8: the look-ahead tiles, kept while still ahead and within the
  12-tile budget.
- Facade chunks go from 28 to 41, and facade geometry from 140 to 200 MB.
- The JS heap at the end is dominated by when GC last ran (off 828–1745 MB, on 928–1879 MB), so it is
  reported but not compared.

### Frame cost (desktop, `tests/e2e/ride-perf.spec.ts`, `POPIN_FLAGS` for the off runs, 2 runs each)

| | fixes off | fixes on |
|---|---|---|
| motion: frames over 50 ms | 3, 2 | 1, 0 |
| motion: frames over 100 ms | 0, 0 | 0, 0 |
| motion: longest frame | 66.7, 83.3 ms | 50.1, 33.4 ms |
| motion: p95 | 16.8, 16.7 ms | 16.7, 16.7 ms |
| ride: map render median / p95 | 2.3–2.7 / 3.4–3.9 ms | 2.2–2.8 / 3.2–4.0 ms |
| ride: three.js layers median / p95 | 0.8–0.9 / 1.2–1.4 ms | 0.8–1.1 / 1.2–1.5 ms |

All runs pass the motion budget (longest ≤ 200 ms, at most one frame over 100 ms) and the desktop
ride budget.

### The budget test

`tests/e2e/pop-in.spec.ts` (`PERF_POPIN=1 PW_PORT=… npx playwright test pop-in --project=desktop`)
runs the steady ride and checks three things:

- attributed pop-in ≤ 1000 px/s;
- own-ground cell latency median ≤ 1500 ms;
- no page errors.

First run: 318 px/s attributed and 710 ms.

## What remains

- **Intro landing.** The overview-to-city ground blend and the landmark LOD swaps during the descent
  dominate the intro (28k px/s before). They are not addressed here.
- **Basemap tiles.** Roads and water arriving late on a slow connection are MapLibre's own tile
  loading; its prefetch is not steered by the look-ahead.
- **Landmark models.** Models load within the view plus about 280 m, with two pending at once. At speed
  they still appear in view. A look-ahead residency pad would follow the same pattern as the building
  tiles.
- **The handover is a hard swap.** It replaces silhouettes with shells in one frame. A dissolve would
  have to hide the basemap extrusion per building (its depth occludes the shells), which is not done.
- **Detail leaving.** A detail tile that leaves the block, after it has lingered, still drops to coarse
  in one frame. It is behind or beside the rider by then.
- **Memory.** Look-ahead keeps up to about 4 more z14 tiles (about +60 MB of facade geometry on this
  ride). A turn-aware look-ahead that follows the route rather than the heading would load fewer tiles
  the ride never reaches.
- **The metric's blind spots.** Pops inside hitch frames (over 50 ms) and during sharp turns are not
  judged. Tall-tower parallax shows up as "unexplained". CPU ×4 now makes most frames hitches on main,
  so the slow-machine mode is not usable as is.
