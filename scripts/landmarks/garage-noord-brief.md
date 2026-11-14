# Brief: garage-noord (BAG 0363100012079768)

Generated 2026-11-14 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012079768 --id=garage-noord`. Crops are under
`artifacts/landmark-briefs/garage-noord/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/garage-noord-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012079768 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1917 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 9.1 / 9.0 / 8.3 / 1.0 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 7.32 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 3 (3 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

No municipal or national monument record links this pand (scripts/data/amsterdam-monument-register snapshot). That is not evidence of no ornament: look at the crops.

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/garage-noord/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-33 | NE 33 | 12.4 m | TMX7316060226-000022_pano_0008_004261 | 2016-08-16 | 10 m | 48 deg | - |
| w02-123 | SE 123 | 9.8 m | TMX7316010203-002572_pano_0000_001788 | 2022-05-11 | 22 m | 3 deg | recording_2025-09-04_07-46-10_00631 (2025) |
| w03-303 | NW 303 | 9.8 m | TMX7316060226-000022_pano_0008_004267 | 2016-08-16 | 22 m | 0 deg | - |

### w01-33: faces NE (33 deg), 12.4 m

![w01-33 rectified](../../artifacts/landmark-briefs/garage-noord/w01-33.jpg)
![w01-33 aimed](../../artifacts/landmark-briefs/garage-noord/w01-33.thumb.jpg)

Panorama TMX7316060226-000022_pano_0008_004261 (2016-08-16), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316060226-000022_pano_0008_004261/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-33]`.

### w02-123: faces SE (123 deg), 9.8 m

![w02-123 rectified](../../artifacts/landmark-briefs/garage-noord/w02-123.jpg)
![w02-123 2025](../../artifacts/landmark-briefs/garage-noord/w02-123.alt.jpg)
![w02-123 aimed](../../artifacts/landmark-briefs/garage-noord/w02-123.thumb.jpg)

Panorama TMX7316010203-002572_pano_0000_001788 (2022-05-11), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002572_pano_0000_001788/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-123]`.

### w03-303: faces NW (303 deg), 9.8 m

![w03-303 rectified](../../artifacts/landmark-briefs/garage-noord/w03-303.jpg)
![w03-303 aimed](../../artifacts/landmark-briefs/garage-noord/w03-303.thumb.jpg)

Panorama TMX7316060226-000022_pano_0008_004267 (2016-08-16), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316060226-000022_pano_0008_004267/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w03-303]`.
