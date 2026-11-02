# Lane: landmarks round 5, Sarphati Plaza at the Rhijnspoorplein and the Apollo hotel on the Apollolaan (2026-11-02, #199)

Branch `lane/landmarks-sarphati-apollo-20261101`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/landmarks-sarphati-apollo-20261101`, dev port 4845.

## Why

The user: "keep running landmark lanes through the night". Two buildings on ridden routes from the ride-visibility report (`docs/reports/landmark-targets-20261029.md`, rows 23 and 29), checked by pand id and by footprint distance (nearest installed model 165 m and 180 m) against `manualCatalogue.json`, `manualModels.ts` and `scripts/building-recipes/houses/` before briefing. Facts in this brief come from the report, OSM and the BAG tiles only: **confirm every identity fact (address, build year, architect, present use) from the BAG and nl.wikipedia before measuring**; four briefs this week carried wrong addresses or architects from memory.

## The landmarks, in order

1. **Sarphati Plaza**, pand `0363100012182840`, Rhijnspoorplein (BAG build year 1992; 890 m² footprint, 39.1 m; the report reads other use, housing, offices; the postmodern tower at the Weesperplein / Rhijnspoorplein corner with its stepped crown; confirm architect and name from nl.wikipedia or the Amsterdam monument pages). Approx. 52.36088 N, 4.90773 E, 165 m from the installed `hva-rhijnspoorplein-2`. Id `sarphati-plaza`. The Weesperplein, Sarphatistraat and Wibautstraat rides see it. Inventory from the panoramas: the crown and set-backs, cladding bands and colours, the window order per storey, the entrance, lettering. Similar builders: `wolkenkrabber-builder.ts`, `byzantium-builder.ts` (slab + tower), `tier-kit.ts` for stepped crowns, `holedWall.ts`.
2. **Apollo hotel**, pand `0363100012148632`, Apollolaan 2 (BAG build year 1928; 3,014 m² footprint, 24.5 m; the report reads lodging, courtyard geometry; the hotel on the point where the Noorder Amstelkanaal and the Boerenwetering meet, with its later wings; confirm the original architect and the extensions from nl.wikipedia/BAG). Approx. 52.3488 N, 4.88504 E; nearest installed models are the Kinderbrug sculptures 180 m away; `scripts/building-recipes/houses/apollolaan-4-134507` is a different pand (134507), check it is not the same building. Id `apollo-hotel`. The Apollolaan and canal-side rides see it. Inventory: the water-facing front, balconies and terraces, the roof form, the entrance porte-cochère, lettering, canopies. Similar builders: `amstel-hotel` builder (`ls scripts/landmarks | grep -i amstel-hotel`), `carlton-hotel-builder.ts`, `holedWall.ts`.

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
