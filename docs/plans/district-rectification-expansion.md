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
unavailable panorama resolution become durable source omissions.
No paid model call, appearance publication, or default game change is part of this
worker. Metadata/data changes invalidate the frozen selection rather than silently
reassigning a batch to different buildings.

The detached full queue writes `material-4000-worker.log` and
`material-4000-worker.pid` beside that progress report. Its first 100-frontage
4000px batch completed with 99 rectified frontages and one blank-crop omission.
The remaining batches are in progress; no bulk visual acceptance is implied.

## Classification after coverage

Qwen3.5-9B is a plausible local vision candidate, not yet evaluated on these crops.
The current machine is an M4 Pro with 48 GB RAM and Ollama installed. The official
Ollama 9B Q4 model is about 6.6 GB; memory fits, but disk competes with new imagery.
No model was downloaded as part of this rectification work. Benchmark against
source-bound references and explicit occlusion/abstention cases before adoption.
Local inference has no per-image API fee; it still consumes machine time/power.
Source: https://ollama.com/library/qwen3.5:9b .

The prior OpenCode vision pilot is not a validated production classifier. Official
Go rates make its reported 0.00247575 consistent with the off-peak USD token-rate
usage equivalent (12,057 input at $0.15/M plus 1,112 output/reasoning at $0.60/M).
Actual quota/cash charge remains unverified; Go subscription usage is not marginal
cash paid. Source: https://dev.opencode.ai/docs/go/ .
