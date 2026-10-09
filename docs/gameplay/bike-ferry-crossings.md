# Bike ferry crossings

First built on `feat/bike-ferry-crossings` (base `4d22ff17`, snapshot
`wip/bike-ferry-snapshot-20261009`). Ported to main on `feat/bike-ferry-20261009`
(2026-10-09), where boarding was reworked for today's water mask (see below).

Local deterministic preview: `/canal-drive/?ferry=F3`. It selects Amsterdam / Bike / Chase, starts at the Centraal F3 land access facing the water, and fixes the destination to Buiksloterweg.

Cycling routes can use the GVB IJ crossings F1, F2, F3, F4, F6, F7 and F9. Blue map pins identify the physical terminals. Ride to the end of a terminal access and steer towards the water to become a ferry; steer with the same keyboard or touch controls. The notice names the departure and allowed destination(s). Approaching a connected terminal from the water (reaching the pier, or touching its quay within 16 m) switches back to the bike at its land access, facing inland. Returning to the departure terminal is also allowed after leaving its vicinity. Other shorelines cannot disembark the rider. Cycling stays the selected trip mode.

## Code

- `src/canalRecall/ferry/network.ts`: GTFS ferry links and terminal accesses as track segments; `connectFerryGraph` adds sea edges to the street routing graph.
- `src/canalRecall/ferry/travel.ts`: boarding, water steering and docking (typed, unit-tested).
- `src/canalRecall/ferry/index.ts`: bundle entry, `window.CanalRecallFerry` (`npm run build:canal-ferry` → `public/canal-drive/js/ferry-network.bundle.js`).
- `public/canal-drive/js/ferry-travel.js`: thin adapter `window.CanalRecallFerryTravel` used by `game.js`, which supplies the rendered-water test.
- `src/canalRecall/ferry/model.mjs` + `scripts/build-ferry-model.mjs`: the IJ ferry model → `public/canal-drive/gvb-ferry-runtime.glb`.

## Data and topology

The existing `public/data/extracts/amsterdam/transit-network.json` supplies GVB stop identities, line connections and representative GTFS shapes. Stop IDs preserve the separate Centraal piers; parent station identities must not merge them. The road graph builds street junctions and short terminal approaches first, then adds ferry edges without intersecting or stitching sea paths. Ferry segments are blanked (not removed) when the graph and drivable surface are built, so every other segment keeps its index. The drivable street surface excludes ferry segments.

Ferry and terminal-access segments carry an empty `name` and a display-only `label`. A name would make them street questions, multiple-choice distractors, router novelty targets and spoiler candidates. While aboard, the street/bridge/canal quizzes and the finish check are suspended; snapping of start/finish POIs uses the land-only snap index, so a route never starts or ends offshore.

Short terminal approaches project each stop to the nearest mapped street, with an 80 m bound. This is approximate access geometry, not a surveyed ramp reconstruction. F20 is omitted in the installed street extract because an endpoint does not have access inside that bound; F21/F22 are outside the Amsterdam play bounds. The transit feed holds one representative trip per route, so these are structural connections rather than live departure times or temporary service information. No timetable/waiting mechanic is implemented.

## Boarding rule (measured 2026-10-09)

The first version boarded only when the GTFS stop itself was rendered water and the rider headed along the access. On main the Centraal F3 stop sits on the quay, 3 m from the cycleway, and its access runs along the quay: the bike never boarded. Now:

- the rider must be within 3 m of the stop, moving, and not riding back towards the street;
- the nearest rendered water within 30 m of the stop gives the shoreline normal (circular mean of the wet directions on the first wet ring); the rider must head within 60° of it, so riding past a quay-edge pier parallel to the water does not board;
- the hull is launched afloat with its stern at the quay (up to half a hull length out along the heading);
- the shore lookup is cached per pier; a dry miss is retried every 30 frames.

The e2e visits every pier and records the distance from the stop to water. Measured on desktop and iPhone: 0 m for 9 of 12 piers, 2 m (IJplein, one Centraal pier) and 4 m (another Centraal pier).

The rendered-water mask only exists around the camera, which is why the lookup happens at the pier while the rider is there.

## Model

The original ferry model follows the double-ended blue/white IJveer 60 silhouette: chamfered hull, boarding ramps at both ends, sloping white side structure, lower windows, open balconies, glazed upper bridge, blue roof, railings and lifebuoys. Dimensions/proportions are approximate (33 m length). No downloaded mesh or photo pixels are used. The native Y-up model is exported to `public/canal-drive/gvb-ferry-runtime.glb`; geometry is merged into eight color meshes (about 194 KB).

Rebuild with `npm run build:ferry-model`, `npm run build:canal-ferry`, `node scripts/build-3d-bundles.mjs --only=player-vehicles` and `npm run build:canal-game-presentation`. The main build and `check:canal` include the ferry network bundle. Model generation is an explicit asset-build step, like the existing bike model.

## Validation

- `npm run test:ferry`: source terminal connections, separate Centraal piers, crossing-route isolation, unnamed ferry segments (`network.test.ts`); boarding at a quay-edge pier, refusing parallel/backwards/stopped/dry boarding, launch afloat, blocked unrelated shores, docking at the pier or its quay, return to origin only after departing (`travel.test.ts`). Part of `check:canal`.
- `tests/e2e/ferry-crossings.spec.ts` (desktop keyboard, iPhone CDP touch through the thumbstick): pier water audit, boarding at Centraal F3 by turning towards the water, ferry mesh shown and bike hidden, steering across F3, refused unrelated docking, return to the bike at the land access, a route between the two piers' land accesses. Screenshots: `ferry-boarding.png`, `ferry-live-crossing.png`, `ferry-live-docked.png`.
- No GPU performance benchmark is claimed.

## Open

- No timetable or waiting at the pier; the crossing is free-steered.
- Terminal access geometry is a projection to the nearest street, not surveyed ramps. Some accesses are 30–43 m long (Sporenburg, Zeeburgereiland, Zamenhofstraat); Sporenburg's runs over open water to the pontoon.
- The router treats ferry edges as plain distance; there is no crossing-time cost.

Raw photo and reused processed transit input are locally archived under `/Users/blackmad/Code/map-recall2-source-data/objects/gvb-ij-ferry`, with hashes/access/provenance in `manifest.json`. This vehicle reference pack is not yet committed/pushed. The original photo is private reference material and is not shipped in the game.

Photo reference: [IJveer 60 press photo and article](https://www.nu.nl/amsterdam/4809075/speciale-pont-naar-ndsm-werf-bij-grote-feesten.html). Official connections cross-check: [GVB ferry products/routes](https://gvb.nl/reisproducten/vaarkaarten). Feed source: [OVapi GTFS NL](https://gtfs.ovapi.nl/nl/gtfs-nl.zip), reused through the existing project extract.
