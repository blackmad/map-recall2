# Blender building library

Date: 2026-09-30. Owner: Codex; implementation delegated to Sol.
Status: plan agreed by task scope; initial implementation assigned below.

## Outcome

Build a reusable, data-driven Blender toolkit that makes the next building faster
to author while improving architectural fidelity. A building recipe should choose
assemblies, materials, dimensions, and evidence-backed exceptions. It should not
require copying Python geometry code or adding another `caseId` branch.

Deliver editable `.blend` scenes, efficient GLBs, placement metadata, and a
consistent visual review. Support ordinary urban buildings across Amsterdam,
including canal houses, terraces, corner shops, apartment blocks, warehouses,
and contemporary commercial buildings. Start with the five Jordaan candidates;
do not treat them as accepted photogrammetric reconstructions.

## What today's work established

The current implementation is `scripts/blender/build-jordaan-pois.py`, with source
records in `jordaan-pois-source.json`. The five models are Rozengracht 158,
Elandsgracht 96, Rozengracht 160, Lauriergracht 50, and Rozengracht 212.
The browser preview and placement adapter are in `public/canal-drive/`.

We have useful primitives, source photographs, footprint bindings, a Blender
export path, and a Three.js inspection page. Current exports measure approximately
4,300–5,900 triangles, 12–15 material primitives, and 328–499 KB per building.
Those measurements are a baseline, not proof of visual accuracy.

Problems the library must solve:

| Observed problem | Library responsibility |
| --- | --- |
| Front camera used whole-building bounds; storefront and sign were separately offset | Distinct facade frame, assembly anchors, and camera framing |
| Photo crop jitter produced uneven storeys | Explicit storey datums and row constraints, with intentional irregularity supported |
| Pavement in a crop lifted doors above the ground | Threshold/street datum independent of crop bounds |
| Roof apron showed through the gable; surfaces tore while moving | Surface ownership, proper joins, and explicit layer thickness |
| Fixing facade depth hid the ground-floor finish | A shared surface stack used by walls, finishes, openings, and signs |
| Every building got essentially the same brick noise and dark glass | A material library with controlled variation and distinct finish families |
| Most changes rebuilt all five models and renders | Build one recipe, dependency hashes, material caching, optional renders |
| Numeric checks passed while visible mistakes remained | Component geometry checks plus front, oblique, roof, close-up, and motion review |

The current roof is a generic ridge over the footprint; custom gable silhouettes
do not establish that the roof behind them is correct. Current windows are opaque
panels laid over walls, rather than actual apertures. Most frame members are
cylinders, not joinery profiles. These are explicit upgrade targets.

## Architecture and contracts

Create `scripts/blender/building_lib/` as an importable Python package. Keep pure
recipe/layout calculations usable without `bpy`; isolate Blender scene mutation.
The command-line builder must be safe to import and must not clear a scene or
start rendering at module import time.

| Module | Responsibilities / proposed functions |
| --- | --- |
| `schema.py`, `recipes/` | Versioned building recipes; validation; provenance and assumptions |
| `frames.py` | `FacadeFrame`, local/world transforms, street datum, frontage anchor, export axes |
| `layout.py` | `solve_storeys`, `solve_bays`, `align_assembly`, explicit asymmetric layouts |
| `geometry.py` | Polygon validation, triangulation, extrusion, profiles, clipping, openings |
| `walls.py` | Wall segments, thickness, returns, party walls, finish regions and ownership |
| `openings.py` | Rectangular/segmental/round heads, recessed reveals, frames, sashes, doors |
| `ground_floors.py` | Residential entrances, stoops, basements, storefronts, display bays, corner returns |
| `roofs.py`, `gables.py` | Roof volumes and coverings, facade silhouettes, connections between them |
| `details.py` | Cornices, sills, balconies, railings, gutters, downpipes, dormers, chimneys |
| `signage.py` | Signs, text bounds, awnings and brackets anchored to their parent assembly |
| `materials/` | Presets, provenance, physical UV scale, image maps, baking and texture cache |
| `archetypes/` | Compositions of components; no duplicate low-level mesh implementations |
| `export.py` | Editable scene, runtime merge/LOD, embedded or shared textures, placement manifest |
| `review.py` | Fixed cameras, contact sheets, material swatches, evidence and geometry reports |

Recipes specify metres, footprint rings including courtyards, a street datum,
frontages, floor datums, openings, roof structure, gable profile, materials, and
business assemblies. Allow multiple frontages and multiple roof volumes. A corner
building cannot be represented by one stretched front elevation.

Use Blender +Z up, +X along the selected facade, +Y into the building; record the
glTF conversion explicitly. Preserve geographic origin, BAG/OSM identities,
footprint revision, actual exported bounds, and placement bearing. Verify frame
handedness rather than silently reflecting a footprint.

Every inferred feature records `observed`, `inferred`, or `unknown`, a source
reference where available, and an override reason. Synthetic demonstration
recipes must be labelled synthetic. Do not invent POI identities or claim unseen
elevations are measured. Conflicting height sources require an explicit recipe
choice and diagnosis; choosing their maximum is not a general solution.

## 3DBAG is the starting geometry

User clarification, 2026-09-30: start from the 3DBAG model for the building's
width, depth, height and overall proportions, while treating its roof shape as
unreliable. This is a required geometry contract for the initial implementation.

- Import the actual owner footprint and wall shell, with geographic identity,
  coordinate frame, elevation datum and geometry revision intact. Preserve
  footprint irregularities, rear extensions and the actual frontage width/depth;
  do not replace them with archetype defaults or dimensions inferred from a crop.
- Derive wall heights and likely eaves from wall surfaces and their junctions,
  separating vertical wall extent from roof/gable peaks. Sloping top boundaries
  need interpretation: a wall vertex at a gable peak is not an eaves measurement.
  Retain raw 3DBAG heights and the chosen body-height estimate with provenance.
- Do not use `max(reported_height, all_mesh_vertex_extent)` as the final body
  height. That prototype shortcut allows uncertain roof vertices or datum
  mismatches to stretch the entire building and all of its floor spacing.
- Keep body, eaves, gable peak and roof ridge heights as separate parameters.
  Use 3DBAG wall geometry as the initial metric envelope; use registered,
  multi-year photographs to place storeys/openings and refine uncertain eaves.
  Preserve measured floor heights when supported; equal-spacing mode is an
  explicit recipe choice inside the supported body envelope.
- Reconstruct roof structure and visible silhouette independently, guided by
  rectified photographs and credible supporting observations. 3DBAG roof faces
  can remain a low-confidence hint, but must not dictate the finished roof or
  rescale the facade. Keep hidden roof regions explicitly inferred.
- If the shell or height datum is inconsistent, report the disagreement and
  use an explicit evidenced override. Preserve the original measurements; do
  not silently snap to a generic house or choose whichever source is tallest.
- Review a 3DBAG shell overlay against the generated building and report
  frontage width, plan depth, wall/eaves height and separate roof peak, including
  differences and override reasons. Key Color's current 20.1 m exported extent
  deserves this audit rather than being accepted as a reliable body height.

Acceptance: real-building recipes trace their metric envelope to the identified
3DBAG owner; roof changes do not move floor datums or stretch the shell; and the
review shows the original shell and the reconstructed roof as distinct sources.

### Supplemental government height data

Official sources checked 2026-09-30:

- [Kadaster / PDOK 3D Basisvoorziening](https://www.pdok.nl/introductie/-/article/3d-basisvoorziening-1)
  publishes a 2D buildings collection with height attributes in GeoPackage,
  linked by `bagpandid`, plus CityJSON building objects. Inspect attributes and
  lineage before selecting a height statistic. The same service offers 8 cm and
  20 cm photogrammetric DSM point clouds derived from aerial imagery.
- [AHN open height data](https://www.ahn.nl/dataroom) provides ground/surface
  rasters and classified laser point clouds in RD/NAP, with multiple editions.
  Use building-class points and local ground observations where available.
  Ground-relative height is object elevation minus local ground elevation in
  the same vertical datum. A DSM includes vegetation; its maximum is not a
  reliable building-height measurement under a tree.
- [3DBAG lineage](https://docs.3dbag.nl/en/) already uses AHN for heights.
  Re-reading the same AHN acquisition or another derived height product does
  not supply independent confirmation. Record acquisition/source lineage and
  dates; compare raw observations or a genuinely different acquisition when
  diagnosing a reconstruction error.
- [3DBAG height definitions](https://docs.3dbag.nl/nl/schema/layers/) distinguish
  ground elevation and roof-part percentiles. A roof percentile is neither a
  measured eaves height nor a floor datum. Keep these quantities separate.

Reuse `scripts/cache-pdok-dsm-point-cloud.ts` and
`scripts/cache-3dbag-facade-walls.ts` where appropriate. The DSM cache script
currently pins a 2025 directory; do not silently describe it as the latest
acquisition. Add a height-evidence record (source, year, datum, ground, roof
statistics, wall/eaves estimate, uncertainty and lineage), beginning with a small
Key Color comparison. Flag conflicts rather than automatically resizing the model.

## Required multi-year rectified evidence

Height audit now available at `artifacts/jordaan-pois/height-audit.json`:
live 3DBAG LoD2.2 gives the selected Key Color frontage a wall extent of
15.176–15.194 m above its base. The cached 17.23 m value matches the whole-owner
roof 70th percentile minus ground (17.231 m), not an eaves measurement. Higher
surfaces elsewhere in the owner explain why applying the maximum to the front
stretched it. The downloaded PDOK 2024 and 2025 editions each have three polygon
parts for this BAG ID and all reference AHN5 acquired in 2023. They do not add two
independent acquisition years. Keep part geometry, release year and capture year
separate; never select the first matching BAG row as the building's height.

User addition, 2026-09-30: use rectified samples from multiple years, particularly
for Key Color Fotolab / Elandsgracht 96 (`0363100012168954`, `case-03`). Its current
full crop is badly obscured by a tree. The current model's inferred second window
bay, height and roof shape must be revisited using other captures, not promoted
unchanged merely because the new library can reproduce them.

This is a prerequisite to evidence-based recipe authoring and is part of Sol's
first implementation slice:

1. Inventory all available captures for the same BAG owner AND physical facade,
   across years, panoramas and rectification runs. Start with
   `scripts/review/temporal-evidence-inventory.json`, the existing temporal tools,
   and the reconstruction worktree caches. The current main checkout omits many
   cached images; `.worktrees/amsterdam-facade-rebuild/` contains the existing
   source data. Read it without modifying that worktree.
2. Store a source bundle per facade with panorama/crop hashes, acquisition date,
   image dimensions, wall plane, pixel-to-metre transform, registration status,
   geometry revision, crop coverage, occlusion, and native resolution. A crop
   labelled rectified is not automatically a verified metric registration.
3. Select evidence by region (roofline, upper floors, street level), rewarding
   visible coverage, useful resolution, frontal angle, and year diversity.
   Multiple crops from one panorama count as one capture, not independent evidence.
   A 2024 roof plus a 2025 ground crop does not establish multi-year coverage of
   the roof. Expose a coverage matrix by region and year.
4. Reuse existing rectification machinery to align useful alternate captures to
   the same facade frame. Reject adjacent owners, reversed frontages, obsolete
   geometry bindings and badly registered crops. Search existing caches before
   reacquisition. Where other years are unavailable, record searched locations,
   missing coverage and a concrete acquisition/rectification task.
5. For stable geometry, derive feature proposals from multiple registered views,
   using clear observations to fill tree/vehicle occlusions. Retain per-feature
   source links and disagreements; do not average conflicting window positions
   or transfer dimensions from ambiguous registrations.
6. For time-sensitive details (business sign, awning, painted finish, replacement
   doors), set a target date and select a coherent appearance state. Older photos
   may explain structure without silently restoring a defunct business or mixing
   incompatible renovation states.
7. Show a dated evidence contact sheet and coverage matrix in the review, with
   full/roof/ground views and selected/rejected reasons. Let the author inspect
   alternative years before accepting a hidden-feature inference.

The existing case-03 inventory contains 2024 full/roof/context and 2025 ground
sources, but marks their metric registration ambiguous. These alone do not prove
that a clear alternate-year full facade has been found. Sol must investigate and
report the actual available years and regions, preserving any remaining uncertainty.

Initial implementation audit (2026-09-30): the cache-only rectifier produced 27
full/roof/ground crops from distinct dated panoramas. Key Color has 2024 and 2025,
Lauriergracht 50 has 2023 and 2025, and Rozengracht 158 has 2022 and 2025. Bar Theo
and Bianco still have only 2023 coverage in the located cache (Bianco has two
capture dates). These are availability findings, not accepted metric registration.
The newly rectified Key Color 2025 full view visibly resolves both window bays
and a straight street cornice; it does not justify the prototype's triangular
front gable. Lauriergracht 50's 2025 view shows grey-brown masonry, horizontal
sash divisions, and a recessed storefront. Record these visual observations
separately from metric confidence; see
`artifacts/jordaan-pois/alternate-year-visual-review.json`.

Subsequent visual review rejected the initial Bar Theo full crop as primary-front
evidence: it shows the Akoleienstraat side facade. Matching the BAG owner is not
sufficient. Bind observations to the selected frontage endpoints and orientation;
retain side views as secondary evidence and exclude them from primary-frontage
coverage. Its street cornice also needs an explicitly photo-inferred ratio rather
than using the lowest top vertex of an irregular 3DBAG wall as an eaves datum.

Expanded cache search then found 20 eligible panorama captures yielding 60 new
primary-plane crops across the five owners. Available years now span 2022–2025:
Key Color has 2022/2024/2025, Bianco has 2022/2023/2024, and the other three have
all four years. This supersedes the initial cache-coverage gaps above. Bar Theo's
2025 primary-front rectification is substantially less tree-obscured and visibly
matches the gabled front. These crops remain ambiguously registered; their
existence is not metric acceptance or automatic hidden-feature recovery. The
source-bundle audit is the authoritative inventory as acquisition continues.

Acceptance: the builder consumes a source bundle rather than a single preferred
crop; Key Color has an alternate-source audit; every migrated building has a
region/year coverage report; unresolved occlusion is visible; and available
registered multi-year observations feed recipe derivation. No invented evidence
or claim of multi-year recovery when only duplicate/ambiguous crops are present.

## Correct facade and first-floor assemblies

Use unambiguous levels: `ground` is street level, `upper_1` is the first storey
above street level, and `attic` is separate. This covers both meanings of
"first floor" without allowing an indexing error in a recipe.

1. Give every storey a bottom/top datum and every opening a sill/head datum.
   Equal upper-floor spacing is an explicit layout mode, matching the correction
   requested today. Also support measured unequal heights, split levels, stepped
   streets, and offset windows. Do not impose symmetry on every real facade.
2. Anchor a storefront to the facade or a named bay. Keep display windows, doors,
   transoms, fascia, text and awning in one assembly so they cannot drift apart.
   Support centered, left/right-aligned, and intentionally asymmetric layouts.
3. Model threshold height, entrance setback, recess side walls, glazing planes,
   pilasters, plinth, shop cornice, door panels and hardware. Distinguish a shop
   entrance from the separate residential door. Support raised entrances with
   stoops and basement windows/vents common on canal houses.
4. Use rectangular/moulded frame profiles, configurable sash/transom layouts,
   masonry lintels and arches. Door/window classification must not be decided
   solely by bounding-box height. Balconies and French doors belong to a storey.
5. Define a surface stack with named depths. As an initial compatibility measure,
   enforce ordered separation of shell, finish, glazing, frame, and sign. The
   subsequent wall compiler should create actual holes and reveals and omit
   hidden faces. Avoid accumulating arbitrary offsets as the final architecture.

## Roofs and canal-house features

Separate `RoofSpec` (structure/volume) from `GableSpec` (street-facing silhouette).
A neck or bell gable does not imply a triangular panel across its front.
Assign each roof/wall region to one owner; trim the hidden roof end against the
facade. Enforce continuous joins and visible material boundaries. Support roof
setback behind the gable, parapet/coping thickness, and a ridge whose position
does not depend on the camera.

Implement in increasing complexity:

- Flat/parapet and shed roofs; pitched/gabled roofs with actual eaves and ridge.
- Hip, mansard and gambrel roofs; dormers, gutters, downpipes and supported chimneys.
- Canal-house straight cornice, simple triangular, stepped, neck and bell gables.
  Use parameterized curves/profile segments and controlled tessellation; support
  a custom measured outline where presets do not fit.
- Multi-volume roofs, corner hips, rear extensions and courtyard setbacks. Fail
  clearly on unsupported footprint topology rather than create broken n-gons.

Chimneys and dormers attach to a queried roof surface. Gable ornaments and hoist
beams are optional components tied to evidence. Keep small trim as geometry near
the player and simplify it at distance. Use view-dependent tessellation budgets
for curved profiles; avoid both jagged silhouettes and excessive tiny triangles.

## Materials and texture library

Start by inspecting and reusing the existing material IDs in
`src/canalRecall/facade/wallMaterialLibrary.ts` and the attributed assets in
`public/data/facade-materials/manifest.json`. These include brick, painted brick,
render, stone and concrete presets plus two catalogued image textures. The
existing MapLibre sprites are not automatically suitable PBR textures.

Create a versioned renderer-neutral catalog. Each entry records family, physical
tile dimensions, colour space, map paths/hashes, source/license, permitted uses,
roughness range, normal strength, and optional compatible colour variants.
Keep material choice separate from observed wall colour and lighting.

Initial coverage:

| Family | Required variety |
| --- | --- |
| Masonry | Red, brown, dark, buff and painted brick; running bond plus header/Flemish variants |
| Mineral finishes | Warm/cool render, plaster, cut limestone, bluestone plinths, concrete |
| Roof coverings | Red/brown clay tiles, dark slate, zinc/standing seam, bituminous flat roof |
| Joinery / trim | Painted timber, weathered timber, stone coping, painted iron, metal frames |
| Shopfronts | Painted panels, restrained glass, canvas awnings, sign substrates |

Provide base colour, roughness and tangent-space normal maps where useful.
Bake Blender procedural materials into glTF-compatible maps; node graphs alone
do not constitute a portable asset. Treat colour maps as sRGB and data maps as
linear. Test the generated texture path for unintended double colour conversion.

Use repeatable seeds, verified seamless boundaries, bounded per-brick variation,
low-contrast mortar, correct course dimensions, and a shared metres-per-repeat
contract. Avoid strong noise, baked directional shadows, and identical stains
repeating every few bricks. Add restrained wear masks per building rather than
embedding one obvious stain in every tile. Never tint mortar and brick blindly
with the same colour multiplier.

Build a material contact sheet with physical scale rulers and wall/roof samples
under neutral and game lighting. Check 2 m, 10 m, and 30 m viewing distances,
oblique angles, mipmaps and slow camera movement. Glass gets an explicit mobile
fallback; transparent panes must not expose an empty building unintentionally.

Use existing attributed images or original procedural textures first. If external
PBR acquisition is needed, verify each source and license, download only a small
curated set, preserve attribution, and cache it. Geometry and texture provenance
are separate. No image-generation dependency is required for the first tranche.

## Building families and demonstration set

Share components across these compositions:

1. Narrow historic canal house with raised entrance/basement and shaped gable.
2. Ordinary terraced dwelling with a straight cornice or pitched roof.
3. Mixed-use shop/residence, including a wide storefront under several bays.
4. Corner shop/building with two streets, a return facade and optional chamfer.
5. Apartment block with repeated bays, balconies and a flat/parapet or hip roof.
6. Warehouse/workshop with large openings, loading doors and an industrial roof.
7. Contemporary commercial building with concrete/metal/glass assemblies.

The first implementation must include at least a terrace, a corner building, and
a flat-roof apartment/commercial block as labelled synthetic fixtures in addition
to the five real Jordaan candidates. Later validate each family against a real
local building before claiming a production-ready archetype.

## Faster authoring and review workflow

Author or update a recipe → validate dimensions/evidence → build selected IDs →
inspect facade/ground-floor/roof views → review within the block → export.

Provide a CLI with `--building`, `--all`, `--validate-only`, `--render`, and an
output root. Cache material maps and record recipe/library/material version
hashes. A storefront edit should rebuild that building without baking unchanged
textures or rendering the other four. Preserve manual artistic overrides in
recipes or named source collections instead of losing them on regeneration.

Store semantic object/collection names in `.blend` files. Merge meshes by material
only in an export copy. Produce true triangle/material/texture-memory counts,
world bounds, dependency hashes and unresolved assumptions in the manifest.
Keep placement and BAG suppression-after-load compatible with the current game
adapter. Enabling the models in the live game is a separate integration milestone.

## Implementation sequence and acceptance

| Milestone | Deliverable | Acceptance |
| --- | --- | --- |
| A — reusable foundation | Package, schema, frame/layout/surface contracts, CLI; migrate five recipes | No `caseId` branches in generic components; rebuild one ID; preserve user's centering/spacing fixes |
| B — materials and component gallery | Catalog, cached physical-scale materials, wall/opening/storefront/roof samples | Distinct brick/render/concrete/roof/wood/glass finishes; portable maps; seam/scale/colour review |
| C — architectural geometry | Real reveals and joins, ground-floor variants, canal roof/gable families | No coplanar tearing, triangle across gable, floating chimney, elevated threshold, or drifting sign |
| D — wider families | Terrace, corner, apartment, warehouse and modern compositions | Multiple frontages and roof types; synthetic vs observed examples clearly distinguished |
| E — game integration and speed | LOD/batching strategy, placement checks, block review, timings | Representative mobile draw/texture budgets measured; replacement suppression only after successful load |

Initial targets for detailed small buildings: <=15k triangles and <=20 draw calls,
with a goal of <=10 shared materials. Do not impose the same absolute budget on a
large apartment block; report cost per building and per visible block. Today's
file sizes are a baseline. Measure cold/warm build time, texture bake time,
GLB size and manual recipe-edit count before and after migration. Do not claim a
speed improvement without that comparison.

Checks should expose architectural failures rather than restate implementation:
valid transforms and indices; wall/roof continuity; openings contained in their
storeys; thresholds at the specified datum; assembly alignment; roof attachment;
finite normals and UVs; texture repeat continuity; bounding-box and placement
agreement. Check manifoldness only where a component promises a closed solid.

Retain today's visual regressions: centered Bianco storefront/text; equally spaced
upper floors where requested; clean Lauriergracht 50 gable; unobstructed Bar Theo
gable; separate ground-floor finish still visible after a facade-depth change.
Review front/oblique/roof/storefront close-up and a short orbit at desktop/mobile
resolution. Browser success and numerical tests do not alone approve resemblance.

## Sol implementation assignment

Implement the first usable slice of A and B, and demonstrate extensibility from D:

1. Extract reusable geometry/material/placement/export helpers into the package.
   Start the multi-year source-bundle importer and Key Color evidence audit above
   alongside the package extraction; this is required, not a later enhancement.
2. Add validated recipes and shared floor/assembly/surface-layer calculations;
   migrate the five models with the latest corrections preserved.
3. Add the CLI for selecting builds and optional renders; cache reusable materials.
4. Add a material catalog and a component/material gallery covering brick, render,
   concrete, stone, roof covering, timber, metal, and glass. Deliver a small good
   initial set, and explicitly list remaining PBR-map/finish work.
5. Add synthetic terrace, corner and flat-roof block examples composed from the
   same primitives; reject unsupported geometry instead of masking it.
6. Add focused checks for the problems above, run Blender exports and browser
   checks, and report screenshots, measured budgets, build timings, and gaps.

Implement in the shared workspace under `scripts/blender/` and dedicated new
preview/model paths. Preserve unrelated untracked `artifacts/` content and the
existing five files until replacements validate. Do not deploy, publish, change
unrelated game behavior, or label the entire roadmap complete after the first
slice. Report the exact completed milestones and remaining work to the parent.

Later slices implement C's robust wall/roof topology and the remaining D/E
families and runtime integration. Keep these visible in the implementation report.

## Overnight continuation — 30 September to 1 October 2026

User explicitly authorized continued sampling, implementation, documentation and
Sol delegation until 07:00 Europe/Amsterdam on 1 October (05:00 UTC).

Work proceeds in reviewed batches:

1. Finish the foundation browser/export audit and publish local review notes.
2. Expand the sample set with five additional ordinary buildings selected for
   architectural diversity and available multi-year evidence. Stage recipes for
   review before adding them to the main gallery.
3. Improve roof surface triangulation, joins and supported roof families, with
   geometry fixtures and image review retaining the reported gable regressions.
4. Replace illustrative glazing overlays with reusable aperture/reveal and
   recessed storefront assemblies where evidence supports them.
5. Continue material/component samples, document authoring workflows and measured
   costs, and validate local game-placement compatibility as improvements mature.

Root owns integration and independent visual/export checks. Sol tasks own
separate roof, openings/storefront and sampling workstreams. Preserve source
provenance, manual overrides and explicit uncertainty; more recipes do not by
itself establish fidelity. Keep every intermediate deliverable reviewable locally.
