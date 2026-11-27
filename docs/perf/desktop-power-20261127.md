# Desktop power: the Mac fan under the own engine (2026-11-27)

Question 5 of the engine round: "Desktop performance isn't good enough, and the game runs my Mac fan." David's
settings: dpr 2, a 120 Hz ProMotion screen, default quality, own engine. A fan is a power question, so the numbers
here are work per **second** (CPU seconds per second across Chrome's processes, GPU milliseconds per second), not only
frame time.

## How it was measured

`scripts/perf/desktop-power.mjs` (new). Headless Chrome on the Mac's GPU (ANGLE Metal, Apple M4 Pro), viewport
1512×900 at dpr 2 (canvas 3024×1800, MSAA on, tier `high`), the ride on rails along the race route Geldersekade ↔
Nieuwmarkt at a steady speed (tier-ride.mjs), 20 s warm-up, then 60 s measured.

- **120 Hz**: Chrome runs uncapped (`--disable-frame-rate-limit --disable-gpu-vsync`) and the page's rAF is a 120 Hz
  clock on timers. (A pump on native rAF read ~45 fps: Chrome's uncapped BeginFrames fall back to 60 Hz after a frame
  without damage.) The harness only reaches ~87–100 fps uncapped, so every "uncapped" cost below is a **lower bound**
  on David's real 120 Hz screen.
- **CPU**: `SystemInfo.getProcessInfo` CPU time per process type (renderer = main thread + workers + V8 GC threads +
  compositor; GPU = Chrome's GPU process). Main-thread busy from CDP `Performance` TaskDuration.
- **GPU**: `EXT_disjoint_timer_query_webgl2` around `FrameHost._render` (GPU ms per drawn frame and per second), and the
  Apple GPU's `Device Utilization %` from ioreg (machine-wide, so only indicative on this shared machine).
- **In-page A/B** (`--ab-on/--ab-off`, 6 s windows, the first second after each switch dropped, medians of 6 windows a
  mode): both modes ride the same page at the same time, so other lanes' load lands on both. The machine's load average
  was 17–80 throughout (five landmark lanes and an iOS simulator); single-run absolute numbers vary by ±20 %, the A/B
  deltas are the trustworthy ones.
- Owners: `?framePhases=1`, a sampled CPU profile (`--profile`), a 5 s Chrome trace split by thread (`--trace`), V8's
  sampling heap profiler (`--alloc`), and worker traffic by message kind.

Floor: the harness alone (blank page, same flags) costs 0.03 CPU s/s.

## The table (before)

Uncapped ("120 Hz"), two runs, load 26–137:

| | run 1 | run 2 |
|---|---|---|
| drawn frames / s | 92 | 95 |
| rAF interval p50 / p95 / p99 | 10.1 / 16.6 / 21.7 ms | 9.7 / 16.8 / 21.1 ms |
| main thread busy | 64 % | 61 % |
| CPU, all processes | **3.24 cores** | 2.96 cores |
| — renderer (main + workers + GC) | 2.67 | 2.37 |
| — GPU process | 0.50 | 0.55 |
| GPU time / drawn frame p50 / p95 | 5.3 / 7.0 ms | 5.2 / 7.5 ms |
| GPU time / s | **491 ms** | 506 ms |
| draw calls / frame | 282 | 269 |
| triangles / frame | 2.27 M | 2.08 M |
| texture memory (tracked from page start) | 160 MB (43 textures) | 186 MB |
| three.js resident | 458 geometries, 39 textures, 44 programs | 472 / 41 / 42 |
| JS heap after forced GC, ride start → end | 458 → 506 MB | 434 → 449 MB |
| stopped (rider at rest, 15 s) | 2.6 frames/s, 0.51 CPU s/s | 0.71 CPU s/s |

At 120 drawn frames a second (the real screen) the same per-frame costs come to ~95 % of the main thread and ~640 ms of
GPU a second: the ride kept both the CPU and the GPU close to saturated, which is the fan.

### The 1,069 MB heap reading

It is garbage, not resident data. Sampled every 10 s during a ride the heap swings 430 → 1,170 → 558 MB; after a forced
GC it is 425–506 MB at ride start and end, with no growth over 60 s. The ride allocates **~84 MB/s** at 60 fps (V8
sampling heap profiler, `C-alloc`), so any reading between collections sits several hundred MB above the live set.
No cache was seen growing inside a minute; a long-ride (10 min+) post-GC series is still to do.

## Owners, ranked from the trace and profiles

1. **The frame rate itself.** Every drawn frame costs ~6–8.5 ms of main thread and ~5.3–6 ms of GPU; the own engine drew
   every frame the display gave (`renderOnChange` skips only frames where nothing moved, and while riding the camera moves
   every frame). On 120 Hz that doubles everything relative to 60.
2. **Off-main renderer CPU, ~1.4 cores at 60 fps** (renderer CPU minus main thread). From the 5 s trace:
   - V8 GC background threads (marking, scavenging, sweeping) ~10–25 % of a core, plus main-thread GC 5–11 ms/s:
     the 84 MB/s allocation rate. Top allocators: three.js internals (`getY`, bounds) ~20 MB/s, own-ground height
     lookups (`heightRd`/`ground`/`footprintBase` from `applyGroundLift` on chunk installs) ~17 MB/s, `contactsInto`
     (road guard + the HUD plaque's nearest road, every frame) ~5 MB/s, landmark updates.
   - The three-buildings worker pool ~17 % of a core: 178–415 shadow stand-in welds a minute
     (`signature-landmarks-source.js _attachShadowStandIn`: a level is welded again every time a landmark level is
     disposed and re-imported) and 30–78 chunk jobs a minute (every key asked had been asked before: evict/rebuild as
     the rails ping-pong; a forward ride evicts less).
3. **Main thread per frame (~6–8 ms at 60 fps)**, `?framePhases=1` ms per second at ~60 fps: three render main 98–138
   (of which the shadow map 13–17), game frame 48–77, world matrices 17–23, `onViewChange` listener 15–19 (signature
   landmarks' `_onMove` runs its "moveend" work every frame because the view changes every frame), far shells 10–14,
   labels 7–10, overlay render 6–9, landmarks beforeRender 6–8.
4. **GPU ~5.3–6 ms a frame, not fill-bound.** 2.1–2.5 M triangles and ~280 draws a frame. Lowering the internal
   resolution did nothing for it (below).

## What changed

**The ride draws at most 60 frames a second** (`src/canalRecall/engine/frameCap.ts`, `FrameHost.maxFps`). A credit clock
skips whole animation frames (no simulation step, no game frame, no render); the fixed 1/120 s physics steps catch up on
the next run, so the ride keeps real time. 120 Hz runs an even every-other frame, 90 Hz alternates one and two (60 on
average, not 45), 60 Hz and slower displays are untouched. The aerial 30 fps pacing (aerialPower.ts) composes with it.

- Off-switches: `?fpsCap=0` (or `?fpsCap=<n>` for another cap), and a player setting, **Settings → Comfort → "Full
  frame rate"** ("Smoother on 120 Hz screens; uses more power"), off by default (`preferences.fullFrameRate`,
  `window.__canalRecallFpsCap`, applied at once).
- Look: no frame changes; only how many are drawn. No still before/after pair is meaningful; the trade is motion
  smoothness on 120 Hz screens, which is why it is a setting.
- Tests: `src/canalRecall/engine/frameCap.test.ts` (120/90/144/60/30 Hz rates, run/skip alternation, stalls, query vs
  setting precedence, FrameHost skips whole frames and keeps fixed steps in real time), `tests/e2e/frame-cap.spec.ts`
  (60 by default, the setting turns it off live, `?fpsCap=0`).

Measured, in-page A/B on one page (`C-ab-cap`, 6 windows a mode, load 23–29):

| | uncapped | capped 60 | change |
|---|---|---|---|
| drawn frames / s | 86.8 | 59.2 | |
| CPU, all processes | 2.96 cores | 2.40 cores | **−19 %** |
| — GPU process | 0.52 | 0.33 | −37 % |
| main thread busy | 68 % | 50 % | −18 pts |
| GPU time / s | 489 ms | 348 ms | **−29 %** |

Sequential runs agreed (A-base/A-cap0 vs A-cap60, quiet run: 3.24 → 2.22 cores, 491 → 346 GPU ms/s). Because the
harness only reached ~87 fps uncapped, the saving on a real 120 Hz screen is larger: by the per-frame costs, ~half of the
frame-proportional work (≈ −0.3 GPU s/s and ≈ −0.5 main-thread s/s against 120 fps).

## Evaluated and not changed

| lever | result | verdict |
|---|---|---|
| lower internal resolution (dpr 2 → 1.5, `C-ab-dpr15`, on top of the cap) | GPU 5.87 vs 5.87 ms/frame, 347 vs 352 ms/s; main 37 vs 39 % | **no win on the M4 Pro**: the frame is triangle/draw-bound, not fill-bound. Not shipped; the tier's existing `mid` cap (1.5) stays the answer for weak GPUs. |
| sun shadows off (`C-ab-shadows`) | GPU 341 vs 312 ms/s (noise), main 32 vs 38 % | ≤ 6 % main thread, nothing on the GPU; shadows are a big part of the look. Not changed. |
| skip re-renders when nothing changed (stopped, menus) | already done: `renderOnChange` draws 2.3–2.6 frames/s at rest, 0.26–0.5 CPU s/s | nothing to do |
| MSAA off | not measured live (needs a reload) | the frame is not fill-bound, so little to expect; MSAA's 4× framebuffer is ~175 MB of GPU memory at 3024×1800, a memory question rather than power |

## Follow-up round (same day): allocation churn, landmark churn, static subtrees

The coordinator kept the cap and asked for three of the "what is left" items, each with an in-page A/B (CPU cores, GPU
ms/s, GC ms/s, allocation MB/s; `desktop-power.mjs --ab-on/--ab-off` now reports `allocMbPerS`, `gcMsPerS` and
`weldsPerMin` per window) and an off-switch. The machine stayed contended throughout (load 7–750, iOS simulators, other
lanes' browsers; in two runs the Apple GPU sat at 90–94 % from other work, so GPU ms/s in those runs is not usable).
Read the A/B deltas, not the absolutes.

### 1. Allocation churn (landed, 02a4ec62a8)

| change | off-switch | test |
|---|---|---|
| `contactsInto` without `Math.hypot` (`hypot2.ts`, bit-identical; the builtin is not inlined and boxes ~48 B a call), and a per-frame memo of span lookups / nearest contacts (`RoadQueryScratch`) | `?roadMemo=0` | `hypot2.test.ts` (1 M pairs, `Object.is`), `roadSurfaceScratch.test.ts` (memo, and < 20 B a span once warm: fails with `Math.hypot`) |
| own-ground `surface/relief/heightRd`: scratch RD output, coverage edge without arrays | always (bit-identical) | `placementAlloc.test.ts` (old vs new, 5,000 points over holes) |
| `footprintBase` / `frontBase` without arrays or closures; `gameGround` memoises a footprint's base per ring until a ground tile it reads (one sample wider) changes (`GroundField.version` / `changedSince`) | `?baseMemo=0` | `placementAlloc.test.ts` (2,000 random footprints bit-identical; `changedSince` edges) |
| landmark bounds read the typed array directly (`rendererShared/fastBounds.ts`, bit-identical to three's `computeBoundingBox/Sphere`, filled before the first frustum test); stand-in position copies the same way | `?fastBounds=0` | `fastBounds.test.ts` (float32, normalised int8/16, uint8/16, interleaved, against three itself) |

The "bounding sphere recomputed every frame" was not one geometry losing its sphere: every landmark level that arrived
or swapped had its bounds computed lazily through `getY` → `denormalize` on quantised int16 GLBs, which boxes every
coordinate. With ~4–8 level arrivals a second on the ride, three's `getY`/bounds were the top allocator (~15 MB/s).

| | before (E-before) | memo on (E2-ab) | memo off (E2-ab) | item 1 + 2 on (F-ab) | item 1 memos on, item 2 off (F-ab) |
|---|---|---|---|---|---|
| allocation | 84.3 MB/s | 71.2 | 75.7 | **32.8** | 44.7 |
| GC (main thread) | 9.6 ms/s | 13.8 | 13.5 | 8.8 | 11.5 |
| main thread busy | 39 % | 33 % | 38 % | (GPU-starved run) | |
| CPU, all processes | 1.97 cores | 1.87 | — | 1.94 | 3.6 (noisy) |

`contactsInto`, `heightRd`, `footprintBase` and three's `getY` left the top of the heap profile. **The < 20 MB/s target is
not reached**: what remains is spread thin — three's uniform upload (`setValueM4` and friends, 4–7 MB/s: a fresh
array per matrix uniform per draw), `withOpeningsTimed`'s `some` (1.8), `_updateLandmarks` (1.4–1.9), and boxing of
doubles at non-inlined call boundaries across the game frame (~45 B a call; not fixable piecemeal).

### 2. Landmark churn (landed)

| change | off-switch | test |
|---|---|---|
| **Stand-in LRU**: a welded shadow stand-in is kept (32 MB budget, least recently used out) keyed by model id and level, validated by a signature of its parts (per-side counts and world matrices); a level that returns assembles synchronously and posts nothing to the worker | `?standInCache=0`, `?standInCacheMB=<n>` | `shadowStandIns.test.ts` (hit byte-identical to a fresh weld, no post, a moved part misses; LRU budget) |
| **Level hysteresis**: a level upgrade swaps at once, a downgrade only after the wanted level has been lower for 4 s | `?levelDwell=0`, `?levelDwellMs=<n>` | `levelDwell.test.ts` |
| **Evict what the ride is leaving first**: among off-view models, those behind the heading go before those ahead, then furthest first | `?landmarkCooldown=0` (restores the old furthest-first order and no cool-down together) | `landmarkResidency.test.ts` |
| **Re-arrival cool-down**: a model given back is not asked for again for 30 s unless it is on screen (its bounding sphere in the frustum, 10 % margin) | `?landmarkCooldown=0`, `?landmarkCooldownS=<n>` | `landmarkResidency.test.ts` (`coolingDown`, `sphereOnScreen`) |

Welds (worker posts of stand-in jobs) — the worker cost the brief asked about:

| | off | on |
|---|---|---|
| stand-in posts per run (F, 2 runs) | 233, 209 | 7, 6 |
| welds / min, in-page A/B windows (F-ab) | 277.5 | **43.8** |
| stand-in posts per 40 s ride (K-ride, cache on in both) | 6 | 6 |

Worker CPU itself could not be attributed cleanly: in 10 s lean traces the three-buildings pool is dominated by
chunk-build jobs, and the pool read 12–27 % of a core off vs 16–34 % on across four traces (contended machine; chunk
jobs vary with the rails' ping-pong). Weld posts are the direct measure: −84 % in-page, −97 % per run.

Re-arrivals (the pop-in lane's measure: an id given back and loaded again; `rearr.py` over pop-colour's landmark events),
belt route, 60 s, two runs an arm:

| | cool-down off | cool-down 30 s (default) | cool-down 90 s |
|---|---|---|---|
| re-arrivals / min | 61, 58 | **45, 47** (−23 %) | 27, 32 (−50 %) |
| leave → re-arrive p10 / p50 / p90 | 0.7–1.3 / 5.2–5.6 / 17.7–17.9 s | 2.4–2.6 / 17.0–21.8 / 30.1 s | 0.8–2.3 / 5.4–8.3 / 25–30 s |
| on screen when it re-arrived | 1, 1 | 0, 0 | 0, 0 |
| visible frame-diff px from landmark arrivals (pop-colour) | 27.7 k, 21.1 k | 19.9 k, 19.0 k | 26.3 k, **50.9 k** |

On the Geldersekade ride (K-ride, 40 s): re-arrivals 63 → 33 (−48 %), first arrivals 155 → 126, drops 398 → 365, total
CPU 2.46 → 2.30 cores (sequential, ±10 %).

Why not more: the re-arrivals are models ~260 m off to the side that leave the lat/lng view box and come back into it
(280–460 m) without ever reaching the screen. The p90 of 30.1 s is the cool-down ending, not a need.A 90 s cool-down halves them, but one of its two runs doubled the
visible landmark-arrival pixels (a cooled model loading late, on screen), so the default stays at 30 s, which is neutral
on visible diffs. 90 s (`?landmarkCooldownS=90`) is a candidate for the pop-in lane to judge with its frames. The
remaining short re-arrivals (p10 under 3 s) are models the on-screen test lets through (10 % margin).

Not done, and why:
- **A CPU-side cache of parsed levels.** `_releaseVertexData` frees the CPU arrays after upload, so a parsed level only
  exists as GPU buffers; keeping those defeats the residency budget, and keeping a second CPU copy is ~the GLB size
  again per model. The fetch is an HTTP-cache hit; parse + upload are what a re-arrival costs, and the cool-down avoids
  the re-arrival instead.
- **Raising the budget (72).** No clean GPU-memory measurement was possible on this machine today (the GPU was shared
  at 90 %+), so per the brief it stays.
- Level swaps were 0 on the ride (all levels are chosen on arrival), so the 4 s dwell matters for the aerial and slow
  pans, not this ride.

### 3. `onViewChange` throttling — skipped, note for the pop-in lane

Not touched (pop-in owns it). Callers: `signature-landmarks-source.js` (`_onMove`: evict, request, update levels),
`artis-animals.js`, `buildingTilesBrowser.ts`. While riding the view changes every frame, so each frame builds a view key
string (`${zoom},${b.west},…`) and runs the moveend work: 15–19 ms/s of main thread. Suggest: run it at ~10 Hz or after a
minimum view change (metres / degrees of bearing), and compare the key as numbers rather than a fresh string. The
cool-down above keeps the gate open while any model is cooling, so a throttle would also cut those walks.

### 5. Static subtrees (`matrixAutoUpdate = false`) — measured, not landed

`probe-matrix.js` counted `Object3D.updateMatrix` calls per frame on the ride (H-census, 872 frames): **193 a frame**.

| owner | calls / frame |
|---|---|
| engine overview mesh | 45 |
| player bike (animated: must stay) | 44 |
| scene root and its direct children | 37 |
| pyramidal roofs | 12 |
| facade meshes | 10 |
| trees | 10 |
| everything else | ~35 |

About 77 of those are static composes; at ~0.1 µs each they cost tens of µs a frame. The world-matrix phase (~0.4
ms/frame) is not the composes but the multiplies forced through whole subtrees by the per-frame participant wrappers
(`SharedFrame`), which `matrixAutoUpdate = false` does not stop (the parent's `matrixWorldNeedsUpdate` forces the children).
Turning it off for static content saves < 0.05 ms/frame and risks a stale matrix on anything a later lane moves, so it is
not landed. The real lever is to stop the wrappers forcing their subtrees (only update a subtree when its wrapper's own
matrix changed), which is an engine change for the engine lane.

## What is left, ranked by expected saving

1. **Allocation, 33–50 MB/s → < 20.** three's uniform uploads (a fresh array per matrix uniform per draw; a patch or
   upgrade in the three bundle), and call-boundary boxing in the game frame.
2. **World-matrix force propagation** (~0.4 ms/frame): participant wrappers force subtree multiplies every frame.
3. **`onViewChange` per frame** (15–19 ms/s): the pop-in lane's, above.
4. **Triangles: 2.1–2.5 M a frame.** The GPU is geometry-bound at dpr 2; LOD distances for building chunks and
   landmarks, and the shadow pass's casters, are where GPU time goes, not pixels.
5. **Landmark budget vs GPU memory**: measure on a quiet GPU whether 96 fits; with the cool-down it would mostly cut the
   remaining belt re-arrivals.
6. A 10-minute ride with post-GC heap samples, to rule caches that never evict in or out over a real session (the
   stand-in LRU is bounded at 32 MB).

## Commands

```
# baseline and capped, 60 s each (timing lock: the machine is shared)
PORT=<dev port> CANAL_PW_TIMING=1 /tmp/canal-pw.sh node scripts/perf/desktop-power.mjs out.json --warm 20 --ride 60 --still 15 --qs fpsCap=0
PORT=<dev port> CANAL_PW_TIMING=1 /tmp/canal-pw.sh node scripts/perf/desktop-power.mjs out.json --warm 20 --ride 60 --still 15
# in-page A/B of the cap
... desktop-power.mjs out.json --warm 20 --ride 72 --ab-s 6 --ab-on 'window.__canalRecallFpsCap=60' --ab-off 'window.__canalRecallFpsCap=0'
# owners: profile, trace, allocations
... desktop-power.mjs out.json --warm 20 --ride 30 --profile --trace 5 --alloc
```
