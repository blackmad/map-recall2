# Vogelbuurt-Noord strip verdict — 2026-11-10

Reviewer: Opus strip review. Lane `lane/buurt-vogelbuurt-20261110` at
8082cf22a. Sheets: `map-recall2-source-data/block-face-strips/vogelbuurt-20261110/`
(30 sheets, 27 strips). The bar is likeness to the photo, not gates passing.
Mirrors were judged from the window and door order in the photo; where a
hedge or tree hides the door, the pand holds unless the window order alone
fixes the hand.

Unless a pand is listed under INSTALL-WITH-FIX or HOLD, it is INSTALL.

## Type-wide fixes (apply before any install of that type)

| Type | Change | Evidence |
|---|---|---|
| `vogel-1918-timber-band-cottage` | `palette.stone` #a2634c → **#d6d9cc** (the timber dormer body reads the `stone` slot, so it renders terracotta today). Widen `crown.dormerAt` from `{0.12, 0.62}` to **`{0.10, 0.72}`**, about 3.1–3.4 m on a 5 m front, matching the type's own note ("cream dormer 3.1 m wide"). | Every timber-band sheet shows a white or cream dormer box. The model draws it pinkish-brown and about 2.5 m wide. |
| `vogel-1918-cottage-2axis`, `-3axis`, `timber-band` (shared brick #8f6a58) | `palette.brick` #8f6a58 → **#74584a** | Measured on vogel-3-11-r1: photo wall median **#554339**, model wall **#957161**. The photo is a dark winter shot. As with the Soenda #6c5647 call in Indische, take a value about 60 % of the way from the lifted figure to the photo median, not the raw photo value. The lane already flagged #8f6a58 as lifted. |
| `vogel-1921-two-storey-dormer-row` | No palette change. Brick #7d5446 sits within exposure range of the photos (Flamingo photo #403d38 shaded, model #564c43 under the sheet's light). The wall ✗ labels on Meeuwenplein and Kalkoen come from the very dark 2017/2019 winter frames, not from a wrong hue. | — |

## Crown pin corrections (`vogelbuurt-noord-review-crowns.json`)

- **Flamingostraat 6 (0363100012066422): remove the `step-gable` pin.** The photo shows a flat-dormer house between the gables. It should take the type default `flat-dormer`.
- **Pelikaanstraat 3 (0363100012104432) and 9 (0363100012153865): add `step-gable` pins.** The photo shows the gable ends of the pelikaan-3-9 run, but the model draws dormer houses.

## Per run

### 1921–28 two-storey row (`vogel-1921-two-storey-dormer-row`)

| Run | Verdict | Pands |
|---|---|---|
| kalkoen-18-26-r1 | INSTALL | Kalkoenstraat 20, 18 |
| kalkoen-28-34-r1 | INSTALL | Kalkoenstraat 32, 30, 28 |
| kalkoen-8-16-r1 | INSTALL | Kalkoenstraat 16, 14 |
| kalkoen-8-16-r2 | INSTALL | Kalkoenstraat 10 (photo ghosted, mirror matches its neighbour pattern), 8 |
| meeuwenplein-1-7-r1 | INSTALL | Meeuwenplein 3, 5, 7 |
| meeuwenplein-9-19-r1 | INSTALL | Meeuwenplein 9, 11, 13 |
| meeuwenplein-29-39-r1 | INSTALL | Meeuwenplein 33, 35 |
| meeuwenplein-41-45 | INSTALL | Meeuwenplein 41, 43 (tree, window order still readable), 45 |
| pelikaan-16-22-r1 | INSTALL | Pelikaanstraat 22, 20, 18 |
| pelikaan-3-9 | Mixed | INSTALL Pelikaanstraat 5, 7. **HOLD 3, 9**: gable crowns are missing. Re-run with the step-gable pins above, then hold them with the other gable runs. |
| flamingo-4-10 | HOLD | Step-gable geometry audit fails (1.0 m² coplanar overlap against a 0.5 m² allowance). Flamingostraat 6 also has the wrong crown pin (see above). Flamingostraat 8's mirror is right. |
| flamingo-14-28-r1 / r2 | HOLD | Step-gable audit. Mirrors on Flamingostraat 28, 26 and 16 are right; they can install once the gable crown passes the audit. |
| kalkoen-13-17 | HOLD | Step-gable audit. Kalkoenstraat 15 and 17 are right. |
| pelikaan-13-27-r1 | HOLD | Step-gable audit. Pelikaanstraat 19 is right. |
| pluvierplein-5-15-r1 / r2 | HOLD | Step-gable audit. Pluvierplein 7 and 13 are mostly hidden by trees, so their mirrors are unverified. |

Kalkoenstraat 12 stays held, as the lane already pinned it.

### 1918–19 brick cottages (`vogel-1918-cottage-2axis` / `-3axis`), INSTALL-WITH-FIX (brick #74584a)

| Run | Verdict |
|---|---|
| vogel-3-11-r1 | INSTALL-WITH-FIX: 0363100012137379, 0363100012071224 |
| vogel-3-15-r1 | INSTALL-WITH-FIX: 0363100012101772, 0363100012132959 |
| vogel-2-6-r1 | INSTALL-WITH-FIX 0363100012120334. **HOLD 0363100012083966**: the photo reads window then door, but the model draws door then window. Flip the mirror. |
| vogel-5-15-r1 | INSTALL-WITH-FIX 0363100012062516. **HOLD 0363100012124606**: a hedge hides the door, and the photo door looks to be on the left while the model has it on the right. |
| vogel-2-16-r1 | **HOLD all three** (0363100012093588, 0363100012122579, 0363100012109169). Pands 1 and 2 are mis-mirrored: the photo puts pand 1's door on the right and pand 2's doors on the left. Pin the mirrors and re-run. |

### Timber-band cottage (`vogel-1918-timber-band-cottage`), INSTALL-WITH-FIX (stone #d6d9cc, dormerAt {0.10, 0.72}, brick #74584a)

| Run | Verdict |
|---|---|
| vogel-1-15-r1 | INSTALL-WITH-FIX: 0363100012114049, 0363100012117598, 0363100012135488 |
| vogel-2-16-122155-r1 | INSTALL-WITH-FIX: 0363100012065836, 0363100012091400, 0363100012138008 (doors behind hedges, but the window order fixes the hand) |
| vogelplantsoen-8-12-r1 | INSTALL-WITH-FIX: 0363100012079772, 0363100012087797 |
| zamenhof-84-90-r1 | INSTALL-WITH-FIX: 0363100012130936, 0363100012118660, 0363100012141264 |
| zamenhof-6-12 | INSTALL-WITH-FIX 0363100012122427, 0363100012085003. **HOLD 0363100012131492**: wrong mirror; the photo door is on the right. |
| zamenhof-46-52 | INSTALL-WITH-FIX 0363100012076655. **HOLD 0363100012064115**: no door is visible where the model draws one, at the left. |
| zamenhof-54-60 | INSTALL-WITH-FIX 0363100012064187, 0363100012151653. **HOLD 0363100012149443, 0363100012146996**: the model's window sits about 1 m off the photo, and no doors are visible. |
| zamenhof-78-82 | INSTALL-WITH-FIX 0363100012097992. **HOLD 0363100012112593** (a hedge hides the door) and **0363100012062919** (window about 1 m off). |

## Top 3 likeness gaps per type

**Timber-band cottage**
1. **Dormer.** Even after the stone and width fix above, the kit draws a 2-light dormer window (`verticalBars [.5]` is fixed in fit.ts). The photo dormers have 5–6 narrow lights. Kit gap: the dormer needs a light count.
2. **Door.** The model draws a black double leaf in a cream frame. The photo has a single dark leaf under a glazed transom.
3. **Windows.** There is no top light or transom, and on some fronts the ground window sits about 1 m off the photo bay. `bayWidths [4.0, 1.0]` is too coarse for the 5 m fronts on the Zamenhof side.

**Brick cottages (2- and 3-axis)**
1. **Brick tone.** #8f6a58 is lifted against the dark red-brown photos; fixed above.
2. **Windows.** `casement-pair` has no transom top light, which every photo front has.
3. **Doors and mirrors.** The model draws green double leaves; the photos show single dark leaves with transoms. Where hedges hide the doors, the mirrors are guesses; three pands hold for this reason.

**1921–28 two-storey row**
1. **Dormer.** The model draws a small cream box with 2 lights at {0.52–0.9}. The photo dormer runs nearly the full width with 4 lights. Its body is dark timber at Flamingostraat and Kalkoenstraat 28–34 and white elsewhere. Kit gap: the light count again, and a per-run dormer-body colour pin.
2. **Gable.** The attic window is drawn narrow, tall and 3-light; the photo has a 2-light window about 1.5 m wide with a transom. The cream band across the gable foot and the decorative raking brick edge are missing. The step-gable crown also fails the geometry audit (1.0 m² overlap against 0.5 m²), which holds 7 runs.
3. **Windows and eaves.** `casement-triple` lacks the photo's gridded small-pane top lights. The Flamingostraat eaves are a dark gutter, but the model draws a cream band.

## Install list

- **INSTALL (1921 row, 26 pands):**
  - Kalkoenstraat 8, 10, 14, 16, 18, 20, 28, 30, 32
  - Meeuwenplein 3, 5, 7, 9, 11, 13, 33, 35, 41, 43, 45
  - Pelikaanstraat 5, 7, 18, 20, 22
- **INSTALL-WITH-FIX, cottages (brick #74584a, 6 pands):** 137379, 071224, 101772, 132959, 120334, 062516
- **INSTALL-WITH-FIX, timber-band (stone #d6d9cc, dormerAt {0.10, 0.72}, brick #74584a, 17 pands):** 114049, 117598, 135488, 065836, 091400, 138008, 079772, 087797, 130936, 118660, 141264, 122427, 085003, 076655, 064187, 151653, 097992
- **HOLD:** all 7 step-gable runs; Pelikaanstraat 3 and 9; Kalkoenstraat 12; cottages 093588, 122579, 109169, 083966, 124606; timber-band 131492, 064115, 149443, 146996, 112593, 062919.

## Holds install (lane at 7ed86a42a, sheets `holds/`), by eye

I checked 12 runs and 27 pands for door side, window order, wall tone and the new dormers.
- Every mirror matches the photo.
- The timber-band dormers are now the cream multi-light boxes the photos show, which closes the type's #1 gap from the first review.

| Run | Verdict |
|---|---|
| kalkoen-8-16-r1 (16, 14) | **MERGE** |
| kalkoen-8-16-r2 (10, 8) | **MERGE** |
| kalkoen-18-26-r1 (20, 18) | **MERGE** |
| kalkoen-28-34-r1 (32, 30, 28) | **FIX: Kalkoenstraat 30 (0363100012111141) brick → #6e625e**, see below. 32 and 28 are fine. |
| pelikaan-3-9-r1 (5, 7) | **MERGE**. The pale wall matches what the photo actually measures (below). Optional warm-up to #9a8679. |
| pelikaan-16-22-r1 (22, 20, 18) | **MERGE** |
| vogel-2-16-122155-r1 (065836, 091400, 138008) | **MERGE** |
| vogel-3-11-r1 (137379, 071224) | **MERGE** |
| vogel-3-15-r1 (101772, 132959) | **MERGE**. The pale salmon brick matches the 2021 photo. |
| vogelplantsoen-8-12-r1 (079772, 087797) | **MERGE** |
| zamenhof-6-12-r1 (122427, 085003) | **MERGE** |
| zamenhof-54-60-r1 (064187, 151653) | **MERGE** |

### Kalkoenstraat 30: green wall

**Model.** The wall renders #53695c, a clear green that no pand on the street has.

**Photo (2017-12-28)**, pixel medians on the original sheet:

| Wall | Photo | Model |
|---|---|---|
| Kalkoenstraat 30 | #5d5b5c to #696a6c, a neutral purple-grey brick lighter than its neighbours | #53695c |
| Kalkoenstraat 32 | #463f3d | #544643 |
| Kalkoenstraat 28 | #4c4847 | #6a5950 |

**Fix.** Pin 30 to **#6e625e**. That is the neighbours' photo-to-model lift (about ×1.2–1.35) applied to its grey photo value, with the row's slight warmth (r−b of about 0x10). The result reads as the lighter grey-brown front between two darker ones, as in the photo.

### Pelikaanstraat 3-9: the pale wall is right

I sampled brick-only patches between the windows on the original sheet (2025-09-22, full sun):

| Source | Brick |
|---|---|
| Photo, raw | #ada298 to #b5aaa0 |
| Photo, white-balanced against the door frames (#d1dada, r×1.04) | about #b4a298 |
| Model | #958b82 |

The model has the same hue as the photo and is darker; it is not greyer than the photo. The reddish-brown impression comes from red and purple bricks in pale mortar under direct sun, and the model's brick texture carries the same mortar.

Merge as is. If a warmer read is wanted, pin **#9a8679**, which raises r−b from 0x13 to 0x21 at the same luminance. Do not pull it down to the 1921 default #7d5446: that would contradict the photo.
