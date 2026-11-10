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

## Round 4 (lane at 3a7b871d5, sheets `round4-final/`), by eye

| Run | Verdict |
|---|---|
| coppelstock-25-55-r1 | **MERGE** |
| haring-26-38-r1 | **MERGE** |
| leijnsen-2-30-r1 | **MERGE** |
| leijnsen-2-30-r2 | **MERGE** |
| callenburg-3-63 | **FIX: canopy slab** (below). This run has no dormers, matching the photo. |
| andringa-1-31-r1 | **FIX: canopy slab + zinc dormer** |
| andringa-4-32-r1 | **FIX: canopy slab + zinc dormer** |
| callenburg-2-32-r1 | **FIX: canopy slab + zinc dormer** |
| callenburg-2-32-r2 | **FIX: canopy slab + zinc dormer** |
| haen-3-31-r1 | **FIX: canopy slab + zinc dormer** |
| haen-3-31-r2 | **FIX: canopy slab + zinc dormer** |
| haen-6-62-r1 | **FIX: canopy slab + zinc dormer** (flush doors are acceptable) |
| haen-6-62-r2 | **FIX: canopy slab + zinc dormer** (flush doors are acceptable) |
| haen-6-62-r3 | **FIX: canopy slab + zinc dormer** (flush doors are acceptable) |
| zwijgerlaan-225-279-r1 | **FIX: canopy slab + zinc dormer** (flush doors are acceptable) |
| zwijgerlaan-225-279-r2 | **FIX: canopy slab + zinc dormer** (flush doors are acceptable) |
| treslong-5-19-a | **FIX: dormer seam and form** |
| treslong-5-19-b | **FIX: dormer seam and form** |
| treslong-21-35-a | **FIX: dormer seam and form** |
| treslong-21-35-b | **FIX: dormer seam and form**. The 111921 mirror is now right: narrow window and door on the left. |

If the fixes cannot land this round, merging is still better than the round-2 install in one respect: the doors. The slot-block fronts with
four doors are a clear gain. But do not ship the grey cube dormers or the Treslong window-pair dormers. Merge those runs with the dormers
turned off rather than as drawn.

### Slot blocks: the doors are right, the slab and dormers are not

**Doors.** The four doors across 0.32–0.69 now match the photo's count, spacing and width.

**Slab (FIX).**
- The canopy is drawn as **two pieces with a gap**, about 0.52–0.58 of the front (andringa-1-31-r1 at 2×). The photo has one continuous
  slab from about 0.32 to 0.70.
- The slab also floats about 0.45 m above the door heads; in the photo it sits directly on them.
- The fix: draw one slab and drop it onto the door heads.
- Optional: the photo's doors are single dark-green leaves (about #1c2a24) with no transom. The model draws double leaves with a transom.

**Dormers (FIX).** The width (about 2.5 m) and the placement over the end window pairs are right on Haen, Zwijgerlaan and Callenburg
2-32. But the dormers render as a **grey brick-coursed cube with one small 2-light window**, which reads as a lift shaft rather than a
zinc dormer. In the photo they are:
- a front that is mostly glass: a 3-light band about 2.0 m wide across a 2.5 m box;
- smooth zinc cheeks, no brick texture, mid grey about #6f7275;
- a dark flat cap, about #3e4144, overhanging about 0.15 m;
- about 1.6 m high including the cap. The model is about 2.1 m.

On Andringa the photo's two dormers sit further inward, flanking the slot lights. That is a minor point and need not block.

### Treslong: dormer position right, seam and form wrong

**Position.** The dormer now straddles the party wall between pands 1|2 and 3|4 of each face, sitting on the roof foot just above the
gutter band. That matches the photo.

**Seam.** At 3× zoom (treslong-21-35-b), the two mirrored halves are two separate framed 2-light windows. They meet with a doubled
cream frame and a hairline slate gap at the party wall, so the dormer reads as a pair of tall windows.

**Form.** In the photo the dormer is one cream box:
- about 2.2 m wide and about 0.9–1.0 m high;
- two lights in one frame, with a single centre mullion;
- a dark flat cap with an overhang;
- cream cheeks.

The model's halves are each about 0.9 m wide by 1.3 m high and have no box, no cheeks and no cap.

**Fix.**
- Drop the inner frame members at the seam, so the two halves meet as one frame with one mullion.
- Make the dormer wider and lower, about 2.2 × 1.0 m.
- Add cream cheeks and a dark cap.

### Treslong wall tone: reads right, not too dark

| | Wall |
|---|---|
| Rendered model, every Treslong pand | #5c4531 / #5d4632 |
| Photo, by pand | #3e2c1c to #55432f, median about #473625 |

The rendered wall is about 25 % lighter than the photo, which is exactly the exposure allowance used for every other run. Side by side
it reads as the same dark purple-brown. The #2b1f16 pin is only the input the renderer lifts from, so judge by the render, and the render
is right.

Brighter-palette note: these fronts really are dark. Lifting Treslong further would mean departing from the photo. The other runs hit
their targets too, all ✓ on the sheets:

| Run | Rendered wall |
|---|---|
| Coppelstock | #6b5b46 |
| Haringstraat 26-38 | #6a573d |
| Leijnsenstraat 2-30 | #6c593e |

## Round 5 (lane at 14c6141cc, sheets `round5-final/`), by eye

All 16 runs: **MERGE.**
- Slot blocks: andringa-1-31-r1, andringa-4-32-r1, callenburg-2-32-r1/r2, callenburg-3-63, haen-3-31-r1/r2, haen-6-62-r1/r2/r3, zwijgerlaan-225-279-r1/r2.
- Treslong: treslong-5-19-a/b, treslong-21-35-a/b.

### Slot blocks
**Slab.** One continuous canopy across about 0.32–0.69 on every run, sitting on the door heads. The round-4 gap and float are gone.

**Doors.** Four single leaves with no fanlight, matching the photo's count and spacing. Callenburgstraat 3-63 is dark green, as in the photo.

**Dormers.** They now read as zinc dormers, not grey cubes:
- a 3-light glass band across most of the front;
- smooth grey cheeks with a dark cap;
- width and height in proportion with the photo (andringa-1-31-r1 checked side by side at 1.5×);
- placed over the end window pairs on Haen, Zwijgerlaan and Callenburgstraat 2-32, matching the photo.
- Callenburgstraat 3-63 correctly has none.

Follow-ups, not blocking:
- The photos of Andringa, Haen and Callenburgstraat 2-32 also show dark green-black doors. The model draws khaki/dark-brown leaves there, so the Callenburgstraat 3-63 door colour could be applied to the whole type.
- On Andringa the photo's dormers sit further inward, flanking the slot lights.

### Treslong party dormer
- **Seam: fixed.** At 4× zoom it is one cream frame, about 2.2 × 1.0 m, with two lights and one thicker centre post. It straddles the party wall on the roof foot just above the gutter band, where the photo has it.
- **Cheeks: pale is right.** The lane worried the cheeks read pale, but they are cream in the photo too.

Follow-up, not blocking:
- **Cap.** The dark slate cap merges into the slate roof, so no cap shows above the frame in the ortho view. In the photo the cap is a visible overhanging fascia, pale grey-beige with a dark underside, about 0.15–0.2 m deep.
- **Fix:** colour the cap's fascia edge about #9a988c, keep its top slate, and the dormer will read as a box rather than a window set in the roof.
