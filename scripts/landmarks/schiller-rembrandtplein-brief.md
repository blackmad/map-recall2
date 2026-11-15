# Brief: schiller-rembrandtplein (BAG 0363100012178854)

Generated 2026-11-15 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012178854 --id=schiller-rembrandtplein`. Crops are under
`artifacts/landmark-briefs/schiller-rembrandtplein/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/schiller-rembrandtplein-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012178854 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1675 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 29.3 / 25.5 / 25.8 / 0.9 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 24.97 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 6 (5 >= 4 m in this brief, 1 shorter/extra not shown) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

No municipal or national monument record links this pand (scripts/data/amsterdam-monument-register snapshot). That is not evidence of no ornament: look at the crops.

- **Schiller (café)**, https://nl.wikipedia.org/wiki/Schiller_(caf%C3%A9) (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Schiller is een café aan het Rembrandtplein in Amsterdam. Het werd vlak na 1920 geopend als hotelbar van het naastgelegen Schiller hotel. 

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/schiller-rembrandtplein/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-348 | N 348 | 32.5 m | TMX7316010203-001900_pano_0005_000734 | 2020-08-31 | 12 m | 1 deg | b_20241203_1333_Track15_Sphere_00354 (2024) |
| w02-163 | S 163 | 21.6 m | **none: inferred** | - | - | - | - |
| w03-164 | S 164 | 12 m | **none: inferred** | - | - | - | - |
| w04-253 | W 253 | 11 m | TMX7316010203-002824_pano_0018_000029 | 2022-10-07 | 34 m | 1 deg | b_20250131_0919_Track03_Sphere_00009 (2024) |
| w05-164 | S 164 | 6.3 m | **none: inferred** | - | - | - | - |

### w01-348: faces N (348 deg), 32.5 m

![w01-348 rectified](../../artifacts/landmark-briefs/schiller-rembrandtplein/w01-348.jpg)
![w01-348 2024](../../artifacts/landmark-briefs/schiller-rembrandtplein/w01-348.alt.jpg)
![w01-348 aimed](../../artifacts/landmark-briefs/schiller-rembrandtplein/w01-348.thumb.jpg)

Panorama TMX7316010203-001900_pano_0005_000734 (2020-08-31), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001900_pano_0005_000734/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-348]`.

### w02-163: faces S (163 deg), 21.6 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w03-164: faces S (164 deg), 12 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w04-253: faces W (253 deg), 11 m

![w04-253 rectified](../../artifacts/landmark-briefs/schiller-rembrandtplein/w04-253.jpg)
![w04-253 2024](../../artifacts/landmark-briefs/schiller-rembrandtplein/w04-253.alt.jpg)
![w04-253 aimed](../../artifacts/landmark-briefs/schiller-rembrandtplein/w04-253.thumb.jpg)

Panorama TMX7316010203-002824_pano_0018_000029 (2022-10-07), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002824_pano_0018_000029/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w04-253]`.

### w05-164: faces S (164 deg), 6.3 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.
