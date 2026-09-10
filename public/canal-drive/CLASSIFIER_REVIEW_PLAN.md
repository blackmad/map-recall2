# Fast appearance classifiers and human review

8 September 2026. The local labelling/training tooling is built. Citywide
classifier accuracy and useful fast-path coverage are not established.

**Update:** all 76 seed decisions are now imported. The first local shopfront
candidate and four hosted models have been evaluated against them; confirmed
hosted billing was $0.096687. See the [measured results and revised plan](./ROUTER_BENCHMARK_RESULTS.md).
Gemini 3.1 Flash-Lite leads this small comparison. The local candidate found only
1/5 storefront positives in grouped development testing and is not enabled for
automatic skipping.

## Review now

Open <http://127.0.0.1:5194/>. Start with **Is there a shopfront?**
Nineteen distinct cached facades form a small development seed. One missing
Prinsengracht photograph was omitted. There are four independent tasks:
shopfront, awning, visibility and broad building family.

- **1–7:** choose the numbered answer and advance.
- **S / right arrow:** skip without creating a label.
- **Z:** undo the last answer in this browser session, including across tasks.
- **Left arrow:** revisit the previous photograph.
- **Space:** enlarge the ground floor for shop/awning tasks, or the full facade
  for family/visibility tasks. **Esc** closes the enlargement.
- Answers save immediately to the local service. A held key cannot label
  successive images. Reloading resumes the first unanswered image.
- Export/import preserves reviews. Imports reject machine proposals and stale
  source hashes; older imports cannot replace newer decisions.
- **Train from saved labels** starts local training from an immutable snapshot.
  The queue remains usable during training. Models remain development candidates.

Full facade and lower-45% detail are shown together. The latter is a convenience
crop, not a measured ground-floor boundary. Use **Can't tell** when the relevant
feature is hidden or missing. Labels describe the image, not current business
occupancy or certified building registration.

The renderer's normal game interface is unaffected. This page needs its local
review service; it is not a publicly deployed annotation application.

## Small models first

Use a frozen **MobileNetV3 Small** image encoder, with one small logistic
classifier per task. Images remain local. Each facade contributes two views:
the whole facade and the ground-floor detail. Fit/pad to 224 pixels preserves
the complete crop instead of removing gables or shops with a centre crop.
The two normalized embeddings concatenate into a 1,152-value feature vector.

The [Torchvision model](https://docs.pytorch.org/vision/stable/models/generated/torchvision.models.mobilenet_v3_small.html)
has about 2.5 million parameters and a 9.8 MB pretrained checkpoint. The encoder
is not being retrained on this tiny seed. Weights, preprocessing, input hashes,
versions and label snapshots are recorded with the candidate head.

Measured here: **0.110 seconds median per facade for both views**, on 19 seed
images using the local CPU with four Torch threads. Download/model startup are
excluded; image preprocessing and feature extraction are included. Features
are cached, so subsequent head training reuses them. Linear extrapolation is
about 3.1 compute hours per 100,000 similar facades; this is not a sustained
city benchmark or an accuracy result.

At least 12 clear labels are required, with three examples in each of at least
two classes. This is only a threshold for producing a useful development
candidate. **Can't tell** remains in the review ledger and is excluded from
semantic training; it never becomes a negative example. Candidate probabilities
are uncalibrated scores, not automatic acceptance decisions.

All variants of a building are deduplicated. Shared streets and panorama camera
missions are unioned into groups (14 groups in the seed). Three-fold grouped
development evaluation is reported only when class/group coverage permits it.
The eventual release evaluation needs new geographically held-out streets:
street/mission grouping alone does not guarantee complete spatial independence.
Do not tune a threshold on development results and call it a city guarantee.

## Where DINO and SAM fit

- Grounding DINO remains the local opening/object detector. Geometry and opening
  patterns can provide useful appearance without asking a language model.
- SAM runs where pixel masks materially help colour sampling or shape analysis.
  It is unnecessary when bounding rectangles already supply the desired recipe.
- The existing small development benchmark measured about 0.290 s for DINO Tiny
  and 0.135 s for SAM with DINO boxes. DINO on 100,000 crops plus SAM on 20,000
  extrapolates to **8.8 compute hours**, excluding acquisition and other stages.
- Neither model by itself is the trained Amsterdam family/shopfront classifier.
  Adding separate small heads is the experiment this review tool enables.

## Strong hosted models as pre-screeners

Use a larger **vision-language model** to help assemble and prioritize a diverse
label queue: likely commercial fronts, unusual buildings, unclear source crops,
rare materials and disagreements with the small classifier. Give it full-facade
context plus a targeted ground-floor crop. Return compact labels and reason codes.

For the next 200–500-image acquisition batch, compare one strong teacher with
the inexpensive hosted baseline. For example, 500 requests at an assumed 3,000
input and 400 billed output tokens cost **$5.40** at Gemini 3.1 Pro's published
$2/$12 per-million-token standard rates. Image and thinking token use must be
measured; this is arithmetic, not a completed hosted benchmark.
Source: [Gemini prices](https://ai.google.dev/gemini-api/docs/pricing).

Keep teacher suggestions as **machine proposals**. Human confirmation is a
separate decision. For assisted labelling, record which suggestion the reviewer
saw. Keep an unassisted evaluation set, and review a random sample of apparently
easy cases as well as uncertain ones. Reviewing only model disagreements would
miss mistakes shared by both models.

A **larger SAM** is useful for a demonstrated mask-boundary problem, such as
awnings blending into shopfronts, not for deciding architectural family or reading
a sign. Try the larger local checkpoint on a small labelled mask set first; use
a hosted segmentation service only if measured quality or throughput justifies
its integration and price. The present classification workflow needs no masks
drawn by the reviewer.

Suggested progression:

1. Label the 19-image seed to check task definitions and keyboard workflow.
2. Acquire 200–300 diverse facades, deliberately adding ordinary residential
   negatives, clear commercial positives, occlusion and non-central styles.
3. Use teacher scores and cheap embeddings for diversity/disagreement sampling;
   reserve random examples and independent streets before tuning.
4. Train/retrain the small heads from human decisions. Measure missed storefronts,
   false exceptions, abstentions and review seconds, not just overall accuracy.
5. Route confidently ordinary cases through local recipes/detection; spend hosted
   calls on unresolved cases. Establish the actual escalation rate before revising
   the city cost projection.

## Local VLM findings that changed the plan

The initial routing comparison made 24 local requests: six development crops,
two image sizes and Qwen2.5-VL 7B versus Gemma 3 4B. Median elapsed time excluding
model loading was 6.49 s and 3.92 s respectively. Both produced valid JSON, but
neither initial prompt yielded a usable occlusion label. Qwen largely abstained
on shopfronts; Gemma was more willing to label them but also made family errors.

A second 12-request pass clarified definitions and supplied registry dimensions.
It corrected the wide-workshop family in both models and improved Gemma's
visibility outputs. However, Gemma then called every reviewed ground floor a
shopfront, while Qwen abstained on all six. Neither is a reliable binary filter
on this evidence. Second-pass latency is confounded by repeated-image caching.
This is why we are collecting human labels rather than treating teacher output
as training truth.

In the first pass, resizing 1024 to 512 did not change Ollama's reported input
token count for these images. Measure preprocessing/tokenization, rather than
assuming smaller JPEGs guarantee cheaper or faster model inference.

Reports: `.cache/facade-rebuild/appearance-routing-benchmark/local-v1/report.json`,
`local-v2/report.json` and `local-summary.json`.

## Reproduce and retain the work

```sh
rtk proxy uv venv .cache/facade-rebuild/router-venv --python 3.12
rtk proxy uv pip install --python .cache/facade-rebuild/router-venv/bin/python -r scripts/facade-rebuild/router-requirements.txt
rtk proxy node scripts/facade-rebuild/build-router-review.mjs
rtk proxy node scripts/facade-rebuild/serve-router-review.mjs
```

The first encoder load downloads the pretrained checkpoint; subsequent feature
and training work is local. Labels live in
`.cache/facade-rebuild/router-review/labels.json`; use Export labels for a backup.
Snapshots, features and candidate heads live beside it. Preserve this directory
and exports before clearing caches. The first human-labelled snapshot and local
candidate are now recorded in the linked benchmark results.

The training and inference CLIs are `train-router-classifiers.py` and
`predict-router-classifiers.py`. Each accepts `--help`. Candidate heads are JSON,
and inference exports machine proposals with source/model hashes.

`scripts/facade-rebuild/benchmark-appearance-routing.mjs` can compare local and
OpenRouter models with hashed inputs, usage/latency reporting and a $1 maximum
local budget setting. It stops when a charge is unknown and filters provider
prices. Use `--env-file=PATH` to load the existing token without putting it in
command arguments. The supplied token is now in an ignored local file with mode
0600; paid comparison results are recorded separately from training labels.

Checks:

```sh
rtk proxy node scripts/check-router-review.mjs
rtk proxy .cache/facade-rebuild/router-venv/bin/python scripts/check-router-training.py
rtk proxy node scripts/check-router-benchmark.mjs
```

Browser checks use an isolated copy of the queue, never the human review ledger.
Training checks use synthetic features solely to verify provenance rejection and
binary/multiclass exported-head equivalence.
