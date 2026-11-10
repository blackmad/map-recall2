# Jev facade spike (lane J1, #326), 2026-11-10

Question: can TypeSafe Jev (`jev-1.14.0`, image input behind `TypeSafe-Danger-Zone-Images: true`, `/v1/systemone`,
multipart) answer the ordinary-house facade questions we currently measure by hand?

**Short answer:** for **bay count** (within ±1) and **shopfront**, yes. For **gable**, it works only as a filter:
answers above a confidence threshold are reliable, and the rest (58 %) still need review. It **cannot** own
**finish**, **stone bands**, **basement entrance** or **dormer** as these questions are phrased. **White frames**
scored 97.6 %, but the set had just one negative, so that result shows nothing. It costs almost nothing:
$0.0003 per front.

## Set (50 fronts, no new fetches)

- **41 block-face houses** from 19 faces (Kinkerstraat, Jan Evertsenstraat, Landlust and others). Each is cut from
  the archived rectified strips (`map-recall2-source-data/block-face-strips`, 40 px/m) at the pand's span in
  `strip.json`. Their truth is the hand-authored intent, resolved through `houseIntents()`: gable, wall material,
  measured frame colour, bands, shopfront, basement, dormers/tower, bays and doorBay.
- **9 listed canal houses** from `pand-reference-walls`. Their truth comes from the RCE register
  (`monument-facts.json`): gable, plus finish, bands, basement and dormer where the text states them. The other 27
  listed walls were excluded by eye: their crops are ground-floor close-ups, side walls, or large non-canal
  buildings with no gable in frame.
- **Gable mix:** cornice 21, bell 9, step 9, neck 8, plain 3. **Bays:** 2 → 26, 3 → 12, 4 → 3. **Shopfronts:**
  22 of 41.
- **Crops:** 13 narrow fronts (taller than 1400:300) were widened symmetrically into their neighbours, because Jev
  rejects any side under 280 px and does not resize. Every question asks about "the house in the middle".
- **Gable mapping to the six labels:** flat/cornice → cornice, raised-neck/shouldered → neck, point → plain.
- **Sheets:** `blackmad/map-recall2-screenshots` `ui/2026-11-10-jev-facades-spike/truth-set-{1-24,25-50}.jpg`.

## Questions (13 per crop, one request)

- **Choice:** gable {neck, bell, step, cornice, spout, plain}; finish {brick, painted brick, plaster, stone, mixed}.
- **Noul (yes/no):** white frames, stone bands/speklagen, shopfront, basement entrance, dormer.
- **Bays, asked twice:** once as a picture choice against five reference fronts (1–5 bays, single-module houses from
  outside the set), once as a word choice.
- **Box with a noul guard:** door; gable crown.
- **Request size:** 6 images per request (the crop plus 5 references), about 7,300 input tokens.

Code: `scripts/jev/build-set.ts` (truth and crops), `scripts/jev/run.mjs` (asker; key from env only, fail closed on
401/403, no retries), `scripts/jev/score.ts`, `scripts/jev/miss-sheet.mjs`.

## Numbers (two runs, jev-1.14.0)

Columns:

- **Accuracy:** run 1 / run 2.
- **Baseline:** share of the most common true answer in the set.
- **Hedged:** answer probability between 0.3 and 0.7.
- **Drift:** the answer changed between the two runs.
- **Accept rule:** the lowest threshold at which accepted answers are at least 95 % right, with both runs required
  to agree.

| Field | n | Accuracy | Baseline | Hedged | Drift | Accept rule (≥ 95 %) | Auto / review |
|---|---:|---|---:|---|---:|---|---|
| gable | 50 | 0.66 / 0.68 | 0.42 | 0.50 / 0.48 | 0.06 | p ≥ 0.75 → 21/21 right | 42 % / 58 % |
| finish | 41 | 0.854 / 0.854 | 0.756 | 0.20 / 0.22 | 0 | p ≥ 0.90 → 95.2 % | 51 % / 49 % |
| white frames | 41 | 0.976 / 0.976 | 0.976 | 0.10 | 0 | any | 100 % (untested on negatives) |
| stone bands | 41 | 0.756 / 0.756 | 0.78 | 0.42 / 0.34 | 0.05 | none | below baseline |
| shopfront | 41 | 0.854 / 0.854 | 0.537 | 0.02 | 0 | \|noul−0.5\|·2 ≥ 0.75 → 96.7 % | 73 % / 27 % |
| basement entrance | 41 | 0.805 / 0.829 | 0.976 | 0.42 / 0.44 | 0.02 | none | below baseline |
| dormer | 41 | 0.488 / 0.488 | 0.61 | 0.24 | 0 | ≥ 0.85 → 8/8 | below baseline |
| bays, picture, exact | 41 | 0.829 / 0.854 | 0.634 | 0.27 | 0.02 | p ≥ 0.60 → 96.9 % | 78 % / 22 % |
| bays, word, exact | 41 | 0.829 / 0.780 | 0.634 | 0.39 | 0.05 | p ≥ 0.55 → 96.7 % | 73 % / 27 % |
| **bays ±1** (both forms) | 41 | **1.00 / 1.00** | | | | any | ~97 % |
| door box (centre in door bay ± ½ bay) | 13 | 13/13 | | | 0 | | only 13 doors with truth |

- **Gable confusion (run 1, rows are truth):**
  - cornice: 19 cornice, 1 bell, 1 neck.
  - step: 8 step, 1 bell.
  - bell: 3 bell, **5 plain**, 1 cornice.
  - neck: 2 neck, 3 bell, 2 step, 1 cornice.
  - plain: 1 plain, 1 bell, 1 cornice.

  Cornice and step are reliable. Bell, neck and plain are where it fails.
- **Guards:** door present 42–44 %. Crown present 78 %, and the crown box top lands in the upper third on 86 % of
  crops. There is no hand truth for the crown box, so it is unscored.
- **Cost and latency (100 calls):**
  - Tokens: 7,328 input per call on average (6 images), 7,576 at most.
  - Cost: **$0.000308 per call**, $0.031 for the whole spike.
  - Latency: p50 414 ms, p90 571 ms, max 863 ms. One 50-front run takes 5 s at concurrency 4.

## Ten worst misses (wrong in both runs, ranked by confidence)

Sheet: `ui/2026-11-10-jev-facades-spike/worst-ten-misses.jpg`. My verdicts, from looking at each crop:

1. **Kinkerstraat 268** finish, truth plaster, Jev painted brick (0.93). The front is a grey rendered or painted
   block. The class boundary is ambiguous; this is a Jev error by our labels.
2. **Jan Evertsenstraat 133-135** white frames, truth false, Jev true (0.92). The frames look cream or white in the
   crop. **This is a truth error**: the kit's measured frame hex #6b6454 is in shadow.
3. **Kinkerstraat 53A** basement, truth no, Jev yes (0.86). Unclear: there are a couple of steps at the door.
4. **Kinkerstraat 264** finish: the same plaster vs painted-brick confusion as 1.
5. **Kinkerstraat 350** stone bands, truth no, Jev yes (0.84). Light window-head bands could be read as courses.
   The truth may be incomplete.
6. **Kinkerstraat 53A** shopfront, truth no, Jev yes (0.82). Jev is wrong: the ground floor has residential doors.
7. **Kinkerstraat 53A** dormer, truth no, Jev yes (0.82). Jev is wrong: the window is an attic window in a pointed
   gable.
8. **Kinkerstraat 266** finish: plaster vs painted brick again.
9. **Kinkerstraat 238** finish, truth painted brick (dark), Jev brick (0.78). Jev is wrong.
10. **Kinkerstraat 53** dormer, truth no, Jev yes (0.78). There is a roof lantern on top. Borderline.

**Systematic failures:**

- **Dormer:** 19 of the 21 false "yes" answers are on gabled fronts. Jev calls the attic window inside a gable a
  dormer.
- **Basement:** 8 of the 9 errors are false "yes".
- **Stone bands:** all 10 errors are false "yes"; it over-reads window-head bands as courses.

In all three, Jev leans towards "yes" on a front with lots of features.

## Verdict against the bar (≥ 90 % on gable, finish, frames; bays within ±1)

| Field | Bar met? | Ownership for the ordinary-house tiers |
|---|---|---|
| Bay count | **Yes**: 100 % within ±1, 83–85 % exact | **Jev owns it.** Exact counts auto-accept at p ≥ 0.6 (78 %, 97 % right). The picture form is slightly better than the word form. |
| Shopfront | n/a (not in the bar) | Jev owns it with review: 73 % auto at 96.7 %, 27 % to review. |
| Gable | **No**: 66–68 % | **Filter only.** Accept p ≥ 0.75 with both runs agreeing: 42 % auto at 21/21 right, 58 % to review. Cornice and step are safe; bell, neck and plain go to review. |
| Finish | **No**: 85 % | Filter: p ≥ 0.9 gives 51 % auto at 95 %. Plaster vs painted brick needs a reworded question or a colour measurement. |
| White frames | Unproven | 97.6 % equals the 97.6 % majority baseline, with one negative, and that negative is a truth error. It needs a set with dark frames before Jev can own it. |
| Stone bands, basement, dormer | No: below baseline | Not usable as asked. Each needs a reworded question first (for example, "a separate window in the roof slope, not inside a gable"). |
| Door box | Promising | 13 of 13 under a loose criterion. The guard says "door present" on only 42 % of crops. |

**Review-lane size at these thresholds, per 50 fronts:**

- Gable: about 29 to review.
- Finish: about 20.
- Shopfront: about 11.
- Bays exact: about 9; bays ±1: about 1.

A front goes to review if any of its fields does: about 70 % of fronts, driven by gable and finish.

**City projection (192,567 BAG pands in `coverage-v1`):**

| | Cost | Runtime |
|---|---|---|
| One run | $59 | about 5.4 h at concurrency 4 (0.1 s per front measured) |
| Two runs (the drift rule) | $119 | about 11 h |

- Dropping the five reference images (word-form bays only) should cut tokens about 5×. The per-image token count
  is not documented; at about 1,200 tokens per image, the city would cost about $12 per run.
- Rate limits are untested at this scale.
- **The real bottleneck is crops, not Jev:** only about 226 rectified strips are archived (about 360 usable houses),
  and a city run needs a crop pipeline first.

## Caveats

- The truth is hand-authored but imperfect. Example 2 is a truth error. Kit dormers count only `dormers`/`tower`, and
  type crowns can name variants loosely.
- Register truth exists for 9 fronts only. Register "no mention" is treated as unknown, not as "no".
- No canal-house front had both kit and register truth, so the two sources could not be compared.
- Drift is small (0–6 %); both runs agreed on most answers.
- Raw responses (request JSON without image bytes and without headers, plus the response body) are in
  `map-recall2-source-data` `experiments/jev-facades-20261110/` on branch `lane/j1-jev-facades-20261110`.
  Scores: `public/data/extracts/amsterdam/staging/jev-facades-20261110/scores.json` (gitignored staging; a copy is archived beside the raw responses as `scores.json`).
