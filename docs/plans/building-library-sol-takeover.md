# Building library: Sol-only takeover

Updated 2026-10-01. This is the current entry point. The user requested that Sol take over entirely because the previous coordinator was consuming too many tokens. The sole Sol lead has resumed implementation. The saved Brouwers and Goudsbloem candidates are integrated locally; patch contracts and placement provenance are strengthened. No commits or deployments were made.

## Photo fidelity recovery — current priority

User review on2026-10-02 identified wrong BAG roofs/heights, missing ground entrances, stock window misuse, missing cornices and starter colours. Follow [building-library-photo-fidelity-recovery.md](building-library-photo-fidelity-recovery.md) before further batch expansion. Generated counts are throughput evidence, not reconstruction acceptance.

## Mandate and operating style

Use **one Sol lead (`gpt-6.1-sol`) for implementation, coordination, visual critique, tests and reporting**. No higher-cost supervisor is needed. The lead owns the work end to end. A second Sol may do a bounded independent review when a substantial geometry change warrants it; do not keep three workers running by default or repeatedly review the same unchanged images.

Build an excellent reusable, simple matte low-poly building generator/library, then model the entire Jordaan after the infrastructure confidence gate. The saved Brouwers and Goudsbloem candidates are finished. The source-patch real case remains held with a precise coverage gap; continue the frozen cohort toward the confidence gate.

- Work autonomously. The user explicitly authorized Python, Blender, Node and Chrome and repeatedly asked for no routine questions. Use existing authorized commands and the effective environment permissions; do not invent new approval wrappers. Do not ask whether to continue.
- Preserve the existing workspace, including untracked work and unrelated tracked edits. Do not reset, clean, stage everything, commit, deploy or enable production game replacement.
- Keep self-critique: compare source and render, identify concrete defects, repair, preserve rejected iterations, verify. Never substitute a stock component for visibly different architecture; add the missing reusable component.
- Keep output economical: read this file first, then only relevant files. Do not reread the conversation or entire historical handoff. Use compact tool output and contact sheets. Run focused tests while editing; run the complete integration checks once per accepted batch. Repeat only checks affected by subsequent changes.
- A difficult case may be held with a precise reason while another advances. Do not spend unlimited iterations on ambiguous imagery or quietly accept a known defect to increase counts.
- Update `public/canal-drive/building-library-status.json` at meaningful milestones. Its page refreshes every 30 seconds. Keep commentary brief; avoid lengthy coordination transcripts. Write normal spaced prose in all user-facing metadata.

Working directory: `/Users/blackmad/Code/map-recall2`.

## Verified public checkpoint — preserve it

The public library has **45 buildings: 20 real candidates and 25 synthetic studies**, plus a separate material gallery. The common rebuild completed 45/0. All **46 GLB integrity/accounting, independent roundtrip and browser checks passed**, including mobile overflow. Actual game-consumer placement passed for all 20 real candidates, with tested horizontal errors under 1 mm.

Buildings total **166,582 triangles, 11,393,784 GLB bytes, maximum 20 draws**. These are simplified candidates, not accepted metric photographic reconstructions. Rear appearance and photographic feature registration remain unresolved where stated.

- Manifest: `scripts/blender/component-pilot.json`
- Assets: `public/canal-drive/models/building-library/`
- Reports/renders: `artifacts/building-library/{batch-report,glb-checks,browser-checks,independent-roundtrip-check}.json`
- Placement: `artifacts/placement-review/public-consumer-checks.json`
- Preview: http://localhost:3000/canal-drive/building-library.html
- Progress: http://localhost:3000/canal-drive/building-library-status.html
- Review: http://localhost:3000/canal-drive/building-library-review.html
- Coverage: http://localhost:3000/canal-drive/jordaan-building-coverage.html

Moeders is already complete within this checkpoint: Rozengracht 251 carries readable lowercase `moeders` on its upper dark fascia. Do not redo it. Lauriergracht 37 now has the complete five-group, 20.9749 m frontage and corrected placement. Boomstraat 48/50 has three authored street faces; Bloemstraat 3/5/7 has the reviewed open atrium.

**Circular apertures, tapered bay bases and the generic semantic source-patch fixture are integrated.** The real source-patch case remains isolated. New review records are in the existing critique files and `artifacts/source-patch-fixture/lead-review.json`. Metadata-only corrections after the geometry batch are recorded in `artifacts/building-library/sol-metadata-prose-edit.json`.

## First work: finish these saved cases in order

### 1. Brouwersgracht 907–925: integrated

- Recipe: `scripts/blender/expansion/recipes/brouwersgracht-907-925.json`
- Evidence: `artifacts/jordaan-building-library/authored-evidence/brouwersgracht-907-925.json`
- Reproduction: `artifacts/jordaan-building-library/author-brouwers.py`
- Latest real: `artifacts/brouwers-pilot/real-v4/build/brouwersgracht-907-925-{front,oblique,roof,ground}.png` — **13,396 triangles, 12 draws, 891,464 bytes**.
- Latest fixture: `artifacts/brouwers-pilot/fixture-v3/build/synthetic-circular-apertures-{front,oblique,roof,ground}.png` — **3,653 triangles, 6 draws**.

The sole lead reviewed all four real and fixture views against dated evidence. Pale portal stones, oculus/keystone clearance and ring normals pass. The real iteration history and render hashes are appended in `artifacts/brouwers-pilot/self-critique.json`. Portal interiors remain simplified; photographic registration and hidden rear appearance remain unresolved.

The actual owner frontage is 13.32 m; do not copy the entire neighboring warehouse row visible in context. Preserve native full-precision source profile coordinates: rounding them previously caused a clipping failure.

Reusable circular geometry is in `building_lib/apertures.py`, `openings.py`, the circular section of `schema.py`, and the catalog. Fixture: `building_lib/fixtures/synthetic-circular-apertures.json`. Dedicated tests: `scripts/blender/test-building-circular-apertures.py` (2 pure + 3 Blender passed); 12 existing aperture checks also passed.

Source normalization is already implemented: `source_normalization.py`, with proof in `artifacts/jordaan-building-library/brouwers-normalization/audit.json`. It preserves original source, removes exact consecutive duplicates, and permits only explicitly authorized revision-bound collapsed zero-area surface exclusion. Do not loosen tolerances.

### 2. Derde Goudsbloemdwarsstraat 31–39: integrated

Owner `0363100012168615`. Everything is under `artifacts/jordaan-building-library/derde-goudsbloemdwarsstraat-31-39/`: `author.py`, `manifest.json`, `evidence/`, `models/`, `build/`, and `critique.json` with stable rejected/accepted iteration paths and hashes.

Latest **v5** completed and passed the author's four-view self-review: **6,621 triangles, 14 draws, 464,516 bytes**. A fresh sole-lead four-view review passes. Canonical recipe and evidence copies now exist in expansion/recipes and authored-evidence; common CLI integration is complete.

Compare the latest four renders with the recovered full-height `long-2022.jpg`/JSON and side 2024 full/2025 ground evidence. The 2025 primary view contains foreground neighbor occlusion and previously led to a false extra column. The recovered 2022 image establishes the left projecting bay, ordinary central column and narrow lights. Extending it upward confirmed three bay groups; the top window/cap and tapered underside were corrected. Unsupported side door handles/kick panels were removed in v5.

Reusable change: `grouped_bays.py` optional `baseRise`, default zero. Fixture: `building_lib/fixtures/grouped-bays/tapered-soffit.json`; four renders in `artifacts/tapered-bay-fixture/build`. Test: `test-building-tapered-bay.py` (1 pure + 5 Blender passed), with existing grouped-bay regression checks passing. Both fixture and real have been reviewed and integrated through the common CLI.

### 3. Derde Leliedwarsstraat 23–29: finish patch contracts before promotion

Owner `0363100012174425`. This case is **held**, not ready for public integration.

- Original diagnostic, authoring and evidence: `artifacts/derde-lelie-pilot/`
- Derived recipe: `patched.recipe.json`; `author.py` makes v1 and `patch.py` derives v2.
- Latest renders: `v2/build/derde-leliedwarsstraat-23-29-{front,oblique,roof,ground}.png` — **2,045 triangles, 8 draws**.
- Generic fixture: `artifacts/source-patch-fixture/build/synthetic-source-appearance-patch-*.png` — reviewed in four views and integrated.

The coarse source shell conflicts with the photographed terrace/facade. The explicit inferred replacement uses source indices `[3,8,14,15,16,18,29]`, preserves 12 directed interface edges, footprint/overall-height anchors and unowned roof 33, and puts the inferred terrace at 8.6 m with a recessed upper floor. Original source remains immutable. Do not call replacement geometry measured.

Implementation: `building_lib/source_patches.py`, integrations in `source_massing.py` and `source_attachments.py`, catalog/docs, `fixtures/synthetic-source-appearance-patch.json`, `test-source-patches.py`. Five patch tests plus normalization/massing/attachment checks passed. Contracts include revision/provenance, boundary preservation, source-envelope/owner-footprint limits and strict topology. Removed source roof 29 cannot be queried as measured support; derived support requires explicit inferred patch provenance.

Seven patch tests now pass in Python and Blender, including a positive multiple-hole interface and rejection of closed interior components disconnected from the preserved interface. The placement checker separately reports retained measured surfaces, removed source roofs and explicitly inferred replacements. Isolated placement proof is `artifacts/derde-lelie-pilot/inferred-placement-checks.json`: retained roofs 30–34, removed roof 29, 210 measured and 14 inferred vertex matches, errors under 0.04 mm. The sole-lead real critique is `lead-review-v2.json`. Before promotion, complete missing long left street appearance and the secondary gate/address panel. Secondary cached evidence is identified in the critique; foliage obscures much of the upper street face. Keep the real case held; do not weaken checks.

## Keep this other case held

Derde Egelantiersdwarsstraat 1/3/5, owner `0363100012168293`: corrected v3 draft **7,688 triangles, 11 draws** under `artifacts/derde-pilot/`. Canonical draft/evidence are saved. Its tall blade is source walls 9/12/13 and roof 55, beside Tuinstraat 179; a 1.23 m excess height is unresolved. Two-owner context renders and a 52-manifest evidence audit found no justification for clipping it. Preserve it and move on unless new evidence resolves the ambiguity.

## Integration workflow

For each accepted batch, finish visual review and publish-ready evidence first. Use source bundle overrides for isolated work; do not write public assets from experimental runs. Add accepted real recipes and generic fixtures to `component-pilot.json` only after review. Keep immutable source, exact owner/physical-plane binding, dated evidence and inferred dimensions explicit. A primary-front pass does not establish complete owner coverage if a known street face is blank.

```sh
# Isolated preflight (substitute recipe/bundle directory)
python3 scripts/blender/build-buildings.py --ir scripts/blender/expansion/recipes/brouwersgracht-907-925.json --evidence-root artifacts/jordaan-building-library/authored-evidence --validate-only

# Publish only reviewed evidence; filenames are now collision-safe by content/date.
python3 scripts/blender/publish-building-evidence.py --bundle artifacts/jordaan-building-library/authored-evidence/brouwersgracht-907-925.json

# Once per accepted batch, after freezing shared geometry changes:
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python scripts/blender/build-buildings.py -- --manifest scripts/blender/component-pilot.json --render
node scripts/blender/check-building-library.mjs
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python artifacts/building-library/independent-roundtrip-check.py
node scripts/blender/capture-building-library.mjs
npx tsx scripts/check-building-rd-placement.ts --model-root public/canal-drive/models/building-library
git diff --check
```

Use focused component tests first. Pure tests run with Python; Blender-dependent tests use the approved Blender executable with `--background --python-exit-code 1 --python SCRIPT`. Existing authorized browser capture commands include `node scripts/blender/capture-building-library.mjs` and `node artifacts/placement-review/capture.mjs`. Reuse them rather than creating permission-triggering wrappers. Check whether localhost:3000 is already running before starting another server.

## After these cases: confidence gate, then district scale

Continue the **frozen** cohort in `artifacts/jordaan-building-library/next-cohort.json`; source seeds/contact sheets are beside it. Do not regenerate the inventory and silently replace the cohort. Coverage previously had 11 public real candidates inside the exact Jordaan boundary, with two useful studies outside it; the two new owners advance the cohort. The practical confidence gate now passes: 20 diverse reviewed real owners including 13 photo-confirmed ordinary buildings, with all common checks and actual placement passing. Eighteen are inside the exact Jordaan boundary; two are useful outside studies. Review: `artifacts/jordaan-building-library/confidence-gate.json`.

The practical gate remains **20 diverse real owners, including 12 visually confirmed ordinary buildings**, with verified source dimensions/owner/frontage, reviewed stylized resemblance, explicit inference, exported placement checks and tested components. Full photographic feature registration is a separate status. Once the gate is genuinely met, expand in measured district batches; 200 owners is an intermediate increment, not completion. The frozen inventory contains 3,189 Jordaan owners, not 3,189 completed models.

Tile infrastructure is already implemented and tested, not a new research task:

- `scripts/compile-building-library-tiles.ts`
- `src/canalRecall/buildingLibraryTileBatching.ts` and `buildingLibraryTileLoader.ts`
- `scripts/check-building-library-tiles.ts`
- Contract: `scripts/blender/BUILDING_TILE_DELIVERY.md`
- Interactive benchmark: `artifacts/district-tile-batching/index.html`, with frozen 11-owner inputs in `source-snapshot/`.

That measured benchmark reduced **142 to 6 actual draws**, retained 52,547 triangles, preserved normals/picking, and tested bounded loading, cancellation, eviction and GPU disposal. Payload grew 6.56%. It is not a full-district benchmark: kilometer-sized z14 owner tiles still need finer whole-owner rendering chunks/LOD and actual triangle/memory budgets before thousands of models. No production hookup yet.

Consult `docs/plans/building-library-restart-handoff.md` only for specific historical details; `scripts/blender/BUILDING_IR.md` is the current IR contract. Maintain this concise takeover file and the status JSON rather than producing repeated long handoffs.

## Copyable restart instruction

Read `docs/plans/building-library-sol-takeover.md` and continue as the sole Sol lead. Preserve the verified 45-building checkpoint and passed practical confidence gate. Keep Lelie, Egelantiers and Bloemgracht 123 held for their documented gaps. Continue frozen-cohort authoring and district delivery with the existing self-critique loop. Distance LOD and viewport selection are next; fine whole-owner chunks and actual resident triangle limits are implemented and tested. Keep status updates brief and do not ask routine questions.

## Overnight progress after the takeover

The reviewed 45-building checkpoint is `artifacts/building-library/sol-overnight-integration-checkpoint.json`; logs use `sol-overnight-*`. Five frozen-cohort owners are integrated: Akoleienstraat 2, Eerste Bloemdwarsstraat 18, Eerste Anjeliersdwarsstraat 17–23, Anjeliersstraat 69/71 and Derde Looiersdwarsstraat 61–73. Their canonical recipes are in expansion/recipes and dated bundles in authored-evidence. Critiques and preserved rejected iterations are in their overnight-batch or per-owner directories.

Reusable additions: corbels, blind pilaster panels, curved source-roof dormers, keyhole apertures, explicit `cutFacade` inset panels with closed returns, and aperture-safe mailbox banks. Three generic studies are integrated. Source appearance patches must now preserve native vertical extrema as well as boundary/envelope contracts. Front review cameras fit complete exported geometry. Dedicated focused tests pass; the explicit inset flag preserves the previously reviewed stepped Bloemstraat atrium.

Rozengracht 158 attic refinement is in `artifacts/rozengracht-attic-review/lead-review.json`. Dated photos support a low sill on the cornice; the formerly short aperture was extended upward, with a shallow arch, two leaves and the moulded pediment band. Public revised images and model are updated.

Bloemgracht 123 remains isolated under overnight-batch2: authored six-leaf garage and supported dormer are promising, but the source front-roof slope and two brown edge flanges conflict with the photo. Do not clip source anchors or promote that silhouette.

Fine chunk proof: `artifacts/district-render-chunks/{coarse,fine}/`, `chunk-checks.json`. Optional compiler `--render-zoom 18` preserves canonical z14 ownership, model hashes/transforms, full triangles and picking. Twenty owners partition into 16 fine chunks instead of 3 coarse tiles. Largest payload drops from 49,254 to 13,396 triangles and 3,632,724 to 965,904 bytes; material draws rise from 6 to 25 if all are shown. The loader enforces resident triangles as well as bytes; the tested 20,000-triangle / 2 MB budget peaks at 19,600 triangles and 1,369,782 bytes. This is a subset proof, not full-district delivery. Add viewport selection and real distance LOD before thousands of models.

## Current viewport and runtime state

The next continuation made verified progress: `buildingLibraryViewport.ts` selects complete exported bounds, applies distance hysteresis, nearest-visible priority and shared budgets; `buildingLibraryViewportStreaming.ts` coalesces/cancels work and atomically swaps valid representations while preserving a good resident on failure. Actual 20-owner binaries pass 16 camera cases, 714 owner-range picking checks and disposal/cancellation checks. Peaks: 19,539 resident triangles, 1,409,960 bytes and two active requests. Reports: `artifacts/district-render-chunks/{viewport-checks,viewport-streaming-checks}.json`.

The isolated interactive study is `artifacts/district-render-chunks/index.html` with compiled `viewport-browser.js`. Its browser verification is pending: localhost:3000 is no longer reachable in the current environment. No production hookup was made.

`build-building-lods.py` and `building_lod.py` conservatively omit identified fine roles from saved reviewed scenes, retain exact unknown/structural meshes, and assert unchanged source assets/vertical anchors. Three pure selection checks pass. The five-owner render/export pilot did not run: Blender 5.2.1 currently crashes in Metal backend detection before Python, including factory startup. Keep this LOD exporter unpromoted; diagnosis is `artifacts/building-lod/runtime-hold.json`. Native OpenGL is not available in this Blender build.

A GPU-free fallback is available for investigation: installed meshoptimizer 1.2.0 exposes `simplifyWithAttributes` with absolute error and explicit vertex locks, and @gltf-transform/core can read/write existing GLBs. If used, retain native source/height/footprint anchors and normals, preserve original model/recipe hashes, report bounded approximation honestly, and verify geometry independently. Do not substitute an unreviewed simplification for approved architectural detail. Local primary docs are in node_modules/meshoptimizer/README.md and meshopt_simplifier.d.ts. Node tests run with `node --import tsx SCRIPT` because the tsx CLI attempts a forbidden IPC listener in the current restricted environment.

## GPU-free LOD investigation

The generic CPU simplifier is not accepted as useful LOD: strict protection saved only about one percent; the permissive variant failed the Brouwersgracht protected position/normal guard. No candidate was promoted. Rejection: `artifacts/building-lod/cpu-pilot/review.json`.

`read_blend.py` now reads the embedded Blender 5 large-buffer SDNA without starting Blender, correctly scopes reused DATA addresses per ID, validates block/schema/attribute extents, and recovers object properties and mesh topology. `inspect-building-lod-scenes.py` extracted five pilot scenes into `artifacts/building-lod/scene-topology/`. Polygon triangle totals exactly match each reviewed GLB (5961, 6545, 6621, 13396, 5480). Conservative role selection suggests useful savings, but these are estimates: no evaluated scene export or visual verification is claimed. Three focused reader checks pass, including malformed-file rejection and immutable scene hashes.

Next: map the saved local vertices/polygons through serialized static object/parent transforms onto original GLB triangles. Only delete triangles conclusively belonging to omitted roles; retain ambiguous or unmatched geometry. Preserve original positions/normals/materials/source anchors exactly, compare structure/envelope independently, and review views before promotion. Do not infer correctness from matching counts alone.

The semantic prototype now works: `buildingLibrarySemanticLod.ts` maps static saved object/parent transforms and polygon faces onto original GLB triangles. Only complete, unambiguous named objects can be omitted; unknown/unmatched/shared/bound-setting geometry remains. `build-building-semantic-lods.ts` produces ten isolated candidates and independently compares exact retained triangle attribute/material/winding multisets after binary roundtrip, exported bounds and native anchor positions. All ten pass; far triangle total falls from 38,003 to 14,171. Original public models/recipes and saved scene hashes remain unchanged.

`render-building-lod-projections.ts` writes 60 software projections, including supersampled depth-buffered PNGs. Four contact sheets in semantic-pilot/projections were reviewed: roof/compound silhouettes, apertures, bays, shutters and balcony outlines remain coherent. Painter SVGs have overlap artifacts and are not the reviewed evidence. `semantic-pilot/lead-review.json` records the CPU review and remaining actual GPU/browser + projected-size transition gate. None are promoted. Next: compile these real lighter representations into an isolated five-owner whole-owner chunk/viewport proof with identical canonical ownership, then finish actual render/transition checks when the runtime is available.

Actual lighter-asset delivery now passes too. The pilot builder writes isolated five-owner detail/facade/massing manifests. All three compile at render zoom 18 with exact source transforms, independent normals, canonical ownership and owner picking. `check-building-semantic-lod-streaming.ts` runs 20 real camera cases, including close→facade→massing→close, 1,214 picking checks, and a corrupt actual far-payload replacement that preserves good detailed geometry. Peak resident use: 15,733 triangles / 1,116,114 bytes; 38 geometries and materials disposed. Report: `semantic-pilot/streaming-checks.json`. These are actual building assets, unlike the earlier mathematical LOD fixture. Actual browser/shader rendering and projected-size transition review still block promotion.

## All-real semantic delivery continuation

The semantic study now covers all 20 reviewed real owners: 40 candidates pass exact retained-geometry, material/winding, native-position and envelope checks, with unchanged public/recipe/scene hashes. `artifacts/building-lod/all-real/` contains manifests, assets, all three zoom-18 chunk variants and 240 depth-buffered projections. All 16 four-view batch contacts were inspected; the same architectural invariants hold. `lead-review.json` records findings and the still-pending actual GPU/browser and projected-size gate. No promotion.

Real streaming now passes 64 camera cases, 12,052 picking checks and corrupt-real-payload fallback. Peak residence: 30,017 triangles / 2,046,486 bytes under 40,000 / 3 MB caps; 233 geometries/materials disposed. CLI options added to the existing study tools allow explicit isolated roots and all-real selection.

Frozen-cohort primary source interpretations for Boomstraat 23, Brouwersgracht 119 and Derde Egelantiersdwarsstraat 2 are in `overnight-source-review/interpretation.json`; all crop hashes checked. Boom23 has a stepped gable but the selected wall covers only half its frontage. Brouwers119 and Egelantiers2 require their second visible public façades before authoring. These are source-review progress, not completed models; never promote primary-only blank-side recipes. Next: inspect those secondary crops and source-bound silhouettes, prepare concrete inferred recipes, and continue actual render/LOD transition verification when runtime permits.

## Next frozen corner authoring

Secondary crops for Brouwersgracht 119 and Derde Egelantiersdwarsstraat 2 were inspected and hashes verified. `prepare-cafe-corner-draft.py` writes an isolated two-front Brouwers119 recipe/evidence bundle under overnight-source-review/cafe-draft: 19 apertures, exact physical endpoints, native roof peak, native shell and audited RD frame. Pure resolved IR/source-massing/schema and common owner/frontage/RD evidence binding pass. Metre proportions remain illustrative. The native front ramp/vertical crest conflicts with the observed curved gable shoulders; actual render critique and silhouette reconciliation remain required. No public model or source manifest was changed.

Egelantiers2 secondary crop has paired upper windows, gray ground, basement lights, dark entry and projecting left bay. Its native side starts at local [5.514,1.671] and ends [5.775,7.000], including an offset from the 4.564 m primary width. Visible Tuinstraat 187 numbering differs from the seed single-address metadata; confirm physical owner/return scope rather than blindly authoring the cached side as accepted. The source roof/gable maximum is 12.557 m. Boom23 native front consists of two wall surfaces spanning the whole 5.693 m width, so its earlier half-overlap does not mean half the façade is missing; combined source peak is 12.949 m. Steps still need evidence-authored outline review.

## Portable draft geometry continuation

Blender remains unavailable, but a concrete isolated café GLB can now be critiqued. `facade_mesh.py` consumes shared exact aperture outlines and emits closed oriented slabs without Boolean scene mutation. It supports injected triangulation; the installed Node earcut adapter is explicit. Aligned holes initially exposed T-junctions: subdivision now uses only unchanged existing input vertices, preserving area/winding and requiring manifold edges. Three focused tests cover curved/keyhole rays, area, Euler/manifold, 15 aligned holes and bad callback rejection. Production Blender assembly is unchanged.

`opening_mesh_capture.py` runs the existing recessed joinery builder with a temporary primitive adapter, restored on exit. Its beam up-axis error was caught and corrected. Independent saved-scene comparison (`check-portable-building-joinery.ts`, reproducible probe script) passes 51 ordinary openings / 739 objects / 6312 corners, within 1.23 micrometres; three separate projecting-bay transforms are explicitly excluded. This proves joinery positions, not material/shader or Boolean equivalence.

`build-draft-portable-meshes.py` retains compiled native source geometry and builds the two owned street faces. Unsupported roof details, façade assemblies, cornices, signs and shutters fail closed. `export-portable-building-draft.ts` writes only under artifacts, with named role ranges, real glTF, unit normals, roundtrip checks and native peak. Café output is 3277 triangles / 6 material draws / 377420 bytes after dark door-panel correction. Actual zoom-18 compiler proof retains every triangle, gives 2 batch draws and 0.463 micrometre position drift. Four CPU views were inspected; native triangular gable/spike remains a photographic mismatch, so not promoted. Lead critique: overnight-source-review/cafe-draft/portable/lead-review.json.

Next: reconcile that decorative silhouette through explicit native-wall ownership, retain immutable source shell and owner anchors, add supported observed dressing through shared generators, and review again. Portable studies do not bypass the still-required actual GPU/browser acceptance gate or license bulk stock substitution.

## Isolated worktree (user requested)

Continue all library work in `/Users/blackmad/Code/map-recall2/.worktrees/sol-building-library`, branch `agent/sol-building-library`, based on main HEAD `30a78198`. 681 untracked library files and 30 scoped artifact directories were moved out of the main checkout. Existing tracked mainline edits were preserved byte-for-byte; the isolated checkout has copies of pending shared RD-placement dependencies. `artifacts/building-library/worktree-isolation.json` records the inventory. node_modules and the frozen appearance cache are shared read-only inputs; never write through those links. No commits or production integration.

The user clarified that micrometre errors are not a model-quality target. Keep basic exporter correctness checks quiet; prioritize photographic likeness, useful shared generators and additional real buildings.

Brouwers119 refined draft is in `overnight-source-review/cafe-draft/refined/`: explicit photo-inferred curved knots with native crest/peak and immutable shell; source-wall ownership selects only primary walls 5/6. Shared `cornice_plan.py` now supplies the existing Blender generator and portable disjoint-aperture cornices. Nine cream-band boxes added. 3503 triangles / six draws. Four CPU projections generated; front and quarter inspected. The pointed/cropped crest and native roof behind the curve still need silhouette review; no acceptance or promotion. Portable slab regression checks pass from the new worktree.

## User speed correction and batch pipeline target

User clarified: thousands of buildings require snappy photo-to-recipe authoring, reasonable fidelity rather than perfection; POI-ness should inform which fronts earn extra reusable detail. By tonight deliver a reliable dozens/hundreds batch pipeline. Stop bespoke ornament work and numerical proof expansion; focus throughput, compact recipe authoring, one-pass preview review and reusable feature packs.

`batch_pipeline.py` now prepares, incrementally builds and previews cache-bound owners. `openingRows` accepts fractional centres/width/height/sill and multiple storeys, preserving the explicit existing IR. `bind_source_rd` centralizes geographic source binding. Native source primary envelopes are recovered without guessing a gable preset. Starters remain explicitly unreviewed and build only with `--include-starters`; edited recipes get a photo-pass status. Per-owner failure reports, source/library/recipe fingerprinted resume and isolated outputs are implemented.

Actual pilot: 40 recipe starters prepared in 5.99 s; 39 GLBs built in 26.97 s, one export-height failure. Endpoint-envelope adjustment caused a source-clip degeneracy on that owner, so it stays visibly failed rather than relaxing validation. Rerun cached the other 39. Initial preparation falsely rejected 44 frames because determinant equality used exact floating comparison; corrected. Next batches should show actual remaining source gaps.

`building-batch-review.ts` writes four ten-owner photo/model contact sheets and a searchable self-contained HTML page, with recipe/GLB links. POI candidates are currently footprint point matches against the cached orientation extract; none matched this initial batch. Broaden to close storefront suggestions carefully, not guessed owner/business assignments.

User requested the progress page in main. Explicit exception to worktree isolation: main and isolated `public/canal-drive/building-library-progress.html` mirror the gallery, with `building-library-progress-data` symlinks to the isolated batch. All editable models/recipes/tooling stay in the isolated branch. 40 cards / 39 inline previews / recipe link targets verified. Intended route: http://localhost:3000/canal-drive/building-library-progress.html. No port 3000 listener found; starting an isolated port 3001 server was denied by sandbox socket binding. HTML can be opened directly; never claim server is running.

Next: quick photo-pass compact edits for these 40, automatic gallery refresh, build fingerprints that include evidence image content/triangulator version, explicit feedback/status UI, 100-owner run and useful POI/front recipe packs. Keep 45 reviewed models distinct from unreviewed starters.

## Quick photo edits and progress refresh

Nine of the first ten batch recipes now have a compact photo pass (`photo-pass-01.json`): storey/bay counts, brick/ground colours, varied entrances/displays, segmental windows and Anjeliers145 bell form/attic light. `batch_pipeline.py apply --edits` merges only editable IR fields, preserves source identity/physical frames, validates before writing, and snapshots the original starter. `profileLayout` selects an inferred library gable form; explicit native roof geometry remains separate. Nine edits pass; the ten-owner before/after contact was reviewed. Ordinary historical facades are now more recognizable, while complex central core/dormer/ornament gaps stay short notes. This is a quick draft pass, not full owner acceptance.

Rebuild: 39 successful / one held source-clip failure, 25.08 s. Gallery exposes `photo edited` versus `starter`, actual notes and fresh asset checks. Stale/failed recipes no longer receive a GLB link or count from a leftover image. `preview --publish-root /Users/blackmad/Code/map-recall2` refreshes the user-authorized main progress-page bridge automatically. Main page verified at 40 cards / 39 previews / nine photo edited.

User explicitly authorized starting the app. `node --import tsx server.ts` in main was attempted, live session 36368 polled to terminal exit 1: sandbox denied Vite HMR port 24678 and app port 3000 with listen EPERM. Do not claim server is up, retry the same blocked start repeatedly, or bypass sandbox. A normal external terminal can run npm run dev; continue batch work independently.

## Batch scale and quick likeness continuation

All 39 buildable pilot recipes now have quick photo edits. The 30 additional edits are in photo-pass-02-04.json; all passed schema/source preflight. Shared forms replace coarse front silhouettes where the photo clearly calls for neck, bell, stepped or straight fronts; native roof stays separate. New cornice boxes initially exceeded the peak on two flat-front owners; fitting those inferred dressings inside the native envelope restored 39 builds, leaving only Anjeliers149 source-clip degeneracy. Four updated contacts/progress page expose 39 photo-edited drafts, not accepted owners.

Five reusable ground patterns are now in building_lib/facade_patterns.py and expanded by IR openingPatterns. Thirty actual photo-authored ground floors migrated to those generators with unchanged layout. Pattern choice is one JSON item; unusual fronts retain explicit openings. The recipe form/row/pattern workflow and batch commands are documented in BUILDING_IR.md.

A separate 100-owner batch excludes the pilot IDs using --exclude-batch. Preparation: 100 ready / 30 explicit source preflight failures in 11.14 s. First build: all 100 in 40.17 s, zero failures. Rebuilt against the ground-pattern library: all 100 in 44.01 s. All 400 CPU projections and ten photo/model contacts generated; broad photo fidelity pass is still pending. Two cached POI footprint matches suggest extra detail: Mr Jordaan at Bloemgracht102/104 and Box Sociaal at Bloemgracht47, both requiring photo confirmation.

Progress links: main public building-library-progress.html (40 recipes, 39 fresh previews, all 39 photo edited) links the separate building-library-scale-100.html (100 unreviewed starters). Each has a distinct data bridge so batches do not overwrite one another. Working models remain isolated. No server restart attempted after the confirmed sandbox EPERM. Reviewed baseline remains45.

Next: package a compact interactive recipe authoring card, inspect ten-owner scale contacts and make quick library form/row/ground edits, tighten batch resume/error feedback, improve POI/frontend component pack selection, and verify projected/browser style when that runtime is accessible.

## Static quick-authoring controls and scale photo pass

The 40/100 progress pages now contain embedded quick recipe controls and batch JSON download: upper rows, bays, window proportions/head, form, ground pattern, colours, attic light and ordinary/extra attention. `buildingBatchQuickEdits.ts` is a pure existing-IR patch compiler; it touches only changed choices and preserves identity/source/physical geometry. `buildingBatchQuickEditor.ts` queues per-owner edits without claiming live 3D mutation. Controls and scripts work without a server dependency; real browser interaction is still unverified in this sandbox.

`batch_pipeline.py run` applies edits, builds and generates the gallery in one command. `apply` validates attention before writing and removes an obsolete storeyLayout when explicit storeys replace it. Real schema/source tests passed 78 colour/layout cases across 39 valid pilot owners, with unchanged source shell and placement. An isolated downloaded-edit fixture completed apply→GLB→four previews; regenerating editor metadata returned the new two-row count correctly. It is test reuse of an existing owner, not new coverage.

`building-batch-quick-edit.ts` compiles short agent photo choices using the exact same browser compiler, making a photo pass compact data. First ten scale owners were inspected and edited through quick-photo-choices-01.json; all ten patches passed, then all100 compiled successfully in26.94s and 400 previews refreshed. Scale gallery now marks ten photo-edited drafts. Total quick-photo coverage:39 pilot+10 scale, baseline45 reviewed unchanged. Both main progress pages verified with40/100 control forms and download UI. Main app port still unavailable due the earlier confirmed sandbox bind denial; no repeated startup attempts.

Next: inspect remaining scale contacts and use short choices, add common projecting balcony/repeated joinery support through shared generators, improve staged resume hashes/failures and browser/consumer acceptance when runtime permits.

## Second scale photo pass and reliable edit refresh

Ten additional scale owners were inspected against photo-model-02.png and edited using quick-photo-choices-02.json. All ten patches and GLBs passed; build took2.63s with90 unchanged owners cached. All400 projections refreshed and the resulting contact was inspected. Scale now has20 photo-edited drafts; combined quick-photo coverage is59 (39pilot+20scale), with139 generated drafts across140 recipes. Compound twin-gable/tower facades and balcony stacks are explicit shared-generator follow-ups, not accepted likeness claims.

Published authoring instructions now include the isolated working directory and publication flags, so applying downloaded edits also updates the intended main progress page. Ground pattern controls no longer offer an unusable custom reset after a library preset is chosen. Batch resume now binds cached GLB and export checks by SHA256; a real isolated fixture proved valid reuse and corrupt-asset rebuild, restoring byte-identical GLB output. Existing cache states upgrade on their next build. Test report: artifacts/building-quick-editor-roundtrip/cache-integrity-check.json. Reviewed baseline remains45; browser/GPU review remains pending.

## Compound fronts, third photo contact, triangulation repair

Added gables.compound_profile: adjacent stock forms with fractional widths, independently declared eaves/top, explicit vertical tower junctions, and bounded heights. Existing IR profileLayout resolves compound parts into explicit knots without source-shell mutation. Quick controls/CLI now offer paired triangular, paired neck and central tower forms. Three previously inspected scale owners use these shared presets; paired attic lights are generated inside each local gable. Changing form also regenerates an existing attic light layout. Two analytical area/closed-slab checks and invalid dimension rejection are recorded in compound-profile-checks.json. Paired neck originally touched aperture edges at the throat; shared paired light width was reduced to preserve actual surrounding masonry.

Ten Bloemgracht owners from contact03 received compact photo edits. All100 scale GLBs ultimately pass after26.6s; all400 CPU views/gallery refreshed. Pilot39 also rebuilt successfully in10.93s, with the existing source-clipping hold retained. Total140 recipes/139 current GLBs/69 photo-edited drafts (39pilot+30scale). Baseline45 reviewed unchanged.

Portable earcut repair removes zero-area faces between vertically aligned openings, then restores existing edge vertices and still enforces facade area conservation and a closed oriented manifold. Actual Bloemgracht120 and paired-neck facades passed; reversed triangles and missing-area inputs are rejected. Evidence: aligned-opening-triangulation-checks.json. Contacts02/03 inspected after generation. Native rear/roof fragments visibly remain above some flattened fronts (especially Bloemgracht72), so these are draft likeness passes and not consumer-ready acceptance. Next shared massing work must reconcile inferred facade silhouette with native roof connectivity, rather than hiding fragments or weakening envelope validation. Remaining70 scale starters still need a quick photo pass.

## Facade-height control and fourth scale photo contact

Diagnosed Bloemgracht72 floating roof: batch eaves came from the low endpoints of a hipped native front-wall outline, while its central source front-wall top was11.247m. Flattening at9.042m removed upper owned wall and left a visible gap below the retained roof. Added a quick facade-eaves control that reflows storeys/openings, cornice components, profile and attic lights, with native owner-height bounds. It does not move raw source-shell vertices or placement. Applied photo-inferred flat cornices at the native front-wall top on72 and modern104; both passed.72 front/quarter views inspected: roof now meets the facade, including the side view. facade-eaves-checks.json verifies unchanged sourceShell, native peak and placement against pre-photo recipes.

Ten more Bloemgracht owners from contact04 received compact form/count/material/entrance edits. Four flat fronts use explicitly selected native front-wall tops, while ambiguous dormer/gable cases retain native form and an explanatory note. Allten applied and built in2.89s with90 cached; all100 current GLBs pass,400 projections refreshed and contact04 inspected. Total photo-edited drafts79 (39pilot+40scale); remaining60 scale starters await a quick pass. Both published pages now include facade-eaves controls. Reviewed45 baseline remains unchanged. Taller rear roofs and photo/native roof differences remain explicit draft issues, not hidden by front-only cropping.

## Scale photo contacts05–07

Inspected and edited30 additional Bloemgracht/Bloemstraat owners through compact choices05,06,07 using stock straight/neck/bell/stepped/triangular forms, photo bay/floor counts, materials, library entrances, attic lights and selected facade-eaves heights. Three ten-owner apply/build passes succeeded without failures in2.53s,2.80s,2.45s respectively, each reusing90 unchanged assets. Result contacts05/06/07 inspected. Source shell, placement and owner-height invariants checked against pre-photo recipes for all30; evidence in photo-pass-05-07-checks.json.

Scale now70 photo-edited/30 starters. Combined batch coverage140 recipes/139 current drafts/109 photo-edited. Bloemgracht160 is explicitly evidence-held: trunk obscures most of its facade, so only visible finish was adjusted and starter counts remain unconfirmed. Pipeline apply now validates/persists an explicit reviewHold string (null clears); gallery shows evidence holds separately from build failures and editable-draft counts. This preserves valid geometry while preventing photo-pass status from implying confirmed likeness. Cached food POI atBloemgracht47 remains extra-detail priority, requiring date/identity confirmation before store-specific features.

Common missing features from these contacts: roof dormers, projecting balcony stacks, unequal/grouped bays, repeated attic lights, horizontal material bands, steps/railings. Native rear owner volumes remain in whole-owner projections, including tall compounds such asBloemgracht129/191; no silent crop or owner splitting. Next: remaining30 source photo passes, then implement useful shared component packs and run district-consumer acceptance when runtime is available. Baseline45 reviewed unchanged.

## Completed first scale photo pass; dated evidence views

Final30 scale starters authored from contact08/09/10 using quick-photo-choices-08-10.json and the same quick compiler. All30 applied and rebuilt in7.58s with70 unchanged assets cached; all100 scale drafts current, zero build failures. Updated contacts inspected. Complete-quick-photo-pass-checks.json records counts, last30 unchanged source-shell/owner-height/placement and pending consumer review. Total batch140 recipes/139 generated drafts/139 photo-edited drafts (39pilot+100scale). This is quick inferred authoring coverage, not139 fully accepted buildings. Baseline45 reviewed remains unchanged; original frozen holds remain.

Bloemstraat83 has an explicit evidence hold because dense foliage hides nearly all of its front, alongside the existing Bloemgracht160 hold. Only visible colours were adjusted for these owners; starter opening counts are unconfirmed. Several final crops omit their upper silhouette; those recipes retain native forms and provisional count notes rather than claiming confirmed roofs.

Both progress pages now expose roof and ground evidence as dated inline crops on every card, so authoring can inspect truncated full views without leaving the page. Ground and roof can come from different capture dates; each date is displayed. Verified40/100 evidence panels with one roof and one ground crop per owner. Pages remain visually standalone with embedded images; editable models/tooling isolated. Next shared generator priorities from real photos: dormers, balcony stacks, grouped/unequal bays, multiple attic windows, material bands and entrance steps/rails. Native roof/profile reconciliation still required on major compound anomalies; photo/placement/browser acceptance not replaced by pipeline success.

## Shared balcony generator on eight real fronts

Extracted the existing Blender balcony implementation into pure balcony_plan.py, consumed by both Blender component_details and the portable builder. It emits the same closed slab, front/side railings and balusters. Added fractional componentPatterns/balcony-stack expansion in IR with unique storeys, bounded centres/width, floor-relative walking datum, editable component defaults and inferred provenance. No owner-specific generator branches. Quick controls/CLI provide centre/left/right/wide stacks and none; floor/bay/eaves/window-ratio changes reflow the generated pattern. Manual components remain explicit.

Eight photo-observed stacks applied onAkoleien8,Anjeliers167/169/59,Bloemgracht195/193,Bloemstraat77/81. Scale100 rebuilt against the shared backend in27.56s, zero failures; all400 projections refreshed. Pilot39 rebuilt in10.51s, original source hold retained. Front/quarter views inspected forAnjeliers167 and front forBloemstraat77. Component source-shell/placement/owner-height invariants preserved for all eight. Source roof/compound anomalies on some owners remain visible pending separate reconciliation.

Exported primitive role ranges now preserve componentId/componentKind as well as opening/front/source roles. Eight real GLB roundtrips confirm496 closed balcony boxes/5952 triangles with named component roles; row-change reflow and none/removal passed. Pure sample verifies slab walking datum, projection, positive box dimensions, oriented closed box topology, repeated floor datums, invalid fraction/storey rejection. Evidence: balcony-plan-checks.json and balcony-export-checks.json. Both published pages verified with40/100 balcony controls; total139 quick drafts unchanged, baseline45 reviewed unchanged. Next: dormer support with explicit source-roof ownership and openings, grouped bays/repeated attic layouts, and district/browser acceptance when runtime permits.

## Native-supported flat dormers in the fast backend

Portable sourceDormers reuse the existing dormer_plan support/height/window contract. Added explicit selected-roof footprint subtraction in compile_source_massing; attachment support samples the retained native covering before those attachment voids. This separates proof of roof support from the final opening and prevents native roof triangles sealing the dormer. Duplicate IDs/overlapping dormer footprints are rejected. Raw sourceShell remains unchanged. Closed front cheeks contain a real aperture/recessed joinery, closed rear cheeks, flat cap and fascia. Curved caps/sourceRails remain unsupported in portable drafts and fail explicitly. Blender consumes the same source-roof subtraction; optional per-dormer colours now use its existing material factory.

source-dormer-edit.py selects intersecting source roof surfaces for a photo-observed primary-front dormer, verifies full support/cap envelope and emits existing-IR edits. Explicit index override supports manual semantic selection; no automatic dormer-presence inference. Two photo-observed central dormers added onBloemgracht84/80. Both passed, native owner peak/footprint/source/placement preserved, front/quarter previews inspected. Source roof ownership equals declared footprints. Scale100 rebuilt in28.51s withzero failures and400 refreshed projections; pilot39 rebuilt in11.29s withoriginal source hold retained. Source attachments and arched fixture support passed, as did existing native-roof recipesAkoleien2,Anjeliers69–71,Lauriergracht67–69. Ownership fixture proves complete projected cut area, overlap/unsupported footprint rejection and unchanged source. Evidence: dormer-roof-ownership-checks.json and dormer-real-export-checks.json.

No new coverage count claimed from adding details:139 generated/photo-edited drafts, baseline45 reviewed unchanged, two obscured evidence holds retained. Next: more photo-observed dormers through compact edits, grouped bays/repeated attic lights and shared bands/entrances, source-compound reconciliation and consumer acceptance when runtime permits.

## Reusable attic-light layouts

Added openingPatterns/attic-lights to the existing facade pattern IR, supporting single/wide/stacked layouts and one/two-gable repetition. It uses the selected facade profile top bounded by the attic-storey ceiling, rather than a taller rear owner roof peak. Lights expand into ordinary recessed aperture openings consumed identically by Blender and portable geometry, with inferred provenance. Raised-profile requirement, aperture containment and closed oriented slab checks remain active. Quick editor controls store the selected layout, enable its attic storey/pattern on choice, remove it via checkbox, regenerate with form/eaves changes, and preserve attic layouts during ground-pattern edits.

Nine real photo-observed gables now use stacked/wide patterns, includingBloemgracht32/25/109/172, Bloemstraat114/124/84 andAnjeliers185/197. Allnine edits passed; scale100 rebuilt withzero failures in27.76s and400 refreshed projections. Front views inspected forBloemgracht32, Bloemstraat114/84. Pilot39 rebuilt, original source hold retained. Source shell/placement/height unchanged on allnine. Pure triangular profiles pass single/wide/stacked closed-slab checks; paired neck stack supports4 lights; flat facade rejected; nine actual persisted editor contexts retain patterns through ground changes. Evidence: attic-layout-checks.json and attic-editor-roundtrip-checks.json. Both published40/100 pages verified with attic-layout controls. Coverage139 photo-edited drafts and baseline45 reviewed unchanged. More elaborate multi-tier/unequal gable windows remain editable explicit patterns; no per-owner generator branches.


## Second scale batch: 200 additional Jordaan owners and incremental previews

Prepared 200 additional owners, excluding the earlier40/100 batches and frozen library. All200 inventory entries have exact Jordaan districtMembership; no owner overlap with the preceding140. Preparation separately records61 skipped native-source failures (42 facade-envelope gaps,7 missing envelopes,11 roof/source topology failures,1 low envelope). These are unresolved geometry evidence, not modeled buildings. Cold build200 succeeded withzero failures in51.64s;800 software orthographic projections and20 photo/model sheets published at building-library-scale-200.html. Allthree progress pages link to each other; images now lazy load. Ten footprint-matched cached POIs suggest extra attention; no identity/store-specific appearance assumed.

Firstten quick photo choices authored and inspected in photo-model-01.png. Rebuild10 took2.43s with190 assets cached. First-photo-pass-checks.json verifies actual sourceShell, placement, height, buildingId, footprint, geometryRevision, sourceBundle, heightEvidence/heightChoice and physical frontage invariants against saved pre-photo recipes, plus current exported recipe hashes. Bloemstraat96/121 explicitly held for native front silhouettes differing from dated photos. Bloemstraat138 needs unequal grouped joinery; Bloemstraat67 needs an enclosed projecting bay/asymmetric attic. These are simplified photo-edited drafts, not likeness-approved buildings.

Total across three batches:340 distinct recipes,339 generated drafts,149 photo-edited and190 starters. Four explicit evidence holds across the scale batches; original pilot source failure retained. Baseline45 reviewed models and frozen holds unchanged, no production replacement.

The preview stage now supports --incremental and the batch pipeline enables it. Renderer source, native detail GLB and requested LOD GLB hashes determine reuse; every PNG/SVG output hash must match. Missing/damaged outputs redraw the affected model/level. Bounds still use current native detail, including LOD projections. Warm200 run reuses800 views in0.23s; a corrupt preview redraws4/reuses796 and restores byte-identical output. An isolated one-model fixture changes the GLB and verifies fingerprint invalidation and4 refreshed views. Complete warm apply-free pipeline (asset checks, previews, review sheets, page publication) measured6.72s. Evidence: incremental-preview-checks.json. Software rendering remains explicitly separate from GPU/browser acceptance. Next: finish more quick photo passes, shared unequal/grouped bay recipes and material/entrance packs; reconcile source-compound anomalies, then district-consumer acceptance when runtime permits.


## Wide window divisions and second scale photo passes02–04

Added shared windowDivision quick choices (automatic/single/pair/triple/wide-centre/wide-left/wide-right), backed by existing recessed opening mullion fractions. Colour-only changes retain authored rows, count reflow retains divisions, automatic clears an override, custom authored arrays survive unrelated changes, unknown preset rejected. Both browser cards and CLI consume the same pure compiler; all340 cards expose the choice. Bloemstraat138 now has broad centre/narrow side panes; Boomstraat68 has an uneven wide-left two-pane group. Five real upper apertures checked against captured mullion mesh centres and current exported recipe hashes. Evidence: window-division-editor-checks.json, window-division-mesh-checks.json.

Thirty additional photo passes completed in scale200, taking it to40 photo-edited/160 starters. Group02 plus existing138 detail adjustment built11/reused189 in2.66s, rendering44/reusing756 views. Group03–04 built20/reused180 in5.03s, rendering80/reusing720 views. All three updated comparison sheets inspected. Shared bell/stepped/paired-gable, attic and balcony presets selected where visible. Crop/occlusion holds onBoomstraat64/46 andBrouwersgracht799 compound retain unconfirmed counts. Whole-owner projections exposed retained source upper geometry crossing authored gables onBoomstraat61 and86/88: both held for source/gable ownership reconciliation, not approved forms. EarlierBloemstraat96/121 source silhouette holds remain. Native geometry/identity/placement/height and physical frontage unchanged against pre-photo snapshots on all40 edits; photo-pass-02-04-checks.json verifies current recipe export hashes and rendering counts.

Current aggregate340 recipes,339 generated drafts,179 photo-edited and160 starters. Scale200 has7 explicit holds; earlier100 has2. Baseline45 reviewed/frozen holds unchanged. Next: shared native-upper-envelope/gable ownership reconciliation, enclosed projecting bays/unequal fronts, additional quick photo passes, and browser/district acceptance when available. No production replacement or commits.


## Uneven bay widths and retained roof diagnosis

Investigated the authored-gable conflicts onBoomstraat61 and86/88. Selected source-front wall fragments are owned correctly; compiled native roofs and rear/side walls several metres behind the street plane project outside the new decorative profile. A front slab replacement cannot solve this whole-owner silhouette. Geometry unchanged, holds retained; gable-source-conflict-analysis.json records selected walls, authored profile and retained roof bounds. Requires an explicit inferred roof appearance recipe with ownership, rather than hidden cropping or silently discarding native surfaces.

Added widthFractions per opening-row centre to the existing IR, exclusive with uniform metre/fraction width. Values must be finite positive fractions with exact centre-count correspondence. Expanded openings still use the shared aperture slab and recessed joinery in Blender/portable backends. Quick bayLayout choices even/wide-centre/wide-left/wide-right use weighted slots and preserve window width within each slot. Custom nonuniform centres/widths are detected in gallery contexts, retained during row reflow, and require a library selection before count/width changes. Sash divisions remain independent.

Five real fronts now use unequal slots:Bloemstraat142, Boomstraat53/55,49/51,57/59,42. Allfive closed aperture slabs pass; bad width arrays rejected; editor reflow/custom-spacing/sash preservation tested. Five current exports preserve source/owner/height/placement and recipe hashes. Front projections inspected forBoomstraat49/51 and42. Evidence: uneven-bay-editor-checks.json, uneven-bay-layout-checks.json, uneven-bay-export-checks.json. Scale200 rebuilt200/0failed in54.73s following IR source change, but only20 projections redrawn/780 reused because other assets stayed byte-identical. Pilot39 rebuilt11.29s withoriginal failure retained; scale100 rebuilt33.86s withzero failures. All340 cards have bay-spacing controls. Enclosed central projecting bays and retained roof conflicts still unresolved; no new coverage/likeness approval claimed. Aggregate339 generated/179 photo-edited drafts, baseline45 reviewed unchanged.
