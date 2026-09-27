# Source-bound facade component output contract

2026-09-27. This is the next bounded interface for facade reconstruction. It
uses a vision model to adjudicate a fixed packet of source observations; it does
not ask a model to redraw a facade, make an albedo image, or produce a mesh.
The packet keeps the photograph and its registered pixel geometry authoritative.

The strip-1 head-on experiment demonstrates why. Its source crop preserves
irregular openings, balcony rails, shopfronts and roof beams. The generated
strip is a clean, useful illustration of broad rhythm, but it regularises
openings and replaces the source with a different 2752 × 1536 image. Its
receipt has no per-building source binding or pixel masks. Its coordinates, wall texture, depth and hidden detail are therefore experimental,
not accepted building measurements.

## Decision

Use **source-derived component selection plus a typed 2.5D sidecar**. A model
may select, reject, group and classify fixed source components. A deterministic
compiler maps the retained source pixels through the existing registration.
For the measurement-led control, model-generated coordinates and depth do not
replace source measurements. Separate, explicitly inferred generated-image
branches remain valid demo experiments; this is not a ban on rendering them.

| Candidate output | Useful contribution | Blocking failure | Decision |
| --- | --- | --- | --- |
| Current flat illustrative image | Candidate floor rhythm, broad material bands and prompts for inspection | Reframes the source, regularises openings and completes occlusion; it has neither owner binding nor source-pixel geometry | Gallery-only hypothesis |
| Source image + fixed instance masks + typed relations | Keeps observed positions; can group fragmented components and express a recess or rail without inventing its bounds | A single photograph does not yield physical albedo or metric depth | Build this next |
| Direct model mesh / textured mesh | Convenient demonstration asset | Depth, attachment and unseen faces are invented; a generated texture is a painted projection with no source registration | Separate inferred experiment; not measured reconstruction |

“Albedo” in a one-photo request is misleading. A source-photo colour sample has a `measured-provisional` status; it
is not illumination-free material colour. Generated-image colour can be used in
an inferred demo branch, but must not be reported as a source measurement.

## Fixed input packet

Create one packet per already registered source crop. The model receives the
original photo plus these immutable files:

- `source.jpg`, its SHA-256, native width/height and pixel-edge convention.
- `components.json`: connected-component IDs from the existing OccFacade
  baseline, their class, fixed mask/bounds, and component-manifest SHA-256.
- `component-outline.png`: transparent, numbered outlines over the photo. It
  has no filled class colours, preventing the `#00FF00`/`#0000FF` label-colour
  leakage observed in the vector pilot.
- `edge-candidates.json` and an outline sheet, if rail/recess decisions are in
  scope. Line endpoints are produced locally and carry IDs; the model selects
  IDs rather than drawing new lines.
- `occluders.json` and an optional outline sheet: fixed regions for tree,
  vehicle, sign, shadow or image-edge obstruction. They state uncertainty,
  never something to fill.
- `registration.json`: owner/elevation ID, geometry revision, source SHA,
  image dimensions, surface index, image-to-wall matrix, residual and status.
  It is read-only input, never model output.

An optional generated head-on strip may be included in a second ablation only
as `hypothesis.png` with a SHA-256 and the label `non-authoritative`. It cannot
supply components, colours, edges, masks, registration or completion.

## Model contract

The response is JSON only. It references IDs from the packet and never contains
pixel coordinates, RGB/hex, SVG, a transform, a mesh, or a replacement image.
A minimal sidecar is:

```json
{
  "version": 1,
  "input": {
    "sourceSha256": "…", "width": 1360, "height": 771,
    "componentManifestSha256": "…", "registrationSha256": "…"
  },
  "components": [
    {"ids": ["window-014"], "decision": "select", "kind": "window",
     "visibility": "observed", "confidence": "medium", "reason": "…"},
    {"ids": ["shop-002"], "decision": "reject", "kind": "unknown",
     "visibility": "occluded", "confidence": "high", "reason": "vehicle and glazing mix"}
  ],
  "assemblies": [
    {"id": "assembly-01", "kind": "balcony-recess",
     "componentIds": ["window-014"], "edgeIds": ["edge-031", "edge-032"],
     "depthClass": "inset-opening", "visibility": "observed",
     "confidence": "low", "reason": "…"}
  ],
  "materials": [
    {"componentIds": ["material-003"], "materialFamily": "brick",
     "colourFamily": "red-brown", "sampleComponentIds": ["material-003"],
     "visibility": "partial", "confidence": "medium", "reason": "…"}
  ],
  "abstentions": ["roof surface is not established by this crop"]
}
```

`kind` is limited to `window`, `door`, `storefront-glazing`, `balcony-door`,
`rail`, `awning`, `fascia`, `material-region` and `unknown`. Assembly kinds add
`balcony-recess` and `projecting-rail`; neither is silently coerced to a window.
`depthClass` is `flush`, `inset-opening`, `projecting-rail`,
`projecting-awning`, or `uncertain`. `unknown`, `occluded` and `uncertain` emit
no completed geometry.

### Prompt A: component adjudication

```
You are selecting evidence, not drawing a facade. The original source photo is
authoritative. The outline image and components JSON contain fixed source
components. Return only the contract JSON.

For every relevant component ID, select or reject it; group only existing IDs;
and classify it as window, door, storefront-glazing, balcony-door, rail,
awning, fascia, material-region, or unknown. State observed, partial, occluded
or unknown visibility and a low/medium/high confidence with a short reason.
Do not create components, coordinates, masks, openings, roofs, material pixels,
text, colours, transforms, or geometry. Do not use colours from the outline.
Do not complete any detail hidden by a tree, vehicle, sign, reflection or image
edge. A shop-region mask can be a zone, not an opening.
```

### Prompt B: recess and railing relations

```
The source photo and the selected fixed IDs are authoritative. Return only
assemblies in the contract JSON. Choose existing component and edge IDs; do not
draw bounds or lines. Use projecting-rail only when selected edge evidence is
attached to an observed opening or balcony-door. Use balcony-recess only when
its boundary is visibly supported. Otherwise return unknown or abstain.
A front-on generated hypothesis, if supplied, is non-authoritative and may not
supply an ID, boundary, colour, depth or completion.
```

### Prompt C: material evidence

```
Classify only visible wall evidence selected from the original photo. Return a
broad material family and colour family, plus existing source component IDs
that are eligible for later source-photo sampling. Exclude glazing, frames,
rails, signs, vegetation, vehicles, deep shadow and blown highlights. Do not
return RGB, hex, albedo, texture fill or colour sampled from any generated
image. Use unknown when the remaining wall is not representative.
```

## Compiler and evidence gates

The sidecar is experimental until it passes the same source gates as a facade
description. Its `input` hashes, dimensions, owner/elevation, geometry revision
and registration status must exactly match the packet. The compiler may retain
only existing component masks/bounds and map them through
`boundFacadeSource`/`fitFacadeFeature`; it may not alter `imageToWall` or use a
preview/ambiguous registration. Hash or dimension mismatch rejects the entire
sidecar, not merely a feature.

A renderer may turn a selected observed opening into a cutout and an observed
rail/recess into a bounded procedural feature only after the schema and compiler
support those kinds. It must not project `hypothesis.png` or an output
illustration onto a wall. Source-derived photo texture remains a registered
preview/provisional appearance input with its own visibility mask; occluders
remain transparent/withheld rather than painted over.

## Bounded implementation and QA

1. Produce ten frozen control packets from the existing OccFacade components,
   source crops and registrations. Add local edge candidates only for the rail
   and recess ablation; do not modify production facade records.
2. Validate sidecar JSON and every reference before model quality is considered:
   SHA/dimensions/registration binding, known IDs, no coordinate fields, no
   generated-image dependency, and no geometry from `unknown` or `occluded`.
3. Compare source-only component adjudication with the optional-strip ablation
   against frozen source notes: visible window/door count intervals, source
   pixel placement, material-band classification, balcony/recess preservation,
   invalid binding count and abstention count. The generated-strip arm stops if
   it changes or worsens a source-supported selection.
4. Inspect a second fixed holdout of twenty only after all ten packet bindings
   validate. Direct mesh remains outside this gate.

This gives a model a task it can perform—component interpretation—while leaving
registration, measurements, colours and geometry construction reproducible and
source-bound.

## Generated-image ablation alongside the source control

The user explicitly requested a generated-strip reconstruction demo. Test that
branch alongside this stricter source-component control: retain separate image
hashes, instance masks and alignment residuals, and mark all generated/inpainted
appearance as inferred. Compare visible opening counts, anchor positions,
balcony/recess preservation, material bands, and unsupported completion. Neither
branch may silently overwrite the other's observations. A clean-colour image
plus labelled masks is a useful experiment, not a measured albedo claim.
