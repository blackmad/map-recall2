# Lane: courtyard outbuildings, a garden-room kit for the back gardens of the canal-house neighbourhoods (2026-11-01)

Branch `lane/courtyard-outbuildings-20261101`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/courtyard-outbuildings-20261101`, dev port 4817.
Read `docs/handoffs/LANE-RULES.md` first. Use `/usr/bin/git`. Model: opus. Do not open HISTORY, TODO or
`buildings-pipeline.md`.

## Why

The user (2026-11-01): "we should probably build a generator for better outbuildings inside residential
courts, specifically in the nice canal house neighbourhoods." Today every small back-garden pand is drawn by
`src/canalRecall/gardenSheds.ts` as a muted flat box with no openings (read that file and the `gardenShed`
branches in `src/canalRecall/threeBuildingFeatures.ts` and `threeBuildingMesh.ts` first). Inside the box
4.86–4.93 E, 52.35–52.39 N there are 6,049 shed-sized pands (under 25 m², or under 40 m² with eaves under
3.2 m): 4,843 built before 1990, 251 from 1990–2004, 475 from 2005 on, 480 without a year. The chase camera
looks straight into these courtyards, so they are seen on every ride through the ring and the 19th-century belt.

The look the user showed (a Google search for "dutch prefab backyard building amsterdam"): the contemporary
Dutch garden room. Two design families carry nearly all of it:

1. **Timber slat**: vertical (sometimes horizontal) open-joint larch or thermo-wood cladding, warm ochre to
   honey, black anthracite aluminium frames, floor-to-ceiling glass on the side that faces the house, a flat roof
   with a thin dark fascia and a small overhang.
2. **Matte black**: charred or black-stained timber boards or black composite panels, the same glass front and
   flat roof, sometimes one slatted ochre wall beside the glass.

Older sheds (pre-1990, the big majority) stay what they are: weathered board, tarred roof, no glass. The kit is
for the garden rooms, which are the pands built from about 2005 on, plus older pands whose orthophoto roof
says they were rebuilt (a crisp flat EPDM/white or sedum roof on a pre-1990 pand).

## What to build

1. **Classification, typed and pure** (`src/canalRecall/gardenRooms.ts` or inside `gardenSheds.ts`): which
   shed pands become garden rooms. Inputs you already have per feature: BAG year, area, eaves/height, the
   roof-facts stamp (`roofSlot`, `roofMeasured`, `roofTerrace`: see `measuredRoofOf` in
   `threeBuildingFeatures.ts` and `src/canalRecall/roofs/roofSlots.ts`), the courtyard cells
   (`public/data/extracts/amsterdam/courtyards-v1`), and the neighbouring pands of the block. Rule of thumb to
   measure, not assume: year ≥ 2005 → garden room; year < 2005 with a white-membrane, sedum/green or glass
   roof slot at confidence ≥ 6 → garden room; otherwise shed. Report the counts per rule for the centre box.
2. **Orientation**: the glass front faces the main house of the same parcel: the nearest larger pand of the
   block whose footprint lies on the street side of the shed (the courtyards extract and the block's pands give
   this; `streetFronts.ts` knows which edges face a street). When no house can be found, the glass faces the
   longest edge away from any party wall. No glass on a party-wall edge (an edge within 0.3 m of another pand).
3. **Design choice, deterministic per pand id**: 60 % timber slat, 40 % black, with the slat colour and the
   black tone varied inside a measured band (`docs/LOOK.md` "Palette and saturation"; sample the two families'
   tones from the reference photographs in the brief's description: larch ochre around `#b8925a`–`#c9a46b`
   weathering to grey `#9a8f7e`; black `#2a2a28`–`#3a3835`; frames `#2b2d2f`; glass the look's glazing tint;
   fascia dark). Record the hexes you choose with their reason.
4. **Geometry in the chunk builder**: a flat-roofed box at the pand's own 3DBAG height (as today), with: the
   glass wall (one glazing quad set into a dark frame, a door leaf drawn as a frame division), slatted walls
   (slats as a texture cell or vertex-colour stripes, whichever the look system already supports: read
   `src/canalRecall/look/palette.ts` `LOOK_VARIANTS` and the cell layers in `threeBuildingMesh.ts` before
   choosing; a new cell must work in every look variant), a roof lid with a 0.25 m overhang and a 0.15 m
   fascia, and a sedum lid colour when the roof slot says green. Budget: at most 60 triangles per garden room
   beyond the plain box, and nothing drawn beyond the near tier (as sheds today). Byte-identical output for
   every pand that is not a garden room; tests for the classifier, the orientation and the mesh budget.
5. **Look at it**: dev server on 4817 (`PORT=4817 nohup npx tsx server.ts > /tmp/outbuildings-dev.log 2>&1 &`,
   stop it by the port's PID). Before/after frames from the ride camera over three courtyards: one inside the
   canal ring (Keizersgracht/Prinsengracht block in the Jordaan side), one in Oud-Zuid (Museumkwartier), one in
   De Pijp, desktop and phone, through `bash /tmp/canal-pw.sh` (one Playwright run at a time; name the spec,
   `--workers=1`; `tests/e2e/demo-shots.spec.ts` has the spot pattern). Put the PDOK orthophoto crop of each
   courtyard beside the after frame (open data; `scripts/roofs/build-roof-facts.mts` shows the WMTS source)
   so the roof colours and the shed positions can be checked against the real courtyard. Sheets in
   `staging/outbuildings/`.
6. The compiled world (`public/data/extracts/amsterdam/world-v1`, `scripts/world/compile.ts`) bakes the
   chunk output: do not recompile it in the lane; say in the report that the integrator must, and prove your
   change through the live tile path (`?world=live`) in the frames.

## Checks before hand-back

`npm run -s test:look`, `npm run -s test:tile-buildings`, `node --test` for your new test files,
`npm run lint`. Do not touch `game.js`, `index.html`, `package.json`, bundles, `covers.json`, goldens,
baselines, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `world-v1`.

## Report

LANE-RULES hand-back block plus: the classifier counts per rule for the centre box, the palette with reasons,
triangles per garden room, the before/after sheet paths (desktop + phone, three courtyards, with the
orthophoto crops), what the kit still cannot say (pitched garden rooms, pergolas, fences and hedges are
out of scope today; note them), INTEGRATOR TODO (`world-v1` recompile command, What's New note).
