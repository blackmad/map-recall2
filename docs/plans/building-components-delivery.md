# Building component library delivery plan

Date: 2026-10-01. Implementation authorized. This document specifies the delivery target; it is not a claim that every target is complete.

Build a reusable library in the simple, matte style of `/canal-drive/gable-block.html`. A component is complete when it can be selected in JSON, assembled through the shared Blender compiler, exported, and inspected as part of a building. Sol handles most component implementation and visual evidence interpretation. The coordinator owns contracts, batch integration, and rendered review.

## Delivery sequence

1. Unify the existing sample geometry and production recipe composer. Preserve existing recipe IDs, measured footprints, selected frontage heights, placement, and provenance. Integrate true apertures, recessed joinery, cut plinths, continuous coping, complete roof bodies, and supported roof attachments.
2. Add an explicit reusable component catalog and ordinary-building studies. Give architectural details material slots and frontage-local coordinates. Keep optional furniture separate from structural geometry.
3. Accept externally supplied building IR through the same CLI as existing recipes. Add batch manifests, validation before scene mutation, per-building failure records, deterministic input fingerprints, and resume. A failed building must not erase its previous export or stop unrelated buildings.
4. Demonstrate the integrated path on the five existing real POIs and synthetic terrace, apartment, and corner fixtures. Inspect front, oblique, roof, and street views. Extend the real pilot toward twenty owners, with at least twelve ordinary non-canal-house examples, before attempting the larger batch.
5. After the diverse 20-owner confidence gate, progress autonomously through all Jordaan owners inside the frozen exact municipal boundary. Use bounded evidence tasks, resumable compilation, independent critique and explicit built/simplified/retained/failed reports. A 200-owner batch may be an intermediate increment; it is not the district target. The user requested sustained work until the generator and district coverage are ready.

## Component coverage

| Family | Required reusable capabilities |
| --- | --- |
| Massing and floors | Exact footprint, independent facade frames, explicit floor datums, ground and upper material zones; preserve source geometry for inspection |
| Windows | Rectangular, segmental, round and elliptical heads; recessed glazing, sash/transom divisions, mullions, actual wall apertures, lintels and sills |
| Entrances | Single and double doors, panels and glazing, recessed doorway, threshold and explicit steps; railings and stoops |
| Retail | Plate glass, framed bays, angled recessed shop entry, separate residential entry, fascia, awning and centered text |
| Roofs | Pitched, flat, shed, hip, gambrel and mansard; independent straight, triangular, stepped, neck and bell gables; coping, gutters, chimneys and dormers |
| Dressings | White cornices, stringcourses, plinths, lintels, sills, quoins, pilasters and simplified stone or terra cotta surrounds |
| Street details | Explicit table and chair groups, planters, optional awnings and signs; no automatic furniture at every shop |
| Ordinary buildings | Repeated apartment bays, broad retail fronts, plain terraces, corner facades, warehouses and restrained modern glazing |
| Materials | Shared muted brick, render, painted masonry, stone, concrete, timber, metal, roof and glass slots; physical-scale quiet textures as an option |

The ornate canal-house reference is a source for component decomposition: stoop, door surround, cornice, dormer, window dressing and gable ornament. The approved block remains the overall style target. Prefer original parametric geometry; record URL, creator, license and modifications for any reused third-party asset and verify that its license permits distribution in the library.

## Intermediate representation and evidence

Extend the existing version-1 Blender recipe as the executable IR instead of introducing another competing building format. Preserve `footprint`, `frontages`, `storeys`, `roof`, `gable`, `materials`, placement and source evidence fields. Frontage coordinates are metres, X along the facade, Y inward, Z upward. Explicit component instances add stable IDs, kinds, dimensions, material slots and local placement. Roof attachments use roof coordinates. Wall, finish, plinth and joinery share the same aperture profiles.

For real buildings, bind IR to BAG owner, geometry revision and dated evidence bundle. Use 3DBAG selected-frontage wall heights and owner footprint for scale; roof percentile and highest rear volume do not become street eaves. Retain AHN/PDOK acquisition dates separately from release dates. Multiple products based on the same acquisition are not independent measurements.

Sol receives dated full-facade, roof and ground-floor rectified images from multiple independent captures, plus the measured geometry and supported component vocabulary. Return JSON and field-level observed/inferred/unknown basis with evidence references. Prefer one coherent appearance date for signage and shop use; older captures can clarify permanent structure. Pixel-derived proportions without registration remain inferred. Unreadable text and unsupported ornaments are omitted, not invented. Ambiguous owner identity retains the existing shell.

The batch manifest lists recipe paths relative to the manifest. Each building produces an editable scene, GLB, measured costs and a run record. Resume requires matching recipe, library and evidence fingerprints and existing output files. Validation failures remain visible; no default converts invalid real evidence into synthetic data. Geometry validity is separate from visual reconstruction acceptance.

## Sol assignments and integration

- **Openings and composition:** integrate shared aperture geometry into real and synthetic recipes; repair storefronts, sign alignment and entrance clearance. Own schema and main composer changes.
- **Roofs:** integrate all supported roof families and attachment primitives through the shared roof API; test roof/gable separation, joins and supported footprints.
- **Trim and ordinary components:** implement a catalog of reusable dressings and furniture, material zoning and ordinary-building fixtures; connect them to the composer.
- **Coordinator:** batch CLI, IR contract, input and evidence validation, resumability, docs, integration builds and visual inspection. Keep agent ownership separate and resolve interfaces before merging behavior.

Implement in short increments with working exports. Reserve the final delivery phase for integration and visual repair rather than adding isolated feature names. Complex multi-volume roofs, courtyard topology and additional ornament must remain explicit gaps until their actual compiler paths are supported and tested.

When an actual building exposes an evidenced feature that the current vocabulary cannot express, pause that case and add or refactor a reusable component. Add a generic fixture and parameter checks, then rebuild the originating building through the common IR path before continuing. Do not silently approximate a warehouse loading opening with a stock residential sash window. This rule already prompted independent balcony spans and partial source-wall ownership; warehouse shutters and loading openings are now a completed reusable example.

## Acceptance and scale gates

- Regenerate the original five and ordinary fixtures through one composer, with no building-ID geometry branches and no manual Blender edits.
- Check Bianco centering, floor datums, Key Color's straight cornice and measured front height, Bar Theo's primary frontage, clear door thresholds, supported roof silhouettes and absence of roof tearing.
- Exercise rotated facades, true arch apertures, material zones, roof attachments, invalid parameters, independent source dates and failed/resumed batch runs.
- Inspect renders from front, oblique, roof and street cameras. Mesh tests establish geometry health; they do not establish resemblance to photographs.
- Include explicit self-critique in each visual iteration: compare all four views with the approved block and relevant dated evidence, record concrete defects and review criteria, repair shared components, and inspect revised renders independently. Preserve before/revised paths and findings. Passing geometry or browser checks does not establish visual acceptance; unresolved defects remain visible in status.
- Record triangles, draws, texture memory, bytes and build time. Target ordinary buildings below 15,000 triangles, with shared materials; report exceptions. Preserve placement and exclude source-only audit geometry from game exports.
- For the larger run, report built, simplified, retained and failed buildings separately. Every successful record must point to actual files; a 200-row manifest is not 200 finished assets. Measure pilot throughput before forecasting runtime.

The gate targets useful stylized low-poly reconstructions: source-bound footprint and selected facade height, verified owner/physical-plane identity, reviewed resemblance and honest inference for unseen architecture. Full photogrammetric registration of every pane is not required; unregistered proportions remain inferred. Require at least 20 diverse real owners with 12 visually confirmed ordinary buildings, a visible missing-component queue, and actual placement-transform export/render checks before district scaling. Reproduce cached coverage and the next 20 evidence tasks with `python3 scripts/blender/expansion/jordaan_inventory.py`; see `artifacts/jordaan-building-library/summary.json`.

No production deployment is part of this delivery. Local previews and game-compatible assets are the verification surface.


### Owner appearance review scope

Primary-front simplified likeness and whole-owner street appearance are separate review states. An owner can remain a useful candidate after its primary front passes while known evidence-supported side fronts are still blank or omitted. Such owners do not count toward fully reviewed owner coverage; track completed physical fronts and unresolved street-visible surfaces explicitly. Unseen rear inference must not be used to label a photographed street face unknown.
