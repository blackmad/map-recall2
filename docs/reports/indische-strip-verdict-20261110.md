# Indische Buurt strip review, lane/buurt-indische-20261110 (2026-11-10)

Opus strip reviewer. I read every run sheet at full resolution and checked it against the 40 px/m strips with
PIL crops and medians. I did not rely on the lane's self-assessment. Sources are in
`map-recall2-source-data/block-face-strips/indische-20261110/`. djambi-1-35-r1 was renamed to **djambi-1-29-r1**
(same 12 pands, same frames). The verdicts below use `sheet-djambi-1-29-r1.jpg`.

Pixel scale: strips are 40 px/m and the sheets about 28.5-40 px/m. The colours are medians of the raw strip pixels.

## Verdicts per run

| run | verdict | pands to install | per-pand holds |
|---|---|---|---|
| djambi-1-29-r1 | **INSTALL-WITH-FIX** (1913 type fixes A-D) | Djambistraat 9, 11, 13, 15, 17, 19, 21, 23 (131961 100535 110582 099261 129720 077761 072833 108617) | **5** (149516) and **7** (104592): a different design. The photo has a pointed brick gable over the pair, narrow paired windows, no arched pair, white timber dormers and a double door, but the model draws the arched-pair type. **25** (117530): the sheet's one gate FAIL (gap 0.4 m), and its photo is a ghosted double exposure. **27** (095414): the photo puts the whole arched pair inside this pand, and the strip gutter sits about 0.7 m above its neighbours while 3DBAG says 12.70 m. Resolve that boundary/registration first |
| soenda-2-36-r1 | **INSTALL-WITH-FIX** (1913 fixes A-D, plus a mirror flip and row palette) | Soendastraat 28, 26, 24, 22, 20, 18 | **30** (113301): a different front (narrow paired windows, white timber dormer, the gabled corner beside it). Per-pand fix: **Soendastraat 26 (069113) needs `mirror: true`**. The photo has its arched window and door on the left (it pairs with 28 across the wall), but the model draws them on the right |
| soenda-2-36-r2 | **INSTALL-WITH-FIX** (1913 fixes A-D, row palette) | Soendastraat 14, 12, 10 | **8** (092089): a different design (paired narrow windows, timber dormer with hoist, gable, eaves 13.39 m). The mirrors are right on 14/12/10 |
| java-93-149-r1 | **INSTALL-WITH-FIX** (mirror flips are mandatory, plus 1912 fixes E-G) | Javastraat 97-109 (7) | Mirror flags are **inverted on 6 of 7 fronts**. In the photo the narrow arched pair sits LEFT of the balcony axis on 97, 101, 105 and 109, and RIGHT of it on 99, 103 and 107. Set `mirror: true` on 97 (132949), 101 (120527), 105 (133860) and 109 (126147). Remove it from 99 (138717) and 103 (081977). Java 107 is right as it is. The run is consistent with r2, where 113 is mirror:true and pair-first. The sheet header says GATES FAIL but no per-pand row shows the failure; find and clear it before install |
| java-93-149-r2 | **INSTALL-WITH-FIX** (1912 fixes E-G) | Javastraat 113, 115 | none. The mirrors are right. 113 is mostly hidden behind a bare tree, but the design is confirmed by 115 and r1 |
| lampong-2-20-r1 | **HOLD** | none | The type's defining feature is red sashes inside white frames, and the model draws none (the kit has no sash colour). The brick comes out blue-grey because of a white-balance error in the 2025 panorama (below). Two fronts are also mis-mirrored: Lampongstraat 6 (085260) needs `mirror: true` and Lampongstraat 4 (064007) needs `mirror: false`. In the photo, 6 has its narrow pair and door on the left and 4 has its wide pair on the left with the door on the right |
| borneo-7-27-r1 | **HOLD** | none | **13** (074710): the front does not read as the four-axis pair design. There is a wide window over a door on the left and no narrow pair, while the model puts the door on the right. **15, 17, 19**: the photo roofline is shared pointed brick gables centred on the 15\|17 and 19\|21 party walls, beside a white dormer. The model draws only a glazed dormer, and the kit can already draw these gables (see 1914 gap 2). **21, 23, 25** (084255 133599 102480): a different design. These have three-light narrow groups, cream window surrounds, single-leaf doors and a visible tiled roof with box dormers. 21 is also hidden behind a sculpture/fence. The red sashes are missing on all of them |
| djambi-38-46-r1 | **HOLD** | none | **40** (125682): the door-side group is three narrow lights, not two. With only two pands in the run, that means a 5-axis variant or a `storeyAxes` change. **38** (113540): the corner front is mostly behind a tree, has a higher flat cornice and no dormer in the photo, while the model draws a dormer. Red sashes are missing, as on Lampong |

Installable now with fixes: **8 + 6 + 3 + 7 + 2 = 26 pands**. Held: 4 + 1 + 1 per-pand holds plus the
three 1914 runs (14 pands).

## Fixes, measured

### 1913 `indisch-1913-arched-pair-dormer` (Djambi, Soenda)

- **A. Gutter/cornice, the wrong white accent.** The photo shows a bracketed timber eaves overhang: a thin grey
  gutter lip (Djambi #798078, Soenda #826f68) over a **dark bracketed soffit about 0.4 m deep (#443937)** with
  console brackets. The model draws a flat cream band, `cornice: simple`, with `palette.cornice #dfdad0`.
  Change `crowns.*` to use `eavesOverhang {projection 0.45, fascia 0.15, colour "#7d7570", soffit "#443937"}` with
  `cornice: "none"`, the same pattern the 1914 type uses. The alternative is `cornice: "bracketed"` with
  `palette.cornice` set to #443937. Do not keep the cream.
- **B. Dormer window is 2.4x too tall.** `dormerWindow.light` only sets the width. The light then runs the whole
  `dormerSize.rise` of 2.2 m, so the model shows a 2.0 m tall two-light window. The photo shows an
  **0.83 m wide x 0.85-0.88 m tall** window on a white sill at the dormer foot, with solid brick above it. The
  dormer is 2.1 m wide with shoulders at about 1.7 m and an apex 2.5-2.6 m above the gutter. The model apex is
  about 0.9 m higher than the photo's (overlay).
  - Field fix: `dormerSize.rise` 2.2 → **1.1**. Then check that the apex lands at 15.1-15.4 m.
  - Kit gap: `dormerWindow` needs a `height` (or `head`) so the cheeks can stay 1.7 m tall.
- **C. Arch hoods and sills are cream where the photo is brick/dark.** The arched windows sit under a flush brick
  rowlock (#614e48, the wall colour). The sills are dark grey-green (#434c47). Set `palette.stone` #dfdad0 →
  **#4a4a45** and keep `frame` cream; the frames are white in the photo.
- **D. Door.** The photo has ONE recessed opening about 1.1 m wide on the party wall. Inside it is a single dark leaf
  under a white transom, with mailboxes and house numbers on both jambs (a shared portiek). The model draws two
  flush double-leaf doors side by side, 1.6 m in total.
  - Field fix: add `grounds.door-right.doorReveal {form: "portiek", jamb: "brick", deep: <measure with
    door-reveal-sheet>}` and narrow the leaf.
  - The type cites no reveal evidence. That breaks the post-#181 rule, so measure it before install.
- **Soenda row palette.** The trim-normalised per-pand bricks jump from #725b4f/#765e51 (30, 28) to
  #886c5a-#8b6e60 (26-18) along one identical row. In the sheet this reads as two tones. Clamp the row to one
  median: about **#836856** for r1+r2 on Soenda; Djambi stays at about #5b4942. The raw photo medians are
  #755f4e (Soenda) and #604c45 (Djambi), on the same day and the same design. That is a real exposure difference,
  but each row must be uniform.

### 1912 `indisch-1912-java-mansard-arches` (Javastraat)

- **E. Window heads.** The photo windows are **square-framed openings under shallow segmental brick arches**. The
  arch rings are polychrome, with cream voussoirs alternating with brick, and there is a dark tympanum crescent
  between the arch and the frame. The model draws full semicircular glazed round heads with a plain cream hood.
  - Set `body.windowHead.kind` "round" → **"relieving"** (the kit's square head under a segmental arch, with a
    brick tympanum), add `tympanum: "dark"`, and keep `archRing {colour: "band", widthCourses: 2}`.
  - The lane's "3 courses escaped the facade" problem goes away with the lower segmental rise.
- **F. Speklagen.** Thin cream courses run across the whole front at arch springing and at mid-window height on
  every upper storey. The kit **does** have `brickStripes`, so the lane's schemaLimits entry is wrong.
  - Add `brickStripes` zones over storeys 1-3 with `stripe` 0.07 (one course) and `palette.band` #b0a891, which is
    already set.
  - Measure the pitch and feet on a gridded crop (`grid-crop.ts java-93-149 764 1004`). By eye they are about
    0.35-0.75 m apart.
- **G. Balcony on storey 1.** The photo has an iron railing in front of the storey-1 balcony door, above the shop
  fascia. The model draws an arched window there. Set `balconies.storeys` [2,3] → **[1,2,3]**, or give storey 1 a
  non-projecting rail if the kit allows a different setting per storey. Make `axisWindows.1` a door on storey 1 as
  well.
- The trim-normalised Java bricks render about 15-20 levels lighter and pinker than the photo (for example 115:
  photo #6e5e53, model #89766f). This is within the brightening policy, but check the hue.

### 1914 `indisch-1914-red-sash-pairs` (held)

1. **Kit:** add a sash colour (`palette.sash`) so the openings can show white outer frames with red sashes and
   transom bars. Until then the type misses its namesake.
2. **Lampong brick:** the white downpipe in the 2025 strip reads **#d1e6fb**, a strong blue cast. The palette
   `grey` #7b7c7d and the per-pand `measuredPalette` values (#7c8183…) inherit it, and the model renders #77858e
   blue-grey. White-balanced against the pipe, the brick is a warm grey of about **#807c6d**. Either use that, or
   use Borneo's `grey-brown` #6d5d53 for this one design, and drop the per-pand values.
3. **Dormer:** add `dormerBody: "timber"` to `flat-dormer`. The photo dormers are white timber boxes, about 1.25 m
   wide and 1.6 m tall, with white cheeks and a hoist beam. At gallery size the model's glazed panel reads as a
   skylight.
4. **Borneo gables:** add a crown variant with `crownHalf` and `crownAt` on the gable side. The kit has
   `crownHalf` (Transvaal 1911 types), which contradicts the lane's "kit cannot". Measured on 17|19: a brick gable
   about 4.7 m wide centred on the party wall, with its apex about 2.85 m above the gutter (about 15.7 m) and a
   pair of attic windows in each half.

## Top 3 likeness gaps per type, ranked

**indisch-1913-arched-pair-dormer**
1. The eaves are a flat cream band where the photo has a dark bracketed timber overhang with a grey lip. Together
   with the cream arch hoods and cream sills, this puts white accents where the photo has none (fixes A, C).
2. The dormer: a 2 m glazed slot under a too-tall spike, where the photo has a small 0.85 m square window in a
   shouldered brick dormer (fix B, plus the kit `dormerWindow` height gap).
3. The door: two flush double-leaf doors per pair, where the photo has one recessed single-leaf portiek opening on
   the party wall (fix D, reveal unmeasured).
   - Next after these: the pane layout. The photo has a single lower light under a top light at about 0.68 of the
     height, in dark-green sashes with iron sill rails. The model uses `casement-toplight` with a white mullion. A
     "toplight over a single light" window kind does not exist.

**indisch-1914-red-sash-pairs**
1. No red sashes. White frames only, so the model loses the face's identity (needs a kit change).
2. Roof mass: Borneo's shared pointed brick gables are missing, and the white timber dormers come out as flush
   glazed panels.
3. Brick tone and layout: Lampong renders blue-grey from an uncorrected white balance. Mirroring is wrong on
   Lampong 4/6 and Borneo 13. Djambi 40's three-light narrow group is drawn as two.

**indisch-1912-java-mansard-arches**
1. Mirroring is inverted on 6 of 7 r1 fronts (the narrow pair is on the wrong side of the balcony). This is a
   placement error, but the type's `mirrorForDoor` can't decide it on shopfronts with centre entrances. Mirror
   from the position of the arched pair instead.
2. Window heads: glazed semicircular arches with cream hoods, where the photo has square frames under polychrome
   segmental relieving arches with dark tympana (fix E).
3. Missing speklagen (the cream courses) and the storey-1 balcony railing. Both can be expressed today (fixes F,
   G).

## Notes on the lane report

- The "kit cannot express" list is partly wrong. The pointed gable over two fronts can be drawn with `crownHalf`
  and the speklagen with `brickStripes`. What is genuinely missing is: sash colour, a door with a shared frame (or
  a shared portiek), a height for `dormerWindow`, and a window kind with a top light over a single light.
- The Soenda photo strip is registered about 1 m low: the ground floor and doors are cut off at the bottom. The
  vertical alignment in the overlay is therefore not reliable on that face. Re-pull the strip before using its
  ground storey as evidence.
- On the Djambi/Soenda roof, the lane's claim holds. A roof of about 30° behind the gutter cannot be seen from 2.1 m
  at 12 m, so the large red-tile plane in the orthographic view is not refuted by the photo. Red tile is unverified,
  though (check it against the ortho).

## Round 3 (lane at 432d6311b, sheets re-made 2026-11-10 02:42)

I read all seven new sheets, including Soenda r1/r2, Borneo and Java r2, which the lane did not look at. I zoomed
on the doors, dormers, heads and mirrors. I checked every mirror against the photo position of the arched or
narrow pair.

### Per-pand list

| run | pand | verdict | why |
|---|---|---|---|
| lampong-2-20-r1 | Lampongstraat 10 (140561), 8 (150248), 6 (085260), 4 (064007), 2 (112381) | **INSTALL** | All 5 mirrors now match the photo: the narrow pair and the door sit together, on the left for 8 and 6 and on the right for 10, 4 and 2. The red sashes in cream frames read correctly, and the white timber dormers are right. Brick is #807c6d, corrected against the white downpipe; it renders #898370 against the blue-cast photo #808283. Accepted. Minor follow-up: the model draws a red mullion through the lower light of the wide windows, but the photo has a red sash outline and transom with an undivided lower pane |
| djambi-1-29-r1 | Djambistraat 9, 11, 13, 15, 17, 19, 21 | **HOLD (door)** | The dormer (small square light), eaves overhang, dark sills and auto-detected door sides are all right now. The 9/13/17 door sides match the photo. **The new door is a regression:** each front draws a 0.45 m cream-framed slot whose leaf renders cream (#e9e5da) with two black grooves, with a 0.3 m brick pier left between the halves on the party wall. In the photo it is one dark opening about 1.1 m wide with no pier. At gallery size it reads as two white ladders. Fix: render the leaf in `palette.door` #2a2622, and set the `doorReveal.edge` inset to 0 so the halves meet on the wall. After a re-sheet, all 7 are INSTALL |
| soenda-2-36-r1 | Soendastraat 28, 26, 24, 22, 20, 18 | **HOLD (door, brick)** | The mirrors are now right on all six. The 22/18 door sides agree with the arched-pair positions. The door is the same cream slot as on Djambi. **Brick:** `soenda-brown` #836856 renders #8e7361-#907362 against photo #745e51-#776052, which is 25-30 levels lighter and visibly pinker than the photo. My round-1 figure came from the trim-normalised per-pand values, not raw pixels; that was my error. Fix: set the brick to about **#6c5647**. That lands the render where Djambi's does, about +10 over the photo |
| soenda-2-36-r2 | Soendastraat 14, 12, 10 | **HOLD (door, brick)** | Same as r1 (photo #725d50 / model #917666 on 12). The mirrors are right, and door 14 is correct |
| java-93-149-r1 | Javastraat 95 (067472) | **HOLD (mirror)** | This pand is new in this run. The photo is [wide][balcony][narrow pair] and the model draws it pair-first. It needs the opposite of its current mirror flag |
| java-93-149-r1 | Javastraat 97, 99, 101, 103, 105, 107, 109 | **HOLD (speklagen, heads)** | The mirrors are all correct now, and the storey-1 balcony and the 70° front attic with its dormer are right. Two gaps remain. **1. Heads:** each window now has a flat beige (#b0a891) trapezoid cap, which reads as a stone lintel. The photo has segmental brick arches in red brick with cream accents over a dark tympanum, and the tympanum does not show in the render. Fix: set `archRing.colour` to wall brick instead of band, and check that the tympanum actually draws dark. **2. Speklagen:** the photo's cream banding is the face's signature at gallery size, and it was dropped. The 0.46 m pitch does not fit the triangle budget, but two courses per storey do. Use two `brickStripes` zones, each pitch 3.0 m and stripe 0.07 m: one at the arch springing line and one at sill level. That is 8 stripes a house, about 250 triangles going by the lane's 800 for about 26 stripes, so about 2920 of 3000 |
| java-93-149-r2 | Javastraat 113, 115 | **HOLD (speklagen, heads)** | Mirrors are correct; held for the same two gaps as 97-109 |
| java-93-149-r2 | Javastraat 117 (141749) | **HOLD (mirror + the above)** | This pand is new. The photo is [narrow pair][balcony][wide] and the model draws it wide-first |
| borneo-7-27-r1 | Borneostraat 15 (090483), 17 (108761) | **HOLD (crown on the wrong wall; mirrors inverted)** | **This is my own round-1 error.** The shared gables stand on the 13\|15 and 17\|19 party walls, not on 15\|17. My bo_a crop puts the gables at about 245 px and about 640 px, with the 13\|15 boundary at 214 and 17\|19 at 642. In the new sheet the gable halves show at the outer edges of 15 and 17, and the white dormers sit next to the 15\|17 wall. The photo has 15 with its narrow pair and door on the LEFT and 17 with them on the RIGHT, and the model draws both the other way round. The pins should be **15 `mirror: true`, 17 `mirror: false`**. Each front carries the far half of a gable whose partner (13 or 19) is held, so they stay held until 13 and 19 can be built. The model's gable apex also rises well above the photo's |

### Install list (round 3)
**Lampongstraat 2, 4, 6, 8, 10** (112381, 064007, 085260, 150248, 140561): 5 pands.

After one re-sheet:
- **Djambistraat 9-21** (7) become INSTALL with only the door render fix.
- **Soendastraat 28-18 and 14-10** (9) need the door fix plus brick #6c5647.
- **Javastraat 97-115** (9) need the arch-ring colour plus two-course speklagen.
- **Javastraat 95 and 117** need mirror flips on top of that.

## Round 4 (lane at 58c49d90a, sheets of 2026-11-10 03:00)

I read all six sheets again and checked every mirror against the photo. I zoomed on the Djambi door and the Java
heads and stripes. I measured wall medians, photo against model, on the sheets.

### Door verdict: two dark openings are acceptable
The photo, enlarged, shows one dark opening of about 1.1 m under a wide transom, with dark mailbox panels on both
jambs. The model draws two dark 0.45 m openings with small transoms and a 0.3 m brick pier between them. At
gallery size both read as a dark band about 1.5 m wide in a dark-light-dark rhythm. The cream "ladders" of round 3
are gone, the reveal is 0.25 m, and nothing reads as a flush or white door. The pier sits where the photo has the
single leaf, but that is a sub-metre detail, and the GLB audit forces it (0.15 m minimum inset). **Accepted.** Log
it as a kit gap: a pair-module door that crosses the party wall.

### Per-pand list

| run | pand | verdict | why |
|---|---|---|---|
| lampong-2-20-r1 | Lampongstraat 10, 8, 6, 4, 2 | **INSTALL** | Mirrors are unchanged and correct. The wide windows now have an undivided lower pane under a red transom, matching the photo |
| djambi-1-29-r1 | Djambistraat 9, 11, 13, 15, 17, 19, 21 | **INSTALL** | Door accepted (above). All 7 door sides match the photo doorways: 9\|11, 13\|15, 17\|19, and 21 on the right, which agrees with its arched window. Dormer, eaves, sills and brick are right (render about +10 over the photo, in line with the rest of the library) |
| soenda-2-36-r1 | Soendastraat 28, 26, 24, 22, 20, 18 | **HOLD (brick)** | **The #6c5647 change did not take effect.** Every pand in the run intent carries a trim-normalised `measuredPalette.brick` (#765e51 … #8b6e60), and that overrides the type palette. The render is unchanged: model #8e7463 against photo #796d61, and #8e6f5d against #796252, about +20-25 and pinker. Fix: remove the per-pand `measuredPalette` from soenda-2-36-r1 and -r2, or set it to #6c5647, then re-sheet. Doors and mirrors are fine |
| soenda-2-36-r2 | Soendastraat 14, 12, 10 | **HOLD (brick)** | Same override problem: #8a6d5c, #8d6f5e, #866b5d. Model #917567 against photo #745f4c, +29 |
| java-93-149-r1 | Javastraat 101, 103, 105, 107, 109 | **INSTALL** | All mirrors are correct. The heads are now dark brick segmental caps over the windows, and two cream courses per storey read as the speklagen at gallery size. The wall check passes on all five |
| java-93-149-r1 | Javastraat 97 (132949), 99 (138717) | **HOLD (brick)** | Their per-pand bricks, #806c62 and #7e695e, are the lightest in the row. They render #87736a and #867164 against photo #695b53 and #625045, +30, and visibly pinker than 101-109 beside them. Fix: set both to about #72604f, the median of 101-109 |
| java-93-149-r2 | Javastraat 113, 117 | **INSTALL** | Mirrors are correct, including the 117 flip, and the wall check passes |
| java-93-149-r2 | Javastraat 115 (103232) | **HOLD (brick)** | Model #89766f against photo #6d5d52, +28. Same fix as 97/99 |
| java-93-149-r2 | Javastraat 119 (085970) | **HOLD (mirror)** | New in this run, with an auto mirror. The photo is [wide][balcony][narrow pair] and the model draws pair-first. Its dormer is also a dark brick hooded dormer, not the white pediment |
| java-93-149-r2 | Javastraat 121 (110585) | **HOLD (mirror, crown)** | New in this run. The photo is [narrow pair][balcony][wide] and the model draws wide-first. It also has a tall stepped brick dormer-gable that the model omits |
| — | Javastraat 95 | not in any run | Its pin flip (`false`) is right going by the round-3 photo, [wide][balcony][pair]. But 95 is not in r1 or r2 now, so there is nothing to install |

### Install list (round 4): 19 pands
- Lampongstraat 2, 4, 6, 8, 10
- Djambistraat 9, 11, 13, 15, 17, 19, 21
- Javastraat 101, 103, 105, 107, 109, 113, 117

Next re-sheet:
- Soenda (9 pands): drop the measuredPalette overrides.
- Javastraat 97, 99 and 115: brick #72604f.
- Javastraat 119: flip its mirror and give it its own dormer.
- Javastraat 121: needs a mirror flip and a stepped crown, so it is a separate job.

## Round 5 (lane at 4c5c5f95e, install 4111b2b40; sheets of 2026-11-10 03:15)

### Javastraat 115 (installed in 4111b2b40): **CONFIRMED**
- There is no install sheet for r2. `sheet-java-93-149-r2.jpg` is still the 03:01 round-4 render.
- I verified the installed intent instead. At 4111b2b40, house 115 carries `paletteOverrides {brick: "#72604f"}`. In
  `houseType.ts` the palette resolves as `{...named, ...measured, ...paletteOverrides}`, so the pin beats the
  trim-normalised `measuredPalette` #846f67.
- The same pin renders on the r3 sheet (97/99) as **#7e6a57 against photo #695b52 and #635145**. That is about +12,
  in the same band as Djambi and Lampong, and both pands pass the wall check.
- So 115 at #72604f is in tone with 101-109 and its photo (#6d5d52). 113 and 117 stay installed.
- Follow-up: re-sheet r2 from the installed intent, so the archive holds the shipped look.

### Per-pand list

| run | pand | verdict | why |
|---|---|---|---|
| java-93-149-r2 | Javastraat 113, 115, 117 | **INSTALL** (already installed, confirmed) | See above |
| soenda-2-36-r1 | Soendastraat 28, 26, 24, 22, 20, 18 | **INSTALL** | The #6c5647 pin is applied this time. The model wall is **#796150, uniform along the row**, against photo #745e51-#776052, about +4. That is the closest tone in the library and has no two-tone split. Mirrors: 28 right, 26 left, 24 right, 22 left, 20 right, 18 left, matching the photo's arched pairs. The two-dark-openings door is accepted as in round 4 |
| soenda-2-36-r2 | Soendastraat 14, 12, 10 | **INSTALL** | Model #7a604f / #7a6053 against photo #745f4c. Mirrors are 14 left, 12 right, 10 left, as in the photo |
| java-93-149-r3 | Javastraat 97 (132949) | **INSTALL** (likeness) | Brick renders #7e6a57 against photo #695b52, within the row. Mirror is [narrow pair][balcony][wide], as in the photo. 7 gates pass |
| java-93-149-r3 | Javastraat 99 (138717) | **HOLD (gate only)** | Likeness passes: [wide][balcony][pair] as in the photo, brick #7e6a57 against #635145. The sheet shows **GATES: triangle-budget** at 3176 triangles. Install it once it is re-placed with r1 and passes the budget; no likeness re-review is needed unless the re-place changes the front |
| java-93-149-r2 | Javastraat 119, 121 | HOLD (lane's dormer hold) | Mirrors are pinned from the photo; nothing to review this round |

### Install list (round 5)
- Installs added this round:
  - Soendastraat 10, 12, 14, 18, 20, 22, 24, 26, 28 (9 pands).
  - Javastraat 97 (1 pand).
- Confirmed already installed: Javastraat 113, 115, 117.
- Held: Javastraat 99 (triangle gate only), 119 and 121 (dormers), and the earlier holds.
