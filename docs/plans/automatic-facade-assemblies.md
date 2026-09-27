# Automatic facade assembly implementation — 2026-09-27

## Reproduce

`node --import tsx scripts/review/run-block-assemblies.ts`

Requires the existing source-bound `banana-head-on-v1` image/receipt cache and
head-on-3d-v1 scene assets. No API call by default. Open
`http://localhost:5195/canal-drive/facade-texture-demo.html?study=block-auto`.
The dropdown also exposes the unchanged-method strip2 holdout. Toggle
**Automatic assemblies** for the original textured shell at the same camera.

## Implemented contracts

- Deterministic image candidates and stable IDs; SHA-checked source receipts.
- Ground-level entrance proposals contain an entire convex mouth. Missing edge
  support withholds geometry; cream pixels alone do not authorize a cut.
- ID-only GLM classification never supplies coordinates. Unknown/non-door roles
  veto an entrance preview. Its low confidence does not establish acceptance.
- Balcony/window pairing is atomic: full aperture, solid glazing, transom and
  mullion, slab, front and side rails, inferred depth. Rejected pairs retain the
  original observed opening and do not erase paint.
- Awning mesh builder with sloped canopy, fascia and side caps. Separate real
  photograph tests presence classification only; owner-bound placement remains
  unresolved and is not fabricated.
- Separate independent inventory and review records. Neither supplies geometry.
- Local image-layer experiment: clean colour and semantic mask outputs are kept
  separate. Whole-image replacement is rejected. Bounded balcony inpaint is
  conditional on source hashes, edge alignment, complete projection masks,
  unchanged pixels outside masks, and visual review.
- Original manual arch remains only in the separate regression study.

## Current limits and next correction

This is an **experimental partial pipeline**, not a completed block or rollout.
Nine strip1 balcony assemblies survive the paint-cleanup gate; one retains its original appearance. Nine holdout balconies remain provisional; a tenth is withheld because its inferred extension is an outlier that crosses the shopfront. Strip1 has eight entrance proposals,
only four edge-supported mouths, and the ID classifier withholds one of those;
three reached geometry preview, but independent close-up review rejected all three for duplicate painted reveals or wrong surrounds. All ground candidates remain visible in reports as withheld; their original appearance is preserved. Strip2 admits no uncertain ground entrances. Shopfront bays
still need grouping into complete retail assemblies; inferred depths remain
unmeasured. Completion requires independent visual acceptance for every inventory
item, not equality of candidate counts.

The next correction targets large mixed glass/door outer mouths, narrow cream
entrances without reliable arch edges, and grouping multiple shop panes before
geometry fitting. Broaden only after these pass, then run the same method on the
holdout. Do not lower gates to make coverage look better.

## Cost and evidence

The user-authorized additional ceiling is $2, enforced by the shared spend ledger.
MAI/Azure rejected two requests with a Content-Length error (including an explicit
header retry), both recorded at $0. No quality conclusion about MAI is possible.
Nano Banana clean and mask trials cost $0.275858 combined. GLM ID classification
and real awning reference cost $0.0011980485 combined. Total: **$0.2770560485**.
No local-model throughput claim is made.

Working receipts, numbered overlays, masks, geometry reports and captures live in
`.cache/facade-assessment/block-assemblies-v1/`. Public scene/report assets are
reproducible local ignored outputs. Compact review evidence is versioned under
`review-data/facade-vector-pilot/block-assemblies-v1/`.

Checks: focused detector/classifier/geometry tests, TypeScript, desktop/mobile
camera-preserving before/after checks, and front/left/right assembly captures.
Captures are evidence to review, not automatic visual acceptance.
