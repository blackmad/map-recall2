# Brief: diamant-museum (BAG 0363100012076129)

Generated 2026-11-15 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012076129 --id=diamant-museum`. Crops are under
`artifacts/landmark-briefs/diamant-museum/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/diamant-museum-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012076129 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1899 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 17.5 / 17.6 / 16.3 / 0.6 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 15.76 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 6 (6 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

- **Municipal register 505735** (Rijksmonument), https://api.data.amsterdam.nl/v1/monumenten/monumenten/8d7fa6c1-b1f3-4db4-8000-f62f2c7aa49c?_format=json:
  (no description text)

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/diamant-museum/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-67 | NE 67 | 19.6 m | TMX7316010203-000985_pano_0000_000048 | 2018-06-12 | 33 m | 36 deg | b_20241211_0838_Track08_Sphere_00101 (2024) |
| w02-156 | SE 156 | 9 m | b_20241211_0838_Track09_Sphere_00069 | 2024-12-11 | 20 m | 1 deg | recording_2025-07-30_09-59-09_01439 (2025) |
| w03-337 | NW 337 | 8 m | **none: inferred** | - | - | - | - |
| w04-247 | SW 247 | 6.9 m | TMX7316010203-000785_pano_0000_000060 | 2018-06-12 | 33 m | 51 deg | - |
| w05-246 | SW 246 | 6.2 m | TMX7316010203-000785_pano_0000_000059 | 2018-06-12 | 23 m | 54 deg | TMX7316010203-002795_pano_0001_000000 (2022) |
| w06-247 | SW 247 | 4.4 m | TMX7316010203-000785_pano_0000_000060 | 2018-06-12 | 25 m | 35 deg | TMX7316010203-002816_pano_0002_000107 (2022) |

### w01-67: faces NE (67 deg), 19.6 m

![w01-67 2024](../../artifacts/landmark-briefs/diamant-museum/w01-67.alt.jpg)

Panorama TMX7316010203-000985_pano_0000_000048 (2018-06-12), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-000985_pano_0000_000048/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-67]`.

### w02-156: faces SE (156 deg), 9 m

![w02-156 rectified](../../artifacts/landmark-briefs/diamant-museum/w02-156.jpg)
![w02-156 2025](../../artifacts/landmark-briefs/diamant-museum/w02-156.alt.jpg)
![w02-156 aimed](../../artifacts/landmark-briefs/diamant-museum/w02-156.thumb.jpg)

Panorama b_20241211_0838_Track09_Sphere_00069 (2024-12-11), https://api.data.amsterdam.nl/panorama/panoramas/b_20241211_0838_Track09_Sphere_00069/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-156]`.

### w03-337: faces NW (337 deg), 8 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w04-247: faces SW (247 deg), 6.9 m

![w04-247 rectified](../../artifacts/landmark-briefs/diamant-museum/w04-247.jpg)
![w04-247 aimed](../../artifacts/landmark-briefs/diamant-museum/w04-247.thumb.jpg)

Panorama TMX7316010203-000785_pano_0000_000060 (2018-06-12), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-000785_pano_0000_000060/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w04-247]`.

### w05-246: faces SW (246 deg), 6.2 m

![w05-246 rectified](../../artifacts/landmark-briefs/diamant-museum/w05-246.jpg)
![w05-246 2022](../../artifacts/landmark-briefs/diamant-museum/w05-246.alt.jpg)
![w05-246 aimed](../../artifacts/landmark-briefs/diamant-museum/w05-246.thumb.jpg)

Panorama TMX7316010203-000785_pano_0000_000059 (2018-06-12), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-000785_pano_0000_000059/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w05-246]`.

### w06-247: faces SW (247 deg), 4.4 m

![w06-247 rectified](../../artifacts/landmark-briefs/diamant-museum/w06-247.jpg)
![w06-247 2022](../../artifacts/landmark-briefs/diamant-museum/w06-247.alt.jpg)
![w06-247 aimed](../../artifacts/landmark-briefs/diamant-museum/w06-247.thumb.jpg)

Panorama TMX7316010203-000785_pano_0000_000060 (2018-06-12), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-000785_pano_0000_000060/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w06-247]`.
