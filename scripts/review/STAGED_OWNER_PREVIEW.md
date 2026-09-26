# Staged owner preview workflow

The case 20, 22 and 25 builders create immutable candidates without replacing the accepted local preview packet. For example:

```sh
npx tsx scripts/review/build-case22-gable-candidate.ts
```

The JSON result contains `stagePublicPath`, `stageManifestPath`, their SHA-256 values, the pinned live destination and `expectedLiveSha256`. Capture the returned public stage rather than the live packet:

```sh
SOURCE_TO_OWNER_PACKET='public/canal-drive/data/staged-owner-output/case22/<packet-sha>/packet.json' \
SOURCE_TO_OWNER_AUDIT_ROOT='review-data/visual-audits/<audit-directory>' \
SOURCE_TO_OWNER_AUDIT_OUTPUT='iteration1-staged-candidate' \
node scripts/review/capture-source-to-owner-city-preview.mjs
```

Run `checkReviewArtifactBinding` with the exact capture manifest path and an independently supplied manifest SHA. Preserve its JSON result and SHA. Root and the independent visual reviewer then each write a separate review file:

```json
{
  "kind": "staged-owner-output-review",
  "role": "root",
  "reviewer": "root",
  "decision": "accept",
  "stageManifestSha256": "<stage-manifest-sha>",
  "packetSha256": "<packet-sha>",
  "reviewArtifactBindingSha256": "<binding-receipt-sha>"
}
```

The independent file uses `"role": "independent"` and its own reviewer label. Each disposition applies only to the reviewed component scope; it does not claim that the whole building is complete.

Promotion is an explicit API call:

```ts
await promoteStagedOwnerOutput({
  root: '.',
  stageManifestPath,
  expectedStageManifestSha256,
  expectedLiveSha256,
  reviewArtifactBinding: { path: bindingPath, sha256: bindingSha256 },
  acceptance: {
    root: { path: rootReviewPath, sha256: rootReviewSha256 },
    independent: { path: independentReviewPath, sha256: independentReviewSha256 },
  },
});
```

Promotion reruns artifact binding, verifies immutable and current input bytes, requires the exact expected live SHA under a destination lock, archives the prior live bytes and then atomically replaces only the pinned cohort preview packet. These local byte checks cannot authenticate reviewer identity and do not certify visual fidelity. This workflow never edits `cases.json`, activates `current.json`, or publishes a production release.

The former mutable packet under `review-data/case*-*-city-preview/packet.json` is no longer written by either the builder or promotion. Consumers must use `stagePublicPath` for an attempt or the pinned live public path after promotion; the old review-data path may be stale.
