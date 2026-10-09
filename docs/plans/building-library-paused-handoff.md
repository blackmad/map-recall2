# Building library paused handoff — 2026-10-02

User explicitly requested: “save a handoff and pause.” The objective is unfinished and should resume only when requested. No commits, deployments, model promotion or production replacement were performed.

## Workspace and objective

Continue toward an excellent reusable low-poly building forms/generator library, finish the reviewed frozen cohort and confidence gate, then extend across Jordaan only as quality and verified district delivery permit. Preserve unresolved evidence holds and all existing work.

Implementation directory: `/Users/blackmad/Code/map-recall2/.worktrees/sol-building-library`, branch `agent/sol-building-library`. Use this worktree explicitly; main workspace contains unrelated changes. Most library files/artifacts are untracked: do not reset, clean or stage everything. Existing main public gallery HTML/data links are the authorized review bridge. Do not spawn agents unless newly authorized by the user or applicable instructions.

Authoritative plan: `docs/plans/building-library-photo-fidelity-recovery.md`. Photo interpretation contract: `docs/plans/building-library-photo-recipe-prompt.md`. Confidence evidence: `artifacts/jordaan-building-library/confidence-gate.json`. Progress: `public/canal-drive/building-library-status.json`.

## Current verified state

Reviewed baseline remains 45 models, with 20 real candidates and 13 ordinary examples. Practical stylized authoring gate passed; this does not clear metric registration, held cases or GPU district acceptance. The historical restart handoff's 32-model count is obsolete.

All three isolated authoring batches rebuilt successfully with the current shared opening/compiler/exporter: pilot 40, scale-100 100, scale-200 200. All previews regenerated and published to their existing review pages. These 340 drafts are not 340 accepted reconstructions. Scale-200 retains 49 evidence holds.

Latest work adds construction-role LOD using explicit shared opening creation tags. Roles include glazing, outer trim, jamb profile, sash division, opaque panel, door leaf, raised panel, louvre, sill/threshold, handle and entrance recess. Exporter stores exact contiguous triangle ranges per material primitive. Facade omits fine jamb/handle/panel detail; massing additionally omits sash divisions. Unknown geometry, source-derived objects and any object defining owner bounds remain. Roof forms, cornices, balconies, stairs, wall finishes and opaque entry leaves retain their geometry/materials. No decimation or object-name matching.

Current 200-owner LOD evidence: `artifacts/building-batch-scale-200/semantic-lods/summary.json`.

- Detail: 372,415 triangles / 47,141,212 asset bytes.
- Facade: 275,263 triangles / 35,018,380 bytes (26% fewer triangles).
- Massing: 234,343 triangles / 29,937,884 bytes (37% fewer triangles).
- 400 lighter GLBs independently verified for retained attributes, winding, materials, exported native anchors and exact owner bounds.
- Same 108 whole-owner zoom-20 chunks at every level; 49 holds retained at every level.
- Actual district viewport test visits all 200 owners, admits every target at 35 m, uses at most 29,989 resident triangles / 3,531,664 geometry bytes under 30,000 / 4 MB limits, concurrency 2. The previous two detail-only budget omissions are resolved with LOD fallback.
- 432 isolated per-chunk transition cases and 108 deliberately corrupted replacements pass. Corrupted massing data leaves the prior detail model attached until a valid retry succeeds. These are isolated transition checks, separate from district admission.
- 2,400 CPU projections generated. Representative corrected Bloemstraat 155, warehouse Brouwersgracht 703–709 and recessed-entry Driehoekstraat views inspected. GPU rendering and projected-size transition acceptance remain unproven.
- Current recipe/export/preview GLB/published embedded front PNG hashes verified for all 200 owners.
- Existing reviewed baseline 20-owner semantic LOD verification rerun successfully (40 lighter variants) after extracting its reusable verifier.

Latest user screenshot of Bloemstraat 155 showed the earlier model. Current verified recipe/model/embedded preview has continuous brick ground, two upper bays per row, shorter windows, paired right doors, arched left display, cornice and offset roof light. Exact dimensions and ownership registration remain inferred. Evidence: `artifacts/building-batch-scale-200/bloem155-current-delivery-checks.json`.

## New and changed implementation

- `scripts/blender/building_lib/openings.py`: explicit creation-role tags on both Blender objects and portable capture.
- `scripts/export-portable-building-draft.ts`: role/policy metadata in exported triangle ranges.
- `scripts/buildingLibraryPortableLod.ts`: validates complete ranges/policy, filters exact ranges, compacts retained attributes, protects owner bounds/source/unknown geometry.
- `scripts/buildingLibraryLodVerification.ts`: extracted independent verifier shared with the reviewed baseline LOD tool.
- `scripts/build-portable-building-lods.ts`: isolated whole-cohort assets/manifests/reports preserving source scope, provenance and holds.
- `scripts/check-building-draft-delivery.ts`: optional actual facade/massing manifests through `--lod-root`; verifies current asset hashes and metadata at every level.
- `scripts/check-portable-lod-transitions.ts`: real binary transitions, picking, disposal and corrupted replacement checks for every whole chunk.
- `scripts/test-portable-building-lods.ts` and `scripts/blender/test-opening-lod-roles.py`: meaningful policy/range/opacity/arch/grid invariants. Existing door-leaf (5), partial sash (2), recessed-entry (3) tests pass.

## Remaining work and resume priorities

1. Inspect the current source/artifact state before changing anything. Continue visual and projected-size transition review; CPU checks must not be reported as GPU/likeness acceptance. Socket startup previously returned EPERM and Blender 5.2 Metal crashed before Python. Do not repeat unchanged launches or bypass permission limits.
2. Revisit unresolved screenshot cases and finer recognizable details through shared reusable components, not stock approximations. Key remaining evidence issues include Brouwersgracht 131 partial ownership and conflicting alternate photos; Boomstraat 46/64 cropped/misregistered evidence; Brouwersgracht 141 ownership/registration; heavily obscured warehouses and compound fronts. Source width is a warning, not proof of missing full-height bays. Reject conflicting alternate identity evidence rather than transferring features.
3. Frozen baseline held cases remain `derde-leliedwarsstraat-23-29`, `derde-egelantiersdwarsstraat-1-3-5` height evidence, and `bloemgracht-123` roof mismatch. Preserve their holds.
4. Improve actual district GPU/visible whole-owner/LOD transition acceptance before treating a district as delivered. Do not expand quantity at the expense of fidelity.
5. Reconcile artifact freshness after any shared rebuild: older per-case reports and `district-delivery/` are historical snapshots with older GLB hashes. The latest current 200-owner delivery proof is under `semantic-lods/`, not the earlier detail-only report. Some older individual proof hashes may need revalidation before reuse.

Portable pipeline still rejects unsupported `openFrames`, `recessedUpperPanels`, and storefront recessed assemblies/signs/awnings; supports hollow grouped bays, pierced/clipped finish zones, entrance recesses/stairs and explicit appearance roof attachments. Expand the shared implementation when real architecture requires it; preserve explicit measured/inferred distinctions.

## Reproduction commands

Run from the implementation worktree. Do not edit shared builder modules while a batch build is running.

```sh
node --import tsx scripts/test-portable-building-lods.ts
python3 scripts/blender/test-opening-lod-roles.py
node --import tsx scripts/build-portable-building-lods.ts --source-root artifacts/building-batch-scale-200/preview/detail/assets --output-root artifacts/building-batch-scale-200/semantic-lods
node --import tsx scripts/check-building-draft-delivery.ts --chunk-root artifacts/building-batch-scale-200/semantic-lods/detail/chunks --source-root artifacts/building-batch-scale-200/semantic-lods/detail/assets --lod-root artifacts/building-batch-scale-200/semantic-lods
node --import tsx scripts/check-portable-lod-transitions.ts --root artifacts/building-batch-scale-200/semantic-lods
```

Compile chunks for each of `detail`, `facade`, `massing` with `scripts/compile-building-library-tiles.ts --input-root .../LEVEL/assets --output-root .../LEVEL/chunks --render-zoom 20`. Renderer uses `--root .../semantic-lods --source-root .../semantic-lods/detail/assets --incremental`. Do not use renderer `--help`: it is not implemented and can run defaults.

Batch commands: `python3 scripts/blender/expansion/batch_pipeline.py build --output artifacts/building-batch-scale-200 --include-starters`, then `preview` with the same output, `--publish-root /Users/blackmad/Code/map-recall2 --page-name building-library-scale-200`. Build exit 0 alone is insufficient: inspect `build-report.json.failed` and per-owner entries. Pilot and scale-100 use their corresponding output/page names. TS tools run with `node --import tsx`; tsx CLI IPC previously failed.

## Process checkpoint

All known command handles from the last implementation turn completed, including three builds/previews, LOD generation/projections/chunk compilation, streaming/transition tests and reviewed-baseline verification. No command was started in the intentionally interrupted continuation. A process-list check at pause was denied by the sandbox (`ps: operation not permitted`), so this is a tool-handle checkpoint rather than an OS-wide process inventory. Do not assume stale lock/state files indicate a live process; poll a confirmed handle before restarting work.

Goal is paused at the user's request, not complete or blocked.
