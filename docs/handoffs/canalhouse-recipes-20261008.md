# Canalhouse recipes — preservation handoff, 2026-10-08

Branch: `wip/canalhouse-recipes-20261008`. Original base: `5ffe7d3368229a6caf2501dabe537c6c5034e165`. Source snapshot: `416763adb741e55e8172b8a70df698678159c115`. Preservation commit: `a7108658ada9e4d21b2ae040afa231c34c2a9c6c`.

This branch was split from root's existing work without treating preserved drafts as accepted changes. It starts from the original common base so source bytes remain attributable; rebase/extract onto fresh upstream before publication. Branches remain local.

## Work preserved

- Reusable recipe/component library: aperture-aware fronts, recessed openings/loggias, grouped windows, hoists, crown/cornice profiles, attic faces, roof volumes/junctions/inserts, and independent window/door materials.
- Recipe authoring/build/reference-camera tools, municipal panorama viewer and fixed-host development proxy.
- Herengracht and Bloemgracht source-derived recipes, exported preview GLBs, component examples, trial rows and progress pages. All trials and failed candidates remain available.
- Opt-in catalogue/painter preview selection, content caching and source-camera framing; these candidates are separate from accepted curated POIs.
- @types/three dependency and the associated existing viewer typing adjustments. The shared panorama sampling export is also needed by the street branch.

## Status and holds

The seven-owner Bloemgracht 78–90 row had scoped desktop/touch integration and neighbor-retention evidence. Roof dominance/fidelity and stable performance remain holds; no broad street-row acceptance is claimed. Bloemgracht 94 is a standalone held trial. Later row exports are candidate work, not implied acceptance.

Read canalhouse-progress-handoff-20261007.md and canalhouse-generator-handoff.md for the detailed source/cycle history. Original raw sources belong in the private map-recall2-source-data archive; do not push this preservation branch before checking raw/reference ownership. Existing source commits include 0de24822, 0a6488f3, b84dd4ef and 01581106; preserve their model-specific paths and uncertainties.

## Resume and validation

Run npm run test:canalhouse-recipes, npm run build:canalhouse-review and npm run build:canal-signature-landmarks. Other component-specific tests live beside the library. Recipe author/build commands write generated assets and source-derived recipe files; use them intentionally. Serve canalhouse-recipes.html with the branch's Vite config and use recorded source-camera views before game expansion.

## Recovery and evidence

The complete local recovery snapshot is backup/root-dirty-20261008; its disk copy is map-recall2-cleanup-recovery-20261008 beside the original checkout. Logs and desktop metadata are saved on disk, outside topic commits. The cleanup manifest records every captured path/hash and its assigned branch. No private source checkout or other session worktree was reset, cleaned or modified.

## Cleanup validation (2026-10-08)

- npm run test:canalhouse-recipes: 103 passed
- npm run lint passed
- canalhouse review and signature placement built successfully
- No new visual acceptance performed; existing roof/performance holds retained.

The split lockfile keeps the Three typing dependency and removes active-root-only canvas bindings, matching this branch's manifest. Root retains its canvas dependency for the concurrent street/material work. The complete original lockfile remains in the preservation/recovery commit.
