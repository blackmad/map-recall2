# Continuous head-on facade strips — 2026-09-27

User requested better continuous, nearly front-on strips after the prior corner
panorama wasted pixels on receding buildings and construction occlusion.
Three single-source context photographs were visually selected. This is not a
montage of rectified individual facades. Blurry edge buildings are trimmed; source
crop/projection and image hashes are retained in the input manifest.

Model: `google/gemini-3-pro-image`, pinned Google AI Studio via OpenRouter Image
API. All three receive the same prompt and 2K output request. The revised prompt
removes foreground objects and fills their silhouettes by continuing surrounding
wall, base and trim. Partly visible openings may be completed; otherwise matching
wall is preferred to invented doors. These are inferred fills, not observed data.

This tests the continuous-strip workflow; it is not a controlled 1K/2K comparison.
No image is accepted as game geometry or verified building ownership. White sky
and flat-colour rendering are requested, so the test does not measure recovery of
photographic brick texture. Provider reservations do not constitute hard billing
caps; measured excess or unknown charges stop further calls without retries.

## Reproduction

- Inputs/cache: `.cache/facade-assessment/banana-head-on-v1/`.
- Compact archive: `review-data/facade-vector-pilot/banana-head-on-v1/`.
- Gallery: `/data/facade-review-galleries/banana-head-on-v1/index.html`.
- Runner: `scripts/review/run-banana-head-on.ts`; default is dry plan, `--run`
  executes, existing successful receipts are reused without repeat billing.
- Report: `scripts/review/build-banana-head-on-report.ts`.

The old GLM charge remains unknown and its full $0.06 remains reserved. A new
three-call scope for this user request reserves $0.148 per call ($0.444 total),
based on the preceding Pro pilot's measured $0.137–0.139 per call. The existing
$6.8847907395 global ceiling is unchanged. Other unknowns/pending calls still
block. The old timeout is not replayed, zeroed or treated as reconciled.

## Results

| Strip | Actual USD | Seconds | Output pixels |
| --- | ---: | ---: | --- |
| 1: brick row | 0.137912 | 24.057 | 2752×1536 |
| 2: shop row | 0.138308 | 27.785 | 2752×1536 |
| 3: varied gables | 0.137876 | 25.610 | 2752×1536 |

Total actual **$0.414096**. All three succeeded on first attempt; scope exhausted.
Occlusion completion eliminates foreground silhouettes, but cannot establish
hidden geometry. Broad floor rhythms and distinctive gables survive; shops and
window details are regularized. Strip3 changes central dark storefront frames to
orange/brown. Strip2 changes colours and reinterprets signs. Strip1 removes roof
hoisting beams as well as unwanted poles/wires: preserve architectural hoisting
beams explicitly in the next prompt. No rollout accepted.

Inputs are native crops1360×771,1540×760,1380×760. Output16:9 is particularly
different from strip2's aspect, so this is an artwork test and requires geometric
registration before slicing to measured frontage bounds. Pixel occlusion masks
were not produced; record that provenance separately before production use.

Next: overlay verified facade boundaries/opening anchors, restore source colours
for storefronts, protect roof beams, and separate observed from inferred regions.

Verification: TypeScript passes. Independent source/result visual review completed.
Gallery tested at1440px and390px: all6 images load, no console/page errors or
overflow after fixing wrapping for long panorama IDs.
