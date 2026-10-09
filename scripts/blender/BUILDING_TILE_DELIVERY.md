# Reviewed building tile delivery

This pipeline packages existing reviewed building-library GLBs. It does not author new buildings, promote held reconstructions, suppress map owners or replace the live game layer. Individual GLBs, recipes and evidence remain unchanged and downloadable.

## Compile and check

```sh
npx tsx scripts/compile-building-library-tiles.ts --input-root public/canal-drive/models/building-library --output-root artifacts/district-tile-batching
npx tsx scripts/check-building-library-tiles.ts
npx esbuild artifacts/district-tile-batching/browser.ts --bundle --format=esm --outfile=artifacts/district-tile-batching/browser.js
node artifacts/placement-review/capture.mjs --tile-batching
```

Inputs are the existing manifest and its individual GLBs/downloaded recipes. Only nonsynthetic models with `sourceRDFrame` are selected; omitted IDs/reasons are explicit in the report. Owner, geometry revision and source frame must match the downloaded recipe. `rdProjectedSurvey` and the actual `SignatureLandmarks._add` consumer supply the fixed transforms. No independent invented bearing formula is used. The existing `compileAppearanceTiles` grid assigns each whole owner once at zoom 14; geometry is never clipped or duplicated at tile boundaries.

## Output version 1

`tiles.json` records:

- `version: 1`, `binaryEndianness: "little"`, `originMercator`, and common `units` (Mercator units per metre).
- `owners`: original identity/revision/status, source RD frame, original GLB URL, SHA-256 and consumer transform. Existing evidence/recipe references remain available.
- `tiles[]`: `key` (`z/x/y`), common-frame metre `offset` (east/south/up), actual tile-local `bounds` covering
  every full owner, geometry byte/triangle/draw totals, `binaryUrl`, unique `owners`, and `batches`.
- Each batch has compatible opaque `MeshStandardMaterial` state, triangle count, `attributes` and ordered `ownerRanges`. An attribute specifies `byteOffset`, element `length`, and `type` (`float32`, `uint16`, `uint32`). Positions/normals/linear RGB colours are float32; indices use uint16 when possible. Offsets are aligned to each element type.
- An owner range specifies `firstTriangle`, `triangleCount`, library owner ID, BAG owner ID, geometry revision, original model hash, source mesh and source index interval. Ranges cover every triangle exactly once. They are metadata, **not geometry groups**, so picking does not add draws.

`report.json` contains distinct real owner counts, source/batched bytes including metadata, unchanged triangle counts, material draws, extents, quantization error, source-world normal comparisons and measured subset growth. It does not extrapolate district completion.

## Geometry and materials

`buildingLibraryTileBatching.ts` groups by compatible PBR state while baking base colour into **linear** vertex RGB. Roughness, metalness, side, emissive and render state remain distinct. It rejects textures, nonopaque/alpha-sorted materials, wireframes, clipping and stencil variants rather than flattening their appearance. The current real assets have two opaque states (metalness 0 and 0.5).

Original normals are transformed with inverse transpose; they are not recomputed from the merged geometry. Negative determinant transforms reverse triangle indices to preserve front-facing/culling behavior after baking. The regression includes a reflected front-side triangle and independent four-dimensional inverse-transpose comparisons of every real triangle corner normal. Indexing preserves all source triangles, including deliberately coincident geometry; no welding or optimization removes architectural details.

## Loader lifecycle

`buildingLibraryTileLoader.ts` validates buffer ranges/indices, compatible material state and complete owner/hash/revision ranges before attaching a tile. `BuildingLibraryTileStore` accepts a parent, an injected abort-aware binary fetcher, `maxTiles`, `maxConcurrent` and optional `maxResidentGeometryBytes`. It coalesces duplicate loads, queues requests within the concurrency cap, evicts the least recently used resident tile, and rejects malformed incoming tiles without retiring the last good resident. `unload` cancels pending work; a late fetch cannot reattach an unloaded owner. `dispose` cancels jobs, detaches groups and disposes all GPU geometry/materials. Callers should release disposed handles to allow CPU buffers to be collected. The byte cap rejects a single oversized tile before fetching and evicts resident tiles before attaching a replacement. The benchmark reports visible triangles and visible/resident geometry bytes against explicit fixture budgets (100,000 triangles and 5 MB). The optional resident triangle cap is enforced independently of the byte cap; distance LOD and viewport-priority selection are not yet implemented.

Canonical z14 ownership remains stable, but these tiles are roughly kilometer sized here. Eleven sparse owners do not demonstrate readiness for 3,189 district owners. A future delivery layer needs finer spatial render chunks and distance-based LOD, assigning each whole owner once without duplicate geometry or picking identities. Chunk coverage bounds must include owners crossing their canonical tile boundary; visible triangle and resident byte budgets must drive loading and LOD independently of low material draw counts.

`pickOwner(mesh, faceIndex)` resolves the original owner/provenance range. `stats` reports resident/pending/active counts and owners. Duplicate source ownership across tiles is rejected at construction. The loader makes no map suppression or acceptance decisions. A future viewport
selector must use actual geometry bounds or existing owner/halo dependencies,
not assume centroid-grid ownership clips a building to that tile.

## Isolated benchmark result

The frozen 11 real owners occupy three tiles. Actual WebGL calls for real subsets 1/3/5/8/11 are **11/32/60/100/142 → 2/3/4/4/6**, with identical whole-tile culling for both representations. All 52,547 triangles remain. Source GLBs total 3,431,992 bytes; float-colour tiles plus metadata are about 3.66 MB (6.5% larger uncompressed). This is a draw-call improvement, not a byte-size improvement.

Same-camera top/oblique/Lauriergracht37/Anjeliers views have mean channel errors at most 0.00113 on 0–255 values; a few antialiased edges change, and top view matches exactly. All 142 representative real triangle raycasts recover the expected owner/hash. The WebGL lifecycle check returns geometry memory from 150 to its 148-object benchmark baseline after unload; reload has the same owner mapping and capacity eviction leaves one resident tile. The focused Node regression also covers late cancelled loads, queued cancellation, duplicate ownership, malformed payloads and failed replacement preservation.

The isolated review at `artifacts/district-tile-batching/index.html` provides original/batched toggles, overview/closeup cameras and actual calls/triangles. Artifacts are benchmarks and review tools; no live-game hookup exists.

## Fine rendering chunks and triangle bounds

The compiler accepts `--render-zoom 18` (14–20). Canonical z14 ownership is retained as `owners[].canonicalOwnershipKey`; fine render partitions assign each whole owner once, without clipping its footprint or geometry. Each chunk carries full exported coverage bounds. Halo-only acquisition cells are omitted from render payloads. Run `npx tsx scripts/check-building-render-chunks.ts` against the saved 20-owner coarse/fine benchmark under `artifacts/district-render-chunks/`.

The loader now supports optional `maxResidentTriangles` and reports `residentTriangles`. It rejects an oversized chunk before fetching, verifies declared totals against decoded triangles and evicts old resources to satisfy both triangle and byte budgets. Corrupt totals cannot retire a good resident. Existing byte-budget and cancellation checks still pass.

The current 20-owner proof reduces maximum chunk size from 49,254 to 13,396 triangles, with all 97,248 real-building triangles and canonical owners preserved. Sixteen fine chunks cost 25 material draws when all shown, compared with six draws in three coarse tiles. A tested 20,000-triangle / 2 MB resident budget peaks at 19,600 triangles and 1,369,782 bytes. Distance LOD and viewport selection remain necessary before full-district delivery; this change does not enable production replacement.

## Viewport selection and representation lifecycle

`BuildingViewportPlanner` admits actual full exported chunk AABBs intersecting the camera frustum, ordered by distance to the box. It selects only available assets, applies the existing distance hysteresis, and respects total chunk/triangle/byte budgets. Canonical owner/revision bindings and whole-owner chunk assignments must match across LOD manifests. Missing lightweight assets are explicit; a mathematical LOD fixture is not credited as building geometry.

`BuildingViewportStreamer` shares these budgets across representations. It loads with bounded concurrency, coalesces identical requests, cancels stale camera work and disposes retired geometry/materials. A validated replacement is ready before the old representation is retired; invalid payloads preserve the good resident. One owner can never be attached twice. Viewport and streaming checks use actual 20-owner full-detail binary payloads plus a separately labelled synthetic representation-change fixture. The compiled isolated browser study remains unverified until a local browser/server runtime is available.
