# Bike ferry crossings

Implemented on `feat/bike-ferry-crossings` in `/Users/blackmad/Code/map-recall2-ferry`, based on `4d22ff17`. The main checkout is untouched by this feature.

Local deterministic preview: `http://localhost:4647/canal-drive/?ferry=F3`. It selects Amsterdam / Bike / Chase, starts at the Centraal F3 land access facing the water, and fixes the destination to Buiksloterweg.

Cycling routes can use the GVB IJ crossings F1, F2, F3, F4, F6, F7 and F9. Blue map pins identify the physical terminals. Ride towards the water along a terminal access to become a ferry; steer with the same keyboard or touch controls. The notice names the departure and allowed destination(s). Approaching a connected terminal from the water switches back to the bike at its land access. Returning to the departure terminal is also allowed after leaving its vicinity. Other shorelines cannot disembark the rider. Cycling stays the selected trip mode; ferry travel does not ask nearby street questions or finish a trip offshore.

The existing `public/data/extracts/amsterdam/transit-network.json` supplies GVB stop identities, line connections and representative GTFS shapes. Stop IDs preserve the separate Centraal piers; parent station identities must not merge them. The road graph builds street junctions and short terminal approaches first, then adds ferry edges without intersecting or stitching sea paths. The drivable street surface excludes ferry segments. Water steering uses the existing rendered-water mask, with access only at the connected piers.

Short terminal approaches project each stop to the nearest mapped street, with an 80 m bound. This is approximate access geometry, not a surveyed ramp reconstruction. F20 is omitted in the installed street extract because an endpoint does not have access inside that bound; F21/F22 are outside the Amsterdam play bounds. The transit feed holds one representative trip per route, so these are structural connections rather than live departure times or temporary service information. No timetable/waiting mechanic is implemented.

The original ferry model follows the double-ended blue/white IJveer 60 silhouette: chamfered hull, boarding ramps at both ends, sloping white side structure, lower windows, open balconies, glazed upper bridge, blue roof, railings and lifebuoys. Dimensions/proportions are approximate (33 m length). No downloaded mesh or photo pixels are used. The native Y-up model is exported to `public/canal-drive/gvb-ferry-runtime.glb`; geometry is merged into eight color meshes (about 194 KB).

Rebuild with `npm run build:ferry-model`, `npm run build:canal-ferry`, `node scripts/build-3d-bundles.mjs --only=player-vehicles` and `npm run build:canal-game-presentation`. The main build includes the ferry network bundle. Model generation is an explicit asset-build step, like the existing bike model.

## Validation

- `npm run test:ferry`: source terminal connections, separate Centraal piers and crossing-route isolation.
- Road graph, road surface, bicycle access and game decomposition regression checks pass.
- `tests/e2e/ferry-crossings.spec.ts` uses explicit south/Noord endpoints and checks boarding, model visibility, steering across F3, refused unrelated docking, return to the bike, and the land access position. Desktop uses keyboard input; iPhone uses CDP touch events through the actual thumbstick.
- Root reviewed actual game screenshots on desktop and iPhone. The phone notice was moved below the minimap after an overlap was found. A docked screenshot revealed an offshore bike despite the first behavior checks passing; disembarking now uses the terminal's land access and is explicitly checked. Final corrected landing passed an actual game check and root screenshot review on desktop with CPU-only SwiftShader (renderer string asserted before the test). The prior desktop/iPhone crossing and touch-input checks passed on hardware; the final position-only correction was also checked directly through the runtime for both destination docking and returning to the origin.
- Full `npm run lint` remains blocked by existing errors in city appearance and other unrelated source files. The ferry, host, collaborator and presentation changes produce no reported TypeScript errors.
- These checks establish functionality and visual review. No exclusive GPU performance benchmark is claimed; browser work was coordinated with the active landmark review queue.

Raw photo and reused processed transit input are locally archived under `/Users/blackmad/Code/map-recall2-source-data/objects/gvb-ij-ferry`, with hashes/access/provenance in `manifest.json`. This vehicle reference pack is not yet committed/pushed. The original photo is private reference material and is not shipped in the game.

Photo reference: [IJveer 60 press photo and article](https://www.nu.nl/amsterdam/4809075/speciale-pont-naar-ndsm-werf-bij-grote-feesten.html). Official connections cross-check: [GVB ferry products/routes](https://gvb.nl/reisproducten/vaarkaarten); search results were available, but direct page access returned HTTP 403. Feed source: [OVapi GTFS NL](https://gtfs.ovapi.nl/nl/gtfs-nl.zip), reused through the existing project extract.

Feedback checkpoint: initial open queue pull on 2026-10-08 returned zero notes. The in-progress pull returned three existing Melkweg/OCCII landmark notes; they were left with the landmark work and were not claimed or resolved by this feature.

Final evidence is preserved locally in `artifacts/ferry/final/`: desktop/iPhone ferry crossing screenshots and the corrected desktop docked screenshot. Failed offshore landing screenshots remain in `artifacts/ferry/failures/`. The initial phone Surprise fixture selected endpoints too close together and failed before spawning the player; the explicit south/Noord test fixture avoids that unrelated route-selection failure. No phone hardware performance claim is made.
