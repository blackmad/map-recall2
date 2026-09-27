# Nano Banana Pro: packed facades versus continuous panorama

2026-09-27. Both alternatives were executed with
`google/gemini-3-pro-image`, pinned to `google-ai-studio/global` through
OpenRouter's dedicated Image API. Five standard requests, no retries/fallbacks.

| Condition | Returned pixels | Actual USD | Client seconds |
| --- | --- | ---: | ---: |
| Single source0 | 768×1376 | 0.137562 | 17.978 |
| Single source80 | 768×1376 | 0.137502 | 18.536 |
| Four packed facades, 1K | 1024×1024 | 0.139338 | 50.419 |
| Same packed input, 2K | 2048×2048 | 0.138066 | 57.401 |
| Continuous panorama crop, 1K | 1376×768 | 0.137394 | 17.898 |

Actual total **$0.689862** including reported input/output cost. Packed costs
per requested facade: **$0.0348345 at 1K**, **$0.0345165 at 2K**. These are not
costs per accepted building. No batch request was made.

## Inputs and slicing

Packed: sources0/3/4/80, individually rectified photographs, placed without
stretching into four 236px-wide columns in a 1024-square white canvas. Outer
and inter-column gutters16px. Both output resolutions receive identical input
bytes. The source3 example is deliberately unlike source0/80 in floor count.

Continuous: one real panorama-derived perspective view, panorama
`TMX7316010203-002928_pano_0014_000001`, context crop x450..1170/y0..405 resized
to1024×576. This contains a receding street, a main frontage and a right-hand
frontage with substantial construction occlusion. It is not a montage and not
an orthographic elevation shared by all facades. Three visual context zones
illustrate slicing; they are not cadastral buildings or accepted owner matches.

Sheet outputs are sliced using original input cell coordinates scaled to the
returned dimensions. The columns remain separable; white-gutter fractions are
roughly92–96%. Neither separability nor white gutters establishes correct
opening positions, proportions, ownership or texture coordinates.

## Visual findings

- 1K packing adds a fifth upper opening row to source3, which has four in the
  photograph, expands its roof/mast and shifts masonry toward orange.
- 2K packing keeps source3's four upper rows. It still changes trim/material
  bands, introduces drawn grid lines and adds brick pattern to source4 despite
  the no-texture prompt. Single sample only: resolution is confounded with
  generation randomness, so this is a promising candidate rather than proof.
- Source0's opening arrangement and red entrance survive packing. Single0
  widens the facade to fill9:16 instead of preserving its slender proportions
  with white margins; single80 invents flanking facades. Next controls should
  supply an explicitly padded reference, not rely on text alone.
- The panorama keeps broad roof masses and perspective, but simplifies visible
  right-side balcony recesses and flattens ground occlusions. It is useful
  context, not ready-made per-building texture geometry.
- No generated facade has been accepted into game data. Photo ownership remains
  unresolved. Previous Lite used bespoke prompts; this trial uses a generic
  base prompt with condition-specific framing, so it is not a controlled model
  ranking. The flat-colour/no-texture prompt also does not test brick synthesis.

Next: test four-facade2K packs on held-out examples with explicitly padded single
controls, observed opening/roof overlays and source-to-result alignment. Reject
extra floors and changed boundaries before vectorization. For panorama inputs,
verify/rectify each frontage before production slicing; don't assume generation
preserves an exact boundary just because a street looks plausible.

## Artifacts and verification

Gallery: `/data/facade-review-galleries/banana-pro-pack-v1/index.html` includes
full inputs/outputs, eight fixed-coordinate facade slices, context cuts, prompts,
receipts, actual cost and review findings. Binary evidence stays local per repo
policy. Compact archive: `review-data/facade-vector-pilot/banana-pro-pack-v1/`.
Cache: `.cache/facade-assessment/banana-pro-pack-v1/` retains raw responses.

Preparation and execution are hash-bound. The runner validates source manifests,
image bytes and provider capabilities, and reuses saved successes without paid
replay. Default invocation only prints a plan; `--run` explicitly executes.

```
node --import tsx scripts/review/run-banana-pro-pack.ts
node --import tsx scripts/review/build-facade-pro-pack-report.ts
```

TypeScript passes. Independent browser QA: desktop1440 and phone390, all26 images
loaded, zero console/page errors and no horizontal overflow. Root and independent
Sol inspection review source geometry rather than merely successful rendering.

Accounting: the old GLM unknown remains unknown with its full$0.06 reservation.
A new scoped continuation for this user-requested experiment permitted five
reservations at$0.22 each under the existing global ceiling. All five are used;
there is no automatic retry or expansion. The old request was not reconciled or
assigned an invented actual cost. Other unknown/pending requests still block.
