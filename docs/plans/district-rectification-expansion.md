# Jordaan and Da Costabuurt: rectification before wider colour rollout

Updated 2026-09-26. The user narrowed the immediate goal to complete district
rectification coverage, then expansion elsewhere. No human labelling gate.

## Correct denominators

The 501 figure counts owners with wall-colour measurements; it was not the number
of buildings the rectifier is capable of processing. The previous source run was
restricted to five named streets and repeatedly selected the first capped records.

The published scene has 7,395 buildings, including 3,240 surrounding acquisition
halo buildings. Exact pinned municipal boundaries contain **4,155** owners:
966 Da Costabuurt and 3,189 Jordaan. Current geometric/panorama eligibility gives
**4,339 frontage candidates across 3,472 owners**. The other **683** have no
candidate under the current policy, which includes height, addresses, public-road
exposure, camera distance/angle and occlusion. This does not prove imagery is
unavailable. Investigate those reasons after the eligible queue is processed.

There are 974 eligible frontages in Da Costabuurt and 3,365 in Jordaan. The new
selector uses the publisher's exact footprint/boundary ownership, excludes halos,
deduplicates owners/frontages, pins block/inventory/config hashes, and divides the
entire queue into deterministic batches. The original route sample is unchanged.

## Storage and throughput

Only about 16 GiB were free at the start. Downloading every missing native 8000px
panorama was estimated above 17 GiB before crops, so that profile cannot be the
only bulk path on this disk.

The municipal source already supplies native 4000px panoramas. The new explicit
`material-4000` profile uses those original images with the same geometric
rectification. It records the actual source URL, dimensions and byte hash. It uses
native raster decoding/encoding for throughput. Its selections, manifests and
shared panorama pool are separate from the unchanged 8000px profile.

The first 20 medium panoramas averaged 908,454 bytes; ten frontages' four crops
averaged 254,704 bytes per frontage. At that small-sample mean, all 6,724 proposed
panoramas plus all 4,339 crop sets need roughly 7.2 GB. This is a forecast, not a
storage guarantee. Cached panoramas are hardlinked into later batches instead of
copied. A 4 GiB free-space reserve stops the process before disk exhaustion, without
deleting existing evidence or mislabelling a disk failure as missing imagery.

## Validation so far

- First 100-frontage 8000px batch: 99 rectified, one recorded omission. The resume
  check accounts for both valid crops and explicit omissions; it does not require
  pretending every input succeeded.
- First ten 4000px frontages: all ten byte/nonblank preflighted; verified resume
  reused the evidence without downloading it again.
- Independent native-photo review comparing the same ten frontages at 4000/8000:
  seven suitable for broad colour/material triage, two limited by branches/shadow,
  one rejected because a road sign dominates the wall. Framing is equivalent for
  this sample. Fine course texture and exact owner identity are not accepted.
- The review is source-hash bound in
  `review-data/district-rectification/material-4000-pilot-review.json`.

Bulk rectification prepares evidence; it is not bulk visual acceptance. Keep the
obstructed example out of colour estimation. Source identity/occlusion review and
higher-resolution escalation remain required before appearance publication.

## Run and resume

```sh
# Frozen queue and storage estimate, no downloads:
npm run rectify:district -- --source-profile=material-4000 --batch-size=100

# Complete both districts; reuses already verified batches:
npm run rectify:district -- --source-profile=material-4000 --batch-size=100 --resume

# Bounded first tranche for a selected area:
npm run rectify:district -- --source-profile=material-4000 --batch-size=100 --area-id=da-costabuurt-v1 --max-batches=1 --run
```

`--from-batch=N` can target a later batch; `--max-batches` counts visited batches,
including reuse. Default completion/resume visits the whole queue. All images and
progress remain local in `.cache/city-appearance/`. The profile-specific progress
report is under `districts/da-costa-jordaan-v1/rectification/`; it records selected,
rectified, omitted and pending frontages. A failed batch stops with a durable error. Temporary HTTP/network, decode, cache
and resource failures stop the batch for retry; only blank crops and explicitly
unavailable panorama resolution (including HTTP 404/410) become durable source omissions.
No paid model call, appearance publication, or default game change is part of this
worker. Metadata/data changes invalidate the frozen selection rather than silently
reassigning a batch to different buildings.

The detached full queue writes `material-4000-worker.log` and
`material-4000-worker.pid` beside that progress report. Its first 100-frontage
4000px batch completed with 99 rectified frontages and one blank-crop omission.
The remaining batches are in progress; no bulk visual acceptance is implied.

## Classification after coverage

Qwen3.5-9B has now been run locally on 30 source-bound crops. See
`review-data/district-rectification/local-model-results.json` for measured results.
The current machine is an M4 Pro with 48 GB RAM and Ollama installed. The official
Ollama 9B Q4 model is about 6.6 GB; memory fits, but disk competes with new imagery.
The 6.6 GB model is installed. Baseline median latency was 2.375 seconds/image
(p90 3.760 seconds). It overaccepted uncertain views. A conservative prompt
withheld all five uncertain cases on the corrected development reference, but
colour-family agreement remains below the rollout gate. This brick-heavy sample
does not validate performance on plaster, stone or concrete. The reference itself
required direct native-image correction; the original accuracy score is withdrawn.
A 100-source conservative run has now completed with 100 valid responses: median
2.980 seconds, p90 3.704 seconds. Material names agree with 88 of 89 existing
known-material assessments, but those assessments are not independent ground
truth. Nine formerly unknown cases received proposals and need native-image review.
The model is not being trained; existing local Qwen and pinned Mask2Former weights
provide classification and obstruction masks respectively.
Local inference has no per-image API fee; it still consumes machine time/power.
Source: https://ollama.com/library/qwen3.5:9b .

The prior OpenCode vision pilot is not a validated production classifier. Official
Go rates make its reported 0.00247575 consistent with the off-peak USD token-rate
usage equivalent (12,057 input at $0.15/M plus 1,112 output/reasoning at $0.60/M).
Actual quota/cash charge remains unverified; Go subscription usage is not marginal
cash paid. Source: https://dev.opencode.ai/docs/go/ .


## Overnight diagnostic loop (2026-09-26)

The local worker consumes completed, hash-verified 4K rectification batches. It
classifies each crop with conservative Qwen3.5:9b, segments the original crop with
pinned Mask2Former, and measures dominant upper-wall photo RGB inside building
masks. Masks remove vegetation and vehicles, but the building class still includes
windows and roof; dark/weak clusters require review. Photo RGB is not lighting-free
material colour. No diagnostic result publishes a game appearance automatically.

```sh
# Read-only queue summary
node --import tsx scripts/city-appearance/run-district-material-review.ts
# Bounded overnight watch: max 44 new batches and eight hours
node --import tsx scripts/city-appearance/run-district-material-review.ts --run --watch
```

Progress lives in `.cache/city-appearance/district-material-review/progress.json`.
Each completed job binds model/code/source revisions and hashes of classifier,
segmentation and colour outputs. Resume verifies those outputs before skipping
work. Transient failures retry three times; permanent errors remain recorded until
explicit `--retry-failed`. The worker retains a 4 GiB disk reserve. Its deadline is
checked between jobs, so an in-flight batch may finish after eight hours.

The opt-in `material-demo.html?scope=cohort` extends the default ten-case renderer
experiment to 85 supported source assessments. Eleven unknown cases and four
explicitly unsupported assessments keep their original appearance. This expands
comparison coverage, not visual acceptance; full render review is still pending.
The default game and ten-case review scope remain unchanged.


At 22:49 Amsterdam time, the first complete pipeline batch passed: 99 classifier
receipts, 99 masks, 20 provisional colour measurements and 79 measurements marked
for review. The detached watch resumed that completed batch without rerunning it
and started batch 1. `worker.pid` / `worker.log` beside the progress file identify
the active process. The gallery reads only verified completed jobs and refreshes
once per minute. Over 2,000 frontages had been rectified at that checkpoint.

Morning review should first inspect the measured-colour review reasons and source
identity, then compare the supported cases under neutral rendered lighting.
Material-family inference selects shared texture styles; it does not recover
measured brick size, bond pattern, or exact facade detail from each photograph.
The 683 owners without eligible sources remain a separate recovery queue; 26 of
the address-only exclusions gained candidates in an isolated diagnostic, not in
production coverage.


The first batch's 79 colour review flags break down into 76 dark clusters and
three insufficient/ambiguous clusters. This is the immediate colour-estimation
priority: distinguish exposed masonry from glass/shadow within the building mask,
then evaluate lighting correction against independently inspected wall patches.
Do not simply brighten every measured colour or promote the cluster as albedo;
that would repeat the grey/dark-wall failure. The existing shared-material demo
remains the rendering comparison while those measurements are assessed.
