# Roof and top-detail scope audit

Reviewed 2026-09-13 as a read-only source/compiler audit. This note separates three things: canonical roof geometry preserved by the city model, roof evidence present in photographs, and photographed roof details that were actually extracted or rendered.

## Current thousand-building source batch

The completed supplemental manifest contains 621 buildings: 443 from `da-costa-expansion-550m-v1` and 178 from `da-costabuurt-v1`. Every record has a `full` and `ground` crop; the manifest has **zero `roof` tiers** (`scripts/review/thousand-building-sources-supplemental.json`, `records[].tiers`). Therefore the 621-building source batch provides no dedicated roof crop or roof-specific source binding. The earlier source-mix inspection found roofline/gable/dormer visibility in some full crops, but that is photographic visibility only and does not establish a metric roof match.

The source inventory is geographically limited to the Da Costa/Jordaan cached areas. The bounded source-mix audit found 9/12 inspected full crops were historic brick row/canal-style facades and 3/12 were modern/postwar apartments; only one had a clearly legible commercial frontage. This is a coverage warning, not a neighborhood-wide typology estimate. See [`thousand-building-source-mix-review.json`](thousand-building-source-mix-review.json).

## Preserved roof geometry

The current city release explicitly publishes canonical roof surfaces from 3DBAG LoD2.2: `public/data/city-expansion/current.json` reports `studyRoofs.geometrySource: "3dbag-lod22-roof-surfaces"`, 6,662 candidate slanted buildings, 679 withheld candidates, 5,983 delivered buildings, and 19,606 roof surfaces. The extraction helper in [`facadePointCloud.ts`](../../src/canalRecall/building/facadePointCloud.ts) reads semantic `RoofSurface` polygons and preserves their vertices, normals, slope and azimuth (lines 116–143). This is source geometry preservation, not a photograph-derived dormer, gable, or roof-window reconstruction.

For an owner with canonical surfaces, the Three renderer uses `owner.geometry.building.surfaces` directly (`cityAppearanceThree.ts:229–236`). When surfaces are absent, it creates an approximate roof cap from the footprint at the maximum building Y (`cityAppearanceThree.ts:122–142`); that fallback is a flat proxy and carries `approximateMassing` identity. Neither path claims that the roof silhouette matches a cached photograph.

## Photo roof evidence and extraction

The separate temporal evidence inventory contains 28 cases with 46 `roof` candidates, alongside 46 each of `full`, `ground`, and `context` candidates. Its summary says `registeredTemporalObservations: 0` and `recoveredFeatures: 0` (`scripts/review/temporal-evidence-inventory.json:1–6` and `summary`). These roof candidates remain unregistered alternatives, so they are not evidence of released roof placement.

The active replacement development manifest has only `full` and `ground` sources for its 12 cases, and remains source-bound rather than resolved (`scripts/city-appearance/fidelity/active-development-manifest.json`). In the saved extraction results, the 59 `development` phase results contain no roof/dormer/gable feature records. The 1,647 `neighbourhood-1000-preview` results contain 58 results with roof/dormer-like text, mostly features named as dormer windows, but that phase is a neighborhood preview and is not the active development roof set or a release acceptance result (`.cache/city-appearance/fidelity-extraction/analysis-results.json`).

There are two explicitly source-informed development repairs for the prior 28-case preview: [`next-stage-roofs.ts`](next-stage-roofs.ts:1–21) adds a dormer window and upper roof fill for case 20 and a stepped-gable outline/top window for case 22. The helper checks the exact source hash/date before applying them and labels the additions `agent-inspected`; it is a source-space preview repair and does not edit canonical metric roof geometry. The release-readiness note records these as partial repairs: case 20 still lacks the roof surround and related detail, while case 22 still lacks balconies and has merged masonry/window surrounds (`scripts/review/next-stage-release-readiness.md:14–15`).

## Acceptance boundary

The evidence supports this statement: canonical 3DBAG roof planes are preserved for the current city release, and a small number of named preview cases have source-informed roof silhouettes or dormer windows. It does not support the statement that the 621 newly acquired buildings have photographed roof details extracted, registered, compiled, or faithfully rendered. The new batch needs a dedicated roof tier and verified roofline registration before roof/dormer fidelity can be counted as coverage.
