# Brief: gebouw-parnas (BAG 0363100012110783)

Generated 2026-11-02 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012110783 --id=gebouw-parnas`. Crops are under
`artifacts/landmark-briefs/gebouw-parnas/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/gebouw-parnas-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012110783 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1967 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 60.1 / 33.1 / 32.0 / 0.5 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 20 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 14 (14 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

No municipal or national monument record links this pand (scripts/data/amsterdam-monument-register snapshot). That is not evidence of no ornament: look at the crops.

- **Pietro Locatelli**, https://nl.wikipedia.org/wiki/Pietro_Locatelli (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Pietro Antonio Locatelli (Bergamo, 3 september 1695 – Amsterdam, 30 maart 1764) was een Italiaanse componist en violist uit de barokperiode, die vanaf 1729 tot zijn dood in Amsterdam woonde. 

- **Brug 414**, https://nl.wikipedia.org/wiki/Brug_414 (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Brug 414 is een vaste brug in Amsterdam-Zuid. De brug is gelegen over het Zuider Amstelkanaal. Ze ligt zuidwaarts in het verlengde van de Achillesstraat en verbindt tevens de Stadionkade en de Locatellikade, respectievelijk noord- en zuidkade van genoemd kanaal. De brug is alleen toegankelijk voor voetgangers en voetgangers met fietsen aan de hand. Op beide landhoofden zijn trappen te vinden met wielgleuven. De plannen voor een brug hier in de omgeving maken deel uit van het Plan Zuid van Hendrik Petrus Berlage. De brug was geprojecteerd in het verlengde van de Agamemnonstraat. In 1931 was echter al besloten dat de brug voor de Achillesstraat kwam te liggen. Ze zou aangelegd worden in een pa

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/gebouw-parnas/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-87 | E 87 | 105.3 m | **none: inferred** | - | - | - | - |
| w02-267 | W 267 | 80.1 m | **none: inferred** | - | - | - | - |
| w03-357 | N 357 | 56.8 m | recording_2025-07-15_13-02-15_00901 | 2025-07-15 | 25 m | 9 deg | TMX7316010203-001163_pano_0000_003684 (2019) |
| w04-177 | S 177 | 56.5 m | recording_2025-09-29_14-53-32_02289 | 2025-09-29 | 24 m | 9 deg | recording_2024-09-02_09-15-33_01399 (2024) |
| w05-267 | W 267 | 55.5 m | recording_2024-09-02_09-15-33_00695 | 2024-09-02 | 24 m | 0 deg | TMX7316010203-001789_pano_0002_002308 (2020) |
| w06-87 | E 87 | 55.3 m | TMX7316010203-001894_pano_0000_002865 | 2020-08-27 | 23 m | 0 deg | recording_2025-09-29_14-53-32_02276 (2025) |
| w07-267 | W 267 | 37.4 m | TMX7316010203-001789_pano_0002_002296 | 2020-07-06 | 24 m | 0 deg | recording_2025-07-15_13-02-15_00890 (2025) |
| w08-87 | E 87 | 37.4 m | recording_2025-09-29_14-53-32_02288 | 2025-09-29 | 24 m | 1 deg | recording_2024-09-02_09-15-33_01398 (2024) |
| w09-357 | N 357 | 35.9 m | TMX7316010203-001894_pano_0000_002581 | 2020-08-27 | 13 m | 0 deg | TMX7316010203-001966_pano_0000_000511 (2021) |
| w10-267 | W 267 | 25 m | TMX7316010203-000255_pano_0000_003441 | 2017-04-11 | 25 m | 27 deg | TMX7316010203-001894_pano_0000_002573 (2020) |
| w11-177 | S 177 | 19.6 m | recording_2024-09-02_09-15-33_00783 | 2024-09-02 | 13 m | 13 deg | - |
| w12-177 | S 177 | 16.5 m | TMX7316010203-001894_pano_0000_002890 | 2020-08-27 | 16 m | 0 deg | recording_2025-07-29_10-56-07_01813 (2025) |
| w13-177 | S 177 | 16.2 m | TMX7316010203-001034_pano_0007_001507 | 2019-01-03 | 18 m | 1 deg | TMX7316010203-000521_pano_0000_002131 (2017) |
| w14-357 | N 357 | 16.1 m | TMX7316010203-002800_pano_0032_000047 | 2022-09-06 | 19 m | 21 deg | TMX7316060226-000013_pano_0001_000073 (2016) |

### w01-87: faces E (87 deg), 105.3 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w02-267: faces W (267 deg), 80.1 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w03-357: faces N (357 deg), 56.8 m

![w03-357 rectified](../../artifacts/landmark-briefs/gebouw-parnas/w03-357.jpg)
![w03-357 2019](../../artifacts/landmark-briefs/gebouw-parnas/w03-357.alt.jpg)
![w03-357 aimed](../../artifacts/landmark-briefs/gebouw-parnas/w03-357.thumb.jpg)

Panorama recording_2025-07-15_13-02-15_00901 (2025-07-15), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-07-15_13-02-15_00901/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w03-357]`.

### w04-177: faces S (177 deg), 56.5 m

![w04-177 rectified](../../artifacts/landmark-briefs/gebouw-parnas/w04-177.jpg)
![w04-177 2024](../../artifacts/landmark-briefs/gebouw-parnas/w04-177.alt.jpg)
![w04-177 aimed](../../artifacts/landmark-briefs/gebouw-parnas/w04-177.thumb.jpg)

Panorama recording_2025-09-29_14-53-32_02289 (2025-09-29), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-09-29_14-53-32_02289/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w04-177]`.

### w05-267: faces W (267 deg), 55.5 m

![w05-267 rectified](../../artifacts/landmark-briefs/gebouw-parnas/w05-267.jpg)
![w05-267 2020](../../artifacts/landmark-briefs/gebouw-parnas/w05-267.alt.jpg)
![w05-267 aimed](../../artifacts/landmark-briefs/gebouw-parnas/w05-267.thumb.jpg)

Panorama recording_2024-09-02_09-15-33_00695 (2024-09-02), https://api.data.amsterdam.nl/panorama/panoramas/recording_2024-09-02_09-15-33_00695/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w05-267]`.

### w06-87: faces E (87 deg), 55.3 m

![w06-87 rectified](../../artifacts/landmark-briefs/gebouw-parnas/w06-87.jpg)
![w06-87 2025](../../artifacts/landmark-briefs/gebouw-parnas/w06-87.alt.jpg)
![w06-87 aimed](../../artifacts/landmark-briefs/gebouw-parnas/w06-87.thumb.jpg)

Panorama TMX7316010203-001894_pano_0000_002865 (2020-08-27), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001894_pano_0000_002865/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w06-87]`.

### w07-267: faces W (267 deg), 37.4 m

![w07-267 rectified](../../artifacts/landmark-briefs/gebouw-parnas/w07-267.jpg)
![w07-267 2025](../../artifacts/landmark-briefs/gebouw-parnas/w07-267.alt.jpg)
![w07-267 aimed](../../artifacts/landmark-briefs/gebouw-parnas/w07-267.thumb.jpg)

Panorama TMX7316010203-001789_pano_0002_002296 (2020-07-06), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001789_pano_0002_002296/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w07-267]`.

### w08-87: faces E (87 deg), 37.4 m

![w08-87 rectified](../../artifacts/landmark-briefs/gebouw-parnas/w08-87.jpg)
![w08-87 2024](../../artifacts/landmark-briefs/gebouw-parnas/w08-87.alt.jpg)
![w08-87 aimed](../../artifacts/landmark-briefs/gebouw-parnas/w08-87.thumb.jpg)

Panorama recording_2025-09-29_14-53-32_02288 (2025-09-29), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-09-29_14-53-32_02288/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w08-87]`.

### w09-357: faces N (357 deg), 35.9 m

![w09-357 rectified](../../artifacts/landmark-briefs/gebouw-parnas/w09-357.jpg)
![w09-357 2021](../../artifacts/landmark-briefs/gebouw-parnas/w09-357.alt.jpg)
![w09-357 aimed](../../artifacts/landmark-briefs/gebouw-parnas/w09-357.thumb.jpg)

Panorama TMX7316010203-001894_pano_0000_002581 (2020-08-27), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001894_pano_0000_002581/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w09-357]`.

### w10-267: faces W (267 deg), 25 m

![w10-267 rectified](../../artifacts/landmark-briefs/gebouw-parnas/w10-267.jpg)
![w10-267 2020](../../artifacts/landmark-briefs/gebouw-parnas/w10-267.alt.jpg)
![w10-267 aimed](../../artifacts/landmark-briefs/gebouw-parnas/w10-267.thumb.jpg)

Panorama TMX7316010203-000255_pano_0000_003441 (2017-04-11), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-000255_pano_0000_003441/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w10-267]`.

### w11-177: faces S (177 deg), 19.6 m

![w11-177 rectified](../../artifacts/landmark-briefs/gebouw-parnas/w11-177.jpg)
![w11-177 aimed](../../artifacts/landmark-briefs/gebouw-parnas/w11-177.thumb.jpg)

Panorama recording_2024-09-02_09-15-33_00783 (2024-09-02), https://api.data.amsterdam.nl/panorama/panoramas/recording_2024-09-02_09-15-33_00783/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w11-177]`.

### w12-177: faces S (177 deg), 16.5 m

![w12-177 rectified](../../artifacts/landmark-briefs/gebouw-parnas/w12-177.jpg)
![w12-177 2025](../../artifacts/landmark-briefs/gebouw-parnas/w12-177.alt.jpg)
![w12-177 aimed](../../artifacts/landmark-briefs/gebouw-parnas/w12-177.thumb.jpg)

Panorama TMX7316010203-001894_pano_0000_002890 (2020-08-27), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001894_pano_0000_002890/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w12-177]`.

### w13-177: faces S (177 deg), 16.2 m

![w13-177 rectified](../../artifacts/landmark-briefs/gebouw-parnas/w13-177.jpg)
![w13-177 2017](../../artifacts/landmark-briefs/gebouw-parnas/w13-177.alt.jpg)
![w13-177 aimed](../../artifacts/landmark-briefs/gebouw-parnas/w13-177.thumb.jpg)

Panorama TMX7316010203-001034_pano_0007_001507 (2019-01-03), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001034_pano_0007_001507/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w13-177]`.

### w14-357: faces N (357 deg), 16.1 m

![w14-357 rectified](../../artifacts/landmark-briefs/gebouw-parnas/w14-357.jpg)
![w14-357 2016](../../artifacts/landmark-briefs/gebouw-parnas/w14-357.alt.jpg)
![w14-357 aimed](../../artifacts/landmark-briefs/gebouw-parnas/w14-357.thumb.jpg)

Panorama TMX7316010203-002800_pano_0032_000047 (2022-09-06), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002800_pano_0032_000047/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w14-357]`.
