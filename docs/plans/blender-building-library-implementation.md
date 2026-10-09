# Building library implementation report

Date: 2026-09-30. Initial Sol implementation slice; candidates remain unaccepted.

## Completed foundation

- A: import-safe package, schema, facade frames, explicit storeys, surface-depth contract, concave polygon decomposition, five editable recipes and selected/all/validate/render CLI.
- B initial slice: 25 catalog presets, physical repeat scale, original portable colour/roughness/normal maps, cache, and material/component gallery. Existing material IDs and attributed source-image catalog reused.
- D demonstrations: synthetic terrace, two-frontage corner shop, and flat-roof apartment block.
- Required evidence: cache-only importer consumes multiple dated whole panoramas and outputs owner/physical-facade source bundles. Every migrated building now has multiple years of rectified full/roof/ground samples. Coverage counts independent captures; registration remains ambiguous.

## Evidence findings

The first cache inventory repeated 2024 Key Color full/roof and 2025 ground captures at 8000/4000 source resolution. That duplicate rectification run added no independent year. Reprojecting cached whole panoramas now supplies alternate-year full and roof views, and the wider cache search adds further years. No generated image details or feature fusion was used.

| Building | Usable primary capture years | Independent captures | Derived full/roof/ground crops |
| --- | --- | ---: | ---: |
| rozengracht-158 | 2022, 2023, 2024, 2025 | 4 | 12 |
| elandsgracht-96 | 2022, 2024, 2025 | 3 | 9 |
| rozengracht-160 | 2022, 2023, 2024, 2025 | 5 | 15 |
| lauriergracht-50 | 2022, 2023, 2024, 2025 | 4 | 12 |
| rozengracht-212 | 2022, 2023, 2024 | 4 | 12 |

Key Color 2025 has a clear street facade: two bays in three upper storeys, upper-sash vertical lights, and a straight cornice. The recipe corrects the prior invented triangular front and tree-hidden bay hypotheses. Dimensions are authored within source-shell floor datums, rather than promoted as registered pixel measurements.

Bar Theo’s preferred observation was its Akoleienstraat side facade. The importer now derives the primary RD plane from the selected frontage and recorded coordinate frame, rejects that side crop for primary coverage, and reprojects cached frontal panoramas onto the correct Rozengracht facade. The street cornice is explicitly photo-inferred at75% facade height; the side wall’s lower roof shoulder is not treated as measured street eaves.

Lauriergracht 50 uses grey/brown masonry and horizontal sash divisions from its clear 2025 view. Its angled recessed storefront is a remaining geometry target.

Height audit: Key Color selected 3DBAG front-wall top is about 15.18–15.20 m above local ground. The 17.23 m field is roof70p minus ground; the 19.48 m whole-owner surface range includes higher rear volumes. Neither stretches all street floors. PDOK 2024/2025 records both use AHN5/2023 and are not independent height measurements. Exact semantic source surfaces are retained in hidden SOURCE collections in editable scenes. Generated side/rear massing still uses one eaves extrusion over the exact footprint.

Evidence provenance and independent visual notes:

- `artifacts/jordaan-pois/height-audit.json`
- `artifacts/jordaan-pois/alternate-year-visual-review.json`
- `public/canal-drive/models/building-library/evidence/audit.json`
- Per-building bundles in the same evidence directory; geometry revision, pose, panorama/crop hashes, dates, native resolution, plane, pixel scale, registration, occlusion and rejection reasons.

## Measured budgets

| Model | Triangles | Draws | GLB KiB | Decoded maps KiB | Build seconds | Four render seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| elandsgracht-96 | 5539 | 11 | 337.8 | 1920 | 0.252 | 3.63 |
| lauriergracht-50 | 3559 | 15 | 351.4 | 2688 | 0.279 | 3.41 |
| rozengracht-158 | 3398 | 12 | 295.3 | 2112 | 0.217 | 3.97 |
| rozengracht-160 | 3752 | 13 | 292.3 | 2304 | 0.229 | 3.99 |
| rozengracht-212 | 3878 | 13 | 350.3 | 2304 | 0.358 | 3.66 |
| synthetic-corner | 3563 | 10 | 267.9 | 1728 | 0.218 | 4.17 |
| synthetic-flat-block | 8385 | 9 | 597.6 | 1536 | 1.946 | 4.02 |
| synthetic-terrace | 947 | 8 | 127.3 | 1344 | 0.201 | 3.87 |

Gallery: 32277 triangles, 25 draws, 2033KiB. This is a review scene, not a runtime building budget.

The real candidates meet the <=15k triangle and <=20 draw targets. The <=10 shared-material goal is not yet achieved for all buildings. Map memory is estimated asRGBA8 decoded source images without mipmaps; embedded encoded texture bytes and exported texture counts are checked separately.

Build times above are warm cached geometry/export measurements, excluding Blender startup and optional renders. No original-prototype cold/warm timing was recorded, so no before/after speed claim is made. Material texture creation is a deterministic smallPNG generator, not a costly Blender bake. Dedicated cold-cache versus warm-cache timing remains to be captured. Recipe edits are isolated: one recipe file plus one selected build; manual artistic overrides are not regenerated by normal builds.

## Validation and review

- Eight focused pure Python tests pass: transforms/handedness, asymmetric datums, ordered surface stack, actual concave footprint area, unsupported holes/invalid polygons, Bianco centering, Key Color corrected topology/height separation, independent capture counting and material cache portability.
- Nine GLBs pass finite position/normal/UV, index bounds, exact triangle/draw accounting, unity base-colour factors on baked colour textures (no double tint), budget, source-only exclusion and evidence owner/revision checks. Results: `artifacts/building-library/glb-checks.json`.
- Root independent roundtrip checks pass all nine scenes, comparing polygon-used vertices in world coordinates to reimported GLBs, including the rotated corner facade. Maximum deviation about 2.9e-6 m. Results and script: `independent-roundtrip-check.json`/`.py` in the same artifact directory.
- Source and browser cameras center facade views on the frontage rather than whole-owner bounds. Source renders provide front, oblique, roof and street-level views for all eight buildings.
- Browser capture script covers all nine models, four views, slow orbit, dated contact-sheet counts, lighting toggle and 390 px layout. Final browser validation passes all nine models with no browser/HTTP errors and no horizontal overflow at 390 px. Results: `artifacts/building-library/browser-checks.json`.

The review exposed and fixed the parent-transform GLB collapse, hidden source leakage between batch scenes, omitted side-roof infill, shed front apron and clipped roof camera. These checks establish export/layout health, not accepted visual reconstruction.

## Review paths and regeneration

- Local preview: `/canal-drive/building-library.html`
- GLBs/manifest/catalog/evidence: `public/canal-drive/models/building-library/`
- Editable scenes and renders: `artifacts/building-library/`
- Reproduction commands and module contracts: `scripts/blender/README.md`
- Previous prototype scene builder preserved as `artifacts/building-library/prototype-builder-before-extraction.py`; old five model assets and preview retained. `build-jordaan-pois.py` is now an import-safe compatibility wrapper for the new CLI.

## Remaining work

C is incomplete. Current openings are wall-overlay assemblies; actual apertures, reveals, continuous analytic joins, recessed angled shopfronts and complex rear roof/body volumes remain next. Source overlay makes that massing gap inspectable. Hip/mansard/gambrel roofs, dormers, measured gable curves, actual threshold/stoop/basement variants and supported evidence-specific details remain.

B follow-on: header/Flemish catalog variants, richer roof tile relief, channel-level texture deduplication, per-building wear, neutral/game-scale checks at 2/10/30 m and mipmap/orbit assessments. Existing attributed image textures are catalogued rather than falsely relabelled as complete PBR sets.

D remaining: real local validation for terrace/corner/block and warehouse/contemporary assemblies. E remains: LOD/batching, block-level mobile budgets, loading/suppression integration and runtime placement review. No live deployment, game enablement or source acceptance occurred.

## Next geometry slice in progress

Opt-in shared aperture profiles, exact wall/finish cutters, recessed glazing and angled storefront/threshold components now exist. All twelve current aperture tests pass, including six Blender solid/raycast/source-shell tests. Results: `artifacts/building-library/apertures/checks.json`. Baseline recipe composition still uses compatibility opening panels until integration and visual validation.
