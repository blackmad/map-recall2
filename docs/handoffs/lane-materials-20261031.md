# Lane P4: one material registry, starting with the own-ground programs

Rules: `LANE-RULES.md`. Programme: `engine-programme-20261030.md` (P4).
Model: opus. Written by L1 (#129) on 2026-10-31 from a measured ride.

## Why

`tests/e2e/engine-own.spec.ts` holds `?engine=own` to the programs budget in
`tests/perf/budgets.json` (`entries.programs.value`, 32). It measures 35–36,
so the spec is red. Do not raise the budget. The largest single owner is
the own ground (`src/canalRecall/ownGround/gameGround.ts`), **not** the
landmark GLBs: about 20 `MeshStandardMaterial` programs, half of which are
`-ownFade` twins.

## Measurement

The measurement used the desktop chase, `?engine=own`, car, from the Anne
Frank House towards the Rijksmuseum, with a seeded `Math.random`. It
recorded every program in `renderer.info.programs` over 14 s after landing,
53 programs in all:

- 25 `MeshStandardMaterial`;
- 13 `ShaderMaterial`;
- 10 `MeshLambertMaterial` (city look);
- 4 `MeshDepthMaterial`;
- 1 `MeshBasicMaterial`.

Each three.js 0.185 cacheKey (`WebGLPrograms.getProgramCacheKey`) was split
on `,` and diffed against the first MeshStandardMaterial key. Fields that
differ:

- **7** `mapUv`: `uv` means the material has a `map` (the `USE_MAP` define).
- **51**, first parameter bitmask: bit 10 is `vertexColors`, bit 23 is
  `vertexNormals`, and bits 0/1 are instancing/instancingColor (the 8388611
  key is instanced, not ground).
- **52**, second bitmask: bit 2 is `flatShading`, bit 11 is `doubleSided` and
  bit 17 is `opaque`. Base 8520706 is `useFog | shadowMapEnabled | opaque |
  hasPositionAttribute`.
- **54** `customProgramCacheKey`, set by `gameGround.ts`:
  - `blendMaterial` (l.951) sets `ownGround-blend3-<type>-flat|vc`;
  - `cutMaterial` (l.910) sets `ownGround-cut3-<r|g>-<base key>`;
  - `fadeMaterial` (l.967) sets `<key>-ownFade`.

## The 20 own-ground programs

| # | 7 map | 51 | 52 | 54 (customProgramCacheKey) | + `-ownFade` twin |
|---|---|---|---|---|---|
| 1 | uv | no vc | – | blend3-flat | yes |
| 2 | uv | no vc | – | cut3-r · blend3-flat | yes |
| 3 | uv | no vc | – | cut3-g · blend3-flat | yes |
| 4 | – | no vc | – | blend3-flat | yes |
| 5 | – | no vc | – | cut3-r · blend3-flat | yes |
| 6 | – | no vc | – | cut3-g · blend3-flat | yes |
| 7 | – | vc | – | blend3-flat | yes |
| 8 | – | vc | – | cut3-g · blend3-flat | yes |
| 9 | – | vc | – | blend3-vc | yes |
| 10 | – | vc | doubleSided | blend3-vc | yes |

That is 10 programs, plus 10 twins, for 20 in all.

## What can share a program

These can share a program by using uniforms instead of defines:

- **`-ownFade` twins (−10).** The fade is
  `if (ownFade < 1.0 && hash > ownFade) discard;` behind a uniform. Compile
  it into every ground material with `ownFade = 1.0` by default, and the
  per-cell clone only swaps the uniform object. One compare per fragment
  removes half the programs. This is the first and cheapest step.
- **Cut channel r/g, and cut vs no cut (−5 of the remaining 10).** Replace
  `.${channel}` with `dot(texture2D(waterMask, vMaskUV), uMaskChannel)` (a
  `vec4` uniform). A material that is not cut gets a 1×1 white mask and the
  extent it already treats as land. One key, `ownGround-ground-<flat|vc>`.
- **`blend3-flat` vs `blend3-vc` on the vertex-coloured materials (rows 7 and
  9).** Both already compile with `vertexColors`. Choose the flat tone with a
  uniform:
  `mix(ownFlat, pow(vColor.rgb, 1/2.2), uFlatFromVertex)`.
- **Textured vs untextured (rows 1–3 vs 4–6).** Give untextured layers a
  shared 1×1 white `map`. This costs one texture fetch per fragment, so
  measure it on the phone before keeping it.

These cannot share a program, or need a geometry change first:

- **`vertexColors` (field 51, bit 10).** It is a define. Merging it would mean
  giving every ground geometry a colour attribute: more memory per cell, for
  one program. Leave it, unless the cell format already carries colours.
- **`doubleSided` (field 52, bit 11, row 10 only).** Make that layer
  `FrontSide` with consistent winding, or accept one program.
- **`opaque` (field 52, bit 17).** `setGroundTransparent` (l.920) flips
  `transparent` on every ground material while presence < 1. The flip clears
  `opaque` and compiles a **transparent twin of every ground program** at
  the overview→city crossing. The churn window started after landing, so it
  did not see these twins. Measure them across the start flight; this is
  likely the remaining hitch at the crossing. One fix is to keep the
  materials transparent and write `gl_FragColor.a = 1.0` once present.

## Expected count

| Step | Own-ground programs | Ride total (from 36) |
|---|---|---|
| today | 20 | 36 |
| fade as uniform | 10 | 26 |
| + one cut program (channel uniform, white mask) | 5 | 21 |
| + flat/vc by uniform | 4 | 20 |
| + white map for untextured | 3 | 19 |
| + one side | 2 (flat, vc) | 18 |

The first step alone turns the spec green. Steps 2–3 leave room under 32 for
the participants still listed as unimplemented in `engine/ownWorldView.ts`
(park landscape, recipe tiles, sculptures).

## Then the registry

After the ground, put each material that edits shaders behind one registry
with stable keys and uniform-only variants:

- `look/cityLook.ts` `city-look-v3|<variant>` (10 Lambert programs);
- `rendererShared/litFacadeMaterial.ts`;
- `look/highlight.ts` `|hl-dim`;
- `buildingTypes/runtime.ts` `building-types/lit-merged/<n>`.

Each entry gets a unit test that builds two variants and asserts one
`customProgramCacheKey`. Probe on a real ride with
`renderer.info.programs`, the same split-and-diff as above.

## Acceptance

- `tests/e2e/engine-own.spec.ts` is green on desktop and iPhone at the
  unchanged budget.
- There is no visible change. Compare before and after on the engine-own
  screenshot and a crossing frame from the start flight.
- Report the program count over the start flight as well as after landing.
