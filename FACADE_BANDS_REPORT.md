# Facade ground-floor detection: three passes, and what they actually established

A short, self-contained account of the `facadeBands` work — what was tried, what
the numbers were, and what the next pass should *not* repeat. Written so a fresh
reader can pick up the thread without the session history.

## The question

Amsterdam buildings mostly have a differently coloured ground floor: a shopfront,
a rendered plinth, a stone base. On a reviewed sample of 46 buildings whose base
was visible, **36 differed from the wall above and 10 matched**. A single wall
colour per building is therefore wrong for four in five buildings, and wrong
exactly at eye level. `facadeBands.ts` is meant to turn that into data: does a
facade have a differently coloured ground floor, where does the change happen,
and what are the two colours.

The ground floor is also the most occluded part of a crop — 12 of 60 bases were
behind a parked van, car or tree — so "indeterminate" is a first-class answer,
not a failure.

## What was measured, against the gold set

`review-data/wall-colour-gold/v1/vision-labels.json`, 60 hand-labelled crops,
`groundFloor` of `differs | same | obscured | unusable`. The module is run over
the real crops and masks. "Strict" counts a `differs` correctly found plus a
`same` correctly left alone, out of 46.

| pass | commit | differs found | same correct | obscured abstained | strict |
| --- | --- | --- | --- | --- | --- |
| one | `cd4634a` | 1/36 | 10/10 | 0/12 | **11/46** |
| two | `b823966` | 8/36 | 3/10 | 11/12 | 11/46 |
| three (diagnostic, not committed) | — | 0/36 | 6/10 | 11/12 | 6/46 |

Pass one's 11/46 was a fluke of the metric: it got the `same` set right by
answering `one-tone` to almost everything, and the `differs` set wrong. Pass two
traded that away and fixed occlusion. Pass three did not beat either and was not
merged.

## The three specification errors, in order

1. **Per-band `dominantWallColour` cannot see a shopfront.** That module finds
   *masonry*; it rejects blue glass and near-white joinery by design. A glass or
   painted shopfront is exactly those materials, so the band collapsed back to
   the brick above it and read one-tone. Fixed in pass two: bands compare on the
   **raw median colour** of their building pixels, with no material rejection.

2. **A binary building mask cannot express occlusion.** The mask producer
   collapsed the Vistas label map to `building == 2` and discarded the occluder
   class. Read with the full label map, occluder fraction in the lowest part of
   the facade does separate the classes. Fixed in pass two: `facadeBands` takes
   the label image, extends the facade span down through occluder-only rows, and
   abstains when the base window is mostly occluder. That is the whole of pass
   two's gain: obscured abstention went 0/12 → 11/12.

3. **The split objective was wrong.** Both pass one and pass two returned the
   *largest colour step* on the facade, which on Amsterdam buildings is a cornice
   or storey line at 0.75–0.83 height, not the shopfront. `differs` and `same`
   crops peaked in the same place, which is the proof it was not reading the
   building. No threshold fixes an objective error.

## Pass three: the one-sided test is not the fix either

The hypothesis was that a ground floor is not "where the biggest change is" but
"the bottom region whose material is unlike the rest of the building", tested
one-sided against the upper wall, and searched in **metres** not crop fractions.
The metric frame (`baseZ`, `topZ`, `groundNAP`, `metresPerPixel`) was added to
all 598 entries for this (`69aba4c`), and it is sound: `baseZ` maps to 0 m,
`metresPerPixel` is uniform at 0.0222, the plane spans 12.3–22.0 m.

The test still fails, and it fails for a reason the original evidence already
predicted. Measured as base-to-upper-wall colour distance, normalised by the
within-wall variation, over the 46 labels:

| gold label | n | p25 | median | p75 | max |
| --- | --- | --- | --- | --- | --- |
| `differs` | 36 | 1.75 | **2.12** | 3.25 | 6.67 |
| `same` | 10 | 1.61 | **2.17** | 2.52 | 3.56 |

The two distributions are the same. The best possible threshold detects 36 of 36
differing bases while keeping **0 of 10** matching ones. It is detecting "the
base is not the wall above it", which fact 4 says is true of 78% of buildings —
not "the base is a different material". A band-mean version of the same statistic
looked like 31/36 until the `same` set was scored, at which point it was clear it
was recovering the same artefact.

Two mechanics that made it worse in the module:

- **The wall reference is not always above the ground floor.** Lauriergracht 74 is
  cream from 18 m down to 3 m with one darker band at the pavement. The 8–16 m
  "wall" is the cream, so the base reads as unlike it with no persistent run. On a
  mostly-painted facade the wall must be chosen by coherence, not by height.
- **A crop can start above the shopfront.** With `baseZ = 3`, the bottom of the
  crop is at 3 m — *inside* the 2–6.5 m search window. A metric search that treats
  the crop base as the pavement will return a plinth at 5.5 m as a shopfront. This
  trap is pinned in the regression test.

## What pass four should do, if this is worth another pass

The metric frame is still the right tool; the statistic is wrong.

- **Test a local change-point *within* the 2–6.5 m window**, not a distance to a
  wall that is partly the thing under test. A ground-floor boundary is a sharp
  step in a step profile; a `same` facade's base is a gradual drift or a single
  noisy band. Normalise by the local variation around the candidate step.
- **Choose the wall reference by coherence, not by a fixed height band**, or
  compare like with like (lower window against upper window) rather than against
  a presumed masonry band.
- **Do not re-run the raw-distance-to-wall test.** It cannot separate the classes;
  that is measured, not assumed.

Still open outside the colour question: the occluder class cannot tell a van *in
front of* a shopfront from a tree *beside* one. That is 4 of the 10 `same` crops
abstaining, and it needs a wall-versus-not-wall notion or a crop tight to a single
frontage — not another threshold.

## The artifacts

- `src/canalRecall/facade/facadeBands.ts` — the module; pass two (`b823966`) is
  the current committed version.
- `src/canalRecall/facade/facadeBands.test.ts` — 41 synthetic assertions, of
  which the last block is a **regression corpus**: the high cornice (never a
  ground floor), the cut-shopfront frame arithmetic and its trap, and the
  rows-to-metres conversion. These assert current behaviour, not aspiration.
- `FACADE_APPEARANCE_HANDOFF.md` — the living brief, with the full pass-one,
  pass-two and pass-three record and the scoring method.
- `review-data/wall-colour-gold/v1/vision-labels.json` — the 60-label gold set.

Nothing here is committed to `main`; this is on `feat/amsterdam-facade-rebuild`.
