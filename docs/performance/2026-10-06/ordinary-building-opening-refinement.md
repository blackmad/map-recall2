# Two-demo opening refinement — 2026-10-06

This bounded correction updates the original procedural atlas in `src/canalRecall/ordinaryBuildingPilot/viewer.mjs`. It does not register either building as an accepted game asset. Sources remain the existing private archive `436605b`, `experiments/large-ordinary-fast-pass`; no new source acquisition or photo pixels were used.

## Source observations and changes

BAG `0363100012118320`, warehouse: the selected 2025 perspective view shows segmental brick crowns above broad balcony openings, alternating with groups of two narrow windows. The narrow windows have their own curved brick heads on both visible main floors. Broad openings have curved upper glazing/frame outlines on the upper main floor; the lower broad opening is rectangular. The old atlas had disconnected elliptical arch strokes over entirely rectangular panes and single narrow windows. This correction builds curved frame and glazing outlines, clips mullions into the glazing, pairs the narrow openings and adds restrained radial mortar joints to the brick bands. Rectangular doors, pale cornice, upper wings and actual geometry gallery remain.

BAG `0363100012139498`, modern: both selected 2020/2025 views show three upper glazing tiers, broad pale horizontal and vertical structural divisions and finer dark window mullions. Four ordinary window floors sit above the tall ground zone. The old atlas used two upper tiers, six lower generic window rows and short doors. This correction separates three upper tiers from four lower rows and double-height door/transom bays. Balcony relief uses the same four atlas row positions and 48 slabs/rail planes, avoiding a lower balcony across the door zone. The 2025 ground brick bays appear partly screened, while 2020 is clearer; exact ground infill is unresolved, so the regularized glazed bays remain an approximation.

## Must-preserve criteria

- Warehouse curved glazing and frames must follow the segmental crowns; brick arch bands must remain visually separate from the cornice.
- Narrow warehouse groups must read as paired windows, alternating with broad balcony openings.
- The warehouse relief central upper gallery must remain genuinely open; atlas-only mode still has the documented opaque gallery failure.
- Modern upper glazing must read as three tiers with a structural grid and finer mullions.
- Modern ground doors must span the two-storey zone without generic windows/balconies laid over them.
- Native footprint, scale, scalar source height, shell/open-space geometry, atlas-only comparison mode and GLB exporter must survive unchanged.

## Timing and validation

Cached-reference inspection and implementation occurred within this task; no accepted-building speed claim is made. A recorded authoring-start checkpoint was 19:22:36 UTC; syntax and bundle checks finished by 19:23:36 UTC. The first bundle attempt used an unsupported esbuild flag and was corrected to `NODE_PATH`. The successful isolated bundle took 53 ms. `node --check` and `git diff --check` passed. No shared runtime bundle, catalogue, queue or source-pack file was edited.

GPU checks and before/after screenshots are assigned to root to avoid concurrent GPU reviews. No new gallery/game acceptance or FPS claim is made here. Expected modern relief geometry decreases by 12 balcony slabs plus 12 two-triangle rail planes; actual renderer totals/export bytes need root's browser check. Warehouse geometry count is unchanged because the opening detail is procedural canvas content.

Remaining approximations: exact facade bay counts, upper setbacks and surveyed heights, modern ground infill variations, warehouse balcony details, rear walls and whole-building recognition/game performance. Retain the existing before screenshots in the private pack for comparison; this correction does not remove prior failed evidence or authorize standard-treatment acceptance.
