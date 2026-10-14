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
- **Sun:** azimuth **215°** (south-south-west), elevation **40°**, `#ffe9cc`,
  intensity **2.15**. Shadows fall north-north-east, so canal-belt street
  facades stay mostly lit. (The spike used 225°/34°; the game keeps 215°/40°.)
  A summer afternoon: high enough that streets are not in permanent shadow,
  low enough that walls separate by orientation.
- **Sky:** hemisphere `#e3ebf6` over ground `#998a72`, intensity **1.75**.
- **One sun in every frame, not only the shared one** (lane sun-and-mood,
  2026-10-13). `lightRig.ts` exports `SUN_DIRECTION`, the bake
  (`bakedWallShade`, `bakedFaceShade`, `BAKED_SHADE_GLSL`),
  `enuDirectionInLocal` and `mapLibreSunPosition`; nothing else may hold a sun
  direction. `tests/e2e/sun-heading.spec.ts` turns the rider through four
  headings beside a free-standing tower and asserts: each wall seen from two
  headings within 10 %, the sun-facing wall brighter, the bike's lit half on
  the sun's side, every legacy landmark's sun at 215°/40°.
- **Why the sun "moved with" the rider** (user, 2026-10-13). Legacy custom
  layers fold a model's placement into the camera's projection, so their
  lights lived in model space. Measured before the fix: the bike's key light
  pointed at world azimuth 64/208/244/277° at headings 314/44/134/224 (it
  turned with the bike, and sat *below* it: the bike looked identical at every
  heading, luma 113.4 ± 0.7, left/right halves 108/119 always); the 71 legacy
  landmarks around the Dam had their keys anywhere from 9° to 339° (209° plus
  each model's placement rotation); the streamed city baked its light from the
  north-west (north wall 140 vs west 129 on the test tower) while MapLibre's
  extrusion light and the shared rig came from the south-south-west. After:
  bike and every landmark at 215°/40°, bike luma 108–117 by heading, the
  tower's sun-facing wall brightest. Tree crowns also took their sky from the
  north (hemisphere "up" was +y in an east/north/up frame); now +z.
- **Shadows:** one sun shadow map, **2048²** desktop / **1024²** phone, box
  half-size 160 m at z18 doubling per zoom step (100–640 m), texel-snapped,
  redrawn only when the box steps **16 m** or casters change. Off below z15.
  Cost at the flip: see §Mood, "Shadows".
- **Shadow fill: half the sun reaches into cast shadow** (`SHADOW_FILL` **0.5**
  in `lightRig.ts`, three's `shadow.intensity` 0.5; look/shadow-fill lane,
  2026-10-14). A surface in another surface's shadow keeps half its direct
  sun on top of the sky. Walls facing away from the sun are untouched (they
  get no sun anyway), and so is every lit pixel: the fill only lifts what the
  shadow map darkens. Rule: in cast shadow, a sun-facing wall reads halfway
  between its shade-side and sun-side values; the city's reference brick
  `#9a5240` on a sun-facing wall stays at luma **≥ 70** in every pipeline,
  and a lit wall reads exactly as with shadows off
  (`tests/e2e/building-look.spec.ts` "shadow fill"). Measured on a south wall
  under the rig, sRGB luma, sky-only fill (before) → fill 0.5:

  | brick | generic | recipe | landmark | city generic / recipe / landmark | in sun |
  |---|---|---|---|---|---|
  | `#808080` | 72.7 → 92.6 | 69.7 → 87.9 | 72.0 → 90.7 | 71.8 / 74.9 / 74.9 → 90.5 / 94.1 / 94.1 | 102–109 |
  | `#9a5240` | 55.8 → 73.1 | 58.4 → 74.5 | 55.9 → 72.2 | 59.8 / 59.8 / 59.9 → 76.3 / 76.4 / 76.4 | 84–89 |
  | `#6f4335` (dark) | 41.2 → 55.9 | 47.5 → 61.1 | 42.2 → 55.0 | 48.4 / 48.5 / 48.5 → 62.3 / 62.4 / 62.4 | 65–73 |

  Fill 0.45 left the landmark's reference brick at 70.0 (no margin); 0.5 is
  the smallest round value with every pipeline ≥ 72. A west wall (less sun)
  in shadow reads 2–5 lower. Ambient-only fill (raising the sky) was not used:
  it would lift the shade sides out of their 65–75 band (§Parity).
- **The shadow map is drawn at the full depth range** (`sharedFrame.ts`
  `fullDepthRangeForShadowMap`; same lane). MapLibre draws a 3D custom layer
  with `gl.depthRange(0, k)` (`depthRangeFor3D`, k = 0.968 measured in the
  game), and that GL state also applied to three's shadow pass into its own
  framebuffer. Every depth in the shadow map was scaled by k while receivers
  compared against the unscaled light depth, so a surface at light depth z
  met a phantom occluder (1 − k)·z nearer the sun: ~10 m in the middle of a
  600 m box. Sun-facing walls shadowed themselves more the further they sat
  from the light: the Royal Palace 95 % of its pixels, the Nassaukade 318
  chunk 64 %, 45 % of all building pixels at the Dam (3 %, 6 %, 2 % after).
  It is why a CPU ray cast toward the sun found an occluder at only 8 % (chunk)
  and 1 % (Palace) of the pixels the screen showed in shadow, and why no bias
  helped: normal bias 2 m left 48 % / 90 %, depth bias −0.01 (6.5 m) 37 % /
  90 %, a 4096² map or `shadowSide` front/double changed nothing. After the
  fix the CPU rays and the screen agree (96 % of the chunk's shadowed pixels
  have a ray-cast occluder, its own gables and dormers; the Palace's residual
  3 % is mostly penumbra, 37 % ray-cast). The main pass keeps
  MapLibre's range so its depths still compare with MapLibre's extrusions.
  `renderer.shadowMap.fullDepthRange = false` restores the old behaviour for
  before/after shots (`tests/e2e/shadow-fill.spec.ts`).
- **In-game measurements** (`tests/e2e/shadow-fill.spec.ts`, 1280×800,
  `?sharedFrame=1&streetChunks=1`, plain / `cityLook=1`): share of the named
  model's or the buildings' pixels the shadow map darkens, share under luma
  60, mean luma of the shadowed pixels; before = main before 2026-10-14,
  after = depth-range fix + fill 0.5.

  | spot (mask) | shadowed | under luma 60 (no casting) | shadowed luma |
  |---|---|---|---|
  | Royal Palace (model) | 95 → 0.8 % / 95 → 0.8 % | 29 → 0.1 % (0.1) / 29 → 0.1 % (0.1) | 84 → 136 / 84 → 128 |
  | Nassaukade 318 chunk (model) | 64 → 4.9 % / 64 → 4.5 % | 52 → 6.6 % (5.5) / 38 → 4.0 % (3.3) | 56 → 76 / 64 → 85 |
  | Nassaukade (buildings) | 21 → 3.1 % / 21 → 3.0 % | 15 → 2.1 % (1.7) / 11 → 1.6 % (1.3) | 60 → 87 / 66 → 87 |
  | Prinsengracht east bank (buildings) | 7.0 → 1.3 % / 6.9 → 1.3 % | 11.4 → 10.2 % (10.1) / 15.3 → 13.6 % (13.5) | 83 → 118 / 77 → 107 |
  | Nieuw-West slabs (buildings) | 0.5 → 0.2 % / 0.4 → 0.2 % | 2.5 → 2.5 % (2.5) / 2.9 → 2.9 % (2.9) | 111 → 134 / 101 → 120 |

  Pixels no configuration shadows (sun sides and the walls facing away) did
  move by more than 2 at any spot (PCF penumbra edges under the 6-luma
  threshold). "Shadowed luma" after is over the few pixels
  still in true shadow, mostly sun-facing walls, hence often above the mean.
- **Materials are diffuse only** (Lambert, or Standard at roughness ≥ 0.8 for
  the facade atlas). No GGX hotspots on landmarks (`landmarkShading.ts`).
- **Legacy (flag off) is baked:** the streamed city bakes the rig's sun into
  vertex shade: walls **0.84–1.0** by azimuth (0.8–1.0 before the mood pass),
  other faces `0.58 + 0.42·max(0, n·L)` with L at the sun's azimuth and the
  bake's own 53° (so a flat roof keeps 0.916), down faces 0.5. Recipe houses,
  building types and the unlit city look use the same GLSL. Legacy landmarks,
  vehicles, trees and ARTIS keep their own intensities but aim them from
  `SUN_DIRECTION`. MapLibre's extrusion light is `[1.25, 215, 50]`.

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
- Roofs: one table (`ROOF_TONES`, `FLAT_ROOF_TONES`); pantile reds and slate
  greys; flat roofs are **three kinds**, never one grey and never a wall
  colour: warm gravel `#9e9281`, pale membrane `#c3c1bb`, dark bitumen
  `#56585e` (§Mood). Which kind a roof is belongs to the roof-slot lane
  (orthophoto); how each kind looks belongs here.
- Measured roofs (2026-10-13): `ROOF_SLOT_TONES` holds twelve slots (gravel,
  bitumen dark/light, white membrane, pantile red/dark, slate, zinc, sedum,
  solar, terrace, glass), each with a base and an sRGB luma band. The
  roof-facts sidecar (PDOK orthophoto, `scripts/roofs/`) picks the slot per
  pand; `roofSlotHex` moves the base 3/4 of the way to the measured colour, caps the
  saturation at the base's + 0.12 and pulls it into the band. No slot is ever
  drawn outside its band (`look/roofSlotBands.test.ts`). The slot lane decides
  *which* slot; this table decides how a slot looks.
- Ground (own ground): the street surfaces (klinker carriageways, red cycle
  asphalt, grey-rose klinker pavements, kerbs, rails, bollards) take the
  measured Amsterdam vocabulary in `STREET_GROUND`; land, squares, gravel,
  parks, parking and water take the mood pass's `GROUND_TONES` (water
  `#46707c`, matte: roughness 0.65, no sun disc). Foliage: `foliageDisplayHex` (yellow-greens +8° hue).
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
real materials, real rig). Measured 2026-10-13 after the mood pass (warmer
sun, warmer bounce; before it in brackets), mean sRGB luma 0–255:

| wall | generic | recipe | landmark | spread |
|---|---|---|---|---|
| south (sun) | 108.3 (108.2) | 102.4 (102.1) | 106.0 (105.7) | 5.7 % |
| west | 99.4 (98.9) | 94.1 (93.4) | 96.9 (96.5) | 5.6 % |
| north / east (sky only) | 72.7 (70.7) | 69.7 (67.7) | 72.0 (70.0) | 4.3 % |

City look under the same rig: south 105.4 / 109.4 / 109.4, west 96.8 / 100.5
/ 100.6, north and east 71.8 / 74.9 / 74.9 (generic / recipe / landmark); the
shade side sits at the top of its band on purpose, so do not raise the sky or
the bounce again without lowering something else.

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
slate, flat roof, then the variants **brick20**, **whiteStucco** and **glassTint**),
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
- **Measured colours** (material extras `tintSource: 'measured'`, written by
  the large-recipe fit for the wall, arch-ring and own glass slots of the
  groups in `intent.measured`): brick/accent skip the city clamp
  (`cityMeasuredWallTint`, authored hex ÷ the canal brick mean) and always
  sample the canal brick, never `brick20`, whose lighter mean drew a measured
  wall 0.02–0.03 L light. Glass samples the appended **glassTint** layer, the
  pane's gradient and sky streak in grey (188–255, `glassTintCellValue`), with
  `cityMeasuredGlassTint` (hex ÷ its mean); unmeasured glass keeps the
  blue-grey pane and a white tint, so dark and reflective glass used to draw
  the same pane. Proof: `scripts/look/measured-walls.ts` renders the three
  measured pilots through both game looks and measures every measured
  material (÷ the baked shade) against its hex: all within 0.02 L
  (`docs/images/look/measured-pilots.jpg`, Playwright "re-fitted recipe GLB").
  Sheets (`scripts/building-recipes/render.ts`) always draw through a game
  look (`--city-look [--year=]` for this one); the `--textures` trial tiles,
  which drew raw GLB colours under a PBR rig and showed dark measured walls
  near-black, are retired.

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

## Mood (lane sun-and-mood, 2026-10-13)

User: "the whole city is a little dark/dour", then on a Kinkerbuurt aerial
"so much grey". The cause was not the walls under the rig (they sat in their
bands) but everything around them: flat roofs, streets, pavements and water in
one mid-grey band, a cold bounce on the shade sides, olive trees, teal-black
canals under the own ground. The pass, inside the §Parity bands:

- **Rig:** warmer sun `#ffe9cc` ×2.15, less blue sky `#e3ebf6`, lighter warm
  bounce `#998a72` (§Light). Shade sides +2 luma, sun sides unchanged.
- **Bake (flag off):** walls 0.84–1.0, from the sun's azimuth (§Light).
- **Flat roofs:** gravel / membrane / bitumen (`FLAT_ROOF_TONES`), and the
  citywide caps follow them (§Palette). The grey left in the Kinkerbuurt shot
  is mostly *walls*: the citywide wall priors `priorModernGrey` /
  `priorModernLight` on whole blocks. Not changed here (it is a wall-prior
  question, not light); the next candidate.
- **Own ground:** `GROUND_TONES`: pavers lighter and warmer, klinker warm
  grey-rose, asphalt darker and cooler than the klinker, water `#46707c`.
- **Trees:** `foliageDisplayHex`, and the legacy tree layer's sky now comes
  from above (it came from the north).

`tests/e2e/mood-shots.spec.ts` shoots seven spots from the sun side (rider
facing away from the sun) and the shade side, in the default frame, the flip
(`?sharedFrame=1&cityLook=1`) and the own ground (`?ownGround=1&cityLook=1`):
Dam, Westerkerk, Rijksmuseum, Bilderdijkstraat, Osdorpplein, the Amstel from
the cockpit, and the Kinkerbuurt aerial (Ten Katestraat, 200 m, looking
north-east; the acceptance shot for "so much grey"). "Buildings" are the pixels
that change when the streamed buildings and landmarks are hidden; "rest" is
ground, water, trees, sky. Means of the 14 shots, before → after:

| frame | building luma | building sat | rest luma | rest sat |
|---|---|---|---|---|
| default | 95.0 → 96.3 | 0.281 → 0.285 | 209.3 → 210.4 | 0.176 → 0.177 |
| flip (`sharedFrame` + `cityLook`) | 77.8 → 79.5 | 0.305 → 0.309 | 207.7 → 207.9 | 0.170 → 0.177 |
| own ground + city look | 77.9 → 82.0 | 0.285 → 0.291 | 99.8 → 114.0 | 0.255 → 0.295 |

Kinkerbuurt aerial, sun side: default buildings 101.1 → 110.1; flip 90.7 →
94.1 (sat 0.284 → 0.293); own ground buildings 87.1 → 92.6, rest 100.9 →
114.0 (sat 0.242 → 0.295). Sun-side/shade-side building luma in the default
frame went from 0.91–1.03 (no time of day: the bake lit the north-west, the
views face north-east and south-west) to 1.02–1.34; in the flip it stays
1.04–1.20. The default frame's ground is MapLibre's basemap and did not
change; its shade-side buildings got darker where the old bake lit them from
the wrong side (Rijksmuseum shade 94 → 77) and lighter where it did not.

### Shadows at the flip

Fixed route (Anne Frank Huis → Rijksmuseum), desktop 1440×900, 20 s, two
alternating rounds, bundles built from this source:

| run | frame median / p95 / p99 ms | > 50 ms | three.js ms/frame | MapLibre render median / p95 | shadow redraws |
|---|---|---|---|---|---|
| flip, shadows on | 16.7 / 16.8 / 16.8 (both) | 0, 1 | 1.12, 1.81 | 2.5 / 3.7, 3.7 / 7.4 | 31, 30 |
| flip, `shadows=0` | 16.7 / 16.7 / 16.8 (both) | 0, 0 | 1.57, 1.68 | 3.5 / 4.8, 3.7 / 5.2 | 0 |
| default | 16.7 / 16.7 / 16.8 (both) | 0, 0 | 1.67, 1.41 | 3.8 / 5.6, 3.5 / 4.9 | — |

Frames are vsync-bound in every run; the shadow map redraws ~1.5 times a
second while riding (box steps of 16 m), and its cost is inside run-to-run
noise (three.js 1.1–1.8 ms with or without it). The shadows are what make the
shared frame read as a place at a time of day (walls separate, trees and
landmarks sit on the street), so **keep them on at the flip on desktop**;
touch keeps the 1024² map and needs its own iPhone 13 4× measurement first.

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
  highlight before the answer (CLAUDE.md product principles). The highlight's
  coral `#ff8033` is the destination's one accent in the world (the lit
  building's outline, ring and beacon, the HUD finish arrow and pin, the
  destination label, the locator dot); the old yellow `#ffd21f` survives only
  under `?highlight=yellow`.
- Trivia/neighbourhood cards stay compact at the bottom; nothing in the 3D
  frame competes with them for saturation (no bloom, no saturated sky).

## Highlight (the destination / the tapped building)

User 2026-10-13: "The yellow highlight is bad." **Style a is the default** (since
2026-10-13); `?highlight=yellow` keeps the old yellow for comparison, `?highlight=b|c`
the other candidates (`look/highlight.ts`, `look/highlightMarker.ts`), through every
building pipeline (landmark GLBs, recipe houses, recipe tiles, building types, generic
extrusions, MapLibre's fallback extrusions, 3DBAG detailed mode) in both frames.
Candidate sheets:
`docs/reports/highlight-redesign-20261013/sheet-{default,shared}-{chase,saddle}.jpg`
(Westermarkt block, Westerkerk, Rijksmuseum, an Oud-West terrace house).

- **a) outline + ground ring + beacon**: materials kept; 2-px inverted-hull outline
  (back faces, 0.3 m behind the surface) in the accent; a soft 4 m band on the ground
  round each footprint; a 3-px beacon above the roof, full to 150 m, 30 % beyond 900 m.
- **b) rim + pulse + ring**: additive fresnel rim (power 2.2, 55–100 % over 2.4 s).
- **c) desaturate the rest + ring**: buildings within 60 m (centroid) lose 40 % saturation.
- **Accent `#ff8033`** (orange-coral). Colour-blind check (Machado 2009, CIELAB ΔE76
  against brick, dark brick, pantile, slate, stucco, street, canal, sky, trees): min ΔE
  40 normal / 25 protan / 38 deutan / 24 tritan. CSS coral `#ff7f50` drops to 14 (protan,
  trees); the **HUD accent `#b4682c` fails** (17 normal, 9 protan, 6.5 tritan against
  pantile): it is a brick colour, and on the sheets its pixel count is mostly ordinary roofs.

Cost (desktop 1440×900, parked, 180 forced frames off → on, `scripts/highlight-perf.mjs`):

| style | extra draw calls | MapLibre render ms (median) | three.js layers ms | first highlight / later | other |
|---|---|---|---|---|---|
| yellow | 0 | 2.0–2.9 → 2.0–3.0 | 0.1–0.6 | 0.6 / 0.2 ms | — |
| a | +22–26 (one outline per GLB mesh, ring, beacon) | within ±0.5 (noise) | ±0.1 | 20 / 4 ms | none |
| b | +20–24 | within ±0.7 | ±0.1 | ~20 / 4 ms | **redraws every frame while shown** (the pulse): 2.5–4.4 ms CPU per vsync when the map would idle |
| c | +2 (ring) | within ±0.2 | 0 | 27–37 / 4 ms | prism index of every resident chunk on the first highlight |

Default-a sheets (yellow beside a, both frames, chase and saddle):
`docs/reports/highlight-redesign-20261013/default-a/sheet-{default,shared}-{chase,saddle}.jpg`.

- **Outline width by distance** (`outlineWidthPx`): 2 px to 100 m, linear to 3.5 px at
  300 m, by the camera's distance to the building's centre (one width per outline, in
  the vertex shader). Measured (`scripts/highlight-outline-width.mjs`, 1280×800, the
  outline isolated by diffing against `__canalRecallHighlightOutlinePx = 0`; local
  width = shorter accent run through each pixel): Oud-West terrace chase (213 m) mean
  1.73 → 2.40 px, 446 → 661 px of outline (shared frame 1.60 → 2.25); Westermarkt
  chase 1.66 → 2.22; saddle (83–86 m) unchanged at 1.76–1.80 px.
- **Marker above the city** (default frame): the ring and beacon do not write depth,
  and the three.js city (added after the marker) painted over them wherever a building
  stood behind; at the terrace only 830 px of ring and a stub of beacon survived. The
  marker layer moves after the last 3D layer on every highlight (`markerSlot`).
- **MapLibre fallback** (three.js does not own the city): feature-state `accent`
  instead of the yellow `highlighted` fill (no +12 m box, facade kept), a 3-px coral
  footprint casing under every building layer, and the marker's **hull** (the outline
  pass round an invisible prism of the footprint, from `GeoJSONSource.getData()`) when
  no model or pipeline outlines the building. The ring hugs that footprint too.
- **3DBAG detailed mode**: the hit feature of the batched tile keeps its faces and gets
  the outline pass restricted to its `_feature_id_N` (`highlightFeature`); the marker
  follows it. Not verified live: 3DBAG tiles load no meshes in headless Chrome.
- Cost re-measured (desktop, 180 frames, `perf-desktop.jsonl`): a +26 draw calls at the
  Westermarkt, +22 at the Westerkerk, both frames; MapLibre render median within the
  yellow's own run-to-run spread (yellow 3.0–5.0 ms, a 3.3–4.4 ms); three.js layers
  ±0.2 ms. iPhone profile pending.

**Recommendation (shipped as the default 2026-10-13): a**. It is the only candidate that still points at the building when the
building is small or half hidden (the beacon over the roof, the ring at the street
edge), it keeps the building's own colours (so the player learns the building, not a
yellow box), it adds no per-frame work, and the ring hugs the footprint without naming
any street. b reads as a pink wash on flat-shaded walls from the chase height and costs
a frame every vsync; c is too subtle to find a building by (the 60 m neighbours lose
colour, the target does not gain any) and it costs the largest hitch.
Gaps closed by the default lane (above): the fallback extrusions and 3DBAG take the
accent, the outline widens at chase distance. 3DBAG mode is still unverified live.

- **Small targets** (2026-10-14; `smallTargetBoost`, `footprintShare` in
  `look/highlight.ts`, the marker in `highlightMarker.ts`): an ordinary terrace house
  from the chase camera carried 0.08 % accent pixels against 0.55 % under the yellow.
  Each frame the marker measures the lit footprint on screen: its equivalent circle
  (radius √(area/π)) projected at the roof, the largest of four offsets (the one across
  the view is not foreshortened; the perspective form of `footprintRadiusPixels`, which
  uses the map-centre zoom), as a share of the frame. Under **1 %** the boost is full; it
  fades out (smoothstep) by **2 %**. With the boost: a **coral roof wash** (a third pass of
  the lit geometry, upward faces only, cos ≥ 0.35 from vertical, unlit, polygon offset,
  no depth write; on MapLibre's fallback the top cap of the hull prism) at **0.75 ×
  weight**, and the **beacon raised** to 1 + 2 × weight × (1 + shortfall)/2 of its 45 m
  and widened from 3 to 4 px. Walls are never washed: the facade stays the building's own
  from the saddle (where the terrace covers 8 % and gets no boost). The wash pass is not
  drawn at all without a boost (no draw call for a large building). The wash reads only
  above ~0.75 on a dark slate roof (terrace chase share by alpha: 0.55 → 0.13 %, 0.65 →
  0.15 %, 0.70 → 0.22 %, 0.75 → 0.69 %: below that a dark roof turns rust, not the accent).
  Not on a 3DBAG batched feature (its frame is unverified). Gate:
  `tests/e2e/highlight.spec.ts` (terrace chase ≥ 0.3 %, cleared with the card).
  Measured (`scripts/highlight-outline-width.mjs`, 1280×800, before → after; footprint
  share and boost weight from the marker; outline = mean local width, CSS px):

  | frame | spot | view | distance m | footprint share | boost | accent pixels % | outline px |
  |---|---|---|---|---|---|---|---|
  | default | westermarkt | chase | 212 | 2.6 % | 0 | 0.20 → 0.20 | 2.44 → 2.45 |
  | default | westermarkt | saddle | 85 | 19.7 % | 0 | 0.73 → 0.73 | 1.81 → 1.82 |
  | default | westerkerk | chase | 200 | 18.5 % | 0 | 0.25 → 0.25 | 1.83 → 1.83 |
  | default | westerkerk | saddle | 117 | 82 % | 0 | 0.73 → 0.73 | 1.92 → 1.92 |
  | default | rijksmuseum | chase | 224 | 55 % | 0 | 0.56 → 0.56 | 2.26 → 2.26 |
  | default | rijksmuseum | saddle | 149 | > 100 % | 0 | 0.84 → 0.84 | 2.25 → 2.24 |
  | default | oudwest-terrace | chase | 213 | 1.0 % | 0.99 | **0.08 → 0.69** | 2.41 → 2.72 |
  | default | oudwest-terrace | saddle | 83 | 8.0 % | 0 | 0.21 → 0.21 | 1.78 → 1.79 |
  | shared | westermarkt | chase | 212 | 2.6 % | 0 | 0.20 → 0.20 | 2.41 → 2.40 |
  | shared | westermarkt | saddle | 85 | 19.6 % | 0 | 0.71 → 0.71 | 1.76 → 1.77 |
  | shared | westerkerk | chase | 200 | 18.5 % | 0 | 0.25 → 0.25 | 1.78 → 1.79 |
  | shared | westerkerk | saddle | 117 | 82 % | 0 | 0.73 → 0.73 | 1.82 → 1.81 |
  | shared | rijksmuseum | chase | 224 | 55 % | 0 | 0.57 → 0.57 | 2.13 → 2.14 |
  | shared | rijksmuseum | saddle | 149 | > 100 % | 0 | 0.84 → 0.84 | 2.23 → 2.23 |
  | shared | oudwest-terrace | chase | 213 | 1.0 % | 0.99 | **0.08 → 0.68** | 2.27 → 2.57 |
  | shared | oudwest-terrace | saddle | 83 | 8.0 % | 0 | 0.20 → 0.20 | 1.76 → 1.77 |

  The terrace's outline reads wider after because it now runs over the wash as well as
  the slate. The Westermarkt block from the chase (2.6 %) stays unboosted at 0.20 %.
  Sheets (yellow, a before the boost, a after):
  `docs/reports/highlight-redesign-20261013/small-target/sheet-{default,shared}-{chase,saddle}.jpg`.
  Storybook: `Canal Recall/Landmark highlight` → SmallTarget* (desktop and phone,
  the fallback hull, a long name).

## Labels (POI names, `src/canalRecall/labels/`, 2026-10-13)

- **One layer, the HUD's language.** POI names are a DOM layer over the map
  (above the game canvas, below DOM cards), not MapLibre symbols: MapLibre's
  glyphs cannot set the plaque face. Ink from `LABEL_INK` (`look/palette.ts`):
  the plaque's warm dark `#1f1c17` on a thin paper halo (default), or paper on
  an ink halo (`?labelTone=paper`, kept for comparison; heavier on brick).
  `?labels=maplibre` restores the old symbol layers.
- **Type by class:** landmark 15 px Barlow Condensed 700, uppercase, tracked
  0.06 em (only landmarks and the destination are set in caps); museum/church
  14 px 600; civic 13 px 600; hotel/shop/café 11 px UI face, muted ink. A
  stem and a leader dot mark the POI. The destination is a paper chip with a
  copper arrowhead (the destination card in miniature).
- **Budget** (`labelBudget`): 6 at a rider's eye rising to **12 at 250 m**,
  scaled by √(screen area / 1440×900), never below 4. Priority: destination,
  game landmarks, museums and churches, civic, then venues; shops, cafés and
  hotels only within **80 m** of the rider.
- **Fade** (`distanceFade`): full to max(160 m, 2.2 × camera height), gone at
  2.5× that.
- **Occlusion:** a label is hidden when the first building surface on the ray
  to its anchor (three.js city, signature landmarks, tile buildings: the same
  pickers as a click) stands clearly in front of it on the ground — the
  pickers' depths are in different clip spaces, so the test compares the
  camera's ground distance to the hit footprint with the anchor's. A POI's own
  building (footprint, landmark id, or within its reach) never hides it.
  Two consecutive verdicts change a label's state (no flicker).
- **HUD:** no label box within 6 px of the plaque, destination card, compass,
  trip, minimap, controls hint, d-pad, an open landmark card, the question
  prompt or the landmark panel.
- **Never the question:** the shared POI rule (no quiz-eligible name, nothing
  during a quiz) plus the asked name as a word or a compound prefix
  ("Keizersgrachtkerk" while the Keizersgracht is asked); the destination is
  the only label left during a quiz, masked as the HUD card is
  (`scripts/check-recall-rules.ts`).
- Measured (`tests/e2e/labels.spec.ts`, desktop 1440×900): Damrak at 250 m
  **132 → 10** labels, 17 → 0 over the HUD; Dam from the air 6 MapLibre
  (brand icons only) → 12; Nieuw-West 21 → 3; Westerkerk at 1.7 m 9 → 1.

## How reviews cite this

- A light or mood change runs `tests/e2e/sun-heading.spec.ts` (the sun stays
  put at four headings) and `tests/e2e/mood-shots.spec.ts` before/after
  (`MOOD_OUT=…`, `LOOK_BUNDLES_DIR=…` for unbuilt source), and quotes the
  luma/saturation table against §Mood.

- Gallery and release reviews look at gallery-size renders from all sides,
  then cite the section that a flaw breaks ("LOOK §Parity: recipe house 20 %
  darker than its neighbours") and attach the look-parity JSON or a
  `scripts/compare-look-shots.mjs` diff.
- Before/after for any look change: `LOOK_SHOTS_OUT=… PW_OFFLINE_MAP=1
  npx playwright test look-consistency` (add `LOOK_SHOTS_QUERY='?sharedFrame=1'`
  for the rig), then `node scripts/compare-look-shots.mjs <before> <after>
  --crop-top=240 --diff-out=<dir>`. Flag-off changes must be pixel-identical
  unless the review approves a default-look change.
