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

## Own ground (`?ownGround=1`): ride review and default-on recommendation (2026-10-13)

Evidence for the integrator's flip; the perf table is the same set of runs as
in `docs/buildings-pipeline.md` (BAG tiles section: rows "ownGround" and
"both").

**Desktop cost** (canal-belt ride, 2 runs, 1.39 M triangles / 65.5 MB of
resident ground geometry): map render 2.5 vs 2.7 ms median (the basemap's
ground is hidden), three.js CPU 1.29 vs 1.04 ms per frame, draw calls 423 vs
427, JS heap 921 vs 961 MB, no frame over 50 ms. At the heaviest named
places (BRU0044 arch, BRU0067: 0.8-1.3 M triangles) three.js CPU is 3.5-3.9
ms against 1.5-1.7 ms off and map render 5.6-6.2 vs 3.5-3.9 ms; frames stay
at display cadence, 0-3 frames over 50 ms per 10 s (streaming installs), none
over 100 ms. Nieuw-West ride: 1.82 vs 1.04 ms three.js, map render 3.5 vs 3.1.
So the ground costs about 0.3-2 ms of CPU per frame on desktop and no frame
rate; iPhone is still unmeasured (4x throttle would put the heavy places near
the 33 ms budget; measure before the phone flip).

**Ride review** (`scripts/ground-ride-shots.mjs`, `?ownGround=1&sharedFrame=1`,
canal belt Prinsengracht to Lijnbaansgracht, and Oud-West at the Bilderdijkgracht
mouth; screenshots in `artifacts/ground-ride/`) and a measured audit of every
deck and shore in the box (`npx tsx scripts/own-ground/audit-belt.ts --probe`:
canal belt, Jordaan and Oud-West, 22 cells, 183 measured decks, 24,340 shore
samples). What the audit checks: deck axis continuity, deck ends on the relief,
clearance over the water, the topmost layer across the carriageway being a
street band (the BRU0067 defect, now over every deck), and the ground against
its own water plane along every shore. It exits 0 with 7 reviewed findings
named in `KNOWN`, and fails on a new one.

Defects, with the location and what kind:

- **Data, open**: BRU0077 Henrick de Keijserbrug (4.90263, 52.36150): the
  measured profile rises 1.7 m over a 6.7 m span (0.39 m per 0.5 m, 57%
  grade); a DSM artefact (canopy or vehicle) is likely, not verified; needs the
  raw AHN rasters. Another 25 decks step 0.15-0.23 m per 0.5 m (steel/wood
  humps, plausible); 0 other decks fail.
- **Data, open**: five spots where the ground sits below its own water plane:
  4.86232, 52.37057 (Westerpark, 1.08 m), 4.90719, 52.38449 (IJ-side docks,
  0.6 m), 4.90905, 52.38494 (0.4 m), 4.87420, 52.36047 and 4.87340, 52.36003
  (Postjeskade polder, -3.47 m plane, 0.27-0.29 m). 33 of 24,340 samples. They
  need per-shore levels where the peilgebied join is missing or too coarse.
- **Rendering, open**: BRU0313 (4.88933, 52.38147): the quay coping at the
  bridge end sits 1 mm above the klinker band (z 2.136 vs 2.135), so a coping
  stripe can cross the road where the water polygon ends at the bridge.
- **Rendering, open**: the water material (`gameGround.ts` `water`: roughness
  0.1, envMapIntensity 2.2) reflects the sun as a blown-out white disc on the
  canal (visible at the Prinsengracht in `artifacts/ground-ride/belt/00.png`);
  raise roughness and lower the env intensity, then rebuild `own-ground`
  (bundle is the integrator's).
- **Not defects**: 285 shore samples over 3.5 m above the water are most
  likely the railway and dike embankments at Amsterdam Centraal (4.89589,
  52.38054 and neighbours, not checked one by one) and an embankment at 4.91287, 52.37119; 420 samples within
  0.25 m are low park shores. Road width against the felt corridor is not
  audited here: it is the known `bgt-width-by-class.json` to `ROAD_WIDTHS`
  follow-up (tertiary 6.6 m drawn vs 4.5 m felt).
- Noted in the ride: a rider teleported onto a quay corner at the Bilderdijkgracht
  mouth (4.87211, 52.36537) stops (road guard), not a ground defect.

**Recommendation.** Default-on for desktop in the canal belt, Jordaan and
Oud-West is supported: no measured deck fails except the one AHN outlier, the
costs above are CPU headroom on a display-cadence-limited frame, and the data
blockers listed in the TODO (levels, widths, 931 bridges) are cleared. Before
the flip: (1) iPhone ride-perf with the same scripts; (2) the water glint
tweak (a rendering change plus bundle rebuild); (3) hosting quota for the
29.6 MB gz; (4) decide BRU0077 and the five flooded spots (they are rare and
local, so they need not block it); keep `?ownGround=0` as the escape hatch.
Outside the belt the audit has not been run: extend `--box` before flipping
other districts.

**User screenshots of 2026-10-13, pinned** (`scripts/ground-places-shots.mjs`,
shots in `artifacts/ground-places/{before,after,fixed}/`; the audit prints each
under "named locations"; `BUNDLES_DIR` serves bundles built with
`node scripts/build-3d-bundles.mjs --only=own-ground-game,own-ground-worker
--outdir=<dir>`, the committed bundles are the integrator's to rebuild):

1. **Rozengracht / Marnixstraat junction by the fire station** (4.8760,
   52.3722; Rozengracht bridges 65421584/87 over the Lijnbaansgracht are
   unmeasured flat decks). Fixed: junction discs were centre-and-rim fans, so
   a disc at a bridge end sat up to 0.29 m off the deck under it (56 of 365
   deck ends tore by 0.10-0.29 m); `disc()` now adds concentric rings where
   the surface is not planar (+16% resident triangles on the route, 1.39 M to
   1.61 M, build time unchanged at 79 ms, no frame cost), 56 down to 19 ends
   over 0.10 m, one over 0.25 m (BRU0031, a masonry arch, known). **Not fixed**:
   the red cycle-lane smearing in the junction middle (ragged red patches over
   the asphalt in `fixed/rozengracht-marnixstraat.png`); the cycle bands cross
   the junction at lift 0.036 over the carriageway's 0.03 with coplanar
   triangulations, probably z-fighting between them; needs a junction-aware cycle
   band cut, not attempted. The brown holes and pavement seams were not
   isolated to a cause.
2. **Westerkerk bridge** = Nieuwe-Wercksbrug BRU0063 (steel deck, ends
   0.46/0.63 m). The audit covers continuity, ends on the relief, clearance, deck
   top and the new seam check for it; the seam improvement above applies. Deck
   edges floating over the water and quay walls stopping short of the
   abutments are deck-body and quay-wall geometry, not measured here: the
   bridges lane owns the deck, and the quay-wall cut under deck footprints
   (`underDeck` in the audit) is where to look. Water level there: the
   stadsboezem plane, -1.77.
3. **Ryckerbrug / De Clercqstraat** (4.8705, 52.3709). The cell data holds
   no measured deck at the De Clercqstraat bridge ways 38282912, 38282914 and
   1410734725 (flat deck over the Kostverlorenvaart), and the street continues
   as OSM `area:highway` polygons named "De Clerqstraat" (w813879502,
   w813879503, w813879504, w813878648): the extract keeps only their kind
   `paved`, which the ground draws as the grey `square` paving, not asphalt,
   so the carriageway reads as an open plaza. The roads lane's missing block
   is not in this data. Fix candidate: keep the `area:highway` value in the
   extract and draw carriageway areas as asphalt.
4. **Allotments** (Westerpark / Sloterdijkermeer, Chassebuurt). Fixed in data:
   the 2026-10-10 fetch queried no `landuse=allotments`, so they fell to the dark
   `land` layer. `scripts/own-ground/add-allotment-areas.ts` adds 152 areas (310
   ha) to 84 cells from the Amsterdam extract in `.cache` (osmium; Overpass was
   timing out), `areaKind` maps allotments to the green park class; BGT
   `begroeidterreindeel` is not used by the ground (widths only). Before/after:
   `before|after/allotments-westerpark.png`, `after/allotments-chasse.png`. The
   own-ground bundle is not needed for this fix (data only).
   **Bare white beyond the resident cells**: the ground hid the basemap's fills
   and lines for the whole view once the rider's 3x3 cells were resident; the
   chase camera sees past that. `_setBasemapGroundHidden` in `vector-map.js` now
   keeps the fills and lines visible (`__canalRecallHideBasemapFills = true`
   restores the old behaviour); only the route and street overlays are still
   hidden. Cost on the fixed route, 2 runs each: map render 3.5 and 2.2 ms hidden
   vs 3.9 and 2.4 ms visible, about +30 draw calls, no long frames. Cell-load
   latency (`ground-places-shots.mjs`, jumps of 0.2-3 km, time until the 3x3
   ring is resident): 0.15-2.3 s, typically 1.0-2.2 s, a cell builds in 80 ms
   median and installs in 3 ms (one per frame); the basemap fills now cover
   that interval.
