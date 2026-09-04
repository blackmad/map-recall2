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
features in Amsterdam, Rotterdam, Den Haag and Utrecht. Add per-fact
approve/reject/edit controls to the Trivia Lab and export version-matched review
files, then work through a stratified audit prioritising dates, quantities,
Dutch translations and model-verifier disagreements. Corrections must retain
exact Wikipedia evidence and must go back through the normal publication gate.

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

**8c. Decide what the photoreal gate should actually measure.**
The mesh works now, but its 25 m activation height never binds. MapLibre's
camera altitude is a function of zoom and viewport height, not a simulated eye
height: measured across the view modes and the whole camera-zoom slider, the
game's camera sits between roughly 95 m and 520 m up, so `shouldShowPhotoreal`
answers "yes" every time the option is ticked and the promised hand-back to
3DBAG at cycling height never happens. The 25 m in `photorealGate.ts` came from
the spike, where it was a real eye height above the quay in a free-flying
camera, and it did not survive the move to a map camera.

Either re-measure the smear threshold against something the game's camera
actually varies — ground sample distance at the map centre, or map zoom — and
restate the gate in those terms, or accept that the option is simply "photoreal
on/off" at every height the game can reach and delete the altitude band along
with its hysteresis. Do not leave it as-is: the code and `HISTORY.md` both
describe a behaviour that never fires.

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

The fidelity ladder, source-resolution rules and measured implementation status
are now kept in [`LOD.md`](LOD.md). The non-negotiable correction is that
**manual OSM `building` and `building:part` geometry participates at every LoD
tier**. BAG/3DBAG is the measured Dutch foundation, not permission to flatten a
carefully mapped tower, wing, passage, courtyard or stacked part. Resolve the
sources into one owner per building; never draw overlapping representations.

Status: `main` has the complete OpenFreeMap/OSM extrusion fallback, a partial
10,578-building measured-colour overlay, and optional hosted 3DBAG LoD2.2 roof
geometry. `feat/lod1-building-city` has the unmerged complete 336,784-building
BAG-keyed LoD1 city, measured AHN heights and z14 streaming tiles (15 MB
gzipped). It is blocked by two comparison failures: its resolver sees only
colour-tagged OSM parts, flattening uncoloured manual compositions such as Magna
Plaza, and a roof percentile draws 201 tower-on-podium panden too low. Fix both,
rerun the comparison/e2e gates, then merge the LoD1 foundation. No signature
landmark GLB is integrated yet; `feat/signature-landmarks` is empty.

Do this as a gated progression rather than converting Amsterdam in one shot,
ordered **completeness before fidelity** — every step that makes more of the
city look like itself comes before any step that makes a few buildings look
better. This is a P2 item on a board whose P1 tier is the learning model, so it
will be interrupted; each step must be worth shipping alone.

1. **Fix the two measured LoD1 regressions.** Feed the resolver every OSM
   building and `building:part`, independently of appearance tags, and preserve
   manual compositions such as Magna Plaza. Then detect tower-on-podium panden
   instead of flattening them to the ordinary roof percentile. Pin both with
   named comparison fixtures.
2. **Ship the complete LoD1 city.** The city is gray because only 10,578
   buildings have appearance at all, against 336,784 BAG/3DBAG buildings in the
   staged drivable-area city — coverage, not fidelity.
   Publish a complete BAG-keyed footprint + 3DBAG height + measured roof colour
   source on the tile grid detailed geometry will later use, render it with
   ordinary fill-extrusions, and delete `building-3d`, `osm-colored-buildings`,
   `osm-colored-building-roofs` and the height-offset stack that keeps three
   coplanar extrusions from z-fighting. That stack is now partly defused rather
   than fixed: `basemapBuildingFilter` hides the basemap copy of any building
   the extract carries, which drops 136 of 1,189 basemap buildings in the centre
   and cuts co-located pairs from 145 to 47. The remaining 47 are held under
   different OSM ids by the two pipelines and still z-fight; one owner per
   building is the only real fix. Heights stop being guessed in the same
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

**10b. Amsterdam façade twin — pilot boundary reconnaissance (M0).**
The build prompt is [`AMSTERDAM_FACADE_TWIN.md`](AMSTERDAM_FACADE_TWIN.md);
measured findings are in [`FACADE_RECON.md`](FACADE_RECON.md). M0 is done for
RECON-1/2/3 on branch `feat/amsterdam-building-twin`: coordinate system pinned
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

> **P0, blocking everything street-level.** A 180° yaw error meant every façade
> measurement sampled the scene *behind* the survey camera. Fixed in `9220fd8`;
> the old outputs are quarantined in `.cache/facade-twin/quarantine-yaw-centre/`
> and a re-measurement is running. Massing is unaffected. Until the re-run
> lands, treat every street-level number in this file as void.

**Read [`FACADE_STATE.md`](FACADE_STATE.md) first.** It is the measured state of
the extraction — what is trustworthy, what is not, and the failure counts — and
it is kept current with the numbers rather than with adjectives.

### Where the twin stands today

Numbers are from the current staged extract; re-derive them rather than trusting
this paragraph if it is more than a few commits old.

| | |
|---|---|
| Buildings in the boundary | 3,025 |
| Massing (footprint, ground, eaves, ridge, roof form) | 3,025 — 138 at a fallback height |
| Front observed and measured | **1,340 (44.3%)** |
| No façade at all — drawn as bare massing | **1,685 (55.7%)** |
| Ceiling, from camera poses alone | 88.6% |
| Measured openings | 10,335 |
| Gable type stated by the register | 695 panden (23%) |
| Wall materials with an extracted texture | 6 of 12 |

**The gap between 44.3% and 88.6% is the single most visible defect in the
render, and it is not a bug.** A building whose front has never been photographed
gets no façade, by the rule the project turns on. It is bare grey massing with no
windows. Closing it is a measurement run, not a code change: `measure-facades.ts`
over the remaining ids. Everything else on this list is smaller than that.

### What the renderer draws, and how much of it is measured

Commit `416ffeb` moved the layer from "extruded footprints" to something that
reads as a canal house. The honesty boundary moved with it and is worth stating
plainly, because the layer now draws things nobody observed:

- **Measured, and reported as such:** footprint, ground level, eaves, ridge,
  roof form, opening positions and sizes, wall material and its colour.
- **Stated in prose by the register:** gable type, for 695 panden. Weaker than a
  measurement; coloured separately in evidence mode.
- **Drawn from the vocabulary, observed nowhere:** the gable *shape* on everything
  the register does not name, the cornice, the window joinery and sills. These
  carry `part: 'gable' | 'trim'` through the geometry so a renderer can drop them,
  and evidence mode paints them as generated rather than laundering them into
  the massing.
- **Deliberately withheld:** a building with no observed front gets `punt`, a
  plain triangle — the least any pitched roof can end in.

### Open defects found by looking at the render

Four screenshots found four bugs that months of reading JSON did not. Keep
looking at it.

- **`ground - 0.4` was not enough strip.** *(Fixed in `416ffeb`, not yet
  re-measured.)* The rectified strip started 40 cm below ground, which does not
  clear a souterrain. Its bottom edge cut through every basement window and front
  door and the detector clamped them to it: **1,020 of 10,335 openings sit at a
  sill of exactly −0.40 m**, which is the picture running out, not a measurement.
  The strip now starts 1.8 m down. **Everything measured before that change has
  a broken ground floor and needs re-running.**
- **Doors are essentially undetected.** 1,213 of 1,340 measured façades have no
  door-shaped opening at all; only 66 have exactly one. `measureFacade` already
  computes `groundOpenings` and the extract throws it away — openings reach the
  renderer as bare `[along, up, w, h]` with no kind, so every door draws as
  glass. Needs: carry the kind through, and re-measure on the deeper strip
  before judging whether the detector or the strip was at fault.
- **Textures exist for 6 of 12 wall materials.** `sandstone` (2 buildings) and
  `brick-purple-brown` (1) were skipped for want of samples. Both fall back to
  measured flat colour, which is correct but flat.
- **Only the front wall gets openings.** Fine in a terrace, wrong on a corner
  building, where the flank is a blank wall of brick.

**What actually blocks progress now, in order.**

1. **The overlay gate.** The massing draws — 3,025 buildings, 434k vertices, in
   the game's Three.js runtime via a MapLibre custom layer, verified by
   screenshot from the harness at `public/canal-drive/facade-twin.html`. What
   M1 still owes is the *comparison*: the brief's gate is "recognisable in
   overlay against reference", and the basemap toggle exists but has not been
   driven against a reference photograph at a fixed viewpoint. Also unverified
   inside the game itself — the harness proved the layer, not the wiring in
   `vector-map.js`.

1c. **Tier ownership is enforced coarsely.** When the twin is on, the 3DBAG
   tile layer and the basemap extrusions are hidden entirely — correct, because
   the twin and the tile layer are the same buildings from the same source, but
   blunt, because it hides them for the whole city rather than the boundary.
   Per-pand suppression needs the tile layer to filter by `pand_id`;
   `facadeTwinOwnedIds()` already publishes the 3,025 ids that filter will need.
   Masking by tile bounds is ruled out by `BUILDING_RENDERER_DESIGN.md`.

1d. **In-game rendering is still unverified.** The harness proves the layer; the
   wiring in `vector-map.js` has not been seen to draw. Both attempts failed on
   environment rather than code: a hidden tab throttles rAF to nothing (fixed in
   the harness with a shim) and the game's full basemap style — glyphs, sprites,
   vector tiles — does not finish loading in that tab even with the shim. Try
   from a foreground window, or point the game at a bare style for the test. The brief
   gates M1 — massing in-game, recognisable in overlay against reference —
   before measurement work, and every measurement bug found so far took
   paragraphs of prose to discover from JSON when it would have been obvious in
   five seconds of overlay. Next slice: the MapLibre custom layer drawing the
   3,025 records at LoD2.2 keyed by `pand_id`, `resolveFidelityTier` suppressing
   `detailed-buildings` inside the boundary so one representation owns each
   building, and the photo/render opacity overlay at two reference viewpoints.
1e. **There is no way to see a building's evidence from the render.** The
   fastest calibration loop available is: click a building, see the panorama it
   was measured from, the rectified strip, and the detected openings drawn on
   that strip, side by side with the model. Every artefact this needs already
   exists on disk — `.cache/facade-twin/measured/<pandId>.jpg` is the annotated
   strip, `measured-facades.json` holds the panorama id and capture date — and
   nothing surfaces them. Building this before the blind review is probably
   worth more than the blind review, because it makes every future defect
   visible in a click instead of a paragraph of JSON.

2. **No detector output has been validated.** *(Everything below still holds;
   coverage is now 1,598 buildings measured, 1,340 with openings, 44.3% of the
   boundary — which raises the stakes rather than lowering them.)* `check-facade-registration.ts` is
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

**And the part that is not canal houses.** The pilot's grammar is one fabric out
of six, and the rest of Amsterdam is mostly *not* this. The plan, in the order
the brief argues for and with what each actually needs:

- **19th-century belt** (De Pijp, Oud-West, Kinkerbuurt) — the highest-leverage
  tier and the one to do first after Centrum. Speculative *revolutiebouw* built
  these in long identical runs, so the same forms recur thousands of times and
  the detector's confidence calibrates well. It needs a new vocabulary — larger
  windows, cast-iron balconies, tiled tympana, shop *puien* under
  *bovenwoningen* — but the machinery is unchanged: the storey ladder, the
  opening detector and the plausibility rules are all fabric-agnostic; only
  `grammar.ts`'s constants are Amsterdam-canal-specific, and they are already
  isolated in one file for that reason.
- **Postwar estates** (Westelijke Tuinsteden, Bijlmer, Slotervaart) — cheapest
  per building and closes the most map. Flat façade grammar, so LoD2.2 plus a
  correct window grid and balcony rows is most of the way. The current detector
  should transfer almost as-is; what it needs is a panel-and-balcony vocabulary
  rather than a gable one.
- **Amsterdam School and interwar** (Plan Zuid, Spaarndammerbuurt) — the most
  expensive grammar per building and the one to do last of the big three.
  Parabolic arches, rounded corners, ladder windows and decorative bond defeat a
  rectangle detector, and RECON-2's finding bites hardest here: 3DBAG's roof
  reconstruction is weakest on exactly these forms.
- **Contemporary** (Zuidas, IJburg, Houthavens) — few buildings, simple forms,
  and curtain wall is a *regular grid*, which the bay-and-storey machinery is
  already good at. Mostly a materials problem.
- **Industrial and port** — LoD2.2 with correct materials. Do not gold-plate.

Two things generalise before any of that, and both are cheap now: `grammar.ts`
should take a fabric parameter rather than being implicitly Grachtengordel, and
`plausibility()`'s thresholds should be derived per fabric from the same
independent 3DBAG-storeys × AHN-eaves calculation that produced the canal-house
ones. Neither needs new imagery.