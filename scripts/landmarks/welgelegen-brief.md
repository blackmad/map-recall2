# Brief: welgelegen (BAG 0363100012181157)

Generated 2026-11-23 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012181157 --id=welgelegen`. Crops are under
`artifacts/landmark-briefs/welgelegen/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/welgelegen-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012181157 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1802 | BAG |
| BAG status / storeys | Pand in gebruik / 3 | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 8.1 / 8.1 / 7.8 / 0.1 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 7.65 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 5 (5 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

- **Municipal register 4107** (Rijksmonument), https://api.data.amsterdam.nl/v1/monumenten/monumenten/53b3ed33-73be-4002-a99e-7bf991f0ade9?_format=json:
  (no description text)

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/welgelegen/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-210 | SW 210 | 14.4 m | b_20241210_1246_Track19_Sphere_00157 | 2024-12-10 | 21 m | 1 deg | TMX7316010203-002047_pano_0000_001809 (2021) |
| w02-30 | NE 30 | 9.8 m | **none: inferred** | - | - | - | - |
| w03-120 | SE 120 | 5.7 m | TMX7316010203-002047_pano_0000_001806 | 2021-03-18 | 25 m | 45 deg | b_20241210_1246_Track20_Sphere_00047 (2024) |
| w04-120 | SE 120 | 5.2 m | recording_2025-06-19_04-38-42_00933 | 2025-06-19 | 24 m | 32 deg | b_20241210_1246_Track20_Sphere_00047 (2024) |
| w05-29 | NE 29 | 4.6 m | **none: inferred** | - | - | - | - |

### w01-210: faces SW (210 deg), 14.4 m

![w01-210 rectified](../../artifacts/landmark-briefs/welgelegen/w01-210.jpg)
![w01-210 2021](../../artifacts/landmark-briefs/welgelegen/w01-210.alt.jpg)
![w01-210 aimed](../../artifacts/landmark-briefs/welgelegen/w01-210.thumb.jpg)

Panorama b_20241210_1246_Track19_Sphere_00157 (2024-12-10), https://api.data.amsterdam.nl/panorama/panoramas/b_20241210_1246_Track19_Sphere_00157/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-210]`.

### w02-30: faces NE (30 deg), 9.8 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w03-120: faces SE (120 deg), 5.7 m

![w03-120 rectified](../../artifacts/landmark-briefs/welgelegen/w03-120.jpg)
![w03-120 2024](../../artifacts/landmark-briefs/welgelegen/w03-120.alt.jpg)
![w03-120 aimed](../../artifacts/landmark-briefs/welgelegen/w03-120.thumb.jpg)

Panorama TMX7316010203-002047_pano_0000_001806 (2021-03-18), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002047_pano_0000_001806/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w03-120]`.

### w04-120: faces SE (120 deg), 5.2 m

![w04-120 rectified](../../artifacts/landmark-briefs/welgelegen/w04-120.jpg)
![w04-120 2024](../../artifacts/landmark-briefs/welgelegen/w04-120.alt.jpg)
![w04-120 aimed](../../artifacts/landmark-briefs/welgelegen/w04-120.thumb.jpg)

Panorama recording_2025-06-19_04-38-42_00933 (2025-06-19), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-06-19_04-38-42_00933/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w04-120]`.

### w05-29: faces NE (29 deg), 4.6 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.
