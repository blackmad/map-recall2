# Lane: triage the three reds on main

Rules: `LANE-RULES.md`. Model: opus. Port: 4535. Branch
`lane/reds-triage-20261030` from `origin/main`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/reds-triage-20261030`
(`scripts/worktrees/new.sh lane/reds-triage-20261030 <that dir> 4535`).

Three checks fail on `main` today. CI runs only lint and the boot smoke, so
nothing blocks a push; the engine programme's gate runs (2026-10-30) found
them and the oracle-migration lane proved each fails identically before and
after its change. Nobody owns them. Your job per red: find the first commit
that broke it, decide whether the player can see it, fix it when the fix is
small and certain, and otherwise write the diagnosis. Never weaken a check
to get green (no raised thresholds, no skips, no allowlists).

## The reds

1. `tests/e2e/bike-xray.spec.ts` "the chase bike keeps its own colours …":
   the bike must draw after every building layer; expected a value > 128,
   got −1 (the probe found no bike pixel at all, or the layer order lookup
   returned nothing). Candidates: the 2026-10-2x shared-frame layer order,
   the player-vehicles bundle (bike GLB, lean added 2026-10-30 is **not**
   on main yet when you start; re-check once it is), the spec's own probe
   geometry after the camera changes. Player-visible if the bike is drawn
   under facades at junctions: ride the Dam and a Keizersgracht corner at
   `?engine=` default and look.
2. `tests/e2e/complete-city.spec.ts` "the streamed city loads …":
   `contextualFeatures` is 0 where the spec wants more than half of the
   features to carry the citywide display prior. Either the prior stopped
   being applied (player-visible: the far ring would lose its measured
   colours / heights) or the status counter that reports it is dead
   (invisible). Find the counter's writer (`grep -rn contextualFeatures
   src public/canal-drive/js`) and the prior's consumer; if the counter is
   dead because the prior moved into the compiled world cells or into the
   worker, the spec needs a new oracle, not a lower bound — propose it in
   the report and implement it only if it is a read of an existing
   `__canal*` field.
3. `scripts/check-building-look-transition.ts:48` throws
   `t.chunks.get(first.key)` is undefined (`'mesh' of undefined`), inside
   `npm run test:city-startup`. Fails on `72d48311c` and `737efeadf` too.
   Probably the chunk key format or the tile→chunk map changed under it
   (`threeBuildingsBrowser.ts` / `worldCells.ts` regroup). Decide whether
   the check still tests something the game does; fix the lookup if so.

## Method

`/usr/bin/git bisect` is fine for 1 and 3 with a script; keep each browser
run under the lock short (one spec, `--workers=1`, `--trace off`,
`PW_PORT=4535`). Node checks need no lock. For each red the report needs:
first bad commit (SHA + subject), player-visible yes/no with one screenshot
when yes, fix or diagnosis, the check's run before/after.

## Checks

`npm run lint`; each red's own command; `npm run test:city-startup`;
under the lock `PW_PORT=4535 /tmp/canal-pw.sh npx playwright test bike-xray
complete-city --project=desktop --workers=1 --trace off`.

## Hand back

The block from `LANE-RULES.md`; one paragraph per red as above; the
integrator rebuilds any bundle you name.
