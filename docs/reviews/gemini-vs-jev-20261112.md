# Gemini Decision 1 vs Jev, on the J2 fixtures (lane J3, #377), 2026-11-12

Question from the user: is `gemini-decision-1` better than Jev for our crops ("I bet it's trained on all of google maps")? Same crops, same questions, same hand
labels as J2 (`docs/reviews/jev-capabilities-j2-20261110.md`); only the backend changes. Backend: `scripts/jev/j2/gemini.mjs` (plain fetch, no SDK, no new
dependency), selected with `run-family.mjs --backend=gemini --variant=img|addr --resolution=medium|high`; `score.mjs` now takes `--r1 --r2 --out`; `bake.mjs`
builds the tables below. Raw responses stay in the local cache (`.cache/jev-j2/runs/*/g-*`); the integrator can archive them to the source-data repo.

## Read this first

- **Gemini is not better than Jev overall, and the Google Maps hypothesis is not supported.** Adding the BAG address and buurt moved accuracy by at most 0.04 in any
  question (mostly 0.00) and did not raise confidence on wrong answers. Gemini reads the pixels, like Jev.
- **Gemini is more conservative.** It says "no" far more often: white bands found 3 of 12 (0 false), white surrounds 1 of 23, basement 0 of 1. Its higher accuracy on
  bands and basement is the majority-class baseline, not skill. Where Jev over-calls (balcony, branches, trunk, cornice) Gemini has fewer false positives and finds
  nearly as many positives, so it wins there.
- **Single run per Gemini cell** (Jev numbers are J2 run 1). Jev's J2 run agreement was 0.94-1.0, so this costs little, but the Gemini "agree" column in score
  files is trivially 1 and is not meaningful.
- **Tier and throttle.** Run on the free tier per the user's amendment, throttled to 40k tokens/min and 150 requests/min (limits: 50k TPM, 200 RPM). 65 HTTP 429s were
  recorded (`gemini-429.json`, mostly at start-up of each family before the token window warmed), each waited out and retried; none failed a run. The whole job took
  about 55 minutes, so the 2 h switch to the paid key was never needed. No paid-tier calls were made on purpose; I cannot see from the key whether the account is
  free or paid, so the dollars below are **list price** ($0.10 per M tokens) and the actual charge is $0 if the key is on the free tier.
- **Not run:** hand-set storeys and finish have no fixtures in `scripts/jev/j2/fixtures/` (they were never J2 families), so there is nothing to compare.
  **Likeness is effectively untested:** the archived render sources for 27 of the 28 triples (`house-bays24-20261110`) have been pruned, so only 1 triple could be
  rebuilt; the J2 "decoy picked 11 of 28" result cannot be re-run here. Re-run `run-family.mjs --fixture=likeness|likeness2 --backend=gemini` when the renders are
  regenerated (`build-triples.mjs`). In the one triple both backends picked the spec render and rejected the decoy.
- 143 pands had a BAG lookup; 126 got an address line, 17 had none (those ran with the buurt-free image-only text).

## Results

### Main table (single run per cell; Jev = J2 run 1)

| Family / question | n | Jev acc | Jev wrong-conf | G img acc | G img wrong-conf | G +addr acc | G +addr wrong-conf | baseline |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| colour/wall_colour | 48/48/48 | 0.71 | 0.70 (14) | 0.69 | 0.53 (15) | 0.69 | 0.53 (15) | 0.42 |
| head/upper_head | 48/48/48 | 0.96 | 0.48 (2) | 0.83 | 0.66 (8) | 0.88 | 0.71 (6) | 0.88 |
| head/arch_present | 48/48/48 | 0.94 | 0.79 (3) | 0.92 | 0.68 (4) | 0.94 | 0.77 (3) | 0.88 |
| white/bands | 48/48/48 | 0.50 | 0.70 (24) | 0.81 | 0.77 (9) | 0.81 | 0.78 (9) | 0.75 |
| white/surrounds | 48/48/48 | 0.60 | 0.73 (19) | 0.54 | 0.79 (22) | 0.54 | 0.79 (22) | 0.52 |
| white/cornice | 48/48/48 | 0.81 | 0.75 (9) | 0.90 | 0.76 (5) | 0.92 | 0.81 (4) | 0.75 |
| occlusion/van | 72/72/72 | 0.94 | 0.65 (4) | 0.96 | 0.77 (3) | 0.94 | 0.74 (4) | 0.92 |
| occlusion/trunk | 72/72/72 | 0.79 | 0.81 (15) | 0.89 | 0.75 (8) | 0.89 | 0.75 (8) | 0.97 |
| occlusion/branches | 72/72/72 | 0.81 | 0.75 (14) | 0.92 | 0.64 (6) | 0.90 | 0.62 (7) | 0.79 |
| occlusion/scaffold | 72/72/72 | 1.00 | n/a (0) | 0.99 | 0.68 (1) | 0.99 | 0.55 (1) | 1.00 |
| occlusion/boat | 72/72/72 | 0.97 | 0.61 (2) | 1.00 | n/a (0) | 1.00 | n/a (0) | 1.00 |
| features/stoop | 48/48/48 | 0.94 | 0.58 (3) | 0.94 | 0.62 (3) | 0.92 | 0.64 (4) | 0.88 |
| features/balcony | 48/48/48 | 0.73 | 0.69 (13) | 0.92 | 0.76 (4) | 0.92 | 0.74 (4) | 0.88 |
| dormer_basement/dormer | 41/41/41 | 0.81 | 0.60 (8) | 0.83 | 0.64 (7) | 0.85 | 0.61 (6) | 0.61 |
| dormer_basement/basement | 41/41/41 | 0.81 | 0.59 (8) | 0.98 | 0.73 (1) | 0.98 | 0.74 (1) | 0.98 |
| dormer_basement/stoop | 41/41/41 | 0.93 | 0.69 (3) | 0.93 | 0.75 (3) | 0.93 | 0.79 (3) | 0.98 |
| white2/bands | 48/48/48 | 0.77 | 0.69 (11) | 0.79 | 0.83 (10) | 0.79 | 0.83 (10) | 0.75 |
| white2/surrounds | 48/48/48 | 0.67 | 0.63 (16) | 0.54 | 0.81 (22) | 0.54 | 0.81 (22) | 0.52 |
| white2/balcony | 48/48/48 | 0.96 | 0.63 (2) | 0.96 | 0.71 (2) | 0.96 | 0.70 (2) | 0.88 |
| colour_words/wall_colour | 48/48/48 | 0.75 | 0.76 (12) | 0.71 | 0.57 (14) | 0.67 | 0.55 (16) | 0.42 |
| gable_noref/gable | 50/50/50 | 0.68 | 0.50 (16) | 0.58 | 0.47 (21) | 0.60 | 0.48 (20) | 0.42 |
| gable_crown/gable | 50/50/50 | 0.48 | 0.41 (26) | 0.56 | 0.49 (22) | 0.58 | 0.49 (21) | 0.42 |

### Cost per family (list price; mean tokens per call; $ for the run of that family)

| Family | calls | Jev tok/call | Jev $ | G img tok/call | G img $ | G +addr tok/call | G +addr $ |
|---|---:|---:|---:|---:|---:|---:|---:|
| colour | 48/48/48 | 6131 | 0.0124 | 5194 | 0.0249 | 5210 | 0.0250 |
| head | 48/48/48 | 1663 | 0.0034 | 990 | 0.0048 | 1006 | 0.0048 |
| white | 48/48/48 | 1696 | 0.0034 | 1179 | 0.0057 | 1195 | 0.0057 |
| occlusion | 72/72/72 | 1689 | 0.0051 | 1040 | 0.0075 | 1058 | 0.0076 |
| features | 48/48/48 | 1848 | 0.0037 | 1264 | 0.0061 | 1280 | 0.0061 |
| dormer_basement | 50/50/50 | 1546 | 0.0032 | 950 | 0.0047 | 970 | 0.0048 |
| white2 | 48/48/48 | 1534 | 0.0031 | 1014 | 0.0049 | 1030 | 0.0049 |
| colour_words | 48/48/48 | 1513 | 0.0031 | 845 | 0.0041 | 861 | 0.0041 |
| gable_noref | 50/50/50 | 1542 | 0.0032 | 839 | 0.0042 | 859 | 0.0043 |
| gable_crown | 50/50/50 | 1030 | 0.0022 | 848 | 0.0042 | 868 | 0.0043 |
| **total** | | | 0.0428 | | 0.0710 | | 0.0719 |

### Latency (ms, per call, all families)

| Backend | n | p50 | p95 |
|---|---:|---:|---:|
| Jev (J2 run 1; concurrency 4) | 510 | 233 | 380 |
| Gemini image-only (concurrency 4, throttled) | 510 | 559 | 1067 |
| Gemini +address | 510 | 582 | 1165 |

### Years (cross-year pairs; single run)

| Backend | same_building | same_shopfront | decoy same_paint mean (lower is better) |
|---|---|---|---|
| jev | 23/24 | 8/8 | 0.37 |
| img | 23/24 | 7/8 | 0.33 |
| addr | 23/24 | 7/8 | 0.30 |

### Likeness (only the triples whose archived renders still exist; same subset for every backend)

| Backend | triples | best-of-three: today / spec / decoy picked | mean 1-5 score today / spec / decoy | says "same" true renders | says "same" decoys |
|---|---:|---|---|---|---|
| jev | 1 | 0 / 1 / 0 | 3.00 / 3.00 / 1.00 | 2/2 | 0/1 |
| img | 1 | 0 / 1 / 0 | 5.00 / 5.00 / 1.00 | 2/2 | 0/1 |
| addr | 1 | 0 / 1 / 0 | 5.00 / 5.00 / 1.00 | 2/2 | 0/1 |

### Resolution medium vs high (image-only)

| Family | res | tokens/call | $/1k calls | accuracy (all questions, mean) | per-question acc |
|---|---|---:|---:|---:|---|
| white | medium | 1179 | 0.118 | 0.750 | bands 0.81, surrounds 0.54, cornice 0.90 |
| white | high | 1725 | 0.172 | 0.736 | bands 0.79, surrounds 0.52, cornice 0.90 |
| head | medium | 990 | 0.099 | 0.875 | upper_head 0.83, arch_present 0.92 |
| head | high | 1536 | 0.154 | 0.917 | upper_head 0.90, arch_present 0.94 |

### Recall probe: facade questions asked on marginal and bad (occluded or uninformative) crops, mean confidence and share of answers at confidence >= 0.8

| Family | variant | crop class | answers | mean conf | share >= 0.8 |
|---|---|---|---:|---:|---:|
| white_B | img | marginal | 60 | 0.76 | 0.48 |
| white_B | img | bad | 60 | 0.76 | 0.33 |
| white_B | addr | marginal | 60 | 0.77 | 0.53 |
| white_B | addr | bad | 60 | 0.78 | 0.43 |
| colour_words_B | img | marginal | 12 | 0.60 | 0.08 |
| colour_words_B | img | bad | 12 | 0.61 | 0.08 |
| colour_words_B | addr | marginal | 12 | 0.58 | 0.08 |
| colour_words_B | addr | bad | 12 | 0.60 | 0.08 |
| head_B | img | marginal | 36 | 0.79 | 0.58 |
| head_B | img | bad | 36 | 0.80 | 0.56 |
| head_B | addr | marginal | 36 | 0.81 | 0.58 |
| head_B | addr | bad | 36 | 0.82 | 0.58 |


Notes on the tables. `n` is Jev/Gemini/+addr. "wrong-conf" is the mean confidence on wrong answers (lower is better calibrated), with the count of wrong answers in brackets.
Cost is $ for the whole family run (one call per crop, all that family's questions in one request), not per answer. Jev $ uses Jev's own token counts at $0.042/M.
Jev latency is from the J2 run at concurrency 4; Gemini latency was measured under the throttle (concurrency 4), 429-retried calls are timed on the final attempt only.

## Callouts on the families where Jev failed

| Failure | Jev (J2) | Gemini image-only | Verdict |
|---|---|---|---|
| White bands (original / reworded wording) | 0.50 / 0.77, finds 7 / 4 of 12 with 19 / 3 false | 0.81 / 0.79, finds 3 / 2 of 12 with 0 false | Neither. Gemini is precise but misses 75-85 %. Not a stored-fact source. Use as a "definitely yes" signal only (3 of 12, 0 false). |
| White surrounds | 0.60 / 0.67 | 0.54 / 0.54, finds 1 of 23 | Gemini is worse (below the 0.52 baseline). Neither. |
| Basement | 0.81, 8 false of 40 | 0.98, finds 0 of 1 | No real signal either way: one positive in the set. Gemini's 0.98 equals the baseline; its 1 false-positive count is 0 vs Jev's 8, so Gemini is safer as a negative filter. |
| Likeness, decoy picked | 11 of 28 | not testable (1 triple reachable) | Open. |
| Crown-only gable | 0.48 (baseline 0.42) | 0.56 / 0.58 (+addr) | Both barely above baseline. Not usable. |
| Reference-free gable | 0.68 | 0.58 / 0.60 | Jev better. |
| Cornice (white, canal-house top) | 0.81, finds 11 of 12, 8 false | 0.90 / 0.92, finds 11 of 12, 4 / 3 false | Gemini better: same recall, half the false positives. |
| Balcony original wording | 0.73, 13 false | 0.92, 4 false | Gemini better; reworded wording is a tie (0.96 both). |
| Trunk / branches | 0.79 / 0.81, 15 / 14 false | 0.89 / 0.92, 8 / 4 false | Gemini better (branches finds 13 of 15). |

## Google Maps hypothesis: image-only vs image + address and buurt

Delta (+addr minus image-only) in accuracy, per question: head upper_head +0.04 (6 wrong vs 8), white cornice +0.02, dormer +0.02, gable_noref +0.02, gable_crown +0.02,
colour_words -0.04 (14 -> 16 wrong), occlusion trunk/van/branches -0.02 to 0, features stoop -0.02, every other question 0.00. Years: same_building 23/24 both,
same_shopfront 7/8 both. Nothing exceeds three crops of 48, i.e. it is noise. Confidence on wrong answers is unchanged (+0.00 to +0.05).
Total tokens rose 1.6 % (the address line). Verdict: the address gives Gemini no usable recall of the building on these crops.

**Recall-versus-reading check** (facade questions asked of the 12 marginal and 12 bad AB07 crops, using white, colour_words and head fixtures re-pointed at set B; see the last table):
Gemini answers at confidence >= 0.8 on 33-58 % of answers on the bad (occluded or uninformative) crops, nearly the same as on the marginal ones, with or without the address
(white: 33 % image-only, 43 % +addr on bad crops; head: 56-58 %). Colour words stays hedged (8 % confident) either way. So **the confident-on-uninformative behaviour exists
without the address** (it is over-confidence, not Maps recall), but the address slightly raises the confident share for white (+10 points on bad crops). Nothing was stored.
Flag: any Gemini yes/no on white or head facts for a crop the occlusion flags call bad must be ignored. No Jev run exists on set B for these questions to compare.

## Image resolution (image-only, white and head families)

Medium vs high: tokens per call 1179 -> 1725 (white) and 990 -> 1536 (head), +46-55 %, which is $0.118 -> $0.172 and $0.099 -> $0.154 per 1k calls. Accuracy: white 0.750
-> 0.736 (cornice unchanged, bands -0.02, surrounds -0.02), head 0.875 -> 0.917 (upper_head 0.83 -> 0.90). High helps only the window-head question and costs half again as much;
medium is the default. If head heads are wanted from Gemini, ask them at high.

## Cost and latency (details in the tables)

- List price for the same 510 calls: Jev $0.043, Gemini $0.071 image-only, $0.072 +addr. Gemini images are cheaper in tokens (about 1000 per call vs about 1600 for Jev)
  but cost 2.4x per token. Colour with eight swatches is the expensive family on both (5,200 tokens Gemini, 6,100 Jev). On the free tier Gemini was $0.
- Latency per call: Jev p50 233 ms, p95 380 ms; Gemini p50 559 ms, p95 1067 ms (+addr 582 / 1165). Gemini is about 2.4x slower per call and, on the free tier, capped at roughly 30-45 calls a minute.

## Recommendation per family

| Family | Recommendation |
|---|---|
| Wall colour (swatches / words) | Keep Jev. Accuracy ties (0.71 / 0.75 vs 0.69 / 0.71) but Gemini hedges on 79 % of answers; a vote adds nothing. |
| Window head (flat/segmental/round) | Keep Jev (0.96 vs 0.83, 0.88 +addr). Arch yes/no is a tie; Gemini at high resolution reached 0.90, worth a vote only if arches become a priority. |
| White bands, surrounds | Neither. Gemini as a high-precision "yes" only (bands 3 of 12, 0 false); do not use "no" from either. |
| White cornice | Switch to Gemini, or use both as a vote: both found 11 of 12 and agreement should remove most of the 8 Jev false positives. |
| Occlusion (van, trunk, branches, scaffold, boat) | Switch to Gemini for trunk and branches (fewer false positives, same recall); van is a tie, keep either. |
| Stoop | Tie; keep Jev. |
| Balcony (reworded wording) | Tie (0.96 both); use both as a vote for precision. Do not use the original wording on Jev. |
| Dormer (reworded) | Vote: Gemini has 0 false positives and finds 9-10 of 16, Jev finds 10 with 2 false. |
| Basement | Neither as a positive; Gemini is the safer negative filter (0 false vs 8) but the set has one positive. |
| Gable (reference-free) | Keep Jev (0.68 vs 0.58). Crown-only: neither. |
| Same building / shopfront across years | Tie (23 of 24; 8 vs 7 of 8 shopfront). Keep Jev (cheaper, faster). |
| Likeness | Unresolved here; re-test when render sources exist. Do not switch on the one-triple result. |

## Reproduce

```
zsh -lic 'node scripts/jev/j2/context.mjs'            # BAG address + buurt lines (public API, no key)
zsh -lic 'node scripts/jev/j2/run-family.mjs --fixture=white --backend=gemini --variant=img  --run=g-img-medium'
zsh -lic 'node scripts/jev/j2/run-family.mjs --fixture=white --backend=gemini --variant=addr --run=g-addr-medium'
node scripts/jev/j2/score.mjs --r1=g-img-medium --r2=g-img-medium --out=scores-gimg.json && node scripts/jev/j2/bake.mjs
```

The J2 cache was rebuilt from `map-recall2-source-data` branch `lane/j2-jev-capabilities-20261110` (Jev responses, sets, pairs, triples) and the `map-recall2-source-data-h5h`
pand-crops; `build-sets.mjs --archive=/Users/blackmad/Code/map-recall2-source-data-h5h` regenerates the crops. The Jev scores reproduced the J2 report exactly.
Dependencies needed: none. Total list-price spend $0.18 (ledger); paid-tier spend $0 on purpose.
