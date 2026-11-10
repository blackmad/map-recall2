# The house line

One pipeline for building a house: describe → preview → compare → stage → publish, each station a command that
runs alone in Node. Plan: `docs/handoffs/house-line-plan-20261110.md` (issue #338 and siblings). Sections are
written by the lane that ships each station; §1 (HouseSpec) is lane H1's.

## 2. Preview in Node (`house:preview`)

Seeing a house used to mean a world recompile, a bundle rebuild, a dev server and Playwright: minutes per look.
`npm run house:preview` renders one house's front elevation in Node through the game's own code, in about a second
from a cold start and 0.1–0.3 s per re-render in `--watch`.

```sh
npm run house:preview -- 0363100012164843                 # front.png + measure.json
npm run house:preview -- 0363100012164843 --photo --threeq # + compare.png (render | photo) and a 3/4 view
npm run house:preview -- --intent scripts/building-recipes/houses/cw-heren-175702/intent.json --watch
npm run house:preview -- 0363100012175702 --recipe --photo # the recipe route (compiled GLB)
```

### What it runs

| Step | Code (the runtime's own) |
|---|---|
| Source + decorators | `scripts/world/pipeline.ts` `gameChain()` + `loadTile()` (`useBrowserMath` first, as the compiler) |
| Party-wall neighbours | `BuildingContextIndex` over the pand's tile and any adjacent tile within 60 m, the runtime's exclusion rule |
| Street fronts | `scripts/world/shellBake.ts` `shellStreets` / `shellProfiles` |
| Mesh | `threeBuildingFeatures.ts` `buildFeatureChunk(…, 'walls')` then `'extras'` (ORIGIN-local metres, x east, y north, z up) |
| Atlas | `look/paintLookAtlas.ts` `paintLookArrays` under `scripts/house-preview/nodeDom.ts` stubs (@napi-rs/canvas) |
| Raster | `src/canalRecall/houseSpec/softRaster.ts`: perspective-correct uv, `fract` wrap, bilinear colour + mask by vertex layer, the unlit shader's `c *= mix(1, tint, m.r) * mix(1, accent, m.g)` and the shade in `tint.a`, z-buffer, back faces culled, 2×2 supersampling |
| Front wall | `staging/pand-reference/<pand>/reference.json`'s wall when there is one (photo and render share one axis at 50 px/m), else `scripts/pand-reference/select.ts` `pickWall` (the rule `rectifyWall`'s callers use) |
| Likeness | `buildingRecipe/measureFacade.ts` on render and photo, judged by `houseSpec/previewVerdict.ts` with `likeness.ts`'s tolerances: wall ΔL ≤ 0.12, hue ≤ 12° (both saturated), mean glazing ± 0.15, window columns ± 20 % (a WARN), window shape class |

The recipe route (`--recipe`) compiles `scripts/building-recipes/houses/<id>` with `compile.ts` and renders its GLB
with `landmarks/facadeCompare.ts` `renderElevation` in flat game colours (`likeness.ts` `gameColour`), then the same
measurement. One command covers both routes.

### Output and cache

- `artifacts/house-preview/<pand>/front.png`, `threeq.png` (`--threeq`), `compare.png` (`--photo`), `measure.json`
  (wall, heights and storey lines, chunk counts, the decorated properties, overrides applied and not applied, both
  measurements, the verdict, timings).
- Atlas cache: `artifacts/house-preview/atlas-<look>-<size>-<hash>.bin`, colour RGBA then mask RG
  (`look/lookAtlas.ts` byte layout). The hash covers the painter's import closure, the brick photo and the Node
  stubs; the first run paints (~0.8 s), later runs load (~0.1 s).
- Pand → tile index: `artifacts/house-preview/pand-tiles.json`, built by one scan of the building tiles (~0.3 s) the
  first time a pand is missing from it.
- Photos: `staging/pand-reference/<pand>/front.jpg` (make one with
  `npx tsx scripts/pand-reference/run.ts --name=<run> --ids=<pand>`; set `PAND_REFERENCE_CACHE` to the main
  checkout's `.cache/pand-reference` to reuse its panoramas), else the block-face strip crop of the wall
  (`scripts/block-face/faces/*/strip.json`, image from `staging/block-face/<face>/strip.jpg` or
  `$MAP_RECALL_SOURCE_DATA/block-face-strips/<face>/strip.jpg`).

### What the raster does not reproduce

The far and roof distance tiers, mipmaps and the cell-tap prefilter, the lit (Lambert) and city-look shaders (sun,
wall gain, grain: the ride's default frame is lit and in the city look, so tones differ from a ride frame), the
analytic window SDF, shadows, the ground lift, post-processing, and the runtime's tile-wide row rhythm for window
layers unless `--whole-tile` is given (~1.5 s per render). Overrides: until H1's resolver lands, only the front's
gable reaches the generic path (`monumentGable`); every other design field is listed under
`overrides.notApplied` in `measure.json`.

**When to fall back to `render.ts`:** when the question is lighting, a distance tier or the city look's materials,
render the GLB with `scripts/building-recipes/render.ts` (headless Chromium under `/tmp/canal-pw.sh`) or take a
ride frame; for shape, rhythm, openings and wall colour, the preview is the tool.

### Measured (2026-11-10, the user's Mac, other lanes running)

| Run | Time |
|---|---|
| Cold, atlas cached (`time npm run house:preview -- 0363100012164843`) | 1.5 s wall (0.95 s in the script) |
| First run, atlas painted | +0.8 s |
| `--watch` re-render, front only | 0.09–0.17 s |
| `--watch` re-render with `--photo` | 0.18–0.34 s |
| `render.ts` one ortho frame of the same face (Chromium + SwiftShader, `ortho-compare.ts`) | see the H2 hand-back on #338 |

Acceptance sheets: `scripts/house-preview/gate.ts` puts the preview beside the `render.ts` frame of the same pand's
GLB and the photo (`/tmp/canal-pw.sh node --import tsx scripts/house-preview/gate.ts --face=<face>:<pand> --recipe=<house>`).

### `--help`

The command prints this text (`HELP` in `scripts/house-preview/preview.ts`; `scripts/house-preview/help.test.ts`
fails when the two differ):

```text
npm run house:preview -- <pandId | spec.json> [flags]

Renders one house's front elevation in Node through the game's own chunk builder (threeBuildingFeatures
buildFeatureChunk, the decorator chain of scripts/world/pipeline.ts) and facade atlas painter, with a software
rasteriser (src/canalRecall/houseSpec/softRaster.ts). No dev server, no browser.

  <pandId>            BAG pand id (0363100012164843 or NL.IMBAG.Pand.0363100012164843)
  <spec.json>         a house spec file: { "pandId": "...", "design": { fronts, roof, palette, ... } }
                      (same as --spec <file>)

Flags
  --spec <path>       apply a house spec's design to the pand before the decorators run (see "Overrides")
  --intent <path>     apply a CanalHouseIntent (scripts/building-recipes/houses/<id>/intent.json or a block-face
                      house intent) the same way; its pandId names the pand when no pand id is given
  --photo             add the reference photo: staging/pand-reference/<pand>/front.jpg, else the block-face strip
                      crop of the pand's wall (scripts/block-face/faces/*/strip.json); writes compare.png and prints
                      the likeness verdict (wall dL/hue, glazing, columns, window shape) of render vs photo
  --threeq            add a three-quarter perspective view (threeq.png)
  --recipe [<id>]     the recipe route: compile scripts/building-recipes/houses/<id> (default: the house whose
                      intent names this pand) with the recipe compiler and render its GLB (renderElevation,
                      flat game colours) instead of the streamed generic path
  --whole-tile        build the chunk from every building of the pand's z14 tile, as the runtime groups it
                      (window layers follow the tile's row rhythm; ~1.5 s per render instead of ~15 ms)
  --watch             keep tile, neighbours, streets and atlas in memory and re-render whenever the spec/intent
                      file changes (needs --spec or --intent)
  --look <look>       atlas look (default photo)
  --ppm <n>           pixels per metre of the front elevation (default 50, the rectified photos' scale)
  --out <dir>         output directory (default artifacts/house-preview/<pand>)
  --help              this text

Output: <out>/front.png, threeq.png (--threeq), compare.png (--photo), measure.json (timings, wall, overrides,
measurements, verdict). Atlas cache: artifacts/house-preview/atlas-<look>-<size>-<painter hash>.bin (first run
paints, later runs load; a painter source change repaints).

Overrides (until the HouseSpec resolver of lane H1 lands): front gable -> monumentGable; every other design field is
listed under overrides.notApplied in measure.json (the generic path has no property for it yet).

Not reproduced: the far and roof distance tiers, mipmaps, the lit/city-look shaders (sun, wall gain, grain),
analytic window SDF, shadows, post-processing. When those matter (a lighting or tier question), fall back to
scripts/building-recipes/render.ts (headless Chromium) or a ride frame.
```
