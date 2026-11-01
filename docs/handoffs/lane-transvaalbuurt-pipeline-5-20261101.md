# Lane: Transvaalbuurt round 5a, the five block-face pipeline fixes (2026-11-01, #157)

Branch `lane/transvaalbuurt-pipeline-5-20261101`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/transvaalbuurt-pipeline-5-20261101`, dev port 4742.
Read `docs/handoffs/LANE-RULES.md` first. Use `/usr/bin/git`. Model: opus.

Context: the four round-4 lanes (`docs/handoffs/lane-transvaalbuurt-{1929-blocks,1920-rows,1926-rows,1911-variants}-20261101.md`,
their hand-backs are summarised in the HISTORY entry "Transvaalbuurt round 4", which you may
not open; everything you need is below) each hit the same five pipeline faults and worked
around them by hand. This lane fixes them in the pipeline, typed and tested, so the next buurt
lanes do not. Method background: `docs/buurt-generator-20261016.md` "Transvaalbuurt lessons"
points 1–10. The 157 Transvaalbuurt strips are in `staging/block-face/<face>/strip.jpg`.

## The five fixes

1. **`batch.ts --faces` is ignored when `--buurt` is given.** The batch iterates the whole
   buurt, re-auto-places every face and installs whatever passes; in round 4 it installed a
   face another lane owned (kruger-32-40) and restriped faces it was not asked about. Make
   `--faces=<a,b,c>` (and `--only=`, whichever name the script documents) restrict the buurt
   run to those faces, and print the face list it will run before it starts. Test.
2. **A buurt-wide `auto-place --review` re-run renumbers runs and overwrites installed run
   intents.** Every round-4 lane restored `retief-45-75-r1`, `pretorius-71-95-r1/r2` and
   `pretorius-72-120-r1` from HEAD by hand, and one re-run deleted `pretorius-72-120-r1`. Make
   the re-run skip any face whose run has an installed chunk (`chunks.json` lists
   `chunk-face-<run>`) unless `--replace=<run>` names it; never renumber an existing run dir;
   new runs on a face with installed runs take the next free number. Test with a fixture that
   has an installed run and a new placement on the same face. Also pass `--photo-decides`
   through wherever the buurt run reaches `auto-place` (round 2's brief omitted it and the
   twins flipped).
3. **The batch's per-pand wall refit reads tree and hedge green.** Danie Theronstraat 13A,
   16A, 23A and 28 came out near-black and olive (`#0e0d09`, `#1f1e15`); lane #155 installed
   with one measured brick per row instead. Measure the wall from tree-free columns only (the
   strip's foliage mask / `foliageShare` and the `isLeaf` test already exist in
   `measureFacade.ts` and `autoPlace.ts`), and when fewer than N clean columns remain, take the
   row median of the clean pands with a note. Test with the Theronstraat records (the strips
   are in staging: `theron-2-36`, `theron-9-37`).
4. **`groundUse` turns OSM street furniture into a shopfront.** `amenity=waste_disposal`,
   `bicycle_parking` and `public_bookcase` nodes on the pavement became a services or bar
   shopfront on Vaalrivierstraat 14–22, Retiefstraat 61–63, `campen-2-34-r2`,
   `flinck-169-233-r1` and the installed `hasebroek-2-46-r1`. Street furniture is not a
   business: exclude those tags (and the rest of the furniture set: `bench`, `waste_basket`,
   `post_box`, `vending_machine`, `charging_station`, `bicycle_rental`, `parking`,
   `recycling`, `telephone`, `clock`, `drinking_water`, `fountain`). Test. If the only
   installed face this changes is `hasebroek-2-46-r1` losing a false bar front, recompile it,
   show the before/after review sheet, and re-install it (that is the correct fix, not a
   regression); say so in the report. Any other installed-face change: stop and report.
5. **The Tugelaweg strips put the facade foot 0.6–1.8 m above the strip ground.** The 1929
   block type (`transvaal-1929-block`, lane #153) fails likeness on Tugelaweg 95–118 (edge NCC
   0.07–0.13) because the strip's ground row is not the facade foot; a trial with a lower
   `frontEavesM` was worse. Read the facade foot from the strip (the lowest wall row under the
   ground-floor openings, or the pavement line) and align the model to it in the likeness
   compare and the strip-over-model sheet, as a per-strip offset recorded in the record. Test
   with `tugelaweg-91-112` and `tugelaweg-113-120`; report NCC before and after. If the row
   then passes likeness, review it at gallery size and install the runs that pass (the type
   is in the library; crown and palette pins go in the West review files).

Each fix is typed, tested, and byte-identical for every installed face except the one case in
fix 4 (`node --import tsx scripts/block-face/roof-golden.ts` 0 changes, `npm run -s
test:building-recipes` 0 changes, recompile `retief-45-75-r1`, `luthuli-21-41-r1`,
`theron-2-36-r1` and one Bellamy face to prove it).

## Then

6. Regenerate the Transvaalbuurt placement records with the fixed pipeline:
   `npm run block-face:auto-place -- --buurt=transvaalbuurt-oost --district=transvaalbuurt
   --review --photo-decides`, then `-west`. Prove with `git status` that no installed run dir
   changed and `chunks.json` is untouched. Report the buurt outcome split from the regenerated
   records: vetoed before comparison / compared and held / placed (installed), per buurt, so the
   TODO board gets a true number after the four-way merge.
7. Hand back with the LANE-RULES block plus one sentence per fix, the NCC before/after for
   Tugelaweg, which installed faces you recompiled, and INTEGRATOR TODO (covers and exposure
   only if something was installed: `npx tsx scripts/look/build-chunk-wall-exposure.ts --write`;
   `node --max-old-space-size=8192 --import tsx scripts/build-covers.ts
   --tiles=public/data/extracts/amsterdam/bag-tiles/14`; `roof-golden.ts --write --face=<run>`).

Do not touch type files, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, bundles,
`covers.json`, goldens, baselines. Lane #158 authors new Transvaalbuurt types in parallel and
runs auto-place with `--only`; do not run the batch over its faces (Albert Luthulistraat 6–32,
Afrikanerplein 25–55, Schalk Burgerstraat 45–131, Transvaalstraat 131–143, Colensostraat
13–28, Vaalrivierstraat 15–21). One Playwright run at most (`/tmp/canal-pw.sh`, `PW_PORT=4742`).
