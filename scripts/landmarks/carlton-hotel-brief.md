# Brief: carlton-hotel (BAG 0363100012168111)

Generated 2026-11-01 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012168111 --id=carlton-hotel`. Crops are under
`artifacts/landmark-briefs/carlton-hotel/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/carlton-hotel-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012168111 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1900 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 39.5 / 30.7 / 33.3 / 0.8 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 38 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 11 (10 >= 4 m in this brief, 1 shorter/extra not shown) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

- **Municipal register 518381** (Rijksmonument), https://api.data.amsterdam.nl/v1/monumenten/monumenten/1e26e9e1-5977-43c0-ba00-337ac0f184c6?_format=json:
  (no description text)

- **Rijksmonument 518381** (rijksmonument), https://monumentenregister.cultureelerfgoed.nl/monumenten/518381:
  > Inleiding Op de hoek van Singel en Vijzelstraat en als 'brug' over de Reguliersdwarsstraat tussen 1925 en 1929 tot stand gekomen HOTEL met WINKELS op de begane grond, genaamd Grand Hotel Centraal, naar een ontwerp in Amsterdamse School-stijl van G.J. Rutgers in opdracht van de N.V. Grand Hotel Centraal bij monde van directeur A. Leemhuis. De inspringende bovenbouw is in 1928 ontworpen en in 1928-1929 gerealiseerd door G. van Arkel en H.J. Breman, eveneens in opdracht van de N.V. Grand Hotel Centraal. Het beeldhouwwerk is van Theo Vos. N.B. Het betreft hier het grootste en meest luxueuze hotel van zijn tijd in Nederland. Alle kamers waren voorzien van een badkamer en telefoon. Vanaf 1929 was er sprake van het Carltonhotel. In de oorlog werd het hotel gevorderd door de Luftgau Holland (de Duitse luchtmacht in Nederland). Op 27 april 1943 stortte een Britse Halifax bommenwerper op het hotel. Het hotel is daarna hersteld. Alle oorspronkelijke ramen zijn vervangen door kunststof. Omschrijving Op een rechthoekige plattegrond gerealiseerd hotel bestaande uit een geheel onderkelderde ruimte, een begane grond achter een galerij met hoekig gelijnde bogen waarin winkels en een lounge, een hoge tussenverdieping met een eet- en een conversatiezaal en een grote feestzaal als brug over de Reguliersdwarsstraat, vervolgens vier verdiepingen met daarin de hotelkamers en een fors inspringende bovenverdieping met de technische voorzieningen, personeelsruimtes en de keuken. Het gebouw wordt gedek

- **Carlton Hotel (Amsterdam)**, https://nl.wikipedia.org/wiki/Carlton_Hotel_(Amsterdam) (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > NH Flower Market, beter bekend als het Carltonhotel, is een viersterrenhotel dat in 1928 werd geopend aan het begin van de Vijzelstraat in in het centrum van Amsterdam. 

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/carlton-hotel/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-99 | E 99 | 52.2 m | b_20241203_1333_Track15_Sphere_00264 | 2024-12-03 | 9 m | 1 deg | TMX7316010203-002033_pano_0001_000392 (2021) |
| w02-102 | E 102 | 22.4 m | TMX7316060226-000019_pano_0000_005187 | 2016-08-15 | 13 m | 0 deg | TMX7316010203-000714_pano_0001_001862 (2018) |
| w03-102 | E 102 | 21.8 m | b_20241203_1333_Track15_Sphere_00249 | 2024-12-03 | 9 m | 0 deg | TMX7316010203-001646_pano_0001_000037 (2019) |
| w04-100 | E 100 | 12.9 m | TMX7316010203-002865_pano_0002_000305 | 2022-12-15 | 10 m | 0 deg | recording_2025-06-16_06-42-40_01659 (2025) |
| w05-280 | W 280 | 12.5 m | recording_2025-06-19_03-28-47_01830 | 2025-06-19 | 19 m | 1 deg | TMX7316010203-002033_pano_0001_000025 (2021) |
| w06-283 | W 283 | 8.5 m | TMX7316010203-001178_pano_0000_001632 | 2019-05-13 | 34 m | 37 deg | - |
| w07-13 | N 13 | 8 m | TMX7316010203-002359_pano_0003_000115 | 2021-12-29 | 6 m | 42 deg | - |
| w08-9 | N 9 | 6.4 m | recording_2025-06-19_03-28-47_01484 | 2025-06-19 | 10 m | 30 deg | TMX7316060226-000019_pano_0000_004204 (2016) |
| w09-192 | S 192 | 5.5 m | TMX7316010203-001178_pano_0000_001650 | 2019-05-13 | 33 m | 52 deg | - |
| w10-9 | N 9 | 4 m | TMX7316060226-000019_pano_0000_004203 | 2016-08-15 | 24 m | 18 deg | recording_2025-06-19_03-28-47_01483 (2025) |

### w01-99: faces E (99 deg), 52.2 m

![w01-99 rectified](../../artifacts/landmark-briefs/carlton-hotel/w01-99.jpg)
![w01-99 2021](../../artifacts/landmark-briefs/carlton-hotel/w01-99.alt.jpg)
![w01-99 aimed](../../artifacts/landmark-briefs/carlton-hotel/w01-99.thumb.jpg)

Panorama b_20241203_1333_Track15_Sphere_00264 (2024-12-03), https://api.data.amsterdam.nl/panorama/panoramas/b_20241203_1333_Track15_Sphere_00264/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-99]`.

### w02-102: faces E (102 deg), 22.4 m

![w02-102 rectified](../../artifacts/landmark-briefs/carlton-hotel/w02-102.jpg)
![w02-102 2018](../../artifacts/landmark-briefs/carlton-hotel/w02-102.alt.jpg)
![w02-102 aimed](../../artifacts/landmark-briefs/carlton-hotel/w02-102.thumb.jpg)

Panorama TMX7316060226-000019_pano_0000_005187 (2016-08-15), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316060226-000019_pano_0000_005187/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-102]`.

### w03-102: faces E (102 deg), 21.8 m

![w03-102 rectified](../../artifacts/landmark-briefs/carlton-hotel/w03-102.jpg)
![w03-102 2019](../../artifacts/landmark-briefs/carlton-hotel/w03-102.alt.jpg)
![w03-102 aimed](../../artifacts/landmark-briefs/carlton-hotel/w03-102.thumb.jpg)

Panorama b_20241203_1333_Track15_Sphere_00249 (2024-12-03), https://api.data.amsterdam.nl/panorama/panoramas/b_20241203_1333_Track15_Sphere_00249/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w03-102]`.

### w04-100: faces E (100 deg), 12.9 m

![w04-100 rectified](../../artifacts/landmark-briefs/carlton-hotel/w04-100.jpg)
![w04-100 2025](../../artifacts/landmark-briefs/carlton-hotel/w04-100.alt.jpg)
![w04-100 aimed](../../artifacts/landmark-briefs/carlton-hotel/w04-100.thumb.jpg)

Panorama TMX7316010203-002865_pano_0002_000305 (2022-12-15), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002865_pano_0002_000305/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w04-100]`.

### w05-280: faces W (280 deg), 12.5 m

![w05-280 rectified](../../artifacts/landmark-briefs/carlton-hotel/w05-280.jpg)
![w05-280 2021](../../artifacts/landmark-briefs/carlton-hotel/w05-280.alt.jpg)
![w05-280 aimed](../../artifacts/landmark-briefs/carlton-hotel/w05-280.thumb.jpg)

Panorama recording_2025-06-19_03-28-47_01830 (2025-06-19), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-06-19_03-28-47_01830/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w05-280]`.

### w06-283: faces W (283 deg), 8.5 m

![w06-283 rectified](../../artifacts/landmark-briefs/carlton-hotel/w06-283.jpg)
![w06-283 aimed](../../artifacts/landmark-briefs/carlton-hotel/w06-283.thumb.jpg)

Panorama TMX7316010203-001178_pano_0000_001632 (2019-05-13), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001178_pano_0000_001632/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w06-283]`.

### w07-13: faces N (13 deg), 8 m

![w07-13 rectified](../../artifacts/landmark-briefs/carlton-hotel/w07-13.jpg)
![w07-13 aimed](../../artifacts/landmark-briefs/carlton-hotel/w07-13.thumb.jpg)

Panorama TMX7316010203-002359_pano_0003_000115 (2021-12-29), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002359_pano_0003_000115/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w07-13]`.

### w08-9: faces N (9 deg), 6.4 m

![w08-9 rectified](../../artifacts/landmark-briefs/carlton-hotel/w08-9.jpg)
![w08-9 2016](../../artifacts/landmark-briefs/carlton-hotel/w08-9.alt.jpg)
![w08-9 aimed](../../artifacts/landmark-briefs/carlton-hotel/w08-9.thumb.jpg)

Panorama recording_2025-06-19_03-28-47_01484 (2025-06-19), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-06-19_03-28-47_01484/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w08-9]`.

### w09-192: faces S (192 deg), 5.5 m

![w09-192 rectified](../../artifacts/landmark-briefs/carlton-hotel/w09-192.jpg)
![w09-192 aimed](../../artifacts/landmark-briefs/carlton-hotel/w09-192.thumb.jpg)

Panorama TMX7316010203-001178_pano_0000_001650 (2019-05-13), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001178_pano_0000_001650/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w09-192]`.

### w10-9: faces N (9 deg), 4 m

![w10-9 rectified](../../artifacts/landmark-briefs/carlton-hotel/w10-9.jpg)
![w10-9 2025](../../artifacts/landmark-briefs/carlton-hotel/w10-9.alt.jpg)
![w10-9 aimed](../../artifacts/landmark-briefs/carlton-hotel/w10-9.thumb.jpg)

Panorama TMX7316060226-000019_pano_0000_004203 (2016-08-15), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316060226-000019_pano_0000_004203/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w10-9]`.
