# Colour and material demo — 100-building execution plan

Updated 2026-09-26. Owner asks for a demo or accurate updated plan by morning;
no routine owner visual-review gate. Scope is wall colour and material appearance.

## Result of this batch

A working opt-in demo is at `/canal-drive/material-demo.html`; the checked
visual report is at `/canal-drive/material-report.html`. The existing local
server on port 5195 serves both. No default game appearance was changed.

- All 100 owners have source-bound colour/material assessments across 12 streets.
  Eleven source material assignments remain unknown. This is not 100 accurate
  rendered matches.
- Thirteen reusable procedural presets (including a pale-cream colour variant), a fixed block gallery and neutral diffuse
  lighting are implemented. The actual-game trial contains nine material
  substitutions and one deliberately withheld unknown among ten reviewed cases.
- Independent identity-bound visual review accepts **six broad material families**:
  cohort indices 0, 3, 4, 11, 30, 64. It leaves **four unresolved**: 1 (too narrow /
  overexposed reference), 10 (unknown material), 15 and 17 (occlusion). Exact
  material colour and texture dimensions are not accepted by these verdicts.
- Da Costakade 13 now reads as restrained red-brown brick in the opt-in trial,
  rather than charcoal. Its source/identity/front/oblique evidence is in the report;
  remaining geometry/window differences are explicitly outside this validation.
- Pass 1 was rejected for coarse courses, overly orange brick and texture on roof
  caps. The shared presets, sprite scale and plain caps were corrected. A further
  shared cream correction was re-rendered for both affected gate buildings.
- Reviewer disagreement on index 11 was resolved through an independent native
  reference and identity-cropped render comparison. Earlier rejections remain in
  the audit history. A whole-scene contact sheet alone is not reliable enough.
- The full `check:canal` gate, library checks, TypeScript lint and four
  desktop/phone demo/report browser checks pass. Report
  generation verifies all source, review and capture hash bindings before copying
  local evidence. The photographs and generated capture PNGs remain local.

## Acceptance before expansion

The previous 372 accepted photo colours are source review, not proof of good
rendered appearance. Da Costakade 13 failed visually despite passing data checks.
Do not inverse-fit one material colour independently to each camera's shading.

1. Keep the reproducible 100-owner cohort in
   `review-data/wall-colour/visual-loop/cohort.json`, including Da Costakade 13.
2. Identify the correct exposed wall in each reference. Record material family,
   visible course pattern, colour family, uncertainty and occlusion. Texture
   is an explicit rendering approximation, never a recovered exact surface.
3. Build a small shared, deterministic material library. Validate colour,
   mortar contrast, world scale, minification and a shared lighting response on
   a fixed test block. No per-owner compensation for camera lighting.
4. Apply it to ten varied owners through an opt-in actual-game demo. Compare
   source, current game and material preview at frontal and oblique cameras.
   An independent reviewer must check identity, colour family, brightness,
   visible texture plausibility and consistency between views.
5. Expand to 100 only after the ten-case renderer gate. Preserve explicit
   unresolved cases. A complete assignment pass is not 100 accurate matches.
6. Keep before/after captures and hashed source bindings, publish a browsable
   evidence report and record accepted/revise/unresolved counts. Only visually
   accepted assignments are eligible for default game publication.

## Evidence already available

- 100 unique owners across 12 streets selected reproducibly from existing
  photo-reviewed observations; source crop hashes and camera geometry retained.
- Source material assessment is underway with independent cross-review. It
  already caught unsupported painted-brick/course claims on smooth grey walls.
- Baseline game capture harness exists; a first run captured 24 owners then
  stopped on a map readiness timeout. This is incomplete, not a passing batch.
- A single cheap-model pilot (`deepseek-v4-flash-vision-exp`, via OpenCode) on
  ten references took 11.25 seconds. CLI reported cost 0.00247575, currency
  unverified. One apparent target-wall identity error and shadow sensitivity
  prevent treating this as proven scalable accuracy. No CV model trained.
- Prior `FACADE_BANDS_REPORT.md` shows raw base-to-wall colour distance fails to
  distinguish material changes. Do not reuse that failed statistic. Ground-floor
  materials require direct visible evidence; obscured bases stay unknown.

## Rendering constraints

Use the existing building geometry. Avoid coplanar duplicate wall meshes.
Prototype material patterns on the same MapLibre extrusion geometry; if the
pattern scale or lighting cannot be made coherent, keep the preview isolated
and document the renderer limitation rather than ship misleading textures.
Keep photographed colour, inferred material and rendered material separate.
Use an explicit opt-in demo until the visual gate passes. Roofs, gables,
windows, geometry reconstruction and new image collection are out of scope.

## Next work, in order

1. Resolve the four trial cases with source-facing, unobstructed views. Capture
   exact owner masks and focused crops in **both** angles. If context remains
   occluded, use a clearly labelled isolated-wall diagnostic with the identical
   geometry/material/light, while preserving the real-game view as separate evidence.
   Do not replace a failed case with an easier building to improve the score.
2. Establish a stricter colour criterion from multiple visible source wall regions
   and target-only rendered distributions. Separate photo illumination uncertainty
   from material-family agreement. The current six broad-family passes are not
   evidence that exact colour is solved.
3. Check course scale and temporal stability across zoom 18–20. Current MapLibre
   sprite patterns use pixel/tile coordinates, not guaranteed metric wall UVs.
   If scale cannot remain coherent, prototype the existing metric Three material
   shader on a batched replacement of the **same** LoD1 walls, with atomic
   suppression of original walls. This is a bounded renderer experiment, not
   a new facade/roof reconstruction programme.
4. Once the ten-case gate genuinely passes, capture and independently review the
   other 90 using the same owner-mask and focused-crop workflow. Keep the eleven
   source-unknown assignments withheld until evidence resolves them. Publish
   precise counts and per-case reasons, never substitute `assigned` for `matched`.
5. Evaluate the cheap vision model against the corrected material/identity labels;
   measure held-out errors, abstentions and cost before scaling citywide. No model
   training is justified by the current small pilot.

## Reproduction

- `npm run review:wall-materials:build` validates the 100 assessments and writes
  the opt-in assignment manifest; `npm run build:wall-material-demo` builds the UI.
- `npm run review:wall-materials:capture -- --run=<new-run>` records current,
  material front/oblique and magenta identity images in `.cache/wall-material-demo`.
- `npm run review:wall-materials:focus -- <new-run>` produces exact target crops
  and diagnostic visible-pixel statistics without changing screenshot colours.
- Independent agents inspect source/native/identity/focused images and commit
  source- and capture-bound verdicts. Material revisions require new captures.
- `npm run review:wall-materials:report` reproduces this checked batch report from
  committed reviews plus local evidence. Its explicit pass list must be updated
  when integrating a new reviewed iteration, preserving earlier verdicts.
- `PW_PORT=4392 npx playwright test tests/e2e/wall-material-demo.spec.ts` checks
  demo isolation, exclusive wall rendering, switching and the local evidence page.


## Follow-up: the dark cream wall

See [colour diagnosis](wall-material-colour-diagnosis.md). The live demo now has
an **Isolate selected owner** control and source-bound pale-cream colour trial
for entry 17. Isolation preserves the camera and lighting, hides neighbouring
extrusions and study details, survives panning, and restores normal residency.
Unresolved/non-trial owners remain excluded from experimental geometry.

Capture `--isolated=true` writes a separate diagnostic run; both angles receive
identity masks and focused RGB statistics. Ordinary contextual evidence remains
separate. The saved ten-case report still reflects its original reviewed runs;
its link identifies the newer live colour trial without silently replacing history.

The pale-cream variant improves hue/brightness direction for entry 17 under the
same shared lighting. Entry 11 retains the warmer cream variant. Both independent
reviews support this direction, not exact colour or texture acceptance. Remaining
work is stricter source-region colour evaluation and texture scale/stability before
expansion to the other 90 owners.
