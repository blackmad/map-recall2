# Amsterdam façade twin — clean rebuild implementation plan

Status: proposed for review. No rebuild worktree has been created and no
implementation in this plan has started.

## Decision

Start a new worktree and branch from current `main`, not from
`feat/amsterdam-building-twin`:

```text
worktree  .worktrees/amsterdam-facade-rebuild
branch    feat/amsterdam-facade-rebuild
base      main (737990d when this plan was written)
```

The existing feature branch is useful as a source library and incident record,
not as the rebuild's base. It is 23 branch commits ahead of its merge base and
144 mainline commits behind current `main`; its valid and invalid work are
interleaved, and its worktree currently contains unrelated uncommitted changes.

Do not cherry-pick the 23 façade commits wholesale. Import an audited component
only when the phase that needs it begins, with its tests and provenance in the
same commit.

## Why the rebuild is necessary

The failure in the review screenshot is reproducible:

- BAG pand `0363100012164989`, Herengracht 270, was measured from panorama
  `TMX7316010203-001543_pano_0000_003628`.
- The recorded view is 38.6 m from the wall and 3.3 degrees off square.
- The current `centre` yaw convention samples the foreground building on the
  camera's side instead of the target across the canal.
- The `edge` convention samples the intended Herengracht 270 façade.
- `rectify.ts` defaults to `centre`, while `rectify-facades.ts` contains a
  nearby comment saying that `centre` points 180 degrees away.
- The boundary runner does not pass an explicit camera convention, so its
  output inherits the unsafe default.

The existing registration check cannot arbitrate this. It fails under both
conventions and treats redundant collinear BAG footprint vertices as visual
party walls before correlating them against noisy roofline steps. It is also
not part of `check:canal`, so city-scale extraction continued while the check
was red.

Therefore every current street-level-derived result is invalid until
recomputed through a proven camera model. This includes opening rectangles,
storey/bay readings, wall colours, façade material assignments, photographic
textures, review samples, evidence strips, and façade sections in renderer
extracts. Aggregate agreement with citywide medians does not establish
per-building identity.

## Scope and invariants

This rebuild covers the evidence path:

```text
BAG address and pand
  -> canonical footprint elevation
  -> suitable panorama and camera model
  -> source-image façade quadrilateral
  -> rectified metric elevation
  -> opening/material measurements
  -> reviewed per-pand evidence
  -> renderer extract
```

The following invariants are non-negotiable:

1. BAG `pand_id` is canonical. OSM may corroborate hand-authored semantics but
   is not the parcel or address authority.
2. Building identity, elevation selection, projection, rectification, and
   feature detection are separate stages with separate tests.
3. A detector or vision model cannot certify that a crop belongs to the
   requested pand.
4. An ambiguous elevation or crop is rejected. It is never repaired by a
   plausible façade grammar.
5. A building with no certified street observation renders as massing only.
6. No derived artifact survives a change to any upstream source, camera model,
   rectifier, or elevation definition without an explicit cache-key match.
7. Street imagery stays in ignored local review/cache directories unless its
   license and the project's distribution policy explicitly permit publishing
   it.
8. No full-boundary measurement run occurs before the gold registration set
   passes.

## Import and quarantine matrix

### Import early after re-verification

- Survey-area declarations and boundary geometry.
- RD New/WGS84 conversion and its authoritative control-point fixtures.
- BAG footprint adapter and cached raw BAG responses.
- 3DBAG massing adapter and cached raw massing responses.
- Panorama metadata adapter and cached original panorama files.
- Evidence, house-record, and calibration data types and their unit tests.
- Rijksmonumenten and OSM source adapters, with BAG remaining canonical.

Existing checks currently give useful starting evidence: 54 coordinate checks,
44 boundary checks, the façade-record checks, build-record checks, and
calibration-math checks pass. These checks will be rerun on the new branch; a
pass here does not imply that street-image registration passes.

### Import only when a valid consumer exists

- Parameterised gable and façade geometry.
- Blender gable library.
- Runtime façade layer and evidence inspector interaction patterns.
- Quay/water work, because it is independent of street-level extraction but is
  not needed to prove registration.
- Roof-colour work after its separate footprint-area and rejection issues are
  resolved.

### Quarantine; never import as evidence

- `measured-facades.json` and every derived façade/evidence extract.
- Current façade review images and labels.
- Current photographic façade textures and material manifest.
- Current detector accuracy, coverage, and material-distribution claims.
- Current registration offsets and party-wall correlation results.
- Resumable caches keyed only by `pand_id`.

The handcrafted detector remains a candidate baseline. It is not imported as a
trusted extractor until it has been run against correctly registered crops.

## Proposed architecture

Keep the stages explicit in code and data rather than sharing one mutable
`MeasuredFacade` structure across the pipeline.

```text
BuildingIdentity
  pandId, BAG addresses/VBOs, footprint, source versions

Elevation
  stable elevationId, ordered endpoints, outward normal, source vertex range

ElevationCandidate
  evidence for street/canal adjacency, address side, visibility, ambiguity

PanoramaCameraModel
  source id, mission/schema version, yaw origin, heading/pitch/roll convention

RegisteredObservation
  pandId, elevationId, panoramaId, pose, projected source quad,
  anchor residuals, registration verdict, derivation key

RectifiedObservation
  metric extent, pixels per metre, missing/occluded fractions,
  registration reference, derivation key

FacadeDetection
  masks/boxes, classes, confidences, metric coordinates, model/version

ReviewedFacadeEvidence
  accepted/rejected fields, reviewer/model provenance, calibration result
```

The panorama adapter must provide a camera model explicitly. `rectifyFacade`
must not have a default yaw convention.

## Phase 0 — create the clean lane and establish a baseline

1. Create the new worktree and branch from current `main`.
2. Record the exact base SHA and run the relevant baseline checks.
3. Add an invalidation note preventing current street-derived artifacts from
   being interpreted as evidence.
4. Copy or hard-link only allowlisted raw caches into a new ignored raw-cache
   namespace, preserving source URLs, retrieval dates, byte hashes, and
   licenses:
   - BAG registry JSON;
   - 3DBAG massing JSON;
   - heritage and OSM source JSON;
   - panorama metadata JSON;
   - original panorama JPEGs.
5. Do not copy rectified strips, measurements, material textures, review data,
   or renderer extracts.

Gate: the new worktree builds and its pre-existing tests are green before any
façade code changes.

## Phase 1 — canonical identity and elevation records

1. Add a BAG address/VBO adapter and materialise address-to-pand relationships.
   Preserve all addresses for multi-address panden instead of choosing one.
2. Normalise footprint rings and create stable elevation IDs. Merge collinear
   survey vertices into a single elevation while retaining the original vertex
   range for traceability.
3. Separate candidate generation from elevation selection. Minimum-rectangle
   plot width may nominate candidates but cannot identify the front by itself.
4. Score candidates using independent evidence:
   - BAG address/public-space association;
   - adjacency to the addressed street, quay, or canal;
   - panorama trajectory and visibility;
   - footprint occlusion;
   - OSM street geometry as corroboration only.
5. Represent corner buildings and buildings with multiple public fronts as
   multiple elevations. Do not force one building-wide `front`.

Deliverables:

- typed identity/elevation modules;
- an address/pand inspection report;
- unit tests for ring orientation, collinear merging, normals, stable IDs, and
  multi-front buildings.

Gate: every building in the gold set resolves to the human-selected pand and
elevation; ambiguous cases return `ambiguous`, not a guessed wall.

## Phase 2 — registration gold set and review tool

Create an initial gold set of approximately 16 buildings, expanding to 30
before detector evaluation. It must include:

- Herengracht 270, the reproduced 180-degree regression;
- Prinsengracht 263;
- Huis met de Hoofden;
- Huis Bartolotti;
- Felix Meritis;
- typical narrow canal houses on both banks;
- north-, east-, south-, and west-facing elevations;
- a corner building;
- an irregular/L-shaped footprint;
- a wide or double house;
- a building with several BAG addresses;
- a partially occluded façade.

For each fixture, record only redistributable structured facts:

- address set and `pand_id`;
- elevation ID and exact RD endpoints;
- panorama ID, capture date, mission, and pose;
- manually clicked source-pixel anchors for left/right wall limits, ground,
  eaves, and distinctive roofline points;
- an identity verdict and reviewer note.

Build a local, ignored-image review page showing:

- full panorama context;
- BAG footprint and selected elevation inset;
- projected façade quadrilateral;
- address, pand, camera, and source metadata;
- a rectified preview;
- controls to correct anchors and reject ambiguity.

Do not show detector boxes during registration review.

Gate: two review passes agree on pand and elevation for every gold fixture.

## Phase 3 — camera model and rectifier

1. Make world-to-camera and camera-to-equirectangular projection pure exported
   functions.
2. Add synthetic cardinal panoramas that independently pin north/east/south/
   west, horizontal wrap, elevation, pitch, and roll.
3. Move yaw origin and orientation conventions into the Amsterdam panorama
   adapter. Allow mission-specific camera models if the gold data demonstrates
   that missions differ.
4. Remove all `centre`/`edge` defaults from generic rectification APIs.
5. Compare predicted source pixels directly with the gold anchors. Do not infer
   registration from whether the resulting image resembles a façade.
6. Render context outside the target wall during diagnostics so a one-building
   lateral shift cannot hide at the crop boundary.
7. Validate horizontal and vertical scale independently.

Initial acceptance targets:

- 100% of gold observations point toward the correct pand and elevation;
- median anchor residual at most 0.25 m in the wall plane;
- 95th-percentile anchor residual at most 0.50 m;
- no unexplained mission-specific 180-degree or sign errors;
- deterministic output hashes for a fixed source image and configuration.

Any identity mismatch fails the gate regardless of aggregate residuals.

## Phase 4 — view selection and registration gate

1. Rank only views whose geometry can contain the complete target elevation.
2. Measure resolution at the wall, not merely panorama dimensions or camera
   standoff.
3. Calculate occlusion and truncation independently from image aesthetics.
4. Retain several candidate views per elevation; use cross-view agreement as a
   quality signal after each view passes registration.
5. Replace the current party-wall/skyline proxy with direct gold-anchor tests
   and conservative runtime checks on projected wall limits.
6. Add a mandatory registration command to `check:canal`.
7. Make every measurement command refuse to operate on observations without a
   passing registration verdict and matching derivation key.

Every artifact key must include hashes or versions for:

- footprint/elevation;
- panorama bytes and metadata;
- camera model;
- rectifier implementation/configuration;
- measurement or detector model;
- source schema versions.

Gate: a stratified 50-building set contains no wrong-pand or wrong-elevation
crop. Ambiguous and obstructed observations are rejected and reported.

## Phase 5 — opening detector benchmark

Only correctly registered crops enter this phase.

### Candidate systems

Benchmark, rather than assume:

1. the existing handcrafted detector;
2. at least two licensed Roboflow/YOLO object-detection models;
3. at least two licensed window instance-segmentation models;
4. a small ensemble that uses geometry only as a consistency check.

Instance segmentation is preferred for the production measurement path because
masks can represent arches, clipped openings, and non-rectangular shopfronts.
Boxes remain a useful fast baseline.

Before downloading or training from any Universe project, record:

- dataset URL and owner;
- explicit license (no license means do not use it);
- image count and class definitions;
- annotation type and visible annotation quality;
- train/validation/test split method;
- model architecture/version and whether weights are downloadable;
- preprocessing that may distort façade proportions.

The initial external candidates include the CC BY 4.0, 4,785-image Doors and
Windows dataset and the larger window/door and instance-segmentation projects
identified during reconnaissance. Their published metrics are leads, not
acceptance evidence.

### Amsterdam labels and fine-tuning

Create a private/local Amsterdam dataset from certified rectified observations.
Begin with 100–200 corrected crops and these labels:

- window;
- door;
- shopfront;
- souterrain window;
- façade boundary;
- occlusion/unknown.

Split by pand, street/block, and panorama mission. Never place different views
of the same pand in both train and validation/test sets.

Use active learning:

1. run external candidates;
2. label disagreements and uncertain cases first;
3. fine-tune a compact segmentation model locally;
4. repeat against a held-out block-level test set.

Report both computer-vision and building-domain metrics:

- precision/recall and box/mask AP per class;
- mask IoU;
- exact opening-count accuracy per façade;
- centroid and boundary errors in metres;
- false openings per square metre;
- performance by resolution, obliquity, occlusion, material, and storey;
- cross-view consistency for the same elevation.

No metric may be calculated on crops that fail registration.

Gate: choose the production detector from held-out Amsterdam results, not the
model's original dataset score. Fields that do not meet their calibrated bar
remain unobserved/defaulted.

## Phase 6 — paid multimodal-model verification

Use paid vision-language models as independent critics and triage systems, not
as geometric ground truth.

Provider requirements:

- image input under terms compatible with the Amsterdam panorama license;
- an API mode with acceptable retention/training controls;
- pinned model identifier/version where available;
- structured JSON output and an explicit `uncertain` outcome;
- stored prompt, image hash, response, timestamp, and cost metadata.

Use a blind two-pass protocol:

1. **Clean crop pass:** determine whether one façade dominates, whether it is
   straight enough, count visible openings, and list obstruction/truncation.
2. **Overlay critique pass:** inspect detector masks and explain false positives,
   misses, class errors, or boundary errors.

Do not show model B the answer from model A. Use a second independent paid model
for disagreements and a human for unresolved cases.

Audit policy:

- 100% of registration gold fixtures;
- 100% of the first 50- and 200-building rollout samples;
- every detector/geometry/model disagreement;
- every low-confidence or ambiguous observation;
- a random sample of accepted observations;
- a deliberate sample of the highest-confidence observations, where hidden
  overconfidence is most dangerous.

Calibrate each model's judgements against human labels. A paid model's agreement
does not lift confidence until its field-level accuracy is known.

## Phase 7 — staged rollout

Roll out in increasing, reviewable batches:

```text
gold fixtures -> 50 stratified buildings -> 200 buildings -> one canal block
-> full pilot boundary
```

At each stage produce:

- registration coverage and rejection reasons;
- per-field detector metrics;
- paid-model and human disagreement report;
- per-pand evidence dossiers;
- a contact sheet of clean crops and overlays;
- data and renderer diffs from the preceding stage.

Do not count a rejected observation as a detector failure or silently replace
it with generated façade details. It remains massing-only.

## Phase 8 — renderer and façade vocabulary

Only after the 200-building evidence gate passes:

1. import or reimplement the façade renderer against the new versioned records;
2. import the gable/parts library with its independent geometry tests;
3. render measured masks/boxes as architectural openings;
4. retain heritage-stated features with distinct provenance;
5. retain massing-only fallback for every uncertified elevation;
6. regenerate materials and textures solely from certified observations;
7. verify the real Canal Recall runtime at named viewpoints.

The evidence inspector should show, for every rendered feature:

- address and pand;
- selected elevation and footprint;
- panorama context and projected quad;
- clean rectified crop;
- detector masks and confidence;
- paid-model/human review history;
- exact source and derivation versions.

## Tests and continuous gates

Add focused commands before folding them into `check:canal`:

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

The integration gate must fail when:

- a camera convention is implicit;
- a gold anchor exceeds tolerance;
- an observation points at another pand/elevation;
- a derived artifact has a stale lineage key;
- a rendered opening lacks accepted evidence for that exact pand/elevation;
- a model/dataset lacks recorded licensing and version information;
- review imagery is accidentally staged for publication.

## Planned commit sequence

Keep commits small and independently reviewable:

1. establish clean worktree baseline and invalidation record;
2. add BAG address identity and canonical elevation schema;
3. add gold registration fixtures and ignored-image review tool;
4. replace camera model and add synthetic/real anchor tests;
5. implement conservative multi-elevation frontage resolution;
6. add registration gate and derivation-keyed artifacts;
7. add detector benchmark and dataset/license manifests;
8. add Amsterdam labels and fine-tuned segmentation experiment;
9. add paid-model audit harness and calibration report;
10. pass the 50-building review gate;
11. pass the 200-building review gate;
12. import the renderer/vocabulary against certified records;
13. run the pilot boundary and publish the final QA report.

Each commit updates the relevant state/history document and includes generated
browser bundles only when it changes runtime code.

## First implementation checkpoint

After approval of this plan, stop after phases 0–2 and return for review with:

- the clean worktree and branch;
- baseline test results;
- the import/quarantine manifest with hashes;
- the BAG address/elevation data model;
- the proposed gold-building list;
- the registration review page populated with Herengracht 270 and several
  contrasting fixtures.

Do not change the camera convention or run a detector at that checkpoint. The
review should first confirm that the new pipeline is asking the right identity
and elevation questions.
