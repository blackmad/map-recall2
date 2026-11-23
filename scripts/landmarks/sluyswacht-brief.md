# Brief: sluyswacht (BAG 0363100012182908)

Generated 2026-11-23 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012182908 --id=sluyswacht`. Crops are under
`artifacts/landmark-briefs/sluyswacht/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/sluyswacht-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012182908 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1695 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 11.9 / 11.9 / 10.8 / 1.9 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 8.98 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 4 (4 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

- **Municipal register 2028** (Rijksmonument), https://api.data.amsterdam.nl/v1/monumenten/monumenten/97052ee1-06f1-4f51-942a-9471551f4793?_format=json:
  (no description text)

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/sluyswacht/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-133 | SE 133 | 10.3 m | **none: inferred** | - | - | - | - |
| w02-313 | NW 313 | 10.3 m | b_20250108_1349_Track08_Sphere_00001 | 2025-01-08 | 25 m | 18 deg | TMX7316010203-001981_pano_0000_000794 (2021) |
| w03-224 | SW 224 | 5 m | TMX7316010203-000355_pano_0001_001614 | 2017-07-07 | 24 m | 21 deg | TMX7316010203-001981_pano_0000_000791 (2021) |
| w04-44 | NE 44 | 5 m | TMX7316010203-001981_pano_0000_000796 | 2021-01-25 | 13 m | 6 deg | TMX7316010203-000355_pano_0001_001619 (2017) |

### w01-133: faces SE (133 deg), 10.3 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w02-313: faces NW (313 deg), 10.3 m

![w02-313 rectified](../../artifacts/landmark-briefs/sluyswacht/w02-313.jpg)
![w02-313 2021](../../artifacts/landmark-briefs/sluyswacht/w02-313.alt.jpg)
![w02-313 aimed](../../artifacts/landmark-briefs/sluyswacht/w02-313.thumb.jpg)

Panorama b_20250108_1349_Track08_Sphere_00001 (2025-01-08), https://api.data.amsterdam.nl/panorama/panoramas/b_20250108_1349_Track08_Sphere_00001/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-313]`.

### w03-224: faces SW (224 deg), 5 m

![w03-224 rectified](../../artifacts/landmark-briefs/sluyswacht/w03-224.jpg)
![w03-224 2021](../../artifacts/landmark-briefs/sluyswacht/w03-224.alt.jpg)
![w03-224 aimed](../../artifacts/landmark-briefs/sluyswacht/w03-224.thumb.jpg)

Panorama TMX7316010203-000355_pano_0001_001614 (2017-07-07), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-000355_pano_0001_001614/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w03-224]`.

### w04-44: faces NE (44 deg), 5 m

![w04-44 rectified](../../artifacts/landmark-briefs/sluyswacht/w04-44.jpg)
![w04-44 2017](../../artifacts/landmark-briefs/sluyswacht/w04-44.alt.jpg)
![w04-44 aimed](../../artifacts/landmark-briefs/sluyswacht/w04-44.thumb.jpg)

Panorama TMX7316010203-001981_pano_0000_000796 (2021-01-25), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001981_pano_0000_000796/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w04-44]`.
