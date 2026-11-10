# Landlust-Zuid round 3 strip verdict (by eye), 2026-11-10

Reviewer: Opus strip review.
- Lane: `lane/buurt-landlust-20261110` at eae024e4a.
- Sheets: `block-face-strips/landlust-20261110/round3-stage/` (all 20 runs read).
- Round 3 adds:
  - zinc box dormers on the tile-pair, three-axis and erker types;
  - `extraDoorBays` and `doorPairs` under a `groundCanopy` on the two slot-block types.

## Verdicts

| Run | Verdict | Why |
|---|---|---|
| andringa-1-31-r1 | **REINSTALL** | Door pairs (see slot blocks below) |
| andringa-4-32-r1 | **REINSTALL** | Door pairs |
| callenburg-2-32-r1 | **REINSTALL** | Door pairs |
| callenburg-2-32-r2 | **REINSTALL** | Door pairs |
| callenburg-3-63 | **REINSTALL** | Door pairs. The brick pin and eaves clamp hold: one wall tone and one eaves line across all 8 pands. |
| haen-3-31-r1 | **REINSTALL** | Door pairs |
| haen-3-31-r2 | **REINSTALL** | Door pairs |
| haen-6-62-r1 | **REINSTALL** | Door pairs |
| haen-6-62-r2 | **REINSTALL** | Door pairs |
| haen-6-62-r3 | **REINSTALL** | Door pairs |
| zwijgerlaan-225-279-r1 | **REINSTALL** | Door pairs |
| zwijgerlaan-225-279-r2 | **REINSTALL** | Door pairs |
| coppelstock-25-55-r1 | **REINSTALL** | One dormer per pand, roughly centred, as in the photo. All 7 mirrors now match (door and wide window swapped as pinned). |
| haring-26-38-r1 | **REINSTALL** | One dormer per pand, at the photo's positions (34, 072687, 071938). |
| leijnsen-2-30-r1 | **REINSTALL** | One dormer per pand. A full-resolution crop of the photo roof band confirms a dormer on every pand, including pands 1 and 4 behind the trees. Doors and mirrors match on all 6 pands. The holes FAIL predates this change. |
| leijnsen-2-30-r2 | **REINSTALL** | Dormer on 137482 confirmed; 117865 is behind a tree but consistent with the row. |
| treslong-5-19-a | **KEEP current install** | The dormers are wrong (see below). Mirrors match on all 4 pands, and 151495 is no longer blue-grey. |
| treslong-5-19-b | **KEEP current install** | The dormers are wrong. Mirrors match. |
| treslong-21-35-a | **KEEP current install** | The dormers are wrong. Mirrors match. |
| treslong-21-35-b | **KEEP current install, plus a mirror fix** | The dormers are wrong. **111921 is mirrored the wrong way.** Its intent has `mirror` unset, so it draws wide window left and door right; the photo has the narrow window and door on the left and the erker on the right. In the original 5-59 face it was mirrored. The split into 4-pand faces in round 2 lost that, so the current install is wrong too. Pin `{pandId: 0363100012111921, mirror: true}` and reinstall that face with the erker dormers turned off. |

## Slot blocks: door pairs under canopy slabs

The "ground bays 6 vs 8" FAIL is the counting artefact the lane described. By eye, round 3 is better than the current install:

- **Before:** one double door, plus a window inside the photo's entry span.
- **Now:** four house doors under canopy slabs at the right height, with two ground windows at each end, as in the photo. The window that sat inside the entry is gone.

It is still not the photo. Both of these can follow the reinstall:

1. **Door spacing.**
   - Photo: the four doors stand side by side across about 0.32–0.69 of the pand width, under **one** continuous slab.
   - Model: two pairs pushed to the ends of that span, about 0.28–0.38 and 0.60–0.70, with plain brick between them and two short slabs.
   - Fix: close the gap so the pairs abut, and run one canopy across all four doors.
2. **Door width.** The doors are about 0.55 m wide; the photo's are about 0.75 m, filling the bays between the brick piers.

The zinc box dormers are **still missing on every slot block**. Andringa, Callenburg 2-32, Haen and Zwijgerlaan all show two dormers per block in the photo; Callenburg 3-63 has none. Round 3 did not add them to the slot types.

## Do the erker run's white dormers match the Treslong photos? No.

- **Count and position.**
  - Photo: one dormer for each **pair** of pands, standing on the party wall between them.
  - Model: one dormer per pand, centred.
  - The shared dormers sit on these walls:
    - 151165|151495, 126346|114449
    - 109065|113093, 132461|065427
    - 146039|144404, 114752|121629
    - 068576|111921, 105923|145888
  - On treslong-21-35-a, pands 2–4 also have flat roof lights instead.
- **Height.**
  - Photo: the dormer stands right on the gutter line.
  - Model: it floats about 1 m up the slate plane.
- **Form.**
  - Photo: a cream box with a dark flat cap and two small lights.
  - Model: a bare white-framed 2-light window about 2 m wide, with no visible cheeks or cap.
- The white frame colour is the only part that matches.

Until the type can place a dormer straddling a party wall, keep Treslong without dormers.

## Brick values drifted from the round-1 pins

These are not blocking. The lane's run brick values are lighter than the round-1 verdict asked for:

| Run | Lane value | Round-1 pin |
|---|---|---|
| Coppelstock | #78654f | #6b5a46 |
| Leijnsenstraat 2-30 | #7b6447 | #6c583e |
| Haringstraat 26-38 | #786346 | #69563d |
| Treslong | #6c4e36 | #573f2b |

Each is now uniform, which fixes the patchwork, but all four still read lighter than the photo (the sheets still mark these walls ✗). Apply the round-1 values on the next re-sheet, unless the lane measured something I did not.
