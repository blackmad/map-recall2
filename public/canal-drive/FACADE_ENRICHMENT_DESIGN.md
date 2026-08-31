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
