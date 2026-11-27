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

## What is left, ranked by expected saving

1. **Allocation churn, 84 MB/s → GC ~10–25 % of a core.** Own-ground height lookups on chunk installs
   (`ownGround/surface.ts relief/ground` returns a fresh `[rx, ry]` from `applyLocalToRd` per call; `heightRd`'s edge
   path builds arrays), `contactsInto` every frame for the HUD plaque and the road guard, three.js bounds recomputed in
   the frustum test (`computeBoundingSphere` under `intersectsObject`: some geometry loses its bounding sphere every
   frame). Fix with scratch vectors / reused arrays and a per-frame memo of the nearest road.
2. **Landmark level churn in the worker pool.** Cache a landmark's welded stand-in (and parsed level) across
   dispose/re-import by model URL with an LRU, so passing the same landmark twice does not weld again; add hysteresis to
   level swaps. Also cuts GLB re-parse and the `_updateLevels` work.
3. **`onViewChange` is per-frame "moveend".** Signature landmarks (and artis animals, building tiles) do their
   moveend work every frame while riding (15–19 ms/s). Throttle to ~10 Hz or to a minimum view change. Interacts with
   pop-in (question 6), so it wants that lane's review.
4. **Triangles: 2.1–2.5 M a frame.** The GPU is geometry-bound at dpr 2; LOD distances for building chunks and
   landmarks, and the shadow pass's casters, are where GPU time goes, not pixels.
5. **Main thread render (~2.3 ms/frame) and world matrices (~0.4 ms/frame):** static subtrees with
   `matrixAutoUpdate = false`, so `updateMatrixWorld` stops walking them every frame.
6. A 10-minute ride with post-GC heap samples, to rule caches that never evict in or out over a real session.

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
