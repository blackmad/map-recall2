# Brief: ibis-city-west (BAG 0363100012063603)

Generated 2026-11-06 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012063603 --id=ibis-city-west`. Crops are under
`artifacts/landmark-briefs/ibis-city-west/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/ibis-city-west-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012063603 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 2003 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 36.6 / 36.8 / 32.3 / 0.5 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 31.77 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 9 (9 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

No municipal or national monument record links this pand (scripts/data/amsterdam-monument-register snapshot). That is not evidence of no ornament: look at the crops.

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/ibis-city-west/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-359 | N 359 | 149.4 m | **none: inferred** | - | - | - | - |
| w02-179 | S 179 | 105.6 m | recording_2024-09-09_08-42-32_03479 | 2024-09-09 | 14 m | 2 deg | TMX7316010203-002634_pano_0004_000068 (2022) |
| w03-269 | W 269 | 42.7 m | recording_2025-07-01_10-32-54_02318 | 2025-07-01 | 21 m | 1 deg | TMX7316010203-002057_pano_0001_001960 (2021) |
| w04-179 | S 179 | 41.6 m | recording_2025-07-01_11-45-33_02123 | 2025-07-01 | 23 m | 1 deg | recording_2024-09-09_08-42-32_03698 (2024) |
| w05-89 | E 89 | 25.2 m | TMX7316060226-000462_pano_0003_002130 | 2019-11-06 | 20 m | 7 deg | TMX7316010203-000279_pano_0000_005510 (2017) |
| w06-269 | W 269 | 16.6 m | recording_2025-07-01_10-32-54_02312 | 2025-07-01 | 20 m | 0 deg | TMX7316010203-001128_pano_0000_001288 (2019) |
| w07-179 | S 179 | 12.8 m | recording_2024-09-09_08-42-32_03500 | 2024-09-09 | 14 m | 2 deg | TMX7316010203-002057_pano_0001_002181 (2021) |
| w08-359 | N 359 | 8.9 m | TMX7316010203-000279_pano_0000_005024 | 2017-04-24 | 17 m | 47 deg | TMX7316010203-001128_pano_0000_001327 (2019) |
| w09-359 | N 359 | 4.9 m | TMX7316010203-000279_pano_0000_005507 | 2017-04-24 | 10 m | 5 deg | TMX7316060226-000462_pano_0003_002112 (2019) |

### w01-359: faces N (359 deg), 149.4 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w02-179: faces S (179 deg), 105.6 m

![w02-179 rectified](../../artifacts/landmark-briefs/ibis-city-west/w02-179.jpg)
![w02-179 2022](../../artifacts/landmark-briefs/ibis-city-west/w02-179.alt.jpg)
![w02-179 aimed](../../artifacts/landmark-briefs/ibis-city-west/w02-179.thumb.jpg)

Panorama recording_2024-09-09_08-42-32_03479 (2024-09-09), https://api.data.amsterdam.nl/panorama/panoramas/recording_2024-09-09_08-42-32_03479/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-179]`.

### w03-269: faces W (269 deg), 42.7 m

![w03-269 rectified](../../artifacts/landmark-briefs/ibis-city-west/w03-269.jpg)
![w03-269 2021](../../artifacts/landmark-briefs/ibis-city-west/w03-269.alt.jpg)
![w03-269 aimed](../../artifacts/landmark-briefs/ibis-city-west/w03-269.thumb.jpg)

Panorama recording_2025-07-01_10-32-54_02318 (2025-07-01), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-07-01_10-32-54_02318/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w03-269]`.

### w04-179: faces S (179 deg), 41.6 m

![w04-179 rectified](../../artifacts/landmark-briefs/ibis-city-west/w04-179.jpg)
![w04-179 2024](../../artifacts/landmark-briefs/ibis-city-west/w04-179.alt.jpg)
![w04-179 aimed](../../artifacts/landmark-briefs/ibis-city-west/w04-179.thumb.jpg)

Panorama recording_2025-07-01_11-45-33_02123 (2025-07-01), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-07-01_11-45-33_02123/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w04-179]`.

### w05-89: faces E (89 deg), 25.2 m

![w05-89 rectified](../../artifacts/landmark-briefs/ibis-city-west/w05-89.jpg)
![w05-89 2017](../../artifacts/landmark-briefs/ibis-city-west/w05-89.alt.jpg)
![w05-89 aimed](../../artifacts/landmark-briefs/ibis-city-west/w05-89.thumb.jpg)

Panorama TMX7316060226-000462_pano_0003_002130 (2019-11-06), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316060226-000462_pano_0003_002130/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w05-89]`.

### w06-269: faces W (269 deg), 16.6 m

![w06-269 rectified](../../artifacts/landmark-briefs/ibis-city-west/w06-269.jpg)
![w06-269 2019](../../artifacts/landmark-briefs/ibis-city-west/w06-269.alt.jpg)
![w06-269 aimed](../../artifacts/landmark-briefs/ibis-city-west/w06-269.thumb.jpg)

Panorama recording_2025-07-01_10-32-54_02312 (2025-07-01), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-07-01_10-32-54_02312/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w06-269]`.

### w07-179: faces S (179 deg), 12.8 m

![w07-179 rectified](../../artifacts/landmark-briefs/ibis-city-west/w07-179.jpg)
![w07-179 2021](../../artifacts/landmark-briefs/ibis-city-west/w07-179.alt.jpg)
![w07-179 aimed](../../artifacts/landmark-briefs/ibis-city-west/w07-179.thumb.jpg)

Panorama recording_2024-09-09_08-42-32_03500 (2024-09-09), https://api.data.amsterdam.nl/panorama/panoramas/recording_2024-09-09_08-42-32_03500/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w07-179]`.

### w08-359: faces N (359 deg), 8.9 m

![w08-359 rectified](../../artifacts/landmark-briefs/ibis-city-west/w08-359.jpg)
![w08-359 2019](../../artifacts/landmark-briefs/ibis-city-west/w08-359.alt.jpg)
![w08-359 aimed](../../artifacts/landmark-briefs/ibis-city-west/w08-359.thumb.jpg)

Panorama TMX7316010203-000279_pano_0000_005024 (2017-04-24), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-000279_pano_0000_005024/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w08-359]`.

### w09-359: faces N (359 deg), 4.9 m

![w09-359 rectified](../../artifacts/landmark-briefs/ibis-city-west/w09-359.jpg)
![w09-359 2019](../../artifacts/landmark-briefs/ibis-city-west/w09-359.alt.jpg)
![w09-359 aimed](../../artifacts/landmark-briefs/ibis-city-west/w09-359.thumb.jpg)

Panorama TMX7316010203-000279_pano_0000_005507 (2017-04-24), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-000279_pano_0000_005507/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w09-359]`.
