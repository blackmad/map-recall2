# Buildings pipeline: intent recipes → GLB

One recipe-first path for ordinary canal houses. A person or vision model
writes a ~20–40 line **intent** (components and counts, no coordinates); a
deterministic **fit** derives every metre from BAG/3DBAG **facts**; the
lifted canalhouse component library compiles the GLB; automated **gates**
check it. Follows the decision in `docs/plans/facade-component-output-contract.md`
(branch `terra/facade-component-contract`): models classify, compilers build.

## Building categories (taxonomy, 2026-10-10)

Every placed model is exactly one of three categories, recorded in the source
data and typed in `src/canalRecall/buildingCategory.ts`:

| Category | What | Where it is recorded | Gallery |
| --- | --- | --- | --- |
| `landmark` | The curated landmark list: the surveyed 3D Warehouse batch and `manualCatalogue.json` entries without a `category`. **Only these** become destinations, cards, discovery/quiz items, route candidates or What's new landmark counts (`SIGNATURE_MODELS`). | absent `category` = landmark | `manual-landmarks.html` |
| `ordinary` | One-off, medium-fidelity reconstructions of large non-landmark buildings: the 38 non-recipe `catalogue.json` entries (industrial halls, office blocks, multi-plot canal warehouses ≥ ~320 m²) and the 13 Haparandaweg residential/industrial blocks (`"category": "ordinary"` in `manualCatalogue.json`). | `category` on every `ordinary-buildings-data/catalogue.json` entry; `manualCatalogue.json` | `manual-ordinary-buildings.html` |
| `street-survey` | The repetitive canal-house / block-face work whose aim is reusable geometry: block faces (`scripts/block-face/faces/*`), per-house recipes installed by `scripts/building-recipes/install.ts`, and every street chunk. | `category` on `catalogue.json` (written by `install.ts`) and on every `chunks.json` entry (written by `streetChunks/manifest.ts`) | `street-surveys.html` |

Rules: the game draws all three (`GAME_BUILDING_MODELS`); landmark status is
never inferred from being drawn. Haparandaweg 2–4 (Het 4e Gymnasium) stays a
landmark because it has a genuine POI identity; the other Haparandaweg blocks
have none. Keizersgracht 569–575 and Leidsestraat 67–71 were authored with the
recipe tooling but are single large buildings with their own export scripts,
so they are `ordinary`. Audits that need every modelled footprint use
`landmarks/placedModels.ts`. Regression: `src/canalRecall/buildingCategory.test.ts`.

**Street-survey catalogue** (`street-surveys.html`, typed in
`src/canalRecall/streetSurveys/`): street → block face → houses, with the face
status (installed / held + reason / staged), a strip photo vs model-ortho
thumbnail pair, shops, schema limits, inferred rears, and per-house recipe
models marked superseded when a face draws their pand. Rebuild:

```sh
node --import tsx scripts/street-surveys/street-pands.ts --street=Bilderdijkstraat   # BAG pand list (committed)
node --import tsx scripts/block-face/compile.ts --face=<id>      # staging report/chunk for each face (no --install)
node --import tsx scripts/street-surveys/build.ts --review-out=artifacts/street-surveys   # data + ~650 KB webp thumbs
npx esbuild src/canalRecall/streetSurveys/page.ts --bundle --format=iife --outfile=public/canal-drive/js/street-surveys.bundle.js --minify
```

The strip photos come from `staging/block-face/<face>/strip.jpg` (intake) and
per-house photos from `staging/pand-reference/<pand>/front.jpg`. Render-vs-photo
defects found by looking go in `scripts/street-surveys/reviews/<street>.json`.

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

**Window axes (2026-10-10).** A front has one grid of `axisGrid` vertical axes (default: the largest bay
count above the ground storey); every storey's windows sit on it, so they line up vertically, and the piers
(outer and inner) are equal (`piers: "margin"` restores the legacy 9% side margins). A storey with fewer
windows names its axes: `storeyAxes: {"4": [0,1,3]}` (storey from the ground = 0, `"last"` = top storey,
count must match `bays`); a count that is centred on the grid uses the centred axes; anything else warns
in the fit report. Balcony French windows are 15% wider than their neighbours. `crownCapSpan:
narrow|medium|wide` and `crownCapRise: low|normal` shape the parapet cap (`low` + `pediment` = shallow pointed gable).
Facade check: `npm run compare:facades -- --id=<id> --glb=<model.glb> --spec=...` with `columns` (window axes) and
`openings: ["2a3a42_glass"]` for recipe GLBs (see `scripts/landmarks/bilder-087959x-elevations.json`).

**Local shops.** `shopfront` (ONE schema for per-house intents and block faces; unknown keys are rejected) takes
only evidenced details: `name`, `sign {text, textColour, mount: fascia|wall|glazing, background, span, align}`
(real stroke-font geometry, `signage.ts`, ~10 tris/letter, never mirrored; `fascia` (default) needs `fascia: true`,
`wall` letters the band above the glass with no board, `glazing` letters the head of the widest pane), `fasciaColour`,
`entrance` (none/centre/centre-recessed/left/right/left-recessed/right-recessed), `glazing`
(single/split/transom), `displayWindows` (pane count across the shop glass, overrides `glazing`'s division),
`stallriser` (none/low/medium/high) + `stallriserColour`, `residentialDoor {side,
colour}` (a separate street door; `doorBay` is then ignored) with `shopShare`, and `evidence` (photo id/date, OSM
node). Without a `sign` the fascia stays plain; no placeholder text is invented. The stroke font won an in-game
comparison against the block-face lane's 5x7 block-capital decals on Bilderdijkstraat (2026-10-10): at 20-40 m the
block letters broke up (DANSWINKEL read as DNSWNKEL), the strokes stayed legible. Fronts with signs or side-specific
doors are not mirror-shared. Intent keys may not be called `top`, `left`, `position`... (coordinate guard).

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

**Large tier.** `kind: "large"` is a separate schema and pipeline; see
[Large tier](#large-tier-kind-large-2026-10-13) below.

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

## Large tier (`kind: "large"`, 2026-10-13)

Schools, blocks, offices, police stations, civic buildings and most landmarks:
the 3DBAG LoD2.2 massing stays exactly as surveyed (walls and roofs), and each
*wall group* gets a facade system and components cut into it. Budget 12k
triangles. Code: `src/canalRecall/buildingRecipe/{intent,largeIntent,fitLarge,largeCompile,largeGates}.ts`
on the block kit (`src/canalRecall/blockBuilding/{compose,panels,dissolve,systems,components}.ts`).

```sh
# 1. facts with LoD2.2 wall surfaces and neighbours (pand-reference cache; open data only)
node --import tsx scripts/building-recipes/facts.ts --house=<id> --pand=<16 digits> --large
# 2. which surfaces form which wall: table (bearing, width, eaves, top, ground, party) + plan PNG
node --import tsx scripts/building-recipes/walls.ts --house=<id> [--min-width=2] [--detail]
# 3. write houses/<id>/intent.json, then GLB + gates + contact sheets (photo | front-on | 3/4, + aerials)
node --import tsx scripts/building-recipes/large.ts --house=<id>[,<id>] [--strict] [--no-render]
npm run audit:glb -- --file=artifacts/building-recipes/<id>/model.glb
```

### Schema

`walls[]` is a list of wall groups; each names the 3DBAG wall surfaces it
owns (`wallSurfaces`, indices from `walls.ts`, never coordinates) and:

| Field | Values |
| --- | --- |
| `system` | `brick-bay-grid` (punched windows), `ribbon-windows`, `curtain-wall`, `plinth-shopfronts`, `blank` |
| `storeys` / `alignWith` | storey count under the group's eaves, or share an earlier group's storey lines (wings lining up with a centre block) |
| `baysPerStorey` | bays on the group's widest panel (default: the system pitch) |
| `ground` | `system`, `plinth-shopfronts`, `glazed`, `blank` |
| `windows` | `plain`, `two-light`, `cross`, `transom`, `low` (wide low windows set high in the storey) |
| `blankStoreys` | storeys with no openings (a blank floor over a shop, a closed upper mass) |
| `entrance` | `true` or `{bay, storeys, canopy}`: recessed glazed entrance; `storeys > 1` = an entrance hall |
| `signage` | text (A–Z, 0–9, `&'-.`, ≤ 60) or `{text, colour, mount}` with mount `fascia`, `wall`, `glazing` or `canopy` |
| `garageDoors`, `stringCourses`, `cornice`, `piers`, `balconies` | components |
| `police` | `{stripe, lamp}`: white fascia band with diagonal blue stripes and a POLITIE plate; blue lamp by the entrance (needs an entrance) |
| `palette` | per-group `brick`/`frame`/`stone` overrides |

Top level: `otherWalls` (system for walls in no group, normally `blank`),
`roof.material`, `roofPlant`, `palette` (`brick`, `frame`, `door`, `stone`,
`wallMaterial`), `sources[]` (one per wall group, in order, for the contact
sheets), `notes[]` (evidence: what each group is, what was left out and why).

### Fit rules

- Panels are coplanar, edge-connected LoD2.2 walls; walls of different groups
  never merge (`mergeKey`), so one 3DBAG plane can carry a ribbon front, a stair
  tower and a punched part side by side (Leidsestraat 67, surfaces 15/28/48).
  In recess mode a panel's strips are dissolved into whole faces so an opening
  may straddle 3DBAG's vertical strip seams.
- A panel belongs to the group holding most of its area; the group's main
  panel is its widest ground-touching panel (entrance, garage doors, bays).
- Eaves per panel: the height reached over ≥ 85 % of its width. Storey lines
  divide eaves minus a parapet (0.5 m flat, 0.15 m pitched); the ground storey
  is 1.25× for shop/glazed grounds, 1.15× before 1945. Storeys above the eaves
  (gables, towers) continue at the same height while they fit.
- Openings are cut 0.18 m into the wall (reveals; glass and frame ring on the
  back plane; bars 1.5 cm in front). Openings that do not fit a member face
  fall back to flush (counted in the report).
- Entrance: the middle bay unless `bay` is given; < 1.6 m wide openings get a
  single door. Garage doors take bays from the right and need ≥ 2.8 m bays.

### Gates (`largeGates.ts`, on the decoded GLB)

≤ 12,000 triangles; finite and non-metallic; footprint IoU ≥ 0.90 against BAG
LoD0; roof max within 0.30 m of the LoD2.2 roof max; per wall group, eaves within
0.30 m of the LoD2.2 roof 8 cm inside the wall (p10 of 24 samples), and
non-blank groups' storeys ground ≥ 2.3 m, upper 2.3–6.2 m (civic storeys run
taller than houses); no floating components; ≤ 2 m genuine open edge; every
block-kit part within 5 cm of the shell or an attached part. Then `audit:glb`
(z-fight, see-through, holes, blank walls) on the GLB. Bands skip cut openings,
and stand-off boxes (lamp, roof plant) are closed solids, so the components add
no open edges. `fit-golden` covers the fitted groups of every large house.

### Measured (2026-10-13)

| House | Pand | Tris | Openings | Gates | `audit:glb` |
| --- | --- | --- | --- | --- | --- |
| `politie-van-leijenberghlaan` | 0363100012102565 | 6,123 | 240 recessed | pass (IoU 0.94, ridge Δ 0.00) | PASS 3.3 |
| `leidsestraat-67-large` | 0363100012172459 | 1,487 | 33 recessed | pass | PASS 10.7 |
| `de-balie-large` | 0363100012168684 | 1,178 | 13 recessed | pass | PASS 22.8 |
| `social-history-large` | 0363100012164130 | 2,801 | 73 recessed | pass | PASS 88.6 (blank-wall warnings: the IISG really is blank) |

Leidsestraat 67 was 4,324 triangles as a canal-house intent and could not show
its ribbons; the large tier draws it in 1,487. The police station has no
stripe, lamp, canopy or garage doors in its 2016/2019/2025 panoramas, so its
intent does not use them; the police kit is exercised on that massing in
`largeTier.test.ts` (and rendered at `artifacts/building-recipes/police-kit-demo/`).
Fit/compile takes 50–170 ms per building.

### Arched openings, loading axes, name boards (2026-10-13)

`blockBuilding/arch.ts`: `WinParams.arch = {kind: 'round' | 'segmental' |
'pointed', segments?, rise?, springBar?, band?}`. The outline (rectangle plus a
polygonal head, 4-10 segments by width, exact springing points and apex) is cut
into one 3DBAG member wall (`PanelCtx.cutOutline`; `HoleRect` carries the
outline, so the deferred wall is triangulated around it) with a reveal quad
per outline edge, a frame ring and glass at the back, mullions stopping under
the head. Bands: `out: 0` is a flush brick rowlock band 1.2 cm proud in an
`arch@gN` slot a shade darker than the wall (cheap; its edges are seams on the
wall), `out > 0` a projecting stone band; imposts and keystone optional.
Bands and blocks must fit one emitted member face with 4 cm to spare. Default
compose output is byte-identical (`test:block-kit-installed`); tests and a
synthetic-wall golden in `buildingRecipe/archOpenings.test.ts`.

Intent (wall group): `arches: {windows, ground, band: brick|stone|voussoir|none}`,
`ground: "portals"` (tall doors in every bay), `hoist: {every, first} | {bays,
arch}` (loading-door stack: tall doors with sill and spring bar on the upper
storeys, a wide portal below), `nameBoards` (white plates over the hoist-bay
portals of the widest panel, left to right), `sills: false`, `frames: false`
(dark frames that read as glass: no ring, saves ~8 triangles per window),
`windows: "narrow"`. Top level `closedBands: true` closes string courses,
cornices and fascias (back face, mitred end caps) where 3DBAG faces stand cm
out of plane. Wall lettering on a group without an entrance sits between the
first two window rows on the emitted wall face. `large-stats.ts` counts
triangles without the budget; `large-mesh-hashes.ts` compares every large
recipe's mesh with `large-mesh-golden.json` (fit-golden covers only the fit).

| House | Pand | Tris | Gates | `audit:glb` |
| --- | --- | --- | --- | --- |
| `entrepotdok-164981` | 0363100012164981 | 11,156 | pass | PASS (zfight-near warning: flush bands) |
| `overtoom-283-084999` (Reade) | 0363100012084999 | 5,404 | pass | PASS |
| `amstel-142-186290` (Eden Hotel) | 0363100012186290 | 4,049 | pass | PASS |
| `nieuwpoortstraat-126319` | 0363100012126319 | 7,198 | pass | PASS |
| `ledenberch-38-243844` | 0363100012243844 | 324 | pass | PASS |

The Entrepotdok wall is 156 m: at 12k triangles only its canal front and one
rear panel get openings; the rest is blank (notes list what the photos show).

### Known gaps

- Curved fronts (De Balie's bow, the IISG's curve) are straight in 3DBAG.
- Pediments, basement windows, colonnades and masts are below the component
  grain; notes say so per house. Arched openings: see above.
- Wall groups are authored by surface index; `walls.ts` lists them, but a
  re-extracted 3DBAG item renumbers surfaces (re-run `walls.ts`, fit-golden
  catches the change).
- Not installed anywhere: large recipes are not in the catalogues yet.

## Known gaps

- Facade proportions are rules, not rectified measurements: window sizes,
  storey splits and crown shapes are plausible, not measured. Ornament
  (pilasters, festoons, claw pieces, finials), loggias, ribbon windows and
  roller shutters are outside the canal-house schema.
- Large/complex owners blow the 3k budget (Keizersgracht 8.5k, Leidsestraat
  4.3k): tall 3DBAG roofs with many partitions plus ~20 bays. They belong on
  the large tier (Leidsestraat 67: 1,487 tris as `leidsestraat-67-large`).
- The 3DBAG roof is honest but not pretty: complex partitions show as faceted
  dark planes; gable silhouettes come from the crown profile, so a 3DBAG
  ridge running parallel to the street behind a "point" gable intent gives a
  gable taller than the roof.
- Panorama auto-selection is good on canals in leaf-off months, poor on narrow
  streets (Leidsestraat: near-vertical crops); intents may cite better photos.
- `repeat` modules share one elevation: the library admits one entrance per
  elevation, so only the first module gets a stoop.
- Shared meshes are consumed by the ordinary layer (see *Shared meshes at runtime*), but only genuinely identical designs share: palette differences between neighbours, 0.3-0.5 m eaves steps and rear footprint notches keep most rows at one mesh per house.

## Bespoke landmark lane: photo first, inventory before geometry (2026-10-13)

The Hoofdbureau van Politie shipped without its sculpted Amsterdam-arms relief
(lion, banner, three figures on the Marnixstraat end wall). The lane had seen
"a sculpture group" and filed it under "what the facade systems could not
express". The root cause was the process, not the lane: the brief described
the building from memory ("corner tower, carved portal"; both wrong), the
lane rightly discarded it and was then left with a geometry checklist that
never asks *what makes this building recognisable*. The rule from the user
(2026-10-13): a hand-modelled building must carry its signature ornaments,
reliefs, sculpture, lettering and signs; the lane infers them from the
photos. The process that would have caught it:

1. **No brief from memory.** The integrator starts a bespoke lane with
   `node --import tsx scripts/landmarks/landmark-brief.ts --pand=<id>`
   (ornament-inventory lane, 2026-10-13), which fetches the panoramas
   (`pand-reference`, `all-walls.ts`), the BAG/3DBAG facts and any monument
   register text, and writes `scripts/landmarks/<id>-brief.md` with one
   rectified crop per exposed wall. The handoff links the brief; it does not
   describe the building in its own words beyond what a source says.
2. **Signature inventory before geometry.** The lane's first deliverable is
   `scripts/landmarks/<id>-inventory.json`: per wall, every feature a rider
   would notice at 1.7 m or on a gallery card — relief, sculpture, crest,
   gable stone, lettering, sign, clock, canopy, ironwork, tower, dome,
   colonnade, unusual window shape — with its approximate size, the panorama
   id it was seen in, and the plan: `modelled`, `simplified` (how) or
   `skipped` with a reason. "No component" and "the facade systems cannot
   express it" are not reasons: a bespoke builder exists for exactly those
   parts (`largeCompile` hooks for the regular walls, hand geometry for the
   rest). Budget the hand triangles against the inventory, not the other way
   round.
3. **The inventory is a gate.** `build-manual-landmarks.ts` refuses to export
   a landmark newer than 2026-10-13 without an inventory in which every item
   is resolved (`scripts/landmarks/check-landmark-inventory.ts`, in
   `check:canal`); `audit:glb` prints the inventory next to the geometry
   gates so the integrator sees them together.
4. **The lane proves each item.** The report lists the inventory with a crop
   of the photo and the matching render for every `modelled` item (the
   `review:sheet` per-wall sheet already does photo / model / overlay; the
   inventory rows link to it). A four-side aerial strip is not evidence for
   an ornament.
5. **The integrator reviews against the inventory**, wall by wall on the
   per-wall sheet, before installing; HISTORY records the inventory
   outcome (modelled / simplified / skipped with reasons). Un-holding and
   installing from the strip alone is what let the relief through.
6. **Retro-fit.** Existing bespoke landmarks get inventories in batches
   (`ornament-inventory.ts`), cheapest misses fixed in the builders, the
   sculpture groups that need a modeller go to the splat/impostor track.

### Tooling (ornament-inventory lane, 2026-10-13)

- **Brief**: `node --import tsx scripts/landmarks/landmark-brief.ts --pand=<BAG id> [--id=<slug>] [--wiki=nl:<Title>] [--address="Street 1"]`
  writes `scripts/landmarks/<id>-brief.md` (facts from BAG / 3DBAG / local extracts, register descriptions verbatim from
  `scripts/data/amsterdam-monument-register`, Wikipedia lead plus sculpture/facade/architecture sections with URLs, one
  section per wall) and the inventory skeleton `scripts/landmarks/<id>-inventory.json`. Crops (rectified, a second capture
  year, an aimed view, `contact.jpg`) go to `artifacts/landmark-briefs/<id>/` and are not committed (re-run; cached).
  It searches nl/en Wikipedia for the catalogue name and the address: the Hoofdbureau's own article is
  [Elandsgracht 117](https://nl.wikipedia.org/wiki/Elandsgracht_117), whose "Beeldhouwwerken" section names the arms
  relief, the banner verse (P.H. van Moerkerken) and Hildo Krop's three figures; the original lane cited only the street.
- **Every wall, not the long ones.** The brief takes walls >= 4 m (max 30). The stock `all-walls.ts` defaults
  (`--min-len=14 --max=8`) and `review-sheet.ts --walls=6` both drop the Hoofdbureau's 13.9 m Marnixstraat end wall,
  the one with the relief. `review-sheet --inventory` adds every inventory wall with a photo and items.
- **Schema** `src/canalRecall/landmarks/ornamentInventory.ts` (tests `ornamentInventory.test.ts`): per wall `tag`,
  `bearing`, `lengthM`, `centre`, `evidence` photo/inferred, `panoId`, `checked`; per item `id`, `kind`, `where`,
  `approxSizeM`, `plan` modelled / simplified (+`how`) / skipped (+`skip.reason`: not-visible, too-small, temporary,
  gone, needs-modeller) / open, `seenIn`, optional `sheetBox`; landmark `signature` = item ids, most recognisable first.
  "No component" / "cannot express" in a note is a schema error.
- **Gate** `scripts/landmarks/landmark-inventory-gate.ts`: required for a landmark whose GLB was first committed on or after
  2026-10-14 (git history with `--no-renames`; never committed = new) and for `INVENTORY_REQUIRED_IDS`. Required means:
  every photographed wall `checked`, no `open`, no `needs-modeller` (retro-fit only), a non-empty signature whose items are
  all modelled or simplified. `build-manual-landmarks.ts` refuses the export (`LANDMARK_INVENTORY_GATE=warn` downgrades for
  local experiments); `audit:glb --id=<id>` fails with `signature-inventory` and prints the rows under the gates (`--no-inventory`
  skips); `node --import tsx scripts/landmarks/check-landmark-inventory.ts [--id=<id>] [--verbose]` checks the catalogue and
  is meant for `check:canal` (integrator adds `&& node --import tsx scripts/landmarks/check-landmark-inventory.ts`).
  Existing inventories that are not required are schema-checked and their unresolved items printed as "would block".
- **Proof**: `npm run review:sheet -- --id=<id> --no-game --inventory` adds a fourth column with, per modelled/simplified
  item, the photo crop next to the same crop of the camera-matched render (`sheetBox`, else the whole view).

## Acceptance checklist (every building, every tier — 2026-10-09)

Two models passed review while plainly wrong: Nassaukerk (blank walls where
the photo has windows, accepted twice) and Het Pakhuis (five identical
symmetric gabled bays modelled as scattered windows and invented setbacks).
Both were judged as "recognisable from its best side". That is not the bar.

1. **Rhythm spec and signature inventory before modelling.** Per visible
   wall, from photos: bay count, which bays are identical, windows per bay
   per storey, symmetry axis, ground-floor type, gable/roof line, setbacks
   only if seen — and every ornament, relief, sculpture, crest, lettering,
   sign, clock or canopy, each with its plan (modelled / simplified /
   skipped with a reason that is not "no component"; see the section above). Cite
   the photo for each item. Store it next to the builder/recipe; for landmarks
   the machine-checked part is `scripts/landmarks/<id>-elevations.json`
   (counted blind from the photo, format in `docs/landmark-building-recipe.md` §7).
2. **Evidence per face.** Every street- or water-facing wall has a photo from
   that side (`pand-reference --prefer-bearing`), or is labelled
   **inferred** on the sheet and in the report.
3. **Camera-matched comparison.** Render the model from the panorama's own
   position/heading/fov; photo, render and overlay side by side. Judge bay by
   bay against the spec, not by overall impression.
4. **Automated gates.** GLB audit (`audit:glb`, incl. blank-wall check),
   facade-rhythm check against the spec (`npm run compare:facades -- --id=<id>`:
   openings per storey, window axes, mirror symmetry, gable peaks), attachment ≤5 cm, height ±0.5 m vs
   3DBAG, triangle budget.
   Landmark geometry audit (2026-10-10, part of `audit:glb`, logic in
   `src/canalRecall/landmarks/geometryAudit.ts`). Look at each finding; the
   numbers say where, the shots say whether:
   - **Detached openings.** Window/door/trim parts (materials glass, frame,
     door, louvre, blind, white, dark; parts ≤ 14 m) are grouped into
     assemblies (touching boxes) and measured against the vertical wall plane
     they face. *Floating*: no geometry within 3 cm (fail beyond 10 cm, e.g.
     Oude Lutherse Kerk east window 0.27–0.46 m proud of a skewed wall).
     *Overhang*: more than 12 % of the face projects outside the wall's
     silhouette, i.e. past a wall end, corner or gable edge (fail beyond 35 %).
     *Buried*: more than 30 % of the face sits behind solid wall with geometry
     in front of it, so the window never shows (Oude Lutherse Kerk's other
     east window; warn only — curved drums can trip it, Ronde Lutherse Kerk).
     Railings standing on the ground are ignored.
   - **Window rhythm** per facade (the elevations spec facades when
     `<id>-elevations.json` exists, else the four largest wall bearings):
     within a storey row, openings more than 25 % / 0.3 m off the row's median
     width or height, or 0.35 m off its sill/head; a gap of 2–3× the row's
     spacing between regular windows ("predicted missing"); columns more than
     0.25 m off the axis of an equal-count row below. Always a warning — some
     facades are irregular on purpose — so compare with the photo.
   - **Coplanar z-fighting.** Same-facing triangles of different parts or
     materials within 1 cm of one plane and overlapping by more than the
     block-face abutment shrink (5 mm), counted only where at least one of
     seven rays from the overlap escapes the model (overlaps buried inside a
     mass or under a dome are never drawn). Warn ≥ 0.25 m², fail ≥ 2 m²
     (H'ART portico: brick top and stone entablature both at y 10.4, 32 m²).
     Faces 1–3 cm apart are reported as `zfight-near`.
   - **Baseline, not a free pass.** Existing offenders are recorded in
     `scripts/landmarks/geometry-audit-baseline.json`; `audit:glb --id=<id>`
     fails only when `opening-floating-fail`, `opening-overhang-fail` or
     `zfight-m2` grows past the entry (new models have no entry, so must be
     clean). After a fix, lower the entry (`--write-baseline` on that id);
     never raise one to pass. Named regressions live in
     `scripts/landmarks/geometry-audit-pins.json` (status `open` = must still
     be detected, flip to `fixed` with the fix) and run in
     `src/canalRecall/landmarks/geometryAudit.test.ts`.
   - **Evidence.** `audit:glb -- --geometry-shots --top=12` writes close-ups
     (square-on + grazing for openings, plain + tinted for z-fight) and
     `artifacts/glb-audit/geometry/contact.png`. One-off views:
     `node --import tsx scripts/landmarks/geometry-audit-shots.ts --id=<id>
     --eye=x,y,z --target=x,y,z [--game-bias]` (`--game-bias` applies the
     game's landmark polygon offset, see below).
   - **In-game depth bias.** A model that is clean here can still stripe in
     game: `signature-landmarks-source.js` gives every landmark material
     `polygonOffsetFactor -32` (scaled by each triangle's depth slope), which
     reorders a model's own faces at grazing angles — hidden slab tops and
     band ends show through walls (Rijksmuseum entrance, reproduced with
     `--game-bias`, gone with `--bias=0,-4096`).
5. **Street-level in-game shot** from where riders actually pass it.
6. **Uncertainty blocks acceptance.** Anything a lane lists as unverified or
   uncertain is a hold until resolved; it is never merged "for now".
7. **Integrator record.** On install, HISTORY notes which sheets were viewed,
   which faces are inferred, and the gate results.

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

## Look pass: city look, components, roof clean-up (2026-10-09)

Integrator review: the 19 Bilderdijkstraat recipe houses looked worse than the procedural facades around them
(near-black flat brick, black windows, flat shop panels, flat grey roofs, missing arches/parapets/banding, 3DBAG
roof artefacts). Changes:

- **City look at runtime** (`src/canalRecall/buildingRecipe/recipeLook.ts`). GLB materials with a `materialSlot`
  get one shared shader: the city's brick cell (Bricks057 neutralised and lifted like `calmBayLayers('photo')`, mortar
  coursing, 3.36 m tile), the photo-look glass gradient with a reflection (0..1 pane UVs from the exporter), cream
  frames, roof cells (pantile/slate/flat, eave-aligned UVs), and the city's fixed-light shade (`wallShade` / roof
  formula) from the ENU normal; output is unlit sRGB like the city layer. Photo-sampled colours map into the city
  palette range (`cityWallTint` etc.: dark 087959 brick #5e4033 → L 0.37; slate → ROOF_TONES). Materials/textures are
  shared by every recipe house and skipped by per-model disposal. `signature-landmarks-source.js` dresses tagged GLBs
  (untagged models keep the synchronous path) and sets the per-entry ENU frame before each render; anisotropy 1 on touch
  devices (4 cost the iPhone ride p95 16.8 → 33.3 ms). The sheet renderer uses the same look (`--flat` for the old one).
- **Components**: `archedStoreys` (semicircular heads), `crownCapSpan: wide` (parapet with a rounded/pediment cap across
  the front), `archRings` (relieving arches over every arched head: stone or band brick), `palette.band` (second brick:
  lintel bands become brick stripes), and real shopfronts (piers, stall riser, framed glazing with mullions/transom,
  fascia with a pale lettering panel, all in `shopfront.colour`, which was previously ignored). Library: `accent` and
  `shop` palette surfaces (facadeDetail 11, ornament 2, opening 19).
- **Roof clean-up** (`roofCleanup.ts`, before the survey conversion): raised small clusters (each < 12 m², together
  < 25 m², > 0.8 m above every surrounding surface) are clamped to the surrounding top, except at a gabled front;
  a ridge LoD2.2 runs out to a cornice/flat front > 1 m above the eaves is hipped back at the roof's slope. Gates
  compare against the cleaned max and report the survey max; `roof-cleanup` caps clamped area at 25%.
  Regressions: `roofCleanup.test.ts` (079721 box, 155417 spike, 153622 front ridge, gabled crowns kept).
- Sheets: `sh scripts/building-recipes/street-sheets.sh artifacts/recipe-look/after`; in-game facade close-ups in
  `tests/e2e/recipe-street.spec.ts` (`in-game-<project>-facades-{a,b,c,oblique}.png`).

Remaining gaps vs the procedural neighbours: no sign lettering (surrounds/quoins/awnings: see below); brick
banding is a stripe, not polychrome patterning (079721's diaper work); 153622's hip end still reads as a steep
triangle above the cornice from straight on.

## Stone surrounds, quoins, awnings (2026-10-09)

Intent fields per front: `windowSurround: none|stone-lintel|full-frame|keystone` (+ `surroundStoreys`, default every window
storey above a shopfront; colour = `palette.stone`), `quoins: none|stone` (alternating 0.5/0.28 m blocks up both edges,
skipping any block that would touch an opening), and `shopfront.awning {style: none|fabric-straight|fabric-dutch, colour,
extent {from,to}}` (fractions of the front width from the viewer's left). Fit emits `elevation.dressings`
(`CanalhouseDressing`: `slab` or `awning`); the library builds slabs as boxes sunk 5 mm into the wall (depth <= 12 cm) and
awnings as one extruded side profile (about 20-40 tris, back edge on the wall, <= 1.4 m projection, valance >= 2.0 m
above ground). Awning colour is palette `awning` (falls back to shop/door) and exports on the flat `door` material slot,
so it is not brick-textured. Cost: keystones ~12 tris per window, lintel+sill 24, full-frame 48; a 12-window front adds
~150 tris. Houses using them (evidence = photo): bilder-153622, -153782, -152669 keystones (front.jpg); bilder-156287
stone lintels on the top storey + black straight awning over the left shop (front-alt.jpg). Tests:
`surroundsAwnings.test.ts`. Not used anywhere yet: `quoins`, `full-frame`, `fabric-dutch` (no photo evidence found).

## Street chunks: one mesh per block face (pilot, 2026-10-09)

`src/canalRecall/streetChunks/` compiles a block face (houses that share party walls and front the same way) into
ONE glTF mesh, one primitive per material, from the houses' intent recipes + 3DBAG facts. The installed chunks are the game default;
`?streetChunks=0` draws the individual houses. Demo: `street-chunks.html`; fidelity gates: `scripts/street-chunks/gates.ts [--install]`.

```sh
node --import tsx scripts/street-chunks/build.ts [--prefix=bilder-] [--min=2] [--install]   # -> artifacts/street-chunks/
node --import tsx scripts/street-chunks/compare.ts --chunk=bilder-081118-x7                  # control vs chunk renders + diff
node --import tsx --test src/canalRecall/streetChunks/streetChunks.test.ts
PW_PORT=<port> npx playwright test street-chunks --project=desktop --project=iphone         # needs --install first
```

What a chunk does that the individual houses do not:

- **One frame, one street level.** Heights are re-grounded on the median 3DBAG ground of the face (`ground.ts`):
  per-pand `b3_h_maaiveld` wobbles by up to a metre on a flat street, while absolute (NAP) eaves of true neighbours agree
  to ~0.1 m (156286/156287/155418). Shifts above 1 m are not applied. Neighbouring eaves within 0.25 m (cluster spread
  <= 0.45 m) snap to their median so the cornice is one line; real steps (e.g. 2.5 m between 157650 and 156287) stay.
- **Party walls dropped** (`party.ts`). Shared footprint edges (3DBAG shares vertices: measured distance 0.000) become
  contacts; the neighbour's wall profile on the shared plane is measured from its own triangles and everything it covers
  is removed from the other house, so a lower neighbour leaves the exposed wall above it. A partly covered triangle is cut
  only when the remainder is one triangle, otherwise it stays whole (the covered part is inside the neighbour): trimming
  never adds triangles. Verified by renders: grounded-no-trim vs chunk differ by <= 0.04% of pixels in 4 cameras per chunk.
- **Metadata** in glTF extras: `node.extras.streetChunk = {version, name, frame, pands[]}` with per pand BAG id, address,
  recipe id and sources, frontage extent, bounds, footprint and `ranges[] = {primitive, firstTriangle, triangleCount}`;
  `primitive.extras.pandRanges = [[pandIndex, firstTriangle, triangleCount], ...]` (what `GLTFLoader` hands to
  `geometry.userData`, so a raycast `faceIndex` resolves to its pand via `pandIndexForFace`).

### Loader contract (`chunks.json`, built by `buildChunkManifest`)

`public/canal-drive/ordinary-buildings-data/chunks.json`: `{version: 1, generatedAt, chunks: [{id: "chunk-<name>", modelUrl
(with ?asset=<sha16>), sha256, bytes, triangles, primitives, instance: {anchor, northOffsetDegrees, mirror: false}, bounds,
height, suppress: [BAG pand ids], replaces: ["ordinary-<pand>", ...], footprint: MultiPolygon, pands: [...]}]}`.
`src/canalRecall/landmarks/ordinaryChunks.ts` turns each entry into ONE `SignatureModelSpec` (surveyed placement in the
chunk frame, `suppressOsmIds` = every covered pand, `chunkPands` for hover) and `applyStreetChunks` removes the per-house
specs in `replaces` from the model list. `signature-landmarks-source.js` fetches the manifest (game host only, `options.streetChunks`; skipped with `?streetChunks=0`),
swaps the list, drops already-drawn replaced houses and answers `inspectAtScreen` with the pand under the cursor.
With `?streetChunks=0` or without the manifest nothing changes. Rebuild after merging: `npm run build:canal-signature-landmarks`,
`npm run build:canal-3d`.

### Measured (Bilderdijkstraat, 15 of 19 houses in 4 chunks; 4 houses stand alone, 5-12 m from a neighbour)

| Chunk | Houses | Triangles (individual -> chunk) | Primitives = draw calls | Bytes | gzip |
| --- | --- | --- | --- | --- | --- |
| 081118-155417 | 7 | 14,486 -> 14,370 | 57 -> 23 | 1,002,012 -> 948,948 | 237,995 -> 204,790 |
| 080336-090492 | 4 | 6,721 -> 6,697 | 31 -> 10 | 472,468 -> 452,640 | 106,957 -> 90,789 |
| 079721-152669 | 2 | 4,385 -> 4,517 | 17 -> 12 | 298,680 -> 294,260 | 72,297 -> 67,341 |
| 152363-156732 | 2 | 1,753 -> 1,750 | 15 -> 11 | 126,596 -> 124,932 | 29,919 -> 29,495 |

Party walls are 2 triangles per quad, so dropping them saves only 0.2-0.4% of triangles (3-57 per chunk; ~2,900 m2 of wall
on the 7-house face); the savings are in draw calls (-53%), GLB requests (15 houses = 13 shared meshes -> 4) and ~7% gzip.
`079721`'s +132 triangles are the library's facade-detail pieces changing (80 -> 200) when its eaves move 0.16 m with the
shared ground: re-grounding can flip discrete library decisions. In-game (`tests/e2e/street-chunks.spec.ts`, desktop and
iPhone project, same camera): layer entries 7 -> 1, meshes 57 -> 23, custom-layer render() CPU 0.57 -> 0.42 ms (desktop),
0.53 -> 0.39 ms (iPhone emulation on a Mac), page frame time 16.7 ms in both (vsync); all 7 pands resolve to their own BAG id
under the cursor in chunk mode.

## Block-face authoring (2026-10-10)

The street-chunks pilot stitched houses that had already been authored one by one. Block-face authoring makes the
face itself (one side of a street between two cross streets) the unit the author works on: one intake, one photo
of the whole face, one intent, one compile, one review. Code: `src/canalRecall/blockFace/` (typed, tested) and
`scripts/block-face/` (CLIs); faces live in `scripts/block-face/faces/<face>/`.

```sh
# 1. intake: discovery (3DBAG bbox + routing street), facts per pand, BAG/OSM ground-floor uses, rectified facade strip
node --import tsx scripts/block-face/intake.ts --face=<id> --street=<Street> --seed=<pand> [--from=<pand> --to=<pand>] \
     [--date=YYYY-MM-DD] [--span-date=<pand6>:YYYY-MM-DD,...]           # staging/block-face/<id>/strip-labelled.png
# 2. write scripts/block-face/faces/<id>/intent.json while looking at the strip (schema: blockFace/intent.ts)
# 3. compile: one chunk GLB + gates + interference + GLB audit; --install upserts chunks.json (replaces chunks on the same pands)
node --import tsx scripts/block-face/compile.ts --face=<id> [--install]
# 4. review: ONE strip sheet (photo | ortho model | 50 % overlay | uses, gates, facade-compare | party-line verdicts)
node --import tsx scripts/block-face/review.ts --face=<id> [--glb=<other chunk> --label=<text>]
PW_PORT=4410 npx playwright test tests/e2e/block-face.spec.ts --project=desktop --project=iphone   # in-game street shots
node --import tsx --test src/canalRecall/blockFace/blockFace.test.ts
```

**Intake.** `discover.ts` takes every 3DBAG pand in a growing bbox, keeps those with a frontage on the street whose
sightline crosses no other pand, and walks shared BAG edges (>= 1 m, same facing) from the seed; it records why the face
ends (`discovery.json`: the next fronting pand and its distance). `uses.ts` assigns BAG verblijfsobjecten (address,
gebruiksdoel) and OSM shop/amenity/craft/office nodes (inside, address match, or within 8 m of the frontage; assigned
over the whole face so a node near a party wall goes to the nearer pand). `strip.ts` picks ONE capture day for the face
(most frontages within 35 deg, leaf-off and recency break ties), rectifies each frontage from up to three panoramas of that
day with `facade/rectify.ts` (AMSTERDAM_WORLD_ALIGNED, `lensFor` camera heights), median-fuses them, and lays them out in
the chunk frame at 40 px/m on one ground line (median 3DBAG ground NAP). Spans whose day shows scaffolding or a parked
van take another day with `--span-date` and are labelled with it. Raw responses are cached under `.cache/`.

**Intent** (`blockFace/intent.ts`). Houses left to right, each with the canal-house design (or `sameAs` another pand of
the face plus overrides), a `groundFloor` use reconciled from evidence (`use`, trading `name`, OSM category/id, BAG
gebruiksdoel, `photoDate`, `agreement`: osm-and-photo / photo-only / osm-only / bag-only / conflict) and a `rhythm` spec
with a strip citation, photo counts (`photoRows`, `photoGables`) and `schemaLimits` (what the schema cannot express).
Face level: `streetLevel`, `corniceGroups` (houses whose eaves read as one line on the strip, with evidence;
`trust: "photo"` + `reference` when 3DBAG is wrong) and `identical` designs. The validator rejects shopfronts on
residential ground floors, trading uses without a shopfront, signs that do not match the use name, missing rhythm
items, unknown pands and houses out of street order. Houses use the canal-house `shopfront` schema above (sign
`mount`, `displayWindows`). `scripts/street-chunks/build.ts` leaves out every pand a face covers and keeps the
`chunk-face-*` entries in chunks.json on `--install`, so the two writers agree whichever runs last.

**Compile** (`blockFace/compile.ts`). Front slits between neighbours (LoD2.2 ground rings that stop 4-10 cm apart at the
street) are closed by moving both corners (and the roof corners) to their midpoint; heights are re-grounded on the median
ground; cornice groups set the eaves lines (snapped when 3DBAG spreads <= 0.8 m, or to the reference pand's line when
photo-trusted, else reported); `streetChunks.compileChunk` builds the one GLB (party walls trimmed, exposed walls above
lower neighbours kept, per-pand ranges in extras). Gates per pand on the decoded GLB: triangles <= 3,000 per front,
roof max vs LoD2.2 (+-0.5 m), eaves vs 3DBAG (+-0.5 m, photo-trusted lines against their line), storey heights
2.3-4.6 m, plan IoU >= 0.9 vs BAG, grounded within 5 cm. Interference per party line: front gap/overlap <= 5 cm,
surface inside the neighbour's footprint, street-side details reaching past the shared footprint edge (> 3 cm),
coplanar same-facing overlap (facade > 1 dm2 or roof > 5 dm2 fails), and the eaves step against the cornice groups
(`aligned`, `step-supported`, `step-not-supported`, `missing-step`). The GLB audit runs on the chunk; its hole check
does not know party walls, so loops lying on a shared footprint edge are classified as trimmed party walls (all 10
largest loops on both pilot faces) and only other loops fail.

### Pilot results

| | Bilderdijkstraat 122-134 (redo) | Utrechtsestraat 48-76 (new) |
| --- | --- | --- |
| Pands / fronts | 7 / 7 (face is 24 pands between the cross streets) | 10 / 13 (Concerto's pand has 4 fronts) |
| Intake (compute) | 40 s (strip 36 s) | 68 s (Overpass 38 s), 24 s re-run with span dates |
| Authoring | 1 intent pass ~6 min from strip to valid JSON + 1 correction pass ~5 min (eaves gate) | 1 pass, ~4 min after the strip incl. re-intake |
| LLM passes / reviews | 2 / 1 sheet (per-house: 7 drafts, 7 contact sheets) | 1 / 1 sheet |
| Compile + gates + audit | 2-10 s (machine load) | 1.6 s |
| Triangles / primitives | 15,150 / 23 | 18,977 / 43 |
| Bytes (gzip) | 991,016 (227,715) | 1,293,992 (298,637) |
| Gates, interference | all pass (after pass 2) | all pass |

Found by the strip review / face gates that the per-house process missed on Bilderdijkstraat (sheets:
`staging/block-face/bilder-081118-155417/review/strip-sheet.png` and `strip-sheet-per-house-before.png`, the installed
per-house chunk through the same review): the 1902-03 row (156287, 156286, 155418, 155417) is ground + 3 storeys +
gable/mansard, the per-house recipes had 4 upper storeys; 081118 has 4 window axes, not 3; 155417's roof is dark slate,
not red tile, and its cornice sits ~0.6-0.9 m below its neighbours' (the eaves gate failed pass 1, a zoomed crop
confirmed it); 087959 is the same brick as 081118 on one date (its per-house photo was another day); no awning on
156287 on the strip date; 156287 and 155418 are one design with mirrored ground floors (now `sameAs`); real addresses
and shops (PLTS, Thai Thara, Amsterdam Bike Store, Danswinkel, Dirk van den Broek, an unnamed shop, Only Diva's) instead
of the generic dark shopfront; crown edge trims reached 4 cm into the neighbour (library fix).
Still wrong and visible on the sheets (schema limits, listed per house in `rhythm.schemaLimits`): off-centre gables are
centred (081118, 156286, Utrechtsestraat 76), unequal bays are equal (157650's narrow entrance bay and wide studio
windows; 156286's paired windows), a shopfront spans the whole width even where one bay is a residential entrance
(157650), two-storey shopfronts are one storey (Concerto), white stucco renders beige under the recipe look
(Utrechtsestraat 62, 70-72), 3DBAG hip roofs show above cornices in the orthographic view, lettering on glass is low
contrast, and facade-compare's gable-peak count reads 0 on chunk spans (unreliable there; window rows are reliable).

### Schema additions (2026-10-10, strip-review limits fixed)

All optional; houses that do not use them fit byte-identically (`node --import tsx scripts/building-recipes/fit-golden.ts`
checks every per-house recipe against `fit-golden.json`; re-record with `--write` only for an intended change).
Front: `bayWidths` (relative widths per axis, `axisGrid` entries; windows centre in their bay, 58 % of its width),
`storeyBayWidths` (own weights for one storey, `{"4": [0.34, 0.28, 0.38]}`), `crownAt` (`{from, to}` fractions of the front
from the viewer's left) or `crownBays` (`{from, to}` inclusive axes); gable windows and hoist follow the crown.
Shopfront: `bays` (`[first, last]` axes the shop occupies; `doorBay` is then a residential entrance beside it with its own
wall; the validator rejects overlap) and `storeys: 2` (double-height glass, mezzanine transom + band, fascia at the top,
storey-1 windows in the span dropped). Palette: `wallMaterial: "stucco"` puts the wall in the `stucco` look slot.
Marnixstraat additions (same day): `crownRise` (crown height in upper-storey heights, e.g. 1.1 for the 3.3 m Marnix
gables), `crownSteps` (1..6 per side of a step gable), `crownFinial` (block on the flat top), `atticShape: "round"`
(oculus), `windows: "two-light"` + `windowProportion: "tall"`. A partial shopfront (`shopfront.bays`) keeps the ground
storey at the neighbours' proportions (no 1.32 shop stretch), so window rows keep lining up along the row. The review
sheet now prints a wall-colour check per pand (photo median vs model median on the same wall pixels,
`blockFace/wallColour.ts`); it is advisory (a strip with a strong colour cast, like Bilderdijkstraat's golden-hour strip,
over-reports) and found Marnixstraat's brick intent 0.18 too saturated (#6e4638 rendered orange; measured wall #6a5a50).
`block-face:compile` prints an instancing plan (`blockFace/instancing.ts`): which houses are the same design and size
(Marnix: 6 of 8 and 8 of 9) and how many triangles an instanced chunk would save (61 % / 76 %); the chunk GLB itself is
not instanced because that changes the loader contract (instance -> pand table for picking/suppression).

Why white stucco read beige: it shared the `brick` slot, whose tint clamps lightness to 0.30-0.60 and floors saturation
at 0.12 on a mid-grey brick texture; the `stucco` slot keeps authored hue/saturation on a plain plaster texture.

### Marnixstraat: per-house vs block face (2026-10-10)

Same houses, same strip photo (2023-01-30), Marnixstraat even side. The face `marnix-124-138` is 8 pands (124-138, 3DBAG
ids 174914 168510 173514 173515 174104 174105 174935 173530); the earlier per-house batch (`marnixstraat-row-1..5`) covered only
the first five. All eight fronts are ONE design: 4 storeys, 3 window axes, central door, flat cornice, narrow stepped (trap)
gable with one attic window, pilaster strips at the party walls. Wall-clock is tool time from timestamps; the thinking time of
the authoring agent is inside it (one look at the strip plus two zoomed crops).

| Phase | Per-house (5 existing recipes + 3 not done) | Block face `marnix-124-138` (8) | Block face `marnix-c` 106-122 (9) |
| --- | --- | --- | --- |
| Intake / facts | 7 s facts (5 houses, earlier batch); 8 pands = ~11 s | 68 s (discover 17, uses 8, strip 43) | 65 s (Overpass failed once; 90 s wait, re-run) |
| Authoring | 1 drafted intent + 4 sameAs, within 26 s incl. compile | 1 intent (design + 7 sameAs) ~24 s | ~0 s: script derived from the first face, one look at the strip, one quirk (round oculus on 114) |
| Compile + gates + audit | included above | 1.2 s | 1.5 s |
| Review (one sheet) | 54 s to build the baseline chunk + ortho sheet (not part of the 39 s batch) | 6 s | 4 s |
| Repair round | n/a (errors listed, not repairable in schema) | 1 round, 13 s (cornice `simple`, darker brick, photoRows with the door fanlight) | 1 diagnostic round, 11 s, did not clear the failing party line |
| Total to a reviewed model | ~39 s + 54 s review = 93 s for 5 houses = 19 s/house (8 houses ~ 2.5 min) | 140 s = 17 s/house | ~110 s = 12 s/house |
| Accepted houses | 0 of 5 (see errors) | 0 of 8 (gates pass, strip review fails on the gable, see errors) | 0 of 9 (same, plus one z-fight at a party line) |

Honest verdict: on raw minutes per reviewed house the two paths tie (the per-house batch is about 8 s/house of drafting;
adding the review it does not otherwise have, 12-19 s/house vs 12-17 s/house for the face). Neither path reaches an ACCEPTED
house on this street because the dominant visible error is a schema limit that both share (stepped gable). The face removes
errors the per-house path could not see: 3 of 8 houses never drafted, a 0.3-0.5 m eaves step on 173515 (parent 4's eaves differ), one
street level, and the party-line gates. Time-to-accepted is therefore undefined for both until the crown/pilaster/off-centre
features land; the face is the cheaper place to apply them because one change fixes 8-9 houses.

Errors visible on the strip sheet (`staging/block-face/marnix-124-138/review/strip-sheet.png`, baseline
`per-house-before-sheet.png`, same folder):

| Error | Per-house (5 houses) | Block face (8) |
| --- | --- | --- |
| Stepped trap gable, ~3.2 m tall and 3.3 m wide with a finial, replaced by a 0.9 m wide pediment cap (schema) | all 5 | all 8 |
| Attic window in the gable missing (cap rise < 1.2 m) | all 5 | all 8 (facade-compare FAIL, photo 2,1,3,3,3,1 vs model 2,1,3,3,3) |
| Gable peak not on the silhouette (facade-compare "1 vs 0") | all 5 | all 8 |
| Pilaster strips between houses, drainpipes, brick frieze, door surround with side lights not modelled | all | all |
| Windows near-square 4-pane vs tall 2-light sashes (1.7 x 2.3 m; centre axis narrower) | all | all |
| Brick reads orange-red (recipe texture multiply) vs brown on the strip | all | all (darker swatch helps only a little) |
| Houses missing entirely (126, 128, 124) | 3 | 0 |
| Eaves step against neighbours (173515, 0.3-0.5 m) | visible | gone (cornice group snapped, spread 0.04 m) |
| NiDA laundry shopfront in the right bay of 124 | not modelled | not modelled (shopfront spans the whole width; listed as a limit) |
| 3DBAG roof slab above the cornice in ortho | visible | visible (ortho artefact: the street view hides it) |
| Z-fight on a party line | n/a | none on 124-138; 169033|174107 0.07-0.08 m2 on 106-122 (limit 0.01 m2), cause not found, not the storey bands |

| Metric | Per-house, 5 houses | Block face, 8 houses | Block face `marnix-c`, 9 houses |
| --- | --- | --- | --- |
| Triangles | 5,288 (1,058/house) | 10,935 (1,367/house) | 12,451 (1,383/house) |
| Bytes (gzip) | 350,260 as a chunk (368,684 as 5 GLBs) | 730,272 (157,413) | 830,228 (182,720) |
| Draw calls (primitives) | 31 as 5 houses; 7 as a chunk | 8 | 6 |
| Mesh sharing | 4 of 5 houses share one mesh (2 meshes) | none: one GLB, geometry repeated per house (an instanced chunk would be 1 house mesh + joins) | none |
| Party-wall triangles saved | 18 | 32 | 47 |

The face spends about 30 percent more triangles per house than the per-house recipes (bracketed/lintel detail from the face
design, ground re-grounding) and gives up the shared-mesh win: eight identical houses are eight copies in one GLB. For a repeated
row, per-house instancing wins on bytes (2 meshes for 5 houses); the face wins on draw calls and on gates. The cheap hybrid is
a face that instances identical `sameAs` houses, which compile.ts does not do yet.

Faces not authored: `marnix-b` (140-142 + 138K, mixed pub/hairdresser/copy shop/offices: the first intake produced a grey strip,
only 4 pands, not repetitive), the 169393 block (a single pand, not a face). Install: neither authored face is installed in
chunks.json, because the stepped gable and attic window are visibly wrong, and `marnix-c` fails one interference gate. The
`marnixstraat-row-1..5` recipes were never installed (no catalogue entry, no chunk), so there is nothing to replace today; if
`marnix-124-138` is installed later, `scripts/street-chunks/build.ts` already skips pands covered by a face
(`chunk-face-marnix-124-138`), and the five per-house recipes should be kept only as `sameAs` sources or removed.

### Recommendation

Make the block face the default authoring unit for ordinary attached buildings. The author sees what decides
correctness: storey lines and cornices running across party walls (four wrong storey counts were invisible house by
house and obvious across the strip), one capture date, twins and mirrored pairs, and every interference the
gates measure lives exactly where two houses meet. Party walls never need modelling, the intake is a minute, and one
pass (plus one correction triggered by a gate) replaced seven drafts and seven reviews. Per-house stays for:
landmarks and anything with its own elevations file and camera-matched review (`review-sheet.ts`); detached or
corner-standing buildings with several street sides (the face covers one street; a corner's second front is
`inferred` on the face sheet); large buildings on the large tier; and faces where the strip is unusable (narrow
streets with obliquity > 45 deg, all dates scaffolded). Next: per-bay widths and off-centre gables in the schema
(the biggest remaining mismatch class), residential bays inside a shopfront, a stucco material that the recipe look
leaves white, and a full-face run (Bilderdijkstraat's 24 pands between the cross streets).

### Historic canal houses: De Wallen library (2026-10-10, `wallen-oza-41-57`)

All optional and byte-identical when absent (fit-golden all identical; every other face's GLB unchanged). Tests:
`buildingRecipe/historicCanalHouse.test.ts`, `blockFace/historicFace.test.ts` (named regression OZA 41-57).
Front fields:
- `gableOrnament` (`buildingRecipe/gableOrnament.ts`): `wings` `volutes|scrolls` (stone bands under the neck/bell shoulders,
  volute or scroll at the foot), `ears` (volutes at the cap base), `cartouche` (oval on the cap), `finial`
  `crab|vase|ball`, `gablet` `crest|pediment` (rooftop piece on a cornice/flat front). Placed from the fitted crown
  profile (`crownLandmarks`), so they follow `crownRise`/`crownAt`.
- `leanDegrees` 0..3 (voorover): shear along the interpolated party directions, ground fixed, fades out 4 m behind the
  front, max shift 0.6 m, so party lines stay closed. Not measurable from a rectified strip; OZA 41-57 does not use it.
- `groundFront` `{kind: arcade|pui|wall, bays: [door|glazed-door|window|shutter|panel], colour?, shutterColour?}`:
  stone/timber piers + beam + risers as blocks (`shop` slot), each bay its own opening (no shop glass, no storey-0 grid).
  Not with `shopfront`; basement must be `none`.
- `roofFront: "mansard"` (cornice/flat): 72-degree slate wedge behind the cornice, its ends on the party planes;
  `dormerStyle` `plain|pediment|pointed` (pediment = projecting trim gable; on a mansard the dormer stands on its face).
- `crownGroups` (2-4 `{from, to}` axis ranges: several gables on one front), `tower` `{bays, rise, cap: pyramid|flat}`.
- `partyClip`: cornice/ornament/detail vertices near the front corners are clamped to the oblique party plane (OZA had
  3-11 cm overhang into neighbours at ~17 degrees). Block faces set it for all fronts with `continuity.partyClip`.
- `palette.cornice`: cornice paint apart from window frames (cream cornice over dark frames is the Wallen norm).
Fit: a front `share` with no footprint vertex within 1.5 m of the cut inserts one (several houses in one straight BAG
pand: Bilderdijk 162443, 236022, 236189); side-by-side gable lights that escape the crown shrink (x0.92 steps) or fall
back to one centred light instead of throwing "Opening escapes its wall".
Block face: `continuity.measuredEaves` (`{pand, front?, stripRow, evidence}`; scaled by `strip.json`) for cornice fronts
that hide a gabled roof (3DBAG's eaves percentile read 45/49/57 1.6-1.9 m low). The footprint gate passes as a source
limit when 3DBAG LoD2.2 is >=10 % short of BAG and the model matches the survey (IoU >= 0.9): 177915's 0.76 IoU is a
12.5 m2 rear wedge missing from 3DBAG itself (b3_opp_grond 40.28 vs BAG 52.77; no neighbour covers it). The CLI's audit
classifies hole loops past the end of a shared edge by their open edges (`blockFace/partyLoops.ts`): all on a party plane
= trimming artefact.
Result: 8 pands, 17,303 tris, 1.13 MB (281 KB gzip); gates, interference (0 overhang) and audit (party exemption) pass.

### House types for street surveys (Stage 1, 2026-10-10, `nassau-162289`, `clercq-236681`)

Design: `docs/research/sol-canalhouse-salvage-20261010.md` §4. Code: `src/canalRecall/blockFace/houseType.ts` (+ test).
A face may carry `types: HouseTypeIntent[]` (body written once; named `crowns` (may also set `cornice`), `grounds`,
`palettes`; type rhythm spec and strip evidence). A house then says `type: {type, crown, ground | {shopfront} |
{groundFront}, palette, mirror, storeys, doorBay, visualSpan, modules: [...], pair: left|right, overrides}` instead of
`design`/`sameAs`, and gives only the rhythm fields that differ (its citation). `houseIntents()` resolves placements to
ordinary designs before fit, so fit/compile/gates/interference/audit/review are unchanged; absent types, all 16 earlier
faces recompile byte-identically and fit-golden is identical. Mirroring flips door bay, bay widths, storey axes, crown
spans/bays/groups, tower, balconies, bay windows, dormer spans and grid span; per-house shops are written as seen and
never mirrored. `pair` halves must be adjacent, use the same type and crown, and exactly one is mirrored; a crown marked
`pair` is authored for the left half. `overrides` are reported as type deviations in the house notes.
New optional front fields (byte-identical when absent): `gridAt` (window grid on a visual module, from `visualSpan`:
Nassaukade 304-301 pilasters stand 0.5-0.7 m off the BAG party walls), `dormerAt` (dormer spans; half dormers meet at a
party wall), `souterrain` (the basement is a full storey under a bel-etage; Nassaukade souterrains are ~3 m, the default
plinth is 0.7-1.2 m). A measured cornice under a mansard lowers the shell top (3DBAG draws De Clercqstraat's mansards as
wall). Interference now measures front gaps/overhangs against each house's own front plane (Nassaukade bends: the middle
houses stand > 1 m behind the chord) and ignores walls lying on a neighbour's footprint edge (corner pand wrapping behind).

| | Nassaukade 318-300 | De Clercqstraat 22-2 |
| --- | --- | --- |
| Pands / modules | 20 / 20 | 9 / 12 (16-18 = 3 modules, 8-10 = 2) |
| Types (placements) | 4: B pair x4, C x3, A x6, D x4 | 3: E x7 modules in 4 pands, F x3, corner x1 |
| Own designs | 3 (314, 304A, corner 300) | 1 (153066 corner block) |
| Crown variants | 5 (pair dormer, dormer, step gable, spire dormer, Neo-Renaissance bell gable) | 6 (none, tower, arched tower, step gable, 3-dormer mansard, 2-dormer mansard) |
| Triangles / primitives | 43,873 / 20 (2,250 KB, 614 KB gzip) | 24,524 / 26 (1,252 KB, 328 KB gzip) |
| Gates, interference, audit | pass, installed | pass, installed |

Remaining errors (on the strip sheets, listed as `schemaLimits` in the types): the pair dormer is two plain half
dormers with a gap at the party wall (a dormer reaching the party wall fails the library's footprint check), white
stucco top storeys and tympana are not modelled, the tower-dormers have no light, De Clercqstraat corbel tables are a
bracketed cornice, D dormers are centred on the BAG front rather than the visual module.

## Recipe tiles (migration step 3, `?recipeTiles=1`, 2026-10-13)

Plan: `docs/plans/digital-twin-direction-20261013.md` §2; handoff `docs/handoffs/lane-recipe-tiles-20261013.md`.
Code: `src/canalRecall/tileBuildings/` (schema, tile math, soups, writer, runtime), compiler
`scripts/building-tiles/compile-recipes.ts`, staging `artifacts/recipe-tiles/`.

### Data model (`tileBuildings/schema.ts`)

`building-recipes/14/x/y.json`, generated, never hand-edited:

```json
{"version": 1, "z": 14, "x": 8413, "y": 5384, "sources": {"faces": "<sha>", "types": "<sha>", "catalogue": "<sha>"},
 "pands": {"0363100012081118": {"kind": "canal-house", "intent": "face:bilder-081118-155417/0",
   "fitted": {"eavesM": 14.2, "storeyHeightsM": [4.1, 3.4, 3.3, 3.4], "frontWidthM": 6.1, "roofMaxM": 17.1, "triangles": 2481},
   "mid": [2, 5, 3, 33, 0, 1909, 1, 4, 1, 7, 1], "covers": ["NL.IMBAG.Pand.0363100012081118"], "mesh": [33654, 21538]}}}
```

Decisions (each one changes the schema, so the reason is kept here):

- **`intent` is a one-string reference** (`face:<faceId>/<house>`, `house:<recipeId>`, `type:<unit>`, `kit:<id>`,
  `model:<specId>`), not a copy of the intent. Faces, house recipes, types and the landmark catalogue stay the
  authoring units; copying them into tiles would make the tile a second place to edit. The validator ties each
  scheme to the kinds it may carry (`face:` only `canal-house`, `model:` only `glb`, ...).
- **`sameAs` + `overrides` mirror the block-face house fields** (`blockFace/intent.ts`), one hop only, same kind. A
  face house written `sameAs` in its face intent is `sameAs` in the tile; it does not get a second `intent`.
- **`mid` is the facts sidecar's seven integers plus four the recipe knows** (bays, wall slot, gable, shop):
  `[archetype, storeys, roof, eavesDm, ridgeDm, year, terraced, bays, wall, gable, shop]`, ~35 bytes. Reusing the
  sidecar order (`bagTiles.ts MidDescriptor`) means the mid tier (step 4) reads one shape for every pand, recipe or
  not; the recipe-only fields are 0 = unknown, so a generic pand's descriptor is the sidecar row padded with zeros.
- **`fitted` is compiler output** (eaves, storey heights, front width, roof max, triangles; placement for placed
  kinds). It is written by the mesh stage into its per-tile report and folded into the recipe tile by the
  `assemble` stage, because one process per z16 tile cannot safely write a shared z14 file. `--strict` validation
  requires it.
- **Keys are 16-digit pand ids**; a model standing on no pand (a monument on a square) is `m:<specId>`. A model
  covering several pands is one entry under its primary pand and lists the others in `covers` (no stub entries for
  the others: the inverse "who covers pand X" is computed on load).
- **`covers` replaces `suppressOsmIds`**: full `NL.IMBAG.Pand.*` ids plus OSM-only ids, taken from
  `public/canal-drive/models/covers.json` for installed models and from the pand itself for recipes and types.
- **`mesh` names the z16 tile that draws the pand** (by the pand's anchor), so a reader of a z14 tile knows which
  mesh tile to fetch without recomputing anchors.

### Compiler (`scripts/building-tiles/compile-recipes.ts`)

```sh
node --import tsx scripts/building-tiles/compile-recipes.ts --stage=all --jobs=8      # recipes → mesh (one process per z16) → assemble
node --import tsx scripts/building-tiles/compile-recipes.ts --stage=mesh --tile=16/33654/21538
node --import tsx scripts/building-tiles/compile-recipes.ts --stage=review --before=artifacts/recipe-tiles-before
node --import tsx --test src/canalRecall/tileBuildings/*.test.ts
```

Stages: `recipes` (authoring → z14 recipe tiles), `mesh` (one z16 tile per process: compile, split, hash, write,
gate), `assemble` (folds `fitted` into the recipe tiles, writes `index.json` and `summary.json`), `review` (a sheet
of only the pands whose triangle hash or gate numbers changed between two outputs, with before/after elevations).
Faces go through `blockFace/compile.ts` → `compileChunk.ts` unchanged (13 of 15 Bilderdijkstraat chunks come out
byte-identical to the installed `chunk-*.glb`; `bilder-079721-x2` and `bilder-159426-165632` differ from their
installed copies, i.e. the installed files predate a library change: exactly what the review stage is for). House
recipes no face covers are grouped with `groupBlockFaces` and compiled with `compileChunk`, as
`scripts/street-chunks/build.ts` does; large recipes through `compileBuilding`; types and installed GLBs go straight
to the unit table. Faces with `continuity.crownFromPhoto` need their strip photos (`staging/block-face/<face>/strip.jpg`
or `BLOCK_FACE_SOURCE_PACK`, default the `map-recall2-source-data` archive).

Decisions:

- **Groups are atomic.** Every pand of a face, a house-recipe chunk or a multi-pand model is drawn by the z16 tile
  containing the group's mean anchor. A face never straddles two mesh tiles, so while that tile is resident the
  near tier replaces the whole chunk/landmark spec, and when it is not the legacy spec draws the whole thing.
  The alternative (each pand in its own tile) leaves half a face double-drawn at a tile boundary.
- **Roles by rule, in the source frame** (`soup.ts splitRoles`, +x along the street, +z towards it): signage
  (`sign` surface), roof (roof slots), party (wall faces along the street within 0.3 m of the pand's ends), rear
  (> 1.5 m behind the front plane), then ground / body / crown by the fitted ground-storey top and eaves. Only
  ground, body, crown (and `whole` for large recipes) may instance; the classification only decides reuse,
  never correctness, because every part is reassembled exactly.
- **Hash = canonical geometry** (positions relative to the part's x/z minimum at 1 mm, normals at 1e-3, sorted by
  colour+slot). UVs are excluded: metre box UVs follow absolute position, so an instance keeps its master's brick
  phase. Units of installed GLBs are addressed by sha256(converter version + file bytes).
- **Instancing is tile-local and thresholded:** a hash instances when it repeats inside the z16 tile and saves
  ≥ 1,000 triangles (`--min-saved`). Tile-local keeps one process per tile deterministic; the threshold keeps
  tiny repeated parts from costing a draw each. Units are still global content-addressed files, refcounted across
  tiles at runtime.
- **Tile positions stay float32**; a 16-bit grid over a 373 m tile is 6 mm, coarser than the library's 5 mm
  insets. Units (≤ ~100 m) quantize positions to 16 bits and normals to 8. gltf-transform's `meshopt()` is not
  used because it re-quantizes positions to 14 bits and folds that into instance TRS; the writer reorders and
  enables `EXT_meshopt_compression` itself.
- **Instance nodes carry a stub** (the unit's 12-triangle box): `EXT_mesh_gpu_instancing` needs a mesh; it is added
  after quantization so instance TRS are the true unit → tile matrices. `_PAND` is float32 (a 2-byte stride breaks
  the meshopt vertex codec).
- **One city-look primitive per tile for uniques**: slot and tint are vertex attributes (`_LAYER` u8, `_TINT`
  u8x4), so every material of every unique pand is one draw. Vertices are welded per pand only, so a pand can be
  hidden or highlighted through its own vertices.
- **Gates per pand**: the face gates and interference (faces), `evaluateGates` on the house compiled alone (house
  recipes), `evaluateLargeGates` (large), geometry-audit counts (recipe pands; recorded, not gating), unit conversion
  counts (models), and **instanced ≡ merged**: the written tile and units are decoded exactly as the runtime draws
  them and every source triangle must find its decoded twin within 4 mm with the same slot ordinal, one to one.

Measured (2026-10-13, M-series Mac, `--jobs=8`): 3,149 pands (61 canal-house, 6 large, 3,072 types, 10 models)
in 17 z14 recipe tiles and 64 z16 mesh tiles, 10 s wall clock for everything; 4.4 MB tiles + 2.8 MB units
(1.43 M triangles drawn, 137 k of them merged uniques), 166 draws for all 64 tiles; every pand passes every gate.
The two Bilderdijkstraat tiles (61 canal houses, 1 landmark) take 3–5 s each, mostly the face compile.
**Instancing found nothing to share on Bilderdijkstraat**: 189 street-side parts, 0 exact repeats. The fitted
widths of neighbouring houses differ by centimetres, so no two bodies are identical at 1 mm. Reuse there needs
type-level authoring (the face `types` / `sameAs` with one fitted width) or a tolerance-snapping fit, not a
hash; the machinery is in place and tested (`compiler.test.ts` instances two equal bodies).

### Runtime (`tileBuildings/runtime.ts`, `?recipeTiles=1`)

`TileBuildings` is one participant (`recipe-tiles`, order 21, after the landmarks) in the shared frame.

- **`?recipeTiles=1` implies `?sharedFrame=1`**, as `?ownGround=1` does: the near tier is a frame participant, not a
  fourth custom layer with its own renderer. It draws lit (Lambert under the frame's rig) with the city look's
  slot material (`look/cityLook.ts getCityLook`), whatever `?cityLook` says: the tiles carry slot attributes only.
- **Residency**: the 2×2 block of z16 tiles nearest the camera centre, held by a quarter-tile hysteresis, checked
  at most 4×/s from the frame's `beforeRender`. Tiles that leave the block are dropped only once every wanted
  tile is drawn, so moving never opens a hole.
- **A tile counts once its units are in.** Only then are its pands' `covers` hidden in the mid/far layers
  (`ThreeBuildings.setHidden('recipe-tiles', ids)` → the facade shaders' `hidden = 1`; pyramidal roofs by the
  same reason) and its `specs` withheld from the landmark loader (its `canShowModel`, asked per frame, is wrapped
  once). Until then the stub boxes draw and the legacy specs stay. When a tile leaves, both are given back. No
  suppression list is involved.
- **Units are refcounted** across tiles (`RefCache`): one decode per unit, InstancedMeshes share its geometry and
  material, freed when the last tile releases it.
- **Picking**: `inspectAtScreen` raycasts the root with the frame's `clipFromWorld`; merged meshes resolve the face
  through `pandRanges`, instances through `_PAND`. `vectorMap.inspectBuilding` takes the nearest of landmark,
  facade and recipe-tile hits.
- **Highlight** (the quiz answer, `setHighlighted` next to the facade layer's): merged pands set `hidden = 2` on their
  own vertices (the city-look shader's highlight); an instanced pand is collapsed and drawn once more with the
  highlight variant. An answer pand is never left hidden in both tiers.
- Integrator: bundle `src/canalRecall/tileBuildings/browser.ts` to `public/canal-drive/js/tile-buildings.bundle.js`
  (IIFE, global `CanalRecallTileBuildings`; THREE comes from `CanalRecallThree`), publish `artifacts/recipe-tiles/`
  `{index.json, building-mesh/, units/}` to `public/canal-drive/recipe-tiles/` after review. Without the bundle or
  the data the flag logs one warning and nothing changes.

### Pilots and measurements (desktop 1280×800, Chrome, 2026-10-13)

Staging: 3,149 pands (61 canal-house faces/houses on Bilderdijkstraat, 6 large recipes, 3,072 Nieuw-West type
instances, 10 landmarks as `kind: glb`) in 17 z14 recipe tiles (1.7 MB JSON) and 64 z16 mesh tiles (4.49 MB) plus
units (4.72 MB; landmark units keep float positions where box-projected, see below). 0 failed pands; 13/15
Bilderdijkstraat chunks byte-identical to the installed ones. Golden: `golden.test.ts` recompiles four tiles
(211 pands, every kind) and compares per-pand triangle hashes with `pilot-golden.json`.

Static spots (`tests/e2e/recipe-tiles.spec.ts`, look-consistency camera, 6 s of forced repaints, means). Off is
`?sharedFrame=1&cityLook=1`, on adds `&recipeTiles=1`, types is `&buildingTypes=1`. "ms" is the CPU time of the
shared frame's main pass; frames are vsync-bound (16.67 ms) in every mode.

| spot | main pass ms off / on / types | draw calls off / on / types | triangles k off / on | recipe-tile meshes | px differ off→on |
|---|---|---|---|---|---|
| bilderdijk | 0.74 / 0.69 / 0.68 | 301 / 144 / 277 | 2057 / 2127 | 4 | 2.5% |
| bilderdijk-north | 0.97 / 0.89 / 1.48 | 425 / 226 / 428 | 3626 / 3436 | 5 | 3.4% |
| nieuw-west | 0.50 / 0.54 / 0.74 | 66 / 63 / 98 | 2344 / 2423 | 3 | 44.9% (types replace the BAG blocks; 31.8% vs types) |
| slotermeer | 0.47 / 0.54 / 0.68 | 53 / 64 / 87 | 2338 / 2415 | 23 | 16.2% |
| dam | 2.63 / 2.73 / 2.77 | 403 / 385 / 404 | 2564 / 2560 | 4 | 25.3% (shading of the Palace) |
| westerkerk | 0.96 / 1.07 / 1.06 | 218 / 198 / 219 | 2572 / 2569 | 3 | 6.6% |
| rijksmuseum | 3.27 / 3.94 / 3.55 | 932 / 925 / 924 | 5100 / 4886 | 1 | 16.4% (UV'd brick; shadow edges) |
| politie-leijenbergh | 0.68 / 0.75 / 0.81 | 35 / 25 / 35 | 2907 / 2907 | 1 | 0.7% |
| leidsestraat-67 | 2.28 / 2.94 / 2.46 | 199 / 182 / 191 | 2754 / 2226 | 2 | 2.7% |

Ride (`scripts/ride-perf-fixed-route.mjs`, Anne Frank Huis → Rijksmuseum, `RECIPE_TILES_DIR=artifacts/recipe-tiles`):
desktop 20 s, off / on / off again: map render mean 2.61 / 2.35 / 2.72 ms (p95 3.6 / 3.1 / 4.0), three layers per
frame 1.07 / 0.99 / 1.10 ms, draw calls mean 439 / 430 / 439, heap 639 / 601 / 658 MB. iPhone 13 at 4× throttle,
12 s, off / on: map render 7.11 / 6.73 ms, three layers 3.08 / 2.92 ms, draw calls 320 / 311.

Findings that shaped the code:
- gltf-transform `prune()` drops `TEXCOORD_0` when no texture reads it; the city-look shader does. Units are pruned
  with `keepAttributes: true`, and the converter refuses a `uv` material without UVs.
- Box-projected primitives derive UVs from `position` in the shader; quantized positions would move the scale
  into the instance matrix and lay the brick out in normalised units, so units with a `box` material keep float
  positions (+0.7 MB over the pilots).
- The draw-call win is where the legacy loaders draw many small meshes (Bilderdijkstraat block faces: 301 → 144);
  landmark-heavy spots are dominated by landmarks outside the pilot list, so they barely move.
