# Plantage Badlaan 13-21 strip review, 2026-11-10

Reviewer: Opus strip reviewer. Sheet: `map-recall2-source-data/block-face-strips/plantage-20261110/sheet-badlaan-1-21-r1.png`,
type `plantage-1881-polychrome-two-axis`. I compared the photo and the model side by side on a 0.5 m grid at 40 px/m and
zoomed in on the ground storey and on the first two pands' upper storeys.

The edge NCC is about 0.32, which is low. The photo itself is clear and level, though, so this review is a by-eye verdict.

## Verdicts

| # | BAG | Verdict |
|---|---|---|
| 1 | 181075 | **install-with-fix** |
| 2 | 181073 | **install-with-fix**: mirror flip, plus brick |
| 3 | 171260 | **install-with-fix** |
| 4 | 171261 | **install-with-fix**: mirror flip |
| 5 | 170230 | **install-with-fix**: mirror flip |

The model has the row right: two window axes, two upper storeys, iron anchors, yellow stripes, the door and window bay on the ground storey, and brick tone (except on 2).
The fixes below are what still reads wrong next to the photo. Three of the five doors are on the wrong side, so do not install before
the mirror pins land.

## Mirroring: three flips

In the photo the doors alternate along the row.

| Pand | Door in the photo | Door in the model |
|---|---|---|
| 1 | right | right |
| 2 | **left** | right |
| 3 | right | right |
| 4 | **left** (the window on its right is behind the tree) | right |
| 5 | right | **left** |

Each door is a double door with a two-light transom, and the ground-storey window is a single tall light with a top light.
Add these to `plantage-review-types.json`:

```
mirrors: [
  {pandId: "<181073 full id>", type: "plantage-1881-polychrome-two-axis", mirror: <flip>, reason: "photo: door left, window right (row alternates R L R L R)"},
  {pandId: "<171261 full id>", type: "plantage-1881-polychrome-two-axis", mirror: <flip>, reason: "photo: door left, window right"},
  {pandId: "<170230 full id>", type: "plantage-1881-polychrome-two-axis", mirror: <flip>, reason: "photo: window left, door right"}
]
```

The flag values are not filled in. Set each to whatever puts the door on the side given in the table. Check 5 especially: it is the only pand whose model door is on the left now.

## Fixes for the whole row

1. **Hood: confirmed by the reviewer, and it is the defining ornament.**
   - Above every upper window the photo has a deep polychrome hood about 0.35–0.4 m tall. It is made of radiating red and yellow
     voussoirs, with a yellow cross or keystone block at the crown and yellow blocks at the springers.
   - The model draws a thin yellow ring with a small block on top.
   - If the kit's arch ring can take a depth and alternating voussoir colours, use them: about 0.35 m, yellow `#c9a86a` alternating with the wall red, and a yellow crown block about 0.3 m tall.
   - If the kit cannot, this is a kit gap to add in this lane. A thin ring is not the hood in the photo.
2. **Window heads: partly confirmed by the reviewer.** The photo heads are shallow, basket-like arches: the frame rises at the top corners into a flattened
   arch. The model's segmental head is near, but its frame top is too pointed and too high in the centre. Use a
   flatter rise of about 0.15 m, or a basket arch if the kit has one.
3. **Upper-window panes.** These are one-over-one sashes with a top light and **no vertical mullion**. The model draws two lights
   with a centre bar. Remove the mullion on the upper windows.
4. **Storey heights and eaves.**
   - The ground storey matches: the door transoms and window heads sit on the photo lines.
   - The upper rows drift low against the photo. The top storey heads are about 0.6 m low, the second storey heads about 0.5 m low, and the
     cornice top about 0.5 m low. The photo reads about 12.9 m at the cornice top; the model's eaves are 12.03 m.
   - Raise the upper storey heights by about 0.15 m each, and the eaves to about 12.5 m.
   - Re-check against 3DBAG. If 3DBAG holds the eaves at 12.0, match the photo's window rows at least.
5. **Frieze.** Under the grey cornice the photo has a yellow corbel or dentil frieze, with a brick band about 1 m tall above the top-storey
   hoods. The model shows plain striped brick there. A yellow band about 0.15 m tall at the frieze line is an acceptable
   minimum. The corbelled frieze itself is a kit gap.
6. **Dormers.**
   - The photo dormer is a single, two-leaf casement about 1.3 m wide, between white pilaster cheeks, under a scrolled
     pediment with a finial. The model's dormer is about 2.2 m wide, with two lights and a plain cream pediment.
   - Narrow it to about 1.3 m with white cheeks. The low side cheeks and the scrolls are listed limits.
   - The model also shows about 1.8 m of slate above the cornice, where the photo shows none (foreshortening). This is acceptable.
7. **Brick on 2 (181073).** The photo is `#57463c` and the model `#6b574b`; it is visibly lighter than its neighbours. Move 60 % of the way: **`#5f4d42`**.
   Pands 1, 3, 4 and 5 match: the photo is `#57463c`–`#5a483e` and the models are the same.

## What the kit still cannot express

- A deep polychrome hood with alternating voussoir colours and a cross or keystone at the crown, unless the arch ring can be extended in this lane.
- A basket-arch window head.
- A corbelled yellow dentil frieze under the cornice.
- The scrolled dormer pediment with a finial, and the dormer's tall pilaster cheeks.
