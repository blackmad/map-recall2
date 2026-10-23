# Lane: a per-buurt look at runtime, zero cost per building (B1)

Plan §3. Rules: `LANE-RULES.md`. The generic city tier is built in the worker
(`src/canalRecall/threeBuildingsWorker.ts`, facades from
`threeBuildingMesh.ts` / `roofMesh.ts`) from a 7-int per-pand descriptor in
`public/data/extracts/amsterdam/bag-facts/14/x/y.json.gz` (`MidDescriptor` in
`src/canalRecall/bagTiles.ts`). Its wall tints are "period priors, not
measurements" (`docs/one-material-20261016.md`). This lane gives every CBS
buurt a style so the 188,450 generic pands read like their neighbourhood
without a file per building. It is step 9 of
`docs/plans/large-tier-likeness-and-streets-20261014.md`, never built.
Model: opus for the table and the rules, haiku for the sheets.

## Steps

1. **`DistrictStyle` table** in `src/canalRecall/look/palette.ts`, keyed by
   CBS buurt code: wall family and lightness prior (brick red / orange / brown
   / dark, stucco), accent prior (white bands, none), roof slot bias (pantile,
   slate, flat grey), paving tone, canopy rule, dominant decade. Sources, in
   order: measured medians where chunks or types exist
   (`src/canalRecall/look/chunkWallExposure.ts`, the type palettes under
   `src/canalRecall/buildingTypes/types/`), orthophoto roof slots
   (`roofSlots.ts`), else the decade default from `docs/LOOK.md`. Per buurt
   inputs: `public/data/extracts/amsterdam/coverage-v1/buurten.json`
   (`decade`, `clusters`, `repetition`). A unit test: an empty table leaves
   `test:three-buildings` byte-identical.
2. **Buurt code per pand**: one more int in the `bag-facts` sidecar
   (`scripts/build-bag-facts` or wherever `build:building-facts` writes it),
   from the buurt polygons the coverage builder already joins. Bump the
   sidecar version; the worker reads the style by that int.
3. **Worker**: the generic facade and roof builders take the style for the
   pand's buurt instead of the global era prior; chunks, recipe tiles and
   landmarks are untouched.
4. **Sheets** (haiku): `scripts/look/buurt-sheet.ts` renders twelve buurten
   (the six with chunk/type measurements, six with only a decade prior)
   before/after, aerial and street, each beside the PDOK orthophoto crop;
   pages of four.
5. One opus review turn; one strip for the user.

## Acceptance

Generic walls in the measured buurten within 10 % luma of the measured
chunk/type walls there; unmeasured buurten take the decade prior; ride-perf
unchanged; the empty-table byte-identity test; the user's strip.
