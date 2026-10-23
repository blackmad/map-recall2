# Lane: performance on phones and weak GPUs (taken over 2026-10-23)

Rules: `LANE-RULES.md`. Taken over from the standing perf session on
2026-10-23 so it runs inside the programme. Standing priority (user,
2026-10-16): desktop frame time matters about ten times more than iPhone;
phones are measured, not guessed. Landed before the takeover (on `main`):
dead-GPU guard and smaller GPU budget, context-loss diagnostics to Sentry,
landmark eviction + render governor (`src/canalRecall/renderGovernor.ts`,
`landmarks/landmarkResidency.ts`), phone memory (dead road edges dropped,
graph arrays shared, ground arrays freed), `tests/e2e/phone-memory.spec.ts`
and `weak-gpu-perf.spec.ts`.

Model: opus for the GPU-loss rebuild (renderer lifecycle), haiku for the
measurements and the per-tile road loader once the design is written.

## Open, in order

1. **Real devices (P0).** Ride 5+ minutes on an iPhone, a low-end Android and
   an Intel/AMD laptop at 150 % scaling. The Sentry graphics warnings now
   carry GPU, memory and canvas size when a phone loses its context: that is
   the evidence. Report: device, minutes ridden, context losses, Sentry event
   ids. (The user rides; the lane prepares the build and reads Sentry.)
2. **GPU loss and regain (P1).** When a phone loses and regains its WebGL
   context the 3D layer stays blank until reload: the shared renderer
   (`src/canalRecall/rendererShared/sharedFrame.ts`) never rebuilds, and with
   the ground arrays freed the ground cannot re-upload. Design: on
   `webglcontextrestored` rebuild the shared renderer, re-request the ground
   cells and landmark models from their loaders (not from freed arrays).
   Regression: `tests/e2e/weak-gpu-perf.spec.ts` gains a lose/restore step
   (`WEBGL_lose_context`) that asserts the 3D layer draws again within 5 s.
3. **GPU memory (P1).** About 150 MB of buffers and 60 MB of textures on a
   phone, unchanged. Next lever: smaller ground geometry (fewer triangles per
   cell on phones, drop the far-ring bands, 16-bit indices where a cell
   allows). Measure with the phone-memory spec before and after.
4. **Whole-city road data (P1).** About 60 MB loads at ride start; load it per
   tile (the routing graph stays whole, the display geometry moves to the
   cell loader). About 90 MB of ArrayBuffers are resident at ride start,
   before any own-ground cell, and unexplained. The handed-over probe:
   `PERF_PHONE_MEMORY=1 PHONE_HEAP=1 PW_PORT=<port> bash /tmp/canal-pw.sh npx playwright test phone-memory --project=iphone`
   prints `arrayBuffersMB` (CDP backingStorageSize; `PHONE_KEEP_ARRAYS=1`
   restores the old own-ground behaviour). Next step as planned by the
   previous session: a heap snapshot at "ride start" in
   `tests/e2e/phone-memory.spec.ts`, then walk the `JSArrayBufferData` nodes
   to their owning objects and report MB per owner.

Numbers at the Dam, iPhone profile, 10 s in (2026-10-23): JS heap 283 MB
after GC, ArrayBuffers 189 MB, GL about 150 MB buffers and 62 MB textures.

## Android for real

The Android SDK is installed under `~/Library/Android/sdk` (emulator,
platform-tools, `system-images;android-35;google_apis_playstore;arm64-v8a`);
no AVD exists yet. To measure Chrome on Android:
`avdmanager create avd -n canal-phone -k "system-images;android-35;google_apis_playstore;arm64-v8a" -d pixel_5`
(avdmanager from the brew `android-commandlinetools` cask), then
`$ANDROID_HOME/emulator/emulator -avd canal-phone`; reach the host dev server
at `10.0.2.2:<port>` or `adb reverse tcp:<port> tcp:<port>`; remote-debug
Chrome with `adb forward tcp:9222 localabstract:chrome_devtools_remote`.
Also open from the previous session's board: the shared-frame context
restore (item 2), an App Check 403 in prod, and the render governor measured
on a real Intel laptop.

## Android emulator pass (2026-10-23, read-only, previous perf session)

AVD canal-phone (Pixel 5, Android 15, 4 GB, Chrome 124), `main` b28eeac58,
7-minute chase ride with 15 jumps round nine centre spots. No context loss,
no errors, no low-memory kills; landmark residency held 20–27 against a
budget of 24 (194 evicted). Renderer PSS 1,154–1,764 MB with no upward
trend; GPU process 366–594 MB; GL buffers 75–278 MB rising and falling
with each jump's tile load. GPU is the host M4, so fps and GPU budget say
nothing about a phone GPU; JS heap not measurable there. Raw JSON and the
probe script: the previous session's scratchpad (`emu-ride3.json`,
`emu-ride.ts`). Findings, now items 5–7:

5. **Governor never steps back up.** It took all three steps (pixel ratio,
   shadows off, 0.75) within 15 s of ride start while tiles and landmarks
   were landing, and stayed at 0.75 for the whole ride. Ignore the first
   ~10 s after ride start and after a jump, and allow stepping up after a
   sustained good stretch (`src/canalRecall/renderGovernor.ts`, with its
   test).
6. **Renderer PSS ~1.5 GB at ride start, 1.76 GB peak at 30 s**: the
   OOM-kill zone on a 3–4 GB phone; ties to item 4 (90 MB ArrayBuffers).
7. **Loop hardening**: `Game._loop` re-armed `requestAnimationFrame` only
   after `_update` and `_render` returned, so one exception froze the game
   for good with the map still showing. Fixed by the integrator 2026-10-23:
   the loop always reschedules (try/finally) and reports the error once per
   message.

## Ride-start memory (2026-10-24, previous perf session, merged)

Attribution at ride +10 s (iPhone profile, renderer process): partition_alloc
468 MB (ArrayBuffers inside ~228 MB), v8 453 MB (main 275, workers 172), 2D
canvas 272 MB, malloc 213 MB, webgl 108 MB. The 272 MB of canvas were ~380
cached bay-texture canvases (`bayTextures()` keeps every painted variant for
the session; the texture build paints ~190 only to copy their pixels into
the DataArrayTextures), and the `onUpdate` closure kept the builder's colour
and mask arrays alive. Fixed: `releaseBayTextures()` after the copy loop,
module-level `releaseTextureData`. Canvas 272 → 20 MB; phone-memory spec
ArrayBuffers at ride start 88 → 67 MB, heap 273 → 245 MB, GL buffers 150 →
140 MB; emulator renderer PSS at ride start 1,567 → 1,313 MB, peak 1,764 →
1,650 MB. The "90 MB unattributed" were ArrayBuffers arriving from workers
and fetch: own-ground meshes (70–137 MB of vertex arrays, only ~1 of 9
resident cells ever drawn in chase view), 24 MB of field height tiles, 19 MB
of DataTexture data. Next levers (item 4 continues): the worker heaps (244
MB after a long Android ride, never measured before), a smaller resident
own-ground ring on phones or lazy cell builds on frustum entry, Uint16 field
tiles (24 → 12 MB).

## Checks

`npm run lint`; `PW_PORT=<port> npx playwright test tests/e2e/phone-memory.spec.ts tests/e2e/weak-gpu-perf.spec.ts --project=iphone` alone; desktop
`node scripts/ride-perf-fixed-route.mjs` alone after any ground change (frames
vsync-bound, draw calls and heap ≤ the previous row). Memory `perf-profiling-method`: iPhone project + 4× throttle; the CDP `Profiler.start` stall of ~1.7 s is not a frame.

## Acceptance

Item 2: the lose/restore step green on desktop and iphone projects. Items 3
and 4: before/after numbers from the phone-memory spec in the report; nothing
is called smaller without them. Item 1: the device table, or "not ridden yet".
