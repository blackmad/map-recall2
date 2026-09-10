# City appearance pipeline

Updated 9 September 2026. The current local milestone and tonight's human task are in
[the neighbourhood checkpoint](./NEIGHBOURHOOD_POC_PLAN.md).

## Outcome and publication policy

Build recognizable Amsterdam streets from source-bound, reusable observations:
coarse city massing first, independently supported local detail second.
Use **gated automation**: automatically publish a field only after its source and
calibrated quality checks pass; withhold uncertain detail and audit samples.

The next geographic steps are the current study, ten contiguous blocks, then approximately
ten blocks by ten blocks centered around Da Costa. This means roughly 100 blocks,
not a ten-block radius. An explicit versioned area configuration freezes each boundary.
The complete city is the eventual destination, not an instruction to spend beyond the
current cumulative $5 authorization.

## Architecture and implemented contracts

```text
Area configuration
  → source adapters and completeness ledger
  → canonical geometry + public-facing wall inventory
  → source-bound image packets
  → field proposals → blinded critique → bounded repair / unknown
  → human calibration and field publication gates
  → deterministic appearance tiles → bounded streamed renderer
```

### Area, source and processing

A version-1 area configuration contains stable ID, WGS84 bbox, origin, raw-cache and
output roots, panorama search extent/date and bounded concurrency. Existing Da Costa
and Eland presets preserve their fixtures. Custom areas do not import named anchors,
reference-photo labels or a shopping-street whitelist.

Acquisition validates URL/hash provenance, follows OGC/HAL continuation links and explicit
WFS pagination, detects duplicate/repeated pages, and fails incomplete counts visibly.
Counts use provider-specific units: 3DBAG CityObjects are not CityJSONFeature envelopes.
Unknown historic retrieval timestamps remain unknown. Actual fetch times are separate
from compilation timestamps.

Generic compilation preserves unclipped BGT features and canonical wall/roof surfaces.
The existing vertical offset remains explicitly approximate, not newly calibrated.
Area/config mismatch or incomplete acquisition blocks compilation. Only manifest-listed
3DBAG pages belong to a custom compilation; obsolete cached pages are not rediscovered.
Custom projected bounds contain all four geographic corners. Multipart exterior and courtyard
walls are inventoried with stable endpoint IDs and normals facing the courtyard void;
public-face checks exclude holes in road polygons.

Restartable jobs have stable IDs, versions, dependency input/output hashes, owner leases
and hashed artifacts. Changed or missing artifacts invalidate dependent work.
Handlers must be idempotent. Paid requests additionally reserve against one atomic global
journal; unknown charges stop further paid calls. Prior local spending is imported once.
Record the actual preprocessed request-image hashes for new inference.

### Geometry and observations

Retain BAG building identity, a geometry revision, source surface identity, and metric
frontage intervals. One source wall may serve several frontages. Human corrections have
priority only within their interval; conflicting accepted records withhold affected detail.
Clipping runtime triangles preserves canonical rings, holes, winding and roof geometry.

Each appearance field carries its source packet, capture date, derivation/preprocessing
version, observation origin and explicit unknown state. Review decisions bind to the
evidence they actually examined. A new geometry snapshot must not silently inherit an
old mesh diagnostic or placement interpretation.

Separate roof volume from facade top; storefront presence from sign text and tenant;
awning presence from construction and deployment. Stable structure and dated tenant or
seasonal details have separate refresh schedules. Trees use inventory placement and
height classes with loose typology priors; do not claim surveyed crown shapes.

### Self-review and human reference data

Run source/visibility/crop checks before extraction. Give independent visual reviewers
photographs before proposals or mesh diagnostics. On disagreement, use cached alternative
views first, at most three alternatives across two repair rounds; otherwise abstain.
Model agreement is not a correctness score.

Retain extraction, critique and final field disposition separately. Agent observations
remain weak supervision. Human reference sets are versioned and split by building and
street before tuning. Tonight's deliberately difficult queue diagnoses failure modes;
a geographically stratified sample is required to calibrate automatic publication.

New machine details remain experimental until that calibration exists. Signs and roof
changes remain opt-in. A reviewed placement with an unknown roof does not certify the roof.

### Tile delivery and runtime

The implemented compiler uses the existing city z14 grid and stable building ownership.
An owner tile carries complete geometry and observations; halo tiles contain references,
not duplicated geometry. Exact geometry/evidence revisions travel with the snapshot.
Tile staging is not evidence approval.

The implemented host-ready streamer accepts an index, bounded tile loader and
create/update/dispose render adapter. It loads visible owner dependencies without recursive
halo expansion, discards stale asynchronous results, retries explicitly and disposes resources.
Default limits are two concurrent loads and 24 cached tiles; capacity failures are explicit.

An implemented Three.js adapter batches source geometry by a small palette, preserves
roof/wall holes and winding, transforms explicit RD/NAP frames, and retains building and
source-face picking IDs. It creates actual GPU buffers, coalesces LOD updates and disposes
buffers/materials. Neutral geometry is the default; source-bound interval colours require
an explicit experimental option. Optional detail recipes add clearly identified illustrative
windows and positive-evidence storefront glazing, not measured opening counts. Contextual windows
use batched surround/glass/transom/sill layers for readable close-range relief, remain restricted to
geometrically exterior walls, and carry null observation IDs. Contextual entrance priors replace one
ground window on each eligible building's primary exterior wall. A stable building-identity hash
selects restrained glass variation and construction era selects trim family; neither is presented as
observed appearance. Canopies
require the explicit human-reviewed deployed-fabric gate; no shop names are invented.

Distance LOD uses approximate footprint massing versus exact source surfaces, with hysteresis.
Paint persists at facade/detail LOD; opening recipes are detail-only. The game renderer further applies
a reusable screen-scale facade LOD: hidden below z18.25, softened opening silhouettes until z19.35,
then full joinery. Tile residency is independent of that draw decision to avoid threshold refetches. The new
[streamed demo](./city-appearance.html) integrates this adapter with BGT street/water context,
inventory-based trees, building picking and frontage cameras. Its 12-tile budget and two-load
concurrency are explicit. This is a separate experimental viewer, not integration into the
main driving game or proof of physical-device/city-scale performance.

The complete-city MapLibre streamer applies compact runtime-only wall, street-base and flat-cap fallbacks to
otherwise uncolored BAG identities. Verified area priors and existing OSM appearance always outrank
them. The wall fallback is explicitly `citywide-identity-palette-v2-not-measured`; the independently
traceable base is `citywide-ground-storey-palette-v1-not-measured` with a fixed 3.2 m display height;
the cap fallback is `citywide-flat-cap-palette-v2-not-measured` and applies only when roof shape
is flat or unspecified. They add no delivery bytes, do not guess era, material or roof shape,
never color known unsupported pitched shapes, and never mutate cached source geometry.

The game discovers published appearance districts through the versioned
`/data/city-appearance/areas.json` catalog instead of hardcoding the Da Costa release in each
consumer. Catalog entries bind a stable area ID to a current-release pointer, display name, lesson
eligibility, and priority. Every release still passes its own content and area binding checks; one
invalid district is reported and withheld without erasing independently verified districts. Duplicate
BAG ownership across valid areas fails closed until an explicit overlap policy exists. This makes
incremental city coverage additive without weakening source provenance.

### Review-to-scene publication

`publish:appearance-demo` validates source bytes, current geometry/evidence and saved human
decisions before publishing immutable JSON/context assets. An atomic `current.json` selects
a complete release; old releases remain available. The browser verifies content hashes and
retains its prior scene on failed refresh. Publication and human saves share a server queue.
Refreshing never writes answers, changes unsaved form choices or spends on extraction.
Notes/crop repairs are exported as evidence-bound follow-ups without reinterpreting labels.
The local session token persists privately across restarts; stale-token retry preserves drafts.
Ground/tree context is now owner-bound into independently streamed z16 tiles. The browser keeps
building and context residency budgets separate, verifies compressed-byte hashes before gzip
decompression and disposes evicted resources. This establishes bounded neighbourhood transport;
source-class material semantics remain renderer-only: the standalone viewer uses reflective opaque
water, while the game uses a versioned translucent glaze matched to its basemap; roads, footways and
terrain remain matte and continue to share palette batches.
Bridge components retain exact BGT plan geometry and receive only a shallow renderer-owned deck
profile; streamed-resource telemetry exposes their live count for city-data integration checks.
physical-device profiling and route-scale memory measurements are still required before making
a whole-city performance claim.

## Acceptance and rollout

1. **Current study:** interval/containment regressions pass; no unsupported shop fallback;
   original and Eland views remain intact; source changes cannot revive stale opinions.
   Human review remains separate and unchanged by automated tests.
2. **Ten blocks:** freeze an area after inventory; compile a resumable staging run; audit
   all proposed distinctive signs plus a random ordinary-frontage sample. No unresolved
   wrong-building/wrong-wall publication defect may remain before wider rollout.
3. **Approximately 100 blocks:** measure photographed and usable facade length, field-level
   unknowns, repair/rejection rates, human minutes and cost per accepted observation.
   Trace a long route across tile boundaries with bounded memory and no duplicate details.
4. **Representative city samples:** include historic centre, nineteenth-century West,
   Zuid perimeter blocks, Nieuw-West slabs, Noord low-rise/industrial, Zuidoost complexes
   and contemporary infill. Hold locations out before training. Do not generalize West's
   architectural distribution to the whole city.
5. **City coverage:** publish conservative mass/material coverage first and validated detail
   incrementally. Prioritize frequently travelled streets without altering their appearance
   to make them artificially memorable. Keep missing evidence visible in coverage reports.

Provisional performance targets: at most 250 visible draw calls in a representative streamed
neighbourhood, 60 fps on a named desktop and 30 fps on an actual midrange phone. Record
device, resolution, p50/p95 frame time, transfer size, decoded memory and GPU estimate.
Headless mobile viewport checks are not physical-phone performance validation.

Audit image reuse/redistribution terms before shipping citywide photographic crops or training
on a new image source. Keep attribution with observations and distinguish linked evidence
from redistributed texture assets.

## Remaining work that needs evidence or integration

- Complete current human calibration, then a stratified held-out reference sample.
- Integrate the experimental streamed viewer with the main driving game; the first production seam
  is complete for mass/roof colour and a distinct era-sensitive street storey through a hash-verified BAG-ID sidecar consumed by the existing
  complete-city streamer. The setup now exposes a source-bound “Da Costa study” lesson whose endpoints
  come from that verified release and opens in a tested close 3D chase presentation rather than the
  default plan view. Four independently hashed owner tiles now transfer 1,717 compatible 3DBAG LoD2.2 source roof
  surfaces for 645 buildings with bounded residency and disposal. The per-surface gate retains coherent
  main roofs when lower annexes are incompatible; 81 of 726 slanted candidates remain deliberately withheld. The next seam is also complete:
  four independently hashed z16 facade tiles add source-wall-contained procedural windows, entrances and
  restrained trim bands with bounded residency, concurrency and disposal. Their reusable era prior now
  recesses glass behind the surround and adds a central sash mullion and glazed entrance transom only
  to pre-1965 buildings; all contextual entrances receive a shallow threshold. These details remain explicitly
  unobserved and cannot inherit the human evidence gate. A compact companion stream now brings all
  469 municipal tree positions/height proxies into the game using bounded z16 residency and GPU
  instancing; crown geometry remains a declared typology prior, and the renderer's tapered vertical
  trunk primitive is independently versioned. BGT water, greenery, footpaths, cycleways and bridge
  footprints now use a separate bounded game stream. Water receives renderer-owned shading; exact
  bridge records produce only source-aligned vertical understructure faces with an illustrative 0.55 m
  depth, while their redundant road-top surface remains withheld after close review found it conflicted
  with basemap road markings. Thirty-five classified BGT quay-wall and
  bank-protection lines add source-aligned canal-edge depth with an explicitly illustrative 0.55 m height.
  An explicit 8 cm display tolerance and indexed buffers reduce 191,111 public-realm source vertices
  to 11,795 and about 329 KB resident GPU data;
  road carriageways remain basemap-owned. Benchmark real devices.
  Every game artifact now binds its area ID as well as release and source hashes; generic custom-layer
  identities remove the Da Costa naming dependency for subsequent generated areas.
  The standalone viewer accepts either raw gzip transport hashes or browser-decoded content hashes,
  matching real host behavior without weakening verification. Evidence-bound frontage cameras
  temporarily suppress inventory crowns that obscure the reviewed wall and restore them on normal
  exploration. Inspector selection adds a non-pickable, runtime-only amber shell over the exact
  source surfaces; it is excluded from provenance and render statistics and follows tile disposal.
  A validated area catalog now removes the remaining hardcoded release-pointer dependency for
  building priors and lesson routing. Multiple catalog releases can contribute non-overlapping BAG
  priors with per-area failure isolation. Every verified entry now receives separately namespaced
  roof, facade, tree and public-realm renderers; a failed optional artifact is isolated to its area and
  layer. All detail streams now release off-camera resources. Source roofs use the same z16 owner-grid
  contract with a 12-tile budget, two-request concurrency, compressed and decoded hash verification,
  zoom-based disposal and deterministic rehydration; the current four tiles total 98 KB compressed.
- The first [contiguous geometry tranche](./EXPANSION_TRANCHE_2026-09-09.md) is now staged:
  422 neutral-geometry buildings and 449 public-facing wall candidates, with complete
  BGT/3DBAG acquisition and no paid calls. It is a bounded demonstration rectangle, not a
  counted ten-block claim. Its first [capped panorama audit](./PANORAMA_SOURCE_AUDIT_2026-09-10.md)
  found 20 usable new-area frontages / 257.27 m and four partial cases. Prepare immutable routing
  inputs and a bounded 20-case routing run are complete. All suggestions remain quarantined;
  next calibrate fields against a geographically held-out human reference sample.
- The [expansion demo](./EXPANSION_DEMO_2026-09-10.md) now covers the full 825-building / 550 m
  parent area with z16 owner tiles for buildings and context, a deterministic era-sensitive city palette, 20 reversible source-bound
  machine overrides, collision-managed street labels, a source-street recall challenge and a
  source-hashed 791 m guided route compiled from Map Recall's existing Amsterdam road graph.
  Cross-area camera checks retain the 12/16 tile caps. Headless frame timing is recorded but is
  not a physical-device claim; phone and desktop profiling remain a release gate.
- Calibrate per-field automatic publication thresholds; report precision and unknown coverage
  together. Do not invent thresholds from agent agreement or the priority queue.
- Run new small training only when reference labels support a genuine held-out comparison.
- Forecast city extraction, storage, refresh and exception-review cost from measured stages.
  The $5 ceiling stays cumulative until the user changes it.

Exact registration and further classifier training remain targeted tools for demonstrated
failure modes, not prerequisites that delay usable conservative coverage.
