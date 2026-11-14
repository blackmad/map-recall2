# Brief: cristofori (BAG 0363100012253896)

Generated 2026-11-14 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012253896 --id=cristofori`. Crops are under
`artifacts/landmark-briefs/cristofori/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/cristofori-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012253896 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1905 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 21.0 / 21.2 / 20.0 / 0.4 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 19.67 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 2 (2 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

No municipal or national monument record links this pand (scripts/data/amsterdam-monument-register snapshot). That is not evidence of no ornament: look at the crops.

- **Prinsengracht 581-583**, https://nl.wikipedia.org/wiki/Prinsengracht_581-583 (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Prinsengracht 581-583 te Amsterdam is een bedrijfsgebouw aan de Prinsengracht in Amsterdam-Centrum. 

- **Prinsengracht 579**, https://nl.wikipedia.org/wiki/Prinsengracht_579 (CC BY-SA 4.0), found by search. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:
  > Prinsengracht 579 is een bedrijfsgebouw aan de Prinsengracht in Amsterdam-Centrum. 

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/cristofori/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-273 | W 273 | 11.5 m | TMX7316010203-001974_pano_0000_000921 | 2021-01-22 | 24 m | 4 deg | TMX7316010203-000205_pano_0000_001106 (2017) |
| w02-94 | E 94 | 6 m | **none: inferred** | - | - | - | - |

### w01-273: faces W (273 deg), 11.5 m

![w01-273 rectified](../../artifacts/landmark-briefs/cristofori/w01-273.jpg)
![w01-273 2017](../../artifacts/landmark-briefs/cristofori/w01-273.alt.jpg)
![w01-273 aimed](../../artifacts/landmark-briefs/cristofori/w01-273.thumb.jpg)

Panorama TMX7316010203-001974_pano_0000_000921 (2021-01-22), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001974_pano_0000_000921/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-273]`.

### w02-94: faces E (94 deg), 6 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.
