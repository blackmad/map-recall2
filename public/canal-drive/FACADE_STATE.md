# Façade twin — state of the world

> ## ⚠️ Superseded in its central claim, and worth reading anyway
>
> This document was written on 2026-09-04 and argued that the extraction was
> "not nonsensical — but unvalidated". **That was wrong.** Hours later an
> external audit found a 180° yaw error: Amsterdam's panoramas put the heading
> direction at the *left edge* of the equirectangular frame, the rectifier
> assumed the *centre*, and every street-level measurement therefore sampled
> whatever stood **behind** the survey camera.
>
> All 2,184 buildings and 15,178 openings described below are quarantined in
> `.cache/facade-twin/quarantine-yaw-centre/`. So are the wall colours, the
> material classifications and the six extracted textures, which all derive
> from those crops.
>
> **The massing is unaffected** — footprints, ground, eaves, ridge and roof form
> come from BAG, 3DBAG and AHN and never touched a panorama.
>
> The section below headed *"§1. The honest summary"* is left exactly as
> written, because how it went wrong is the most useful thing in this file. It
> made a case from three independent agreements — median storey height, median
> frontage, storey count against 3DBAG — that all held **while the pipeline was
> photographing the wrong side of the canal**. See §10.
>
> A re-measurement under the corrected convention has landed. **See §11 at the
> bottom for the current numbers** — they are much smaller and much better
> founded than the ones in §1–§9, which describe the tainted run.

Written 2026-09-04, at commit `92d9ad7` on `feat/amsterdam-building-twin`.

This document exists because the question was asked directly: *are these
extractions borderline nonsensical?* The short answer is **no, but they are
unvalidated, and more than half of them fail at least one of my own sanity
checks.** Everything below is measured from the current staged extract. Where I
do not know something, it says so.

Re-derive these numbers rather than trusting this file if it is more than a few
commits old. The commands are at the bottom.

---

## 1. The honest summary

**What is genuinely solid.** Three independent agreements, none of them
engineered, and each one a case where a bug would have shown up loudly:

| Quantity | Detector says | Independent source says | Agreement |
|---|---|---|---|
| Median storey height | **3.00 m** (n=6,639 intervals) | 3.01 m — grammar, from 3DBAG storeys ÷ AHN eaves, n=2,390 | **1 cm** |
| Median frontage | **5.66 m** (n=1,814 walls) | 5.7 m — BAG minimum-area rectangle | **4 cm** |
| Storey count | within ±1 of 3DBAG for **82.7%** | 3DBAG LoD2.2 | mean signed error +0.28 |

These come from different data by different routes — one from photographs, one
from laser altimetry, one from the land registry — and they land on the same
numbers. That is not what a nonsensical pipeline looks like.

**What is genuinely weak.** Also three things, and they matter more than the
above:

1. **Nothing has ever been checked by a human.** Not one façade. Every
   street-level field is capped at confidence 0.4 for exactly this reason, and
   that cap is the only thing standing between this and overclaiming.
2. **Only 41.8% of façades pass every plausibility check.** 1,055 of 1,814 trip
   at least one. That is the single most important number in this document.
3. **Storey count matches 3DBAG exactly only 33.8% of the time.** Being within
   ±1 is good enough to draw a building and not good enough to state a fact.

**So the fair characterisation is:** the aggregate statistics are trustworthy
and the per-building readings are not yet. Good enough to render; not good
enough to assert. Which is what the 0.4 confidence cap already encodes, and why
nothing here has been written into a record as measured.

---

## 2. Coverage

| | Count | Share |
|---|---|---|
| Buildings in the boundary | 3,025 | 100% |
| With massing (footprint, ground, eaves, ridge, roof form) | 3,025 | 100% |
| With a measured ridge | 2,887 | 95.4% |
| At a fallback height (no measurement) | 138 | 4.6% |
| **With an observed and measured front** | **1,812** | **59.9%** |
| With no façade — drawn as bare massing | 1,213 | 40.1% |
| Ceiling from camera poses alone | — | 88.6% |
| BAG construction year | 2,810 | 92.9% |

The gap between 59.9% and 88.6% is a measurement run, not a bug. It went from
44.3% to 59.9% today by lowering the rectified strip and re-running.

---

## 3. What each field is worth

### Trust it
- **Footprints, ground level, eaves, ridge, roof form.** BAG and 3DBAG/AHN.
  Not my measurements; the datum alignment is pinned to 1.4 mm in the pilot.
- **Frontage width.** From BAG's minimum-area rectangle. Median 5.66 m against
  the registry's 5.7 m.
- **Wall colour.** Sampled from that building's own rectified photograph,
  between its own openings. 1,812 façades carry one.

### Treat as provisional
- **Opening positions and sizes.** 13,989 of them. Median 6 per façade. They
  are where the detector put them in a photograph of *that* building, but no
  human has confirmed a single one.
- **Storey bands.** Median interval 3.00 m, which is right; exact count agrees
  with 3DBAG only a third of the time.
- **Bays.** Median 2. Never validated against anything.
- **Wall material.** Snapped from measured colour to a 12-item vocabulary.
  `brick-grey` takes 776 of 1,812, which is suspiciously dominant and probably
  reflects shadow and overcast light more than grey brick.

### Do not trust — drawn, not observed
- **Gable shape** on the 2,389 buildings where the register does not name one.
  636 are stated in prose by the Rijksmonumentenregister; the rest are assumed
  from construction year. An unphotographed, unstated front gets `punt`, a plain
  triangle, deliberately.
- **Cornice, window joinery, sills, hijsbalk.** Pure vocabulary. Tagged
  `part: 'gable' | 'trim' | 'beam'` in the geometry so a renderer can drop them,
  and coloured as generated in evidence mode.
- **Opening *kind*** (window / door / shopfront / souterrain). Read from the
  measured rectangle's shape and its height above this building's own ground —
  honest as far as it goes, but it cannot tell a door from a very tall window.

---

## 4. Where it fails, by count

1,055 of 1,814 façades trip at least one plausibility check. The reasons:

| Count | Failure |
|---|---|
| 464 | *N of N openings are not window-shaped* |
| 308 | a floor-to-floor interval outside 2.3–3.9 m |
| 213 | storey ladder implies storeys **below** 2.3 m |
| 187 | storey ladder implies storeys **above** 3.9 m |
| 180 | openings cover more than the expected share of the wall |
| 27 | band count disagrees with an independent storey count |

**Read these as a diagnosis, not a defect list.** The 213-below and 187-above
pair is the storey ladder failing in both directions roughly symmetrically,
which is what an unbiased-but-noisy estimator looks like — consistent with the
+0.28 mean signed error. The 464 "not window-shaped" is the one that most
likely indicates real false positives: dark regions that are not openings.

### View quality is a hard limit on some of this

| | p05 | p25 | p50 | p75 | p95 |
|---|---|---|---|---|---|
| Standoff (m) | 14 | 20 | 25 | 35 | 46 |
| Obliquity (°) | 0.5 | 3.6 | 9.4 | 16.3 | 19.6 |
| Resolution (px/m) | 27 | 36 | 51 | 61 | 91 |

**30.5% of façades were measured at under 40 px per metre.** A glazing bar is
about 20 mm. At 40 px/m that is under one pixel. Anything finer than an opening
outline is not recoverable from those views at all, and no amount of better
detection changes that — it needs closer imagery.

---

## 5. What is drawn now

| Element | Source | Count |
|---|---|---|
| Openings | measured | 13,989 |
| — windows | classified from shape | 11,426 |
| — doors | classified from shape | 1,400 |
| — souterrain | classified from shape | 866 |
| — shopfronts | classified from shape | 297 |
| Gable, stated | Rijksmonumentenregister prose | 636 |
| Gable, assumed | construction year | 2,389 |
| Wall textures | measured colour + constructed bond | 6 of 12 materials |

Gable mix as drawn: 1,235 `lijst`, 1,060 `punt` (unobserved), 320 `klok`,
240 `hals`, 168 `trap`, 2 `tuit`.

Textures: `brick-grey`, `painted-white`, `painted-grey`, `painted-black` (40
buildings each), `brick-yellow` (30), `stucco` (14). Brick tiles at 0.63 m —
three stretchers, so the bond seams on a perpend. Paint and render tile at
1.89 m with their horizontal banding flattened, because the cross-building
median manufactures false courses on surfaces that have none. Six materials
have too few sample buildings and fall back to measured flat colour:
`sandstone` (6 buildings), `brick-purple-brown` (13), `brick-red` (2),
`brick-red-brown` (4), `painted-green` (1), `painted-cream` (0).

---

## 6. Bugs fixed today, and what they say about the process

Every one of these was found by looking at a screenshot. None was found by
reading JSON, and several had survived weeks of reading JSON.

1. **Bricks the size of doors.** An atlas forces UVs into a cell, so wrapping
   had to be done by hand as `fract(east)` — and a wall quad has two vertices
   along its length, so that stretches one tile across the whole wall instead of
   repeating it. Fixed by dropping the atlas for per-material meshes.
2. **UVs smeared sideways.** Horizontal UV was radial distance from the
   building's first ring vertex. Fixed by projecting onto each face's own
   tangent.
3. **Every roof a centroid-tapered pyramid**, and `gableProfile()` — seven gable
   types — had never once been called.
4. **Roof shards over the neighbours.** The plot-frame roof was applied to
   churches, warehouses and L-shaped sites. Now gated on width ≤ 15 m, depth ≥
   width, bbox fill ≥ 0.65.
5. **See-through roofs.** BAG rings wind both ways, so faces came out
   back-facing and the GPU discarded them. Now every face is checked against its
   building's centre and flipped.
6. **Windows invisible.** I recessed glass 140 mm behind a wall with no aperture
   cut in it. Depth is now built outward.
7. **The `-0.40 m` sill spike.** The rectified strip started 0.4 m below ground,
   which does not clear a souterrain, so 1,020 openings were clamped to the
   image edge and **1,213 of 1,340 façades had no door at all.** Strip now
   starts 1.8 m down; 1,003 of 1,812 façades now find a door.
8. **The same datum copied into five files as a bare `0.4`.** Now one
   `STRIP_BASE_BELOW_GROUND_M`.

**The process lesson:** a geometry pipeline needs a picture in the loop. The
`build-evidence.ts` inspector exists because of this.

---

## 7. What I would not claim

- That any individual building is correct.
- That `brick-grey` at 776 of 1,812 is a real material distribution rather than
  an artefact of overcast light and shadow.
- That the front wall is correctly identified on corner plots. The rule is "the
  short side of the plot, within 35%", which is measured and reasonable, and
  which nobody has checked against a photograph.
- That storey counts are usable as facts. ±1 at 82.7% is a rendering input.
- That registration is within the brief's 0.5 m bar. It is verified only as "no
  systematic bias" (signed mean −0.13 m). `check-facade-registration.ts` stays
  red and is deliberately unwired from `check:canal`.

---

## 8. Next, in order

1. **Human calibration.** The blocker for everything else. The inspector now
   shows a strip, the detector's grid, its empty cells, and its reasoning; the
   remaining work is to label ~30 stratified façades and run
   `fieldAccuracy` → `fieldVerdict` so the 0.4 cap can be lifted per field.
2. **Per-parcel dossiers.** One JSON per `pand_id` — address, grammar,
   extractions, year, colour, texture, source links. Requested; not built.
   Addresses need a PDOK reverse-geocode pass (no address data is cached today).
3. **Coverage 59.9% → 88.6%.** Another measurement run.
4. **Window vocabulary.** `kruiskozijn`, `schuifraam` with pane counts,
   `bovenlicht`, and head shapes — `rechte strek`, `segmentboog`, `rondboog`,
   with `hanekam` stone springers. Head shape and frame colour are measurable at
   current resolution; pane counts are not, at 30% of façades.
5. **`mansardekap`** — the Dutch mansard. Not yet detected or drawn.
6. **The 464 "not window-shaped" façades.** The most likely real false
   positives.

---

## 9. Reproduce these numbers

```bash
# Coverage, gables, materials, opening kinds
npx tsx scripts/check-facade-layer.ts

# The full audit in section 1, 4 and 5
npx tsx scripts/facade-twin/build-evidence.ts --strips=0

# Re-measure the boundary (about an hour)
npx tsx scripts/facade-twin/measure-boundary.ts --panoramas=1400 --fresh
npx tsx scripts/facade-twin/build-lod22-extract.ts
npx tsx scripts/facade-twin/build-textures.ts --per-material=40

# Look at one building's evidence
npx tsx scripts/facade-twin/build-evidence.ts --ids=<pandId>
npm run build:canal-facade-twin && open public/canal-drive/facade-twin.html
```

Checks wired into `check:canal`: `facade-boundary`, `facade-build-record`,
`facade-calibration`, `facade-coordinates`, `facade-gable-library`,
`facade-generate`, `facade-heritage-text`, `facade-layer` (30),
`facade-record`. `check-facade-registration.ts` is deliberately **not** wired,
because it is red and hiding that would be worse than failing it.


---

## 10. Postscript: how a wrong pipeline passed a numeric audit

This is the part worth keeping.

Section 1 argued the extraction was sound because three quantities agreed with
independent sources: median storey interval 3.00 m against a grammar figure of
3.01 m, median frontage 5.66 m against BAG's 5.7 m, and storey counts within ±1
of 3DBAG for 82.7%. Those agreements were real. The pipeline was also, at that
moment, measuring buildings on the wrong side of the canal.

**Why the agreements held anyway.** Every one of them is a property of *the
fabric*, not of the building being measured. Amsterdam canal houses have ~3 m
storeys and ~5.7 m frontages whether you photograph number 270 or the house
opposite. The frontage figure could not have disagreed: the wall width comes
from BAG geometry, not from the photograph, so it was never testing the
imagery. And a storey ladder fitted to *some* Amsterdam façade will land on
Amsterdam's storey height regardless of which façade it was.

So the audit tested that the outputs were *typical of Amsterdam*, and they were.
It could not test whether they were **this building**, and nothing in it ever
could have.

**What would have caught it, in order of cost:**

1. **Looking at fourteen strips.** Free. It took one contact sheet to see
   railings, streets and blank sky. I had rendered 200 strips and inspected
   none of them.
2. **The `building` and `sky` classes of a segmentation model.** The bad strip
   comes back 13% building, 47% sky. Automatic, per-strip, and now wired in.
3. **Reading the comment above the bug.** `rectify-facades.ts:199` said in
   plain words that `centre` pointed 180° away at a building four metres behind
   the camera. The next line defaulted to `centre`.
4. **A registration check that was allowed to stay red** and was deliberately
   unwired from `check:canal`, where nobody had to look at it.

**The general lesson, stated so it survives this file.** Aggregate statistics
answer *"is this output typical of the population?"*. They cannot answer *"is
this output about the thing I think it is about?"* — identity is not a
distributional property. A pipeline that samples the wrong object will pass
every distributional test you can write, as long as the wrong object is drawn
from the same population as the right one. In a city where every direction
looks like a canal frontage, that is guaranteed.

Identity needs a per-item check against something that knows what the item
should look like: a human, a model, or geometry projected back into the source
image. Not a median.


---

## 11. Current state, after the yaw repair (2026-09-04, late)

### What ran

1. Yaw corrected to `edge`; convention moved into the imagery adapter and made a
   required argument. `check-facade-yaw.ts`, 8 checks.
2. Full re-measurement: **2,180 buildings, 1,821 with openings**.
3. Every strip re-rendered clean (no annotation) and put through
   `cmp-zosci/amsterdam-facade` v2 segmentation, locally, 49 ms each.
4. The extract now takes its openings from the model and gates on its verdict.

### Where it stands

| | |
|---|---|
| Buildings in the boundary | 3,025 |
| Strips segmented | 1,821 |
| Median `building` share of frame | **13.6%** |
| Strips ≥25% building | 643 (35%) |
| Strips ≥45% building | 331 (18%) |
| **Façades surviving the gate** | **837 (27.7% of the boundary)** |
| Openings kept | 4,892 |
| Windows found by the model | 5,323 |
| **Doors found by the model** | **31** |

**837, not 1,820.** The gate rejects a little over half of what the detector was
willing to measure. That is the number to trust, and it is the first coverage
figure in this project that has had a per-item check behind it rather than a
distributional one.

### Two bugs found in the vision pass itself

- **Colour channels.** `inference` follows OpenCV and reads arrays as **BGR**; I
  passed `np.array(Image.open(p).convert("RGB"))`. Red and blue swapped before
  the model saw anything, so brick went blue and sky went orange — and the model
  reported a brick wall as 92% sky. It looked like a model that could not handle
  our imagery. It was two characters. One strip went from 9% to 58% building on
  the fix alone; the usable rate went 8% → 18%.
- **Connected components are the wrong grouping.** A window is cut into slivers
  by its own glazing bars, so one window arrives as five ragged fragments and any
  solidity filter strict enough to reject a tree also rejects every sash window
  in Amsterdam. Replaced with a grid: project the window mask onto each axis,
  take the runs as bays and storeys, and let each cell be one opening. Fragments
  merge because they share a cell.

### What is still wrong, plainly

- **Doors: 31 found across 1,821 strips.** `check-facade-layer.ts` fails on this
  and is **left failing** — 30 of 837 façades carry a door-shaped opening, 4%.
  The model has a `door` class trained on 1,048 instances and it almost never
  fires at our scale. This is the clearest open defect.
- **Median building share is 13.6%.** Even corrected, most strips are not
  predominantly the target building. Some of that is the `background` class
  swallowing neighbours on a narrow plot; some is real rectification failure.
  Not yet separated.
- **Skewed strips.** Several strips show visible perspective — a receding
  building — which means the sampling plane is not the wall plane. Rectification
  onto a correct plane cannot produce perspective, so this is a registration
  error, not a rectifier bug. Unquantified.
- **Nothing has still ever been checked by a human.** Unchanged.

### Next

1. **Doors.** Either the model at a larger input scale, a second detector, or
   fall back to the geometric rule (an opening standing on the pavement, tall
   and narrow) over the model's window mask.
2. **Un-skew.** Detect residual perspective in a strip and either re-solve the
   plane or reject. A strip that is genuinely fronto-parallel has vertical
   building edges; measuring their convergence is a direct test.
3. **Combine detectors.** One Amsterdam-specific segmentation model is a single
   point of failure. A general window detector as a second opinion, with the
   grid as the arbiter between them.
4. **Separate the tests**, per the external audit: address → pand, pand →
   elevation, world point → panorama pixel, panorama → rectified strip, strip →
   openings. Today a façade-looking image is still treated as evidence that
   every upstream step was right.


---

## 12. The correspondence is not consistent between panoramas

The state at the end of 2026-09-05. This section supersedes §11's coverage
numbers in the only way that matters: those numbers describe measurements made
on a correspondence that does not hold.

### What is now known, and how

Three tools, each answering a question the previous one could not.

**`project-check.ts`** draws the BAG footprint into the raw panorama — no
rectification — so the coordinate transform, camera model, pose and wall choice
are tested together. Two visualisation bugs had to be removed before it could
be trusted, and both were instructive:

- Edges were drawn as **straight lines between projected corners**. In an
  equirectangular frame the image of a straight 3-D line is an arc, and over the
  20–30° a canal house subtends the bow is tens of pixels — so the outline lay
  visibly across the wall on a projection that was in fact exact. Edges are now
  subdivided in world space and every sample projected.
- The crop was sized to the **whole footprint including its 20 m of depth**,
  which from the quay spans about 100° of the panorama. The frontage being
  judged occupied a fifth of a very wide, very curved picture. Cropping to the
  wall fixed what looked like "far too zoomed in".

With both fixed, the scale checks out: 470 px for a 12.24 m wall at 30 m is
40 px/m against the 41.7 the range implies, and 113 of 149 projections are
within 15% of expected.

**`cross_view.py`** is model-free. If a wall plane is where we think it is, two
panoramas rectified onto it give the same picture and lock under normalised
cross-correlation. The control is the whole point: **a strip against itself
scores exactly 1.000 at zero offset**, so the instrument works.

**The result: 0 of 120 buildings lock.** Two views of the same wall score 0.06.
Two views of *different buildings* score 0.05.

### Where the fault is

Putting a projection beside the strip rectified from the same panorama settles
it. The strip faithfully reproduces whatever is inside the green outline —
**`rectifyFacade` is correct**. But two panoramas of one pand put the outline on
two different houses: one a narrow house with a stoep, the other a wider corner
building with a stepped gable.

So the fault is not in rectification, not in wall selection (87% of walls sit
within 5° of a plot axis, 68% match plot width within 10%), and not in the
yaw convention, which was fixed and pinned. **The pose-to-pixel mapping is
inconsistent between panoramas.**

That is a much narrower target than "the correspondence is broken", and the
suspects are enumerable. The poses come from five camera rigs across ten years:

    TMX7316010203  118,587    recording   7,317    b   7,995
    TMX7316060226    5,749    TMX7315120208  289

and each record carries a `missionYear` that differs from its own `capturedAt`.
A convention that varies by rig or campaign — heading reference, camera-height
datum, or a position that is the vehicle rather than the lens — would produce
exactly this.

### What to do next, in order

1. **Solve for a per-panorama aim correction** and see whether it clusters by
   rig prefix or mission year. `aim-error.ts` already renders each wall from
   every view onto one widened plane at a shared scale, which is what that
   measurement needs.
2. **Get a second opinion on pose.** Mapillary is free and has its own poses for
   the same streets; Google Street View's metadata endpoint returns the pano
   position it actually used. Either would say whether Amsterdam's published
   pose or our reading of it is at fault.
3. **Only then** re-run anything downstream. Every façade number in §11 was
   measured through this.

### Standing instruments

| tool | what it answers | needs a model |
|---|---|---|
| `project-check.ts` | is the outline on the right building? | no |
| `cross_view.py` | do independent views agree? | no |
| `check-facade-external.ts` | do OSM and BAG agree with us? | no |
| `match.html` + `review-server.ts` | what does a person say? (SQLite) | no |
| `vision/ensemble.py` | where are the openings? | yes |
| `vision/correspondence.py` | **abandoned** — the model calls a wall 3.8% building | yes |


### 12a. Rendering it and looking settles what correlation could not

Widening the plane to nine times the wall and rendering every view of one pand
at a shared scale — 121 m of canal, three panoramas, same plane — shows the
thing directly:

- the **2023-02-27** and **2023-03-20** views show the *same* stretch of canal:
  same buildings, same blue parking sign, small offset between them;
- the **2021-01-22** view of the same plane shows a *different* stretch
  entirely.

Two panoramas from one campaign agree with each other. One from another
campaign does not agree with either. The numbers back it weakly and in the same
direction: across 30 pairs, same-capture-year pairs have a median correlation
of 0.070 against 0.049 for cross-year, and the single best-agreeing pair in the
whole set — 0.254, far above the 0.06 typical — is exactly the 2023/2023 pair
that visibly matches.

**So the leading hypothesis is that the pose convention differs between capture
campaigns**, and the fault is in how a published pose is read rather than in
the geometry, the rectifier or the wall.

Two cautions on that. n = 30 pairs is small, and 0.070 against 0.049 is not a
result on its own — it is a direction. And normalised cross-correlation is
proving a poor instrument on these wide strips: it says 0.25 for two images a
person can see are the same street. Its self-correlation control is exact, so
it is not broken, but seasonal light, different ranges and heavy resampling
leave it little to lock onto. **Rendering and looking is currently the more
reliable test**, which is why the wide-strip renderer exists.

### 12b. The experiment that would settle it

Pick one pand with views spanning many years, render the widened plane from
each, and sort them by campaign. If the images fall into groups that agree
within a campaign and disagree between campaigns, the correction is a per-
campaign constant and can be solved for directly — the shift between two groups,
in metres at a known standoff, is a heading offset in degrees.

If instead they disagree individually, the pose error is per-panorama and the
answer is an external opinion: Mapillary has its own poses for these streets,
free, and Google's Street View metadata endpoint returns the position it
actually used.


### 12c. The campaign hypothesis is wrong, and a real bug found instead

The experiment settled it, and against the hypothesis.

**Heading is consistent across campaigns.** Taking every pair of panoramas
whose cameras stand within 2 m of each other in *different* capture years and
driving roughly the same way — 263,535 pairs — the signed median heading
difference is **0.00°**, and no year pair exceeds 0.17°:

    2019/2023  +0.06°  n=36,758      2022/2023  −0.01°  n=22,848
    2020/2023  −0.03°  n=30,953      2016/2023  +0.03°  n=15,799
    2021/2023  +0.05°  n=25,561      2019/2021  +0.17°  n=8,471

There is no per-campaign heading offset to solve for. That closes the line of
enquiry §12b opened, cheaply, on metadata alone and without a single image.

**But the same look found a real bug.** Stated carefully, because the first
version of this paragraph said something false: *the photographs are fine, and
nothing was taken underground.* What is true is that Amsterdam publishes a
missing value as a zero, and this pipeline did arithmetic on it.

Checked against the API rather than inferred from our cache:

    recording_2025-06-16_…   coordinates [lng, lat, 0.0]   heading 0    pitch 0    roll 0
    b_20241121_1354_…        coordinates [lng, lat, 0.0]   heading 3.14 pitch 1.68 roll -0.18

**15,312 of 139,937 panoramas publish a height of zero** — all of 2024 and
2025. Of those, the **7,317 `recording_*` frames from 2025 also publish heading,
pitch and roll as exactly zero**, which is absent orientation rather than a
camera pointing due north perfectly level; the 7,995 from 2024 carry a real
orientation and lack only height.

A zero height then went through `cameraHeight - GEOID_SEPARATION_M` and became
a lens 43.5 m *below* NAP — forty-six metres under the street, in our model,
not in life.

Nothing objected. The rectifier faithfully computed the directions from a camera
in the earth's crust to a wall above it — which point almost straight up — and
returned rooflines and sky. **249 of 2,180 measured façades, 11%, were measured
that way.** Any cross-view comparison including one of them was guaranteed to
disagree, which means the "0 of 120 lock" figure was measured on a set partly
poisoned by this.

Rejected now by `hasUsablePose`, applied in all five scripts that select views,
and pinned by two checks. The rest of the fleet is sound: median published
height 46.69 m, which is 3.19 m NAP after the separation and 2.56 m above this
boundary's typical ground of 0.63 m — right for a survey vehicle's lens, and
the first independent confirmation that `GEOID_SEPARATION_M` is correct.

**What is still unexplained.** Removing the underground cameras does not by
itself account for two *valid* panoramas putting one wall on two different
houses. Heading agrees, height is now sound, the yaw convention is pinned, the
rectifier is faithful and the wall is well chosen. The remaining suspects are
the published camera *position* — whether `lngLat` is the lens or the vehicle
reference point — and the pitch/roll application order. Both are testable
against Mapillary, which publishes its own poses for these streets for free.


---

## 13. The frame is world-aligned, and that was the whole bug (2026-09-05)

Section 12 left the fault narrowed to "the pose-to-pixel mapping is inconsistent
between panoramas", with `lngLat` and the pitch/roll order as the remaining
suspects. It was neither. The question itself was wrong.

**Amsterdam's equirectangular frames do not turn with the survey van.** They are
world-aligned: north at the horizontal centre, horizon level, and `heading`,
`pitch` and `roll` describe the vehicle. The pipeline rotated every projection
by the van's heading — an angle that varies per panorama and has nothing to do
with the picture.

This is why the `centre`/`edge` argument could not be won. Both answers presume a
body-aligned frame, and both are wrong by `heading`. `edge` passed its six-façade
review because those views happened to have heading near 180°, where the two
conventions coincide. Herengracht 270's three views have headings 181.5, 0.7 and
181.3 — and §12a's odd one out, the 2021-01-22 view showing "a different stretch
entirely", is exactly the 0.7 one. "0 of 120 lock" followed directly: the van
drives both ways along a canal.

### The measurements

Three, none of which needs a building, a detector or a rectified strip. Two are
reproducible from source via `scripts/facade-twin/pose-experiments.ts`.

| experiment | prediction if world-aligned | measured |
|---|---|---|
| Opposed pairs — cameras < 1.5 m apart, headings 180° apart | raw frames differ by 0° | median 0.18°, worst 2.34°, n = 8, peaks 0.44–0.80 |
| Optical flow — expansion centre against known travel bearing | bearing + 180° | median 181.55° (mad 7.02°), n = 14; 181.88° (mad 4.08°) on the 8 strongest |
| Cross-view residual, upper façade only | small | median 2.05 m → 0.95 m, within 1 m 23% → 50% |

Handedness is settled with it: clockwise, concentration R = 0.78 against 0.17.

**Two instrument notes, because both nearly produced a wrong answer.** The
cross-view correlator reads only the upper façade: everything below the first
floor is tree, car, bike, lamp post and parking sign, none of it in the wall
plane, all of it sliding metres sideways under parallax and swamping the wall
that does not. And the flow experiment must be summarised by a circular *median*.
A track with a weak flow field can score a high sign-agreement and still return a
badly determined angle — agreement measures whether signs match, not whether the
angle is sharp — and two such tracks dragged a mean of fourteen by 10°, which at
a canal's width is 4 m of façade.

### Independently confirmed

- **The publisher says so.** Amsterdam's Open Panorama pipeline documents its
  second stage as: *"images are edited to face northwards and have a straight
  horizon."* That is both findings at once — north-aligned, and levelled, which
  is why applying pitch and roll on top makes the residual slightly worse
  (0.95 m → 1.15 m).
- **The building says so.** At 4 m standoff the number **270** is legible in our
  own rectified strip of pand `0363100012164989`, carved on the stone right of
  the door — the pand BAG labels *Herengracht 270G*.
- **The register says so.** The Rijksmonument entry for Herengracht 270
  describes a double house with a sandstone façade, five windows wide, a straight
  triglyph cornice with balustrade, sculptured window surrounds in two bays, a
  17th-century door and two façade lanterns. Every one of those is visible in the
  corrected strip, in both the heading-181° and the heading-0.7° view.
- **Street View says so.** Google's May 2024 imagery of Herengracht 270 shows
  the same door, the same two lanterns, the same carved surrounds.

### The suspect that is now closed, and the one that is not

Splitting the cross-view residual by whether the two views' headings agree:

| pairs | n | signed median | median &#124;shift&#124; | within 1 m |
|---|---|---|---|---|
| opposed headings (> 120°) | 54 | **0.00 m** | 0.55 m | 65% |
| similar headings (< 60°) | 31 | −0.80 m | 1.65 m | 29% |

A vehicle-frame position offset — `lngLat` being the van rather than the lens —
would make *opposed* pairs disagree by twice the offset while same-heading pairs
cancel. The opposite is observed, so that suspect is closed with the
discriminating subset rather than with an aggregate median. **The −0.80 m on
similar-heading pairs is unexplained** and n is small; it is not being explained
away.

### Retraction

§12c said the fleet's median lens height "2.56 m above this boundary's typical
ground of 0.63 m" was "the first independent confirmation that
`GEOID_SEPARATION_M` is correct". That claim does not hold. Measured against
local ground under each camera across 93,553 panoramas, lens height has a median
of 2.47 m but a p05–p95 span of 0.72–4.61 m and a MAD of 0.69 m. Part of that is
a crude ground proxy — the median ground of buildings within 45 m — but it is far
too loose to confirm a datum to better than a metre.

### 2024 and 2025

15,312 panoramas publish a height of zero — 5,567 from 2024 and 9,745 from 2025
in this boundary. The position is that:

1. **The orientation blocker is gone.** `AMSTERDAM_CAMERA` never reads heading,
   pitch or roll, so the 2025 `recording_*` frames that publish all three as zero
   are merely undescribed, not unusable. Pose validity now asks the *camera
   model* whether orientation matters — `defectsOf(view, camera)` — rather than
   assuming it does.
2. **Height is the only remaining blocker, and it is real.** A constant cannot
   be substituted: see the retraction above.
3. **But height does not affect azimuth at all.** The projection takes azimuth
   from `atan2(dx, dy)`; `dz` enters only the elevation. So a zero-height frame is
   already usable for horizontal registration and building identity, and unusable
   for storey bands, sill heights and anything else vertical.
4. **The way to recover it** is a one-parameter vertical fit of the strip against
   a view of the same wall from the sound fleet. Not implemented yet, and until
   it is, these frames stay rejected rather than guessed — the whole point of §12c.

### Still open

- p90 of the cross-view residual is 5.55 m. The distribution is bimodal — 30 of
  60 within a metre, then a tail — which is the signature of a correct model with
  some other stage failing, most likely wall selection and occlusion. Not yet
  separated per case, and it must not be attributed by assertion.
- Cross-view agreement alone does not certify identity. Where every view of a
  pand shares a heading, the old model agrees with itself while pointing at the
  wrong house. Identity needs the address evidence above, which is why
  house-number OCR is the next instrument and not a nicety.
- Everything downstream of §11 was measured through the old model and stays
  quarantined.


---

## 14. The buildings can be made to say their own names (2026-09-05, late)

§13 left two things open: a residual tail attributed to nothing in particular,
and the fact that cross-view agreement cannot certify identity. Both moved.

### The tail is occlusion, and it is not wall selection

`cross-view-registration.ts` measures the along-wall offset between two
independent panoramas of one wall, and records what could explain a failure
other than the camera. On 90 panden: median 0.95 m, p90 5.55 m, half within a
metre, bimodal. What separates the 45 that lock from the 30 that miss by two
metres or more:

| | locks < 1 m | misses ≥ 2 m |
|---|---|---|
| either view occluded | 27% | **83%** |
| further standoff | 22.8 m | 32.6 m |
| wall off plot axis | 0.0° | 0.0° |
| worse obliquity | 13.0° | 13.8° |

Occlusion and distance. **Not wall selection** — the chosen wall sits on a plot
axis in both groups and obliquity barely moves. The view selector should reject
occluded views and prefer nearer ones; that is a change to view ranking, not to
geometry.

### House numbers, and what they can and cannot certify

A house number is the only thing in a street photograph that *identifies* the
building rather than describing it, and it is independent of the geometry being
tested: the plaque reads 270 whether or not the projection is a metre out.

Geometry decides whether it is legible. A 13 cm digit subtends 41 px at 4 m and
5 px at 30 m, so numbers come from the **near-side pass** — the van driving the
building's own quay — and not from the across-canal view the façade is measured
from. Different panoramas of the same building, which is the point.
`number-bands.ts` samples at the rate the source carries and never above it: 54
of 175 tiles were dropped below 45 px/m, where no recogniser reads a digit and
enlargement adds pixels rather than evidence. Median native resolution across the
kept tiles is 113 px/m.

First run, 30 panden, EasyOCR (Apache-2.0), never told what to expect:

| | |
|---|---|
| **confirmed** — a number this pand carries, on the wall we projected | **3** |
| **conflict** — another pand's number inside our wall span | **5** |
| neighbour only — real numbers read, all outside our wall span | 1 |
| **unread** — nothing legible that names a nearby address | **21** |

330 raw digit readings; most are window bars and reflections and are discarded by
requiring that a reading name a real address nearby. **Coverage is the honest
problem: 9 of 30 yield a usable number and 3 of 30 confirm identity.**

Along-band offset of a confirming reading from its BAG address point: n = 3,
median 1.47 m. That is loose by construction — a BAG address point is a point
*inside* the building, not the surveyed centre of a plaque — and it is sharp
enough only to catch a one-house error, which is 5–6 m on a canal terrace.

### The strongest catch, stated carefully

Pand `0363100012167495` carries Herengracht **58**. Its band reads **56** twice,
at 0.999 and 0.961, from two different tiles, agreeing at 8.59 m — three metres
into an eight-metre wall, not at its edge. The plate was then looked at directly:
white enamel on brick, beside a stone pilaster. BAG places Herengracht 56 in the
*adjacent* pand `0363100012167494`, and its address point falls 0.02 m from where
the plate was read.

**What that proves and what it does not.** It proves BAG's own point for number
56 lies inside the wall this pipeline proposes as number 58's frontage. It does
not by itself say which is wrong: a laterally offset projection, a wrong footprint
edge, a corner building with two street frontages, and a misplaced address point
would all produce it. It is a flag for a person, and that is what the instrument
is for.

### Two review surfaces, and why they are two

- **`build-explorer.ts`** browses: parcel, footprint in the raw panorama,
  rectified wall per view, door band, filters, and a per-building report control.
  The evidence had been scattered across a dozen JSON files and three pages that
  each answered one question, which is how a wrong camera model survived a pilot.
- **`build-registration-review.ts`** + `registration.html` decides: one building,
  three questions, a keystroke each, straight into SQLite. The door band is shown
  as *evidence* so a reviewer can read the number themselves; the recogniser's
  answer and the cross-view residual are withheld until after the verdict,
  because a reviewer shown a confident number agrees with it.

### Still open

- Coverage. 21 of 30 unread. Whether that is resolution, plate style, occlusion
  or the recogniser has not been separated, and the first three are geometry.
- The 5 conflicts are unadjudicated. None should be called a registration error
  until a person has looked.
- The view selector still does not use the occlusion finding.
- 2024–2025 remain blocked on height alone, as §13 describes.
- Everything downstream of §11 stays quarantined.


---

## 15. Height is a per-track offset, and the newer rigs are aligned after all

Asked why the green outline sits slightly off on a card that otherwise looks
right. It is off, it is off vertically, and the reason is not the camera model.

### Three separate faults, only one of them registration

Herengracht 242, pand `0363100012164991`, from the 2021-01-22 view:

| | |
|---|---|
| horizontal fit | right edge on the party wall, left edge ~0.45 m in — good |
| box top | drawn at `eavesHeight` 13.17 m, which cuts across the middle of the neck gable |
| box bottom | drawn at `groundLevel` 1.26 m, which lands halfway down the quay wall, ~1.8 m below the pavement |
| camera | 2.03 m NAP, only **0.77 m** above this building's own ground |

**The top was a definition mismatch.** On an Amsterdam canal house the visible
façade continues above the eaves to the gable top, so a box drawn to the eaves is
short by two metres on every gabled front — and a reviewer cannot tell that from
a genuine registration error, because either way the box misses the top of the
building. The quad now runs ground to **ridge**, with the eaves drawn as a line
across it: still legible as a measurement, no longer mistakable for a bad fit.

**The bottom is the real defect**, and it is fleet-wide. Across the 60-card deck
the modelled lens sits a median of **1.15 m** above the building's own ground,
with a 5th percentile of −0.54 m — below it. 43 of 60 cards are outside the 1.6
to 3.6 m a survey van can plausibly occupy. The deck now says so on the card, so
a reviewer judges the box sideways rather than vertically when the height is
untrustworthy.

### The height error is per-track, not per-frame

That is the useful part, and it took two measurements to see:

| | |
|---|---|
| consecutive frames of one track, ~5 m apart | median &#124;Δheight&#124; **0.041 m** |
| two cameras within 1 m of each other, different years | median &#124;Δheight&#124; **0.75 m**, p90 1.97 m, p99 4.51 m |
| within one track, p10–p90 of published height | 1.57 m over 586 tracks |

Height is smooth *along* a run to four centimetres and disagrees *between* runs
by up to a couple of metres. The same patch of quay cannot be two heights, so the
difference is the error, and its shape is a **vertical datum offset per survey
run** — the signature of a GNSS session bias. Across the fleet the median lens
sits 2.44 m above the nearest building's ground, which is right; the spread,
0.73 to 4.57 m at p05–p95, is the per-track bias, not real variation.

**This is solvable as one constant per track**, which is far more tractable than
per frame — and it is the same fix the 2024–2025 batches need for their missing
height, so the two problems collapse into one. Azimuth is untouched either way:
the projection takes it from `atan2(dx, dy)` and never reads `z`.

It also retracts the remaining comfort in §13's geoid note. `GEOID_SEPARATION_M`
is consistent with the fleet *median* and cannot be checked more finely than the
per-track bias allows.

### The 2024–2025 imagery: aligned, and from three different vendors

The alignment experiments in §13 used `TMX…` frames only, because the pose filter
rejects the newer batches for their missing height and they never reached an
experiment. The newer imagery comes from **different vendors**, which the URLs
give away:

    TMX…       /panorama/2023/02/20/TMX7316010203-…      Cyclomedia
    b_…        /panorama/2024/kempkes/Job_20241203_…     kempkes
    recording… /panorama/2025/360geo/recording_2025-…    360geo

World alignment is a property of a normalisation pipeline, not of the city, so
this was a real gap. `pose-experiments.ts --rigs` closes it by putting a newer
frame beside a `TMX…` frame taken within 1.5 m of it and measuring the circular
offset between the raw images — a test that needs neither height nor orientation,
which is why it works on batches that publish neither:

| rig | within 5° of zero | median | outliers |
|---|---|---|---|
| `b_` 2024 | 19/20 | 0.72° | −142° at peak 0.56 |
| `b_` 2025 | 17/20 | 0.54° | 170°, 91°, 171° — all at peak ≤ 0.31 |
| `recording_` 2025 | 19/20 | 0.36° | −6° at peak 0.29 |

An outlier's correlation peak is the whole question: a weak peak is the
correlator failing on a blank quay, a confident one is a frame that really is
turned. On that reading **all three vendors are world-aligned**, and the single
confident disagreement — one `b_` 2024 frame at −142°, peak 0.56 — is a per-frame
defect rather than a rig-wide convention. Worth a per-frame check before use; not
worth a second camera model.

So the answer on 2024–2025 is unchanged in substance and better founded: the
blocker is height alone, and height is now a per-track constant to be solved
rather than a missing value to be guessed.

### Still open

- The per-track height offset is diagnosed, not solved. Nothing vertical —
  storey bands, sill heights, the door band's window — should be trusted until it
  is, and it now affects the whole fleet rather than the 2024–2025 batches alone.
- Everything in §14 that was open stays open.


---

## 16. Three defects out, and a machine reviewer that knows its own bias (2026-09-05, night)

Review found six problems in an afternoon. They were three faults, and all three
are now fixed or measured.

### A frontage split by a jog is still one frontage

`buildElevations` grouped runs of *consecutive* near-parallel edges — right for a
corner, wrong for a canal front, which steps in and out by tens of centimetres
for a bay, a porch or a thicker party wall. The step is a real perpendicular
edge, so it broke the run and one façade arrived as two or three pieces. The
pipeline measured one piece.

**176 of 2,180 panden, 8%.** The chosen piece was a median **2.31× smaller** than
the real frontage and missed a median 10.1 m of wall. Herengracht 58 returned
7.98 m and 13.94 m, both facing 28.5°, both in the same plane.

`mergeCoplanar` joins elevations passing all three tests and only those: same
facing within 8°, same plane within 1.2 m, adjacent within 4 m. Facing alone
would join a front to a wing across a courtyard; without the offset test it would
join a front to a back. **Splits 176 → 34**, 653 panden gained a merge, and
Herengracht 58 now covers its whole 1905 block party wall to party wall.

The guard against over-merging is the city's own: **median frontage per house
number is 5.2 m**, which is an Amsterdam canal plot. Median front 5.6 m, p95
16.0, three over 30 m, none over 45.

### `b3_h_nok` is not a ridge height

Keizersgracht 162 published ground −0.02 m, eaves 16.38 and a ridge of **8.94** —
a ridge seven metres below its own eaves. The adapter preferred `b3_h_nok` over
`b3_h_dak_max`; whatever `b3_h_nok` is, it is not a height above NAP. Read as
one it inverted **484 of 6,429** cached buildings, 198 in this boundary, by a
median 1.87 m and as much as 15.8 — and **186 of those pass `b3_val3dity_lod22`**,
so no quality flag catches it.

Ridge now comes from `b3_h_dak_max`, clamped to the 70th percentile plus six
times its distance from the 50th: headroom for a real gable, not for one stray
lidar return. Inversions **484 → 0**; 5,456 ridges move by a median −0.07 m, so
`b3_h_nok` was usually close and occasionally catastrophic.

### The vertical datum drifts within a run, and 78% of it comes out

§15 measured a per-run vertical offset and left it unsolved. It is not per-run —
it drifts.

Solved with no ground level at all: where two runs pass within a metre the true
height is the same, so `z_a − z_b = offset_a − offset_b`. 198,856 such pairs over
687 runs, least squares over the graph they form. The gauge is set afterwards by
putting the fleet median lens at 2.44 m above local ground — the only place a
ground level enters, and only to place the solution, never to shape it.

Scored on **held-out places**, not held-out pairs:

| unknown per | held out |
|---|---|
| whole run | 27% |
| 100 frames | 57% |
| **25 frames (~125 m)** | **78% — median 0.74 m → 0.17 m** |

The holdout had to be rebuilt first. Held out at random, 25-frame segments scored
88%, flattered because two cameras at one spot generate many pairs and a pair's
siblings pin its unknowns. Whole 60 m blocks are held out instead. 89% fitted
against 78% held out is the honest overfitting margin.

Fleet lens above local ground: p05–p95 **0.73–4.57 m → 1.79–3.77 m**, median
2.44. Review deck median **1.15 m → 2.62 m**; cards outside the plausible
1.6–3.6 m fall **43 of 60 → 28**. The rest of that spread is the building's own
`b3_h_maaiveld`, not the camera.

### The machine reviewer, and the two biases it has

`llm-review.ts` grades cards under its own reviewer name so agreement is
*measured*, never assumed. Nine cards judged by both:

| | |
|---|---|
| right-building | 7/9 |
| fit | 2/2 |
| visible | 7/9 |

Both numbers are too small to conclude from, and **both disagreement types are
systematic**, which is worth more than the score:

- **Corner buildings.** Both right-building disagreements are the machine saying
  *yes* where the human says *no*, on a building whose box sits on a face that is
  not the addressed frontage. The machine is over-permissive about which face
  counts, and the first version of the question let it be: a flank is *both* the
  right building and not the façade. There is now an explicit `other-wall`
  answer, scored as a miss.
- **Occlusion.** Both `visible` disagreements are the machine saying *partly*
  where the human says *clear*. It is stricter about a bare tree. The question
  now carries a shared threshold — blocked over more than about a quarter —
  rather than leaving it to taste.

### Also closed

`tsconfig.json` included only `src`, so `npm run lint` — the project typecheck,
part of `check:canal` — **had never looked at `scripts/`**, where this entire
pipeline lives. That is how a `poseOf(view)` call missing a required argument
reached runtime. `tsconfig.scripts.json` and `lint:scripts` close it: 43 errors,
26 in facade-twin, all pre-existing but one. Deliberately not in `check:canal`
until they are cleared, because slipping it in silently would hide how long they
have been there.

Derived records are now rebuildable offline from cached raw responses
(`rebuild-derived.ts`), and nothing in the review path deletes: band tiles carry
their sampling rate, review frames carry the ground and top that made them, decks
are written live and dated. A verdict refers to a picture, and that picture has
to still exist.

### Still open

- 34 frontages still split — separated by more than 4 m or facing more than 8°
  apart, and not yet looked at individually.
- The 43 script type errors.
- Herengracht 178's box sits low enough that its bottom is in the water: the
  datum correction over-corrects on some frames, and the per-frame residual is
  not yet reported on the card.
- The five house-number conflicts from §14 remain unadjudicated.
- Everything downstream of §11 stays quarantined.
