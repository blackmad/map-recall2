# Canal Recall project memory

## Amsterdam POI work

The user authorizes ongoing landmark work, parallel agents, and periodic commits and pushes. Keep requested tasks and deferred work in `public/canal-drive/poi-work-queue.json`; regenerate `public/canal-drive/landmark-backlog.json` with `scripts/landmarks/build-poi-backlog.ts` as assets and POI coverage change. Do not drop earlier requests when the user adds another building or reports a bug.

Every modeled POI building must be integrated into all three game surfaces:
1. A selectable POI route destination.
2. A geographically correct map pin and label.
3. A meaningful info/trivia card with research source links.

Audit these together before declaring a POI complete. Reuse genuine extract identities and preserve existing researched facts. An asset belonging to an already selectable complex can share that POI identity; do not manufacture duplicate destinations for aliases or multiple mesh parts. Muziekgebouw and Bimhuis remain distinct genuine destinations despite sharing a mesh. Year-built-only generic building metadata is not meaningful trivia: clicking it must not select or highlight the building. If the clicked building contains a genuine POI, show that POI's useful card instead.

For ordinary clicked buildings, use mapped place information only from points inside the actual installed footprint, excluding courtyard holes. Prefer researched landmark cards, validate website links, and keep basic mapped-place info separate from the curated automatic route pool. Never substitute a nearby POI for the clicked building.

Author landmarks in the established texture-free, flat-color house style using native surveyed footprints, scale 1, and current OSM/BAG identities. Rebuild legacy imports in this style, beginning with Westerkerk. Reference photos guide original geometry; do not copy downloaded meshes or photo pixels into original assets. Verify actual scope, heights, open courts, underpasses, and neighboring buildings. Suppress exact replaced identities after the GLB loads, preserve fallback on load failure, and avoid padded rectangular suppression.

The manual asset generator also refreshes `modelAssetVersions.json`. Rebuild the signature browser/runtime bundles after model changes so gallery and game request the current content fingerprint rather than a cached older mesh.

Use the POI Destinations list and explicit requested additions as the main work queue. Regenerate `public/canal-drive/dominant-building-backlog.json` with `scripts/landmarks/build-dominant-building-backlog.ts` for large ordinary buildings. Thresholds live in the work queue (currently net footprint 2,500 m² or height 35 m); constrain candidates to the Amsterdam municipality, exclude modeled identities, group duplicate outlines/raised parts, and preserve separate courtyard buildings. Do not treat unnamed candidates as researched POIs automatically.

Photo buildings mode should use realistic material colors. Mode changes must update geometry and color consistently, including streamed tiles and cached/in-flight worker results. Distinguish source detail, fallback extrusions, and render defects before deciding a gray building needs a custom landmark.

Coordinate source ownership, shared registration, GPU browser reviews, and git-index windows between agents. One agent owns shared catalogue/dispatcher/bundle registration at a time. Preserve unrelated files and drafts. Review native-scale gallery and live-game views, exact suppression/neighbor retention, and appropriate meaningful regression checks before commit. Keep reporting useful progress during long work.
