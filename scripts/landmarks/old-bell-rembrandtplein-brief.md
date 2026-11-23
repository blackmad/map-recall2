# Brief: old-bell-rembrandtplein (BAG 0363100012178852)

Generated 2026-11-23 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012178852 --id=old-bell-rembrandtplein`. Crops are under
`artifacts/landmark-briefs/old-bell-rembrandtplein/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/old-bell-rembrandtplein-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012178852 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1728 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 23.4 / 23.2 / 22.9 / 1.5 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 21.38 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 2 (2 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

- **Municipal register 518404** (Rijksmonument), https://api.data.amsterdam.nl/v1/monumenten/monumenten/c86bdda9-81da-40dc-b5ef-10d9e2f56969?_format=json:
  (no description text)

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/old-bell-rembrandtplein/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-77 | E 77 | 11.6 m | b_20250120_0926_Track30_Sphere_00341 | 2025-01-20 | 13 m | 2 deg | TMX7316010203-000716_pano_0001_000026 (2018) |
| w02-348 | N 348 | 9.5 m | TMX7316010203-002537_pano_0001_000087 | 2022-04-22 | 9 m | 2 deg | recording_2025-06-19_03-28-47_01657 (2025) |

### w01-77: faces E (77 deg), 11.6 m

![w01-77 rectified](../../artifacts/landmark-briefs/old-bell-rembrandtplein/w01-77.jpg)
![w01-77 2018](../../artifacts/landmark-briefs/old-bell-rembrandtplein/w01-77.alt.jpg)
![w01-77 aimed](../../artifacts/landmark-briefs/old-bell-rembrandtplein/w01-77.thumb.jpg)

Panorama b_20250120_0926_Track30_Sphere_00341 (2025-01-20), https://api.data.amsterdam.nl/panorama/panoramas/b_20250120_0926_Track30_Sphere_00341/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-77]`.

### w02-348: faces N (348 deg), 9.5 m

![w02-348 rectified](../../artifacts/landmark-briefs/old-bell-rembrandtplein/w02-348.jpg)
![w02-348 2025](../../artifacts/landmark-briefs/old-bell-rembrandtplein/w02-348.alt.jpg)
![w02-348 aimed](../../artifacts/landmark-briefs/old-bell-rembrandtplein/w02-348.thumb.jpg)

Panorama TMX7316010203-002537_pano_0001_000087 (2022-04-22), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002537_pano_0001_000087/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-348]`.
