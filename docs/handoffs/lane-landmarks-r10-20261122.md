# Lane: landmarks round 10 (2026-11-22, six new landmarks in three helper lanes)

Parent lane `lane/landmarks-r10-20261122` (the r10 leaf, which hands back to the integrator). Each helper works
on its own branch `lane/landmarks-r10-<letter>-20261122`, branched from the parent branch, in its own worktree with
`node_modules` symlinked from `/Users/blackmad/Code/map-recall2/node_modules` (never `npm install`). Use
`/usr/bin/git` for every git command; never `git stash`; never merge or push. Model: opus. Never `pkill`; stop your
dev server by its port's PID (`kill $(lsof -t -iTCP:<port> -sTCP:LISTEN)`). Open data only (Gemeente Amsterdam
panoramas CC BY 4.0, Wikimedia Commons with licence per file, Beeldbank, BAG, 3DBAG, AHN, BGT, OSM; no Google/Apple
imagery, no downloaded meshes). No email in any User-Agent. Disk is tight: set
`PAND_REFERENCE_CACHE=/Users/blackmad/Code/map-recall2/.cache/pand-reference` (shared, read-mostly cache) and keep
your own artifacts small; delete scratch GLB outdirs when done.

## Why

The ranked landmark lists of 2026-11-15 and 2026-11-20 are exhausted. The new list
(`docs/reports/landmark-targets-20261122.json`) ranks recognisable buildings that the game still draws as a generic
block by ride exposure (ride-visibility/v1), centre and inner ring first. Likeness to the photo is the bar, not gates
passing. A held model with the reason written down is a valid outcome; a wrong model is worse than the generic box.

User's standing priorities: window kind, head and pane layout per storey; white/stone accents, bands, cornices and
signage measured from the photo; roof mass from the front photo, not the 3DBAG plane above the crown; symmetric gables;
inventory every relief, sculpture and sign and model them; doors inset with their measured reveal; the front's measured
tint from sunlit crops (the city already reads dark: never darken to "feel historic"); add the kit component a photo
needs (typed, unit-tested, byte-identical when absent) rather than fitting the nearest option, and report what the
kit still cannot say.

## Method

Read `docs/handoffs/LANE-RULES.md`, `docs/START-HERE-buildings.md` §2A, §3, §4 and §6, and
`docs/deepseek-modeling-lanes.md` §B5 and §B8. Do not open `public/canal-drive/TODO.md`, `HISTORY.md` or
`docs/buildings-pipeline.md`. A recent, compact example to copy conventions from: `scripts/landmarks/oostenburgergracht-15-*`
(3DBAG shell via `bag-shell-prepare.ts`, ring-frame slabs from `nearbar-kit.ts`, `paneGrid`, catalogue entry and
dispatcher line in commit 41a3d45f31). Per landmark:

1. **Identity.** Confirm pand ids, addresses, year, architect and name from BAG, the monument register text in the
   brief and nl.wikipedia. If the name below is wrong, use the right one and say so. Check that no catalogue entry,
   `covers.json` model or recipe already draws the pand (`jq` over `src/canalRecall/landmarks/manualCatalogue.json`
   `suppressOsmIds`, `public/canal-drive/models/covers.json` `models[*].p`). If an ordinary/large recipe draws it,
   shadow it via `SHADOWED_BY_LANDMARK` in `src/canalRecall/landmarks/ordinaryModels.ts` in the same commit.
2. **Brief.** `PAND_REFERENCE_CACHE=… node --import tsx scripts/landmarks/landmark-brief.ts --pand=<pand> --id=<id>`
   (cached, quick). Read `artifacts/landmark-briefs/<id>/contact.jpg` and the per-wall crops at full size. Add Commons
   photos (licence per file) where the panoramas miss a side or the roof. List every source in
   `staging/landmarks/<id>/sources.md` (untracked is fine; paste the list in your report).
3. **Inventory first** (`scripts/landmarks/<id>-inventory.json`, schema `src/canalRecall/landmarks/ornamentInventory.ts`).
4. **Measure, then build.** `node --import tsx scripts/landmarks/bag-shell-prepare.ts <id> <pand>` for the shell;
   `<id>-elevations.json` (format `docs/landmark-building-recipe.md` §7), `<id>-spec.json`, `<id>-builder.ts`.
   Every material has a `materialSlot` and a measured `tint`; set `"measuredOverrides": true` in the spec and catalogue
   entry when your wall colours are sampled from sunlit crops (without it the city look lifts brick into its own range;
   see `scripts/landmarks/build-manual-landmarks.ts` ~l.672). Budget < 40,000 triangles, < 500 KB, no textures.
5. **Register.** Catalogue entry (copy the field set of `oostenburgergracht-15`), one dispatcher import + line in
   `scripts/landmarks/build-manual-landmarks.ts`, then
   `node --import tsx scripts/landmarks/build-manual-landmarks.ts --only=<id>`.
6. **Gates.** `npm run audit:glb -- --id=<id>`, `node --import tsx scripts/landmarks/check-glb-openings.ts --id=<id>`,
   `npm run check:landmark-inventory -- --id=<id>`, `npm run check:manual-landmarks`, `npm run compare:facades -- --id=<id>`,
   `npm run check:osm-under-models`, `npm run test:building-taxonomy`, `npm run lint` (or eslint on your files),
   `npm run test:landmark-kits` if you add a kit part. Never loosen a gate, baseline, threshold or allow-list; never add
   a baseline row yourself (report the number; the integrator writes first rows).
7. **Look at it.** Dev server on your private port (`PORT=<port> nohup npx tsx server.ts > /tmp/<id>-dev.log 2>&1 &`).
   Browser runs only through the shared queue: `bash /tmp/canal-pw.sh npm run review:sheet -- --id=<id> --inventory --port=<port>`
   and `bash /tmp/canal-pw.sh node --import tsx scripts/landmarks/ingame-capture.ts --id=<id> --port=<port> --views=… --underlay`
   (desktop + phone; one view from the nearest ride street). One landmark per queued call; never wrap a whole batch.
   Judge each wall beside its photo, bay by bay and item by item; fix what the photo contradicts, rebuild, re-sheet.
   Also capture what the game draws on the pand **today** (the `--underlay` shot, or the same views on the parent
   branch before your model) so the comparison is against the real current drawing.
8. **Blind judge.** Spawn one fresh opus subagent with, per wall, photo | A | B (today vs new, sides randomised, no
   hint which is new) and ask for the better likeness per pair plus an absolute PASS/FIX/HOLD. Record the score.
9. **Sheet for the integrator.** Per landmark one JPEG (q82, ≤ 1600 px wide) under
   `artifacts/r10-sheets/<id>/`: photo | render from the same pose, plus the in-game frame (today and new). Give
   absolute paths in the report.
10. **Commit** per landmark on your branch: builder, spec, footprints, elevations, inventory, brief, catalogue entry,
    dispatcher line, the GLB under `public/canal-drive/models/`, your id's row in
    `public/canal-drive/models/signature-landmarks.json` (the build writes it; check with `/usr/bin/git diff --stat`
    that no other model's row moved, and restore any that did), `model-dates.json`, `modelAssetVersions.json`,
    `modelSourceHashes.json`, material-slot-tags if needed, and any kit part with its test. Do **not** commit
    `covers.json`, `js/*.bundle.js`, goldens, baselines, `TODO.md`, `HISTORY.md`, `package.json` or lockfiles.

## Report (return it as your final message)

LANE-RULES hand-back block (branch, HEAD sha, model, turns), then per landmark: identity (pands, suppressed ids,
shadowed recipe), tris, KB, gates with their summary lines, blind score and your own pass/fail by eye, sheet paths,
what the photo shows that the model still does not, holds with the reason, kit parts added (with test), kit gaps,
sources list, and a two-sentence What's New paragraph (what a rider now sees and where).
