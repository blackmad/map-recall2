# Dead-code candidates

Generated 2026-10-17 from the `pv-readme-arch` worktree. **Candidates only — nothing has been deleted.**

## Method

1. `npx --yes knip --no-exit-code` ran successfully (no new dependencies installed). It reported **1517 unused files**, **1072 unused exports**, **345 unused exported types**, **5 duplicate exports**, plus unused/unlisted dependency hints.
2. knip massively over-reports on this repo because it cannot see the two non-standard wiring patterns below, so every knip result was cross-checked with grep.
3. A grep-based cross-reference (a small throwaway script) collected every file reference from `package.json` scripts, `.github/workflows/*.yml`, and the contents of all `scripts/` + `src/` + `stories/` + `tests/` files, then flagged any `scripts/**` file whose name appears in none of them.

### Why knip alone is not trustworthy here

- **esbuild `--global-name` IIFE bundles.** `build:canal-*` scripts compile `src/canalRecall/...` into `public/canal-drive/js/*.bundle.js` that expose a `window.CanalRecall*` global. The legacy runtime consumes those globals by convention, so the "unused" exports are actually used — just not via `import`.
- **`tsx scripts/...` side-effect scripts.** Many generators/checks are run directly, not imported, so their exports look unused.
- **`window` globals in legacy JS.** `game.js` and friends call `window.CanalRecallRoute` etc.; grep for the global name confirms the link.

Two concrete false positives from knip's "unused exports" list:

| knip flagged | Actually used by |
| --- | --- |
| `HUT_WALLS`, `HUT_ROOFS`, `allotmentHouseTriangles` in `src/canalRecall/allotmentHouses.ts` | `scripts/check-allotment-house-render.ts` and `src/canalRecall/threeBuildingFeatures.ts` |
| `BAG3D_VERSION`, `ridgeHeightM` in `src/canalRecall/bag3dTiles.ts` | `scripts/build-lod1-city.ts`, `scripts/fetch-3dbag-tiles.ts`, `scripts/probe-3dbag-metadata.ts` |

So the sections below are ordered by how much they can be trusted: the script cross-reference (highest signal) first, then the export findings (curated and hand-verified), then the runtime asset checks.

## Summary

| Category | Count | Confidence |
| --- | --- | --- |
| `scripts/**` files not referenced by package.json, workflows, or other scripts | **582** | high (mechanical cross-reference) |
| `public/canal-drive/js/*.js` / `*.bundle.js` not loaded by any HTML or JS | **0** | high |
| HTML pages linked from nowhere | **7** (all intentionally-kept lab pages) | high |
| Unused exports (knip raw) | 1072 | low (see caveat); a hand-verified subset below |
| Unused dependencies (knip) | see "Bonus" | mixed |

---

## 1. Scripts not referenced by package.json, workflows, or other scripts (582)

**Evidence (shared):** every file below is absent from `package.json` script bodies, `.github/workflows/*.yml`, and all `scripts/` + `src/` + `stories/` + `tests/` contents. Reproduced with, e.g.:

```sh
# representative zero-hit checks (run from repo root)
grep -rn "check-ing-house-geometry" package.json .github scripts src stories tests
grep -rn "roof-golden|ROOF_GOLDEN" package.json .github scripts src stories tests
grep -rn "check-munttoren-geometry" package.json .github scripts src stories tests
```

Each returns no matches outside the file's own definition. **Confidence: high** that none of these are wired into any automated pipeline. (They may still be documented in `docs/` handoffs and run by hand — "unreferenced" ≠ "never run".)

One naming nuance: many per-landmark script basenames double as a **model ID** (e.g. `fire-station-anton` appears in `src/canalRecall/landmarks/modelAssetVersions.json` and `src/canalRecall/game/manual-poi-data.json`). Those are data references to the shipped model, **not** references to the `scripts/landmarks/fire-station-anton-*.ts` build/check scripts, so they do not make those scripts "referenced".

### Breakdown


- **Per-landmark geometry checks** — 84
- **Fire-station landmark scripts** — 74
- **Haparandaweg building scripts** — 25
- **Ordinary-buildings per-address scripts** — 32
- **Per-landmark check/export scripts (landmarks/)** — 143
- **Tree review / batch checks** — 30
- **Park/landscape check scripts** — 1
- **da-costa-block scripts** — 22
- **canalhouse-recipes scripts** — 43
- **facade-rebuild (python/vision) scripts** — 14
- **facade-eval scripts** — 1
- **review/* scripts** — 47
- **city-appearance scripts** — 3
- **Other top-level check-*.ts** — 49
- **Other top-level build/fetch/one-off** — 5
- **Other nested scripts** — 9

### Full list

#### Per-landmark geometry checks (84)

```
  check-amsta-de-poort-geometry.ts
  check-amstel-hotel-geometry.ts
  check-beest-boulders-geometry.ts
  check-beest-het-lab-geometry.ts
  check-beta-boulders-geometry.ts
  check-beurs-berlage-geometry.ts
  check-blauwe-theehuis-geometry.ts
  check-boomkerk-geometry.ts
  check-brouwerij-het-ij-geometry.ts
  check-cafe-kobalt-geometry.ts
  check-canals-museum-geometry.ts
  check-centrale-markthal-geometry.ts
  check-concertgebouw-geometry.ts
  check-conservatorium-geometry.ts
  check-dageraad-geometry.ts
  check-de-gooyer-geometry.ts
  check-el-tawheed-geometry.ts
  check-electric-ladyland-geometry.ts
  check-faralda-geometry.ts
  check-gerard-dou-synagogue-geometry.ts
  check-groot-melkhuis-geometry.ts
  check-hannekes-boom-geometry.ts
  check-haparandaweg-2-4-geometry.ts
  check-heineken-geometry.ts
  check-house-geometry.ts
  check-huize-frankendael-geometry.ts
  check-idfa-pavilion-geometry.ts
  check-ing-house-geometry.ts
  check-jeruzalemkerk-geometry.ts
  check-keith-haring-mural-geometry.ts
  check-keizersgrachtkerk-geometry.ts
  check-kinderkookkafe-geometry.ts
  check-lekstraat-synagoge-geometry.ts
  check-luther-museum-geometry.ts
  check-mediamatic-geometry.ts
  check-meerpadkerk-geometry.ts
  check-midwest-geometry.ts
  check-monk-amsterdam-geometry.ts
  check-mountain-network-geometry.ts
  check-muiderpoort-geometry.ts
  check-multatuli-geometry.ts
  check-munttoren-geometry.ts
  check-museum-amsterdam-noord-geometry.ts
  check-naco-house-geometry.ts
  check-national-monument-geometry.ts
  check-ndsm-container-arch-geometry.ts
  check-nemo-geometry.ts
  check-nieuw-dakota-geometry.ts
  check-nieuwe-kerk-geometry.ts
  check-nieuwendammerkerk-geometry.ts
  check-nightlife-geometry.ts
  check-nikolaas-myrakerk-geometry.ts
  check-oba-oosterdok-geometry.ts
  check-our-lord-attic-geometry.ts
  check-palace-dam-geometry.ts
  check-petruskerk-geometry.ts
  check-piramides-geometry.ts
  check-pllek-geometry.ts
  check-posthoornkerk-geometry.ts
  check-pulitzer-amsterdam-geometry.ts
  check-rai-europahal-geometry.ts
  check-rasphuispoort-geometry.ts
  check-singelkerk-geometry.ts
  check-sint-agneskerk-geometry.ts
  check-sloterdijk-geometry.ts
  check-social-history-geometry.ts
  check-stadhuis-geometry.ts
  check-stadsschouwburg-roof-geometry.ts
  check-straat-museum-geometry.ts
  check-the-rock-geometry.ts
  check-this-is-holland-geometry.ts
  check-treehouse-ndsm-geometry.ts
  check-uilenburger-synagoge-geometry.ts
  check-uva-roeterseiland-geometry.ts
  check-valley-geometry.ts
  check-vinoly-geometry.ts
  check-vondeltuin-geometry.ts
  check-w139-geometry.ts
  check-westergas-hall-geometry.ts
  check-westerkerk-annex-geometry.ts
  check-wine-guildhall-geometry.ts
  check-worship-geometry.ts
  check-worship2-geometry.ts
  check-zuiveringshallen-geometry.ts
```

#### Fire-station landmark scripts (74)

```
  fire-station-anton-check-compressed.ts
  fire-station-anton-check-geometry.ts
  fire-station-anton-cpu-source.mjs
  fire-station-anton-export-draft.ts
  fire-station-anton-panoramas.ts
  fire-station-anton-site-survey.py
  fire-station-dirk-check-compressed.ts
  fire-station-dirk-check-geometry.ts
  fire-station-dirk-export-draft.ts
  fire-station-dirk-panoramas.ts
  fire-station-driemond-acquire.py
  fire-station-driemond-check-compressed.ts
  fire-station-driemond-check-geometry.ts
  fire-station-driemond-export-draft.ts
  fire-station-driemond-panoramas.ts
  fire-station-driemond-prepare.py
  fire-station-hendrik-check-export.ts
  fire-station-hendrik-check.ts
  fire-station-ijsbrand-acquire.py
  fire-station-ijsbrand-check-compressed.ts
  fire-station-ijsbrand-check-geometry.ts
  fire-station-ijsbrand-export-draft.ts
  fire-station-ijsbrand-panoramas.ts
  fire-station-ijsbrand-prepare.py
  fire-station-nico-check-compressed.ts
  fire-station-nico-check-geometry.ts
  fire-station-nico-export-draft.ts
  fire-station-nico-prepare.py
  fire-station-nico-roof-sliver-report.ts
  fire-station-osdorp-acquire.py
  fire-station-osdorp-check-apertures.ts
  fire-station-osdorp-check-compressed.ts
  fire-station-osdorp-check-geometry.ts
  fire-station-osdorp-export-draft.ts
  fire-station-osdorp-panoramas.ts
  fire-station-osdorp-prepare.py
  fire-station-osdorp-record-sources.py
  fire-station-pieter-acquire.py
  fire-station-pieter-check-compressed.ts
  fire-station-pieter-check-geometry.ts
  fire-station-pieter-export-draft.ts
  fire-station-pieter-panoramas.ts
  fire-station-pieter-prepare.py
  fire-station-pieter-roof-slivers.ts
  fire-station-teunis-acquire.py
  fire-station-teunis-check-apertures.ts
  fire-station-teunis-check-compressed.ts
  fire-station-teunis-export-draft.ts
  fire-station-teunis-panoramas.ts
  fire-station-victor-acquire.py
  fire-station-victor-check-compressed.ts
  fire-station-victor-check-geometry.ts
  fire-station-victor-export-draft.ts
  fire-station-victor-panoramas.ts
  fire-station-victor-prepare.py
  fire-station-victor-record-sources.py
  fire-station-weesp-check-compressed.ts
  fire-station-weesp-check-geometry.ts
  fire-station-weesp-export-draft.ts
  fire-station-weesp-panoramas.ts
  fire-station-weesp-prepare.py
  fire-station-willem-acquire.py
  fire-station-willem-check-compressed.ts
  fire-station-willem-check-geometry.ts
  fire-station-willem-export-draft.ts
  fire-station-willem-panoramas.ts
  fire-station-willem-prepare.py
  fire-station-zebra-check-compressed.ts
  fire-station-zebra-check-geometry.ts
  fire-station-zebra-export-draft.ts
  fire-station-zebra-images.py
  fire-station-zebra-pano-acquire.py
  fire-station-zebra-panoramas.ts
  fire-station-zebra-prepare.py
```

#### Haparandaweg building scripts (25)

```
  export-haparandaweg-2-4-draft.ts
  haparandaweg-11-check-geometry.ts
  haparandaweg-11-cpu-review.py
  haparandaweg-11-export-draft.ts
  haparandaweg-11-extract.mjs
  haparandaweg-11-window-inventory.ts
  haparandaweg-13-check-geometry.ts
  haparandaweg-13-cpu-review.py
  haparandaweg-13-export-draft.ts
  haparandaweg-13-extract.mjs
  haparandaweg-2-4-extract.mjs
  haparandaweg-57-check-geometry.ts
  haparandaweg-57-cpu-review.py
  haparandaweg-57-export-draft.ts
  haparandaweg-57-extract.mjs
  haparandaweg-65-facade-assembly.ts
  haparandaweg-8-338-check-geometry.ts
  haparandaweg-8-338-export-draft.ts
  haparandaweg-8-338-extract.mjs
  haparandaweg-9-check-geometry.ts
  haparandaweg-9-cpu-review.py
  haparandaweg-9-export-draft.ts
  haparandaweg-9-extract.mjs
  review-haparandaweg-8-338-pan.mjs
  review-haparandaweg-8-338.mjs
```

#### Ordinary-buildings per-address scripts (32)

```
  brouwers1-check.ts
  brouwers1-export.ts
  brouwers1-prepare.py
  build-amstelstraat16-details.ts
  build-canal-belt-box-details.mjs
  build-canal-belt-details.mjs
  build-canal-belt-spui-details.mjs
  build-canal-belt-three-details.mjs
  build-keizers603-details.mjs
  build-kerk136-details.ts
  build-kerk206-details.mjs
  build-nieuwespiegel555.ts
  build-prinsen211-details.ts
  build-prinsen215-details.ts
  build-prinsen485-details.ts
  build-prinsen767.ts
  build-rokin-north-details.mjs
  check-kerk136-geometry.ts
  check-nieuwespiegel555.ts
  check-prinsen215-geometry.ts
  check-prinsen485-geometry.ts
  check-prinsen767-draft.ts
  import-roofs.ts
  keizers575-check.ts
  keizers575-export.ts
  keizers575-prepare-glazing.py
  keizers575-prepare-native-profiles.py
  keizers575-prepare-walls.py
  keizers575-prepare.py
  leids67-check.ts
  prepare-nieuwespiegel555-spec.ts
  prepare-prinsen767-spec.py
```

#### Per-landmark check/export scripts (landmarks/) (143)

```
  afrikahuis-check.ts
  afrikahuis-decoded-check.mjs
  archive-model-sources.test.py
  audit-detail.ts
  brouwerij-het-ij-extract.mjs
  build-candidates.mjs
  build-dominant-building-backlog.ts
  build-homomonument-ground.ts
  cafe-kobalt-export.ts
  cafe-kobalt-panorama.ts
  capture-parks.mjs
  check-alder-birch-review.mjs
  check-bos-landscape.mjs
  check-botanical-landscape.mjs
  check-brasa-tunnel-game.mjs
  check-central-park-landscape.mjs
  check-cherry-poplar-review.mjs
  check-common-tree-models.mjs
  check-compact-public-park-game.mjs
  check-compact-public-park-landscape.mjs
  check-cultivar-colours-review.mjs
  check-elm-ash-tree-review.mjs
  check-evergreen-palm-review.mjs
  check-globose-tree-review.mjs
  check-honey-locust-review.mjs
  check-landmark-game.mjs
  check-landmark-suppression.mjs
  check-large-park-landscape.mjs
  check-museum-park-landscape.mjs
  check-next-public-park-landscape.mjs
  check-niod-geometry.ts
  check-occii-facade-offset.mjs
  check-osm-tree-coverage.mjs
  check-park-game.mjs
  check-public-park-eight-game.mjs
  check-public-park-eight-landscape.mjs
  check-requested-street-buildings.mjs
  check-rijksmuseum-geometry.ts
  check-six-park-landscape.mjs
  check-spreading-tree-review.mjs
  check-tree-game-preference.mjs
  check-tree-model-review.mjs
  check-tree-orientation-review.mjs
  check-tree-species-review.mjs
  check-visible-landmark-loading.mjs
  check-westermarkt-paving.mjs
  check-willow-serviceberry-tree-review.mjs
  collectie-six-export.ts
  commons-fetch.mjs
  dorus-theus-brug-export.ts
  dump-facade-openings.ts
  electric-ladyland-acquire.py
  electric-ladyland-cpu-review.py
  electric-ladyland-export-draft.ts
  export-brouwerij-draft.ts
  export-frontage-drafts.ts
  figure-kit-check.ts
  gerard-dou-synagogue-cpu-review.mjs
  gerard-dou-synagogue-export.ts
  gerard-dou-synagogue-extract.mjs
  hannekes-boom-scope.py
  historic-games.sh
  historic-wire.py
  huize-frankendael-acquire.py
  huize-frankendael-export-draft.ts
  huize-frankendael-source.py
  import-requested-street-buildings.mjs
  kesbeke-check-decal-planes.mts
  kesbeke-check-geometry.mts
  kesbeke-check-signage.mts
  kesbeke-extract.mjs
  kesbeke-source-crops.mts
  klimmuur-centraal-draft.ts
  lekstraat-synagoge-export-draft.ts
  lekstraat-synagoge-panoramas.ts
  lekstraat-synagoge-prepare.mjs
  luther-museum-acquire.py
  luther-museum-decoded-check.mjs
  luther-museum-extract.mjs
  luther-museum-panoramas.ts
  luther-museum-source-manifest.py
  meerpadkerk-acquire.py
  meerpadkerk-prepare.mjs
  modern-fit.ts
  mountain-network-draft.ts
  museums2-houseboat-extract.mjs
  museums2-locate.mjs
  ndsm-warehouse-complex-extract.mjs
  nieuwendammerkerk-export-draft.ts
  nieuwendammerkerk-panoramas.ts
  nieuwendammerkerk-research.py
  nightlife-game-shot.mjs
  occii-feedback-check.mjs
  oosterparkkerk-check.ts
  oosterparkkerk-export-draft.ts
  pano-shot.mjs
  photo-colours.mjs
  podium-mozaiek-export.ts
  podium-mozaiek-source-crops.mts
  posthoornkerk-acquire.py
  posthoornkerk-export.ts
  posthoornkerk-panoramas.ts
  posthoornkerk-source-manifest.py
  render-cpu-preflight.mjs
  review-afrikahuis-label-baseline.mjs
  review-afrikahuis-load-failure.mjs
  review-afrikahuis-pan.mjs
  review-afrikahuis-pointer.mjs
  review-afrikahuis-source.mjs
  review-afrikahuis.mjs
  review-amstel-hotel.mjs
  review-concertgebouw.mjs
  review-fatih-side-material.mjs
  review-heineken.mjs
  review-multatuli-close.mjs
  review-nemo.mjs
  review-nes-rozentheater-repairs.mjs
  review-nieuwe-kerk.mjs
  review-palace-dam.mjs
  review-pulitzer-amsterdam.mjs
  review-stadhuis.mjs
  review-westergas-hall.mjs
  review-zuiveringshallen.mjs
  roeterseiland-bbox.ts
  roeterseiland-dump.ts
  roeterseiland-holes.ts
  roeterseiland-inventory-fill.mjs
  roeterseiland-montage.mjs
  roeterseiland-partplan.ts
  roeterseiland-photomap.ts
  roeterseiland-zfight.ts
  selective-position-precision.test.ts
  this-is-holland-acquire.py
  this-is-holland-draft-export.ts
  this-is-holland-extract.mjs
  this-is-holland-source-manifest.py
  uilenburger-synagoge-acquire.py
  uilenburger-synagoge-export-draft.ts
  uilenburger-synagoge-prepare.mjs
  uilenburger-synagoge-record-sources.py
  valley-draft.ts
  vinoly-draft.ts
  willem-de-zwijger-frontage-geometry-check.ts
```

#### Tree review / batch checks (30)

```
  check-inventory-tree-streaming.mjs
  check-municipal-tree-data.mjs
  check-osm-tree-supplement.mjs
  check-palm-tree-allocation.mjs
  check-tree-alder-birch-batch.mjs
  check-tree-cherry-poplar-batch.mjs
  check-tree-crown-orientation.mjs
  check-tree-cultivar-colours.mjs
  check-tree-elm-ash-batch.mjs
  check-tree-honey-locust-batch.mjs
  check-tree-render.mjs
  check-tree-species-batch.mjs
  check-tree-spreading-batch.mjs
  check-tree-willow-serviceberry-batch.mjs
  import-amsterdam-trees.mjs
  street-appearance/audit-extra-budgets.ts
  street-appearance/build-budget-experiment.mjs
  street-appearance/build-row-demo.mjs
  street-appearance/investigate-overtoom.ts
  street-appearance/investigate-transition.ts
  street-appearance/marnixstraat-pilot.test.ts
  street-appearance/render-marnixstraat-preflight.ts
  street-appearance/review-budget-summary.mjs
  street-appearance/review-cycle-pages.mjs
  street-appearance/review-frontage-probe.mjs
  street-appearance/review-marnixstraat-fallback.mjs
  street-appearance/review-marnixstraat-game.mjs
  street-appearance/review-retry-pages.mjs
  street-appearance/review-runtime.mjs
  street-appearance/review-surveyed-envelope-game.mjs
```

#### Park/landscape check scripts (1)

```
  check-park-landscape-streaming.mjs
```

#### da-costa-block scripts (22)

```
  annotate-blind-awning-state.mjs
  audit-neighbourhood-heights.ts
  audit-neighbourhood-visibility.ts
  check-demo.mjs
  compare-agent-review.mjs
  compare-roof-mesh-evidence.mjs
  compare-self-review.mjs
  compare-storefront-roof-components.mjs
  diagnose-roof-components.mjs
  prepare-agent-review.mjs
  prepare-blind-storefront-sample.mjs
  prepare-ground-bays.ts
  prepare-roof-aerial.mjs
  prepare-self-review-roofs.mjs
  prepare-self-review-sample.mjs
  prepare-storefront-roof-followup.mjs
  prepare-temporal-ground-bays.ts
  promote-storefront-roof-review.mjs
  record-blind-storefront-review.mjs
  record-temporal-ground-bays.mjs
  stage-expanded-aerial.mjs
  summarize-neighbourhood.mjs
```

#### canalhouse-recipes scripts (43)

```
  aerial-roof-request.test.ts
  archive-reference-sources.py
  assemble-reference.test.ts
  balcony.test.ts
  bay-authoring.test.ts
  cached_owner_test.py
  check-assets.mts
  check-roof-height-evidence.mts
  check-row-neighbors.mts
  compact-authoring.test.ts
  compare-panorama-projection.ts
  complete-frontage.test.ts
  compose-preview.ts
  compound-reference.test.ts
  export-integrity.test.ts
  finalize-admission-camera.test.ts
  front-return.test.ts
  frontage-423.test.ts
  glazed-bay-host.test.ts
  glazed-door.test.ts
  height-grid.test.ts
  opening-occlusion.test.ts
  oval-opening.test.ts
  panorama-sampling.test.ts
  prepare-aerial-roofs.mts
  prepare-cached-identities.test.py
  prepare-cached-roof-views.mts
  prepare-house.test.py
  prepare-rough-batch.mts
  project-dated-references.mts
  project-review-row-sources.ts
  render-software.ts
  research-beeldbank-photos.py
  research-finalize.py
  research-fronts.ts
  research-photos.ts
  research-roofs.ts
  research-survey-rings.py
  review-game.mjs
  software-camera-clipping.test.ts
  source-fetch.test.ts
  source-view-board.ts
  survey-recipe.test.ts
```

#### facade-rebuild (python/vision) scripts (14)

```
  analyse-photo-appearance.py
  benchmark-dino-sam.py
  build-opening-review-panels.py
  build-router-review.mjs
  build-source-coverage.ts
  capture-fitted-photos.ts
  capture-photo-pilot.ts
  check-opening-fit.py
  compare-dino-models.py
  compare-opening-approaches.py
  download-vision-benchmarks.py
  evaluate-photo-appearance.py
  extract-strip-features.py
  prepare-panorama-photo-run.py
```

#### facade-eval scripts (1)

```
  run_windet.py
```

#### review/* scripts (47)

```
  amstel-piramides.browser.mjs
  apply-source-silhouette.test.ts
  awning-geometry.test.ts
  build-case24-gable-city-preview.ts
  build-district-material-report.test.ts
  build-framing-overlay.ts
  build-neighbourhood-candidate.test.ts
  building-gable-candidate.test.ts
  capture-case24-gable-city-preview.mjs
  capture-facade-preview.mjs
  capture-neighbourhood-candidate.mjs
  capture-source-to-owner-city-preview.mjs
  capture-thousand-building-frontages.mjs
  check-case24-gable-city-preview.mjs
  check-facade-preview.ts
  check-ordinary-ten-game.mjs
  check-review-artifact-binding.test.mjs
  check-source-to-owner-city-preview.mjs
  contained-poi-highlight.browser.mjs
  contained-poi.browser.mjs
  diagnose-district-rectification-gaps.ts
  experiment-boresight-crop.ts
  generate-supplemental-thousand-sources.mjs
  generate-thousand-building-sources.mjs
  homomonument-ground.browser.mjs
  manual-poi-contract.browser.mjs
  next-stage-registration.test.ts
  next-stage-roofs.test.ts
  next-stage-temporal.test.ts
  opening-frame-clearance.test.ts
  pano-anchor-router.ts
  preview-notes.test.ts
  report-thousand-building-run.mjs
  retail-awning-sign.test.ts
  retail-registration.test.ts
  retail-source-corrections.test.ts
  roof-coverage-corrections.test.ts
  sample-composition-audit.test.ts
  sloterdijk.browser.mjs
  source-component-preview.test.ts
  source-shape-preview.test.ts
  stage-case25-source-correction.ts
  stage-case30-glazed-balcony-door-correction.ts
  stage-thousand-building-candidate.ts
  staged-owner-output.test.ts
  study-observed-sign-aspect.test.ts
  summarize-thousand-building-run.mjs
```

#### city-appearance scripts (3)

```
  evaluate-local-materials.test.mjs
  fidelity/bounded-paid-workers.test.mjs
  fidelity/prepare-source-manifests.mjs
```

#### Other top-level check-*.ts (49)

```
  check-agent-inspector.mjs
  check-allotment-canopy.mjs
  check-allotment-gardens.ts
  check-allotment-house-render.ts
  check-allotment-houses.ts
  check-amstel-towers.ts
  check-artis-animals.mjs
  check-brasa-tunnel-filters.mjs
  check-building-appearance-coverage.ts
  check-building-projection-scale.ts
  check-building-render-appearance.ts
  check-camera-follow.mjs
  check-centraal-complex.ts
  check-cinema-facade-surfaces.ts
  check-click-poi-info.ts
  check-collectie-six-boundary.ts
  check-dominant-building-triage.ts
  check-expanded-machine-sign-render.mjs
  check-explicit-poi-route.mjs
  check-facade-calibration.ts
  check-fatih-side-material.ts
  check-frontage-camera-render.mjs
  check-homomonument-ground.ts
  check-hospital-visibility.ts
  check-kriterion-current-pand-scope.py
  check-kriterion-glazing.ts
  check-kriterion-ownership.py
  check-machine-sign-render.mjs
  check-manual-map-pins.mjs
  check-manual-poi-researched-facts.ts
  check-neighbourhood-placement-map.mjs
  check-neighbourhood-render.mjs
  check-neighbourhood-sources.mjs
  check-nes-rozentheater-repairs.ts
  check-rasphuispoort-host-opening.ts
  check-rasphuispoort-installed-passage.ts
  check-roof-exterior-support.ts
  check-roof-review-audit.mjs
  check-roof-review.mjs
  check-router-benchmark.mjs
  check-router-review.mjs
  check-router-training.py
  check-signature-houseboat-suppression.ts
  check-signature-landmark-loading.mjs
  check-signature-pyramidal-roofs.mjs
  check-singelkerk-floating-roof.mjs
  check-this-is-holland-foyer.ts
  check-wall-bays.ts
  check-wall-interval-render.mjs
```

#### Other top-level build/fetch/one-off (5)

```
  audit-roof-assessments.mjs
  build-artis-animals.mjs
  build-click-poi-info.ts
  merge-branded-pois.ts
  review-allotment-houses.mjs
```

#### Other nested scripts (9)

```
  scripts/building-recipes/debug-fit.ts
  scripts/facade-twin/build-demo-data.ts
  scripts/monument-register/archive.test.ts
  scripts/ordinary-building-pilot/acquire-references.mjs
  scripts/ordinary-building-pilot/project-references.py
  scripts/pand-reference/thumbs-montage.mjs
  scripts/sculptures/multiview/compare-strips.sh
  scripts/storefronts/gallery-data.mjs
  scripts/storefronts/gallery-sprites.mjs
```


---

## 2. Unused exports (curated, hand-verified)

knip's raw 1072 "unused exports" are dominated by the false positives above. The genuinely-dead exports cluster inside the unreferenced-script groups: when a whole script (or a peer in its directory) is never invoked, its exports become dead by construction.

**Verified dead modules** (whole file unreferenced **and** every exported symbol greps to zero):

| Symbol | Defined in | Evidence (zero hits) | Confidence |
| --- | --- | --- | --- |
| `ROOF_GOLDEN`, `goldenFaces`, `roofHashesOf` | `scripts/block-face/roof-golden.ts` | `grep -rn "ROOF_GOLDEN\|goldenFaces\|roofHashesOf" --include='*.ts' --include='*.mjs' --include='*.js' .` → 0 hits outside the file | high |
| `STYLE_RULES`, `streetFile` | `scripts/street-surveys/street-style.ts` | `grep -rn "STYLE_RULES\|streetFile" --include='*.ts' .` → 0 hits outside the file | high |
| `SOURCE_DATA_PREFIX` | `scripts/building-recipes/sourceData.ts` | `grep -rn "SOURCE_DATA_PREFIX" .` → 0 hits outside the file | high |

**Partial** (file unreferenced, but some exports are still consumed by peers in the same unreferenced directory — deleting the directory removes them too):

| Symbol | Notes |
| --- | --- |
| `styleRules` (`street-style.ts`), `requireSourceData`/… (`sourceData.ts`), `measureWall`/`fetchBuildings` (`scripts/pointcloud/measure-tile.ts`) | imported only by other unreferenced scripts |

**knip "duplicate exports" (real, minor):** `SHEET_PITCH|PANE_OUT_M` (`src/canalRecall/blockBuilding/compose.ts`), `measureSurfaceColour|measureFacadeColour` (`src/canalRecall/building/facadePointCloud.ts`), `DRIVE_BY_RADIUS|DRIVE_BY_MIN_LOOKAHEAD` (`src/canalRecall/game/driveByTrigger.ts`), `DEFAULT_LIGHT_RIG|LEGACY_LIGHT_RIG` (`src/canalRecall/rendererShared/lightRig.ts`), `DESIGN_WIDTH|HUD_MAX_WIDTH_DESKTOP` (`src/canalRecall/viewport.ts`). Low risk; likely re-export aliases, worth a glance before any rename.

---

## 3. `public/canal-drive/js/*.js` and `*.bundle.js` not loaded by any HTML or JS

**Result: 0.** Every `.js` and `.bundle.js` under `public/canal-drive/js/` is referenced by at least one of: a `<script src>` in an HTML page, a `new Worker(...)`/`import(...)` in another JS file, or a build script (esbuild entry). Evidence: the cross-reference check above, plus targeted grep.

The files most likely to *look* dead are the **`*-source.js` esbuild inputs** (`three-runtime-source.js`, `detailed-buildings-source.js`, `pyramidal-roofs-source.js`, `signature-landmarks-source.js`, `facade-recipe-source.js`, `inventory-trees-source.js`, `google-tiles-source.js`, `player-vehicles-source.js`). They are **not** dead — `scripts/build-3d-bundles.mjs` (run by `build:canal-vehicles` / `build:canal-3d`) and `build:canal-three` list them as esbuild `entry` points:

```sh
grep -rn "detailed-buildings-source\|pyramidal-roofs-source\|signature-landmarks-source\|facade-recipe-source" scripts/build-3d-bundles.mjs
```

Confidence: high.

---

## 4. HTML pages linked from nowhere

These pages are not reachable from any other HTML, JS, test, or build file. They are **lab / review pages that are intentionally kept public** — list them here so they are never swept up in a "dead HTML" cleanup:

- `public/canal-drive/facade-block-demo.html`
- `public/canal-drive/facade-world-demo.html`
- `public/canal-drive/google-tiles-spike.html`
- `public/canal-drive/kit-viewer.html`
- `public/canal-drive/rendering-spike.html`
- `public/canal-drive/trivia-review.html`
- `public/canal-drive/wall-colour-review.html`

Note: `no-maplibre.html`, `own-ground.html`, and `renderer-spike.html` initially looked unlinked but are actually referenced by e2e specs / build scripts, so they are *not* listed as unlinked.

---

## 5. Deletion batches, grouped by risk

**Batch 1 — low risk, safe to delete now (historical one-shot tools, nothing imports them):**

- Per-landmark `check-*-geometry.ts` (84) — single-building geometry verification, superseded once the landmark shipped.
- Fire-station scripts (74) and Haparandaweg scripts (25) under `scripts/landmarks/` — per-building acquisition/export/check.
- `scripts/ordinary-buildings/` per-address scripts (32).
- Tree review/batch checks (30) and park/landscape checks (1).

**Batch 2 — low/medium risk (research/experiment scripts, python/vision):**

- `scripts/facade-rebuild/` (14) and `scripts/facade-eval/` (1) — python vision experiments (`*_windet.py`, `compare-dino-models.py`, etc.).
- `scripts/canalhouse-recipes/` (43) — includes standalone `.test.ts`/`.test.py` run ad hoc, not via `npm test`.

**Batch 3 — medium risk (domain research, review capture, still-useful evidence):**

- `scripts/da-costa-block/` (22) — neighbourhood POC prepare/compare/record scripts.
- `scripts/review/` (47) — review capture/stage/diagnose scripts (many are useful evidence for the reconstruction loop; confirm they are not referenced by handoff docs before deleting).

**Batch 4 — verify-before-delete (may still be run by hand from `docs/`):**

- Per-landmark check/export under `scripts/landmarks/` (143) — a large tail of one-per-building tools.
- Remaining top-level `check-*.ts` (49) and one-off `build/fetch/*` (5).

Recommendation: start with Batch 1, archive rather than `git rm` the research batches, and grep `docs/` for a filename before removing anything from Batch 3/4.

---

## 6. Bonus: unused dependencies (knip, cross-checked)

| Package | Status | Evidence |
| --- | --- | --- |
| `motion` (dependency) | unused | `grep -rn "from 'motion\|from \"motion\|motion/react" src stories` → only comments |
| `3d-tiles-renderer` (dependency) | effectively unused | imports are stubbed out by `scripts/build-3d-bundles.mjs` ("imports — into a path that does not exist") |
| `autoprefixer` (devDependency) | unused | Tailwind v4 (`@tailwindcss/vite`) handles prefixing; no `postcss.config` and no code reference |
| `vite` | **duplicated** | declared in both `dependencies` and `devDependencies` (`package.json` lines 536 and 562) |

knip also flagged `@napi-rs/canvas` as unused — **false positive**: it is imported by `scripts/roofs/*.mts` and `scripts/street-appearance/*.ts`.
