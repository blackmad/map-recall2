# Roof enrichment

Roof enrichment is an independent, observation-producing pipeline on branch
`feat/roof-enrichment`. It does not mutate BAG geometry, OSM appearance tags or
renderer inputs.

## Stages

1. `npm run cache:roof-buildings` caches active BAG buildings whose centroids
   fall inside the polygon derived from OSM A10 relation 165334.
2. `npm run build:roof-observations -- --limit=500` caches shared PDOK
   `Actueel_orthoHR` tiles and measures roofs in inside-out order from Dam.
3. `npm run build:roof-review` generates the low-confidence-first human review
   interface at `.cache/roof-enrichment/review/index.html`.

The sampler requests 1024-pixel images for 128-metre tiles (12.5 cm/pixel),
supports buildings crossing tile boundaries, Polygon/MultiPolygon geometry and
holes, and erodes masks by one pixel. Shadow, vegetation and blown-highlight
pixels are counted and excluded. Results retain measured RGB, a constrained
palette colour, confidence, method version, imagery product, pixel diagnostics,
tile keys and review status.

## Current limitations

- `Actueel_orthoHR` does not expose acquisition date in the WMS response used by
  the sampler; `observedAt` remains null rather than inventing one.
- BAG footprints describe buildings, not individual roof planes. Mixed glass,
  tile, solar and extension roofs therefore receive low confidence. 3DBAG roof
  surfaces are the next geometry source to integrate.
- The first estimator uses an eroded per-channel median. Human review of the
  stratified pilot should decide whether dominant-cluster colour is better for
  mixed roofs before scaling across the A10.
- Roof material is a separate future observation. It must not be inferred from
  the quantized colour alone.

## Feasibility conclusion

The 140-building pilot spans central Amsterdam, De Pijp, Oud-West and
Houthaven. It proved that the imagery cache, complete masks, observation schema
and human-review workflow work, but it also showed that exhaustive roof-colour
measurement is currently low leverage for the rendered city:

- much of the visible distribution is genuinely dark grey, weathered and low
  saturation;
- a single colour per BAG footprint blends roof planes, extensions, glass,
  dormers, plant cover and solar installations;
- conservative quantization suppresses what little variation remains; and
- at the intended oblique street/canal viewpoints, correct roof shape and a
  few distinctive materials matter more than small per-building colour shifts.

Pause the citywide run. Preserve this branch and cache as a reproducible pilot.
Later, use aerial evidence selectively for distinctive classes such as orange
clay tile, slate, green copper, glass, vegetation, solar-dominant roofs and
landmarks. Ordinary roofs should use shape/material/age priors until 3DBAG roof
planes can support separate observations rather than one blended footprint.
