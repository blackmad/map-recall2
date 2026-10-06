# Fast building-specific facade pilot — 2026-10-06

Two interactive drafts are available at `/canal-drive/ordinary-building-pilot.html`: a modern block and an adjacent warehouse. Both compare a bare installed shell, an original procedural facade atlas and a small geometry supplement. Municipal 2020/2025 reference views appear beside the model. Orbit, zoomed-out view and draft GLB download work on the demo page.

These are experiments, not approved ordinary-building treatments or shipped game replacements. No fidelity-ledger entry was accepted, landmark registration changed or city-wide facade rule relaxed.

## Speed evidence

This was a short first pass with shared scaffolding, not a complete per-building authoring benchmark. Filesystem milestones establish:

| Milestone | UTC |
| --- | --- |
| First saved panorama-history response | 18:50:52 |
| First modern-block demo page created | 18:53:50 |
| Two-building controls/reference switching authored | 18:56:07 |
| Subsequent simplification/build, browser/export checks and archival | continued after those milestones |

That is roughly three minutes from the first acquisition to the first page, and five minutes to the two-building page. This excludes earlier candidate screening, later corrections, checks, archival and publication; it does not establish a sustainable three-minute accepted-building workflow. Shared viewer code was authored once, rather than a standalone application per building. Builds took about 50 ms with existing dependencies; NumPy/Pillow installation in a fresh uv environment took under a second. GDAL was not needed for these plane/perspective previews and was not installed or tested.

## Visual choices

Modern block, `NL.IMBAG.Pand.0363100012139498`: a brick end section, gray repeating balcony facade and two rows of pale-framed upper glazing. The atlas encodes this building-specific composition; no source-photo pixels appear in the model. The geometry trial adds balcony slabs and cutout railing planes. The first railing trial used individual pickets and 7,248 triangles; replacing those with original procedural cutout rail patterns reduced the viewer total to 888 triangles.

Warehouse, `NL.IMBAG.Pand.0363100012118320`: alternating broad/narrow opening groups, brick segmental arches, a pale cornice, newer upper wings and an open central gallery. Historic age alone was an inappropriate reason to exclude it from a speed experiment. The atlas trial cannot reproduce the open upper volume: its gallery is painted on an opaque shell. The geometry trial clips the upper wings to intervals of the native footprint and adds a few gallery platforms/posts. This makes the gap actual geometry. Main/upper height split, wing intervals and gallery depth are estimates, not surveyed dimensions.

Root inspected close and zoomed-out reference/render views. The major color/facade differences are visible. Important failures and unknowns remain: exact bay groups/counts, warehouse wide-opening/balcony detail, actual upper roof/setbacks, and rear-wall appearance. The shell's published scalar height is not independent proof of the correct whole-building roof elevation. These drafts demonstrate authoring routes; they have not passed recognition/open-space/game acceptance.

## Browser evidence

Headless desktop viewer checks on a 1440 × 1050 viewport, plus a 390 × 844 touch-emulated viewport, passed with no page errors. Desktop orbit and zoom controls, mobile zoom tap, both GLB downloads and GLB magic headers were verified. The browser report and screenshots are archived with the sources. FPS is deliberately not a gameplay benchmark.

| Trial | Viewer draw calls (includes grid) | Viewer triangles | Exported draft GLB |
| --- | ---: | ---: | ---: |
| Bare shell, either building | 3 | 44 | not exported |
| Custom atlas, either building | 4 | 48 | not exported |
| Modern atlas + balconies | 6 | 888 | 73,812 bytes |
| Warehouse atlas + open gallery | 12 | 216 | 75,608 bytes |

The standalone bundle includes Three.js/OrbitControls/GLTFExporter (~616 kB); this is shared demo scaffolding, not an asset cost per building. Procedural atlases are currently 2048 × 1024 pixels. Their GPU/material cost and reuse strategy need a real-game comparison before scaling.

## Multi-year reference evidence

A bounded 85 m discovery query returned 500 records across nine years: 2016–2022, 2024 and 2025. Pagination was deliberately stopped at five pages; this is not complete capture history. Two camera-near-target captures per building were selected for 2020/2025 and inspected. Selection is a simple distance heuristic, not an automatic obstruction score.

The warehouse's 2020 view has a conspicuous bright overhead streak, absent in the selected 2025 view. The modern composition is visible in both years. Multiple years can therefore improve reference usability for this example. Real alterations still need separate checks before mixing dated features.

2025 camera metadata has height zero; previews use angular perspective projection and do not use that value as NAP altitude. Our pilot previews use horizontal FOV and positive-up pitch. Portal deep links convert to vertical FOV and positive-down pitch; differing viewer aspect ratios still change framing. A separate shared source trial (public commit08ede49, private packb97968cc) reports near-identical municipal/project wall-plane crops under the same assumed calibration, with no geometry-fidelity advantage established. The archived extraction code is a useful independent projection reference; assumed camera/ground heights are not validated measurements.

## Sources and reproduction

Private source archive: `blackmad/map-recall2-source-data`, commit `436605b`, path `experiments/large-ordinary-fast-pass`. Contains original full panoramas, API responses, installed geometry snapshots, catalogue licensing capture, camera settings, processed references, screenshots, draft GLBs and checksums. All 29 files listed in the manifest passed checksum verification before its commit. The municipality's catalogue lists CC BY 4.0; reference panels attribute Gemeente Amsterdam. Raw imagery stays in the private pack; public reference panels are derived perspective crops, separate from original game textures.

```sh
node scripts/ordinary-building-pilot/acquire-references.mjs /absolute/path/to/map-recall2-source-data/experiments/large-ordinary-fast-pass
/your/venv/bin/python scripts/ordinary-building-pilot/project-references.py /absolute/path/to/map-recall2-source-data/experiments/large-ordinary-fast-pass
./node_modules/.bin/esbuild src/canalRecall/ordinaryBuildingPilot/viewer.mjs --bundle --format=esm --outfile=public/canal-drive/js/ordinary-building-pilot.bundle.js --minify
```

Next: verify each candidate's native massing and facade counts from clearer/opposite views, obtain independent recognition/open-space review, then run one selected treatment in the actual game with surrounding buildings and desktop/touch stationary pans. Keep the rejected opaque warehouse gallery and unverified geometry evidence. Choose the faster technique from appearance and game cost, not from triangle counts alone.
