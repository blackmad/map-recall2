# Haparandaweg 57 recovered draft — 2026-10-07

Unchanged CPU candidate, **unaccepted**. Recovery inspected all six cached source perspectives, south/east source-facing CPU comparisons, higher/opposite CPU views and the preserved failed roof-monitor view. No new evidence-supported geometry repair was identified. Closed monitor ends are present in the current candidate.

Owned deliverables are `haparandaweg-57-builder.ts`, `-spec.json`, `-footprints.json`, `-research.json`, `-extract.mjs`, `-export-draft.ts`, `-check-geometry.ts`, `-cpu-review.py` and this handoff. Draft meshes/evidence remain under `artifacts/haparandaweg-57/`. Shared registration, bundles and git index were untouched.

Candidate `artifacts/haparandaweg-57/haparandaweg-57.glb`: SHA-256 `649ad9860aaa50589aef792550d0bbb995d6391a87b2ded737f50eeac5e40114`, 144,912 bytes, 9,413 triangles; original texture-free flat-color geometry using BuildingTools and house-geometry. No imported source mesh or photo pixels.

Scope is one 1979 industrial BAG parent `0363100012071094` / OSM `w57862438`, from official VBO `0363010000658576` at Haparandaweg 57. Native surveyed rectangular footprint is about 1,049 m², about 28 × 37.5 m; VBO usable area 1,044 m² is kept separate. No footprint courtyard or raised passage. Near-flat main cap is about 7.20–7.25 m above surveyed ground; narrow monitor reaches 8.27 m. Do not use 8.818 m NAP as whole-building height. Front 1→2 faces the open loading yard, with an approximate 17.8 × 4 m cantilever canopy. No yard slab, containers, fence, vehicles or neighbors are merged into the asset.

Suppression is exact, spatial suppression false: `NL.IMBAG.Pand.0363100012071094` and `w57862438`. Retain neighboring parents `0363100012078289`, `0363100012091590`, `0363100012238475`, `0363100012242823`. Actual layer suppression, fallback and neighbor visibility still require root game review; isolated CPU evidence does not establish them.

Photo comparison supports blue/teal ribbed upper cladding, reddish brick base, large left-front canopy, two front upper windows, two front lower windows, entrance/loading door, two east upper openings and three east low windows. Aperture/shutter state uses the leaf-off 2021 views with current 2025 assembly confirmation. North/west aperture totals remain unknown; no rear windows were invented. Canopy depth/brace count, loading-door dimensions, colors and pane subdivisions are approximate. Small real address numerals are omitted, and no building-name sign was added.

Fresh decoded compressed geometry check passed on recovery: finite bounds, zero downward roof faces, 15 roof-top ownership probes, 96 sparse and 1,152 dense glazing probes without failures, two clear outside-scope probes. These roof probes establish first-hit top ownership, not an independent roof-to-wall support audit. The two outside probes do not prove the entire yard clear. Evidence: `geometry-review.json`, `dense-glazing-probes.json`, `recovery-geometry-output.json`. Saved CPU images use the uncompressed sibling; fresh compressed render/native review remains pending. Preserved failure: `failed-monitor-end/` shows the earlier open monitor end; do not delete it.

Source pack staged at `artifacts/haparandaweg-57/source-pack/models/haparandaweg-57`. Fresh checksum verification matched all 21 original bodies against manifest and acquisition files; report is `recovery-source-verification.json`. Includes BAG/VBO, 3DBAG, neighbors, OSM, municipal panorama metadata and original 8k JPEGs, plus derived perspectives kept separately. Bounded Beeldbank address query returned a JS shell, with no archival image inspected; monument status not established for this modern industrial building. Some HTTP status codes were not captured, and panorama reuse terms remain unverified. Worker reports `CODEX_SANDBOX_NETWORK_DISABLED=1`; cached successful bodies reused, no network reacquisition attempted.

Root must sync/verify and privately commit/push `models/haparandaweg-57` before any public model commit, then record source commit/path and remove duplicated staged originals only after publication is verified. Source publication is pending; raws were kept intact. Root owns feedback checkpoints, registration, generation/fingerprints and bundles, queue/backlog updates, shared checks and git publication.

Remaining acceptance: independent failure-seeking review, root reference/render inspection, fresh generated current asset and shared asset/TypeScript checks, native higher plus four lower gallery rotations, actual game views from front/east, loaded residency and retained neighbors, exact suppression for all ordinary roof/building layers and fallback, loading yard/canopy clearance, desktop/touch camera-pan facade quality, performance evidence and route-start smoke. This is an ordinary requested building: audit no genuine interior POI; do not invent trivia or a route destination. No production/native acceptance is claimed.


## Loading-door correction after independent review

The recovered opaque loading door was rejected against the south2021 source crop. Root preserved the original candidate and builder in `artifacts/haparandaweg-57/failed-opaque-loading-door/`, then added two rows of light/glazed panels and removed ribs crossing their band. Six panes per row and dimensions remain approximate because the fence obscures divisions. The 2025 south view is obscured by foliage; it does not establish a changed door state.

Current candidate is `49f42b57f712752910299611e2b60fc100356a7834fc6458cad8d6d80c8ff41f`, 146,960 bytes / 9,605 triangles. Fresh compressed decode checks pass: 168 sparse and 2,016 dense pane rays, no local glass failures, 15 top-ownership probes and two outside probes. Saved original CPU images are now stale until fresh render completes; independent review is ongoing. Source publication and all native acceptance remain pending.


## Single-sided monitor correction

Independent FrontSide rays found 15/15 nonzero-height monitor skirts invisible from outside despite two-sided CPU appearance. Root reversed only skirt index winding, preserving failed49f42b57 and builder under `failed-inward-monitor-skirts`. Current exact compressed candidate is `4ba9134c5c69e716e30ec981e4e1c2a6e08fc44fbed02089a7c0a13ecafcb18f`, 146,960 bytes / 9,605 triangles. Existing pane/top checks pass; independent outward skirt recheck is pending. This failure demonstrates why two-sided CPU images alone are insufficient.

Raw sources are now privately published and remote verified at `16d644906c974150de90690eca7a8918e154cd6c`, canonical path `models/haparandaweg-57`. Keep acquisition copies needed by active CPU review until it completes, then remove duplicate originals after hash verification.


Final recovery evidence: independent current4ba9134c single-sided15 monitor probes pass,168/2016glazing rays pass,8353 neighbor samples and yard grid clear. Root produced and inspected two fresh orthographic views from the exact compressed asset using deterministic CPU rasterizer; these support massing and aperture assembly, but the renderer is two-sided and no native acceptance follows. Blender startup139 failure remains preserved. After remote source verification, root removed21 hash-matched duplicate originals from staging source-pack/raw; canonical private raws and active acquisition inputs remain. Cleanup audit: published-staging-cleanup.json.
