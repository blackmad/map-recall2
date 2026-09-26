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
