# Lane: find z-fighting in the bespoke GLBs automatically (content/domain, 2026-10-13)

User 2026-10-13, screenshot of Centraal Station's train-shed roofs from the
air: the long roof planes show striped, flickering bands where two faces lie
in the same plane (one roof face over another, the glazing strip over the
roof cell), the classic z-fight. "Is it possible to automatically find
instances of texture fighting in our custom GLBs like this?" Answer yes:
coplanar overlapping faces are a geometric property and can be found
offline, no GPU needed.

Inputs: `src/canalRecall/landmarks/geometryAudit.ts` (the per-model audit
behind `npm run audit:glb -- --id=<id>`: holes, see-through, far-outside,
opening overhang, detached parts; baseline
`scripts/landmarks/geometry-audit-baseline.json`, lower never raise),
`glbQuality.ts`, the 311 GLBs in `public/canal-drive/models/` (manual
catalogue `src/canalRecall/landmarks/manualCatalogue.json`) plus the 38
ordinary models (`public/canal-drive/ordinary-buildings-data/`), the
builders in `scripts/landmarks/*-builder.ts`, `docs/buildings-pipeline.md`.
Lane owns the audit module, the baseline and the builders it fixes; it
re-exports one id per process (`node --import tsx
scripts/landmarks/build-manual-landmarks.ts --only=<id>` then `npm run
build:landmark-lods -- --only=<id>`). Do not edit `game.js`, `index.html`,
`package.json`, bundles, catalogues, `TODO.md`, `HISTORY.md`.

## Deliverables
1. **`coplanarOverlap` metric in the audit**: for every pair of triangles
   from different meshes or different materials (and same material when
   the triangles are not adjacent), test coplanarity (normal angle < 0.5°,
   plane offset < 2 cm) and 2-D overlap of the projected triangles (area of
   intersection > 0.05 m²); report total overlapping area, pair count, the
   worst spots in model space, and the materials involved. Use a spatial
   hash per plane bucket so 300 k-triangle models finish in seconds. Also
   flag **near-coplanar** faces 2–8 cm apart that face the same way, since
   at 200 m the depth buffer cannot separate them either (this is the
   Centraal Station case: a glazing strip floating 3 cm over the roof).
2. **Survey**: run over all 311 + 38 models, write
   `artifacts/zfight-audit/report.json` and a ranked markdown table (model,
   overlapping m², pair count, worst material pair, likely cause). Validate
   against a Playwright shot: render the top 5 from the air at two
   distances in the shared frame and confirm the stripes are where the
   metric says; render 5 models the metric clears and confirm none.
3. **Fix the top 15** in their builders (lift the floating face off the
   surface by ≥ 10 cm, or cut the hole and inset it, or merge into one face
   with a material split; never a polygon offset hack in the renderer),
   re-export, confirm the metric drops to 0 and the gallery shots are
   clean; Centraal Station first.
4. **Gate**: `coplanarOverlap` becomes a hard fail in `audit:glb` for new
   exports above 0.5 m² and a baseline entry for the legacy models; add it
   to the `docs/buildings-pipeline.md` checklist.

## Checks
`npm run lint`, the audit's unit tests, `npm run audit:glb -- --id=<id>`
per touched model, `node --import tsx scripts/landmarks/check-manual-landmarks.ts`.
Report: branch, SHA, the ranked table (top 30), the validation shots, the
15 fixes with before/after, the baseline diff, unfinished.
