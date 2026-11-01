# Lane: landmarks round 3, the Vijzelstraat: Vijzelbank (Prins en Keizer), Carlton Hotel, the former bank at Vijzelstraat 68-78 (2026-11-01, #182)

Branch `lane/landmarks-vijzelstraat-20261101`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/landmarks-vijzelstraat-20261101`, dev port 4828.

## Why

The user, after the round-1 and round-2 landmarks: "Vijzelbank and buildings around there might be good to model next in landmarks, keep running landmark lanes through the night." Round 3 lanes take two or three landmarks each, picked for being on ridden centre routes and absent from all three model registries (`manualCatalogue.json`, `manualModels.ts`, `scripts/building-recipes/houses/`), checked by footprint centre (nearest installed model > 35 m away). Check again yourself by pand id before building.

## The landmarks, in order

1. **Vijzelbank / Prins en Keizer** (the user asked for this one by name), the 1973 Marius Duintjer bank building on the Vijzelstraat between Keizersgracht and Prinsengracht, renovated 2013 as Duintjer CS, since 2014 Prins en Keizer (offices, shops at street level). It is rank 1 in `docs/reports/landmark-targets-20261029.md` (OSM ways w1489746218, w1489746219, w1489746221, w1489746222; 13,379 m² footprint; 164 routes pass it), approx. 52.3632 N, 4.8921 E. Id `vijzelbank`. Verify the BAG pands (several) from the bag-tiles and give the model every pand it covers. Inventory: the concrete frame with its deep horizontal bands and recessed glazing, the street-level retail gallery under the overhang, the stair/lift towers, the roof plant, the corner on the Keizersgracht and on the Prinsengracht, the canal-side elevations (both canals have panoramas), the "PRINS & KEIZER" lettering if any. Similar builders: `abn-amro-hoofdkantoor-builder.ts` (just landed), `wolkenkrabber-builder.ts`; the `holedWall.ts` kit component (lane #172) cuts real openings through a wall for ribbon windows.
2. **Carlton Hotel** (NH Collection Amsterdam Carlton), Vijzelstraat 2–18 at the Muntplein (1928, G.J. Rutgers; Rijksmonument), approx. 52.3662 N, 4.8931 E. Id `carlton-hotel`. Inventory: the tall brick corner block with its stone base, the vertical window bays, the roof pavilion/tower on the Muntplein corner, the entrance canopy, the lettering and flags, the shops at street level. Similar builders: `hotel-de-l-europe-builder.ts`, `bungehuis-builder.ts`.
3. **The former bank at Vijzelstraat 66–80** (the long bank block south of the Keizersgracht, now offices), approx. 52.3618 N, 4.8920 E; identify the building and its year/architect from BAG and nl Wikipedia before building (it is not De Bazel, which is Vijzelstraat 32 and already installed as `de-bazel`). Id from the name. Inventory from the panoramas: stone base, pier-and-window rhythm, the entrance portal, the set-back roof storey.

## Method (same for every landmark lane today)

Read `docs/handoffs/LANE-RULES.md` first, then `docs/START-HERE-buildings.md` §1–§2A (bespoke
landmarks, track A), then `docs/deepseek-modeling-lanes.md` §B5 (the step-by-step recipe) and
`docs/landmark-building-recipe.md` §2–§7 (identity, research, elevations, acceptance). Open two
installed builders of a similar kind before writing yours (named per landmark below). Do not open
`TODO.md`, `HISTORY.md` or `buildings-pipeline.md`. Use `/usr/bin/git`. Model: opus.

Hand back when every landmark listed has passed the gates and been looked at, or by **06:00 CET** with whatever has passed, in the order listed. A held model with the
reason written down is a valid outcome; a wrong model is worse than the plain box. Do the
landmarks in the order listed; if the first is not through `audit:glb` by 21:00, finish it and
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
