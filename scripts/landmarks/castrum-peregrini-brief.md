# Brief: castrum-peregrini (BAG 0363100012176539)

Generated 2026-11-23 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012176539 --id=castrum-peregrini`. Crops are under
`artifacts/landmark-briefs/castrum-peregrini/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/castrum-peregrini-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012176539 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1670 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 22.9 / 0.0 / 22.6 / 0.6 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 22 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 3 (3 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

- **Municipal register 1626** (Rijksmonument), https://api.data.amsterdam.nl/v1/monumenten/monumenten/b4b29b2f-9338-44e8-a84f-bbdb96e9800b?_format=json:
  (no description text)

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/castrum-peregrini/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-273 | W 273 | 12.9 m | TMX7316010203-000355_pano_0000_001047 | 2017-07-07 | 22 m | 5 deg | TMX7316010203-001975_pano_0000_000503 (2021) |
| w02-149 | SE 149 | 6.2 m | TMX7316010203-002306_pano_0001_001818 | 2021-09-09 | 24 m | 19 deg | TMX7316010203-003014_pano_0003_000523 (2022) |
| w03-151 | SE 151 | 5.9 m | TMX7316010203-000227_pano_0000_001864 | 2017-03-29 | 24 m | 36 deg | TMX7316010203-002306_pano_0001_001819 (2021) |

### w01-273: faces W (273 deg), 12.9 m

![w01-273 rectified](../../artifacts/landmark-briefs/castrum-peregrini/w01-273.jpg)
![w01-273 2021](../../artifacts/landmark-briefs/castrum-peregrini/w01-273.alt.jpg)
![w01-273 aimed](../../artifacts/landmark-briefs/castrum-peregrini/w01-273.thumb.jpg)

Panorama TMX7316010203-000355_pano_0000_001047 (2017-07-07), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-000355_pano_0000_001047/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-273]`.

### w02-149: faces SE (149 deg), 6.2 m

![w02-149 rectified](../../artifacts/landmark-briefs/castrum-peregrini/w02-149.jpg)
![w02-149 2022](../../artifacts/landmark-briefs/castrum-peregrini/w02-149.alt.jpg)
![w02-149 aimed](../../artifacts/landmark-briefs/castrum-peregrini/w02-149.thumb.jpg)

Panorama TMX7316010203-002306_pano_0001_001818 (2021-09-09), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002306_pano_0001_001818/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-149]`.

### w03-151: faces SE (151 deg), 5.9 m

![w03-151 rectified](../../artifacts/landmark-briefs/castrum-peregrini/w03-151.jpg)
![w03-151 2021](../../artifacts/landmark-briefs/castrum-peregrini/w03-151.alt.jpg)
![w03-151 aimed](../../artifacts/landmark-briefs/castrum-peregrini/w03-151.thumb.jpg)

Panorama TMX7316010203-000227_pano_0000_001864 (2017-03-29), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-000227_pano_0000_001864/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w03-151]`.
