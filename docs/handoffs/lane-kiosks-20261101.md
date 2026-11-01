# Lane: notable stall and kiosk businesses (2026-11-01, #180)

Branch `lane/kiosks-20261101`, worktree `/Users/blackmad/Code/map-recall2-worktrees/kiosks-20261101`, dev port 4826.

## Why

The user: "I have been thinking about notable 'stall' businesses - dr falafel, mr blau, dumplings - what others?" and then "figure it out". These are the small freestanding food kiosks a rider passes at bridges, squares and quays; none has a model and only some are branded POI points. They become **landmarks** (bespoke track A, `manualCatalogue.json`, landmark category, so they get cards and can be quiz destinations like the sculptures), built from one typed **kiosk kit** (`src/canalRecall/kiosks/` or `scripts/landmarks/kiosk-kit.ts`, your call, typed and unit-tested) with per-kiosk measurements and branding, not ten hand-built one-offs. Kit variants the photos will need: the green/brown wooden herring kiosk with the fold-up hatch and awning, the modern glass-and-steel kiosk, the food trailer/cart, the floating Bloemenmarkt stall (a barge-mounted greenhouse). Add variants when a photo shows one the kit cannot express; report what it still cannot say.

## Footprints and identity

A kiosk is rarely a BAG pand. Three sources, in this order: (1) a BAG pand under the point in `public/data/extracts/amsterdam/bag-tiles/14` (Frens on the Koningsplein and the Museumplein kiosk are panden); (2) a BAG *standplaats* (357 citywide, 45 in the centre; WGS84 centroids, areas and ids in `staging/kiosks/standplaatsen-wgs84.json`, from `https://api.data.amsterdam.nl/v1/bag/standplaatsen/`; Stubbe's and Pat's at the Haarlemmersluis are `0363030011957762` 13.4 m² and `0363030011957763` 17.8 m²); (3) measured from the city panorama and the PDOK orthophoto when neither exists (Dr Falafel, Mr Blou). Write which source each footprint came from in the catalogue entry's `surveyed.source`.

## The kiosks, in ride-priority order

1. **Dr Falafel**, Nassaukade by the De Clercqstraat bridge and tram stop, listed as Nassaukade 900, approx. 52.368233 N, 4.876326 E. A one-person kiosk at the roadside. Id `kiosk-dr-falafel`.
2. **Mr Blou I Love You** (the user wrote "mr blau"), Elandsgracht 150, 52.369214 N, 4.877176 E. A small vegan falafel stand/trailer. Id `kiosk-mr-blou`.
3. **Dumplings**, Nassauplein 60, approx. 52.3812 N, 4.8778 E, a small kiosk by the Westerpark side of the square (nearest standplaats `0363030011957715` 6.9 m² at 52.381309, 4.879543 is 119 m east: verify which is right from the panorama). Id `kiosk-dumplings-nassauplein`.
4. **Frens Haringhandel**, Koningsplein, 52.36729 N, 4.88944 E (branded POI `local-food-609`). The green herring kiosk. Id `kiosk-frens-haringhandel`.
5. **Stubbe's Haring**, Haarlemmersluis / Singel, standplaats `0363030011957762`, and **Pat's Poffertjes** beside it, `0363030011957763` (POI `local-food-2394`). Ids `kiosk-stubbes-haring`, `kiosk-pats-poffertjes`.
6. **The Spui herring stand** (identify the name from the panorama and the branded POIs), approx. 52.3690 N, 4.8895 E. Id from the name.
7. **Bloemenmarkt**, the floating flower stalls on the Singel between Koningsplein and the Munt: one kit stall repeated along the quay from the orthophoto (count them), one catalogue entry `bloemenmarkt-stalls` for the row. The user's rides pass here constantly.
8. **Kiosk Rembrandt / Van Gogh** on the Museumplein, 52.35925 N, 4.88314 E (POI `local-food-2439`); BAG pand likely. Id `kiosk-museumplein`.
9. **Ramon's Coffee Kiosk**, 52.38985 N, 4.89105 E (POI `local-food-2588`). Id `kiosk-ramons-coffee`.
10. **Park Kiosk BEA**, 52.34356 N, 4.88432 E (POI `local-food-2273`). Id `kiosk-park-bea`.

Not kiosks (skip unless the panorama proves otherwise): Kauffmann Falafel, Le Falafel, Frites & Frites, Vleminckx, Manneken Pis (shopfronts in buildings).

## Method (same for every landmark lane today)

Read `docs/handoffs/LANE-RULES.md` first, then `docs/START-HERE-buildings.md` §1–§2A (bespoke
landmarks, track A), then `docs/deepseek-modeling-lanes.md` §B5 (the step-by-step recipe) and
`docs/landmark-building-recipe.md` §2–§7 (identity, research, elevations, acceptance). Open two
installed builders of a similar kind before writing yours (named per landmark below). Do not open
`TODO.md`, `HISTORY.md` or `buildings-pipeline.md`. Use `/usr/bin/git`. Model: opus.

Hand back by **04:00 CET** with whatever has passed, in the order listed; a kiosk not started is reported as not started. A held model with the
reason written down is a valid outcome; a wrong model is worse than the plain box. Do the
landmarks in the order listed; if the first is not through `audit:glb` by 21:00, finish it and
report the second as not started.

Per kiosk (the landmark track applies; a kiosk is a tiny landmark):

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
   (`docs/LOOK.md` "Palette and saturation"). Budget per kiosk: < 3,000 triangles, < 60 KB, no textures; lettering as geometry or flat vertex-colour panels.
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
   Five landmark lanes tonight append to the same catalogue and dispatcher; append at the
   end, touch nothing else in those files, and the integrator union-merges.

## Report

LANE-RULES hand-back block, plus per landmark: pand id, tris, KB, audit result, the sheet path,
the in-game shot paths (desktop and phone), what the photos show that the model does not, and
the holds with reasons. INTEGRATOR TODO: `npm run build:canal-signature-landmarks`, covers
(`node --max-old-space-size=8192 --import tsx scripts/build-covers.ts
--tiles=public/data/extracts/amsterdam/bag-tiles/14`), `npm run check:covers`, backlog regen
(`scripts/landmarks/build-poi-backlog.ts`), the source-data refs to archive.
