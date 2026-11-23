# Brief: stationsplein-1 (BAG 0363100012249652)

Generated 2026-11-23 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012249652 --id=stationsplein-1`. Crops are under
`artifacts/landmark-briefs/stationsplein-1/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/stationsplein-1-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012249652 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 2018 | BAG |
| BAG status / storeys | Pand in gebruik / 1 | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 11.1 / 10.0 / 10.8 / 1.0 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 9.81 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 4 (4 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

No municipal or national monument record links this pand (scripts/data/amsterdam-monument-register snapshot). That is not evidence of no ornament: look at the crops.

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/stationsplein-1/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-218 | SW 218 | 60.6 m | **none: inferred** | - | - | - | - |
| w02-38 | NE 38 | 60.4 m | TMX7315120208-000074_pano_0002_000331 | 2016-06-09 | 23 m | 0 deg | recording_2024-12-23_09-14-39_16123 (2024) |
| w03-127 | SE 127 | 10.9 m | b_20250108_1041_Track08_Sphere_00029 | 2025-01-08 | 14 m | 1 deg | recording_2025-07-03_04-36-25_01494 (2025) |
| w04-309 | NW 309 | 10.8 m | b_20250108_1041_Track08_Sphere_00009 | 2025-01-08 | 21 m | 20 deg | TMX7316010203-001178_pano_0000_000710 (2019) |

### w01-218: faces SW (218 deg), 60.6 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w02-38: faces NE (38 deg), 60.4 m

![w02-38 rectified](../../artifacts/landmark-briefs/stationsplein-1/w02-38.jpg)
![w02-38 2024](../../artifacts/landmark-briefs/stationsplein-1/w02-38.alt.jpg)
![w02-38 aimed](../../artifacts/landmark-briefs/stationsplein-1/w02-38.thumb.jpg)

Panorama TMX7315120208-000074_pano_0002_000331 (2016-06-09), https://api.data.amsterdam.nl/panorama/panoramas/TMX7315120208-000074_pano_0002_000331/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-38]`.

### w03-127: faces SE (127 deg), 10.9 m

![w03-127 rectified](../../artifacts/landmark-briefs/stationsplein-1/w03-127.jpg)
![w03-127 2025](../../artifacts/landmark-briefs/stationsplein-1/w03-127.alt.jpg)
![w03-127 aimed](../../artifacts/landmark-briefs/stationsplein-1/w03-127.thumb.jpg)

Panorama b_20250108_1041_Track08_Sphere_00029 (2025-01-08), https://api.data.amsterdam.nl/panorama/panoramas/b_20250108_1041_Track08_Sphere_00029/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w03-127]`.

### w04-309: faces NW (309 deg), 10.8 m

![w04-309 rectified](../../artifacts/landmark-briefs/stationsplein-1/w04-309.jpg)
![w04-309 2019](../../artifacts/landmark-briefs/stationsplein-1/w04-309.alt.jpg)
![w04-309 aimed](../../artifacts/landmark-briefs/stationsplein-1/w04-309.thumb.jpg)

Panorama b_20250108_1041_Track08_Sphere_00009 (2025-01-08), https://api.data.amsterdam.nl/panorama/panoramas/b_20250108_1041_Track08_Sphere_00009/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w04-309]`.
