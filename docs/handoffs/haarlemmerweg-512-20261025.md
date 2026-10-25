# Haarlemmerweg 512: the towers across the water (lane handoff, 2026-10-25)

Westerpark West (MVRDV), across the Haarlemmertrekvaart from Haarlemmerweg ~512.
Identified from the user's two pointers (identification only) and BAG/Commons:

| Building | BAG pand | Addresses | Built | Height | House | State |
|---|---|---|---|---|---|---|
| Salt: white grid tower, cantilevered crown | 0363100012250972 | Haarlemmerweg 940-1138 | 2023 | 46.9 m, 16 st | haarlemmerweg-940 | HELD (likeness FAIL, see below) |
| Pepper: dark brick, box balconies | 0363100012250971 | Haarlemmerweg 778-938 | 2023 | 36.5 m, 11 st | haarlemmerweg-778 | INSTALLED |
| Blend: beige stacked-block tower | 0363100012250970 | Haarlemmerweg 518A-776 | 2023 | 42-43 m | haarlemmerweg-518 | draft, not installed |
| Green-framed blocks | 0363100012570119 / 0363100012570124 / 0363100012570120 | Haarlemmerweg 1140-1166 | 2024 | ~9.5 m OSM (3DBAG API timed out) | none | not started |
| Yellow/orange brick block | 0363100012570893 | Haarlemmerweg 1400-1942 | 2025 | - | none | not started (not in building tiles) |
| Podium / garage under the towers | 0363100012250978 | - | 2023 | - | none | not in building tiles |
| Wraparound-balcony white tower | not identified | - | - | - | - | De Voortuinen? Commons photo archived under 0363100012250970 |

## Salt (940): why held
Crops for this pand in source data had been overwritten on 2026-10-25 by 2022
panoramas (the old building under demolition). Re-archived the post-completion
crops: w04-179 = 2025_09_26_05_36_39_00285, w03-359 = recording_2025-07-01_09-03-48_00772.
Likeness after the merge of the crown lane: walls[0] NO EVIDENCE (usable upper cells 38 %),
walls[1] FAIL: wall #b7b7b3 vs #dededa (dL +0.15; the raw panel reads #d9d9d4, the
light-trim normalisation maps the white wall itself to 215), glazing 0.19 vs 0.355
(reflections). Both look like measurement artefacts on a white facade, but per the
brief a FAIL is not bypassed in a lane. Integrator/user decision: either
`--allow-inferred=1:<note>` on install, or a likeness-gate rule for a white wall
that is its own light trim.

## Remaining steps
1. Integrator: re-record fit-golden for haarlemmerweg-778 and haarlemmerweg-940 only
   (`node --import tsx scripts/building-recipes/fit-golden.ts --write`; diff shows only these two),
   then `npm run check:stale-installs` clears 778.
2. In-game frame: the ground-places camera at (4.8526, 52.3849, bearing 20) shows the
   area with generic towers; Pepper's boxes were not identifiable at that distance.
   Retake closer with the GLB confirmed loaded.
3. Blend (518): a `kind: large` pass from the Commons photo
   (pand-reference-walls/0363100012250970/commons-2023 Haarlemmerweg, Asd-Blend.jpg); needs a
   stacked offset-block kit component (per-storey set-backs of whole bays), which the kit lacks.
4. Green blocks and yellow block: new houses; 0363100012570893 and 0363100012250978 are not in
   the building tiles (all-walls needs `--footprint=w<osm id>`).
