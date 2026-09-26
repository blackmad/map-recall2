# Amsterdam façade geometry from point clouds — task plan

Goal (unchanged): recognisable buildings in the right polygons, with the gable
and roofline a player navigates by. **Method:** the municipal street-level laser
scan (puntenwolk, MLS) *measures* geometry. Photographs supply *appearance*
(colour, material, shopfront, signage).

Why: 3DBAG carries no gables. On release `c4bebc1f…`, 0 of 895 canal-belt
buildings have a wall above their roof. A single oblique photo can't measure a
gable profile. It can only guess a class. See `HISTORY.md` 2026-09-21 for the
measurements.

Companion docs: `AMSTERDAM_FACADE_REBUILD_PLAN.md` (identity, registration,
evidence contract — still binding), `RECONSTRUCTION_HANDOFF.md` (lanes),
`public/canal-drive/TODO.md` item 10.

## How to use this document (read first)

- Do tasks **in order**. Each one lists its files, steps, the command that proves
  it and a done-when. Don't start a task whose "Depends on" isn't done.
- **Numbers in docs go stale. Re-run the command and quote its output.** Never
  copy a count from this file, `HISTORY.md` or a manifest into a new claim.
- New logic goes in typed `src/` modules with a `*.test.ts` next to it. Scripts in
  `scripts/pointcloud/` stay thin. `npm run lint` only type-checks `src/`, so
  **run every script you touch end-to-end**.
- Leaf agents: return a commit SHA plus command output. Don't edit `package.json`,
  `TODO.md` or `HISTORY.md`. If a task needs a new npm script, list the exact line
  you want added in your report.
- When a threshold changes a count (well-scanned walls, shaped rooflines,
  openings), record before → after in your report. Update the named regression in
  the same commit.
- If a step's premise turns out false (a file moved, a URL is dead, a hash doesn't
  match), **stop and report**. Don't improvise around it.

## Current state (verified 2026-09-22)

| Piece | Where | State |
| --- | --- | --- |
| Wall frame, depth raster, cell classification, silhouette, Douglas–Peucker | `src/canalRecall/facade/pointCloudGeometry.ts` + `.test.ts` (`npm run test:point-cloud-geometry`) | built, **uncommitted** |
| Raster → openings/protrusions/panels/storeys/bays/gable polygon | `src/canalRecall/facade/facadeMeshCompiler.ts` + `.test.ts` (`npm run test:facade-mesh-compiler`) | built, **uncommitted** |
| LAZ decode + grid point selector | `scripts/pointcloud/load-laz-tile.ts` | built. **Float32 precision defect (T2)** |
| Join to 3DBAG, per-wall measurement, "well-scanned" gate, roofline shape | `scripts/pointcloud/measure-tile.ts` | built. **Live 3DBAG fetch (T3)** |
| Spike outputs (SVG/PNG/OBJ/summary) | `scripts/pointcloud/spike-museumkwartier.ts` (`npm run spike:museumkwartier`) | **crashes: missing import (T0)** |
| Named regression | `scripts/pointcloud/check-pointcloud-geometry.ts` (`npm run test:point-cloud-spike`) | **swallows 2nd-tile failures (T0)**. Not in `check:canal` |
| Published demo + viewer | `scripts/pointcloud/publish-facade-demo.ts`, `public/data/pointcloud-facades/v1/`, `pointcloud-facades.html` | built, uncommitted |
| Gable type from a profile | `src/canalRecall/facade/gable.ts` (`gableFeatures`, `classifyGable`) | exists, **not fed by the point cloud (T6)** |
| Evidence contract | `src/canalRecall/facade/evidence.ts` | **no point-cloud source/kind (T7)** |

Data: two demo tiles, Oud-Zuid, 50 × 50 m, RD/NAP (EPSG:7415). Museumkwartier
`filtered_2397_9705.laz` (sha256 `7935f0d7803e252b763d8c154cd444775086085192eeef758c14026cb0f61a7c`, 71 199 947 bytes). Willemspark
`filtered_2386_9702.laz` (sha256 `4aaa1a290d92a710998ed927a2216fa1f759a31be21629a91077a109c8da7cf2`).
Both hashes are also in `public/data/pointcloud-facades/v1/*/manifest.json`. The city-wide host
`files.lidar.data.amsterdam.nl` is NXDOMAIN. That's being chased with
`datateam.geo@amsterdam.nl`, and it blocks all city-scale work. Neither demo
tile is in the active canal-belt release.

## Tasks

### T0 — Make the existing spike correct and land it (P0)
Files: `scripts/pointcloud/spike-museumkwartier.ts`,
`scripts/pointcloud/check-pointcloud-geometry.ts`.
1. Add `import { renderFacadeImage } from './facade-image.ts';` to the spike.
2. In the check, split "is the tile cached?" (`access` inside its own try/catch)
   from the assertions, so a failed Willemspark assertion fails the process.
3. Run `npm run test:point-cloud-geometry`, `npm run test:facade-mesh-compiler`
   and `npm run lint`. If the tiles are cached (see T1), also run
   `npm run spike:museumkwartier` and `npm run test:point-cloud-spike`.
4. Commit **only** the point-cloud files by explicit path: the `src/` modules and
   tests above, `scripts/pointcloud/`, the viewer TS + bundle + html,
   `public/data/pointcloud-facades/`, and this doc. Check `git diff package.json`
   first. If it holds more than the point-cloud scripts, hand `package.json` to the
   integrating agent instead of committing it.
Done when: the spike runs to "wrote …" without throwing, the check fails loudly on
a deliberately broken threshold (try it, then revert), and the commit holds no
unrelated files.

### T1 — Reproducible demo-tile fetch (P0)
New: `scripts/pointcloud/fetch-demo-tiles.ts`. Proposed npm script
`fetch:pointcloud-demo`.
1. The tiles come from the Amsterdam AI Team "Urban PointCloud Processing" (UPCP)
   repository's demo dataset. Find the exact raw-download URL for each file and
   confirm it with `curl -sIL <url>` (HTTP 200, plausible `content-length`)
   before hardcoding it.
2. Download to `.cache/pointcloud/<name>.laz`, stream the sha256 and compare it
   with the manifest hash. On mismatch, delete the file and exit non-zero.
3. Skip files that already exist with the right hash.
Done when: running it on an empty `.cache/pointcloud/` produces both files, the
hashes match, and `npm run test:point-cloud-spike` passes. If no URL yields the
manifest hash, stop and report. Don't accept a different file.

### T2 — Fix Float32 coordinate quantisation (P0, depends T1)
File: `scripts/pointcloud/load-laz-tile.ts`.
1. Before changing anything, run the spike and save `museumkwartier-summary.json`
   as the baseline.
2. Set `fp64: true` and type `positions` as `Float64Array` (update `LazTile` and
   every reader: `createPointSelector`, `scanBounds`, `publish-facade-demo.ts`
   `encodePoints` — the published `points.bin` may stay Float32 because it's only
   a visual).
3. Re-run the spike. Report the before → after for `scannedWalls`, shaped
   rooflines, `totalOpenings`, and the median `planeOffset`. If the counts move,
   update the thresholds in `check-pointcloud-geometry.ts` with that evidence.
Done when: positions are float64 end to end in measurement, and the delta is recorded.

### T3 — Cache 3DBAG responses so the regression is offline (P0)
File: `scripts/pointcloud/measure-tile.ts` (`fetchBuildings`).
1. Key a cache file by tile bbox:
   `.cache/pointcloud/3dbag-<minX>_<minY>_<maxX>_<maxY>.json`. It stores the
   paged `features` and the 3DBAG `metadata` (release/version).
2. Read the cache if it exists. Fetch and write it only when it's missing or
   `--refresh-3dbag` is passed.
3. Add the 3DBAG version/identifier to the spike summary and the publish
   manifest.
Done when: the spike and the check pass with networking off (e.g.
`HTTPS_PROXY=http://127.0.0.1:9` after one warm run).

### T4 — Stop neighbour leakage at wall ends (P1)
File: `src/canalRecall/facade/pointCloudGeometry.ts` (`rasteriseWall`) + its test.
1. Keep the `marginAlong` points **only** for the plane-offset (`modalBin`)
   estimate. Exclude points with `along < minAlong || along > maxAlong` from the
   raster cells. Don't clamp them into the edge columns.
2. Add a synthetic test with two coplanar adjacent walls A and B (0 m gap). B has
   a 3 m gable and A is flat. Assert that A's `wallSilhouette(...).riseAboveWallTop`
   is below 0.1 and that A's edge column carries no return from B.
3. Add a measurement to `measure-tile.ts`: for each wall, list the other-pand
   walls with |normal·normal| > 0.99, plane distance < 0.3 m and an along-gap
   < 0.5 m (`coplanarNeighbours`). Report how many exist per tile in the spike
   summary.
4. Re-run T2's comparison and record the deltas.
Done when: the new test passes and the deltas are recorded.

### T5 — Abstain on walls clipped by the tile (P1)
Files: `measure-tile.ts`, `pointCloudGeometry.ts` test (if the logic lives in `src/`).
1. A wall is `clippedByTile` when its plan extent, expanded by 0.3 m, isn't fully
   inside the tile bounds.
2. `isWellScanned` returns false for clipped walls. The summary counts them.
3. Test: a synthetic wall straddling a bbox edge is clipped, and one 1 m inside is
   not.
Done when: the summary reports `clippedWalls`. No clipped wall counts as a gable
or a shaped roofline.
(True seam stitching across neighbouring tiles waits until the city host is back.
The demo tiles aren't adjacent.)

### T6 — Measured roofline → gable type via the existing classifier (P1, depends T4)
New: `src/canalRecall/facade/pointCloudGable.ts` + `.test.ts`. Proposed npm script
`test:point-cloud-gable`.
1. `toGableSilhouette(silhouette: WallSilhouette, frame: WallMetricFrame, sampleM = 0.1): GableSilhouette`.
   Resample `silhouette.profile` at a fixed `sampleM` across
   `[frame.minAlong, frame.maxAlong]` (linear interpolation, no extrapolation past
   the measured ends). Heights are relative to `frame.maxUp` (the 3DBAG wall top),
   and `plotWidthM = maxAlong − minAlong`.
2. `readMeasuredGable(...) → GableReading | null`. Return null when the wall is
   not well-scanned, is clipped (T5), or has fewer than 8 samples. Otherwise
   return `classifyGable(gableFeatures(toGableSilhouette(...)))`.
3. Tests: synthetic step (3 plateaus → `trapgevel`), bell, triangular
   (`puntgevel`) and flat (`lijstgevel`/`unknown`) profiles. Also a sparse profile
   that returns null.
4. Add a per-wall `gable` and a type histogram to the spike summary. Oud-Zuid
   isn't the canal belt, so mostly `unknown`/`lijstgevel` is an acceptable
   result. Report it as measured.
Done when: the tests pass, and the pinned wall `NL.IMBAG.Pand.0363100012161771` wall
`:23` has a non-null reading, recorded in the check.

### T7 — Point-cloud evidence in the evidence contract (P1, depends T6)
Files: `src/canalRecall/facade/evidence.ts`, new
`src/canalRecall/facade/pointCloudObservation.ts` + `.test.ts`.
1. Add `'mobile-laser-scan'` to `ObservationKind`. Add a `'mls-pointcloud'`
   source to `SOURCE_STRENGTH`, directly **above** `'streetlevel-measured'`
   (for geometry, a laser return is more direct than a rectified photo) and below
   `'reviewed'`. Grep `SOURCE_STRENGTH`/`isStrongerSource` users first
   (`houseRecord.ts`) and run their tests. If an existing test pins the order,
   report it rather than rewriting it.
2. Define `FacadeGeometryObservation` with: `observation: Observation` (kind
   `mobile-laser-scan`, `pandId` from `buildingId`, `elevation` left to the caller
   or `'front'` only when known, `capturedAt` from the LAZ header or the survey
   year if the header has none, `sourceUrl`, `license`), `surfaceId`, the frame,
   and `Measured<>` fields: `gableProfile` (simplified polyline),
   `gableType` (from T6), `openings` (`FacadeRect[]`), `protrusions`,
   `storeyCount`, `bayCount`, `wallColour`.
3. Confidence is a documented function of `coverage`, `cellCoverage` and
   `density`, clamped to 0…1. Every field is `defaulted(...)` when the wall isn't
   well-scanned or is clipped. **Unknown is not a negative.**
4. Emit observations from the spike to `.cache/pointcloud/observations/<tile>.json`
   (a staging path, not `public/`).
Done when: the unit tests cover the abstain paths and the confidence bounds, and
`auditFields`/`summariseCoverage` accept the new records.

### T8 — Promote the checks into the gate (P1, depends T0–T3)
Integrating agent only: add `test:point-cloud-spike` (it self-skips when tiles are
absent) and any new `test:point-cloud-*` to `check:canal`, next to
`test:point-cloud-geometry`.

### T9 — Compile path in a real district (P2, gated)
Don't start until T7 lands **and** a point-cloud tile overlaps a compiled area.
1. Check overlap first. Compare each demo tile bbox with the RD bboxes of compiled
   areas (`public/data/city-appearance/areas.json` → each area's manifest). The
   Zuid districts (`apollobuurt-v1`) are the likeliest.
2. If one overlaps, feed its `FacadeGeometryObservation`s through the existing
   recipe/compiler (`src/canalRecall/facade/recipe.ts`, `silhouetteCompiler.ts`,
   `cityAppearanceFacadeRecipes.ts`) as observations, behind the existing
   acceptance gates. Render with `npm run render:district -- --area=<id>` and look
   at the result.
3. If none overlaps, write that down in TODO and stop. City scale waits on the
   puntenwolk host.

### Parked (needs a human or a blocked source)
- **Photo cross-check** (a gable from points vs the registered-photo silhouette).
  No registered photographs exist for the demo tiles. Revisit when T9 finds an
  overlap with registered frontages.
- **Accuracy metrics** (silhouette IoU, opening precision/recall in metres). This
  needs a hand-labelled gold set of about 5 walls from the elevation SVGs. A human
  has to label them. Don't let a model label its own ground truth.
- **LAS classification** — the loader already returns a `classification`
  attribute, which is currently ignored. If the UPCP tiles carry class labels,
  filtering out vegetation and cars before rasterising could raise coverage.
  Measure before adopting it.
- **City scale** — blocked on `files.lidar.data.amsterdam.nl`.

## Design reference (unchanged decisions)
- Frame: `u` horizontal along the wall, `v` = NAP up, `n` outward. Positive depth
  is in front of the wall (protrusion) and negative is recessed (opening).
- Default parameters and why: 5 cm cells (the scan's resolution), a ±0.35 m slab,
  a 5 cm modal plane bin, recess ≤ −0.12 m, protrusion ≥ +0.08 m, and an 8 m
  upward search for gables. "Well-scanned" means coverage ≥ 0.5, ≥ 250 pts/m² and
  cell coverage ≥ 0.3. "Shaped" means the peak is ≥ 0.5 m above both ends and the
  range is > 1 m. The constants live in `measure-tile.ts` and the
  `pointCloudGeometry.ts` defaults. Change them only with a recorded before/after.
- Abstain rather than invent: thin ornament, sparse walls and clipped walls produce
  `defaulted` fields.
- Licences: ship derived geometry and weights, never third-party imagery. The
  puntenwolk and panoramas are municipal open data (attribution). 3DBAG is CC BY
  4.0. Mapillary is CC BY-SA. Ultralytics YOLO is AGPL-3.0. **Adding any ML
  dependency needs owner approval.** The tooling survey below is reference only.

## Appendix — tooling survey (reference only; no task uses these)

| Role | Tool | Licence | Note |
| --- | --- | --- | --- |
| Cloud → façade classes | ZAHA (601 M annotated MLS points) | CC0-1.0 | benchmark for a future learned classifier |
| Cloud → façade classes | City-Facade (MLS, 9 classes) | unverified | second benchmark |
| LAZ decode | `@loaders.gl/las` | MIT | already a dependency (used) |
| Rectification | `louis-e/orthofacade` | Apache-2.0 | reference |
| Façade parsing ideas | `yueyisui/OccFacade` | none stated | ideas only (long-kernel bands, render-mesh occlusion masks) |
| Windows in photos | `lck1201/win_det_heatmaps` | MIT | reference |
| Attributes / captions | `seshing/OpenFACADES` | MIT | retail/tenant captions |
| Materials | `Nadatarkhan/Zero-shot-Facade-Material-Segmentation` | MIT | material classes |
| Detection datasets | Roboflow Universe façade sets | CC BY 4.0 (uploader-asserted) | ship weights, never pixels |
| Local inference | `inference` (RF-DETR / YOLO) | Apache-2.0 | Ultralytics YOLO itself is AGPL-3.0 |
| Window dataset | `ZPdesu/lsaa-dataset` | CC BY-NC-SA 4.0 | dev only |
