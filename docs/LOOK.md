# Canal Recall look: art direction (3D)

One page, numbers first. Gallery and release reviews cite sections of this
file ("LOOK §Light", "LOOK §Corridor") instead of re-arguing taste. Values
come from the shared-frame spike (`docs/research/own-renderer-spike-20261009.md`)
and the look-consistency lane (2026-10-13). Code owners: `src/canalRecall/look/palette.ts`
(colour), `src/canalRecall/rendererShared/lightRig.ts` (light).

## Light (one rig: `?sharedFrame=1`)

- **One sun, one sky, no private lights.** Every three.js layer in the shared
  frame (facades, landmarks, recipe houses, trees, roofs, ARTIS, vehicles,
  3DBAG detailed buildings) is lit by `DEFAULT_LIGHT_RIG` and nothing else.
  `tests/e2e/look-consistency.spec.ts` asserts the frame's scene holds exactly
  `shared-frame-sun` and `shared-frame-sky`.
- **Sun:** azimuth **215°** (south-south-west), elevation **40°**, `#fff1dc`,
  intensity **2.1**. Shadows fall north-north-east, so canal-belt street
  facades stay mostly lit. (The spike used 225°/34°; the game keeps 215°/40°.)
- **Sky:** hemisphere `#dbe8ff` over ground `#8d8270`, intensity **1.75**.
- **Shadows:** one sun shadow map, **2048²** desktop / **1024²** phone, box
  half-size 160 m at z18 doubling per zoom step (100–640 m), texel-snapped,
  redrawn only when the box steps **16 m** or casters change. Off below z15.
- **Materials are diffuse only** (Lambert, or Standard at roughness ≥ 0.8 for
  the facade atlas). No GGX hotspots on landmarks (`landmarkShading.ts`).
- **Legacy (flag off) is baked:** the streamed city bakes a fixed light from
  the **north-west** into vertex shade (0.8–1.0 walls, 0.5–1.0 roofs); recipe
  houses copy it; landmarks carry their own three-light rig. This is the
  inconsistency the shared rig removes; do not tune new art against it.

## Sky, fog, tone mapping (targets for the own-frame phases)

- Output sRGB, **no tone mapping** inside MapLibre's frame today (the spike's
  Neutral tone mapping changes every colour; adopt it only with a palette pass).
- Fog **260–1300 m**, colour `#c4d0d8` (spike). Sky: Preetham, turbidity 6,
  rayleigh 1.4, used as IBL at 0.22 (spike). Not in the game frame yet.

## Palette and saturation

- **One palette module** (`look/palette.ts`); no colour tables elsewhere.
- **One era scheme:** canal houses < **1860**, 19th-century ring 1860–**1914**,
  Amsterdamse School **1915**–1944, post-war and modern ≥ **1945**
  (`PERIOD_FROM`). Facade styles split modern once more at 1985 for layout,
  never for colour.
- Every colour without a measurement is a **display prior**: it never claims
  to be evidence, and reports label it as such (`buildingAppearance.ts`).
- Photo look: real Amsterdam range, reds dominate, brick lightness
  **0.30–0.60** (`CITY_BRICK_LIGHTNESS`); stucco keeps hue, lifts lightness.
- Storybook = natural palette, hue −4°, saturation ×1.15, lightness +0.03.
  Cartoon = saturation ×1.7 + 0.08, lightness ×1.08 above L 0.35; darks (glass,
  iron) never lift, so windows read (`LOOK_VARIANTS[*].tone`).
- Roofs: one table (`ROOF_TONES`, `FLAT_ROOF_GREYS`); pantile reds and slate
  greys; flat roofs bitumen/gravel greys, never a wall colour.

## Parity (the "is this building really this dark?" rule)

The same brick slot must read the same whichever pipeline draws it. Under the
shared rig a mid-grey (`#808080`) brick wall on a generic extrusion, a recipe
house and a landmark GLB must land within **8 %** relative luma of each other
on every wall orientation (`PARITY_TOLERANCE`; `tests/e2e/look-parity.spec.ts`,
real materials, real rig). Measured 2026-10-13, mean sRGB luma 0–255:

| wall | generic | recipe | landmark | spread |
|---|---|---|---|---|
| south (sun) | 108.2 | 102.1 | 105.7 | 5.8 % |
| west | 98.9 | 93.4 | 96.5 | 5.7 % |
| north / east (sky only) | 70.7 | 67.7 | 70.0 | 4.3 % |

Before the lane, under `?sharedFrame=1` recipe houses were still unlit
(north wall 122.7 against 61.5 generic and 70.0 landmark: 72 % spread) and
generic walls sat ~12 % under landmarks (wall cells lifted to a mean of
225/255 for the baked shade; now `litWallGain`).

Target ranges for a mid-grey brick wall under the rig: sun-side **95–110**,
shade-side **65–75**. Shade sides are ~35 % darker than the legacy baked look
(96–123): that contrast is the sun reading as a time of day, not a bug, but
any change to sky intensity must be checked against this table.

## Outlines

- Photo, procedural, untextured: **no outlines**.
- Storybook: ink `#3b2a2a` outlines in the painted cells, thin.
- Cartoon: the same ink, bolder, plus **3 quantised shade bands** in the
  unlit facade shader (the lit shader ignores bands: no lit cartoon yet).

## What is textured at what distance

- Near (2×2 z16 tiles; z17 on touch): full facade cells, shopfronts, roofs
  with planned shapes, dormers, extras.
- Beyond: coarse footprint shells with courtyard lids, cell windows only.
- Recipe houses and landmarks: full GLB near; landmarks swap to `lod1` far.
- Untextured look: flat vertex colour everywhere, real shapes only.

## Driving corridor readability

- The street ahead and the rider stay readable before anything is pretty:
  no effect may darken the road surface under the rider below the shade-side
  range above, and shadows are off below z15.
- The vehicle draws last (overlay pass) with its x-ray through buildings.
- The street or canal under question is never revealed by colour, label or
  highlight before the answer (CLAUDE.md product principles). Highlight yellow
  (`#ffd21f`) is reserved for the answer and active landmark.
- Trivia/neighbourhood cards stay compact at the bottom; nothing in the 3D
  frame competes with them for saturation (no bloom, no saturated sky).

## How reviews cite this

- Gallery and release reviews look at gallery-size renders from all sides,
  then cite the section that a flaw breaks ("LOOK §Parity: recipe house 20 %
  darker than its neighbours") and attach the look-parity JSON or a
  `scripts/compare-look-shots.mjs` diff.
- Before/after for any look change: `LOOK_SHOTS_OUT=… PW_OFFLINE_MAP=1
  npx playwright test look-consistency` (add `LOOK_SHOTS_QUERY='?sharedFrame=1'`
  for the rig), then `node scripts/compare-look-shots.mjs <before> <after>
  --crop-top=240 --diff-out=<dir>`. Flag-off changes must be pixel-identical
  unless the review approves a default-look change.
