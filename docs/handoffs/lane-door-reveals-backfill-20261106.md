# Lane: door reveals, round 2: the follow-ups and the back-fill over every existing house type (2026-11-06)

Branch `lane/door-reveals-backfill-20261106`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/door-reveals-backfill-20261106`, dev port 4654
(`PW_PORT=4654`; Playwright only through `bash /tmp/canal-pw.sh … --workers=1`, one run at a time on
this machine). Read `docs/handoffs/LANE-RULES.md` first. Use `/usr/bin/git` for every git command;
never `git stash`. Model: opus (haiku subagents for the mechanical measurement runs are fine; set the
model on every spawn). Never `pkill`; stop your server by its port's PID. Open data only. `node_modules`
is linked; never `npm install`.

## Why (user, 2026-11-06 23:50)

Asked whether we ever worked on recessed doorways for canal houses, and told that #181 shipped the
door reveal on 2026-11-01 with five P2 follow-ups still open, the user said "sure go for it - are we
going to go back and fix all the existing ones?". The answer today is no: `FrontIntent.doorReveal` is
a ground field of a house **type** (`blockFace/houseType.ts` GROUND_KEYS, `buildingRecipe/doorReveal.ts`,
"absent = byte-identical"), and only 8 of the 89 block-face type files under `scripts/block-face/types/`
carry one (helmersbuurt, museumkwartier, transvaalbuurt). Every other installed type, every canal-house
recipe with an arched door (`doorArch` cannot be recessed: the recess path is rectangular) and the
222 large-recipe houses still draw their doors flush with the wall. This lane fixes the kit's
remaining gaps and then back-fills a measured reveal on every existing type, so the ride shows inset
doorways everywhere a photo shows one.

## Part 1: the kit follow-ups from #181 (TODO "Follow-ups from the night", door reveals)

1. Darken the inside of the cavity: jambs and soffit shaded as the photos show (a measured luma drop
   toward the leaf, not a flat tint), in the shared recess path (`canalhouseOpeningRecess.ts`) so
   loggias and windows benefit too; byte-identical where no reveal is set.
2. Arched reveals as true arches: a `doorArch` with a `doorReveal` must cut an arched cavity (the
   canal-house round and segmental door heads), with the arch ring kept on the wall face.
3. Per-house and shopfront grounds: a reveal on the residential door beside a shopfront
   (`shopfront.residentialDoor`) and on per-house ground variants.
4. The Steyn 1928 depth (the transvaal types): re-measure with `scripts/block-face/door-depth.ts`
   and set it.
5. The helmers-79-97-r1 slivers: find the cause (jamb boxes vs the wall cut) and fix it in the kit.

Each with a unit test in `doorReveal.test.ts` or the recess tests, and a before/after strip.

## Part 2: the back-fill, measured, over every existing type

1. Inventory: list every type JSON under `scripts/block-face/types/<buurt>/` without a `doorReveal`,
   every canal-house recipe family in `canalhouseRecipes.ts` with a door, and the large-recipe houses
   in `scripts/building-recipes/houses/` whose intent has a door and no reveal. Write the table to
   `staging/door-reveals/inventory.md` (type, buurt, pands installed, reference face, panorama dates).
2. Measure, type by type: `node --import tsx scripts/block-face/door-depth.ts --face=<face> --x=<door span> …`
   on the type's cited reference face and at least one more installed pand (two oblique panoramas per
   door; the script writes the depth and the side-by-side PNG). Record depth, steps, riser and the form
   (reveal vs portiek) per type with the evidence paths. Where no panorama pair can see the door,
   write `no-evidence` and leave the type flush; never guess a depth.
3. Apply: add the measured `doorReveal` ground field to each type (and the arched variant from Part 1
   where the door is arched), recompile the affected installs with the block-face pipeline the
   buurt lanes used (`blockFace/compile.ts`, `batchInstall.ts`; placement records per buurt), and
   large recipes with `scripts/building-recipes/install-large.ts --stage=compile` for the houses you
   changed. Goldens and covers will change: do NOT edit goldens, covers.json or baselines yourself;
   list the changed ids for the integrator, who re-writes goldens after checking the CHANGED list.
4. Gates per buurt: `npm run test:block-face`, `npm run test:building-recipes` (or the recipe tests
   the brief of that buurt names), `npm run lint`, `npm run check:stale-installs`; never loosen a
   threshold or baseline.
5. Look at it: one strip per buurt at gallery size (`npm run review:sheet` or the block-face strip
   scripts the buurt lanes used) with the panorama crop beside each door, before and after, plus one
   in-game ride capture per buurt (desktop and phone). Likeness to the photo is the bar.

Order: Part 1 items 1, 2, 5 first (they change what the back-fill draws), then Part 2 by ride
visibility: centre and inner ring first (canal houses, Jordaan, De Pijp, Oud-West, Oost), then the
outer buurten. Commit per part and per buurt; push the branch after each commit. Hand back by
**10:00 CET** with whatever is measured and applied, in that order.

## Rules

Never edit `game.js`, `index.html`, `package.json`, lockfiles, `public/canal-drive/js/*`,
`models/covers.json`, goldens, `geometry-audit-baseline.json`, `TODO.md`, `HISTORY.md`,
`whats-new-notes.json`, `budgets.json`. Never merge or push main. Strips and captures go to
`blackmad/map-recall2-screenshots` under `buildings/2026-11-06-door-reveals/` (JPEG q82, at most
1600 px wide; commit and push that repo with plain git), never into the game repo. Scratch output
under `/tmp/door-reveals/`. Questions only the user can answer go to a `needs-david` issue assigned to
blackmad; keep working on what does not depend on the answer.

## Report

Post on your GitHub issue (`gh issue comment <n> --body-file <file>`) and return the same text:
the LANE-RULES hand-back block (branch, HEAD sha), Part 1 items done with their tests and strips,
the Part 2 inventory table (types measured / applied / no-evidence, pands recompiled per buurt,
depth per type with evidence), the changed golden and install ids for the integrator, the strip and
capture links, what the kit still cannot say, and a What's New paragraph (plain English: which
streets now show inset doorways, with the strip links). INTEGRATOR TODO: goldens re-write after the
CHANGED list, covers rebuild + `check:covers`, world recompile if cells changed, census.
