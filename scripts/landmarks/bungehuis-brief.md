# Brief: bungehuis (BAG 0363100012167624)

Generated 2026-11-01 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012167624 --id=bungehuis`. Crops are under
`artifacts/landmark-briefs/bungehuis/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/bungehuis-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012167624 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1934 | BAG |
| BAG status / storeys | Pand in gebruik / 9 | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 33.9 / 31.2 / 28.8 / 0.5 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 28.28 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 9 (7 >= 4 m in this brief, 2 shorter/extra not shown) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

- **Municipal register 518486** (Rijksmonument), https://api.data.amsterdam.nl/v1/monumenten/monumenten/5bcac879-fb19-4d34-b72a-e94394f95072?_format=json:
  (no description text)

- **Bungehuis**, https://nl.wikipedia.org/wiki/Bungehuis (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Het Bungehuis is een monumentaal kantoorpand aan de Spuistraat, dat dateert uit 1934. Het pand was lange tijd in gebruik bij de Universiteit van Amsterdam die er verschillende onderdelen van de faculteit Geesteswetenschappen had ondergebracht. 

- **Spuistraat (Amsterdam)**, https://nl.wikipedia.org/wiki/Spuistraat_(Amsterdam) (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > De Spuistraat in het centrum van Amsterdam verbindt het Hekelveld met het Spui. De straat loopt in min of meer in noord-zuidelijke richting, evenwijdig aan de Singel en de Nieuwezijds Voorburgwal. Bij het Paleis op de Dam wordt de Spuistraat gekruist door de Raadhuisstraat en Paleisstraat. De Spuistraat was oorspronkelijk een gracht, de Nieuwezijds Achterburgwal. Na de demping in 1867 werd de naam gewijzigd in Spuistraat. De straat maakt deel uit van de "stadshartlus" waarmee doorgaand autoverkeer door de binnenstad wordt geleid. Pogingen van bewoners om de route te verplaatsen naar de bredere Nieuwezijds Voorburgwal hebben geen succes gehad. 

- **Spuistraat**, https://en.wikipedia.org/wiki/Spuistraat (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > The Spuistraat in downtown Amsterdam connects the Hekelveld to the Spui. It runs roughly north to south, parallel to the Singel and the Nieuwezijds Voorburgwal. At the Royal Palace of Amsterdam, the Spuistraat crosses the Raadhuisstraat and Paleisstraat. Originally the Spuistraat was a canal, the Nieuwezijds Achterburgwal. The canal was filled up in 1867, and the street was then renamed. 

- **Oudezijds Achterburgwal**, https://en.wikipedia.org/wiki/Oudezijds_Achterburgwal (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > The Oudezijds Achterburgwal, often abbreviated to OZ Achterburgwal, is a street and canal in De Wallen, the red light district in the center of Amsterdam. 

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/bungehuis/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-278 | W 278 | 39.3 m | TMX7316010203-002961_pano_0014_000016 | 2023-02-06 | 8 m | 10 deg | TMX7316010203-001666_pano_0000_003864 (2020) |
| w02-351 | N 351 | 28.4 m | TMX7316010203-001178_pano_0000_001099 | 2019-05-13 | 23 m | 13 deg | TMX7316010203-003004_pano_0009_000152 (2022) |
| w03-96 | E 96 | 19.9 m | b_20250109_1300_Track05_Sphere_00165 | 2025-01-09 | 10 m | 1 deg | recording_2025-06-16_04-42-37_01279 (2025) |
| w04-96 | E 96 | 13.7 m | TMX7316010203-001544_pano_0001_000524 | 2020-01-08 | 11 m | 0 deg | TMX7316010203-003046_pano_0000_000330 (2022) |
| w05-261 | W 261 | 7.9 m | TMX7316010203-003004_pano_0009_000003 | 2023-03-20 | 14 m | 2 deg | recording_2025-06-16_04-42-37_01441 (2025) |
| w06-96 | E 96 | 5.3 m | b_20250109_1300_Track05_Sphere_00168 | 2025-01-09 | 10 m | 1 deg | TMX7316010203-002537_pano_0001_001345 (2022) |
| w07-277 | W 277 | 5 m | TMX7316010203-003004_pano_0009_000001 | 2023-03-20 | 12 m | 4 deg | recording_2025-06-16_04-42-37_01444 (2025) |

### w01-278: faces W (278 deg), 39.3 m

![w01-278 rectified](../../artifacts/landmark-briefs/bungehuis/w01-278.jpg)
![w01-278 2020](../../artifacts/landmark-briefs/bungehuis/w01-278.alt.jpg)
![w01-278 aimed](../../artifacts/landmark-briefs/bungehuis/w01-278.thumb.jpg)

Panorama TMX7316010203-002961_pano_0014_000016 (2023-02-06), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002961_pano_0014_000016/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-278]`.

### w02-351: faces N (351 deg), 28.4 m

![w02-351 rectified](../../artifacts/landmark-briefs/bungehuis/w02-351.jpg)
![w02-351 2022](../../artifacts/landmark-briefs/bungehuis/w02-351.alt.jpg)
![w02-351 aimed](../../artifacts/landmark-briefs/bungehuis/w02-351.thumb.jpg)

Panorama TMX7316010203-001178_pano_0000_001099 (2019-05-13), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001178_pano_0000_001099/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-351]`.

### w03-96: faces E (96 deg), 19.9 m

![w03-96 rectified](../../artifacts/landmark-briefs/bungehuis/w03-96.jpg)
![w03-96 2025](../../artifacts/landmark-briefs/bungehuis/w03-96.alt.jpg)
![w03-96 aimed](../../artifacts/landmark-briefs/bungehuis/w03-96.thumb.jpg)

Panorama b_20250109_1300_Track05_Sphere_00165 (2025-01-09), https://api.data.amsterdam.nl/panorama/panoramas/b_20250109_1300_Track05_Sphere_00165/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w03-96]`.

### w04-96: faces E (96 deg), 13.7 m

![w04-96 rectified](../../artifacts/landmark-briefs/bungehuis/w04-96.jpg)
![w04-96 aimed](../../artifacts/landmark-briefs/bungehuis/w04-96.thumb.jpg)

Panorama TMX7316010203-001544_pano_0001_000524 (2020-01-08), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001544_pano_0001_000524/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w04-96]`.

### w05-261: faces W (261 deg), 7.9 m

![w05-261 rectified](../../artifacts/landmark-briefs/bungehuis/w05-261.jpg)
![w05-261 2025](../../artifacts/landmark-briefs/bungehuis/w05-261.alt.jpg)
![w05-261 aimed](../../artifacts/landmark-briefs/bungehuis/w05-261.thumb.jpg)

Panorama TMX7316010203-003004_pano_0009_000003 (2023-03-20), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-003004_pano_0009_000003/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w05-261]`.

### w06-96: faces E (96 deg), 5.3 m

![w06-96 rectified](../../artifacts/landmark-briefs/bungehuis/w06-96.jpg)
![w06-96 2022](../../artifacts/landmark-briefs/bungehuis/w06-96.alt.jpg)
![w06-96 aimed](../../artifacts/landmark-briefs/bungehuis/w06-96.thumb.jpg)

Panorama b_20250109_1300_Track05_Sphere_00168 (2025-01-09), https://api.data.amsterdam.nl/panorama/panoramas/b_20250109_1300_Track05_Sphere_00168/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w06-96]`.

### w07-277: faces W (277 deg), 5 m

![w07-277 rectified](../../artifacts/landmark-briefs/bungehuis/w07-277.jpg)
![w07-277 2025](../../artifacts/landmark-briefs/bungehuis/w07-277.alt.jpg)
![w07-277 aimed](../../artifacts/landmark-briefs/bungehuis/w07-277.thumb.jpg)

Panorama TMX7316010203-003004_pano_0009_000001 (2023-03-20), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-003004_pano_0009_000001/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w07-277]`.
