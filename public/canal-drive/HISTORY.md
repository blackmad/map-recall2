# Canal Recall — what is built

Finished work, newest first. The work board is `TODO.md`; nothing unfinished
belongs here.

Entries keep the words they were written in, because each records *why* a thing
is the way it is, and that is the expensive part to recover later.

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
