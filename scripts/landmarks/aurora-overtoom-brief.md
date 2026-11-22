# Brief: aurora-overtoom (BAG 0363100012233556)

Generated 2026-11-22 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012233556 --id=aurora-overtoom`. Crops are under
`artifacts/landmark-briefs/aurora-overtoom/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/aurora-overtoom-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012233556 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1961 | BAG |
| BAG status / storeys | Pand in gebruik / 9 | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 35.8 / 28.5 / 31.0 / 0.4 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 30.66 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 6 (3 >= 4 m in this brief, 3 shorter/extra not shown) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

- **Municipal register 200973** (Gemeentelijk monument), https://api.data.amsterdam.nl/v1/monumenten/monumenten/236797b0-068e-4c69-8e7e-0c297d3ae75c?_format=json:
  > Kantoorgebouw Aurora is van grote stedenbouwkundige waarde. Door zijn omvang en situering op de hoek van de Overtoom en de Stadhouderskade is het kantorencomplex prominent aanwezig in het stadsbeeld. De licht gebogen gevel begeleidt en verbindt deze twee belangrijke verkeerswegen. Samen met het tegenovergelegen woningbouwcomplex van Göbel en Den Hartog, waarvan Aurora als de ruimtelijke tegenhanger beschouwd kan worden, markeren de twee gebouwen het begin van de Overtoom. Qua omvang sluit het gebouw aan op de hoge gesloten gevelwand aan de Stadhouderskade, die zich kenmerkt door grootschalige bebouwing uit verschillende perioden. Het gebouw kan in dat opzicht beschouwd worden als een waardevolle exponent van de schaalvergroting of cityvorming die hier vanaf de jaren twintig van de twintigste eeuw heeft plaatsgevonden. Juist de afleesbaarheid van die ontwikkeling en de gelaagdheid van het stadsbeeld is van waarde. De architectonische waarde van dit gebouw is vooral gelegen in de voorgevel, die gekenmerkt wordt door een hoge plint met pilotis, het opgetilde hoofdvolume, de verticale geleding en de terugliggende dakopbouw. De toepassing van natuursteen over de volle hoogte van de gevel is uitzonderlijk voor een kantoorgebouw in Amsterdam uit deze periode. Aurora is een representatief voorbeeld van de corporate architecture die het bureau van Zanstra in de jaren zestig veelvuldig toepaste bij kantoorgebouwen, namelijk een uitgesproken modernistische, corbusiaanse stijl die kenmer

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/aurora-overtoom/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-40 | NE 40 | 28.6 m | recording_2025-07-03_10-58-37_00099 | 2025-07-03 | 24 m | 1 deg | TMX7316010203-001687_pano_0000_000050 (2020) |
| w02-334 | NW 334 | 16.5 m | recording_2025-07-31_06-59-14_01744 | 2025-07-31 | 14 m | 1 deg | TMX7316010203-002374_pano_0003_000567 (2021) |
| w03-158 | S 158 | 14.5 m | **none: inferred** | - | - | - | - |

### w01-40: faces NE (40 deg), 28.6 m

![w01-40 rectified](../../artifacts/landmark-briefs/aurora-overtoom/w01-40.jpg)
![w01-40 2020](../../artifacts/landmark-briefs/aurora-overtoom/w01-40.alt.jpg)
![w01-40 aimed](../../artifacts/landmark-briefs/aurora-overtoom/w01-40.thumb.jpg)

Panorama recording_2025-07-03_10-58-37_00099 (2025-07-03), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-07-03_10-58-37_00099/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-40]`.

### w02-334: faces NW (334 deg), 16.5 m

![w02-334 rectified](../../artifacts/landmark-briefs/aurora-overtoom/w02-334.jpg)
![w02-334 2021](../../artifacts/landmark-briefs/aurora-overtoom/w02-334.alt.jpg)
![w02-334 aimed](../../artifacts/landmark-briefs/aurora-overtoom/w02-334.thumb.jpg)

Panorama recording_2025-07-31_06-59-14_01744 (2025-07-31), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-07-31_06-59-14_01744/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-334]`.

### w03-158: faces S (158 deg), 14.5 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.
