# Lane H2: house preview in Node (2026-11-10)

Part of the house line (`house-line-plan-20261110.md`). Opus. Independent of H1 until its last step: start from a block-face or recipe intent, switch the input to `HouseSpec` when H1's `spec.ts` merges.

Seeing a house today means a world recompile, a bundle rebuild, a dev server and Playwright under `/tmp/canal-pw.sh`: minutes per look, ten looks per lane. This lane makes one look cost half a second: `npm run house:preview -- <pandId|spec.json> [--watch] [--photo] [--threeq]` renders the front elevation through the game's own geometry and painters, in Node, with no browser.

## Step 0 — measure before building (report first, 30 min cap)
Verify on origin/main with line numbers:
1. `scripts/world/pipeline.ts loadTile` + `gameChain()` give a decorated feature for one pand; `BuildingContextIndex` gives neighbours; `scripts/world/shellBake.ts shellStreets(root, [f])` gives street fronts; `useBrowserMath` must be imported first.
2. `threeBuildingFeatures.ts buildFeatureChunk(features, look, mode, streets, profiles, context)` in `'walls'` and `'extras'` modes returns positions/uv/layer arrays in ORIGIN-local metres; which attribute carries the atlas layer and which the tint mask.
3. `look/paintLookAtlas.ts paintLookArrays` needs `document.createElement('canvas')`, `document.baseURI`, `new Image()` for `materials/ambientcg/Bricks057/colour.jpg`, and falls back silently on image failure (the `catch`); atlas rows are stored flipped. `look/windowTable.test.ts` already stubs `document.createElement` with `@napi-rs/canvas`.
4. The fragment shader in `threeBuildingsBrowser.ts` (the `c *= mix(1, tint, m.r) * mix(1, accent, m.g)` line and the shade in `tint.a`), and the near/far tier blend you will not reproduce.
5. `src/canalRecall/landmarks/facadeCompare.ts renderElevation`: the triangle loop to extend; `buildingRecipe/measureFacade.ts` + `likenessVerdict` thresholds; `scripts/pand-reference/rectify.ts rectifyWall` footprint-wall choice.
6. Time `scripts/building-recipes/render.ts` on Nassaukade 506 (the comparison baseline) and record it.

## Deliverable
- `scripts/house-preview/nodeDom.ts`: the stubs — `document.createElement('canvas')` → `createCanvas` (must accept `getContext('2d', {willReadFrequently})`), `document.baseURI` → `pathToFileURL('public/canal-drive/')`, `Image` → a shim whose `src` setter loads the file with `loadImage`; export `installNodeDom()` and `assertImageLoaded(name)`. Nothing from here is imported by `src/`.
- `src/canalRecall/houseSpec/softRaster.ts`: pure; takes the chunk arrays + the painted atlas arrays + a view (orthographic front along the chosen wall's normal, or a perspective 3/4) and returns RGBA at a given px/m. Per pixel: perspective-correct barycentric uv, `fract` wrap, bilinear sample of colour and mask for the vertex layer, the shader's tint/accent/shade mix, near tier only, 2× supersampling, z-buffer. Unit test on a two-triangle quad with a known atlas.
- `scripts/house-preview/preview.ts`: load → neighbours → streets → chunk (`walls` then `extras`) → pick the front wall with the same rule as `rectifyWall` → raster at 50 px/m → PNG. `--photo` adds the rectified photo (`staging/pand-reference/<pand>/front.jpg`, else the block-face strip crop for the pand's span) beside it as `compare.png`, runs `measureFacade` on both and prints the `likenessVerdict` fields (wall ΔL/hue, glazing share, column count, window class). `--threeq` adds a 3/4 view. `--spec <path>` overrides the pand's spec (H1) or, until H1, `--intent <path>` applies a `CanalHouseIntent` through `toRecipe`'s inverse (just the `specRecipe` fields). `--watch` re-renders on file save, keeping tile, context, streets and atlas in memory.
- Atlas cache: `artifacts/house-preview/atlas-<look>-<hash of painter sources>.bin`; the first run paints, later runs load.
- Output: `artifacts/house-preview/<pand>/{front,threeq,compare}.png` + `measure.json`.
- Recipe-route houses (an installed GLB): compile with the existing recipe compiler, `renderElevation`, same `measureFacade` comparison, so one command covers both routes.

## Gate
- Nassaukade 152–145 (block face `nassau-145-152`, e.g. pand `0363100012164843`; memory `nassaukade-506-benchmark`: 506 is the houseboat the photo was taken from) and two Grachtengordel canal houses: `front.png` beside the `render.ts` frame of the same pand; `measureFacade` of both within the likeness tolerances (ΔL ≤ 0.12, hue ≤ 12°, glazing ±0.15, columns ±20 %). Where they differ, say which is right against the photo.
- `assertImageLoaded('Bricks057')` fails loudly when the shim breaks.
- Times on the user's Mac: cold with cache, warm in `--watch`; targets 3 s and 0.5 s; report the measured numbers whatever they are.
- `npm run lint`; no browser global referenced in `src/` outside the existing browser modules (grep `document.` in the new `src/` files = 0).

## Documentation
`docs/house-line.md` §2: the command, every flag, where output lands, the atlas cache, what the raster does not reproduce (far tier, shadows, post), and the one-line "when to fall back to render.ts". `npm run house:preview -- --help` prints from the same `HELP` constant. Hand back the doc diff with the SHA.

## Rules
`LANE-RULES.md`; `/usr/bin/git`; own worktree + port; link `node_modules`; `render.ts` baseline runs under `/tmp/canal-pw.sh`; no edits to `game.js`, `index.html`, lockfiles, `TODO.md`, `HISTORY.md`; `package.json` only for the `house:preview` script; hand back SHA, step-0 table, the three compare sheets, timings, and TODO/HISTORY text.
