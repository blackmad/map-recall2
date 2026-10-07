Haparandaweg 9 candidate handoff — 2026-10-07

Candidate asset SHA256 `b5e64d531df33d825943c0c713af8f0b6b91aff7870f8934ae1ece7def4f8e79`; 36,232 bytes, 1,752 triangles. This is a worker candidate, **not visually accepted**.

Owned source files: `haparandaweg-9-builder.ts`, `-spec.json`, `-footprints.json`, `-research.json`, `-extract.mjs`, `-export-draft.ts`, `-check-geometry.ts`, `-cpu-review.py`, this handoff. No shared registration/catalogue/queue/version/runtime/bundle/production asset/GPU/cloud/index mutation or commit was performed.

One physical official Pand `0363100012122663`, VBO `0363010001010865`, address9, in-use2002. OSM alias `w268508574`. Native anchor `[4.8731,52.39506]`, metre scale1, X east/Z south, north offset0. Survey roof owns its top at7.18–7.28m relative0.471mNAP; footprint403.85m², no holes. Neighbor11 `0363100012104965` and all other neighboring Pands remain separate; school/apartment replacements must remain enabled/visible.

Critical scope evidence: `artifacts/haparandaweg-9/processed/front2021-scope.jpg` overlays actual BAG vertices on dated leaf-off panorama. Pand9 owns charcoal3upper/2lower front plus tall stair glazing; dark short return; and **left** pale workshop bay/blue door only. Pand11 owns right blue door and upper4-pane group. The earlier preliminary broad interpretation that all pale wall belonged11 was corrected by this projection. No duplicated neighbor door/window and no building-name lettering was added.

Canonical raw pack is staged at `artifacts/haparandaweg-9/source-pack/models/haparandaweg-9`, original HTTP/photo bytes/checksums/retrieval logs in `raw/2026-10-07/manifest.json`, derived views separate under `processed/2026-10-07`. Coordinator must verify, commit/push sources and record the source commit in research/spec **before public model commit**. Reused school north2025 original photo/metadata copied with cache provenance `cdbe87c8`, but closer2021/2025 own sources drove facade. The west2022 panorama sees neighboring Archangelkade4 courtyard and does not establish9rear facade. Retained as explicit failed applicability/context evidence. Beeldbank exact9 query returnedJS shell; no invented inspected archive drawing. Historic register loop not applicable to this ordinary2002industrial building. Python CA failures retained; verifiedcurl HTTP200 succeeded, no permanent network block.

Decoded checks:114 sparse and1,368 dense first-hit glazing probes, zero failures; no downward roof triangles; two front-recess/neighbor-outside vertical probes clear; finite native bounds. Initial dense probes hit intended central window/door mullions on8triangles; panes were physically split around those bars rather than exemptions introduced. See `artifacts/haparandaweg-9/geometry-review.json` and `dense-glazing-probes.json`. CPU source-facing2021/2025/west2025 plus higher/opposite views saved as `cpu-*.png`; inspect `comparison.html`. CPU is preflight only.

Mapped-point footprint audit: no curated landmark/branded/orientation/shopfront point inside actual Polygon, only OSM address node9. Do not promote to automatic POI/card. Scan is `artifacts/haparandaweg-9/mapped-place-audit.json`.

Pending: root/source inspection, fresh independent failure review, production export/current fingerprint/shared checks, four lower gallery rotations, actual game placement/suppression11+school+apartments retention, source/live comparison, stationary rider camera pan desktop/touch, performance and route-start release smoke. West ground opening subdivisions partly occluded; unobserved adjoining rear faces intentionally lack speculative windows; left roller modeled closed rather than transient partially open source state. Preserve these limits in acceptance review.

Reproduce in isolated checkout:

```sh
node --import tsx scripts/landmarks/haparandaweg-9-export-draft.ts
node --import tsx scripts/landmarks/haparandaweg-9-check-geometry.ts
blender -b -t 4 --python scripts/landmarks/haparandaweg-9-cpu-review.py
```
