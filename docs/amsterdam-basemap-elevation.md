# Amsterdam elevation experiment

Branch: `feat/amsterdam-basemap-elevation`, isolated from the main working tree.
Elevation remains opt-in with `?terrain=1`. Detailed bridge previews require
`bridges3d=1`; no detailed bridge has been visually approved for normal gameplay.
The local inspection page is `/canal-drive/elevation-demo.html`.

## Source and datum

Render heights are metres NAP, including negative elevations. Building heights
remain relative to their foundations. AHN DTM is bare ground: it deliberately
does not provide bridge decks. The original ground-only integration incorrectly
filled those gaps with mapped water height, making native roads descend through
crossings. The terrain proxy now inserts absolute-NAP DSM deck profiles for 729
crossings within their surveyed municipal outlines, with narrow connected DTM
approaches fading into existing ground at their outer eight metres. Quality code
253 distinguishes these driving surfaces from ground and mapped water.

Raw sources are in private repository `blackmad/map-recall2-source-data`, branch
`source/amsterdam-basemap-elevation`, commit
`10c632417752b71e6737d73343812c759201be7d`:

- `terrain/amsterdam`: 247 cached AHN 0.5m RD GeoTIFFs, native basemap water tiles,
  request/access metadata and processing manifest.
- `bridges/amsterdam-measured`: the original 729 profiles, all 1,458 verified
  DSM/DTM raster dependencies, municipal footprints and original routing inputs.

Public terrain is a static TerrainRGB pyramid, zooms 10–18, in 248 indexed PNG
packs with HTTP Range delivery. Native PNG bytes are retained; the browser does
not decode GeoTIFFs or generate bridge geometry on camera changes.

## Scene integration

Ordinary building chunks have one foundation offset per footprint. Signature
models, trees and separate roofs use the same ground service. Vehicles sample
their contact points; a loaded detailed bridge owns its deck surface. Boats
remain on the water plane. Mapped houseboats are intentionally in the canals.

The three detailed bridge pilots selectively port the measured-bridges branch
(`799f82b4`), with pre-baked indexed meshes and a bounded spatial/asset cache.
Their supports and railings are procedural interpretations, not exact historic
surveys. Asset failure preserves the native crossing and deck-height proxy.

Water beneath an active detailed bridge draws at the explicit 0 NAP fallback,
before other 3D objects. It clears the terrain proxy only inside the installed
municipal deck outline. Terrain fills and lines are grouped before live 3D
layers; ground POI locator lines must not be repeatedly raised across that group.

## Evidence and remaining acceptance

`artifacts/elevation/fallback/{desktop,iphone}` records native bridge heights
with detailed models disabled. For Papiermolensluis, Lekkeresluis and Berensluis,
rendered centre heights were 3.1, 3.4 and 2.7 NAP, respectively, within 0.04m of
the sampled profile values. This confirms the fallback heights, not visual
acceptance. The regression also boots the actual game before capturing views.

User screenshots and failed shoreline views are retained under
`artifacts/elevation/failures`. The initial 4m shoreline taper is an unsuccessful
render approximation: native heightfields cannot represent vertical quay walls.
Broader land/water separation needs smooth land elevations, independent level
water polygons, vertical bank geometry and a visually checked generic deck
fallback. It must not flatten bridge ramps or move genuine houseboats onto land.

The latest desktop terrain pan still fails the 10% p95 frame-time budget
(33.4ms versus 16.8ms baseline), while the touch run passes. The explicit pilot
water-plane experiment also still shows deck clipping and stripes; it has not
passed visual review. Keep the performance
assertion and record fresh results after rendering changes. Successful numeric
height tests do not override failed shoreline or bridge screenshots.

The repository-wide typecheck also fails in unchanged city-appearance/viewer
files (unused TypeScript suppression directives and spread-argument errors).
None of the elevation/bridge files appears in that failure log. This checkpoint
is an experimental draft and does not satisfy the normal pre-commit gate.

MapLibre replacement is deferred. First establish whether a single terrain pass
plus explicit water/bank/deck geometry meets visual and performance requirements.

## Reproduce

```sh
uv run scripts/elevation/build-terrain.py --archive /path/to/source-pack/terrain/amsterdam
node scripts/elevation/pack-terrain.mjs
npm run bake:measured-bridges -- --archive=/path/to/source-pack
npm run build:canal-elevation
npm run build:measured-bridges
uv run scripts/elevation/check_bridge_decks.py
npm run test:ground-elevation
npm run test:measured-bridges
PW_PORT=4398 npx playwright test tests/e2e/bridge-terrain-fallback.spec.ts tests/e2e/basemap-elevation.spec.ts
```

After acquisition, commit and push the private raw pack before committing model
changes; record that source commit/path in public metadata. Do not enable terrain
by default or populate `approvedIds` until actual scenes and performance pass.
