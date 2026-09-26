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
- Index 30: ornamental gable portions become sky; foliage becomes wall. The
  full and ground images show substantially different architectural context,
  so their owner/view correspondence needs checking before treating this pair
  as a same-building accuracy comparison.
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
