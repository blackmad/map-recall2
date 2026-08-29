# Canal Recall roadmap

## Current implementation status

Completed and being refined:

- Live MapLibre vector map with north-up 2D and chase-camera 3D views.
- Optional near-first-person 3D camera alongside the third-person chase view.
- Boat recall routes, multiple-choice/typed answers, optional navigation aids, session-only learned labels, random POI trips, and repeatable home-base errands.
- Connected quiz highlighting: the prompt follows all adjoining same-name OSM path fragments (including bridge/tag splits) without highlighting disconnected same-name features elsewhere.
- Exact Dutch home-address lookup through the BAG/PDOK registry, including unit suffixes such as `13-3`; stale street-level geocoder results are versioned out.
- OSM-derived tree cache, rendered only in 3D mode.
- Neighborhood HUD/entry cards and landmark notices with highlighted MapLibre building extrusions.
- Trackpad and keyboard camera controls, remembered preferences, sound-off default, and absolute/relative vehicle controls.
- Recall streaks and combo multipliers: consecutive correct answers build a streak (up to 2× at 10), displayed in the HUD with per-answer point feedback; best streak and accuracy percentage shown on the finish screen.
- Landmark trivia cards: passing a notable place shows an expanded card with Wikipedia thumbnail, category badge (MUSEUM/BRIDGE/etc.), and multi-line description; the top 50 landmarks by prominence are image-preloaded at route start.
- Vintage "Greetings from…" neighborhood postcards: entering a neighborhood now uses the classic large-letter travel-card composition—script heading, oversized outlined neighborhood name with Wikimedia photography clipped inside the letters, sun-faded paper, and an Amsterdam location line. A SPARQL-based enrichment script supplies images for 27 of 42 neighborhoods, with a typographic fallback for the rest. Continue tuning mobile scale and long-name typography against in-game screenshots.
- Persistent exploration collection: learned waterways, visited neighborhoods, and discovered landmarks are tracked across sessions in localStorage; cumulative "city knowledge" stats appear on the finish screen and as a returning-player badge on the menu.

Active reliability work:

- Refine boat shoreline response and bridge traversal across more route geometries; the current guard rolls the hull inward and preserves canal-tangent movement instead of leaving it stuck against a quay.
- Continue rejecting distant or ambiguous home-address-to-waterway snaps after exact BAG address resolution.
- Validate route topology around docks, broad water polygons, bridges, and disconnected OSM path fragments. Closed water/shore polygon rings are now excluded from the navigable graph; continue auditing named open paths and graph junctions.
- ~~Replace the placeholder car network with correctly connected, road-snapped routes and starts.~~ ✅ The street extract preserves OSM highway classifications, selects only from the largest connected component (3249 of 4507 streets), and car mode now rolls back at the mapped road corridor instead of allowing a long soft excursion into canals/blocks. Steering is tighter with less lateral slide. Continue testing bridges, sharp junctions, cul-de-sacs, and dead-end streets.
- Integrate optional detailed 3D building data with OSM extrusions as a dependable fallback.

Next product passes:

- Better 3D OSM trees: replace flat map circles with lightweight instanced trunk/canopy geometry; vary height, crown scale, color, and silhouette deterministically from reusable OSM species/leaf-type tags; add distance-based LOD and culling; keep trees out of 2D mode and avoid obscuring navigation/quiz targets.
- Geolocated Amsterdam fact pipeline: build the staged fact ingestion system described in `FACT_PIPELINE.md` to produce curated, attributed `facts.json`; the existing landmark trivia cards will prefer pipeline facts over raw Wikipedia extracts once available.
- Additional cities backed by cached, versioned extracts.
- Authentic retro rendering and the optional arcade layer described below.

## Authentic retro rendering

The selectable theme presets are currently lightweight art-direction previews. A later rendering pass should make the retro modes structurally authentic rather than relying on CSS filters.

- Render the MapLibre scene and game objects into a deliberately low-resolution framebuffer.
- Quantize the framebuffer to a deliberately limited palette, with theme-specific ordered dithering.
- Upscale with nearest-neighbour sampling and preserve hard pixel boundaries.
- Give 8-bit and 16-bit modes distinct native resolutions, palettes, sprite treatments, and HUD typography.
- Add PSX-style vertex jitter, low-precision geometry, affine-looking texture warping, short draw distance, and coloured distance fog.
- Keep collision, routing, labels, and geographic coordinates at full precision; the degradation belongs only in the presentation pipeline.
- Ensure UI and quiz text remain readable, with an accessibility option to exclude instructional overlays from the low-resolution pass.

This can remain a MapLibre-based implementation: capture the WebGL output in a post-processing framebuffer, composite the game layer, apply the selected shader, and then present the upscaled result.

## Optional arcade layer

All overtly game-like systems must live behind one master `Game-y features` toggle. Turning it off should produce a calm, credible navigation-and-recall experience: no pickups, power-ups, streak effects, combo audio, floating points, or arcade obstacles. Difficulty and navigation aids remain independent of this toggle.

Prioritize mechanics that reinforce geographic learning:

1. **Landmark postcards** — ~~collect a postcard by passing a notable place~~ ✅ Landmark trivia cards with Wikipedia images and category badges are live; the route summary travel-journal view is a future addition.
2. **Recall streaks** — ✅ Implemented: consecutive correct answers build a multiplier (up to 2× at 10-streak) with HUD display and per-answer feedback. A mistake resets the multiplier but never blocks progress.
3. **Discovery tokens** — optional pickups placed at meaningful junctions, bridges, squares, locks, and ferry points rather than arbitrary coordinates.
4. **Perfect-turn bonus** — reward identifying the new feature quickly after a turn, encouraging attention to the transition between named waterways/roads.
5. **Local-knowledge bonus** — extra points for correctly identifying the neighborhood before it is revealed by the HUD.
6. **Route ribbons** — award bronze/silver/gold for recall accuracy, navigation-aid level, and route efficiency, not raw vehicle speed alone.
7. **Exploration collection** — ✅ Basic persistent tracking implemented: learned waterways, visited neighborhoods, and discovered landmarks saved to localStorage across sessions, shown on finish screen and menu. A full city album UI with per-item detail and mastery levels is a future addition.
8. **Signature landmark models** — keep OSM height extrusions as the city-wide fallback, then replace a curated set of destination buildings with licensed glTF/3D Tiles models. Each model needs source/license metadata, geographic anchor, heading, scale, LOD, and a footprint mask so it replaces rather than overlaps the OSM extrusion.
9. **Street trees and landmark planting** — ingest OSM `natural=tree`, tree rows, and park vegetation into a cached lightweight point layer; render instanced low-poly trees in 3D and simplified crowns in 2D. This is separate from the basemap because standard OpenMapTiles does not consistently ship individual tree nodes.

### Landmark model pipeline

The gray city is not a landmark-model catalog: it is OpenMapTiles building footprints extruded from OSM height data. Signature models should be an additive, curated asset tier:

1. Prefer openly licensed Amsterdam `.glb`/`.gltf` assets (city open-data/BAG/3D Basisvoorziening first); preserve author, source URL, license, and modification notes in a manifest.
2. Normalize each mesh offline, generate at least two LODs, compress it, and record longitude/latitude, ground altitude, heading, and scale.
3. At runtime, suppress the matching OSM footprint and place the model through a MapLibre custom 3D layer. Never draw both geometries.
4. Begin with route destinations where visual recognition matters: Rijksmuseum, NEMO, Maritime Museum, Royal Palace, Westerkerk, and Central Station.
5. Keep normal OSM extrusion as the no-download/failure fallback and apply the same active-landmark highlight state to both representations.
8. **Time and focus power-ups** — limited, legible bonuses such as extra quiz time, one eliminated multiple-choice answer, a brief destination bearing, or a short route-line reveal.
9. **Currents / tailwinds** — route-aware boost zones placed along real-world directional segments; avoid boosts near quiz transitions or tight junctions.
10. **Daily route seed** — the same POI route and assist constraints for everyone, with separate calm and arcade leaderboards.

Avoid mechanics that work against learning: random weapon systems, collisions that interrupt quizzes, opaque loot currencies, collectible spam, or rewards that encourage driving off the mapped network.

The setup screen and live settings panel should expose the master toggle. Individual arcade-system controls can remain in an advanced section if later playtesting shows that they are needed.

### Arcade reference: Crazy Taxi, not GTA

Use Crazy Taxi as the primary reference for pace, readability, and session structure. Borrow GTA-style aids only as optional navigation vocabulary (route line, bearing arrow, minimap), not as the tone or game fantasy.

- Treat important POIs as a rotating set of “fares”: select or collect a passenger/cargo request, learn the destination, navigate there, and immediately receive a nearby follow-on route.
- Make the destination beacon exuberant and readable in arcade mode, while the calm mode keeps the restrained map pin.
- Grade each trip on recall accuracy, route efficiency, discoveries, assist level, and optionally time. Speed alone should not dominate.
- Award meaningful time extensions for correct canal/street answers and efficient arrivals; wrong answers should cost combo/time without preventing completion.
- Build a route chain across neighborhoods so a session naturally teaches spatial relationships between several POIs.
- Let “passengers” be lightweight Amsterdam-flavoured requests—museum visitor, market delivery, ferry connection, canal tour guest—without requiring character simulation.
- Use a destination-category colour language: culture, transit, food/market, civic, park, nightlife, and hidden-history stops.
- Reserve exaggerated arrows, voice barks, combo typography, destination gates, pickups, boosts, and celebratory arrival effects for `Game-y features: On`.
- Add a short “quick fare” mode alongside deliberate study routes. The same map, graph, facts, and recall questions should power both.
- Keep collisions forgiving. The fun should come from flow, turns, geographic decisions, and chaining successful trips—not punishing vehicle damage.
