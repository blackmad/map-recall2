# Amsterdam panorama references and fast building-specific treatments

Handoff date: 2026-10-06. This document is self-contained and intended for two existing agents. Read the repository AGENTS.md and `docs/landmark-building-recipe.md` before implementation. Coordinate file ownership with the root agent; do not stage unrelated drafts or overwrite another agent's work.

## User intent

Large ordinary buildings occupy enough of the game landscape to deserve their own recognizable character. The user wants to test how quickly a per-building generator, original procedural texture/atlas or lightweight GLB can capture that character, instead of applying generic textures or doing a heavy bespoke rebuild for every building. Reuse installed surveyed geometry wherever it fits. Measure actual authoring speed and gameplay appearance/performance; no timing advantage has yet been demonstrated.

The user also suggested Amsterdam Data's panorama viewer as a better source of clean facade references than our own rectified crops. Investigate that suggestion through actual image comparisons, not assumptions about which projection is superior.

## Verified findings

The supplied address page is:
https://data.amsterdam.nl/adressen/0363200000126409?center=52.3790033%2C4.8922294&zoom=14

The supplied camera view is:
https://data.amsterdam.nl/data/geozoek?center=52.3790416%2C4.8921349&fov=90&heading=123&lagen=pano-pano2025bi&locatie=52.3790409%2C4.8921338&pitch=10&zoom=14

A root Playwright browser successfully loaded this view on 2026-10-06. The actual live requests selected:

- Panorama identity: `recording_2025-06-16_03-46-32_00875`, date June 16, 2025.
- Lookup: `https://api.data.amsterdam.nl/panorama/panoramas/?near=4.8921338,52.3790409&srid=4326&page_size=1&tags=mission-bi&radius=22&newest_in_range=true&limit_results=1`
- Cubic preview: `https://t1.data.amsterdam.nl/panorama/2025/360geo/recording_2025-06-16_03-46-32_00875/cubic/preview.jpg`
- Visible cube tiles included `/cubic/2/r/1/1.jpg`, `/cubic/2/b/1/0.jpg` and `/cubic/2/d/0/1.jpg` under that same base.

The API and image requests returned HTTP 200. Web-tool opening of the portal failed, but the root browser succeeded: this is not evidence that the host is inaccessible. Capture time of the check was not preserved. Recheck and record exact timestamps during acquisition. The URL's location is the panorama camera, not a confirmed building centroid. Resolve the address to its BAG parent before associating a building identity.

The viewer presents a perspective camera view of cube imagery. A clean-looking screenshot is not proof of wall-plane/orthographic rectification. Our wall-plane rectifier serves a different purpose: measurements against surveyed geometry. No pixel comparison or comparative accuracy result has been produced yet.

### Useful older municipal code

The archived repository is https://github.com/Amsterdam/panorama-textures (archived November 2020). Inspected files:

- `src/texture.py`: samples a grid on a vertical wall plane, subtracts the camera position, maps the directions into an equirectangular image, then samples pixels.
- `src/array_math.py`: swaps RD east/north axes and uses azimuth/elevation directly; it applies no vehicle heading/pitch/roll. This is consistent with, but does not independently validate every capture under, our world-aligned convention.
- `src/sample.py`: explicit RD wall coordinates and camera position for Palace/Tussauds examples; possible reproducible comparison fixtures if original inputs remain accessible.

Limitations: hardcoded 8000 × 4000 source dimensions; the extraction function uses opposing corners to construct a vertical rectangular wall, not arbitrary quads; no demonstrated obstruction handling, multi-view selection or current-source calibration in these inspected functions. Do not import it wholesale or claim it is more accurate. The old README's GDAL installation warning is not a present-day blocker: check the existing environment, try a supported installation if needed, and record the actual result. GDAL is relevant to the BAG/geometry-loading examples; the inspected plane-projection functions themselves use NumPy and Pillow. The older PanoViewer repository is also archived and documents Marzipano, but the current portal's exact implementation has not been traced.

## Agent A: panorama reference and projection comparison

Own acquisition/comparison tooling and a short evidence report. Avoid renderer, facade catalogue and shared queue edits until coordinated.

1. Reproduce the supplied portal view. Save panorama metadata, original relevant imagery, source URLs, date, camera settings, access state and checksums in the private source repository. Preserve raw versus processed inputs; follow the source-archive requirements.
2. Query the available capture history and nearby camera positions, not just the portal's default newest result. Compare multiple years/views when trees, scaffolding, parked vehicles, blur or stitching artifacts obscure important features. Prefer a clear source for each feature, record its panorama ID/date, and distinguish real renovations from capture artifacts; do not silently combine incompatible building states. The successful lookup above uses `newest_in_range=true` and returns only one result, so it is not a history inventory. Verify the live API's supported history filters and pagination. Resolve the address's BAG parent and relevant facade wall. Capture a clean official viewer view and our corresponding rectified crop using the same panorama. Identify which existing script is currently authoritative before modifying it.
3. Compare visible window groups, wall boundaries, verticals, signs and distortion. Record differences attributable to perspective versus wall-plane projection separately from wrong pose, wall identity, source resolution or occlusion. Do not measure wall proportions directly from a perspective screenshot as if it were orthographic.
4. Use the municipal projection equations as an independent check where useful. Our existing `AMSTERDAM_WORLD_ALIGNED` convention should prevent applying vehicle orientation twice. Verify rather than guessing.
5. Recommend when to use portal perspective references, when rectification earns its cost, and any specific fix supported by evidence. Provide before/after images and an honest unresolved list.

Starting points in the current root checkout (may differ on your branch):
`src/canalRecall/facade/rectify.ts`, `scripts/facade-twin/rectify-facades.ts`, `scripts/review/estimate-pano-boresight.ts`, `scripts/review/solve-pano-boresight.ts`, `scripts/facade-rebuild/capture-fitted-photos.ts`, and `scripts/city-appearance/run-district-rectification.mjs`.

## Agent B: bounded large ordinary-building pilot

Own one building-specific implementation and its acceptance evidence. Coordinate registration/catalogue ownership before shared edits. Start source/identity screening while Agent A works; the Herengracht example is a reference-workflow fixture, not automatically a large-building pilot candidate.

1. Read `dominant-building-fidelity.json`, the dominant backlog and queue. Select a large ordinary candidate with available source evidence. Size/ranking alone is not standard-treatment approval. Record native scope, roof/open spaces and recognition-critical facade features; satisfy the fidelity ledger's existing review gates. Distinctive/requested landmarks, mapped POIs and raised structures retain the full loop.
2. Build the least costly building-specific treatment that captures those features: native-wall generator/atlas or lightweight GLB. Keep the flat-color house style and original assets; no pasted reference-photo pixels or invented building-name lettering. Preserve surveyed placement, courtyards/passages and neighbors.
3. Record research, authoring, integration and review time separately. Record geometry/draw-call or frame changes where meaningful. No savings claims from implementation time alone.
4. Root must inspect reference/render comparisons. Review native-scale appearance and actual gameplay, including zoomed out and a desktop/touch camera pan away from a stationary rider. Preserve surrounding windows and doors. Record failed evidence prominently; do not mark accepted from tests alone.
5. If replacement geometry is used, suppress exact identities only after successful load, include the independent pyramidal roofs, preserve failure fallback, and refresh model fingerprints/runtime bundles. Native facade treatments should preserve picking and avoid unnecessary replacement suppression. Archive/push sources before the model commit.

Starting points: `src/canalRecall/threeBuildingFeatures.ts`, `src/canalRecall/threeBuildingMesh.ts`, `src/canalRecall/roofMesh.ts`, `public/canal-drive/dominant-building-fidelity.json`, `public/canal-drive/dominant-building-backlog.json`.

## Existing blank-wall report and pending work

A separate user screenshot shows large bare brown/tan walls. Exact location and building IDs remain unconfirmed; the user was asked for location/zoom context. Do not equate it with the later Herengracht panorama example.

Confirmed policy in `roofMesh.exceptLandmarks`: generic facade decoration is skipped for mapped landmark IDs, except dated pre-1945 buildings up to 26 m (and separate kit handling). Missing facade/style metadata becomes a bare shell in `threeBuildingFeatures.ts`. This may explain the screenshot, but overlap/identity/render defects remain possible. The policy predates the performance releases. Do not globally restore apartment-window grids to churches or source-supported blind walls.

Screenshot evidence: `/Users/blackmad/Code/map-recall2/artifacts/city-performance/2026-10-06/empty-walls/user.png` and `diagnosis.json`. Direct chat evidence, not a claimed Firestore feedback item.

Root's isolated worktree is `/tmp/map-recall2-performance`. It currently contains uncommitted workflow changes in `docs/landmark-building-recipe.md` and `public/canal-drive/poi-work-queue.json` for the pilot and blank-wall report. They are not necessarily in your branch. Preserve/merge them with root coordination. No pilot building, new reference acquisition pack or visual acceptance has been completed by this investigation. This handoff itself does not claim either agent is active.

Recent performance release `ce00fece4de975c7f79c7b226f36c42e6e1ce5e4` was pushed/deployed and verified; do not undo its batched road setup, textured-window/door retention or culling behavior. The original root checkout contains unrelated dirty drafts: use an isolated worktree and explicit file staging.

## Joint delivery

Deliver source-pack commit/path, exact building/panorama identities, comparison images, scoped changes, timing/performance evidence and unresolved failures. Agent A owns projection evidence; Agent B owns pilot geometry/materials. One designated integrator owns shared registration, GPU review and git-index windows. Keep existing user tasks in their queues. No additional agents need to be spawned for this handoff.


## Current bounded source trial, 2026-10-06

A subsequent coordinated source trial confirms the current portal bundle constructs Marzipano `RectilinearView` from cubic tiles, not an orthographic facade projection. The supplied view resolves to `recording_2025-06-16_03-46-32_00875`, captured 2025-06-16T03:57:57Z. Original 8000×4000 imagery, raw station metadata, rendered portal/network evidence and the original user screenshot are preserved separately. The initial rendered capture includes a cookie dialog; it is not a clean facade-comparison export.

A bounded inventory found nearby actual capture dates in 2016, 2017, 2019, 2020, 2023, 2024 and 2025. Mission-year tags do not always match capture timestamps. One winter alternative, `b_20241203_0939_Track01_Sphere_00502` from 3 December 2024, was actually inspected: it reveals the right neighbor's crown previously obscured by scaffolding, while plants still obscure some lower details. Darker winter imagery does not establish a material-color change. Other metadata candidates remain uninspected.

The existing perspective helper uses horizontal FOV and positive-up pitch; the current portal uses Marzipano vertical FOV and positive-down pitch. Preserve requested/effective portal framing and viewport; identify the conversion explicitly in an offline supplement. Source-plane calibration and a controlled same-image rectified comparison remain unproven. These findings support using dated portal perspective views for reference discovery and recognition, not an accuracy or end-to-end speed claim.

The Herengracht fixture is not the large ordinary-building pilot. Continue the existing pilot's separate identity, source, fidelity, timing, desktop/touch game-pan and performance gates. The new acquisition trial does not accept a building or supersede the blank-wall report.


Root subsequently saved a clean functional-cookie-only portal screenshot and ran the actual municipal projection function against the actual project world-aligned transform on seven cardinal/elevated directions. Numerical core projection agrees; the older code's width-minus-one modulo differs by one pixel at the wrap seam. This establishes a useful independent coordinate-convention check, not calibrated facade measurement, imagery superiority or a whole-build speed result. The original municipal code files/license and current project source snapshot are retained with the private workflow evidence.


The original municipal `extract_texture` now also ran successfully on the same 2025 panorama and surveyed front-wall endpoints as our rectifier, with identical shared camera-height/ground-height assumptions and sample bounds. The two crops show nearly identical architectural projections: the same window groups, arches, balconies and cornice, with the same top-bound clipping and foreground occlusions. No geometry-fidelity advantage was established on this fixture. Upstream runs with NumPy/Pillow/SciPy without GDAL for this projection step. Use it as the municipal reference implementation while retaining explicit calibration limits; do not label assumed camera/ground height as a measured facade elevation.

Private source trial/archive: commit `b97968cc37f549a2172c78518761d56d07635e25`, paths `workflows/amsterdam-portal-facade-reference-20261006` and `models/uva-roeterseiland`. The UvA source/CPU cycles are a separate requested landmark, not the ordinary-building pilot.
