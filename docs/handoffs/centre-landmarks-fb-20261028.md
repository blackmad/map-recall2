# Centre landmark and label feedback lane (issue #94), 2026-10-28/29

Branch `lane/centre-landmarks-fb-20261028`. Replay any note's pose with
`CENTRE_FB_OUT=<dir> [CENTRE_FB_ONLY=<ids>] [CENTRE_FB_PICK="x,y;..."] [CENTRE_FB_W=1920 CENTRE_FB_H=1080] PW_PORT=<port> npx playwright test centre-feedback --project=desktop`
(`tests/e2e/centre-feedback.spec.ts`; Free Ride, as the notes were sent; `CENTRE_FB_FREE=0` for a quiz ride).
`CENTRE_FB_PICK` prints which model (signature / three / tiles layer, id) each pixel shows.

## Fixed on this branch

| note | cause | fix |
|---|---|---|
| d85ba0ac, 3702bcd7 double labels | Free Ride drew a marker pill and an overlay label for the same landmark; a pill for the Cuypersgebouw inside Central Station | `labelDedupe.screenDuplicateIds`, `freeRide.secondMarkerIds` |
| 58f97b44 Beurs floating windows | arches/clock plates 0.11-0.18 m off the walls; tower arches on segments running onto the 14 m block | `beurs-berlage-builder.ts`: per-window wall check, parts reach back into the wall |
| 3026cca1 Bijenkorf windows | Dam/Beursplein end fronts on a fixed line 0.25-0.39 m behind the surveyed ring | `retail-cinema-builders.ts`: end fronts fitted to the ring |
| 59b67ef0 grey strip | random `stair-glass` extra (p 0.3) on Dam 2 and the 1991 corner by the Bijenkorf | `facadeExtras.ts`: p 0 |

## Not fixed: 334bcadd, Stationsplein island (needs a bespoke landmark lane)

The whole row on the island south of Centraal is ONE BAG pand,
`NL.IMBAG.Pand.0363100012182895` (bouwjaar 1705 in BAG, a placeholder year),
addresses Stationsplein 4, 6, 8, 10 and 16 (5 vbo: bijeenkomst 716/330/151 m2,
winkel 284/25 m2: Loetje, the former NZH koffiehuis / tourist office, Albert
Heijn to go). The pand is not in the game's building tiles, so the game draws
the nine OSM building ways instead (w57864041, w752700325, w752700326,
w752700327, w752700330, w752700331, w752700334, w752713621, ...) as generic
6-12 m boxes in red brick. Panoramas (CC BY 4.0, Gemeente Amsterdam):
recording_2025-06-16_06-42-40_03015 (north side, from the tram stops) and
TMX7316010203-001981_pano_0000_000039 (2021-01-25, west end across the water)
show low one- and two-storey cream/white rendered pavilions with orange-red
tiled mansard roofs, dormers, and a white lantern turret with a lead spire.
Large-recipe route is blocked (no 3DBAG shell in the tiles), so this is a
bespoke landmark (track A). Do not install the OSM boxes as "fixed".

## Not fixed: bbbeaceb, De Ruijterkade behind Centraal

The note's spot (4.90243, 52.37949, riding west on the quay) is under the IJ
canopy of the `centraal-station` model (part "Overkapping IJsei", eaves 9.2 m,
top 22 m, a symmetric half-ellipse sheet). Panorama
recording_2025-06-17_09-10-34_02640 (2025-06-17) shows what the model lacks:
the canopy's white steel arch ribs come down to the quay on its north side,
beyond the bike path, and the glazed vault (orange/red/yellow pattern) stands
open over the walkway above the station's glass IJ front ("Amsterdam
Centraal", De Ruijterkade 24-26 shops). In the game the canopy is an opaque
dark tube whose north edge stops at 9.2 m, with no ribs on the quay.

BAG pands on this stretch (PDOK BAG WFS, 2026-10-29):

| pand | year | address | use | in game |
|---|---|---|---|---|
| 0363100012242112 | 2016 | De Ruijterkade 24-26 | shops (IJ front under the canopy) | OSM parts only, under the Centraal model |
| 0363100012255077 | 2023 | De Ruijterkade 37 | overige 4,362 m2 | not in tiles (check whether it is underground before modelling) |
| 0363100012245758 | 2015 | Michiel de Ruijtertunnel 3 | overige 1,125 m2 | not in tiles |
| 0363100012245759 | 2015 | Michiel de Ruijtertunnel 5 | overige 531 m2 | not in tiles |
| 0363100012246251 | 2016 | De Ruijterkade 46A | bijeenkomst 118 m2 | not in tiles |
| 0363100012240304 | 2011 | De Ruijterkade 80 | bijeenkomst 48 m2 | not in tiles |
| 0363100012177894 | 2008 | De Ruijterkade 35 | bijeenkomst 84 m2 (ferry pavilion) | in tiles |
| 0363100012249652 | 2018 | Stationsplein 1 | overige 594 m2 | in tiles |

Next step: count and place the north-side arch ribs from the 2023 orthophoto
(`artifacts/centraal-lane/ortho.ts`) and the panoramas, then give the IJsei
profile its asymmetric north side (ribs to the quay) in
`centraal-complex-builder.ts`. Do not invent the rib spacing.

## Still wrong

- LOD1 GLBs of the Beurs and Bijenkorf are stale (old geometry); the Beurs
  LOD1 also skews its window frames into tan panels. Integrator:
  `npm run build:landmark-lods && npm run check:landmark-lods`.
- Two "Centraal Station ⛴" MapLibre ferry-terminal labels (layer
  `cycling-ferry-terminal-labels`) can share the IJ-side view.
- The Beurs model is still a generic brick mass with paired windows; it does
  not yet carry the Damrak arcade, the Beursplein entrance or the stepped
  gables seen in the panoramas (review sheet in
  `artifacts/review/de-beurs-van-berlage-before/sheet.png`, local).
- `src/canalRecall/labels/labelsOcclusion.test.ts` is not wired into any npm
  test script.
