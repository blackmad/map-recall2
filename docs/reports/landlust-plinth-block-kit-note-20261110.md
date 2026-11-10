# Landlust Bestevaer blocks: what a plinth-with-arched-stair-door piece needs

Status: written down, not built (coordinator, round 2). The Bestevaer stair blocks stay held.

## Why the per-pand kit cannot say it

The Bestevaer blocks (1924, Landlust) are one architectural composition: a rusticated or
dark plinth storey carrying a long brick wall, with a round-arched stair door
(portiek) every second axis. BAG cuts the block into pands at party walls that the
facade does not show. The pipeline places by BAG pand, so:

1. The arched door sits on a pand boundary or two pands share one door pair; the
   per-pand frontage match (`frontage.mode = stair-block`) sees half a door.
2. The plinth is one continuous band whose height changes with the street level,
   so per-pand ground clamps give a stepped plinth where the photo is smooth.
3. The brick wall rhythm (axis pitch about 2.9 m) is continuous across pands; each pand
   restarts the grid and the seam shows.

## What the piece needs

- **A block record, not a pand record.** `architecturalBlock` in the buurt json: ordered
  member pands, the street polyline span, and the stair-door axes in block metres.
  `auto-place` groups members into one run and passes block coordinates to `compile`.
- **Plinth.** `plinth: {heightM, material, courseHeightM, followGround: true}` as a
  `ground` layer over the whole block width, with a sampled ground profile
  (`groundClamp` already exists for De Hallen; reuse its profile input).
- **Arched stair door.** A door kind `arched-stair` with width 1.2-1.5 m, a round or
  segmental arch ring (rowlock course, keystone), 2-4 steps up from the pavement,
  recessed reveal (reuse `doorReveal`), and a half-glazed fanlight. Placed from the
  block's door axes, not from `doorBay`.
- **Continuous grid.** One `axisGrid` for the whole block with `bayWidths` repeating
  per stair unit; `storeyAxes` shared. Pand seams only affect roof and party walls.
- **Stair window.** The tall narrow staircase window above each door, a storey-spanning
  slot that already exists as the `slot` bay fill but needs a half-storey sill offset.
- **Roof and cornice.** Block-level eaves line (one measured eaves for the block,
  the `row coherence` clamp) and a cornice band; per-pand 3DBAG ridges are ignored.
- **Gates.** Frontage gate and `stripOverDrawn` evaluate the whole block width;
  the geometry audit allowance (0.5 m2 coplanar) applies per chunk, so the block
  should be chunked per stair unit.

## Acceptance

A strip of the whole block beside the street photo, judged by a review turn: smooth plinth,
door arches on the right axes, no seam at pand boundaries.
