# OccFacade local pilot — 2026-09-27

Result: runs on Apple M4 Pro MPS, useful full-facade proposals, **not accepted
for production openings or direct wall-colour sampling**. No training or paid
inference API was used.

## Reproduce

Upstream: https://github.com/yueyisui/OccFacade at
`ad225905` (full revision recorded in receipt). ENPC2014 checkpoint from the
README's public weight folder:
https://drive.google.com/file/d/1U_-kyk2-2q9SLWGctNcYZ_JxjMeROEbG/view
SHA256: `2b2a5e532ea3bcbeaba09d3264dd5410e9ad8fa0fee09d8ec43e4b4d36fdd8cb`.
Do not commit downloaded weights or photo evidence.

```sh
.cache/roofline-eval/venv/bin/python scripts/facade-eval/run_occfacade.py \
  --repo .cache/model-research/OccFacade-sol \
  --checkpoint .cache/model-research/weights/occfacade-enpc.pth \
  --manifest .cache/facade-assessment/cohort.json \
  --out .cache/facade-assessment/occfacade-v2
```

Runner uses torch/numpy/Pillow already installed in this isolated environment.
It bypasses the upstream CUDA-only prediction launcher and missing VOC
initialization file, loads epoch-300 active weights strictly, and records the
inactive legacy `window_conv.*` keys excluded from this MRC-enabled network.
It does not silently accept absent active weights. Original source hashes are
verified before inference. It writes raw class-ID PNGs at source dimensions,
overlays, predicted wall-photo samples, provenance, timings and an HTML gallery.
Existing output directories are rejected to preserve evidence.

Labels from upstream ENPC config: background, door, shop, balcony, window, wall,
sky, roof. Preprocessing: RGB /255, bicubic letterbox to 512×512, grey padding;
softmax probabilities cropped to remove padding, bilinearly resized to original
image dimensions before argmax. No crop stretching or ImageNet normalization.

## Measured result

20 crops: full + ground images for manifest indices
`0,1,3,10,11,13,17,30,52,64`. These are existing manifest associations, not newly
verified physical building identities. Runtime torch 2.14.0, 47,099,656 active
architecture parameters; median GPU forward 0.814572 seconds, initial warmup
3.476464 seconds. Timing excludes image I/O and CPU postprocessing; concurrent
local workers may affect throughput. Checkpoint download ~542 MiB, including
training optimizer state; download/load excluded.

One failing crop (`000-ground`) was rerun on CPU: 48.69 seconds forward and
**100% class-label agreement** with MPS. Its failure is not an Apple GPU numerical
artifact. This is a one-image backend parity check, not a quality score.

Evidence: `.cache/facade-assessment/occfacade-v1/{receipt,cpu-parity}.json`.
Gallery: http://localhost:5195/data/facade-review-galleries/occfacade-v1/index.html
Published local evidence copy: `public/data/facade-review-galleries/occfacade-v1/`.
Both desktop (1440px) and mobile (390px) loaded 20 cards / 80 images without
broken images, horizontal overflow or JavaScript errors.

## Visual findings and decision

- Da Costakade 13 full view: upper window positions are broadly useful, but
  sill strips are called balconies, and the red entrance doors are windows.
  The ground close-up fragments these doors and invents additional repeated
  window/balcony patches.
- Index 11 full view: major window rows and wall areas are recovered, but window
  groups merge and the base is called shop. On the heavily tree-covered ground
  image, many tree pixels become wall or invented openings.
- Index 13: the plain wall and upper openings are useful in the full view; the
  ground view labels portions of the skip, paving and unrelated pixels as wall.
- Index 1: overexposure damages the wall/sky boundary; ground doors are largely
  missed/misclassified, and the parked car contributes predicted wall pixels.
- Index 30: ornamental gable portions become sky; foliage becomes wall.
  Follow-up inspection of the original context image confirms full/ground show
  the same white gabled facade (arched lower opening, shrubs, utility boxes).
  Consecutive 2025 panoramas and different crop heights explain the apparent
  architectural difference. This resolves photo correspondence, not BAG ownership.
- Independent Sol review of indices 3, 10, 17, 52 and 64 found the same scale
  sensitivity: useful upper-window rhythm in full views, missed entrances and
  pavement/cars labeled shop in ground views. Index 52's black doors become
  windows; index 10's lettering becomes roof/shop. The reviewer also checked
  preprocessing and all active checkpoint keys; 70 inactive legacy keys were
  excluded explicitly.

There is no vegetation/car class in this checkpoint. Its occlusion-completion
behavior is incompatible with using every predicted wall pixel as observed
masonry. Softmax confidence cannot establish physical visibility or correctness.
The exported RGB median is diagnostic photo colour, not accepted material colour.
The shop class is not evidence of commercial use, and roof class is not a 3D
roofline. No ground-truth masks were annotated; no IoU/accuracy claim is made.

Next useful experiment: full-facade inputs only, retain proposals with source
identity and observed support, intersect wall proposals with an independently
validated visible-surface/occluder mask, then compare a small manually annotated
opening/wall set against the existing detector. Reject ground-only inference as
a replacement. Keep original crop coordinates when extracting ground predictions
from the full-facade output. No appearance or geometry has been published to the
game from this pilot.


## Follow-up: full-view cohort and same-capture context test

Processed all 100 full-view cohort images with OccFacade and the already-pinned
local Mapillary Vistas Mask2Former. All 100 intersected masks contain some pixels;
this is coverage, not correctness. Median removal is 12.35% of OccFacade wall
pixels; nine cases lose more than half. OccFacade median forward in this batch
was 0.393 seconds (different concurrent load/warmup from the initial pilot).

`compare_occfacade.py` validates exact source, mask and provenance hashes before
intersecting OccFacade wall (5) with Vistas building (2). The gallery preserves
source, both separate masks and the intersection. Native-image auditing of all 100 cases is recorded with image+mask hashes in
`review-data/facade-assessment/occfacade-wall100-review.json`. Twenty cases have
combined photo medians withheld; the remaining 80 have limited evidence, not
accepted colour. Stale or duplicate reviews fail rather than applying to a new
image/mask. The first 19-case checkpoint withheld four; the completed pass adds
81 reviews and brings the total to 20 withheld. Four model reviewers performed
the visual work; these are qualitative observations, not ground-truth labels.
Previously reviewed material presets in the opt-in demo are unaffected; zero
**new** game colours were accepted from this experiment.

The intersection removes large trees and vehicles but can also erase exposed
masonry, retain glass/trim/metalwork, and cannot repair exposure. It is an input
to sampling, not sufficient certification of wall colour or material.

`prepare_occfacade_context.py` generated lower crops from the exact full-view
photographs for the original ten cases. Applying OccFacade to these crops alone
versus extracting the same pixels from its full-view predictions yields median
class agreement **55.43%**. The crops show invented repeated rows, so the issue
persists without different dates/panoramas. This is sensitivity, not accuracy.
The original plane heights only select the approximate crop band; inference is
compared in exact source pixel coordinates, not projected between photographs.

Source pair audit: index 30 is visually paired; index 11's winter full image and
summer ground image cannot support ground absence claims through foliage;
index 10's exact subfacade pairing is uncertain. Full and ground panoramas are
selected independently by `prepare-neighbourhood.ts`, and its footprint blocker
score does not measure foliage. Receipts are recorded in
`review-data/facade-assessment/source-pair-review-occfacade.json`.

Reproduce comparisons:

```sh
.cache/roofline-eval/venv/bin/python scripts/facade-eval/prepare_occfacade_context.py \
  --cohort .cache/facade-assessment/cohort.json \
  --pilot .cache/facade-assessment/occfacade-v1 --out /tmp/new-context-input
# Run run_occfacade.py on that manifest into a fresh directory, then:
.cache/roofline-eval/venv/bin/python scripts/facade-eval/compare_occfacade.py \
  --pilot .cache/facade-assessment/occfacade-full100-v1 \
  --vistas .cache/facade-assessment/occfacade-visible100-v1/segmentation \
  --wall-only --review review-data/facade-assessment/occfacade-wall100-review.json \
  --out /tmp/new-wall-comparison
```

Full-only inference is now selected with `run_occfacade.py --kinds full` and an
explicit comma-separated `--indices` list. Default remains the original 20-crop
pilot. Models, evidence and derived masks remain local/ignored.

Review gallery:
http://localhost:5195/data/facade-review-galleries/occfacade-wall100-reviewed-v3/index.html
Same-capture test:
http://localhost:5195/data/facade-review-galleries/occfacade-comparison-v1/index.html

Next priority: quantify on annotated observed-wall/opening regions and separate
material classification from lighting-sensitive photo RGB. Do not spend the next
batch on ground-only OccFacade or treat model agreement as acceptance. Nothing
from this follow-up changes default game appearance or geometry.


The earlier district worker has also completed 44 diagnostic batches, covering
4,218 sources: 2,036 provisional measurements, 2,169 requiring review, 13 withheld
(as read from progress and colour reports on 2026-09-27). Those statuses are
algorithmic triage, not visual acceptance or new game publication. The 100-case
visual pass demonstrates why bulk provisional measurements must not be treated
as calibrated facade albedo. OpenCode/DeepSeek tools were not exposed in this
session; this pass used the available local CV models and Sol/Terra agents.

Verification: 100 source/mask pairs and all 100 review hashes validated; exact
pixel equality checked for all ten same-capture crops; stale review deliberately
rejected without emitting a completed comparison; galleries checked at desktop
and phone widths with all images loading and no horizontal overflow. TypeScript
pre-commit check and Python compile checks pass.

## Reviewed source-pixel wall controls (2026-09-27)

Ten full-view source photos have 44 model-reviewed rectangular controls in
`review-data/facade-assessment/wall-patch-controls.json`: 27 upper-wall patches,
4 base-wall patches, 8 window-glass negatives and 5 occluder negatives. Six
candidate regions were removed after native visual review before this v2
report. Each rectangle is in the original photo's integer pixel coordinates;
its source SHA-256 is checked against the cohort. The report also verifies the
OccFacade, Vistas and intersection-mask hashes and records patch crops and
source-photo medians over every pixel in each rectangle, not medians of the
mask intersection. These are selected diagnostic controls, not independent
human ground truth, verified BAG owner identities, or calibrated render albedo.

Mean mask coverage **per patch** (each rectangle gets equal weight, regardless
of its size):

| Reviewed control | Patches | OccFacade wall | Vistas building | Intersection |
| --- | ---: | ---: | ---: | ---: |
| Upper wall | 27 | 96.18% | 96.30% | 92.48% |
| Base wall | 4 | 59.07% | 100.00% | 59.07% |
| All wall | 31 | 91.39% | 96.77% | 88.17% |
| Window glass | 8 | 1.57% | 97.06% | 1.57% |
| Occluders | 5 | 51.25% | 2.20% | 2.20% |
| All negatives | 13 | 20.68% | 60.58% | 1.82% |

The intersection excludes almost all pixels in these selected negative
patches, but also loses some true wall, particularly at the four base-wall
patches. OccFacade alone leaks into selected vegetation/vehicle patches;
Vistas building alone retains selected glass. These means describe only the
reviewed rectangles in ten photos. They do not estimate whole-image mask
accuracy, independent wall visibility, physical material correctness, or game
render quality. The patch RGB values remain photographed colours affected by
lighting and exposure; no new game colours or materials were accepted.

Rebuild the report into a **fresh** local directory (existing outputs are
rejected to protect evidence):

```sh
node --import tsx scripts/review/build-wall-patch-report.ts \
  --input=review-data/facade-assessment/wall-patch-controls.json \
  --out=/tmp/wall-patch-controls-rebuild
node --import tsx src/canalRecall/facade/wallPatchMeasurement.test.ts
```

The builder reads `.cache/facade-assessment/cohort.json`, the full-view
OccFacade receipt, Vistas provenance, and the reviewed wall-mask comparison;
it refuses changed image and mask hashes. The local gallery is
`public/data/facade-review-galleries/wall-patch-controls-v2/index.html`
(or `http://localhost:5195/data/facade-review-galleries/wall-patch-controls-v2/index.html`
when the local server is running). A rebuild produced byte-identical
`report.json` (SHA-256
`cd391a411ad1d24948fe73167760a9367d9b8b8fa668e3dcfd4954456b34f8f8`).
Desktop 1440×900 and phone 390×844 loaded all 10 cards and 54 images, with no
broken images, horizontal overflow, or JavaScript errors. All 44 published
patch crops match their report SHA-256 hashes. `tsc --noEmit` and the focused
patch test pass.
