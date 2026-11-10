# New-build family, roof-canopy slabs and the windowless audit (lane E, 2026-11-10)

Branch `lane/newbuild-kit-20261110`. The lane answers three items from the user's 2026-11-09 feedback, all reported in
the Storybook look on desktop Free Ride:

- 1c694c0d, "houthavens houses look AWFUL": Narva-eiland, white flat boxes with grid windows.
- 2c486751, "what's going on with these things sticking out?": Westpoort, green slabs sticking out of an office.
- 75242f30, "why no windows": Houthavenkade 26 (next to the Het 4e Gymnasium label), a dark brown mass with no windows.

The census and audits can be re-run with these commands:

- `node --import tsx scripts/newbuild/census.ts --out=<json>`. Add `--import ./scripts/newbuild/family-on.mjs` to run it with the flag on.
- `node --import tsx scripts/newbuild/sample-panos.ts`, then `node --import tsx scripts/newbuild/derive-walls.ts`.
- `node --import tsx scripts/newbuild/blank-walls.ts`.

## 1. Measurements

### (a) Pands built in 2000 or later, and what the grammar draws

The census runs every building tile through `gameDecorator` and `meshBuildingFor`, the same path the game uses. It
covers BAG pands of 40 m² or more. "Modelled" means a GLB, chunk or building type in `covers.json` covers the pand.

| area | pands 2000+ | modelled | generic | Storybook: white/pale walls (L* ≥ 80) | Storybook: dark or mid | undated OSM-only outlines (drawn as 1860-1914 houses) |
|---|---:|---:|---:|---:|---:|---:|
| city | 34,866 | 870 | 33,996 | 26,993 (79 %) | 60 (0.2 %) | n/a |
| Houthaven | 167 | 6 | 161 | 125 (78 %) | 0 | 7 (6,674 m²) |
| IJburg | 1,633 | 0 | 1,633 | 1,283 (79 %) | 0 | 40 (22,144 m²) |
| Zeeburgereiland | 212 | 1 | 211 | 168 (80 %) | 0 | 9 (3,564 m²) |
| Sluisbuurt | 2 | 0 | 2 | 1 | 0 | 10 (7,203 m²) |
| Overhoeks | 24 | 4 | 20 | 17 | 0 | 18 (19,444 m²) |
| Westpoort/Sloterdijk offices | 887 | 8 | 879 | 698 (79 %) | 1 | 32 (55,058 m²) |

Two causes account for the user's "awful".

1. **The Storybook and Cartoon looks never received the modern vocabulary.** The #117 vocabulary (`modernFacades.ts`)
   applies only to the photo look. In the illustrated looks, every post-1945 pand takes a hashed pick from
   `PALETTES.storybook.modern`: white, pale grey, cream, blue-grey or peach. It also takes one of two presets, `modern#4`
   (balanced punched) or `modern#5` (wide, dark frames). In the photo look the same pands are 51 % dark brick.
2. **The tiles have no year for new builds missing from 3DBAG.** OSM gap fills (`newBuildGaps.ts`) carry `start_date`
   at build time, but the tile has no year. They therefore draw as undated houses in the 1860-1914 style. The
   Sluisbuurt has 10 such outlines against 2 BAG pands, and Overhoeks 18 against 24. The lane does not fix this; see
   the integrator TODO.

What the panoramas show: `sample-panos.ts` sampled 94 fronts of BAG pands built in 2005 or later, on 2019 and later
captures, CC BY 4.0. The contact sheet is in the screenshots repo as `pano-samples.jpg`. Counted by eye:

- **Houthaven (37 fronts):** orange-red brick (#a35932 to #c87343 raw) and dark purple-brown brick (#2e2120 to #523126
  raw), with wide windows in pale frames on 33 fronts and tall windows on 2. The courtyard block at Houthavenkade 26
  has tall French windows with glass balconies.
- **IJburg (28 fronts):** grey, anthracite and brown brick, plus 7 white or pale render. Tall windows in dark frames
  on 18 fronts.
- **Zeeburgereiland (26 fronts):** dark brick and timber, a few yellow or white fronts, 8 tall-window fronts, loggias
  and balconies.
- **Glazing proxy** (dark low-chroma share of the wall box): median 0.16 in Houthaven, 0.10 in IJburg and 0.34 on
  Zeeburgereiland.
- **Set-back top storeys:** 2 of the 16 2005+ models described in the explorer index have one.

### (b) The protruding slab

The slab is not a decal or a band. It is **data**. OSM way w848883149 ("Ydek", `building=roof`, `ref:bag` of the
office, with no height) was published at the 9 m building default. `osmMinHeightM` then lifted it to a 1 m slab at
8-9 m, so a strip of roof stuck out of the facade at the third floor. The 2025 panorama shows the real canopy
ringing the glazed ground floor at about 5 m.

City-wide, 192 published features were canopy slabs at 8-9 m. Of those, 172 are untagged roof outlines under
1,000 m², and the median one is 17 m². After the fix, 20 remain at 8-9 m: 12 station-sized roofs of 1,000 m² or
more, which keep the default, and 8 that are tagged.

### (c) Windowless pands of 300 m² or more and 2 storeys or more

Generic chunks first. No generic pand of this size draws bare except where a kit or landmark chooses it:

- `kit-plain`: 20 pands, 23,329 m². These are landmark kits with plain walls, 3 of them built in 2000 or later.
- `landmark-unmodelled`: 2 pands.

The user's case is not in the generic tier. Houthavenkade 26 is the installed large-recipe GLB
`recipe-large-houthavenkade-26-247232.glb`. Every 3DBAG wall surface that its intent does not list falls to
`otherWalls`, and the factory draft writes `otherWalls: "blank"`.

`scripts/newbuild/blank-walls.ts` fits all 163 large recipes:

- 142 have blank walls, and 139 of those are more than 25 % blank by panel area.
- 1.50 M m² of 1.98 M m² of panel area is blank. This area includes party walls, which abut neighbours.
- Houthavenkade 26 is 83 % blank. The intent lists 12 of 510 surfaces.

## 2. Fixes

- **Slab: fixed at the cause.**
  - `osmHeightM` (`osmMinHeight.ts`) gives an untagged roof outline under 1,000 m² a top of `ROOF_CANOPY_TOP_M` = 5 m.
    `build-osm-buildings.ts` uses it.
  - `fix-osm-min-level.ts` republished the 172 canopies in place: 344 features in 68 tiles, both tile sets. Their
    tops are stored in `scripts/data/osm-roof-canopies.json`, and `check:osm-min-level` pins them.
  - The named regression is in `osmMinHeight.test.ts`: w848883149 is published at 4-5 m in both tile sets.
- **Windowless: cause found, not fixed in the lane.** Switching Houthavenkade 26 to `otherWalls: "brick-bay-grid"`
  fails the large tier's hard triangle budget: 31,656 triangles against a limit of 12,000. The gate was not weakened
  and the GLB was not reinstalled. The missing kit component is a texture-only window grid for unlisted walls; see
  "Kit cannot yet express".

## 3. The contemporary family (`?newbuildFamily=1`, off by default)

`src/canalRecall/contemporaryFamily.ts`, tested in `contemporaryFamily.test.ts` (flag off) and
`contemporaryFamilyOn.test.ts` (flag on). It covers dated housing built from 2005, in every textured look.

- **Walls:** drawn from the nearest measured area (`contemporary-walls.json`), lifted 12 L* from the shaded
  thumbnails. Areas with fewer than 8 fronts, and points more than 2.5 km from any area, use the pooled walls.
- **Window shape** follows the area counts:
  - wide windows with pale frames (`modern#0`) or dark frames (`modern#1`);
  - **new tall French-balcony preset** `modern#9`: two tall windows per bay in dark frames, with a steel rail
    (`facadeAssembly: 'french-balcony'` in `bayTextures.ts`);
  - painted fronts take `modern#3`.
- **Set-back top storey:** on 35 % of blocks of 14 m and up, `withSetbackCrown` stops the body one storey (3.1 m)
  short under its lid and adds an inset crown. The crown is 1.8 m in from the outer ring (`insetRing`, mitred, and it
  refuses slivers and sharp corners), glazed with the curtain cell under anthracite cladding (#4b4d50).
- **Byte-identical off:** with the flag off, the tall preset is not in `BAY_STYLES`, so `BAY_LAYER_COUNT` stays 191
  and the shell layer hash is unchanged. `bayLookFor` deep-equals the old output for 300 ids in both looks.

Census with the flag on, Storybook look, generic 2000+ pands:

| area | white/pale before | white/pale after | dark + mid after |
|---|---:|---:|---:|
| city | 26,993 (79 %) | 8,783 (26 %) | 18,644 (55 %) |
| Houthaven | 125 | 9 | 96 |
| IJburg | 1,283 | 527 | 849 |
| Zeeburgereiland | 168 | 40 | 151 |

## 4. Strips

Each strip is panorama | before | after, Storybook look, desktop, own engine, `world=live`, 1326x761 frames.

- **Before:** the committed bundles, with the 68 pre-fix tiles served from `artifacts/newbuild/old-data`.
- **After:** the lane's scratch bundles with `&newbuildFamily=1`.

Spec: `tests/e2e/newbuild-strip.spec.ts`. Spots: `scripts/newbuild/spots.json`. Sheet: `scripts/newbuild/sheet.ts`. The PNGs
are in `map-recall2-screenshots-a1/buildings/2026-11-10-newbuild/`, each 1.6 MB or more; `all.jpg` holds all nine.

| spot | verdict | what the after frame shows |
|---|---|---|
| Narva-eiland (1c694c0d) | PASS | The white flat boxes are now orange-red and dark brick, with set-back glazed crowns on the taller blocks. |
| Danzigerkade Ydek (2c486751) | PASS | The roof slab sits at ground-floor canopy height (4-5 m), as in the 2025 panorama, not across the third floor. The office beside it is now brick. |
| Houthavenkade 26 / 4e Gymnasium (75242f30) | WARN | The large-recipe GLB still shows its blank brown wall. Its neighbours gain brick and crowns. The blank-wall cause is measured, not fixed (§1c). |
| houthaven-2021-orange | PASS | The court blocks turn orange-red brick, matching the panorama's tone family. |
| houthaven-2018-dark | WARN | The front is brick with wide windows and a set-back crown, but its draw is red. The panorama shows dark purple-brown. Walls are an area draw, not this pand's own measurement. |
| ijburg-2021 | PASS | The pale block becomes an anthracite tall-window block; the rest of the row is unchanged. |
| ijburg-2009 | PASS | The pale grey block is now dark grey with dark frames, close to the panorama's dark timber and brick. |
| sluisbuurt-2025 | WARN | The large orange block is unchanged: it is undated or not housing, so outside the family. Only the foreground blocks change. The Sluisbuurt OSM gap fills have no year (§1a). |
| zeeburgereiland-2016 | WARN | Pale grey becomes dark brick with large windows. The panorama's white wave-balcony block cannot be expressed. |

Net: 5 PASS and 4 WARN. The family clearly beats the white boxes the user reported. It stays **off by default** in this lane for
two reasons:

- turning it on changes `BAY_STYLES.modern` (191 to 192 layers) and so the shell layer hash;
- the baked coarse shells then need `world:compile`, which is the integrator's.

The recommended flip is in the integrator TODO.

The after frames also show newer ground surfaces (lawns, paving), because the scratch `own-ground-game` bundle is built
from current source and the committed one is older. That difference is not the lane's.

**Strip harness finding:** `sharedWorkerPool` is first-caller-wins. The own-ground bundle (`own-ground-game.bundle.js`)
creates the pool with its own bundled copy of `withWorkerFlags`. So a new worker flag reaches the chunk worker only
after **that** bundle is rebuilt too, not just `three-buildings`. The first two after-runs showed no change for this
reason. The spec now routes bundles and tiles at the context level, so the routes also reach the worker.

## 5. Round 2 (coordinator review of all.jpg)

The coordinator's verdict on round 1:

- houthaven-2018 drew orange against a dark purple-brown photo;
- Zeeburgereiland 2016 drew dark brown against a white-banded photo;
- the area draw overruled the photo on single blocks.

### (a) Per-pand walls

`contemporaryFamily.ts` now resolves the wall in this order, and `ContemporaryLook.wallSource` says which one won:

1. **The pand's own measured front.** This is T0 `buurtProfiles/modernPandWalls.ts`: 5,079 calibrated rows from the
   panorama-thumbnail pipeline (HISTORY "measured own colour").
2. **The lane's own 94 panorama samples.** These are in `contemporary-walls.json` `pands`, coded like the T0 rows (`b`/`p` + hex).
3. The area draw.
4. The pooled draw.

Fronts the colour alone cannot carry are tagged by eye from the measuring panorama in `scripts/newbuild/front-tags.json`:

- `bands`: four pands take the new **`BALCONY_BAND`** preset (`modern#10`, `facadeAssembly: 'balcony-band'` in
  `bayTextures.ts`), a pale balcony band with a dark top line and a mid bottom line across every upper storey.
- `tall`: houthaven-2018 takes `modern#9`, the tall French-balcony windows.

Tests in `contemporaryFamilyOn.test.ts` cover three cases:

- houthaven-2018 (0363100012247676) resolves to `own` #666761 (L < 45), drawn `tall`;
- Zeeburgereiland (0363100012244416) resolves to `own` #4b302c, drawn `band`;
- an unmeasured id falls back to `area`.

Flag off, nothing changes: `modern` stays at 191 layers, and `bayLookFor` deep-equals the old output.

The round-1 strip spots for the six pand strips framed the neighbours (the longest-edge pose). They now stand where the
measuring panorama stood (`make-spots.mjs` `PANO_POSE`: the panorama position plus the sample heading), and the
panorama column is that same thumbnail.

### (b) A texture-only window grid for large-recipe blank walls

`otherWalls: 'window-grid'` (`buildingRecipe/intent.ts` `OTHER_WINDOW_GRID`) keeps the unlisted walls as the same
blank geometry but gives them their own slot, `wall@grid` (`fitLarge.ts` `WINDOW_GRID_WALL_SLOT`). The pieces:

- **Exporter:** writes the material extra `windowGrid: true`.
- **City look:** `cityLook.ts` adds `WINDOW_GRID_LAYER_FLAG = 64` to the slot ordinal of brick, stucco and stone
  cells. The vertex shader strips the flag, and the slot fragment paints `cityWindowGrid` over the cell:
  - 3.0 m bays by 3.2 m storeys, windows at 44 % by 50 % of the cell, a pale frame and dark sky-graded glass;
  - antialiased with `fwidth` and faded out once a cell drops under a few pixels.
- **Cost:** no triangle and no draw call. Houthavenkade 26 stays at 11,984 triangles, inside the 12k gate.
- **Absent:** nothing carries the slot or the flag (`windowGrid.test.ts`, `cityLook.test.ts`).

Houthavenkade 26 opts in. The staged GLB (`install-large.ts` without `--install`) is in
`artifacts/building-recipes/houthavenkade-26-247232/`. About 9,000 m² of its wall carry the grid: the courtyard, the
east wing and the east end.

**Shown in the game.** Three spots are in `artifacts/newbuild/spot-hk26.json`: the user's spot plus two close ones, on
the west end and on the courtyard and south side. The pairs are in the screenshots directory:

- `r2-hk26-window-grid-*.png`: before (the committed bundles and the public GLB) against after (the lane bundles and the
  staged GLB). The west and south walls go from blank brick to a regular window grid.
- `r2-hk26-grid-only-*.png`: the same lane bundles, public GLB against staged GLB. This isolates the grid. The glazed
  set-back top floor appears in both halves, so it comes from current main's bundles, not from this change.

At the user's own spot (110 m off, bearing 200) the grid shows on the far west end and the back wing. The tall blank
slab in that frame's foreground is another pand: it appears in both halves and comes and goes between runs.

**Debugging note for the integrator.** A landmark's `layer`, `normal` and `uv` arrays are released after upload
(`landmarks/releaseVertexData.ts`), so an in-page probe reads them as empty. Check the grid with a magenta shader
build instead. The lane did this, and the grid lit exactly the unlisted walls.

### (c) Years for OSM gap fills

`scripts/newbuild/gap-fill-years.ts` reads the gap-fill Overpass answer (the `fill-new-build-gaps` query, open OSM data)
and publishes `[year, -1, 0]` rows into `building-facts` for gap-fill outlines with a `start_date`:

- 3,595 rows in 163 tiles;
- rows that already exist are untouched.

Undated gap fills in the strip areas went down:

| area | undated before | undated after |
|---|---:|---:|
| Houthaven | 7 | 5 |
| IJburg | 40 | 24 |
| Zeeburgereiland | 9 | 2 |
| Sluisbuurt | 10 | 5 |
| Overhoeks | 18 | 9 |

Note: once dated, these outlines draw as their era, **with the flag off too**. That is the intended fix (they drew as
1860-1914 houses), but it changes the baked shells, so the world needs a recompile.

### (d) Census r2 (flag on, Storybook, generic 2000+ pands)

| area | dark | mid | light | pale |
|---|---:|---:|---:|---:|
| city | 11,250 | 7,598 | 6,380 | 8,769 |
| Houthaven | 75 | 34 | 44 | 8 |
| IJburg | 309 | 553 | 246 | 525 |
| Zeeburgereiland | 107 | 45 | 18 | 41 |

City-wide pale is flat against round 1 (8,783 to 8,769, 26 %), and dark plus mid goes from 18,644 to 18,848. Own
measurements move single blocks both ways: they keep the fronts that really are pale pale, and darken the ones the
area draw had lightened. Output: `artifacts/newbuild/census-after-r2.json`.

### (e) Strips r2

Same setup as round 1, with two changes: the before tiles are `artifacts/newbuild/old-data2` (origin/main's slab tiles
plus the pre-gap-fill facts), and the after bundles are `artifacts/newbuild/bundles4`, which now include
`signature-placement`. The six pand spots now stand at their measuring panorama's pose (§5a).

| spot | verdict | after frame |
|---|---|---|
| Narva-eiland (1c694c0d) | PASS | Orange-red and dark brick blocks, as in round 1. |
| Danzigerkade Ydek (2c486751) | PASS | The canopy is at ground-floor height; the office is dark brick. |
| Houthavenkade 26 (75242f30) | PASS (at the close spots) | Window grid on the unlisted walls (§5b). The user's spot is far, so the grid is small there. |
| houthaven-2021-orange | PASS | Orange brick on the left; the corner block is rose-red brick, a little muted against the photo's orange. |
| houthaven-2018-dark | **PASS (was WARN)** | Dark grey cladding (own wall #666761) with tall French windows and rails. Reads like the photo's dark panels; the photo's panels are glossier and nearer black. |
| ijburg-2021 | PASS | The block is red-brown brick, as in the photo. The photo's white upper band is not drawn. |
| ijburg-2009 | PASS | Dark grey with dark frames; a neighbour turns from pale grey to beige. |
| sluisbuurt-2025 | WARN | The framed block is w1185360235, a gap fill now dated 2025 (§5c). It changes from orange to dark red-brown, closer to the photo's brown. It has no band tag, so its balcony bands are not drawn. |
| zeeburgereiland-2016 | **PASS (was WARN)** | Dark brick under pale balcony bands on every upper storey, as in the photo. The brick is warmer than the photo's charcoal. |

Net: 8 PASS and 1 WARN, and no strip is worse than round 1.

**Flip recommendation: yes.** Turn on `newbuildFamily` with the shell-hash recompile. It now puts each pand's own measured front
ahead of the area draw. The worst remaining case (Sluisbuurt) is still better than the orange it replaces. The
gap-fill years and the Houthavenkade 26 GLB are independent of the flag and can land first.

## Kit cannot yet express

- **Window grids that follow the wall.** The shader grid (§5b) is one fixed 3.0 x 3.2 m cell. It does not read the
  storey count, the bay width or the ground floor, so a glazed ground or a tall plinth gets the same grid. 141 other
  large recipes could opt in, but each needs a look.
- **Varied parapet heights across one block.** 3DBAG LoD1.2 gives one height per pand. LoD1.3 faces exist in the
  cached CityJSON (`towerPodium.ts` already reads them) but do not reach the runtime tiles.
- **Recessed loggias** as geometry, and glass balcony slabs on generic chunks. Only the gallery preset paints open
  balconies.
- **Set-backs from evidence.** The family's set-back is a weighted draw (35 % of blocks of 14 m and up). The real
  ones are in the 3DBAG LoD1.3 roof faces.
- **Years for OSM gap fills without `start_date`.** 3,595 are now dated (§5c); the rest are still drawn as 1860-1914 houses.
- **Balcony bands found automatically.** The `bands` and `tall` tags are hand tags from the panorama sheet (5 pands).
