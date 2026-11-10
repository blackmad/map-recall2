# Plantage (AJ02), 2026-11-10

Lane `lane/buurt-plantage-20261110`, MODEL: sonnet. Sheets and strips: `/Users/blackmad/Code/map-recall2-source-data/block-face-strips/plantage-20261110/`.

## Census
303 BAG pands (399 by BAG units), 275 built by 1945, 98 proposed faces, library before: none. BAG build years scatter 1798-1890 on single designs (Badlaan 1-11 reads 1807-1881), so year does not separate designs; eaves and the photo do. Faces are mostly short (1-8 pands) and designs are individual villas and terraces; the only repeated-row stretches are Badlaan, Doklaan 28-42, Kerklaan 2-34 (left gabled rows) and Muidergracht (varied stucco villas). Intake ran for 15 faces of 8+ pands (strips 2024-12-10; the 2024-12-10 strips of Badlaan and Doklaan were blown out, re-stripped from 2023-01-02). No grey strips (checked after the 404 broadcast).

## Types (scripts/block-face/types/plantage/)
| type | design | status |
|---|---|---|
| `plantage-1881-polychrome-two-axis` | Badlaan 13-21: ground + 2, dark brick with yellow speklagen, two segmental axes, double door, pediment dormer | placed 5, INSTALLED |
| `plantage-1881-segmental-anchors` | Badlaan 1-11: four storeys, three axes, wall anchors, heavy cornice | placed 0 in the final run (3 and 5 failed the likeness run gate with the polychrome run in the same face; 1C held for balcony stack), type kept |
| `plantage-1855-brick-hood` | Badlaan 6-14: corbelled hoods, balcony stack | compiled but GLB audit failed (opening-outside), held |
| `plantage-1880-stucco-cartouche` | Doklaan 30-38: stucco, cartouche heads, pentagonal dormer | held: edge NCC below gate / washed-out strip |

## Yield (the three installed-or-tried faces)
badlaan-1-21 (10 pands): vetoed-before-comparison 2 (7 two-front pand, 11 strip evidence), compared-and-held 3 (1C review hold, 3 and 5 type run), placed 5. badlaan-4-24 (11): held 6 by review (different designs), 5 compiled but GLB audit failed, placed 0. doklaan-28-42 (8): vetoed 0, compared-and-held 8, placed 0. **Installed: 5 pands** (Badlaan 13, 15, 17, 19, 21; chunk `face-badlaan-1-21-r1`).

Faces with strips but no type authored: kerklaan-2-34 (left half: neck-gable rows with arched windows; right half: one big 1890 block), polaklaan-2-42 (low-gabled 1850s row, 6 pands), middenlaan-1-33, middenlaan-72-86, muidergracht-1-29/51-71/73-93/101-133 (stucco villas, individual), kerklaan-27-49/1-23.

## Kit
No kit component added. What the kit cannot say: the yellow cross-shaped brick hood over each head (drawn as an arch ring); corbelled brick hoods of the 1850s Badlaan fronts; per-house balcony stacks varying on a row; a stucco ground storey under a brick front (Badlaan 5); wall-anchor cartouches; a dormer with swept cheeks; cartouche heads (Doklaan).

## Open
- Badlaan 4-24 glb-audit `opening-outside` on the hood type; Doklaan likeness gate abstains on the washed-out white stucco; 2023-01-02 is the best strip day found, others not tried.
- Integrator: `build-chunk-wall-exposure.ts --write`, covers, bake-frontages, explorer-looks, buurt pages; archive strips done.

## Round 2: Opus verdict applied (`plantage-strip-verdict-20261110.md`)
Mirror pins for 181073, 171261 and 170230 (doors now R L R L R as photographed); palette pin #5f4d42 on 181073; upper storeys +0.15 m (eaves still 3DBAG 12.03, the verdict's 12.5 m is not reachable without leaving the roof from 3DBAG); `casement-transom` panes (one undivided pane, no mullion); hood = `archRing` style `blocks`, 5 courses (0.28 m) of yellow #c9a86a voussoirs alternating with wall brick plus the crown block; dormer 1.3 m. Kit: `windowHead.rise` (metres, segmental only, 0.15 here; tested in `plantage.test.ts`, absent = byte-identical). Not done: the yellow frieze band (no kit slot for a band at the frieze line) and the scrolled dormer pediment; the hood is 0.28 m deep, not 0.35-0.4 (widthCourses caps at 6 and ring would collide with the window above). Re-installed over the same chunk; roof golden re-recorded (1 intent change, badlaan-1-21-r1 only).

## Round 3 (stopped at the user's install freeze): Polaklaan 16-26 and Kerklaan 24-32
Nothing installed in round 3 (the freeze arrived mid-run; auto-place never installs).
- **Type `plantage-1855-point-gable-row`** (Henri Polaklaan 16-26, 6 pands: 181404, 181327, 181398, 181399, 181400, 181326): raised ground (double door on the left axis in all six, as photographed), two upper storeys, three axes, pointed brick gable. `crownRise` is in upper-storey heights (0.62 x 3.4 m); first draft 1.9 drew a 6 m gable. Sheet read by eye: window rows, gable, doors line up in the overlay; 181326 is painted dark grey-black (palette pin #46474a). Held back from install: the GLB audit failed `zfight-tight` (roof slate 2-3 cm under the brick rakes, 3.8-5.1 m2); `roof.rakeClear: true` was set to cure it and the re-run was queued when the freeze came, so the cure is untested. Sheet: `sheet-polaklaan-2-42-r1-held-zfight.png` (the pre-`rakeClear` run).
- **Type `plantage-1879-neck-arched-shop`** (Kerklaan 24-32, design present on 32, 30, 26, 24): 2 placed (26, 24), storey-height gate FAIL because 3DBAG eaves (15.4-16.4) sit below the photo cornice 17.0 m; 32 held on likeness (NCC 0.119), 30 (usable photo 49 %). Needs reviewRoofs eaves pins (`e35f9b21e`/`639978c1f`, not cherry-picked: that commit also carries a kit change and installs). Crown rise fixed to 0.4 (also in upper-storey heights). Sheet: `sheet-kerklaan-2-34-r1-held-gates.png`.
- Holds with reasons are in `scripts/block-face/buurten/plantage-review-holds.json` (Polaklaan 2, 4, 6A, 14, 30, 32; Kerklaan 2-22 except 24-32).
