# Lane: landmarks round 5, centrum (2026-11-06, the next twenty, five per lane)

Branch `lane/landmarks-centrum-20261106`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/landmarks-centrum-20261106`, dev port 4650
(`PW_PORT=4650`; Playwright only through `bash /tmp/canal-pw.sh … --workers=1`, named specs, one
run at a time on this machine). Read `docs/handoffs/LANE-RULES.md` first. Use `/usr/bin/git` for every
git command; never `git stash`. Model: opus. Never `pkill`; stop your server by its port's PID. Open
data only (city panoramas CC BY 4.0, Wikimedia Commons with licence per file, Beeldbank, BAG, 3DBAG,
OSM; no Google/Apple imagery, no downloaded meshes). `node_modules` is linked; never `npm install`.

## Why (user, 2026-11-06 23:10)

"use the landmark skill we wrote to finish stedelijk if not done, and the next top twenty landmarks
please". The Stedelijk is done (#221). The landmark-lane factory skill ran first (#234) and found its
buildable list exhausted: every remaining ride-visible candidate is one the kit cannot say (band and
glass fronts, towers) or one an earlier lane left unstarted. So the next twenty are bespoke landmark
lanes, four lanes of five, from `docs/reports/landmark-targets-wide-20261102.json` (ride-visibility
rank, routes passing) plus the picks earlier lanes left unstarted when the programme paused on
2026-11-05. Likeness to the photo at gallery size and from the ride is the bar, not gates passing.
A held model with the reason written down is a valid outcome; a wrong model is worse than the plain
3DBAG box. The user's standing priorities: window kind, head and pane layout per storey, white
accents, speklagen, cornices and signage measured from the photo; roof mass from the front photo,
not the 3DBAG plane above the crown; symmetric gables; inventory every relief, sculpture and sign
and model them; doors inset with their measured reveal; the front's measured tint, never the kit's
default; add the kit component a photo needs (typed, tested, byte-identical when absent) rather than
fitting the nearest option, and report what the kit still cannot say.

## The landmarks, in order (five)

1. **Oude Turfmarkt 139 range (Binnengasthuis side)**, id `oude-turfmarkt-139`. pand 0363100012168172 (recipe `ordinary-0363100012168172` fails likeness); the BAG puts the Allard Pierson address 127/129 on it, so check the overlap with the installed `allard-pierson` first and model only what it does not cover. The earlier lane's uncommitted brief and inventory skeleton are in `/Users/blackmad/Code/map-recall2-worktrees/_pruned-sheets/landmarks-binnengasthuis-20261101/untracked/scripts/landmarks/` (copy them in, verify every line). Confirm every identity fact (pand ids, year, architect, name) from the tiles, the BAG and nl.wikipedia before modelling; if the report's name turns out wrong, use the right one and say so.
2. **Weteringschans corner office**, id `weteringschans-corner-office`. pand 0363100012184747 (recipe `ordinary-0363100012184747`), the unstarted second pick of lane #209 (Tetterode); identify the building and its name from the BAG and the panoramas. Confirm every identity fact (pand ids, year, architect, name) from the tiles, the BAG and nl.wikipedia before modelling; if the report's name turns out wrong, use the right one and say so.
3. **Barlaeus Gymnasium, Weteringschans 29-31**, id `barlaeus-gymnasium`. pand 0363100012169565 (1885, W. Hamer; `scripts/landmarks/schools.json` has notes); rank 23 of the wide report, 31 routes. Confirm every identity fact (pand ids, year, architect, name) from the tiles, the BAG and nl.wikipedia before modelling; if the report's name turns out wrong, use the right one and say so.
4. **The former C&A / 'Brand bij C&A' block, Damrak/Nieuwendijk**, id `brand-bij-ca`. pand 0363100012165746, 32.2 m, 2,868 m², offices/shops; rank 17, 36 routes; factory row is `held` (band front the kit cannot say). Identify the real name and architect first. Confirm every identity fact (pand ids, year, architect, name) from the tiles, the BAG and nl.wikipedia before modelling; if the report's name turns out wrong, use the right one and say so.
5. **DoubleTree by Hilton Amsterdam Centraal Station (Oosterdokseiland)**, id `doubletree-centraal`. OSM parts w1487606275, w1487642120, w1487642112, w1487642116, w1487642118, w1487642115, w1487606284, w1487642117, w240467636, w1487642119, w1487642114, w1487642113, w1487606285, w1487606316, w1487642121, w779659694, w453809679 (27 m, 51,101 m² complex with raised parts); rank 3, 21 routes. Model the hotel block and its skybar as one landmark, suppress exactly the parts you cover; the OBA Oosterdok next door is already modelled, do not touch it. Confirm every identity fact (pand ids, year, architect, name) from the tiles, the BAG and nl.wikipedia before modelling; if the report's name turns out wrong, use the right one and say so.

## Method (the landmark-lane procedure)

Read `docs/handoffs/LANE-RULES.md`, then `docs/START-HERE-buildings.md` §1–§2A (bespoke
landmarks, track A), `docs/deepseek-modeling-lanes.md` §B5 (the step-by-step recipe) and
`docs/landmark-building-recipe.md` §2–§7. Do not open `TODO.md`, `HISTORY.md` or
`buildings-pipeline.md`. Hand back when all five have passed the gates and been looked at, or by
**09:00 CET** with whatever has passed, in the order listed. A held model with the reason written
down is a valid outcome; a wrong model is worse than the plain box.

Per landmark:

1. **Identity.** Pand/part ids, addresses, years, architects, from the tiles and nl.wikipedia.
2. **Photos, open data only.** `node --import tsx scripts/landmarks/landmark-brief.ts --pand=<pand> --id=<id>`
   (or `--at=<lng>,<lat>` for OSM-part-only buildings; read its header) writes the brief and the inventory skeleton from the city panoramas. Add Commons
   photographs with their licences for the Paulus Potterstraat front and the roofs, and the
   Beeldbank where the panoramas miss a side. Write the refs into
   `staging/landmarks/<id>/sources.md` for the integrator to archive.
3. **Inventory first.** `<id>-inventory.json` with every band, panel, sculpture, finial, sign and
   distinctive window order, each with its photo.
4. **Measure, then build.** `<id>-footprints.json` (from the OSM parts and the 2012 pand, plus
   3DBAG heights where a pand exists), `<id>-elevations.json`, `<id>-spec.json`, then
   `scripts/landmarks/<id>-builder.ts` with `BuildingTools` and `house-geometry.ts`; every
   material has a `materialSlot` and a measured `tint`. Budget: < 40,000 triangles, < 500 KB
   per model, no textures. Add kit pieces when the photo needs one the kit cannot say (typed,
   tested, byte-identical when absent) rather than fitting the nearest option, and list what the
   kit still cannot say.
5. **Register.** New catalogue entry in `src/canalRecall/landmarks/manualCatalogue.json` (check
   `manualModels.ts`, the ordinary catalogue and `scripts/building-recipes/houses/` first so you never
   double-cover a pand; a likeness-failing recipe on the pand is shadowed via SHADOWED_BY_LANDMARK as
   earlier lanes did), dispatcher line in `scripts/landmarks/build-manual-landmarks.ts`. Export `node --import tsx scripts/landmarks/build-manual-landmarks.ts --only=<id>`,
   then `npm run build:landmark-lods -- --only=<id>`.
6. **Gates.** `npm run audit:glb -- --id=<id>`, `npm run check:landmark-inventory -- --id=<id>`,
   `npm run check:manual-landmarks`, `npm run compare:facades -- --id=<id>`,
   `npm run check:osm-under-models`, `npm run test:building-taxonomy`, `npm run lint`.
   Never loosen a gate, baseline or threshold. Never add a baseline row yourself; if a photo-true count fails the audit, say so with the number and the photo and the
   integrator writes the first row. Run the audit again after your final export.
7. **Look at it.** Dev server on 4650 (`PORT=4650 nohup npx tsx server.ts > /tmp/<id>-dev.log 2>&1 &`).
   `npm run review:sheet -- --id=<id> --inventory --port=4650` through the lock, then
   `node --import tsx scripts/landmarks/ingame-capture.ts --id=<id> --port=4650 --views=…`
   (desktop + phone). One in-game capture per landmark must be the rider's view from the nearest
   ride route (the report's `routes` count says riders pass it), before and after, desktop and
   phone, and one at gallery size from every street side. Judge each wall beside the photo; fix what the
   photo contradicts before calling it done.
8. **Commit** per landmark on your branch. Never push or merge; never touch `game.js`,
   `index.html`, `package.json`, lockfiles, `public/canal-drive/js/*`, `models/covers.json`,
   `landmark-backlog.json`, goldens, baselines, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`.

## Report

LANE-RULES hand-back block, plus per landmark: ids and parts suppressed, tris, KB, audit result
with the counts and whether each is photo-true, sheet paths, in-game shot paths (desktop, phone,
and the user's view before/after), what the photos show that the model does not, holds. INTEGRATOR
TODO: `npm run build:canal-signature-landmarks`, covers rebuild and `check:covers`, backlog regen,
world recompile, the source refs to archive, the What's New note text.


Strips and in-game shots also go to `blackmad/map-recall2-screenshots` under `landmarks/2026-11-06-r5/centrum/`
(JPEG q82, at most 1600 px wide; commit and push that repo with plain git), never into the game repo.
Scratch builds use your own `--outdir` under `/tmp/landmarks-centrum/`; never write into another
session's scratchpad.

## Report

Post the hand-back on your GitHub issue (`gh issue comment <n> --body-file <file>`) and return the
same text: the LANE-RULES hand-back block (branch, HEAD sha, per-landmark status), plus per landmark:
ids and parts suppressed, tris, KB, audit result with the counts and whether each is photo-true,
sheet paths, in-game shot links (desktop, phone, before/after from the ride), what the photos show
that the model does not, holds with the reason. Then the What's New paragraph per landmark (plain
English: what a rider now sees and where, with the strip links). INTEGRATOR TODO: `npm run
build:canal-signature-landmarks`, covers rebuild and `check:covers`, backlog regen, world recompile,
the source refs to archive, census. Questions only the user can answer go to a `needs-david` issue
assigned to blackmad; keep working on what does not depend on the answer.
