# What else is Jev good at for us? (lane J2, #353), 2026-11-10

Offline spike, `jev-1.14.0`, archived crops and renders only (no panorama fetched, no game data changed). Total spend **$0.107 of the $5 cap**
(about 1,000 calls; `scripts/jev/j2` ledger). Raw responses: `map-recall2-source-data` branch `lane/j2-jev-capabilities-20261110`,
`experiments/jev-capabilities-20261110/`. Worst-ten sheets: `blackmad/map-recall2-screenshots` `ui/2026-11-10-jev-j2/`.

## Truth, and what it can and cannot support

- **Set A:** the first 48 AB07 "good" crops (H4 labels, sorted by pand id). **Set B:** 12 marginal + 12 bad AB07 crops (occlusion only).
  **J1 set:** the 50 J1 fronts (kit/register truth). **Pairs:** 14 same-pand cross-year pairs and 14 decoys from H4's per-year crops.
  **Triples:** 28 photo + three renders from archived H1b/H2c renders (the brief said 30; only 28 pands have a before and an after render with a photo).
- **Hand labels are one reader** (this lane, looking at contact sheets): `scripts/jev/j2/labels.mjs`. Where I adjudicated Jev's ten worst misses by
  eye, the verdicts are anchored on Jev's answer and lean towards Jev. Every accuracy below carries that noise.
- **H5h's 80 photo-read pands (#351) have not landed**, so no family was re-scored on them. Re-run: `node scripts/jev/j2/score.mjs` after
  adding their labels to `labels.mjs`; fixtures need no change.
- Two runs per family. Hedged = answer probability between 0.3 and 0.7. conf-acc = accuracy where both runs agree and p >= 0.8 (coverage in brackets).

## The table

| Family / question | n | Accuracy run1 / run2 | Baseline | Run agreement | Hedged | conf-acc (coverage) | $/1k answers | Verdict |
|---|---:|---|---:|---:|---:|---|---:|---|
| 1 Wall colour, 8 swatches | 48 | 0.71 / 0.69 | 0.42 | 0.98 | 0.19 | 0.83 (50 %) | 0.26 | **filter** (see below) |
| 1b Wall colour, words only (no swatches) | 48 | 0.75 / 0.73 | 0.42 | 0.98 | 0.25 | 0.77 (46 %) | 0.06 | **filter**, swatches add nothing |
| 2 Window head, upper storeys (flat/segmental/round/pointed) | 48 | 0.96 / 0.96 | 0.875 | 0.96 | 0.17 | 1.00 (75 %) | 0.07 | **filter**, only 6 non-flat in the set |
| 2b Any curved arch yes/no | 48 | 0.94 / 0.92 | 0.875 | 0.98 | 0.06 | 0.98 (83 %) | 0.07 | **filter**: 6/6 arches found, 3 false |
| 3 White bands, original wording | 48 | 0.50 / 0.52 | 0.75 | 0.98 | 0.44 | 0.67 (31 %) | 0.07 | **no** |
| 3 White bands, reworded | 48 | 0.77 / 0.79 | 0.75 | 0.98 | 0.19 | 0.93 (60 %) | 0.06 | **no**: finds 4 of 12 |
| 3 White surrounds (both wordings) | 48 | 0.60-0.67 | 0.52 | 0.94-1.0 | 0.25-0.60 | n/a | 0.06 | **no** |
| 3 White cornice | 48 | 0.81 / 0.79 | 0.75 | 0.98 | 0.17 | 0.88 (69 %) | 0.07 | **filter**: finds 11 of 12, 8 false |
| 3 Keystones, quoins | 48 | not scored | | | | | 0.07 | no truth labelled |
| 4 Van or truck | 72 | 0.94 / 0.94 | 0.92 | 1.00 | 0.06 | 0.98 (89 %) | 0.07 | **own as a flag** (5 of 6, 3 false) |
| 4 Tree trunk or post | 72 | 0.79 / 0.79 | 0.97 | 0.97 | 0.28 | 0.76 (53 %) | 0.07 | **own as a flag** for "something vertical in front" (see below) |
| 4 Bare branches | 72 | 0.81 / 0.79 | 0.79 | 0.99 | 0.14 | 0.85 (65 %) | 0.07 | **filter**: 15 of 15 found, 14 false |
| 4 Scaffold, boat | 72 | 1.00 / 0.99 | 1.00 | 1.0 | 0.01 | | 0.07 | unproven: no positives in the set |
| 5 Same building, two years | 48 | 0.96 (46/48) | | 0.96 | | | 0.10 | **own** |
| 5 Same shopfront, two years | 16 | 1.00 (16/16) | | | | | 0.10 | **own** (small n) |
| 5 Same paint, two years | 28 | weak | | | | | 0.10 | **no** alone: decoys score 0.4-0.66 |
| 6 Stoop | 48 | 0.94 / 0.94 | 0.875 | 1.00 | 0.08 | 1.00 (79 %) | 0.08 | **filter**: 3 of 6, 0 false |
| 6 Balcony, original wording | 48 | 0.73 / 0.73 | 0.875 | 1.00 | 0.19 | 0.96 (56 %) | 0.08 | **no** as worded (railings count) |
| 6 Balcony, reworded (projecting platform) | 48 | 0.96 / 0.96 | 0.875 | 1.00 | 0.06 | 1.00 (85 %) | 0.06 | **own**: 4 of 6, 0 false |
| 6 Hoist beam, souterrain, bay window | 48 | not scored | | | | | 0.08 | no truth; says yes on 19 %, 8 %, 6 % |
| 6 Door present / door box | 48 | not scored | | | | | 0.08 | says door visible on 65 %; box confidence mean 0.48 |
| 7 Likeness, best-of-three | 28 | decoy picked 11 of 28 | chance 9.3 | 0.93 | | | 0.19 | **no** |
| 7 Likeness, per-render same house | 84 | says "same" for 2 of 56 true renders | | | | | 0.17 | **no** |
| 8 Dormer, reworded | 41 | 0.81 / 0.83 | 0.61 | 0.98 | 0.29 | 1.00 (59 %) | 0.07 | **filter/own** (J1 wording: 0.49) |
| 8 Basement, reworded | 41 | 0.81 / 0.78 | 0.98 | 0.98 | 0.49 | | 0.07 | **no**: 8 false of 40 negatives |
| 9 Gable, no reference images | 50 | 0.68 / 0.66 | 0.42 | 0.98 | 0.50 | 1.00 (22 %) | 0.07 | **filter**, same as J1 at 4.7x less |
| 9 Gable, crown-only crop | 50 | 0.48 / 0.48 | 0.42 | 0.96 | 0.60 | 1.00 (10 %) | 0.04 | **no** |

Cost: a one-image call is about 1,500-2,000 tokens, $0.00006-0.00008. The eight-swatch colour call is 6,300 tokens, $0.00026. Likeness
(four images) is $0.00019. Latency was 0.4-0.6 s per call at concurrency 4.

## Findings by family

1. **Colour.** The question was whether Jev corrects shadow and white balance or repeats pixels. It corrects them. On the 43 pands with
   an H5 pixel brick hex, the hex mapped to the nearest swatch matches my label 23 % of the time; Jev matches 70 %. Jev was right where the
   pixel family was wrong on 22 pands and wrong where pixels were right on 2. The pixel hex is dull and dark: it turns red-brown fronts into
   "dark brown" (A0, A1, A3, A11, A26, A29, A46), pale salmon into grey, and sunlit brick into white plaster (A21, `#f9e9bc`).
   Where Jev errs it errs by one step (dark brown vs red-brown, orange vs red-brown): 13 of its 14 run-1 misses sit in neighbouring pairs (dark brown, red-brown, orange, pale salmon, near-black).
   Use it to choose the colour **family** (and so which palette to pull the pixel hex towards), not to set a hex. Words alone do as well as swatches.
2. **Window head.** The set is 42 flat, 4 segmental, 2 round, so 96 % is barely above 87.5 %. Arch detection found all six arch fronts.
   It needs a set with many arches before it can be trusted for segmental vs round. Per-storey heads were asked (`top_storey_head`) but not scored.
3. **White accents.** Bands: Jev reads a white ground floor, a white cornice or light lintels as bands (all 10 of the worst were that, by eye).
   Rewording lifts accuracy to the baseline but finds only 4 of 12. Surrounds: 9 of the ten worst were Jev errors, one (A26) was my truth error.
   Cornice is the only usable one. The brief asked for dark-frame negatives: set A has 25 fronts without white surrounds and 36 without white
   cornice, and Jev's false positives sit there.
4. **Occlusion.** Van or truck is reliable. "Trunk or post" looked weak against my labels (15 false), but I had labelled only large trunks:
   in the worst ten, 8 were real lamp posts, traffic poles or trunks that the question asked about. Treat it as "a vertical obstruction". Branches:
   no miss, but about half of the yes answers are light twigs, so use it only to downweight a crop. It can feed H4's picker next to the current flags.
5. **Same facade across years.** Strongest new result. Same building: 46 of 48 over both runs (all 14 decoys <= 0.24; same-pand pairs 0.83-0.93).
   Same shopfront separates the one pair whose shop changed (P12, Murugan vs plants: 0.41) from the rest (0.85-0.91). Five same-pand pairs scored
   0.1-0.5 because the two years' crops cover different parts of the front (P9 shows a different building entirely); this is also a crop-alignment check.
   Same paint is not usable on its own because two different brick fronts score 0.4-0.66.
6. **Features.** Stoop and a reworded balcony are good; positives are few (6 each). Hoist beam, souterrain and bay window have no truth (and the
   panorama stitch pole above many crops looks like a hoist), so they are not scored. Door box: unscored here; J1 had 13 of 13.
7. **Likeness.** Does not work. With three renders it picks the decoy on 11 of 28 triples, and asked "is this the same house" per render it
   says yes for 2 of 56 true renders and 0 of 28 decoys. Today-vs-spec ranking is therefore not testable. The judgement session's labels
   (sheets in the screenshots repo) would add agreement numbers; run `node scripts/jev/j2/score-likeness.mjs --labels=<json>`.
8. **Dormer reworded.** 0.49 became 0.81-0.83 (baseline 0.61), 10 of 16 found, 2 false; the "window in the roof slope, not a gable" wording works.
   Basement reworded still loses to its baseline.
9. **Gable without reference images.** Same accuracy as J1's picture-choice (0.66-0.68), 4.7x cheaper per call. A crown-only crop is worse.

## Recommendation

For H5, wire in: (1) the cross-year `same_building` >= 0.8 and `same_shopfront` >= 0.8 gate for occluder masking, both runs agreeing;
(2) the reworded dormer and balcony questions and the stoop question, accept only when both runs agree and p >= 0.85 (stoop and balcony find
about 2/3 of positives, so absence is not a "no"); (3) a van/truck flag and a combined obstruction flag for H4's picker, not as hard gates;
(4) colour family from the words-only question, as a corrector that overrides the pixel family when Jev's p >= 0.8, and as a disagreement flag otherwise.
Keep J1's findings for bays and shopfront, and use the reference-free gable question as the cheaper replacement for J1's gable filter
(accept at p >= 0.8, 22 % coverage). Do not wire bands, surrounds, basement, per-render likeness or crown-only crops.

## Open

- Re-score on H5h's 80 photo-read pands (#351) when they land; set A is one buurt (AB07) and one reader.
- Unscored: keystones, quoins, hoist, souterrain, bay window, per-storey heads, scaffold and boat positives, door box on set A.
- Likeness truth from the judgement session; the answer key is in the archived `triples.json`.
- Remaining budget is $4.89: a second reader on set A, or an arch-rich window-head set, are the best next spends.

## Code

`scripts/jev/j2/`: `lib.mjs` (asker, ledger, hard cap), `build-sets.mjs`, `build-pairs.mjs`, `build-triples.mjs`, `run-family.mjs`,
`fixtures/*.json` (every question, reviewable), `labels.mjs`, `score.mjs`, `score-years.mjs`, `score-likeness.mjs`, `colour-vs-pixel.mjs`, `worst-sheet.mjs`.
Key from `process.env.TYPESAFE_API_KEY` only; 401/403 stop the run; no retries.
