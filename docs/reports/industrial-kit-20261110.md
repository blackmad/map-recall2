# Industrial kit — 2026-11-10

Lane D of the 2026-11-09 feedback triage (dev log #68). User feedback:

| id | spot | complaint |
|----|------|-----------|
| e6f5deb7 | Isarweg storage tanks, pand 0363100012212203 | "round towers with windows" |
| b95fff1c | warehouse 0363100012202272 (1967) | "bad design for a building marked warehouse" |
| 76bc26ce | Hornweg 0363100012099856 (1991) | "bad design for industrial building" |

All three are classified by the new table (tank, shed, shed).

## Method

Inputs, open data only:

- OSM (`osmium` extract of `building=industrial|warehouse|hangar|manufacture`,
  `man_made=storage_tank|silo|gasometer`, `landuse=industrial|port`).
- BAG verblijfsobjecten with gebruiksdoel, from the PDOK WFS
  (`scripts/industrial/fetch-bag-uses.ts`; the WFS stops paging at 50 000, so
  the city is fetched in RD x-stripes with a page cache): 56 438 VBOs on
  29 292 pands.
- 3DBAG heights/years already in the building tiles; buurt/stadsdeel polygons
  from the source-data repo.

`src/canalRecall/industrial/industrialClass.ts` (typed, unit-tested) decides,
in order:

1. Reject landmarks, kit pands, raised parts, home buildings, < 40 m² (tanks
   from 8 m²), housing ≥ 10 % of VBO area.
2. **tank / silo**: a mapped `storage_tank`/`silo`/`gasometer` with people
   uses ≤ work uses — round (roundness q ≥ 0.9, ≥ 10 vertices) → tank,
   otherwise silo; or an *unmapped* round footprint in industrial landuse
   with no people use.
3. **office**: on an estate, office > 50 % and office > work → keeps its
   windows (no guessed shopfront, quiet ground storey).
4. Built before 1950 → not touched (the old warehouses keep the grammar).
5. Not touched when people use > work, height > 30 m, or off-estate < 300 m².
6. **shed / works**: OSM shed building, then BAG industriefunctie, then an
   unregistered hall ≥ 400 m² and ≤ 20 m tall in industrial landuse. A shed
   with any office VBO or ≥ 3 units becomes **works** (shed plus an office
   front block).

`scripts/industrial/build-industrial-buildings.ts` writes the staging table
(`artifacts/industrial/staging/`) and, with `--publish`, the extract
`public/data/extracts/amsterdam/industrial-buildings.json` (288 KB, id → kind).

## Counts

| kind | pands | floor area |
|------|------:|-----------:|
| shed | 5 553 | 10.13 M m² |
| tank |   914 |  0.33 M m² |
| works |  424 |  0.95 M m² |
| office | 351 |  0.36 M m² |
| silo |     6 |     569 m² |

By stadsdeel:

| stadsdeel | shed | works | office | tank | silo |
|-----------|-----:|------:|-------:|-----:|-----:|
| Westpoort | 695 | 83 | 134 | 805 | — |
| Nieuw-West | 675 | 116 | 22 | 34 | 1 |
| Noord | 554 | 86 | 105 | 29 | — |
| Oost | 171 | 48 | 35 | 2 | — |
| West | 152 | 25 | 26 | — | — |
| Zuidoost | 121 | 27 | 3 | 3 | 1 |
| Zuid | 98 | 16 | 20 | 1 | 1 |
| Centrum | 24 | 23 | 6 | — | — |
| Weesp | 202 | — | — | 1 | — |
| outside the city polygons | 2 861 | — | — | 39 | 3 |

Why sheds were picked: `building=industrial` 3 925, unregistered hall in
industrial landuse 1 168, BAG industriefunctie 387, `building=warehouse` 70.
Tanks: mapped storage_tank 619, mapped silo (round) 72, unmapped round in
landuse 223.

Westpoort large buildings left alone (sample of misses): no industrial
evidence 19, people use over work 19, pre-1950 13, > 30 m 5, landmark/kit 2.

### What the grammar draws today

| kind | total | windows | shopfront | bare |
|------|------:|--------:|----------:|-----:|
| shed | 5 541 | 5 530 | 248 | 8 |
| tank | 913 | 774 | 0 | 139 |
| works | 421 | 419 | 35 | 1 |
| office | 349 | 348 | 25 | 0 |
| silo | 6 | 5 | 0 | 1 |

So 85 % of tanks get windowed walls and 248 sheds get shopfronts — the user's
complaints are city-wide, not three spots.

## The kit

`src/canalRecall/industrial/industrialKit.ts`, routed from
`threeBuildingFeatures.ts` and meshed in `threeBuildingMesh.ts`, behind
`?industrialKit=0|1` (`globalThis.__canalRecallIndustrialKit`; worker flag
added to `withWorkerFlags`). With the flag off or no stamp the mesh is
byte-identical (unit test).

- **tank**: bare walls, no roof mass, light grey/white palette, rim band, a
  railing band 1 m above, a ladder panel, a shallow cone roof.
- **silo**: bare concrete walls, coping band.
- **shed**: profiled cladding (the flat-roof seam layer re-used at 0.6 m seam
  pitch), a measured palette (dark blue-grey, light grey, sage green taken
  from data.amsterdam.nl panoramas), plinth, coping; on street faces dock or
  roller doors plus a personnel door, optional ribbon window; no shopfronts.
- **works**: a shed plus an office front block with a ribbon window per
  storey and a glazed entrance.
- **office**: keeps its windows; no guessed shop.

A photo-sourced wall colour wins over the palette.

## Strips

Panorama | before (main's bundles today) | after (this lane's bundles), live own engine
(`?world=live&engine=own`), chase view, 3000 x 737 PNG, in
`map-recall2-screenshots-a1/buildings/2026-11-10-industrial/`. Re-shoot with
`PW_PORT=4758 bash /tmp/canal-pw.sh artifacts/industrial/run-all.sh`
(`AFTER_ONLY=1` keeps the before frames) and compose with
`scripts/industrial/strip.ts`.

| spot | verdict | note |
|------|---------|------|
| isarweg-tanks (user e6f5deb7) | PASS | the whole tank farm loses its windows and turns pale steel; it reads as tanks |
| warehouse-1967 (user b95fff1c) | WARN | shopfront and window rows gone, dock doors on the street; the wall is pale grey where the photo is blue-green sheet (the palette is a hash pick; no per-pand photo colour) |
| hornweg-1991 (user 76bc26ce) | PASS | red brick with windows becomes a pale clad hall with dock doors, like the Welhof hall |
| petroleumhaven-tanks | PASS | the brick tank with a window band becomes a pale tank; the dome roof is not expressed |
| westpoort-tank-1982 | PASS | windowless; the horizontal ring seams in the photo are not expressed |
| westpoort-works-1972 | WARN | office front band and doors read; the photo's long ribbon-glazed office is weaker than before's window rows |
| minervahaven-shed-1978 (Houthaven) | PASS | pale grey cladding like the photo, roller doors |
| buiksloterham-shed-1968 (Noord) | PASS | pale hall with dock doors; the curved roof and blue office strip are not expressed |
| westpoort-hall-2007 | WARN | windows gone, but the visible face is not a street edge so it gets no doors; the photo's dark blue-grey sheet is drawn darker grey |

Palette note: the first pass drew 6 of 10 shed colours dark blue-grey and the
strips read dour beside the panoramas (most show pale panels); the shed
palette is now 7 of 11 light.

Default: `INDUSTRIAL_KIT_DEFAULT = true` — every spot is better than main on
the user's complaint (windows on tanks, shopfronts/window grids on sheds); the
WARNs are colour or roof-shape gaps, not regressions.

## Kit cannot yet express

- horizontal ring seams / wind girders on tanks; floating-roof rims;
  geodesic or domed tank roofs (only a shallow cone);
- pipe racks and pipe bridges between tanks; bund walls;
- sawtooth, curved and multi-ridge shed roofs (the roof stays the grammar's);
- signage and company-colour bands (Welhof red);
- per-pand measured cladding colour (panorama sampling per pand), so a blue
  shed can be drawn pale;
- cladding ribs only on the default look; other looks' wall layers ignore
  `wallCellM`;
- doors on non-street faces facing yards (docks are often on the yard side).
