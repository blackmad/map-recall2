# Brief: de-otter (BAG 0363100012096312)

Generated 2026-10-25 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012096312 --id=de-otter`. Crops are under
`artifacts/landmark-briefs/de-otter/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/de-otter-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012096312 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1631 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | - / - / - / - | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | - | 3DBAG |
| tile height | 6.32 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 4 (4 >= 2 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

- **Municipal register 1198** (Rijksmonument), https://api.data.amsterdam.nl/v1/monumenten/monumenten/f4016795-602b-41f2-8796-4319fcd3b98f?_format=json:
  (no description text)

- **Rijksmonument 1198** (rijksmonument), https://monumentenregister.cultureelerfgoed.nl/monumenten/1198:
  > Paltrokmolen "De Otter", aan de Kostverlorenvaart, zeventiende of achttiende eeuw.

- **Rijksmonument 408758** (rijksmonument), https://monumentenregister.cultureelerfgoed.nl/monumenten/408758:
  > Op geknikte grondslag langs de Kostverlorenvaart in hout opgetrokken open HOUTLOODS, behorend bij de in oorsprong zeventiende-eeuwse paltrokmolen De Otter, waarbij het met rode pannen gedekte zadeldak tussen uitkragende puntgevels met makelaars wordt gedragen door een reeks van twaalf samengestelde gebinten en standvinken. De met getrapte weeg geconstrueerde zijwanden hebben geteerde delen. Houtloods van belang als onderdeel van het houtzaagmolencomplex De Otter.

- **De Otter (Amsterdam)**, https://nl.wikipedia.org/wiki/De_Otter_(Amsterdam) (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > De Otter is een houtzaagmolen in Amsterdam-West aan de Kostverlorenvaart. Deze molen is de laatste overgebleven van een grote groep zaagmolens die tussen de 17e eeuw en eind 19e eeuw ten westen van de Buitensingelgracht stonden. Omstreeks 1900 is hier de Frederik Hendrikbuurt gebouwd. De Otter is van het type paltrokmolen, waarvan nog op vijf plaatsen in Nederland exemplaren aanwezig zijn (Amsterdam, Haarlem, Zaandam, Zaanse Schans en Nederlands Openluchtmuseum in Arnhem). De Otter is de oudste nog bestaande molen van dit type. 

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/de-otter/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-158 | S 158 | 6.5 m | **none: inferred** | - | - | - | - |
| w02-354 | N 354 | 6 m | TMX7316010203-000198_pano_0001_000079 | 2017-03-07 | 31 m | 20 deg | TMX7316010203-001953_pano_0000_001043 (2021) |
| w03-84 | E 84 | 5.3 m | **none: inferred** | - | - | - | - |
| w04-287 | W 287 | 3.3 m | TMX7316010203-000198_pano_0001_000077 | 2017-03-07 | 24 m | 16 deg | TMX7316010203-001952_pano_0000_000050 (2021) |

### w01-158: faces S (158 deg), 6.5 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w02-354: faces N (354 deg), 6 m

![w02-354 rectified](../../artifacts/landmark-briefs/de-otter/w02-354.jpg)
![w02-354 2021](../../artifacts/landmark-briefs/de-otter/w02-354.alt.jpg)
![w02-354 aimed](../../artifacts/landmark-briefs/de-otter/w02-354.thumb.jpg)

Panorama TMX7316010203-000198_pano_0001_000079 (2017-03-07), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-000198_pano_0001_000079/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-354]`.

### w03-84: faces E (84 deg), 5.3 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w04-287: faces W (287 deg), 3.3 m

![w04-287 rectified](../../artifacts/landmark-briefs/de-otter/w04-287.jpg)
![w04-287 2021](../../artifacts/landmark-briefs/de-otter/w04-287.alt.jpg)
![w04-287 aimed](../../artifacts/landmark-briefs/de-otter/w04-287.thumb.jpg)

Panorama TMX7316010203-000198_pano_0001_000077 (2017-03-07), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-000198_pano_0001_000077/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w04-287]`.
