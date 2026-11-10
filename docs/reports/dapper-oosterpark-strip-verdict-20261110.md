# Dapperbuurt and Oosterparkbuurt strip review, 2026-11-10

Reviewer: Opus strip reviewer. Sheets: `map-recall2-source-data/block-face-strips/dapper-oosterpark-20261110/`.
I compared the photo and the model side by side on a 0.5 m grid at 40 px/m, then zoomed in on the window heads, ground storeys and balconies.
Hex values are medians of pier boxes in the photo. The lane already knows the dormers are drawn smaller than in the photo; that is a kit limit and is not counted against any pand below.

## Verdicts

| Sheet | Pand (BAG) | Verdict |
|---|---|---|
| swinden-383-581-r1 | 159406 Goudexpert | **install-with-fix** (shopfront colour) |
| | 158925 Cosme | **install** (black shopfront fascia optional) |
| | 165201 Losyana | **install-with-fix** (shopfront colour) |
| | 163378 Nura's Beauty | **install-with-fix** (shopfront colour) |
| | 236602 Dapper Post | **install-with-fix** (shopfront colour; house door on the right) |
| | 161671 Çiğköftem | **install-with-fix** (shopfront colour) |
| ruysch-64-124-r1 | 159820 Ruyschstraat 90 | **hold** until the ground storey is fixed (no shopfront and no doors in the model) |
| | 150384 Ruyschstraat 88 | **hold** until the door is fixed (door on the right is missing) |
| | 165864 Ruyschstraat 86 | **hold** until the door is fixed (door on the left is missing) |
| ruysch-64-124-r2 | 158466 Ruyschstraat 82 | **hold** until the door is fixed (door on the right) + brick |
| | 160930 Ruyschstraat 80 | **hold** until the door is fixed (double door on the left) |
| | 163039 Ruyschstraat 78 | **hold** until the door is fixed (arched door on the right) + brick |
| | 154180 Ruyschstraat 76 | **hold** until the door is fixed (arched door on the left) |
| ruysch-307-393-r1 | 161684 (left pand) | **hold** until the door is fixed (door on the right) |
| | 155674 (right pand) | **hold** until the door is fixed (door on the left) + brick |

The Ruyschstraat holds have one main cause, and the fix applies to every Ruyschstraat pand. **The model gives every Ruyschstraat ground
storey three windows and no front door.** Each pand in the photo has a street door, and 90 has a white
shopfront. A house with no front door is not "near enough", so these pands cannot install until the doors are pinned. Once the doors and the
fixes below are in, all nine Ruyschstraat pands are install-with-fix candidates. Re-sheet them before installing.

The right-hand sheet on ruysch-307-393 shows only BAG ids. Check which of 161684 and 155674 is 331 and which is 339 before pinning; the left pand is listed first.

## Eerste Van Swindenstraat 391-401 (dapper-1882-plain-dormer)

What matches:
- Three bays and three upper storeys on every pand, with the windows' head heights and sills on the photo lines.
- Shallow segmental heads with white frames. I zoomed in to check this: the photo heads are segmental, so the model is right.
- Transom and pane layout.
- Brick: every wall gate passes, and the tones read right.

To fix:
- **Shopfront colour.** The photo's shopfronts are cream or white painted timber: fascia, pilasters and frames, with the fascia reading `#bab7a8` under the cast. The exception is Cosme (158925), which has a black fascia and frame. The model gives every pand a brown frame and a dark brown fascia. Set the shopfront frame and fascia to cream, about **`#e6e1d2`**, on 159406, 165201, 163378, 236602 and 161671. Black on 158925 is optional.
- **House doors.** The separate residential street doors in the photo are white or cream on 159406, 158925, 163378 and 236602. The model's doors are black. Change them to cream.
- **Door side.**
  - 236602 (Dapper Post): the shop's double door is at the left and the white house door is at the **far right**. The model puts its single door at the left. Move the house door to the right with a ground-storey mirror pin on 236602.
  - 163378 has its house door at the left, which matches.
  - 165201 and 161671 are too obscured by the awning and the doorway to call, so leave them as modelled.
- **Cornice depth.** The photo's cream cornice and paneled frieze is about 1.25 m deep and ends about 0.6 m lower than the model's cream band. The model's band is about 0.9 m. Extend the frieze down to the photo line. The paneled frieze itself is a listed limit.
- Iron wall anchors and the skylights in the mansard are listed limits, and do not block the install.

## Ruyschstraat 76-90 (r1: 90, 88, 86; r2: 82, 80, 78, 76)

**Doors and ground storey**

| Pand | Ground storey in the photo |
|---|---|
| 90 (office/dwelling) | White timber shopfront across the full width: a door at the left, wide glazing with a transom row in the middle, and a door at the right, between white pilasters and under a white fascia. The model draws three brick windows. Pin a shopfront with a door pair. |
| 88 | Two segmental windows, then the door **on the right** (house number 88 beside it). |
| 86 | Door **on the left**, then two windows. |
| 82 | Two windows, then the door **on the right**. |
| 80 | Double door **on the left**, then two windows. |
| 78 | Two windows, then a round-arched door **on the right**. |
| 76 | Round-arched door **on the left**, then two windows. |

**Top-storey window heads.** In the photo the top storey on 82, 80, 90, 88 and 86 is **flat-headed** under a brick lintel. On 90 it also has white stone blocks at the head corners. The middle storey, the lower storey and the ground storey have segmental brick arches, which the model has right. The model gives the top storey segmental heads too: make it flat on those five pands. On 78 and 76 the top storey has taller arched heads with a tympanum, so segmental is the nearest correct choice there; keep it.

**White stone on 90.** 90 has white impost and keystone blocks at the springing of every arch, and white corner blocks on the top storey. The other pands have none. Add them to 90 if the kit can, using keystones or impost blocks.

**Balconies.**
- The photo has a French balconette on the centre axis of the top storey, which the model matches.
- On the middle and lower storeys the photo has projecting balconies on carved brackets. This is a listed limit, and acceptable.
- **90 has no balcony on the lower upper storey**: its centre window there is plain. Remove that railing on 90.

**Cornice.** The photo's cornice is a painted grey moulding, `#716b68`–`#837f7b`, over the brick frieze, which is a listed limit. The model draws a thin cream fascia, `#e6e1d5`. Recolour it to **`#a29d95`** (60 % of the way to the photo).

**Brick.** The gates pass on 90, 88, 86, 80 and 76. Two pands read visibly too light:
- **82**: the photo is `#5f514d` and the model `~#7a6660`. Use **`#6a5955`**.
- **78**: the photo is `#60433e` and the model `#7e5750`. This is the red-brick pand. Use **`#6c4b45`**.

## Ruyschstraat 331 and 339 (ruysch-307-393-r1)

- **Doors.** On the left pand (161684), two windows, then the door on the right. On the right pand (155674), the door on the left, then two windows. The model draws three windows and no doors on both. Pin the doors.
- **Top-storey heads** are flat in the photo and segmental in the model. Make them flat. The middle and lower storeys are segmental, which matches.
- **Balconies.** There are centre balconies on all three upper storeys, and the model's railings match. The photo's balconies project on slabs and brackets, which is the same listed limit.
- **Cornice.** The photo cornice is dark, `#685d5c`, over a brick dentil frieze. Recolour the model's cream fascia, as on 76-90 above.
- **Brick.** 155674: the photo is `#5a504c` and the model `#76645d`. The gate passes, but the model looks too light. Use **`#655853`**. 161684 matches.

## Kit gaps noted here (beyond the known dormer size)

- Projecting balconies on carved stone brackets (Ruyschstraat).
- A paneled cornice frieze (Swindenstraat), and a brick dentil frieze under the cornice (Ruyschstraat).
- Tall arched top-storey heads with a tympanum (Ruyschstraat 76 and 78).
