# M0 reconnaissance — Amsterdam façade twin, pilot boundary

Status: **M0 complete for RECON-1, RECON-2 and RECON-3.** RECON-4 (OSM
semantics), RECON-5 (PDOK ortho roof colour) and RECON-6…10 (per-building façade
survey, quay/water) are not started.

Every number here is measured from the sources named beside it. Where this
document contradicts an estimate in
[`AMSTERDAM_FACADE_TWIN.md`](AMSTERDAM_FACADE_TWIN.md), the measurement wins —
that document says so itself.

Regenerate with:

```bash
npx tsx scripts/facade-twin/build-pilot-boundary.ts   # boundary + staging geojson
npx tsx scripts/facade-twin/build-pand-inventory.ts   # RECON-1
npx tsx scripts/facade-twin/build-massing-join.ts     # RECON-2
npx tsx scripts/facade-twin/build-monument-join.ts    # RECON-3
```

Outputs land in `public/data/extracts/amsterdam/staging/facade-twin/`. Nothing
is published to a versioned extract yet, by design.

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

`src/canalRecall/facade/pilotBoundary.ts`, published to
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

## What M0 still owes

- **RECON-4** OSM semantics, `building:part` topology, existing colour/material
  tags — needed before anything overwrites manual OSM structure, per `LOD.md`.
- **RECON-5** PDOK ortho roof colour across the boundary. The pipeline already
  exists (`scripts/build-roof-color-observations.ts`, `ROOF_ENRICHMENT.md`) and
  needs pointing at the boundary rather than the A10 cache.
- **RECON-6…9** the per-building façade survey, canal by canal. This is the
  gating resource for everything above LoD2.2 and nothing has been observed yet.
- **RECON-10** quay, water level, bridge and *kademuur* geometry.
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
