# Raster/vector and GPT effort diagnostic — 2026-09-27

User requested two tests: image generation followed by SVG tracing, and GPT
reasoning-effort comparison. This is a three-photo diagnostic, not an accepted
building rollout or measured accuracy benchmark.

## Raster workflow executed

Sources 0, 17 and 80 from the frozen vector-inputs-v1 manifest were viewed before
calling the built-in imagegen tool. Each photo received one source-informed
prompt describing visible architectural details. Prompts and original generated
PNGs are retained in `.cache/facade-assessment/raster-vector-v1/`; these bespoke
descriptions are a confound when comparing with generic GPT prompts.

The tool did not expose a model identifier, token usage or dollar cost. There
were three built-in generation calls, no OpenRouter calls for this trial.
Local VTracer 0.6.15 then traced a nondithered 32-colour version, bounded to a
1600-pixel longest side, preserving the generated image's aspect ratio.

| Source | Paths | SVG bytes | Trace seconds |
| --- | ---: | ---: | ---: |
| 0 | 658 | 273857 | 0.291 |
| 17 | 350 | 139511 | 0.322 |
| 80 | 755 | 312811 | 0.354 |

Times include the local Python tracing process, excluding generation and image
preprocessing. Each receipt contains source/output hashes, dimensions, package
version and settings. VTracer project: https://github.com/visioncortex/vtracer .

The raster route preserves architectural detail better than the previous coarse
structured schema, particularly balconies, double-door frames and lintels. But
it brightens/regularizes the buildings, changes framing and invents hidden shop
details. Source17 loses the little glass-block opening at lower left. Source80
gets a plausible generic shopfront instead of the observed partial evidence.
Tracing preserves these generated errors; it cannot recover source coordinates,
material measurements, or opening semantics. Hundreds of paths are artwork, not
a compact facade model.

## GPT effort experiment

Same GPT-6 Luna model, low/medium/high, fresh agents, no inherited conversation,
same shared prompt and original photos 0/17/80. Each writes native-pixel SVGs
once, without viewing its own output or revising. The shared prompt and outputs
are retained in `.cache/facade-assessment/gpt-effort-agent-v1/`.

These are agent sessions, not one-shot API requests: tool use, session overhead
and generation lengths vary. Per-image cost and inference latency are unknown.
Session timestamps are provenance only. One attempt on three images cannot
establish a general effort ranking. Official supported effort and vision inputs:
https://developers.openai.com/api/docs/models/gpt-6-luna .

An independent reviewer first compared anonymous A/B/C renders before seeing
effort labels. High was preferred for sources0/17; medium for source80. High
improves the brick house's entrance but shortens/rounds source80 windows and
omits its middle balcony. Low adds extra source80 openings; medium adds an
unsupported balcony hood on source17. All nine SVGs pass native sanitization,
but none is accepted as source-faithful geometry. More effort is not a reliable
substitute for measured positions and explicit uncertainty in this sample.

The metered runner separately supports GPT efforts, bounded price reservations
and streaming generation-ID capture. A historical GLM4.6V timeout has no ID or
usage, so the cumulative ledger still correctly blocks further paid requests.
Its $0.06 reservation stays counted; the trial does not reset or bypass it.

## Reproduce local transformations

```sh
python3 -m venv /tmp/canal-vtracer-venv
/tmp/canal-vtracer-venv/bin/pip install vtracer==0.6.15
node --import tsx scripts/review/vectorize-facade-raster.ts \
  --input=.cache/facade-assessment/raster-vector-v1/000-generated.png \
  --out=.cache/facade-assessment/raster-vector-v1/fresh-trace \
  --python=/tmp/canal-vtracer-venv/bin/python
node --import tsx scripts/review/build-facade-raster-effort-report.ts
```

Gallery: `/data/facade-review-galleries/raster-effort-v1/index.html`.
No game appearance pointers, bundles or accepted geometry are changed.

## Next decision gate

Keep raster generation as an appearance/detail candidate, not an authoritative
measurement stage. Freeze observed openings and facade silhouette first; score
generated detail against that geometry, with explicit unknown regions. Test a
generic prompt on ten controls before expanding. Raster/vector and direct SVG
need the same source observations to be a fair workflow comparison. The metered
effort test should use the same native-pixel contract, source set, output cap and
provider settings, record reasoning tokens, and repeat conditions before choosing
an effort based on price/quality. Reconcile the existing request before API calls.
