# Brief: muntplein-1 (BAG 0363100012179461)

Generated 2026-11-23 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012179461 --id=muntplein-1`. Crops are under
`artifacts/landmark-briefs/muntplein-1/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/muntplein-1-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012179461 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1892 | BAG |
| BAG status / storeys | Pand in gebruik / 4 | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 18.5 / 16.6 / 18.3 / 1.7 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 16.59 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 2 (2 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

- **Municipal register 518344** (Rijksmonument), https://api.data.amsterdam.nl/v1/monumenten/monumenten/b1f6c984-dab6-4f50-b55d-012b0cedd8aa?_format=json:
  (no description text)

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/muntplein-1/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-16 | N 16 | 9.3 m | b_20241211_0954_Track19_Sphere_00246 | 2024-12-11 | 12 m | 2 deg | TMX7316010203-002543_pano_0000_000105 (2022) |
| w02-305 | NW 305 | 5 m | recording_2025-06-19_03-28-47_01473 | 2025-06-19 | 22 m | 1 deg | TMX7316010203-002310_pano_0001_000397 (2021) |

### w01-16: faces N (16 deg), 9.3 m

![w01-16 rectified](../../artifacts/landmark-briefs/muntplein-1/w01-16.jpg)
![w01-16 2022](../../artifacts/landmark-briefs/muntplein-1/w01-16.alt.jpg)
![w01-16 aimed](../../artifacts/landmark-briefs/muntplein-1/w01-16.thumb.jpg)

Panorama b_20241211_0954_Track19_Sphere_00246 (2024-12-11), https://api.data.amsterdam.nl/panorama/panoramas/b_20241211_0954_Track19_Sphere_00246/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-16]`.

### w02-305: faces NW (305 deg), 5 m

![w02-305 rectified](../../artifacts/landmark-briefs/muntplein-1/w02-305.jpg)
![w02-305 2021](../../artifacts/landmark-briefs/muntplein-1/w02-305.alt.jpg)
![w02-305 aimed](../../artifacts/landmark-briefs/muntplein-1/w02-305.thumb.jpg)

Panorama recording_2025-06-19_03-28-47_01473 (2025-06-19), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-06-19_03-28-47_01473/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-305]`.
