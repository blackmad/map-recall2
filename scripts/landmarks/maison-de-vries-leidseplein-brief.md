# Brief: maison-de-vries-leidseplein (BAG 0363100012174479)

Generated 2026-11-22 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012174479 --id=maison-de-vries-leidseplein`. Crops are under
`artifacts/landmark-briefs/maison-de-vries-leidseplein/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/maison-de-vries-leidseplein-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012174479 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1917 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 26.7 / 25.6 / 24.8 / 1.4 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 23.47 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 2 (2 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

- **Municipal register 209014** (Gemeentelijk monument), https://api.data.amsterdam.nl/v1/monumenten/monumenten/360e0e82-cdec-40b9-9a4d-5a2d3cb6ec07?_format=json:
  > Het gebouw is gelegen op de zuidelijke hoek van het Leidseplein en de Leidsestraat. Wegens de ligging op de hoek en aan het plein, en wegens het forse volume, heeft het pand hoge situationele waarde en een beeldbepalend karakter. Het Leidseplein was in de zeventiende-eeuwse aanleg gepland als entree tot de stad; tegenwoordig is het echter een druk horecaplein. Tegen het einde van de negentiende eeuw maakten de Leidsestraat en het Leidseplein deel uit van een belangrijke winkelroute en vanaf circa 1900 permitteerden grootwinkelbedrijven zich grote en prestigieuze gebouwen, waarbij gerenommeerde architecten als A. Jacot in de arm werden genomen. De grote omvang van het warenhuis past goed aan de ruimte van het Leidseplein, maar is aan de Leidsestraat tamelijk dominant. Het gebouw werd ontworpen voor Maison De Vries, maar bevat reeds sinds halverwege de twintigste eeuw kantoren op de verdiepingen, en heden een bankkantoor en een winkel op de begane grond. De verschijningsvorm van het warenhuis met een forse en strenge hoofdvorm, is als van een classicistisch paleis: boven de geheel gewijzigde pui zijn de forse muurdammen uitgevoerd als ionische, kolossale pilasters die een klassiek hoofdgestel dragen, bekroond door een attica en een afgeplat schilddak met mastiekleien en zinkgedekte hoekpinakels. De gevels zijn wit geverfd. De detaillering van de balustrades op de tweede bouwlaag, de kapitelen van de pilasters, de decoratieve elementen in de lisenen van de attica en de hoekpinak

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/maison-de-vries-leidseplein/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-323 | NW 323 | 24.2 m | TMX7316010203-001674_pano_0000_002377 | 2020-04-24 | 9 m | 10 deg | b_20241211_0954_Track13_Sphere_00056 (2024) |
| w02-229 | SW 229 | 20.2 m | TMX7316010203-001660_pano_0000_000662 | 2020-04-21 | 16 m | 1 deg | TMX7316010203-001053_pano_0000_002013 (2018) |

### w01-323: faces NW (323 deg), 24.2 m

![w01-323 rectified](../../artifacts/landmark-briefs/maison-de-vries-leidseplein/w01-323.jpg)
![w01-323 2024](../../artifacts/landmark-briefs/maison-de-vries-leidseplein/w01-323.alt.jpg)
![w01-323 aimed](../../artifacts/landmark-briefs/maison-de-vries-leidseplein/w01-323.thumb.jpg)

Panorama TMX7316010203-001674_pano_0000_002377 (2020-04-24), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001674_pano_0000_002377/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-323]`.

### w02-229: faces SW (229 deg), 20.2 m

![w02-229 rectified](../../artifacts/landmark-briefs/maison-de-vries-leidseplein/w02-229.jpg)
![w02-229 2018](../../artifacts/landmark-briefs/maison-de-vries-leidseplein/w02-229.alt.jpg)
![w02-229 aimed](../../artifacts/landmark-briefs/maison-de-vries-leidseplein/w02-229.thumb.jpg)

Panorama TMX7316010203-001660_pano_0000_000662 (2020-04-21), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001660_pano_0000_000662/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-229]`.
