# Design units: in-flight checkpoint (2026-11-19, about 18:10)

This is for a fresh session that has only the repo. Read it first. Then read `docs/handoffs/design-units-plan-20261119.md`, `docs/handoffs/design-units-handoff-20261119.md` and `docs/reports/design-units-phase0-20261119.md`.

## Where things are

| Where | SHA | What |
|---|---|---|
| `main` (origin) | a0d12ae87 (the latest seen) | Phase 0 landed as a58f085c4: the ordekaart join, regression rows and gate report. Nothing from phase 1 yet. |
| `integrate/design-units-20261119` (origin) | this commit | Phase 1 data and the renderer lane merged, with bundles rebuilt. **Not on main.** |
| `lane/design-units-render-20261119` (origin) | 4d579a3d53 | The renderer lane (T2). It is finished and already merged into the integrate branch. |
| source-data `archive/ordekaart-20261119` | aa044df59 | `datasets/ordekaart-20261119/`: the ordekaart layers, staged index, AHN fronts, segments, stats and gate blocks. |

Commits on the integrate branch since main, oldest first:
- 81acb7d87 the segment contract;
- 1b2fac24f AHN front lines, Ring-layer segments, the published flag-only extract and the segment tests;
- ec2aa8484 TODO and HISTORY;
- ba4f9f053 merge of the lane;
- 3e3c8316b segments carry `year` and `at`, as the renderer asked;
- e138de88a bundles rebuilt;
- this handoff.

What the branch adds:
- **Data:** `public/data/extracts/amsterdam/design-units-v1/segments.json` (2.09 MB). It holds 3,235 Ring-layer multi-pand segments over 13,730 pands. It is read only under `?designUnits=1`.
- **Code:**
  - `src/canalRecall/designUnits/segments.ts`: the rules (split at a storey-sized AHN step that holds on both sides; clamp 0.8–2.5 m outliers; a member a storey or more off its run leaves the segment).
  - `draw.ts` and `drawProps.ts`: the renderer.
  - `scripts/design-units/ahn-fronts.ts` and `build-segments.ts`.
- **Gate blocks:** `scripts/design-units/gate-blocks.json`, 18 blocks over 88 pands, chosen by ride metres.

Only on disk, untracked: `artifacts/design-units/` in worktree `integrator-design-units-20261119`.
- `staging/`: the full index, AHN fronts and segments, all archived in source-data.
- `gate/lists/*.json`: one list per block, which can be regenerated from `gate-blocks.json`.
- `vanostade.json` and `frames/vo-*`: the trial pair, described below.

## What has been verified, and how

Run in the integrate worktree on 1b2fac24f, then on e138de88a after the merge and rebuild, one suite at a time:
- `npm run lint` passes.
- `npm run test:design-units` passes 14/14.
- `node --import tsx --test src/canalRecall/designUnits/draw.test.ts` passes 10/10. This file is the lane's flag-off and conformance suite, and I ran it after the merge with the `year`/`at` extract:
  - flag off: features and meshes match hashes pinned on base code;
  - Rustenburgerstraat draws as 3 buildings and Van Ostadestraat as 4;
  - changing `eavesM`, `seed`, `slices` or `exceptions` changes the mesh.
- `node --import tsx --test src/canalRecall/world/worldV1Enabled.test.ts` passes 3/3.
- `npm run test:canal-game-structure` is OK, run after the bundle rebuild.

**Claimed by the lane but not rerun here:**
- the rowFront, rowSeries, facade-extra, roof-material and bay-look suites (54/54);
- the houseSpec suite (200/203; it says the 3 failures in `beltHaarlemmer.test.ts` "131" fail on base too).

**Not yet run:** `check:canal` core, rail and joins on the integrate branch. No pixels have been checked.

**Trial pair: done at about 18:12 (desktop, live tiles).**
- Every one of the 12 Van Ostadestraat pands changed; none was flagged sameAsBefore. The share of target-wall pixels changed was 58–99%, with mean OKLab dE 0.09–0.19.
- In `vo-after/0363100012153176/triple.jpg`, the row reads as one continuous brick front on one line. Before, it was houses of varied height with a dark odd one out. The wall lightness moved toward the photo: L 0.43, then 0.50, against 0.59 in the photo.
- **A regression to look at before the gate:** the windows after are wide and squat, while the photo's are narrow and tall. The segment bay pitch (`segmentBayM`) may be too wide for these 1900s fronts. Check that before shooting the 18 blocks.

(Superseded) **Background job (started 18:04).** A trial pair was running, `npm run house:frames` on 12 Van Ostadestraat pands:
- before: `artifacts/design-units/frames/vo-before` with `?world=live`;
- after: `vo-after` with `?world=live&designUnits=1 --before vo-before`;
- PW_PORT 4724, through `/tmp/canal-pw.sh`;
- log: `/private/tmp/claude-501/.../scratchpad/vo.log`.

If the session was closed, the job died with it. Check `bash /tmp/canal-pw.sh --status`, and kill anything left on port 4724 by PID (`kill $(lsof -t -iTCP:4724 -sTCP:LISTEN)`). Then rerun it (step 2 below).

## Design-direction round (after the trial pair), in progress

The planning session's direction: the plot is the module, not the segment; light frames on 1860-1919 Ring fronts;
segments must not collapse to one wall; use the De Pijp D1 reads; a no-worse rule (window h/w at least 1.5, bays per member
as the prior). The iteration loop is Node only: `node --import tsx scripts/design-units/row-sheet.ts <van-ostadestraat|rustenburgerstraat>
[--photo <jpg>]` writes `artifacts/design-units/rows/<row>/sheet.jpg` (today over flag, whole row on one line;
`PREVIEW_ROW_IDS` makes preview.ts draw every member). Done so far (committed):
- per member window columns: the era prior by plot width (`eraWindows`), at ONE pitch per segment (module / era count),
  laid out through the stated-count fit with `exact` (1.2 m axis floor; MIN_COLUMN_M 1.8 had turned 6 windows into 4);
- bay-look traits for era segments: tall, light frames (dark only when the reads say so); slate on c19 segment roofs;
- the Node `gameChain` loads the segments under DESIGN_UNITS=1 (scripts/world/pipeline.ts).
- read consensus: `build-segments.ts --reads` (default `artifacts/design-units/staging/d1-ring-answers`, extracted with
  `git archive lane/buurt-pijp-20261116 artifacts/describer-d1/ring-20261114/answers`): 272 segments carry `reads`
  (whiteFrames 235 true / 21 false); the extract is republished;
- the no-worse conformance test in `draw.test.ts` (12/12): era members draw the plot's columns and windows h/w >= 1.5, light
  frames without a read;
- bundles rebuilt; lint, test:design-units 14/14, structure, worldV1Enabled pass.
Still to do: the wall tone against the photo (the browser trial read L 0.50 / hue 42 against the photo's 0.59 / 47; not
touched yet); the planning session reviews the two row sheets; then one browser pair per row, then the gate.

## Next steps, in order

Work in worktree `~/Code/map-recall2-worktrees/integrator-design-units-20261119`. It is locked, port 4720 (e2e 4721–4726). Always call `/usr/bin/git`, because the `git` wrapper is broken. Never work in `~/Code/map-recall2`.

0. **Check the machine** before any browser run, bundle build or compile:
   - `df -h /Users/blackmad`: at least 15 GB free;
   - `uptime`: 1- and 5-minute load under 30;
   - `sysctl -n vm.swapusage`: used under about 10 GB.

   Another project's image job (mflux) fills RAM, which pushes swap up and takes the disk with it. If any threshold fails, wait. On ENOSPC, stop and report; do not loop.
1. **Bring in main:** `/usr/bin/git fetch https://github.com/blackmad/map-recall2.git main && /usr/bin/git merge FETCH_HEAD`. If anything under `src/` changed, rebuild the bundles: `npm run build:canal-three-buildings`, `npm run build:canal-3d`, `npm run build:canal-engine`. For conflicts in generated files, see the memory note on generated-file conflicts.
2. **Trial pair: does the flag reach pixels?** Run:

   ```
   PW_PORT=4724 npm run house:frames -- --list artifacts/design-units/vanostade.json --query '?world=live' --label before --out artifacts/design-units/frames/vo-before --as-played
   PW_PORT=4724 npm run house:frames -- --list artifacts/design-units/vanostade.json --query '?world=live&designUnits=1' --label after --out artifacts/design-units/frames/vo-after --before artifacts/design-units/frames/vo-before --reuse-photos --as-played
   ```

   Do not wrap `house:frames` in `canal-pw.sh`; it queues itself. If `vanostade.json` is missing, rebuild it from the members of `du:ring:8815`, `8794`, `8792` and `8793` in `segments.json`, up to 4 each. A `sameAsBefore` warning means the flag did not reach the pixels: fix that before anything else. Look at the `triple.jpg` files.
3. **Tests, one at a time:** `npm run lint`, `npm run test:design-units`, `node --import tsx --test src/canalRecall/designUnits/draw.test.ts`, `npm run test:canal-game-structure`.
4. **Gates, one at a time, each with a private port:** `PW_PORT=4722 npm run check:canal:core`, then `:rail`, then `:joins`. Skip `:rest`; see the CI note below.
5. **Message map-recall2-40 before the push.** It is the peer integrator, worktree `map-recall2-worktrees/integrator-20261119`. The push edits TODO.md, HISTORY.md and the bundles, and touches the decorator chain (`galleryPipeline`, `roofMesh`, `threeBuildingMesh`, `vector-map.js`). Then fetch again; the push must be a fast-forward of origin/main.
6. **Push main over HTTPS.** The SSH agent has no identities, so `git push origin` fails with "Permission denied (publickey)". Use:

   ```
   /usr/bin/git -c credential.helper='!gh auth git-credential' push https://github.com/blackmad/map-recall2.git HEAD:main
   ```

   Never chain the push after `;`; the pre-push smoke runs for main. The flag stays off by default.
7. **The gate page.** It covers the 18 blocks in `scripts/design-units/gate-blocks.json` (lists in `artifacts/design-units/gate/lists/`), desktop and phone, `?world=live` beside `?world=live&designUnits=1`, with each pair diffed first (`--before`).
   - `house:frames --lists a.json:outA,b.json:outB …` runs the batch on desktop only.
   - For phone, use the iPhone Playwright project (a ride-shot spec at the same poses), or add a project option to `frames.ts`. That is not built yet.
   - Images go to the screenshots repo (blackmad/map-recall2-screenshots), never the game repo. `scripts/house-frames/block-page.ts` is the page precedent.
8. **A needs-david issue** with the page. Say plainly: this tier fixes "several houses where there is one building" (one eaves line, one roof, one wall family and one continuous bay rhythm per segment). It does not add the facade detail David missed on #393. List what the data lacks:
   - a measured roof class per segment (today the seed picks flat, mansard or pitched);
   - roof colours and chimneys, which are off on segment roofs.
9. **Post on #68**, update TODO and HISTORY (the Design units section), and record tokens.

## Notes

- **Red `rest` CI job.** Main's Canal CI `rest` job fails on `scripts/street-appearance/audit-frontages.test.ts` ("routing, curated identities or assignment compiler changed"). It was already red on 9283e62d0 (run 44551893744), on a58f085c4 (44562192246) and on a0d12ae87 (44562614210). It clears when map-recall2-40's Narva round lands; its branch already passes that test at e4b0a55ea. Gate our pushes on core, rail, joins and the structure test, and quote the run numbers.
- **#397** (needs-david, options A/B/C) is still open. The planning session recommended A, started on the Ring layer, which is what this branch is. Comment on #397 when the gate issue is filed.
- **Held, not to run:** the staged belt, Centrum and De Pijp looks stay held, and lanes #392 and #393 stay paused. Also not now: Gordel or Centrum drawing, the T7 answer key, any photo-read batch.
- **Worktrees:**
  - `integrator-design-units-20261119`: locked, port 4720.
  - `design-units-render-20261119`: the lane, done; port 4723 and e2e ports 4724–4726. It can be removed once main has its commit.
  - `~/Code/map-recall2-source-data-ordekaart-20261119`: on branch `archive/ordekaart-20261119`, pushed. Its sparse cone is `datasets/ordekaart-20261119`.
- **Tokens:** phase 0 about 298k; renderer lane about 289k; the integrator's phase 1 work is not metered separately (roughly 150–200k).
