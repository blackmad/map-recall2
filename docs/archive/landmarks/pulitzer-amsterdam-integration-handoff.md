# Pulitzer Amsterdam integration handoff

Authored geometry preflight passed on 2026-10-06. **Visual/game acceptance remains pending.** This worker owns only this handoff and `scripts/landmarks/pulitzer-amsterdam-review.json`; root owns catalogue/dispatcher, export/bundles, GPU reviews and commits.

## Identity, placement and source pack

Wire `buildPulitzerAmsterdam(width, depth, BuildingTools)` from the dedicated builder. The first two arguments are deliberately ignored: this is a native surveyed model. Use the supplied spec, footprints and POI records; do not fit the mesh to its descriptive footprint.

Preserve the genuine hotel identity `osm-node-331630133` / `n331630133`, Wikidata `Q4500456`. Cached `files/osm-pulitzer.json` confirms the hotel node, Prinsengracht 323 and operator website. At this preflight neither the installed landmarks extract nor generated POI backlog contains this identity/name: root must complete actual destination integration, rather than assume it already selects. Secondary Pulitzer address node `2721939538`, Pulitzer's Bar and house aliases must not become duplicate hotel destinations.

The supplied entrance is **[lat 52.37282921590418, lon 4.883288222258304]**, derived from the surveyed Prinsengracht 323 front edge. The valid address/VBO record `0363010012106317` links to current Pand `0363100012169022`; Keizersgracht 234 shares that VBO, Keizersgracht 236 uses `0363010012106318` in the same Pand, and Reestraat 8 uses `0363010012106319` in Pand `0363100012169021`. Other fuzzy retired-address results include unrelated Amsterdam/Hilversum buildings and were rejected. Reachability of the entrance remains untested.

Native anchor **[lon 4.8839, lat 52.3727]**, RD `[120724.9867925103, 487321.664408206]`; east/south metres, Y up. `northOffsetDegrees=-0.398848` yields runtime model bearing `89.601152°`, scale **1**; descriptive front bearing is `266.4°`. Runtime altitude is **0**: the recorded survey datum `0.438m` has already been subtracted from authored heights.

Private source pack: `blackmad/map-recall2-source-data`, `models/pulitzer-amsterdam`, parent-reported pushed commits `a6921b9` / `e017b23`. All **165 raw originals** locally matched manifest SHA-256; **24 RCE page bodies** are cached. This worker did not audit Git/remote state. Root must replace the pending source-commit placeholder in public footprints metadata with the final relevant full source commit before the model commit.

## Exact replacement and retained context

Suppress only `NL.IMBAG.Pand.0363100012169022` and `NL.IMBAG.Pand.0363100012169021`, with `spatialSuppression=false`. Both exist in installed tile `public/data/extracts/amsterdam/building-tiles/14/8414/5384.geojson.gz`. Suppression must cover ordinary shells and independent pyramidal roofs after successful model load, restoring both on disabled/unavailable replacement.

The following retained identities all exist in that tile. Address context comes from cached OSM address points contained in cached official BAG geometry; it is corroboration, not an invented official VBO-parent relationship.

| Pand suffix (all prefixed `NL.IMBAG.Pand.`) | Mapped context | Review role |
| --- | --- | --- |
| 0363100012174140 | Prinsengracht 311A–H | North-west side neighbor |
| 0363100012169365 | Keizersgracht 220 / Moeder Godskerk | North-east side neighbor |
| 0363100012173672 | Prinsengracht 333 | South-west corner neighbor |
| 0363100012173673 | Reestraat 28/30 | Southern row at compound rear |
| 0363100012173677 | Reestraat 26 | Southern row at compound rear |
| 0363100012173676 | Reestraat 24 | Southern row at compound rear |
| 0363100012173675 | Reestraat 22 | Southern row at compound rear |
| 0363100012173681 | Reestraat 18 | Southern retained row |
| 0363100012173680 | Reestraat 16 | Southern row at compound rear |
| 0363100012173679 | Reestraat 14 | Southern retained row |
| 0363100012173678 | Reestraat 12 | Southern retained row |
| 0363100012173682 | Reestraat 10 | West neighbor of modeled Reestraat 8 |

**Review harness coverage gap:** the refreshed `review-pulitzer-amsterdam.mjs` checks all twelve neighbors. Installed boundary screening found six more retained Panden (3673/3675/3676/3677/3678/3679) within one approximate metre of replacement boundaries. Extend root evidence to these. A resident chunk flag plus `hidden=false` does not prove that geometry and roofs actually draw; inspect live screenshots after local residency stabilizes.

## Passed checks and limits

`node --import tsx scripts/check-pulitzer-amsterdam-geometry.ts` passed: **39,050 triangles**, 172 roof regions, zero downward/numerical roof faces, **8,430 fractional street-pane samples** without failures, four open court probes, maximum original plane-fit residual **1.59mm**. Bounds are approximately `90.62 × 21.69 × 79.55m`; minimum Y is `-0.005m`. Only **950 triangles** remain below the unchanged 40,000 limit. Current decoded GLB is 490,536 bytes, zero textures.

Preserve `pulitzer-amsterdam-geometry-failed-before-porch.json`: prior Jansz lower glazing hit the parent shell and minimum Y was `-0.72776m`. Current source data retains the anomalous original roof plane. Court glazing is outside the pane sample set; opaque door leaves are skipped; one ray per court does not validate every edge. Double-sided ray checks and authored winding do not certify the compressed mesh. There is no dedicated interior support residual check: inspect exported roof-to-wall attachment and quantized winding separately.

Source quality limits remain material:

- 3DBAG has `qualityindicator=false`, LoD2 validity **102**. A small plane-fit residual proves numerical fit, not survey validity.
- Roof surface **914**, Pand 9022, covers **3.0763m²**. Its original plane `[1.0264678,-2.905139,-82.87761]` falls below the pavement datum. The authored **3.65m horizontal return** is an explicit approximate reconstruction, not a measured roof. Its reported `sourceResidual=0.0006` belongs to the original fit. Review this return in context without transferring that height to other parts.
- Four courtyard voids follow source ground holes and the operator 2024 garden plan; three are absent from the broad current BAG hole representation. Do not replace them with a parcel slab.
- The bounded Prinsengracht 323 Beeldbank search returned a cached HTTP viewer/search shell. No municipal archival image or permit sheet was inspected. 2016 entrance/section and connector-roof sheets remain useful unacquired evidence; no dossier ID or drawing certainty is claimed.
- Reestraat 4 has no dedicated source photo; its context/register/survey approximation remains explicit. Facade heights, lower panes, stairs, ornament and court window spacing are photo-guided abstractions.

The inspected principal operator photo supports the black narrow modern entrance, contrasting loading-window warehouses, pale aperture-bearing bases and mixed crowns. Saxenburg's inspected photo supports its four-bay sandstone facade, raised central entrance and decorated attic; RCE 3567 separately records the triglyph cornice, consoles, attic and stoep. The Reestraat 8 photo supports the clock crown and shopfront. Trees, cars and boats occlude lower details; root must not infer complete basement apertures from fragments. Current-photo qualification for reconstructed Prinsengracht 327/331 fronts is recorded in the assertions and needs comparison during review. No building-name lettering is authored.

## Root acceptance sequence

1. Integrate genuine destination/card once, register dedicated builder/spec, export the GLB and fingerprints, and rebuild signature, route-selection and game-landmark bundles. Run encoded asset checks, POI contract and TypeScript checks; retain `<40,000` triangles, `<500,000` bytes, zero textures.
2. Inspect the default native gallery and four lower rotations against private `operator-current-front.jpg`, `operator-current-context.jpg`, `keizer-current-row2019.jpg`, `keizersgracht224-facade.jpg` and Reestraat photos. Include close pavement-to-crown and entrance comparisons, Saxenburg attic, Jansz corner, surface 914, full court limits and exposed side/court panes. Use an independent failure-seeking reviewer; retain failed comparisons.
3. Acquire Prinsengracht, Keizersgracht, Reestraat and courtyard-context live views, checking native alignment, exact loaded suppression and all retained identities above. Verify disabled/load-failure fallback and independent roofs. The supplied harness acquires views but does not certify destination, card, performance or photo comparison.
4. Actually choose Pulitzer, start and finish its route, verify the entrance pin/label under street-name filtering, and physically click the building to select its meaningful sourced card. Do not call the card display function as a substitute. If routing fails, preserve the explicit destination and home/GPS origin with a clear failure.
5. Record actual stationary-rider camera pans away from the rider on desktop and touch, with surrounding windows/doors visible. Compare the same camera/residency with a baseline; save current asset fingerprint, frame-time median/p95/max, draw calls, rendered triangles and streaming state. A frozen debug camera screenshot is not gameplay/performance evidence. Complete route-start smoke before push.

Update queue/backlogs only after integration changes coverage, and mark visual verification only after the gallery/live/reference, independent review and gameplay checks succeed.


## Current release readiness refresh (2026-10-06)

Current public GLB SHA-256 is `5008f2492175edaba607ec2e0f71bfdd3169fabf9c941e56f8631f5c84dca80b`, **39,050 decoded triangles, 490,536 bytes, zero textures**. The refreshed authored geometry report matches its triangle count and passes **8,430 street-pane samples**, **150 source-column samples**, **6 source-doorway samples** and all four court probes. No geometry was changed during this readiness pass. The old repair-gallery fingerprint `979f6a974946be5f…` differs: do not transfer those gallery views to this current mesh.

Exact-current decoded CPU views are `artifacts/pulitzer-release-readiness-20261006/pulitzer-amsterdam-cpu-prinsengracht.png` and `pulitzer-amsterdam-cpu-keizersgracht.png`. The current mixed facade widths/crown families, paired black upper-window columns and source-specific Keizersgracht 234 entry survive these isolated views. CPU shading cannot accept compressed winding, roof attachment, detailed lower tiers, gardens, native neighbors or actual game behavior.

Source-facing cameras are now persisted in `footprints.referencePack.nativeReviewCameras`: seven principal fronts each have street-normal/full-height and lower-tier camera stations; four court probes have overhead camera centers; roof surface 914 has a close target. Coordinates are native model XYZ metres (RD east/Y-up/RD south). Apply surveyed bearing/anchor for game views. Courts 1/3/4 remain source-open, but no unsupported uniform window pattern was added. Court 2 currently has approximate historic joinery; current operator garden photos show broad black conservatory glazing and white walls, while their exact mapped court association remains unresolved. Root must judge those assemblies rather than treating four clear rays as facade acceptance.

Cached originals used in this refresh are under `/tmp/map-recall2-source-publish-20261006c/models/pulitzer-amsterdam/files/`: `monumentenstad-current-entrance.jpg`, `operator-current-front.jpg`, `operator-current-context.jpg`, `keizer234-verified-facade.jpg`, `operator-court-pulitzer-garden-17.jpg`, `operator-court-260623_garden025_web.jpg`. Existing RCE description assertions, current BAG/survey geometry and operator 2024 plan remain source evidence. No new remote source discovery, permit drawing inspection or raw acquisition occurred.

The acquisition manifest audit finds **165 matching SHA-256 originals and zero changed-byte mismatches**, plus **15 absent listed paths** recorded in review metadata. These include superseded unverified `keizersgracht*-facade`/page names and object354–356 attempts; verified `keizer*-verified` sources are present. Their original absence must stay explicit, and source publisher must reconcile rather than invent archival completeness. Scope-sync the refreshed footprints, geometry/review and handoff before the model commit, then set the actual private source commit/path. Root owns formal public-entrance override, shared integration, GPU review, Git and export.
