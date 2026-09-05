# Amsterdam façade twin — clean rebuild implementation plan

Status: phases 0–2 implemented; phase-2 local review gate remains open.

## Working lane

```text
worktree  .worktrees/amsterdam-facade-rebuild
branch    feat/amsterdam-facade-rebuild
base      main at 737990d324496f4a367b6b6a53c581c992ae3584
```

This branch starts from `main`, not `feat/amsterdam-building-twin`. The old
feature branch is a source library and incident record only: its valid and
invalid work is interleaved and its worktree has concurrent uncommitted edits.
Do not cherry-pick its façade commits wholesale. Import each audited component
only when the phase that needs it begins, together with tests and provenance.

## Confirmed failure and rebuild rule

The screenshot failure is reproducible for BAG pand `0363100012164989`,
Herengracht 270, using panorama
`TMX7316010203-001543_pano_0000_003628`. The recorded observation is 38.6 m
from the wall and 3.3 degrees off square, yet the current `centre` yaw samples
the foreground building on the camera side. The `edge` convention samples the
intended building across the canal. Generic rectification defaults to
`centre`, while a nearby script comment says that convention points 180
degrees away; one boundary caller supplies no convention at all.

The current registration check cannot settle the discrepancy: it fails under
both conventions, treats redundant collinear BAG vertices as party walls, and
correlates them with noisy roofline steps. It is not part of `check:canal`.

Consequently all current street-derived results are quarantined until
recomputed through a proven camera model: opening rectangles, storeys, bays,
colours, materials, photographic textures, review labels, evidence strips,
and renderer façade extracts. Plausible aggregate statistics do not establish
per-building identity.

## Scope and invariants

```text
BAG address and pand
  -> canonical footprint elevation
  -> suitable panorama and explicit camera model
  -> source-image façade quadrilateral
  -> rectified metric observation
  -> opening/material measurements
  -> reviewed per-pand evidence
  -> renderer extract
```

1. BAG `pand_id` is canonical. OSM may corroborate hand-authored semantics but
   is not the parcel/address authority.
2. Building identity, elevation selection, projection, rectification, and
   feature detection are separate stages with separate tests.
3. A detector or paid vision model cannot certify that a crop belongs to the
   requested pand.
4. Ambiguous elevations and crops are rejected, never repaired with plausible
   façade grammar.
5. A building without certified street evidence renders as massing only.
6. Derived artifacts are invalid after any upstream source, camera, rectifier,
   elevation, or model change unless their complete derivation key matches.
7. Street imagery remains in ignored local caches unless its license and the
   project distribution policy explicitly permit publication.
8. No full-boundary measurement run occurs before the gold registration set
   passes.

## Import and quarantine matrix

### Import early, after re-verification

- Survey boundary and area declarations.
- RD New/WGS84 conversion plus authoritative control-point fixtures.
- BAG footprint adapter and raw BAG responses.
- 3DBAG massing adapter and raw massing responses.
- Panorama metadata adapter and original cached panoramas.
- Evidence, house-record, and calibration types plus unit tests.
- Rijksmonumenten and OSM adapters, with BAG remaining canonical.

Existing checks provide only starting evidence: 54 coordinate checks, 44
boundary checks, and the façade-record, build-record, and calibration-math
checks pass in the old worktree. They must be rerun here. None proves
street-image registration.

### Import only with a valid consumer

- Parameterised gable and façade geometry.
- Blender gable library.
- Runtime façade layer and evidence-inspector interaction patterns.
- Quay/water work, which is independent but not needed for registration.
- Roof-colour work after its separate footprint/rejection issues are resolved.

### Quarantine; never import as evidence

- `measured-facades.json` and derived façade/evidence extracts.
- Existing façade review images and labels.
- Existing photographic textures and material manifest.
- Existing detector accuracy, coverage, and material-distribution claims.
- Existing registration offsets and party-wall correlations.
- Resumable caches keyed only by `pand_id`.

The handcrafted detector remains a benchmark candidate, not a trusted
extractor.

## Target architecture

```text
BuildingIdentity
  pandId, BAG addresses/VBOs, footprint, source versions

Elevation
  stable elevationId, ordered endpoints, outward normal, source vertex range

ElevationCandidate
  street/canal adjacency, address-side, visibility, ambiguity evidence

PanoramaCameraModel
  source id, mission/schema version, yaw origin, heading/pitch/roll convention

RegisteredObservation
  pandId, elevationId, panoramaId, pose, source quad, anchor residuals,
  registration verdict, derivation key

RectifiedObservation
  metric extent, pixels per metre, missing/occluded fractions,
  registration reference, derivation key

FacadeDetection
  masks/boxes, classes, confidence, metric coordinates, model/version

ReviewedFacadeEvidence
  accepted/rejected fields, reviewer/model provenance, calibration result
```

The panorama adapter must supply an explicit camera model. `rectifyFacade`
must have no default yaw convention.

## Phase 0 — clean baseline

1. Record this worktree's exact base SHA and run relevant baseline checks.
2. Add an invalidation record for old street-derived artifacts.
3. Copy or hard-link only allowlisted raw caches into a new ignored namespace,
   preserving source URL, retrieval date, byte hash, and license:
   BAG, 3DBAG, heritage/OSM, panorama metadata, and original panoramas.
4. Do not copy rectified strips, measurements, textures, review data, or
   renderer extracts.

Gate: the clean worktree builds and existing tests pass before façade changes.

## Phase 1 — canonical identity and elevations

1. Add a BAG address/VBO adapter retaining every address for multi-address
   panden.
2. Normalise footprint rings and create stable elevation IDs. Merge collinear
   survey vertices while retaining original vertex ranges.
3. Separate elevation-candidate generation from selection; a minimum rectangle
   may nominate walls but cannot determine the front by itself.
4. Score candidates using independent evidence: BAG public-space association,
   street/quay/canal adjacency, panorama trajectory/visibility, footprint
   occlusion, and OSM geometry as corroboration only.
5. Represent corner and multi-front buildings with multiple elevations.

Deliver typed modules, an address/pand inspection report, and tests for ring
orientation, collinear merging, normals, stable IDs, and multi-front cases.

Gate: every gold fixture resolves to the human-selected pand/elevation;
ambiguous cases return `ambiguous` rather than a guessed wall.

## Phase 2 — registration gold set and review tool

Start with about 16 buildings and expand to 30 before detector evaluation.
Include Herengracht 270 (the 180-degree regression), Prinsengracht 263, Huis met
de Hoofden, Huis Bartolotti, Felix Meritis, both canal banks, all cardinal
directions, a corner building, an irregular footprint, a wide/double house, a
multi-address pand, and partial occlusion.

For each fixture record redistributable structured facts only:

- all addresses and `pand_id`;
- elevation ID and exact RD endpoints;
- panorama ID, capture date, mission, and pose;
- hand-clicked source-pixel anchors for wall limits, ground, eaves, and
  distinctive roofline points;
- identity verdict and reviewer note.

Build a local ignored-image review page with full panorama context, BAG
footprint/elevation inset, projected quadrilateral, metadata, rectified preview,
anchor correction, and explicit rejection. Hide detector boxes during
registration review.

Gate: one recorded local review accepts both pand and elevation for every
fixture. This is the explicit solo-operator checkpoint adopted on 2026-09-05;
reviewer identity, timestamp, both verdicts, and notes remain auditable, and an
uncertain or rejected verdict still fails closed.

## Phase 3 — camera model and rectifier

1. Export pure world-to-camera and camera-to-equirectangular functions.
2. Add synthetic cardinal panoramas pinning north/east/south/west, wrap,
   elevation, pitch, and roll independently.
3. Put yaw origin/orientation in the Amsterdam adapter; support mission-specific
   models only if gold evidence requires them.
4. Remove `centre`/`edge` defaults from generic APIs.
5. Compare projected source pixels directly with gold anchors.
6. Show context beyond wall bounds so lateral shifts cannot hide at crop edges.
7. Validate horizontal and vertical scale separately.

Initial acceptance: 100% correct pand/elevation, median wall-plane anchor error
at most 0.25 m, 95th percentile at most 0.50 m, no unexplained sign/180-degree
errors, and deterministic hashes. Any identity mismatch fails the gate.

## Phase 4 — view selection and registration gate

1. Rank only views geometrically capable of containing the full elevation.
2. Measure wall resolution, not just panorama dimensions or standoff.
3. Calculate occlusion and truncation separately from aesthetics.
4. Retain several passing views and use cross-view agreement as a later signal.
5. Replace party-wall/skyline proxies with anchor tests and conservative
   projected-wall runtime checks.
6. Add registration to `check:canal`.
7. Refuse measurement without a passing verdict and matching derivation key.

Artifact keys include footprint/elevation, panorama bytes/metadata, camera
model, rectifier code/config, detector/model, and source-schema hashes.

Gate: a stratified 50-building set has zero wrong-pand/wrong-elevation crops;
ambiguous and obstructed observations are rejected and reported.

## Phase 5 — facade parsing and opening detector benchmark

Only correctly registered crops enter this phase. Benchmark:

1. the existing handcrafted detector;
2. the CMP **Amsterdam Facade** semantic-segmentation dataset/model;
3. at least two licensed window/door object detectors;
4. at least two licensed opening instance-segmentation models;
5. an ensemble using geometry only as a consistency check.

The [Amsterdam Facade dataset](https://universe.roboflow.com/cmp-zosci/amsterdam-facade)
is a particularly useful domain-matched baseline and pretraining source. Its
909 images label `building`, `door`, `window`, and `sky`, which can support
facade/crop-quality masks and coarse opening parsing. Version 1 uses semantic
segmentation with 818 training images, 91 validation images, and no held-out
test set. It therefore cannot by itself measure generalisation, and its class
pixels do not distinguish touching openings as separate instances. Before use:

- verify original image and annotation provenance, not only the Roboflow host;
- record the stated CC BY 4.0 license and required attribution;
- audit duplicate/near-duplicate images and related views;
- create a provenance-grouped external test set;
- evaluate transfer from curated/rectified imagery to noisy municipal
  panoramas with blur, trees, vehicles, reflections, and obliquity.

Use it for semantic pretraining, crop-quality checks, and an honest baseline;
do not use it as registration truth or assume it is the final instance-level
extractor. Prior Amsterdam façade-parsing research also reports dataset bias
and poor cross-dataset transfer, reinforcing the need for a project-specific
held-out evaluation.

For every external source record URL/owner, explicit license, image count,
class semantics, annotation type/quality, split method, weights and architecture
version, and preprocessing that might distort proportions. Published metrics
are leads, not acceptance evidence.

### Project-specific Amsterdam labels

Build a private/local dataset from certified observations, initially 100–200
corrected crops, with:

- window;
- door;
- shopfront;
- souterrain window;
- façade boundary;
- occlusion/unknown.

Split by pand, street/block, and mission; never put multiple views of one pand
across train and validation/test. Prioritise uncertain and disagreeing samples,
fine-tune a compact segmentation model, and repeat against held-out blocks.

Report per-class precision/recall and AP, mask IoU, exact opening-count
accuracy, metric centroid/boundary error, false openings per square metre,
performance by imaging condition/facade type, and cross-view consistency. Never
calculate detector metrics on failed registrations.

Gate: select the production detector from held-out project data. Fields below
their calibrated threshold remain unobserved/defaulted.

## Phase 6 — paid multimodal verification

Use paid vision-language models as independent critics and triage tools, not
geometric ground truth. Require terms compatible with the panorama license,
acceptable retention/training controls, pinned model identifiers, structured
JSON with `uncertain`, and stored prompt/image hash/response/time/cost metadata.

Use two blind passes:

1. clean crop: judge whether one facade dominates, rectification quality,
   visible opening counts, obstruction, and truncation;
2. overlay critique: inspect detector masks for false positives, misses, class
   mistakes, and boundary errors.

Do not show one model another model's answer. Send disagreements to a second
independent model and unresolved cases to a human. Audit 100% of gold fixtures,
the first 50 and 200 rollout buildings, all disagreements/low-confidence cases,
a random accepted sample, and a deliberate high-confidence sample. Calibrate
every judgement type against human labels before it can affect confidence.

## Phase 7 — staged rollout

```text
gold fixtures -> 50 stratified buildings -> 200 buildings -> one canal block
-> full pilot boundary
```

At each stage emit registration/rejection statistics, per-field metrics,
model-human disagreement, per-pand dossiers, clean/overlay contact sheets, and
data/renderer diffs. Rejected observations remain massing-only.

## Phase 8 — renderer and facade vocabulary

Only after the 200-building evidence gate:

1. implement/import the renderer against versioned records;
2. import gable/parts geometry with independent tests;
3. render accepted masks/boxes as openings;
4. retain heritage claims with distinct provenance;
5. retain massing-only fallback;
6. regenerate textures/materials only from certified observations;
7. verify real Canal Recall viewpoints.

The evidence inspector shows address/pand, elevation/footprint, panorama context
and projected quad, clean rectification, detections/confidence, review history,
and exact source/derivation versions.

## Continuous gates

Add and then integrate:

```text
test:facade-identity
test:facade-elevations
test:facade-camera-model
test:facade-rectification
test:facade-registration
test:facade-lineage
test:facade-detector-benchmark
test:facade-evidence-integrity
```

The integration gate fails for implicit camera conventions, excess anchor
error, wrong pand/elevation, stale lineage, rendered openings without accepted
evidence, undocumented model/dataset licensing, or staged review imagery.

## Planned commit sequence

1. clean baseline and invalidation record;
2. BAG address identity and elevation schema;
3. gold fixtures and ignored-image review tool;
4. camera model plus synthetic/anchor tests;
5. conservative multi-elevation frontage resolution;
6. registration gate and derivation-keyed artifacts;
7. detector benchmark and dataset/license manifests;
8. Amsterdam labels and segmentation fine-tuning experiment;
9. paid-model audit harness and calibration report;
10. 50-building gate;
11. 200-building gate;
12. renderer/vocabulary against certified records;
13. pilot boundary and final QA report.

Keep commits small, independently reviewable, and accompanied by state/history
updates. Generated browser bundles belong only in commits that change runtime
code.

## First implementation checkpoint

Stop after phases 0–2 and return for review with baseline results, an
import/quarantine manifest with hashes, the BAG address/elevation model, the
gold-building list, and a registration review page populated with Herengracht
270 plus contrasting fixtures.

Do not change the camera convention or run a detector before that checkpoint.
First confirm that the rebuilt pipeline asks the right identity and elevation
questions.
