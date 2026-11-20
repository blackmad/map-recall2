# Design units: in-flight checkpoint (2026-11-19, about 18:45)

**Ring gate for David: https://github.com/blackmad/map-recall2/issues/399** (18 blocks, desktop and phone, with the Node sheets; filed 2026-11-19 night). His block-by-block verdict decides whether tier C goes on by default for the Ring.

## Round 2 (2026-11-20): plots are houses; sheets waiting on David's review page

- **Verdict on #399** (comment 7033361626), from David: "neutral-to-worse - you're over aggressively collapsing buildings". The flag stays off.
- **The fix is on the branch, behind the flag; flag-off hashes are unchanged and 31 of 31 design-unit tests pass.**
  - The unit is now a family:
    - `designUnits/plotBreak.ts` draws each plot's pier, cornice and end block.
    - `designUnits/plotTone.ts` sets each plot's wall tone, within ±0.03 L of the family brick.
    - `memberDraw` gives each plot a `plotSeed`, a `plotEavesM` (its AHN front, clamped to 0.3 m of the line) and a `plotBreak`.
    - In `facadeExtras`, `PLOT_VARIED_COMPONENTS` are the heads, door dressing and balcony row, which roll per plot; `plotCrown` draws the crown.
    - In the mesher, `runSeed` places each plot's door.
  - `build-segments` now writes `plotEavesM` and `plotGroups`, the one-facade evidence from face intents (`identical`/`sameAs`) and same-building "one" reads. Only 3 segments have such groups; none are in the gate blocks.
  - The oriel (`bay-window`) was tried and dropped: front-on it drew as a blank pale panel.
- **Sheets:** `artifacts/design-units/r2/sheets/node-<key>.jpg`, 20 of them (the 18 gate blocks plus Marnixplein and Goudsbloemstraat). Each stacks photo cuts, today, round 1 and round 2, all Node renders (`scripts/design-units/review-sheets.ts render <cond>` / `sheets`).
  - The two Centrum rows are byte-identical in all three conditions, because they are not in the Ring extract.
  - The planning session loads the sheets into the review page https://claude.ai/artifact/6v5cxnHZAMQ5fvKV4dqdWM. No needs-david issue this round; GitHub issues are retired for verdicts.
- **Review layers (2026-11-20):** `artifacts/design-units/r2/layers/<key>/` holds `{today,r1,r2}.jpg`, which share one scale and left edge, with shorter strips padded with sky. It also holds a `photo-NN.jpg` per pand, rectified wall crops from `house:crops` run into `r2/crops-archive` (manifests are in `r2/crops-manifests`, never the committed ones), plus `photo-row.jpg` and `photos.json`. Make them with `review-sheets.ts layers`. The local review tool (lane `belt-review-tool-20261120`) loads the folder as a compare round.
- **Found in the photo rows:** many Ring rows have a mansard with dormers on every plot, even though the AHN rise is under 1.8 m: Rustenburgerstraat, Blasiusstraat, Van Ostadestraat, Ruyschstraat and Commelinstraat. The flat-top rule drops these, and the roof rule should be revisited after the verdict.
- **Next:** wait for David's verdict. No browser runs or lanes before it.

This is for a fresh session that has only the repo. Read it first. Then read `docs/handoffs/design-units-plan-20261119.md`, `docs/handoffs/design-units-handoff-20261119.md` and `docs/reports/design-units-phase0-20261119.md`.

## Ownership (from 2026-11-19 ~18:55)

The Fable planning session stepped out on 2026-11-19 to save cost: this integrator owns design units end to end and goes
straight to David (gate page + needs-david issue; his answers come on the issue). If the parent session closes, the
integrator stops: resume from this file. Peer replies from map-recall2-40 reach the parent; if nobody relays them, check
origin/main yourself before each merge and push. **#397 answered:** David chose A on 2026-11-19 at 17:10 ("uh, sure, A").
Units are the identity everywhere and elevations draw in segments; Centrum plots stay separate unless something joins
them. The work starts on the Ring layer. The answer was acknowledged and #397 closed at 22:45. Gordel and Centrum follow
under A only after David judges the Ring gate; start no Gordel or Centrum work before then.

Review bar (check sheets and pairs at full size, never from counts) before anything goes to David:
- every column alike within a segment; neighbouring segments distinct;
- windows tall with light frames;
- nothing above an eaves line that is not measured; no invented hips or gables;
- with the flag on, no front worse than today on window proportion, frame colour or storey count.

## Done state (2026-11-20)

- Main is at d10e4790d6 (fast-forward from e0c200a7e3; peer map-recall2-40 approved). The flag is off by default.
  The gate passed: check:canal core, rail and joins, plus the structure test and pre-push smoke.
- Gate issue #399 is filed: 88 of 88 framed on desktop and phone, with the Roemer Visscherstraat reshoot. We are waiting
  for David's block-by-block verdict.
- The overnight data-only work under A is done (phase 0 report, "Under option A" section):
  - Gordel check: 27% of units with liked rows disagree with the segments.
  - Centrum joins: 425 segments.
  - T8 ledger: on the Ring with the flag on, tier D is 10.3%; it is 95% with the flag off.
- Next: wait for David on #399. If he passes the Ring, turn tier C on by default there, then start Gordel and Centrum.
  Before David's verdict, make no renderer change and start no lanes.

## Gate status (22:45, superseded by Done state)

- Desktop: both halves are framed, 88 of 88. Three pands show `sameAsBefore` (Ruyschstraat 161684 and 155674,
  Bilderdijkstraat 157757). They are HouseSpec-described members that keep their own description, which is expected.
- Review: one failure. Roemer Visscherstraat 164845 drew dark frames from three wrong D1 reads; the photo shows cream
  frames. Fixed in c495de2459 (era fronts always light). Its desktop "after" is being reshot.
- iPhone: "before" is complete. The first "after" run timed out after Commelinstraat, so 12 blocks are being re-run with
  `--reopen-every 8`. Script: scratchpad `gate2.sh`; log `gate2.log`; marker `GATE2_DONE`.
- Next steps:
  1. run `gate-sheets.ts`;
  2. upload with scratchpad `upload.sh`;
  3. file the issue from scratchpad `issue.md`;
  4. post on #68;
  5. merge main (Hoofddorpplein 7af6d77c0 is in; the fb-windows lane may be too);
  6. run the gates and push main.

## Merge notes for the next main merge (peer relays, 2026-11-19)

- Narva landed on main (7f701ab3c9). Hoofddorpplein (3b57b86ae: generate.ts, frontKit, roofKit, generator test, district
  files) was still pending at 18:55. Merge main only after it lands.
- map-recall2-40 will merge `lane/fb-windows-20261119` @ 4372b392e at about 20:00. It touches:
  - `threeBuildingMesh.ts`: one import and one call in `visibleQuads` (partyWallStoreys.ts). Our edits there are
    `runSeed`, the `designMember` context flag and the roof-extras skip, all outside `visibleQuads`, so expect no
    conflict or only a small one;
  - `facadeExtras.ts`, small edits. Ours there is `DESIGN_MEMBER_COMPONENTS` plus the row budget for `designMember`;
  - `facadeOrnaments.ts`, the new `projectionWindowFit.ts` and the LAB111 landmark.
- After merging, rebuild the bundles and re-run the flag-off BASE hashes in `draw.test.ts`, since their baseline moves.
  Take the new values only when the change comes from main's own commits.

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
Pre-gate fix round (coordinator, 2026-11-19 evening; one round, then the gate, no further rounds before David sees it). Done:
- one design per segment: the run seed is the segment's (`runSeed`, threeBuildingMesh.ts); a member's street wall dresses
  only `DESIGN_MEMBER_COMPONENTS` (facadeExtras.ts: cornices, heads, frames, sills, door surrounds, string courses, plinths,
  stoops) with the row budget, so balconettes, flower boxes, anchors, bands and scaffolding are dropped rather than landing
  on one or two windows; conformance tests: one preset/window/wall/series per segment, and a 3-bay and a 6-bay plot dress
  the same parts;
- window class: era look adds `sash: 'transom'` (tall sashes under a transom light, light frames);
- roofs: `ahn-fronts.ts --roof` measures each member's roof mass over its front band (`riseM`, ground-free);
  build-segments gives `roofRiseM` (3,205 of 3,235 measured; 77 at 1.8 m or more). `segmentRoof`: a slate roof storey with
  dormers only at >= 1.8 m, else a flat lid (no lip, no roof box: nothing wall-coloured over the eaves line); roofs closed
  at both ends (no hips); slate tone from the darker half. All seven regression segments measure flat;
- wall: `segmentPoolDraw` (measuredWallPool.ts): one brick per segment from the measured pool within 1 km, lightness
  between its 40th and 85th percentile readings, OKLab a >= 0.015 (brick, not grey), picked by segment seed;
- check 5: window width is 0.55 of the pitch on every member of both rows (the photo's 55-60 %, low end; unchanged, now
  asserted >= 0.5 in the test); a single plot takes the era count for its own width (Rustenburgerstraat 119632, 4.3 m: 2
  columns, was 3); a multi-plot member keeps the segment pitch.
Sheets: `artifacts/design-units/rows/{van-ostadestraat,rustenburgerstraat}/sheet.jpg`. The browser pairs in
`artifacts/design-units/frames/{vo,rb}-{before2,after2}` predate this round: reshoot at the gate.
Coordinator passed both sheets (2026-11-19 ~18:45); guessed roof furniture dropped for members (6e5449ff0). Gate shoot
started ~18:45: the gate script is in scratchpad `gate.sh`. It runs the 18 lists in `artifacts/design-units/gate/lists/`
with `house:frames --lists`, desktop then iphone (`HOUSE_FRAMES_PROJECT`); before `?world=live`, after
`?world=live&designUnits=1 --before`; out `artifacts/design-units/gate/<desktop|iphone>/<before|after>/<key>`; logs
`artifacts/design-units/gate/<dev>-<label>.log`; PW_PORT 4724. If the session died, kill port 4724 by PID and rerun the
missing half. Then: page into the screenshots repo; needs-david issue (flat tops from AHN: no wall dormers/set-back
dormers; seeded wall order can be wrong, e.g. Rustenburgerstraat's palest house is the right one; no bands, arched
portals, stoops, French balconies; the question: better/same/worse than today, block by block, decides tier C default
on the Ring layer); Node sheets beside the in-game pairs for the two rows; comment #397; post #68.
Earlier still-to-do (superseded by the round above): the wall tone against the photo (the browser trial read L 0.50 / hue 42 against the photo's 0.59 / 47; not
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
- **Tokens:** phase 0 about 298k; renderer lane about 289k; the integrator (phase 1, gate round, overnight data work, two main merges) was not metered separately, roughly 600–700k across its contexts.
