# Canal Recall — what is built

## Review harness: blank walls, per-bay rhythm, camera-matched sheets (2026-10-10)

- `glbQuality.ts` + `wallPlanes.ts`: walls ≥25 m² whose openings (enclosed
  holes on a 25 cm raster, or non-horizontal geometry within 0.5 m of the
  plane) cover <2% are `blank-wall` warns; ≥600 m² fails, because a GLB alone
  cannot tell a party wall from a blank one (`blankWallExemptBearings`). Full
  audit: 167 of 247 landmarks have ≥1 blank wall (1,216 walls, 34 ≥600 m²);
  the warn list is noisy where glass is coplanar with the wall.
- `facadeCompare.ts` gained `bays`, `identicalBays`, `bayRows`, `baySymmetric`.
- `npm run review:sheet -- --id=<id>`: per exposed BAG wall, the best
  panorama rectified with the repo's own camera model, a GLB render from that
  panorama's pose, a 50% overlay, red INFERRED tiles for walls with no photo,
  and an in-game shot. Needs a catalogue entry (not ordinary houses yet).
- Het Pakhuis row count: two blind counts disagreed (7 vs 9); integrator
  recount from the photo is 9 (gable 2 tiers, 5 storeys, ground floor 2
  tiers). Bay 0 (louvre strip, glass box) and bay 4 (glass balustrades) differ
  in the photo, so only bays 1–3 are asserted identical. v2 passes all checks.

## Street chunks pilot: no-go as a performance change (2026-10-10)

`src/canalRecall/streetChunks/` compiles one mesh per block face (15 of the
19 Bilderdijkstraat recipe houses → 4 chunks), one street level, eaves within
0.25 m snapped to one cornice, party walls trimmed where a neighbour covers
them, per-pand BAG id/address/triangle ranges in glTF extras so hover and
suppression still resolve each pand. Measured: triangles 27,581 → 27,570
(party walls are 2 tris per quad), draw calls 121 → 58, GLB requests
13 → 4, layer CPU 0.57 → 0.42 ms per frame (Mac, iPhone emulation similar);
frame time unchanged (vsync-capped). Renders match the individual houses
except storeys shifted ≤0.4 m by re-grounding. Kept opt-in behind
`?streetChunks=1` (`ordinary-buildings-data/chunks.json`); the visual win
(continuous ground and cornice line) does not need chunking. Unmeasured on a
real phone GPU.

## Zuiderkerk, Muiderkerk, Van Gendt Hallen; Palace and De Balie reworked (2026-10-10)

Zuiderkerk replaces its procedural kit (the kit's OSM tower and roof ways are
now in the model's suppression list; in-game shot shows one tower). The
tower is 66 m by the photos, not the 79 m in the brief; the nave was sent
back once for house-like square windows and now has tall stone-framed
traceried windows. Muiderkerk (1892 tower front before a 1997 office
block). Rework from the facade-gate audit: the Royal Palace Dam front now
has its 21 axes, risalit, seven entrance arches and two storey groups; De
Balie is pale stone with stepped gables (the photo shows two storeys over a
basement); the Concertgebouw has its three arched doors. Vincentiuskerk
was demolished in 1989. The "Zuiderkerk Tower" POI is covered by the
church model.

## Facade comparison gate; Thomaskerk and Vrijburg; queue triage (2026-10-10)

Het Pakhuis passed review with scattered windows on a front the photo shows
as five symmetric gabled bays, so "looks roughly right" is no longer
acceptance. `npm run compare:facades -- --id=<id>` renders each declared
facade of the GLB orthographically (material z-buffer; `glass` and `dark` on
viewer-facing faces count as openings), boxes the openings, and compares
openings per storey, window axes, mirror symmetry (IoU) and silhouette peaks
with `<id>-elevations.json`, counted blind from the reference photo. It
writes photo | elevation images per facade. On Pakhuis's rear it measures 9
axes and symmetry 0.28. Calibration on 25 installed landmarks: blind counts
by Haiku on oblique, obstructed panorama thumbnails were too noisy to gate on
(every facade carried an obstruction note), so the counts stay out of the
committed specs; the side-by-side images were the useful output and found
the Royal Palace (no central risalit, no entrance arches, uniform grid) and
De Balie (red brick and two storeys; the building is pale stone, three
storeys) as clear misses.

Installed after contact-sheet and elevation review: Thomaskerk (Sijmons
1966) and Vrijburg (Diepenbrockstraat, 1931–33). Willem de Zwijgerkerk
was held for its missing entrance wing and installed after rework; Van Gendt
Hallen likewise (segmental-arc gables with corbel friezes following the
arc, steel windows; the integrator first misread the arcs as 3DBAG
artefacts and asked for triangles — the photos win).
The OBA libraries, CEDLA, Max Euwe Centrum and Bijzondere Collecties are
rooms in ordinary buildings, Elthetokerk was demolished in 1992; these and a
Haiku triage of the review queue (duplicates, sculptures, areas) live in
`scripts/landmarks/backlog-triage.json`. User-requested venues stay open.
The source archiver now collects `artifacts/landmark-lanes/<id>/ref*`, and
ten recent models were backfilled to the private source repository.

## Het Pakhuis v2 built from a rhythm spec, still held (2026-10-10)

`scripts/haparandaweg/het-pakhuis-rhythm.json` cites a photo for every bay
item; the block-kit spec now places five identical gabled bays, the HET
PAKHUIS band, a double-height glazed ground floor and balcony storeys.
Audit score 17.8 (see-through) → 0.9 pass; height Δ 0.28 m; 2,798 tris.
Held for user review: rear wall inferred (enclosed courtyard, no photo),
balconies 0.95 m vs ~1.2 m to avoid a hull see-through false positive,
lettering lighter than the photo, facade-compare row count 9 vs 7 (the
ground floor and gable window are split glazed fields). The lane's first
version rewrote `rail.kind: 'bars'` and silently changed 870-900 on rebuild;
thin rods are now `'rods'`, and `test:block-kit-installed` (in check:canal)
rebuilds every block-kit spec and requires byte-identical installed GLBs.

## Recipe surrounds, quoins and awnings (2026-10-09)

Intent fields `windowSurround` (stone-lintel / full-frame / keystone, optional
`surroundStoreys`), `quoins` and `shopfront.awning` (straight or dutch, extent
as a fraction of the front). Dressings are slabs sunk 5 mm into the wall
(tested ≤1 cm off the plane); awnings are one extruded profile on the flat
door slot so they are not brick-textured. Applied only with photo evidence:
keystones on bilder-152669/153622/153782, top-storey lintels and a black
awning on bilder-156287; +92–144 triangles each, all gates pass. Reviewing
156287 against its photo exposed that the house itself is wrong (storeys,
window size, balconies); see TODO re-review.

## Acceptance checklist after Nassaukerk and Het Pakhuis (2026-10-09)

Nassaukerk passed review twice with blank walls, and Het Pakhuis shipped with
scattered windows where the building has five identical symmetric gabled bays.
Both were judged from one photo by overall resemblance. The checklist in
`docs/buildings-pipeline.md` now requires a per-wall rhythm spec from photos
before modelling, a photo per visible face (else "inferred"), camera-matched
photo/render comparison bay by bay, the blank-wall and facade-rhythm gates,
and a street-level shot; lane-reported uncertainty blocks a merge. Het Pakhuis
is held until a rebuild passes it.

## GLB quality audit; Nassaukerk windows (2026-10-09)

`audit-glb-quality.ts` checks every landmark GLB for open shell holes,
street-height see-through rays, detached parts, far-outside and below-ground
geometry, inverted roofs and triangle caps (synthetic fixtures in
`glbQuality.test.ts`). First full run: 184/236 flag something; the noisiest
check is detached parts, because recessed glazing and a floating facade look
alike geometrically. A lane audit flagged Theo Thijssen and Torture Museum,
but it had audited pre-rework GLBs; the current ones pass. Nassaukerk (user:
"missing a bunch of windows") now has arched windows on all four gables,
five tall arches and an arched door on the SE arm, low-wall squares and the
re-entrant bay lights; louvre frames and clock discs that floated were fixed.

## Bilderdijkstraat: first street built from recipes, in the city look (2026-10-09)

19 houses drafted from rectified panorama crops (~33 s per house from
reference to first all-pass compile) and placed via shared-mesh instancing
(17 meshes; mirrored instances flip winding; reference-counted cache). The
first pass looked worse than the procedural neighbours (near-black brick and
glass, flat roofs, 3DBAG roof spikes). `recipeLook.ts` now gives slot-tagged
recipe materials the city's own shader (Bricks057 with coursing, reflective
glass, pantile/slate textures, photo colours mapped into the city palette);
new intent fields `archedStoreys`, `crownCapSpan`, `archRings`,
`palette.band`; real shopfronts; `roofCleanup.ts` clamps small raised 3DBAG
clusters and hips ridges run out to cornice fronts. Integrator review at
street level: 10 houses better than their procedural neighbour, 9 the same.
Phone ride perf unchanged (anisotropic filtering off on touch: it raised p95).

## Haparandaweg: eight more blocks, four installed (2026-10-09)

User asked for every building on Haparandaweg. PDOK BAG lists 17 panden; 6
were modelled. A new typed block kit (`src/canalRecall/blockBuilding/`,
tooling `scripts/haparandaweg/`) puts per-building facade systems on exact
3DBAG LoD2.2 walls and roofs (2.0–5.1k tris, heights within 0.3 m, all parts
within 5 cm). Installed after integrator review: Het Pakhuis (902–950,
sawtooth gables + lettering), 746–786, 870–900, 952–1002. Held: 65 (reads as
plain grey render), 650–706, 708–744, 788–868. Skipped: 582–648 (only
scaffolding in panoramas), 940–950 (no tile/panorama), 444–576 (permit only,
not built). These models are not built by `build-manual-landmarks.ts`, so
their manifest entries were added from the catalogue.

## Club Panama and West India House to the bar; held models off What's new (2026-10-09)

The near-bar lane rebuilt three rejected shells from panoramas. Installed
after integrator review: Club Panama (quay front was the south wall, not the
north one decorated before: six arched bays with black awnings, wheel-window
gable, clerestory, red rooftop PANAMA sign) and West India House (the real
Herenmarkt front is the grey-plastered pedimented north front, not brown
brick; slate-coursed roofs; 3DBAG sliver spike removed). Compagnietheater
stays held (wing windows faint, colours too brown). `whats-new.html` read
every manifest entry, so held models were still advertised there; the
builder now flags `held` in `signature-landmarks.json` and the page skips it.

## Floating facades: two shared-builder bugs (2026-10-09)

Torture Museum and Theo Thijssen floated their facades because
`museums2-shared.ts` placed `facadeFrame` on the BAG footprint edge, which
sits 0.1–0.7 m off and slightly rotated from the 3DBAG shell wall, and
`surveyShell` dropped the last vertex of every 3DBAG ring assuming rings were
closed (they are not), deleting a real roof/wall corner. `wallFrame` now picks
the wall from BAG but fits the line through the 3DBAG ground edges; the
shell keeps unclosed rings. `scripts/check-facade-attachment.ts` fails any
part more than 5 cm from the shell (transitively). Theo Thijssen re-installed
after review; Torture Museum stays held (sign and shopfront only suggested);
Pathé rebuilt with the fix, still held for user review. The GLB builder now
reads `ALL_MANUAL_LANDMARKS`, so held models can be rebuilt.

## Home destinations remember where you went (2026-10-09)

After the `#race=` replay fix, a lane measured the home picker on the real
pool (353 POIs, Da Costakade 13): no single POI dominated (top share 3.8%
empty history, 1.1% practised), but nothing remembered past destinations, and
with Plan review on, `pickReviewRoute` from a fixed home is near-deterministic
(most due names, then within 1.3× of shortest) — the likely repeat for a
signed-in rider. Also the first pick ran before the Firestore history pull.
Now: `recentDestinations.ts` keeps 12 per city+home (localStorage); the last
destination is never repeated and the last 8 are down-weighted; review rides
prefer pairs avoiding them; closeness is flatter (1/(1.2+km)) with a 12% share
cap; `recallStore.historyReady(1500)` is awaited with the home geocode.
20 consecutive launches: 19–20 distinct, never the same twice in a row.

## The game kept replaying the last route on launch (2026-10-09)

User: the signed-in prod game picked Da Costakade → De Dolphijn "EVERY time".
The home picker is weighted-random with novelty from mastery samples; it never
ran. Every ride wrote `#race=centre,start,finish` into the address bar with
`history.replaceState`, and `_checkShareLink` replays any `#race=` on load,
bypassing the menu and picker — so reloads, restored tabs and autocompleted
URLs replayed the previous route forever. The hash now lives only in the
copy/share URL, and a consumed share link clears itself.
`tests/e2e/race-hash-not-sticky.spec.ts` pins both.

## Bike ferries across the IJ (2026-10-09)

The `feat/bike-ferry-crossings` work (built 2026-10-07/08, ~15k lines left
uncommitted in its worktree, 138 commits behind) was snapshotted to
`wip/bike-ferry-snapshot-20261009` and ported. Cycling routes may use GVB
F1–F9: ride onto a terminal access toward the water to become the ferry,
steer across, dock at a connected pier and return to the bike on its land
access. On current main the Centraal F3 stop sits on the quay, so boarding
became "within 3 m of the stop, moving, heading within 60° of the nearest
rendered water (≤30 m)" in typed `ferry/travel.ts`. Ferry and access segments
carry `name: ''` plus a display `label`, so they never become street
questions, distractors, novelty or spoilers; `road-network.js` blanks their
geometry (`landOnly`) instead of filtering, keeping segment indexes valid.

## Sculpture splat pilot: De Dokwerker, no-go as-is (2026-10-09)

COLMAP 4.2 (CPU) on 278 Commons images registered 214 (0.6 px), Brush 0.3
(Metal) trained in ~10 min, cropped to 24k gaussians, SOG 320 KB via
splat-transform, rendered with Spark 2.3 in `sculpture-splat-demo.html`
alongside a 13-view impostor and the hand-built GLB. The figure reads from
every side but is ghostly and the plinth smears: the photos are mostly
1950s–80s black-and-white scans with crowds, only ~12 modern colour shots
from one viewpoint, bronze is textureless, and nothing was masked. City
panoramas are useless (28–36 m away, ~25 px tall). Impostor linear blending
doubles the figure between azimuths. Tooling kept in `scripts/sculpture-splat/`.

## Two churches under the raised bar (2026-10-09)

After the held batch, the churches lane was told "recognisable next to the
photo or skip". It installed Sint Olofskapel (massing rebuilt from BAG
corners because 3DBAG's roof slabs were wrong; pointed tracery, 1644 portal,
bell turret) and Nassaukerk (3DBAG shell, but the needle-like 3DBAG tower
replaced with the photo's louvred shaft and green cap; street gable with
three arched windows and canopy), withdrew Thomaskerk itself, and skipped
Muiderkerk/Elthetokerk/Vincentiuskerk. The integrator viewed all sheets and
held Koningskerk (grey shell, curved concrete grid hall missing).

## Large-building tier replaces bare boxes (2026-10-09)

The user spotted big flat-coloured boxes (e.g. the Anne Frank House museum
building on Prinsengracht). Cause: `exceptLandmarks` in `roofMesh.ts` gave a
listed landmark without a kit/model the house facade only if pre-1945 and
≤26 m — a 2026-10-03 rule so Carré and the Oosterkerk would not read as
nine-storey flats — and drew everything else bare. 118 such buildings
(260k m²) city-wide. `largeBuildingTier.ts` now gives them a facade by BAG
era (taller storeys, one entrance per street run, parapet + cornice, real
shops from the shopfronts extract, grey flat roofs), reusing the merged
per-tile meshes: ~68 triangles each, +18.7k city-wide, no new draw calls.
Six visible ones are hand-tuned from panoramas (`LARGE_TIER_OVERRIDES`).
Reviewed by the integrator at Westermarkt, Keizersgracht and Singel.

## Seven landmarks held back after review (2026-10-09)

The user flagged the second batch: facades floating off their shells (Torture
Museum, Theo Thijssen), a grey lump (Pathé de Munt), wrong tower and dark
render (Petrus en Paulus), and bare 3DBAG massings. The integrator had merged
on lane reports after viewing only 3 of 12 contact sheets. Rather than delete
work, the catalogue gained `status: "held"` (+ `heldReason`), filtered in
`manualModels.ts`, so a model leaves the game and galleries and returns to the
backlog as pending until it passes review again.

## Canal elevation behind a flag; earlier street questions (2026-10-09)

`?elevation=1` sinks canal water 1.77 m below the quays (median measured
approach of 143 canal-belt bridges, +1.37 m NAP, minus the −0.40 m NAP water
reference), draws brick quay walls through a stencil window shaped like the
water, and humps 729 AHN-measured bridge decks (891 more municipal bridge
footprints get flat decks). Land stays at z = 0 so no building, tree or model
is re-based; the old `feat/amsterdam-basemap-elevation` replaced MapLibre's
terrain through private APIs with ~750 MB of data. Visual only; ride-perf
unchanged with the flag on after merging meshes per 1 km cell.

The "which street" question waited a fixed 0.65 s, ~33 m at cruise — most of
the 40 m Noordsche Compagniebrug (Herenstraat over Keizersgracht). It now also
opens after 8 m heading along the new street (4 m for re-tests), resetting
whenever the name under the bike changes, so it never asks about a street the
rider left. "You made a turn" only above a 30° heading change. Asks dropped
from 17–34 m to 8–9 m in; pinned in `turn-question-timing.spec.ts`.

## Per-pand reference feed (2026-10-09)

`scripts/pand-reference/` picks a building's street wall (longest exposed,
nearest road, 6 m road-distance buckets so the front beats the rear), lists
all panoramas within 35 m, prefers 8–25 m and low obliquity with an alternate
from a different mission year, swaps in the alternate when the primary is
washed out (scaffold sheeting) or leaf-green, and writes a rectified crop +
aimed thumbnail + facts (`reference.json`). Marnixstraat: 8/8 usable (3
scaffolded 2025 fronts auto-swapped). Bloemgracht 78–90: 4/7, trees.

## Intro flight: stop city-wide streaming during the overview (2026-10-09)

The route overview → rider flight took ~8.6 s to control (iPhone, 4x CPU)
against ~2.3 s without it. Hypothesis "the overview builds 3D buildings" was
wrong: extrusions/three.js draw nothing below z14 and the overview is ~z13.4.
A streamer trace (`tests/e2e/intro-trace.spec.ts`) found four leaks:
signature landmarks loaded ~70 models city-wide (12 ms each, and each kept the
map from going idle so the settle wait hit its timeout); building tiles were
planned by `jumpTo`'s synchronous `moveend` before suspension; the 600 m
landing box straddled z14 corners and doubled the resident set before
take-off; trees were cleared and rebuilt. Now the streamers suspend before
the jump, the landing area is the captured driving view
(`introLandingArea`), and landmarks/trees have `setSuspended`. Medians of 4:
control 8570 → 7133 ms, pre-flight long tasks 1607 → 641 ms, worst frame
733 → 442 ms, 7.6 → 5.4 MB; landing screenshots show no pop-in. Capping the
overview at neighbourhood scale was also prototyped and showed no gain.

## Twelve more landmarks from the backlog (2026-10-09)

Three Sonnet lanes worked the "Needs work" queue: Keizersgrachtkerk, Gerard Dou
Synagogue and Lekstraatsynagoge (salvaged from earlier unmerged drafts),
Sint-Petrus-en-Pauluskerk and Maarten Lutherkerk (new, on a shared 3DBAG
LoD2.2 shell builder `worship-shell.ts`), Torture Museum, Theo Thijssen
Museum, Pathé de Munt, Houseboat Museum (a hull on the houseboat extract way),
Museum Amsterdam Noord, Levend Paardenmuseum and the Oudemanhuispoort
gate-house. Lanes took 70–150 min for 3–5 buildings each, including writing
reusable tooling (`museums2-*`, `civic-kit.ts`, `worship-*`). Skips and
follow-ups are in TODO. `check-building-facts` waited a fixed 20 ms for an
async gunzip and failed 3 in 5 runs under load; it now polls.

## Recipe pipeline for ordinary houses lands; Marnixstraat at ~8 s a house (2026-10-09)

Codex's unmerged canal-house component library (`wip/canalhouse-recipes-20261008`)
is on main with a new typed intent recipe (`src/canalRecall/buildingRecipe/`,
`scripts/building-recipes/`, `docs/buildings-pipeline.md`). An LLM writes ~30–80
lines (gable, storeys, bays, door, cornice, roof, palette; no coordinates);
facts come from one 3DBAG call per building; gates check the decoded GLB
(≤3k tris, BAG footprint overlap ≥0.9, eave/roof within 0.3 m of 3DBAG, no
floating parts). The held roof problem is fixed by using the 3DBAG LoD2.2
planes directly (Bloemgracht 78–90 regression). Reuse: `sameAs` + overrides,
shared meshes for same-design houses within ±0.3 m, `repeat` along a front;
GLBs carry metre UVs and material slots for a future shared texture set.

Measured: Marnixstraat 124–138 (5 parents) in 39 s total, one drafted recipe
and four `sameAs`, four sharing one mesh. Bloemgracht reads convincingly as
canal houses; Marnixstraat is plausible but generic (crowns should be stepped
gables, no brick banding); Keizersgracht 569–575 at 8.5k tris is far plainer
than its hand-built model, so distinctive buildings stay in the large/icon
tiers. Nothing installed in the game yet: the ordinary layer needs instancing
from `instances.json` and the material-slot texture set.

## Nine landmark drafts installed in one afternoon (2026-10-09)

Three Sonnet lanes finished the drafts earlier sessions left uncommitted:
Uilenburger Synagoge, Nieuwendammerkerk, Meerpadkerk (~25 min for the
lane), This is Holland, Luther Museum, Huize Frankendael (~50 min), Hannekes
Boom, Posthoornkerk and Haparandaweg 57 (~1.5 h). Acceptance used the lighter
process: geometry check, POI contract, and a contact sheet (reference |
front | 3/4 | in game) reviewed by the integrator, with one batch deploy
instead of per-building review agents. This is Holland's foyer glass went
from alpha 0.18 to 0.3 (the exporter now honours `materialOpacity`
generically); Luther Museum dropped hidden trim faces (26.6k → 14.6k tris).
UvA Roeterseiland stays held (see TODO). The haparandaweg-57 "corrected
candidate 4ba9134c" was a GLB hash prefix, not a commit.

## What's new page, and trees stop rebuilding every frame (2026-10-09)

`whats-new.html` is the landing page for finished buildings: hero counts, a
day-grouped feed with lazy 3D turntables (one shared renderer, at most three
GLB loads, disposed off-screen), an "In progress" strip from the work queue,
and links into each gallery and the game. "New" means first installed:
`scripts/build-model-first-added.ts` writes `models/model-first-added.json`
from git history, because `model-dates.json` changes on every re-export.
Rerun it (`npm run build:model-first-added`) after installing models.

The game calls `jumpTo` each frame, so `moveend` fires each frame. Inventory
trees rebuilt every instance on each one. They now build for a padded area
(`src/canalRecall/viewResidency.ts`) and rebuild only when the view leaves it.
Ride perf (iphone, 4x CPU): moveend handlers 4.5 → 0.7 ms median, frame p99
33.4 → 16.8 ms, JS heap 532 → 398 MB (`tests/e2e/ride-perf.spec.ts`).

## Root worktree landed and branches integrated (2026-10-09)

Earlier agent sessions left 44 modified and ~420 untracked files in root.
The whole tree was first preserved as `wip/root-dirty-20261009` (pushed),
then lifted onto `main` as topical commits. `firestations-native-20261009`
(13 fire stations, Weesp GPS origin) and `ordinary/next35-20261008`
(Prinsengracht hospital, Keizers 569–575, Brouwers 1/Singel 26, Leidsestraat
67/Kerkstraat 50) merged normally; `poi-work-queue.json` was merged by task
id (189 tasks, no per-task conflict) and every generated bundle was rebuilt
from merged source rather than hand-resolved. Several committed bundles had
been stale (the Weesp viewbox had not reached `game-recall`).

Snapshot residue that was older than main was dropped on purpose: model
metadata with lower triangle counts and earlier dates for REM-eiland,
Klimmuur and MidWest; removal of `galleryView` in `manual-landmarks.html`;
a duplicate `_syncHostWallOpenings()` call. Ten landmark drafts were
committed as source only, not installed. 33 dead worktree records pruned.

## Courtyard complexes, civic landmarks and six tree crowns: 106 original landmarks (2026-10-04)

The Amsterdam Dungeon replaces its two verified building parents: the chapel
and the Rokin entrance block. Its octagonal chapel, tent roof and open lantern
remain distinct from the lower entrance rooms. The neighboring retail parents,
including the separate corner dome, remain visible.

Sint Jorishof retains its exact concave courtyard plan, separate roof heights,
white sash windows and photographed 1747 courtyard tablet. The entrance follows
the mapped alley's intersection with the surveyed perimeter; its lower roof
profile is checked against the local survey region. The small cupola position
and simplified detail are explicitly inferred from primary photographs and
a tiny raised survey roof, rather than claimed as an exact reconstruction.
Oost-Indisch Huis and Waalse Kerk remain separate models.

Waalse Kerk replaces only its five exact parent/part identities after its GLB
loads, including three resident procedural-kit roof ranges. Schreierstoren has
its pointed tower roof and clipped annex, with contradictory scalar and detailed
survey heights documented. Huize Lydia preserves its open U-shaped courtyard,
curved bay and individual roof forms. Dense front/rear game reviews check native
scale, loaded neighbors, highlights and absence of broad footprint suppression.

Six verified species/cultivar rules change 3,127 crowns: Liempde willow,
cut-leaf alder, serviceberry, Sunburst honey locust, Sapporo Autumn Gold elm and
Raywood ash. Explicit pruning continues to override the new shapes for 260
managed trees. Inventory positions, heights and tiles remain unchanged.
Before/after crown galleries and mobile park streaming/toggle checks passed.

Brasapark now hides only below-ground motorway/link features intersecting its
mapped boundary while its landscape is visible. Surface roads and other tunnels
remain; original filters return when the landscape is disabled or the view leaves
its zoom range. Four actual game views and vector-tile fixtures verify the
A9 tunnel disappears below the park without removing its surface roads.

## Canal museums, three venues and compact parks: 101 original landmarks (2026-10-04)

Hash Marihuana & Hemp Museum and Hemp Gallery are separate original meshes
at their actual Oudezijds Achterburgwal addresses. The narrow three-bay red
museum facade retains its triangular top, while the gallery occupies the
five-bay 128–132 neo-Renaissance block. Current survey roof regions keep lower
rear rooms below the taller fronts. The Sensi Seeds neighbor and all adjacent
houses remain separate; four immediate neighboring parents were verified
resident and unsuppressed in the actual game.

Het Veem models the yellow Oranje Nassau warehouse, castellated hoist towers,
rear gables, stair turrets and daylight roof; the neighboring red Koelit
warehouse remains separate. Tobacco Theater keeps its yellow-brick office
front and lower rear halls. Plein Theater models its actual shared white
residential building and low theatre wing, including the curved lower porch.
Current survey roof envelopes keep the porch out of the tall housing volume.
Review corrected canonical BAG suppression aliases, preventing generic parent
geometry remaining visible underneath the meshes. The suppression check now
rejects unsupported identity formats. All three corrected venue replacements
passed dense front/rear review; Plein’s eight neighboring parents were
verified resident, drawable and unsuppressed after local chunks finished.

Madame Tussauds models the entire shared Peek & Cloppenburg parent: stone
Dam and Rokin facades, colossal pilasters, central rose-window gable, slate
hip roofs, dormers and decorative roof vents. The exact L-shaped plan keeps
its rear recesses and lower inner rooms. Current address records confirm
three VBOs belong to the same parent; adjacent buildings remain separate.

Five existing public green spaces add 238 mapped features: Oeverpark, the
three Frederik Hendrikplantsoen parts, Eerste Weteringplantsoen, Bilderdijkpark
and Wibautpark. Main landscape totals 10,771 features (5,433,622 raw bytes /
987,093 gzip); all previous 10,533 features and optional Bos remain exact.
The actual Eerste lawn hole is retained. No inferred lawn fill was added.
The picker has 51 main selections plus Bos. Tweede Weteringplantsoen is
excluded while its documented redevelopment remains underway. Source,
streaming, seven-part gallery, actual-game, mobile and toggle checks passed.

## Courtyard university, iron bandstand and eight parks: 95 original landmarks (2026-10-04)

Oost-Indisch Huis/Bushuis now uses its exact shared parent outline, one open
courtyard and reentrant perimeter notches. The 23-axis Bushuis canal facade
has three stepped gables and a taller roof; the older courtyard wings have
lower roofs and an inward Renaissance gable aligned with the mapped door.
Current BAG/3DBAG measurements and primary heritage photographs guide the
original geometry. The separate Waalse Kerk parents remain untouched. A wider review verified the
large adjacent Sint Jorishof mass is disjoint and retains its own identity.

Vondelpark Muziektent replaces the closed generic cylinder with ten open
iron columns, railings, nine entrance steps and a shallow tent roof with a
small finial. The steps face the existing footbridge; island, bridge, water
and trees remain mapped landscape. AHN samples constrain roof height, while
the thin finial and decorative proportions remain visual approximations.
The non-realized BAG record is documentary evidence, not a suppressed alias.

Eight additional public park selections add 768 mapped features: Brasapark
Noord/Zuid, Natuurpark Vrije Geer, Park de Schinkeleilanden, De Oeverlanden,
Lange Bretten and Spoorpark Noord/Zuid. The main dataset now has 10,533
features (5,335,782 bytes raw / 972,842 gzip); all prior 9,765 features and the
optional Bos chunk remain byte-identical. The picker has 46 main selections
plus Bos. Existing access restrictions, allotments and source holes remain;
future Spoorpark Midden is excluded. Source, streaming, gallery, live-game,
mobile and toggle checks passed. Both new meshes passed geometry, life-size
placement, highlight and exact suppression checks in the actual game.

## Canal heritage, stages and six more parks: 93 original landmarks (2026-10-04)

Herepoort / Bergpoort models the paired Rijksmuseum garden gate, with a truly
open ground-level arch, sandstone front columns/niches and a taller brick/stone
reverse. The museum publishes different facade heights, 6.7 m and 8.5 m; the
current BAG roof maximum supports the taller silhouette. No museum, separate
garden pavilion, fences, trees or landscape are replaced. Reliefs and roof
proportions are original visual approximations.

Huis aan de Drie Grachten keeps its three stepped gables, transverse roof,
canal-side walls and red shutters; review removed an unintended rear roof fin.
De Dolphijn keeps both restored Renaissance facades within the same current
BAG parent (Singel 140/142), leaving the distinct Singel 138 parent untouched.
The final front faces the actual Singel, while its surveyed rear notch remains.
De Rode Hoed models the canal houses and concealed church behind them.
Theater Amsterdam includes its glazed foyer, broad canopy and dark hall.
Vondelpark Open Air Theater uses the documented trapezoidal podium and an
original curved canopy approximation; its technical lighting-grid dimensions
are distinguished from the unmeasured canopy envelope. The separate bandstand
and park remain visible.

Six additional public parks — Houthavenpark, Bella Vistapark, Park Somerlust,
Siegerpark, Eendrachtspark and Schellingwouderpark — add 286 mapped interior
features. All previous 9,479 features remain exact; the base now contains
9,765 features (4,915,267 bytes raw / 892,045 gzip). The optional Amsterdamse
Bos chunk remains byte-identical at 3,254 features. The picker has 38 main
selections plus Bos. Source checks verify original geometries and no duplicate
new path edges; gallery, actual-game and mobile/toggle reviews pass.

Four exact species rules refine 2,978 crowns, keeping 30 managed records and
existing river-birch brown bark unchanged. Five further exact elm/ash/lime
priors refine 3,229 crowns, preserving 50 managed records; unnamed or differently
named lime varieties retain their existing behavior. All inventory positions/heights and
unmatched records remain exact. Sixteen crown forms and the seven-draw,
four-geometry, two-material budget remain intact. Browser reviews compare the
new asymmetric/upward crown choices at the same height. A complete municipal
source comparison found no height-field/unit mismatch. Height metadata now
accurately describes bounded-range midpoints, the up-to-6 m class rendered at
6 m, 24 m-plus rendered at 27 m and the 9 m unknown fallback; no heights or
tile files changed.

All 93 models pass decoded geometry, material, compression, life-size placement
and exact-ID suppression checks. The queue has 289 entries: 98 original model
entries, 12 imported references, 18 procedural kits and 161 pending tasks.

## Concealed chapels, community venues and tree visibility: 87 original landmarks (2026-10-04)

Begijnhofkapel models its actual shared house/church parent, two bent three-bay
fronts, arched Empire windows and projecting stone portal; the English Reformed
Church and other courtyard houses remain separate. Houten Huys retains its
narrow timber gable, projecting upper front, white masonry base and leaded
windows. The current 3DBAG height controls the roof; side/rear details are
simplified. Conflicting historical construction dates are recorded in its
source file rather than presented as a verified oldest-house claim.

Huis De Pinto adds its pale five-bay facade and actual rear wings. Amsterdam
Tulip Museum uses its current combined straight-parapet building and shopfront.
OT301 includes its older brick entrance and separate glazed school frontage;
Filmhuis Cavia uses the three registered school parents while preserving open
courts and the separate residential gateway. Orgelpark includes its steep
church roof, documented needle height and same-parent kosterij. Final visual
reviews corrected Cavia windows above the lower gym roof. All 87 assets pass
decoded geometry, compression, material, life-size placement and exact-ID
suppression checks.

An active-game Tulip review exposed a generic-building north-axis scale error:
local meshes used 110,540 metres per degree, while their Mercator transform
applied the spherical equatorial metre. It displaced the preserved neighboring
facade about five metres south. North-axis compensation fixes that alignment
without suppressing the neighbor, moving signature anchors or changing heights.
Independent Mercator regression checks cover the museum, neighbor, Pinto,
Silodam, Willet-Holthuysen and city bounds; the remaining origin-linear
curvature is explicitly bounded. The queue now has 289 entries: 91 original
model entries, 12 imported references, 18 procedural kits and 168 pending tasks.
English Shipping House / Maritime Museum aliases now match existing coverage.

Trees now honor their saved preference in all four game views. The visible
Trees setting, fresh desktop/mobile defaults, saved-off behavior, view switches,
low-zoom cutoff and city cleanup pass actual-game checks. Six further exact
species/cultivar rules refine 4,968 fallback crowns, distinguishing open honey
locusts from denser Skyline cultivars and tapering alder, holly and Greenspire
lime. All 311,544 records retain positions/heights; ten managed target records
remain unchanged. Sixteen forms, seven draws, four shared geometries and two
materials remain the rendering budget. These browser checks do not measure
real-phone performance.

The park audit reviewed Sarphatipark, Vondelpark and Wertheimpark in north and
chase views: mapped lawns, paths, ponds and benches remain readable, with
default visibility and toggling intact. Actual MapLibre-projected path widths
match mapped metres within 0.3%; no speculative path-width change was made.

## Canal museums, bookshops and a memorial: 80 original landmarks (2026-10-04)

Willet-Holthuysen models its five-bay classical facade, double stoop, two
dormers and mapped rear service wings; its separate French garden remains open.
Amsterdam Pipe Museum keeps its narrow two-window house front, stoop and actual
courtyard notch. Athenaeum/Nieuwscentrum models their shared physical parent,
with the pale corner and brick section separated to avoid coplanar stripes.
Scheltema keeps the full Rokin shop frontage, upper facade over the recessed
entry and blue awnings. Haarlemmermeerstation retains its low annexes,
mansard/dormer roofs and correctly sized canopy sign. Active-game frontage,
opposite-view and neighbor reviews corrected duplicated windows and wall/sign
geometry before completion.

De Dokwerker adds an original faceted bronze-colored figure on the exact mapped
memorial node. A published UvA illustration records a 1.60 m pedestal and
2.60 m statue; pose divisions and southwest facing are visual approximations.
No plaza or host-building geometry is replaced. The gallery now fits each
bounding sphere to the narrower camera field of view, so tall statues and
towers are fully visible in the first view. All 80 assets pass decoded geometry,
actual file-size, life-size placement and exact-ID suppression checks. The
queue has 290 entries: 84 original-model entries, 12 imported references,
17 procedural kits and 177 pending tasks.

Two exact six-taxon tree batches refine 7,692 generic crowns using existing
columnar, vase, oval and pyramidal forms. Exact river birches gain brown bark
(789 unpruned records); purple plums and copper beeches gain muted canopy color
(1,098 unpruned records). Whole-inventory comparisons preserve all positions,
heights, unmatched and explicitly pruned records. A coordinate-convention fix
aligns anisotropic lobes with their rotated centers, making trained-flat crowns
one screen instead of a crossed canopy. Real THREE matrix checks cover ordinary
lobes and byte-identical existing palm transforms. Before/after galleries,
mobile Chromium park/toggle checks, instancing/culling and streaming checks
retain 16 forms, seven draws, four shared geometries and two materials.

## Two churches, local venues and ARTIS heritage: 74 original landmarks (2026-10-04)

Dominicuskerk now keeps its actual nave, aisle roofs, small bell turret and
unfinished hexagonal tower stump. An older church roof patch is rebuilt only
within the current parent plan; the neighboring historic BAG house remains.
Vredeskerk includes its nave, transverse roofs, rose window, clear arched
entrance doors and documented 50 m tower including the iron cross.

Badhuistheater retains its octagonal bath-house dome and clerestory. Cinecenter
models the current side-street entrance and older canal frontage. Studio/K uses
the complete mapped Timorplein school with open court, workshop connectors,
paired gables and corner clock tower. Groote Museum retains its rounded
Artisplein bow and long arched facade; ARTIS Library its five pavilions,
circular upper windows and historic name plaques. Original photographs guide
approximations; exact OSM/BAG identities keep neighbors and courtyards visible.

Gallery and active-game reviews corrected door/window occlusion, overlapping
church roof geometry, facade signage and a clock placement. All 74 assets pass
finite-geometry, decoded triangle/file-size, material and life-size checks;
exact-ID suppression and hidden-model restoration pass. The refreshed queue has
288 entries: 78 original-model entries, 12 imported references, 17 procedural
kits and 181 pending tasks. Entries exceed meshes because teaching aliases
share some assets.

Tree crowns now include a sixteenth palm form for 37 exactly recorded windmill
palms, with seven radial fronds and a high solitary trunk. Five exact evergreen
taxa also move 202 unpruned trees from generic crowns to conifers. Whole-inventory
comparison preserves positions, heights and every unmatched/pruned record.
Gallery, mobile Chromium, real instancing/culling/lifecycle checks and an
isolated recorded-palm park capture pass within the existing seven-draw,
four-geometry and two-material budgets. Phone hardware performance is unmeasured.

## Chapel, independent cinemas and eastern museums: 67 original landmarks (2026-10-04)

Agnietenkapel now uses its exact chapel and courtyard-wall plans, distinct west
and east windows, pitched hall and open Renaissance gateway. LAB111 retains its
clock stair tower and recessed wings, OCCII its ornate narrow coach-house front
and irregular low rear body, and Ketelhuis its industrial mansard and arched
windows. An oblique OCCII review verified the taller roof behind it belongs to
a separate neighbor and remains visible.

Wereldmuseum models the whole mapped KIT complex with individual roof parts,
open courtyard, museum entrance gable and correctly scaled clock dormer.
Plancius / Dutch Resistance Museum keeps its classical street front and real
inner court. Allard Pierson uses the former bank front and actual rear plan.
Gallery and close/wide active-game reviews corrected window occlusion and
roof/dormer defects before completion. All 67 actual files passed geometry,
compression, life-size and exact-identity suppression checks. The queue has
287 entries: 71 original-model teaching/catalogue entries, 12 imported
references, 18 procedural kits and 186 pending tasks.

Trees now have a fifteenth compact globose form for three exact grafted
cultivars: Globosum maple, Umbraculifera robinia and Nana catalpa. It changes
1,322 recorded crowns while keeping all 431 explicitly pruned examples and
every tree position and height unchanged. Gallery comparisons and streamed
park reviews retain the existing shared draw, geometry and material budgets.

## Six more park interiors and eight exact species rules (2026-10-04)

Joop van Stigtpark, Baanakkerspark, Vliegenbos, Rietlandpark, Darwinplantsoen
and Piet Wiedijkpark add 1,399 actual mapped landscape features. The base
now contains 9,479 features (4.79 MB raw, 871 KB gzip), adding 691 KB raw and
121 KB gzip. All previous 8,080 features and the separate Bos chunk remain
unchanged, with no repeated new path edges. Source, browser, toggle and
streaming checks passed. Every explicit tree node in these six parks was
already displayed or within the inventory's deduplication distance, so this
batch adds no invented tree positions.

Eight exact species/cultivar rules now classify 9,331 standing trees, changing
7,085 crown geometries: Commelin elm, Plantijn elm, Turkey oak, Norway maple,
Japanese pagoda tree, common yew, Plena cherry and black pine. Whole-inventory
comparison preserves all other fields and all unmatched or explicitly pruned
models. The species gallery and streamed park reviews passed within the
existing shared geometry, material, draw and tile limits. Crown shapes remain
authored approximations supported by the cited nursery/botanical references.

## Amsterdamse Bos loads on approach (2026-10-04)

Amsterdamse Bos adds 3,254 actual mapped landscape features in a separate
optional GeoJSON chunk (1.71 MB raw, 365 KB gzip). The base 8,080-feature
payload remains unchanged apart from a small chunk descriptor. A bounds and
zoom gate skips the forest at city overview scale; local visits fetch it once,
leaving its bounds removes its features, and returning reuses a bounded cache.
Toggles and city changes abort stale requests. Removal releases geometry and
listeners. Source-fidelity, lifecycle and browser checks passed without map
errors, including no forest request at zoom 13 and local rendering at zoom 17.

## Canal museums and theatre courtyards: 60 original landmarks (2026-10-04)

Foam retains three distinct canal fronts and its covered light court. Huis
Marseille keeps its two houses and enclosed courtyard. Ons’ Lieve Heer op
Solder models the historic merchant house and separate modern entrance across
the open alley. Brakke Grond and Frascati preserve their irregular complexes,
recessed courts and narrow street/canal fronts; Boom Chicago uses the actual
Rozentheater frontage. Arcam adds its faceted folded metal skin, S-shaped
street glazing and full-width waterfront glass. Architectural details are
approximate reconstructions on sourced footprints, not downloaded geometry.

Gallery and active-game reviews checked surveyed scale, neighboring buildings,
open courts and normal material depth. Roof and glazing artifacts found during
review were corrected before the final captures. All 60 actual GLB files passed
geometry, compression and manifest checks. The refreshed destination queue has
286 rows: 64 original-model entries (including shared teaching identities),
12 imported references, 18 procedural kits and 192 pending tasks.

Sloterpark, Nelson Mandelapark, Diemerpark, Museumplein, Gerbrandypark,
Bijlmerweide, Gijsbrecht van Aemstelpark and Het Kleine Loopveld add 2,322 actual
mapped landscape features. The base overlay now has 8,080 features; all 5,758
previous features retain their source identities and geometries. Large ponds
crossing park boundaries remain in the basemap rather than being clipped into
invented park geometry. The review picker includes all eight additions.

## ARTIS and Hortus architecture: 53 original landmarks (2026-10-04)

Micropia/Ledenlokalen now includes the current BAG frontage, historic end
pavilions, central dark addition and glazed rear conservatory. Street and
garden-side game captures retain Artisplein and the separate Groote Museum.
The ARTIS entrance has both mapped kiosks, eagle piers and open iron gates.
Hortus retains its three separate buildings: the Palm House dome and wings,
2025 Climate House canopy with exterior supports, and orangery. Redundant
roof diagonal cables were removed after reviewing their density in the game.
All three additions passed compressed-asset and life-size checks, then gallery
and active-game reviews; exact identities preserve gardens and neighbors.

Wertheimpark, Frankendael, both mapped Martin Luther Kingpark sections and
Rembrandtplein add 618 actual landscape details. Westermarkt adds one exact
sett-paved pedestrian polygon, including its five structure holes and the notch
excluding Westerkerk. All previous 5,139 features remain unchanged; the overlay
now contains 5,758 features. Source identity, delivery, toggles and three paving
themes were checked. The existing game smoke now waits for active play and
asserts the complete generated feature count reached the live layer.

## Homomonument and botanical grounds: 50 original landmarks (2026-10-04)

Homomonument now uses three pink granite triangles and connecting strips at
its mapped extreme corner positions, with a raised northern platform and
stepped waterside triangle. Heights and stonework details are approximate.
The 96-triangle, 3.6 KB mesh is reviewed at life size in the gallery and active
game; it preserves Westerkerk and all nearby buildings and highlights for the
existing Homomonument teaching record. Memorial assets have their own small
geometry minimum instead of padding simple stonework to a building's triangle
count.

ARTIS and Hortus now add 510 actual mapped landscape features: paths, gardens,
water, lawns, woods, scrub, playgrounds and benches. Their complete boundaries
are not filled green; building pads and open courts keep their existing ground.
All 4,629 prior park features remain identical by source ID and geometry. The
park review picker includes both grounds; source identity and browser delivery,
toggle and map-error checks passed.

## Synagogue complexes and Plantage memorial museums: 49 models (2026-10-04)

The Jewish Museum's four-synagogue complex and Portuguese Synagogue retain
individual halls, low perimeter wings and open courts. Opposite-bearing live
views confirmed Esnoga's surrounding canal houses are preserved neighbors.
Hollandsche Schouwburg keeps the former auditorium as an open memorial court.
The National Holocaust Museum uses its current pale perforated entrance and
restored school, with the rear garden left open according to the architect's
site plan rather than extruding the whole cadastral outline. Nursery context
is explicitly modeled where an older OSM parent includes it.

All four original meshes passed geometry, actual-file manifest, life-size
placement, compression and exact-identity suppression checks, then gallery
and active-game reviews. The work queue now describes area, complex and
memorial tasks alongside buildings.

The tree inventory now includes 9,140 actual OSM trunks within Amsterdam's
boundary and at least 12 m from municipal trunks. All 302,404 municipal records
remain unchanged: 311,544 total trees in 454 streamed tiles, with only 126,687
additional compressed bytes. Artis and Hortus mobile checks verified restored
coverage, including Hortus's two named specimens. Eight additional exact,
source-backed species/cultivar rules improve 13,540 formerly generic crowns
without changing positions, heights or explicit pruning overrides.

## Smaller churches, depot and courtyard museums: 45 models (2026-10-04)

Buiksloterkerk, English Reformed Church and De Papegaai now use their measured
plans and sourced heights. De Papegaai keeps its 4.18 m Kalverstraat frontage
and hidden rear hall. De Hallen retains six depot roofs, transverse passage and
courtyard, with Filmhallen and OBA De Hallen sharing the complex's model.
Huis Bartolotti has its single broad Renaissance gable facing Herengracht.

H'ART / Amstelhof and Amsterdam Museum / Burgerweeshuis preserve their actual
courtyard polygons and street entrances. Their generic parents in current tiles
use BAG identities, which are suppressed alongside the OSM relations. Amsterdam
Museum's planar window infill preserves detail while reducing its GLB below the
500 KB budget. All seven additions were reviewed in the gallery and active game,
including correct frontage, neighboring buildings and normal roof depth.
The asset checker now verifies manifest byte/triangle counts against decoded
files, detecting stale metadata during concurrent model work.

## Cinema palaces, Gothic churches and nearby loading: 38 models (2026-10-04)

Pathé Tuschinski and Pathé City now use original meshes aligned to their street
frontages. Oude Kerk replaces its former imported GLB with an original complete
church plan, chapel roofs and a 67 m clock/lantern tower. Nieuwe Kerk retains its
cross plan and apsidal chapels without inventing a completed west tower.
All 38 models pass placement, geometry and compression checks.

The game now downloads nearby landmark models with at most two requests in
flight. Unloaded and failed models retain their generic buildings. Disabling the
layer pauses new requests, and removal invalidates late callbacks and disposes
resources. The standalone demo retains eager loading. The full-game regression
delays the Embassy GLB, checks both linked teaching records, exact suppression,
neighbor retention and settings toggles during active play.

The legacy polygon depth offset made internal church roof faces show through.
The game now disables that offset when its complete-city layer already hides
basemap buildings. Both church roofs were compared before and after in active
play. The standalone imported-model demo retains its old bias because its source
IDs do not suppress every basemap remainder.

## Rijksmuseum: the wings are flat grey in the source, not a texture that failed

User (2026-10-03): "any idea why rijksmuseum glb has texture issues?" A render
shows the gate and pavilions photo-textured while the long wings sit flat
grey-white. Nothing fails to load:

- All 29 images decode as WebP (213×276 … 509×512), every textured primitive
  carries `TEXCOORD_0`, `droppedAttributes` is empty, and every material is
  double-sided and non-metallic. There is no missing image, missing UV set or
  dropped attribute to blame.
- Weighting the model's triangles by surface area, `RM-dak1` is **65% of the
  whole model**; of that, 53% is vertical (wall) and 29% horizontal (roof). Its
  only texture, `img_01`, is a plain grey slate strip, 121×300. `RM-situ` (the
  terrace and passage interior) adds another 15%. Every material that carries
  real facade photography — `RM-gevel1/2/6…`, `RM-toren2/3`, `RM-entree`,
  `RM-kapel1` — totals under a fifth of the surface between them.
- `RM-dak1` is the author's "dak" (roof) material, assigned to the wings' walls
  as well as their roofs, so a straight-on elevation is one flat grey mass. The
  build script (`build-signature-landmark.ts`) only flips metallic/double-sided
  and darkens unpainted faces; it never reassigns a material, so the source's
  choice survives intact.

Two caveats found on the way, neither the cause: `EXT_texture_webp` is in
`extensionsRequired`, so any glTF reader without WebP-texture support drops
every texture and shows the ~0.5 `baseColorFactor` instead; and this build used
`--texture=512`, half the 1024 default, so even the textured gate is softer than
it could be.

Making the wings read as brick means re-texturing them from a facade photo,
which is a UV remap (the model's UVs are per-material), not a resolution bump.
The 2.7 MB source `.glb` is not in the repo, so that is a rebuild, not a patch.

## Cinemas, retail and performance venues: 34 original models (2026-10-04)

Rialto and Kriterion now have their narrow street fronts and lower screening
rooms; Kriterion retains its irregular mapped auditorium outline. De Bijenkorf
uses the complete department-store footprint and its 20 mapped building parts,
with the main roof and unequal rooftop pavilions at their mapped heights.
Gashouder retains the circular hall and projecting annexes. Stadsschouwburg /
Internationaal Theater Amsterdam combines the Leidseplein façade and twin spires
with the rear stage complex. All five use original texture-free geometry.

The review queue now includes every completed original asset, even those absent
from the teachable POI Destinations pool, and labels these as catalogue additions.
The Embassy of the Free Mind also opts out of broad rectangle suppression, keeping
its neighboring canal houses. The catalogue now has 34 original models.

The municipal tree review fixed crowns disappearing at exact viewport edges and
late inventory responses reviving a removed layer. Nine verified species rules
corrected 1,398 trees previously using a rounded fallback. Lifecycle, full-inventory,
TypeScript and mobile viewport checks passed.

## Landmark gallery and house playground

User (2026-10-03): "Remind me is there a good place to see a gallery of all the custom models and play with the generators?"

- **`landmark-gallery.html`** shows all 35 hand kits (not the generic worship or public kits).
  - Each kit is built from its real footprints with the game's own kit geometry, decorators, chunk builders and facade shader.
  - The camera frame comes from `kit-locations.json`, which `scripts/build-kit-locations.ts --publish` writes. It replaces the old hard-coded table: the kit viewer knew 5 kits and crashed on the rest.
  - Controls: a look picker, a name filter, drag to orbit and pinch to zoom, and `?kit=` deep links.
  - Triangle counts: 62,666 over all 35 kits.
- **`house-playground.html`** has two modes:
  - **Generator:** pick style, year, number of houses, width, depth, storeys, look, gable, roof, shopfront, chain, signature and extras, with a seed, a re-roll and a shareable link. It runs through the game's real decorators, roof planner, chunk builder and shader.
  - **Real building:** look up a building by id or coordinates, click it, and inspect its decorated properties.
  - Differences from the game are listed on the page: no basemap, and doors are not tied to a street graph.
- Both pages are linked from `building-gallery.html`.
- **Fixes found through the gallery:**
  - The modern-archetype `plain` cell drew ribbon windows. Tall kit hosts got that archetype, so church walls showed windows (the Westerkerk nave).
  - Landmark kit walls no longer take facade extras.

## Public buildings: big cinemas and theatres get plain walls, schools get classroom windows

User (2026-10-03): "Keep going balancing hand models with new category treatments."

- **Built by** `npm run build:public-buildings`: it queries Overpass for cinema, theatre, school, fire station, police, hospital, town hall, university and college, and caches the answers in the scrape store. It stages first and publishes with `--publish` into `publicBuildingData.ts`, which `publicBuildings.ts` reads.
- **Cinemas and theatres:** 46 footprints of 800 m² or more, or at least 20 m tall, get plain walls with no windows and no gables. Before this, Pathé City, LAB111 and Studio/K wore canal-house fronts.
  - Small ones stay houses: Rialto is 286 m² and Kriterion 456 m².
  - Hand exclusions: Concertgebouw, Stadsschouwburg, Muziekgebouw, Stopera, Frascati and Het Sieraad.
  - The signage band is not done, so they read as plain brick boxes.
- **Schools:** 283 footprints from 1850 to 1994 get the school look:
  - one flat-headed classroom row per storey, with no doors or stoops;
  - era brick before 1960 (stone frames and a plinth) and buff concrete after it;
  - a pitched roof only on a plain pre-1930 rectangle, otherwise a flat lid.
  - Cost: about 118k triangles in all, with a median of 150–600 per school.
  - Pinned: Montessori Lyceum, Fons Vitae, Slotermeerschool, Spinoza Lyceum.
- **Matched but untreated:** fire stations, police stations, hospitals and civic offices.

## Original landmark catalogue: 29 models (2026-10-04)

The flat-colour catalogue now includes Amstelkerk, He Hua Temple, Haarlemmerpoort,
Museum Het Schip and Scheepvaarthuis, in addition to the 24 earlier models.
Het Schip follows the actual 40-building triangular complex, retaining its open
courtyards. Scheepvaarthuis follows the waterfront outline and prow tower.
Embassy of the Free Mind / Huis met de Hoofden includes the sculpted heads and
shares its model across both landmark records. The browsable POI queue reflects
current model coverage.

Narrow house museums and the Amsterdam School complexes suppress only their
explicit OSM building IDs. Their padded bounding rectangles formerly also hid
nearby houses or courtyard structures. The runtime still restores generic
geometry when replacements are disabled. `check-landmark-suppression.mjs`
checks these cases; all 29 models pass geometry, placement and compression
checks. The newest models were reviewed in the gallery and on the map.

## Facade extrusions slimmed: ivy, oriels, bay windows, canopies, balconies, awnings

User (2026-10-03, Nassaukade screenshot): "what are these awful imposing extrusions on our canal house grammar?"

The extrusions were facade extras, each now slimmer:

- **Dark green slabs (ivy):** these were 2.2 m wide and up to 10 m tall. Ivy now grows as thin ragged fingers to just above the ground floor, only on school, postwar and modern walls.
- **Grey boxes (oriels and bay windows):** these stood out 0.8–0.95 m and were faced in dark glass over two storeys.
  - The oriel now stands 0.5 m out.
  - The bay window is now one storey, 0.45 m out, with light framed panes.
- **Black slabs (door canopies and shop awnings):**
  - The door canopy went from 0.9 to 0.5 m deep.
  - The signature-shop awning went from 1.2 m deep and 0.45 m thick to 0.9 m deep and 0.2 m thick.
- **Other projections:**
  - Amsterdam School brick balconies went from 1 m to 0.5 m deep and from three storeys to two.
  - Glass balconies went from 1.3 to 0.9 m.
  - Entrance slabs went from 1.8 to 1.0 m.
  - Vertical fins went from 0.45 to 0.22 m.
- **Check:** `check-facade-extras.ts` now asserts that nothing above the ground floor of a canal, c19 or school front sticks out more than 0.6 m. Thin hoist beams and flagpoles are exempt.
- **Pickets on the pavement** (second screenshot: "bunch of weird artifacts here too"):
  - Parked bikes and bike racks were drawn on each facade, standing out from the wall as dark pickets. They are gone.
  - Stoop railings were their own component, so they stood without steps under them. They are now part of the stoop.
  - The light-well railing and the bench never stand in front of a shop window.

## Local renames for businesses OSM has not caught up with

User (2026-10-03): "BR020 changed its name to vinyl rocks - has it not been updated in OSM yet?" It has not: OSM node 12876814546 is still `name=Br020` (last edited 2025-05-31), and our POI files already matched OSM, so a fresh pull would change nothing. The user chose both fixes on a decision card: a local rename now, and an OSM edit upstream. `src/canalRecall/poiRenames.ts` lists each rename with the OSM name it replaces and its spot. `build-amsterdam-extract.ts` (local-food names) and `build-orientation-pois.ts` pass names through it, and each prints any entry that matched nothing, which means OSM has caught up. `scripts/apply-poi-renames.ts` patched the published `branded-pois.json` and `orientation-pois.json` without a new pull. Pinned in `test:poi-renames`, part of `check:canal`.

## New-build gaps filled from OSM footprints

User (2026-10-03): "mr blou I love you has no building, any idea why?" Mr Blou I Love You (OSM node 9039944077, Elandsgracht 150) is a 10 m² kiosk, pand 0363100012571031 built in 2023, next to an 11 m² kiosk from 2021. The building tiles are 3DBAG `v20250903`, which reconstructs panden from an AHN survey flown before both existed, and the 3DBAG API holds nothing at that point; our OSM layer only adds building:parts and a few footprints, so neither kiosk drew.

The same hole exists wherever Amsterdam has built since the survey. `scripts/fill-new-build-gaps.ts` (rules in `src/canalRecall/newBuildGaps.ts`) takes every OSM building with a `start_date` from 2015 on (26,022, one Overpass answer kept in the scrape store) and adds it as tier 4 when its BAG/OSM id is not in the tiles, under 30% of its interior is covered by a ground-reaching footprint, and no hand-mapped tier-2 part touches it (those panden are suppressed on purpose: Overhoeks's 32-storey tower outline was the case that showed it). Heights: OSM `height`, else storeys × 3.1 m, else 3.2 m under 25 m², else the median of measured panden within 35 m, else 9.5 m. 3,671 fills went into 165 tiles (+77 KB gzipped); a rerun finds 0, so it is idempotent. Pinned in `test:new-build-gaps` (rules on a synthetic block, and Mr Blou standing in a small building), which is part of `check:canal`.
## Trivia cards stay up, the Houseboat Museum lights its boat, postcards are paced

David (2026-10-03), three requests about the drive-by cards:

- **"Leave the trivia cards onscreen longer, maybe honestly until I x them out or something else replaces them."** Drive-by cards were held only while the rider was within 480 px (minimum 6 s), and clicked and street cards for 8 s, so a card often faded mid-sentence. Every landmark, street and clicked card is now `sticky`: it stays until the player taps the close "×" (`measureLandmarkCard` reserves it at the header's right end, beside MORE; a 40 px corner takes the tap) or another card replaces it. `mayReplaceNotice` now blocks only the arrival card; a drive-by may take the slot after 6 s on a street or drive-by card and after 20 s on a clicked one (`CLICK_PREEMPT_AFTER_SECONDS`), and the 15 s drive-by gap still paces them. Quizzes and new routes still clear the card. Pinned in `test:drive-by-trigger`, `test:notice-cards` and `landmark-panel.spec.ts`.
- **"Houseboat museum doesn't light up yellow when the trivia comes up."** The museum is the Hendrika Maria, a barge; `landmark-buildings.json` joins landmarks to building ways, so it had no building, and its locator dot sat under the three.js boat. `boatForLandmark` (`houseboats.ts`) now finds the drawn houseboat a landmark is aboard: the point inside a boat outline or within 3 m of it, and only for kinds of place a boat can be (museum, hotel, café…), because Kraan 2868, a crane on the quay, stands 3.9 m from a boat. `setActiveLandmark` lights that boat (value 2 in the boat chunk, like a building) and drops the dot when the 3D layer is showing. Named regression in `test:houseboats` (museum → `w174999382`, crane → none) and `landmark-highlight.spec.ts`. The map spec cannot load tiles in the cloud sessions; the vector-map wiring was checked there with a stubbed map.
- **"Use the 'welcome to' neighborhood cards occasionally, when we don't have trivia, the first few times in a new hood."** The postcard opened on every neighbourhood change, and only if nothing owned the band at that instant, so a quiz at the boundary spent the entry. `postcardPacing.ts` now decides: the first three entries to a neighbourhood (counted per city in localStorage) always get it; later entries only when no trivia card opened in the last 45 s and no postcard in the last 120 s; and 90 s inside one neighbourhood with no trivia brings its postcard back (at most every 180 s). A worthwhile postcard waits for the band to be free while the rider is still in that neighbourhood. Pinned in `test:postcard-pacing`, which also covers `raceTime` restarting at 0 between rides (the drive-by gap had the same bug: a gap measured against the last ride's time held cards back).

## Places of worship: five hand kits and a generic church rule for 198 more

User (2026-10-03): "Then temples mosques and churches", after "why does it have windows???" on a church and Fatih as "a 37 m green box".

- **Measured:** Overpass found 175 worship building ways and 95 nodes (cached in the scrape store); they match 300 tile footprints.
  - Nodes are only reported, so a prayer room inside flats is never restyled.
  - Before this change, 198 of them were drawn wrong: 91 as generic house fronts, 81 as landmark period house fronts, and 26 as bare boxes.
- **Hand kits** (`worshipKits.ts`, heights from 3D BAG, photos cited in each kit):
  - Portuguese Synagogue
  - Hofkerk: a cross plan with a west tower and a crossing tower. It has no dome; the photos and 3D BAG disagree with the old hint that it did.
  - Gerardus Majellakerk
  - Westermoskee: the drum and zinc dome, and one minaret of about 40 m, read from a photo.
  - Dominicuskerk: it was a 37 m beige block.
- **Generic rule** (`worshipBuildings.ts`, data from `npm run build:worship-buildings`, which stages first and publishes with `--publish`). Walls are plain brick in an era colour, and there are never house windows, canal gables or shop glass.
  - A plain rectangle built before 1960 gets a steep roof and tall round-headed windows (50 buildings).
  - An older odd plan keeps its lid but gets plain walls and arched windows (54).
  - Towers and post-1960 buildings get plain walls (94).
- **Known gaps:**
  - The Engelse Kerk still reads as a warehouse under a flat lid.
  - The Fo Guang Shan temple needs a tiered Chinese roof shape.
  - Only the Vredeskerk's tower parts are in the tiles.

## Museums and cinemas: seven landmarks modelled from 3D BAG heights

User (2026-10-03): "Work on museums, movie theaters and grocery stores".

- **Measured before:**
  - Of 21 cinemas, 9 old ones wore canal-house facades. Tuschinski, Pathé City and LAB111 were among them.
  - Modern multiplexes stood as bare boxes, which reads right for blank walls.
  - Of 56 museums, about 35 small canal-house museums take the period facade correctly.
  - The big ones were wrong:
    - Van Gogh was about 3 m too low and a bare box.
    - The Stedelijk was 28 m house fronts.
    - H'ART, a whole courtyard block, wore a canal-house front.
    - The Scheepvaartmuseum had a flat lid.
    - NEMO had a flat copper top.
- **Now kits** (`museumKits.ts`, with sources in each comment):
  - **Van Gogh:** the Rietveld block, the stair tower and the Kurokawa drum under a tilted titanium brim.
  - **Stedelijk:** the old building's tower, pavilions and hall roofs, plus the white 2012 "bathtub" on a glass ground floor under its canopy.
  - **Eye:** a faceted roof rising to its 24.5 m prow.
  - **NEMO:** its sloping copper deck.
  - **Tuschinski:** copper domes on the measured street front's towers, with slate halls.
  - **Scheepvaartmuseum:** four hipped wings with gabled projections and a courtyard glass roof.
  - **H'ART (Amstelhof):** hipped wings round the courtyard.
- **New typed helper:** `landmarkForms.ts` extrudes a part's footprint with a sloped lid, a mitred outset for brims and canopies, a half-clip and a tilted underside.
- **Guesses:** the Van Gogh part roles and a 2.4 m ground correction; the depth of the Stedelijk canopy; Eye's facet split; Tuschinski's dome size. All colours are read from photos.

## Stray facade objects, slimmer cornices, Carré, Fatih windows, chain supermarkets

User (2026-10-03), screenshots at Da Costakade: "these overhangs look a little heavy / too wide", "what's these random artifacts in front of buildings?", "not sure what these are", "bad mix", and of a hand-modelled church "why does it have windows???". Earlier: "Carre looks awful in that shot?", "Work on museums, movie theaters and grocery stores".

- **Stray objects were facade extras** (`facadeExtras.ts`, `facadeOrnaments.ts`), each redrawn and pinned in `check-facade-extras.ts`:
  - The dark slab by the stoops was the light-well railing, drawn as one solid iron plate. It is now openwork bars.
  - The green posts were facade-garden stalks up to 2.2 m tall. They are now low clumps (at most 1.15 m), never in front of a shop window.
  - The yellow box was a 20 cm door lantern. It is now a small black lantern on a bracket.
  - The yellow bar sticking out was a parked bike drawn as one coloured tube. Bikes now have wheels, frame, saddle and bars, in dark colours.
  - The black doorway was the portiek recess. It is now a warm shadow with a painted door.
- **Cornices:** the kroonlijst went from 0.68 m to 0.4 m deep, the console cornice from 0.66 m to 0.38 m, and the bracket cornice from 0.45 m to 0.3 m. Checked to be at most 0.42 m.
- **Kit parts never take a house facade.** The landmark wrapper used to check the landmark list first. The Beurs van Berlage is not on that list, so its kit-roofed halls got house windows under the kit roofs, and the two fought.
- **Carré:** hand-modelled from Commons photos and the BAG footprint:
  - cream stucco to a 19 m cornice over a grey stone ground storey;
  - round arches and three window rows;
  - a pediment to 21.5 m;
  - a zinc cloister dome to 27 m with a sign box at the BAG 28.3 m.
- **Windows on kit walls:** opt in with `windows` on a kit's halls; other kits are unchanged and are checked to draw no glass. Fatih has a 3.6 m rose window, door arches, tower windows and belfry arches, and round-headed nave windows.
  - Its windows are round-headed, following the photos, not pointed.
  - Cost: Fatih goes from 70 to 1,114 triangles, Carré from 166 to 816.
- **Chain supermarkets:** `npm run build:supermarkets` runs Overpass through the maps.mail.ru mirror and caches the results in the scrape store.
  - It matched 258 of 270 ground-floor chain stores to 245 buildings: AH 126, Jumbo 25, Lidl 17, Spar 18, Vomar 15, Dirk 15, Ekoplaza 16, Aldi 6, DekaMarkt 4, Plus 3. The 12 unmatched stand 10–48 m from any footprint in the tiles.
  - They get large glazing, a fascia in the chain colour and a logo panel on the street wall nearest the store.
  - The brand word is drawn in a 5×7 block font (`blockLetters.ts`).
  - Colours come from each chain's Commons logo. Dirk's red is from memory, and Ekoplaza's green is a guess at its fascia.
- **Street rhythm:** a study and a pure prototype (`streetEnsembles.ts`). The plan is in TODO under "Street ensembles".

## Enter rides on without a reload; the bike follows zoom halfway

User (2026-10-03): "why does hitting enter at the end of route reload the whole game? shouldn't we be loaded enough to just have a new destination?"

- **Cause:** every ride went through `_onLocationSelected`, which re-fetched and re-parsed the whole city extract, re-projected it around the new pair's midpoint, reloaded every landmark file, built a new `RoadNetwork` (and so a new routing graph), then waited up to ~5 s for the map to settle behind the loading screen. Measured in the cloud browser: 15.5 s from Enter to riding.
- **Now:** the first load remembers its network (`_loadedWorld`: city, mode, projection centre, segments, track). A later ride in the same city and mode keeps that projection, moves the track's ends (`setEndpoints`; the graph and grid stay cached) and starts the start flight straight from the finish card, with no loading screen: 0.2-0.3 s. Transit still reloads, because its legs rewrite the track's finish. The ride's best-time key and share link are still named by the pair's midpoint, so they match a fresh load. Pinned in `next-route.spec.ts` (racing in the same call, same track, player at the new start).
- **Bike size:** the chase bike is a world-space piece, so zooming in made it fill the street (user screenshot, Marnixstraat). `vehicleZoomScale.ts` gives back half of the zoom, `(defaultZoom / zoom)^0.5` clamped to 0.6-2.2: at 150% it reads 1.5x rather than 2.3x, at 40% it stays visible, and at the window's default zoom nothing changes.
- **Keyboard hint plate:** the line sat low in its plate (fixed alphabetic offset); it now centres on the measured ink.

## Houseboats: lighter, cuter, more like Amsterdam's

User (2026-10-03, screenshot at Nassaukade): the canal boats "look a little dark and could be cuter / look more like amsterdam canal boats". Cause: every boat drew from one dark palette (hulls #24-#3b, half the cabins and all roofs near-black), and the kit shading (0.58-1 times the flat cell's 0.9) takes walls down another third, so from the chase camera boats read as black slabs. `src/canalRecall/houseboats.ts` now splits the palettes by kind: arks sit on grey concrete pontoons with painted timber cabins (cream, sky blue, sage, mint, ochre, barn red, timber, a few deep greens), white-framed windows, a bright door, a flat roof with a white fascia (often sedum green), a gable, or the arched barrel roof common on woonarken (~23%), a stove pipe, and potted plants on the deck. Barges keep dark steel hulls, which is true to life, with a pale gunwale stripe and a deck that sweeps up towards the bow, varnished or painted cabins, pots on the cabin roof, a stove pipe and a Dutch flag on a stern staff when the stern has room. Triangle budget held: 199 a boat on average over the 3,083-boat extract (`test:houseboats` caps 200; arks ~148, barges ~300), with hidden pot and pipe lids dropped to fit. Before/after renders were made with a standalone viewer that mimics `buildKitChunk` shading (tmp/, not committed).

## Two-finger twist spins the 3D camera

User (2026-10-03): "I want to be able to spin the camera with a two-finger twist gesture on my trackpad." Only Safari reports a trackpad rotation (`gesturestart`/`gesturechange` with `rotation`, also fired by iOS Safari for a two-finger touch); Chrome and Firefox expose no twist at all, as a gesture or as a wheel delta, so those get Option/Alt + two-finger scroll instead. Both orbit chase/cockpit through the existing `camera.bearingOffset` (the same one Shift + [ / ] nudges) and persist through `_nudgeCameraBearing` once the gesture settles; the 2D views ignore it, as they ignore the keys. A twist engages only past a 6° dead zone and then tracks the fingers without a jump, so a pinch's wobble never turns the view. The Safari gestures are also swallowed so the page itself cannot zoom, and their `scale` zooms the map unless a touch pinch or ctrl+wheel is already doing it. Logic in `src/canalRecall/game/trackpadTwist.ts`, pinned in `test:trackpad-twist` and `tests/e2e/trackpad-twist.spec.ts` (synthetic Safari events: wobble ignored, a clockwise twist turns north clockwise on screen, Alt+scroll turns it, the bearing persists).

## Large-letter postcard: the Spoon Graphics recipe

User (2026-10-03, with the Spoon Graphics tutorial "How To Create a Vintage Style Large Letter Postcard Design"): revisit the postcard against it. Audit: `/mnt/project-files/map-recall/postcard-design-audit.md`; before/after renders in `/mnt/project-files/map-recall/postcard-recipe/`. Changes, step by step against the recipe:

- **Typeface.** Anton (self-hosted, OFL) instead of Archivo Black, standing in for Futura Condensed Extra Bold. The layout still works in Archivo cap units (`LARGE_LETTER_FONT_EM_SCALE` draws Anton at 0.8 of the layout size). Because the face is tall by itself, the vertical face pull is capped at 1.3 (it was up to 2.7) and the horizontal squeeze stops at 0.85. Names of up to nine letters stay on one line even with a space (DE PIJP, like FLORIDA), and word spaces are half width. Tracking is +0.012 em, not the recipe's -50, because Anton's sidebearings are slim and faces overlapped.
- **Rims.** Two offset rims (light inside, blue outside, dark hairline edge) sit behind the face, replacing the black die-cut drawn over it.
- **Extrusion.** Each glyph's outline is flattened, and every edge facing the extrusion direction becomes a facet. Down-facing facets are orange and side facets blue, as in Illustrator's Extrude & Bevel at 1°/1° with no shading. The block is outlined once in a dark line, so there are no seams. A 45° halftone screen is burned into the orange (Color Burn 30%). The recipe's block is parallel, not converging; the earlier audit line that said otherwise was wrong. Without the outline font, the banded shelf is still used.
- **Backdrop.** 60% instead of 16%, with a lighter veil, as the recipe lays the scene at 70%.
- **Photos.** The layered card's letter photos get an SVG paint filter: brush wobble, soft blur plus unsharp mask, and an 8-tone posterise. A colour boost follows, standing in for Oil Paint and Match Color.
- **Print grain.** A Gaussian-noise and linen layer blends with `overlay` over the whole layered card. This puts back the texture on the letter photos that the windows change had dropped.
- **Script.** Pacifico is self-hosted and registered via `ensureLargeLetterWebFonts`; the game had been showing a serif fallback.

Photo windows now replay the block's paint order on the mask: a later line's extrusion, or a neighbour's rims, closes that part of an earlier window. Paint is 56-107 ms a card, and the grain takes 19 ms once. Regressions: `test:large-letter-postcard` and `test:large-letter-craft` (DE PIJP on one line, the two-line contract moved to OVERTOOMSE VELD, face pull ≤1.3).

## Map Recall: folded answer card and a layered postcard

User (2026-10-02, with a screenshot of Nieuwmarktbuurt): the postcard "pops in too late" and the answer card "takes up too much of my screen so I don't get confirmation of where the hood was". Cause of the delay: `PostcardHeader` composed the large-letter postcard at reveal, after a dynamic import of the compositor, the Archivo Black outline font and `Promise.all` over up to eight Commons thumbnails, so the slowest photo gated it, then drew the warped letters (70-240 ms a paint here). Measured over seeded rounds: 1.3-12 s from Confirm to postcard, 1.3-3 s even with every photo on local disk.

A first cut baked every postcard to WebP (66 for Amsterdam, 3.7 MB). The user preferred the photos to stay dynamic and suggested treating the letters as transparent windows the browser fills itself, prepared during the guess. That is what shipped: `drawLargeLetterPostcard(..., { photoWindows: true })` paints the card with transparent letter faces (outlines kept, later faces over earlier outlines as before), and `largeLetterPhotoWindows` gives each letter's face path, photo box, crop focus and colour filter, so `PostcardHeader` lays plain `<img>`s behind the canvas (`object-position` = the canvas's focus crop, `clip-path: path()` = the letter). `src/mapRecall/livePostcard.ts` composes the frame and requests the photos when the round starts (`usePreparePostcard` in both overlays), repaints once when the first photo (the faded backdrop) arrives, and caches the last few rounds. The frame shows at reveal whatever the network does; letters fill in as their photos load. No baked files.

The answer card now opens folded (`AnswerDetails`): a postcard thumbnail, the opening line (name origin, reviewed fact, lede or history) and "More", which opens the full card; it folds again each round. The overlay holder is capped at 55dvh on desktop, and `MapComponent` fits the revealed answer above the card's measured height instead of a fixed 42% guess, refitting when the card opens or folds. Pinned in `test:postcard-images` (window geometry, photo rotation, teaser) and `map-recall-trivia.spec.ts` (folded card under 40% of the viewport, the answer's label above it, the postcard present with no photograph loaded, every window filled when they do). Storybook: Map Recall/Answer card.

## Neighbourhood cards lead with a local fact

User (2026-10-02): "Buitenveldbuurt is the current Jewish neighborhood right? How can we get that in the trivia card (more generally …)". The area is Buitenveldert; en.wikipedia's lede calls it "the modern Jewish quarter of Amsterdam".

- **Why it was missed:** Buitenveldert has no Wikidata match in our extract, so `fetch-neighborhood-history.ts` never read the English article, and the pipeline reads only ledes, History sections and naming sentences. The Dutch article's facts sit under "Bewoners", "Onderwijs" and "Winkelgebieden".
- **Miner:** `scripts/mine-area-facts.ts` + `src/mapRecall/areaFacts.ts` find both articles (Wikidata, title guesses, nl search, langlinks), score every sentence for local signals, and filter resident statistics, origin shares, crime/policing and planning text before anything reaches the sheet. OSM places inside each outline are clustered (Overpass via maps.mail.ru, since overpass-api.de resets through the cloud proxy) and only corroborate a sentence, never stand alone. Everything goes through the scrape store.
- **Picks:** a Claude session words one fact per area from cited sentences only; `publish` refuses an unapproved pick, a cited sentence no longer in its article, or a number the citations do not state. Pinned in `test:map-recall-trivia` with Buitenveldert as the named regression.
- **Card:** the user chose the lead line (decision card, 2026-10-03): `localFact` renders first with a Local chip; the description clamps to two lines beside it.
- **Published:** 57 of 89 Amsterdam areas, all approved by the user 2026-10-03 ("Push?" after the review page); every citation check passed. 32 areas stay `null` (14 have no article). Rivierenbuurt (1941 Jewish market), Zuidoost (Surinamese community) and Staatsliedenbuurt (squatting) were flagged on the review page and shipped as written.

## Kit-less landmarks: house-sized old ones get a period facade, big ones period brick

User (2026-10-03), after Fatih rendered as a 37 m green box: "More? Landmarks?"

- **Before:** every landmark building a kit did not model stood as one bare box at its BAG height, in the citywide identity palette when no colour was measured. That palette could make a church green.
- **Now (`exceptLandmarks` in `roofMesh.ts`):**
  - Kit-modelled parts and bodies (`KIT_MODELLED_IDS`) still pass through untouched.
  - An old landmark the size of a house (built before 1945 and at most 26 m) takes the generic period facade and roof. Felix Meritis now reads as a Keizersgracht building with a pediment roof. Measured over the 977 landmark parts: 263 kit, 339 period facade, 375 bare.
  - A larger one keeps its bare form, but a palette-guessed colour becomes period brick `#7a4535` (old) or concrete `#b9ad9a` (1945 on). Measured colours are kept.
  - A listed landmark counts as old whatever BAG says. BAG often dates a restoration: the Westerkerk east end says 1990 and Mozes en Aäron says 1969. `fetch-monument-gables.ts` now writes `listedLandmarks` (483 parts, a whole landmark counts when any part holds a register point).
- **Tried and dropped:** giving the big ones the generic facade too. Carré and the Oosterkerk read as nine-storey flats.
- **Hand-modelled churches** (kits with sources, real-tile checks): Obrechtkerk, Oosterkerk, De Duif, Opstandingskerk, Mozes en Aäronkerk and the Westerkerk east-end sliver. Kits gained explicit wings, slab and round towers, and spire, dome and slanted caps. Guesses: Opstandingskerk's slab sits at the south end; the Obrechtkerk towers are placed from the footprint.

## Arrival card fits the window

User (2026-10-02), on the De Dolphijn arrival card on a laptop: "ideally fits on screen". With a photo, a ribbon, first-time gains, a sign-in tease and a personal best, the card was taller than the window, so the Next route and Share actions were cut off.

- **Density levels:** `_renderFinish` builds the card at up to four densities and uses the first that fits.
  - Spacing gets tighter at each level.
  - The personal best moves into the footer line.
  - The blurb and the story get shorter, and the photo gets smaller.
  - At the tightest level the encyclopedia blurb is dropped.
  - Only if the tightest level still overflows is the card scaled down, and the touch hit boxes are scaled with it.
- **Story lines:** they now wrap to the card. On a phone, "You made it to … · 2 new names, 1 landmark" ran past the right edge, and a cut never leaves half a sentence.
- **Phone:**
  - The card stops above the settings and help buttons.
  - On short screens, Route setup and Share sit side by side, so every button keeps a 44 px target.
  - Ribbon axis labels drop their percentage when the column is too narrow.
- **Checks:** `tests/e2e/finish-card-fit.spec.ts` checks a full card at 1440x700 and 1280x600. Storybook has `FinishCardFull` and `FinishCardFullPhone`.

## Trivia card: compact header, "more" as a link, sized to its content

User (2026-10-02), on the Prinsengracht street card: "bad layout".

- **Was:** every bare card was 480 px wide whatever it held. "+ MORE" was a copper pill beside STREET, so it read as a second tag. The name sat 2 px under the chips, and the plate had 7 px of air on top and nearly 30 px below.
- **Now:** `measureLandmarkCard` puts the category chip and the name on one row when they fit, and drops the name below the chips when they do not. "MORE ›" is copper text at the row's right end, with no pill. The body wraps at a 400 px measure. The card is as wide as its widest line, with a 220 px floor and the old width as the ceiling. Padding is even on all sides.
- **Renderer:** the layout now carries every vertical position (`headerTop`, `nameBaseline`, `bodyBaseline`, `lineStep`), so `renderer.drawLandmarkCard` can no longer drift from the measured height.
- **Checks:** the Prinsengracht case is pinned in `scripts/check-notice-cards.ts`. Storybook has `StreetOriginCard` and `PortraitStreetOriginCard`.
## Map Recall bottom card fits above iPhone Safari's toolbar

User (2026-10-02, iPhone Safari screenshot): "Mobile needs some display fixes at the bottom. Also can't scroll to the bottom of the trivia card."

- **Cause:** the Map Recall shell was Tailwind `h-screen` (100vh). iOS sizes 100vh to the large viewport (toolbar hidden), so the bottom card's "No idea" / "Place a pin first" row and the end of every scroll area were laid out under the toolbar, where no touch can reach. `#root` was already 100dvh; the shell now fills it (`h-full w-full`). Modal caps moved from `vh` to `dvh` for the same reason.
- **Trivia card:** on phones `.quiz-result-card` had its own `max-height: 58dvh; overflow-y: auto` inside the overlay wrapper's 42dvh scroller. The inner scroller was taller than its parent, so scrolling the outer one never reached the card's last lines. The wrapper is now the only scroll area (`overscroll-contain` so the page does not rubber-band).
- **Regression:** `tests/e2e/map-recall-phone-chrome.spec.ts` shrinks `#root` by a 90 px "toolbar" the way Safari's dynamic viewport does and requires both buttons and the scrolled-to-end answer card to sit above it. Both tests fail on the old code. Not yet checked on a real iPhone.
## Listed buildings draw the gable the monuments register names

User (2026-10-02): "do you think it's at all possible to correlate the canal house builder more to the year the house was built?", then "start on wall colors, then gables".

- **Source:** the national monuments register (RCE, CC0) describes each rijksmonument's front in Dutch, for example:
  - "Pand met trapgevel"
  - "onder rechte lijst"
  - "klokvormige top"
- **Fetch:** `scripts/fetch-monument-gables.ts` queries the register's SPARQL endpoint in ranges of monument number. OFFSET paging timed out past the third page, and joining on the municipality repeated every row about 20 times. Raw responses are cached in `/mnt/project-files/scrape-store/rce-monuments/amsterdam-by-number/`.
- **Classify:** `monumentGables.ts` takes the first gable phrase in each description.
- **Match:** the monument's point is placed in its building footprint, and the result goes to `monument-gables.json` (179 KB).
- **Coverage:** 7,672 Amsterdam monuments; 5,377 name a gable; 4,326 buildings matched:
  - cornice 2,299
  - neck 1,283
  - bell 911
  - plain 575
  - step 144
  - spout 35
  - raised neck 1
- **In game:** `vector-map.js` loads the file and tags `monumentGable` before roofs are planned. `planRoof` then draws that gable whatever the style, OSM tag or year.
- **Measured:** in one Herengracht view, 574 buildings were tagged and 488 drew the named gable. The rest are footprints too irregular for a gable roof.
- **Pinned:** in `test:roof-shapes`, using register numbers 836, 2791 and 5114.
- **Open:** the first-phrase rule can pick up a rear or side gable where a description starts there. "verhoogde halsgevel" is rare in the register's wording, so raised necks are still mostly guessed. Landmark buildings keep their own form.

## Wall colours by period

From the real-vs-game sheet (2026-10-02: "one brick palette" everywhere), and the user's "start on wall colors, then gables".

- **Before:** every bay-look building drew its wall from one hash-picked brick palette, whatever its age. Post-war blocks in Photo came out red brick too.
- **Now:** `PERIOD_WALLS` (in `bayLook.ts`) gives each archetype its own range, still hash-picked and still unmeasured:
  - **Canal houses:** deep red-brown brick, about a quarter painted near-black, dark green or grey, and a little white stucco.
  - **1860–1914 rows:** red and orange brick, with buff and cream stucco.
  - **Amsterdam School:** dark purple-brown and orange brick.
  - **Post-war and modern:** buff, grey and concrete.
  - **Storybook and Cartoon:** each look's own palette is split the same way by period.
- **Pinned:** `test:three-buildings` checks that canal houses are darker than 19th-century rows, that some are painted dark, and that post-war blocks are not red.
- **Gallery:** `building-gallery.html` shows every period palette.

## Untextured is flat colour only

User (2026-10-02, a screenshot of brick, window grids and awnings): "untextured should be totally untextured or very flat".

- **Before:** the Untextured look already drew every wall and roof on one layer. That layer was the procedural roof's flat cell, which still carries grain, so walls and roofs read slightly textured.
- **Now:** a `flatColour` shader uniform (set for `untextured`) draws the vertex tint alone, with no cell texture at all.
- **Live switch:** switching looks rebuilds every chunk, which took about 40 s on a loaded machine. A view caught mid-rebuild still shows the old look; booting in Untextured or waiting it out gives flat colour everywhere.
- **Not changed:** storefront geometry (signs, awnings) stays, since it is shape rather than texture.

## Utrecht and Rotterdam neighbourhood text and photos

Ran `fill-neighborhood-gaps.ts` online for both cities with the widened Wikimedia token (Utrecht 192 online candidates, Rotterdam 121; about 1,760 responses now in the scrape store). Translated all 111 Dutch fields by hand into `scripts/data/neighborhood-gap-review-utrecht.json` / `-rotterdam.json`: 73 approved, 38 set to `null` (district-article and monument-list dumps, articles about another place or a person with the same name, out-of-date plans, demographics, crime-policy text). Approved translations trim sentences whose antecedent was lost in extraction ("for that reason", "this road") rather than inventing context. Judged 141 `commons-geosearch` photos on contact sheets: approved 68 that show the area itself; rejected portraits, interiors, vehicles, logos, macro shots, and any file the geosearch handed to several areas unless its name places it in one. Published with `--accept offline` (which also ships the offline `inside-fact` lines built from already-translated landmark facts): Utrecht +222 fields, Rotterdam +75. `check-neighborhood-trivia-data.ts` passes.

## Durable scrape store for Wikimedia fetches

User: "make sure we are caching / building our own DB of everything we scrape". The gap-fill cache lived in git-ignored `staging/`, which dies with a cloud container, so every new session re-asked Wikimedia from scratch under a shared-IP rate limit. `scripts/lib/scrapeStore.ts` keeps every response as `{ url, fetchedAt, body }` at `<root>/<host>/<aa>/<sha1(url)>.json`; the root is `SCRAPE_STORE_DIR`, else the project's shared `/mnt/project-files/scrape-store` (outlives containers), else `.cache/scrape-store`. One file per response so parallel sessions never write the same file; keyed by URL only, never by the token. `fill-neighborhood-gaps.ts` reads and writes through it (`--refresh` refetches). Other fetchers (`fetch-area-photos.ts`, `cached-json-fetch.ts`) still use their own local caches.

## Area photos for all four cities, and our own Commons DB

User: "take over fetching ... make sure we are caching / building our own DB of everything we scrape". `scripts/fetch-area-photos.ts` now fills postcards for Amsterdam, Den Haag, Utrecht and Rotterdam. Three faults explained the empty Amsterdam areas (Grachtengordel, De Pijp, Staatsliedenbuurt and Apollobuurt had 0 photos): the action API reports rate limits and `cirrussearch-too-busy-error` as HTTP 200 with an error body, which was saved as "no photos" and then skipped forever; geosearch returns only the 200 files nearest one point, so a single centroid query covered a corner of large areas and none of a horseshoe (the Grachtengordel's centroid is in the old town); and anonymous requests from the cloud's shared IP were throttled outright (the Wikimedia token now covers commons.wikimedia.org). Now: error bodies are retried or reported, never stored; `areaSearchPoints` searches a grid of cells about 1 km wide whose centres lie inside the area; areas with fewer than 40 candidates also consider files within 150 m of the boundary (small islands, flagged `nearby: true`); and Anefo press portraits and Mapillary dashcam frames are dropped as not views of the place.

Everything read is kept twice. Raw responses go to the shared scrape store (`scripts/lib/scrapeStore.ts`, `/mnt/project-files/scrape-store`). The parts we use go into two tables, `/mnt/project-files/commons-db/{geosearch,files}.jsonl` (`src/mapRecall/commonsStore.ts`): 1,248 geosearch queries with all hits, 26.9k files with URLs, size and licence/credit/description metadata, 74 MB, too large for git. `--offline` rebuilds every city's `area-photos.json` from the tables with no network and gives the same answer (hits keep the API's nearest-first order because candidate lists are capped by it). The first run's raw responses sit in `commons-db/responses/` keyed only by URL hash (from before the scrape store), as an archive. Measured in the card gallery: postcards for every Amsterdam and Den Haag card, all but one in Utrecht, and all but 15 in Rotterdam (Ommoord and Zevenkamp, where Commons has almost nothing geotagged). The gallery page itself crashed for every city but Amsterdam because it took names and centres from the game's `CITIES`; it now uses `EXTRACT_CITIES`.

## Facade ornaments: cornices, door surrounds, iron balconies, Amsterdam School brick

User (2026-10-02): "need more canal-house-y generators, more cornices, more amsterdam school style adornments, more white accents", with Kinkerstraat 321 as the reference.

- **New components:** `facadeOrnaments.ts` adds 27 ornament components, for 75 in all.
  - kroonlijst on consoles
  - console and corbel cornices
  - door surrounds and portiek entrances with stairs
  - iron Juliet balconies on stone slabs, stacked on one window axis
  - sills, lintels and stucco hoods; white frames
  - string courses and floor ledges about 0.06 m proud
  - pilasters and brick fins
  - oriels and rusticated plinths
  - cornice vases and Amsterdam School corner sculpture
- **Alignment:** `facadeOpenings.ts` reads window and door positions off the bay painters, so the 3D dressing lines up with the painted openings.
- **Choice:** every choice is a deterministic hash roll. Exclusive groups per wall (crown, door frame, window head, balcony, ...) mean two crowns never stack.
- **Period:** ornament follows the building's real `facadeStyle` (`MeshBuilding.period`), while street furniture also follows the layout style.
- **Placement:** hoists and door items go only on street walls (`streetSide`).
- **Budget:** triangles per wall and per building (`EXTRA_BUDGET`). Extras cost about 3.2x more than before: about 219 triangles per building on the Keizersgracht detail area, against 70. Lower `EXTRA_BUDGET.building` if phones struggle.
- **Open:** white reads light grey under the 0.55 minimum flat shade. Kinked walls re-grid per edge, so dressing can drift from the painted windows there.

## Fatih mosque: nave and twin towers instead of a 37 m green box

User (2026-10-02): "wtf happened to this building both in size and color … I think it's fatih … is the building really that big in OSM?"

- **Cause:** the footprint is right (BAG, about 1,360 m²). Its BAG height of 37.3 m is the towers', though, and the landmark had no kit, so the whole church extruded to tower height. It also wore the unmeasured identity palette's green (`citywide-identity-palette-v3-not-measured`).
- **Fix:** a `Fatih` hall kit:
  - dark brown brick
  - the nave walls stop at 16 m eaves under one pitched slate roof
  - two 7.5 m square brick towers stand inside the Rozengracht front corners, to 31 m, with slate pyramid caps to about 41 m
- **Sources:** the Commons photo `Fatihmosquewesterkerkamsterdam.jpg` and nl.wikipedia ("dubbeltorenfront van 40 meter").
- **New kit field:** hall kits gain `towers`.
- **Pinned:** in `test:three-buildings` against the real tile.
- **Same risk elsewhere:** other kit-less landmarks with a tower-height BAG value can show the same full-height block.

## The world flashed once per streamed building chunk

User (2026-10-02): "the whole world flashes periodically and I don't know why". Since `e75bccd` freed the facade layer's CPU geometry once uploaded, three.js uploaded each new chunk and only then computed its bounding sphere (for render-list sorting) from the freed `position` array. That threw inside the MapLibre custom layer, which aborts the whole map frame, so the world blanked once for every chunk that streamed in while riding. `install` now computes the bounding sphere before the array is released. Pinned in `tests/e2e/three-buildings-no-flash.spec.ts`, which fails on the old bundle and passes on the new one.

## Roofs: eight gables, nine roof kinds, white stone, and the build year

User (2026-10-02): "need more canal-house-y generators, more cornices… more white accents, more roof shapes", then "do you think it's at all possible to correlate the canal house builder more to the year the house was built?", answered "sounds great, keep going". The real-vs-game sheet (`/mnt/project-files/house-design/real-vs-game/`) showed flat grey lids where Kinkerstraat and the canal belt have gables and mansards.

- **Missing roofs:** most Oud-West lids were OSM-tagged roofs, not untagged ones. On the Kinkerstraat tile, 1,460 buildings carry `roof:shape` (mostly `quadruple_saltbox`), and the decorator skipped them. `decorateRoof` now draws those tags. It keeps the tag in `roofShapeTag`, never overrides a measured eaves height, and leaves shapes it can't draw (skillion, dome) alone.
- **Gables:** step, neck, bell, spout and plain are joined by clock, raised neck (white claws and pediment) and cornice front (lijstgevel: a flat top with a deep white cornice, the roof hipped behind it). White stone comes from `gableTrim.ts`: edging bands, step quoins, stone courses, crowns, copings, and warehouse shutters.
- **Roof kinds:** gable, pitched and mansard gain `mansardHip` (the c19 row house, with street dormers and a white eaves cornice), `hipped`, `halfHipped`, `school`, `sawtooth` and `parapet`, plus a corner turret on cut-corner c19 blocks.
- **Footprints:** a non-rectangular footprint gets its largest inscribed rectangle, plus a wing when one fits (`roofFootprint.ts`). Accents are off for landmark kits.
- **Year:** gable weights follow the BAG original build year, using these periods:
  - step 1600–1665
  - neck 1640–1790
  - bell 1660–1790
  - raised neck 1640–1720
  - clock 1650–1750
  - cornice 1700 onwards
  - a 1875–1915 revival window for step and neck

  A gable outside its period keeps 0.15 of its weight. Year 1905 counts as unknown: 460 of the 6,303 buildings on the canal-belt tile say exactly 1905, which looks like a filler value. Measured shares: a 1620 house is 53% step, a 1760 house is 56% cornice or bell. The BAG year dates the building body, not a later new front, so this steers a street; it does not reproduce it.
- **Cost:** walls-chunk triangles rise 35–42% (canal belt 492k → 665k). Shaped gables cost the most, 150–270 triangles each. Simplifying the rear gable is the next saving if needed.
- **Checks:** `test:roof-shapes` (in `check:canal`) covers closed, outward geometry for every kind and gable, OSM tags, the year rules, and decorator/mesh plan agreement on two real tiles.

## Bay drawings: a 19th-century family, no upper-floor shutters, white trim

From the user's Da Costakade screenshots (2026-10-02, "looks New England"): the Photo/Storybook/Cartoon bays had three families (canal, school, modern), so 1860-1914 and post-war buildings drew as canal houses, with arched keystone hoods and dark shutters on every floor. Now `archetypeFor` follows the facade periods (canal before 1860, `c19` to 1914, school to 1944, modern after; unknown years still hash, weighted to c19 and canal). The new `c19` family has segmental-arched windows under stucco hoods and white string courses at every floor and sill; canal houses have flat lintels only, a pale cornice line under each floor, and shutters only beside ground-floor windows. 68 bay layers (was 53), so the bay texture array grows by about a quarter. Pinned in `test:three-buildings`.

## Shop ground floors painted to the pavement, in ten colours

User (2026-10-02, café corner screenshot): "the white bit should go to the ground because that's the paint color of the bottom floor? also maybe we have it able to come in different colors?" The bay looks' shopfronts stopped at a frame 8 px above a 24 px dark brick plinth. Now a shop bay is one painted surface from fascia to pavement (`paintedGround` in `bayTextures.ts`, drawn on the wall tint channel, plinth dropped for shops), and its frames and muntins share that paint. The mesh tints shop bays with the building's `groundHex` (`GROUND_PAINTS` in `bayLook.ts`: per look, half white or cream, then black, dark green, oxblood, navy, grey); doors and upper floors keep the wall colour. Pinned in `test:three-buildings`. Shots: `kinkerstraat-shops` (photo) and `da-costa-akitsu-e` (cartoon) in `facade-trees-look.spec.ts`.

## De Hallen: a row of tram halls

User report with screenshot (2026-10-02, "should do something with de hallen"): the old Tollensstraat tram depot drew as one bare tan block, because it is a landmark (BAG pand 0363100012236693) and landmarks skip the generic facades and roofs. New kit kind `halls` in `landmarkKits.ts`: `hallRects` cuts the footprint into strips 9.62 m wide across its longest wall, aligned to a corner of the stepped Bellamyplein front (whose edges measure 9.6 m across and 6 m back per step), and each strip's run of the footprint gets a pitched roof with brick gable ends, ridges along the halls, eaves 7.2 m, rise 3.4 m. The walls take the kit's brick window grid instead of bare tan. Pinned in `test:three-buildings` (at least 10 halls, each long and no wider than a hall, together covering 85-110% of the footprint; walls stop at the eaves; ridges at eaves + rise). Shot from the `de-hallen` spots in `facade-trees-look.spec.ts`. Not done: glass ridge lights, arched tram doors on the gable ends.

## Doors on the street side; one bay grid along curved walls

User reports with screenshots (Da Costakade by Akitsu, 2026-10-02): "doors should only be on street-side", stoops in front of a café's shop windows, and a curved block whose window spacing jumped at every kink ("wtf happening here"). Three fixes in the three.js building layer:
- Street side (`streetFronts.ts`): the game hands the routing ways to the layer (`vectorMap.setStreetFronts`, then `ThreeBuildings.setStreets`), and each chunk gets the street segments within 70 m. A wall may carry a door when a ray straight out from it (three rays, at a quarter, half and three quarters along) meets a street within 32 m before it meets another building; a back wall sees the neighbour's back wall across the gardens first. Courtyard walls never get one. A house that sees no street gets one door, on its wall nearest a street within 70 m. Service alleys, motor roads and paths do not count. Boat and transit modes pass no streets and keep the old rule, a door on any outer wall.
- Runs (`wallRuns`, `layoutRun`): consecutive exposed edges that meet end to end and turn by under 25 degrees are laid out as one facade, with one bay width and the bay grid carried round each kink (u counts bays along the whole run). A door goes on a bay that lies at least half on one edge, and only on an edge the street rule allows.
- Stoops: the narrow-shop and plain-wall door removal now runs before the facade extras, so stoops, pediments and gable stones no longer hang on a door that was removed.
Pinned in `test:three-buildings` (street wall keeps the door, a street to the east moves it, no courtyard doors, a quarter-ring frontage has one bay width per arc, no stoop in front of a narrow shop). Shots: `LOOK_SHOTS=1 LOOK_SPOT=da-costa-akitsu LOOK_FREE=1 LOOK_ZOOM=19.3 npx playwright test facade-trees-look --grep "look: photo"` (desktop, software GL, no basemap). Not checked on a phone.

## Storefronts: every built storefront now measured (302)

The remaining 148 first-pass specs were respecced from measured crops, so all 302 built storefronts now come from a full-size crop with a metre ruler and building-edge marks. Where the front at a business's pin is plainly a different, current business (a new tenant, a neighbour the pin lands on), the model shows what the street shows and `decisions.tsv` on `storefront-evidence` says so. Another ~25 became `null` with a reason (scaffolding, side walls, blur); those are web-search candidates.
## Map Recall: locate hints that name places

User: the neighbourhood hints ("eastern half of the search area", "southeast quadrant", "1.09 km southeast of the search center") are bad; give POI-based hints. `buildLocateHints` (src/mapRecall/locateHints.ts) now goes broad to specific from the extract's own data: the district it is in, the river or canal it lies on or near, the quarter it belongs to, the area it borders (with a bearing), a well-known place just outside, and the best-known places inside. Weesperbuurt now reads: in the Centrum district; lies along the Amstel; borders Plantage, just southwest of it; the H'ART Museum and the Royal Theater Carré are inside it. Streets and places get the same treatment (a museum is its centre, not its building outline). Fame is Wikidata sitelinks, with measured floors per kind; the water nearest the answer's edge is scored by sqrt(fame) times shared edge, so the Amstel through Weesperbuurt beats the Singelgracht along its rim. No hint names the answer or shares a distinctive word with it (Weesperplein for Weesperbuurt, De Pijp for Nieuwe Pijp). Bearings from the search centre only fill in when fewer than three hints name something, and are the whole list outside the extract cities. Pinned in `test:locate-hints` (part of `check:canal`) and an e2e in `map-recall-trivia.spec.ts`.

## Storefronts: 145 measured, nulls recovered from other walls, evidence branch

Two more batches respecced from measured crops (with yellow building-edge marks on the measure sheets, so misregistration shows while writing). User asked to use web search for nulls and to keep evidence: many nulls were the panorama tool's `--near` wall being a side wall; `build-alt-walls.sh` crops every other exposed wall of the building, `alt-sheet.mjs` lays them out, and `promote-wall.py` makes the right one the reference (27 recovered by eye, Kadijk and Parlotte via web search). Evidence lives on the orphan branch `storefront-evidence`: all crops (original and alternate walls), `candidates.tsv`, `decisions.tsv` (status and reason per business), registration checks and `web/*.md` notes with sources. Curved awnings no longer rise into the fascia. 315 storefronts built, 145 of them measured; the test floor is 280 because dropping a shop with no visible front is correct.

## Storefronts: second self-review — glass, whole buildings, shutters

Self-review of the measured set: every window was the same flat slate panel pasted on its frame, the strongest placeholder signal on all 298. Shop windows are now frame stiles and rails proud of recessed glass with a pale diagonal reflection (`glassPane`), darker by default. User flagged Kerkzicht (a one-storey pavilion under a tile roof with a brick gable dormer, drawn as a three-storey brick block) and Leonardo's (a closed, graffitied roll-down shutter): `facade.topM` caps the building body, `facade.slabs` adds silhouettes behind or in front of the wall (the roof over the eaves, the dormer), and `graffiti` paints tags over closed shutters, placed by a hash of the shop.

## Storefronts: registration between photo and footprint

User on Bojo: "you need to account for imperfect registration". A panorama's pose is off by up to a metre or so, so a reference crop of the BAG wall can start on the neighbour: Bojo's own left edge (the downpipe) is 1.0 m into its photo, and the shop was modelled 1 m too far right with a strip of bare building beside it. Specs now take `shift` (wall = photo + shift) applied to every photo-measured position (span, text, signs); spans clamp to the wall and ends within 0.6 m of a corner snap to it; all-fixed bay rows stretch to fill. All 48 measured storefronts were re-rendered against their photos: Bojo (-1.0 m) and Al Argentino (-1.3 m) were misregistered; the others matched. Also: fascia text keeps clear of blade signs and scales its margins to thin boards (Al Argentino's lettering had vanished), and the review viewer no longer drops a neighbour with one corner proud of the wall. Practice: when a building's own edge shows inside the crop, measure it and set `shift`. Pinned in `test:landmark-fronts`.

Then two more from the user: Buiten ("bad building") is a teal corrugated-steel shed with a gable and a two-storey glazed grid, which no shop row on a brick house can say; specs now take `facade` (silhouette, colour, cladding ribs, window grids, `bays: 'none'`) and compile to a full front that recolours the building. Bullewijck ("bad awning") has shallow red box awnings with lettering, in separate segments: new `box` awning and `awningSegments` (each with its own text), plus its grey concrete facade and raised name on the wall.

## Storefronts v2: a self-review, real lettering, and 48 rebuilt bay by bay

User found the 300 storefronts "pretty meh" and asked for a self-review. Findings: specs were written from 360 px thumbnails at a few seconds each, so most fell back to the same defaults (split windows, centre door, one frame colour); the vocabulary could not express what makes a shop recognisable (lettering, curved awnings, carriage doors, two shops in one building, patterned bands); only ~12 were checked against their photos; the review viewer painted each whole building in the shop's frame colour; and 16 walls sat 0.2-1.0 m inside their own footprint, burying the shop (Brouwerij Troost, &samhoud). At the game's normal camera height ground floors are a thin strip, so signs and colour blocks are what can read at all.

Changes: `pixelFont.ts` (5 x 7 block letters as merged runs, flat 2-triangle faces) gives every storefront its real name; `landmarkFronts.ts` gains face-only boxes, profile extrusions (curved Dutch blinds, sloped awnings with valances, canopies) and flat polygons (logo roundels, arches). `StorefrontSpec` is now a bay row (`W` window, `D` shop door, `C` carriage door, `d` house door, `P` pilaster, `B` wall, `W:1.4` fixed width) plus wall/plinth/glass colours, fascia height, text placement, second line, banner, free signs (on boards or one letter per tile), logo, lanterns, arched door sign, zebra/tile patterns, awning text. Walls carry `outM`, measured against the BAG footprint, so a buried shop is pushed out to the facade. Review tooling: `measure-sheet.mjs` (crops at 2x with a metre ruler and the pin) and a review camera that frames the shop's own span over generic upper floors. 48 of the most notable (the user's six examples plus the next 44) were rebuilt from full-size crops; two became `null` (a plain canal house with no shopfront, an unreadable crop). The other 250 remain first-pass specs that now show their names. Gallery: https://claude.ai/artifact/P9KV8CHJuvmr5mHk6bRgYE (private).

## 300 hand-tuned storefronts from one-line specs

User: "for ~400 POIs you should try hand-tuning, but with reusable components". Pipeline in `scripts/storefronts/`: `candidates.ts` picks the 400 best-scored labelled local-food POIs not already covered by a front or kit; `build-refs.sh` builds a panorama crop of each one's wall (`--near` the pin); `contact-sheet.mjs` lays them out 16 per sheet with the pin marked (375 usable); `emit-walls.ts` writes `storefrontWalls.generated.ts` (wall, building id, pin position). Each sheet was read by eye and every business written as one `StorefrontSpec` line in `storefrontSpecs.ts`: frame and fascia colour, lettering colour, awning (flat, striped, scalloped, canopy, tiled pan-tile hood), window style (big, split, small-paned, arched), transom panes, door side, blade sign / lantern, hinged shutters, roll-down shutters, terrace furniture, planters, height. `compileStorefront` (storefronts.ts) turns a spec into a storefront `Front`, so they ride the existing kit chunk, highlight and answer-hiding. 300 built; 75 are `null` because the crop shows no usable shopfront (wall out of view, blurred, a blank side wall, or a pin far off on a long block). Cost: 7,087 boxes (~71k triangles) city-wide, but fronts build only for resident tiles. Review: `facade-compare.html?storefront=<slug>` renders one beside its reference; `node scripts/storefronts/review.mjs out.jpg slug…` makes review sheets. Pinned in `test:landmark-fronts` (every spec has a wall, no box leaves its frontage, at least 290 built). The references stay local in `tmp/storefronts/` (panorama crops, regenerable).

## Facade extras (48 components) and near-detail LOD

User asked for ~50 more generator components. `facadeExtras.ts` is a registry of named 3D parts with the facade styles they belong to, a probability and a builder aligned to the wall's own bay layout: canal (hoist beam, hooded hoist, stoop, stoop railing, double stoop, basement well, wall anchors, gable stone, door pediment, 3D shutters), green (window and ground flower boxes, geveltuin hollyhocks, climbing ivy), 19th century (Juliet balconies, bay window, bracket cornice, door canopy, downpipe, gutter), Amsterdam School (brick balconies, brick bands, stair glass, window grilles), postwar/modern (balcony slabs, gallery walkways, satellite dishes, entrance slab, glass balconies, fins, garage door, dark plinth), street life (parked bikes, bike racks, bench, door lantern, flags, the odd scaffolding) and flat roofs (terrace with parasol, roof extension, AC units, skylights, solar panels, antenna, roof garden, lift housing, vent stacks, water tank). Choices hash building and wall; building-wide parts (shutters, balconies, cornice) agree across a building's walls.

LOD, tier 1 (user: "we're going to need LOD"): a whole z14 tile of extras was 760k triangles (walls alone 212k). Extras now build only in `extras:<z16>` chunks for the 2 x 2 z16 tiles (~600 m) around the camera (`setDetailCentre`, called from `vector-map.sync`), in the worker, with budgets of 5 boxes per wall and 8 per building (~100k triangles in the ring). Untextured and bare buildings get none. Software GL here cannot measure GPU cost; check on a phone. Next tiers: flat walls and simple roofs in the distance; phone budgets. Pinned by `test:facade-extras`.

## Massimo Gelato, with web search for frontage

User sent the current Massimo Gelato shopfront (signmaker's photo); web search confirmed the branches (Jan Hanzenstraat 15, Van Ostadestraat 147, Pretoriusstraat 89, Marathonweg 10, Gelderlandplein). `massimoFront()` in `landmarkFrontData.ts` is the reusable current branding (black frame and fascia, white "MASSIMO GELATO" lettering, transom panes, big window, door, round green blade sign), measured off the Pretoriusstraat panorama (2022), which matches the photo; placed on Pretoriusstraat and Jan Hanzenstraat (the 2021 panorama there predates the rebrand; the photo's "Gelato makes us happy" glass identified which of the two shops is Massimo). Van Ostadestraat is modelled as its 2022 panorama shows it (white frames, four dark-green awnings). A hand-modelled front now replaces the generated signature awning on its building (pinned in `test:shopfronts`). Practice from here: when a panorama is old or ambiguous, use web search for the business's current frontage; the images are reference only.

## Hand-modelled storefronts for notable local businesses

User direction: notable POIs get manual storefront work, like the landmarks. Same `Front` machinery, references from panoramas with the builder's new `--near=<POI lng,lat>` (only walls within 8 m of the pin). New in `landmarkFronts.ts`: `storefront` fronts (only the ground floor; the building keeps its own height and colour), `lettering` (a sign's name as pale letter blocks), `stripedAwning`, and `along` (cut a front to one shop's width). First five, in the game: Kema Vlees (Kinkerstraat 182: red fascia and awning under a glass-block band), 't Mandje (Zeedijk 63: pilasters, leaded transoms, pale cornice), Café de Jaren (former bank: O&B mosaic gable, parapet panels, arched café windows), Winkel 43 (dark neck gable, green-and-white striped awning, green "Winkel" fascia) and Café Hoppe (dark bell gable, green neon lettering, red "AMSTEL", cream fascia, red-and-white awning). Massimo Gelato (Jan Hanzenstraat) was left out: its panorama shows two small shops in the building and which one is Massimo is not clear. Picking rule going forward: places people know by their front (cafés, bars, food shops of local fame) and hotels; most top-scored restaurants are inside hotels, so the hotel facade is the thing to model.

## Card gallery page

`/?gallery=cards[&city=utrecht|rotterdam|den-haag]` (src/CardGallery.tsx, switched in src/main.tsx) renders every neighbourhood's real answer card from the loaded extracts, flags what each lacks (description, history, name, photo, postcard), filters by name and can show only cards with gaps. A review tool, not linked from the game. Test: tests/e2e/card-gallery.spec.ts.
## Local businesses: own colours and signature storefronts

User question: when should a local business (a coffee shop) get a custom storefront? The heuristic, in tiers by what the player sees and learns: (1) every business gets a shopfront matching what it sells (previous entry); (2) every named business paints its sign and awning in its own colour, from OSM `brand:colour`/`colour` or else picked from 12 deep sign colours by its name, so all branches of a chain match (8,344 buildings; free: it is the cells' accent channel); (3) a signature storefront, a 3D awning across the frontage plus an iron-bracketed blade sign on the wall nearest the OSM point, goes to the businesses the game labels on the map (branded-pois local-food with orientation score >= 5) and to chains of 3+ branches: 2,721 buildings, ~60 triangles each. Massimo Gelato (5 branches) gets maroon signatures on every branch; pinned in `test:shopfronts`. "Kea Lees" was not found in OSM under any spelling; ask the user for the street.

## Shopfronts where the shops really are

User request: detect commercial streets (Clercqstraat, Rozengracht), bias them to storefronts, and add shopfront designs. `scripts/build-shopfronts.ts` (`npm run build:shopfronts -- --publish`) places 11,611 OSM shop/café/restaurant/bar/pharmacy/bank nodes on the building that contains them (or the nearest footprint edge within 8 m; upper-floor `level` tags skipped): 8,530 buildings carry a business; 6,695 more sit on busy stretches (5+ businesses within 40 m) and copy their nearest neighbour's shopfront. Extract: `public/data/extracts/amsterdam/shopfronts.json` (509 KB). `shopfronts.ts` maps tags to a shopfront (`shopKindForTags`) and `decorateShopfront` stamps `shopKind` / `shopQuiet`, so the worker-side mesh builder needs only the feature; everything not in the extract is now quiet instead of a random third being shops. Coverage along streets: Haarlemmerstraat/-dijk, Kinkerstraat, Utrechtsestraat 100%, Ferdinand Bolstraat 92%, De Clercqstraat 44%, Rozengracht 32%, Van Breestraat 3%.

Three new shopfront drawings (deli/bakery with striped awning and produce crates, florist with flower buckets, bike shop with bikes in the window and out front), and the café redrawn with a scalloped awning and terrace tables. The first in-game look showed nothing: a shopfront cell is one bay wide and narrow houses spent their other bay on the house door, so a shop read as one small dark pane. A shop building now gives its whole ground floor to the shopfront unless the wall has 3+ bays. Pinned by `test:shopfronts` (tags, Mook pancakes and Flowers & Powers on De Clercqstraat, no door on a narrow café).

## Kits: Oude Kerk, Nieuwe Kerk, NEMO

The Oude Kerk (brick tower with clocks, lead octagon stages, open lantern and spire, steep roofs on the hall church and its ring of chapels), the Nieuwe Kerk (it has no resolved landmark ids; its parts were found by footprint area round the Dam: towering nave and transept roofs and the crossing flèche) and NEMO (walled in patinated copper). Kit walls gained `flat` for non-brick landmarks: the Photo look's plain cell carries brick coursing that read as window bands on copper. Still open for NEMO: its sloping roof terrace (OSM `roof:shape=skillion`) is a flat lid.

## Kits: Centraal, Rijksmuseum, Sint-Nicolaas, Munttoren, Krijtberg

Five more landmark kits in `KITS`, found by sorting each landmark's parts by height: Centraal's twin towers (w752653568/567: brick shafts with gilt dials, stone band, lead lantern and spire), the Rijksmuseum (two gate towers and four corner turrets with steep slate spires, pitched wing roofs), Sint-Nicolaas (twin west towers with lanterns and copper domes, the crossing dome on its colonnaded drum), the Munttoren (octagonal stages, clocks, open lantern, De Keyser spire) and the Krijtberg (two slender towers with 15 m spires, steep nave roof). Kits gained `hides` (OSM parts the kit's own geometry replaces, such as the Nicolaas dome bands) and `body` (the landmark's other parts, walled in the kit's style: landmarks skip the generic facades, so the Rijksmuseum's wings were bare tan walls).

## Fronts: Royal Palace, Concertgebouw, Tuschinski

Three more measured fronts in `landmarkFrontData.ts`, in the game in the three.js looks. The panorama builder gained `--toward=lng,lat` (only walls facing a square or street) and joins collinear edges of several parts into one wall, so a front drawn as many OSM parts is found as one. Fronts can carry extra forward `slabs`: OSM often maps a risalit or portico as its own part standing metres in front of the wall (the palace's w748659170, 5 m; the Concertgebouw's portico w754269610, 4.3 m), and the rectified photo shows such a part 18-40% too wide because it is nearer the camera, so its features are mapped from photo metres onto the OSM part. `photoSilhouette` now finds sky per pixel by colour (white overcast or blue): the old top-band threshold called the whole palace sky when its pediment reached the crop. `check-landmark-fronts` takes a per-front `roofline` mode: `full`, `front-only` (roofs behind or a forward part drawn at OSM width: only a front taller than the photo is an error), or `unmeasured` (Tuschinski's fused reference stops below its tower crowns).

## "Greetings from X" postcard on the Map Recall card

The large-letter postcard compositor (src/canalRecall/largeLetterPostcard.ts, previously only in Storybook) now heads a neighbourhood's answer card via `PostcardHeader` (lazy-loaded canvas, Archivo Black). Its letters are cut from the area's own photograph plus photographs of landmarks, parks and squares inside it (`feature.areaPhotos`, up to five, from `<city>/place-photos.json`; `fetch-place-photos.ts` now covers parks and squares too). It needs two or more photographs; otherwise the card keeps its thumbnail. If the images fail to load it stays hidden. When the postcard shows, the "Around here" photo strip and the thumbnail are dropped and the places are listed by name.

## Map Recall card: "Around here" with place photos

The answer card for a neighbourhood now lists its best-known places (`notablePlaces`, same picks as the map clues) and shows up to three with a Commons lead photograph, credited and linked. Photos come from `scripts/fetch-place-photos.ts` (landmark `wikipedia` field -> pageimages -> Commons licence/author; JPEG, landscape, licensed only) into `<city>/place-photos.json`; Amsterdam has 189 of 304 landmarks with an article. Shown after the answer for every difficulty; only the clue dots on the map are gated by difficulty. The unused large-letter postcard compositor (`src/canalRecall/largeLetterPostcard.ts`) is the candidate for a "Greetings from X" header on this card.

## Map Recall difficulty: place clues are easy/medium only

User: the neighbourhood's best-known places should only show on easy and medium. Map Recall had no difficulty, so Settings gets Easy/Medium/Hard (URL `difficulty=`, default medium). `placeCluesEnabled` (src/mapRecall/trivia.ts) is the single rule; hard drops the dots in Guess Name and the after-guess dots in Pinpoint. Nothing else changes with difficulty yet.
## Building clicks and covered passages under the three.js looks

Hiding MapLibre's building layers broke two queries that read them: clicking a building (details card) and the covered-passage check (Cuyperspassage under Centraal's shed). The wall layer now stays laid out but draws at opacity 0 (MapLibre's fill-extrusion draw returns early at 0, so nothing is drawn twice); roofs and ground floors stay hidden. Under a three.js look the building over the rider is hidden in the three layer (a 28% beige fade over beige ground still hid the corridor; slab share now 0.00). Remaining duplicate: MapLibre still lays out that layer's buckets in its worker; porting picking and the cover check onto the three side would let it go.

## Photo is the default look; Untextured replaces Default; mansard ends closed

User request: drop the "Default" look (the MapLibre fill-extrusion pattern layer) from the settings and the B cycle, add "Untextured", and make Photo the default. Looks are now Photo, Painted, Storybook, Cartoon, Untextured; a saved `default` reads as Photo. Untextured is a three.js look on the procedural texture set where every wall and roof face uses the flat layer (bare walls in the building's colour, roof shapes kept): the plainest and cheapest look. The pattern layer survives only as `?buildings3d=off`. Startup bug found on the way: MapLibre's building layers stayed visible under the three.js look when the three layer arrived after the first facade-state pass, or after a detail sync turned them back on; one `_syncMaplibreBuildingVisibility()` now decides them everywhere.

Mansard roofs (user report "this roof shape is just broken everywhere"): the end wall was a triangle fan about an inner point that skipped the eaves edge, so every mansard end had a triangular hole. The fan now closes; `test:three-buildings` checks each end wall's area against its profile for gable, pitched and mansard (the old code failed at 8.29 of 11.15 m²).

## Gap-fill missed articles that existed (Sporenburg, Narva-eiland, Floradorp…)

Two causes, both fixed in `scripts/fill-neighborhood-gaps.ts`: (1) articles with no "Geschiedenis" heading were read as having no history, though many tell it in running prose — `historyFromBody` now picks dated sentences not already used as the description; (2) a request that failed after retries was treated as "nothing there" and the area was recorded as done — failed areas are now retried on the next run. Amsterdam history went 74 → 81 of 90. Utrecht/Rotterdam runs started before this fix: clear their `online-done.json` and rerun once they finish.
## Houseboats from OSM footprints

User request: OSM maps ~3,000 houseboats (`building=houseboat`) but the building tiles carried 55. `scripts/build-houseboats.ts` (`npm run build:houseboats -- --publish`) pulls them from Overpass into `public/data/extracts/amsterdam/houseboats.json` (3,083 boats, 924 KB: id, ring, levels, roof shape, name). `src/canalRecall/houseboats.ts` turns each footprint into a low-poly boat, ~123 triangles: a rectangle is an ark (dark pontoon, cabin with window bands and a door, open deck at one end, flat roof or a low gable for ~22% and for OSM gabled/hipped roofs, 2 storeys where tagged or for ~12%); a traced outline (>8 vertices, 1,039 boats) is a barge whose outline becomes the hull, with a low cabin amidships and a wheelhouse at the squarer stern end. Colours come from hull/cabin/roof palettes by id hash and are recoloured per look. The three layer builds one chunk per resident z14 tile (`boats:<tile>`), and skips the houseboat ids the building tiles carry so none draws twice. Pinned by `test:houseboats` (in `check:canal`).

## Sound permanently disabled

Both apps are silent by decision. Map Recall `sounds` and Canal Recall `SoundManager` are inert stubs (no Web Audio), the mute/sound UI, `N` key and help text were removed, and `preferences.sound` is forced false. `check-canal-preferences.ts` fails if `AudioContext` reappears in the runtime sources.
## Three.js looks draw the whole city; chunks build in a worker

User's call after the hanging-slab reports: switch MapLibre's buildings off in the three.js looks and let the three layer draw everything. While a three look is visible, `osm-colored-buildings`, `-roofs` and `-ground-floors` have visibility none (`_applyFacadeState`). The mesh draws every resident feature: facade buildings as before, everything else (sheds, landmark parts, buildings with no style or colour, such as r3674348 by Bilderdijkpark) as `bare` walls, one plain quad per wall in its mapped colour or `#c9bfae`, with a lid. The answer is no longer a MapLibre stand-in: `setHighlighted(ids)` writes 2 into the per-vertex `hidden` flag and the shader draws those vertices plain yellow (kit parts and fronts light up in their own shape). Lids are indexed (earcut's shared vertices) and lidded walls run their facade rows to the full height, so the cost over the old wall-only mesh is +21% vertices on a dense tile instead of the +60% of the first version.

Jank (user report): a chunk took ~40 ms on the main thread every time a tile arrived. `threeBuildingFeatures.ts` (pure feature -> mesh-building -> chunk) now runs in `three-buildings-worker.bundle.js`; the main thread only uploads the transferred arrays, stale replies are dropped by a per-chunk generation, and the layer falls back to inline builds if the worker cannot start. A 25 s ride showed no main-thread long tasks. GPU frame time cannot be measured here (software GL); check on a phone.

## Landmark fronts and the Waag/Beurs kits are in the game

`landmarkFrontData.ts` fronts now draw in the three.js looks: `frontKitGeometry` turns a front into landmark-kit triangles (winding from per-face outward hints, since the kit material is front-side only), they join the kit chunk under their first carrier's range (so hiding the answer hides them), and `decorateFront` caps the carrying parts at `bodyTopM` and colours them to the front. `lookHex` recolours fronts and kits per look (photo/procedural as authored, storybook warmer, cartoon saturated with darks kept dark). The Waag and Beurs kits moved from the comparison viewer into `KITS`; the pyramidal-roof layer now skips kit parts in three looks so the Waag's cones are not doubled. Trap: part ids differ between the raw extract and the game tiles (the Beursplein hall is w749918641 in one, w749918642/645 in the other), so check carriers in the running game.

## Three.js looks own whole buildings: no more hanging roof slabs

User reports with screenshots (Da Costakade, then roofs "hang there when switching display modes"): in the three.js looks the walls came from the three mesh but every building's top came from MapLibre: the plain wall layer shrunk to a 0.45 m cornice band whose top face was the roof, plus the `osm-colored-building-roofs` lid 0.4 m above it. Two renderers, so whenever the mesh rebuilt (a look switch, a tile) the band and lid hung in the air, and where heights disagreed the slabs overhung the walls. The user's call: drop the slab layer. Now, while a three look is visible, the mesh draws walls to full height (a bare strip above the pattern rows), an earcut lid over every flat footprint (courtyards stay open) on the flat layer in the mapped roof colour or a neutral grey, and MapLibre's wall collapses to a footprint on the ground (`_wallTopExpression`) and its lid filter drops facade buildings. The highlighted answer keeps its plain yellow MapLibre prism. Pinned by `test:three-buildings` (lid area = footprint minus courtyard, faces up, walls reach the top) and `building-look.spec.ts` (`lidOff`, `wallCollapsed`).

## 2026-10-02 — Cuyperspassage rideable; keyboard rides at every reported spot; nightly sweeps

- Centraal's cycle tunnel (Cuyperspassage) runs beneath a building footprint
  that starts at ground level, so in chase view the slab covered 98% of the
  rider's screen box. While such a footprint contains the rider, building
  extrusions drop to 0.28 opacity, with enter/leave hysteresis
  (`src/canalRecall/coveredPassage.ts`). The opt-in three.js facade layer is
  not dimmed yet.
- A stall at the edge is now judged on net movement since it began
  (`trackEdgeStall`, within 3 px). The per-frame test reset whenever the
  shoulder shuffled the bike about 1 px, so at the Melkwegbrug dead end the
  heading ease kept cancelling the arrows.
- `keyboard-ride.spec.ts` rides every reported spot in both directions
  (`KEYBOARD_RIDE_ALL=1`; a core set on every push), aims along the route,
  and prints the whole trail and route whenever a ride fails. The trail
  settled the Sint Antoniessluis "flake": the bike was circling the route's
  end, 25 px from it, while the test waited within 40 px of a separately
  snapped target. Arrival now counts at either.
- The bridge sweep's start and end snap skips every node pruned as a
  cul-de-sac. `scripts/nightly-driving.sh` and the `nightly-driving`
  workflow (02:30 daily, about 1 h) run the keyboard rides, the driving
  harness and the full bridge sweep, with a summary in
  `artifacts/nightly-driving/<date>/`.

## 2026-10-02 — Map Recall: a neighbourhood's best-known places as clues

User request: "a few very notable POIs in that neighborhood (retail is fine) to
help understand it". `notablePlacesIn` (src/mapRecall/trivia.ts) picks up to
five places inside the area polygon: encyclopedia landmarks first (minus
regions such as "Canal Ring Area"), then the ranked orientation POIs. It
allows two landmarks of a kind but one of any other kind, so the clues aren't
two bike shops. A place whose name contains an offered answer is never shown:
"Jordaan Café" would give away or mislead. Guess Name shows them as labelled
dots from the start, since they sit inside the drawn area. Pinpoint shows them
only after the guess, because before it they would reveal where the area is.
Labels go best first; one that would overlap a better one hides until the
player zooms in. Six of the 91 areas have no places.
## Landmark fronts: low-poly reconstructions instead of photo textures

The user judged the photo-textured fronts awful (white sky baked into a rectangle, a photo pasted on a blank box, unlit against the shaded city), and asked for our own low-poly reconstructions instead. Panorama crops are now drawing references only. `src/canalRecall/landmarkFronts.ts` models the one street wall that makes a landmark recognisable as boxes on the wall plane: a slab cut to a measured roofline (arches via `arch()`), projecting cornices and pilasters, framed window panes with sills, shopfronts, and an optional `bodyTopM` that lowers the OSM part behind the front (OSM gives one height per part, so a flat-topped prism otherwise hides a pediment or a gable row). Data: `landmarkFrontData.ts`, with the Bijenkorf (five bays, deep cornice, attic, arched pediment) and the Beurs van Berlage's Beursplein hall wall (13 window columns, six small gables; that hall's roof rise is now 11.5 m so its eaves meet the gables). `facadeCompareViewer.ts` now shows plain prism / reconstruction / flat reference photo. `photoSilhouette.ts` measures each reference's roofline and wall colour (stored in the facade JSON; the builder writes it, `scripts/pano-facades/add-silhouette.ts` backfills), and `npm run test:landmark-fronts` (in `check:canal`) fails if a modelled roofline drifts from it: Bijenkorf median 0.23 m / p90 0.65 m, Beurs 0.25 / 0.67 m. Colours sampled from the photo came out too dark (shaded north-west walls), so fronts use lighter palette colours. Not in the game yet.

## 2026-10-02 — The ride starts facing along the route

User report with screenshot: the bike started pointing away from the route, with
the blue line running off behind it. A road's tangent has two opposite directions
and the extract stores one arbitrarily; `_setupRace` used it unchanged. The
camera bearing follows the player's heading, so the camera was "behind" a bike
that faced the wrong way. `startHeading` (in `routeSelection.ts`, unit-checked
by `check-start-heading.ts`) now picks the direction toward the planned route,
looking at 60, 150 and 400 px out and trusting the clearest, because a route
that turns at the first junction reads sideways from one distance; with no route
it uses the finish, and only a route exactly square to the road keeps the road's
own angle. `start-heading.spec.ts` starts six real rides (four bike seeds, two
boat) and checks they face along the route and the camera settles behind them;
with the fix switched off (`START_HEADING_OFF=1`) all four bike seeds fail.
Seed 1234abcd was a route leaving almost sideways to its road (signal -0.15):
an earlier cutoff left it arbitrary, which is why a weak signal now still decides.
Boat rides happened to face right with or without the fix on those two seeds.
## Beurs van Berlage added to the comparison

"Sherlocked" was the Beurs van Berlage. Panorama facade from the Beursplein-side hall wall (parts w7499186xx, one panorama at 7 m), plus an experimental kit (brick tower with pyramid cap, steep roofs on the halls). The real Damrak front with the tower still needs its wall chosen by hand (`--wall`), and the photo's top edge shows sky because the hall is lower than the tower parts.

## Facade photo vs low-poly kit: first comparison

`facade-compare.html?name=waag|bijenkorf` draws three viewports from one camera: plain OSM prism, prism plus a panorama photo on the street wall, and a hand-modelled kit (experimental kits live in `facadeCompareViewer.ts`, not in `KITS`, so the game is unchanged). Screenshots: `public/data/landmark-facades/compare-*.png`. Result: for the Bijenkorf (flat stone front) the photo is dramatically better and a kit adds nothing recognisable; for the Waag the kit (conical roofs on round towers) reads instantly while the photo covers only the gate section. So: photo for flat fronts, kit for silhouettes. Findings on the builder: use ONE best panorama (median fusion of oblique captures ghosts because the wall is not planar); the panorama list API caps at 500 unordered results, so the script now follows all pages; the Anne Frank canal front is only covered from about 60-70 m across the water and the result is unusable, and the rear (Westermarkt) wall is too close (4-7 m) and badly projected. Wikimedia Commons answered 429 (shared-IP rate limit), to retry. The first "Bijenkorf" footprint guess was the Industrieele Groote Club (Dam 27); the real one is the w7512357xx parts on Damrak/Beursstraat.

## Panorama facade textures (spike)

`scripts/pano-facades/build-pano-facade.ts` builds a photographic elevation of a building's best street-facing wall from Gemeente Amsterdam panoramas: it ranks exposed footprint edges by panorama coverage, rectifies up to five captures with `rectifyFacade` (world-aligned camera) and fuses them with a per-pixel median, which removes cars and people. Output goes to `public/data/landmark-facades/<name>.jpg` plus a JSON record (wall endpoints, panorama ids, attribution). First run on the "Anne Frank House" ids gave a clean 18 m elevation, but the ids resolve to the museum's modern extension (brick + glass entrance), not the canal house, so the right BAG parts still need choosing. The 8000 px image 404s for some panoramas; the script falls back to 4000/2000. Windows show glass reflections smeared by the median; the licence (publisher says open data) is still to be confirmed before shipping textures.


## 2026-10-02 — Neighbourhood gap-fill pipeline

User asked what neighbourhoods still lacked naming and trivia (18 of 90 had
nothing; Sportheldenbuurt was one), then for a pipeline to fill them from every
source: more Wikipedia searches, POI extraction, "named for a street", photos.
`src/mapRecall/neighborhoodGaps.ts` (pure, tested in
`scripts/check-neighborhood-gaps.ts`) and `scripts/fill-neighborhood-gaps.ts`.
Findings that shaped it: the area's article often exists only as "Name
(Amsterdam)" behind a disambiguation page (Sportheldenbuurt is on
Zeeburgereiland, its streets named after Dutch sports history in 2011);
street-name matches need word-boundary rules (a street named for a person
called Sluis is not Sluisbuurt) and never apply to districts; a theme shared by
the streets explains the area's name only when the name points at it. Wikimedia
rate-limits the shared cloud egress IP, so requests are paced at one a second.
Text composed from data is labelled with its source, not "Wikipedia".

## 2026-10-02 — Neighbourhood trivia filled for Amsterdam and Den Haag

Ran `fill-neighborhood-gaps` online for both. Amsterdam: descriptions 72 to 90 of
90, photos 52 to 70, name origins 53 to 70, histories 44 to 48. Den Haag had no
trivia files; now 21 of 23 descriptions, 12 photos, 10 histories, 5 name origins.
Reviewed by hand: Dutch text translated into the per-city review files
(`scripts/data/neighborhood-gap-review*.json`); photos judged on a contact sheet,
and rejected when they showed another place (Delft's Vrijenban, a plantation
house in Suriname, the Zaandammerplein for the Houthaven islands), a diagram, or
nothing of the area. Lessons: a Commons category of the same name can belong to
another city (Willemspark), so a category must sit under one naming the city;
only JPEG photographs count (a coloured area map passed as a PNG); Dutch
"de naam" matches election results, so name origins need an explicit naming
phrase and the area's own name in the same sentence; the Baltic-named islands
(Reval, Wiborg, ...) are in Houthaven, not IJburg. `check-neighborhood-trivia-data.ts`
now guards every city's published trivia. Map Recall reads each extract city
(`cityExtracts.ts`); Utrecht and Rotterdam run next.
## 2026-10-02 — Building assets gallery

`building-gallery.html` (served at `/building-gallery.html` on the canalrecall site,
`/canal-drive/building-gallery.html` in dev; not linked from the app) shows every
custom building asset: facade cells per look tinted as the shader does, shopfronts,
roof/dormer/flat textures, 3D roof and gable thumbnails, palettes, and live landmark
kits (iframes of `kit-viewer.html`). Built by `npm run build:building-gallery` from the
same modules the game uses, so it cannot drift. Storybook is only built as a CI check,
not deployed, and has none of these assets.

## 2026-10-02 — Landmark kits: our own low-poly towers, spires, domes and roofs

User: could we generate low-poly models for major POIs? The 13 signature GLBs are
3D Warehouse downloads (unresolved licence, 10-12k triangles each) and stay
demo-only. Images were unreachable from this sandbox (Sketchfab, 3D Warehouse,
Wikimedia all blocked; web search is text only), so the kits come from memory of
the buildings, good to a few metres and not surveys. Nothing is copied.
- How: OSM already models these buildings as stacked parts (the Westerkerk tower
  is five prisms from 40 to 82 m), so heights are right and the shape is what is
  missing. A kit (`landmarkKits.ts`) says, per OSM part id, what a part really is
  (square or octagonal stage, material), what to stack on it (lantern, spire,
  dome, crown, finial) and which parts carry a pitched roof, all generated from
  the part's own footprint so position and orientation stay as accurate as the
  data. Tower tiers get cornice ledges and gilt clock faces; the Palace drum gets
  columns. Roofed parts are lowered to their eaves and walled in bare brick
  (churches) or a sandstone window grid (Palace).
- Kits so far (Photo/Storybook/Cartoon/Painted looks; Default unchanged):
  Westerkerk (brick/stone/lead tower, imperial crown, nave roofs), Zuiderkerk
  (80 m: stone octagon, lantern, needle spire), Montelbaanstoren (white clock
  stages, lead spire), Noorderkerk (Greek-cross roofs, turret), Royal Palace
  (copper dome on a columned drum, lantern, gilt top, leaded roofs).
- Landmarks otherwise stay exempt from generic facades and roofs.
- Tools: `npm run build:kit-viewer` and `public/canal-drive/kit-viewer.html?kit=
  Westerkerk&az=30&el=15&r=170&y=42` render a kit from its real OSM parts with grey
  context, which is how the shapes were iterated; the look spec has `k-*` spots and
  `LOOK_FREE=1` for a free camera. In-game checks at all five spots, desktop
  software GL, no basemap.
- Pitfall found: `fitRect` rejected 16-vertex octagon footprints (a missing stage
  in the Westerkerk tower); the kit path now allows any vertex count.

## 2026-10-02 — Roofs, gables, shopfronts, and a Storybook/Cartoon split

User: the city looks too regular; photo and cartoon lack roofs, gables, mansards
and street-level retail; the cartoon sat in an uncanny valley (pastel
"Townscaper"). Built for every three.js look (`roofMesh.ts`, `roofCells.ts`):
- Roofs: per-building plan from the footprint's fitted rectangle and facade
  style. Gable (step, neck, bell, spout or plain plate on each short end),
  pitched (plain triangular ends), mansard with dormers; pantile or slate; a
  0.3 m eave overhang, chimneys on most ridges. Non-rectangular footprints
  (coverage under 0.88 or a vertex over 1 m off the box) keep the flat lid. A
  tile decorator lowers the plain wall to the eaves (`roofEavesHeightM`, which the
  wall-top expression already honours) and stops the flat cap; it is applied only
  while a three.js look is on, so Default is unchanged.
- Retail: four shopfront types per archetype in the bay looks (awning, café,
  display window under a fascia sign, brown café with a hanging sign) and two in
  the procedural cells; about a third of buildings get one on the non-door bays.
- Regularity: bay width, storey and ground-floor height vary per building; a
  projecting cornice on flat-roofed period buildings.
- Looks: Cartoon is now flat, bold, cel-shaded (3 light bands), saturated sticker
  palette, thick outlines, bigger windows; Storybook is the softly painted,
  natural-colour middle (thin outlines, muted palette); Photo keeps real brick and
  a realistic brick palette.
Landmarks are exempt: the 849 resolved landmark buildings (`landmark-buildings.json`: churches, museums, Centraal and the rest) get no generic facade and no roof, in every look including Default (`exceptLandmarks`; the ids load after the tile decorator is installed and re-decorate the resident city when they arrive).
Depth was kept to what fits the memory budget: overhangs, chimneys, cornice,
dormers and gable plates; no recessed windows or per-door stoops. Checked by
four rounds of screenshot critique at Jordaan (desktop software GL, no
basemap) and unit checks in `check-three-buildings.ts` (fit, plan odds,
gable profiles stand above the slope, decorator lowers walls, measured roofs
untouched).

## 2026-10-02 — Building look setting; photo and cartoon looks tuned

Settings now has "Building look" (Default, Painted, Cartoon, Photo), saved with
the other preferences and applied live (`vectorMap.setBuildingLookPreference`);
a `?buildings3d=` URL look beats the saved choice. Both wall layers coexist
once used; only one is visible, and switching to Default frees the wall meshes.
User report (Safari, photo look): roofs broken and far too noisy. Not
reproduced in Chromium (roofs correct at the same Rozengracht start), so Safari
itself is untested; one real hazard fixed: the streamer calls the wall layer's
sync before sending tiles to MapLibre, so a throw there would drop roofs, and
it is now wrapped. Noise: the bay drawings are softened when packed (brick
pulled toward its mean, photo brick lifted, black glass lifted) and the photo
look has its own real brick palette; cartoon has a warm terracotta/ochre/cream
palette with occasional blue and green. Four rounds of screenshot critique at
Jordaan/Rozengracht (desktop software GL, no basemap). Pinned in
`building-look.spec.ts` (live switch both ways, URL beats preference).

## 2026-10-02 — Three.js facade layer in the game (spike, opt-in)

`?buildings3d=1|cartoon|photo` (or `vectorMap.setBuildingsLook('cartoon')`)
replaces only the fill-extrusion facade pattern layer with a three.js custom
layer inside MapLibre's GL context (`threeBuildingsBrowser.ts`); roofs,
cornices, ground colour and POI/label layers stay MapLibre's. Walls are laid
out in whole bays and storeys (`facadeLayout.ts`), doors stand under a window
column, party walls are culled, and the answer and signature buildings hide
their facades by id range. Textures are mipmapped, anisotropic texture arrays
sampled with a wall/accent tint mask: the procedural Amsterdam cells
(`facadeCells.ts`) or the rendering spike's bays (`bayLook.ts` over
`bayTextures.ts`, 32 curated layers). Off by default.
Measured (headless software GL, desktop, 5 spots, chase view, not a phone):
after freeing the CPU copies of geometry and textures, JS heap after a forced
GC is 298 MB against 396 MB for the pattern layer (the first run's +160 MB was
those copies); MapLibre render p95 22 ms against 23 ms (an earlier 13 vs 284 was a one-off
tail, retracted); walls geometry 42-57 MB plus 16-18 MB of textures. Shimmer
and aliasing are NOT shown to be better: a sub-pixel-creep frame difference
was mixed and noisy, and a 1x-vs-3x supersampled aliasing error was mixed too
(two spots better, three worse or level; the metric also counts label, tree and
line-width differences). The real gains are lower heap, whole-bay/storey
alignment and the new looks; the shimmer motivation is unproven and needs a
phone eye-test or a cleaner metric. Cartoon and photo verified by eye at three spots (desktop,
no basemap).

## 2026-10-02 — Per-wall facade rendering spike merged

User asked for windows and doors that line up with buildings and more
Amsterdam-looking textures, then "cartoony" and "more diverse". MapLibre's
pattern layer cannot fit a texture to each wall, so the spike builds three.js
meshes with whole bays and storeys per wall (`wallBays.ts`), canvas-drawn bays
in two looks with a shader tint mask (`bayTextures.ts`), on a standalone page.
Merged as an unlinked page; the game is unchanged. See
`RENDERING_STACK_OPTIONS.md` for options, results and costs.

## 2026-10-02 — Bare patches at ride start: re-plan when the view widens

User report with screenshot (deploy confirmed live, JS is no-cache): large
building-free areas beside a loaded block. Cause: `followCamera` re-planned
only when the centre tile or half-zoom step changed, so tilting or turning the
camera, which widens the visible ground, never requested the tiles it newly
showed. The signature now includes the set of z14 tiles the view needs. Pinned
in `check-building-tile-source.ts` (fails without the change). This, not the
earlier retry fix, is the more likely cause of the report; the retry fix stays.

## 2026-10-02 — Calmer facade colours, pre-filtered windows

User report (Windows, after the hysteresis fix): windows still shimmer, and the
colours are loud and chaotic. Pattern images are not mipmapped, so one-pixel
high-contrast windows crawl at a slant. Facade images are now pre-filtered with
a [1 2 1] blur (wrapping across the bay so it still tiles), glass sits 30% back
toward the wall colour, wall colours are pulled 40% toward grey
(`FACADE_WALL_MUTE`, also applied to the plain cap above), and the period
palettes lose the canal green and the buff in 19th-century blocks. Judged by
reasoning and the unit check only; needs the user's eye on a real screen, and
the amounts are the first thing to tune.

## 2026-10-02 — Building tiles no longer stay empty after one failed fetch

User report: a whole tile of Jordaan/Rozengracht never loaded. The streamer put
any failed fetch (5xx, dropped connection, a throw while applying side data,
an abort that surfaced under another name) in its permanent `empty` set. Now:
404 and unparseable bodies stay empty; 429/5xx, network errors and 20 s
timeouts retry with backoff (4 tries); our own camera aborts are never
failures; a bad enricher no longer costs the tile; an aborted fetch's cleanup
no longer unregisters its replacement. Pinned in `check-building-tile-source.ts`.
Cause is inferred from code, not seen in a browser.

## 2026-10-02 — Facades for OSM-coloured buildings; zoom hysteresis; Map Recall near-home scope

- Plain blocks around Centraal were buildings with their own OSM colour tag
  (about 2% of the city, about half of the tall buildings there). The first
  rule skipped them so a mapped colour was never overwritten. They now get a
  facade in the closest of the eight wall colours (`snapWallColour`, redmean
  distance), so red stays red and white stays pale. Only 6-digit hex colours
  snap; named colours still stay plain. The image set is now every style in
  every wall colour: 48 images instead of 20 (build time not yet measured on a
  device).
- Facade jitter: the image set swapped at every integer zoom, and the chase
  camera's zoom wanders across one. `facadeTileZoom(zoom, current)` now holds
  the current set until the zoom is 0.3 past the boundary.
- Nieuwmarktbuurt showed "Lastage" text because the Dutch source article is
  about the Lastage, the area's old name. The English now says so; the Dutch
  original and sources are unchanged.
- Map Recall: History in the answer card opens by default. New "Start near
  home" option reads the home saved by Canal Recall (`canalRecall.preferences.v1`
  plus its geocode cache), keeps quiz features within 1 km, and widens by
  750 m once 60% of those inside are learned (`src/mapRecall/homeScope.ts`).
  It only appears when a home is saved on the same origin.

## 2026-10-02 — Generic period facades and stylised OSM trees (experiment, on by default)

User request: "trees on top of OSM trees" and "a really generic building look
… doors/windows … roughly based on year of construction and size".
- Facades: MapLibre 5 can only texture extrusion walls with
  `fill-extrusion-pattern`, which replaces the wall colour, so the colour is
  baked into 20 images: six period styles (canal house before 1860,
  19th century 1860–1914, Amsterdam School 1915–1944, post-war 1945–1984,
  modern 1985 on, and tower: 30 m or taller, built 1950 or later), each in a
  short slice of the palette. Construction year comes from the building-facts
  tiles via a new tile enricher. Sheds and kiosks stay plain, as do measured or
  OSM-tagged colours. A plain cornice strip stops the pattern reaching the roof.
  MapLibre stores a pattern's pixel ratio as an integer (Uint16), so the images
  are 8 px/m: zoom 15–19 each get a whole ratio, and the image set is swapped at
  integer zooms. Above zoom 19 the walls are plain. A fractional ratio made the
  layer silently vanish at cockpit zoom.
- Trees: `trees.json` existed but was never loaded. Trees are now a four-sided
  trunk plus a six-sided crown, as extrusions, near the route only, and none
  within 3.2 m of the route line. Display only: physics never sees them.
- Cost: on iPhone with 4× throttle, the difference stays within run-to-run noise
  (median map render 10.6–11.4 ms in every variant). Headless WebGL is
  software-rendered, so check on a real device. `?facades=0&trees3d=0` restores
  the old look exactly.

## 2026-10-01 — "Building street network…" was the trivia download

The user asked whether that loading step is real. It is the slowest one, but it
isn't the network: building segments takes 2 ms. The message stays up through
`_loadLandmarks`, which waited for every place and trivia file. On a 4 Mbps,
70 ms link against the live site it stood for 2.8 s, 2.7 s of it downloads.
Now:
- the start waits only for `START_EXTRACTS`: places, areas, bridges, and every
  street and water name (spoiler list before any label is drawn);
- facts (2 MB), street encyclopedia ledes, brand POIs and landmark-building
  links merge in after the ride starts, as the name origins already did;
- `_prefetchCityExtracts` fetches the start files at low priority while the
  setup screen is up (served with max-age=3600), so the start reads them from
  cache.

## 2026-10-01 — Map Recall: trivia on every answer; neighbourhoods are a category

The user asked for "both name trivia and neighborhood history/description"
across streets, canals and bridges, and for neighbourhoods to be a "start
with" choice rather than a mode.

- Name origins: the Gemeente Amsterdam register (`street-name-origins.json`,
  about 5,300 streets, waters and bridges) is joined onto Map Recall features
  by exact name and kind (`src/mapRecall/trivia.ts`), never by proximity:
  "Amstel" the river and the street are different entries. Each card links the
  BAG record.
- Neighbourhoods: `scripts/fetch-neighborhood-history.ts` reads both Wikipedia
  articles for each of the 85 OSM neighbourhoods and stages a description,
  history and name origin. Pattern matching also caught council election
  results, company names and Overtoombuurt's text under Helmersbuurt, so
  nothing Dutch ships unread. Every Dutch field was translated and reviewed by
  hand in `scripts/data/neighborhood-history-review.json` (keyed to its source
  text, so a changed article is reported); junk is dropped; one clear source
  error is corrected (Narval → Narva). Published: 70 descriptions, 43
  histories, 52 name origins. 14 neighbourhoods have no article in either
  language.
- Neighbourhoods are a category in both Pinpoint and Guess Name (choices: the
  nearest other areas). Old `mode=guess_neighborhood` links open Pinpoint on
  them; the type keeps the value for saved results.
- After a guess, CARTO's labels-only tiles are laid over the blind map, and
  removed for the next question ("so that I could get my bearings").

## 2026-10-01 — Rides on the real keyboard; arrow steering beat the shoulder

The sweep, pose probe and harness set throttle and steering directly and stub
the quiz, so they reported zero traps where the user kept getting stuck.
`tests/e2e/keyboard-ride.spec.ts` places the bike before a reported bridge and
then uses only Playwright key presses: arrows to ride, number keys or typing to
answer. The quiz stays on, and every other answer is wrong, which gives the
longest hold. It found a real wedge at once: at the end of Zanddwarsstraat by
Sint Antoniessluis, with up and left held, the soft shoulder's heading ease
(12% a frame toward the street) cancelled keyboard steering (0.033 rad a frame)
exactly. The bike neither turned nor moved. Stick riders already had
`holdHeading` on a hard steer; keyboard steering is always full lock, so it
kept the ease. Now, after 0.2 s stalled at an edge with steering held, the
guard leaves the heading to the rider. The spec fails on the old code and
passes now (Sint Antoniessluis, Westeinde, Koepelkerk). Harness unchanged: no
pinned or wedged drives.

Card badges are snapped to device pixels. The desktop HUD is drawn in a
1280-wide design space scaled to the window (1.125 at 1440 px), so the
centred baseline fell between device pixels and WebKit drew the capitals low.
Measured after the fix: 9 device rows above and 9 below, in WebKit and Chrome.

## 2026-10-01 — "Stuck on a bridge": a question hidden behind the bike

A question freezes the bike until it is answered (`_updateRacing` returns
early while `quizPromptName` is set). Answering starts a hold whose timer
hides the card. Crossing a bridge during that hold (0.9 s right, 3.2 s wrong)
opened the bridge question, and the stale timer then hid the new card and
cleared its feedback. The bike stood on the bridge, throttle open, behind a
question nobody could see. That matches the repeated reports at Sint
Antoniessluis, by the Koepelkerk and elsewhere, with no card on screen. The
bridge sweep, pose probes and harness all stub the quiz, which is why they
reported zero traps (15,600 + 1,120 probed poses at those two spots).

Fix: a hold token. Each new question and each answer bump
`_answerHoldToken`, and a timer whose token is stale, or that finds a question
open, does nothing. As a safety net, the game loop re-shows the card whenever
a question is pending and its card is hidden.
`tests/e2e/question-after-answer-hold.spec.ts` fails on the old code and
passes now. Lesson: a "stuck" report needs a test that runs the real input and
quiz path, not only the physics.

## 2026-10-01 — The answered name is painted on the road

"These are hideous": two big green upright labels read as a debug overlay.
Now there is one name, about 40 m ahead, lying flat on the road in cream like
road paint, rotated so each letter's top points along the direction of travel
(it reads from the saddle, unlike text run along the line). The right or wrong
colour is only a thin edge.

## 2026-10-01 — Cameras: the follow cam was Chase

The user confirmed the "follow cam ... a little too far" was Chase, so the "chase
camera ... a little too close" was Cockpit. The earlier Chase change went the
wrong way. Chase now comes in (zoom offset 0.55 -> 0.7) at 48°; Cockpit steps
back (1.65 -> 1.45) and lowers (82° -> 84°), and its handlebars and more of the
bike stay in frame (checked by screenshot).

## 2026-10-01 — The answered street, named on the street ahead; highlight on the route line

After a street, water or line answer, its name stands in big letters on the
street ahead for 6 s: green when right, red when missed (user request,
"in big letters on the street ahead of me to reinforce it"). It is placed
once, at the answer, 40 m and 110 m ahead along the answered street
(`pointsAheadOnChains`), upright to the camera, and drawn last in the style so
facades do not cut it. Painted along the street, it read sideways whenever the
street led away. It has its own source (`answered-street`), filled only after
an answer, so it cannot reveal an open question
(`tests/e2e/answered-street-name.spec.ts`).

"The street highlight and the road line are different": Damrak,
Raadhuisstraat, Rozengracht and Prins Hendrikkade are each a carriageway, a
tram way and named cycle tracks. The router prefers the cycle track, the
highlight seeded from the way the rider's position matched, and the two ran
side by side. The route line itself lies on its ways (1 of 62 links more than
4 px off on the reported race). With the route line on, the highlight now
seeds from the same-name way nearest the route (`seedNearestRoute`).

## 2026-10-01 — No landmark or shop dots; chase camera steps back

"Still seeing yellow dots": the own-POI dots were removed on 2026-09-30, but
the curated landmark layer `poi-dots` (yellow) and the Albert Heijn
`brand-poi-dots` (white disc under the icon) still drew. Both layers are gone;
names, brand icons and the active-landmark highlight remain, and POI clicks
hit-test the labels. Chase camera, "a little too close ... slightly too high
angle": zoom offset 0.55 -> 0.35, pitch 42° -> 48°. The "follow cam" in the same
report is not yet identified. Cockpit was tried at 84°/1.9, but that pushed the
handlebars off the bottom of the screen, so it was reverted pending the
user's answer.

## 2026-10-01 — Drive-by cards: nearer landmarks, paced

A card for Huis Bartolotti opened while it stood a block away behind other
houses, never on screen, and in the canal belt cards replaced each other every
few seconds (user report). The drive-by radius around the path ahead is now
135 px (about 45 m: a facade on the street being ridden, or across one canal),
down from 300 px (100 m). A drive-by card may replace a street or drive-by card
after 6 s, up from 2.5 s, and drive-by cards are at least 15 s apart
(`DRIVE_BY_MIN_GAP_SECONDS`, reset each ride). Clicked cards are unaffected.

## 2026-10-01 — Road guard: the shoulder resists only leaving the surface

The soft-shoulder branch of `constrainCarToRoad` cancelled any velocity and
step "outward" from the one road the bike was nearest. That was the last
single-road judgement left after the union guard. Where a service road ends
3 m from a cycle path (Bosch van Drakesteinpad), the bike sat in the 1 px
notch between the two corridors, and every step onto the path was taken back.
The shoulder now cancels motion only when `excessAt` (distance past the edge
of the whole surface) grows. The heading ease still runs on the shoulder: when
it was skipped too, the desktop harness lost 5 arrivals. Full sweep: 2,875 of
3,006 arrive (2,867 before), wedges only at the Fockstraat cul-de-sac
artefact. Bosch van Drakesteinpad and Jan Voermanstraat are fixed and named
in the sweep. Harness: desktop 109, iPhone 110, 0 pinned, 0 wedges. A junction
disc per graph node was tried and dropped: no extra fixes, and the extra
spans slowed the harness past its timeout.

## 2026-10-01 — Road guard: the surface is the union of corridors

Every bridge trap fixed through September was the guard judging containment
against one heading-picked road. That happened at a bridge way's end, at a
cross street, or beside a same-name duplicate, while the bike sat on another
corridor's asphalt. `pickGuardContact` now returns any containing corridor
(the heading picks among them) and, outside every corridor, the one the bike
is least outside of, with the corner fillet as before. The Marnixstraat
"a wider duplicate does not widen the corridor" rule is gone on purpose.

Measured: the bridge sweep, now snapping within 150 px so it drives 3,006
crossings, not 1,756, went from 37 wedges in 6 drives to 23 in 4.
Liesdelsluis, Gooiseweg and `routing_10632` are fixed. Driving harness: desktop
109/120 (111 before), iPhone 110/120 (104 before), 0 pinned, 0 wedges. The
named bridge set and route-surface coverage pass.

## 2026-10-01 — Da Costa study retired; city-expansion removed

The "Da Costa study" route had been hidden from players since 2026-09-28,
but the game still fetched its release on every load. vector-map.js loaded
`data/city-appearance/areas.json`, whose only area pointed at
`data/city-expansion/current.json`. It used that for appearance priors and
the optional study roof, facade, tree and public-realm renderers around Da
Costakade. At the user's request the study is gone. The route pattern, its
chip and icon, and the game-route branch are removed, and vector-map no longer
loads the catalog. `public/data/city-expansion/` (63 releases, 313 MB, 5 MB
current) is deleted from the tree, along with the study-route,
appearance-colour, wall-colour and camera-stability specs, the material
demo's owner-isolation test, the publication checks, and the study half of
complete-city.spec. A saved 'study' preference falls back to the default
pattern. The study renderer bundles still load in index.html but stay idle.
The city-appearance publishing scripts would write city-expansion again if
run. Dev pages that read city-expansion evidence (district evaluation,
reconstruction status, case 24) lose those images.

## 2026-10-01 — Hosting: deploys were failing on the storage quota

Every Firebase deploy from 2026-09-29 23:38 to 2026-10-01 14:00 failed with
HTTP 429 (Hosting storage quota exceeded). The live game therefore lacked two
days of bridge fixes while main had them. Each site kept 19 finalized versions
of ~300 MB despite maxVersions 10, so the 9 oldest per site were deleted and
the deploy re-run (2f18077 went live). Releases were ~300 MB because both sites
uploaded all of public/data, including 313 MB of old city-expansion builds and
the data for dev/eval pages. firebase.json now ignores city-expansion, signage,
rgb-city-demo, pointcloud-facades, facade-model-eval, elandsgracht,
da-costa-block, facade-materials, wall-colour, wall-materials and
facade-block-demo on both targets. The data stays in git and on the dev server.
city-appearance and every city extract stay hosted; the game loads
city-appearance/areas.json. The hidden Da Costa study route needs
city-expansion and now works only on the dev server, as the harness uses it.
After a push, check that <site>/deployment.json shows the pushed SHA before
calling a fix live.

## 2026-10-01 — Driving harness: the trail back-out driver

The harness driver used to reverse blindly for 1.2 s with the stick
reversed. Several of its "lost" drives were that reverse taking it into a
side way. It now backs out along the trail it actually rode, as the bridge
sweep's driver does, then replans from where it stops. It does this when
pinned, when facing away from the route, or when rocking in place. Desktop
arrivals rose from 103 to 111 of 120, with lost drives down from 11 to 2.
iPhone went from 103 to 104. Two variants were measured and dropped:
replanning whenever the driver is more than 60 px off the route, or more
than 150 px for 2 s (97 and 98 arrivals), and replanning after 10 s without
progress (109, with lost drives turning into timeouts).

## 2026-10-01 — Bridges: the full sweep at zero; every planned edge on the road

- **The sweep driver backs out the way it came.** After the earlier fixes,
  the full sweep still had 61 pins on 14 crossings. All were the test driver
  reversing blindly into the tip of a short side way, then nosing forward
  into it again. It now keeps a trail of where it actually rode, every 8 px,
  which is always on the road. When stuck it reverses ~50 px back along that
  trail, further on each retry, then plans again from there.
  `BRIDGE_SWEEP_ALL=1` now gives 0 pins and 0 traps over all 2,417 bridge
  ways, identical across runs, with 1,684 arrivals (was 1,661). It runs in
  ~1 min and asserts zero pins in both modes.
- **Planned edges now lie on the surface.** The graph merges vertices into a
  node at whichever vertex arrived first, so an edge between merged nodes
  runs up to a cell diagonal (~25 px) beside its span. On long spans the
  planned line left the corridor mid-way. These were the two stretches
  `route-surface-coverage` had allowed: an unnamed way in Westpoort, and
  Geldershoofd. Which vertex arrives first depends on load order, so they
  failed on some runs only. The graph now adds the planned edge itself as a
  connector span whenever either end was merged off its vertex. Coverage is
  0 uncovered edges and allows no exceptions.
- **Guard contacts prefer the parallel road the bike is on.** If the bike is
  nearer a parallel road's centre than the aligned road's, that parallel
  road counts as the road it is on. The Marnixstraat busway check still
  holds.

## 2026-10-01 — Street-name origins: the earlier paid model pass reviewed

The first 673 cache entries ('s-Gravelandse Veer to Boomstraat, 480 distinct
Dutch texts) came from the paid OpenRouter pass (`anthropic/claude-opus-5.5`)
and had never been checked against the Dutch. All 480 are now reviewed, and
the translations were faithful almost throughout. 28 texts (32 cache
entries) are corrected, tagged `+corrected`:
- **19 register errors**, now in section 7 of
  `docs/amsterdam-street-name-register-errors.md` with BAG ids:
  - Bergen-Belsen called an extermination camp;
  - Dias at the Cape in 1486 (it was 1488);
  - Bering's strait in 1741 (1728);
  - Arkhangelsk on the Barents Sea (the White Sea);
  - Leitrim in Northern Ireland (it is in the Republic);
  - Ameland in Noord-Holland (Friesland);
  - Arago "discovering" electromagnetism;
  - Avogadro's law in 1814 (1811);
  - Bach's "more than four hundred" cantatas;
  - Bontekoe dying in 1618 (1657);
  - Beloega described as the beluga sturgeon on a street among whale names;
  - Ben Viljoen's "unknown" year of death (1917, sourced).
- **One fragment:** a second Bickersgracht record stops at "Voor het".
- **Translation slips by the model:**
  - dates attached to the wrong person (Anna van Buren, Anna van den Vondel,
    Germez, Entens);
  - geuzen at Breda as "Sea Beggars";
  - Bogor's "ruim duizenden" soorten as "well over a thousand";
  - "Amsterdamse School" left in Dutch twice.

Dated but true-at-the-time facts are kept as the register has them, as in the
hand retranslation: the municipality of Schoorl, the province of Brabant, the
six islands of the Netherlands Antilles.

## 2026-10-01 — Bridges: filleted corners pull the right way; the 13 leftover crossings cleared

The 13 crossings that still pinned the bike after the 2026-09-30 fixes had
two causes:
- **The guard (Kortrijk, IJdoornlaan, Pracanalaan).** Inside a filleted
  corner, `pickGuardContact` reported the filleted edge distance but kept
  the raw nearest point, which lies across the corner. On a sliver of fillet
  shoulder, the soft-edge pull, and the outward step it takes back, ran
  toward that point and cancelled the whole step, so the bike stood at the
  corner. The contact's point now sits on the arc's inward normal, the
  gradient (r − eA)·ûA + (r − eB)·ûB.
- **The test driver, at dead-end stub tips, sharp bends and narrow corners.**
  It started at the tip of a 25 m service stub, or kept aiming at a route
  point behind it. The driver now behaves like a player: it skips stub tips
  as start and finish points, and when stopped or rocking in place it backs
  out, steering toward the route. A pin counts only after 4 s of going
  nowhere, recovery included.

The named set stays at 0 pins. Of the 13 crossings, only Zuiderzeeweg still
pins, at a sharp bend in a 3 m path where all 344 poses can ride away. The
full sweep now has 61 pins on 14 different crossings, because skipping stub
tips changes which routes get driven. It has 0 traps, and 0 of 2,408 poses
around those pins are stuck. The remaining pins are driver behaviour,
recorded in TODO.

## 2026-09-30 — Bridges: the surface covers what the router plans, and ended ways stop holding the bike

User reports: "my bike is entirely stuck on this bridge, can't move at all"
and "please make sure to fix the bridge navigation once and for all". A new
sweep, `tests/e2e/bridge-sweep.spec.ts`, drives every bridge way in the
routing extract in both directions with the game's own physics and guard.
Before this change it found 416 pins on 33 crossings. It turned up three
separate causes:
- **The router plans across gaps the surface did not have.** `buildRoadGraph`
  merges vertices up to a grid-cell diagonal apart (~25 px) and stitches
  side streets onto through streets up to 10 px away, but the surface index
  held only centrelines. At the end of a bridge way (Karel van het Revebrug)
  the next street's corridor was out of reach, so the guard pulled the bike
  back. The graph now returns those gaps as `connectors`, and
  `buildRoadSpatialIndex` indexes each one as a span with its way's width
  (`ptIdx` -1).
- **An ended way kept holding the bike.** `pickGuardContact` judged the bike
  against the best-aligned contact and ignored parallel corridors, so that
  a Marnixstraat busway duplicate could not widen the street. But bridges
  are separate ways: where a few degrees of bend made the ended way the
  better heading match, its continuation was ignored and the shoulder pull
  drew the bike back to the ended way's last vertex. Now, when the aligned
  contact is an end vertex rather than a perpendicular projection, any
  corridor that contains the bike wins. Beside a span, duplicates still do
  not count.
- **The shoulder was a stable equilibrium.** The soft-edge branch cancelled
  outward velocity, but that frame's step had already carried the bike
  outward, and the inward pull on a shallow shoulder is ~1 px. A bike aimed
  off a way end stepped out as far as it was pulled in, forever.
  `constrainCarToRoad` now takes back the outward part of the step and keeps
  the part along the kerb.

After the change the full sweep has 161 pins on 13 crossings and 0 traps (a
trap: no input, reverse included, moves the bike 5 m). The remaining pins are
listed in TODO. By default the spec drives a named set: the Westeinde bridges
south of Frederiksplein, where the screenshot appears to be, plus ten bridges
that used to pin. Against the old bundles that set has 99 pins; with the
change it has 0. Also new:
- `route-surface-coverage.spec.ts`: every one of 158,104 graph edges lies on
  a rideable surface, bar two known < 1 px spans.
- `bridge-deck-poses.spec.ts`: every pose on the Westeinde deck can move.
- `pose-trace.spec.ts`: a single-pose diagnostic.

Also from a report the same day, "these dots everywhere are ugly and not
helpful": the game's own POI layer no longer draws dots, only names. A dot
drew for every POI from zoom 16, while the collision-thinned names drew for
only a few of them.

## 2026-09-30 — Street-name origins: retranslation complete

All 4,340 distinct Dutch texts that the game looks up are now retranslated
(`origin-translation-batch.ts status`: 0 left), and no published card uses
`trn` English any more. Two cards, Weteringstraat and Nieuwe
Weteringstraat, were missing from the batch source and were translated by
hand. The remaining ~1,400 register records without a retranslation are
names the game never shows.
- `docs/amsterdam-street-name-register-errors.md` lists 148 register errors,
  each with a link to its BAG record: 18 misfiled texts, 10 fragments, 15
  cut off at the end, 98 factual errors, 3 misspellings and 4
  search-and-replace hits. It is ready to send to the municipality.
- Newly withheld because the text is another name's: Scharwouderstraat
  (the Scharrebiersluis's beer), Scheepmakerskade (a bridge),
  Smallepadsgracht (the Smalschipstraat's boat) and Smaragdplein (the
  Smederij's smithy). The register's whole Trimurtistraat text is
  "Trimur: onafhankelijkheid"; the card now names S.K. Trimurti, sourced
  from en.wikipedia and the 2019 Centrumeiland naming. Broken edges on
  Vredenburgerbrug, Volewijckbrug, Wim Suurbierbrug and Sint
  Antoniesbreestraat are completed from sibling records that carry the
  same text.
- `ORIGIN_GLOSSARY` measured against the new English: 1 of its 451 rules
  still fires ("the allied nobles" on the three Geuzen names). That text is
  now fixed in the cache, so the glossary changes no published card. It
  still repairs `--trn` output and is covered by about 80 asserts, so it
  stays until someone removes it together with those asserts.
- Lesson: a supplement keyed `bridge` never matched, because the game looks
  up the Na Druk Gelukbrug as a street. The failed check went unnoticed
  because its output was piped through `tail`, and the commit went in
  anyway. Supplements are now keyed by the register record's kind, and
  commits are gated on the check's exit code.

## 2026-09-30 — Street-name origins: retranslating off `trn`

Random samples kept finding mistranslations in the on-device `trn` text (14
of 30 in one sample), so glossary patches were never going to catch up.
Street-name origins are now retranslated whole by a language model:
- `scripts/street-name-origin-translations-llm.json` stores one translation
  per distinct Dutch text (`nlHash`), fanned out to every name that shares it.
- Publishing prefers that text, trimmed to 700 characters, and falls back to
  `trn` (`--trn` forces the old text).
- `ORIGIN_GLOSSARY` and the generic-name rule still run afterwards. A diff of
  947 published names found nothing damaged: the generic rule still turns
  "The fruit." into "Named after the apricot, a fruit".
- The first 480 texts came from Opus 5.5 over OpenRouter
  (`translate-street-name-origins-llm.ts`). The glossary sits in its prompt
  under "only when that Dutch word is in the text": without that rule, a
  Sonnet pilot added a drained lake to Gooilust.
- The rest are translated inside Claude Code sessions, at no API cost, through
  `origin-translation-batch.ts` (`next` / `ingest`). `ingest` refuses a
  translation that loses a three- or four-digit number from the Dutch.
- A scan for register texts that start or stop mid-sentence found a few
  split entries. Pure fragments are withheld (`WITHHELD_ORIGINS`):
  Dirk van Hasseltssteeg, Elim, Piet Wiedijkstraat, Hamerstraat (a paragraph
  of Piet Meerburg's biography) and Enny Vredestraat (the
  second half of Enneüs Heerma's biography, confirmed in the live API). Eilandsgracht is
  withheld too: it carries the Elandsgracht's text about tanning elk hides.
  Texts that are only cut at one edge are translated without the broken
  edge; the Dirk de Waterduikerbrug gets its missing second half back.
- One draft batch written after a context break had not been checked against
  the Dutch, and it "corrected" the source (Herschel's telescopes are
  seventeenth-century in the register). Each batch must be translated against
  its printed Dutch.
- Clear factual errors in the register are now corrected in the English, and
  every one is listed in `docs/amsterdam-street-name-register-errors.md`.
  User, asked whether "extermination camp Buchenwald" should stay as the
  register has it: "no, loose is fine". Doubtful cases stay as written.
- Names with missing, fragmentary or misfiled register text can now show a
  short text written from a cited source (user: "you can add facts (if you
  can find a source online like wikipedia) for entries that are missing
  data"). They live in `scripts/street-name-origin-supplements.json` with
  their URLs. A supplement beats both the register and `WITHHELD_ORIGINS`,
  and publishing refuses one that has no source. The first eight are
  Dirk van Hasseltssteeg, Eilandsgracht, Elim (a Moravian mission village in
  the Western Cape, not "tot Park Frankendael"), Enny Vredestraat (the actress),
  Gerrie Mührenbrug, Hamerstraat, Piet Kranenbergpad (one of the Olympic
  Stadium's rescuers) and Piet Wiedijkstraat. Each attribution was checked
  against the street's position, for example Elim among the South African
  names and Enny Vrede among the actresses in Slotervaart.
  Jaap Kunst's biography runs across three records; Jaap Nunes Vazstraat
  and Jaap Speyerstraat now show their own people. The register also shows
  a search-and-replace of "centrum" by "Amsterdam-Centrum" (Batavia, "het
  bestuurlijke Amsterdam-Centrum Azië").

## 2026-09-30 — Street-name translations: a random sample of 30, 14 wrong

A fresh random sample of 30 origins had 14 slips. Fixing them touched
24 origins:
- **Parliament.** The Eerste Kamer (the Senate) had become the "House of
  Representatives" in four biographies, including the first woman senator.
  The rule applies only where the Dutch names the Eerste Kamer alone.
- **Named places.**
  - The Paleis voor Volksvlijt keeps its name; it had been "the Palace of
    Public Enterprise/Industry" in four versions.
  - The Hoge Sluis keeps its name, not "the High Lock".
- **Words.**
  - The city's cannon foundry (geschutgieterij) had become a "gunpowder"
    foundry.
  - Broodfabrieken are bread factories, not bakeries.
  - Conrad planned a cut through the Isthmus of Suez, not "the dredging of
    the Suez Canal".
  - A werelddeel is a continent, and kernen are villages.
  - The Nieuwe Amstelbrug sentence is rebuilt.
- **A second sample of 30** had fewer slips, since the earlier rules
  already caught several:
  - An inlaagdijk is a dike set back behind the old one, not "a fill
    embankment".
  - "Vernoemd in Zwaansvliet" means renamed Zwaansvliet, not "named in"
    it.
  - The nadir is directly below the observer, not "perpendicular to" them.
  - Stuurmanskunst is navigation.
  - Burgersdijk's natuurkundige is a physicist, not a "naturalist".
- **Twelve of the 100 long origins** (over 500 characters) were read whole:
  - The walen were inlets of the IJ that silted up. The text said "the
    quays were ancient harbors" made "shallow by dredging".
  - Anna Paulowna became Hereditary Princess (erfprinses), not "Princess
    Royal".
  - The Zwanenburgerstraat was demolished (geamoveerd), not "relocated",
    for the Stopera.
  - Hecht en Sterk recruited no contract labourers, not "contractors".
  - The Rokin text now explains the 'ruck in' that names the street.
- **Twelve more long origins:**
  - Van Mierlo sat in the Senate, not in "the House of Councillors", which
    is Japan's upper house.
  - The Oostenburg streets were formally abolished (vervallen verklaard),
    not "declared abandoned".
  - The Quakers gathered outside the walls because they had been expelled,
    not "so that they could gather".
  - The Kalverstraat calf-market sentence is rebuilt.
- **Bridge origins, 16 read.** A vaste brug is a fixed bridge, as against a
  movable one; 15 cards called it "permanent". The Zilveren Penning is a
  silver medal, not a "Silver Pen". The koek-en-zopie stalls on the ice
  (hot drinks and cake) had become "pie and soup stalls".
- **Water origins, 16 read.**
  - The IJ was an arm of the Zuiderzee and was closed off from it in 1872.
    The text said "the North Sea" both times, which reverses the
    geography.
  - Le Maire found a strait (zeestraat), not a "sea route".
  - Aangeplempt means built up with fill, not "drained".
  - "Op last van prins Maurits" means on Maurice's orders, not "at his
    request".
  - Amsterdammers say "het Singel", which is the point of that sentence.
- **Another 30 read:**
  - Ptolemy's theorem is about a cyclic quadrilateral (koordenvierhoek), not
    "a quadrilateral with coordinates".
  - 's-Graveland was dug out for sand (afzanding), not "a peninsula".
  - An uitspanning is a roadside inn. It had been an "amusement park" or an
    "entertainment venue" in 7 cards.
  - The Entrepotdok was a bonded warehouse, not a "transhipment point".
  - Van Tussenbroek took a doctorate (promoveerde), not a degree, and was
    an obstetrician, not a midwife.
- **Withheld: Piet Kranenbergpad.** The register gives it Piet Keizer's
  Ajax biography word for word, so the card would teach one footballer's
  record as another's. `WITHHELD_ORIGINS` names it with the reason, and
  `publish:street-name-origins` skips it until the register is corrected.

## 2026-09-30 — Review rides end on a due cul-de-sac, as "the mystery street"

A due court or cul-de-sac off every landmark line could not be ridden
through, so the planner refused it as a via and it never came up for review.
`pickReviewRoute` now offers the best such name as a *stop*: the ride ends on
that street. The stop travels as the last runner-up, so `choosePlannedReview`
plans it only when nothing ahead of it rides as many due names, and a via
that rides is kept over it.
- **Nothing reveals the name.** The destination is a `ReviewStopPoi` with a
  blank name and the street in `reviewStop`. The HUD and the briefing show
  `REVIEW_STOP_LABEL` ("the mystery street", as in "Pedal to the mystery
  street"). Arrival reveals the name. No nearby landmark claims the arrival
  card.
- **The finish is the court's dead end**, the end no other way touches, so
  the whole court is ridden.
- **Arrival waits for the question.** It waits while a question is open, and
  up to 2.5 s for one to open (`reviewStopHoldsArrival`). Otherwise a 30 m
  court inside the 80 px finish radius would end the ride before the
  question's 0.65 s delay.
- **A stop must be reached.** A stop the planned path does not ride (a court
  outside the routing graph) is rejected. The ride then ends at the nearest
  landmark, so it never aims at a finish the rider cannot reach.
- **Measured:** of 20 courts and paths off every landmark line, 13 are
  reviewed (10 as stops, 3 as vias). Before, courts like these went
  unreviewed. Zeevaarthof (Noord) is pinned in `tests/e2e/review-ride.spec.ts`,
  including the held arrival and the reveal.
- The "routes along a due street it would otherwise avoid" spec rode one
  random route, and about one route in three has no side street inside the
  cap. It now tries up to three routes.

## 2026-09-30 — Street-name translations: rare openings read one by one

Openings that occur once or twice were read against the Dutch; 61 origins
changed.
- **A factual error.** The Bosporus was "The Sea of Marmara"; the Dutch
  says a strait (zeestraat).
- **Waterbouwkundigen** built dikes and canals. They are hydraulic
  engineers, not "hydrologists"; this touched 10 origins, including Lely and
  Vermuyden.
- **Words read literally.**
  - Droogmakerij (a drained lake) had become "drying plant", klokkenspel
    (carillon) "clock game", and zeegat (tidal inlet) "sea gap".
  - Hefschroefvliegtuig had become "elevator aircraft", ruiterhoofdman
    (cavalry captain) "rider chief", and a jonkheer a "baron".
  - Walvisachtige, a cetacean, had become "whale-like".
- **Ships.**
  - A paddle steamer had become "a vehicle propelled by propellers".
  - Leeboards (zwaarden) had become "side swords".
  - The schokker, which is related to the botter, was "related to the hull".
- **Second pass (26 origins).**
  - A spinnaker is set dead before the wind; the text said "directly into
    the wind".
  - Octane is a hydrocarbon, not "carbon monoxide".
  - The Oude Houthaven was dug (gegraven), not "buried".
  - The zwarte pad is a toad species, not a "fungus species".
  - A kwelder is silted-up land outside the dikes, not "extensive land
    reclamation".
  - Brievenroman is an epistolary novel, hoogbootsman a chief boatswain, and
    ridderhofstad a knightly manor.
  - The first conductor of the Concertgebouw Orchestra was a musician
    (toonkunstenaar), not a "visual artist".
- **Others.**
  - Bonkaarten (ration cards) had become "bonka cards".
  - A voormalig buiten (former country house) was "formerly outside", and
    "Herinnert aan" was "Reminds me of".

## 2026-09-30 — Street-name translations: opening words read literally

Pairing each Dutch opening word with its English opening found more
systematic slips. Together they cover 49 origins:
- A meer is a lake: "More, located in southern Friesland".
- A buurtschap is a hamlet, not a "neighbourhood".
- A zijrivier is a tributary, not a "side river".
- A waterstroom is a stream, not a "water flow".
- A geuzenkapitein, a Sea Beggar captain, had become a "Guerrilla" or
  "Guzen" captain.
- Passeren, the dressing of Spanish leather, had become "Passing".

## 2026-09-30 — Street-name translations: "Naar de …" is "Named after", not "To the …"

The translator rendered every opening "Naar de …" ("named after the …")
as "To the …": 123 origins read "To the city of Rotterdam". A glossary rule
now rewrites the opening whenever the Dutch starts with "Naar ", including
"To a …" and "To 'the princely title'". A herenhuis is a country house,
not a "Men's house", and the Hem became an island as its shore washed away
(oeverafslag), not "due to a river bend". Reading
those 85 distinct texts turned up more slips:
- An uitspanning, the Schollenbrug inn, had become "the extension".
- Vastenavond (Shrovetide) had become "Good Friday".
- The Kapelstegen had become "Chapel Stops".
- The Kerksteeg alleys had become "steps".
- Huidenhandel is the hide trade, not the fur trade.
- The Panama Canal was dug "through" the isthmus, not "by" it.
- The VOC's imported spices had become "the spices mentioned".

## 2026-09-30 — Street-name translations: plants read as a group, and the Kadijk

The plant streets were read together, as were the Plantage and Kadijk
streets that share a text; 60 origins changed.
- **Plant families.**
  - The translator had swapped several families. Anjelier is in the pink
    family, not the rose family. Dille and koriander are umbellifers, not
    asters. Kleefkruid (cleavers) is in the bedstraw family, not the
    Asteraceae. Ogentroost is in the figwort family, not the mint family.
    Muurbloem is a crucifer, not a "cruciferous vegetable".
  - Korte Papaverweg said papaver "is also called buttercup". It is the
    klaproos, the corn poppy.
  - Vossenbes is the lingonberry, not the red currant. Kaasjeskruid is
    mallow, not "cheese herb", and monnikskap is monkshood.
- **Source error.** Zilverschoon (silverweed) is in the rose family; the
  register says the buttercup family.
- **Words read literally.**
  - A kadijk (quay dike) had become "canal". The Laagte and Hoogte Kadijk,
    both street names, had become "the Lowness and Height of the Canal".
  - The harbour booms (bomen) and the boom bell had become "trees" and a
    "tree bell". Bongerd, an orchard, was a "tree garden", and a hogeboom
    footbridge was "a high tree".
  - The bullebak (a bogeyman) was a "bull's head", and a gouw was a
    "county".
  - Ontvening (peat digging) had become "draining", and the lift bridge it
    served a "loading bridge".
- **People.**
  - Domela Nieuwenhuis was a Lutheran minister, not "Luther's pastor", and
    went from socialist to anarchist.
  - Van Marum built an electrostatic generator, not an "electroplating
    machine". Johannes Post led knokploegen (armed squads), not "strike
    groups", and died after a raid on the remand prison, not a "robbery of
    the Prison House".
  - Hilbert van Dijk was a milk seller, not a "milk slicer".
  - Quashiba's partner went back "five years later", not "five years ago".
  - The Tante Saar text gets back its dropped last sentence.

## 2026-09-30 — Street-name translations: read by theme (trades, cloth, animals)

Errors cluster in themed street groups, so whole groups were read at once:
- **Trades** (Noord shipyards, Bickerseiland). A breeuwer is a caulker. The
  Breeuwersstraat text had said brewers sealed the ships' seams. Cable
  splicing had become "welding", and the rivet boy "indicated the rivet for
  sounding" instead of handing it to the riveter.
- **Cloth.** Laken is woollen cloth, but every Raam/Verver/Staal text said
  linen. The lakenververs (cloth dyers) had become "linen merchants", and
  the drying frames "windows".
- **Animals.**
  - A gierzwaluw is a swift, not a swallow. A goudvink is a bullfinch, not a
    goldfinch (the putter or distelvink is the goldfinch). A tuimelaar is a
    bottlenose dolphin, not a spinner.
  - Lepelaars are spoonbills, not storks, and an eidereend is an eider, not
    a mallard. The strandpluvier is the Kentish plover, the zilverplevier
    the grey plover, and a mees (tit) is not a sparrow.
  - Brem and klaver are in the pea family (vlinderbloemfamilie), not "heather
    of the daisy family".
- **Geography.** Spitsbergen is in the Arctic Ocean, not "the North Sea".
  Schorren are silted-up land, not "eroded". "Enige kreken" are some creeks,
  not "the only ponds".
- **Source error.** The register's Beloega text describes the beluga
  sturgeon (Caspian Sea, 1,400 kg, a century old) under the white whale's
  name. The street is among the whale streets, so the card now describes the
  beluga whale.

`street-name-stems.json` was checked for the same species slips and is
correct.

## 2026-09-30 — Street-name translations: rare-word scan finds opposites

A new pass lists English words that occur in only one origin and reads the
odd ones against the Dutch. Mistranslations cluster there. Found:
- **Opposites.** Kiek's snapshot is "unpretentious" (pretentieloos), not
  "pretentious".
- **False things.** A trilhaardier is a ciliate, not a trilobite. Lallement
  put pedals on a draisine (loopfiets), not on a "tricycle". A verspieder is
  a spy, not a "wastrel". A vroedschapsresolutie is a city-council
  resolution, not a "maternity resolution" (vroedvrouw is midwife).
- **Source wording.** The register's "atoomtemperatuur" for Dulong is the
  heat capacity per atom.
- **Smaller fixes.** A grietman is a Frisian magistrate. A kinderwagenbouwer
  made prams. The house was "where the sign of Swanenburg hangs". Havenkom
  means harbour basins.
- **Clock time.** The year-read-as-clock-time repair now also catches
  "4:00 PM" (Zwanenburgwal: "just before 1600").
- **Second rare-word round.** Heer Halewijn murdered women; he was no
  "female murderer". Hekelveld's flax was hackled, not bleached, and made
  into rope on ropewalks, not "railway lines". A schuttersvaandrig was the
  civic guard's standard-bearer, not a sharpshooter. A kaatsbaan is a court
  for kaatsen, not a billiards hall. Lakenramen are tenter frames, not
  "linen windows". The author H.J. Schimmel is not "H.J. mould". The oneven
  side of a street is its odd-numbered side. The illegaliteit was the
  resistance.
- **Third rare-word round.** A mill's cap is turned into the wind (verkruid)
  from its stelling; the mill is not "watered". Silene is in the pink
  family, not the daisy family. Harry Diesveldt was an Engelandvaarder, not
  "an Englishman". Maagdenpalm is periwinkle. Vice-admiral Claeszen blew up
  his ship rather than being "flown into the air". The sandbank Razende Bol
  is no "Furious Ball". Also fixed: the valreep (gangway), veem
  (weigh-house porters' guilds), the gouge (guts), the punch (ponsen),
  pistils, and Van der Heijden's fire engine with a hose.

## 2026-09-30 — Street-name translations: a right back, a killer whale, filled in not renamed

Six more reading passes (about 150 origins) found renderings that taught
something false. Each is now a glossary repair tied to the Dutch that
triggers it:
- **People.** Wim Suurbier was a right back, not a "lawyer and defender"
  (rechter = right, and also judge). His European Cup wins had become Cup
  Winners' Cups. An alderman (wethouder) had become "a member of
  parliament". Jhr. is jonkheer, not "Mr."; a griffier is a clerk, not a
  treasurer; a thesaurier was the city treasurer, not a "thesaurus".
  Hoofdingeland was rendered "head country".
- **History.** "Gedempt in 1866" is filled in, not renamed. "Gedempte" is
  filled-in, not "drowned". A street "overgekomen onder de naam Ringlaan"
  came over under that name; it was not renamed to it. A party "illegaal
  geworden" was outlawed, not "illegally established". Boerengeneraals were
  Boer generals.
- **Things.** A zwaardwalvis is a killer whale, not a swordfish. Zoutketen
  are salt sheds, not "the salt chain". A wiegbrug rocks and does not swing.
  A vonder is a plank footbridge, not a viaduct. An overtoom hauled boats
  over a dam; it was no quay. Fonteinkruid is pondweed. Vloeistaal is
  Bessemer steel.
- **Places and names.** "Kasteel onder Mill" is near Mill, not "under" it.
  The fix applies only after a place word, so "vice-admiral under De
  Ruyter" stays. The translator had renamed Betondorp "Betonstad", the
  Uitweg "The Exit", the Oude Looierssloot "Old Tanneries Canal", and "Derde
  Looiersdwarsstraat" "Third …". Ordinals in street names now stay Dutch
  (`dutchOrdinalStreetNames`). The Tweede Kamer is the House of
  Representatives.
- **Source errors.** The register gives George Vancouver as (1758–1790); he
  lived 1757–1798. It calls Bergen-Belsen and Buchenwald extermination camps;
  they were concentration camps (Sobibor and Treblinka stay extermination
  camps). It credits Philip Vingboons with the Trippenhuis, which his
  brother Justus designed.
- **More renamings by the translator:** Danzig became "Gdańsk (now
  Gdansk)", a plotter became a typewriter, and Korte street names became
  "Short".
- **Also:** Charley Toorop's Expressief Zakelijk Realisme is objective, not
  "Business" realism. The achtste finale is the round of 16. Werelddeel
  became continent, Nederlandse Antillen the Netherlands Antilles, and
  verbasterd "corrupted", not "simplified".

## 2026-09-30 — Trivia audited against its own quotes; two false sentences struck

Every published fact (4,052 across four cities) carries the source quote it
was written from. Two mechanical passes read each fact against its quote:
- **Numbers the quote lacks.** 8 facts: 7 derived ("two days later" → 16
  December) or context (house numbers), and one real error.
- **Capitalised names the quote lacks** (sentence-initial words and common
  nouns excluded). 69 facts, mostly first names filled in from the article.
  It also caught an inversion.

Struck through the review files' `drop` lists, each with a note so a person
can undo it:
- **Python Bridge.** "Unlike the nearby Lage Brug, this structure lacks high
  elevation to accommodate cyclists." The quote says that of the Lage Brug.
  The Python Bridge is officially Hoge brug. It was the feature's only
  sentence, so the feature leaves facts.json, by design (no empty cards). Its
  card keeps the Wikipedia extract and, since today, bridge register 1998.
- **Den Haag, 'Grenadiers en Jagers'.** "Seventh-grade students … attend its
  annual May 10 ceremony." Groep 7 pupils are 10–11, and the quote names no
  date.

A full read of Amsterdam's name list struck two more: Vrijheidslaan "named
in 1946 after leaders who defeated Nazi Germany" (in 1946 it became
Stalinlaan; Freedom came later) and Marinehaven "Unlike Zeebrugge…" (not in
the quote). `scripts/audit-fact-quotes.ts` reruns both passes.

Publishing re-ran for both cities. The diff is exactly those sentences (and
the emptied feature). `check-facts.ts` keeps both out of a later republish.

## 2026-09-30 — Fix: the songbird repair unnamed ten birds

The glossary's "singing bird" → "songbird" repair (earlier today) runs before
`nameGenericOrigin`. Its class list only knew "singing bird", so ten streets
lost "Named after the tit, a singing bird" and read just "The songbird."
(Mezenstraat, Kanariestraat, Koekoeksplein, …). "songbird" is now a class
too. A check runs repair then rewrite in the publish order, and a diff
against the published file from before the glossary work shows no other
"Named after" text was lost.

## 2026-09-30 — Street-name translations: Grand Pensionary, boezem, umbellifers

A targeted pass looked up Dutch words with known false friends, and Dutch
words left in the English. Fixed: raadpensionaris is the Grand Pensionary
(De Witt, Heinsius), not a "council pensionary". A ringvaart is the polder's
storage basin (boezem), not its "bosom". Turf ships carried peat.
Schermbloemen are umbellifers (the carrot family), not a "screenflower
family". Reed beds replace "reedlands".

## 2026-09-30 — Street-name translations: laying out, not demolishing; the Intercontinental Cup

A read of 16 long origins found more false renderings, now fixed in 29
published origins:
- **Oostenburg.** "Rooien van de straten" is laying streets out, not their
  demolition. "Aan het openbaar verkeer onttrokken" is closed to public
  traffic.
- **Tuiger.** A tuiger rigs and unrigs ships; they do not hoist and lower
  them.
- **Schout.** Jan Arentsz Schouten was the schout (sheriff), not an
  alderman.
- **Wereldbeker.** For the Ajax players this is the Intercontinental Cup.
  Neeskens, Krol, Suurbier and Blankenburg never won the World Cup.
- **Indisch.** Indisch recht, spoorwegen, verhalen and Partij belong to the
  Dutch East Indies, and the West India Company keeps its English name.
  Indische muziek (Coltrane) and Indische talen (Kern) stay Indian: each fix
  names its own phrase.
- **Smaller fixes.** Procureur is a solicitor, not a prosecutor. Noordse Bos
  is a name, not a "North Sea Forest". Rode and rooien stay Dutch, and
  Papiaments is Papiamento.

## 2026-09-30 — Street-name translations: annexation direction, a ferry, the Sea Beggars

A random-sample read of 55 origins found more renderings that taught
something false. `ORIGIN_GLOSSARY` now fixes each wherever the Dutch says
the word, correcting 88 published origins:
- **Annexation direction.** "Van de gemeente Nieuwer-Amstel overgenomen" is
  taken over *from* that municipality when Amsterdam annexed it, not by it
  (Vondelkerkstraat, Jacob Obrechtstraat, Frederiksstraat).
- **Things that were not so.** A pont is a ferry, not a bridge (Valkenweg).
  The watergeuzen were the Sea Beggars, not "water gunners". Grotius escaped
  in a book chest, not "through a bookcase". Gelei is jelly, not
  "yellowish". The Wetering flowed *into* the Spui. Hulppersoneel are
  domestic staff.
- **English names.** The Anglo-Dutch Wars, the Battle of the Downs (Duins),
  Geuzen (not the French Gueux), Zeeland admirals, alderman, Groningen
  borgen, continent (werelddeel), songbird.
- **Mangled professions.** "Literary (1876–1931)" becomes "Man of letters";
  "natural and chemist" becomes "physicist and chemist"; "maritime,
  scientific and astronomical" becomes "navigation expert, mathematician and
  astronomer".
- **Grammar.** "a inn" and "a embankment" become "an", limited to listed
  words.

The Amsterdam Canon (49 windows) was checked as a stop source. The API holds
only year, title and place. The window text is on amsterdam.nl behind a bot
check, so it was not scraped.

## 2026-09-30 — Review rides reach due streets off every landmark line

A review ride runs between two landmarks whose straight line passes due
names within 200 m. Measured over the routing extract, 731 of the 2,932
street names within 4.5 km of the centre (25%) are farther than that from
every landmark-pair line, mostly in Noord and the outer districts. A due
street there never came up for review again. At a 1.3× straight-line slack,
every one of those 2,932 names lies in some pair's ellipse.

**Selection.** `pickReviewRoute` offers each pair the due name that no line
covers and that the pair detours least for (`REVIEW_VIA_SLACK` = 1.3). The via
counts with the line names. The briefing still only counts; the via is
snapped under a blank name.

**Planning.** `planLearningRoadRoute` takes `via` as a point, a stretch, or
a list of stretches. It plans start → stretch → finish and keeps the result
only when both hold:
- it is at most 40% longer than the shortest direct ride (`viaDetourRatio`);
- no node repeats. A repeat means riding back out of a dead end, or round a
  lollipop to a junction already passed, which also confuses the live route
  line.

A single point failed on real data. The game's segments are two-point
pieces, so a "midpoint" is a junction. The ride would reach it and turn back
whenever the finish lay behind it. Avenhornstraat was refused on all 11
segments. So the game passes stretches of the street (`_reviewViaPoints`):
the longest first, since long pieces are more often through streets, within
800 m of the due centre, up to 8. The planner drops stretches that end in a
dead end (a node of degree 1) and tries three of the rest, each in its
likelier direction first.

**Measured.** 30 of the 731 uncovered names were each given a real ride. 16
are now reviewed; before this change none were. Most refusals are streets
the rules should refuse: courts ("…hof"), cul-de-sacs, service roads,
pedestrian squares, or cases over the 40% cap. A refused via costs at most
~200 ms per planned candidate on desktop.

**Cost.** A via plan costs about 95 ms against 85 ms for a direct plan (a
100k-node graph, desktop), because legs skip the biased second pass.
`choosePlannedReview` also skips a candidate whose line passes no more due
names than the best planned path already rides. The ~1.2 s seen on the first
plan is the routing graph being built, which every ride pays anyway.

Pinned by `check-road-graph.ts` (through, cap, dead end, lollipop, stretch
direction, list, empty list), `check-play-delight.ts` (via selection and
planning, a refused via is not ridden) and `review-ride.spec.ts`
(Avenhornstraat ridden with a detour under 40%, and not named in the
briefing).

## 2026-09-30 — Bridge register: reviewed aliases; the other refusals checked

The build left 11 named bridges undescribed as ambiguous. Each was read
against the outlines it touches:
- **Three are aliases** of the register's official names. Python Bridge is
  Hoge brug (1998), Zeilbrug is Zeilstraatbrug (348), and Zouthavenbrug is
  Willem Breukerbrug (2326, renamed in January 2024). `REGISTER_ALIASES` in
  `bridgeRegister.ts` records these with their sources. An alias is accepted
  only when an outline under the way carries that register name. 249/300
  bridges are described.
- **Six refusals are right.** The bird bridges (Gierzwaluw-, Goudvink-,
  Groene spechtbrug) only brush their neighbours' outlines. The Rozenoord
  metro and rail bridges run beside the Rozenoordbrug road bridge.
  "Entrepotdok" is a quay name on a way over the Armand Sunierbrug lock
  bridge.
- **Two are road names over several bridges**: Jan van Galenstraat and
  Radioweg. They would need per-crossing facts (TODO).

## 2026-09-30 — Card chips fit a 320 px phone

The "Landmark Card Mobile" story expanded its card into the desktop panel, so
it never showed what a phone draws. With the story switched to the touch card
(`landmark-card-touch`), the new screenshot check found an overflow. At about
300 px of card, CHURCH + W WIKIPEDIA + MORE ran past the text column, and
"+ MORE" was clipped. That is the one chip saying there is more to read.

`fitBadges` in `noticeCards.ts` now fits the row to the column. It shortens
the Wikipedia chip to "W" first, then drops chips in the order article, fact,
category, language. MORE is dropped last. `check-notice-cards.ts` pins the
narrow case, and also the wide case, where every chip keeps its full label.

## 2026-09-30 — Storybook states are screenshot-compared; the finish stories were blank

`tests/e2e/storybook-visual.spec.ts` loads each story from the production
Storybook build (served by the dev server from the repository root) at the
viewport the story declares. It compares each one against a committed
baseline. Of 45 route-setup stories, 40 are covered and hold across repeated
and parallel runs. The five desktop briefing screens are left out, because
their photo backdrop makes each baseline 1.5 MB.

The first baselines turned up a broken state. Every finish-card story
showed an empty dimmed map, byte-identical across all four variants.
`_renderFinish` counts transit lines and stops, which the story's fake
exploration snapshot never had, so it threw. The story now provides them.
Byte-identical baselines are a cheap check for this: two stories that should
differ but don't are rendering nothing of their own.

Reading every baseline by eye found two more broken stories:
- **Recall prompt:** `_openQuizPrompt` returns early without a bike, and a
  story never starts a ride, so no question showed. The story now provides a
  stand-in player, and pins the shuffle so the choice order is stable.
- **Steering HUD:** the story read `CanalRecallUi` from Storybook's window
  instead of the game frame's and threw before drawing the pad.

The pad also exposed a tolerance problem. At 1% and the default per-pixel
threshold, a missing d-pad still passed: its translucent base sits within
the colour tolerance of the pale map. The comparison is now 0.1% of pixels
at threshold 0.05, and stays stable across repeated parallel runs (120/120).

Re-baseline after an intended change:
`npm run build-storybook && PW_PORT=4388 npx playwright test tests/e2e/storybook-visual.spec.ts --update-snapshots`.

## 2026-09-30 — a third pass: historical terms, and cross-references a card cannot follow

A second noun-pair scan, over trade and office words, found more literal
renderings that taught something false:
- "uitleg" (a city expansion) came out "explanation" in 15 texts, the
  Herengracht among them ("belongs to the explanation of 1658");
- the Kloveniersburgwal's kloveniers, a company of the civic guard named
  after their klover (culverin), came out "a part of the artillery that was
  called crossbowmen … a field snake";
- schuttersstukken (civic guard group portraits) came out "hunting scenes"
  and "gunfight scenes" for Frans Hals and Govert Flinck;
- kuiperij (cooperage) came out "brewery";
- dijkgraaf (dike reeve) came out "dam engineer";
- schout-bij-nacht (rear admiral) came out "night commander";
- also stadtholdership, Allotment Gardeners, jetties, and "demping en
  overwelving" → "filling in and vaulting over".

`withoutCrossReference` handles register references:
- a trailing "See Boomgaardlaan." goes, because a card cannot follow it;
- register index noise ("Blancplein, Mont See Mont.") goes;
- an origin that is only "See Rozengracht." borrows that street's text, once.

Reading the best-known streets' cards turned up more:
- Herengracht's "Lords Regulators" are the Heren Regeerders, the ruling
  lords;
- the Zeedijk's "sleeping wall" is a slaperdijk, a sleeper dike;
- Rokin's "dammed": the filled-in guard had matched the Dam square, and now
  requires afdammen;
- "Linebaan" should read Lijnbaan;
- "Foreburgwal" should read Voorburgwal;
- the "Old Wall Church" is the Oude Waalse Kerk;
- a reference in the middle of a text ("See further …", "See there.") now
  goes too.
- the Oudeschans "bastion" is a rampart (schans; bastion is bolwerk);
- Ferdinand Bol's "regency portraits" are regents' group portraits;
- the Lauriergracht now names the laurel.
- the Eerste Kamer is the Senate, not the "House of Lords";
- a schutterij is a civic guard, not a "shooting club";
- the klovers of 1522 were arquebuses, not "rifles or crossbows".

The full e2e run after tonight's work passed 150, skipped 58 and failed 10.
All 10 failures are in the appearance lane and were already on the board.

## 2026-09-30 — a second pass over street-name translations: "filled in", aldermen, and a mis-filed record

A scan paired Dutch nouns with the English each should produce and flagged
the origins where the English lacked it. Findings:

- **Dempen.** Filling in a canal came out as "demoted", "flattened",
  "straightened", "canalized", "Muted" (capital M, which the lowercase fix
  missed), "dampening", and "after flooding", the opposite. The repair is now
  case-insensitive and covers all of these. Each rendering is kept where the
  Dutch has its own word for it (recht → straightened, overstroming →
  flooding).
- **Schepen van de stad** (alderman) came out "captain of the city"
  (Realengracht).
- **Voor de stadsuitleg van 1593** came out "For the city tour of 1593"
  (Haarlemmerstraat).
- **Burgemeester van Amsterdam** was left in Dutch (Tellegenstraat).
- **The Oudezijds Voorburgwal street record is the Nieuwezijds text.** The
  municipal register filed it under the wrong street, which is why it says
  "zie Oudezijds Voorburgwal" about itself. `refersToItself` now drops such
  records. The street then takes the canal's own story, since the runtime
  falls back from street to water.
- **Five texts had no English** because each translation renamed the street
  itself: Lastageweg, Nieuwe Oostenburgerstraat, Oudezijds Voorburgwal (water),
  Sarphatipark and Sarphatistraat. They are hand-translated in the cache as
  `source: "manual"`.

All of these are pinned in `check-street-name-origins.ts`.

## 2026-09-30 — thin street-name origins name their word; three false translations fixed

A playtest card for Tweede Egelantiersdwarsstraat read, in full, "The shrub."
The register's own text is "De heester.", which only helps a rider who knows
that an egelantier is sweet briar. 177 origins name nothing but a class like
this. The Jordaan flower streets, the Bird and Tree districts and the
Tuindorp fruit streets are most of them.

- `scripts/data/street-name-stems.json` holds 67 hand-reviewed stem meanings
  (egelantier → eglantine (sweet briar), iepen → elm, kievit → lapwing…).
- `nameGenericOrigin` rewrites only a bare whitelisted class, and only for a
  known stem: "Named after the eglantine (sweet briar), a shrub." That
  covers 98 origins. Unknown stems (Duinbeek) and real sentences are left
  alone.

Reading the list turned up translations that taught something false. Each is
now fixed through `ORIGIN_GLOSSARY` and pinned in
`check-street-name-origins.ts`:
- Pruimenstraat said "the fruits of the pear tree" (pruim is plum);
- Mussenstraat said sparrows "belonging to the sparrows" (the Dutch says
  finches);
- Fazantenweg and Kalkoenstraat said "The chicken." (hoender: fowl).

## 2026-09-30 — naming the water at a bridge earns the water's card

Found in a screenshot playtest of a bike ride. After "Which waterway are you
crossing?" was answered correctly, no card came, and a drive-by landmark
filled the slot. `submitAnswer` showed the route card for streets and the
bridge card for bridges, but nothing for `crossing-water`. On a bike that is
the only moment a canal's name is learned, so 227 water origins (Singelgracht,
Amstel…) never appeared in bike mode. The water card now follows a correct
water answer. `crossing-quiz.spec.ts` asserts the Amstel card, then the
Magere Brug card, along the real answer path.

## 2026-09-30 — the other three cities ride end to end in e2e

TODO item 11 still said the runtime hardcoded Amsterdam, but the city
selector shipped earlier (see "Full city selector" below). Nothing had
driven the other cities since. `other-cities.spec.ts` now starts a bike ride
in Utrecht, Rotterdam and Den Haag and checks, for each:
- the city id;
- both landmarks within 15 km of the centre;
- a planned path and a spawn on the network;
- no uncaught errors from the Amsterdam-only files that city lacks.

All three pass. The TODO item is now about content.

## 2026-09-30 — cold-open review stays off: review rides are the location-honest version

The reopen condition for the cold-open (2026-09-07) was that a due name be on
the ridden corridor, or shown. Review rides now meet it more directly:
- with Plan review on, the pair is chosen and planned for the due names it
  rides, and the router takes them within a 25% detour;
- the route quiz asks every street the rider settles on unless
  `isSuppressedHere` holds it back, which it does only inside the review
  interval. So each due street on the path is asked with the bike on it.

A "Review — what is this place called?" prompt in the first minute would
repeat that without location. `COLD_OPEN_ENABLED` stays false, and the
reopen item is closed.

## 2026-09-30 — the driving harness is deterministic; arrival floor 45% → 70%

TODO listed "arrivals vary by a few drives between runs with the same seed".
That no longer reproduces:
- 40 drives three times in one page, in two fresh pages, and in three at
  once under CPU contention all give identical outcomes and failure lists;
- the full 120 gives 102 arrived on every desktop run, and 103 on iPhone.

The likely fix is the 2026-09-29 load token: two loads used to write the same
world, so the origin and graph could differ. The floor was set loose at 45%
to absorb that noise. It is now 70%, so a real regression shows. The traced
lost drive at De Groene Zoom × Gelrestraat is the autopilot riding down a
narrow-angle pedestrian fork and aiming past the kerb, not the road guard.

## 2026-09-30 — a glossary for street-name translations

The Apple translator renders Dutch trade and planning words literally:
- lijnbanen van de touwslagerijen came out "line tracks of the rope
  warehouses"; they are ropewalks of the rope-making works;
- stadsuitleg came out "city layout" (it means city expansion);
- demping came out "damming" (it means filling in);
- also "singing seed" (birdseed) and "regency families" (regent families).

`ORIGIN_GLOSSARY` in `lib/streetNameOrigins.ts` fixes each one only where
the Dutch uses the trigger word, so "layout" stays in "garden city layout",
and "dammed" stays where the Dutch has afgedamd. Republished with 30 texts
corrected.

## 2026-09-30 — review rides plan their runners-up and ride the best one

`pickReviewRoute` scores pairs by due names within 200 m of the straight
line, but the router decides what is actually ridden. A pair whose line
grazed four due streets could be routed along none of them. Its
`dueOnPath` was then empty, and the briefing, correctly, promised nothing.

The pick now carries up to four runners-up: next by count, then by length,
one per destination. Once the city network is built, and before the path is
planned, `choosePlannedReview` (`routeSelection.ts`) plans each pair with the
due-name discount and keeps the one whose path rides the most due names. On
a tie the random pick stays. `RoadNetwork.setEndpoints` moves the ride's ends
on the same network.

Each plan takes 3–7 ms on desktop, so five run behind the loading screen.
`review-ride.spec.ts` covers the case: the random pick is two landmarks in
Oost, a runner-up rides Rozengracht, Rozengracht is due, and the ride goes
along Rozengracht.

## 2026-09-30 — bridge cards say what the city's bridge register records

Of 300 bridges the game asks about, 203 have a name origin. The municipal
asset register (`civieleconstructies`: `brug` joined to `brug_vast` by object
number) has 1,837 bridges, each with a type and a material. Fixed bridges also
have a construction year and the traffic they carry. The painted bridge
number (Magere Brug is 242) comes from the object number.

- `fetch:amsterdam-bridge-register` snapshots the register into
  `scripts/data/amsterdam-bridge-register.json`, with outlines converted from
  RD New to lng/lat.
- `build:bridge-register [--publish]` joins the game's bridges to register
  outlines their ways touch within 3 m. It samples every 2 m along each way,
  because a way often has no vertex on the deck. `chooseRegisterBridge`
  (`src/canalRecall/bridgeRegister.ts`) settles the match in this order:
  1. a register name that matches;
  2. for OSM names that are only a number ("Brug 68"), that painted number;
  3. a single unnamed outline.
  Several unnamed outlines count as ambiguous and the bridge is left out,
  because giving a road over five bridges one of them's year would teach
  something false.
- Result: 240 of 300 described, 17 ambiguous, and 43 with no outline.
  Later the same night, `sameBridgeName` began accepting spelling variants:
  `ij`/`y`, the brug/sluis suffix, and at most two edits on names of six
  letters or more (Ryckerbrug = Rijckerbrug, Gustav Leonhardtbrug = Gustav
  Leonardbrug). That brought it to 246, with 11 ambiguous. Neighbouring
  bridges named from one theme (Goudvinkbrug, Goudhaanbrug) are four edits
  apart and still refused. The
  unmatched ones are mostly railway bridges and bridges the city does not
  manage.
- The card sentence attributes the year ("dated 1884 in the city's bridge
  register"), because the register sometimes dates the current deck rather
  than the first bridge on the site.
- The sentence is a card on its own, or closes the long text after the
  origin; `streetCardText` shortens the origin to make room, never the
  sentence. It loads deferred, together with the street-name origins.
- The Dutch word is "Beweegbare", so a first regex for "beweegbaar" called
  every movable bridge fixed. `check-bridge-register.ts` pins Magere Brug.

## 2026-09-30 — full-suite sweep: five stale tests repaired, origins no longer delay the start

A full Playwright run after tonight's changes (208 tests) failed 15. None of
the failures came from tonight's changes. Repaired:
- Three `appearance-*` specs clicked the "Da Costa study" route chip removed
  on 2026-09-28. That commit fixed one spec and missed these three. They now
  select the pattern through the hidden `#route-pattern`, as the other spec
  does.
- `crossing-quiz.spec.ts` "a long street is learned a stretch at a time"
  called `_isRecallSuppressedHere`, which `_recallStatusHere` replaced on
  2026-09-07.
- `bike-screen-size.spec.ts` sampled the zoom while the camera was still
  easing in from the overview. It passed or failed at random; it now waits
  for the zoom to settle.

Left for the appearance lane (see TODO): Da Costakade 13's measured wall
colour, the complete-city prior count, the study-route spec and the material
demo.

`street-name-origins.json` (1.2 MB, 364 KB gzipped) was in the parallel fetch
that gates the ride's start. No card needs it before the first correct answer,
so it now merges into the knowledge index when it arrives, unless another load
has replaced this one.

**Translator splicing.** `trn` splits long input itself at a fixed length,
sometimes mid-word, and translates the pieces apart. "het dek v|an het vaste
gedeelte" came back "the deck vThe fixed part". That affected 22 of 5,203
origins, Magere Brug among them. `sentenceChunks` (`lib/translation.ts`) now
sends at most 400 characters of whole sentences per call. `--rechunk` redoes
the cached long translations (278 entries) and tags the new ones
`trn-high/chunked`.
The rechunk run finished and is published: no splices remain (the
camel-join scan finds only source spellings such as "lJsbrand"). Where a
chunked translation renamed the street itself, the guard refused it and the
earlier translation stays.

## 2026-09-30 — review rides ride the due streets, and the briefing counts only those

The learning router adds a familiarity penalty to mastered streets. Names due
for review are mastered names, so a review ride, chosen because its straight
line passes due names, was routed *away* from them. The briefing still
promised "Review ride: N overdue names on the way" from the straight-line
count.

`planLearningRoadRoute` now takes `dueNames`:
- due edges are discounted 35% instead of paying the familiarity penalty;
- the detour cap widens from 12% to 25% (`reviewDetourRatio`);
- the plan returns `dueNamesOnPath`.

On a review ride, `game-route.js` passes every due name in the city (not
stops). Mid-ride replans keep the bias. `_reviewRoute.dueOnPath` feeds the
briefing, so it promises only the names the path rides. Regressions:
- `check-road-graph.ts`: a due street beside a new one is ridden, and a due
  street beyond the cap is not;
- `review-ride.spec.ts`: planted names on no real street leave an honest
  briefing with no review promise, and a real street beside the planned path,
  once due, is ridden within the cap.

## 2026-09-30 — the gate rebuilds every game bundle and names stale ones

`check:canal` rebuilt 21 bundles. The car guard, three.js, the 3D/vehicle and
signature bundles, the study layers, neighbourhoods, bridges and the recall
store were never rebuilt, so a stale one could pass. The signature bundle did
tonight: its `highlights()` fix was unbundled until a manual 3D rebuild.

Those ten builds are now in the gate. After the builds it lists any committed
bundle the rebuild changed ("commit them with their sources"), as a warning,
since work in progress is expected to be uncommitted. Its first run found
four study-layer bundles and the recall-store entry stale since 2026-09-26.
They were rebuilt from current sources and committed.

## 2026-09-30 — detailed mode: no dot once the building is lit; no raycast for a tree

In detailed (3D tile) mode the locator dot is drawn deliberately, because the
mesh highlight raycasts straight down at the landmark's point and misses
whenever the place is not its own mesh. It was drawn even when the raycast
did light the building: "both the yellow dot and the yellow building" (user
report 2026-09-29). Now:
- `DetailedBuildings` calls `onLandmarkHighlighted` when its raycast lights
  a mesh, and the map then clears the dot;
- a landmark resolved to no building (`buildingIds: []`, a tree or statue) is
  not raycast at all, because the ray could only find the building beside it.

The signature bundle rebuilt here also carries the earlier `highlights()`
check, which had not been bundled.

## 2026-09-30 — listed buildings say who designed them and what they were for

The municipal monument register (`api.data.amsterdam.nl/v1/monumenten`) links
each monument to its BAG panden (`betreftBagPand`), the building tiles' own
ids. `scripts/fetch-amsterdam-monuments.ts` snapshots it to
`scripts/data/amsterdam-monuments.json` (867 KB, committed, so rebuilds need
no network). The snapshot has 9,817 monuments: 7,686 national and 2,111
municipal. 7,660 are linked to panden.

`build-building-facts.ts` folds these into the fact tiles: 15,917 listed
panden, 1.5 MB gzipped in total. Each gets:
- the listing, with a national listing outranking a municipal one;
- the monument's name;
- the architect(s), turned from the register's "Gendt, A.L. van" into "A.L. van
  Gendt";
- the construction years, which beat BAG's single year;
- the original function, from a 16-term English glossary. "Housing" goes
  without saying.

Example card: "Apollohal — Built in 1933–1935, in the early twentieth century,
designed by A. Boeken. A municipal monument. Originally built for hospitality,
sport and recreation."

A monument name that would spoil a quiz answer is dropped from the card. The
register's long Dutch descriptions (median 4.5k characters) are left out until
there is a reviewed way to shorten and translate them.

## 2026-09-30 — canvas cards end on a sentence; Storybook states for the new cards

The phone BRIDGE card ended "…officially called the Kerkstraatbrug,". That is
the same complaint as the finish card (user report 2026-09-29), in the canvas
card's line budget (`noticeCards.wrapToLines`). `endCutLines` now ends a cut
body on the last whole sentence the lines hold, when that keeps at least half
of them. Otherwise it ends on a word with "…". The "+ MORE" badge still opens
the rest. Named check in `check-notice-cards.ts` (Magere Brug).

New Storybook states: `BridgeOriginCard`, `BuildingFactsCard` and their
`Portrait…` phone variants.

## 2026-09-30 — a clicked building says when it was built; clicks open what was clicked

**Building facts.** Clicking a building that is not a landmark used to open a
dead end: "No building details — This building has no name in the map data."
OSM carries the BAG construction year (`start_date`) on 1,057,404 of 1,082,604
building ways, plus a building type and a few heritage tags.
`scripts/build-building-facts.ts` cuts these into `building-facts/14/x/y.json.gz`.
The files are keyed by the building tiles' own ids, with parts inheriting their
building's facts. That covers 339,419 tile buildings, 1.4 MB gzipped in total.
`BuildingFactStore` loads the 3×3 tiles around the rider, and
`describeBuilding` writes the card, e.g. "Built 1665 — Built in 1665, in the
Dutch Golden Age. About 13 m tall, some 4 storeys." It adds the type when it
is worth naming ("A warehouse, built in 1720…") and a listing when tagged.
Periods are plain date ranges, true in Weesp as in the canal ring. BAG's 1005
placeholder is not a year. With nothing known the title is still "No building
details": no invented names.

**Click priority.** Any click within 120 px of a landmark opened that
landmark and lit the clicked building, so the house next door lit up as the
museum. Now:
- a building that is a landmark's own, by the extract-time join, opens that
  landmark;
- a nearby landmark wins only when its marker is clicked (within 40 px);
- otherwise the clicked building opens its own card.

Regressions: `check-building-facts.mts`, `canal-recall.spec.ts` ("a click
opens the building clicked…") and `landmark-highlight.spec.ts` ("a clicked
ordinary building tells its year").

## 2026-09-30 — the HUD never prints an unanswered street, however the bike is turned

Found while reading screenshots from this session: a fresh profile's plaque
read "DE WITTENKADE" and "TUINSTRAAT". The HUD hid a name only while it was a
question or a settling candidate. `advanceRouteQuiz` clears the candidate
whenever the heading is more than 45° off the road, so the plaque printed the
unanswered name, and the game asked for it moments later. That happened when:
- stopped and pivoting at a junction (the new mobile pivot makes this common);
- riding across a street;
- spawning misaligned.

`hudWithholdsRouteName` (`recallRules.ts`) now withholds any name that is not
the current corridor and has not been answered or shown. Regressions are in
`check-recall-rules.ts` and `canal-recall.spec.ts` ("HUD withholds an
unanswered street even when the bike is turned across it").

## 2026-09-30 — a named bridge tells its story

Naming a bridge correctly used to open no card, because `learnedRoute` is
empty at a crossing. The 203 quiz bridges with an English name origin now get a
BRIDGE card after a correct answer. Bridges have their own `bridge:` entries in
the route-knowledge index, and a bridge is only explained as a bridge
(`check-landmark-data.ts`). For example, Magere Brug: "Around 1670, a ferry
bridge was built over the Amstel, which was so narrow that it was only
suitable for pedestrians."

## 2026-09-30 — every street's name origin, in English

The full on-device translation of the BAG `beschrijvingNaam` register
finished: 4,360 new translations at about 60/min (`trn --quality high`, ×3).
5 were refused because the translation renamed the street itself. Published
coverage:
- routable streets: 4,904 of 5,432;
- curated streets: 326 of 343;
- waters: 226 of 300;
- bridges: 203 of 300.

The file is `street-name-origins.json`: 1.2 MB, 364 KB gzipped, loaded
alongside the other optional extracts.

A spot check found three systematic translator failures. `repairOriginTranslation`
fixes them at publish time, and each has a named check in
`check-street-name-origins.ts`:
- `gedempt` (a canal filled in) came out as "muted", "silenced" or
  "suppressed" in 10 of 55 texts ("The Rozengracht was suppressed in 1895").
- A bare year after `voor` read as a clock time ("just before 4:00 p.m." for
  "even voor 1600").
- Council-decision shorthand (`Rb. [Nieuwer-Amstel] 12-3-1914`) is now "council
  decision of Nieuwer-Amstel, 1914". An unfinished register note trailing a
  text (`Rb. 26-1-1922 15: m 9`) is dropped.

The committed translation cache, `scripts/street-name-origin-translations.json`
(2.3 MB), holds the Dutch next to each English text. It is the reviewable
source and makes the run resumable.

## 2026-09-29 — the game draws its own POIs

User requests: "should we just implement our own POI later?" and "for POI layer
we can also do our own filtering". The basemap's POI layer drew what
OpenMapTiles ranks for a general map: bins and toilet icons in every park,
grey names on the pavement. We could only screen its spoilers through a
filter expression, and it knew nothing about our buildings.

`scripts/build-orientation-pois.ts` builds `orientation-pois.json` (468 KB)
from the local OSM PBF:
- `src/canalRecall/poiCatalog.ts` decides what is a cue: culture, worship,
  education, health, civic, lodging, shops, bike shops and rental, parks and
  markets, and food and drink. Street furniture and closed places are out.
- Rank is category weight plus Wikidata/Wikipedia plus mapped as an area.
- The Albert Heijn brand icons and the landmarks are deduplicated away.
- Every indoor place is joined to its streamed building, exactly as landmarks
  are, and gets that building's height band (ground/low/mid/high).
- Result: 10,707 places, of which 4,749 are food.

At runtime (`src/canalRecall/ownPois.ts`, shipped in the orientation bundle):
- spoilers are screened before drawing, and places are thinned to the best
  per 70 m cell;
- each band is one layer pair (dot and label) lifted to its own roofline;
  parks and markets stay on the ground;
- the layers sit above the buildings with the other POI layers;
- names hide during a quiz and dots stay;
- the basemap POIs are hidden wherever our file loaded, including when every
  label is toggled on. A city without the file keeps the basemap's.

Regressions: `scripts/check-own-pois.ts` and `poi-lift.spec.ts` (basemap
hidden, bands ordered, no spoilers, quiz-quiet).

## 2026-09-29 — separated cycle tracks are drawn, so the route lies on something

User report: "what could we do to get the blue line onto the white rendered
street?" (Nassaukade). The router prefers the separated `highway=cycleway`
beside the road, and the basemap draws that as a faint dashed path, so the blue
line seemed to float off the white street. `src/canalRecall/cycleTracks.ts`
(shipped in the orientation-POI bundle) turns the routing extract's separated
tracks into a line layer in Amsterdam red. There are 11,874 track paths. The
layer sits just under the route casing and fades in from z13. Painted lanes are
tagged on the road, which is drawn already, so they are not included. The
layer only shows when cycling. Regression: `scripts/check-cycle-tracks.ts`.
The TODO item is closed.

## 2026-09-29 — landmarks name their buildings exactly; no 10 m guess, no double marker

User reports: "I can't see where on the map this landmark is" (Bevrijdingslinde),
"why can't we tie buildings to OSM ids and need to do this 10m thing?" and "why
do I get both the yellow dot and the yellow building?".

What was really going on:
- Landmark ids are hashes of category and name (`build-amsterdam-extract.ts`),
  not OSM ids. The runtime's "own way" step (`w<id>`) never matched, so every
  highlight came from containment or the 10 m nearest footprint. For the
  Bevrijdingslinde, a tree, that lit a 52 m² shed 5 m away.
- The building tiles are keyed by BAG pand id. Where OSM maps `building:part`
  ways (Royal Palace, Muziekgebouw, Waag), the tiles draw those parts in place
  of the footprint.
- Signature models (Royal Palace, …) are lit by their own renderer. The map
  found no tile building there and drew the dot as well.
- The dot layer sat below the building layers.

`scripts/resolve-landmark-buildings.ts` (with rules in `lib/landmarkBuildings.ts`)
now resolves each landmark from the local OSM PBF with osmium, in this order:
1. the building carrying its Wikidata item;
2. a building whose ring is the landmark's outline;
3. the buildings inside a site (up to 12);
4. the smallest drawn building containing its node;
5. for an institution's node, the nearest building within 10 m.

A building is expanded into its parts where the tiles draw parts. It finds a
node's tags by name or Wikidata near the point, so trees, statues, artworks and
plaques resolve to no building (an address overrides that, as with the
Hollandsche Schouwburg).

Result: 394 of 420 landmarks resolve.
- Wikidata 103, containment 185, site 36, own ring 3, entrance 5.
- Object 62.
- None 26: districts, monuments on open ground, a houseboat.

332 are published to `landmark-buildings.json`, and the runtime highlights
exactly those ids. The distance guess remains only for a city without the
file. The dot is raised above the buildings with the POI layers, and it is
skipped when a signature model lights up (`highlights()`). Regressions are in
`scripts/check-landmark-buildings.ts` and `landmark-highlight.spec.ts` (the
Bevrijdingslinde keeps a dot above the buildings; the Concertgebouw lights
exactly its ids).

## 2026-09-29 — drive-by cards look ahead, and may replace a street card

User report: "this card/highlight happens a little late — after I've already
almost passed it". Two causes. The card opened within 300 px (≈100 m) of the
landmark's centre, which at cruise (260 px/s) is about a second before
passing, and most of that second went on the 0.8 s fade-in. And a street card
opened at the start of a street held the one card slot for 8 s, so a
landmark part-way down the block waited behind it.

`src/canalRecall/game/driveByTrigger.ts` now looks 3 s of travel ahead (never
less than the radius): along the route line while the rider is within 140 px
of it, along the heading otherwise. It opens the landmark the path passes
within 300 px of *soonest* (not the nearest centre) and skips anything more
than 90 px behind. A drive-by landmark may replace a street or earlier drive-by
card once it has had 2.5 s on screen, but never a clicked card or the arrival
card. The source of every card is recorded in `_landmarkNoticeSource`.
Regressions are in `scripts/check-drive-by-trigger.ts` and
`tests/e2e/drive-by-early.spec.ts`.

## 2026-09-29 — the live route measures to its line, not its corners

User report: "the routing is hopping / unstable — while I'm on it, it jumps to
another street" (Marnixstraat, race 52.3748,4.8819 → 52.3850,4.8829).
`nearestRouteIndex` measured the rider's distance to route *vertices*. Down a
long straight with few vertices, mid-block was more than
`LIVE_ROUTE_OFF_ROUTE_DIST` (140 px) from every vertex while riding on the line,
so `advanceLiveRoute` replanned every reroute interval and `findRoute` was free
to pick a near-equal parallel street. It now projects onto each segment and
returns the segment start, so the stretch being ridden stays drawn. Named
regression "riding down a long straight is on the route (Marnixstraat)" in
`scripts/check-route-selection.ts`.

## 2026-09-29 — labels above the buildings, landmarks on their ground point, Enter rides on, cards end on a sentence

- **"Café De Jo…" cut off by a building.** The basemap's shop and café layers
  sit low in its style, under the building extrusions added later, so the
  label lift slid them behind the walls. `_raisePoiLayers` moves the POI
  layers to the top. It re-checks on every `styledata`, because themes and
  detailed buildings re-create building layers. The check uses the cheap
  `getLayersOrder()` and moves nothing once the order is right.
- **A floating yellow dot beside the Bevrijdingslinde.** Our landmark dots
  and labels were lifted as if every landmark were a building, but landmarks
  include trees, statues and memorials. They stay on their ground point now;
  shops, cafés and supermarkets are still lifted. (The yellow shed next to it
  is the runtime's 10 m building guess; see TODO for the exact OSM→BAG join
  that replaces it.)
- **Enter repeated the same route.** The finish card says "Next route", and
  now `_startNextRouteFromArrival` does that: from the landmark just reached,
  a review ride if one is due, else a destination in range other than the
  start just left. The study lesson and transit keep replaying.
- **"…fortifications of Amste".** `splitDetail` hard-sliced card text at
  150/280 characters. `sentencesUpTo` keeps whole sentences and cuts an
  overlong one at a word with an ellipsis. Street cards share it.

## 2026-09-29 — `check:canal` is a runner, not a 104-step `&&` chain

User: "this seems absurd btw" about the one-line gate in package.json. It
stopped at the first failure without saying what else was broken, ran
everything serially, and could not be read or edited. `scripts/check-canal.ts`
keeps exactly the same 104 steps as lists. Lint and the 21 builds run in order
and fail fast, because checks read the bundles they write. The 81 checks run in
parallel (`--jobs`, default half the cores) and keep going past failures, then
Storybook builds. It ends with a summary and each failure's output. `--only=`,
`--skip=` and `--no-storybook` narrow a run. The whole gate now takes about
30 s.
Two checks that could never pass in a fresh checkout were fixed along the way.
`check-lod1-semantic-tags` looked for `tsx` two directories above the repo (a
nested-worktree assumption), and now uses this checkout's first.
`check-panorama-variety-review` pinned a manifest in a gitignored `local/`
folder. It now checks the fixture's own invariants always and the pinning only
where the manifest is on disk, saying so when it skips.

## 2026-09-29 — review rides: Plan review picks a route past the names that are due

TODO item 6. **Plan review** on the knowledge screen used to switch questions
to due names only, while the route stayed a random landmark pair. Most due
names never came under the wheels, and a question about a place you cannot see
teaches a false pairing. `pickReviewRoute` (`routeSelection.ts`) now scores
landmark pairs by the distinct due names within 200 m of the straight from→to
line (at least 0.8 km, at most the pattern's usual range). It breaks ties by
length, within 30% of the shortest. Surprise samples 40 starts; home and GPS
keep their start, and home stays inside its learning ring. The route planner's
existing due-name bias steers the path past them. With nothing due near any
pair, or in transit mode, the ordinary pickers run. The briefing tease says
"Review ride: N overdue names on the way": a count, never the names, so
nothing is answered before it is asked. `tests/e2e/review-ride.spec.ts`
plants due names on a line and checks the ride passes all of them.

## 2026-09-29 — two road-guard traps at span ends, found by tracing harness drives

The driving harness now makes failures replayable. Each lost drive reports
its `pair`, how far off the route it ended, how far it wandered, its speed
and its off-road margin. `HARNESS_PAIRS='[[[lat,lng],[lat,lng]],…]'`
re-drives exactly those pairs and prints the last seconds as a trace. Three
drives shared one signature (about 18 px off the route, 7–10 px off the road,
~500 px wandered, speed pulsing 0–45) and turned out to be the same two bugs:
- **The shoulder ease fought the rider.** Turning right off the end of the
  Solitudobrug onto Weesperzijde (one straight 640 m span with no vertex at
  the bridge), the bike drifted 1.4 px past Weesperzijde's edge. It was still
  pointing roughly along the bridge, so `pickGuardContact` kept judging it
  against the bridge's end. The soft-edge ease then turned it back along the
  bridge 12% a frame against full lock, and it stood on the kerb for good.
  Outside every corridor, the guard now judges the cross street the vehicle
  is least outside of (parallel copies excluded, as before), then applies
  the corner fillet to that choice.
- **The rollback slide carried on past a span's end.** It follows the
  contact's tangent, which beyond a dead end points straight off the road.
  `constrainCarToRoad` takes an `excessAt` probe and refuses a slide that ends
  further out than it started (Nannie van Wehlstraat).
Both are pinned in `check-road-surface.ts` / `check-canal-car.ts`. Re-driven,
3 of the 4 trapped pairs now arrive. The fourth (Weesperzijde by Kruislaan)
is the autopilot circling a block, not a trap. The full harness measures 102
of 120 with 0 pinned, inside its run-to-run spread of 97–104.

## 2026-09-29 — a livelier invented building palette (v3)

User report: "these fake colors are too drab". Buildings with no observed
colour use `cityAppearancePalette.ts`. Its V2 grey-browns and grey flat caps
read as one dun mass from the chase, and flat caps are most of what the camera
sees. V3 makes brick redder and richer and adds a dark brick. Buff is ochre,
plaster is cream, grey is a blue slate, and a rare canal green joins (1 in 9).
Flat caps mix bitumen, terracotta, slate and gravel. Values stay below the
clean theme's cream ground, as V1's bleaching lesson requires. Observed OSM
colours and the reviewed area sidecars are untouched. Source labels are now
`citywide-identity-palette-v3-not-measured` /
`citywide-flat-cap-palette-v3-not-measured`.

## 2026-09-29 — landmark and shop labels sit on the buildings

User report: "can we move the map POI labels up onto the buildings instead of
being on the ground?". A symbol is drawn at its ground point, so under the
chase pitch the names lay on the pavement at the foot of the facades.
MapLibre 5.24 has no per-symbol height. Instead `roofLiftTranslate`
(`orientationPois.ts`) turns a nominal 12 m roofline into a viewport
translate. It is exponential in zoom and scaled by sin(pitch), and the map
repaints it when the pitch moves more than a degree (`_liftPoiMarkers`). It
lifts our landmark dots and labels, the Albert Heijn and local-food markers,
and the basemap's shop and café layers. Basemap transit stops stay on the
street. The lift is exact at the view centre, a little low near the camera
and a little high towards the horizon. Labels now sit above their dot rather
than below it.

## 2026-09-29 — hard sideways on the stick pivots a stopped bike on the spot

User report: "if I need to execute a 180 and I'm stuck, because turning also
tries to go forward, my bike was struggling to turn around". A full-lock stick
still cruised at 30% of the cruise (~19% of top speed). A bike stopped at a
kerb rolled forward into it, and the road guard eased the heading straight.
`relativeCommand` now also returns `pivot` when the stick is past 0.7 steer
with less than 0.25 forward push. Below `TURN_AROUND_MAX_SPEED` the player
swings on the spot at `PIVOT_RATE` (3.2 rad/s, about 1 s for 180°), without
throttle. Moving, the same stick still arcs, so junction turns are unchanged.
Measured on the iPhone profile: before, 1.2 s of hard right from a standstill
rolled 18 px; now it stays put and turns more than 120°.

## 2026-09-29 — one route load owns the loading screen

User report: "this progress bar jumps back and forth". Route loads shared one
`_loadingAborted` flag, and each new load cleared it. A second start (a double
start, or Escape then a new route) revived the first load, and both wrote the
bar and message in turn: "Finding your way" over a 92% bar. The first load also
began its own intro. Each load now takes a token (`_loadToken`); Escape and
newer loads bump it, and a stale load stops at its next await, including its
return-to-setup timers. `tests/e2e/loading-progress.spec.ts` records every
progress write across a restart.

## 2026-09-29 — start the chase at 65%; buildings fade in during the intro

User reports: "start is way too zoomed out now", "it jumps zoom levels while
showing a 2d overview of the start view".
- `CAMERA_ZOOM_INITIAL` is 0.65 (was 0.5, which framed a whole route).
  `ZOOM_DEFAULT_VERSION` 4 moves saved untouched 0.5 defaults to 0.65.
- The intro camera itself was smooth (log-zoom interpolation). The jumps were
  3D buildings appearing at once at zoom 14 across half-loaded tiles. Building
  layers now fade from zoom 15 to 15.6 (`BUILDING_FADE_IN`), so the overview
  stays a flat map and buildings grow in as the camera descends.
- Landmark dots start at zoom 16 with their names, not as bare yellow dots
  over the overview.

## 2026-09-29 — the minimap no longer draws due-for-review streets

User reports: "what is the orange and red in the minimap?", then "just discard
the orange in the minimap". Due-for-review streets were copper, which read as a
second route beside the terracotta route and finish. Many parallel ways of one
name (Prins Hendrikkade) stacked into a heavy blob. A violet recolour was tried
first; the layer is now simply not drawn. `cityOverview.ts` still builds it,
so the schedule can surface elsewhere.

## 2026-09-29 — drop duplicate buildings instead of insetting them; roof lids sit on the wall

User report: "texture fighting still happening, and every single building also
now has this weird lip".
- The 0.35 m inset (below) was inside the depth buffer's precision at game
  distance, so nested walls still striped. Where the inner copy was a little
  taller it also left a ledge. `dropNestedDuplicates` (`buildingNesting.ts`)
  replaces it and drops the redundant copy, as OSM renderers do. Of two
  near-identical footprints (area ≥ 85%) the lower goes. An outline whose
  parts cover at least half of it gives way to them. A small part on a big
  building is left alone. It drops 42 of 2713 features on tile 8415/5383 and
  24 of 4886 on 8414/5383, in about 20 ms each.
- The lip on every roof was older (5d2a17c). The flat-roof lid floated from
  wall top + 0.15 m to + 0.55 m, drawing a light gap line and a dark band
  round every roof. It now runs from the wall top to + 0.4 m. Its sides start
  where the wall's end, so nothing is coplanar.

## 2026-09-29 — a closed card takes its yellow building with it

User report: "why is this building highlighted yellow when no card is
onscreen". The card-close path that faded out cleared the building
highlight, but the others did not: a question opening, or a new route,
closed the card and left its building yellow. `_clearLandmarkNotice` now
clears the highlight itself. Pinned in `tests/e2e/landmark-highlight.spec.ts`.

## 2026-09-28 — one highlight line across bridge forks

User report: "too many lines" (screenshot: a bridge with parallel highlight
lines and stubs fanning off it). Follow-up to the corridor collapse below.
- Most ways are stored twice. The collapse excused any sample sitting on a
  kept line's vertex, so the duplicate sat exactly on the kept copy and was
  never cut. Exact duplicates are now dropped first, and only the *ends* of
  kept runs (real shared nodes) are excused.
- At every bridge the carriageways fork into a diamond of short ways. The
  angled connector arms were neither beside a kept line nor past its end, so
  they drew as a fan of stubs (Raadhuisstraat). Pruning them afterwards
  cascaded: an arm had already cut the first metres of the next carriageway
  fragment, so that fragment had a loose end, was pruned in turn, and the
  road beyond vanished.
- The collapse now starts from a spine. That is the course through the
  name's own network that runs through the ridden fragment, out to the node
  on each side farthest in a straight line from the seed's other end.
  Measured by path length instead, it doubled back round one-way pairs
  (Martelaarsgracht). The spine is drawn whole and never pruned; the rest are
  branches, cut against it. A whole short branch fragment that lies within
  30 m of the rest and has a loose end is an arm: it is left out and the
  walk rerun.
- Raadhuisstraat is one unbroken line through three bridge diamonds.
  Citywide, names still drawing a parallel overlap longer than 15 m fell from
  376 to 206, mostly squares and genuinely two-sided streets. Pinned in
  `tests/e2e/street-highlight-parallel.spec.ts` (Raadhuisstraat: one chain)
  and the fork case in `scripts/check-canal-street-overlays.ts`.

## 2026-09-28 — corners can be cut

User report: "we should be able to cut-corners a bit more" (the Oosterdokskade
corner by LOT 61).
- Road corridors are straight bands around each centreline, so where two meet
  the union has a square inside corner. A diagonal line through a turn went
  more than 4 px past both edges and hit the rollback.
- `filletedExcess` (`roadSurface.ts`) fillets the inside of every corner or
  crossing at more than 30°, with a radius of 12 m. A diagonal now reaches
  about 3.5 m past both edges. It applies only when both nearest points are
  perpendicular projections, so the outer corner of an L, usually a
  building, stays blocked.
- `pickGuardContact` reports the filleted edge distance when given the point,
  and `getSurface` uses it too, so a cut corner reads as asphalt/curb rather
  than grass drag.
- Pinned in `tests/e2e/corner-cut.spec.ts`: at Oosterdokskade × Simon
  Carmiggeltstraat, a point 2 m past both edges was a rollback and is now
  asphalt. The driving harness holds at 104/120 with 0 wedges.
- Also fixed a `check-road-surface` fixture from the Bullebakssluis change
  (29fc2b3). Its heading contact sat outside the alignment slack, so the
  check had never passed; only `tsc` runs at commit.

## 2026-09-28 — bikes stay out of the IJ-tunnel

User report: "my bike is seemingly entirely stuck in this building". A ride
from Oosterdokskade toward Noord was routed through the IJ-tunnel, under the
IJ and into its portal building.
- Street mode is cycling, but it loaded every car highway. The extract holds
  1,785 motorway/trunk ways: the A10 ring, the Coen Tunnel, and the IJ, Piet
  Hein and Spaarndammer tunnels. All of them are closed to bikes by law.
- `isMotorOnlyHighway` / `motorOnlyNames` (`routing/bikeAccess.ts`, exported
  by the road-projection bundle) drop them in `osm-loader.js`. They are
  neither ridden nor asked about. A name that is mostly motor road goes as a
  whole, because the IJ-tunnel's ramps are tagged `primary` and left 200 m
  dead-end stubs into the portal. IJburglaan and Gooiseweg keep their named
  cycle tracks. `isBikeRoutingHighway` excludes motor roads for the next
  extract build.
- Noord stays reachable without them. The reachability audit mirrors the
  loader and now pins the Dam, Buikslotermeerplein, NDSM-werf and
  Oosterdokskade to one component. The live graph goes from 247 to 272
  components; the largest share goes from 80.0% to 79.8%. Pinned in
  `tests/e2e/bike-motor-roads.spec.ts` and `scripts/check-bike-access.ts`.

## 2026-09-28 — a highlighted street is one line

User report: "I still sometimes get crazy multiple blue lines when a street
is highlighted" (Prins Hendrikkade by the IJ).
- The highlight drew every connected fragment of the name. Prins Hendrikkade
  is 262 of them, each stored twice: two one-way carriageways, named cycle
  tracks and service roads, all side by side. `stitchOverlayPaths` keeps
  parallel ways apart on purpose, so they drew as three or four lines.
- `collapseParallelFragments` (`streetOverlayStyle.ts`) runs before stitching,
  in the MapLibre highlight and in the canvas `drawQuestionFeature` (which
  caches per seed). It walks from the ridden fragment along touching
  fragments: busiest road class first, then the straightest continuation.
  It drops the stretches that run alongside a kept line. Alongside means
  within 30 m, within 25° of its heading, and projecting onto that line
  rather than past its end.
- Continuations, branches and a canal's opposite quay (~40 m) survive. A short
  uncut fragment is always kept: dropping a 9 m link as a sliver stranded the
  walk, and the other carriageway won the rest of the road.
- Share of highlighted length with another highlighted line within 20 m:
  94% → 6.6%. The collapse takes 5 ms, once per question. Pinned in
  `tests/e2e/street-highlight-parallel.spec.ts` and
  `scripts/check-canal-street-overlays.ts`.

## 2026-09-28 — nested building footprints no longer z-fight

User report: "*still* getting texturefighting" (Waterkant, Oosterdokskade).
- The streamed extract often draws one building twice: an OSM outline and the
  parts inside it, or a BAG pand under an OSM way. The tiles carry no part
  flag. Shared walls put two faces in one plane. At Oosterdokskade three
  overlap: w453809679 (36 m), w779659694 (48 m) and w1487606297 (3–12 m).
- `separateNestedBuildings` (`buildingNesting.ts`) runs as each tile decodes.
  It pulls a contained footprint in by 0.35 m. When the inner and outer roofs
  are within 0.3 m, it drops the inner roof 0.3 m below the outer one. Of two
  identical copies, only one shrinks.
- Nothing is dropped, so podiums and taller parts survive. Tile 8415/5383
  insets 185 of 2713 features (30 lowered); 8414/5383 insets 81 of 4886. Each
  tile takes about 24 ms on desktop.
- Checks are in `scripts/check-building-tile-source.ts`. An overhead
  screenshot shows the striped courtyard wall cleared. Street-level flicker
  was not reproduced by teleporting, so it needs a look in play.

## 2026-09-28 — landmark cards light up their building; full destination names

User reports: "why don't I see that museum on my screen highlighted?", "the
tags on the card still look weirdly off-center vertically", and "this should
not cut off my destination".
- A drive-by card knows only the landmark's point. The highlight went to the
  basemap building, which is hidden once streamed tiles own the city, or
  nowhere. `buildingForLandmark` (`buildingTileSource.ts`) now finds the
  streamed building. It tries the landmark's own OSM way first (`w<id>`,
  when mapped as a building). Next, the footprint around its node (Bimhuis).
  Last, the nearest footprint within 10 m of an entrance node (Sexmuseum).
  Only 11 of 420 landmark points fell inside a footprint. Now 15 of 19 in a
  loaded area highlight; the misses are plaques and monuments, which keep
  the dot. Pinned in `tests/e2e/landmark-highlight.spec.ts`.
- Card chips centre the measured cap height in a 15 px pill. The fixed
  baseline sat the all-caps labels off-centre.
- The destination label masked any route street inside its name for the
  whole ride, so it often read "…KERK". It now masks only the answer of the
  question open right now (`_destinationLabel`).

## 2026-09-28 — the driving harness measures the city, not its autopilot

The harness was red at 41–65 of 120 arrivals, varying by run. A diagnostic
copy recorded how each lost drive failed. Most were the test driver:
- It aimed 40 m ahead in a straight line, across hairpins and turning loops
  (Science Park), and rode into the kerb.
- It took sharp corners at cruising speed and cut into side alleys
  (Nieuwendijk into Nieuwezijds Armsteeg).
- It never turned round, steering full lock into a block for ever.
The autopilot now aims at the farthest route point it has a clear line of
sight to along the road, slows for bends within 90 px on the route, and does
its back-off-and-turn when the route is behind it. It rides into a junction
whose corner it cut short, instead of aiming down the next road from the
kerb. And it counts a vertex within 25 px as passed, so an overshot hairpin
no longer makes it turn back and forth. The 52.36993, 4.96976 "corridor gap"
turned out to be the autopilot aiming past its junction. Result: about 100
of 120 arrive, 0 pinned, so it passes the 45% bar.

## 2026-09-28 — no Da Costa study choice, 50% zoom again, no ESC on arrival

User requests: "get rid of 'da costa study'", "default zoom on web for
chase: 50%", "no 'esc' shortcut on final destination card".
- The study is gone from the route choices, and a saved `study` pattern falls
  back to Surprise. The pattern itself stays for the appearance harness, which
  now selects it through the hidden `#route-pattern` control.
- Picking the study used to set zoom to 0.8 silently, which is why chase
  opened zoomed in. `ZOOM_DEFAULT_VERSION` 3 resets every older saved zoom to
  the 50% default once. That also clears the 10%/150% the broken pinch saved.
- The desktop arrival card offers only ENTER (Next route), plus C to share
  when there's a link. The Escape binding is gone. Route setup is still a tap
  button on the phone and M in the pause menu.

## 2026-09-28 — no drive-by cards on the phone

User request: "disable the local interest cards on mobile for now, they break
the navigation game too much". On the compact (phone) layout, landmark cards
no longer pop up as you ride past, and neighbourhood postcards no longer
appear on entry (`canShowDriveByCard` in `teachingSurface.ts`). Tapping a
building still opens its card. Desktop is unchanged.

## 2026-09-28 — pinch zoom is 1:1 and no longer throws the camera off the bike

User reports: "zoom in out on mobile is way too sensitive, can only get to 10%
or 150%" and "centering on the phone is now horribly wrong, it puts the bike
entirely offscreen". Two gesture bugs:
- The pinch handler synced the zoom sliders through `_cameraZoom` and
  `_liveZoom`, which were never assigned after settings moved into the React
  overlay. It threw on every step before recording the new finger distance,
  so each step multiplied by the distance since the pinch began: a 1.1×
  pinch zoomed 1.7×. The sliders are now looked up by id, and a missing one
  is tolerated.
- A pinch's first finger lands alone and started a map drag, so every pinch
  also panned and detached the camera. A second finger now cancels the drag
  and undoes its pan. A drag also only pans once past the 6 px tap
  threshold, so a wobbly tap no longer detaches the view.
Pinned in `tests/e2e/phone-pinch.spec.ts`.

## 2026-09-28 — the chase bike grows with the window

User report: "the bike is small in the chase view on desktop". The bike is a
world-space game piece (2.15 m × `BIKE_GAME_SCALE` 4.5), so it drew at the
same CSS size on every screen: 24 px, or 2.7% of the short side, in a
1440×900 window, against 5.4% on a phone. `Vehicle3D.viewportScale()` now
scales it by the short side over 500 CSS px, clamped to 1–2×, so desktop
draws it at 1.8× (43 px, 4.8%) and phones are unchanged. Pinned in
`tests/e2e/bike-screen-size.spec.ts`.

## 2026-09-28 — fewer settings, and a wider zoom-out

User requests: "get rid of all these options" (Detailed 3D, Photoreal, Map
style) and "the game should let me zoom out further". Those three settings
are gone from route setup and ride settings. `parsePreferences` ignores
their stored values, so a player who had picked 8-bit or Photoreal is not
stuck with it: the map is always clean, standard 3D, with no Google tiles.
The vector map keeps its `setGoogleTilesEnabled` hook for the overview test.
`CAMERA_ZOOM_MIN` drops from 0.2 to 0.1, one map zoom level wider, and the
Zoom slider now starts at 0.1. At the minimum on desktop the map sits at
z15.5 and streams 9 building tiles (31k features) inside the budget.

## 2026-09-28 — the chase view dips at most 10° for a building

User report: "still getting behavior where camera randomly changes from chase
to above". A scripted 30 s chase ride on desktop opened at the guard's 17°
floor for about 4 s, blocked by one building, and dipped again later. The
guard dates from before the bike's x-ray silhouette. It now lowers pitch at
most `CLEARANCE_MAX_DROP` (10°) below the view's own pitch, so the lowest
pitch on the same ride is 32° instead of 17°. The x-ray keeps the rider
visible behind anything the capped drop cannot clear. Pinned in
`tests/e2e/camera-pan-pitch.spec.ts`.

## 2026-09-28 — the bike can turn off Marnixstraat at the Bullebakssluis

User report: "my bike is stuck at this intersection" (Nieuwe Naatje statue,
Marnixstraat / Westerkade / Lijnbaansgracht). An arm-to-arm sweep of scripted
drives there failed 13 of 30, including every turn off Marnixstraat into
Westerkade. The road guard judged the bike against the heading-matched road
(`pickRoadContact`, which is right for naming), so while the bike sat on
Westerkade's centreline it was on Marnixstraat's shoulder: the guard pulled
it back and turned it along Marnixstraat every frame, and it wedged past the
junction. The guard now uses `pickGuardContact`: once off the heading road's
asphalt, a cross street (more than 30° off) that contains the bike wins.
Parallel duplicates don't: Marnixstraat has same-geometry ways of width 9 and
18, and letting the widest win stalled the bike on a busway shoulder. The
sweep now passes 29 of 30 (Marnixstraat south → Westerkade still wedges once
the autopilot aims across the plaza). City-wide driving-harness arrivals rose
from 41 to 51 of 120, with none pinned. Named regression:
`tests/e2e/bullebakssluis-junction.spec.ts` (fails without the fix); unit
checks are in `scripts/check-road-surface.ts`.

## 2026-09-28 — one bicycle: the omafiets, no child seat

User request: "get rid of all the bike options, just use the omafiets without
a baby carrier". The Bicycle choice and Baby seat toggle are gone from route
setup and ride settings, along with the `bikeSkin` / `bikeBabySeat`
preferences (old stored values are ignored) and `src/canalRecall/game/bikeSkins.ts`.
`PlayerBike3D` always loads `omafiets-runtime.glb` and hides its `BabySeat`
node. The pink city bike and Swapfiets GLBs remain only for `bike-preview.html`.

## 2026-09-28 — start pins sit on the map during the start flight

User report: "start isn't at the start of the line, later it moves there".
On a retina laptop window (1000×615 at 2×) the overview's pins were drawn with
the flat camera maths while MapLibre drew the map at a different scale, so
START sat 173 px from its road and jumped on landing. The overview now keeps
MapLibre's projector for the pins, and `_planIntro` refits the overview zoom
against the real projected start–finish distance (two rounds). Pinned in
`tests/e2e/intro-flight.spec.ts` (under 4 px on a retina 1000×615 window).

## 2026-09-28 — the chase camera no longer snaps overhead on turns

User report: "why is the camera now jumping to almost overhead view when I
back up or sometimes turn?". The chase lead (entry below) moved the view
centre ahead of the rider, and the building-clearance guard aimed its
sightline at that centre. On a turn or reverse the lead point swung behind a
building and the guard cut pitch toward its 17° floor in one frame (25°
measured on the phone). Now:
- The sightline aims at the rider (`camera.targetX/Y`).
- The guard's cap eases toward its target: down at 25% per frame, back up at
  5% per frame. The slow climb applies only when recovering from a building;
  otherwise the cap follows the view mode's own pitch, so toggling north to
  chase tilts at the usual pace.
- Code review caught that the check measured the previous frame's camera
  (stale centre, bearing and lowered pitch), which could read a building as
  clear and pump the pitch. The guard now jumps to the requested view before
  measuring.
`tests/e2e/camera-pan-pitch.spec.ts` requires the largest one-frame pitch
drop to stay under 8° while turning and reversing, and the sightline subject
to stay within 12 m of the rider.

## 2026-09-28 — building tiles send MapLibre a diff, not the whole city

Each tile arrival re-sent, and deep-cloned, every resident building through
`setData`. On a throttled phone that was the remaining ~130 ms spike while
riding. `BuildingTileStreamer` now remembers the published tile arrays and
sends `updateData({remove, add})` for only the tiles that left or arrived
(`planSourceDiff`). It still uses a full `setData` for the first flush and
after appearance priors change. Ids are `promoteId: 'id'`, and all 342,993
extract ids are unique, which `updateData` requires. `updateData` reports a
rejected diff later, as the source's `error` event rather than a throw, so
that event resets the snapshot and resends everything. Checks are in
`scripts/check-building-tile-source.ts`.

## 2026-09-28 — the chase view shows more street ahead

User report: the chase view "seems slightly too … high? like I'm a little
cut-off". The chase camera had no constant lead, so the rider sat at exactly
50% of screen height (measured on desktop and phone) and half the view was
street already passed. `CHASE_LOOKAHEAD = 65` puts the rider at about 60%
(62% on the phone) when stopped; the speed-based lead adds more while moving.
Pitch (42°) is unchanged; `[` and `]` still adjust tilt.

## 2026-09-28 — the phone stick can turn you round

User report: "mobile controls are better but still an issue, can't really turn
around". Measured on the iPhone profile with a scripted stick: full left for
3 s turned 12° and settled about 15° off the street. A cruise-speed turn
reached the kerb before 90°, and the road guard eased the heading back along
the street each frame, which balanced the steering. Pulling back reversed in
circles at -30 px/s. Now:
- A hard stick turn slows to 30% of cruise, and while the stick is steering
  hard the guard still blocks and slides the position but leaves the heading
  alone (`holdHeading`). Keyboard keeps the old kerb-gliding behaviour, since
  its steering is always full lock (driving-harness arrivals unchanged at
  41/120).
- Pulling straight back brakes and, once below 30 px/s, swings the bike 180°
  along the street in about 0.6 s. Stick braking never reverses.
- In absolute mode, pointing well away from the heading slows the bike, so it
  turns on the spot instead of arcing into the kerb.
Pure checks in `scripts/check-mobile-hud.ts` (including the guard); phone e2e
in `tests/e2e/mobile-overlays.spec.ts`.

## 2026-09-28 — stutter: per-frame work that did not need to run

User report: "the fly-in is really stuttery … the whole game is pretty
stuttery right now - is that from our coloring algo?". Measured with the
iPhone Playwright profile at 4× CPU throttle and CDP CPU profiles. (Starting
the profiler itself stalls the page for about 1.7 s, so first-frame spikes
in profiled runs are artifacts; the timing runs used wrappers instead.)

Riding, chase view: median frame 33 → 16.7 ms, frames over 33 ms 212 → 43.
- The minimap walked every road segment through a string test every frame
  just to count water for its cache key (15%). Now counted once per route.
- `drawLabels` ran the per-place knowledge test on every label in the city
  before its on-screen test (~15%). It now culls in world space first.
- `setQuizQuietMap` serialised the whole style (`getStyle`) three times a
  frame. It now acts only when quiet or labels change.
- Camera clearance: the sightline walk point-in-polygon-tested up to 20 000
  footprints per metre, rerun every 8 m of travel. It now prefilters by
  cached bounding boxes.
- Partly yes, the colouring: `sampleFeatures` and every tile flush re-styled
  every resident building (`decorateBuildingFeature`) into new objects. The
  styled copy is now memoised per feature per priors set.

Start flight: p90 150 → 16.7 ms, frames over 33 ms 58 → 3. Clearance checks
and building-tile planning and flushing (which `moveend` from every `jumpTo`
also triggered) are suspended while `camera.introOverview` > 0, and resume
once on landing (about 96 ms at 4× throttle, roughly one frame on a device).
The overview is aimed and settled behind the loading screen
(`_prepareIntro`), and vehicle shaders are precompiled when the model mounts.

## 2026-09-28 — dragging the map keeps the 3D tilt

User report: panning "seems to switch between top-down while panning and then
back to 3d/isometric when stopped". The camera-clearance guard, which lowers
pitch so no building blocks the sightline to the rider, ran against the
dragged centre. On every drag frame it found a blocker and cut the pitch to
the 17° floor (measured: 17° for the first 16 drag frames, then 42°). The
guard is now skipped while the camera is detached, since there is no rider at
the centre to protect. Regression: `tests/e2e/camera-pan-pitch.spec.ts`.

## 2026-09-28 — settings and help tuck away while riding

User request: "hide these controls by default". While riding, the settings
and help buttons are faded out and ignore taps (`#utility-buttons.tucked`).
A tap on the map outside the stick, or a mouse move, brings them back for
3.5 s. They stay up when paused, in menus and while a panel is open, and G and
? still work. Regression in `tests/e2e/mobile-overlays.spec.ts`; phone specs
that open settings now tap the map first, like a player.

## 2026-09-28 — the chase bike is no longer solid yellow

User report: "why is the bike bright yellow now?", and "switching between the
bikes in settings doesn't do anything". Both were the x-ray pass
(`occlusionColor` #ffd21f) that shows the bike through buildings. It ran after
the normal pass with a greater-than depth test, so it also passed wherever
the model overlapped itself (back faces, the far wheel) and painted the
whole bike yellow, which made every skin look identical. The skin switch
itself worked. The x-ray now draws first, against the map's depth only, and
the normal pass draws the visible bike over it. The vehicle layers also sat
before the building extrusions, so the x-ray could never see a building;
`Vehicle3D` now moves itself to the top of the layer order on `styledata`.
Regression: `tests/e2e/bike-xray.spec.ts` (layer order, and <40 x-ray pixels
around an uncovered bike; it measured 169 before the fix).

## 2026-09-27 — a ride opens on an overview and flies down to the vehicle

User report: "when the game starts it's really hard to get oriented". A ride
now opens on a flat, north-up overview framing the start ("YOU", pulsing) and
the destination pin with city around them, with a faint straight bearing
between them — not the route. After 1.6 s it flies down for 1.9 s (log-space
zoom, centre following the zoom's progress) and tilts into the normal view as
it lands; reduced motion gets the still and a cut. Any key, tap or stick
touch skips it. The vehicle, race clock and quizzes wait for it; no names are
drawn beyond ones already earned.

The first phone overview overflowed: the chase camera's tilt and zoom offset
drew the city ~2× larger than the flat camera maths, so the map now flattens
both by `camera.introOverview` (1 → 0), which makes the framing exact. A quick
tap could start and end between frames, so input tracks `_touchedThisFrame`.
Automated browsers (`navigator.webdriver`) skip the flight unless
`__canalRecallForceIntro` is set, because many specs inspect the driving
camera right after spawning. Pure maths in `src/canalRecall/game/introFlight.ts`
(`npm run test:intro-flight`, in `check:canal`); e2e in
`tests/e2e/intro-flight.spec.ts` for phone and desktop.

## 2026-09-27 — the portrait phone HUD is one plaque

User report: "the mobile HUD takes up way too much of the screen". Measured on
a 390×664 phone, the street/score plaque plus the full-width destination bar
reached y≈168 (a quarter of the height), both showed a distance, and the city
overview sat mid-left beside the vehicle. On a portrait phone the plaque now
carries the finish arrow and distance on its headline row and the destination
name on its second row, beside neighbourhood and score; the odometer and
"% new" stay on the roomier layouts. It ends at y≈70 (≈83 with a feedback
line). The overview (100×76) and compass share the row under it, clear of the
vehicle. `hudLayout` marks this with `destinationInRecall`, aliasing the
location/destination rects to the plaque, and sizes the plaque from
`plaqueExtraLines` so a feedback line plus a cycling-ban line fit instead of
clipping. Landscape and desktop are unchanged. Named regression in
`scripts/check-mobile-hud.ts` (plaque ≤ y=90 and <14% of height; overview in
the top 30%); Storybook adds `PortraitHudLongNames`.
## 2026-09-26 — local overnight colour diagnostics and broader opt-in demo

The conservative local Qwen run produced 100 valid responses at 2.980 seconds
median per image (3.704 seconds p90). Agreement with existing material names is
88/89 known cases, not independent accuracy. Native-image auditing identified
uncertain old labels, so no bulk appearance acceptance follows from that number.

The resumable district worker now binds every batch to source/model/code hashes,
records material proposals, applies pinned local segmentation, and measures upper
wall photo colour. Resume verifies artifacts; transient retries and disk/time/work
limits bound unattended runs. The first 99-image batch completed classification,
masking and colour measurement; verified resume skipped it and started the next
batch. Its 20 provisional and 79 review-needed photo measurements are visible in
the live gallery. A nonuniform-mask regression caught Sharp expanding
greyscale masks to RGB; decoding now explicitly preserves one label per pixel.

An opt-in cohort demo adds 85 supported source-assessed owners while retaining
original appearance for eleven unknown and four unsupported cases. The default
ten-case experiment and default game remain unchanged. Focused worker, mask,
rectification retry and scope checks pass; complete render acceptance remains open.


## 2026-09-26 — exhaustive district rectification and local material benchmark

The former five-street source sample is replaced by an exact municipal-boundary
queue: 4,339 eligible frontages across 3,472 of 4,155 district owners. A native
4000px panorama profile keeps bulk evidence affordable on disk, shares immutable
panoramas with hardlinks and checkpoints each batch. Byte hashes and resolution
profiles prevent accidental cache mixing. Blank crops remain explicit omissions;
network/decode/resource failures stop for retry instead of becoming permanent gaps.

The independent first ten-image resolution review accepted seven for broad
colour/material triage, limited two, and rejected a sign-obscured wall. A second
30-image reference set was audited against every native image after incorrect
visual descriptions were found. Its corrected development revision has five
material-abstention cases; the original accuracy report is withdrawn. The new local-only Ollama
benchmark binds source hashes and model digest, captures real image latency and
raw responses, and preserves failed attempts on resume. These are evidence and
evaluation tools; neither successful rectification nor model agreement certifies
owner identity, exact wall colour or measured texture.

The coverage-gap audit identifies 355 owners failing address/height eligibility
and 328 passing those initial gates without an inventory frontage. The 49
addressless owners taller than five metres form a possible isolated next test;
no nearest-building identity guess or blanket height relaxation was introduced.


## 2026-09-27 — phone choices no longer pre-tint an answer

On a phone the next multiple-choice question came up with one button already
tinted copper, which read as a hint before any pick. Touch browsers (iOS Safari
in particular) keep `:hover` on the element under the lifted finger, and the new
question's buttons are rebuilt in the same spot, so a fresh button inherited the
hover style. `.canal-choice:hover` and `#canal-no-idea:hover` now apply only
under `@media (hover: hover)`. Named regression in
`tests/e2e/mobile-overlays.spec.ts` ("a new question shows every choice
alike…") parks the pointer at the tap point, since emulated Chromium does not
latch hover itself; it failed before the fix and passes after.

## 2026-09-26 — materials-first wall demo and identity-bound visual review

The photo-colour promotion was not adequate visual validation: Da Costakade 13
still read as charcoal after its sampled colour loaded correctly. The new opt-in
`material-demo.html` compares source photographs with the real game, a shared
12-material library, neutral diffuse lighting and a fixed material-block gallery.
It preserves current-game mode and never changes default game appearance.

The fixed 100-owner cohort spans 12 streets. Source assessments include material,
colour family, visible texture, uncertainty and crop hashes; eleven assignments
remain unknown. The ten-case rendering gate substitutes nine supported materials
and withholds its unknown case. Independent reviewers accepted six broad material
families and left four cases unresolved. Exact colour, metric texture scale,
ground floors and building geometry are not accepted by that result.

The loop rejected and corrected oversized brick courses, overly orange shared
brick, texture-wrapped caps and a dark shared cream preset. Magenta owner identity
renders and exact target crops prevented neighbouring buildings from being judged
as the target. A cream-facade disagreement required an independent focused-image
review; the earlier verdicts remain visible in the audit trail. The checked report
at `material-report.html` verifies source and capture hashes and exposes native
reference/current/trial/identity evidence. Generated imagery stays local.

A ten-image cheap-vision pilot is recorded with observed timing/tokens/reported
cost. It made a target-identity error and remains triage, not a trained or validated
citywide classifier. The next work and reproduction commands are in
`docs/plans/wall-material-demo.md`. The full `check:canal` gate, library checks, TypeScript lint and four isolated
port desktop/phone demo/report checks pass.

## 2026-09-26 — stable camera detail and reviewed colour expansion

Autonomous visual review now covers all 598 existing observations (501 buildings).
372 building colours are promoted, up from 16. Six conflicting observation groups
were resolved by model re-review; four remain withheld. Source hashes, reviewer
identity, abstentions and the reference-bound correction are retained in committed
review records. `npm run promote:wall-colours:model` reproduces the selection using
local evidence. Local release
`3d4551a8716c6b60dc59ba0d5de9b851628e62f4ae3eef2c6be7a5bd4ab7c9da`
contains these colours; 7,023 other district buildings still use contextual defaults.

After merging current main, the full `check:canal` gate, clean-checkout typecheck,
named roof regression and eight desktop/iPhone appearance checks pass. The latter
exercise the real route, repeated live camera updates, colour coverage mode and
Da Costakade 13. Generated release assets and photographic evidence stay local.

The owner's panning screenshots exposed a live-loop regression that frozen route
checkpoints missed. Every camera `jumpTo` could emit `moveend`, and shared residency
then disabled every active detail layer, disposed its meshes and fetched it again.
Visible roof/facade/tree/public-realm tiles now retain their geometry; only tiles
outside the viewport are evicted. The new 90-frame small-pan/stationary regression
failed with 360 lost layer frames before the fix and passes on desktop and iPhone.

The grey roof shards were measured facets intersecting uncut LoD1 tops. v4 admission
now withholds the entire roof if any component cuts through that top, rejecting
malformed geometry first. The current district has only one safely admitted small
roof, with 6,661 slanted buildings withheld. This is a clean fallback stopgap, not
completed gable reconstruction; a proper replacement needs closed upper walls and
an atomic handoff from the fallback mass. Named datum/eave regression facts remain.

Da Costakade 13 (Pand `0363100012166570`) had three photo observations but no accepted
wall colour: the sand facade and grey base were generated from its ID. Model review
now binds its correction to the clearer crop and the owner's supplied reference
photograph, sampling exposed warm brick as `#6d5e55`. No invented contrasting base
is rendered: unreviewed bases inherit the wall, and use one uninterrupted extrusion
to avoid a false lighting seam between two otherwise identically coloured layers.

## 2026-09-26 — model-reviewed local demo

All 72 unique signage frontages (76 sample entries) have model visual reviews:
73 sign regions, with 17 sampled sign backgrounds, explicit uncertain crops and
reviewer provenance. The responsive signage desk loads these without owner input.
These new labels are review evidence; their game placement is still pending.
Sixteen visually reviewed wall colours now complete the measurement → promotion →
publication → browser loop, labelled as model review rather than human judgement.

The local district release is
`6ee345158a1091e6c9c56dd8ac095440023492379fc534fb1bfbd7d475b228c4`:
6,036 roof-bearing buildings, 19,973 source surfaces, 26 roof tiles and 626
withheld slanted buildings under the NAP-corrected v3 policy. Coverage metadata
counts measured and contextual colours separately. Evidence/release files remain
local; source commits do not point remote users at unpublished release assets.
An eave-cut experiment was withheld after visual review found missing gable-end
walls, incomplete roof coverage and unsafe fallback during tile loading.

Render readiness now samples MapLibre's render event: a separate animation-frame
poll could repeatedly see a dirty map immediately before a fully ready paint.
The loaded/painted/budget gates and existing extrusion-visibility assertions
remain unchanged. A separate startup race allowed camera ticks to populate a
GeoJSON source before it was replaced, leaving the new source empty until the
next tile boundary. Streaming now waits for attachment, with a regression for
pre-attachment camera ticks and first-load delivery to the replacement source.

Validation: the complete `check:canal` gate passes, including Storybook. A fresh
checkout with its own `npm ci` passes typechecking and the tile-source regression;
the regression fails on the pre-fix source. The immutable local release passes
all fourteen route cameras plus coverage-toggle checks twice each on desktop and
iPhone emulation (eight browser tests). Named roof checks and immutable artifact
validation pass. Browser mobile coverage is emulation, not physical-device timing.

## 2026-09-26 — source-bound appearance and autonomous review

The owner explicitly removed routine human-in-the-loop review. Visual model reviews retain
model identity, exact crop hashes and uncertainty; they are never called human gold.
The signage desk now loads published model reviews without requiring owner labelling.
Duplicate sample IDs are reviewed once; occluded frontages abstain rather than claim absence.

Accepted wall-colour publication now binds building, observation, crop and measurement hashes;
unaccepted buildings retain explicit procedural provenance. The colour-coverage switch hides
unreviewed building masses and optional building details while retaining streets and trees.
OSM building/amenity/tourism/heritage survive staging, matched-footprint merging and LoD1 tiles;
these tags do not invent architectural details. Production tag tiles need the missing staging input.

DeepSeek through OpenCode audited the lattice evaluator: raw union input imputes zero boxes;
262 of 284 rows abstain and all 40 candidate fills fail overlap checks. Windows/doors-only
input adds 20 boxes (11 facade scope), recovering zero of 12 missing measured facade openings.
This is not evidence that every proposal is false: the point-cloud reference undercounts windows.
See `scripts/facade-eval/OPENING_LATTICE_UNION_R0_REPORT.md`.

Driving-scale baseline, Chrome 153.0.8010.53: fixed Da Costa camera
[4.874284, 52.371787], pitch 65°, bearing −18.12°, 3 seconds settling, 30 warm-up
frames, 120 sampled frames per baseline/ablation. Results are frame intervals and paired
layer-ablation deltas, **not isolated GPU timings**. Phone width uses desktop hardware.
The refresh-rate ceiling masks small costs; negative deltas are noise. This establishes a
16.8 ms observed baseline, not proof of spare GPU capacity, so joinery gates stay unchanged.

| Viewport (DPR 1) | Zoom | Frame p50 / p95 ms | Building / facade / roof / pyramid marginal p95 ms |
| --- | --- | --- | --- |
| 1440 × 900 | 17.1 | 16.7 / 16.7 | 0.0 / 0.0 / 0.0 / 0.0 |
| 1440 × 900 | 17.5 | 16.7 / 16.7 | -0.1 / -0.1 / -0.1 / -0.0 |
| 1440 × 900 | 18 | 16.7 / 16.7 | 0.0 / -0.1 / 0.0 / -0.1 |
| 390 × 844 | 17.1 | 16.7 / 16.7 | 0.0 / 0.0 / -0.1 / -0.1 |
| 390 × 844 | 17.5 | 16.7 / 16.7 | -0.1 / -0.1 / 0.0 / -0.0 |
| 390 × 844 | 18 | 16.7 / 16.7 | 0.0 / 0.0 / 0.0 / 0.0 |

Reproduce with `npm run profile:driving-appearance`; images/raw measurements are local under
`.cache/appearance-programme/profile`. Clean-checkout lint passed; clean aggregate requires
ignored panorama evidence. Evidence-rich aggregate exposed a stale positional roof assertion,
which must test behaviour rather than assume pyramid priority before measured eaves.

## 2026-09-25 — the OCR reads every sign more than once, and that is the fix

The reported failure was partial words — `Handwork Boutiqur`, `JOHNNIL`,
`GRAMS` — blamed on shadow and occlusion, which was the right diagnosis. Two
things followed from measuring it that were not expected.

**Resolution was already spent.** `run_vision_ocr.ts` has defaulted to the
ground tier all along: 110 px/m over a 4.9 m band, against 45 px/m for the whole
facade. A 45-storefront A/B puts the full tier at 11 storefronts read and the
ground tier at 33, so that win was banked long ago and the partial words occur
*at* the higher resolution. Preparing the crops (3x Lanczos, CLAHE, sharpen)
reaches 38 storefronts and 158 lines against 104 — but reading the output rather
than the totals, most of the gain is more fragments, not better ones: on
De Clercqstraat 70 `Handwork Boutiqur` became `Handwork Boutique` while a second
reading of the same fascia degraded to `Handwork Borfiaue`.

**Which is the finding.** A single crop already contains several readings of one
sign — the fascia, a window decal, an awning valance, repeated copies along a
hoarding — and their errors are independent, because what differs between them
is the occlusion. One Bilderdijkstraat hoarding came back as `WONDR`, `MONDR`,
`TONDE` and `LONDO`; one billboard was read three times, none correctly. The
redundancy needed to correct the reader was in every crop already, and taking
the first reading threw it away. Cross-year capture is the same signal with a
longer baseline, which is why persistence doubles as the notability ranking.

`facade/signConsensus.ts` votes across readings and recovers `CLAIM NU OP`,
`EERLIJK ETEN.NL`, `DOUGLAS` and `MAGAZINES GIFTS BOOKS` from sets where no
single reading was right.

**It is not yet a net win on text, and is deliberately not wired to anything.**
Over 1,980 cached reader lines it changes 24 of 1,340 strings, several for the
worse — `Scopes fentre` beat `ScooterCentre` because that crop renders the wrong
word larger and the glyph-height weighting believed it. The blocking fact is
that `agreement` does not separate good changes from bad: `Licherie` and
`Exclusive` are both wrong at 1.00 while the correct `MAGAZINES GIFTS BOOKS`
scores 0.79, so no confidence threshold makes the rewrite safe. What ships is
`support` / `views` / `years`, which are trustworthy now. The text rewrite waits
on a hand-transcribed reference set, because tuning against no ground truth is
exactly how the roofline and opening-detector lanes produced confident wrong
verdicts.

That reference set now exists — four crops transcribed by looking at them, in
`review-data/sign-gold/v1` — and it returned a negative result: the vote ties
the do-nothing baseline at 9 of 10 names recovered and 5 exact, fixing
`O TEM FA C` and breaking `ScooterCentre` in the same run. Clustering by
co-location as well as by string, so that two readings a metre apart get a
looser test, cut inventions from 7 of 31 to 6 of 29 and moved neither recovery
number.

What the reference set shows instead is where the loss actually is. `LA BASTA`
was read only as `DASTA` and `PASTA`, both wrong on the same letter, so no vote
over them recovers it — redundancy pays only where the errors are independent.
On the Freddy Fryday frontage the fascia panel crops the leading F, making
`REDDY FRYDAY` a correct reading of what is visible and the name recoverable
only from a different rectangle, which is a view-selection problem rather than a
text one. And four of the ten names are on businesses OSM already names, which
makes matching against OSM worth more than any further tuning of the vote.

## 2026-09-24 — the canal-belt roofline is 3 m high because of the track-datum correction

Canal-belt rooflines read a median **+3.2 m above `b3_h_dak_max`**, with the
*shape* traced well — step gables, bell gables and cornices all correct. Four
theories were measured and killed before the real one: it does not scale with
building height (corr 0.02), does not track the per-panorama lens correction
(corr −0.11), is not set-back objects (the gate would fire on 78 of 89 walls),
and is not stale massing (`groundZ_used − b3_h_maaiveld` = 0.00 on all 89;
corr 0.261; the "correction" made the offset worse, 3.66 m).

**It is the camera pose.** `resolveLens` in
`scripts/facade-twin/panorama-render.ts:119` sets `pose.z = lens.z − offsetM`,
where `lens.z` is the published camera height minus the geoid separation and
`offsetM` is the per-run/per-segment vertical datum correction from
`solve-track-datum.ts`. An A/B test (`scripts/roofline-eval/ab-test-renderer.ts`,
`ab-score.ts`) rendered the same wall plane and extent through both
`rectifyWall` (with the correction) and `rectifyFacade` (without):

| wall | with correction | vs 3DBAG | without | vs 3DBAG | that wall's `offsetM` |
| --- | --- | --- | --- | --- | --- |
| Herengracht 203 | 22.11 | +3.71 | 17.97 | −0.42 | −4.146 |
| Singel 279 | 21.54 | +2.94 | 17.45 | −1.14 | −4.064 |
| Keizersgracht 149 | 22.46 | +3.50 | 18.48 | −0.48 | −3.968 |

The height change equals that wall's own `offsetM` to within **3 cm**. That is
not a correlation but an identity, and it is expected: for a point on the wall
plane, a vertical camera error transfers 1:1 into the recovered height,
independent of standoff. Median offset across the five test walls: **+3.71 m**
with the correction, **−0.42 m** without.

**Visible without any reference data.** In the corrected render of Herengracht
203 the frame's claimed ground row (`bottomNap` 0.001, i.e. `b3_h_maaiveld`)
shows *the canal and a moored boat*; the uncorrected render shows the pavement
and parked cars where street level belongs. Rays at the nominal ground line are
about 4 m too steep, which is the same error seen from the other end.

70 % of the 144 views in this set carry a run-level `offsetM` between −4.0 and
−4.26 m, which is why the population median lands near +3.2 m. Note the
correction is *not* uniformly wrong: on the two test walls with small positive
offsets (Herengracht 163, Singel 273) it lands the lens at 2.7–3.0 m above
ground — right for a survey vehicle — and removing it puts the camera at 4.4 m.
So `solve-track-datum.ts` is right for some runs and badly wrong for the
dominant 2021 band, and the HISTORY note claiming that campaign publishes
heights ~4.2 m off is what is now in doubt.

**Not fixed, deliberately.** Gable *shape* is unaffected — the offset is
constant per run, so a profile normalised to its own eave and width is
invariant — and shape is what the game needs. Absolute height is a later,
tractable correction. Two cautions for whoever picks this up: the A5 comparison
that made the photo method look broken was scored against scan elevations that
are themselves unreliable (cyan reference lines sitting mid-facade), and the R1
gold set's `spotCheck` gate was specified and never applied, so "the photo is
wrong" was partly "the reference is wrong" — the same mistake that produced the
2026-09-22 façade-model rejection above.

## 2026-09-22 — the measured gold set says "none", and why that is not the whole answer

Built the façade-model evaluation's gold set and scorer, ran the two candidate
models against it, and applied the plan's fixed decision rule
([FACADE_MODEL_EVALUATION_PLAN.md](../../FACADE_MODEL_EVALUATION_PLAN.md) §1).
**Neither model clears it.** What was built:

- `scripts/facade-eval/build-gold-set.ts` joins the point-cloud measured openings
  (`public/data/pointcloud-facades/v1/*/manifest.json` `openingRects`) with the
  Oud-Zuid crops rectified onto the same 3DBAG wall plane, and freezes **60 walls
  / 70 measured openings** into `review-data/facade-model-gold/v1/measured.json`
  (sha256 `2d502904…`). Two conversion traps are handled explicitly: the
  published `along` is **centroid-relative and can be negative**, and the crop
  axis (`plane.start → plane.end`) is **mirrored** relative to the published `+u`
  for some walls, so opening corners are projected onto the crop axis rather than
  assuming an orientation.
- `src/canalRecall/facade/openingScore.ts` (+ test, 17 assertions): IoU matching
  in wall metres, precision/recall/median centre error with explicit
  denominators, `unknown ≠ negative` for other-class boxes, and `precision: null`
  — not `1.0` — when nothing is predicted.
- `scripts/facade-eval/score.ts` is the runner; `--write` appends to
  `results.json`.

Result on R0 (the cached 45 px/m strips, IoU ≥ 0.5, against 70 measured openings):

| lane | precision | recall | median centre | tp/fp/fn |
| --- | --- | --- | --- | --- |
| rfdetr (all kinds) | 2.4 % | 15.7 % | 0.298 m | 11/456/59 |
| rfdetr (window only) | 3.6 % | 15.7 % | 0.298 m | 11/292/59 |
| windet | 7.7 % | 7.1 % | 0.319 m | 5/60/65 |

The rule needs recall ≥ 0.80, precision ≥ 0.80 and median centre ≤ 0.30 m. Only
the centre error passes, and only for rfdetr. **Decision: none adopted on the
measured gold.**

The overlay for `NL.IMBAG.Pand.0363100012161771` wall 23 (green = measured,
red = rfdetr windows) shows why the precision figure is a **lower bound**, not a
verdict on the models: the MLS measured 13 openings on that façade while the
photo plainly shows about 20, and rfdetr's boxes land on the windows the
measurement missed. A shallow reveal is not a measured opening, so a model is
penalised for finding a real window. That is precisely what the plan's
hand-labelled half (§4 part 2) exists for, and the decision cannot be finalised
without it. Recall is the sounder reading of this run: at IoU 0.5 a
visually-correct box offset by a few centimetres is not a match, so 15.7 %
understates the detection. Both numbers are recorded as measured, not adjusted.

## 2026-09-22 — the point-cloud geometry design became an executable task plan

`AMSTERDAM_FACADE_GEOMETRY_DESIGN.md` described the pivot but no longer matched
the code: its build steps 1–4 already existed (uncommitted), step 5 was one line,
and its counts disagreed with this file and the v1 manifests. It is rewritten as
ordered tasks T0–T9, each with files, steps, a proving command and a done-when,
so a smaller model can run them without re-deriving context. Reading the code for
the rewrite found defects, now filed as tasks rather than fixed: the spike calls
an unimported `renderFacadeImage`; the Willemspark regression's `try/catch`
turns assertion failures into "not cached"; `loadLazTile` decodes absolute RD
into `Float32Array` (~3.1 cm steps at Y≈485 250, against 5 cm cells); and
`rasteriseWall` clamps returns from the 0.30 m end margins into the edge columns,
which is exactly how a coplanar neighbour's gable would leak in. The tooling
survey moved to an appendix; no task depends on it.

## 2026-09-21 — the municipal point cloud measures Amsterdam's rooflines and gables

The canal-house gable is the recognition signature of the game, and 3DBAG does
not carry it: measured on release `c4bebc1f…`, **0 of 895** canal-belt buildings
(Herengracht/Keizersgracht/Prinsengracht) have any wall surface above the roof
surface (`wallTop == roofTop` everywhere). The photo-only extraction could only
*infer* a gable class from an oblique crop. This change adds a second, independent
evidence channel: **the municipal puntenwolk (street-level Mobile Laser Scanning)
measures geometry directly; photographs keep appearance.** Full design:
[AMSTERDAM_FACADE_GEOMETRY_DESIGN.md](../../AMSTERDAM_FACADE_GEOMETRY_DESIGN.md).

What is built and verified:

- `src/canalRecall/facade/pointCloudGeometry.ts` — a wall's metric frame (`u`
  along the wall, `v` NAP-up, `n` outward), a **2.5-D depth raster** of the cloud
  returns in that frame, **geometric** classification of every cell into plane /
  recessed reveal (a window or door) / protrusion (a cornice, band, plinth or
  balcony), and a **roofline/gable silhouette**. `pointCloudGeometry.test.ts`
  pins 23 assertions on synthetic façades: the frame rejects a roof, a recessed
  window is recovered at its true `(along, up)` band, a cornice is protruding, a
  3 m gable is measured, and an isolated spike (a wire, a bird, a stray
  neighbour return) is **not** a roofline.
- `scripts/pointcloud/load-laz-tile.ts` decodes LAZ/LAS to absolute RD/NAP with
  `@loaders.gl/las` (already a dependency) plus a uniform-grid point selector.
  **`colorDepth: 'auto'` is required** — the loader's default of 8 reads the
  municipality's 16-bit colours as 255 (verified against `laspy`: mean red
  21,770/65,535 = 84/255).
- `scripts/pointcloud/measure-tile.ts` joins the cloud to 3DBAG LoD2.2
  `WallSurface`s (RD bbox query, `next`-link paging) and measures every exterior
  wall. `scripts/pointcloud/spike-museumkwartier.ts` writes an SVG elevation per
  wall plus a plan view; `scripts/pointcloud/check-pointcloud-geometry.ts` is the
  named regression.

Measured on the Museumkwartier demo tile `filtered_2397_9705` (10,854,907 points,
50 × 50 m at RD 119850–119900 / 485250–485300, NAP −5.26 → 23.45 m):

- 12 buildings, 156 exterior walls, 142 eligible, **99 measured**, **21
  well-scanned**. "Well-scanned" means the whole wall is sampled, not just
  present: column coverage ≥50 %, **≥250 returns/m²**, and **≥30 % of the wall's
  own cells carry returns**. Density alone was not enough — one Willemspark wall
  passed 400 pts/m² while most of its cells were empty because the returns were
  clustered, which the diagnostic render made obvious.
- **7 of 21 well-scanned street façades have a *shaped* roofline** (the measured
  profile's peak stands ≥0.5 m above **both** ends — a gable, step or dormer;
  11 are slopes, 3 flat). The definition is deliberately strict: a slope's peak
  sits at an end, and sensor noise on a slope must not be called a gable. An
  earlier, looser rule reported 25 and the gallery showed it was counting noisy
  slopes. The pinned example is `NL.IMBAG.Pand.0363100012161771` wall 23
  (11.7 × 15.0 m, 3.62 m range): two Amsterdam bell/neck gables are legible in
  the render, together with three window rows, the ground-floor openings and the
  arched neighbour.
- A second, independent tile validates the method: **Willemspark
  `filtered_2386_9702`** (7,165,726 points) gives 8 buildings, 155 exterior
  walls, **39 well-scanned** and **5 shaped** rooflines.
- **Demo:** `npm run publish:point-cloud-facades` writes a versioned, served
  extract to `public/data/pointcloud-facades/v1/` (per-tile `scene.obj` +
  `scene-colours.json` + `points.bin` + manifest + `index.json`; 86 measured
  walls, 6,381 vertices, 2,051 faces) and `npm run build:point-cloud-facades`
  bundles `public/canal-drive/pointcloud-facades.html` — an interactive Three.js
  view with a tile selector, layer toggles (source point cloud / measured mesh),
  **click-to-inspect** (a façade's frontage, coverage, roofline shape and range,
  storeys × bays, openings and gable rise) and a "frame selected wall" camera.
  The source point cloud is a 200k-point downsample of the tile's 7–11 M returns,
  encoded `PCF1` (uint32 count, Float32 xyz, Uint8 rgb); it shares one RD-space
  container with the mesh so the measured geometry sits exactly on the points it
  came from. Measured openings get their own dark material and the measured
  roofline is emitted as a bright strip, so the gable reads at a glance. Opening
  the page from `file://` shows an explicit "must be served" message rather than
  hanging on "loading…". The per-tile `gallery.svg` (contact sheet of every
  shaped roofline, drawn to scale) is linked from the page. Source hash, byte
  size and licences travel in the manifest; `reconstruction-status.html` links to
  it.
- Only 1 of 32 rises above 3DBAG's **whole-building maximum** roof height. That
  comparison is deliberately the strict one: a slanted roof always rises above
  the eaves, so eaves-vs-ridge is not a gable. The honest claim is the **shaped
  roofline**, not "above the roof".

- `src/canalRecall/facade/facadeMeshCompiler.ts` turns a measured wall into
  low-poly primitives: connected-component clustering of recessed cells into
  **opening rectangles**, of protruding cells into **bands and blocks**, and
  **rectangle subtraction** so the wall is emitted as a hole-free panel tiling
  (panels + openings exactly tile the wall). A bounding box alone **merges two
  windows separated by a thin pier** into one box — the diagnostic render showed
  it immediately — so `refineCluster` splits each region at columns and rows
  whose coverage is mostly wall. Coverage is measured against the **solid
  returns**, not the box, so an occlusion gap does not break a real opening
  (the first, box-relative version dropped a third of the windows on an occluded
  façade). `facadeMeshCompiler.test.ts` pins 27 assertions including the
  subtraction area invariant and a 0.4 m pier splitting two windows. The spike
  writes `diagnostic-*.svg` — the raw returns with detected openings (cyan) and
  protrusions (orange) outlined — so misses and false positives are visible.
- **`npm run spike:museumkwartier`** compiles all 32 well-scanned walls: **131
  openings, 6 gables**, median 3 storeys × 1 bay. Openings are grouped into
  **storeys** (rows) and **bays** (columns) — the rhythm the learning mechanics
  ask for. The scene (`scene.obj` + `scene-colours.json`) holds all 32 measured
  façades in true RD/NAP, every other exterior wall as grey massing, and the
  measured buildings' 3DBAG roofs; `render-facade-3d.mjs` draws a street view and
  an aerial 3/4 view. A building's measured wall tops and its roof planes were
  checked to coincide (e.g. `0363100012074448`: wall tops 10.8–15.0 NAP, roof
  10.8–15.0 NAP, same footprint), so the measured eaves meet the declared roof.

Residuals, all measured: the pinned wall's 11.7 m frontage carries two bell
gables and a taller arched section inside one 12.7 m building — that is a double
house, and the compiled gable polygon follows the whole measured roofline, so it
is not a defect. The unverified case is **coplanar neighbouring *panden***: on the
canal belt narrow row houses share a façade plane, and whether one 3DBAG
`WallSurface` can then pick up a neighbour's returns has not been tested
(Museumkwartier and Willemspark have wide blocks). The municipal LAZ host
(`files.lidar.data.amsterdam.nl`) is currently **NXDOMAIN**, so city-scale
geometry waits on the data team and these spikes run on the two UPCP demo tiles.
3DBAG's own LoD2.2 error for the pinned building is 1.08 m, so the mesh it
compiles from is looser than the cloud that measures it.

## 2026-09-21 — the district street-frontage camera stands clear of the opposite block

The first `street-frontage` camera scored candidate walls by raw area and stood off
from the **whole building bbox**, so for the parallel-slab districts the camera
landed inside the block across the street and produced a featureless wall filling
the frame (pass 20, defect 4). The selection now lives in
`src/canalRecall/review/districtFrontage.ts`, is picked in Node (not inside the
page) and is exercised by `districtFrontage.test.ts`:

- it keeps the substantial-wall-near-the-centroid score, then **marches outward
  from the wall midpoint along the wall normal until another building's footprint
  blocks the sightline** (render-space 2D point-in-multi-polygon over the compiled
  `building.footprint`), so the camera always stands in the open;
- it frames the **wall** (its midpoint and height) with a standoff capped so a
  190 m row is read as a street stretch, not a distant object, and widens the
  field of view when the street is too narrow to fit the height;
- the ground datum is computed once in Node (median `groundNAP`) and shared by
  the ground plane and the camera.

`scripts/review/check-district-street-frontage.ts` (zero-activation, reads the
compiled tiles only) pins each district's named selection —
apollobuurt-v1 Anthonie van Dijckstraat (27.1×10.9 m), slotervaart-v1
Comeniusstraat (93.3×25 m), tuindorp-nieuwendam-v1 Het Hoogt (190.3×14.4 m) — and
asserts the camera is not inside any footprint. Rendered and looked: slotervaart
went from a wall filling the whole frame to a facade with sky and ground visible;
tuindorp now stands at 50 m instead of 90 m; apollobuurt keeps its street row
context. **Residual:** all three compiled districts are still geometry-only
(`observations: 0`), so street-scale facade identity waits on the evidence stage
(spend). No release, no `current.json`, no `pipeline:district` run. The pass-22
session had left the typed module, its unit test and the check uncommitted;
pass 23 landed them (commit `a7c2427`) after re-rendering all three districts and
re-reading the images. Residual at street scale: with no compiled observations
every `street-frontage` render is a featureless monolith — apollobuurt reads best
(a wall seam, roof slope, sky and ground), slotervaart reads as a slab, and
tuindorp's 190 m Het Hoogt row fills the frame edge to edge — so no facade
identity claim is made.

## 2026-09-21 — case-12's missing roof detail is restored as a halsgevel neck

The 25-case review's case-12 Rozengracht 160 was filed "mising roof detail, missing
one whole floor of windows". The floor leg was delivered earlier (pass 16); the
roof leg is the building's **halsgevel neck** above the first-floor cornice, which
the stored source-shape study drew as flat brick all the way to the crop top — so
the gable was simply absent.

- `roof-coverage-corrections.json` gains a case-12 entry through the same
  source-bound roof-coverage lane used for case-27/case-21: a pixel-inspected
  24-point outline whose left neck edge follows the measured sky/brick boundary
  from the 2023 crop (shoulders at y=160), plus a flat crest top where the crop
  cuts.
- `scripts/review/refresh-reviewed-roof-coverage.ts` republished **only** case-12
  (packet `9ddc545c…` → `7a261e5b…`, idempotent). A deep diff of the archived
  prior shows the only changed case is case-12 and the only changed fields are
  `roofReview.status`/`uncertainty` and `shapeStudy.full`
  (`owner`, `patches`, `omissions`, `sourceSilhouette`); `createdAt`,
  `shapeFeatures` (including the pass-16 inferred upper row) and every other case
  are byte-identical. The metric `building-placement` candidate is untouched.
- `scripts/review/check-reviewed-roof-coverage.ts` (seventh lane of
  `check-reviewed-cases.ts`) now pins case-12 as a fresh coverage compile,
  its measured edges, its retained inferred row and that no roof opening was
  invented.

Rendered and looked before/after: a flat-topped beige rectangle became a halsgevel
with the neck, shoulders and gable window matching the source's identity.
**Residual:** a foreground tree trunk fully covers the right neck, so the right
outline is mirrored about the gable-window axis and the crest top is closed flat
where the crop ends — a coarse source-pixel approximation, not a measurement. No
metric placement, depth or colour claim is made.

## 2026-09-21 — the three new districts are rendered, grounded, and eyed at street scale

The Zuid, Nieuw-West and Noord districts finished their geometry stages, so for the
first time the reconstruction loop could check them **without publishing**.
`scripts/review/render-compiled-area.mjs` reads a compiled area's z14 appearance
tiles and renders fixed cameras in headless WebGL, touching neither `current.json`
nor any release. Two things made it actually judgeable:

- a **ground plane at the median declared `groundNAP`** — before it, every
  building floated over the background in plan and oblique;
- a **`street-frontage` camera** that picks a substantial wall near the district
  centroid, stands across the street at eye height, frames the building bbox and
  reports the chosen building id and street. The older `street-eye-*` views place
  the camera 0.55× the district radius from the centre at 1.7 m, which produces a
  thin skyline rather than a street.

Rendered and looked at all three (apollobuurt-v1 2,343 buildings; slotervaart-v1
3,410; tuindorp-nieuwendam-v1 3,315). Verdict: recognisable massing — Oud-Zuid
perimeter blocks with courtyards and the Parnassusweg diagonal; the Nieuw-West
parallel *strokenbouw* slabs; the Noord low-rise diagonal garden-village rows.
**Residual:** every compiled index reports `observations: 0` (geometry-only,
because the district `evidence` stage is unauthorized on spend), so street-scale
facades are featureless monoliths and storey rhythm / colour cannot yet be
judged. Roofline fidelity is unverified without a reference overlay. No
publication, activation or spend.

## 2026-09-21 — case-05's missing entrance is restored from its source recess

The 25-case review's case-05 Lauriergracht 67/69 was filed "roof too high into
the sky, windows opverlapping too much, no door". The roof and window legs are
separately handled; the "no door" leg was the **full source-shape study**, which
painted all three ground windows (`full:window-r4-b1/b2/b3`) but no entrance,
because the 2023 full-crop extraction returned none. The dated full photograph
shows a central recessed entrance between the two ground-window banks, and the
building's clearer 2025 ground capture confirms that identity. The leaf itself is
hidden by ivy and deep shadow, so only the measured recess position is declared —
`source-geometry-corrections.json` gains a `case-05` full-tier entry adding
`full:review:entrance-door` (bounds `[202,711,228,815]`, leaf `#38271f`, frame
`#312d29`) with the occlusion named in its `visibility`. No metric placement,
depth or access claim is made.

- The correction flows through `stageSourceGeometryPacket`, the same
  source-hash-validated, idempotent transform `build-facade-preview` uses, so a
  rebuild reproduces the delivered study rather than losing a one-off edit.
  `scripts/review/refresh-reviewed-source-geometry.ts` republished only case-05's
  `shapeFeatures.full` and `shapeStudy.full` (packet `4181458d…` → `9ddc545c…`).
- A deep diff of the archived prior shows the only changed case is case-05 and
  the only changed fields are `shapeFeatures/full/features` (+1),
  `shapeStudy/full/patches` (+10) and `shapeStudy/full/counts/door` (0 → 1);
  `createdAt`, the metric `building-placement` candidate and every other case are
  byte-identical.
- `scripts/review/check-reviewed-source-geometry.ts` (fourteenth lane of
  `check-reviewed-cases.ts`) pins the delivered door, its declaration, the
  fresh-reproduction durability, that no other case or the ground tier moves, and
  that a stale source fails closed.

Rendered and looked before/after: the blank brick between the ground windows became
a dark door with its frame, matching the source's entrance composition.
**Residuals:** the door's exact width/height is a source-pixel approximation of an
ivy-occluded recess, and the metric candidate plus the live game still use the
uncorrected ground-crop registration. No metric or photographic acceptance is
claimed.

## 2026-09-21 — case-21's bell gable is restored from its source outline

The 25-case review's case-21 Lauriergracht 50 was filed "missing roof, missing
ground floor window, first floor is all widnows no door". Its full source-shape
study drew a flat-topped brick rectangle while the source photograph shows a
**bell gable** with a cream stone crest and side scrolls. `roof-coverage-
corrections.json` now carries a pixel-inspected 16-point bell-gable outline plus
three cream fields — the pediment/crest, the left volute and the right volute
with its cornice — and `refresh-reviewed-roof-coverage.ts` republished only
case-21 through the same `prepareRoofCoverageStudy` path `build-facade-preview`
uses (packet `ad09c342…` → `4181458d…`, idempotent).

- A deep diff of the archived prior shows the only changed case is case-21 and
  the only changed fields are `roofReview`, `shapeFeatures` and `shapeStudy`; the
  metric `building-placement` candidate, `candidateObservations`, every other
  case and `createdAt` are byte-identical (the placement capture hashes equal
  before and after).
- `scripts/review/check-reviewed-roof-coverage.ts` (seventh lane of
  `check-reviewed-cases.ts`) now pins both delivered cases: case-27's dark roof
  field and stacks, and case-21's cream fields, 16-point outline, fresh-compile
  durability and `source-outline-reviewed` status. No roof opening is invented.

Rendered and looked before/after: the flat top became a bell gable with the
cream crest and side scrolls, matching the source's identity. **Residuals:** the
crop cuts the very top of the crest and a cast shadow crosses the lower bell, so
the outline is a coarse source-pixel approximation rather than a measurement; the
left-volute patch reads slightly detached at the silhouette step. The case's
ground-floor portrait display glazing and its metric roof/ground remain
separately parked. No metric or photographic acceptance is claimed.

## 2026-09-21 — case-05's overlapping window frames meet at the measured pier

The 25-case review's case-05 Lauriergracht 67/69 was filed "roof too high into
the sky, windows opverlapping too much, no door". The overlap is real and
measured, not an impression: the extraction places the narrow window `b3` and
the wide bay `b4` **1.9 source pixels** apart (their glazing boxes leave a 1.9 px
gap), while the compiler draws every observed opening with its own default
`.14 m` frame border. Each frame then protrudes across its neighbour, so the pair
reads as one overlapping blob in the source-shape study — the repair-preview's
default view.

- `frameClearancePx` is a new **opt-in, per-feature** reviewed declaration on
  `FacadeFeature`: the measured same-row glazing gap in source pixels. When
  present, `observedAssemblyPatches` caps the frame border to it, and never past
  the nearest same-row opening (`sameRowOpeningGapPx`), so the two frames meet at
  the midpoint instead of crossing. A well-spaced opening declares its large gap
  and keeps the full border; an opening with no declaration is byte-stable, so no
  other reviewed study or metric candidate moves.
- `src/canalRecall/facade/openingFrameCorrections.ts` +
  `scripts/review/opening-frame-corrections.json` declare the six measured
  openings (`full:window-r{1,2,3}-b{3,4}`, clearance `1.9`). The applier fails
  closed on a stale crop binding, is idempotent and never mutates its input.
- `scripts/review/refresh-reviewed-opening-frames.ts` republished **only**
  case-05's stored `shapeFeatures.full` (now carrying the declarations) and
  `shapeStudy.full` (packet `cf5b0da4…` → `ad09c342…`, idempotent). A deep diff
  of the archived prior shows the only changed case is case-05 and the only
  changed fields are those two; `candidateObservations`/`patches`,
  `shapeStudy.ground`, `createdAt` and the other 27 cases are byte-identical.
- `scripts/review/check-reviewed-opening-frames.ts` (thirteenth lane of
  `check-reviewed-cases.ts`) pins the declared clearances, the delivered packet,
  a fresh reproducible compile, the opt-in scope (no other case carries the
  field), the non-overlapping rows and the fail-closed applier.

Rendered and looked before/after: the narrow window and the bay now draw two
separate frames that meet at the measured pier instead of one overlapping mass,
matching the source crop. **Residuals:** the correction is deliberately a
source-shape-study declaration, so the metric `building-placement` candidate and
the live game still draw the uncorrected `.14 m` frames (the game-facing overlap
is visible there). Fixing that needs a shared compiler rule across every
reviewed case — measured to change case-09/12/19/22/24/30 studies and their
delivered lanes — so it belongs to a versioned regeneration, not this pass. The
case-05 roof spike and the extraction's narrow-row column alignment remain
separate parked items. No metric or photographic acceptance is claimed.

## 2026-09-21 — case-12's missing upper-floor row is reconciled from the observed rhythm

The 25-case review's missing-floor group is case-12/13/16/17. Re-reading their
crops showed only **case-12 Rozengracht 160** is a real whole-row miss: the
extractor reported `openingsComplete: true` and returned one of the two clear
upper window rows below the gable (`full:window-2/3/4`, glass y164-230), so the
second row (y279-343, directly above the Heineken shopfront) rendered as blank
masonry in both the shape study and the metric candidate. case-13/16/17 each
already detect every visible upper row; their blank lower band is the occluded
ground floor, which is a separate tier/crop issue.

- A **generic** gap-based inference was measured and rejected: a same-size
  anchor-to-ground gap appears on case-08 (owner-accepted) and case-11 (a
  delivered storefront case), so a global "insert a row" rule would over-fire.
  The row is therefore reconciled **per case** from the observed rhythm.
- `src/canalRecall/facade/floorRowCorrections.ts` + `floor-row-corrections.json`
  declare the observed anchor row, the measured 80 px storey pitch, the fascia
  top (y385.065) and three pixel-measured openings. `applyFloorRowCorrections`
  fails closed unless the anchor-to-ground gap is larger than one storey and
  each row sits between the anchor glass and the ground band; it is idempotent
  by feature id and marks the rows `agent-inspected` with an explicit
  `inference: observed-row-rhythm` provenance. Bounds were measured from the
  crop's bright frame components and cross-checked against the left window's
  frame outline x40-104 / y271-351.
- `scripts/review/refresh-reviewed-floor-rows.ts` republished only case-12
  (packet `924bece7…` → `cf5b0da4…`); a deep diff of the archived prior shows
  the only changed case is case-12 and the only changed fields are
  `candidateObservations`, `patches`, `counts`, `shapeFeatures` and
  `shapeStudy` (`createdAt`, `frame` and the other 27 cases byte-identical). It
  is idempotent.
- `scripts/review/check-reviewed-floor-rows.ts` (twelfth lane of
  `check-reviewed-cases.ts`) pins the declared correction, the delivered
  packet, a fresh shared-builder reproduction, the fail-closed boundaries and
  that no other reviewed case gained a row.

Rendered and looked before/after: the blank wall between the first upper row and
the shopfront now carries the measured second row of three framed windows,
matching the source. **Residuals:** the detected first row (`full:window-2/3/4`)
is narrower than the source's same row, so the two rows are not column-aligned;
this is a pre-existing detection-extent issue and was not touched. No metric or
photographic acceptance is claimed.

## 2026-09-21 — case-18's stored render gets the near-white glazing guard

The 25-case review's occlusion group is case-03/18, both filed as "need a
different photo" / "building occluded, need to infer". Rendering case-18's
stored packet showed a second, unreported defect: its four windows were **solid
white arches**. The extraction had declared `colour:"#ffffff"` for both the glass
and the frame — the near-white it sampled — so the pre-guard compiler painted
glazing and frame white.

- The pass-14 near-white guard already recolours the **glazing** to the neutral
  glass `windowGlass` (`#526a6b`) while leaving the **frame** hex alone. That is
  the right split here: the source photograph shows dark arched glass in white
  frames, so the white frame patches are architecture, not a mis-sample. The
  recolour is therefore **partial** (41 glazing patches white → neutral, 102
  white frame patches kept), unlike case-11's wholesale swap.
- `scripts/review/refresh-reviewed-glazing.ts` gained a `--tier` filter (default
  both). A stored tier can carry a delivered correction that a plain
  `compileSourceShapePreview` does not reproduce: case-18's **ground** study has a
  raised-entrance correction (13 door patches and an `omissions` note) that the
  plain compile drops, so the refresh was run `--tier=full` and the ground study
  is left byte-identical. The safety assertion was generalised from "white must
  fall to zero" to a conservation check: the observed-window patch total is
  unchanged, every non-glazing colour is untouched, and the neutral-glass gain
  equals the white loss.
- Packet `168fc6d…` → `924bece7…`; a deep diff of the archived prior shows the
  only changed case is case-18 and the only changed fields are `patches` and
  `shapeStudy.full` (`shapeStudy.ground`, `createdAt`, `shapeFeatures` and the
  other 27 cases are byte-identical). The refresh is idempotent.
- `scripts/review/check-reviewed-glazing.ts` (eleventh lane of
  `check-reviewed-cases.ts`) now pins both delivered cases: each keeps its stored
  near-white extraction gap, renders neutral glazing, equals a fresh guarded
  compile, and case-18's ground raised-entrance correction survives.

Rendered and looked before/after: the three upper arched windows and the lower
window were blank white and are now dark glazing with white frames, matching the
source crop. The ground tier is unchanged. **Residual:** case-18 remains heavily
occluded by a foreground station sign; only a better-dated source can address
the review's inference ask. No metric or photographic acceptance is claimed.

## 2026-09-21 — near-white window colours no longer paint blank white panes

The 25-case review's case-11 De Clercqstraat 26 was filed as "missing shopfront
window". Rendering its metric candidate and its source-shape study showed a
second defect: **every upper window was a blank white pane**. The extraction had
declared `colour:"#ffffff"` for all twelve full-tier windows — the near-white
frame or curtain it sampled — and the facade compiler painted that observed hex
straight into the glazing (`observedAssemblyPatches` used `f.colour` as the
glass). case-18 is the only other case with the same extraction gap.

- `src/canalRecall/cityAppearanceFacadeRecipes.ts` now treats a **near-white
  window colour** (all three channels ≥ 235) as undeclared and falls back to the
  neutral glass `windowGlass` (`#526a6b`). A genuine glass hex is kept, the
  boundary is exact, and **door leaves are excluded** — a white door is real
  architecture, and the reviewed ground tier supplies its own door colours.
- `scripts/review/refresh-reviewed-glazing.ts` recomputes only the affected
  case's candidate fields (through the shared `buildCaseCandidate`) and its
  stored full source-shape study (through `compileSourceShapePreview`), then
  publishes through the immutable `publishPreviewRevision`. It asserts that the
  **only** change is the near-white window glazing losing its white panes, and
  is idempotent. Packet `9258d89…` → `168fc6d…`.
- The packet deep-diff is exact: the only changed case is case-11 and the only
  changed fields are `patches` and `shapeStudy.full`; `createdAt`, the stored
  `shapeFeatures` (so the extraction gap stays visible), `counts` and every
  other case are byte-identical. `shapeStudy.ground` was already neutral.

Rendered and looked before/after: the source-shapes study and the
building-placement view now show the dark glazing the source photograph has
(white frames stay white), instead of twelve white rectangles. Residuals: case-18
still carries the near-white gap in its packet artifacts (the compiler guard
already covers its next compile), and the live game only picks the guard up when
the pre-existing-WIP viewer bundle is rebuilt by the integrating agent. No metric
or photographic acceptance is claimed.
`scripts/review/check-reviewed-glazing.ts` (eleventh lane of
`check-reviewed-cases.ts`) pins the guard on synthetic features (boundary and
door-leaf exclusion included), the delivered case-11 packet, the study's
fresh-compile durability, and case-18's preserved gap.

## 2026-09-21 — material frontage-coverage gaps now draw on the registered frontage

The 25-case review flagged case-02 De Clercqstraat 20/22 as "missing business
window". Rendering showed the metric candidate drew **only the left half** of the
building: the release bound a single 3DBAG wall surface 5.10 m long while the
observation's registered frontage is 8.09 m. The cached crop plane spans the
registered frontage, so the storefront entrance and the right window column
mapped beyond the 5.10 m frame and were clipped away by `clipTrianglesToFace`.
The same pattern — a coplanar declared frame that does not span the frontage —
hit case-13, case-19, case-22 and case-29.

- `scripts/review/case-candidate.ts` now measures the **union coverage** of the
  usable declared frames along the crop-plane axis and draws on the registered
  frontage when the uncovered gap exceeds a material threshold
  (`max(1.5 m, 15% of the crop-plane length)`), in addition to the existing
  non-coplanar rule. Below the threshold a coplanar declared frame still owns the
  frontage, so crop-margin rounding (case-01 0.14 m … case-05 0.93 m) does not
  switch planes. Sub-threshold cases with a real but small gap deliberately keep
  their declared surface (case-15 1.75 m, case-23 2.23 m, case-27 2.38 m).
- `scripts/review/refresh-reviewed-frontage.ts` republished only the five
  affected candidates (packet `dd1fd2e…` → `9258d89…`); every other case and
  `createdAt` are untouched, and re-running any of them is `already-current`.
- This is a **source-space frame** fix, not a new geometry claim: the synthetic
  wall still runs along the registered frontage and is still validated by
  `facadeWallFrame` against the building boundary. No metric registration or
  photographic fidelity is asserted.

Rendered and looked at each before/after: case-02 now draws the full brown-brick
facade (both window columns, the storefront entrance, the green awning and the
display glazing) matching its source; case-13, case-19, case-22 and case-29 each
render their full-width facade instead of a clipped sub-segment. Residuals stay
the same extraction/placement issues already logged for these cases (e.g. a
striped material/awning band across case-02), and no whole-building acceptance
is claimed. `scripts/review/check-reviewed-frontage-coverage.ts` (tenth lane of
`check-reviewed-cases.ts`) pins the measured coverage gaps, the switch set, that
the five stored candidates are exactly fresh shared-builder compiles, that their
frames span the registered frontage, and that the sub-threshold cases keep their
declared frames.

## 2026-09-21 — case-30's blank candidate is recovered from its registered frontage

The 25-case review's centering group is case-06/20/30; case-30 Rozengracht 212
was the owner's explicit ask ("registration slightly off; we could have inferred
the right fit"). Measuring it showed something worse than mis-centring: the
metric candidate was a **blank monolith** (0 observed patches). Its 4.43 m
registered frontage is fragmented by 3DBAG into three skewed pieces (#2 1.27 m,
#4 2.11 m, #5 1.12 m), only #4 clears the `surfaceMatches` overlap gate, and #4
is 0.71 m off the cached crop plane — beyond the compiler's 0.18 m
non-coplanarity guard — so the source abstained. The registered frontage itself
is exactly coplanar with the crop plane (0.0000 m at both ends, both tiers), the
same fact that recovered case-09.

- `scripts/review/case-candidate.ts` now draws on the registered frontage when
  no usable declared surface is coplanar with the crop plane (declared offset >
  the compiler's own 0.18 m guard), not only when no surface gives a frame. A
  declared surface that is coplanar (or inside the guard) still wins, so case-06,
  case-19 and case-20 are unchanged; case-09's path is unchanged.
- `scripts/review/refresh-reviewed-frontage.ts` republished only case-30's
  candidate fields (packet `4d57571…` → `dd1fd2e…`). A before/after diff shows
  the only changed case is case-30 (`candidateObservations/frame/patches/counts/
  omissions`); `createdAt` and every other case are byte-identical. It is
  idempotent (`--dry-run` → `already-current`).

Rendered before/after and looked: before was a beige massing monolith; after is
the full 4.43 m facade on its registered frontage — brick wall, the central
column of tall windows, both columns of arched upper windows, and the ground
shopfront with its arched display glazing and two flanking doors. Residuals: the
metric placement shows a pale band at the crop's left edge and a striped region
above the entrance (extraction material/awning features from a crop that includes
a slice of the pale left neighbour), and the literal "BIANCO" sign is not drawn
(unreviewed-sign policy). No metric or photographic acceptance is claimed.
`scripts/review/check-reviewed-frontage-fallback.ts` (ninth lane of
`check-reviewed-cases.ts`) pins case-30's recovered counts, that its frame is the
full registered frontage, that the crop plane is coplanar while #4 is not, that
the stored candidate is exactly a fresh shared-builder compile, and that a
coplanar declared surface (case-19) still wins.

## 2026-09-21 — case-09's blank candidate is recovered from its registered frontage

The 25-case review flagged case-09 Rozengracht 228 as "missing door". Rendering
showed something worse: the metric candidate was a completely blank monolith.
The release bound no wall surface, and every 3DBAG wall at that frontage is a
sliver, skewed or non-planar, so `facadeWallFrame` had nothing usable to draw on
and the preview abstained (`No usable published facade surface`). The
observation's registered frontage is exactly coplanar with the cached crop plane
(0.00 m off at both ends, both tiers), so it is the only defensible drawing
plane.

- `src/canalRecall/facade/registeredFrontage.ts` builds a synthetic rectangular
  wall surface on that registered frontage, spanning the building's own wall
  extent. It invents no position (the frontage is registered) and no height
  beyond the building, and `facadeWallFrame` still validates the ring against the
  building boundary, so a frontage that is not on the boundary abstains.
- `scripts/review/case-candidate.ts` is the per-case candidate builder now shared
  by `build-facade-preview.ts` and targeted refresh scripts. It uses the
  synthetic frontage surface only when none of the declared surfaces gives a
  usable frame, so cases with a real surface are unchanged.
- `scripts/review/refresh-reviewed-frontage.ts` republished only case-09's
  candidate fields through the immutable `publishPreviewRevision` helper
  (packet `297054a…` → `4d57571…`); a before/after diff shows the only changed
  case is case-09 (`candidateObservations/frame/patches/counts/omissions/status`)
  and `createdAt` is untouched. It is idempotent (`--dry-run` →
  `already-current`).

Rendered before/after and looked: before was an untextured massing monolith;
after is the source's paired arched windows, gable window, ground band and the
recovered entrance + display glazing. The upper wall stays the neutral render
base (the extraction supplies no colour for it), the same residual recorded for
case-08. `scripts/review/check-reviewed-frontage-fallback.ts` is the named
regression (ninth lane of `check-reviewed-cases.ts`): it pins the recovered
counts, that the frame is the registered frontage, that no published surface
covers the frontage, and that the stored candidate is exactly a fresh
shared-builder compile. (It originally pinned that case-30 still abstained; that
case is now delivered by the same fallback — see the entry above.)

## 2026-09-21 — case-08's missing wall colour is a declared source observation

The 25-case review's colour/material group is case-08/14. case-14's red brick
and accent suppression are compiler deliveries. case-08 Rozengracht 251 is the
other defect: it declares an `upper-wall` `brick` material with **no colour
field**, and `compileFacadePatches` only paints a material whose `colour` is a
valid hex. So the workbench showed the neutral render base `#d7d0c7` over a
source that is a dark, desaturated brick wall with cream bands and a cream top
cornice — the review's "missing building color and white cornice".

Pass 4 parked this as an extraction/field gap rather than sampling a colour in
the compiler, because a sampled value is unreliable under shadow and occlusion
and must never become an accepted material. The delivery here is therefore a
**declared observation**, not an extraction rewrite:

- `scripts/review/wall-colour-corrections.json` declares case-08's whole-crop
  `full:mat-brick` as `#594e48` — the masked-crop-percentile sample already
  recorded in `review-data/case-wall-colour.json`, cross-checked by eye against
  the 2025 source — and the extraction's thin `full:mat-accent` band at the top
  as cream `#e8e8e8`.
- `scripts/review/refresh-reviewed-wall-colour.ts` applies them to the review
  packet's **source-shape study only**, through the same
  `compileSourceShapePreview` + `applySourceAssemblies` path
  `build-facade-preview.ts` uses, and republishes via the immutable
  `publishPreviewRevision` helper (packet `11305a4…` → `297054a…`). A prior/new
  diff shows only `case-08.shapeStudy` and the new `case-08.wallColourReview`
  marker changed; every other case is byte-identical. It is idempotent
  (`--dry-run` reports `already-current`).

The stored `shapeFeatures.full` material is deliberately left colourless, so
`check-reviewed-wall-colour.ts` still pins the extraction gap and a future
extraction that supplies the colour is noticed. `check-reviewed-wall-colour-
render.ts` (the eighth lane of `npx tsx scripts/review/check-reviewed-cases.ts`)
pins the declared colour, the preserved gap, the reproducible corrected compile
and the marker. Rendered before/after and looked: the study wall is now the
declared dark brick with the cream top band, window surrounds and the
`moeders` sign, matching the source; before it was the neutral beige base.

Residual: this is a source-shape study observation, not a metric or production
material. The building-placement candidate and the live game render still use
the colourless extraction and fall back to the neutral base until a registry /
release regeneration supplies the field.

## 2026-09-21 — case-27's missing roof is a delivered source-bound silhouette

The 25-case review grouped case-19/27 as "missing roof". Rendering showed the
study's roof was simply not drawn: `case-27` De Clercqstraat 79's full
source-shape study painted only the brick upper wall (its `upper-wall` material
bounding box reached up into the roof), so the top read as flat brick with no
roof. case-27 has the one legible full source of the two, so it is the case the
roof lane can actually fix.

`roof-coverage-corrections.json` now declares a pixel-inspected case-27
correction, measured against the column sky/roof boundary of the 2023 crop:

- a silhouette that follows the lower left roof slope, the ridge, both chimney
  stacks and the facade's right edge at x=906 (the right neighbour carries a
  roof at the same height, so the outline stops at the edge);
- a broad dark roof field `#3f3f3d` and the two brick stacks `#4d4946`, both
  appended after the machine wall material so they paint over it;
- no invented roof opening: the source shows none, and the regression asserts it.

`refresh-reviewed-roof-coverage.ts` republished the study through the same
`prepareRoofCoverageStudy` / `applyRoofCoverageStudy` path
`build-facade-preview.ts` uses, via the immutable `publishPreviewRevision`
helper (packet `1a969c0…` → `11305a4…`); an archived prior/new diff shows
`case-27.roofReview`, `case-27.shapeFeatures` and `case-27.shapeStudy` are the
only changed fields. The metric building-placement candidate is untouched. The
refresh is idempotent (`--dry-run` reports `already-current` for case-01/04/09).

`scripts/review/check-reviewed-roof-coverage.ts` is the named regression: every
declared correction must still be delivered with a silhouette and its reviewed
features, case-27 must be exactly a fresh coverage compile painting `#3f3f3d`
with two stacks and no invented opening, and case-19 must stay unreviewed. It is
the seventh lane in `npx tsx scripts/review/check-reviewed-cases.ts`. The
ground-floor shopfront in the same full study is a separate defect and remains
open; case-19's source is too occluded (pole, wires, branches) for a defensible
silhouette and stays parked.

## 2026-09-21 — the 25-case review regressions have one command

The review loop landed one named check per DEPTH lane — contextual floors
(case-12/13/16/17), retail ground assemblies (case-02/05/11/29), roof vertical
geometry (case-01/05/19/27), wall colour (case-08/14), framing/centering
(case-06/20/30) and the case-14 source-shape study. They are deliberately
separate files with separate fixtures, but they only do their job when run
together, so `scripts/review/check-reviewed-cases.ts` runs all six in isolated
child processes and fails the aggregate if any lane regresses:

    npx tsx scripts/review/check-reviewed-cases.ts

Each check still holds its own measured evidence and before/after images; the
aggregate adds a single per-lane pass/fail + timing summary and a non-zero exit
on regression. A child process per check (rather than one import) keeps a
lane's module-level state and `process.exit` from leaking into the next. There
is no `package.json` entry by design: the branch carries large pre-existing
`package.json` WIP that must not be folded into a loop commit.

## 2026-09-21 — case-14 stored shape study refreshed; the overpaint is gone from the render

Pass 4 fixed the whole-facade "accent" overpaint in the compiler, but the
delivered review packet (`public/data/facade-repair-preview/cases.json`) was
built before that guard, so case-14 Elandsgracht 19's *source-shape* study still
painted the entire wall white. A full `build-facade-preview` rebuild is unsafe
(several cases carry shape-study post-processing and delivered corrections that
live outside that builder), so `scripts/review/refresh-reviewed-shape-study.ts`
republished a targeted revision through the existing immutable
`publishPreviewRevision` helper: it recomputes only case-14's full study from its
own stored `shapeFeatures` and leaves every other case byte-identical. Verified by
diffing the archived prior packet (`f400bd…`) against the new one (`1a969c0…`):
the only changed field is `case-14.shapeStudy.full`. The metric
building-placement candidate was already correct and is unchanged.

Rendered before/after and looked at: the study wall is now the declared red brick
`#8b4513` with white window surrounds and the localized ground band, matching the
source's red-brick-with-white-accents; before it was a full white wall with only
the windows and door visible. The whole-crop `full:material-accent` feature
remains in `shapeFeatures` by design — the guard suppresses its patch at compile
time, so the study carries exactly one wall material. The refresh is idempotent
(`--dry-run` now reports `already-current`). `publishPreviewRevision` never
touches `current.json`, a release, notes or the spend journal; prior packet bytes
are archived under `public/data/facade-repair-preview/revisions/`.
`scripts/review/check-reviewed-shape-study.ts` is the named regression: it asserts
the delivered study is exactly a fresh guarded compile, that the whole-crop accent
is declared and suppressed, and that the wall paints as `#8b4513`.

## 2026-09-21 — Framing/overlap group measured: three causes, not one centring defect

The 25-case review's "centering-framing" group (case-06 "maybe taking in a bit of
the next building?", case-20 "too much overlap, needs to be better centered",
case-30 "registration slightly off; we could have inferred the right fit") was
rendered and measured owner-by-owner. It is three distinct causes, and only one
touches crop centring.

- **case-06 Da Costakade 204** is registered correctly: one 7.41 m frontage on
  collinear surface #2. The crop is the problem — its detected building run
  reaches the right edge and the fourth upper window bay ends exactly at the crop
  width, so the crop includes a slice of the next building. Fixing it is a
  versioned crop tightening, not a compiler change.
- **case-20 De Clercqstraat 74** registers a 6.05 m frontage that 3DBAG splits
  across two collinear, coplanar segments (#9 3.18 m + #8 2.87 m). The release
  already binds both ([8, 9]) and the preview compiles one observation per
  segment, so the source is **not** squeezed onto a single 2.87 m wall — an
  earlier read of this group assumed it was. The residuals are a review panel
  centred on the first usable segment and a ~0.45 m offset between the
  independently-transformed ground and upper crops.
- **case-30 Rozengracht 212** registers a 4.43 m frontage that 3DBAG fragments
  into three near-collinear-but-skewed pieces (#2 1.27 m, #4 2.11 m, #5 1.12 m;
  off-plane 0.01/0.46/0.70 m, angles 0.1/12.8/12.6°). Only #4 clears the
  `surfaceMatches` overlap gate, so the release binds 2.11 m of a 4.43 m
  frontage; the preview's 0.18 m non-coplanarity guard then abstains and the
  candidate is a blank monolith with zero observed patches.

All three need a versioned regeneration (crop tightening; measured surface
rebinding; shared ground/upper registration) rather than a one-pass edit, so the
lane is parked with the evidence. `scripts/review/check-reviewed-framing.ts` is
the named regression; it re-measures the centring runs, the frontage/surface
geometry and the release bindings so neither the data nor the diagnosis can drift
silently. The existing `report-case-framing.ts` / `build-framing-overlay.ts`
diagnostics produce the supporting per-crop report and overlay image.

## 2026-09-21 — Wall colour: whole-facade "accent" overpaint fixed; case-08 gap measured

The 25-case review's colour/material group (case-08 "missing building color",
case-14 "misunderstanding building color entirely — it's red brick with white
accents") turned out to be two distinct defects, not one sampler problem.

- **case-14 Elandsgracht 19** declares its upper wall correctly (`material`
  `brick`, `colour` `#8b4513`), but the extraction also returned a whole-facade
  `accent` (`#ffffff`, bounds equal to the entire crop). `observedAssemblyPatches`
  painted the accent after the wall, so the candidate rendered white over a
  red-brick source. It now skips a trim region (`accent`/`band`/`surround`/
  `plinth`) whose bounds cover ≥60% of the source crop: a real accent is small,
  and an unusable one must not repaint the wall. A localized band still paints.
- **case-08 Rozengracht 251** declares `material` `brick` with **no colour** and
  no localized trim, so the renderer falls back to the neutral base `#d7d0c7`
  and the candidate is beige where the source is a dark, desaturated brick. That
  is a missing extraction field. A deterministic masked sampler
  (`src/canalRecall/facade/wallColourSample.ts`) measures the crop at `#594e48`
  (brick family) and records it as a declared observation, but the field must be
  supplied upstream.

The sampled wall colour is deliberately a `needs-review` observation, never an
accepted material: across the reviewed set it is unreliable under shadow and
occlusion (case-14 carries a large tree and samples grey), so it must never
silently override a declared material. `scripts/review/check-reviewed-wall-colour.ts`
is the named regression — it compiles case-14 fresh and pins that the red brick
survives the whole-facade accent, records case-08's measured colour against the
render base in `review-data/case-wall-colour.json`, and pins the two extraction
facts. `scripts/review/wall-colour-overpaint.test.ts` pins the trim-coverage
rule and `src/canalRecall/facade/wallColourSample.test.ts` pins the sampler. The
stored review render is not regenerated, so it still shows the overpaint; the
next step is a versioned `build-facade-preview` regeneration.

## 2026-09-21 — Reviewed roof verticals measured; the roof lane's three defects pinned

The 25-case review's roof groups ("missing roof" case-19/27, "roof shape too
high/asymmetric" case-01/05) were rendered and measured against the four
reviewed owners instead of guessed at. There is no single roof defect:

- **`selectCompatibleSourceRoof` mixes datums.** It publishes roof heights as
  `up - groundNAP`, but `up` is the owner's scene-local axis (`NAP − 0.65 m`, the
  same convention `wallVerticalExtent` and `wallTopNAP` document), while
  `groundNAP` is NAP. Every published study-roof eave and ridge is therefore one
  0.65 m datum low. The module's own fixture feeds `up` as NAP, so its test never
  saw the mix-up. Correcting it flips the selected component set on 674 of the
  7,395 released buildings, which the immutable `check-city-appearance-roofs`
  count assertion would reject, so the study-roof tiles must be regenerated as a
  versioned release.
- **`case-01` Rozengracht 158** draws a flat cap because its 3DBAG roof surface
  is near-flat (0.14 m relief, below the 0.25 m gate). The source gable is simply
  not in the source geometry; the lane cannot invent it, only a source-bound
  silhouette correction can add it.
- **`case-05` Lauriergracht 67/69** carries a source vertex 2.38 m above its own
  BAG ridge — the "roof too high into the sky" spike — which sits inside the 3 m
  overshoot gate. The live game builds roofs from the raw 3DBAG surfaces, so this
  function is not the renderer that produces the spike.

`scripts/review/check-reviewed-roof-vertical.ts` is the named regression: it
pins the datum offset, the selected-eave offset, `case-01`'s near-flat relief,
`case-05`'s 2.38 m overshoot and the case-19/27 published eaves. The roof lane is
parked in `.cache/reconstruction-loop-20260921/parked.json` with the unblock
plan (versioned study-roof regeneration for the datum; source-bound outline
corrections for case-01; the raw-surface path for case-05). No published data
changed in this pass.

## 2026-09-21 — Ground-floor retail band fixed; reviewed storefronts assemble

The 25-case review's missing-door group (05/09/21) and missing-storefront group
(02/11/29) were traced to the ground-floor retail lane. Feeding the real
extracted ground features through `assembleStorefront` showed a systematic
defect: the ground band tested the feature **centre** against 60% of the derived
image height, but a real ground crop frames a tall door or shop window so its
centre sits near 42% of the crop. The centre test dropped those openings and the
whole storefront returned `null`, taking the entrance and display glazing with
it.

`storefrontAssembly.ts` now admits a feature when its vertical extent **reaches**
the band (`bounds[3] >= bandTop`) instead of when its centre does, and a `fascia`
or `awning` is never band-filtered because it is a shopfront component by kind.
An upper-floor opening wholly above the band is still excluded, so it can never
become the ground entrance. On the real reviewed crops this recovers storefront
assemblies for case-02 (BAGELS & BEANS display + door + fascia), case-05, case-11
(Sunny Bites display + sign) and case-29 (DORUS, unchanged high confidence).

Two residuals are named, not hidden: case-21's Fietsenmaker display windows are
portrait, so the lane's landscape-display rule still returns `null` (its doors
are rendered by the general observed-door path); and case-09 has no ground
proposal at all because its BAG frontage crosses a corner and `surfaceMatches`
rejects every 3DBAG wall surface — the release render is a blank monolith. The
lane is not yet wired into the renderer, so this is a measured extraction fix, not
a visual-fidelity claim.

`scripts/review/check-retail-ground-assembly.ts` is the named regression: it
pins the four recovered storefronts, the case-21 portrait residual and the
case-09 unbound-frontage blocker. `storefrontAssembly.test.ts` gained the tall-
ground-opening case so the band rule itself is guarded.

## 2026-09-21 — Inferred-floor fix refuted; contextual floor rhythm pinned

The 25-case review's "missing inferred floors" group (cases 12/13/16/17) was
triaged and the proposed contextual-rhythm round-up was **refuted with
measurement**. The four cases compile `observed-window`/`observed-door` patches
from their source crops, so the contextual prior is not their renderer; and on
the contextual path `Math.ceil(height/floorHeight)` adds a row that fits **0 of
20** reviewed 3DBAG wall surfaces because those walls are trapezoidal. A blind
round-up would also invent a sixth storey on the five-storey `case-13`. The item
is parked with the evidence and the real unblocking option (reconcile the grid
with observed rows via `FacadeDescription`, or fix wall geometry) in
`.cache/reconstruction-loop-20260921/parked.json`.

`scripts/check-contextual-floors.ts` is the new named regression for the
contextual rhythm: it pins the floor rule on synthetic rectangular walls, the
rendered floor sets on the four reviewed buildings, and the 0/20 round-up fact.
This keeps the "recognisability over arcade" contract honest — an inferred prior
must not silently drop a storey, and a future floor-count change is now caught.

## 2026-09-20 — Pano anchor tool, measured boresight, and the `correspondence-verified` decision

The registration gate has been missing measured world↔pixel correspondences:
`prepareRegistration` fits nothing and trusts caller-supplied alignment flags, no
crop producer writes `registrationUncertaintyM`, and all 24 real registrations
abstain. The new anchor tool records those correspondences from a human, and the
first twelve already measured the camera model.

- `public/canal-drive/pano-anchor.html` + `src/canalRecall/facade/panoAnchorBrowser.ts`:
  shows predicted world→pixel markers for the two ends of the photographed
  street-facing wall (the canonical BAG elevation the crop was made from), at
  mid-wall height, on the raw equirectangular panorama. Press Enter to accept,
  drag or arrow-key to correct, S to skip; a top-down mini-map shows the wall and
  which end is wanted. Residual is shown live and saved per marker. Repeated
  party-wall corners are deduplicated in the task.
- `scripts/review/build-pano-anchor-task.ts` builds the task for three panos across
  missions (one reserved `holdout`); `check-pano-anchor-task.ts` guards predictions;
  `pano-anchor-router.ts` serves task, raw panorama bytes and saved anchors
  (atomically, to `src/canalRecall/facade/fixtures/panorama-anchors.json`).
- **Measurement.** Twelve anchors across three 2023/2024 captures: the published
  heading is ~180° (irrelevant), so the world-aligned model is correct in
  principle, but each capture has a small boresight yaw. Raw anchor residual was
  29 px median (p95 130 px); fitting a per-pano yaw/pitch correction
  (`solve-pano-boresight.ts`) drops it to ~8 px median on the fit panos and ~23 px
  on the holdout — roughly 0.03–0.10 m at those standoffs. The correction is
  persisted in `src/canalRecall/facade/panoCamera.ts` and applied by
  `worldToEquirectangularPixel`; `check-pano-anchor-fit.ts` guards the sign. A
  panorama without anchors keeps the uncorrected model, so scaling to the city
  needs the automatic per-pano estimate (edge alignment), not this table.
- Decision recorded: `correspondence-verified` becomes a distinct registration
  status carrying a required residual metric (median + p95). Street-level delivery
  may publish on identity + wall + independent-anchor residual + structure metrics;
  `registered` keeps its 0.15 m meaning for measured detail; identity and wall
  selection remain hard gates at every level. This is not a bypass: it is a
  separately-named, separately-measured gate, which is why the workbench no longer
  needs to live outside the release system.
- Parallel lanes landed the same day: `src/canalRecall/facade/blockFaces.ts`
  (street-side assignment, collinear+touching chaining, corner ids, crossing
  splits; `test:blockfaces`) and `src/canalRecall/facade/registrationStatus.ts`
  (`registered` / `correspondence-verified` / `preview` / `abstained`, thresholds,
  `canPublish(level, status)`; `test:facade-registration-status`).
- **W2 auto-boresight: built, constrained, still prior-limited.** `edgeSupport.ts`
  (orientation-split Sobel + banded segment support) and `wallEdgeAlign.ts`
  (coarse-to-fine yaw/pitch search where both corners of a wall must align) score
  projected wall corners against vertical image edges; the synthetic fixture
  recovers a known boresight. On real panoramas the raw edge objective prefers
  spurious vertical edges, so two fixes were added: use the real **eave** from the
  matched 3DBAG wall surface (`wallTop.ts`, not the BAG ridge `height`), and
  constrain the search to ±2° around a **GPS track-bearing prior**
  (`panoTrackPrior.ts`, from consecutive pano positions). That brought the
  estimate to within ~0.2–1.2° of the measured boresight for two of three panos
  (Rozengracht 2.56° vs 1.4°; Da Costakade 2024 0.79° vs 0.55°). The third
  (holdout, 2 anchors on one wall) stays ~8° off because its 5 m-baseline prior
  disagrees with the weak anchor fit. At ~16 m standoff 1° is ~0.28 m, so this is
  a good starting point, not yet a replacement for the anchors. Nothing in W2 is
  wired into a gate. Next: a longer-baseline track fit (±3 neighbours) to cut GPS
  noise, and more anchors per pano for a trustworthy holdout.
- **Ground-floor retail lane opened.** `storefrontAssembly.ts` groups extracted
  features into display window(s) + entrance + fascia + awning, keeps awning state
  distinct from installation, and never invents sign text; TODO item 10.4 makes
  retail an explicit lane rather than a footnote to residential openings.
- **`correspondence-verified` is now wired into the real gate**, not just a
  module. `prepareRegistration` (`scripts/city-appearance/fidelity/registration.ts`)
  falls back to the street-level status when metric flags are missing but
  identity + wall are verified and the independent-anchor residual is bounded
  (median ≤ 0.25 m, p95 ≤ 0.50 m, ≥ 3 anchors). The paid extraction contract
  (`extraction-contract.mjs`) now accepts and validates it for non-analysis runs,
  and `boundFacadeSource` (`facadeDescription.ts`) renders it with the residual as
  the fitting tolerance. `registered` keeps its 0.15 m meaning; identity and wall
  stay hard gates. `registration.test.ts` covers the promotion, the threshold
  boundaries and that a metric-registered source still takes precedence.
- More pure modules for the pipeline: `facadeFeatureScore.ts` (IoU one-to-one
  matching, contour distance, colour confusion — the auto scorer),
  `silhouetteCompiler.ts` (source-pixel gable contour → bounded low-poly metric
  silhouette), and `correctionsRegistry.ts` (typed, validated consolidation of the
  per-case correction files). `test:facade-calibration` runs all ten lane tests.
- W2 longer-baseline note: a ±3-neighbour PCA track fit made things worse
  (road curvature), so window 1 stays. The estimator is prior-limited, not
  edge-limited.
- **Loop closed from anchors to registration.** `anchorRegistration.ts` converts
  the saved anchors into street-level evidence: the corrected residual in metres
  at each wall's standoff, qualifying when a panorama has ≥3 anchors and median
  ≤ 0.25 m / p95 ≤ 0.50 m. `report:anchor-registrations` shows two of the three
  marked panoramas qualify (0.033 m and 0.10 m median; the 2-anchor holdout
  correctly does not). The paid fidelity gate (`evaluation.ts`) now counts a
  `correspondence-verified` prediction, so those sources are no longer dropped as
  abstentions. Residual is fitted on the same anchors, so it is optimistic until a
  calibration/validation split exists.
- **Scaled the anchor tool.** `build-pano-anchor-task.ts --auto=N` auto-selects
  high-quality multi-wall panoramas across missions; `pano-anchor-task-expanded.json`
  holds 12 panos / 56 markers and is served at
  `pano-anchor.html?task=expanded` (the router validates task names and rejects
  traversal). The original three-pano task and its saved anchors are untouched.
- `silhouetteCompiler` is adopted as an opt-in (`silhouetteSimplification`) in
  `source-to-owner-candidate.ts`; existing cases are byte-identical because it
  never runs unless a caller asks.
- **Anchor evidence is now cross-validated and wired into the fidelity path.**
  `boresightFit.ts` fits yaw/pitch from anchors and, with a deterministic
  calibration/validation split, reports a held-out residual that is not fitted on
  itself. `anchorRegistration.ts` now qualifies on that held-out number: the two
  good panoramas sit at **0.073 m and 0.085 m** (down from the optimistic 0.033 m
  and 0.10 m) and still pass 0.25 m. `prepare-registrations.ts` attaches the
  correspondence evidence for a wall whose panorama cross-validates and whose
  building was anchored, so the real fidelity path can reach
  `correspondence-verified` instead of abstaining. It is latent today because the
  active development manifest's panoramas do not overlap the anchored ones.
- `retailPatches.ts` composes `storefrontAssembly` + `retailCompiler` into one
  call from extracted features to renderable retail patches (opt-in, no invented
  geometry or sign text).
- **Crop usability measured (and the first metric was wrong).** `cropPreflight.ts`
  classifies each crop blank/flat, featureless or mostly-sky. The first version
  measured sky only in the top 20% of rows and reported 612/2,344 mostly sky
  (26%); that was an artifact — a tall building crop with a little sky above the
  roofline tripped it. The corrected metric counts sky rows across the whole
  height: **2,259 usable, 85 unusable, 71 mostly sky (3%)**, 14 featureless, 3
  blank. So the ridge-vs-eave crop top is a small lever, not the quarter-corpus
  one the bad metric suggested.

## 2026-09-13 — Roof-focused review and keyboard workflow



The reconstruction workbench now opens directly on its current comparison and
review editor; project statistics are collapsed below. Roof focus pairs a zoomed
upper source view with the candidate's upper roof/gable area, while Full façade
and Ground preserve access to the existing repairs. Five previously reviewed
outlines, including dormer and stepped-gable corrections, remain identified;
missing identity, missing 3D roof surfaces and occlusion remain explicit.

The editor receives focus on load and after navigation. Tab → Enter or
Ctrl/Cmd+Enter saves and advances; Ctrl/Cmd+S saves in place. Save failures keep
the current case and draft, and normal textarea editing remains available.
Roof note starters append to existing notes. The roof-priority queue preserves
case identity. The review still uses the existing candidate-bound notes store.

Sol supplied roof evidence summaries, Luna added explicit current-note flushing,
and Terra added the roof camera; root integrated the layout, keyboard flow,
source zoom and regression checks. Desktop/laptop/phone browser checks verify
that the editor and Save & next action are above the fold, roof focus uses full
evidence, and case 27 still renders its ground-floor door. Original candidate
geometry, active release and spend were unchanged. The next roof correction
pass is recorded in [ROOF_REVIEW_HANDOFF.md](../../scripts/review/ROOF_REVIEW_HANDOFF.md).


## 2026-09-13 — Show the current repairs in the reconstruction workbench

Case 27 appeared to lose its doors and finish work because the first workbench
foregrounded an old active-release screenshot. The preview data and door,
entrance, compiler and shape-generation code were unchanged from the source
baseline; the current ground study still contained a door, five windows,
awning and material details. This was a presentation regression.

The main comparison now embeds the existing current-candidate renderer, bound
to the exact preview hash and synchronized to the selected case. Historical
release captures are collapsed under an explicit before-repairs label. Embedded
mode keeps the existing render controls and uses the parent notes workflow.
New case-27 checks verify actual door meshes, candidate identity, case switching
and historical-image separation on desktop and phone; the standalone viewer's
notes remain available. No candidate geometry or release data was regenerated.


## 2026-09-13 — First reconstruction implementation wave

Sol, Luna and Terra worked in separate worktrees; root integrated their source
measurement, review-state and facade-policy work into a [reconstruction
workbench](reconstruction-workbench.html). [The execution handoff](../../RECONSTRUCTION_HANDOFF.md)
records commands, lane ownership, exact artifacts and the next correction task.

The workbench exposes current coverage/costs, 28 source-photo comparisons,
dated evidence and the existing candidate-bound review service. Transient save
failures are retryable, concurrent revisions preserve drafts, and Ready waits
for saved notes. Desktop and phone browser checks use isolated note stores.

The new offline review command stages verified immutable reports and saved
review snapshots, with no paid inference, repair execution or activation.
An identical real rerun reused its report; eight archived artifacts restored
successfully into an empty directory. Two older preview-note bindings remain
explicitly missing. Router labels retain their matching dataset manifest.
The global accounted cost remains $5.384791, including the settled conservative
$0.015 charge; the recorded ceiling is $11.806544. Batch charges are not added
a second time.

Source diagnostics find 23/27 complete reference openings at IoU 0.7 across
12 agent-inspected development photographs; 13 partial extents are excluded.
Overall precision, held-out performance and metric acceptance remain unknown.
The source-tier test mismatch is resolved with explicit ground-only, missing,
failed, ambiguous, stale, revoked, overlapping and gap-interval tests; no
compiler behavior was changed for that correction. Fidelity and repair checks
now pass. Moeders game tile residency and full-device profiling remain open.


## 2026-09-13 — Reconstruction project audit and delivery guide

Added [CITY_RECONSTRUCTION_REVIEW.md](../../CITY_RECONSTRUCTION_REVIEW.md) as
the current high-level guide to the implemented pipeline, active/staged assets,
costs, review tools, local vision opportunities and next milestones. The existing
rebuild plan remains the detailed technical design. This was a documentation
and evidence audit; runtime code and release activation were not changed.

The audit confirmed active release `c4bebc1f…`, the staged thousand-building
candidate `0f625ffc…`, zero accepted metric registrations for that candidate,
and a $3.578247 accounted large-preview batch cost within $5.384791 globally
accounted spend. Those values include one $0.015 conservatively accounted
unknown provider charge. Older $5-ceiling and zero-analysis reports describe
earlier runs; the live ledger records the later preview authorization.

Fresh TypeScript, district-coordinator, city-pipeline and thousand-building
checks passed. `test:facade-fidelity` failed its no-window-prior assertion;
a direct probe found the priors on unobserved upper floors above the registered
ground door. This requires an explicit tier-policy/test reconciliation, not
an unsupported claim that observed ground features were overwritten. Saved
source/render examples and runtime counters also identify silhouette/balcony
loss, incomplete game sign residency and incomplete total-memory measurement.

The proposed next milestone is one representative route with durable structured
corrections, independent extraction/placement evaluation and a bounded repair
loop. The earlier TODO item is retained below as historical context; it should
not be used as current release status or a new spending instruction.

<details>
<summary>Previous reconstruction TODO snapshot, superseded by this audit</summary>

**10. Build a low-poly Amsterdam that players recognise by real landmarks.**
The single forward plan is
[`AMSTERDAM_FACADE_REBUILD_PLAN.md`](../../AMSTERDAM_FACADE_REBUILD_PLAN.md).
It incorporates the former 8a/10/10b/10c building work. Keep complete city
massing and useful OSM parts; prioritise correct identity, silhouette, opening
rhythm and distinctive colour at gameplay scale.

Current state (10 Sep 2026). The 2026-09-06 photo-lab wall studies are archived in
`HISTORY.md` ("2026-09-06 photo-lab handoff and results, archived"). The live
line of work is the **Da Costa neighbourhood → 550 m expansion** city-appearance
pipeline: [`CITY_APPEARANCE_PLAN.md`](CITY_APPEARANCE_PLAN.md) (architecture and
gates), [`NEIGHBOURHOOD_POC_PLAN.md`](NEIGHBOURHOOD_POC_PLAN.md) (checkpoint),
[`EXPANSION_DEMO_2026-09-10.md`](EXPANSION_DEMO_2026-09-10.md) (what the demo
shows), [`PANORAMA_SOURCE_AUDIT_2026-09-10.md`](PANORAMA_SOURCE_AUDIT_2026-09-10.md)
(first 24-frontage evidence gate). Measured: 825 buildings streamed into the
real game as the "Da Costa study" route; 24 audited frontages; 20 Gemini 3.1
Flash-Lite routing proposals for $0.0145; cumulative paid spend $1.25 of the $5
authorization; zero human-confirmed frontages.

**Owner decision 2026-09-10 (see HISTORY.md):** machine `shopfront` and literal
`signText` are trusted as a default-on **machine-observed (unreviewed)** tier.
Awnings, roof shape, family and wall colour are not; they stay prior-only or
opt-in. Coverage, not calibration, is the constraint: 24 records for 825
buildings is why the demo has no visible shops.

Plan in flight (lanes; leaf agents return results, the integrating agent owns
publication, docs and commits):

1. **Publisher wall binding (blocking).** The published expansion release
   `9e40bcce…` has `renderSurfaceIndices: []` on all 24 records because
   `publish-area-geometry-demo.ts` compares evidence-frame `localStart/localEnd`
   (tranche-400m origin 4.873, 52.3722) against block-frame walls (550m origin
   4.87355, 52.3723) — ~37 m apart, 0.8 m tolerance. So the machine colour
   preview, coverage mode and the four machine storefronts render nothing.
   Fix: translate into the block frame before `surfaceMatches`, assert bound
   walls in `check-city-expansion-publication.mjs` and paint in
   `check-city-expansion-demo.mjs`, republish.
2. **Coverage on the guided route first.** Coverage selection mode (all
   candidate frontages on Hugo de Grootkade, Frederik Hendrikstraat,
   Bilderdijkstraat, Da Costakade, De Clercqstraat, Rozengracht ≈ 296 of 968),
   automated preflight disposition instead of per-image agent review, `signText`
   + `signTextEligible` added to the routing schema, limits raised. Paid step is
   owner-run with an explicit cap (~$0.25 forecast). Phase 2: remaining ~670
   frontages, ~$0.50.
3. **Viewer tier.** "Machine-observed (unreviewed)" copy, neutral sign bands
   from `machineRoutingProposal.signText` on machine-storefront walls, badge,
   toggle, telemetry. Ported from `da-costa-block/machine-signs.js`.
4. **Republish with coverage** (24-audit + route coverage together), then the
   same sidecar/roof/facade artifacts for the game.
5. **Spot check instead of calibration queue.** Random 30 machine positives and
   negatives, thumbs up/down into the human ledger, ten minutes; gives a real
   false-positive rate on this area before the route ships in the game.

Still gated on the owner or hardware: physical desktop/phone profiling;
photo-redistribution rights decision; the 100-block scale-up.

</details>


## 2026-09-10 — Owner decision: machine-observed tier; coverage before calibration

The owner reviewed the Da Costa calibration queue and the expansion demo and
decided the machine labels are good enough to build on for two fields. Basis
(`ROUTER_BENCHMARK_RESULTS.md`, 19 facades / 76 human decisions, same Gemini 3.1
Flash-Lite model used for routing): shopfront 15/18 with all 5 positives found
and 3/13 residential false positives; the independent blind review
(`BLIND_STOREFRONT_REVIEW_EXPERIMENT.md`) found 6/6 positives visually
supported and no false positive in its sample; literal sign text differed from
the baseline once, by a separator. Awning agreement was 18/18 on only two
positives and flipped 8/10 once installed-vs-deployed was asked; family 1/5 on
apartment rows; visibility missed both "mostly blocked"; wall colour never
human-checked.

Decision: `shopfront` and `signText` become a default-on **machine-observed
(unreviewed)** tier with provenance and a per-record revoke path. Awnings never
render from machine labels; roof, family and colour remain prior-only or
opt-in. The twelve-case calibration queue is replaced by a ten-minute random
spot check of machine positives and negatives once coverage exists. The reason
is that 24 evidence records for 825 buildings, not label quality, is why the
demo has no shops; coverage is the constraint.

Found the same evening: the published expansion release `9e40bcce…` binds no
observation to any wall (`renderSurfaceIndices: []` on all 24 records) because
the publisher compared tranche-400m-frame coordinates against 550m-frame walls.
The doc line "twenty routed source walls can override that prior" was untrue
for that release; the publication and browser checks counted records and
toggled checkboxes without asserting a painted wall. Fix and assertions are
tracked under TODO item 10.

## 2026-09-06 photo-lab handoff and results, archived 2026-09-10

Moved verbatim from TODO item 10 on 2026-09-10 so the board shows only the live
city-appearance line. The Sol 5.6 day plan below was executed (see "Day-two
execution result"); its follow-ups (roof/cornice/window-style extraction,
registration, held-out evaluation) are subsumed by the city-appearance gates
rather than pursued as isolated wall studies.

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

## 2026-09-06 — DINO → bounded fitting → appearance → rendered mesh

The photo lab now defaults to the integrated DINO/SAM run. It renders nine
development façades through the existing recipe compiler, retaining raw boxes,
fitting attempts, individual colour/bar evidence and explicit unknown fields.
Row widths, heads/sills and column centres are softly fitted within five pixels;
unsupported edge changes are declined and distinct floor heights are preserved.
Across nine strips, 40/86 attempted adjustments apply; 104 proposals render and
35 remain for review. These are isolated wall studies, not certified map assets.

Keizersgracht 136's omitted bottom-right window had score 0.241 under a 0.25
cutoff. A secondary row/column/mask/edge check recovers it without changing its
score or inventing a grid cell. The door's nested proposal remains omitted.
The expanded set exposes a confident door-like construction-hoarding patch:
isolation plus semantic disagreement flags it for review and removes it from
the mesh. Appearance is resampled after fitting; editing a fitted box revokes
its colour/bar measurements. Original extracted ontology fields show stale
bindings after edits and never inherit renderer defaults for unknown parts.

On labelled new cases Tiny finds 12/13 frames; fitting preserves that count.
Three cropped retries still miss Herenstraat 40's dormer. A pinned DINO Base
comparison finds it at low score (13/13), while slightly worsening Koningsplein
box overlap. Both comparisons and their source images are inspectable locally;
the model choice remains failure-specific rather than a general accuracy claim.

Validation: five model-free Python regressions, focused façade aggregate and
TypeScript lint pass. All fourteen desktop/mobile photo, appearance, fitting and
recipe browser cases pass across the initial run and targeted rerun after fixing
legacy appearance-fit metadata handling. Full `check:canal`, production build
and gameplay hardware performance were not rerun for this photo-only slice.

## 2026-09-06 — Local DINO and SAM measured on development strips

Pinned Grounding DINO Tiny and SAM 2.1 Tiny run offline on the M4 Pro GPU.
Three strips take about 0.29 s each for DINO and 0.135 s each for batched SAM
after warm-up. The comparison page preserves raw detector outputs, raw masks,
largest-component derivatives and reference-box segmentation separately.
At a development-tuned 0.25 threshold, DINO matches 16/16 labelled outer frames
versus 9/16 for the existing baseline; raw SAM+DINO matches 13/16 and component
cleanup recovers 16/16. These rectangle checks neither measure pixel-mask
accuracy nor score every unlabelled proposal. Reference-box SAM still exposes
a connected leak, showing why model confidence cannot accept a mask alone.

Completed local inference and a browser inspection of all three comparison rows
passed; source crops remain ignored and no paid inference service is required.
This is a proposal benchmark, not yet a replacement for rendered photo recipes.

## 2026-09-06 — Appearance evidence and per-window rendering

The photo lab now exposes wall-colour patches, texture-repeat candidates,
per-window frame/glass colours and image-supported bright/dark glazing-bar
candidates. Opening refinement separates the named merged-storey case and
isolates the repeated-opening region from foreground sampling. The mesh uses
merged vertex colours and per-opening bar geometry; photo/render comparisons
share scale. Pixel box edits revoke previous appearance measurements. Patch
selection, bar rejection and explicit style annotations remain unaccepted
development edits with source/version lineage.

The small labelled development check improves two window matches from 0/2 to
2/2 and excludes the headlight proposal. It also exposes a false glazing-bar
candidate; this is not a broad accuracy result. The user's comparison identified
the next missing stage: constrained fitting of repeated window dimensions and
floor/bay alignment before further style extraction. Focused checks, lint and
ten desktop/mobile photo/appearance/renderer browser tests passed.

## 2026-09-06 — Inspectable photo → opening proposals → mesh

`facade-photo-lab.html` displays three real rectified development strips beside
meshes compiled from local semantic masks and opening boxes. Pixel edits,
omissions and a visible-region crop update the same recipe; raw detections are
retained. Image/mask hashes are checked before rendering, imports bind to the
source and extraction version, and rejected observations clear the preview.
A pinned Keizersgracht 136 example splits a detection spanning two storeys,
removes a car-headlight false positive and excludes the foreground. This is
development correction, not an accuracy benchmark or accepted registration.

The offline Python runner uses cached `amsterdam-facade/2` ONNX weights with
pinned preprocessing, emits raw masks, box support and masked camera RGB, and
refuses known missing-height/uniform strips. Images stay in an ignored local
directory. Photo studies have no BAG replacement aliases or map placement.
The separate recipe workshop supports procedural brick, CC0 ambientCG Bricks057,
sash/cross windows and cornice/gable trim as explicitly authored choices.

Validation: focused façade aggregate, TypeScript lint, and eight desktop/mobile
photo/recipe browser checks passed. Source mutation, stale imports, invalid
edits, exact fallback restoration and context loss are covered. Saved raw,
mask and corrected renders include source/extraction/mesh lineage. No full-city
performance or extraction-generalisation result is claimed.

## 2026-09-05 — One plan for a low-poly Amsterdam gameplay map

Replaced competing building/LOD/enrichment/façade plans with the root
[`AMSTERDAM_FACADE_REBUILD_PLAN.md`](../../AMSTERDAM_FACADE_REBUILD_PLAN.md).
The target is recognisable, correctly placed low-poly buildings. The next
visible milestone is 3–5 complete buildings, followed by a contiguous block
and landmark route. Independent image/geometry evidence, diagnostic rendering,
bounded stage-specific retries, held-out evaluation and explicit fallback form
the correction loop. Large surveys and photorealism no longer precede rendering.

The audit retained BAG identities, stable elevations, raw-cache quarantine,
OSM compositions, existing renderer/signature assets and calibration utilities.
It found gaps hidden by passing scaffolding checks: no exported reviewed/anchored
registration fixtures, coarse OSM joins, implicit yaw, roof median labelled as
eaves, rectangle width labelled as frontage, stale review acceptance, and
unfinished external-photo evidence/license matching. These are planned fixes;
this change edits documentation, not runtime behaviour. All five pre-existing
untracked external-identity files were preserved.

Validation: lint and 14 focused suites passed. Direct probes reproduced stale
acceptance, duplicate-photo evidence and overbroad license matching. Local browser
inspection confirmed the single ready review task; the comparison page remained
at zero resident tiles after 18 seconds under standalone Vite, so it did not
establish a complete-city rendering baseline. Full integration/build/performance
checks were not repeated for this documentation change.

Removed superseded documents: `AMSTERDAM_FACADE_TWIN.md`,
`BUILDING_RENDERER_DESIGN.md`, `BUILDING_ENRICHMENT.md`,
`BUILDING_COLOUR_COVERAGE.md`, `FACADE_ENRICHMENT_DESIGN.md`,
`FACADE_REBUILD_CHECKPOINT.md`, `FACADE_RECON.md`, `ROOF_ENRICHMENT.md`,
`RGB_CITY_DEMO.md`, `LOD.md` and stale session notes `WIP.md`.
Commands for retained tools moved to `EXTRACT_PIPELINE.md`; TODO items
8a/10/10b/10c became one current item. Historical entries and source comments
below still describe their own time; deleted documents are available with
`rtk git show 683d06b:public/canal-drive/<filename>`.

Finished work, newest first. The work board is `TODO.md`; nothing unfinished
belongs here.

Entries keep the words they were written in, because each records *why* a thing
is the way it is, and that is the expensive part to recover later.

## Map Quest joins the daylight palette — 2026-09-26

TODO #28. Canal Recall left the all-cobalt chrome earlier the same day; Map
Quest still ran it, so the product read as two families. Map Quest is now warm
paper and ink with copper for action and selection. Enamel stays for the Map
Recall title plaque and the street plaques the map draws for revealed answers.

Its components were written dark-on-blue in about 400 Tailwind colour
utilities. Tailwind v4 resolves each through a `--color-*` variable, so
`src/index.css` remaps the palette on `#root`: `text-white` becomes ink,
`text-white/60` ink at 60%, `bg-white/10` a faint ink fill, and the slate ramp
runs paper to ink. Enamel plaques and Leaflet markers get the stock values
back. The remap was chosen over rewriting each class, which would have been a
400-line diff for the same result, and new work should use the named classes
and `--day-*`. Hard-coded rivet gold (`#c4a35a`, about 2.3:1 on paper) became
copper ink, and the cobalt scrims became the warm day scrim.

The shared semantic tokens now publish as daylight values from `hudTheme.ts`,
and the cobalt-era aliases (`--paper`, `--moss`, `--terracotta`, `--ochre`,
`--primary`) are retired. Two smaller fixes shipped with it:

- The locate button's `z-[900]` leaked out of the map and drew over the
  options modal on phones. The map viewport is now `isolate`.
- The canvas map-select state filled black between two paper screens. It now
  fills with paper.

## The UI review's leftovers, closed — 2026-09-26

TODO #30, the smaller findings from the UI review:

- **Landmark names.** "foam", "waterdraagster" and Rotterdam's "weggeefwinkel"
  were lowercase, and "Dam Square Victims 7 mei 1945" and "Rembrandt van Rijn
  statue" were half-translated. `landmarkNames.ts` repairs the form, not the
  language: a lowercase first letter gets a capital (a stylised ".zip" and an
  owner's own "de Gooyer" stay), and a name with both English and Dutch marker
  words takes its Dutch Wikipedia title, because the Dutch name is what the
  street says. `scripts/normalise-landmark-names.ts --write` applied it to the
  published extracts: the name, the facts entry and every distractor that
  quoted the old one. The old name stays as `osmName`. `test:landmark-data`
  fails if any extract needs the pass again. Someone who had "foam" in their
  knowledge will see "Foam" as a new name.
- **Phone city field.** It is now one 44px row, and the select covers all of
  it, so a tap anywhere on the field opens the picker. It takes no more height
  than before.
- **Knowledge mid-ride.** Ride settings has a "Your knowledge" button. The
  review's back button says "Back to ride". While the review is up it owns the
  keyboard (`input.js`), so its Escape does not also close the settings under
  it, and focus returns to the button that opened it.
- **Landscape quiz card.** On a landscape phone the card docks to the side
  away from the vehicle, as on desktop, instead of a bottom sheet over half the
  screen.
- **`game.js` cap.** Already fixed on `main` (673 lines). The structure check's
  remaining failure was a stale `route-selection.bundle.js` that differed only
  in minified names; it is rebuilt.

All pinned in `mobile-overlays.spec.ts` and `test:landmark-data`.

## A destination no longer names the canal you are on — 2026-09-26

TODO #29, from the UI review: boat routes could head for *Keizersgrachtkerk*
along the Keizersgracht, so the destination card said the canal before the quiz
asked it. `poiNameSpoils` could not catch it, because it matches whole words and
Dutch compounds the street onto the landmark. `maskSpoiledName`
(`orientationPois.ts`) matches a quiz name wherever a word *starts* with it and
swaps the span for an ellipsis ("…kerk"), so the card still says what you are
riding to. It uses this ride's track names. The ride HUD and the start briefing
use the masked label via `_destinationLabel()`; the arrival card shows the real
name. We masked instead of re-rolling the destination because the route, and so
its names, only exist after the destination is picked. Pinned in
`test:orientation-pois`.

## Ride settings share route setup's tiles — 2026-09-26

The owner: "fix this settings to use buttons same as the opening screen,
ideally share the opening screen". The in-ride panel was a column of native
selects, sliders in boxes and bare checkboxes, while setup used paper tiles, so
the same preference looked like two different controls. Both now render one
`RideOptions` component in `OverlayApp.tsx`: choice tiles for view, controls
(Steer / Point), answers (Choose / Type), bicycle and map style, and on/off
`ToggleTile`s (a real checkbox inside the tile, so ids and Space still work)
grouped as "On the map" and "Comfort & detail". `live` prefixes ids and
`data-choice` names so both copies coexist. Answer mode moved into it, so it is
now settable mid-ride (`_readLiveSettings` already applied it). The panel reuses
the setup rail's scroll fade and "More" cue. Pinned in `mobile-overlays.spec.ts`
("ride settings use the same tile buttons as route setup").

## Help that explains the game; copy that says what it means — 2026-09-26

From the 2026-09-26 UI review. "?" opened a keyboard table, even on phones,
and nothing explained the thumbstick, spaced review or "% new". Help is now
"How to play": Ride (touch readers get the stick, pointer readers the keys),
Name it, Remember it; the keyboard table shows only on fine pointers. The ⚙/?
buttons were Unicode glyphs with no accessible names; they are drawn SVG with
labels, and they stay hidden while a route loads.

Plain language: "fog map" → "keep your progress on every device", "Space
reviews" → "Due names only", "Game-y features" → "Scores & streaks" (the name
setup already used). View names match between setup and settings ("North up",
"Heading up", "Chase", "Cockpit"), and the current view sits beside its row
label instead of stranded at the rail's edge. A mission line no longer tells
you to "make Dam Square Victims 7 mei 1945 feel like home". The first question
of a ride no longer claims "You made a turn" when none happened (the start
street itself is given on purpose and never asked).

The overview minimap stroked every segment separately, so translucent ink
stacked wherever segments met; in bike mode that is everywhere and it read as
solid black. Each layer is now one path, stroked once (`strokeLayer`).

## Keyboard and small-screen access — 2026-09-26

From the 2026-09-26 UI review. `input.js` called `preventDefault` on Tab for
every non-field target, so keyboard focus stuck on the first control of setup
and the knowledge screen. Tab is now the browser's whenever an HTML surface is
up or focus sits on a control; it still toggles the minimap while driving.
The knowledge review takes focus, leaves on Escape, returns focus to the
Knowledge button, and makes the covered setup `inert` (it had stayed in the
tab order and accessibility tree behind the full-screen view).

No UI text under 11 px (settings labels, quiz kind chip, legend, card badges,
tab counts; the map credit is 10 px). Canvas card measurement used bare
`monospace` while drawing system-ui/Barlow, so wraps and badge widths were
computed for the wrong face; `noticeCards.ts` now measures in the drawn fonts.
Hit areas reach 44 px without growing the tight phone setup (pseudo-element
insets on account buttons and compact tiles; More options and settings selects
get real 44 px). Keycap digit badges hide on coarse pointers. Reset knowledge
and Clear all data are fenced under "Your saved data" in danger ink.

## The last arcade surfaces go to paper; speed leaves the HUD — 2026-09-26

From the 2026-09-26 UI review. The pause card was still the old skin — 78%
black, yellow bold Courier "PAUSED", ink captions invisible on it, miles and
an unlabelled percentage. It is now the arrival card's paper plate with
kilometres and "n of m named". Canvas numerals asked for bare `monospace` (or
`ui-monospace`, which canvas ignores) and drew in Courier; JetBrains Mono is
loaded, preloaded for canvas, and every canvas mono string goes through
`hudSurface.fontMono`, at no less than 11 px. Copper stamps were 2.8:1 at the
gradient's bottom stop; every stop is now ≥ 4.8:1 with ink. The disabled
"Nothing due now" is a quiet outline instead of a greyed plaque.

Speed is gone from the HUD (owner: hide speed, keep points). The toy physics
put a canal boat at 200+ km/h and a bike at 62 — a false number in a game
whose promise is true geography. Distance stays. "Copy race link" is "Share
this route"; the arrival actions say what they do ("Next route" / "Route
setup", not "Continue" / "Finish"); a ride with no questions no longer ends on
"0% recall"; ribbon colours are ink tones that read on paper.

The phone HUD could latch the pre-settle 980 px layout and draw at ~47% (5 px
text): `_syncViewportSize` re-lays out whenever the window stops matching the
last layout. The spoiler index also takes the route's own track names, since a
bike ride can ask any street, not only the curated knowledge subset.

## A miss is the lesson, and labels cannot say the answer — 2026-09-26

From the 2026-09-26 UI review. A wrong answer was one line of amber
(#fbbf24, ~1.7:1 on the new paper card) printed *below* the choices — under
the card's scroll fold in landscape — and the buttons never showed which was
right. Now the feedback sits directly under the question in ink tones (all
≥ 5:1: copper-ink miss, green hit, blue "no idea"), the right choice turns
green with a drawn tick, a wrong pick is struck through, the rest step back,
and the answered feature stays highlighted on the map through the hold
(`_answerReveal`) so a miss shows *where* the right canal runs.

Orientation labels could pre-teach answers: a "Nassaukade" tram stop on
Nassaukade, a "Majoor Bosshardt" label beside the Majoor Bosshardtbrug. While a
question is open every label layer was already hidden, but between questions
they were not. `orientationPois.ts` now builds a spoiler index from every
street, water, bridge (and, in transit, stop) name — plus Dutch-suffix stems —
and matches labels by word n-grams; our own POI sources drop matches in JS and
the basemap `poi` layers get an exact-name MapLibre filter. Pinned in
`test:orientation-pois` and a wrong-answer e2e.

Also found: `playwright.config.ts` reuses any server on :4173, and another
worktree's dev server was on it, so e2e silently tested that checkout. Run
with a private port when other sessions are live.

## Amsterdam façade rebuild: identity before pixels

The first clean-rebuild checkpoint implements phases 0–2 of
`AMSTERDAM_FACADE_REBUILD_PLAN.md`. The previous rectifications, measurements,
textures, review labels, correlations, and renderer extracts are explicitly
invalidated after the Herengracht 270 wrong-side panorama failure. A hard
allowlist migrated 1,444 upstream/raw files into a new ignored namespace with
per-file SHA-256, source URL, retrieval date, and licence; measured derivatives
never entered it.

BAG identity is now an explicit pand → verblijfsobject → every address join,
not an address-point or OSM guess. Footprints normalise to stable per-pand
elevations while retaining original survey vertices; candidate selection is a
separate stage and returns ambiguity instead of inventing a front. The initial
16-building gold catalog and local registration desk cover the named landmarks,
both canal banks, cardinal contrasts, multi-address cases, and the pinned
Herengracht 270 observation. That fixture reproduces 38.6 m standoff and 3.3°
obliquity without choosing an image yaw. The UI deliberately has no detector
boxes or rectification: it exposes Herengracht 270 as the one reviewable task,
keeps the 15 geometry-only candidates in a separate waiting queue, and guides
the reviewer through the photo, building outline, highlighted wall, and two
plain-language verdicts. One accepted local review completes the solo-operator
checkpoint while retaining reviewer, timestamp, and verdict provenance;
source-pixel points remain an optional advanced control and can be removed
individually, undone in reverse order, or cleared together with a guarded
two-click action.

## Daylight paper replaces the cobalt chrome — 2026-09-26

The owner called the navy/cobalt-on-blue theme "way too heavy". Every surface
you stop at was a cobalt plaque and every HUD readout a navy plate, over a map
that is mostly light land and blue water. Canal now runs on warm paper
(`daylightTheme` in `hudTheme.ts`, published as `--day-*`): near-black ink,
exactly one accent — copper, for action and selection — and cobalt enamel only
on the title plaque, where it is literal (Amsterdam street signs). Selected
setup tiles take a copper border + tint; the quiz card, settings/help panels,
knowledge review, arrival/pause cards, loading screen and canvas HUD are
paper. Contrast: ink 14.8:1, muted 6.1:1, copper text 6.0:1 on paper; ink on
the arrival button's copper-mid 5.6:1 (the darker accent was 4.0:1). Canal's
`:root` overrides the shared semantic tokens, so Map Quest keeps cobalt until
it is migrated (TODO #28). DESIGN.md records the new system.

## Phone route setup fits, and says when it scrolls — 2026-09-26

On an iPhone 13 (390×664) the setup rail's scroll box was 329px for 445px of
content, and it happened to clip exactly at the Difficulty label — the list
looked finished. The `setup-backdrop.jpg` vista spent 14–16dvh below Start.
Phones now drop the vista, the account sub-line and the choice glosses, which
fits City → Difficulty above Start on a 390×664 and a 375×667 SE. Where it
still overflows (360×640, landscape, More options open) `useScrollEdges` in
`OverlayApp.tsx` fades the clipped edge and shows a **More** cue that scrolls
on and disappears at the end. Landscape slims the title plaque and hides the
briefing line. Pinned in `tests/e2e/mobile-overlays.spec.ts`.

## Touch drives with an analog thumbstick — 2026-09-26

Reported on a phone: "impossible to turn, even in absolute mode I can't
reliably go east". Three causes, all in the d-pad path:

- **Auto-throttle made due east/west unreachable.** Touch held ArrowUp unless
  braking, and absolute mode resolved `atan2(vertical, horizontal)` — so
  "right" was right+up, i.e. north-east.
- **Absolute headings were world compass angles under a turning camera.**
  With a heading-up view, "right" on the pad was not right on screen, and
  moved every time the vehicle turned.
- **A thumb sliding off the 160px pad dropped every key**, mid-turn.

The pad's rectangle is now only the *activation zone* of an analog stick
(`touchControls.ts`: `stickVector`, `relativeCommand`, `absoluteCommand`,
`assistedHeading`, `cruiseThrottle`). The origin floats under the thumb and the
touch stays captured until it lifts. Absolute mode is screen-relative (the
pointed direction is rotated by `camera.rotation`, keyboard too), holds the
camera still (`camera.holdHeading`, else pointing right spins forever), swings
the heading at a bounded rate, and follows the street/canal tangent when the
pointed direction is within 55° of it — `getNearestRoad(x, y, target)` already
picks the cross street at junctions. Relative mode is analog steer, cruising at
62% of top speed so junction turns are makeable; forward pushes to full speed,
pulling back brakes. Measured with CDP touch drags on iPhone 13: absolute bike
east 0°/west 180°, boat follows the canal; relative turns ~55°/s at full lock.
Pinned in `test:mobile-hud`.

## The knowledge screen can forget a name entirely — 2026-09-08

**Practice again** (below) intentionally keeps mastery and only makes chunks
due; a player who wants a genuinely clean slate for one street had no control
short of **Reset knowledge…** wiping everything. Each row now also has a
quieter **Forget** button: after a `window.confirm` (the same pattern as the
global resets), `RecallStore.forgetItem` erases every place-local chunk of
that city/type/name — locally and, when signed in, the matching Firestore
`reviewStates` docs, because otherwise the next `pull()` would merge them
straight back. The review-event log is kept: those reviews happened, and a
forget should not rewrite recall-rate or activity history. Pinned by
`test:recall-forget` (in `check:canal`).

## City knowledge has a dedicated review screen — 2026-09-08

The setup account row now opens a full knowledge review view built from the
same local spaced-repetition states and events as the game. It collapses
place-local chunks into one city/type/name row, then shows due, learning, known,
and mastered status; mastery, review history, seven-day activity, city totals,
search, and status filters. Empty and populated states have desktop and phone
Storybook scenarios. **Plan review** returns to setup with “Space reviews”
enabled; choosing a location-honest route near overdue names remains a separate
routing task rather than pretending the current route already covers them.
Each non-due row also has **Practice again**, which makes all of that name's
place-local chunks due immediately without inventing a wrong answer or changing
recall-rate statistics. That session ended abruptly after the commit, so the
store half shipped untested; `test:recall-practice` (in `check:canal`) now pins
it: matching chunks go due and stop reading as known, already-due chunks,
other names, and non-name modes are untouched, no review event is invented,
and the review screen's diacritic-folded item key matches the store's.

## “No idea” no longer produces a mastery wink — 2026-09-07

The scheduler already handled “No idea” correctly as a miss and scheduled it
again in ten minutes, but the route HUD treated every temporarily suppressed
question as known. Re-entering that corridor during the ten-minute wait could
therefore say “You know …” even though the stored review state said the
opposite. Route decisions now distinguish a recent miss (`learning`) from
proved knowledge (`known`): both avoid an immediate repeat, but only proved
knowledge earns the mastery wink, learned-name set, and map treatment.

## Occluded bikes get a depth-aware cartoon silhouette — 2026-09-08

Tall foreground buildings could completely hide the bicycle in pitched chase
views. Making all buildings translucent was rejected: MapLibre cannot reliably
depth-sort overlapping transparent extrusions, and fading the whole city would
weaken its legibility. The bicycle now gets a second, gold x-ray pass using the
inverse depth test. It paints only fragments that are behind nearer map
geometry, so an occluding building shows a compact cartoon bike silhouette
while an unobstructed bicycle and every building remain fully depth-correct.

## Street mode stops at the canal edge — 2026-09-08

Street corridors were arcade-wide: a residential road allowed the bike centre
10 m from its centreline, then granted another 4 m of edge tolerance. On canal
quays that made several metres of visible water count as driveable shoulder.
Road-class half-widths now reflect the physical corridor (6 m for residential,
3 m for cycleways), and street edge tolerance is ~1.3 m. Intersections remain
the union of every meeting corridor and bridge centrelines remain driveable, so
tightening a quay does not close its junctions or crossings. A named
Keizersgracht-style rollback test pins the canal edge.

## Junction routes no longer cut through buildings — 2026-09-08

A Homomonument / Westermarkt playtest showed the bike disappearing into a
building near a junction. Camera pitch was a tempting symptom-level fix, but
the routing graph contained the underlying geometry error: when a side-street
endpoint sat near the middle of a simplified through-street span, the stitch
jumped diagonally to one of that span's distant endpoints. Junction stitches
now split the span at the actual centreline projection, so the route reaches
the intersection before turning. A named Westermarkt-style regression keeps
the connector on the two source centrelines. The 42° chase camera is unchanged.

## Active street highlights start under the rider — 2026-09-07

Road-name detection remains heading-aware at junctions, but the answer overlay
no longer reapplies that heading preference when choosing among parallel
same-name OSM spans. On a bend, the old second selection could prefer a
slightly straighter line beside the rider and make the blue answer look offset
from the visible road. Once the quiz name has settled, its overlay now starts
from the closest span carrying that exact name; the connected-run rule still
controls how its end-to-end fragments are stitched.

## Let the basemap name the shops — 2026-09-07

AH was visible because it had a bespoke icon layer; the other 1,944 extracted
food venues were text-only, aggressively thinned, and lost after the first
quiet quiz. Meanwhile OpenFreeMap Liberty already shipped ranked, icon-backed
OSM POI layers, but `_hideLabels()` hid every symbol indiscriminately. The map
now restores Liberty's `source-layer=poi` symbols as sparse orientation cues
while continuing to hide street and water names. It discovers the source layer
rather than pinning today's `poi_r*` ids. Landmark quizzes still hide those
labels, and the D toggle still controls the complete basemap label set.

## Route-end actions say Continue / Finish — 2026-09-07

The arrival card called Escape “New route,” but it actually returns to route
setup, making the end-of-trip decision feel misleading. Its two actions now
read **Continue** (Enter, replay this route or start the next home leg) and
**Finish** (Escape, leave the trip and return to setup).

## 3D camera tilt and orbit controls — 2026-09-07

The `[` / `]` camera controls stopped at ±18° and moved only 3° per press, so
their adjustment remained subtle even at the limit. Chase and cockpit views now
allow ±36° of extra pitch and move 6° per keypress. The settings slider shares
the same exported bounds, keeping keyboard, saved preferences, and live UI in
sync. Shift + `[` / `]` now orbits the camera around the vehicle in 15° steps,
and a labeled 3D spin slider makes the same control discoverable on touch
devices. The chosen angle is saved with the other camera preferences.

## Empty landmarks are no longer route destinations — 2026-09-07

The prominence-ranked landmark pool included named OSM features with no fact,
encyclopedia article, or image. That let a full trip end at places such as UvA
PC Hoofthuis with only the generic “A place to remember” filler. Extract-added
destinations now use the same content floor as landmark cards: each must have
real text, a photograph, or an article that can be fetched and opened. Curated
city anchors remain deliberate exceptions.

## Streamed buildings keep sole ownership — 2026-09-07

The LoD1 tile stream hid OpenFreeMap's duplicate `building-3d` extrusion when
its first tile landed, but detailed-building readiness and settings changes
later ran a shared visibility sync that blindly made all extrusion layers
visible again. That restored two coplanar versions of every building and the
citywide façade/roof shimmer. Complete-city ownership is now persistent state:
the basemap remains as the empty-city fallback until a real tile lands, then no
later layer sync may resurrect it. The browser regression deliberately runs
that later sync after loading tiles.

## Bridge-named bike routes ask about the bridge — 2026-09-07

Amsterdam's routing extract includes 77 named bridges as rideable ways. The
generic route quiz called every one a street, so an answer such as “Blauwbrug”
could appear under “Which street are you on?” Bike route questions now
cross-check the loaded bridge catalog, ask “Which bridge are you on?”, offer
bridge distractors, and file the answer as bridge knowledge. The Blauwbrug
overlap is the named regression.

## Active street overlay is one centreline — 2026-09-07

The active street highlight now uses one MapLibre line layer instead of a
casing/glow/line stack. The stacked strokes were visually read as multiple
parallel street lines when a named feature contained several connected OSM
segments, even though those segments had already been stitched into one
geometry. The stitched geometry remains intact; only the presentation is
reduced to one unambiguous centreline. A deterministic, offline MapLibre
Storybook workbench now exercises single, connected, duplicate/reversed, and
genuinely disconnected segment fixtures at a fixed oblique camera angle.

## Start from GPS (Here) — 2026-09-07

Home geocode is a saved address, not live location. Route strip now has
**Here**: browser geolocation, city viewbox check, snap to the mapped network
(same generous snap as home). Surprise still picks landmarks; Home still
geocodes the typed address. Errors name permission, HTTPS, outside-city, and
unsnappable fixes instead of silently swapping the origin to a POI.

## Cold-open killed until location-honest — 2026-09-07

Playtest: cold-open asked “what is this place called?” about a due SRS name
that was not under the bike — no highlight, no hop. That teaches a false
pairing. `COLD_OPEN_ENABLED` is off; the picker remains for a later hop that
only asks dues on/near the route or shows the place. Copy was not the fix.

## Large-letter fill bump — 2026-09-06

User: still too much linen around the word. Wave AABB used 1.15× archPad so
fit thought faces were full while photo ink sat mid-card (span 44%). Honest
cap metrics + a taller comfort band (target ~74%, fill 60–78%) + less greeting
reserve. Jordaan pixel span 44%→64%, reach 71%→75%; no top-ink clip.

## Large-letter vision rounds (stop the size circle) — 2026-09-06

The fill/clip/wave pendulum was chasing the wrong gap. Authentic Indiana /
Waterloo / Alaska cards have a **chunky solid shelf**; ours had ~9px of color
that read as a cyan outline. Three frozen-theme vision rounds against a 6-card
gallery (no new fill/span asserts):

1. Solid back-silhouette extrusion (~23–31px single-line) + black/white die-cut.
2. Script may overlap left crests (no more shove-the-billboard); caption kept
   chrome-yellow. Nest vs Waterloo is still only partial.
3. Litho punch on letter windows, quieter scenic wash, stronger paper linen so
   the four style presets read as different recipes.

True vanishing-point mesh and place props stay open — those were how the last
session burned tokens.

## Vertical stretch restored — 2026-09-06

Clip/size clamps left paintScaleY≈0.77 with sx≈1 — pancake letters (IJBURG).
Raise face-fill comfort (~50–64%), keep sy with sx, let facePullY be the stretch.

## Two-line planes + OUD WEST clip — 2026-09-06

Per-glyph extrusion→face ordering let the top line's shelf cut halfway through
WEST (hard seam / "different planes"). Draw each line as a unit; shorten
two-line shelf + font; desert outline was a 9px tire.

## Top/left clip (IJBURG rise-coastal) — 2026-09-06

Rise + leftward extrusion soft-spilled past the paper: greeting loops and the
"I"/crest were clipped. Hard side/top clearance pass, tilt-aware greeting top,
milder rise pathAmount.

## Billboard size comfort band (NOORD too big) — 2026-09-06

Face AABB used 0.64em/0.03em while Archivo+pathWarp ink spans ~0.78/0.18em —
fill caps thought NOORD was fine while pixels hit ~90%H. Honest metrics +
MAX_FACE_FILL ~42–52%, and second paint-fit may only shrink (never re-expand).

## Top crest clip → stair-step wave — 2026-09-06

Aggressive 2nd-harmonic wave + grow-to-frame shoved mid-letter tops into the
paper clip; clipped crests read as a flat stair-step ("fucked up the top").
Fix: smooth Indiana rise+bow (no zig-zag harmonic), reserved greeting band
above the billboard, hard `TOP_INK_CLEAR` shove-down, greeting stays above
the crest.

## Two-line eye-wave (Sloterdijk Centrum) — 2026-09-06

Dual full arches on SLOTERDIJK + CENTRUM opened a lens/"eye" gap and parked
"Greetings from" over the wrong end. Fix: top line carries the wave, line 2
gets ~16% path; greeting pockets against the top line's left only; hyphen
breaks no longer paint a trailing "-".

## Stronger Indiana wave + greeting pocket — 2026-09-06

Wave `pathAmount` 0.22→0.38 with hotter harmonics so letter-to-letter lift
reads on the card; script parks in the left wave pocket (not mid-word), nests
into the tops, and tilts with the local slope.

## Billboard fill was lying — grow until the frame — 2026-09-06

CENTRUM (and friends) still looked like a top strip over a linen desert while
AABB “face fill” asserts passed. Root causes: (1) grow loop capped at
`MIN_FACE_FILL * 1.15` so it refused to use the bottom of the card; (2) a second
`fitLetterPaintScale` pass crushed the grown `paintScaleY`; (3) bounds overstated
descenders. Fix: always binary-search sy to the frame, keep the grown scale,
tighter cap ink bounds, caption tucked under faces, and a **pixel** letter-reach
assert (≥70%H) in `render:large-letter-craft`.

## Billboard fill + Indiana wave / Waterloo rise — 2026-09-06

Empty linen under JORDAAN was a measurement bug: face AABB used ~0.18em
descent on all-caps, so fit thought the word already filled the frame. Tightened
cap bounds, target face height 74%, grow-until-fill assert, and stop top-parking
short words. Multi-line (OUD WEST): shared path envelope + per-line band stretch
(Atlantic City) so stacked lines stay coplanar and width-full. Path vocabulary:
`wave` (Indiana undulation, now default `linen-arch`) and stronger `rise`
(Waterloo slant).

## Greeting vs name hierarchy (Monterey) — 2026-09-06

Authentic linen refs (Monterey / Alaska / Athletics): script is ~15–25% of
letter face height with a *thin* stroke, parked in arch slack — not a fixed
corner sticker. Ours was ~28% of the em with a 2.1px outline and always
left-top. Now: size from painted face AABB (~20%), stroke 1.15, pocket scorer
picks left/mid/right headroom relative to the place name; region caption
nudged heavier than the script.

## New route from pause / settings — 2026-09-06

Playtest: mid-ride there was no reliable way back to route setup. Pause’s
`M — back to menu` and finish’s “Choose route” both wrote
`this._routeSetup.style.display` on a never-assigned field, so they often did
nothing. Now `_openRouteSetup()` opens the enamel rail via
`overlay.store.setSetupOpen(true)`. Pause shows Resume + **New route** (touch
targets on phone; `M` on keyboard), settings has a New route button, help
lists `M (paused)`. Finish caption matches (“New route”).

## Bridge water quiz: no more “under” flip — 2026-09-06

Playtest: on a bike deck, “Which water is under this bridge?” forced a mental
inversion (look *down* through the structure) while attention is on crossing.
Street/car mode now asks “Which waterway are you crossing?” — same WATER chip
+ “Crossing a bridge” caption, answer still the canal. Boat keeps “Which water
are you on?” / “Passing under a bridge” (hull *is* on the water).

## City overview tighter + review-due tint — 2026-09-06

Playtest: the city overview sat in too much empty rim (`OVERVIEW_ZOOM` 1.18 →
1.35). Same city-fixed framing — just a notch closer so the canal ring and
player mark read more easily.

P1 #6 follow-on: overdue spaced-review streets/canals paint warm copper on the
overview (`routeReviewDue` → `reviewDueNetwork` / `reviewDueWater`), above the
green mastery bands. Cache key includes due-count so answering a due place
repaints without changing the track. Dedicated review screen still open.


## Border + top-clip P0 — 2026-09-06

User catch: fat cream mat + greeting/letter tops sliced by the paper clip —
those are blockers, not polish. Fixes: `BORDER_INSET` 4–6 hairline, full-bleed
backdrop (no inset photo panel), hard top in `fitLetterPaintScale` (no soft
spill above frame), arch/fisheye pad in painted AABB, greeting baseline lowered
for Pacifico loops, craft asserts + **pixel P0** in `render:large-letter-craft`
(`topInk` on y=0, left cream ring ≤14px). Vision often re-reports the old clip;
trust pixels.

## Tall linen craft loop (keep iterating) — 2026-09-06

More vision passes after the baseline re-anchor: solid-ish blue wall + short
orange tip (no candy ribs), die-cut black/white/keyline, down-right shelf with
paint order that matches shelf direction, fisheye center boost in path warp,
settle-down into leftover bottom air, punchier letter photos. Craft assert
effective face ≥58% card H. Still not true vanishing-point 3D sides.

## Tall linen letters (baseline re-anchor) — 2026-09-06

Vision loop: faces sat ~35% of card because glyphs were parked under the
greeting, then `facePullY` blew tops off-paper and `paintScaleY` crushed them
back. Fix: compute pull first, shift baselines so pulled faces land in the
vertical frame, pivot from face mid, soft-clip extrusion into the caption
pad. Effective JORDAAN mass ≥55% card H (craft assert); arch pathAmount 0.26.

## 3D tilt keyboard — 2026-09-06

Tilt slider was easy to miss: Settings (G) → View = Chase/Cockpit → **3D TILT**.
`[` / `]` now nudge ±3° (clamped −18…+18), sync the live slider, and persist.
Help card documents it.

## Bike steer animation sign — 2026-09-06

Omafiets / city-bike / Swapfiets fork yaw followed the wrong side of the turn:
`steerInput +1` is right, but +Y rotation on a +X-facing bike yaws the bars
left. Negate the steer target in `PlayerBike3D.update` so `Lenker` / front
wheel track the pad. Frame physics were already correct; only the mesh pose.

## Chase closer, cockpit less forward — 2026-09-06

Playtest: chase (high/behind) sat too far out; cockpit nudged past the bumper.
`CHASE_ZOOM_OFFSET` 0.05 → 0.55 (~1.5× closer on the log zoom scale). Cockpit
lookahead 240 → 160 px (`COCKPIT_LOOKAHEAD`). Pitch unchanged (42° / 82°).

## CI unblocked for blank-boot ship — 2026-09-06

Firebase stayed on `055ce32` because Canal CI failed after the blank-boot
gate. Fixes: shrink `game.js` under the decomposition line cap (overlay /
teaching / city helpers → presentation runtime; drop duplicate ribbon
constants); restore stretch-local `_recallFeatureAt` centres for streets so
one answer does not suppress the far end; refresh e2e for enamel HUD,
omafiets heading, flat-roof filter, Map Quest start copy, knowledge keys,
and a 120s Playwright budget so `openRoute` can finish. Also unmasked unit
stubs (`_tryColdOpenReview`, postcard province caption) that never ran while
the line-count assert failed first.

## Large-letter postcard compositor (standalone) — 2026-09-06

An earlier HISTORY line claimed vintage large-letter neighborhood postcards had
shipped. That was aspirational: live `drawPostcard` is still the compact HUD
strip (photo left, name right). The real compositor is now
`src/canalRecall/largeLetterPostcard.ts` — pure measure + canvas paint, no AI.
Letters are Barlow Condensed with a dark extrusion and outline; Wikimedia-style
photos are cover-cropped and clipped with `destination-in` (one image spans the
word, or N images become equal strips). Zero images get a solid typographic
fill on sun-faded paper. Storybook hosts the states; `test:large-letter-postcard`
guards fit / two-line split / caption. Game wiring is a later pop-in overlay —
not a replacement for the bottom-band entry strip.

## Play delight: missions, finish story, cold-open, passport — 2026-09-06

Fun that still teaches the city:

1. **Mission punchlines** on the setup footer and race open — destination /
   home intent only; never the start corridor (removed `Starting on …`).
2. **Finish knowledge story** uses real `explorationGain` (first-ever names /
   hoods / landmarks), place-day streak, passport stamps, and a guest fog-map
   sync tease.
3. **Cold-open review** asks one overdue SRS place in the first minute when
   due reviews exist (`RecallStore.dueReviews`).
4. **“You know …” wink** on mastered re-entry instead of an encyclopedia card.
5. **Encyclopedia postcards** open only after a *correct* answer (not wrong /
   adopt drive-throughs).
6. **Neighborhood passport** stamps visited hoods once the city collection is
   thick enough (≥8 names).

Typed modules: `missionBrief`, `finishStory`, `coldOpenReview`, `placeStreak`,
`neighborhoodPassport`. Check: `npm run test:play-delight`.

## Blank boot from transit overlay before MapLibre load — 2026-09-06

This morning's corridor-overlay work called `setTransitNetwork` from
`_applyPrefsToRuntime` during `new Game()`, before MapLibre's style `load`.
`addSource` threw `Style is not done loading`, so `window.canalRecallGame`
never stuck and Start Route left a navy blank with gear/help only.

Fix: stash the pending network when `!ready`, create layers only once
`isStyleLoaded()`, and flush on `load` (same pattern as pending trees/places).

**CI / hooks (same day):** Playwright CI had been timing out for weeks because
setup-rail selects are `hidden` and helpers used unforced `selectOption`. Deploy
also shipped on every `main` push without waiting for e2e or `check:canal`.
Now: shared `tests/e2e/helpers.ts` (`force: true`); `Canal CI` workflow runs
`check:canal` + boot smoke + full e2e; Firebase/Pages deploy only after a green
CI `workflow_run` on `main`; `prepare` installs pre-commit (`lint`) and
pre-push (`lint` + `test:e2e:smoke`). Host type holes for transit transfers /
home learning radius are filled so `tsc` (and therefore `check:canal`) is green
again — it had been red on main since those fields landed without declaration-
merge updates.

## Transit 3D camera, corridor callout, quiz pacing — 2026-09-06

Playtest notes from a Waterlooplein / Academie van Bouwkunst metro hop:

1. **Chase ≠ cockpit.** Chase is high (42° + 0.55 zoom); cockpit is bumper-
   close (82°, +1.65 zoom, 160 px lookahead). Live **3D tilt** slider (−18…+18°)
   offsets either mode. Pitch eases in so load→race is not a hard snap.
2. **Tracks through buildings.** GTFS metro shapes and Liberty rails are ground
   projections of tunnels — they are not OSM `tunnel=*` tagged in our extract.
   Treatment: paint all driveable corridors; tram is a bold surface ribbon under
   buildings; metro is a dashed amber tunnel drawn *above* extrusions; the 3D
   metro mesh drops to −9 m altitude on `type=metro`.
3. **Quiz pacing.** 18 s orientation grace before any transit ask; line settle
   2.4 s; transfers wait 32 s after the line is sticky so hub spawn does not
   stack “which metro” → “what can you transfer to”.
4. **Load settle.** Aim with the active view pitch, then wait for MapLibre
   `idle` (cap ~2.8 s) before racing so the first frames are not a Damrak hitch.

## Setup rail distill — city select, strips, view icons — 2026-09-06

Route setup was stacking wide two-line tiles (City grid, Travel captions,
“change View in More options”). Distilled to scan faster while keeping enamel
tiles: City is one `#city-id` dropdown; Travel / Route are equal one-word
strips; View is an icon-only strip on the primary rail (tooltip/aria keep the
mode name; camera select removed from More). Follow-up pass tightened vertical
rhythm, dropped the City gloss, and paired View under Travel.

## Teachable transit pairs, graded knowledge map, hub polish — 2026-09-06

1. **Surprise transfers:** `pickTeachableTransitPair` biases ~70% of transit
   surprise hops toward two-leg plans so changing lines is normal play, not a
   hand-picked Noord→Isolatorweg demo.
2. **Knowledge map slice 2:** overview mastery bands (fog / learning / known /
   mastered) with separate blue tints for canal/river/dock vs land green.
3. **Playtest polish:** line-quiz distractors prefer other lines at the nearest
   hub; second-leg plaque stays blank until the new corridor is answered;
   named check pins Noord→Isolatorweg as a two-leg hop.

## Transit second-leg drive after hub change — 2026-09-06

Phase E planner/quiz landed without boarding the next corridor. Now:

- **Corridor lock:** `setPreferredCorridor` + `pickRoadContactPreferName` keep the
  road guard on the active leg’s line name at overlapping hubs.
- **Hub is the first finish:** two-leg hops retarget `finishPoint` to the
  transfer stop; arriving advances to leg 2 (`Change to Metro …`), restores the
  real destination, and replans — race does not end at the hub.
- Stop quizzes scope to the **current leg**’s from→to stops.

## Transit Phase D hardening + Phase E transfers — 2026-09-06

Phase D was driveable but still taught like a single-line thin slice.

- **Metro 52 pin:** end-to-end reachability + Noord/Centraal stop pins beside
  tram 2 in `check:transit-routing`.
- **Termini surprise pool:** `transitRouteAnchors` adds every driveable line’s
  first/last stop (Isolatorweg, Gein, …) on top of curated hubs — 34 anchors.
- **Active-line stop scope:** destination-scoped stop quizzes resolve the
  corridor from `_activeTransitLine` / covering stops, not `lines[0]`.
- **Sibling distractors:** line quizzes prefer corridors that share stops so
  “which line am I on” is a real discrimination task at hubs.
- **Phase E transfers:** `transit-transfers.json` (94 edges from parent
  stations + proximity; GTFS `transfers.txt` merged when cached).
  `planTransitConnection` caps at two rides; hub quiz asks which line you can
  change to.

## Home radius polish, knowledge tint, transit Phase D, English prune — 2026-09-05

Four follow-ons after the expanding home-learning radius landed:

1. **Home polish.** Persist `canalRecall.homeLearningRadius.v1`; HUD plaque and
   briefing note show `Learning near home · ~X.X km` when there is no quiz
   feedback. Soft `homeBias` on `planLearningRoadRoute` prefers paths that stay
   inside the ring so surprise hops inside the radius do not swing across the
   city for a few metres of novelty.
2. **Knowledge overview (first slice of P1 #6).** City overview splits network
   segments into fog vs known (`routeMastery ≥ 0.45`) and paints known in a
   quieter green. Cache key includes known-count so answering a street updates
   the map without changing the track. Graded colours / waterways / review-due
   remain on the board.
3. **Transit Phase D.** Playable modes are tram + metro (`TRANSIT_DRIVEABLE_MODES`);
   `playableRefs: []` loads every line in those modes. Anchors broadened beyond
   tram 2. Thin-slice pins stay in `check:transit-routing` for Dam / Centraal→
   Museumplein regressions. Ferries still excluded until water hops are designed.
4. **English cache prune.** `--prune-stale` drops orphaned
   `english-translations.json` entries, scanning **all** city extracts so a
   one-directory run cannot delete live Utrecht/Rotterdam/Den Haag hashes.
   322 orphans removed. Thickening remaining Wikidata floors is still blocked
   by sparse originals + rename-refusal on `trn`.

## Pedestrian bicycle=no is playable, flagged restricted — 2026-09-05

Kalverstraat (and similar shopping streets) are `highway=pedestrian` +
`bicycle=no` in OSM. The bike graph used to exclude them on purpose. Street
mode now keeps those corridors **playable** and stores `bicycleRestricted`
(+ OSM `bicycle` value) on the routing way / road segment. The left plaque
shows a rivet-accent line (“No cycling in real life” / “Walk bikes…”) while
you are on one — never the street name, so it cannot answer a quiz. Sidewalk
`footway`s still need an explicit bicycle tag. Named check: Kalverstraat must
be in `streets-routing` with the restriction flag.

## Canal-belt streets survive the quiz extract — 2026-09-05

`streets.json` was capped at 300 and scored mostly on OSM wiki tags + length,
so Coen Tunnel outranked Leidsestraat / Damrak. Two fixes: streets cap → 500
in the builder; `amsterdam-curation.json` scoreBoosts for canal-belt and tram
corridor names. Published extract patched now via
`ensure:amsterdam-teaching-streets` (pull geometry from `streets-routing`,
42 names added → 342 streets). Tram-2 corridor hits within 80 m: 12 → 25.
Kalverstraat still missing — not in bike routing (pedestrian-only OSM).

## Tram lock + along-route teaching — 2026-09-05

Phase C playtest: the line vanished from the plaque as soon as a stop question
opened (or after a brief shape gap), and the ride only asked line + any nearby
stop — not streets, landmarks, or stops toward the destination.

- **Sticky line plaque:** once Tram 2 is answered/adopted, keep it on the HUD
  for the hop. Only a line question (or pre-answer settle) blanks it; stop and
  street prompts leave the line visible. Do not pre-reveal the line at spawn.
- **Stronger corridor lock:** wider tram/metro envelopes + firmer soft-pull so
  noisy GTFS shapes feel locked, not grazable.
- **Dest-scoped stops:** quiz only intermediate (+ destination) stops on the
  ordered line between `routeFrom` and `routeTo`, and only while still ahead
  toward the finish.
- **Corridor streets:** read-only index from curated `streets.json` paths —
  never driveable. Secondary “which street is the tram on?” quizzes along the
  rails; encyclopedia via existing street knowledge.
- **Landmarks:** pure lat/lng projection in transit (no snap-onto-rails), and
  prefer cards within ~120 m of `routePath`.

## Home routes expand from nearby (2026-09-05)

Home-base destination picks were a flat random within 6 km. They now use a
learning ring that starts at ~1 km and steps outward as practised street/canal
answers accumulate near home, scoring closer + less-familiar landmarks first.
Surprise pairing is unchanged. Prefs copy: “Nearby first, expands as you learn.”

## Transit chase scale bumped (2026-09-05)

Metro stand-in read as a speck in the yellow tram corridor at chase altitude
(`TRANSIT_GAME_SCALE` 2.2). Experiment: 3.4 — still below bike’s 4.5, above
boat’s 1.5 — for a slightly cartoony read without filling the lane.

## Pedals joined to crank arms (2026-09-05)

Top-down showed floating pedal bricks with a gap past the arm tips. Cranks now
run spindle → arm → pedal spindle → platform with overlaps on omafiets and
Swapfiets. Preview `?v=10` / `?v=4`.

## Omafiets BB junction cleaned (2026-09-05)

Same floating rear stub as Swapfiets had: step-through Bézier started behind
the seat tube. U now starts mid seat-tube with a BB shell + trough join.
Preview `?v=9`.

## Swapfiets Original silhouette pass (2026-09-05)

Authored skin was still a recolored omafiets. Reshaped toward PatrickGoud /
real Original cues: double parallel step-through, chrome high-rise bars with
black grips + bell, front carrier only (no rear rack), ring lock on the seat
tube, fuller chain case, spring coils under the saddle, ~42 mm tyres, vivid
red + iconic blue. Clearance assert still green. Preview `?v=3`.

## Swapfiets BB junction cleaned (2026-09-05)

Side close-up showed a floating red stub behind the bottom bracket — the
step-through Bézier started rear of the seat tube and looped into a dead end,
plus a separate BB→U cylinder stacked on top. U now starts mid seat-tube, dips
ahead of the BB, and a short BB shell + trough join replace the stub. Preview
`?v=2`.

## Swapfiets authored from scratch (2026-09-05)

PatrickGoud’s Sketchfab body never yielded clean wheel/steer splits — cuts
tore bars/seat/tyres, and the `×1.7` lateral bake ovalled the discs. Replaced
the look-only preview with a procedural twin of the omafiets geometry:
red frame, blue front tyre, black rear, cargo front rack, real
`Lenker` / `RadVorn` / `RadHinten`. `scripts/build-swapfiets-bike.py` →
`swapfiets-runtime.glb`; skin `motion: true`, `widthScale: 1.3`. Front-tyre
clearance assert green (~9cm Frame / ~11cm Fork). Sketchfab GLB removed from
ship; omafiets stays the dark-green distinct livery.

## Mama-chari: solid frame, metre-scale (2026-09-05)

Preview showed floating seat/wheels/basket. Three stacked causes: (1) strip used
`abs(x)<0.012` through the front-wheel disc and ate the ±0.02-wide midplane
spine — now annulus-only, and only isolated tyre-island verts (frame joints
kept); (2) root×scale left body/handle at object scale ~15 while wheels were 1,
plus leftover Sketchfab/FBX empties — bake mesh scales and prune before export;
(3) preview `widthScale=1.65` non-uniform Z exploded the multi-node rig — set to
1. Prefer standalone/zip `.glb` over FBX. Uniform root scale targets wheelbase
≈ 1.08 m. Asserts strip count, body X span, and midplane gap. Preview `?v=8`.

## Transit mode thin slice (tram 2) — 2026-09-05

Phases A–C of [`TRANSIT_SPIKE.md`](TRANSIT_SPIKE.md) on `spike/canal-transit`.

- **Why GTFS, not OSM relations:** stop/line/headsign identity is timetable
  catalog, not basemap geometry. OVapi → GVB filter →
  `transit-network.json`; OSM stays secondary for walk connectors later.
- **Why a travel profile:** binary `isCar` could not absorb a third mode
  without another sprawl of boat/bike forks. `travelProfile.ts` owns extract
  file, quiz nouns, motion, and road-constrain flags; legacy `isCar` /
  `isBoat` remain thin wrappers.
- **Why tram 2 only:** one corridor teaches stop + line quizzes before the
  full 32-line surface drowns surprise routing. `TRANSIT_THIN_SLICE_REFS`
  unlocks Phase D later without rewiring mastery.
- **Why separate line keys:** ask-point SRS would fragment mastery along the
  shape; lines key on mode+ref+city, stops on extract centres.
- Gate: `npm run check:transit` (extract pins, tram 2 reachability, prefs,
  overlay). Boat/bike regression: `test:canal-car`.
- **Demo chase mesh:** `gvb-metro-51-runtime.glb` (~3k tris, meshopt) from
  mini-amsterdam-3d’s mirror of UiGoku’s Sketchfab metro 51. Licence not
  cleared — stand-in only; street-tram asset still wanted.

## Mama-chari retired (2026-09-05)

Gave up. Sketchfab mama-chari never yielded a chase-clean steerable skin
(welded front tyre, handle/body seam, strip/copy hacks made it worse). Removed
from `bikeSkins`, preview, NOTICE, and deleted `mama-chari-runtime.glb` +
`scripts/rig-mama-chari-bike.py`. Stored pref `bikeSkin=mama` falls back to
omafiets. Keep omafiets + pink (motion) and Swapfiets (look-only).

## Swapfiets: unskewed look-only body (2026-09-05)

The earlier `×1.7` lateral bake ovalled the wheels. Cutting verts for real
steer/spin still tears PatrickGoud’s mesh into floating bars/seat/tyres (tried
again with `stylize-swapfiets-bike.py`). Preview GLB is intact + leveled, no
lateral bake; motion stays off. Steerable skins: omafiets / pink / mama.

## Mama-chari: stop inventing a front disc (2026-09-05)

Prior rigs searched a “front hub” on the body and pasted a rear-disc copy
there — that parked a stray wheel mid-frame and, with the midplane strip,
hollowed the bike. Front tyre/fork/basket live on the handle mesh. Rig now
keeps the handle intact under `Lenker` (steer), spins only the rear disc, uses
the standalone `.glb`, scales to ~1.08 m wheelbase, and forces preview
`widthScale=1` (non-uniform Z exploded the hierarchy). Head-tube seam is the
source’s two-mesh join (~1 cm), not an exploded transform.

## Omafiets: chain case clear of frame (2026-09-05)

Gray chain case was punching through the green stay/U. Moved outboard/lower
(`Y≈−0.18`). Preview `?v=8`.

## Pink city bike: front fender concentric (2026-09-05)

Side/3/4 shots still showed an uneven tyre↔mudguard gap and a slight lean —
`front_mudguard` sat ~10° off the wheel plane and ~15° pitched after handle
straighten. Rig now PCA-aligns the fender onto +Y about the hub, searches
pitch for min radial spread, and snaps midplane. Asserts thin↔Y < 2° and
midΔY < 3cm. Preview `?v=19`.

## Omafiets: curved step-through, bars, saddle (2026-09-05)

Side/top screenshots showed a kinked U (few straight cylinders), angular
three-segment bars, and a floating flat seat tablet. Rebuild uses sparse
auto-handle Bézier controls + bevelled tubes for the step-through and
handlebars (smooth-shaded), stacked ellipsoids for a flush spring saddle,
and seat stays routed outside the rear tyre. Preview `?v=6`. Front clearance
assert still green (~9cm Frame / ~11cm Fork). OpenRouter side+top QA: PASS.

## Mama-chari: front wheel spin + straight track (2026-09-05)

Same class of bug as the pink city bike: the front tyre was welded into
`MamaChariBody`, so `RadVorn` was an empty (no spin) and the authored tyre sat
cocked vs the frame. There is no clean loose front disc — cutting “roundish”
parts tore mid-frame tubes earlier. Rig now strips the welded front-tyre verts,
mounts a copy of the rear disc under `RadVorn`, PCA-bakes axle → +Y, and puts
both hubs on one midplane. Preview `?v=6`. Steer couples bars+wheel; spin
verified via frame diffs (solid disc is hard to see by eye).

## Pink city bike: track centering (2026-09-05)

Front hub sat ~6cm beside the rear after straighten, and the basket was
another ~8cm offline — top-down looked off-centre / slightly wobbly even
with a true spin axle. Rig now snaps the front assembly onto the rear
midplane, nudges the basket onto the hub track, and recentres so hubs sit
on Y=0. Preview `?v=18`. Ortho-top + spin QA: PASS.

## Pink city bike: front wheel spin axle (2026-09-05)

After rest-steer straighten, AABB “thin=Y” still left the front disc ~10°
tilted, so +Z spin looked wobbly. `bake_wheel_to_pivot` now aligns the
min-variance axle onto +Y (residual 0°; thickness matches the rear). Preview
`?v=15`.

## Omafiets: front tyre no longer eats the frame (2026-09-05)

The authored step-through U and a BB→head diagonal ran through the front
tyre volume (~3cm penetration). Rebuild pulls the U back/up behind the wheel,
drops the long diagonal for a short BB→U join, shortens the head tube, nudges
the front hub forward, and bows the fork out wider (`AXLE_HALF` 0.12) so side
views do not read as tubes through rubber. Build asserts Frame/Fork mesh gaps
before export. Preview `?v=3`. OpenRouter chase-angle QA: PASS.

## Pink city bike: rest steer + stray cables (2026-09-05)

Kin Chen’s CC0 pink city bike shipped with bars/fork/fender yawed ~50° while
the game spin pivot forced the front tyre upright, so the wheel sat beside
the fender. Brake-cable meshes (`*剎車線*`, `煞車TL*`) also floated once the
bars moved under `Lenker`.

`scripts/rig-pink-city-bike.py` now: deletes those cable objects; searches the
Z rotation that minimizes front-wheel lateral span (mudguard AABB was a bad
proxy); places `Lenker`/`RadVorn` *after* straighten at the mesh hub so the
tyre is not left at the pre-yaw hub; puts `Lenker` on the hub’s lateral
midplane so steer does not orbit the wheel sideways. Preview cache `?v=14`.
OpenRouter vision QA on side/front/chase/steer screenshots: PASS.

## Board cleanup (2026-09-05): 8b closed, 11b demoted

**8b** (type the decision half) is finished: no un-migrated decision logic left
under that item. Rule kept in CLAUDE.md — decisions in TypeScript, paint in
JavaScript; `game.js` and renderers stay JS on purpose.

**11b** was describing a failed staging rebuild (network halved, bridge ids
desynced). That never shipped. Published Amsterdam on `main` is healthy
(`check-city-extract` / bridge crossings green; ~47k ways; city profile
present). The board item is now an optional currency refresh, not a red bug.

## Mama-chari skin (optional baby seat)

pokoponmaru’s Sketchfab “City Bike (mama-chari)” (CC BY 4.0) is rigged from
the downloaded FBX zip by `scripts/rig-mama-chari-bike.py`. Loose parts split
into `BabySeat`, handle → `Lenker`, and the one true circular rear disc →
`RadHinten`. The front tyre is welded into the body (cutting “wheel-like”
mid-frame tubes made them spin and split the bike), so only the rear spins.
Pref skin id `mama`; baby seat uses the shared `bikeBabySeat` toggle.

## Optional baby seat on omafiets

Authored omafiets ships a named `BabySeat` on the rear rack. Pref
`bikeBabySeat` (default off) and the preview checkbox show/hide it. Skins
advertise support via `bikeSkins.babySeat`. Mama-chari can reuse the same
node + pref once Sketchfab download is available.

## Bike skins are pickable (omafiets / city / Swapfiets)

`bikeSkin` lives in preferences. Street-mode chase loads
`omafiets-runtime.glb`, `pink-city-bicycle-runtime.glb`, or the Sketchfab
Swapfiets body. Setup shows a Bicycle row when Travel is Bike; live settings
have the same control. Swapfiets is look-only (no spin). Catalog:
`src/canalRecall/game/bikeSkins.ts`.

Omafiets livery is dark-green Dutch roadster (not red+blue) so it stays
distinct from Swapfiets. Chaincase thinned, rear rack has stays, tires
slightly slimmer, saddle tapered. Swapfiets body bakes ~1.7× lateral width
for chase parity. Pink city bike is decimated and its wheel axles are baked
onto the game spin axis (+Z after glTF). Preview: `bike-preview.html`.
`swapfiets-runtime.glb` is no longer a copy of omafiets.

## Free pink city bike in preview (CC0, real pivots)

Downloaded Kin Chen’s BlenderKit “Pink city bicycle” (CC0 via MorfVision) —
step-through + basket with separate `handle` / `front_wheelset` /
`back_wheelset`. Rigged to `Lenker` / `RadVorn` / `RadHinten` in
`scripts/rig-pink-city-bike.py` and added to `bike-preview.html`. Closest free
non-Dutch city-bike candidate with working spin/steer; game still uses authored
omafiets until taste-pass decides.

## Clear all data (item 12)

**Reset knowledge…** stays the soft wipe (spaced repetition + fact rotation).
**Clear all data…** sits beside it under Advanced: knowledge, exploration
collection, personal bests, preferences (UI resets to defaults), and the
home-address geocode cache. Sign-in stays. Helpers live next to the storage
keys; `test:canal-clear-all` pins them.

## One RD New transform (façade alignment)

`rdCoordinates.ts` is now a thin tuple wrapper over `facade/rdNew.ts`, so
3DBAG callers use the same NSGI-aligned polynomials as the façade pipeline
(~1 cm vs PDOK). `test:rd-coordinates` expects the aligned Amersfoort origin.

## Building / façade / 3D work left the board

Items 8a, 10, 10b, 10c, 18, 20, 20b, 21, 22 and 25 are owned by other agents.
Design notes stay in `BUILDING_*.md`, `FACADE_*.md`, `LOD.md`; this board no
longer tracks them.

## Disambiguation follow on Rotterdam and Den Haag

Same city-qualified dab follow as Utrecht: each city re-enrich followed 1
page to a confident `Name (City)` article; English pass ran for water/streets;
`check:encyclopedia-disambiguation` and `check:extract-english` green.

## Disambiguation pages follow a city-qualified article when score ≥45

Silence alone dropped real places whose OSM sitelink pointed at a dab page
(`Nieuwegracht` → list). Enrich and live title discovery now fetch the dab
wikitext, score link targets with `pickDisambiguationTarget` (exact
`Name (City)` = 100; Den Haag aliases; refuse rename traps), and refetch the
summary only when confident. Utrecht re-enrich followed 15 pages; English pass
restored ledes for Nieuwegracht, Leidseweg, Amsterdamsestraatweg, and peers.
Ambiguous leftovers (Middelwetering, Bijleveld, …) stay empty. 16 checks in
`test:street-wikipedia`.

## Disambiguation pages never become cards; curated POIs for every Randstad city

Title discovery was accepting Wikipedia list pages (`Nieuwegracht can refer
to…`, `Vecht may refer to…`) and publishing them as place encyclopedia — silence
is better than that. `isDisambiguationExtract` rejects them in enrich and title
discovery, `scrub:disambiguation` cleared 86 published offenders across the four
cities, and `check:encyclopedia-disambiguation` is a publish gate. Title lookup
now passes the city's own name (`Nieuwegracht (Utrecht)` before the bare title).
Surprise routes for Utrecht, Rotterdam and Den Haag get curated landmark
anchors so prominence no longer sends every trip to a university campus.

## Utrecht full refresh published (2026-09-05)

`npm run refresh:utrecht` finally ran end-to-end against the cached BBBike PBF.
Published extract now has `street-knowledge.json` and English card blurbs:
streets 0→91 ledes, water 2→41, landmarks 125, bridges 66 (0 leftover `nl`).
Two pipeline hardenings landed with it: rename-refusal leftovers clear Dutch
instead of failing the English gate, and `build-bridge-railways` retries Overpass
mirrors so a 504 does not throw away a finished enrich.

## Swapfiets overlay tyres removed (looked broken)

Tyre overlays on the Sketchfab Swapfiets preview were ~3× too thick and sat on
top of the painted wheels — double-wheel donuts through the frame. Dropped them;
`swapfiets-sketchfab-preview.glb` is an intact body + pivot empties only.
Steer/spin stay on the authored `omafiets-runtime.glb`. A free game-ready Dutch
bike with real wheel splits is still the path to Sketchfab motion.

## Omafiets authored; Swapfiets reference is body-only

Hand-built `omafiets-runtime.glb` is the game bike (deep step-through, blue
front tyre, `Lenker`/`RadVorn`/`RadHinten`). Sketchfab Swapfiets native meshes
are not clean wheel/frame splits; cutting verts tore fenders and bars apart.
Preview keeps the intact baked body for look comparison only.


## Street-mode bicycle is a Swapfiets omafiets

The Carbon Frame Bike GLB read as a sport road bike from chase altitude — wrong
for Amsterdam street mode, which is cycling presentation. It is replaced by
PatrickGoud’s Sketchfab “Swapfiets” (CC BY 4.0): step-through frame, upright
bars, blue front tyre. `scripts/stylize-swapfiets-bike.py` levels the mesh
(yaw/pitch/roll so both wheel contacts share a ground plane), grounds it at
Y = 0, and splits `Lenker` / `RadVorn` / `RadHinten` for steer about +Y and
wheel roll about +Z. Runtime is `swapfiets-runtime.glb` (~1.4 MB, meshopt +
1024² WebP, hierarchy preserved). Heading offset is `0` (+X forward). An
earlier 0.15 simplify pass and voxel remesh were rejected for crushing thin
tubes. Credit in `NOTICE.md`.

## Full city selector (Amsterdam / Utrecht / Rotterdam / Den Haag)

The briefing City row writes `cityId` into preferences. A typed catalog in
`src/canalRecall/game/cities.ts` owns centre, extract path, geocode suffix /
viewbox, province caption, and Amsterdam's curated route POIs. Loaders,
recall keys, home geocode, postcard captions, and the basemap extract root
all follow that id — so a Utrecht answer cannot stamp an Amsterdam mastery
key. Selecting a city on the briefing jumps the map to that centre and
refetches the landmark destination pool. Cities without curated POIs start
from the prominence-ranked landmark extract. Remaining content gaps stay on
the board as optional extract refresh (11b) and thin-lede polish (11c), not as
a blocked play path.

## Randstad refresh reuses OSM and Wikimedia caches

`npm run refresh:randstad` is the one command for Amsterdam, Rotterdam, Den
Haag and Utrecht. BBBike city PBFs and the shared Zuid-Holland province file
now live in `.cache/osm-source/` (Amsterdam/Utrecht used to re-download every
run). Municipality cuts for Rotterdam and Den Haag are cached against the
province mtime. Enrichment still hits `.cache/wikimedia/` and
`english-translations.json`. `REFRESH_FORCE_DOWNLOAD`, `REFRESH_FORCE_CUT`, and
`REFRESH_OFFLINE` control cache behaviour.

## Finish card hears Enter and Esc again

Arrival actions were painted with ENTER / ESC shortcuts, but the keys often
did nothing: quiz focus stayed on a hidden `#canal-answer` or a settings
button, `InputManager` ignored those targets, and a stale `_utilityOpen`
flag returned before the FINISHED handler. The canvas is now focusable, finish
reclaims focus and clears utilities, and keyboard ignore no longer treats
buttons or hidden fields as live form focus.

## Street/water cards show their Wikipedia photos

Amstel and many other route names already had `wikipediaImageUrl` in the
extract, but `_showStreetKnowledge` never put it on the notice — only
landmarks did. Street and water encyclopedia cards now pass the image through
and kick the same on-demand loader landmarks use when the card opens.

## Borough postcards: Centrum and the other stadsdelen

OSM names districts `Centrum` / `Noord` / … while Wikidata labels them
`Amsterdam-Centrum`. Boroughs also use instance-of `borough of Amsterdam`
(Q15079751), which the neighborhood SPARQL omitted. Aliases plus that type
bring the seven boroughs into `neighborhoods-enriched.json` with photos
(Centrum now has a Jordaan canal Commons image).

## Utrecht English ledes via trn

`enrich:utrecht-english` now skips a missing `street-knowledge.json` and
honours an explicit `--translator=` over the script’s `--ollama` default.
A `trn` pass translated 141 Utrecht blurbs (6 rename refusals).

## Published v11 Randstad trivia (opening then second beat)

Owner blanket-approved the `facts-v11-opening-then-trivia` OpenRouter
`qwen/qwen3.5-flash-02-23` staging catalogs on 2026-09-05. Shipped
`facts.json` for Amsterdam (948 / 2,354), Rotterdam (270 / 652), Den Haag
(199 / 540) and Utrecht (211 / 506) — 1,628 features, 4,052 facts, every
feature carrying an article-lede opening. Review sheets were rewritten for the
new generator version; v10 labels do not carry over across generator bumps.

## Boat top speed raised

Canal mode felt capped on long straight canals. Base `CAR_MAX_SPEED` is 260
px/s (was 205) with matching `CAR_ACCEL` 120 so the boat still reaches the new
cap promptly. Street mode still multiplies on top via `PLAYER_CAR_SPEED_MULT`.

## Trivia cards open with who/what, then a second beat

Rotated facts used to replace the Wikipedia lede entirely, so a people or
history punchline could land without saying who the namesake was. Cards now
pair an **opening** sentence from the same article (catalog `opening`, or the
feature’s published encyclopedia lede) with the chosen trivia sentence.
`facts:build` records openings from the article lede; `facts:attach-openings`
backfills them onto an already-published catalog without regenerating facts
(`--force` rewrites after splitter fixes). The writer prompt treats trivia as
the second beat after that opening. `openingSentence` skips abbreviation
periods (`no.`, `St.`) the same way the English extract trimmer does.

## Shared enamel CSS from one hudTheme source

Map Quest and Canal each kept a hand-copied cobalt palette and plaque recipe.
Hex values now live only in `hudTheme.ts` (`enamelTheme`); `publish:enamel-css`
writes `enamel-tokens.css` + Canal’s `css/enamel.css` (tokens + plaque/tile
chrome). Canal layout CSS stays in `index.html`; Map Quest quiz chips/dialogs
stay in `src/index.css`. `check-enamel-css` pins the publish output.

## Overview map stays up during quizzes; player pin is readable

The city overview used to vanish whenever a quiz or answer-hold owned the
bottom band — the same gate that keeps landmark cards from stacking under a
question. That was wrong for orientation: the map draws no names, so it cannot
answer the prompt, and “where am I in the city?” is most useful while you are
stopped and thinking. It now stays visible during quiz and feedback; utility
panels (settings / help / expanded article) still hide it. The player mark is
a soft halo, solid blue disc, and larger heading wedge instead of a lone dark
cone that disappeared into the network at city scale.

## Encyclopedia refresh publishes English or fails

`refresh-city-extract.sh` now builds `street-knowledge.json` from streets/water
extracts, runs `enrich:english`, and gates on `check-extract-english` so a
rebuild cannot ship `wikipediaExtractLang: "nl"` again. The three enrich
scripts share `ENCYCLOPEDIA_PARTITION_FILES`. Wikidata-only features with no
article get an English description floor instead of a silent “linked” card.
`street-knowledge.json` is generated, not hand-edited.

## Storybook calm finish without photo; GameHeader drawer enamel

Arrival can now be reviewed without a ribbon or landmark image
(`finish-calm-bare` + phone). Hidden Map Quest overflow controls drop the last
slate/amber/emerald chips for enamel tiles and segments.

## Canal setup distilled View/Difficulty; Map Quest mode gloss + undo

Setup no longer fronts four cameras or five difficulties: View is a one-line
summary (cameras under More), Difficulty is Easy–Hard with Expert/Custom in
More, and each row gets a short gloss. Map Quest uses “Neighborhood”
everywhere, explains modes on the start rail, labels disabled Confirm as
“Place a pin first,” and offers a brief Back to start after a category tap.

## Encyclopedia text is offline-only — no live Wikipedia in the game

The browser used to resolve missing street blurbs (and landmark summaries)
against Wikipedia at runtime. That path shipped Dutch ledes with an `NL` badge
(Nassaukade) because title lookup preferred nlwiki and never ran
`enrich:english`. Live fetches are gone: `_showStreetKnowledge` only reads the
published extract, and landmark cards no longer call the REST summary API.
Untagged streets/water are discovered by title in
`enrich-amsterdam-wikipedia-extracts.ts` (step 0, `--files=` supported);
`translate-extracts-to-english.ts` now also covers `street-knowledge.json`.
`resolveStreetWikipedia` remains as the enrich helper and stays unit-tested.

## Map Quest phone vista, quiet entry, map-first play

Phone start used a full-height cobalt rail and hid the CC0 canal; it now
mirrors Canal’s rail + vista strip. Category fetch no longer dumps
“Loaded N places…” over the first question (loading modal already covers
progress). Play on phone: shorter header, icon-only modes, capped quiz cards,
and Canal Recall float visible — so the map stays the learning surface.

## Canal setup: phone Start clears Difficulty

Sticky Start over the scroll covered Difficulty on phones (~40px of overlap).
Start now lives in a flex footer below the scroll; phone density (shorter vista,
caption-less tiles, tighter rows) keeps Travel → Difficulty in the first view.
Start is night-ink on copper (~WCAG AA) instead of white-on-copper (~3.1:1), and
secondary type floors at 12px. View’s four cameras stay; only captions hide on
phone.

## Load aims at the boat and coalesces building-tile setData

Two regressions after the nearest-first tile streamer: the map stayed on Damrak
for the whole loading screen (tiles only started on the first racing `sync`),
and every tile arrival deep-cloned the resident FeatureCollection into
`setData`, so two concurrent finishes hitch the main thread. Loading now calls
`aimAtWorld` once the start point is known (and again from `_setupRace`), the
streamer coalesces flushes to one per animation frame, and concurrency stays
at 1 until the first tile lands so the spawn neighbourhood wins the pipe.

## Building tiles load the spawn neighbourhood first

`planTiles` already sorted nearest-first, but the streamer started every wanted
fetch with `Promise.all`, so bandwidth was shared evenly and a fat corner tile
often landed before the centre — the player spawned into a hole. Worse, attach
fetched against MapLibre's Damrak default centre before the route start was
known, and those in-flight requests kept eating the pipe after the camera
jumped. The streamer now: waits for `followCamera` from `vector-map.sync` (and
`moveend`) instead of loading on attach; fetches with concurrency 2 in plan
order; aborts in-flight tiles the new viewport no longer wants. `planTiles`
also returns `wanted` so abort decisions use the full camera set.
`check-building-tile-source` pins non-decreasing load distance.

## First turn no longer pays for the static building extract when tiles exist

Amsterdam's LoD1 city is published, but map load still fetched, parsed and
`setData`'d the 5.6 MB `buildings-colored.geojson`, built a 10k-centroid grid,
installed a 10k-id `building-3d` filter, and bound a proximity rescan on every
OpenFreeMap `sourcedata` / `moveend` — then tore that work down when the tile
index probed true. `_bootstrapBuildings` now awaits the complete-city probe
first; on success it never touches the static extract or the proximity path.
The no-tiles fallback still loads the GeoJSON, but reads a published
`basemap-hide-ids.json` sidecar (`collectEncodedBasemapHideIds`, built by
`npm run build:basemap-hide-ids` and wired into `refresh-city-extract.sh`) so
the filter can land without re-encoding every osmId on the main thread.
`check-canal-buildings` pins the sidecar against the extract when present.

## Every roof in the city stops z-fighting its own lid

Roofs across the streamed LoD1 city shimmered light/mauve at driving distance
even though the basemap copy was hidden and compositions were deduped. A live
probe explained it: `osm-colored-building-roofs` had **no filter** and was
drawing a `#B09999` fallback lid on 2,284 of 2,633 visible buildings, 0.15 m
above their own wall tops. The cap layer's `flatRoofFilter()` and the
signature-model suppression were each written with a bare `setFilter`, and
the suppression pass — which runs on every extract load, usually with nothing
to hide — ran last and replaced the roof filter with `null`. Both layers now
go through `coloredBuildingLayerFilter(base, hideOsmIds)` in
`buildingStyle.ts`, so the cap filter survives every refresh; the same view
now draws 7 lids, all with a real `roofColour`. The suppression clause also
matches `id` as well as `osmId`, because streamed tiles carry OSM-owned
features under `id`. `check-canal-buildings.ts` pins the composition.

## Map Quest start hierarchy + Canal setup density

Map Quest start: the rail owns the job — plaque, then Canals/Streets as the
primary action, demoted Also chips, mode as a footer control. Header on start
is menu-only (no duplicate brand, filters, score, or toast). Canal setup:
account row always present as a single compact line (no login bounce), Reset
knowledge moved under More options, and Start route pinned below a scrolling
middle so it stays on screen.

## Storybook: fallback postcard, stacked notices, bike finish

Item 14 gap fill: `neighborhood-fallback` (typography-only postcard),
`stacked-notices` (+ phone), `landmark-card-bare`, and `finish-bike` so the
workbench can review the states that used to need a lucky drive. Screenshot
regressions for them are still open on the TODO.

## Map Quest: enamel the remaining quiz chrome

Game over, loading, auth, settings, and the locate FAB leave the pre-enamel
slate/amber/emerald accents for the same navy plates and rivet gold as the
start rail and header. Quiz overlay secondary type is floored at `text-xs`.

## Map Quest: plaque start, phone brand, distilled play header

Critique P1+P2 for `src/App.tsx`: start is now a riveted Map Recall plaque rail
over the CC0 Reguliersgracht vista (Canals/Streets elevated, other layers
demoted); phone always shows the brand and mode pills (Pin/Name/Area) and keeps
city/radius/category chips out of the narrow header (drawer only); filters
collapse once a round is active (`roundActive`); Wiki renamed Encyclopedia;
mode gloss on start and in the drawer; Hint always labeled; secondary type
floored at 12px (`text-xs`). Shared `.enamel-plaque.enamel-framed` lives in
`src/index.css`. The Canal Recall float stays off the start rail so it does not
collide with “Or make me a mixed quiz”; the overflow drawer drops the remaining
slate chips for enamel surfaces.

## Street name at junctions uses heading, not nearest centreline

The HUD plaque and route quiz called `getRoadName(x, y)` without the player's
angle. `pickRoadContact` already prefers heading-aligned roads at junctions
(so you are not taught the cross street), but the name path never passed the
angle — so at Hasebroekstraat / Kinkerbuurt junctions the plaque and any
follow-on street knowledge card could name the side street underfoot. Callers
that name or quiz the road under the wheels now pass `player.angle`.

The rule was tested and the wiring was not, which is how it went unnoticed.
`check-road-name-heading.ts` (`npm run test:road-name-heading`, in
`check:canal`) now pins both halves: `_updateCanalQuiz` on a real
`roadSurface` junction, player 4 px toward Hasebroekstraat while heading along
Kinkerstraat, must make Kinkerstraat the candidate; and every
`getRoadName`/`getNearestRoad` call in the game runtimes must carry a third
argument. The one call with no heading to give — deriving the start heading
in `_setupRace` — passes an explicit `null` so the check reads as intent.

## Driving HUD: navy plates, one plaque, arrow inside the destination

The enamel pass put cobalt cards over a basemap that is mostly water, which
read as blue-on-blue, and it kept the old five-piece arrangement — a "RECALL"
score card, a "STREET" name card, a destination card, a separate finish-arrow
box that repeated the same "955 m", and a bottom trip pill on desktop — each
with a tiny kicker label. `hudSurface` is now a deep navy plate
(`rgba(7,20,48,.84)`, white hairline) with white type and gold as the only
accent; cobalt is kept for surfaces you stop at (setup, prompt, panels, the
arrival card). `hud.drawPlaque` replaces `drawCanalScore` +
`drawCurrentLocation`: street name in Barlow Condensed caps as the headline,
then neighbourhood + speed/odometer on one line, then score (streak in gold),
then feedback. It sizes itself to its text and is anchored at the layout's
`recall` slot, capped at the bottom of the `location` slot, so the layout
module and its 864 pinned scenarios did not change. `drawDestination` takes
the finish heading and draws the copper arrow inside the card;
`drawFinishDirection` and `drawTripReadout` are gone (`finishDirection`
returns the angle). The portrait compass no longer reserves 68 px for the
arrow box. The desktop controls hint gets a plate instead of bare 10 px text
over white streets. Landmark-card badges and the postcard went from dark ink
on cream tints to light ink on the plate.

## Map Quest quiz cards: no per-type pastel chips, no faded disabled button

The pinpoint and name-guess cards still carried their pre-enamel palette:
per-type feature chips (`text-sky-700` on cobalt for canals, `indigo-800` for
landmarks), slate round badges, a blue "reveal hint" link, dark-ink Wikipedia
facts, an emerald Street View link, and a disabled Confirm at 45 % white on
`white/12` — all low contrast on the blue card. The chip is now one
`enamel-chip` for every kind with the glyph in gold (the word already says
which kind it is); hint, round counter, answer tiles and result badges use
the same component classes; `.button-primary:disabled` is a dashed ghost with
a full-contrast label so "not yet" does not read as "greyed out".

## Map Quest: real enamel classes instead of an override layer

The first pass restyled the React quiz by stacking `!important` attribute
selectors over Tailwind's slate classes. It caught `slate-*` and nothing else,
so the start dialog shipped stone-800 text on cobalt, an orphan green icon,
and — because every `bg-blue-600` was remapped to copper — an orange Pinpoint
tab beside a green speaker. Replaced with a small set of plain component
classes in `src/index.css` (`enamel-chip`, `enamel-tile`, `enamel-segment`,
`enamel-float`, `app-dialog`) that win over `@layer utilities` without
`!important`; header, start dialog, toast, loading modal and round-complete
header now use them directly. Copper is reserved for `.button-primary`.
Component classes must not set `display`, or Tailwind's `hidden`/`lg:flex`
responsive switches stop working (the mode switcher leaked onto the phone
header until `.enamel-segment` dropped its `display: flex`).

## Quieter enamel: plaques, not arcade rivets

First enamel pass put gold frames and corner rivets on every choice tile, and
left the neon canvas attract menu drawing through the setup vista — two UIs at
once. Rivets and white rim stay on the title plaque and Start stamp only;
options are flat cobalt tiles. Setup open silences the canvas menu and shows
the CC0 canal photo as the vista.

## Enamel street plaque is the product chrome

Paper-moss cream cards were reading as a different product from the city the
player is learning. The chrome is now cobalt enamel street plaques end-to-end:
route setup rail, settings/help panels, utility FABs, translucent canvas HUD
fills (`hudTheme` / `hudSurface`), and the arrival card’s white-on-enamel type.
Map Quest header, dialogs, and map reveal labels share the same tokens so the
two surfaces stop fighting. Plaque borders and rivets are CSS, not AI rasters;
Storybook’s setup vista uses a CC0 Reguliersgracht photograph
(`assets/media/setup-backdrop.jpg`) when the live map is not present. Brand
copy on the quiz shell is **Map Recall**; “Map Quest” remains only as the
historical quiz-mode nickname in older notes.

## The gate was red, and had stopped covering enough to notice

`npm run check:canal` is the pre-integration gate, and it could not pass on
`main` at 9c087b4 — before the façade lane merged, and for reasons unrelated to
it. Two failures, and the interesting part is the third thing, which is why
neither was noticed.

`lint` failed on two interface gaps the implementations had already grown past:
`RecallStore` never declared `clearKnowledge` although `recallStore.ts`
implements it, and `_factRotation` sat on `LandmarkHost` but not on `RecallHost`
— the half that clears it when a player resets their knowledge. Both are the
ordinary drift of a runtime split across declaration-merged host interfaces.

`check-game-decomposition.mjs` reported a dependency-order bug in correct
markup. It asserted order by `index.indexOf('src="js/overlay.bundle.js"')`, and
three script tags have since grown a cache-busting `?v=` suffix. The exact
attribute no longer occurs, so `indexOf` returned **-1**, and -1 compares as
*earlier than everything* rather than as absent. A missing file and a
first-in-the-file script are the same value to that comparison, which is the
whole failure: the check had two distinct conditions collapsed into one number.
It matches the path with an optional query now and asserts presence separately,
so a genuinely missing tag cannot hide in the silence the old form left.

The reason a red gate could sit on `main` is that the gate had quietly stopped
being the gate. Fifteen of 62 `test:` scripts were outside it — including
`test:recall-clear`, which pins exactly the `clearKnowledge` contract `lint` was
failing on. A guard that exists but never runs is worse than a missing one,
because the board reads as covered. Eleven fast offline checks are in it now, and
the three that stay out are named with their reason: two need Playwright and a
served page, one checks a staging build the pipeline produces rather than
anything committed.

One entry was removed rather than added. `test:signature-landmarks` pointed at a
script that has never existed in any branch, so the gate had been *reporting* a
check nobody wrote. TODO item 22 already wanted that check, and still does.

## Amsterdam façade twin: reading façades out of the city's own panoramas

Amsterdam publishes its street-level panoramas under CC BY 4.0, which is what
makes measurement possible at all — the brief forbids shipping third-party
imagery, and an openly licensed municipal source is one a derived measurement
can cite. Coverage was computed first, from published camera poses and before
downloading a single image, because whether a wall can be measured is decided by
where the camera stood rather than by what the pixels contain: 139,937 poses,
17,251 elevations, 26.5% of elevations frontal, **88.6% of buildings with a
frontal view of at least one elevation**, and 86.7% of those leaf-off. The 70%
of elevations never seen are party walls and courtyard returns no street camera
can reach, which is the shape the brief predicted.

**The heading convention nearly took me, and the way it nearly took me is the
lesson.** Publishers differ over whether a panorama's `heading` sits at the
image centre or at column zero, and the two differ by exactly 180°. I rendered
one, saw an upright and wholly convincing canal frontage, and accepted it — it
was the building behind the camera. In a city where every direction looks like a
canal, "the output looks right" is not a calibration. Settling it took a
prediction checked against geometry known independently: slice one panorama into
eight 45° bands, ask which band holds a wall already measured at 4.2 m, and
compare against what each convention predicts. It fell at u≈0.3; `centre`
predicts 0.305 and `edge` 0.805.

**Registration has no systematic error, and that is a different claim from
verified.** The first check correlated several views of one wall against each
other and failed at 2.9 m — wrong instrument, because views 20 and 80 m from a
façade differ in resolution, exposure, season and which parked cars obscure
what. The second correlated vertical-edge density against BAG's plot boundaries
and also failed, for a subtler reason: a canal façade's strongest vertical edges
are window jambs repeating every metre or two, and a quasi-periodic signal
correlates almost equally at many shifts, so the peak lands at random. The
roofline is the right signal because it is *aperiodic* — an Amsterdam terrace is
narrow plots built to different heights, so its skyline is a staircase stepping
at every party wall. Two sky-detector bugs came out of that, both producing
confident nonsense: testing "close to median sky brightness" makes a white cloud
read as building and plants a roofline halfway up the sky, and taking the median
of the top band fails when a taller building behind fills part of it. Median
disagreement fell 2.92 → 1.04 m, and the number that matters is the signed mean:
**−0.13 m**. A constant misregistration biases every building the same way.
Nothing like that is present. The check nonetheless stays red at its 0.5 m bar,
because "no detectable bias" is not "verified to half a metre" and measurement
should not start on the weaker claim.

**Every time I reached for a heuristic about building geometry, the register
already held the answer.** Three in a row picked the wrong wall as a building's
front — longest, most-viewed, best-quality — each landing on a party wall
running back into the block or a corner return. A canal house's front is the
*short* side of its plot, and BAG gives that exactly as the short side of the
footprint's minimum-area rectangle. Constraining candidates to within 35% of it
fixed the selection outright.

**But the grammar is real, and refusing to use it was its own mistake.** After
those three failures I had talked myself out of heuristics entirely, and the
opening detector stalled at nought to three windows on houses with ten. The
brief draws the line precisely: the canal ring's grammar is useful as a
*rendering vocabulary*, never as a source of facts — it tells you how to draw a
klokgevel once you know this house has one, and must never tell you that it has
one. Using "windows line up in bays and storeys" to decide where in this image to
look is still measuring this building's own photograph. Two changes followed. An
opening is not *dark*, it is *not the wall*: on these façades a window is as
often brighter than its brick as darker, because white frames, net curtains and
sky reflections all read lighter while an unlit room reads darker. And storeys
are a *ladder* rather than independent bands, because a shadowed band otherwise
goes missing and nothing notices — bands found separately came out eleven metres
apart.

**The demo script was where the discipline quietly stopped applying.** Its first
version wrote its own `{ value, source }` shape instead of the record schema,
with source names not in `FacadeSource` and no confidence, observation or date,
so none of the evidence machinery could run on it — and it carried a fourth copy
of the gable regex, throwing away the rear-clause handling `heritageText.ts`
already does. Routed properly through `buildRecordFromRecon` →
`applyHeritageEvidence` → `applyStreetLevelEvidence` → `auditHouse`, the audit
immediately found 281 violations in data the forked shape had reported as clean.
Two were real: street-level fields carried a full ISO timestamp where the ledger
dates observations by day, and `storeyHeights` was being set to the *gaps
between* window bands, so n bands gave n−1 values where the record wants one per
storey. Padding to length would have invented the top storey's height, which is
what the length check exists to catch.

Two guesses were removed in the same pass. Roof material had been
`bouwjaar < 1850 ? pantile : slate` under a source label that made it look
measured — a prior supplying a value, and its fallback read the 215 unknown-year
buildings as medieval. It is `default` now until RECON-5 measures it. Heights
were being invented with `?? 1` and `?? ground + 12`; `resolveHeights` decides
instead, and caught the eight buildings whose modelled ridge sits below their own
measured roof height.

Everything the opening detector produces is capped at confidence 0.4, below any
auto-accept. That is the measured position rather than modesty: the storey
ladder returns six storeys for 32 of 56 buildings on a street that is mostly
three or four plus an attic, and the wall-colour sampler's percentile was tuned
by moving it until fewer buildings came out black — which is fitting to an
expectation about the answer, not validating against one.

## Amsterdam façade twin, M0: measure first, and let the measurements argue back

The build prompt in `AMSTERDAM_FACADE_TWIN.md` is emphatic that ground truth is
measured rather than guessed, and that its own estimates are not to be carried
into a schedule. Taking that literally turned out to be the whole value of M0:
three of the brief's working assumptions did not survive contact with the data,
and each one would have been expensive to discover later.

**The coordinate system had a constant lie in it.** The standard
Schreutelkamp / Strang van Hees polynomials sit 0.183 m east and 0.234 m north
off PDOK's own published WGS84 — measured over 24 Locatieserver RD/LL pairs from
Kerkrade to Groningen, and constant to within a centimetre nationally. A
constant that stable over 300 km is a datum offset, not approximation noise, so
it is subtracted as a measured constant rather than absorbed into a tolerance. A
second session measured the same offset independently, against a different
endpoint and a different point set, and got 0.184 / 0.233 — one millimetre
apart. Residual after correction is 1.4 mm worst inside the pilot, which is a
hundredth of the 12.5 cm orthophoto pixel everything downstream measures from.
Two tolerances are pinned rather than one, because once the datum offset is
removed the remaining residual is a polynomial fit centred near Amersfoort:
small mid-country, larger at the coasts. Demanding pilot precision in Vlissingen
would be pinning noise.

**The boundary is not a box, and it is not the shape the brief describes.** It
follows canal centrelines, because the ring curves continuously and a chord
between corner junctions cuts off the outside of every bend. Each leg is pushed
outward by its own documented distance to reach the far bank — 42 m on
Brouwersgracht, 45 m on the main grachten, 95 m on Prinsengracht to take the
first Jordaan row, that last figure set from measured perpendiculars rather than
chosen. Two facts the four-canal description does not cover: Singel never
reaches Leidsegracht, so Herengracht carries the south-east corner; and the
district is 0.95 km × 1.77 km, not the estimated 1.1 × 0.7 — the brief's
north–south run was roughly half the real one.

**Membership is footprint intersection, and it matters which rule you test.**
Singel 411's BAG address point sits 79 m from the Singel centreline, outside any
sane offset, while its footprint plainly crosses the boundary. Address points
sit deep inside blocks. A check written against them would have passed 35 of 36
named locations while quietly dropping far-bank buildings — so that exact case
is pinned as the one that distinguishes the two rules. An offset ring also
self-intersects wherever the offset exceeds the local radius of curvature; one
such loop at a kink in Singel is excised, because left in it inverts
inside/outside for every building near it.

**The pilot is 3,025 buildings, not "roughly two thousand".** Median plot width
is 5.66 m, which is the canal-house grammar showing up in the data unprompted.
215 of them carry BAG's `1005` sentinel and have no known construction year, so
they must not be routed as though they were medieval.

**3DBAG gives good massing and an untrustworthy gable.** Its own reconstruction
error is 0.59 m median across the pilot, and the tempting move — threshold at
0.5 m, promote what passes — keeps only 39% of the boundary. But the same number
split by roof type is 0.11 m on flat roofs against 0.60 m on pitched, and it is
flat across plot width and across century. So it measures roof *complexity*, not
reconstruction failure: dormers, chimneys, ridges and stepped gables are real
geometry that LoD2.2 planes do not represent, and the point cloud reports the
difference honestly. A global gate would reject buildings for being interesting,
which is exactly backwards for a project about gables. Footprints, walls,
storeys and eaves heights stand; the gable top has to be observed.

**The monument register is real, hidden, and narrower than hoped.** Every
endpoint one would reach for is a 404 — `api.pdok.nl/rce/rijksmonumenten/*`, the
PDOK WFS, the atom index. It actually lives in two places that must be joined:
geometry at `services.rce.geovoorziening.nl/rce/wfs`
(`rce:NationalListedMonumentPoints`) and the *redengevende omschrijving* text at
the RCE linked-data SPARQL endpoint under `ceo:heeftOmschrijving`. Inside the
boundary that is 1,764 monuments, 1,568 with text — but only 989 distinct panden,
because one house can carry several records and 15% of monument points miss every
footprint. The text names a specific gable type for 70% of described monuments,
and that is close to all it reliably gives: bay count 3%, storey count 1%,
median length 88 characters. So it is a 23%-coverage gable-type source — a real
head start on the hardest field — and not the general façade-attribute source
the brief hoped for. Bays, storeys and window arrangement must come from imagery.

Two API behaviours are written down so nobody rediscovers them: the 3DBAG API
takes an RD bbox and returns zero features rather than an error for a WGS84 one,
and its offsets are 1-based, so `offset=0` is an HTTP 500 and paging must follow
the server's own `next` link.

## LoD1 city republished from the polished pipeline

`build:lod1-city` → `build:lod1-tiles` → `publish:lod1-city --confirm` after
the post-publish polish. Versioned extract is now 342,993 features / 295 z14
gzipped tiles (~15.4 MB). Named checks green (Waag 15, Magna Plaza 18, Oude
Kerk 43, 145 ridge-tower). 574 measured BAG extrusions keep OSM courtyard
holes (Droogbak is a real Polygon with four inner rings, not a stopgap tile
edit). Magna Plaza check pin moved to the part-cluster centre so the 18
stand-ins fall inside the 60 m radius. Stopgap Centraal/Droogbak tile edits
are replaced by pipeline output.

## Post-publish LoD1 polish (review batch)

Systemic pipeline/runtime fixes after the first city publish (now folded into
the republished extract above):

- **Oude Kerk lids** — walls full-height for shaped roofs; flat colour lids only
  for flat/untagged shapes (`buildingStyle`).
- **Paint drift** — `buildingPaintInherit` copies colour from the smallest
  containing coloured footprint when part ids are missing from
  `buildings-colored.geojson`; wired into `build-lod1-city`.
- **Centraal orphans** — builder marks nearby same-height `building:part`s
  represented so they are not re-emitted as tier 4.
- **Droogbak courtyard** — `polygonsOf` / hole-aware `asGeometry`; tier 3 uses
  OSM footprint when it still has holes.

## Complete LoD1 city published as gzipped z14 tiles

Byte strategy decided: ship `.geojson.gz` (~16 MB, 298 tiles) in the versioned
Amsterdam extract, not 113 MB of raw GeoJSON. The streamer decompresses with
`DecompressionStream` (and still works if the host already decoded Content-Encoding),
feeds the same working set to procedural pyramidal roofs, and hides Liberty
`building-3d` once the first tile lands. Tiles keep `roofHeight` so Waag eaves
still stop under the cones. The compare page at `/canal-drive/building-compare.html`
now reads the published extract and draws the same cones. Publish is
`npm run publish:lod1-city -- --confirm` from staging.

## One owner per building composition — LoD1 blockers cleared

The comparison page's two real losses are fixed on `feat/building-one-owner`.

**Hand-mapped massing survives without colour tags.** The ladder no longer reads
only `buildings-colored.geojson`. A complete OSM extract
(`staging/buildings-osm.geojson`, 422,570 buildings / 5,485 parts) feeds
geometry; appearance joins by id afterward. Tier 2 now fires for stacked parts
*or* multi-height compositions (Magna Plaza / Oude Kerk), and
`compositionDrawIds` drops the parent outline so parts own the pixels alone.
Named checks: Waag keeps its turrets, Magna Plaza keeps ≥8 OSM parts, Oude Kerk
keeps a multi-height massing. Staged merge: 20,039 OSM parts standing in for
8,703 panden (was 1,163 / 164).

**Towers stop measuring as their podiums.** When the AHN ridge sits ≥10 m above
the LoD1.2 height, extrusion uses `ridge-tower` instead of `roof-70p` /
volume. Rebuild reports 201 such panden in the BAG table; 130 remain as BAG
extrusions after OSM compositions claim the rest. Zuidas is the visual fixture.

**Live overlay stops fighting before publish.** `dedupeAppearanceFeatures` runs
when the coloured extract loads, so Oude Kerk / Waag no longer draw shell and
parts together on today's three-extrusion stack. Publishing the staged z14
tiles (16 MB gzipped) remains the step-2 decision.

**Waag's pyramidal roofs actually draw.** osmbuildings.org's Waag is seven
`roof:shape=pyramidal` parts with `roof:height`. A fill-extrusion cannot slope,
so walls now stop at the eaves and a small Three.js custom layer draws the
cones. `roof:height` is kept in the appearance extract (1,035 features). Flat
roof caps skip those parts so the grey lid does not fight the mesh. The first
mesh pass packed height on Z, the second on Three Y-up with `rotateX(π/2)`.
Both sheared the fan toward the mercator origin, then `rotateX(π/2)` (the GLTF
convention) stood the remaining cones on edge through the turrets. Vertices are
east/north/up metres, placed with translate × scale(s,-s,s) like the photoreal
layer — no extra rotation. A third bug put the apex ~5 m off-centre: shoelace
on raw Amsterdam lng/lat (area ~1e-8) is numerically unstable, so a regular
11 m turret got radii of 1–10 m and the fan looked like a shard. `ringCentroid`
now translates to the first vertex before the area sum; Waag radii stay ~5.5 m.

**Oude Kerk stops fighting its own roof lids.** Gabled parts carry `roof:height`
too; walls used to extrude to the ridge while a blue cap sat in the same plane —
brown/blue shimmer. Walls now stop at the eaves for any tagged roof thickness,
same-colour lids are skipped, and untagged `roof:shape=pyramidal` (the 58 m
spire) invents a tip so OSM Buildings' cone is not a grey cylinder.
## Street-mode routing includes bikeable ways

Street mode presents as cycling but `streets-routing.json` was built from a
car-only highway list. Pedestrian corridors and cycleways the basemap still
draws — Zeedijk, Nieuwendijk, most of the separated cycle network — never
entered the graph, so the router refused streets a bike can use. Routing now
keeps the car set and adds `cycleway`, `pedestrian` unless `bicycle=no` /
`dismount`, and `footway`/`path` only with an explicit bicycle yes. Kalverstraat
(`bicycle=no`) stays out. Amsterdam routing grew 35,216 → 47,245 ways
(~2.9 MB gzipped); `check-city-extract` pins Zeedijk in and Kalverstraat out.

## Help panel scrolls instead of overflowing

The `?` shortcuts card was centred with no max-height on desktop, so on a
typical laptop height the title clipped off the top and Close fell off the
bottom. Utility cards now cap at `86dvh`, scroll their body, and keep Close
pinned under the list.

## Account and knowledge reset sit on the briefing

The route card buried sign-in under Advanced and had no way to start over.
Account status is now a top-of-card row with **Sign in / Sign out** and
**Reset knowledge…**, which confirms then clears local (and cloud, when signed
in) spaced-repetition memory. Preferences stay. Cache-busted overlay/recall
bundles so the icon-row briefing is not stuck behind an old `overlay.bundle.js`.

## Briefing uses icon rows; compass sits under destination

The route card’s four dropdowns became icon choice rows (travel, view, route,
difficulty) so the first decisions are tappable rather than menu-hunting.
Advanced options stay collapsed. The north rose moved from above the city
overview to under the destination card on the right, beside the finish arrow.

## On-demand street Wikipedia fills extract gaps

~~Curated `streets.json` only keeps 300 streets…~~ **Superseded:** live
Wikipedia resolution was removed. Title discovery and English translation run
offline in `enrich:amsterdam-wikipedia` / `enrich:english`; see the newer
HISTORY entry above.

## Bottom chrome is just a faint map credit

The old white `#prototype-links` pill (Map Recall back-link, Smokey’s GPL line,
full OSM/CARTO prose) sat on the driving corridor. Driving now keeps a
9 px `© OSM · CARTO` line with no card; Smokey’s and the Map Recall link live
under **?** so GPL credit stays reachable without a permanent footer.

## HUD has a north compass

An always-on moss rose sits in the layout band (above the city overview on
desktop; under the top stack on a phone, clear of the finish arrow). It tracks
`camera.rotation` so heading-up and chase views still show true north. Separate
from the terracotta destination assist — orientation cue, not a route hint.

## Map Tiles API key is no longer committed

The Google photoreal option used to ship a browser key inside
`google-tiles-source.js` / `google-tiles.bundle.js`. It now loads
`google-tiles-config.json` at runtime (gitignored), written by
`npm run canal:google-tiles-config` from `VITE_GOOGLE_MAP_TILES_API_KEY`.
Without that file the option fails closed and keeps 3DBAG. The leaked key
(`Canal Recall 3D tiles spike` in project `map-cms-amsterdam-v1`) was
rotated via `gcloud services api-keys`: create a referrer-restricted
replacement (`Canal Recall Map Tiles`, `tile.googleapis.com` only), write
local config, then soft-delete the old key. Git history still contains the
old string; the Cloud credential no longer accepts it.

## Trivia Lab can label and export a review file

The lab’s Human review view approves or rejects features, strikes individual
sentences, attaches notes, keeps a browser draft, and downloads a
version-matched `facts-review*.json` for `facts:publish`. The stratified audit
of the published v10 catalog remains TODO 16.

## React overlay owns the briefing and live settings (item 8c)

The route setup card, advanced options, account row and in-game settings panel
are a React tree mounted on `#canal-overlay-root`, bound to
`CanalPreferences` via `overlay/store.ts`. The Game reads that store instead of
`getElementById` for travel mode, assists and zoom. Canvas HUD, quiz prompt,
help and the landmark article stay vanilla. React is not in the frame loop;
`flushSync` is only used so the first paint exists before the Game constructor
wires callbacks.

## Typed preferences object (item 8c foundation)

`canalRecall.preferences.v1` is parsed and written by
`src/canalRecall/game/preferences.ts` (`CanalRecallPreferences`): difficulty
presets, mode unions via `parseMode`, zoom `0.65`→`0.50` migration, and
boolean defaults live in one place. Load uses `parsePreferences` (preset then
overlay); save uses `coercePreferences` so a live form snapshot is not rewritten
by the difficulty preset. Skip-mastered is staged until the recall store binds,
so a saved “ask everything” is no longer lost to the HTML default. The React
settings overlay is still TODO 8c.

## Separated cycle tracks earn a bounded answer bonus

Street-mode answers on OSM ways tagged with a physically separated cycle track
(`cycleway=track`, side-specific tracks, or kerb-segregated lanes) take a 1.1×
score multiplier — below novelty, never a routing weight, so it does not pull
players onto longer detours. Painted `cycleway=lane` alone does not qualify.

## Three.js is shared; Firebase is code-split (item 9)

Measured on close-out: `three.bundle.js` is the only Three copy (783 KB);
`player-vehicles.bundle.js` is 5 KB and `detailed-buildings.bundle.js` is
136 KB, both via the `CanalRecallThree` shim. The recall store ships as a 6 KB
ESM entry with Firebase in separate chunks loaded from `init()` when
`firebase-config.json` is present (session restore still needs Auth). Guests
no longer download an inlined 750 KB IIFE of Firestore with the game scripts.
Unifying Canal Recall’s store with the React app’s `progressRepository` is a
separate follow-up, not this item.

## One teaching surface at a time

A single frame could show a waterway quiz, stale “Not quite — …” feedback, a
museum card, dense POI labels, and a duplicated trip readout. `teachingSurface.ts`
now gates the bottom band: quiz / answer-hold / utility own it; landmark and
neighbourhood cards wait. Opening a question clears cards and feedback; feedback
clears when the hold ends. Desktop trip lives only in the bottom pill. POI name
labels hide while a prompt is up; the city overview stays (it has no names).
The quiz card is tighter (360px) so more of the canal stays visible.

## Postcard text no longer sits under the photo fade

The neighbourhood card measured text at `x+158` while drawing a 144 px photo
and a navy fade out to `x+170` — leftover from the dark-card era — so names
like Weesperbuurt started inside the image. Text now clears the photo, and the
fade blends into cream paper inside the photo edge. Locator-map Wikipedia
thumbnails (`Map_NL_-_Amsterdam_-…`) are rejected as non-photos so a parent
district photograph can be borrowed; Weesperbuurt’s page image was exactly that
kind of map.

## Canal sloop paint, not bare aluminium

The Meshy boat GLB still has no materials — one mesh, one primitive — so colour
has always been applied on load. The old flat `#b8c0c6` aluminium made it read
as an unfinished placeholder from chase view. Height-based vertex colours now
paint a classic Amsterdam rental sloep: dark green hull, cream seats, pale
gunwale, with low metalness so it looks painted fibreglass rather than metal.
The canvas 2D fallback matches. A multi-material swap still wants a new GLB.

## Photoreal follows game zoom, not a fake cycling height

The 25 m gate never bound: MapLibre altitude at play zoom is 95–520 m, so
ticking the option always drew Google's mesh. The spike's metres were a free
camera above the quay. The live gate now reads `camera.zoom` — default 0.50
and anything street-ward stays on 3DBAG; zooming out through 0.32 turns the
mesh on, and zooming back in past 0.38 hands the city back, with the same
hysteresis idea as before. Named check: play zoom requests no Google tiles.

## Street encyclopedia on known streets, still silent on novel ones

Cards still must not name a street that is under question. They now also open
when a Wikipedia-linked street or water is adopted silently (already known),
once per drive, and still after a quiz answer. An open landmark card blocks
the silent-adopt path so the bottom band does not stack.

## Street encyclopedia is no longer just Nes

`street-knowledge.json` had one street. `streets.json` already carried
Wikipedia URLs for 30 of 300 streets, but `enrich-amsterdam-wikimedia.ts`
threw away Dutch intros, so 21 of those were a link with no card text.
The Wikipedia extract pass now includes streets, water, squares and parks;
Dutch ledes are kept and tagged, then translated. Amsterdam ships 48 street
and 98 water encyclopedia records with English blurbs. When those cards open
is the later note above.

## Basemap duplicates near the extract are hidden by proximity too

The id filter that stops `building-3d` redrawing coloured-extract buildings cut
co-located pairs in the centre from 145 to 47, then stopped: the remaining 47
are the same footprints under different OSM ids in the two pipelines, which is
what still striped roofs around the Shipping House and along the Singel. The
runtime now builds a centroid grid of the extract and, as OpenFreeMap tiles
load, hides any basemap building whose ring centroid sits within 3 m of an
extract building — the same tolerance the earlier audit used. Ring-by-ring
matters because a tile feature can batch many footprints; a single feature
centroid would miss the overlap. Signature landmark GLBs stay demo-only after
a playtest found thirteen meshopt models too slow and Centraal still carrying
its SketchUp ground plane.

## Desktop fills the window instead of letterboxing 16:9

The phone portrait work correctly filled touch screens, but left desktop on the
historic fixed 1280×720 letterbox. A tall browser window therefore still showed
a landscape strip floating in paper white — the same failure mode phones used
to have, just without the compact HUD. `viewport.ts` now expands the desktop
logical space to the window aspect (keeping 1280×720 density on the constrained
axis, so a true 16:9 window is unchanged), and both the canvas and MapLibre
layer pin to the viewport on every layout mode. Named regression: a 900×1200
desktop window fills 900×1200 CSS with a 1280×1707 logical space.

The follow-up: filling the window then pinned every HUD card to the far edges
of an ultrawide, and compact mode had been clamping logical width to 900 while
CSS-stretching the canvas to `100%`, so cards also blew sideways. `hudBand`
now caps chrome at the design width (1280 desktop / 900 compact) and centres
that band; the map stays full-bleed, the cards stay dense beside the corridor.

## Thirteen landmarks are real buildings now

The city was OSM footprints extruded to an OSM height: honest about where every
building is, silent about what any of them looks like. Nothing on the Dam said
"Amsterdam". Thirteen buildings are now drawn from real models — nine of the
City of Amsterdam's own survey models and four community ones, all from
3D Warehouse.

**The municipal models are artefacts of Google Earth.** All eleven were uploaded
on 2007-05-08, the same day, by the city's Geo- en Vastgoedinformatie
department, for Google's Earth 3D-buildings programme back when Google owned
SketchUp. That origin is why each is built on a Google Earth snapshot the export
still carries, and why there are only eleven: it is what one department
hand-modelled in 2007. Google sold SketchUp to Trimble in 2012, which is why
they now sit under Trimble's General Model License.

**A surveyed model is placed, not fitted.** These arrive life-size, with their
origin at a published coordinate, and north-up by SketchUp convention. Fitting
one to a footprint discards better information than the fit can recover and
actively makes it worse: the Palace's bounding box is 85.1 × 73.1 m against a
80.98 × 65.49 m OSM ring, because the survey includes entrance steps and roof
overhang the wall line excludes, so fitting would shrink the building 6% to
squeeze its overhangs inside its walls. Scale is exactly 1. The city's
coordinate and a rectangle fitted independently to the OSM ring agree to within
15 m.

The first Palace was an AI reconstruction and is what taught this. It was 24.5 m
deep against a 65.5 m footprint — faithful in its street frontage, guessed in
its bulk, because photo-derived models see a facade honestly and invent the
depth. From behind you could see straight into its hollow back.

**Height is measured, not looked up.** Dutch Wikipedia and Wikidata both give
the Palace 90 m; the survey names its parts, and `PD-natsteen`, the main stone
mass, tops out at 51.9 m while `PD-haantje` — the rooster on the vane — reaches
60.9 m. The 90 m is almost certainly the 80 m facade width mis-entered and
copied between them. A height outside its stated tolerance is now a hard build
failure, because an over-eager cleanup rule once deleted the Palace's roof and
shortened it to 56.6 m, and a warning in a nine-model loop scrolls straight past.

**Four export defects, none of them what they looked like.** SketchUp writes
construction edges as LINE primitives — on Centraal an `Edge` node spanning
3.3 km, which drew as hairlines and made the model measure 136 m wide. Faces
arrive inward-wound and render black; every material is now double-sided. Every
material also arrives at `metallicFactor 1.0`, glTF's default when an exporter
omits the field rather than anyone's choice, and a fully metallic surface with
no environment map reflects nothing and renders black — that, not the winding,
was the actual black cut-out. And each model is traced over a Google Earth
snapshot that ships inside it: a photo plane 700 m across on Centraal, a terrain
patch 239 × 201 m under the Rijksmuseum. Flatness is the wrong test for those
and density is the right one — ground covers a couple of hundred metres with
eight triangles where the Rijksmuseum's own roof spends 1,702.

**Suppression: I was wrong about what was possible.** I concluded the basemap's
extrusions could not be filtered — the tiles batch buildings, one feature on the
Dam carries 498 rings, and no OSM id appears in the properties. The id is in the
vector-tile *feature id*, as `osmId * 10 + type`, which is what
`basemapBuildingFilter` already matches on. The layer now uses it, and keeps a
polygon offset for the remainder no id can pair up.

**Anything under 250 triangles is rejected.** Community uploads vary: the
"Bimhuis" cleans up to 12 triangles and the Film Academy to 60, which on the map
is a bare grey slab across the street — worse than the extrusion it replaces,
because at least the extrusion is building-shaped.

Models are matched to landmarks by distance from their published coordinate, not
by name. The vocabularies disagree in both directions — the extract says "Royal
Palace" where the city says "Palace on the Dam", and "Stadhuis" is a different
building from the palace that used to be the city hall — and searching "Anne
Frank House" returns the Westerkerk, which is next door and a different
building. Searching in Dutch roughly doubles the hit rate, because nobody
uploads a model under a translated name.

The licence is unresolved and is recorded in `NOTICE.md` and TODO item 22.


- **The façade pilot was aimed at the road, and the API's own conventions say
  why.** With a gate keeping only real buildings, `w274039950` — 134 m² and
  17.7 m, the one genuine building in the pilot — still came back as a parked
  car and one storey of windows, and `roofline` abstained because the roof was
  out of frame. The fixed request was `fov=70, horizon=0.34`, and two measured
  facts break it. `horizon` is the horizon line's height as a fraction from the
  *bottom* of the frame, so it aims **down** as it grows and `0.34` spent a
  third of the crop on tarmac; at `horizon=0` the API returns pure sky. And the
  distance that decides framing is the distance to the nearest façade, not to
  the footprint centroid — a 670 m² block's centroid is 22 m from the camera
  while its wall is 6 m away, so a centroid-derived field of view is far too
  narrow. `planFacadeCrop` now derives `fov` and `horizon` from the target's
  measured height and `metresToNearestFootprintPoint`, keeps the ground edge
  fixed and spends the rest of the lens going up, and gives short buildings a
  tighter crop so their pixels land on the façade instead of on the street.
  Framing that physically cannot fit — an 18 m façade seen from 6 m — is
  reported as `fullFacadeVisible: false` rather than silently truncated, because
  a truncated crop is exactly what made `roofline` abstain without saying so.
  `aspect` stays fixed at 1.6 and is the next thing to measure: it is why a tall
  near façade still clamps at `fov=100`.

- **Five of the six façade pilot targets were not buildings.** Measuring
  cross-model agreement raised the question the agreement numbers could not
  answer — were the two models looking at the same building? For five of six
  targets there was no target building to look at. `w1475011497` covers **one
  square metre**; `w282294826`, the anchor the procedural block demo was built
  around, is a 7 m² box 2.5 m tall; `w1388560103` is 112 m² but only 3.7 m
  high. One target, `w274039950` at 134 m² and 17.7 m, is a building. This is
  not a sampling accident: `buildings-colored.geojson` is filtered by appearance
  rather than building-ness, and across its 10,578 features the **median
  footprint is 18 m²**, the 10th percentile is 6 m², and 62.6% are under 40 m²
  or under 4 m tall — sheds, kiosks, canopies and dormers are its typical
  member, which is the measurement behind `LOD.md`'s warning never to treat that
  file as the mapped building set. It also explains the labels: both models
  reported `targetVisible` true at 0.8–0.9 confidence on all six and were not
  wrong, because a panorama aimed at a 1 m² object does show a façade — the one
  behind it. Two models have no reason to choose the same neighbour, which is
  precisely the disagreement the agreement table found. A `targetVisible` field
  cannot catch this, since the failure is that the target has no façade rather
  than that the camera missed it. So `judgeFacadeTarget` now decides before a
  panorama is ever requested — 40 m², 4 m tall, one 5 m edge, structured
  reasons, and a missing height rejects rather than passing silently — keeping
  3,694 of 10,578 targets (34.9%), and `test:facade-target` pins all six as
  named regressions. **This corrects the entry below**: `bayCount` was called
  unreliable because the models read different façade rhythms, but they were
  substantially reading different buildings. What survives is that a street-level
  crop cannot see a roofline and that gating on what a photograph supplies beats
  gating on counts; what does not survive is any estimate of how well two models
  agree about one façade. That has still not been measured.

- **The façade grammar gate was failing on the two fields a photograph cannot
  supply.** A two-model pilot (`gemini-3.1-pro-preview`, `claude-sonnet-4.6`) put
  the full enum grammar to 6 cached Amsterdam panorama crops for $0.117 and
  reported 0 of 6 buildings auto-eligible. That number said nothing about *what*
  the models disagreed on, so `measure:facade-grammar-agreement` re-derives
  consensus from the cached labels — free, and re-normalized first, because the
  stored labels predate the fix mapping a provider's `"unknown"` count onto
  `null`. Measured per field, the appearance half of the grammar holds: material,
  colour, window pattern and ground-floor treatment each agree on 5 of 6
  buildings, ornament and window-frame colour on 6 of 6. The count half does not.
  `bayCount` has **one** informative agreement in six and *zero* of its four
  disagreements fall within ±1 — the models read different façade rhythms, they
  do not miscount the same one. `roofline` is the trap: its 4/6 agreement is
  three cases of both models answering `not-visible`, because a crop taken 22 m
  away down a canal cannot see a roof. Counting mutual abstention as agreement
  made the blindest field look like one of the strongest, so the measurement now
  reports informative agreement separately from bare agreement. The original gate
  required exactly `bayCount` and `roofline` and so could never pass; gating
  instead on material, colour, window pattern and ground floor passes 4 of 6, and
  adding storeys within ±1 keeps 4 of 6. The lesson kept: ask a street-level
  photograph for appearance, and take counts and roofline from 3DBAG height and
  the nadir roof lane that already exists. n=6 is a pilot and agreement is not
  accuracy, so nothing was promoted past `machine-proposal`.

- **The basemap stopped drawing the buildings we draw ourselves.** Facades in
  the centre broke into vertical stripes and dithered patches, and pale grey
  slabs floated inside coloured buildings. Two layers were extruding the same
  OSM buildings from different pipelines: Liberty's `building-3d` off
  OpenFreeMap's vector tiles, and `osm-colored-buildings` off
  `buildings-colored.geojson`. An earlier pass had tried to separate them with
  height offsets, which cannot work — a height offset separates *horizontal*
  faces, and a wall is coplanar with itself whatever the box above it does. The
  two pipelines also disagree on height (7 m against 14 m, 10 m against 19 m on
  the Singel), which is what pushed the grey box out through the coloured one.

  So the basemap now keeps only the buildings the extract does not carry.
  Planetiler drops the OSM id from the building layer's properties and folds it
  into the vector-tile feature id as `osmId * 10 + type`, so
  `basemapBuildingFilter` re-encodes every extract id and filters `building-3d`
  on it. Only types 2 (way) and 3 (relation) are matched: type 0 shares the way
  numbering, and 90 of its ids decode to a real extract way sitting a median
  27 m and up to 1.3 km away, so matching it would have erased ~90 buildings
  that were never duplicated. The filter is a `match`, not an `in`, because `in`
  rescans ten thousand ids for every building in every tile; it evaluates 1,189
  real tile features in 0.8 ms.

  Measured over central Amsterdam it drops 136 of 1,189 basemap buildings and
  cuts the pairs standing within 3 m of an extract building from 145 to 47. The
  47 that remain are buildings the two pipelines hold under different OSM ids,
  which no id filter can pair up; TODO item 10 step 2 deletes this whole
  three-extrusion stack and is the real fix. Nothing is lost outside the
  extract: OpenFreeMap's z14 building layer is sparse — 113 features in the tile
  over the centre against 10,578 in the extract — so this only removes the
  double-drawn minority.

  Two smaller things went with it. The roof cap used to start 0.30 m *below* the
  wall top so its underside would be buried, but MapLibre draws no underside on
  an extrusion, and the overlap put the cap's side faces in the same plane as
  the walls' — a speckled dashed line along every roof edge. The cap now starts
  exactly where the walls stop. And `check-canal-buildings.ts` still asserted the
  old translucent `buildingOpacity('clean') === 0.9`, so it had been failing
  since opacity went to 1; it is not in `check:canal`, which is why nobody
  noticed.

- **The photoreal option was shipped inert, and now actually draws.** The
  switch below reached the map correctly and then did nothing visible, because
  four defects sat in a row behind it and every existing test passed anyway.

  First, `_updateGoogleTiles` opened by asking for `map.getFreeCameraOptions()`.
  That is Mapbox GL JS 2.x, added after MapLibre forked from 1.13, so MapLibre
  has never had it: the guard was false on every frame and the function returned
  before the gate was consulted. MapLibre keeps the camera height on the
  transform, so `_cameraAltitudeMeters()` reads `transform.getCameraAltitude()`
  instead.

  Second, the custom layer's `render` returned early unless `owner.ready`, and
  the only thing that can set `ready` is the `load-tileset` event, which only
  fires once `tiles.update()` has fetched the root tileset — and `tiles.update()`
  was called after that early return. Nothing was ever requested. Traversal now
  runs whether or not the layer is ready; only the draw waits.

  Third, the local frame was derived from the loaded tileset's bounding sphere.
  That works for a regional tileset whose root carries a local transform, and
  Google's does not: it is one global tileset in ECEF, so the root sphere is
  centred on the middle of the Earth and the derived latitude was in the
  thousands. MapLibre threw `Invalid LngLat`. The frame is anchored on the map's
  own centre now and rebuilt when the camera wanders more than 500 m from it,
  because a tangent plane and mercator metres only agree near their anchor.

  Fourth, and only visible once the other three were fixed: the east/north/up
  frame needs no rotation before MapLibre's mercator scale. The negative y in
  `scale(s, -s, s)` *is* the north-to-south flip, and adding a further -90°
  about x on top of it swapped north with up, standing the city on edge. That
  one is easy to miss by eye, because the error is zero at the anchor and grows
  with distance from it — the first screenshots looked perfectly aligned.

  A fifth, smaller thing: `addLayer` throws while the style is settling, and
  `isStyleLoaded()` is no defence because it reports every source and so drops
  back to false whenever basemap tiles are in flight. The add is attempted and
  retried on the next map event instead.

  The tests are the real lesson. All four original tests passed against a
  completely dead feature: they checked the pure gate, checked that the setting
  reached the map, and checked a negative — that no tile is requested at cycling
  height — which an inert feature satisfies perfectly. The new ones assert
  positives that only a working layer can satisfy: that the altitude fed to the
  gate is a finite number, that enabling it at overview height actually attempts
  a `tile.googleapis.com` request (routed to `abort`, so it costs nothing), and
  that a known Amsterdam coordinate pushed through the placement matrices lands
  within a metre of where `MercatorCoordinate.fromLngLat` puts it. Each was
  confirmed to fail with its fix reverted. The placement math is exported as
  `localFrameAt`/`ellipsoidPosition` for exactly that reason.

  Known and recorded as TODO item 8c: the 25 m activation height never binds.
  The game's camera sits 95–520 m up across every view mode and camera-zoom
  setting, so the gate always says yes and the hand-back to 3DBAG described
  below does not happen in practice.

- **Google's mesh now has a switch, and it only reaches the overview camera.**
  The measurement below settled where it is usable; this is the option built on
  top of it. "Google photoreal (overview)" appears in both settings panels and
  is off by default. Altitude, not the preference alone, decides: the mesh
  appears at 25 m and up, and 3DBAG comes back on the way down, so the corridor
  the player actually rides keeps geometry that can be highlighted as a correct
  answer. The rule lives in `src/canalRecall/building/photorealGate.ts` rather
  than as a branch buried in `vector-map.js`, with a release height of 22 m
  against an activation height of 25 m — riding a canal holds a near-constant
  altitude, which parks the camera on a single threshold and flips the whole
  city between two renderers every few frames. `npm run test:photoreal-gate`
  covers the band from both directions; `tests/e2e/google-tiles-option.spec.ts`
  covers the wiring, and asserts that switching the option on at cycling height
  issues no request to `tile.googleapis.com` at all, because a billable request
  from a height whose output is unusable is the specific waste worth a guard.

  The browser key is committed. It is restricted at Google's end to the Map
  Tiles API and to this game's own origins, so it grants nothing off-origin;
  rotate it in the Cloud console rather than editing a copy somewhere. Two
  smaller things are load-bearing: the tiles bundle is ESM where its siblings
  are IIFE, because three's `DRACOLoader` resolves decoder paths at module top
  level through `import.meta.url` and esbuild stubs that out of an IIFE; and the
  layer is built on first use, so a player who never switches it on never opens
  a tileset session. Google's terms require its attribution to be visible
  whenever its imagery is, which `#google-tiles-attribution` carries.

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

- **Roof colour is now measured twice on exact LoD2.2 planes.**  PDOK's live
  3D Basisvoorziening OGC API exposed the missing source: pinned 2025 CC BY 4.0
  RGB DSM tiles as direct LAZ downloads. Five buildings required five 20 cm
  tiles and contained 12 roof planes. Eleven planes had enough points; nine
  agreed with independent `2025_orthoHR` measurements within RGB distance 20,
  two disagreed and one was sparse. The median comparable distance was 2.83.
  A modal height-offset join handles the 0.35 m median difference between the
  independent surfaces while retaining a narrow 12 cm sample band. Every file
  is hashed, every output remains a proposal, and the review sheet starts
  unreviewed.

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
- **Measured façade colour now has a fail-closed point-cloud path.**  The
  3DBAG API produced 255 semantic exterior LoD2.2 walls for 28 of the 30 BAG
  panorama targets; all returned models passed its quality flag, while two
  persistent HTTP 502s remain explicit rejections. A typed sampler joins RGB
  points to exact wall polygons, balances colour by spatial cell, rejects
  sparse, shadowed and mixed samples, hashes its LAZ input and never accepts its
  own output. Amsterdam's advertised street-level 2024/2025 LAZ catalog was
  empty during the run. PDOK's newly located RGB DSM is useful for roofs but,
  as a top-surface product, does not replace oblique façade evidence.

- **Façade grammar now starts from reviewed evidence, not one lucky camera.**
  A live pilot fetched three spatially distinct 2025 municipal panorama crops
  for each of 30 BAG buildings: 90/90 requests succeeded. The first five made
  the selection problem visible — one centroid-aimed crop looked down a canal
  and another was foliage — so the manifest now pins its camera-distance and
  mission policy, stores alternatives and rejection reasons, and a grouped
  review sheet selects one exact panorama or records that none is usable.

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

- **The renderer draws the streamed city, and buildings keep their identity.**
  The map swaps its OSM-only appearance source for the complete BAG-keyed city
  when that city is published, hides the basemap's own `building-3d` extrusion
  — pure redundancy once every building is described locally — and lets the
  streamer follow the camera. Until publication the probe fails and nothing
  changes, which is the normal state rather than an error.

  Verified against the staged tiles by temporarily linking them into the served
  path: 9 to 19 z14 tiles resident depending on viewport, 30,000 to 66,000
  features drawn, heights from 0.7 to 79 m, on desktop and iPhone. Whole
  residential blocks that were previously absent or flat basemap gray now stand
  at AHN-measured heights.

  **Two defects found while wiring it, both invisible in a screenshot.**
  `generateId` numbers features by their position in the array, which is fine
  for one file loaded once and wrong the moment the array is rebuilt — and the
  streamer rebuilds it on every tile load and eviction, so the index that
  identified a highlighted building comes back pointing at a different one and
  the highlight jumps to an unrelated house as the player drives. The source is
  recreated with `promoteId: 'id'`, so a feature's id is its BAG pand id and
  picking has something stable to key a `BuildingHit` on.

  And four buildings in 344,436 carried a height of null or zero: two 3DBAG
  never reconstructed, two that round to zero. The tiles omit the key rather
  than write an unmeasured number into a dataset whose whole claim is that its
  heights are measured. The layer's `coalesce(height, 5)` takes them, which is
  a guess that is visible as a guess.

  The e2e spec skips while the city is unpublished and starts running by itself
  once it lands. It polls `querySourceFeatures` rather than reading it once,
  because that returns what MapLibre has re-tiled for the viewport and lags
  `setData` by a frame or two — read immediately it was empty about one run in
  three, which says nothing about whether the streamer worked.

- **The complete LoD1 city is built, staged and measured — 336,784 buildings.**
  Phase 1's data half. The hosted 3D Tiles carry identity and attributes but no
  ground polygon, so a flat-topped city needs a footprint source they cannot
  give. It is 3DBAG's CityJSON, where the footprint is the LoD0 MultiSurface on
  each `Building`, and the bulk path to it is `tile_index.fgb` — the only
  published list of the per-tile downloads, with a SHA-256 for each.

  That index turned out to be an adaptive quadtree of *leaves only*: 500 m
  tiles over the centre, 64 km over open water, levels 3 to 10, and across all
  8,941 no two overlapping by more than a metre. That property is what makes
  "take every tile intersecting the box" correct, so `fetch-3dbag-tiles.ts`
  asserts it instead of assuming it — a future vintage publishing a full tree
  would duplicate every building rather than fail. 290 tiles, 374 MB, cover
  drivable Amsterdam; the area comes from `streets-routing.json` so widening
  where the game can drive cannot leave a rim without buildings.

  **The extrusion height is settled from both ends.** CityJSON publishes
  `b3_h_dak_70p`, and 3DBAG builds its own LoD1.2 by extruding to exactly that
  percentile, so it is not an estimate of the official geometry — it is the
  official geometry's height. The `b3_volume_lod12 / b3_opp_grond` figure
  recovered earlier from the 3D Tiles metadata, where no percentile is
  published, differs from it by a median of 4 mm (p05 -0.10 m, p95 +0.04 m).
  Two independent derivations agreeing that closely is what makes the
  tiles-only path trustworthy. The ridge is *not* the height: it is missing for
  every flat roof by definition, and standing a flat top at the ridge of a
  steep canal house overstates the whole row.

  Result: 336,784 panden, 336,431 at an AHN-measured height, two in the whole
  city with none. Against 10,578 buildings shipping today whose heights are the
  OSM tag where it exists and `levels * 3` or a flat 9 m where it does not.

  **The merge keeps one winner per building.** 336,620 measured extrusions,
  1,163 hand-mapped OSM parts standing in for 164 panden, 6,653 OSM features
  with no pand under them. That last number was split apart because it was
  measuring two different things: 2,664 lie outside the area the tiles were
  fetched for, where BAG was never consulted, and only 3,989 are gaps in the
  register inside it. Features carry `bagConsulted` so the distinction survives.
  Unmatched OSM features are 0.1% of features in the centre, 0.5% in the canal
  ring, 1.5% at the eastern periphery.

  The join is centroid containment either way round, not area intersection: the
  two sources digitise the same wall from different surveys and disagree by
  about a metre everywhere, so an intersection test spends its time on slivers.
  Containment in both directions also handles one OSM outline over several
  panden and one pand under several parts.

  **What BAG says about the Waag, corrected.** The design doc had it as three
  panden; it is one — 385 m2, built 1700, extruding to 16.0 m — against
  fourteen hand-mapped parts at 6 to 26 m. The other two panden a radius search
  finds are neighbours on the Nieuwmarkt whose footprints do not overlap any
  Waag part. The trade tier 2 refuses was never fourteen parts for three boxes;
  it was fourteen for one. The merge suppresses that pand, its composition
  stands in with its pyramidal roofs intact, and the two neighbours correctly
  stay measured extrusions.

  **Delivery.** 192 MB cannot be fetched whole the way today's source is. The
  city is cut into z14 tiles, placed by centroid so no building is drawn twice
  along a boundary, with properties trimmed to what draws — attributes were 55%
  of the bytes and footprints only 45%, at 7.8 vertices per building, so the
  compression worth having was dropping year, party-wall area and RMSE from the
  wire rather than simplifying outlines. The whole city is 15 MB gzipped;
  median tile 6 KB, worst 3x3 block 2.4 MB, against the 5.5 MB the game already
  fetches for a tenth of the city. Zoom was measured, not assumed: z13's worst
  block is 6.0 MB, z15's is 0.9 MB but needs 25 requests for the same ground.

  Everything is in `public/data/extracts/amsterdam/staging/` and deliberately
  not published into the versioned extract. The renderer is not wired to it yet.

- **The hosted 3DBAG tiles carry a BAG id, so the join needs no compiler.**
  This was the blocking question in `BUILDING_RENDERER_DESIGN.md`: if the tiles
  the game already streams resolve each feature to a `pand_id`, measured roof
  colour can be attached to government geometry at runtime, and an offline mesh
  compiler is an optimisation rather than a prerequisite. They do.
  `scripts/probe-3dbag-metadata.ts` reads `EXT_structural_metadata` out of a
  pinned v20250903 tile; over the Rijksmuseum, 667/667 features carry a unique
  `NL.IMBAG.Pand.*`. The property tables are uncompressed — only the geometry
  bufferViews are meshopt — so identity, heights, construction year and
  reconstruction quality all read without touching a triangle.

  Three things came back that were not being asked for. Construction year is
  present for every building, which is the age prior of the façade work
  available for free and with no imagery licence. `b3_rmse_lod22` is a
  per-building reconstruction error, which is the gate for deciding whether a
  detailed mesh can be trusted. And `b3_opp_scheidingsmuur` is shared-wall
  area, so "promote a terraced row as a unit" is computable rather than
  inferred from geometry — 92% of the Rijksmuseum tile and 91% of a Noord tile
  share a party wall, which is why stepping at one is not a rare edge case.

  The height field is the trap. The obvious choice, `b3_h_nok - b3_h_maaiveld`,
  is wrong twice: flat roofs have no ridge by definition (0/41 at the
  Rijksmuseum, and only 50% of the Noord tile has one at all), and a flat-topped
  box standing at the ridge of a pitched canal house overstates the whole row.
  `b3_volume_lod12 / b3_opp_grond` — 3DBAG's own LoD1.2 height, the box that
  displaces the reconstructed volume — covers 667/667 and 3,474/3,475 at a
  median 0.94x the ridge. That is the extrusion height; the ridge is kept as
  roof geometry for later LoD2.2 work. The one building in 3,475 with neither
  is why `lod1HeightM` returns a source of `'none'` rather than inventing a
  number, and why an OSM fallback tier still exists.
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
- Neighborhood entry postcards (compact HUD strip: photo + name + caption). A
  contemporaneous note claimed classic large-letter composition; that look did
  not land in `drawPostcard`. The real compositor arrived later — see
  “Large-letter postcard compositor (standalone)” at the top of this file.
  SPARQL enrichment still supplies Wikimedia thumbs for many neighborhoods.
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


## 2026-09-12 — Da Costabuurt + Jordaan evaluable release

Published `c4bebc1fcc1ad9622ea4972755b3eee69f037928db4573219c86d2c4e088920d`: 7,395 unique buildings, 598 photographed frontages, connected 2,004 m route, and 96.4% processed eligible route frontage length. Additional inference cost $0.453310605; cumulative $1.705205502; no unresolved charges. Municipal boundary membership, acquisition omissions, source pins, per-record revocation, coverage denominators and cost forecast accompany the immutable release.

The resumable district coordinator preserves the offline runner and demonstrates a nonadjacent Oosterpark sample. Shared game residency, capture readiness and footprint clearance are checked at fourteen desktop/phone checkpoints; source/render comparisons remain separate from human review. Open glazing frames and a game-specific sign relief offset repair visible occlusion. Phone composition still loses detail behind foreground buildings and trees; physical-device performance and human spot-check completion remain unmeasured. See [launch commands, reports and verification](DISTRICT_PIPELINE.md).
