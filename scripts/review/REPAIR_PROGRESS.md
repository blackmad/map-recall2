# Façade repair progress

Latest pass (13 September): see [retail-stage readiness](retail-stage-readiness.md) for current candidate counts, retail improvements, capture bindings and unresolved gates. The earlier next-stage record below is retained as history.

Status date: 12 September 2026

This is a validated development preview of the current compact scope. It is not a release candidate and it does not pass the photographic, registration, contact, held-out, or runtime release gates. The active local release pointer remains on `c4bebc1fcc1ad9622ea4972755b3eee69f037928db4573219c86d2c4e088920d`.

Open the local comparison UI at [http://127.0.0.1:5195/canal-drive/facade-repair-preview.html](http://127.0.0.1:5195/canal-drive/facade-repair-preview.html). It shows the dated source photograph, preserved-release screenshot, source-space shape study, and unregistered building-placement preview. All candidate geometry in this page is marked preview-only.

## Current compact scope

The user reviewed 28 replacement development cases. Image analysis completed for 27 cases, covering both full and ground crops: 54 analyzed tiers and 530 located raw predicted features. Case 26 is the sole source-identity abstention; its note says the source is unclear, so neither crop was analyzed and no feature was inferred. Two additional material predictions without bounds were retained in the raw provider evidence as explicit rejections and were not placed.

The latest compiled source-space studies contain 516 typed features after development corrections: 68 doors, 340 windows, 10 awnings, 90 material regions, and 8 fascia features. Counts describe processing output, not photographic correctness. They do not establish building placement or metric reconstruction fidelity.

Building-placement checks separately report 361 compiled features across the analyzed cases: 36 doors, 249 windows, 1 awning, and 75 material regions. Eighty-six features are explicitly partial and three placement omissions remain. These are candidate placements, not registered reconstructions. Case 09 has no usable published façade surface; case 30 abstains on a noncoplanar surface.

Six source-shape references corrected the development previews for cases 04, 11, 19, 22, 25, and 30. Further post-prediction inspection is recorded explicitly in `scripts/review/development-photo-corrections.json`; among its changes, case 19 removes an invented second main entrance and case 25 removes an unsupported material band. All of these changes are training repairs made after inspecting development photographs. They are not held-out predictions and cannot support a generalization claim.

Engineering checks pass for note bindings, source hashes, finite source-study geometry, compilation, explicit partial placement, and the case 26 abstention. The local preview capture run produced 94 images without browser errors, and its manifest is bound to the candidate hash recorded in `captures.json`. These captures are development evidence only; they are not inspected evidence from both production viewers or the fourteen-camera candidate runtime run.

## Coverage and acceptance limits

No quantitative photographic precision or recall is claimed. The preview has no verified pixel-to-wall registrations, so IoU at 0.7 has not been measured and clearly visible false negatives have not yet been scored. The photographic gate in `public/data/facade-repair-preview/checks.json` remains `not-passed`.

The reviewed set is excluded from held-out evaluation. All 28 reviewed building IDs are recorded in `facade-regression-heldout-exclusions.json`. One building actually overlapped the previous held-out candidates: observation `0363100012165927_e_0xxqmsr`, building `0363100012165927`, in Da Costabuurt. Removing it leaves 29 candidates, so the held-out set must be replenished and certified before evaluation.

The original twelve image-numbered examples remain outstanding because their attachments and observation mappings are unavailable. The replacement cases do not reproduce or resolve them. The named Fuoco Vivo and Engels Verf compatibility cases have not been revalidated against this candidate.

The remaining release gates are blocked:

- Registration: native crop-plane transforms are marked ambiguous and have not been certified to the 0.15 m limit.
- Ground contact: pavement/base measurements and any dated correction evidence have not passed.
- Photographic fidelity: development comparisons are not accepted, and held-out door/window precision and recall have not been computed.
- Runtime: the candidate has not run at all fourteen desktop/phone cameras with texture-inclusive memory, clearance, disposal, and rehydration checks.
- Publication: no computed evaluation artifact binds all required evidence to a candidate release.

The release pointer must not be activated, and route expansion must not begin, while these gates remain open.

## Budget

The live global ledger has 1,053 settled entries totaling `$1.80654363`, with zero unresolved charges. The extraction development phase totals `$0.101338132`, leaving `$0.898661868` of its `$1` allocation. Relative to the `$1.70520550` preserved baseline and `$3` additional authorization, `$2.89866187` remains available. The cumulative `$5` ceiling has `$3.19345637` remaining. Dollar figures are shown to eight or nine significant digits from the live journals.

## Reproduce the current evidence

Run these commands from the repository root. The extraction command below is a reconciliation-only dry run; it verifies that all 54 current analysis keys are cached without issuing paid requests.

Do not rerun `freeze-facade-regressions.mjs` as part of this reproduction. The regression manifest is already frozen; regenerating it with a changed compiler would invalidate the analysis-index binding and recalculate preserved-release baseline evidence.

```sh
npm run test:facade-regression-freeze
npm run test:facade-extraction
npm run extract:facade-details -- --manifest=scripts/review/facade-regression-analysis-manifest.json
node --import tsx scripts/review/build-facade-preview.ts
node --import tsx scripts/review/check-facade-preview.ts
npm run lint
```

Start the local preview server and open the link above:

```sh
PORT=5195 npm run dev
```

With that server running, regenerate the preview-only capture set in a second terminal:

```sh
node scripts/review/capture-facade-preview.mjs
```

Primary evidence files are `public/data/facade-repair-preview/cases.json`, `public/data/facade-repair-preview/checks.json`, `.cache/city-appearance/fidelity-extraction/analysis-results.json`, `.cache/city-appearance/fidelity-extraction/development-analysis-index.json`, `scripts/review/facade-regressions.json`, `scripts/review/development-photo-corrections.json`, and `scripts/review/facade-regression-heldout-exclusions.json`.

## Door grammar and ground heuristics

The shared compiler now supplies panelled, glazed and plain door variants, paired leaves, knobs/pull handles and letter slots. Inferred details carry procedural provenance. Metric door priors use a 0.65m single-leaf / 1.1m paired minimum width and 1.8m height, limited to modest corrections; plausible gaps of up to 0.30m extend to ground. Explicit thresholds, human corrections, raised and basement entrances are preserved, and pixel-space shape studies do not pretend to supply metric dimensions. Regression: `npm run test:facade-doors`. Prior-preview feedback is preserved separately and shown on the refreshed review page.


## Dated evidence and latest visual repair pass

The preview now exposes 184 hash- and dimension-checked cached image candidates across 28 cases under “Other dates / views.” Each remains a separate dated photograph. Case 17 (De Clercqstraat 90) has a January 2023 full view and December 2024 ground view; no alternate cached full view was found. No additional extraction requests were made.

Temporal recovery now requires explicit visible/occluded opening associations, verified source and target registration in the same coordinate frame, exact hash/date bindings, and verified structural continuity. It transfers only structural opening fields; signs, colours, materials, awnings and door furniture cannot leak across dates. Revocations and ambiguous or duplicate associations abstain. There are **zero accepted temporal recoveries** because the current metric registrations remain unresolved. The gallery is evidence preparation, not a claim that the occluded building has been reconstructed.

Three visual review passes covered the current ground/full comparisons and then rechecked changed cases. They found and fixed invalid correction dispositions hiding doors (14, 18, 19, 24), thin awning silhouettes (03, 29), and an incorrectly extended Moeders roller. Moeders primary and secondary sign text now has separate physical identities and dated source bounds; lettering is approximate and decorative logo motifs remain omitted. Door panels survive recess placement. Navigation shows position/address and stops at either end, avoiding accidental wraparound repetition.

Remaining photographic failures include roof/dormer silhouettes (20, 22 and others), white masonry ornamentation (14/15 and others), balconies, some curved-masonry-versus-glazing distinctions in full views, and angled storefront returns (21). Case 14's full and ground photographs have a possible frontage mismatch and must not be merged until resolved. Source studies of each dated tier remain separate; they do not yet combine clearer ground architecture into an occluded full photograph. Raised access and pavement contacts remain partly unresolved. These failures prohibit photographic acceptance and release activation.

Validation includes temporal source corruption/dimension/identity tests, structural-only fusion and revocation tests, door/awning/entrance/roof-silhouette regressions, per-case notes persistence after deep-link navigation, TypeScript, and 94 candidate captures with no page errors. Captures are not the fourteen-camera release runtime gate. Original twelve examples, Fuoco Vivo/Engels compatibility, held-out certification, measured fidelity, and release rollout remain outstanding.

The bounded next-stage pass adds a source-bound, preview-only case 17 architecture composite, a case 20 dormer silhouette, and a case 22 stepped-gable silhouette. Agent inspection rejects all five current next-stage comparisons for photographic acceptance. Case 22 improves the roof outline and opening rows, but brick piers still merge with window surrounds and balconies remain absent. Exact evidence hashes and the release decision are recorded in `scripts/review/next-stage-release-readiness.json`; metric registration remains at 0 accepted tiers, the held-out set remains uncertified, and the fourteen-camera candidate runtime run remains incomplete.

Latest user follow-up: case 24 now shares the source-supported head line across both doorways and the display, with aligned transom bars and single door leaves. Case 21 now preserves door/window detail while placing the open leaf and glazed return on separate inferred planes; cream backing no longer covers the glass. Primary front/ground-oblique inspection followed corrections to the initial depth-order failures. Exact recess depth is still unregistered. `npm run test:facade-review-corrections`, TypeScript, and the refreshed 94-image capture run pass.
