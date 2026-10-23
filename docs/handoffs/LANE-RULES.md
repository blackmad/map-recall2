# Lane rules (read this, your brief, and nothing else first)

These rules exist because the October lanes spent 40–80k tokens each reading
`TODO.md`, `HISTORY.md` and `buildings-pipeline.md` before their first
command, and because an expensive model sat inside every per-building loop.
The programme in `docs/plans/thousand-buildings-20261023.md` runs on the
Claude Code Max plan: Opus turns are the scarce resource, Haiku is ~40× cheaper,
scripts are free.

## What to read

1. This file.
2. Your brief in `docs/handoffs/lane-<name>-20261023.md`.
3. Only the files your brief names. Open others when a command tells you to.

Do **not** open `public/canal-drive/TODO.md`, `public/canal-drive/HISTORY.md`
or `docs/buildings-pipeline.md` in a leaf lane. If you believe you need them,
write the question in your report instead; the integrator answers it.

## Where to work

- One lane = one worktree on its own branch, with `node_modules` linked:
  `scripts/worktrees/new.sh lane/<name>-<date>` (prints your dev port). Never
  work in another session's checkout, never `git stash`.
- Use `/usr/bin/git`, not `git`, on the maintainer's Mac.
- `MAP_RECALL_SOURCE_DATA=/Users/blackmad/Code/map-recall2-source-data` is the
  photo archive. The factory sets it when unset.
- Stop a dev server by its port's PID (`kill $(lsof -t -iTCP:<port> -sTCP:LISTEN)`).
  Never `pkill` by pattern.
- Long commands (surveys, compiles, sheets) need a 1,800 s timeout. Do not
  poll; wait.
- At most one Playwright run per machine (`/tmp/canal-pw.sh` if it exists);
  the factory, strips and census need no browser beyond their own headless one.

## The queue is the handoff

`public/canal-drive/landmark-factory-queue.json` holds every factory item with
`status`, `owner`, `house`, `report`, `sheets`, `verdict`, `notes`, `model`,
`turns`. Lanes claim items by running the factory with `--owner=<lane>`;
they never edit another owner's rows. The review turn is the only writer of
`verdict`. `npm run census` reads the queue and prints the headline number.

Write `model` and `turns` honestly in your report: cost per reviewed building
is a number the programme tracks weekly.

## Models

- **haiku**: anything with a command list and a pass/fail output: factory
  batches, strips, installs after a `pass`, applying a `fix` edit the verdict
  spells out, regenerating goldens/bundles/covers, surveys, data pulls,
  inventory sweeps, report writing.
- **opus**: judgement: the review turn (strip → verdict table), authoring a
  type or kit component from a strip, re-levelling a look, diagnosing a
  rendering defect, merging.
- Never fable. Never sonnet unless a Haiku lane failed the same step twice;
  then say so in the report.
- Set the model on every spawn.

## Acceptance

Gates passing is not acceptance. A building is accepted when a review turn
has looked at its strip beside the photo and written `pass`; a buurt look,
a road fix or a look flip is accepted when the user has looked at the one
before/after strip the brief asks for. "Do not install" and "no evidence" are
valid, cheap outcomes; a wrong model is worse than the plain 3DBAG box.

Never weaken a check to get green: no raised baselines, loosened thresholds
or allowlist entries. If a gate is wrong, say so in the report with the
number.

## Do not touch

`public/canal-drive/game.js`, `index.html`, `package.json`, lockfiles, the
bundles under `public/canal-drive/js/`, `models/covers.json`, goldens and
baselines, `TODO.md`, `HISTORY.md`. If a check needs one regenerated, put the
exact command in your report.

## Hand back

```
LANE: <name>   BRANCH: <branch>   HEAD: <sha>   MODEL: <haiku|opus>   TURNS: <n>
DID: <three lines at most>
NUMBERS: <counts, m², ms, tris, whatever the brief measures>
CHECKS: <command -> summary line, one per line>
STRIP/SHEETS: <paths>
HELD / NO EVIDENCE: <ids with the one-line reason>
KIT CANNOT YET EXPRESS: <list, or none>
INTEGRATOR TODO: <bundle rebuilds, covers, baselines, queue rows to merge>
```
