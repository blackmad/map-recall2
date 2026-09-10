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
The single forward plan is
[`AMSTERDAM_FACADE_REBUILD_PLAN.md`](../../AMSTERDAM_FACADE_REBUILD_PLAN.md).
It incorporates the former 8a/10/10b/10c building work. Keep complete city
massing and useful OSM parts; prioritise correct identity, silhouette, opening
rhythm and distinctive colour at gameplay scale.

Next implementation slice:

1. Persist the OSM↔BAG/group crosswalk, populate panorama candidates and calibrate
   the explicit camera model with independent world↔pixel anchors.
2. Render 3–5 corrected building recipes in the game with source/orthographic/
   gameplay comparisons. Include the Herengracht 270 wrong-building regression.
3. Use measured discrepancies to retry the responsible stage, with limits and
   fallback. Evaluate on separate buildings/views before a contiguous 20–40
   building block and a landmark route.

Implemented 2026-09-05: review decisions now bind to source/wall versions and
later rejection revokes acceptance. Review history and import/export share the
typed gate. External discovery is integrated as advisory JSON with exact
licenses and distinct, versioned evidence. Roof percentiles and rectangle
extents no longer masquerade as eaves/frontage; legacy measurement/export
readers reject unversioned inputs. The comparison starts streaming without a
camera gesture: 16 resident tiles / 63,765 features in the repaired capture.
The gameplay baseline also loaded, with zero page errors.

Validation: `check:canal` (including Storybook), production build, focused trust
regressions, review browser flows and the complete-city/picking browser test
pass. The fixture export still has 16 candidates, one panorama, zero anchors
and zero reviews. No real registration or façade extraction has been certified;
hardware performance and certified building placement remain outstanding.

The 2026-09-06 photo lab now connects local segmentation masks and editable
pixel boxes to the recipe compiler. Three supplied strips have development
proposals; one known bad source abstains. Keizersgracht 136 has a version-bound
correction example for a merged window, car false positive and foreground crop.
These are isolated wall studies, not accepted building reconstructions. Next:
correct and label opening extents on a small development set, measure local
grouping/occlusion failures, improve wall-colour masking, and attach certified
wall frames when available. Roofs, cornices and window-style extraction remain
unimplemented; the renderer can demonstrate authored variants separately.

Implemented in the next 2026-09-06 slice: Grounding DINO / SAM now feed the photo
renderer, with raw detections retained, bounded row/column/width fitting and
appearance remeasurement. Forty of 86 attempted adjustments across nine strips
have sufficient edge support; 104 opening proposals render and 35 remain for
review. The named low-score Keizersgracht 136 ground-floor window is recovered
using row + column + mask + edge evidence. An isolated construction-hoarding
candidate is flagged by semantic disagreement; scores are not acceptance.
Per-field ontology records cover measured colour, candidate bars, texture and
extents, with roof/lintel/eave/door-panel shape and material fields still unknown.

Tiny matches 16/16 original labelled frames and 12/13 on the two newly labelled
buildings. Fitting preserves those counts and slightly improves the latter's box
overlap; its small drops on original cases remain reported. Three crop retries
miss the dormer. DINO Base finds it (13/13), but its low score still needs review
and its boxes are less accurate on Koningsplein. Use this as development evidence
for selective escalation, not a blanket model upgrade or held-out accuracy claim.

#### Next-day handoff for Sol 5.6 — 2026-09-06

User requested this plan, then an implementation pause. Execute this bounded
day when the handoff is resumed. It implements the existing
[reconstruction plan](../../AMSTERDAM_FACADE_REBUILD_PLAN.md); commands and run
locations are in [the runbook](EXTRACT_PIPELINE.md#current-photo-handoff-runs).
The day's deliverable is a source → evidence → fitted recipe → render comparison
for the four cases below, with visible improvements and explicit remaining
failures. Prioritise architectural structure before adding more texture detail.

**Starting state.** Work in `feat/amsterdam-facade-rebuild`, currently based on
`683d06b`, with substantial uncommitted work. Re-read status and instructions;
preserve unrelated edits and the deliberate documentation deletions. Read the
sibling worktree's strips/model environment without modifying Claude's branch.
The photo lab already offers Tiny/Base and optional inferred-reconstruction
runs; its default remains `dino-fit-05`. These are unaccepted, isolated wall
studies with no map aliases. Existing 104-proposed/35-review counts above describe
the earlier Tiny slice, not the newer Base/hypothesis runs.

Base and SAM checkpoints are already local. Base found one extra labelled dormer
but worsened some other boxes; the dormer still fails downstream acceptance.
Do not spend the morning reacquiring models or comparing aggregate detection
counts. Inspect the exact stage that loses a feature. The current
`context_check` in `compile-dino-photo.py` also rejects the real Herengracht 219
garage under Base: score about 0.644, baseline semantic support about 3.95%.
Keep this counterexample alongside the construction-hoarding false positive.

| Case | Required correction or diagnostic | Guard against |
| --- | --- | --- |
| Keizersgracht 136 | Fit the lower middle opening to the supported lower-row assembly; show measured versus inferred extent and its peers | Sampling car/occlusion pixels as newly observed window; forcing every storey to one height |
| Bloemstraat 3 | Separate tall central glazing from smaller side-window families; recover supported occluded candidates | Stretching side windows to central glazing; accepting a lamp silhouette as the opening mask |
| Herengracht 219 | Explain/restore the left image column, fix the garage rejection, inspect wider source coverage for the reported roof | Treating provisional wall alignment as image evidence; assuming the roof is mansard from the user's description alone |
| Herengracht 242 | Inspect source coverage for roof and souterrain openings; retain partial observations where visible | Treating everything below a provisional ground line as foreground, or inventing features outside the source |

**0–0.5 h — freeze the cases and reproduce the failures.** Save the selected
source hashes, model/config hashes, current run names and before renders. Label
all evaluable openings in these four images, including ground-floor assemblies,
partial/occluded regions and explicit negatives. Record which requested roof or
basement features are actually in the crop. Existing upper-window box labels
are insufficient for these complaints. These are development cases, not blind
holdouts. Confirm current tests rather than inheriting an old passing artifact.

**0.5–2.5 h — fit assemblies and local window families.** Extend
`fit_openings.py` / `layout_hypotheses.py` around façade zones, repeated families
and parent/component relationships (door plus transom, paired glazing, shopfront).
Use row heads/sills, bay axes, edge support and visibility together. Preserve
different widths, heights and staggered ground floors when supported. The
conservative fitter's five-pixel movement cap is for measured-box refinement;
larger continuations belong in separately bounded inferred geometry. Current
K136 preview already extends the middle bottom from pixel 396 to 422 while
sampling only the measured extent: retain that separation and test competing
hypotheses. Row/column agreement can corroborate an existing weak observation;
an empty grid cell alone must not create an observed opening. Require improvement
on K136 without collapsing Bloemstraat's distinct window families.

**2.5–4 h — separate detection, visibility and ownership decisions.** Repair
the garage/hoarding disagreement gate using explicit supporting evidence and
abstention, rather than lowering all thresholds. A failed SAM mask can prevent
colour sampling while geometry remains a supported hypothesis. Keep image
truncation, occlusion, source-wall disagreement and model disagreement as distinct
reasons. A correctly detected left column can appear in an unplaced image study
while its BAG ownership remains unresolved. Compare raw detections, proposed
geometry and render omissions with denominators; do not improve precision merely
by removing difficult features. Add garage-positive and hoarding-negative tests.

**4–6 h — source coverage and one roof/basement vertical slice.** Inspect full
cached panoramas and available rectification metadata for H219/H242. Obtain a
wider source observation only with an explicit, supported camera pose; reject
missing-height sentinels and retain source/rectifier lineage. Wider cropping
alone does not certify registration. New pixels/rectification require new hashes
and regenerated dependent labels/features. Verify the reported roof type from
visible roof geometry. Where evidence supports it, carry one roof/gable/cornice
profile through the existing recipe compiler and diagnostic render, with uncertain
depth/hidden surfaces marked inferred. Represent visible basement openings and
their datum uncertainty separately from canal/vehicle masks. Time-box source
repair: if coverage/registration cannot be resolved within this slot, deliver
the full-source coverage diagnostic and exact missing evidence, then use another
existing usable roof view for the compiler experiment. Keep the original targets'
unseen roof geometry unknown; do not turn the crop edge into a building roof.

**6–7 h — appearance within the corrected structure.** Separate outer frame,
glass, door panel, wall/plinth and any visible trim. Reuse a bar-layout hypothesis
only within a supported window family, retaining exceptions and uncertainty.
Check reflected branches, blinds and railings before interpreting lines as
glazing bars. Attach source masks/patches to colour and material proposals;
inferred continuation adds no colour samples. Keep procedural brick bond,
mortar and depth explicitly authored until measured. Work on the clearest
failure class first; detailed roof trim and a complete Dutch-window taxonomy
are follow-ups if this time box is exhausted.

**7–8 h — compare, test and leave a reviewable demo.** Produce four named
before/after source-overlay/render pairs with raw boxes, fitted geometry,
inferred extents, omitted candidates and reasons. Preserve the selected source
when switching Tiny/Base or measured/inferred views. Update
`capture-fitted-photos.ts` to capture the chosen new runs: it currently captures
older Tiny runs and does not cover the newest hypothesis previews. Export recipe,
mesh and dependency hashes beside the captures, plus per-case disposition.

Report matched visible openings and false positives over the newly labelled
denominators, extent error by window family, rendered-versus-detected omissions,
and partial/unknown coverage. Evaluate hypotheses separately from measured boxes;
the existing upper-window IoU gate alone cannot approve this change. Test raw
measurement preservation, sampling bounds, asymmetric families, garage/hoarding,
partial openings and any new roof geometry. Run the Python fitting checks,
focused façade aggregate, lint and relevant photo/appearance/fitting/recipe browser
tests; rebuild bundles and validate the production build if compiler/UI changes
require them. Record checks actually run. No citywide accuracy, gameplay placement
or hardware-performance claim follows from these wall renders.

**End of day:** leave a working comparison URL, captures/report, reproducible
commands and a short remaining-failures list. Retain the previous runs and fallback.
No new renderer, training campaign, paid service, citywide acquisition or merge is
needed for this slice. Meshy remains optional for authored components. Any broader
model escalation follows a measured failure on this local pipeline.

#### Day-two execution result — 2026-09-06

The bounded slice is implemented in `dino-base-pilot-day2-03` and
`dino-base-expansion-day2-03`. Window fitting now keeps family-specific sill and
width groups while allowing shared head rows. K136's lower middle opening keeps
its measured sampling box and records the bounded inferred extension separately;
Bloemstraat's tall central glazing no longer stretches its smaller side-window
families. Door panel colour is represented separately from glass, and nested
door/window observations retain assembly roles.

The semantic-disagreement rule now restores H219's garage only when a nearby
independently bounded weak observation supplies clean SAM and four-edge support.
The construction-hoarding negative still has no qualifying peer and remains out.
Bloemstraat's supported occluded opening can pass with three strong sides plus a
strong mean edge score. Partial source observations remain visible in purple in
the lab and are excluded from rendered openings rather than silently discarded.

The four-case development evaluation passes all gates. Visible matches are H242
4/4, H219 8/8, K136 8/8 and Bloemstraat 21/21. Fitted mean IoU is 0.9404,
0.9175, 0.9074 and 0.9834 respectively. K136's occluded opening improves from
0.7979 raw IoU to 0.9815 fitted; the explicit K136 and Bloemstraat negatives have
zero render hits. H242's three partial openings are detected but deliberately
not rendered. H219 renders seven of eight labelled visible openings: the garage
is restored, while a side opening remains a weak non-rendered observation.

Exact-pose coverage diagnostics were generated for H219 and H242. H219's wider
rectification visibly includes the whole gable and garage, but horizontal wall
ownership remains unresolved, so no metric gable profile entered the compiler.
H242 exposes souterrain evidence but its published camera height resolves to
6.23 m above 3DBAG ground; reject its vertical registration until a supported
height is available. The original H242 strip also clips the roof. No unseen roof
shape was inferred.

Review the runs at
`/canal-drive/facade-photo-lab.html?run=dino-base-pilot-day2-03` and
`/canal-drive/facade-photo-lab.html?run=dino-base-expansion-day2-03`. The report,
source-coverage record and four before/after capture pairs are in
`.cache/facade-rebuild/reports/day2-four-case-evaluation-02.json`,
`.cache/facade-rebuild/reports/source-coverage-day2-02/report.json` and
`.cache/facade-rebuild/reports/fitted-photos-2026-09-06T18-27-14.985Z/`.
The runbook records the reproduction commands and source hashes. These labelled
examples are development evidence only; registration, building identity and
citywide accuracy remain unaccepted.

A second source set now addresses narrow-crop bias. `city-variety-07` contains
12 municipal-panorama strips selected across era, roof form, frontage width,
height and use, with ground−1.2 m to ridge+1.0 m coverage. Raw-panorama wall
overlays establish ten as usable development sources; two compound-footprint
cases remain ownership diagnostics. Eleven rejected predecessors, including four
clear wrong-wall crops, are recorded in `panorama-variety-development.json`.
The review checker pins the manifest and covers every strip, while the benchmark
runner excludes diagnostics by default. Base DINO/SAM completed on the ten usable
sources as `dino-base-city-variety-04`, producing 117 proposals and two cleaned
masks that require review. The set is unlabelled, so its immediate role is
regression discovery and choosing the next independent annotations, not an
accuracy claim.

The reviewed panorama strips now feed the photo compiler through
`prepare-panorama-photo-run.py`. Six of ten sources produce renderable family
studies; four abstain. The geometric registered-wall envelope is restricted to
sampling bounds and explicitly has unknown semantic state, so it cannot confirm
its own DINO openings. Wall colour/material from this envelope is marked
needs-review. The labelled expansion set now mixes DINO rectangles, bounded SAM,
the independent semantic CNN, classical rectangle edges, family fitting, dense
grid completion and a roof-context path. `dino-base-expansion-grid-03` restores
Herenstraat's two occluded windows and measured dormer while leaving its
out-of-wall side door for ownership review; Bloemstraat gains one separately
identified inferred grid cell. The comparison report shows Herenstraat labelled
recall moving 3/4 → 3/4 → 3/4 → 4/4 across semantic CNN, family context,
cross-detector ensemble and roof context. Bloemstraat stays 21/21 while its
explicit car negative stays excluded. All development gates pass in
`.cache/facade-rebuild/reports/expansion-grid-evaluation-05.json`.

Review the new run at
`/canal-drive/facade-photo-lab.html?run=dino-base-expansion-grid-03`. The focused
before/after render sheet and pinned capture manifest are in
`.cache/facade-rebuild/reports/expansion-inference-demos-2026-09-07T06-37-01.363Z/`;
the detector attribution is in
`.cache/facade-rebuild/reports/opening-approach-comparison-03/`. Local Qwen 2.5
VL 7B and Gemma 3 4B critiques are retained as machine proposals. The validated
Herenstraat pass agrees on the four amber/cyan windows and amber dormer while
flagging the side door; one broad Bloemstraat critic response and one strict
Qwen call failed or emitted invalid IDs, which the tooling records rather than
promoting. LLM review remains advisory and never accepts geometry.

Roof/RGB experiments are optional inputs, with commands retained in
[`EXTRACT_PIPELINE.md`](EXTRACT_PIPELINE.md#building-reconstruction-workbench).
Import useful gable geometry only when a verified recipe supplies the type;
aggregate gable distributions do not establish per-building correctness.

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
