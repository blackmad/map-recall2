# History — why things are the way they are

Finished work and the findings behind it. The work board is
[`TODO.md`](TODO.md); nothing unfinished belongs here.

Entries keep the words they were written in, because each records *why* a thing is
the way it is, and that is the expensive part to recover later.

Two parts, because they are ordered differently on purpose:

- **[Part 1 — Canal Recall, newest first](#part-1--canal-recall-newest-first).**
  Prose entries, most recent at the top.
- **[Part 2 — Façade twin findings, §1 onward, oldest first](#part-2--façade-twin-findings-1-onward-oldest-first).**
  A numbered lab notebook. Commit messages cite these by number (§18, §21, §26),
  so the numbering is the stable reference and must not be renumbered.

---

## Part 1 — Canal Recall, newest first

## Amsterdam façade twin: the day the standing goal became a number

For weeks the goal was "good correspondence between panoramas and 3DBAG
buildings" with no threshold, so every headline written against it chose its own.
It now has one, and a measurement to hold against it.

**Correspondence is 85%** (§22), and was 76% (§21) for most of the session. Of the
48 panden a house-number reading can decide, 41 confirm the wall we projected and
7 contradict it. The decoy — the same readings scored against a house two doors
along — confirms 3, judged by exactly the rule that decides a real confirmation,
which it was not before. The owner set the bar at 95%, so `check-number-anchors.ts`
still exits red, which is the correct colour. The nine points came from ranking
bands by squareness rather than proximity, measured on the identical 400 panden.

Three of the session's findings were corrections to its own earlier claims, and
each came from measuring a component instead of inferring it from an aggregate:

- **The lens was real and not binding.** The re-measure prescribed after the
  sixteen-script lens fix disproved its own hypothesis. The first comparison said
  otherwise and was wrong: the superseded store had accumulated across three
  commits and two heading changes, so old-versus-new measured the mixture, not the
  lens.
- **A confidence score that rewarded emptiness.** Every rule in `plausibility()`
  is guarded by `storeyBands > 0` or `openings.length`, so the less a reading
  contained the less could be held against it — 59 of 422 stored readings had no
  bands, no bays and no windows, and scored 0.80 against a 0.6 bar. Counting them
  as zero-storey buildings had inflated the storey ladder's own error from MAE
  0.76 to 1.21.
- **The ladder was never the fragile part.** Two mechanisms were proposed for its
  flipping and both were wrong. `storeyBands` counts bands that kept a confirmed
  *opening*: of 112 storey flips under a 10 cm lens nudge, 112 came with an
  opening-count change, against 15% of the readings that held. The fragile
  component is window detection, and 88% of its gate flips are the width gate,
  not the darkness floor.

**Instruments gained controls.** `lens-sensitivity.ts` reproduces the store
exactly at zero offset (422/422) before it is allowed to say anything, and its
null control — 1 mm moving 3% against 10 cm moving 16% — is what makes the
dose-response a measurement rather than the probe's own noise.
`check-facade-registration.ts` now injects a known displacement: widening its
search window from ±3 m to ±6 m sent three offsets straight to the new edge
(+6.00, −6.00, +5.92), so its long-standing red was largely its own ambiguity on a
frontage that repeats every 5.7 m. It is demoted to gating *bias*, which
periodicity cannot manufacture, and passes at −0.06 m.

**Obliquity turned out to be the lever on identity.** Contradicting panden sit at
17.4° against 9.3° for confirming ones; square-on bands confirm 89% against 65%.
The band ranking had been choosing by resolution, where the obliquity penalty is a
cosine — 6% at 20° against a standoff term that varies by half — so the median band
was shot at 18.0° when 3.7° was available. It now buys squareness for up to 30% of
resolution: median 4.4°, square-on bands 124 → 260 on the identical 400 panden.
The specificity check is what makes it credible: obliquity predicts house-number
correspondence strongly and storey-measurement quality not at all, which is
exactly what a horizontal-localisation mechanism demands.

**The 2024–2025 imagery is unparked.** `check-inferred-height.ts` settled the
claim the code had made about itself: across 97,120 frames the inferred lens
height differs from a datum-corrected published one by a median of 3 cm, within a
metre 88% of the time. `number-bands.ts` takes those 15,312 frames now, and
`check-facade-camera` holds the other half of the rule — anything measuring upward
must demand a published height. On its first run that check found `build-block.ts`
filtering on nothing at all.

**New viewer.** `build-city-map.ts` puts all 3,025 footprints on one page,
coloured by what the anchor said, with 3DBAG's heights and our measurements a
click away. Nothing had ever shown them all at once, so questions that need a map
had been answered by grepping JSON.

## Amsterdam façade twin: four bugs that only a screenshot could find

Everything in this entry was found by looking at the render. None of it was
found by reading JSON, and some of it had survived weeks of reading JSON. The
lesson is cheap to state and was expensive to learn: a geometry pipeline needs
a picture in the loop, and the picture needs to be looked at by someone willing
to say "those bricks are the wrong size."

**The bricks were the size of doors, and the tile size was not the cause.**
Wall textures were packed into a single atlas so the whole boundary stayed one
draw call. That is a reasonable instinct and it was the bug. An atlas forces
every UV into a cell, so world-space UVs have to be wrapped by hand — the code
did `fract(east)` and mapped the result into the cell. But a wall quad has only
*two* vertices along its length, and between them the rasteriser interpolates
linearly. `fract` evaluated at each end does not repeat a tile fifteen times
across a 15 m wall; it stretches one tile across the whole thing, and where the
two fractions happen to descend it runs the tile backwards. Wrapping is the
GPU's job, it is free, and it only works on an *unwrapped* UV — which is exactly
what an atlas cannot have.

The fix is a mesh per material with `RepeatWrapping` and UVs in real metres.
Seven draw calls for the canal ring, against one, is not a cost worth a bug.
Worth remembering as a general shape: a performance optimisation that forces a
correctness workaround is usually cheaper to delete than to fix.

The tile itself also changed, from 1 m at 96 px to 0.63 m at 128 px. The module
has to be a whole number of bricks or the bond breaks at the seam, and three
stretchers is the smallest that still carries enough wall to read as wall. That
is 45 px per brick rather than 20, which is where a bond starts looking like
brick instead of concrete masonry.

**Every roof was a pyramid, and the gable generator had never been called.**
The roof was drawn by tapering the footprint ring toward its own centroid. That
is a marquee. It is also the wrong *kind* of construction: a canal-house roof is
a property of the plot, not of the ring — one ridge running front to back, two
planes falling to the party walls, and the front wall carried up into a shaped
gable that screens the roof from the street. That silhouette is the building
type. Getting it wrong meant 3,025 buildings that could have been anywhere.

The embarrassing part: `gableProfile()` had drawn seven gable types since the
generator landed, with a comment explaining why each is a separate function
rather than one parameterised curve, and it had never once been called by
anything that draws. The vocabulary was built and then not used. Worth checking
for elsewhere.

Wiring it up forced the honesty question the brief exists to answer. The ridge
*height* is measured — laser altimetry, for nearly every building here — so
drawing a pitched roof is reporting a measurement. Which shaped gable screens
that roof is measured nowhere, and is stated in prose by the register for 695
of the 3,025. So the rule splits: state it where stated, assume it from the
construction year where not, and give a building whose front nobody has
photographed a `punt` — a plain triangle, the least any pitched roof can end in.
The geometry carries `part: 'gable' | 'trim'` so a renderer can drop the drawn
vocabulary entirely, and evidence mode colours it as generated rather than
letting it pass for massing.

The check that came out of this is the useful artefact: no gable may stand above
the measured ridge (the drawing conforms to the measurement, never the reverse),
a shaped gable reaches it exactly, and `lijst` deliberately falls short — it is a
parapet cornice with the roof visible behind it, and forcing it to the ridge
would turn every 19th-century frontage into a spout gable.

**Windows were stickers.** They were flat quads set 5 cm proud of the wall. The
reasoning in the comment was that at the distance a rider reads this from, a
plane and a real reveal are indistinguishable — and that is wrong in a way a
screenshot settles instantly. The one cue that says "hole" is the shadow down
the side of the reveal. Without it, a dark rectangle reads as something stuck
on the front. Glass now sits 140 mm back with joinery, a reveal and a sill, and
white frames against a dark wall turn out to be most of what makes a canal
elevation legible at a distance.

**The scene was dark because of the light meant to fix it.** There was an
`AmbientLight` at 1.5. An ambient that strong is not lighting: it adds the same
value to every surface regardless of which way it faces, so it was washing the
measured colours toward white *and* flattening every normal at once — reveal,
cornice and roof pitch all coming out the same value as the wall. It raised the
floor so far that the sun had nothing left to lift the lit faces above. A
hemisphere, a south-west sun and a cool fill replace it, and the same geometry
is now legible.

**And one measurement bug the render pointed at sideways.** A screenshot showed
a window hanging off the bottom of a wall. The sill histogram explained it:
1,020 of 10,335 openings sit at exactly −0.40 m. A spike that sharp is never a
measurement. `measure-facades.ts` built its rectified strip from `ground - 0.4`,
and 40 cm does not clear a souterrain — the bottom edge of the image cut
straight through every basement window and front door, and the detector clamped
them to the edge it could see. The same cut explains why doors are essentially
undetected: 1,213 of 1,340 measured façades have no door-shaped opening at all,
because the door reaches the ground and the ground was off-frame. The strip now
starts 1.8 m down. Everything measured before that change has a broken ground
floor and has to be re-run.

## Amsterdam façade twin: a grammar, and the discipline of testing it

The detector was producing numbers that were individually defensible and
collectively wrong — a median of six storeys on a street of four, one bay on a
five-metre front. The fix was not more thresholds but a grammar built from
evidence, and the interesting part is which pieces of evidence survived.

**Storey geometry came from data that owes this project nothing.** 3DBAG's
storey counts divided by AHN eaves heights, n = 2,390: p05 2.40 m, p50 3.01 m,
p95 3.71 m. The ladder had been searching 2.4–4.2 m — too wide, and centred well
below where houses actually are — and it drifted to the bottom of that range
because more rungs fit there.

**Two bugs came out of looking.** The ladder scored `mean × rung count` capped
at six, which is a reward for finding six rungs however the comment beside it
described itself; scoring by mean fit alone moved the median from 6 to 4. And a
tree trunk, downpipe or lamp standard reads as a strong deviation from the wall
in one continuous band from pavement to roofline, which a window never does —
columns high across 82% of the height are now discarded as obstructions.

**The Amsterdam foot was the interesting failure.** Canal-ring plots were set out
in feet of 28.13 cm at 18, 20, 22, 24 or 26 feet, and the pilot's median plot
width is 5.66 m, which is 20 feet almost exactly. Quantising every measured
width onto that module would have been an elegant, well-sourced, confident
error. Tested across 1,343 pre-1800 plots, the mean distance from a whole foot is
0.2524 against 0.2524 for a randomised control — 0.25 being what no structure at
all looks like. The 20-foot peak is just the mode. The historic module was real;
it is not recoverable from a BAG footprint, which surveys a building four
centuries of rebuilding later and reports the short side of its minimum-area
rectangle rather than a plot boundary. The constant stays in the file, unused,
with the test written next to it.

**A reference sheet answered a question nobody had asked.** Ten façades
rectified at 26 px/m with a metre grid over them, meant to yield proportions,
instead showed that several readings at obliquity under 12° and standoff under
40 m were photographs of canal elms, scaffolding, a lamp post, or a wildly
mis-scaled close-up. Those pass every test on the camera and none on the
building. So `plausibility()` now asks whether a reading is a façade at all
before it is kept — storey count against the building's own height, intervals
against the measured range, bays against frontage, opening area as a share of
wall, and how many openings are window-shaped. 41 readings rejected, each with
its reason. Bays moved from a median of 1 to 2; storey bands from 5/6/6 to
3/4/5.

**And a generator, which is the grammar pointed the other way.** Given a
measured skeleton it produces a full plausible façade: diminishing storey
heights that sum to the measured eaves *exactly*, bays at a 1.9 m pitch, windows
that shrink with their storey, a door, a hoisting beam, and seven gable profiles
drawn per type rather than smeared into one parameterised curve. It is the
rendering vocabulary the brief describes — how to draw a klokgevel once you know
this house has one, never a claim that it has one — so everything it emits is
stamped `provenance: 'generated'` and an unstated gable is flagged assumed. The
checks that matter are conservation rules: storey heights are generated, but the
eaves height they sum to is a measurement, and a rule about the parts may never
move the whole.

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

---

## Part 2 — Façade twin findings, §1 onward, oldest first

*Was `public/canal-drive/FACADE_STATE.md`. Section numbers are cited from commit
messages and are stable; append new findings at the end, never renumber.*

> ## ⚠️ Superseded in its central claim, and worth reading anyway
>
> This document was written on 2026-09-04 and argued that the extraction was
> "not nonsensical — but unvalidated". **That was wrong.** Hours later an
> external audit found a 180° yaw error: Amsterdam's panoramas put the heading
> direction at the *left edge* of the equirectangular frame, the rectifier
> assumed the *centre*, and every street-level measurement therefore sampled
> whatever stood **behind** the survey camera.
>
> All 2,184 buildings and 15,178 openings described below are quarantined in
> `.cache/facade-twin/quarantine-yaw-centre/`. So are the wall colours, the
> material classifications and the six extracted textures, which all derive
> from those crops.
>
> **The massing is unaffected** — footprints, ground, eaves, ridge and roof form
> come from BAG, 3DBAG and AHN and never touched a panorama.
>
> The section below headed *"§1. The honest summary"* is left exactly as
> written, because how it went wrong is the most useful thing in this file. It
> made a case from three independent agreements — median storey height, median
> frontage, storey count against 3DBAG — that all held **while the pipeline was
> photographing the wrong side of the canal**. See §10.
>
> A re-measurement under the corrected convention has landed. **See §11 at the
> bottom for the current numbers** — they are much smaller and much better
> founded than the ones in §1–§9, which describe the tainted run.

Written 2026-09-04, at commit `92d9ad7` on `feat/amsterdam-building-twin`.

This document exists because the question was asked directly: *are these
extractions borderline nonsensical?* The short answer is **no, but they are
unvalidated, and more than half of them fail at least one of my own sanity
checks.** Everything below is measured from the current staged extract. Where I
do not know something, it says so.

Re-derive these numbers rather than trusting this file if it is more than a few
commits old. The commands are at the bottom.

---

### 1. The honest summary

**What is genuinely solid.** Three independent agreements, none of them
engineered, and each one a case where a bug would have shown up loudly:

| Quantity | Detector says | Independent source says | Agreement |
|---|---|---|---|
| Median storey height | **3.00 m** (n=6,639 intervals) | 3.01 m — grammar, from 3DBAG storeys ÷ AHN eaves, n=2,390 | **1 cm** |
| Median frontage | **5.66 m** (n=1,814 walls) | 5.7 m — BAG minimum-area rectangle | **4 cm** |
| Storey count | within ±1 of 3DBAG for **82.7%** | 3DBAG LoD2.2 | mean signed error +0.28 |

These come from different data by different routes — one from photographs, one
from laser altimetry, one from the land registry — and they land on the same
numbers. That is not what a nonsensical pipeline looks like.

**What is genuinely weak.** Also three things, and they matter more than the
above:

1. **Nothing has ever been checked by a human.** Not one façade. Every
   street-level field is capped at confidence 0.4 for exactly this reason, and
   that cap is the only thing standing between this and overclaiming.
2. **Only 41.8% of façades pass every plausibility check.** 1,055 of 1,814 trip
   at least one. That is the single most important number in this document.
3. **Storey count matches 3DBAG exactly only 33.8% of the time.** Being within
   ±1 is good enough to draw a building and not good enough to state a fact.

**So the fair characterisation is:** the aggregate statistics are trustworthy
and the per-building readings are not yet. Good enough to render; not good
enough to assert. Which is what the 0.4 confidence cap already encodes, and why
nothing here has been written into a record as measured.

---

### 2. Coverage

| | Count | Share |
|---|---|---|
| Buildings in the boundary | 3,025 | 100% |
| With massing (footprint, ground, eaves, ridge, roof form) | 3,025 | 100% |
| With a measured ridge | 2,887 | 95.4% |
| At a fallback height (no measurement) | 138 | 4.6% |
| **With an observed and measured front** | **1,812** | **59.9%** |
| With no façade — drawn as bare massing | 1,213 | 40.1% |
| Ceiling from camera poses alone | — | 88.6% |
| BAG construction year | 2,810 | 92.9% |

The gap between 59.9% and 88.6% is a measurement run, not a bug. It went from
44.3% to 59.9% today by lowering the rectified strip and re-running.

---

### 3. What each field is worth

### Trust it
- **Footprints, ground level, eaves, ridge, roof form.** BAG and 3DBAG/AHN.
  Not my measurements; the datum alignment is pinned to 1.4 mm in the pilot.
- **Frontage width.** From BAG's minimum-area rectangle. Median 5.66 m against
  the registry's 5.7 m.
- **Wall colour.** Sampled from that building's own rectified photograph,
  between its own openings. 1,812 façades carry one.

### Treat as provisional
- **Opening positions and sizes.** 13,989 of them. Median 6 per façade. They
  are where the detector put them in a photograph of *that* building, but no
  human has confirmed a single one.
- **Storey bands.** Median interval 3.00 m, which is right; exact count agrees
  with 3DBAG only a third of the time.
- **Bays.** Median 2. Never validated against anything.
- **Wall material.** Snapped from measured colour to a 12-item vocabulary.
  `brick-grey` takes 776 of 1,812, which is suspiciously dominant and probably
  reflects shadow and overcast light more than grey brick.

### Do not trust — drawn, not observed
- **Gable shape** on the 2,389 buildings where the register does not name one.
  636 are stated in prose by the Rijksmonumentenregister; the rest are assumed
  from construction year. An unphotographed, unstated front gets `punt`, a plain
  triangle, deliberately.
- **Cornice, window joinery, sills, hijsbalk.** Pure vocabulary. Tagged
  `part: 'gable' | 'trim' | 'beam'` in the geometry so a renderer can drop them,
  and coloured as generated in evidence mode.
- **Opening *kind*** (window / door / shopfront / souterrain). Read from the
  measured rectangle's shape and its height above this building's own ground —
  honest as far as it goes, but it cannot tell a door from a very tall window.

---

### 4. Where it fails, by count

1,055 of 1,814 façades trip at least one plausibility check. The reasons:

| Count | Failure |
|---|---|
| 464 | *N of N openings are not window-shaped* |
| 308 | a floor-to-floor interval outside 2.3–3.9 m |
| 213 | storey ladder implies storeys **below** 2.3 m |
| 187 | storey ladder implies storeys **above** 3.9 m |
| 180 | openings cover more than the expected share of the wall |
| 27 | band count disagrees with an independent storey count |

**Read these as a diagnosis, not a defect list.** The 213-below and 187-above
pair is the storey ladder failing in both directions roughly symmetrically,
which is what an unbiased-but-noisy estimator looks like — consistent with the
+0.28 mean signed error. The 464 "not window-shaped" is the one that most
likely indicates real false positives: dark regions that are not openings.

### View quality is a hard limit on some of this

| | p05 | p25 | p50 | p75 | p95 |
|---|---|---|---|---|---|
| Standoff (m) | 14 | 20 | 25 | 35 | 46 |
| Obliquity (°) | 0.5 | 3.6 | 9.4 | 16.3 | 19.6 |
| Resolution (px/m) | 27 | 36 | 51 | 61 | 91 |

**30.5% of façades were measured at under 40 px per metre.** A glazing bar is
about 20 mm. At 40 px/m that is under one pixel. Anything finer than an opening
outline is not recoverable from those views at all, and no amount of better
detection changes that — it needs closer imagery.

---

### 5. What is drawn now

| Element | Source | Count |
|---|---|---|
| Openings | measured | 13,989 |
| — windows | classified from shape | 11,426 |
| — doors | classified from shape | 1,400 |
| — souterrain | classified from shape | 866 |
| — shopfronts | classified from shape | 297 |
| Gable, stated | Rijksmonumentenregister prose | 636 |
| Gable, assumed | construction year | 2,389 |
| Wall textures | measured colour + constructed bond | 6 of 12 materials |

Gable mix as drawn: 1,235 `lijst`, 1,060 `punt` (unobserved), 320 `klok`,
240 `hals`, 168 `trap`, 2 `tuit`.

Textures: `brick-grey`, `painted-white`, `painted-grey`, `painted-black` (40
buildings each), `brick-yellow` (30), `stucco` (14). Brick tiles at 0.63 m —
three stretchers, so the bond seams on a perpend. Paint and render tile at
1.89 m with their horizontal banding flattened, because the cross-building
median manufactures false courses on surfaces that have none. Six materials
have too few sample buildings and fall back to measured flat colour:
`sandstone` (6 buildings), `brick-purple-brown` (13), `brick-red` (2),
`brick-red-brown` (4), `painted-green` (1), `painted-cream` (0).

---

### 6. Bugs fixed today, and what they say about the process

Every one of these was found by looking at a screenshot. None was found by
reading JSON, and several had survived weeks of reading JSON.

1. **Bricks the size of doors.** An atlas forces UVs into a cell, so wrapping
   had to be done by hand as `fract(east)` — and a wall quad has two vertices
   along its length, so that stretches one tile across the whole wall instead of
   repeating it. Fixed by dropping the atlas for per-material meshes.
2. **UVs smeared sideways.** Horizontal UV was radial distance from the
   building's first ring vertex. Fixed by projecting onto each face's own
   tangent.
3. **Every roof a centroid-tapered pyramid**, and `gableProfile()` — seven gable
   types — had never once been called.
4. **Roof shards over the neighbours.** The plot-frame roof was applied to
   churches, warehouses and L-shaped sites. Now gated on width ≤ 15 m, depth ≥
   width, bbox fill ≥ 0.65.
5. **See-through roofs.** BAG rings wind both ways, so faces came out
   back-facing and the GPU discarded them. Now every face is checked against its
   building's centre and flipped.
6. **Windows invisible.** I recessed glass 140 mm behind a wall with no aperture
   cut in it. Depth is now built outward.
7. **The `-0.40 m` sill spike.** The rectified strip started 0.4 m below ground,
   which does not clear a souterrain, so 1,020 openings were clamped to the
   image edge and **1,213 of 1,340 façades had no door at all.** Strip now
   starts 1.8 m down; 1,003 of 1,812 façades now find a door.
8. **The same datum copied into five files as a bare `0.4`.** Now one
   `STRIP_BASE_BELOW_GROUND_M`.

**The process lesson:** a geometry pipeline needs a picture in the loop. The
`build-evidence.ts` inspector exists because of this.

---

### 7. What I would not claim

- That any individual building is correct.
- That `brick-grey` at 776 of 1,812 is a real material distribution rather than
  an artefact of overcast light and shadow.
- That the front wall is correctly identified on corner plots. The rule is "the
  short side of the plot, within 35%", which is measured and reasonable, and
  which nobody has checked against a photograph.
- That storey counts are usable as facts. ±1 at 82.7% is a rendering input.
- That registration is within the brief's 0.5 m bar. It is verified only as "no
  systematic bias" (signed mean −0.13 m). `check-facade-registration.ts` stays
  red and is deliberately unwired from `check:canal`.

---

### 8. Next, in order

1. **Human calibration.** The blocker for everything else. The inspector now
   shows a strip, the detector's grid, its empty cells, and its reasoning; the
   remaining work is to label ~30 stratified façades and run
   `fieldAccuracy` → `fieldVerdict` so the 0.4 cap can be lifted per field.
2. **Per-parcel dossiers.** One JSON per `pand_id` — address, grammar,
   extractions, year, colour, texture, source links. Requested; not built.
   Addresses need a PDOK reverse-geocode pass (no address data is cached today).
3. **Coverage 59.9% → 88.6%.** Another measurement run.
4. **Window vocabulary.** `kruiskozijn`, `schuifraam` with pane counts,
   `bovenlicht`, and head shapes — `rechte strek`, `segmentboog`, `rondboog`,
   with `hanekam` stone springers. Head shape and frame colour are measurable at
   current resolution; pane counts are not, at 30% of façades.
5. **`mansardekap`** — the Dutch mansard. Not yet detected or drawn.
6. **The 464 "not window-shaped" façades.** The most likely real false
   positives.

---

### 9. Reproduce these numbers

```bash
# Coverage, gables, materials, opening kinds
npx tsx scripts/check-facade-layer.ts

# The full audit in section 1, 4 and 5
npx tsx scripts/facade-twin/build-evidence.ts --strips=0

# Re-measure the boundary (about an hour)
npx tsx scripts/facade-twin/measure-boundary.ts --panoramas=1400 --fresh
npx tsx scripts/facade-twin/build-lod22-extract.ts
npx tsx scripts/facade-twin/build-textures.ts --per-material=40

# Look at one building's evidence
npx tsx scripts/facade-twin/build-evidence.ts --ids=<pandId>
npm run build:canal-facade-twin && open public/canal-drive/facade-twin.html
```

Checks wired into `check:canal`: `facade-boundary`, `facade-build-record`,
`facade-calibration`, `facade-coordinates`, `facade-gable-library`,
`facade-generate`, `facade-heritage-text`, `facade-layer` (30),
`facade-record`. `check-facade-registration.ts` is deliberately **not** wired,
because it is red and hiding that would be worse than failing it.


---

### 10. Postscript: how a wrong pipeline passed a numeric audit

This is the part worth keeping.

Section 1 argued the extraction was sound because three quantities agreed with
independent sources: median storey interval 3.00 m against a grammar figure of
3.01 m, median frontage 5.66 m against BAG's 5.7 m, and storey counts within ±1
of 3DBAG for 82.7%. Those agreements were real. The pipeline was also, at that
moment, measuring buildings on the wrong side of the canal.

**Why the agreements held anyway.** Every one of them is a property of *the
fabric*, not of the building being measured. Amsterdam canal houses have ~3 m
storeys and ~5.7 m frontages whether you photograph number 270 or the house
opposite. The frontage figure could not have disagreed: the wall width comes
from BAG geometry, not from the photograph, so it was never testing the
imagery. And a storey ladder fitted to *some* Amsterdam façade will land on
Amsterdam's storey height regardless of which façade it was.

So the audit tested that the outputs were *typical of Amsterdam*, and they were.
It could not test whether they were **this building**, and nothing in it ever
could have.

**What would have caught it, in order of cost:**

1. **Looking at fourteen strips.** Free. It took one contact sheet to see
   railings, streets and blank sky. I had rendered 200 strips and inspected
   none of them.
2. **The `building` and `sky` classes of a segmentation model.** The bad strip
   comes back 13% building, 47% sky. Automatic, per-strip, and now wired in.
3. **Reading the comment above the bug.** `rectify-facades.ts:199` said in
   plain words that `centre` pointed 180° away at a building four metres behind
   the camera. The next line defaulted to `centre`.
4. **A registration check that was allowed to stay red** and was deliberately
   unwired from `check:canal`, where nobody had to look at it.

**The general lesson, stated so it survives this file.** Aggregate statistics
answer *"is this output typical of the population?"*. They cannot answer *"is
this output about the thing I think it is about?"* — identity is not a
distributional property. A pipeline that samples the wrong object will pass
every distributional test you can write, as long as the wrong object is drawn
from the same population as the right one. In a city where every direction
looks like a canal frontage, that is guaranteed.

Identity needs a per-item check against something that knows what the item
should look like: a human, a model, or geometry projected back into the source
image. Not a median.


---

### 11. Current state, after the yaw repair (2026-09-04, late)

### What ran

1. Yaw corrected to `edge`; convention moved into the imagery adapter and made a
   required argument. `check-facade-yaw.ts`, 8 checks.
2. Full re-measurement: **2,180 buildings, 1,821 with openings**.
3. Every strip re-rendered clean (no annotation) and put through
   `cmp-zosci/amsterdam-facade` v2 segmentation, locally, 49 ms each.
4. The extract now takes its openings from the model and gates on its verdict.

### Where it stands

| | |
|---|---|
| Buildings in the boundary | 3,025 |
| Strips segmented | 1,821 |
| Median `building` share of frame | **13.6%** |
| Strips ≥25% building | 643 (35%) |
| Strips ≥45% building | 331 (18%) |
| **Façades surviving the gate** | **837 (27.7% of the boundary)** |
| Openings kept | 4,892 |
| Windows found by the model | 5,323 |
| **Doors found by the model** | **31** |

**837, not 1,820.** The gate rejects a little over half of what the detector was
willing to measure. That is the number to trust, and it is the first coverage
figure in this project that has had a per-item check behind it rather than a
distributional one.

### Two bugs found in the vision pass itself

- **Colour channels.** `inference` follows OpenCV and reads arrays as **BGR**; I
  passed `np.array(Image.open(p).convert("RGB"))`. Red and blue swapped before
  the model saw anything, so brick went blue and sky went orange — and the model
  reported a brick wall as 92% sky. It looked like a model that could not handle
  our imagery. It was two characters. One strip went from 9% to 58% building on
  the fix alone; the usable rate went 8% → 18%.
- **Connected components are the wrong grouping.** A window is cut into slivers
  by its own glazing bars, so one window arrives as five ragged fragments and any
  solidity filter strict enough to reject a tree also rejects every sash window
  in Amsterdam. Replaced with a grid: project the window mask onto each axis,
  take the runs as bays and storeys, and let each cell be one opening. Fragments
  merge because they share a cell.

### What is still wrong, plainly

- **Doors: 31 found across 1,821 strips.** `check-facade-layer.ts` fails on this
  and is **left failing** — 30 of 837 façades carry a door-shaped opening, 4%.
  The model has a `door` class trained on 1,048 instances and it almost never
  fires at our scale. This is the clearest open defect.
- **Median building share is 13.6%.** Even corrected, most strips are not
  predominantly the target building. Some of that is the `background` class
  swallowing neighbours on a narrow plot; some is real rectification failure.
  Not yet separated.
- **Skewed strips.** Several strips show visible perspective — a receding
  building — which means the sampling plane is not the wall plane. Rectification
  onto a correct plane cannot produce perspective, so this is a registration
  error, not a rectifier bug. Unquantified.
- **Nothing has still ever been checked by a human.** Unchanged.

### Next

1. **Doors.** Either the model at a larger input scale, a second detector, or
   fall back to the geometric rule (an opening standing on the pavement, tall
   and narrow) over the model's window mask.
2. **Un-skew.** Detect residual perspective in a strip and either re-solve the
   plane or reject. A strip that is genuinely fronto-parallel has vertical
   building edges; measuring their convergence is a direct test.
3. **Combine detectors.** One Amsterdam-specific segmentation model is a single
   point of failure. A general window detector as a second opinion, with the
   grid as the arbiter between them.
4. **Separate the tests**, per the external audit: address → pand, pand →
   elevation, world point → panorama pixel, panorama → rectified strip, strip →
   openings. Today a façade-looking image is still treated as evidence that
   every upstream step was right.


---

### 12. The correspondence is not consistent between panoramas

The state at the end of 2026-09-05. This section supersedes §11's coverage
numbers in the only way that matters: those numbers describe measurements made
on a correspondence that does not hold.

### What is now known, and how

Three tools, each answering a question the previous one could not.

**`project-check.ts`** draws the BAG footprint into the raw panorama — no
rectification — so the coordinate transform, camera model, pose and wall choice
are tested together. Two visualisation bugs had to be removed before it could
be trusted, and both were instructive:

- Edges were drawn as **straight lines between projected corners**. In an
  equirectangular frame the image of a straight 3-D line is an arc, and over the
  20–30° a canal house subtends the bow is tens of pixels — so the outline lay
  visibly across the wall on a projection that was in fact exact. Edges are now
  subdivided in world space and every sample projected.
- The crop was sized to the **whole footprint including its 20 m of depth**,
  which from the quay spans about 100° of the panorama. The frontage being
  judged occupied a fifth of a very wide, very curved picture. Cropping to the
  wall fixed what looked like "far too zoomed in".

With both fixed, the scale checks out: 470 px for a 12.24 m wall at 30 m is
40 px/m against the 41.7 the range implies, and 113 of 149 projections are
within 15% of expected.

**`cross_view.py`** is model-free. If a wall plane is where we think it is, two
panoramas rectified onto it give the same picture and lock under normalised
cross-correlation. The control is the whole point: **a strip against itself
scores exactly 1.000 at zero offset**, so the instrument works.

**The result: 0 of 120 buildings lock.** Two views of the same wall score 0.06.
Two views of *different buildings* score 0.05.

### Where the fault is

Putting a projection beside the strip rectified from the same panorama settles
it. The strip faithfully reproduces whatever is inside the green outline —
**`rectifyFacade` is correct**. But two panoramas of one pand put the outline on
two different houses: one a narrow house with a stoep, the other a wider corner
building with a stepped gable.

So the fault is not in rectification, not in wall selection (87% of walls sit
within 5° of a plot axis, 68% match plot width within 10%), and not in the
yaw convention, which was fixed and pinned. **The pose-to-pixel mapping is
inconsistent between panoramas.**

That is a much narrower target than "the correspondence is broken", and the
suspects are enumerable. The poses come from five camera rigs across ten years:

    TMX7316010203  118,587    recording   7,317    b   7,995
    TMX7316060226    5,749    TMX7315120208  289

and each record carries a `missionYear` that differs from its own `capturedAt`.
A convention that varies by rig or campaign — heading reference, camera-height
datum, or a position that is the vehicle rather than the lens — would produce
exactly this.

### What to do next, in order

1. **Solve for a per-panorama aim correction** and see whether it clusters by
   rig prefix or mission year. `aim-error.ts` already renders each wall from
   every view onto one widened plane at a shared scale, which is what that
   measurement needs.
2. **Get a second opinion on pose.** Mapillary is free and has its own poses for
   the same streets; Google Street View's metadata endpoint returns the pano
   position it actually used. Either would say whether Amsterdam's published
   pose or our reading of it is at fault.
3. **Only then** re-run anything downstream. Every façade number in §11 was
   measured through this.

### Standing instruments

| tool | what it answers | needs a model |
|---|---|---|
| `project-check.ts` | is the outline on the right building? | no |
| `cross_view.py` | do independent views agree? | no |
| `check-facade-external.ts` | do OSM and BAG agree with us? | no |
| `match.html` + `review-server.ts` | what does a person say? (SQLite) | no |
| `vision/ensemble.py` | where are the openings? | yes |
| `vision/correspondence.py` | **abandoned** — the model calls a wall 3.8% building | yes |


### 12a. Rendering it and looking settles what correlation could not

Widening the plane to nine times the wall and rendering every view of one pand
at a shared scale — 121 m of canal, three panoramas, same plane — shows the
thing directly:

- the **2023-02-27** and **2023-03-20** views show the *same* stretch of canal:
  same buildings, same blue parking sign, small offset between them;
- the **2021-01-22** view of the same plane shows a *different* stretch
  entirely.

Two panoramas from one campaign agree with each other. One from another
campaign does not agree with either. The numbers back it weakly and in the same
direction: across 30 pairs, same-capture-year pairs have a median correlation
of 0.070 against 0.049 for cross-year, and the single best-agreeing pair in the
whole set — 0.254, far above the 0.06 typical — is exactly the 2023/2023 pair
that visibly matches.

**So the leading hypothesis is that the pose convention differs between capture
campaigns**, and the fault is in how a published pose is read rather than in
the geometry, the rectifier or the wall.

Two cautions on that. n = 30 pairs is small, and 0.070 against 0.049 is not a
result on its own — it is a direction. And normalised cross-correlation is
proving a poor instrument on these wide strips: it says 0.25 for two images a
person can see are the same street. Its self-correlation control is exact, so
it is not broken, but seasonal light, different ranges and heavy resampling
leave it little to lock onto. **Rendering and looking is currently the more
reliable test**, which is why the wide-strip renderer exists.

### 12b. The experiment that would settle it

Pick one pand with views spanning many years, render the widened plane from
each, and sort them by campaign. If the images fall into groups that agree
within a campaign and disagree between campaigns, the correction is a per-
campaign constant and can be solved for directly — the shift between two groups,
in metres at a known standoff, is a heading offset in degrees.

If instead they disagree individually, the pose error is per-panorama and the
answer is an external opinion: Mapillary has its own poses for these streets,
free, and Google's Street View metadata endpoint returns the position it
actually used.


### 12c. The campaign hypothesis is wrong, and a real bug found instead

The experiment settled it, and against the hypothesis.

**Heading is consistent across campaigns.** Taking every pair of panoramas
whose cameras stand within 2 m of each other in *different* capture years and
driving roughly the same way — 263,535 pairs — the signed median heading
difference is **0.00°**, and no year pair exceeds 0.17°:

    2019/2023  +0.06°  n=36,758      2022/2023  −0.01°  n=22,848
    2020/2023  −0.03°  n=30,953      2016/2023  +0.03°  n=15,799
    2021/2023  +0.05°  n=25,561      2019/2021  +0.17°  n=8,471

There is no per-campaign heading offset to solve for. That closes the line of
enquiry §12b opened, cheaply, on metadata alone and without a single image.

**But the same look found a real bug.** Stated carefully, because the first
version of this paragraph said something false: *the photographs are fine, and
nothing was taken underground.* What is true is that Amsterdam publishes a
missing value as a zero, and this pipeline did arithmetic on it.

Checked against the API rather than inferred from our cache:

    recording_2025-06-16_…   coordinates [lng, lat, 0.0]   heading 0    pitch 0    roll 0
    b_20241121_1354_…        coordinates [lng, lat, 0.0]   heading 3.14 pitch 1.68 roll -0.18

**15,312 of 139,937 panoramas publish a height of zero** — all of 2024 and
2025. Of those, the **7,317 `recording_*` frames from 2025 also publish heading,
pitch and roll as exactly zero**, which is absent orientation rather than a
camera pointing due north perfectly level; the 7,995 from 2024 carry a real
orientation and lack only height.

A zero height then went through `cameraHeight - GEOID_SEPARATION_M` and became
a lens 43.5 m *below* NAP — forty-six metres under the street, in our model,
not in life.

Nothing objected. The rectifier faithfully computed the directions from a camera
in the earth's crust to a wall above it — which point almost straight up — and
returned rooflines and sky. **249 of 2,180 measured façades, 11%, were measured
that way.** Any cross-view comparison including one of them was guaranteed to
disagree, which means the "0 of 120 lock" figure was measured on a set partly
poisoned by this.

Rejected now by `hasUsablePose`, applied in all five scripts that select views,
and pinned by two checks. The rest of the fleet is sound: median published
height 46.69 m, which is 3.19 m NAP after the separation and 2.56 m above this
boundary's typical ground of 0.63 m — right for a survey vehicle's lens, and
the first independent confirmation that `GEOID_SEPARATION_M` is correct.

**What is still unexplained.** Removing the underground cameras does not by
itself account for two *valid* panoramas putting one wall on two different
houses. Heading agrees, height is now sound, the yaw convention is pinned, the
rectifier is faithful and the wall is well chosen. The remaining suspects are
the published camera *position* — whether `lngLat` is the lens or the vehicle
reference point — and the pitch/roll application order. Both are testable
against Mapillary, which publishes its own poses for these streets for free.


---

### 13. The frame is world-aligned, and that was the whole bug (2026-09-05)

Section 12 left the fault narrowed to "the pose-to-pixel mapping is inconsistent
between panoramas", with `lngLat` and the pitch/roll order as the remaining
suspects. It was neither. The question itself was wrong.

**Amsterdam's equirectangular frames do not turn with the survey van.** They are
world-aligned: north at the horizontal centre, horizon level, and `heading`,
`pitch` and `roll` describe the vehicle. The pipeline rotated every projection
by the van's heading — an angle that varies per panorama and has nothing to do
with the picture.

This is why the `centre`/`edge` argument could not be won. Both answers presume a
body-aligned frame, and both are wrong by `heading`. `edge` passed its six-façade
review because those views happened to have heading near 180°, where the two
conventions coincide. Herengracht 270's three views have headings 181.5, 0.7 and
181.3 — and §12a's odd one out, the 2021-01-22 view showing "a different stretch
entirely", is exactly the 0.7 one. "0 of 120 lock" followed directly: the van
drives both ways along a canal.

### The measurements

Three, none of which needs a building, a detector or a rectified strip. Two are
reproducible from source via `scripts/facade-twin/pose-experiments.ts`.

| experiment | prediction if world-aligned | measured |
|---|---|---|
| Opposed pairs — cameras < 1.5 m apart, headings 180° apart | raw frames differ by 0° | median 0.18°, worst 2.34°, n = 8, peaks 0.44–0.80 |
| Optical flow — expansion centre against known travel bearing | bearing + 180° | median 181.55° (mad 7.02°), n = 14; 181.88° (mad 4.08°) on the 8 strongest |
| Cross-view residual, upper façade only | small | median 2.05 m → 0.95 m, within 1 m 23% → 50% |

Handedness is settled with it: clockwise, concentration R = 0.78 against 0.17.

**Two instrument notes, because both nearly produced a wrong answer.** The
cross-view correlator reads only the upper façade: everything below the first
floor is tree, car, bike, lamp post and parking sign, none of it in the wall
plane, all of it sliding metres sideways under parallax and swamping the wall
that does not. And the flow experiment must be summarised by a circular *median*.
A track with a weak flow field can score a high sign-agreement and still return a
badly determined angle — agreement measures whether signs match, not whether the
angle is sharp — and two such tracks dragged a mean of fourteen by 10°, which at
a canal's width is 4 m of façade.

### Independently confirmed

- **The publisher says so.** Amsterdam's Open Panorama pipeline documents its
  second stage as: *"images are edited to face northwards and have a straight
  horizon."* That is both findings at once — north-aligned, and levelled, which
  is why applying pitch and roll on top makes the residual slightly worse
  (0.95 m → 1.15 m).
- **The building says so.** At 4 m standoff the number **270** is legible in our
  own rectified strip of pand `0363100012164989`, carved on the stone right of
  the door — the pand BAG labels *Herengracht 270G*.
- **The register says so.** The Rijksmonument entry for Herengracht 270
  describes a double house with a sandstone façade, five windows wide, a straight
  triglyph cornice with balustrade, sculptured window surrounds in two bays, a
  17th-century door and two façade lanterns. Every one of those is visible in the
  corrected strip, in both the heading-181° and the heading-0.7° view.
- **Street View says so.** Google's May 2024 imagery of Herengracht 270 shows
  the same door, the same two lanterns, the same carved surrounds.

### The suspect that is now closed, and the one that is not

Splitting the cross-view residual by whether the two views' headings agree:

| pairs | n | signed median | median &#124;shift&#124; | within 1 m |
|---|---|---|---|---|
| opposed headings (> 120°) | 54 | **0.00 m** | 0.55 m | 65% |
| similar headings (< 60°) | 31 | −0.80 m | 1.65 m | 29% |

A vehicle-frame position offset — `lngLat` being the van rather than the lens —
would make *opposed* pairs disagree by twice the offset while same-heading pairs
cancel. The opposite is observed, so that suspect is closed with the
discriminating subset rather than with an aggregate median. **The −0.80 m on
similar-heading pairs is unexplained** and n is small; it is not being explained
away.

### Retraction

§12c said the fleet's median lens height "2.56 m above this boundary's typical
ground of 0.63 m" was "the first independent confirmation that
`GEOID_SEPARATION_M` is correct". That claim does not hold. Measured against
local ground under each camera across 93,553 panoramas, lens height has a median
of 2.47 m but a p05–p95 span of 0.72–4.61 m and a MAD of 0.69 m. Part of that is
a crude ground proxy — the median ground of buildings within 45 m — but it is far
too loose to confirm a datum to better than a metre.

### 2024 and 2025

15,312 panoramas publish a height of zero — 5,567 from 2024 and 9,745 from 2025
in this boundary. The position is that:

1. **The orientation blocker is gone.** `AMSTERDAM_CAMERA` never reads heading,
   pitch or roll, so the 2025 `recording_*` frames that publish all three as zero
   are merely undescribed, not unusable. Pose validity now asks the *camera
   model* whether orientation matters — `defectsOf(view, camera)` — rather than
   assuming it does.
2. **Height is the only remaining blocker, and it is real.** A constant cannot
   be substituted: see the retraction above.
3. **But height does not affect azimuth at all.** The projection takes azimuth
   from `atan2(dx, dy)`; `dz` enters only the elevation. So a zero-height frame is
   already usable for horizontal registration and building identity, and unusable
   for storey bands, sill heights and anything else vertical.
4. **The way to recover it** is a one-parameter vertical fit of the strip against
   a view of the same wall from the sound fleet. Not implemented yet, and until
   it is, these frames stay rejected rather than guessed — the whole point of §12c.

### Still open

- p90 of the cross-view residual is 5.55 m. The distribution is bimodal — 30 of
  60 within a metre, then a tail — which is the signature of a correct model with
  some other stage failing, most likely wall selection and occlusion. Not yet
  separated per case, and it must not be attributed by assertion.
- Cross-view agreement alone does not certify identity. Where every view of a
  pand shares a heading, the old model agrees with itself while pointing at the
  wrong house. Identity needs the address evidence above, which is why
  house-number OCR is the next instrument and not a nicety.
- Everything downstream of §11 was measured through the old model and stays
  quarantined.


---

### 14. The buildings can be made to say their own names (2026-09-05, late)

§13 left two things open: a residual tail attributed to nothing in particular,
and the fact that cross-view agreement cannot certify identity. Both moved.

### The tail is occlusion, and it is not wall selection

`cross-view-registration.ts` measures the along-wall offset between two
independent panoramas of one wall, and records what could explain a failure
other than the camera. On 90 panden: median 0.95 m, p90 5.55 m, half within a
metre, bimodal. What separates the 45 that lock from the 30 that miss by two
metres or more:

| | locks < 1 m | misses ≥ 2 m |
|---|---|---|
| either view occluded | 27% | **83%** |
| further standoff | 22.8 m | 32.6 m |
| wall off plot axis | 0.0° | 0.0° |
| worse obliquity | 13.0° | 13.8° |

Occlusion and distance. **Not wall selection** — the chosen wall sits on a plot
axis in both groups and obliquity barely moves. The view selector should reject
occluded views and prefer nearer ones; that is a change to view ranking, not to
geometry.

### House numbers, and what they can and cannot certify

A house number is the only thing in a street photograph that *identifies* the
building rather than describing it, and it is independent of the geometry being
tested: the plaque reads 270 whether or not the projection is a metre out.

Geometry decides whether it is legible. A 13 cm digit subtends 41 px at 4 m and
5 px at 30 m, so numbers come from the **near-side pass** — the van driving the
building's own quay — and not from the across-canal view the façade is measured
from. Different panoramas of the same building, which is the point.
`number-bands.ts` samples at the rate the source carries and never above it: 54
of 175 tiles were dropped below 45 px/m, where no recogniser reads a digit and
enlargement adds pixels rather than evidence. Median native resolution across the
kept tiles is 113 px/m.

First run, 30 panden, EasyOCR (Apache-2.0), never told what to expect:

| | |
|---|---|
| **confirmed** — a number this pand carries, on the wall we projected | **3** |
| **conflict** — another pand's number inside our wall span | **5** |
| neighbour only — real numbers read, all outside our wall span | 1 |
| **unread** — nothing legible that names a nearby address | **21** |

330 raw digit readings; most are window bars and reflections and are discarded by
requiring that a reading name a real address nearby. **Coverage is the honest
problem: 9 of 30 yield a usable number and 3 of 30 confirm identity.**

Along-band offset of a confirming reading from its BAG address point: n = 3,
median 1.47 m. That is loose by construction — a BAG address point is a point
*inside* the building, not the surveyed centre of a plaque — and it is sharp
enough only to catch a one-house error, which is 5–6 m on a canal terrace.

### The strongest catch, stated carefully

Pand `0363100012167495` carries Herengracht **58**. Its band reads **56** twice,
at 0.999 and 0.961, from two different tiles, agreeing at 8.59 m — three metres
into an eight-metre wall, not at its edge. The plate was then looked at directly:
white enamel on brick, beside a stone pilaster. BAG places Herengracht 56 in the
*adjacent* pand `0363100012167494`, and its address point falls 0.02 m from where
the plate was read.

**What that proves and what it does not.** It proves BAG's own point for number
56 lies inside the wall this pipeline proposes as number 58's frontage. It does
not by itself say which is wrong: a laterally offset projection, a wrong footprint
edge, a corner building with two street frontages, and a misplaced address point
would all produce it. It is a flag for a person, and that is what the instrument
is for.

### Two review surfaces, and why they are two

- **`build-explorer.ts`** browses: parcel, footprint in the raw panorama,
  rectified wall per view, door band, filters, and a per-building report control.
  The evidence had been scattered across a dozen JSON files and three pages that
  each answered one question, which is how a wrong camera model survived a pilot.
- **`build-registration-review.ts`** + `registration.html` decides: one building,
  three questions, a keystroke each, straight into SQLite. The door band is shown
  as *evidence* so a reviewer can read the number themselves; the recogniser's
  answer and the cross-view residual are withheld until after the verdict,
  because a reviewer shown a confident number agrees with it.

### Still open

- Coverage. 21 of 30 unread. Whether that is resolution, plate style, occlusion
  or the recogniser has not been separated, and the first three are geometry.
- The 5 conflicts are unadjudicated. None should be called a registration error
  until a person has looked.
- The view selector still does not use the occlusion finding.
- 2024–2025 remain blocked on height alone, as §13 describes.
- Everything downstream of §11 stays quarantined.


---

### 15. Height is a per-track offset, and the newer rigs are aligned after all

Asked why the green outline sits slightly off on a card that otherwise looks
right. It is off, it is off vertically, and the reason is not the camera model.

### Three separate faults, only one of them registration

Herengracht 242, pand `0363100012164991`, from the 2021-01-22 view:

| | |
|---|---|
| horizontal fit | right edge on the party wall, left edge ~0.45 m in — good |
| box top | drawn at `eavesHeight` 13.17 m, which cuts across the middle of the neck gable |
| box bottom | drawn at `groundLevel` 1.26 m, which lands halfway down the quay wall, ~1.8 m below the pavement |
| camera | 2.03 m NAP, only **0.77 m** above this building's own ground |

**The top was a definition mismatch.** On an Amsterdam canal house the visible
façade continues above the eaves to the gable top, so a box drawn to the eaves is
short by two metres on every gabled front — and a reviewer cannot tell that from
a genuine registration error, because either way the box misses the top of the
building. The quad now runs ground to **ridge**, with the eaves drawn as a line
across it: still legible as a measurement, no longer mistakable for a bad fit.

**The bottom is the real defect**, and it is fleet-wide. Across the 60-card deck
the modelled lens sits a median of **1.15 m** above the building's own ground,
with a 5th percentile of −0.54 m — below it. 43 of 60 cards are outside the 1.6
to 3.6 m a survey van can plausibly occupy. The deck now says so on the card, so
a reviewer judges the box sideways rather than vertically when the height is
untrustworthy.

### The height error is per-track, not per-frame

That is the useful part, and it took two measurements to see:

| | |
|---|---|
| consecutive frames of one track, ~5 m apart | median &#124;Δheight&#124; **0.041 m** |
| two cameras within 1 m of each other, different years | median &#124;Δheight&#124; **0.75 m**, p90 1.97 m, p99 4.51 m |
| within one track, p10–p90 of published height | 1.57 m over 586 tracks |

Height is smooth *along* a run to four centimetres and disagrees *between* runs
by up to a couple of metres. The same patch of quay cannot be two heights, so the
difference is the error, and its shape is a **vertical datum offset per survey
run** — the signature of a GNSS session bias. Across the fleet the median lens
sits 2.44 m above the nearest building's ground, which is right; the spread,
0.73 to 4.57 m at p05–p95, is the per-track bias, not real variation.

**This is solvable as one constant per track**, which is far more tractable than
per frame — and it is the same fix the 2024–2025 batches need for their missing
height, so the two problems collapse into one. Azimuth is untouched either way:
the projection takes it from `atan2(dx, dy)` and never reads `z`.

It also retracts the remaining comfort in §13's geoid note. `GEOID_SEPARATION_M`
is consistent with the fleet *median* and cannot be checked more finely than the
per-track bias allows.

### The 2024–2025 imagery: aligned, and from three different vendors

The alignment experiments in §13 used `TMX…` frames only, because the pose filter
rejects the newer batches for their missing height and they never reached an
experiment. The newer imagery comes from **different vendors**, which the URLs
give away:

    TMX…       /panorama/2023/02/20/TMX7316010203-…      Cyclomedia
    b_…        /panorama/2024/kempkes/Job_20241203_…     kempkes
    recording… /panorama/2025/360geo/recording_2025-…    360geo

World alignment is a property of a normalisation pipeline, not of the city, so
this was a real gap. `pose-experiments.ts --rigs` closes it by putting a newer
frame beside a `TMX…` frame taken within 1.5 m of it and measuring the circular
offset between the raw images — a test that needs neither height nor orientation,
which is why it works on batches that publish neither:

| rig | within 5° of zero | median | outliers |
|---|---|---|---|
| `b_` 2024 | 19/20 | 0.72° | −142° at peak 0.56 |
| `b_` 2025 | 17/20 | 0.54° | 170°, 91°, 171° — all at peak ≤ 0.31 |
| `recording_` 2025 | 19/20 | 0.36° | −6° at peak 0.29 |

An outlier's correlation peak is the whole question: a weak peak is the
correlator failing on a blank quay, a confident one is a frame that really is
turned. On that reading **all three vendors are world-aligned**, and the single
confident disagreement — one `b_` 2024 frame at −142°, peak 0.56 — is a per-frame
defect rather than a rig-wide convention. Worth a per-frame check before use; not
worth a second camera model.

So the answer on 2024–2025 is unchanged in substance and better founded: the
blocker is height alone, and height is now a per-track constant to be solved
rather than a missing value to be guessed.

### Still open

- The per-track height offset is diagnosed, not solved. Nothing vertical —
  storey bands, sill heights, the door band's window — should be trusted until it
  is, and it now affects the whole fleet rather than the 2024–2025 batches alone.
- Everything in §14 that was open stays open.


---

### 16. Three defects out, and a machine reviewer that knows its own bias (2026-09-05, night)

Review found six problems in an afternoon. They were three faults, and all three
are now fixed or measured.

### A frontage split by a jog is still one frontage

`buildElevations` grouped runs of *consecutive* near-parallel edges — right for a
corner, wrong for a canal front, which steps in and out by tens of centimetres
for a bay, a porch or a thicker party wall. The step is a real perpendicular
edge, so it broke the run and one façade arrived as two or three pieces. The
pipeline measured one piece.

**176 of 2,180 panden, 8%.** The chosen piece was a median **2.31× smaller** than
the real frontage and missed a median 10.1 m of wall. Herengracht 58 returned
7.98 m and 13.94 m, both facing 28.5°, both in the same plane.

`mergeCoplanar` joins elevations passing all three tests and only those: same
facing within 8°, same plane within 1.2 m, adjacent within 4 m. Facing alone
would join a front to a wing across a courtyard; without the offset test it would
join a front to a back. **Splits 176 → 34**, 653 panden gained a merge, and
Herengracht 58 now covers its whole 1905 block party wall to party wall.

The guard against over-merging is the city's own: **median frontage per house
number is 5.2 m**, which is an Amsterdam canal plot. Median front 5.6 m, p95
16.0, three over 30 m, none over 45.

### `b3_h_nok` is not a ridge height

Keizersgracht 162 published ground −0.02 m, eaves 16.38 and a ridge of **8.94** —
a ridge seven metres below its own eaves. The adapter preferred `b3_h_nok` over
`b3_h_dak_max`; whatever `b3_h_nok` is, it is not a height above NAP. Read as
one it inverted **484 of 6,429** cached buildings, 198 in this boundary, by a
median 1.87 m and as much as 15.8 — and **186 of those pass `b3_val3dity_lod22`**,
so no quality flag catches it.

Ridge now comes from `b3_h_dak_max`, clamped to the 70th percentile plus six
times its distance from the 50th: headroom for a real gable, not for one stray
lidar return. Inversions **484 → 0**; 5,456 ridges move by a median −0.07 m, so
`b3_h_nok` was usually close and occasionally catastrophic.

### The vertical datum drifts within a run, and 78% of it comes out

§15 measured a per-run vertical offset and left it unsolved. It is not per-run —
it drifts.

Solved with no ground level at all: where two runs pass within a metre the true
height is the same, so `z_a − z_b = offset_a − offset_b`. 198,856 such pairs over
687 runs, least squares over the graph they form. The gauge is set afterwards by
putting the fleet median lens at 2.44 m above local ground — the only place a
ground level enters, and only to place the solution, never to shape it.

Scored on **held-out places**, not held-out pairs:

| unknown per | held out |
|---|---|
| whole run | 27% |
| 100 frames | 57% |
| **25 frames (~125 m)** | **78% — median 0.74 m → 0.17 m** |

The holdout had to be rebuilt first. Held out at random, 25-frame segments scored
88%, flattered because two cameras at one spot generate many pairs and a pair's
siblings pin its unknowns. Whole 60 m blocks are held out instead. 89% fitted
against 78% held out is the honest overfitting margin.

Fleet lens above local ground: p05–p95 **0.73–4.57 m → 1.79–3.77 m**, median
2.44. Review deck median **1.15 m → 2.62 m**; cards outside the plausible
1.6–3.6 m fall **43 of 60 → 28**. The rest of that spread is the building's own
`b3_h_maaiveld`, not the camera.

### The machine reviewer, and the two biases it has

`llm-review.ts` grades cards under its own reviewer name so agreement is
*measured*, never assumed. Nine cards judged by both:

| | |
|---|---|
| right-building | 7/9 |
| fit | 2/2 |
| visible | 7/9 |

Both numbers are too small to conclude from, and **both disagreement types are
systematic**, which is worth more than the score:

- **Corner buildings.** Both right-building disagreements are the machine saying
  *yes* where the human says *no*, on a building whose box sits on a face that is
  not the addressed frontage. The machine is over-permissive about which face
  counts, and the first version of the question let it be: a flank is *both* the
  right building and not the façade. There is now an explicit `other-wall`
  answer, scored as a miss.
- **Occlusion.** Both `visible` disagreements are the machine saying *partly*
  where the human says *clear*. It is stricter about a bare tree. The question
  now carries a shared threshold — blocked over more than about a quarter —
  rather than leaving it to taste.

### Also closed

`tsconfig.json` included only `src`, so `npm run lint` — the project typecheck,
part of `check:canal` — **had never looked at `scripts/`**, where this entire
pipeline lives. That is how a `poseOf(view)` call missing a required argument
reached runtime. `tsconfig.scripts.json` and `lint:scripts` close it: 43 errors,
26 in facade-twin, all pre-existing but one. Deliberately not in `check:canal`
until they are cleared, because slipping it in silently would hide how long they
have been there.

Derived records are now rebuildable offline from cached raw responses
(`rebuild-derived.ts`), and nothing in the review path deletes: band tiles carry
their sampling rate, review frames carry the ground and top that made them, decks
are written live and dated. A verdict refers to a picture, and that picture has
to still exist.

### Still open

- 34 frontages still split — separated by more than 4 m or facing more than 8°
  apart, and not yet looked at individually.
- The 43 script type errors.
- Herengracht 178's box sits low enough that its bottom is in the water: the
  datum correction over-corrects on some frames, and the per-frame residual is
  not yet reported on the card.
- The five house-number conflicts from §14 remain unadjudicated.
- Everything downstream of §11 stays quarantined.


---

### 17. The frontage was a coin flip, and the fix exposed how the metric was flattered (2026-09-05, late night)

### Registration at two hundred buildings

Measured on 200 panden with two independent panoramas each, through the
corrected camera model, merged elevations and the solved vertical datum:

| | median | within 1 m |
|---|---|---|
| all pairs | 1.05 m | 47% |
| confident correlation | 0.55 m | 64% |
| unoccluded | 0.50 m | 69% |
| **confident and unoccluded** | **0.40 m** | **88%** (n = 56) |

Read that last line with the caveat in the final section: it may be flattered by
comparing near-duplicate views, and a controlled comparison is running.

### The frontage was chosen by a coin flip

`measure-facades.ts` scores each elevation by *exposure* — how many survey
cameras stand in front of it within 35 m at a usable standoff and obliquity —
and **never asks whether any of them can see it**. On a narrow, deep canal plot
the back wall faces a courtyard or the next street, and there genuinely are
cameras in front of it on that street, at fine obliquity, with a building in the
way. Front and back both score high.

The tiebreak is wall length against the plot's minimum-rectangle width. The
front and back of a narrow deep plot are **both short sides**, frequently the
same length to the centimetre:

    Herengracht 41    5.1 m @121°   against   5.1 m @301°
    Singel 54         5.9 m @305°   against   5.9 m @124°

A coin flip between two identical walls 180° apart, and it lost about half the
time. Herengracht 45's measured wall faces 121° and can be seen from **nowhere**;
its frontage faces 301° and can be seen from **261** positions. That is not a
judgement call, it is a count.

`chooseFrontage` ranks elevations by unobstructed views in coarse bands, breaks
ties on BAG address points — a front door is on the frontage — and then on
length. **770 of 2,180 panden (35%) get a different wall**, and almost every
switch is exactly 180°. **491 (23%) have no visible elevation at all** and are
massing only, which is the rule the project turns on rather than a failure.

That alone moved the whole boundary: all pairs 1.05 → **0.75 m**, 47% → **56%**;
confident 0.55 → **0.40 m**, 64% → **79%**.

### Where the equirectangular frame is squeezed

An equirectangular image is linear in azimuth and linear in *elevation*, so
horizontal sampling is uniform but a metre of wall at elevation φ earns v-pixels
in proportion to **cos²φ**. On a 4000-pixel frame:

| standoff | height | top angle | px/m at foot | px/m at top | ratio |
|---|---|---|---|---|---|
| 10 m | 20 m | 63° | 127 | 25 | **0.20** |
| 15 m | 20 m | 53° | 85 | 31 | 0.36 |
| 25 m | 20 m | 39° | 51 | 31 | 0.61 |
| 40 m | 20 m | 27° | 32 | 25 | 0.80 |

At 10 m the top of a 20 m building has a fifth the vertical detail of its foot.
The rectifier samples uniformly in world z, so the geometry is right and the
information is not there — the strip upsamples the top. Maximising the worst
sampling over the wall's height, `d/(d² + h²)`, peaks at **d = h**: the best
standoff is about the building's own height, and a flat 8–45 m band happily
picks a 9 m view whose upper storeys are mush.

### A different year is often simply clear

Westermarkt 1 is wrapped in scaffolding and sheeting in 2019 and **perfectly
visible in 2023**, and nothing in the ranking ever looked at a second year.
Obstruction cannot be read from metadata, so `spreadAcrossYears` returns one
view per capture year rather than *n* frames of one afternoon which agree
because they share every mistake.

### The regression I caused, and both explanations

The new selector made registration **worse**: 0.75 → 1.25 m median, 56% → 42%.
Two explanations are live and neither has been ruled out.

**Independence.** Only 3% of pairs are now same-year, against a median of two
years apart. Two frames from different years share nothing — season, cars,
awnings, shopfronts — so the test is harder and more honest, and a worse number
would mean nothing is broken. `--spread=0` takes the best two by quality
instead, which on a dense pass is two frames of one afternoon five metres apart,
so the difference can be measured rather than assumed.

**A defect I introduced.** The occlusion test asks whether a footprint crosses
the ray to the wall's *midpoint*, and I promoted it from a report to a hard
veto. A footprint clipping that one ray may hide a metre of a twelve-metre
frontage, and rejecting the view outright leaves only worse ones — which fits
the evidence: every surviving pair is now unoccluded by construction and the
worst resolution of a pair fell to a median 29 px/m. `blockedFraction` now
samples nine points along the wall; frontage choice counts a view as clear under
50% blocked, and ranking treats it as a penalty on the resolution score,
refusing only past 40%.

### The comparison landed, and the earlier figures were flattered

Same 200 panden, same walls, only the view pair differs:

| view pair | median | within 1 m | median peak | same-year |
|---|---|---|---|---|
| best two by quality | **0.30 m** | 75% | 0.197 | 54% |
| one per capture year | 1.25 m | 42% | 0.113 | 3% |

Paired across 199 panden the gap is 0.30 m against 1.30 m, and the same-pass
pair scores better on 60% of them. **So the 0.40 m / 88% quoted above is not a
registration result.** It was measuring how alike two frames of one afternoon
are.

And the reason is structural, not statistical. Two frames of one pass share
their pose error — the same GNSS state, the same per-track vertical datum, the
same everything the run got wrong — so comparing them **cannot reveal** the
dominant error, it cancels it. A test blind to the error it is meant to detect
returns a good number for the wrong reason, however carefully it is run.

The honest figure is the cross-year one: **1.25 m median, 42% within a metre**,
or 0.80 m and 65% on confident correlations.

But cross-year is not a clean registration measure either, in the opposite
direction: two views years apart differ by real change as well as by
mis-registration — a new shopfront, a repainted door, different parked cars —
and the correlator cannot tell those from a shift. The median peak falls from
0.197 to 0.113 between the two, which is what real change looks like.

**Cross-view correlation measures image similarity, not registration, and it has
been over-read in both directions.** The instruments that do not depend on two
photographs looking alike are the house-number anchors, which read the
building's own name, and human verdicts. Those are the ones to build on.

### Still open

- The A/B between year-spread and same-pass pairs.
- Views can only be chosen from the 2,922 panoramas on disk, which were
  downloaded for the *old* frontages. The selector cannot yet show what it can do.
- 34 frontages still split; 26 merged fronts bow more than 0.35 m.
- 43 script type errors, one of them found by turning the check on.
- Five house-number conflicts unadjudicated.
- Everything downstream of §11 stays quarantined.

### 18. Sixteen scripts placed the lens by a height nobody had corrected (2026-09-06)

`solve-track-datum.ts` (§15) recovers the drift in published camera height and
removes 78% of the disagreement between two cameras standing in the same spot in
different years. Six scripts applied it. **Sixteen did not.** They built the pose
inline as `cameraHeight - GEOID_SEPARATION_M`, skipping both the datum offset and
the inference that rescues a frame publishing no height at all.

Neither failure is loud. The render still comes out; it is just of somewhere
else. That is the whole reason this lasted: there is no exception, no blank
image, no failing assertion — only a picture of the wrong part of a building,
which looks exactly as convincing as a picture of the right part.

### How big

Across the 1,931 measured façades that name a panorama:

| | |
|---|---|
| unapplied correction, median | **0.93 m** |
| p75 | 3.97 m |
| over 1.5 m | **39%** |

The thirty number bands had suggested 0.49 m. They sit on the best-surveyed
stretches, so the sample flattered the problem — the same way §17's view pairs
flattered the registration metric.

### Where it hurt most

`number-bands.ts`, and for a reason worth stating: it is the most
datum-sensitive thing the project renders and it was the one script ignoring the
datum. It deliberately picks the *closest* usable camera, because a 13 cm
doorplate digit needs pixels, and at a 4 m standoff half a metre of lens error is
about seven degrees of aim. The door-height band was landing on the first-floor
windows. The tiles were photographs of brickwork and mullions, and the
recogniser dutifully found digit-shaped texture in them: 21 of 30 panden unread,
330 readings of which 220 were single characters.

After the fix the bands frame doors, stoeps and souterrains. The difference is
not subtle and does not need a metric to see.

### What the fix did, stated against my own hypothesis

I expected the anchors to come back. They did not. Verdicts barely moved
(confirmed 3 → 2). What moved is the along-band offset of a confirming reading:
**1.47 m → 0.58 m**. Aim was a real error and not the binding one.

Two further hypotheses died the same way, which is the point of writing them
down:

- **Digit fragmentation.** I built an assembler on the theory that plates were
  being split character by character. It produced 361 candidates from 330
  readings — nearly inert. The scattered single digits are noise, not fragments.
- **Resolution.** The *unread* bands are better resolved than the read ones
  (34 px per digit against 21). Not the constraint either.

### The instrument, after three gates that each reduced its own count

- A reading must land within 9 m of where that number lives. Seven of ten
  "conflicts" were single digits matched to an address point 9–22 m away; there
  are ten digits and the search radius holds dozens of addresses, so collision
  was close to certain. The tolerance must stay *wider* than the error it is
  meant to catch — a one-house slip is 5–6 m — or it would reject exactly the
  failures worth finding.
- A single digit certifies nothing. One in ten is not an identifier.
- Doorplate and signage are separated by glyph height, and the separation is
  total: every confirming read measured 9.8–20.8 cm, every conflicting one
  43.1–54.9 cm. The latter is painted shopfront lettering or a gable stone, and a
  business sign can name an address that is not the building it hangs on.
  Signage is recorded, not discarded — on a corner site it may be the only
  number facing this way.

A **decoy** now travels with the result: the same readings scored against a house
two doors along, which is the hypothesis a one-house error would produce. It
confirms **0 of 30**.

Result on 30 panden: **2 confirmed, 0 conflict, 0 neighbour-only, 28 unread**,
along-band offset median 0.58 m, max 1.44 m.

### The yield is the finding

Looking at the best-resolved unread bands, the numbers are simply **not there**.
Herengracht 56 renders perfectly — door, stoep, souterrain, pavement — and
carries no legible number anywhere on its frontage. `unread` is usually the
correct answer, not a detector failure.

At ~7% yield an anchor headline needs ~700 panden for n≈50. This matters less
than it sounds: legibility depends on the door's design, not on our geometry, so
the confirm rate *among legible buildings* remains an unbiased estimate of
correspondence accuracy. That is what makes a small anchor set usable as a
headline at all.

### A bound set from the median would have rejected a correction that was right

27 segment offsets exceed 5 m, one reaching 32 m; a run offset reaches 98 m.
Several are backed by over a hundred equations, so the equation count cannot
filter them. A survey lens is 2.44 m above the road: an offset like that says the
published height is wrong *in kind*, not drifting.

I first bounded this at 5 m, reasoning from the solved distribution (0.55 m
median, 1.41 m at p90) — and then checked it against the ninety confident strips,
the one set here known to render correctly. **53 of them carry a run-level
correction of 4.15–4.26 m**, almost exactly the 54 captured in 2021. That
campaign publishes heights about 4.2 m off the gauge; the solve found it; the
strips are right *because* of it. The bound had been sitting a hand's breadth
above a known-good value.

It is now **8.5 m** — twice the largest correction observed to be legitimate.
The fallback is not "leave it alone", which keeps the bad published height, but
the ground inference, because that is the same answer the solve's own gauge
encodes. The asymmetry is what settles the direction: a false rejection costs
per-frame precision, a false acceptance of 98 m costs the frame entirely.

### The rule is now checked rather than remembered

`resolveLens` in `panorama-render.ts` is the single way to place a lens. It
applies the offset to a *published* height only — never to an inferred one, which
would be correcting an error it does not have — and reports `none` rather than
pretending a correction happened.

`check-facade-camera.ts` fails if any script in `scripts/facade-twin` builds the
height inline (22 checks, was 21). Verified by probe: dropping a file containing
the old expression makes the check fail and name it. Four pose experiments —
`pose-experiments`, `project-check`, `aim-error`, `model-compare` — are exempt
**by name**, because showing what an uncorrected pose looks like is their
subject. Adding to that list is now a visible decision rather than an omission.

### Consequence still outstanding

Every storey ladder and opening in `measured-facades.json` was measured off a
vertically shifted strip. This is the most likely explanation available for the
ladder returning 6 storeys where 3DBAG's pilot median is 4–5, and it should be
re-run before that is treated as a detector problem. The uncorrected file is kept
as `measured-facades.superseded-uncorrected-lens-*.json` so the comparison stays
possible.

### 19. The lens was real and it was not the binding error (2026-09-06)

§18 fixed sixteen scripts that placed the lens by an uncorrected height, and said
plainly that the anchor verdicts barely moved. This section is what happened when
the re-measure it prescribed finished.

**The re-measure disproved the hypothesis it was run to confirm.** 422 façades,
same buildings, corrected lens, agreeing with 3DBAG *no better* than before. The
first comparison I ran said the opposite, and it was wrong: the superseded store
was generated on 2026-09-04, three commits and two heading changes earlier, so
old-vs-new was never a lens experiment. Any file that accumulates across commits
is a mixture of code versions, and comparing against it measures the mixture.

**So the lens got its own instrument.** `lens-sensitivity.ts` re-measures a stored
façade at deliberate vertical offsets, reading only cached panoramas. Its δ=0 pass
is the control: it must reproduce the store exactly, and it does — 422/422 on
storeys. That is what licenses everything below, because it proves the probe and
the pipeline are the same code.

An early version reproduced only 57 of 60, and the cause is itself the finding: it
read the store's `standoffM`, which is rounded to 0.1 m, where the run used the
exact value. **Five centimetres of rounding in the pixels-per-metre moved three
storey counts.**

The dose-response, at full scale:

| lens error | storey count changes on |
|---|---|
| 1 mm | 3% — the rasterisation floor |
| 1 cm | 2% |
| 3 cm | 8% |
| 10 cm | 16% |
| 25 cm | 26% |
| 1 m | 55% |

The 1 mm control is what makes the rest a measurement rather than a bug report
against my own probe: if a millimetre had moved 16% too, the instrument would be
the story.

**Two more angles, because fragility alone does not prove wrongness.** Against
3DBAG's declared storeys the ladder is 32% exact, MAE 1.21 — and that comparison
needed a correction of its own: 635 panden carry `storeys: 0`, which is a missing
marker, not a zero-storey building, and counting them as zeros inflated the error.
Physically, our ladder implies a median 2.76 m per storey and puts 52% of
buildings in the plausible 2.6–3.6 m band, against 77% for 3DBAG's own
height-derived count.

Gating on invariance is a real signal and a small one: readings surviving a ±10 cm
nudge are 36% exact against 21% for those that move. It buys five points for 28%
of the coverage. The ladder is fragile *and* substantially wrong where it is
stable, so the work is in the detector, not in another 2,600 rows of this.

**The registration check's red is largely its own.** It correlates BAG plot
boundaries against roofline steps and reports the best lateral shift inside a ±3 m
window. Injecting a known +1 m displacement, 6 of 9 buildings recover it to within
0.5 m — so it resolves a displacement. But widening the window to ±6 m sends three
offsets straight to the new edge: +6.00, −6.00, +5.92. The peak follows the window
wherever it is put.

A canal terrace repeats at about 5.7 m and so do its plot boundaries, so this
correlation has many near-equal peaks — prominence 1.7–2.7σ — and the search
window, not the photograph, picks the winner. The check now refuses a peak sitting
against the window edge or below 2σ. That is honest and it is not a fix: 5 of 12
buildings still answer, still at 2.38 m.

The shape of the problem is **local precision, no global lock**. Correlation can
say how far to nudge; it cannot say which house. Only an absolute identifier can,
which is what a read house number is — so the anchors of item 1 and this check are
complementary instruments, and the anchor yield stops being a side quest.

What this costs: item 1b is closed as done-and-negative, and re-measuring the
remaining 2,600 buildings is now explicitly blocked, because at these properties it
would manufacture 2,600 more readings nobody can use.

### 20. The emptier a reading was, the fewer rules could touch it (2026-09-06)

§19 concluded that the storey ladder was "fragile *and* substantially wrong where
it is stable", on the strength of 32% exact agreement with 3DBAG at MAE 1.21. Half
of that was my own arithmetic, and this section is the correction.

Chasing *why* the ladder flips, the delta histograms turned up buildings moving
from four storeys to **zero** under a 25 cm nudge — and buildings sitting at zero
in the store itself. **Fifty-nine of 422 stored readings have no storey bands, no
bays and no openings.** They score 0.80 against a 0.6 bar and are published as
measured façades. They carry a wall colour and nothing else.

The cause is a structural inversion in `plausibility()`. Every rule in it is
guarded by `storeyBands > 0` or `openings.length` — the interval check, the bay
count, the opening-area share, the window-shape test, the comparison against an
independent count. So a façade with four openings and five bands is checked six
ways, and a reading with nothing in it trips exactly one rule, `no openings
found`, loses a fifth, and passes. **The less a reading contained, the less could
be held against it.** `storeyBands === 0` now scores 0 outright, because with no
bands there are no bays and no openings either: the row cannot support a single
measured field.

Then the correction to §19, because those 59 rows were in the comparison as
genuine zero-storey buildings measured against 3DBAG's four and five:

| against 3DBAG | as reported in §19 | with empty readings excluded |
|---|---|---|
| exact | 32% | **37%** |
| MAE | 1.21 | **0.76** |
| within one storey | 76% | **88%** |
| bias | −0.29 | **+0.30** |

The ladder is a good deal better than §19 said. What survives unchanged is the
fragility — 15–17% of real readings still change under a 10 cm lens nudge, 25%
under 25 cm — and the physical objection, which is now the weakest link rather
than one of three: our ladder implies 2.76 m per storey and puts 52% of buildings
in the plausible 2.6–3.6 m band against 77% for 3DBAG's height-derived count.

Stability separates more cleanly than it did on the contaminated numbers: readings
surviving a ±10 cm nudge are 41% exact at MAE 0.70, against 25% and 0.93 for those
that move.

**And the fragility now has a mechanism, which §19 did not have.** Two modes:

- About 65% of flips are exactly ±1 — an end rung. `storeyLadder` returns every
  rung that fits inside the strip, and the strip's padding is 0.4 m below ground
  and 0.3 m above eaves, both arbitrary. So the storey count partly depends on
  where the ladder's phase lands against a boundary that means nothing about the
  building. The band filter then clips a rung near the edge and drops it.
- The rest switch spacing wholesale, including exact period doubling: pand
  0363100012175410 reads 6 storeys at 2.27 m spacing and 3 at 4.54 m, one nudge
  apart.

That second mode is the same disease as §19's registration check — an argmax over
a near-flat, quasi-periodic surface, with no report of how flat it was. Two
detectors, built years apart for different jobs, failing the same way. The common
fix is the one already applied to the registration check: measure the prominence
of the winning peak and refuse to answer when it is low.

The lesson worth keeping is narrower than "check your instruments". It is that a
confidence score assembled from *failed rules* silently rewards emptiness, because
an absent measurement cannot fail a rule about its contents. A score built that
way needs a floor that asks whether there is anything there at all.

### 21. Correspondence is 76%, and that is the number we have been missing (2026-09-06)

The 400-pand anchor run finished — 4,180 readings from 400 bands in 16,056 s —
and for the first time there is a real answer to the standing question, rather
than a pilot of thirty.

The pilot's ~7% legibility estimate was wrong: **99 of 400 panden carry a legible
number that names a nearby address**, 25%. The pilot was small and unlucky.

What the raw verdicts said, and why the raw verdicts were not the answer:

| | as first counted | after the party-wall rule |
|---|---|---|
| confirmed | 52 | **44** |
| conflict | 23 | **14** |
| party wall (ambiguous) | — | **17** |
| neighbour only | 24 | 24 |
| unread | 301 | 301 |

A conflict was being recorded whenever a foreign number fell inside the wall span
widened by 0.6 m. Measured against the wall's own half-width, a *confirming*
reading sits at 0.46 — mid-wall — and a *conflicting* one at 1.77, past the wall
entirely, with 87% of conflicts within half a metre of a party wall. Those were
the neighbour's plate, seen because the band deliberately carries 0.7 of a
frontage of context on each side. A doorplate sits beside a door and a canal
house's door often sits hard against the party wall, so a plate in that half-metre
could belong to either house.

**The margin applies to both verdicts, and that choice cost eight confirmations.**
Exempting confirmations was the first thing I tried, and it is not defensible: if
a plate at a shared wall cannot convict, it cannot acquit either. The exemption is
worth exactly five points — 81% against 76% — which is the size of the thumb it
puts on the scale. For the record, all three rules:

| rule | confirmed | conflict | confirm rate |
|---|---|---|---|
| original, 0.6 m tolerance both ways, no ambiguous zone | 52 | 23 | 69% |
| margin on conviction only | 52 | 12 | 81% |
| **margin on both — shipped** | **44** | **14** | **76%** |

**So: 76%.** When a house number can be read at all, the wall we projected is the
right house about three times in four. The decoy — the same readings scored
against a house two doors along — confirms **3 of 400** against the real 44, a
15:1 ratio, and it is now judged by exactly the rule that decides a real
confirmation. It was not before, which made it a looser test than the thing it was
controlling for.

Three in four is not "really good correspondence" by any reading, and it is the
first honest measurement of it. It is also the number every downstream confidence
should be derived from, and none currently is.

Two things it does not say. It is a rate among *legible* buildings, which is the
right denominator only because legibility depends on a door's design and not on
our geometry. And the along-band offset of a confirming reading has a median of
1.44 m — worse than the 0.58 m the thirty-band pilot reported, which was a small
sample flattering itself.

Finally, the ladder-prominence diagnostic of §20 checks out. Storey readings whose
winning ladder stood 2σ or more above the field survive a ±10 cm nudge 76% of the
time; those at 1.5–2.0σ, 64%. Monotonic, real, and moderate — enough to confirm
the "argmax over a near-flat surface" diagnosis, not enough to be a fix on its own.

### 22. The storey count was never the thing that was fragile (2026-09-06)

§20 gave the storey ladder's fragility two mechanisms: an end rung falling off an
arbitrarily-padded strip, worth about 65% of flips, and the ladder switching
spacing wholesale, worth the rest. **Both were wrong.** They were inferences from
delta histograms, and one line of code settles it instead:

```ts
})).filter(storey => storey.openings > 0);
```

`storeyBands` does not count storey bands. It counts bands that retained at least
one *confirmed opening*. So a storey exists, for this pipeline, only where a window
was detected in it.

Measured over 726 nudged readings:

| | n | opening count also changed | ladder peak below 2σ |
|---|---|---|---|
| storey count held | 614 | 15% | 24% |
| flipped by 1 | 85 | **100%** | 34% |
| flipped by 2 or more | 27 | **100%** | 37% |

Every single flip — all 112 — came with a change in the opening count, and a
reading whose storey count held usually held its openings too. The ladder's peak
prominence, which §20 leaned on, barely separates the groups at all.

So the chain is: **the opening detector is fragile, and the storey count is its
victim.** About 28% of readings change their opening count under a 10 cm lens
nudge; where that change empties a band, a storey disappears. The 59 empty readings
of §20 are the same fact at its limit — not "the ladder found nothing" but "no
opening was confirmed anywhere on the façade", which is why they have the same
obliquity and standoff as everything else and are spread evenly across every strip
height.

Obliquity supplies the specificity check that makes this credible rather than
merely consistent. It predicts house-number correspondence strongly (§21: 89%
against 65%) and predicts storey-measurement quality **not at all** — MAE 0.87 at
0–3° against 0.73 at 15°+, flat and slightly backwards. That is exactly the
pattern the mechanism demands: obliquity wrecks horizontal localisation, and a
storey band is a vertical measurement. A variable that mattered everywhere would
have been a sign the analysis was picking up something else.

What this changes for the work: fixing `storeyLadder` would have been effort spent
on the wrong component. The target is opening detection — and the honest statement
of the field's quality is that a storey count is only as stable as the weakest
window in the top band.

Three corrections in one session, each narrowing rather than reversing: the lens
was real but not binding (§19), the ladder was better than measured once empty
readings came out (§20), and the ladder was not the fragile part at all (§22). The
common thread is that every one of them came from measuring a component directly
instead of inferring its behaviour from an aggregate.

### 23. Three defects that only opening the page could find (2026-09-06)

The city map built cleanly, typechecked, and reported "3025 panden — 422 measured".
Opening it in a browser found three defects in about ninety seconds, and none of
them would have shown up in a typecheck or a JSON diff.

**The map was blank.** An apostrophe in `3DBAG's`, inside a single-quoted
JavaScript string, inside a TypeScript template literal that ate one layer of the
escape. The whole script threw `SyntaxError: Unexpected identifier 's'` and 3,025
footprints drew nothing. The build script had no way to know: it emits a string.

**Every 3DBAG row was a dash, for every building.** 3DBAG keys its attributes
`NL.IMBAG.Pand.<id>`, sometimes with a `-N` suffix for a split pand; BAG footprints
are keyed by the bare id. The join matched **zero of 3,025** — silently, and the
result looked exactly like a data gap rather than a bug, which is why it survived
into a screenshot. `netherlands.ts` already owned the normalisation and it is
borrowed rather than restated: 2,894 of 3,025 match, 2,892 with a roof height.

**None of the five viewers declared a charset.** Opened as a local file, a browser
guesses latin-1, and these pages are full of degree signs, middots, em dashes and
the word *façade*. Every viewer in this project has been rendering `FaÃ§ade Twin
Explorer` and `Â·` for as long as it has existed, and nobody noticed because
nobody had opened one and read it rather than looked at it. Fixed in all five
generators.

The pattern is worth naming, because it is the third time this month a thing was
believed on the strength of a process completing rather than a result being
inspected: the render still comes out, the file is still written, the count is
still printed. §18's sixteen scripts placed the lens by an uncorrected height and
the picture still appeared. §20's empty readings scored 0.80 and were still
stored. Here a page built and served and was still blank.

Also in this pass: the massing drawing became three extruded solids — roof 50th,
70th and max above maaiveld — instead of a bar chart, because the spread between
those percentiles is a fact about the roof's shape, and that is visible in a prism
and invisible in a number. They are labelled as our extrusions of 3DBAG's heights,
not 3DBAG's own LoD2.2 mesh, which is not cached here.

### 24. Four and a half hours of OCR was a configuration mistake (2026-09-06)

A 400-pand house-number pass took 16,056 seconds — 40 s per band, about 12.6 s per
tile. That number was quoted several times in this log as the cost of an anchor
run, and it shaped the plan: how many panden could be afforded, whether to buy a
commercial vision model, whether identity evidence was worth having at all.

It was `gpu=False`, with EasyOCR's default `quantize=True` forcing a CPU-only
dynamically-quantised LSTM. The torch deprecation warning that opens every log in
this project — `torch.quantize_per_tensor ... deprecated` — was that model
announcing itself, and it had been read as noise for weeks. This machine has MPS,
and EasyOCR 1.7.2 selects it.

**2.71 s per tile against 12.64 s: 4.7× faster.** A 400-pand pass is now about 40
minutes, and the boundary-wide run the identity bar needs goes from a fortnight of
evenings to an afternoon.

Verified before adoption, because a speedup that changes the answers is worse than
no speedup: over 40 tiles both devices returned the same 82 readings, and all 40
tiles matched exactly on text, confidence to two decimals, and box centre to the
pixel.

**The second pass was measured rather than assumed while the question was open.**
Each tile is read twice, plain and autocontrast, on the theory that a number carved
in sandstone is pale paint on pale stone. Halving the work by dropping that pass
was tempting at 12.6 s a tile. The archive says no: autocontrast produces 2,625 of
4,180 readings, and **40 bands — 11% of everything that reads at all — would go
dark without it.**

**A second local optimisation was tried and disproved.** Every tile is magnified
3× before detection, and the arithmetic says that is wasteful: a 13 cm digit needs
about 30 px, and at the median 129 px/m it is already 17 px, so 1.8× would do and
19% of tiles are sharp enough at 1×. Setting `mag_ratio` per tile from its own
`nativePixelsPerMetre` ran **5.65× faster and changed the answers** — 117 readings
became 81, only 8 of 24 tiles matched, and one tile at 317 px/m, where a 13 cm
digit is already 41 px, went from five readings including one at 0.66 confidence
to none at all. CRAFT has its own preferred operating scale; the magnification is
not merely compensating for small digits, and the comment claiming it "feeds a
network trained at a scale" is right in a way the arithmetic missed. Rejected, and
the fixed 3.0 stands.

For the record, since the cost question came up: reading these tiles through a
hosted vision model would cost **$0.42–$1.81 for all 3,025 panden** at current
OpenRouter prices, which is not a reason to hesitate. The reason to hesitate is
that this pipeline needs to know *where along the band* a reading sits — a plate
mid-wall confirms, one within half a metre of a party wall settles nothing — and a
detector returns boxes where a language model returns text. At 5.5 m tiles against
a 0.5 m decision margin, tile-level position would collapse §21's three verdicts
back into one.

### 25. The contradictions are one house wide, and the anchors were used one at a time (2026-09-06)

§21 reported 44 confirming panden against 14 contradicting, and treated the 14 as
a rate. Asked whether the anchors were being used to position a *block* rather
than to check one building at a time, the answer turned out to be no — every band
in `check-number-anchors.ts` is scored alone against its own pand, with no
cross-band reasoning anywhere — and looking at the 14 as a group rather than as a
count says why that matters.

Measuring how far the read number's own BAG address point sits from our wall
centre:

```
+5.96  +5.64  +4.10  −5.25  −0.19  −4.01  +4.76
−5.26  +6.34  −5.47  +4.36  +10.66  −5.68  +6.53
```

Twelve of fourteen fall between **4.0 and 6.5 m**. An Amsterdam canal frontage is
5.7 m at the median. The sign splits 8 one way and 6 the other, so this is not a
systematic offset that one correction would remove — it is **±one house, direction
unknown**, on about a quarter of the panden a reading can decide.

That is the same finding as §19's registration diagnosis arriving by a different
road. Correlating a periodic terrace against periodic plot boundaries has many
near-equal peaks and the search window picks the winner; here the winner is
sometimes the neighbour. §19 said "only an absolute identifier can supply the
lock, which is what a read house number is" — and then the instrument built on
that insight used each absolute identifier **in isolation**, which throws away the
one property that makes it a lock.

**A house number is not just an identifier, it is a position in a sequence.** BAG
holds the sequence and every frontage width, so a single confident anchor pins an
entire terrace: every building between two anchors has a determined place, and a
pand whose wall assignment disagrees with the interpolation is a *detected* error
rather than a reported conflict.

The reach is better than the anchor count suggests. Only 5% of panden sit within
30 m of one of the 44 confirmed anchors, but proximity is the wrong measure. Those
anchors land on **13 streets holding 1,894 panden — 36% of the boundary** — and a
street with one anchor and a known frontage sequence is a street whose every
building is positioned. Forty-four point measurements become constraints on up to
1,894 buildings.

Which resettles the priorities. The last stretch of work went into making OCR
faster — a real 4.7× misconfiguration, worth fixing — but OCR is the *instrument*
that measures identity, not the thing that improves it. Making the measurement
cheaper moved correspondence not at all. Using the measurements jointly would.

### 26. "OCR is slow" was a memory leak I had just introduced (2026-09-06)

§24 moved EasyOCR onto MPS for a verified 4.7×, and the next run was *slower* than
the CPU one it replaced — 0.6 bands a minute against the 10 the benchmark
promised. The tiles were not the cause: the square-on set is smaller than the
oblique one it replaced, 696 megapixels against 825.

`ps` said the process held 613 MB. Activity Monitor said **57.44 GB**, and
`footprint` confirmed a 58 GB physical footprint on a 48 GB machine. RSS does not
count Metal's unified-memory allocations, so the standard tool was blind to the
entire problem — and I had used it twice and concluded the pressure was coming
from somewhere else.

Metal's caching allocator does not release memory on its own, and every tile is a
differently-sized allocation, so nothing gets reused and the cache grows without
bound. By band 100 the machine was at 28 GB of swap with 77 MB free and 1.3
million pageouts, and MPS shares that memory, so the GPU work stalled. Calling
`torch.mps.empty_cache()` once per band costs milliseconds and bounds it: the
footprint now oscillates between 3 and 20 GB instead of climbing, swap fell from
28.4 GB to 4.0 GB, free memory rose from 77 MB to 9.4 GB, and the rate went from
0.6 bands a minute to **11.7 — a twentyfold recovery**, giving the ~40 minute pass
§24 predicted.

Three things worth keeping from this.

The benchmark that justified the change measured 40 tiles and was right about all
of them; it could not see a leak that only matters after a hundred bands. A
verified speedup is not a verified *run*.

The instrument lied by omission. `ps aux` RSS is the reflex for "what is using
memory" and it is simply wrong for Metal, by two orders of magnitude here. On a
Mac the answer is `footprint <pid>`.

And the symptom named the wrong culprit. "OCR takes hours" was true, and it was
never about OCR — first it was `gpu=False`, then it was my own leak. Both times the
number was quoted as a property of the workload and used to reason about whether
to buy a commercial vision model.

### 22. Squareness was worth nine points, on a paired run (2026-09-06)

§21 fixed correspondence at 76% and named obliquity as the one variable that
separated a confirmation from a contradiction — 9.3° against 17.4°. The band
ranking then changed to take the squarest view that still keeps 70% of the best
available resolution, rather than simply the closest. The paired test is now in:
the same 400 panden, re-rendered and re-read.

| | oblique ranking | square-on ranking |
|---|---|---|
| confirmed | 44 | **41** |
| conflict | 14 | **7** |
| decided panden | 58 | 48 |
| **identity** | **76%** | **85%** |

Conflicts halved. Nine points, and because it is the identical pand set the nine
points are the ranking's rather than sampling.

The trade is real and should be stated: ten fewer panden are decided, because the
squarest view is sometimes the more distant one and a smaller plate is a plate
that does not read. 3,644 raw readings against the oblique pass's 4,180. Identity
is a rate among panden a reading can decide, so buying accuracy with coverage is
progress against the owner's bar but not free.

Every one of the seven surviving conflicts is still displaced by about one
frontage — −4.82, −8.06, −3.07, −3.93, −6.72, −0.73, +3.13 m. That is the same
±one-house signature §21 found, unmoved by making the view square. It is not an
aiming error, and no amount of better imagery will remove it. It is what §23 and
the anchoring plan are for.

### 23. The numbers run in order after all, and the disorder was my walk (2026-09-06)

The global-anchoring plan went into `docs/TODO.md` carrying an obstacle presented
as measured: *house numbers run monotonically only 78–95% of the way along the big
grachten*. That number was wrong, and the plan was shaped around it — step 4 was
justified as needing consensus rather than least squares because the sequence was
supposedly unreliable.

**The fault was the estimator's.** To "walk" a street I had ordered its address
points by greedy nearest-neighbour, starting from one end of their principal axis.
On a gracht that walk runs up the bank, meets a stretch with no addresses, and
teleports to wherever the nearest unvisited point happens to be — **up to 1204 m
on Keizersgracht, 752 m on Prinsengracht, 780 m on Herengracht**, 35 hops over
25 m on Prinsengracht alone. Every teleport manufactures a run of inversions. I
had measured my own path-finding and reported it as a property of Amsterdam.

Measured with no walk at all — does the point for number *n* lie geometrically
between the points for *n−2* and *n+2*, which is local and has nothing to get
wrong — the answer is the opposite:

| | tested | out of order | in order |
|---|---|---|---|
| BAG, all answerable triples | 8,575 | 325 | **96.2%** |
| BAG, two numbers share a pand | 2,507 | 192 | 92.3% |
| BAG, all three on distinct panden | 6,068 | 133 | 97.8% |
| BAG, **clean** — consecutive, distinct panden, no orphans | 2,968 | 20 | **99.3%** |
| OSM, independent geometry, all | 11,941 | 560 | 95.3% |

Two guards make it an honest test. A triple whose two outer points are less than
one frontage apart cannot answer the question — 11% of them — so it is not
counted. And OSM's own geometry, which places most addresses at building
centroids rather than BAG's interior points, gets the same answer; that is not
full independence, since OSM-NL is largely a BAG import, but it rules out a fault
in how the BAG file is read.

**So the sequence is a much stronger constraint than the plan assumed**, and the
residual is two named mechanisms rather than noise.

*A pand carrying several numbers has no reliable internal order.* This is the big
one: 92.3% against 97.8%. BAG places one point per address inside the footprint,
and inside a merged pand those points are not in street order. The clean example,
checked on the street rather than argued: Hartenstraat 21, 23 and 25 all belong to
pand `0363100012169173`, `plotWidthM` 20.18 — three and a half frontages, eleven
dwellings, built 1725. BAG puts 21 at lon 4.885801 and 25 at 4.885888, 7 m apart
in that order. The shop standing at 4.88578 is Fred Perry, and Fred Perry's
address is **Hartenstraat 25**. The two points are swapped. The street is in
order; the points inside the pand are not. The consequence for the plan is
concrete: *do not take ordering evidence from a multi-number pand* — treat it as
one unit spanning a numeric range and let the anchor land on the range.

*A square is not a line.* Westermarkt's numbers run 1–37 along one side at
y≈487450, 2–20 along another at y≈487560, 60–74 at y≈487507, 76–82 at y≈487486.
Each run is internally monotonic and every break is a corner. `Westermarkt
74→76→78` is the worst clean failure in the entire boundary — 16.1 m — and it is
not a failure of numbering at all. The plan's step 1 already says a block is a
contiguous same-side run and never a street name; that clause is now load-bearing
and must not be relaxed.

**And curvature turns out not to be the mechanism either.** Measuring straightness
per side — the largest perpendicular deviation from the chord joining that side's
two extreme points, over the length of that chord — and re-running the test inside
each bin:

| side | all triples | | clean triples | |
|---|---|---|---|---|
| a ruler (bend < 1%) | 45 | 100.0% | 31 | **100.0%** |
| nearly straight (1–3%) | 1,089 | 97.9% | 336 | **100.0%** |
| gently curved (3–10%) | 2,813 | 96.2% | 863 | 99.4% |
| a horseshoe (> 10%) | 4,138 | 95.9% | 1,609 | 99.1% |

Every clean triple on a side straight to within 3% is in order — 367 for 367. And
a horseshoe orders its numbers essentially as well as a ruler once a merged pand
and an orphan point are excluded. The apparent decline down the "all triples"
column is confounded: the long curving grachten are also where the wide merged
panden and the orphan points are, so curvature was standing in for them.

There is a third thing this did not overturn. Projecting a gracht onto its
principal axis genuinely is wrong — Herengracht spans 866 m along its own axis and
551 m across it, because it is a horseshoe. The original note was right about
that and wrong about what followed from it: the fix for a curving street is a
local test, not a cleverer global walk.

`scripts/facade-twin/check-number-order.ts` now runs all of this and fails below
98% on the clean case, so the figure the plan stands on is checked rather than
remembered. The OSM cross-check reads a cached `osm-addresses.json`; one Overpass
query built it and it is not re-fetched.

The lesson is the same one §18 taught in a different costume. A number that
supports a design decision has to be measured against something that can
contradict it. "78–95%" felt like diligence — I had gone and measured rather than
assumed — and it was diligence applied to an estimator nobody had validated. The
tell was available and I walked past it: a walk that reports 78% monotonic on a
canal where the houses are visibly numbered in order should have been suspected
before Amsterdam was.

### 24. Blocks are party-wall chains, and the front row only (2026-09-06)

Step 1 of the anchoring plan: `scripts/facade-twin/build-blocks.ts`, writing
`blocks.json`. 5,757 panden into **1,230 blocks**, median 2 members, p90 11, max
33, with 4,661 panden in a block of three or more.

The ordering comes from party walls rather than from projection. Amsterdam canal
houses are terraced, so consecutive houses share a wall and footprint adjacency
*already is* the sequence — the median pand has exactly two touching neighbours
and only 2% have none. That matters because the alternative, projecting a street
onto an axis and sorting, is the exact mistake §23 had to retract. A gracht is a
horseshoe with no single axis; a chain of party walls follows it without needing
one, and stops at a corner by itself. Westermarkt comes out as separate runs with
no special case, because a corner *is* a break in the chain.

**The first version was wrong, and the way it was wrong is worth keeping.** It
scored 97.7% order agreement, and the worst offender was `Willemsstraat/odd`:

    0.0 m   139     6.2 m from the centreline
    12.2 m  141     6.1
    ...
    71.1 m  165     6.3
    76.1 m  163     12.4   <- turned into the courtyard here
    88.0 m  161     17.7
    98.5 m  159     28.2
    ...
    142.9 m 151     12.2

A hairpin. The chain ran up the front row to 165, turned into the block, and came
back along a *rear* row — which is why numbers appeared doubled (163/163, 161/161,
159/159) inside what was called one block. Party-wall adjacency is a 2-D graph in
the Jordaan, not a path, because a voorhuis touches its achterhuis.

The fix is a membership rule, not a cleverer walk: **a block member must front the
street.** Distance is measured from the nearest footprint vertex to the street's
OSM centreline, so a deep house is judged by its front wall, and every house on a
side then sits at nearly the same distance — 6.0–6.3 m on Willemsstraat against
12.4 m for the first rear-row pand. A member is kept if it is within 8 m of the
closest member of its own group. 405 memberships dropped, and order agreement rose
to **98.4%**.

The centrelines are used for *this and only this*. They decide which row faces the
street; they never order anything. That line is worth holding, because reaching
for a street axis to sort by is how §23 happened.

Two smaller things found on the way. The group key was `street + separator +
parity` and was being split back apart on a space — which would have made
`Nieuwe Leliestraat odd` into street `Nieuwe`, parity `Leliestraat`. The key now
carries both fields in its value and is never taken apart. And the file had picked
up two NUL bytes, which is why `grep` had gone silent on it: grep treats a file
containing NUL as binary and prints nothing rather than erroring, so a search that
returns no hits is not evidence the text is absent.

Order agreement is a real test rather than a restatement, because the chain is
built from geometry and the numbers come from BAG. 98.4% says a number read off a
door is a position in a sequence that can be trusted, which is the premise the
rest of the plan stands on.

### 25. There is no block-wide shift, and the plan's step 4 is wrong (2026-09-06)

`scripts/facade-twin/fit-block-shifts.ts` implements steps 3-5 of the anchoring
plan, and its first honest run refutes step 4.

The premise was that the surviving ±one-frontage failures are shared along a
block, because a block shares a camera pass, a stretch of quay and a numbering
sequence. If so, one shift fitted per block corrects a whole terrace from a couple
of readings. Two tests say otherwise.

**The variance does not decompose that way.** Every reading gives a shift
Δ = −offsetM: how far the imagery is displaced along the band axis. Grouping those
shifts and comparing spread *between* groups against spread *within* one:

| grouping | groups | between | within | ratio |
|---|---|---|---|---|
| the block | 29 | 1.98 m | 2.06 m | **0.96** |
| the street | 13 | 1.62 m | 2.42 m | **0.67** |
| the panorama | 27 | 2.02 m | 1.53 m | 1.32 |

A real block effect needs a ratio above 1 — blocks differing from each other by
more than their own members differ among themselves. Both spatial groupings are
*below* 1. The displacement is a property of the individual house, not of the run
it stands in.

The panorama row is not a third result. With one band per pand it is the same
partition as grouping by pand, so its 1.53 m "within" is not a pose effect at all
— it is the plate-to-plate scatter across several plates on one façade, which is
the noise floor the other rows are measured against, and it is very nearly as
large as the whole between-house signal.

**Hold-out agrees, and more bluntly.** Fitting each block's shift with one pand
removed and then predicting that pand: median error 1.62 m with the fit against
1.75 m assuming no shift — and the fit makes **15 of 23 predictions worse**. It is
fitting noise.

*(Figures restated §30. The originals came from a band pair that no longer exists
on disk; these are what `--manifest=manifest.square400-2026-09-06.json
--readings=readings.square400-2026-09-06.json` reproduces today, and the script now
refuses a pair that is not one render. Every ratio moved and not one conclusion
did — both spatial groupings still below 1, hold-out still worse on a majority.
The panorama row rose to 1.32 and is still not a result, for the reason given
below.)*

Two things about how this was nearly missed.

The first version of the file printed *"Within-block spread is the smaller, so a
block-wide shift is a real effect"* over exactly this data. The comparison was
within-block spread against the **pooled** spread — and pooling contains the
between-group variation, so within will almost always look smaller than it. That
comparison cannot fail, which is what makes it worthless. The test has to be
between against within.

The second was the hold-out verdict, which read `median(errFit) < median(errNull)`
and so passed on 1.79 against 1.84 — a 3% improvement, while most individual
predictions got worse. It now requires both a majority of predictions improved and
a materially better median, and it fails.

So step 4 of the P0 plan is wrong as written and `block-shifts.json` must not be
applied. The machinery is kept: the guards are what produced the finding, and the
same decomposition will test whatever model replaces it.

**What this is not.** It is 124 plate readings on 82 panden, of which only 17
blocks carry two or more read panden and 9 carry three. That is thin, and the
sample is dominated by *correctly* registered bands — 41 of 48 decided panden
confirm — so the misregistered minority is spread one-per-block, which is exactly
the shape that would hide a block effect if one existed. A 1,421-band render is
running to raise coverage on the blocks that already hold an anchor, and the
decomposition is recomputed every run.

**What it points at.** If the error is per-house rather than per-run, then the
suspects are per-house too: which footprint edge was chosen as the front wall, and
corner panden whose front faces another street. That is a different investigation
from anchoring, and a cheaper one.

Also here: `assemble` and the doorplate constants moved out of
`check-number-anchors.ts` into `src/canalRecall/facade/doorplates.ts`, so the fit
reads plates by exactly the rule the identity check grades them by. Verified by
re-running the identity check across the move: 41 of 48, 85%, unchanged.

### 26b. Wall choice is not the culprit either, and two angular tests were wrong (2026-09-06)

§25 closed the block hypothesis and pointed at per-house suspects. The first was
wall choice: a band is projected onto one edge of a BAG footprint, and picking a
flank rather than the front would displace it by roughly the building's own
frontage — exactly the observed error signature.

It is not happening. `scripts/facade-twin/check-front-wall.ts` now guards it.

| | bands |
|---|---|
| wall length matches `plotWidthM` — a front | 325 |
| wall length matches `plotDepthM` — a flank | 13 |
| plot too square to decide | 62 |

**96.2% fronts**, and the split by verdict settles it outright:

    unread          front 244   flank 13
    confirmed       front  40   flank  0
    neighbour-only  front  20   flank  0
    party-wall      front  14   flank  0
    conflict        front   7   flank  0

Every one of the thirteen flanks sits in `unread` — which is exactly what a wall
with no door on it looks like — and **not one** sits among the panden a reading
decided anything about. All seven conflicts are on front walls. The lead is
closed.

The route there is the part worth keeping, because two tests were tried first and
both were wrong in ways that would have been easy to believe.

**Against `frontBearingDeg`.** It cannot answer the question: it is `atan2` of a
minimum-area-rectangle edge, so it is ambiguous by 90° and does not distinguish a
front from a flank. The tell was that comparing against it returned a median
disagreement of **51°** across *all* bands including the confirmed ones — and 45°
is what random looks like on a 0–90° fold. A corroboration that comes back at
chance is a broken instrument, not a refutation. The field is misleadingly named.

**Against a local run direction.** Comparing the band's wall against the block
chain's tangent, drawn centroid to centroid, flagged 54 bands as more than 60° off
— 23% — and that looked like a major finding: confirmed bands sat at a median
12.6° against 24.6° for unread, and 133 of 294 unread bands were more than 30°
off, which would have explained a large slice of the 79% unread rate. The corner
confound was checked and killed (panden in two blocks score *better*, median 15.0°
with 2 of 30 beyond 60°). Then the proportions test agreed with **7 of those 54**.

Rather than accept that, the centroid explanation was tested — neighbouring canal
houses have very different depths, so a centroid-to-centroid line is not along the
terrace — by swapping in the street centreline's local direction, which knows
nothing about depth. It flagged **63**, worse, agreeing on 8. So that explanation
was wrong too, and the angular approach is dominated by something neither the
terrace chain nor the centreline captures.

The lesson is about which test wins a disagreement. The proportions test uses one
number per building, from the building's own shape, with no street, no chain, no
camera and no convention to get wrong. The angular tests each need a reference
direction that has to be constructed, and both constructions turned out to carry
more error than the effect being measured. When a simple independent test
contradicts an elaborate one on 87% of the elaborate one's positives, the
elaborate one is what is broken — and the elaborate one here was mine, twice.

Both of §25's per-house suspects are now closed: the block does not explain the
displacement, and neither does wall choice. What remains is the projection itself
— the per-frame camera pose — which is where the next look goes.

### 26c. The pose cannot be tested, and a pre-registered guess about corners (2026-09-06)

With the block (§25) and the wall (§26b) both closed, the remaining suspect was
the per-frame camera pose. **It cannot be tested on this store at all**, and that
is worth writing down rather than quietly working around: the 400 bands use **397
distinct panoramas**. Only three frames serve two panden and none of those decides
two. There is no frame that produces both a confirmation and a conflict, so the
question "is this frame's pose wrong" has no comparison available. Any grouping by
panorama is a grouping by pand wearing a different label, which is exactly the
confound §25 had to point out about its own table.

Nor do the recorded pose attributes separate the two verdicts:

| | confirmed (41) | conflict (7) |
|---|---|---|
| obliquity, median | 1.5° | 2.1° |
| standoff, median | 4.5 m | 5.2 m |
| datum source | 40 segment, 1 run | 7 segment |
| height inferred | none | none |
| leaf-off | all | all |

The obliquity lever from §22 is spent. After the square-on ranking both groups are
essentially square-on, and what is left over is not explained by how the band was
aimed.

**What does separate them is being a corner.** Across three independent
descriptions of the same property:

| | conflict (7) | confirmed (41) |
|---|---|---|
| numbered on more than one street | 29% | 5% |
| sits in more than one block | 29% | 5% |
| carries both odd and even numbers | 29% | 2% |

A sixfold enrichment, and the mechanism was already written down in §23: a corner
building is numbered on the other street, so a plate on the frontage we are
looking at can legitimately belong to a number our pand does not carry on this
street. The two are `168820` (Leidsegracht and Prinsengracht, own 68 and 667) and
`169452` (Eerste Egelantiersdwarsstraat and Egelantiersgracht, own 10, 13, 15).
The other five conflicts are ordinary: one street, one number, 4.87–6.26 m wide.

**This is deliberately not being fixed yet.** It is two cases. A rule that judges a
corner pand against only the street its band faces would take identity from 85% to
at most 89%, and it would be a rule fitted to two observations and then graded on
those same two — which is the thumb on the scale §21 called out, arriving in a new
costume. There is no honest way to earn four points from n=2.

So it is pre-registered instead, before the larger store lands. A 1,152-band
render is running, roughly tripling the decided set. **The prediction: corner
panden — more than one street, more than one block, or both parities — will remain
enriched among conflicts by a factor of three or more, at a base rate near 5%
among confirmations.** If that holds on the larger sample the per-street rule is
earned and can be implemented. If the enrichment evaporates, these two were
coincidence and the note stays as a record of a hypothesis that did not survive.

Writing the prediction down first is the whole point. It costs nothing now and it
is the only thing that stops the larger run from being read as confirmation
whatever it says.

### 27. Coverage is bound by resolution, and the square-on ranking is paying for it (2026-09-06)

Identity is 85% but it is decided on only **48 of 400 panden**. Everything the
project wants — anchoring, propagation, a confidence anyone can derive — is
starved by that denominator, not by the 85%. So: what makes a band unreadable?

Not occlusion. `obstructionColumns` is non-zero on 22% of readable bands and 26%
of unread ones, and *27%* of confirmations against 14% of conflicts, which is
backwards. Either occlusion is not the constraint or that measure cannot see it;
either way it is not evidence for building an occlusion gate.

It is resolution, and the effect is a cliff:

| best tile resolution | bands | produced a real number |
|---|---|---|
| ≤ 100 px/m | 118 | **2%** |
| 100–150 px/m | 43 | 14% |
| 150–200 px/m | 43 | 30% |
| > 200 px/m | 196 | 32% |

**118 bands — 30% of the whole set — are at or below 100 px/m and yield almost
nothing.** A 13 cm digit is about 13 px there, and EasyOCR does not read it. The
same split by verdict says it from the other side: decided bands sit at a median
231 px/m and 5.0 m of standoff, unread bands at 163 px/m and 7.3 m.

Two things follow.

**The yield curve is flat above 200 px/m.** 150–200 gives 30% and beyond 200 gives
32%, so extra resolution past roughly 200 px/m buys nothing, while below 150 it
falls off a cliff. That is a threshold, not a gradient, and a ranking rule should
be written against it.

**The square-on ranking is paying for squareness in coverage, and §22 recorded the
bill without diagnosing it.** The obliquity fix took identity 76% → 85% but dropped
decided panden 58 → 48. The reason is visible now: a squarer view of a canal house
is usually a more distant one, and the ranking's floor is *relative* —
`RESOLUTION_FLOOR = 0.7` keeps 70% of the best available resolution, whatever that
is. On a pand whose best view is 140 px/m, 70% is 98 px/m, which is inside the
dead zone. A relative floor cannot know about a cliff.

So the proposed change, to be run as a paired experiment like §22's and not
before: **make the floor absolute — never accept a view below about 150 px/m when
a closer one exists, and only then prefer the squarest.** The prediction is that
identity holds near 85% while decided panden rise, because the bands it rescues
are ones currently being read at 100 px/m and returning nothing. If identity falls
instead, obliquity was doing more work than resolution and the relative floor was
right.

Not run yet, deliberately: a 1,152-band render is in flight under the current
ranking, and changing the ranking mid-run would leave two stores that cannot be
compared. §22 is only worth anything because it was paired on the identical 400
panden.

### 28. A published height can be present and still be nonsense (2026-09-06)

Chasing why four bands read nothing turned up a black tile — solid black, 42 kB of
it — and then a bug the pipeline had no check for.

`defectsOf` has always rejected a camera height of zero, because Amsterdam
publishes a missing value as a zero, and the comment beside it says a missing
value must never be arithmetic. That is right, it catches 15,312 frames (all of
2024 and 2025), and it was the whole of the check. **A height that is present but
nonsense went straight through.**

Measured against the ground beneath the camera across the frames that publish a
height, the lens sits **2.45 m** up at the median — the survey van, matching
`SURVEY_LENS_ABOVE_GROUND_M` to a centimetre — tight through p95 at 4.65 m and
p99 at 10.66 m, and then it runs away to **97 m above the street**.

They are corrupt, not unusual, and one frame settles it rather than an argument
about distributions: `TMX7316010203-002952_pano_0003_000616` publishes **106.1 m**
and shows an ordinary canal-side street from about two metres, the survey van's
own roof rack in the bottom of the frame.

What believing one costs: the band is aimed sixty metres downwards, the projection
lands in the panorama's black nadir cap — which begins at −57° elevation — and the
tile comes back solid black. Four of the 400 bands in the number-band store are
black for exactly this reason, and every one was filed **`unread`**, which reads as
"the doorplate was illegible" rather than "we photographed the ground".

Three near-misses in how this was found, each worth more than the fix:

- **`missingFraction` is zero on all 1,633 tiles**, including the black ones. It
  counts samples landing *outside* the source image; these land inside it, where
  the pixels are simply black. A field that exists to catch bad sampling did not
  catch bad sampling, because the failure was upstream of it.
- **The first instinct was that this was a render bug, and at scale.** It is a
  render bug, but 15 tiles of 1,633 — 0.9% — across 4 of 400 panden. A dramatic
  black image is not evidence of a widespread fault, and scanning every tile
  before saying so took two minutes.
- **The first count of "implausible heights" was 12% of the archive**, which was
  wrong: it lumped the 15,312 known zero-height frames in with the genuinely
  corrupt ones. Separated, the zeros are already handled and the real defect is
  **631 frames, 0.51%**.

The fix goes where the ground is known — `lensHeightNap`, not `defectsOf`, which
cannot see it. A published height implying a lens outside −3 to +12 m above ground
is treated as *missing*, taking the inference path the 2024–25 frames already use,
and is reported as `inferred: true`. Not clamped: a wrong height quietly corrected
is still a wrong height nobody knows about.

The bound is set wide on purpose. It rejects the physically impossible and does
not second-guess the per-track vertical datum, which is `solve-track-datum.ts`'s
job and already tolerates 8.5 m of drift. With p99 at 10.66 m, +12 m rejects
nothing a real survey produced.

`check-lens-height.ts` holds it. After the fix the accepted population has a
median of **2.44 m above ground** — `SURVEY_LENS_ABOVE_GROUND_M` exactly — and the
631 rejections cluster in five survey tracks (002033:141, 001674:124, 003026:115,
002549:85, 003004:73) rather than scattering, which is what a datum fault in one
run looks like and not random corruption. `check-inferred-height` still passes at
median −0.03 m; all 23 camera checks, 22 record checks and 44 boundary checks pass.

Note for pairing: the 1,152-band render in flight predates this fix, so its bands
come from the old behaviour. It affects at most a handful of them, all of which
were black.

### 30. The bound that scored 100% was measuring its own definition

The plan for this stretch was to add an offset bound as a second pre-registered
diagnostic beside the confidence floor. The numbers looked emphatic. Measured by
verdict, the distance from a reading to the address point of the number it reads:

```
own number, on a confirmed band                n= 52  median  1.04 m  p90  2.51
a NEIGHBOUR's number, neighbour-only band      n= 13  median  0.89 m  p90  3.30
a neighbour's number, conflict band            n=  8  median  4.79 m  p90  8.06
```

and a 2.5 m bound took identity from 87% to **100%**. A conflict, the story went,
is not the neighbour's plate seen from our band — if it were, it would appear
where the neighbour's door is. At 4.79 m off it must be a misread.

It is not a misread. It is a definition.

A convicting reading is one that sits **well inside our wall**, that being the
rule that makes it convict. And the number it reads belongs to a pand whose own
address point lies **outside** our wall — in 7 of 8 cases, by a median of 3.08 m.
The two conditions are the conflict verdict, and together they force the offset
to be large before any recogniser is consulted. Computing the smallest offset each
conflict could legally have had:

```
conflicts, doorplate, own-number point locatable: n=8
  actual |offsetM|        median 4.79 m
  forced by construction  median 3.58 m
  residual                median 0.72 m
  4 of 8 sit within 1 m of the smallest offset the geometry allows
```

0.72 m of signal in a 4.79 m effect. The bound scores 100% because it re-derives
the verdict it is scoring, and a diagnostic that cannot fail is not a diagnostic.
Not wired. This is the third time this session the same shape has appeared —
§25's pooled variance, §21's decoy scored by a looser rule than the verdict — and
the tell each time was a result arriving cleaner than the question deserved.

The corroboration argument fell with it. I had reported r = −0.50 between
confidence and offset as evidence that the two are "only partly the same signal,
so they check each other". Within the confirmed readings alone that correlation is
**+0.06** on 52 plates. The pooled −0.50 was the verdict split showing through,
not a relationship. The confidence floor still stands — EasyOCR computes it
knowing nothing of BAG, so it is genuinely independent of geometry — but it stands
alone, with no second signal agreeing with it.

### What survived: registration can be measured, and separately from identity

The claim that was not circular is the one about position agreeing with BAG when
nothing forced it to. Doorplates reading a number that is **not ours** are selected
by no positional filter at all — unlike the conflict set, whose definition is its
position — so their distance from BAG is a clean measurement of whether the band's
coordinate frame is right, and it can be asked of far more readings than the 45
panden whose own doorway happened to be legible.

```
registration — 44 doorplates naming a number that is not ours land a median 2.12 m
from where BAG puts it, against 7.61 m by chance (inside a metre 25% against 5%).
```

Three times better than chance placement, five times as often inside a metre. The
frame is real. It is also **loose**: a median error of 2.12 m is about half a
frontage, which is the ±one-house story appearing as a measurement instead of an
anecdote. That matters for what to fix next — a frame a metre out and a frame on
the wrong building both surface as conflicts, and they are not the same defect.
n = 42 is thin; the 1,013-band read is what settles the size.

This is the headline `TODO` has been asking for since cross-view correlation was
found to be measuring image similarity rather than registration — *"the
registration headline should come from [anchors], not from correlation. This is
the blocker for everything else being believable."* The two now sit side by side:

| instrument | median | within 1 m | what it compares |
|---|---|---|---|
| cross-view correlation, one view per year | 1.25 m | 42% | one photograph against another |
| doorplate against BAG | 2.12 m | 25% | the wall against the cadastre |

### The two files were from different renders, and nothing said so

Every figure above was first computed against a mismatched pair. `manifest.json`
held the 1,013-band wide render finished at 14:16; `readings.json` still held the
400-band square OCR from 12:08. They share **358 of 1,013 bands**.

It could have been worse than it was. Readings join to a band on pand *and*
panorama, so one photograph's readings can never land on another's geometry — the
failure mode is silent sample loss instead: every pand whose chosen view differs
between renders finds no readings and falls to `unread`. The identity line read
39 of 45 where the matched pair reads **41 of 47**, and a reader had no way to see
that two panden had gone missing. The conclusions all survived re-running on the
matched pair — registration 2.12 m either way — but half a dozen quoted figures
moved a point or two and are corrected above.

`check-number-anchors` now states the overlap on every run and refuses below 50%.
`check-front-wall` and `fit-block-shifts` read the same defaults and got the same
treatment: both take `--manifest=`, the first honours the stamp anchors.json now
carries, the second states its own overlap. Re-run matched, front walls reproduce
exactly at 96.2%; §25's ratios all moved and its conclusions did not, and are
restated there.
The message names both files, because the fix is always to pass `--manifest=` and
`--readings=` from one render, and the previous behaviour was to quietly report
from whatever remained.

This is the fifth instance of the session's one shape, and the plainest: **the
denominator was not what it appeared to be.** The others were an estimator
counting something twice; this was two files that looked like a pair.

### What the 2.12 m is made of

Two questions follow, and the first one has a clean negative answer. BAG address
points belong to *verblijfsobjecten*, and a unit's point is its centroid — so a
systematic gap between "where BAG says the address is" and "where the door
physically is" would inflate the metric without any pose error at all. Measured as
a position within the pand's own frontage, over 52 confirmed plates:

```
0 = left party wall, 1 = right, over 52 confirmed plates
  the doorplate      mean 0.47
  BAG address point  mean 0.48
  plate minus BAG    mean -0.02   → -0.09 m on a 6.1 m frontage
```

No convention offset. BAG points sit where the doors are, and a whole class of
explanation for the 2.12 m is ruled out.

The second question needs readings that *share* a pose, and a band carrying two
doorplates provides exactly that: their disagreement contains no registration error
whatsoever, only the intrinsic gap between a plate and the address point it names.
The spread of band **means** carries that plus pose. Between-group against
within-group, the decomposition §25 got wrong the first time by differencing
against the pooled spread.

It reported intrinsic 1.93 m against pose 2.03 m on 20 bands — pose 58% of the
variance — and that is **wrong**, caught within the hour and before anything was
built on it. Two plates are two observations only if they name *different houses*.
"91" and "91C" are one physical plate the assembler produced twice:

```
same house, different unit (91 / 91C)   n=19  median 0.01 m
different houses (91 / 93)              n=14  median 1.27 m
```

A median of 0.01 m is not agreement, it is the same reading counted twice, and 19
of the 33 pairs were that. Collapsing to one reading per house number leaves **9**
genuine bands, df 9, on which the intrinsic term exceeds the between-band spread
outright and pose cannot be distinguished from zero at all.

So the split is undetermined on this store, and the instrument now says so rather
than printing a number: below 15 bands carrying two distinct house numbers it
refuses, on the same rule the corner prediction is held to. A variance ratio from
nine groups is arithmetic, not evidence.

The pattern is worth naming, because this is the fourth instance in one session
and the first three each survived longer: §21's decoy scored by a looser rule than
the verdict, §25's pooled variance, §30's offset bound, and now a group count
inflated by duplicates. All four had the same tell — **the estimator quietly
counted something twice, or counted something its own definition had already
placed.** The defence that keeps working is not more care, it is making each
instrument state its own denominator and refuse when the denominator is too small.

The anchor figure is **worse, and it is the one to quote.**The anchor figure is **worse, and it is the one to quote.** Correlation asks
whether two views of a wall agree with each other, which shares and therefore
cancels the per-track pose error; the doorplate asks whether the wall is where
the cadastre says the building is, which is the question every downstream use
actually needs answered. A metric getting worse when it stops cancelling its own
dominant error term is the metric working.

### An OCR error provable without any reference data

Every line above compares a reading against BAG, so none of them can separate a
misread plate from a misplaced band. One test can, because it never leaves the
image: when two assembled candidates sit at the **same position on the wall**,
they are the same physical plate, and one plate cannot be two houses. Whichever is
wrong, the disagreement *is* an OCR error — no cadastre, no pose, no ground truth.

Laid over the six conflicts, with what each pand actually carries:

```
167667  own 16    read "14"   conf 0.23
167769  own 19    read "25"   conf 0.13
168272  own 122   read "120"  conf 0.71   ] one plate at 8.51 m,
168272  own 122   read "124"  conf 0.54   ] and neither reading is 122
168540  own 91    read "93"   conf 1.00
168705  own 41    read "45"   conf 0.19
168820  own 68    read "62"   conf 0.30
```

The 122 case settles itself. One plate, two candidates, neither matching the house
— that conviction is a misread, and the finding needs nothing outside the picture
to establish it. (An earlier version of this measurement clustered *raw* readings
and reported 91% disagreement, which was meaningless: raw detections are single
digits, so "3" and "4" beside each other are one number's digits, not two
readings contradicting each other. On assembled candidates the sample is 19
positions, and the instrument refuses below 25.)

Two conflicts of the six were prefix-truncations of our own number — the
hypothesis that sent me looking. Neither was. Five of the six differ from the
house's own number in one digit, but so does a neighbour on a canal terrace, so
that pattern separates nothing.

**The exception is the one the owner already adjudicated.** Singel 91 reads "93"
at confidence **1.00** — and shown that band, the owner's verdict was that 93 *is*
the brick building next door and 91 is the middle house of the front. That is an
outside witness, reached without reference to any of this, agreeing that this
particular conviction is a genuine registration failure rather than a misread. It
is also the only conflict with confidence above 0.71.

What the pre-registered floor does with that is worth stating exactly, because it
is not the clean story: at 0.425 it removes four conflicts and keeps two — the
genuine Singel case, and the 122 misread that self-consistency proves is an OCR
error. The floor removes most misreads and keeps the real failure, and it is not a
clean separator, and both halves of that belong in the record.

### The slice that changes a verdict: neighbour-only bands are registered correctly

The one claim that was not circular is the one about the discarded verdict.
`neighbour-only` means real numbers were read and every one fell outside our wall,
so the band decides nothing about identity and is currently thrown away. But if a
plate reading a *neighbour's* number lands where BAG puts that neighbour's door,
the band's **registration** is right, whatever our own doorway carried.

That claim has an honest null: had the plate read some other number from the same
band's address pool, how far from the plate would it have sat? Without the null it
is unreadable, because a short band puts every candidate close to everything.

```
Of those, the 13 on neighbour-only bands sit 0.89 m out — registered correctly,
undecided only because our own doorway was unreadable.
```

Against the 2.12 m of the general population these sit at 0.89 m, and against a
chance null they are several times closer. So ten bands that the
identity check records as undecided are in fact evidence that the wall inside the
bracket is the right wall: the failure is the doorway, not the geometry. Identity
and registration are separate failures with separate fixes, and
`check-number-anchors` now reports them separately.

`localAlongM` is carried onto each result so the null is built from the band's own
address pool rather than a re-derived one that could drift from the filter §29
added.

## 29. A person looked at the picture and found a bug in the matcher (2026-09-06)

`build-conflict-sheet.ts` draws each failing band as one continuous strip at a
common scale, with our wall bracketed in green and every nearby address pinned
where it actually is. It was built to ask a human a question the statistics could
not answer: *is this the house next door, or the right house with a neighbour's
plate in shot?*

The first person to look at it asked a different question — what were those
`64 64F 64G` pins doing on a Singel façade — and that was the bug.

**They were Spuistraat, 31–38 m behind the wall.** Singel and Spuistraat run
parallel with one block of deep canal houses between them, so the backs of the
next street land inside the band's along-window. The matcher had **no
perpendicular bound at all**: it took every address within 30 m of the band centre
whose along-coordinate fell in the span, and asked only whether the number
matched. A misread digit finding a Spuistraat number therefore counted as "a real
number naming a nearby address" and was then judged against our wall.

How much of the store this touched, by verdict — the share of matched readings
naming a street other than the band's own:

| verdict | matched readings | foreign street |
|---|---|---|
| confirmed | 66 | 6% |
| conflict | 12 | 8% |
| party-wall | 26 | 0% |
| neighbour-only | 26 | 23% |
| unread | 21 | 43% |

The bound is measured rather than picked. Across the 400-band store an address
point belonging to the band's own pand sits **4.1 m** behind the wall line at the
median and 22.0 m at p95; the other points falling in the same along-window sit at
**46.5 m** median. A 20 m bound keeps 93.5% of a band's own addresses and rejects
76% of the rest.

Re-scored on the identical 400 panden: **conflicts 7 → 6, confirmations unchanged
at 41, identity 85% → 87%.** That is what a correctness fix should look like — it
removes a false match and leaves the true ones alone. It is not tuning: nothing
about the change was chosen by watching the rate.

Two other things that came out of the same conversation.

**Reading confidence separates the verdicts almost completely, and nothing was
using it.** Confirmations have a median recogniser confidence of **0.96** with 2%
below 0.35; conflicts have a median of **0.30** with 57% below. Lindengracht "25"
at 13%, Bloemgracht "45" at 19%, Leliegracht "14" at 23%. So a substantial part of
the ±one-frontage displacement chased through §25, §26b and §26c is not
registration error at all — it is a misread digit landing on a plausible
neighbour, which on a canal terrace is always available.

A floor is pre-registered rather than fitted, because tuning one to maximise
identity on seven cases is worthless. It is set from the **confirmations'
distribution alone**: their 5th percentile is **0.425** — "less sure than 95% of
readings that turn out to be right" — chosen without looking at a single conflict.
Applied to the 400 store it keeps 39 of 41 confirmations and 3 of 7 conflicts.
**The prediction, recorded before the larger run lands: identity rises to about
92–93% while keeping about 95% of confirmations.**

**And the human testimony agreed with BAG.** Asked about Singel 91, a person read
the street: 89 is the narrow house, 91 the middle three-bay one, 93 the next along.
BAG puts 89 at along 2.5 m, 91 at 7.2–7.5 m and 93 at 13.1 m, and our wall spans
4.14–10.06 m — so the bracket *is* on 91 and that conflict is false. The reading
that convicted it was a "93" placed at 9.2 m when 93's own address point is at
13.1 m, a 3.9 m positional error inside the band. Worth holding onto: a reading
can be right about the text and wrong about the place, and `MAX_ANCHOR_OFFSET_M`
of 9 m is deliberately wide enough to let that through, because narrowing it would
also blind the check to the one-house registration error it exists to catch.

Also: `check-number-anchors.ts` now takes `--manifest=` and `--readings=`, so a
superseded pair can be re-scored at any time and a long OCR run writing
`readings.json` does not block measuring something else. That is how the 85% → 87%
above was measured while the 1,013-band read was in flight.
