# Opening lattice on union-R0

Run `npx tsx scripts/facade-eval/evaluate-opening-lattice.ts` from the repository root. The script reads the frozen union-R0 prediction and measured-gold JSON, uses `fillOpeningLattice` with its default options, and scores with the existing `scoreOpenings` matcher at IoU ≥ 0.5. No detector or lattice setting was tuned. Prediction SHA-256: `111ee4a6f46ee180a3738344e40b4a977dee9d0a7da1b2b2fcec3cc2c0ea78e4`; gold SHA-256: `2d502904ebfb7bee41bd9ae44f7a88446935d2acfd27500ff438a5e85d482734`. All 60 prediction records join their gold wall (`missingPredictionRecords: 0`) with matching wall dimensions (`dimensionMismatches: 0`).

T2.4's input is `union-R0.json` exactly as written, so the primary **union** run feeds every union box to the lattice. Because 261 of the union's 578 boxes are `other` semantic masks — not openings, and wide enough to cover whole walls — a second diagnostic **openings** run drops them before the lattice to show what the same function does on a cleaner window skeleton. Both runs keep all union kinds in the score, so they share one baseline. The baseline exactly reproduces the stored union-R0 score. The façade scope is walls ≥ 4 m wide with at least one measured opening ≥ 0.6 × 0.9 m; only measured openings meeting that size are scored there.

## Union input (T2.4)

| Scope | Walls | Pass | Measured | Predicted | TP | FP | FN | Precision | Recall | Median centre error |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| All walls with an opening | 20 | Union | 70 | 319 | 17 | 302 | 53 | 5.3% | 24.3% | 0.273 m |
| All walls with an opening | 20 | Union + lattice | 70 | 319 | 17 | 302 | 53 | 5.3% | 24.3% | 0.273 m |
| Façade | 5 | Union | 26 | 140 | 14 | 126 | 12 | 10.0% | 53.8% | 0.299 m |
| Façade | 5 | Union + lattice | 26 | 140 | 14 | 126 | 12 | 10.0% | 53.8% | 0.299 m |

**Result: over the union as written the lattice imputes nothing.** It adds 0 boxes on both scopes and moves no number; it closes **0 of the 12** façade-scope false negatives. Every one of the 40 candidate boxes the accepted rows proposed was rejected because it overlapped an existing union box — most of them the broad `other` masks, which the overlap guard must treat as occupied.

`LatticeRowDiagnostic` over all 60 walls: 284 rows formed, 262 abstained, 22 ran inference (0 with an imputation; 11 rows proposed candidates that were all rejected, and 11 generated none because the detected windows already tile the fitted pitch). No wall formed zero rows. The refusals were 60 ground rows excluded by default, 201 rows with fewer than 3 windows (61 with none, 103 with one, 37 with two), and 1 row whose gaps fit no single pitch. On the five façade-scope walls, 32 rows formed; 14 ran inference (0 imputed — 8 rows proposed candidates that the overlap guard rejected, 25 candidates in all, and 6 rows generated none), 18 abstained (5 ground, 12 with fewer than 3 windows, 1 irregular pitch).

## Windows-and-doors input (diagnostic, not T2.4's input)

Dropping the `other` masks gives the lattice its cleanest possible window skeleton. It now imputes 20 boxes (11 on the façade walls), but the recall is unchanged:

| Scope | Walls | Pass | Measured | Predicted | TP | FP | FN | Precision | Recall | Median centre error |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| All walls with an opening | 20 | Union | 70 | 319 | 17 | 302 | 53 | 5.3% | 24.3% | 0.273 m |
| All walls with an opening | 20 | Union + lattice | 70 | 339 | 17 | 322 | 53 | 5.0% | 24.3% | 0.273 m |
| Façade | 5 | Union | 26 | 140 | 14 | 126 | 12 | 10.0% | 53.8% | 0.299 m |
| Façade | 5 | Union + lattice | 26 | 151 | 14 | 137 | 12 | 9.3% | 53.8% | 0.299 m |

It still closes **0 of the 12** façade-scope false negatives: all 20 added boxes are unmatched to the measured set. Across all 60 walls it forms 192 rows, 169 abstain and 23 run inference; on the five façade-scope walls it forms 22 rows, 7 abstain (5 ground, one row with one window, one with two) and 15 run inference, producing the 11 façade proposals. Two walls form no row because they carry only `other` masks.

## What this means

A point cloud under-counts visible openings, so "unmatched" here does **not** prove that all 31 proposals are invented windows. It does prove that this frozen measured set offers no positive evidence of improved recall, on either input. The 12 missed openings are not reachable by imputation from this union: with `other` present the overlap guard vetoes every candidate, and with `other` removed the rows that hold the missed openings carry fewer than three clean windows, or fragmented duplicates of the same bay, so the fitted pitch does not land on them. The abstention counts — 262 refused under T2.4's input, 169 under the cleaned input — size the alternative: a human-labelled photo set that scores imputation directly, rather than this detector-derived, under-counting gold. This evaluation does not re-adjudicate either detector against the point-cloud gold.
