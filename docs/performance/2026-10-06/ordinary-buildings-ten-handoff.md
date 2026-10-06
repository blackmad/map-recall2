# Fast treatments for large ordinary buildings

## Result and demo

The new gallery is `ordinary-buildings.html` on the hosted Canal Recall site. It contains ten source-specific models, municipal reference crops, native-shell comparison, opposite and zoomed-out views, and GLB downloads. The original warehouse/modern-block experiment remains at `ordinary-building-pilot.html`; its rounded openings/brick arches, upper glazing tiers and mixed double-height ground infill have been refined. Those original two remain facade experiments, with whole-building integration unaccepted.

The ten new buildings use original procedural texture patterns and a small amount of geometry on their native installed footprints. They share the game's existing lazy model loading and fallback system. They are ordinary building treatments; their descriptive gallery labels do not create destinations, map POIs or trivia identities.

Final runtime/visual results are recorded below after the game review. Source-level acceptance is scoped to the visible exterior and stated approximations, not an exact reconstruction of every facade or present-day tenant.

## What we learned

1. **Screen the 3D building before making the facade recipe.** A filled 2D rectangle can conceal an open courtyard, stepped wings or suspended bridges. The first ten draft assets were rejected after official 3DBAG checks. Preserve the rejection audit; they are not accepted models. Rectangular roof projection alone also admitted Parkrand's bridges, which photographs correctly excluded.
2. **Photos still decide eligibility.** The fast set needs one dominant grounded volume, known open spaces, and a few observable defining features. Minor steps and a simple gable are manageable. Courtyards, raised structures, major wings and genuine mapped POIs use the full landmark workflow. This strict screen biased this batch toward industrial buildings; it does not prove that all urban office or apartment boxes are unsuitable.
3. **Height maxima are not building heights.** Subtract ground NAP from fitted roof vertices. A gabled hall's mean elevation is neither its eaves nor its ridge. The tall box keeps a roughly31.4m main volume and5.3m low strip, while small34m equipment housings are omitted.
4. **Source geometry needs interpretation.** The factory's fitted roof patches produced false jagged ridges. A current aerial instead shows regular shallow panels. An original regular grid on a continuous roof preserves that rhythm more faithfully and uses fewer triangles. Fitted planes remain useful for the other supported main roof forms.
5. **Write assemblies in physical dimensions.** Record glazing tiers, mullion groups, exceptional ground openings, piers, canopies, plinths and face-specific blank walls before generating. The factory needed its tall glazed loading assemblies; the commercial block needed glazing above its projecting pale band. A palette change could not supply either.
6. **A small exporter mistake can hide all the research.** glTF-Transform defaults to metallic materials. Explicit metallicFactor0 restored the facade colors under diffuse lighting. Duplicate parent walls caused speckling and were removed. Lower concrete bands must be painted before service doors. Checks now cover these shared regressions as well as finite attributes, UVs and roof normals.
7. **Multiple years help with obstructions, but do not erase uncertainty.** Clear2022/2020/2017 views supplement obstructed newer panoramas. The factory's2017 facade and scrub-hidden lower frontage remain documented limits. Unseen faces get conservative material treatment, not invented office windows.
8. **Generation speed is only one part of throughput.** Regenerating all ten from cached recipes takes under a second locally. Source acquisition, candidate rejection, visual repair, archive verification and actual game review took substantially longer. Do not describe that generator timing as ten completed buildings in one second.

## Implementation and ownership

- `scripts/ordinary-buildings/build.ts`: shared original SVG atlas and shallow-geometry exporter; source dimensions and per-edge assemblies belong to recipes.
- `scripts/ordinary-buildings/import-roofs.ts`: source roof-plane extraction. Explicit roofInterpretation records preserve curated visual overrides, especially2223044.
- `scripts/ordinary-buildings/check.ts`: structural/export checks. Visual acceptance remains a separate gate.
- `public/canal-drive/ordinary-buildings-data/{recipes,catalogue,build-notes}.json`: source decisions, fingerprints, payload and review records.
- `src/canalRecall/landmarks/ordinaryModels.ts`: ordinary model registration; exact BAG suppression, scale1, native footprint for picking, empty landmark identity.
- `browser.ts` exports GAME_BUILDING_MODELS and merges ordinary fingerprints; `vector-map.js` loads that set. Existing suppression callbacks update all ordinary layers, including independent pyramidal roofs.
- `src/canalRecall/ordinaryBuildings/gallery.mjs`: page-relative gallery assets. Hosting hoists canal-drive content to the domain root; hardcoded `/canal-drive/` asset paths break the deployed gallery.
- `scripts/review/check-ordinary-ten-game.mjs`: actual game checks, fixed rider with detached camera, desktop/touch, zoomed out, exact suppression, picking and delayed/failed load fallback.

Only one agent should own shared registration, bundles and the git index. GPU browser runs are serialized. New source/build workers should receive this document and a short task with explicit IDs rather than the full conversation.

## Source archive and failed evidence

Private repository `blackmad/map-recall2-source-data`, source commit `9ed72ffa39b0107d1a60c6efea88f7169b87c591`, verified on remote main before public assets were committed. Manifest: `experiments/ordinary-building-pilot/archive-manifest.json`. It verifies1023 payload files; all800 existing checksum references passed.

Raw/API/image packs: `experiments/ordinary-ten/{west,east,boxes,tall-boxes}` and `experiments/3dbag-screen`. Original two-demo pack: `experiments/large-ordinary-fast-pass` at earlier commit436605b. Source files and processed evidence are distinguished in the manifests. Municipal reference crops are attributed separately; none of their pixels are embedded in the model textures.

Failed initial assets and reference/render captures remain archived. Root evidence directories `artifacts/ordinary-ten/{initial-drafts,final,corrected,repaired}` record rejected candidates and successive shared rendering/architecture failures. `acceptance` contains the repaired comparison checkpoint; `game` contains actual-scene evidence. Passing TypeScript or a completed generation cycle is not visual acceptance.

## Reproduce

From the repository root, with the companion source repository available:

```sh
node --import tsx scripts/ordinary-buildings/build.ts
node --import tsx scripts/ordinary-buildings/check.ts
npm run build:canal-signature-landmarks
node scripts/build-3d-bundles.mjs
./node_modules/.bin/esbuild src/canalRecall/ordinaryBuildings/gallery.mjs --bundle --format=esm --outfile=public/canal-drive/js/ordinary-buildings-gallery.bundle.js --minify
npm run lint
```

`ORDINARY_SOURCE_ROOT` can point to a checked-out private source pack. Keep the current recipe overrides when importing newer roof evidence. Refresh the dominant-building and POI backlogs after integration. The standard-treatment fidelity ledger must contain dated sources and the actual recognition/open-space decision.

## Next steps

Prioritize a bounded central-city search for grounded office/apartment boxes with clear references, to test this workflow beyond port warehouses. Rank visual landscape impact and proximity to gameplay before spending research time. Cache official3DBAG geometry screening early, while retaining source-photo review for undercuts and courtyards.

Add source-specific assemblies to this shared builder when they recur: rounded arches, grouped upper glazing, double-height entrances and shallow piers. Extend the fast loop only when the next source/render comparison passes; a rectangular outline is not authorization to omit its defining assembly.

Keep the reported empty-wall screenshot task separate and open until its exact scene/building identities are established. These ten treatments do not resolve the general renderer policy that can strip ordinary facade identity from large landmark fallbacks. Continue desktop/touch camera pans away from the rider when changing LOD or startup behavior.

Improve the archive handoff with small per-candidate source manifests and a clear timing log separating source wait, authoring, generation, review and rework. Retain meaningful failures and currentness gaps prominently.

## Installed inventory and measured checks

| BAG suffix | Treatment | Triangles | GLB KB |
|---|---|---:|---:|
| 2242125 | Simple gray metal industrial shed | 678 | 159 |
| 2074248 | Dark brick commercial block | 680 | 100 |
| 2223044 | Gray factory hall with high narrow glazing | 430 | 74 |
| 2123231 | Dark ribbed hall with red loading doors | 1385 | 154 |
| 2183449 | Charcoal port warehouse behind containers | 1496 | 173 |
| 2191215 | Pale gray warehouse beyond canal scrub | 1637 | 198 |
| 2224669 | Dark metal warehouse with red delivery portals | 1509 | 197 |
| 2067126 | Pale corrugated shed with faded coral stripes | 1058 | 143 |
| 2159282 | White metal industrial box with concrete lower wall | 1182 | 193 |
| 2238052 | Tall charcoal ribbed industrial box with low southwest strip | 1796 | 318 |

Ten models total 1748080 bytes,430–1796 triangles/model and2–3 materials/model. All ten pass export checks and TypeScript. Root inspected reference/render comparisons and desktop/touch actual scenes, including native neighbors, source-specific western loading/office frontage and zoomed-out context. Independent review is recorded alongside the public catalogue.2191215 top-band contrast remains approximate;2223044 facade currentness remains conditional on2017 imagery.

Actual-game desktop and iPhone13 touch emulation ran serially in Chrome using AppleM4Pro Metal,900 settled-site RAF intervals plus90 zoomed-out intervals per profile. Desktop median/p95≈16.7/16.7ms; touch≈16.7/16.8ms; maximum16.8ms after settling. Both real input drags preserve the stationary rider. Exact shader suppression, native-footprint raycast identity, no fake POIs and disable/restore fallback pass. Delayed and aborted GLB loading retain fallback. None of these native target shells had pyramidal roof entries; the independent roof mask sets and restoration were checked, not a nonexistent target roof mesh.

Transitions are not stall-free: touch recorded seven startup tasks51–147ms and two later site tasks67/89ms. Desktop original transition history was lost on the fresh-page failure test; the harness now preserves that history, and no zero-stall claim is made. These are local desktop-GPU measurements under phone emulation, not physical-phone or comparative performance gains. The final concrete/plinth texture and narrow upper-band tweaks changed asset fingerprints but retained tested geometry; targeted render review followed.

Final validation source commit: `3b198f152fba4318eb248b776b4d452b46ca1d6a`, pack `experiments/ordinary-ten/validation-20261006/`. All185 payload hashes verified; failed iterations and the game-versus-final-texture checkpoint distinction are preserved.
