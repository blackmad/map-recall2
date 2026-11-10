# Bloemgrachtbuurt (AB07) and Elandsgrachtbuurt (AB10): own look, 2026-11-10

Lane `lane/belt-jordaan-eland-20261110`. Strip sheets (photo, model, overlay, strip) are in
`map-recall2-source-data/block-face-strips/{bloemgrachtbuurt,elandsgrachtbuurt}-20261110/<run>/`.

## Why AB10 drew 0 pands while coverage said "authored"

The Jordaan type library (`scripts/block-face/types/jordaan/`) reaches Elandsgrachtbuurt, so coverage reported its look as
authored. But none of its canal faces had ever been intaken, auto-placed or installed, so no chunk pand carried a Jordaan
intent. Nothing was vetoed or held. The pipeline had simply never run there.

Intaking it surfaced a second, centre-wide blocker:

- The Dec 2024 / Jan 2025 panorama days have a green winter cast.
- `isLeaf` (buildingRecipe/measureFacade.ts) reads 20-47 % of those fronts as foliage. That fails the usable-photo gate and drops the measured palette.
- The lane restriped every canal face to looked-at winter dates (2023-03-13 for most faces, 2023-01-16 for Elandsgracht), bringing leaf share under 0.1.
- prinsengracht-306-310 had been on 2023-04-17, a listed but unpublished day that gave a grey strip. It is now on 2023-03-13 (cherry-pick 9c09e2883 = 60bb1bb73).

## Census

| buurt | pands | 1850-1949 | before 1800 | faces | faces intaken |
|---|---|---|---|---|---|
| AB07 Bloemgrachtbuurt | 638 | 387 | 94 | 90 | 60 (579 pands) |
| AB10 Elandsgrachtbuurt | 791 | 495 | 67 | 159 | 36 (339 pands) |

BAG build years in these rows are often restoration years (1940, 1981), not construction dates. A front read as an 18th-century bell
gable carries 1981.

## Types used

- `jordaan-1850-cornice-house`: crowns none, dormer, and new dormer-pair, dormer-low, dormer-pair-low.
- `jordaan-1750-neck-gable`: crowns neck, bell, and new bell-low.

## Placed / held / vetoed

Auto-place cannot read these rows:

- the skyline reads a tile saddle behind a cornice as a bell gable;
- one row mixes 2.4 m and 3.3 m storeys;
- the BAG years mislead.

So every installed run is a hand placement, written by a new script, `scripts/block-face/hand-place.ts`, from
`buurten/<buurt>-hand-runs.json`. Each pand records its reason. Cornice lines read on the strip are pinned as `continuity.measuredEaves`.

| buurt | vetoed before comparison | compared and held | placed (installed) |
|---|---|---|---|
| AB07 | auto-place on the old strips (superseded; removed) | 10 | 21 |
| AB10 | auto-place on the old strips (superseded) | 5 | 8 |

AB07 installed runs (after the Opus strip review, 2026-11-10, and a per-pand storey grid on every pand):

- egelantiersgracht-3-43-h1: 11, 13.
- egelantiersgracht-3-43-h2: 19, 21, 23.
- egelantiersgracht-3-43-h3: 27.
- bloemgracht-90-128-h1: 118-126 (the earlier "94-104" was wrong; BAG numbers 118, 120, 122, 124, 126).
- bloemgracht-4-10-h1: 6, 8.
- bloemgracht-1-51-h1: 7-21.

AB10 installed runs:

- lauriergracht-62-110-h1: 92-102.
- lauriergracht-62-110-h2: 84, 86.
- lauriergracht-62-110-h3: 78, 80.

Held after comparison with the photo:

- Egelantiersgracht 15: the frontage is not one straight surveyed wall.
- Egelantiersgracht 17: a Neo-Renaissance stepped gable with arches.
- Egelantiersgracht 29: a white timber top storey.
- Egelantiersgracht 33A: low infill.
- Bloemgracht 4: its balustraded attic frieze drew as a tile attic, and OSM's cafe drew as a shop window.
- Bloemgracht 10: a red front under a round oculus.
- Bloemgracht 90 and 168084: behind trees.
- 168162: modern.
- 168159: a church.
- Egelantiersgracht 25: behind a tree; its souterrain grid cannot be read.
- Lauriergracht 82: white render over a souterrain; the bel-etage and stoop cannot be read behind the tree.
- Lauriergracht 88: BAG leaves a 0.9 m gap.
- BAG split at Lauriergracht 86/84: BAG leaves a 0.75 m gap where the photo's 86 runs on, so the drawn party wall sits about 0.7 m short. Not fixable in the lane (BAG geometry).
- Lauriergracht 66-68 and 76: 1992 infill.
- 169912: behind a tree.

Not yet authored, though their faces are intaken on good strips:

- Bloemgracht 1-51, 53-95, 80-88 and 138-300;
- Egelantiersgracht 47-101;
- Lauriergracht 1-29, 71-127 and 112-170;
- Elandsgracht;
- Looiersgracht;
- Rozengracht;
- Prinsengracht.

The next lane can author these with the same spec files.

## Kit additions

- **Per-pand storey grid** (`grid: {storeysM, souterrainM?}` in the hand runs, `handPlace.ts`, tested): the floor-to-floor heights read on the strip become the body's `storeyHeights` in metres. A souterrain picks the type's new `souterrain-door-left` ground (`basement: stoop-and-windows`, `souterrain: true`) and its height goes first. This was the main cause of the review's holds: bel-etages over souterrains and 2-3 tall storeys drawn as standard storeys, 0.6-2 m off. Validation: one height per storey (1.8-6 m), the sum 0-2.5 m under the cornice top (frieze tops take up to 2.5 m).
- Cherry-picked kit from lane/belt-gg-zuid-20261110 (9eb2d062e, src and auto-place.ts only): souterrain-first storeyHeights, `countStoreys` eaves pins, `match.typeGround`, sash-4-over-4.
- `scripts/block-face/fit-wall-palette.ts` (fitWallBrick) from lane/buurt-dapper-oosterpark-20261110, identical; used to fit failing walls. It cannot reach the darkest walls (#3c3a3a): `cityWallTint` clamps saturation and lightness, so Bloemgracht 21 stays slightly too saturated.

All of these are typed and tested. Every pre-existing placement compiles byte-identically.

- **Placement roof `rise`**: added to `PLACEMENT_ROOF_KEYS` in houseType.ts. A rise needs evidence (tested in roofSchema.test.ts).
  - Where 3DBAG's p95 sits under 1.5 m above the cornice, it drew a flat roof that the audit flagged as detached. In the photo, a tile face rises behind the cornice.
- **Crowns**:
  - `bell-low`: a 0.8 m crown rise. The stock bell drew 4.3 m against 2.6 m in the photo.
  - `dormer-pair`, `dormer-low` and `dormer-pair-low`.
- **`hand-place.ts`** and `src/canalRecall/blockFace/handPlace.ts`: validation of hand runs, tested in handPlace.test.ts.
- **`faceEvidence`**: now exported from auto-place.ts.

## What the kit cannot say

- Brown-grey roof tile (Lauriergracht 100-102, about #6a625c): the roof materials have no colour; black-tile is the nearest.
- A round-arched door beside a shop front (Lauriergracht 92): a shop ground cannot take `doorArch`.
- Large round-arched ground openings (Lauriergracht 96) draw as round-headed ground windows, narrower than the photo's 2 m arches.
- A white timber ground front on a residential house (Egelantiersgracht 23, Lauriergracht 80's wide shop window): validation refuses a shop front on a residential ground.
- Per-storey bay counts (Egelantiersgracht 23: two wide windows under three).

- Bell crests and small bell tops on white frieze attics (Bloemgracht 94-104). The frieze draws; the crest does not.
- A Neo-Renaissance stepped gable with arched panels (Egelantiersgracht 17).
- A round oculus top (Bloemgracht 10).
- Balustraded attic friezes (Bloemgracht 4).
- Dormer frames on narrow cornice houses. The frame reaches past the dormer wall, and the audit flags it as opening-outside, so three dormers were dropped.
- Dormers on fronts whose surveyed footprint is shallower than the dormer.
- Arched carriage doors. None were placed.
- A painted ground storey alone. `paintedStoreys` z-fights over the brick, so white ground storeys (Egelantiersgracht 27, Bloemgracht 8) are not drawn.
- Glass balconies (Bloemgracht 6).
- Gable sandstone scrolls and cap ornaments.

## Integrator rebuilds

The integrator must rebuild:

- **roof-golden**: `--write` also adds about 50 other lanes' faces, so it was not recorded here.
- covers and check:covers.
- explorer-looks.
- coverage-v1.
- bundles.

`chunkWallExposureData.ts` was regenerated by `--install`.

Stale files:

- The old `-r` run directories and `auto-place.json` from the green-cast strips are stale.
- `buurten/bloemgrachtbuurt-placement.json` reflects that old run.
