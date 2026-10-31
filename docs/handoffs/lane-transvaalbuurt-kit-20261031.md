# Lane: Transvaalbuurt kit (survey, types, auto-place), 2026-10-31

Branch `lane/transvaalbuurt-kit-20261031`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/transvaalbuurt-kit-20261031`, dev port 4790.
Rules: `docs/handoffs/LANE-RULES.md`. Method: `docs/buurt-generator-20261016.md` and the
B3 brief `docs/handoffs/lane-buurt-autoplace-20261023.md`. Model: Opus for type authoring and
review; Haiku for surveys, batches, compiles and the report.

## Why

The user photographed Albert Luthulistraat 29–31 (Transvaalbuurt, Oud-Oost) on 2026-10-31
and asked whether we have a buurt generator for it: "lots of very similar looking buildings".
We do not. `coverage-v1/buurten.json` says Transvaalbuurt-West (MD01, 592 pands) and
Transvaalbuurt-Oost (MD02, 742 pands) are 0.2 % and 0.1 % modelled, everything else is a
generic box. The clusters confirm the repetition: MD01 has runs of 41 (5 m × 9 m × 1920)
and 38 (6 m × 15 m × 1925) near-identical pands; MD02 has 67 in one 8 m × 15 m × 1910 cluster.
No type library covers Oud-Oost; the nearest are `rivierenbuurt` (Plan Zuid 1934, flat-roof
brick, white frames) and `indische-buurt` (1925–26).

The photo is at `staging/block-face/transvaalbuurt/user-photo-albert-luthulistraat-29-31.png`
(untracked). What it shows, and what the kit must be able to say before this row is accepted:

- Late-1920s dark red brick, four storeys plus a flat roof; a dark (black-glazed) brick
  parapet band under a thin dark coping runs the whole row.
- Three windows per storey per pand, white painted timber frames; the upper two storeys
  have two-light windows with an upper transom, the ground floor has wider three-light
  windows with a dark base course below the sill line.
- One round-cornered stair tower over the shared entrance (two doors, 29 and 31), a storey
  taller than the roof line, with a vertical "brick ladder" of alternating header courses
  and narrow stair windows up its face; cast concrete lintel over the entrance; a flat
  concrete canopy with a short white balustrade on the roof of the neighbouring pand.
- Door numbers as stacked plates (29¹ 29² 29³ 29⁴) beside the entrance: four flats per
  stair.
- Four cast-iron rainwater pipes on the front; small square vent grilles at the first-floor
  sill line.

## Steps

1. **Haiku.** `npm run block-face:buurt-survey -- --buurt=Transvaalbuurt-West --slug=transvaalbuurt-west --intake`
   and the same for `Transvaalbuurt-Oost`. Confirm which buurt holds Albert Luthulistraat 29–31
   (BAG street id 0363300000005879; the street was renamed, so check the BAG name on the
   verblijfsobjecten if the OSM/BAG names disagree) and name its face id in the report.
   1,800 s timeouts; do not poll.
2. **Haiku.** `npm run block-face:auto-place -- --buurt=<slug> --district=rivierenbuurt --review`
   and once with `--district=indische-buurt`, then `block-face:auto-place-calibrate`. Report
   placed / held per face and the faces that place nothing, with their strips. Expect
   most faces to place nothing: that is the clustering input for step 3, not a failure.
3. **Opus.** Cluster the un-placed faces by build year band, storeys, bay width, crown and
   front material. Each cluster of 8 or more faces is a missing type. Author the types in a
   new library `scripts/block-face/types/transvaalbuurt/`, measured from several houses per
   type (storey heights, window heights, head lines, parapet band height), with `match`
   blocks. The Albert Luthulistraat 29–31 row is the first exemplar. Never tune for one face.
4. **Opus.** Add the kit components the photo needs, typed, tested, byte-identical when
   absent (`npm run test:building-recipes`; fit-golden unchanged for other houses). Likely:
   the dark-brick parapet band as a FrontIntent component if `brickStripes`/`entablature`
   cannot already say it; the round stair tower with its brick ladder if `orielHoist` /
   `stairLight` cannot. Say in the report which of these existing modules you reused.
5. **Haiku.** Rerun auto-place against the new library, then
   `node --import tsx scripts/block-face/batch.ts --name=transvaalbuurt-<slug> --buurt=<slug> --district=transvaalbuurt --ride --install`
   per buurt, in ride order. Commit per buurt.
6. **Opus.** Review the run sheets at gallery size beside the strips for false positives
   that pass the edge-NCC gate; hold them. One before/after strip of the Albert
   Luthulistraat row for the user.

## Acceptance

Likeness to the photo, not gates. The Albert Luthulistraat row is accepted only when a
review turn has written `pass` beside the user's photo: parapet band, white frames, the
tower, three windows per pand. Placed share per buurt before and after the new library;
false positives found and held; the kit components added; what the kit still cannot say.

## Budget

About 250 tool turns. Commit what verifies, write state to this file on your branch, hand
back with the LANE-RULES block. Do not push, do not merge. Do not touch `TODO.md`,
`HISTORY.md`, `whats-new-notes.json`, bundles, `covers.json`, goldens.

Checks before hand-back: `npm run -s test:block-face`, `npm run -s test:building-recipes`,
`node --import tsx scripts/block-face/roof-golden.ts`, `npm run lint`. Integrator steps to
list: exposure rows, covers, frontages, buurt pages, strip archiving to
`map-recall2-source-data`, What's New note with the before/after strip.

## State (2026-10-31, lane hand-back)

- Exemplar: face `luthuli-21-41` (Transvaalbuurt-West, odd side; was `luthuli-1-41` before faces were split at the
  street's 25 degree bend), run face `luthuli-21-41-r1` = 25-27, 29-31, 33-35, 37-39 (pands 105200, 142206, 126814,
  128866), installed. Placed by hand from the library: auto-place holds 29-31 on the strip evidence gate and vetoes
  25-27 (BAG 1949, a rebuild of the same front). Review beside the user's photo: **pass** (parapet band with dentils,
  white frames, the tower, two windows plus the stair axis per pand, the canopy). Sheet:
  `staging/block-face/transvaalbuurt/luthuli-29-31-photo-strip-model.png` (untracked).
- Library `scripts/block-face/types/transvaalbuurt/`: `transvaal-1923-portiek-tower`, `transvaal-1923-portiek`.
- Kit: `parapet.band` (buildingRecipe/parapetBand.ts); reused `tower` (flat cap, over axes 1-3), `parapet` + coping,
  `groundCanopy`, `axisGrid`/`bayWidths`/`bayFill`/`storeyAxes`, `axisWindows`. Not reused: `brickStripes` (one
  band colour per house, already the dark parapet brick), `stairLight` (one continuous light, the photo has separate
  stair windows), `orielHoist`.
- Survey: `proposeFaces` splits faces at frontage bends (the chunk's own mean-direction test); 9 faces that failed
  intake now intake. auto-place skips faces with a hand-authored run face.
- Placed share: before (indische-buurt library) West 8/309, Oost 11/460; rivierenbuurt 0/0. After (transvaalbuurt
  library) auto-place 0 in both after review holds (de Wetstraat 37-49 and Tugelaweg 50-52 were false positives);
  installed by hand: West 4 pands (luthuli-21-41-r1). Batch not run: nothing left to install.
- Next: the 1925 Christiaan de Wetstraat / Krugerstraat 14-24 design (lisenes through the parapet, column canopies,
  trapezoid attic lights), the 1920-22 three-storey pitched rows (85 pands, 46 faces) and the Oost 1911-13 five-storey
  pitched rows (70+40 pands); the 695 "every type vetoed" holds are years no type covers.
