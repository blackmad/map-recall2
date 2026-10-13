# Lane: recipe tile compiler + `TileBuildings` near tier (migration step 3, 2026-10-13)

Plan: `docs/plans/digital-twin-direction-20261013.md` §2 "Target architecture",
"Compiler", "Runtime", "LOD", "Picking/highlight", migration step 3. Landed
inputs (2026-10-13): `?bagTiles=1` (BAG tiles with facts, `covers.json`,
`src/canalRecall/bagTiles.ts`, `bagPandIndex.ts`), `?cityLook=1`
(`look/cityLook.ts`, attributes `layer/tint/accent/hidden`), recipe houses
(`buildingRecipe/*`, 39 fitted houses incl. `kind: large`), block faces
(`blockFace/compile.ts` → `streetChunks/compileChunk.ts`), building types
(`buildingTypes/{generate,glb,runtime}.ts`, `instances.json`, InstancedMesh),
landmarks (`signaturePlacement.placementFor`). Lane owns a new
`scripts/building-tiles/compile-recipes.ts`, `src/canalRecall/tileBuildings/*`,
and the pilot data under `artifacts/recipe-tiles/` (staging). Do not edit
`game.js`, `index.html`, `package.json`, lockfiles, bundles, catalogues,
`TODO.md`, `HISTORY.md`; ~15 lines in `vector-map.js` to mount the runtime
behind `?recipeTiles=1` are allowed and must be reported. Flag off is
byte-identical.

## Deliverables
1. **Recipe tile data model**: per z14 tile, one object per BAG pand with
   `kind` ∈ canal-house | type | large | kit | glb, `intent` or `sameAs` +
   overrides, compiler-written `fitted`, the ~40-byte `mid` descriptor
   (archetype, bays, storeys, wall, roof, gable, shop — reuse the
   `bag-facts` sidecar fields), and `covers[]`. Generated, never hand-edited;
   faces/types/intents stay the authoring unit. Schema in
   `src/canalRecall/tileBuildings/schema.ts` with a validator and tests.
2. **Compiler** (`compile-recipes.ts`, build time, one process per z16 tile):
   canal-house and large recipes through `buildingRecipe/compile.ts`, block
   faces through `blockFace/compile.ts` → `compileChunk.ts` unchanged, type
   units and `glb` units straight into a unit table with placement baked via
   `placementFor`; **slot-level content-hash instancing** (body / crown /
   ground submeshes hashed separately; rears, party loops and signage never
   instance); output `building-mesh/16/x/y.glb` (merged uniques +
   `EXT_mesh_gpu_instancing` + pand table, meshopt) and `units/<hash>.glb`
   via a generalised `buildingTypes/glb.ts writeInstancedGlb`. Every vertex
   carries the cityLook attributes. Gates per pand (`buildingRecipe/gates.ts`,
   `geometryAudit.ts`) plus a new "instanced ≡ merged" gate. **Emit a review
   sheet only for pands whose triangle hash or gate numbers changed** between
   two compiles (this replaces re-reviewing hundreds of models after a library
   change; `fit-golden` already proves byte-identity).
3. **Runtime** `TileBuildings` grown from `buildingTypes/runtime.ts` (440
   lines; hysteresis and `pandForHit` exist): 2×2 z16 near tiles resident,
   refcounted units, one participant in `rendererShared`, three.js frustum
   culling per mesh; picking by `pandRanges` on merged meshes and `_PAND` on
   instances; near pands set `hidden=1` on the mid/far facade of the same pand
   (attribute exists in both facade shaders) instead of suppression lists.
4. **Pilots**: Bilderdijkstraat block faces, Nieuw-West building types
   (`instances.json` is already a tile), 10 landmarks as `kind: glb`, the 7
   installed `large` recipes. Measure: draw calls, triangles resident, ms per
   frame on desktop (primary; `scripts/ride-perf-fixed-route.mjs`), iPhone 4×
   secondary; compare with the current three loaders at the same spots.
5. Tests: schema, compiler golden on the pilots (hashes), runtime unit tests,
   `tests/e2e/recipe-tiles.spec.ts` flag on vs off at the pilot spots with the
   `look-consistency` pixel method.

## Checks
`npm run lint`, `npm run test:building-recipes`, `npm run test:fit-golden`,
`npm run test:building-types`, `npm run test:block-kit-installed`,
`npm run test:look`, the new tests, `npm run check:canal`. Report: branch,
SHA, the schema, pilot numbers (sizes, draw calls, ms), pixel diffs, the
`vector-map.js` lines, what is unfinished. This is the architecture-bearing
lane: when a design question would change the schema, decide, write the
reason in `docs/buildings-pipeline.md` "Recipe tiles", and keep going.
