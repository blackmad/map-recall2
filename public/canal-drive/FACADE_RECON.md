# M0 reconnaissance — Amsterdam façade twin, pilot boundary

Status: **M0 complete for RECON-1 through RECON-4, and for the observation
survey behind RECON-6…9.** RECON-5 (PDOK ortho roof colour) and RECON-10
(quay, water level, bridges) are not started — and RECON-5 now blocks a field:
roof material is `default` on every record until it runs.

Coverage measured for the whole boundary: 17,251 elevations, 139,937 panorama
poses, **26.5% of elevations frontal and 88.6% of buildings with a frontal view
of at least one elevation**, 86.7% of those leaf-off. Façade *measurement* on
top of that coverage is not validated — see the caveat under RECON-6…9.

Every number here is measured from the sources named beside it. Where this
document contradicts an estimate in
[`AMSTERDAM_FACADE_TWIN.md`](AMSTERDAM_FACADE_TWIN.md), the measurement wins —
that document says so itself.

Regenerate with:

```bash
npm run recon:facade                                        # every declared area
npx tsx scripts/facade-twin/recon.ts --area=amsterdam-grachtengordel-west
npx tsx scripts/facade-twin/recon.ts --area=... --refresh   # bypass caches
```

Outputs land in
`public/data/extracts/amsterdam/staging/facade-twin/<areaId>/{recon.json,boundary.geojson}`.
Nothing is published to a versioned extract yet, by design.

## The pipeline is source-adapter driven, not Amsterdam-shaped

The first cut of this welded the BAG endpoint, the 3DBAG endpoint, the RCE
register and a ring of five named canals straight into four scripts. That was
the wrong shape, and not merely untidy: **BAG, 3DBAG and the Rijksmonumenten
register are national registers.** A pipeline welded to one city throws away the
fact that Utrecht, Rotterdam and Den Haag are already covered by exactly the
same sources, and it has no way to express what a city outside the Netherlands
would need instead.

So reconnaissance is now written against three narrow interfaces in
`src/canalRecall/facade/sources.ts`, each answering one question a façade
reconstruction has to ask of the world:

| interface | question |
|---|---|
| `BuildingRegistry` | which buildings are here, and what is each one called? |
| `MassingSource` | how tall is it, what shape is its roof, and how much do you trust your own answer? |
| `HeritageSource` | has anyone described this building's façade in words? |

plus `ProjectedCrs`, because façade measurement is metric work and every city
declares the metre-based CRS its own registers are published in. The Dutch
implementations live in `sources/netherlands.ts`; adding a Dutch city is an
entry in `areas.ts` and nothing else.

A survey area is likewise declared data, in one of two shapes — a **corridor**
ring that follows named linear features with a per-leg outward offset (what the
canal ring needs), or an explicit **polygon** (for areas whose edges are not
linear features). Both resolve to a ring in the city's CRS with membership by
footprint intersection.

**Verified by running it elsewhere.** `utrecht-binnenstad-north` — the
Oudegracht wharf-canal fabric, declared as a polygon — runs through identical
code: 2,378 buildings, 2,171 matched to 3DBAG, 617 heritage listings, median
plot width 6.6 m. No Amsterdam-specific code was involved, and the Amsterdam
numbers reproduced exactly across the refactor.

One Utrecht number corroborates the central Amsterdam finding below: pitched-roof
reconstruction error there is **0.38 m** median against Amsterdam's **0.60 m**.
The canal ring's roofs really are unusually complex, rather than 3DBAG being
uniformly weak on pitched roofs.

Amsterdam is the focus; the other area exists to keep the pipeline honest about
what is city-specific and what is not.

---

## Coordinate system — settled and pinned

Work is in **RD New (EPSG:28992)** with **NAP** heights, reprojected once at the
pipeline edge, per the brief.

`src/canalRecall/facade/rdNew.ts` implements the Schreutelkamp / Strang van Hees
polynomial approximation of RDNAPTRANS. Measuring it against 24 authoritative
RD/WGS84 pairs from PDOK's own Locatieserver showed the raw polynomials sit a
**constant 0.183 m east, 0.234 m north** off PDOK's published WGS84 — spread
about a centimetre from Kerkrade to Groningen. A constant that stable across
300 km is a datum offset, not approximation noise, so it is subtracted as a
measured constant (`NSGI_ALIGNMENT_M`) rather than tolerated.

A second session measured the same offset independently, against a different
endpoint (PDOK BAG dual-CRS reprojection) and a different point set, and got
0.184 E / 0.233 N — one millimetre apart. The lineage is settled.

Residual after correction, pinned in `scripts/check-facade-coordinates.ts`:

| scope | mean | worst | tolerance |
|---|---|---|---|
| inside the pilot boundary | 1.0 mm | 1.4 mm | 5 mm |
| nationally | 1.8 mm | 11.0 mm | 15 mm |

Two tolerances because the residual has a shape: once the datum offset is gone,
what remains is a polynomial fit centred near Amersfoort, smallest mid-country
and largest at the coasts. The tight number is the one façade measurement
depends on — the pipeline measures from 12.5 cm orthophoto pixels, and 1.4 mm is
a hundredth of a pixel.

**Fixed local origin: RD (120700, 487500)**, on the Westermarkt 44 m from the
Westerkerk tower. Documented in `rdNew.ts`, pinned by the check, never to change.

**Water and datum constants** are explicit with a source, not eyeballed:
canal water level **−0.40 m NAP**; nominal quay crown **+1.05 m NAP**, always
superseded by an AHN measurement per quay segment, because a canal that renders
level across a kilometre is wrong.

---

## The boundary — fixed

`src/canalRecall/facade/surveyArea.ts` and `areas.ts`, published to
`staging/facade-twin/pilot-boundary.geojson`.

The boundary follows **canal centrelines**, not a bounding box and not chords
between corner junctions — the ring curves continuously, and a chord cuts off
the outside of every bend. Each leg is then pushed **outward** far enough to
reach the building row on the far bank, because the brief puts *both banks* of
every boundary canal in scope. Membership is **BAG footprint intersection**.

| leg | length | outward offset | why |
|---|---|---|---|
| Brouwersgracht | 433 m | 42 m | narrower than the main grachten; reaches the north-bank warehouses without touching Haarlemmerstraat |
| Singel | 1164 m | 45 m | Brouwersgracht down to the canal's south end at Koningsplein |
| Herengracht | 125 m | 45 m | the south-east closure — see below |
| Leidsegracht | 302 m | 45 m | south edge; the Gouden Bocht beyond it is the stretch sector |
| Prinsengracht | 1691 m | 95 m | west edge, widened to take the first Jordaan row behind the west bank |

Offsets are measured against real cross-sections, not picked. A Grachtengordel
canal is ~25 m of water plus ~12–15 m of quay each side, so the far-bank front
wall is ~27 m from the centreline; 45 m lands 18 m into a plot 30–55 m deep.

The 95 m west offset was set from measured perpendicular distances, not
assumed — Bloemstraat 12 sits 54 m and Egelantiersgracht 12 sits 49 m west of the
Prinsengracht centreline (first row behind, **in**), while Bloemgracht 60 sits
109 m west (second row, **out**).

**Two geometric facts the brief's four-canal description does not cover:**

1. **Singel does not reach Leidsegracht.** It ends at Koningsplein. The
   south-east corner is closed *along Herengracht*, which does reach both — a
   125 m leg from the point nearest Singel's south end down to
   Herengracht × Leidsegracht. The whole ring therefore stays on canal
   centrelines rather than hopping across a block.
2. **The district is not 1.1 km × 0.7 km.** Measured extent is
   **0.95 km × 1.77 km**, area **0.873 km²**. Brouwersgracht to Leidsegracht
   along Prinsengracht is 1.69 km. The brief's estimate was roughly half the
   true north–south run.

Every canal junction in the ring is an exact shared OSM node (gap 0.00 m); the
only non-zero gap is the deliberate 111 m Koningsplein closure.

### Named regression locations

`scripts/check-facade-boundary.ts` pins **36 addresses** — 23 inside, 13
outside — each with its BAG `pand_id` and real footprint, committed as a
fixture. All nine Negen Straatjes cross-streets and every hero building are in
the inside set; the Gouden Bocht is in the outside set because it is the stretch
sector, not the core. 44 checks, all passing, including ring simplicity.

One case is pinned specifically because it distinguishes the two candidate
membership rules: **Singel 411's BAG address point is 79 m from the Singel
centreline — outside a 45 m offset — while its footprint plainly intersects the
boundary.** Address points sit deep inside blocks. Testing them instead of
footprints would silently drop far-bank buildings while appearing to pass.

An offset ring also self-intersects wherever the offset exceeds the local radius
of curvature; one such loop appeared at a kink in Singel and is excised by
`removeSelfIntersections`. Left in, it would have inverted inside/outside for
every building near it.

---

## RECON-1 — the pand inventory

Source: PDOK Kadaster **BAG OGC API Features v2**, collection `pand`
(`api.pdok.nl/kadaster/bag/ogc/v2`). Paged by cursor at 1000/page.

- **5,757** panden in the boundary bounding box
- **3,025** intersect the boundary — **this is the pilot's building count**
- **2,950** are `Pand in gebruik`; 34 demolished, 22 never built, 7 under permit

The brief guessed "roughly two thousand buildings". It is **3,025**, about 50%
more, and 2,270 of them are canal-house-shaped (3.5–9 m wide).

Plot geometry, from the minimum-area rectangle of each footprint — the short
side is the façade width the whole measurement pipeline scales from:

| percentile | plot width | footprint area |
|---|---|---|
| p5 | 3.4 m | 19 m² |
| p25 | 4.6 m | 51 m² |
| p50 | **5.7 m** | 82 m² |
| p75 | 7.6 m | 139 m² |
| p95 | 16.7 m | 401 m² |

A 5.7 m median plot is the canal-house grammar showing up in the data.

`bouwjaar`, by quarter-century (BAG registration year, which for a canal house
is often a later rebuild rather than first construction):

```
1005 (unknown)   215      1725   380
1600             114      1750   350
1625             123      1775   120
1650             176      1800    62
1675              73      1825    70
1700             180      1850   140
                          1875   215
                          1900   348
                          1925   150
                          1950    51
                          1975   177
                          2000    73
```

**215 buildings (7.1%) carry BAG's `1005` sentinel, meaning no known
construction year.** They must not be routed as if they were medieval. Pre-1800
is 1,046 buildings, with a clear 1725–1775 peak of 730 — the great refacing era,
which is consistent with the *lijstgevel* dominance the monument register shows
below.

---

## RECON-2 — 3DBAG massing and reconstruction quality

Source: **3DBAG API** (`api.3dbag.nl`), collection `pand`, 32 tiles of 250 m.

Two API behaviours worth writing down: the bbox must be **RD**, and a WGS84 bbox
returns zero features rather than an error; and **`offset=0` returns HTTP 500**
because its offsets are 1-based, so paging must follow the server's own `next`
link rather than synthesise one.

- **2,894 of 3,025** inventory panden matched by `pand_id` — **95.7%**. The 131
  unmatched are a gap to chase, not a rounding error.
- Roof type: 2,783 `slanted`, 77 `horizontal`, 32 `multiple horizontal`
- AHN campaign: 2,106 from AHN5, 696 AHN4, 92 AHN3
- LoD2.2 geometry valid: 2,756 true / 138 false
- **93.7%** are structurally sound (valid geometry, sufficient point cloud,
  quality indicator set)
- Storeys: 1,092 four-storey, 1,067 five-storey, 216 three
- Ridge above ground: p25 12.7 m, **p50 14.9 m**, p75 17.0 m

### The finding that should change the plan

`b3_rmse_lod22` — how well 3DBAG's own reconstruction fitted the point cloud —
has a median of **0.59 m** across the pilot. The obvious move is to threshold it
at 0.5 m and promote what passes. That keeps only **39%** of the boundary, which
would gut the pilot.

Splitting the same number shows the threshold is measuring the wrong thing:

| | count | median RMSE | within 0.5 m |
|---|---|---|---|
| pitched (`slanted`) | 2,783 | **0.60 m** | 38% |
| flat (`horizontal`) | 111 | **0.11 m** | 66% |

and it is **flat across plot width** (0.53–0.62 m from <4.5 m plots to >20 m
plots) and **flat across century** (0.57–0.62 m from pre-1800 to 1900+). The
narrow-plot and old-building hypotheses are both wrong.

So the residual tracks **roof complexity, not reconstruction failure**. A canal
roof with dormers, chimneys, a stepped gable and a ridge has real geometry that
LoD2.2 planes do not represent, and the point cloud faithfully reports the
difference. A single global RMSE gate would reject buildings *for being
interesting* — exactly backwards here.

**Consequence for M1 and the fidelity ladder:** 3DBAG LoD2.2 is a sound
foundation for footprint, wall planes, storey count and eaves height, but its
*roof and gable top* is not trustworthy for the 96% of the pilot that is
pitched. The gable — the single most identifying feature of a canal house, and
the thing the brief exists to reconstruct — has to come from façade observation,
not from massing. The promotion gate must be calibrated per roof type against
hand-verified buildings (M4's calibration corpus) before it decides anything.

---

## RECON-3 — the Rijksmonumenten register

The brief calls this the highest-value and most overlooked source. It is also
**not where anyone would look for it**, which had already blocked one session.

Dead ends, all HTTP 404: `api.pdok.nl/rce/rijksmonumenten/ogc/v1`, the same
under `v1_0`, `service.pdok.nl/rce/rijksmonumenten/wfs/v1_0`, and the PDOK atom
index. `api.pdok.nl/rce/beschermde-gebieden-cultuurhistorie/ogc/v1` exists but
serves *protected areas*, not individual monuments.

**The two endpoints that actually work:**

| what | where |
|---|---|
| geometry + monument number + category | `services.rce.geovoorziening.nl/rce/wfs`, `rce:NationalListedMonumentPoints` (also `…Polygons`, `Townscapes`, `WorldHeritage`) |
| the *redengevende omschrijving* text | `api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho/services/cho/sparql`, predicate `ceo:heeftOmschrijving` on `ceo:Rijksmonument` |

Measured inside the boundary:

- **1,764** rijksmonumenten
- **1,568** carry a description (88.9%)
- **1,493** of the 1,764 monument points land inside a BAG footprint — 15% miss,
  because much register geometry is flagged `kwaliteitsindicator: globaal`
- **989 of 3,025 panden (32.7%)** carry at least one monument record

Monuments and buildings are **not one-to-one**: one canal house can carry
several records. Counting monuments and calling it building coverage would
overstate the register's reach by nearly two to one.

### What the descriptions actually contain

The brief expects them to "frequently state the gable type, storey count, window
arrangement, cornice type, sandstone ornament and construction date". Measured
against 1,568 real descriptions, that is **half right**, and the half that
fails matters.

| feature named | share of described monuments |
|---|---|
| any gable word | 96% |
| **a specific gable type** | **70.1%** |
| — *lijstgevel* / kroonlijst | 42% |
| — *halsgevel* | 17% |
| — *klokgevel* | 7% |
| — *puntgevel* | 3% |
| — *trapgevel* | 2% |
| century date (XVII–XIX) | 36% |
| sandstone | 9% |
| *pui* / shopfront | 9% |
| *stoep* / bordes | 9% |
| dormer | 5% |
| gable stone | 4% |
| **bay count** (*Nraamsgevel*) | **3%** |
| hoisting beam | 2% |
| **storey count** | **1%** |
| sash windows | 1% |
| *kruiskozijn* | 0.3% |
| *klauwstukken* | 0.3% |

Median description length is **88 characters** — a sentence, not a paragraph.
A representative one, monument 2269:

> "Pand met zandstenen vierraamsgevel onder rechte triglyfenlijst waarin
> consoles (XVIIIc) met gebeeldhouwde deuromlijsting, waarin empire deur."

That single sentence yields dressings (sandstone), bay count (four), cornice
type (straight triglyph with consoles), date (third quarter 18th c.) and a
sculpted door surround — five fields of the parameter record, from a
conservator, with no photograph involved.

**So the register is a strong gable-type source and almost nothing else.** It
independently states a gable type for **695 of 3,025 panden — 23.0% of the
pilot** — which is a real head start on the hardest and most identifying field.
It does **not** supply bay count, storey count or window arrangement at any
useful rate; those must come from imagery. 14 descriptions name more than one
gable type and are flagged for hand review rather than resolved by first match.

Descriptions are kept as the register's original Dutch, verbatim, as provenance.

---

## RECON-4 — hand-mapped OSM semantics

Source: **OpenStreetMap via Overpass**, ODbL 1.0. Joined to BAG by the `ref:bag`
tag, which Dutch OSM carries on essentially every building — a direct key, no
spatial matching needed.

`LOD.md` makes this stage blocking rather than optional: manual OSM geometry
must be consulted *before* any fidelity tier is chosen, and an automated
reconstruction must never silently flatten a mapped tower, wing, passage or
courtyard. `LOD.md`'s own "Blocker 1" is that the existing resolver reads only
the colour-tagged subset and so never sees most manual work. This stage ingests
every building and `building:part` in the boundary instead.

- **2,907 of 3,025** buildings matched by `ref:bag` — **96.1%**
- **221 (7.6%)** carry hand-authored tags beyond the bulk import
- **9** have a mapped multi-part composition an automated rebuild would flatten

### Most of Dutch OSM here is BAG wearing a different hat

The single most important thing to know about this source in the Netherlands:
large parts of it are a **bulk import of BAG, with heights copied from 3DBAG**.
Those tags look like independent corroboration and are nothing of the kind. A
pipeline that counts an imported `height` as a second opinion on a 3DBAG height
is agreeing with itself and calling it evidence.

So the adapter records, per building, whether the tags came from an import and
which tags a person added on top. Only that second list is evidence. Across the
pilot it is small but real:

| hand-added tag | buildings |
|---|---|
| `building:levels` | 131 |
| `roof:levels` | 110 |
| `wikidata` | 101 |
| `wikimedia_commons` | 90 |
| `roof:shape` | 67 |
| `name` | 36 |
| `wikipedia` | 16 |
| `heritage` | 7 |

`roof:shape` on 67 buildings is the most directly useful: it is an independent,
human statement about roof form for buildings whose 3DBAG roof reconstruction is
exactly the thing RECON-2 showed cannot be trusted.

### The storey-count disagreement is a souterrain detector

The build prompt flags a `building:levels` / measured-height mismatch as a
*signal* rather than an error — on a canal house it usually means a
*souterrain*, a raised *bel-étage* or a rear annex. Measured:

- **106** buildings carry both an OSM level count and a measured 3DBAG storey count
- **71 of them disagree** — 67%
- **60 of those 71 (85%) are cases where OSM counts fewer storeys**

That asymmetry is the finding. Random noise would disagree in both directions
roughly equally. A systematic bias towards OSM counting *fewer* is what a
souterrain produces: 3DBAG measures a storey that exists in the building volume,
while a mapper counting from the pavement does not see it as one. These 60
buildings are the first concrete candidate list for `hasSouterrain` /
`hasBelEtage` — a parameter-record field that decides where the front door sits
and how the whole ground floor reads.

It is a candidate list and not an answer: the disagreement is reported, never
resolved automatically. 106 of 3,025 is also a 3.5% sample, so this establishes
the mechanism, not the rate.

## The grammar, and what it is allowed to do

`src/canalRecall/facade/grammar.ts` holds the geometric constants this project
reasons with. Every one carries the evidence beside it, because the whole risk
of a grammar is that it stops being a way of reading and becomes a source of
facts. These numbers may narrow a search, reject an implausible reading, or rank
two readings of the same image. They may never supply a value for a building
nobody looked at.

**Storey height, from independent data.** 3DBAG's storey counts divided by AHN
eaves heights, n = 2,390 — neither of which has anything to do with this
project's detector:

| p05 | p25 | p50 | p75 | p95 |
|---|---|---|---|---|
| 2.40 m | 2.76 m | **3.01 m** | 3.26 m | 3.71 m |

Eaves by storey count: 3 storeys → 9.5 m, 4 → 12.1 m, 5 → 14.9 m (medians).
Narrow plots under 5 m are 4 storeys at the median; wider ones 5.

**The Amsterdam foot, tested and rejected.** Canal-ring plots were set out in
Amsterdam feet of 28.13 cm at 18, 20, 22, 24 or 26 feet — 5.06 to 7.31 m — and
the pilot's median plot width is 5.66 m, which is 20 feet almost exactly. It is
very tempting to quantise measured widths onto that module.

The module is not there. Across 1,343 pre-1800 plots the mean distance from a
whole foot is **0.2524**, against **0.2524** for a randomised control — 0.25
being exactly what no structure looks like. The 20-foot peak is the mode of the
distribution, not evidence of quantisation. The historic module was real; it is
simply not recoverable from a BAG footprint, which is a modern survey of a
building rebuilt, merged, split and settled for four centuries, and whose
"width" here is the short side of a minimum-area rectangle rather than a plot
boundary. The constant is kept for provenance and deliberately unused.

**What the reference sheet showed.** Rectifying ten façades at 26 px/m with a
metre grid drawn over them was meant to yield proportions. What it actually
showed was that several readings at obliquity under 12° and standoff under 40 m
— filters that sound strict — were photographs of canal elms, scaffolding, a
lamp post, or a wildly mis-scaled close-up. Those pass every test on the
*camera* and none on the *building*. Hence `plausibility()`, which asks whether
a reading is a façade at all before it is kept: storey count against the
building's own height, floor-to-floor intervals against the measured range, bays
against frontage, opening area as a share of wall, and how many openings are
window-shaped. 41 readings were rejected on the last run, each with its reason.

**What changed as a result**, measured over the same 190 panoramas:

| | before | after |
|---|---|---|
| storey bands, p25/p50/p75 | 5 / 6 / 6 | 3 / 4 / 5 |
| bays, p50 | 1 | **2** |
| readings rejected as not façades | 0 | 41 |

Two bugs fell out of it. The storey ladder was scoring `mean × rung count`
capped at six, which is a *reward* for finding six rungs whatever the comment
beside it claimed — that alone put the median at exactly 6. And a tree trunk,
downpipe or lamp standard reads as a strong deviation from the wall in one
continuous vertical band from pavement to roofline, which a window never does,
so columns that stay high across 82% of the height are now discarded as
obstructions.

## The generator

`src/canalRecall/facade/generate.ts` turns a measured skeleton — plot width,
eaves, ridge, storeys — into a full plausible façade: diminishing storey
heights that sum to the measured eaves exactly, bays at a ~1.9 m pitch, windows
that shrink with their storey, a door on the ground floor, a hoisting beam, and
one of seven gable profiles drawn per type rather than smeared into a single
parameterised curve.

It exists as the *rendering vocabulary* the brief describes: it tells you how to
draw a klokgevel once you know this house has one, and it must never tell you
that this house has one. Everything it emits is stamped `provenance: 'generated'`
and an unstated gable is flagged `gableIsAssumed`. It is for the parts library
the Blender lanes need, for filling a bay the detector lost to a tree on a
building whose other bays were measured, and for spikes. It is not for the
extract: a building nobody has looked at still gets no façade.

59 checks pin it, and the ones that matter are the conservation rules — storey
heights are generated but the eaves height they sum to is a measurement, and a
rule about the parts may never move the whole.

## What M0 still owes

- **RECON-5** PDOK ortho roof colour across the boundary. The pipeline already
  exists (`scripts/build-roof-color-observations.ts`, `ROOF_ENRICHMENT.md`) and
  needs pointing at the boundary rather than the A10 cache.
- **RECON-10** quay, water level, bridge and *kademuur* geometry.
- **RECON-5 is running** but not yet wired into the records. Measured roof
  colour from PDOK `Actueel_orthoHR` at 12.5 cm/px across a 250-building spread:
  **17% pantile, 63% zinc, 20% slate**. Three bugs had to be found before that
  number meant anything, and all three produced confident, wrong answers:

  1. A bounded run selected `sort().slice(0, limit)` over BAG pand ids. Those are
     issued in registration order, so a lexical prefix is a block of buildings
     standing together — the run measured one street and reported it as the
     boundary.
  2. The palette's roof colours were written from imagination. `roof-pantile`
     was `#8c4a32`, a vivid dark terracotta at r−b +90 and luma 88. A roof shot
     from directly above in flat winter light is far paler: the measured warm
     cluster sits at r−b +37, luma 168. The invented value could never win the
     snap, so 1.6% of the ring came out pantile against an orthophoto showing
     whole terraces of it. The palette now carries measured medians.
  3. On a pitched roof the material was snapped from the *larger* illumination
     cluster. The shaded slope is darker and bluer because it is lit by sky
     rather than sun — a fact about the hour the plane flew, not the roof — and
     whichever slope faces away is larger about half the time. Snapping from the
     **sunlit** slope moved pantile from 2 to 42 of 250, matching the 16% warm
     cluster found independently.

  Still open: the shadow and vegetation rejectors never fire (0 of 250), and the
  rasterised footprint area runs about 2.6× the registry's own `areaM2`, which
  wants explaining before the numbers are trusted.
- **Validation of the façade detector.** `check-facade-registration.ts` is red
  at its own 0.5 m bar, and no detector output has been checked against a
  hand-labelled building. Street-level fields are therefore capped at confidence
  0.4. `calibration.ts` exists for exactly this and has never been fed a real
  `ReviewOutcome`.
- The **131 panden with no 3DBAG match**, individually.
- Reconciling the 3DBAG API's `v2023.10.08` collection against the
  `v20250903` tileset the runtime streams in `js/detailed-buildings-source.js`.
  Two vintages of one dataset; attribute names and pand sets should not be
  assumed to agree.

## What M0 has settled

- Coordinate system, datum alignment, local origin and water datum — pinned to
  1.4 mm in the pilot.
- The boundary, as geometry rather than prose, with 36 named regression
  locations and the far-bank membership rule made explicit.
- The building count: **3,025**, not ~2,000.
- That 3DBAG gives trustworthy massing but untrustworthy *gables*, with the
  evidence for why a naive RMSE gate would be wrong.
- Where the monument register lives, and that it is a 23%-coverage gable-type
  source rather than a general façade-attribute source.
- That most Dutch OSM building data here is a BAG/3DBAG import and must not be
  counted as independent corroboration — only the 7.6% carrying hand-authored
  tags is evidence, and `roof:shape` on 67 buildings is the useful part.
- A mechanism for detecting *souterrains*: OSM counts fewer storeys than the
  measured massing in 60 of 71 disagreements, an asymmetry noise would not
  produce.
- That the pipeline is not Amsterdam-shaped, proved by running it over a second
  city through identical code.
