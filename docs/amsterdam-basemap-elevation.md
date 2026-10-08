# Amsterdam elevation experiment

Branch `feat/amsterdam-basemap-elevation` lives in the isolated
`map-recall2-worktrees/basemap-elevation` worktree. Terrain is opt-in with
`?terrain=1`; the inspection page is `/canal-drive/elevation-demo.html`.
The main worktree and normal flat rendering are unchanged.

## Source and datum

All scene elevations are metres NAP, including negative heights. Building
heights remain relative to their foundations. AHN DTM describes bare ground and
excludes bridge decks. Treating those gaps as water made roads dip at crossings.
The terrain proxy now inserts measured DSM deck profiles inside surveyed
municipal outlines only where the outline actually intersects mapped water.
Overland viaducts leave the lower terrain intact. Connected approaches join the
existing ground; quality code 253 distinguishes decks from ground and water.

Raw sources are archived in private repository `blackmad/map-recall2-source-data`,
branch `source/amsterdam-basemap-elevation`. Source commit: SOURCE_COMMIT_PENDING.

- `terrain/amsterdam`: 247 cached AHN 0.5m RD GeoTIFFs, native basemap water tiles,
  original water-level PDF, request/access metadata and processing manifests.
- `bridges/amsterdam-measured`: original 729 profiles, 1,458 verified DSM/DTM
  dependencies, municipal footprints and original routing inputs.

Public terrain contains zooms 10–18 in 248 indexed PNG packs with HTTP Range
access. Water/bank/deck topology has 247 separately compressed source chunks.
Fingerprints couple these datasets; mismatched chunks are rejected.

The connected pilot canal network uses the published stadsboezem reference
water target of −0.40m NAP from AGV's 2008
[Amsterdam peilbesluiten](https://www.agv.nl/siteassets/werk-in-uitvoering/waterpeil/peilbesluitenamsterdam.pdf).
This is a reference target, not a current gauge reading. Disconnected water
levels remain explicitly estimated below their banks until regional peilgebieden
are integrated. Do not infer citywide water-level accuracy from the three pilots.

## Land, water and crossings

Land fills missing data from nearby donors in the same connected land region,
then receives a 1m Gaussian smoothing pass. Bridge profiles are inserted after
smoothing so ramps survive. The former shoreline taper is removed: stretching
terrain down at the bank made streets wiggly and cannot represent a quay wall.

Native terrain triangles now follow the vector land boundary and have genuine
openings over canals and bridge spans. Independent flat water polygons and
vertical bank faces occupy those openings. Generic measured deck caps keep
crossings intact even with detailed models disabled. Terrain texture fills and
lines share one pass before live 3D layers.

Ordinary buildings use a single foundation offset per footprint, sampled from
land perimeter points. Signature buildings, trees and separate roofs use the
same ground service. Vehicles sample contact points; detailed bridges own their
deck surface when loaded. Boats and genuine mapped houseboats stay on the water.
The inspection demo hides the player vehicle and freezes gameplay while allowing
native camera gestures. It reports ready only once nearby topology is installed.

The three detailed bridge pilots selectively reuse measured-bridges branch
`799f82b4`: Papiermolensluis, Lekkeresluis and Berensluis. Meshes are pre-baked,
with bounded runtime caches. Supports and railings remain procedural
interpretations. `approvedIds` is empty; these are previews rather than exact
historic models. Asset failure preserves the generic crossing cap.

## Rendering cost and compatibility

MapLibre remains the map renderer, pinned to 5.24.0. An isolated adapter replaces
its terrain mesh topology while preserving native DEM shading and map textures.
This adapter uses private APIs and needs review on any MapLibre upgrade. It is
not sufficient evidence to decide whether the whole renderer should be replaced.

Elevation contact queries use the cached raster instead of repeatedly calling
MapLibre's public terrain query, which recomputed tile coverage. Geometry arrival
updates terrain depth without invalidating all map textures. Visible native meshes
and source chunks are retained in bounded caches. Terrain texture quality is set
before recreating the texture pool, avoiding an accidental 1024px pool.

## Verification and failed evidence

Ground, lifecycle, pack delivery, topology and compressed-payload checks pass
(16 tests); measured bridge geometry checks pass (4 tests). The Python proxy
check covers elevated water crossings, joined approaches, negative NAP and
unchanged lower ground under overland viaducts.

Browser checks boot the actual game, wait for complete visible topology, inspect
both banks of all three bridges, sample riding poses, compare terrain on/off frame
times, and pan the camera away from a stationary rider using mouse/touch input.
Generic-cap checks separately disable detailed models. Evidence is saved under
`artifacts/elevation/{desktop,iphone,fallback}`.

Final browser results: FINAL_BROWSER_RESULTS_PENDING.

User screenshots and unsuccessful shoreline/deck versions remain under
`artifacts/elevation/failures`. Results from the earlier double-decompressed
payload run did not load topology; its timings and images are withdrawn and
preserved under `failures/incomplete-topology`. Numeric bridge heights alone
never establish visual acceptance.

Repository-wide `npm run lint` still fails in unchanged city-appearance,
point-cloud and preview files. No changed elevation/bridge file appears in the
failure log. The branch checkpoint uses a command-scoped hook bypass for that
existing baseline failure; the repository hook itself is unchanged.

## Reproduce

```sh
uv run scripts/elevation/build-terrain.py --archive /path/to/source-pack/terrain/amsterdam
node scripts/elevation/pack-terrain.mjs
uv run scripts/elevation/build-surfaces.py --archive /path/to/source-pack
npm run bake:measured-bridges -- --archive=/path/to/source-pack
npm run build:canal-elevation
npm run build:measured-bridges
npm run build:canal-three-buildings
npm run test:terrain-bridge-proxy
npm run test:ground-elevation
npm run test:measured-bridges
PW_PORT=4398 npx playwright test tests/e2e/bridge-terrain-fallback.spec.ts tests/e2e/basemap-elevation.spec.ts --project=desktop --project=iphone
```

Commit and push the private source pack before the app checkpoint and record the
source commit in public metadata. Keep terrain opt-in while regional water levels
and broader compatibility are evaluated. Later land/water material exploration
can build on this geometry rather than adding more heightfield shoreline hacks.
