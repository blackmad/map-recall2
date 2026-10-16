# Mercatorplein towers and arcade (2026-10-14)

Two bespoke landmarks for H.P. Berlage's Mercatorplein (De Baarsjes, 1925-27):

- `mercatorplein-noordtoren`: the north wall block (BAG pand 0363100012107349), with the
  north tower, the gatehouse over the Mercatorstraat underpass and the arcaded shop front
  along the square. The north tower was demolished in 1961 and rebuilt to Berlage's design
  in the 1990s, which is why BAG gives it the year 1996.
- `mercatorplein-zuidtoren`: the south gatehouse and tower (BAG pand 0363100012073289) over
  the Van Spilbergenstraat underpass. This one is the 1927 original (Rijksmonument 527135).

Both are hybrids:

- The 3DBAG LoD2.2 shell carries the ordinary walls, drawn with block-kit facade systems.
- Typed hand geometry carries the tower, gatehouse and ornaments.
- The square-front arcade is the kit's new `arcade` ground.
- Frame: u runs along bearing 74° (the square's long axis), n along bearing 344°, h is up.
  The origin is the BAG footprint vertex average.

Code:

- `scripts/landmarks/mercatorplein-kit.ts` holds the shared parts: frame helpers, prism
  erker, hoist beam, clock dial, gatehouse with a through-passage, corner and box
  balconies, proud windows, and `assemble`, which drops kit triangles under the hand
  region.
- One builder per tower: `scripts/landmarks/mercatorplein-noordtoren-builder.ts` and
  `scripts/landmarks/mercatorplein-zuidtoren-builder.ts`.
- Intents: `scripts/landmarks/mercatorplein-*-intent.json`.
- Inventories: `scripts/landmarks/mercatorplein-*-inventory.json`.
- Sheet tools live in `scripts/mercatorplein/`:
  - `aim.ts` fetches panorama thumbnails aimed at an RD point;
  - `sheets.ts` makes the photo | model | overlay sheets (orthographic from rectified crops,
    perspective from thumbnails);
  - `strip.ts` makes the four-side gallery strips;
  - `report.ts` reports kit groups and gates;
  - `catalogue-entry.ts` writes the catalogue entry.
- The kit arcade itself (a chamfered arch head and the `arcade` ground, with a test, and
  byte-identical when absent) landed in f3fb1958.

## Result

| model | triangles (full) | bytes | lod1 triangles | lod1 bytes | audit |
|---|---|---|---|---|---|
| mercatorplein-noordtoren | 16,994 (kit 3,600 + hand 13,564, after drop) | 251 KB | 3,373 | 66 KB | PASS, near-z-fight warnings only |
| mercatorplein-zuidtoren | 4,913 (kit 754 + hand 4,252) | 85 KB | 1,430 | 37 KB | PASS |

Both models are under the 40,000-triangle and 500 KB budgets.

**Installed.** Both models are in the catalogue without a held status. The sheets read as
the photo at gallery size on three counts:

- **Colour family:** dark red-brown brick, cream frames, grey-blue tiles and grey render
  on the portals.
- **Rhythm:** seven arcade bays under seven erkers. On the towers, small windows low down
  with four large square windows stacked above.
- **Top silhouette:** the north shaft with its clock rising behind the main block, the
  south tower's flat top with the higher rear shaft, and the steep saddle roofs over both
  gates.

## Sheets

All sheets are in `docs/images/mercatorplein/`, each under 400 KB. Full-size originals
are in `artifacts/mercatorplein/sheets/`.

- Photo | model | overlay sheets. These are orthographic elevations of rectified panorama
  crops, with the crop base taken as street level. Two panoramas per face:
  - `n-w01-arcade-front.jpg`: the north wall's square front, with the arcade, erkers and
    hoist beams.
  - `n-w02-gate-tower-square.jpg`: the north gate and tower from the square.
  - `n-w03-gate-tower-rear.jpg`: the north gate and tower from Mercatorstraat.
  - `s-w02-gate-tower-square.jpg`: the south gate and tower from the square.
  - `s-w01-rear.jpg`: the south gate rear and the rear shaft, from Van Spilbergenstraat.
  - `s-w03-east-bay.jpg`: the south block's east bay on the square.
- `strip-noordtoren.jpg` and `strip-zuidtoren.jpg`: four-side strips at gallery-card size.
  `square-both.jpg` shows both towers across the square.
- `ride-jan-evertsen.jpg`: a ride frame from the Jan Evertsenstraat approach at
  4.849289, 52.369874, heading 74°. The north tower's clock shaft rises over the corner
  ahead-left.
  - Settings: `scripts/live-play-shots.mjs` in car mode, cockpit view, port 4527, with
    landmark bundles rebuilt into `artifacts/` and passed through `BUNDLES_DIR`.
  - Pitch: raised to 78° through `EVAL_JS`. At the default pitch the tower top is out of
    frame.
  - In the game the models are "shown" (the probe listed both in the landmark layer).
    They are only visible once the camera looks up past the low default pitch.

## Verdict per face

| face | reads as the photo? | notes |
|---|---|---|
| North square front (arcade) | yes | Seven chamfered arcade openings under a rendered lintel band, a soldier course, seven prism erkers with flank windows on three storeys, eight hoist beams on the parapet, coping. Openings line up with the crop within about 0.5 m. The 3DBAG raised block at the west end of the parapet is not in the photo (see gaps). |
| North gate and tower, square side | yes | Chamfered underpass in a stepped render frame, erker over it, tiled saddle roof with a white eaves board, tower base windows, clock dial near the top of the shaft, slit under the dial, corner balconies at the measured heights. |
| North gate and tower, rear | yes | Same portal and erker; four big square windows stacked on the tower's north face. |
| North west and rear walls | acceptable | Kit brick-bay-grid. The Hoofdweg wall and the east-part square wall are party walls with pand 0363100012140699 and pand 0363100012070081, so they stay blank (the neighbours carry them). |
| South gate and tower, square side | yes | Three lower storeys of three small windows, four big square windows, corbel steps, door with transom, portal and erker, dormer in the gate roof. The rear shaft shows above the flat top, as in the Commons photos. |
| South rear (Van Spilbergenstraat) | yes | Rear mouth, erker, base windows, shaft window pairs, box balconies. |
| South east bay | yes | Prism erker, hoist beam, plinth shopfronts. |

## Inventory, in brief

"Modelled" means real geometry; "simplified" means present but coarser than the photo.

**North (pand 0363100012107349)**

| item | where | status |
|---|---|---|
| Arcade: 7 chamfered openings, dark brick piers, rendered lintel band, shops 2.4 m back | square front, ground | modelled (kit `arcade`) |
| Prism erkers, one per bay, storeys 1-3, pitched caps | square front | modelled (simplified: three-sided with a stone cap) |
| Flank windows either side of each erker | square front | modelled |
| Hoist beams with ram's-horn scrolls (8) | square-front parapet | modelled |
| Hoist beam (1) | east parapet (w07) | modelled |
| Soldier course over the lintel band | square front | modelled |
| Parapet coping | square front | modelled |
| Shop signs and flags | arcade | not modelled (tenant content) |
| Underpass, 5.9 m, chamfered head, stepped render frame | gate, both mouths | modelled (real through-passage) |
| Side doors | gate | modelled |
| Gate erker, three-sided, 3.7 m | gate, both sides | modelled |
| Steep saddle roof, white eaves board, glazed eaves strip | gate | modelled |
| Tower massing: base, 32.4 m main block, 37.4 m shaft | tower | modelled |
| Clock dials, S/W/E, 1.9 m, hour bars and hands | top of shaft | modelled |
| Clock slit | shaft, south face | modelled |
| Paired shaft windows | shaft | modelled |
| Corner balconies, quarter-round, white soffits | shaft angles | simplified |
| Tower lower windows | tower base | modelled |
| Big square windows (4) | tower, north face | modelled |
| Rear and west windows | rear and west walls | modelled (kit) |
| Glass-block clerestory and shop canopy along Hoofdweg | w05 | not modelled: they belong to the neighbour pand 0363100012140699 |

**South (pand 0363100012073289)**

| item | where | status |
|---|---|---|
| Underpass, 6 m, chamfered head, stepped render frame | gate, both mouths | modelled |
| Gate erker, 3.5 m | gate, both sides | modelled |
| Saddle roof, eaves board, glazed strip, dormer | gate | modelled |
| Tower, 6.8 x 8.9 m, flat top at 29.2 m with coping | tower | modelled |
| Rear shaft, 4.5 m wide, to 35.4 m, with window pairs | tower | modelled |
| Big square windows (4) | tower front | modelled |
| Lower windows, 3 per storey on 3 storeys | tower front | modelled |
| Door with three-light transom; side and shop doors | ground | modelled |
| Stepped corbel panel | under the lowest big window | simplified: three stepped slabs |
| Grooved corner brickwork | tower corners | simplified: three dark strips 5 cm proud |
| Diaper frieze | under the east coping | simplified: lighter band with raised lozenges |
| Small east windows (3) | tower east face | modelled |
| Box balconies, three per side | beside the rear shaft | simplified |
| Vent squares | tower walls | not modelled: too small at game scale |
| Dark plinth with natural-stone blocks | rear | modelled as a dark plinth strip |
| East bay: prism erker, hoist beam, shopfronts | w03 | modelled |

## Measurements

Heights are metres above street level, read on rectified crops. Crop bases are taken as
the street, because published camera heights can be off by about 2 m. All massing tops
come from 3DBAG LoD2.2.

**North**

- Arcade:
  - storey lines 4.92, 7.74, 10.55, 13.37, parapet 13.87;
  - seven bays at a 6.24 m pitch.
- Plinth and band: plinth to 2.95 m, render band from 2.95 to 4.95 m.
- Tower massing:
  - base u 20.35–25.0, n −10.9 to −1.9, top 13.9;
  - main block u 18.1–25.1, n −8.2 to −1.9, top 32.4;
  - shaft u 19.0–25.0, n −10.2 to −8.2, top 37.4.
- Clock: dial centre at 35.55 m, radius 0.95 m.
- Balconies at 19.4, 23.0 and 26.6 m.
- Big north windows: u 20.55–22.65, sills 16.4, 20.9, 25.0 and 29.4 m, each 2.45 m tall.
- Gate:
  - u 25.0–37.1;
  - eaves 12.2 m at the front, 12.0 m at the rear; ridge 17.3 m;
  - portal u 25.35–31.2, springing at 3.9 m, head at 5.0 m, chamfer 1.1 m;
  - erker u 26.35–30.1.

**South**

- Tower massing:
  - tower u −13.3 to −6.6, n −2.7 to 3.6, top 29.2;
  - rear part from n −5.3, top 15.0;
  - shaft u −12.3 to −7.6, top 35.4.
- Big windows: u −11.1 to −8.8, sills 12.85, 16.75, 20.85 and 24.9 m, each 2.3 m tall.
- Lower windows: sills 4.1, 7.0 and 9.75 m.
- Balconies at 15.6, 19.6 and 23.7 m.
- Gate:
  - eaves 11.5 m at the front, 11.6 m at the rear; ridge 16.9 m;
  - portal u −6.1 to −0.95, springing at 3.7 m, head at 5.0 m, chamfer 1.3 m;
  - render frame reach 0.9 m, shoulder 5.2 m, crown 6.1 m;
  - plinth 3.2 m, band 3.2–4.9 m;
  - erker u −5.15 to −1.8.

**Palette**

| part | colour |
|---|---|
| brick | #8b5a4a (lifted from the measured #7b5246 so it holds its value in the game's light) |
| frames | #e6dfca |
| render | #9d978a |
| tiles | #5b6168 |
| glass | #3a4148 |

## Sources

All sources are open data. There is no Street View.

**Gemeente Amsterdam panoramas (CC BY 4.0)**

- Rectified crops per wall, two or three panoramas each. The crop JSONs record the
  panorama ids and capture dates, from 2018 to 2025.
- Aimed thumbnails for the tower tops.

**Data**

- BAG panden 0363100012107349 and 0363100012073289, and their party-wall neighbours.
- 3DBAG LoD2.2 for both panden (CC BY 4.0).

**Rijksmonumenten register (CC0)**

- 527135: the south gatehouse with its high tower; eight storeys, the narrower part
  raised higher, three small balconies in the angles.
- 527136: the north-west side, with the gallery and hoist beams.
- 527137.

**Wikimedia Commons**

| file | photographer | licence |
|---|---|---|
| Amsterdam_Mercatorplein_20090516.jpg | Pbech | public domain |
| Mercatorplein,_overzicht.jpg | Ceescamel | CC BY-SA 4.0 |
| Mercatorplein_34_(2).jpg | Ceescamel | CC BY-SA 4.0 |
| Mercatorplein_2-12_(2).jpg | Ceescamel | CC BY-SA 4.0 |
| Mercatorplein_2-AB_(1).jpg | Ceescamel | CC BY-SA 4.0 |
| Mercatorplein_36-96_(5).jpg | Ceescamel | CC BY-SA 4.0 |
| Mercatorplein_1-17_(1).jpg | Ceescamel | CC BY-SA 4.0 |
| Mercatorplein_1-17_(3).jpg | Ceescamel | CC BY-SA 4.0 |
| Mercatorplein_14-26.jpg | Ceescamel | CC BY-SA 4.0 |
| Mercatorplein_28-32_(1).jpg | Ceescamel | CC BY-SA 4.0 |

Each file is at https://commons.wikimedia.org/wiki/File:<name>.

**Background:** Wikipedia (nl), *Mercatorplein (Amsterdam)*.

**Archive:** everything above is archived in `map-recall2-source-data` on branch
`lane/mercatorplein-20261014`:

- `pand-reference-walls/<pand>`;
- `models/mercatorplein-*/files`: the landmark briefs, views, the Commons originals and the
  register text.

## What the kit still cannot say

These were all built by hand in `mercatorplein-kit.ts` and would be worth promoting into
the block kit:

1. **Prism (two- or three-sided) erkers** over a ground system, with a pitched or slab cap.
   The kit has flat bays only.
2. **Hoist beams with wrought-iron scrolls.** The kit has no parapet iron of any kind.
3. **Clock dials** on a wall face.
4. **Gatehouses with a real through-passage:** a chamfered portal in a stepped render frame
   and a transverse saddle roof with a white eaves board. The kit can only paint an opening
   onto a wall; it cannot cut a passage through a block.
5. **Corner balconies** set in the angle between two masses, both quarter-round and boxed.
6. **Brick relief:** grooved corners, diaper friezes and stepped corbels. These are
   approximated with plates; the kit has no brick-relief vocabulary.
7. **Arcade bay content.** The kit arcade gives the openings and the shop glazing, but
   cannot vary the content per bay: doors and signs behind it.
8. **Party walls the photo shows exposed.** The neighbour carries the Hoofdweg wall's
   windows and the glass-block band, so the standalone model shows those walls blank in the
   gallery.
9. **3DBAG ghosts.** A raised block at the west end of the north parapet is in 3DBAG but
   not in the photo. The kit has no way to say "trust the photo over 3DBAG here". The
   builder could clip it by hand, but it is left as data for now.
10. **Kit gate on the south east bay.** The kit's own gate report for the south east bay
    flags one downward-facing roof triangle (`roofDownward: 1`). I have not traced which
    triangle it is. The GLB audit of the assembled model passes, and the strips show no
    hole or flipped face.
