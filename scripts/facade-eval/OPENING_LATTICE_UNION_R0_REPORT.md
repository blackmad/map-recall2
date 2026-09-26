# Opening lattice on union-R0

Run `npx tsx scripts/facade-eval/evaluate-opening-lattice.ts` from the repository root. The script reads the frozen union-R0 prediction and measured-gold JSON, uses `fillOpeningLattice` with its default options, and scores with the existing `scoreOpenings` matcher at IoU ≥ 0.5. No detector or lattice setting was tuned. Prediction SHA-256: `111ee4a6f46ee180a3738344e40b4a977dee9d0a7da1b2b2fcec3cc2c0ea78e4`; gold SHA-256: `2d502904ebfb7bee41bd9ae44f7a88446935d2acfd27500ff438a5e85d482734`.

The lattice receives union windows and doors. Union `other` boxes are semantic masks, including whole-wall boxes; they remain in the existing all-kinds score but are not opening evidence for clustering or overlap rejection. The baseline below exactly reproduces the stored union-R0 score. The façade scope is walls ≥ 4 m wide with at least one measured opening ≥ 0.6 × 0.9 m; only measured openings meeting that size are scored there.

| Scope | Walls | Pass | Measured | Predicted | TP | FP | FN | Precision | Recall | Median centre error |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| All walls with an opening | 20 | Union | 70 | 319 | 17 | 302 | 53 | 5.3% | 24.3% | 0.273 m |
| All walls with an opening | 20 | Union + lattice | 70 | 339 | 17 | 322 | 53 | 5.0% | 24.3% | 0.273 m |
| Façade | 5 | Union | 26 | 140 | 14 | 126 | 12 | 10.0% | 53.8% | 0.299 m |
| Façade | 5 | Union + lattice | 26 | 151 | 14 | 137 | 12 | 9.3% | 53.8% | 0.299 m |

**Result:** the default lattice closes **0 of the 12** façade-scope false negatives. Its 11 added boxes on those five walls are unmatched to the measured set. Across all 20 gold-bearing walls, it adds 20 boxes, also with zero additional matches. A point cloud under-counts visible openings, so “unmatched” here does **not** prove that all 11 proposals are invented windows. It does prove that this frozen measured set offers no positive evidence of improved recall.

`LatticeRowDiagnostic` sizes the review task. Across all 60 input walls, 192 detected rows formed, 169 abstained, and 23 ran inference; two walls formed no row. The reasons were: 58 ground rows excluded by default, 87 rows with only one detected window, and 24 with two windows. On the five façade-scope walls, 22 rows formed; seven abstained (five ground, one with one window, one with two). The 15 non-abstaining façade rows produced 11 proposed boxes. A human-labelled photo set is needed to tell whether those proposals are real and whether the conservative abstentions hide recoverable windows; this evaluation does not re-adjudicate either detector against the incomplete point-cloud gold.
