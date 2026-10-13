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
- **Roof texture, by distance** (`roofTier.ts`, user 2026-10-13 "this roof
  texture is too busy"): the pantile and slate cells are 1.2 m wide with 5-6
  courses, which reads as noise from a chase camera. The roof band is a cell
  luminance standard deviation of **at most 0.06** (`ROOF_CELL_SD_MAX`; the
  cells were 0.098 / 0.093, the flat cell is 0.023); the mean is untouched, so
  roof luma and the parity rule do not move. The facade shaders then take the
  cell **1x within 70 m, 0.5x (tiles twice as large) from 70 m, and its mean
  colour (the last mip) from 190 m**, crossfading over 30 m and 80 m; the
  crossfade samples both cells rather than warping the UVs, so a long roof
  never swims. Slot-material meshes (recipe houses, landmarks) are not touched.

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

### City look (`?cityLook=1`, `look/cityLook.ts`)

One texture array and one shader for every building mesh: the bay cells
followed by the slot table (brick, stucco, stone, white, door, glass, pantile,
slate, flat roof, then the variants **brick20** and **whiteStucco**),
attributes `layer, tint, accent, hidden`, unlit (baked shade) and lit (Lambert
under the rig) variants. Recipe houses, building types and landmarks go
through it; the legacy landmark GLBs take the slot their material name says
(`look/materialSlotInference.ts`). Slot tints pass through `cityLookTint`:
`cityTint` (the one palette mapping) plus the gallery review's corrections
below. Lit, the city look is levelled by `CITY_LIT_LEVEL` **0.9** (tinted
chunk texels and the wall/roof slot layers, each cell gained to a mean of 1),
which brings the reference brick into the band above. Measured 2026-10-13
(`tests/e2e/building-look.spec.ts`), mean sRGB luma:

| wall | `#808080` generic | recipe | landmark | spread | `#9a5240` spread | unlit `#808080` |
|---|---|---|---|---|---|---|
| south (sun) | 105.1 | 109.2 | 109.2 | 3.8 % | 0.15 % | 100.6 |
| west | 96.2 | 100.0 | 100.0 | 3.9 % | 0.16 % | 117.1 |
| north / east | 69.8 | 72.8 | 72.9 | 4.3 % | 0.16 % | 122.4 / 105.9 |

Before the review the grey reference read 117.2 / 107.3 / 78.3 (above the
95–110 band). The grey spread is by design: a grey slot now stays grey, while
a chunk's panorama tint keeps `cityWallTint`'s saturation floor; a
brick-coloured slot is one rule in every pipeline (asserted ≤ 1 %).

- **Highlight** (active landmark): the yellow replaces the tint, not the
  cell, so courses and dark glazing show through; lit albedo 1.0 + glow 0.2
  (was a 0.45 glow: flat, sun side clipped); unlit, the baked shade's
  contrast ×1.8. Sun/shade luma ratio on a wall: default highlight 1.09, city
  lit 1.30, city unlit 1.49 (light from the NW).
- **Era brick:** BAG year ≥ 1915 (`PERIOD_FROM.school`) samples `brick20`
  (machine brick, cell mean 238 vs 225, finer lighter joints). Landmarks get
  the year as `spec.bagYear`, built by `scripts/landmarks/landmark-bag-years.ts`
  (largest covered pand; 324 of 381 covered models). BAG records rebuild years
  for some monuments (Westerkerk pand 1990, Rijksmuseum 2013, Hollandsche
  Schouwburg 1988): corrections only from a sourced year.
- **White render:** inferred materials named `white` / `cream` / `ivory`
  (224 models) sample `whiteStucco` (smooth, no specks), since the builders
  use `white` for walls and trim alike.

#### Gallery review (2026-10-13, all 311 GLBs, flag off beside flag on)

`node scripts/landmarks/citylook-gallery-review.mjs` renders every model at
gallery-card size (320×240) under the shared rig, from the sun side and the
shade side, flag off (own materials) beside flag on (inferred slots, era
brick); sheets of 30 and `review.json` (luma, colour, material table per
model). Median Δluma flag on vs off: −4.2 % → **−2.4 %** sun, −3.5 % →
**−1.9 %** shade; models off by more than 10 % on either side: **86 → 18**;
more than 15 %: **34 → 2**.

| verdict | models | what | fix |
|---|---|---|---|
| looks right | 105 | no correction applies, within 10 % on both sides | — |
| inference/tint wrong, rule fixed | 140 | `frame` #9daaa8 (builders' default grey-green, also whole claddings: ARCAM, Faralda crane, Nieuw Dakota) pulled to cream | mid-grey joinery (L 0.5–0.75) keeps its colour |
|  | 47 | grey brick (`greyBrick` #7d7871 …) took a hue cast from the saturation floor (olive, violet, teal) | grey brick (s < 0.12) keeps its saturation |
|  | 35 | light slate / lead / zinc (L 0.45–0.58) collapsed to the lightest city slate × cell: roof-heavy models −15…−25 % | slate above L 0.38 keeps its lightness |
|  | 7 | dark stone (Trippenhuis #7c7870, Haparandaweg bases) lifted to pale stone: +19 % | stone below L 0.5 keeps its colour |
|  | 6 | red/brown roofs named `slate` (American Hotel, Christ Church, fire station Dirk, Petrus en Paulus, Ronde Lutherse Kerk dome) went slate grey | brick hue, s ≥ 0.2 → pantile tint |
|  | 254 | stone and stucco cells (mean 228 / 243) read 10–20 % under flag off on stone fronts (Rasphuispoort, Haarlemmerpoort) | wall cells gained to mean 1, like brick |
|  | 3 | BAG year is a rebuild year (Westerkerk, Rijksmuseum, Hollandsche Schouwburg) | sourced construction year |
| within 10–21 %, by design | 18 | the lit level (−10 % on pale stone/stucco: Scheepvaartmuseum, Trippenhuis, Pathé de Munt); dark brick lifted into the city brick range (Chassekerk +15 %, Haparandaweg 902-950 +21 %) | none: palette rule |
| needs the builder | 3 | Uilenburger synagoge, Podium Mozaïek: brown-grey roofs (s 0.15–0.2) named `slate` read slate grey; American Hotel's orange sandstone reads paler | tag the roof `roofTile` / the sandstone `accent` in the builder (GLB + lod1 re-export) |

Rows overlap (a model can hit several rules); 194 models are touched by at
least one of the five tint corrections, 63 of them were more than 10 % off
before. The corrections live in `cityLookTint` (flag on only; `cityTint` and
the legacy recipe look are unchanged); each fired for ≥ 6 models except the
sourced years, so no builder material was re-tagged in this pass.

Flag on, slot materials follow the Building look (cartoon bands, untextured
flat colour) and the active landmark highlights in the facade answer yellow.

#### Cost and the default flip (desktop, 2026-10-13, after the review)

`scripts/ride-perf-fixed-route.mjs` (Anne Frank Huis → Rijksmuseum, 1440×900,
20 s ride, two alternating rounds, bundles rebuilt from this source):

| flags | frame median / p95 / p99 ms | frames > 50 ms | three.js layers ms/frame | MapLibre render median ms | draw calls | building textures |
|---|---|---|---|---|---|---|
| off | 16.7 / 16.7 / 16.8 | 0 | 0.74, 0.78 | 1.9, 2.0 | 407 | 98 MB |
| `?sharedFrame=1` | 16.7 / 16.7–16.8 / 16.8 | 0 | 0.90, 0.89 | 2.1, 2.0 | 407 | 98 MB |
| `?sharedFrame=1&cityLook=1` | 16.7 / 16.7 / 16.8 | 0 | 0.89, 0.85 | 2.1, 1.9 | 407 | 103.5 MB (+5.5) |
| `?cityLook=1` (legacy layers) | 16.7 / 16.7–16.8 / 16.8 | 0 | 0.73, 0.76 | 1.8, 1.8 | 407 | 98 + 5.5 MB slot-only array |

Frames are vsync-bound in every configuration; the city look adds no frame
time and no draw calls (the shared frame costs ~0.1 ms of three.js work with
or without it). The slot table is now 11 layers (+2 variants): +5.5 MB at
256² desktop (was +4.5 MB), +1.4 MB at 128² on touch (computed, not yet
measured). Flag off renders pixel-identically (look-consistency: 0 px in 3 of
4 shots, the Dam's 182 px / 0.025 % is far-skyline streaming noise that two
runs of the same bundle also show).

**Recommendation: flip both together** (`sharedFrame` and `cityLook`), desktop
first, not `sharedFrame` alone. Under the shared rig without the city look the
three pipelines disagree by 4.3–5.8 % on brick and landmarks keep private flat
colours; with it they agree to 0.15 %, brick sits in the band, the highlight
keeps its shading, and 293 of 311 gallery models land within 10 % of their
flag-off brightness (the other 18 by palette rule). Before the flip: rebuild
the three-buildings, building-types, signature-placement and
signature-landmarks bundles; publish `bagYear` into the placement catalogue
(`scripts/landmarks/landmark-bag-years.ts`, otherwise every landmark keeps the
canal brick, which is the pre-review look); measure iPhone 13 at 4× before
flipping on touch.

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
