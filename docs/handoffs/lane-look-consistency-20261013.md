# Lane: look consistency — one rig, one palette, written art direction (2026-10-13)

Plan: `docs/plans/digital-twin-direction-20261013.md` §5 (R2) and §2 "Look".
Lane owns `src/canalRecall/rendererShared/*`, the palette modules, the
per-layer light rigs in `public/canal-drive/js/{signature-landmarks-source,
player-vehicles-source,inventory-trees-source,artis-animals,
detailed-buildings-source}.js`, Storybook/Playwright look states and
`docs/LOOK.md`. Not `game.js`, `index.html`, `package.json`, bundles, TODO,
HISTORY (report needed integrator edits). Default behaviour must not change
in this lane: everything lands behind the existing `?sharedFrame=1` flag or
as pure refactors with identical output.

## Findings to act on
- Six palette systems, three era schemes: `cityAppearancePalette.ts`
  (<1925/<1965), `buildingAppearance.ts` `AMSTERDAM_ERAS`
  (1800/1900/1945/1975/2000, no runtime consumer), `bayLook.ts` /
  `bayTextures.ts` (1860/1915/1945), `threeBuildingFeatures.ts` roof tones,
  `landmarkFronts.ts lookHex`, `buildingRecipe/recipeLook.ts` clamps.
- Five light rigs with different intensities (landmarks hemi 1.15 / sun 2.2
  / fill 0.55; vehicles 3.2 / 4.2; trees 2.15 / 1.7; detailed ambient 2.4;
  ordinary buildings unlit baked). `rendererShared/lightRig.ts` exists
  (sun 215°/40°), off by default (`SHARED_FRAME_DEFAULT` in `vector-map.js`).

## Deliverables
1. `src/canalRecall/look/palette.ts`: one palette module with one era scheme
   (keep 1860/1915/1945, the one with runtime consumers), one roof-tone table,
   one `materialSlot` → colour/texture-cell mapping, and the look variants
   (photo / procedural / storybook / cartoon / untextured) as parameter sets.
   Port every consumer to it; delete `AMSTERDAM_ERAS` and dead palette code.
   Pixel-identical output in the default path: prove it with the existing
   gallery/Playwright screenshots (`tests/e2e/storybook-visual.spec.ts`,
   `scripts/check-building-render-appearance.ts`) before and after.
2. Under `?sharedFrame=1` only: every three.js layer uses the shared
   `lightRig` and no private lights (landmarks, vehicles, trees, ARTIS,
   detailed buildings). Add a `lookParity` check: render the same block with a
   landmark, a recipe house and a generic extrusion under the shared rig and
   assert their mid-grey brick slots land within a luminance tolerance of each
   other (the "is this building really this dark?" class).
3. `docs/LOOK.md`: one page of art direction — sun angle and strength, sky /
   fog / tone mapping targets, palette and saturation rules, outline rule per
   look, what is textured at what distance, what the driving corridor must
   keep readable, how gallery reviews cite it. Derive the numbers from the
   shared-frame spike measurements in `docs/archive/research/own-renderer-spike-20261009.md`.
4. A ride-perf comparison `?sharedFrame=1` on vs off on the iPhone 4× oracle
   (`scripts/ride-perf-fixed-route.mjs`), numbers in the report. The real
   iPhone GPU test remains the user's; say so.

## Checks
`npm run lint`, `npm run test:landmark-shading`, `npm run build-storybook`,
`PW_PORT=4424 npx playwright test storybook-visual`, `node --import tsx --test
src/canalRecall/rendererShared/*.test.ts`, `scripts/check-building-render-appearance.ts`.
Return SHA, before/after screenshot paths, parity numbers, perf numbers.
