# Lane H3: stage and publish specs in batches (2026-11-10)

Part of the house line (`house-line-plan-20261110.md`). Sonnet. Starts when H1 merges (needs `spec.ts`, the extract layout and `houseSpecEnricher`).

Publishing is heavy because every install reaches the world only through `covers.json`, which is a `GLOBAL_INPUT`, so one house rebuilds the city (≈ 1 min compile + 134 s shells + 6 min gate + goldens by hand). This lane splits the work in two: lanes stage, the integrator publishes once per batch, and a batch rebuilds only the cells it touched.

## Step 0 — measure before building (report first, 30 min cap)
1. `scripts/world/compile.ts`: how `globalHash`/`tileHash`/`allStale` are computed, what covers.json hidden ids are used for (step 3), the `--against` coversKey special case, the `--shell --changed` path and the shell-hash guard. `pipeline.ts GLOBAL_INPUTS` (note `industrial-buildings.json` is in it too) and `tileInputs`.
2. Time on this machine: `world:compile --changed` with one tile's inputs touched (cells rebuilt, seconds), `--shell --changed` for the same, `build-covers` + `check:covers`, each golden (`test:fit-golden`, `scripts/building-recipes/large-mesh-hashes.ts`, `scripts/block-face/roof-golden.ts`, `test:block-kit-installed`), `check:canal`. A table; this is the baseline the gate is measured against.
3. `check:stale-installs --strict` + `held-installs.json` semantics; `install.ts`/`install-large.ts`/`blockFace/compile.ts --install` entry points.

## Deliverable
- `scripts/house-specs/stage.ts` → `npm run house:stage -- <spec.json|pandId> [--note "…"]`: `validateSpec`, write `artifacts/house-specs/staging/<pandId>.json` (spec + `stagedAt` + `by` + the H2 preview's `measure.json` and `compare.png` path as the receipt). Refuses a spec without a receipt unless `--no-receipt` with a reason. Nothing under `public/` changes.
- `scripts/house-specs/publish.ts` → `npm run house:publish -- [--dry-run] [--batch <name>] [--allow-extra <ids>]`, the integrator's command:
  1. Merge staged specs into the tiled extract (`build-house-specs.ts` logic, `--publish`), print a per-pand field diff and the touched z14 tiles and cells.
  2. `world:compile --changed --shell` (touched cells only; keep the shell-hash guard, it throws when code changed and the integrator then runs a full bake).
  3. If any spec has `route: 'recipe'`: `toRecipe`, compile, install via the existing `install*.ts`, `build-covers`, copy covers, `check:covers`.
  4. Goldens with `--allow=<pandIds>`: add that flag to the four golden scripts (changes inside the list are re-recorded, any `CHANGED` outside fails the publish and prints the ids). For generic-route specs the guard is the per-cell compare: every cell outside the touched set must decode identically to the previous staging index.
  5. `check:canal` once.
  6. Write `artifacts/house-specs/published/<batch>.json` (what landed, timings) and print the HISTORY/What's New paragraph for the integrator to paste; move the staged files to `published/`.
  7. Archive specs + receipts to `map-recall2-source-data/house-specs/<batch>/` (dedicated worktree, integrator pushes).
- `scripts/world/pipeline.ts` + `compile.ts`: remove `COVERS` from `GLOBAL_INPUTS`; hash each tile's covers slice (hidden ids among that tile's building ids) into `tileHash`. Source of the tile → ids map: a `tile-ids.json` written in `OUT` on a full run and reused while the tile's own hash is unchanged (or `build-covers.ts` emitting `covers-by-tile.json`; pick one and say why). The `--against` coversKey special case becomes a per-cell hidden-list comparison. A full compile before and after must be byte-identical (`world:verify` 0 differing).
- Stale installs: a spec that edits an installed recipe house makes its GLB stale → publish reinstalls it in step 3, or writes `held-installs.json` with reason `staged spec <date>` when the reinstall fails the likeness gate; `check:stale-installs --strict` then passes with the hold explicit.
- `scripts/house-specs/nightly.sh`: `house:publish` for everything staged, with the log in `artifacts/house-specs/logs/`, exit non-zero on any gate failure; the integrator decides when to run it (no cron in this lane).

## Gate
Measured table before/after: a 50-spec batch (use the H1 extract's canal-belt specs as the batch) publishes in under 15 min wall on this machine, with the cells rebuilt listed and no cell outside the touched tiles differing; covers change rebuilds only affected cells; goldens `CHANGED ⊆ allow`; `check:canal` green; the full-compile byte-identity check for the covers hashing change; `npm run lint`; unit tests for `--allow` parsing and the per-tile covers slice.

## Documentation
`docs/house-line.md` §3: both commands, every flag, the staging/published/archive layout, what a receipt is, the batch rule (lanes never publish), the stale-install behaviour, and the exact integrator checklist for a batch. `CLAUDE.md` house-line section gains the one line "house:publish is the integrator's; lanes stop at house:stage". `--help` from the same `HELP` constant.

## Rules
`LANE-RULES.md`; `/usr/bin/git`; own worktree + port; link `node_modules`; browser runs under `/tmp/canal-pw.sh`; staged first, publish only in the gate run on the lane's own worktree (never into main's `public/`); no edits to `game.js`, `index.html`, lockfiles, `TODO.md`, `HISTORY.md`; `package.json` only for the two scripts; hand back SHA, step-0 and gate tables, and TODO/HISTORY text.
