# Brief: weltevreden (BAG 0363100012181160)

Generated 2026-11-23 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012181160 --id=weltevreden`. Crops are under
`artifacts/landmark-briefs/weltevreden/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/weltevreden-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012181160 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1815 | BAG |
| BAG status / storeys | Pand in gebruik / - | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 8.5 / 8.5 / 7.6 / 0.3 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 7.28 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 3 (3 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

- **Municipal register 4106** (Rijksmonument), https://api.data.amsterdam.nl/v1/monumenten/monumenten/93065d8c-7a83-45a4-8fee-2259e1b9ba5d?_format=json:
  (no description text)

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/weltevreden/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-209 | SW 209 | 12.6 m | TMX7316010203-002933_pano_0009_000098 | 2023-01-13 | 15 m | 0 deg | TMX7316010203-001181_pano_0000_003955 (2019) |
| w02-30 | NE 30 | 10.7 m | **none: inferred** | - | - | - | - |
| w03-299 | NW 299 | 5.2 m | TMX7316010203-002541_pano_0003_000060 | 2022-04-25 | 24 m | 47 deg | recording_2025-06-19_04-38-42_00946 (2025) |

### w01-209: faces SW (209 deg), 12.6 m

![w01-209 rectified](../../artifacts/landmark-briefs/weltevreden/w01-209.jpg)
![w01-209 2019](../../artifacts/landmark-briefs/weltevreden/w01-209.alt.jpg)
![w01-209 aimed](../../artifacts/landmark-briefs/weltevreden/w01-209.thumb.jpg)

Panorama TMX7316010203-002933_pano_0009_000098 (2023-01-13), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002933_pano_0009_000098/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-209]`.

### w02-30: faces NE (30 deg), 10.7 m

No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.

### w03-299: faces NW (299 deg), 5.2 m

![w03-299 rectified](../../artifacts/landmark-briefs/weltevreden/w03-299.jpg)
![w03-299 2025](../../artifacts/landmark-briefs/weltevreden/w03-299.alt.jpg)
![w03-299 aimed](../../artifacts/landmark-briefs/weltevreden/w03-299.thumb.jpg)

Panorama TMX7316010203-002541_pano_0003_000060 (2022-04-25), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002541_pano_0003_000060/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w03-299]`.
