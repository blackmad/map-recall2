# Facade vector pilot — 2026-09-27

The six-model experiment ran locally and through the configured OpenRouter key.
It does **not** establish that LLM-generated facades are accurate enough for the
game. GLM 5.3 Flash produced four provisional coarse-only candidates
(structured sources 0/3, direct SVG sources 4/11);
no model/arm passed the reviewed multi-building gate. Keep geometry as proposals.

Gallery: http://localhost:5195/data/facade-review-galleries/vector-pilot-v2/index.html

## What ran

The three arms use the same source JPEG: direct SVG, structured description to
SVG, and the same structured description with an additional OccFacade overlay.
Coordinates cover the entire source crop; neither ownership nor metric wall
registration is asserted. Inputs and outputs carry SHA-256 bindings. Every paid
attempt has a local receipt and a reservation in the existing cumulative ledger.
Raw provider outputs and validation failures remain in the ignored local cache.

| Model | Attempts | Technically rendered | Recorded API USD | Median request seconds |
| --- | ---: | ---: | ---: | ---: |
| DeepSeek V4.1 Flash | 30 | 17 | 0.05199 | 5.3 |
| Gemini 3.1 Flash-Lite | 30 | 25 | 0.06401 | 3.7 |
| GLM 5.3 Flash | 16 | 14 | 0.01518 | 16.0 |
| MiMo V2.6 Flash | 9 | 8 | 0.00838 | 39.0 |
| GLM 4.6V | 7 | 1 | 0.01429 + unresolved request | 42.5 |
| Local Qwen 3.5 9B Q4_K_M | 9 | 2 | 0 | 58.4 |

These are technical success counts, **not accuracy scores**. Latencies include
failures and provider/local overhead, not just generation. DeepSeek and Gemini
cover all ten controls (0,3,4,11,13,17,30,64,80,93), all arms. MiMo and local Qwen
cover the three smoke cases 0,17,30. GLM 5.3 covers those three plus all arms for
3 and 4, and direct SVG for 11. GLM 4.6V covers 0/17 and a failed direct SVG for
30. This is not a balanced six-model leaderboard.

GLM 5.3 requires reasoning and ran at low effort; the others requested reasoning
off. All responses used an 8192-token cap, temperature zero, prepared full-view
images at at most 1024 pixels. Qwen used Ollama, a 16384-token context and seed17.
The catalog snapshot records exact model IDs, input modalities and rates.

## Development corrections and accounting

The initial structured prompt omitted the meaning of its four-element bounds
array. Models commonly returned endpoints instead of width/height. Those v1
runs are retained and excluded from the table. v2 explicitly states
`[x,y,width,height]` with an example; Qwen and GLM 4.6V still repeatedly returned
endpoints. This is an interface failure as well as an instruction-following
failure, not a general finding that these models cannot classify facades. A
future interface should use named left/top/width/height fields. Do not silently
reinterpret rejected outputs as compliant.

SVG requests also received a concise geometry limit after initial verbose
outputs exhausted the token cap. The input-preparation overlay bug was fixed
and visually verified before any requests used it. The final prepared manifest
is `8a9d1496074810a0b3f6b8fff20ef12764275a4f8e201b1e73ccab224e48712a`.

All development paid requests, including v1, total **$0.201457569654 in reported
charges**, with **$0.06 retained for one unresolved GLM 4.6V request**. That
request timed out at 240 seconds without a generation ID or usage receipt.
The shared ledger correctly stops subsequent paid calls; it has not been reset
or settled to an invented zero. Reconcile this request before more inference.
The pilot had an additional $1.50 ceiling; the configured key had $4.53 remaining
at start. Local requests have no API charges, including the 301.6-second local
fetch failure. Source `review-data/facade-vector-pilot/results.json` records the
accounting and exact request identity. Costs here are receipt amounts; the key's
aggregate usage can lag and is not a substitute for a request receipt.

## Visual results

Independent source-only notes were written before output review. Three agents
then inspected native renders/contact sheets; the root agent also inspected
representative outputs. These are model visual reviews, not human ground truth.
Review JSON under `review-data/facade-vector-pilot/` binds sources and outputs.

- Narrow brick source 0: some direct SVGs merge three rows into long shafts.
  GLM 5.3 structured retains the main unequal-width, three-row arrangement and
  entrance and is the closest coarse candidate; roof/colour/registration remain
  unverified. Merely adding the OccFacade overlay is not consistently better.
- Cream/brick source 17: several models recover the material split but erase
  the central three-level balcony recess and alter ground openings. MiMo's
  direct output invents many extra windows. The schema itself has no balcony
  assembly, so this limitation cannot be attributed solely to model perception.
- White gable source 30: SVG and structured variants simplify or misplace the
  asymmetrical openings and roof; DeepSeek's direct output is entirely black
  despite passing XML/raster checks. Technical rendering cannot be acceptance.
- Remaining seven controls in the two complete runs also fail acceptance:
  distorted or merged windows, lost recesses, and incorrect doors, roofs or
  retail. Gemini source13's broad blank-left/window-right layout is promising
  but still schematic. DeepSeek source80 assisted invents a bright green base.

GLM 5.3 was the most promising in the inspected sample: structured source3
retains its alternating row heads and base split, and direct sources4/11 retain
balcony levels/recesses that other arms missed. These four coarse candidates
are not exact matches or an unbiased success rate; only six GLM sources were
inspected and one has only a direct arm. Retain this model for the next test.
No general solution earned expansion to the planned 20-building holdout. The geometry
representation also needs separate glazing versus masonry arch profiles, and
separate storefront zones versus actual glazing apertures. Generic arched-head
rendering can exaggerate model shape suggestions.

## Named regression: source 0 squashed entrance

Owner screenshot identified the DeepSeek direct-SVG door as too narrow. The raw
provider SVG already places its opening at normalized x420..580, y800..1000.
Our sanitizer leaves every child element/attribute unchanged. Mapping the
1000-square coordinate frame to the 263x892 source produces a roughly 42x178px
opening, centered at x132px. The photo entrance is visibly wider and farther
right. The SVG gallery uses aspect-preserving image containment; this is not a
CSS-only distortion. The square normalized contract is mathematically valid
only when independent x/y normalization is correct, but encourages the model
to draw square-canvas proportions. It likely contributed to the error.

For the next direct-SVG test, use the photograph's native pixel viewBox and
matching aspect ratio (0 0 263 892 for source0), with named pixel bounds for
structured output. Anchor opening bounds to reviewed CV proposals where usable.
Keep the original faulty output as regression evidence; do not globally widen
it, because its window/door positions and neighbour strip are independently wrong.

## OccFacade geometry baseline and next decision

A deterministic connected-component pass over the same ten full-view masks
produced 233 unaccepted window/door/shop proposals without another model call.
Exact pixel masks preserve positions much better than several redrawn examples,
but can fragment one opening into several boxes. In source17 the shop label
covers most of the ground strip, including brick and cars; the door mask is too
small to produce a proposal. Treat shop as a possible zone, not a window box.

The next bounded experiment should give the LLM numbered mask components and
ask it to select, reject, group and classify IDs. Preserve measured pixel bounds
when compiling geometry; do not ask it to redraw every coordinate. Material
bands, broad colour family and opening style remain useful LLM jobs. Missing
entrances require explicit source-supported proposals/verification, with unknown
left unknown. Add balcony/recess representation before claiming full-facade
fidelity. Evaluate the same ten controls, then a frozen holdout only after the
visible opening and entrance errors are resolved.

## Reproduction and checks

Inputs: `.cache/facade-assessment/vector-inputs-v1/manifest.json`.
Model receipts: `.cache/facade-assessment/vector-pilot/v2/{deepseek,gemini,glm,glm53,local,mimo}`.
Occ baseline: `.cache/facade-assessment/vector-pilot/occ-baseline-v1/manifest.json`.
Frozen development runner/renderer/sanitizer copies are in `vector-pilot/frozen-v2`.
The current runner additionally checks cached output hashes on resume and marks
local failures as zero API cost. Changed experiment hashes require a fresh path;
never replay the unresolved paid request to obtain a cleaner receipt.

```sh
node --import tsx src/canalRecall/facade/facadeSvgExperiment.test.ts
python3 -m unittest discover -s scripts/facade-eval -p 'test_sanitize_facade_svg.py'
.cache/roofline-eval/venv/bin/python -m unittest discover \
  -s scripts/facade-eval -p 'test_occfacade_vector_baseline.py'
node --import tsx scripts/review/build-facade-vector-report.ts \
  --root=.cache/facade-assessment/vector-pilot/v2 \
  --out=public/data/facade-review-galleries/vector-pilot-v2
```

Typed schema/renderer, SVG restriction and component/hash-binding tests pass.
Final gallery check: 45 cards, 132/132 images, no errors or horizontal overflow
at desktop1440 and phone390. No production appearance pointer was changed.
