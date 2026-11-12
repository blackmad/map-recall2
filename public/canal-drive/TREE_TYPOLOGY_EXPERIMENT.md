# Loose tree typology experiment — 9 September 2026

The neighbourhood demo now uses deterministic, coarse crown priors from the existing municipal species/cultivar and management fields. No inventory file is rewritten. Use `?neighbourhood=1&trees=legacy` for the previous uniform tree proxies; the original block and Elandsgracht modes retain their old trees.

## What the inventory supports

There are 94 non-stump records: 79 have usable height classes and 15 use the existing authored height fallback. Positions and compiled height estimates are retained. Height-class estimates are not measured tree heights, and species' potential adult heights are never substituted for them.

The resulting proxies comprise 24 pyramidal, 23 upright-oval, 44 rounded, one conical evergreen, one vase-shaped and one candelabra-pruned crown. Of these, 72 use a checked species/cultivar prior, one uses explicit management information, and 21 remain generic authored fallbacks. Unknown species and unverified cultivars deliberately remain fallbacks.

The inventory explicitly calls only one tree `Gekandelaberde boom`. The 87 records marked `Boom niet vrij uitgroeiend` are **not** interpreted as pollarded trees. Six others are marked freely growing. Even the explicit management record does not supply surveyed branch geometry.

## Botanical priors versus authored choices

The shapes below are loose interpretations of published descriptions, not classifications of these particular Amsterdam trees.

| Inventory identity | Coarse proxy | Basis |
| --- | --- | --- |
| London plane | Rounded | [Van den Berk: London plane](https://www.vdberk.com/trees/platanus-hispanica/) |
| Plane ‘Tremonia’ | Pyramidal | [Van den Berk: ‘Tremonia’](https://www.vdberk.com/trees/platanus-hispanica-tremonia/) |
| Elm ‘New Horizon’, ‘Dodoens’, ‘Vegeta’ | Pyramidal | [‘New Horizon’](https://www.vdberk.com/trees/ulmus-new-horizon/), [‘Dodoens’](https://www.vdberk.nl/bomen/Ulmus-Dodoens/), [‘Vegeta’](https://www.vdberk.com/trees/ulmus-hollandica-vegeta/) |
| Elm ‘Clusius’, wych elm | Upright-oval | [‘Clusius’](https://www.vdberk.com/trees/ulmus-clusius/), [wych elm](https://www.vdberk.com/trees/ulmus-glabra/) |
| Ginkgo | Upright-oval compromise | [RHS: young crowns are conical and become irregular with age](https://www.rhs.org.uk/plants/7990/ginkgo-biloba/details); no actual-age crown inference is made |
| Leyland cypress | Conical evergreen | [RHS: Leyland cypress](https://www.rhs.org.uk/plants/321515/cupressus-%C3%97-leylandii/details) |
| Cherry ‘Kanzan’ | Vase | [Van den Berk: ‘Kanzan’](https://www.vdberk.com/trees/prunus-serrulata-kanzan/) |

Crown widths, proportions, trunk clearance and small ID-seeded variation are authored. All foliage is a summer approximation; no season is inferred from mixed-date street photographs. Cultivar descriptions can change with age and growing conditions. The demo visibly discloses this, and each runtime tree proxy carries its own provenance via `window.daCostaDemo.data().trees[*].renderedTree`.

## Rendering and checks

The implementation keeps three shared low-poly sphere instances per tree and reuses the four existing greens. It adds no tree mesh/material class. Crown widths are capped within the previous proxy envelope, which limits additional landmark obstruction without moving inventory points or quietly removing trees. Stumps remain excluded and the existing miniature-boundary filter remains unchanged.

`rtk proxy node scripts/check-tree-typology.mjs` passes species/cultivar normalization, unknown fallback, explicit management, missing/corrupt heights, stump exclusion, preserved positions/heights, deterministic output, finite geometry and bounded crown tests. Detailed output is `.cache/da-costa-neighbourhood/tree-typology-report.json`.

`rtk proxy node scripts/check-tree-render.mjs` passes eight serial A/B captures (desktop/mobile, canal/Sterk, old/new crowns), unchanged camera positions and draw calls, inventory preservation, visible provenance and no horizontal overflow or browser errors. The snapshots were visually inspected: the canal's pyramidal prior reads narrower than its old generic crown, while Sterk's sign and principal storefront remain visible at both sizes. These are rendering checks, not a measurement of botanical accuracy.

| Matched view | Draw calls, both versions | Triangles, both versions |
| --- | ---: | ---: |
| Desktop canal | 139 | 315,017 |
| Mobile canal | 137 | 314,056 |
| Desktop/mobile Sterk | 138 | 314,611 |

Metrics: `.cache/da-costa-neighbourhood/tree-render-metrics.json`. Screenshots: `trees-{desktop,mobile}-{canal,sterk}-{legacy,inventory}.png` in the same cache directory. No paid inference was used.

Next useful improvements would be checking a handful of tree crowns against street photos, and using actual canopy/height measurements if available. A species prior alone should not be promoted into a surveyed crown, or used to infer an unrecorded pruning regime.

## Measured silhouettes, `?treeShape=1` (lane T-shape #371, 2026-11-10)

The "next useful improvement" above, done. The user's Piet Kranenbergpad frame showed a wall of 27 m poplars as fat
cylinders on 8-12 m bare trunks. Measured against photos, every archetype drew crowns about half as wide as the real
ones and lifted them on a crown base that was a fixed share of height (12.4 m for a 27 m Robusta; the photos give 3-5 m).

- **Survey** (`npx tsx scripts/trees/tree-silhouette-survey.ts --help`): the 30 commonest species of the
  ride-priority gebieden plus the species of the 940 rows of trees >= 15 m. Crown top, base, widest run and outline
  from aimed summer Gemeente Amsterdam panoramas (foliage mask on the trunk plane, `src/canalRecall/trees/silhouetteMeasure.ts`),
  and a leaf-on crown width from the PDOK 2024 summer orthophoto masked by AHN4 canopy height. Report:
  `docs/reports/trees-silhouette-20261110/survey.json` (+ `survey-pyramidal.json`, the poplar/willow/alder check).
  Review overlays and the species sheet: `scripts/trees/tree-silhouette-overlays.ts --sheet` (photo, game before in
  red, after in cyan).
- **Priors** (`scripts/trees/tree-shape-priors.ts --write` → `src/canalRecall/trees/treeShapeMeasured.ts`, generated):
  width/height per species (panorama median, n >= 3; else ortho × the panorama/ortho ratio), per archetype (median of
  its species), crown base by inventory height class (3.3 m under 6 m, 3.8, 4.8, then 5.6 m from 12 m up: street
  clearance, not a share of height) with a per-species factor, and archetype corrections where the photos contradict
  the nursery prior (Populus canadensis 'Robusta' and plain canadensis: pyramidal/rounded → airy-oval).
- **Shaper** (`src/canalRecall/trees/treeShape.ts`): rescales the archetype's three lobes to the measured width, base
  and top; seeded per-tree jitter of height inside the class range, width (±12 %), crown base (±0.5 m), lobe size,
  placement and (off-axis archetypes only) a small lean. Lobe count and draw groups are unchanged; on-axis archetypes
  get no lateral jitter, so the fork count is unchanged except where an archetype is corrected (Robusta/canadensis
  gain the airy-oval's two forks: 4,287 trees city-wide). Registered by `inventory-trees-source.js` through
  `setTreeShaper`, so this file stays plain JS for the raw da-costa demo. Off (the default), the typology is
  byte-identical (`src/canalRecall/trees/treeShape.test.ts`).

Width/height within ±20 % of the photo: 7 → 30 of the top 30 species (by construction for measured species; the
independent ortho check goes 3 → 15 of 30). Crown base within ±20 %: 9 → 24 of 30. Leaf state and autumn are out of
scope; outline classes from pixels are noisy (the survey reports votes, not a verdict).
