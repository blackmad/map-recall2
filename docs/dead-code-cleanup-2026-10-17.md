# Dead-code cleanup, 2026-10-17

Branch `preview/dead-code-20261017`, based on `origin/main` at `50caf0b1f`.
Input: the draft candidate report at `14a6c2284:docs/dead-code-report.md`.
Every entry in that report was treated as unverified. Its "high confidence"
section was wrong in several places: `scripts/block-face/roof-golden.ts` is
imported by tests, `scripts/street-surveys/street-style.ts` is imported by five
scripts, and three "unlinked" HTML pages are referenced from `package.json` and
`firebase.json`. This cleanup does not use the draft's list of 582 scripts.
The candidates below came from a fresh import graph and symbol cross-reference,
and each one was then checked by hand.

## Totals

- 4 deletion commits across 31 source files: **649 lines deleted, 4 inserted**
  (net −645 lines).
- **41,977 bytes** removed (the summed size of those files at `50caf0b1f` minus
  their size after the deletions).
- 1 bundle-rebuild commit (`0405e971a`). In five bundles only minifier
  identifier names change, and each file keeps its byte size. See Gate results.
- No data file, extract, model, lab/review HTML page, test file or
  TODO/HISTORY entry was touched.

## Method

1. **Import graph.** `/usr/bin/git ls-files`, then a regex over every tracked
   `.ts/.tsx/.js/.mjs/.mts/.cjs` file (excluding `artifacts/` and `*.bundle.js`).
   The regex covers `import … from`, `export … from`, `import()`, `require()`
   and bare `import '…'`, and it handles the minified form `import{x}from'…'`.
   Relative and `@/` specifiers were resolved, and `.js` was mapped to `.ts`.
   This lists the `src/` and `scripts/` files that no other file imports.
2. **Entry filter.** Any unimported file whose path (without extension) appears
   in `package.json`, a `scripts/*` build script (`build-3d-bundles.mjs` etc.),
   `.storybook`, `vite.config.ts`, `playwright.config.ts` or `index.html` is an
   esbuild/page entry and was dropped from the list. So was any file named in
   another file.
3. **Symbol cross-reference.** Every `export function|const|let|class|interface|type`
   name in non-test `src/**/*.ts(x)` and in the 977 imported `scripts/` modules
   was checked with one `rg -o -w -F -f` pass over the repo. That pass excluded
   `node_modules`, `artifacts`, `dist*`, `*.md` and `*.bundle.js`, and kept
   `*.html`, `*.js`, `*.mjs`, `*.json`, `*.yml`, `package.json`, `tests/` and
   `stories/`. The candidates are symbols whose only hits are in their defining
   file **and** that appear exactly once in that file (`rg -c -w`), so nothing
   uses them internally either.
4. **Per-candidate re-check** with `rg -l -w -F "<symbol>" --glob '!node_modules' --glob '!artifacts' .`.
   This run includes committed bundles, so a name exposed on a `--global-name`
   IIFE global is caught. A candidate was kept only if this listed nothing but
   its own file, or nothing beyond a `.md` mention.
5. **Recency guard.** `/usr/bin/git log --since=3.days --all --name-only` gave
   6,738 paths. Any candidate file on that list was skipped.

## Deleted

### `00f91624f`: orphaned canalhouse preview entry, and `modern-fit.ts`

| Path | Lines | Evidence |
| --- | --- | --- |
| `src/canalRecall/canalhouseRecipePreview.ts` | 199 | `rg -l -F canalhouseRecipePreview` → only the file itself. This was the browser entry for `canalhouse-recipes.html`. Commit `f23238960` deliberately did not lift that page ("The 1,765-file preview asset dump, the game preview row hooks … stay out"). No HTML, bundle, npm script or build script references it. |
| `src/canalRecall/canalhousePanorama.ts` | 57 | `CanalhousePanorama` and `StreetPanorama` → only this file and `canalhouseRecipePreview.ts`. |
| `src/canalRecall/landmarks/canalhousePreviewSelection.ts` | 44 | `canalhousePreviewRowForMembers`, `mergeCanalhousePreviewModels`, `canalhousePreviewEntries` and `CanalhousePreviewCatalogue` → only this file and `canalhouseRecipePreview.ts`. |
| `scripts/landmarks/modern-fit.ts` | 35 | `rg -F modern-fit` and `rg -w fitFace` → only the file itself. It is a library module with no importer and no CLI. |

Checks: `npm run lint` passed and `npm run test:canalhouse-recipes` passed 187/187.

### `718a612fb`: 21 exported functions and one type that nothing calls

For each name, `rg -l -w -F <name> --glob '!node_modules' --glob '!artifacts' .`
listed only the defining file. `signQuadUv` also appears in `SIGNAGE_EXPLORATION_PLAN.md`, a doc mention only.

| File | Removed |
| --- | --- |
| `src/canalRecall/cityAppearanceMachineSigns.ts` | `machineSignRecords`, `machineSignBandFitsFrame` |
| `src/canalRecall/facade/boresightFit.ts` | `fitBoresightRobust`, plus `RobustBoresightFit`, which only it used |
| `src/canalRecall/facade/evalCrop.ts` | `r1BeatsR0` |
| `src/canalRecall/facade/pointCloudGeometry.ts` | `columnDepthProfile`, `rowHeightProfile` |
| `src/canalRecall/facadeCells.ts` | `paintProceduralLayers` |
| `src/canalRecall/facadeSignMaterial.ts` | `signQuadUv` |
| `src/canalRecall/largeLetterPostcard.ts` | `measureLetterContentBounds` |
| `src/canalRecall/largeLetterGlyphPaths.ts` | `clearLargeLetterFontCache`, `measureGlyphAdvance`, `buildWarpedGlyphPath`, plus `glyphPathCommands`, which only it called |
| `src/canalRecall/landmarks/wallPlanes.ts` | `wallUV` |
| `src/canalRecall/ownMap/mapCamera.ts` | `zoomForMetresPerPixel` |
| `src/canalRecall/shopfronts.ts` | `shopfrontsLoaded` |
| `src/canalRecall/transit/transfers.ts` | `networkLineName`, and the `lineDisplayName` import it alone used |
| `src/utils/osm.ts` | `fetchLocalOSMFeatures` |
| `src/utils/geo.ts` | `findNearestCity`, and the `City` import it alone used |
| `src/mapRecall/neighborhoodGaps.ts` | `parentsOf` |
| `src/utils/featureCache.ts` | `removeCacheEntry` |

Checks: `npm run lint` passed. The 8 node test files that import these modules
passed 34/34: `boresightFit`, `elevationRoofline`, `evalCrop`,
`facadeMeshCompiler`, `pointCloudGeometry`, `ownMap`, `shopCanopies` and
`streetFacadeRendering`.

### `fd6776872`: nine unused constants and type aliases

`ornamentBoxTris` in `facadeOrnaments.ts` was an alias of `BOX_TRIS`, and the
now-unused `BOX_TRIS` import went with it. `LARGE_LETTER_FONT_PUBLIC_URL` in
`largeLetterGlyphPaths.ts` is unused because the story hardcodes the path. The
others are `HomeLeg` (`game/modes.ts`), `PaperTheme` and `EnamelTheme`
(`hudTheme.ts`), `BgtWayWidth` (`ownGround/bgtWidth.ts`; the decimetre encoding
is still documented in the file header), `AreaCandidate`
(`mapRecall/areaFacts.ts`), `WallElement` (`facade/pointCloudGeometry.ts`) and
`ShellPatch` (`buildingRecipe/shellRepair.ts`). Each had zero hits outside its
own declaration. The type aliases are erased at compile time, so no bundle can
change.

Checks: `npm run lint` passed, and the 6 node test files that import these
modules passed 121/121.

### `670b4a0ec`: five unused exports in shared script modules

`fileSize` (`scripts/lib/bagTileBuild.ts`) went, along with its `stat` import.
The others are `resolveSourceImage` (`scripts/building-recipes/sourceData.ts`),
`tileOriginRd` (`scripts/roofs/orthoTiles.ts`), the aliases `snapshotReviewData`,
`verifySnapshot` and `restoreSnapshot` (`scripts/review/review-snapshot.ts`),
and `readPoints` (`scripts/sculptures/colmap.ts`). Each had zero hits outside
its declaration. These modules are libraries imported by other scripts. They
are not themselves artifact-producing entries, and every removed function was
uncalled.

Checks: `scripts/` is outside the root `tsconfig` `include`, so a temporary
tsconfig type-checked the five modules plus their 20 importers. The only errors
were three TS7053 errors in `scripts/building-recipes/measure.ts:67`, a line
this change does not touch. The 3 node test files that import these modules
passed 14/14.

## Gate results

`npm run check:canal` at `670b4a0ec` exited 1:

- `scripts/check-canal.ts` (lint, the builds and the typed checks):
  `159 passed, 0 failed in 5.3 min`. `build-storybook` passed in 27.3s.
- The chained `test:houseboat-kinds`, `test:hud`, `test:street-gables` and
  `check:stale-installs` passed.
- `test:look` failed `pass 101, fail 1`:
  `face-gorontalo-25-47-r1: no entry in chunkWallExposureData.ts`. The same
  failure occurs at the base commit `50caf0b1f` in a clean detached worktree, so
  it is **pre-existing**: an installed chunk is missing its exposure entry, and
  `build-chunk-wall-exposure.ts` needs a rerun.
- `test:look` stopped the `&&` chain, so the remaining steps were run one by
  one. `test:bag-tiles`, `check:covers`, `test:building-types`,
  `check:osm-under-models`, `test:osm-under-models`, `check:landmark-abutters`,
  `test:landmark-abutters`, `check:noorderkerk-corner-houses`,
  `check:landmark-inventory`, `check:signature-fallback` and
  `check:manual-landmarks` all exited 0.
- `test:tile-buildings` failed `pass 17, fail 1`: `compiler golden: pilot tiles
  hash per pand as committed — 16/33655/21538: per-pand geometry changed`. It
  fails the same way at `50caf0b1f`, so it is **pre-existing**.
- Bundle rebuild: check:canal rewrote `game-ui.bundle.js`,
  `preferences.bundle.js`, `recall-store/index.js`, `study-facades.bundle.js`
  and `transit.bundle.js`. The only differences are minifier identifier names,
  and each file keeps its exact byte size. Rebuilding the same five at
  `50caf0b1f` reproduces the committed files byte for byte, so the renames come
  from the deletions. The deleted code had already been tree-shaken out.
  The rebuilt bundles are committed as `0405e971a` so that the source and
  bundles agree. The integrator owns bundles and may regenerate them instead.

Smoke e2e, run as `bash /tmp/canal-pw.sh env PW_PORT=4450 npx playwright test
tests/e2e/canal-recall.spec.ts -g "boots and starts a route" --project=desktop`:
`✓ 1 [desktop] › boots and starts a route from the setup form (13.5s)`,
`1 passed (19.5s)`. The web server warned that it could not resolve
`@sparkjsdev/spark` from the untracked `storybook-static/` build output, which
is unrelated. No server was left on port 4450.

## Kept despite looking dead

- **Entries for lab-page bundles that have no npm build script.**
  `src/canalRecall/case24GableCityPreview.ts` builds
  `case24-gable-city-preview.bundle.js`, loaded by
  `case24-gable-city-preview.html`.
  `src/canalRecall/ordinaryBuildings/materialTrial.mjs` builds
  `ordinary-material-trial.bundle.js`, loaded by
  `ordinary-material-trial/viewer.html`. The same holds for
  `ordinaryBuildingPilot/viewer.mjs`, `ownGround/main.ts`, `ownMap/main.ts` and
  `rendererSpike/main.ts`, behind `ordinary-building-pilot`, `own-ground`,
  `no-maplibre` and `renderer-spike`. The lab pages stay public, and deleting
  their sources would leave the committed bundles impossible to rebuild.
- **All `*.bundle.js` files.** Every committed bundle is loaded by at least one
  HTML page. Five have no producing npm script (`no-maplibre`,
  `ordinary-building-pilot`, `ordinary-material-trial`, `own-ground`,
  `renderer-spike`), but all five are lab-page bundles. None is an orphan.
- **Exports that appear in a committed bundle under their own name.** These
  are `paperCssVariables` and `hudRadius` (`hudTheme.ts`, in
  `game-ui.bundle.js`), `LEGACY_ZOOM_DEFAULT` (`game/preferences.ts`, in
  `preferences.bundle.js`) and `registrationFixtureIsAgreed`
  (`facade/registrationGold.ts`, in `facade-registration.bundle.js`). Removing
  them changes a generated bundle, which the integrator owns, and they may be
  read from a `window.CanalRecall*` global.
- **Building-kit components in `scripts/landmarks/*-kit.ts` and
  `historic-shared.ts`.** These have no caller today: `shedRoof`, `rectFaces`,
  `envelopeRoof`, `pointOn`, `windowRows`, `backstopWalls`, `frameText`,
  `gableRoofQuad` and `ridgedHip`. They are kit vocabulary for future builders,
  and building lanes are told to extend the kit, not shrink it.
- **Domain constants and enumerations that document a format.** These are
  `RECIPE_ZOOM` (named in the `tileBuildings/tiles.ts` header),
  `NOMINAL_QUAY_CROWN_NAP_M`, `SEGMENT_OTHER`, `SEGMENT_SKY`,
  `SEGMENT_UNKNOWN`, `GABLE_TYPES`, `WINDOW_TYPES`, `ROOFLINE_GRADE_*`,
  `FAMILIES`, `SHAPES`, `MACHINE_SIGN_*`, `FloorRowCorrectionSet` and
  `OpeningFrameCorrectionSet`. Removing them saves almost nothing and loses
  documentation.
- **`compoundSourceCandidate.fixture.ts` → `compoundSourceDiagnostic`.** The
  fixture module throws at load time if the plan does not fit, so evaluating
  it is itself a check.
- **Every export in a file touched on any branch in the last three days**, 17
  in all. Examples are `sinkArrays`, `closedParts`, `loadTourState`,
  `RAILING_GREEN`, `CITY_PIPELINES`, `tilesInBbox`, `ROADS_EXTRACT`,
  `surveyMarkingTriangles`, `clearRouteHistory` and `pickStampCollection`.
- **Every `scripts/` entry point in the draft's list of 582.** The per-landmark
  `check-*-geometry.ts` files, the fire-station and Haparandaweg scripts, and
  the ordinary-buildings, canalhouse-recipes, da-costa-block, review/*,
  facade-rebuild and tree scripts are either generators of committed artifacts
  (`*-export-draft.ts`, `*-prepare.py`, `build-*`, `stage-*`) or checks run by
  hand against committed models, which behave like tests. The rules exclude
  both. Many are also cited in `docs/` handoffs as the way to reproduce a
  model. Running `scripts/canalhouse-recipes/capture.mjs` would fail today,
  because it loads the missing `canalhouse-recipes.html`. It was kept because
  the page may return from `wip/canalhouse-recipes-20261008`.
- **`.d.ts` files.** `src/vite-env.d.ts` and `src/canalRecall/game/legacyGlobals.d.ts`
  are ambient declarations and have no importers by design.

## Still uncertain

- **About 1,600 exports in `src/` that are used only inside their own module.**
  Dropping the `export` keyword would be churn with no deletion, so they were
  left alone. knip's 1,072 "unused exports" are mostly in this group.
- **The deletion candidates in the draft's dependency section were not acted
  on.** It lists `motion`, `3d-tiles-renderer` and `autoprefixer`, and `vite`
  declared twice. `package.json` belongs to the integrator.
- **Entry scripts in `scripts/` whose only purpose was a past one-off.** The
  ones that write only into `artifacts/` or `.cache/`, not into committed
  paths, could be candidates, but telling which they are needs per-script
  judgement from the lane owner.
- **The lab-page source `materialTrial.mjs` has no npm build script.** Its
  bundle cannot be rebuilt by any command in the repo. The same is true of the
  other five no-script lab bundles.
