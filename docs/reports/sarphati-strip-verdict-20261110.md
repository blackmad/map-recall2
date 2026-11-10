# Sarphatistraat 167-179 strip verdict, 2026-11-10

Reviewer: Opus strip review, by eye.
- Sheets: `block-face-strips/weesperbuurt-20261110/sheet-sarphati-163-213-r1.jpg` and `-r2.jpg`.
- Photo: 2017-03-31, 40 px/m. I compared photo and model panels aligned to the same frame.
- Type: `sarphati-1910-arched-tower-pair`, lane at 516e7be98.

## Verdict: all six pands INSTALL-WITH-FIX. Fix before merge; otherwise HOLD.

| Pand | Address |
|---|---|
| 0363100012180964 | Sarphatistraat 167 |
| 0363100012170677 | Sarphatistraat 169 |
| 0363100012170681 | Sarphatistraat 171 |
| 0363100012181393 | Sarphatistraat 175 |
| 0363100012181394 | Sarphatistraat 177 |
| 0363100012181458 | Sarphatistraat 179 |

### What is right

- **Mirrored pairs.** The narrow window column, the arched door and the brick wall dormer (tower) sit on the shared party wall of each pair. Every pand matches the photo.
- **Rows.** Ground plus three storeys, plus the tower light, all at the right heights. The top-row heads are within about 0.3 m of the photo.
- **Doors.** Arched red-brown doors in the right bay.
- **Brick tone.** The sheets mark every wall ✓, for example photo #776754 against model #736557. No palette change.

### Fixes, all expressible with the current kit

1. **Roof mass.**
   - Model: a 30° black-tile slope rises about 2.8 m above the cornice.
   - Photo: above the cornice there is only sky, a few chimney pots and the towers. The roof is flat or hidden behind the cornice.
   - Fix: give the type a flat roof behind the cornice, so no slate shows, and keep the towers.
   - This applies the project rule that the roof comes from the front, not from 3DBAG.
2. **Speklagen.**
   - The kit can already draw these: `brickStripes` (used in the Indische Java type) and `bands: "speklagen"` in `kinker-1886-neo-renaissance`. The lane's "kit lacks speklagen" is not right.
   - Photo: thin buff bands, about #c8a379 to #d9ae84 in this warm frame. A doubled pair runs at every window-head line and one band at every sill line. Single bands fall between them, roughly every 0.8 m up the wall.
   - Fix: add `brickStripes` with doubled courses at the head lines, single courses at the sill and mid-pier lines, colour about #d4b48c.
   - `brickStripes` is a texture, so it should not cost triangles. If it does, it still outranks the balconies. The user has named speklagen as a priority.
3. **Wide axis as a window pair.**
   - Model: one 2.7 m two-light window per storey.
   - Photo: two separate casements, each about 1.1 m wide, with a brick pier of about 0.3 m between them. Each has a top light, and the top lights of the upper floors are small-paned.
   - The ground storey is the same: two tall windows, not one four-light window.
   - Fix: split axis 0 into two windows, either two bays of about 1.15 m with a pier, or a `casement-pair` with a visible mullion pier.
4. **Cornice and tower cap.**
   - Photo: a projecting white cornice with brackets runs along the eaves. Each tower has its own white cornice cap with a dentil band.
   - Model: a thin cream band, and the towers have bare brick tops.
   - Fix: a deeper projecting cornice, about 0.4 m, colour #e2dccb, at the 14.4 m line, and a matching cornice cap on the tower (`cap: "cornice"` rather than `"flat"`).
5. **r1 eaves.**
   - Sarphatistraat 167, 169 and 171 report eaves at 15.47 m. Sarphatistraat 175, 177 and 179 report 14.39 m, which matches the type's fixed 14.4 m.
   - On the r1 sheet the model cornice sits about 0.5 m above the photo's.
   - Fix: make sure `frontEavesFixed` reaches r1 as well, so all six are at 14.4 m.

### Kit gaps that should not block

- Iron balconies under the wide windows on storeys 1-2 (some pands).
- Fanlight tracery in the arched doors.
- Pale stone corbel blocks at the window-head corners.

## Install list

- After fixes 1-5: install all six pands (180964, 170677, 170681, 181393, 181394, 181458).
- If merging before those fixes: HOLD all six. The visible slate roof and the missing speklagen are the two things the user would catch first.
