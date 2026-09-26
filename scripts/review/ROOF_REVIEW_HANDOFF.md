**Roof review focus — 13 September 2026**

Latest 19 September update: case 24's missing gable and misplaced openings have
been corrected in the source study after independent before/after inspection.
The six cases with recorded outlines now include case 24; 22 remain without
outline review (including blocked case 26). Read
[RECONSTRUCTION_DIRECTION.md](RECONSTRUCTION_DIRECTION.md) before expanding the
earlier roof-plane experiment. Original review feedback and prior candidates
are preserved in revision archives.

19 September follow-up: [ROOF_PLANE_EXPERIMENT.md](ROOF_PLANE_EXPERIMENT.md)
documents the implemented case 20 plane-separated hypothesis, source-photo
blend controls, test command and next camera/depth evidence step.

Open `/canal-drive/reconstruction-workbench.html?case=case-20&focus=roof`.
The comparison and editor now lead the page. Roof mode crops the displayed
source to its upper portion and frames the candidate's upper 42%; clicking the
photo opens its complete original image. Full façade and Ground remain available.
The candidate still comes from the existing, hash-bound repair renderer.

The current 28 cases contain five recorded source-outline corrections:
`case-01`, `case-04`, `case-09`, `case-20`, and `case-22`. Cases 01 and 20
include reviewed dormer windows; case 22 retains its stepped-gable correction.
Cases 01, 04 and 09 explicitly record occluded/cropped portions. These are
agent-inspected development corrections, not new human acceptance or certified
3D roof reconstruction. There are 23 outlines without a recorded review;
case 26 also has unresolved identity and no roof geometry, leaving 22 other
unreviewed outlines available for the next photo pass.

Use the **Roof priorities** queue to expose missing source/geometry and
unreviewed outlines before the already-corrected cases. Switching queues
preserves the selected case and notes. The summary separates original 3D roof
surfaces from the photographed frontal outline; roof planes alone do not prove
that the visible gable/dormer matches. Hidden details stay unknown.

Review order:

1. Check cases 20 and 22 against their photographs to confirm that the existing
   dormer and stepped-gable corrections remain useful at street scale.
2. Work through unreviewed outlines: roof shape, eave/gable height and outline,
   dormers, chimneys and roof openings. Record wrong building or unusable source
   before proposing a roof repair. Case 26 needs identity/source resolution.
3. Turn concrete roof feedback into source-bound outline/component corrections
   using `roof-coverage-corrections.ts`, `next-stage-roofs.ts`, and the existing
   silhouette/compiler path. Preserve original 3D surfaces and previous repairs.
4. Carry each correction through both viewers, measure silhouette alignment
   against independent reference points, and keep occluded areas unscored.
   Do not count successful preview compilation as photographic acceptance.

Keyboard flow: the textbox receives focus when a case loads. Tab moves to
**Save & next**, then Enter saves and advances. Ctrl/Cmd+Enter does both;
Ctrl/Cmd+Shift+Enter saves and goes back; Ctrl/Cmd+S saves in place. Escape leaves
the editor, J/K move next/previous outside fields, and N returns to the editor.
Normal arrows, line breaks, Shift+Tab and text editing remain native. Save
failures and revision conflicts retain the current case and local draft.

Roofline/Dormer/Chimney/Not visible buttons append a note starter and set
Needs work. They never replace an existing note. Notes retain the same exact
candidate/source binding; roof mode is a review view, not a new release.

Verification: four roof-summary tests, explicit current-note save tests,
workbench browser checks at 1440×900, 1366×768 and 390×844, above-fold editor
and action checks, roof/full-source focus, case-27 door preservation, saved-note
reload, source identity, priority ordering and save-failure navigation checks.
Browser feedback uses temporary stores. Original preview data, active release
and spend remain unchanged.
