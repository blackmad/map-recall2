# Direct visual extraction and crop QA — 9 September 2026

Reviewed 16 of the 103 frontage records directly from cached panorama pixels and full, context, ground and roof crops. This was a purposive sample spanning Da Costakade, Da Costastraat, De Clercqstraat, Hugo de Grootkade and Nassaukade, including narrow strips, broad buildings, ordinary controls and two Sterk walls. No paid calls were used.

The output is **agent-only evidence and primary extraction proposals, not human labels or an accuracy benchmark**. Existing extraction answers were not read for this pass; prior conversation already disclosed Sterk and some roof problems, so it was not fully blinded. No aerial images were used in this pass.

## Findings that change the workflow

- **Recrop before semantic review:** `0363100012237064_e_17b9vzf`, Hugo de Grootkade 20, is predominantly sky/foliage with a small unidentified wall fragment. `0363100012152724_e_1s86ki9`, Da Costakade 10/12, pairs a window-stack full crop with a recessed-door ground crop; wall correspondence needs correction. Neither should collect confident appearance labels from these pixels.
- **Do not reject every narrow crop:** the 3.1 m Da Costakade 28 corner (`0363100012081167_e_1ba9k92`) is useful. Its 2025 ground image clearly supports an ice-cream storefront, a cream fabric awning and the visible IJscuypje name. The old full image and newer ground image depict different frontage states.
- **Keep good fields from partially bad sources:** Da Costastraat 3 has scaffolded/partly occluded full and roof views, but a clear newer ground view with number 3 and domestic windows. Preserve the ground observations; resample the roof.
- **Broad façades need bay-level crops:** the 68.8 m Da Costakade 14–26 block is the correct visible complex, but its shallow ground strip and construction occlusion cannot support one whole-frontage shop/awning verdict. Useful upper-wall evidence remains.
- **Sterk is recoverable directly from pixels:** number 7 supports `STERK INGANG STERK`; number 9 supports `slijterij STERK`. Both show neck-like decorative tops and dark fixed sloping canopies. This does not establish the hidden roof volume, prove current tenancy, or replace human wall-placement confirmation.
- **Storefronts are not all broad glazing:** the modern Hugo de Grootkade block has low institutional-looking windows and a structural overhang. These should not inflate retail/awning density. The paired De Clercqstraat 8/10 frontage does have clear shops, including `ScooterCentre WEST`.

Fourteen records retain useful appearance evidence; two are marked for recropping. No definitive wrong-neighbour case was established. One within-building wall mismatch is flagged separately from whole-building identity. Width alone would reject good evidence and still fail to catch some bad evidence.

## Roof interpretation

This pass supports decorative `pointed`, `stepped`, `neck` and `straight` façade-top proposals. It does **not** support a whole-building roof-volume classification for any of the sixteen cases. A visible triangular/stepped façade, a short front roof slope or a flat-looking parapet is not enough to classify surfaces hidden behind it. This is a street-evidence limit, not proof that earlier roof predictions are wrong.

The next roof pass should pair verified aerial footprint coverage with these street-facing details. The decorative top and roof volume must remain separate fields.

## Artifacts and integration

Local artifacts are under `.cache/da-costa-neighbourhood/self-review-2026-09-09/`:

- `sample-sources.json`: source-bound selection, crop and original panorama SHA-256 hashes.
- `NNN-source-and-crops.jpg`: sixteen inspection sheets. Original panoramas are displayed as resized, vertically cropped bands, without rectification; separate dated source views are included for independent ground crops.
- `findings.json`: structured agent-only proposals, per-field eligibility, quality reasons and explicit wall/building scope.

Use only proposal fields with `fieldEligibility=true`. `appearanceEligible=false` requests a crop repair before semantic review. An unknown roof must not erase useful storefront/awning evidence. Do not import this file as a human review export or use it as supervised gold data.

Reproduction scripts: `scripts/da-costa-block/prepare-self-review-sample.mjs` builds the inspection pack; `scripts/da-costa-block/record-self-review-sample.mjs` validates the inspected pixel hashes and emits the separately authored observations. Neither edits the active manifest or human review history.
