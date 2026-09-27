# Nano Banana 2 Lite facade pilot — 2026-09-27

Executed the user's request to test Lite on the same three facade references.
Actual model: `google/gemini-3.1-flash-lite-image`, pinned to Google AI Studio
through OpenRouter's dedicated Image API. One reference photo and one output
per request, standard synchronous pricing, no retries or model fallbacks.
Saved prompts are identical to the previous built-in raster trial.

| Source | Output size | Actual USD | Client seconds | Traced paths | SVG bytes |
| --- | --- | ---: | ---: | ---: | ---: |
| 0 | 512 × 2064 | 0.03450750 | 3.459 | 144 | 73399 |
| 17 | 1024 × 1024 | 0.03455825 | 3.411 | 299 | 123349 |
| 80 | 512 × 2064 | 0.03456600 | 3.840 | 606 | 221704 |

Total provider-reported cost: **$0.10363175**. Includes reported input and output
charges; not a projected price or batch discount. All calls succeeded once.
VTracer 0.6.15 used the same 32-colour, longest-side1600 settings as before.

Output resolution was explicitly 1K; nearest supported aspect was 1:4 for the
tall sources and 1:1 for source17. The previous built-in tool used automatic
output dimensions, so this is a practical workflow comparison, not an equal-
resolution model benchmark. Aspect constraints can affect proportions. Both
arms use source-specific descriptive prompts; generic batch quality is untested.

## Budget accounting

The old GLM4.6V timeout remains **unknown**, with its full **$0.06** reservation
counted. It was neither replayed nor assigned an invented actual charge.
For the newly user-authorized Lite test, the agent recorded a narrowly scoped
continuation: only that existing unknown ID is acknowledged, a maximum of three
$0.20 reservations, no increase to the existing global ceiling. New unknown or
pending charges still block; ordinary runners still reject the old unknown.
The allowance is exhausted by these three calls even though actual cost is lower.
Synthetic budget tests exercise these restrictions and preservation of the old
reservation. This is a scoped accounting-policy change, not reconciliation.

## Artifacts and reproduction

- Cache: `.cache/facade-assessment/banana-lite-v1/` contains original API
  responses, image receipts, PNGs, endpoint capabilities, experiment hash and
  three trace directories.
- Archive: `review-data/facade-vector-pilot/banana-lite-v1/` contains compact
  receipts, prompts, review, and trace settings/hashes.
- Gallery: `/data/facade-review-galleries/banana-lite-v1/index.html` shows source,
  previous built-in raster, Lite raster, and Lite SVG with downloadable prompts.

```sh
# Dry plan only by default; --run is explicit, saved successful calls are reused.
node --import tsx scripts/review/run-banana-lite-facades.ts
node --import tsx scripts/review/build-facade-banana-lite-report.ts
```

No generated facade is accepted into game data. Visual accuracy and verified
source ownership still need review before any district rollout.

## Visual result

Root and an independent Sol reviewer inspected all three sources, both generated
rasters and the Lite traces. Lite retains the main opening counts and balcony
levels, but loses glazing/brick detail, repeats dark railings where balcony
barriers vary, omits small lower openings and mistakes wires for side-window
railings on source80. The blank shop region is cautious about occlusion but also
loses visible storefront evidence. The earlier built-in raster is generally more
detailed; neither model has established faithful measured geometry. Lite is a
promising fast coarse artwork candidate, not a demonstrated equal-quality
replacement. Both desktop1440 and phone390 loaded all12 images without errors,
broken images or horizontal overflow.

## Batch mode

Google's Batch API queues independent requests asynchronously, targeting a
24-hour turnaround for 50% of standard pricing. Lite's published 1K output-only
price is $0.0168 batch versus $0.0336 standard; inputs and text output add cost.
The current three-image preview used standard requests for immediate inspection.
Direct Google batch credentials/routing are not configured by this experiment.

Sources:
- https://ai.google.dev/gemini-api/docs/batch-api
- https://ai.google.dev/gemini-api/docs/pricing
- https://openrouter.ai/docs/guides/overview/multimodal/image-generation
