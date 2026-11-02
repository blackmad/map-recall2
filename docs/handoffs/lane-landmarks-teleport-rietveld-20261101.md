# Lane: landmarks round 6, the KPN building at Teleport (Sloterdijk) and the Gerrit Rietveld Academie (2026-11-02, #203)

Branch `lane/landmarks-teleport-rietveld-20261101`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/landmarks-teleport-rietveld-20261101`, dev port 4849.

## Why

The user: "keep running landmark lanes through the night". Picks come from a wider re-run of the ride-visibility ranking (`scripts/building-recipes/landmark-targets.ts`, 1,200 seeded routes, 2026-11-02), checked by pand id, by name without spaces and by footprint distance against `manualCatalogue.json`, `manualModels.ts` and `scripts/building-recipes/houses/` before briefing. Facts in this brief come from the ranking, OSM, the monument register line and the BAG tiles only: **confirm every identity fact (address, build year, architect, present use) from the BAG and nl.wikipedia before measuring**; four briefs this week carried wrong addresses or architects from memory.

## The landmarks, in order

1. **KPN Teleport**, pand `0363100012165158` (BAG build year 2014 per the tiles; 3,691 m² footprint, 28.9 m; offices with a courtyard; the ranking lists it at rank 16 with 14 routes on the Sloterdijk / Haarlemmerweg rides). Approx. 52.38823 N, 4.84167 E; nearest installed models are `sloterdijk-station` 250 m and `petruskerk` 372 m away. **Identify it first**: the OSM name "KPN Teleport" may be a tenant name; confirm from the BAG (address, VBOs) and nl.wikipedia/architecture sources what the building is, its architect and year, and whether a 2014 renovation hides an older frame. Id `kpn-teleport` (rename to the building's real name if the BAG gives one). Inventory from the panoramas: the facade grid, cladding colours, the courtyard opening, the entrance, lettering and roof plant. Similar builders: `the-edge-builder.ts`, `akzonobel-center-builder.ts`, `wtc-amsterdam-builder.ts`, `holedWall.ts`.
2. **Gerrit Rietveld Academie**, Fred. Roeskestraat 96 (Gerrit Rietveld's own 1967 academy building, glass and steel on a concrete frame, rijksmonument; plus the 2004 Benthem Crouwel extension and the 2019 Fedlev building, confirm which pands). **The brief gives no pand id**: locate it from the BAG by address (PDOK BAG WFS, or `node --import tsx scripts/landmarks/pand-near.ts --lat=<lat> --lng=<lng> --radius=60` once you have the coordinate from the BAG address lookup) and check `manualCatalogue.json` by pand id and by name without spaces (`rietveld`, `roeskestraat`); nothing with those names is installed as of this brief. The Fred. Roeskestraat / Amstelveenseweg and Zuidas rides see it. Id `gerrit-rietveld-academie`. Inventory: the glazed curtain wall and its mullion rhythm per storey, the concrete frame, the roof line, the extension's volume and cladding, lettering, the entrance. Similar builders: `academie-van-bouwkunst` builder (`ls scripts/landmarks | grep -i academie`), `the-edge-builder.ts`, `holedWall.ts`.

## Method (same for every landmark lane today)

Read `docs/handoffs/LANE-RULES.md` first, then `docs/START-HERE-buildings.md` §1–§2A (bespoke
landmarks, track A), then `docs/deepseek-modeling-lanes.md` §B5 (the step-by-step recipe) and
`docs/landmark-building-recipe.md` §2–§7 (identity, research, elevations, acceptance). Open two
installed builders of a similar kind before writing yours (named per landmark below). Do not open
`TODO.md`, `HISTORY.md` or `buildings-pipeline.md`. Use `/usr/bin/git`. Model: opus.

Hand back when both landmarks have passed the gates and been looked at, or by **20:00 CET** with whatever has passed, in the order listed. A held model with the
reason written down is a valid outcome; a wrong model is worse than the plain box. Do the
landmarks in the order listed; if the first is not through `audit:glb` after five hours, finish it and
report the second as not started.

Per landmark:

1. **Identity.** BAG pand id(s) and address (PDOK BAG WFS or the tiles under
   `public/data/extracts/amsterdam/bag-tiles/14`), build year, architect, what stands there
   today. Check nobody did it already: `grep -n "<id or pand>"
   src/canalRecall/landmarks/manualCatalogue.json`, `ls scripts/landmarks | grep -i <name>`,
   `/usr/bin/git log --oneline origin/main -i --grep "<name>" | head`.
2. **Photos, open data only.** `node --import tsx scripts/landmarks/landmark-brief.ts
   --pand=<pand> --id=<id>` writes the brief and the inventory skeleton from the city panoramas
   (CC BY 4.0). Add Wikimedia Commons photographs (check each file's licence) and the Beeldbank
   where the panoramas miss a side. No Google or Apple imagery, no downloaded meshes. Archive the
   photo references the way `docs/landmark-building-recipe.md` §3 says (the source-data repo at
   `MAP_RECALL_SOURCE_DATA=/Users/blackmad/Code/map-recall2-source-data`; the integrator commits
   it, so write the refs into your worktree's `staging/landmarks/<id>/sources.md` and say so).
3. **Inventory first.** `<id>-inventory.json`: every relief, sculpture, sign, clock, crest,
   lantern, turret, dome, lettering and distinctive window order the photos show, with the
   photo it comes from. The Hoofdbureau's coat of arms was missed once; the user checks this.
4. **Measure, then build.** `<id>-footprints.json` from BAG/3DBAG, `<id>-elevations.json`
   (openings per storey per wall, from the photos), `<id>-spec.json`, then
   `scripts/landmarks/<id>-builder.ts` using `BuildingTools` (`cultural-builders.ts`) and
   `house-geometry.ts`. Every material has a `materialSlot` and a measured `tint`
   (`docs/LOOK.md` "Palette and saturation"). Budget: < 40,000 triangles, < 500 KB, no textures.
5. **Register.** One entry in `src/canalRecall/landmarks/manualCatalogue.json` (footprint
   centre/heading/length/width, `surveyed.source`, attribution with licences, `suppressOsmIds`)
   and one dispatcher line in `scripts/landmarks/build-manual-landmarks.ts`. Export:
   `node --import tsx scripts/landmarks/build-manual-landmarks.ts --only=<id>`, then
   `npm run build:landmark-lods -- --only=<id>`.
6. **Gates.** `npm run audit:glb -- --id=<id>`, `npm run check:landmark-inventory -- --id=<id>`,
   `npm run check:manual-landmarks`, `npm run compare:facades -- --id=<id>`,
   `npm run check:osm-under-models`, `npm run test:building-taxonomy`, `npm run lint`.
   Never loosen a gate, baseline or threshold.
7. **Look at it.** Dev server on your port (`PORT=<port> nohup npx tsx server.ts > /tmp/<id>-dev.log 2>&1 &`;
   stop it by the port's PID). `npm run review:sheet -- --id=<id> --inventory --port=<port>`
   through `bash /tmp/canal-pw.sh` (one Playwright run on the machine at a time; name the spec,
   never a directory). Then `node --import tsx scripts/landmarks/ingame-capture.ts --id=<id>
   --port=<port> --views=<street>:<bearing>,...` (desktop + phone, also through the lock) for
   the What's New note. Judge the sheet beside the photo per wall: window order, crown, colour,
   the inventory items. Fix what the photo contradicts before calling it done. Likeness to the
   photo is the bar, not gates passing.
8. **Commit** per landmark on your branch (builder, JSONs, catalogue entry, dispatcher line, the
   GLB and its lod1). Never push, never merge, never touch `game.js`, `index.html`,
   `package.json`, lockfiles, `public/canal-drive/js/*` bundles, `models/covers.json`,
   `landmark-backlog.json`, goldens, baselines, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`.
   The other landmark lanes tonight append to the same catalogue and dispatcher; append at the
   end, touch nothing else in those files, and the integrator union-merges.

## Report

LANE-RULES hand-back block, plus per landmark: pand id, tris, KB, audit result, the sheet path,
the in-game shot paths (desktop and phone), what the photos show that the model does not, and
the holds with reasons. INTEGRATOR TODO: `npm run build:canal-signature-landmarks`, covers
(`node --max-old-space-size=8192 --import tsx scripts/build-covers.ts
--tiles=public/data/extracts/amsterdam/bag-tiles/14`), `npm run check:covers`, backlog regen
(`scripts/landmarks/build-poi-backlog.ts`), the source-data refs to archive.
