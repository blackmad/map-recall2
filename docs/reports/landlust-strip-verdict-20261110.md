# Landlust-Zuid strip verdict, 2026-11-10

Reviewer: Opus strip review. Lane `lane/buurt-landlust-20261110` at 7ba5b7f69.
Sheets: `map-recall2-source-data/block-face-strips/landlust-20261110/`. I read all 34 run sheets, the wide ones in quarters.

The bar is likeness to the photo. I checked mirrors window by window and door by door against the photo. Current mirror flags come from
`scripts/block-face/faces/<run>/intent.json`. Mirror fixes are `mirrors` pins in `landlust-zuid-review-types.json`, and
brick fixes are pins in a new `landlust-zuid-review-palettes.json`.

**Brick rule.** Where the model reads too light, the fix moves 60 % of the way from the model wall to the photo median. This is the
same exposure allowance as the Soenda #6c5647 and Vogelbuurt #74584a calls. Each run gets one value, so a uniform block does not
turn into a patchwork.

**Sheet labels.** On treslong-5-59 pands 11-16, the sheet's "wall model" labels read #3f4b53. That is the roof sampled, not the
wall, because the model walls are visibly brown. Ignore those labels.

## Verdict by type

### `landlust-1924-bestevaer-stair-block` / `-half-block`: HOLD, all 28 placed pands

Runs:
- bestever-63-139-r1/r2
- bestever-64-78-r1
- bestever-80-96-r1
- bestever-98-128-r1/r2
- bestever-134-202-r1/r2/r3
- bestever-141-213-r1/r2/r3

Also treslong-30-62-r1 (3 pands, the same design). Its gates fail ("not a straight surveyed wall"), so it is held as well.

The upper window rows read, but the street-level signature of these blocks is wrong on every sheet:

1. **Stair entry.**
   - Photo: one arched stair door, set under the glass-brick pilaster, in a dark brick plinth about 1 m high with low
     basement-height windows.
   - Model: a full-height ground storey with a rectangular double door at the pand edge, away from the pilaster. No plinth.
   - The BAG pand boundaries cut the architectural blocks off-centre, so a per-pand door position cannot land under the
     pilaster at all.
2. **Window rhythm.**
   - Photo: windows in pairs either side of the stair pilaster.
   - Model: four evenly spaced axes, and no pilaster, either the glass-brick lights or the brick pier.
3. **Patchwork tone.**
   - Each pand takes its own trim-normalised wall. On one uniform block this gives olive (125415, #7c632a), pinkish (092821),
     beige (087761) and grey-brown (109120, #8d7f70 against photo #6f6045) side by side.
   - If these are revisited, use one run value: the lane's white-balanced #8b7a6a.

Re-place only after the kit gains a plinth storey with an arched door placed at the pilaster, which means placing by the
architectural block rather than by pand.

### `landlust-1934-slot-block` (three storeys): INSTALL, with brick and eaves fixes

Facades read well: the end window pairs, the slot lights, the tone and the flat roofline. Mirrors do not matter here, because the
photo's entry spans the middle and the model's door lands inside it either way.

| Run | Verdict |
|---|---|
| andringa-1-31-r1 | INSTALL Joris van Andringastraat 19 (080635), 23 (069920) |
| andringa-4-32-r1 | INSTALL Joris van Andringastraat 10 (124713), 6 (103458) |
| callenburg-2-32-r1 | INSTALL Gerard Callenburgstraat 28 (063379), 24 (107097) |
| callenburg-2-32-r2 | INSTALL Callenburgstraat 16 (095699), 12 (125512). **INSTALL-WITH-FIX Callenburgstraat 8 (105359)**: brick #a26439 → **#7a4c2f**. The photo reads #644229; the sheet flags it too light, +0.15. |
| callenburg-3-63 | INSTALL Callenburgstraat 3 (119108), 11 (132798), 15 (098318). **INSTALL-WITH-FIX 7 (073024), 19 (137010), 23 (082410), 27 (066626), 31 (063567)**: brick → **#7a4c2f**. The model reads #986344 to #a3704e against photo #6e4a32 to #714c34. **Also clamp the eaves of 27 and 31** from 10.15 to the row line, **10.65 m**: the photo eaves run continuous across all 8 pands, but the model steps down 0.5 m. |
| haen-3-31-r1 | INSTALL Jan den Haenstraat 3 (140098) |
| haen-3-31-r2 | INSTALL Haenstraat 15 (140644). **INSTALL-WITH-FIX Haenstraat 19 (114763)**: brick #8f5534 → **#7a4c2f**; photo #5d412d. **Clamp the eaves** from 10.94 to **10.1 m**: the photo shows one eaves line with no. 15, and the model's +0.94 m step is a lone 3DBAG outlier. |

### `landlust-1935-slot-block-four`: INSTALL, with brick fixes

| Run | Verdict |
|---|---|
| haen-6-62-r1 | INSTALL Jan den Haenstraat 28 (107347) |
| haen-6-62-r2 | **INSTALL-WITH-FIX Haenstraat 20 (084532)**: brick #9b7255 → **#815f45**; photo #70533a. |
| haen-6-62-r3 | **INSTALL-WITH-FIX Haenstraat 12 (102574)**: brick #a1785e → **#88654b**; photo #77583f. |
| zwijgerlaan-225-279-r1 | INSTALL Willem de Zwijgerlaan 231 (109779), 235 (133739) |
| zwijgerlaan-225-279-r2 | INSTALL Willem de Zwijgerlaan 247 (151482) |

### `landlust-1933-erker-window` (treslong-5-59, 16 pands): INSTALL-WITH-FIX

The photo alternates erker-left and narrow-window-left on every pand from 1 to 16. The model breaks that alternation at three pands.

**Mirror pins:**
- **121629 (pand 12)**: `mirror: true`, currently false. The photo has the narrow window and door on the left and the erker on
  the right.
- **068576 (pand 13)**: `mirror: false`, currently true. The photo has the erker on the left and the door on the right.
- **145888 (pand 16)**: `mirror: true`, currently false. The photo has the narrow window on the left and the erker on the right.

**Brick:**
- Pin the whole run to **#573f2b**. Model walls are about #6a4c33 (with 146039 at #825734); the photo is dark purple-brown, about
  #4a3626.
- This also fixes **151495 (pand 2)**, which renders **blue-grey #808d96**. Its wall was measured off the scaffolding.

The other 13 pands' mirrors match the photo. Pands 1-4 are partly scaffolded in the photo but still readable.

Pands: 151165, 151495, 126346, 114449, 109065, 113093, 132461, 065427, 146039, 144404, 114752, 121629, 068576, 111921, 105923, 145888.

### `landlust-1934-tile-pair`: INSTALL-WITH-FIX (brick)

| Run | Verdict |
|---|---|
| leijnsen-2-30-r1 | **INSTALL-WITH-FIX** 064868, 074955, 107813, 123427, 140619, 081763, 137482, 117865. Brick → **#6c583e**: the model is olive-tan, about #8a6f4e, against the photo's red-brown, about #584834. Mirrors and doors all match: single window at the party wall, close pair, doors paired across the party walls. **HOLD 132371 (pand 7)**: the photo has a canted erker over storeys 1-2 and wide ground windows, a different front that the type does not draw. |
| haring-26-38-r1 | **INSTALL-WITH-FIX** Jan Haringstraat 34 (068528), 072687, 071938. Brick → **#69563d**: model about #836b49, photo about #52432e. Mirrors match. |

### `landlust-1933-three-axis-tile` (coppelstock-25-55-r1, 7 pands): INSTALL-WITH-FIX

**Every pand is mirrored the wrong way.** On each front the photo's door and wide ground window are swapped relative to the model.
Flip all seven:

- 149193 → `false`
- 066272 → `true`
- 104481 → `false`
- 104480 → `true`
- 122456 → `false`
- 100119 → `true`
- 089839 → `false`

**Brick:** pin the run to **#6b5a46**. The model is a patchwork from #88644b to grey-olive #7e7662 (104481); the photo is a uniform
#564c3c to #5f5442.

### `landlust-1937-three-axis-four` (haring-1-11-r1): HOLD both

- **Jan Haringstraat 3 (148081):** mirrored the wrong way (the photo is wide window left, door right). The model also has no roof:
  "front flat 11.59" against the photo's tile roof with dormers.
- **Jan Haringstraat 5 (062858):** mirrored the wrong way (the photo is door left, wide window right).
- **Row count:** the photo's top window row is under lens flare, so the row count against the model's three upper rows is
  unverified.
- **If re-run:** pin mirrors 148081 → `true` and 062858 → `false`, and give 148081 the tile roof.

### `landlust-1938-pair-attic`

| Run | Verdict |
|---|---|
| leijnsen-3-31-r1 | **INSTALL-WITH-FIX** 078570, 121647, 066007, 104220, 073086. Brick → **#745b41**: the model is a red/olive patchwork, about #8a6a4c; the photo is about #655039. Mirrors, doors, attic windows and the white slab all match. |
| treslong-6-26-r1 | INSTALL 066487, 103630, 124502. Mirrors and doors match, and the walls are within tolerance. |

### `landlust-1938-ribbon-attic` (haring-6-18-r1): INSTALL all 5

145712, 093157, 111802, 148568, 127749. The white-framed window pair, the attic ribbon between white piers and the white eaves slab
all match, as does every mirror. (127749 sits 0.42 m high; that is within tolerance and optional to clamp.)

### Other held runs

haring-13-27-r1 (066992, 098683, 144291, 100954): HOLD.
- The gates fail.
- The photo shows a pointed gable tower over pands 2-3.
- Pand 4 has a two-window front.
- Pand 1 is mirrored the wrong way.

## Top 3 likeness gaps per type

**Bestevaer stair/half block**
1. Missing dark brick plinth with the arched stair door under the pilaster. The door is drawn rectangular at the pand edge.
2. Missing glass-brick stair pilaster and the paired-window rhythm around it. Pand-based placement cannot centre the block's
   design.
3. Per-pand measured walls make a patchwork on a uniform block. Needs one run value.

**Slot block (3 and 4 storeys)**
1. The four doors in pairs under one flat canopy are drawn as one double door plus a window.
2. The two zinc box dormers per block (Andringa, Callenburg 2-32, Haen, Zwijgerlaan) are not drawn.
3. The slot lights are drawn one per storey instead of running continuously from the first to the top storey. The orange concrete
   lintel band above the slots (Haen 6-62, Zwijgerlaan) is missing.

**Erker-window (Treslong 5-59)**
1. The canted, white-framed erker over storeys 1-2 with its hood is a flat front box. The ortho shows a plain wide window.
2. The tile roof is drawn as a large slate plane with no dormers. The photo shows small box dormers and roof lights, and from the
   street much less roof mass.
3. Brick reads lighter and more orange than the dark purple-brown photo (fixed above). The mirror alternation broke at 3 pands.

**Tile-pair**
1. The box dormers with chimneys on the tiled roof are missing; the roof is a plain slate saddle.
2. Brick is olive-tan against red-brown (fixed above).
3. The windows lack the photo's two-over-two sash division and white top-light bars. The paired-door canopy is not drawn.

**Three-axis tile (3 and 4 storeys)**
1. The whole run was mirrored the wrong way ("photo decides" failed on every pand).
2. The box dormers on the tiled roof are missing.
3. Grey-olive tone patchwork. The ground window lacks its transom row.

**Pair-attic / ribbon-attic**
1. Brick on Leijnsenstraat is lifted and mixes red and olive (fixed above).
2. The windows lack the two-over-two division the photo shows.
3. The paired house doors' light canopy is not drawn.

## Install list

**INSTALL (37):**
- slot-block: 080635, 069920, 124713, 103458, 063379, 107097, 095699, 125512, 119108, 132798, 098318, 140098, 140644
- slot-block-four: 107347, 109779, 133739, 151482
- pair-attic: 066487, 103630, 124502
- ribbon-attic: 145712, 093157, 111802, 148568, 127749
- erker-window: 151165, 126346, 114449, 109065, 113093, 132461, 065427, 146039, 144404, 114752, 111921, 105923

  These erker-window pands still take the run brick pin #573f2b.

**INSTALL-WITH-FIX (36):**
- **Slot-block brick #7a4c2f:**
  - 105359, 073024, 137010, 082410
  - 066626 and 063567, also eaves 10.65 m
  - 114763, also eaves 10.1 m
- **Slot-block-four brick:** 084532 → #815f45; 102574 → #88654b
- **Erker-window:** 151495 (blue-grey wall, fixed by the run brick #573f2b); mirror pins 121629 → true, 068576 → false,
  145888 → true
- **Tile-pair:**
  - Leijnsen 2-30, brick #6c583e: 064868, 074955, 107813, 123427, 140619, 081763, 137482, 117865
  - Haring 26-38, brick #69563d: 068528, 072687, 071938
- **Three-axis tile, all mirrors flipped plus brick #6b5a46:** 149193, 066272, 104481, 104480, 122456, 100119, 089839
- **Pair-attic, brick #745b41:** 078570, 121647, 066007, 104220, 073086

**HOLD (31 placed, plus 7 on gate-failed runs):**
- All 28 Bestevaer pands
- Leijnsenstraat 132371 (erker front)
- Haringstraat 148081 and 062858
- Gate-failed runs: haring-13-27-r1 (4) and treslong-30-62-r1 (3)
