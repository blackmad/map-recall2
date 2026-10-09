# Isolation and known regressions

This experiment lives on branch `feat/measured-bridges` in
`.worktrees/measured-bridges`. Its files, game integration, dependency and
build commands have been removed from the main workspace. Normal game visits
in this worktree also keep it disabled: no bridge bundle, survey fetch, custom
layer, mesh generation or pose sampling. Only an explicit `?bridges3d=1` URL
loads the experimental runtime. The combined demo's game tab leaves it off.

The current live implementation is **not accepted for rollout**. It builds
meshes synchronously during map/source updates and filters all 729 profiles on
each pose query. The 24 m road aprons also cover road/sidewalk space beyond the
bridge footprint; gallery-only join checks did not establish compatibility
with the actual game streets. Before rollout, move mesh construction to a worker
or bake meshes, index and cache pose queries, replace the oversized aprons with
road-corridor-aware joins, and measure frame times while riding through real
Jordaan crossings. Keep the baseline view and experiment on separate ports.

# Amsterdam bridge surfaces

The builder discovers physical crossings from the municipal bridge footprints
and OSM bridge-tagged routing paths, the separate named bridge catalogue, and
bridge/pedestrian ways recovered from the cached original OSM PBF. Unflagged
routing paths are accepted only where they cross a canal centreline inside the
municipal footprint. Spatial overlap establishes identity;
names rank crossing paths only inside the matching footprint. Closed area rings
are excluded, contiguous split ways are joined, and conflicting directions are
reported for review. Unnamed bridges retain municipal numbers.

Commands:

- `npm run discover:bridge-surfaces`: citywide matching inventory; no elevation downloads.
- `node --import tsx scripts/bridges/build-source-paths.ts`: refresh compact
  bridge/pedestrian evidence from `.cache/osm-source/Amsterdam.osm.pbf` using osmium.
- `npm run fetch:all-bridge-surfaces`: survey all matched Amsterdam candidates.
- `npm run fetch:bridge-surfaces`: survey the canal-belt cohort.
- `npm run build:bridge-surfaces -- --scope=all`: rebuild from cached rasters.
- Add `--refresh` to a fetch command to refresh existing rasters. Downloads resume
  from matching cached request URLs in `.cache/bridge-surfaces`.
- `npm run test:bridge-surfaces`: identity matching, profile, geometry, joints and wheel contact checks.
- `node --import tsx scripts/bridges/revalidate-generated.ts`: recheck installed
  profiles after a mesh change, refresh budgets and defer failures without
  resampling elevation. Regenerate the Jordaan map with
  `node --import tsx scripts/bridges/build-unmatched-review.ts` afterward.
- `npm run build:canal-bridge-surfaces` and `npm run build:bridge-pilot`: refresh game/gallery bundles.

The generated `bridge-surfaces.json` contains only profiles that pass automated
checks. `bridge-surface-review.json` records every municipal record in the
selected scope, with rejection reasons. The review gallery at
`/canal-drive/bridge-pilot.html` searches generated bridges and lists deferred
crossings. A passing automated check is not a visual approval.

The combined demo at `/canal-drive/bridge-demo.html` includes the full gallery,
the Jordaan matching map (including previously unmatched examples), and the
live game. Named shortcuts open individual bridge or matching views.

Each profile records source file and raster hashes, request URLs, NAP heights,
sampling coverage and interpolation. DSM samples describe the deck; DTM samples
describe connected approaches. Sampling and publication are deliberately
limited to low canal bridges: raw elevations -8 to 15 m NAP, relative rise
at most 4 m, width 2–45 m, straight crossings at most 65 m. Missing endpoints,
long data gaps, excessive grades, complex outlines and broken joins are
deferred. Movable bridges require reference-led modelling. These limits should
be expanded with dedicated structural families and representative evidence,
not by accepting suspect profiles.

Materials choose masonry arch, steel deck, concrete deck or wooden deck.
Arch undersides use shared longitudinal sections across the entire width.
Road aprons meet the bank-cap silhouettes. Their shared sloped shoulders
end at game ground level rather than hanging below it. Gallery banks are
illustrative parallel quays inferred from transverse deck caps, with water
extending beneath the banks to avoid background gaps. They are not surveyed
shorelines. Preflight probes both the centreline and shoulders.
The browser review saves every masonry bridge from both banks, and the tunnel
test checks clearance across the width. Gallery water is lowered for inspection;
it is illustrative context, not a surveyed canal water-level measurement.
Supports and railings are procedural illustrations; material metadata cannot
establish an exact arch count or historical appearance. Municipal type,
material, alignment and elevation evidence remain separately recorded.

The runtime generates at most 12 nearby bridge meshes with a 150,000-triangle
active budget. It retains at most 24 bridge entries, evicting inactive GPU
geometry to keep the cache below 16 MB. Only bridges with active geometry
replace basemap identities or affect the bicycle pose. Unmatched/deferred
crossings and distant views retain their existing rendering.
