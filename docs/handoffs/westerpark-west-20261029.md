# Westerpark West remainder (#97), 2026-10-29

Branch `lane/westerpark-west-20261028`. Follows `haarlemmerweg-512-20261025.md`.

| Item | Pand | Draft | State |
|---|---|---|---|
| Blend, stacked offset blocks (2023) | 0363100012250970 | haarlemmerweg-518 | Kit added and modelled; HELD: likeness NO EVIDENCE on all 3 photographed faces |
| Green-framed blocks (2024) | 0363100012570119 / 0124 / 0120 | none | BLOCKED: no usable 3DBAG shell |
| Yellow/orange brick block (2025) | 0363100012570893 | none | BLOCKED: not in 3DBAG, not in building tiles |
| White wraparound-balcony tower (1970, renovated) | 0363100012116511 | haarlemmerweg-290 | Identified; draft exists (2026-10-21), 4/4 likeness FAIL |
| Salt white wall (940) | 0363100012250972 | haarlemmerweg-940 | wall colour now PASSes; still FAIL on glazing (reflections) |

## Blend (518)
- Kit: `footprint: "core"` (`buildingRecipe/coreFootprint.ts`) retracts the BAG
  top-view outline's 1.85 m bumps (11 steps, 117 m2) onto a 4-corner core
  (33.2 x 23.8 m) and builds a clean prism under the main LoD2.2 roof (42 m).
  `stackedBlocks` (`blockBuilding/stackedBlocks.ts`) draws per-storey rows of
  B / R / . cells: blocks 1.5 m deep with 4-pane windows, recessed balconies
  with slabs and glass rails. 56 blocks, 85 balconies, 34,978 tris.
- Rows for S, E, W were read storey by storey from rectified 2024-11-21
  panoramas (archived as `cS-179-00122`, `cE-89-00115`, `cW-269-00140`); N is
  inferred (rows copied from S).
- Why held: the cream wall is flagged as foliage by `isLeaf` (S 49 % of pixels,
  28 % of them light pastel cells that are also counted washed out); E and W
  are also too oblique (50 and 48 degrees). The S crop has real trees in front
  as well. A Sept 2025 S crop (00049) has less foliage but is occluded by
  brown autumn leaves the detector misses.
- Advisory openings-within-walls: one 1 m x 7.9 m frame-slot part at
  height 38.4 m, x = 21.4 (the roof stair box / top terrace edge), 6.46 m2
  outside its wall. Not investigated further.

## Green and yellow blocks: why blocked
3DBAG reconstructs 0119 and 0124 from the 2023 point cloud (the building
site): roof 6.4 m and 3.4 m. 0120 and 0893 are not in 3DBAG at all, and
the building tiles carry old geometry (0119 reads 3.59 m). The large tier
is built on the 3DBAG shell, so it cannot draw these honestly. The kit
needs a shell from the BAG outline plus a height measured from the
panoramas (storey lines counted on a post-completion crop). There are
2024-09-09 panoramas for 0119 (w02-359 foliage 0.33, w03-89 obliquity 41).

## Next steps
1. Integrator: commit the three new crops and walls.json rows in
   map-recall2-source-data `pand-reference-walls/0363100012250970/`.
2. Integrator: re-record fit-golden for haarlemmerweg-518 only (the diff
   shows only that house).
3. Blend: get a low-foliage, straight-on S crop (winter 2025/26 when
   available), or fix the `isLeaf` false positive on cream render.
