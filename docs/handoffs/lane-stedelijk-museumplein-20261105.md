# Lane: the full Stedelijk and the Albert Heijn on the Museumplein (2026-11-05, #221)

Branch `lane/stedelijk-museumplein-20261105`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/stedelijk-museumplein-20261105`, dev port 4855
(`PW_PORT=4855`; Playwright only through `bash /tmp/canal-pw.sh … --workers=1`, named specs).
Read `docs/handoffs/LANE-RULES.md` first. Use `/usr/bin/git`. Model: opus. Never `pkill`; stop
your server by its port's PID. Open data only (city panoramas CC BY 4.0, Wikimedia Commons with
licence per file, Beeldbank; no Google/Apple imagery, no downloaded meshes). `node_modules` is
linked; never `npm install`.

## Why (user, 2026-11-05, with a screenshot from above the Van Baerlestraat looking over the Museumplein)

"the full stedelijk and the albert heijn in front need to be modeled correctly - we're missing the
old stedelijk building connected to the new bathtub". In the ride today the 2012 bathtub is a white
slab over a generic red-brick block, the 1895 Weissman building reads as a plain brick box with a
grey hipped roof, a pale five-storey kit house stands at the Van Baerlestraat corner in front of it,
and the Albert Heijn is a long low pale shed with punched windows along the Museumplein edge. The
user rides this corner; likeness to the photo at gallery size is the bar.

## What is installed today (verified by the integrator; confirm before touching)

- `stedelijk-museum` in `src/canalRecall/landmarks/manualCatalogue.json` is an early entry with
  no pand ids and no survey: footprint centre 4.879830 E 52.357921 N, heading 66.4°, 100.9 × 82.0 m,
  `suppressOsmIds` w754299889/890/892/893/894/895/896/897/898, model
  `public/canal-drive/models/stedelijk-museum.glb` (89 KB, re-exported 2026-10-31) built by the
  `stedelijk-museum` branch of `scripts/landmarks/cultural-builders.ts` (lines ~30–71: a brick
  grid with gable roofs and three tower boxes behind a white bathtub on a glass ground floor, no
  measurements). Replace that branch with a measured builder and keep the id `stedelijk-museum`
  so covers, backlog and the quiz keep working; update the catalogue entry in place (footprint,
  `surveyed.source`, attribution, `suppressOsmIds`).
- Tile `public/data/extracts/amsterdam/bag-tiles/14/8414/5385.geojson.gz` carries the complex as
  OSM building parts, not BAG pands: w754299893 (14 m hipped, the old building's main mass),
  w754299898 (14 m hipped), w754299888 (9 m hipped, north side, **not suppressed today**),
  w754299889 (28 m pyramidal, the tower), w754299894/895/896/897 (24 m pyramidal, the four corner
  pavilions), w754299890 (17 m, the bathtub) and w754299892 (minHeight 13, the overhang); plus BAG
  pand 0363100012251805 (2012, 17.5 m, osm w754299891, at 4.87953–4.87981 E 52.35733–52.35745 N,
  the south service/entrance volume). Decide from the photos which of these your model covers and
  suppress exactly those; the kit house at the Van Baerlestraat corner in the screenshot is
  probably one of them drawing because the old model does not reach it: find out and say which.
- The Albert Heijn: BAG pand 0363100012082824 (1999, two `passage:` parts in the tile, skillion
  3.48 m, 4.87951–4.88066 E 52.35703–52.35764 N) is the underground supermarket's above-ground
  edge; pand 0363100012225637 (1999, 4.72 m, at 4.88078 E 52.35776 N) is probably its pavilion or
  vent. Not in the catalogue, `manualModels.ts`, `scripts/building-recipes/houses/` or the
  ordinary catalogue.

## The landmarks, in order

1. **Stedelijk Museum, one model, id `stedelijk-museum`.** The 1895 A.W. Weissman building on
   the Paulus Potterstraat (red brick with white stone bands and dressings, the two corner
   pavilions with their roofs, the central section, the dormers and the roof ridge, the Van
   Baerlestraat flank) **joined to** the 2012 Benthem Crouwel "bathtub" (the white composite tub
   cantilevered over the glass ground floor on the Museumplein side, the canopy, the entrance, the
   STEDELIJK lettering, the roof lights) with the junction the photos show (the old building's
   rear wall meets the tub; the glass plinth wraps). Confirm every identity fact from the BAG,
   nl.wikipedia and the panoramas. Inventory the ornament: the stone bands, the name panels and
   the sculpted elements on the Paulus Potterstraat front, the roof finials, the lettering. Similar
   builders to open first: `rietveld-academie-2006-builder.ts` (Benthem Crouwel white volume on a
   glass ground floor, lane #205) and `oranje-nassau-kazerne-builder.ts` (long 19th-century
   measured fronts with pavilions, lane #193).
2. **Albert Heijn Museumplein, id `albert-heijn-museumplein`.** The supermarket is under the
   Museumplein: what stands above ground is the grass-covered sloped roof ("het ezelsoor") rising
   from the Van Baerlestraat side, the glass shopfront in the low wall under its edge facing the
   Stedelijk and the Van Baerlestraat, the entrance with the Albert Heijn lettering, the vent
   pavilion. The game ground is flat, so the grass slope is part of your model (green turf tint
   measured from the orthophoto/panorama, the retaining edge, the stair). Suppress the two
   `passage:` parts of 0363100012082824 (and 0363100012225637 if your model covers it). Do not
   model the rest of the lawn.

## Method (the landmark-lane procedure)

Read `docs/handoffs/LANE-RULES.md`, then `docs/START-HERE-buildings.md` §1–§2A (bespoke
landmarks, track A), `docs/deepseek-modeling-lanes.md` §B5 (the step-by-step recipe) and
`docs/landmark-building-recipe.md` §2–§7. Do not open `TODO.md`, `HISTORY.md` or
`buildings-pipeline.md`. Hand back when both have passed the gates and been looked at, or by
**04:00 CET** with whatever has passed, in the order listed. A held model with the reason written
down is a valid outcome; a wrong model is worse than the plain box.

Per landmark:

1. **Identity.** Pand/part ids, addresses, years, architects, from the tiles and nl.wikipedia.
2. **Photos, open data only.** `node --import tsx scripts/landmarks/landmark-brief.ts --pand=<pand> --id=<id>`
   (for the Stedelijk use the 2012 pand or `--at=<lng>,<lat>` if the script allows; read its
   header) writes the brief and the inventory skeleton from the city panoramas. Add Commons
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
5. **Register.** Catalogue entry (update in place for the Stedelijk, new for the AH), dispatcher
   line in `scripts/landmarks/build-manual-landmarks.ts` (replace the cultural-builders branch
   for the Stedelijk). Export `node --import tsx scripts/landmarks/build-manual-landmarks.ts --only=<id>`,
   then `npm run build:landmark-lods -- --only=<id>`.
6. **Gates.** `npm run audit:glb -- --id=<id>`, `npm run check:landmark-inventory -- --id=<id>`,
   `npm run check:manual-landmarks`, `npm run compare:facades -- --id=<id>`,
   `npm run check:osm-under-models`, `npm run test:building-taxonomy`, `npm run lint`.
   Never loosen a gate, baseline or threshold. If `stedelijk-museum` has a baseline row, never
   raise it; if a photo-true count fails the audit, say so with the number and the photo and the
   integrator writes the first row. Run the audit again after your final export.
7. **Look at it.** Dev server on 4855 (`PORT=4855 nohup npx tsx server.ts > /tmp/<id>-dev.log 2>&1 &`).
   `npm run review:sheet -- --id=<id> --inventory --port=4855` through the lock, then
   `node --import tsx scripts/landmarks/ingame-capture.ts --id=<id> --port=4855 --views=…`
   (desktop + phone). One in-game capture must be the user's view: from above the Van
   Baerlestraat at the Museumplein corner (about 4.8786 E 52.3577 N) looking south-east over the
   Albert Heijn to the Stedelijk, before and after. Judge each wall beside the photo; fix what the
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
