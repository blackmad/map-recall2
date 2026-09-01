# Façade enrichment design

## Decision

Do not treat a façade as a material label or a photographic texture. A brick
image on a wall without openings looks less convincing than a restrained
procedural façade. Enrichment therefore describes a **façade grammar** that a
renderer can consume later; this branch only extracts and reviews evidence.

## Per-building façade contract

Every field is an independent observation with source, confidence and
visibility. Unknown is valid. Human corrections override but never delete the
machine proposal.

Raw vision output always has `reviewStatus=machine-proposal` and
`acceptedForNow=false`. The published files are research/audit artifacts, not
production evidence; only a human-reviewed label or a later calibrated and
explicitly gated model release may change that status.

### Geometry and rhythm

- `visibleStoreys`: integer visible above ground, or null.
- `bayCount`: repeated vertical window/door axes, or null.
- `windowPattern`: `narrow-vertical`, `regular-grid`, `wide-horizontal`,
  `curtain-wall`, `irregular`, `mostly-blank`, `unknown`.
- `windowToWall`: `low`, `medium`, `high`, `unknown`.
- `windowFrameColour`: controlled colour family.
- `windowRecess`: `flush`, `shallow`, `deep`, `unknown`.

These fields produce more recognition value than a high-frequency brick map.
Bay and storey counts also allow deterministic procedural openings without
stretching a texture across arbitrarily sized walls.

### Ground floor and access

- `groundFloorType`: `same-as-upper`, `residential-base`, `shopfront`,
  `commercial-glazing`, `arcade`, `garage-loading`, `mostly-blank`, `unknown`.
- `entranceType`: `single-residential`, `shared-residential`, `multiple-doors`,
  `commercial`, `garage-loading`, `mixed`, `none-visible`, `unknown`.
- `groundFloorDistinct`: boolean/unknown.

The ground floor is the part players see most closely. It must be represented
as a distinct zone when the evidence says so.

### Secondary structure

- `balconyType`: `none`, `projecting`, `recessed`, `gallery`, `mixed`,
  `not-visible`, `unknown`.
- `facadeComposition`: `single-field`, `base-body`, `ground-floor-distinct`,
  `vertical-zones`, `mixed`, `unknown`.
- `roofline`: `flat-parapet`, `stepped-gable`, `bell-gable`, `neck-gable`,
  `spout-gable`, `triangular-gable`, `mansard-eave`, `other`, `not-visible`,
  `unknown`.
- `ornament`: `minimal`, `moderate`, `elaborate`, `unknown`.

### Appearance and typology

Retain the existing independent façade material, façade colour and Dutch
typology fields. Material can later choose a subtle normal/roughness family;
it must not bake windows or doors into a repeating material tile. Typology is
a prior for missing grammar fields, never a replacement for visible evidence.

## Evidence hierarchy

1. Human-reviewed panorama observation.
2. High-confidence vision proposal from a correctly aimed municipal panorama.
3. Explicit OSM tags for material/colour/storeys/roof shape.
4. BAG construction year, use and unit count plus 3DBAG height as priors.
5. Neighbourhood/typology prior with explicit `inferred` provenance.

Amsterdam panoramas provide appearance but not authoritative metric façade
geometry. BAG supplies identity, year and use. 3DBAG supplies wall/roof planes
and height but no windows. Address/unit counts can constrain entrance density.
Monument descriptions and permit drawings are sparse high-quality evidence for
landmarks, not a citywide base layer.

## Extraction stages

1. Cache panorama metadata once and spatially join cameras to BAG/3DBAG walls.
2. Select the least-obstructed camera per visible wall, not merely the nearest
   camera to a footprint centroid.
3. Rectify the wall crop when camera orientation and a 3DBAG wall plane permit
   it. Preserve the original crop beside the rectified derivative.
4. Ask a vision model for the semantic grammar above with strict enums and
   explicit visibility/uncertainty.
5. Human-review a stratified set across typology, construction era, use,
   neighbourhood and confidence.
6. Train opening detectors/segmenters only after the semantic review exposes
   which classes are stable. Window/door instance masks are useful; arbitrary
   whole-image embeddings are not a durable data contract.
7. Build defaults by `(typology, era, use)` for buildings without a usable
   panorama, and record those values as inferred.

## What “every building” means

Not every building needs unique photographic pixels. Every building needs a
complete, deterministic façade grammar. Measured observations fill fields when
available; calibrated archetype defaults fill the rest. A small family of
window, door, shopfront and balcony assets can create convincing variety when
their layout, proportions, colour and depth are building-specific.

## Validation gates

- A crop must show the intended building, not merely a nearby façade.
- Counts are evaluated with exact and ±1 accuracy; categories with per-class
  precision/recall and calibration.
- Train/test splits are by street block or neighbourhood to prevent adjacent
  façades leaking into both sets.
- Review the lowest-confidence, most unusual and most common archetypes.
- No model field becomes “measured”; source and model version remain attached.

## Wide-view pilot — 2026-09-01

The first five BAG targets were fetched from the pinned 2025 mission at a
preferred camera distance of 22 m. One crop per target was not reliable: visual
review found three useful façades, one view aimed along a canal with the target
at the edge, and one view dominated by foliage. Centroid bearing and nominal
camera distance are therefore necessary selection inputs, not evidence that the
intended façade is visible.

The crop manifest now retains up to three candidate views per building from
camera positions at least 5 m apart. The selection order is deterministic
(distance from 22 m, newest capture, panorama ID), records the mission, policy,
camera, bearing, field of view and structured rejection reason, and writes the
manifest atomically. The five-building rerun produced 15 crops with no request
rejections; the alternatives rescued useful views for some obstructed targets,
but the foliage-obscured target remained unusable in all three. The next gate is
therefore an explicit human/model `usable-target-visible` choice across the
candidate group. Do not feed all alternatives to grammar extraction as if each
were independent evidence.

Run `npm run build:facade-view-review` after crop generation. Its local review
sheet groups alternatives by BAG ID and exports one selected panorama (or an
explicit `unusable` result) with evidence quality, occlusion reason and notes.
That exported selection is the only panorama input the grammar classifier
should consume for a building. New buildings start as `unreviewed`: navigation
cannot save them until the reviewer explicitly chooses a quality, exports omit
untouched buildings, and the typed evidence join rejects both `unreviewed` and
unknown runtime values.

A 10-view `qwen2.5vl:7b` visibility-triage pilot did not discriminate the
candidate views: all outputs were 50% confidence and almost all were
`partial/vegetation`, including visibly different clear, wrong-angle and dense
foliage cases. The run stopped there. Machine triage remains an unaccepted audit
hint and can only influence the review sheet's default selection at 70% or
higher; this model/version currently influences none.

`npm run reclassify:facades` now refuses to start without
`--view-labels=<facade-view-human-labels.json>`. The join verifies BAG/building
identity, selected panorama and selected image against the crop manifest,
records unusable and mismatched labels as rejection reasons, and emits a fresh
v2 machine-proposal file. The grammar review sheet consumes that selected crop,
not the earlier nearest-panorama image.

## RGB point-cloud pilot — 2026-09-01

Amsterdam's official Puntenwolk v2 schema advertises public 2024 and 2025 RGB
LAZ metadata with download URL, acquisition date, point count and RD bounds.
The RGB values are added from panorama imagery in post-processing, so this is
an appearance observation rather than a direct material registry. At the time
of the pilot, both live metadata tables and their MVT layers returned empty
collections despite the published schema. No undocumented file URL is pinned.

The geometry half is independently reproducible. `npm run cache:facade-walls`
requests BAG-keyed CityJSONFeatures from the 3DBAG API and extracts only
semantic exterior LoD2.2 `WallSurface` polygons in EPSG:7415. Across the 30
panorama-pilot buildings, 28 returned 255 walls (4–43 per building, median 6),
all with a positive 3DBAG quality indicator. Two BAG objects consistently
returned HTTP 502 after bounded retries and remain structured rejections.

`npm run measure:facade-point-cloud -- --laz=<tile.laz>` decodes an RGB tile,
verifies spatial overlap with the RD+NAP walls, and samples points no more than
12 cm from each wall plane and inside its polygon. It requires at least 80
points and 18% grid coverage, rejects shadowed and mixed-colour walls, and uses
equal-weight 75 cm cell medians so a dense window or scan strip cannot dominate
the wall field. Every result remains an unaccepted `machine-proposal`; source
file hash, sampling policy, point counts and rejection reasons are retained.

PDOK's 3D Basisvoorziening also exposes documented 2025 RGB LAZ tiles for its
20 cm and 8 cm photogrammetric digital surface models. Those downloads solve
the roof-plane input problem, but a DSM represents the top visible surface and
is not substituted for street-level façade evidence. Netherlands3D's public
repositories provide Unity digital-twin loaders and geometry utilities, not an
RGB point-cloud catalog. Amsterdam AI Team's `Urban_PointCloud_Processing` is
the relevant reusable façade method: it fuses street-level LAS with AHN/BGT and
region-grows building façades, but it still requires the municipal street-level
cloud whose current Amsterdam catalog is empty.
