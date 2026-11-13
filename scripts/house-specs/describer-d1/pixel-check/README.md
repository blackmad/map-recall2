# D1 pixel-check: do the staged AH07 fields reach a pixel? (2026-11-13)

Gate for D1 step 2 beyond the pilot buurt AH07. 194 staged parts (`artifacts/describer-d1/staged-ah07/`): 181 generic,
13 installed, 0 recipe.

## How it was measured

- Staged extract: `node --import tsx scripts/house-specs/build-house-specs.ts --extra-specs <dir of the 194 part files>`
  (coverage.json left out of the dir) -> `public/data/extracts/amsterdam/staging/house-specs` (gitignored). All 194
  land in it; vision-judge wins on 182 pands.
- Generic route in Node: `scripts/house-specs/describer-d1/pixel-probe.ts` (house:preview's `PreviewSession` and chunk
  builder, `threeBuildingMesh.ts layoutProbe`, `meshBuildingFor`). One process per condition:
  `HOUSE_SPECS_DIR` unset (published) or `staging/house-specs`, and `HOUSE_SPEC_DESIGN` unset (shipped holds) or `1`.
  11-pand sample (171218 plus shop, step, souterrain, speklagen, painted-brick, stucco, warehouse cases):
  `probe-summary.json`; all 181 generic AH07 pands (180 with a street run): `all-summary.json`.
- Browser: one `house:frames --lists` batch on `?world=live`, PW_PORT 4661. `tests/e2e/house-frames.spec.ts` now takes
  `HOUSE_FRAMES_SPECS_DIR=<staged extract dir>` and `HOUSE_FRAMES_SPECS_FOR=<out-dir substring>`: for the lists whose
  out dir matches, a context route serves `/data/extracts/amsterdam/house-specs/14/x/y.json.gz` from the staged dir.
  game.json records `stagedSpecs {on, served}` and the decorated `specRecipe`/`specShop`. No query flag picks the
  extract dir in the page (`vector-map.js` and `ownWorldView.ts` call `houseSpecEnricher(extract)` with the default
  `HOUSE_SPECS_DIR`), so this route is the way to get a staged spec without publishing.

## Code state against the doc

- `decorate.ts`: `SPEC_DESIGN_HELD = { storeys: false, look: true, shop: true }`. This matches docs/house-line.md (H11).
- `SPEC_WALLS_HELD = false` and `SPEC_BAYS_HELD = false`. The doc is stale in two places:
  - "The generic path reads it" still says bays are **Held** (SPEC_BAYS_HELD, #348). H1c released them.
  - The "Not wired" item 6 still says `palette.brick (held, SPEC_WALLS_HELD)`. H9 released it.
- The doc says "a photo front with no planner gable drops the register's" for every `PHOTO_GABLE_SOURCES` source. The code does that only when the view carries a gable:
  - `view.ts specView` passes a vision-judge gable into the view only when it is a full-width planner gable (step/neck/…).
  - It passes `flat` only from streetlevel-measured, reviewed or author.
  - So a vision-judge `cornice` never reaches `withHouseSpecCrown`, and the register gable gate alone decides.
- F1 (`look/facadeShader.ts`): `SHADER_FACADES_DESKTOP_DEFAULT = SHADER_FACADES_TOUCH_DEFAULT = false`. The F1 record is off in the shipped game.

## Field x route

The three routes:
- **Generic** is the near tier (`?world=live`, and world-v1 after a recompile; the same chain).
- **Recipe** is `toRecipe` -> GLB. No AH07 pand takes it: the parts have no `roof`, so `toRecipeReport` returns null. The recipe column cites code.
- **F1** is `facadeRecord.ts packFacadeRecord`, behind `?shaderFacades=1`. The F1 column cites code.

| Staged field | Generic (shipped) | Generic, measured (181 AH07) | Recipe | F1 record |
|---|---|---|---|---|
| fronts/0/storeys | **drawn**: `view.storeys` -> `specRecipe.storeys` + `storeysFit` -> `streetFacadeRendering.ts specStoreyFit` (nearest) | drawn = staged 40 -> 142 of 157. Upper-storey pitch > 4.5 m on 0 -> 42 pands (19 of 31 with a souterrain): the count is drawn over 3DBAG's whole wall with no souterrain or attic. 171218: 5x2 at 2.66 m -> 3x3 at 5.31 m | drawn (intent `storeys`) | drawn (`r.storeys`, no source gate) |
| fronts/0/bays | **drawn**: `SPEC_BAYS_HELD=false` -> `specRecipe.bays` -> `specCellCount`/`frontageLayoutScale` | columns = staged 46 -> 143 of 164 | drawn | drawn (`r.baysUpper`) |
| fronts/0/bands | **ignored**: `view.ts specLook` reads `fronts/0/speklagen` (the intent object) and `windowSurround`, never `bands`; no view key; no generic band component | 0 of 92 change anything, even with `HOUSE_SPEC_DESIGN=1` (171218 `speklagen`: same preset in all four runs) | drawn (intent `bands` -> wallTrim/lightBands) | **held by source**: `bandsSrc = srcClass('vision-judge', 0.7) = 1 < 2` -> the style prior |
| fronts/0/souterrain | **ignored**: no view key (`view.ts` reads `basement` only for a stoop); "Not wired" 5 | no change on 31 pands; makes the storey fit worse (above) | drawn (`souterrain`, needs a basement other than `none`) | packed (`r.souterrain`, plinth 0.9 m); shader reads only `plinthDm`, no souterrain storey |
| fronts/0/gable `step` | **drawn**: `view.ts plannerCrown` -> `withHouseSpecCrown` photo branch -> `monumentGable` | 5 of 5 changed (`monumentGable` null -> step) | drawn | n/a (roof planner) |
| fronts/0/gable `cornice` | **ignored**: not a planner gable, so not in the view; the register gate decides | 0 of 77 change | drawn | n/a |
| fronts/0/windowHead | **held**: `SPEC_DESIGN_HELD.look` -> `view.look.arch` -> `bayLook.ts bayLookFor` preset | default 0 changes; `HOUSE_SPEC_DESIGN=1` changes the preset on 81 of 117 | drawn | drawn (`r.windowHead`, no gate) |
| fronts/0/cornice `none` | **ignored**: no view key; "Not wired" 4 | 0 changes | drawn | drawn (`r.cornice` = none drops the style band) |
| fronts/0/basement | not staged in AH07; generic reads it only as a stoop (`specStoop`) | n/a | drawn | packed, not drawn |
| facts/pui | **held**: `SPEC_DESIGN_HELD.shop` -> `view.shop` -> `specShop` -> `threeBuildingFeatures.ts shopfrontOf` | default 0 changes; `=1` flips the shop flag on 25 pands (171889: the OSM shop dropped for `residential`) | **ignored** (a fact; `toRecipe` wraps `design` only) | drawn (`groundKind` from `x.pui`, `groundSrc` 1) |
| palette.wallMaterial | **drawn** as `registerFinish` (`decorate.ts houseSpecPatch`) and the brick test of the wall rule (`specWallIsBrick`) | `registerFinish` set on 169 of 180; no preset or cell change measured | drawn | drawn (`r.wallMaterial`, `wallSrc` 1) |
| palette.brick (wall hex) | **drawn**: `SPEC_WALLS_HELD=false` -> `specWallColour` (trim-misread rule, lift, pale-warm guard) -> `specRecipe.wallHex` | wall hex changed on 169 of 180 | drawn | drawn (`facadeWallRGB` = the mesher's wall) |

The 13 installed AH07 pands draw their GLB, and no staged field reaches them on any route.

## 171218 (Weteringschans), one house:frames batch, `?world=live`

- **Today:** 5 storeys x 2 columns, dark wall, no stoop or souterrain, flat-headed windows.
- **Staged:**
  - 3 storeys x 3 columns, with 5.3 m upper storeys.
  - The wall is #3e3a35, nearly today's #3c3732.
  - No speklagen, no souterrain, and no arched top storey (the spec has no windowHead for 171218).
  - The frame flags `wallColour: darker than its neighbours, rel game 0.586 vs photo 1.09`.
- The staged spec reached the page: `game.json` shows `specRecipe {bays 3, storeys 3, wallHex #3e3a35}` and `stagedSpecs {on: true, served: 6}`.
- The two game frames differ on 79.6 % of pixels. The AH07 neighbours change too.

## Verdict

On the generic route, which 181 of 194 AH07 pands take:
- **Ignored:** bands, souterrain, basement, cornice and a cornice gable.
- **Held:** shop/pui (`SPEC_DESIGN_HELD.shop`) and windowHead (`.look`).
- **Drawn:** storeys, bays, step gable, finish and wall colour.

Even under `HOUSE_SPEC_DESIGN=1`, bands and souterrain change nothing. Describing more of them will not show until they are wired. The next lane is wiring:
- `bands` into the view and look;
- a souterrain/basement storey in the generic storey fit;
- releasing look and shop.

It is not more description. The storey count without the souterrain also stretches the upper storeys on 42 pands.
