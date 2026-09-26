# Amsterdam routing: first human-labelled comparison

8 September 2026. **Imported all 76 human decisions, trained one local candidate,
and completed 76 hosted requests across four models. Confirmed API billing was
$0.096687.** One additional Qwen3.7 Flash request returned HTTP 404 without usage;
its $0.003417 reservation remains unresolved. Total billed plus reserved is
$0.100104, below the $1 experiment ceiling. No model was enabled for automatic
city routing.

## What was tested

The same 19 development facades, drawn from municipal panorama photo studies,
were sent to each hosted model as **one facade crop, at most 512 pixels on its
long edge**. These are not entire 360-degree panoramas. Original image hashes,
resized crop hashes, prompts, registry metadata, model names, prices, usage and
latency are retained. The existing v2 prompt was fixed before this comparison;
human answers were never included in model requests.

Each request returned eight compact fields. Four have human reviews: shopfront,
awning, visibility and building family. Material, colour, opening regularity and
sign flags remain unevaluated. Humans saw the original full image plus a larger
ground-floor detail; the hosted models saw only the resized full image.

The development seed contains 18 certain shopfront, awning and visibility labels,
and 17 certain family labels. Human “Can't tell” decisions are excluded from
accuracy and reported separately. Model abstentions and errors count as misses;
accuracy on answered cases is also retained. These denominators are small, and
the sample is neither random city coverage nor a frozen release evaluation.

## Measured hosted results

Fractions below are agreement with certain human labels, including model
abstentions as misses. Each row used all 19 images.

| Model | Shopfront | Awning | Visibility | Family | Median request | Billed / 100,000 identical requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Qwen3-VL 32B Instruct | 9/18 | 17/18 | 10/18 | 11/17 | 1.61 s | $10.25 |
| Gemini 2.5 Flash-Lite | 11/18 | 15/18 | 10/18 | 13/17 | 1.28 s | $16.86 |
| Gemini 3.1 Flash-Lite | **15/18** | **18/18** | **13/18** | **13/17** | **1.14 s** | **$44.74** |
| Gemini 3.1 Pro Preview | 14/18 | 14/18 | 11/18 | 12/17 | 2.75 s | $437.03 |

All four found the five human-labelled shopfront positives. Qwen falsely flagged
9/13 negative fronts, Gemini 2.5 flagged 7/13, and Gemini 3.1 Flash-Lite flagged
3/13. Pro correctly rejected 9/13 negatives, abstained on three and falsely
flagged one. Pro's conservative abstentions are useful for review, but it did
not improve overall agreement enough to justify making it the default here.

The 18/18 awning result includes only **two positives**. All four models missed
both human “mostly blocked” visibility labels. Gemini 3.1 Flash-Lite matched
only 1/5 apartment-row labels. A reliable family/visibility gate is still missing.
All four also asserted a shopfront on the single human-unclear shopfront image.

Qwen3.7 Flash was listed in the catalogue but returned HTTP 404 under the current
strict-schema request settings. The runner stopped immediately; it has no usable
quality or per-request cost measurement. Catalogue availability alone is
insufficient evidence that a chosen routing configuration works.

Mean billed input/output token counts were 732/66 for Qwen32B, 1,408/74 for
Gemini2.5, 1,366/74 for Gemini3.1 Flash-Lite and 1,791/69 for Pro. Pro requested
low reasoning with a 2,048-token total output cap; the returned usage recorded
zero reasoning tokens. The other successful models used a 350-token cap and
disabled optional reasoning. These are measurements of these configurations,
not exhaustive model capability tests.

Cost projections use returned `usage.cost`, which was 1% below returned upstream
inference cost in this run. Budget at least $45–50 per 100,000 Flash-Lite routing
requests before retries; do not assume an account discount persists. Published
rates and supported parameters were checked against the
[OpenRouter model catalogue](https://openrouter.ai/api/v1/models).
Each run retains its own dated price snapshot.

## Local training result

The 76 imported decisions contain:

| Task | Certain classes | Training outcome |
| --- | --- | --- |
| Shopfront | 5 yes, 13 no | Candidate trained |
| Awning | 2 yes, 16 no | More positive examples needed |
| Visibility | 11 clear, 5 partial, 2 severe | More severe examples needed |
| Family | 10 traditional, 5 apartment, 1 institutional, 1 modern | More rare-family examples needed |

Frozen MobileNetV3 Small embeddings were already cached. A balanced logistic
head trained on the 18 certain shopfront decisions. Three-fold development
evaluation grouped shared streets/camera missions and found **1/5 positives**
and **12/13 negatives**: 56.2% balanced accuracy. The fit on all labelled examples
is retained as a candidate; its training-set scores are not performance evidence.
The page now shows the development result when training finishes.

The other tasks retain the original minimum of three examples per represented
class. No rare class was silently dropped or turned into a negative. Merely
meeting that minimum would still be far short of deployment evidence.

The saved review timestamps span 142.7 seconds from the first to last decision,
with a 1.41-second median interval. That suggests the keyboard flow was quick
for this seed; it does not measure reading time before the first answer or
establish throughput on harder images.

## Revised speed and cost plan

1. **Use Gemini 3.1 Flash-Lite as the next hosted baseline.** Its extra $34.49
   over Qwen32B per 100,000 matching requests buys fewer false storefront flags
   on this seed. Avoid spending days training just to save that amount.
2. **Collect 200–300 new, diverse facades before more model tuning.** Target at
   least 30–50 positive storefronts and 30–50 awnings, difficult residential
   negatives, apartment blocks and heavily obstructed views. These targets
   overlap and are acquisition goals, not a sufficient validation sample by
   themselves. Reserve new streets for evaluation before selecting training data.
3. **Pre-screen with the cheap model; keep humans in charge.** At the measured
   rate, 300 single-view Flash-Lite calls cost about $0.13. Use cached embeddings
   and disagreements to find diverse examples, mixed with random controls.
   Strong-teacher calls should address a specific unresolved question. A blanket
   Pro pass on all 300 would cost about $1.31 at this measured configuration,
   without demonstrated benefit here. Neither future batch has been run.
4. **Fix missing context before buying a bigger model.** Test full facade plus
   a targeted ground-floor view on the next development batch. Market canopies
   and obstructions cause storefront mistakes; architectural family can need
   neighbouring facade context. Separate ground-floor usability from whole-wall
   occlusion if the next review shows the distinction matters. Preserve existing
   human answers and version any changed task definitions.
5. **Keep DINO and selective SAM local.** The previous warm development timings
   extrapolate to 8.8 compute hours for DINO on 100,000 images plus SAM on 20,000.
   SAM supplies masks, not family labels; a giant hosted SAM does not solve the
   observed semantic errors. Run it only for a demonstrated mask failure.
6. **Treat the residential shortcut as unvalidated.** A diagnostic rule requiring
   predicted residential family, no shop, no awning and clear visibility selected
   only 5/19 Flash-Lite images. One of those was human-labelled partly blocked.
   This is not evidence for skipping analysis on most of Amsterdam. Continue
   geometry filtering, caching and independent task flags while collecting data.
7. **Use concurrency for throughput once acquisition and quotas are measured.**
   The 1.14-second median implies 31.7 serial hours or an ideal 2.0 hours at
   concurrency 16 for 100,000 requests. Those are arithmetic projections, not a
   tested sustained service rate. The local two-view encoder remains around
   3.1 CPU hours per 100,000 at the earlier measured 0.110 seconds per facade.

For a compact routing-only pass, allow **about $60 per 100,000 requests including
25% usage/retry headroom** at the measured Flash-Lite cost. Rich facade extraction,
alternative crops, OCR, acquisition, identity checks, human review and renderer
work are separate. The earlier $150 reference pass and $500–1,500 campaign budget
remain broader workload scenarios, not a verified price for all Amsterdam.

## Artifacts and reproduction

- Human snapshot: `.cache/facade-rebuild/router-review/imports/human-2026-09-08.json`.
- Trained head/report: `.cache/facade-rebuild/router-review/models/run-1788869465783/`.
- Hosted reports: `.cache/facade-rebuild/appearance-routing-benchmark/hosted-human-v2/`,
  `hosted-teacher-v2/`, `hosted-cheapest-v2/`.
- Comparison, class recalls, source-level cases and disagreement CSV:
  `.cache/facade-rebuild/appearance-routing-benchmark/human-comparison/`.
- Labels remain separate from every machine proposal. The supplied key is stored
  only in an ignored local credential file with mode 0600.

Run `evaluate-router-benchmarks.py --help` for reproducible comparison inputs.
`check-router-training.py` covers label provenance, exported-head equivalence,
and abstention/error accounting. `check-router-benchmark.mjs` uses mocked requests
to check spend ceilings, unknown-charge stops, tier pricing and teacher reasoning.
`check-router-review.mjs` exercises the keyboard workflow and mobile layout against
an isolated test ledger. All three passed after these changes.
