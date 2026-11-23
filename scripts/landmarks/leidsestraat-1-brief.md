# Brief: leidsestraat-1 (BAG 0363100012177446)

Generated 2026-11-23 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012177446 --id=leidsestraat-1`. Crops are under
`artifacts/landmark-briefs/leidsestraat-1/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/leidsestraat-1-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012177446 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1904 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 31.8 / 30.3 / 27.4 / 1.3 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 26.12 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 3 (3 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

- **Municipal register 518332** (Rijksmonument), https://api.data.amsterdam.nl/v1/monumenten/monumenten/deb55c30-c7f9-435f-aa8f-c418fafc0c52?_format=json:
  (no description text)

- **Rijksmonument 518332** (rijksmonument), https://monumentenregister.cultureelerfgoed.nl/monumenten/518332:
  > Inleiding Op de hoek van Herengracht en Leidsestraat in 1904-1905 tot stand gekomen 'MAGAZIJN en WINKEL voor den verkoop van Heeren-, Jongeheeren- en Kinderkleding en Modeartikelen' naar een ontwerp in Art Nouveau-stijl van P.A. Weeldenburg. Het winkelpand werd gebouwd in opdracht van de Levensverzekering Maatschappij 'Dordrecht' die het verhuurde aan A. Kreymborg. Deze vestigde hier de firma Kreymborg & Co. In 1909 werd Herengracht 432 bij het confectiemagazijn betrokken. In 1919 kwam het pand in handen van de Eerste Nederlandsche Verz. Mij NV, die in datzelfde jaar de aandelen van de Dordrechtse in handen kreeg. In 1929 werd het pand veranderd. De oorspronkelijk op het dak gesitueerde beeldengroep is in 1960 verdwenen. Omschrijving Op een nagenoeg rechthoekige plattegrond in witte en gekleurde gladde baksteen opgetrokken winkelpand bestaande uit vier bouwlagen onder een pyramidaalvormig dak bedekt met shingles. De dakranden zijn afgezet met een koperen deklaag. In de kap een aantal kleine dakkapellen. Het gebouw heeft een deels in het zicht gelaten ijzerconstructie waardoor de begane grond en de twee daarboven gelegen verdiepingen nagenoeg geheel van glas konden worden opgetrokken. De verdiepingen worden van elkaar gescheiden door zware horizontale ijzeren balken gedragen door slanke gietijzeren sierzuiltjes. De ramen zijn gevat in dunne ijzeren roeden. Op de hoeken van het gebouw zware natuurstenen pilasters. De etalagevensters op de begane grond zijn naar binnen geplaatst

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/leidsestraat-1/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-323 | NW 323 | 18.3 m | TMX7316010203-002951_pano_0016_000182 | 2023-01-30 | 24 m | 30 deg | TMX7316010203-001053_pano_0000_003383 (2018) |
| w02-43 | NE 43 | 9.8 m | TMX7316010203-001975_pano_0000_000550 | 2021-01-22 | 23 m | 4 deg | TMX7316010203-000355_pano_0000_000791 (2017) |
| w03-45 | NE 45 | 8.7 m | TMX7316010203-001543_pano_0000_003117 | 2020-01-08 | 14 m | 0 deg | TMX7316010203-000355_pano_0000_000792 (2017) |

### w01-323: faces NW (323 deg), 18.3 m

![w01-323 rectified](../../artifacts/landmark-briefs/leidsestraat-1/w01-323.jpg)
![w01-323 2018](../../artifacts/landmark-briefs/leidsestraat-1/w01-323.alt.jpg)
![w01-323 aimed](../../artifacts/landmark-briefs/leidsestraat-1/w01-323.thumb.jpg)

Panorama TMX7316010203-002951_pano_0016_000182 (2023-01-30), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002951_pano_0016_000182/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-323]`.

### w02-43: faces NE (43 deg), 9.8 m

![w02-43 rectified](../../artifacts/landmark-briefs/leidsestraat-1/w02-43.jpg)
![w02-43 2017](../../artifacts/landmark-briefs/leidsestraat-1/w02-43.alt.jpg)
![w02-43 aimed](../../artifacts/landmark-briefs/leidsestraat-1/w02-43.thumb.jpg)

Panorama TMX7316010203-001975_pano_0000_000550 (2021-01-22), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001975_pano_0000_000550/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-43]`.

### w03-45: faces NE (45 deg), 8.7 m

![w03-45 rectified](../../artifacts/landmark-briefs/leidsestraat-1/w03-45.jpg)
![w03-45 2017](../../artifacts/landmark-briefs/leidsestraat-1/w03-45.alt.jpg)
![w03-45 aimed](../../artifacts/landmark-briefs/leidsestraat-1/w03-45.thumb.jpg)

Panorama TMX7316010203-001543_pano_0000_003117 (2020-01-08), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001543_pano_0000_003117/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w03-45]`.
