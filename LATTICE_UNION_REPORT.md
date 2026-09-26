# The opening lattice against the union: a measured zero

**Verdict: feeding the raw union into `fillOpeningLattice` adds nothing. The
delivered `union-R0-lattice.json` is geometry-identical to `union-R0.json` —
0 imputed boxes, every score unchanged. This is an honest negative, and it has
two independent causes: spurious `other` regions veto every candidate, and the
rows that actually carry the missed openings do not have enough clean window
detections to fit a rhythm.**

I did not modify `openingLattice.ts` and did not change any of its defaults. I
found no bug in it; the module behaves exactly as its design says.

## What was run

- `scripts/facade-eval/apply-lattice.ts` (new, out-of-tree) runs
  `fillOpeningLattice(boxes, wallWidthM, wallHeightM)` over each of the 60
  `union-R0` records with default options, writes
  `public/data/facade-model-eval/v1/predictions/union-R0-lattice.json` in the
  scorer's contract, and marks the added boxes `origin: "imputed"`.
- Detected boxes are preserved byte-for-byte (verified: 0 geometry mismatches
  against `union-R0.json`; the only added field is `origin`).
- Scored with `scripts/facade-eval/score.ts` on both scopes, IoU >= 0.5, all
  kinds, matching the published `scores.json` union baseline exactly.
- `public/data/facade-model-eval/v1/lattice-diagnostics.json` records the
  aggregate `LatticeRowDiagnostic` output.

Commands:

```
npx tsx scripts/facade-eval/apply-lattice.ts
npx tsx scripts/facade-eval/score.ts --pred=public/data/facade-model-eval/v1/predictions/union-R0-lattice.json --lane=union-R0-lattice
npx tsx scripts/facade-eval/score.ts --pred=public/data/facade-model-eval/v1/predictions/union-R0-lattice.json --lane=union-R0-lattice --min-wall-width=4 --min-opening-width=0.6 --min-opening-height=0.9
```

`npx tsc --noEmit` is clean and the 73 lattice assertions pass.

## Before / after

| scope | | predicted | tp | fp | fn | precision | recall | median centre |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| all (20 walls) | before | 319 | 17 | 302 | 53 | 5.3% | 24.3% | 0.273 m |
| all (20 walls) | after | 319 | 17 | 302 | 53 | 5.3% | 24.3% | 0.273 m |
| facade (5 walls) | before | 140 | 14 | 126 | 12 | 10.0% | 53.8% | 0.299 m |
| facade (5 walls) | after | 140 | 14 | 126 | 12 | 10.0% | 53.8% | 0.299 m |

No cell moves, because no box was added.

## Row diagnostics, aggregate (all 60 walls)

| | n |
| --- | --- |
| rows clustered | 284 |
| **accepted** (imputation ran) | **22** |
| — imputed > 0 | 0 |
| — proposed candidates, all rejected | 11 |
| — no candidate (detected windows already tile the row) | 11 |
| **refused** (abstained) | **262** |
| — ground row left alone by default | 60 |
| — fewer than 3 windows | 201 |
| — no consecutive gap to estimate a pitch | 0 |
| — gaps not one pitch (residual > 0.3) | 1 |
| imputed boxes | **0** |
| candidates rejected by the wall/overlap guards | 40 |

On the 5 facade-scope walls alone: 32 rows, **14 accepted, 18 refused** (5
ground, 12 too few windows, 1 not one pitch). The `minimumPerRow = 3` rule is
doing most of the refusing: 201 of 284 rows, and most walls are thin 3DBAG
slices whose windows stack vertically one to a row.

## Facade-scope false negatives

**The lattice covers 0 of the 12** (and 0 of the 53 in the all scope). Every one
of the 12 is still unmatched after the lattice.

Where they live:

- **7 of the 12 sit in rows the lattice refused for having fewer than 3 windows**
  (wall …2064873 row up 2.93; …2156186 rows up 2.95 and 7.29; …2161771 row up
  3.09). These are unreachable before the overlap guard even runs.
- **5 sit in accepted rows**, where the outcome was:
  - …2074448 row up 5.61 and …2166039 row up 5.57 — candidates proposed, all
    rejected by the overlap guard (6 and 2 rejections);
  - …2161771 rows up 6.64 and 9.85 — accepted, but no candidate was generated
    at those bays at all (the detected windows in the row already tile the
    fitted pitch with no missing multiple).

## Diagnosis: why zero, and why it is not only the union

I ran two labelled counterfactuals to separate the two causes. These are
diagnostics, not a delivered lane and not a threshold change.

| input | imputed (facade walls) | rejected | facade P | facade R | facade tp/fp/fn | baseline FN covered |
| --- | --- | --- | --- | --- | --- | --- |
| full union (delivered) | 0 (0) | 40 | 10.0% | 53.8% | 14/126/12 | 0/12 |
| drop `other` | 20 (11) | 18 | 14.4% | 53.8% | 14/83/12 | 0/12 |
| windows only | 19 (11) | 18 | 11.4% | 38.5% | 10/78/16 | 0/12 |

**Cause 1 — spurious `other` regions occupy the wall.** 261 of the union's 578
boxes are `other`, and many are broad RF-DETR mask leftovers. On wall
`…2074448` two `other` boxes span `6.35 m x 14.18 m` and `4.88 m x 3.56 m` of a
`6.37 m x 14.71 m` wall. `fillOpeningLattice` treats every detected box as an
opening for its overlap guard (correctly — it must not overwrite detections), so
the 40 candidates it generated were all rejected. Dropping `other` drops 43
facade false positives and **zero** facade true positives, and the lattice then
imputes 20 boxes. `other` is pure false-positive mass here.

**Cause 2 — the rhythm is not there where the openings are missing.** Even
after dropping `other`, the lattice still covers 0/12. The rows that contain
the missed openings hold at most 2 clean window detections, or hold fragmented
duplicates of the same bay (e.g. a 0.24 m sliver at `along 0.01` beside a
2.49 m box at `along 1.69`), so the fitted pitch puts the imputation at the
wrong column. With `other` removed the lattice does place 11 boxes on the
facade walls — `wall:4 0.79@up5.62`, `wall:8 2.15@up6.14`, `wall:23
6.07@up13.08`, … — sometimes in the right storey, but 2–3 m along from the
measured opening (`…2166039` has a missing opening at `4.15 up 5.53`; the
imputation on that wall went to `0.95 up 5.91`).

The obstacle is therefore not the lattice's conservatism alone: **the union is
not a clean window skeleton.** It carries broad non-opening regions and
fragmented window duplicates, so the storey rhythm the imputation needs is
absent exactly where the evidence is missing. Imputation needs a curated
per-row window set (or a cleaned union) as input; the raw union cannot supply
it.

## Sizing the next step

- The lattice had enough rhythm to even attempt imputation on only **22 of 284
  rows**. The other **262 abstained**, 201 of them for having fewer than 3
  windows — a different problem that imputation cannot solve and that
  hand-labelling would address directly.
- On the 5 facade walls, **14 rows were accepted and 18 refused** (12 of them
  too few windows). A hand-audit of the facade rows is a small job (~32 rows)
  and would settle both the missing-opening count and the duplicate-window
  problem.
- The largest single lever is not the lattice: it is removing the 261 `other`
  boxes (or preventing RF-DETR from emitting them). That alone removes 43 facade
  false positives and unblocks imputation, though on this gold set it still
  recovers none of the 12 missed openings.

No module bug found, so `openingLattice.ts` is left untouched.
