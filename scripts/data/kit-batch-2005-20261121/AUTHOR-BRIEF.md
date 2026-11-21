# Kit batch 2005+: authoring brief for a block (lane kit-batch-2005-20261121)

You author large-tier kit recipes for 2005+ block-sized housing in Amsterdam (Map Recall, a cycling game). The lane
integrator (who spawned you) does the in-game frames, the blind judge and the install. Your job ends at a recipe whose
gates pass and whose contact sheets you have compared against the photos yourself.

## Setup (every Bash call; the shell does not keep state)

    cd /Users/blackmad/Code/map-recall2-worktrees/kit-batch-2005-20261121
    export MAP_RECALL_SOURCE_DATA=/Users/blackmad/Code/map-recall2-worktrees/source-data-kit-batch-2005-20261121
    export PAND_REFERENCE_CACHE=/Users/blackmad/Code/map-recall2/.cache/pand-reference

Rules: use `/usr/bin/git` only and never commit (the integrator commits); never run `npm install`; no browser or
Playwright; open data only (Gemeente Amsterdam panoramas, 3DBAG/BAG/BGT/OSM); no email in any User-Agent. Disk is tight:
write scratch images only under `/private/tmp/claude-501/-Users-blackmad-Code-map-recall2/15ce6035-e162-42bd-acac-d42af720eda1/scratchpad/<your name>/`.
Edit only `scripts/building-recipes/houses/<your ids>/` and `scripts/data/kit-batch-2005-20261121/allow-<id>.txt`.
Do not touch goldens, the catalogue, TODO/HISTORY or any other house.

## Steps per block

1. **Facts and draft** (once per pand; your own queue file so lanes do not race):

       python3 -c "import json;q=json.load(open('scripts/data/kit-batch-2005-20261121/queue.json'));q['items']=[i for i in q['items'] if i['pand'] in ('<pand1>','<pand2>')];json.dump(q,open('/private/tmp/claude-501/-Users-blackmad-Code-map-recall2/15ce6035-e162-42bd-acac-d42af720eda1/scratchpad/q-<your name>.json','w'))"
       node --import tsx scripts/landmarks/factory.ts --queue=/private/tmp/claude-501/-Users-blackmad-Code-map-recall2/15ce6035-e162-42bd-acac-d42af720eda1/scratchpad/q-<your name>.json --pands=<pand> --stage=crops,facts,draft --owner=kit-batch-2005

   The house id is the queue item's `house`. Crops: `$MAP_RECALL_SOURCE_DATA/pand-reference-walls/<pand>/walls.json` and
   `w<NN>-<bearing>.jpg` (rectified, straight-on; x runs along the wall, `ppm` px per metre, top = `baseZ + wallHeightM`).
   If the crops for a wall are pre-completion (building site, scaffold) or behind trees, re-crop with a date filter:
   `node --import tsx scripts/pand-reference/all-walls.ts --pand=<pand> --archive --min-len=8 --max=12 --date=2023,2024,2025 --walls=<NN> --suffix=d25`.
2. **Panels.** `node --import tsx scripts/building-recipes/walls.ts --house=<id> --detail` lists each 3DBAG panel (bearing,
   width, eaves, surfaces and where each surface sits along the panel) and writes `artifacts/building-recipes/<id>/walls-plan.png`.
   Match each street crop to its panel by bearing and length.
3. **Read the photo.** Count storeys and window axes per wall. `node scripts/data/kit-batch-2005-20261121/grid.mjs <crop.jpg> <out.jpg> <bays>`
   draws a bay grid over a crop. Note material changes (plinth brick, render, timber, panels), window type and frames,
   balconies (staggered slabs, stacked columns, loggias), ground (shops, residential doors, storage doors, pilotis), roofline.
4. **Write the intent** by hand over the factory draft (`intent.json`; the draft is crude: 8-group cap, unphotographed
   walls blank). Keep `sources` to the crops you actually read, recent first. Remove `draftedBy` and `measured`. Write a
   real `address` line and `notes` naming panel -> crop -> date for each group. Schema: `src/canalRecall/buildingRecipe/intent.ts`
   (`LargeBuildingIntent`, `LargeWallIntent`, `LargeHouseIntent`), validator `largeIntent.ts`, README
   `scripts/building-recipes/README.md` ("Housing-block kit"), kit tests `src/canalRecall/buildingRecipe/largeKitGaps.test.ts`.
   Worked example of this lane: `scripts/building-recipes/houses/nida-senffstraat-5-201-247342/intent.json`.
   - `otherWalls: "window-grid"` (courtyards and walls without a crop), `closedBands: true`, `shellRepair: true`,
     `budgetTriangles` at most 30000 (lower when you can).
   - Per group: `system` (usually `brick-bay-grid`), `storeys`, `baysPerStorey`, `windowShape {w, h, sill}` (fractions of
     bay / storey), `windows` (plain, two-light, cross, transom, ...), `palette {brick, frame, stone, glass}`, `ground`,
     `hand: [...]` listing the fields you read by hand.
   - **Per-house components** (`houses[]`, shares of the main panel, left to right facing the wall): own `storeys`,
     `ownEaves: true` when the photo shows that part taller or lower (otherwise a row-coherence clamp moves its eaves),
     `ground`, `residential`, `brickStoreys`, `blankStoreys`, `windowShape`, `brick`, `balconies`, `loggias`, `ribbonStoreys`.
   - **renderPanels** (proud render bays round windows) and **accentPanels** (flush per-cell panels: pale jamb panels,
     coloured spandrels, timber strips): `{bays:[a,b], storeys:[a,b], colour, along:[from,to], up:[from,to]}`.
   - **Loggias** with `lining` (returns and back wall colour), `back: "door-window"`.
   - **balconyBands** `{storeys: [], spans: [{storey, bays: [[a,b]]}], deep (<= 0.7 of a storey), rail, kind: solid|glass|bars, colour, railColour}`
     for staggered or stacked cantilever slabs; `storeys: []` is required when only spans are given. `kind: "solid"` in
     a pale colour read better than `glass` for pale glass-railed slabs.
   - `ground: "residential"` with `residential: {pattern: [...door|storage|window|wall per bay], doors: "#hex"}` ONLY
     where the plinth is brick (or render) with punched doors. Never on a continuous glazed plinth: use
     `plinth-shopfronts` / `glazed` there (a blind judge rejected residential doors on a glazed plinth).
   - Dark brick plinths: `brickStoreys: [{storeys: [0], brick: "#hex"}]` (per group or per house).
   - **Do not give houses piers the photo does not have** (lost a blind on Zeeburgerdijk).
5. **Compile:** `node --import tsx scripts/building-recipes/large.ts --house=<id>` (about 20 s). Reads gates and likeness;
   writes `artifacts/building-recipes/<id>/contact-walls-<n>.png` (photo | elevation | overlay, then reference | front-on
   | 3/4) and `contact-aerial.png`. `report.json` `passed` must be true. `openings-within-walls` is advisory (fix it when
   easy). The automatic likeness verdict is usually FAIL on balcony-heavy or tree-covered walls; that is fine, but read
   its colour swatches: the model wall renders lighter than the hex you give, so tune `brick` until "model wall" sits near
   "photo wall normalised". Look at every contact sheet next to the photo and iterate until it reads like the building.
   Likeness to the photo is the bar, not gates passing.
6. **Allow notes:** write `scripts/data/kit-batch-2005-20261121/allow-<id>.txt`, one line,
   `0:<note>;1:<note>;...` for every group with a street crop: what was read by hand from which crop and date, and why
   the automatic judge cannot judge it (no semicolons inside a note; at least 8 characters).
7. **Kit gaps:** when the photo shows something the kit cannot express, say so precisely (component, where, how much it
   matters). Do not fake it with the nearest option if that misleads; leave it out and report it.

## Hand back (one SubagentHandback)

Per block: house id, pand, address; group -> panel(s) -> crop tag and date; what you modelled; compile result (tris,
gates, likeness line); contact sheet paths; the allow file path; what the kit could not say; anything you would hold it
for (e.g. no usable photo, wrong pand, model of a neighbour already covering it).
