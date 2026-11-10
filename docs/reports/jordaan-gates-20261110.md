# Jordaan compile gates, 2026-11-10 (lane/jordaan-gates-20261110, follow-up to #113 round 2)

Dry run only: nothing installed, no manifest write. Batch report `scripts/block-face/batch/jordaan-gates-20261110.{json,csv}`
(`batch.ts --buurt=bloemgrachtbuurt --district=jordaan`, all 63 faces, 65 runs). Tabulation by
`scripts/block-face/libs-report.ts`. Strips: `map-recall2-screenshots-a1/buildings/2026-11-10-jordaan-gates/`.

## 1. Measured causes (before any change; main 08675cda4)

| run | failing gate | measured vs threshold | root cause | verdict |
|---|---|---|---|---|
| rozengracht-30-82-r1 (168605) | storey-height | [2.872, 2.281, 2.196] m, upper >= 2.3 | type param | the neck gable's weights 3.4/2.7/2.6 (sum 8.7) scale to a 3DBAG eaves of 7.55 m: top 2.60 x 0.868 = 2.26 |
| bloemgracht-16-32-r1 (173350) | storey-height | [2.948, 2.375, 2.211] at eaves 8.03 | type param (same) | same |
| lelie-83-141-r2 (169849) | storey-height | [2.972, 2.394, 2.229] at eaves 8.09 | type param, **cornice house** (3.6/2.9/2.7 resized to 3 storeys) | not fixed, see 3 |
| bloemgracht-16-32-r1 | strip-over-drawn-high | 3.041 vs 0.8-1.25 | data: the 2023-03-27 strip is washed out (white sky over every roof, walls near white on the right house); the strip-quality check reads blown 0.197 < 0.4 | **gate right**; 2024-12-16 re-strip is also hazy; held |
| bloem-128-206-r1 (174650) | roof-behind-crown | roof 0.11 m over the crown at x = 4.25 (limit 0.05); roof-under-crown front view 0.21 (limit 0.10) | **measurement/geometry bug**, roof | see below |
| lelie-83-141-r1 (168148) | roof-behind-crown | 0.08 at x = 3.15; front view 0.17 | same | same |
| bloemgracht-80-128-r1 | glb-audit | `opening-outside` 1 of 120 parts, 0.396 m2, a frame at (-2.8, 15.1, -0.3); `geometry-regression` 1 > baseline 0 | wrong placement: cornice house drawn with **5 storeys**, the strip shows ground + 3 (rows 3,3,3 plus the dormer), eaves 14.4 m at the type's 3.13 m pitch reads 5 storeys of 2.88 m, the photo has 4 of ~3.5 m; the dormer frame pokes through the 2.0 m crown rise | **gate right**; held |

### roof-behind-crown, the numbers

Bloemstraat 174650 (neck gable, skyline unread, crown from the type): the saddle is built `saddleUnderProfile` 3 cm under every
crown vertex (ridge 13.549 m, pitch 63.3 deg, centre 2.65 m), and the compiled crown wall equals the profile vertex for vertex.
But the saddle's depth axis is the BAG outward normal (`recipeRoof.ts` `inward = nIn`), while the crown stands on the chord
between the frontage endpoints. They differ by ~0.55 deg (`lean` 0.05 m over the 5.3 m chord, under the `chordDriftM + setback`
threshold that squares attic roofs). At 10-12 m depth the ridge drifts 0.1-0.12 m sideways; the flank is 1.98 m/m steep, so
the right-hand plane stands 0.19-0.23 m above where the profile fit put it (measured: roof = 13.549 - 1.986 (x - 2.65) on the
left, +0.2 m on the right at every depth), over the concave shoulder. Gate and fit are right; the roof was built in the wrong
frame. `squareToChord` existed for attic faces only.

## 2. Changes

1. `RoofIntent.squareSaddle` (typed, validated, opt-in; `recipeRoof.ts` `RecipeRoofInput.squareSaddle`, `compile.ts`): a saddle
   band's depth axis is square to the frontage chord whenever the BAG normal leans off it by > 1 cm. Absent = byte-identical
   (roof golden: only faces whose type sets it change). Set in `roof` of `jordaan-1750-neck-gable` and `jordaan-1900-gable-rebuild`.
   bloem-128-206-r1 and lelie-83-141-r1 now pass both roof gates.
2. Neck gable and gable rebuild storey weights 3.4/2.7/2.6 -> 3.1/2.65/2.65. Measured fronts: Bloemgracht 80-128 / 16-32 type
   evidence ground 3.4 m at eaves 8.8 (-> 3.25 m now, within 0.15 m); Rozengracht 38 ground top 2.87 m, photo row pitch 2.1-2.3
   m (model 2.79 / 2.38 / 2.38); Bloemgracht 16-32 173350 rows 4.2 -> 6.5 m (2.3 m). At the type's lowest matched eaves of
   7.5 m the top storey is now 2.37 m (was 2.25), so the gate passes for every 3-storey front the type can match
   (7.29 m is the floor); unit test `jordaanGates.test.ts`.
3. Neck gable `match.eavesM` [7.5, 12.5] -> [7.5, 9.3]: it only sets the storey pitch (3.33 -> 2.8 m, the gable rebuild's value, 3
   storeys at 7.5-9.6 m, 4 above): a 10 m front read as three storeys of 3.3 m before. Moves auto-place scores only.

Not changed: the storey-height and roof gates, the strip-quality and stripOverDrawn thresholds, any baseline.

The coordinator's vision spike (placed types' storey count right only 62 %, usually one too high) is mostly De Pijp/5-storey
types; for the Jordaan it agrees with the one clear case here: Bloemgracht 80-128 cornice house 5 vs 4. No Jordaan label in
its 53 gold crops decides the neck-gable weights, so the numbers above come from the Jordaan fronts' own measurements.

## 3. Installed output that changes

Only `bloemgracht-138-300-r1` (installed chunk `chunk-face-bloemgracht-138-300-r1`), pand **174748** (neck gable, 4 storeys, bell
crown, eaves 11.771 m): storey heights [3.51, 2.79, 2.79, 2.68] -> [3.25, 2.78, 2.78, 2.78] (ground 0.26 m lower, top 0.10 m
higher) and its saddle squared to the chord. 174831 / 174832 (cornice house) are byte-identical. Sheets BEFORE (installed GLB) and
AFTER beside the photo: `bloemgracht-138-300-r1-installed-BEFORE.png`, `...-AFTER-storey-weights.png`. No other installed pand
uses these types (other faces with the types in `faces/*/intent.json` are not in `chunks.json`). Roof golden intent hashes
change for the 8 faces that use them: bloem-128-206-r1, bloemgracht-138-300-r1, bloemgracht-53-95-r1, lelie-150-194-r1,
lelie-83-141-r1, lelie-83-141-r2, prinsengracht-130-150-r1, rozengracht-30-82-r1.

## 4. Dry run after the fixes (63 faces, 62 intaked, 495 pands)

vetoed before comparison 212, compared and held 260, placed by auto-place 23. Intake failed on 4 faces (bloemgracht-32-74,
bloemgracht-167-179, prinsengracht-156-172, rozengracht-116-138: frontage/sightline errors, unchanged). **3 runs (6 pands) pass every
gate**: bloem-128-206-r1, lelie-34-84-r1, lelie-83-141-r1. Round 2 on the 15-face subset: 0 runs. Remaining run failures:
bloemgracht-80-128-r1/r2 glb-audit (and r1 stripOverDrawn 1.675), rozengracht-160-222-r1 glb-audit, rozengracht-30-82-r1
stripOverDrawn 0.531 (bare trees over every wall; "no tree-free pand in the row"), bloem-3-25-r1 and bloem-95-99-r1 likeness
(NCC 0.142 / 0.146 < 0.15), bloemgracht-16-32 held by evidence/NCC (washed-out strip), lelie-83-141-r2 storey-height (cornice house, 3 storeys, top 2.23 m;
the weights 3.6/2.9/2.7 have the same ground-heavy shape; the photo row pitch is 2.3 m so the gate flags a real low top storey,
not a wrong fit; left because the cornice house's installed pands cite its ground 3.6 m, a per-count weight table is the fix).

## 5. Strips of the would-place runs, and why none should be installed

All three pass the gates but the strips do not support them (viewed at gallery size):

- **bloem-128-206-r1** (174650, 167881): the photo is a tight crop of a near front, 2.5 storeys and no roofline; the model draws a
  plain attic house, the neck gable is not visible in the photo at all (skyline confidence 0.06). NCC 0.197. Reject.
- **lelie-34-84-r1** (173046, 173047): 2020-04-24 strip with a bonnet in the foreground, close oblique crop of the ground and first
  storey; the model draws two bell gables not visible in the photo. Reject.
- **lelie-83-141-r1** (168161, 168148): dark winter strip; the roofline of 168148 shows a chimney/stepped top, the model a plain attic
  house; 168161 reads a flat cornice. NCC 0.206 / 0.32. Weak; reject unless the review reads otherwise.

The evidence gate (sky over the roof in >= 75 % of columns) does not catch a close crop that shows a facade fragment under bright
sky. A rows-vs-model check (the review's `rows above ground` already flags these: bloem-128-206 `3,3,3 vs 3,3` etc.) is the next
gate worth adding; not added here (needs a calibration sample).

## KIT CANNOT YET EXPRESS

- A storey-weight table per storey count (low 3-storey Jordaan fronts want a shallower ground than a 5-storey cornice house).
- Stepped/flat-topped 19th-century attic fronts (Bloemgracht 80, 168078 straight-lintel front with a stepped parapet) drawn as bell gables.
- Pointed Neo-Renaissance gables with long steep rakes (Bloemgracht 82, 1876): cornice house + dormer is wrong.
