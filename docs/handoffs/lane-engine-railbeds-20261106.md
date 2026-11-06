# Lane R3-C: rail beds intermittently missing, overview rail lines without contrast (S4, 2026-11-06)

Worktree `/Users/blackmad/Code/map-recall2-worktrees/engine-railbeds-20261106`, branch `lane/engine-railbeds-20261106`, port 4647. Issue #232. Plan #222, `docs/handoffs/engine-look-plan-20261106.md` (round 3). Model: opus. Rules: `docs/handoffs/LANE-RULES.md` and the engine-lane block at the end of this brief.

## What the user sees

`s4-zuidas-rails.png` in map-recall2-screenshots `engine/2026-11-06-user-shots/` (`?ride=free&engine=own`, build 69d4c65, Mac, DPR 2): the Zuidas rail corridor north of the Beatrixpark from the air looking N — a flat grey/beige banded strip with thin pale lines, no ballast beds, no dark rails. This is the one of the four complaints no round has fixed.

## What round one measured (#224, HISTORY "Engine round 1", R1-B)

- Rail stripes as their own layer (`ownGround/railStripes.ts`: 61 luma under ballast, ≥ 1.25 px on screen, sleepers fade by on-screen period; `?railStripes=0`, `?railMinPx=0`) and far-ring rail bands (`farRing.ts:183-197`, `?farRail=0`) are on main. In the crops where beds were present the after frames show continuous dark rails.
- **The strongest S4 lead:** at the same spot the harness sometimes lands with the rail ballast beds missing while the ground status reads ready and blend 1; the frame then looks exactly like the user's shot (grey corridor, thin flat lines). On iPhone at Zuidas the beds are never there because the own-ground radius is 400 m on touch (`ownWorldView.ts:566`), so only the overview rail lines draw, and they have no contrast or minimum-width rule.
- `far.radiusM` read 0 in every round-one frame: the far ring never reached the horizon until #229's `?farHorizon`; re-check `farRail` now that the ring is active.

## What the code does (main at e3c5507a4)

- Cells: `groundCell.ts:535-553` builds `ballast`, `track`, `deckBody` and platforms when `input.rails?.length`; `railMeshes({…, far: lod === 1})` (`railTracks.ts:264`, `drawRails = rails !== false && !far` `:268`); `gameGround.ts` `NEAR_M 350` (`:308`), `RADIUS_M 1400`, `RESIDENCY_STEP_M 60`, `wantedCells` lod 0/1 by distance (`:624`). LOD 1 cells have ballast but no rail heads, so beyond 350 m the stripes shader is the rail.
- Inputs: `groundStore.ts cellInput` (`:964-1030`) fetches `railsAround` for the 3×3 neighbourhood via `railCell(k)`; rail fields are attached only if `rails.length` (`:1026`). Extract `public/data/extracts/amsterdam/rail-v1/` (`cells.json` with 139 keys and `cells/<x>_<y>.json.gz`), loaded by `httpFetchBytes` (`:1072-1077`, plain fetch, throws on `!r.ok`, then gunzip).
- **Candidate owners for the missing beds, in the order to check** (all from code, none verified):
  1. `groundStore.ts:916-925`: the rail cell fetch ends in `.catch(() => none)`, so any network/gunzip error or a payload failing `isRailCell` (`RAIL_VERSION` mismatch) resolves to `{ways: [], platforms: []}`, **is cached in `this.rail` until `forgetCells`**, and the cell builds without rails with no entry in `status().errors`.
  2. `groundStore.ts:297-298`: `cells.json` fetched with `.catch(() => null)` then `railCells = new Set(rail?.version === 1 ? rail.cells : [])` — a manifest failure turns every rail off silently; the worker has its own store and init (`groundWorker.ts:85-91`), so main thread and worker can disagree.
  3. Install discard: `onWorker` deletes `pending` before install (`gameGround.ts:749-751`) and `install()` returns silently when `wantedCells()` no longer wants that lod/detail (`:1101`); re-requests happen only in `updateResidency` on a ≥ 60 m move or a radius/far/ahead change (`:509`), so a stationary rider (every harness spot) can keep the old LOD or no cell at all.
  4. Worker reorder drops (`groundWorker.ts` header, `:97`) and `updateResidency` deleting `pending` for keys no longer wanted (`:637-639`).
  5. A worker build error deletes `pending` with no retry (`:747`), visible only in `status().errors`.
  6. Far ring parts hide once a resident cell is done fading (`syncFar :721-727`) regardless of what the resident cell contains, so a cell that lost its rails also hides the far band's rails.
  7. The 400 ms dither fade clone (`FADE_MS`, `:307`; `coversRect` false while fading).
- `status()` (`gameGround.ts:1375-1395`): `ready` and `blend` do not track cells; per-cell truth is `cells`, `pending`, `queued`, `errors` (last 5) and `cellBuild(key).byLayer` (`:1370-1373`) — that is what the spec must read.
- Overview rails: `engine/overviewLayer.ts:227-231` one mesh per `railGroups` group (`ownMap/overviewArrays.ts:104-113`), `lineMaterial` (`ownMap/layers.ts:72-79`, `uHalf` = px/2 × metres-per-pixel at the view centre, Bayer screen-door opacity), per-frame `px = interpolateStops(width, zoom) × scale`, visible if `px ≥ MIN_LINE_PX 0.35`, `uOpacity = opacity × min(1, px/0.9)` (`:298-303`); style `ownMap/style.ts:80-89`: `rail` `#a9a6a2` widths `[[10,0.5],[13,1.0],[16,1.8],[18,3],[20,6]]`, subway/light_rail `[[11,0.4],[14,1],[18,2.4]]`, tram `#b3aca6`. A 1–1.8 px `#a9a6a2` line on beige land is the user's "thin pale lines".
- Harness: `scripts/own-ground/rail-shots.mjs` SPOTS `dijksgracht`, `centraal-approach`, `muiderpoort`, `amstel`, `piet-heinkade-east`, `zeeburg-curve`, `oostertoegang` (`:12-29`, before = `?rails=0`); `scripts/own-ground/rail-strip.ts` (ortho | before | after | player shot; VIEWS from `railRegressions.ts RAIL_SPOTS`); `scripts/look/crispSpots.ts` `zuidas-rails` (S4, [4.8835, 52.3402] z16.7 p66) and `zuidas-rails-high`; `tests/e2e/crisp-textures.spec.ts` (`CRISP=1`). Regression: `ownGround.test.ts:2453-2479` Dijksgracht ≥ 6 tracks, ballast within 3 m of every corridor vertex. `own-ground-roads.spec.ts` has no rail assertions.

## Do, in this order, each behind a flag and measured

1. **Reproduce and name the owner.** New `tests/e2e/rail-beds.spec.ts` (own engine): at `zuidas-rails`, `zuidas-rails-high`, `piet-heinkade-east`, `oostertoegang` and the user's S4 pose (add `s4-zuidas-user` to `crispSpots.ts` from the shot: Beatrixpark bottom, corridor running N, RAI/Zuidas towers right), load the page fresh **10 times per spot** (desktop DPR 2 and iPhone profile), wait for `status()` to settle, then read per resident cell `cellBuild(key).byLayer.ballast` / `.track`, `status().errors`, `pending`, `queued`, lod, and the rail fetch outcome (instrument `railCell` to record ok/none/error per key under `?railTrace=1`). Post the 10×5 table and the owner split on #232 before fixing. If the beds are always there in the harness, run the same at the user's pose with a short pan in (the user arrived by panning) and after a `?ride=free` seed; the harness landed without beds in round one, so find the path.
2. **Fix the owners found**, each flagged: rail fetch failure is not cached as empty — retry with backoff, surface in `status().errors`, and never build the cell without rails when the manifest lists the key (`?railRetry=0`); a manifest failure logs and retries instead of switching rails off; an install discarded because `wantedCells` changed re-queues the cell on the next frame rather than waiting for a 60 m move (`?groundRequeue=0`); worker/main manifest disagreement removed (one source of truth passed to the worker). Pure logic goes in typed modules with unit tests next to them (`groundStore.test.ts` or new), the spec from step 1 becomes the gate: ballast and track present in 10/10 loads at every spot where the extract has a rail cell.
3. **Overview rail lines with contrast and a minimum width** (`?overviewRail=0` restores today's style): rails as a two-tone line (a dark rail tone, e.g. `#6f6b66`, over a lighter ballast halo 1.6× wider), a rail-specific minimum of 1.25 px at any zoom (not `MIN_LINE_PX` 0.35), tram and subway surface lines likewise but narrower; judged side by side with the orthophoto at `zuidas-rails`, `zuidas-rails-high` and the three rail-look spots (`rail-strip.ts` pattern), desktop and iPhone, since on iPhone beyond 400 m this is the only rail. Keep the clean theme's recolour hook (`style.ts:256`).
4. **Far ring rails now that the ring reaches the horizon**: confirm `farRail` draws at the S4 pose from the air (`far.radiusM` > 0), and that the far band's rail tone matches the overview line so the hand-over at the ring edge does not show.
5. **Strips**: user shot | main | after at `s4-zuidas-user`, `zuidas-rails`, `zuidas-rails-high`, `oostertoegang`, desktop DPR 2 and iPhone, orthophoto beside; frame times at the seven `rail-shots.mjs` spots within noise.

## Keep

`?rails=0`; the Dijksgracht regression; `railStripes`/`railMinPx`/`farRail` behaviour; `RAIL_VERSION` 1 unless the extract changes (then bump, keep the decoder tolerant, rebuild with `build-rail-tracks.ts`, report the diff); `world-v1-bytes.spec`; the building shaders and chunks untouched (R3-A #230 and R3-B #231 fences); `gameGround.ts` edits limited to residency/install/status (the far-shell and aerial code from #229 stays as is).

## Hand back on #232

Branch + SHA (pushed); the 10-load tables before/after per spot and profile with the owner split; the strips with the orthophoto; frame-time table; which bundles to rebuild (own-ground-game, own-ground-worker, engine for the overview style) and which test scripts the new spec and unit tests join; What's New text; what is still open.

## Engine-lane rules (2026-11-05, unchanged)

- Work only in your worktree on your branch with `/usr/bin/git`. Never `git stash`, never `pkill`; stop your dev server by the PID on your port. Never `npm install` in the shared checkout; link `node_modules`.
- Do not edit `game.js`, `index.html`, `package.json`, lockfiles, generated bundles, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `budgets.json`, or the published extracts: hand the integrator the text and numbers instead. New tests live in `src/` next to the module.
- Build to a scratch `--outdir` and run through `BUNDLES_DIR`; the Vite dev server full-reloads on any worktree change and silently hangs a harness run.
- Browser runs through the lock: `PW_PORT=4647 /tmp/canal-pw.sh perl -e 'alarm 2400; exec @ARGV' -- npx playwright test <spec> --project=desktop --workers=1 --trace off --reporter=line`; timing runs with `CANAL_PW_EXCLUSIVE=1`.
- Acceptance is a measured ride or a pinned spec beside the user's shot, not a strip alone. Every fix has a `?x=0` flag and a named regression location. Then stop; the integrator merges.
