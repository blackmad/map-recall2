# Handoff: facade appearance measurement

You are picking up work on **Canal Recall**, a 3D Amsterdam cycling game that teaches geography.
This document is self-contained. Read it fully before touching anything; it exists so you do not
re-derive things that have already been measured, or re-open questions that are settled.

Repository: `/Users/blackmad/Code/map-recall2`, worktree `.worktrees/amsterdam-facade-rebuild`,
branch `feat/amsterdam-facade-rebuild`.

---

## 0. Operating rules

- **Use `/usr/bin/git`, never plain `git`.** A shell wrapper (`scm_breeze`) mangles output.
- Work in your own git worktree on your own branch. Do not work directly in another agent's tree.
- `npx tsc --noEmit` must pass before you commit. Tests are plain `assert` scripts run with
  `npx tsx <file>`; they print a passing-assertion count at the end. Match that style.
- Do not modify `package.json`, lockfiles, `TODO.md`, `HISTORY.md`, generated bundles, or
  `public/data/**` releases. Those belong to the integrating agent. Report a commit SHA instead.
- End commit messages with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- **If you are asked to look at an image, look at it.** Do not write a script that computes a
  histogram and present the result as if you had looked. Two previous attempts did exactly that, and
  a third hung for twenty minutes producing nothing. If you cannot actually see an image, say so
  plainly and stop — a fabricated visual judgement is worse than no answer.

---

## 1. What this is about

The game renders ~343,000 buildings. Almost all are flat-topped extruded footprints with an invented
hash-seeded colour. The goal is to make the city *recognisably Amsterdam* using measured evidence:
real wall colours, real signage, real roof shapes.

The owner's rule: **only ship what is measured.** Nothing invented may render on a real addressed
building. Measurement comes from rectified panorama crops of real facades.

Target area: `da-costa-jordaan-v1` (Da Costabuurt + Jordaan), 7,395 buildings, 598 observations with
crops on disk. It is the one district where the rich render layers already draw.

---

## 2. Settled facts — do not re-derive these

Each of these was measured, not assumed. Re-opening them wastes days.

1. **The renderer never drew measured evidence.** `scripts/city-appearance/publish-area-geometry-demo.ts:107`
   coloured all 7,395 buildings from `contextualBuildingPalette(id, year)` and never read the 598
   observations that exist for those same buildings.

2. **No acceptance state existed anywhere.** Every `appearancePublication` value ever written was a
   refusal. This is now fixed: `src/canalRecall/facade/appearancePublication.ts` adds
   `accepted-human-reviewed` and `resolvePublication`, which binds a grade to the crop's
   `sourceSha256` and *demotes* on mismatch. Do not weaken that binding — re-measuring must
   invalidate grades, never inherit them.

3. **A luma percentile over a whole crop is not a wall colour.** A facade is roughly half masonry,
   a third blue-reflecting glass, a tenth pale trim. The percentile lands between them: a red-brown
   brick wall measured `#3f6b6e` (teal). Fixed by masking with Mapillary-Vistas segmentation and
   taking a dominant colour cluster (`src/canalRecall/facade/dominantWallColour.ts`).

4. **78% of buildings have a differently coloured ground floor.** Of 46 sampled buildings whose base
   was visible, 36 differ and 10 match. Shopfronts, rendered plinths, stone bases. A single colour
   per building is wrong for most buildings, and wrong exactly at eye level.
   Gold set: `review-data/wall-colour-gold/v1/vision-labels.json` (60 labels).

5. **The ground floor is also the most occluded part.** 12 of 60 bases were hidden by a parked van,
   car or tree. Any ground-floor measurement must abstain loudly rather than silently falling back
   to the upper wall.

6. **Perceived colour and pixel colour differ by ~50 RGB units, and that is not a bug.** Seven pixel
   statistics were fitted against eye-judged hexes; every one sat ~50 units away, including a plain
   mean of the building pixels. This is colour constancy — a human (or a vision model) discounts the
   illuminant and reads brick against white trim as redder than its raw RGB. **Therefore: use vision
   to classify material and to spot a change of material. Do not use vision to name a hex, and do
   not tune a pixel estimator to match an eye-judged hex.**

7. **Campaigns are not colour-comparable.** Mean (blue − red) on building pixels: −15.7 (2022),
   −12.0 (2023), −24.7 (2024), −2.4 (2025). The same wall measures differently by capture year.

8. **Two dead ends, already measured and killed.** The trim-rejection threshold is *not* what makes
   pale walls read dark (a cream wall is lightness 0.67, far below the 0.86 threshold). Neighbourhood
   averaging is *not* the source of desaturation (removing it moved the median error from 55 to 61,
   i.e. slightly worse). Do not retry either.

---

## 3. The task: `facadeBands.ts`

Build `src/canalRecall/facade/facadeBands.ts` and `facadeBands.test.ts`.

**Purpose:** find whether a facade has a differently coloured ground floor, where the change happens,
and what the two colours are. This is the module that turns fact (4) above into data.

**Input:** an `RgbImage` (interface exported by `wallColourSample.ts`), an optional per-pixel mask
(non-zero = usable; this is a segmentation mask where sky, trees and vehicles are already zero), and
an options object.

**Method, in this order:**

1. **Band the building's vertical extent, not the crop's.** The crop contains sky above and pavement
   below. Find the first and last rows holding more than a documented minimum of usable pixels, and
   band only that span. A span too short to divide returns `null`, not a guess.

2. **Divide into N horizontal bands** (default ~12, tunable). Per band report: row range, height
   fraction (0 = building base, 1 = top), usable pixel count, and dominant colour. **Reuse
   `dominantWallColour` per band** by passing a mask restricted to that band. Do not reimplement
   colour finding. A band with too few usable pixels reports `null` colour.

3. **Find the best split.** Scan candidate split positions, skipping the top 15% (that is a cornice
   or gable, not a ground floor) and the bottom 5% (pavement edge). For each, compute the colour
   distance between the mean of bands below and the mean above. Take the maximum.

4. **Decide honestly.** Report two-tone only when *all* hold, each a documented option:
   - the below/above distance exceeds a minimum;
   - it is substantially larger than the typical band-to-band variation *within* each group, so a
     facade that merely darkens with shadow is not called two-tone;
   - the split sits low enough to be a ground floor — a split at 60% height is reported but labelled
     as something else;
   - both sides hold enough bands and enough pixels to mean anything.

5. **Return:** the band profile; the split as both a height fraction and an image row; colour and
   material family per side; the distance; and a verdict of
   `one-tone | two-tone-ground-floor | two-tone-other | indeterminate` with a short reason.
   `indeterminate` is a first-class answer — a facade behind a van should say so, not guess.

**Tests** (synthetic images, no I/O, no network), covering at least:
- uniform facade → `one-tone`, no split
- cream lower quarter over brick → `two-tone-ground-floor`, split within tolerance, both colours recovered
- same change at 60% height → `two-tone-other`, not a ground floor
- smooth top-to-bottom darkening with no material change → `one-tone`
- mask excluding the lower half (van across the shopfront) → `indeterminate`, not a confident one-tone
- span too short → `null`
- band height fractions ordered, 0 at base and 1 at top

**Constraints:** pure logic, no I/O, no network, no new dependencies, no image decoding. Add two new
files only; modify nothing existing. Match the surrounding files' prose-heavy comment style — they
explain *why*, including why a gradient is not a two-tone facade.

---

## 3a. First pass result, and the two things the spec above got wrong

A first implementation of §3 was built and scored honestly. **It does not work on the district's
crops: 11 of 46.** Specifically: 1 of 36 `differs` detected, 10 of 10 `same` correct, 0 of 12
`obscured` abstained. Both failures trace to errors in the specification above, not to the
implementation. Fix these before rebuilding.

**Error 1 — do not reuse `dominantWallColour` per band.** That module exists to find *masonry*, and
it rejects blue/reflecting glass and near-white joinery by design. A glass or painted shopfront under
a brick wall is therefore thrown away, and the band collapses back to the upper wall's brick, which
reads as one-tone. That is precisely the 36-building population the module is supposed to find.

Instead: compare bands on **raw colour statistics of whatever is actually there** — the whole usable
population per band, with no masonry rejection — because the question is "does the lower facade
differ from the upper", not "what masonry is each band". Classify material only *after* a split is
found, and only on the side where it makes sense. A shopfront is defined by not being the upper wall.

**Error 2 — the mask handed over was binary, and threw the answer away.**
`scripts/facade-eval/measure-wall-colour.ts` collapses the segmentation to `building == 2`, so the
occluder class was invisible. Read the **full Vistas label map** instead (`0` other, `1` sky,
`2` building, `3` occluder — vegetation, vehicle, person, `255` unknown). Measured over the gold set,
occluder fraction in the lowest 28% of the building span separates the classes:

| gold label | n | median occluder fraction |
| --- | --- | --- |
| `obscured` | 12 | **0.333** |
| `same` | 10 | 0.107 |
| `differs` | 36 | 0.086 |

A threshold needs fitting (0.15 catches 10 of 12 obscured but also 15 of 46 others), but the signal
is real. Abstention should be driven by this, not inferred from coverage ratios.

**Also weak, per the first pass:** the within-side variation gate rejects true two-tones, because the
variation it measures includes windows and shadow. On Rozengracht 38 the genuine split is 37.3
against a within-side spread of 45.9. Compare against a *smoothed* band-to-band step, or use a proper
change-point statistic, rather than raw spread.

**Known-hard cases to expect and report rather than paper over:** crops straddling two abutting
houses (band means mix neighbours); a single-band rendered plinth (too thin for a minimum-bands
rule); and the argmax split landing on a near-top roof/shadow line around 0.83 instead of the
shopfront.

## 3b. Pass two, and the actual task for pass three

Pass two (`b823966`) fixed the occlusion half — 11 of 12 obscured bases now abstain, against 0 before
— and left the ground-floor half unchanged at 8 of 36. Raw band colour did work as intended (a glass
shopfront under brick is now visible where pass one measured one-tone). The remaining failure is
single and was correctly identified: **the split objective is wrong.**

Both `differs` and `same` crops peak at 0.75–0.83 height, on a cornice, storey line or roof line.
Asking for the largest colour step gets you the highest-contrast line on the building, which on
Amsterdam facades is almost never the shopfront. A threshold sweep cannot fix an objective error, and
the sweep confirmed it: the whole family sits on one trade-off line with nothing above 11 strict.

Pass three should change two things, and neither is a smoother:

1. **Test against the upper wall, one-sided — do not look for a symmetric change-point.** A ground
   floor is not "where the biggest change is"; it is "the bottom region whose material is unlike the
   rest of the building". Establish the upper-wall colour from the top ~60% of the span, which is
   reliably masonry, then scan upward from the base for the highest row below which the colour stays
   persistently unlike it. A cornice does not satisfy that test, because the material above *and*
   below it is the same brick.

2. **Search in metres, not image fractions.** The observation carries `height`, `groundNAP` and the
   crop's plane `baseZ`/`topZ`, so image rows convert to metres above ground. An Amsterdam shopfront
   boundary sits roughly 2.5–6 m above pavement almost without exception; a five-storey building's
   fascia is at a completely different image fraction from a two-storey one's, which is why a
   fractional window fails across the mix. This is an architectural prior grounded in the data we
   already carry, not a tuning constant.

Also unresolved and worth stating plainly: the occluder class cannot tell a van *in front of* a
shopfront from a tree *beside* one, which is what the 14 false abstentions are. That needs a
wall-versus-not-wall notion or a crop tight to a single frontage, not another threshold.

## 3c. Pass three result — the one-sided test is not the fix either

Pass three was run against the metric frame and the one-sided test, as a diagnostic rather than a
merge (`b823966` is still the last committed `facadeBands`). The result is negative and worth stating
before anyone spends another pass on the same idea.

**The lower region of every facade differs from the region above it, on `differs` and `same` alike.**
Measured as the ratio of (mean colour distance from the base to 6.5 m, against the upper wall taken
8–16 m up) to (the typical deviation within that upper wall), over the 46 ground-floor labels:

| gold label | n | min | p25 | median | p75 | max |
| --- | --- | --- | --- | --- | --- | --- |
| `differs` | 36 | 1.13 | 1.75 | **2.12** | 3.25 | 6.67 |
| `same` | 10 | 1.22 | 1.61 | **2.17** | 2.52 | 3.56 |

The two distributions are the same. The best possible threshold on this statistic detects 36 of 36
`differs` while keeping 0 of 10 `same` — i.e. it is detecting "the base is not the upper wall", which
is true everywhere, not "the base is a different material". A band-mean version of the same test
looked like 31 of 36 until the `same` set was scored; it was only ever recovering the same artefact.

The reason a corollary of the handoff's own fact (4) predicts it: 78% of buildings differ at the
base, so the ground floor is almost always *some* different surface, and the interesting variable is
not presence but magnitude and persistence. Colour distance to the wall does not carry that.

A secondary failure, which is what made the metric walk collapse to 0 of 36: the "upper wall" is not
always above the ground floor. Lauriergracht 74 is cream from 18 m down to 3 m with one darker band
at the pavement; the wall reference (8–16 m) is the cream, so the base reads as unlike it but with no
persistent run. On a mostly-painted facade the wall reference must be chosen by coherence, not by a
fixed height band.

**What pass four should try instead, if the goal is worth another pass:** the discriminator is not the
distance but its shape — a ground-floor boundary is a *sharp step in a step profile*; a `same`
facade's base is a gradual drift or a single noisy band. The metric frame is still the right tool,
because the step should be located in metres (2–6.5 m) rather than sought as a global maximum. But the
statistic wants to be a change-point *within that window*, normalised by the local variation around
it, not a distance to a wall that is itself partly the thing being tested.

Also still unresolved: the occluder class cannot tell a van in front of a shopfront from a tree
beside one. That is 4 of the 10 `same` crops abstaining and is not a threshold problem.

## 4. How to score it (do this before claiming it works)

The gold set at `review-data/wall-colour-gold/v1/vision-labels.json` has 60 entries keyed by
`observationId`, each with `groundFloor` of `differs | same | obscured | unusable`.

Crops: `public/data/city-expansion/evidence/<sourceSha256>.jpg`
Masks: `.cache/wall-colour/seg/masks/s1/<sourceSha256>.mask.png`, label `2` = building.
Queue with the mapping: `public/data/wall-colour/v1/sample.json` (`sampleIndex` in the gold set
indexes its `entries`).

Run the module over the 46 entries labelled `differs` or `same` and report a confusion matrix.
Report the `obscured` 12 separately: those *should* come back `indeterminate`, and a confident
verdict on them is a failure, not a success.

**Report honestly which of the four two-tone conditions you are least sure of, and what kind of real
Amsterdam facade you expect to misclassify.** An accurate account of the limits is worth more than a
flattering number.

---

## 5. Useful context

- `src/canalRecall/facade/dominantWallColour.ts` — dominant colour cluster (42 assertions)
- `src/canalRecall/facade/wallColourSample.ts` — older percentile sampler; `RgbImage` lives here
- `src/canalRecall/facade/materials.ts` — `wallFamily`, `nearestMaterial`; the one taxonomy
- `src/canalRecall/facade/appearancePublication.ts` — acceptance state and grade binding
- `src/canalRecall/facade/openingLattice.ts` — imputes windows detectors miss, from each storey
  row's own rhythm (a good example of the expected style and abstention behaviour)
- `scripts/facade-eval/measure-wall-colour.ts` — runs the estimators over all 598 observations
- `public/canal-drive/wall-colour-review.html` — the owner's grading desk
- `scripts/roofline-eval/segment.py` — Mapillary-Vistas segmentation; the masks above came from it

### Things that are true about the data and will bite you

- Crops vary hugely in how much of the frame the building occupies; some are distant slivers.
- Some crops straddle two adjacent buildings. Amsterdam houses abut directly and are narrow.
- Bare winter trees survive segmentation more often than they should; at least one crop that is
  mostly branches was scored "reliable". Treat a high building-fraction as necessary, not sufficient.
- `machineRoutingProposal.wallColour` exists in the release data. It is a model's guess and is
  documented as unreliable (it once returned white over a whole red-brick facade). Never publish it;
  carry it only for comparison.
