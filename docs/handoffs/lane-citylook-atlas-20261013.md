# Lane: `cityLook.ts` shared material atlas + shaders (migration step 2, 2026-10-13)

Plan: `docs/plans/digital-twin-direction-20261013.md` §2 "Look" and §7 GLB
cleanup goal 2; `docs/LOOK.md` (art direction, landed 2026-10-13);
`src/canalRecall/look/palette.ts` (one palette, landed 2026-10-13; it already
holds the `materialSlot` → cell/tint/tile mapping). Lane owns a new
`src/canalRecall/look/cityLook.ts`, the shaders it replaces, and the slot
inference script. Do not edit `game.js`, `index.html`, `package.json`,
lockfiles, bundles, catalogues, `TODO.md`, `HISTORY.md`. Flag-gated:
`?cityLook=1`; flag off renders byte-identically (prove it the way the look
lane did: `tests/e2e/look-consistency.spec.ts` + `scripts/compare-look-shots.mjs`).

## Why
Three parallel material systems dress buildings today: the city
`DataArrayTexture` cells (`bayTextures.ts`, generic facades), `recipeLook.ts`
(recipe houses), and the buildingTypes merged shaders. Landmark GLBs carry
their own materials, 0 of 190 builders tag `materialSlot`, so a landmark, a
recipe house and a generic extrusion never sample the same brick under the same
sun, and "is this building really this dark?" cannot be answered per model.

## Deliverables
1. **`cityLook.ts`**: one texture array whose layers are the slot table
   (brick variants, stucco, stone, frame, door, glass, pantile, slate,
   bitumen, flat greys, the bay cells), built from the existing cell painters;
   vertex attributes `layer, tint, accent, hidden` on every building mesh;
   two shader variants (unlit baked shade for the default frame, lit Lambert
   under `rendererShared/lightRig.ts` for the shared frame). Port
   `recipeLook.ts`, `bayTextures.ts` consumers and the buildingTypes merged
   shaders onto it behind the flag; keep their public functions as thin
   adapters so callers do not change.
2. **GLB slots**: `glbQuality.ts` gains `materialSlotCoverage` = share of
   visible surface area whose material carries `materialSlot` (+`tint`),
   reported per model by `audit:glb`; new exports are hard-gated at 100%
   (the builder helpers in `scripts/landmarks/build-manual-landmarks.ts`
   should set the slot from the material name by default so existing builders
   pass without edits where names are conventional). A one-time
   `scripts/landmarks/infer-material-slots.ts` writes slot+tint extras into
   the 300+ legacy landmark GLBs from material name/colour (dry-run report
   first: coverage before/after per model, ambiguous materials listed).
   `signature-landmarks-source.js:514-522` already honours the extras.
3. **Proof**: `tests/e2e/building-look.spec.ts` renders a landmark, a recipe
   house and a generic extrusion that all declare the same brick slot under
   the shared rig and asserts mean luma within 6% (extend
   `src/canalRecall/look/lookParity.ts`). Flag-off shots unchanged.
4. **Perf**: ride-perf (`scripts/ride-perf-fixed-route.mjs`, desktop primary,
   iPhone 4× secondary) with `?cityLook=1` on vs off; texture memory of the
   array.

## Checks
`npm run lint`, `npm run test:look`, `npm run test:landmark-shading`,
`npm run build-storybook`, the new spec, `npm run check:canal`. Report:
branch, SHA, coverage numbers before/after inference, luma table, perf
numbers, bundles the integrator must rebuild, and what is unfinished.
