# Brief: kiosk-dr-falafel (BAG 0363100012243757)

Generated 2026-11-01 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012243757 --id=kiosk-dr-falafel`. Crops are under
`artifacts/landmark-briefs/kiosk-dr-falafel/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/kiosk-dr-falafel-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012243757 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 2016 | BAG |
| BAG status / storeys | Pand in gebruik / 1 | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 5.6 / 0.0 / 5.5 / 1.8 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | horizontal | 3DBAG |
| tile height | 3.73 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 4 (2 >= 4 m in this brief, 2 shorter/extra not shown) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

No municipal or national monument record links this pand (scripts/data/amsterdam-monument-register snapshot). That is not evidence of no ornament: look at the crops.

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/kiosk-dr-falafel/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-106 | E 106 | 5 m | TMX7316010203-001979_pano_0001_000187 | 2021-01-25 | 21 m | 5 deg | TMX7316010203-000355_pano_0000_000018 (2017) |
| w02-286 | W 286 | 5 m | recording_2025-06-30_05-16-46_00533 | 2025-06-30 | 12 m | 0 deg | TMX7316010203-002548_pano_0000_000527 (2022) |

### w01-106: faces E (106 deg), 5 m

![w01-106 rectified](../../artifacts/landmark-briefs/kiosk-dr-falafel/w01-106.jpg)
![w01-106 2017](../../artifacts/landmark-briefs/kiosk-dr-falafel/w01-106.alt.jpg)
![w01-106 aimed](../../artifacts/landmark-briefs/kiosk-dr-falafel/w01-106.thumb.jpg)

Panorama TMX7316010203-001979_pano_0001_000187 (2021-01-25), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001979_pano_0001_000187/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-106]`.

### w02-286: faces W (286 deg), 5 m

![w02-286 rectified](../../artifacts/landmark-briefs/kiosk-dr-falafel/w02-286.jpg)
![w02-286 2022](../../artifacts/landmark-briefs/kiosk-dr-falafel/w02-286.alt.jpg)
![w02-286 aimed](../../artifacts/landmark-briefs/kiosk-dr-falafel/w02-286.thumb.jpg)

Panorama recording_2025-06-30_05-16-46_00533 (2025-06-30), https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-06-30_05-16-46_00533/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-286]`.
