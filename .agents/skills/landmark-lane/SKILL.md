---
name: landmark-lane
description: Run the Canal Recall landmark lane on a turn budget - triage the ride-visible candidates by photo evidence, run the large-recipe factory unattended, spend Opus only on one strip review per batch, install what passes, integrate, and report cost per building. Use this whenever the user says they have budget or credits for landmarks or buildings, asks to "run down the landmark lane", "spend N turns on landmarks", resume the factory, the queue or the 1000-building programme, or wants more modelled buildings in the ride, even when they do not name the factory, the queue or the large tier.
---

# Landmark lane

Run from the repository root of your own worktree. Read `CLAUDE.md` and
`docs/handoffs/LANE-RULES.md` first; they are short. Do not read `TODO.md`,
`HISTORY.md` or `docs/buildings-pipeline.md`: everything this run needs is
here, in `references/large-tier-sheet.md`, and in the queue.

## Why this procedure is shaped like this

On 2026-10-29 an Opus lane (#105) spent about 130 turns on the 17 most
ride-visible unmodelled buildings and installed none. Every blocker it hit
was decidable from data that existed before its first draft: pands missing
from the tiles, pands already covered, no judgeable street crop, glass
fronts the kit and the judge cannot pass, towers above the crop cap. Two
factory batches a week earlier went 0 of 27 the same way. The lesson is not
"try harder"; it is that the expensive model was inside the per-building
loop and judged buildings the data had already ruled out.

So this lane is a pipeline where scripts do everything deterministic, the
queue (`public/canal-drive/landmark-factory-queue.json`) holds all state so a
run resumes from wherever the last one stopped, and Opus judgement is spent
at exactly one point: reading a strip of compiled houses beside their
photos and writing verdicts. Everything else is a command with an output.

## Inputs

- **Budget** in tool turns (the user's number; default 150). The arithmetic
  below turns it into a number of batches. Stop at the budget even
  mid-batch: commit, write the queue, hand back.
- **Targets**, optional: a list of pand ids or a targets JSON
  (`docs/reports/landmark-targets-<date>.json`). Without one, the queue
  order is the order.
- **Model**: the review turn is Opus. Every scripted step can run from a
  Haiku subagent or inline. Set the model on every spawn.

## Step 0: preconditions (about 5 turns, scripts only)

```sh
/usr/bin/git fetch -q origin && /usr/bin/git log --oneline -1 origin/main
scripts/worktrees/new.sh lane/landmark-<date>          # your own worktree and port; never another session's checkout
test -d "${MAP_RECALL_SOURCE_DATA:-/Users/blackmad/Code/map-recall2-source-data}" || echo "no source-data archive: stop"
npm run -s census
npm run -s factory:queue -- --write                     # refresh rows; keeps every status, owner and verdict
jq -r '.items | group_by(.status) | map("\(.[0].status): \(length)") | .[]' public/canal-drive/landmark-factory-queue.json
```

Abort and report if the archive is missing, if `check:canal` is red on main
(ask the integrator), or if rows you need are claimed by another live owner
(`owner` set, `claimedAt` under six hours old). Claim with `--owner=<lane>`
and never edit another owner's rows.

## Step 1: triage (about 5 turns, scripts only)

The buildable list is a script output, never a judgement. Until issue #110
lands `scripts/landmarks/triage.ts`, apply its rule by hand from
`measure.ts` output and `walls.json`, and say so in the hand-back:

```sh
node --import tsx scripts/landmarks/triage.ts --limit=40 --write     # after #110
```

A candidate is **buildable** when: its pand is in the building tiles and not
already covered (including twin registrations); at least two street-facing
walls have a crop the judge can use (usable over 40 %, foliage under 25 %,
washed out under 30 %, obliquity at most 45 degrees, captured after the BAG
build year); every judgeable front class is one the kit expresses today
(punched, columns, ribbon); and the wall height is within the crop cap
(32 m until the cap is parametrised). Everything else gets its verdict
written to the row (`kit-gap`, `no-evidence`, `not-in-tiles`, `covered`,
`bespoke`) and is not touched again this run. Glass curtain fronts and
towers are `kit-gap` until issue #112 decides otherwise; sending them through
the kit again is a known zero.

## Step 2: factory over the buildable list (about 5 turns, unattended)

```sh
npm run -s factory -- --ids=20 --owner=<lane> 2>&1 | tail -30     # add --model/--turns after #111
```

Crops, facts, draft, measure and compile, each skipped when its output
exists. Give it a 1,800 s timeout and wait; do not poll. The factory never
overwrites a hand-authored intent. Print the tail, not the log.

## Step 3: the review turn (one Opus turn per strip of 20)

```sh
npm run -s factory:strip -- --status=compiled --limit=20 --out=artifacts/strips/<batch>
```

Read the strip pages once, at the size they are written. For each house
write one verdict into the queue row, using this table and nothing softer:

| What you see | Verdict | Then |
|---|---|---|
| Massing, wall colour family, glazing share and window rhythm match the photo on every street wall; gates pass | `pass` | install (step 4) |
| One named, spelled-out intent edit would make it pass (a colour, a bay count, a system on one group) | `fix` with the edit in `verdict.fix` | one recompile, one re-look, then `pass` or `hold`; never a second fix |
| The kit cannot say what the photo shows | `hold`, name the gap | append the gap to `docs/handoffs/kit-gaps.md` with the pand |
| The photo cannot judge it (foliage, glare, construction, no crop) | `no-evidence` | nothing |
| A gate fails for a data reason (3DBAG shell vs BAG footprint, eaves) | `hold`, name the gate and number | nothing |

Write `model`, `turns` and `date` on the verdict. "Do not install" is a
cheap, valid outcome; a wrong model is worse than the plain 3DBAG box.
Never loosen a threshold, raise a baseline or add an allowlist entry to get
green. If a gate is wrong, say so with the number.

## Step 4: apply verdicts (scripts, Haiku-grade)

```sh
node --import tsx scripts/building-recipes/install-large.ts --house=<id> --install [--allow-inferred=<group>:<note>]
npm run -s check:stale-installs
```

`--allow-inferred` follows the policy in `references/large-tier-sheet.md`
(decision pending on #112; until then, only with a `pass` verdict on the
strip and a note per group saying what was inferred from what). A `fix`
gets its edit applied, `--stage=compile` once, and one more look on the next
strip. A `hold` or `no-evidence` row is finished for this run.

## Step 5: integrate and hand back (about 15 turns)

Only the integrating session does this; a leaf lane hands back instead.

```sh
npx tsx scripts/build-covers.ts && cp artifacts/bag-tiles/covers.json public/canal-drive/models/covers.json && npm run -s check:covers
npm run -s build:landmark-lods && npm run -s check:landmark-lods
npm run -s check:canal
npm run -s census -- --write
```

Then one HISTORY line (installs, holds by gap, cost per reviewed building),
the TODO bullets that moved, kit-gaps appended, crops archived to
source-data, and the hand-back below.

## Budget arithmetic and kill rules

Fixed costs: steps 0 to 2 about 15 turns; one review turn per strip of 20;
two turns per `fix`; installs and checks about one turn per house; step 5
about 15 turns. With 150 turns that is roughly five strips, or about 100
compiled houses looked at once each. Compute the number of strips before
starting, write it in the first commit message, and do not exceed it.

Stop early and hand back when:

- the same blocker appears on three candidates in a row (write the blocker,
  not a fourth attempt);
- a strip passes under 20 % (the kit needs work before the factory does;
  say which gaps, by count);
- a command fails twice the same way;
- the budget is reached, even mid-batch.

No automatic second rounds. A run that ends with a clear blocker report and
no installs has done its job.

## Hand back

```
LANE: landmark-lane   BRANCH: <branch>   HEAD: <sha>   MODEL: <review model>   TURNS: <used>/<budget>
TRIAGE: <buildable n> / kit-gap <n> / no-evidence <n> / not-in-tiles <n> / covered <n> / bespoke <n>
STRIPS: <n> reviewed, <n> houses: pass <n>, fix <n>, hold <n>, no-evidence <n>
INSTALLED: <ids>   (inferred groups: <id walls[n]: note>)
COST: <turns per reviewed building>, <turns per install>
KIT GAPS APPENDED: <n> (top three by count)
BLOCKER THAT STOPPED THE RUN: <one line, or "budget">
INTEGRATOR TODO: covers, LODs, census, HISTORY line, crops to archive
```

## Self-test

Issue #110 produces a fixed batch of ten buildable pands with expected
outcomes (`docs/reports/landmark-triage-selftest-<date>.json`). Running this
skill on that batch with a 60-turn budget must reproduce those outcomes. When
it does not, the fix goes into a script or this decision table, and this
text changes only when the procedure changes.

## References

- `references/large-tier-sheet.md`: the tier's numbers, what passes and what
  does not, the known blockers and the inferred-install policy. Read it
  before the first review turn.
- `docs/handoffs/kit-gaps.md`: what the kit cannot say; append, never
  rewrite.
- `docs/START-HERE-buildings.md` section B when a command here is
  unfamiliar; nothing else.
