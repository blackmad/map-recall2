# Canal Recall — appearance programme: architect plan

**Audience:** an agent with no session history. Everything needed to execute is in this file or at a
cited path. Written 2026-09-26 against `feat/amsterdam-facade-rebuild` @ `4061308`.

---

## Owner update — autonomous visual review

The owner explicitly requests **no human-in-the-loop** (2026-09-26). Agents must inspect imagery and answer review questions themselves, retaining `model-visual-review` provenance, crop hashes, uncertainty, and abstentions. Model judgements are authorized review evidence, never relabelled as human ground truth. This supersedes owner-review gates below for visual judgement. External licensing/storage constraints remain distinct.

## Current priority — material and colour validation, 2026-09-26

Latest owner steering (2026-09-27): compare direct photo-to-SVG with structured
facade generation, with and without OccFacade window/door/shop proposals.
[The bounded vector pilot](photo-to-facade-vector-pilot.md) specifies matched
inputs, independent visual evaluation, a subsequent holdout, and token-cost
assumptions. The six-model pilot has now run; no general facade winner passed visual review.
See `scripts/facade-eval/FACADE_VECTOR_PILOT.md`. Next preserve OccFacade pixel
geometry and test LLM selection/grouping/classification of numbered components.
Retain source/owner checks; plausible drawings are not measured facade geometry.

The owner has narrowed this phase to accurate colour/material matching, ahead of
roof/gable work. The execution plan and honest results are in
[wall-material-demo.md](wall-material-demo.md). A working opt-in game demo and
hashed visual report cover a ten-case gate drawn from 100 source assessments.
Six broad material families are accepted; four cases remain unresolved. None of
this establishes 100 exact colour/texture matches. Default game appearance is
unchanged. Do not resume gable work or expand texture assignment until the
material gate and its explicit outstanding work are addressed.

## Earlier source-colour execution status — 2026-09-26

- Autonomous visual review covers all 598 available observations across 501 buildings.
  The Sol, Terra, Luna and primary-agent reviews promote 372 building wall colours,
  up from 16. Six conflicting groups were resolved by visual re-review; four remain
  withheld because a single wall colour would misrepresent their facades. Abstentions
  remain explicit. This is model review, not human ground truth.
- `npm run promote:wall-colours:model` verifies source-image hashes, combines the
  committed review files, resolves duplicate observations and writes promotion input.
  Local release `3d4551a8716c6b60dc59ba0d5de9b851628e62f4ae3eef2c6be7a5bd4ab7c9da`
  includes those 372 colours among 7,395 buildings. The other 7,023 retain labelled
  contextual defaults; the review is complete for existing imagery, not the district.
- Da Costakade 13 is corrected using the supplied brick reference. Unmeasured bases
  inherit the wall and render as a single extrusion, removing invented grey bands.
- Fixed the camera-update loop that destroyed and reloaded visible detail meshes.
  The live-camera regression failed with 360 lost layer frames before the fix.
- Roof v4 withholds intersecting source roofs as whole buildings: one safe roof
  remains and 6,661 slanted buildings use flat fallback. This removes shards but
  does **not** complete rooflines or gables.
- Priority: verify stable rendering and the expanded colours, then build closed
  upper/gable walls with an atomic fallback replacement. Extend evidence coverage
  and place reviewed signs subsequently. Routine visual decisions stay with agents.
- Generated releases and photographic evidence remain local; source commits do not
  constitute deployment of these assets to a remote demo.
- Validation after integrating current main: `check:canal`, clean-checkout
  typechecking, the named roof regression, and eight desktop/iPhone-emulation
  appearance checks all pass. Browser checks cover the real study route, repeated
  camera updates, reviewed-only coverage and Da Costakade 13's full-height colour.

## Earlier demo implementation status — 2026-09-26

- Source integration includes current main, source-bound wall-colour promotion and
  browser provenance, measured-colour coverage mode, end-to-end semantic tag
  preservation, and the datum-corrected v3 roof compiler.
- Agents visually reviewed all 72 unique signage frontages (76 sample rows), with
  73 sign regions and explicit uncertainty. The review page loads the results.
  Game placement for these new sign labels remains a separate task.
- Sixteen model-reviewed wall colours are promoted into the local district demo.
  Release `6ee345158a1091e6c9c56dd8ac095440023492379fc534fb1bfbd7d475b228c4`
  contains 6,036 roof-bearing buildings / 19,973 surfaces / 26 roof tiles, with
  626 slanted buildings withheld. Generated evidence and release assets stay local.
- An eave-cut experiment was rejected: without source-supported gable-end walls,
  complete roof coverage and loading fallback, it opens holes in building masses.
- Profiling and lattice evaluation are complete for this batch. Neither established
  evidence for lowering facade detail gates or automatically accepting lattice fills.

- Final validation: full `check:canal`, fresh-install clean-checkout typechecking,
  roof/artifact checks, and eight repeated desktop/iPhone-emulation route and
  coverage checks pass. A startup source-replacement race is fixed and has a
  regression that fails against the old implementation. The local demo is ready;
  broader coverage, game placement of new signage labels and evidence hosting
  remain future work, without requiring routine owner review.

## Execution revision — 2026-09-26

This revision supersedes conflicting historical statements below. Baseline inspected:
`ece4d48` on `feat/amsterdam-facade-rebuild`; local main is 67 commits ahead and
127 behind this branch. Recheck divergence before integration.

- **T0.1 source preservation is committed**, including review scripts, reference sets and
  publication scripts. Clean-checkout validation remains required. The current dirty state
  is two data pointers and sixteen untracked releases; preserve these exactly. Do not
  commit a pointer to an unavailable release. Storage remains unresolved.
- **T0.3 is implemented** by `ece4d48`: seventeen tests, including the eight listed below,
  are wired into the aggregate gate. Verify execution rather than add duplicate entries.
- **Initial implementation batch:** Sol owns T2.4 lattice evaluation; Terra owns the T2.6
  semantic-tag preservation prerequisite; Luna owns clean-checkout validation and any
  bounded source fixes it exposes. Each has a separate worktree/branch. The integrating
  agent owns this plan, package scripts, status documents and integration. Use these
  requested models plus DeepSeek via OpenCode. The CLI successfully completed T2.4; MCP tools were not exposed in this active session despite the new enabled configuration.
- **T1.1 precedes visual LoD changes**, but independent offline evaluation and tag
  preservation may proceed in parallel. Profile reproducible viewport, DPR, camera,
  route, warm-up, sample duration and p50/p95 frame times. Layer toggling gives marginal
  frame-cost estimates, not exact GPU attribution. Phone-width desktop results measure
  layout only; do not describe them as physical-phone performance.
- **T1.2 cannot require invented ground-floor or fascia bands.** Only source-supported,
  accepted regions may render. Ground-floor detection remains parked. Separate the
  implementation's rendering capability from acceptance on actual reviewed evidence.
  Establish a frame-time budget from T1.1 before changing gates.
- **T2.1 must fail closed:** reject stale or missing evidence hashes at promotion;
  publication may fall back to a labelled procedural prior but must never retain a stale
  measured label. Bind accepted records to building identity as well as measurement hash.
  A coverage toggle must filter on provenance, not merely the presence of a colour.
- **T2.6 first preserves semantics end to end**, including upstream staging/LoD1 merging,
  with absent tags remaining absent. A church/museum tag alone does not establish a
  measured colour, roof or spire; defer distinctive geometry until source-backed rules
  and visual validation exist. Measure tile gzip changes before publication.
- **T2.5 remains an atomic, versioned regeneration task**, including explicit height-datum
  conversion, reviewed-roof regressions and all dependent tiles. Do not slip a constant
  fix into this batch without its release. Do not publish local dirty pointers.
- **Integration order:** validate the clean baseline, integrate the bounded batch, run
  relevant tests and the aggregate gate, then prepare the ordinary main merge in a
  dedicated integration worktree. Resolve failures before pushing. The existing large
  divergence is its own integration task, not evidence that the new batch has shipped.
- **Autonomous visual gates:** agents perform gable/sign recognisability review and
  point-cloud spot checks, preserving model provenance and abstentions. External
  photo-texture redistribution licensing and evidence storage remain unresolved.
  T3.3 may be drafted, but sending correspondence needs explicit user instruction.

## 0. Operating rules — read before touching anything

- **Repo:** `/Users/blackmad/Code/map-recall2`. Work in a **git worktree**, never the main checkout.
  This plan was written from `.worktrees/amsterdam-facade-rebuild`.
- **Use `/usr/bin/git`, not `git`.** The shell aliases `git` to a wrapper (`_scmb_git_branch_shortcuts`)
  that breaks scripted use.
- **Never `git stash` bare.** The stash stack is shared across worktrees and other agents use it.
  Prefer a WIP commit. If you must stash: `git stash push -u -m "<unique-tag>"`, capture the SHA from
  `git stash list --format='%H %gs'`, restore with `git stash apply <sha>`.
- **Never reset or discard a dirty worktree.** There are ~2 GB of uncommitted evidence files that are
  deliberately untracked and not reproducible.
- **Do not commit binary assets.** Owner instruction. `public/data/**` evidence, releases and
  `review-data/` stay out of git.
- **One agent per worktree and branch, with an exclusive lane** (presentation / routing / content /
  domain logic) and a unique dev-server port. The integrating agent owns `game.js`, `index.html`,
  `package.json`, lockfiles, generated bundles, `TODO.md`, `HISTORY.md`, merges and pushes. Leaf
  agents return a commit SHA and verification output instead of editing those.
- **`TODO.md` and `HISTORY.md` are updated in the same change that moves an item.** `TODO.md`
  (`public/canal-drive/TODO.md`) holds only unfinished work, ordered P0–P3. `HISTORY.md` is
  append-at-the-top and records *why* a thing is the way it is.
- **Commit a typed source module and its generated browser bundle atomically.**

### Running deepseek / opencode lanes

- Invoke: `opencode run --auto -m opencode-go/deepseek-v4.1-flash "<brief>"`.
- **`--auto` is mandatory** for any lane that writes files or runs commands; without it the process
  blocks on a permission prompt that has no TTY to draw on, forever.
- **`opencode run` block-buffers stdout when redirected to a file.** A log at zero bytes means the
  agent is *working*, not hung. Judge liveness with
  `ps -eo pid,pcpu,etime,command | grep "opencode run"`. Three lanes were killed on this misreading;
  one had already finished.
- `.mcp.json` at the repo root registers `opencode-mcp` at project scope (durable jobs, queryable
  progress). Prefer it over shelling out. It connects at session start.
- **deepseek is good at:** a typed module + test + an out-of-tree scorer against an existing
  reference set. **It is bad at:** anything requiring it to look at an image — it will compute a
  histogram and report it as vision. *You* supply the reference set; it writes the logic.
- An honest negative result with a diagnosis is worth more than a tuned number. Say so in every brief.

---

## 1. Context

**Product goal:** a recognizable Amsterdam for a geographic-learning cycling game, with occasional
embellishments — signage, roofs, building colours.

**Governing principle**, from `public/canal-drive/TODO.md`: *a learning game that teaches the wrong
thing is broken in a way that a plain-looking one is not.* P0 (teaching something false) is currently
empty; P1 is the learning model. **All five appearance lanes are P2 by the project's own rule.** This
plan is the "how it looks" tier and competes with P1 for owner attention.

**Delivery levels**, from `CITY_RECONSTRUCTION_REVIEW.md` — the spine of this plan:

| Level | Contents |
| --- | --- |
| 1 City geometry | Correct footprints/identity, source heights and roofs, water/streets/trees |
| 2 **Recognizable street** | Source-supported **major colour regions, floor/bay rhythm, entrance zone, visible gable/balcony/storefront cues**, simplified components. Inferred fills remain identifiable and reversible |
| 3 Measured detail | Individually fitted openings, physical signs, roof details, metric registration |

The programme has been chasing level 3 while level 2 is what makes a street recognizable at riding
speed. That document also warns: *"The current 0.15 m registration, 5 cm contact and 90% opening
precision/recall requirements describe a demanding detail milestone. They should not be the only way
to measure useful street representation."*

### Owner decisions already taken (do not re-litigate)

1. **Only ship what's measured** — nothing invented renders on a real addressed building without an
   honest provenance label.
2. **Target level 2 across all five lanes first.** Level 3 only where a lane proves easy.
3. **Unmeasured buildings keep the hash palette** but must carry
   `sideColourSource: 'procedural-prior-not-measured'`, plus a coverage-view toggle showing only
   measured buildings. Rationale: variation reads better than a citywide grey, but measured and
   invented must never be indistinguishable in the data.
4. **First target area:** `da-costa-jordaan-v1` (Da Costabuurt + Jordaan), the only compiled area.
5. **Commit the source and merge to `main`.**
6. **Amsterdam street mode is cycling in the presentation**, even though it reuses road-routing
   physics internally.

### Still outstanding, owner-only

- Storage answer for ~2 GB of untracked evidence and releases.
- Whether a differing ground floor should render as a separate colour band (see Lane 1; the automatic
  detection is a measured dead end).
- Landmark GLB redistribution licence (see Lane 5). Currently parked by owner decision.

---

## 2. The two facts that shape every lane

### 2.1 The detail lanes are invisible during normal play

| Gate | Value | Source |
| --- | --- | --- |
| Study facades load | z **16.5** | `studyFacadesBrowser.ts:32` `STUDY_FACADE_MIN_ZOOM` |
| Openings / silhouette draw | z **18.25** | `FACADE_SILHOUETTE_MIN_ZOOM` |
| Joinery + signs draw | z **19.35** | `cityAppearanceFacadeLod.ts:5` `FACADE_JOINERY_MIN_ZOOM` |
| Study roofs / public realm | z **15.25** | `studyRoofsBrowser.ts:13` |
| **Actual driving zoom** | **≈17.13 top-down / 17.48 chase / 18.03 cockpit** | `vector-map.js:1215-1226`, `constants.js:80` (`CAMERA_ZOOM_INITIAL = 0.50`) |

Computation: `pixelsPerMeter = 3 × camera.zoom × displayScale`,
`zoom = log2(cos(lat) × 156543.03392 × pixelsPerMeter)`, `+0.35` chase, `+0.9` cockpit. At
`CAMERA_ZOOM_MAX = 1.5` it reaches 18.71 / 19.06 / 19.61. `displayScale` grows with window width, so
a wide desktop window pushes this up; the default driving view does not clear the opening gate.

**Consequences:** the 307 signs have never been visible to a player. 117,246 window patches and
5,513 doors are below the gate at normal speed, in 26 tiles covering 2.2% of the city.

**Therefore: improving what a lane contains is worth nothing until its content is visible.** The
gates exist for performance (1.93 M triangles; thirteen landmark GLBs were disabled after a
playtest), so this is a measurement problem, not a constant to edit.

### 2.2 Nothing on a building surface is measured

Except **height** (3DBAG LoD1.2 / AHN) and, in 2.2% of the city, **roof plane geometry**.

`scripts/city-appearance/publish-area-geometry-demo.ts:107` colours all 7,395 district buildings via
`contextualBuildingPalette(building.id, building.year)` — an FNV-1a hash of the BAG id over a
6-colour table (`src/canalRecall/cityAppearancePalette.ts:3-41`), bucketed by year into
`<1925 / <1965 / else`. The 598 observations have zero influence.

Live distribution (`releases/c4bebc1f…/maplibre-appearance.json`, 7,395 buildings):
`#73513f` 2,427 · `#aa8d62` 1,567 · `#c3b99e` 1,420 · `#94553f` 1,255 · `#858b87` 465 · `#b6b8b0` 261.

Citywide: only **6,573 of 342,993** buildings (1.9%) carry a real OSM `colour`; 15,697 a `roofShape`;
967 a `roofHeight`.

The code is honest about this — `buildingTilesBrowser.ts:52` **throws** if a release claims to be
measured when `styleSource === 'procedural-prior-not-measured'` — but that honesty never reaches the
player, and there is currently nothing to tell them, because every lane is invented.

---

## 3. Orientation — where things live

```
src/canalRecall/facade/          typed domain modules (colour, openings, gables, signs)
src/canalRecall/landmarks/       signature model placement (currently dead in game)
scripts/facade-eval/             evaluation harnesses + scorers
scripts/pointcloud/              MLS tile decode, measure, publish
scripts/roofline-eval/           roofline/gable reconciliation
scripts/city-appearance/         release publication
scripts/review/                  review desks and correction registries (168 untracked files)
public/canal-drive/              the game; legacy canvas JS + generated bundles
public/canal-drive/TODO.md       the work board (unfinished only, P0–P3)
public/canal-drive/HISTORY.md    why things are the way they are (append at top)
public/data/city-expansion/      immutable releases + current.json pointer
review-data/                     frozen gold/reference sets
```

**Key contracts**
- Vistas segmentation label map: `0 other / 1 sky / 2 building / 3 occluder / 255 unknown`.
- Grades bind to evidence by `sourceSha256`; re-measuring must invalidate, never silently inherit.
  See `src/canalRecall/facade/appearancePublication.ts` (`resolvePublication`).
- Release pointer: `public/data/city-expansion/current.json`; prior pointer kept in `rollback/<sha>.json`.

**Commands:** `npm run lint` (tsc), `npm run check:canal` (aggregate pre-integration gate),
`npm run storybook` / `npm run build-storybook`, `npm run demo:neighbourhood`,
`npm run publish:point-cloud-facades`. Per-module tests run `npx tsx <module>.test.ts` and print an
assertion count.

---

## 4. Phase 0 — Save the work

**Why:** this worktree is **119 commits ahead of `main`, 62 behind**, a diff of **3,348 files /
178,145 insertions**, with **306 uncommitted files**. ~200 are source files existing nowhere else.
The previous plan opened with this and it never happened. Every lane below is worth less than this.

### T0.1 — Commit untracked source

**Inputs:** `git status --porcelain` → 267 untracked, 39 modified.
Source to commit (~13 MB): `scripts/review/` (168 files), `scripts/city-appearance/` (24), loose
`scripts/check-*.ts` / `check-*.mjs`, `review-data/sign-gold/`, `review-data/wall-colour-gold/`.

**Explicitly exclude** (~2 GB, needs a storage answer, not a commit):
`public/data/city-expansion/evidence/` (212 MB), `public/data/city-expansion/releases/` (~48 MB each),
`public/data/facade-repair-preview/` (290 MB), `review-data/visual-audits/` (289 MB),
`review-data/staged-owner-output/` (46 MB).

**Steps:** verify `.gitignore` covers the excluded paths; commit source in coherent groups (review
desks / publication scripts / reference sets), not one opaque commit; run `npx tsc --noEmit` **in a
clean checkout** of the result.

**Acceptance:** `npx tsc --noEmit` exits 0 in a *fresh* worktree of the new commit — not just in this
one. **This has bitten before:** a commit passed locally only because untracked files were on disk,
and broke a clean checkout.

### T0.2 — Merge to main

Inspect divergence first (`git log --oneline main..HEAD`, `git diff --stat main...HEAD`). Ordinary
non-destructive merge. Run `npm run check:canal`. Push.

### T0.3 — Wire the eight orphan tests into `package.json`

These test files appear **zero times** in `package.json`; there is no `npm test` and no glob runner,
so ~3,500 lines are covered by tests that never execute:

`openingLattice.test.ts` (73 assertions) · `openingMerge.test.ts` (11) · `openingScore.test.ts` (17) ·
`gableFit.test.ts` (41) · `roofReconcile.test.ts` (30) · `elevationRoofline.test.ts` (21) ·
`stripRoofline.test.ts` (33) · `rooflineGrade.test.ts` (20)

Add them to the `check:canal` chain. **Acceptance:** `npm run check:canal` runs all eight and the
assertion counts appear in its output.

---

## 5. Phase 1 — Make a lane visible before making it better

**Do not simply lower the constants.** Measure first.

### T1.1 — Profile the study area at real driving zooms

**Steps:** run `npm run demo:neighbourhood`; ride `da-costa-jordaan-v1` at z17.1 / 17.5 / 18.0,
desktop **and** phone width; record frame time per layer (`osm-colored-buildings`, `StudyFacades`,
`StudyRoofs`, `PyramidalRoofs`). Use Storybook for deterministic states that are expensive to reach
by driving.

**Output:** a table in `HISTORY.md` of frame cost per layer per zoom per device.

### T1.2 — Introduce a level-2 facade LoD

**Hypothesis to test:** at z17–18 the right content is **banded colour regions plus a fascia band**,
not 1.93 M triangles of joinery — and it is *cheaper* than what is currently gated off, because it is
a handful of quads per building instead of per-opening geometry.

**Touch:** `src/canalRecall/cityAppearanceFacadeLod.ts` (the `'openings'` visible-set list at
:19-22), `studyFacadesBrowser.ts:46` `facadeBatchOpacity`.

**Acceptance:** at z17.5 chase view a building shows distinguishable wall/ground bands and, where a
shop exists, a fascia band; frame time stays within the budget measured in T1.1.

### T1.3 — Decide the sign gate on evidence

A 0.55 m band (`MACHINE_SIGN_BAND_HEIGHT`, `cityAppearanceMachineSigns.ts:15`) at z19.35 is
invisible. Test whether a wider, simpler band reads at ~17.5. **Owner judgement required** — this is
a recognisability question, not a metric.

---

## 6. Phase 2 — One next step per lane, all at level 2

### Lane 1 — Building colour / texture

**State.** `dominantWallColour.ts` (42 assertions) and `wallColourSample.ts` are tested; 598
observations measured by `scripts/facade-eval/measure-wall-colour.ts`; a grading desk exists
(`public/canal-drive/wall-colour-review.html` + `build-wall-colour-sample.ts`, 598 entries, keys 1–4,
localStorage draft, export bound to `sample.sha256`); `appearancePublication.ts` has the
`'accepted-human-reviewed'` state and the `sourceSha256` staleness check (37 assertions).
**Nothing renders.**

**Known limits.** Colour constancy: all 7 pixel statistics sit ~50 RGB units from eye judgement, so
vision is reliable for *classification*, not for hex. Grading is therefore necessary.

**T2.1 — Wire measured colour into the release.**
- Inputs: graded output → `review-data/wall-colour/v1/accepted.json` via a new
  `scripts/city-appearance/promote-wall-colour.ts`, which **hard-asserts** each grade's
  `sourceSha256` against the current measurement (copy the check in
  `scripts/review/refresh-reviewed-wall-colour.ts`).
- Change `publish-area-geometry-demo.ts:107` to consult the accepted set before falling back to
  `contextualBuildingPalette`.
- Add per-building `sideColourSource: 'measured-accepted' | 'procedural-prior-not-measured'`;
  `decorateBuildingFeature` (`buildingTilesBrowser.ts:65-73`) stops hard-coding the label.
- `buildingStyle.ts:buildingColorExpression` needs **no change** — it already prefers `sideColour`.
- Add the coverage-view toggle showing only `measured-accepted` buildings.

**Acceptance:** riding Da Costabuurt, an accepted building reads differently from its contextual
neighbours; the coverage view distinguishes them; a regression asserts no building renders
`measured-accepted` without an accepted observation, and that a stale `sourceSha256` drops the grade
rather than publishing it.

**Parked — do not reopen without new evidence.** Ground-floor colour banding. 36 of 46 visible bases
differ from the wall above (78%), so one colour per building is wrong for four buildings in five and
wrong exactly at eye level — but three passes failed to detect it automatically:

| pass | commit | differs found | same correct | obscured abstained | strict |
| --- | --- | --- | --- | --- | --- |
| one | `cd4634a` | 1/36 | 10/10 | 0/12 | 11/46 |
| two | `b823966` | 8/36 | 3/10 | 11/12 | 11/46 |
| three | not merged | 0/36 | 6/10 | 11/12 | 6/46 |

Pass three measured base-to-upper-wall colour distance normalised by within-wall variation:
`differs` median **2.12**, `same` median **2.17** — the same distribution; the best possible
threshold takes 36/36 differing bases while keeping 0/10 matching ones. It detects "the base is not
the wall above", true of 78% of buildings, not "the base is a different material". **Do not re-run
the raw-distance-to-wall test.** Full account: `FACADE_BANDS_REPORT.md`; brief:
`FACADE_APPEARANCE_HANDOFF.md`. Two traps are pinned in the regression corpus: on a mostly-painted
facade the reference wall is partly the thing under test (Lauriergracht 74 is cream 18 m→3 m), and a
crop with `baseZ = 3 m` starts *inside* the 2–6.5 m search window so a plinth at 5.5 m reads as a
shopfront.

### Lane 2 — Retail signage

**State.** 307 live signs, **all identical**: 512×64 canvas, `#25372e`, `700 44px Arial`, cream
`#e7e5d9`, truncated at 28 chars, 0.55 m band (`studyFacadesBrowser.ts:44`). 307 of 307 have
`colour: undefined` and `kind` absent; **0 are `observed-physical-sign`**. Text is machine-read
(Gemini 3.1 Flash Lite, $0.0145, `quarantined-not-canonical`).

**The photo path already works and has no data.** `observed-physical-sign` UV-maps a real crop onto
source-bound geometry carrying `sourceSha256`, `physicalSignId`, `observationId`, `captureDate`;
written by `publish-area-geometry-demo.ts:47-56`, consumed by `studyFacadesBrowser.ts:44`. Publication
is gated behind an evaluation index that was never supplied.

**Measured this session — do not redo.** The reader already uses the ground tier (110 px/m over a
4.9 m band; full tier reads 11/45 storefronts vs ground's 33/45), so more pixels will not fix partial
words. Preprocessing (`scripts/facade-eval/prep-ocr-crops.ts`) reaches 38/45 and 158 lines vs 104,
but the gain is more *fragments*. `src/canalRecall/facade/signConsensus.ts` votes across readings and
recovers `CLAIM NU OP`, `EERLIJK ETEN.NL`, `DOUGLAS`, `MAGAZINES GIFTS BOOKS` — but scored against
the independent reference `review-data/sign-gold/v1/transcriptions.json` via
`scripts/facade-eval/score-sign-consensus.ts` it **ties the do-nothing baseline**: 9/10 names
recovered, 5/10 exact, 6/29 invented, both ways.

**T2.2 — Level 2: a fascia band with measured colours.** Stop chasing text. A sign is small, flat and
high-contrast, so fascia and letter colour are among the *easiest* things here to measure — far
easier than a wall. A dark green fascia with gold lettering reads as a bruin café even in the wrong
typeface; the right typeface on a wrong-coloured band reads wrong. Publish `support` / `views` /
`years` from `signConsensus` as the notability and invention filter; **do not publish the rewritten
text**.

**T2.3 — Feed the photo path.** Locating and cutting a clean rectangle is more valuable than better
OCR. See `SIGN_PHOTOGRAPHY_PLAN.md` §3 for the view-selection scorer (px/m across the sign rect,
obliquity, occluder fraction from Vistas class 3, exposure, recency; abstain if none clears the bar).

**Blocker for photographed signs (tier 1 only):** using panorama imagery as *measurement input* is a
different licensing posture from shipping it as a *texture in a distributed game*. Answer before
building the crop publisher. Does not block the fascia-colour work.

**Why the reference set says text is the wrong target:** `LA BASTA` was read only as `DASTA` and
`PASTA` — both wrong on the same letter, so no vote recovers it; redundancy pays only where errors
are independent. On the Freddy Fryday frontage the fascia panel crops the leading F, making
`REDDY FRYDAY` a *correct* reading of what is visible — a view-selection problem, not a text one.

### Lane 3 — Windows and doors  ← **best-specified task in the repo; give this to deepseek**

**State.** What ships is procedural: `src/canalRecall/facadeOpeningLayout.ts` (floors × bays, door at
bay 0) via `cityAppearanceFacadeRecipes.ts:17` → **117,246 windows, 5,513 doors, 26,077 trims,
1,930,568 triangles**, `styleSource: 'procedural-prior-not-measured'`. `openingMerge`,
`openingLattice`, `openingScore` and the retail chain contribute **zero** geometry.

**Detector history.** Per-lane scores (`HISTORY.md:140-148`) all failed the ≥0.80/≥0.80/≤0.30 m rule:
rfdetr 2.4%/15.7%, windet 7.7%/7.1%. **But "union" is a different thing and is good**:
`facade/openingMerge.ts` over RF-DETR + YOLO26x-seg, published as
`public/data/facade-model-eval/v1/predictions/union-R0.json` (60 records, **578 boxes**).

| scope | precision | recall | median centre | tp/fp/fn |
| --- | --- | --- | --- | --- |
| union, all walls | 5.33% | 24.3% | 0.273 m | 17/302/53 |
| **union, facades ≥4 m with a window-sized opening** | 10.0% | **53.8%** | 0.299 m | 14/126/**12** |

Owner's verdict (`TODO.md:185-188`): *"found it good; its one real failure is **missing** openings,
where a van, tree or shadow hides windows. Detecting harder cannot fix this — the evidence is not in
the image."* Which is exactly what `fillOpeningLattice` imputes.

**The gold set is a lower bound, not a verdict** (`HISTORY.md:151-160`): *"the MLS measured 13
openings on that façade while the photo plainly shows about 20, and rfdetr's boxes land on the
windows the measurement missed."* It lives at `review-data/facade-model-gold/v1/measured.json` — 60
walls, 70 openings, built from point-cloud `openingRects`, **not** by hand. 40 of 60 walls have no
opening at all; only 5 are ≥4 m with a window-sized opening; openings carry no `kind`. So
`TODO.md:285-288`: *"its job has changed: score **imputation** — did the lattice put a window where
one really is — rather than re-adjudicate the detectors."*

**T2.4 — Run the lattice over the union and score it.** Nothing new is needed: no data fetch, no
model run, no spend, no owner decision.

- **Input:** `public/data/facade-model-eval/v1/predictions/union-R0.json` — already in wall metres,
  already carries `wallWidthM` / `wallHeightM`.
- **Function:** `fillOpeningLattice(boxes, wallWidth, wallHeight)` from
  `src/canalRecall/facade/openingLattice.ts:170`. Rows are trusted first, spacing is estimated
  *within* each row, the ground row is excluded by default, and it abstains rather than inventing.
- **Scorer:** `scripts/facade-eval/score.ts` (already reads this contract; `scores.json` already
  defines the `facade` scope).
- **Report:** full confusion numbers on both scopes, **plus** the `LatticeRowDiagnostic`
  (`openingLattice.ts:60`) abstention counts — how many rows refused and why.

**Acceptance:** a number for whether the lattice closes the 12 facade-scope false negatives, and an
abstention count that sizes the hand-labelling job. `TODO.md:288` — *"Sizing the labelling job waits
on the lattice's first real output."* An honest negative is a valid result.

**Do not:** re-adjudicate detectors against this gold set; it under-counts by construction.

### Lane 4 — Roofs and gables

**State — the best lane.** In the study area, 3DBAG LoD2.2 gives **6,662 slanted candidates, 5,983
drawn, 19,606 surfaces, 679 withheld**. Elsewhere: flat lids, plus 124 pyramidal cones via Three.js
(`vector-map.js:270-277`). Gabled / hipped / skillion / **dome** keep full `height` — i.e. draw as
flat-top boxes (`buildingStyle.ts:224-281`; walls cut to eaves only for `pyramidal`).

**T2.5 — Fix the 0.65 m datum bug.** `selectCompatibleSourceRoof`
(`src/canalRecall/cityAppearanceRoofs.ts:15-26`) publishes `up − groundNAP` while `up` is the
owner scene-local axis (NAP − 0.65 m). **Every published study-roof eave and ridge is 0.65 m too
low**, and correcting it flips the selected component set on **674 of 7,395** buildings; the 679
withheld get re-adjudicated against the same gates (`eaves ≥ 0.6 × height`, `ridge ≤ height + 3 m`,
`ridge > eaves + 0.25 m`).

This must be a **versioned regeneration, not a silent edit** — `scripts/check-city-appearance-roofs.ts`
pins the release counts. Named regression: `scripts/review/check-reviewed-roof-vertical.ts`.
**Acceptance:** new release id, 26 owner tiles regenerated, counts re-pinned, `check:canal` green.

**Do not wire `classifyGable` yet.** On 10 real gold elevations
(`review-data/roofline-gold/v1/g1/patches.json`) it returned **3 `unknown`, 2 lijstgevel, 2 klokgevel,
2 tuitgevel, 1 halsgevel, 0 trapgevel, 0 puntgevel**, and the parametric template **lost to a plain
polyline in 10 of 10 cases**; 15 of 30 reconciled spans conflicted. It needs more real profiles
before it needs a renderer. *(Correction to `TODO.md:143-144`, stale in both directions:
`classifyGable` **has** a non-test caller, `scripts/roofline-eval/reconcile-gold.ts:118`, and has
**no test file at all**. Its input is `GableFeatures` via `gableFeatures()`, **not**
`CompiledSilhouette`.)*

**The +3.2 m roofline is understood and deliberately not fixed.** `resolveLens`
(`scripts/facade-twin/panorama-render.ts:119`) sets `pose.z = lens.z − offsetM`; the ~−4.15 m
run-level correction from `solve-track-datum.ts` raises canal-belt rooflines by the same amount — the
A/B matches each wall's own `offsetM` to within 3 cm, an identity, and the corrected render draws
canal water at the claimed ground line. Gable *shape* is invariant (the offset is constant per run),
and shape is what the game needs. **Neither file exists on this branch** — branch from
`feat/roofline-strips` (`eaf084b`) if you act on it.

### Lane 5 — Irregular buildings (churches, museums, monuments)

**State — worst lane, cheapest win.** Oude Kerk renders as ≈53 flat-top boxes at 23 m in `#bd8161`;
Westerkerk has no spire; the Royal Palace's dome is a 30→45 m flat-top block. These win only because
someone hand-mapped OSM `building:part` geometry — **nothing in the pipeline knows a church from a
garage.**

`scripts/build-lod1-tiles.ts:66-89` whitelists exactly `id, tier, minHeight, height, colour,
roofColour, roofShape, roofHeight`. Verified across all 295 z14 tiles (342,993 features): no
`amenity`, `tourism`, `building`, `heritage` or `name` survives. `scripts/build-osm-buildings.ts:72`
*already keeps* `building: tags.building` in staging — the tiler throws it away.

**T2.6 — Stop discarding the tags.** Carry `building` / `amenity` / `tourism` / `heritage` through
`build-lod1-tiles.ts:66-89` to the tiles, then treat churches and museums distinctly in
`buildingStyle.ts:30` / `buildingTilesBrowser.ts:65`. Watch tile size: 295 tiles / 15.36 MB gzip
today.

**Registers already extracted and unused:** `public/data/extracts/amsterdam/landmarks.json` — **420
entries** (267 landmark, 56 museum, 40 library, 34 university, 21 cinema, 2 music venue), 350 with
wikidata. And **1,493 rijksmonument heritage records over 989 buildings**
(`facade/sources/netherlands.ts:190-256`, RCE WFS + SPARQL), whose text **names a specific gable type
for 70% of described monuments** — a measured, citable source for exactly the lane where photos and
parametric generation both fail.

**Why 3DBAG is worst here:** its reconstruction error is **0.11 m on flat roofs vs 0.60 m on
pitched**, flat across plot width and century — *"it measures roof complexity, not reconstruction
failure… A global gate would reject buildings for being interesting, which is exactly backwards for a
project about gables"* (`HISTORY.md:2159-2169`). The 679 withheld are precisely the towers and
spires. `b3_h_nok` is unusable (0 of 41 flat roofs at the Rijksmuseum tile have a ridge).

**Landmark GLBs stay off.** 13 models (9 City-of-Amsterdam survey + 4 community), placed by
`landmarks/signaturePlacement.ts` (482 lines, pure arithmetic, tested). Dead in game:
`vector-map.js:19` sets `_signatureLandmarks = null` and never assigns it; all three consumers are
null-guarded no-ops; loaded only by `signature-landmark-demo.html`. Disabled after a playtest —
thirteen meshopt GLBs on the shared MapLibre/Three canvas were too slow, and Centraal arrived with
its SketchUp ground plane attached. Licence (`signatureModels.ts:15-18`): *"used under the 3D
Warehouse General Model License, which covers a Combined Work but not redistributing an asset
library. That question is parked, not answered."* Also note `signature-landmarks.json` is stale (16
entries, 3 with no GLB) and the header comment says "nine / six" for a 13-model catalogue.

**The choice this lane eventually forces:** re-enable the GLBs (licence + per-model perf gate +
ground-plane cleanup) **or** build a procedural gable/spire/tower renderer driven by the tags the
tiler currently discards. T2.6 is a prerequisite either way, so it is safe to do first.

---

## 7. Phase 3 — The point cloud: do the two tiles justify asking for more?

**Answer: not yet — and not because the data looks bad, but because three cheap validations were
skipped.**

**What exists.** Exactly **two** 50 × 50 m municipal MLS (*puntenwolk*) tiles, both Oud-Zuid:
Museumkwartier (10,854,907 points) and Willemspark (7,165,726), total coverage **0.005 km²**, 114 MB
LAZ cached in `.cache/pointcloud/`. Pinned in `scripts/pointcloud/fetch-demo-tiles.ts:30-50` from raw
GitHub URLs *because the city-wide host is NXDOMAIN*. Licence is clear: open data, attribution.
**This is not AHN** — AHN reaches the project only through 3DBAG heights.

**The blocker is the host, not licence or compute.** `files.lidar.data.amsterdam.nl` is **NXDOMAIN**;
chased with `datateam.geo@amsterdam.nl`. Compute is trivial — tiles measure in seconds; the whole GPU
experiment cost **$0.041**.

**The case for, specific to one lane.** 3DBAG carries **0 gables on 895 canal-belt buildings**
(`wallTop == roofTop` everywhere) and the canal gable is the game's recognition signature. The MLS
measured **7 of 21** shaped rooflines on Museumkwartier and **5 of 39** on Willemspark — an
independent second tile — including a pinned bell/neck gable pair at **3.62 m** range on an
11.7 × 15.0 m facade. The honest claim was downgraded on its own evidence: only 1 of 32 rises above
3DBAG's whole-building maximum, so the claim is "shaped roofline", not "above the roof".

**Critical distinction.** *Learned* 3-D segmentation failed at **0% recall** — PTv1 predicted
`terrain` for ~100% of facade points, 0 of 60 gold walls got a usable prediction, and the checkpoint's
own `best_iou` is 0.1519 (a documented cross-domain collapse); DGCNN gave 0.0% recall (0/70), proven
not to be a harness bug by a control run. **The deterministic geometric classifier on the same data
works.** The failure was the model, not the cloud — do not let "point clouds failed" stand as a
summary.

**Why two tiles prove nothing yet:**
- **All 60 gold walls are still `spotCheck: "pending"`.** Nobody has looked at them.
- **No accuracy metric exists** — no silhouette IoU, no opening precision in metres, no hand-labelled
  wall. Parked pending human labelling, with the standing rule: *don't let a model label its own
  ground truth.*
- **Zero overlap with the photo pipeline.** None of the 15 point-cloud buildings has a photo crop, so
  cross-source validation is impossible on current data. Neither tile is in the active release.
- **The sample is thinner than it sounds:** 52 of 60 walls are under 3 m wide (thin 3DBAG slices, not
  frontages), 40 have no openings, only **5** are ≥ 4 m with a window-sized opening.
- **No church, museum or monument has been measured** — both tiles are ordinary apartment blocks, so
  Lane 5, where a cloud should help most, is completely untested.
- The one failure mode only city data can settle: **coplanar neighbouring *panden***. On the canal
  belt narrow row houses share a facade plane, and whether one 3DBAG `WallSurface` picks up a
  neighbour's returns **has not been tested** — both demo tiles have wide blocks.

**T3.1 — The decisive test (~1 day).** Render the measured gable silhouettes from the 21 + 39
well-scanned walls beside their photographs and have the owner judge recognisability. This is a
craft question answerable by looking, and it is the one thing no other source can provide.

**T3.2 — Spot-check the 60 gold walls** so the set stops being `pending`. Cheap, and it is the
reference every photo model has been scored against.

**T3.3 — Ask `datateam.geo@amsterdam.nl` whether the city-wide host is returning.** Nothing scales
until it does, and this is a message, not a project.

**If T3.1 reads as Amsterdam, the answer flips to yes** and this becomes the strongest lane in the
programme. If it does not, stay with photos plus 3DBAG and stop paying attention to the cloud.

**Per-lane relevance, from what was actually measured:**

| Lane | Point cloud helps? |
| --- | --- |
| Roofs/gables | **Yes, flagship** — the only source for the gable 3DBAG lacks entirely |
| Windows/doors | **Yes, as ground truth and a recall floor** — but a lower bound (13 measured vs ~20 visible) |
| Colour/texture | Unproven — 16-bit RGB exists (`colorDepth: 'auto'` is mandatory) and a median wall colour is computed, but it is not in the manifest, not an evidence source, and never validated |
| Signage | **No, and arguably negative** — scan and panorama epochs differ, so shopfronts may have changed |
| Irregular buildings | **Untested hypothesis** — plausible, since the method is per-wall and assumes no regularity, but nothing irregular has been scanned |

**Housekeeping:** `HISTORY.md` claims "86 measured walls / 2,051 faces"; on-disk `index.json` says 60
walls / 1,531 faces. Reconcile by re-running `npm run publish:point-cloud-facades` — do not hand-edit.

---

## 8. Verification

- `npm run lint`, then **`npm run check:canal`** as the pre-integration gate (typed checks, named
  driving/reachability regressions, production Storybook build).
- Per-module: `npx tsx src/canalRecall/facade/<module>.test.ts`, each printing an assertion count.
  After T0.3 these also run in CI.
- **Turn every reported geographic failure into a named regression location.** Pin the OSM
  junction/bridge/cul-de-sac in `scripts/check-canal-car.ts`, the reachability audit, or the driving
  harness before considering it fixed.
- **Storybook** for deterministic visual states: `npm run storybook`, `npm run build-storybook`. Add
  **desktop and mobile** states for every new HUD/card combination.
- Inspect both layouts. A screen that works only for the default guest route is not done — exercise
  signed-in, home-route, expanded advanced settings, long names, missing images, stacked notices.
- **Product invariants:** the street/canal under question must never be revealed by the HUD or map
  before the answer; keep the driving corridor visible; trivia and neighbourhood cards stay compact
  and near the bottom.

## 9. Traps and corrections

1. **A commit can pass `tsc` locally and break a clean checkout** if untracked files are on disk.
   Verify in a fresh worktree. This has already happened once.
2. **`TODO.md:143-144` is stale about `classifyGable`** — it has a non-test caller and no test.
3. **The +3.2 m roofline code is not on this branch**; only the HISTORY entry was merged (`e6cb69f`).
4. **A zero-byte opencode log means working, not hung.** Judge by CPU.
5. **`publish-area-geometry-demo.ts:81` vs `:107`** are different lanes: `:81` hard-codes
   `roofShape:'unknown'` on the *observation* record (598 of 598), while `:107` computes a real
   `roofShape` for the *render* (5,983 `source-slanted`, 508 flat, 904 null). `roofEavesHeightM` is
   `null` on all 7,395, so the eaves branch of `wallTopHeightExpression` never fires.
6. **Treat OSM topology and display geometry as imperfect.** At junctions, bridges, boundaries and
   split same-name ways use measured tolerances, hysteresis, deduplication and regression coverage
   rather than assumptions.
7. **Use English encyclopedia text in the English game**, and preserve original foreign text and
   provenance so translation passes stay resumable.
