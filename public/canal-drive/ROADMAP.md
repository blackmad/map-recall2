# Canal Recall roadmap

This file is the status board for the game, and it is kept current in the same
change that moves an item — not afterwards. Four sections: what is **done**,
what is **in progress**, what is **next**, and the **backlog**. Long-form
design notes for the larger bets live below the board.

## In progress

- **English-only encyclopedia text.** `enrich-amsterdam-wikipedia-extracts.ts`
  resolves an English article through the Wikidata `enwiki` sitelink and, when
  that fails, through the Dutch article's interwiki link. What remains are the
  features with no English article at all — 124 of 236 landmark blurbs and 278
  of 299 bridge blurbs are still Dutch, tagged `wikipediaExtractLang: "nl"`.
  Those need translating or withholding; showing Dutch to a player learning the
  city in English is not the intent.
- **Satellite roof colouring — coverage.** The sampler exists and runs
  (`npm run build:roof-colours`, see below), but it can only colour buildings
  the extract already ships geometry for: 10,578 of roughly 104,000 footprints
  in the play area, because `buildings-colored.geojson` was built from OSM
  appearance *tags*. Everything else is drawn by the basemap from a height
  ramp, which is the grey city. Extending it means shipping footprints: the
  4.4 × 4.2 km core is 43,398 buildings, 9.2 MB of trimmed rings, 1.9 MB
  gzipped — affordable, but it needs a roof-only extrusion layer whose base
  height matches what the basemap already draws, or the caps float.

## Next

- Wider postcard coverage: 29 of the 91 mapped areas carry an enriched
  Wikipedia blurb and image; the districts and quarters that now supply most
  postcards mostly do not.
- Bridge distractors drawn from the same canal ring, so the four options are a
  real test rather than four unrelated bridges.
- Continue expanding named regression locations around cul-de-sacs and dead
  ends in `scripts/check-canal-car.ts`.

## Recently done

- **Routing reachability.** OSM models a side street meeting a through street
  as a node *inside* the through way, and both the extract builder and the
  loader run Douglas-Peucker, which drops 9.9% of those shared junction
  vertices — the side street then has no shared point with the street it
  visibly joins and becomes its own island: drivable, unroutable. The routing
  graph now stitches every way endpoint onto any centreline within 10 px (~3 m,
  the simplifier's own tolerance). Components: 1679 → 442; largest component:
  56.5% → 75.3% of the network. Measured by `npm run test:reachability`.
- **Cars no longer wedge against the kerb.** The road guard undid the whole
  step whenever a frame ended outside the corridor, so a car resting against a
  kerb with its nose pointing off-road accelerated, left the corridor, and was
  put back in the same spot forever. It now keeps the along-the-street part of
  the movement, cancels outward velocity on the shoulder, eases the heading
  back along the road, and walks the car to the centreline after repeated
  blocks. Over the same 24 harness drives: 11 arrivals and 151 kerb wedges
  before, 18 and 16 after (`tests/e2e/driving-harness.spec.ts`).
- **Neighborhood postcards actually appear.** Only 42 of 91 mapped areas are
  tagged `neighbourhood`, covering a tenth of the drivable network, and the
  first area entered was adopted silently — so the card for the neighborhood a
  route starts in never showed at all. Quarters and districts now count too,
  finest area first: 78/796 sampled streets inside a named area became 793/796.
- **HUD and info cards.** Landmark trivia moved to the bottom of the screen,
  stacking above a postcard when both are up. Corrections hold for 3.2 s rather
  than 650 ms. Streets stay named on the map once revealed — in the car as well
  as the boat, and including names answered wrongly — with the street currently
  under question withheld so the map cannot answer for the player.
- **Bridges, quieter.** Questions are rationed to one every 90 s, only fire on
  a genuine crossing of the span's midpoint gate, never name the street the
  vehicle is already on, and the 43 bridges called "Brug 117" are dropped as
  questions and as distractors. Learned-bridge labels draw beneath the vehicle
  at background weight and fade out entirely near it.
- **Camera.** Panning detaches the view from the vehicle and pins it to the
  world, so the vehicle drives across a held map instead of staying nailed to
  the centre of the screen; `R` or the re-centre button reattaches it. The 2D
  views carry 14 degrees of tilt, enough for buildings to have sides.
- **Wikipedia extracts for landmarks and bridges** are fetched in bulk rather
  than one at a time on approach, with English resolved through Wikidata. The
  runtime fallback fetch for anything the extract misses now resolves the
  English article through the feature's Wikidata id instead of reading the
  Dutch article OSM tags, so a card is English or it is just a name.
- **Roofs are measured, not guessed.** `scripts/build-satellite-roof-colours.ts`
  samples PDOK's 8 cm open aerial imagery: footprint into Web Mercator, one
  cached 128 m tile per city block, pixels strictly inside the footprint eroded
  by one pixel, per-channel median, and a reading is thrown away if there are
  fewer than 12 pixels or the spread says it is not one surface. 5,778 roofs
  measured; 3,388 kept the colour a mapper had tagged by hand; 1,412 rejected.
  The palette that comes back is the real one — zinc and bitumen greys with a
  minority of warm tile — where before every roof was a copy of its own wall.

## Backlog

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
