# Appearance-aware building renderer

## Status

Proposed architecture. This document replaces the assumption that Amsterdam's
production building meshes should be generated primarily by OSM2World. For the
Netherlands, BAG identity plus 3DBAG LoD2.2 geometry is the stronger canonical
foundation. OSM remains an important semantic source and OSM2World remains a
useful reference/fallback for cities without comparable government geometry.

The companion [`BUILDING_ENRICHMENT.md`](BUILDING_ENRICHMENT.md) describes how
roof and façade observations are obtained. This document describes how those
observations become a coherent, performant city renderer.

## Decision

Build an offline Amsterdam building compiler that joins BAG/3DBAG geometry,
OSM semantics, measured PDOK roof appearance and reviewed panorama façade
appearance into independently cacheable 3D tiles. Render those tiles through
one MapLibre custom 3D layer, with ordinary MapLibre extrusions as a loading and
failure fallback.

Do not continue with the current arrangement of three overlapping geometries:

1. OpenFreeMap's complete but uniformly styled building extrusion;
2. a partial `buildings-colored.geojson` wall extrusion and artificial roof
   slab; and
3. uniformly coloured hosted 3DBAG meshes that hide both other layers when
   enabled.

Only one representation may own a building at a time. A detailed tile replaces
its fallback footprints after it has loaded successfully; failed, absent or
evicted tiles reveal the fallback again.

## Why the city is gray today

The appearance extract is not a complete building dataset. It contains 10,578
OSM buildings that have at least one relevant appearance tag. Of those, 5,778
currently have an aerial roof-colour measurement. Buildings without appearance
tags remain solely in OpenFreeMap's neutral basemap.

The optional detailed mode streams 3DBAG LoD2.2 3D Tiles, but those hosted tiles
use uniform materials. `_syncDetailedBuildingLayers` hides `building-3d`,
`osm-colored-buildings` and `osm-colored-building-roofs` as soon as the detailed
tiles are ready. Consequently the best geometry path discards all locally
measured appearance, while the appearance path uses the least capable geometry.

The replacement makes geometry and appearance one asset instead of two
competing layers.

**The dominant cause is coverage, not fidelity.** Amsterdam has on the order of
200,000 BAG panden; the appearance extract describes 10,578 of them, and 5,778
of those carry a measurement. Even a perfect mesh pipeline applied to today's
input would leave most of the city neutral. So completeness is worth more than
per-surface realism, it is far cheaper, and the migration plan below buys it
first.

## Goals

- Complete Amsterdam building coverage with stable, authoritative identity.
- Real LoD2.2 roof planes, slopes, ridges and stepped building parts.
- Separate semantic wall, roof and ground-facing surfaces.
- Per-surface measured, tagged, inferred or fallback appearance with explicit
  provenance and confidence.
- Properly scaled reusable material textures rather than photographic imagery
  pasted onto buildings.
- A single depth-correct MapLibre custom layer with reliable fallback.
- Building/landmark picking and highlighting that behave identically across
  detailed and fallback representations.
- Spatial streaming, deterministic builds and bounded mobile costs.
- A pipeline that can later support Utrecht and non-Dutch cities without
  pretending that Amsterdam-specific government data is globally available.

## Non-goals

- Photorealistic digital twins or exact window-by-window reconstruction.
- Projecting panorama photographs directly onto meshes.
- Inventing façade observations from nadir imagery.
- Downloading the entire historic panorama image archive.
- Replacing MapLibre, the road/water basemap, labels or game coordinate system.
- Shipping raw PDOK or panorama imagery to players.
- Requiring detailed geometry for gameplay correctness.

## Source hierarchy

### Identity and footprint

**BAG `pand_id` is the canonical Dutch building identity.** It is stable across
the government geometry and is the key used by the compiled appearance table.
Retain OSM way/relation IDs as aliases for game landmarks, tags and editing
provenance. Store the spatial join method and confidence because one BAG object
may match multiple OSM building parts, and one OSM outline may cover multiple
BAG objects.

### Geometry

Use 3DBAG LoD2.2 semantic geometry where reconstruction quality passes. It has
actual roof planes derived from AHN, and separates roof and wall surfaces. Use a
simple LoD1.2/1.3 extrusion for missing or rejected LoD2.2 buildings. Do not
reconstruct sloped roofs from the 2D projection when the 3D semantic surface is
available.

### Appearance

Resolve every surface through a common precedence function:

1. explicit reviewed override;
2. explicit valid OSM colour/material tag;
3. direct government-image observation;
4. high-confidence reviewed/model classification;
5. material/age/use prior;
6. controlled neutral fallback.

An observation and the chosen rendering value are separate records. A newer
observation does not destroy an OSM tag, and changing precedence does not
require rerunning image processing.

**Reviewed overrides key on the building and the surface *kind*, not on a
`surfaceId`.** Human review is the most expensive input in this pipeline, and
`surfaceId` is only stable within one 3DBAG release — plane reconstruction
changes between vintages, so surface-keyed overrides would be silently orphaned
by a routine source upgrade. "The roof of `bag:X` is zinc" survives that;
"surface 7 of `bag:X` is zinc" does not. Finer-grained overrides are allowed
where a building genuinely needs them, but they must record the geometry
version they were made against and be re-reviewed, not carried forward blindly,
when that version changes.

### Geometry outside the Netherlands

Use OSM building parts and OSM2World or another pinned procedural converter as
the fallback compiler. It must emit the same runtime tile contract, even if its
geometry quality and identity source differ. The runtime must not contain a
separate renderer for each country.

## Canonical data model

The compiler consumes versioned source snapshots and produces a compact
normalized record before mesh generation. Field names below are illustrative;
the implementation should define and validate a versioned TypeScript schema.

```ts
type BuildingAppearance = {
  schemaVersion: 1;
  buildingId: string;             // `bag:<pand_id>` in the Netherlands
  aliases: {
    osmIds: string[];
    bagId?: string;
    landmarkIds: string[];
  };
  geometry: {
    source: '3dbag-lod22' | '3dbag-lod13' | 'osm-procedural';
    sourceVersion: string;
    reconstructionQuality?: number;
  };
  surfaces: Array<{
    surfaceId: string;             // stable within geometry source/version
    kind: 'roof' | 'wall' | 'ground' | 'closure';
    areaM2: number;
    slopeDegrees?: number;
    azimuthDegrees?: number;
    appearance: {
      materialClass: MaterialClass;
      colour: `#${string}`;
      textureId: string;
      source: 'reviewed' | 'osm' | 'aerial' | 'panorama' | 'model' | 'prior' | 'fallback';
      confidence: number;
      observedAt?: string;
      sourceProduct?: string;
      modelVersion?: string;
    };
  }>;
};
```

The renderer does not need this verbose object. The compiler packs the resolved
values into material indices and feature metadata; the full record remains a
build artifact for audits and future regeneration.

## Material system

**Build this only after flat colour has been shown to be insufficient.** The
game's camera is a chase camera at street level moving at cycling speed. Brick
course scale is legible for perhaps 10–30 m and invisible past that, while
silhouette, height and roof colour carry recognition at every distance — and the
product principle is that geographic learning outranks spectacle. So Phase 2's
first output is the same block rendered twice, quantized flat colour against
textured material, judged on a real driving route. The taxonomy and atlas below
are the plan *if* that comparison justifies them; a negative result is a good
result and saves the whole subsystem.

Classify semantic materials first, then select a render texture. A model must
not predict an OSM Texture Library filename directly.

Initial wall classes:

- red, brown and yellow brick;
- dressed/rough stone;
- plaster/stucco;
- exposed/precast concrete;
- glass curtain wall;
- metal cladding;
- wood;
- ceramic/tile cladding;
- mixed, other and unknown.

Initial roof classes:

- clay tile;
- dark tile/slate;
- bitumen/tar paper;
- zinc/metal sheet;
- gravel;
- concrete;
- glass;
- green/vegetated;
- solar-dominant;
- mixed and unknown.

Each texture asset has a manifest entry containing ID, semantic class, author,
source URL, license, attribution, real-world width/height, colourization rules,
normal/roughness availability and checksum. Public-domain or compatible assets
from the OSM Texture Library may seed the set, but licensing is checked per
asset. Prefer a small curated atlas over hundreds of visually redundant files.

Colour and texture are orthogonal. Use a mostly luminance/roughness texture and
tint it with a quantized measured colour where appropriate. Material-specific
textures such as multicoloured brick may use bounded tinting rather than a full
multiply that destroys their natural palette.

Texture coordinates are generated in metres from each surface's local plane.
Adjacent coplanar surfaces should share a stable origin when possible so brick
courses do not restart at every triangle. Roof orientation follows the roof
plane rather than world XY. Mipmaps, anisotropy and distance-specific material
variants must prevent shimmer during driving.

## Colour normalization

Raw aerial sampling currently produces 4,769 distinct roof colours for 10,578
features. That is measurement noise, not useful visual diversity. Normalize in
a perceptual colour space and quantize within each material family. Preserve
the raw observation in the audit record, but compile a controlled renderer
colour.

Quantization must not collapse meaningful classes such as oxidized copper,
terracotta tile, zinc, black bitumen and green roofs. Establish the palette
against a manually reviewed stratified set rather than choosing a fixed number
of global k-means clusters blindly.

## Offline compiler

The compiler is deterministic and operates only on pinned source versions.

```text
BAG snapshot ─────────────┐
3DBAG LoD2.2 ─────────────┼─ identity/spatial join ─ semantic surfaces
OSM snapshot ─────────────┤                              │
PDOK observations ────────┤                              ├─ appearance resolver
panorama classifications ─┤                              │
reviewed overrides ───────┘                              ↓
                                             mesh + material assignment
                                                        ↓
                                           tiled GLB / 3D Tiles + manifest
```

### Build stages

1. Validate source versions, licenses and checksums.
2. Clip inputs to the city boundary plus a small streaming halo.
3. Build BAG↔OSM aliases and produce ambiguous/unmatched reports.
4. Validate 3DBAG geometry and select LoD2.2 or fallback per building.
5. Join roof observations to roof planes and façade observations to visible
   wall planes. Never broadcast one crop to every side of a building.
6. Resolve appearance per semantic surface and record why it won.
7. Generate metre-scaled UVs, normals, tangents and material indices.
8. Partition into a stable spatial grid; clip or assign large buildings without
   duplicating selectable identity.
9. Generate LODs and compress geometry/textures.
10. Emit tiles, a root manifest, a compact feature lookup and audit reports.
11. Run geometry, coverage, attribution, byte-budget and visual checks before
    publishing a versioned asset directory.

### Output manifest

The root manifest records:

- schema and compiler versions;
- city and bounds;
- BAG, 3DBAG, OSM, PDOK and panorama source versions;
- attribution/license entries;
- tile URL, bounds, content hash, byte size and LOD statistics;
- feature lookup version;
- total buildings and coverage by geometry/appearance source;
- rejected and fallback counts.

Never overwrite an existing version in place. A release switches one small
city manifest after all tiles have uploaded successfully.

## Runtime architecture

### One custom layer

`AppearanceBuildingLayer` owns detailed building rendering, streaming, picking
and highlighting. It shares MapLibre's WebGL context and the existing shared
Three.js runtime. It must not instantiate another canvas or map.

Responsibilities:

- load the city manifest;
- select tiles from camera position/frustum and target screen-space error;
- limit network and decoder concurrency;
- retain nearby tiles with hysteresis to prevent turn-by-turn churn;
- manage GPU disposal and a strict memory budget;
- render depth-correctly against MapLibre terrain/roads/water and game meshes;
- expose `pick(screenPoint)` and `setActiveBuilding(buildingId)`;
- report tile ownership so fallback footprints can be hidden safely;
- restore state after WebGL context loss.

The layer does not know about roof sampling, panorama APIs or model confidence
logic. Those are compiler concerns.

### Fallback ownership

Fallback is complete OpenFreeMap/OSM extrusion coverage, not a second permanent
visual layer. Ownership changes at tile granularity initially:

```text
manifest unavailable       → fallback visible
tile requested/loading     → fallback visible
tile decoded and committed → detailed tile visible, matching fallback hidden
tile failed                → fallback remains visible
tile evicted               → fallback restored before detailed tile removal
```

MapLibre cannot hide arbitrary basemap features by BAG ID, because
OpenFreeMap's `building-3d` source does not carry that identity. There are two
ways out, and only one of them works.

A coverage mask — a polygon over each loaded tile's bounds, drawn to obscure
basemap buildings — was considered and is **rejected**. It has to be clipped
away from roads, water and labels to avoid erasing the navigation corridor,
which means reconstructing the basemap's own geometry inside a mask; and being
flat, it cannot hide a tall extrusion leaning in from a neighbouring tile. It
costs about as much as the correct answer and does not work.

So the fallback is ours from the start: **publish a complete BAG-keyed LoD1
building source on the same spatial tiles as the detailed geometry, and remove
`building-3d` from the style.** Fallback and detailed geometry then share
identity, heights and tile boundaries, so replacement is exact and reversible
per building rather than per screen region. This is the intended end state, and
making it the *first* deliverable is what removes the mask question entirely.

### Picking and highlights

Every rendered primitive carries a compact feature ID resolving to
`buildingId`, aliases and optional landmark IDs. Raycasting a detailed mesh and
querying a fallback extrusion return the same `BuildingHit` contract.

Highlighting must operate at feature granularity without cloning a material per
building. Prefer a GPU lookup texture or feature-state buffer keyed by compact
feature index. The current shader-clone approach is acceptable for a spike but
not for thousands of selectable textured buildings.

## Panorama strategy

**Optional, and last.** Façade appearance is the most expensive and least
certain input here: it needs an imagery licence review, a spatial join to
visible wall planes, a classifier and human review, to answer a question whose
answer in central Amsterdam is "brick" with high prior probability. A BAG
construction-year and use prior gets most of that for free with no licensing
exposure, and belongs in Phase 1 as an `inferred` value. Do not start the
panorama pipeline until flat/textured comparison has shown that wall material
changes what a player recognises.

When it is started: do not mirror every historic image. Download the metadata index, spatially join
camera positions to visible façade planes, then select a small number of useful
views. Deduplicate source panoramas before downloading: one 4K panorama can
produce crops for many nearby buildings.

Keep source panoramas and derived crops in ignored local/object-storage caches.
The published renderer contains only semantic material/colour predictions,
confidence/provenance and curated reusable textures. Human review overrides
model proposals, and `not-visible`/`uncertain` are valid outcomes.

## Performance budgets

Set final budgets from measurements on the project's lowest supported phone.
Initial gates for the Rijksmuseum and one residential-block pilots:

- no additional per-frame network requests after nearby tiles settle;
- at most four concurrent tile downloads and two decode jobs;
- no more than 50 MB detailed-building GPU memory inside the active radius on
  the mobile test target;
- median custom-layer CPU update below 2 ms and GPU contribution below 4 ms at
  the standard chase camera;
- no sustained frame-rate loss greater than 10% versus fallback extrusions;
- no single ordinary spatial tile above 2 MB compressed; exceptional landmark
  tiles must be identified and independently cacheable;
- visible fallback within the same frame after tile failure or context loss.

These are starting constraints, not promises. Record device, viewport, route,
camera and browser with every benchmark.

## Validation and acceptance

### Data checks

- Every published Dutch feature has one canonical BAG ID.
- No duplicate surface ownership or duplicate building geometry within a LOD.
- Geometry is valid and semantic roof/wall counts are plausible.
- Every material/texture has complete source and license metadata.
- Every non-fallback appearance has source, confidence and observation/model
  version.
- Coverage totals reconcile from source input through published tiles.
- A failed join cannot silently transfer one building's appearance to a
  neighbour.

### Visual checks

Maintain fixed desktop and mobile camera fixtures for:

- Rijksmuseum courtyard and towers;
- canal-house rows with sloped roofs;
- mixed modern glass/concrete blocks;
- large flat industrial roofs;
- green and solar-covered roofs;
- tile boundary crossings;
- detailed loading, failure and eviction;
- active landmark highlight and click selection.

Acceptance requires no z-fighting, duplicate silhouettes, holes at replacement
boundaries, texture swimming, obvious scale errors or fallback flashes after a
tile has settled.

### Appearance checks

Review a stratified ground-truth sample before setting automatic thresholds.
Report roof colour error, material precision/recall, abstention rate and
performance by surface size, distance, neighbourhood and observation source.
Do not use renderer screenshots as the sole truth oracle.

## Migration plan

### Phase 0 — make existing observations trustworthy

- Expand the roof input from appearance-tagged OSM buildings to complete BAG/
  3DBAG coverage.
- Sample actual roof planes from a pinned PDOK vintage.
- Fix provenance, multipolygons, holes and tile-boundary sampling.
- Quantize renderer colours while preserving raw observations.
- Produce a reviewed 200-roof accuracy set.

Exit: a versioned BAG-keyed appearance table, independent of the current
GeoJSON renderer.

### Phase 1 — Rijksmuseum vertical slice

- Fetch one pinned 3DBAG LoD2.2 building/part set.
- Compile roof and wall semantics into a local GLB with feature metadata.
- Apply measured roof colours and conservative wall materials.
- Render it in MapLibre, suppress only its fallback footprint and preserve
  picking/highlighting.

Exit: recognizable silhouette/courtyard, no duplicate geometry, recorded bytes,
decode time, GPU memory and frame cost.

### Phase 2 — representative residential tile

- Compile one canal-house block with shared texture atlas and metre-scaled UVs.
- Add panorama-derived reviewed façade classifications.
- Exercise tile loading/failure/eviction and phone performance.

Exit: the block looks materially richer than flat extrusion without navigation
occlusion, shimmer or unacceptable frame cost.

### Phase 3 — spatial streaming pilot

- Generate a multi-tile central Amsterdam corridor.
- Add deterministic LODs, manifest, content hashes and cache policy.
- Replace per-tile fallback exactly and test a complete driving route.

Exit: no tile-edge artifacts or sustained performance regression on the mobile
target.

### Phase 4 — Amsterdam rollout

- Generate full city coverage with geometry/appearance audit reports.
- Publish versioned assets and switch the runtime manifest.
- Remove the hosted uniform 3DBAG path.
- Retain the current GeoJSON colour overlay only until the new complete LoD1
  fallback carries the same information; then delete its duplicate geometry.

Exit: one renderer, one identity system and one fallback system.

### Phase 5 — second-city contract test

- Run Utrecht through the same Dutch compiler.
- Implement the OSM/procedural geometry adapter on a city without 3DBAG-quality
  government data.
- Confirm both emit the same runtime contract.

## Rejected alternatives

### Keep stacking coloured extrusions over the basemap

Rejected because coverage is partial, heights disagree, roofs are artificial
slabs and overlapping faces require fragile offsets to avoid z-fighting.

### Stream hosted 3DBAG and recolour it only at runtime

Useful for the Phase 1 spike, but insufficient as the final pipeline. Hosted
tiles are uniformly materialled, version control is external, texture UVs are
not tailored to our atlas and joining large per-building appearance tables in
the browser adds complexity and bandwidth. Own compiled tiles provide
reproducibility and offline availability.

### OSM2World as Amsterdam's primary geometry

Rejected as the primary Dutch source because 3DBAG already provides government-
linked LoD2.2 planes reconstructed from AHN. Retain OSM2World as a procedural
reference and the geometry adapter for places without an equivalent source.

### Photographic façade projection

Rejected because panoramas contain perspective, occlusion, lighting, people,
vehicles and licensing/privacy considerations. Classify semantic appearance and
render curated repeatable materials instead.

### One city-sized GLB

Rejected because it prevents bounded streaming, granular caching, prompt
fallback, useful LOD selection and manageable regeneration.

## Open questions

- Does current 3DBAG feature metadata expose BAG IDs at the exact roof/wall
  granularity needed, or should the compiler consume CityJSON instead of hosted
  3D Tiles?
- Which tile grid and geometric-error schedule best match the game's camera?
- Can a MapLibre coverage mask hide fallback buildings cleanly enough for the
  pilot, or should the complete custom LoD1 fallback be built immediately?
- How stable can `surfaceId` remain across 3DBAG releases when roof plane
  reconstruction changes?
- Which compressed texture format is supported across the actual browser/device
  matrix without an expensive fallback atlas?
- Should distinctive landmarks use bespoke authored materials while retaining
  the same geometry/identity contract?

Resolve these through the two bounded pilots, not by widening the first build.
