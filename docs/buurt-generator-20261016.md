# Buurt generator: auto-placing a neighbourhood of repeated buildings (2026-10-16)

Pilot: Bellamybuurt Zuid (buurt EP02, 536 pands, 97 street-side faces proposed).

## Pipeline

1. `npm run block-face:buurt-survey -- --buurt=bellamybuurt-zuid` fetches the buurt outline, the 3DBAG items and the BAG
   verblijfsobjecten. It writes `scripts/block-face/buurten/<buurt>.json`, with faces grouped per street and parity side
   by shared party walls (`blockFace/buurtFaces.ts`). `--intake [--only=a,b]` runs the existing intake (discovery, uses,
   rectified strip) on every uncovered face of two or more pands.
2. `npm run block-face:auto-place -- --buurt=<buurt> --district=<library> [--only=] [--review]` does the following for
   each intaked face:
   - It reads strip evidence per pand: trim-normalised wall colour, columns, skyline crown, door side, accent side and
     share, and void/foliage shares.
   - It scores every library type (`blockFace/autoPlace.ts` `scoreType`):
     - Vetoes are build year (±2) and frontage (±0.4 m).
     - Weighted criteria are eaves as storeys at the type's own pitch, 3DBAG bouwlagen, roof form, wall colour, stucco,
       bands, columns, the accent side, and the upper accent share.
   - It places the best type when its score is 0.7 or more. Bays come from the width, the crown from the skyline, the
     door/accent side sets the mirroring, door pairs alternate, and the measured brick goes into the palette. Trading
     grounds (BAG + OSM) get a shopfront.
   - It splits the face into runs at held pands (a run needs two houses), writes `<face>-r<k>` run faces, compiles them
     (row coherence and the existing gates apply), and renders the model ortho at the strip frame.
   - It gates each pand on edge-magnitude NCC between the photo and the model body (`blockFace/stripLikeness.ts`):
     - Below 0.15 is held.
     - A rival library type without a veto of its own that the photo prefers by more than 0.05 is held. Every other
       type is compiled on the same runs as a challenger.
     - No usable photo is kept only beside a passing neighbour of the same type.
   - Held pands re-split the runs; this repeats until stable (at most 3 passes).
   - A run that does not compile is retried once with dormer-free crowns.
   - The per-face record is `faces/<face>/auto-place.json` (scores, runner-up, notes, NCC, challengers, hold reasons).
     The buurt summary is `buurten/<buurt>-placement.json`.
3. `npm run block-face:auto-place-calibrate` forces every type on every face and tabulates the NCC
   (`staging/buurt/calibrate/table.json`).

## Why edge NCC, not likeness.ts

The `compareLikeness` photo clustering fails on dark overcast strips: on the 2022-01-04 Hasebroekstraat strip it put the
glazing share at 0.6–0.85. Luminance NCC fails on curtained white windows, which are light in the photo and dark in the
model. Edge magnitude, with the placeholder grey and foliage masked and ±0.4 m shift search, separates the types:

| Row | Right type | Wrong type |
|---|---|---|
| Hasebroekstraat 4–36 | balcony type 0.21–0.35 | two-axis 0.06–0.29 |
| Bellamystraat 22–28 | two-axis 0.23–0.34 | balcony type 0.07–0.22 |
| Ten Katestraat 13–21 | flat row with measured window sizes 0.48–0.57 | same type before measuring 0.05–0.10 |

On off-exemplar streets a wrong type can still read 0.22–0.33, so the gate catches misauthored types and gross
mismatches. It does not certify a match (see the false positives below).

## Type library `scripts/block-face/types/bellamy/`

| Type | Exemplars | Notes |
|---|---|---|
| bellamy-1904-balcony-axis | Hasebroekstraat 4–36, Bellamyplein 22–38 | 3 axes, centre balconettes; crowns neck-hoist / box-dormer / none by skyline; 5 storeys at 16.5 m eaves (Hasebroekstraat 1–37) |
| bellamy-1915-tile-bay | Hasebroekstraat 56–70 | one-sided white bay stack, yellow tile diamonds (kit: `tilePanels` piers) |
| bellamy-1915-green-tile | Hasebroekstraat 90–98 | single + paired axis, green sill tiles (kit: `tilePanels` sills), pointed gable or dormers |
| bellamy-1916-two-axis | Bellamystraat 22–28 | 2 axes, flat roof |
| bellamy-1895-plain-three-axis | Bellamydwarsstraat 4–12 | BAG renewal year 1928–1935; a dormer with a hoist beam |
| bellamy-1937-flat-row | Ten Katestraat 13–21 | measured storey heights, window heights and head lines |

## Kit additions

- `FrontIntent.tilePanels` (`buildingRecipe/tileAccents.ts`, tested):
  - `place: "piers"` draws measured-tint diamonds between brick courses on every pier of the listed storeys.
  - `place: "sills"` draws square tiles under the sill of the listed axes.
  - Validated. When absent, fit-golden (156 recipes) and the installed chunks are byte-identical.

## Results (final pass)

94 of the 335 pands on the 49 intaked faces are placed. On the exemplar rows:

| Face | Placed | Type | Edge NCC | Held |
|---|---|---|---|---|
| hasebroek-2-46 | 17/18 | balcony | 0.20–0.34 | 2 (16.7 m corner block) |
| hasebroek-1-41 | 16/19 | balcony, 5 storeys | 0.16–0.34 | 5 (NCC 0.13), 27 (0.148), 33 (0.10) |
| hasebroek-52-88 | 8/10 | tile-bay | 0.19–0.24 | 52, 54 (a 1904 front with BAG 1915; no usable photo) |
| hasebroek-43-101 | 9/15 | tile-bay ×8 on 53–67, green-tile on 69 (wrong) | — | 43–51 (no type) |
| hasebroek-90-98 | 5/5 | green-tile | 0.30–0.51 | — |
| bellamyplein-18-38 | 9/11 | balcony | 0.20–0.33 | 28 (NCC 0.08), 18 (width 6.5 m) |
| bellamydwars-4-12 | 5/5 | plain | 0.24–0.49 | — |
| kate-5-21 | 5/7 | flat row | 0.48–0.57 | 7 (12 m double), 5 (orphan) |
| bellamy-18-50 | 3 two-axis on 22–26 | two-axis | — | 28–46 held (no type for the 1990s/1930s infill) |

The remaining 31 faces place nothing; their designs are not in the library yet. They are Bellamystraat 33–141 (mixed
19th century), Wenslauerstraat, Jan Hanzenstraat, Bilderdijkkade and the Ten Katestraat 37–101 balcony rows.

Known false positives that pass the gate (green-tile or two-axis on balcony fronts):

- Jan Hanzenstraat 49–51;
- Ten Katestraat 29–31;
- Bellamystraat 18–20;
- Hasebroekstraat 69;
- Van Effenstraat 7D/9 (correctly green-tile-like; 7D drew tile-bay).

The green-tile / tile-bay split rests on the upper accent share. That share depends on exposure: overexposed strips
read 0.4–0.6 for both types.

## What the kit still cannot say

- **Painted timber oriels** (Hasebroekstraat 56–70): the tile-bay's white bays are drawn as wide dark glass. This is the
  largest likeness gap in the pilot.
- **Hoist-cap dormers** (Hasebroekstraat 56–70): the white cornice with dormers under hoist caps is drawn as a red-tile
  roof face.
- **Window kinds per axis**: the low, wide single-axis window of the green-tile type cannot differ from the pair's
  windows.
- **Double house doors**: drawn as one door.
- **Balcony detection from the strip**: this is what would stop green-tile from taking balcony fronts.

## Next buurt recipe

**Haiku lane, from a list.** Run the survey with `--intake`, then auto-place with the nearest existing library and
`--review`, then calibrate. Report placed and held counts and the faces that place nothing.

**Opus lane.**
- Author types from exemplar strips, measuring storey heights, window heights and head lines: the flat-row NCC went
  from 0.05 to 0.55 on measurement alone.
- Add the kit components the photos need.
- Review the run sheets at gallery size for false positives that pass the gate.
