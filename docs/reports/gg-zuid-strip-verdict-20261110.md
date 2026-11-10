# Keizersgracht 616A, 614, 610 and 608: strip review, 2026-11-10

Reviewer: Opus strip reviewer. Sheets: `vijzelstraatbuurt-20261110/keizersgracht-596-648-r1-sheet.png` (616A, 614) and
`-r2-sheet.png` (610, 608), from 10:01. I compared the photo and the model side by side, used the overlay panels, and zoomed in on the stoop and
basement level and on the upper sashes. Hex values are strip medians.

The lane already knows two things, and I do not count them against any pand: the red recipe roof shows above the frieze cornice where the photo has sky, and the thick white frames and eared surrounds are missing.
Both stay on the fix list, because they are visible.

## Verdicts

| Pand | BAG | Verdict |
|---|---|---|
| Keizersgracht 616A (office + dwelling) | 175655 | **install-with-fix**: the entrance is on the wrong level |
| Keizersgracht 614 | 175654 | **install-with-fix**: the entrance is on the wrong level |
| Keizersgracht 610 (office) | 167896 | **install-with-fix** |
| Keizersgracht 608 (neck gable) | 176066 | **install-with-fix** |

None is an install as it stands. The two r1 houses must not install until their doors move.

## Keizersgracht 616A and 614: the entrance is in the basement, not at the bel-etage

On 616A and 614 the photo shows **no stoop door**. In both houses the bel-etage is all windows, and the entrance is a
door at street level in the stone base. The model puts a stoop door at the bel-etage instead: on the left for 616A, on the right for 614.
The "ground bays 1 vs 3 below 6.9 m" gate failure is this error.

- **616A:** the bel-etage needs **three windows**; the model replaces the left one with the door. In the base, the **door is at the left**, in a cream surround with lamps
  either side. The two basement windows at the centre and right match.
- **614:** the bel-etage needs **two windows**; the model replaces the right one with the door. In the base, the window is on the left and the **door on the right**. The model draws
  only the window.

**616A, other fixes:**
- **Base:** the photo base is dark grey stone, `#524e4b`, and the model base is cream, `#d6d1be`. Use **`#878279`**.
- **Frieze and entablature:** the photo is sandstone, `#b1a384`, and the model is near-white, `#e9e5d9`. Use **`#c7bda6`**. The modillion band is the listed limit.
- **Panes:** the upper sashes are **three lights wide**, six-over-six on the second and third storeys. The model draws two-wide, eight-pane sashes.
- Hide the red roof behind the entablature (known). Add the eared surrounds and thick frames on the top two storeys (known).
- Brick passes the gate: the photo is `#6d5d57` and the model `#73625b`.

**614, other fixes:**
- **Base:** the photo is a light grey render, `#858988`. Use **`#a5a69e`**.
- **Bel-etage sashes:** these are large **one-over-one** sashes; the model draws eight panes.
- Frames and eared surrounds are known.
- Its roof shows no red, which is correct.
- The tall band of vertical stripes above the cornice in the photo is the modillion soffit seen from below and stretched by rectification. The model's 2.4 m frieze is an acceptable reading of it.

## Keizersgracht 610

- **Door:** the stoop door is at the right of the bel-etage, with a white pilastered surround (listed limit). The model matches.
- **Panes:** the photo has **cross windows, two by two with one transom**, and a single wide light under a top light on the top storey.
  The model draws eight-pane sashes. Change them to the cross window.
- **Window heads:** against the photo frames, the upper rows sit about **0.6–0.9 m low**. Part of this is the missing thick frames, which are known.
  The photo glass on the second and third storeys is also taller. Raise those heads by about 0.6 m.
- **Base:** the photo is grey stone, `#716d64`, and the model cream. Use **`#999588`**.
- Hide the red roof (known). The frieze tone (`#d7cab2`) is close enough.
- Brick passes the gate.

## Keizersgracht 608 (neck gable)

- **What matches:** the neck width (about 3.1 m), the shoulder line, the door at the left of the bel-etage with its stoop, three axes, two basement
  windows on the right, and the brick.
- **Panes:** the photo has **three-wide sashes**, six-over-six with taller sashes on the third storey. The model draws two-wide.
  The top-storey centre window is a white two-by-three casement, which is optional.
- **Window heads** are about 0.6–0.9 m low against the photo, as on 610. Raise them by about 0.6 m.
- **Gable window:** about 1.5 m wide in the photo, two lights. The model's is about 0.9 m wide. Widen it.
- **Claw pieces:** the photo's sandstone scrolls are about 2 m tall; the model's cream quadrants are about 1 m. Enlarge them if the kit's claw
  height is a parameter. The sculpted cartouche in the neck and the crowning ornament above it are kit gaps.
- **Base:** use `#999588`, the same value as 610.

## What the kit still cannot express

- A street-level entrance in the stone base under an all-window bel-etage. If the canal-house kit only places
  doors at the stoop, this is the gap to add in this lane.
- A modillion entablature.
- Eared surrounds and thick white frames (known).
- The neck-gable cartouche and crowning ornament, and claw scrolls about 2 m tall.
