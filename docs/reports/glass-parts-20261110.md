# Glass parts (feedback fc427560, IJdok), 2026-11-10

Lane `lane/glass-parts-20261110`. Follow-up to `part-overlap-20261110.md` §3: the two IJdok glass parts
(`w1088847352` oriel, `w1088847353` skybridge) drew as opaque, windowless `#5a81a0` boxes because the building tiles
kept the material's colour prior but dropped `building:material`.

## 1. Census

Source: the cached `Amsterdam.osm.pbf` (osmium tags-filter) and `buildings-colored.geojson`.

| | count |
|---|---|
| OSM areas with `building:material=glass` | 176 (141 `building:part`, 35 `building`) |
| `building:material=mirror` | 6 parts (the four in the tiles are Zuidas / nhow RAI) |
| `building:facade:material` or `facade:material` glass/mirror | **0** (handled anyway, most specific key first) |
| glazed sources in `buildings-colored.geojson` | 180 |
| **stamped into the building tiles under their own OSM id** | **143 features in 15 z14 tiles (glass 139, mirror 4), 43,200 m² of footprint** |
| not stamped: a BAG pand stood in for them (tier 3) or outside the extract | 37 (list in `staging/building-tiles-glass/report.json`) |

Colours on the 143: 76 the `#5a81a0` prior, 49 a tagged mint `#c4f2e0` (the stacked storeys of two IJburg/Zeeburg
blocks, 8418/5387), 9 tagged white, 4 the `#d2c9bc` fallback (the mirror parts), 5 other tagged hexes.

## 2. Change

- **Tiles carry `material` for glass and mirror only** (`src/canalRecall/glazedMaterial.ts`, dependency-free).
  - `scripts/build-lod1-tiles.ts` `renderProperties` keeps it; `scripts/build-lod1-city.ts` sets an OSM feature's
    `material` from its own tags only (paint is inherited from a containing coloured outline, a material no longer is).
  - `scripts/building-tiles/stamp-glass-material.ts` stamps the published tiles without a rebuild. It inserts
    `"material":"glass"` right after the feature's id and leaves every other byte of the tile body alone (works on the
    one-feature-a-line tiles and on the tiles later passes wrote on one line); tiles without a glazed part are not
    rewritten. Default writes `staging/building-tiles-glass/` + `report.json`; `--publish` writes in place. Idempotent.
    Verified: the 15 staged tiles decode to the originals once the insertions are removed, feature for feature.
- **Mesh** (`src/canalRecall/glassParts.ts` `applyGlazing`, called at the end of `meshBuildingFor`): a glazed part gets
  the modern archetype's curtain-wall bay cell (`BAY_STYLES.modern` `family: 'curtain'`, the cell the contemporary
  set-back crown already uses) on every storey, ground and door bays included: a full-height glass band with mullions
  and an aluminium frame. Frame `#bfc5c8` (wall tint), spandrel `#8e9ba2` (accent tint); mirror `#cfd3d5` / `#b4bcc0`;
  a tagged colour other than the prior tints the spandrels. No shop, door, plinth, parapet, cornice or extras.
  Skipped for landmark kit walls, garden sheds, front carriers and the industrial kit's non-office classes.
  - **Same program, same texture array**: only a layer index and tints change. Opaque, so nothing to depth-sort.
    Program count unchanged.
  - Procedural and `untextured` looks have no curtain cell: those draw exactly as before.

## 3. Pins (`src/canalRecall/glassParts.test.ts`, 6 tests)

- `glazedMaterialOf`: glass/mirror from the three keys, facade key first, `;` lists, nothing else.
- `stampTileBody`: insertion only, both tile layouts, idempotent, no-op without hits.
- **IJdok 8414/5383**: the stamp names exactly `w1088847352`, `w1088847353`, `w1097460490`, `w755935170`,
  `w757595921`, `w757595922`; the slender fin `w1088847358` stays unstamped.
- A glazed part is a curtain wall in photo/storybook/cartoon (layers, frame tint, no extras/shop).
- **Byte-identical without the tag**: no material, `material: 'brick'`, `material: ''`, and every look for the
  procedural pair, `deepEqual` to the untagged result.
- Whole IJdok tile: all 5,000+ features the stamp does not touch are identical and build an identical `MeshBuilding`.

## 4. Frames and verdicts

Frames: `map-recall2-screenshots-a1/buildings/2026-11-10-glass-parts/` (live tile path `?world=live`, storybook look,
chase camera; the compiled world still lacks `material` until `world:compile`). Panoramas (data.amsterdam.nl, CC BY):
`pano-ijdok-2025-06-17.jpg`, `pano-nhow-rai-2024-12-23.jpg`, `pano-muziekgebouw-2025-06-16.jpg`.

- **IJdok, user's pose** (`pair-ijdok-user-desktop.jpg`, iPhone `pair-ijdok-iphone.jpg`): the two flat blue boxes are now
  glazed (on the iPhone's portrait frame only the bridge's corner is in view at this pose; it is glazed too): a glass band with mullions in a pale aluminium frame, reading as an oriel and a skybridge on the white
  facade. Against the panorama the skybridge is a silver-finned glass tube; the frame tone matches, the fins are
  coarser (three mullions per 4.2 m bay against a fin every ~0.3 m). **Better; the texture-fighting read is gone.**
  The wood-brown pillar `w1088847356` in the same frame is untouched (not glass, out of this lane).
- **nhow RAI, Zuidas** (`w806837639` 7–35 m, `w806837638`, `w806837637`, `w806837636`, all `mirror`;
  `pair-nhow-desktop.jpg`): before, the generic tower facade drew it as a beige punched-window slab; after it is a
  glazed curtain wall. The photo is silver vertical fins over glass; ours is bluer than the photo because the curtain
  cell's glass gradient is untinted ink. **Better than before, still not a likeness.**
- **Muziekgebouw aan 't IJ** (`w755464132`, `pair-muziekgebouw-desktop.jpg`, `-iphone.jpg`): no visible change in
  the frame; the Bimhuis/Muziekgebouw front is drawn by other features at this pose. **Neutral (no regression).**
- Regression sample, before/after changed-pixel share at the noise floor (~0.15 % desktop, trees and HUD) and no
  visible difference: `r14382490` (Nieuwezijds Voorburgwal, a glass multipolygon not visible from the street behind
  the brick block), `w806950196` (Zuidas, `pair-zuidas-w806950196-desktop.jpg`), Mövenpick `w755504256`, `w751559653`
  (Waterlooplein). **Neutral.** Changed-pixel shares above the floor appear only where a glazed part is in frame:
  IJdok 0.47 %, nhow 1.9–2.1 %.

## 5. What the kit still cannot say

- **Fin/mullion pitch.** The curtain cell has three mullions per bay at a fixed bay width. The IJdok bridge, nhow
  and most Zuidas glass have dense vertical fins. Needs a `pitchM` for the curtain cell (the landmark kits already
  have `KitCladdingKind 'curtain'` with `pitchM`/`rowM`, but only for kit walls).
- **Glass tone.** The glass band is a fixed ink gradient (`#8fa6b4` to `#2d3d48`), so mirror and tinted glass cannot
  be silver, green or bronze; only the frame and spandrel take tints. A tinted-glass variant would be one more cell
  layer, not a new program.
- **Reflection.** No sky reflection or Fresnel on glazing; out of budget without a shader change.
- **Glass roofs.** Lids stay flat colour; an atrium roof does not read as glazed.
- **37 glazed sources** are drawn by a BAG pand (tier 3) and stay unstamped; a matched BAG pand inheriting a glass
  material was left out on purpose (a pand matched to a glass oriel is not glass).

## 6. For the integrator

1. Publish the tiles: `node --import tsx scripts/building-tiles/stamp-glass-material.ts --publish` (15 tiles, idempotent;
   re-run after any later tile rebuild that predates the build-lod1 change). Then `npm run check:covers` is not
   affected (ids unchanged).
2. Bundles: `npm run build:canal-three-buildings` (three-buildings + worker carry `meshBuildingFor`).
3. `npm run world:compile -- --changed` then `world:verify`: the 15 tile files change, so their cells recompile; the
   shells bake the glazing (threeBuildingFeatures.ts is not in pipeline `CODE`, so a code-only change would not be
   picked up without the tile change).
4. npm script: `"test:glass-parts": "node --import tsx --test src/canalRecall/glassParts.test.ts"`, add to `check:canal`.
5. Frames rerun: `GLASS_FRAMES_OUT=<dir> GLASS_FRAMES=<views.json> GLASS_QUERY='?world=live' PW_PORT=<port> bash
   /tmp/canal-pw.sh npx playwright test glass-parts-frames --project=desktop --project=iphone --workers=1`.
6. Feedback fc427560: the blue boxes are glazed; with the part-overlap lane's fin removal the note can close once the
   user has looked at `pair-ijdok-user-desktop.jpg`.
