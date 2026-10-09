# Building library overnight handoff — 1 October 2026

Requested work window ended at 07:00 Europe/Amsterdam. A server restart and a
pending Chromium launch approval interrupted root execution; the approval returned
after the cutoff. New feature work stopped, and final status checks were completed
at approximately 09:05. Sol's code and source-review artifacts survived. No live
deployment or game enablement occurred.

## Available for review

- Local gallery: http://localhost:3000/canal-drive/building-library.html
- Five original POI buildings, three synthetic broader-building examples, and a
  25-preset material/component gallery have exported GLBs and editable scenes.
- Main evidence inventory: 60 full/roof/ground rectifications from 20 distinct
  panorama/date captures, covering multiple years for all five original owners.
- Additional batch: five proposed ordinary buildings, plus one held candidate,
  under `scripts/blender/expansion/`. There are 108 additional dated crops and
  inspected contact sheets. Draft recipes are staged; they have not yet received
  Blender render acceptance or been promoted into the main gallery.
- Source proportions start from the selected 3DBAG owner footprint/front wall.
  Roof shape, eaves inference and roof height statistics remain distinguished.
  Key Color government-height audit is preserved in
  `artifacts/jordaan-pois/height-audit.json`.

## Validated

- Foundation browser review: nine models, four views, orbit, lighting controls,
  dated photos and mobile layout; no errors or horizontal overflow.
- Foundation GLB checks and independent world-space roundtrip: nine assets pass.
  These checks apply to the saved foundation exports, not unbuilt new geometry.
- Current aperture component suite: 12 tests pass, including six Blender cases.
  Real through-holes, finish/plinth clearance, recessed glazing, angled storefront
  connectivity and rotated-frontage shell ownership are checked.
- Current pure roof suite: eight existing recipes, 15 fixtures, two independent
  height checks and 17 rejected-input cases pass. Roof Blender fixture/render
  review remains pending.

## New code awaiting integration

`apertures.py`, `walls.py`, `openings.py` and `ground_floors.py` provide opt-in
shared wall cutters, reveals, recessed glazing and angled storefront assemblies.
See `scripts/blender/APERTURES.md`. Existing recipe composition still uses overlay
openings; add a validated `wallCompiler` opt-in in schema/archetypes and start with
Key Color plus a synthetic recessed storefront fixture. Do not silently replace
Laurier's more specific central doors and raised side-window treatments.

`roof_surfaces.py` and `roofs.py` provide planar roof facets plus pitched, flat,
shed, gambrel and rectangular hip families. Schema still needs to expose gambrel
and hip with compiler preflight. Concave hip footprints are deliberately rejected.
Do not replace Lauriergracht 67/69's actual concave footprint with a rectangle.
See `scripts/blender/roof_tests/README.md`.

The chimney in `archetypes.py` still uses center-point roof height. Before claiming
attachment is fixed, sample all footprint corners, embed the bottom below the
minimum and place the top above the maximum; reject unsupported roof locations.
The recorded attachment gaps are not resolved by roof triangulation alone.

## Next review sequence

1. Integrate schema/archetypes contracts for aperture and roof families without
   modifying recorded evidence confidence or manual recipe overrides.
2. Fix chimney attachment; rebuild the eight main recipes and repeat export and
   image review. Saved public exports currently precede the new roof/compiler
   changes, so do not describe them as demonstrations of those changes.
3. Run roof review/fixture commands from the roof-test README and inspect seams,
   normals, gables, attachment and oblique/roof views.
4. Render the five staged expansion drafts using the expansion README, inspect
   source/photo comparisons, and refine explicit balcony spans, grouped bays,
   roof volumes and storefronts. Rozengracht 228 remains held for source-plane
   mismatch; Lauriergracht 37 has clipped-frontage/height uncertainty.
5. Promote only visually reviewed recipes, then test local game placement and
   block-level budgets. Remaining work includes real recess variants, dormers,
   multiple rear roof volumes, richer materials and runtime batching/LOD.

The implementation report, full roadmap, per-source audits and staged component
requirements contain the detailed findings. No photographs have been promoted to
accepted metric registration merely because a crop or schema test passed.
