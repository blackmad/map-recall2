# Posthoornkerk source and review notes

Draft ready for coordinator integration; **visual/game acceptance pending**. Builder signature is `buildPosthoornkerk(_w:number,_d:number,b:BuildingTools)`; geometry is baked to native east/south metres with scale1. Register `posthoornkerk-spec.json`, dispatch this builder, export through the shared generator, refresh runtime bundles and merge useful POI facts. No shared file or git-index mutation was made by this worker.

The genuine destination remains `extract_landmarks_213091641`. Current physical scope is BAG parent `0363100012167529`, OSM `w43040630`. The destination's older numeric OSM identity no longer resolves as a current way and is not suppression evidence. BAG construction year1673 conflicts with architectural history; the [register](https://monumentenregister.cultureelerfgoed.nl/monumenten/1289) describes the 1860–1863 church and 1889 front towers. No second destination is created for office aliases within the church.

The source polygon, original longitude/latitude rings, local rings, roof semantic evidence, neighboring parents and heights are in `scripts/landmarks/posthoornkerk-footprints.json`. Native anchor [4.89063,52.381275], rotation −44.025662664°. +z faces southwest toward Haarlemmerstraat. The front wall is around local z25.85; the gated forecourt extends toward z36.65. The adjoining presbytery, school and street buildings are retained. The modeled church has no surveyed footprint hole; its forecourt is outside the footprint and remains open overhead.

All original source bytes live privately at `/Users/blackmad/Code/map-recall2-source-data/models/posthoornkerk/`. `research-manifest.json` distinguishes raw downloads, separate projected photographs, failed requests and acquisition/projection metadata. Root must run the scoped archiver after registration, verify and publish the source pack before committing the model, then record its source commit. This worker was explicitly forbidden to stage, commit or push.

Inspect these private references with the CPU images:

- `processed/02147.jpg`: 2025-06-16 municipal whole front; `02146.jpg`: adjacent lower/context view. Original equirectangular bytes and camera provenance are in `raw/recording_2025-06-16_03-46-32_0214*.jpg`.
- `processed/02487.jpg`: 2025 rear/church and separate presbytery; tree occlusion limits the upper rear facade.
- `raw/roof-aerial-2026.jpg`: explicit 2026 PDOK ortho layer, checked against service capabilities. It confirms roof layout, dormers and neighbor separation; tall-spire ortho displacement does not establish footprints or height.
- `raw/roof-context-2014.webp`: clear full roof silhouette, dated2014-09 in archived address page; `opposite-2012.webp`: reverse roof/context. These agree with current aerial roof families.
- `raw/front-2017.webp`: detailed front portal, timber doors and gate; `front-drawing.jpg`: undated operator elevation drawing, cross-checked against current facade before use.
- `raw/historic-front-operator.jpg`: undated archival silhouette; `front-commons.jpg`: older bMA photo, copyright attribution permission recorded from archived Commons catalogue. The 2007 upload date is not the photo date.
- `raw/register.html`, `operator.html`, `operator-venue.html`, `operator-history-languages.html`, `municipal-address-history.html`, `bag-area.json`, `osm-current-map.xml`, `3dbag.json`: original research/API bodies.

One bounded Amsterdam Beeldbank name/address search and a Bouwdossiers address search returned viewer shells, saved privately. No catalogue result or drawing sheet is claimed inspected. Failed Overpass requests are explicitly transient; the current OSM map API succeeded. A native-CRS aerial request returned a blank image despite HTTP200; it is retained as failed evidence. The WGS84 retry and explicit2026 request yielded identical useful roof photos.

Architectural assertions with source, part, date, confidence and resulting geometry are in `architectural-assertions.json`. `posthoornkerk-research.json` records uncertainties: broad nave/aisle heights are surveyed, while needle stage proportions and the crossing spire's height are photo-guided. The published64m twin-tower total includes the iron cross. Do not replace the whole church with a 3DBAG equipment/crest maximum, or copy fitted steep-spire roof plates.

Verification commands:

```sh
node --import tsx scripts/landmarks/posthoornkerk-export.ts
node --import tsx scripts/check-posthoornkerk-geometry.ts
python3 scripts/landmarks/posthoornkerk-source-manifest.py
```

Focused geometry checks pass on the builder and compressed decoded GLB, including exposed aperture fractions, aisle/transept panes, timber portal, open forecourt, separate supported roof levels, upward slate faces and exact parent suppression. The isolated export is 38,836triangles, 443,700bytes and zero textures. Scope-specific TypeScript checking passes.

Initial probes found buried angled-aisle glazing and a low-transept pane overlapping a flying-buttress foot. These were fixed and rechecked. The first CPU front image remains as diagnostic evidence; CPU preflight is neither independent visual review nor city-scene acceptance.

Root's prepared harness is `scripts/landmarks/posthoornkerk-review.mjs`, adapted from Faralda. It is unrun because root owns the serial GPU. It captures a default gallery view and four lower rotations, selects the genuine route destination, checks the finish/pin/source, exact suppression and separate pyramid caps, retained resident/drawn neighbors, physically clicks the sourced card, and captures both live sides. Use native bearings44.02566/224.02566, zoom17.8/pitch55, then closer source-facing detail where useful. Full acceptance and meaningful shared regression/performance checks remain pending.

Final decoded failure evidence: `artifacts/posthoornkerk-draft/decoded-roof-failure.glb` preserves the export in which a tiny near-collinear footprint top triangle inverted during compression. Five top-plane numerical remnants below0.003m² were removed; exact wall vertices remain. The final compressed export passes upward normals and all front/side/rear aperture checks. Rear chancel/chapels use five-sided endings and connected lower gables, confirmed against current aerial/survey families.
