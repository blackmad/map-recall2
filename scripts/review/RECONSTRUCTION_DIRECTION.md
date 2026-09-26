**Reassessment — 19 September 2026**

The objective is a recognisable low-poly city assembled from open data. The
current review tool is useful, but the project has spent too much effort on
viewer mechanics and isolated repairs without proving that the visible building
is correctly described. Stop expanding the case-20 depth hypothesis for now.

Case 24 demonstrates the failure: the photo has a triangular gable, a small
crown detail, a central gable window, and rectangular paired windows below
decorative masonry arches. The stored full-source proposal omits the silhouette
and misplaces/interprets openings. The renderer reproduces those incorrect
features faithfully. Passing overlay or keyboard tests cannot establish visual
fidelity. The source-shape wall uses synthetic pixel units; it is not a recovered
building surface or a metric registration.

The delivery audit also confirms that the game loads release-tile
`owner.geometry.building.surfaces` through `cityAppearanceThree.ts`; the source
silhouette correction only modifies the synthetic study owner. Wall feature
patches are compiled separately in `cityAppearanceFacadeRecipes.ts`. Case 24's
actual source wall is a rectangular quad, so its visible gable needs explicit
geometric treatment after alignment is established. Do not assume that a
correct-looking study has changed the actual city mesh.

Keep these stages distinct:

1. **Observed appearance.** Inspect the exact photograph before inspecting model
   output. Record silhouette, openings and their visible extents, architectural
   category, occlusions and date. Separate masonry arches from window glazing,
   and projecting hoist beams from the roof boundary. Use model proposals as
   starting points. Agent vision performs the first review and correction;
   routine visible defects must not depend on human feedback.
   Follow [the source interpretation rules](FACADE_INTERPRETATION_RULES.md)
   during extraction, refinement and independent component review. For an
   elevated door in a window row, inspect glazing and opaque panels explicitly;
   balcony context triggers review, not automatic conversion to glass. Compare
   the rendered glass-to-panel proportions and frame rhythm against the exact
   source. The preview's `featureSelfReview.upperFloorDoors` flags unresolved
   solid/default treatments; clearing a flag does not certify visual fidelity.
2. **Source comparison.** Compile those observations through a generic correction
   path and compare the new rendering with the photograph at 0%, 50% and 100%
   overlay. Another agent reviews the resulting image. Structural tests protect
   source identity and existing repairs; visible geometry is assessed separately.
   Record remaining failures rather than promoting a whole case to "good" after
   one component improves. Save immutable before/after packets and original notes.
3. **Building placement.** Bind corrected components to existing building/roof
   geometry using camera and wall evidence. The photograph is already sampled
   onto a candidate façade plane; projecting dormers require separate planes.
   Use the available plane as an explicit approximate placement candidate and
   inspect it against another real viewpoint or other geometric evidence. Keep
   surveyed/registered accuracy separate from representational visual quality:
   an uncertain city-preview prototype can be useful without claiming the
   production registered-observation threshold has been met. Do not relabel
   ambiguous source observations as registered to bypass that threshold.
   A synthetic front view is a diagnostic, not delivery to the city.
4. **Runtime delivery.** Carry one representative corrected building through the
   shared compiler to the city viewer and game. Check recognisability at street
   distance and rendering cost, then scale across a small frozen set of roof
   types before processing the neighbourhood.

The first corrective slice uses a reusable source-bound geometry record rather
than another renderer branch for one address. Case 24 is the immediate repair;
case 20 (dormer), case 22 (stepped gable), and an additional gabled case form a
source-first review cohort. This is a development cohort, not held-out accuracy
evidence. The accompanying independent visual audit records what was actually
seen and what remains unresolved.

For unattended work, each attempt needs pinned inputs, a bounded set of component
edits, explicit before/after renders, independent visual criticism, preservation
checks and a stop condition. Start with one proposed correction and at most two
revisions per case; if the critic still cannot resolve the source, leave it
flagged and move on. Do not let renderer success or agreement with a generator's
own inferred outline certify architecture. Today's offline review runner only
diagnoses; it is not a general autonomous visual repair service.

Cost order: reuse cached images and geometry first; use local line/edge and
opening-layout checks to identify inconsistent proposals; use agent vision for
the small uncertain set. A learned depth/multiview reconstruction experiment
comes after this baseline and must improve independent reprojection or visible
component agreement. Replacing simple low-poly components with unconstrained
generated meshes before that test would increase complexity without establishing
fidelity. No additional image-extraction or 3D-generation jobs ran in this slice;
implementation and visual review used this agent session.

Completed in this pass: Sol implemented a generic source-bound correction and
case 24's gable/openings. Luna independently rejected the first full-facade
render, then reviewed a second revision fixing overlapping doors, missing shop
glazing and false pale lintels. Root inspected both revisions and published the
second as an improved source study, not an accepted reconstruction. Terra built
[the actual-mesh comparison](../../public/canal-drive/case24-building-source-comparison.html)
with camera-ray projection and explicit uncertainty. Four photographs were
audited; this pass did not repair all four or the whole neighbourhood.

The new current preview packet is
`bbec57cc35ccc6d536cfb94f63dd5e756b4ff2eb9fb3387cda7bed94bd9bb86c`.
The prior packet `dc9789137abd3179c4c25d3312a0c5957a2998effb4095799c9d3a14da363df1`
and its successor are archived at `public/data/facade-repair-preview/revisions/`.
Original feedback remains bound to the old packet and is shown as previous
feedback. The active city release was not changed. Before-publication review
snapshot: `600c8caf66f6ab18213a101dafd101e9546e9235d75c331fb58ca05c8c95b9f0`.
Final render evidence is retained in
`review-data/visual-audits/2026-09-19-case24/manifest.json`, with source/packet
hashes and separate source-study and real-mesh comparison captures. All other
27 cases, case 24's ground tier, original metric geometry, existing user notes,
spend ledger and active city release were verified unchanged.

Next implementation: use the real-mesh comparison to construct one explicitly
approximate, building-bound gable candidate, then show that candidate through
the shared city renderer at a street viewpoint. Check silhouette and openings
in a second image, preserve the original mesh, and record whether the change
improves recognisability. This is the next end-to-end proof; adding more isolated
source-study features or commissioning a generative mesh is not that proof.

Repeatable checks: `npm run test:source-geometry-review`,
`npm run test:reconstruction-workbench`, and `npm run lint`.
`npm run review:case24-mesh` regenerates the read-only mesh comparison from cached
evidence. It neither changes the city release nor certifies registration.
