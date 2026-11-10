# Lane: census refresh and the coverage truth table (2026-11-07, week 1 of the city coverage programme)

Branch `lane/census-refresh-20261107`, own worktree from `scripts/worktrees/new.sh` (it prints your
port). Read `docs/handoffs/LANE-RULES.md` first, then `docs/plans/city-coverage-20261107.md` §A and
§C1 only. Model: **haiku**. Use `/usr/bin/git`; never `git stash`, never `pkill`. No browser needed.
`node_modules` is linked; never `npm install`. Budget: 30 turns.

## Why

Every coverage number the programme plans from is stale: `coverage-v1/buurten.json` is from
2026-10-17 (it says 3,075 building-type pands; `covers.json` now has 13,482), the census file on main
is from 10-30 (496) while a live run says ~600, and the factory queue on main is from 10-31 while the
11-06 refresh sits on branch `lane/landmark-factory-20261106`. Week 1 starts by making the numbers
true, then publishing one table the rest of the month is measured against.

## Do

1. `/usr/bin/git fetch origin lane/landmark-factory-20261106` and merge only
   `public/canal-drive/landmark-factory-queue.json` and `docs/handoffs/kit-gaps.md` from it
   (`git checkout origin/lane/landmark-factory-20261106 -- <path>`); if either conflicts with main,
   stop and report the diff rather than resolving by hand.
2. `npm run build:coverage` (writes `public/data/extracts/amsterdam/coverage-v1/`), then
   `npm run census -- --write`, then `npm run factory:queue -- --write`. Commit each output with its
   command in the message.
3. Ride-ring ranking: `node --max-old-space-size=8192 --import tsx scripts/building-recipes/ride-visibility.ts --routes=2000 --seed=7`
   already scores dominant candidates. Write a small typed script `scripts/coverage/ride-ring-buurten.ts`
   that pools the same sampled route points per buurt (coverage-v1 polygons) and writes
   `docs/reports/ride-ring-buurten-20261107.json` + `.md`: per buurt, route metres, pands, non-generic
   share by tier, repetition, dominant decade, and the block-face library that already exists for it
   (`scripts/block-face/types/<district>/`). Sort by route metres. This is the week-2 buurt lane order.
4. Report the table below on issue #68 as one comment (the integrator posts it if you cannot).

## Numbers to hand back

| | pands | bespoke | chunk | large recipe | building type | landmark kit | generic |
|---|---|---|---|---|---|---|---|
| all tiles | | | | | | | |
| in buurten | | | | | | | |
| ride ring (top 40 buurten by route metres) | | | | | | | |

Plus: census headline / strict, queue rows by status, the top 15 ride-ring buurten with their
existing library (or none), and the three stale files' old vs new dates.

## Hand back (LANE-RULES format)

CHECKS: `npm run lint`, `npm run check:covers`, `npm run test:landmark-triage`. INTEGRATOR TODO: the
coverage-v1 and census files are generated outputs the integrator publishes; list the paths.
