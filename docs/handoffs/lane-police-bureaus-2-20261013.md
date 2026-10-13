# Lane: police bureaus, second pass (content, 2026-10-13)

Continue `docs/handoffs/lane-police-bureaus-20261013.md` (same rules, same
checks). Done on main: Van Leijenberghlaan, Oost Zeeburg, Zuidoost
Gaasperdam (large recipes, installed), Hoofdbureau Elandsgracht (bespoke).
`scripts/landmarks/police-stations.json` lists 17 bureaus with BAG pands.
Since the first pass the large tier gained: courtyard footprint holes,
`sealSlivers`, `closedBoxes`, `windows: 'low'`, party-wall exemption,
`scripts/pand-reference/all-walls.ts`, and `largeCompile` hooks for
hand-modelled parts (see `scripts/landmarks/hoofdbureau-elandsgracht-builder.ts`).

Rule from the user (2026-10-13): infer from the panoramas which ornaments,
signs and reliefs are the building's signature and model them. For bureaus
that is at least the POLITIE lettering/plate, the blue lamp, the striped
band where present, canopies, and any crest or relief; list each in the
report as modelled / simplified / skipped with a reason.

## Deliverables
1. Recipes for the remaining 13 bureaus in this order (most photographed and
   most central first): Lijnbaansgracht, Nieuwezijds Voorburgwal, Zuid-De
   Pijp, West Overtoomsesluis, IJ-tunnel, Houtmankade, Oost Watergraafsmeer,
   Postjesweg, Meer en Vaart, Flierbosdreef, Boven-IJ, Politiepost IJburg,
   "Politie Amsterdam" (0363100012116154: identify it first). Where a bureau
   shares a pand with housing or a larger block, model the whole pand (the
   footprint is the unit) and note it.
2. Where a bureau's signature cannot be expressed by the components, add the
   component once (with a test; default compose output byte-identical) or,
   if it is a one-off, use `largeCompile` hooks in a small bespoke builder
   the way the Hoofdbureau does. Say which path each bureau took.
3. Per bureau: pand, triangles, gates, `audit:glb`, contact sheets, the
   ornament list, install command.

## Checks
`npm run lint`, `npm run test:building-recipes`, `npm run test:fit-golden`
(`--write` for new houses only), `npm run test:geometry-audit`,
`npm run test:block-kit-installed`. Report: branch, SHA, the per-bureau table,
component additions, unfinished items.
