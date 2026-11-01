# Lane: Huis met de Hoofden and the Lensbomen sculpture (2026-11-01)

Branch `lane/landmarks-keizersgracht-20261101`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/landmarks-keizersgracht-20261101`, dev port 4813.

## Why

The user wants ten new landmark buildings in the game by the end of today, and asked for the
Lensbomen sculpture by name after seeing photos of it. Six lanes take two items each.

## The landmarks, in order

1. **Huis met de Hoofden**, Keizersgracht 123 (1622, attributed to Hendrick de Keyser /
   Pieter de Keyser; a Rijksmonument, now the Embassy of the Free Mind). Approx. 52.3773 N,
   4.8858 E. Id `huis-met-de-hoofden`. Inventory: the six sculpted heads on the front (Apollo,
   Ceres, Mars, Minerva, Bacchus, Diana), the stepped gable with its ornaments, the red brick
   with sandstone bands and the cross windows, the double stoop and the entrance, the side
   wing. Similar builders: `huis-bartolotti-builder.ts`, `huis-de-pinto-builder.ts`.
2. **Lensbomen ("3 bomen, 6 lenzen")**, Thom Puckey, a sculpture on the UvA Roeterseiland
   campus; OSM node n4360169260 at 52.3686724 N, 4.8944688 E, Wikidata Q26453081 (verify the
   exact spot and the year on Wikidata, nl.wikipedia and the Stadscuratorium / Buitenbeeldinbeeld
   pages). Id `lensbomen`, `assetKind: "memorial"` like `rembrandtmonument` and `homomonument`
   (open those two catalogue entries and `rembrandtmonument-builder.ts`; a sculpture has a
   footprint but no BAG pand, so `landmark-brief.ts --pand` does not apply; pull the panoramas
   with `scripts/pand-reference` by coordinate instead). What to model: three tapered black
   bronze trunks about 8–10 m tall (measure against the four-storey block behind them in the
   photos), each forking into two or three curved branches, carrying six round translucent
   glass lenses (pale, slightly amber in the photos) about 1.2–1.5 m across held between the
   branches. Inventory the trunk count, the branch count per trunk, the lens count and the
   lens diameters from the Commons photographs. Materials: a near-black bronze slot for the
   trunks and a pale translucent glass tint for the lenses. Keep the OSM node as the POI; do
   not suppress the buildings behind.


## Method (same for every landmark lane today)

Read `docs/handoffs/LANE-RULES.md` first, then `docs/START-HERE-buildings.md` §1–§2A (bespoke
landmarks, track A), then `docs/deepseek-modeling-lanes.md` §B5 (the step-by-step recipe) and
`docs/landmark-building-recipe.md` §2–§7 (identity, research, elevations, acceptance). Open two
installed builders of a similar kind before writing yours (named per landmark below). Do not open
`TODO.md`, `HISTORY.md` or `buildings-pipeline.md`. Use `/usr/bin/git`. Model: opus.

Deadline: hand back by **22:30 CET today** with whatever has passed. A held model with the
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
   The other five landmark lanes today append to the same catalogue and dispatcher; append at the
   end, touch nothing else in those files, and the integrator union-merges.

## Report

LANE-RULES hand-back block, plus per landmark: pand id, tris, KB, audit result, the sheet path,
the in-game shot paths (desktop and phone), what the photos show that the model does not, and
the holds with reasons. INTEGRATOR TODO: `npm run build:canal-signature-landmarks`, covers
(`node --max-old-space-size=8192 --import tsx scripts/build-covers.ts
--tiles=public/data/extracts/amsterdam/bag-tiles/14`), `npm run check:covers`, backlog regen
(`scripts/landmarks/build-poi-backlog.ts`), the source-data refs to archive.
