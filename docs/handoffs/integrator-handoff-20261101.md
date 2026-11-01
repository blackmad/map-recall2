# Integrator handoff — engine programme, 2026-11-01 evening

For the next integrator session (Opus is fine: the remaining integration is
mechanical; keep judgement calls — look reviews, gate re-baselines, flip
timing — explicit and recorded). Read `CLAUDE.md`, this file, the engine
block of `public/canal-drive/TODO.md`, the top of `HISTORY.md`, and the
memory files `engine-programme`, `serialise-browser-runs`,
`integrate-in-own-worktree`, `push-only-after-gate`.

## Where to work
- Worktree `map-recall2-worktrees/integrator-engine`, branch
  `integrate/engine-programme-20261030`, dev port 4519. Main is pushed from
  it as `git push origin HEAD:main` after `git fetch origin main` and a
  normal merge (other sessions push to main too: a buildings session
  landed seven commits tonight; always fetch, merge, then push). Use
  `/usr/bin/git`. Never `git stash`, never `pkill`.
- Issues: #129 (programme, one comment per round), #130 (world compiler),
  #68 (dev log, readable, after each round), #10 (real devices),
  #168 (needs-david: which pop-in did the user see), #161 (cartoon look),
  #171 (first-person camera), #178 (road gaps at bridges, lane running),
  #179 (too-white roofs, materials queue).

## Lanes (agent ids are per session; re-spawn from the briefs if lost)
| lane | worktree / branch | state |
|---|---|---|
| L1 engine host (opus) | `engine-host-20261030` / `lane/engine-host-20261030` | bisecting three red specs on main (building-click-perf :146/:228 both engines; iPhone city-startup-lod `checked > 0`; iPhone render-on-change "riding off draws at once" under own), then prepares the Amsterdam flip commit on its branch (engineFlag default + wantsMapLibre + query-table tests + ENGINE=maplibre spec switch). Do not merge the flip until the Sentry engine/tier tags have been live a day; then watch the 48 h bar (#129 checklist comment). |
| materials (opus) | `materials-20261031` / `lane/materials-20261031` | queue: trunks → cycle overlay → facade mask format (iPhone atlas < 22 MB) → too-white roofs #179 → cartoon look #161. Evidence shape: owner counts desktop+iPad, draws, links, five-spot pins vs a flag, side-by-side PNGs. |
| road (opus) | `road-csr-20261031` / `lane/road-csr-20261031` | b2 IndexedDB graph cache (two-probe table), depth-aware pop-in detector (tooling only); b1 prebuilt graph only if the real-iPhone phase table shows the graph build > ~1 s. |
| road bridge-gaps (opus) | `road-bridge-gaps-20261101` / `lane/road-bridge-gaps-20261101`, port 4566 | #178: measure city-wide first, then the systemic fix, flag `?bridgeGaps=0`. |
| oracle (haiku) | `oracle-migration-2-20261101` | idle until L1 lands an oracle. |

## Integration recipe (per hand-back)
1. `git fetch origin <lane branch>`; `git log origin/main..origin/<branch>`; `git merge --no-edit`.
2. Rebuild the bundles the lane names (`build:canal-engine`, `build:canal-3d`, `build:canal-building-tiles`, `build:canal-three-buildings`, `build:canal-three`, `build:monitoring`, `build:canal-road-graph`); commit source + bundle together.
3. Node gates: `npm run lint`, `test:engine`, `test:own-ground`, `test:world-format`, `test:road-graph`, plus what the lane touched.
4. If any file in the world compiler's hashed list changed (`scripts/world/pipeline.ts` `CODE` + `GLOBAL_INPUTS`, incl. `buildingTilesBrowser.ts`, `roofMesh.ts`, `landmarkKits.ts`, `covers.json`): `npm run world:compile -- --no-policy` (≈1 min), copy `artifacts/world/staging/{cells/*.bin,index.json,strings.bin,tiles.json}` into `public/data/extracts/amsterdam/world-v1/` (not report.json), `npm run world:verify` must say globalFresh true / 0 stale / 0 differing, `test:world-format`. City gate 10 MB (9.82 now).
5. Browser smoke only when the change can alter a frame: a short spec set under `/tmp/canal-pw.sh perl -e 'alarm N; exec @ARGV' -- npx playwright test … --project=desktop --workers=1`, with a fresh `PW_PORT` per concurrent run (two runs on one port share a dev server and the first to finish kills the other). The five-spot A/B (`WORLD_AB=1 AB_CAMERA=fixed WORLD_DIR=public/data/extracts/amsterdam/world-v1 … world-v1-ab`) is owed for the republished cells; it needs a quiet slot and `--timeout 1500000`.
6. HISTORY entry (append at top, why not what), TODO (only unfinished work), What's New note for anything a player can see, budgets.json re-record when a lane moves a measured value.
7. Commit, `git fetch origin main`, merge, `git push origin HEAD:main`, watch CI (`gh run list … select(.headSha|startswith(...))`; Canal CI takes 20–35 min and queues serially), comment on #129; #68 once a day.

## Decisions in force
- `?engine=own` flip is Amsterdam-only; other cities keep MapLibre (user 2026-11-01).
- Pop-in: no game-side change until the user answers #168; the 150 m count and the px/s detector both read ~0 on the seeded ride; the Jordaan number is Westerkerk parallax.
- Millimetre eaves heights parked; facade LOD parked; six-phone-tiles dropped.
- iPhone texture budget 27 MB; trianglesIpad gate 700k (0.80 M now); heap gate 250 MB (276 now; owners: OverviewLayer data 45.6 MB L1, facade CPU arrays 27 MB materials).
- Real iPhone: `safaridriver -p 4471`, UDID 00008140-001E0DA934E2801C; scripts in the Fable session scratchpad `iphone/` and `scripts/time-to-ride-device.mjs --target safari`. "could not connect" = cable; "not paired" = the user must re-trust.
- Named regression locations pinned today: Westermarkt (click), Eerste Leliedwarsstraat / Bloemgracht T (side pick), Reestraat (HUD withhold); to pin: Stationsplein / Centraal forecourt (bumpy ground: AHN has no ground over the metro box and under the shed; fix = flatten own ground to road level under road/plaza polygons), Da Costakade bridges (road gaps, #178), Da Costabuurt white roof (#179).
