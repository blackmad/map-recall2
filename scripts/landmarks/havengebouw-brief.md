# Brief: havengebouw (BAG 0363100012179689)

Generated 2026-11-01 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012179689 --id=havengebouw`. Crops are under
`artifacts/landmark-briefs/havengebouw/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/havengebouw-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012179689 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1960 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 54.7 / 0.0 / 53.7 / 0.7 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 52.97 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 4 (4 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

- **Municipal register 216001** (Gemeentelijk monument), https://api.data.amsterdam.nl/v1/monumenten/monumenten/1d71388d-5a55-44c3-b595-8c491d6d5189?_format=json:
  > Stedenbouwkundige context De De Ruyterkade is ontstaan met de bouw van de stationseilanden, tussen 1872 en 1877 kunstmatig aangelegd om ruimte te bieden aan de nieuwe spoorweg- en haveninfrastructuur. Een groot deel van de bebouwing langs deze kade was al voor 1920 gesloopt ten behoeve van de bouw van een tweede kap voor het Centraal Station. Van de oorspronkelijke bebouwing (1890-1910) resteert in feite alleen nog maar het oostelijk deel van de De Ruyterkade, een ensemble van bovengemiddeld architectonisch niveau. De verschijningsvorm van het Westelijk Stationseiland wordt bepaald door naoorlogse kantoorgebouwen aan de IJ-zijde en een grote hoeveelheid sporen die het eiland doorsnijden. Het grootschalige karakter van de stationseilanden wordt mede geaccentueerd door de aanwezigheid van enkele hoge gebouwen waarvan het door W.M. Dudok ontworpen kantoorgebouw het meest karakteristieke is. C. van Eesteren, die tot 1958 hoofd was van de Afdeling Stadsontwikkeling, zag een stedenbouwkundige relatie tussen dit gebouw en de kantoren van het voormalige postgebouw op het Oosterdokseiland. Gebouwtype en bouwgeschiedenis in hoofdlijnen Het onderkelderde bouwwerk telt dertien bouwlagen en is plat afgedekt. De ontwerptekeningen vertonen een min of meer symmetrische plattegrondstructuur met een langwerpige grondvorm dwars op het IJ. De kern van het gebouw wordt gevormd door een 'facilitaire' middenas in de lengterichting van het gebouw, bestaande uit een tweetal liften, trappenhuizen en s

- **Havengebouw (Amsterdam)**, https://nl.wikipedia.org/wiki/Havengebouw_(Amsterdam) (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Het Havengebouw is een kantoorgebouw aan de De Ruijterkade in Amsterdam. Het gebouw staat op een prominente locatie aan het IJ. Het hoofdkantoor van het Havenbedrijf Amsterdam is hier gevestigd. Daarnaast zijn er andere bedrijven en instellingen en woningen. 

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/havengebouw/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-301 | NW 301 | 35.6 m | **none: inferred** | - | - | - | - |
| w02-121 | SE 121 | 26.2 m | TMX7316010203-002037_pano_0000_002971 | 2021-03-11 | 24 m | 54 deg | recording_2025-06-16_03-46-32_00457 (2025) |
| w03-31 | NE 31 | 22.2 m | TMX7316010203-002032_pano_0000_000787 | 2021-03-08 | 20 m | 0 deg | recording_2025-06-16_03-46-32_00446 (2025) |
| w04-121 | SE 121 | 5.8 m | **none: inferred** | - | - | - | - |

### w01-301: faces NW (301 deg), 35.6 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w02-121: faces SE (121 deg), 26.2 m

![w02-121 rectified](../../artifacts/landmark-briefs/havengebouw/w02-121.jpg)
![w02-121 2025](../../artifacts/landmark-briefs/havengebouw/w02-121.alt.jpg)
![w02-121 aimed](../../artifacts/landmark-briefs/havengebouw/w02-121.thumb.jpg)

Panorama TMX7316010203-002037_pano_0000_002971 (2021-03-11), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002037_pano_0000_002971/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-121]`.

### w03-31: faces NE (31 deg), 22.2 m

![w03-31 rectified](../../artifacts/landmark-briefs/havengebouw/w03-31.jpg)
![w03-31 2025](../../artifacts/landmark-briefs/havengebouw/w03-31.alt.jpg)
![w03-31 aimed](../../artifacts/landmark-briefs/havengebouw/w03-31.thumb.jpg)

Panorama TMX7316010203-002032_pano_0000_000787 (2021-03-08), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002032_pano_0000_000787/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w03-31]`.

### w04-121: faces SE (121 deg), 5.8 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.
