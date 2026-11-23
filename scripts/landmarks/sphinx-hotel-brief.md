# Brief: sphinx-hotel (BAG 0363100012179513)

Generated 2026-11-23 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012179513 --id=sphinx-hotel`. Crops are under
`artifacts/landmark-briefs/sphinx-hotel/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/sphinx-hotel-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012179513 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1922 | BAG |
| BAG status / storeys | Verbouwing pand / 7 | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 21.7 / 21.4 / 19.6 / 0.4 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 19.2 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 3 (3 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

No municipal or national monument record links this pand (scripts/data/amsterdam-monument-register snapshot). That is not evidence of no ornament: look at the crops.

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/sphinx-hotel/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-96 | E 96 | 13.6 m | b_20241211_0954_Track10_Sphere_00077 | 2024-12-11 | 21 m | 32 deg | TMX7316010203-002857_pano_0008_000057 (2022) |
| w02-186 | S 186 | 12.3 m | **none: inferred** | - | - | - | - |
| w03-6 | N 6 | 12.3 m | TMX7316010203-001048_pano_0000_000480 | 2019-01-11 | 12 m | 0 deg | recording_2025-07-14_07-34-51_00639 (2025) |

### w01-96: faces E (96 deg), 13.6 m

![w01-96 rectified](../../artifacts/landmark-briefs/sphinx-hotel/w01-96.jpg)
![w01-96 2022](../../artifacts/landmark-briefs/sphinx-hotel/w01-96.alt.jpg)
![w01-96 aimed](../../artifacts/landmark-briefs/sphinx-hotel/w01-96.thumb.jpg)

Panorama b_20241211_0954_Track10_Sphere_00077 (2024-12-11), https://api.data.amsterdam.nl/panorama/panoramas/b_20241211_0954_Track10_Sphere_00077/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-96]`.

### w02-186: faces S (186 deg), 12.3 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w03-6: faces N (6 deg), 12.3 m

![w03-6 rectified](../../artifacts/landmark-briefs/sphinx-hotel/w03-6.jpg)
![w03-6 2025](../../artifacts/landmark-briefs/sphinx-hotel/w03-6.alt.jpg)
![w03-6 aimed](../../artifacts/landmark-briefs/sphinx-hotel/w03-6.thumb.jpg)

Panorama TMX7316010203-001048_pano_0000_000480 (2019-01-11), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001048_pano_0000_000480/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w03-6]`.
