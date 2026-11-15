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
