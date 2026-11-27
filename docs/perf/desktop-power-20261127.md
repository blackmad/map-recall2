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

## Residency by bytes (lane landmark-residency, 2026-11-27)

The count budget (72 desktop, 24 touch) was never the number resident: models in the lat/lng view box within the reach
cannot be given back, and on the belt that in-view set alone is 150–260 models. So "over budget" was the steady state
and every off-view model went at once: that was the churn. Measured resident set at the old count budget (pop-colour,
`landmarkBudgetMB=0`): belt desktop 144–155 MB mean / 183–193 MB peak over 168–198 models; belt iPhone 13 profile 123 MB
mean / 145 MB peak over 149 models (n=1); per model ~0.8 MB.

### What changed

| change | off-switch | test |
|---|---|---|
| **Residency by GPU bytes** at street level: vertex + index buffers (from attribute count, so released CPU arrays still count; interleaved once) and textures (live, so the texture cap's swaps count) of each model's drawn and spare level, a shared master once (`landmarks/residentBytes.ts`). Desktop **256 MB**, touch **20 MB** (= 24 × the measured 0.83 MB a model), with a model ceiling (400 desktop, 24 touch). | `?landmarkBudgetMB=0` (the count budget before, exactly), `?landmarkBudget=N` alone (count N, as before), `?landmarkBudgetMB=N` | `landmarkResidency.test.ts` (bytes: nothing goes under budget; shared master freed with its last holder; ceiling; policy/switches; byte counting incl. released arrays, interleaved, mipmaps, compressed, live texture cap) |
| **Keep radius 500 m**: over budget, models beyond it go first (behind before ahead, furthest first); within it only when nothing beyond is left | `?landmarkKeepM=0`, `?landmarkKeepM=N` | `landmarkResidency.test.ts` (the belt case: a 260 m side model kept, a 1.2 km one goes) |
| **From the air: the count budget before** (`ResidencyPolicy.airModels`): the aerial GPU row (aerialGlMaxMB) is already over 700 MB and from the air the in-view set alone fills it | with the above | policy test |
| Probe `residencyStats()` on the layer; `desktop-power.mjs` tracks buffer bytes (`gpuMem.bufferMB`, `totalMB`) and landmark arrivals/re-arrivals/resident MB; `pop-colour.mjs` samples resident MB; `scripts/perf/rearr.mjs` (re-arrivals from a pop-colour run; the pop-in lane's rearr.py was never committed) | — | — |

Touch: 20 MB is below the in-view set (~120 MB), so the phone stays where it was (every off-view model given back), by
construction no worse. The 256 MB desktop budget holds the whole belt minute (198–222 MB peak with nothing given back).

### Measured (old = `?landmarkBudgetMB=0`, new = default; same scratch bundle via BUNDLES_DIR, dev server 4363)

pop-colour, 60 s measured, 6 s warm-up, desktop 1280×800 dpr 2, headless Chrome on Metal, shared slot, load 13–120
(other lanes' Playwright and simulators throughout). Belt = Waag → Westerkerk at 9 m/s; Geldersekade = Centraal →
Waag at 7 m/s (`--route 'central:^waag$'`).

| | belt old (n=4) | belt new (n=4) | Gelders. old (n=2) | Gelders. new (n=2) |
|---|---|---|---|---|
| re-arrivals / min | 50.6, 48.3, 4.0, 0 | **0, 0, 0, 0** | 72.7, 73.5 | **0, 0** |
| first arrivals | 121, 204, 280, 116 | 120, 214, 273, 184 | 77, 76 | 81, 76 |
| leaves (give-backs) | 235, 231, 180, 50 | 0, 0, 0, 0 | 130, 134 | 0, 0 |
| resident landmark MB mean / max | 155/183, 144/191, 112/193, 76/140 | 209/222, 198/219, 173/219, 131/195 | 83/156, 84/156 | 161/198, 161/198 |
| resident models mean / max | 198/251, 169/263, 129/264, 83/127 | 306/336, 294/331, 268/331, 194/271 | 172/217, 172/216 | 229/275, 229/274 |
| landmark-arrival frame-diff px (pop-colour) | 400, 1142, 7332, 8766 | 312, 2337, 9307, 11940 | 212, 388 | 1504, 36 |
| — of which re-arrival frames | 2, 1, 0, 0 frames | 0 | 0 | 0 |
| on-screen arrivals | 3, 14, 62, 71 | 3, 17, 57, 79 | 1, 1 | 0, 0 |

Runs 3–4 of the belt ran at load 100+: the world filled late, so many first arrivals landed on screen in both arms
(62–79 against 3–17) and the arrival pixels went with them. The landmark-arrival px are first arrivals in both arms (the
new arm has no re-arrivals); pairwise new was lower in 1 of 4 belt pairs and 1 of 2 Geldersekade pairs, higher in the
others, and the 1,504 px Geldersekade reading is one off-screen arrival (Amsterdam Museum, 1.2 km, fading) sharing a
frame with an unrelated diff (the old arm charged the same model 212 px). **Not shown to be no worse**: the pixel
measure on this machine is dominated by load, and the per-on-screen-arrival figure is 118 px old vs 153 px new summed
over the four belt pairs. A quiet-machine pair is the open check.

desktop-power, Geldersekade ↔ Nieuwmarkt ping-pong (rails 120 px/s), 20 s warm + 60 s measured, 1512×900 dpr 2, 60 fps
cap (default), shared slot (the exclusive timing slot waited 10 min behind another lane's 70-minute e2e run and was
given up), load 28–118:

| | old 1 | new 1 | old 2 | new 2 |
|---|---|---|---|---|
| re-arrivals / min | 141 | **0** | 189 | **0** |
| first arrivals | 113 | 130 | 31 | 170 |
| resident landmark MB mean / max | 34 / 137 | 149 / 207 | 30 / 74 | 122 / 192 |
| GPU resident (textures + buffers) mean / max | 416 / 485 MB | 479 / 506 MB | 419 / 458 MB | 441 / 502 MB |
| stand-in welds (worker posts) | 98 | 112 | 26 | 131 |
| CPU, all processes | 2.72 cores | 2.83 | 2.99 | 3.09 |
| triangles / drawn frame | 2.19 M | 2.35 M | 2.17 M | 2.28 M |
| draws / drawn frame | 273 | 285 | 271 | 270 |
| load average (start, end) | 28, 112 | 81, 86 | 60, 106 | 100, 118 |

GPU ms/s are not reported: the Apple GPU was shared at load 80–118 (832–1,442 ms/s, meaningless). CPU and welds: no
measurable change at this noise (the new arm loads more first arrivals, each a weld). Triangles **+5–7 %**: models that
left the lat/lng view box but were still inside the frustum used to go back to their box and now stay drawn (300–1,200 m,
in the haze). GPU memory **+22–63 MB mean, +17–44 MB peak** on the ride.

Keep radius: at a binding 160 MB budget on the belt, `landmarkKeepM=0` 32.4 re-arrivals/min, `=500` 30.0 (n=1 each):
within noise, because a binding budget is binding on the in-view set already. It matters only when the budget binds on
off-view models (long rides past 256 MB); kept at 500 m, the edge of the 280–460 m view box.

Commands:
```
BUNDLES_DIR=<scratch> PORT=4363 /tmp/canal-pw.sh node scripts/pop-colour.mjs out.json --route belt [--qs landmarkBudgetMB=0]
BUNDLES_DIR=<scratch> PORT=4363 /tmp/canal-pw.sh node scripts/pop-colour.mjs out.json --route 'central:^waag$' --speed 7 [--qs landmarkBudgetMB=0]
node scripts/perf/rearr.mjs out.json
BUNDLES_DIR=<scratch> PORT=4363 /tmp/canal-pw.sh node scripts/perf/desktop-power.mjs out.json --warm 20 --ride 60 [--qs landmarkBudgetMB=0]
```

### Quiet-machine re-measure after merging main 4be00232d0 (2026-11-28, load 4–9)

Old = `?landmarkBudgetMB=0` (count budget 72), new = default (256 MB bytes). Interleaved old, new, old, new; committed
bundles, `CANAL_PW_TIMING=1 /tmp/canal-pw.sh`, exclusive lock, no other lanes (one 3.5-core Python job running).

pop-colour, belt route, n=3 per arm (desktop 1280×800 dpr 2):

| run | landmark-arrival px | on-screen arrivals | all arrivals | resident MB mean |
|---|---|---|---|---|
| old 1 / 2 / 3 | 817 / 309 / 200 | 0 / 2 / 2 | 183 / 178 / 169 | 158 / 158 / 161 |
| new 1 / 2 / 3 | 989 / 386 / 453 | 1 / 2 / 0 | 121 / 122 / 117 | 205 / 205 / 199 |

Mean arrival px old 442 (spread 200–817), new 609 (386–989): within the run-to-run spread. On-screen arrivals are 0–2
per run in both arms, so px per on-screen arrival (old 331, new 609 pooled) rests on 5 and 3 events and is not a usable
ratio. Arrivals fall by a third (510 → 360 over three runs): the old arm's extra are re-arrivals off screen.

desktop-power, 60 s ride, n=2 per arm (1512×900 dpr 2, governor):

| run | cores total | renderer | GPU proc | GPU ms/s | GPU ms p50 | fps | tris/frame | draws | GPU MB total | landmark MB | first arr | re-arr | load |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| old 1 | 1.96 | 1.11 | 0.83 | 1785 | 22.0 | 62 | 2,244,176 | 290 | 464 | 79 | 70 | 267 | 6.0 |
| old 2 | 2.30 | 1.37 | 0.90 | 1795 | 36.4 | 77 | 2,293,292 | 297 | 463 | 83 | 39 | 381 | 3.9 |
| new 1 | 1.93 | 1.05 | 0.88 | 1786 | 22.5 | 73 | 2,270,440 | 286 | 506 | 213 | 14 | 0 | 5.8 |
| new 2 | 2.18 | 1.50 | 0.67 | 1575 | 26.6 | 95 | 2,303,574 | 290 | 493 | 209 | 11 | 0 | 9.4 |

Triangles +0.4–1.2 % (not the +5–7 % measured under load 110), GPU ms/s 1790 → 1681 mean (not worse), CPU cores
2.13 → 2.06, GPU memory +36 MB mean, re-arrivals 267–381 → 0.

engine-own.spec.ts desktop, `PW_PORT=4388`: the `moved` failure under load is gone (moved 80.6 m). The program budget
(43, budgets.json) is the edge: branch 44 (fail), 43, 37; main's bundle swapped in, 43, 43. More resident landmarks can
compile one more material variant; a flake risk at the budget line, not a steady regression.

## Triangles and draws by layer (lane landmark-residency, Part B)

`scripts/perf/layer-tris.mjs` (new): every GL draw (incl. WEBGL_multi_draw) charged to the object three is drawing
(`renderBufferDirect`), main and shadow pass apart, by shared-frame participant; landmarks by drawn level and eye distance
of the bounding-sphere centre, facade/baked meshes by nearest distance. Belt route (Waag → Westerkerk, chase, 9 m/s),
1512×900 dpr 2, the rider stopped at each pose, 3 s settle, 40 forced frames; new residency default; n=1 (run
`T-base2`; a second run `T-base` with coarser attribution agreed on the big rows: baked 0.68–1.14 M, facades 0.36–0.56 M).
Paired old/new runs later the same evening were unusable (load 110: the world never filled, 0.6–1.1 M a frame).

| layer (pass) | pose 24 s (219 m) | pose 36 s (327 m) | pose 48 s (433 m) |
|---|---|---|---|
| **baked coarse cells** (main) | 675 k / 4 | **1,135 k / 7** | **1,135 k / 7** |
| — cells under the rider (nearest 0–150 m) | 371 k / 2 | 675 k / 4 | 573 k / 3 |
| — cells 600–1,200 m | — | 374 k / 2 | 374 k / 2 |
| facade chunks: tile / kit / detail (main) | 360 k / 11 | 563 k / 9 | 506 k / 9 |
| facade chunks (shadow) | 119 k / 2 | 227 k / 3 | 0 |
| bespoke landmarks, full level (main) | 197 k / 48 | 398 k / 36 | 336 k / 30 |
| — of which 300–600 m | 136 k / 27 | 253 k / 25 | 260 k / 23 |
| landmarks lod1 / lod2 / lod2 batch | 0 | 0 | 0 |
| landmark shadow stand-ins + landmarks (shadow) | 60 k / 14 | 111 k / 18 | 0 |
| own ground + water (main) | 149 k / 60 | 273 k / **102** | 314 k / 81 |
| engine overview (far city, main) | 93 k / 45 | 79 k / 45 | 88 k / 45 |
| trees (main + shadow) | 144 k / 5 | 142 k / 5 | 82 k / 4 |
| rider + bike | 54 k / **37** | 47 k / 37 | 47 k / 37 |
| street furniture | 21 k / 4 | 15 k / 6 | 13 k / 6 |
| pyramidal roofs | ~0 / 32 | ~0 / 24 | ~0 / 8 |
| **total** | 1.88 M / 263 | 3.02 M / 295 | 2.52 M / 228 |

Baked cells under the rider: 44–56 % of their vertices carry `hidden` (buildings the detail chunks replace) and are
still submitted every frame.

### What the table points at (no cut landed)

1. **Hidden ranges in the baked cells under the rider** — 250–380 k triangles a frame (the hidden share of the 0–150 m
   cells) are drawn only to be discarded by the vertex shader. Rebuilding the cell's index without hidden ranges (or a
   draw-range split per hidden run) would cut ~10–15 % of the frame's triangles with no change in any pixel. It touches
   the swap dissolve's per-vertex `hidden`/`swapSlot` state, so it is an engine-lane change with its own e2e, not a
   switch here. Recommended first.
2. **Landmarks never leave full at street level.** The street level rule reads the footprint radius at the view
   centre's zoom (`_radiusPixels`), not at the model, so a model 300–600 m down the street is full like one at 30 m:
   250–260 k triangles at poses 36/48 s, lod1 is 15 % of that. A through-the-camera radius (as ordinary installs and
   chunks already use from the air) would drop those to lod1 — but it is a look change against the 2026-10-13 ruling
   ("at this zoom they should be full rez"), so it needs David's frames, not a lane's diff.
3. **Draw-bound bits**: rider + bike 37 draws for ~50 k triangles, engine overview 45 draws, own ground 60–100 draws
   (the largest draw count). Merging the bike's meshes is the cheapest.
4. Far baked cells (600–1,200 m, 374 k) sit inside the 2 km street draw limit, in the haze but visible: not a free cut.
5. The shadow pass is small (0.1–0.35 M) on this route.

```
BUNDLES_DIR=<scratch> PORT=4363 /tmp/canal-pw.sh node scripts/perf/layer-tris.mjs out.json --poses 12,24,36,48 [--shots <dir>] [--qs ...]
```
