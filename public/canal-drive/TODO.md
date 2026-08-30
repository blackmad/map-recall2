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

**8. Refresh the extract with `motorway`/`trunk`/`*_link` included.**
Weesp and a few other genuine islands are unreachable without them. The build's
connected-street filter also uses endpoint proximity rather than shared
vertices, which is the same mistake the runtime graph used to make and has
already caused one silent 12,500-way loss.

---

## P2 — Weight and reach

**9. Stop shipping three.js twice, and Firestore to everyone.**
Measured, not suspected: `detailed-buildings.bundle.js` is 698 KB and
`player-vehicles.bundle.js` is 606 KB, and both contain their own copy of
three.js. `recall-store.bundle.js` is 750 KB, of which the great majority is
Firebase/Firestore — shipped to every player including guests who never sign in.
That is roughly 2 MB of JavaScript where well under half would do. Share one
three build across the 3D bundles and load the Firestore sync lazily, behind
sign-in.
*Pure win, no design decisions, and it makes every later 3D addition cheaper.*

**10. Put measured roof colours onto the live vector-tile buildings.**
`buildings-colored.geojson` ships 5.5 MB to overlap 10,578 of ~104,000 basemap
buildings, largely repeating geometry the tiles already carry. Keep precomputing
the genuinely new information — the PDOK roof samples — but publish it as a
compact OSM-id-to-colour table joined to tile features with feature state, and
draw roof caps as a second extrusion based at `render_height`. Current 5,778
samples encode to ~26 KB gzipped; full coverage of the 43,398-building core
projects to ~195 KB, against 1.9 MB gzipped for trimmed geometry.
Before committing: prove tile feature ids are stable and unique across tiles
(relation buildings included), reapply state as tiles load, and respect
`hide_3d` and building parts. If those hold, delete the overlapping GeoJSON
appearance layers.

**11. Try the extractor on a second city — Utrecht.**
Everything in `build-amsterdam-extract.ts`, the enrichment passes and the
crossing builder is written against Amsterdam's Overpass query and curation
file. Utrecht is the honest test: canals on two levels, a different bridge
vocabulary, the same Dutch/English Wikipedia split. What breaks first is the
interesting output — hardcoded bounds and centre, `amsterdam-curation.json`,
the `cityId` baked into review keys, the assumption of one basemap origin.

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
