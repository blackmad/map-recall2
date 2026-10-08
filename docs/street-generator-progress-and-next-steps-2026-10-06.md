# Street generator work: progress and next steps

Recorded 6 October 2026, after the user asked for a written handoff.

## Where this work stands

The work produced useful shared generator capabilities and source-backed previews, but **has not delivered an accepted wider street rollout**. The latest generator changes remain in the working tree. The main commits from these recent checkpoints publish demo pages and generated comparison images, not the complete new generator implementation.

I spent too much time iterating on isolated diagnostic previews and branching into additional facade and roof work before completing gameplay verification and shipping a useful segment. More tests or additional preview cycles do not resolve that delivery gap.

## Shipped checkpoints

| Checkpoint | Commit | What was pushed |
| --- | --- | --- |
| Approved Kesbeke and Beest/Padel work | `71daa5e3` | Approved landmark assets and integration, with private sources pushed first. Detailed remaining game checks stayed tracked. |
| Street generator demo index | `78e426ae` | Jan Evertsenstraat and compound-facade before/after previews, with candidate status and source provenance. |
| Regular canal-front demo | `f1767d9a` | Raised-entry row and door comparisons, including a preserved flat-door failure and explicit outstanding roof failures. |

The demo is `public/canal-drive/street-generator-demos.html`. Its latest pushed regular-front images show cycle 3. Later cornice and surveyed-roof previews are local artifacts; they have not replaced the published comparison. Hosted deployment and browser display were not verified from this session.

Other agents' landmark commits are separate work and should not be counted as progress on this street-generator goal.

## Generator work implemented locally

### Jan Evertsenstraat 124 and 126

The procedural assembly now supports broad paired upper windows, flat and projecting leaves, a continuous metal shop canopy, a glass-block band, recessed residential access, shop/customer glazing, and connected thresholds.

I corrected the actual atlas sampling that introduced pale window strips, stock fanlights and painted floor bands. The preview exporter also used an obsolete canopy-only recipe; it now reads the current production catalogue, preserves native facts and refuses to overwrite recorded evidence directories.

Independent review passes the bounded material repair and the ground-floor relationships. It does **not** accept the whole facade: projecting groups read weakly in the CPU views, and the upper blank masonry and stepped roof differ from the reference. Transfer and actual game/performance checks remain pending. No new rollout identities were added.

Relevant files:

- `src/canalRecall/interwarFrontageLayout.ts`
- `src/canalRecall/interwarGroundFrontage.ts`
- `scripts/jan-evertsen-pilot/procedural-preview.ts`
- `docs/references/jan-evertsen-pilot/material-repair-independent-review.json`
- `artifacts/jan-evertsen-pilot/material-repair-cycle-20261006/`

### Oudezijds Voorburgwal 87–89: compound facade

Implemented a shared assembly with three broad main axes, an independent narrower projecting window/access shaft, connected pale ground surrounds, basement lights, recessed access and a heavy cornice. This is an observed facade arrangement, not a neighborhood-wide style.

The roof work separates surveyed street eaves and roof surfaces from the whole-Pand aggregate height. It corrected measured perimeter joins and removed unwanted glazing strips and door-head patterns. The final primary CPU comparison passes its bounded source review.

The neighboring source challenge rejected wider transfer. Numbers 85 and 99 have regular three-axis fronts and raised left entrances; applying the compound's right shaft and access arrangement would contradict their architecture. Their ordinary fallback rendering also failed the street-row comparison. Those failures remain preserved.

Relevant files:

- `src/canalRecall/compoundFrontageLayout.ts`
- `src/canalRecall/surveyedBuildingEnvelope.ts`
- `src/canalRecall/surveyedEnvelopeMeshBinding.ts`
- `docs/references/compound-source-envelope-independent-review.json`
- `docs/references/compound-transfer-challenge-20261006.json`

### Regular canal fronts: exposed training samples 85 and 99

Implemented a separate shared planner and renderer integration for three aligned axes, explicit shortening upper tiers, tall ground glazing, raised left entrances, separate basement access, stairs and open rails. It preserves native footprints and factual metadata; 85 retains its reported year 1746 and height 16.23 m, while 99 retains an unknown year and height 18.53 m. Its courtyard remains open.

Independent review passes the bounded body and corrected door appearance. Cycle 1 failed because the doors looked like flat patches. Cycle 2 repeated handles in every panel. Cycle 3 adds readable panel relief and one handle per physical leaf. These earlier failures remain archived.

Later local work adds a bracketed cornice and projecting hoist within 99's existing envelope. The bracketed ledge passes the cycle 5 visual review; the hoist was unclear in that review. Cycle 6 changes it to the source's pale finish and supplies views from below. **Those latest images have been generated but were not yet visually reviewed when the user interrupted the work.**

85's official BAG and 3DBAG inputs support a diagnostic roof binding with a street eave around 14.934–15.773 m and a roof crest around 18.088 m. The aggregate height remains 16.23 m. Its photographed shaped/clock crown is still missing: the surveyed triangular roof closure is not a substitute. The official BAG record also carries ongoing investigation flags, which must remain visible in the source review.

99's surveyed envelope was rejected for poor fit quality (RMSE 2.470 m), incompatible footprint proof and a source-year conflict. I did not loosen guards, replace its unknown year, or close its courtyard to make it fit.

Relevant files:

- `src/canalRecall/regularCanalFrontage.ts`
- `src/canalRecall/regularCanalNative.fixture.ts`
- `src/canalRecall/regularCanalNative.test.ts`
- `src/canalRecall/fixtures/regular85SurveyEnvelope.json`
- `scripts/street-appearance/render-regular-canal-preflight.ts`
- `docs/references/regular-canal-front-independent-review.json`
- `docs/references/regular-canal-roof-envelope-review.json`
- `artifacts/regular-canal-front/cycle-6-hoist-lowangle/`

## Runtime infrastructure and verification

Added explicit diagnostic loading of plain surveyed-envelope data through the actual building-worker path. Validation and binding callbacks are created inside the worker; they are not sent through structured clone. Only successfully installed source-owned wall/coarse chunks suppress independent pyramid roofs.

Independent review caught and verified repairs for three defects: false roof ownership after a tiny metadata mismatch, late loads surviving disposal, and suppression below the drawing zoom. There are no default source-envelope admissions.

The last completed full street suite passed **174 tests**, before the latest cornice and 85-envelope additions. Later focused tests passed, including the real 85 transport/fallback case. The full suite and TypeScript check must be rerun after the latest changes settle; the older full-suite result is not a current whole-tree claim.

Normal commit/push hooks passed their desktop route-boot smoke checks. Those checks do not verify these facade changes, stationary-rider camera pans, touch behavior or GPU cost. Direct local diagnostic server/browser attempts encountered sandbox permission failures. No successful game-scene or full-scene GPU evidence was obtained for the new assemblies.

## Sources, scope and unfinished work

Raw municipal panoramas, BAG/API responses and provenance belong in the private repository `blackmad/map-recall2-source-data`, under `streets/oudezijds-east-next-south/` and the existing Jan Evertsenstraat pack. Public demos contain generated project geometry, not raw reference photographs.

Recent pushed private checkpoints include `21434484d4cf7f4b0a28da22b691a615611c586b` for the regular-front work and `c006cfb` for the sample-freeze timing clarification. The latest roof originals, official 85 candidate and roof-review outputs still need a scoped private archive commit/push before publishing another related checkpoint.

95's current source is heavily scaffolded and remains withheld. 103 shares an already exposed original and is not a fresh heldout. 113 has a distinct identity/camera frozen and its photograph remains unviewed. It was selected after the first planner prototype, so the record explicitly corrects the earlier claim that it was frozen before all implementation. It is frozen before the current crown-improvement cycle; do not expose it until training is frozen.

## What comes next

1. **Finish one useful delivery instead of opening another facade family.** Prioritize the existing Jan Evertsenstraat 124/126 pilot for an actual game review and a scoped generator commit. Report completion only for that reviewed scope, not a neighborhood rollout.
2. Get a working permitted game-review context. Capture normal gameplay and desktop/touch pans away from a stationary rider, verify surrounding windows and ground doors, and measure the same-version profile-on/off full-scene GPU cost. Keep source-fit concerns explicit; do not substitute route-boot tests or CPU images.
3. Correct any blocking issues that those captures reveal. Run the fixed Jan transition/heldout challenges before adding identities. If a critical trait fails, keep expansion withheld and preserve its evidence.
4. Archive the settled sources, rerun the relevant current checks, then integrate the **generator code** into an isolated checkout, preserving other agents' changes. Rebuild its bundles, commit and push the reviewed scope. Update the demo to distinguish code shipped from candidate previews.
5. Resume the regular canal-front candidate after that checkpoint: review cycle 6, implement the missing source-supported 85 crown without inventing building heights, freeze training, then challenge the unviewed 113 sample. Retain 99's survey rejection and courtyard.

The authoritative queue remains `public/canal-drive/street-rhythm-work.json`. This document is a handoff and delivery assessment, not an acceptance record or a declaration that the active goal is complete.
