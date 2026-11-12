# Lane W1: wall colour that matches the photo (opus, 2026-11-12, P0)

**User, 2026-11-12, on the walls What's New note:** "the before/after looks the same to me, also every house is the
wrong color". The note is corrected (HISTORY "Wall colour truth"). The user's ruling (memory "wall colour: correctness
first"): ship measured dark brick even if the city reads darker; lighten later with accents and lighting.

## What is measured

- F4 round 0 (docs/house-line.md §10): wall colour/tone is the critic's #1 gap, **87 of 193 pairs**; brick drawn as
  render 11.
- **Spec walls** (~425 generic pands with a reading, baked into world-v1) draw about **0.10 L darker** than the photo.
- **Pands without a reading** draw `PERIOD_WALLS` (orange terracotta, slate grey).
- **Three brick fronts** draw as pale render.
- **brickLift v2** brought only 5 of 11 walls closer (mean dE 0.124 → 0.118), so it is off by default (`?brickLift=v2`).
- **The colour path:** spec wallHex → house-specs extract → world-v1 baked cells → `meshBuildingFor` wallHex in the
  pool worker (brickLift acts here; flags reach it only via `engine/workerPool.ts withWorkerFlags`) → look lift
  (wall tint) → pixel. `scripts/house-frames/trace-wall.ts <ids>` prints the Node side.

## Do

1. **Measure before changing.**
   - Take F4's benchmark-v1 wall pairs; the critic output names the wall-colour pairs.
   - Split the error per stage: reading vs photo (the measurement), decorated vs reading, mesher vs decorated, pixel
     vs mesher (look lift and lighting).
   - Report OKLab dL/dC/dh per stage, separately for spec pands and period-palette pands.
   - The fix goes where the error is. Do not tune a late stage to hide an early one.
2. **The period palette:** re-derive `PERIOD_WALLS` per archetype and period from measured photo walls (wallFit,
   leaf-off votes, as H7 r2 did for Nassaukade), not from guesses. The orange terracotta and slate grey must go
   wherever the photos say brown brick.
3. **Brick drawn as render:** find why the three fronts lose brick texture (material unstated → `brick: false`?) and
   fix it at its stage.
4. **Look lift and lighting:** if pixel vs mesher is where the 0.10 L goes, fix the lift for walls with a measured
   reading, behind a flag first.
5. **Hand-off with F1 (shader facades, lane running):** F1 draws record walls at 1.0 × wallHex under
   `?shaderFacades=1`. Any change to wallHex or the period palette reaches both paths; any lift change is legacy-path
   only. Name which in the report.

## Accept

- `house:frames --before` triples (photo | before | after) on the F4 wall-colour pairs plus the user's note pands
  (0363100012157926, 0363100012154359).
  - No pair may be `sameAsBefore` unless intended.
  - Diff every pair, and check the flag reaches the baked layer: memory "before/after must differ".
- Per-pair wall dE before and after.
- Gate: mean dE down, and no more than 1 in 10 pairs worse by more than 0.02.
- F4 critic round on the same pairs (a Claude critic only, never Jev or Gemini).
- `check:canal` green.
- Flags default on only with the pairs attached. The integrator rebuilds world-v1.

## Rules

- **Setup:** `/usr/bin/git`; a worktree via `scripts/worktrees/new.sh` with node_modules linked.
- **Browser runs:** a private `PW_PORT`; browser runs through `/tmp/canal-pw.sh`, except house:frames, which is never
  wrapped. Stop servers by PID.
- **Data:** open data only; source-data via `scripts/worktrees/new-source-data.sh`; screenshots go to the screenshots
  repo `ui/2026-11-12-wall-colour/`.
- **Do not edit:** package.json, TODO, HISTORY, whats-new or bundles. Put drafts in the hand-back.
- **Hand back:** SHAs, the per-stage table, the before/after table, the triples, and what the kit still cannot say.
