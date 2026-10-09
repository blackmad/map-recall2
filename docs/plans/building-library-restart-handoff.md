# Building library restart handoff

**Latest pause checkpoint (2026-10-02):** [Building library paused handoff](building-library-paused-handoff.md). Use it for current worktree, 45-model baseline, 340 drafts, 200-owner LOD evidence and resume priorities. Counts and coordination instructions below are historical.

**Current entry point:** [Sol-only takeover plan](building-library-sol-takeover.md). The user requested that Sol own coordination and implementation entirely to reduce token cost. All workers stopped at saved checkpoints on 2026-10-01. Start with that plan, not this historical detail.

Updated 2026-10-01. The user explicitly requested a good stopping point and this handoff before restarting with broader permissions. Work resumed after restart: warehouse integration, stricter evidence binding and the reviewed roof/storefront visual corrections are complete. The latest coherent public batch contains 32 buildings (13 real candidates, 19 synthetic studies) plus the material gallery. All 33 GLB integrity/accounting, independent roundtrip and browser checks pass with no errors or mobile horizontal overflow. No commits or deployments have been made. The latest user objective is sustained autonomous improvement of the generator followed by all Jordaan owners after a practical confidence gate; the district work is not complete.

## Start here

Working directory: `/Users/blackmad/Code/map-recall2`.

- Current preview: http://localhost:3000/canal-drive/building-library.html
- Periodic progress: http://localhost:3000/canal-drive/building-library-status.html
- Before/revised visual critique: http://localhost:3000/canal-drive/building-library-review.html
- Approved visual direction: http://localhost:3000/canal-drive/gable-block.html
- Delivery plan: `docs/plans/building-components-delivery.md`
- Executable IR and evidence handoff: `scripts/blender/BUILDING_IR.md`
- Current pilot manifest: `scripts/blender/component-pilot.json`

The current pilot contains **32 building models: thirteen real candidates and nineteen synthetic studies**, plus a separate material gallery. All 32 were built through the common compiler and rendered in four views. All 33 GLB, roundtrip and browser checks pass; actual consumer placement was checked for the 13 real models. Photographic feature registration and unseen appearance remain explicit uncertainty; game replacement remains local review only.

The very latest user direction is important: **when an actual building exposes missing architecture, pause that case and build/refactor a reusable component instead of forcing a stock approximation.** The immediate example is warehouse loading windows/doors with arched paired shutters, as in the user's pakhuisgevel illustration. Warehouse components have now been integrated and verified in an explicitly synthetic fixture.

## User intent and working preferences

Build a remixable component library in the simple matte low-poly style of the eight-house sample block. Include ordinary terraces, apartment blocks, retail fronts and contemporary buildings as well as canal houses. Preserve entire buildings and roof depth, not facade cards. Keep gable silhouette, roof volume, window layout, material zones and ornament independently configurable. The user supplied likely AI architectural sheets as useful variation references, not reliable historical or geometric evidence.

Implementation and visual evidence interpretation should primarily be delegated to Sol (`gpt-6.1-sol` was used). The user prefers autonomous progress and is frustrated by repeated approval prompts. Their earlier responses selected fully automatic final assets as the eventual batch target, simple geometry with optional ornament, and restrained inference with uncertainty recorded. Do not invent unreadable text or spend on a separate external vision API; Sol evidence interpretation was preferred.

The user prefers easy, low-token periodic status pages for ongoing work. Update `public/canal-drive/building-library-status.json` at milestones; the linked static status page refreshes it every 30 seconds and shows its last-updated timestamp.

Use 3DBAG owner footprint and selected-frontage wall heights as dimensional anchors. Do not stretch the street facade to a roof percentile or a taller rear volume. Use multi-year rectified full, ground and roof images, counting panorama/date pairs rather than crop duplicates. Keep capture date, native resolution, owner, physical frontage, geometry revision and registration status. Same-owner side-facade evidence was a real previous failure at Bar Theo.

## Implemented in this session

**Shared geometry:** `building_lib/archetypes.py` now composes true facade apertures, finish/plinth cuts from the same profiles, recessed glazing, angled recessed storefronts, continuous gable coping, supported roof attachments, optional architectural components and explicit entrance steps. Bianco sign anchoring is centered. Horizontal sash bars now have a small depth offset to prevent coplanar crossing artifacts. A synthetic terrace has a 0.36 m raised door and two explicit steps.

**Roofs and gables:** Common roof compiler supports pitched, flat, shed, hip, gambrel and mansard. Gables include straight, triangle, stepped, spout, neck, bell and gambrel profiles; neck/bell can be raised. Dormers, roof-supported chimneys, gutters and ridge caps use shared geometry. Hip/mansard reject unsupported footprints instead of replacing them with a box. Roof fixtures live in `building_lib/fixtures/roof-components/` and were rendered through the common CLI. A bad tall dormer was corrected after visual review.

**Dressings and ordinary components:** `component_catalog.py` and `component_details.py` provide cornices, courses, lintels, sills, quoins, pilasters, rectangular stone surrounds, independently sized balconies, aperture-aware material zones, tables, chairs and planters. Balcony slab `z` means walking/top datum. The dressed-block fixture demonstrates broad glazing, differently colored floors and furniture. `material(..., style='simple')` uses matte colors and pale opaque glazing without textures; `textured` retains the existing 25-preset physical-repeat map library. The common composer defaults to simple.

**IR and batching:** Existing version-1 recipe is the executable IR, not a fourth parallel schema. `ir.resolve()` expands optional storeyLayout, gable family/rise/raised and openingRows with explicit centres in metres. It preserves explicit values and row provenance. `build-buildings.py` accepts repeatable `--ir`, `--manifest`, `--resume`, and an evidence-root override. It validates each input, stages outputs, records failures without stopping neighbors, writes resolved recipe downloads, and verifies input fingerprints/output file hashes for resume. CLI and Python library are version 0.2.0.

**Preview:** The existing library page now offers resolved JSON recipe downloads and a component vocabulary catalog. Capture/check scripts support a growing model count. Source review renders fit full exported bounds for oblique and roof views, accounting for camera aspect ratio. World lighting now matches the neutral sample direction.

**Three additional real studies:** Staged recipes for Rozengracht 249, Rozengracht 251 and Lauriergracht 37 were reviewed against dated contact sheets and updated with photo-supported balcony spans, pale bands, sills/cornices and storefront assemblies. Their exact footprint/selected-height/owner/roof assumptions were preserved. The latest 251 has a separate left entry, two fascia panels and readable source-supported moeders lettering. Selected evidence bundles and 48 derived images were copied to the public evidence directory through `publish-building-evidence.py`; originals remain untouched.

**Lauriergracht 37 scope repair:** The earlier three-column wall fix was superseded by the complete same-owner five-group composite frontage correction below. Original single-wall scope and nearest-vertex anchor were both wrong; canonical source-derived geometry and exact source placement now pass independent review/checks.

## Completed restart work

**Warehouse components:** `scripts/blender/building_lib/warehouse.py` is integrated into the common composer, schema validation and component catalog. Warehouse joinery defaults apply before shared aperture construction; paired shutters and separate hoists are built before facade transforms. Warehouse doors omit the generic single-door kick panel and handle, while `transom: null` skips the sash division. Paired leaves follow the actual arched aperture and support plank/panel styles and 0/90/180-degree opening angles.

The common-IR fixture `synthetic-warehouse-shutters` is explicitly synthetic and is included in the pilot manifest. Seven pure checks and eight Blender geometry checks passed; the translated/rotated facade check had maximum error ≈5.33e-7 m. Front, oblique, roof and ground renders were inspected in the isolated build at `artifacts/warehouse-components/build`; geometry results are in `artifacts/warehouse-components/geometry-checks.json`. The final warehouse fixture exports 7,690 triangles, 10 draws and 523,504 GLB bytes after the roof shape correction. Its initial isolated 7,700-triangle/524,396-byte result is historical. Seven pure and eight Blender warehouse checks passed again after the roof revisions.

**Evidence binding:** Real input now requires both `bundle.physicalFacade.frontage` and `recipe.placement.frontageLocal` to contain nonzero endpoint sets, with matching ordered physical frontage coordinates. Missing bindings cannot fall back to owner ID alone. Nine batch tests pass, and all 21 baseline pilot recipes validate. This closes the previously recorded missing-binding gap; photographic feature registration remains unresolved for real candidates.

**Roof and gable visual corrections:** Raised neck and bell gables now have broader coherent shoulder profiles and clean joins to the pitched roof; gambrel bodies have a clearer upper/lower slope break. Rozengracht 158 has a symmetric pale stone gable and the reusable `roof.frontJoin: "hip"` return with `frontHipRun`, creating one transverse front plane joined to the longitudinal pitches instead of independent triangular shoulder ramps. A visible dark roof backdrop behind its narrow stone shoulders is supported by dated photographs; the return depth and unseen roof volume remain inferred. The existing 58 roof checks and seven new pure/four Blender gable checks pass.

**Source-based storefront:** Rozengracht 158 now follows the dated 2022 storefront motif: rectangular outer frame, curved gridded transom, orange valance below the arch, uninterrupted display glazing, blue lower zone, clear lettering and a dark residence door panel. Generic transom, lower-panel, glazing-colour and text-placement options express this through the common compiler. `synthetic-shop-transom` demonstrates the same components at a different width; all four fixture views were reviewed. The shared default door kick panel now overlaps the glazing by 12 mm to close its seam; four signage/door checks pass. An independent focused review of the five original real-candidate ground views found no new visible signage, panel-seam or glazing regressions.

**Self-critique loop:** The user explicitly requested self-critique as part of each iteration. Independent inspection compared all four views of five affected models with the approved block and dated sources. R158's first storefront and roof iterations were rejected for remaining text/mullion overlap and separate roof ramps; subsequent repairs were reviewed again. Final simplified studies have no identified visible blockers in those views. This is visual review of the current simplification, not photographic reconstruction acceptance. Stable before/revised images, hashes, rejected iteration history and findings are in `artifacts/building-library/visual-critique/critique.json`; the public review page mirrors that evidence. Four synthetic roof studies use `artifacts/roof-gable-revision/v1/build`, and R158's combined latest storefront/roof uses `artifacts/roof-gable-revision/v2/build`.

**GLB accounting repair:** The GLB checker correctly found Rozengracht 158 had 15 exported primitives/draws while the manifest claimed 14 because its wall uses multiple materials. Export accounting now counts actual GLB primitives. The regression in `scripts/blender/test-building-export.py` and an isolated R158 export confirmed the corrected count of 15. The coherent final 22-asset rebuild and all 23 exported GLB integrity/accounting checks now pass.

## Final verified public state

- Coherent batch: **32 built, 0 failed**, thirteen real candidates and nineteen synthetic studies, plus a material gallery.
- GLB integrity/accounting, independent Blender roundtrip and browser checks pass for **33 exports/selector entries**. Browser errors are empty and mobile horizontal overflow is false after bounding the model selector width.
- Independent roundtrip maximum world-space vertex deviation is approximately 2.856061200873228e-6 m.
- Actual SignatureLandmarks/MapLibre consumer placement passes for all **13 real models**: maximum footprint error 0.000281432 m and roof error 0.000562305 m. Reports: `artifacts/placement-review/public-consumer-checks.json` and `artifacts/placement-review/`. This does not establish photographic registration or district performance.
- Assets excluding material gallery: **117,333 triangles, 7,954,768 GLB bytes**; maximum individual 10,845 triangles and 20 draws.
- Warehouse optional sloping hoist: eight pure and eleven Blender checks pass. Existing roof, gable, binding and sign checks remain documented in their reports.

The older 22-model totals (83,482 triangles, 5,501,416 bytes) and 21-model totals are historical. Current isolated cases are excluded from the verified public count until coordinator integration. Do not extrapolate geometry/export timing to automatic evidence interpretation.

Reports are under `artifacts/building-library/`: `batch-report.json`, `batch-state.json`, `glb-checks.json`, `browser-checks.json`, `independent-roundtrip-check.json`, `batch-integration-checks.json`; component reports/renders are in `components/`. Roof studies have another gallery in `artifacts/roof-components/`; the three real studies have source-sheet links in `artifacts/ordinary-real-pilot/index.html`.

## Recent storefront identity correction

Rozengracht 251 now carries readable pale lowercase **moeders** on the upper dark fascia, corroborated by the dated 2022/2025 evidence. The reusable sign supports optional positive finite `fontSize`, constrained by its explicit width/height; existing defaults remain unchanged. Eight Blender signage checks and invalid-value checks pass. Tiny-name v1 was rejected and preserved; v2 all-four self-critique and coordinator review pass. Review history: `artifacts/moeders-sign-review/critique.json`; isolated export 3,513 triangles, 16 draws, 238,356 bytes. Coordinator integrated the recipe and independently verified the readable name in the public browser; mobile review passes.

## Current isolated source-massing work

Source-derived massing and explicit selected-wall patch replacement now support compound owner shells and shallow recesses without widening global plane tolerances. Shared preflight gaps for opening depth/roof support and rotated bicycle-sign parenting have been repaired and regression-checked. Optional storefront cornices, horizontal upper-light bars, lower panels and sign fitting remain reusable IR features.

Lauriergracht 37 exposed a prior scope mistake: a single 14.78 m wall was treated as the whole owner front, even though the exact owner also contains a left full-height wing. The corrected composite frontage is 20.974889540171205 m, and original wider dated evidence shows five complete groups. Isolated `artifacts/l37-scope-correction/` restores those five groups, maps original padded crop coordinates, aligns inferred vertical proportions to the unchanged 18.722 m source wall height, repairs the upper pale band and entrance, and retains measured compound rear/roof geometry. V1/v2 appearance defects were rejected and preserved; v3 independent coordinator review approved simplified primary-front likeness in all four views. Corrected recipe and bundle now occupy their canonical expansion paths; canonical public export, GLB accounting and browser checks passed coordinator verification. Rear appearance remains unknown.

The independent source placement audit is `artifacts/building-library/placement-audit.json` (script beside it). Old L37 nearest-vertex anchor differed from its selected source origin by about 3.112 m. The corrected exact RD-to-WGS anchor agrees with the repository transform with zero anchor residual; retained source vertices roundtrip within approximately 1.17e-13 m. Actual consumer placement for all thirteen public real models now passes the independent source-frame audit above; feature/photo registration remains unresolved. Public baseline is 32 models, thirteen real candidates and nineteen synthetic studies.

## Known follow-up bugs and limits

1. Source-derived massing retains semantic rear/roof volumes and courtyard roof holes in integrated source-backed studies. Unreviewed side/rear appearance, richer curved dressing, texture bonds, LOD and district streaming/performance remain incomplete; verified consumer placement does not imply district replacement acceptance.
2. Full Jordaan reconstruction has not run. The earlier approximate 200-owner target is now an intermediate increment, not district completion. Cached exact municipal membership contains 3,189 primary owners; district preparation and broader component coverage remain active. Do not fabricate accepted counts or call synthetic fixtures real reconstructions.

Other audit fixes already applied: output placement is whitelisted so recipe.placement cannot overwrite manifest IDs/metrics/URLs; resume now hashes GLB, scene, resolved recipe download and requested render files; empty selection is rejected. The physical frontage check rejects reversed endpoints even for matching owner/revision.

## Jordaan expansion and sustained-work directive

Primary-front simplified likeness and whole-owner street appearance are separate review states. An owner can remain a useful candidate after its primary front passes while known evidence-supported side fronts are still blank or omitted. Such owners do not count toward fully reviewed owner coverage; track completed physical fronts and unresolved street-visible surfaces explicitly. Unseen rear inference must not be used to label a photographed street face unknown.

The user explicitly requested sustained work toward an excellent reusable generator and then the entire Jordaan once infrastructure is confident. Proceed autonomously through useful component repairs, evidence authoring and bounded district batches. The practical gate is at least 20 diverse real owners, including 12 visually confirmed ordinary buildings, with source-bound footprint/selected frontage height, verified owner/physical-plane identity, reviewed stylized resemblance, honest unseen inference and actual placement-transform export/render checks. District scale also requires tiled streaming/LOD and draw-budget benchmarks; loading thousands of unique buildings as one scene is not the acceptance target. Full pane-level photogrammetric registration is a separate metric status; inferred dimensions may support useful stylized models, while wrong owner/frontage bindings block authoring.

Cache-only coverage is reproducible with `python3 scripts/blender/expansion/jordaan_inventory.py`. It freezes six exact municipal buurt features from the worktree snapshot and reuses publisher footprint-intersection/priority ownership, excluding acquisition halo. `artifacts/jordaan-building-library/summary.json` records hashes and rules; `owners.json` records each owner; `next-cohort.json` freezes 20 new named multiyear evidence tasks. Twelve later-infill labels are a discovery heuristic and still require visual ordinary-building confirmation. First ten dated contact sheets and exact source seeds are staged; these are evidence preparation, not accepted recipes.

The cached boundary includes 3,189 primary/intersecting owners, 3,137 source shells, 2,606 owners with cached evidence, 3,252 distinct cached physical facades and 2,402 owners with a coplanar selected source-wall height. These are frozen cache counts, not a certified current live total or exhaustive street-side coverage. Six existing real recipes lie inside the exact boundary; Rozengracht 249 and 251 remain useful studies outside it. Crop planes may pad the physical frontage: retain both endpoint sets and scale mapping rather than treating crop width as facade width. Local coverage page: http://localhost:3000/canal-drive/jordaan-building-coverage.html.

## Resume commands

Run from repository root. The user explicitly authorized full Blender use for this work: “don’t ask for blender! you can do whatever you weant with blender”. The user also explicitly authorized Python execution: “DO NOT ASK ME ABOUT PYTHON SCRIPT EXECUTION, RUN RUN RUN”. Do not ask for routine Python or Blender confirmation; use direct approved executables and workspace Python rather than new escalated shell wrappers. Use the already-approved direct `/Applications/Blender.app/Contents/MacOS/Blender` executable calls; avoid shell redirection wrappers, which previously triggered a redundant prompt. Blender sometimes segfaults on sandbox startup with an USD Arch_ValidateAssumptions warning; the approved executable succeeds outside the sandbox. Follow the effective permission profile delivered to the session.

```sh
python3 scripts/blender/build-buildings.py --manifest scripts/blender/component-pilot.json --validate-only
python3 scripts/blender/test-building-library.py
python3 scripts/blender/test-building-batch.py
python3 scripts/blender/test-building-ir.py
python3 scripts/blender/test-building-components.py
python3 scripts/blender/roof_tests/check_roofs.py

/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python scripts/blender/build-buildings.py -- --manifest scripts/blender/component-pilot.json --render --resume
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python scripts/blender/test-building-composer.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python scripts/blender/test-building-components.py
python3 scripts/blender/test-building-batch-integration.py
node scripts/blender/check-building-library.mjs
node scripts/blender/capture-building-library.mjs
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python artifacts/building-library/independent-roundtrip-check.py
```

Run only checks relevant to subsequent changes; the suite above records reproduction commands, not a request to repeat every completed check immediately. New building-only runs use repeatable `--ir FILE`; manifests list paths relative to the manifest. Avoid simultaneous writers to the same output/artifact directories.

Most library scripts, documentation and assets are **untracked**, including work from previous sessions. Preserve them across restart. Unrelated tracked files changed transiently during this session (for example a driving-harness test) and were not touched by this work. Do not reset or stage the whole repository indiscriminately. The last status showed only the existing untracked library/artifact groups; no commits were created.

## Latest multi-front and atrium integration

Boomstraat 48/50 now includes both offset Boomstraat fronts and the evidenced Eerste Boomdwarsstraat side. Four-view self-critique and coordinator review passed the simplified visible street faces; crop registration disagreement and unseen rear appearance remain explicit. Rejected ground proportions and final review are preserved in `artifacts/jordaan-building-library/boomstraat-48-50/critique.json`. Generic Blender/browser fitting uses authored frontage bounds and outward normals without model-specific camera logic.

Bloemstraat 3/5/7 and the open-atrium fixture are integrated. The exact footprint and unmodified semantic surfaces remain; explicit audited basal closure, owned facade apertures and an inferred atrium cut alter selected surfaces. Metadata-only prose corrections are recorded in `artifacts/building-library/metadata-prose-edit.json`; geometry and evidence hashes were unchanged. Identical simple rendered material states now share one material, bringing Boom to the existing 20-draw cap without visual change; all four decoded render images match the accepted iteration exactly. Two pure and three Blender sharing checks pass; textured identities remain distinct.
