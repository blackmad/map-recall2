**Roof plane experiment — 19 September 2026**

Implemented review link:
http://localhost:5195/canal-drive/reconstruction-workbench.html?case=case-20&focus=roof&candidateVariant=roof-planes&comparisonMode=source-aligned&overlayOpacity=50

Select **Baseline** or **Roof planes experiment**. **Source aligned** uses an
orthographic crop-coordinate projection with the photograph in the same frame;
the photo slider runs from model-only (0%) to photo-only (100%). **Model view**
uses illustrative perspective; the full viewer also exposes an oblique camera.
The experiment is available for case 20's Roofs and Full façade views.
Experimental notes are read-only because their geometry has no separate review
packet identity yet. Returning to Baseline restores ordinary feedback and saves.

Case 20 (De Clercqstraat 74) is the first development case. Its existing
source-shape preview maps image pixels affinely onto a synthetic wall. The
photographed dormer outline therefore becomes a flat, skewed wall cutout;
the rectangular dormer opening does not establish a separate roof plane.

The cached evidence manifest supplies a façade sampling plane and camera pose
for this crop (`0363100012096164_e_1qqj2dv`). Its acquisition path calls
`rectifyFacade` with `AMSTERDAM_WORLD_ALIGNED` in
`scripts/da-costa-block/prepare-neighbourhood.ts`. Thus another global wall
rectification is not the presumed fix: roof and dormer surfaces are off that
sampling plane. The full panorama is already cached as
`.cache/city-appearance/shared-panoramas/TMX7316010203-002928_pano_0015_000072.jpg`.
The full-source pose has a track-unsolved vertical datum and about 31.86°
obliquity. Those remain candidate camera parameters, not certified calibration.

This experiment separates the wall, main roof and projecting dormer into
explicit components. Straight edges and provisional depth are modelling
assumptions, not recovered measurements. Keep the original candidate selectable.
The comparison uses the source crop's coordinate frame; this is not a calibrated
render from the original panorama camera. An overlay can reveal differences,
but agreement with the same outline used to construct a candidate is not an
independent accuracy score.

Implementation ownership: Sol owns geometry and renderer integration; Luna owns
comparison controls and browser regression checks; Astra owns scope, integration,
acceptance and the next experiment. No paid inference is part of this baseline.

Acceptance for this slice:

1. The experiment is bound to case 20's full-source hash, dimensions and date.
   Other cases and stale sources cannot silently receive its geometry.
2. Façade, roof and dormer faces are separate and finite. Provisional assumptions
   are visible. The previous flattened roof is not rendered underneath the new
   roof as a second candidate.
3. Baseline and experiment can be compared with the photograph in the same
   source-coordinate framing. Resizing and roof/full focus preserve alignment.
4. Original case data and active release remain byte-for-byte unchanged.
   Lower-wall patches, doors and existing repairs remain intact; case 27 retains
   its ground-floor door meshes.
5. Experimental geometry cannot be accepted through notes bound only to the
   baseline data hash. Existing baseline notes, save/next and keyboard flow
   continue to work. Tests use temporary review stores.

Next evidence step: locate independent façade/roof anchors and another real
camera position for case 20. Use the existing Amsterdam panorama projection
convention and registration machinery; do not apply vehicle orientation again
to geographically aligned imagery. A wall-plane transform cannot rectify a
projecting dormer or a pitched roof. Keep camera/datum uncertainty explicit.

After this baseline, compare a geometry-estimation model against it on several
frozen examples, including case 22 and a façade/entrance control. TRELLIS.2 is a
candidate mesh generator; MoGe estimates single-image geometry, and multiview
methods can use independently positioned photographs. Multiple crops from one
panorama are not independent depth observations. Evaluate held-out image anchors,
silhouette/component placement, preserved openings, model complexity, compute
cost and human review time separately. Do not score hidden surfaces as observed.

References for the later model experiment:

- https://github.com/microsoft/TRELLIS.2
- https://github.com/visualbruno/ComfyUI-Trellis2
- https://github.com/microsoft/MoGe
- https://github.com/GAP-LAB-CUHK-SZ/ReconViaGen

The learned-model comparison and measured camera/depth recovery are follow-up
work; this development preview does not activate a city release.

Verification completed: `npm run test:roof-plane-experiment` (geometry invariants,
unchanged door triangles, real-browser image blending and eave projection,
workbench interaction at 1440×900, 1366×768 and 390×844), `npm run lint`,
preview-note retry/conflict checks, and existing source/entrance correction
checks. Browser tests use isolated feedback stores. Case data and the active
release pointer remain byte-identical. The embedded viewer's source-tier hiding
selector was narrowed to buttons so it cannot hide the candidate canvas.
