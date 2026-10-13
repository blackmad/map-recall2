# Canal elevation (opt-in)

Amsterdam is flat, so a flat map made bridges read as painted strips. The
elevation layer sinks canal water below street level and gives bridges decks
that ramp up and over it. It is **visual only**: routing, the road guard and
bike/boat physics stay 2D and never read it.

## Flag

Off by default. `?elevation=1` (or `window.__canalRecallElevation = true`
before load). `vector-map.js` then loads `js/canal-elevation.bundle.js` on
demand, so the flag-off path costs nothing. Built by `npm run build:canal-3d`
(`scripts/build-3d-bundles.mjs`, target `canal-elevation`).

## Model

- **Land stays at z = 0** (street / quay level). Buildings, landmark GLBs, trees
  and POIs are untouched, so nothing can float or sink.
- **Water** sits `quayFreeboardM` = **1.77 m** below the street in the
  stadsboezem: the median measured AHN approach height of 143 canal-belt
  bridges (+1.37 m NAP) minus the boezem level (−0.40 m NAP). Since 2026-10-13
  the level is **per polder**: `elevation-v1/water-levels.json` carries the NAP
  level of each water polygon and shore from the AGV/Waternet "Peilgebieden
  Vigerend" register (fixed levels as is; seasonal and flexible bands at their
  midpoint; 5,818 of 12,777 polygons and 45% of shores join a peilgebied, the
  rest — IJ, IJmeer, Rijkswaterstaat water — stay at −0.40 m NAP). Water, quay
  walls and deck bodies read it (`GroundStore.waterZ`, `GameGround.waterLevelAt`);
  the boat and ferry float at the level under them. Osdorpplein: ground −2.11,
  water −3.47 (VP −2.17 m NAP), where one city-wide plane flooded the street.
- **Quay walls** follow every true shoreline (natural-stone coping, brick, a dark
  waterline band) from the street down past the water plane.
- **Measured bridges** (931: 729 from `feat/measured-bridges`, 202 more
  non-movable decks measured 2026-10-13 with the same method, 129 of them with
  a hump over 0.3 m): AHN `dsm_05m` on the deck, `dtm_05m` on the
  approaches, sampled along the routed road, expressed as height above the
  straight line between the two approach ends (8 m blend). Since the game's
  ground is z = 0, that relative profile is drawn as is: ramps start at the
  street, the hump rises over the water. Decks get a family-specific fascia
  (municipal material), parapets, a soffit, and masonry arches a spandrel and
  barrel vault down to the water.
- **Unmeasured bridges over water** (689 municipal footprints: 118 movable
  bridges such as the Magere Brug, kept flat on purpose even where AHN shows a
  hump; 127 with no OSM road through the footprint; 111 under 2 m wide; 100
  viaduct-like; 29 decks over 65 m; 128 AHN gaps; 25 unnumbered register
  rows), and measured decks whose hump stays
  under 0.3 m: a flat deck at street level with a 0.45 m fascia and soffit,
  drawn in a second small layer *under* the basemap's bridge roads, and cut out
  of the water opening, so road paint, the route line and street highlights
  stay on them. Honest fallback; no invented hump.
- **Rider**: the bike model is lifted onto measured decks and pitched along the
  ramp (two contact points), eased so a footprint edge never snaps. A deck that
  does not cross water (a viaduct) lifts only a rider heading along it. The boat
  rides at the sunken water level. The camera centre follows the rider's
  surface height, so the cockpit eye never sits inside a deck.
- **Houseboats** (three-buildings layer) are lowered to the water via
  `ThreeBuildings.setWaterLevel`.

## Rendering

One MapLibre custom layer (`canal-elevation`), after the basemap's bridge roads
and before the flat building fill and the game's overlays:

1. **opening** – water polygons at z = 0 into the stencil, no colour;
2. **sunken** – water plane, quay walls and every bridge part below z = 0,
   limited to the opening, depth-tested among themselves;
3. **restore** – the opening again, writing far depth and zero stencil so 2D
   layers drawn later (route, street highlights) are not hidden;
4. **upper** – bridge parts above z = 0 with normal depth, like buildings.

A sunken point is visible exactly when its sight line crosses the water at
street level, which the stencil encodes at any pitch (cockpit included).
MapLibre uses the stencil for tile clipping; the layer clears it and resets the
painter's `currentStencilSource`/`nextStencilID` (private fields, guarded —
re-check on a MapLibre upgrade). Cells are 1 km, streamed within 1 km of the
view centre (≤ 9 resident), merged to one geometry per cell and pass, and
installed one per frame.

Cost (ride-perf, iphone project, 4× CPU throttle, 12 s chase ride, 2 runs
each): frame median 16.7 ms / p95 33.4 ms with the flag on and off; map render
median 11.6–13.5 ms on vs 12.3–13.5 ms off. A first version with one mesh per
bridge and 24 cells doubled map render time (20–22 ms) — keep the merging.
`CANAL_ELEVATION=1|0 PERF_RIDE=1 PW_PORT=4400 npx playwright test ride-perf
--project=iphone -g default` reproduces it.

## Data

`public/data/extracts/amsterdam/elevation-v1/` (~9 MB, cells fetched on demand,
`bridges.json` ~1 MB up front). Built by

```sh
uv run scripts/elevation/build-canal-elevation.py \
  --source ../map-recall2-source-data-elevation   # writes artifacts/elevation/staging/elevation-v1
# review the report, then copy the staging dir to public/data/extracts/amsterdam/elevation-v1
```

Sources (raw, private pack `map-recall2-source-data-elevation`, hashes in
`index.json`): OpenFreeMap z14 water snapshot 20261004 (the basemap's own
shoreline; unioned, 0.2 m simplify, tunnels/pools/intermittent dropped);
`bridge-surfaces-v1.json` (729 AHN profiles from `feat/measured-bridges`
`799f82b4`) plus `bridge-surfaces-v2.json` (202 more, 2026-10-13,
`scripts/elevation/build-bridge-surfaces-v2.ts`, passed to the extractor with
`--extra-profiles`; both raw files live in the source-data archive); `scripts/data/amsterdam-bridge-register.json` (municipal
footprints). Coordinates are decimetres in a local frame and are converted to
exact Web Mercator per vertex.

Checks: `node --import tsx --test src/canalRecall/elevation/elevation.test.ts`
(geometry, winding, deck index, named bridges: Papiermolensluis, Oetgensbrug,
Hoofdbrug, Magere Brug). Visual: `PW_PORT=4400 npx playwright test
canal-elevation` writes before/after images to `artifacts/elevation/<project>/`.

## Salvaged vs rewritten

From `feat/amsterdam-basemap-elevation` (`6ad34036`, `6272dd33`): the measured
profiles and their provenance, the stadsboezem water level, the vehicle
surface pose (contact points, pitch), and the camera `elevation` idea.
Rewritten: the old branch replaced MapLibre's terrain mesh through private APIs
and shipped ~750 MB of DEM/topology packs with a NAP datum that forced every
model to be re-based. This version keeps the ground flat and draws only what
makes bridges legible.

## Known gaps

- No ground relief: the AHN DTM (polders at −2…−5 m NAP, dikes) is not used.
  Adding it means re-basing every building, tree and GLB.
- Water levels are per polder (above), but every shore still gets the same
  quay-wall treatment; sloping park banks and beaches are not modelled.
  Houseboats still take one city-wide level (`setWaterLevel`).
- On humped decks the route line and street highlights are hidden under the
  deck (they are drawn flat at z = 0); on flat fallback decks they stay visible.
- Parts of the boat or a houseboat below street level are not stencil-clipped,
  so at a steep angle near the near bank they can show through the quay.
- Movable bridges (118) and the 571 other unmeasured footprints are flat.
  Movable decks were measurable (39, 30 humped) but are left flat so a raised
  deck is never shown as the riding surface.
- Arch geometry, parapets and fascia colours are procedural interpretations of
  the municipal material, not surveyed shapes.
