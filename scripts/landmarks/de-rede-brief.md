# Brief: de-rede (BAG 0363100012243292)

Generated 2026-11-14 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012243292 --id=de-rede`. Crops are under
`artifacts/landmark-briefs/de-rede/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/de-rede-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012243292 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 2015 | BAG |
| BAG status / storeys | Pand in gebruik / 8 | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 31.4 / 31.5 / 30.1 / 0.7 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 29.38 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 3 (3 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

No municipal or national monument record links this pand (scripts/data/amsterdam-monument-register snapshot). That is not evidence of no ornament: look at the crops.

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/de-rede/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-320 | NW 320 | 12.9 m | recording_2024-10-09_07-28-34_00521 | 2024-10-09 | 15 m | 0 deg | 2025_09_29_07_54_42_00168 (2025) |
| w02-140 | SE 140 | 9.5 m | TMX7316010203-000277_pano_0001_001606 | 2017-04-24 | 8 m | 14 deg | TMX7316010203-002497_pano_0006_000738 (2022) |
| w03-230 | SW 230 | 4.2 m | 2025_09_29_07_20_07_00904 | 2025-09-29 | 23 m | 22 deg | recording_2024-10-09_07-48-40_00124 (2024) |

### w01-320: faces NW (320 deg), 12.9 m

![w01-320 rectified](../../artifacts/landmark-briefs/de-rede/w01-320.jpg)
![w01-320 2025](../../artifacts/landmark-briefs/de-rede/w01-320.alt.jpg)
![w01-320 aimed](../../artifacts/landmark-briefs/de-rede/w01-320.thumb.jpg)

Panorama recording_2024-10-09_07-28-34_00521 (2024-10-09), https://api.data.amsterdam.nl/panorama/panoramas/recording_2024-10-09_07-28-34_00521/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-320]`.

### w02-140: faces SE (140 deg), 9.5 m

![w02-140 rectified](../../artifacts/landmark-briefs/de-rede/w02-140.jpg)
![w02-140 2022](../../artifacts/landmark-briefs/de-rede/w02-140.alt.jpg)
![w02-140 aimed](../../artifacts/landmark-briefs/de-rede/w02-140.thumb.jpg)

Panorama TMX7316010203-000277_pano_0001_001606 (2017-04-24), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-000277_pano_0001_001606/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-140]`.

### w03-230: faces SW (230 deg), 4.2 m

![w03-230 rectified](../../artifacts/landmark-briefs/de-rede/w03-230.jpg)
![w03-230 2024](../../artifacts/landmark-briefs/de-rede/w03-230.alt.jpg)
![w03-230 aimed](../../artifacts/landmark-briefs/de-rede/w03-230.thumb.jpg)

Panorama 2025_09_29_07_20_07_00904 (2025-09-29), https://api.data.amsterdam.nl/panorama/panoramas/2025_09_29_07_20_07_00904/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w03-230]`.
