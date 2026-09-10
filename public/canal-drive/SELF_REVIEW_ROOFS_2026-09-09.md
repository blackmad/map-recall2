# Roof extraction: street plus overhead — 9 September 2026

Twelve distinct buildings were inspected directly using four source-bound images each: a full street facade, its upper-roof crop, a tight aerial crop and wider aerial context. Broader useful frontage records were preferred. Existing conflict flags guided selection, but existing model answers were not read before these proposals were frozen.

This is a **machine-only extraction experiment**, not twelve human labels or a roof-accuracy score. Prior conversation supplied some roof-related context, so it is not a fully blinded benchmark. It used no paid API calls and did not alter geometry, the active image manifest or earlier ground-floor findings.

## What the overhead view resolves

Six packets support a `flat-with-front-pitch` roof-family proposal:

| Building | Combined visual evidence |
| --- | --- |
| Da Costakade 13 | A broad central flat deck is visible overhead; the selected side shows a sloping perimeter section. Vegetation prevents a confident decorative-top label for that side. |
| Da Costakade 2 / Hugo de Grootkade 1 | Street dormers sit in a steep front/perimeter strip; overhead reveals the larger level central deck. Wider context prevents mistaking deep edge shadow for water or an unrelated object. |
| Da Costakade 28 | The broad street face clearly exposes a sloping strip and small dormer; overhead reveals a large bright flat deck over the wedge-shaped building. |
| Da Costastraat 1 / De Clercqstraat 15 | A standing-seam front slope with dormers borders a flat-looking interior roof strip. The visible front material is metal-like, but that does not justify one material for the whole roof. |
| De Clercqstraat 7 | A neck-like decorative front and short roof-windowed slope sit in front of a much larger flat core. |
| De Clercqstraat 9 | The separate neighbouring neck-like facade also has a short front slope in front of a broad flat core. Retail branding was not used to infer its roof. |

The key improvement is distinguishing **a decorative gable, a local front pitch and the main roof volume**. These are family-level visual hypotheses, not exact roof solids. They should not trigger mesh replacement without further validation.

## What remains unresolved

- **Da Costakade 25:** stepped facade is clear; overhead contains a central roof area and raised edge structures, but a small pitch versus a raised flat attic volume is unresolved.
- **Da Costakade 4:** a large flat-looking central surface is visible, but its projecting front/tower-like section prevents a confident single roof-family label.
- **Da Costakade 14–26 complex:** the aerial footprint leaves the tile, interior areas are deeply shadowed and the street upper crop is too shallow. Expand overhead coverage and crop by bay.
- **De Clercqstraat 8/10:** stepped gables, a tiled front slope and a main deck are visible, but a long rear section is deeply shadowed. Do not pretend that the whole L-shaped roof is observed.
- **Hugo de Grootkade 20 complex:** the visible wing has level decks, services and solar arrays, but the full footprint is clipped and another wing is shadowed. A flat visible wing is not proof that the entire building has one flat roof.
- **Nassaukade 142:** its street parapet is straight; aerial light/dark divisions may be a pitch, level change or cast shadow. Resolution is insufficient to distinguish them reliably.

All twelve whole-roof material labels remain unknown. Dark gray is not automatically bitumen, bright gray is not automatically metal, and a visibly metal front pitch does not classify unseen rear surfaces.

## Artifacts and use

`.cache/da-costa-neighbourhood/self-review-2026-09-09/roof-findings.json` contains the frozen observations. Its proposal and eligibility objects contain only `roofShape`, `facadeTop` and `roofMaterial`; they do not overwrite earlier storefront, awning or sign observations. Each row carries street and both aerial image hashes, original source provenance, scope and limitations.

`roof-sources.json` and `NNN-roof-packet.jpg` preserve the inspection pack. The scripts `prepare-self-review-roofs.mjs` and `record-self-review-roofs.mjs` reproduce the pack and validate the reviewed pixel hashes before recording these separately authored findings.

Only fields with `fieldEligibility=true` are candidate primary suggestions. `unknown` is abstention, not a negative label. No output from this experiment belongs in a human-review export or supervised gold dataset.
