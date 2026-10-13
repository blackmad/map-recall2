# Brief: American Hotel (BAG 0363100012168734)

Generated 2026-10-13 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012168734 --id=american-hotel`. Crops are under
`artifacts/landmark-briefs/american-hotel/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/american-hotel-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012168734 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1900 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 31.3 / 40.2 / 27.8 / 0.8 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 39.41 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 9 (8 >= 4 m in this brief, 1 shorter/extra not shown) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

No municipal or national monument record links this pand (scripts/data/amsterdam-monument-register snapshot). That is not evidence of no ornament: look at the crops.

- **American Hotel, Amsterdam**, https://en.wikipedia.org/wiki/American_Hotel%2C_Amsterdam (CC BY-SA 4.0). Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > The Clayton Hotel Amsterdam American, known for its Café Américain, on Leidseplein in Amsterdam, Netherlands, is a hotel and café restaurant with a Jugendstil reading room. 

- **American Hotel**, https://nl.wikipedia.org/wiki/American_Hotel (CC BY-SA 4.0). Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Het American Hotel (voluit Clayton Hotel Amsterdam American) is een hotel aan het Leidseplein 28 in Amsterdam. Het hotel is gelegen naast de Stadsschouwburg. In het hotel met zijn beroemde Café Américain bevindt zich de oudste leestafel van Amsterdam. Het hotel wordt door de Amsterdammers vaak simpelweg het Americain genoemd. 

- **Willem Kromhout**, https://nl.wikipedia.org/wiki/Willem_Kromhout (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Willem Kromhout (Rotterdam, 10 mei 1864 – Voorburg, 21 juni 1940) was een Nederlands architect. 

- **Leidsekade (Amsterdam)**, https://nl.wikipedia.org/wiki/Leidsekade_(Amsterdam) (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > De Leidsekade is een straat in het centrum van Amsterdam. Net als het nabijgelegen Leidseplein is het vernoemd naar de Leidsepoort, waar de weg naar Leiden begon. De kade slingert langs de noordoostelijke oever van de Singelgracht, tegenover de Nassaukade en Stadhouderskade. Het wordt door de Leidsegracht opgedeeld in een noordelijk en zuidelijk deel die niet direct met elkaar verbonden zijn. Het noordelijk deel loopt van de Koekjesbrug en Nieuwe Passeerdersstraat naar de Marnixstraat. Het zuidelijk deel, aan de overkant van de Leidsegracht, loopt van de Marnixstraat naar Holland Casino bij de Hirschpassage en het Max Euweplein. De huisnummers beginnen nabij de Nieuwe Passeerdersstraat en ei

- **Lijst van gemeentelijke monumenten in Amsterdam-Centrum**, https://nl.wikipedia.org/wiki/Lijst_van_gemeentelijke_monumenten_in_Amsterdam-Centrum (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Het stadsdeel Amsterdam-Centrum telde in het jaar 2000 een aantal van 945 gemeentelijke monumenten, waarvan hieronder een overzicht. 

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/american-hotel/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-143 | SE 143 | 35.6 m | TMX7316010203-001178_pano_0001_003767 | 2019-05-13 | 35 m | 1 deg | b_20241217_0841_Track38_Sphere_00010 (2024) |
| w02-53 | NE 53 | 19 m | TMX7316010203-002857_pano_0006_000019 | 2022-12-14 | 12 m | 0 deg | TMX7316010203-000714_pano_0001_004719 (2018) |
| w03-220 | SW 220 | 17.6 m | TMX7316010203-002979_pano_0000_000041 | 2023-02-20 | 8 m | 26 deg | TMX7316010203-001542_pano_0000_000169 (2019) |
| w04-53 | NE 53 | 12.2 m | b_20241211_0954_Track09_Sphere_00111 | 2024-12-11 | 14 m | 3 deg | TMX7316010203-000076_pano_0000_006441 (2016) |
| w05-227 | SW 227 | 9.8 m | TMX7316010203-000355_pano_0000_000079 | 2017-07-07 | 24 m | 1 deg | TMX7316010203-002979_pano_0000_000043 (2022) |
| w06-234 | SW 234 | 6.8 m | TMX7316010203-000199_pano_0002_000291 | 2017-03-10 | 24 m | 5 deg | TMX7316010203-002979_pano_0000_000044 (2022) |
| w07-53 | NE 53 | 5.7 m | TMX7316010203-002996_pano_0003_000116 | 2023-03-13 | 9 m | 1 deg | TMX7316010203-000703_pano_0000_007660 (2018) |
| w08-233 | SW 233 | 5.5 m | TMX7316010203-002951_pano_0004_000044 | 2023-01-30 | 8 m | 0 deg | b_20241217_0841_Track34_Sphere_00052 (2024) |

### w01-143: faces SE (143 deg), 35.6 m

![w01-143 rectified](../../artifacts/landmark-briefs/american-hotel/w01-143.jpg)
![w01-143 2024](../../artifacts/landmark-briefs/american-hotel/w01-143.alt.jpg)
![w01-143 aimed](../../artifacts/landmark-briefs/american-hotel/w01-143.thumb.jpg)

Panorama TMX7316010203-001178_pano_0001_003767 (2019-05-13), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001178_pano_0001_003767/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-143]`.

### w02-53: faces NE (53 deg), 19 m

![w02-53 rectified](../../artifacts/landmark-briefs/american-hotel/w02-53.jpg)
![w02-53 2018](../../artifacts/landmark-briefs/american-hotel/w02-53.alt.jpg)
![w02-53 aimed](../../artifacts/landmark-briefs/american-hotel/w02-53.thumb.jpg)

Panorama TMX7316010203-002857_pano_0006_000019 (2022-12-14), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002857_pano_0006_000019/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-53]`.

### w03-220: faces SW (220 deg), 17.6 m

![w03-220 rectified](../../artifacts/landmark-briefs/american-hotel/w03-220.jpg)
![w03-220 2019](../../artifacts/landmark-briefs/american-hotel/w03-220.alt.jpg)
![w03-220 aimed](../../artifacts/landmark-briefs/american-hotel/w03-220.thumb.jpg)

Panorama TMX7316010203-002979_pano_0000_000041 (2023-02-20), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002979_pano_0000_000041/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w03-220]`.

### w04-53: faces NE (53 deg), 12.2 m

![w04-53 rectified](../../artifacts/landmark-briefs/american-hotel/w04-53.jpg)
![w04-53 2016](../../artifacts/landmark-briefs/american-hotel/w04-53.alt.jpg)
![w04-53 aimed](../../artifacts/landmark-briefs/american-hotel/w04-53.thumb.jpg)

Panorama b_20241211_0954_Track09_Sphere_00111 (2024-12-11), https://api.data.amsterdam.nl/panorama/panoramas/b_20241211_0954_Track09_Sphere_00111/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w04-53]`.

### w05-227: faces SW (227 deg), 9.8 m

![w05-227 rectified](../../artifacts/landmark-briefs/american-hotel/w05-227.jpg)
![w05-227 2022](../../artifacts/landmark-briefs/american-hotel/w05-227.alt.jpg)
![w05-227 aimed](../../artifacts/landmark-briefs/american-hotel/w05-227.thumb.jpg)

Panorama TMX7316010203-000355_pano_0000_000079 (2017-07-07), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-000355_pano_0000_000079/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w05-227]`.

### w06-234: faces SW (234 deg), 6.8 m

![w06-234 rectified](../../artifacts/landmark-briefs/american-hotel/w06-234.jpg)
![w06-234 2022](../../artifacts/landmark-briefs/american-hotel/w06-234.alt.jpg)
![w06-234 aimed](../../artifacts/landmark-briefs/american-hotel/w06-234.thumb.jpg)

Panorama TMX7316010203-000199_pano_0002_000291 (2017-03-10), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-000199_pano_0002_000291/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w06-234]`.

### w07-53: faces NE (53 deg), 5.7 m

![w07-53 rectified](../../artifacts/landmark-briefs/american-hotel/w07-53.jpg)
![w07-53 2018](../../artifacts/landmark-briefs/american-hotel/w07-53.alt.jpg)
![w07-53 aimed](../../artifacts/landmark-briefs/american-hotel/w07-53.thumb.jpg)

Panorama TMX7316010203-002996_pano_0003_000116 (2023-03-13), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002996_pano_0003_000116/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w07-53]`.

### w08-233: faces SW (233 deg), 5.5 m

![w08-233 rectified](../../artifacts/landmark-briefs/american-hotel/w08-233.jpg)
![w08-233 2024](../../artifacts/landmark-briefs/american-hotel/w08-233.alt.jpg)
![w08-233 aimed](../../artifacts/landmark-briefs/american-hotel/w08-233.thumb.jpg)

Panorama TMX7316010203-002951_pano_0004_000044 (2023-01-30), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002951_pano_0004_000044/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w08-233]`.
