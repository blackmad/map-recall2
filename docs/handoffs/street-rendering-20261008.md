# Street rendering — preservation handoff, 2026-10-08

Branch: `wip/street-rendering-20261008`. Original base: `5ffe7d3368229a6caf2501dabe537c6c5034e165`. Source snapshot: `416763adb741e55e8172b8a70df698678159c115`. Preservation commit: `fd145a2af6cc6158c43c7f702a65e87da73ad4bf`.

This branch was split from root's existing work without treating preserved drafts as accepted changes. It starts from the original common base so source bytes remain attributable; rebase/extract onto fresh upstream before publication. Branches remain local.

## Work preserved

- Shared native frontage planners for interwar, compound, and regular canal fronts, including opening groups, access recesses, textured glass and retained ground-floor doors.
- Surveyed building-envelope compilation, footprint binding, worker transport and runtime fallback; explicit envelope roofs suppress the separate pyramidal-roof layer.
- Jan Evertsen material sampling, frontage/window-group refinements, regenerated pilot meshes and their source/review records.
- Existing 3D bundle selection and street panorama tooling changes from the mixed local scripts commit.

## Status and holds

These are preserved development changes, not a neighborhood acceptance. Read the branch's street-rhythm-work.json and existing street-generator progress handoff before expanding. Failed heldouts, roof/material checks and source-admission failures remain evidence. The De Wallen transfer acceptance was withdrawn; tests alone never restore visual acceptance.

The shared exported sampleEquirectangular helper is also preserved on the canalhouse branch. Both changes are identical; retain the export when merging either topic. Production street evidence fingerprints may depend on the exact catalogue/routing base recorded by the original author; do not rewrite hashes just to make admission pass.

## Resume and validation

Run npm run test:street-appearance. Rebuild three-buildings and its worker from package scripts, and pyramidal roofs with node scripts/build-3d-bundles.mjs --only=pyramidal-roofs. Recompile source cohorts only after reconciling their admitted inputs. Visual/game/performance acceptance remains the original project requirement.

## Recovery and evidence

The complete local recovery snapshot is backup/root-dirty-20261008; its disk copy is map-recall2-cleanup-recovery-20261008 beside the original checkout. Logs and desktop metadata are saved on disk, outside topic commits. The cleanup manifest records every captured path/hash and its assigned branch. No private source checkout or other session worktree was reset, cleaned or modified.

## Cleanup validation (2026-10-08)

- npm run test:street-appearance: 175 passed, 1 failed (routing/curated/compiler source admission fingerprint); not accepted
- three-buildings, worker, pyramidal roofs built successfully
- Shared original sampleEquirectangular export added to this branch after split exposed missing import.
