# Browser queue (`/tmp/canal-pw.sh`) and the pre-push hook

Every headless browser run on this machine (Playwright specs, `check:canal`, `house:frames`, frame and look captures,
the pre-push smoke on pushes to `main`) goes through `/tmp/canal-pw.sh`, so a busy day of parallel lanes doesn't run
twenty Chromes at once. Lane Q1 (#378, 2026-11-12) made it fair and crash-safe and moved its source into the repo.

| File | Installed to |
|---|---|
| `scripts/browser-queue/canal-pw.sh` | `/tmp/canal-pw.sh` |
| `scripts/browser-queue/pre-push` | `<git common dir>/hooks/pre-push` (`~/Code/map-recall2/.git/hooks/pre-push`, shared by every worktree) |
| `scripts/browser-queue/install.sh` | the installer (the integrator runs it) |
| `scripts/browser-queue/test.sh` | tests against temp slot dirs |

## Using it

```sh
PW_PORT=<your port> /tmp/canal-pw.sh npx playwright test tests/e2e/<file>.spec.ts --project=desktop --workers=1
CANAL_PW_TIMING=1 PW_PORT=<port> /tmp/canal-pw.sh <cmd>   # exclusive: the whole machine, timing measurements only
/tmp/canal-pw.sh --status                                  # slots, holders, gate, queue in order
tail -f /tmp/canal-pw.events.log                           # acquire / release / reclaim / expire / drop
```

- **Pushes.** A lane-branch push takes no slot: the hook runs `npm run lint` only. Push with plain
  `/usr/bin/git push origin <branch>`. A push to `main` (an update or a delete of `refs/heads/main`) also runs the e2e smoke,
  and the hook wraps that smoke in `/tmp/canal-pw.sh` itself; give it a `PW_PORT` (or it uses the worktree's
  `.worktree-port`). Wrapping a main push yourself still works (the nested call runs in your slot) but holds the slot
  through `lint` too.
- **Never wrap `house:frames`** (or `frames.ts`): it takes its own slot. A nested call runs in the outer slot
  (`CANAL_PW_HELD`), so wrapping no longer deadlocks, but it holds a slot through the panorama prep, which needs none.
  Batch several lists into one browser session with `--lists` (docs/house-line.md §7).
- Wrap the browser command, not a whole capture campaign: a slot held for an hour is a slot three other lanes wait for.
- One `PW_PORT` per concurrent run: two runs on one port share a dev server, and the first to finish stops it.

## How it works

- **Slots.** Three directories `/tmp/canal-pw.slot{1,2,3}`, taken with `mkdir` (atomic). The holder writes
  `pid` (its wrapper's PID, first so the grace rule can key on it), `start` (that process's start time, so a reused
  PID is not mistaken for the holder), `since`, `maxhold` and `cmd` (with cwd and PW_PORT).
- **FIFO.** A waiter first writes a ticket `/tmp/canal-pw.queue/<arrival time, µs>.<pid>` (written beside, then moved
  in). Each poll (2 s) it counts the live tickets ahead of it and may take a free slot only when fewer waiters are
  ahead than slots are free. Jobs therefore start in arrival order. Up to three waiters may start in one poll,
  so a start can trail by at most two places. A ticket whose waiter has died is dropped by the next waiter that scans
  the queue (`DROP` in the log).
- **Reclaim.** Each poll, a waiter reclaims a slot whose holder PID is dead (`RECLAIM … holder N is dead`) or which has
  no pid file and is older than the grace, 30 s (`no pid file`). It takes `/tmp/canal-pw.reap` first and re-reads the pid
  before removing, so two waiters never both act and a slot a live job has just taken is left alone. A `kill -9` of a
  wrapper frees its slot within one poll.
- **Expiry.** A slot held longer than its max hold is taken away (`EXPIRE`). The holder and its direct children get
  SIGTERM, but only after the holder's start time has been checked against `start`, so a reused PID is never signalled.
  The default is 7200 s. That leaves margin over the longest legitimate jobs measured on 2026-11-12: `check:canal`
  under load ran its checks in 4–7.4 min usually and 71.2 min once (integrator-gate92); `house:frames` browser
  sessions ran 4–11 s per pose, so 50 pands take under 10 min plus the dev-server boot. A job that needs longer
  sets `CANAL_PW_MAX_HOLD=<s>` for itself, up to 21600.
- **Timing mode.** `CANAL_PW_TIMING=1` takes a ticket too. When it reaches the head of the queue it takes the gate
  `/tmp/canal-pw.lock` (so no new shared job starts), waits for every slot to drain, and runs alone. Shared jobs
  queued before it run first. Shared jobs queued after it wait for it. A gate whose holder died is reclaimed like
  a slot.
- **Nesting.** Inside a held slot `CANAL_PW_HELD` is the slot's path. A wrapped call made there `exec`s straight into the
  outer slot.
- **Pre-Q1 wrappers.** These are still-running instances of the old script, which read their old file. They take
  slots with `mkdir` and write `pid` but take no ticket, so they can jump the queue until they drain. Their slots are
  reclaimed and expired like any other (the expiry clock is the pid file's mtime). Their gate has no pid file, so it
  is reclaimed only after the max hold.
- **Polling cost.** Twenty waiters poll at once on a busy day. Liveness is the builtin `kill -0`, files are read with
  `read`, and the queue is a glob. `ps` runs only before an expiry and in `--status`.

Environment (tests and overrides): `CANAL_PW_DIR` (`/tmp`), `CANAL_PW_SLOTS` (3), `CANAL_PW_POLL` (2), `CANAL_PW_GRACE`
(30), `CANAL_PW_MAX_HOLD` (7200), `CANAL_PW_TIMING`. The hook and `house:frames` take `CANAL_PW` (the wrapper path).

## Installing (the integrator)

Never edit `/tmp/canal-pw.sh` or the hook in place. A running bash reads its script lazily, so an in-place edit
changes the code under every waiting wrapper. On 2026-11-12 at 14:02 that left all three slots held with no owner
alive. The installer writes each file beside its destination and `mv`s it over (an atomic rename: running wrappers
keep the old inode), and keeps the previous file as `<dest>.bak-<yyyymmddHHMM>`.

```sh
bash scripts/browser-queue/test.sh                 # all cases pass (temp dirs only)
bash scripts/browser-queue/install.sh --check      # syntax check + diff, installs nothing
bash scripts/browser-queue/install.sh              # installs both, prints --status
```

Rollback: `mv /tmp/canal-pw.sh.bak-<stamp> /tmp/canal-pw.sh` (and the hook's `.bak`). After a reboot clears `/tmp`, re-run
the installer from any up-to-date checkout.
