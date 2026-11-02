# Brief: kraanspoor (BAG 0363100012115127)

Generated 2026-11-01 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012115127 --id=kraanspoor`. Crops are under
`artifacts/landmark-briefs/kraanspoor/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/kraanspoor-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012115127 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 2008 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 28.2 / 0.0 / 26.4 / 1.4 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 25.01 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 4 (4 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

No municipal or national monument record links this pand (scripts/data/amsterdam-monument-register snapshot). That is not evidence of no ornament: look at the crops.

- **Kraanspoor**, https://nl.wikipedia.org/wiki/Kraanspoor (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Kraanspoor in een straat in Amsterdam-Noord; het is tevens de naam van het grootste gebouw aan die straat. 

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/kraanspoor/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-308 | NW 308 | 261.9 m | **none: inferred** | - | - | - | - |
| w02-128 | SE 128 | 261.9 m | recording_2024-10-23_07-33-22_00814 | 2024-10-23 | 34 m | 0 deg | TMX7316010203-002193_pano_0000_004912 (2021) |
| w03-218 | SW 218 | 13 m | TMX7315120208-000105_pano_0001_003044 | 2016-07-08 | 24 m | 48 deg | - |
| w04-38 | NE 38 | 12.9 m | recording_2025-09-22_07-53-54_00663 | 2025-09-22 | 26 m | 54 deg | - |

### w01-308: faces NW (308 deg), 261.9 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w02-128: faces SE (128 deg), 261.9 m

![w02-128 rectified](../../artifacts/landmark-briefs/kraanspoor/w02-128.jpg)
![w02-128 2021](../../artifacts/landmark-briefs/kraanspoor/w02-128.alt.jpg)
![w02-128 aimed](../../artifacts/landmark-briefs/kraanspoor/w02-128.thumb.jpg)

Panorama recording_2024-10-23_07-33-22_00814 (2024-10-23), https://api.data.amsterdam.nl/panorama/panoramas/recording_2024-10-23_07-33-22_00814/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-128]`.

### w03-218: faces SW (218 deg), 13 m

![w03-218 rectified](../../artifacts/landmark-briefs/kraanspoor/w03-218.jpg)
![w03-218 aimed](../../artifacts/landmark-briefs/kraanspoor/w03-218.thumb.jpg)

Panorama TMX7315120208-000105_pano_0001_003044 (2016-07-08), https://api.data.amsterdam.nl/panorama/panoramas/TMX7315120208-000105_pano_0001_003044/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w03-218]`.

### w04-38: faces NE (38 deg), 12.9 m

![w04-38 rectified](../../artifacts/landmark-briefs/kraanspoor/w04-38.jpg)
![w04-38 aimed](../../artifacts/landmark-briefs/kraanspoor/w04-38.thumb.jpg)

Panorama recording_2025-09-22_07-53-54_00663 (2025-09-22), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-09-22_07-53-54_00663/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w04-38]`.
