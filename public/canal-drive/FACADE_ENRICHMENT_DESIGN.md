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

## Cross-model grammar agreement — 2026-09-02

The first multi-model grammar run asked two vision models
(`google/gemini-3.1-pro-preview`, `anthropic/claude-sonnet-4.6`) for the full
enum grammar on 6 cached Amsterdam panorama crops, at a strict JSON schema,
temperature 0, for $0.117. It reported **0 of 6 buildings auto-eligible**, and
stopped there.

That number carried no information. It does not distinguish models disagreeing
about brick versus stone from models disagreeing about whether a façade has four
bays or five. `npm run measure:facade-grammar-agreement` re-derives consensus
from the stored labels through the current normalizer and reports agreement per
field. It spends nothing — every label is read from the cached proposal file —
and it re-normalizes first, because the stored labels predate the fix that maps a
provider's `"unknown"` count onto `null` and so understate agreement.

Exact agreement across the 6 comparable buildings:

| Field | Agree | Informative | Both abstained | Within ±1 |
|---|---|---|---|---|
| `targetVisible`, `ornament`, `windowFrameColour` | 6/6 | 6 | 0 | — |
| `windowPattern`, `groundFloorType`, `facadeMaterial`, `facadeColour` | 5/6 | 5 | 0 | — |
| `visibleStoreys` | 4/6 | 4 | 0 | 2 of 2 disagreements |
| `windowRecess`, `entranceType` | 4/6 | 4 | 0 | — |
| `windowToWall`, `balconyType`, `groundFloorDistinct` | 3/6 | 3 | 0 | — |
| `facadeComposition` | 2/6 | 2 | 0 | — |
| `bayCount` | 2/6 | **1** | 1 | **0 of 4 disagreements** |
| `roofline` | 4/6 | **1** | 3 | — |

Two findings change the gate.

**`roofline` looks reliable and is not.** Its 4/6 exact agreement is three cases
of both models answering `not-visible`. A street-level crop taken 22 m from a
canal house usually cannot see the roof at all. Counting mutual abstention as
agreement makes the blindest field in the grammar look like one of the strongest,
which is why the measurement reports informative agreement separately. Roofline
belongs to the nadir/DSM lane this branch already built, not to a street-level
gate.

**`bayCount` is genuinely unreliable, not nearly right.** It has one informative
agreement in six, and *zero* of its four disagreements fall within ±1: the models
read different façade rhythms rather than miscounting the same one. `visibleStoreys`
is the opposite — it disagrees twice, and both disagreements are ±1.

So the original 5-field gate required `bayCount` and `roofline`, the two fields
street-level evidence least supports, and therefore passed nothing. Measured
alternatives on the same cached run:

| Gate | Auto-eligible |
|---|---|
| `visibleStoreys, bayCount, windowPattern, groundFloorType, roofline` (original) | 0/6 |
| `facadeMaterial, facadeColour, windowPattern, groundFloorType` | 4/6 |
| …plus `visibleStoreys` exact | 2/6 |
| …plus `visibleStoreys` within ±1 | 4/6 |

The fields that survive are the appearance fields — material, colour, window
pattern, ground-floor treatment — which is what building enrichment actually
needs from a façade. Counts and roofline should abstain by default and be filled
from 3DBAG height and the roof lane instead of from a photograph.

Two limits on this result. **n = 6 is a pilot, not coverage**: no cell in that
table is worth more than one significant figure, and a stratified sample across
typology and era is the next thing to buy. **Agreement is not accuracy**: two
models trained on overlapping data can be confidently wrong together, so a
labelled human review remains the only thing that can promote any of these
fields past `machine-proposal`. Nothing here is accepted evidence.

### The view-selection gate is still missing

This document specifies that grammar extraction consumes one *human-selected*
panorama per building, and that `reclassify:facades` refuses to run without the
view-label export. That machinery — `build-facade-view-review.ts`,
`check-facade-view-selection.ts`, `facadeView.ts`, `facadeEvidence.ts` — was
removed by the revert in `24c8beb` and has not been restored. The crop manifest
this branch regenerates is one nearest-camera view per building with no review
fields, and the earlier wide-view pilot already measured why that is not enough:
of five targets, one aimed along a canal and one was lost to foliage.

`extract:facade-grammar` therefore now records `policy.panoramaSelection` as
`nearest-camera-unreviewed` unless every manifest item carries a reviewer's
`evidenceQuality` and `reviewedAt`, and says so on stdout. Classifying unreviewed
crops is still useful for measuring the gate; recording them as though a reviewer
had chosen them would not be. Restoring view selection is a precondition for any
stratified sample, because otherwise the sample measures camera aim as much as it
measures façades.

## The pilot was mostly photographing sheds — 2026-09-02

Measuring the agreement above raised an obvious question that the agreement
numbers could not answer: *were the two models even looking at the same
building?* They were not, because for five of the six targets there was no
target building to look at.

Footprint area and height for the six pilot targets, from the same extract the
crops were selected from:

| Target | Footprint | Height | Longest edge |
|---|---|---|---|
| `w274039950` | 134 m² | 17.7 m | 10.5 m |
| `w1388560103` | 112 m² | **3.7 m** | 34.4 m |
| `w1412702187` | 18 m² | 3.0 m | 6.3 m |
| `w282294826` | **7 m²** | 2.5 m | 2.9 m |
| `w282294463` | 7 m² | 3.0 m | 3.3 m |
| `w1475011497` | **1 m²** | 3.0 m | 7.1 m |

One of the six is a building. `w282294826`, a 7 m² box 2.5 m tall, was the
anchor the procedural block demo was built around. `w1475011497` covers one
square metre.

This is not a sampling accident. `buildings-colored.geojson` is filtered by
appearance, not by building-ness: across its 10,578 features the **median
footprint is 18 m² and the 10th percentile is 6 m²**, and 62.6% are under 40 m²
or under 4 m tall. Sheds, kiosks, canopies, dormers and fragments are the
typical member. `LOD.md` already records that this file must never be treated as
the complete set of mapped OSM buildings; this is the measurement of how far it
is from being one.

It also explains the labels. Both models returned `targetVisible: true` at
0.8–0.9 confidence on every one of the six, and they were not lying: a panorama
aimed at a 1 m² object does show a façade — the façade of whatever stands
behind it. Two models have no reason to pick the same neighbour, which is
exactly the disagreement pattern the agreement table found. **A `targetVisible`
field cannot catch this**, because the failure is that the target has no façade,
not that the camera missed it.

### What this corrects

The earlier section concluded that `bayCount` is unreliable because the models
read different façade rhythms. That conclusion is now only partly supported: the
models were substantially reading *different buildings*. What survives is the
narrower and better-evidenced claim — a street-level crop cannot see a roofline
(3 of 6 mutual `not-visible`), and gating on the fields a photograph does supply
is better than gating on counts. What does **not** survive is any estimate of how
well two models agree about one façade. That number has not been measured yet,
because it has not yet been asked on a set of real buildings.

### The gate

`judgeFacadeTarget` in `facadeTarget.ts` decides whether a footprint can show a
façade before a panorama is requested: at least 40 m², at least 4 m tall, and at
least one edge 5 m wide, with structured reasons (`footprint-too-small-for-a-facade`,
`too-short-for-a-facade`, `no-measured-height`, `no-edge-wide-enough-to-photograph`,
`degenerate-footprint`). A missing height rejects rather than passing silently: an
unmeasured building is not a small one.

`npm run test:facade-target` pins all six pilot targets as named regressions with
their expected verdict and reason, and asserts the gate both rejects the
small-structure majority and keeps a usable pool. It currently keeps **3,694 of
10,578 targets (34.9%)**, which is large enough to draw a stratified sample from.
`build:facade-review` applies the gate before spending any request and records
`selection.facadeTargetPolicy` and the rejected targets in its manifest.

The order of work is now clear: gate targets, restore view selection, *then* buy
a stratified sample. Re-running the grammar pilot before those two would measure
camera aim and footprint noise again rather than façades.

### The gate, run against the live panorama API

`npm run build:facade-review -- --output=.cache/facade-review-gated --limit=8`
rejected **6,884 targets before making a single request** — 6,358
`footprint-too-small-for-a-facade`, 265 `no-edge-wide-enough-to-photograph`, 261
`too-short-for-a-facade` — and then needed 16 attempts to find 8 usable crops,
the other 8 failing on `no-panorama-in-radius` at 45 m.

Every one of the eight is a building:

| Target | Footprint | Height | Longest edge |
|---|---|---|---|
| `w269088173` | 670 m² | 18.0 m | 28.7 m |
| `w267107855` | 193 m² | 20.3 m | 34.7 m |
| `w1421415127` | 152 m² | 9.0 m | 16.2 m |
| `w274039950` | 134 m² | 17.7 m | 10.5 m |
| `w1424410003` | 112 m² | 12.7 m | 34.4 m |
| `w1422806621` | 54 m² | 6.0 m | 7.5 m |
| `w461751590` | 51 m² | 9.0 m | 9.4 m |
| `w1312162783` | 49 m² | 9.0 m | 10.4 m |

Against the original pilot's 1 m², 7 m² and 18 m² targets, this is the set the
grammar questions were always meant to be asked about. It is a crop set, not a
sample: the selection is still a deterministic hash order rather than a
stratification by typology and era, and view selection is still unreviewed. Both
remain prerequisites before spending on another extraction run.
