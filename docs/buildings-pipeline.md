# Buildings pipeline: intent recipes → GLB

One recipe-first path for ordinary canal houses. A person or vision model
writes a ~20–40 line **intent** (components and counts, no coordinates); a
deterministic **fit** derives every metre from BAG/3DBAG **facts**; the
lifted canalhouse component library compiles the GLB; automated **gates**
check it. Follows the decision in `docs/plans/facade-component-output-contract.md`
(branch `terra/facade-component-contract`): models classify, compilers build.

## Run it

```sh
# 1. facts: 3DBAG item (cached as houses/<id>/3dbag.json), frontage, panorama crop
node --import tsx scripts/building-recipes/facts.ts --house=<id> --pand=<16 digits> --street=<Street>   # first time
node --import tsx scripts/building-recipes/facts.ts --house=<id>        # later: reads intent.json
# 2. write scripts/building-recipes/houses/<id>/intent.json (look at artifacts/building-recipes/<id>/photo-*.jpg)
# 3. compile + gates (+ shared-mesh grouping when several ids are given)
node --import tsx scripts/building-recipes/compile.ts --house=<id>[,<id>...] [--strict]
# 4. renders: per-house contact sheet, or a street row
node --import tsx scripts/building-recipes/render.ts --house=<id> [--existing=<glb> --existing-anchor=<lng,lat>] [--textures]
node --import tsx scripts/building-recipes/render.ts --row=<id>,<id>,... --out=artifacts/building-recipes/<row>/row.png
# street batch: reference crops -> facts -> intents -> compile/gates/share -> install -> in-game
npm run pand-reference -- --name=bilderdijk --street="Bilderdijkstraat" --limit=30        # staging/pand-reference/<bagId>/front.jpg ...
node --import tsx scripts/building-recipes/batch-facts.ts --street=Bilderdijkstraat --prefix=bilder --pands=<6-digit or 16-digit ids>
node --import tsx scripts/building-recipes/refsheet.ts --pands=<ids> --out=artifacts/recipe-street/ref-1.png   # crops side by side to draft from
node scripts/building-recipes/houses/bilder-draft.mjs                          # the drafting table -> houses/bilder-*/intent.json
node --import tsx scripts/building-recipes/render.ts --sheet=<house ids> --out=artifacts/recipe-street/sheet-1.png   # crop | front | 3/4 columns
node --import tsx scripts/building-recipes/install.ts --house=<ids> --tolerance=0.5   # compile + gates + share + catalogue + GLBs
PW_PORT=4413 npx playwright test recipe-street --project=desktop --project=iphone   # in-game screenshots + runtime facts
# tests (schema, sameAs, Bloemgracht 78–90 roof regression, street houses, mirror/frames, shared cache, runtime spec)
node --import tsx --test src/canalRecall/buildingRecipe/streetHouses.test.ts
node --import tsx --test src/canalRecall/buildingRecipe/buildingRecipe.test.ts
```

Outputs go to `artifacts/building-recipes/<id>/` (untracked): `model.glb`,
`fitted-recipe.json` (the measured `CanalHouseRecipe`), `report.json` (fit,
gates, timings), `contact*.png`. Nothing is installed into game catalogues.
Diagnostics: `open-edges.ts <id>`, `debug-fit.ts <id>`.

## Files

| Path | Role |
| --- | --- |
| `src/canalRecall/buildingRecipe/intent.ts` | Schema + validator (rejects any coordinate/metric key) |
| `src/canalRecall/buildingRecipe/facts.ts` | 3DBAG decode (LoD0 BAG footprint, LoD2.2 ground/roof rings), frontage finder, front top profile |
| `src/canalRecall/buildingRecipe/fit.ts` | intent + facts → `CanalHouseRecipe` |
| `src/canalRecall/buildingRecipe/compile.ts` | `sameAs` resolution, canonical intent key, jog backing, crown verges, slope-class roof colours |
| `src/canalRecall/buildingRecipe/gates.ts`, `roofChecks.ts` | Gates and roof-fidelity measures |
| `scripts/building-recipes/` | CLIs, render page, `houses/<id>/{intent,facts,photos,3dbag}.json` |
| `src/canalRecall/canalhouse*.ts`, `scripts/canalhouse-recipes/` | Component library lifted from `wip/canalhouse-recipes-20261008` (asset dump left behind) |

## Intent schema (`kind: "canal-house"`)

Per front: `street`, optional `share` (left-to-right split of one frontage
between fronts), `gable` (spout/neck/raised-neck/bell/step/point/cornice/flat),
`crownCap`, `storeys` (full storeys incl. ground), `bays` (number or per
storey), `atticWindows`, `dormers`, `doorBay` (0-based from the viewer's left,
or null), `tallGround`, `basement` (none/windows/stoop/stoop-and-windows),
`cornice` (none/simple/bracketed/heavy), `windows` (sash/sash-small-panes/
cross/plain/arched/shop), `hoist`, `shopfront {colour, fascia}`, `repeat
{count | "fit", mirrorAlternate}`, per-front `palette`. Per house: `roof.material`
(slate/black-tile/red-tile/bitumen/zinc/copper), `palette {brick, frame, door,
stone, shutters}` as named swatches or `#rrggbb`, `sources[]` (photo id, date,
licence, image path).

**Reuse.** `{"sameAs": "<neighbour id>", "id", "pandId", "address", "sources",
"overrides": {...}}` deep-merges onto the neighbour (fronts merge by index).
`canonicalIntentKey` hashes the identity-free design; `compile.ts` with several
ids groups houses with equal keys and fitted width/eaves/crown within ±0.3 m
into one shared mesh and writes `artifacts/building-recipes/shared/instances.json`
(mesh file, `placementRD`, `rotationYDeg`, `mirror`). Drafting a row: draft the
first house from its photo, then for each next house show the drafter the
already-drafted neighbours' photos + intents and ask first "does this match
one of them? answer with sameAs + overrides", drafting from scratch only when
not. `repeat` covers one BAG parent carrying N identical modules (19th-century
rows, double fronts); modules are laid out in one elevation today.

**Large tier (planned, typed, rejected by the validator).** `kind: "large"`
keeps the 3DBAG LoD2.2 massing as-is and selects a facade *system* per wall,
addressed by 3DBAG wall-surface index (`walls[].wallSurfaces`): brick-bay-grid,
ribbon-windows, curtain-wall, plinth-shopfronts, blank, plus entrance/signage
and `roofPlant`; budget ~12k tris. To add it: `facts.ts` already decodes walls
via `extractFacadeWallPlanes`; add `fitLarge()` emitting one library elevation
per wall group (footprint/roof stay the survey path) and dispatch on `kind` in
`compileBuilding`. Leidsestraat 67's ribbon-window front is the first customer.

## Fit rules (deterministic)

Footprint and roof: 3DBAG LoD2.2 ground rings and roof surfaces verbatim via
`surveyRecipe` (no generated roof volumes). Frontage: seed edge = outward edge
facing the named street (routing extract) within 35° whose sightline to the
nearest street point does not cross the footprint; extended by
`discoverCompleteFrontage` (jogs ≤ 0.35 m, retried at ≤ 1 m when it reports a
possible partial front). Eaves = 10th percentile of the 3DBAG roof height
sampled 8 cm inside the frontage; gabled crown top = max(profile peak + 0.3,
min(ridge + 0.3, eaves + 0.9 × width)). Storeys: ground ×1.1 (×1.32 tall
ground/shopfront), uppers diminishing 4%/storey, basement 0.7–1.2 m. Bays:
equal pitch with 9% side margins, windows 58% of pitch. Library-side ordering
(facade x from the ring edge start) is detected and authored left-to-right
layouts are mirrored when needed.

## Gates (on the decoded GLB)

| Gate | Limit |
| --- | --- |
| triangle-budget | ≤ 3,000 |
| finite / non-metallic | all positions finite, metallic 0 |
| footprint-vs-bag | raster IoU ≥ 0.90 against BAG LoD0 |
| ridge-vs-3dbag | roof max within 0.30 m of LoD2.2 roof max |
| eaves-vs-3dbag | fitted eaves within 0.30 m of facts eaves |
| storey-height | upper storeys 2.3–4.6 m (catches wrong storey counts) |
| no-floating-parts | every welded component touches ground or a supported component |
| open-edges | ≤ 2 m of genuine single-use edge (T-junction seams excluded) |

Named regression `buildingRecipe.test.ts`: Bloemgracht 78–90 (the seven-owner
row held for "uniform taupe masses and tall rear ridges dominate crowns"):
roof triangles within 0.1 m of 3DBAG planes, roof area = footprint ±1%, one
colour per slope class and none equal to the wall, no roof higher than a
gabled crown within 2.5 m of the front; 88's cornice front shows its 3DBAG
gable triangle as roof verge, not masonry.

## Measured (2026-10-09, M-series Mac, SwiftShader renders)

| Building | Facts | Compile+gates | Render | Tris | Gates |
| --- | --- | --- | --- | --- | --- |
| Bloemgracht 78, 80, 82, 84, 86, 88, 90 | ~1 s each | 11–60 ms | ~1.5 s | 800–2,948 | all pass |
| Keizersgracht 569–575 (two fronts, 37 m) | 1–3 s | 0.24 s | ~3 s | 8,458 | budget fail |
| Leidsestraat 67 / Kerkstraat 50 (corner) | 2 s | 0.10 s | ~3 s | 4,324 | budget fail |
| Marnixstraat 124–138, five parents (timed batch) | 7 s total | 26 s total incl. drafting | 6 s row | 1,008–1,154 | all pass |

Marnixstraat batch wall-clock: 39 s for five houses (~8 s/house): one intent
drafted from the panorama crop, four `sameAs` one-liners; 4 of 5 share one
mesh (parent 4's eaves differ by > 0.3 m). Keizersgracht end-to-end was ~155 s
wall-clock including two pipeline fixes made on the way; Leidsestraat took
longer (frontage-seed fix, an interrupted session) and is not a clean timing.
Compare: the hand-built ordinary path is ~2 h per building. Drafting here was
done by the authoring agent itself, not by spawned Haiku/Sonnet drafters.

Contact sheets: `artifacts/building-recipes/{keizersgracht-569-575/contact.png,
leidsestraat-67-kerkstraat-50/contact-{leidsestraat,kerkstraat}.png,
bloemgracht-8*/contact.png}`; rows `artifacts/building-recipes/bloemgracht-78-90/
row.png`, `row-textured.png`, `marnixstraat-row/row.png`.

## Textures

`export-glb.ts` writes box-projected UVs in metres (1 UV = 1 m) and
`materialSlot` + `tint` in material extras (brick, stone, frame, door, glass,
roofTile, slate, bitumen). `make-textures.ts` makes procedural 256 px brick and
roof-tile trials (untracked, `artifacts/building-recipes/textures/`);
`render.ts --textures` multiplies them under the tint. At street distance the
brick reads as faint coursing; the roof tile reads well on steep red roofs.

## Known gaps

- Facade proportions are rules, not rectified measurements: window sizes,
  storey splits and crown shapes are plausible, not measured. Ornament
  (pilasters, festoons, claw pieces, finials), loggias, ribbon windows and
  roller shutters are outside the canal-house schema.
- Large/complex owners blow the 3k budget (Keizersgracht 8.5k, Leidsestraat
  4.3k): tall 3DBAG roofs with many partitions plus ~20 bays. They need the
  large tier or a per-kind budget.
- The 3DBAG roof is honest but not pretty: complex partitions show as faceted
  dark planes; gable silhouettes come from the crown profile, so a 3DBAG
  ridge running parallel to the street behind a "point" gable intent gives a
  gable taller than the roof.
- Panorama auto-selection is good on canals in leaf-off months, poor on narrow
  streets (Leidsestraat: near-vertical crops); intents may cite better photos.
- `repeat` modules share one elevation: the library admits one entrance per
  elevation, so only the first module gets a stoop.
- Shared meshes are consumed by the ordinary layer (see *Shared meshes at runtime*), but only genuinely identical designs share: palette differences between neighbours, 0.3-0.5 m eaves steps and rear footprint notches keep most rows at one mesh per house.

## For the integrator

Suggested npm scripts (not added; integrator owns `package.json`):
`"building:facts": "node --import tsx scripts/building-recipes/facts.ts"`,
`"building:compile": "node --import tsx scripts/building-recipes/compile.ts"`,
`"building:render": "node --import tsx scripts/building-recipes/render.ts"`,
`"test:building-recipes": "node --import tsx --test src/canalRecall/buildingRecipe/buildingRecipe.test.ts"`,
and the lifted library suite
`"test:canalhouse-recipes": "node --import tsx --test src/canalRecall/canalhouse*.test.ts scripts/canalhouse-recipes/*.test.ts"`.
No browser bundle is needed for the pipeline. Runtime: the ordinary-buildings
layer would need shared-geometry instancing (one GLB, N transforms from
`instances.json`, optional mirror with winding flip) to profit from reuse, and
a loader path for the shared tiling material set keyed by `materialSlot`.

## Street batch: Bilderdijkstraat (2026-10-09)

19 ordinary 19th/20th-century houses (1881-1939, 5-7 m fronts, shop ground floors) drafted from the
pand-reference rectified crops (`front.jpg`, `front-alt.jpg` where trees/scaffolding hid the front),
compiled, gated (all pass, 578-2,645 tris), and installed into the ordinary catalogue. Drafting table:
`scripts/building-recipes/houses/bilder-draft.mjs`. Six more pands of the street were dropped because
the reference wall (short side, a corner) is not the Bilderdijkstraat frontage the fit uses.

Schema additions for this street (all validated, fitted, tested): `bayWindows {bay, storeys}` (erkers via the
library's glazed bay), `balconies {storeys, bays, projecting?}` (French window + rail, optional slab),
`bands: none|storey|lintel|both` (stone courses), segmental heads capped at 4 chords (`headSegments`),
and `roofAllowanceM` on the fit report: declared dormers may stand 1.9 m above the LoD2.2 roof max
(LoD2.2 has no dormers) in the ridge gate. Not added: stepped/neck crowns (existing `step`/`neck` were used),
stoops on repeated modules (single-house parents here), brick banding in a second brick colour.

### Shared meshes at runtime

`compile.ts` groups houses whose canonical intent is equal **or the left-right mirror** (`instances.ts`
`mirrorIntent`/`matchDesign`), fitted width/eaves/crown/roof-max within `--tolerance` (default 0.3 m;
0.5 m used on this street, deltas recorded as `maxDimDeltaM`) and whose footprints agree: IoU >= 0.6
overall and >= 0.9 in the first 8 m behind the front (`frontZoneIoU`; rear notches are invisible to the
player). Each unique mesh is exported once **in its frontage frame** (origin = frontage midpoint, +X along
the front, +Z outward). `instances.json`/the catalogue then carry per house `{anchor, northOffsetDegrees,
mirror}`. Catalogue entries with `instance` become `sharedModel` specs (`ordinarySpecFor`); legacy entries
are untouched. `signature-landmarks-source.js` decodes a shared URL once (`SharedAssetCache`, reference
counted), clones the scene per instance (geometry/materials shared), applies `scale.x = -1` for mirrors
(negative determinant: three.js flips the front face, so winding stays correct) and frees GPU resources with
the last instance. Exact BAG-host suppression (`suppressOsmIds`) is unchanged.

Browser bundles to rebuild after merging: `npm run build:canal-signature-landmarks`,
`build:canal-game-landmarks`, `build:canal-game-presentation`, `build:canal-route-selection`, `build:canal-3d`.
