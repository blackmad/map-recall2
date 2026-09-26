District comparison feedback is served by `districtNotesRouter` in `server.ts`.

Open `/canal-drive/district-evaluation.html#packet-heading`. Notes autosave to `.cache/city-appearance/review-notes/<releaseId>.json`. Browser storage retains only unsaved drafts; the UI distinguishes them from project saves. The download includes any unsaved drafts as a separate field.

Each disk document pins the comparison packet hash and stores per-case revisioned notes. Conflicting tab writes and changed source packets are rejected. `Ready for fixes` flushes pending saves and sets `readyForFixes` on the same atomic document. Subsequent edits clear that flag.

The document's `regressionCases` contains exact source/building/crop identities, source images, render captures, and user comments. These are development inputs awaiting agent triage; natural-language notes do not manufacture quantitative reference annotations or passing tests. Read the notes, verify the described source evidence, then implement explicit architectural assertions and repairs. `excludedEvaluationBuildingIds` records reviewed buildings to exclude from future untouched held-out sets.

Run `npm run test:district-notes` with the local app on port 5195. The test uses a separate temporary notes directory and leaves real user feedback untouched.
