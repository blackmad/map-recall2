# Buurt generators: large uniform districts the rows will not reach soon (2026-11-15)

David, 2026-11-14: "schedule buurts next". TODO "House rows first": start buurt generator lanes beside rows round 2,
one district per lane, ranked by ride; targets Plan Zuid Amsterdam School, Rivierenbuurt edges, Westelijke Tuinsteden;
each district's first sheet goes to David. Lane `lane/buurt-generators-20261115` (port 4631). This file is phase 1
(the ranking and the plan) and the record of phase 2 (the first generator, Rivierenbuurt).

## What a buurt generator is here

The fallback for **undescribed** houses in one district, drawn by the ordinary renderer through the house-rows path
(`docs/house-line.md` §16): the generator writes a `RowRecord` per street side (lane D's contract,
`src/canalRecall/houseSpec/row/types.ts`) and the joined `RowFrontRecord`s (`houseLine/rowSeries.ts`), so every
house-rows rule holds by construction:

- **The row is the unit.** Members are BAG pands in street order along one street side (party walls touch, one front
  street). A **series** is a run of one design: same build year (±1), eaves within the row-coherence step (a lone
  outlier over 0.8 m is clamped to the row line, memory "row coherence"), same roof class. One cornice line, one storey
  count, one window cell, one wall family and one roof per series.
- **Unstated never means dice.** A series draws the district design its family states (build-year band, storeys from
  the series eaves, roof class). Nothing is hashed per pand; the bay preset and wall tone are seeded by the series id.
- **Described houses do not change.** A pand with a HouseSpec, a signed-off row, an installed chunk, a building-type
  instance, a landmark or any model is excluded before the rows are formed; it only breaks a row into two.
- **No silent drops.** A pand the generator does not draw is reported with its reason (described, corner/irregular,
  off-family year, no front street, single-pand run).

The building-types runtime (instanced designs, `src/canalRecall/buildingTypes/`) stays the route for detached slabs and
terraces (Nieuw-West); perimeter-block districts go through rows because David prefers the ordinary renderer's facade
detail (memory "visible result first") and HouseSpec is the one description (memory "reuse models for nondescript houses").

## Phase 1: the ranking (measured 2026-11-15)

Inputs, all local: BAG pands, years, 3DBAG eaves/ridge from `public/data/extracts/amsterdam/bag-tiles/14`;
buurt polygons, tiers and own-look status from `coverage-v1/buurten.json` and `explorer-looks.json` (2026-11-15);
route metres from `docs/reports/ride-ring-buurten-20261110.json` (2,000 seeded routes); type libraries under
`scripts/block-face/types/` and `src/canalRecall/buildingTypes/types/`; cached panoramas indexed from
`.cache/pand-reference` and `.cache/building-types` (no downloads). Excluded: the canal belt (Grachtengordel-West/-Zuid,
the rows' belt plan covers it), Centrum (rows and typed faces reach it first), Oude Pijp, Frederik Hendrikbuurt and the
other typed-face buurten of rows round 3, and buurten whose own look already draws more than ~15 % of their pands.

Uniformity is the share of dated pands (≥ 30 m²) in the interwar band 1915–1940 or the post-war band 1946–1965, and
the size of the top 5-year build-year bands. Ride is route km inside the district. "Generic" is pands the game draws
with no district kit today.

| # | District (buurten) | Pands | Generic | Route km | Main family | Top 5-y bands | Eaves median |
|---|---|---:|---:|---:|---|---|---:|
| 1 | **Rivierenbuurt** (Schelde-, IJsel-, Rijnbuurt: KK01–05, KL01–02, KM01–04) | 5,254 | 5,140 | 130 | 1915–40: 3,386 of 3,493 (97 %) | 1930: 1,216; 1925: 945; 1920: 665; 1935: 511 | 12.5 m |
| 2 | **Apollobuurt + Stadionbuurt** (Plan Zuid south: KJ02–06, KH01, KH03–05) | 3,856 | 3,840 | 125 | 1915–40: 2,598 of 2,678 (97 %) | 1930: 1,581; 1925: 556 | 10.0 m |
| 3 | **Bos en Lommer** (Landlust rest, Erasmuspark, Geuzenbuurt: EE01/02/04/05, EF01–02, EL01–03) | 4,051 | 4,037 | 201 | 1915–40: 2,179 of 2,893 (75 %) | 1930: 726; 1935: 570; 1940: 421 | 12.6 m |
| 4 | **De Baarsjes, Plan West remainder** (Columbusplein, Paramariboplein, Chassé, Orteliusbuurt-Midden: EM01/02/04, ER02, EN01–04, EK04) | 3,009 | 2,911 | 89 | 1915–40: 2,404 of 2,577 (93 %) | 1925: 1,421; 1920: 572 | 12.3 m |
| 5 | **Hoofddorppleinbuurt + Schinkelbuurt** (KA01–05, KB01–02) | 3,289 | 3,284 | 29 | 1915–40: 1,714 of 2,361 (73 %) | 1930: 1,035; 1925: 441; 1910: 410 | 11.8 m |
| – | Volewijck (Noord: NK01–03) | 4,639 | 4,629 | 77 | 1915–40: 2,273 (85 %) | 1925: 970 | 6.4 m |
| – | Westelijke Tuinsteden (42 buurten F*) | 25,690 | 20,700 | 127 | 1946–65: 8,578 (52 %) | 1955: 4,113; 1950: 2,850 | 5.8 m |

Not chosen: **Volewijck** is Noord (focus ruling 2026-11-10: centre and first ring, no Noord lanes). **Westelijke
Tuinsteden**: ride is spread over 42 buurten, the stock is 2–3 storey terraces and slabs that the building-types
runtime already draws (nw-*, 59 Nieuw-West types; 4,948 pands are instanced there today); extend those libraries
rather than start a rows generator. **Betondorp** (3,058 pands, 96 % 1922–27) has 2.6 route km.

Ride caveat: route metres favour long through-routes; Bos en Lommer's 201 km is mostly Bos en Lommerweg and the
Erasmusgracht. By ride per pand, Rivierenbuurt and Apollo/Stadion lead.

### 1. Rivierenbuurt (chosen for phase 2)

- **Stock** (17 cached panoramas, 2019–2023, KK02–04, KL01–02, KM01–03; sheet in the lane's artifacts): four-storey
  (some five) perimeter blocks of dark red-brown brick, 1920–1938; white-framed casement windows with toplights, two to
  three per ~6–8 m pand on every upper storey, no head or sill dressings; portiek doors (paired house doors under one
  transom) at a party wall; a thin white trim or deep white fascia at the flat top; recurring canted or box erkers;
  shopfronts on Scheldestraat, Rijnstraat, Maasstraat, IJsselstraat. Two roof families: a flat top with a set-back
  low roof (most side streets) and a dark pitched roof with box dormers (Scheldestraat, Churchilllaan side).
- **Counts:** 5,254 pands, 5,140 generic; 3,386 dated interwar. 3DBAG ridge-eaves: 0–2 m 189, 3–5 m 1,107, 6 m+ 374;
  eaves bands 9 m (261), 12–13 m (808), 15 m (90).
- **Kit reused:** row records and the row-front renderer (`rowFront.ts`, `rowSeries.ts`); the measured type
  `rijn-1934-flat-three` (storeys 3.1/3.0/3.0/3.0 m, window share 0.71, casement-toplight, frame #efeee8, brick #7a6a5f,
  0.75 m white fascia) and its erker siblings (`scripts/block-face/types/rivierenbuurt/`); the judged wall families
  (`judgedColour.ts`); the 103 installed Rijnbuurt-Oost chunks stay as they are.
- **Kit cannot say (ordinary renderer):** paired portiek doors under one transom (one door drawn); the deep white
  fascia overhang of the flat top (the row cornice draws a band, no soffit); canted and box erkers on a row member
  (no projecting bay in the row path); the brick soldier course over the ground storey; an eaves-front pitched roof
  behind the cornice line with evenly spaced box dormers (the row path has a flat lid or a slate/tile mansard); the
  1920s small-pane toplight (the painter's transom is one pane).

### 2. Apollobuurt + Stadionbuurt

- **Stock** (8 cached panoramas, not yet sheeted): Plan Zuid of 1925–1935: three-storey brick blocks under steep tile
  roofs (median eaves 10.0 m, 2,192 of 2,217 measured roofs pitched), some villas and the Stadionplein blocks.
- **Counts:** 3,856 pands, 3,840 generic; 2,598 interwar; 1930–34 alone 1,581.
- **Kit reused:** the Rivierenbuurt generator (same row partition and families); Landlust's tile-roof types
  (`landlust-1933-three-axis-tile`, `-1934-tile-pair`) for the dormer roofs.
- **Kit cannot say:** the eaves-front tile roof with dormers (the same gap as above, the main one here), garden walls
  and front gardens, villa-like free-standing pands (out of scope: rows only).

### 3. Bos en Lommer (Landlust rest, Erasmuspark, Geuzenbuurt)

- **Stock:** 1924–1940 four- and five-storey red-brown brick rows and slot blocks, erkers and ribbon attics; the
  Landlust lane typed 11 designs (73 pands installed in EE06).
- **Counts:** 4,051 pands, 4,037 generic; 2,179 interwar, 327 post-war (Bosleeuw).
- **Kit reused:** the 11 Landlust types as the district library; the Bestevaer stair-block types for 1924–26.
- **Kit cannot say:** ribbon attic windows across party walls, canted erkers in the row path, slot balconies.

### 4. De Baarsjes, Plan West remainder

- **Stock:** 1922–1929 Amsterdam School rows (J.F. Staal, Van der Mey fronts), dark brown brick, triple-light
  casements, tile roofs with white attics; Postjeskade, Orteliusbuurt and Jan Maijenbuurt already instanced as
  building types (we-pk-*, we-or-*, we-jm-*, 710 pands in EM, ER and EK).
- **Counts:** 3,009 pands, 2,911 generic; 2,404 interwar, 1,421 of them 1925–29.
- **Kit reused:** the six Jan Evertsenstraat types (`scripts/block-face/types/de-baarsjes/`), the we-* building types.
- **Kit cannot say:** hood slabs and lisenes as row dressings, white attic storeys on a tile roof, the sculpted
  corner blocks (landmark-level, out of scope).

### 5. Hoofddorppleinbuurt + Schinkelbuurt

- **Stock:** 1929–1935 four-storey brick rows (Westlandgracht, Aalsmeerweg), a 1910 band of older rows
  (Schinkelbuurt, 410 pands).
- **Counts:** 3,289 pands, 3,284 generic; 1,714 interwar. Ride low (29 km).
- **Kit reused:** the Rivierenbuurt generator; the c19 row path for the 1910 band.
- **Kit cannot say:** as Rivierenbuurt.

## Phase 2: the Rivierenbuurt generator (this lane)

- `src/canalRecall/buurtGenerator/` (typed, pure, tested in `buurtGenerator.test.ts`): `rows.ts` (party-wall rows on
  one front street, series), `generate.ts` (the district families as series designs, RowRecord + joined
  RowFrontRecords), `kitFlag.ts` (`?buurtKit=1` / `BUURT_KIT=1`, off by default).
- `src/canalRecall/buurtGenerator/districts/rivierenbuurt.json`: the district library.
- `scripts/buurt-generators/generate.ts --district=rivierenbuurt`: stages
  `artifacts/buurt-generators/<district>/` (records, per-row reports, coverage counts); never publishes.
- `scripts/buurt-generators/sheet.ts`: photo | before | after per row from cached panoramas, rectified to the row's
  front line at one scale (rule 10's in-game frames follow only after David's answer).
- Publishing (`data/front-records/`, the world compile) stays with the integrator after David approves the first sheet.

The results (counts, sheet path, verdicts, kit gaps) are appended below by the lane.

## Phase 2 results (2026-11-15)

### What was built

- `node --import tsx scripts/buurt-generators/generate.ts --district=rivierenbuurt --check` (~35 s) stages
  `artifacts/buurt-generators/rivierenbuurt/`: `row-front.json` (`{records}`, for `ROW_FRONT=1 ROW_FRONT_RECORDS=`),
  `rows.json` (lane D RowRecords), `fronts.json` (front lines), `check/<row>.row-check.json`, and `report.md`.
- **Rows.** A member's front is its longest unshared footprint edge facing a named street, extended over collinear
  jogs of 1.6 m or less. Neighbours join when they face the same street within 25°, share a party wall of at least
  2 m, and their front ends meet within 1.2 m.
- **Series.** A series splits at a build-year step over 1 or an eaves step over 0.8 m. A lone outlier is clamped and
  listed in `readNotDrawn`.
- **Family and design.** The storey count is `round((line - 3.1) / 3.0) + 1`, which picks the family: three, four or
  five storeys. Every design field is `period-default` with a ref to the library. The wall tone is seeded by the row,
  not per pand. 3DBAG roof rises are listed as read, not drawn.
- **Kit addition.** `bayLook.ts` `PLAN_ZUID_CASEMENT` is the Plan Zuid casement cell: white transom casements at a
  share of 0.71, no head blocks, no lintel, no pale floor band (`proportions: 'wide'`). It is appended to the school
  presets only under `buurtKit`, so with the flag off the bay table is byte-identical; the test pins that.
  `bayLook.ts` is a lane-R file: the change is a single flag-gated append.
- **Preview atlas.** `scripts/house-preview/atlas.ts` now has the layer count in the cache key, so a flag that adds
  presets paints its own atlas.
- **Sheet.** `scripts/buurt-generators/sheet.ts` lays out photo | before | after for one row, all on the row line at one
  scale. The photo is the cached panorama, rectified offline.

### Measured counts (Rivierenbuurt, 11 buurten)

| | pands |
|---|---:|
| BAG pands in the district | 5,390 |
| **drawn by the generator** | **2,495** (512 rows, 730 series) |
| - rivieren-four | 1,417 |
| - rivieren-three | 567 |
| - rivieren-five | 511 |
| described already (HouseSpec, row fronts, models, building types): untouched | 120 |
| minor (eaves < 5 m or < 30 m²: sheds, annexes, garages) | 2,213 |
| single (no party-wall neighbour on the same front street; corners, detached) | 337 |
| off-years (outside 1915-1940) | 88 |
| off-storeys (2 or 6+ storeys) | 79 |
| no front street | 58 |

Excluding the minor and described pands, 2,495 of 3,057 are drawn (82 %).

### First sheet

The first sheet is the Biesboschstraat row `biesboschstraat-069135-069135`: 10 members, 81.8 m, built 1929, a series
line of 12.4 m, four storeys. The photo is panorama TMX7316010203-001034_pano_0000_001940 (2019-01-03), and the sheet
is at `artifacts/buurt-generators/rivierenbuurt/sheets/biesboschstraat-069135-069135/sheet.jpg`.

- **Before.** Ten unrelated houses: red, orange, pale and dark walls; four hipped or tiled gable roofs at different
  heights; an oriel; 19th-century head blocks and floor bands.
- **After.** One brown-brick four-storey row at one cornice line, with white transom casements on every upper storey.
  This matches the photo's mass, colour, storey lines and window cell.
- **Still wrong against the photo:**
  - the tile roof behind the cornice is not drawn (a flat lid);
  - the canted erkers on four of the members are missing;
  - four members draw two wide windows per storey instead of four casements (the renderer gap below);
  - the ground storey has single doors where the photo shows portiek doors.

### Kit gaps (what the kit cannot say)

1. **Erker jogs make the row renderer change the window cell.** The house preview picks the longest single front edge
   (4.0 m on an erker member, against an 8 m front line). The mesher cannot fit the series' 4 bays there and draws 2
   wide cells, so one series shows two window cells. This needs lane R (`rowFront.ts` / the mesher's street run) to fit
   the series cell on the whole front line, or to accept per-front bays from the record.
2. **No eaves-front pitched roof with dormers behind the cornice.** The row path has a flat lid or a mansard only.
   Biesboschstraat, Scheldestraat and Churchilllaan show red tile roofs. This is the main gap for Apollo/Stadion
   (district 2).
3. **No canted or box erker on a row member.**
4. **No portiek: paired doors under one transom.**
5. **No deep white fascia and soffit at the flat top.** The cornice draws a band.
6. **The toplight is one pane, not small panes.**
7. **No brick soldier course over the ground storey.**

### For the integrator

- The lane did not publish or install anything.
- **Publish.** After David approves the sheet, copy the staged `row-front.json` records into
  `public/data/front-records/` (merge with `row-front.json`, which lists described pands that the generator already
  excludes). Then recompile the world with `BUURT_KIT` / `buurtKit` on, or make it the default.
- **Run on the sweep.** Re-run the generator after any HouseSpec or row publish in the district: described pands drop
  out of its rows by construction.

## Round 2 (2026-11-15): the kit the Biesboschstraat photo asked for

The integrator held the first sheet: three things that make the street read were missing (window cell, roof, erkers).
All four additions are behind `buurtKit` (`?buurtKit=1`, `BUURT_KIT=1`) **and** a record field the generator alone
writes (`RowFrontRecord.buurtKit`). Published rows (Kinkerstraat 86-110) carry no such field. Their previews are the same
bytes with the flag off, with it on, and on the base commit 96c9fcc0c (pands 0363100012165799 and 0363100012158180).

- **One window cell per series (gap 1).** BAG outlines are the plan from above, so an upper-storey erker is in the
  footprint. The game extruded it from the pavement, splitting the street front into several wall runs, and fitted the
  series' bays to each piece. A 4.0 m piece of a 7.95 m front drew two wide cells instead of four.
  - The generator now records each member's **front line**: the chosen street edge's line over the whole front.
  - It also records the **erkers** in front of that line (`kit/frontKit.ts erkersOf`): runs of outline vertices 0.2-1.5 m
    in front of the line and 0.9-3.5 m wide. A run reaching the front's end is half of a pair across the party wall.
  - Under the kit, `withRowFront` straightens the outline onto the line (`straightenFeature`). Only BAG jitter (within
    0.2 m) and the vertices of a recorded erker move; a deeper step outside an erker span (a wing) stays. The front is
    then one run and the series' cell holds across it.
- **Pitched red-tile roof with dormers and hoist beams (gap 2).** A series whose median 3DBAG rise is 2.5 m or more
  (1,270 of the 2,495 pands; the district is bimodal) states the district's pitched roof:
  - a tile row roof storey at 52 deg, rise from 3DBAG, capped at 6 m;
  - one plain dormer per front, each with a hoist beam.
  - It is drawn by the row mansard with its street band as deep as the pitch asks (`kit/roofKit.ts pitchBandM`) and
    joined at the party walls; a plain dormer's hoist beam is drawn too.
  - With the flag off the same records draw the stock tile mansard.
- **Erkers (gap 3).** 952 erkers on 907 members are drawn by `kit/roofKit.ts drawErkers` through the row roof's hook:
  - canted or box (half and open at a party wall);
  - from the first floor to a white cap just over the cornice;
  - brick between white-framed lights on every face and storey (transom, mullion), with a white sill slab.
  - Erker triangles are kept out of the roof's outline cut (`RoofTri.kit`).
  - A flat series with erkers (338 members) draws its lid as a 0.55 m coping behind the white cornice ledge, so the hook
    exists.
- **Portiek doors (gap 4): not done.** The ground cell's door belongs to the mesher's ground layout (lane R), and a kit
  door over it would double it. This is left for lane R.

### Sheets (photo | before | after, cached panoramas, Node)

- **Biesboschstraat** `biesboschstraat-069135-069135`: 10 members, 81.8 m, four storeys, pitched.
  - `artifacts/buurt-generators/rivierenbuurt/sheets/biesboschstraat-069135-069135/sheet.jpg`
  - After: one cell along the row, the red tile roof with a dormer and hoist beam per pand, erkers where BAG has them
    (paired ones read as one box across the party wall).
- **Maasstraat** `maasstraat-129732-129732`: 7 members, 48.3 m, five storeys, flat, shops.
  - `artifacts/buurt-generators/rivierenbuurt/sheets/maasstraat-129732-129732/sheet.jpg`
  - After: one five-storey brown row at its 16.4 m line with shops where the shop data puts them. The photo's top
    storey is a continuous band of white attic lights across the party walls, and the windows come in pairs; neither
    is drawn.

### Cost (scripts/house-line/row-front/front-cost.ts: walls + roof + extras, per row)

| row | today | rows (ROW_FRONT) | rows + kit |
|---|---:|---:|---:|
| Biesboschstraat (10 pands) | 2,941 tris, 289 KiB | 4,804 tris, 477 KiB | 6,257 tris, 631 KiB |
| Maasstraat (7 pands) | 2,112 tris, 213 KiB | 3,616 tris, 366 KiB | 5,078 tris, 516 KiB |

About 210 triangles per pand come from the Plan Zuid casement preset's frames and sills (Maasstraat has no erkers or
pitched roof). An erker is about 150-200 triangles.

### Kit gaps still open

1. **Portiek doors:** paired doors under one transom with a white canopy (lane R's ground layout).
2. **Attic ribbon:** the top storey's continuous band of white lights across party walls (Maasstraat, Rijnstraat; also
   Bos en Lommer).
3. **Paired windows:** two casements with a brick or white pier between them as one cell; the preset draws evenly
   spaced single lights.
4. **Erker detail:**
   - small-pane toplights;
   - the erker's own window count per face (one light per face is drawn);
   - wall windows hidden behind an erker still poke out at its sides.
5. **Dormer size:** the photo's dormers are wider and set higher on the slope than the row dormer's 1.0 m cap.
6. **Brick soldier course** over the ground storey; brick tone a shade darker in the photos.

## Round 3 (2026-11-15): roof, erkers, Maasstraat, dormers, portiek doors

Both round-2 sheets went to David as a direction check (#390); nothing is published. Everything below stays behind
`buurtKit` and the generator's own record field; published Kinkerstraat 86-110 previews are still the same bytes with
the flag off and on (0363100012165799 `6a4cdff9…`, 0363100012158180 `207d7ac7…`, unchanged from round 2).

- **Roof (checked against 3DBAG, tone from the photo).**
  - 3DBAG ridge minus eaves is 5.0 m on every Biesboschstraat member, so the 6 m cap does not bind.
  - The 52° pitch was too shallow. From the camera (10.3 m off the front, 2.44 m up), the photo's roof top edge
    projects at 14.34 m. A ridge at 17.4 m projects there only if the slope reaches it about 2.65 m behind the
    cornice, which is 62°. The district now states 62°.
  - The elevation still draws the true 5 m rise. The street camera foreshortens that rise to about 1.9 m, which is why
    the photo's roof looks lower than the elevation's.
  - Tile tone: the median of the photo's tile pixels is `#a15a30` (`pitched.roofHex`, carried by the kit into
    `threeBuildingFeatures` as the row roof hex). It renders at about `#a85a2b`, against the period table's `#c0603f`.
- **Erkers sized on the series' cells** (`frontKit.ts erkersOnCells`):
  - A whole erker takes every cell its BAG base reaches into (a tenth of a cell over the edge counts), centred where
    BAG puts it. A half erker at a party wall takes one cell.
  - Canted face = base less twice the depth, capped at 55 % of the base. On Biesboschstraat 077118 that gives a 4 m
    base and a 2.19 m face (photo: about 2.0 m), with one wall window either side.
  - No wall window pokes out beside an erker any more.
  - Each face draws one casement per ~0.9 m, with white mullions.
  - District counts: 951 erkers; 753 one cell wide, 146 two, 21 three.
- **Maasstraat (rivieren-five family kit, Maasstraat photo as the evidence):**
  - Attic ribbon (`roofKit.ts drawRibbon`): a brick plate over the top storey and one white-framed band of lights on
    it, run through joined party walls.
  - Paired casements: `PLAN_ZUID_PAIRED` (flag-only preset). In the painter it is `mullionShare`. In the row's 3D
    glazing it is `rowDress.mullionShare`: a white post 30 % of the window wide, full height.
  - The flat coping under the ribbon takes the series brick (`copingHex`), so it reads as the parapet.
  - 511 pands carry the ribbon and the pairs.
- **Brick:** one measured district hex, `#5b504a`. It is each photo's brick median (Biesboschstraat `#534842`,
  Maasstraat `#48413b`) divided by the renderer's own shift on that sheet, then averaged. It renders at about
  `#55483f` on Biesboschstraat. The measured wall pool's wide draw agrees (`#534946`, `#584e4a`, `#544b45` near the
  three rows).
- **Dormers:** 1.6 m wide, 1.45 m face, set 60 % up the street band (`KIT_DORMER`), with the hoist beam.
- **Portiek doors:** `door: 'portiek-pair'` on the Plan Zuid presets. The painter (`portiekPair`) draws two leaves
  under one glazed transom in a white frame, 200 px of the 520 px door cell. `variantKey` appends `|portiek-pair` only
  when the field is set, and a test pins the pre-round-3 key string literally.

### Sheets (round 3)

| Street | Sheet | What it shows |
|---|---|---|
| Biesboschstraat | `artifacts/buurt-generators/rivierenbuurt/sheets/biesboschstraat-069135-069135/sheet.jpg` | Wider erkers, muted tiles, larger dormers, portiek doors, darker brick |
| Maasstraat | `artifacts/buurt-generators/rivierenbuurt/sheets/maasstraat-129732-129732/sheet.jpg` | Ribbon, pairs, brick coping, portiek doors |
| Rooseveltlaan | `artifacts/buurt-generators/rivierenbuurt/sheets/rooseveltlaan-146491-146491/sheet.jpg` | Same four-storey family, 13 members, panorama TMX7316010203-002477_pano_0002_000865 (2022-03-24) |

Rooseveltlaan does not fully hold:
- The photo's brick is orange-red in spring sun, while the measured pool around it is brown. It is not held on colour
  (wall colour by judgement).
- Its fronts end in broad white eaves soffits rather than a cornice.
- The photo crops at about 15.5 m, so the pitched roof is neither confirmed nor ruled out there.
- Two of its row records break into hipped roof ends mid-row (lane R's row joins).

### Cost (front-cost.ts, rows + kit, round 3)

| Row | Round 2 | Round 3 |
|---|---:|---:|
| Biesboschstraat (10 pands) | 6,257 tris, 631 KiB | 6,113 tris, 616 KiB |
| Maasstraat (7 pands) | 5,078 tris, 516 KiB | 5,342 tris, 543 KiB |
| Rooseveltlaan (13 pands; 4,301 tris / 422 KiB today) | - | 9,343 tris, 938 KiB |

### Kit gaps still open

1. Broad flat eaves with white soffits (Rooseveltlaan); `eaves-overhang` stays in `notDrawn`.
2. Small-pane toplights in casements and erkers (`toplight-panes`).
3. Pair spacing: Maasstraat's pairs stand wider than a cell (single, pair, single per pand). The kit draws a pair in
   every cell.
4. The photo-camera view of the roof: the elevation shows the true rise, not the foreshortened one.
5. Brick soldier course over the ground storey.

## Round 4 (2026-11-15): tile in the same light, piers, eaves, the hips, the rhythm

Sheets (Node, from cached panoramas): `artifacts/buurt-generators/rivierenbuurt/sheets/{maasstraat-129732-129732,
rooseveltlaan-146491-146491,biesboschstraat-069135-069135}/sheet.jpg`.

1. **Roof tile.** Calibrated against the photo's shaded tile, not a median that includes sunlit patches. On the
   Biesboschstraat sheet the photo's tile (rows 112-150, x 2360-2600) measures `#9e5b40`, L 0.537, C 0.099, hue 43.
   The render measures `#a35a3d`, L 0.547, C 0.105, hue 42; the round-3 hex rendered C 0.118, hue 49. The new
   `pitched.roofHex` is `#9e5b42`.
2. **Piers (Maasstraat).** The pier is a brick pilaster 1.45 m wide (each member draws its half), 0.12 m proud of the
   front, with a stack 1.2 m over the coping and 0.7 m into the roof. The attic ribbon stops 1.6 m short of it, so
   there is one ribbon per block. The pier phase comes from the photo: piers stand after members 0, 2 and 4
   (`rowNotes.maasstraat-129732.pierPhase = 0`). Other rows take phase 1 by default. That default is not measured.
3. **Rooseveltlaan.**
   - **The hips were the generator's, not lane R's.** Member 080196 has a 0.64 m strip by the party wall that the
     neighbour's overlapping outline marks as shared. The front walk stopped there, so the series `frontM` sized the
     row roof short, and the roof hipped. Every record already had both joins true.
   - Fix (`rows.ts` `FRONT_ON_LINE_M`): the line runs on to the furthest ring vertex within 0.3 m of the line. A
     named regression test pins it.
   - The eaves are a kit roof edge (`roofKit.ts` `drawEaves`): a white lattice frieze 0.85 m tall on the series line,
     then a slab with a 0.9 m overhang, a 0.4 m fascia and the soffit. The slab runs on through joined walls and
     returns round free ends.
   - Which series gets them: the orthophoto roof-facts slot. `slate` selects `pitchedEaves` (35 deg, no dormers);
     `pantile-*` or an unread slot selects the tiled Plan Zuid roof.
   - Caveat: the slate-to-eaves rule rests on Rooseveltlaan alone, and it now covers 1062 pands. Sample other slate
     streets before trusting it district-wide.
4. **Rhythm (Maasstraat), a series pattern.** A brick plate covers the mesher's even cells under the ribbon. Per
   storey, singles 2.2 m wide are spaced over the pier side. At the pair wall each member draws one 1.3 m light and
   half of the 0.45 m white panel; the neighbour draws the other half. This gives single, pair, single per pand.
   - The pattern is drawn only when the series has no erkers, because erkers already state the rhythm.
   - `PLAN_ZUID_PAIRED` (bayLook.ts) is no longer used by data, since the five family dropped `sash`. It is still
     flag-gated.
5. **As-played frames:** deferred. The disk was at 11-12 GB, so no compiles were run.

Cost (front-cost, BUURT_KIT=1; before, then round 3, then round 4):

| Row | Before | Round 3 | Round 4 |
|---|---|---|---|
| Maasstraat (7 pands) | 2112 tris, 213 KiB | 5342 tris, 543 KiB | 6158 tris, 626 KiB |
| Rooseveltlaan (13 pands) | 4301 tris, 422 KiB | 9343 tris, 938 KiB | 10447 tris, 1055 KiB |
| Biesboschstraat (10 pands) | 2941 tris, 289 KiB | 6113 tris, 616 KiB | 6113 tris, 616 KiB |

Kinkerstraat identity holds with the flag off and on: 165799 `6a4cdff9...`, 158180 `207d7ac7...`.

Remaining gaps the kit cannot say:

- The erker tops on Rooseveltlaan stand into the frieze; the photo's erkers stop under it.
- Toplight panes in casements and erkers.
- Loggias (Rooseveltlaan's west end).
- The soldier course over the ground storey.
- The elevation sheet shows the true roof rise. From the pavement, a slope under about 40 deg is hidden behind the
  Rooseveltlaan eaves.

## Round 5 (2026-11-15): colour rule, slate sample, Rooseveltlaan erkers, loggias

### Wall colour rule: series photo > district pool

Colour by judgement applies only where there is no evidence. When a row has its own photo, its measured brick wins
over the district's pooled brick (`rowNotes[row].wall`, `generate.ts wallHexOf`; the order is row note, then family,
then district).

- Rooseveltlaan (`rooseveltlaan-146491`) draws `#a2694f`, an orange-red, instead of the pool's `#5b504a`.
- The photo was taken in low sun and its white frames clip, so the sunlit front (`#eca283`) cannot give the exposure.
- The brick was measured on the faces turned out of the sun (L 0.53-0.58, C 0.067-0.070). Those faces have the same
  hue (44-46) and the same C/L ratio as the sunlit front.
- It is drawn at L 0.56, C 0.085, hue 45, divided by the renderer's brick shift on this sheet (`#5b504a` drew
  `#594c44`).

### Slate-slot sample (the round-4 slate → eaves rule)

Six slate-slot rows other than Rooseveltlaan have a cached panorama facing them. Each was rectified in Node
(`artifacts/buurt-generators/tools/slate-sample.mts`; 79 cached panoramas in the district, nothing fetched). Rows
further than 45 m from the camera were looked at and dropped, because other buildings block the view.

| Row | Panorama | Distance | Eaves + frieze? | What the photo shows |
|---|---|---|---|---|
| Biesboschstraat 142780 (8 pands) | TMX7316010203-001034_pano_0000_001940 (2019) | 9 m | no | steep dark tiles, box dormers, white cornice, chimneys |
| Scheldestraat 146131 (9) | TMX7316010203-001036_pano_0000_001782 (2019) | 12 m | no | steep dark roof, dormers, cornice |
| Scheldestraat 144881 (4) | same | 18 m | no | steep dark roof, dormers, cornice |
| Victorieplein 114412 (3) | TMX7316010203-002477_pano_0002_000187 (2022) | 31 m | no | tiled roof behind a small eaves, chimneys |
| President Kennedylaan 066768 (4) | TMX7316010203-002473_pano_0001_000393 (2022) | 39 m | unclear | white eaves band; no frieze visible at this distance |
| Waalstraat 122104 (2) | TMX7316010203-002408_pano_0007_000098 (2022) | 34 m | no | flat brick coping |

- **Result: 0 of 6 show eaves and frieze.** The six rows are on five streets; no further street could be sampled
  without downloading.
- The slot now selects a **look**, not a roof: `pitched.slotLooks.slate` draws the 62 deg dormered roof in a dark
  `#494345`. That colour is measured on the Biesboschstraat 142780 roof face (`#504643`/`#483c3a`) and divided by the
  tile shift.
- The eaves roof is gated by a measured street note (`streetNotes.Rooseveltlaan.eaves`).
- Counts: eaves 102 pands (Rooseveltlaan only), dark-tile pitched 960, red-tile pitched 208, flat 1225.

### Rooseveltlaan erkers (BAG)

BAG gives whole canted erkers about 2.95 m wide, 0.72-1.13 m deep, with a 1.8-1.97 m face, standing 0.6 m off a
party wall. For example, 080196 runs 0.64-3.59 m along its 9.38 m front.

**The bug:** round-3 cell snapping moved such an erker onto the party wall. The kit then drew it as half of a pair,
open on that side. This affected 782 pands district-wide, including Biesboschstraat 088307 and 077118.

**The fix (`erkersOnCells`):** a whole erker that snapping would carry onto a wall keeps BAG's span and face. Only
a cell whose window it half covers is bricked over (`plates`). The windowShare is 0.71.

- On Biesboschstraat the erkers now stand whole with windows between them, as in the photo.
- That sheet changes from round 4. Maasstraat is byte-identical.

**Street note `erkerBands`:** the lights run corner to corner on every face. Under broad eaves, the erker rises
through the frieze, and the eaves slab is its cap.

### Loggias

These are cheap and now in the kit (`drawLoggias`, row note `loggias` per member). On each upper storey, between
the erkers:

- a 1.0 m brick parapet;
- a dark opening;
- the window wall behind it, seen through the opening;
- a white sill line;
- all over a brick plate that hides the mesher's cells.

They apply to the four west members of `rooseveltlaan-146491` (146491, 148931, 122216, 080196).

### Cost and checks

- Rooseveltlaan 11689 tris, 1182 KiB (round 4: 10447 tris, 1055 KiB).
- Biesboschstraat 6275 tris, 633 KiB (round 4: 6113 tris, 616 KiB).
- Kinkerstraat identity holds with the flag off and on.

### Remaining gaps

- The west end's brick reads paler and pinker in the photo than the rest of the row; the row draws one hex.
- 146491 has no BAG erker, but the photo shows one at its right.
- Erker glass reads darker than the photo's white bands.
- The loggias' slab soffits are not drawn.
- Other Rooseveltlaan rows have no row photo, so they keep the pool brick.

## Round 6 (2026-11-15): blind A/B on Rivierenbuurt, district 2 (Apollo + Stadion)

### Blind A/B on the r5 sheets (bd9ffc763)

Each judge was a fresh opus subagent. It saw the photo and two shuffled, unlabelled bands: today's drawing and r5.

| Street | Winner | Confidence | Judge's biggest remaining gap |
|---|---|---|---|
| Maasstraat | r5 | high | a pale band under the roof edge, which the photo does not have |
| Rooseveltlaan | r5 | high | a tall grey roof band in the elevation; the photo's block ends flat |
| Biesboschstraat | r5 | high | the tile roof is far too tall in elevation; erker placement differs in places |

- **Score:** 3 wins, 0 losses, 0 ties. No gap cost a loss.
- **The pale band** on Maasstraat is 0.13 m tall (`#cfcecb`). It is neither the series cornice nor the row mansard's trim: both were tried, and both left it in place, so both changes were reverted.
- **The roofs:** both judges read the true roof rise on the elevation sheet. From the pavement, perspective hides most of it.

### District 2: Apollobuurt + Stadionbuurt (`lane/buurt-apollo-stadion-20261115`)

The library is `districts/apollo-stadion.json`.

- **Families:** three, four and five storeys.
- **Wall pool:** `#5b4e47`, the average of the four brown rows sheeted here.
- **Wall per row:** each sheeted row draws its own photo's brick (row notes, calibrated through the renderer on its own sheet). Quinten Massijsstraat is pale yellow, `#b7a984`.
- **Roof:** red pantile on every pitched row.
  - Both photographed pitched rows are red, although the orthophoto reads slate on all six Sportstraat members. The slot is therefore not used here.
  - The colour comes from the overcast Biesboschstraat measurement. The Apollo photos are sunlit, so only their hue is used.
- **Eaves:** broad flat eaves with no frieze. A new `eavesFrieze: false` kit option draws them, gated by street notes on Minervalaan and Quinten Massijsstraat.
- **Window axis:** Sportstraat has three to four wide casements per 14.4 m pand, so it draws a 3.6 m axis (`rowNotes.axisM`).

Coverage: 3,848 pands; 1,672 drawn in 334 rows. Not drawn:

| Reason | Pands |
|---|---:|
| Minor (sheds, garages, eaves under 5 m) | 1,563 |
| Single | 325 |
| Off-storeys | 163 |
| No front | 74 |
| Described | 35 |
| Off-years | 16 |

Sheets were redrawn with the row notes once the disk was back at 21 GB. Each street got a blind A/B from a fresh opus judge, with the drawings shuffled into A and B. The key is in `_pruned-sheets/buurt-generators-20261115/apollo-stadion/ab-apollo-keys.json`.

| Street | Winner | Confidence | Judge's biggest gap in the generator drawing |
|---|---|---|---|
| Achillesstraat | generator | high | A red-tile roof with dormers where the photo has a fifth brick storey under a flat top |
| Herculesstraat | generator | high | Too uniform: no entrance porches or red doors, windows not grouped in pairs, evenly spaced dormers |
| Minervalaan | generator | high | A tall pitched roof where the photo has a flat roof behind a deep eave |
| Quinten Massijsstraat | generator | high | A slate hip where the photo has a flat roof with a thin white eave; no erkers or corner bays |
| Sportstraat | generator | high | No white central gabled bays, stair-tower strips or canopy porches |

The generator wins 5/5. Three of the five named gaps are the roof: Achillesstraat, Minervalaan and Quinten Massijsstraat are flat-roofed behind an eave or a top storey, but the four- and five-storey families draw pitched roofs. **Next:** gate the pitched roof on a measured roof form for those families, for example the 3DBAG roof type or a street note, and draw a flat top with the broad eave otherwise.

What the kit cannot say here yet:

- Amsterdam School grid windows (Minervalaan: framed multi-pane lights in a white grid).
- Striped brick ground floors.
- Arched portiek doorways (Achillesstraat).
- First-floor balconies (Achillesstraat).
- Hipped roof ends and a central entrance bay with a stair window strip (Sportstraat).
- Front gardens.
- Entrance canopy porches with red doors, and stair-window strips (Herculesstraat, Sportstraat).

## Round 7 (2026-11-15): roof gating, entrances, blind A/B on all eight streets

### Roof gating
A pitched roof is drawn only where the roof form is measured. The gate is `generate.ts` `pitchGate`:
- **Street note first.** A street note's `roof: 'flat' | 'pitched'`, read from the street's photo, decides.
- **Then 3DBAG.** 3DBAG's roof type must read slanted (`GenPand.roofCode`, from the base tiles' `roof`). A series that reads flat or multi-flat draws flat.
- **Note-only districts.** A district with `pitched.streetNoteOnly` asks for the street note.

Apollo is note-only. 3DBAG reads slanted on every one of its 1,602 series pands whose rise carries a roof. That includes the flat-topped blocks of Achillesstraat, Minervalaan and Quinten Massijsstraat, so 3DBAG cannot tell them apart.

Apollo's street notes:

| Street | Note |
|---|---|
| Achillesstraat | flat |
| Minervalaan | flat |
| Quinten Massijsstraat | flat |
| Herculesstraat | pitched |
| Sportstraat | pitched |

A flat series under the library's `flatEaves` draws the broad eaves slab (1 m, no frieze) on the kit coping. Achillesstraat's row note `topM` 15.4 m gives it the photo's five storeys over 3DBAG's 13.2 m eaves.

Apollo now draws 93 pands pitched and 1,579 flat under the eaves.

Rivierenbuurt keeps its pitched rows. Only `ijselstraat-072727:s1` (2 pands, 3DBAG flat) went flat. The three sheeted rows re-rendered from fresh renders are pixel-identical to r5 (AE 0).

### Entrances (row notes, `frontKit.ts` `BuurtEntry`, `roofKit.ts` `drawEntries`)

| Kind | What it draws |
|---|---|
| `door` | A red door in a white frame |
| `canopy` | The same door under a white flat canopy |
| `gable-bay` | The portiek bay: a brick strip 0.15 m proud from the pavement to the line, the stair's narrow lights, the door under a canopy, and a white gable with a dark diamond over the eaves |

Placement:
- Entrances repeat member by member along the row.
- Each carries the series' ground cells. The kit lays a brick plate over the member's ground storey and redraws a window in each cell the door leaves free, so the mesher's own door goes.

Sheeted rows:
- **Herculesstraat:** doors at 0.43 and 0.57 of alternate fronts. The white discs over its open stairs are street lamps, not canopies.
- **Sportstraat:** a gable bay at 0.43, then a canopy door at 0.40.

**Paired windows are not drawn.** On close inspection the Herculesstraat photo shows evenly spaced tall narrow lights with French-balcony rails, not pairs.

### Blind A/B (fresh opus judges, one per comparison, A/B shuffled)

**Against the game today (`ab-r7`).** The generator wins 8/8. Seven are high confidence.

| Street | Winner | Confidence | Biggest gap named |
|---|---|---|---|
| Achillesstraat | generator | high | First-floor balconies, arched doorways, the wide/narrow window alternation |
| Herculesstraat | generator | high | Roof too tall against the photo's low strip; no brick piers between the windows |
| Minervalaan | generator | high | Amsterdam School blocks between pierced-brick piers, stone frames, striped plinth; line ~2 m low |
| Quinten Massijsstraat | generator | high | No projecting erkers |
| Sportstraat | generator | high | Too many gables and dormers; no dark stairwell strips; glass too dark |
| Maasstraat | generator | high | Ribbon glazing should sit in a white band; pale cornice stripe not in the photo |
| Rooseveltlaan | generator | high | Tall slate roof where the judge reads a flat block with a white eaves line; flat erkers |
| Biesboschstraat | generator | high | Roof too tall (a thin strip in the photo); erkers too narrow |

**Round 7 against round 6 (`ab-r7vs6`, Apollo only).** Round 7 wins 5/5.

| Street | Winner | Confidence | Note |
|---|---|---|---|
| Achillesstraat | r7 | medium | Flat top and five storeys |
| Herculesstraat | r7 | medium | Ground floor: red doors in place of shop doors |
| Minervalaan | r7 | medium | Flat with the eaves slab |
| Quinten Massijsstraat | r7 | high | Flat roofs |
| Sportstraat | r7 | high | Gable bays, canopies and red doors |

Sheets, A/B bands and keys are in `_pruned-sheets/buurt-generators-20261115/round7/`.

### Remaining gaps
- **Roof height on pitched rows.** Herculesstraat, Rooseveltlaan and Biesboschstraat draw the full 3DBAG rise, but the photo shows a low strip. The roof should be the photo's seen height, not the 3DBAG ridge.
- **Erkers on Quinten Massijsstraat.** BAG gives none on these pands, although the photo shows them.
- **Minervalaan line.** It stands about 2 m below the photo: 4 tall storeys at about 15.5 m. A `topM` would add a storey, because storeys follow the line.
- **Achillesstraat.** Balconies and arched portiek doorways (a kit gap).
- **Stair windows.** The upper-storey windows the portiek bay half-covers still show a sliver at its edges.

## Round 8 (2026-11-15): held-out test, measured roof rise, gable-bay slivers

### Held-out test (no tuning before judging)

The street notes come from the photos that were judged, so in round 7 the 8/8 only measured the noted streets. To test the rest, this round drew a held-out set with `artifacts/buurt-generators/tools/heldout2.mts` (gitignored):

- **Candidates:** one row per street with at least 4 members, in either district. A street is excluded if its name appears anywhere in the library JSON text, which leaves 106 candidates.
- **Weighting:** by routable km in `streets-routing.json`. There are no local ride logs, so this stands in for ride km.
- **Pick:** a seeded LCG draw (seed `r8-heldout`) of 7 rows.
- **Photos:** panoramas listed and cached with the repo User-Agent at a 500 ms gap: 26 requests, about 16 MB.
- **Judging:** the sheets were rendered once and judged blind, before against after, by one fresh opus judge per street.

| Street (row) | District | Members | Winner | Confidence |
|---|---|---|---|---|
| Stadionweg (116969) | Apollo | 11 | generator | high |
| Parnassusweg (068103) | Apollo | 15 | generator | high |
| Amstelveenseweg (143628) | Apollo | 19 | generator | medium |
| Michelangelostraat (117261) | Apollo | 13 | generator | high |
| Borssenburgstraat (070575) | Rivierenbuurt | 8 | generator | high |
| President Kennedylaan (125454) | Rivierenbuurt | 8 | generator | high |
| Europaplein (137940) | Rivierenbuurt | 9 | generator | high |

The generator won 7/7. The judges named these gaps on the held-out streets:

- **Brick too dark.** Most photos are buff, tan or yellow; the district pools are dark brown.
- **Missing erkers.**
- **Missing arched or recessed entrances.**
- **Michelangelostraat:** drawn flat, but the photo has a dark tiled hipped roof.
- **President Kennedylaan:** the photo has a fifth storey up to about 15 m under a flat top; the generator draws it pitched at 12 m.

### Pitched roof height

`pitchedRiseOf` now draws `min(maxRiseM, 3DBAG rise, street note riseM ?? variant/district capRiseM)`. The 3DBAG rise still decides whether the roof is pitched (it must be at least `minRiseM`). Rises were measured on the rectified sheets as visible tile above the eaves:

| Where | Value | Evidence |
|---|---|---|
| Herculesstraat note `riseM` | 1.3 m | 39 px/m |
| Sportstraat note `riseM` | 1.2 m | 40 px/m |
| Apollo `pitched.capRiseM` | 1.3 m | the two Apollo streets above |
| Rivierenbuurt `pitched.capRiseM` | 1.0 m | Biesboschstraat, 37 px/m, tiles 0.8–1.1 m |
| Rivierenbuurt `pitchedEaves.capRiseM` | 0.6 m | Rooseveltlaan, only the eaves slab is visible |

When the 3DBAG rise exceeds the drawn rise by more than 0.3 m, the row lists it under read-not-drawn (`3dbag-roof-rise`). Dormers now scale to 0.8 × the rise, with a minimum of 0.6 m. The ground plate, ground lights and doors sit 0.12 m proud, so mesher sills no longer show through; these were the white bars on Herculesstraat.

### Gable-bay slivers

When an entry has `cells`, every window the bay overlaps is bricked. The free part of the window on each side of the bay is redrawn as its own light if it is at least 0.9 m wide.

### Round 8 against round 7 (blind, new after band against old after band)

| Street | Winner | Confidence | Judge's reason |
|---|---|---|---|
| Herculesstraat | r8 | medium | low tile band at the photo's eaves; no stray white base lines |
| Sportstraat | r8 | medium | eaves and ridge within about 0.4 m of the photo; gable bays rise through the eaves |
| Biesboschstraat | r8 | high | low tile band |
| Rooseveltlaan | r8 | high | flat top over the eaves slab |

r8 won 4/4. Still open on the noted streets:

- Paired entrances under concrete slab canopies (Herculesstraat).
- Dark shutter panels on the top floor (Sportstraat).
- Chimneys; the generator draws dormers where the photo has chimneys.

Sheets, A/B folders and keys: `map-recall2-worktrees/_pruned-sheets/buurt-generators-20261115/round8/`.
