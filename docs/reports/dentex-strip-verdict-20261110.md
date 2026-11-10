# Den Texstraat strip review, 2026-11-10

Reviewer: Opus strip reviewer. Sheets: `map-recall2-source-data/block-face-strips/den-texbuurt-20261110/`
(`sheet-tex-1-59-r1`, `-r2`, `sheet-tex-8-58-r1`). The likeness gate abstained, so this review is by eye,
with brick, cornice and white values read as medians of the rectified strip (pier boxes between windows,
avoiding glass, erkers and the tree). The strip has a slight yellow-green cast (a pure white stone reads
`#fdfdf6`), and the values below allow for it.

## Verdict per pand

| Pand | BAG | Type | Verdict |
|---|---|---|---|
| Den Texstraat 11 | 0363100012179430 (179430) | tex-1882-hood-bracket-mansard | **install-with-fix** (erker required, otherwise hold) |
| Den Texstraat 13 | 179429 | tex-1882-hood-bracket-mansard | **install-with-fix** |
| Den Texstraat 15 | 179383 | tex-1882-hood-bracket-mansard | **install-with-fix** (erker required, otherwise hold) |
| Den Texstraat 21 | 179512 | tex-1876-balcony-wide-dormer | **install-with-fix** |
| Den Texstraat 23 | 179511 | tex-1876-balcony-wide-dormer | **install-with-fix** (remove the middle-storey balcony) |
| Den Texstraat 25 | 179510 | tex-1876-balcony-wide-dormer | **install-with-fix** |
| Den Texstraat 27 | 179509 | tex-1876-balcony-wide-dormer | **install-with-fix** (mirror flip) |
| Den Texstraat 22 | 179377 | tex-1882-hood-bracket-mansard | **install-with-fix** |
| Den Texstraat 20 | 179379 | tex-1882-hood-bracket-mansard (painted) | **install-with-fix**; the change to a house is **confirmed** |

None of these is an install as it stands. Each pand has the right massing, bay count, storey lines,
door side (except 27) and window head kinds (except the middle storey on r2). However, every model is
missing this street's signature: the white stone block work. Without it the facades read as plain
brown terraces. If the fixes below cannot land in this lane, hold the whole street instead of
installing it "near enough".

## Fixes that apply to the whole street (both types)

1. **White block bands at every window-head line.** This is the dominant feature. At the head line of each storey, white
   stone blocks sit on the piers, alternating long and short, and stop at each window reveal. Each head
   also carries one white keystone block on its centre. Below the cornice, the top storey has a continuous
   row of white blocks like dentils. The model has only thin cream sill bands and
   olive lintel strips (`~#a39d7c`). Make the lintel strips and head-line blocks white, about `#f0efe6`
   (the blocks read `#fdfdf6` with the cast). Express them as `bands: "speklagen"`/`brickStripes` at the
   head lines, interrupted by the openings, plus `keystones` on every window. If the kit cannot interrupt
   a band at the reveals, that is a kit gap: add it in this lane instead of fitting a continuous stripe.
2. **The sill band stays continuous and white** (`#f0efe6`), as in the photo. The model's cream sills are close; brighten them.
3. **Brick.** The photo piers read `#564b3a`–`#5a5446` (r1 and r2; 21 alone is lighter at `#785d46`) and 22 reads `#615548`.
   The model is `#765d49`, too warm and too light. Use one value per run, 60 % of the way to the photo:
   **tex-1-59 r1 + r2 → `#645341`**, **22 → `#655444`**.
4. **Cornice and frieze tone.** The model has a plain cream frieze about 1.3 m tall. In the photo the cornice body is
   a painted grey-olive (`#62614c`–`#757362`), with a white lip and the white block row below it. Recolour the
   frieze and cornice body to **`#9e9a84`** (60 % rule) and keep white only for the lip and the blocks.
5. **Dormers.** See the per-type notes below. The model's dormers are too wide and too plain for both types.

## tex-1882-hood-bracket-mansard: 11, 13, 15 (r1) and 22 (8-58)

- Window heads match: the top storey is rectangular, the middle storey is segmental with a brick relieving arch, and the
  ground floor is rectangular. Transom and fanlight panes match. Keep them.
- Doors are on the left on 11, 13 and 15 and on the right on 22. The model matches, so no mirror pins are needed.
- **Erkers.** 11 and 15 each have a white timber bay window (erker) on the centre axis of the middle storey, about
  1.9 m wide, three-sided, on corbels, with an iron railing on its roof that serves the top-floor centre window.
  The model has neither erker. This is the Nassaukade-style bay that the kit already has: add it as a pand
  override on 11 and 15. 13 has no erker. **If it does not land, hold 11 and 15.**
- **Dormer.** The photo has a single, narrow dormer: a light about 0.7 m wide between white cheeks or pilasters,
  about 1.9 m wide overall, under a tall white pediment with scroll consoles and a crowning ornament. The model has a
  2.3 m dormer with two lights and a low cream pediment. Narrow it to one light with white cheeks and raise the
  pediment. The kit cannot yet express the scroll consoles or the crowning ornament (see "Kit gaps").
- **Row line.** The cornice line in the photo is continuous across 11, 13 and 15. The model sets 11's frieze about 0.4 m above
  13 and 15 (eaves 13.54 against 13.12 and 13.24). Clamp 11 to the row value, about 13.2 m. The gap is below the 0.8 m outlier rule,
  but it is visible against the photo.
- **22.** Red brick, white block bands and keystones, segmental middle storey, door on the right. The fixes are the
  street-wide fixes plus the dormer fix.

## tex-1876-balcony-wide-dormer: 21, 23, 25, 27 (r2)

- **Window heads.** Both upper storeys in the photo are **flat-headed**, with a recessed brick head, a white keystone
  and a white block band. The model gives the middle storey segmental heads. Make them flat, as on the top storey.
- **Balconies.** These are cast-iron French balconies on the centre axis, about 1.9 m wide, on white consoles.
  - 21: top storey and middle storey. The model matches.
  - 23: **top storey only.** The middle centre window has no balcony, and the tree starts below it.
    Remove the model's middle-storey balcony on 23.
  - 25: top storey and middle storey. The model matches.
  - 27: top storey and middle storey. The model matches.
  - The white consoles under each balcony and at the piers (the "hood brackets") are visible on every pand. Model them
    as white corbel blocks if the kit has them; otherwise they are a kit gap.
- **Doors and mirroring.** In the photo, 21 has its door on the right, 23 on the left, 25 on the right and 27 **on the left**.
  The model puts 27's door on the right, after two windows. **Flip 27.** Add to `den-texbuurt-review-types.json`:
  `mirrors: [{pandId: "0363100012179509", type: "tex-1876-balcony-wide-dormer", mirror: true, reason: "photo: door at left, then two windows (the pair alternates 25 R / 27 L)"}]`.
  Check the stored mirror flag on 27 before writing this. The required result is the door on the left.
- **Dormer.** The photo has a white dormer about 3 m wide. Its centre is a raised aedicule with pilasters under
  a tall pediment, standing higher than two low side wings. Each wing has a small window. The model has a flat
  3.3 m dormer with three equal lights. Keep the three-part width, make the cheeks and frame white with
  narrower side lights, and lift the centre bay and its pediment above the wings if the kit allows it.
- **Mansard slate.** On 21, 23 and 25 the slate is dark (it matches). On 27 the slate is a lighter grey-blue scale tile, `~#6f7580`.
  This is optional and should be a palette pin on 27's roof only.
- **Row line.** The cornice in the photo is continuous across all four pands. The model sets 27 about 0.4 m low (13.31 against
  13.69–13.79). Clamp 27 to about 13.7 m.

## Den Texstraat 20: painted front, confirmed as a house

- **Use.** The ground floor in the photo has two windows with net curtains and a door on the right, with no shop glazing.
  The lane's change from assembly-use shopfront to house is **correct**.
- **Wall.** The photo shows painted brick in near-black grey, `#3f494a` on the top storey and `#303b3c` on the middle storey. The model is
  `#505c67`, which is too blue and too light. Move 60 % of the way: **`#424c51`**.
- **White accents.** The window frames and surrounds are white and the top-storey keystones are white. The model's frames
  match. The **ground-floor windows carry a fan of white radiating voussoir blocks**, and below the
  cornice runs a white ornamental frieze band with a repeating motif. The model has neither. Add the voussoir fan if the kit has one
  (arch rings); otherwise list it as a gap. If the kit has no ornamental frieze, a plain white band is the fallback.
- The dormer fix is the same as for 22 (a single light under a tall white pediment).
- **stripOverDrawn 0.76** is just under the 0.8 floor. The strip still shows the whole front of 20 and 22 clearly,
  including the dormers, cornice and ground floor, so the shortfall does not block a by-eye verdict. I judged
  8-58-r1 normally.

## Kit gaps (what the kit still cannot express here)

- Head-line block bands interrupted at the reveals: blocks alternating long and short, with white blocks per pier. This is
  not the continuous speklagen stripe.
- Ornate single-light dormers with scroll consoles and a crowning ornament on the pediment (r1 and 8-58).
- A three-part dormer with a raised central aedicule (r2).
- White corbel and console blocks under balconies and at pier heads.
- A frieze with a repeating ornamental pattern (20) and a fan of white radiating voussoirs over flat-headed windows (20).

## Measurements (strip medians)

| Sample | Photo | Model |
|---|---|---|
| Brick, 11 / 13 / 15 (top-storey piers) | #584f40 / #564b3a / #5a5446 | #765d49 |
| Brick, 21 / 23 / 25 / 27 | #785d46 / #504737 / #595243 / #5a5141 | #765d49 |
| Brick, 22 | #615548 (top), #524539 (middle) | #765d49 |
| Paint, 20 | #3f494a (top), #303b3c (middle) | #505c67 |
| Cornice body, r1 / r2 / 22 | #62614c–#736e56 / #757362 / #7a7861 | cream, about #e8e4d8 |
| White blocks, r2 | #fdfdf6 | olive lintel strips |
