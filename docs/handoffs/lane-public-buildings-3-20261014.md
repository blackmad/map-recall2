# Lane: hospitals and schools as large recipes (content, 2026-10-14)

Public buildings so far: 13 kazernes, 17 police bureaus, 4 OBA branches, 5
stadsloketten (HISTORY 2026-10-13/14). Next: **hospitals** (`amenity=hospital`
within Amsterdam: OLVG Oost and West, Amsterdam UMC AMC and VUmc, BovenIJ,
Antoni van Leeuwenhoek, Slotervaart, the Prinsengracht/Boerhaave clinics)
and the **best-known schools** (`amenity=school|college|university`, the
monumental ones: Barlaeus Gymnasium, Vossius, the Amsterdams Lyceum, the
Hogeschool and UvA buildings on the Roeterseiland, the Rijksakademie, the
Gerrit Rietveld Academie, the Berlage Lyceum, Montessori Lyceum). Same
pipeline as `lane-public-buildings-2-20261013.md`: match script (copy
`libraries-match.ts` / `public-match-lib.ts`), `kind: large` recipes on the
3DBAG massing with the components (`curve`, `wallMaterial`, `portal`,
`crosses`, `lettering`, `stoneStoreys`, `pilasters`), inventory from the
panoramas, install via `install-large.ts --install`. Hospital campuses are
many pands: take the entrance building and the street-facing wing, say
which pands are covered. Tag `publicBuilding: hospital|school` through
`build-poi-backlog.ts`.

## Deliverables
1. `hospitals-match.ts` / `schools-match.ts` with pand ids, panorama years,
   reference status.
2. Recipes, most central first: OLVG Oost (Oosterpark), the Barlaeus,
   the Roeterseiland UvA block, the Rijksakademie, OLVG West, then the rest.
3. Per building: gates, `audit:glb --file=… --only-geometry`, contact
   sheets, inventories.

## Checks
`npm run lint`, the large-tier tests, `npm run check:landmark-inventory`,
`npm run check:osm-under-models`. Report: branch, SHA, per-building table,
sheets, components, unfinished.
