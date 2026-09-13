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

**16. Review and refine the published Randstad trivia.** The owner approved the
complete v10 automatically grounded batch, publishing 4,263 facts across 1,456
features in Amsterdam, Rotterdam, Den Haag and Utrecht. Trivia Lab now has a
**Human review** view: approve / reject / strike / note, local draft, load an
existing `facts-review*.json`, and download a version-matched review file for
`npm run facts:publish`. Cards now frame each rotated fact with a same-article
opening (`facts:attach-openings` / next `facts:build`). Remaining: work through
a stratified audit prioritising dates, quantities, Dutch translations and
model-verifier disagreements. Corrections that change wording must retain exact
Wikipedia evidence and go back through the normal publication gate — the lab
does not rewrite staged sentences in place.

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

**10. Build a low-poly Amsterdam that players recognise by real landmarks.**
Start with [the 13 September project review and delivery guide](../../CITY_RECONSTRUCTION_REVIEW.md).
It maps the current implementation, measured costs, local CV opportunities,
human review workflow and proposed unattended improvement loop. The detailed
identity/registration design remains in
[AMSTERDAM_FACADE_REBUILD_PLAN.md](../../AMSTERDAM_FACADE_REBUILD_PLAN.md).

Current audited state: active district release `c4bebc1f…` contains 7,395
source buildings. Its route processing covers 585/598 eligible frontages,
96.4% by eligible length, with 560 compatible wall bindings. The latest
`0f625ffc…` candidate has 1,000 valid ground analyses, 988 full analyses and
compiled source-derived features on 973 buildings; it remains staged with
zero accepted metric registrations. Counts describe different stages, not
measured reconstruction fidelity. See [the district runbook](DISTRICT_PIPELINE.md)
and [the thousand-building report](../../scripts/review/THOUSAND_BUILDING_REPORT.md).

Next work, in order:

1. Freeze a reproducible baseline and protect saved labels/corrections. Reconcile
   run-specific policy and budget reporting. Resolve the failing
   `test:facade-fidelity` assertion against intended per-tier behavior: its
   ground-only fixture currently also emits upper-floor window priors.
2. Consolidate the existing comparison, registration and correction tools around
   one source-bound case. Capture structured edits, preserve overrides, and
   establish an independent evaluation split before further tuning.
3. Complete source → recipe → both-viewer delivery for 20–40 representative
   frontages on one route. Measure extraction in source pixels separately from
   3D placement; address roof/gable silhouette, balconies, entrance placement,
   temporal conflicts and the Moeders game sign-tile residency failure.
4. Extend the existing resumable coordinator with failure-specific repairs,
   bounded retries, independent evaluation, regression generation and a useful
   unattended run report. Calibrate field-level automatic acceptance using
   held-out evidence; retain conservative output for unresolved cases.
5. Profile the complete scene on a named desktop and physical phone, then
   expand to diverse architectural districts with measured quality and review
   cost. The saved 9.12 MB building-buffer/texture figure excludes other scene
   memory and cannot establish full-device performance.

The existing unreviewed shopfront/literal-sign policy remains recorded in
HISTORY.md. Proposed delivery levels do not bypass current release gates.
Keep the missing twelve original image-numbered examples as an unresolved
historical issue while defining new work against identified evidence.


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

**11c. Give Amsterdam and Utrecht real ledes.**
Amsterdam’s card-facing extracts are English in the publish gate
(`check:extract-english` after `enrich:english` in `refresh-city-extract.sh`).
Remaining thin blurbs are Wikidata description floors or rename refusals that
fell back to a description. Utrecht still has Dutch / one-liner backlog:

    brew tap hotchpotch/trn https://github.com/hotchpotch/trn
    brew install hotchpotch/trn/trn     # or install translate-cli
    npm run enrich:utrecht-english -- --translator=trn --dry-run --limit=20
    npm run enrich:utrecht-english -- --translator=trn

`street-knowledge.json` is now generated from streets/water
(`npm run build:street-knowledge`) — do not hand-edit it. Stale entries in
`scripts/english-translations.json` are still counted but not pruned.

Expect some refusals: the pass rejects a translation that lost the feature's
own name. Those come back as `refused — translated the name itself` and fall
back to a Wikidata description when one exists.

**12. Clear all my data.**
Partial: **Reset knowledge…** is on the route briefing account row (and
confirms before wiping). It clears local + signed-in spaced-repetition memory
and fact-rotation history, leaves auth and Canal preferences. Still open: a
full “clear preferences / exploration / everything” path if we want that
separate from knowledge reset.

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

**22. Signature landmark models — re-enable once cheap enough, then finish the set.**
Thirteen buildings are built and placed; the demo page still draws them. They are
**disabled in the live game** after a playtest: thirteen meshopt GLBs on the
shared MapLibre/Three canvas were too slow, and Centraal arrived with its
SketchUp ground plane still attached. Licence follow-up stays parked by owner
decision. Remaining work:

*Re-enable behind a measured gate.* Load one model (Palace or Centraal) first,
strip residual ground planes in the build, measure desktop and mobile frame
time, then widen.

*Facade bearings are unverified.* `FACADE_BEARINGS` records which way each
building faces and only the Palace's was checked. They do not affect placement —
a surveyed model arrives correctly turned — but they are reported in the UI as
fact. Pin them against each footprint's long axis in a check script. That check
is the one `package.json` used to *claim*: a `test:signature-landmarks` entry
pointed at `scripts/check-signature-landmarks.ts`, which has never existed in
any branch. The dead entry is gone; write the check it promised.

*Widen the set.* `search-3dwarehouse-landmarks.ts` lists 46 further landmarks
with published coordinates across the four cities — Euromast, Dom Tower,
Rietveld Schröder House, Binnenhof — so finishing the set is mostly mechanical
once cost is acceptable.

**25. Google's photorealistic mesh for the distant skyline only.** The spike in
`google-tiles-spike.html` settled the main question — Google's tiles are
unusable at 1.7 m and lose the building semantics the game teaches with, so the
near corridor stays 3DBAG (see `HISTORY.md`). What it did not settle is whether
the mesh earns its place *above* the corridor: city overview, route preview and
the far skyline, where it looked excellent and where nothing needs to be
clickable. That would keep highlightable geometry where the player interacts and
buy free realism where they only look. Blocked on wanting it: it makes the core
view a metered, online-only dependency that Google's terms forbid caching,
against the standing preference for versioned local extracts. Re-run the spike
with `npm run build:google-tiles-spike` before costing it.

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
