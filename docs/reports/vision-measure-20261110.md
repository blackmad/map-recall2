# Vision-measure spike (B6.1 / C2.1), 2026-11-10

**Verdict: PARKED.** Neither a classic projection-profile measurer nor an open-vocabulary detector (OWLv2) reaches 85 % exact agreement on bays and storeys on this data, and the available ground truth cannot demonstrate it either. No `src/` reader and no production script were written. Prototype and evaluation code are kept under `scripts/vision/` for the next attempt.

## Evaluation set (what was actually available)

- Rectified per-pand crops are cut from block-face strips (`strip.jpg` plus `spans[].px` in `strip.json`, 40 px/m). The archive `map-recall2-source-data/block-face-strips` holds only 74 strips; the union with staging copies in other worktrees gives 187 faces, 563 pands, of which **135 are `status: placed`** with a type that states bays and storeys. That is short of the 200 fronts asked for, and nowhere near 761 (the 761 block-face houses are not reachable as crops). `scripts/vision/build-eval-set.py` rebuilds the 135 crops.
- **Placed-type "truth"** (`truth.json`): bays = `likeness.columns.model`, storeys = the placed type's `body.storeys`. Weaknesses, measured below: bays are almost a function of pand width (`baysByWidth`), and storeys is one fixed number per type.
- **Hand-labelled gold** (`scripts/vision/gold-labels.json`): 53 crops I counted by eye from contact sheets (ground storey included, dormers excluded). 15 of 68 inspected crops were skipped as unusable or ambiguous (wrong span, a side wall, truck in front, irregular rows). Index = position in `truth.json`.
- `src/canalRecall/facade/measure.ts` run on the same crops as the comparator (`scripts/vision/run-measure-ts.ts`).

## Truth quality

| Check (53 gold crops) | bays | storeys |
|---|---|---|
| placed-type truth vs gold | 98.1 % | **62.3 %** |
| width-only baseline (<= 4.6 m -> 2 else 3) | 94.3 % | n/a |
| constant "4" baseline | n/a | **84.9 %** |

Placed-type storeys overstate by one in 17 of 53 (type says 5, photo shows ground plus three rows). The gold sample is 45 x 4-storey, 8 x 3-storey, so the 85 % bar on storeys equals the majority-class baseline. On the 135 placed pands the width baseline gives 95.6 % bays and constant-4 gives 58.5 % storeys. Agreement against this data mostly measures how well a method reproduces the width rule and the majority class.

## Methods and agreement

| Method | bays vs gold (53) | storeys vs gold (53) | bays vs type truth (135) | storeys vs type truth (135) | time / front |
|---|---|---|---|---|---|
| Classic CV (`measure-facade.py`: Sobel energy, column and row profiles, skyline, peak chain) | 88.7 % (dev 85 / test 92) | 41.5 % (best variant 50 %) | 82.2 % | 20.7 % | 13 ms median, 23 ms mean (CPU) |
| OWLv2 base-patch16-ensemble on MPS, "a window / a door / a shopfront", NMS + size filter + 1-D clustering | 91 % in-sample; **85 % held out** (params picked on the other half: 96 % dev) | 87 % in-sample, **77 % held out** (81 % majority on that half) | not run | not run | 0.54 s (MPS) |
| `measure.ts` (existing) | 35.8 % | 5.7 % | 34.1 % | 6.7 % | ms |

Classic bay confusion vs gold (gold, predicted): (2,2) 10, (2,3) 1, (3,2) 4, (3,3) 37, (3,4) 1. Classic storeys vs gold (gold, predicted): (4,4) 20, (4,5) 8, (4,3) 7, (4,1) 7, (4,2) 3, (3,4) 4, (3,3) 2, (3,5) 1, (3,1) 1.

Why storeys fail (classic): the row profile of vertical-edge energy peaks on cornices, brackets, dormers, balconies and roof ornament as strongly as on window rows, and the skyline-based eaves height (about 14 m for a 4-storey front, ground included) does not map to a storey count better than 70 % either, below the constant baseline. Window-blob thresholding against a median wall colour failed (wall colour estimate was dominated by trees, sky and shadow). Row-profile variants (restricted to window columns, darkness mask, product) scored 11-50 %.

Why the detector is not enough: OWLv2 finds windows well (20-40 boxes per front) but it also fires on door panes, shop glazing and dormers, and ground floors vary (shopfronts, arcades). The storeys rule that scored 87 % was tuned on the same 53 labels (3 knobs, 18+ combinations); under a split-half it was 77 % on the held-out half. The honest reading: a detector may be able to reach about 85 % bays, but storeys remain unproven and no better than "always 4".

## Failure examples

Crop names are `<face>__<pandId>.png`; regenerate with `uv run scripts/vision/build-eval-set.py <dir>`.

- Bays, classic: `bol-12-22__0363100012153030` (3 vs 2), `bol-12-22__0363100012164618` (3 vs 2), `bol-24-38__0363100012167017` (3 vs 2), `hals-76-90__0363100012166097` (3 vs 2), `bol-40-54__0363100012164043` (2 vs 3), `cuyp-130-168__0363100012157319` (3 vs 4).
- Bad spans in the strips (not method failures, but they poison truth): crops 0, 8, 10, 66, 70 in the 135 set show a side wall or a different building; indices in `truth.json` order.
- Storeys, classic: gold-4 fronts predicted 1-3 where the facade is washed out or the ground floor is hidden by awnings (e.g. `lelie-83-141`, Kinkerstraat shop rows) and predicted 5 where a cornice or dormer adds a peak (`stalpert-9-31`).

## What to do instead

1. The storeys need an independent label set. Take it from the 3DBAG/BAG year and `b3_bouwlagen` plus a short manual pass (not from types); only then does the 85 % bar mean anything.
2. Crop quality first: spans in the strips are sometimes wrong (side walls, wrong pand, truck, awning). Add a crop-sanity gate (facade fraction, skyline found, bottom at ground) before measuring anything.
3. If retried, use OWLv2 for window boxes, then a constrained fit (storey height 2.6-3.2 m, ground 3.2-4.5 m) rather than 1-D clustering, and score on a balanced set (3, 4, 5 and 6 storeys).
4. For bays on this corpus the width rule (`baysByWidth`) is already 94-96 % and free.

## Reproduce

```
uv run scripts/vision/build-eval-set.py EVAL_DIR
uv run scripts/vision/eval-measure.py EVAL_DIR
node_modules/.bin/tsx scripts/vision/run-measure-ts.ts EVAL_DIR
uv run scripts/vision/owl-probe.py EVAL_DIR OUT.json   # downloads ~0.6 GB under ~/.cache/huggingface
python3 scripts/vision/owl-eval.py EVAL_DIR OUT.json
```

Weights: `google/owlv2-base-patch16-ensemble`, about 0.6 GB in `~/.cache/huggingface` (well inside the 3 GB budget; disk free stayed at 98 GB).
