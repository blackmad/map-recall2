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
