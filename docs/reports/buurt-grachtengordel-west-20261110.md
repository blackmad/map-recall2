# Grachtengordel-West: Felix Meritisbuurt (AC03) and Leliegracht e.o. (AC02), 2026-11-10

Lane `lane/belt-gg-west-20261110`, MODEL: opus. New library `scripts/block-face/types/grachtengordel-west/` (4 types).
Kit additions: attic lights in an entablature frieze, three reviewer type-pin fields, and a souterrain-aware storey resize.
**6 pands installed** in two runs, one per buurt:

- Herengracht 92-96 (AC02);
- Keizersgracht 254-258 (AC03).

Sheets and strips are in `/Users/blackmad/Code/map-recall2-source-data/block-face-strips/{felix-meritisbuurt,leliegracht}-20261110/`.

## Census

Survey with `buurt-survey.ts` (BAG units in the buurt):

- **Felix Meritisbuurt:** 570 pands, 532 built by 1945, 68 proposed faces.
- **Leliegracht e.o.:** 395 pands, 62 faces.

The BAG year band is no use here. BAG dates the cores (1600-1750), while the fronts are 18th- and 19th-century refacings.
The register is the better census. Gables per `monument-facts.json`:

| buurt | monuments | cornice | neck | bell | plain | step | spout | none |
|---|---|---|---|---|---|---|---|---|
| Felix Meritisbuurt | 336 | 180 | 56 | 56 | 7 | 4 | 0 | 33 |
| Leliegracht e.o. | 224 | 117 | 33 | 28 | 15 | 2 | 1 | 28 |

Most cornice monuments date their facade XVIII, XVIIIb, XIXA or "plm 1800". Their elements: `corniceConsoles` 101, `attic` 33, `stoop` 32, `doorSurround` 30, `dormer` 28.
So the largest family is the 18th-century cornice house. The second is the neck and bell gable.
On the strips, though, almost every front is its own design: one row, one design per pand.

## Intake

Intake covered 21 canal faces (from `--intake --only`), with two problems:

- **Overpass is rate-limited.** It took 3-5 minutes a face, about 2.5 hours in all.
- **Grey strips.** Panorama days 2023-04-03, 04-11 and 04-17 are listed but answer 404, so those strips came out solid grey. I cherry-picked 9c09e2883 and re-intook those faces.
  - The grey keizersgracht-174-198 and -326-380, and the unfinished leliegracht-38-60 and prinsengracht-285-339, were removed and are **not committed**. They need intake again.

The canal strips are often ghosted. The quay panoramas stand 5-8 m from a 16-20 m front, and the median fuse of three close panoramas doubles the window grid (Herengracht 150-168, 234-298, Keizersgracht 92-172).
The clean strips are the 2021-01-22 and 2021-01-25 days: Herengracht 84-148, 229-261, Keizersgracht 240-312.

## Types (all measured on gridded 2x crops, `grid-crop.ts`)

1. **`ggw-1740-frieze-cornice`.** Measured on Herengracht 92 and 94, 2021-01-25 strip.
   - Souterrain and stoop; bel-etage windows 2.0-5.4 m; rows 6.2-8.6, 9.3-11.1 and 12.0-13.7 m.
   - A 2.3 m white entablature from 14.2 m, with one 1.1 x 0.45 m attic light per axis.
   - 2-over-2 sashes with white sills.
   - Crowns: `none`, `crest` and `pediment`, pinned per pand. The canal trees defeat the skyline, so it has no crownMatch.
2. **`ggw-1700-neck-bell-gable`.** Measured on Herengracht 251 and 261, and Keizersgracht 256.
   - Crowns: `neck` (rise 1.05 upper storeys, about 3.0 m on Keizersgracht 256), `bell`, and `low-bell` (Keizersgracht 254: a broad raised bell about 2 m high with a round cap).
3. **`ggw-1760-plain-cornice`.** Measured on Keizersgracht 258.
   - Ground openings 1.9-5.0 m; rows 6.0-8.6, 9.0-11.0 and 11.5-13.0 m; a plain white cornice at 14.5-15.2 m.
   - Full white frames; roof `source: front`.
4. **`ggw-1740-crest-attic`.** Measured on Keizersgracht 244 and 246.
   - Six-pane windows, a white attic band with lights, and a crest.
   - Authored, but it **placed nothing** (see the holds).

## Yield

AC03 counts cover the 7 faces run through auto-place (89 pands). AC02 counts cover the 5 faces run (55 pands).

| outcome | AC03 | AC02 |
|---|---|---|
| vetoed before comparison: year, frontage or material (wide double fronts, 1880-1905 BAG years, 1.7-3 m slivers) | ~45 | ~20 |
| vetoed before comparison: strip evidence gate (ghosted or close strips, no sky over the roof) | ~8 | 6 |
| compared and held: score under 0.7 (one-off designs) | ~25 | ~20 |
| compared and held: likeness (edge NCC under 0.15) or a run of one | 6 | 4 |
| compared and held: lane review (`*-review-holds.json`) | 5 | 4 |
| **placed and installed** | **3** | **3** |

Installed:

- **`herengracht-84-148-r1`** (AC02): Herengracht 96, 94 and 92.
  - All gates pass, after the attic-light z-fight fix below.
  - Triangles: 2361 / 1813 / 2187.
  - Herengracht 92 and 94 both fit within 0.05-0.1 m on every row.
- **`keizersgracht-240-312-r1`** (AC03): Keizersgracht 258, 256 and 254.
  - All gates pass; 1748 triangles on 258, the others under 3000.
  - The rows fit within about 0.1 m.
  - 256 has a reviewer house-ground pin: BAG lists `bijeenkomstfunctie`, but the strip shows a door and two tall windows.
  - 254 has a cream paint pin (`painted-brick`).

`roof-golden.ts --write --face=<run>` was run for exactly these two faces. The full `--write` would also have recorded about 70 other lanes' uninstalled run faces, so I reverted it.

## Holds (lane review)

- **Keizersgracht 246 and 244** (twin Louis XIV fronts): edge NCC 0.13 and 0.12, with the glazing storey band off by 0.27.
  - The kit's crest is a small blob.
  - The real attic is a carved crest spanning the front with an oculus. Hold for a crest-attic kit part.
- **Keizersgracht 260:** a tall bell gable with a carved cap. It was placed only as a run fill, unread.
- **Keizersgracht 252:** a low cornice with a dormer and a shop pui. No type.
- **Keizersgracht 250 and 242:** neck gables that fail likeness (NCC 0.121 and 0.144). The glazing band is off: the model draws the storeys under a lower gable foot than the strip.
- **Keizersgracht 248:** white stucco. Its usable photo is 30 %.
- **Herengracht 90:** a plaster cornice front with a shop pui and a low attic.
- **Herengracht 88:** black-and-white banded speklagen.
- **Herengracht 84:** a step gable with speklagen.
- **Herengracht 116:** a five-axis heavy frieze.

## Kit additions (typed, tested in `src/canalRecall/buildingRecipe/grachtengordelWest.test.ts`)

- **`friezeVents.sill` and `friezeVents.light`** (`buildingRecipe/friezeVents.ts`): an attic light standing inside an entablature frieze.
  - `sill` gives the light's foot above the entablature foot; it replaces `drop` and is validated against the frieze.
  - The light is drawn as a frame of four bars 7 cm proud round a dark pane 3.5 cm proud.
  - A solid panel with the pane 3 mm proud failed the GLB audit `zfight` (2.9 m2).
  - Absent, or with the Helmersbuurt `drop` form, it is byte-identical: `test:building-recipes` 497/497.
- **Reviewer type-pin fields** (`blockFace/reviewCrowns.ts` TypePin, `autoPlace.ts` decidePand):
  - `accept: true` places the one pinned type under the 0.7 score threshold; vetoes still hold.
  - `storeys` is the reviewer's storey count.
  - `houseGround: true` draws the type's ground where BAG or OSM list a trading use.
  - Why: on canal one-offs the skyline reads trees, and a gable house's 3DBAG eaves sits inside the gable, so the scored criteria hold fronts the strip shows plainly.
  - Absent, decisions are unchanged: `test:block-face` 336/336.
- **`resizePerStorey`** (`blockFace/houseType.ts`) now keeps a souterrain weight first when the list is one longer than the storey count.
  - Before, a 4-storey souterrain type drawn with 3 storeys failed validation.

## What the kit still cannot say

- **Roofs.** The roof over a cornice front stands as the 3DBAG-capped attic. The quay camera sees no roof face, but the ortho sheet shows a red band over the cornice.
  - `hip: front` drew a pyramid that the strip never shows, so it was reverted.
  - `roof.source: front` on the plain-cornice type still drew the band.
- **Carved Louis XIV crests and attic lucarnes** with an oculus (Keizersgracht 244-246, 260, Herengracht 92). The gablet crest is a small blob.
- **The pediment over three axes** (Herengracht 96) is drawn as the small gablet pediment.
- Cornice consoles between the attic lights; the stoop's iron railing; first-floor iron balconettes (Keizersgracht 258).
- Eared, broad white window frames (drawn as `full-frame`); white pilaster door surrounds with fanlights (drawn as a plain door and transom).
- Ornamented neck flanks (claw pieces, wings) on Keizersgracht 256; `gableOrnament` was not used here.
- Black-and-white speklagen fronts (Herengracht 88, 84) within the triangle budget.
- **Ground storeys.** The door sits at street level beside raised window sills. The strip's ground line on these canals sits 1-1.5 m under the visible floor, so the reveal and stoop heights are not measured.

## Next

- Intake the remaining faces: Prinsengracht 285-339, 341-439 and 455-495; Keizersgracht 174-198, 197-231, 233-281, 307-357 and 326-380; Leliegracht 1-60.
- Use an area Overpass file (`BLOCK_FACE_OVERPASS_AREA`) to cut the 2.5 h intake.
- Pin types per pand from the strips. On these canals, auto-place without pand pins places nearly nothing correctly.
- Restripe the ghosted faces with `--date=<a 2021-01 day>` (`--span-date` per pand), and look at those strips before using them.
