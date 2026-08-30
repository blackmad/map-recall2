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

---

**The driving harness passes with no margin.** With the oracle fixed it
arrives 14 of 24 against a threshold of exactly 14, so ordinary run-to-run
variation flips it red — it failed once and passed once in the same session on
unchanged code. Either raise the arrival rate or make the assertion tolerant of
the variance it actually has, but do not simply lower the bar.

---

## P1 — The learning model itself

**5. Learning-aware route generation.**
Feed spaced-repetition mastery into Dijkstra as a small bounded cost on
well-known streets, so equally sensible routes prefer unfamiliar connections.
Cap the allowed detour; never make mastered roads effectively impassable. Show
the route's expected novelty, award a clearly explained multiplier for newly
encountered streets, and let calm mode take the routing benefit without the
arcade chatter. `roadGraph.ts` already accepts an injectable novelty cost, so
the routing half is waiting for a caller.
*The stated product principle — bounded, explainable learning mechanics — with
the hard part already built.*

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

**8b. Finish typing the game subsystems.**
`game-landmarks` and `game-recall` are done, and `game-route`'s geographic
rules are extracted to `routeSelection.ts`. What is left is untyped JavaScript
in `game-route.js` (~350 lines, almost all DOM form plumbing) and
`game-presentation.js` (872 lines of canvas).

Do presentation next, not route. Presentation has prior art worth reusing — an
abandoned `finishScreen.ts` on the merged `finish-renderer-ts` branch models
the finish screen as a pure layout function driven by a typed model and tested
against a recording canvas context. Route's remainder is the settings form,
which is the part a UI framework would delete rather than type; translating it
verbatim first would be work thrown away. See item 8c.
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

**10. Replace flat landmark boxes with an OSM2World mesh pipeline.**
Keep MapLibre as the map, camera, labels and interaction surface. OSM Buildings
is a useful quality reference but is a separate viewer, not a MapLibre layer;
using its hosted service would also couple the game to non-commercial service
terms. Use the MIT-licensed OSM2World converter offline instead, then render its
output through a MapLibre custom 3D layer using the shared Three.js runtime.

Do this as a gated progression rather than converting Amsterdam in one shot:

1. **Rijksmuseum proof.** Feed a tightly clipped OSM extract around the
   Rijksmuseum to a pinned OSM2World release and export glTF. Confirm that the
   result preserves building parts, `min_height`, gabled/skillion roofs, roof
   direction, the courtyard and the recognisable towers. Record the exact
   command and source timestamp so the asset is reproducible.
2. **Make the asset game-ready.** Transform the model origin into local metres,
   retain one stable OSM identity per selectable building or part, remove
   unseen/redundant geometry, generate normals, and compress the result. Apply
   the measured PDOK roof colours after conversion without discarding the
   material and part boundaries that make the model recognisable.
3. **One MapLibre custom layer.** Extend the existing shared Three.js scaffold
   rather than shipping another renderer. Load the Rijksmuseum GLB into the
   same WebGL context and projection matrix as MapLibre; verify depth against
   roads, water, labels, the player vehicle and landmark highlights. Hide the
   underlying flat extrusion only for footprints whose replacement mesh has
   loaded successfully.
4. **Preserve game interaction.** Clicking a mesh must resolve to the same
   landmark/building record as clicking the vector footprint. `hide_3d`, active
   landmark highlighting, camera transitions and context-loss recovery must
   affect generated meshes and ordinary extrusions consistently. A failed or
   slow mesh request must leave the current building visible and clickable.
5. **Tile the pipeline.** If the landmark proof holds, generate independently
   cacheable spatial tiles rather than one city-sized model. Publish a compact
   manifest containing bounds, content hashes, byte sizes and OSM source date;
   fetch only the camera's nearby tiles, unload with hysteresis, and cap
   concurrent decoding. Keep ordinary MapLibre extrusions outside the detailed
   radius.
6. **Set acceptance gates before widening coverage.** Compare a fixed
   Rijksmuseum screenshot against both today's renderer and OSM Buildings.
   Require the roof silhouette and courtyard to survive, no duplicate/z-fighting
   geometry, no new navigation occlusion, and no material frame-time regression
   on the mobile test target. Measure compressed bytes, parse/decode time, GPU
   memory and draw calls. Stop at signature landmarks if city blocks cannot meet
   those budgets.
7. **Expand by visual value.** Next cover other unmistakable landmarks and only
   then representative residential blocks. Do not promise citywide meshes
   until tile churn and low-end mobile performance pass a real driving route.
   Once replacement coverage is sufficient, delete the overlapping
   `buildings-colored.geojson` geometry and retain its PDOK measurements as a
   compact OSM-id-to-colour input to mesh generation.

The first deliverable is deliberately only the reproducible Rijksmuseum asset,
the custom-layer spike and its measurements. That result decides whether the
production format is tiled glTF, 3D Tiles, or signature-landmark GLBs; it must
not introduce a second map or a runtime dependency on OSM Buildings.

**11. Let the game actually play Utrecht.**
The extractor is city-agnostic and Utrecht is built and checked (11,801
routing ways, 380 landmarks). The runtime is not: `osm-loader.js` hardcodes
`../data/extracts/amsterdam/${dataset}.json`, so there is no way to reach the
second city from the game. Needs a city selector, a cityId that flows through
to review keys, and a basemap origin that is not assumed to be Amsterdam's.
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

**11c. Give Utrecht real ledes.**
39 blurbs across the extract are still Dutch and 103 more are Wikidata
one-liners rather than encyclopedia ledes. Both upgrade in place — every one
keeps `wikipediaExtractOriginal` and its language — but the pass needs a
translator that is not currently available here: no `GEMINI_API_KEY` is
configured, and Ollama is installed but not serving with `translategemma:12b`
not pulled. Needs a decision about a multi-gigabyte model download or an API
key, so it is deliberately not done unasked.

**12. Clear all my data.**
A deliberately guarded reset for test accounts and players who want a fresh
start: clears local preferences, recall and exploration state and the signed-in
Firebase copy, explains exactly what will be deleted, requires confirmation,
and leaves authentication intact. Also makes items 5 and 6 testable by hand.

**13. Reward fully separated cycle tracks.**
A bonus on OSM ways with separated cycle infrastructure, tuned so it reinforces
safe Amsterdam route knowledge without encouraging detours.

**14. Finish the Storybook workbench.**
Extract the remaining canvas card/HUD renderers behind small props-driven
adapters, with fixtures for recall feedback, neighborhood entry (photo and
fallback), landmark trivia, stacked notices and every finish-card combination;
pair them with screenshot regressions. Follows naturally from item 3 — the same
extraction serves both.

**15. Keep naming regression locations.**
Continue expanding named cul-de-sac and dead-end cases in
`scripts/check-canal-car.ts`. Ongoing, not a milestone: every geographic failure
reported from play should land here before it is called fixed.

**16. The geolocated fact pipeline** described in `FACT_PIPELINE.md`. Landmark
cards would prefer curated, attributed facts over raw Wikipedia ledes.

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
