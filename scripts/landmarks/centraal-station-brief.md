# Brief: centraal-station (BAG 0363100012185598)

Generated 2026-10-16 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012185598 --id=centraal-station`. Crops are under
`artifacts/landmark-briefs/centraal-station/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/centraal-station-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012185598 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1889 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 0.0 / 0.0 / 25.5 / 2.5 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | unknown | 3DBAG |
| tile height | 20 m | building-tiles extract |
| roof shape (OSM/aerial) | round | buildings-colored.geojson |
| exposed walls | 50 (30 >= 4 m in this brief, 20 shorter/extra not shown) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

No municipal or national monument record links this pand (scripts/data/amsterdam-monument-register snapshot). That is not evidence of no ornament: look at the crops.

- **Station Amsterdam Centraal**, https://nl.wikipedia.org/wiki/Station_Amsterdam_Centraal (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Station Amsterdam Centraal is het centraal station van de Nederlandse hoofdstad Amsterdam. Het is gebouwd tussen 1881 en 1889 naar ontwerp van Pierre Cuypers, Dolf van Gendt (stationsgebouw) en L.J. Eijmer (stationskap) op het in het IJ aangeplempte Stationseiland. Het station heeft zes perrons die via drie tunnels onder de 15 sporen (waarvan 11 perronsporen) bereikbaar zijn. Dagelijks telde Amsterdam Centraal in 2023 een aantal van 167.403 in- en uitstappers (dus exclusief overstappers), waarmee het na station Utrecht Centraal het drukste station van Nederland is. Reizigers kunnen gebruikmaken van treinen, metro's, trams, bussen en veren en fietsenstallingen. Sinds de jaren 1980 ondergaat h

- **Amsterdam Centraal station**, https://en.wikipedia.org/wiki/Amsterdam_Centraal_station (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Amsterdam Centraal station (Dutch: Station Amsterdam Centraal, lit. 'Amsterdam Central Station', Dutch pronunciation: [staːˈɕɔn ˌɑmstərˈdɑm sɛnˈtraːl], abbreviation: Asd) is the largest railway station in Amsterdam, North Holland, the Netherlands. A major international railway hub, it is used by 192,000 passengers a day, making it the second busiest railway station in the country after Utrecht Centraal and the most visited Rijksmonument of the Netherlands. National and international railway services at Amsterdam Centraal are provided by NS (Nederlandse Spoorwegen), the principal rail operator in the Netherlands. Amsterdam Centraal is the northern terminus of Amsterdam Metro lines 51, 53, 54,

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/centraal-station/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-121 | SE 121 | 32 m | TMX7316010203-002532_pano_0000_000549 | 2022-04-21 | 35 m | 53 deg | - |
| w02-31 | NE 31 | 29.9 m | TMX7316010203-002032_pano_0000_000906 | 2021-03-08 | 21 m | 0 deg | TMX7316010203-001668_pano_0000_000652 (2020) |
| w03-210 | SW 210 | 24.3 m | b_20250108_1349_Track24_Sphere_00005 | 2025-01-08 | 10 m | 1 deg | TMX7316010203-001643_pano_0000_000005 (2019) |
| w04-212 | SW 212 | 24.3 m | TMX7316010203-002857_pano_0000_000023 | 2022-12-14 | 12 m | 2 deg | TMX7316010203-001548_pano_0000_000345 (2019) |
| w05-121 | SE 121 | 23 m | b_20250108_1041_Track08_Sphere_00016 | 2025-01-08 | 24 m | 41 deg | TMX7316010203-001178_pano_0000_000720 (2019) |
| w06-212 | SW 212 | 21.3 m | **none: inferred** | - | - | - | - |
| w07-211 | SW 211 | 19.6 m | TMX7316010203-002354_pano_0000_000016 | 2021-12-27 | 22 m | 0 deg | TMX7316010203-001055_pano_0000_000152 (2018) |
| w08-211 | SW 211 | 19.2 m | TMX7316010203-002354_pano_0000_000007 | 2021-12-27 | 12 m | 2 deg | recording_2025-06-16_08-26-12_00021 (2025) |
| w09-121 | SE 121 | 19 m | TMX7316010203-001055_pano_0000_000125 | 2019-01-15 | 25 m | 2 deg | TMX7316010203-001668_pano_0000_001418 (2020) |
| w10-211 | SW 211 | 18.7 m | recording_2025-07-03_04-36-25_01464 | 2025-07-03 | 23 m | 1 deg | TMX7316010203-002032_pano_0000_002047 (2021) |
| w11-211 | SW 211 | 14.4 m | recording_2025-06-16_06-42-40_02978 | 2025-06-16 | 21 m | 0 deg | TMX7316010203-002532_pano_0000_001464 (2022) |
| w12-301 | NW 301 | 13.2 m | **none: inferred** | - | - | - | - |
| w13-301 | NW 301 | 13.1 m | TMX7316010203-001178_pano_0000_000705 | 2019-05-13 | 33 m | 50 deg | - |
| w14-121 | SE 121 | 13 m | recording_2025-06-16_08-26-12_00012 | 2025-06-16 | 23 m | 31 deg | TMX7316010203-001643_pano_0000_000017 (2019) |
| w15-211 | SW 211 | 12.1 m | TMX7316010203-002354_pano_0000_000026 | 2021-12-27 | 20 m | 3 deg | TMX7316010203-001055_pano_0000_000162 (2018) |
| w16-211 | SW 211 | 12 m | TMX7316010203-002354_pano_0000_000030 | 2021-12-27 | 24 m | 1 deg | recording_2025-06-16_06-42-40_03015 (2025) |
| w17-211 | SW 211 | 11.9 m | recording_2025-06-16_06-42-40_02816 | 2025-06-16 | 24 m | 4 deg | TMX7316010203-001643_pano_0000_000049 (2019) |
| w18-211 | SW 211 | 11.9 m | TMX7316010203-002532_pano_0000_001389 | 2022-04-21 | 23 m | 12 deg | TMX7316010203-001643_pano_0000_000046 (2019) |
| w19-211 | SW 211 | 11.9 m | TMX7316010203-001055_pano_0000_000168 | 2019-01-15 | 25 m | 17 deg | TMX7316010203-002354_pano_0000_000034 (2021) |
| w20-211 | SW 211 | 9.3 m | b_20250108_1349_Track28_Sphere_00163 | 2025-01-08 | 20 m | 3 deg | TMX7316010203-001178_pano_0000_000817 (2019) |
| w21-210 | SW 210 | 8.5 m | **none: inferred** | - | - | - | - |
| w22-301 | NW 301 | 8.2 m | TMX7316010203-000227_pano_0000_001006 | 2017-03-29 | 35 m | 42 deg | - |
| w23-211 | SW 211 | 7.9 m | TMX7316010203-001055_pano_0000_000198 | 2019-01-15 | 21 m | 1 deg | TMX7316010203-001178_pano_0000_000821 (2019) |
| w24-211 | SW 211 | 7.4 m | TMX7316010203-001643_pano_0000_000034 | 2020-02-14 | 19 m | 1 deg | recording_2025-06-16_06-42-40_03009 (2025) |
| w25-211 | SW 211 | 7.4 m | TMX7316010203-001178_pano_0000_000803 | 2019-05-13 | 25 m | 0 deg | TMX7316010203-002532_pano_0000_001388 (2022) |
| w26-121 | SE 121 | 6.9 m | TMX7316010203-001643_pano_0000_000029 | 2020-02-14 | 25 m | 34 deg | TMX7316010203-001055_pano_0000_000167 (2018) |
| w27-301 | NW 301 | 6.8 m | TMX7316010203-001643_pano_0000_000048 | 2020-02-14 | 22 m | 32 deg | TMX7316010203-002354_pano_0000_000047 (2021) |
| w28-211 | SW 211 | 6.8 m | TMX7316010203-001643_pano_0000_000030 | 2020-02-14 | 23 m | 3 deg | TMX7316010203-001055_pano_0000_000168 (2018) |
| w29-121 | SE 121 | 6.8 m | b_20250108_1041_Track08_Sphere_00049 | 2025-01-08 | 24 m | 0 deg | TMX7316010203-001668_pano_0000_001421 (2020) |
| w30-211 | SW 211 | 6.7 m | TMX7316010203-002354_pano_0000_000028 | 2021-12-27 | 21 m | 3 deg | TMX7316010203-001055_pano_0000_000164 (2018) |

### w01-121: faces SE (121 deg), 32 m

![w01-121 rectified](../../artifacts/landmark-briefs/centraal-station/w01-121.jpg)
![w01-121 aimed](../../artifacts/landmark-briefs/centraal-station/w01-121.thumb.jpg)

Panorama TMX7316010203-002532_pano_0000_000549 (2022-04-21), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002532_pano_0000_000549/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-121]`.

### w02-31: faces NE (31 deg), 29.9 m

![w02-31 rectified](../../artifacts/landmark-briefs/centraal-station/w02-31.jpg)
![w02-31 2020](../../artifacts/landmark-briefs/centraal-station/w02-31.alt.jpg)
![w02-31 aimed](../../artifacts/landmark-briefs/centraal-station/w02-31.thumb.jpg)

Panorama TMX7316010203-002032_pano_0000_000906 (2021-03-08), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002032_pano_0000_000906/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-31]`.

### w03-210: faces SW (210 deg), 24.3 m

![w03-210 rectified](../../artifacts/landmark-briefs/centraal-station/w03-210.jpg)
![w03-210 2019](../../artifacts/landmark-briefs/centraal-station/w03-210.alt.jpg)
![w03-210 aimed](../../artifacts/landmark-briefs/centraal-station/w03-210.thumb.jpg)

Panorama b_20250108_1349_Track24_Sphere_00005 (2025-01-08), https://api.data.amsterdam.nl/panorama/panoramas/b_20250108_1349_Track24_Sphere_00005/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w03-210]`.

### w04-212: faces SW (212 deg), 24.3 m

![w04-212 rectified](../../artifacts/landmark-briefs/centraal-station/w04-212.jpg)
![w04-212 2019](../../artifacts/landmark-briefs/centraal-station/w04-212.alt.jpg)
![w04-212 aimed](../../artifacts/landmark-briefs/centraal-station/w04-212.thumb.jpg)

Panorama TMX7316010203-002857_pano_0000_000023 (2022-12-14), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002857_pano_0000_000023/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w04-212]`.

### w05-121: faces SE (121 deg), 23 m

![w05-121 rectified](../../artifacts/landmark-briefs/centraal-station/w05-121.jpg)
![w05-121 2019](../../artifacts/landmark-briefs/centraal-station/w05-121.alt.jpg)
![w05-121 aimed](../../artifacts/landmark-briefs/centraal-station/w05-121.thumb.jpg)

Panorama b_20250108_1041_Track08_Sphere_00016 (2025-01-08), https://api.data.amsterdam.nl/panorama/panoramas/b_20250108_1041_Track08_Sphere_00016/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w05-121]`.

### w06-212: faces SW (212 deg), 21.3 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w07-211: faces SW (211 deg), 19.6 m

![w07-211 rectified](../../artifacts/landmark-briefs/centraal-station/w07-211.jpg)
![w07-211 2018](../../artifacts/landmark-briefs/centraal-station/w07-211.alt.jpg)
![w07-211 aimed](../../artifacts/landmark-briefs/centraal-station/w07-211.thumb.jpg)

Panorama TMX7316010203-002354_pano_0000_000016 (2021-12-27), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002354_pano_0000_000016/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w07-211]`.

### w08-211: faces SW (211 deg), 19.2 m

![w08-211 rectified](../../artifacts/landmark-briefs/centraal-station/w08-211.jpg)
![w08-211 2025](../../artifacts/landmark-briefs/centraal-station/w08-211.alt.jpg)
![w08-211 aimed](../../artifacts/landmark-briefs/centraal-station/w08-211.thumb.jpg)

Panorama TMX7316010203-002354_pano_0000_000007 (2021-12-27), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002354_pano_0000_000007/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w08-211]`.

### w09-121: faces SE (121 deg), 19 m

![w09-121 rectified](../../artifacts/landmark-briefs/centraal-station/w09-121.jpg)
![w09-121 2020](../../artifacts/landmark-briefs/centraal-station/w09-121.alt.jpg)
![w09-121 aimed](../../artifacts/landmark-briefs/centraal-station/w09-121.thumb.jpg)

Panorama TMX7316010203-001055_pano_0000_000125 (2019-01-15), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001055_pano_0000_000125/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w09-121]`.

### w10-211: faces SW (211 deg), 18.7 m

![w10-211 rectified](../../artifacts/landmark-briefs/centraal-station/w10-211.jpg)
![w10-211 2021](../../artifacts/landmark-briefs/centraal-station/w10-211.alt.jpg)
![w10-211 aimed](../../artifacts/landmark-briefs/centraal-station/w10-211.thumb.jpg)

Panorama recording_2025-07-03_04-36-25_01464 (2025-07-03), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-07-03_04-36-25_01464/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w10-211]`.

### w11-211: faces SW (211 deg), 14.4 m

![w11-211 rectified](../../artifacts/landmark-briefs/centraal-station/w11-211.jpg)
![w11-211 2022](../../artifacts/landmark-briefs/centraal-station/w11-211.alt.jpg)
![w11-211 aimed](../../artifacts/landmark-briefs/centraal-station/w11-211.thumb.jpg)

Panorama recording_2025-06-16_06-42-40_02978 (2025-06-16), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-06-16_06-42-40_02978/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w11-211]`.

### w12-301: faces NW (301 deg), 13.2 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w13-301: faces NW (301 deg), 13.1 m

![w13-301 rectified](../../artifacts/landmark-briefs/centraal-station/w13-301.jpg)
![w13-301 aimed](../../artifacts/landmark-briefs/centraal-station/w13-301.thumb.jpg)

Panorama TMX7316010203-001178_pano_0000_000705 (2019-05-13), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001178_pano_0000_000705/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w13-301]`.

### w14-121: faces SE (121 deg), 13 m

![w14-121 rectified](../../artifacts/landmark-briefs/centraal-station/w14-121.jpg)
![w14-121 2019](../../artifacts/landmark-briefs/centraal-station/w14-121.alt.jpg)
![w14-121 aimed](../../artifacts/landmark-briefs/centraal-station/w14-121.thumb.jpg)

Panorama recording_2025-06-16_08-26-12_00012 (2025-06-16), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-06-16_08-26-12_00012/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w14-121]`.

### w15-211: faces SW (211 deg), 12.1 m

![w15-211 rectified](../../artifacts/landmark-briefs/centraal-station/w15-211.jpg)
![w15-211 2018](../../artifacts/landmark-briefs/centraal-station/w15-211.alt.jpg)
![w15-211 aimed](../../artifacts/landmark-briefs/centraal-station/w15-211.thumb.jpg)

Panorama TMX7316010203-002354_pano_0000_000026 (2021-12-27), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002354_pano_0000_000026/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w15-211]`.

### w16-211: faces SW (211 deg), 12 m

![w16-211 rectified](../../artifacts/landmark-briefs/centraal-station/w16-211.jpg)
![w16-211 2025](../../artifacts/landmark-briefs/centraal-station/w16-211.alt.jpg)
![w16-211 aimed](../../artifacts/landmark-briefs/centraal-station/w16-211.thumb.jpg)

Panorama TMX7316010203-002354_pano_0000_000030 (2021-12-27), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002354_pano_0000_000030/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w16-211]`.

### w17-211: faces SW (211 deg), 11.9 m

![w17-211 rectified](../../artifacts/landmark-briefs/centraal-station/w17-211.jpg)
![w17-211 2019](../../artifacts/landmark-briefs/centraal-station/w17-211.alt.jpg)
![w17-211 aimed](../../artifacts/landmark-briefs/centraal-station/w17-211.thumb.jpg)

Panorama recording_2025-06-16_06-42-40_02816 (2025-06-16), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-06-16_06-42-40_02816/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w17-211]`.

### w18-211: faces SW (211 deg), 11.9 m

![w18-211 rectified](../../artifacts/landmark-briefs/centraal-station/w18-211.jpg)
![w18-211 2019](../../artifacts/landmark-briefs/centraal-station/w18-211.alt.jpg)
![w18-211 aimed](../../artifacts/landmark-briefs/centraal-station/w18-211.thumb.jpg)

Panorama TMX7316010203-002532_pano_0000_001389 (2022-04-21), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002532_pano_0000_001389/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w18-211]`.

### w19-211: faces SW (211 deg), 11.9 m

![w19-211 rectified](../../artifacts/landmark-briefs/centraal-station/w19-211.jpg)
![w19-211 2021](../../artifacts/landmark-briefs/centraal-station/w19-211.alt.jpg)
![w19-211 aimed](../../artifacts/landmark-briefs/centraal-station/w19-211.thumb.jpg)

Panorama TMX7316010203-001055_pano_0000_000168 (2019-01-15), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001055_pano_0000_000168/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w19-211]`.

### w20-211: faces SW (211 deg), 9.3 m

![w20-211 rectified](../../artifacts/landmark-briefs/centraal-station/w20-211.jpg)
![w20-211 2019](../../artifacts/landmark-briefs/centraal-station/w20-211.alt.jpg)
![w20-211 aimed](../../artifacts/landmark-briefs/centraal-station/w20-211.thumb.jpg)

Panorama b_20250108_1349_Track28_Sphere_00163 (2025-01-08), https://api.data.amsterdam.nl/panorama/panoramas/b_20250108_1349_Track28_Sphere_00163/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w20-211]`.

### w21-210: faces SW (210 deg), 8.5 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w22-301: faces NW (301 deg), 8.2 m

![w22-301 rectified](../../artifacts/landmark-briefs/centraal-station/w22-301.jpg)
![w22-301 aimed](../../artifacts/landmark-briefs/centraal-station/w22-301.thumb.jpg)

Panorama TMX7316010203-000227_pano_0000_001006 (2017-03-29), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-000227_pano_0000_001006/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w22-301]`.

### w23-211: faces SW (211 deg), 7.9 m

![w23-211 rectified](../../artifacts/landmark-briefs/centraal-station/w23-211.jpg)
![w23-211 2019](../../artifacts/landmark-briefs/centraal-station/w23-211.alt.jpg)
![w23-211 aimed](../../artifacts/landmark-briefs/centraal-station/w23-211.thumb.jpg)

Panorama TMX7316010203-001055_pano_0000_000198 (2019-01-15), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001055_pano_0000_000198/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w23-211]`.

### w24-211: faces SW (211 deg), 7.4 m

![w24-211 rectified](../../artifacts/landmark-briefs/centraal-station/w24-211.jpg)
![w24-211 2025](../../artifacts/landmark-briefs/centraal-station/w24-211.alt.jpg)
![w24-211 aimed](../../artifacts/landmark-briefs/centraal-station/w24-211.thumb.jpg)

Panorama TMX7316010203-001643_pano_0000_000034 (2020-02-14), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001643_pano_0000_000034/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w24-211]`.

### w25-211: faces SW (211 deg), 7.4 m

![w25-211 rectified](../../artifacts/landmark-briefs/centraal-station/w25-211.jpg)
![w25-211 2022](../../artifacts/landmark-briefs/centraal-station/w25-211.alt.jpg)
![w25-211 aimed](../../artifacts/landmark-briefs/centraal-station/w25-211.thumb.jpg)

Panorama TMX7316010203-001178_pano_0000_000803 (2019-05-13), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001178_pano_0000_000803/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w25-211]`.

### w26-121: faces SE (121 deg), 6.9 m

![w26-121 rectified](../../artifacts/landmark-briefs/centraal-station/w26-121.jpg)
![w26-121 2018](../../artifacts/landmark-briefs/centraal-station/w26-121.alt.jpg)
![w26-121 aimed](../../artifacts/landmark-briefs/centraal-station/w26-121.thumb.jpg)

Panorama TMX7316010203-001643_pano_0000_000029 (2020-02-14), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001643_pano_0000_000029/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w26-121]`.

### w27-301: faces NW (301 deg), 6.8 m

![w27-301 rectified](../../artifacts/landmark-briefs/centraal-station/w27-301.jpg)
![w27-301 2021](../../artifacts/landmark-briefs/centraal-station/w27-301.alt.jpg)
![w27-301 aimed](../../artifacts/landmark-briefs/centraal-station/w27-301.thumb.jpg)

Panorama TMX7316010203-001643_pano_0000_000048 (2020-02-14), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001643_pano_0000_000048/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w27-301]`.

### w28-211: faces SW (211 deg), 6.8 m

![w28-211 rectified](../../artifacts/landmark-briefs/centraal-station/w28-211.jpg)
![w28-211 2018](../../artifacts/landmark-briefs/centraal-station/w28-211.alt.jpg)
![w28-211 aimed](../../artifacts/landmark-briefs/centraal-station/w28-211.thumb.jpg)

Panorama TMX7316010203-001643_pano_0000_000030 (2020-02-14), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001643_pano_0000_000030/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w28-211]`.

### w29-121: faces SE (121 deg), 6.8 m

![w29-121 rectified](../../artifacts/landmark-briefs/centraal-station/w29-121.jpg)
![w29-121 2020](../../artifacts/landmark-briefs/centraal-station/w29-121.alt.jpg)
![w29-121 aimed](../../artifacts/landmark-briefs/centraal-station/w29-121.thumb.jpg)

Panorama b_20250108_1041_Track08_Sphere_00049 (2025-01-08), https://api.data.amsterdam.nl/panorama/panoramas/b_20250108_1041_Track08_Sphere_00049/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w29-121]`.

### w30-211: faces SW (211 deg), 6.7 m

![w30-211 rectified](../../artifacts/landmark-briefs/centraal-station/w30-211.jpg)
![w30-211 2018](../../artifacts/landmark-briefs/centraal-station/w30-211.alt.jpg)
![w30-211 aimed](../../artifacts/landmark-briefs/centraal-station/w30-211.thumb.jpg)

Panorama TMX7316010203-002354_pano_0000_000028 (2021-12-27), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002354_pano_0000_000028/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w30-211]`.
