# Canal Recall — what is built

Finished work, newest first. The work board is `TODO.md`; nothing unfinished
belongs here.

Entries keep the words they were written in, because each records *why* a thing
is the way it is, and that is the expensive part to recover later.

- **Google's photorealistic mesh was measured at cycling height, and rejected
  for the driving corridor.** The question was whether to replace the view layer
  with Google Earth's imagery, since `3d-tiles-renderer` already ships here for
  3DBAG LoD2.2 and Google Photorealistic 3D Tiles is the same OGC format behind
  a `GoogleCloudAuthPlugin` — no Cesium and no Unity required. It is roughly a
  tileset-URL swap, so it was cheap to answer with pictures instead of argument.
  `google-tiles-spike.html` renders Google's tiles at pinned Amsterdam canal
  locations with a one-click 1.7 m / 150 m toggle. At Prinsengracht
  (52.37511, 4.88347), fully converged at Google's best LOD — 412 tiles loaded,
  nothing queued or parsing — the 192 m view is excellent and the 1.7 m view is
  unusable: trees collapse to faceted green blobs, the canal is a flat grey
  smear, facades are illegible, and moored boats are fused into the quay. The
  decisive point is not the blur but what it costs: Google returns anonymous
  triangle soup, so a correct-answer building cannot be highlighted and a fact
  card cannot be attached to it. 3DBAG geometry carries a building id; that
  semantics is the product, and photogrammetry trades it for pixels that only
  hold up from altitudes the game never uses. Kept as an evaluation harness,
  not shipped surface: it is excluded from `npm run build`, bundles its own
  three.js rather than the shared `three.bundle.js` global, and takes its API
  key from `localStorage` or `?key=`, never the repo.

  Three things cost real time and will cost it again. **Ellipsoid height is not
  eye height:** the Netherlands sits about 43 m above the WGS84 ellipsoid, so a
  camera at "1.7 m" is ~41 m underground; ground truth comes from raycasting the
  loaded mesh, taking the *deepest* hit, since the first is a roof or tree
  canopy. **Both the render loop and the library's own download and parse queues
  schedule through `requestAnimationFrame`**, which a background or headless tab
  throttles to a standstill — traversal marks tiles `queued` and nothing ever
  downloads. The exported `Scheduler.flushPending()` plus a hand-pumped `frame()`
  is what makes screenshot regressions possible at all. **The bundle must be
  ESM:** three's `DRACOLoader` resolves decoder paths at module top level via
  `new URL(..., import.meta.url)`, which esbuild stubs out of an IIFE, throwing
  "Invalid URL" before any of our code runs. Also note Google's browser-key
  referrer patterns need a path component — `http://localhost:*` never matches,
  `http://localhost:3000/*` does.

- **The phone pass reached past the driving screen.** Portrait, the d-pad and
  the paper system had covered the map and the HUD; the overlays over them had
  never been opened at a phone's size, because the `iphone` Playwright project
  could not reach them until the horizontal-overflow bug below was fixed.
  Opening them found real faults, not polish.

  The recall question docked to the bottom of a portrait screen at 72dvh, which
  put its top edge above the vehicle — so the game asked which canal you were
  on while the card covered the canal you were on. It is capped at 46dvh and
  scrolls. The d-pad was still being drawn underneath every overlay: the
  vehicle is stopped behind a question, so those were dead controls under an
  opaque card, and the pad is now suppressed whenever a question, panel or
  article owns the screen.

  The arrival card was the last dark surface in the game — navy with a sky
  accent at the end of a route played on paper — and its actions were ENTER,
  ESC and C, three keys a phone does not have. It is paper now, with real
  buttons hit-tested against `_finishButtonBounds`; the keyboard paths run the
  same actions rather than a second copy of them. Its five stats were laid out
  in five columns sized for a 600 px card and ran "420", "03:33" and "0.00 km"
  into each other at 366 px; they wrap into rows of three. The card itself was
  600 px wide, which put its left edge at x = -105 on a phone. The settings
  panel clipped its own Done button off the bottom of an over-tall centred
  card, and its checkboxes were 13 px targets.

  Touch had no zoom at all — only the `-`/`+` keys and a trackpad wheel — so
  two-finger pinch now works anywhere outside the pad, and a pinch no longer
  also pans.

  Storybook earned its place here: three of these were found by building the
  states rather than by reading the code. It also exposed two bugs of the same
  class in the existing fixtures. `CANVAS_W`, `CANVAS_H` and `PIXELS_PER_METER`
  are top-level `let`/`const` in classic scripts, which makes them global
  *lexical* bindings and never properties of `window`; the stories read them
  off `contentWindow`, got `undefined`, and silently fell back to 1280×720 and
  to a NaN distance. And every finish story had been throwing on
  `routeDifficulty.charAt` — invisible for as long as the frame itself was
  404ing.

- **The grounded trivia catalog now covers the Randstad.** OpenRouter Qwen 3.5
  Flash summarized cached real Wikipedia sections while local `trn` translated
  Dutch evidence sentence-for-sentence. A separately versioned verifier plus
  deterministic gates rejected 3,735 candidates and retained full rejection
  reasons and evidence for audit. The owner approved the 4,263 survivors: 2,239
  Amsterdam facts, 760 Rotterdam facts, 663 Den Haag facts and 601 Utrecht
  facts across 1,456 features. Each shipped statement retains its exact source,
  translation where applicable, licence, retrieval date, writer and verifier.
  The entire four-city OpenRouter generation cost $0.3102.

  `/canal-drive/trivia-review.html` exposes staged, rejected and published
  catalogs separately, with city tabs, search, filters, evidence drill-down and
  manual checkpoint refresh. Rejected text never enters the shipped catalogs.

- **Canal Recall became playable on a phone, and the product became one design
  system.** The canvas was a fixed 1280×720 logical surface letterboxed into
  whatever window it was given, so a 390×844 phone got a 390×219 canvas floating
  in the middle of the screen while the MapLibre layer underneath kept its own
  size: the HUD and the map showed different parts of Amsterdam, and most of the
  HUD — placed by constants like `roundRect(ctx, 15, 15, 310, …)` — was off
  screen. `viewport.ts` now decides the logical space (desktop keeps the proven
  16:9 letterbox; a touch viewport *becomes* the CSS viewport, so the canvas
  fills the screen and 13 px type renders at 13 px), and `hudLayout.ts` places
  every card for desktop, compact portrait and compact landscape.

  This also explains and closes the old item 14b, "Playwright's phone projects
  cannot reach fixed overlays". The 613×1044 layout viewport inside a 390×664
  device viewport was not the launch config: it was the page. `#route-card` was
  `min(94vw, 680px)` inside a 22 px-padded flex container — wider than its
  container on any screen under ~733 px — and `#vector-map` was centred with
  `left = (innerWidth - width) / 2`, so a stale width left it hanging off the
  right edge. The page overflowed, Chrome shrank to fit, `innerWidth` grew, and
  the next resize overflowed further. Worse, the inflated width read as a
  desktop and latched the 16:9 layout onto the phone for the rest of the
  session. The canvas and map are now pinned to the viewport and cannot widen
  the document; measured after the fix, `innerWidth` is a true 390 with zero
  overflowing elements. Portrait plus touch also reads as a phone whatever width
  the layout viewport claims, and `orientationchange`/`visualViewport` are
  listened to, not just `resize`.

  Driving on touch was an invisible gesture — the left half of the screen
  steered *and* forced the throttle, the right half was gas above and brake
  below, a double-tap was the handbrake — and it shared its pixels with the
  camera-pan drag, so panning the map also drove the boat. It is one drawn
  d-pad with auto-throttle now: the vehicle rolls forward unless you brake, so a
  learner spends their attention on the city rather than on holding a pedal. The
  pad is a 3×3 grid, so the corners give diagonals and a thumb that lands
  slightly off still reads as the direction the player meant. The pad owns its
  rectangle and nothing else; touches outside it pan the camera. Tapping the map
  no longer presses Enter on every touch while driving.

  On the design: there were three visual languages plus a fourth set of cream
  hexes hand-coded in `hud.js` — a warm paper map sheet for the briefing, dark
  navy with a sky accent for the in-game chrome, and dark-and-gold for the
  trivia card. Moving between the briefing and the game felt like moving between
  two products. All of it is now the root map-quest app's own paper tokens, held
  in `hudTheme.ts` and mirrored as CSS custom properties so the two surfaces
  cannot drift, and the same tokens are what a future map-quest/Canal Recall
  merge would start from. The trivia card is measured at the width it will be
  drawn at, so a phone card rewraps instead of clipping.

  Verified by 576 portrait/landscape layout scenarios across six device
  profiles asserting every HUD rectangle is on screen and disjoint, by the
  existing 288-scenario desktop suite passing unchanged (the proof the desktop
  layout did not move), and by six new Storybook phone states. `storybook dev`
  served `/canal-drive/` as a 404, so every game-frame story rendered the dev
  server's "Not Found" page; the stories name `index.html` explicitly now.
- **Reviewed trivia and civic POIs reached the original Map Recall game.** Its
  Amsterdam extract loader now joins the shared reviewed `facts.json` only by
  exact feature id. Answer cards prefer a provenance-bearing quotation and
  rotate deterministically by game seed and round; a missing catalog or an
  unmatched feature keeps the existing Wikipedia card. The join is typed and
  tested independently of React. The same audit found that cinema, library,
  university and music-venue features were extracted but absent from both the
  All and Landmarks category type lists, so the UI filtered them out; both
  lists and the regression check now include every civic POI type.

- **Local facts now have an editorial boundary and a memory.** The old Ollama
  script read the same lede already shown on the card, asked for exactly three
  facts, and wrote its first answer directly into the public extract. Its
  replacement caches whole Wikipedia articles, mines useful sections, records
  statement-level source/licence/model provenance, and rejects ungrounded
  numbers, stale wording, lede restatements and duplicates before anything can
  be reviewed. Output is staged; a version-matched human label is required for
  `facts:publish`, and the committed review starts empty so silence can never
  mean approval.

  The runtime loads the resulting `facts.json` as optional enrichment. It shows
  every reviewed sentence once before repeating the oldest, varies naming,
  history, design and curiosity across cards, and remembers the rotation in
  local storage. Missing files—including a development server returning its
  HTML fallback with status 200—leave the Wikipedia lede intact instead of
  blanking all landmarks. The decision modules and their staging/publication
  gate are covered by `test:facts`.

  The first real run changed the safety boundary again. Merely checking that
  every generated number occurred in the source admitted false relationships:
  2009 to 2012 became “six years”, 1988 became “80 years prior to 2013”, and an
  event borrowed the date from the next sentence. Ollama now performs
  **extractive summarisation** over cached English Wikipedia: it selects and
  classifies, while the displayed sentence must occur verbatim in the selected
  passage. Dutch-to-English generation cannot publish yet. Complete-sentence,
  explicit-subject and exact-provenance gates reduced a 30-feature pilot from
  141 rewrites to 27 eligible quotations; review struck 6, left 2 features
  unreviewed, and published 19 statements for 9 features. This lower yield is
  the intended cost of making a fact catalog safe to learn from.

- **The Randstad pipeline claimed four cities and built two.** `refresh-randstad.sh`
  had been wired for Amsterdam, Rotterdam, Den Haag and Utrecht since 4758e46,
  but Rotterdam and Den Haag had never been built, and both failed at the same
  line — `municipality polygon was not found` — for two different reasons.

  **Den Haag was a name.** The pipeline asked osmium for `r/name='s-Gravenhage'`.
  OSM now carries that relation as `name=Den Haag` with `'s-Gravenhage` demoted
  to `official_name`, so the filter matched nothing and the boundary file came
  back empty. The builder already tolerated several name fields; the osmium step
  in front of it did not, and it is the one that decides what reaches the
  builder at all.

  **Rotterdam was a bbox.** Measured against Overpass: the municipality spans
  lon 3.94–4.60 because it reaches Hoek van Holland, while BBBike's Rotterdam
  extract starts at lon 4.18. The boundary relation therefore arrived with its
  western ways missing, and an unclosable relation assembles into no polygon at
  all. Amsterdam and Utrecht are both comfortably inside their BBBike boxes,
  which is the only reason this had never been seen.

  The fix is ordering: the fourth argument now takes any PBF URL, Rotterdam and
  Den Haag are cut from a cached Zuid-Holland province file, and the cut is
  derived from the municipality *after* its boundary has been read
  (`select-municipality-bbox.ts`) rather than guessed before. Which relation is
  "the city" moved into `lib/municipality.ts` so the shell step and the builder
  cannot disagree — clipping features to one boundary and naming them after
  another would be silent.

  Both cities now build: Rotterdam 31,810 routing ways / 227 waters / 22,559
  appearance-backed buildings, Den Haag 17,920 / 90 / 27,576. The runtime still
  cannot reach any of them — `osm-loader.js` hardcodes Amsterdam — so this is
  data, not a playable city. `test:municipality` pins both failures.

- **The refused ledes are rescued by protecting the name, not weakening the
  guard.** The English pass refuses a translation that drops the feature's own
  name, because a card calling the Aluminiumbrug the "Aluminum Bridge" teaches
  the wrong name. That fired on every name built from a Dutch common noun —
  brug, kerk, kapel, synagoge — and left 130 Amsterdam features showing a
  Wikidata one-liner ("Bridge in Amsterdam, Netherlands.") instead of a lede
  naming the canal it spans and the year it was built.

  Neither CLI translator takes a prompt, so the name is protected *around* the
  translator: `protectNames` substitutes an invented capitalised placeholder
  for the feature's own name, the translator works on that, and the name is put
  back before the guard runs. Amsterdam went from 130 descriptions to 126 real
  ledes — 440 translated / 8 descriptions / 0 non-English. The Aluminiumbrug
  now says it spans the Kloveniersburgwal and that Pieter Bast drew a bridge
  there on his 1599 city plan.

  Three measured choices. The placeholder has to be *name-shaped*: a
  noun-shaped one ("Qplaats") pulled "ophaalbrug" from "lift bridge" to
  "pick-up bridge" in the same sentence, while name-shaped tokens came back
  byte-identical in every position tried — subject, possessive, after a
  preposition. Protection is **case-sensitive**, because a Dutch lede writes
  "De Oude Lutherse Kerk … de kerk werd gebouwd", and protecting that second,
  lowercase "kerk" would restore "Kerk was built" into the English; restoring
  the capitalised occurrence alone satisfies the guard for every token of the
  name. And the guard still runs afterwards on the restored text, which is how
  8 refusals survived protection and kept their description — including
  "Brug 361", whose Dutch lede is actually about brug 244.

- **The OSM loader is an adapter: its arithmetic is typed and tested.**
  Projection about a chosen centre, Douglas-Peucker, recentring the network on
  the world origin, snapping a lat/lng onto the nearest carriageway,
  start/finish selection, haversine and the slippy-tile grid all moved to
  `src/canalRecall/osm/roadProjection.ts`. `osm-loader.js` went from 404 lines
  to 268, and what remains is Overpass mirrors, failover and `Image` loading —
  I/O that can only be tested by going to the network.

  Two things worth keeping. The world is **centred twice**: ways are projected
  about the geographic centre, then the whole network is translated so its
  bounding box lands on `WORLD_ORIGIN` (1300, 1000). Anything projected later —
  a POI, a home address, a basemap tile — must be given that same offset, which
  is why `buildRoadSegments` returns it rather than hiding it. And
  `WORLD_ORIGIN` is not decorative: `findStartFinish` measures "near the city
  centre" as distance from it, so moving it moves every route's start.

  The one deliberate behaviour change is the simplifier: recursive with a
  `depth > 50` cap became an explicit stack. That cap returned the unsimplified
  remainder without saying so. Measured, it never fires — the two agree exactly
  on all 6,542 paths in the shipped extract, longest 1,665 points, and
  `check-road-projection.ts` re-runs that comparison against the old algorithm
  on every run. A latent hazard removed rather than a bug fixed.

  The typed tile helpers are fractional so they round-trip; a tile *index* is
  the floor of that, which is the caller's need and stays in the adapter.

  Verified with the driving harness, the reachability audit, the car
  regressions and the full Canal Recall e2e spec.

- **The game speaks English: 448 Dutch ledes down to 4.**
  `trn` (hotchpotch/trn, Apple Intelligence via `--quality high`) is installed
  and the pass finally ran end to end. 314 features carry a translated lede,
  130 fall back to a Wikidata description, 4 are still Dutch.

  The pass had never actually worked under Node. `trn` 0.2.0 decides whether it
  has stdin at startup, before a pipe opened by `child_process` has anything in
  it, so all 448 came back `exited 1` — and the code threw the reason away, so
  the message that says exactly this was never seen. It takes the text as an
  argument instead; `translate` keeps stdin, which it reads normally. `execFile`
  passes an argv array and never involves a shell, so an argument is safe
  against quoting, but not against option parsing, and `trn` has no `--`
  separator: a lede starting with a dash gets one leading space, which stops
  the parse and which the translator ignores.

  **134 translations were refused for renaming the place**, which is the guard
  working rather than failing: "Oude Lutherse Kerk" came back as "Old Lutheran
  Church", and a card whose body renames the thing the player is being asked to
  learn teaches the wrong name. Those features took the Wikidata description
  instead — true, English, and thin. The refusals cluster on names built from
  Dutch common nouns (kerk, kapel, synagoge, museum), which is the obvious
  place to improve next; see TODO 7.

  `check-translation.ts` used to assert the backlog was still there, because it
  measured the guard's coverage across the untranslated pile. It now asserts the
  opposite — that no more than 25 non-English ledes ship — so a refetch that
  reintroduces Dutch fails loudly, and it measures the guard over the cache it
  actually judged.

- **The pre-OSM track is deleted, and the suspicion about the car is retired.**
  `track.js` had been superseded by `road-network.js` since open-road mode
  landed, but the file kept loading on every page view. `this.track` is only
  ever assigned a `RoadNetwork`; the `Track` class was constructed nowhere and
  its name referenced nowhere; it defined nothing else. 186 lines and one
  `<script>` tag gone.

  `car.js` was on the same list of suspects and is **not** dead: `PlayerCar
  extends Car`, so it is the live base physics. Recorded because "looks
  superseded" was wrong once here and the next reader deserves the answer
  rather than the suspicion. The `Track` interface in `collaborators.ts` stays
  — it is structural, and what it now describes is `RoadNetwork`.

  Verified with the driving harness and the full Canal Recall e2e spec on
  desktop and iPhone.

- **Routes now prefer useful unfamiliar streets, within a hard detour cap.**
  The spaced-repetition store collapses its place-local street/canal reviews
  into a conservative per-city, per-name mastery prior: one success is still
  mostly new, three current successes are mastered, overdue knowledge is
  weakened rather than forgotten, and landmarks or another city never affect
  the route. Dijkstra adds at most 18% to a fully mastered edge. The ordinary
  shortest route is always computed too, and the learning route is discarded
  if its actual geometric length is more than 12% longer, so known streets can
  never become walls or send the player on an unbounded lesson.

  The destination HUD shows the expected percentage of physical, named-road
  distance below 50% mastery. A correct answer on one of those new streets gets
  a bounded 1.15× bonus whose feedback says exactly why; calm mode receives the
  same routing benefit and novelty readout without multiplier chatter. The
  policy is typed and tested independently of the browser, including the
  accept/reject boundary, city filtering, overdue reviews, and calm scoring.

- **Road-network decisions live in typed, tested modules.**
  `road-network.js` had accumulated three versions of routing: its original
  inline graph and Dijkstra, an optional typed implementation, and fallback
  branches that could silently put production on the untested one. It is now
  only the browser/canvas adapter. `roadSurface.ts` owns the spatial index,
  asphalt/curb bands, heading-aware road choice at crossings and connected
  same-name runs; `roadGraph.ts` owns topology, junction restoration and
  shortest paths. Both bundles are required at startup, so a missing build is
  loud rather than a behavioural downgrade.

  The heading rule matters pedagogically: just past a crossing, the nearest
  centreline is often the side street, even though the player drove straight
  through. Among geometrically plausible roads the aligned one now wins, with
  distance as the tie-breaker. Real-extract coverage pins split Grimburgwal and
  the most fragmented Amsterdam waterway, while the reachability audit still
  measures the junction-stitch improvement over vertex sharing alone.

- **The English pass prefers a local CLI translator, and refuses a translation
  that renames the place.**
  448 distinct Dutch ledes are still waiting, and the routes that could do them
  were an Ollama server or a Gemini key. `translate`
  (scriptingosx/translate-cli) and `trn` (hotchpotch/trn) are both thin
  wrappers over Apple's on-device Translation framework: local, free, no key,
  no running server, nothing leaving the machine. They are now auto-detected
  first, in that order, with `--translator=` to force one and `--ollama` kept
  working as it was so the Utrecht script is unaffected. Both need macOS 26 and
  the Dutch language pack, so the pass falls through to Ollama, then Gemini,
  then Wikidata descriptions, and says which it is doing.

  Neither CLI takes a prompt. Everything the LLM routes asked for in words —
  "keep proper nouns exactly as they are", "under 360 characters, ending at a
  sentence boundary" — had to become code, which is an improvement: it is now
  enforced on every route rather than requested on two, and it is testable
  without a translator installed, which matters because CI cannot run one.

  `trimToSentence` cuts at the last real sentence boundary that fits, with an
  abbreviation list so a lede is not cut at "genoemd naar St." and a word-cut
  fallback with an ellipsis when no boundary is usable. `droppedProperNames`
  refuses a translation that lost the feature's own name: a fluent "The Blue
  Bridge is a bascule bridge over the canal" teaches the wrong name for the
  Blauwbrug, which is worse than leaving the Dutch in place. It matches whole
  words, not substrings — "Kerk" appears inside "Oudekerksplein", so a
  substring test would score a translated Kerk → Church as preserved.

  The guard only fires where the feature's name appears in its own lede, which
  is 414 of the 448 (92%), pinned as a regression. The other 34 are spelling
  mismatches between the extract's name and the lede's — "Amsterdamschebrug"
  written "Amsterdamsebrug", "Hoge Sluis" written "Hogesluis" — where nothing
  is refused. That is the intended bias: a false refusal costs one translation,
  a false accept ships a wrong name.

- **The landmark card expands into a readable panel.**
  `measureLandmarkCard` cuts the body to two lines, or four with a photo, so
  the driving corridor stays visible — which is the right call for a card that
  appears while you are moving, and the wrong one when you actually want to
  read it. Clicking the card did nothing useful before: the click fell through
  the card to `_inspectBuildingAt`, which usually found nothing under it and so
  read as the card being dismissed.

  The card now records where it was drawn (`_landmarkCardBounds`, recomputed
  every frame and nulled the moment the card is not on screen, so a stale
  rectangle never swallows clicks over open map), the canvas `pointerup`
  handler claims a click inside it, and `_expandLandmarkNotice` fills a new
  `#landmark-panel` with the whole extract. It is a `.utility-panel` like help
  and settings, which is what makes it pause the controls and close on Esc for
  free, and it gives the Wikipedia link a real anchor rather than the `W` key
  that only a keyboard player could find.

  Two smaller decisions worth keeping. The card grows a green `+ MORE` badge,
  but only when the body was actually cut — a canvas card has no other way to
  say it can be clicked, and advertising a panel that holds nothing new would
  be a lie; `measureLandmarkCard` now returns `truncated` so that stays a
  measured fact rather than a guess. And the panel spells out `NL — NOT
  TRANSLATED YET` where the card shows a bare `NL` chip, because in the
  expanded view there is room to say why the text is Dutch.

  On testing: Chromium's iPhone emulation gives this page a 613×1044 layout
  viewport inside a 390×664 device viewport, so Playwright's input cannot reach
  a fixed overlay's lower half and canvas coordinates do not map to tappable
  points. Narrow-viewport coverage is done by resizing the desktop project
  instead, which is a true 390-wide layout. Worth knowing before writing
  another mobile spec against an overlay.

- **One canal is drawn as one line again, and the café directory is thinned.**
  A named waterway is stored as several OSM ways — Grimburgwal is one feature
  carrying three, laid exactly end to end — and each was handed to MapLibre as
  its own round-capped LineString, so the highlight showed seams and read as
  three canals. The old comment was right that concatenating fragments draws a
  giant diagonal chord across the map, so `stitchOverlayPaths` joins only
  fragments whose endpoints actually meet, within a metre of slack for the
  rounding two ways store the same node with; fragments that genuinely do not
  touch still come back as separate lines. Separately, the extract carries 1944
  named food venues and handed all of them to the map, so 78 competed for the
  Grimburgwal viewport and MapLibre drew whichever dozen won its collision
  pass — an arbitrary set the rider cannot orient by. `thinOrientationPois`
  keeps the best-scoring cue per 260 m of ground, which leaves eight on that
  screen. Albert Heijn is exempt: it is wayfinding, not decoration.

- **The two games are two sites now, not two entry points on one.** Canal
  Recall and Map Quest were one GitHub Pages deploy under `/map-recall2/`, which
  caps at a single custom domain and cannot tell hosts apart. They are now two
  Firebase Hosting sites in `map-recall2-blackmad`: `edumap-blackmad` serves the
  Map Quest build, `canalrecall-blackmad` serves Canal Recall at its own root.
  Serving Canal Recall from a root could not be done with a Hosting rewrite —
  its `index.html` loads `js/game.js` relatively, and a `**` rewrite answered
  `/js/game.js` with HTML at status 200, which the browser refuses to execute.
  So `scripts/assemble-canalrecall-site.mjs` hoists `dist/canal-drive` to a
  root with `data/` beside it, which is what its `../data/extracts/...` fetches
  already expect. Hosting `ignore` globs turned out to be relative to `public`,
  not the project root, and Hosting serves a matching static file before it
  consults a rewrite — together those two facts had the Map Quest `index.html`
  winning `/` on the Canal Recall site. `**/*.md` is ignored on both sites
  because `TODO.md`, `WIP.md` and `HISTORY.md` live inside `public/canal-drive`
  and were being served as public pages.

- **The extractor takes a city now, and Utrecht proved it.** Bounds, centre,
  curation file, the name used for the boundary lookup and the `cityId` filed
  into every review key were all Amsterdam constants. They are arguments now,
  the curation file is optional, and a municipality mapped as a Polygon rather
  than a MultiPolygon no longer throws. `refresh-amsterdam-extract.sh` is one
  `exec` into the general script, so Amsterdam cannot quietly drift onto a
  private path.

  The second city found two real bugs. Connectivity was measured by endpoint
  proximity within ~33 m, which joined parallel roads and roads on different
  levels for passing near each other, and missed every junction in the middle
  of a through-way because it only looked at the two ends — the same mistake
  the runtime graph had already been fixed for. It now joins ways sharing an
  exact vertex, indexed over all of them. And a long way could enter the
  municipality with its midpoint outside it, publishing a centre that pointed
  into a neighbouring city; the centre is now the first vertex actually inside
  the boundary.

  Chain shops are extracted but kept out of the landmark competition, because
  they are orientation cues and not quiz destinations. Identity comes from NSI
  `brand`/`operator` and `brand:wikidata`, never `name` — unrelated
  independents share generic names like "Supermarket". Three locations inside
  this municipality is the bar, which is what makes the list locally
  meaningful rather than a directory: Amsterdam 973 across 130 chains, Utrecht
  292 across 53. On the map they are separate layers that start at zoom 15.5,
  never overlap, and fall back to a plain dot rather than a wrong logo.

  Enrichment shares one cached fetch instead of three near-identical
  retry/throttle loops, so a re-run is free and a transient Wikimedia failure
  stopped being expensive. Translation can run against a local Ollama model,
  which removes the Gemini key from the path to English ledes.

- **The driving harness measures rates, not counts.** It was recorded as flaky
  — "14 of 24 against a threshold of exactly 14, run-to-run variation flips it
  red". That diagnosis was wrong. Pinning the routing extract and running it
  three times gives byte-identical reports: same arrivals, same wedge count,
  same component share. The harness is deterministic; it seeds its own
  generator and stubs `Math.random` at page load.

  What was actually brittle is that both bounds were absolute counts calibrated
  against a 24-drive sample and then sat at the measured value with no room.
  They are rates now, and the sample is 120 drives, which costs about seven
  seconds. Measured on the 29,051-way extract: 71 of 120 arrive (59%), 1.6
  wedges per drive, against 6.3 per drive before the kerb guard learned to
  slide. The floors are 45% and 3.0.

  One thing worth knowing before trusting this harness with coverage: a
  *sparser* network scores **higher**. Run against a half-sized extract it
  reported 71% arrivals rather than 59%, because short simple routes are easier
  to drive. It measures whether the city is drivable and says nothing about
  whether it is still fully mapped — `test:canal-car`'s named streets are what
  pin coverage, and they are what caught the halving.

- **The presentation subsystem is typed, and what the game rewards is tested.**
  `game-presentation.js` was the last big untyped file: 872 lines that both
  decided the grade and painted it. The grading is now `routeRibbon.ts` and the
  collection is `progressStore.ts`, together under 21 assertions that state the
  product position outright — speed is not an input, the recall gate sits above
  the blended score so a spotless silent run cannot buy a ribbon, every aid you
  leaned on costs self-reliance, typing buys some of it back, and an axis that
  cannot be measured is dropped rather than scored zero.

  Persistence stopped reaching for `localStorage` and takes an injected store,
  so eviction and merging are testable: personal bests evict oldest-first,
  waterways and streets are collected apart, driving the same street twice
  counts once, and a stored collection missing a newer field is topped up
  rather than blanked.

  Typing it immediately found a live bug. The menu's returning-player badge
  referenced an undefined `cx` inside a `try/catch` that swallowed the
  `ReferenceError`, so it threw on every menu frame and the badge has never
  drawn for anyone. It draws now, and the Playwright check asserts *where* it
  lands rather than merely that the call happened — passing an undefined
  coordinate is what the bug looked like once its error was caught.

- **The minimap is a city overview.** It drew about 450 m of network centred on
  the vehicle, with canals and streets as the same thin white line — and at that
  scale every part of Amsterdam looks like every other part, which is the
  opposite of what a geography game's map is for. It is 260×200 now and framed
  on the whole city, drawn from the neighborhood boundaries already loaded for
  the postcards, so recognising where you are costs no extra fetch. The loaded
  network, the planned route, both endpoints and a heading cone sit on top.

  The framing follows the city rather than the trip, so the same place lands in
  the same spot on every route — that is what lets the map become something the
  player knows instead of something they re-read. Scale is uniform: a stretched
  Amsterdam is not Amsterdam, and the canal ring is only recognisable while it
  is still round. Static layers are thinned to the drawn resolution and cached
  per route; only the vehicle is redrawn per frame.

  It draws no names, deliberately. A labelled overview would reveal the street
  or canal under question before it had been answered.

  The aid cost is unchanged at 0.25. The map got considerably more useful, but
  re-tuning self-reliance scoring in the same change would make it impossible to
  tell which change moved the ribbons.

- **The boat could not fit through Amsterdam's locks.** Reported from play:
  stuck in the Stadionsluis. The routing graph was innocent — the lock shares
  *exact* vertices with Stadiongracht at both ends, so the router plans straight
  through, and the visible gap in the water is the CARTO basemap not drawing
  under the lock structure. What pinned the boat was the hull corridor.

  Bridge decks and lock structures are rendered above the water fill, so the
  basemap reports dry land exactly where a boat must pass, and every hull point
  fell back to a distance-from-centreline test of `min(width * 0.28, 13)` px =
  8.96 px on a canal. The boat's own half-beam is 8.16 px. A perfectly centred,
  perfectly aligned boat had **0.80 px of margin**, so any real steering pinned
  it — 180 of 270 plausible poses through the Stadionsluis were blocked.

  Two things were wrong. The tolerance ignored the beam of the vessel the game
  asks you to steer; it is now anchored to the way's own mapped half-width with
  a floor that guarantees the hull fits. And it demanded *every* hull point sit
  near a centreline, which is simply wrong where a lock is shorter than the
  boat: bow and stern overhang the ends of the lock's geometry, land past the
  last vertex, and measure a full half-length away from it. The fallback now
  tests the boat's centre, which is the real evidence of being on the channel
  and still cannot authorize roaming onto a quay.

  `test:boat-navigability` drives a boat along real extract geometry through
  every named lock in the city, at nine steering poses per step, with the
  basemap reporting dry land throughout — the actual case at a lock. It found
  fifteen more stranding locks beyond the reported one. A sentinel keeps the old
  rule written out and asserts it still fails, so the suite cannot quietly stop
  testing anything.

- **A POI card is held by proximity, marked on the map, and only shown when it
  has something to say.** Three reported problems with the same root: the card
  was one countdown serving three different intentions.

  It is now held by *why* it opened. A drive-by card stays while the player is
  still within 480 px of the landmark — six seconds expired while they were
  still approaching it — with a minimum dwell so passing at speed still leaves
  something readable, and an exit radius wider than the 300 px that opens it so
  driving the boundary does not flicker it. A clicked card stays timed, because
  a click can land on something far away or on a footprint with no position at
  all. The arrival card is `sticky` instead of `timer = 3600`.

  The locator dot now survives detailed mode. The 3D highlight raycasts straight
  down at the landmark and finds nothing whenever the place is not its own
  extruded building — a theatre inside a block, anything outside the loaded
  tiles — and the dot was suppressed there, so a card could name a landmark with
  nothing on the map pointing at it. The anti-slab rule it was protecting is
  intact and now pinned precisely: a locator *point*, never an extrusion
  fabricated from an approximate OSM footprint.

  Landmarks with nothing but a name are no longer offered while driving. The
  extract carries far more places than it carries writing about them: 101 of 374
  placed landmarks have no text, no photograph and no article, and a card
  reading "A landmark in Prinses Irenebuurt e.o.. No encyclopedia article yet."
  interrupts the driving corridor to teach nothing. This is why the reported
  card said "Thomastheater" — a bare duplicate entry — while "Thomaskerk", the
  same building with an English extract and a photograph, is the one now shown.
  Clicking an unenriched building still answers; only the unprompted card is
  suppressed.

- **The recall subsystem is typed, and the rules that decide what you are asked
  are tested.** `game-recall.js` became `recallRules.ts` plus
  `recallRuntime.ts`. The rules half now answers, in 22 assertions and without a
  DOM, the questions that previously required driving a boat at a bridge to
  observe: that a car crossing a deck is caught by a midpoint gate while a boat
  is caught by the centreline, that sitting at the kerb aligned with a bridge is
  not a crossing, that a crossing teaches the water before the deck, that
  Raampoort is not asked twice for being both a street and a bridge, and that
  world/lat-lon conversion round-trips — which is what keeps a recall answer
  filed at the place it was actually given.

  The mode strings became unions. `travelMode`, `answerMode`, `viewMode`,
  `themeMode`, `controlMode`, `routeDifficulty`, `routePattern` and the two quiz
  kinds were all bare `string`, which is how `'boat'` could be compared against a
  typo forever without anything noticing. `modes.ts` holds the value lists, and
  they are the same lists as the `<option value>` sets in `index.html` — if the
  page and the unions disagree, a preference silently stops applying, so they
  are written down once.

  `recallStoreBrowser.ts` declared its own global as `unknown`. It now publishes
  a precise type derived from what it actually exports, so consumers are checked
  against the real store instead of a hand-written parallel interface that could
  drift from it.

- **The landmark subsystem is typed, and its rules are tested without a
  canvas.** `game-landmarks.js` became `src/canalRecall/game/`, split along the
  line that matters: `landmarkData.ts` decides *what* the player is told —
  which building a click names, which bridges are worth a question, which
  postcard borrows which photograph — and `landmarkRuntime.ts` does clicks,
  timers, fetches, images and canvas. Only the second half needs a browser, so
  the first half is now covered by 12 direct assertions instead of by driving.

  Two methods stopped being methods. `_englishTitle` and
  `_matchLandmarkToBuilding` were on `Game.prototype` but called only from
  within this subsystem, so they are plain functions; the decomposition check
  confirmed nothing else on the page reached for them. `_pointInPolygon` had no
  callers left at all and was dropped rather than translated.

  The subsystem ships as a generated `game-landmarks.bundle.js`, which
  introduces a failure the hand-written files could not have: a page running
  something other than the reviewed source. `test:canal-game-structure` now
  rebuilds each generated subsystem and compares bytes, so a stale bundle is a
  red check rather than a confusing bug.

  One latent bug was fixed rather than translated: a bridge with geometry but
  no centre threw inside the whole-extract map, and the surrounding `catch` set
  `landmarks = []` — so a single malformed bridge silently cost the player
  every landmark in the city. That bridge is now skipped, and the case is a
  named test.

  The Amsterdam-extract assertions are deliberately invariants rather than
  counts. The extract is regenerated by a pipeline this work does not own, and
  a refresh that legitimately changes how many landmarks Amsterdam has must not
  turn the check red. Measured on 2026-08-30 for context: 420 features → 374
  placed landmarks, 90 neighborhoods (12 borrowing a parent photograph), 300 →
  248 nameable bridges.

- **`game.js` is an orchestrator instead of the application.** The partial
  answer-path and notice-card extractions did not finish the original job: the
  `Game` class was still 3,258 lines and owned route setup, recall, landmarks,
  every major renderer and persistence. Those method bodies now live in four
  explicit runtime subsystems (`game-route`, `game-recall`, `game-landmarks`
  and `game-presentation`); `game.js` is 658 lines of construction, camera and
  frame/movement orchestration. The split preserves one game-state boundary,
  so it does not introduce duplicate stores or event loops merely to make the
  files smaller.

  `test:canal-game-structure` checks script order, unique method ownership,
  installation on `Game`, one startup callback and an 800-line ceiling for the
  core. That makes the decomposition an enforced architecture rather than a
  one-time file shuffle.

- **The driving harness measures progress along the drive.** Its 25-second
  "lost" timer claimed to measure progress along the planned route, but used
  straight-line distance to the destination. A correct Amsterdam route often
  has to head away from its endpoint to get around a canal, railway, or one-way
  block, so the harness stopped twelve drives early and called the test driver
  lost. The timer now uses the remaining length of the route polyline. The
  arrival threshold remains 14/24; the test oracle was repaired instead of
  lowering its expectation or changing the production router.

- **Unnamed building clicks answer back.** Clicking an anonymous vector-tile
  footprint now opens a short "No building details" acknowledgement explaining
  that the map data has no name. It does not invent an "Unnamed building" or
  present the footprint as encyclopedia content. The browser check that used to
  require silence now pins the acknowledgement and its wording.

- **The answer path is a typed leaf now.** `_submitCanalAnswer` still owns the
  canvas prompt and bridge-crossing handoff, but answer normalization, scoring,
  streaks, feedback, name reveal and the recall write live in
  `src/canalRecall/answerPath.ts`. The recall store is injected through a small
  interface, so this behavior no longer requires constructing the 3,000-line
  canvas game to exercise it.

  `test:canal-answer-path` pins the reason for the extraction: "No idea" leaves
  attempts and correct answers unchanged, resets the streak, reveals the name,
  records a miss through the injected store, and that miss receives the real
  scheduler's `again` rating. The module ships as a 1.6 KB IIFE beside the other
  typed Canal Recall leaves and is built by both the main build and canal check.

- **Boat mode is a canal sloop.** The first boat was a licensed Sketchfab motor
  yacht; it is an aluminium sloop generated with Meshy AI now, which is both more
  Amsterdam and far cheaper: **2.85 MB → 0.24 MB**, 158,256 → 23,734 triangles,
  against the yacht's 1.82 MB. It arrives as raw geometry — no normals, no
  materials, no textures — so glTF's flat-shading rule would have made a smooth
  hull look faceted and every mesh default white. Normals are computed and an
  aluminium material applied on load, which is cheaper than shipping normals:
  they would have added about 40% to the file for something the GPU can derive.

  Its bow is on −X, where the motor yacht's was on +X, so the heading offset had
  to flip. Nobody would catch that by looking — a boat sailing stern-first reads
  as very nearly right in a still — which is exactly why `boat-model.spec.ts`
  pins the offset. The bow was confirmed from the hull's own beam profile rather
  than by reading an axes helper: the half-beam tapers to 0.20 at −X and holds
  0.37 at +X, which is a bow and a transom.

  The bicycle and the boat share one custom-layer scaffold (`Vehicle3D` in
  `player-vehicles-source.js`): load a GLB, ground it, draw it in world space
  with the map's pitch and bearing. They differ only in the model, which way its
  nose points, and what moves. A hull has no steering geometry to turn, so its
  turn shows in the whole boat: it heels into a held lock and rights itself
  slowly, which the same test pins.

- **The bicycle steers and its wheels roll.** The asset was authored mid-turn,
  so the front wheel sat visibly cocked against the frame and never moved. The
  fix was not to zero it but to give it something to do. `Lenker` carries the
  whole front assembly — fork, wheel, bars — so steering is that node's
  rotation, and both wheels are discs whose thin local axis is Y, so rolling is
  a spin about their own Y. Both axes were measured off the source GLB rather
  than assumed. Steering eases toward the held direction so the bars settle
  instead of snapping, and the wheels roll by distance travelled, so they stop
  when the bike stops.

  A screenshot is a bad oracle here — the bike is usually behind a building, and
  at chase altitude it is a dozen pixels — so `bike-steering.spec.ts` measures
  the pose off the scene graph instead: the front axle swings 23.1° each way
  (46.2° lock to lock, a little under the nominal 24.1° because the head tube is
  tilted), the rear wheel moves 0.0°, and 400 px of travel rolls the front wheel
  133°. Steering that moved the whole bike, or a wheel that rolled by frame
  count, would fail it.

- **"No idea" is a real answer now.** A four-option question is guessable one
  time in four, and a lucky guess was indistinguishable from knowledge: it
  recorded a correct answer, which set a one-day review interval, flipped
  `isKnownHere` to true, stopped the street being asked about, and wrote its
  name on the map. The player who guessed right learned nothing and lost the
  street from their review queue.

  The fix has to survive a rational player, so honesty is strictly better than
  guessing rather than merely permitted. "No idea — tell me" (`0`) is not an
  attempt: it costs no accuracy, because nothing was answered. It resets the
  streak, reveals the name, and records the round as wrong so the scheduler
  rates it `again` and brings the name back in ten minutes. Guessing wrong
  costs accuracy *and* the streak; guessing right when you did not know
  quietly poisons the schedule. So the button is the play whenever the honest
  answer is that you do not know.

  Not yet covered by a regression test — the behaviour is a contract worth
  pinning (no attempt recorded, `again` scheduling) and the answer path lives
  in untyped `game.js`, so it wants the typed extraction first.

- **The learned-street highlight is gone.** Mastered streets were painted
  yellow over the basemap, but the Liberty basemap already draws its whole road
  network in yellow, so the overlay read as a second arbitrary highlight rather
  than as knowledge — and with every road yellow, "highlighted" stopped meaning
  anything. Mastered streets still announce themselves the way that actually
  teaches: by staying *named* on the map. Only the street currently under
  question keeps a drawn highlight.

- **Bridge options are the bridges around you now.** Every bridge in the
  extract offered the same four names. `build-amsterdam-extract.ts` filled
  `distractors` with `alternatives.slice(0, 12)` from a list sorted by
  prominence, so all 300 bridges — and, with the same line, every street,
  water, square, park and landmark — drew from the twelve highest-scoring
  features in the city. Measured: 13 distinct names across 300 bridges.
  Crossing the Prinsengracht you were offered Zeeburgerbrug, Nesciobrug,
  IJburglaan and the Berlagebrug, none of them within four kilometres, so the
  answer was the only plausible option on the list. It tested which name sounds
  central, not where you were.

  Distractors are the nearest features now, and for bridges the crossings
  extract also knows the water, so up to three of the four come from the same
  waterway — the Magere Brug is now confusable with the Blauwbrug, the Hoge
  Sluis and the Torontobrug, which is the actual piece of local knowledge. The
  generator is fixed for every category; `npm run build:bridge-distractors`
  re-derives the bridge half from the cached extracts with no Overpass round
  trip, stages, reports the diff, and publishes on `--publish`. Bridges: 13 →
  253 distinct options, median option distance 5,682 m → 437 m, 155 of 193
  bridges over identified water get a same-water option.
  `npm run test:bridge-distractors` pins the pool size, the median distance,
  the Amstel and canal-ring cases, and that the published extract still equals
  a recomputation.

- **The bottom HUD has one layout authority.** The trip readout, neighborhood
  postcard and landmark trivia card now use the pure typed `bottomHudLayout`
  module instead of unrelated offsets. The postcard clears the trip readout,
  and simultaneous trivia shifts 24 px sideways instead of being thrown 194 px
  up the screen by the obsolete 180 px postcard allowance. Zoom and controls
  hints are placed by the same pass, clearing their former overlap with trivia
  and with one another. A 288-scenario check pins every supported trivia
  height, trip width, postcard, minimap, zoom and controls combination.
- **A landmark with no article still says something.** 124 of the 420
  landmarks have no encyclopedia text — mostly OBA branch libraries and
  neighborhood cinemas, which nobody has written an article about — and their
  card was a badge, a name and a blank strip, which read as a rendering
  failure. The body now falls back to what the game does know: "A library in
  Bos en Lommer. No encyclopedia article yet." For a game about where things
  are, the kind and the neighborhood are worth reading.

- **One theme, two surfaces.** The stylesheet had the ink theme and then, below
  it, a paper "map sheet" redesign that re-declared the *same unscoped
  selectors* to override it — `.setup-field`, `.master-toggle`,
  `.assist-options`, `.account-button`, `.advanced-options`, `#route-start`.
  Every one of those is also used by the live settings panel, which is still
  dark, so the paper colours repainted it: its selects were `#172326` on
  `#071e2b` and could not be read at all. There is now one token set on
  `:root` for the in-game chrome and a scoped override on `#route-setup` for
  the paper sheet; components consume tokens, and the only rules the sheet
  keeps of its own are the genuine differences in form (ruled underlines
  instead of inset boxes, a three-column preference grid). The leak is
  structurally impossible now rather than something to keep noticing.
- **The recall prompt says what kind of answer it wants.** "Crossing a bridge"
  as the headline over a smaller "Which water are you crossing?" read as a
  question about the bridge. The question is the headline now, the situation is
  its caption, and a coloured chip above both names the kind of feature the
  answer is. Water and street use Lucide SVGs and bridge uses Font Awesome
  Free, so the distinction is visual without depending on platform emoji. The
  text input's placeholder and aria-label follow the same subject.

- **Street mode has a real 3D bicycle, and the asset pays its way.** Chase and
  near-first-person views use a locally shipped Carbon Frame Bike GLB in a
  MapLibre custom 3D layer, with world-space depth, pitch and route-relative
  heading. Baked shadow presentation quads are stripped on load, and the piece
  is intentionally enlarged at chase altitude. The old canvas bicycle remains
  only as a loading fallback and is no longer painted over a ready mesh.

  The capsule-and-sphere 3D rider is gone. At game scale it read as a
  mannequin — a sphere head on tube limbs — and it made the vehicle look worse,
  not more readable; the bicycle's own silhouette carries the facing.

  The model shipped as 8.57 MB, which is most of the way to `streets-routing.json`
  for one bicycle. It was 100% geometry, no textures: an interleaved vertex
  buffer carrying TANGENT and TEXCOORD_0 for a model with zero images, plus
  four skins and a 356-channel `Holobike_Loop` animation nothing plays. Dropping
  what the game cannot use, then welding, simplifying and quantizing, gives
  **8.57 MB → 2.01 MB** (115,083 → 73,921 triangles) with `KHR_mesh_quantization`,
  which three's `GLTFLoader` reads natively — no Draco or meshopt decoder is
  needed at runtime.
- **The first street encyclopedia card is live.** Answering or revealing Nes
  can show a compact English fact card, and `W` opens its Wikipedia article.
  The runtime uses a normalized street-name join and suppresses the card during
  an active quiz; the browser regression pins both the card and article URL.
- **Wikidata-only landmarks recover their articles.** Wikipedia enrichment now
  discovers Dutch and English sitelinks from a Wikidata id when OSM omitted the
  `wikipedia` tag. That recovered 34 article links, including Fatih Mosque; a
  keyless enrichment run uses the English Wikidata description as an honest
  floor rather than leaving the card empty.
- **The typed road graph is now the live router.** `road-network.js` delegates
  graph construction, shortest paths, destination routing and first-reachable
  routing to the bundled `src/canalRecall/routing/roadGraph.ts` API. Its legacy
  implementation remains as a load-failure fallback; the typed and live
  reachability checks are both part of the normal verification path.

- **Civic venues are POIs now, and the extract was refreshed to get them.**
  `classify()` took `tourism=*`, `historic=*` and `amenity` in {theatre,
  arts_centre, townhall, place_of_worship}, so the everyday places a resident
  actually navigates by were in no extract at all — LAB111 (`amenity=cinema`,
  Arie Biemondstraat 111) among them. Cinema, library, university, college and
  music_venue are now their own feature types, so the card badge reads CINEMA
  or LIBRARY rather than LANDMARK. They needed a scoring answer as well as a
  filter: a node with no Wikidata link scores 12 against a landmark tail that
  starts at 35, so `CIVIC_CLASS_SCORE` gives each class a floor, and the
  landmark budget went from 300 to 420 so the new classes are additive instead
  of evicting 126 existing landmarks. Landmarks: 300 → 420 (34 universities,
  40 libraries, 21 cinemas, 2 music venues, 6 dropped). Markets were already
  covered — `amenity=marketplace` classifies as a square, and all 21 named
  Amsterdam markets are in `squares.json`. A civic venue needs a name of three
  characters or more; OSM has a university building called "P".
- **The routing extract was silently missing 12,500 ways.**
  `selectConnectedStreets` BFS'd from index 0 on the comment "available is
  sorted by score desc, so index 0 is highest" — but every routing candidate
  scores 0, so among them there was no ordering at all, and the seed was
  whichever way the sort happened to leave first. It landed in a component of
  16,551 when the largest was 29,051; a refresh that reshuffled the ties
  collapsed the whole extract to 7 ways, which is how this was found. It takes
  the largest component now. Measured on the live stitched graph: 442 → 344
  components, largest 75.3% → 78.2%.
- **The server compresses responses.** Nothing did, so
  `streets-routing.json` went over the wire as 9.7 MB of raw JSON on every
  route. With `compression()` it is 1.32 MB — and the pre-refresh extract was
  5.8 MB raw, so the bigger, more connected graph is a net win on the wire too.

- **Knowledge is local now: per-crossing bridges, per-stretch streets.** Recall
  used to be keyed by name alone, so one right answer retired a whole feature.
  Two things were wrong with that. A bridge feature is a *name*, not a place:
  OSM ships "IJburglaan" as 66 spans making five separate bridges kilometres
  apart, and "Zuiderzeeweg" as four bridges over three different waters, all
  answered by one question. And a street that runs for kilometres is familiar
  in one neighborhood and unknown in another, so one junction should not mark
  the whole name learned.

  Identity is now the name *and the place it was answered*, snapped to a 300 m
  grid in lat/lon (`src/canalRecall/recallChunks.ts`) — world pixels could not
  be used, because the network origin is recomputed per race from the loaded
  bounds. Reading it back is a 600 m radius query rather than a cell lookup, so
  a grid edge never causes a second question a few metres later. Map labels
  follow the same rule: `drawLabels` takes a per-label predicate instead of a
  name set, because writing a known name along the whole street would hand over
  the answer to the end that has never been asked.

  Bridges are resolved offline into the physical crossings they are made of.
  `npm run build:bridge-crossings` clusters spans within 70 m, works out the
  waterway each crossing passes over, and picks four nearby waterways as
  distractors; it stages, reports coverage and diffs, and publishes on
  `--publish`. 257 named bridges become 318 crossings, 203 of them (63.8%) over
  an identified waterway — the rest are mostly bridges over water the 300-feature
  water extract does not name, and they fall back to today's behavior.

  A crossing over known water asks which bridge it is. A crossing over water the
  player has *not* proved they know asks for the water first, and holds the
  bridge back until that is answered right — per crossing, because the Amstel at
  the Magere Brug and the Amstel at the Berlagebrug are two pieces of local
  knowledge. A wrong answer parks the question for ten minutes without ever
  counting as knowing it, which is the distinction the gate turns on
  (`isSuppressedNear` vs `isKnownNear`). Street mode never asked about water at
  all before this; now the canal is what a bridge teaches first. By boat the
  route quiz already owns the waterway, so the bridge simply waits for it.

  `npm run test:bridge-crossings` pins Magere Brug/Blauwbrug/Hoge
  Sluis/Berlagebrug over the Amstel, Torensluis over the Singel, Zuiderzeeweg's
  four crossings and IJburglaan's five, and asserts a recomputation still equals
  the published extract. `tests/e2e/crossing-quiz.spec.ts` drives the real span
  geometry and checks the water-then-bridge order, that a wrong water answer
  does not unlock the bridge, and that a long street answered at one end is
  still asked — and still unlabelled — at the other.

- **The arrival card, rebuilt.** The finish screen had six accent colours, six
  differently styled boxes, two typefaces used interchangeably, and a 38 px
  stopwatch as its headline — for a game that deliberately does not score
  speed. It is now one surface: the destination and its photo as the hero, a
  single stat row (recall, accuracy, points, time, distance) under a hairline,
  then the ribbon, the city-knowledge line and keycap actions. The arrival
  blurb wrapped to a single line and stopped mid-sentence with no ellipsis;
  `wrapText` in `utils.js` now wraps to the available box and elides honestly.
  The card measures itself from a list of self-sizing blocks, so the height and
  the draw order cannot drift apart the way the old hand-tuned offsets did.
  `FinishCard` and `FinishCardCalmMode` stories pin both layouts.
- **Landmark photos, for every landmark that has one.** Images were preloaded
  for the 50 most prominent landmarks in the city and nowhere else, so 180 of
  the 229 landmarks with a Wikipedia photo could never show it — DeLaMar ranks
  89th and its card came up bare. Photos are now fetched on approach, inside
  `LANDMARK_IMAGE_PREFETCH_RADIUS` (900 px, ~300 m), which is far enough ahead
  that the card opens with the photo already in place instead of reflowing
  under the player. It also stops spending bandwidth on the Rijksmuseum for a
  route that never goes near it.
- **Mastered streets stay named on the map.** A street answered well enough
  that the spaced-repetition store stops asking about it was only labelled once
  the player happened to drive onto it, because the label set was filled in by
  the quiz. `_refreshMasteredLabels` seeds the map labels from the store at
  race start, when it finishes loading, and when the review toggle changes, so
  a name you already know is visible across the whole visible map.
- **Readable assist toggles on the setup card.** Route line / destination arrow
  / minimap / reduced motion / detailed 3D / sound inherited the live settings
  panel's pale blue on the paper setup card, which was very nearly invisible.

- **The encyclopedia text is English everywhere but one blurb.**
  `enrich-amsterdam-wikipedia-extracts.ts` takes the English article wherever
  one exists, through the Wikidata `enwiki` sitelink and then the Dutch
  article's interwiki link. That left 403 features English Wikipedia has never
  written about — 121 landmarks and 282 bridges — showing a Dutch lede under an
  NL chip. Wikidata's English descriptions were measured as a substitute and
  rejected: 137 of the first 150 have one, and they read "bascule bridge in
  Amsterdam, Netherlands", which is English but teaches nothing. All 403 were
  translated instead, keeping the year built, the namesake, and what the bridge
  replaced. `npm run enrich:english` now reads those reviewed translations from
  `scripts/english-translations.json`, keyed by a hash of the exact source text
  so a refreshed extract invalidates a stale entry and reports it rather than
  silently keeping it; a run with `GEMINI_API_KEY` set translates whatever the
  cache is missing and writes it back, so a translation is paid for once and
  then reviewed in a diff. Wikidata's description survives only as a floor for
  a keyless run on new text. Every blurb carries
  `wikipediaExtractSource: "translated"` with the Dutch original and its
  language kept alongside, so the pass stays resumable and the runtime's NL
  chip no longer appears. After the civic-POI refresh the counts are 403
  translated, 345 already English and 9 Wikidata descriptions; one landmark,
  Amstel Academie, has a Dutch lede and no English Wikidata description and is
  waiting for a keyed run.
- **Truthful postcard imagery expansion.** Neighborhood enrichment now covers
  OSM neighborhoods, quarters, and suburbs, deduplicates repeated boundaries,
  and rejects substring matches that confused places such as Westindische
  Buurt/Indische Buurt and Weesp/Weesperbuurt. The accepted extract has 85
  unique areas, 48 encyclopedia extracts, and 46 dedicated images; finer areas
  can still borrow a containing district's image at runtime.
- **Deterministic Storybook builds.** Vite no longer races Storybook to copy
  `public/` into the same output directory; `npm run build-storybook` completes
  consistently while retaining the real map assets used by iframe stories.
- **First `game.js` collaboration seam.** Neighborhood boundary hysteresis is
  now a pure typed state machine in `src/canalRecall/neighborhoodState.ts`, with
  deterministic checks and a small browser bundle. Postcard/data work can
  evolve there without editing the central game loop's transition logic.
- **Storybook visual workbench.** Storybook 10 with the React/Vite framework
  now serves the real Canal Recall route setup in deterministic default,
  bike-from-home, advanced, and mobile stories. `npm run storybook` is for live
  review; `npm run build-storybook` pins whether the fixtures compile.

- **Roundabout drivability.** At Van Limburg Stirumstraat / De Wittenkade,
  equidistant centerline stubs could make collision recovery flip between road
  tangents and steer away from the intended exit. Vehicle contact now prefers
  the nearby tangent aligned with the bike's heading; the named junction arms
  are pinned in `npm run test:canal-car`.
- **Calmer map and neighborhood transitions.** Nearby fragments of the same
  learned street no longer stack duplicate labels. Learned names use subtle
  basemap-style halo text instead of black capsules and are suppressed near the
  rider. Neighborhood changes must
  remain stable for 0.7 seconds before the HUD and entry card adopt them, which
  filters overlap jitter at shared polygon edges.
- **Start screen and HUD redesign.** The route setup is now a clear navigation
  briefing with grouped route and learning choices, quieter advanced settings,
  and a mobile-first start action. The in-game readouts use one compact visual
  system for recall, location, destination, speed, and distance instead of a
  collection of unrelated dark boxes.
- **Arrival teaches the destination.** The finish card now identifies the POI,
  shows its image when cached, includes a concise encyclopedia detail, and
  keeps `W` available for opening its Wikipedia article alongside route stats.
- **Amsterdam travels by bike.** Street mode now presents itself as cycling and
  uses a readable top-down omafiets player marker while retaining the proven
  street-routing and shoulder-response physics.
- **Postcard image fallback.** Fine quarters without their own enriched photo
  borrow the containing district's Wikimedia image. The old oversized
  travel-poster card is now a compact photo lower-third that leaves the driving
  corridor visible while dedicated neighborhood coverage grows.
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
  under question withheld so the map cannot answer for the player. A name
  already revealed re-arms after 0.3 s rather than 0.65 s, so driving back onto
  a street you have just learned gives you a quick re-test.
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

## Foundations

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

- Integrate optional detailed 3D building data with OSM extrusions as a dependable fallback.

### Superseded, but the reasoning still explains the design

- Landmark images were preloaded for the 50 most prominent landmarks at route
  start. They are fetched on approach now, inside
  `LANDMARK_IMAGE_PREFETCH_RADIUS`.
- Learned labels were session-only. Recall is persistent and location-scoped now.
- Bridge distractors were described above as "real neighbouring bridges". They
  were not: all 300 bridges drew from the same 13 names until the
  nearest-and-same-water pass replaced them.
- The landmark extract held 300 features, 236 with Wikipedia URLs. It holds 420
  since civic venues were added.

## Design notes for parked bets

Notes for work deliberately *not* queued — see `TODO.md` P3. Kept because the
thinking is worth more than re-deriving it.

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
