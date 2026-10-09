# Reusable Blender building library

Version 0.2.0 integrates true apertures, recessed storefronts, roof families,
optional facade dressings, material zones and street furniture through one
recipe composer. It accepts external IR and resumable batch manifests. Real
buildings remain evidence candidates; synthetic studies are explicitly labelled.
It does not enable models in the live game. Previous prototype assets are preserved.

Open `/canal-drive/building-library.html` on the local development server.
The current delivery plan is in `docs/plans/building-components-delivery.md`.
The executable IR and Sol evidence handoff are documented in `BUILDING_IR.md`.
The review includes facade, oblique, roof, street level, slow orbit, lighting,
downloads, material swatches, and dated evidence with per-region/year coverage.

## Run

From the repository root:

```sh
# Read reconstruction worktree caches; write bundles/crops only in this checkout.
npx tsx scripts/blender/prepare-building-evidence.ts

# No Blender required: schema, geometry and provenance contracts.
python3 scripts/blender/build-buildings.py --all --validate-only
python3 scripts/blender/test-building-library.py

# Build one. Blender command arguments follow its `--` separator.
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/build-buildings.py -- --building elandsgracht-96

# Build all eight, gallery, and four inspection views per building.
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/build-buildings.py -- --all --gallery --render

node scripts/blender/check-building-library.mjs
node scripts/blender/capture-building-library.mjs
```

`--building` is repeatable. `--output-root` and `--artifact-root` select dedicated
output destinations. Rendering is optional; a storefront edit need not render
or rebuild the other buildings. Material maps live in
`.cache/blender-building-materials/`, keyed by catalog parameters and version.

External version-1 recipes can be passed with repeatable `--ir FILE` or a
`--manifest FILE` containing `{"schemaVersion":1,"recipes":["relative/recipe.json"]}`.
`--resume` verifies input fingerprints and existing output content before skipping
work. Each building is validated and staged independently; failures are recorded in
`batch-report.json` while unrelated inputs continue. Run
`python3 scripts/blender/test-building-batch.py` for input and resume regressions.

Recipes are under `building_lib/recipes/`. Edit those files to author buildings.
`migrate-jordaan-recipes.py` was a one-time historical conversion and refuses to
overwrite existing recipes. Normal builds preserve recipe overrides.

## Contracts

Metres; Blender +X along primary frontage, +Y inward, +Z up. glTF +X along facade,
+Y up, +Z towards street. The placement record includes the geographic anchor,
bearing, input-frame determinant and geometry revision. Synthetic corner recipes
use two independent facade frames; the export preserves their world transforms.

`schema`, `frames`, `layout`, `polygons` and portable material-map generation
import without Blender. `archetypes`, `geometry`, `walls`, `openings`, `roofs`,
`signage`, `details`, `export` and `review` mutate scenes only when called.

Storeys explicitly distinguish `ground` and `upper_1`; they have bottom/top datums.
`solve_storeys` accepts equal spacing or specified unequal heights. A frontage
contains its storefront and openings. A shared surface stack preserves the
prototype corrections: shell front −0.035 m; ground finish front −0.065 m and
back −0.030 m; projecting trim uses the compatibility street plane; glazing is
now recessed (default +0.10 m); sign and text sit further toward the street.

Concave footprints are triangulated without changing their outline. Courtyard
holes and invalid/self-intersecting rings fail validation. Roof structure and
gable silhouette are separate recipe fields. The front roof starts behind the
facade and trims under the profile. This is still an initial single-volume roof
compiler; exact multi-volume rear massing remains an acceptance requirement.

## Source evidence and height

The importer binds owner **and physical frontage**, reconstructing its RD plane
from the selected frontage and recorded source coordinate frame. It rejects
reversed/different-facade crop bindings. Nearby cached **whole panoramas** may be
reprojected onto that same plane; adjacent-owner crops are never transferred.
Camera-facing, distance, angle and native-resolution tests select candidates
across years. Crops from the same panorama/date count as one capture. Pixel
occlusion and independent metric anchor registration remain separate review work.

The Bar Theo preferred observation was its Akoleienstraat side facade. Those
original crops are retained as rejected primary/secondary evidence, and new
frontal cached captures now cover the correct Rozengracht facade. All five have
multiple cached capture years after this audit. No precise feature fusion is
claimed while registration remains ambiguous.

Key Color's clearer 2025 full rectification supports two bays in three upper rows
and a straight cornice. It corrects the tree-hidden prototype interpretation.
The raw 3DBAG selected-front wall anchors approximately 15.18–15.20 m of body
height. The 17.23 m reported field is roof70p minus ground, and the larger 19.48 m
surface extent spans other owner volumes; neither is imposed as street-wall height.
See `artifacts/jordaan-pois/height-audit.json` and
`alternate-year-visual-review.json`. PDOK 2024/2025 height rows share AHN5/2023
lineage and are not independent height observations.

Each real `.blend` includes a hidden `SOURCE / 3DBAG shell` collection with exact
semantic source surfaces in the same ground-relative frame. Toggle it to inspect
massing deltas. Source overlays are excluded from GLBs, including batch builds.
The generated side/rear shell currently uses a single eaves extrusion over the
exact footprint; this simplification is explicit in every real recipe.

## Materials and limitations

The default `simple` style uses matte colours and opaque blue-grey glazing,
matching the sample block. Set `style: "textured"` for physical-repeat maps.
The catalog reuses wall preset IDs and catalogues existing attributed image
sources. The textured style generates original portable colour, roughness and tangent
normal maps with physical repeat sizes, bounded masonry variation, separate
mortar colours and explicit sRGB/data colour spaces. It does not relabel the
MapLibre sprites as PBR textures. Glass has an opaque mobile fallback.

Openings cut through the wall, finish and plinth. Recessed angled storefronts,
six roof families and explicit architectural components are integrated. Complex
multi-volume rear roofs, courtyard holes, elaborate curved stone carving,
additional material bonds/wear, LOD/runtime integration and wider real-building
validation remain limitations. Numeric export checks and orbit review do not
establish photographic resemblance.

## Shared aperture and recess stage

The common composer uses the same shared primitives for every recipe:

```python
wall = walls.facade_with_apertures(width, gable_profile, brick, openings)
finish = walls.finish_with_apertures(width, ground_height, render, openings)
walls.cut_apertures(plinth, [o for o in openings if o['storey'] == 'ground'])
for spec in openings:
    openings_module.recessed_opening(spec, frame, opaque_glass, brass,
                                     glass_depth=0.12)
```

Call these while geometry is in frontage-local space, before assigning the
frontage parent. Shell, finish and plinth must all share the aperture profiles.
`facade_with_apertures` rejects outlines crossing the facade/gable silhouette.
It uses exact booleans on closed wall solids and generates real reveal surfaces.
Projecting trim remains at the compatibility plane; glazing lies inside the wall.

`ground_floors.storefront_plan` and `recessed_storefront` create an angled
three-facet display with a shared anchor, threshold floor and closed soffit.
`entrance_steps` uses an explicit threshold rise rather than deriving it from
pavement pixels. These components are selected through recipe storefront fields;
dimensions still require evidence-specific visual review.

```sh
python3 scripts/blender/test-building-apertures.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/test-building-apertures.py
```

The Python run tests head shapes and assembly datums. The Blender run additionally
checks wall and finish rays pass through apertures, the remaining wall stays
solid, every promised solid is manifold, removed volume matches profile area,
glazing vertices are recessed, and actual sill tops meet their threshold.

## Roof and gable sample block

`build-gable-block.py` composes eight deliberately synthetic buildings as one
editable block: stepped, bell, neck and triangular gables; a straight-cornice
terrace; a mansard with dormers; a hip-roof residence; and a gambrel warehouse.
It uses shared aperture joinery, continuous mitered coping, roof thickness,
gutters, ridge caps and roof-attached chimneys. Parameters are in `SAMPLES`;
reusable silhouettes and details are in `building_lib/gables.py` and
`building_lib/roof_details.py`. Dimensions here are design examples, not BAG
measurements or accepted POI reconstructions.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/blender/build-gable-block.py
node scripts/blender/capture-building-library.mjs --gable-block
```

View `/canal-drive/gable-block.html`. Outputs: `public/canal-drive/models/gable-block/`
(GLB, manifest) and `artifacts/gable-block/` (editable scene, recipes, three renders,
browser captures). Export meshes are merged per building/material while the
Blender source retains individual components. The revised block has 19,978
triangles and 65 material draws, about 1.36 MB. Budget assertions must be checked
against the manifest after parameter changes.

Visual direction: [low poly Dutch town](https://sketchfab.com/3d-models/low-poly-dutch-town-2d76adc1d86d4944bd54542c54d941ec),
[Korte Prinsengracht](https://sketchfab.com/3d-models/korte-prinsengracht-9ed202a9f18f4fcaa74983e7c62fc1f7),
[Amsterdam Buildings](https://sketchfab.com/3d-models/amsterdam-buildings-a2eeb323df9d4a0bb36f15346e40000e),
and [Amsterdam Voxel Diorama](https://sketchfab.com/3d-models/amsterdam-voxel-diorama-d7c35a23ef964fa1baa7a9fde26f1ec3).
The public preview images informed silhouette/material contrast; model meshes and
textures were not imported. Real-building adaptation still requires dated facade
evidence and measured shell dimensions.
