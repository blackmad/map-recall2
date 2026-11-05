# Lane: re-model the Amsterdam underground-container top (2026-11-05, #212)

Branch `lane/container-top-20261105`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/container-top-20261105`, dev port 4854
(`PW_PORT=4854`; Playwright only through `bash /tmp/canal-pw.sh … --workers=1`, named specs).
Read `docs/handoffs/LANE-RULES.md` first. Use `/usr/bin/git`. Model: opus. Never `pkill`; stop
your server by its port's PID. Open data only (Gemeente Amsterdam panoramas, CC BY 4.0; no
Google/Apple imagery). `node_modules` is linked; never `npm install`.

## Why (user, 2026-11-05)

"underground container top needs to be re-modeled" and, the same evening, "the amsterdam trash
bins need to be remodeled". The trash bins the user means are the big square underground
container tops on every corner (their 2026-11-01 words: "trash bins (big square ones)").
13,259 instances come from the waste register (lane #170); the ride draws
`FURNITURE_MODELS.container()` in `src/canalRecall/streetFurniture/models.ts` for all of them.
The user looked at them in the ride and rejected the model. Likeness to the photo is the bar.

## What is wrong today (integrator's read of the #170 sheets, verify it yourself)

The previous lane's evidence is kept at
`/Users/blackmad/Code/map-recall2-worktrees/_pruned-sheets/street-furniture-20261101/staging/street-furniture/`
(`sample-container-{rest,papier,glas}.jpg`, `measure-container-*-*.jpg`,
`sheet-prinsengracht-containers.jpg`, `frames/`). Copy what you reuse into your own
`staging/street-furniture/`. Against those photos the current 52-triangle model reads wrong in
these ways:

1. **Colour.** The real body is graphite/anthracite, near-black with a sheen (RAL 7021-ish),
   not the mid NCS grey `#6c7173` that the frame shows; the plate is a lighter grey steel
   square with a visible edge. Sample the body, drum, plate and the fraction colours from the
   panorama crops with `scripts/street-furniture/sample-colour.ts` (the cyan-cast correction is
   documented in `look/palette.ts` around line 437) and change `STREET_FURNITURE_TONES`.
2. **Shape.** The real column is a hooded pentagon in side profile: vertical front face that
   carries the pictogram, a ~45° sloped face above it holding the stainless rotating drum
   (trommel) **inside the slope**, then a flat top with the small lift mushroom. The sides are
   flat with chamfered top corners, the plan is a rounded-corner rectangle, and the front is
   slightly wider than the back. The current model puts the drum as a flat quad on the vertical
   front and paints the whole slope as the fraction slot; the drum should be a half-cylinder
   recess (or a convex drum) in the slope, in stainless, with the dark mouth under it.
3. **Fraction colour.** In the photos the fraction colour is a band or lid around the drum on
   the slope (glass yellow, paper blue, rest grey/none, textiel, GFT green), not the whole
   slope. Keep exactly the slot faces the ride paints (`isSlot`, `placement.ts fractionHex`,
   test "slot faces exist exactly where the ride paints one"), moved to the band.
4. **The 2020s wide box.** Many rest containers (sample row 2, `afval-188625`, and the
   Prinsengracht sheet) are the newer wider box with a big rounded hood and a drum across the
   full width. Measure both types. If the register's `typeId`/`containertype` (see
   `public/data/extracts/amsterdam/street-furniture/index.json` sources, and
   `extract.ts containerSubtype`) tells the two apart, add a second model id
   (`container-wide`) and place by type; if it does not, say so and keep one model, the one the
   centre has most.
5. **Size.** Re-measure with `scripts/street-furniture/measure.ts` (`--at`, `--pano`, then
   `--rows/--cols`) on at least four containers of each type at ≤ 8 m: column height, front
   width, depth, slope start height, drum diameter, plate size and edge, handle height. Write
   every number with its panorama id into the module header the way #170 did. The present
   column is 1.22 m on a 1.45 m plate; do not keep a number you did not re-read.

## Steps

1. Measure (step 5 above) and sample colours; write `staging/street-furniture/container-measurements.md`.
2. Rebuild `containerModel()` (and `containerWideModel()` if 4 applies) in `models.ts`, flat-shaded
   vertex colours, ≤ 160 triangles each (the drum recess needs more than the old 52; say the
   count). Update `DIMENSIONS.container`, `streetFurniture.test.ts` (triangle count, heights,
   slot count) and `placement.ts` if a second model id exists (`FurnitureModelId`,
   `FURNITURE_MODEL_IDS`, `export-models.ts` picks them up).
3. Re-export the gallery GLBs and catalogue: `npx tsx scripts/street-furniture/export-models.ts`
   (writes `public/canal-drive/models/street-furniture/*.glb` and
   `public/canal-drive/street-furniture/catalogue.json`; commit both, they are the lane's).
   Check the turntable on `public/canal-drive/street-furniture.html` at your port.
4. Look at it in the ride: `tests/e2e/street-furniture-shots.spec.ts` with the spots in
   `tests/e2e/street-furniture-spots.ts` (add a second container spot in the Pijp or Oud-West at
   a cluster of three fractions if the Prinsengracht one shows only rest), then
   `npx tsx scripts/street-furniture/likeness-sheet.ts`. Judge the sheet beside the panorama at
   gallery size (crop the container region of the desktop frame to ~600 px and put the
   panorama crop beside it: that is the view the user judges). Iterate until the silhouette,
   the drum and the colours match. Desktop and iPhone rows both.
5. Perf: the ride draws one instanced mesh per model id; a second id is one more draw. Report
   triangles on screen at the Prinsengracht spot before/after (`tests/e2e/ride-perf.spec.ts`,
   `GL_COUNTERS=1`, `?engine=own`), and keep the engine lanes' budget: no new GL program.

## Checks before hand-back

`npm run lint`; `node --import tsx --test src/canalRecall/streetFurniture/streetFurniture.test.ts`;
`npm run -s test:engine`; `npm run -s test:look`; `npm run -s test:building-taxonomy`; the
shots spec and perf spec (named, `--workers=1`, through `/tmp/canal-pw.sh`).

## Report

LANE-RULES hand-back block plus: the measurements table (number, panorama id, distance), the
sampled colours before/after, triangle count per model, draws/triangles before/after, the
likeness sheet paths and the gallery-size crop pair for each type, what the kit cannot yet say,
and the INTEGRATOR TODO: the `street-furniture-source.js` bundle to rebuild
(`scripts/build-3d-bundles.mjs`), `content-stats.ts` regen if the model count changed,
`model-first-added` regen, the What's New note text with the before/after pairs (which files).
Commit on your branch as you go; do not merge or push. Do not touch `TODO.md`, `HISTORY.md`,
`whats-new-notes.json`, `index.html`, `game.js`, `package.json`, bundles under
`public/canal-drive/js/`, `covers.json`, goldens, baselines.
