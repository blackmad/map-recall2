# Brief: xavier-zuidas (BAG 0363100012246555)

Generated 2026-11-06 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012246555 --id=xavier-zuidas`. Crops are under
`artifacts/landmark-briefs/xavier-zuidas/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/xavier-zuidas-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012246555 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 2019 | BAG |
| BAG status / storeys | Pand in gebruik / 22 | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 74.9 / 75.9 / 73.6 / -0.7 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 74.28 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 9 (3 >= 4 m in this brief, 6 shorter/extra not shown) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

No municipal or national monument record links this pand (scripts/data/amsterdam-monument-register snapshot). That is not evidence of no ornament: look at the crops.

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/xavier-zuidas/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-270 | W 270 | 24.4 m | TMX7316010203-002486_pano_0002_000103 | 2022-03-29 | 35 m | 41 deg | - |
| w02-180 | S 180 | 16.6 m | **none: inferred** | - | - | - | - |
| w03-270 | W 270 | 7.9 m | recording_2025-07-29_09-16-01_01094 | 2025-07-29 | 9 m | 2 deg | TMX7316010203-000521_pano_0000_000380 (2017) |

### w01-270: faces W (270 deg), 24.4 m

![w01-270 rectified](../../artifacts/landmark-briefs/xavier-zuidas/w01-270.jpg)
![w01-270 aimed](../../artifacts/landmark-briefs/xavier-zuidas/w01-270.thumb.jpg)

Panorama TMX7316010203-002486_pano_0002_000103 (2022-03-29), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002486_pano_0002_000103/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-270]`.

### w02-180: faces S (180 deg), 16.6 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w03-270: faces W (270 deg), 7.9 m

![w03-270 rectified](../../artifacts/landmark-briefs/xavier-zuidas/w03-270.jpg)
![w03-270 2017](../../artifacts/landmark-briefs/xavier-zuidas/w03-270.alt.jpg)
![w03-270 aimed](../../artifacts/landmark-briefs/xavier-zuidas/w03-270.thumb.jpg)

Panorama recording_2025-07-29_09-16-01_01094 (2025-07-29), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-07-29_09-16-01_01094/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w03-270]`.
