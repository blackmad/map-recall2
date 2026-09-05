# Canal Recall — what is left

The work board. Everything finished lives in `HISTORY.md`; this file is only
things that are not done. Keep it current in the same change that moves an
item, not afterwards.

Ordered by one rule: **a learning game that teaches the wrong thing is broken
in a way that a plain-looking one is not.** So correctness of what the game
teaches outranks the depth of what it teaches, which outranks how it looks.
Within a tier, cheap-and-blocking comes before expensive-and-isolated.

Building / façade / 3D mesh work is owned by other agents — do not queue it
here. Their design notes stay in `BUILDING_*.md`, `FACADE_*.md`, `LOD.md`, and
`HISTORY.md`.

---

## P0 — Red, or actively teaching something false

*Empty. Keep it that way: anything that makes the game teach something false
belongs here before anything below it.*

---

## P1 — The learning model itself

**16. Review and refine the published Randstad trivia.** The owner
blanket-approved the v11 opening-then-trivia catalog on 2026-09-05, publishing
4,052 facts across 1,628 features (Amsterdam 948 / Rotterdam 270 / Den Haag
199 / Utrecht 211), each with a same-article opening. Trivia Lab still has a
**Human review** view for later audits: approve / reject / strike / note, local
draft, load an existing `facts-review*.json`, and download a version-matched
review file for `npm run facts:publish`. Remaining audit: dates, quantities,
Dutch translations and model-verifier disagreements. Corrections that change
wording must retain exact Wikipedia evidence and go back through the normal
publication gate — the lab does not rewrite staged sentences in place.

**6. City knowledge review map.**
A full-city review screen colour-coding every learned road and waterway by
mastery and review state, with a fog-of-war layer over the rest. Derive it from
nearby learned features, visits, answer history and recency rather than treating
one drive-through as mastery. Pairs naturally with item 5: the same data answers
"what do I know" and "where should I be sent next".

---

## P2 — Weight and reach

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

**No un-migrated decision logic remains under this item.** Overlay preferences
(item 8c) are typed; what is left in `game-route.js` is the Game adapter.

Settled 2026-09-01: `track.js` was dead — `this.track` is only ever a
`RoadNetwork`, and the `Track` class was constructed nowhere — so it is gone.
`car.js` is **not** dead despite the same suspicion: `PlayerCar extends Car`,
so it is live base physics and stays. The `Track` interface in
`collaborators.ts` is structural and still describes `RoadNetwork`.

Explicitly staying JavaScript: `game.js` (the orchestrator, and the integration
hotspot CLAUDE.md reserves), `renderer.js`, `hud.js`, `vector-map.js`,
`map-picker.js`, the `*-source.js` 3D bundle entrypoints, and the small helpers
(`input`, `camera`, `utils`, `sound`, `particles`, `loading-screen`).

`game-route.js` is a thin adapter over the React overlay (item 8c): it is the
part a UI framework would delete rather than type, so translating it verbatim
would be work thrown away.
*The rule to keep: what the player is told is typed and tested; what paints it
is not. Do not translate a method verbatim if the decision inside it belongs in
the data half.*

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

**11c. Give Amsterdam and Utrecht real ledes.**
Amsterdam’s card-facing extracts are English in the publish gate
(`check:extract-english` after `enrich:english` in `refresh-city-extract.sh`).
Remaining thin blurbs are Wikidata description floors or rename refusals that
fell back to a description. Utrecht was fully refreshed 2026-09-05
(`refresh:utrecht`): streets 91 / water 41 / landmarks 125 English ledes,
`street-knowledge.json` published, English gate green. Rename refusals with no
Wikidata floor now clear Dutch (originals kept) instead of blocking publish.
Re-run if a refresh reintroduces Dutch:

    brew tap hotchpotch/trn https://github.com/hotchpotch/trn
    brew install hotchpotch/trn/trn     # or install translate-cli
    npm run enrich:utrecht-english -- --translator=trn --dry-run --limit=20
    npm run enrich:utrecht-english -- --translator=trn

`street-knowledge.json` is generated from streets/water
(`npm run build:street-knowledge`) — do not hand-edit it. Stale entries in
`scripts/english-translations.json` are still counted but not pruned.

Expect some refusals: the pass rejects a translation that lost the feature's
own name. Those come back as `refused — translated the name itself` and fall
back to a Wikidata description when one exists.

**14. Finish the Storybook workbench.**
Ten phone states existed already — the driving HUD (idle, steering, mid-question,
small phone, landscape), the route briefing, the recall prompt, the arrival
card, the settings panel and the expanded article — driven by a
`canalRecallForceTouch` override. Added: neighborhood photo fallback, stacked
neighborhood+landmark notices (desktop + phone), bare landmark card, bike
finish card, and **calm finish without landmark photo** (desktop + phone).
Still open: automated screenshot regressions for the new states (build-storybook
compiles them; visual diffs are not wired yet). Follows naturally from item 3 —
the same extraction serves both.

**15. Keep naming regression locations.**
Continue expanding named cul-de-sac and dead-end cases in
`scripts/check-canal-car.ts`. Ongoing, not a milestone: every geographic failure
reported from play should land here before it is called fixed. Bike-routing
coverage for pedestrian/cycleway corridors is pinned in
`scripts/check-city-extract.ts` (Zeedijk in, Kalverstraat out); still add the
street name from any future "can't bike here" report so a junction-level miss
does not hide behind the highway-class fix.

---

## P3 — Bets worth a spike, on their own branch

**17. Public transit mode.** Amsterdam as a network of tram, metro, bus and
ferry lines: stops, line numbers and colours, direction and terminus, transfers.
Its own routing and recall model rather than a vehicle skin — a trip is a
sequence of services and walking connections, and questions must distinguish the
stop from the line from the destination. Live disruption data stays optional so
the learning game still works from a cached, versioned extract. *Large.*

**19. Structured Wikidata, and a city-hall advisor.** The enrichment passes take
a lede and an image and stop. Wikidata also has the sitting mayor, opening
dates, architects, who a bridge is named after, what a building used to be. An
advisor card in the SimCity 2000 register — "the mayor would like you to learn
the Jordaan's bridges this week" — could turn that into assignments and give the
route generator a *reason* to pick a route instead of surprise-me. Needs a tone
that stays informative rather than cute, and it must not become another card
competing with the driving corridor.

**23. Authentic retro rendering**, and **24. the optional arcade layer.**
Both are large presentation bets with long-form design notes preserved at the
end of `HISTORY.md`. Neither is queued; both are deliberately parked.

---

## Ongoing reliability work

Not milestones — standing obligations, each with a live guard already in place.

- Prefer a city-qualified Wikipedia follow (`pickDisambiguationTarget`, score
  ≥45) over silence when a sitelink lands on a dab page; still reject
  surname/list ledes and publish only via `check:encyclopedia-disambiguation`.
  Re-run `npm run scrub:disambiguation` only after a bad enrich slips through.
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
