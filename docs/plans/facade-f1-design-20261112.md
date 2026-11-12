# F1 design: the parametric facade renderer (`?shaderFacades=1`, desktop)

Lane F1-design, issue #380, 2026-11-12. Programme: the facade programme plan (`typed-jumping-karp`, F1 section).
Read from `main` at 659f8fc72 (origin/main was at cf6b8b27d, behind local main; the published world-v1 of this
checkout is the one measured). This document is the build spec for the Opus lane; it decides everything the brief
asked and lists what it disagrees with under "Open questions". Nothing here is built; the only code added is the
measuring script `scripts/world/facade-record-cost.ts`.

## 0. The three numbers

| Number | Value | How measured |
|---|---|---|
| Record bytes per pand | **64 B** (4 RGBA32UI texels); Centrum's densest cell `-2_0` 3,568 pands = 223 KB, the Dam resident set (46 cells, 83,166 pands) = 5.1 MB, the city 21 MB | §1 layout; counts from `facade-record-cost.ts` over the published shells |
| Buffer MB saved | **−117 MB at the Dam resident set** (243.3 → 126.1 MB buffers + 5.1 MB records; −48 %); city-wide 666.8 → 319.6 MB; scaled to R4-I's measured aerial peak (205–211 MB, 6.55 M vertices) ≈ 95–100 MB + the 16.8 MB record texture: **aerialGlMaxMB 759 → ~660** (legacy 4-byte figure) | §2, `node --import tsx scripts/world/facade-record-cost.ts` |
| Shader cost | **≈ 0.4 ms** fragment + ≈ 0.05 ms record fetch at Dam, DPR 2, replacing ≈ 0.5–1.0 ms of today's cell/aniso/windowSdf path; expected delta −0.3…+0.3 ms, under the 6-run noise floor of the GPU timer | §3.5, op count against the windowSdf read of 2026-11-07 |

## 1. The per-pand facade record

### 1.1 What it replaces

Today every SHEL/chunk vertex carries its look: `layer` (u8, an atlas row: 181 bay cells + 4 roof cells + masonry, 149
of them used by the published shells, ordinal max 198 with the `WINDOW_GRID_LAYER_FLAG` 64), `tint` (RGBA, shade in
alpha), `accent` (RGB), `thin` (2 B), `uv` (bay × storey repeats). The look is the painter's: the bay cell decides the
window count (1–3 per cell), shape, sash and trim for a whole style family, and a pand can only pick a row. That is why
`docs/house-line.md` §1 lists `doorBay`, `windowHeights`, `headLines`, `cornice`, `eavesHeight`, `palette.stone/cornice/frame`
as "not wired": there is no per-pand control in a bay cell.

The record moves the look off the vertex into one 64-byte row per pand (plus one per extra street front), indexed by a
per-vertex `rec` (u16). The shader lays out storeys and bays in wall metres and draws openings, brick, bands and
accents from the row. `layer` disappears from the record path (the flag-off path keeps it byte for byte).

### 1.2 Layout: 64 B = 4 rows × 16 B = 4 RGBA32UI texels

Byte offsets inside the row; every multi-byte field little-endian; `Src` is a 2-bit provenance class:
0 = default/prior (type family or buurt profile), 1 = inferred (row coherence, register element list, Jev), 2 = register
or hand fact (`monument-text`, `author`, `reviewed`), 3 = photo-measured (`streetlevel-measured`, pixel, `vision-judge`
at ≥ 0.8). The F3 ruling for accents: drawn from Src 2–3 only; Src 0–1 draws the type-family prior and the bit says so.

**Row 0 — pand** (shared by every wall of the pand)

| Bytes | Field | Source today (HouseSpecView `v` / styled props) |
|---|---|---|
| 0–2 | wallRGB (sRGB, the colour the mesher puts in `wallHex` today) | `v.wallHex` through `houseSpec/wallColour.ts` (`specWallSource` → `specWallDisplay` lift, `SPEC_WALLS` on); else `sideColour` (period palette). **The brief's `look/brickLift.ts` does not exist; this chain is what "post-brickLift-v2, default on" means** (`SPEC_WALL_LIFT`, H9). |
| 3 | wallMaterial:4 (brick, stucco, painted-brick, stone, concrete, glass, timber), wallSrc:2, lifted:1 (the H9 lift applied), reserved:1 | `v.wallMaterial`, `palette/wallMaterial`, `registerFinish` |
| 4–6 | frameRGB | `palette/frame` (1,349 pands), else the look's frame tone (`SpecLook.dark` → #2c302f, pale → #f1ede2, painted → #ffffff: `windowTable.ts windowOf`) |
| 7 | frameSrc:2, glassTone:3 (the `GLASS_STOPS` gradient index: default, calm-lifted, dark, reflective, shop), reserved:3 | `palette/glass`, look |
| 8–9 | wallHcm (u16): wall height from the pand base to the eaves the shader lays storeys on | spec `fronts/*/eavesHeight` (Src 2–3) else `roofEavesHeightM` (3DBAG, Src 0) else `height`; see §4.3 |
| 10 | plinthDm (u8): basement/plinth band height 0.1 m units (0 = none) | `fronts/*/basement`, `souterrain`, `plinth` (1,897 pands state basement) |
| 11 | seed (u8): the pand's jitter seed (`hash01(id)`), so bay rounding and brick phase vary per pand as today's `layoutScale` does | id |
| 12–14 | roofRGB | `roofColour` / `roofMeasured` |
| 15 | roofMaterial:4 (`ROOF_MATERIALS` + flat-bitumen + unknown), roofSrc:2, lid:1, reserved:1 | `roofSlot`, `roof/material` |

**Row 1 — street front** (wall kind 0; a second front gets its own 64 B record, see 1.3)

| Bytes | Field | Source |
|---|---|---|
| 0 | storeys (u8, ground included, 1–30) | `v.storeys` (1,338), else the style fit (`layoutRun`: `STYLE_DIMS` storey ÷ wallH) |
| 1 | groundDm (u8, 0.1 m) | `v.groundM` (806), `storeyHeights[0]`, `tallGround`; else `STYLE_DIMS.ground × layoutScale.ground` |
| 2 | upperDm (u8) | `storeyHeights` (966) normalised to wallH; else `STYLE_DIMS.storey`; diminishing 4 %/storey is encoded by atticDm |
| 3 | atticDm (u8, 0 = equal to upper) | `storeyHeights` last entry |
| 4 | baysGround (u8) | `fronts/*/bays` per-storey list, shopfront `displayWindows`; else = baysUpper |
| 5 | baysUpper (u8) | `v.bays` (928, `frontBays`); else `round(len / bayPitch)` with `seed` |
| 6 | baysAttic (u8, 0 = none) | `atticWindows` (194) |
| 7 | doorBay (u8, 255 = none) | `fronts/*/doorBay` (1,464); else today's `layout.doorBays` rule (centre-nearest eligible bay) |
| 8 | windowKind (u8, index into `WINDOWS` 0–23) | `fronts/*/windows` (1,464); else the style's default (canal: sash-6-over-6, c19: t-window, school: ladder, postwar/modern: plain) |
| 9 | windowHead:3 (`WINDOW_HEADS`), archRing:2 (`ARCH_RING_STYLES`), keystone:1, tympanum:2 (`TYMPANUM_FILLS`+none) | `fronts/*/windowHead` (441), `archRings`, `axisHeads` collapse to the majority |
| 10 | windowShare (u8/255, window width over bay width) | `windowShare` (499); else 0.58 (`facadeOpenings` legacy) |
| 11 | windowHeightQ (u8/255, upper-storey window height over storey height) | `windowHeights` (1,142; list → median of the uppers), `diminishing` → `DIMINISHING_WINDOW_HEIGHTS[1]`; else 0.60 |
| 12 | cornice:3 (`CORNICES`), corniceDepthDm:3, hoist:1, shutters:1 | `fronts/*/cornice` (1,464), `hoist` (1,616) |
| 13 | basement:2 (`BASEMENTS`), souterrain:1, stoop:1, balconies:1, bayWindow:1, tallGround:1, dormers:1 | spec fields; stoop/balconies/bayWindow/dormers are geometry flags the shader reads only to leave the wall blank behind an extra |
| 14 | statedMask: storeys:1 bays:1 windows:1 head:1 door:1 heights:1 cornice:1 ground:1 (1 = Src ≥ 2) | provenance keys (`s` in the extract) |
| 15 | mirrored:1, shareQ:7 (the front's share of the pand's street wall × 127, multi-front) | `fronts/*/share` (178), `crownHalf` |

**Row 2 — white-accent set** (the user's priority list: bands, surrounds, keystones, sills, quoins, arch rings)

| Bytes | Field | Source |
|---|---|---|
| 0–2 | accentRGB (stone/white paint) | `palette/stone` (1,261), else #f1ede2 |
| 3 | bands:3 (none, storey, lintel, both, courses, speklagen, painted), bandLines:3 (sill, transom, head bits), sills:1, quoins:1 | `fronts/*/bands` (298), `bandLines` (160), `windowSills`, `quoins` |
| 4 | speklagenSpacing (u8, courses) | `speklagen.spacing` (25 stated; the prior for 17th-c. fronts is 7) |
| 5 | speklagenCourses (u8) | `speklagen.courses` (default 2) |
| 6 | surround:3 (none, sill, stone-lintel, full-frame, keystone, eared-keystone), archRingColour:2 (`ARCH_RING_COLOURS`), quoinsKind:2, reserved:1 | `windowSurround` (537), `surroundStoreys` collapses to the majority |
| 7 | bandSillCm (u8) | `bandHeights.sill` (146; default 14) |
| 8 | bandHeadCm (u8) | `bandHeights.head` (default 17) |
| 9 | bandTransomAt (u8/255) | `bandTransomAt` (84; default 0.78) |
| 10–12 | bandRGB (speklagen / band brick) | `palette/band` (415), else accentRGB for stone bands, wall × 0.85 for brick courses |
| 13 | accentSrc: bands:2 surround:2 keystone:2 quoins:2 | provenance of each field (F3 ruling: Src 0–1 means "prior, inferred") |
| 14 | windowRevealCm (u8, 0–25) | `doorReveal`/`windowReveal` when stated; prior 11 cm for brick, 4 cm for stucco (#181's measured reveals) |
| 15 | doorRevealCm (u8) | `fronts/*/doorReveal` (200): `shallow` 12, `portiek` 90+ (capped 250) |

**Row 3 — ground band** (F2 owns the semantics and the GLSL of this row, §5; F1 fills the generic defaults)

| Bytes | Field | Source |
|---|---|---|
| 0 | groundKind:4 (residential, shop, warehouse, arcade, wall, garage, pui-glazed), groundSrc:2, awning:1, stallriserOn:1 | `v.shop` / `shopHex` (1,349 / 513), `facts/pui` (1,293), `shopKind`/`shopQuiet` (the shopfront extract), `GROUND_FRONT_KINDS` |
| 1 | entrance:3 (`SHOP_ENTRANCES`), glazing:2 (`SHOP_GLAZING`), stallriser:2 (`STALLRISERS`), fasciaOn:1 | `ShopfrontIntent` |
| 2–4 | fasciaRGB | `shopfront.colour`, `shopColour` |
| 5–7 | shopPaintRGB (today's `groundHex`) | `v.shopHex`, `shopColour` |
| 8 | displayWindows (u8) | `shopfront` count; else baysGround |
| 9 | fasciaHeightDm (u8) | prior 6 |
| 10 | stallriserDm (u8) | prior 7 |
| 11 | shopStoreys:1 (1 or 2), souterrainUnderStoop:1, ribbonStorey1:1, reserved:5 | `ShopfrontIntent.storeys`, the kit-gap list |
| 12–14 | doorRGB | `palette/door` (1,349), else the look's accent |
| 15 | reserved (F2) | |

Every enum is pinned in `src/canalRecall/look/facadeRecord.ts` (`FACADE_RECORD_VERSION = 1`, a table of field → byte
→ bits) and read by one pure `packFacadeRecord(view): Uint8Array(64)` / `unpackFacadeRecord`. A field no source states
takes the prior for the pand's style family (`FacadeStyle` canal/c19/school/postwar/modern/tower from `facadeStyle`)
and the buurt profile when `streetAppearance` names one; the prior is marked Src 0 and, where a row-coherence or
register-element inference filled it, Src 1.

### 1.3 Records per pand, fronts and wall kinds

- One record per pand (`rec = bid`, the cell's FOOT order, exactly as `bakedCellArrays` names ranges today) plus one
  record per **extra** street front (`fronts[1..3]`, 178 pands state `share`): the compiler appends them after the
  pand records; a vertex's `rec` is the record it draws from, its `wallKind` says how.
- `wallKind` (u8 per vertex): bits 0–2 kind — 0 street front, 1 exposed side, 2 rear, 3 party (blank brick), 4 the
  exposed strip above a lower neighbour (blank, no openings: slop's three-probe rule, our `BuildingContextIndex`
  neighbours), 5 corner chamfer; bit 3 mirrored; bits 4–7 reserved. The kind comes from the same tests the mesher runs
  now (`doorAllowed` street side from `shellStreets` / `streetSegments`, party walls from `wallCuts`): the record path
  changes no rule about which wall is the front.
- Non-front walls draw the pand's row 0 palette with the style prior layout (windows on `round(len / bayPitch)` bays, no
  door, no accents beyond sills): what the chunk does today for a side wall, now per pand instead of per cell.

### 1.4 Where the records live

- **File**: a new `FREC` stream in the shell file (`cellFormat.ts STREAM_TAGS`, after SHL1), `uvar records`, then the 64
  byte planes written field-major (each byte of the 64 as its own plane, so gzip sees runs: wallRGB of a street,
  storeys of a row). Estimate from the field entropies: 25–35 % of raw after gzip, i.e. 60–80 KB for `-2_0`, under
  the 1.3 MB its SHEL already costs. The cell's building file is untouched (`worldCellsCityMB` 10 MB gate unchanged).
- **GPU**: one city-wide `RGBA32UI` texture 256 × 4096 texels (64 records per row, 4 texels each; 16.8 MB, allocated once
  by `look/facadeRecordTexture.ts`), with a row allocator: a resident cell takes `ceil(records / 64)` rows (≤ 73 for
  the densest cell; 46 Dam cells ≈ 1,300 rows; 96 cells × 45 ≈ 4,300 worst case, so the allocator evicts with the
  tier). Each baked cell mesh and each runtime chunk sets `recBase` (its first row) in `onBeforeRender` on the one
  shared material, the way `cityFade` clones work today, so the program count does not grow. The fragment shader does
  4 `texelFetch` on a `usampler2D` (WebGL2 integer textures; no float packing, no uniform arrays, so no iOS fragment
  uniform limit later).
- **Who builds them**: `facadeRecord.ts packFacadeRecordFor(feature: styled Props + houseSpec view, style priors)` is
  pure and runs in three places: the world compiler (`scripts/world/shellBake.ts`, FREC beside SHEL), the building
  worker for a runtime chunk (`threeBuildingsWorker.ts`, the same styled features the mesher gets, so the detail tier
  and the baked tier draw one record), and `house:preview` (Node).

### 1.5 Budget, measured

`scripts/world/facade-record-cost.ts` on the published world-v1 (564 shells, 343,351 cell buildings incl. those with no
shell vertices):

| Set | Pands | Records at 64 B |
|---|---|---|
| `-2_0` (Grachtengordel-West/Jordaan, Centrum's densest by pands) | 3,568 | 223 KB |
| `-1_0` (Burgwallen/Nieuwmarkt, densest by vertices: 441k) | 3,275 | 205 KB |
| `-5_7` (city max, Noord) | 4,645 | 290 KB |
| Dam resident set (46 cells, the 3.5 M-triangle budget) | 83,166 | 5.1 MB |
| City | 343,351 | 21 MB (never resident) |

## 2. One quad per wall

### 2.1 Today, measured

The SHEL comment says "every window bay is its own quad"; the code (`threeBuildingMesh.ts` 633–696, `edgeGroundPieces`)
is subtler and the shells confirm it: per wall edge the coarse chunk writes one **upper** quad (UVs in bays × storeys),
one to three **ground** pieces (door bay separate, plain bays merged), a **parapet** quad, and a thin **cornice** strip
(two triangles), then `subtractWallCuts` splits them round party walls.

| City (564 shells) | Today | Record layout |
|---|---|---|
| Vertices | 22,812,905 | 14,944,755 (0.655) |
| Triangles | 10,309,408 | 7,099,852 (0.689) |
| Vertical wall quads → wall planes | 3,019,076 | 2,138,817 (1.41 quads per plane; per building median 8 quads → 6 planes, mean 11.3 → 8.0) |
| Thin strips (trim 7.8 %, frontage 8.0 %, cornice 3.3 % of vertices; `thinFade` classes) | 1,449,038 tris | 0 (the record draws bands and cornices; §4 instances the projecting ones) |
| Roofs and lids (solid roof 10.2 %, lid 7.5 %, other 4.4 %) | 2,822,218 tris / 6,389,487 verts | unchanged |
| GPU bytes (26 B/vertex + indices today; 18 B/vertex + indices after) | 666.8 MB | 319.6 MB |
| Dam resident set, 46 cells | 243.3 MB | 126.1 MB + 5.1 MB records |

Reading: the quad collapse itself is only a 1.4:1 win on walls (ground pieces already merge). The bytes come from
(a) 26 → 18 B a vertex because layer, tint, accent, thin and the 8-byte repeat UVs leave the vertex, (b) the 19 % of
vertices that are thin strips leaving the mesh, (c) one quad per plane. Roofs and lids are now the largest remaining
owner (43 % of the vertices after), each roof triangle with three unshared vertices because its per-triangle record
differs; welding them under the record (`roofRGB` in row 0) is the next byte owner, not F1's.

Caveat on "wall planes": a plane is one footprint edge (x0,y0)-(x1,y1); pieces of one plane left by `subtractWallCuts`
with the same endpoints count once (they merge under the record: one quad from base to eaves, the neighbour's cut
drawn as `wallKind 4`), pieces with different endpoints count separately. Error bar ±5 %.

### 2.2 The vertex (SHEL level 3)

| Attribute | Type | Bytes | Meaning |
|---|---|---|---|
| position | Int16 ×3 (`BAKED_GRID_M` 0.1 m; Float32 within `BAKED_LIFT_RADIUS_M`, as today) | 6 | cell-origin metres |
| wall | Int16 ×3, unit `WALL_UV_UNIT_M = 0.02` | 6 | u metres along the wall from its left end seen from outside, v metres above the **pand's** wall base (not the piece's, so storey lines agree across cut pieces), len the wall's length |
| rec | Uint16 | 2 | record index (§1.3) |
| wallKind | Uint8 | 1 | §1.3 |
| hidden, swapSlot | Uint8 ×2 | 2 | as today (`bakedCoarse.ts` 444–445) |
| pad | | 1 | 18 B interleaved; three.js keeps them as separate buffers, so the pad is only the accounting figure |
| index | u16 / u32 | | as today |

Roof and lid vertices carry `wall = (0, 0, 0)`, `wallKind = 7` (roof) and the pand's `rec`. The fragment shader draws
them in `roofRGB`: flat beyond `ROOF_TIER_MID_M` (the tier already flattens roofs there and the user accepted the far
prisms' flat roofs), and near the rider through `roofTierColour` on the roof cell picked by `roofMaterial` (the atlas's
4 roof layers stay resident), so the pantile/slate texture is not lost at street level.

`world/shellMesh.ts` gets `encodeShel3` / `decodeShel3` (streams of level 2 minus layer/shade/thin/colour/uv, plus
`wallU, wallV, wallLen, rec, wallKind`), `shellFromChunk` learns the record mode from the chunk, and
`bakedCellArrays` builds the 18-byte layout. The bake writes level 3 **only** with `world:compile --facade-records`;
tiles.json gets `shells.records: true` and `shells.recordVersion`. The runtime with the flag on and no records (or a
stale record version) falls back to the legacy path exactly as a stale `shells.layers` hash does today.

### 2.3 Shade

`tint.a` (the baked directional shade) leaves the vertex. The vertex shader recomputes it from the wall direction:
`BAKED_SHADE_GLSL` needs the normal; a wall quad's normal is `(dy, −dx)` of its plane, derivable from `wall.u` and the
positions of the two corners only with a second attribute, so instead: `wallKind` bit 3 (mirrored) and the quad's
winding give the outward side, and the fragment shader takes `normalize(cross(dFdx(vWorld), dFdy(vWorld)))` (one
varying `vWorld`, two derivatives). Roofs: the same derivative normal into the roof branch of the formula. Parity with
the baked shade is pinned by `lookParity` (≤ 2 luma, the brief's rule) on the Storybook row.

## 3. The shader

### 3.1 Program and flag

- `src/canalRecall/look/facadeShader.ts`: `FACADE_RECORD_GLSL` (fragment), `FACADE_RECORD_VERTEX_GLSL`, the uniforms
  (`facadeRecords` usampler2D, `recBase`, `facadeKnobs` vec4: brick contrast, reveal strength, band contrast, debug),
  `shaderFacadesEnabled(touch)`: `?shaderFacades=1|0`, `window.__canalRecallShaderFacades`, default **desktop off,
  touch off** until the gates in §6 pass; then desktop on by one constant, touch off until the user's iPhone is
  measured (the `windowSdf` precedent).
- `look/cityLook.ts` gains one define `CITY_FACADE_RECORD` on the same `MeshLambertMaterial`/unlit pair; the program
  key includes it. Flag off compiles the same program text as today (the new chunks are inside `#ifdef`), so the
  byte-identical gate (§6.3) is a string equality the test pins (`cityLook.test.ts`: program text with the flag off ===
  the text before F1, hashed).
- The record material variant has **fewer varyings** than today: `vWall` (3), `vRec` (flat), `vWallKind` (flat),
  `vShade`, `vFacDist`, `vWorld` (3), `vHighlight`, `vCityUnder` — `vFacUv`, `vLayer`, `vSlot`, `vGrid`, `vTint`,
  `vAccent` go. The record is fetched in the fragment shader (4 cached `texelFetch`, the same row for every fragment of a
  pand), which keeps the varying count under GLES3's 15 vec4 with room for F2.

### 3.2 GLSL outline

```glsl
#ifdef CITY_FACADE_RECORD
precision highp usampler2D;
uniform usampler2D facadeRecords;   // RGBA32UI, 256 x 4096: 64 records a row, 4 texels a record
uniform float recBase;              // this mesh's first row (per-mesh, onBeforeRender)
uniform vec4 facadeKnobs;           // x brick contrast, y reveal strength, z band contrast, w debug view
in vec3 vWall;                      // u along, v up (pand base), len (metres)
flat in float vRec; flat in float vWallKind;
in vec3 vWorld;

struct FacadeRec { vec3 wall, frame, roof, accent, band, fascia, shopPaint, door;
  float wallH, plinth, storeys, groundH, upperH, atticH, baysG, baysU, baysA, doorBay, windowKind, head, ring,
        keystone, tympanum, share, winH, cornice, corniceD, hoist, bands, bandLines, sills, quoins, spekSp, spekN,
        surround, ringColour, bandSill, bandHead, transomAt, revealW, revealD, groundKind, entrance, glazing,
        stallriser, displayWin, fasciaH, stallH, seed; uint statedMask, accentSrc, flags; };

FacadeRec frFetch(float rec) {                       // 4 texelFetch, bit unpack (~60 ALU)
  int r = int(rec + 0.5); ivec2 at = ivec2((r & 63) * 4, int(recBase) + (r >> 6));
  uvec4 a = texelFetch(facadeRecords, at, 0), b = texelFetch(facadeRecords, at + ivec2(1, 0), 0),
        c = texelFetch(facadeRecords, at + ivec2(2, 0), 0), d = texelFetch(facadeRecords, at + ivec2(3, 0), 0);
  FacadeRec f; f.wall = frRgb(a.x); f.wallH = float((a.z) & 0xffffu) * 0.01; /* ... every field by the §1.2 table ... */ return f; }

// Storey and bay from wall metres. Storey 0 is the ground (groundH), the top storey takes atticH when set;
// returns the storey index, its local v in [0,1], its height, and the bay index with its local u.
void frLayout(FacadeRec f, vec3 w, out float storey, out float sv, out float sh, out float bay, out float bu, out float bw) {
  float v = w.y - f.plinth;                                    // plinth band below storey 0
  if (v < f.groundH) { storey = 0.0; sh = f.groundH; sv = v / sh; }
  else { float u = (v - f.groundH) / f.upperH; storey = 1.0 + floor(u); sh = f.upperH; sv = fract(u);
         float top = f.storeys - 1.0; if (storey >= top && f.atticH > 0.0) { /* attic storey height */ } }
  float bays = storey < 0.5 ? f.baysG : (storey >= f.storeys - 0.5 && f.baysA > 0.0 ? f.baysA : f.baysU);
  bays = max(bays, 1.0); bw = w.z / bays; bay = floor(w.x / bw); bu = fract(w.x / bw); }

// One opening per bay: the window rect in bay-local metres from share/winH/head, or the door in doorBay on storey 0.
// Reuses windowSdf.ts wsCover/wsOpening/wsBar* (box or tent filtered over fwidth) for the frame, pane and muntins
// of WINDOW_KINDS[windowKind] (a 24-row constant table: muntin pattern, bar widths, transom share), so an edge is as
// wide on screen as the pixels it covers at any distance (the R2-A/R3-B rule), and small openings fade to the mean
// below WINDOW_SDF_BAND.fadePx exactly as today.
float frWindow(FacadeRec f, float storey, float sv, float sh, float bu, float bw, vec2 fw, inout vec3 c, out float opening);

// Reveal depth (in-shader, no triangles): inside an opening, offset the frame/pane test by the view direction in the
// wall's tangent frame times revealW/revealD metres; the strip between the offset and the true edge draws the jamb
// (wall colour in shadow, BAKED_WALL_MIN) on the side away from the eye. Interior-mapping-lite, ~25 ALU.
void frReveal(FacadeRec f, vec3 viewT, float depth, inout vec2 p);

// Brick coursing: course pitch 0.0625 m (waalformaat 50 + 12.5 mm joint), header 0.21 m, half-brick offset per course,
// joints 0.19 of the pitch; box-filtered pulses over fwidth (slop's filteredPulse, HISTORY 2026-10-29) so the pattern
// averages to f.wall below a pixel: mortar = wall + k, brick = wall - k * 0.19 / 0.81 (energy conserving, so lookParity
// holds). Stucco/painted-brick: k = 0 (painted brick keeps a 0.3 k ghost of the joints). ~30 ALU.
vec3 frBrick(FacadeRec f, vec2 w, vec2 fw);

// Speklagen and bands: speklagen = bandRGB courses every spekSp courses from the plinth to the eaves, spekN deep;
// storey/lintel/painted bands at sill/transom/head lines of each storey (bandSill/bandHead cm, transomAt); courses mode =
// the Amsterdam-School raised courses rule (3 courses 5 cm, 11 cm apart, 5 cm over the heads). All box-filtered. ~20 ALU.
vec3 frBands(FacadeRec f, float storey, float sv, float sh, vec2 w, vec2 fw, vec3 c);

// Accents round the opening: sill slab, lintel/full-frame/keystone/eared-keystone surround, arch ring of ringColour in
// archRing style with the keystone; quoins up both edges of the front (long/short alternation on the course grid). ~40 ALU.
vec3 frAccents(FacadeRec f, vec4 rect, vec2 p, vec2 fw, vec3 c);

// Cornice band under the eaves (cornice kind -> frieze height, dentil pulse, in accent or band colour) and the plinth.
vec3 frCorniceBand(FacadeRec f, vec3 w, vec2 fw, vec3 c);

// F2's hook (look/groundBand.ts): storey 0 on a street front. F1 ships the generic residential/quiet-shop version.
vec3 frGroundBand(FacadeRec f, float sv, float bu, float bw, vec2 fw, vec3 c);

vec3 facadeRecordColour(vec3 w, float kind, float rec, vec3 viewT, out vec2 mask) {
  FacadeRec f = frFetch(rec);
  if (kind > 6.5) return f.roof;                                             // roofs, lids
  vec2 fw = max(fwidth(w.xy), vec2(1e-4));
  vec3 c = frBrick(f, w.xy, fw);
  if (kind == 3.0 || kind == 4.0) return c;                                   // party wall, exposed strip: blank
  float storey, sv, sh, bay, bu, bw; frLayout(f, w, storey, sv, sh, bay, bu, bw);
  bool front = kind < 0.5;
  c = frBands(f, storey, sv, sh, w.xy, fw, c);
  if (front && storey < 0.5) c = frGroundBand(f, sv, bu, bw, fw, c);
  else { float opening; c = frWindowAndAccents(f, front, storey, sv, sh, bay, bu, bw, fw, viewT, c, opening); }
  c = frCorniceBand(f, w, fw, c);
  return c; }
#endif
```

`FRAGMENT_CELL` under the define becomes `cityC = facadeRecordColour(vWall, vWallKind, vRec, viewT, cityM)` followed by the
unchanged highlight / desaturation / shade / fade lines, so hidden, ghosted, highlighted, dimmed, the swap complement
and the depth fade keep working on record meshes without a new path.

### 3.3 What is kept from `look/windowSdf.ts`

The band-limited filtering (`wsCover`, `wsTentCdf`, `wsOpening` with segmental/arch heads, `wsBarH/V`, `wsBarFade`,
the `windowSdfBand`/`windowSdfShape` uniforms and the `WINDOW_SDF_BAND` fade) are reused verbatim: the record path calls
them with rects in wall metres instead of canvas pixels (`fw` is `fwidth(wallUv)` instead of `fwidth(uv * cell)`), and
the glazing gradient and calm lift stay (`GLASS_STOPS`, `glassTone`). The per-layer `windowTable` texture is not read on
the record path; the 24 `WINDOWS` kinds get their own constant table in GLSL (`FACADE_WINDOW_KINDS`, generated from a
typed table in `facadeShader.ts` with CPU twins as `windowSdf.test.ts` does).

### 3.4 CPU twin

`house:preview` and the H7 re-run are Node (`houseSpec/softRaster.ts` mirrors the fragment shader per pixel). The build
lane writes `facadePixel()` in `houseSpec/softRaster.ts` from the same typed tables (`facadeRecord.ts`,
`facadeShader.ts`), and one Playwright fixture page renders 64 record rows (the Storybook row's records at 6 poses) so a
test pins GLSL against the twin at ≤ 1/255 mean and ≤ 8/255 max per channel. Without the twin the pixel gate (§6.2)
cannot be measured in Node, and a spec change would be invisible to the house line's own preview.

### 3.5 Cost on the desktop GPU

Per facade fragment today (photo look, desktop defaults): `cellTierSample` = 1 trilinear anisotropic `texture` on two
array textures, or 9 `textureGrad` taps each under `CELL_TAPS` (desktop on) where the footprint is anisotropic, plus the
mean sample, plus `windowSdf` (1 + 4 × 3 `texelFetch`, ~150 ALU), plus `roofTierColour`. The read of 2026-11-07 (6
alternating runs, DPR 2) put the whole Dam frame at 4.98 ms painted vs 3.98 ms with the analytic windows: the facade
pass is a texture-bandwidth cost of the order of 1 ms, and analytic beat it.

The record path per facade fragment: 4 cached `texelFetch` (one 64-byte row shared by every fragment of the pand),
~60 ALU unpack, ~30 layout, ~120 window + bars (one window, not three), ~30 brick, ~20 bands, ~40 accents, ~25 reveal,
~20 cornice/ground: **≈ 350 ALU, 0 filtered texture samples** (the roof branch keeps one `roofTierColour` sample).
At Dam, DPR 2 (2.97 Mpx, facades ≈ 45 % of the frame = 1.3 M fragments): 1.3 M × 350 ≈ 0.47 G ops ≈ **0.35–0.45 ms** on
an M1/M2-class GPU at realistic occupancy, plus ≈ 0.05 ms for the record fetches and ≈ 0.05 ms vertex work (fewer
attributes to fetch than today: 18 B vs 26 B a vertex). Against the ≈ 0.5–1.0 ms it replaces the expected delta is
−0.3…+0.3 ms, inside the run-to-run noise of the timer. The gate (§6.1) is therefore "no worse within the 6-run noise",
measured the way `windowSdf` was: `tests/e2e/crisp-textures.spec.ts frameMs` (EXT_disjoint_timer_query, 24 forced frames,
median of the last 20) at Dam and Westerkerk, flag on vs off, alternating. If the read comes out > +0.5 ms the first
knob is `facadeKnobs.x/z` (brick and band pulses off beyond 60 m: they are the only per-fragment terms that cost at
distance), the second is the window-kind table (bars off beyond `WINDOW_SDF_BAND.fadePx`, already in the band rule).

## 4. The silhouette stays geometry

### 4.1 Crowns: one instanced draw, the profile in the vertex shader

Today a register/spec gable is the roof planner's `monumentGable` crown (`roofMesh.ts planRoof`, `GABLE_SHAPES`), baked
into the SHEL as roof triangles (3DBAG height, planner outline) and drawn by the detail tier the same way; `house-line.md`
§1 lists `crownCap`, `crownShoulder`, neck width and `crownRise` as not wired. Under the flag:

- `engine/crownInstances.ts`: **one** `THREE.InstancedMesh` (one draw, plus its depth pass) whose unit geometry is a
  2 × 24-segment vertical strip (front face, back face, 0.3 m return) and whose per-instance attributes are
  `crownA` (x0, y0, x1, y1 of the front wall top, cell-origin metres), `crownB` (eaves z, rise, neck share, cap rise),
  `crownC` (kind, steps, shoulder curve, finial), `crownRGB`. The vertex shader evaluates the profile for the vertex's
  segment: step (staircase of `steps` per side), neck (plumb neck over concave/ogee/straight/convex flanks,
  `CROWN_SHOULDERS`), raised-neck, bell, spout (triangle), point, cornice crown (box + cap: flat/rounded/pediment/
  segmental, narrow/medium/wide span), shouldered. It is the `FrontIntent` crown vocabulary (`crownCap`, `crownCapSpan`,
  `crownCapRise`, `crownShoulder`, `crownNeckWidth`, `crownShoulderRise`, `crownSteps`, `crownFinial`, `crownAt`/
  `crownBays`, `crownHalf`) in 16 floats a crown. Width and rise come from the spec; absent, from the fitted proportion
  the planner uses today (0.9 of the crown width, capped by the 3DBAG ridge).
- Fragment: the crown face draws through `facadeRecordColour` with `wallKind 6` (crown field: brick courses, the
  attic lights from `baysA`, the hoist beam as a dark rect under the cap) so the crown matches its wall.
- The compiler writes a `CROW` stream per cell (one 24-byte entry per crown); the baked tier uploads resident cells'
  crowns into the one instance buffer (≤ 20k instances resident ≈ 1.3 MB) and removes them with the cell. The runtime
  chunk path (`?world=live`, the detail tier) hands the same entries from the worker. The planner's generic crown
  triangles are **suppressed** in the SHEL/chunk under the flag (the roof mass behind stays: shell roofs unchanged).
- Draws: +1 (+1 depth). The "draws no worse" gate is read as `draws ≤ today + 2`, stated in §6.1.

### 4.2 Projecting cornices

The 0.26 m sloped cornice strip (`threeBuildingMesh.ts` 672–680, `CORNICE_STYLES`) throws the shadow line that reads from
down the street; a flat shader band cannot. It becomes a crown family `cornice-ledge` in the same instanced mesh
(profile = a box of `corniceDepthDm` × frieze height), one instance per front with `cornice ≠ none`. The frieze
colouring under it is the shader's (`frCorniceBand`). The thin `trim`/`cornice` strips leave the SHEL (§2.1).

### 4.3 Eaves from the measured crown

`wallHcm` (row 0) is the wall height the shader lays storeys on and the z the crown instance sits at. Priority: spec
`fronts/*/eavesHeight` or a measured crown line (H10 `house:frames` `roofOffset`, the skyline read) at Src 2–3, else
3DBAG `roofEavesHeightM` (Src 0). When the measured eaves are **above** 3DBAG's (Haarlemmerdijk 18: 11.0 m measured vs
7.94 m), the wall quad is extruded to the measured eaves and the shell roof is translated up by the difference (its
shape kept); when below, the wall quad stops at the measured eaves and the band between is drawn as the crown field.
This is the one place F1 changes a mass; it is flag-on only and the far prisms (SHL1) are untouched. See Open question 2.

### 4.4 Stoops, awnings, balconies, bay windows

Unchanged: they are the detail tier's extras (`facadeExtras.ts`, `stoopExtra.ts`, `shopCanopies.ts`,
`EXTRA_BUDGET.building` 230) and keep their budget; the record's flags (row 1 byte 13) only tell the shader to leave
the wall behind a projecting extra blank. F2 may instance awnings; not F1.

## 5. Interfaces

- **F2 ground band**: row 3 of the record (§1.2) and the GLSL hook `frGroundBand` in `look/groundBand.ts` (F1 ships a
  generic version: residential door + windows on `baysG`, quiet shop = stallriser + display windows + fascia in
  `shopPaintRGB`). F2 replaces the function body and the packer of row 3 (`packGroundBand(ShopfrontIntent | pui | priors)`)
  without touching rows 0–2 or the vertex layout. Awnings as instances would join `crownInstances` as a family.
- **F3 measurement**: writes land in HouseSpec fields; the record packer reads the resolved view, so a new writer
  changes pixels with no renderer change. Fields the record reads that no writer fills yet: `windowHeights`/`headLines`
  on 1,142/1,004 pands (block faces), accents on 298–537, `eavesHeight` on none (H10's crown read is the source).
- **F4 critic**: `house:frames` pairs draw the record path when `?shaderFacades=1` is in the frame URL; the
  Node side needs nothing new.
- **Kits, recipes, block faces, landmarks**: untouched (their slot materials are `CITY_SLOT`, not the record path).
- **Touch**: legacy path (flag off by default, `?shaderFacades=1` the phone try-URL).

## 6. Gates

1. **Perf, desktop, flag on vs off, same bundles**: `npm run perf:aerial` (`scripts/aerial-pan.mjs`, 3-min pan,
   `--every 5`, headed Chrome on Metal) → `aerialGlMaxMB` < 700 on the legacy 4-byte figure (expected ≈ 660, §0) and
   the `bakedAttr` table by attribute; `crisp-textures.spec.ts frameMs` GPU ms at Dam and Westerkerk, 6 alternating
   runs, median no worse than off within the run-to-run spread; draws on the fixed ride ≤ today + 2 (crowns), programs
   ≤ 40 (`tests/perf/budgets.json`). Triangles on the ride fall (walls 0.69×); report them.
2. **Spec changes pixels**: a new `scripts/house-specs/pixel-effect.ts` over the 22 H7 pilot pands
   (`scripts/house-specs/pilot-20261110/specs`, through `scripts/house-preview/resolved.ts` with `SHADER_FACADES=1`):
   for every pand, each of storeys ±1, bays ±1, window kind, window head, cornice, bands, door bay changes the rendered
   elevation (mean |Δ| > 1/255 over the wall, measured on the CPU twin). Target 22 of 22 pands on every field it states;
   today's figure is 8 of 22. See Open question 4 on the four unstaged pands and the recipe route.
3. **Flag off is byte-identical**: (a) `scripts/house-specs/odd-cells-hash.ts` per-building hashes over the 55 house-spec
   tiles, record mode off = the base (0 differ); (b) `world:compile` without `--facade-records` writes identical cell and
   shell files (sha256 in tiles.json unchanged); (c) the city-look program text with the define off equals the pre-F1
   text (`cityLook.test.ts`); (d) `npm run test:baked-fabric`, `look-parity`, `building-look`, `facade-trees-perf`
   goldens, `holds.test.ts`, `test:canal-game-structure`, `check:canal`.
4. **Storybook**: `stories/canal-drive/FacadeRecord.stories.tsx`, a deterministic six-house row from hand-written records
   (canal 1700 with speklagen and a step crown; c19 1890 with segmental heads, arch rings and keystones; Amsterdam School
   1925 ladder windows with raised courses; postwar strip; a shop ground band; a prior-only house marked inferred), drawn
   by the real material through the `Highlight.stories.tsx` three.js pattern, at desktop 1280 × 800 and phone 390 × 664,
   near (12 m) and far (150 m) cameras, flag on and off side by side; `npm run build-storybook` compiles.
5. **Look parity**: `lookParity` ≤ 2 luma between the record wall mean and the atlas wall for the same `wallHex` at the
   Storybook row (the energy-conserving brick rule, §3.2).

## 7. Build plan (each step ≤ 1 day, with its check)

| Step | Work | Check |
|---|---|---|
| S1 record | `look/facadeRecord.ts`: the §1.2 table as typed constants, `packFacadeRecord`/`unpackFacadeRecord`, `packFacadeRecordFor(styled props, HouseSpecView, style prior, buurt profile)` with the Src rules; `facadeRecord.test.ts` round-trips every field, pins byte offsets and the 64-byte size, and the provenance classes on three fixture pands (a register-only pand, a block-face house, a prior-only pand) | `npm run test:look` |
| S2 format | SHEL level 3 encode/decode in `world/shellMesh.ts` (streams `wallU/V/Len`, `rec`, `wallKind`; no layer/shade/thin/colour/uv), `FREC` and `CROW` streams in `cellFormat.ts`, `bakedCellArrays` 18-byte layout, `worldCells.ts shell()` returns records and crowns; `facade-record-cost.ts` reads level 3 and reproduces §2.1 | `npm run test:world-format`; encode→decode exact; files without `--facade-records` byte-identical (sha) |
| S3 mesher | `threeBuildingMesh.ts` option `facadeRecord: true`: one quad per visible wall plane from base to `wallHcm`, metre UVs from the pand base, `rec`/`wallKind` per vertex, no cornice strips, planner crown suppressed; `shellBake.ts` and the worker pass the option under the flag; `odd-cells-hash.ts` gains `--records` | `odd-cells-hash` off = base (0 differ); on: every spec'd pand differs, no neighbour differs |
| S4 shader v1 | `look/facadeShader.ts` + `cityLook.ts` define, `facadeRecordTexture.ts` allocator and `recBase`, `shaderFacadesEnabled`, the baked tier and runtime chunks on the record material; walls, storeys, windows (the `windowSdf` functions on metres), frame/glass, shade, roofs flat | flag off: program text equal, `test:baked-fabric`; flag on: Dam/S2 frames render, 0 GL errors, `test:canal-game-structure` |
| S5 twin | `softRaster.ts facadePixel()` from the shared tables; `house:preview --shader-facades`; the 64-row fixture page and the GLSL-vs-twin test | `test:house-spec`; one Playwright run under `/tmp/canal-pw.sh` |
| S6 surface | brick coursing, speklagen/bands/courses, sills/surrounds/keystones/arch rings/quoins, cornice band, reveal depth, ground band (generic), window-kind table for all 24 kinds | `lookParity` ≤ 2 luma; the Storybook row (S8 stub) at near/far shows every feature; `windowSdf`-style band tests |
| S7 crowns | `engine/crownInstances.ts` (one InstancedMesh, vertex-shader profiles, the `FrontIntent` crown vocabulary), `CROW` from the compiler and the worker, eaves rule §4.3 | `swap-zfight`/`baked-fabric` at a gable pose (Nieuwmarkt 6–22, Bloemgracht 121–197); draws ≤ today + 2 |
| S8 storybook | `FacadeRecord.stories.tsx` desktop + phone, near + far, on/off | `npm run build-storybook` |
| S9 gates | `perf:aerial` on/off, GPU timer 6 runs at Dam/Westerkerk, `pixel-effect.ts` 22/22, `check:canal`, the kit-gap report (what the record still cannot say) | §6 all green, numbers in the hand-back and `tests/perf/budgets.json` rows with dates |
| S10 docs | `docs/house-line.md` new section "The record consumer" (fields → bytes → pixels), the kit-gap list, `TODO.md`/`HISTORY.md` by the integrator, What's New note + before/after sheet when the default flips | docs diff in the hand-back |

S2 and S6 are the two that may run to 1.5 days; split S2 into format (a) and compiler/worker plumbing (b), S6 into
openings+accents (a) and brick+bands+reveal (b) if they do.

## 8. From the 2026-10-29 brief: kept and dropped

Kept: one quad per footprint edge with wall metres in the vertex (`facadeWall` u / height), the wall kind per vertex
(shop/front/rear/party → our `wallKind`), the party-wall rule, bays fitted to the wall (`round(width / windowWidth)`) for
non-front walls, every periodic term box-filtered over `fwidth` (no moiré), styles as data not defines (one program),
the measurement plan (triangles, draws, programs, the six generic strips at 60/150/400 m through gallery-size review,
colour parity by `lookParity` within 2 luma), `MeshLambertMaterial` through `onBeforeCompile` under the shared rig.

Dropped or changed: per-vertex `box`/`tone`/`rhythm` attributes (4 + 4 + 4 bytes a vertex of look data) become one
64-byte record per pand fetched from a texture: the per-pand fields the house line now measures (storey heights, bay
counts per storey, window kind/head/panes, door bay, accents, cornice, ground kind) do not fit 8 bytes a vertex, and
the vertex bytes are the budget (§2.1); "four window kinds to start" becomes the 24 `WINDOWS` kinds the specs already
state; "ordinary ring only, kits untouched" stays, but the scope now includes the baked SHEL tier (which did not exist
on 2026-10-29) as the main consumer; the iPad main-pass triangle figure is replaced by the aerial GPU-memory gate; the
haiku strip runs become the F4 critic's benchmark.

## 9. Open questions (disagreements with the plan; nothing changed silently)

1. **`look/brickLift.ts` does not exist.** The wall-colour chain is `houseSpec/wallColour.ts` (H9: `specWallSource` →
   `specWallDisplay` lift, `SPEC_WALLS_DEFAULT = true`) feeding the mesher's `wallHex`, then the atlas's calm lift
   (`paintLookAtlas` `liftBrick`, mean 225/255) × tint. The record stores the post-H9 `wallHex` and the brick rule is
   energy-conserving so the mean is that colour; the calm lift's +brightness is **not** reproduced unless lookParity says
   the record wall reads darker than the atlas wall, in which case `facadeKnobs` carries one gain. Decide at S6.
2. **Eaves above 3DBAG lifts the shell roof** (§4.3). Alternative: keep the 3DBAG mass and draw the storeys on the
   shorter wall as H9 does (the stated count fits, the house is squat). The plan says "eaves from the measured crown";
   this doc follows it, flag-on only, and asks the integrator to confirm the roof translation.
3. **Draws +2** for the crown instances (one mesh, its depth pass). "Draws no worse" is read as ≤ today + 2.
4. **"22 of 22"**: four of the pilot's 22 were not staged (174173 tree-covered, 174177 unresolved, 160704 recipe compile
   failure, the corner 116526 by the chunk route) and five Nassaukade pands resolve to the recipe route (GLBs held). The
   gate counts every pilot pand on the generic path with its staged or hand spec; a recipe-route pand counts only while
   its GLB is held (it is). If the integrator wants 22/22 literally, the four get a hand spec for the measurement.
5. **Roofs**: the record path draws roofs flat (`roofRGB`) beyond the roof tier's mid distance and keeps the painted
   roof cell near; the atlas's 4 roof layers stay resident for that. Dropping the 181 bay layers from the atlas when the
   flag is on (−100 MB of the 139 MB facade atlas) is the follow-up that would take `aerialGlMaxMB` well under 600; it is
   not in F1 because flag-off must keep the atlas.
6. **Two render paths** (record on desktop, legacy on touch) until the iPhone is measured; the brief accepts this.
7. **The "191 of 256" layer figure** is 186 defined (181 bay + 4 roof + 1 masonry), 149 used by the published shells,
   ordinal max 198 with the window-grid flag: the ceiling is real (the +64 flag bit halves it) and the record removes it.
8. **The live tile path** (`?world=live`) builds records in the worker from tile features; it has no cell FOOT order, so
   `rec` there is the chunk-local building index and the allocator keys rows by chunk. Same code, different base.

## 10. Measuring script

`node --import tsx scripts/world/facade-record-cost.ts [--dir=…] [--top=12]` prints §1.5 and §2.1 (city, Dam resident
set, the top cells by pands). It reads only the published shells; the build lane extends it to level 3 in S2 and keeps
the two tables in its hand-back.
