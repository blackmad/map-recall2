# DeepSeek handoff: one Amsterdam landmark

Copy the prompt below into a fresh coding session with access to this repository. Use a separate checkout/worktree from the active Codex session. This is a comparison of the same quality bar, not a cheaper visual approximation. Muiderpoort is a suggested unmodeled, bounded first trial; confirm its current queue status before starting.

---

You are building **Muiderpoort, Amsterdam**, as an original low-poly landmark for the Canal Recall exploration game. Complete one building only. Do not redesign the renderer, camera, generic city architecture or unrelated landmarks.

The repository is `map-recall2` (the owner's checkout is `/Users/blackmad/Code/map-recall2`). Read the applicable `AGENTS.md` and `docs/landmark-building-recipe.md`, then inspect only the closest relevant implementation. Keep context and tool output short; preserve all quality checks.

## Starting identity

At handoff creation, the destination is:

- Name: Muiderpoort.
- Backlog ID: `lm-extract_landmarks_1639856562`.
- Canonical source/game identity: `extract_landmarks_1639856562`.
- Destination point: latitude `52.36373`, longitude `4.919289`.
- Proposed new model ID: `muiderpoort`.
- Status: pending in `public/canal-drive/landmark-backlog.json`.

Confirm these against the current repository. This is the historic gate, not Muiderpoort railway station. The destination point does not establish the physical footprint, bearing, height or entrance. Resolve those from sources. If another worker has already modeled it, stop and report the overlap rather than replacing their work.

## Quality requirements

1. Recognizable silhouette, source-supported roof/tower/entrance and facade rhythm, in the existing flat-color, texture-free house style.
2. Metre geometry, native scale 1, surveyed placement, exact current OSM/BAG replacement identities. Preserve neighboring buildings and public/open passages.
3. Original geometry; no copied third-party mesh or reference-photo textures. Save primary architectural/heritage references and distinguish measured from approximate details.
4. Preserve the existing genuine destination; ensure a visible map pin/label and a meaningful researched card. Do not manufacture alias destinations or replace an explicitly chosen finish.
5. No invented building-name lettering. Retain a real architectural sign only if it is a defining feature, source-supported and fitted to its actual panel.
6. Geometry must remain finite, roofs face upward and meet supports, windows must lie on the actual wall and be exposed, and open-space rays must remain unobstructed.
7. Existing output limits: fewer than 40,000 triangles, fewer than 500,000 GLB bytes, no textures. Do not relax limits or weaken tests.
8. Acceptance requires reference/render comparison, gallery inspection, live-game placement/neighbor checks and a real physical click opening the canonical sourced card. Compilation alone is insufficient.

## Implementation and ownership

Work on your isolated branch. Suggested new sources:

```text
scripts/landmarks/muiderpoort-builder.ts
scripts/landmarks/muiderpoort-spec.json
scripts/landmarks/muiderpoort-footprints.json
scripts/landmarks/muiderpoort-poi.json
scripts/check-muiderpoort-geometry.ts
scripts/landmarks/review-muiderpoort.mjs
```

Use `BuildingTools` from `scripts/landmarks/cultural-builders.ts`, the common generator palette and `scripts/landmarks/house-geometry.ts`. Start with a nearby gate/church builder for conventions; use a recent dedicated builder such as Faralda for the source/spec/check pattern. Do not read every landmark builder.

On the isolated branch, add the spec to `src/canalRecall/landmarks/manualCatalogue.json`, wire the dedicated builder in `scripts/landmarks/build-manual-landmarks.ts`, and supplement meaningful facts in `src/canalRecall/game/manual-poi-data.json` only as needed. Preserve existing descriptions and canonical identity. Read the builder export signature; do not guess the argument order.

If you only have the shared active checkout, restrict edits to new owned files and request coordinator integration. Do not race on the catalogue, dispatcher, generated manifests/bundles or git index.

## Build and check

```sh
node --import tsx scripts/landmarks/build-manual-landmarks.ts --only muiderpoort
npm run build:canal-signature-landmarks
npm run build:canal-route-selection
npm run build:canal-game-landmarks
node --import tsx scripts/check-muiderpoort-geometry.ts
node --import tsx scripts/landmarks/check-manual-landmarks.ts
node --import tsx scripts/check-manual-poi-contract.ts
npm run lint
```

Follow existing local preview instructions; do not assume the active Codex session's port. Local gallery path: `/canal-drive/manual-landmarks.html?only=muiderpoort`. Local game path: `/canal-drive/`. Adapt one current permanent review harness, such as `scripts/landmarks/review-faralda.mjs`, for actual canonical route/pin/card, exact native placement and drawn neighboring geometry. Wait for local streamed building residency and compare generic/native hit depth when choosing a physical click target.

Inspect the principal and opposite views against the source references. Save screenshots and review findings. Correct observed failures; do not mark a pass merely because the test process exited successfully. Do not publish, push or merge this experiment; deliver the branch/diff for review.

## Return a short handoff

- Owned files and integration changes.
- Primary reference URLs, exact source identities and height/placement uncertainty.
- Exported triangle count, bytes and native bounds.
- Commands/checks run and their results.
- Gallery/live screenshot paths and actual destination/pin/physical-card evidence.
- Any unresolved visual defect or blocked source question.
- Start/end times and actual token usage if your tooling exposes it; otherwise state that usage is unavailable rather than inventing a figure.

Stop after this building. Leave the next building to a fresh session with a short handoff.
