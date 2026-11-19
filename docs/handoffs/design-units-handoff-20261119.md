# Design units programme: handoff to the Opus overseer (2026-11-19)

You are taking over a programme David approved today. The plan is `/Users/blackmad/.claude/plans/transient-tickling-mochi.md`. Read it first; this file is everything else you need that is not in it. The Fable session that wrote both (`building-identification-pipeline-review`) stays reachable for design questions.

## 1. Your job

Run the plan's phases in order, as overseer and integrator for this programme only:

- Phase 0 yourself (it is a data join, not lane work).
- Phase 1 onward with at most three lanes: units and ledger; renderer; evidence and scoring.
- Stop at each gate that is David's and ask him through a `needs-david` issue.

What David has decided, by approving the plan:

- The design unit (one building as designed, over one or many pands) replaces the pand as the unit of identity, drawing, review and coverage.
- "Beats today" in a blind A/B is no longer an acceptance bar. It stays as a no-regression check.
- "The ring" is the 198-buurt centre and inner ring (`RIDE_PRIORITY_GEBIEDEN` in `src/canalRecall/ridePriority.ts`). 100% means no front on per-pand dice.
- The staged belt, Centrum and De Pijp looks are held. Do not publish them, and do not run more rounds on them.
- No batch photo read runs before he has seen tokens per unit read (phase 2).

## 2. What was verified, and how to repeat it

**The ordekaart layers** (Gemeente Amsterdam, Monumenten en Archeologie; open geodata). GeoJSON in lon/lat:

`https://maps.amsterdam.nl/open_geodata/geojson_lnglat.php?KAARTLAAG=<LAYER>&THEMA=<THEMA>`

| LAYER | THEMA | Objects | Properties |
|---|---|---|---|
| `ORDE_CENTRUM_GEBOUWEN` | `ordekaart_centrum` | 7,539 | Objectnummer, Orde, Architectnr, Architect, Bouwjaar, Gebied |
| `ORDE_RING_GEBOUWEN` | `ordekaart_ring` | 5,454 | same, plus Stadsdeel |
| `ORDE_GORDEL_GEBOUWEN` | `ordekaart_gordel` | 3,012 | same, plus Stadsdeel |
| `ORDE_AUP_GEBOUWEN` | `ordekaart_aup` | 1,360 | OBJECTNUMMER, LOCATIE, ORDE, BOUWJAAR, ARCHITECT, FUNCTIE, GEBOUWTYPOLOGIE, BOUWLAGEN, WONINGAANTAL, BOUWSYSTEEM |

- Orde values: 1, 2, 3, Basis, 99. Ring has 1,238 Basis objects and Gordel 1,035. **Unchecked:** whether Basis polygons are single buildings or whole merged blocks. Look at footprint area by Orde before trusting them as units.
- The Ring layer is dated October 2015 on its catalogue page (`https://ckan.bertha.geodan.nl/dataset/amsterdam-open-geodata-400-ordekaart-ring-1900-gebouwen`). Record the licence text and fetch date with the archived copy.
- Nothing in the house pipeline reads these layers today.

**The test.** Pand centroid inside ordekaart polygon (centroid only; use area overlap in the real join). Pand geometry came from `https://api.data.amsterdam.nl/v1/bag/panden/?identificatie=<16-digit id>&_format=json` with header `Accept-Crs: EPSG:4326`. All pand ids below take the prefix `0363100012`.

| Row | Expected partition | Ordekaart object |
|---|---|---|
| Marnixplein | [168305, 168300, 174907] | Centrum 6588 (1891) |
| Goudsbloemstraat | [172514, 172469, 172468, 172467, 172466, 172470, 168668] | Centrum 22 |
| Rustenburgerstraat | [119632, 166734, 157322] · [159752, 236414] · [156003] | Ring 8276 (Stork) · 8275 (Oostveen) · 8274 (Vlaanderen), all 1896 |
| Van Ostadestraat | [160643, 159402] · [160667, 156658] · [153176, 158962] · [156774, 163030, 153534, 156780] | Ring 8815 · 8794 · 8792 · 8793 |

These four are the named regression locations for T1. That is the whole evidence so far: four rows.

The same BAG record carries `ligtInBouwblokId` and `aantalBouwlagen`. The storey count was null on most of the tested pands and 6–7 on a few, so do not rely on it.

**The sheets I judged from** (photo, today, staged look):

- `/Users/blackmad/Code/map-recall2-screenshots/ui/2026-11-16-review-392/` — Marnixplein and Goudsbloemstraat (split buildings); Herengracht 179345 (a "win" where both drawings are wrong).
- `/Users/blackmad/Code/map-recall2-screenshots/ui/2026-11-16-de-pijp/` — Rustenburgerstraat and Van Ostadestraat (several designs flattened into one type).
- David's words are on issues #389, #391, #392, #393. Every comment there is posted under one login; his are the short lowercase ones.

## 3. The pipeline as it stands (from a code read of main at cc7c2f97a)

**Model tiers, highest first** (`src/canalRecall/coverage/coverage.ts:26`): bespoke GLB, block-face chunk, large recipe, per-house recipe GLB, hand-built GLB, building-type instance, landmark kit, generic.

**Inside the generic tier** (`src/canalRecall/galleryPipeline.ts:47`): `exceptLandmarks` → `withRegisterFacts` → `withHouseSpec` → `decorateFacade` → `withMonumentGable` → `withHouseSpecCrown` → `withRowFront` (a pand with a record in `public/data/front-records/row-front.json` takes height, roof and dress from it) → `decorateRoof` (the hash planner, only when nothing planned a roof) → kit roof, front, shopfront.

**Per-pand seeds to re-key in T2.**

- `roofMesh.ts`: roof kind 211 and 223–228; gable shape 239/243; spout 245; dormers 249; material 250; tone 251; trim 255; shutters 256; crowns 263; turret 348; parapet 439–440; chimney 679–681.
- `genericFacades.ts:172–175` (style from the pand's BAG year, wall family by `stableIndex(id)`).
- `bayTextures.ts:75–80`; `bayLook.ts:197–201, 316, 360–362, 372–374, 381`.
- `buurtProfiles/profiles.ts:151–167`.
- `threeBuildingMesh.ts:776–781` (cell variant, bay, storey and ground scale, tone jitter; the comment says "No two neighbours share a rhythm") and 892/923.
- `facadeExtras.ts:420, 441`; `beltLook/donors.ts:248`; `largeBuildingTier.ts:99, 144`; `roofs/flatRoofTone.ts:66`.

**Where a row breaks today.**

- The generator starts a new series on a BAG year step over 1 (`buurtGenerator/rows.ts`, `SERIES_YEAR_STEP`).
- It drops series outside the library's years or storeys, and those pands fall back to the dice.
- Any pand with a HouseSpec, model or building type counts as described and splits the row (`scripts/buurt-generators/generate.ts:85`, `describedPands`).
- `house:rows` forms series by exact match on noisy reads (`houseSpec/row/solve.ts:392`).
- The register-gable gate is decided per pand from its own 3DBAG rise (`houseSpec/decorate.ts:380`).
- Face row coherence clamps heights only, and skips `design` and `sameAs` houses.

**Build on, do not replace.**

- `RowRecord` / `RowDesign` with sourced fields (`src/canalRecall/houseSpec/row/types.ts`).
- `withRowFront` and `RowSeriesDraw` (`src/canalRecall/houseLine/rowFront.ts`), and the buurt kit (`buurtGenerator/kit/frontKit.ts`, `roofKit.ts`).
- The party-wall row builder and `blockLines` (`buurtGenerator/rows.ts`, `generate.ts`).
- `blockFace/rowCoherence.ts`; `houseSpec/rowChecks.ts`.
- On lane branches only: `oneSeriesPerBuilding`, `sameBuildingTop`, `oneBasement` (`lane/centrum-looks-20261115` @ 73b8dd3cc, WIP) and the agreed-gable rule, features reader and plaster pass-through (`lane/buurt-pijp-20261116` @ 7b89b195a, WIP). Cherry-pick what you need; do not resume those lanes' rounds.

**Known holes.**

- `check:rows` reads untracked `artifacts/` and passes when it is empty.
- The plaster finish is read and stored but dropped before the wall cells (traced on the De Pijp branch at `threeBuildingFeatures.ts:214` and `rowFront.ts:398`).
- French balconies are read, stated and drawn nowhere.

**Tooling that exists.** `scripts/buurt-generators/sheet.ts` (photo, before, after), `house:row-sheet`, `house:preview`, `scripts/house-frames/node-frame.ts`, `house:frames`, `house:crops`, `house:critic`, `scripts/house-specs/rows/blind-review.md`, `block-face:intake`.

**Counts** (coverage-v1 of 11-10 plus current files): 198 ring buurten; 60,015 ring pands, 10,165 of them minor; by year: pre-1850 6,125, 1850–1919 22,949, 1920–39 21,886, 1940–89 4,317, 1990 on 3,477. 1,270 face directories, 310 with an intent (1,402 pands). The plan has the rest.

## 4. How to operate here

Read these memory notes before touching the repo. They are in `/Users/blackmad/.claude/projects/-Users-blackmad-Code-map-recall2/memory/`:

`git-wrapper-broken`, `integrate-in-own-worktree`, `pruned-worktree-cd-trap`, `lane-worktree-node-modules`, `shared-node-modules-npm-install`, `source-archive-per-lane`, `questions-as-issues`, `dev-log-issue`, `push-pings`, `push-only-after-gate`, `regen-before-gate`, `structure-gate-before-push`, `gate-gets-the-machine`, `serialise-browser-runs`, `stop-servers-by-pid`, `lane-model-choice`, `house-review-in-situ`, `before-after-must-differ`, `open-data-only`, `no-email-in-user-agent`, `worktree-disk-hygiene`, `stage-sheets-before-prune`.

The points that bite first:

- Call `/usr/bin/git`. The `git` wrapper is broken. Say so in every lane brief.
- `/Users/blackmad/Code/map-recall2` is a stale detached HEAD from October. Never work there and never `npm install` there.
- Make your own worktree from `origin/main`: `/usr/bin/git -C /Users/blackmad/Code/map-recall2 worktree add -b integrate/design-units-20261119 /Users/blackmad/Code/map-recall2-worktrees/integrator-design-units-20261119 origin/main`. Link `node_modules` and `.cache`, and pick a free port (4702 and 4703 are taken).
- **Another integrator is live on main today:** peer session `map-recall2-40`, worktree `map-recall2-worktrees/integrator-20261119`, branch `integrate/round-20261119`. It runs the resumed lanes (triage, chain logos, ground floors, Hoofddorpplein, Narva, retail pass). Leave its lanes and worktree alone. Message it before each push to main, and merge `origin/main` first.
- **The machine is busy.** At 16:11 the load average was 29 and the disk had 26 GB free (98% full). Check `uptime` and `df -h` before starting lanes, browser runs or world compiles. Phase 0 needs none of them.
- Lanes: opus by default, haiku for mechanical work; set the model on every spawn. If you cannot spawn lanes, do the phases yourself in order and say so in your report.
- The repo is public. No secrets or personal data in issues or commits.
- CLAUDE.md applies in full: typed modules in `src/`, staged generator output before a versioned extract, `TODO.md` and `HISTORY.md` in the same change, coherent commits, `npm run check:canal` before a push to main.

## 5. Phase 0, step by step

1. **Set up and commit the plan.** Copy the plan to `docs/handoffs/design-units-plan-20261119.md` and this file to `docs/handoffs/design-units-handoff-20261119.md`. Add a pointer at the top of `public/canal-drive/TODO.md`, next to the paused-lanes pointer, saying #392 and #393 are superseded by this plan.
2. **Archive the four layers** in the source-data archive worktree, with URL, fetch date and licence text. Use the repo URL as the contact in the User-Agent.
3. **T1 join**, as a typed module in `src/canalRecall/designUnits/` with a script in `scripts/design-units/`:
   - assign each ring pand to the ordekaart object holding most of its footprint (area overlap, with a threshold you measure and state);
   - list pands that straddle two objects and objects that hold only part of a pand;
   - order each unit's members along each street face, with from and to metres along the frontage;
   - where no object covers a pand, infer a unit deterministically and mark it inferred;
   - add the family key: architect number, year, module width;
   - a single-pand unit keeps its pand id as its seed, so only multi-pand buildings change in phase 1.
4. **Report** (this is the phase 0 gate):
   - share of non-minor ring pands inside an ordekaart unit, per layer and per gebied;
   - pands per unit, as a distribution; units by Orde; what Basis polygons turn out to be;
   - agreement with groupings we already trust: the published Rivierenbuurt and Apollo/Stadion series (David liked those, so they are the positive control), the 310 face intents (`identical`, `sameAs`, `corniceGroups`), and the Centrum lane's 51 photo-confirmed same-building runs;
   - the four regression rows passing as unit tests.
5. **T7 answer key.** About 40 units, ten per era, the Nassaukade 506 block included. Label each from several captures with zoom crops, by two independent passes, and look again where they disagree. Then put eight of them on one page for David to confirm.
6. **Stage** the index under a staging path. Publish to `public/data/extracts/amsterdam/design-units-v1/` only after you have read the report yourself.
7. Post the report on dev log #68 and open the lane issues for phase 1.

## 6. Phase 1 in brief

- Flag `?designUnits=1`, default off, byte-identical when off.
- Every seed in section 3 keyed by unit. One eaves line per unit (median of the members' measured front tops). One roof per unit, ridge along the street. One route per unit: a member that already has a higher-tier model keeps it; the rest of the unit draws whole.
- The elevation is laid out once in metres along the unit's frontage; each pand draws its slice.
- The conformance test: for each spec field, a fixture where setting it changes the rendered strip.
- Published rows (Rivierenbuurt, Apollo/Stadion, Kinkerstraat) stay as they are.
- **Gate (David's):** about 30 blocks in the game at pinned poses, desktop and phone, today beside the flag. Include the four regression rows and a spread of eras and gebieden chosen by ride share. One page, one `needs-david` issue. Diff each pair first; a pair that does not differ is not shown as a fix.

## 7. Do not

- Publish or iterate the staged belt, Centrum or De Pijp looks.
- Accept anything on a blind A/B against today.
- Start photo-read batches before the phase 2 cost report.
- Propose photo-skinned fronts, generative tree removal, or imagery from Google or Apple. All three are already ruled out.
- Add a per-district code fork. Districts are data.

## 8. Reporting back

After each phase: the gate numbers, what is on main and behind which flag, what is staged, what failed, tokens spent per lane, and what is waiting on David with its issue number. Say plainly where a result is thin. Write a dev log comment on #68 each round.

## 9. Risks I can see

- The layers may cover less of the ring than footprint totals suggest, or Basis polygons may be whole blocks. Then the inferred splitter carries more of the load, and it is the thing that failed this week. Measure before building on it.
- Ordekaart objects are judged by heritage value, not by facade. One object could hold two visibly different fronts. The phase 1 page is where that shows.
- Tier C detail is still a prior chosen once per unit. It fixes "three houses where there is one", not "they lose so much". Do not present it to David as more than that.
- The 2015 layer predates recent demolition and infill. BAG status and year win where they disagree.
