# Brief: koningsplein-1 (BAG 0363100012176247)

Generated 2026-11-23 by `node --import tsx scripts/landmarks/landmark-brief.ts --pand=0363100012176247 --id=koningsplein-1`. Crops are under
`artifacts/landmark-briefs/koningsplein-1/` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.

**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill
`scripts/landmarks/koningsplein-1-inventory.json` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,
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
| BAG pand | 0363100012176247 | BAG, api.data.amsterdam.nl (CC0) |
| construction year (BAG) | 1891 | BAG |
| BAG status / storeys | Pand in gebruik / 5 | BAG |
| roof max / ridge / 70th pct / ground (m NAP) | 25.8 / 0.0 / 21.5 / 1.2 | 3DBAG (CC BY 4.0) |
| 3DBAG roof type | slanted | 3DBAG |
| tile height | 20.33 m | building-tiles extract |
| roof shape (OSM/aerial) | - | buildings-colored.geojson |
| exposed walls | 2 (2 >= 4 m in this brief) | footprint vs neighbours |

## Register and encyclopedia text (verbatim, cited)

- **Municipal register 518359** (Rijksmonument), https://api.data.amsterdam.nl/v1/monumenten/monumenten/dbb4d119-fb01-4030-bbc0-8519e373cefb?_format=json:
  (no description text in the municipal API)
- **RCE register 518359**, https://monumentenregister.cultureelerfgoed.nl/monumenten/518359 (PDF, fetched 2026-11-23 by lane
  landmarks-r18-c), summary of the parts the model draws: corner shop with offices and a caretaker's flat, 1890-91, neo-baroque,
  Th.G. Schill and D.H. Haverkamp for the directors of the Verzekeringsbank 'Kosmos'; tower crown changed 1928; shop front
  rebuilt 1929-30 by H. Elte for W. Speyer jewellers (black Swedish granite, shop windows with heavy transoms, clerestories of
  vertical matte-glass strips, granito mosaic tableaux, the main door on the corner, a side entrance in a portico in the outer
  Koningsplein bay under a white field divided by red lines). Upper storeys red brick with natural-stone speklagen; Koningsplein
  front two window axes, Singel front one. First storey: sash windows with transom lights in stone surrounds; a frieze with a
  stone medallion and garlands between ornamental consoles that carry the second-storey balconies (iron railings not
  original); stone cordon band; French windows in stone surrounds under pediments that break a wide stencil-painted frieze;
  a projecting cordon; a lower third storey with coupled round-arched windows and stone Ionic pilasters at the corners,
  stencilled reliefs between them on the Koningsplein side; under the overhanging cornice a light-blue stencil-painted
  frieze between consoles. Hipped roofs, slate, with a strip of window glass on the Koningsplein side and a dormer
  (koekoek) on the Singel side. The half-round corner tower: three narrow rectangular windows on the first storey; a
  balcony on stone consoles with stencilled relief between them; three round-headed windows between stone pilasters on
  the second; a red painted frieze with 'VERZEKERINGSBANK' in gold letters; three round-headed windows with keystones
  between Ionic pilasters on the third; a fourth storey in natural stone with five round-headed windows between
  half-columns, a wide white-plastered frieze all round and an overhanging cornice; the dome clad in shingles and zinc,
  crowned by an open lantern with a spired iron top.

No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.

## Walls

Contact sheet: ![all walls](../../artifacts/landmark-briefs/koningsplein-1/contact.jpg)

| tag | facing | length | panorama | captured | camera | obliquity | second view |
|---|---|---|---|---|---|---|---|
| w01-331 | NW 331 | 8.7 m | TMX7316010203-002542_pano_0004_000309 | 2022-04-25 | 13 m | 0 deg | TMX7316010203-001530_pano_0003_000629 (2019) |
| w02-34 | NE 34 | 4.2 m | TMX7316010203-001975_pano_0000_001367 | 2021-01-22 | 24 m | 7 deg | TMX7316010203-000354_pano_0001_000206 (2017) |

### w01-331: faces NW (331 deg), 8.7 m

![w01-331 rectified](../../artifacts/landmark-briefs/koningsplein-1/w01-331.jpg)
![w01-331 2019](../../artifacts/landmark-briefs/koningsplein-1/w01-331.alt.jpg)
![w01-331 aimed](../../artifacts/landmark-briefs/koningsplein-1/w01-331.thumb.jpg)

Panorama TMX7316010203-002542_pano_0004_000309 (2022-04-25), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-002542_pano_0004_000309/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w01-331]`.

### w02-34: faces NE (34 deg), 4.2 m

![w02-34 rectified](../../artifacts/landmark-briefs/koningsplein-1/w02-34.jpg)
![w02-34 2017](../../artifacts/landmark-briefs/koningsplein-1/w02-34.alt.jpg)
![w02-34 aimed](../../artifacts/landmark-briefs/koningsplein-1/w02-34.thumb.jpg)

Panorama TMX7316010203-001975_pano_0000_001367 (2021-01-22), https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001975_pano_0000_001367/

Look for (relief, sculpture, crest, gable-stone, lettering, sign, clock, canopy, balcony-ironwork, lamp, tower, dome, colonnade, window-shape, other). Inventory: `walls[tag=w02-34]`.
