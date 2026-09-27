# Photo-to-facade vector pilot

2026-09-27. Status: six-model pilot executed; no general facade winner accepted.
See [measured results](../../scripts/facade-eval/FACADE_VECTOR_PILOT.md). One
provider charge remains unresolved; further paid calls stopped.

The owner asks whether a vision LLM generating an SVG facade could replace the
growing collection of separate window, door, retail and material passes. Test
this directly before adding another production model. Existing OccFacade masks
remain useful candidate evidence, not authoritative labels.

## Next contract correction — squashed source-0 door

Use native source-pixel coordinates and an aspect-matched SVG viewBox in the next
revision. The normalized-square experiment is retained below as the executed
protocol, not the preferred next protocol. In the DeepSeek example the generated
door becomes 42x178px when mapped to the 263x892 source, far narrower than the
photo. Sanitization did not alter its geometry. The next test must distinguish
model geometry errors from format-induced aspect mistakes and use named box
fields; do not stretch whole outputs to compensate.

## Comparison

Use the same ten patch-control sources (indices 0, 3, 4, 11, 13, 17, 30, 64,
80, 93), with source hashes from wall-patch-controls.json. Include the full view
for context and a target outline. Preserve original photos for inspection.
Occluded buildings remain in the test: inability to observe is an expected
answer. These controls were used in development, so report this as a pilot,
not an unbiased held-out evaluation. Freeze prompts before a subsequent
20-building holdout drawn from the remaining cohort.

Run three arms with identical source images and the same model:

1. Photo to SVG directly, with viewBox, separate named element groups and
   explicit observed/inferred/unknown metadata.
2. Photo to a compact facade description, rendered deterministically to SVG.
3. Photo plus full-context OccFacade proposals to the same facade description.

The structured description records normalized coordinates, facade boundary,
wall material regions and colour families, floor/bay layout, individual opening
bounds and shapes, entrances, storefront glazing, sign regions and visible roof
outline. Every feature carries visibility and evidence references. Repeated
patterns may be compactly expressed but must preserve observed exceptions.
Do not infer exact lettering, unseen side walls or physical albedo from a photo.
Keep camera-space observations separate from rectified facade coordinates.

Reuse `src/canalRecall/facadeDescription.ts` and the existing source-shape and
storefront compilers rather than introduce a second production schema. Its
features already cover doors, windows, material bands, awnings and fascia.
An experiment adapter may use normalized coordinates, but must convert to
explicit source pixels and preserve unknown registration. The change being
tested is whole-facade inference and SVG representation, not a claim that
structured facade extraction is new to this repository.

Use OccFacade's window/door/shop/roof classes as optional proposals; full-view
inference is required because the same-photo crop experiment exposed strong
context dependence. Vistas occlusion evidence and the source photo may veto a
proposal. Never turn a union of models into automatic acceptance.

## Evaluation and decision

Rasterize all three arms at identical resolution and put photo, vector result
and overlays together. Restrict SVG rendering to local declarative geometry
(no scripts or external resources). An independent visual reviewer checks:

- Visible window/door counts, positions and shapes; missed entrances are severe.
- Storefront versus residential glazing and correct ground-floor material band.
- Wall material/colour-family agreement; do not grade literal RGB as albedo.
- Invented features behind foliage, wrong building ownership and regularization
  that removes real asymmetry.
- Valid output, correction count, actual billed input/output/reasoning tokens,
  wall-clock latency and cost per usable facade, including failures/retries.

Test the winning representation on the 20-building holdout before expanding.
Choose raw SVG if it actually wins fidelity and correction effort; otherwise
keep structured output so the same data can feed SVG previews and 3D components.
SVG is suitable for a facade texture but does not itself recover depth, roof
geometry or correctly register a photo to its footprint. Maintain existing
source/owner/geometry checks at the rendering boundary.

## Cost assumptions, not measurements

At 4,000 total input tokens (image plus instructions) and 3,000 billed output
tokens including reasoning, standard USD API estimates are:

| Model | Input/output per million | Per facade | 100 facades | 4,218 source views |
| --- | --- | --- | --- | --- |
| Gemini 3.1 Flash-Lite | $0.25 / $1.50 | $0.0055 | $0.55 | $23.20 |
| Gemini 3.8 Flash | $0.75 / $3.75 | $0.01425 | $1.43 | $60.11 |
| Claude Sonnet 5 | $2 / $10 | $0.038 | $3.80 | $160.28 |

Verified against [Google pricing](https://ai.google.dev/gemini-api/docs/pricing)
and [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing).
Google's quoted 3.8 Flash prices apply through December 31, 2026. Image token
counts vary by model and resolution. Verbose SVG, reasoning, additional views
and review/retry calls can substantially raise these estimates. An equally
sized second pass doubles them; batch pricing is currently half standard for
these models. SVG is text output, not a separately charged generated image.
4,218 is the current diagnostic source-view count, not a city building census.

Start with one model across all three arms, then compare a cheaper model on the
winning representation. Ten sources x three arms at the Sonnet assumption is
$1.14 before review/retries. Local Qwen has no API fee, but its earlier door
omissions mean that free inference alone is not a quality argument. Record
actual usage before any district-scale run. These were pre-run estimates. The completed pilot cost and limitations are in
the measured-results report linked above.
