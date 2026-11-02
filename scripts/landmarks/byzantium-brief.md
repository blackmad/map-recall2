# Brief: byzantium (BAG 0363100012135250)

Generated 2026-11-02 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012135250 --id=byzantium`. Crops are under
`artifacts/landmark-briefs/byzantium/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/byzantium-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012135250 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1991 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 26.3 / 17.2 / 20.2 / -1.0 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 21.29 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 8 (7 >= 4 m in this brief, 1 shorter/extra not shown) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

No municipal or national monument record links this pand (scripts/data/amsterdam-monument-register snapshot). That is not evidence of no ornament: look at the crops.

- **Byzantium (gebouw)**, https://nl.wikipedia.org/wiki/Byzantium_(gebouw) (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Het Byzantium is een complex dat staat aan de Stadhouderskade in Amsterdam-West. Het gebouw staande in het Museumkwartier wordt ingesloten door het Vondelpark, de Stadhouderskade en de Tesselschadestraat. Het complex was tijdens de oplevering een van de grootste gebouwen in de stad, zeker in de buurt waar het werd gebouwd. Het was tevens de afsluiting van de vernieuwing van dit deel van de Stadhouderskade, er was na 1991 geen “oudbouw” meer in de lage huisnummers te vinden. Rem Koolhaas was de architect namens het Office for Metropolitan Architecture (OMA) die het ontwerp maakte en hij liet de verdere uitvoering aan collegae Kees Christiaanse en Ron Steiner. Zij wonnen daarmee een soort weds

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/byzantium/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-156 | SE 156 | 64 m | TMX7316010203-001702_pano_0000_009899 | 2020-05-11 | 6 m | 41 deg | - |
| w02-246 | SW 246 | 42.6 m | TMX7316060226-000022_pano_0006_001298 | 2016-08-16 | 35 m | 44 deg | - |
| w03-156 | SE 156 | 17.2 m | TMX7316060226-000022_pano_0006_001277 | 2016-08-16 | 9 m | 36 deg | TMX7316010203-001702_pano_0000_009907 (2020) |
| w04-157 | SE 157 | 12.4 m | TMX7316010203-002463_pano_0000_000080 | 2022-03-22 | 8 m | 24 deg | TMX7316010203-001156_pano_0000_001502 (2019) |
| w05-67 | NE 67 | 9.3 m | b_20241211_0838_Track05_Sphere_00014 | 2024-12-11 | 22 m | 44 deg | TMX7316060226-000022_pano_0006_001005 (2016) |
| w06-336 | NW 336 | 9.1 m | TMX7316010203-002619_pano_0017_000161 | 2022-06-22 | 17 m | 2 deg | TMX7316010203-002059_pano_0000_003250 (2021) |
| w07-336 | NW 336 | 8 m | recording_2025-07-31_08-46-40_00495 | 2025-07-31 | 14 m | 1 deg | TMX7316010203-002059_pano_0000_003248 (2021) |

### w01-156: faces SE (156 deg), 64 m

![w01-156 rectified](../../artifacts/landmark-briefs/byzantium/w01-156.jpg)
![w01-156 aimed](../../artifacts/landmark-briefs/byzantium/w01-156.thumb.jpg)

Panorama TMX7316010203-001702_pano_0000_009899 (2020-05-11), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001702_pano_0000_009899/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-156]`.

### w02-246: faces SW (246 deg), 42.6 m

![w02-246 rectified](../../artifacts/landmark-briefs/byzantium/w02-246.jpg)
![w02-246 aimed](../../artifacts/landmark-briefs/byzantium/w02-246.thumb.jpg)

Panorama TMX7316060226-000022_pano_0006_001298 (2016-08-16), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316060226-000022_pano_0006_001298/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-246]`.

### w03-156: faces SE (156 deg), 17.2 m

![w03-156 rectified](../../artifacts/landmark-briefs/byzantium/w03-156.jpg)
![w03-156 2020](../../artifacts/landmark-briefs/byzantium/w03-156.alt.jpg)
![w03-156 aimed](../../artifacts/landmark-briefs/byzantium/w03-156.thumb.jpg)

Panorama TMX7316060226-000022_pano_0006_001277 (2016-08-16), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316060226-000022_pano_0006_001277/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w03-156]`.

### w04-157: faces SE (157 deg), 12.4 m

![w04-157 rectified](../../artifacts/landmark-briefs/byzantium/w04-157.jpg)
![w04-157 2019](../../artifacts/landmark-briefs/byzantium/w04-157.alt.jpg)
![w04-157 aimed](../../artifacts/landmark-briefs/byzantium/w04-157.thumb.jpg)

Panorama TMX7316010203-002463_pano_0000_000080 (2022-03-22), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002463_pano_0000_000080/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w04-157]`.

### w05-67: faces NE (67 deg), 9.3 m

![w05-67 rectified](../../artifacts/landmark-briefs/byzantium/w05-67.jpg)
![w05-67 2016](../../artifacts/landmark-briefs/byzantium/w05-67.alt.jpg)
![w05-67 aimed](../../artifacts/landmark-briefs/byzantium/w05-67.thumb.jpg)

Panorama b_20241211_0838_Track05_Sphere_00014 (2024-12-11), https://api.data.amsterdam.nl/panorama/panoramas/b_20241211_0838_Track05_Sphere_00014/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w05-67]`.

### w06-336: faces NW (336 deg), 9.1 m

![w06-336 rectified](../../artifacts/landmark-briefs/byzantium/w06-336.jpg)
![w06-336 2021](../../artifacts/landmark-briefs/byzantium/w06-336.alt.jpg)
![w06-336 aimed](../../artifacts/landmark-briefs/byzantium/w06-336.thumb.jpg)

Panorama TMX7316010203-002619_pano_0017_000161 (2022-06-22), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002619_pano_0017_000161/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w06-336]`.

### w07-336: faces NW (336 deg), 8 m

![w07-336 rectified](../../artifacts/landmark-briefs/byzantium/w07-336.jpg)
![w07-336 2021](../../artifacts/landmark-briefs/byzantium/w07-336.alt.jpg)
![w07-336 aimed](../../artifacts/landmark-briefs/byzantium/w07-336.thumb.jpg)

Panorama recording_2025-07-31_08-46-40_00495 (2025-07-31), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-07-31_08-46-40_00495/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w07-336]`.
