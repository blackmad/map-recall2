# Canal Recall — what is left

The work board. Everything finished lives in `HISTORY.md`; this file is only
things that are not done. Keep it current in the same change that moves an
item, not afterwards.

Ordered by one rule: **a learning game that teaches the wrong thing is broken
in a way that a plain-looking one is not.** So correctness of what the game
teaches outranks the depth of what it teaches, which outranks how it looks.
Within a tier, cheap-and-blocking comes before expensive-and-isolated.

---

## P0 — Red, or actively teaching something false

*Empty. Keep it that way: anything that makes the game teach something false
belongs here before anything below it.*

---

## P1 — The learning model itself

**16. Expand the reviewed local-fact catalog.** Version 6 now does real local
summarization over cached Wikipedia sections: a writer produces a concise fact
and cites numbered source sentences, code copies the exact evidence, and a
separate temperature-zero local pass checks full entailment. Deterministic
number/date, standalone-card, staleness and provenance gates remain, followed
by human review. The corrected v6 smoke run produced 18 grounded summaries for
all 3 sampled Amsterdam features, rejected three dangling references, and had
the verifier catch one unsupported embellishment. Citation-marker noise and
possessive apostrophes are cleaned deterministically. Regenerate all four
Randstad staging catalogs, measure yield and verifier rejections, then review a
stratified sample before publishing. Dutch articles now go through local
`trn --quality high` sentence translation before English summarization and
entailment; they retain aligned Dutch and English evidence and must be measured
separately in that review.

Bulk inference can now use OpenRouter while `trn` remains local. A measured
three-bridge Qwen 3.5 Flash smoke run produced 5 grounded facts in 5.6 seconds,
rejected 7 unsupported/context-dependent candidates, and cost $0.0005. Run the
full Randstad batch with provider/model recorded in the generator version; do
not reuse the old human approvals across that provider change.

Rejections are now durable staging artifacts rather than truncated console
samples. Use `fact-rejections.md` during the Randstad review to separate useful
standalone-card rewrites from genuine entailment failures; never weaken a gate
based only on aggregate rejection counts.

The Trivia Lab at `/canal-drive/trivia-review.html` now makes the full review
queue browsable by city, status, collection, rejection reason and evidence. Its
manual Refresh button displays the latest ten-feature checkpoint and OpenRouter
spend without moving the page while somebody is reading. Use it to review the completed Randstad batch and record approvals;
automatically passed candidates remain visibly separate from published facts.

Naming facts now preserve both useful forms: the native map name remains the
identity and an evidence-backed English meaning may appear beside it as a
gloss. Review these especially closely; an English gloss must never replace
the name the player needs to recognise on signs and maps.

Street and waterway records with linked Wikipedia pages now enter the same
catalog. Canal Recall indexes their exact extract IDs, keeps street/water
homonyms separate, and shows reviewed trivia after both driving and boating
route answers. The original Map Recall category loader already joins reviewed
facts generically by exact ID. The pending Randstad regeneration must include
these two new collections before item 16 can move to history.

The original Map Recall app now consumes the same reviewed `facts.json` by
exact extract feature id and shows the selected quotation after an answer;
unmatched POIs keep their existing Wikipedia card. Civic POI types are no
longer silently omitted from its All/Landmarks filters. Expansion work belongs
in the shared catalog above, not in a second app-specific generator.

**6. City knowledge review map.**
A full-city review screen colour-coding every learned road and waterway by
mastery and review state, with a fog-of-war layer over the rest. Derive it from
nearby learned features, visits, answer history and recency rather than treating
one drive-through as mastery. Pairs naturally with item 5: the same data answers
"what do I know" and "where should I be sent next".

**7. Expand the street encyclopedia beyond Nes.**
The runtime card, the `W` article action and the normalized-name join are proven
end to end with one street. What remains is generating the compact
knowledge extract for notable streets city-wide — English lede, article URL,
optional image — and showing each street sparingly, so facts support spatial
recall rather than interrupt every junction.

---

## P2 — Weight and reach

**8a. Productionise government-data building appearance enrichment.**
The current worktree has a working PDOK proof: 5,778 of 10,578 Amsterdam
appearance-backed buildings have sampled aerial roof colours, backed by 1,316
cached tiles (78 MB), and the renderer has separate wall and roof surfaces.
It is not yet reproducible or safe to publish from the refresh pipeline, and
the remaining source counts are not trustworthy enough to call coverage done.

Make the sampler city-parameterised and staging-only; pin imagery vintages;
sample BAG/3DBAG LoD2.2 roof planes across all intersecting tiles; record source,
date, method, confidence and rejection reason; generate a stratified 200-roof
review sheet; then gate publication on coverage and labelled colour accuracy.
After that, spike a semantic roof-material classifier with an abstaining
`unknown` class and map its predictions to individually licensed OSM Texture
Library assets. Treat façade texture as a separate oblique/street-imagery task:
nadir satellite images do not observe walls. Use Satellietdataportaal's repeated
30/50 cm RGB/NIR acquisitions for agreement, vegetation rejection and change
detection only after its supplier-specific training/derivative terms have been
recorded. Full status, government source hierarchy, phases and acceptance gates
are in [`BUILDING_ENRICHMENT.md`](BUILDING_ENRICHMENT.md).
*This is the measured-material foundation for item 10; finish it before baking
appearance into detailed meshes.*

**8b. Finish typing the game subsystems.**
Measured 2026-08-31: ~21,000 lines of TypeScript against ~6,100 lines of
hand-written JavaScript in `public/canal-drive/js/` (the other ~1,300 JS lines
there are esbuild output from `src/recall-store`, and every `*.bundle.js` is
generated from TypeScript).

The rule that has been working, and should decide what moves: **decisions in
TypeScript, painting and adapters in JavaScript.** `noticeCards.ts` +
`renderer.js`, `bottomHud.ts` + `hud.js`, `streetOverlayStyle.ts` +
`vector-map.js` are all this shape and all have tests on the half that decides.

`road-network.js` and `osm-loader.js` are both adapters now. Surface bands,
junction-aware road-name selection, same-name feature stitching, graph
construction and Dijkstra live in typed modules; so do the projection,
Douglas-Peucker simplification, network recentring, snapping, start/finish
selection and the slippy-tile grid (`osm/roadProjection.ts`, 6,542 real
Amsterdam paths asserted against the algorithm it replaced).

What is left in `osm-loader.js` is Overpass mirrors, failover and `Image`
loading — network I/O that can only be tested by going to the network.

**No un-migrated decision logic remains under this item.** What is left is
item 8c's DOM work.

Settled 2026-09-01: `track.js` was dead — `this.track` is only ever a
`RoadNetwork`, and the `Track` class was constructed nowhere — so it is gone.
`car.js` is **not** dead despite the same suspicion: `PlayerCar extends Car`,
so it is live base physics and stays. The `Track` interface in
`collaborators.ts` is structural and still describes `RoadNetwork`.

Explicitly staying JavaScript: `game.js` (the orchestrator, and the integration
hotspot CLAUDE.md reserves), `renderer.js`, `hud.js`, `vector-map.js`,
`map-picker.js`, the `*-source.js` 3D bundle entrypoints, and the small helpers
(`input`, `camera`, `utils`, `sound`, `particles`, `loading-screen`).

`game-route.js` (774) is parked behind item 8c: it is the part a UI framework
would delete rather than type, so translating it verbatim would be work thrown
away.
*The rule to keep: what the player is told is typed and tested; what paints it
is not. Do not translate a method verbatim if the decision inside it belongs in
the data half.*

**8c. Decide the DOM overlay's framework, then rewrite the settings form.**
Canvas draws the game, the HUD, every card and the finish screen; that stays
hand-written and must never go near a framework. But roughly 450 lines are
plain DOM — the route setup form, the quiz prompt card, the account row — and
they are the hand-rolled state work: preferences, `<select>` values and game
state are synchronised in three directions by hand across `_loadPreferences`,
`_savePreferences`, `_syncLiveSettings`, `_readLiveSettings` and
`_syncHomeAddressField`.

React is the recommendation, on one ground: the repo already runs React 19 for
the main Map Recall app, and adding Svelte would mean two component idioms and
two toolchains for 450 lines of form. Its ~45 KB gzipped is real but small
against the ~2 MB item 9 is about, and it deletes more state code than it adds.
Mount it only on the overlay, code-split, never in the frame loop. Do this
after `modes.ts` covers every setting, so the form binds to a typed state
object rather than to `getElementById`.

**9. Stop shipping three.js twice, and Firestore to everyone.**
Measured, not suspected: `detailed-buildings.bundle.js` is 698 KB and
`player-vehicles.bundle.js` is 606 KB, and both contain their own copy of
three.js. `recall-store.bundle.js` is 750 KB, of which the great majority is
Firebase/Firestore — shipped to every player including guests who never sign in.
That is roughly 2 MB of JavaScript where well under half would do. Share one
three build across the 3D bundles and load the Firestore sync lazily, behind
sign-in.
*Pure win, no design decisions, and it makes every later 3D addition cheaper.*

**10. Replace flat landmark boxes with an appearance-aware building pipeline.**
Keep MapLibre as the map, camera, labels and interaction surface. OSM Buildings
is a useful quality reference but is a separate viewer, not a MapLibre layer;
using its hosted service would also couple the game to non-commercial service
terms. For Dutch cities, use BAG identity and 3DBAG LoD2.2 semantic geometry as
the canonical source, compile measured roof and façade appearance into owned
spatial tiles, then render through a MapLibre custom 3D layer using the shared
Three.js runtime. OSM2World remains the procedural adapter for cities without
equivalent government geometry. The authoritative architecture, schemas,
fallback ownership and migration gates are in
[`BUILDING_RENDERER_DESIGN.md`](BUILDING_RENDERER_DESIGN.md).

Do this as a gated progression rather than converting Amsterdam in one shot,
ordered **completeness before fidelity** — every step that makes more of the
city look like itself comes before any step that makes a few buildings look
better. This is a P2 item on a board whose P1 tier is the learning model, so it
will be interrupted; each step must be worth shipping alone.

1. **Answer two questions first.** (a) Does the hosted 3DBAG tileset resolve a
   feature to a BAG `pand_id` via `EXT_structural_metadata`? One afternoon, and
   it decides whether measured colours can be joined onto government geometry at
   runtime with no compiler at all. (b) Finish item 8a, so the appearance table
   is BAG-keyed, quantised and trustworthy.
2. **Ship the complete LoD1 city.** The city is gray because only 10,578
   buildings have appearance at all, against a BAG pand count in the low
   hundreds of thousands — coverage, not fidelity. Count it exactly in step 1.
   Publish a complete BAG-keyed footprint + 3DBAG height + measured roof colour
   source on the tile grid detailed geometry will later use, render it with
   ordinary fill-extrusions, and delete `building-3d`, `osm-colored-buildings`,
   `osm-colored-building-roofs` and the height-offset stack that keeps three
   coplanar extrusions from z-fighting. Heights stop being guessed in the same
   change: `build-osm-building-appearance.ts:32` currently falls back to
   `levels * 3` or a flat 9 m, so much of the skyline is invented, and AHN-derived
   3DBAG heights replace it everywhere. Largest visible win in the whole item,
   no new renderer, and it is the fallback every later step needs. If step 1(a)
   succeeded, this can ship as our LoD1 city underneath the existing hosted
   LoD2.2 meshes, recoloured — high-quality existing geometry plus our own
   measurements, no compiler written yet.
3. **Rijksmuseum proof.** Fetch a tightly clipped, pinned 3DBAG LoD2.2 source
   around the Rijksmuseum and export an owned glTF. Confirm that the result
   preserves building parts, semantic roof/wall surfaces, the courtyard and the
   recognisable towers. Record exact source versions and commands so the asset
   is reproducible.
4. **Make the asset game-ready.** Transform the model origin into local metres,
   retain one stable BAG identity plus OSM aliases per selectable building or
   part, remove unseen/redundant geometry, generate normals, and compress the
   result. Apply the measured PDOK roof colours after conversion without
   discarding the material and part boundaries that make the model recognisable.
5. **One MapLibre custom layer.** Extend the existing shared Three.js scaffold
   rather than shipping another renderer. Load the Rijksmuseum GLB into the
   same WebGL context and projection matrix as MapLibre; verify depth against
   roads, water, labels, the player vehicle and landmark highlights. Hide the
   underlying LoD1 feature by `buildingId` only for buildings whose replacement
   mesh has loaded successfully — never with a coverage mask over tile bounds,
   which cannot avoid erasing the navigation corridor and cannot hide a tall
   extrusion leaning in from the next tile.
6. **Preserve game interaction.** Clicking a mesh must resolve to the same
   landmark/building record as clicking the vector footprint. `hide_3d`, active
   landmark highlighting, camera transitions and context-loss recovery must
   affect generated meshes and ordinary extrusions consistently. A failed or
   slow mesh request must leave the current building visible and clickable.
7. **Tile the pipeline.** If the landmark proof holds, generate independently
   cacheable spatial tiles rather than one city-sized model. Publish a compact
   manifest containing bounds, content hashes, byte sizes and every source date;
   fetch only the camera's nearby tiles, unload with hysteresis, and cap
   concurrent decoding. Keep ordinary MapLibre extrusions outside the detailed
   radius.
8. **Set acceptance gates before widening coverage.** Compare a fixed
   Rijksmuseum screenshot against both today's renderer and OSM Buildings.
   Require the roof silhouette and courtyard to survive, no duplicate/z-fighting
   geometry, no new navigation occlusion, and no material frame-time regression
   on the mobile test target. Measure compressed bytes, parse/decode time, GPU
   memory and draw calls. Stop at signature landmarks if city blocks cannot meet
   those budgets.
9. **Expand by visual value.** Next cover other unmistakable landmarks and only
   then representative residential blocks. Do not promise citywide meshes
   until tile churn and low-end mobile performance pass a real driving route.
   Before building a texture atlas, render one block twice — quantised flat
   colour against textured material — on a real driving route and decide whether
   texture changes what a player recognises at a street-level chase camera. A
   negative result is a good result and saves the subsystem.

The first *shipped* deliverable is step 2, the complete coloured city. The
first mesh deliverable is deliberately only the reproducible Rijksmuseum asset,
the custom-layer spike and its measurements. That result decides whether the
production format is tiled glTF, 3D Tiles, or signature-landmark GLBs; it must
not introduce a second map or a runtime dependency on OSM Buildings.

**11. Let the game actually play a second city.**
The extractor is city-agnostic and four cities are now built and checked:
Amsterdam, Utrecht (11,801 routing ways, 380 landmarks), Rotterdam (31,810
routing ways, 22,559 appearance-backed buildings) and Den Haag (17,920 /
27,576). The runtime is not: `osm-loader.js` hardcodes
`../data/extracts/amsterdam/${dataset}.json`, so there is no way to reach any
of them from the game. Needs a city selector, a cityId that flows through
to review keys, and a basemap origin that is not assumed to be Amsterdam's.
Rotterdam and Den Haag have had no landmark-text pass at all yet.
One data gap behind it: 275 of Utrecht's 380 landmarks still have no text at
all, so under the a9b21c7 rule the city is thin rather than noisy. Its bridges
are built (300 resolved into 386 crossings) and its cards are English as far
as Wikidata descriptions reach — 71 of 105 written-up landmarks, with 34 still
Dutch pending a real translator.

**11b. Re-run Amsterdam through the general pipeline.**
Only the branded POIs were merged in from a staging build, deliberately — a
full refresh would have churned 29,051 routing ways and every landmark blurb
mid-review. So Amsterdam has not yet been rebuilt with shared-vertex
connectivity or the `motorway`/`trunk`/`*_link` classes, and lacks the
`cityProfile` Utrecht now has. Run it, diff the coverage counts, publish only
after review.

An attempt is preserved on the **`wip/extract-rebuild`** branch. Its script and
building-colour work looks sound; its regenerated data is not, and it does not
pass checks. Two regressions to fix before any of it reaches `main`:

- `streets-routing.json` fell from 29,051 to 15,363 ways and lost
  Potgieterstraat, so `test:canal-car` fails. Find out why the shared-vertex
  connectivity filter halves the network — most likely it runs before the
  vertices are deduplicated, so ways that genuinely meet no longer share a node.
- `bridges.json` renumbered every bridge id without rebuilding
  `bridge-crossings.json`, dropping matched bridges from 257/300 to 28/300.
  Nothing crashed, which is what made it dangerous: 229 bridges silently lost
  the water beneath them and the water-before-bridge rule stopped applying.
  The two files are a matched pair keyed on id — rebuild them together.
  `test:bridge-crossings` now asserts that alignment.

**11c. Give Amsterdam and Utrecht real ledes. Blocked on a macOS upgrade.**
Amsterdam has 448 distinct Dutch ledes left; Utrecht has 39 Dutch and 103
Wikidata one-liners. Both upgrade in place — every feature keeps
`wikipediaExtractOriginal` and its language — and the pass is now built and
tested against the translator this project has chosen: `translate`
(scriptingosx/translate-cli) or `trn` (hotchpotch/trn), auto-detected in that
order. Both are local, free and keyless.

The only thing standing in the way is that both need **macOS 26**, plus the
Dutch language pack installed through System Settings. Once the machine is
upgraded, the whole job is:

    brew tap hotchpotch/trn https://github.com/hotchpotch/trn
    brew install hotchpotch/trn/trn     # or install translate-cli
    npm run enrich:english -- --dry-run --limit=20   # read the output first
    npm run enrich:english
    npm run enrich:utrecht-english -- --translator=trn

Read the dry run before the real one. Translations are written into
`scripts/english-translations.json` keyed by a hash of the exact source text,
so they are reviewed in a diff like any other text and a refreshed extract
invalidates a stale entry rather than silently keeping it.

Expect some refusals: the pass rejects a translation that lost the feature's
own name, because "The Blue Bridge is a bascule bridge over the canal" teaches
the wrong name for the Blauwbrug. Those come back as
`refused — translated the name itself` and are worth reading; the feature keeps
its Dutch lede rather than getting a wrong English one.

Also still open, and cheaper: 281 entries in the translation cache no longer
match any extract, because the Dutch ledes they were made from have since been
rewritten upstream. The pass counts them; nothing prunes them.

**12. Clear all my data.**
A deliberately guarded reset for test accounts and players who want a fresh
start: clears local preferences, recall and exploration state and the signed-in
Firebase copy, explains exactly what will be deleted, requires confirmation,
and leaves authentication intact. Also makes items 5 and 6 testable by hand.

**13. Reward fully separated cycle tracks.**
A bonus on OSM ways with separated cycle infrastructure, tuned so it reinforces
safe Amsterdam route knowledge without encouraging detours.

**14. Finish the Storybook workbench.**
Ten phone states exist now — the driving HUD (idle, steering, mid-question,
small phone, landscape), the route briefing, the recall prompt, the arrival
card, the settings panel and the expanded article — driven by a
`canalRecallForceTouch` override, because the viewport addon alone only makes a
small desktop window and never produces a d-pad. What is left is the rest of
item 14's original scope: props-driven adapters for neighborhood entry (photo
and fallback), stacked notices and every finish-card combination, paired with
screenshot regressions. Follows naturally from item 3 — the same extraction
serves both.

**15. Keep naming regression locations.**
Continue expanding named cul-de-sac and dead-end cases in
`scripts/check-canal-car.ts`. Ongoing, not a milestone: every geographic failure
reported from play should land here before it is called fixed.

---

## P3 — Bets worth a spike, on their own branch

**17. Public transit mode.** Amsterdam as a network of tram, metro, bus and
ferry lines: stops, line numbers and colours, direction and terminus, transfers.
Its own routing and recall model rather than a vehicle skin — a trip is a
sequence of services and walking connections, and questions must distinguish the
stop from the line from the destination. Live disruption data stays optional so
the learning game still works from a cached, versioned extract. *Large.*

**18. A SimCity 2000-style isometric view.** The detailed-buildings extrusion
data and the roof-colour sampler already carry most of what an isometric
renderer needs, and it is a very different feel from the top-down map without
touching routing physics.

**19. Structured Wikidata, and a city-hall advisor.** The enrichment passes take
a lede and an image and stop. Wikidata also has the sitting mayor, opening
dates, architects, who a bridge is named after, what a building used to be. An
advisor card in the SimCity 2000 register — "the mayor would like you to learn
the Jordaan's bridges this week" — could turn that into assignments and give the
route generator a *reason* to pick a route instead of surprise-me. Needs a tone
that stays informative rather than cute, and it must not become another card
competing with the driving corridor.

**20. Better 3D trees.** Instanced trunk/canopy geometry with deterministic
variation from OSM species tags, distance LOD, kept out of 2D, never obscuring
navigation or quiz targets.

**21. Measured façade colours.** Pilot Amsterdam's open RGB point cloud against
BAG/PDOK LoD 2.2 façade planes on a few representative blocks; reject sparse,
shadowed or mixed samples and compare a muted median wall colour against the
current OSM-tag fallback before attempting a citywide pass. Straight-down roof
imagery cannot measure building sides.

**22. Signature landmark models** for the handful of buildings worth
recognising on sight.

**23. Authentic retro rendering**, and **24. the optional arcade layer.**
Both are large presentation bets with long-form design notes preserved at the
end of `HISTORY.md`. Neither is queued; both are deliberately parked.

---

## Ongoing reliability work

Not milestones — standing obligations, each with a live guard already in place.

- Refine boat shoreline response and bridge traversal across more route
  geometries. The current guard rolls the hull inward and preserves
  canal-tangent movement instead of leaving it stuck against a quay.
- Keep rejecting distant or ambiguous home-address-to-waterway snaps after exact
  BAG address resolution.
- Keep auditing route topology around docks, broad water polygons, bridges and
  disconnected OSM path fragments. Closed water/shore rings are already excluded
  from the navigable graph; named open paths and graph junctions still want
  checking.
- Keep tuning neighborhood postcard scale and long-name typography on mobile
  against real in-game screenshots.
