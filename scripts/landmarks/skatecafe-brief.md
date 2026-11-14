# Brief: skatecafe (BAG 0363100012122913)

Generated 2026-11-14 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012122913 --id=skatecafe`. Crops are under
`artifacts/landmark-briefs/skatecafe/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/skatecafe-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012122913 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1917 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 9.7 / 9.7 / 8.7 / 0.9 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 7.81 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 2 (2 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

No municipal or national monument record links this pand (scripts/data/amsterdam-monument-register snapshot). That is not evidence of no ornament: look at the crops.

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/skatecafe/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-123 | SE 123 | 40.5 m | TMX7316010203-000297_pano_0000_000306 | 2017-05-15 | 22 m | 2 deg | TMX7316010203-002572_pano_0000_001793 (2022) |
| w02-303 | NW 303 | 18.5 m | TMX7316060226-000022_pano_0008_004267 | 2016-08-16 | 26 m | 33 deg | - |

### w01-123: faces SE (123 deg), 40.5 m

![w01-123 rectified](../../artifacts/landmark-briefs/skatecafe/w01-123.jpg)
![w01-123 2022](../../artifacts/landmark-briefs/skatecafe/w01-123.alt.jpg)
![w01-123 aimed](../../artifacts/landmark-briefs/skatecafe/w01-123.thumb.jpg)

Panorama TMX7316010203-000297_pano_0000_000306 (2017-05-15), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-000297_pano_0000_000306/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-123]`.

### w02-303: faces NW (303 deg), 18.5 m

![w02-303 rectified](../../artifacts/landmark-briefs/skatecafe/w02-303.jpg)
![w02-303 aimed](../../artifacts/landmark-briefs/skatecafe/w02-303.thumb.jpg)

Panorama TMX7316060226-000022_pano_0008_004267 (2016-08-16), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316060226-000022_pano_0008_004267/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-303]`.
