# Staged ordinary-building expansion

Reviewed 2026-10-01. This directory owns new proposals only. Existing recipes,
manual overrides, public models and the reconstruction worktree are untouched.

Five source-wall-bound draft candidates are ready for parent visual/build review:
Lauriergracht 67/69, Rozengracht 251, Rozengracht 114, Lauriergracht 37 and
Rozengracht 249. Rozengracht 228 is a sixth diagnostic proposal held for its
source-shell/frontage disagreement. None is an accepted measured reconstruction.

`source-manifest.json` retains the immutable owner geometry, exact footprint,
selected frontage and cached manual feature overrides. `prepare_sources.py`
orders the closest observation first and corrects photo left/right orientation.
It does not rewrite source observations or conceal plane disagreements.

`authoring-notes.json` contains manually inspected visual observations, material
choices, roof uncertainty, variation rationale and the held/reserve status.
`component-requirements.json` records the evidence-backed assemblies needed to
improve resemblance: projecting grouped bays, hip/dormer roofs, independently
anchored balconies, masonry bands and date-coherent storefronts. Its parameters
are authoring requirements, not registered measurements.
`build_drafts.py` uses shared frame, storey and schema utilities to write proposed
recipes under `recipes/`, never the active recipe library. Numeric openings are
explicit hypotheses; metric registration remains ambiguous.

The source bundles/crops live under
`artifacts/building-library/expansion/evidence/`. They contain 108 new full, roof
and ground crops from 36 distinct panorama/date keys. Coverage spans 2022–2025
for Lauriergracht 67/69, Lauriergracht 37 and Rozengracht 228; 2022/2024/2025 for
Rozengracht 114; and 2022/2025 for Rozengracht 251 and 249. No download or paid
vision call was performed. `rectify-staged.ts` is a cache adapter over the existing
municipal rectifier, and retains camera/native-resolution provenance.

All six dated full-photo sheets were visually inspected. The dated visual review
records the actual inspected paths. Close cameras sometimes hide a pitched roof
behind a cornice; large crop dimensions do not establish native detail or metric
registration. Derived region crops are available but have not each received an
independent visibility mask or anchor registration.

Critical source issues:

- Rozengracht 228: the selected 4.806 m BAG frontage lacks a coplanar semantic
  source wall within 0.15 m. Nearby broken front surfaces sit 0.05–1.34 m behind
  the selected plane. Clear photos confirm the gable and rows but do not repair
  that metric binding. Keep held pending diagnosis.
- Lauriergracht 37: the original 21.16 m crop plane extends outside the selected
  14.78 m source wall. New same-plane photos show three full groups and a clipped
  left group. Draft openings use those new visual proportions and omit the
  clipped group; they do not stretch the original five bays. The 18.72 m source
  wall conflicts with the 15.11 m reported roof statistic; both remain recorded.
- Lauriergracht 67/69: original crop plane differs about 0.73 m from the source
  wall. New same-plane views resolve projecting grouped bays and the central
  entrances; exact widths still require registration. Roof evidence is clearest
  in farther 2022/2023 cameras. Current pitched roof is a labelled placeholder
  until hip/dormer assemblies and source roof massing are reviewed.
- Rozengracht 114: the exact owner extends 48.18 m behind its narrow street
  frontage and has 119 semantic surfaces. A single eaves extrusion retains the
  footprint but does not reconstruct its rear volumes.
- Balcony shopfront 251 spans middle/right bays; terrace 249 has a smaller
  central balcony. These distinct extents must be authored as assemblies rather
  than reusing one per-opening balcony size. Temporary fences/advertisements are
  omitted from permanent architecture.

Reproduce from the repository root:

```sh
python3 scripts/blender/expansion/prepare_sources.py
python3 scripts/blender/expansion/inventory.py
npx tsx scripts/blender/expansion/rectify-staged.ts
node scripts/blender/expansion/dated-sheet.mjs
python3 scripts/blender/expansion/build_drafts.py
python3 scripts/blender/expansion/render_drafts.py --validate-only
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/expansion/render_drafts.py -- --render
python3 scripts/blender/expansion/review.py
```

The draft writer reports six schema-valid drafts. The default render selection
contains the five proposals and excludes held Rozengracht 228. `review.py`
writes `artifacts/building-library/expansion/review.html` with dated sheets,
available facade/ground/oblique/roof renders and a compact `review-audit.json`.
Export manifests include the recipe file hash so stale renders stay visible.
Feature source planes resolve by exact crop hash rather than preferred-observation
ordering, and cached explicit mullions/upper lights survive draft compilation.

Schema validity checks layout
and topology only; photo resemblance, actual apertures, rear roof massing,
supported hip roofs, recesses, bands and balcony assemblies still need parent
review. The manually recorded visual-review annotations are deliberately not
regenerated by these commands.
