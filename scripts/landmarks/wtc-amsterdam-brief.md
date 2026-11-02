# Brief: wtc-amsterdam (BAG 0363100012096613)

Generated 2026-11-02 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012096613 --id=wtc-amsterdam`. Crops are under
`artifacts/landmark-briefs/wtc-amsterdam/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/wtc-amsterdam-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012096613 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1985 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 66.0 / 64.5 / 42.8 / -2.2 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 45 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 43 (30 >= 4 m in this brief, 13 shorter/extra not shown) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

No municipal or national monument record links this pand (scripts/data/amsterdam-monument-register snapshot). That is not evidence of no ornament: look at the crops.

- **World Trade Center (Amsterdam)**, https://nl.wikipedia.org/wiki/World_Trade_Center_(Amsterdam) (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Het World Trade Center (WTC) is een commercieel centrum op de Zuidas in Amsterdam (Nederland) met meer dan 144.000 m² kantoorruimte. 

- **Station Amsterdam Zuid**, https://nl.wikipedia.org/wiki/Station_Amsterdam_Zuid (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Station Amsterdam Zuid is een spoorwegstation en metrostation, met nabijgelegen haltes voor tram en bus in het Amsterdamse stadsdeel Zuid. Het ligt in het centrum van de Zuidas, tussen de beide rijbanen van de A10 Zuid. Het spoorwegstation ligt aan de Schiphollijn en heeft vier sporen aan twee eilandperrons; het aangrenzende metrostation wordt bediend door de lijnen 50, 51 en 52. Rond het station liggen haltes voor stads- en streekbussen en de tramlijnen 5, 6 en 25. Het station werd in 1978 geopend als eindpunt van een pendeldienst naar Schiphol naar ontwerp van de architecten Ben Spängberg en Koen van der Gaast. Door de aanleg van de Zuidtak van de Ringspoorbaan, de ontwikkeling van de Zuid

- **Tramlijn 5 (Amsterdam)**, https://nl.wikipedia.org/wiki/Tramlijn_5_(Amsterdam) (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Tramlijn 5 is een tramlijn in Amsterdam en Amstelveen op de route Westergasfabriek – Leidseplein – Station Zuid – Amstelveen Stadshart. 

- **Amsterdam Zuid station**, https://en.wikipedia.org/wiki/Amsterdam_Zuid_station (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Amsterdam Zuid (Dutch pronunciation: [ˌɑmstərdɑm ˈzœyt]; lit. 'Amsterdam South') is a railway station situated in the borough of Amsterdam-Zuid in Amsterdam, Netherlands. For a number of years, it was named Amsterdam Zuid WTC, in reference to the neighbouring World Trade Center Amsterdam. In 2006, in conjunction with the rapid development of the area surrounding the station, the station was enlarged and the reference to the WTC was formally dropped from the name. As of 2021, Amsterdam Zuid also has a metro station served by 3 lines (50, 51, 52) of the Amsterdam Metro, and two tram stops (Station Zuid and Parnassusweg) served by tram lines 5 and 25. During 1978, Amsterdam Zuid station opened 

- **Amsterdam tram line 5**, https://en.wikipedia.org/wiki/Amsterdam_tram_line_5 (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Tramlijn 5 is a tram line operating between Amsterdam and Amstelveen in the Netherlands. Operated by the municipal transport company GVB, the route runs between Van Hallstraat (signed as Westergasfabriek) in Amsterdam and Stadshart in the neighbouring municipality of Amstelveen. Tram line 5 connects several important areas of the city, including the Zuidas financial district and Leidseplein, and also provides a rapid tram route south of Amsterdam Zuid station to Stadshart, Amstelveen's town centre. 

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/wtc-amsterdam/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-357 | N 357 | 51.8 m | recording_2024-09-02_09-15-33_01153 | 2024-09-02 | 20 m | 1 deg | TMX7316010203-002918_pano_0013_000684 (2022) |
| w02-177 | S 177 | 44.6 m | TMX7316010203-001789_pano_0002_003459 | 2020-07-06 | 11 m | 3 deg | TMX7316010203-002476_pano_0001_002585 (2022) |
| w03-177 | S 177 | 43.9 m | TMX7316010203-002476_pano_0001_002572 | 2022-03-24 | 17 m | 0 deg | TMX7316010203-001479_pano_0002_000492 (2019) |
| w04-177 | S 177 | 43.4 m | TMX7316010203-002406_pano_0009_000055 | 2022-01-10 | 11 m | 9 deg | TMX7316060226-000009_pano_0000_001284 (2016) |
| w05-267 | W 267 | 43.3 m | TMX7316010203-001894_pano_0000_003204 | 2020-08-27 | 10 m | 5 deg | TMX7316010203-002406_pano_0009_000081 (2021) |
| w06-267 | W 267 | 36.1 m | TMX7316010203-002406_pano_0009_000072 | 2022-01-10 | 9 m | 4 deg | TMX7316010203-001894_pano_0000_003196 (2020) |
| w07-357 | N 357 | 29.5 m | TMX7316010203-001789_pano_0002_002712 | 2020-07-06 | 22 m | 0 deg | TMX7316010203-001034_pano_0007_001065 (2018) |
| w08-357 | N 357 | 28.6 m | TMX7316010203-002918_pano_0013_000473 | 2023-01-05 | 30 m | 0 deg | recording_2024-09-02_09-15-33_01171 (2024) |
| w09-357 | N 357 | 27.8 m | **none: inferred** | - | - | - | - |
| w10-87 | E 87 | 20.8 m | **none: inferred** | - | - | - | - |
| w11-177 | S 177 | 20.7 m | recording_2025-07-29_10-56-07_00347 | 2025-07-29 | 24 m | 3 deg | TMX7316010203-001789_pano_0002_003440 (2020) |
| w12-177 | S 177 | 18.6 m | recording_2025-07-29_10-56-07_00333 | 2025-07-29 | 15 m | 2 deg | TMX7316010203-001163_pano_0000_002683 (2019) |
| w13-87 | E 87 | 17.6 m | recording_2024-09-03_06-13-33_00109 | 2024-09-03 | 17 m | 3 deg | TMX7316010203-000770_pano_0000_001158 (2018) |
| w14-87 | E 87 | 15.8 m | TMX7316010203-001789_pano_0002_003440 | 2020-07-06 | 18 m | 46 deg | TMX7316010203-001163_pano_0000_002674 (2019) |
| w15-357 | N 357 | 15.5 m | **none: inferred** | - | - | - | - |
| w16-87 | E 87 | 15.1 m | TMX7316010203-000255_pano_0000_003178 | 2017-04-11 | 30 m | 33 deg | - |
| w17-357 | N 357 | 14.7 m | TMX7316010203-002918_pano_0013_000673 | 2023-01-05 | 8 m | 1 deg | TMX7316010203-001789_pano_0002_002181 (2020) |
| w18-176 | S 176 | 14.7 m | TMX7316010203-002406_pano_0009_000063 | 2022-01-10 | 9 m | 12 deg | TMX7316010203-002492_pano_0005_000957 (2022) |
| w19-357 | N 357 | 13.7 m | **none: inferred** | - | - | - | - |
| w20-177 | S 177 | 13.7 m | **none: inferred** | - | - | - | - |
| w21-357 | N 357 | 13.3 m | recording_2025-07-29_10-56-07_00288 | 2025-07-29 | 23 m | 2 deg | TMX7316010203-002918_pano_0013_000477 (2022) |
| w22-87 | E 87 | 13.3 m | TMX7316010203-002918_pano_0013_000471 | 2023-01-05 | 34 m | 43 deg | - |
| w23-87 | E 87 | 13 m | TMX7316010203-002918_pano_0013_000449 | 2023-01-05 | 20 m | 22 deg | recording_2025-07-29_10-56-07_00260 (2025) |
| w24-267 | W 267 | 12.6 m | TMX7316010203-001163_pano_0000_002669 | 2019-05-06 | 24 m | 46 deg | TMX7316060226-000009_pano_0000_001281 (2016) |
| w25-357 | N 357 | 10.9 m | TMX7316010203-002476_pano_0001_002410 | 2022-03-24 | 23 m | 1 deg | recording_2024-09-02_09-15-33_01145 (2024) |
| w26-87 | E 87 | 10.5 m | TMX7316060226-000009_pano_0000_001286 | 2016-07-29 | 24 m | 31 deg | TMX7316010203-002406_pano_0009_000055 (2021) |
| w27-267 | W 267 | 10.3 m | TMX7316010203-002918_pano_0013_000443 | 2023-01-05 | 24 m | 19 deg | TMX7316060226-000009_pano_0000_001313 (2016) |
| w28-357 | N 357 | 9.6 m | recording_2024-09-02_09-15-33_01147 | 2024-09-02 | 11 m | 2 deg | TMX7316010203-001163_pano_0000_003962 (2019) |
| w29-87 | E 87 | 9.6 m | recording_2025-07-29_10-56-07_00309 | 2025-07-29 | 29 m | 0 deg | TMX7316060226-000009_pano_0000_001241 (2016) |
| w30-87 | E 87 | 9.3 m | TMX7316010203-002918_pano_0013_000453 | 2023-01-05 | 21 m | 27 deg | recording_2024-09-02_09-15-33_01154 (2024) |

### w01-357: faces N (357 deg), 51.8 m

![w01-357 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w01-357.jpg)
![w01-357 2022](../../artifacts/landmark-briefs/wtc-amsterdam/w01-357.alt.jpg)
![w01-357 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w01-357.thumb.jpg)

Panorama recording_2024-09-02_09-15-33_01153 (2024-09-02), https://api.data.amsterdam.nl/panorama/panoramas/recording_2024-09-02_09-15-33_01153/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-357]`.

### w02-177: faces S (177 deg), 44.6 m

![w02-177 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w02-177.jpg)
![w02-177 2022](../../artifacts/landmark-briefs/wtc-amsterdam/w02-177.alt.jpg)
![w02-177 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w02-177.thumb.jpg)

Panorama TMX7316010203-001789_pano_0002_003459 (2020-07-06), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001789_pano_0002_003459/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-177]`.

### w03-177: faces S (177 deg), 43.9 m

![w03-177 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w03-177.jpg)
![w03-177 2019](../../artifacts/landmark-briefs/wtc-amsterdam/w03-177.alt.jpg)
![w03-177 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w03-177.thumb.jpg)

Panorama TMX7316010203-002476_pano_0001_002572 (2022-03-24), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002476_pano_0001_002572/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w03-177]`.

### w04-177: faces S (177 deg), 43.4 m

![w04-177 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w04-177.jpg)
![w04-177 2016](../../artifacts/landmark-briefs/wtc-amsterdam/w04-177.alt.jpg)
![w04-177 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w04-177.thumb.jpg)

Panorama TMX7316010203-002406_pano_0009_000055 (2022-01-10), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002406_pano_0009_000055/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w04-177]`.

### w05-267: faces W (267 deg), 43.3 m

![w05-267 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w05-267.jpg)
![w05-267 2021](../../artifacts/landmark-briefs/wtc-amsterdam/w05-267.alt.jpg)
![w05-267 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w05-267.thumb.jpg)

Panorama TMX7316010203-001894_pano_0000_003204 (2020-08-27), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001894_pano_0000_003204/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w05-267]`.

### w06-267: faces W (267 deg), 36.1 m

![w06-267 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w06-267.jpg)
![w06-267 2020](../../artifacts/landmark-briefs/wtc-amsterdam/w06-267.alt.jpg)
![w06-267 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w06-267.thumb.jpg)

Panorama TMX7316010203-002406_pano_0009_000072 (2022-01-10), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002406_pano_0009_000072/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w06-267]`.

### w07-357: faces N (357 deg), 29.5 m

![w07-357 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w07-357.jpg)
![w07-357 2018](../../artifacts/landmark-briefs/wtc-amsterdam/w07-357.alt.jpg)
![w07-357 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w07-357.thumb.jpg)

Panorama TMX7316010203-001789_pano_0002_002712 (2020-07-06), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001789_pano_0002_002712/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w07-357]`.

### w08-357: faces N (357 deg), 28.6 m

![w08-357 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w08-357.jpg)
![w08-357 2024](../../artifacts/landmark-briefs/wtc-amsterdam/w08-357.alt.jpg)
![w08-357 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w08-357.thumb.jpg)

Panorama TMX7316010203-002918_pano_0013_000473 (2023-01-05), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002918_pano_0013_000473/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w08-357]`.

### w09-357: faces N (357 deg), 27.8 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w10-87: faces E (87 deg), 20.8 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w11-177: faces S (177 deg), 20.7 m

![w11-177 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w11-177.jpg)
![w11-177 2020](../../artifacts/landmark-briefs/wtc-amsterdam/w11-177.alt.jpg)
![w11-177 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w11-177.thumb.jpg)

Panorama recording_2025-07-29_10-56-07_00347 (2025-07-29), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-07-29_10-56-07_00347/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w11-177]`.

### w12-177: faces S (177 deg), 18.6 m

![w12-177 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w12-177.jpg)
![w12-177 2019](../../artifacts/landmark-briefs/wtc-amsterdam/w12-177.alt.jpg)
![w12-177 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w12-177.thumb.jpg)

Panorama recording_2025-07-29_10-56-07_00333 (2025-07-29), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-07-29_10-56-07_00333/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w12-177]`.

### w13-87: faces E (87 deg), 17.6 m

![w13-87 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w13-87.jpg)
![w13-87 2018](../../artifacts/landmark-briefs/wtc-amsterdam/w13-87.alt.jpg)
![w13-87 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w13-87.thumb.jpg)

Panorama recording_2024-09-03_06-13-33_00109 (2024-09-03), https://api.data.amsterdam.nl/panorama/panoramas/recording_2024-09-03_06-13-33_00109/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w13-87]`.

### w14-87: faces E (87 deg), 15.8 m

![w14-87 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w14-87.jpg)
![w14-87 2019](../../artifacts/landmark-briefs/wtc-amsterdam/w14-87.alt.jpg)
![w14-87 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w14-87.thumb.jpg)

Panorama TMX7316010203-001789_pano_0002_003440 (2020-07-06), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001789_pano_0002_003440/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w14-87]`.

### w15-357: faces N (357 deg), 15.5 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w16-87: faces E (87 deg), 15.1 m

![w16-87 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w16-87.jpg)
![w16-87 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w16-87.thumb.jpg)

Panorama TMX7316010203-000255_pano_0000_003178 (2017-04-11), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-000255_pano_0000_003178/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w16-87]`.

### w17-357: faces N (357 deg), 14.7 m

![w17-357 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w17-357.jpg)
![w17-357 2020](../../artifacts/landmark-briefs/wtc-amsterdam/w17-357.alt.jpg)
![w17-357 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w17-357.thumb.jpg)

Panorama TMX7316010203-002918_pano_0013_000673 (2023-01-05), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002918_pano_0013_000673/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w17-357]`.

### w18-176: faces S (176 deg), 14.7 m

![w18-176 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w18-176.jpg)
![w18-176 2022](../../artifacts/landmark-briefs/wtc-amsterdam/w18-176.alt.jpg)
![w18-176 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w18-176.thumb.jpg)

Panorama TMX7316010203-002406_pano_0009_000063 (2022-01-10), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002406_pano_0009_000063/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w18-176]`.

### w19-357: faces N (357 deg), 13.7 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w20-177: faces S (177 deg), 13.7 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w21-357: faces N (357 deg), 13.3 m

![w21-357 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w21-357.jpg)
![w21-357 2022](../../artifacts/landmark-briefs/wtc-amsterdam/w21-357.alt.jpg)
![w21-357 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w21-357.thumb.jpg)

Panorama recording_2025-07-29_10-56-07_00288 (2025-07-29), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-07-29_10-56-07_00288/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w21-357]`.

### w22-87: faces E (87 deg), 13.3 m

![w22-87 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w22-87.jpg)
![w22-87 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w22-87.thumb.jpg)

Panorama TMX7316010203-002918_pano_0013_000471 (2023-01-05), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002918_pano_0013_000471/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w22-87]`.

### w23-87: faces E (87 deg), 13 m

![w23-87 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w23-87.jpg)
![w23-87 2025](../../artifacts/landmark-briefs/wtc-amsterdam/w23-87.alt.jpg)
![w23-87 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w23-87.thumb.jpg)

Panorama TMX7316010203-002918_pano_0013_000449 (2023-01-05), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002918_pano_0013_000449/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w23-87]`.

### w24-267: faces W (267 deg), 12.6 m

![w24-267 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w24-267.jpg)
![w24-267 2016](../../artifacts/landmark-briefs/wtc-amsterdam/w24-267.alt.jpg)
![w24-267 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w24-267.thumb.jpg)

Panorama TMX7316010203-001163_pano_0000_002669 (2019-05-06), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001163_pano_0000_002669/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w24-267]`.

### w25-357: faces N (357 deg), 10.9 m

![w25-357 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w25-357.jpg)
![w25-357 2024](../../artifacts/landmark-briefs/wtc-amsterdam/w25-357.alt.jpg)
![w25-357 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w25-357.thumb.jpg)

Panorama TMX7316010203-002476_pano_0001_002410 (2022-03-24), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002476_pano_0001_002410/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w25-357]`.

### w26-87: faces E (87 deg), 10.5 m

![w26-87 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w26-87.jpg)
![w26-87 2021](../../artifacts/landmark-briefs/wtc-amsterdam/w26-87.alt.jpg)
![w26-87 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w26-87.thumb.jpg)

Panorama TMX7316060226-000009_pano_0000_001286 (2016-07-29), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316060226-000009_pano_0000_001286/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w26-87]`.

### w27-267: faces W (267 deg), 10.3 m

![w27-267 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w27-267.jpg)
![w27-267 2016](../../artifacts/landmark-briefs/wtc-amsterdam/w27-267.alt.jpg)
![w27-267 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w27-267.thumb.jpg)

Panorama TMX7316010203-002918_pano_0013_000443 (2023-01-05), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002918_pano_0013_000443/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w27-267]`.

### w28-357: faces N (357 deg), 9.6 m

![w28-357 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w28-357.jpg)
![w28-357 2019](../../artifacts/landmark-briefs/wtc-amsterdam/w28-357.alt.jpg)
![w28-357 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w28-357.thumb.jpg)

Panorama recording_2024-09-02_09-15-33_01147 (2024-09-02), https://api.data.amsterdam.nl/panorama/panoramas/recording_2024-09-02_09-15-33_01147/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w28-357]`.

### w29-87: faces E (87 deg), 9.6 m

![w29-87 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w29-87.jpg)
![w29-87 2016](../../artifacts/landmark-briefs/wtc-amsterdam/w29-87.alt.jpg)
![w29-87 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w29-87.thumb.jpg)

Panorama recording_2025-07-29_10-56-07_00309 (2025-07-29), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-07-29_10-56-07_00309/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w29-87]`.

### w30-87: faces E (87 deg), 9.3 m

![w30-87 rectified](../../artifacts/landmark-briefs/wtc-amsterdam/w30-87.jpg)
![w30-87 2024](../../artifacts/landmark-briefs/wtc-amsterdam/w30-87.alt.jpg)
![w30-87 aimed](../../artifacts/landmark-briefs/wtc-amsterdam/w30-87.thumb.jpg)

Panorama TMX7316010203-002918_pano_0013_000453 (2023-01-05), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002918_pano_0013_000453/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w30-87]`.
