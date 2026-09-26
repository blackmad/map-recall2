# Retail-stage façade readiness

Status date: 13 September 2026

The retail detail pass improves three development previews, but it is **not ready for release**. The active release remains `c4bebc1fcc1ad9622ea4972755b3eee69f037928db4573219c86d2c4e088920d`. Nothing was published and route expansion did not start.

The exact preview candidate is `public/data/facade-repair-preview/cases.json` at SHA-256 `60148829ac835a4745b50faf21b0b1b3cf08b44c13d6a6977466bc884e2a332e`. Its checks, captures and retail visual review all bind that hash. The capture inventory contains 94 images and zero browser errors. These are local development-preview captures, not inspected results from both production viewers or the required fourteen-camera candidate runtime run.

## Retail changes

- **Case 03, het Fotolab:** the preview now separates the key-color / het Fotolab fascia, tagline and FUJIFILM canopy text, preserves broad shop glazing, and retains the scalloped hem on the extended dark awning. Typography, placement and interior detail remain approximate.
- **Case 21, De Fietsenmaker:** DE FIETSENMAKER and OPEN have separate physical sign identities, and the recessed entrance and return glazing remain visible. Sign depth, joinery, metric recess depth and the mounted bicycle remain unresolved.
- **Case 29, DORUS:** the dated extended awning, separate valance/display sign identities and two entrances are visible without stretched lettering. Glazing detail, timber cladding and metric recess depth remain simplified or unresolved.

Primary visual inspection records `photographicAcceptance: false` for all three. The source review accurately states that it occurred after the earlier prediction; these are development repairs, not untouched predictions.

Case 18 was part of the current registration diagnostic as a raised-residential target. Its source proves a paired entrance and stair run, while the bound review does not establish residential use. The composition audit therefore keeps its typology `unknown`. Source-inspected residential case 05 is the proposed future replacement for that evidence gap. Fuoco Vivo and Engels Verf remain named compatibility checks and have not been revalidated in this pass.

## Coverage and hard blocks

Current processing remains 27 of 28 cases and 54 analyzed image tiers, with case 26 abstaining on source identity. Source checks count 524 features; building-placement checks separately count 363 compiled features, 86 partial features and three placement omissions. These are processing and rendered-feature coverage counts, not reconstruction fidelity.

The retail registration artifact covers six tiers for cases 18, 21 and 29; all six are ambiguous. Case 03 has no retail-stage registration diagnostic. There are **zero accepted metric registrations** and zero accepted contact measurements. The following release gates remain open:

- held-out certification and door/window precision and recall;
- ground-contact evidence;
- photographic acceptance for the three retail cases;
- Fuoco Vivo and Engels Verf compatibility;
- inspected evidence from both production viewers;
- the fourteen-camera candidate runtime and texture-memory run;
- a complete candidate-bound release evaluation.

The original twelve image-numbered examples remain outstanding. The replacement development cases do not reproduce them.

## Sample composition and held-out risk

The source-bound audit covers the 28 development cases plus Fuoco Vivo and Engels Verf. It records 9 explicitly inspected retail frontages, 1 residential frontage, no explicitly mixed frontage and 20 unknowns. Street labels never determine typology. The current pass contains three source-supported retail cases and one unconfirmed typology target, so it does not yet prove the intended 3+1 retail/residential composition.

No active or proposed priority overlaps the current held-out building list. The held-out set remains uncertified and contains 29 candidates after the earlier reviewed-building overlap was removed. Named-shop building IDs still require development exclusions before any future tuning.

## Evidence bindings

The machine-readable report is `scripts/review/retail-stage-readiness.json`. Principal SHA-256 bindings are:

| Evidence | SHA-256 |
|---|---|
| Candidate cases | `60148829ac835a4745b50faf21b0b1b3cf08b44c13d6a6977466bc884e2a332e` |
| Candidate checks | `d6a84697adc4ca9c9d781800b41e8e964ed0c7bc47989ee87ac07458e64f3c26` |
| Capture inventory | `3a5453be2eca20fb3d52693d1220b68cac27f0f043c0030dbe8f34b338ac6ec3` |
| Retail source review | `6c282e7b3c8afd23e6ec7c03fcb541580ceadd9dcc6cf2c076976d9b7e0f6fca` |
| Retail registration | `f55043a1a58199bacf237bf4976c9fd416d92f66713e4b36f075acff15d121bf` |
| Retail visual review | `a4710eff320030bddf1724e1ab31a3cdd61d84580c1f427ca2e705de5fae30df` |
| Sample composition audit | `7c071a90475143602a9469cb66a6d5bd7430ffc6795e3b4259ba18cc3de1f5a3` |
| Preserved release pointer | `e90a376c219d3a35ff965ffbdb181023fe5100a0bb785450d9ca0c2d35b449d9` |

The global ledger remains at 1,053 settled entries and `$1.8065436345`, with zero unresolved entries. This stage made no paid calls.
