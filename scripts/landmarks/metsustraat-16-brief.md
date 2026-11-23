# Brief: metsustraat-16 (BAG 0363100012142717)

Generated 2026-11-23 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012142717 --id=metsustraat-16`. Crops are under
`artifacts/landmark-briefs/metsustraat-16/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/metsustraat-16-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012142717 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1909 | BAG |
| BAG status / storeys | Pand in gebruik / 6 | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 17.7 / 12.6 / 17.2 / 0.5 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 16.74 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 2 (2 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

- **Municipal register 200148** (Gemeentelijk monument), https://api.data.amsterdam.nl/v1/monumenten/monumenten/630effdd-c419-4073-823b-169d46a58b9e?_format=json:
  > Stedenbouwkundige context Het voormalige schoolgebouw staat in het Museumkwartier, op een steenworp afstand van het Museumplein en het Concertgebouw. Deze buurt behoort tot de negentiende-eeuwse uitbreidingswijken van Amsterdam, maar is niet zoals andere buurten verkaveld volgens het in 1877 vastgestelde plan Kalff. Het gebied achter het Rijksmuseum werd door de overheid gereserveerd voor een voorname woonwijk, waarvoor in 1891 een afzonderlijk plan werd gemaakt door P.J.H. Cuypers en Jac. Ankersmit. Cuypers had inmiddels het Rijksmuseum gerealiseerd (geopend in 1885) en ook het aan de andere zijde van het Museumplein gelegen Concertgebouw was al gerealiseerd (geopend in 1888). Dit plein kreeg een waaiervorm, met op het museum aansluitende radialen waarop diverse dwarsstraten werden aangetakt, te weten de Hobbemastraat, de Honthorststraat en de Van de Veldestraat. Aanvankelijk was het Museumplein vooral in gebruik voor sportevenementen en tentoonstellingen, later kreeg het een meer definitieve invulling (met in 1992 de herinrichting door de Zweeds-Deense architect Sven Ingvar Andersson). Van de plannen van Cuypers en Ankersmit werd vrij stelselmatig afgeweken. Tussen 1878 en 1902 (het jaar waarin men het besluit nam tot uitvoering van de plannen) zou de bebouwing van de Museumpleinbuurt dan ook weinig stelselmatig verlopen. De in het noordwestelijke deel van de nieuwe wijk gelegen P.C. Hooftstraat raakte het eerst bebouwd, in de tachtiger jaren gevolgd door de Jan Luykenstraa

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/metsustraat-16/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-17 | N 17 | 28.6 m | TMX7316010203-002411_pano_0010_000041 | 2022-01-11 | 9 m | 0 deg | TMX7316010203-001601_pano_0004_000295 (2019) |
| w02-197 | S 197 | 28.4 m | **none: inferred** | - | - | - | - |

### w01-17: faces N (17 deg), 28.6 m

![w01-17 rectified](../../artifacts/landmark-briefs/metsustraat-16/w01-17.jpg)
![w01-17 2019](../../artifacts/landmark-briefs/metsustraat-16/w01-17.alt.jpg)
![w01-17 aimed](../../artifacts/landmark-briefs/metsustraat-16/w01-17.thumb.jpg)

Panorama TMX7316010203-002411_pano_0010_000041 (2022-01-11), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002411_pano_0010_000041/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-17]`.

### w02-197: faces S (197 deg), 28.4 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.
