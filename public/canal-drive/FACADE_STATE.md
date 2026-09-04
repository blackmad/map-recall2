# Façade twin — state of the world

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
