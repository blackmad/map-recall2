# Brief: backstage-hotel (BAG 0363100012169868)

Generated 2026-11-23 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012169868 --id=backstage-hotel`. Crops are under
`artifacts/landmark-briefs/backstage-hotel/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/backstage-hotel-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012169868 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1882 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 20.8 / 19.4 / 20.5 / 2.0 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 18.57 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 2 (2 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

No municipal or national monument record links this pand (scripts/data/amsterdam-monument-register snapshot). That is not evidence of no ornament: look at the crops.

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/backstage-hotel/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-255 | W 255 | 13.6 m | TMX7316010203-002369_pano_0003_000000 | 2021-12-30 | 12 m | 1 deg | TMX7316010203-000705_pano_0001_000868 (2018) |
| w02-151 | SE 151 | 4.9 m | TMX7316010203-000355_pano_0000_000105 | 2017-07-07 | 18 m | 2 deg | TMX7316010203-001974_pano_0000_000976 (2021) |

### w01-255: faces W (255 deg), 13.6 m

![w01-255 rectified](../../artifacts/landmark-briefs/backstage-hotel/w01-255.jpg)
![w01-255 2018](../../artifacts/landmark-briefs/backstage-hotel/w01-255.alt.jpg)
![w01-255 aimed](../../artifacts/landmark-briefs/backstage-hotel/w01-255.thumb.jpg)

Panorama TMX7316010203-002369_pano_0003_000000 (2021-12-30), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002369_pano_0003_000000/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-255]`.

### w02-151: faces SE (151 deg), 4.9 m

![w02-151 rectified](../../artifacts/landmark-briefs/backstage-hotel/w02-151.jpg)
![w02-151 2021](../../artifacts/landmark-briefs/backstage-hotel/w02-151.alt.jpg)
![w02-151 aimed](../../artifacts/landmark-briefs/backstage-hotel/w02-151.thumb.jpg)

Panorama TMX7316010203-000355_pano_0000_000105 (2017-07-07), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-000355_pano_0000_000105/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-151]`.
