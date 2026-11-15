# Brief: port-van-cleve (BAG 0363100012175578)

Generated 2026-11-15 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012175578 --id=port-van-cleve`. Crops are under
`artifacts/landmark-briefs/port-van-cleve/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/port-van-cleve-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
lettering, sign, clock, canopy, ironwork, lamp, tower, dome, colonnade or unusual window shape a rider would notice at 1.7 m or on a
gallery card, with its size, the panorama it was seen in, and its plan (`modelled`, `simplified` + how, or `skipped` + a coded reason).
"No component" and "the facade systems cannot express it" are not reasons: the bespoke builder exists for exactly those parts.
Then answer the signature question and budget the hand triangles against the inventory.

## Signature question

Name the features that make this building recognisable, most recognisable first (item ids in the
inventory's `signature`). Each must end up `modelled` or `simplified`; a signature item can never be skipped.

## Facts

| fact | value | source |
|---|---|---|
| BAG pand | 0363100012175578 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1768 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 18.3 / 0.0 / 18.0 / 1.4 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 16.59 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 2 (2 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

No municipal or national monument record links this pand (scripts/data/amsterdam-monument-register snapshot). That is not evidence of no ornament: look at the crops.

- **Hotel Die Port van Cleve**, https://nl.wikipedia.org/wiki/Hotel_Die_Port_van_Cleve (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Hotel Die Port van Cleve is een historisch 4-sterrenhotel aan de Nieuwezijds Voorburgwal in Amsterdam. Het hotel is gelegen in het centrum van Amsterdam, naast het Magna Plaza, achter het Koninklijk Paleis op de Dam. Het hotel beschikt over 122 kamers, een restaurant en een bar-bodega. 

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/port-van-cleve/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-31 | NE 31 | 6.7 m | b_20250109_1300_Track05_Sphere_00101 | 2025-01-09 | 22 m | 24 deg | recording_2025-06-16_03-46-32_00669 (2025) |
| w02-122 | SE 122 | 5.9 m | TMX7316010203-001054_pano_0000_001822 | 2019-01-15 | 21 m | 0 deg | recording_2025-06-16_06-42-40_02449 (2025) |

### w01-31: faces NE (31 deg), 6.7 m

![w01-31 rectified](../../artifacts/landmark-briefs/port-van-cleve/w01-31.jpg)
![w01-31 2025](../../artifacts/landmark-briefs/port-van-cleve/w01-31.alt.jpg)
![w01-31 aimed](../../artifacts/landmark-briefs/port-van-cleve/w01-31.thumb.jpg)

Panorama b_20250109_1300_Track05_Sphere_00101 (2025-01-09), https://api.data.amsterdam.nl/panorama/panoramas/b_20250109_1300_Track05_Sphere_00101/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-31]`.

### w02-122: faces SE (122 deg), 5.9 m

![w02-122 rectified](../../artifacts/landmark-briefs/port-van-cleve/w02-122.jpg)
![w02-122 2025](../../artifacts/landmark-briefs/port-van-cleve/w02-122.alt.jpg)
![w02-122 aimed](../../artifacts/landmark-briefs/port-van-cleve/w02-122.thumb.jpg)

Panorama TMX7316010203-001054_pano_0000_001822 (2019-01-15), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001054_pano_0000_001822/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-122]`.
