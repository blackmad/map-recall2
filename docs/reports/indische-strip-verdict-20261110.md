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
