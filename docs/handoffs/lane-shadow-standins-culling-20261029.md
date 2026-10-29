# Lane: shadow stand-ins, size-based culling, the loading recipe

Rules: `LANE-RULES.md`. Plan: `slop-newyork-plan-20261029.md` §4 lane D.
Evidence: `docs/research/slop-newyork-20261029.md` §2. Model: opus for the
stand-in spike and the precompile; haiku for the culling sweep and the
measurements.

## 1. Shadow stand-ins (spike first, measure, then keep or drop)

Slop gives every large static caster a position-only copy, re-cut into
500 m cells with one black basic material per side setting, on a layer only
the shadow cameras render; the originals stop casting. Commit c4ab18f: 283
of 288 building cells had been drawing the full facade shader into both
cascades; the stand-ins saved 35–50 shadow draws a frame. Lamp posts cast
with a 16-triangle proxy instead of 120.

Ours: one sun shadow map (2048² desktop, 1024² phone), redrawn only when the
box steps 16 m or casters change (`rendererShared/shadowFit.ts`,
`sharedFrame.ts`). Every caster draws its own material into it.

**WebGL constraint, verified in three 0.185.1:** `WebGLShadowMap.js:511`
tests `object.layers` against the **main** camera's layers, so a
shadow-only layer is not free. Two routes, spike both for an hour each:

- keep `shadowMap.autoUpdate = false` (we already redraw on demand) and
  drive the shadow pass ourselves with a camera whose layers include the
  stand-in layer: `renderer.shadowMap.render([sun], scene, shadowCamera)`
  (the `WebGLShadowMap` instance exposes `render`), then the main render
  with the layer off;
- or `onBeforeShadow` / `onAfterShadow` (present in 0.185.1) on the
  originals to swap a stand-in geometry in and out.

Measure with `renderer.info` sampled inside the shadow pass: draws and
triangles into the map, and the shadow redraw ms at the Dam and the
Westerkerk, desktop and iPhone profile. Stand-ins for facade chunks (walls
only, no extras), landmark LOD1 meshes, chunk bases; the bike and trees keep
casting as they are. Visual: `building-look.spec.ts` "shadow fill" rows
within 1 luma; a before/after frame at the Royal Palace.

## 2. Culling and uploads

- Per-mesh cull distance from the 90th-percentile instance size × 1100
  (`js/scene-culling.js:16-52`), cells `clamp(cull·0.5, 250, 600)` m, a flat
  `d² < max²` loop; apply to our instanced props (inventory trees, bollards,
  railing runs, houseboats, allotment canopies). Report what each prop
  class culls at and the draw delta on the fixed ride.
- `scene.matrixWorldAutoUpdate = false` on the shared scene with an explicit
  dynamic list (bike, boats, ferries, cards); `staticMatrices.ts` already
  does it for landmarks.
- Streamed pools upload only the used prefix (`addUpdateRange`), buffers
  static usage; check the tree and houseboat buffers for `DynamicDrawUsage`
  (slop measured ~7 MB a frame of re-upload before it stopped).

## 3. Loading recipe

- `modulepreload` for the bundle list and `preload as=fetch` for the first
  extracts: report the exact `<link>` list for the integrator (`index.html`
  is theirs), and a boot test that parses `index.html` and asserts the order
  and that every preload URL matches an import.
- Loading stages that yield (rAF + `setTimeout(0)`, 100 ms timeout for
  hidden tabs) and one `[init]` timing line.
- Precompile one representative per program through `renderer.compileAsync`
  (0.185.1 has it; uses `KHR_parallel_shader_compile`) with a "N / M"
  progress line on the loading screen, then a warm-up frame with culling
  off so the shadow and fade variants compile too, then `gl.finish` before
  the loader hides. Today `sharedFrame.ts:242` calls `renderer.compile`
  once.
- Perf as tests: pin the program count (32) and a draw ceiling in
  `ride-perf.spec.ts`; a "zero buffer uploads after warm-up" probe on the
  steady ride.

## Measure

`node scripts/ride-perf-fixed-route.mjs` desktop and touch before and after
each part; `intro-perf.spec.ts` time-to-ride desktop and iPhone; shadow
draws and ms from part 1; program count after precompile equals the count
after a 60 s ride (nothing compiles mid-ride).

## Acceptance

Numbers in the report; the shadow-fill rows unchanged; time-to-ride not
worse; nothing visible changes except the loading progress line.

## Checks

`npm run lint`; `npm run check:canal`; `PW_PORT=<port> npx playwright test
building-look ride-perf intro-perf look-consistency --project=desktop` and
`ride-perf intro-perf --project=iphone`, under the lock.
