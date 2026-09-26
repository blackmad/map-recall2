# Independent visual audit

Date: 2026-09-19

This audit is based on direct inspection of the source photographs and the saved facade-repair preview captures. Existing `roofReview`/"reviewed" labels were treated as metadata, not as acceptance evidence.

## Source-first observations

### Case 24 — Da Costakade 113 (the screenshot reported by the user)

Source full crop (`d41fb...jpg`, 213 x 721, 2023-01-10) has a strongly visible frontal triangular gable. The roofline rises from both side eaves to a centered apex, with a small rounded/arched opening at the apex and a tall narrow rectangular upper window below it. The two next-level openings are rectangular glazed windows under shallow brick arches; the arches are masonry decoration, not rounded window geometry. The lower two floors have paired rectangular windows, with different curtains/frames and brick arch details. The candidate panel in the saved capture has a rectangular wall top, a detached small rectangular top window, and repeated rounded-head windows. It omits the triangular gable silhouette and misreads the window heads. This is a critical visible failure, independent of hidden roof depth.

The source also shows that the upper gable is the main identity cue. A candidate can be useful for placement experiments only after its 2D silhouette and opening geometry agree at source-pixel scale. The current case is explicitly marked “roof outline not yet reviewed”, which is consistent with the visual evidence; it should not have been presented as a good reconstruction.

### Case 20 — De Clercqstraat 74

Source full crop (`c85f...jpg`, 283 x 811, 2023-01-12) shows a dark masonry facade with three vertical window bays, balconies on the center bay, a pitched roof/eave, and a centered dormer. The dormer has a pitched triangular cap and a broad front opening; its roof/eave and the main roof are visibly distinct. The source-shape candidate in the saved capture does preserve a small dormer-like polygon and three bays, but its body is a flat vertical slab with generic repeated windows. It does not visually establish the main roof plane/eave or the balcony projections. The candidate is therefore a shape study, not a faithful facade reconstruction. The prior city screenshot is a neighboring-block view and is not evidence for this building’s identity.

### Case 22 — Da Costakade 118

Source full crop (`af27...jpg`) has a centered stepped gable, with several clear horizontal setbacks, a narrow upper window, a central balcony stack, and asymmetrical side bays. The saved source-shape candidate does reproduce the stepped outer silhouette reasonably well and has a plausible upper window placement. It still simplifies the balcony/door/window arrangements substantially, and the previous 3D screenshot exposes unrelated massing and perspective. This is the strongest of the inspected roof-shape candidates, but only for the frontal outline; it does not validate metric placement or depth.

### Case 25 — Rozengracht 249 (additional roof case)

Source full crop (`7fdc...jpg`) is a broad, nearly flat-roofed brick block with four repeated upper window bands and a low parapet. A generic pitched roof or gable prior would be visibly wrong here. This case is useful as a negative control: the review system must be able to say “flat/parapet visible” and avoid inventing a roof silhouette. The saved city render is too oblique and generic to judge the source facade.

## Direction assessment

The current path is mixing three different products: source-pixel shape tracing, a synthetic source-space roof-plane experiment, and a metric/placed 3D building preview. The first can be made useful quickly; the second can test bounded geometric hypotheses; the third is not currently validated by the photographs. A green software check or a preserved 3DBAG roof surface does not imply visible architectural agreement.

The candidate previews are hand-coded 2D/near-2D diagrams with repeated generic windows. They are useful as an annotation/debug surface only if they are held to source-pixel acceptance checks: roofline silhouette, opening count/shape/row positions, and major balcony/door masses. They should not be used as evidence that a 3D reconstruction is correct. Parametric geometry becomes worthwhile after the frontal source-space trace is correct and the camera/wall correspondence is independently solved; otherwise it makes an incorrect silhouette look more authoritative.

## Recommended priority

1. Establish a source-space review artifact per case: source image, traced visible outer silhouette, and traced opening boxes/polygons. Include explicit `unknown/cropped/occluded` regions.
2. Fix case 24 first. The missing triangular gable and incorrect rounded windows are obvious and high impact.
3. Rebuild case 20’s roof/dormer as separate visible surfaces only after retaining the complete pitched outline; keep depth/pitch provisional.
4. Use case 22 to validate stepped-gable tracing and case 25 as the flat-parapet negative control.
5. Keep architecture-composite/metric placement disabled until source-shape overlays pass a blind visual audit. Record “shape agreement” separately from “3D placement solved”.

No source data, release, or review labels were mutated by this audit.

## Case 24 correction pass: before/after verdict

Reviewed `.cache/source-geometry-review/case24-facade.png` and `case24-roof.png` against the original `d41fb...jpg` source.

The correction is materially better at the top: it now has a recognizable triangular gable, centered rounded attic opening, tall upper window, and two rectangular windows below. The roof crop is internally consistent with that visible silhouette. This resolves the most obvious prior failure: the candidate no longer presents a flat rectangular top.

The whole case is still not accepted. Remaining visible blockers are:

- The lower door patches overlap the lowest window row. In the source, the lowest windows end above the masonry/ground-floor transition; the two doors and the central shop glazing begin below that boundary.
- The central shop window/glass is absent from the candidate, leaving a large pale blank rectangle between the doors. The source has a broad glazed storefront with dark interior, mullions, and display details.
- The repeated pale arched lintels are much too large and light. In the source these are relatively subtle brick arches integrated into the red masonry; the candidate reads as thick cream stone caps and changes the facade material hierarchy.
- The lower window proportions and frame/curtain details remain generic. The source has distinct sash arrangements and visible curtains in each level.

Before/after result: **roof silhouette improved; case-level facade fidelity still fails.** The next correction should establish a non-overlapping vertical facade segmentation (upper windows, lowest windows, masonry sill/transition, then doors and central shop glass) before tuning decorative arch color or texture. Do not mark this case accepted from the improved gable alone.

### Case 24 correction v2

The v2 render (`.cache/source-geometry-review/case24-facade-v2.png` and `case24-roof-v2.png`) is a clear bounded improvement over v1. Door patches no longer cover the lowest window row, the central dark shop glazing is present, and the added upper transom makes the top window rhythm closer to the source. The triangular gable and attic opening remain legible and correctly placed as a source-space hypothesis.

Remaining visible differences are still material: the source has prominent but brick-colored curved arches above the paired windows, while v2 reduces them to plain rectangular white-framed openings; horizontal masonry ledges and the varied lower sash/curtain details are absent; the two ground doors are generic dark blocks rather than the source’s distinct wood and black doors; and the gable brick ornament/chimney-like rod is simplified. The v2 therefore passes a “bounded source correction improved” check, but remains a source-shape study and does not establish whole-facade fidelity or 3D placement.

### Case 24 window repair after user escalation

The user correctly identified defects the preceding review missed: overly thick
pale surrounds, floating mullions, bars crossing undivided upper lights, and
curtain/reflection edges represented as structural bars. Earlier improvement
was too loosely assessed. A good silhouette did not establish good openings.

Sol added explicit per-feature source-pixel surround/joinery widths and
`mullionScope`; only the seven reviewed full-tier windows and crown receive
these hints. Lower four windows clear both inherited `paired` and `mullions`.
Doors, ground tier and other cases retain their defaults. Root required this
scoping after rejecting a first implementation that altered all source studies.

Root and Luna inspected the final same-viewport roof render at 0%, 50%, and
source-only (Luna) against the original photograph; the facade overlay verifies
the lower-row correction. Evidence: `review-data/visual-audits/2026-09-19-case24-windows/`.
Scoped source-window repair approved: frame thickness, gable window bounds,
transom/lower-mullion connection, upper pair spacing, removal of unsupported
lower bars. Whole facade and metric placement remain unaccepted. Decorative
brick arches, varied glazing/curtains and ground-door detail remain simplified.
The earlier independently framed three-panel screenshot cannot support precise
width/gap comparisons; the embedded overlay is the relevant scale evidence.

Known review-tool defect: workbench left photo uses CSS roof zoom 2 while the
embedded candidate uses source height .42 (~2.38 zoom) and has a toolbar reducing
its viewport. Side-by-side panels therefore are not pixel-matched, even though
the embedded source/model overlay is. Fix shared framing before further
side-by-side placement judgments.
