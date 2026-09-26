# Amsterdam appearance: vision cost and routing estimate

8 September 2026. Published prices checked today; calculations below are workload
scenarios, not a measured city inventory.
USD, excluding tax, imagery acquisition/storage, engineering, review and hosting.

Follow-up: the [classifier review plan](./CLASSIFIER_REVIEW_PLAN.md) now includes
actual local VLM timings, a faster frozen image encoder and a human labelling tool.
The escalation percentages below remain assumptions; the small local VLM sample
does not yet support using those models as reliable automatic skip filters.

**Measured follow-up:** [76 hosted calls against 76 human decisions](./ROUTER_BENCHMARK_RESULTS.md)
cost $0.096687, plus one unresolved $0.003417 reservation for an HTTP 404. Gemini
3.1 Flash-Lite was the strongest inexpensive baseline on this seed: its exact
512-pixel routing workload extrapolates to $44.74/100,000 calls, or about $60 with
25% headroom. This is routing only; the broader appearance workload below remains
separate. The trained local classifier is not yet a reliable skip filter.

## Current inputs and models

- Da Costa, Elandsgracht and De Poort use municipal 360-degree panoramas as visual
  reference, with selected frontage observations compiled into authored recipes.
  The studies do not run an automated model against every building.
- `scripts/build-panorama-facade-review.ts` has an optional local Ollama proposal
  path (its usage example names `qwen2.5vl:7b`) and requests aimed panorama crops.
  This is older diagnostic tooling, not a certified city appearance pipeline.
- `scripts/extract-facade-grammar-openrouter.ts` names Gemini 3.1 Pro Preview and
  Claude Sonnet 4.6 as its two defaults, but immediately rejects legacy street
  inputs. Do not treat it as an active production service or bypass its guard.
- The newer photo experiments run local Grounding DINO and SAM on facade strips.
  In `facade-photo-review/local/dino-sam-mps-03/report.json`, the mean repeated
  timings across three development images are 0.2903 s DINO Tiny and 0.1345 s
  SAM using DINO boxes. Preprocessing/forward/postprocessing are included; image
  download, rectification and disk writes are not. No paid API inference.
- These are development observations, not general accuracy evidence. The
  ten-source city-variety report has six renderable sources and four abstentions;
  it explicitly does not measure accuracy or certify any map asset.

## Comparable API arithmetic

Assume one request uses 1,500 billed input tokens INCLUDING image, instructions,
schema and metadata, and 250 billed output tokens. Use non-thinking mode where
available. If reasoning is enabled, its billed tokens must also be included.
Different models tokenize the same image differently: this is a normalized
budget comparison, not a claim of identical per-image token usage or accuracy.

`cost = requests * (inputTokens * inputRate + outputTokens * outputRate) / 1e6`

| Model / service | Input $/M | Output $/M | 100,000 requests | Batch equivalent |
| --- | ---: | ---: | ---: | ---: |
| Qwen3-VL-Flash, International or EU, <=32K context | 0.05 | 0.40 | $17.50 | Not assumed |
| Gemini 2.5 Flash-Lite | 0.10 | 0.40 | $25.00 | $12.50 |
| Gemini 3.1 Flash-Lite | 0.25 | 1.50 | $75.00 | $37.50 |
| Gemini 3.1 Pro Preview, <=200K context | 2.00 | 12.00 | $600.00 | $300.00 |

Rates: [Alibaba Model Studio pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing)
and [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing).
These are direct-provider rates, not a quote for the repository's OpenRouter path.

OpenRouter's public model catalogue was also checked during the follow-up. At
the same normalized 1,500/250-token workload, its listed Qwen3-VL-8B-Instruct
rates ($0.117/$0.455 per million) give $28.925/100,000 requests; Qwen3-VL-32B-Instruct
($0.104/$0.416) gives $26; Qwen3.7-Flash ($0.03/$0.13) gives $7.75. These are
different models/providers from Alibaba's Qwen3-VL-Flash. The follow-up compares
Qwen32B with Gemini; Qwen3.7 returned HTTP 404 under the benchmark request settings.
Source: [OpenRouter model catalogue](https://openrouter.ai/api/v1/models).
The dated selected catalogue is retained in
`.cache/facade-rebuild/appearance-routing-benchmark/openrouter-vision-prices.json`.

Cloud Vision Text Detection is $1.50 per 1,000 images after the first 1,000 free
monthly units; Label Detection is separately billed at the same initial rate.
Thus 100,000 OCR images cost $148.50 with the allowance available; OCR plus labels
cost $297.00 with both allowances. This is a different task from facade grammar.
Source: [Cloud Vision pricing](https://cloud.google.com/vision/pricing).

## Proposed reference workload

Use 100,000 distinct public-facing facade targets AFTER geometry filtering as a
scalable budgeting unit. This is NOT a count of Amsterdam buildings or facades.
The actual municipal boundary, public-wall inventory, corner elevations and image
coverage must determine N. One target can consume several crops and passes.

| Stage | Requests | Input/output tokens per request | Provider | Cost |
| --- | ---: | ---: | --- | ---: |
| Broad family, visibility, colour and exception flags | 100,000 | 600 / 120 | Qwen3-VL-Flash | $7.80 |
| Richer facade/storefront description on 30% | 30,000 | 1,800 / 350 | Qwen3-VL-Flash | $6.90 |
| Difficult-case escalation on 5% | 5,000 | 3,000 / 600 | Gemini 3.1 Pro Preview, standard | $66.00 |
| Optional separate storefront OCR on 15% | 15,000 | Per image | Cloud Vision Text Detection | $22.50 |
| Subtotal, conservatively ignoring OCR free allowance | | | | $103.20 |
| Including 25% proportional retry/usage allowance | | | | $129.00 |

Round to **$150 per reference pass**, or **$500 for three passes**. At 200,000
targets, identical routing costs $258/pass before rounding, or $774 for three.
A practical initial campaign allowance is **$500-1,500**, conditional on roughly
100,000-200,000 targets, compact outputs and limited strong-model escalation.
This does not include paid coding-agent usage or human checking.

Sensitivity matters more than rounding:

- Raising strong-model escalation from 5% to 20% makes the reference total
  $376.50/pass including the 25% allowance. At 200,000 targets and three passes,
  that is $2,259.
- Doubling input and output tokens doubles token-priced work; OCR stays fixed.
- Re-running an unchanged image because a palette or renderer changed is wasted
  inference. Cache observations separately from render recipes.
- A successful API response is not an accepted observation. Record paid failures,
  abstentions, corrections and accepted fields to compute cost per usable result.

## Proposed faster route

1. **Geometry before vision.** Use active BAG IDs, footprint, height, use,
   adjacency and public-face visibility to avoid querying sheds, hidden courtyard
   walls and party walls when they do not affect the route. Treat uncertain
   visibility conservatively; construction year is only a family prior.
2. **One inexpensive visual pass.** Produce independent fields for architectural
   family, image usability, material/colour, regularity and ground-floor features.
   A canal house can have a shop. Do not make residential/commercial exclusive.
3. **Ordinary visible fronts take the short route.** A regular residential facade
   can use a family recipe with coarse observed colour/floor/bay rhythm. Skip
   precise opening segmentation, OCR and ornament analysis when they add little.
   Keep unsupported opening positions inferred; a class label cannot observe them.
4. **Route exceptional regions.** Signs/awnings trigger a ground-floor crop;
   irregular windows trigger a detector; institutions trigger a broad-building
   recipe. Occlusion triggers another view or unknown status. A failed crop is not
   evidence that an interesting feature is absent.
5. **Local detection when needed.** Retain DINO Tiny first and SAM only when masks
   are useful. DINO Base/strong VLM calls are bounded, failure-specific retries.
   The existing 0.4248 s combined timing gives 11.8 compute hours for 100,000
   similar strips, or 3.54 hours for 30,000. This is a linear extrapolation from
   three images, not a sustained city benchmark. Complex fronts may cost more.
6. **Share acquisition and cache by content.** Download each panorama once and
   reuse it for neighbouring targets. Keep source hash, target wall, crop transform,
   model version and prompt/schema in the observation key. New evidence invalidates
   relevant observations; renderer-only changes do not.
7. **Audit the fast route.** Keep held-out streets and sample skipped fronts,
   especially missed storefronts, bright paint and unusual geometry. Optimise
   exception recall and correction effort rather than headline classification
   accuracy or a VLM's self-reported confidence.

## Model choices

**First comparison: Qwen3-VL-Flash versus Gemini Flash-Lite.** Both are cheap
enough that a small quality advantage can outweigh the inference saving. A
100,000-request normalized pass saves only $7.50 between Qwen and Gemini 2.5
Flash-Lite standard pricing. Do not spend days training solely to save that bill.

**Local Qwen3-VL-4B/8B is a candidate, not a measured speed improvement.** The
[Qwen3-VL-8B model card](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct) lists
Apache-2.0. It avoids per-request API charges but consumes local compute and
setup time. Benchmark short non-thinking JSON outputs; hosted Qwen3-VL-Flash
is a separate offering and its quality cannot be inferred from the 8B model.

**Ultralytics is plausible for a trained router/detector.** Its
[classification models](https://docs.ultralytics.com/tasks/classify/) start from
ImageNet classes; an Amsterdam family/exception router needs suitable labels and
evaluation. Detection, classification and OCR are separate capabilities. A small
classifier can be useful for repeated city refreshes, but first compare a simple
geometry baseline and the cheap VLM. Preserve full tall facades when preprocessing:
an automatic centre crop may remove the shopfront or gable. Ultralytics offers
[AGPL and Enterprise licensing](https://www.ultralytics.com/license); include any
applicable license expense when comparing with the existing local stack.

**Cloud Vision is a targeted OCR option.** Its generic labels are not an
Amsterdam architectural grammar. Test it only on crops with relevant lettering,
and compare its transcription with the inexpensive VLM before paying for both.

## Panorama input design and next measurement

Use municipal panoramas as the shared source, then derive perspective views
containing one target facade plus a small context margin. Reserve geometrically
rectified wall images for poses/identities with adequate evidence. Zero/missing
heading or height must not silently become metric registration. Keep the raw view
for verification when a rectified view looks wrong.

Try a 384-512 px overview for routing, a 768-1024 px facade crop for appearance,
and a larger targeted sign crop only if needed. These are experimental sizes,
not proven accuracy gates. Avoid sending the entire 360-degree panorama to every
building request: it dilutes target pixels and repeats irrelevant content.
[Gemini image documentation](https://ai.google.dev/gemini-api/docs/image-understanding)
explains resolution-dependent token use; record actual provider usage rather
than equating JPEG bytes with tokens. Preserve aspect ratio and target extent.

Next benchmark: 300-500 reviewed, diverse facade crops; compare cheap hosted
models and a local Qwen candidate on identical targets. Freeze a separate street
holdout. Record billed image/text/reasoning tokens, elapsed latency, throughput,
schema failures, family/colour correctness, missed exception flags and review
seconds. A 19-image paid development benchmark is now complete; see the linked
results. The larger independently reviewed benchmark is still needed.

Once inputs and the runner are ready, the hosted compute can plausibly be an
overnight job, subject to quotas and acquisition. Google's
[Batch API](https://ai.google.dev/gemini-api/docs/batch-api) offers a 50% discount
with a target 24-hour turnaround; batch is a cost tradeoff, not a latency promise.
The remaining project weeks concern acquisition, identity, renderer integration
and review, not weeks of model inference.
