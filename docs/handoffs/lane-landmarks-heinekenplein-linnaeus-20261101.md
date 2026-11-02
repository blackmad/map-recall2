# Lane: landmarks round 6, the Heinekenplein block in De Pijp and Politiebureau Oost on the Linnaeusstraat (2026-11-02, #207)

Branch `lane/landmarks-heinekenplein-linnaeus-20261101`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/landmarks-heinekenplein-linnaeus-20261101`, dev port 4853.

## Why

The user: "keep running landmark lanes through the night" and the standing priority on likeness of repeated and recognisable buildings. These picks are installed large recipes that fail the likeness judge (`docs/handoffs/likeness-judge-20261029.md`, 150 FAIL walls among the 95 installed recipes) on ridden routes, to be replaced by bespoke models. Checked by pand id against `manualCatalogue.json`, `manualModels.ts`, `scripts/building-recipes/houses/` and the installed ordinary catalogue `public/canal-drive/ordinary-buildings-data/catalogue.json` before briefing. **Confirm every identity fact from the BAG and nl.wikipedia before measuring.** When your bespoke model replaces an installed recipe, add its ordinary id to `SHADOWED_BY_LANDMARK` in `src/canalRecall/landmarks/ordinaryModels.ts` (typed map, one line per id, with the landmark id as value) so the recipe and the model never both draw, and say so in the report.

## The landmarks, in order

1. **Heinekenplein block**, pand `0363100012130580`, Marie Heinekenplein (De Pijp; the 1995 brick housing-and-shops block with the 32 m round tower at its north end on the Ferdinand Bolstraat / Quellijnstraat corner; confirm the architect, year and addresses from the BAG and nl.wikipedia "Marie Heinekenplein"). Installed as the large recipe `ordinary-0363100012130580` (anchor 4.8925 E, 52.35753 N), which the likeness judge fails on its south wall (wall lightness +0.22 off, glazing band 0.32 against the photo's 0.17) with two unphotographed walls. Id `heinekenplein-block`; shadow the recipe. The Ferdinand Bolstraat, Stadhouderskade and Marie Heinekenplein rides see it constantly. Inventory from the panoramas: the tower and its crown, the brick tones per face, the window order per storey on every face, the shopfronts and awnings on the square, balconies, lettering. Similar builders: `sarphati-plaza-builder.ts` (slab + drum), `byzantium-builder.ts`, `holedWall.ts`, `cut-face.ts`, `paneGrid.ts`.
2. **Politiebureau Oost Watergraafsmeer**, pand `0363100012131469`, Linnaeusstraat 111 (2003; confirm the architect from the BAG and the city's architecture pages). Installed as `ordinary-0363100012131469` (anchor 4.92728 E, 52.35753 N); the judge fails both photographed walls (glazing band off by 0.25 and 0.16, 11 columns against the photo's 18). Id `politie-oost-watergraafsmeer`; shadow the recipe. The Linnaeusstraat ride passes its front. Inventory: the facade materials and column rhythm per storey, the entrance, the POLITIE lettering and shield, the roof. Similar builders: the police builders from lane #206 if merged by then (`ls scripts/landmarks | grep -i politie`), `hoofdbureau` builder, `holedWall.ts`.

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
