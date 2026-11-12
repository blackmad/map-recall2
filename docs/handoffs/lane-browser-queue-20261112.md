# Lane Q1: browser queue, three fixes (opus, 2026-11-12, P0 ahead of F4)

**Approved by David via the planning session, 2026-11-12.** Small, but it touches shared infrastructure every lane uses. Report to the integrator; do not merge or push `main`.

## Why

The queue in `/tmp/canal-pw.sh` (3 slots, `<slot>/pid` names the holder, `CANAL_PW_TIMING=1` exclusive via `/tmp/canal-pw.lock`, nesting guard `CANAL_PW_HELD`) stalled twice on 2026-11-12:
- 13:59 a nesting deadlock (house:frames wrapped inside a wrapped push);
- 14:02:35 all three slots taken with no owner alive and no browser running (old wrappers kept reading a script edited in place).

At 14:26, 19 jobs waited: 8 pushes (2 to main, 6 lane branches), 7 house:frames runs, 3 ground specs, g4-repro. One job once waited 3 h behind 25 others (the lock is not fair; TODO.md "FIFO queue for /tmp/canal-pw.sh").

## Deliver

1. **Crash-safe, fair slots.**
   - A waiter reclaims a slot whose `pid` names a dead process, or that has no pid file and is older than a short grace (e.g. 30 s).
   - A slot expires after a maximum hold: measure the longest legitimate job (`check:canal` under load, house:frames for a ~50-pand batch) and add margin; log every reclaim/expiry with the old holder's command to `/tmp/canal-pw.events.log`.
   - First-come-first-served order (ticket file or a queue dir ordered by mtime+pid); a dead waiter must not block the queue either.
   - Keep `CANAL_PW_TIMING=1` exclusive mode and the `CANAL_PW_HELD` nesting guard working.
   - **Tracked copy:** `scripts/browser-queue/canal-pw.sh` plus `scripts/browser-queue/install.sh` that copies it to `/tmp/canal-pw.sh` atomically (write a temp file then `mv`, never edit in place: running bash instances read the file lazily). Document in `docs/browser-queue.md`.
   - A bash or tsx test (`scripts/browser-queue/test.sh`) that runs with a temp slot dir: kill a holder, a waiter takes over; FIFO order of 5 waiters; nesting; timing mode.
2. **Pre-push hook: e2e smoke only for main.** The hook is `.git/hooks/pre-push` in the common dir (today: `npm run lint` then `npm run test:e2e:smoke` on every push). Read the pushed refs from stdin; if any remote ref is `refs/heads/main`, run lint + smoke (the smoke itself must still be wrapped by the caller); otherwise lint only. Put the tracked source at `scripts/browser-queue/pre-push` with the installer copying it too. Update the guidance that tells lanes to wrap every push in `/tmp/canal-pw.sh` (grep `docs/`, `docs/handoffs/` common briefs, `.claude/skills`): only pushes to main wrap. List the memory lines that need changing in the hand-back; the integrator edits memory.
3. **Batched frame runs.** `house:frames` (`scripts/house-frames/frames.ts`, `tests/e2e/house-frames.spec.ts`) gains a multi-list mode, e.g. `--lists a.json:outA,b.json:outB`, running every pose in one browser session and writing each lane's pairs to its own out dir. Cache reference photo cuts by pose hash so a re-run renders only game frames (`--reuse-photos`). F4's critic uses this from day one; say so in `docs/house-line.md` §7.

## Acceptance

- Killing a slot holder (`kill -9` the wrapper and its child) frees the slot for a waiter within the grace period; shown in the events log.
- A lane-branch push completes with no slot taken.
- One batched run over two lanes' lists produces the same pairs (pose.json equal, game.jpg within a small pixel tolerance) as two separate runs.
- `check:canal` green.

## Rules

`/usr/bin/git`; own worktree via `scripts/worktrees/new.sh` from `origin/main`, branch `lane/browser-queue-20261112`; link node_modules; private `PW_PORT` 4451. **Never edit `/tmp/canal-pw.sh` or `.git/hooks/pre-push` in place while lanes run:** test against a temp copy; installing is the integrator's step at hand-back. Stop servers by PID, never pkill. Never wrap house:frames in canal-pw.sh yourself. Do not edit TODO/HISTORY/package.json; list script lines in the hand-back. Hand back: SHA, test output, the acceptance evidence, and the guidance lines changed.

Not in scope: moving camera sheets and look thumbs to Node (already on the board).
