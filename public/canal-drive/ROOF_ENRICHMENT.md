# Roof enrichment

Roof enrichment is an independent, observation-producing pipeline on branch
`feat/building-enrichment`. It does not mutate BAG geometry, OSM appearance tags or
renderer inputs.

## Stages

1. `npm run cache:roof-buildings` caches active BAG buildings whose centroids
   fall inside the polygon derived from OSM A10 relation 165334.
2. `npm run build:roof-observations -- --limit=500` caches shared, finalized
   PDOK `2025_orthoHR` tiles and measures roofs in inside-out order from Dam.
3. `npm run build:roof-review` generates the low-confidence-first human review
   interface at `.cache/roof-enrichment/review/index.html`.

The sampler requests 1024-pixel images for 128-metre tiles (12.5 cm/pixel),
supports buildings crossing tile boundaries, Polygon/MultiPolygon geometry and
holes, and erodes masks by one pixel. Shadow, vegetation and blown-highlight
pixels are counted and excluded. Results retain measured RGB, a constrained
palette colour, confidence, method version, imagery product, pixel diagnostics,
tile keys and review status.

## Current limitations

- The legacy footprint sampler now requires a finalized year layer. Older
  `Actueel_orthoHR` caches must not be mixed with pinned observations.
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

## LoD2.2 roof-plane and RGB DSM pilot — 2026-09-01

The 3DBAG geometry cache now retains semantic LoD2.2 `RoofSurface` polygons as
well as walls. The 28 successful buildings in the façade sample contain 65
distinct roof planes (1–11 per building, median 2), confirming that one BAG
footprint colour discards real structure.

Two independent pinned-2025 measurements now target those exact planes:

- `npm run measure:roof-planes` samples PDOK `2025_orthoHR` WMS pixels with a
  0.375 m edge inset. The pilot measured all 65 planes from 38 cached tiles.
- `npm run cache:roof-point-cloud -- --limit=5` discovers direct 2025 RGB LAZ
  downloads from PDOK's CC BY 4.0 `digitaaloppervlaktemodel_20cm` OGC API,
  verifies LAS signatures and hashes every tile. `npm run
  measure:roof-point-cloud` joins those photogrammetric points to 3DBAG planes.

The first five-building cross-check covered 12 planes. Eleven had enough DSM
points. Because the 3DBAG and photogrammetric surfaces are independent, their
modal plane offset was 0.35 m median (up to 0.95 m); sampling therefore finds a
per-plane offset within ±1 m, then retains only a narrow ±0.12 m band. Nine of
12 planes agreed with the orthophoto within RGB distance 20 and remain review
proposals. Two were rejected for cross-source colour disagreement and one for
too few points. Median RGB distance among comparable planes was 2.83. Nothing
is accepted without human review; `npm run build:roof-plane-review` provides a
fail-closed plane overlay sheet.
