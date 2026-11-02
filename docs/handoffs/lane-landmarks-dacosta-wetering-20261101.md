# Lane: landmarks round 6, the Da Costakade 146 factory block and the Weteringschans corner office (2026-11-02, #NNN)

Branch `lane/landmarks-dacosta-wetering-20261101`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/landmarks-dacosta-wetering-20261101`, dev port 4855.

## Why

The user: "keep running landmark lanes through the night" and the standing priority on likeness of repeated and recognisable buildings on ridden routes. These picks are installed large recipes that fail the likeness judge (`docs/handoffs/likeness-judge-20261029.md`) on routes players ride constantly (the Da Costakade and the Weteringschans / Prinsengracht corner), to be replaced by bespoke models. Checked by pand id against `manualCatalogue.json`, `manualModels.ts`, `scripts/building-recipes/houses/` and the installed ordinary catalogue `public/canal-drive/ordinary-buildings-data/catalogue.json` before briefing: both are installed only as large recipes (`scripts/building-recipes/houses/da-costakade-146-236799`, `weteringstraat-16-184747`, with recipe inventories of the same names under `scripts/landmarks/`; `da-costakade-13-*` is a different, bespoke house further down the canal). Use new ids for your bespoke models and leave the recipe files alone. **Confirm every identity fact from the BAG and nl.wikipedia before measuring.** When your bespoke model replaces an installed recipe, add its ordinary id to `SHADOWED_BY_LANDMARK` in `src/canalRecall/landmarks/ordinaryModels.ts` (typed map, one line per id, with the landmark id as value) so the recipe and the model never both draw, and say so in the report.

## The landmarks, in order

1. **Da Costakade 146 factory block**, pand `0363100012236799` (BAG year 1903, 23.4 m; tile 14/8413/5384, centre 4.87245 E, 52.36814 N; Oud-West, between the Da Costakade and the street behind). Catalogue: "1903 factory block, a yellow-brick front of large workshop windows on Da Costakade, a red-brick range with balconies beside it, and a red-brick back range with a lettered band on the street behind"; confirm what the building was and is (the BAG addresses, the lettered band's text, nl.wikipedia or the Amsterdam monument register) before modelling. Installed as `ordinary-0363100012236799`; the judge fails all four walls (canal front 11 columns against the photo's 15, the side's square windows against the photo's tall ones, 7 columns against 13, glazing bands off by 0.19–0.57). Id `da-costakade-146`; shadow the recipe. Inventory from the panoramas: the window order per storey on each face (tall workshop windows, their pane grids), the yellow versus red brick faces with measured tints, the balconies, the lettered band and its text, cornices, roof form and dormers, entrances. Similar builders: `pakhuis-australie-builder.ts` (brick warehouse with measured pane grids), `het-sieraad` builder, `zone-wall-kit.ts` (from lane #206, if merged by then: `ls scripts/landmarks | grep zone`), `holedWall.ts`, `paneGrid.ts`, `mixed-case-glyphs` lettering.
2. **Weteringschans corner office**, pand `0363100012184747` (BAG year 1981, 22.3 m; tile 14/8414/5385, centre 4.89003 E, 52.36043 N; Nieuwe Weteringstraat 16 / Weteringschans at the Prinsengracht corner). Catalogue: "1981 dark-brick office block on a glazed undercroft, stepped to 27 m with copper details"; confirm the address, architect and present use from the BAG and the city's architecture pages. Installed as `ordinary-0363100012184747`; the judge fails three walls and warns on two (a 12.4 m ribbon drawn as 1.6 m windows on storey 1, glazing bands off by 0.20–0.29, mask IoU 0.32–0.38). Id `weteringschans-corner-office`; shadow the recipe. The Weteringschans, Prinsengracht and Nieuwe Weteringstraat rides all pass it. Inventory: the ribbon versus punched windows per storey per face, the glazed undercroft and its columns, the step-backs, the copper details and their measured tint, entrances, any lettering. Similar builders: `sarphati-plaza-builder.ts`, `the-edge` builder, `volkshotel-builder.ts` (ribbons), `holedWall.ts`, `trayStack.ts`.

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
