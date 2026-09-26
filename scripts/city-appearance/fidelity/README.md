The current implementation and remaining acceptance blockers are documented in [PIPELINE.md](PIPELINE.md) and [repair-report.json](repair-report.json). Cached replacement cases now have source manifests and independent ground-photo references; the original twelve examples remain outstanding. The remainder of this document records the preceding engineering pass and its preserved-release checks.

This pass implements the renderer and evaluation infrastructure, but does **not** pass the photographic acceptance gates or publish a replacement release. The twelve screenshots and observation identities referenced in the handoff were not attached. Their architectural contents cannot be recovered from the issue captions. `status.json` records the incomplete scope; `baseline.json` pins the preserved release and cost baseline.

Implemented:

- Residential ground-floor recipes reserve a bay for an explicitly procedural entrance, including a transom, instead of replacing the frontage with windows alone.
- `appearanceHeight.ts` defines source/NAP/render conversions. Game façade and sign export now restore the legacy 0.65 m datum offset before subtracting ground NAP. Source wall/roof vertices are not shifted. The designated building/pavement contact checks remain unresolved; no unsupported plinth correction was applied.
- `facadeDescription.ts` stores versioned, dated, crop-hashed upper and ground sources, geometry/frontage/wall bindings, image bounds and field dispositions. Fitting uses an explicit image-to-wall homography, rejects uncertain/skewed projections and stale sources, and preserves human overrides and revocations. Missing fields remain unknown.
- Both viewers use `compileFacadePatches`. Registered features default on. Revoked or unprojectable described frontages cannot silently regenerate a window grid. Legacy records continue using labelled priors.
- Observed openings support curved heads and frames, separate masonry lintels, paired doors, transoms, mullions, reveals and sills. Independent material regions retain colours and contrasting ground finishes. The shared metric brick shader allocates no textures and fades mortar at distance. Retracted awnings produce a shallow roll/housing; absent and unknown states produce no canopy. Literal source-bound fascia text uses the existing sign system. Repeated generic sign candidates are deduplicated per tenant/panorama/date; distinct physical sign IDs allow evidenced repetitions.
- Game export retains doors and major colour regions at intermediate detail. Existing viewport memory accounting includes sign textures. The preserved release passed all fourteen cameras in desktop and phone layouts, at a reported peak of 6.56 MB against the 11 MB ceiling. This does not measure the memory of a richer district release that has not been compiled/published.
- The evaluation page explicitly separates processing coverage from unmeasured reconstruction fidelity. `gates.ts` provides one-to-one opening matching at IoU ≥ 0.7, precision/recall, contact exceptions, and non-vacuous release gates. Rich-description publication requires these gates. No automatic image-similarity score is treated as fidelity.

`unseen-candidates.json` freezes thirty candidate frontages, fifteen per district, excluding earlier comparison packets and the legacy development block. They have not been used for tuning. They cannot yet be certified as unseen because the twelve missing examples might overlap them. Source feature strata and independent annotations are pending; routing categories are not reference annotations. `named-compatibility.json` pins Fuoco Vivo's dated full/ground crops and the recovered Engels Verf panorama and two legacy BAG identities. Its visual notes are **agent-inspected**, not human review or approved fitted geometry.

Verification completed:

```sh
npm run lint
npm run test:facade-fidelity
npm run test:city-appearance-facades
npm run test:machine-signs
npm run test:facade-opening-layout
node scripts/check-city-pipeline.mjs
node --import tsx scripts/check-city-appearance-three-render.mjs
npm run capture:facade-fidelity-fixture
npx playwright test tests/e2e/city-appearance-study-route.spec.ts
```

The synthetic fixture has legacy/observed ground-floor, full-façade and oblique captures in `.cache/city-appearance/fidelity-engineering`. Visual inspection confirmed curved frames, separate opening silhouettes, retracted housing and the contrasting material region. It also caught and fixed coplanar overlapping material regions. These are renderer engineering images, not photographic fidelity evidence. `traversal-captures.json` pins copies of the 28 preserved-release game captures. The source renderer smoke test covers desktop/phone rendering, disposal and rehydration; the new geometry tests cover default observed rendering, deterministic compilation, human precedence and revocation without prior resurrection.

The richer extractor extends the existing routing workflow and reuses its atomic global budget journal:

```sh
npm run extract:facade-details -- --manifest=PATH
# Add --run only for a resolved, frozen source manifest.
```

The manifest is `{version:1, releaseId, phase, cases}`. Each case contains `id`, `buildingId`, `geometryRevision`, `evidenceKey`, `frontage`, `surfaceIndices`, and independent `sources.full`/`sources.ground` entries with `path` (relative to the manifest), `cropSha256`, `captureDate`, and `registration`. Registration has `status`, `surfaceIndex`, `uncertaintyM`, and the nine-element `imageToWall` homography. Image registration is an input, never a vision-model guess. Development requires resolved supplied examples; unseen extraction requires certified exclusions; expansion requires passing fidelity gates. Results retain separate sources and explicit unreviewed dispositions for attachment as `record.facadeDescription`; they are not automatically attached to a release.

The runner caps development at $1, unseen at $0.50 and expansion at $1.50, within $3 additional and $5 cumulative. It hashes requests, reuses saved results, reserves before requests, restores saved settlements on resume and stops on unresolved charges. Its dry-run path was exercised; **no paid rich extraction was run**. The existing journal/resume infrastructure tests passed without external requests. This turn spent **$0**, leaving cumulative reconciled inference at **$1.705205502**.

Remaining work is substantive: resolve the twelve images; establish accurate registrations and independently annotated development/unseen features; run bounded extraction and repairs; inspect target-highlighted source comparisons in both viewers; establish the 5 cm contact checks with source-evidenced exceptions; and measure feature accuracy and richer-release memory. Only then can route expansion and an immutable replacement release proceed. No 90% fidelity result, completed human review, or named-shop restoration is claimed here.
