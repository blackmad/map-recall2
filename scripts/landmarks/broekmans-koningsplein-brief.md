# Brief: broekmans-koningsplein (BAG 0363100012253807)

Generated 2026-11-22 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012253807 --id=broekmans-koningsplein`. Crops are under
`artifacts/landmark-briefs/broekmans-koningsplein/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/broekmans-koningsplein-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012253807 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1904 | BAG |
| BAG status / storeys | Pand in gebruik / 5 | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 20.2 / 0.0 / 20.1 / 1.6 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 18.5 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 3 (2 >= 4 m in this brief, 1 shorter/extra not shown) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

- **Municipal register 202025** (Gemeentelijk monument), https://api.data.amsterdam.nl/v1/monumenten/monumenten/29c90175-fcc2-44de-96f0-0612fec071cc?_format=json:
  > Stedenbouwkundige context Het Koningsplein is binnen de middeleeuwse omgrenzing van Amsterdam een van de grotere openbare ruimtes. Vanwege de representatieve winkelarchitectuur uit de periode 1890 - 1915 is sprake van een zekere grandeur. Het Koningsplein is ontstaan na het dempen van de gracht (Heiligewegburgswal) in 1658, in feite een verbreding van de Heiligeweg naar Sloten. Na de sloop van de Heiligewegpoort in 1663 kwam het Koningsplein in nauwe stedenbouwkundige relatie te staan tot de aangrenzende Herengracht, onderdeel van de vierde grote stadsuitleg van 1660 en later. De huidige schaalvergroting van de bebouwing (van origine tamelijk kleinschalige, smalle panden) vond plaats vanaf 1890 en is passend bij het ruim bemeten profiel van het plein. Tussen de massief aandoende nieuwbouw is een enkel overgebleven ouder pand een indicatie van de oude verhoudingen, overigens alleen nog waarneembaar in de dicht bebouwde structuur van de aanliggende, oorspronkelijk middeleeuwse bouwblokken. Het pand Koningsplein 14-16/Herengracht 439 is in de rooilijn gelegen en is exemplarisch voor de schaalvergroting op deze locatie. Het gegeven dat het een hoekpand betreft is stedenbouwkundig niet uitgewerkt. De gevelwanden aan de grachtzijde en op het plein zijn identiek vormgegeven. Typologie Winkelpand/warenhuis opgetrokken over een hoge begane grond, twee verdiepingen van gelijke hoogte en één lagere verdieping, afgescheiden door een overkragende waterlijst. Het pand is in twee sessies ge

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/broekmans-koningsplein/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-153 | SE 153 | 16.8 m | b_20250109_1300_Track05_Sphere_00289 | 2025-01-09 | 9 m | 0 deg | TMX7316010203-001544_pano_0000_000629 (2019) |
| w02-224 | SW 224 | 7.9 m | TMX7316010203-001975_pano_0000_000548 | 2021-01-22 | 23 m | 1 deg | TMX7316010203-000355_pano_0000_000793 (2017) |

### w01-153: faces SE (153 deg), 16.8 m

![w01-153 rectified](../../artifacts/landmark-briefs/broekmans-koningsplein/w01-153.jpg)
![w01-153 2019](../../artifacts/landmark-briefs/broekmans-koningsplein/w01-153.alt.jpg)
![w01-153 aimed](../../artifacts/landmark-briefs/broekmans-koningsplein/w01-153.thumb.jpg)

Panorama b_20250109_1300_Track05_Sphere_00289 (2025-01-09), https://api.data.amsterdam.nl/panorama/panoramas/b_20250109_1300_Track05_Sphere_00289/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-153]`.

### w02-224: faces SW (224 deg), 7.9 m

![w02-224 rectified](../../artifacts/landmark-briefs/broekmans-koningsplein/w02-224.jpg)
![w02-224 2017](../../artifacts/landmark-briefs/broekmans-koningsplein/w02-224.alt.jpg)
![w02-224 aimed](../../artifacts/landmark-briefs/broekmans-koningsplein/w02-224.thumb.jpg)

Panorama TMX7316010203-001975_pano_0000_000548 (2021-01-22), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001975_pano_0000_000548/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-224]`.
