# Weesperbuurt (AJ01) and Sarphatistrook (AJ03), 2026-11-10

Lane `lane/buurt-weesper-20261110`, MODEL: opus-class session (sonnet 5.5). Sheets and strips:
`/Users/blackmad/Code/map-recall2-source-data/block-face-strips/weesperbuurt-20261110/` (`sheet-<run>.jpg` = photo, model, overlay per pand;
`held-evidence/` = photo and overlay crops of the runs that were held after review; `strip-dates/` = every candidate strip date looked at).

## Result
**6 pands installed, all Sarphatistrook** (Sarphatistraat 167, 169, 171 and 175, 177, 179: runs `sarphati-163-213-r1`, `-r2`). **Weesperbuurt: 0 installed.**
Neither buurt is a family buurt; the one coherent design is the 1909-10 block of Sarphatistraat 163-193.

## Census (survey `buurten/weesperbuurt.json` 356 pands / 63 faces, `buurten/sarphatistrook.json` 246 pands / 60 faces)
* Weesperbuurt: 275 built by 1945, 114 five-storey pitched 1900-06 pands (5.8 m), 39 four-storey, 39 five-storey flat; the post-war Weesperstraat blocks
  are a handful of huge pands (20-112 m) and are not kit material. Along the ridden streets (Nieuwe Prinsengracht, Nieuwe Keizersgracht,
  Nieuwe Achtergracht, Roetersstraat) the 1890s fronts are individual: every four to six pands change ornament (cream pilaster pairs, dark band
  fronts, step gables, dormer pairs). Strips (all 2021-01-22, the only dates with full coverage besides 2016/2017 summer) are blown out or leafy.
  No family of 4+ identical pands read cleanly: Nieuwe Prinsengracht 64-124 (31 pands) has at least six designs; Keizersgracht 15-69 is a gable row of
  one-offs; Achtergracht 81-117 (2021-01-22 blown out, 2017-07-06 scaffolding and leaves; both strips in `strip-dates/`).
* Sarphatistrook: 198 built by 1945, 93 five-storey pitched 1900-06. Sarphatistraat 25-125 is a row of individual grand houses (viewed, no family).
  Sarphatistraat 163-213 (1909-10, 26 pands, 6.5 m) is one design in mirrored pairs and the family this lane built.

## Type: `sarphati-1910-arched-tower-pair` (`types/weesperbuurt/`)
6.5 m red-brown brick, 4 storeys over a 4.1 m ground storey, cornice at 14.4 m; wide two-light window (2.75 m) beside a narrow one per storey, narrow axis on
the door side, arched house doors in pairs at the party wall (span 1.8, apex 3.75), brick wall dormer (tower) over each door pair, 2.6 m per house.
Measured on a gridded 40 px/m crop (heads 6.6/10.05/13.25, sills 4.5/7.8/11.1, ground windows 1.1-3.5, cornice 14.25-14.75, tower to 17.4).
Door sides are pinned from the strip (`sarphatistrook-review-doors.json`: 163 R, 165A L, 167 R, 169 L ... alternating); the detector read them at
random on this row and edge NCC rose from 0.18-0.30 to 0.35-0.47 after the pins.

## Yield (sarphati-163-213, 16 pands in the face; 26 in the buurt row, 10 not in the discovered face: 195-213)
* vetoed before comparison: 191 (2.8 m frontage), 181 (strip evidence gate, a tree over the front): 2
* compared and held: 163 (face seam, grey no-data band beside it, corner section), 165A (stepped gable and a different window layout), 183 and 185 (a splayed
  bend of the street: curved mansard, no tower, heavy foliage; also a 1.02 m2 roof z-fight), 173 (roof z-fights 0.24 m2 with 171, and the geometry audit
  fails the whole run; lowest NCC 0.17), 187 (shop and garage entrance), 189 and 193 (runs of one): 8, all pinned in `sarphatistrook-review-holds.json`
* placed: **6** on 2 runs. The batch (`batch.ts --install --photo-decides --no-restrip`) passed both runs: NCC min 0.33 / med 0.35, stripOverDrawn 0.85 and 1.20.

## Strip date (looked at before use)
2024-12-11 (the survey's) falls 2.5x in exposure along the face (raw brick medians #c59a6a left, #4d3c22 right): the batch refused it (stripOverDrawn 3.0 and 0.58).
Candidates viewed in `strip-dates/`: 2019-05-14 (leaves), 2022-06-10 (leaves), 2025-06-19 (leaves), 2019-01-10 (fogged, cars), 2021-03-19 (sunlit, cold cast gate),
2020-01-07 (golden-hour tops), **2017-03-31 chosen** (even exposure, bare enough, neutral). Restripping was run with `--no-restrip`.

## Kit and pipeline additions (typed, tested in `src/canalRecall/blockFace/weesperbuurt.test.ts`, byte-identical when absent)
* `match.columnsUnscored`: the strip's window-column count is no evidence where a wide two-light window beside a narrow one reads 3-6 columns on one design.
* `match.frontEavesFixed`: draw every pand at the type's line, never at the strip skyline within 1 m of it (the skyline read 15.1-15.4 m over a 14.4 m cornice and
  lifted single houses); auto-place now writes `measuredEaves` for these types even where 3DBAG is within the minimum delta, so the held neighbours' lower 3DBAG
  eaves no longer pull a house down (175 and 183 were 1 m low in the first sheets).

## What the kit cannot say (photo shows, kit lacks)
* iron balconies on storeys 1-2 under one light of the wide window or both (some houses; slab bracket corbels);
* the speklagen (cream bands) and the dark relief lintel blocks over each window (triangle budget, as Indische);
* the double-leaf arched doors with a fanlight tracery (drawn as an arched leaf);
* a splayed (bent) front with a curved mansard (183|185) and a stepped end gable (165A);
* per-light transoms of the wide window (storeys 1-2 french windows) distinct from storey 3.

## Open problems
* 171|173: equal 3DBAG ridges (18.62 m) make the recipe roofs coplanar across the party wall (roofZFight 0.24 m2, gate FAIL, audit coplanar 0.6 m2). Same
  family of problem as the Vogelbuurt step-gable audit; a roof fix (differing front-roof ridge for a tower pair) would release 173.
* The strip exposure falls 2.5x on 2024-12-11; later panoramas for Sarphatistraat 163-213 are needed for the right half if 2017-03-31 is ever retired.
* Sarphatistraat 195-213 (1910 design, same family on the photo thumbnails) are outside the discovered face: a second intake with `--from=181390` is the next step.

## Integrator rebuild
`npx tsx scripts/look/build-chunk-wall-exposure.ts --write`; covers (`build-covers` then `check:covers`); bake-frontages; buurt pages / explorer-looks;
archive: strips already written to the source-data folder above.

## Round 2 (2026-11-10, after the Opus verdict `sarphati-strip-verdict-20261110.md`)
**Sarphatistrook now has 12 pands installed**: 167, 169, 171, 173, 175, 177, 179 (one run `sarphati-163-213-r1`) and 197, 199 (`sarphati-195-213-r1`), 203, 205, 207 (`-r2`).
Sheets: `block-face-strips/weesperbuurt-20261110/sheet-sarphati-163-213-r1-round2.jpg`, `sheet-sarphati-195-213-r1.jpg`, `-r2.jpg`.

### Verdict fixes applied to the type
1. Roof flat behind the cornice (`roof.form: flat`, source front), towers kept; 2. speklagen as `brickStripes` (band #d4b48c: doubled pair at each head line 6.65 / 10.1 / 13.3 m,
one at each sill 4.5 / 7.8 / 11.1, a single course every 0.8 m between; about 2,300 triangles a house, under 3,000);
3. the wide axis is two casements (1.1 m, 0.3 m pier) on a five-axis grid (blank margin, light, light, blank, narrow), ground storey two tall windows, door index 2 with `doorArch`;
4. a projecting cornice `eavesOverhang` 0.4 m, #e2dccb. The tower cap stays a flat slab: `TOWER_CAPS` has no cornice cap (a kit gap, below);
5. eaves: 167-171 stood 1.07 m high because their own 3DBAG ground (0.30 m NAP) sits under the strip's ground (1.405 m): `withPhotoEaves` now offsets the measured row by that gap
for `frontEavesFixed` types (`PandEvidence.groundNAP`, auto-place.ts), so all seven read 14.14-14.41 m (173: 3DBAG eaves 8.68 m).

### 173 released
The 171|173 coplanar roof was the 30 degree recipe attic over equal 3DBAG ridges; the flat front roof removes it (roofZFight 0, GLB audit pass), so no party-wall offset kit was needed. 173 is installed.

### 195-213 (intake `--from=181390`, strip 2017-03-31, looked at)
Vetoed before comparison: none. Compared and held: 195 (end of strip, run of one), 201 (usable photo 37 %), 209 and 211 (the splayed bend, as 183|185), 213 (corner house, taller tower): 5.
Placed: 5 on 2 runs (batch NCC min 0.40 / 0.41, stripOverDrawn 0.85 / 0.97). Door pins 197 R, 199 L, 201 R, 203 L, 205 R, 207 L. The strip is darker with a green-grey cast
(raw brick #5a553b; the trim-normalised wall was #0f1104 on 199), so the brick is pinned per run (`sarphatistrook-review-palettes.json`: #5a4636 for 197-199, #4a3a2c for 203-207).

### Open
* the 205|207 interference sheet row reads FAIL (roof z-fight 0.2 m2 at the tower pair; 175|177 also 0.2 earlier) while the batch and the GLB audit pass: check before merging.
* the tower cap needs a `cornice` cap (white dentil band): a `TOWER_CAPS` addition in the library tower code, not done.
* balconies, fanlight tracery and the corbel blocks at the window heads remain.

## Round 3 (2026-11-10, house line): 17 pands ready for chunk install, nothing installed by the lane
The branch's own chunk installs (`chunk-face-sarphati-*`, 3 GLBs and their chunks.json rows) are removed from the branch; the integrator
installs the runs below. Specs and readings: `scripts/house-specs/weesper-20261110/` (`readings.json` -> `make-specs.py` -> `specs/`).

### Why chunks, not the per-house recipe route
I first staged 22 author specs with `house:stage` (each resolves to the recipe route, one `spec-<pandId>` house). Rehearsing publish step 3
(`install.ts`) locally, 21 of 22 failed the per-house recipe gates: `ridge-vs-3dbag` / `eaves-vs-3dbag` (the faces draw photo-measured eaves
and the roof read off the front, 3DBAG only an upper bound; the face gates know this, the recipe gates do not), `open-edges` (party walls the
face trims against its neighbours), `no-floating-parts`, `footprint-vs-bag`. A new recipe house that fails stops `house:publish`, so the
staged files are withdrawn (kept in `artifacts/house-specs/unstaged-weesper/`), and the author readings moved into the face intents
(per-house `overrides.balconies`, a `domed-dormer` crown, `doorBay`), which the chunk compile reads. This matches what the integrator did for
H7 r3 (Nassaukade 145-152 as a chunk). House-line gap for the integrator: block-face pands need either a chunk route in `house:publish` or
recipe gates that read `facts.roofSource` the way the face gates do.

### Pipeline fix kept: a face pand on the recipe route compiles from the face-planned facts
`resolved.ts` and `house:publish` step 3 gave a new `spec-<pandId>` house the face's raw `pands/<pand>/facts.json` (3DBAG LoD2.2 roofs).
Sarphatistraat 169 drew a 3 m slate slope and a side wall up to the 3DBAG ridge over a front whose type says `roof.form: flat`.
`scripts/house-specs/face-facts.ts preparedFaceFacts` returns the facts the face itself compiles from (`prepareFaceFacts`: recipe roof read
off the photo, measured eaves, shared street ground) for the face whose intent lists the pand; both callers take it first (`FACE_FACTS=raw`
keeps the old copy). Pinned in `weesperbuurt.test.ts`. Pands on no face intent are unchanged.

### Ready for install (compile.ts --face=<run> --install; all gates pass unless noted)
| Buurt | Run | Pands | Lane changes this round |
|---|---|---|---|
| Sarphatistrook | `sarphati-163-213-r1` | Sarphatistraat 167, 169, 171, 173, 175, 177, 179 | iron balconies on storeys 1-2: inner light of the wide pair (167, 171, 173, 175), both lights (169, 177, 179) |
| Sarphatistrook | `sarphati-195-213-r1` | 197, 199 | balconies under the inner light (GLB audit holes: all on party planes, as installed before) |
| Sarphatistrook | `sarphati-195-213-r2` | 203, 205, 207 | balconies under the inner light. **Interference 205|207 roof z-fight 0.2 m2 FAILs `--install`**: needs `--force-install` (round 2 installed it so) or a hold of 207 |
| Plantage | `polaklaan-2-42-r1` | Henri Polaklaan 26, 24 | split from the round-3 run around held 22; strip bricks dropped for the type's #85503f |
| Plantage | `polaklaan-2-42-r2` | Henri Polaklaan 20, 18, 16 | as r1; 16 keeps its painted #46474a |

Balcony `bays` in a face override are type coordinates (mirrored houses flip them): inner light [1], both lights [0, 1].

### Held, with reasons
* Plantage Badlaan 6-14 (5, `badlaan-4-24-r1`): the chunk's GLB audit fails with or without this round's changes: 5 detached parts
  (24 m2 each, hovering 0.10 m: the roof planes over the entablature) and 2 dormer frames through the roof plane (`opening-outside`). The
  readings are in the intent (domed-dormer crown, balcony stacks on 10 and 8A, 8A's door right); the type needs the roof seated first.
* Henri Polaklaan 22 (0363100012181398): a flat white cornice with a chimney lantern, no point gable: not the point-gable row the type was
  placed on in round 3. Out of the runs, in `plantage-review-holds.json`.
* Plantage Kerklaan 24, 26 (`kerklaan-2-34-r1/intent.held.json`, so build-house-specs does not publish an unreviewed record; with it
  `house:publish --dry-run` refused the batch as drift): photo cornice 17.0 m over 3DBAG eaves 15.4-16.4, the front draws a storey short.
  Needs eaves pins and an auto-place rerun of the Plantage buurt, which rewrites every placed Plantage intent.
* Sarphatistraat 189 (slate mansard and dormer behind the cornice, not the type's flat roof), 183/185 and 209/211 (splayed bend), 187 (shop
  and garage, taller pyramid-roofed tower), 181 (tree), 163, 165A, 191, 193, 195, 201, 213 as in rounds 1-2.
* Weesperbuurt: still 0. Nieuwe Prinsengracht, Nieuwe Keizersgracht, Achtergracht and Plantage Middenlaan 1-27 change design every one to
  three pands; no family to type.

### What the kit still cannot say
* Sarphati: the corbelled dark lintel blocks over every window; double-leaf arched doors with fanlight tracery; the tower's white cornice cap
  with dentils (`TOWER_CAPS` has none); the balcony slab's two stone corbel brackets.
* Badlaan: flat corbelled brick lintels (drawn as a segmental ring); white console blocks beside the window heads and under the balcony slabs
  (Badlaan 10); domed dormer hoods with a finial (`arched` draws a wider dome than the photo's).
* Polaklaan: scrolled white finial and moulded coping on the rakes; a pointed (lancet) gable window with tracery; fanlight tracery.

### Frames (house:frames, H10)
Before: default world (generic). After: the runs installed locally (uncommitted) and `?world=live`. See the hand-back for folders.

### After frames re-taken (2026-11-12, `artifacts/house-frames/fix-after`)

- Henri Polaklaan 16-26 (5 pands), after the palette fix: the fronts now read red-brown against the red-brown photos,
  with three-light storeys, point gables and white frames. The flags are advisory:
  - `roofOffset` on 26 and 20: the game skyline is about 1.2 m under the photo crown (13.6 m and 13.0 m against
    14.8 m). The gable apex of the type sits low, which is a kit gap and not a hold.
  - `wallColour` on 18 (181400): the photo has 18 darker than its neighbours and the game has it lighter. It is the
    type red. A measured per-house tint would need a summer strip.
- Sarphatistraat 173 (170733) still frames the wrong building, even with bearing 341. The panorama picker chooses a
  Valckenierstraat pano 22.9 m away (otherBuilding 0363100012570341). It needs an `at` point on Sarphatistraat in the
  `--list` entry. The weesper-after sheet shows its chunk front correctly from the canal side.
- Never wrap `frames.ts` in `/tmp/canal-pw.sh`; it takes its own slot. On 2026-11-12 nested wrappers from several
  lanes held all three slots for over 30 minutes.
- Contact sheets: `block-face-strips/{weesperbuurt,plantage}-20261110/house-frames/`.
