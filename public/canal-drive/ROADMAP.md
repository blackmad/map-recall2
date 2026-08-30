# Canal Recall roadmap

This file is the status board for the game, and it is kept current in the same
change that moves an item — not afterwards. Four sections: what is **done**,
what is **in progress**, what is **next**, and the **backlog**. Long-form
design notes for the larger bets live below the board.

## In progress

- **Typed presentation/runtime split — currently losing.** The intent is that
  `game.js` stays the composition root while finish, notice and HUD drawing move
  into props-driven TypeScript leaves that Storybook and direct checks can render
  without constructing a whole race. Two pieces have genuinely moved out: routing
  (the runtime delegates graph construction and pathfinding to the bundled typed
  road graph) and bottom-band placement (`bottomHudLayout`).

  Everything else has been accreting. `game.js` was 3,331 lines and is now 3,401:
  the street-knowledge card, the bottom-HUD call sites, the "no idea" branch and
  the boat wiring all went straight in, because each was small and the file was
  already there. That is how it got this big. The next presentation change should
  extract before it adds — the answer path (`_submitCanalAnswer`) is the honest
  next leaf, since it now carries scoring, scheduling and reveal logic that has
  no test and cannot get one while it lives here.
## Next

- Continue the new Storybook workbench by extracting canvas card/HUD renderers
  behind small props-driven adapters. Add fixtures for recall feedback,
  neighborhood entry (photo and fallback), landmark trivia, stacked notices,
  and every finish-card combination; pair them with screenshot regressions.
- Continue expanding named regression locations around cul-de-sacs and dead
  ends in `scripts/check-canal-car.ts`.
- **The driving harness is red and has been for a while.** `driving-harness`
  wants 14 of 24 planned routes driven to arrival and gets 12 — 12 lost, 0
  pinned, 0 timeouts, 34 wedges against the kerb. It is not the typed router:
  running the same harness with `road-graph.bundle.js` removed, so the legacy
  implementation takes over, produces byte-identical outcomes, which is decent
  evidence the delegation is faithful. So the autopilot loses half its routes
  on both. Either the steering gives up at a junction shape worth naming as a
  regression location, or the threshold was set optimistically and should be
  measured rather than asserted.
- **Expand the street encyclopedia beyond the first pinned street.** The
  runtime card, Wikipedia action and normalized-name join are proven with Nes;
  what remains is generating the compact knowledge extract for notable streets
  city-wide, with English blurbs and optional images.
- **A SimCity 2000-style isometric view of the city.** Worth a spike on its own
  branch: the detailed-buildings extrusion data and the roof-colour sampler
  already carry most of what an isometric renderer would need, and it is a very
  different feel from the top-down map without touching the routing physics.

- **Public transit mode.** Teach Amsterdam as a network of tram, metro, bus,
  and ferry lines: stops, line numbers and colours, direction/terminus, and
  transfers. Treat it as its own routing and recall model rather than a vehicle
  skin — a trip is a sequence of services and walking connections, questions
  should distinguish the stop from the line and destination, and live service
  disruption data must remain optional so the learning game still works from a
  cached, versioned network extract.

- **Bridge names that are railway lines.** "Gooilijn", "Oude Lijn" and
  "Westelijke Ringspoorbaan" are railway *lines*, and their viaducts are now
  each asked about separately — 17 crossings for the Westelijke Ringspoorbaan.
  Nothing in the extract distinguishes a railway bridge from a road bridge, so
  the fix is a tag in the extract builder rather than a runtime filter. Crossing
  under a viaduct should probably not be a bridge question at all.


- **City knowledge review map.** Add a dedicated full-city review screen where
  every learned road/waterway is color-coded by mastery and review state. Layer
  a fog-of-war / heatmap over the city to show strong, fading, and unexplored
  spatial knowledge; derive it from nearby learned features, visits, answer
  history, and recency rather than treating one drive-through as mastery.
- **Learning-aware route generation.** Feed spaced-repetition mastery into
  Dijkstra as a small, bounded cost on well-known streets so equally sensible
  routes prefer unfamiliar connections. Cap the allowed detour and never make
  mastered roads effectively impassable. Show the route's expected novelty,
  award a clearly explained score multiplier for newly encountered streets,
  and let calm mode use the routing benefit without arcade point chatter.
- **Clear all my data.** Add a deliberately guarded reset for test accounts and
  players who want a fresh start. It must clear local preferences/recall/
  exploration state and the signed-in Firebase copy, explain exactly what will
  be deleted, require confirmation, and leave authentication itself intact.
- Reward cycling on OSM ways with fully separated cycle tracks; make the bonus
  reinforce safe Amsterdam route knowledge without encouraging route detours.
- **Measured façade colors.** Pilot Amsterdam's open RGB point cloud (colors
  are registered from municipal panorama imagery) against BAG/PDOK LoD 2.2
  façade planes. For a few representative blocks, reject sparse, shadowed, or
  mixed samples and compare a muted median wall color with the current OSM-tag
  fallback before attempting a citywide pre-pass. Straight-down roof imagery
  cannot measure building sides on its own.

- Better 3D OSM trees: instanced trunk/canopy geometry with deterministic
  variation from OSM species tags, distance LOD, kept out of 2D.
- The geolocated Amsterdam fact pipeline described in `FACT_PIPELINE.md`;
  landmark cards would prefer curated facts over raw Wikipedia ledes.
- Additional cities behind cached, versioned extracts.
- Authentic retro rendering (see below) and the optional arcade layer (below).
- Signature landmark models for the handful of buildings worth recognising.
- Extract refresh with `motorway`/`trunk`/`*_link` classes included: Weesp and
  a few other genuine islands are unreachable without them, and the build's
  connected-street filter uses endpoint proximity rather than shared vertices,
  which is the same mistake the runtime graph used to make.

The sections below are design notes for those bets, not queued work.

## Earlier work, still true

The list below predates the status board and describes the systems that are
already in place.

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
- Bridge recall: driving over a bridge, or passing under one by boat, asks which bridge it is. Backed by the 300-entry `bridges.json` extract, which supplies geometry and ready-made distractors, so the multiple-choice options are real neighbouring bridges rather than nearby street names.
- Route destinations come from the landmark extract (245 reachable POIs) rather than 11 hand-written coordinates. Candidates are capped by distance from the centre and from each other so both ends fall inside one fetch window; an unsnappable endpoint is swapped for the nearest one that snaps, an unreachable destination is retargeted using a single Dijkstra pass over the whole pool, and an origin stranded in a disconnected component (typically across the IJ) re-rolls the pair.
- Landmark cards show a Wikipedia affordance and `W` opens the article; the extract's `wikipediaUrl` and `wikidata` are carried onto the runtime record.
- Persistent exploration collection: learned waterways, visited neighborhoods, and discovered landmarks are tracked across sessions in localStorage; cumulative "city knowledge" stats appear on the finish screen and as a returning-player badge on the menu.
- Route ribbons on the finish card: bronze/silver/gold graded on recall, self-reliance, and route efficiency rather than speed, with a per-axis breakdown.
- Master `Game-y features` toggle on the setup screen and live settings panel, gating streaks, multipliers, points, and ribbons; the finish card lays itself out from a cursor so it reflows for whichever sections are present.
- Neighborhood postcard images are fetched on demand: the two route endpoints are warmed at race setup and the rest load on entry, replacing a whole-city preload of ~26 images per route. Their URLs are now stored as direct `upload.wikimedia.org` thumbnails, because the `Special:FilePath` redirect they used before is not CORS-safe for the canvas renderer.

Recently fixed:

- `latLngToGamePoint` rejected every landmark. Callers pass `false` for "no snap limit", but `bestDist > false` coerces to `bestDist > 0`, so any point not exactly on a segment was dropped and `this.landmarks` was always empty. Landmark trivia cards, proximity notices, the top-50 image preload, and click-to-inspect were all inert; map labels still drew because they come from the raw extract rather than the runtime list. Now 300 landmarks load, 236 with Wikipedia URLs.
- Clicking a building matched landmarks by exact name equality, so any punctuation or casing difference fell through to the generic "Mapped building" card. Names are compared normalised, with a 60 m nearest-landmark fallback.
- The routing graph is built once per network and cached instead of being rebuilt on every `findRoute` call.

Active reliability work:

- Refine boat shoreline response and bridge traversal across more route geometries; the current guard rolls the hull inward and preserves canal-tangent movement instead of leaving it stuck against a quay.
- Continue rejecting distant or ambiguous home-address-to-waterway snaps after exact BAG address resolution.
- Validate route topology around docks, broad water polygons, bridges, and disconnected OSM path fragments. Closed water/shore polygon rings are now excluded from the navigable graph; continue auditing named open paths and graph junctions.
- ~~Replace the placeholder car network with correctly connected, road-snapped routes and starts.~~ ✅ The compact 300-street quiz partition is now separate from car mode's full largest-connected-component routing extract (3249 of 4507 streets), so visible approaches such as the Da Costakade crossings retain their drivable centerlines. The extract preserves OSM highway classifications; car mode rolls back at the mapped corridor instead of allowing canal/block excursions, with tighter steering and less lateral slide. The road guard is a shared TypeScript module with deterministic and live-browser simulations. Continue expanding named regression locations around cul-de-sacs and dead ends.
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

✅ The master `Game-y features` toggle is implemented and exposed on both the setup screen and the live settings panel, defaulting to on and persisted with the other preferences. Turning it off removes the streak multiplier, the streak badge and points from the HUD, the point and streak chatter from answer feedback, and the points, best-streak, and route ribbon from the finish card; accuracy, learned names, the exploration collection, landmark cards, and neighborhood postcards all remain. Difficulty and navigation aids are independent of it, as required. Answers are still scored internally while it is off, so toggling mid-route does not leave a hole in the tally.

Every new arcade system below must be gated on this toggle. Turning it off should produce a calm, credible navigation-and-recall experience: no pickups, power-ups, streak effects, combo audio, floating points, or arcade obstacles.

Note: the inherited Smokey's pursuit/opponent layer has been deleted rather than gated — `PoliceCar`, `TrafficCar`, and `AICar` were never constructed, so the arrest/warning system, CB radio, opponent AI, and their draw calls and constants were all unreachable. If pursuit is ever revived it must be built behind this toggle.

Prioritize mechanics that reinforce geographic learning:

1. **Landmark postcards** — ~~collect a postcard by passing a notable place~~ ✅ Landmark trivia cards with Wikipedia images and category badges are live; the route summary travel-journal view is a future addition.
2. **Recall streaks** — ✅ Implemented: consecutive correct answers build a multiplier (up to 2× at 10-streak) with HUD display and per-answer feedback. A mistake resets the multiplier but never blocks progress.
3. **Discovery tokens** — optional pickups placed at meaningful junctions, bridges, squares, locks, and ferry points rather than arbitrary coordinates.
4. **Perfect-turn bonus** — reward identifying the new feature quickly after a turn, encouraging attention to the transition between named waterways/roads.
5. **Local-knowledge bonus** — extra points for correctly identifying the neighborhood before it is revealed by the HUD.
6. **Route ribbons** — ✅ Implemented: the finish card awards bronze/silver/gold from a weighted blend of recall accuracy (50%), self-reliance (25%, scored on whichever navigation aids were switched on at any point during the route, with typed answers buying back some of the cost), and route efficiency (25%, planned graph route length over distance actually travelled). Speed is deliberately not an input, and each tier also has a hard minimum recall so an efficient unaided run that never named a canal cannot out-rank a slower player who knew where they were. The band shows a rosette, the tier, and a per-axis breakdown so the grade explains itself.
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
