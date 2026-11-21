# Brief: casa-rosso (BAG 0363100012178727)

Generated 2026-11-21 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012178727 --id=casa-rosso`. Crops are under
`artifacts/landmark-briefs/casa-rosso/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/casa-rosso-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012178727 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1005 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 11.4 / 0.0 / 8.5 / 0.4 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 8.09 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 2 (2 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

No municipal or national monument record links this pand (scripts/data/amsterdam-monument-register snapshot). That is not evidence of no ornament: look at the crops.

- **Lijst van rijksmonumenten aan de Oudezijds Achterburgwal**, https://nl.wikipedia.org/wiki/Lijst_van_rijksmonumenten_aan_de_Oudezijds_Achterburgwal (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Een overzicht van de 122 rijksmonumenten aan de Oudezijds Achterburgwal in Amsterdam. 

- **Lijst van monumenten in Amsterdam**, https://nl.wikipedia.org/wiki/Lijst_van_monumenten_in_Amsterdam (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > De stad en gemeente Amsterdam kent een groot aantal monumenten, objecten die aangewezen zijn als monumentaal erfgoed. Dit zijn wereld-, rijks-, provinciale en gemeentelijke monumenten, Nationale Landschappen, beschermde stads- en dorpsgezichten en oorlogsmonumenten. Hieronder volgt, gegroepeerd naar status, een opsomming van deze monumenten of een verwijzing naar een lijst van monumenten. 

- **History of Amsterdam**, https://en.wikipedia.org/wiki/History_of_Amsterdam (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Amsterdam has a long and eventful history. The origins of the city lie around 1000 CE, when inhabitants settled at the mouth of the Amstel and began peatland reclamation. After the All Saints' Flood (1170), a dam was built in the Amstel to protect the lower lands from floods. In 1275, Amsterdam was granted a toll privilege by Count Floris V which exempted it from a bridge toll. This made Amsterdam popular for international traders to sell goods at lower prices. During the Middle Ages, it developed into one of the largest trading cities in the world. The 17th century was a Golden Age, Amsterdam was the most important trading hub in Europe and the leading financial center of the western world.

- **List of KLM Delft Blue houses**, https://en.wikipedia.org/wiki/List_of_KLM_Delft_Blue_houses (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Below is a list of Delft Blue houses that KLM has presented to all of its World Business Class passengers since the 1950s. Until 1994, the houses were issued irregularly. Since 1994, a new house has been presented each year on October 7, the anniversary of KLM's founding in 1919. 

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/casa-rosso/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-27 | NE 27 | 18.8 m | b_20250114_1026_Track06_Sphere_00050 | 2025-01-14 | 24 m | 37 deg | TMX7316010203-001174_pano_0000_001896 (2019) |
| w02-124 | SE 124 | 8.8 m | TMX7316010203-002356_pano_0005_000141 | 2021-12-27 | 18 m | 0 deg | TMX7316010203-002629_pano_0001_000883 (2022) |

### w01-27: faces NE (27 deg), 18.8 m

![w01-27 rectified](../../artifacts/landmark-briefs/casa-rosso/w01-27.jpg)
![w01-27 2019](../../artifacts/landmark-briefs/casa-rosso/w01-27.alt.jpg)
![w01-27 aimed](../../artifacts/landmark-briefs/casa-rosso/w01-27.thumb.jpg)

Panorama b_20250114_1026_Track06_Sphere_00050 (2025-01-14), https://api.data.amsterdam.nl/panorama/panoramas/b_20250114_1026_Track06_Sphere_00050/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-27]`.

### w02-124: faces SE (124 deg), 8.8 m

![w02-124 rectified](../../artifacts/landmark-briefs/casa-rosso/w02-124.jpg)
![w02-124 2022](../../artifacts/landmark-briefs/casa-rosso/w02-124.alt.jpg)
![w02-124 aimed](../../artifacts/landmark-briefs/casa-rosso/w02-124.thumb.jpg)

Panorama TMX7316010203-002356_pano_0005_000141 (2021-12-27), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002356_pano_0005_000141/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-124]`.
