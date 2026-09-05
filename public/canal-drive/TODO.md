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

The RGB DSM demo now proves the distributed roof path rather than one lucky
block: 71/143 semantic planes across 18/20 grid-selected buildings agree with
independent orthophoto colours, backed by 23 pinned LAZ tiles. The interactive
research page is `rgb-city-demo.html`; full measurements and abstention counts
are in `RGB_CITY_DEMO.md`. What remains before production is a labelled human
review, a city-scale cost/size plan, a stable join into the refresh pipeline,
and a separate façade source. Do not call the DSM a façade point cloud.

The façade half now has a measured gate rather than a guessed one. Two vision
models agree on the appearance fields (material, colour, window pattern, ground
floor: 5/6 buildings each) and not on the count fields (`bayCount`: 1 informative
agreement in 6, and none of its disagreements within ±1). `roofline` agrees 4/6
only because 3 of those are both models answering `not-visible`. Re-gating on the
appearance fields passes 4/6 where the original gate passed 0/6; see
[`FACADE_ENRICHMENT_DESIGN.md`](FACADE_ENRICHMENT_DESIGN.md). What remains, in
order:

1. **Targets are gated now** — `judgeFacadeTarget` rejects anything under 40 m²,
   4 m or a 5 m edge before a panorama is requested, because five of the six
   pilot targets were sheds (one covered 1 m²) and the appearance extract's
   median footprint is 18 m². `npm run test:facade-target` pins all six.
2. **Crops are aimed now** — `planFacadeCrop` derives `fov` and `horizon` per
   target from its measured height and its measured distance to the *nearest
   footprint point*, instead of the pilot's fixed `fov=70, horizon=0.34`. Two
   facts made the fixed crop point at the road: `horizon` is measured from the
   bottom of the frame, so it aims *down* as it grows, and a deep block's
   centroid sits far behind the façade the camera sees. Framing that cannot fit
   is reported as `fullFacadeVisible: false` rather than silently truncated.
   Still unmeasured: `aspect` is fixed at 1.6, so a tall façade close to the
   camera spends its lens budget sideways and clamps at `fov=100`. Measure
   whether a per-target aspect recovers those before buying a larger sample.
3. **Restore the human view-selection gate** that `24c8beb` reverted. The
   extractor classifies unreviewed nearest-camera crops and records
   `panoramaSelection: nearest-camera-unreviewed` to say so.
4. **Then** buy a stratified sample across typology and era. Not before 1–3:
   the existing agreement numbers measure footprint noise and camera aim as much
   as façades, so how well two models agree about one real façade is still
   unmeasured. n=6 supports no coverage claim, and agreement is not accuracy.

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

The fidelity ladder, source-resolution rules and measured implementation status
are now kept in [`LOD.md`](LOD.md). The non-negotiable correction is that
**manual OSM `building` and `building:part` geometry participates at every LoD
tier**. BAG/3DBAG is the measured Dutch foundation, not permission to flatten a
carefully mapped tower, wing, passage, courtyard or stacked part. Resolve the
sources into one owner per building; never draw overlapping representations.

Status: `feat/building-one-owner` — LoD1 step 2 republished from pipeline
(2026-09-03). 342,993 features in 295 z14 `.geojson.gz` tiles (~15.4 MB).
Checks green: Waag 15, Magna Plaza 18 OSM, Oude Kerk 43 OSM, 145 ridge-tower,
574 courtyard footprints keep OSM holes under BAG heights. Tier-2 stand-ins are
6,624 (was 20k on the first publish — same OSM extract, fewer panden win as
compositions; Magna Plaza itself is intact). Gable mesh remains step 3.

Compare: `/canal-drive/building-compare.html`.

Do this as a gated progression rather than converting Amsterdam in one shot,
ordered **completeness before fidelity** — every step that makes more of the
city look like itself comes before any step that makes a few buildings look
better. This is a P2 item on a board whose P1 tier is the learning model, so it
will be interrupted; each step must be worth shipping alone.

1. **Fix the two measured LoD1 regressions.** ✅ Done on `feat/building-one-owner`:
   complete `buildings-osm.geojson` (422,570 buildings / 5,485 parts) feeds the
   ladder; compositions without `min_height` still win; parent outlines are
   dropped; tower-on-podium uses `ridge-tower` when the ridge sits ≥10 m above
   LoD1.2. Named checks: Waag, Magna Plaza, Oude Kerk, ≥50 ridge-tower.
2. **Ship the complete LoD1 city.** ✅ Republished on `feat/building-one-owner`:
   295 z14 `.geojson.gz` tiles (~15.4 MB), 342,993 features, courtyard holes
   and paint-inherit in the pipeline. Runtime now skips the static coloured
   extract + basemap proximity de-dupe when the tile index is present; the
   extract + `basemap-hide-ids.json` sidecar remain the no-tiles fallback.
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

**10b. Amsterdam façade twin — pilot boundary reconnaissance (M0).**
The build prompt is [`AMSTERDAM_FACADE_TWIN.md`](AMSTERDAM_FACADE_TWIN.md);
measured findings are in [`FACADE_RECON.md`](FACADE_RECON.md). M0 is done for
RECON-1/2/3, merged to `main` on 2026-09-04: coordinate system pinned
to 1.4 mm in the pilot, boundary fixed as geometry with 36 named locations,
**3,025 panden** counted (not the brief's ~2,000), 3DBAG massing joined at 95.7%,
and the Rijksmonumenten register located and mined.

Two measured findings change the plan and should be read before M1 starts:

- **3DBAG's roof is not a gable source.** `b3_rmse_lod22` is 0.60 m median on
  pitched roofs against 0.11 m on flat, and flat across plot width and century.
  It tracks roof *complexity*, not reconstruction failure, so a naive 0.5 m gate
  would reject 61% of the pilot for being interesting. Massing, storeys and
  eaves are trustworthy; the gable top must come from façade observation.
- **The monument register is a gable-type source and little else.** It names a
  specific gable for 70% of described monuments — 695 panden, 23% of the
  pilot — but bay count for 3% and storey count for 1%. Median description is 88
  characters. Bays, storeys and window arrangement must come from imagery.

Since then: the pipeline is source-adapter driven and runs unchanged over a
second city, RECON-4 is done, observation coverage is measured (139,937 panorama
poses; **88.6% of buildings have a frontal view**), and façades rectify and
measure end to end from Amsterdam's CC BY panoramas.

**What actually blocks progress now, in order.**

1. **Nothing is drawn in the game.** Fourteen commits, zero pixels. The brief
   gates M1 — massing in-game, recognisable in overlay against reference —
   before measurement work, and every measurement bug found so far took
   paragraphs of prose to discover from JSON when it would have been obvious in
   five seconds of overlay. Next slice: the MapLibre custom layer drawing the
   3,025 records at LoD2.2 keyed by `pand_id`, `resolveFidelityTier` suppressing
   `detailed-buildings` inside the boundary so one representation owns each
   building, and the photo/render opacity overlay at two reference viewpoints.
2. **No detector output has been validated.** `check-facade-registration.ts` is
   red at its own 0.5 m bar, and street-level fields are capped at confidence
   0.4 because of it. The storey ladder returns 6 storeys for 32 of 56
   Keizersgracht buildings where 3DBAG's pilot median is 4–5. `calibration.ts`
   was written for this and has never been fed a real `ReviewOutcome`. Fix:
   hand-label ~20 of the Keizersgracht 100–180 rectified strips for storeys,
   bays, gable and wall family, run `fieldAccuracy` → `fieldVerdict`, and let
   the verdict decide accept / needs-review / demote per field.
3. **RECON-5 blocks a field.** Roof material is `default` on every record
   because inferring it from bouwjaar would be a prior supplying a value. The
   pipeline exists (`scripts/build-roof-color-observations.ts`); it needs
   pointing at the boundary rather than the A10 cache, and `nearestRoof` in
   `materials.ts` is already waiting for it.
4. **BUILD-1…5 can run in parallel now.** The Blender gable, window, cornice and
   pui libraries depend on the vocabulary, not on any measurement.
   `materials.ts` is a start on BUILD-5, but `wallFamily`'s thresholds are
   constants with no labelled case behind them.

Also outstanding: RECON-10 (quay, water level, bridges), the 131 panden with no
3DBAG match, and reconciling the 3DBAG API's `v2023.10.08` collection against the
`v20250903` tileset the runtime actually streams.

Left by the merge, and cheap: the project now carries two RD New
implementations — `src/canalRecall/rdCoordinates.ts` (pinned by
`test:rd-coordinates`) and `src/canalRecall/facade/rdNew.ts` (pinned by
`test:facade-coordinates`, and the one that subtracts the measured 0.183 m /
0.234 m datum offset). Both checks pass, so nothing is wrong today; keep the
façade one and fold the other into it before a third caller picks the wrong
one.

**10c. Decide what a drawn gable is allowed to claim. Unmerged, needs a call.**
`feat/canal-house-gables` (one commit, `8d7aa24`, 68 behind main) gives the
whole centre a roofline instead of thirteen signature models:
`src/canalRecall/buildings/gableProfile.ts` picks one of six gable types per
building from its footprint and OSM tags, seeded on the building's own id so a
house keeps its gable between runs, and the renderer merges ~5,000 gables into
one geometry in about 100 ms. 11 checks pin the citywide *mix* — step gables
under 14%, lijstgevel over 25% — so the centre reads as a city rather than a
theme park. 2,668 of 10,578 buildings qualify. It draws only on
`signature-landmark-demo.html`, not in the game.

It is good work and it is blocked on a question, not on a bug. Item 10b just
merged `src/canalRecall/facade/gable.ts`, which names the same six types by
*measuring* the building's own roofline and returns `unknown` when it cannot.
The two modules answer "which gable does this house have" in opposite ways:
one measures this house, the other invents a plausible one from its id and
tunes the answer until the city-wide distribution looks right.

This board's ordering rule is that a game which teaches the wrong thing is
broken in a way that a plain-looking one is not, and the façade brief is
explicit that the ring's grammar is a *rendering vocabulary*, never a source of
facts — it may say how to draw a klokgevel once you know this house has one,
never that it has one. A seeded gable is a prior supplying a value, which is the
same mistake that put roof material back to `default` in 10b. The branch's own
commit message argues the player "learns something true about the city", and
that is the claim at issue: true of the *distribution*, not of the house the
player is looking at.

Three ways out, in increasing cost:

1. **Merge it as a demo, and say so.** It only touches the demo page today.
   Land it behind a name that cannot be mistaken for measurement, keep it out of
   the game, and treat it as the rendering half waiting for a source.
2. **Make it consume measured types.** `gableProfile.ts` draws outlines well and
   `facade/gable.ts` classifies. Feed the measured type in where one exists,
   draw nothing — or a flat lijstgevel — where it says `unknown`, and the
   invented distribution problem disappears. The 88.6% frontal-view coverage
   from 10b is roughly the ceiling on what could be filled.
3. **Drop it**, and let 10b's measured path reach the renderer on its own.

Do not merge it into the game as-is on the strength of it looking right; that is
the failure mode 10b spent a whole lane learning to avoid.

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

**20b. Polish authored omafiets silhouette.** Street mode now uses
`scripts/build-omafiets-bike.py` (low-poly step-through, blue front tyre,
hub pivots) instead of the Sketchfab Swapfiets. Remaining taste work: slightly
chunkier tubes if chase still feels thin, optional rear rack / skirt-guard cue,
and confirm steer/spin in `bike-preview.html` before locking game-scale constants.

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

- Keep rejecting Wikipedia disambiguation / surname-list ledes in enrich
  (`isDisambiguationExtract`) and the publish gate
  (`check:encyclopedia-disambiguation`). Re-run `npm run scrub:disambiguation`
  only after a bad enrich slips through.
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
