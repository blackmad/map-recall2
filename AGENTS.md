# Canal Recall project memory

## Source access retries

DNS and network failures can be transient. Retry failed source requests with bounded backoff, reuse successful cached responses, and continue independent work between attempts. A failed request is not evidence that a source is permanently unavailable. Record the attempt time and current access state; retry on later passes before treating source acquisition as blocked. The user explicitly requested this behavior on 2026-10-06.

Distinguish host connectivity from tool and worker restrictions. If a worker reports `CODEX_SANDBOX_NETWORK_DISABLED=1`, route authorized downloads through a working root tool context and let the worker parse cached inputs. Keep raw API responses, photos and catalogue records in the companion `map-recall2-source-data` repository; main-repo `artifacts/` is temporary acquisition staging only. Verify and push the source pack, record its commit/path, then remove duplicated staged originals.

## Amsterdam POI work

The user authorizes ongoing landmark work, parallel agents, and periodic commits and pushes. Keep requested tasks and deferred work in `public/canal-drive/poi-work-queue.json`; regenerate `public/canal-drive/landmark-backlog.json` with `scripts/landmarks/build-poi-backlog.ts` as assets and POI coverage change. Do not drop earlier requests when the user adds another building or reports a bug.

Preserve the current visual quality and researched/gallery/live-game acceptance bar while reducing overhead. Use fresh workers with short scoped context (`fork_turns="none"` and an explicit handoff for new Codex workers), cached source records, bounded tool output, and batched shared generation/checks. Do not keep reusing a long worker conversation across unrelated buildings. Follow `docs/landmark-building-recipe.md`; `docs/landmark-deepseek-handoff.md` is a self-contained external-worker trial. Do not lower model detail or omit required acceptance checks to save budget.

Do not add painted building-name words for identification. Keep only source-supported real signage that is a defining architectural feature, fitted to its actual panel and wall plane. Use the game map label for the POI name.

Every modeled POI building must be integrated into all three game surfaces:
1. A selectable POI route destination.
2. A geographically correct map pin and label.
3. A meaningful info/trivia card with research source links.

Audit these together before declaring a POI complete. Reuse genuine extract identities and preserve existing researched facts. An asset belonging to an already selectable complex can share that POI identity; do not manufacture duplicate destinations for aliases or multiple mesh parts. Muziekgebouw and Bimhuis remain distinct genuine destinations despite sharing a mesh. Year-built-only generic building metadata is not meaningful trivia: clicking it must not select or highlight the building. If the clicked building contains a genuine POI, show that POI's useful card instead.

An explicitly selected destination must never silently become another POI when the travel network cannot reach it. Keep a chosen home/GPS origin fixed; a Surprise origin may retry within the existing bound. Show a clear route failure when necessary. Large complexes can use a sourced public entrance for their destination pin instead of an inaccessible building centroid. Manual POI pins remain visible even when broad street-name spoiler filtering would match them.

For ordinary clicked buildings, use mapped place information only from points inside the actual installed footprint, excluding courtyard holes. Prefer researched landmark cards, validate website links, and keep basic mapped-place info separate from the curated automatic route pool. Never substitute a nearby POI for the clicked building.

Author landmarks in the established texture-free, flat-color house style using native surveyed footprints, scale 1, and current OSM/BAG identities. Rebuild legacy imports in this style, beginning with Westerkerk. Reference photos guide original geometry; do not copy downloaded meshes or photo pixels into original assets. Verify actual scope, heights, open courts, underpasses, and neighboring buildings. Suppress exact replaced identities after the GLB loads, preserve fallback on load failure, and avoid padded rectangular suppression.

Reuse the `BuildingTools` primitives/materials and `scripts/landmarks/house-geometry.ts` footprint shells/upward roof planes. Explicit roof surfaces own their tops; overlapping wall-colored caps and downward roof normals are recurring errors. Keep source polygons, primary references, semantic height notes, and geometry/browser checks with each builder. Verify first-hit facade visibility, supported roof profiles, and open spaces; decorative panes/columns can be buried by an otherwise correct parent extrusion. AHN/3DBAG equipment maxima or fitted crest planes must not become whole-building heights or unsupported roof plates.

Signature replacement suppression applies to every ordinary building layer, including the independent pyramidal-roof renderer. Hide those roofs only after the replacement loads, preserve neighbors, and restore fallback when the replacement is disabled/unavailable. Use visibility updates rather than rebuilding every roof per model-load callback.

The manual asset generator also refreshes `modelAssetVersions.json`. Rebuild the signature browser/runtime bundles after model changes so gallery and game request the current content fingerprint rather than a cached older mesh.

Use the POI Destinations list and explicit requested additions as the main work queue. Regenerate `public/canal-drive/dominant-building-backlog.json` with `scripts/landmarks/build-dominant-building-backlog.ts` for large ordinary buildings. Thresholds live in the work queue (currently net footprint 2,500 m² or height 35 m); constrain candidates to the Amsterdam municipality, exclude modeled identities, group duplicate outlines/raised parts, and preserve separate courtyard buildings. Do not treat unnamed candidates as researched POIs automatically.

The progress dashboard is `public/canal-drive/landmark-queue.html`: model coverage, work tasks, dominant building candidates, and requested street buildings are separate inventories. Street requests live in `requested-street-buildings.json`, resolved through explicit official address/VBO/BAG parent relationships with reproducible source snapshots. Group apartments by physical building; defer permit-only parents and do not invent built geometry. Candidate ranking is not an exhaustive audit of gray buildings in the renderer.

Photo buildings mode should use realistic material colors. Mode changes must update geometry and color consistently, including streamed tiles and cached/in-flight worker results. Distinguish source detail, fallback extrusions, and render defects before deciding a gray building needs a custom landmark.

Coordinate source ownership, shared registration, GPU browser reviews, and git-index windows between agents. One agent owns shared catalogue/dispatcher/bundle registration at a time. Preserve unrelated files and drafts. Review native-scale gallery and live-game views, exact suppression/neighbor retention, and appropriate meaningful regression checks before commit. Keep reporting useful progress during long work.

Large ordinary candidates may use the user-authorized standard-building loop only after recorded visual recognition/open-space review in `public/canal-drive/dominant-building-fidelity.json`. Follow the standard-treatment section of `docs/landmark-building-recipe.md`. Geometry screening is a suggestion, not acceptance. Distinctive/requested landmarks (including ING House), mapped POIs and raised structures keep the full loop. Preserve native scope, correct colors/roof/open spaces, exact suppression and gallery/live neighbor checks in both loops.

For each new historic landmark, make one bounded address-based Beeldbank search and read its monument-register description early. Cache drawings/photos and explicit architectural assertions with their source, building part, date and confidence; compare dated drawings with current photos/alterations. Use Data Amsterdam Bouwdossiers1905–2010 for unresolved details, recording access state honestly; ask the user for specific useful sheets when email access is needed, and keep independent builds moving. Distinguish BAG VBO usable area from Pand footprint. Follow the reference workflow in docs/landmark-building-recipe.md.

Every landmark build must archive task-relevant raw sources per canonical model ID in the private GitHub repository blackmad/map-recall2-source-data (local sibling /Users/blackmad/Code/map-recall2-source-data). Save original photos/scans, register descriptions/pages, survey/API responses and imported reference inputs before extraction; retain provenance/checksums/access state and distinguish raw from processed. Sync and commit the private source pack before the model commit, record its source commit/path, and reuse it in worker handoffs. Follow the source-archive section of docs/landmark-building-recipe.md; do not archive secrets or unrelated personal files.

For new landmark reference photos, use a bounded Amsterdam Beeldbank address/name search as a standard research step. Preserve original images and catalogue/page captures in the private source pack; record dates, rights and access gaps. Cross-check historical features against current photos and BAG/roof evidence.

During the user-authorized continuous landmark queue run, keep progressing through batch checkpoints and assign the next bounded POIs while integration/review proceeds. Source archival and documentation support building work; they do not replace it. Do not end at each single-model checkpoint or imply workers are active when they are idle. Use fresh short-context workers and keep shared GPU/git mutations coordinated.

## Submitted feedback

When asked to review or fix feedback submitted from the game or image galleries, use `.agents/skills/canal-feedback/SKILL.md` and `npm run feedback:queue -- pull`. Read the full saved note, screenshot, image anchor, host and build context before claiming work. Preserve user evidence, claim with the note's Firestore update-time precondition, and resolve only after the relevant behavior/visual checks. Keep landmark and street tasks in their existing inventories as well; cloud feedback does not replace them.
