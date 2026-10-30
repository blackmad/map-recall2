# Lane L3: the world compiler (`world-v1` cells, `?world=v1`)

Rules: `LANE-RULES.md`. Programme: `engine-programme-20261030.md` §P2. Model:
opus for the format, its decoders and the first consumer; haiku for the
encoder runs and measurements. Absorbs `lane-binary-extracts-20261029.md`
(lane C): keep its numbers, sentinels and strict-decode rules; widen the goal
from "smaller tiles" to "the city is baked at build time, nothing about a
building is computed on the main thread at runtime".

## What moves from runtime to build time (and where it lives today)

| Stream | Content | Replaces |
|---|---|---|
| FOOT | footprints on a 0.1 m RD grid, Morton order, zigzag-varint deltas across buildings, pand id table, eaves/ridge at 0.25 m, year, roof kind | `buildingTilesBrowser.ts` `readGzippedGeoJson` (~l.88), the per-feature clones (~l.565, 686, 696) |
| ROOF | serialized `RoofPlan` per pand | `planRoof`/`decorateRoof` (`roofMesh.ts`), `planBuildingRoof` in `threeBuildingsBrowser.ts` |
| STYL | palette index, wall material, window kind, kit id, front/shopfront/monument-gable/kit-roof flags | `decorateFront`, `decorateShopfront`, `decorateKitRoof`, `withMonumentGable`, `exceptLandmarks` |
| GRP | group id + party-wall neighbour indices | the neighbour walk in `setFeatures` (~l.662, 1068–1096) via `buildingContextIndex.ts` |
| HIDE | pand / OSM ids hidden by installed models | `models/covers.json` `p`/`o`, `KIT_HIDE_IDS`, `_signatureSuppressOsmIds` |
| LMRK | model id, transform (`rdProjectionBasis`), LOD URLs (`modelLods.json`), bounds | landmark placement at load (`signature-landmarks-source.js`) |
| WATR | water polygons with level + `PolygonGrid` bucket table | `isWater` via `queryRenderedFeatures` |
| ROAD | centrelines with BGT widths (`ownGround/bgtWidth.ts`), class, bridge flags | width derivation in the ground worker |
| TREE | points (AMT1), species index, height class, year | `municipal-trees` z15 tiles |
| LABL | POIs, neighbourhood label points, normalised spoiler keys | `orientation-pois` / `ownPois` setup; the decisions stay at runtime in `labelPolicy.ts` |

Ground meshes stay the own-ground worker's output for v1.

## Build

1. **Format.** `src/canalRecall/world/cellFormat.ts`: 1 km cells keyed like
   `roads-v1/cells.json` (`i_j` on the own-ground local grid); one file per
   cell `world-v1/cells/<i>_<j>.bin` with a stream table; `world-v1/index.json`
   with cell bounds, per-stream byte offsets, SHA-256 of every source
   snapshot and the compiler version. Strict decoders: magic, version,
   offsets, count bounds, varint lengths, leftover bytes all throw. Tests:
   round trip 10,000 random pands; sentinels pinned by id and first vertex
   (Westerkerk, Bloemgracht 80, Nassaukade 506, a pand with a courtyard hole,
   one on the IJburg edge); truncated / bad-magic / trailing-byte inputs
   rejected. Report bytes at 0.1 m and at 0.5 m so the grid choice is measured.
2. **Compiler.** `scripts/world/compile.ts` (`npm run world:compile`): reads
   the same inputs the runtime reads today (bag-tiles or building-tiles,
   roof/building facts, covers.json, kit-pands.json, modelLods.json,
   houseboats, water from elevation-v1, roads-v1, municipal trees,
   orientation-pois, neighbourhoods) and runs the **same functions** the
   runtime runs (`planBuildingRoof`, the decorators, `buildingContextIndex`)
   at build time; no reimplementation. `--changed` hashes inputs per cell and
   recompiles only affected cells. Output to `artifacts/world/staging/` with
   `report.json`: cells written, bytes raw/gz per stream, pands added or
   removed vs the current tiles, heights differing > 0.25 m, roof kind changed.
   Publishing into `public/data/extracts/amsterdam/world-v1/` is the
   integrator's step after review.
3. **Consumer behind `?world=v1`.** `threeBuildingsWorker.ts` reads FOOT, ROOF,
   STYL, GRP, HIDE straight from the cell (`DecompressionStream`, gzip magic
   sniff) and builds the same chunk typed arrays; `buildingTilesBrowser.ts`
   under the flag fetches cells, never GeoJSON, and never calls the MapLibre
   `setData` path. Identical features when the flag is off. Pixel check:
   `three-buildings-ab.spec.ts` strips identical at the sentinels.
4. **Rule for content lanes** (write it into the format doc header): a new kit
   attribute is a STYL field + a version bump + a decoder test; output must be
   byte-identical when the field is absent.

## Measure

Bytes gzip before (bag-tiles 18 MB, building-tiles 16 MB, municipal-trees
6.2 MB) and after; decode ms per cell in the worker on desktop and the iPhone
profile at 4× CPU; `scripts/motion-stutter.mjs` with `?world=v1` vs default
(streaming-attributed tasks > 16 ms at 1×, > 50 ms at 4×); ArrayBuffers at ride
start from `phone-memory.spec.ts`; first-frame-with-buildings from
`pop-in.spec.ts`.

## Acceptance

Buildings ≤ 4 MB gz; decode ≤ 5 ms per cell at 4×; no streaming-attributed
task > 16 ms (1×) in the motion window; the diff table empty or explained;
sentinel tests green; strips identical. Nothing is called smaller or faster
without the before/after row.

## Checks

`npm run lint`; the new `test:world-format`; `npm run test:city-startup`;
`PW_PORT=<port> npx playwright test three-buildings-ab phone-memory pop-in
--project=iphone` under `/tmp/canal-pw.sh`.

## Hand back

The `LANE-RULES.md` block, plus the byte table per stream, the decode table,
the staging path and report, and the publish command for the integrator.
