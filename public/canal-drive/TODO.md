# Canal Recall — what is left

The work board. Everything finished lives in `HISTORY.md`; this file is only
things that are not done. Keep it current in the same change that moves an
item, not afterwards.

Ordered by one rule: **a learning game that teaches the wrong thing is broken
in a way that a plain-looking one is not.** So correctness of what the game
teaches outranks the depth of what it teaches, which outranks how it looks.
Within a tier, cheap-and-blocking comes before expensive-and-isolated.

Building / façade / 3D mesh work is owned by other agents — do not queue it
here. Their design notes stay in `BUILDING_*.md`, `FACADE_*.md`, `LOD.md`, and
`HISTORY.md`.

---

## Own-look buurten in the canal belt (P0, user 2026-11-10)

The user: "we need to focus on buurts in the canal belt and just outside". Belt and inner-ring lanes run in parallel, and Opus reviews every sheet before merge.

- **Measured yield.** Belt lanes gave 2–23 pands each, about 150 opus turns per lane. Row auto-place fits rows, not belt one-offs. Hand placement (`scripts/block-face/hand-place.ts`, from the Jordaan lane) does better, but Opus still sent about half the hand-placed pands back.
- **Per-pand batch fit: closed.** It drafted 54 Rapenburg/Foelie pands; 1–2 % passed the gates and 0 looked right after two reader rounds. Kept as opt-in tooling (`pandFit.ts`).
- **The kit decides belt likeness.** Shared parts, each owned by one lane; the others cherry-pick:
  - flat roof behind a frieze cornice, white eared frames, street-level entrance under a bel-etage, pilastered doors (GG-Zuid);
  - souterrain/bel-etage storey grid per pand (GG-Zuid storeyHeights + Jordaan grid pin);
  - banded fronts, crest attic, neck-gable sides, balconettes (GG-West).
- **Strip white balance before the likeness/foliage mask (Haarlemmer lane).** Cast strips read brick as foliage. This held Jordaan (Dec 2024/Jan 2025 green), Haarlemmerstraat and Vogelbuurt.
- **Intake off live Overpass (GG-West lane).** 3–5 min per face is the belt's slowest step.
- **Door sides.** Automatic door-side detection was wrong in four lanes. Pin door sides from the photo, and alternate mirrored pairs.
- **Colour pins render about 1.14× lighter.** cityWallTint lifts brick, so land wall colours with `fitWallBrick` (`scripts/block-face/fit-wall-palette.ts`), not literal pins.
- **Pending merges after their verdict fixes:**
  - Burgwallen (23 pands, 19 install-with-fix);
  - Jordaan (12 fix, 11 hold);
  - Keizersgracht 608–616A;
  - Herengracht 92–96 and Keizersgracht 254–258A;
  - Haarlemmerdijk (4 fix, 1 hold);
  - Sarphatistraat 167–207.

## Feedback 2026-11-09 follow-ups (session a1)

- **World compile owed (a1):** elevation-v1 cells changed by feedback B (12 cells) are published but `world:compile` (cells + shells), covers and the ground-height tiles for -2_2, 7_-2, 1_0, -10_5 are not rerun yet; batch with the post-2020 pands (published into building-tiles/bag-tiles 2026-11-10 via `publish-bag-gaps.ts --supplement=scripts/data/bag-gaps/new-pands-supplement.geojson`, 130 tiles, 1,110 added; replace fallback heights when a newer 3DBAG/AHN6 lands) and buurt profiles (published 2026-11-10 in src/canalRecall/buurtProfiles/, three-buildings bundles rebuilt); then ride frames of the 18 profile spots and a What's New note.
- **Buurt profile follow-ups.** storeyHeightM: re-measure per era with the ground floor counted, n ≥ 20; TG01–03 need fronts; shopfrontShare per run or cell instead of per buurt; pale buff brick has no pool.
- **Land mask leftovers (feedback B).** The elevation regen must pass `--keep-water-under public/data/extracts/amsterdam/houseboats.json --berth-m 4`. 26 unconfirmed AHN filled-water candidates (5.6 ha, largest IJburg 5.018,52.350) in `docs/reports/land-mask-gaps-20261109/filled-water-unconfirmed.geojson`; 8 bridges with decks ≥ 15 m shorter than their crossing (`deck-extensions.json` flaggedUnreviewed); Sloterdijk/Westpoort pier pands over water (31,728 m²).
- **#178 dry way decks default (needs the user's look).** With `?dryWayDecks=1` the bridge gap falls 43 % (HISTORY 2026-11-10); judge Vertrekpassage, Westrandweg, Ringweg-Zuid and Centraal/IJtunnel in a ride frame beside the orthophoto, then flip and recompile cells. Open: lane markings on dry decks; Westrandweg curved viaduct chains need AHN DSM deck heights; small regressions Bijlmerdreef 7051250 +49 m², Diemerbospad +30, Geerdinkhofpad +30.
- **Yard fills (`?yardFill=1`, kept off after review 2026-11-10).** Shots (screenshots repo `buildings/2026-11-10-yard-fill/`): Hornweg stacks read as scattered random boxes, not aisle-aligned rows, and some stood on the road beside the cycle path (11dbbde5f excludes roads/rail; re-shoot); Zaanstraat ballast appears to cover the park and trees north of the tracks — clip sidings to landuse=railway minus parks/green. Publish `scripts/data/yard-fill/*.json` to the extract only after a clean re-shoot beside the orthophoto. Moermanskkade lot: check the panorama.

- **Rails class b/c/d (feedback G follow-up, report `docs/reports/rails-class-20261110.md`).** P1 class b: a non-bridge tram/rail bed that rides over a road at least 1 m lower is an untagged viaduct approach. Promote it to a bridge (railProfile approaches, railBridge piers); there are 99 runs city-wide, among them the Sloterdijkerweg viaduct and Kimpoweg pins in `check-rail-street.ts` (lower their ratchets when fixed). P2 class c: the beige ramps are steep `land` sheets beside raised beds (5 m land grid against 6 m bed pieces). P2 class d: the Radarweg lines are not coplanar layers; take a top-down `render-topdown.ts` raster of paint against asphalt at 4.8366,52.3908. Take browser ride frames (the lane only had CPU renders).
- **Recipe roof partition vs BAG micro-jogs (Indische buurt lane, 2026-11-10).** A 4–5 cm jog in a BAG front (pand 0363100012089626, Djambistraat 31) makes overlapping 0.0005–0.0012 m² roof slivers in the `survey-recipe.ts` partition, so `recipeRoof.test.ts` fails at 1.5e-5 against 1e-6 at 70°. The lane split the face round it. Fix the partition (snap or simplify jogs under ~5 cm before partitioning), then re-intake `djambi-1-35` whole.
- **#171 FPS ground LOD (decision open).** FPS draws +0.4–0.6 M own-ground triangles (787 k / 712 k / 916 k against the chase view's 295–394 k) because the level 72° cone sees the whole LOD 0 ring; the ring radius is not the cause (round 2 measured identical counts). Candidate: a distance-faded ~40 m LOD 0 ring for FPS only. Opt-in mode, so this is not blocking. Also open: car-eye variant and a handlebar hint (report `docs/reports/fps-camera-20261109.md` §5–6).
- **Kit: brick bands (speklagen) as texture, not geometry (Indische buurt round 3).** `brickStripes` at the measured 0.46 m pitch adds ~800 triangles per house (Javastraat 95-121: 2,670 → 3,470 against the 3,000 budget), so the Java type ships without its cream bands. Next: a texture/normal-map stripe in the facade shader. Also open from that lane: Djambistraat 23 half-width door reveal fails `opening-outside` while the same reveal passes on 9-21 (cause unknown); a 1914 three-light 'trio' type for Djambistraat 40; a single shared portiek leaf (drawn as two half reveals now).
- **Recipe tiles: what the near tier needs before any flip (report in HISTORY 2026-11-10).**
  - per-pand relief lift (`ownGround/chunkBases.ts` separatePands);
  - lod2 for chunks and ordinary buildings (the R4-C records);
  - wallExposure parity;
  - a size answer for the 44 MB mesh tiles.

  Then re-run the pose A/B and convert the 143 chunks to `kind: glb`. The pilot data is stale: all 14 Bilderdijkstraat chunks differ from installed, and bilder-079721-x2 is null. The `tile-buildings.bundle.js` is stale against source by 44 lines. `?recipeTiles=1` has never been exercised on ENGINE=own.
- **#161 calm levers left after labelCalm.** `roofFamily` measured 0.00 change: log `snapRoofFamily` hits before touching it. `corridorFocus`, `lightHier` and `treeCalm` stay off (report `docs/reports/calm-look-20261109.md`).
- **Register facts: forced extras and dakkapel held.** `registerForce` draws nothing in the live tier; the cause is unknown. Trace the decorator order (registered → facade → gable → roof) in `ownWorldView.decorateCity` before shipping extras (report in the register-recipes lane).
- **Vogelbuurt-Noord leftovers.** 4 lone survivors need a neighbour; Pelikaanstraat 3-9 untouched. Kalkoenstraat 30 reads +0.12 too saturated in the lit render of its #6e625e pin; darken only if the ride shows it.
- **Ribbon kit follow-ups.** pand-070306, 126563 and 103794 fitted but not installed: the likeness judge reads sign bands and sunlit coloured panels as glass. Next: a panel-colour likeness class, per-storey pitch, partial-width storeys, the 103794 triangle cut.
- **Chunk lod2 residency before coverage scales (P2).** The chunk lod2 cap is now 40 KB per stand-in on average, not a 6 MB total (176 chunks, 6.51 MB on 2026-11-10). The aerial view still loads every stand-in: at the week-4 targets (+1,500–2,500 chunk pands, roughly 600 chunks) that is about 22 MB. It needs cell residency or folding into the baked coarse shells before then (owners: SHEL step 3, #251 GPU memory).
- **Landlust follow-ups.** The four-storey slot type has flush doors; a cheaper deep reveal (under 3,000 triangles with four doors and two dormers) would let it recess them. Treslong's upper-floor erkers (bay windows) draw flat; the kit has no projecting bay on this type. The sheet's "ground bays" counter miscounts door rows.
- **Feedback E follow-ups (newbuild-kit report `docs/reports/newbuild-kit-20261110.md`).**
  - Danzigerkade (feedback 2c486751 spot) draws dark brown against white offices, and Sluisbuurt 2025 draws brown brick against grey concrete; both need an office/concrete wall family or per-pand pins.
  - Large-recipe `otherWalls: "blank"` on 142 of 163 recipes (1.50 M of 1.98 M m²): a texture-only window grid inside the triangle gate.
  - An office family for Westpoort (698 of 879 pale).
  - Plumb OSM gap-fill `start_date` into building facts (undated fills draw as 1860–1914 houses: Westpoort 32, IJburg 40, Overhoeks 18).
  - The world shells still carry the old 8–9 m canopy slabs until the next world:compile.
- **Indische buurt holds and kit gaps (lane buurt-indische-20261110).**
  - Held: Javastraat 95, 119 (dark brick hooded dormer), 121 (tall stepped dormer-gable); Djambistraat 23 (half-width door reveal fails `opening-outside`, cause unknown), Djambistraat 5/7/25/27, Djambistraat 40 (needs a 1914 three-light 'trio' type); Borneostraat 7-27 (gables on the 13|15 and 17|19 party walls, 21-25 a different design).
  - Unauthored designs: Padang/Lombok/Djambi 2-36 three-storey gable rows (need `modules` with per-module crowns), Borneostraat 80-102, the 1902-05 ornamented rows (Java 1-91, Banka, Deli, Madura; 6+ designs a face), the Makassar 1933-37 blocks.
  - Kit gaps: a pier-free shared portiek on a party wall; cream arch accents over a brick ring; iron sill rails/juliet balconies and gutter brackets; half-gable pair crowns beside held neighbours.
- **Industrial kit follow-ups (feedback D).**
  - Works office fronts: the 1972 Westpoort works reads weaker than before; give `works` a measured glazed office band.
  - Per-pand measured cladding colour (the 1967 warehouse is blue sheet, drawn pale).
  - Doors on yard-facing faces.
  - Tank ring seams, floating-roof rims, domed roofs; pipe racks and bund walls; sawtooth/curved shed roofs; company colour bands.
  - `threeBuildingsBrowser.ts` builds WORKER_URL without `withWorkerFlags`, so page flags never reach that pool.
  - The MapLibre path (vector-map.js) composes neither rail-infra nor the industrial enricher.
- **Meshopt follow-ups.** `install-large.ts` still writes recipe-large GLBs uncompressed (call compressGlb + re-describe); `scripts/building-tiles/compile-recipes.ts` installedMatch compares staged vs installed bytes and now reports false for compressed installs (compare decoded geometry).

## City coverage programme (2026-11-07) — T0 whole city, T1 ride ring, T2 landmarks

Plan `docs/plans/city-coverage-20261107.md` (Fable, user-approved 2026-11-07; explainer
artifact linked there). "Nearly 100 %" is defined in tiers: **T0** every generic pand
carries a measured buurt/era look (profiles for 518/518 buurten + per-pand measured
colour, scripts only); **T1** the ride ring's repeated rows drawn from measured types,
placed by script; **T2** the census (≈600 → ~700). Model routing moved: `LANE-RULES.md`
§Models now allows sonnet for bounded authoring from existing numbers; lanes ≤ 60 turns;
content lanes stop at 75 % of the weekly cap, the rest is the fix reserve.
Week 1 (spawned 2026-11-09 by session map-recall2-a1, worktree `integrator-a1`): census-refresh **done** (HISTORY); chunks-meshopt (haiku, port 4747), profiles-citywide and palette-level (haiku + one opus verdict turn) running. Ride-ring ranking `docs/reports/ride-ring-buurten-20261107.md`: top 40 buurten are 97 % generic and only 3 have a block-face library; route metres favour low-density polder buurten (Schellingwoude-Oost #1), so week 2 orders by route metres per pand as well. Open data questions: the 1,829-pand gap between build:coverage's 336,444 base pands and the tier sum 338,273; `build:coverage -- --publish` deletes the tracked `coverage-v1/look/*.jpg` thumbnails (restore, or run `scripts/coverage/build-look-thumbs.ts`). Decisions still open: #125 (tower triangle budget), #112 (inferred
installs). Weeks 2–4 (vision-measure spike, auto-drafted types, buurt lanes, recipe
tiles on, kit gaps, bespoke round 6, SHEL step 3, slot layers, windowSdf flip) are in
the plan §C2–C4 and get briefs when week 1 hands back.

## Programme (2026-10-23) — 1000 reviewed buildings, per-buurt looks, switches, roads

**If the integrating session dies, resume like this.** The programme runs
from the worktree `map-recall2-worktrees/integrator-plan` (branch
`plan/thousand-buildings-20261023`, port 4471); main is pushed from there
as a fast-forward after every integration, so `origin/main` is never behind
by more than one unpushed step. Leaf lanes live on `lane/*-2026MMDD` and
`perf/*` branches in their own worktrees under `map-recall2-worktrees/`;
`/usr/bin/git branch -r | grep -E 'lane/|perf/'` lists them, each lane's
brief is `docs/handoffs/lane-<name>-<date>.md`, and a branch not yet in
main is a hand-back to inspect (`git log main..<branch>`), not work to
redo. Subagents do not survive a session: re-spawn a lane from its brief
with "continue from the branch", model per `LANE-RULES.md`. The plan is
`docs/plans/thousand-buildings-20261023.md`; the state of each lane is the
bullet list below; the per-building state is
`public/canal-drive/landmark-factory-queue.json` and the census. Visible
changes go to `public/canal-drive/whats-new-notes.json` in the same commit
that ships them (the What's New page renders it), with a screenshot when the
change can be seen (user, 2026-10-30): push the picture to
`github.com/blackmad/map-recall2-screenshots` (`whats-new/<date>-<slug>.jpg`,
before/after pairs welcome) and list it under the note's `images`; the game
repository holds no new screenshots. Tracking (user, 2026-10-24):
every question or action for the user is a GitHub issue labelled
`needs-david` and assigned to blackmad, never only a chat line; each lane is
an issue labelled `lane` (+ `programme`), commented with its hand-back and
closed when merged. Inbox:
https://github.com/blackmad/map-recall2/issues?q=is%3Aopen+label%3Aneeds-david

**Landmark lane as a skill (2026-10-29, after #105 installed 0 of 17 at 130 turns):**
`.agents/skills/landmark-lane/SKILL.md` is the standing recipe for "I have
budget, run down the landmark lane": scripted triage, unattended factory,
one Opus review turn per strip of 20, verdict table, kill rules, cost in
the queue. Its numbers live in `references/large-tier-sheet.md` (116
installed large recipes: 7 likeness-pass, 95 inferred, 14 gates-only).
#110, #111 and #114 landed 2026-10-29 (HISTORY "Landmark lane, first run").
First run: 10 buildable pands, 1 installed (Molenwerf 1), 7 held, 1
no-evidence; round 2: 20 pands, 1 installed (094874), 18 held, 1
no-evidence; round 3 (towers at 70 m crops): 11 pands, 1 installed (137174),
10 held, 4 of them on the 12k triangle budget alone (#125 needs-david);
1.8 turns per reviewed building. Triage follow-up (HISTORY
"round 2"): an unresolved wall family on a wide street wall is a kit-gap,
not buildable; read balcony/ribbon bands; nine of twenty r2 holds were
sheds and retail fronts triage should have filtered. Open: #112 (needs-david:
inferred-install policy; running under policy A meanwhile). Spent since, per
the kill rule: floor bands on curtain walls (#116), the 70 m crop cap for
towers (round 3), band fronts (#126, #127: `balconyBands.spans`, ribbon and
glazed-storey proposals) and the band measurement blockers (#134, HISTORY
"Band fronts measured"): painted floor bands no longer count as washed-out
glass, parapet glass reads as trim on balcony-band groups, and budget-blanked
groups are probed again when a crop pairs them. Measured result: 0 of 253
inferred groups moved and none of the 17 ride-landmark drafts passes yet;
what still blocks them is in the tier sheet (item 8). The `painted-or-clad`
gap got its kit (#146, HISTORY "Painted and clad fronts in the large
tier"): `walls[].wallFamily` paint/metal, but only 3 of 82 moved and 0
passed; 78 of 116 unresolved crops are dark textured walls that cell
statistics cannot split from dark brick in shade. Next spend: propose
`paint` for a pale resolved family (241496 w0), make the factory mosaic and
the triage crop measure the wall family the same way, a closer-crop or
second-capture signal for dark and pale fronts (240435, the 78 above), and
the `band` gap's draft geometry (ribbon windows on slab fronts). Self-test drafts sit in
the skill worktree's `staging/landmark-lane-selftest/`, uncommitted (they
would move fit-golden).

**Bespoke landmarks (2026-10-30):** De Roos (#133) landed (HISTORY "De
Roos, P.C. Hooftstraat 183"); Hirschgebouw (#132) and the Kalvertoren (#148, HISTORY "Kalvertoren /
Kalverpassage, Singel") landed. Kalvertoren follow-ups: review the Rasphuispoort
`hostWallOpenings` at the Heiligeweg mouth (edge 18-19, open below 6.4 m) now
that pand 165086 is suppressed; one street-level look at the Kalverstraat side
(bare 3DBAG roof planes from above); the queue row for 165086 reads `error` /
kit-gap until the next triage `--write` marks it covered; the large-tier draft
singel-457-165086 stays uninstalled. Hirschgebouw: still to do there, a grouped-lights mode in
the window-rhythm audit so `hirschgebouw-elevations-pending.json` can go
live, a POI or destination card, a re-measured copper tint, and the bounded
Beeldbank search. The review
sheet's IN GAME column and the gallery card work again in lane worktrees
(#139, HISTORY "Review sheet sees the lane's own landmark"); the guard spec
`tests/e2e/review-sheet-ingame.spec.ts` runs standalone, not in
`check:canal`, because it needs a browser and the shared lock. Follow-ups:
a POI or destination for De Roos, a blind counter on
`de-roos-elevations.json`, a "free-standing glazing" class in audit:glb so
serres and timber screens are not fitted to the ochre and green slots to
dodge the opening count, and a FIFO queue for `/tmp/canal-pw.sh` (two shared slots since 2026-11-01, exclusive mode for timings; one job
waited 3 h behind 25 others today; the lock is not fair).

**City look, after the flip (2026-10-30, #137 = A, HISTORY "City look on by
default"):** measure iPhone perf with the slot array at 128² (desktop was
16.7 ms either way); a `timber` and a `metalRoof` slot (houseboat museum,
Hannekes Boom, Vondeltuin, Hotel Jakarta, Odessa; Ronde Lutherse dome,
American Hotel copper); a warm-grey roofTile keeping its tone instead of the
black-tile slate tone (Uilenburger); evidence for Podium Mozaïek / He Hua /
Centrale Markthal / Symphony / Haparandaweg cladding; drop the
`materialSlotSource: 'inferred'` marker on tagged materials now that the
default is the city look (check `_dress` first); a base-vs-base
look-consistency control run when the browser lock is quiet; the missing
bagYears (values in the #138 hand-back: olvg-west 1966, olvg-oost 1900,
max-euwe-centrum 1905, academie-theater-dans 1996, jodenbreestraat-11 1996,
begijnhof 1697, europarking-marnixstraat 1972; `landmark-bag-years.ts`
writes to staging only, and olvg-west/oost have no manualCatalogue entry).
Note: `build-manual-landmarks.ts` changed in #138, so its toolchain hash
moved and the next full builder run re-exports every model.

**Slop New York round (2026-10-29, user asked for an opus plan):** six
lane briefs from reading mrdoob's slop-newyork, plan
`docs/handoffs/slop-newyork-plan-20261029.md`, evidence
`docs/research/slop-newyork-20261029.md`. Order: A three owns the frame
(revive drop-MapLibre in flag-gated steps; the 2026-10-10 branch is 2,036
commits behind) and E driving feel first; C binary extracts and D shadow
stand-ins / culling / loading in parallel; B shader facades for the
ordinary ring after C; F ground raster as a spike only; G an opt-in dusk
ride after B (user 2026-10-29: "a cute thing"). User decided 2026-10-29:
no NPC traffic or pedestrians, no audio or music. Drop-MapLibre pace still
open on #107. None started.

**Engine programme (2026-10-30, user approved the plan):** one frame, one
world model. `docs/handoffs/engine-programme-20261030.md` is the programme;
branch `integrate/engine-programme-20261030` (worktree `integrator-engine`,
port 4519) integrates it. Decisions: a second `VectorMap` implementation
behind `?engine=own` (not edits to `vector-map.js`, which is frozen to fixes
and deleted at the flip); all of MapLibre goes (ride, overview, picker);
gates on the emulator and SwiftShader proxy, no real-device rides for now;
Google tiles deleted; content lanes keep merging with a `world:compile` step.
Lanes (spawned 2026-10-30, worktrees `<name>-20261030`): #128 L2 oracle
migration + P0 deletions (`lane-oracle-migration-20261030.md`, haiku, port
4521) → #129 L1 engine host (`lane-engine-host-20261030.md`, 4523) ∥ #130 L3
world compiler (`lane-world-compiler-20261030.md`, absorbs lane C, 4525) ∥
#131 L8 driving feel (lane E, 4527; **merged 2026-10-30**, user on #140: keep
the toy bike speed, keep the 10 % pull-back; `BIKE_TRUE_SCALE` stays unwired;
the `frameHost.tick(dtFixed)` hook for `CanalRecallUi.stepSteer` is L1's when
the engine owns the loop) → L4 streamer / L5 overlays → L6 facade
shader (B) / L7 shadows (D). Spawned 2026-10-30 evening: #143 P0 deletions
(`lane-p0-deletions-20261030.md`, 4533: study layers, Google tiles,
`SHARED_FRAME_DEFAULT`; **merged 2026-10-31**, HISTORY "P0 deletions"; the
legacy `_makeLayer` branches table in that entry is L1 step 6's list), #144 reds triage (`lane-reds-triage-20261030.md`,
4535: bike-xray, complete-city, check-building-look-transition; **merged
2026-10-31**), #145 rail
look (`lane-rail-look-20261030.md`, 4537; **merged 2026-10-31**, HISTORY "Railway
tracks read as rails") from the user's three in-game
reports of 2026-10-30 20:26–20:33 ("train tracks buried by surface", "more
bad train tracks", "ooof, these rails look really bad": feedback ids
5d3fb497, d49a15b0, 5d5b56c4, resolve them when #145 merges). Gates per
phase are in the programme doc; the P0 baselines go to `tests/perf/budgets.json`.
This supersedes the lane-A delivery shape below and closes #107 question 1.
State: **L2 oracle migration merged 2026-10-30** (#128, `dba569e22` + integrator
fixes): `vectorMap.camera` (project, unproject, center, zoom, bounds, pitch,
bearing, onFrame, whenIdle) over MapLibre in `vector-map.js`; 41 spec/script
files read it instead of `vectorMap.map` for those members (inventory
`docs/handoffs/oracle-inventory-20261030.md`). Still on `.map`: `jumpTo` 69,
`getCanvas` 29, `setMaxPitch` 27, `calculateCameraOptionsFromTo` 22,
`triggerRepaint` 29, `getStyle` 23, `stop` 19, `getLayoutProperty` 24,
`once('render')` ×4 (L1 decides which become `WorldView` methods). Integrator
reverted the lane's change of `mapRender` in `ride-perf` / `landmark-lod-perf`
to the render-to-render interval: `DESKTOP_BUDGET` is main-thread ms, so the
MapLibre `_render` wrap stays (guarded on `vm.map`) until the frame host has
its own render owner. `tests/perf/budgets.json` + `scripts/perf-gate.mjs`
landed with dated P0 baselines; `perf-gate.mjs ""` not yet run. **Browser verification done (2026-10-30):** `ride-perf` default
variants pass with the restored `_render` owner; `bike-xray` ("bike draws
after every building layer") and `complete-city` (contextualFeatures 0 of
> 12,578) fail identically with their pre-migration spec files on the same
tree, so they are reds on main, not from the migration (listed under "Reds
on main" below); the `ride-perf` motion variant read 8 frames > 50 ms against
a budget of 4 (p95 16.8, 0 > 100 ms, longest 100 ms) on a machine running
three other browser lanes: load-induced by the 2026-10-16 doc's own spread,
re-measure on a quiet machine before calling it a regression. P0 deletions done 2026-10-31 (#143; was: study layers and Google
tiles have consumers (`scripts/review/study-observed-sign-aspect.test.ts`,
`scripts/city-appearance/publish-area-geometry-demo.ts`,
`scripts/build-3d-bundles.mjs:75`, `game-route.js:198 setGoogleTilesEnabled`,
`wallMaterialDemo.ts:84`, `preferences.ts googleTiles`,
`tests/e2e/google-tiles-option.spec.ts`), then `package.json` lines
(`build:canal-study-*`, `canal:google-tiles-config`, `build:google-tiles-spike`
and the build chain), `index.html` script tags, the bundles). Lesson for
`LANE-RULES.md`: one browser run ≤ ~20 min; a migration lane re-runs a
representative subset, not every touched spec.
State: **L1 engine host step 3 merged 2026-10-30** (#129, `bc3f9e664`):
`?engine=own` rides with three.js owning the frame and no `maplibregl.Map`
constructed. `src/canalRecall/engine/`: `worldViewApi.ts` (the `WorldView`
interface, `vector-map.js` `@implements` it), `frameHost.ts` (one canvas, one
renderer, one rAF with `tick(dtFixed)` for L8, context loss/restore, mapGuard
and the governor attached; `SharedFrame.drive`), `cameraMap.ts` (MapLibre-exact
camera in metres about the view centre: parity 0.00 px over 22 samples,
desktop and iPhone), `ownWorldView.ts` (facades, own ground, vehicles,
own-map overview as far field, `isWater`, clearance, rider cover, facade
picking), typed `riderCover.ts` / `cameraClearance.ts` / `gameCamera.ts`
(`vector-map.js` still runs its own copies: swap-in is a fix-level edit).
Bundle `engine.bundle.js` (`build:canal-engine`, 89 KB), wired in `game.js`
and `index.html`. Measured under the flag: desktop 140–146 draws, 29–30
programs; iPhone 167 draws, 29 programs; `engine-own.spec.ts` green on both.
Lane hand-back (1) merged 2026-10-31 (`693d767cf`, HISTORY "`?engine=own`
draws the whole ride"): landmarks, trees, detailed buildings, roofs, ARTIS and
themes under the flag; fair A/B saves only 0.24 ms CPU with p99 worse from
doubled shader compiles; `engine-own.spec.ts` is **red under the flag on
programs (37–39 > 32)** by decision until the landmark materials are merged.
Hand-back (2) merged 2026-10-31 (`5bc4bc0dc`, HISTORY "`?engine=own` now beats
MapLibre on frame CPU"): own 4.1–5.1 vs MapLibre 7.6–8.3 ms owned frame CPU,
step 6 legacy layers gone, `setLoop` hook (wired in `game.js` under the flag,
`972302ce4`), Leaflet picker deleted. Hand-back (3) merged 2026-10-31
(HISTORY "The own-map overview carries rail, footways, landuse and piers"):
v2 overview extract published (2.13 MB gz), footprint worker for the lab page,
fair A/B 5 MapLibre 8.56 vs own v1 4.69 vs own v2 3.14 ms owned frame CPU;
the materials lane steps 1–3 merged 2026-10-31 (HISTORY "Own-ground materials
share programs through uniforms"): programs 36 → 20 desktop / 21–23 iPhone,
`engine-own` green on both at budget 32. Materials lane next: the material
registry follow-up (cityLook, litFacade, highlight, building-types on the
`groundMaterial.test.ts` pattern), the ~48 short-lived program keys compiled
when zooming out to 15.5; step 4 (1×1 white map) held for a real-phone
measurement. Materials round 2 merged 2026-10-31 (HISTORY "The landmark highlight no
longer rebuilds its shaders every frame"). L1 hand-back (4) merged 2026-10-31
(HISTORY "`?engine=own` matches MapLibre's drawn camera to 2e-8 px"): camera
parity gate (`engine-parity.spec.ts`, budget `cameraParityPx` 3.2), settle
through the WorldView API with the `game-route.js` patch applied, bounds shim,
Utrecht / Rotterdam / Den Haag own-map extracts published. Hand-back (5) merged 2026-10-31 (HISTORY "Pins and picks follow the drawn
camera when the deck is lifted"): deck-lift projection fix in `vector-map.js`
(What's New "Pins sit on the bridge deck you see"), highlight dedupe, the
iPhone spec rides, `docs/handoffs/flip-inventory-20261031.md` (B1–B14, 7-step
P5 order; corrections: `mapGuard.ts` stays in part, maplibre-gl/leaflet stay
in package.json for 8 lab pages, `liveTiles.ts`, `MapComponent.tsx`).
Hand-back (7) merged 2026-11-01 (HISTORY "Seeded-route stutter owners
fixed"): four exact own-ground fixes (What's New "Long routes no longer freeze
as canals and bridges load"), render-on-change green (`render-on-change.spec`),
`CameraMap.jumpTo` sub-mm tolerance, vehicle pose snapshots. Hand-back (6)
merged 2026-11-01 (HISTORY "Stutter owners under `?engine=own`
named"): stutter owner table + three fixes (What's New "Fewer hitches when
new ground streams in"), `clearanceResidents()`, P5 B1 (no maplibre-gl fetch
under the flag), the oracle-migration-2 haiku brief; render-on-change WIP
held. Materials lane D step 1 merged 2026-10-31 (HISTORY "Landmarks cast their
shadows through one merged stand-in per level"): shadow draws ÷3, no visible
change; parts 2–3 measured only. Pre-existing red found: `building-click-perf`
:228 (0.82 vs 0.95, Westermarkt clicks land on "Guy Olivier") and :146 (10-min
timeout), same with and without the fix. Phone players who tap a turn at a
T-junction instead of holding it stay stopped (routing lane). Oracle
migration 2 merged 2026-11-01 (HISTORY "Specs and scripts read the
engine-neutral camera"): default-engine smoke 28/28 green; the own gate set
still fails `labels.spec` "hidden while the loading screen covers the map"
(`.cr-map-labels` is MapLibre-only). Open oracles, listed in that entry: own
equivalents for `_completeCityHasBuildings`, `.cr-map-labels`, the style reads
and the C-group assertions (L1); the lane's next round runs the other 44
specs under own, the rest on iphone and the four perf scripts for real.
Materials hand-back merged 2026-11-01 (HISTORY "World-v1 is pixel-identical"):
0 px at the five A/B spots on the published cells; **`?world=v1` is the
default since 2026-11-01** (HISTORY "The compiled city cells are the default
world"; `?world=live` is the tile path). P4 counters gate (budgets `p4Counters`, measured 2026-11-01): red on uploads
≥ 1 MiB after warm-up (49 desktop / 32 iPad: facade chunk geometry, own-ground
cell layers, one landmark), draws at 60° p95 399 / 589 vs ≤ 400 (roof caps ~25
and bike parts ~35 are the cheap merges, legacy bundles), iPad triangles p50
1.02 M vs ≤ 700 k after the `tileWhole` fix (811ff753c) and the overview span
grid (c415a1e1b, HISTORY "The overview draws only the tiles on screen": overview
279k → 83k; owners now: own ground 306k, facades 259k, trees 183k, cycle
overlay 108k, overview 83k). Materials lane takes the owners in size order
(own ground step 1 merged 2026-11-01, `0a6cf030d`, HISTORY "The rider's ground
cell is cut 6×6": iPad own ground 298k → 234k, frame p50 1.02 M → 0.95 M, draws
p95 +7 %; desktop ground 504k → 397k, frame 1.97 M → 1.87 M; step 2 merged
2026-11-01, `c9f743361`, HISTORY "Kerbs and bollards of the rider's cell draw
only within 150 m": iPad ground 222k; trees culled to the view 2026-11-01,
`8cfc3ceb4`, HISTORY "Only the trees on screen are drawn": iPad frame p50
0.80 M; flat lines culled + trunk caps 2026-11-01, `4d97ed9c5`/`086f295b6`,
HISTORY "The flat map lines draw only the span on screen": **iPad p50 0.696 M,
target ≤ 0.70 M MET**, desktop 1.33 M; the shading flip was a harness
elevation bug, fixed; facade mask R8 merged 2026-11-01 (`f3f6ff157`, HISTORY
"The facade mask uploads as R8"): iPhone atlas 21.67 MB, budget back to 22;
too-white roofs #179 fixed 2026-11-01 (bcc38403a, HISTORY "Bright white flat
roofs no longer clip"); toon look step 1 merged 2026-11-01 behind `?look=toon`
(53d5299d8) and step 2 (9d64252cb, HISTORY "Toon look step 2"); calming lever 1,
depth fade, merged flag-off 2026-11-02 (a37f977bc, `?depthFade=1`, HISTORY "Depth
fade"): far/near edge 1.45–1.82 → 0.84–1.06 desktop, target ≤ 0.5 not yet met;
landmark opt-out and default-on merged 2026-11-02 (9083203ff, HISTORY "The far
city fades into haze"); marking fade (lever 2) merged on by default 2026-11-02 (6f972429b, HISTORY "Far
road paint settles into the road"); materials next: lever 3 (label budget; may
conflict with L1's labelPolicy.ts), then levers 4–5 of #161 comment 6564393499 (the label budget may conflict with L1's
labelPolicy.ts)); the 150/400 m
facade LOD is parked (60–100k, 5–8 %, not worth its likeness risk yet). In-frame
shader links are 0. P5 follow-ups: delete
`building-tiles/` and `bag-tiles/` after a week of Sentry quiet on the
default; `worldRideDownloadMB` measured 2026-11-01 (seeded 1.13 MB, free 2.00 MB;
fetch ring is the road lane's item). closed on that lane 2026-11-01: the pre-painted atlas stays opt-in (atlas
ready ~1 s sooner locally but racing 0.7–1.2 s later, equal at 20 Mbit; the
network is the bottleneck), shaders-off-at-boot (program calls cost 13 ms at
boot, nothing to win). Parked: world-v1 A/B first load after a cold start
sometimes differs by ~1000 px at Westerkerk (not camera/lifts/styled/install
order); the harness warm-up hides it; find the cause before trusting
cold-load pixel A/Bs. Pre-existing default red to own: `street-survey-retire` "shots: default" (35
entries, expected none) and the flaky `city-startup-lod` "mobile city shells
remain". **Decision (user, 2026-11-01): the `?engine=own` flip is Amsterdam-only;** Utrecht,
Rotterdam and Den Haag keep MapLibre until their own-map extracts (with water)
exist, so the engine choice becomes city-aware (L1) and no lane spends time on
other-city extracts before the flip. Oracle round 3 merged 2026-11-01 (HISTORY
"Oracle migration round 3"): four oracles (`_completeCityHasBuildings`,
`_facadesActive()`, `_signatureSuppressOsmIds`, `.cr-map-labels`) and three own
gaps (overview-transition blend, recipe-tiles settle stat, governor start ratio
1.5 vs 2) are L1's. Oracle round 4 merged 2026-11-01 (HISTORY "Oracle migration
round 4"): the 48 non-P1 specs on iphone under own are 38 passed / 6 failed, all
failures the four oracles plus one new own gap for L1, `city-startup-lod` iphone
texture budget 26 MB against 22 MB; style-only and perf-probe tests skip under
own; the MapLibre-only call audit is done (review/capture scripts left as
MapLibre tools, listed in the entry). The oracle lane has no open items; it
re-opens when L1 lands an oracle.
**Integrator
next:** `CanalRecallUi.stepSteer`
in `car.js` through the frame host; drop the `leaflet`/`@types/leaflet`
dependencies at the flip. **L1 hand-back 18 merged 2026-11-01** (`d6837280a`,
HISTORY "The own view answers the four oracles"): the four oracles answered,
camera parity < 1e-7 px on intro and Anne Frank → Rijksmuseum, `_waitForMapSettle`
was already replaced (camera.whenIdle, hand-back 4), city-aware engine choice
(`engineFlag(search, cityId)`, Amsterdam-only, `game.js` passes `this.cityId`).
**Amsterdam flip (L1), after hand-back 20 (`040f36423`, HISTORY "Under own a POI
label wins the click"):** blockers done (labels win the click, bag-tiles on the
tile path, overview footprints 4.1 %, Sentry engine/tier tags); checklist
written (#129). Left before the flip commit: the three red specs on main
(building-click-perf :146/:228 both engines; iPhone city-startup-lod
`checked > 0`; iPhone render-on-change "riding off draws at once" under own —
probably the briefing world build or the tree cull), L1 bisecting; the
bag-tiles pixel-share drift (both engines, open). Then L1 prepares the flip
commit on its branch (engineFlag default + wantsMapLibre + query-table tests +
`ENGINE=maplibre` spec switch); the integrator merges it once the Sentry tags
have been live for a day, and watches the 48 h bar. Pin harness: the shading flip was an unpinned
camera elevation, fixed in the spec (d80ab4245); trees are pinnable. **Engine cutover lanes (2026-11-05, plan #213, user's play verdict on
`?engine=own`: sky flicker, Chrome crash within a minute on this Mac (renderer
OOM per the Crashpad dump), jank, buildings vanishing on bump, far fade too
stark, pop-in = detail switching on buildings already there):** E1 #214 merged
2026-11-05 (HISTORY "Houses stay put when the rider bumps into them"): bump
cover 37–40/41 → 0/41, haze gentler with the Distance haze switch; open: the
road guard lets the bike 1.1–2.6 m into house footprints (road lane), the ghost
dimming unseen in a ride (the phone layout of the Distance haze tile was reviewed 2026-11-05 from the Storybook phone story: fine, one tile alone on its row; render in map-recall2-screenshots `board/2026-11-05-setup-phone-distance-haze-tile.png`); (the desktop Storybook story `canal-recall-route-setup--advanced-options-haze-off` shows the questions row scrolled under the sticky language/guest header; the live page at 1280×900 renders the label and gloss in full, so there is no overlap bug, only a story that opens scrolled); E2 #215 merged 2026-11-05 (HISTORY "The own engine does not leak"): no
leak, one ride ~380 MB flat, the Nov 2 crash was a ~3.2 GB renderer with 12
workers, hypothesis several same-origin game tabs in one process (user asked:
how many game tabs were open?); heartbeat + context-loss telemetry now report
the next crash; open: ride-start frames > 100 ms (first draw 35–84 ms, labels
42–49 desktop / 164 iPhone), iPhone heap 303 vs 250, the 3-run A/B of the
opt-in ground frame budget, a crash repro with a hidden tab or two tabs in one
process; E3 #216 merged 2026-11-05 (HISTORY "The own engine's sky no longer
flickers"): `resetState()` after precompile left a transparent clear colour,
guarded, 212 → 0 cream frames, pinned in `sky-flicker.spec.ts`; open: one
unexplained standing-still failure in four runs; E4 #217 merged 2026-11-05
(HISTORY "The pop-in the user saw was the world ring lagging the rider"): swaps
≥ 400 px² within 120 m desktop 34 → 0, iPhone 6 → 0; open: 63/135 shell→detail
swaps 120–300 m out are faded, not prefetched; the probe scores a dissolve like
a pop; one pinned route; the iPhone cost of 8 + 3 detailed tiles (heap/stutter
at 4×) is unmeasured; `world-v1-bytes.spec.ts` rides at 8 px/s, not 8 m/s
(`window.PIXELS_PER_METER` is not on `window`), so its seeded number
understates a ride. **Free Ride cell cap (2026-11-05, bisected, cap 16 → 20):** `world-v1-bytes.spec.ts` free/world read 17 cells (0.98 MB) against the 16-cell cap. Bisect by rerunning the spec per commit: 13 cells (1.11 MB) at 006ec12f8, 14 (0.95 MB) at a386c3dd1, 17 (0.98 MB) at 2c573136d (E2+E3), and 15 (0.90 MB) at 2c573136d with the previous engine bundle swapped in; `?heartbeat=0` on main still 17; cells and grid unchanged. So the E2 engine bundle adds two ride-start cells and the count itself swings 13–15 between builds of the same ride, so it is timing-sensitive and the 1.5 MB bytes cap is the binding gate; cap raised to 20. Open for E5 (#218) if the ride-start profile shows cell fetches before the first frame: which ring step the E2 engine bundle moved.
**Engine look plan (2026-11-06, #222, user play verdict on `?ride=free&engine=own` at 69d4c65: detail pops onto distant buildings, fuzzy windows, moiré on the Weesperstraat 1962 slab in motion, soft banded rails at Zuidas, a tab locked after an aerial pan; "should we have used an existing engine?" answered no in the plan):** `docs/handoffs/engine-look-plan-20261106.md`; user shots in map-recall2-screenshots `engine/2026-11-06-user-shots/`. Owners found in code, nothing measured yet: no far tier, coarse shells carry a flat grey lid and are hidden in one frame at fade end while the swap gate stops at 120 m (63/135 swaps at 120–300 m per ride); detail walls dissolve coplanar over the solid shell (depth fighting under the dither); 256 px painted window cells magnified at chase range and `cellTier` never follows governor DPR changes; ridge rails dropped beyond 350 m and stripes minified with ground anisotropy 4, one bed per way; the aerial pan is not a measured scenario (ground ring to 2 km, 72 landmark models, GPU bytes ungated). Budget (user): three opus lanes now, two after the user reviews round one. Round 1, to spawn (worktree/branch/port on each issue): **R1-A #223** swap (`lane-engine-swap-20261106.md`: complementary dissolve, shell roof silhouette + colour from ROOF, gate 120 → 300 m, z-fight pin), **R1-B #224** crisp (`lane-engine-crisp-20261106.md`: one `texturePolicy.ts`, 512 px cells + anisotropy 16 on desktop high, `cellTier` setter, sharpness metric, mip-safe rail stripes with a screen-space minimum, yard-bed merge, far-ring rail), **R1-C #225** aerial (`lane-engine-aerial-20261106.md`: 3-minute aerial-pan harness with heap/GPU/resident/frame gates, fix the owners it names, `?perfHud=1` + "Show performance" toggle, heartbeat check in Sentry). Merge order A, B, C (A and B share `threeBuildingsBrowser.ts`; B is fenced to texture params + `cellTier`). Round 2 after review: R2-A analytic SDF windows, R2-B baked SHELL stream in `world:compile` out to the far ring. Flip gate unchanged. E7 #220 (lane `engine-gc-start-20261105`, opus, started 2026-11-05 night, brief `docs/handoffs/lane-engine-gc-start-20261105.md`) owns the major GC per cold start, the iPhone first ride frame and the route-change flush. E6 #219 merged 2026-11-05 (HISTORY "The cold first start stalls less"): iPhone cold start over 100 ms 17 → 7–8, desktop over 200 ms 1 → 0; motion unchanged. Open, largest first: one major GC per cold start (125–165 ms desktop, 200–214 ms at 4×, 0.1–0.6 s after RACING; next: heap-allocation profile of the load, `HEAP_OWNERS=1`); the iPhone first ride frame 117–133 ms (camera solve 25–28 ms, `_render`, `setFerryTerminals`); the following label frame 133 ms iPhone (occlusion index 19 + policy 16); building-tiles flush → `setFeatures` 86–101 ms per route change on the iPhone (`changedBoxes`); shader precompile unmeasured (no stalled frame compiled a program). Lane trap for every brief: the Vite dev server full-reloads on any worktree file change and silently hangs a harness run; build to a scratch `--outdir` and run through `BUNDLES_DIR`. E5 #218 merged 2026-11-05 (HISTORY "Ride starts stall less"): iPhone frames over 200 ms at a start 1–2 → 0, over 100 ms about halved; desktop warm starts 0 over 100 ms; label frame 162 → <20 ms; the own-ground frame budget is on by default after the lane's A/B (iPhone >100 ms 84 → 39). Open, largest first: own-ground main-thread slices of 30–40 ms at 4× on the cold start and first route change (50 of the 70 remaining iPhone frames >100 ms: smaller slices or index in the ground worker); the first ride-start frame 80–130 ms iPhone (inventory trees re-base every tree in one call 34–38 ms, rider cover 13–17 ms); 1–2 shader compiles per start (masonry, city-look lit|slot|uv / lit|slot|box: precompile via `sharedFrame.compileAsync` before the ride); building-tiles flush → `setFeatures` 60–100 ms per route change on the iPhone (`changedBoxes` two 36k Sets); label occlusion index 9–20 ms on the first placement after a jump; harness misses the restart after 2 of ~12 `next` arrivals. **`test:street-appearance` red (pre-existing, not in `check:canal`):** `audit-frontages.test.ts` "surveyed footprint or construction-year sources changed" since the landmark installs after its 2026-10-29 re-record; owner: rebake with `bake-frontages.ts` and re-record in the same change. The flip (`lane/engine-flip-20261105`, rebased onto 82b525133 on 2026-11-05, b2a2265d1, tsc/lint/engine tests green) merges only when all six
are green during a 60 s ride on the user's Mac and iPhone, not on Sentry days.
**User
asks (2026-11-01):** a first-person riding camera (#171, small opus lane after
the flip), the cartoon look mode (#161: steps 1–2 merged behind `?look=toon`,
strips on #161 for the user's verdict; open question: the lavender, teal and
yellow fronts come from the Cartoon buildings palette itself and read random at
chase-cam distance, a palette retune rather than a post-pass fix; then cel
bands, outlines and a flat sky), road gaps at bridges
(#178, opus lane `road-bridge-gaps-20261101`: steps 1–2 merged on by default
2026-11-02, dc44ce4af, HISTORY "Roads now run across bridges", city gap m²
237,068 → 205,941; step 3, dry way decks over land, is behind `?dryWayDecks=1`,
polished 2026-11-02 (e51ef17d7) and handed to the Centraal forecourt lane below
as its tool (with it the gap falls to 136,337 m²); the lane is idle; the
five-spot world-v1-ab runs again since L1 hand-back 22 (phased waits); polder water levels out of
scope),
bumpy ground at Stationsplein / Centraal forecourt (AHN has no ground over the
metro box and under the shed; fix = flatten the own ground to road level under
road and plaza polygons; small lane after the flip; it takes the station area
as one piece, bus deck, glass roof, metro box and ground, and owns turning on
bridge-gaps step 3 `?dryWayDecks=1` there). World compiler (#130,
P3): `scripts/world/pipeline.ts` CODE hashes 20 files (rail-infra added 2026-11-02), but the compiler also
imports `roofs/roofSlots.ts`, `look/palette.ts` and `threeBuildingMesh.ts`
(esbuild metafile, 127 inputs), so a change there would not mark the cells
stale; the roof cap of 2026-11-01 was checked by hand (recompiled, 604 of 604
cells byte-identical). Hash the compiler's whole import graph instead of a
hand list. Integrator handoff for
the next session: `docs/handoffs/integrator-handoff-20261101.md`. Note: shared-frame
`register(..., {order})` has no effect for group-rooted participants
(three.js takes the innermost group's order); fixed for the overview only.
Steps 4–5 merged 2026-10-30 (`487cb157e`): `ENGINE=own` switch for the gate
specs, ride-perf, phone-memory and `ride-perf-owners.mjs` (owner `engine`);
overlays under the flag (cycle tracks, transit, neighbourhood lines solid not
dashed, route + active street draped, active-landmark highlight and marker,
ferry pins, answered street) and POI / landmark / branded labels through
`ownMap/labels.ts` + `labelPolicy.ts` (place labels also screened by their nl
Wikipedia name, `engine/placeNames.ts`, Nieuwmarkt regression);
`vector-map.js` gained `frameCanvas()`, `captureFrame()`, `jumpToLngLat()` so
the `.map` fallbacks in `game-route.js` / `feedback/browser.ts` are gone.
**Measured, in-page A/B desktop chase 12 s:** main-thread owned CPU 6.61 →
1.97 ms/frame (gate ≥ 1.5 lower), draws 648 → 137, p95 22.5 → 17.8 ms, frame
median vsync-bound both; not like-for-like (no trees, detailed buildings,
signature landmarks, Google tiles, palette themes under the flag). iPhone
`ENGINE=own`: engine-own, phone-memory, start-heading, context-restore green;
60 s ride heap flat at 246 MB, textures 27 MB, buffers 78 MB, 0 MapLibre
workers. Desktop gates green under the flag: context-restore, intro-perf,
look-consistency (photo), open-squares, start-heading.
**Still not under the flag:** trees, detailed buildings, signature landmarks,
palette themes (Google tiles are being deleted). **Not done:** the 2026-10-10
re-port (own picker, overview extract with rail/footway/landuse, ~2.7k lines)
and the step-6 `_makeLayer` / `SHARED_FRAME_DEFAULT` deletions.
State: **L4 world streamer steps 1–3 merged 2026-10-30** (#136, `4b63096e1`):
Gate restated 2026-11-01 (user: "do we actually need pixel A/B at zero?",
no): structural equality of the styled building set at the five spots in
node (zero tolerance; `scripts/world/check-ab-spots.ts` PASSES, five spots
identical) plus a pixel check with the player frozen and the shadow camera
pinned, 0 px over 30, sub-30 speckle counted not chased (harness done:
default vs default is 0 px at any threshold; world vs default was the
centimetre height policy: cells are published `--no-policy` since
2026-11-01, 0/0/0/0 px at four spots, 141 at ijburg-edge = own-ground LOD
at the far edge, materials pins the ground LOD per cell in the harness and
re-runs on the published set; then the flag can default). Noted for a kit
lane: a 4 mm eaves change flips a storey count, the storey/kit derivation
needs hysteresis. Millimetre heights PARKED (integrator, 2026-11-01): the road
lane measured all 604 cells; `height`/`minHeight` are already exact integers,
the only float column is `roofEavesHeightM` (122,955 computed doubles, ~0.96 MB
gzip), no lossless layout saves > 50 KB, and the real lever is rounding the
eaves to the mm where it is computed (roofMesh/sourceVisualRoof/landmarkKits,
a ≤ 0.5 mm runtime building change, city ~9.0 MB). Measured 2026-11-01
(HISTORY "One ride downloads 1.1–2.0 MB"): seeded 1.13 MB, free ride 2.00 MB
(27 cells for 202 m); the lever is the streamer's fetch ring, not cell
bytes (road lane); mm heights stay parked. The earlier wording:
`?world=v1` is identical to the default path in the browser (five spots,
desktop and iPhone: same feature ids and styled features per tile; Node
`world:verify` 295 tiles / 349,220 buildings / 0 differ). The four-tile
difference was stale cells (207 of 295 tiles' inputs had changed since L3
compiled; `scripts/world/verify.ts` now catches staleness and the A/B runs it
first) plus one ulp of `Math.cos` (Node's fdlibm vs Chrome's correctly rounded
cos; `scripts/world/browserMath.ts` gives the compiler the browser's cos/sin,
358 buildings city-wide). Cells decode inside the three-buildings worker
(`WorldCellReader`; main thread gets 400-feature batches, longest task 3.3 ms
at 1× / 7.3 ms at 4×; `?worldWorker=0` falls back). Format v2 runtime cells:
no ATTR, compact ids: 15.86 → 13.45 MB gz. JS heap at the end of a 90 s
desktop ride: default 1,262 MB, world 688 MB. **Cells published** to
`public/data/extracts/amsterdam/world-v1/` (format 2, 604 cells) after the
integrator's A/B. **Integration rule from now on:** any change to building
tiles, facts, covers, kits or decorators needs `npm run world:compile &&
npm run world:verify` and the re-published cells in the same integration
(`verify` reports `staleTiles`). Integrator's A/B on the published cells: 3/3, 0 differing tiles, but the
default path held ~6,000 more buildings at snapshot time (36,352 vs 30,410 at
Westerkerk: more tiles resident, not different styling) and pixels differed
up to 1.15 M of 1.3 M, above the 0.83–0.88 M default-vs-default noise: the
world path streams tiles in later at page start (inflate wall time), which is
step 4's flush/regroup and look-ahead work; measure time-to-resident per
tile both ways. **Step 4 merged 2026-10-30** (`21a8d01db`):
`engine/worldStreamer.ts` holds one `CellQueue` (plan order, ahead rank from
the rider's motion, ≤ 2 reads per worker in flight, 36 resident cells,
off-plan eviction), a pool of min(cores−1, 3) decode workers with cell
affinity, and a per-frame `FrameBudget` (4 ms / 1 MiB) that chunk installs
spend (`?uploadBudget=0` = one per frame); the compiler writes a 39 KB
runtime `tiles.json`. Measured: last of the first four tiles resident at
page start default 3,870 ms vs world 3,791 ms (was ~120 ms behind); 40 s
cold ride p99 frame 83.4 → 66.6 ms, stalled 3.63 → 2.6 s, pop-in equal; A/B
0 differing tiles, Westerkerk 36,352 buildings both ways. **Gates not met:**
JS heap at ride end default 977 vs world 1,019 MB (gate ≤ 500 MB at ride
start, which the script does not yet sample; the 36 resident cells plus
per-worker decoded copies are the suspects); the bytes gate, restated 2026-10-31 after format v3
(HISTORY "World cell format v3"): city total ≤ 8 MB gzip for the building
cells (v4 published 2026-11-01: 9.13 MB, HISTORY "World cell format v4";
collinear removal held; next cuts need a byte census by stream, lane) plus a
per-ride download gate ≤ 2 MB under `?world=v1` (met 2026-11-01: seeded
1.11 MB, free ride 1.96 MB after facts load on the first card); both in
`budgets.json`. City: format v5 (lossless roofFurniture integer-list column
+ FOOT refs run symbol) published 2026-11-01 at 8.92 MB; decimetre heights/eaves
are built behind `--height-step=0.1` / `--eaves-step=0.1` but HELD: the
fixed-camera A/B shows 7–29 K px over 30 vs a 0.1–1.3 K floor because the
runtime derives storeys, window rows and the facade kit from the fine value
(a Westerkerk brick gable turned grey). A safe variant would round only where
the derived storey/kit decision is unchanged; parked. Decision 2026-11-01
(user delegated): the city gate moves to ≤ 9.5 MB gzip lossless (met at
8.92); the per-ride ≤ 2 MB gate is the binding one; no more byte cuts. Next for L4 (sent): ride-start heap sample and the owners
(12/18/24/36 resident cells, one decoded cell shared across tiles,
transfer not copy), then chunk and own-ground builds onto the pool so
`chunkBuildQueue.ts`, `ownGround/residency.ts`, `rendererShared/residency.ts`
and the second own-ground worker can go, then road CSR (step 5). **Heap and
pool merged 2026-10-31** (`5f64e3292`, HISTORY "One worker pool"): heap gate
met with a GC-forced sample (303 MB main at ride start, world below default
at ride end), `engine/workerPool.ts`, old queues deleted; the main own-ground
cell build keeps its own worker. **Step 5 road CSR merged 2026-10-31**
(`922496ea7`, HISTORY "The road graph is flat arrays"): road-graph heap
50 → 8 MB (+7.3 MB typed arrays), routes identical; `roadGraphMB` 15.5 (claimed
at ride start after forced GC, gate ≤ 30) recorded in budgets 2026-11-01.
**Other-city road binaries merged 2026-11-01** (`7d1c1b6c5`, HISTORY "Binary
road extracts for Utrecht, Rotterdam and Den Haag"; way hashes identical on
all four cities). **Road lane final hand-back merged 2026-11-01** (`5c9915cdf`,
HISTORY "Road lane final hand-back"): spawn-pose premise pinned in the specs
(Eerste Leliedwarsstraat / Bloemgracht T; Reestraat HUD withhold), six-tile
cut dropped (never binds). **P0 — pop-in (user, 2026-11-01: "I'm not loving the
pop-in"):** the pop-in gate is RED on the iPhone profile, default engine: 24
building-chunk arrivals within 150 m at ride start (nearest 34.7 m) + 4
ground-cell swaps vs zero; heap gate RED too, 300 MB vs 250 (`_canalSharedFrame`
101 MB, `atGrid.grid` 34, facades CPU arrays 27, `roadIndex.segments` 20,
landmarks CPU arrays 12). **Fetch ring merged 2026-11-01** (`b74955c7c`, HISTORY
"The world streamer fetches the cells under the ride view"): free-ride cells
halved, iPhone start heap 302 → 276 MB, 0 restyles; own-engine iPhone gates
still red (heap 276 vs 250; 24 chunk arrivals at 35 m during the ride, with or
without the ring). **Neither detector sees what the user reported** (HISTORY "Pop-in measured the
way the player sees it"): the 150 m count reads 0 on desktop, the px/s
detector reads 4–5 px/s on the seeded ride on both engines, and its big
Jordaan number is Westerkerk parallax (a detector false positive); the 24
phone arrivals at 35 m are a measurement artefact with nil visible cost
(closed). Blocked on the user's answer to #168 (what pops, where, when); then
the detector becomes depth-aware (road lane, second item) and the owner is
cut. Road lane now: time to ride (HISTORY "Time to ride by phase on the phone
profile"): routing graph is the largest phase (2.85 s emulated), stitch pass
cut merged (5f0fad294, graph identical); lever (a) merged 2026-11-01
(d15d66991/512a5782d, HISTORY "The city's roads, routing graph and surface
index build while the player reads the briefing"): 5 s dwell → 3.0 s on the
phone profile, 2.6 s desktop; immediate submit still 7.8 s on the phone (gate
≤ 4 s RED); lever b2 merged 2026-11-01 (c0e02ebec…514e18c3d, HISTORY "The
built routing graph and surface index are cached on the device"): return
visits have the world ready 1.7–2.1 s after submit on the phone profile vs
5.6–5.8 cold, 0.3 s desktop; what is left warm is the settle hold 1.5–2.6 s
with nothing pending (L1/materials: why does the hold wait that long when
nothing is pending?); b1 prebuilt graph only if the real-iPhone phase table
shows the graph build > ~1 s; depth-aware pop-in detector (tooling) still to
do; the road lane is idle;
real-device timing owed once the phone is unlocked and re-trusted
(`scripts/time-to-ride-device.mjs --target safari`); #150 landing animation
excluded. Heap levers from the `_canalSharedFrame` breakdown:
OverviewLayer keeps the decoded overview data + rebuild closures + prebuilt
geometry, 45.6 MB (L1, after its flip blockers); facade geometry CPU arrays
kept after upload 27.1 MB (materials, after ground step 2); landmark CPU
arrays 11.6 → 11.2 MB done (69544e547; the interleaved GLB buffers, ~3.8 MB
on iPhone, are parked). The no-maplibre `package.json` diff loads
clean and waits for the flip (lane scratch `no-maplibre-package.diff`).
**Step 5b merged
2026-10-31** (HISTORY "The road-graph build is 40 % faster"): number keys and
a stamp dedupe in the build, `scripts/time-to-ride-phases.mjs` for the
per-step table; navigation → racing 5.41 → 4.75 s. **Step 5c merged
2026-10-31** (HISTORY "Road setup no longer waits behind the building look"):
48 ms road-setup slices, in-place snap-index build, catalogue loaded once;
submit → rider 3.13 → 1.92 s, navigation → racing ~4.0 s (landing animation
varies 1.0–1.7 s, #150 needs-david). **Not met:** time to ride ≤ 4 s. What
remains: the landing animation (#150); the routing graph's 1.0–1.2 s wall for
~500 ms CPU (building-look textures ~360 ms and tile installs run between its
slices; holding the textures saves ~0.5 s but puts the first building tile
> 300 ms after the rider, unsliced freezes the loading card ~0.5 s: decide
with #150); then `fetchRoads` ~220, surface index ~150, segments ~100 ms. For
remote players the `streets-routing.json` download was the lever: **binary
road extract merged 2026-10-31** (HISTORY "The road network ships as a compact
binary extract"), `roads-v2/streets-routing.bin.gz` 1.47 MB gz vs 2.84 MB
JSON, behind `?roads=bin` (JSON path unchanged; regenerate with
`npx tsx scripts/roads/build-road-extract.ts` and copy from
`artifacts/roads/staging/amsterdam/` whenever `streets-routing.json` changes);
fetchRoads 231 → 97 ms localhost, 4,178 → 2,499 at 20 Mbit; submit → rider
1,808 → 1,595 / 6,310 → 5,160. Make it the default once a few rides on the
deployed site confirm the gzip-wrapped fetch and the fallback. Held: build-time
quantise-and-stitch (needs a fixed projection centre, which changes routes).
Next at 20 Mbit: `squares.json` and `transit-network.json` load serially inside
`fetchRoads`. Also not met: the ≤ 4 MB bytes target.
**Reds on main found by the programme's runs (2026-10-30): all fixed 2026-10-31**
(#144, HISTORY "Three reds on main were checks that fell behind the game";
#131 for sun-heading). The `engine-own.spec.ts` programs red is gone 2026-10-31
(materials lane: 20 programs desktop, 23 iPhone, budget 32). CI runs only
lint and the boot smoke, so no e2e red blocks a push. Triage lane wanted: are they product-visible?
State: **L3 world compiler merged 2026-10-30** (#130, `73e8b0ba1`, flag
`?world=v1`, cells NOT published yet): WRLD v1 format
(STRS/FOOT/ATTR/STYL/ROOF/GRP/HIDE, strict decoders, `test:world-format` 7/7),
`npm run world:compile` runs the runtime's own decorators/roof/grouping into
`artifacts/world/staging/` (604 cells, 347,698 buildings, 14–19 s, `--changed`),
the tile streamer under the flag reads cells with no GeoJSON, facts fetches,
decorator chain or MapLibre `setData` on the main thread (per dense tile
163–301 ms → 25–58 ms, Node). Chunk arrays byte-identical at five sentinels and
the resident set identical through the real streamer. **Gates not met:**
15.79 MB gz against the ≤ 4 MB target (replaces 21.5 MB of inputs; FOOT 7.5 MB
at exact 1e-7° so decoded coordinates equal the default path's, 0.1 m would
save 0.8 MB and move vertices; ATTR 2.45 MB + STRS 2.07 MB are runtime-unneeded
once consumers read STYL only; floor at exact coords ≈ 9 MB) and decode ≤ 5 ms
per cell at 4× (desktop p95 4.5 ms, max 9.5 ms; needs the worker-side read, L4).
Open: browser A/B `WORLD_AB=1 … world-v1-ab` (waited 80 min on the Playwright
lock, not run), publish the cells (16 MB in git; after the A/B), worker-side
decode, LMRK/WATR/ROAD/TREE/LABL streams, non-default looks under the flag get
the default look's style. Pre-existing red found on main:
`scripts/check-building-look-transition.ts` throws
`t.chunks.get(first.key)` undefined (`test:city-startup` step; fails on
`72d48311c` too), not from this lane; CI is green because `check:canal` does
not run it.

**Engine round 1 merged (2026-11-06, #223 swap, #224 crisp, #225 aerial; HISTORY). S1 desktop pop-in is done. Open:** P1 iPhone swap dissolve: a touch-shell wall is one quad and differs from the detail wall, so `swap-zfight` excess is 191 px on iPhone (report-only); finer touch-shell walls on the swap ring, or a shorter touch fade. P1 swap probe mid band counts ownership-flip area; measure visible ΔE per swap, then `SWAP_GATE_MID=1` (`popInSwapsMid` report-only at 88 / 241). S4 rails fixed by R3-C (#232, HISTORY): the ground ring now follows a panned view, 50/50 beds at every rail spot on both tiers; open from it: P2 the legacy MapLibre path still centres the ground on the rider when panned (own engine only is fixed); P2 pitched overview rails on iPhone drop under 1.25 px in the horizon band (the 30 m half-width cap, by design); P2 the overview's culling spheres do not include the rail lines' extra width; P2 the far-ring drape adds 83k triangles over the rail blocks and block `2_-3` loses a street tier; P3 the camera's minimum zoom holds zuidas-rails-high at z15.1 instead of z14.8. From the refined S4 pose (`s4-zuidas-user` [4.8836, 52.3399]): P2 the Zuidas tower trio (OSM w753541325–27, 86–87 m) draws blue from `building:colour #5a81a0` where the user's build 69d4c65 showed grey, cream and orange, and P2 the trio is not drawn at bearings -8/-5 from the same centre or at centres 4.8824–4.8832 although the view geometry puts it in frame (same with main's bundles, `?groundView=0` and the rider at the spot): building residency or culling near the camera, a buildings-lane question. P1 S3 at the user's pose is not fixed by round 3: R3-A (#230, HISTORY) pinned `s3-slab-user` and found 92 % of the alias there is the façade window texture on the slab's grazing west wall (rho ≥ 16 texels/px aliasing past 16× anisotropy at DPR 2; the blank wall the user saw is the same wall flattened to its mean at DPR 1 in build 69d4c65), trim + cornice under 3 %; the thin fade ships (−2.8 % there, −13 to −21 % whole-frame elsewhere, swap excess 0) and SMAA stays off (`?smaa=1`, 1.7–4.3 ms). Next lever: an anisotropy-aware rho (minor axis × min(aniso, major/minor)) and a fade band toward the mean instead of a cut in `roofTier. R3-D #233 merged 2026-11-07: at the user's pose the slab wall is plain minification at 16–32 texels per pixel on both axes (footprint under 4:1), not anisotropic undersampling, so that premise was wrong; the aniso rule made aliasPx worse (45k → 54k) and ships off (`?cellTierAniso=1` opt-in, `?cellDebug=under` probe, 0 ms). R3-E #240 merged 2026-11-07 (HISTORY): the roll-off chain cannot reach the slab (16× aniso reads the wall at mip 2.5–3.5 where the 128 × 256 texel pitch is still 16–32 texels; a roll-off only bites at T ≈ 24, which blurs S2); shipped `HIGH_FACADE_ANISOTROPY = 4` on desktop high (`?texAniso=16` restores): s3-slab-user sdf aliasPx −24 % for ≤ 1 % S2 lapVar, zero cost. P1 S3 residual, R4-D merged 2026-11-07, desktop default ON 2026-11-08 (#246, #247 the user's call: "trust your rec", option 1, no wider band; HISTORY): a 3×3 tent of footprint taps on the facade cell sample (`?cellTaps=0|1`, `CELL_TAPS_DESKTOP_DEFAULT` true, touch off) takes s3-slab-user sdf 29,997 → 21,322 (gate ≤ 22,822 met) and painted 49,918 → 24,462 (gate 23,500 missed by 4 %), +0.10 ms GPU, S2 lapVar −1.5 / −2.9 / −2.4 % on sdf; the 4× crop trades detail for calm (ΔE > 20 area in the still pan 335k → 141k), the user chose the calm (#247). P2 painted / touch still miss (iPhone: no threshold serves both the slab and S2); the lever left is temporal or a threshold keyed to window pitch; the remaining alias sits where rho < 20. P2 with taps on the tier band stops mattering for alias ([32,60] 21,322, [24,45] 21,365, [40,75] 21,268), so a later flatten is free for alias and only the look decides. P2 tier band [24,45] at DPR 2: sdf 25,591 / painted 34,045 but it flattens more wall into the tier tone (still detail 340k → 184k): the user's call after a ride look. P2 desktop mid/low tiers still use the legacy 16 path, unmeasured. P3 the roll-off chain stays as an off-by-default tool (`?cellRolloff=1&cellRolloffPitch=12`); delete it wholesale if nobody picks it up.ts`, measured at `s3-slab-user` with `ZFIGHT_SS`; R3-B's band-limited windows give −13 % there only with `?windowSdf=1`. If that leaves the complaint standing, TAA (camera reprojection from depth, history clamp, jitter, ~1–2 ms) is the round after. P2 R3-A trade-off: copings, white bands and signs under 2 device px dissolve at ~150 m (`THIN_FADE_FROM_PX`/`TO_PX` 1→2; try 0.5→1.5 if the user misses them); host-opening chunks and slot meshes never fade; look-consistency with `?thinFade=0` needs the spec to wait for the ground before a strict equality gate; fadingSteps 14 < 19 stays report-only. Gate on `aliasPx` (`ZFIGHT_SS` supersampled reference in `swap-zfight.spec`), not the raw still-pan count, which rewards blur; proposed report-only `stillPanPxS3` row on #228. The `swap-zfight` dissolve assertion fails at DPR 2 on main too (fadingSteps 13 < 19). R3-F #241 merged 2026-11-07 (HISTORY): building bases off aerial frames, label budget, aerial POI thinning (user: "way fewer labels at this zoom"), sticky winners; `game frame` 831 → 191 ms desktop / 697 → 154 iPhone over the worst frames, label churn 102.8 → 16.7 per second. P1 aerial frame p99 on iPhone: worst window 100.1 against 80 after R3-F (emulated), own-ground 388–510 draws at the peak; desktop is met in the continuous pan since R4-E (the R3-F "GPU-bound" reading was a harness bug: the LoAF and phase arrays were emptied after the first window, fixed in R4-E; the main thread was 99 % busy, the GPU 22 %). R4-B #244 merged 2026-11-07 (HISTORY): lod2 stand-ins beyond 500 m from the air or under 12 px, per-material merge, one BatchedMesh draw; catalogue landmarks parked from the air 401–1,679 → 21–639 draws, pan frames > 100 66 → 63 desktop (noisy machine). R4-C street chunks merged 2026-11-07 (#245, HISTORY): primitives merged per city material with pandRanges re-based (`?chunkMerge=0`), 142 chunk lod2 stand-ins from the air under 12 px (`?chunkLod2=0`, `?chunkLod2Px=`); chunk draws 584 → 24 at Westerkerk, 483 → 14 at Rijksmuseum, the `landmarks` owner ≤ 69 at every parked spot (gate ≤ 150 met). Open: Frame time re-read on a quiet machine 2026-11-07 night (integrator, two alternating pairs, baked tier on, desktop headed): R4-C flags on 21 / 52 frames > 100 ms against off 55 / 81 (both pairs clear the ≥ 15 rule, so the win is real), draws max 529 / 490 against 1,371 / 1,900, p99 worst window 118 / 175 against 183 / 150 ms, median window 75 / 67 against 75 / 83; the frames > 100 gate (≤ 20) is still missed by one in the better run and the p99 gate (≤ 100) by 18–75 ms. R4-E merged 2026-11-08 (#248, HISTORY): the long aerial frames are main-thread arrival work on fetch-ring jumps (4 → 132 and 25 → 378 cells when the parked rider leaves a pitched view's kilometres-wide box), not teleports and not the GPU; `?arrivalPace` (engine/arrivalPace.ts: ring cells 6 per 250 ms nearest first, one baked install per frame, aerial feature delivery every 500 ms latest-wins, tree rebuild once a second from the air) is desktop on, touch off; continuous 120 m/s pan 8 / 12 frames > 100 ms and p99 worst window 91.7 / 91.6 (both gates met; off 38 / 52, 140.8 / 141.6), harness 300 m/s 20 / 27 and 100.0 / 100.2 (on the p99 gate), street ride unchanged. R4-F merged 2026-11-08 (#249, HISTORY): from the air the fetch ring follows a 1.5 km square round the view centre instead of `rideBox` (`?ringFootprint`, world/worldRing.ts; the ring holds 16–20 cells all the way, was 132–209 with a 924-cell want on the oost leg) and the inventory trees assemble from per-tile compiled instance arrays (`?treesIncremental`, rendererShared/treeInstances.ts; median rebuild from the air 46–50 → 12–24 ms, byte-identical output); both desktop on, touch off; together: continuous pan 0 / 0 frames > 100 ms and p99 worst window 50.0 / 50.0, harness 4 / 2 and 75.0 / 74.7 (off 10 / 9, 85.3 / 83.6 and 39 / 15, 125.2 / 91.2), GL peak 798 → 757 MB, street ride unchanged. Open from it: R4-G merged flag-off 2026-11-08 (#250, HISTORY): the "landmark textures" (115 MB at the peak) are the embedded 2048-wide facade-atlas PNGs of ~20 ordinary-building installs in `models/ordinary-buildings/` (no lod1/lod2) plus the GVB metro, not landmark GLBs; `?landmarkTexCap=1024|512` (landmarks/landmarkTexCap.ts: a downscaled ImageBitmap resident while the sparsest 5 % of the sampled area keeps ≥ 1.5 × factor texels per device pixel) cut them 115 → 77 MB but failed the A/B rule (−13.6 / −70.5 MB for 1024, −22 / −19 for 512; off runs alone vary 761–790) and its pixels-per-metre estimate reads ~8× high at 3 km (under-applied: safe but understated), so it stays off; `glCounters` now also reports decoded bytes per internal format (`totalDecodedMB`, `aerialGlDecodedMaxMB`: the R8 mask is 17 MB not 69, the atlas 87 MB not 139), on which today's peak is 693–722 MB. R4-H merged 2026-11-08 (#252, HISTORY): the 27 drawn ordinary installs with an embedded image over 512 px now have a lod1 (atlases shrunk to 1024, every triangle kept; 1.99 MB) and an untextured lod2 (mean atlas colour per face, ≤ 6 materials; 0.16 MB) from `npm run build:landmark-lods -- --ordinary`, rows marked `ordinary` in `modelLods.json` with `texelsPerMetre`; from the air only, sized at the model's nearest point, lod1 while it still gives ≥ 1 texel per device pixel (1.5× hysteresis), lod2 under 12 px, `?ordinaryLod=0` keeps every install at full; the landmark-textures row at the peak 115 → 37–55 MB, GL max −70 / −39 continuous and −78 / −6 harness (the harness pair-2 peak moved to the west leg, which has none of these atlases), frames unchanged, `crisp-textures` identical at all 13 spots, no pixel differs in the distance strip at 50–600 m (a 512 lod1 with the 15 % simplifier lost mullions and railings at 300 m and only saved 20 MB, so the brief's 512 was dropped). R4-I merged 2026-11-08 (#253, HISTORY): measure-first, the baked tier at the peak is 55–60 cells / 6.5 M vertices, 205–211 MB by attribute (position 43–48, uv 49–50, tint 25, accent 25, thin 12, index 33, layer/hidden/swapSlot 6 each), 59–94 MB of it in cells ≥ 3 km from the eye; the brief's uv-as-u16 (uvs are metres/bay units, ±12.8 k) and per-building tint (4–9 distinct pairs a building) premises were wrong; `?bakedBytes` (accents as RGB, alpha is 255 everywhere and both facade shaders read `accent.rgb` only) is on, −5 to −6 MB, inside run noise; `?bakedRelease=1|<m>` (a covered cell ≥ 3 km from the eye from the air drops its mesh to the far prisms, 600 m hysteresis, only where `FarShells.ready`) is off: −27 MB continuous / +5 harness, and at zuidas-rails-high 12.6 % of the top band exceeds ΔE 5 because the far prisms do not draw over the released canal-belt cells (bare ground); `aerial-pan` reports `bakedAttr` by attribute and distance band and `bakedOwnerMB`. R4-J merged flag-off 2026-11-08 (#254, HISTORY): `?atlasAerial=1` (look/atlasAerial.ts) swaps the facade atlas pair for a half-size pair by GPU copies of levels 1..n while a guaranteed floor on the finest level any facade can read (eye height − 175 m tallest building, 12 m sparsest cell) is ≥ 2.5 for 60 frames, and restores level 0 from Cache Storage in 8-layer bands at 4 ms a frame under 2 with a 1.5 s descent lead; it works at height (z14.2, eye 1.7 km: one drop, no soft frame) but the budget pan's eye is only 116–175 m, under the tallest building, so the floor is −∞ everywhere and it never fires there (0 MB saved); the GPU's level-colour frames show level 0 on 0.1 % of pixels at the 175 m peak with ~half a level of margin and ~zero margin on the 116 m legs; `?atlasAerial=measure` records the curve, `crisp-textures` has `atlasAerial`, `atlasHalf`, `mipDebug` mixes. Roofs offset fixed 2026-11-08 (#257, HISTORY; user shots): shell roofs (SHEL cells and runtime coarse chunks, since R1-A) drew the roof plan's full fitted box untrimmed (`shellRoofPlan` `clipToOutline: false`), so 1,026 of 6,632 planned roofs in four central cells hung > 1 m past the walls (507 > 3 m, 82 > 5 m; the Stadhouderskade/Hobbemastraat block's 60.7 m box had 1,155 m² outside its footprint); `shellRoofPlanFor` keeps the detail's trim where the hang exceeds `SHELL_ROOF_HANG_CLIP_M` 1 m (+6.3 % shell triangles, SHEL gzip 48.5 → 57.1 MB), shells republished; P3 get the re-bake cost back when R5-F or the GPU budget needs headroom (+6.3 % triangles cost +17.5 % gzip, so the clipped outlines are vertex-heavy): simplify the trimmed roof outlines (Douglas-Peucker ~0.3 m or quantise) and the merged trim for low-poly shell roofs (clip the outline by the slope triangle, earcut once), before touching anything the user can see; P3 pin the exact user poses (the lane's were approximate); P2 crisp/swap/pan re-read after the republish (baked vertices +9 %, GPU row already red). R4-K merged flag-off 2026-11-08 (#255, HISTORY): the far prisms now draw under a released baked cell (`engine/farHandover.ts`: the R2-B rule hid a far part tile-wide whenever the rider's near chunks drew in that z14 tile, so the six canal-belt cells lost their prisms; now a covered-not-drawn cell's part hides only under its own drawn mesh or a near chunk inside that cell, the release is refused for a cell with near detail inside it, released cells count as held in `replan`, and a returning cell is fetched again); keep | release same-page horizon ΔE > 5 at zuidas-rails-high 7.5 / 5.0 / 0.8 % at 2.5 / 3 / 4 km (was 12.6 % with bare ground), west peak looking east 6.6 / 1.7 % at 3 / 4 km, no pop on return (0 px); what differs is the prisms' look (one mean colour per layer, cooler and flatter than SHEL); `?bakedRelease=1|<m>` still off until its pans pass the 40 MB rule (queued), then 4000 m on the look. P2 `aerialGlMaxMB` 690–760 (legacy) / 624–684 decoded against the 700 budget, the remaining peak the west Bos en Lommer leg: left are baked coarse ~165 MB (largest; P2 the release's pans (two pairs per mode) and crisp/swap numbers, then the flip at 4000 m; P3 apply the per-cell far rule to uncovered cells too (a harness artefact: the held rider's near chunks hide uncovered cells' far parts tile-wide; changes release-off pixels); P3 a per-cell tint in SHL1 for the prisms' tone at 3 km (data change); then the three savings outside R4-I's fence: u32 indices split into u16 parts (~−15 MB, needs a multi-mesh baked entry in the facade layer), a per-cell tint/accent palette (~−30 MB, a baked material variant with a per-mesh texture), uv rebuilt in the shader from bay units (~−25 MB)), the facade atlas (87 MB decoded; the level-0 drop exists flag-off (R4-J) but needs a trigger that measures the finest level the GPU reads (a low-res lod-feedback pass, or a frustum-clipped nearest-facade distance with per-chunk texel density) with ≥ 0.5 level of margin and a restore on every leg change (~every 20 s), with a never-soft proof at the 116 m legs; also open: a forced re-drop stuck in `dropping` under the crisp harness hold, and a look switch while the half pair is bound), ground 85 MB buffers + ~17 MB decoded textures (no stale ring found), the GVB metro's 1024² runtime texture (not a catalogue install, no lod); P3 the ordinary lods on the iPhone profile, `swap-gate` and `rider-cover-bump` (not measured); whether the budget row should read the decoded figure is the user's call (needs-david); P3 fix the cap's projection (probe `nearestPixelsPerMetre` against the model's projected box; fixed, all 16 textures at factor 2 save ~75 MB) and then measure it at S1–S4 and on the street ride; P2 touch defaults for `arrivalPace`, `ringFootprint`, `treesIncremental` once the iPhone pan is measured; P3 the remaining tree rebuild (12–24 ms) is `InstanceCull` shadow twins and mesh uploads: reuse the meshes if it matters; P3 the ring held 0 cells on the Zuidas leg in the off runs (uninvestigated); P3 the harness `--continuous` as the perf:aerial default (player-like; the recorded rows are the 300 m/s mode); P3 interleaved off/on pairs for the harness mode (its baseline swings 15–39 frames); P2 street level differs by 1–9 px (single-pixel depth ties between coplanar faces now drawn in merge order, no pixel over ΔE 20; main vs main 0 px): accept or keep the merge off at street level after a ride look; P2 chunk lod2 likeness (no windows or white frames at 1.5 k triangles, slight tone shift; UVs carried over did not help and grew the set to 9.2 MB): a baked facade impostor; P2 `chunk-face-hasebroek-2-46-r1`'s GLB sha does not match its chunks.json row, so it gets no lod2 (pre-existing); P3 look-consistency needs `LOOK_SHOTS_QUERY='?engine=own'` with the leading `?` or the page never loads. P2 the default `swap-zfight` spot (`s3-slab`): R4-L's bisect 2026-11-08 (#256, table on the issue; spec gained report-only `ZFIGHT_CONTROL`, `repeatPx`, `ZFIGHT_DUMP` crops, `ZFIGHT_FRAMES`) names the owners: with the baked tier on (today's desktop default) the excess is **117** px (max 20 per step; R4-A 1716d3c70 takes it from 46 to 117), `?bakedCoarse=0` gives 46, `&thinFade=0` 23 (R3-A f0bb3516e adds ~20), and a 23–29 px residual is older than every candidate (R1-A's own bundles, world data and spec read 26–29 today where R1-A recorded 0, so it is today's page/models or Chrome 157); the control (a second still pan) reads 0 twice, so the measure is deterministic; the differing pixels sit on the slab's east roof edge and grazing east wall and at its north end by a tree, rising from 4 at t≈0 to 19–27 mid-dissolve and back to 0, which rules out a plain shell-vs-detail colour mismatch and points at geometry one tier has and the other lacks (thin pairs, lift base, SHEL roof edge; pand 0363100012185595). Next lane: `ZFIGHT_FRAMES=1` + `analyze.mjs` on main with and without `bakedCoarse`, diff SHEL against the near chunk for that pand, fix in the shell decode/compile or the thin fade's shell handling, then the spec joins `check:canal` on the `bakedCoarse=0` path first; a full b52 checkout run separates page/models from Chrome for the residual. The earlier text, superseded: 45 px excess (max 6 per step) where the gate expects 0; it is the same with every 2026-11-07 flag off (`bakedCoarse`, `chunkMerge`+`chunkLod2`, `texAniso=16`, `windowSdf=0`, the landmark trio) and with this morning's bundles (150a59833) and the pre-R4-A bundles (a043f6724), so it predates today: bisect by day with `BUNDLES_DIR=<bundles of sha>` (the spec is not in check:canal). P2 lod2 look drift on icons: the Westerkerk tower's windows coarsen to dark triangles at 4× and a nearby orange roof darkens (per-material simplification; a tighter bound or a window-aware bake for the ~10 icons). P2 the bursts as each pan leg starts, when newly loaded models draw at full for a moment; P2 lod2 → higher-level swap pop ~608 px ΔE > 20 per model (a fade); P3 iPhone landmark GL 13 MB over baseline; P3 landmark shadow draws rose 135 → 418 at the desktop peak sample but few rows catch a shadow pass, needs a measurement that captures it on purpose. R4-A's baked coarse tier merged 2026-11-07 (#243, HISTORY): shells published (48.5 MB gzip, 564 cells; far 4.6 MB; all 604 cells refreshed from the 2026-11-05 compile). Desktop on, touch off (`?bakedCoarse=0` off, `=1` forces it on touch). The evening's few-hour rollback was a held-sync spec artefact, not a play bug (HISTORY): the dissolve now steps in `prepareFrame` and `tests/e2e/baked-fabric.spec.ts` pins the da-costakade-user fabric on and off. Open after R4-A: P2 in held frames `liftPending` stays at 858 because `refreshShellBases` runs only from `sync` or `settleTick` (some buildings in a held frame wait for their ground lift; the 45 specs that stub sync, peer's P2, are the same family); P1 re-bake shells after every landmark or kit install (`npm run -s world:compile -- --shell --out=$PWD/<dir>`, equals sign, 134 s; rsync into world-v1 and `world:verify --dir=`), a stale shell keeps a building the HIDE list removed; P2 touch on, once the iPhone GL (419 vs 356 MB with the 24-cell budget) is measured on the device; P2 baked cells now install one per frame nearest first (R4-E) and the ring admits new cells paced, so a district still fades in over a second or two from the air: prefetch the next district's cells along the pan path if the user minds; P2 re-measure draws per kind and upload churn at the aerial peak with the baked tier on; P3 SHEL size (46 cells over 300 KB hold 21.4 MB; a 0.25 m grid for air-only cells saves ~0.35 MB; pruning walls under the HIDE list is unsafe while the runtime hides only shown models' prisms). Aerial POI cap merged 2026-11-07 (R3-F follow-up 1cb3e6fa2, HISTORY): `AERIAL_POI_MAX` 10 ranked by priority minus 0.1 per metre from the view centre, `?labelAerialPois=N|all`; Sarphatipark 79 → 8 names, churn 4.9 per second desktop. windowSdf from the air A/B'd 2026-11-07 (HISTORY): 2× on / 2× off desktop pans on the merged bundles, on 141.8 / 92 / 79 and 141.7 / 75.3 / 37 vs off 129.1 / 84.7 / 42 and 175.1 / 83 / 52 (p99 worst / median / frames > 100): the sign flips between pairs, so the lane's 164-vs-108 read was run-to-run noise, the desktop default stays ON. P2 if a later clean read shows a real aerial cost, drive `windowSdfMix` to 0 while `isAerialView` (eased ~300 ms, `?windowSdfAerial=1` keeps it) in `threeBuildingsBrowser`'s uniform update beside `setCellTierPixelRatio`, rather than revert the default; re-read after R3-E's anisotropy result lands. P2 single-frame `labels: collect` / `place` spikes of 20–53 ms between full placements (lazy-policy re-tests or glyph measurement), not long-frame owners. P3 own-map-v1 has two hood anchors for Chassébuurt ~500 m apart (split polygon), the only duplicated hood of 42: merge in the extract (haiku data lane). R3-G #242 merged 2026-11-07 off by default (HISTORY): the detail block never moves in a pan (the subject is the parked rider), so the freeze changed nothing (uploads 105 % of baseline) and only delayed the landing re-plan when riding on from the air; `?detailFreezeAerial=1` opts in. P2 the rider's detail tiles rebuild whenever the camera-following resident set drops and returns their z14 features (13 desktop / 40 iPhone installs per 3-min pan): pin the detail block's source features while aerial (`setFeatures` / the complete city's ring), a small lane after R4-A. P3 whether to drop the resident detail (~42 MB desktop, 11.6 MB iPhone) from the air. Upload churn (~65 MB/s before R4-A; detail was ~1 % of it, the runtime coarse tier following the camera the rest) is re-measured with the baked tier on (P2, above). P2 `aerialTexturesGrowthPct` red on desktop (+20 %, 45 -> 54 textures). P2 wire a `desktopTextureMB` expect into `crisp-textures.spec`. P2 S2 fuzz owner found (#228, `?cellDebug=rho`): trilinear mip blur at 4–16 texels per device pixel on the near quay walls, not the tier (2–3 % of the band), `cellTierFollow` or the governor. `?windowSdf=1` draws frames, glass and glazing bars analytically and lifts lapVar 5–10 % at the S2 spots at no desktop GPU cost (iPhone profile +1.6 ms at Dam), but adds alias at DPR 2 (+41 % aliasPx) so it ships off on both tiers; decide whether to flip desktop after a look on the user's Mac. Not in the window table: side-entry door glazing, raised-plain basement lights, drawn looks and procedural cells; ribbon/curtain cells get quarter mullions only. Round 2 started 2026-11-06 on the user's word ("do round two"): #228 R2-A analytic window cells merged (HISTORY; flag off, see S2/S3 above), #229 R2-B far shells merged (HISTORY): world format 6 with `far/` SHL1 prisms published, `?farShells` draws the city to the 7 km ring from the air, `?labelAerialCap` skips label occlusion when aerial. Open from R2-B: Step 3 (resident coarse chunks from the baked SHEL stream) shipped as R4-A on 2026-11-07 (#243, HISTORY): SHEL now carries street fronts, thin pairs and the ground lift, one mesh per cell, desktop on, 48.5 MB published; the draws ≤ 400 gate stays report-only (installed street chunks under the landmarks owner are the remaining draws, see the engine look plan). P1 iPhone: the median-window aerial p99 was 50 → 67 ms with 14 far cells after R2-B and is 50.3 after R3-F (emulated profile); measure on the device, and shrink the touch budget or turn the far tier off on touch if the phone says so. P2 buildings replaced by an installed model get no far prism, so beyond the model's load range they leave a gap on the horizon. P2 the prisms are one colour with a mid-height band and no windows, plain where the S4 camera looks past the loaded tiles. P2 `aerialDrawsMax` 400 is report-only (2,008 / 1,524). P2 `tests/e2e/label-occlusion.spec.ts` test 1 ("a POI label behind a nearer building is not drawn") fails on main independent of round 2 (verified at b0ebc84a4 and with `?labelAerialCap=0&farShells=0`): at the STAND pose `throughBuildings` finds 0 POIs drawn across a nearer block with occlusion off (expects ≥ 4) and 1–3 with it on (expects ≤ 1); the spec is in no gate or CI, so when it broke is unknown; re-pin the pose or the helper. The riding test in the same spec passes. Round 3 (2026-11-06, on the user's word "third round please") merged: #232 R3-C rail beds (see S4 above), #231 R3-B band-limited windows + `cellLodBias` −0.6 behind `?windowSdf=1` (HISTORY; desktop default not flipped), #230 R3-A thin fade on by default + SMAA spike off (HISTORY; see S3 above). `?windowSdf` desktop default flipped ON 2026-11-07 (HISTORY; user: "why windows gated?"): quiet GPU-timer read on cf0f9d02e, DPR 2, 6 alternating runs, dam painted 4.98 ms vs sdf 3.98, westerkerk 4.64 vs 4.43, spread 3.1–8.0 ms on identical frames, so the +1 ms gate is met at the median; lapVar +13 % at the user's S2 pose. P1 the touch default (`WINDOW_SDF_TOUCH_DEFAULT`) waits for a measurement on the user's iPhone (the emulated profile read +1.6 ms at Dam; try `?windowSdf=1` on the phone); `?windowSdf=0` restores painted windows on desktop. P2 custom façade mips rejected (`?cellMips=1`, alias +69 % at best sharpness); a per-level sharpness bound tied to the supersampled reference would be the way back. P3 no iPhone aliasPx reading for R3-B. Flags for the user's Mac: `?windowSdf=1` (sharp windows), `?smaa=1` (post AA), `?thinFade=0` (before the thin fade), `?groundView=0` (before the rail-bed fix). The iPhone touch-shell dissolve is in no lane. Labels (#259, 2026-11-08, HISTORY "Labels: road shields once per stretch"): merged; P2 the shield plan costs 17–38 ms (worst 52, 62k anchors at the Stadhouderskade) on the main thread, now run once a second (`PLAN_MS` 1000) instead of four times; cheaper anchors (64 px sampling above zoom 14, or plan in a worker) would let it return to 4 Hz. Round 5 (2026-11-08, user's aerial verdict, plan `docs/handoffs/engine-round5-plan-20261108.md`, lanes #260 R5-A ground aerial, #261 R5-B start settle, #262/#263 R5-C roads bridges and junctions, #264 R5-D bare blocks, #265 R5-E flat roofs, #266 R5-F aerial power; card POI name #258): in flight, merge order B, A, F, D, E, C1, C2; each lane's step 1 is a measurement on the issue before any change. R4-K (#255) pans done 2026-11-08: the baked release fails the A/B memory rule (best −59, worst +1.6 MB; frames worse in one pair), `bakedRelease` stays off, issue closed; P2 the far tier holds ~70 MB resident to 7 km released or not, the next aerial memory lever after the facade atlas (#254). Round 5 status 2026-11-08 evening: R5-F merged (pacing + shadow throttle on, `?aerialScale=1` opt-in awaits the user; P2 cull the trees' shadow twin to the shadow box; P3 iPhone measurement), R5-A merged (3 desktop ground workers; P1 quiet-machine re-measure of the sweep and the aerial pan, P2 shared neighbour fetch cache / start prefetch, P2 "what fills the frame beyond the aerial ring from z16 down"), R5-D merged (pmg spot repointed 2026-11-09 to [4.916, 52.360] bearing 58 (HISTORY "Board small fixes"); P3 texture-aware glass measure over the 62 low-glass installs; kits lane: 378 large kit-plain walls flat from the air). R5-B2 done, hold not shipped (HISTORY "R5-B2"): P1 (#267, lane running) the reveal lighting/shadow step is the largest start pop (10–20 % of pixels in the first ~250 ms, not a tier) — measure its owner (shadow map first draw? tone/exposure settle?) and fade or pre-draw it; P2 buildings/baked re-pend 0.3–0.7 s after the reveal at an unchanged pose (verify the ground-install re-seat guess); P2 start-neighbourhood ground prefetch during the hold (R5-A root cause); P3 the unexplained un-armed iPhone run. R5-E merged 2026-11-08 (HISTORY "R5-E"): roof-facts 0.2 PUBLISHED 2026-11-09 (HISTORY "Roof facts at confidence 0.2 published"; drift was the pand set, not imagery); P2 split pands (`passage:`/`part:`/`tower:`, 418) get no roof fact: group by `pand` in build-roof-facts and fall back to `properties.pand` in the runtime enricher, parts taking slot and colour only; P3 canopy veto for small sheds read as sedum/dark bitumen under trees; P2 the kit-drawn flat roof at pand 0363100012171200 (−33 luma) is the kits lane's; P3 republish the look-atlas-v1 extract (one layer more, refused by length; opt-in only); ExtraSink last-item drop fixed 2026-11-09 (HISTORY "Extras budget charged what a box emits"); P3 flag-off shells (`?flatRoofTone=0&flatRoofSurface=0` is no longer byte-identical under baked shells). R5-C1 merged (HISTORY "R5-C1"): carriageway gap re-measured 2026-11-09 on roads-v1 v3: 176,331 m² (was 205,858; metric comparability unverified), top gaps are off-deck land under the Westrandweg and Vertrekpassage, not the canal belt, P2 re-time the road-building cost on a quiet machine (+70–400 ms per cell measured under load), P3 ribbon slop under kerbed islands (0.1–2.2 m²). R5-C2 merged + roads-v1 v3 published (HISTORY "R5-C2"): P1 the ramp sides the planner marks as shared with no wall (tunnels.ts scanSide; pale sheets west of the east IJ ramp and along the west ramp) — the rest of the user's Rapenburg shot; P2 the trench drawing with sky through it when the rider is far (R5-A, what is drawn far from the rider); P3 the 20-kerb panorama sample; P3 same-class seam dissolve (`--seams`) once the single-polygon runtime rules can take merged polygons. Reveal (#267 + #268 merged, HISTORY "Start reveal"): P2 the ground fallback height (−1.77 m) until the first cells land (start-neighbourhood prefetch, R5-A); P3 gate the other starts; P3 iPhone 5+5 A/B on the reveal-pose budget. Quiet-machine re-measure done 2026-11-08 15:41 on c83bd8657 (comment on #260): ground centre cell 5.7–6.4 s after the reveal, camera block 10–12 s, ring 11–15 s, median worker wait 6–10 s per cell (build 0.5 s, data-in 1.4 s) — P1 check that the three ground workers are active (the wait should be a third of that), then the start-neighbourhood prefetch; user aerial poses: ground visible everywhere, 0–3 cells pending at arrival, install latency p50 6.6–9.1 s; 180 s continuous pan: 0 frames over 100 ms, p99 58 ms, GL max 737 legacy / 662 decoded (budget red, #251). #269 merged 2026-11-09 (HISTORY "IJ-tunnel mouths"): the sheets were at the mouths and the dropped junction lid, fixed; the ramp wall gap is #270, merged 2026-11-09 (HISTORY "IJ-tunnel west ramp bank gap": 48 m east-bank gap bridged, `?rampGaps=0`, pin `ij-tunnel-west-ramp-bank`, city cuts 207); P3 the ramp top from s105 has no right wall (relief < 1.5 m); P3 view the Coentunnel ramp 221380396 change in a frame; P3 hairline sky slivers at the foot of the north mouths (floor quad under the mouth in cutMeshes); P3 tunnel plans depend on preparation order. Card (#258) merged 2026-11-08 (HISTORY "Building card: a tapped POI label"): label tap finds its pand, merged 2026-11-09 (HISTORY "A tapped POI label finds its pand"); P3 show the pand's article text under the POI name on a label tap; P3 data fallback (point-in-footprint on the z14 tile) when the label anchor is hidden behind a nearer building; P3 try a label tap in a real ride on both engines; `check-click-poi-info` fake host fixed 2026-11-09 (vectorMap, facts and article stubs; passes again). Ground start follow-up (#260 continued, merged 2026-11-09, HISTORY "Ground start, round 5 follow-up"): hold prefetch + pull dispatch + affinity + queued-install fix on; integrator same-chain centre 2.6–3.1 → 1.6–2.6 s, median worker wait 3.8–5.2 s → 0; step 3 merged 2026-11-09 (HISTORY "Ground start step 3"): shared decode built and parked OFF (`?groundShare=1`; bytes were not the owner), level-bound affinity + block-first dispatch on (block −0.5–1.5 s same start); step 4 merged 2026-11-09 (HISTORY "Ground start step 4"): banded water test on (`?groundPlanShare=0`), data-in −0.5 s per LOD 0 cell, meshes identical; P1 still open on #260: read block ≤ 6 s in the load 7–10 band (step 4 measured at 12–15), then the build itself (roads 0.4–1.1 s, survey markings, pack) and repeated neighbourhood planning; cell determinism merged 2026-11-09 (HISTORY "Ground cells are deterministic": 30/32 → 1/32 cells differ, `?groundDeterministic=0`); P3 cell 3_3 (Amsterdam-Noord) park −26 tris after neighbours, cause unknown; P3 long-cut (> 450 m) and bridge-group edge cases beyond the 3×3; P3 run probe-cell-determinism.ts as an occasional audit (~6 min); P2 block-first pan reading: two alternating 60 s pairs on 4bf54acbd under load (#260 comment 2026-11-08 night) gave GL and median-window p99 flat, whole-run p99 mixed (84→125, 117→109 ms), frames > 100 ms 3/4 → 6/6; re-run quiet, and if the extra long frames hold, space cell installs when block-first lands two LOD 0 cells in one window; P3 probe warns when `prefetchAt` is null with groundPrefetch on; P3 probe should ignore rows before the first game update (`groundQuick=1` artefact). Blank-install audit merged 2026-11-09 (HISTORY "Blank-install ride audit"): Balboaplein 48 + Revaleiland 437 pinned; P2 re-look at the 17 UNSURE installs with `BARE_ZOOM_ADD=1` (ids in HISTORY) and pin or clear each; P2 fix the recipe materials on the two new pins (roof in wall colour, filled courtyard) then unpin; P3 check whether the 8 installs that look identical to generic at the pose draw in the baked aerial tier at all.

**Next neighbourhood kits (user, 2026-10-26):** in order De Pijp, Oud-West (Kinkerstraat/Bilderdijkstraat), the Jordaan, Oud-Zuid, then Dapperbuurt and Indische Buurt. Use the #81 block-face kit method. No more outer-estate rounds for now.

**Transvaalbuurt round 6, next (rounds 1–5 in HISTORY "Transvaalbuurt kit", "round 2" … "round 5"):** 79 pands installed in 27 runs, 17 types. Highest-value items: (1) a plinth or foot offset on the model (the Tugelaweg 1929 block's front stands 1.9 m above 3DBAG ground; the strip-foot read in `stripFoot.ts` only aligns the photo), then the grouped band windows and the stair panel position of `transvaal-1929-block`, which releases Tugelaweg 95–118 (7 pands over the gate, held at gallery size); (2) a porch projection beyond the 0.5 m grouped-frontage cap, which releases the 1922 loggia rows (12 pands, type and loggia kit part are in); (3) a patterned-brick material for diaper brick (Schalk Burgerstraat reads greyer than the photo) and canted blue-framed corner oriels; (4) the gateway arch with a raised centre bay (Schalk Burgerstraat 79–97) and the 1923 design's stair-only and window-only BAG pands (Schalk Burgerstraat 18, 28); (5) the remaining designs without a type: Transvaalstraat 131–143 (window pair + small window per storey, 7), Krugerstraat 5–27 (point gables with a tall tower), Afrikanerplein 1–23 (band windows, arched portieken), Christiaan de Wetstraat 116–272, the 1915–1919 (58) and post-1931 (99) pands, Hofmeyrstraat 24–44 (compressed strip). Ground-only patches for Eerste Jacob van Campenstraat 8 (bicycle rack → shop) and Bloemgracht 158A/162 (charging station, parking space) if wanted: the #157 pattern (HEAD intent + the one pand's groundFloor and type.ground). `bilder-157757-164549` still carries the rake overlap `roof.rakeClear` fixes. The 174 Transvaalbuurt faces without a usable strip need a second panorama pass (other capture dates, lower obliquity) before anything else can place there. The face split at bends (`buurtFaces.ts`) also changes faces that fail intake today in Bloemgrachtbuurt and Kinkerstraat; their survey JSONs were not regenerated.

**Museumkwartier round 2, next (round 1 in HISTORY "Eleven landmarks and Museumkwartier round 1"):** 30 pands in 6 rows, 6 types; the five buurten hold about 2,000 pands and no existing library fits them. Highest-value next types: the orange banded two-axis wall-dormer row (Van Breestraat 39–45, 53–55, 71–77, ~12 pands), the Valeriusstraat 1903 keystone/speklaag rows (~30 pands, blocked: buff brick reads as foliage in `isLeaf`, so likeness abstains), the Valeriusstraat 1905–06 balcony/oriel rows (11), Nicolaas Maesstraat 35–45 voussoir-block cornice (6), Wouwermanstraat 34–26 brick-oriel design, Palestrinastraat 12–22 mansard row, CG Van Breestraat 21–31 banded fronts with white oriels. Kit gaps the lanes named: step gable on plumb shoulders, gable volutes and cartouches, attic dormers between gables, arched gable lights, moulded corbel friezes, carved dormer crests, a hood over a mid-front oriel, wide bracketed balconies (drawn as balconettes), open baluster parapets, alternating voussoir blocks, `frontEavesFor` adopting the parapet skyline as eaves. Check the Nicolaas Maesstraat 47–61 wall tone in the ride (it reads grey against the strip's brown brick; exposure gain 1.29). The Hondecoeterbuurt placement records predate `museum-jv-1910-lintel-parapet`; a re-run is safe now that #157's frozen runs are in. Then P.C. Hooftbuurt (310), Banpleinbuurt (238), Harmoniehofbuurt (146), Staatsliedenbuurt (1,792).

**Landmark follow-ups (2026-11-01):** Barlaeus Gymnasium's 1885 sandstone front (pand 0363100012169565, "ANNO GYMNASIUM 1885" with its sculpture group) has no model; the installed `barlaeus` recipe is the 1866 building next door (facts in source-data `landmarks/barlaeus-gymnasium/`). Lensbomen: the glass-grid mullions and a measured lens tint. Droogbak: mansard tint (#4f5459 from panoramas vs #aeafab–#c3c3be on the orthophoto, probably sun on metal). Het Nieuwe Huis: curved bow windows and rounded balcony ends on faceted shells, patterned brick, the clock on the sloping 3DBAG plane. Amstelstation: curtain-wall mullion hierarchy (the rhythm gate splits a 0.29 m mullion into four runs), mixed-case sign lettering, sloped forecourt. ABN AMRO: curved cantilevered glass volume, leaning granite plinth, multi-pane window units in the pier grid. Wolkenkrabber: canopy-band corner wrap, the Deltastraat flanking blocks, the Berlage statue. Blind facade counts owed for all eleven (the lanes counted their own elevations). Tooling: `ingame-capture.ts` draws the model without the city (every lane's shot shows bare ground), and a `demo-shots` cockpit spot does not face its centre; fix one of them before the next landmark round. `roof-prism-kit.test.ts` is not in any npm test script. Round 2 (#172–#176): Het Marnix and the Bungehuis render lighter/beiger than the photos (tint review at gallery size; the Marnix pool box should read aluminium, the Bungehuis stone grey-brown); `scripts/landmarks/facade-compare.ts` closing radius is `Math.round(0.15/0.1)` = 1 cell (0.15/0.1 is 1.4999…), so 0.22 m piers split openings and De Burcht reports rows 8,8,8,12,1 against the photo's 4,5,4,5,1 (fix the rounding to the documented 0.3 m and re-run every model's compare before trusting the change); the Openluchtschool gate-passage bridge with its OPENLUCHTSCHOOL lettering stands outside both pands and is not modelled; Herengracht 540 (also Waldorf floor space) is not modelled; `idfa-pavilion` (the Vondelparkpaviljoen) has no inventory file and no VONDEL CS signage, worth a look-review; `audit:glb --only=` is silently ignored (the flag is `--id=`), make it error.

**Garden rooms follow-ups (#169 merged 2026-11-01):** the kit (`src/canalRecall/gardenRooms.ts`) only fires for 226 of 5,513 centre sheds (BAG year ≥ 2005 or a measured white-membrane/glass roof slot at ≥ 0.6, and ≥ 6 m²; sedum dropped because every sampled pre-1990 "sedum" lid was tree canopy). Only 17 are in the ring/Oud-Zuid boxes; most rebuilt garden rooms on older pands stay grey sheds because no open signal separates a rebuilt room from an old shed (try: 3DBAG roof height vs. BAG year, AHN point density, Beeldbank garden photos). Orientation is rule-based (glass toward the nearest front street, never a party wall) and unverified per parcel. Black-family glass (#35464f on #2a2a28) reads nearly black at distance. The kit cannot say: pitched/lean-to rooms, pergolas, decks, fences, hedges, sliding vs bi-fold fronts, roof lights, a real 7 cm slat pitch (joints ≥ 0.22 m). Rooms are ~10 px from the ride camera; the change is judged at close zoom (`tests/e2e/garden-rooms-shots.spec.ts`, which hides the MapLibre placeholder extrusions and takes the renderer camera).

**P2 — Held-camera specs on `settleWorld` (2026-11-07, HISTORY).** 45 e2e specs still hold the camera with `vectorMap.sync = () => {}` and their own settle loops (block-face, look-consistency, swap-zfight, street-chunks, …); on the default desktop look their frames can catch baked coarse cells mid-dissolve over hidden runtime chunks. Move each to `settleWorld(page)` from `tests/e2e/helpers.ts` when it is next touched, or in one sweep, re-baselining any golden that changes.

**P1 — Street furniture follow-ups from the container re-model (#212, re-shape and rows 2026-11-07, HISTORY).** (b) `ride-perf.spec.ts` fails under `ENGINE=own` ("Cannot read properties of undefined (reading 'bind')", its `map.fire` instrumentation); the own engine needs its own perf route with GL counters. (c) Rest tops beyond drum and flap: the register's `typeId` names the bin underground (3–7 m³, 1338 / 1380 / 1340 ">2022", Sidcon press), not the column, and 20 readable random panoramas showed the same two tops on every type (2026-11-07, HISTORY), so drum vs flap is a 30 % per-cluster hash. Open: the nine "4m3 KHC Rest Semi" semi-underground boxes (107708 is one: a tall wide box with a window) have no model; of the ABOVE_GROUND rows only the Engels BG boxes are drawn (`container-bg`, 895), the 146 "Tuinkorf" garden baskets and 37 Weesp GFT bins are rejected; BG boxes in a mixed cluster share the column's row axis, unchecked against panoramas beyond 189468/203765/216117; GFT and textile columns still draw the drum. The litter bin model has no placement source (no open register). (d) Per-face sheen and the hole collar: one shared vertex-colour material cannot say them. (e) The front sticker variant (white instruction panel with the green mascot) is not modelled. (f) iPhone frames of the aligned rows and raised plates not yet taken.

**Landmark programme resumed (user 2026-11-06 23:10: "use the landmark skill we wrote to finish stedelijk if not done, and the next top twenty landmarks please").** The landmark-lane factory skill ran first (#234, merged): its buildable list is exhausted (triage 317 candidates: buildable 21, all previously held; kit-gap 124, no-evidence 94, not-in-tiles 45, covered 22, bespoke 11), so the next twenty went to four bespoke opus lanes from the wide targets report plus the unstarted 2026-11-05 picks: #235 centrum (Oude Turfmarkt 139 range, Weteringschans corner office, Barlaeus Gymnasium, the C&A block, DoubleTree Centraal), #236 west (Kinkerstraat 89-105, Politiebureau Postjesweg, Ibis City West, Plein '40-'45, Andreas Ensemble), #237 zuidas (ABN AMRO HQ, Atrium, Symphony II, Xavier, Sint-Nicolaaslyceum), #238 oost-zuid (Belastingdienst, Dominicus Savius school, Forum, De Valerius, Amsterdams Lyceum); briefs `docs/handoffs/lane-landmarks-<name>-20261106.md`, hand-back 09:00 CET. Round 5 so far (2026-11-07 03:30): all four lanes merged: #236 west, #235 centrum, #238 oost-zuid, #237 zuidas (nineteen landmarks plus the Symphony rebuild, HISTORY "Landmark round 5"; ABN AMRO HQ was already modelled). Next landmark picks: the Oosterdoksstraat 114 / Conservatorium complex (the mis-pointed "DoubleTree" backlog row), then re-rank the backlog; Zuidas follow-ups: Atrium sloped atrium glass grid, Symphony alternating fin colours and panes in the fin slots, Xavier ironwork balconies, tenant logos. Oost-zuid follow-ups: the Lyceum pavilions' rounded corners and frames (opening-overhang check on the west pavilion's SE face, which the blank-wall detector also misreads), the Boekhuis glass ends darker than the photo, Valerius NW/SE ends inferred. Open from the merged lanes: the installed `allard-pierson` sits on pand 0363100012165686 while the BAG gives Oude Turfmarkt 127/129 to 168172, nothing draws twice, check in game which is right; the backlog row "DoubleTree" (rank 3, 21 routes) points at the Oosterdoksstraat 114 / Conservatorium complex, unmodelled, own lane; the Andreas Ensemble rectified heights disagree with the 3DBAG roofs (x1.15 north, x0.893 west; 3DBAG kept, an aerial would settle it); the C&A block has no rider before/after pair (every tried chase pose is behind other buildings). P1 next kit lane (the factory's top blocker by ride visibility): a storey-1 shopfront/ribbon band under punched storeys, 28 pands, 6.06 M visibility (`docs/handoffs/kit-gaps.md`, 2026-11-06); then painted/clad dark fronts (44 pands) and other band fronts (28). #125 (`needs-david`, the tower triangle budget: Anadolubank 123762 passes both fronts at 13.1k against the 12k cap) still waits for the user. #239 door reveals round 2 merged 2026-11-07 (HISTORY): 16 of 89 types carry a measured reveal, 36 read flush, 22 have no usable evidence; 17 faces reinstalled, 7 held (zaanhof-23-34 and -71-78: end-door leaf outside its wall silhouette, cause unknown; bellamyplein-18-38-r1/r2, hasebroek-2-46-r1, evertsen-145-155 and -152-160: audits fail on main's code too), so P2: fix those audits, then `compile.ts --face=<id> --install` (their types already carry the reveal); kit gaps: directional light in the cavity, Zaanhof springer blocks and pier widths, the Steyn canopy slab, corbelled arched heads (Helmers 1900, Evertsen 1939), portiek floors, loggia shading. History of the pause:  Lanes #208 and #211 finished their first landmarks (merged, HISTORY); their second landmarks are NOT started: the Oude Turfmarkt 139 range (pand 0363100012168172, recipe `ordinary-0363100012168172`; the BAG puts the Allard Pierson address 127/129 on it, check the overlap with `allard-pierson` first) and Kinkerstraat 89-105 (pand 0363100012092013, recipe `ordinary-0363100012092013`); their worktrees are pruned; the uncommitted briefs, footprints and inventory skeletons are kept in `map-recall2-worktrees/_pruned-sheets/landmarks-{binnengasthuis,kinkerstraat}-20261101/untracked/scripts/landmarks/`. #210 finished Westerdok 748 (merged, HISTORY; Politiebureau Postjesweg not started, pand 0363100012092810, recipe `ordinary-0363100012092810`); #209 finished the Tetterode complex (merged, HISTORY; Weteringschans corner office not started, pand 0363100012184747, recipe `ordinary-0363100012184747`). #221 (the full Stedelijk, the Albert Heijn Museumplein, the service tower) merged, HISTORY 2026-11-06; its follow-ups: the tub's smooth bottom crease (piecewise-linear now), the wing roofs' glazed lantern band (north-light sheds), the NE pavilion's zinc-and-glass ribs, scroll volutes as steps, the central parts' corner obelisks, red/black dormer shutters, the tub's oval eye window; AH: the brand script, the garage ramp and P pylons, the kiosk's light strip, the fascia's sharp tip; the ride spot `ingame-capture` draws no city on its first run (use a second run). Also at the user's request ("first batch + stedelijk + kiosks"): #226 small fixes merged (HISTORY 2026-11-06); #227 kiosk holds merged (HISTORY 2026-11-06; follow-ups: a landmarkId for bloemenmarkt-stalls, square extract_squares_1178315948 exists; the tree-layer tree over Ramon's; BEA's sedum roof reads grey because the roof look recolours slate). Still-unstarted picks: Politiebureau Postjesweg, Weteringschans corner office; all were bespoke replacements for likeness-failing recipes via SHADOWED_BY_LANDMARK (wider re-run `docs/reports/landmark-targets-wide-20261102.json`, 160 rows, is exhausted: Scala, Argentinie and Xavier are weak picks); next from the likeness judge by FAIL count: oba-olympisch-kwartier (7), sint-nicolaaslyceum (4), haarlemmerweg-325 Q-Park Westergas (4), valckenierstraat-65 Roeterseiland (3), balboaplein-48 (3), tilanusstraat-23 (3), schaafstraat-17 (3); the well-known-name grep of 2026-11-02 found nothing else iconic missing (Hermitage is in as H'ART, Bimhuis in manualModels); Sarphati Plaza follow-ups: tenant signs, the inferred west and garden faces, move its face code onto `cut-face.ts`; Apollo Hotel: glazed bay cheeks (sub-metre faces fail the opening-host rule), the red-framed conservatory, flags and masts; The Edge follow-ups: tenant signs over the doors, atrium glazing bars, ground-floor doors; AkzoNobel: inner windows behind the east skin, the stair-shaft band, roof solar panels; De Makroon follow-ups: the front setback terrace, the other slate slices on the canal face, awnings and shop signs; Pakhuis Australië: orange balcony panels, shop signs, darker wing red; Tolhuis: timber ground-floor cladding, diamond hall cladding, rounded NE corner; Y-Helling: murals, mesh railings, twin stair flights, a sloped-top holedWall kit piece; Graansilo: lighter reflective glazing with pale frames, varied plinth openings; concrete silo: cooler formwork-grey concrete, white ground-storey glazing grids, rounded canopy corners, check the glass shaft between the silos in-game; Effectenbeurs: pediment figures are flattened stand-ins; Het Sieraad: Krop reliefs as flattened figures, balcony ironwork plain, flagpole holders; KPN Teleport: 15 risers against the photo's 11 (3DBAG average ground), north-face doors and roller door, verify the XS4ALL and kpn roof signs still exist, blind re-count of its facade rows; Remise Lekstraat: rounded oriel (needs a round `bayPrism`), track numbers, roof rail, catenary, the Amsteldijk 153 gatehouse pand; Film Academy: slatted undercroft gates, roof plant pits; geometryAudit clusterWalls seeds a plane from the first triangle it meets and can capture an adjoining wall through a reveal within 3 cm or split a long front on a quantization-tilted piece (Westerdok 748, Tetterode; builders emit faces largest first / cut walls before trim as workarounds; fix the seeding, e.g. seed from the largest triangle per plane); the audit treats any small all-white part (dormer, console) as a loose opening, so painted-white trim is drawn cream (Tetterode, Oudemanhuispoort); Rietveld 2006: see-through mesh, angled shutter leaves, real dimple pitch; holedWall: open a hole across a shared corner (glass wrapping on a mullion, Politiebureau Oost); Hofkerk: carved pelican, mosaics and Madonna figures, Sacred Heart statue on the lawn (sculpture track); water tower: casing joints, antennas; add hofkerk to the check-landmark-attachment case list (its full run fails on american-hotel already); Heinekenplein block: the real Heineken script logo, expansion joints, Dirk decals, a back panel on the P sign; Rietveld building: concrete frames behind the glass, blinds, the round facade ventilators, a shared banded-curtain-wall kit piece; next bespoke replacements from the likeness judge: Politiebureau IJ-tunnel walls (already shadowed by fire-station-nico), Heinekenplein block, politie-postjesweg, politie-oost-watergraafsmeer; next from that report: KPN Teleport (22, pand 0363100012165158, Sloterdijk 2014), then re-rank the report for what is left; Autopon follow-ups: darker loggia recesses, double-height outer cells on the Zocherstraat top storey; Joodse Invalide: winged shell-roof edge, 1979 rear galleries, a reusable steel-window kit component; Byzantium follow-ups: full fire-escape stair, tenant signs, lighter reflective tower glass; Burgerweeshuis: timber doors, window frames on the brick modules, round roof lights; Haarlemmermeerstation is already installed. WTC wing blades: rod-and-cable lattice (the grey-in-shade read matches the photos, #226). `audit:glb volkshotel` fails on main (window-rhythm 1 off-size vs baseline 0, from an earlier re-export; #226 left it): re-measure w03 or fix the export, never raise the row. The city look's flat-roof tint (`cityRoofTint`, palette.ts) knows only bitumen and warm gravel, so every light flat roof without a measured tint renders tan (Ziggo fixed by a measured slot tag, #226): a look lane should add the pale membrane case. Factory queue rows still name the retired houses passeerdersstraat-242951, beursplein-5-165051, pand-233585 (owner's rows). Optional: Ziggo `materialOverrides.slate` #e8e7e3 in manualCatalogue.json for views with the city look off. Kit wants lowercase glyphs for signs (VU hall, Zonnehuis). `check-landmark-attachment.ts` crashes on a below-ground assertion for american-hotel (pre-existing, lane #190). `facade-compare.ts` cannot count panes split by slim mullions (planetarium notch face, 5 photo panes read as 1): add a curtain-wall mode or a smaller closing radius for glazed fronts. Kraanspoor follow-up: a translucent louvre skin material for the box (reads as a blue glass grid now). Merged and pushed: #170, #172–#176, #180, #181 (push 9a3350222); round 3 #182, #183, #184, #186 pushed in 1ae23e82c; #185 pushed in 3677cf3c5; #187 pushed in 4d2d051be; #188 pushed in 8c9f3fdd4; #189 and #190 pushed in 0d651f2cf; #191 pushed in 529ee72ee; #192 and #193 pushed in 7bd10b913; #194 pushed in d793b6ab1; #195 pushed in 5580cc7dc; #196 and #197 pushed in 289bcd5fc; #198 pushed in 3272c57e2; #199 pushed in ca5215966; #200 part 1 (Graansilo) pushed in 8721880ef; #200 part 2 (concrete silo) pushed in b1739fc8b; #201 and #203 pushed in 6018981a6; #202 pushed in aad4e94be; #205 part 1 pushed in 324a923b9; #207 part 1 (Heinekenplein block) and #204 (Hofkerk, water tower) and #206 (two centre police stations) and #207 part 2 and #205 part 2 pushed in e57e0d2b6; #208 part 1 and #211 part 1 pushed; #210 part 1 (Westerdok 748) and #209 part 1 (Tetterode) merged locally (HISTORY). Round-3 follow-ups: `review-sheet.ts` needs the `--ignore=` option `landmark-brief.ts` got so the Carlton's 52 m front gets a sheet row; the Carlton oriels project only 0.75 m and read weakly from the game camera; the Citroën colonnade recess is not cut into the shell (kit cannot cut loggias into a 3DBAG shell, nor curved bays on a faceted ring); the Doelen corner bay is a flat window on the curve's tangent; carved relief and painted figure sculpture are still bosses and plain stone.

**Follow-ups from the night (2026-11-02):** Blauwbrug south-sidewalk deck surface (register outline covers −6..+19 m, span is ±10.7 m; set the bespoke BRU0236 profile sides to the model half-width in `groundStore`/`decks`); `facade-compare.ts` closing radius; Magere Brug fixed spans are flat because the game deck is flat there; street furniture: the 2020s wide container box, straight-arm poles, abri glass, benches (593) and bollards (69) from BGT, cartoon/storybook tinting; door reveals: darken the inside of a cavity, arched reveals, per-house/shopfront grounds, Steyn 1928 depth, helmers-79-97-r1 slivers; `own-ground-bridge-fidelity.spec.ts` may still expect kit arches at BRU0236/BRU0242; `bespoke-bridges.spec.ts` is not in the e2e set (4.4 min per project).

**White roof near Nieuwe Westerdokstraat (user asked 2026-11-01, open):** not identified; every wedge pand around Haarlemmerplein and the Westerdok reads slate in roof-facts, no near-white `roof:colour` tag there, the two OSM-only wedges fall to the grey prior. Flat lids go white through the `white-membrane` slot (5,661 pands citywide, `palette.ts` band #d9d9d3, luma to 228) or a near-white tag (667 features); if that is the cause, cap the slot near #c4c4be and pin the pand. Needs the rider's position.

**Large-recipe roofs after the tidy step (#87).** `roof.tidy` is merged opt-in (HISTORY 2026-11-09) and too mild for the flagged houses. Open: enable it with evidence on the spike-heavy houses (Westerdok 24 spikes, Hotel Arena 13) after a card review, then fit-golden/large-mesh hashes `--write`, re-export, covers; Van Eeghenstraat 97-101 needs a front-measured pitched roof behind the step gables; Warmoesstraat garage needs a measured deck-level override; slivers stay separate triangles until a plane-merge/re-triangulate step exists.

**Usage pause 2026-10-25 (95 % weekly).** Lanes in flight, their state, the
next step for each and the integration checklist: `docs/handoffs/inflight-20261025.md`.
Read that first.

Plan `docs/plans/thousand-buildings-20261023.md`; rules `docs/handoffs/LANE-RULES.md`;
one brief per lane in `docs/handoffs/lane-*-20261023.md`. Census baseline
2026-10-23: 386 counted (grandfathered gallery reviews), 47 strict; target
1000. Queue `public/canal-drive/landmark-factory-queue.json` (325 rows).
Open, in order:
- **factory**: batches 1–2 (28 houses) compiled and reviewed twice, 0 pass;
  the user chose "kit first" (#23 A). Row split, stone dressings, giant
  order, loggias/plinths and the likeness fixes have landed; the acceptance
  re-run of batches 1–2 on the new kit runs as #45 (new batches resume at
  ≥ 50 % pass). 265 rows have crops and wait; 11 `needs-pand`, 19
  `no-evidence`, 2 `error`.
- **kits-review**: round 4 done 2026-10-24 (421 kits: 110 pass, 172 hold,
  139 no evidence; census 496). 13 regressions from the measured windows
  and roofs are in fix lane #43; gaps in `docs/handoffs/kit-gaps.md`.
- **feedback queue (Firebase, 8 open notes 2026-10-23, pulled with
  `npm run feedback:queue -- pull`)**, routed:
  - gables pointing the wrong way (74dc761d): fixed 2026-10-23 (HISTORY,
    `streetRidge.ts`; 13 → 1 at the spot). Open: rear wings of L-shaped
    pands still run along the street (interior ends); single-saddle turns
    go up to 14 m (`TURN_MAX_FRONT_M`, maybe split from ~10 m); the user
    looks at the Marnixstraat frame after deploy and closes the note.
  - got stuck at the Centraal ferry pier (05a7d02a): fixed 2026-10-23
    (HISTORY; three faults, e2e `ferry-centraal-pier.spec.ts`). Open: the
    iPhone project of the ferry specs was not run; the user rides it after
    deploy and closes the note.
  - Free Ride vessel held against De Ruijterkade 61 m from the Centraal pier
    (user, 2026-11-09): fixed 2026-11-09 (HISTORY "F3"; lands at any quay
    with a street; `ferry-free-ride.spec.ts`, pins in `check-canal-car.ts`).
  - stuck on the Javaplantsoen park path (user shot, 2026-11-09, build
    ef73a29): safety net 2026-11-09 (HISTORY "S4"; turn-round after 1.5 s,
    named regression in `check-canal-car.ts`). Open P1: lane D2 #322
    re-admits the 1,172 dead ends' dropped footways to the bike graph —
    done 2026-11-09 (HISTORY "D2"; the end itself is steps, the turn-round stays).
  - ferries stuck a few metres out (user, 2026-10-31): fixed 2026-10-31
    (HISTORY; launch towards open water, no stranding on a touch,
    street-follow cruises on water; `ferry-launch.spec.ts` boards at all 12
    piers). Open from the same probe: from the `?ferry=F3` land access,
    holding forward on the keyboard rides off along De Ruijterkade instead of
    boarding (the road guard turns the bike onto the quay cycleway short of
    the stop); street following stands at the pier end "awaiting a choice"
    instead of rolling onto the ferry (streetFollow.ts treats the access end
    as a junction with no way on). Both need a boarding rule: at a pier end
    facing the water, forward boards.
  - wiggly green patches on J.D. Meijerplein (53b04137) and the user's
    Spiegelgracht × Prinsengracht frame (one brown klinker mass, no kerb or
    sidewalk tone, red cycle fragments): added as spots to R0
    (`lane/roads-diagnose-20261023`); R3 gains a function-aware tone (voetpad
    lighter/greyer than rijbaan, kerb line at their edge).
  - ATD roof hole (44bb1126): fixed 2026-10-24 (the 26–28 m roofs ran past
    the recessed core; their open northwest edges are closed). Rembrandtplein
    crumpled roof (0132871b): it is Utrechtsestraat 15 / Booking.com, large
    recipe `utrechtsestraat-15-169214`; new opt-in kit pass
    `roof.levelRooftop` (`buildingRecipe/roofLevel.ts`) flattens the 3DBAG
    rooftop above the photographed fronts; reinstalled with the walls' 2026-10-14
    inferred status carried. Kit cannot yet say: the lower set-back pavilion's
    jagged outline, the copper-framed glass pavilion, recessed attic floors.
    Nassaukade wedge (ba8499fa): fixed 2026-10-24. It was Nassaukade 171
    (pand 153093), a generic worker facade whose seeded roof pick was
    `halfHipped` (5 % odds on narrow c19 plots); the half-hip's bare street
    end read as an orange wedge between the crowned neighbours. `planRoof`
    now turns an unmapped half-hip on a plot at least twice as deep as wide
    into a gable (`narrowHalfHip.test.ts` pins the footprint); mapped
    half-hips, shallow row houses and villas unchanged.
  - Centraal from the IJ side needs real work (091d8bb3): deferred, a bespoke
    `centraal-station` session (north facade, bus platform roof); Living by
    Numbers (1c5d9c04, sculpture POI 264245976): deferred to a memorial-kit
    turn. Both carry the deferral in Firestore.
  - z-fighting on statue bases (user, Anne Frank Merwedeplein): the audit's
    0.25 m² warn never fires on a 12 m² statue, so a 0.2 m² tie that is the
    whole plinth top passed. 2026-10-23: the warn now scales (0.5 % of the
    visible surface, floor 0.05 m²). What shows on that model is the near
    band (the bronze plate's top 5 cm over the red cap, 0.21 m²), which the
    audit calls safe from the driving camera (calibrated 2026-10-13: ≥3 cm
    never bleeds at 900 m) but the card/gallery camera draws differently:
    measure with `zfight-validate.ts --ids=anne-frank-merwedeplein`, then
    either lift the near-band gate for small models or fix the gallery
    camera's near/far. A resting part's opposite-facing underside cannot show
    (its own top covers it), so that class is not gated.
- **identity**: done 2026-10-23 (strict rule, 46 % of the top 250 named with
  a URL, 100 queue rows named; the 70 % gate is not met). Open: review the
  27 OSM objects shared by several pands (`identity.sharedWith`), the name
  "A" on two rows, and whether address-only rows should get a POI card
  without a name.
- **bagtiles-default** (S1) → **recipe-tiles-default** (S2, needs the 5 cm
  width quantisation and the `kind: glb` conversion) → **citylook-relevel**
  (S3, user strip). None started. Re-level note (#76): lift chunks and GLB
  slots together or city-look parity breaks; recipe tiles on before the
  city look lack the 1.106 brick gain beside default-look chunks.
- **district-style** (B1), **buurt-autoplace** (B3). **buurt-designs** (B2):
  10 buurten done 2026-10-25 (#70, #72, #74; ~4,350 houses, 22 designs);
  rounds 4-8 done (#75, #77, #79, #80, #82; 31 buurten, ~8,900 houses); Helmersbuurt block-face kit (#81) done, 33 houses (rest of EU03 not attempted); round 9 (#85) merged, 1,525 houses; #86 merged: Da Vinci installed, Waterkeringweg 7 held for better views; Haarlemmerweg 333 (#83): Carpetright installed, Nieuwpoortkade 2 installed via #86, Waterkeringweg 7 held; white trim and
  one-draw-per-unit done (#78). Open: nn-row chunky joinery (`frameM`);
  opt-in recipe tiles need recompiling from the recoloured units; Gein 3 all-timber and
  brick-canopy rows, Holendrecht S2/S4, Twiske porch canopies, K-buurt
  yellow-door/buff rows and orange-variant mottle.
- **roads**: R0 done 2026-10-23 (HISTORY): R1 gaps is the largest cause at
  all ten spots. R1 merged 2026-10-24 (#12, eb2902118, perf session):
  BGT islands/berms/verges/squares fill bare land beside carriageways;
  bare land at ROAD_SPOTS 3,775 → 888 m² (−76 %), Mosplein centre green
  with no red; city-wide ground triangles 99.6 M → 90.2 M; ride-perf p95
  16.8 ms unchanged. The roads-on/off triangle check is still red in 4 of
  291 cells (10_4 1.252, already 1.231 on main; -1_1 1.206, 11_4 1.174,
  1_0 1.155) and the build-time ratio is 1.52 (1.42 on main, bar 1.3);
  neither is in check:canal. Metric question on #27. Spiegelgracht keeps
  ~500 m² of paved corner outside BGT road classes.
  R2+R3 merged 2026-10-24 (lane/roads-lanes-20261023 @ 3587416d5): OSM
  bands yield per 1 m station to any BGT polygon, lane ribbons only where
  no BGT cycle polygon and the orthophoto shows red, LOD 1 draws one plain
  carriageway; marks from a photo-evidence extract
  (`road-marks-v1/photo-evidence.json.gz`, PDOK 8 cm): zebras merged
  within 8 m and moved or dropped by the photo, centre dashes only on
  photo runs, grey fietsstraten as asphalt. Doubled-lanes probe 162 → 0 at
  13 spots (gated in check-ground-cells), paint off a node → 0, ride-perf
  unchanged. Bare land rises at De Clercq (+82 m²) and Spiegelgracht (+45)
  where OSM bands hid BGT gaps: R1's job. OPEN, user decides: klinker /
  brick / cycle tone from `demos/roads-20261024/strip-tones.jpg` (today
  147,110,90; A photo 137,126,118; B middle 142,118,104; C legible
  140,124,112). Previous note on R2+R3 for reference: De Clercqstraat's fallback band and red pieces,
  the `cycleway=lane` ribbons, a less saturated klinker/brick tone measured
  from the orthophoto medians (rijbaan klinker 143,137,133 vs today's
  147,110,90), the Spiegelgracht red ring and zebra bits west of the
  junction pinned as a spot; the user decides grey and red on the strip.
  Also: the Dokwerker card shows while standing on the Rembrandtplein
  (landmark placement, content lane).
  **Zebras and the Muntplein, left open** (shipped 2026-10-30, HISTORY
  "Continuous zebras"): the Muntplein S zebra is planned along its stripes
  instead of across them (surveyMarkings orient/roadDirOf at that node), so
  evidence cannot confirm it; zebras wider than 4 m (Muntplein S is ~8–10 m);
  faint zebras in deep shadow can drop; 604 `short` rows remain (island
  breaks, nodes on one lane of a dual carriageway; +2 at 4.8364,52.3515 since
  road look B, not investigated); the Muntplein klinker band (road look tone);
  7 BRU0001 parapet posts remain. Game frames for the Arcam/Muntplein spots
  with the new evidence were never shot (Playwright lock); shoot them on the
  next ride review.
  **Road look, continuity, left open** (shipped 2026-10-30 as look B, HISTORY
  "Road look continuity"): the kerb edge is under 1.5 px on desktop at far
  junctions (an `fwidth` ground-shader edge was not prototyped); the east kerb
  at the Witte de Withstraat shows no shadow dip; road-way `cycleway=track`
  sides are not bridged at junction mouths; the red band is 2 m on the OSM line,
  not the BGT fietspad width (a thin dark sliver at the Witte mouth); tram rails
  use one offset per way, so tracks that wander against the OSM way (Witte
  ±1.9 m) need rails drawn from BGT spoor lines (new extract).
- **build-hash-skip**: done 2026-10-23 (3 s no-change run). Open: four
  committed GLBs (compagnietheater, levend-paardenmuseum, mountain-network,
  pathe-de-munt) are not reproducible from current source; 8 haparandaweg-*
  ids are external to the driver; duplicate catalogue ids
  (johnny-jordaan-groep ×6, theo-thijssen-standbeeld ×5,
  carmiggelt-borstbeeld ×4, winkler-prins-monument ×3) rebuild on every
  full run.
- **audit:glb sweep (2026-10-24)**: 352 models, 156 pass, 196 fail a hard
  gate (detached 99, holes 57, opening-outside 55, zfight 53, zfight-tight
  44, see-through 29, far-outside 25, overhang 21, rhythm 20); 74 models
  grew past `geometry-audit-baseline.json` (111 rows: zfight-m2 32,
  opening-outside 24, opening-buried 23, zfight-tight 20, overhang 10). The
  baseline is dated 2026-10-13 and 54 of the 74 GLBs were regenerated
  2026-10-20, so most growth is drift of the models, not the new
  threshold. Biggest zfight growth: de-nederlandsche-bank +28 m²,
  lloyd-hotel +13, the-rock +12, van-gendt-hallen +12, hilton +10. Nobody
  runs the sweep (`check:canal` does not); the script dies writing its
  JSON report (`RangeError: Invalid string length`,
  audit-glb-quality.ts:337) and needs
  `NODE_OPTIONS=--max-old-space-size=16384`. Table:
  `map-recall2-worktrees/audit-sweep-20261023/artifacts/audit-sweep/drift.md`.
  Report writer fixed 2026-10-24 (`<out>/index.json` + `models/<id>.json`,
  summary.md unchanged; the full run takes ~28 min and 16 GB heap, exit 0).
  Next: per-entry dates in the baseline, then one opus review of the
  2026-10-20 regeneration before any re-baseline.
- **factory batch 1** (2026-10-24, PDOK facts): 20 pands → compiled 15,
  no-evidence 4, error 1 (measure, pand 098925). Opus review: 0 pass, 13
  fix, 2 no-evidence (Postjesweg 2018 and Stadsloket 2021-22 photos show
  construction), 1 hold (politie-west, its own lane). The draft fails
  systemically, not per house: (1) walls with no photo default to orange
  brick, so the unphotographed sides dominate the 3/4 view of grey, black
  or yellow buildings; (2) measured columns and window shape are not
  applied (Metis 5 vs photo 29 columns, wide vs tall); (3) curtain-wall
  is chosen from foliage- or scaffold-occluded crops; (4) four
  triangle-budget failures. Closest: Oostpoort Montessori, OBA Osdorp,
  Metis. Draft fixed 2026-10-24 (lane/factory-draft-fix @ 49c14cf1c: era
  prior + inherited measured colour for unphotographed walls, gate photo
  grid written back as columns/window, curtain-wall needs usable evidence
  and crops after the build year, budget cap by blanking unphotographed
  groups, factory never writes hand-authored intents). Round 2: colour
  coherence fixed everywhere, triangle gate 4 → 0, columns right on
  IJburg; still 0 pass: 11 fix, 2 no-evidence. What blocks passing now is
  kit gaps (loggias, glazed plinths, panel facades: `docs/handoffs/kit-gaps.md`),
  eaves-vs-3DBAG gates on 4 houses, and Metis/Oostpoort, whose intents are
  hand-authored and need hand edits. Next: one opus kit session on the
  top two gaps, then batch 2 on a different mix (canal-belt and 19th-c
  pands, where the kit is strongest). Strip
  pages now show the two best-evidenced walls per house (~2,000 px).
- **factory batch 2** (2026-10-24, 12 pands with BAG year < 1920, PDOK
  facts): compiled 12/12, gates pass 8; review 0 pass (closest
  pand-165427 WARN). Four "pre-1920" pands are modern (the BAG year filter
  is not an era signal); five were older hand-authored intents, also not
  good enough. Kit gaps appended. Route decision for the 1000 target is
  issue #23 (needs-david): factory yield 0/27 so far.
- **player bugs** (merged 2026-10-24, #24 #25, 5bb2451c0): W opened the
  landmark article and D toggled street labels while steering (both
  steering keys); now E and T. Chase pitch had been set to 12° on 10-23
  ("lower angle" read as smaller pitch); now 60° with the slider covering
  12–60° (`chasePitch()` in preferences.ts). Desktop ride-perf at 60°:
  frames 16.7 / p99 16.8 ms, 0 over 50 ms, mapRender 2.4 ms, 851 draws
  (vsync-bound; roads run at 48°-era code had mapRender 1.8–2.2). Saved tilts not migrated. The
  Blauwbrug card failure seen then is fixed (#26, b1eb68865).
- **kit: loggias + glazed plinth** (merged 2026-10-24, #13): opt-in
  wall-group fields `loggias` (recessed balconies, side returns, rail) and
  `plinth` (glazed storeys with own lights/pier/height factor); measure
  proposes a plinth only on strong evidence. IJburg walls[2] FAIL → PASS;
  IJburg walls[3], Reigersbos walls[7], Buitenveldert walls[4] still FAIL
  (glare and dark fascias measured as glazing). Kit still cannot say:
  shop canopies/fascia sign bands, striped tile cladding, concrete loggia
  soffits, taller top storeys.
- **kit review 1** (2026-10-24, opus, pages 1–10): 2 pass / 38 hold (6
  no photo); census 386 → 388. Estimated 5–10 % pass for the remaining 506
  until the kit gaps are fixed: generic schools are one fixed beige whatever
  the photo (16 of 40), uniform small square windows where photos show
  ribbons or curtain wall (13), cinema/church/temple kits render 0
  triangles (6), flat roofs on pre-war schools, Amsterdam School banding,
  buff-brick and modernist worship. Fixing the beige default and the
  0-triangle kits first should lift it to 25–40 %.
  **Fixed 2026-10-24 (#29, 56fc4a0bf):** schools measured per pand from
  crops (160 of 283) else a period-palette pick, 0 on the old beige; every
  kit draws geometry (143 empty kits → 0, trim added); 37 pre-1940 schools
  hipped. Lane's own read of the 40: 7 look right, 13 better but hold, 9 not
  fixed. Round 2 review: 2 pass / 30 hold / 8 no evidence. #34 merged
  (leaf mask, khaki correction, ribbons, top bands: 13 rows better, 1
  worse); next: a round-3 review of `kits-r2-*` sheets, then curtain walls,
  coloured fascias, Zonnehuis classed as theatre.
- **kits-review (K)**: Role A done 2026-10-24 (`npm run kit:sheets`, run
  under the browser lock; 546 kits on 137 pages in
  `map-recall2-worktrees/kit-sheets-20261024/artifacts/strips/kits-N.png`,
  ~2.9 s per kit). 225 kits have no photo (124 with no resolvable pand, 101
  where all-walls returned no crop); the crop is the longest wall of the
  nearest pand, not always the street front, and the host pand is drawn as
  a flat extrusion, not the game's plain layer. Role B (opus review turns,
  ~20 kits each, verdicts into `landmark-reviews.json`) not started.
- **3DBAG outage → PDOK fallback** (2026-10-24): api.3dbag.nl and
  data.3dbag.nl have refused TCP connections since the night of 10-23.
  `facts.ts` now falls back (or `--source=pdok`) to Kadaster's 3D
  Basisvoorziening on PDOK: the same TU Delft LoD2.2 reconstruction, CC BY
  4.0, 2 km CityJSON blades per year (`src/canalRecall/buildingRecipe/pdokLod2.ts`,
  cache `npm run pdok:tiles -- --pand=<id>|--blade=<x>_<y>` into
  `map-recall2-source-data/datasets/pdok-3d-gebouwen-2025/`; all 88 blades
  that touch the municipality are cached and committed there as zips,
  270 MB, and a missing CityJSON is unzipped from its zip on first use). Measured on
  Bloemgracht 80: heights equal, roof area 119.9 vs 120.0 m², front width
  identical, normal 0.3° apart. Known gaps: `b3_bouwlagen` (storeys) has no
  PDOK field → null; PDOK 2025 is a newer AHN5 reconstruction, so wall
  surface indices differ from the API copy: never `--refresh` an existing
  large intent from PDOK (its `wallSurfaces` indices would point at other
  walls). Factory batches may run on PDOK facts; compile/gates on
  PDOK-derived facts not yet exercised.
- **perf compact phone ground** (merged 2026-10-24, #28, e547d5166):
  phones take compact worker meshes (uv from position, Int8 normals,
  Uint16 colours and indices), same geometry; cell bytes on 7 cells 172.7
  → 97.2 MB, ground GPU geometry at 22 road spots 1,908 → 968 MB summed
  (−49 %), iPhone road frames match main (22/23, the 23rd a different
  camera), context restore 365 ms. Desktop may take it later after
  ride-perf and picking specs. Waiting on post-deploy Sentry phone crash
  rates (#9 access, #10 real devices).
- **perf no-change findings** (2026-10-24): own-ground worker #2 (relief)
  heap and ArrayBuffers 0 MB at 20 s and 50 s on the iPhone profile, kept
  (#21); MapLibre `maxTileCacheZoomLevels` 5 → 1 saves only 6 MB on phones,
  unchanged (#22). Left on phones: real-device rides (#10) and GPU buffers
  (~134 MB; next lever fewer triangles per phone ground cell, 11–27 MB each).
  The perf session takes roads R1 (#12) first.
- **perf GPU loss and regain** (merged 2026-10-24, 1538978a4): MapLibre
  5.24 drops custom layers on a restored context; SharedFrame now re-adds
  both layers at style.load with a new renderer and calls a participant
  `onContextRestored` hook (ground re-requests cells on phones, facades
  rebuild, landmarks clear `_failed` and re-request, bike and tiles take
  the new renderer). `tests/e2e/context-restore.spec.ts` desktop + iphone:
  frame back in ~0.35 s. Gap: facade texture arrays repaint from scratch
  (32 s headless). Fixed 2026-10-24 (#20, 4598403e9): a restore's texture
  build runs in 32 ms slices (first load stays 6 ms, no CPU copy kept):
  facades back in ~5.5 s desktop, 5.4–7.1 s iPhone profile.
- **perf own-ground CPU** (merged 2026-10-24, 1fb293b85): relief tiles
  stored as int16 cm where exact (half the bytes, slightly faster), phone
  ring 400 m with the worker cache bounded by the same keep set; iPhone
  profile ArrayBuffers 137 → 62 MB, ground geometry 128 → 54 MB, GL
  buffers 152 → 134 MB, 2–4 cells on a 60 s ride, no holes.
- **perf own-ground ring** (merged 2026-10-24, be8224ed2): touch devices
  start the own-ground ring at 700 m (desktop 1400 m), always keeping the
  rider's 3×3 cells; iPhone profile 11 → 9 cells, ground geometry 149 →
  128 MB, main ArrayBuffers 167 → 142 MB; test:own-ground 141/141,
  screenshots identical. Side finding: frustum-culled cells that never
  upload keep their CPU arrays (~11 MB per cell); next is the own-ground
  worker's cell cache bound.
- **perf-phones**: taken over 2026-10-23; brief
  `docs/handoffs/lane-perf-phones-20261023.md`; the previous session runs
  one read-only Android emulator ride and reports numbers.

---

## Direction (2026-10-13) — approved plan

`docs/plans/digital-twin-direction-20261013.md` is the assessment and plan the
user approved on 2026-10-13. Short form: open NL/Amsterdam data only; buildings
move from one GLB per building to **recipe tiles** (per-pand recipe data
compiled into per-z16-tile meshes + instance tables; bespoke landmark GLB
builders stay, 300+ today, no cap). Steps 1 and 2 landed 2026-10-13 behind
flags: `?bagTiles=1` (BAG tiles with 3DBAG facts, facts sidecar,
`covers.json`; correction: the shipped tiles were already BAG-keyed for 335k
of 347k features, what was missing was facts, OSM aliases and the join) and
`?cityLook=1` (one texture array, `layer/tint/accent/hidden` attributes, two
shader variants, slot inference for the 310 legacy GLBs at load). Before the
flips: review the 15 "hidden bug" pands that covers will newly hide
(`npm run check:covers --strict` lists them: the-movies, delamar ×2,
kleine-komedie, he-hua-temple, oude-kerk, hortus-greenhouses,
walloon-church, rijksmuseum, westerkerk ×5, sexmuseum-venustempel), prune
the 114 stale suppress ids, fix the 5 building-type instance pands missing
from the tiles; gallery-size review of all landmarks under `?cityLook=1`
(ambiguous inferred slots: `white`→stucco 241 models, `dark`→frame 272,
`ochre`→brick 38, `red`→brick 104; slate roofs come out darker); the
city-look brick luma sits above LOOK.md's target (117 vs 95–110 sun side)
because slot tints pass through `cityTint`; one brick variant only; ~40
draft export scripts do not tag slots and will fail the 100% gate; under
`?cityLook=1` the landmark highlight is a flat unshaded yellow (the variant
swap drops the shading the default highlight keeps — demo shots 2026-10-13;
fixed by the city-look review 2026-10-13, HISTORY). **Flip evidence (lane
recommendation, written in `docs/LOOK.md`): flip `sharedFrame` and
`cityLook` together, desktop first; frame median/p99 16.7/16.8 ms in every
mode, three.js layers 0.74 → 0.89 ms, +5.5 MB textures, flag-off
pixel-identical. Not flipped yet: the user called the shared-frame default a
look decision for them, and the user's 2026-10-13 notes ("the sun moves
with me", "the whole city is a little dark/dour") go to the lighting lane
first, so the flip lands on a frame whose sun is fixed (the sunny look
landed 2026-10-16, HISTORY "Sunny look is the default"). Still open from the
review: three builder re-tags (Uilenburger synagoge and Podium Mozaïek
roofs → `roofTile`, American Hotel sandstone), 57 covered models without a
BAG year, Hemp Gallery (1993) and Theo Thijssen Museum (1994) carry rebuild
years without a sourced construction year, iPhone 4× unmeasured (touch
texture +1.4 MB computed). **Step 3 landed 2026-10-13 behind
`?recipeTiles=1`** (HISTORY): recipe tiles, compiler, `TileBuildings` near
tier, pilots published under `public/canal-drive/recipe-tiles/` (9.4 MB:
3,151 pands, 66 z16 tiles, 8 large, 61 canal houses, 10 glb landmarks, 3,072
types). Open before step 4: slot-level instancing found 0 repeats among 191
street-side parts because fitted widths differ by centimetres — quantise
widths in the fitter (e.g. 5 cm) so bodies/crowns share units; two
Bilderdijkstraat chunks (`bilder-079721-x2`, `bilder-159426-165632`) are not
byte-identical to the installed chunks (gates pass; newer source pack or
readings, not investigated); bag-facts sidecar gives eaves 3.3 m for the
5-storey pand 0363100012081118 (data bug); instanced-pand highlight not
checked in the browser; no iPhone static spots; `recipe-tiles.spec.ts`
"types" case took 16 min under machine load once (flaky under load, passes
alone). Step 4 next: mid tier reads the `mid` descriptor, near hides mid
ranges, suppression lists deleted, `largeBuildingTier.ts` overrides folded
into `kind: large`;
own-ground becomes the default after per-polder water levels, BGT width per
way, AHN profiles for the 891 unmeasured bridges and a desktop measurement
(user 2026-10-13: desktop is ~10x as important; iPhone numbers later); the gameplay loop no longer freezes the rider and spaced
repetition budgets the questions (landed 2026-10-13, see HISTORY); one light rig, one palette, one material
atlas and a written `docs/LOOK.md`. Content lanes continue: icon builders,
kits, building types, block faces, `kind: large` recipes (police stations
added to the to-build list), the GLB cleanup pass (attached windows, material
coverage, no holes) and the sculpture splat track. Freeze: no new per-house
GLBs into `catalogue.json` and no new one-off ordinary builders; new builders
tag every material with `materialSlot` + `tint`. Order: housekeeping (done
2026-10-13) → gameplay loop (done 2026-10-13) → shared frame + palette (one
palette module and one rig landed 2026-10-13 behind `?sharedFrame=1`; the
default flip waits on a desktop ride-perf decision: +0.2 ms/frame three.js,
+100–180 MB heap, shaded walls ~70 luma vs 96–123 baked — see `docs/LOOK.md`)
→ ground → recipe tiles. Open from the look lane: 3DBAG detailed buildings
never stream (3d-tiles-renderer root tileset only loads on the first
`update()`, the old layer never calls it before ready; in the shared frame it
loads but traverses zero tiles — LOD camera in the shared world);
`?buildingTypes=1` under the shared frame skips that runtime's merged recipe
shader. Checks lane 2026-10-13: the 37 `storybook-visual` baselines were
re-recorded (diffs were compact cards with MORE/close, the redesigned
portrait settings panel, the Feedback button and the attribution line — not
only the last two), `check-three-buildings` passes again (the stale "flat
lintels" rule now allows segmental heads, which `635fc6a1` added on purpose;
`kit-locations.json` republished with 246 ids). To look at: the
`portrait-finish-card` baseline (414×896) shows a translucent ghost of a
second card behind the finish card — stable across runs, likely a
presentation bug, recorded as is. `check-manual-landmarks` still fails on its
500 KB budget: royal-palace 637 KB, mountain-network 649 KB (47k tris),
american-hotel 504 KB, hotel-de-l-europe 725 KB (52k tris); and eight
Haparandaweg block-face entries carry no `bytes` (they are not built by
`build-manual-landmarks`). Decide whether the budget is right or shrink those
models (cleanup batch 2 fixed american-hotel: `b.mark('shell')`, 486 KB). Integrator merges on its own judgement (user).
Open after the gameplay merge: `RecallStore.expose()` so a passed name is
scheduled instead of re-asked; a settings control for `maxAsksPerMinute`
(field on the game today); fold `ridingPromptStyles.ts` into `index.html`;
a prompt opened just before a ferry does not time out until the ferry ends.

## Takeover board (2026-10-09) — active

Root `main` was cleaned on 2026-10-09 (see HISTORY). Live work, in order:

- **Landmark geometry audit offenders** (`audit:glb` geometry checks, baseline
  `scripts/landmarks/geometry-audit-baseline.json`, pins
  `geometry-audit-pins.json`): 200 of 281 GLBs have ≥0.25 m² visible coplanar
  overlap; mixed-material ones are visible (brick/stone 43, stone/white 16,
  frame/glass 18) — trim placed flush on wall/roof planes. Open pins: Oude
  Lutherse Kerk zz 17.4 east window still detected floating after the rebuild
  (zz 1.5 buried and H'ART portico now fixed), Rijksmuseum tower pilaster,
  Hotel de l'Europe and American Hotel window-rhythm pins still detected after
  their rework (rhythm is a warning; review whether the pins or the models are
  wrong). Hotel de l'Europe lettering and roofscape, OLK south court and RLK
  aisle south of 141° are inferred; Hendrik keeps its pre-existing detached-
  parts fail; the six models' sources are not yet archived. After a fix: flip the pin to `fixed` and
  lower the baseline with `--only-geometry --write-baseline`; never raise it.
  Overhang over-flags glass curtain walls; "buried" over-flags curved drums.
  Confirm the in-game depth-bias fix by a close drive past the Rijksmuseum
  entrance.
- **Landmark filler audit offenders (measured, unconfirmed in game)**:
  `npm run audit:landmark-filler` lists models that hide buildings they do not
  cover (hotel-jakarta BAG …247056 1,640 m², sint-agneskerk, national-holocaust-
  museum) and generic boxes inside/above models (OBA Oosterdok 48 m vs 37 m
  model, RAI ~11,000 m² above the roof, Sloterdijk, Melkweg, Felix Meritis,
  Stadsschouwburg, Pathé City — the Pathé shot shows a grey box in front).
  Review each in game. Also: kiosks under 14 m² draw as bare boxes (Westermarkt
  76/78/82); the Muziekgebouw model's Bimhuis box is half off its OSM part;
  Mövenpick could get an ordinary one-off later.
- **Recipe roofs on the remaining faces**: on for 14 faces (all
  Bilderdijkstraat faces but 080336-090492 and 159426-165632, both Marnix
  rows). clercq-236681 now on recipe roofs (fixes 2.8 m² of wall/roof flicker), but
  its Nassaukade corner (116526) gains an attic the photo lacks; keeping that
  pand on 3DBAG (`keepSurvey`) fails z-fight at 0.4 m² — fix the corner's
  overlap, then keepSurvey it. Not yet: nassau-162289 (10–12 m²
  slate/brick wall z-fight with either roof), utrechtse-48-76 (178705 over
  triangle budget), wallen-oza-41-57 (54 m open loops), wallen-ozv-115-125
  (171879 above 3DBAG max), 159426-165632 (no gain, 14.6 m loop),
  080336-090492 (1920s eave). Defects: stray brick block in Bilderdijkstraat
  175's attic (133467) and its rounded mansard + dormer missing; tower rule
  (eaves > 1 m over lowest front) from one pand; 70° attic from one strip;
  cornice-group 2 cm stagger is a workaround. Per-house recipe GLBs with
  fascia shops or steep dormers change on next rebuild (fit-golden re-recorded).
- **Rosarium follow-ups**: low box hedges around each bed; check Noord
  "Rozentuin" (a36994921, ~1,500 bushes on 1,380 m², maybe over-planted) and
  a288299874 in game; park-landscape draws the paved centre hex green;
  archive the reference photos to the source pack.
- **Shared material textures for landmark walls (user idea, backlog)**:
  landmark and ordinary models look bare where a wall is inferred or
  unmodelled (e.g. the fire station Hendrik rear, probably brick). Pull the
  city's shared texture cells (brick/stucco/stone, as the large-building
  tier already does) onto plain landmark wall materials, chosen from the
  photo colour or BAG era, so unphotographed sides read as brick rather than
  flat paint. Must stay cheap (shared atlas, no per-model textures) and must
  not hide missing evidence: inferred walls keep their "inferred" label.
- **Interwar perimeter blocks** (e.g. Indische buurt/Oost courtyard blocks):
  drawn by the generic house facade today; not in the large-tier (post-1945
  / > 26 m) or ordinary backlog. Treat as street-survey block types (one
  architect's design repeated round a block) — candidate after the
  Nassaukade/De Clercqstraat type pilot.
- **Gable details seen at street level**: hoist beams read as loose black
  poles (worst on Utrechtsestraat neck gables) — check length/visibility;
  OZA 45 and 47 crests modelled as grey domes (photo: carved crest, spiky
  ornament); gable-peak check counts crests/pediments as peaks and never
  applies its "2 m wide at half height" rule.
- **Photo crowns, follow-ups**: check Utrechtsestraat 178784 (point gable
  ~3 m higher in photo) and 178875 front b (5 steps, not 3); bilder 162444
  authored neck 4.1 m above the photo eaves (likely authoring error); compiled
  eaves 2.2–2.8 m below the visible facade top on 178876/178875c/178784; the
  gallery's lopsided 156287 gable is not in the photo nor the authored
  outline — trace it (the gallery model is the retired per-house GLB); no
  canal-house gold set for the classifier (heuristic confidence 0.4–0.5).
- **Building taxonomy (user, 2026-10-10)**, done (see HISTORY); remaining:
  Bilderdijkstraat defects table on street-surveys.html (gables drawn as
  dormers, 3DBAG roof slabs, missing awnings, 158–162 drawn as the corner
  block); refile 156732 under Jacob van Lennepstraat. Definitions: (1) landmark buildings = curated list only (only these count for
  discovery/quiz/What's new/route selection); (2) ordinary buildings = one-off
  medium-fidelity reconstructions of large non-landmark buildings; (3) street
  surveys = repetitive canal-house / block-face work aiming at reusable
  geometry (faces, per-house recipes, street chunks). Galleries today show
  stale per-house Bilderdijkstraat models the game no longer draws.
- **Street-survey house types — Stage 2 and follow-ups**: Stage 1 landed
  (Nassaukade 318–300 and De Clercqstraat 22–2 installed with
  `blockFace/houseType.ts`). Next: `scripts/street-surveys/build.ts` must call
  `validateBlockFace` before reading `rhythm.schemaLimits` (typed houses show no
  limits in the gallery). Stage 2 instancing needs slot-level hashing (whole-
  house equality finds 28% on Nassaukade, 0% on De Clercqstraat),
  `EXT_mesh_gpu_instancing` in `streetChunks/gltf.ts`, loader support in
  `signature-landmarks-source.js`, mirrored geometry nodes; pays only once types
  recur across ~20 faces. Limits: pair dormers are two halves with a 0.5 m gap;
  3DBAG LoD2.2 dormer masses show as brick boxes (154241, 162368/164663,
  236262 — see the roof lane); Nassaukade white stucco storeys and tympana not
  modelled; De Clercqstraat strip is 2021 (shops may have changed).
- **UvA Roeterseiland held**: builder simplified 37.2k → 21.9k tris but not
  installed — its spec says `do-not-suppress` (composite BAG parent not
  partitioned; bridge underside height estimated). Needs a suppression
  scope decision, then a check against the Tim Soar photos.
- **Landmark polish from contact sheets**: This is Holland sign is thin and
  its panels too regular; Luther Museum roof uniformly dark, frames should be
  pale; Frankendael roof should read as tile; Nieuwendammerkerk nave roof
  reads khaki not red tile; Posthoornkerk is 39k tris (cap 40k) — reduce.
- **Held landmarks (`status: "held"`, out of game/galleries/What's new)**:
  Torture Museum (attached now, but sign/shopfront only suggested), Pathé de
  Munt (rebuilt twice; awaiting the user's call on
  `artifacts/landmark-lanes/pathe-de-munt/contact.png`; audit: 40 open shell
  loops), Sint-Petrus-en-Pauluskerk (tower/gable wrong, dark), Maarten
  Lutherkerk (3DBAG tower the photo lacks), Oudemanhuispoort and Levend
  Paardenmuseum (bare massing), Koningskerk (curved grid hall missing),
  Compagnietheater (faint wing windows, too brown), Haparandaweg 65,
  650–706, 708–744, 788–868 (unreviewed/weak), mediamatic. Integrator views
  every contact sheet before un-holding; run `npm run audit:glb -- --id=<id>`
  and `scripts/check-landmark-attachment.ts`.
  Gerard Dou Synagogue: side/rear walls open (audit: 7/30 see-through rays).
- **Facade gate follow-ups (2026-10-10)**: Royal Palace, De Balie and the
  Concertgebouw entrance were reworked and installed. Still open: the Palace's
  N and S fronts are blank (audit blank-wall FAIL, 45 x 25 m each); De Balie's
  front is straight where the real one is bowed; Concertgebouw has 151 open
  loops and 24/42 see-through rays from its glass promenade. Aron Schuster
  synagogue installed after rework; its rounded corner is still squared.
- **Lanes cut off by the usage limit (2026-10-10)**, resume from their branches:
  audit see-through still FAIL on footprint-edge rays: haarlemmermeerstation,
  hart-museum, pulitzer-amsterdam (check each against photos). adam-tower,
  de-gooyer and huis-bartolotti now pass under the cantilever rules (rays
  hit a wall <= 2.5 m behind an overhang >= 6 m up); whether those recesses
  match the photos is still unchecked.
  geometryAudit.ts proximity grid skips any triangle spanning > 20,000 1 m
  cells ("pathological sliver", line ~199): a large diagonal wall reads as
  absent, so its windows FAIL opening-floating. HvA lane worked around it by
  tessellating shell faces (big-facade.ts addShellTess); fix the grid
  (bin by plane, or rasterise only the triangle) and re-run the baseline.
  Kohnstammhuis stone reads too warm/tan against the grey photo.
- **Building types under the shared frame** (2026-10-16, HISTORY
  "Sloterplas galerijflats"): the lit recipe look (`MeshLambertMaterial`)
  does not merge, so every unit draws one call per material near (the
  86 -> 18 draw-call merge is lost in the default game); far boxes now draw
  unmerged. Next: a lit merged material (Lambert + per-vertex slot/tint).
  Sloterplas towers' weak points vs the photos: gallery/balcony soffits
  render dark (no bounce light), west faces read more vertical than the
  hazy photos, first-floor glass black, doors read strong red up close;
  kit cannot yet say the diagonal gallery swing to the south stair, curved
  gallery ends, railing bars or recessed glass. The landmark GLB baseline
  gate fails the unit on ~930 window plates 4 cm proud (same as the
  installed pilotis unit).
- **Nieuw-West building types (2026-10-11)**: opt-in `?buildingTypes=1`
  draws 3,072 photo-confirmed instances (2026-10-11 latest: +85 post-war
  flats west of the A10 in three designs: loggia-stack 5st 30 (Osdorp),
  portiek 3st blue-door 31 (Slotermeer; 14.2 and 16.0 m frontages share
  one mesh), garage-pair balcony 5st 24. Flat clusters split 3-6 designs
  per street/hof, so most stay held (220 in six areas, reasons per pand);
  tile-stripe cluster 10 (~29 blocks) needs a street-front photo; the
  6-9 storey clusters 21/26/30 are not surveyed.)
  draws 2,987 photo-confirmed instances (2026-10-11 later: +611 terraced
  houses in seven more designs: red-panel-door E2 272, garage-door 3st/2st
  120, white-sheds E1 99 (shed rhythm unread, not re-sheeted), tall-glass
  panel B2 97, ribbon-fascia 10, render-pilaster 7; 518 held. Mirror
  parity now pinned per house from ~160 terraces read by eye (old
  leftmost-normal rule matched ~25%). Densest rowhouse view was 86 draw
  calls desktop / 69 iPhone; each unit now bakes into one merged draw
  with a shared shader: 18 / 16, layer render time -30-45%, screenshots
  identical. Layer can now be turned on by default once the user agrees.) Earlier: +1,921 terraced houses
  of the 8.5 x 5 m cluster in four front designs A garage-door, G door-window
  mirrored pairs, B tall glass, D render with tile plinth; one street photo
  per terrace, 457 terraces classified; 677 held incl. undesigned classes E,
  K, C, B2, F and extended houses; mirror parity along a terrace is not
  photo-verified; toilet windows beside doors simplified; densest rowhouse
  view 24 draw calls. Earlier: 455 instances, (2026-10-11: +202 from type-6
  leftovers and clusters 2/5/8, 11 new designs; 124 held with reasons).
  Balcony depths restored from photos (1.0-1.5 m) after the
  opening-overhang fix; steel-stack rebuilt (frame rises a little too far
  above the roof; balcony rails render faint). geometry-audit-baseline.json
  re-recorded 2026-10-11 with a `reasons` map; 17 models then fixed in
  their builders, `audit:glb --only-geometry` 302 pass / 0 fail. Remaining
  (at or below baseline): shell-technology-centre overhang 12 / zfight 4.3
  (long window ribbons; three fixes failed), overtoom-197 overhang 4 (bay
  prisms and a 1.3 m canopy), de-bazel floating 6, voc-kade-600 overhang
  14, hilton-amsterdam overhang 14 (balcony rule may apply), ij-toren
  overhang 10, fire-station-hendrik 4, american-hotel 1 dormer window. Densest view
  (peach-street) is 88 draw calls (12 cluster-2 unit variants); 12 panden
  assigned from entrance close-ups only. Earlier: as shared InstancedMesh units (box LOD
  past 140 m): type-1 portiekflat (Sonderbuur, Wildeman/Notweg, Slotermeer
  hofs; brick-cream, clad-panel, clad-full, 4-storey brick, brick-yellow),
  wide-core portiek (Beek en Hoff/Osdorper Ban 46, Slotermeerlaan 30), 4-st
  hof with garages (16), tall plinth gable/hip (36), and type 6 on
  Comeniusstraat. Brick colours are photo medians (the game's cityWallTint
  lifts them). Densest view (Osdorper Ban): 55.5k tris, 20 draw calls,
  iPhone 4x median 16.7 ms. Next: the ~85 remaining held pool pands (Jan de
  Greef pastel blocks, pre-war, 3-storey, shops), 54 more type-6 pands,
  clusters 2/4/5/7/8 and the 2,922 rowhouses (needs street-facing photos);
  backs and gables are inferred everywhere; then decide default-on. Review
  renders are archived in the source repo under building-types/.
  Piet Hein Buildings (landmark) and Bercylaan 801-855 installed after a
  facade rework (2026-10-11): perforated panel pattern not modelled; the
  white banded volume in Bercylaan photos is the neighbouring 2026 pand.
  `npm run check:osm-under-models` (in check:canal) covers all 813 placed
  models (>= 50% area overlap; footprints from nativeRing, plan, GLB
  occupancy or BAG pand); 5 building-type instances lack a footprint.
  16 partial-overlap neighbours/annexes are allow-listed with reasons in
  scripts/landmarks/osm-under-models-allowlist.json; review them.
  Booking.com HQ held (2026-10-11, second rework): curved stepped south
  front from per-band plan offsets, thin bronze plates, sampled glass, lobby
  recess measured 1.7-5.7 m (allowed by the new glbQuality undercroft rule,
  which changed no other model). Still reads as a tidy striped glass drum:
  missing the faceted, irregularly shaded glass skin, slanted terrace fins,
  the curved east face and the tower's irregular window rhythm. Rejected
  checker changes from that lane, kept on branches: wallPlanes centroid
  clustering (checker/wallplanes-centroid-20261011; re-clusters 55 models,
  11 PASS->FAIL, Mondriaan Tower's pier-and-glass wall becomes a false
  positive) and a z-fight overlap-distance filter (estimator noise pushes
  pulitzer-amsterdam past its baseline). Shell Technology Centre installed with only two
  photographed views (south, east); north half, west and courtyards inferred.
  Krasnapolsky held (2026-10-10): old Dam front matches; the modern wing and
  lower brick building need photo counts and the dark glass bays.
  Pakhuis de Zwijger held (2026-10-10): colour fixed (dark weathered brick,
  rust strips). Specs can now declare `throughPassages` (corridor + axis +
  evidence); its Piet Heinkade roadway is declared. Still FAILs see-through
  10/61: 4 oblique pier-edge rays inside the corridor (bearings 17–40° off
  axis) and 6 at the east pilotis, where the glazed ground floor sits ~7 m
  behind the pier line, beyond the 7 m reach. Needs a tested rule for a deep
  recess under a LOW soffit, not wider tolerances.
  De Nederlandsche Bank held (2026-10-10): the 1990 Abma round tower is
  demolished (Mecanoo renovation 2025); the 3DBAG link core on the tower's
  west face probably belonged to it and shows as a blank fin. Confirm with a
  2025 west-side photo, drop it, fix tower proportions, then blind-count.
  Bloemgrachtkerk (tower removed 2019, redevelopment) and Gemaal
  Mercatorstraat (tiny kiosk) skipped.
  Chassékerk towers follow the 3DBAG lidar (23.5 m, ~2 m over the ridge);
  lidar truncates slender towers (Vondelkerk spire was 12 m short), so
  check the real tower height in a source and raise if needed.
  Large ordinary buildings (2026-10-10): Willem de Zwijgerlaan 350's canal
  roof is solid to 15.2-15.6 m because 3DBAG closes it with one lid; the real
  white storey stops at ~13 m under an open pergola. Grasweg 116 rows above
  32 m are extrapolated (rectifier cap). De Bazel lacks piers/banding/
  sculpture. Oostenburgermiddenstraat 228's tower is squared where the real
  corten tower is rounded; Asterweg 23 has only its east gable photographed;
  Céramiquelaan 437 brick is one flat grey. Haarlemmerweg 333's red storeys
  should overhang the grey base. Audit site path now needs 2+ grounded
  volumes (not just a > 150 m diagonal); 21 models newly checked. ij-toren
  now passes after rework (recessed brick wall behind the quay colonnade,
  glass-block wall, arcades declared as throughPassages, pavilion and vent
  pipes declared as `detachedStructures`; recess 3.7 m and column pitch
  11.4 m are photo estimates, +-1 m). asterweg-23's 95 m rear wall is
  declared blank on partial evidence (hedges hide the bottom 3-5 m; corrugated
  cladding above has no openings): revisit if a ground-level photo appears.
  Krasnapolsky (held) still fails blank-wall. New see-through FAILs on already-failing rijksmuseum 9, stadhuis 28,
  eye-filmmuseum 33, straat-museum 49, mountain-network 17,
  ndsm-warehouse-complex 17. A real campus whose volumes weld can declare
  `siteModel: true` in its spec. Wibautstraat 3B/3C
  and pand 0363100012125963 are multi-volume towers, not ordinary slabs.
  Next candidates: scratch
  big-buildings-1.json (Haiku list).
  World Trade Center Amsterdam held (2026-10-10): towers A–G are ONE BAG
  pand (0363100012096613, ~200 x 95 m); a recognizable model needs a photo
  of each tower face (Commons has only atrium/logo/tower H). Footprints and
  research are in scripts/landmarks/world-trade-center-amsterdam-*.json;
  needs a panorama pass per tower before modelling.
  Full audit with the new rules (2026-10-10, 259 models): 88 pass, 171 fail;
  vs the pre-change baseline 16 FAIL→PASS (two spot-checked visually: no
  holes) and 2 PASS→FAIL: concertgebouw (canopy restored to its real depth)
  and haparandaweg-902-950 (passes again since the deep-cornice rule).
  Elevation skeletons with photos exist for 25 landmarks
  (`scripts/landmarks/*-elevations.json`, photos in `artifacts/landmark-lanes/`);
  counts are not filled: Haiku blind counts were too noisy — use a stronger
  counter or rectified `pand-reference` crops. Correction 2026-10-13: all 25
  are rhythm specs for models that already exist on main (24 hand
  builders/specs plus the bilder-087959 recipe), so they are not large-tier
  inputs; the large-tier customer list is `dominant-building-backlog.json`
  (1,828 mid-sized pands), filtered to unmodelled, central, two-front
  candidates. First pass 2026-10-13 (HISTORY): Kattenburg quadrangle and the
  Heinekenplein block installed; every backlog entry is `priority: low` /
  `needs-identification-and-research`, so rank by footprint ÷ distance from
  the centre until a better "most seen" score exists. Shell probes that
  passed baseline but are not authored yet: 084999 (pastel stucco,
  rounded corner), 186290, 126319, 243844; 165427 hidden by scaffolding.
  Arched openings landed 2026-10-13 (HISTORY): Entrepotdok 164981, Reade
  Overtoom 283 (084999), Eden Hotel Amstel 144 (186290) and Nieuwpoortstraat
  80-98 (126319) installed. Gillis van Ledenberchstraat 38 (243844, 324
  tris) was authored but **not installed**: `check:osm-under-models` reports
  the 2010 pand 0363100012238383 (982 m²) and five OSM ways "100% inside"
  its plan and `covers.json` claims six pands for it, so its placement or
  footprint is wrong (the lane saw `all-walls.ts` return walls of a much
  larger neighbouring footprint for this pand — a building-tile footprint
  mismatch to investigate before re-installing; recipe stays in
  `scripts/building-recipes/houses/ledenberch-38-243844/`). Still bespoke
  candidates: Houthaven block 186086 (curved walls, perforated brick), OBA
  Staatsliedenbuurt 069991 (striped bands, glazed balcony towers). Kit gaps
  the lane listed: curved corners (3DBAG gives facets; Eden Hotel and Reade
  read straight), stucco bands and diamond panels, canopies need 0.6 m of
  wall each side of the entrance, flush brick bands sit 1.2 cm proud and
  trip `zfight-near`, no "|" glyph in `signage.ts`, Entrepotdok's rear and
  courtyard mostly blank under the 12k budget (a bespoke budget override is
  the integrator's call), a second Entrepotdok board (EDAM?) unread. Tall civic storeys fail the
  storey-height gate on 186003, 118320, 137990, 135250, 236799, 169214. Heineken Experience fails
  window-rhythm (2 predicted missing) and is a batch-2 candidate. `check-manual-landmarks.ts`
  status is in the Direction block above (2026-10-13).
  Lane runs of `archive-model-sources.py` into the private repo are sometimes
  denied by the auto-mode classifier; refs for vrijburg, van-gendt-hallen and
  the 25 elevation photos are not archived yet.
- **GLB quality audit** (`npm run audit:glb`, `src/canalRecall/landmarks/glbQuality.ts`,
  2026-10-09): 184 of 236 installed models flag at least one FAIL (detached
  124, see-through 84, holes 61, far-outside 32). Detached-part detection is
  noisy (recessed glazing vs floating facade is geometry-ambiguous) — keep it
  a warning for installs and hard-fail holes/see-through/far-outside. Worst
  15: de-bijenkorf, oude-kerk, beta-boulders, fire-station-willem,
  mountain-network, centraal-station, rai-amsterdam, westerkerk, valley,
  lab111, vredeskerk, scheepvaarthuis, dominicuskerk, magna-plaza,
  madame-tussauds — review their contact images before fixing. Het Pakhuis
  (live) has rear-step wall gaps in its 3DBAG shell. Ordinary set not audited.
- **Intro/landmark streaming follow-ups (2026-10-09)**: the flight still runs
  ~4.0 s vs 3.5 s designed (MapLibre intermediate-zoom tiles + three chunk
  installs, ~0.47 s long tasks). 25–40 landmark models load during the spawn
  settle because the pitched chase view's bounds reach the horizon — cap
  `_nearby` by distance or make it pitch-aware. `setActiveLandmark(null)` fires
  ~every 100 ms while riding, each with a GeoJSON `setData` — find the caller.
- **Shared material textures (user, 2026-10-09)**: models are flat-shaded
  colour only, so brick and roofs read as plastic. Add one shared tiling set
  (brick bonds, roof tile, slate, stone, timber, glass) at 256–512 px with
  mipmaps; the building compiler/kits emit box-projected UVs; distant LOD
  keeps flat colour. Not per-building photo textures.
- **Canal house reuse (user, 2026-10-09)**: identical/near-identical houses
  should share one mesh (canonical recipe hash + dimension tolerance) and a
  `sameAs`+overrides recipe for neighbours; runtime instancing follows.
  Measured (massing only, `scripts/analysis/canal-belt-reuse.ts`, canal-belt
  core, ~10k houses): 13% have an adjoining near-twin (574 runs, longest 8),
  so shared meshes save ~8%; 67% share a coarse family signature, so the
  real win is drafting from the nearest done house, not GPU memory.
  Long 19th-century rows (Marnixstraat, user Street View 2026-10-09) repeat
  one module inside a single 30–60 m BAG parent, which that measure excludes:
  recipes need `repeat` along a frontage, compiled once and instanced. Build
  on the installed Marnixstraat pilot (`repeatedTerraceRoof.ts`).
- **Perf cycle**: landmark layer renders one `THREE.Scene` per model with a
  `getBounds()` per entry per frame, no frustum cull (eviction landed
  2026-10-23, `landmarks/landmarkResidency.ts`)
  (`signature-landmarks-source.js`). Re-baseline against
  `docs/performance/2026-10-06/` first.
- **Recipe pipeline next steps** (pipeline on main, see HISTORY 2026-10-09):
  runtime instancing in the ordinary layer from `instances.json`; install a
  first recipe street; components for stepped/neck crowns, brick banding,
  pilasters, ribbon windows, shutters; stoops on every repeated module;
  Haiku/Sonnet drafting from the pand-reference feed (all recipes so far were
  written by the lane agent); `kind: "large"` tier.
  Tiers (user, 2026-10-09; landmarks will reach ~1,000): base (every
  building: 3DBAG LoD2.2 + era facade grammar) → house recipe (row/canal
  houses, ≤15 min, ≤3k tris) → **large building** (schools, blocks,
  warehouses, offices, most landmarks: keep 3DBAG massing, recipe picks a
  facade system per wall plus entrance/signage/roof plant, ~20–30 min, ≤12k
  tris) → icon (~100 bespoke builders).
- **Continuous fan-out (user, 2026-10-09)**: landmark lanes pull from the
  `pending` ("Needs work") list on `landmark-queue.html`; integrator merges,
  reviews contact sheets, batch-deploys and relaunches. In flight: museums2,
  worship, civic lanes; pand-reference feed (ordinary); recipe pipeline.
  Next: triage the ~80 `review` items into building / splat / area, and a
  discovery pass (Arcam guide, monument register) to grow toward ~1,000.
  When buildings run out: notable businesses and restaurants (user).
- **Sculptures: De Dokwerker pilot landed 2026-10-13 as a seven-view photo
  impostor behind `?sculptures=1` (HISTORY)**; splat no-go for this photo
  set because the COLMAP poses do not hold at the statue (rays miss by a
  median 1.59 units on a 1.09-unit figure). Next: the other 37 statues via
  the impostor recipe (`docs/sculptures.md`), splats only for sets that
  pass `registrationCheck` or a new walk-around capture. Impostor limits:
  flat figure in 45° steps, cut-out look from above, no −135° view, lamp
  post fragment at +45, washed head at +90, branch at +135, no shadow,
  unlit; iPhone 4× unmeasured.
- **Sculptures and statues → splats/impostors (user, 2026-10-09)**: De
  Dokwerker, Vondel-, Rembrandt- and Wilhelmina-monuments etc. are not boxes.
  38 are now `treatment: sculpture` in the backlog (filter "Sculpture (splat)"
  on `landmark-queue.html`; list in `build-poi-backlog.ts`), incl. Mama
  Baranka; De Dokwerker's hand-built model should be replaced first.
  Capture a multi-image Gaussian splat (or photogrammetry mesh) from Commons
  photos + panorama crops; render the splat only within ~50 m and a baked
  8–16-view impostor beyond. Start from `docs/landmark-splat-reference-pilot.md`.
- **Docs compaction**: ~135 markdown files across root, `docs/` and here.
- `scripts/check-cinema-facade-surfaces.ts`: the Kriterion half is fixed
  (count restricted to the frontage, z ≥ 10; the extra 8 panes were the real
  rear east bay). The Rialto half fails on a genuine model defect: at
  y = 14.04 the slate roof and the cream wall share the plane x = 12.30
  (`rialto.glb` unchanged since 2026-10-04) — a landmark lane fixes the
  builder, then the check can join `check:canal`.
- Street-appearance fingerprints (`public/data/street-appearance/*.json`)
  hash an older `signature-landmarks.json`; re-bake rather than hand-edit.
- **Worktree hygiene (recurring)**: run `scripts/worktrees/triage.sh` before
  removing anything; `--remove-merged-clean` and `--archive-dirty` apply the
  2026-10-13 rules (see HISTORY). Create lane worktrees with
  `scripts/worktrees/new.sh <branch>` so `node_modules` and `.cache` are
  symlinked. After the 2026-10-13 sweep: 18 worktrees (3 running lanes, 4
  kept, 11 to review or retire), 164 local branches (159 unmerged, mostly
  old lanes; triage them next), disk ~146 GB free. Merged 2026-10-13 by the
  integrator after review-sheet checks: `feat/kit-only-churches-20261011`,
  `fix/europe-window-grid-20261011`, `feat/da-costakade-13-20261013`,
  `gameplay/riding-prompts-20261013`, `ground/data-20261013`. Merged
  2026-10-13: `fix/felix-meritis-20261011` (rebuilt after review; z-fight 0.9
  → 0 m²; the model no longer suppresses rear pand 174322, which the city
  layer now draws). Still open: `big/ordinary-a2-20261013`
  (Jodenbreestraat 11 WIP: 116 open loops, 1,494 m² blank NW wall, 118 m²
  z-fight — not installable as is), `qa/detached-openings-sweep-20261013`
  (handed to the cleanup lane to merge or cherry-pick),
  `big/ordinary-b2-20261013` and `landmarks/kit-churches2-20261013`
  (footprints only), `rework/booking-hq-20261011` (held),
  `exp/photo-colors-20261011`, `render/drop-maplibre-step1-20261010`,
  `fix/waag-roof-20261013` (another session's worktree, not reviewed); five
  `wip/recovery-*-20261013` branches with author iterations recovered from
  the 2026-10-08 clones (nieuwespiegel555, kerk136, prinsen211/215); and
  `wip/recovery-landmark-integration-20261009` (merged with main at
  `bab86d13`; GLBs re-exported; Ruysdael Petrus-Pauluskerk dropped as a
  duplicate of `petrus-en-paulus-kerk`): Voormalige Schouwburgpoort PASS
  (16.6k tris; no BAG pand so `review:sheet` cannot frame it — look at it in
  the gallery before installing), Academie voor Theater en Dans, Holocaust
  Namenmonument and Max Euwe Centrum FAIL hard gates (cleanup lane has the
  list). Review sheets are in
  `map-recall2-worktrees/integrator/artifacts/review-20261013/`. Note for
  `audit:glb --write-baseline`: pass `--write` or more than one `--id`, a
  single-id run never flushes the baseline file.
- **Perf findings (2026-10-09 baseline, `tests/e2e/ride-perf.spec.ts`,
  iphone 4x throttle):** steady ride holds 16.7 ms median, p99 33 ms. Landmark
  layer costs only 0.1–0.8 ms/frame even with 250 models resident. The game
  calls `jumpTo` every frame, so `moveend` fires every frame: ~4.5 ms/frame of
  handlers, led by inventory trees rebuilding (`inventory-trees-source.js`),
  then road labels (`road-network.js` `drawLabels`). Gate those on real view
  change.
- **Unmerged landmark lanes awaiting rework (2026-10-09)**: integrator
  viewed all 9 sheets; none installed. `landmark/historic-20261009c`
  (Bellevue, West India House, West Indian Warehouse, Compagnietheater,
  Rijksakademie, KIT) and `landmark/nightlife-20261009c` (Sea Palace,
  Club Panama, Toekomstmuziek) are 3DBAG shells + generic windows missing
  each building's signature (Bellevue lettering, pagoda upswept roofs,
  PANAMA sign, KIT tower stages). Closest to the bar: Club Panama,
  Compagnietheater, West India House. Koningskerk held for its grid hall.
- **Sculptures** (38 in the backlog's sculpture treatment): splats only where
  30–60 recent multi-angle colour photos exist (mask the statue; auto-find
  centre/ground; ~1 h per statue); otherwise impostors baked from a clean
  mesh, with nearest-tile switching (blending doubles the figure). Untested
  alternative: single-photo image-to-3D mesh generation, then decimate.
  The Dokwerker hand model has wrong arms and a hat disc — fix as far LOD.
  Needs a real-iPhone GPU check before any splat ships.
- **Destination memory follow-ups**: recent destinations are per device
  (localStorage) — sync them with the signed-in recall store. The review
  repeat is now pinned with a real due backlog (2026-10-10); a fresh device
  no longer converges, but cross-device memory would still help.
- **Gameplay follow-ups left open (2026-10-13 lane)**: no road-graph unit
  case for the coincident-node hop (the pinned `review-ride` e2e is the only
  regression); on the 414×896 finish card the title truncates ("Vondelpark
  Open Air...") and the Feedback widget overlaps the card near "Share this
  route"; the questions-a-minute setting has no bottom-HUD check row (Off
  shows no band, which existing rows cover).
- **Renderer: give three.js the frame** (`docs/archive/research/own-renderer-spike-20261009.md`,
  `renderer-spike.html`): spike shows lighting is the visible gap — shadows,
  sky, fog, tone mapping, sunken water — at ~2.6 ms CPU per throttled phone
  frame vs 7.1 ms for MapLibre's render. Phase 1 (days, reversible): merge
  the ~dozen three.js layers into one shared lit frame with shadows inside
  MapLibre. Phase 2–3 (4–6 weeks, flagged, after a real-iPhone GPU test):
  three.js owns ground, overlays, labels and camera; MapLibre only for
  minimap/overview, dropping the live OpenFreeMap dependency. Gaps: no road
  widths/sidewalks in our extracts (centrelines only), humped bridges render
  as grey slabs, no route line/labels/HUD in the spike.
- **Haparandaweg held/skipped**: 952-1002 rebuilt but held — grey
  neighbour building needs its light-grey framed grid, SE/NE faces plain;
  746-786 rebuilt, held for user review of its sheet; 870-900 NE side still
  dark glass, unverified. Review 65 (needs the terracotta upper volume),
  650–706 (paired casements, stone bands), 708–744, 788–868 (glass bays);
  retry 940–950 with another photo source; 582–648 after scaffolding. The
  street sheet framing was poor (bike drawn over a roof) — reshoot.
- **Audit see-through test is hull-limited**: cast rays fully through the
  bbox (or from outside the footprint) in `glbQuality.ts`; today concave
  footprints flag false holes. Madame Tussauds has small roof-junction gaps.
- **De Wallen next**: OZA 41–57 and OZV 115–125 installed. Next — a
  frontage override for BAG stoop projections (OZV 113, 127–129); a face-level
  3DBAG/BAG geometry correction field instead of per-face fix scripts; bell
  gables with flat moulded caps; basements > 1.2 m and taller ground floors;
  label depth (Casa Rosso floats over OZV);
  lean from a non-rectified photo; adopt crownGroups/tower/split fronts on
  Bilderdijkstraat 102–106, 149–151, 88–90, 162443, 236022, 236189; reviewer
  row counts confuse mezzanines and arcade bays with storeys (177922/23/43/46).
- **Bilderdijkstraat faces**: even side 72–166, 113–115, 131–153, 169–175,
  198–202, 199–203 installed (standalone 153622/153782/154127 folded into
  faces). Left: chunk-bilder-079721-x2 is not a face; 66–70 (pand 167348);
  155–167 large-tier. Limits: 175 roof reads as a hip with no dormer (footprint
  jog fails the dormer check); 200/198 cornice kept 0.55 m above the photo;
  tower lights vanish when the rise is < 0.88 storey; the 2021 and 2023 strips
  differ ~1.5 m in vertical registration. Gallery recipes
  `recipe-bilder-{153622,153782,154127}.glb` are stale (game draws the faces);
  reinstall via `scripts/building-recipes/install.ts`. Document `frontRoof` in
  docs/buildings-pipeline.md. iPhone e2e street shots frame too close.
- **Inferred rears**: z-fight DONE 2026-10-16 (HISTORY "Rear windows no
  longer z-fight": rears add nothing on 13 faces). Open: recompile and
  re-install the installed faces so they take the new rears; the rear
  window grid is generic (2.5 m pitch), use rear photos (`pand-reference
  --prefer-bearing`) where they exist; the remaining 0.1–8.3 m² coplanar
  z-fight is front/shell geometry (12 of 13 faces fail the 0.5 m²
  new-export regression); holes on 31-49, 265-313, 363-371 and the blank
  wall on 265-313 predate the lane.
- **Block faces next** (`docs/buildings-pipeline.md` "Block-face authoring";
  now the default unit for attached ordinary buildings): schema for per-bay
  widths and off-centre gables (081118, 156286, Utrechtse 76), a shopfront
  that must not cover a residential entrance bay (157650), two-storey
  shopfronts (Concerto), white stucco reads beige under the recipe look;
  facade-compare gable count is unreliable on chunk spans; small/faint signs
  (KROM, TUI); 087959 strip vs proposal disagree on the ground-floor panes.
  Re-author the rest of Bilderdijkstraat (24 pands on that face) as faces.
- **Street chunk fallback**: if a chunk GLB fails to load, its houses are
  already out of the model list and the OSM extrusion shows; restore the
  per-house specs on failure. Demo page stats table scrolls sideways on phone.
- **Review harness follow-ups**: `review-sheet.ts` needs ordinary-house
  support (no catalogue entry/anchor) before Bilderdijkstraat re-review; ground
  NAP offset not applied to the matched camera; record party-wall bearings per
  model so blank-wall warns become signal; triage the 34 ≥600 m² blank walls
  (Viñoly, The Rock, DeLaMar, Palace on the Dam first).
- **Re-review the 19 Bilderdijkstraat recipe houses** under the new
  acceptance checklist: bilder-156287 has 4 upper storeys and small 4-pane
  windows where the photo shows 3 storeys + gable, large 1-over-1 windows,
  middle-bay balconies, brick relieving arches and a 3-window gable. They
  were accepted on overall resemblance. Run facade-compare on each.
  Surround/awning evidence still open: Toko Persama (bilder-157154) awning
  ambiguous; quoins, full-frame and dutch awnings have no house yet.
- **Recipe houses next**: shop-sign lettering, patterned banding,
  per-house brick variation; fix `check-host-opening-availability` mock
  (needs `SharedAssetCache`); street chunks are piloted (opt-in `?streetChunks=1`, see HISTORY); next
  apply the shared ground line + eaves snap to the per-house path and re-run
  the fidelity gates on shifted facts.
- **Large-tier follow-ups** (`src/canalRecall/largeBuildingTier.ts`,
  ranked list via `npm run audit:large-tier`): untuned buildings show a
  uniform window grid; tune next Roeterseiland/LLC, VU, Benno Premselahuis,
  IJ-toren; roof shapes for tuned entries (Nyenrode's mansard); per-wall
  front vs blind walls; Nyenrode shows a Jumbo shopfront its panorama does
  not support — shopfront assignment can contradict photos.
- **Pand reference feed follow-ups** (`npm run pand-reference`, merged
  2026-10-09): street trees hide whole canal fronts in every year (Bloemgracht
  3/7 unusable) — add a third laterally offset panorama or the per-pixel median
  fusion from `build-pano-facade.ts`; washed-out/foliage thresholds (0.3) are
  untuned; `roofShape` is null outside `buildings-colored.geojson`; Beeldbank
  and monument-register facts are not yet joined in.
- **Drop MapLibre** — since 2026-10-30 this is P1/P5 of
  `docs/handoffs/engine-programme-20261030.md` (lane L1, `?engine=own`, weekly
  flag-gated steps on main; the long-lived-branch rule of 2026-10-10 is
  withdrawn). The local branch `render/drop-maplibre-step1-20261010` (8
  commits, 2,129 behind) is re-ported commit by commit, then deleted. Original
  notes (go; ~3–4 weeks after city-wide own ground;
  `docs/research/drop-maplibre-20261010.md` §6, prototype `no-maplibre.html`):
  overview/route preview/street labels from our own extracts match the game's
  MapLibre cameras within 1.1–3.2 px; iPhone 4× 5.8 ms frame CPU. Remaining:
  wire `ownMap` into the game behind a flag, ferry/transit/neighbourhood
  overlays, brand icons, roofline POI labels, answered-street lettering; rail,
  tram, footways, landuse, piers missing from extracts; Utrecht/Rotterdam/Den
  Haag need extracts; footprint tiles to a worker; the Leaflet map picker
  (`map-picker.js:243`) also loads live OSM tiles — replace it too.
- **Own ground ON BY DEFAULT since 2026-10-14 (HISTORY "Own ground on by
  default"; `?ownGround=0` opts out); leftovers of the original item** (city-wide, 294 cells, 29.6 MB
  gzip after 2026-10-13). Data blockers cleared 2026-10-13 (HISTORY): per-polder
  water levels, BGT width per way (73.6% of drawable ways), 931 measured
  bridges. Remaining before default-on: a desktop ride-perf measurement with
  `?ownGround=1&sharedFrame=1` (iPhone later; desktop outranks it ~10x, user);
  labels still MapLibre symbol layers; hosting quota (+0.53 MB more). Then
  default-on in the canal belt. Follow-ups from the lane: wire
  `bgt-width-by-class.json` into the 2D `ROAD_WIDTHS` reader so the corridor
  felt matches the road seen (medians: residential 5.0 m vs prior 5.2,
  tertiary 6.6 vs 4.5, secondary 7.2 vs 6.2, cycleway 3.0 vs 2.5, footway 2.8
  vs 2.0); houseboats still take one city-wide level (`setWaterLevel`); the
  per-way `bgt-way-widths.json` (311 KB gz) is staged, not published; 25
  unnumbered bridge-register rows were skipped because their positional ids
  shift; 118 movable bridges stay flat by design. Per-building chunk bases
  verified only on flat streets. Size cuts if needed: 4 m relief
  everywhere (−4 MB), drop pad tiles. Firebase deploy grows ~24.6 MB net —
  hosting storage is already over quota.
- **Elevation follow-ups** (`?elevation=1`, `docs/elevation.md`): no AHN
  ground relief (own ground has it); water level is per polder since
  2026-10-13 but every shore gets the same quay wall; route line hidden on humped decks and ramps paint over ~20 m of
  street; boats below street level not clipped at steep angles (boat mode not
  reviewed); relies on MapLibre private stencil fields; no settings toggle —
  decide default-on after a review drive.
- **Bridge register gaps**: `bridges.json` has 300 bridges; 611 named bridge
  ways (≈112 "brug"/"sluis", e.g. Noordsche Compagniebrug) get a street
  question instead of a bridge question.
- **P2: audit every installed GLB for holes** (open edges, missing faces,
  flipped normals) with a batch mesh check over `public/canal-drive/models/`;
  user has seen visible holes.

---

**Gameplay lanes G1–G7 (2026-11-08 plan `docs/handoffs/gameplay-ui-plan-20261108.md`, user: run them now, all opus; judgements via the engine-judgement session).** Merged: G7 UI debts, G1 chained stops, G3 landmark question, G4 free-ride collection, G2 daily ride + landing, G5 knowledge map + stamp album, G6 share card (HISTORY). G6 run-card share done (#295, HISTORY "Share run"); P3 follow-ups: a run-level share link and run-specific share-sheet text, a buurt title when most (not all) stops share one, confirm a real ride's legs connect in the picture (the spec's teleports fragment them), and decide whether the picture should print the names arrival revealed (it redacts unanswered stops as "Stop N" while the run card prints them). The dealt-route-without-lat-lngs share gap was a timing bug fixed by L2. G5 follow-ups done (#297, HISTORY "Knowledge map fits the known buurts"); P3: two Chassebuurt entries in boundaries.json merge under name-keyed mastery; a finer outer-district boundary set would tighten the 24 km outer frame; tap targets at that scale; regenerate the outline when boundaries/water change. **Daily pool follow-ups (#279, #291):** rotation within a shared key done from 2026-11-17 (HISTORY "Daily pool: finish rotation"); P3 a per-key weight if one finish a year for Nieuwmarktbuurt is too few. P2 the landing bundle is 80,506 B (78.6 KiB) against the 80 KiB cap after #301's distance formatter: the next addition must trim or split, and the cap should become an asserted test rather than a note. Waiting on the user (needs-david via the judgement session): Oude Pijp, Nieuwmarktbuurt and Staatsliedenbuurt have no unnamed start street 20 m clear of a named one, so they can only finish a ride; withholding a road class (highway=service names) from the street questions would let them start, a learning-rule change. The pool, finish-only places and the buurt arrival blurb landed (HISTORY "Daily ride: the bigger pool", "Daily ride: finishes on named streets"). Open from G4 (P2): the one-card rule applies only while the collection is on; in the quiz modes a drive-by card and the postcard can still both be up (making the rule general is a separate decision); bridges are excluded from checklists (Centrum has 53). G3 spaced review done (#300, HISTORY "Landmark spaced review"); P3: missed landmarks feeding the street review, SM-2 instead of the fixed [1, 3, 7, 21] ladder, 18 daily-ride buurt keys with no askable landmark, a due-landmark count once a screen lists landmark names; `landmark` in legacy QUIZ_SUBJECTS (P3). Open from G7: a tour card starts its tour by loading `?tour=` rather than in place (P3). Finish keycap clicks (#278): a probe artefact (canvas scale, see HISTORY), hover cue added; Keycap hover on the pause and run cards done (#301, HISTORY "Keycap hover everywhere"); P3: the run card has no hover check of its own. Open from G1 (P3): game.js FINISHED could read KeyE directly. **Perf re-measure done 2026-11-09 (docs/performance/desktop-20261109.md):** map render p50 did not regress (3.3 ms vs 4.1–4.2 on pre-gameplay bundles), no new frames > 100 ms, iPhone 4× all four variants pass; but the label overlay tripled (0.71–0.73 ms mean vs 0.20; budget 0.4, `ride-perf` desktop default now fails on it) → fixed by #287 (HISTORY "Label overlay cost back under budget": mean 0.91 → 0.07 ms, the per-candidate withheld screen, not the ledger). P2: the seeded ride-perf route draws no POI labels (inView 0); confirm the default ride hides POI names by design or fix the seed. perf-gate fixed (#294, HISTORY "perf-gate measures or fails"): 4 gate-owned rows measured, exit 1 on n/a. **Settled by #299 (HISTORY "Perf-gate findings measured"):** motion p99 was load noise (16.8 ×3 at load < 8; the row is vsync-quantised, a frames-over-20-ms count would be steadier — P3); `programs` re-pinned at 40 with attribution (37 measured; R4-B landmark materials). P2 fold lanes, each needing a look check: lod2 stand-ins through city-look (−3/−4 programs), one shadowSide for all casters (−2/−4), defer boat/transit compile on bike rides (−2); back to 36 when they land. External rows 34 → 20 (#309, HISTORY "Perf-gate rows: spec-enforced, report-only, --aerial, opt-in pop-in"); P3 left: `--aerial` runs aerial-pan headless and hung once for 2 h+ (#310) — pass `--chrome` and add a wall-clock timeout to the collector; aerialLabelChurnPerSec has no summary key; drop iphoneMapLibreWorkersMB once own is default; the aerial wall time is unmeasured.

**Judgement verdicts 2026-11-09 (the engine-judgement session, relaying the user):** every hand-back since L1 accepted. P2 follow-ups: L4 — 390×664 photo cards covering the bike and the STAMPED seal over long names; #295 — title the share picture by the finish buurt or "N buurten", not "Amsterdam", and give runs their own link. Settled: #300's fixed 1/3/7/21 ladder stays and missed landmarks do not feed the street review (a different skill); #296 item 2 the share picture stays English (no needs-david); item 3 moot with the daily ride off; item 1 measured by lane M1 #312 (0 POI labels with candidates = P1). **Register facts #316 (HISTORY "Register facts"):** next a recipe-reads lane behind `?registerFacts=0`, 164 golden records, the Grachtenboek sample. **User decisions 2026-11-09:** "no daily ride, no gameplay element in free ride" → F1 #311 done (HISTORY "F1"; `featureFlags.ts`, `?ride=daily`, `?collection=1`, `?freeRideQuiz=1` opt back in; #279/#291 follow-ups stop); #306 the boat stays the first ride ("boat is more fun somehow") → done in F1. User asks from a Free Ride on ef73a29: S1 #313 done (HISTORY "S1"; open: the zoomed-out desktop pose, n≥3 start timings on the user's Mac, iPhone unchanged because baked shells are off on touch), S2 #314 (landmark clicks and bridge pins out of the waterways), S3 #315 done (HISTORY "S3"; open: strips at the four poses, the per-landmark overhang pass, `check-roof-exterior-support` red on main). Later the same evening: S4 #317 done (Javaplantsoen, HISTORY "S4"), F3 #318 done (HISTORY "F3"; open P3: boat-mode snap-to-centreline recovery as another invisible path, the landing spot under the IJ-hal canopy), P1 #319 done (HISTORY "P1"; open P3: R2-6 measures unpaused, keycap-hover flake, a landmark card under the pause card in desktop Free Ride), F4 #320 rule merged, report NOT reproduced on the default engine/desktop (HISTORY "F4"; needs-david: device/engine; parked: iPhone + own-engine runs, Leidsestraat spot), D1 #321 done (HISTORY "D1"; open P3: website-only POI rows, the `named()` fallback path, Storybook states), D2 #322 done (HISTORY "D2"; open: ASC SDW plaza/pavedLinks, the 4,369 service-stub dead ends); all code-complete, merging in batches under the 2026-11-09 token budget (≤3 lanes at a time, see memory). A dock-and-transform-into-bike idea is being assessed by the judgement session; no lane yet.

**Jev facade judge (J1 #326 spike done 2026-11-10, HISTORY "J1"):** P2, needs the user's go — Jev can own bay count (±1) and shopfront; gable and finish only as a filter with review. The blocker for any city use is crops: ~226 rectified facade strips exist against 192,567 pands. Next step if wanted: a crop pipeline (panorama per pand → rectified strip) plus a ±1 bay / shopfront pass on one buurt, judged against the block-face intents. The user should rotate the TypeSafe key now that the spike is over.

**House assembly line (approved by the user 2026-11-10; plan `docs/handoffs/house-line-plan-20261110.md` on plan/engine-round5-20261108):** P1 — one HouseSpec record per pand feeds every render path; then a Node elevation preview, a nightly batch publish, a crop pipeline feeding Jev, the register and pixel measurement, and a kit-gap queue. Running: H1 #337 HouseSpec + adapters + tiled extract behind `?houseSpecs=0` (critical path; its pipeline.ts hash fix for monument-facts.json/registerRecipe forces one full world recompile at integration), H2 #338 `house:preview` in Node, H4 #339 crops + one pilot buurt (absorbs the crop pilot #336). Queued: H3 publish and H6 kit-gaps after H1, H5 describe after H1+H4, H7 pilot after H1–H5, H8 docs last; merge order H1, H2, H4, H3, H6, H5, H7, H8. A lane without its documentation diff is not done. `registerRecipe.ts` (`REGISTER_FACTS_DEFAULT = true`) stays on as the first spec writer (era, finish, gable). a1's buurt lanes landed their staged batch and hold installs (kit parts and records only) until H1–H3 merge, then resume as spec writers. Branch-only installs NOT to merge as installs (a1, lane/belt-haarlemmer-20261110 and siblings): GG-West 6, GG-Zuid 4 (Keizersgracht 596–648 r1/r2), Haarlemmerbuurt 9, Frederik Hendrik 9 — they go through `house:stage` as the first batch once H3 lands; the GG-West row is H7's candidate. That branch also carries `BlockFaceIntent.schemaLimits` as `{component, what}` (H1 adopts it) and `stripWhiteBalance.ts` (H4 may reuse).

**User asks 2026-11-10:** P1 — "when you have a result you're happy with for nassaukade, I want a demo/explanation": once the HouseSpec line renders face `nassau-145-152` (H2b sheet + H7 acceptance pair) to a standard the judgement session accepts, the judgement session builds the explainer page from H7's demo bundle (`artifacts/house-line/demo-nassaukade/`: photo crop, before/after renders and measures, spec with provenance, fields.json, desktop/phone ride frames; H7 brief b4a3ec2ef). Nassaukade is H7's third pilot row; the integrator forwards the H7 hand-back. P3 — Dutch cards: the card's source link should go to nl.wikipedia when the facts shown are Dutch (`textNlSourceUrl` is stored but unread; Q1 #335 finding). P3 — `signature-landmarks.bundle.js` comes out of `check:canal` with different minified identifiers than a clean `node scripts/build-3d-bundles.mjs` (deterministic on its own); some gate step builds it from different inputs. Find it so gates stop dirtying the bundle. Run `npm run check:free-ride` under the lock after landmark-placement / `freeRide*.ts` / water-mask changes.

**House-line findings 2026-11-10 (judgement verdicts on #338):** P1 — H2c #340 (sonnet, running): `measureFacade` reads trim as wall (Nassaukade lit sheet: wall #b0a99a = white trim vs a dark-brown render), so every line verdict is suspect until it lands; it must not silently flip installed likenessGate verdicts. P1 — pand 0363100012116526 (Nassaukade corner, seven bays, dormers, roundels) renders as a blank brown wall in the ride: `chunk-face-clercq-236681` suppresses it but models only its De Clercqstraat face. Folded into H7's Nassaukade row (face nassau-145-152): H7 makes that face render, via the block-face route or the covers/suppression, chosen with a before/after frame. Suppressed-face audit #341 (haiku, 5502f5b35, read-only; merges after H2 since it is based on H2b): 1,033 suppressed pands, 1,483 street walls ≥ 4 m, 110 blank (1,938 m; 76 no outward geometry, 34 bare slabs); centre 9 buurten (Het Funen 17 walls/274 m, Kattenburg 8/135 m), inner ring 22 (Houthavens-West 5/93 m). Follow-ups running on the same lane: `house:preview --wall`, a 20-row sheet framed on the flagged wall + ride frames for the top 5 and a false-positive rate (Funenpark/Kattenburgerhof/Laagte Kadijk may be courtyard or party edges), the 544 landmark-covered pands, coverage at 25/50/80 % height. P2 — fix the confirmed blank walls as one `house:stage` batch after H3, one spec or chunk extension each, ride-priority buurten first. P1 (prevention, in the H3 brief) — `house:publish` runs the audit for every pand a batch suppresses and refuses a batch that leaves a ≥ 4 m street wall blank. Integrator: add npm scripts `house:audit` and `house:audit-sheet` at merge. **Belt restart** (a1 closed 2026-11-10, integrator owns it): after H1–H3 merge, restart the 12 belt lanes as spec writers from `docs/handoffs/a1-belt-lanes-handoff-20261110.md` (branches, heads, branch-only installs) with the two a1 briefs, swapping their capture/install steps for `house:preview` and `house:stage`. a1's facade-extras frame-time A/B (f56a2c4f9 vs d1436bdcc, desktop, one standing pose): no cost beyond noise; repeat on a moving route if facade extras ever show in a profile.

**H1 rulings (judgement session, 2026-11-10, #337):** P2 — spec wall colours reach the game only through the city look's palette lift, judged on ride frames against the photo (`SPEC_WALLS_HELD` stays on until then; raw measured hex darkened Kinkerstraat, against the brighter-palette priority). P2 — spot-check the 403 bay-count changes after H2 lands: haiku lane, 24 random bay-changed pands (centre and inner ring first), `house:preview --photo` before (HOUSE_SPECS=0) vs after, measureFacade column count vs the photo's; if after is not closer on ≥ 80 %, the judgement session rules on a hold. P3 — pand 182858 (L footprint, fill 0.41) gets no planned roof; planRoof unchanged for now. Rollback for the baked world is HOUSE_SPECS=0 at compile plus republishing the previous world-v1; `?houseSpecs=0` works only on `?world=live`.

**Loose ends 2026-11-10:** P2 — the user should rotate the TypeSafe/OpenRouter key (J1 spike over; lanes never cache it). P3 — `?shopGrammar=1` (a1, ee9a6e256: shop ground-floor paint from 299 measured storefronts, colour only) stays off until a ground-level strip is compared with panoramas; then decide the default. P3 — the What's New notes "Trees no longer blink" and "Calmer distant landmarks" have no image. P3 — recheck IJburg at street and aerial poses for the sky-blue ground after any fog/drawLimit change (the per-pixel fog depth fix; HISTORY "Sky-blue ground fixed"). Running lane: P6 #334 tree tiles, tree shadows and the iPhone tree look (the pop-in P3 items above).

**S2/S5 follow-ups (#314, #333; HISTORY "S2", "S5"):** P3 — V2's staged centre fixes (`staging/landmarks.water-fix-20261110.json` on lane/v2-westertoren-shots-20261110 at 67449a57c, 18 changes incl. a 1.2 km Canal Ring Area move) are unreviewed; S5 made them unnecessary for pins. P3 — `free-ride-water-taps.spec.ts` (`S2_GATE=1`) and `free-ride-pin-snap.spec.ts` (`S5_GATE=1`) are not in a periodic gate. P3 — 1–4 Free Ride pins stay on buildings wider than the 15 m nudge. P3 — the "More Dutch on Dutch cards" and "Free Ride pins stand at their landmark" notes have no image (the S5 Westermarkt strip was never shot: `/tmp/s5scratch/strip.sh` on a fresh server).

**Pop-in follow-ups (#325 P2, #328 P3, #330 P4, #332 P5, merged 2026-11-10; HISTORY "P2"–"P5"):** P3 — iPhone aerial: pixel change charged to trees rose (mean 286 k → 483 k) although no rebuild pops; inside camera-motion noise, but look at a recorded iPhone flight before calling it a win there. P3 — from the air the 12-tile tree budget drops and re-fetches the same tiles (10–22 k tree parts each time); keep tiles longer. P3 — tree shadows still switch in one frame. P3 — street haze on landmarks rests on one measured landmark (Munttoren −12 % contrast at 1,255 m). P3 — `?drawLimitAirM=2500` halves visible aerial pops (49 → 24) and saves 18 MB; needs a look review. (The two tree checks and the `test:engine` flake were fixed by Q1 #335, HISTORY "Q1".)

**Ride review round 2 (#298, 2026-11-09, `docs/reviews/ride-review-2-20261109.md`, strip `ui/2026-11-09-ride-review-2/`, 146 frames, 15 defects; HISTORY "Ride review round 2").** Running: R2-A done for R2-1 and R2-10 (#302, HISTORY "R2-A: a reload mid-run keeps the leg"); R2-9 decided: the boat stays first (user 2026-11-09, #306, "boat is more fun somehow"; F1 #311 records it), R2-B done (#303, HISTORY "R2-B: the Dutch game speaks Dutch"); R3-A done (#307, HISTORY "R3-A: Dutch ledes and Dutch map labels": 164 Dutch ledes, 0 English labels); N1 #323 filled 56 of those 132 with sourced nl.wikipedia sentences (HISTORY "N1"); left P3: 76 sets whose nl article is silent on the fact, R2-C done for R2-5/6/11 (#304, HISTORY "R2-C: phone buttons…fit"); R2-12 done (#308, HISTORY "R3-B"; open: landscape and the street-card number at 390×664); P3 left: R2-15 hint strip takes the postcard's band, keycap-hover spec flaky under load (luma 0/0 once), R2-D done (#305, HISTORY "R2-D: the landmark question asks about buildings"). Unassigned P3: R2-13 Free Ride plaque title is a bare "—" and desktop/phone say different things at an empty spot; R2-14 the 89-stamp album mixes whole districts (Centrum, Noord…) with buurten (see #297 open note on the boundaries set).

**Ride review #280 (2026-11-09, strip `ui/2026-11-09-ride-review-gameplay/`, 75 frames, 12 defects), judged; all P1, opus, in this order within the four-slot cap.** L1 #281 done (HISTORY "L1: the landmark question never asks about a name just on the map"); follow-ups: own-engine label fade done (#288, HISTORY "Own-engine labels fade"); P3 landmark-question-reveal case 2 under ENGINE=own needs an own-engine pose for the Brakke Grond label (pre-existing); P3 a leaving label keeps its glyph angles for 300 ms on a fast turn; P3 the two Storybook approach states render a landmark card; P3 street names from road-network.js are not in the ledger. L2 points + share link: done (HISTORY "L2: run points coherent"). L3 stamps + Dutch: done (HISTORY "L3: one stamp count everywhere"); i18n pass done (#290, HISTORY "Dutch strings on the arrival card"); the phone footer fit is done (#292); P3: "Reeks beëindigen" touches its button edge on the phone; P3 content: destination/landmark names and Wikipedia blurbs are English data in the Dutch game (Oude Kerk vs Old Church); decide whether the share-card picture stays English (needs-david via the judgement session). L5 collection: done (HISTORY "L5: one buurt rule"); P3 follow-ups: a place far back from the road gets the 120 m reach (check at the Maritime Museum in a real ride), "DeLaMar (West)" extract oddity, render the two new FreeRide Storybook states. L4 phone: done (HISTORY "L4: phone cards"), round 2 done (#292, HISTORY "Phone polish round 2"); P3 left: an off-screen coin has no cue with the minimap off, the pause card's buttons may shrink the same way (presentationRuntime ~1436), landscape phones outside the hint rule, a short-phone card without an action keeps the full layout. One distance formatter done (#301); P3: the arrival and pause cards' live-distance stats still use `toFixed(2)`, and the pill's "Learning near home" is hard-coded English. Done at merge: travel mode on the daily hook, reload-mid-run (HISTORY "Hotfix"). **Daily pool, ruled 2026-11-09 (#279):** a finish may sit on any routable named way as long as the arrival card, plaque, share card and landing never print that way's name (assert in the pool test); starts keep the 20 m rule (the start street would be the first question); measure the five centre buurten over 365 days, and if Staatsliedenbuurt or another centre buurt still has no start, the road-class withholding (1) goes to the user as needs-david. Buurt extracts: 64 of 65 finish names covered (HISTORY "Buurt extracts" ×2, #289 #293); IJselbuurt sourced 2026-11-09 (HISTORY "IJselbuurt sourced"); P3 the thin rows (Rijnbuurt, Scheldebuurt, Van Galenbuurt) would gain from amsterdam.nl / Stadsarchief texts the fetch tool could not reach; P3 runtime guard: `buurtFinishBlurb` could redact the finish way's name instead of relying on the data test.

## P0 — Red, or actively teaching something false

- **Tier probe thresholds are uncalibrated** (2026-10-31): mid > 8 ms and low SwiftShader at DPR 1 probes 6.8–7.0 ms, under the 8 ms mid threshold, so the fill probe cannot detect a weak GPU limited by triangle count; only the renderer name sends it to low (materials 2026-11-01). M4 pin: auto vs `?tier=high` 0–11 px at westerkerk/nassaukade, rerun with `ENGINE=own WORLD_AB=1 WORLD_AB_STALE=1 AB_CAMERA=fixed AB_NOISE=1 AB_DPR=2 AB_SPOTS=westerkerk,nassaukade AB_QUERY=governor=0 AB_B_QUERY=tier=high npx playwright test world-v1-ab --project=desktop --headed`.
  > 25 ms on the ~1 s probe come from one M4 Pro (1.5 ms) and SwiftShader
  (13–14 ms); a real mid-class laptop and an Android phone have never run the
  probe. Until they do, `?tier=` forcing and the Sentry graphics-failure
  counts are the only check that nobody lands in the wrong tier. Also: on the
  SwiftShader proxy every tier sits near 2 fps, so `weak-gpu-perf` cannot
  show a tier difference (the proxy is too slow to be a mid-class stand-in).

- **`?engine=own` on a real Mac (2026-10-31, user ride):** reported slow, janky,
  fan, pop-in and a blurry (~2× upscaled) frame on the deployed site; a fresh
  localhost build "looks great". Root cause found: stale cached bundles (18
  stale `?v=` stamps), fixed by content-hash stamping at deploy (HISTORY
  "Deployed pages stamp every asset"). Real-GPU table delivered (M4 Pro,
  DPR 2, #129): own engine frame p99 9–19 ms vs default 58–75, sharp, no
  governor step-down; GPU frame ≈ 5 ms p50 at the Dam/Westerkerk, own ground
  1.3–1.5 ms of it (materials lane 2026-10-31, nothing pixel-identical saves
  anything measurable, so fill is not the owner on this Mac). The user still
  feels stutter on localhost `?engine=own`: owners are main-thread hitches,
  named per task by `motion-stutter.mjs` under own at DPR 2 (HISTORY "Stutter
  owners under `?engine=own` named", "Seeded-route stutter owners fixed").
  Seeded route meets the P3 gate at 1× (long tasks 10 → 0, longest 600 → 68
  ms). Jordaan after the 4× round (HISTORY "Per-frame CPU under
  `?engine=own` at 4×"): 1× no task > 50 ms, longest 34 ms, but streaming
  tasks > 16 ms remain (`splitIntoTiles` in ground `cutMesh` 48 ms, chunk pand
  bases 57 ms); 4× owners per 60 s: three-buildings `t4`/`setFeatures`/`post`
  ≈ 1.8 s, `_applyChunkPandBases` ≈ 1.2 s, `buildShadowStandIn` on landmark
  `_add` 1.1 s, `splitIntoTiles` 0.4 s; render pass 13 s sets p99.
  `pop-in.mjs` runs under own since hand-back (9); hand-back (10) settled its
  3,500 px/s "unexplained" own figure: chase-camera turn parallax on the
  Westerkerk tower, counted only under own because the script skipped turn
  frames by a > 2° bearing step (MapLibre turns in jumps, the own camera
  turns ≤ 1.33°/frame); the script now also skips frames turning > 60°/s.
  Re-summarised, car route 60 s: total pop MapLibre 1,480 vs own 1,846 px/s,
  unexplained 563 vs 1,263 (the slower tail of the same turn, parallax not
  pop), landmark-model 592 vs 452, trees 4 vs 131, ground cells / building
  chunks 0 / 0 in both. Hand-back (11): the P3 pop-in gate is met (0
  installs within 150 m under both engines, nearest chunk 154 m, thin);
  `buildShadowStandIn` and own-ground `splitIntoTiles` are off the main
  thread; ARTIS is off the camera shim (B6 started). Streaming gate still
  open (HISTORY "Facade chunk tiles planned in the worker"): facade tiles
  are off the main thread (436 → 0 ms at 4×) but the 4× totals did not move;
  hand-back (16) named the engine frame's owners with `?framePhases=1`
  (HISTORY "Engine frame owners at 4×"): label policy spikes fixed, rebuild
  52–70 ms per learned street left (test only changed streets, L1), game
  frame spikes = own-ground install 40–178 ms / setFeatures detail centre
  34–53 / move listeners 35–46 (L1 splits), `three render main` CPU is
  matrix updates from the eye-relative wrapper (frozen matrices for static
  meshes approved, L1); hitches over 50 ms/min 79→62, 64→53, 88→76, 70→66,
  longest frame unchanged ~150–177 ms. Perf viewport is now 1512×982 at
  DPR 2 (the user's screen); earlier tables were at 1800×1100.
  hand-back (13) paced `prepareCell` planning on the page (HISTORY "Ground
  planning paced on the page"): 1× frames over 50 ms 1 → 0, the 4× ground
  continuation 115–171 → 19–22 ms; the 4× worst frames are now the engine
  render callback and cell-decode continuations (next split: `withOpenings`
  → `groundCrossing` ~11 ms, L1); `setFeatures` 606 / `_applyChunkPandBases`
  374 / `post` 219 ms at 4× before the materials facades package (on main
  2026-11-01, HISTORY "Facades package"): exact single-pass tiles, 2× context
  index, 2.7× segment grid; headed 4× frames over 50 ms 4 → 1 per minute,
  longest 100 → 59 ms, `setFeatures` max 167 → 90 ms; materials next: the
  pre-painted atlas (settle hold + texture painting), then procedural noise
  and shader programs off the boot path; signature-landmarks `_requestModels` is gated since
  hand-back (14) (skipped only while the request revision, models,
  generation and view-within-slack are unchanged; shadow check 0 misses in
  6,8xx skips; 4× stall 1124 → 196 ms/min; `?landmarkGate=0` turns it off);
  `withOpenings` runs as tasks (water cell decode continuation at 4× 51–55
  → 5 ms; the work now sits in its own `groundCrossing` task, 33–37 ms at
  4×, L1 paces it internally next). The overview build in the worker pool
  is on main (hand-back (15): the desktop stall was the surprise picker's
  seed shift, fixed; boot → submit ~1021 → ~770 ms). The longest frame
  under own at 4× (40–56 ms) is the engine's render callback: L1 profiles
  its owners next. Camera shim: 561 → 156 calls/s, nothing left on it is a
  camera read (`jumpTo` write, `checkIdle`, repaint requests).
  Idle rendering (fan) is fixed under own: render-on-change on main, 0
  renders per 5 s at rest; the default engine still renders every idle frame
  until the flip.
- **Heap gates** (HISTORY "Phone heap cuts"): desktop 436 MB meets ≤ 500;
  iPhone 305 MB against ≤ 250 (moved from 160 on 2026-11-01, user
  delegated: 160 assumed the post-flip state without MapLibre's duplicate
  building source and workers; re-evaluated after the flip). Owners left on
  the phone: shared frame 135 MB (88 MB buffers; materials/L1), own-ground
  store 43 (road lane: per-cell contents and never-read copies), building
  cache 33, track 24, overview 20, landmark CPU arrays 24–36, facades 14
  (materials). Taken: 6 phone building tiles instead of 9 (road lane, after
  the spawn-pose item; pop-in gate re-measured on the phone profile). `no-maplibre.bundle.js` has no npm build script (old overview
  decoder inside, still works): add one before the flip. `engine-own.spec`'s `heapMB` is noise without a GC;
  `scripts/heap-ride.mjs` is the measure.
- **Time to ride under own ≈ 3.5 s median, three of six runs within 70 ms of
  the 4 s gate**: the settle hold waited on facade chunks that could not
  build until the atlas (painted on the main thread in 6 ms slices) was
  bound; chunks now build while it paints (settle 850–1160 → 661–716 ms,
  racing after submit 2055–2459 → 1885–1967 ms), the ≤ 0.3 s hold target
  needs the pre-painted atlas (materials); racing never starts without
  facades since the hold fix (HISTORY "The own engine never races without
  facades around the rider": styling hurried behind the loading screen, hold
  timeout 4 s, `engine-own.spec` checks the first racing frame; the hold
  still times out at 4.7–4.8 s because it waits for every chunk of every
  loaded tile out to 1.9 km, built one at a time at 2–3 chunks/s with
  300–500 ms round trips: materials settles on a ring and fixes build
  throughput, exactness-pinned); boot → submit 0.84–1.03 s vs 0.48–0.57
  default, owners named (HISTORY "Binary road extract is Amsterdam's
  default"): engine overview build (now in the worker pool, ~250 ms off
  boot → submit, main-thread construction 213–224 → 13–20 ms),
  three-buildings texture painting ≈ 117 ms (materials: ship a
  pre-painted atlas, which also ends the settle hold on the atlas bind),
  own-ground procedural noise ≈ 110 ms, shader programs ≈ 75 ms (materials).
- **Two iphone spawn-pose failures on main** (road lane): `street-follow-tap`
  3/3 (binary, JSON and fresh bundles alike; the seeded spawn is on
  Amsteldijk on a straight path, so the "waiting for a side" premise is
  stale) and canal-recall "HUD withholds an unanswered street" (on dec13c446
  `track.getRoadName` returns "" right after `openCarRoute` on iphone, desktop
  passes). Isolate JSON vs binary and before/after c1ddabe3c, then re-pin
  the pose; neither is called a regression until that bisect says so. `compileAsync` "isReady of undefined"
  after context loss, seen once (materials lane).
- **Weak-GPU low tier cannot meet p95 ≤ 33 ms on SwiftShader** (HISTORY
  "Weak-GPU low tier"): its steady frame is ≈ 290 ms, triangle-bound, and no
  single layer removal gets under 195 ms. Gate stays red as written; deciding
  what the low tier may drop (trees, landmarks, overview beyond the ground)
  needs a real weak device and the user's pixel budget, not a proxy. Related
  P4 numbers: own ground at the Dam 1.78 M triangles on low / 2.21 M on high
  against the 700k iPad budget (materials lane, 2026-11-01).
- **POI/business labels through buildings under `?engine=own`** (user
  screenshot, Eerste Constantijn Huygensstraat; "we still need more
  occlusion"). Round 2 on main (HISTORY "Label occlusion round 2"): 16 → 1
  at the user's pose, Dam 27 → 0, Westerkerk 14 → 0–1; street/water names
  occluded too; `street-label-occlusion.spec` passes under both engines.
  Round 3 (HISTORY "Label occlusion round 3"): street names re-tested per
  copy while riding, budget 8 sightlines a frame (100–137 µs). Left: Cafe
  Kompleet, a roof-height case (saltbox 17 m in front hit at 7.9 m on screen
  while the sightline clears the walk's top): test at the glyph top or use
  the ridge for occluders within ≈ 25 m (materials, after the facades
  package); riding POI samples through buildings ECH 25/22, Westerkerk 62,
  Dam 4 per 6 s. The user looks at this next on the deployed `?engine=own`.
- **Extract refresh drift (found 2026-10-31, #147).** `scripts/
  refresh-amsterdam-extract.sh` from the same archived PBF no longer
  reproduces the committed extract: streets-routing 47,259 → 45,620 ways
  (centres/paths differ on 45,136, highway class on 34,701), streets 343 →
  500, trees moved on all 35,000 with 2,623 species changes, enrichment
  text/images/distractors on hundreds of features, neighbourhoods 87 → 85,
  331 new Ollama translations (some outside Amsterdam). The committed data
  carries later curation the refresh discards. Before the next full refresh:
  find which steps drifted (routing filter, tree source, enrichment caches),
  make the refresh reproduce the committed extract from the archive, and
  only then let it move data. Staged outputs from the comparison were under
  the lane session's scratchpad (`regen/`, `stage/`), not kept.
- **Phone: the camera zoom snaps when a question card closes (2026-10-22;
  needs a repro, 2026-11-09).** Seen in the teaser phone shot: the card hides
  and the view jumps to a different zoom in one frame as the d-pad returns.
  G7 (#277) measured a real iPhone ride (player zoom set, 0.8 of top speed,
  route question answered, 340 frames sampled): no frame moved camera zoom,
  speed pull-back or world zoom by more than 2 %, and `_applyPrefsToRuntime`
  never ran, so the game-route.js lead is out. Not covered: a real pinch and
  riding off after the answer; next place to look is the pinch handling in
  `presentationRuntime.ts` (~368, ~401). Needs the user's device, view and
  whether they pinched. The start-of-ride overview flight hitch (about 0.4 s
  frozen, then a jump) is still open.
- **Road rendering: surveyed BGT surfaces replace OSM bands (user, 2026-10-16;
  plan `docs/plans/road-surfaces-roof-rules-20261016.md` Part 1, approved
  2026-10-16, user chose BGT polygons over patching the band model).**
  Screenshot at the Marnixstraat busway × red cycle street by the Tweede
  Marnixplantsoen: red cycle bands over the grey and onto the pavement,
  pavement wedges inside the junction, bands of different widths overlapping,
  zebra and centre dashes running through the junction, a deck slab wider
  than the road, rails on a different grey. Cause: one fill per OSM node,
  no band-vs-band clipping, crossings and rails never cut, 18 m trim cap.
  Data lane DONE 2026-10-16 (HISTORY "roads-v1": seven pilot cells
  published, 696 KB; city-wide 9.7 MB gz staged in source-data
  `datasets/bgt-roads-20261016/`, publish it with phase 2; cycleway cover
  47 % because mixed fietspad/rijbaan ways fail the 80 % rule, lower the
  threshold or treat them as painted lanes; 400 h ≥ 1 polygons over no
  deck on the A10/harbour viaducts). Runtime DONE behind `?roads=bgt` (HISTORY "Roads from the
  surveyed BGT surface"). Phase 2, in flight: topology-preserving
  simplification in `build-bgt-roads.ts` (shared edges identical, probe
  `--pairs` to 0), Fietsstraat red decided per section in the extractor,
  city-wide extract within 350 KB gz per cell, re-aim `roads-v1-spots.json`,
  survey gaps at junctions (land where pockets used to pave), the LOD 1 far
  ring, then default on with `?roads=0` and a desktop ride-perf check.
- **Hosting quota will hit again within a day of pushes.** Deploys failed
  with HTTP 429 from 14:27 to ~19:45 on 2026-10-13 and recovered without
  the integrator pruning; the dry run afterwards still listed 374 deletable
  canalrecall versions (40 GB) against a 10 GB quota. Run `npm run
  hosting:prune` then `-- --apply` (or the manual "Prune Firebase Hosting
  versions" workflow) now, and when a push does not reach
  `<site>/deployment.json`. Longer term: fewer deploys (schedule or manual)
  or the Blaze plan.
*Anything that makes the game teach something false, or traps the rider,
belongs here before anything below it.*

**Bridges: one sweep artefact left; extend the sweep to non-bridge seams.**
After the union guard and the union-aware shoulder (see HISTORY, 2026-10-01),
the full sweep (`BRIDGE_SWEEP_ALL=1`) drives 3,006 crossings with 2,875
arrivals and 0 traps. Its only wedges (14 frames in 2 drives) are Burgemeester
Fockstraat (`routing_11260` F, `routing_13031` R). The sweep starts inside the
Menno ter Braakstraat cul-de-sac, which raw OSM joins to Burgemeester van
Tienhovengracht only by footway + steps (excluded on purpose). Next:
- Seams are not only at bridges: run the same "step toward any road is kept"
  probe across ordinary junctions where a path ends a few metres from a street.

Measured and dropped: a junction disc at every graph node (closed no extra
case, and the ~150k extra spans made the harness time out), and stopping the
heading ease from turning against the rider's steering (wedges rose to 71).
Snap skips remain: 482 `noSnap`, 70 `noRoute`, 1,276 `missesDeck`.

---

## P1 — The learning model itself
- **Building articles, remainder (2026-10-31).** Shipped: article cards on
  1,251 buildings, 793 street ride cards, 1,427 clickable street-art points,
  7 promoted landmarks (HISTORY 2026-10-31). Open: 185 article footprints
  are not in the streamed tiles (`staging/building-articles-untiled.json`;
  167 outside the Amsterdam box, 18 inside and mostly non-buildings) and
  stay silent until the tiles grow; street-art points with no article (439)
  show only kind/artist/year from OSM; the `art` orientation category has no
  own icon yet (culture label class). Issue #142.
- **Follow-the-street touch steering, follow-ups (2026-10-29).** Shipped as
  the phone default (HISTORY 2026-10-29). Open:
  - Feel check on a real phone by the user; no one has ridden it on glass.
    Tunables are `STREET_TURN_RATE`, `CORNER_FRACTION`, `QUEUE_HOLD_SECONDS`
    (streetFollow.ts) and `CAMERA_YAW_DEFAULT` (cameraYaw.ts).
  - The follow heading now aims ~25 m down the street (HISTORY 2026-10-29,
    look-ahead). Its gain on the Prinsengracht zig-zag is modest in the sim;
    judge it in the real-phone feel check above. `LOOK_AHEAD`/`AIM_SECONDS`
    are the knobs, `SF_NO_LOOKAHEAD=1 npm run test:street-follow` the A/B.
- **Public preview follow-ups (2026-10-17).**
  - User: Sentry projects/DSNs and `SENTRY_AUTH_TOKEN`, reCAPTCHA Enterprise key
    as `APPCHECK_SITE_KEY`, App Check registration (monitor, then enforce);
    Firebase Auth authorized domains for `/quiz/`; attach `edumap.blackmad.com`
    so the 301 works; check query strings survive it.
  - Stamp/route sync only tested with an in-memory fake; test with a real
    sign-in once the rules are deployed.
  - Real Google sign-in across /ride, /quiz/ and /progress untested (lanes had
    no Firebase config). No account control while riding (by design so far).
  - Rules deploy needed for poiStamps (and the stricter gameSessions).
  - No landmark-name question exists, so 'named' stamps never fire.
  - Explorer: Centrum is one 99-building bucket (no Burgwallen-level areas in
    `boundaries.json`); rerun
    `build:explorer-index` after model installs (add `--check` to check:canal).
  - Clarity finding 16 (HUD names the start street before any question):
    awaiting the user's decision on whether that street can be asked later.
  - `check:canal` red on main (pre-existing, found by the dead-code lane):
    `test:look` — `face-gorontalo-25-47-r1` has no entry in
    `chunkWallExposureData.ts` (rerun `build-chunk-wall-exposure.ts`);
    `test:tile-buildings` — pilot-tiles golden `16/33655/21538` per-pand
    geometry changed.
  - First-load next wins (docs/preview/first-load-2026-10-17.md): Bricks057
    texture at q≈100 (~1.1 MB), Wikimedia card photos at 960 px (~2.5 MB),
    lazy park/bridge extracts; iPhone not measured. Share toast overlaps the
    desktop arrival card's bottom edge.
  - Explorer looks: Rivierenbuurt/Spaarndammer/Indische types lack kit
    thumbs (rerun `scripts/coverage/build-look-thumbs.ts`); design kit keys
    are thin; rerun `build:explorer-looks` after coverage/chunk/index regen.
  - Sentry symbolication for the ride is wired but unverified end-to-end
    (2026-10-23): the next error after a deploy should show TypeScript frames
    for `js/*.bundle.js` in the `canal-recall` project's release for the
    deployed SHA. Check it, then drop this item.
  - **Owner setup (not code):** (1) `bash scripts/setup-sentry.sh` → secrets
    SENTRY_DSN, SENTRY_DSN_MAP_QUEST, SENTRY_AUTH_TOKEN; (2) reCAPTCHA
    Enterprise key (`gcloud recaptcha keys create …`, docs/MONITORING.md) →
    secret APPCHECK_SITE_KEY, register both web apps in Firebase App Check
    (monitor first, enforce Firestore after a week of clean metrics);
    (3) canalrecall.blackmad.com now 301s to rideamsterdam.nl in Firebase but
    its Namecheap DNS still points at 45.63.21.43: replace that A record with
    CNAME `canalrecall-blackmad.web.app`; optionally edumap.blackmad.com;
    (4) DONE 2026-10-21: rideamsterdam.nl served by Cloudflare Pages (HISTORY);
    open: a www → apex redirect rule, and retire the Firebase Hosting deploy
    once Pages has run clean for a while; (5) real Google sign-in test across /ride, /quiz/, /progress
    on rideamsterdam.nl; (6) DONE: domain bought (rideamsterdam.nl).
  - Decisions pending: clarity finding 16 (HUD names the start street);
    whether this session or integrator-f5 runs the recipe-tile compile pass
    (district libraries + stale pilots, width quantisation) and step 4 (mid
    tier, then the `recipeTiles` default); Bellamybuurt next types
    (Hasebroek 21–37, Wenslauer 1930s) + kit gaps + 21 holds.
 + the Bilderdijkstraat pilot: compile
    the district type libraries/faces with `compile-recipes.ts`, review,
    publish, rerun `build:explorer-looks` (looks switch to live by
    themselves); then step 4 and the `recipeTiles` default. Phone: the
    explorer path badge sits over the 3D view's lower left.
  - **Landmark z-fighting (estimate, 2026-10-17):** survey in
    `docs/zfight-survey-2026-10-17.md` (re-run: `npx tsx
    scripts/landmarks/zfight-patches.ts --top`). 247 of 351 landmarks fight
    above 0.5 m². By size: 5 over 500 m² (bercylaan-801-855,
    jacob-bontiusplaats-9, jodenbreestraat-11, valley, frascati), 13 at
    100–500, 47 at 20–100, ~180 under 20 (mostly invisible at ride
    distance). The top-30 causes repeat: flush cladding/bands on a wall (11),
    panels 2–3 cm proud of the wall (8), window frames 2–3 cm proud of an
    unholed wall (6), roof glazing strips 3 cm up (3), doubled faces (1).
    Plan, cheapest first: (1) one lane (~half a day, Opus) finds the shared
    builder helpers that emit 2–3 cm offsets and flush overlays and changes
    the offset to ≥ 6 cm or cuts the wall hole, re-exporting every model
    that uses them — likely clears most of the 20–500 m² band at once; (2)
    the 5 worst by hand, ~30–60 min each (~1 lane-day); (3) leave the
    sub-20 m² tail behind the 0.5 m² gate for new exports only. Magna Plaza
    took one lane-hour by hand, so per-builder fixing of all 247 (~120
    lane-hours) is not worth it; do (1) first and re-survey.
  - Visuals follow-ups: Westerkerk row count in westerkerk-elevations.json and side-on pediments;
    Magna Plaza x≈7.1 window column 20.9 m² near-flush; gallery renderer's
    depth bias draws false streaks; zebras missing where OSM has none
    (Magna south, Weteringcircuit west arms, Museumplein, Rembrandtplein
    busway) and OSM nodes 3–8 m off the paint; `own-ground.bundle.js` lab
    bundle stale; Europarking helical ramps and interiors.
  - Dead code left: ~1,600 module-internal exports; unused deps in
    package.json; `scripts/canalhouse-recipes/capture.mjs` needs the missing
    `canalhouse-recipes.html` (on `wip/canalhouse-recipes-20261008`).
  - `canal-recall.spec` "named bridge card" fails on main since the bridge
    lede repair (expects the register sentence in `longDetail`).
  - `test:canal-onboarding` npm script for the intro unit tests.
- **Chunks vs generic boxes, the colour gap** (2026-10-16, HISTORY "One
  wall material"): light and material now match; the generic period-prior
  palette is about twice as light as measured walls. Next: measured colours
  for generic facades next to chunks (facade-colour pipeline). Whether shade
  sides go past 0.55 toward flat overcast light is the user's call.
- **Bridges still bare after the bridge-roads lane** (2026-10-31, HISTORY "Roads across unregistered road
  bridges"): 166 OSM highway bridge ways draw a land patch (paving under look B) where the road should be, all over
  land: Westrandweg/Ringweg/Gooiseweg viaducts, Schiphol Vertrekpassage, Piet Heinkade, 11 De Ruijterkade busways,
  Johan van Hasseltweg, cycle culvert 118576817 west of the Kinkerbrug. Needs a way deck over land or the h 1 BGT
  polygons on the relief (which would paint roads under viaducts). Also: Beltbrug cycle/median bands stop at the
  abutments (covered OSM cycleways emit no bands), thin pale seams at Beltbrug ends, water specks at skewed deck
  corners (Nassauplein, Postjesweg), measured decks narrower than the survey (BRU0034, BRU0117, BRU0108).
  Lists: `artifacts/bridge-roads/work/undecked-after.txt` in the lane worktree; `probe-undecked-bridges.ts`.
- **Bridge follow-ups** (2026-10-17, HISTORY "Way decks: level over
  underpasses, chained ways, parapets at the road edges"): 22 of 1,200 street
  bridge ways still draw no surface. **PAUSED by the user (2026-10-17):**
  branch `fix/bridge-surfaces-polders-20261017` (a71c79e65, not merged)
  takes it to 1. AGV publishes no peilgebied polygons for Noord, Westpoort,
  Osdorp-west, the Bos or Waterland (PDF maps only), so
  `build-polder-levels.ts` measures them from AHN dtm_05m (median error
  +0.05 m against 120 AGV polygons; bank − 0.75 m fallback ±0.4 m). It
  moves 2,578 polygons in 98 cells, median −1.8 m, and the ground-height
  blanking now uses each polygon's level. It also fixes Gevlebrug
  (`LONG_WATER_M` decks reach their banks) and pins six polder bridges.
  Before merging: in-game before/after frames at Dijkwater, Aandammerbrug,
  Bosbaanweg, Elzenhagensingel, Michielsenweg and a Noord ditch polder
  against the orthophoto, then publish water-levels.json (and the
  ground-height output) and add `check:bridge-surfaces --max=1` (5.5 min,
  integration chain). Remaining miss: Pandorinastraat 376306137 (BRU0323
  footprint claims the crossing). Provincialeweg/Gooilandseweg are the
  Weesperbrug, already one chained way deck.

- **Bridge names and cards (2026-10-17, HISTORY "Bridges shown under their
  official spelling")**: three bridges still have no sourced card (Kaassluis,
  Melkwegbrug, Zwanenburger fiets brug). Maria Woestenburgbrug may be a rename
  (BRU0620 lists Woestenburg and Woesthoven; BAG and nl.wikipedia say
  Woesthovenbrug). The register's Simon Wiesenthalbrug for BRU0026 conflicts
  with BAG/Wikipedia (bridge 790). Uiverbrug's origin says aluminium, the
  register reinforced concrete. IJburg Baltic-port bridge names may be shifted
  in OSM; compare with the orthophoto. Three `streets.json` features share
  the edited Dutch originals and still ship the old English until the
  translate pass is re-run on streets. Railway flags were not rebuilt (needs
  Overpass). The 8 m cutoff covers the distance settle only.

- **Landmark cards, after the 43 rewrites (2026-10-16, HISTORY "Landmark
  cards")**: 92 cards are empty (mostly manual POIs and kit locations: UvA
  buildings, libraries, Vue, Pathé Noord, LAB111) and need a sourced pass; 4
  definitional cards wait on an entity check (HvA links the former HES
  article, Onze Lieve Vrouwe Kapel has two chapels, Frascati and Scheltema
  have no Wikipedia link). The audit misses thin cards that name a person
  (Anne Frank House).
  After the hollow-card pass (HISTORY "Hollow landmark cards"): 25 allowlisted
  stub cards still open (19 OBA branches; CEDLA, DeLaMar West, Lancaster
  Memorial, Drie Boertjes, AMOS) and the override format accepts only Wikipedia
  sources (kunstwacht.nl and venue sites have material); 78 empty cards don't
  open; `'t Brinkie`'s wikipediaUrl points at a missing nl article; kit model
  `winkler-prins-monument` duplicates `extract_landmarks_1897367071`'s pin.
- **Buurt generator, next** (2026-10-16, HISTORY "Bellamybuurt-Zuid: 12
  auto-placed runs installed"): 69 of 335 pands installed. Next: types for
  Hasebroekstraat 21–37 (wide arch, full balconies) and the flat 1930s
  Wenslauerstraat rows; green-tile gable over the window pair and its
  mirror; per-front dormer heights; the 21 review holds; then the next buurt
  from the coverage page (Postjeskade e.o., Cremerbuurt-West), driven by a
  Haiku lane for survey/intake/placement and Opus for types and review.
- **Coverage page gaps:** ship exemplar photo crops and building-type
  thumbnails; refresh the street-surveys data (10-10).
- **Motion stutter, next pass** (2026-10-16, HISTORY "Motion stutter";
  desktop budget now in `ride-perf.spec.ts`): label passes run 3× as often
  since today's merges (72 → 250 ms per minute at 1×), find why; regroup
  `setFeatures` and the chunk `rebuild` structured clone; MapLibre
  `sendToSource` deep clone; `_refreshColoredBuildingFilter` on landmark
  load; the 50 ms `dt` clamp in `game.js` (interpolate instead of slowing
  the rider); then measure iPhone.
- **Roads, after city-wide** (2026-10-16, HISTORY "Surveyed road surface
  city-wide"): a coarser drape for large flat carriage polygons (rural and
  dike cells -8_4 1.43×, 10_4, 9_3, 8_1, 4_0, 7_5 exceed the 1.15× triangle
  gate; 4_-1 builds 2.1× slower); the LOD 1 far ring still draws OSM bands;
  400+ `h ≥ 1` polygons (75.9 ha, A10 and harbour viaducts) over no
  registered deck are skipped; squares, yards and planted islands (the
  Mosplein roundabout centre) are not wegdeel and draw as land/paving;
  ~12,000 m² of berms and tree pits the bands used to pave, in seven dense
  cells.
- **Pop-in, next** (2026-10-16, HISTORY "Pop-in: streaming look-ahead"):
  the intro descent (overview → city ground blend and landmark LOD swaps,
  ~28k px/s, the largest source); MapLibre basemap tiles are not steered by
  the look-ahead; landmark models have no look-ahead padding; the basemap
  handover is a one-frame swap; a lingering detail tile drops to coarse in
  one frame; a route-following look-ahead would load fewer tiles than the
  heading; the metric can't judge long frames or sharp turns, and 4× CPU
  throttle makes every frame a hitch.
- **Houseboat follow-ups** (2026-10-16, HISTORY "Houseboats: arks, barges
  and hullboxes"): hullbox roofs are often white/cream on the orthophoto
  (give hullbox a measured roof palette); barrel-roof and terrace variants;
  ~5 % of OSM outlines are stale (empty berth, or an ark where a ship was
  traced): a BGT/orthophoto berth check could hide or replace them; label
  the Amstel and outer-canal traced outlines to extend the overrides.
  Pre-existing: `scripts/check-signature-houseboat-suppression.ts` fails
  (`sea-palace-footprints.json` has no `houseboatRepresentation`).
- **Radar follow-ups** (2026-10-16, HISTORY "HUD: a riding radar"): iPhone
  at 4× throttle unmeasured; the overview extract costs ~1.6 MB once per
  session (a radar-only slice would shrink it); the label plan doesn't avoid
  the overview flight's YOU marker; on phones a map tap shows the cluster
  over the bottom-right quiz answer for 3 s; `osm-loader.js` `_loadTile`
  (CARTO) is dead code.
- **Bridge ends and spans, after the Berensluis** (2026-10-16): ~2,900
  deck-top misses remain at other belt bridge ends (BRU0140 Jean Dulieubrug
  52; BRU0066's north pavement stops 2 m short;
  `scripts/own-ground/audit-deck-ends.ts --list`); land strips mid-span
  under 44 decks (19 wider than 6 m: BRU0067, Blauwbrug, Oosterbeerbrug,
  Hendrick Jacobsz. Staetsbrug; extend `openUnderFootbridges` or open BGT
  pier gaps; census `probe-midspan-land.ts`); Berensluis piers grey stone,
  not brick-red (P3).
- **Large tier roof materials** (2026-10-16, HISTORY "Entrepotdok roofs"):
  thin 3DBAG courtyard roofs leave wedge notches (Entrepotdok
  286/287/316/285); roof material per face from the orthophoto (glazed
  blue-green faces, solar panels); apply `roof.flat`/`roof.surfaces` to
  other large recipes whose flat roofs draw as pale gravel. OZV 115-125's
  hold is its dark measured wall colours, unrelated.
- **Houseboat cabin colours** (P3, 2026-10-16, HISTORY "Houseboats placed
  from the orthophoto"): the orthophoto gives roofs only; sample municipal
  panorama thumbnails (CC BY 4.0) per boat for a sunlit cabin median, and
  relabel the 91 unseen boats and the 56 hashed ship hulls from panoramas.
- **Street gables, after** (2026-10-16, HISTORY "Crowns on the street end
  only"): re-install face-wallen-ozv-115-125 with the new neck heads (115's
  cap reads as a large cream panel where the photo has brick under a narrow
  stone cornice; fix before installing), then un-hold it once its shade side
  reads; recrown the ~346 houses whose street end is interior (gable along
  the street); the 434 houses with no routing street; address-aware choice
  for through-lots; moulded scrolled/arched neck caps (wallen-oza 177916,
  177946) and cap finials are kit gaps.
- **Road look, after v2** (2026-10-16, HISTORY "Road look v2"): klinker
  carriageways still redder than the orthophoto (a greyer tone that stays
  clear of `brick`); thin out zebras on dense crossing-node clusters
  (Linnaeusstraat); measure markings and tones on iPhone.
- **Own look, after** (2026-10-17, HISTORY "coverage page shows buurten
  with their own look"): archive the Bellamy/Hasebroek/Clercq face strips to
  source-data (thumbnails read them from lane staging); photos missing for
  nw-portiek-3st-blue-door, nw-garage-pair-balcony-5st,
  nw-loggia-stack-flat-5st; kit renders missing for the 13 types no installed
  chunk draws (Kinkerstraat, nassau-1900-*); row-house design renders need 8
  candidate angles; landmark-gallery cards render only the ground plane in
  headless Chrome.
- **Seeded start not deterministic** (P3, 2026-10-17): `openRoute`'s seeded
  start varies between runs (async loading consumes `Math.random` in a
  varying order), so any spec that depends on the start position is flaky;
  pin starts (as the Reestraat corridor test now does) or seed a private RNG.
- **Measured flat roofs, next** (2026-10-17, HISTORY "The De Hallen slab was
  Kinkerstraat 89–105"): `roof-flat.ts --write` and reinstall for
  stadsloket-west, reade and hamerkanaal-175 (roof/wall dE ~11.6–11.8);
  Kinkerstraat 89–105 courtyard faces still blank tan (no photo); kit gaps on
  its Tollensstraat front: open ground passage with round columns, yellow
  glazed entrance, curved cantilevered balconies, loggias; Polderweg 3 walls
  fail the tightened likeness gate (walls[1] no photo, walls[2] 52.9° crop).
- **Overview tiles, after** (2026-10-16, HISTORY "Our own flat overview
  tiles"): the textured ground's mean is ~5 % darker than the flat tones
  (small luma step near z14.6); `basemapPalette`'s `/^park/` also paints the
  game's `park-landscape-*` layers (visible with `?overviewTiles=0`); the
  Vondelpark probe stalled on "Rendering streets…" when run after the sweep
  in one worker; z16 tiles (+22 MB) only if the jump above z15 shows.
- **Figure-kit statues, user's call** (2026-10-17, HISTORY "Kinderbrug
  statues held"): 20 live figure-kit statues on contact sheets (demo page):
  pick which to hold or replace by route B. Kinderbrug's two groups are held;
  bridge 420 lost its brick piers with them.
- **Duplicate manual-catalogue entries** (P1, 2026-10-17): `manualCatalogue.json`
  carries byte-identical duplicates from merges (johnny-jordaan-groep ×6,
  theo-thijssen-standbeeld ×5, carmiggelt-borstbeeld ×4, winkler-prins-monument
  ×3, kinderbrug-meisje-eekhoorns ×2), and `build-manual-landmarks.ts` repeats
  imports and `id ===` dispatch lines; the game may draw these several times on
  top of each other. Dedupe and add a uniqueness check to `check:manual-landmarks`.
- **Buurt looks, next** (2026-10-17, HISTORY "Rivierenbuurt (Plan Zuid,
  1934)"): Spaarndammerbuurt (surveys committed in `scripts/block-face/buurten/`:
  EB04 noordwest 200 pands/87 faces, EB05 midden — the Het Schip streets — 149
  pands/30 faces, noordoost): intake `--camera-height=2.1 --bay-outline=auto`,
  then Amsterdam School and Zaanhof types. Rivierenbuurt faces intaken but not
  placed: hoendiep-36-60, rijn-157-237, uiterwaarden-3-33, vecht-111-185,
  -130-188, -145-173, -162-186 (new Rijnstraat/Vechtstraat types). Consider
  making `--camera-height=2.1` and `--row-exposure=date` the defaults. Kit gaps:
  oriel white cap, double portiek doors with side lights, attic windows on a row
  pitch across party walls, per-house ribbon variants, white posts between
  ribbon windows, the 2–3 cm door-leaf/frame z-fight, strip x-registration
  (~0.4 m off BAG party lines).
- **Public buildings, after Rietveld** (2026-10-17, HISTORY "Rietveld
  revisited"): still open CREA (3DBAG ground missing), HvA, Het 4e Gymnasium,
  UvA Spui, Metis/Oostpoort Montessori, Spinoza, and the Fedora pands
  (0363100012246283–86) across the street. Kit gaps: dimpled pressed-metal and
  expanded-metal mesh relief (drawn smooth); lettering under 0.3 m on ground
  glass; cantilevered overhangs, undercrofts, roof railings; interior columns
  seen through glass. Likeness: a glazing classifier that copes with reflective
  curtain walls and sunlit white facades.
- **Makassarpleinbuurt, next** (2026-10-17, HISTORY "Makassarpleinbuurt"):
  review and install boeton-2-42-r1 and nias-15-27-r1 (faces committed); type
  the 1933 Boeton 24-32 houses; revisit the held Molukken 7-29 shop pands;
  480 of 514 pands left. Kit gaps: dormers on a steep attic roof; the
  Gorontalo board dormer's proportions (wider, lower); a darker ground-storey
  brick with a soldier-course ledge; doors against the party wall and paired
  doors; folded/canted fronts at a street kink; corner towers and blocks; white
  attic pilasters with capitals; curved parapets with plaques; brick header
  accents; specific shop fronts; walls lighter than the overcast strip after
  trim normalisation.
- **Spaarndammerbuurt, next** (2026-10-17, HISTORY "Spaarndammerbuurt"):
  Spaarndammerstraat 121–137 (1884, 9 pands; draft in the lane's scratchpad,
  held on 35 open shell loops and cornice-through-roof on 3DBAG rear wings);
  Oostzaanstraat (De Klerk; balcony-ribbon fronts on 8–15 m pands of differing
  widths); Spaarndammerdijk 1922 (centre-piece types: octagon lights, bay
  stacks, small eaves gables); P3 Zaanhof dormers. Kit gaps: dormers seated in
  3DBAG roof planes; the back of a rendered gable shows as a white triangle
  (no cross-gable roof); render keeps the brick texture; tall bars over 4 cm
  near the z-fight floor; ribbed soffits, corbels, rounded overhang ends;
  octagon lights, per-axis vertical offsets, ground windows over 2.8 m, a
  narrower portiek door, a portiek arch shared across the party wall; brick
  relieving arches; flush wall dormers; a ride spec switch to leave one face's
  chunk out for before frames.
- **Statue rebuilds: the catalogue step is the user's call** (2026-10-17,
  HISTORY "Statue rebuilds installed"): the lane's write to
  `manualCatalogue.json` (credits for the 17, the Merwedeplein Anne Frank
  credited to Jet Schepp 2005, Kinderbrug un-hold) was refused by the auto-mode
  check. Ready: `node --import tsx scripts/sculptures/install-attribution.ts
  --unhold=kinderbrug-meisje-eekhoorns,kinderbrug-jongen-konijnen`, then
  `build-manual-landmarks --only=<17>`, drop the hold assertion in
  `tests/e2e/whats-new.spec.ts`, frame the Kinderbrug on bridge 420. Then P2
  Spinoza (head close-up or kit head on the TRELLIS cloak), Mama Baranka (hole
  fill, coarser remesh); P3 the 22 Night Watch figures, the Waterdraagster
  fish.
- **Flags left after the audit** (2026-10-16, HISTORY "Flags decided"):
  `?bagTiles=1` default flip is the user's call (covers consistent now;
  `check:covers --strict` lists 4 Noorderkerk hidden bugs it would fix;
  ≤ 0.3 % of pixels change; tiles cost 1.19× the bytes against the
  loading-performance priority). `?recipeTiles=1`: recompile the pilots
  (they list the retired `chunk-bilder-079721-x2` and predate the roof
  rules) before re-evaluating. `?cityLook=1`: blocked on the 0.9 cell
  level (frames −5–6 luma). Sculpture impostor (`?sculptures=1`): keep as
  the route-B fallback or delete, user's call. Regenerate `coverage-v1`
  (`npm run build:coverage -- --publish`); its tiers still say chunks and
  types are off by default.
- **Held chunk and the two Bilderdijkstraat pilot houses:** Oudezijds
  Voorburgwal 115-125 stays out of the default (black on its shade side,
  `DEFAULT_HELD_CHUNKS`); Bilderdijkstraat pands 152669 and 079721 (the
  retired 10-10 pilot chunk) need a block face under the front-roof rules.
- **Sunny look follow-ups** (2026-10-16, HISTORY "Sunny look is the
  default"; `?look=legacy` opts out): re-tune the opt-in yellow highlight
  (clips at 206.6 under the rig); undo the city look's extra 0.9 cell
  level so `?cityLook=1` also draws sun-facing walls at their own colour;
  regenerate gallery covers, goldens and `docs/LOOK.md` under the rig;
  per-house white points for hand-edited intents and the Oud-West strip
  faces (median 1.106 today); decide the road grey (~98–117 vs the user's
  ~150) and the cycle red (190,96,92 proposed); ride-level before/after
  frames from the bike, the sheet is mostly aerial.
- **Overview transition follow-ups** (2026-10-16, HISTORY "The
  overview-to-city switch is a blend"; `?transition=0` opts out): the
  user judges whether the flat overview in city colours with roof-toned
  footprints still reads as a map (it is darker and browner than the old
  white-and-blue); switch its tones to `look/sunny.ts sceneTokens()`;
  footprints far from the rider fade out where nothing 3D is streamed;
  tilted manual zoom-out shows a short footprint-tone dither; phone
  worst step 4.7 % at 13.9 → 14 is outside the window, bring it in.
- **Kit roof rules follow-ups** (2026-10-16, HISTORY "Roofs follow the
  front": the step-gable library leaned by one tread and is fixed; saddles
  under crowns, row coherence and `roof-under-crown` landed; 232 of 371
  pands change class): (1)–(3) DONE 2026-10-16 (HISTORY "Fourteen
  installed faces re-installed": 14 in, flat placements, tile golden);
  the three held faces DONE (HISTORY "The three held faces fixed"); the
  Kinkerstraat faces and evertsen-7-41 are not
  installed at all yet (decide after a ride review); a setback top storey
  for 76-84's two raised blocks; (4) cross-gable /
  hip-and-gablet when a gable sits over one bay of a wide front; (5)
  attic faces behind plain cornices still 3DBAG-p95-bounded (236441
  m0/m1); (6) gable crown height from the photo, not `crownRise`; (7)
  Mercatorplein's raised roof block is large-tier `roofPlant`; (8) flip
  `openingsWithinWallsGate` to strict once attic panes are out of the
  roof mass.
- **Kit roof rules (user, 2026-10-16; plan Part 2, DONE, see above):** roofs
  follow the measured front, not 3DBAG ("don't give so much credence to
  3DBAG roofs"): saddle under the crown profile, flat under a parapet, attic
  from the top row, rear wings clamped under the crown line; step gables
  symmetric with a guard test ("stepped gables are almost universally
  symmetric, you keep making this mistake"; the lopsided crowns on
  kinker-56-84 are 3DBAG planes above the symmetric crown); row coherence
  ("one house here isn't higher than the rest": kinker-315-359, 18 pands of
  1903, clamp a lone 3DBAG eaves/ridge outlier > 0.8 m to the row line, the
  8 hand `measuredEaves` must be reproduced by the rule). Identity by
  `roof-golden`; the six faces re-installed after sheet review. Follow-up:
  Mercatorplein's raised roof block is large-tier `roofPlant`.
- **Openings-past-walls offenders** (2026-10-16, HISTORY "Openings must
  stay inside their walls"; the Homomonument, Krijtberg, Westerkerk and
  Nieuwe Kerk are DONE, the landmark gate is hard, baseline frozen at 316
  models): 208 landmarks still carry parts past their walls (2,894 m²);
  next pass by ride visibility: stadhuis, scheepvaarthuis,
  royal-theater-carre, academie-theater-dans, then the roof-pierced dark
  panels on sint-nicolaas, posthoornkerk and jewish-museum; check whether
  stadhuis/valley/vinoly/hoofdbureau are curtain walls the glazed-skin
  exemption misses before touching builders. Kit gate
  `openingsWithinWallsGate` is advisory until the kit-rules lane lifts
  attic panes out of the 3DBAG roof mass (19 of 22 installed chunks
  fail; nassau-162289 28.9 m²), then set `OPENINGS_WITHIN_WALLS=strict`
  and remove the advisory flag. Homomonument: measure the treads and the
  pink of the Rosa Porrino granite (the panorama reads grey-beige).
- **Homomonument and Krijtberg windows + pipeline gate (user, 2026-10-16;
  plan Part 3, DONE, see the item above):** Homomonument "still looks wrong (missing a
  triangle, sticks into the canal)": rebuild as three 10 m granite
  triangles (podium, flush, water steps meeting the quay wall), quay not cut
  through the steps, pinned in `check:manual-landmarks`. Krijtberg windows
  overshoot the walls and roof: fix the builder and add the hard check
  `openingsWithinWalls` to `geometryAudit.ts` (audit:glb) and
  `roofChecks.ts`; list the offenders over all landmarks and kit houses.
- **Shared-frame look leftovers** (2026-10-14, HISTORY "black blocks",
  "Inward-facing normals"): recipe-tile default under the shared frame
  still to decide; iPhone shots of the shadow spots unmeasured; normals
  metric is warn-only (baseline and gate it); check the `scale(±1)`
  mirrors in mountain-network, Maagdenhuis, Hoofdbureau and Sea Palace
  builders; studiok, het-veem, concertgebouw, lab111, orgelpark and
  cinecenter rank high on inward area but may be hidden interpenetrating
  solids; other `hip()` users change on rebuild; rename the `royal-palace`
  `OVER_BUDGET` key to `palace-on-the-dam` or drop it.
- **Desktop perf, fourth pass** (2026-10-14, HISTORY "Desktop perf, third
  pass"): MapLibre `hasTransitions` walks every layer's paint values each
  frame (0.3–0.4 ms; upstream patch or a cached override); tile culling
  and clip masks ~0.6 ms; the highlight casing still draws on every tile
  while a destination is lit (a filter on the accent ids re-tiles the 10k
  GeoJSON buildings on each card change); `landmarks._requestModels`
  filters every model spec on every `moveend` (0.3–0.4 ms); legacy
  landmark draw calls 0.2–0.4 chase / 0.7–1.1 aerial (merge per material
  across models, or the shared frame by default); retighten
  `DESKTOP_BUDGET` on a quiet machine; iPhone profile still pending.
- **Models in the game that fail the hard gates** (lane reports 2026-10-13):
  `jodenbreestraat-11` (holes 116 loops, largest 53.7 m; z-fight 118 m²;
  28 buried openings; 0 % material slots), `academie-theater-dans` (607
  hole loops, a 2,913 m² detached part, z-fight 64 m²), `booking-hq`
  (z-fight 2.8 m², window rhythm, buried 3 > baseline 2). Fix in their
  builders or hold them (`status: held`) until fixed. `hoofdbureau-elandsgracht`
  is fixed (rework, 2026-10-13 evening). `check-manual-landmarks` passes
  again (free-standing kinds admitted) but allow-lists `mountain-network`
  (649 KB, 47k tris) and `royal-palace` (637 KB) over the 500 KB / 40k
  budget: shrink them in their builders and drop them from `OVERSIZE_IDS`. Also: the Dam
  look-consistency shot shows red pitched roofs right of the Palace turning
  into flat grey lids after the sun/mood merge (cause not found; compare
  against freshly built bundles).
- **Z-fight survey backlog** (`artifacts/zfight-audit/report.md` in the lane,
  regenerate with `scripts/landmarks/zfight-survey.ts`): the top class
  (frames 2 cm proud) is fixed in the helpers and 20 models re-exported
  (HISTORY 2026-10-13 evening). Left: de-wester 412 m² (doubled brick
  planes 3 cm apart; relayering raised opening-buried 3 → 18, reverted),
  haparandaweg-746-786 105 m² (glass 1.5 cm from balcony rails),
  Madame Tussauds 18 / VOC-kade 600 25 / Allard Pierson 14 / De Bazel 4 /
  Kohnstammhuis 3 (non-planar walls; read the wall plane per window), then
  "flush cladding band on a wall" (Jacob Bontiusplaats 9's 6,411 m²,
  Valley, Pllek, Frascati's doubled face; pllek/frascati/valley/jacob not
  re-exported). The 4.5 cm near band still tints a few pixels at 1,800 m.
- **Highlight leftovers** (2026-10-14): 3DBAG detailed mode untested live
  (tiles load 0 meshes headless) and gets no roof wash; a `building-3d`
  basemap target gets no casing; the wash pass not perf-measured; iPhone
  profile.
- **Roofs after the attachment fix**: pitched-vs-flat split pands still
  follow one plan (the roof-facts slot now colours the lid; the shape is one).
- **Own ground after the 2026-10-13/14 lanes (HISTORY)**, now post-flip (the
  desktop default is on; iPhone ride-perf and the phone default still
  unmeasured): still open
  before a desktop default-on in the belt: bridge-kit leftovers (the
  Blauwbrug and BRU0063 hit the 600-tri budget so their arches are 4–5
  segments and have no lamps; the Magere Brug railing is sparse at ~9 m
  posts; the Torensluis' 42 m-wide footprint reads oddly from the water;
  flat-footprint water level is a heuristic, lowest top − 1.8 m); slope
  physics in `game.js` from `riderPose().pitch`; hosting quota for
  29.6 MB gz; iPhone ride-perf, the larger ring and the fade on the phone;
  BRU0077's suspect 1.7 m hump and the five flooded spots in the belt
  audit. Closed 2026-10-14 night (HISTORY "belt audit clean"): the 18
  tram-rail findings, the Melkmeisjesbrug water, Rozengracht corners, the
  far ring. Closed 2026-10-13 evening: the junction stubs and cycle
  slivers, `area:highway` surfaces, far-ring pop-in, the hard own-ground
  edge from the air; the "bouncy second route line" at the
  Kostverlorenvaart (the boat's canvas question band).
- **`?bagTiles=1` default flip**: recommended by the default-on review
  (perf-neutral, `check:covers --strict` green, 0 without footprint);
  prerequisites done except `check:canal` on the flipped default and the
  iPhone number. Flip with the shared frame and city look together (sun fix
  first; the user's look decision).
- Kit-only landmarks still without a GLB: Noorderkerk (main pand to
  identify: 0363100012177299 or ...177297) and Krijtberg (not started).
  Obrechtkerk, Oosterkerk, Mozes en Aäronkerk, De Duif and Opstandingskerk
  landed 2026-10-13 as hand-built GLBs (first-record baseline entries for
  their window-rhythm mismatches; Opstandingskerk's east gable has 37 of 46
  openings off-size against the photo spec, Obrechtkerk is 43k tris — both
  for the GLB cleanup lane). Scheepvaartmuseum and Waag done 2026-10-13.
- Facade comparison now crops to the photo's span (alongM/heightM), skips
  null bands and counts ribbon glazing as one opening (2026-10-11): failing
  checks 45 -> 24 over the 7 newly released landmarks. Real model gaps it
  found, fixed 2026-10-13: Maarten Lutherkerk (door stile lost in the
  raster; east front now passes), Pakhuis de Zwijger (east ground slits;
  warm ochre brick #b69468 in a light concrete frame after the user asked
  "is this building really this dark?"). Krasnapolsky re-held after the
  user's "some incorrect windows": wing and old front are regular grids
  now, but the red-brick middle, Dam-front rows and three blank 3DBAG
  sides remain. Oudemanhuispoort and Petrus en Paulus are being redone by
  another session. Metric limits still open: gable peaks count
  roof steps/plateaus as peaks (DNB podium), row clustering splits
  staggered stair windows (Petrus en Paulus), counters count panes in tall
  strips (Pakhuis north).
  Petrus en Paulus, Maarten Lutherkerk, Oudemanhuispoort and the Torture
  Museum released 2026-10-11 (second held batch). Levend Paardenmuseum
  still held: gateway detailed, long walls plain 3DBAG massing (inferred
  windows overhung the 3DBAG walls). Torture Museum's 3DBAG body behind the
  narrow Singel front reads as a large blank box from the side.

**Handoff 2026-10-02 — Map Recall neighbourhood cards, Utrecht and Rotterdam.** `WIKIMEDIA_TOKEN` now reaches wikipedia, wikidata and commons hosts (checked 18:56 UTC: each answers as user Whizziwig). Every response `fill-neighborhood-gaps.ts` fetches is kept in the durable scrape store (`scripts/lib/scrapeStore.ts`; `/mnt/project-files/scrape-store/` in cloud sessions), so reruns and new sessions ask Wikimedia only for what is missing.
- *Utrecht and Rotterdam text:* published 2026-10-02 (see HISTORY). Coverage now Utrecht description 111/135, history 105, name origin 24, photo 87; Rotterdam 106/128, 81, 39, 88. Still open: name origins are the thinnest field in both cities (no street-name register for them yet); 38 Dutch fields were rejected as junk and 73 geosearch photos rejected, so those areas wait for better sources; review both cities on `/?gallery=cards&city=X` before relying on them. Rerunning `online` costs nothing for answered requests (scrape store).
- *Photos:* `fetch-place-photos.ts` and `fetch-area-photos.ts` done for all four cities (2026-10-02). Postcards (2+ area photos) measured in the card gallery: Amsterdam and Den Haag every card, Utrecht all but Strijkviertel, Rotterdam missing 15 (Burgen, De Vaan, Het Zuiderhof, Hoeken, Hof van Eden, Horsten, Kampen, Landbouwbuurt, Molièrebuurt, Pascalkwartier, Smeetsland, Sportdorp, Steinen, Veld van Klanken, Voordes/Rodes): Commons has almost no geotagged photos there, so these need another source (e.g. a Commons category or Wikidata image) rather than a wider search. Area photos rebuild offline from the Commons DB (`--offline`, see HISTORY).
- *Review page:* `/?gallery=cards&city=X` on the Map Recall site (edumap-blackmad.web.app) lists every card with gap flags; use it to review each city before merging. Postcard needs two or more photos per area. (It crashed for every city but Amsterdam until 2026-10-02: it looked cities up in the game's `CITIES`.)
- *Open:* Houthaven islands' themes beyond Wiborg/Reval/Memel (image-quality plan not found); Amsterdam histories still missing for Westindische Buurt, Polder Meerzicht (IJselbuurt and Van Galenbuurt filled 2026-11-09); Canal Recall difficulty is separate from the new Map Recall Easy/Medium/Hard (place clues are easy/medium only).

**Delight loop (thin slice shipped 2026-09-06).** Mission punchlines, finish
knowledge story, place-day streak, passport stamps, know-this-corner wink,
correct-only encyclopedia. Cold-open review is **disabled** (2026-09-07) until
a due name is on/near the route or shown (highlight/camera) — see HISTORY.
Still open: rival-route novelty bias, landmark scavenger stop-to-look,
transfer dares, Dutch plaque hard mode, shareable blank silhouette routes,
weather/time mood. Cold-open is superseded by review rides (see HISTORY,
2026-09-30).

**Local-knowledge facts beyond Amsterdam (data lane).** Amsterdam's 57
approved local facts are published (`localFact`; see HISTORY), and since
2026-10-13 every Amsterdam quiz area has a grounded story
(`neighborhood-stories.json`, built by `scripts/build-neighborhood-stories.ts`
from `scripts/data/neighborhood-stories-picks.json`; `npm run
check:neighborhood-stories` gates it). Open: run `npm run mine:area-facts --
--city utrecht|rotterdam|den-haag`, draft cited picks into
`scripts/data/area-fact-review-<city>.json`, review, `publish`; thin Amsterdam
stories (Westindische Buurt and IJselbuurt 1 top / 0 rotating; Gelderlandpleinbuurt,
Molenwijkpark, Stadionbuurt, Willemspark 2 / 0; Duivelseiland, Hoofdweg e.o.,
Buitenveldert-West 2 / 1) need more sourced material; nine Amsterdam picks are
boroughs/Gouden Bocht the quiz does not ask yet; `sentencesOf` splits after
initials ("A.J. Ernststraat").

**Map Recall quiz pass, wave 3 (review 2026-10-13; waves 1 and 2 shipped,
see HISTORY).** Still open, in order:
- *Question forms:* a chains toggle in the settings modal (today URL
  `chain=off` or localStorage `mapRecall.chainNearby.v1`); the relation form
  covers 64 of 177 obscure Amsterdam streets (the rest have no distractor
  250 m clear on an axis; the buurt form or four names stand in).
- *Desktop dock:* the game-over map review is not docked (the summary modal
  hides in review mode, so nothing covers the map; docking it needs the
  header offset handled); the "Quiz started · Back to start" pill is centred
  on the whole main, not on the map beside the dock; the "Canal Recall"
  button still sits under the phone map-review banner; a dock with the
  Guess Name card leaves most of the column empty (a map inset or the
  seen-before history could fill it).
- *Data:* 47 features across the four cities lose stray same-name pieces at
  load (`pathClusters.ts`, 1 km link, 3 km far); the Groene Kruisweg loses a
  real 6 km stretch beyond a gap, and rail lines filed as bridges (Gooilijn,
  HSL-Zuid, Hofpleinlijn) lose scattered segments. Better: split same-name
  ways into separate features at extract build, named by district. First
  sentences that are only a count ("in 2008 Tuinwijk-West had 2,440
  residents and …", Terwijde's list, Vleuten-De Meern, Pendrecht) are left
  whole. The photo blacklist misses portraits with no Flickr id or particle
  ("Harry Starren") and long captions ("Jet Bussemaker opens…").
- *Postcards:* the expanded card still prints the full name-origin paragraph
  (Prinsengracht runs seven lines); Safari ignores canvas filters on export;
  OUD-WEST keeps a gap where the undrawn hyphen sits.
- *Guess Name:* overlapping areas as rival answers (below) and one
  far-from-the-answer distractor per question.
- *Phone:* Amsterdam minZoom is 10 so the Amstel fits above the question
  card; the IJ is unchecked.

**Neighbourhood trivia gaps (pipeline built 2026-10-02, data lane).**
`npm run fill:neighborhood-gaps -- audit|offline|online|publish` fills missing
description, history, name origin and photo for Amsterdam areas into
`staging/gap-fill/` (report in `report.md`), then `publish` adds reviewed ones.
Offline stages (alias siblings, street-name matches, street themes, text composed
from what lies inside the outline) ran in the cloud container; the online stage
(Wikidata, nl/en Wikipedia articles and mentions, Commons photos) needs
`NODE_USE_ENV_PROXY=1` there and is rate-limited by Wikimedia on shared IPs
(about 1 request per second; the script paces itself). Still to do: translation
pass for Dutch candidates (write English into
`scripts/data/neighborhood-gap-review.json`), review of low-confidence
candidates, the duplicate Nieuwmarkt/Lastage outline, and the same pipeline for
Utrecht, Rotterdam and Den Haag (they have boundaries only, no street-name
register or landmark extracts to compose from).

**Randstad trivia parity (in progress, data lane).** Utrecht, Rotterdam and
Den Haag have no name origins, neighbourhood photos/history, and (Rotterdam,
Den Haag) no street encyclopedia text. Same rules as Amsterdam: sourced only,
Dutch reviewed before it ships. Map Recall also still reads only the Amsterdam
extract; other cities fall back to live OSM.

**Municipal trees and park landscape (2026-10-03).** Amsterdam now streams
311,544 trees in 454 z15 tiles (5.35 MB compressed): 302,404 standing municipal
records and 9,140 deduplicated explicit OSM tree nodes.
Species/cultivar priors, height classes and explicit pruning records drive
varied crowns, conifers, trunks and branch forks. Positions are inventory
locations; crown width/shape remain approximations. The main landscape contains
10,771 mapped features across 51 park/site selections; Amsterdamse Bos adds an
optional, locally streamed 3,254-feature chunk. Sixteen crown forms include
recorded palms. The visible Trees setting honors its saved preference in all
four views; fresh desktop and mobile views show inventory trees by default. Review at `park-landscape.html`.
Open: real-device Safari/phone performance and more verified cultivar priors.
Other cities retain the OSM tree fallback.

**Facades experiment follow-ups (merged 2026-10-02).** Facades shimmer on steep walls in phone cockpit (no mipmaps; use a
coarser image set at high pitch). Tiles rebuild at each integer zoom crossing,
a hitch not yet measured. The ground floor repeats above 32 m except on
towers. Facades are Amsterdam-only, and walls take a period palette colour.
Check on a real device.

**Three.js facade layer (now a setting: Building look).** Open: measure geometry cost now that roofs, cornices and shops add vertices (and consider a distance cutoff for cornice and chimney geometry); roof coverage now uses the largest inscribed rectangle plus one wing (2026-10-02), so truly round or courtyard footprints still keep a lid or a parapet, and rows of narrow hipped/mansardHip houses read as separate roofs rather than one; roofs added 35-42% walls-chunk triangles (canal belt 492k to 665k), unmeasured on a phone; check Safari and a real phone (the user saw broken roofs in Safari photo mode, not reproduced in Chromium; ask whether Default look has roofs there); flat lids now come from the three.js mesh in a neutral grey or the mapped roof colour, not per look yet; buildings without a facade (no palette prior and no OSM colour, e.g. r3674348 by Bilderdijkpark) now draw as bare three.js walls but still deserve a generic facade; measure GPU frame time on a real phone now that the three layer draws every building (chunk builds are in a worker); the 32-layer bay set drops attic and tall-first-floor bays; measure on a real
phone (heap is now below the pattern layer in software GL; geometry still
42-63 MB: pack vertices, prune by distance); a shimmer metric that works (the
current one is noisy and shows no win);
look at the photo look; gables and roofs are still MapLibre's; decide whether
it replaces the pattern layer or stays opt-in. Two layout modules now exist
(`wallBays.ts`, `facadeLayout.ts`): keep one.

**Landmark kits: more landmarks, and a phone check.** Thirteen are done (see HISTORY), Carré and Fatih with windows (opt-in `windows` on halls), and seven museums and cinemas (`museumKits.ts`).

**Original landmark model queue (2026-10-03).** `landmark-backlog.json` tracks
the actual POI Destinations pool plus explicitly requested additions. Refresh
with `node --import tsx scripts/landmarks/build-poi-backlog.ts`; it applies the
same teachable-content gate, four-kilometre radius and prominence ordering as
the game. Browse/filter the queue at `landmark-queue.html`. Existing procedural kits and imported gallery references are marked
separately from original models. Arcam's architecture guide is the discovery
source for further notable buildings. The queue also distinguishes districts,
complexes and memorials; check the mapped site before choosing a building model.

Original models now cover Centraal, Muziekgebouw/Bimhuis, both OLVGs, Van Gogh,
Stedelijk, OBA Oosterdok, A’DAM Tower, Pontsteiger, REM, Paradiso, Melkweg,
Silodam, Embassy of the Free Mind/Huis met de Hoofden, The Movies, DeLaMar and
Magna Plaza, Felix Meritis, De Kleine Komedie, De Balie, Anne Frank House,
Rembrandt House, Moco Museum, Museum Van Loon, Amstelkerk, He Hua Temple,
Haarlemmerpoort, Museum Het Schip, Scheepvaarthuis, Rialto, Kriterion,
De Bijenkorf, Gashouder, Stadsschouwburg, Tuschinski, Pathé City, Oude Kerk and
Nieuwe Kerk, Buiksloterkerk, English Reformed Church, De Papegaai, De Hallen,
Huis Bartolotti, H’ART Museum, Amsterdam Museum, Jewish Museum, Portuguese
Synagogue, Hollandsche Schouwburg, National Holocaust Museum and Homomonument
plus ARTIS Micropia/Ledenlokalen, ARTIS entrance, Hortus greenhouses, Arcam,
Foam, Huis Marseille, Ons’ Lieve Heer op Solder, Brakke Grond, Frascati and
Boom Chicago, Agnietenkapel, LAB111, OCCII, Ketelhuis, Wereldmuseum Amsterdam,
Dutch Resistance Museum, Allard Pierson, Dominicuskerk, Vredeskerk, Badhuistheater,
Cinecenter, Studio/K / Timorplein school, ARTIS Groote Museum and ARTIS Library
plus Willet-Holthuysen, Amsterdam Pipe Museum, Athenaeum/Nieuwscentrum,
Scheltema, Haarlemmermeerstation, De Dokwerker, Begijnhofkapel, Houten Huys,
Huis De Pinto, Amsterdam Tulip Museum, OT301, Filmhuis Cavia and Orgelpark
plus Herepoort / Bergpoort, Huis aan de Drie Grachten, De Dolphijn, De Rode Hoed,
Theater Amsterdam, Vondelpark Open Air Theater, Vondelpark Muziektent and
Oost-Indisch Huis/Bushuis, Het Veem, Tobacco Theater, Plein Theater,
Hash Marihuana & Hemp Museum, Hemp Gallery and Madame Tussauds /
Peek & Cloppenburg, The Amsterdam Dungeon, Sint Jorishof, Waalse Kerk,
Schreierstoren and Huize Lydia (106 original assets). The live replacements retain measured footprint alignment and
hide generic building geometry only after the GLB has loaded. Review meshes at
`manual-landmarks.html`; inspect actual map placement before marking additions
complete. Next batches: further smaller museum, theatre
and church destinations from the refreshed POI queue. Exact building IDs preserve neighbors and courtyards
around narrow house museums and irregular complexes. Squares/intersections require a public-space treatment rather than
a generic building model.
Large cinemas and theatres now have the public-building category treatment;
Pathé City, Tuschinski, LAB111, OCCII and Ketelhuis also have original models.
Studio/K, Cinecenter and Badhuistheater now have individual models. Further smaller museums remain in the POI queue.
Further kit refinements: Munttoren, Rijksmuseum (towers, central arch), Beurs van
Berlage (clock tower), NEMO (green ship prow), Stopera, Hofkerk
(dome). Dominicuskerk and Vredeskerk now have original whole-church models.
Each remaining kit refinement needs its
OSM part ids first (look at the stacked parts near the landmark's coordinate; the
resolved ids in `landmark-buildings.json` are sometimes the wrong piece: Westerkerk's
is a 10 x 2 m fragment). Add a kit to `KITS`, view it with the kit viewer, then
shoot it in game. Open: kit geometry cost (about 100-700 triangles each) is not
measured on a phone; palace columns and tower openings are crude; church windows
are bare brick; the highlight for a kit landmark falls back to the plain yellow
prism.

**Places of worship: the rest (after 2026-10-04 original models).** English
Reformed Church, He Hua Temple and Amstelkerk now have original models reviewed
on the map. Taibah and Augustinuskerk still need a 3DBAG check. Dominicuskerk
and Vredeskerk now include their naves and actual tower silhouettes.


**Police headquarters, Elandsgracht 117: landed 2026-10-13 (HISTORY).** The
brief was wrong: it is a Z-shaped 1941+ complex round courtyards (164 × 83 m,
237 wall surfaces), not a tower-and-portal block. Hybrid builder: 3DBAG
massing, 15 wall groups through the large-tier facade systems, hand-modelled
stone hoods, canopy and POLITIE plate; 26.6k tris, all gates and `audit:glb`
PASS, slots 100%. Open: about a quarter of the walls (courtyards, groups 1,
3–5, 9, 12–14) are inferred; the NW ribbons became a 12-window bay grid
because ribbon glazing bars z-fight after quantization; no curved glazed
storey, chequer bands, sculpture group or gated vehicle entrance; roof colour
unknown; Beeldbank returned 403 to automated fetch, so no archive image or
architect is cited (lead: "dienst PW (E. Messer), 1941", unverified).

**Police bureaus pass 2 landed 2026-10-13 (HISTORY):** 12 of the 17 listed
bureaus are now in the game as large recipes (plus Van Leijenberghlaan, Oost
Zeeburg, Gaasperdam and the bespoke Hoofdbureau = 16). Open: West
Overtoomsesluis (0363100012080943) fails footprint IoU 0.749 because the open
pilotis storey has no 3DBAG ground surface — needs a `largeCompile` hook
that adds the missing ground or a gate exemption for pilotis; Oost
Watergraafsmeer's front has wide windows on thin brick piers (photo) where
the recipe has 11 punched bays; Nieuwezijds Voorburgwal's finned curtain
wall is a plain grid (a 2-storey hall at the end bay and a glazed-ground
`curtain-wall` both fail `parts-attached` — kit limits to lift); POLITIE
letters sit ~3 m low at Zuid-De Pijp and Postjesweg (kit lettering has one
height); the kit lamp stands in for blue blade signs; a per-storey colour
split is unavailable (Zuid-De Pijp dark ground + cream uppers render as one);
ten bureaus are outside the building-tile extract so `all-walls.ts` needs
the facts-based footprint variant the lane kept in scratch — port it;
inferred walls are marked INFERRED in each `intent.json`.

**Signature ornaments (user, 2026-10-13):** the Hoofdbureau shipped without
its Amsterdam-arms relief (lion, banner, three figures) on the Marnixstraat
end wall; another session added it (32k tris) and the model now fails
`opening-overhang` once (66% of a face off the wall at (4.2, 1.6, -95.3)) and
the 500 KB manifest budget — batch 3 fixes it. Rule for every hand-modelled
building from now on: inventory the ornaments, reliefs, sculpture, lettering
and signs from the panoramas and model them; "no component" is not a reason
to skip. Landed 2026-10-13 (HISTORY): `landmark-brief.ts`, the inventory
schema and gate (required for landmarks first exported after 2026-10-14),
`check:landmark-inventory` in `check:canal`, `review:sheet --inventory`,
a 60-landmark survey (93 items: 46 modelled, 14 simplified, 12 skipped, 21
open) and six retro-fits. **Open misses, ranked** (`docs/reports/ornament-misses-20261013.md`; the inventory is `scripts/landmarks/ornament-inventory.json`):
van-gendt-hallen stepped gables rounded; chassekerk NE hall wall blank where
the photo has window rows; waag guild-portal relief; hotel-okura steel
stairs and galleries; vriesseveem-9 PIET HEIN letters; oudemanhuispoort
"spectacles" pediment relief; west-india-house pediment relief;
woongebouw-wladiwostok balconies; de-bazel door figures and inscription
(adding either made the window-rhythm audit FAIL on untouched elevations —
the rhythm audit reacts to geometry anywhere on the model, American Hotel
awnings failed at 1.9 m depth and passed at 1.2 m: audit bug to fix first;
rejected builder in the session scratchpad); mozes-en-aaronkerk railings
and inscription; vrijburg arc lettering; obrechtkerk panel; victoria-hotel
balconies. Re-run with `--walls=8` for thomaskerk, scheepvaartmuseum and
christ-church-groenburgwal (four-wall sheets missed their fronts); the
October-builds pass covers only part of the ~300. Hoofdbureau: 16 open
inventory items and the end wall misregistered (arms a storey too low and
too small; ribbon windows wrap the blank left 5 m) — with batch 3.
**Export determinism bug (2026-10-13):** `build-manual-landmarks.ts
--only=a,b,c,...` in one process produced a vondelkerk GLB with 5
overhanging openings and 3.3 m² z-fight (audit FAIL); the same id exported
alone is deterministic and passes. State leaks between builds in one
process — export one id per process until found.

**Police headquarters, Elandsgracht 117 (user, 2026-10-13): bespoke builder.**
The 1930s brick Hoofdbureau with its corner tower and carved stone entrance is
a landmark destination, so it gets a hand builder (massing from 3DBAG LoD2.2;
portal, tower crown and lettering modelled by hand; panoramas CC BY 4.0 and
Beeldbank for references). Its long regular wings should be the first
in-builder use of the `kind: large` facade systems once that lane lands, so
only the signature parts are hand work. The 23 neighbourhood bureaus stay on
the `large` recipe path.

**GLB cleanup batch 1 landed 2026-10-13 (HISTORY).** Gates are now
trustworthy and hard (`opening-floating`, `opening-buried`,
`opening-overhang`; `materialSlotCoverage` metric), `snapOpenings.ts` attaches
assemblies at build time, every `build-manual-landmarks.ts` material carries
`materialSlot`+`tint`. Batch 2 landed 2026-10-13 (HISTORY): `audit:glb --only-geometry` 308 pass,
3 fail. **Batch 3 (open)**: haparandaweg-2-4 (one window 40% buried at
(-20.3, 9.8/5.7, 19.8); snap cannot lift it, move it in the builder),
petrus-en-paulus-kerk (north gable needs a photo recount: turret slits,
fanlight and a 2.8 m sash mixed in one crop), booking-hq (held; 3 hidden
frame posts), valley (~3,070 open loops, zero-thickness aperture walls and
glass skin), opstandingskerk east gable (37/46 openings off-size), rialto
coplanar roof, felix-meritis and jodenbreestraat-11 branches, the recovered
landmarks on `wip/recovery-landmark-integration-20261009` (academie-theater-
dans, holocaust-namenmonument, max-euwe-centrum; voormalige-schouwburgpoort
four-side strip), hotel-de-l-europe window budget (52k tris, 725 KB; 21k
tris in `sashWindows`, 7.7k at `hotel-de-l-europe-builder.ts:162`; fewer
mullions saved 1k only — needs a real decision, e.g. lod-style sashes above
the first floor), mountain-network 649 KB, palace-on-the-dam over 500 KB.
Strips not viewed by the lane: jewish-museum, dutch-resistance-museum,
fire-station-hendrik, fire-station-zebra, this-is-holland, oudemanhuispoort,
waag, scheepvaartmuseum — look at `artifacts/glb-cleanup-2/strips/contact.png`
(lane worktree) or re-shoot. Known: the slot/tint tags do nothing in game
until `?cityLook=1` is on (slots are inferred at load there); the
"hull-limited see-through" TODO note was wrong — lab111 and mountain-network
were real geometry problems or declared passages
(`mountain-network-spec.json` `throughPassages`).

**Large tier landed 2026-10-13 (`fitLarge`, `kind: large`; HISTORY).** Open:
`scripts/building-recipes/install.ts` cannot place a `large` recipe yet, so
the four compiled customers (politie-van-leijenberghlaan 6.1k tris,
leidsestraat-67-large 1.5k, de-balie-large 1.2k, social-history-large 2.8k;
all gates + `audit:glb` PASS) are not in the game; the lane is adding install
support and the two catalogue entries (police station new; Leidsestraat 67
replaces the canal-house entry; De Balie and IISG keep their hand models).
Police bureaus (lane 2026-10-13): `scripts/landmarks/police-stations.json`
holds the 17 Amsterdam bureaus matched to BAG pands
(`police-stations-match.ts`: OSM `amenity=police` → PDOK Locatieserver → BAG
WFS; the old "23" counted Amstelveen/Diemen/Zaandam/Weesp/Halfweg,
Marechaussee and Luchtvaartpolitie), tagged `publicBuilding: police` in
`landmark-backlog.json` (`landmark-queue.html` filter not wired yet). No
bureau shows a striped band or blue lamp in its panoramas; POLITIE lettering
only at Oost Zeeburg and Van Leijenberghlaan. Installed as `large` recipes:
Van Leijenberghlaan, Oost Zeeburg (1.7k tris; lettering sits at the left end
because the kit centres it over the entrance, real one is at 55–70%), Zuidoost
Gaasperdam (321 tris; red columns, roof overhang and brick plinth not
modelled). Next candidates need a second photographed front, since a
front-only recipe fails on its blank long wall: Oost Watergraafsmeer (W front
done, 34 m E wall has no panorama), Lijnbaansgracht, IJ-tunnel, Meer en Vaart,
West Overtoomsesluis, Flierbosdreef, Boven-IJ, IJburg, Nieuwezijds
Voorburgwal, Postjesweg; Houtmankade needs per-wing grouping (256 wall
surfaces); Zuid-De Pijp has no panorama; Johan Huizingalaan 757 may not be a
public bureau. Hoofdbureau Elandsgracht stays a bespoke builder (lane running 2026-10-13).
Note: `install-large.ts --install` writes the catalogue, but the game reads
the ordinary catalogue from `signature-placement.bundle.js`, so run
`npm run build:canal-signature-landmarks` after every install or the model
is invisible in the game (caught by the demo shots 2026-10-13). Known gaps:
curved fronts, arched portals, colonnades; 3DBAG surface indices shift if the
extract is rebuilt; `compare:facades` needs rhythm specs for these.

**Public buildings, next.** Done: the 13 Brandweer kazernes (bespoke, 2026-10-09), the 17 police bureaus, four OBA branches and five stadsloketten (`libraries.json`, `civic-offices.json`, 2026-10-13). Left: the 14 other OBA branches (Bos en Lommer, Buitenveldert, IJburg, Molenwijk, Osdorp, Roelof Hartplein, Spaarndammerbuurt, Van der Pek, Banne, Ganzenhoef, Geuzenveld, Postjesweg, Reigersbos, Staatsliedenbuurt; several have no usable panorama wall), Waterlandplein and Stadsloket Zuid once their pands are in the building tiles, hospitals and schools (match from OSM the same way). Kit items from the lane: `audit:glb --id` should match ordinary entries; `--only-geometry` flags ~0.06 m² of glass/frame overlap per opening on every large recipe (kit-level, fix in `compose.ts` opening construction); `piers: true` runs the full wall height (arcade piers, slab fins need a storey range). Red fire-station doors need a glass colour per window row in `KitWindows`. Big cinemas and theatres need a signage band, because plain brick boxes read as bare. The pitched-or-flat roof call on pre-1930 schools is a guess wherever the tile `roofShape` is missing.

**Gallery upkeep.** Rerun `npx tsx scripts/build-kit-locations.ts --publish` whenever a hand kit is added; the check fails on a missing location. `kit-viewer.html` and `landmarkKitsViewer.ts` are unused now and can be deleted. The playground could load a real street graph so doors on real buildings face the street.

**Street ensembles: one builder's terrace drawn as one (user 2026-10-03: "fix up the overall rhythm of major commercial streets like rozengracht, kinkerstraat, Jan Pieter Heijestraat").**
Study and prototype done (`src/canalRecall/streetEnsembles.ts`, `npx tsx scripts/check-street-ensembles.ts`; findings,
strips and photos in `/mnt/project-files/house-design/street-rhythm/`). Measured: terrace streets (Kinkerstraat, JP Heijestraat,
Javastraat, Ferdinand Bolstraat) have 55-80% of buildings in runs of 3+ (year within 2, height within 1.6 m); on those runs the
game draws one wall colour 0% of the time and one roof kind 0-8%, eave sd 0.6-1.3 m against 0.2-0.4 m in the data. Organic
streets (Rozengracht, Haarlemmerdijk, Utrechtsestraat) have no runs; their rhythm is the 4-6 m plot and a continuous shop band.
Next, in order:
- P1: offline extract `building-ensembles/14/x/y` (staging, coverage) plus a tile enricher next to `constructionYearEnricher`;
  run-shared wall colour, window style, roof decision (kind, material, rise) and eave. A shared seed alone fixes colour and
  windows but only half the roofs, because `planRoof` branches per footprint.
- P1: run-shared storey/ground scale (the per-building 0.93-1.09 / 0.92-1.12 jitter in `threeBuildingMesh.ts` breaks floor
  lines) and one shop-band height per face.
- P2: regime gating (terrace / mixed / organic: organic faces get only the shop band and whole-storey cornice steps); corner
  accents that are not "taller" (real corners are not); replace the radial 40 m shop infill in `build-shopfronts.ts`
  (overstates Kinkerstraat at 97%) with the face-aware band.
- P3: periodic accents every 2-4 houses in long runs, awnings, bike rows.
Pins: Kinkerstraat 1903 run (18 houses, 95 m) near 4.861654,52.364465; Javastraat 27-house run near 4.933378,52.36355;
Rozengracht organic face near 4.881577,52.373621; Haarlemmerdijk and Utrechtsestraat must stay ungrouped.

**Empty areas of the city (user report 2026-10-02, fix shipped, unconfirmed).**
Tile streamer retries, timeouts and the wider-view re-plan cover the likely causes (see HISTORY).
Confirm on the user's device that Jordaan/Rozengracht loads; if a tile is still
bare, log tile keys marked empty. Also unchecked on device: the facade zoom
hysteresis (0.3) and the 48-image set's build cost.

**Map Recall near-home follow-ups.** Home is only picked up when both apps share
an origin; add a way to set home inside Map Recall, and a map picture of the
ring. The ring can widen mid-game as reviews land.

**Per-wall facade renderer (spike merged 2026-10-02, not in the game).**
`rendering-spike.html` (see `RENDERING_STACK_OPTIONS.md`) renders buildings as
three.js meshes with whole bays and storeys per wall, varied layouts and
archetypes, and photo and cartoon looks. Next: mount it as a MapLibre custom
layer behind the labels; atlas the bay textures; gables from `gable.ts`;
highlighting for the answer reveal; measure frame time, hitch and shimmer on a
phone against the extrusion layer at Rozengracht, Da Costakade, Centraal and
Nassaukade. Decide by the numbers.

**Westeinde reverse ride leans on the guard.** It arrives, but the road guard
acted on 698 of 1,536 frames (the forward ride: 0 of 698). Find where (the
ride's hotspots, `KEYBOARD_RIDE_TRACE=1`) and whether the rider feels it.

**Map Recall: overlapping areas as rival answers.** The area list holds both
quarters and buurten, so Guess Name can offer Nieuwmarktbuurt and
Nieuwmarkt/Lastage together, though they cover the same streets. Choices
should skip an area that overlaps the answer by more than about half.

**Map Recall locate hints: data gaps.** Hints now name places
(`src/mapRecall/locateHints.ts`), ranked by Wikidata sitelinks. 96 linked
waters were never given sitelinks, among them Prinsengracht, Keizersgracht,
Singelgracht and Brouwersgracht, so they rank as obscure as Koningsbergengracht
(Narva-eiland's hint names that rather than Houthaven); Singel's link points at
Muntsluis. Fetch their sitelinks into the extract. Betondorp, Floradorp and
Molenwijkpark have only a district to name and fall back to bearings; Utrecht,
Rotterdam and Den Haag hints are unchecked.

**Map Recall follow-ups.** 14 OSM neighbourhoods have no article in either
language (Rijnbuurt, Scheldebuurt, Westindische Buurt, Van Galenbuurt, …);
their stories now borrow the street register and nearby landmark facts, labelled
as such (`borrowedFrom`), but an article would still be better. The city publishes ~480 official buurten / ~99 wijken with boundaries: a finer,
complete neighbourhood set than OSM's 85. Canal Recall shows a street card
only after a correct answer; showing it for streets ridden (paced like
landmark cards) is an open question for the user.

**16. Review and refine the published Randstad trivia.**
v11 is published (4,052 facts / 1,628 features). Trivia Lab’s **Human review**
view is the audit path: approve / reject / strike / note, then
`npm run facts:publish`. Still worth a pass: dates, quantities, Dutch
translations, and model-verifier disagreements. Corrections must keep exact
Wikipedia evidence.
Model audit, 2026-09-30: every number in all 4,052 published facts was
checked against its own source quote. Only 8 facts had a number the quote
lacks, and 7 are derived (14 December plus two days) or context (house
numbers). A proper-noun pass (names in a fact that are absent from its
quote) found one inverted fact. Two sentences are struck in the review files
with a "Model-flagged 2026-09-30" note; delete the `drop` entry to undo
either:
- Python Bridge: "Unlike the nearby Lage Brug, this structure lacks high
  elevation". The quote says that of the Lage Brug.
- Den Haag, 'Grenadiers en Jagers': "Seventh-grade students … May 10
  ceremony". Groep 7 is ages 10–11, and the quote has no 10 May.
- Vrijheidslaan: "named in 1946 after leaders". It was Stalinlaan in 1946.
- Marinehaven: "Unlike Zeebrugge…", unsupported. This feature is linked to
  the generic naval-harbour article, so its remaining sentences describe
  naval harbours in general, not Amsterdam's. It needs a human decision
  (reject the feature?).
- Same pattern, true of the concept but shown as if about one place:
  Schutsluis (en "Lock (water navigation)": Ptolemy's Nile locks),
  Afwateringstocht (nl "Hoofdwatergang") and Rotterdam's Spoorweghaven (nl
  "Spoorhaven"). Their openings define a class ("A rail port is…").
  Consider rejecting these, and have the generator refuse concept articles.
  Marinehaven's and Afwateringstocht's water cards (`water.json`
  wikipediaExtract) carry the same concept definition, which is generic
  rather than false.
The Amsterdam name list has been read through; Utrecht, Rotterdam and Den
Haag were skimmed. What remains is mostly first names filled in from the
article ("Dirk" Sterenberg). A human could skim that list (`npx tsx scripts/audit-fact-quotes.ts -- --names`).

**6. Due-aware “where next” routing.**
The thin slice shipped 2026-09-29 (see HISTORY). With Plan review on, a ride
runs between the landmarks whose line passes the most due names.
**Condition (user, 2026-10-01):** steering past due streets only makes sense
when the route line is shown. With the line off, the rider picks their own
way and never sees the planned detour, so due-aware planning should apply only
with the line on (or be reframed as a hint the rider can see). Still open:
- A due street off every landmark line is ridden as a via, or, when it
  cannot be ridden through, ends the ride as "the mystery street" (see
  HISTORY, 2026-09-30). Each ride takes one such name; the others wait for
  later rides. Of 20 sampled courts and paths off every line, 13 are now
  reviewed (10 as stops, 3 as vias). The other 7 are footpaths and courts
  the bike routing graph does not reach, so the ride ends at the nearest
  landmark instead. Reaching them would take footway access in the graph,
  walking the bike.

**Street-name origins: the licence, and a glossary pass.**
All 5,333 origins are published (see HISTORY, 2026-09-30).
- Water origins show when a waterway is learned by boat, or named at a
  bridge on a bike.
- The API states no licence for `beschrijvingNaam`. Confirm it with the
  municipality before a public release.
- `ORIGIN_GLOSSARY` no longer changes any published card: all origins are
  retranslated, and the one rule that still fired was fixed at source (see
  HISTORY). It matters only for `--trn`. Drop it together with the ~80
  glossary asserts in `check-street-name-origins.ts`, or keep it as the
  `--trn` fallback.
- Send `docs/amsterdam-street-name-register-errors.md` (167 register
  errors, BAG links) to the municipality once the licence question above is
  settled.

---

## P2 — Weight and reach

- **What's New "In progress" strip is stale (found 2026-10-30).** It renders
  `poi-work-queue.json` rows whose status matches draft/in-progress/awaiting,
  a queue nobody has written to since 2026-10-10. Of the nine rows shown, none
  is live: the Jan Evertsenstraat generator pilot was retired 2026-10-14; the
  Keizersgracht 73/Herengracht 54 and Leidsestraat/Kerkstraat one-off
  ordinary builders were frozen (no model exists); the Nassaukade roof task,
  street-profile entrances/crowns, dominant-building triage and the
  large-ordinary pilot were all superseded by the kit lanes and the
  dominant-building backlog; the signage policy has no owner; UvA
  Roeterseiland shows REC B/C/D as a CPU draft while REC-A is installed and
  the remaining builder is held. Decide the source (open `lane` issues, the
  programme bullets above, or drop the strip) and point the page at it.

- **Tunnel cuts: follow-ups (2026-10-31, after round 4).**
  - Phone walls read only modestly. The near wall's face is out of view from the chase camera; the next idea is a vertical face that catches the key light, tested with the rider inside the trench, which needs a camera override.
  - Stationsweg (outside the city): a wall-plus-bank profile would give it a cut.
  - The Piet Hein east west-facing shot needs a camera override; the rider spawns on the path west of the portal.
  - `tunnel-places-shots.mjs` `BUNDLES_DIR` does not reach the own-ground worker. Stage bundles into `public/canal-drive/js` for after-shots, or fix the harness by serving the worker from a swapped path.

- **Movable bridges: what the kit still cannot say (after bridge kit round 2, 2026-10-31).**
  - Ezelsbrug: more fanning stays; round-ended piers.
  - Oosterdoksdraaibrug: the K-pattern web.
  - Mariniersbrug: the lower chord also arches; the web is Warren, not Pratt; the abutment inset is approximate.
  - Peperbrug: the portal is as wide as the footprint, wider than in the photo.
  - Aluminiumbrug: cast scrollwork; a steeper beam slope.
  - Per-bridge paint shades (Westergasbrug darker grey).
  - Berlagebrug: the stepped tower top, the block's eastern extent, brick piers, arched approach spans.
  - Barrier gates (BRU0379); BRU0850's two lift posts; Buiksloterdraaibrug's arched underside.
  - Modern sculptural portals (Wasknijper BRU0177, BRU0307, Pelikaanbrug BRU0277); Omvalbrug pylons.
  - Some boat-view sheets draw no water (sheet renderer).
  - No panoramas for 13 bridges (BRU0227, 0339, 0507, 0516, 0519, 0531, 0538, 5047; 0375, 0592, 2294, 2410, 2481).

- **Batch likeness discrimination (#113, 2026-10-29).** The ribbon era guard is in (HISTORY). Still open:
  - storey count: sweelinck-1-11 was drawn one storey too many;
  - window head shape: measureFacade reads no arched heads; dou-1-7 drew arches over flat-headed windows;
  - the slate mansard with dormers that the De Pijp types add over flat cornices.

  Spot review stays mandatory for each batch, on a 10 % sample.

- **Jordaan placements: evidence, not gates, now (2026-11-10).** Gate defects fixed (HISTORY). Open: an evidence veto comparing measured photo rows with model rows (close crops pass the sky gate); per-storey-count weights for the cornice house (3 storeys at 8.09 m → 2.23 m top); 19th-c stepped/flat attic fronts (Bloemgracht 78) and pointed Neo-Renaissance gables (Bloemgracht 82) are not in the kit; reinstall chunk-face-bloemgracht-138-300-r1 for the new storey weights; `jordaan-1900-gable-rebuild` still needs an Opus strip review.

- **Batch installer yield (#103 follow-ups, 2026-10-29).**
  1. **Type-library coverage is the bottleneck.** Of 133 failed faces, 39 are outside every type's years, 69 are vetoed after the strip and 17 score too low.
     - The Oud-West library has no `match` blocks, so only authored intents can use it.
     - There is no Jordaan library.

     Next lane: grow the libraries by year from the batch's failure reports, then rerun the batch. No hand-tuned faces.
  2. **Openings outside their walls:** shopfront glass past the wall edge, dormer glass through the roof plane, and summed 2 cm door slivers.
  3. **Pale buff brick:** Albert Cuypstraat 153–179 and 241–259 still read about 1.95, because the city tint caps how light brick can be drawn.
  4. **Wrong types in the 2026-10-14 Kinkerstraat intents:** 109–161, 173–225 and 334–374.
  5. **Seen on steen-84-140-r2:**
     - ornate spired dormers are drawn as wide white pediments;
     - arched stoop entries are plain doors;
     - oculi are missing.
  6. **The spot-review sheet** should hold a 10 % sample. It currently holds one face.

- **MapLibre symbol labels draw over 3D buildings (#122 follow-up).** Neighbourhood names ("Oosterdokseiland") now fade but are not occluded by buildings. Also add `labelFade.test.ts` to `test:hud` explicitly (it runs today only via the `labelsOcclusion.test.ts` import).

- **Per-pand modern walls (#117/#120).** The thumbnail gate exists but walls stay empty. Next: project the BAG footprint into the thumbnail to confirm the box is the target pand, and reject scaffolding/sheeting. Also: the strip evidence gate falsely holds fronts under dense bare crowns (Ceintuurbaan, Tweede Jan Steen); 4 near-coplanar wall pairs remain (tiles 8417/5384, 8416/5382, 8421/5389, 8413/5388); `scripts/check-signature-houseboat-suppression.ts` reads a field that no longer exists and is not wired.

- **Rail look, left open (lane rail-look-20261031, round 3 shipped 2026-10-31).**
  Brick arch viaducts and masonry piers are not modelled (viaducts are
  concrete column rows); long river spans have no piers; canopies are thin
  flat slabs with no columns or roof profile; a kiosk on an elevated platform
  cannot stand; lifted approaches have plain walls. The Oostertoegang,
  Dijksgracht and Droogbak bridge types are inferred, not checked against
  panoramas. 5 rail bridge components (65 m, −1_-2, −7_-2) ride road decks.
  Doubtful rail-infra drops: Amstel kiosk NL.IMBAG.Pand.0363100012253545
  (58 m² shop), Westerpark lone arch 0363100012173021. `?world=v1` and the
  legacy MapLibre path do not apply rail-infra-buildings.json. Game frames at
  Amstel and Centraal not shot yet.
- **Rail follow-ups (#124, 2026-10-30).**
  - Overview tiles are pre-generated, so ballast does not show there until they are rebuilt (the tones are in `layerColours.ts`).
  - The far ring (`farRing.ts`) draws no rails, so distant aerial views still show bare corridors.
  - Separate tram beds draw as ballast, but many are grass or concrete in Amsterdam (Piet Heinkade).
  - No catenary masts.
  - Fold the rail ways into the main own-ground Overpass query in `fetch-osm-ground.ts`.
  - Measure the phone cost on a real iPhone (emulated +0.2–0.9 ms).

- **Chunk GLB colour factors are sRGB, not linear (2026-10-29).** `streetChunks/gltf.ts` writes `parseInt(hex)/255` as `baseColorFactor`. Plain loaders (building-gallery, Storybook, external viewers) therefore draw every kit row about two stops too pale. The game and What's New use the `tint` extra. Fix the writer to linearise at the next full chunk rebuild, so every sha moves once, together with covers and goldens. Then drop the `tint` override in `whats-new.html` if nothing else needs it.

- **Generic generator, next (#102 follow-ups, 2026-10-29).**
  - **De Pijp colour, what #121 left.** Profiles now take block-face colour from the face strips, not the type palettes, and salmon swatches went 208 → 0. Still wrong: the city brick chroma lift (×5.3 on thumbnail C* ≈ 5) pushes De Pijp brick to C* 14–24 where the photos are purple-grey, so Tweede Jan Steenstraat still draws rosy brown. KE01 painted share 0.36 looks high (sunlit strips read cream).
  - **Kerkstraat whites.** The painted test now runs after white-point normalisation (#121), but Kerkstraat's fronts are drawn from the AG pool (painted share 0.17), so the hash still picks brick for white and grey fronts. Needs per-pand or per-street colour rather than the pool.
  - **Buurt profile tests have no npm script.** `src/canalRecall/buurtProfiles/*.test.ts` run only by hand.
  - **Saturation.** Fronts are still more saturated than the muted photos.
  - **Tweede Jan Steenstraat** still has an ochre front.
  - **Window traits** are measured only in the block-face districts. The Jordaan and centre profiles have palette and accent shares only.
  - **Crown mix** is stored but not drawn yet; it needs a hook in `roofMesh` `planRoof`.
  - **Modern blocks (#117, landed 2026-10-30). Open items:**
    - **Misses on the 12-spot sheet:** Van Reigersbergenstraat (pale buff, drawn dark brown) and Sarphatistraat (dark grey brick, drawn white). Neither building was sampled.
    - **Use is thin.** OSM tags only about 4 % of post-1945 buildings. Add BAG `gebruiksdoel` (`.cache/bag-pand-uses`) to the building-facts rows.
    - **Not drawn yet:** set-back top floors, glazed, recessed or arcaded ground floors, and floor bands on brick. These need the one spare texture layer, or a roof or extras hook.
    - **BAG years disagree** between building-facts and bag-tiles (Kinkerstraat 0363100012078005: 1900 vs 1980s).

- **Large-recipe tier is blocked for modern ride-visible buildings (#105, 2026-10-29).**
  - **Result:** 17 buildings drafted from the #104 ranks 1–40, 0 installed. Without `--allow-inferred` nothing passes. State note: `docs/handoffs/ride-landmarks-20261029.md`. Drafts are in that worktree's `staging/` and not committed.
  - **Blockers, most common first:**
    1. **Likeness judge on curtain walls.** A glass group with no spandrels has no wall material, so it reads as "wall not drawn" with glazing 1.00, while the photo counts the mullion grid as wall (0.35–0.87). Every glass front fails on this. Fixing it means measuring the model's mullion grid the same way as the photo's. That is a measurement fix, not a looser threshold, but it changes verdicts.
    2. **Crop-to-panel pairing** (0.5 m / 5° / 60 %) misses where 3DBAG facets a front differently from the BAG wall the crop was cut for.
    3. **Towers have no evidence above about 32 m** in the `all-walls` crops.
    4. **Missing from the building tiles:** pands 0363100012165685 (Prins en Keizer, Vijzelstraat 66–80) and 0363100012107557 (Belastingdienst).
    5. **The kit cannot express:** channel glass (NFTA), cantilevered slab balconies, mural fronts, and a warehouse with a modern block on top.
  - **Crash:** KPN Teleport's measure step fails at `export-glb.ts:81`.
  - **#104 list fixes:**
    - De Joodse Invalide (170299) is already covered by `nieuwe-achtergracht-100-253824`.
    - Weesperplein is the underground metro station.
    - "DoubleTree" is OBA Centrale plus Post CS.

- **Modelling strategy reset (user, 2026-10-29).**
  - **Why:** agent-per-face and per-house modelling of ordinary rows is stopped. It cost about 3 M tokens per house (#98: 50 houses for 167 M tokens; #97: 72 M tokens and no installs).
  - **The new route:**
    1. Generic-generator rules that lift about 13.5 k buildings at once (#102).
    2. An unattended batch block-face installer, gated on likeness and stripOverDrawn (#103).
    3. Bespoke models only for named landmarks at the head of the ride-visibility list (#104).
  - **Budget rules:** every lane brief carries a turn budget and a stop rule, with no automatic follow-up rounds.
  - **Superseded follow-ups:** the #98 round 2 (corners, Bilderdijkstraat) and #99 round 2 briefs. Bilderdijkstraat and the Kinkerstraat corners go to the #103 batch. The Beurs gaps and the ferry structures wait for the #104 ranking. Their worktrees keep the partial work.

- **Centraal surroundings, still open (#99, 2026-10-29).**
  - **Beurs, Beursstraat side.** The 14–15 m wall sits 3.4–6.4 m behind a 3 m OSM part and draws blank. Place bays on the set-back part walls.
  - **Beurs, north side.** The arched café entrance is missing.
  - **Beurs, upper walls.** The hall walls above 18 m are blank.
  - **Island.** The water-side deck storey, about 2.3 m below the plaza, is not shown.
  - **Not modelled yet.** De Ruijterkade 37 (the bike-park entrance pits) and the ferry terminal structures (researched only).
  - **Centraal.** zfight-near rose from 413.6 to 501.5 with the canopy (warn only).
  - **Gate flake.** `geometryAudit` "200k-triangle models finish in seconds" took 47 s when load was over 17, and 12.9 s when rerun at load 14. Consider scaling its limit, or skipping it when load is high.

- **Oud-West kit, next (#98, 2026-10-29).**
  - **Corner ownership:** kinker-49-63 and kinker-86-110 pass, but their corner pands (133467, 233580) belong to the installed faces face-bilder-133467-159649 and face-bilder-233580-162444. Installing would drop 153782, 159649 and 162444, so decide which face owns each corner first.
  - **kinker-31-49:** opening-outside on 47's shop. Its front is turned 0.4° from the row, and the audit's wall clustering puts it 3.5 cm off the plane.
  - **kinker-112-116:** needs a stepped parapet and its raised blocks.
  - **kinker-142-178:** balcony side rails near the party walls.
  - **Still failing gates or audit:** 65–87, 120–138, 186–202, 334–374 and 386–390. Intake fails on 244–332.
  - **Not started:** Bilderdijkstraat (installed faces at 0.46–0.58 stripOverDrawn, so too dark), Overtoom, Jan Pieter Heijestraat, Ten Katestraat, Bellamy.
  - **The kit cannot yet say:**
    - sunburst voussoirs
    - scrolled or fluted dormer cheeks
    - glazed green roof tiles
    - alternating segmental and round heads by storey
    - pointed-gable attic lights
    - penthouse blocks
    - frieze consoles
    - the tower dormers on Kinkerstraat 208–210
- **Evertsen wall exposure (2026-10-29).** With the `drawnWall` fix, a rerun gives the evertsen-* faces about 1.0 instead of 0.67–0.75, and evertsen-152-160 2.10 instead of 1.12. Before accepting it, compare an in-game screenshot with the strip on Eerste Van Swindenstraat and Evertsenstraat.

- **GPU load, next (#100 follow-up, 2026-10-29).**
  - Done 2026-10-29: desktop spans and touch facade tiles (see HISTORY).
  - Still to do: re-run iPhone ride-perf after the spans and tiles change.
  - After the deploy, watch Sentry iPad `webgl-context-lost`; `probe.heaviest` should show own-ground at about 300 k.
  - Lever 1 (simplify coarse road polygons) is parked. It needs a new versioned roads extract.

- **Westerpark West, still open (#97, 2026-10-29).**
  - **Blend** (`haarlemmerweg-518`): held. To unblock it:
    - stop `isLeaf` flagging sunlit cream render as leaves, or find a straight-on, low-foliage south crop;
    - check the advisory openings-within-walls failure at the 38 m roof stair box;
    - darken the core-wall windows, which read too pale.
  - **Green-framed blocks** (0363100012570119, 0124, 0120) and the **yellow block** (0363100012570893): 3DBAG has only construction-stage shells, or none at all. These need a new large-tier shell built from the BAG outline plus a height measured from a post-completion panorama.
  - **Wraparound tower** (0363100012116511, draft `haarlemmerweg-290`): it compiles, but all 4 likeness groups fail. Its south crop is a dark 2022 panorama; remodel it from a better one.
  - **Salt:** the white-wall rule fixed its wall; glazing still fails (0.19 vs 0.355, because of reflections).
  - **The kit cannot yet say:** the panel joint grid on render.

- **De Pijp kit, next (#96, 2026-10-29).**
  - **Ferdinand Bolstraat 40–54** is held for tone. It needs pale buff brick and white stucco pilasters in the kit, then a reinstall.
  - **Shopfront grounds** come out with 1 bay where the photos show 2–4.
  - **Albert Cuypstraat 152** has a lighter roof slab above the eaves that the photo doesn't show.
  - **Bol 22:** straighten BAG front kinks under 2 cm in the shell, then install bol-12-22-r1.
  - **Not attempted:** bol-5-19 and bol-21-43. **Intake failed:** cuyp-79-145 (frontages differ by more than 11°) and bol-97-113 (no frontage).
  - **The kit cannot yet say:**
    - white stucco party pilasters
    - dormer balconettes and side cheeks
    - hood dentils and rosettes
    - yellow brick courses
    - a corbel-table frieze
    - frieze lozenges
    - sculpted keystones
    - mansard roof lights
    - the painted-black balconette variant
    - stepped gables in a row
    - a pitched attic band under dormers

- **Kit gaps found by the Noord lane (#95, 2026-10-29).**
  - The kit cannot yet express:
    - irregular window scatter on large-tier walls (Grasweg 41S);
    - see-through bar or slatted fences (Treehouse);
    - per-container colour from a measured list (Pllek);
    - a curved cap on an eaves line.
  - The 2025 NDSM-oost pands (0363100012252793 and 95–98) still carry construction-stage 3DBAG heights of 2.9–4.5 m for blocks of 7–10 storeys. They need a data refresh or a height override.
  - The EYE GLB audit still FAILs on holes (6 open loops, down from 12).

- **Centraal surroundings, still unmodelled (feedback 334bcadd, bbbeaceb; 2026-10-29, #94).** Findings are in `docs/handoffs/centre-landmarks-fb-20261028.md`.
  - **Stationsplein island,** pand 0363100012182895 (Stationsplein 4–16). Low cream rendered pavilions with red-tiled mansard roofs and a white lantern turret. The pand is not in the building tiles, so the game draws generic OSM brick boxes. It needs a bespoke builder.
  - **IJ-side canopy,** in `centraal-complex-builder.ts` ("Overkapping IJsei"). The game draws an opaque dark tube. The photo shows white steel arch ribs down to the quay and an open glazed vault over the glass shopfronts. Measure the rib count and spacing from the orthophoto and panoramas.
  - Missing IJ-side pands include De Ruijterkade 37 (2023).
  - The MapLibre layer `cycling-ferry-terminal-labels` shows "Centraal Station ⛴" twice, once per pontoon. Dedupe it.
  - Stale LOD1 note: the Beurs is still a generic brick mass. It lacks the Damrak arcade, the Beursplein entrance and the stepped gables.

- **Gameplay analytics follow-ups (live since 2026-10-30, HISTORY "Analytics live")**:
  feed `npm run analytics:report -- --buurt-json <file>` into buurt-priority-by-ride
  once a week of data exists. Known limits: iOS may drop the beacon from a
  backgrounded tab, so read completion as finished ÷ started; the public endpoint
  can be inflated (batch caps, `maxInstances: 5`); the buurt lookup fetches the full
  coverage-v1 `buurten.json` (~95 KB gzipped) once per ride, and a slim extract
  would be lighter; Firestore is in nam5.

- **Dutch facts backlog (2026-10-23, HISTORY "Ride and Map Quest speak Dutch")**:
  1,564/2,351 facts carry a Dutch sentence; 787 still fall back to English
  labelled "(Engels)". Next: more agent-writer + fresh-verifier batches via
  `npm run apply:dutch-facts`, preferring features with rich Dutch articles;
  `docs/nl-localization-handoff.md` has both routes and the gotchas. The lane
  was a DeepSeek run, so review its Dutch phrasing with a native reader before
  calling the register done. Brand strings in the catalog were stale on merge
  (Map Recall → Ride Amsterdam / Map Quest); new UI copy must go through
  `src/i18n/messages/{en,nl}.ts`, not literals.

- **Full e2e on CI (2026-10-17, HISTORY "CI green again")**: the suite runs
  nightly in `e2e-full.yml`; triage its first full report. On the 09:21 run it
  failed in askable-bridges (Noordsche Compagniebrug, Vingboomsbrug),
  answered-street-name, block-face (28 lines), building-click-perf, bag-tiles,
  bike-* and bridge-* specs before the timeout; likely software-rendering and
  timing on hosted runners as much as real regressions. The web server also
  logs an unresolved `@sparkjsdev/spark` import from sculpture-splat-demo.html.

- **Low-colour brick re-measure (2026-10-17, HISTORY "Tropenmuseum brick")**:
  19 catalogue landmarks have a brick in the same tan band (Lab hue 55-100,
  chroma < 20) and may carry a sun reading: kesbeke, kesbeke-shop,
  brouwerij-het-ij, el-tawheed, fire-station-nico/victor/ijsbrand/weesp/
  driemond, luther-museum, uilenburger-synagoge, posthoornkerk, oosterkerk,
  maarten-lutherkerk, torture-museum, lloyd-hotel, de-bazel, grasweg-116,
  obrechtkerk; re-measure with `brickAlbedo` against diffuse photos. The
  Tropenmuseum stone #e2d6bc is also a sunlit reading (diffuse trim r/b
  1.01-1.05). Hoofdbureau draws darker and redder than its sunlit panorama.
  The rig's sun is less warm than real sun: sunlit low-colour brick reads pink.

- **Centraal Station after the 2026-10-16 rebuild (HISTORY "Centraal Station:
  the Cuypers front…")**: reliefs, tympanum figures and statues are flat
  silhouettes; tile/mosaic fields and heraldic charges are flat tinctures;
  leaded tracery is bars; no NS logo; the roof lettering is a 5x7 block font
  without the tan border; east-wing kneelers and step profiles are straight
  copings.

- **BAG holes after the 1,601 fills (2026-10-16, HISTORY "BAG pands the tiles
  never drew")**: 1,325 post-2019 pands wait for AHN5 or a newer 3DBAG; the 12
  complexes over 5,000 m² (e.g. 0363100012241555, 3.2 ha at the Zuidas) and the
  130 half-drawn pands need a look; fills are flat boxes with no roof shape;
  Prinsengracht 221-227 deserves a kit/recipe front. Models that suppress pands
  their GLB barely covers need a per-model photo review: westerkerk
  174220/174222 (10 %) and w749287964 (25 %), sint-agneskerk
  197426, vriesseveem-9 w755510629, dominicuskerk w749599657, vinoly w754894011.
  Felix Meritis's rear pand 174322 (0 %) is no longer suppressed: the city
  layer draws that back-street building over the plot's garden, which is the
  correct fallback (2026-10-23).

- **Bridge railings after the water-side fix (2026-10-16, HISTORY "Bridge
  railings stop at the water")**: gates remain on 12 bridges (worst BRU0981, a
  culvert with a diagonal channel; BRU0691, BRU1904, BRU2131, BRU0307); parapets
  inside a road polygon on BRU1935, BRU0001 Muntsluis, BRU0223, BRU0007 (deck
  edge narrower than the surveyed road); BRU0165 and BRU0173 are measured along
  the canal and need re-orienting; BRU0257's west outline runs ~10 m over open
  water; shorter parapets gave some arch bridges lamp posts (`lampAt`); iPhone
  perf unmeasured.

- **Tower-podium leftovers (2026-10-16, HISTORY "Towers on podiums")**: the 27
  model-owned ridge-tower pands stay whole until the hide sinks resolve `pand`
  (`coloredBuildingLayerFilter`, the three.js ranges id in
  `threeBuildingMesh.ts`, `buildingTypes/runtime.ts` suppression, recipe-tile
  covers); clicking a tower misses its pand's card and answer highlight lights
  only the podium; middle tiers draw at podium height (no face banding); the
  tower top is the ridge, which differs from the LoD1.3 face by -9.5 to +39.8 m;
  most 100 m Zuidas towers come from OSM parts, not BAG.
- **Landmark abutter fold-ins** (2026-10-16, HISTORY "Landmark abutter
  survey"; queue and evidence in `docs/landmark-abutters-survey-20261016.md`,
  verdicts in `scripts/landmarks/landmark-abutters-allowlist.json`): 25
  city buildings are part of their landmark and draw as generic kit
  blocks. Noorderkerk corner houses DONE (HISTORY). Its south-west
  consistory is now plainer than the three new houses; bring it up with
  the same helpers. Queued, one lane each, photo first: Nieuwe Kerk choir annex (pand 0363100012176224), Sint Nicolaas
  wing/rear wing/pastorie (w750591089/87/84), Oude Kerk houses against
  the walls and chapel bay (w749242497/98, w747868956, w749242502),
  Amstelkerk house/lean-to with bell-cote/timber annex (pands 178570,
  178594, 178561), Vredeskerk parish building (w1462571384), Rijksmuseum
  Philips Wing (pand 0363100012235882), W139 street front (pand
  0363100012171794); suppress only: Centraal w1239767726 under the bus
  roof. Separate but drawn wrong (kit/height, not fold-in): RAI
  w806961002 (8 vs 15.6 m), Nieuwe Kerk w747924620 (mansard drawn as a
  19 m box), Rijksmuseum Asian Pavilion 0363100012241554, Petruskerk shed
  0363100012220864 (0.04 m). 13 unclear (Centraal east wing in
  scaffolding, The Movies Haarlemmerdijk 157, De Krakeling, Frascati,
  Tussauds, Victoria Hotel, Walloon portal, Fatih gate, Chassékerk,
  Sint-Agneskerk ×2, Boomkerk) need a second photo. 465 of 560
  candidates are unreviewed (score below the gate); main noise is
  terraced neighbours on a wrapped block and complex-wide monument
  records (Mercatorplein, Westergasfabriek, DeLaMar). Each fold-in that
  lands removes its PENDING entries from the allowlist.
- **DeLaMar rear walls** (2026-10-16, HISTORY "DeLaMar on every side"):
  the north-west auditorium curve and the south-east and rear walls are
  inferred plain brown brick (no street panorama sees them), and they show
  on gallery cards and from the pitched camera. Read them from open aerial
  or oblique sources (open data only) and dress them. Kit gaps the lane
  reported: mixed-case lettering, glazed tile texture, curved glazing,
  pediment-dormer and stepped-gable silhouettes; `review:sheet` ignores
  the panorama's camera height (2.44 m fixed), so across-the-canal photos
  misalign vertically.
- **Landmark queue, next** (2026-10-14, HISTORY "Landmark queue, batch
  10" and "Figures, second pass"): STOP building statues with the figure
  kit (user, 2026-10-14: "bizarre"); the prototype (HISTORY "Measured
  tint, the shared house-type library, the sculpture prototype") says
  route B (TripoSR from one licensed Commons photo, ~20 s per statue) for
  the ~18 single figures and organic forms, per-figure route B on a kit
  plinth for the ~6 groups, kit primitives for slab and lettered
  memorials; before any install decide bronze tint vs vertex colour and
  the freedom-of-panorama question (user); automate photo pick → cut-out
  (IS-Net fallback) → TripoSR → decimate → strip as one command DONE
  (HISTORY "Statue batch 1": 13 run, five beat the kit, Mama Baranka also
  via TRELLIS.2 three-photo; nothing installed, the user picks from the
  demo page; next multi-photo candidates Waterdraagster, Wilhelmina,
  Spinoza; second photos needed for Anne Frank, Multatuli, Rembrandt;
  Gandhi re-run with `--kit-plinth`); user
  decisions open: install the Xcode Metal Toolchain for the ports' Metal
  backends, and request official DINOv3 access on Hugging Face before any
  TRELLIS.2 statue ships (the trial used timm's ungated copy); Object
  Capture tried (HISTORY "Object Capture"): only a
  same-photographer Commons series gives a front half, panoramas resolve
  nothing, so it is a reference check, not a route; re-ask the city for
  the mobile-mapping cloud host; the backlog needs a pass that
  marks built ids and location matches as done (Carmiggelt, Winkler Prins,
  Anne Frank, Walraven van Hall, Multatuli still read pending); dedupe the
  Thijssen/Jordaan lines in `build-manual-landmarks.ts`; left from the
  figure pass: Anne Frank's coat body, Spinoza's ear falls, Johnny Meijer,
  the two north-end Kinderbrug groups (no open photo), Teun de Jager's
  facing;
  Spinoza's inventory `how` text still describes the old cone and its
  curls are low-poly; Teun de Jager unverified against a close photo;
  Westermoskee NW/SW walls and SE porch unphotographed.
- **P0 Live play, 2026-10-14 (user screenshots on the live site, boat ride
  Hugo de Grootgracht → IJ-toren with `?ownGround=1`)**, lanes running:
  (a) DONE own ground is the default (+2.5 ms main thread, +90 MB, frame
  time unchanged); (b) DONE the start faces the first leg (HISTORY "Own
  ground on by default; the start faces the first leg");
  (c)–(g) DONE road paint at junctions, ground light, near facade detail,
  the brick quay legend, houseboat berths (HISTORY "Live play at the
  Singelgracht"; frames on the demo page). Still open from those: the
  ground look is `bright` since the orthophoto measurement (HISTORY
  "Ground tones measured"; `?groundLook=default|measured|legacy-ish` to
  compare); if the user wants lighter still, bright with the road at ~150
  and a deeper cycle red is the next variant; recipe
  faces for the Singelgracht quays (Marnixkade 73 pands, Nassaukade 46)
  and the Frederik Hendrikbuurt / Jordaan edge; the `recipeTiles` default
  after a ride that crosses a pilot tile; a node-tag sidecar in the extract
  (give_way, stop, traffic_signals, crossing nodes) and `cyclestreet` tags
  so markings come from data, not priors; the grey box in the Singelgracht
  and the Westerkanaal land blob are DONE (HISTORY "3DBAG ground
  outliers": a real pand with a bad 3DBAG ground, 540 such pands citywide,
  410 patched; the blob is the lock's middle head, pinned); the
  readers all go through the rule now with a 1.5 m reach test (HISTORY
  "Ground from the terrain everywhere": 312 corrected, 98 split-level
  restored); open: the 2–3 m Houthavens/Revaleiland cases (2018–2020)
  unchecked against photos; a true building-tile rebuild needs
  `buildings-osm.geojson`, which no checkout has (re-derive or archive
  it); bag-tile 8412/5384 lacks eaves/ridge/roof/year for five pands
  since the Jan Evertsen re-key;
  (c)–(g) are DONE above as (c)–(g); still open: (h) the Singelgracht
  bascule at the Haarlemmerpoort draws as thin green outlines on a bare
  deck, no abutments, railings or lamps; (i) a Spaarndammerbuurt footbridge
  floats disconnected from both banks (deck must overlap the abutments and
  meet the quay top; count floating ends); (j) the Zoutkeetsgracht bascule:
  hollow floating portal, slab deck narrower than the approaches, asphalt
  deck between brick approaches, abutments short of the quay walls (the
  bascule type is a rebuild: pylons, beams, counterweight, leaf with kerbs,
  width from BGT, abutments meeting the quay, continuous railings, lamps);
  all three DONE in the bridges lane (HISTORY "Bridges per bridge"; the
  bascules have counterweights under the deck in the panoramas, so masts
  and barrier boxes, not portals).
- **P0 Large tier: the photo-likeness plan** (user, 2026-10-14, HISTORY
  "User review + plan", "Large tier reconciled"): lanes A, B, B2, C and
  the reconciliation are DONE; the five pilots are installed from
  measured values on the kit systems with inferred notes. (1) measurement
  limits DONE 2026-10-16 (HISTORY "Facade measurement limits": 43 of 252
  group verdicts move, 3 PASS → FAIL, 24 WARN → FAIL, 15 FAIL → WARN);
  open from it: re-fit the 54 lane-D houses to the new glazing before
  reading the 27 new FAILs as model faults, and eyeball the 43; (2) lane
  D DONE (HISTORY "Large tier triaged": 54 re-fitted, 12
  uninstalled, 11 kept, ride visibility written); open from it: verify the
  11 "re-fit cheap" verdicts without a re-install (Oude Turfmarkt, Nieuwe
  Achtergracht 253754, Politie Van Leijenberghlaan, Zuidoost-Gaasperdam,
  Nieuwezijds Voorburgwal, Oost-Watergraafsmeer, Politiepost IJburg,
  Meeuwenlaan 132, Rigakade 8, Nieuwpoortstraat, Warmoesstraat garage),
  Haarlemmerweg 325 after a louvre-screen system, the 7 ornamented fronts
  as bespoke builders, `build-dominant-building-backlog.ts` to carry
  `rideVisibility`; (3) the held `large/dominant-7-20261014` branch gets the same
  pass and merges only passers; (4) kit gaps per pilot listed in the
  HISTORY entry (Waagdragerhof's light band storeys and paired windows,
  Houthavenkade's column transoms, Spinoza's mullioned doubles,
  Wibautstraat's finned top storey); (5) re-fit Metis, Oostpoort and
  Rietveld after (1), Rietveld needs a dimpled-metal skin and a perforated
  white screen component.
- **Own ground after the belt lane** (2026-10-14, HISTORY "belt audit
  clean, pockets…"): a BGT-driven sidewalk/road fill for land over BGT
  road away from junctions (Oud-West 11.6k m² per 300 m window); pocket
  fill costs 90–130 ms per LOD 0 cell; the far ring's contrast with the
  recoloured basemap is subtle (consider dropping the basemap fills
  inside the far radius); phone layout and iPhone measurement for the
  far ring; 22 parks and 110 playgrounds without BGT polygons.
- **Public buildings, next** (2026-10-14, HISTORY "Schools as large
  recipes", "Roeterseiland REC-A"): REC-A second pass (podium panels
  49/176 and the long north wall blank because the audit's wall raster
  fails on two 320 m² triangles: split them; west-beige top row; the
  diamond lattice; strips); CREA (pand 0363100012164972) as a large
  recipe; then
  survey lane (pand 0363100012185420); remaining with usable panoramas:
  Hogeschool van Amsterdam, Gerrit Rietveld Academie, Het 4e Gymnasium,
  Metis and Oostpoort Montessori, Spinoza, the UvA Spui building; AMC,
  VUmc, AvL and BovenIJ are blocked on panoramas or BAG matching.
- **Large tier after the layered re-installs** (2026-10-14, HISTORY
  "Layered re-installs, part two"): `check:stale-installs` is in the gate
  and must stay at 0 after every golden change; Politie West
  Overtoomsesluis fails footprint-vs-bag 0.749 (try `shellRepair: true`,
  HISTORY "3DBAG shell repair"); Revaleiland 58 is 0.2 m over the open-edge
  limit after repair; Gillis van Ledenberchstraat 34 needs its ground
  outline cut to the overlapping pands; `footprint: "bag"` needs polygon
  union/adjacency before its walls close; an eaves override per group
  would let Singel 457's west gable draw; seven large recipes are
  not installed (De Balie, Ledenberch 38, Nieuwendijk HM, Passeerdersstraat,
  Politie West, Social History, Roeterseiland REC-A) and should be installed
  or deleted; Stadsdeel Nieuw-West's ribbon mullions still eat the budget
  (a cheaper ribbon-window frame); the catalogue `updatedAt` churns on every
  re-install and should be dropped from the diff.
- **American Hotel leftovers** (2026-10-14): the tower drum (R 1.75 at
  [-7.6, 18.3]) stands inside the 3DBAG tower block below 28 m while the
  footprint's bulge fits a circle at (-7.66, 19.59); decide whether the
  upper tower moves ~1.3 m south against the pitched views; inventory
  `sheetBox` crops; `meta.json`/`research.json` sources; 3 of 30 gable-front
  openings flagged off-size.
- **Tropenmuseum, after the fourth pass** (2026-10-16, HISTORY "Tropenmuseum,
  fourth pass"): the measured brick #a2856c reads tan-brown against the card
  photo's rosier red and the scene lighting keeps it duller than the sunlit
  photo (check the tint method against a sunlit crop); lights grouped in twos
  and threes per bay, paired souterrain lights, iron bars, haunch blocks,
  dentil and console cornices, brick dormers with copings and the swung gables
  are not expressed (no byte budget left: 3.7 KB headroom); `audit:glb`
  opening-outside 21 parts / 33.1 m² on twisted 3DBAG faces wants a plane-
  clustering fix or a baseline entry; the 151 side has no panorama (inferred).
  The rebuild also showed committed GLBs for hoofdbureau-elandsgracht,
  maagdenhuis and roeterseiland-rec-a out of date with their source.

- **Large tier after the components lane** (2026-10-14): OZ Achterburgwal
  233 needs a per-group party-wall override to place its baroque gateway
  (panel 266 hits a neighbour on one of three probes); Engelsesteeg's
  corner is straight in 3DBAG so `curve` cannot apply and its green wall
  strip still draws as windows; Beursplein pilaster banding is two-tone
  courses not rustication, the corbelled balcony and attic relief are not
  modelled; `nieuwendijk-hm-165747` (shell gap) and
  `passeerdersstraat-242951` (LoD2.2 vs BAG footprint) still blocked.
- **Memorial figures, second pass** (2026-10-14): the figure kit covers
  the four memorials (HISTORY); left: Night Watch plan from a measured
  top-down source, the dog and the chicken, the Vondel lyre and wings,
  Rembrandt's script inscription (block capitals now), the Slavernijverleden
  platform heading and the giant's cast surface, the Rembrandt terrace
  steps and lawn. `figure-kit-check.ts` is not in an npm script yet. Begijnhof: the east and west rows miss court-facing windows
  (openings blocked by neighbouring walls are skipped), the gable ornament
  and the real gable order per house are not modelled.
- **Hoofdbureau leftovers** (2026-10-13): no columns on the w22 return;
  the w15 glazed top is flat against the wall; the figures carry no
  attributes and the banner is a smooth curve; w23's top 1.3 m sits on an
  undrawn projecting face; the Marnixstraat ground ribbon is taller than
  the measured 2.1–4.3 m; the red lantern and the w13 glass-block ribbons
  are not modelled; walls with no photo stay inferred kit walls.
- **P1 Commercial streets: Kinkerstraat, then Jan Evertsenstraat** (plan
  Part 2, user 2026-10-14): shared type library DONE (`scripts/block-face/types/<district>/`,
  `blockFace/typeLibrary.ts`); Kinkerstraat survey DONE (HISTORY "Kinkerstraat surveyed": 217 pands,
  28 faces with strips; large/bespoke candidates listed; `kinker-240-240`
  no sightline; the two halls need another capture date); Oud-West type
  library DONE (HISTORY "Kinkerstraat type library": seven types over 207
  pands, measured palettes, two proof faces compiled; the brick-arched
  type has its white courses and springer rows since the accents pass); the odd side is DONE as eight
  faces, 76 pands (HISTORY "Kinkerstraat odd side authored") and the
  even side as twelve faces, 103 pands (HISTORY "Kinkerstraat even side
  authored"; open: single-pand faces 140-142, 382-382, 392-392 need the
  validator to accept one house, or a house recipe; the 244-332 chunk is
  3.2 MB, split it; `palette-from-strip` reads black paint as glass; the
  Ö glyph); never `compile.ts --install`; next on the street:
  the rear-facade lane (the GLB z-fight on every face is the inferred
  rears), `compile-recipes.ts --faces=kinker-` into recipe tiles and the
  changed-pand page, ride shots at five points, the wall-colour misses
  DONE 2026-10-16 (HISTORY "Kinkerstraat wall colours read from the
  photo": 31/47/63/87 within 4–17 RGB of the photo, 21-23 painted storey,
  `kinker-1885-wall-dormer` and `kinker-1893-plain-step-gable` promoted,
  odd 57/59/63 window widths; open: a look that reads `tintWhitePoint`,
  the lightness-0.18 floor on black paint, Kinkerstraat 2 drawn 0.2 m
  narrow, re-install the recompiled faces), and the kit
  gaps by count (wall anchors 21, arcade piers 13, frieze panels and
  consoles 13, pointed gables 10, set-back top storey 10, brick-relief
  tympana 7, shop mezzanine 7, 109-161 arcade ground, 2-30 shell dormers);
  review lane with the camera-matched row, likeness and a verdict per pand,
  ride shots at five points; Amsterdam School components DONE (HISTORY
  "Amsterdam School components"; plus glass-block band, lisenes, window
  hoods; still missing: side-hung casements with a fixed top light, the
  plain parapet zone, stepped corner masses; `faces/_jan-evertsen-94/`
  has the 26-pand strip, facts and uses, no intent yet) and the
  Street-View pilot retired; the two long-red tests are green (HISTORY
  "3DBAG ground outliers": stale survey paths re-recorded, a VM harness
  fixed); Jan Evertsenstraat survey DONE (HISTORY "Jan Evertsenstraat
  surveyed": 148 pands, 19 faces, type sketch; the plan's "erker" type is
  rare there, 4 of 148, hood-lisene 40 and lintel-band 18 are the bodies);
  De Baarsjes type library DONE 2026-10-16 (HISTORY "De Baarsjes type
  library": five types, ten kit keys, evertsen-7-41 proved; open: author
  the hood-lisene row 93–140, balcony-slot 59–87, ladder-plain 45–90 and
  white-attic 139–156 faces, the canopy as a deep white slab with a
  measured depth, the shop-glass head at 2.6 m, the corner groups'
  oriels/frieze/balustrade, the 7.51 m strip gap between 9–11 and 13, and
  the 3DBAG roofs above the 15.3 m parapet on 35–41 wait for the
  kit-rules lane), then face lanes; re-run `commercial-merge.ts` for
  Kinkerstraat from a checkout with its staged crops (uses on 0 of 217
  pands, bug fixed in the survey lane); Mercatorplein towers
  and arcades DONE bespoke (HISTORY "Mercatorplein: both towers"; next
  there: OBA Mercatorplein as a bespoke builder from its inventory, the
  kit promotions listed, the 3DBAG roof block override), De Hallen DONE as a staged recipe
  behind its landmark (HISTORY "De Hallen measured and staged"; retire
  the landmark and install when the kit does glass ridge lights and
  stepped stone-coped gables), Kinkerstraat 32–54 and 89–105 installed
  (89–105 needs cantilevered balconies and tiled stair towers); district style packs in
  `look/palette.ts` keyed by CBS buurt with a per-pand district index in
  the facts sidecar and the streamed rigid canopy; a destination on each
  street for the seeded ride.
- **P1 Canal-house windows and white accents** (user 2026-10-14 "window shape
  on canal houses is important to me, as are white-brick accents"): the
  survey keys are in the kit (HISTORY "Canal-house windows and white
  accents measured into the kit"; eight `cw-*` regression houses, not
  installed). Open: the sixteen things the kit still cannot say listed
  there, first the four the photos show most (loading-door axes, shutters
  whose field the fit ignores, fanlights, carved keystones); the Nassaukade
  506 benchmark block is DONE as a compiled face (HISTORY "Nassaukade 506:
  the user's benchmark block in the kit": six components, the face reads
  as the photo on 149/145, kit gaps listed); the accents pass is DONE
  (HISTORY "White accents read white": painted stone tint, springer rows,
  round arches with dark tympana, measured head lines); next on it: 147's
  cream cornice band where the photo has brick, Kinkerstraat `windowShare`
  0.55 → ~0.65 (0.8 vs 0.95 m), wedge springers, band lines per storey,
  150's recessed course, two stone colours per house, bell mansard,
  medallions, cast-iron grilles, canted erker; then install
  the face and the two Kinkerstraat proof faces through the tile compiler; then a pass over the installed
  canal-belt recipes with `windowHeights: 'diminishing'` and the measured
  `windowShare`.
- **P1 Ride-review rows, Jordaan and Plantage** (HISTORY "Ride review,
  Jordaan and Plantage"; three fixed there; J2, J3, J6, J8 and P4 fixed
  2026-10-16, HISTORY "Ride-review rows fixed"): still open: J3's tower
  top (MapLibre caps pitch at 60°); J8's flush cue is ~1 px from the
  chase camera, the deck needs its own surface from the quay's bands
  (the BGT roads lane); J6's e2e has one probe of headroom; the
  `landmarkSightline` test needs an npm script; inner-block gardens as
  bare sand DONE 2026-10-16 (J4, HISTORY "Inner-block gardens from
  BGT"; open: shadowed yards, canopy over paving reads as lawn, sheds as
  holes, the far ring); Bloemgracht streamed boxes (J5,
  the recipe-tiles migration); Noordermarkt playground slabs (J7);
  Entrepotdok warehouse boxes and gable stubs (P3); Artis main gate and
  the Hollandsche Schouwburg as landmarks (P5, P6); dark masses across from
  Artis (P7); the rippling curved facade (P8, check a photo); the
  Gandhiplantsoen hedge box (P9). `scripts/ride-review-shots.mjs` with
  specs in `scripts/ride-review/` is the method for the next
  neighbourhoods.
- **P1 Bridges: per-bridge fidelity** (plan Part 3, user 2026-10-14): the
  lane is DONE (HISTORY "Bridges per bridge": 255 bridges with facts, 43
  of 48 named sheets pass, two bascule styles, decks reach the banks, 190
  more decks measured, 499 still flat). Open: BRU0036 (belt audit sends it
  flat) and BRU0040 (no boat view); the Torensluis arches read taller and
  narrower than the photo and its e2e hump check reads deck crowns in
  metres from the store since 2026-10-14 (HISTORY "The bridge e2e reads
  deck crowns in metres");
  Blauwbrug balusters thin; bascule deck surface
  matched to the approach, portal lamps, railings continuous with the
  approaches; the 15 known floating ends; the 499 flat decks (128 AHN
  tree gaps now mostly covered by the surface model, the rest viaducts
  and the unnumbered); kit gaps: Blauwbrug lantern columns on pedestals,
  bridge-keeper's houses, tram wires; automatic arch-count and parapet
  readings are not trusted (5/12, 11/23) and need a better detector or
  more hand readings; budget tiers by ride visibility not started.
- **P2 Route start guard**: report when the planned route's first point is
  far behind the spawn (the start-heading bug's root cause; the fix reads
  the leg from the spawn, the planner could also snap better).
- **Parks, next** (2026-10-14, HISTORY "Parks from the BGT survey"):
  lawn/bed/shrub as flat tones only (a stipple or relief pass); BGT walls all at 0.75 m; 22 parks and 110 playgrounds without
  BGT polygons; the raw BGT cache is archived in
  `map-recall2-source-data/datasets/bgt-parks-20261014`.
- **Roof slots: the Bonboon-class corner** (flat block after the attachment
  fix) can take its real slot and furniture now; check the Rozengracht corner
  reads as a roof, not a grey lid.
- **`check-manual-landmarks` fails on `homomonument`** ("exact replacement,
  bounded host opening or native standalone landscape required"), already on
  main before the 2026-10-13 merges (94e7780f). The check is not in
  `check:canal`; fix the spec (or the gate) and add the check to the gate.
- **Stipple on zoom out (user 2026-10-13, aerial over the Singelgracht)**: at
  camera heights of a few hundred metres every generic facade and roof shows
  a field of white dots — the window cells of the bay texture minifying
  without a far tier. Fix in the distance tiers of the facade/roof cells
  (`look/slotCells.ts`, `bayTextures.ts`, `threeBuildingMesh.ts`): far tier
  samples a flat wall colour (mean of the cell), mid tier a mipmapped cell,
  near tier the full cell; same for the roof cells. The roofs-and-sheds lane
  (2026-10-13) owns the roof cell scale by distance; the facade half is the
  same change. Acceptance: the Singelgracht aerial shot at 300 m shows no
  dots, the Bilderdijkstraat saddle shot is unchanged.
**New-build stand-ins in the building tiles.** 3,671 OSM footprints started
2015+ now fill holes the 3DBAG `v20250903` snapshot leaves (see HISTORY,
2026-10-03). They are tier 4 with estimated heights: 1,995 kiosk/shed-sized at
3.2 m, 369 from measured neighbours, 64 from OSM height or storeys, and 1,243
at a 9.5 m default because nothing nearby was measured. Next: rebuild
`build:lod1-city` on a newer 3DBAG so measured panden replace them
(`npm run fill:new-build-gaps` then finds 0), and rerun the fill after each OSM
refresh in between.

**Fix BR020's name in OSM.** The game shows Vinyl Rocks through the local
rename list (see HISTORY, 2026-10-03), but OSM node 12876814546 still says
"Br020". Once someone edits it upstream, the next POI build prints the entry
as unused; then delete it from `src/canalRecall/poiRenames.ts`.

**Municipal trivia beyond street names.** Monument status, architect, years
and function now reach clicked buildings (see HISTORY, 2026-09-30). Still open:
- the register's public descriptions (`redengevendeOmschrijvingPubliek`,
  1,891 texts, median 4.5k characters of architectural Dutch) need a
  shortening pass before translation;
- `amsterdam_canon` (49 windows; API `amsterdam_canon/canon_amsterdam_2025`)
  has only year, title, location and theme. The window text is on
  amsterdam.nl behind a bot check, so it is not scraped. These need another
  text source before they can be stops;
- bridge cards now carry the register (see HISTORY), including all 14
  bridges named "…sluis". The separate lock register (`sluizen`, 46) is not
  used; it would only add that a lock lies beneath. Two road names on multi-bridge ways, Jan van
  Galenstraat and Radioweg, could be resolved per crossing from
  `bridge-crossings.json`. The other six refusals are correct.

**Driving harness: the remaining misses (updated 2026-10-01).**
`tests/e2e/driving-harness.spec.ts`, with the trail back-out driver: desktop
111 of 120 arrive (2 lost, 7 timeouts); iPhone 104 (3 lost, 13 timeouts);
0 pinned, 0 wedges. The floor is raised to 80%. The timeouts are long routes
that the 200 s budget does not cover at the driver's 60/170 cruise. Replanning
when off the route, or when lost, was measured and lowered arrivals (98 and
109), so the driver replans only after backing out.

**Material demo e2e fails (seen 2026-09-30, still failing 2026-10-01).**
`wall-material-demo.spec.ts`: `material-demo.html` never reports ready and the
visual report finds no checked evidence. This is probably missing local demo
data. Both tests failed the same way before the Da Costa study was retired.
The study-route, appearance-colour, wall-colour and camera-stability specs
were deleted with the study (see HISTORY).

**Wall colour/material: finish Jordaan + Da Costabuurt evidence and local-model evaluation.**
The colour/texture focus supersedes new roof work for this appearance batch.
See `docs/plans/district-rectification-expansion.md` and
`docs/plans/district-rectification-gaps.md`. The complete eligible queue is 4,339
frontages / 3,472 owners; 683 exact-district owners need candidate recovery.
The resumable native-4000px worker is processing both districts. Local Qwen
completed the 100-source speed/label comparison; independent, diverse references
and obstruction abstention still need evaluation before trusting bulk proposals.
The resumable material worker now combines classifier receipts, native masks and
upper-wall photo measurements. Review these diagnostics before any publication. Finish source identity, photo colour
sampling and rendered colour/texture review separately. Existing 100-owner source
assessments and six broad-family renderer passes remain useful but are not an
accepted district appearance overlay. No default-game texture rollout yet.

**8e. Ground-floor colour band: three passes, and the statistic is wrong.**
*Opened 2026-09-26. See `FACADE_BANDS_REPORT.md` at the repo root.* 36 of 46
visible bases differ from the wall above, so one wall colour per building is
wrong for four buildings in five, and wrong exactly at eye level.

| pass | commit | differs found | same correct | obscured abstained | strict |
| --- | --- | --- | --- | --- | --- |
| one | `cd4634a` | 1/36 | 10/10 | 0/12 | 11/46 |
| two | `b823966` | 8/36 | 3/10 | 11/12 | 11/46 |
| three | not merged | 0/36 | 6/10 | 11/12 | 6/46 |

Pass two's real gain was occlusion abstention, 0/12 → 11/12, by reading the full
Vistas label map instead of a binary `building == 2` mask.

**Pass three is a measured negative and closes a direction.** Base-to-upper-wall
colour distance, normalised by within-wall variation, over the 46 labels:
`differs` median **2.12**, `same` median **2.17** — the distributions are the
same, and the best possible threshold takes 36/36 differing bases while keeping
0/10 matching ones. It detects "the base is not the wall above it", which is
true of 78% of buildings, not "the base is a different material". **Do not
re-run the raw-distance-to-wall test; it cannot separate the classes.**

Two traps now pinned in the regression corpus: on a mostly-painted facade the
"wall above" is partly the thing under test (Lauriergracht 74 is cream from 18 m
to 3 m), and a crop whose `baseZ` is 3 m starts *inside* the 2–6.5 m search
window, so a plinth at 5.5 m reads as a shopfront.

If it gets a pass four: a local change-point *within* the metric window, wall
reference chosen by coherence rather than a fixed height band, normalised by
local variation. Separately, the occluder class cannot distinguish a van *in
front of* a shopfront from a tree *beside* one — 4 of the 10 `same` abstentions
— and that needs a tighter per-frontage crop, not another threshold.

**8d. Sign text: use the vote for corroboration, not correction — and get the
reference set.**
*Opened 2026-09-25. Plan: `SIGN_PHOTOGRAPHY_PLAN.md` S1/S1c.* The owner reported
the OCR as terrible, with partial words from shadow and occlusion. Two
assumptions turned out to be wrong when measured, and the correction matters
more than the complaint:

- `run_vision_ocr.ts` **already defaults to the ground tier** (110 px/m over a
  4.9 m band). The tighter crop is not an improvement waiting to be made; it is
  what produces today's output, and the full tier is far worse — 11 of 45
  storefronts read against the ground tier's 33. The partial words happen at the
  higher resolution, so more pixels will not fix them.
- Preprocessing (`scripts/facade-eval/prep-ocr-crops.ts`, 3x Lanczos + CLAHE +
  sharpen) reaches 38 of 45 storefronts and 158 lines against 104, but the gain
  is mostly *more fragments*, not cleaner ones.

`src/canalRecall/facade/signConsensus.ts` votes across readings and is right on
the cases it was built for, recovering `CLAIM NU OP`, `EERLIJK ETEN.NL` and
`MAGAZINES GIFTS BOOKS` from readings where no single one was correct. Over the
full cached corpus, though, it changes 24 of 1,340 strings with several
regressions, **and `agreement` does not separate the good changes from the bad**
— two wrong strings score 1.00 while a correct one scores 0.79.

So: ship `support` / `views` / `years`, which are trustworthy now and are what
the persistence and invention filters consume. **Do not wire the rewritten text
to anything yet.**

*The reference set now exists* — `review-data/sign-gold/v1/transcriptions.json`,
four crops transcribed by looking at them, scored by
`scripts/facade-eval/score-sign-consensus.ts` — and it settles the question
against the vote: **9/10 names recovered and 5/10 exact, identical to the
do-nothing baseline.** The vote fixes `O TEM FA C` and breaks `ScooterCentre` in
the same run. Clustering by co-location as well as string cut inventions from
7/31 to 6/29 and moved neither recovery number. Do not tune this further without
a larger reference set; a tie is the answer, not an invitation.

**Next, in this order, because the reference set says where the loss is:**

1. **Match against OSM `name`.** Four of the ten names are on businesses OSM
   already names. Where the identity is known, the reader only has to confirm a
   sign is there and locate its rectangle — a fuzzy match against a one-element
   candidate list, which tolerates far more character error than free reading.
   Highest value remaining, and it needs no new imagery.
2. **View selection (plan §3).** On the Freddy Fryday frontage the fascia panel
   crops the leading F, so `REDDY FRYDAY` is a *correct* reading of what is
   visible; the name exists only on the hanging sign and the chip-cone. That is
   a choice-of-rectangle problem, not a text problem, and no amount of voting
   reaches it.
3. Leave the vote where it is, publishing `support`/`views`/`years` only.
   `LA BASTA` read as `DASTA` and `PASTA` — both wrong on the same letter — is
   the shape of what voting cannot fix: redundancy pays only where the errors
   are independent.

**8a. Extend reviewed appearance coverage.**
The source-bound wall-colour loop and autonomous review expansion are documented in HISTORY.
Remaining work:

- Resolve withheld or conflicting wall observations using better visible wall
  regions. Separate two-tone walls and trim instead of blending colours; do not
  invent a contrasting ground floor. Expand photo coverage beyond the 501 owners
  represented in the current review sample.
- Wire the 72 unique frontage signage reviews into source-bound game sign placement;
  the review page already loads them, but generic game signs do not consume this set.
- Collect stronger source profiles before enabling parametric gables. Lowering
  complete building masses to eaves leaves gaps without measured gable-end walls
  and complete roof coverage, including while detail tiles load.
- Expand coverage beyond the target district. Keep contextual colours explicitly
  procedural, with the existing coverage switch exposing only accepted walls.

**8c. Fill the openings the detectors cannot see.**
*Opened 2026-09-24.* The owner reviewed `facade/openingMerge.ts`'s union of the
detector lanes and found it good; its one real failure is **missing** openings,
where a van, tree or shadow hides windows. Detecting harder cannot fix this —
the evidence is not in the image. `facade/openingLattice.ts` (in progress,
branch `feat/facade-lattice`) infers them from the rhythm of what was found:
rows clustered first and trusted most, horizontal spacing estimated *within*
each row because Amsterdam bays are irregular and window heights shrink by
storey, ground floor excluded by default, and abstention rather than invention
when a row is too sparse or its spacing inconsistent. This supersedes the
framing in item 10 below: the union is the working part, and the gold set's
role is now to score imputation rather than to adjudicate the detectors.

**8b. Finish typing the game subsystems.**
Measured 2026-08-31: ~21,000 lines of TypeScript against ~6,100 lines of
hand-written JavaScript in `public/canal-drive/js/` (the other ~1,300 JS lines
there are esbuild output from `src/recall-store`, and every `*.bundle.js` is
generated from TypeScript).

The rule that has been working, and should decide what moves: **decisions in
TypeScript, painting and adapters in JavaScript.** `noticeCards.ts` +
`renderer.js`, `bottomHud.ts` + `hud.js`, `streetOverlayStyle.ts` +
`vector-map.js` are all this shape and all have tests on the half that decides.

`road-network.js` and `osm-loader.js` are both adapters now. Surface bands,
junction-aware road-name selection, same-name feature stitching, graph
construction and Dijkstra live in typed modules; so do the projection,
Douglas-Peucker simplification, network recentring, snapping, start/finish
selection and the slippy-tile grid (`osm/roadProjection.ts`, 6,542 real
Amsterdam paths asserted against the algorithm it replaced).

What is left in `osm-loader.js` is Overpass mirrors, failover and `Image`
loading — network I/O that can only be tested by going to the network.

**No un-migrated decision logic remains under this item.** Overlay preferences
(item 8c) are typed; what is left in `game-route.js` is the Game adapter.

Settled 2026-09-01: `track.js` was dead — `this.track` is only ever a
`RoadNetwork`, and the `Track` class was constructed nowhere — so it is gone.
`car.js` is **not** dead despite the same suspicion: `PlayerCar extends Car`,
so it is live base physics and stays. The `Track` interface in
`collaborators.ts` is structural and still describes `RoadNetwork`.

Explicitly staying JavaScript: `game.js` (the orchestrator, and the integration
hotspot CLAUDE.md reserves), `renderer.js`, `hud.js`, `vector-map.js`,
`map-picker.js`, the `*-source.js` 3D bundle entrypoints, and the small helpers
(`input`, `camera`, `utils`, `sound`, `particles`, `loading-screen`).

`game-route.js` is a thin adapter over the React overlay (item 8c): it is the
part a UI framework would delete rather than type, so translating it verbatim
would be work thrown away.
*The rule to keep: what the player is told is typed and tested; what paints it
is not. Do not translate a method verbatim if the decision inside it belongs in
the data half.*

**10. Build a low-poly Amsterdam that players recognise by real landmarks.**
Start with [the 13 September project review and delivery guide](../../CITY_RECONSTRUCTION_REVIEW.md).
It maps the current implementation, measured costs, local CV opportunities,
human review workflow and proposed unattended improvement loop. The detailed
identity/registration design remains in
[AMSTERDAM_FACADE_REBUILD_PLAN.md](../../AMSTERDAM_FACADE_REBUILD_PLAN.md).

Current audited state: active district release `c4bebc1f…` contains 7,395
source buildings. Its route processing covers 585/598 eligible frontages,
96.4% by eligible length, with 560 compatible wall bindings. The latest
`0f625ffc…` candidate has 1,000 valid ground analyses, 988 full analyses and
compiled source-derived features on 973 buildings; it remains staged with
zero accepted metric registrations. Counts describe different stages, not
measured reconstruction fidelity. See [the district runbook](DISTRICT_PIPELINE.md)
and [the thousand-building report](../../scripts/review/THOUSAND_BUILDING_REPORT.md).

Next work, in order (commands, agent lanes and verified artifacts are in
[RECONSTRUCTION_HANDOFF.md](../../RECONSTRUCTION_HANDOFF.md)):

*Façade-model evaluation: measured gold says "none"; the hand-labelled half is
the open step (2026-09-22).* The plan
([FACADE_MODEL_EVALUATION_PLAN.md](../../FACADE_MODEL_EVALUATION_PLAN.md)) fixes
an adoption rule up front (recall ≥ 0.80, precision ≥ 0.80, median centre
≤ 0.30 m). Against the **measured** gold set — 60 Oud-Zuid walls, 70 openings
from the point cloud, frozen at `review-data/facade-model-gold/v1/measured.json`
— **rfdetr** scores precision 2.4 % / recall 15.7 % / centre 0.298 m and
**windet** 7.7 % / 7.1 % / 0.319 m, so neither is adopted. The overlay on
`NL.IMBAG.Pand.0363100012161771` wall 23 shows the measured set is a **lower
bound** (13 measured vs ~20 visible windows; rfdetr finds the rest), so the
precision figure cannot decide on its own. Remaining: the **hand-labelled gold
set** (≈20 buildings, 5 each from apollobuurt, tuindorp-nieuwendam,
jordaan-sample, da-costa) and an R1 re-render run, then the §1 rule again.
Commands: `npx tsx scripts/facade-eval/build-gold-set.ts`,
`npx tsx scripts/facade-eval/build-eval-manifest.ts`,
`npx tsx scripts/facade-eval/score.ts --pred=… --lane=…`. Point-cloud
prerequisites T0–T4 have landed (`npm run test:point-cloud-geometry`,
`test:facade-mesh-compiler`, `test:point-cloud-spike`). The 100-building sweep
(plan task 9) stays parked until a model is adopted.

*Amended 2026-09-24 — read the verdict above as narrower than it sounds.* The
owner has reviewed the **union** of the lanes (`facade/openingMerge.ts`) on real
walls and calls it excellent; the per-lane precision figures above are scored
against a gold set this same item already admits is a lower bound, so a lane
finding a real window the MLS missed is counted as a false positive. The
practical failure is not precision but **missing** openings behind vans, trees
and shadows, which no detector can recover because the evidence is not in the
image. That gap is now item 8c (`facade/openingLattice.ts`). The hand-labelled
gold set is still wanted, but its job has changed: score **imputation** — did
the lattice put a window where one really is — rather than re-adjudicate the
detectors. The first lattice run recovered 0/12 missing measured facade openings; score its 11 facade-scope proposals against visually reviewed photos (retain model-review provenance);
confirming imputed boxes may be far cheaper than drawing every box by hand.

*The geometry channel is open: point cloud measures rooflines and gables
(2026-09-21).* 3DBAG carries no gable — **0 of 895** canal-belt buildings in
`c4bebc1f…` have a wall above their roof — so the photo-only path could only
infer one. The municipal puntenwolk (street-level MLS) now measures geometry
directly; photographs keep appearance. On the Museumkwartier demo tile
(`filtered_2397_9705`, 10.85 M points) **7 of 21 well-scanned street façades
have a shaped roofline** — the measured profile's peak stands ≥0.5 m above both
ends (a gable, step or dormer), not a plain slope — with windows, doors and
cornices recovered as recesses and protrusions in true metres; the Willemspark
tile (`filtered_2386_9702`) independently gives 5 of 39. Design:
[AMSTERDAM_FACADE_GEOMETRY_DESIGN.md](../../AMSTERDAM_FACADE_GEOMETRY_DESIGN.md).
Commands: `npm run spike:museumkwartier`, `npm run test:point-cloud-geometry`,
`npm run test:point-cloud-spike`, `npm run publish:point-cloud-facades`,
`npm run build:point-cloud-facades`. **Demo:**
`http://localhost:5195/canal-drive/pointcloud-facades.html` (interactive, tile
selector). **Next work is the ordered task list T0–T9 in
[AMSTERDAM_FACADE_GEOMETRY_DESIGN.md](../../AMSTERDAM_FACADE_GEOMETRY_DESIGN.md)**
(files, commands and done-when per task). P0: land the uncommitted spike after
fixing its missing `renderFacadeImage` import and the Willemspark check that
swallows assertion failures (T0); a hash-checked demo-tile fetch (T1); float64
positions — `fp64: false` quantises absolute RD Y to ~3.1 cm (T2); cached 3DBAG
responses so the regression runs offline (T3). P1: stop `rasteriseWall` clamping
a coplanar neighbour's returns into the edge columns (T4), abstain on
tile-clipped walls (T5), feed the measured roofline to `gable.ts` (T6), add a
point-cloud evidence source (T7). City scale still waits on the puntenwolk LAZ
host (`files.lidar.data.amsterdam.nl`, NXDOMAIN — chased with
`datateam.geo@amsterdam.nl`).

*BREADTH districts render and are eyed (2026-09-21, pass 20).*
`npm run render:district -- --area=<id>` renders a compiled district in headless
WebGL with **no publication or activation**
(`scripts/review/render-compiled-area.mjs`). All three new districts
(apollobuurt-v1, slotervaart-v1, tuindorp-nieuwendam-v1) are geometry-complete and
were rendered and personally inspected: their massing and rooflines are
recognisable (Oud-Zuid perimeter blocks + courtyards; Nieuw-West parallel
*strokenbouw* slabs; Noord low-rise garden-village rows), but every compiled index
carries `observations: 0`, so street-scale facades are featureless monoliths until
the district `evidence` stage is authorized (spend). The harness now grounds the
render at the median declared `groundNAP` and adds a `street-frontage` camera; the
older `street-eye-*` views are district-scale skylines, not street scale. Renders
and verdict: `.cache/reconstruction-loop-20260921/pass-20-report.md`.

*The street-frontage camera stands clear of the opposite block (2026-09-21, pass
22).* The pass-20 `street-frontage` picker scored walls by raw area and stood off
from the whole building bbox, so for parallel-slab districts it landed inside the
block across the street (a featureless wall filling the frame). The selection is
now a typed, tested module (`src/canalRecall/review/districtFrontage.ts`,
`districtFrontage.test.ts`) chosen in Node: it marches outward from the wall
midpoint along the wall normal until another compiled `building.footprint` blocks
the sightline, frames the wall (capped so a 190 m row reads as a street stretch)
and widens the field of view on narrow streets. `scripts/review/check-district-street-frontage.ts`
pins each district's named selection (Anthonie van Dijckstraat / Comeniusstraat /
Het Hoogt) and that the camera is outside every footprint. Rendered and looked:
slotervaart now shows a facade with sky and ground instead of an embedded wall;
tuindorp stands at 50 m instead of 90 m. The pass-22 session crashed before
committing, so pass 23 landed the module + unit test + check + renderer change
(commit `a7c2427`) and re-rendered/re-read all three districts. Residual
unchanged: all three districts are geometry-only, so facade identity still waits
on the evidence stage (spend); at street scale every view is a featureless
monolith and tuindorp's 190 m row fills the frame edge to edge.
Report: `.cache/reconstruction-loop-20260921/pass-23-report.md`.

0. **Start from the 25-case user review set**
   ([review-data/user-review-2026-09-21.json](../../review-data/user-review-2026-09-21.json);
   `npm run import:user-review`). Measured taxonomy from the owner's notes:
   missing inferred floor windows (case-12/13/16/17), missing storefront/business
   windows (case-02/11/29), missing doors (case-05/09/21), framing/centering/
   overlap (case-06/20/30), missing roof (case-19/27), roof shape too high or
   asymmetric (case-01/05), wrong colour/material (case-08/14), occlusion or bad
   source (case-03/18); 8 accepted. Fix the **systematic groups** first — inferred
   upper floors, then ground-floor assemblies (doors + shopfronts), then framing —
   and turn each into a named regression before calling it fixed.

   *Inferred upper floors are parked (2026-09-21, pass 1).* The proposed fix
   (round the contextual `floor(height/floorHeight)` up) does not hold: the four
   cases compile `observed-window`/`observed-door` patches, not contextual ones,
   and on the contextual path the extra round-up row fits 0/20 of their
   trapezoidal 3DBAG wall surfaces. Evidence and the unblocking options
   (observable-row reconciliation threaded from `FacadeDescription`, or better
   wall geometry) are in `.cache/reconstruction-loop-20260921/parked.json`.
   `scripts/check-contextual-floors.ts` is the named regression for the
   contextual rhythm and pins the measured behaviour.

   *case-12's missing whole row is delivered; the group is otherwise not a row
   miss (2026-09-21, pass 16).* Re-reading the four crops showed only case-12
   Rozengracht 160 genuinely misses a whole upper row (the extraction returned
   `full:window-2/3/4` but not the second row at y279-343 above the shopfront);
   case-13/16/17 each detect every visible upper row and their blank lower band
   is the occluded ground floor, a separate tier/crop issue. A generic gap rule
   was measured and rejected — case-08 (owner-accepted) and case-11 (a delivered
   storefront case) show a same-size anchor-to-ground gap. The row is
   reconciled per case: `src/canalRecall/facade/floorRowCorrections.ts` +
   `floor-row-corrections.json` apply the measured openings only when the gap is
   larger than one storey and they sit between the anchor row and the ground
   band, marked `inference: observed-row-rhythm`. `refresh-reviewed-floor-rows.ts`
   republished only case-12 (packet `924bece7…` → `cf5b0da4…`).
   `scripts/review/check-reviewed-floor-rows.ts` is the named regression (twelfth
   lane of `check-reviewed-cases.ts`). Residual: the detected first row
   `full:window-2/3/4` is narrower than the source row, so the rows are not
   column-aligned (pre-existing detection extent, untouched).

   *Framing/overlap measured (2026-09-21, pass 5).* The centering group's three
   cases are three different causes, not one crop-centring defect.
   `scripts/review/report-case-framing.ts` screens every crop; on the reviewed
   three it finds case-06's building run clipped at the crop's right edge (the
   fourth upper window bay ends exactly at the crop width, so the crop includes a
   slice of the next building), case-20 off-centre by 25 px and case-30 off-centre
   by 4 px. Geometry explains the rest: case-20's 6.05 m frontage
   is one frontage split across two collinear coplanar 3DBAG segments (#9 3.18 m
   + #8 2.87 m); the release already binds both ([8, 9]) and the preview compiles
   one observation per segment, so the crop is not compressed onto a single
   2.87 m wall. Its residual is a review-panel centred on the first segment plus a
   ~0.45 m ground/upper tier offset from the two independently-transformed crops.
   case-30's 4.43 m frontage is fragmented into three skewed pieces (#2 1.27 m,
   #4 2.11 m, #5 1.12 m; off-plane 0.01/0.46/0.70 m, angles 0.1/12.8/12.6°); only
   #4 clears the `surfaceMatches` overlap gate, so the release binds 2.11 m of a
   4.43 m frontage, and the preview's 0.18 m non-coplanarity guard abstains — the
   candidate renders as a blank monolith with zero observed patches. All three
   need a versioned regeneration (crop tightening; measured surface rebinding;
   shared ground/upper registration), not a one-pass edit.
   `scripts/review/check-reviewed-framing.ts` is the named regression: it pins the
   centring runs, the frontage/surface geometry and the release bindings.

   *case-30's blank candidate is recovered (2026-09-21, pass 12).* The centering
   group's worst case was not mis-centred, it was empty: its 4.43 m registered
   frontage is fragmented by 3DBAG into three skewed pieces, only #4 clears the
   overlap gate, and #4 is 0.71 m off the crop plane — past the compiler's 0.18 m
   guard — so the source abstained to a blank monolith. The registered frontage
   is exactly coplanar with the crop plane (0.0000 m), so
   `scripts/review/case-candidate.ts` now draws on it whenever every usable
   declared frame is non-coplanar, not only when no surface gives a frame.
   `scripts/review/refresh-reviewed-frontage.ts` republished only case-30
   (packet `4d57571…` → `dd1fd2e…`, idempotent). case-06 (crop clipped at the
   right edge) and case-20 (frontage split across two coplanar segments with a
   ~0.45 m ground/upper tier offset) remain the group's open residuals, both
   needing a versioned crop regeneration or shared registration.

   *Material frontage-coverage gaps are recovered (2026-09-21, pass 13).* The
   pass-12 rule switched only when *no* declared frame was coplanar, but a
   coplanar frame can still be shorter than the registered frontage. case-02
   De Clercqstraat 20/22 ("missing business window") bound one 5.10 m surface on
   an 8.09 m frontage, so `clipTrianglesToFace` removed the entrance and the
   right window column; case-13/19/22/29 had the same coplanar-but-short
   failure. `scripts/review/case-candidate.ts` now measures the union coverage
   of the declared frames along the crop-plane axis and draws on the registered
   frontage when the gap exceeds `max(1.5 m, 15% of the frontage)`. Below that a
   coplanar declared frame still wins (case-15 1.75 m, case-23 2.23 m, case-27
   2.38 m keep their declared surfaces); crop-margin rounding (case-01 0.14 m …
   case-05 0.93 m) is unaffected. `refresh-reviewed-frontage.ts` republished the
   five candidates (packet `dd1fd2e…` → `9258d89…`); case-02 now renders its
   full facade, and case-13/19/22/29 render their full frontages.
   `scripts/review/check-reviewed-frontage-coverage.ts` (tenth lane) pins the
   gaps, the switch set, fresh-compile reproduction and the sub-threshold cases.

   *Colour/material measured (2026-09-21, pass 4).* The group's two cases are
   two different defects, neither a sampler-tuning problem. case-14
   (Elandsgracht 19) declares its upper wall correctly (`brick`, `#8b4513`) but
   also carries a whole-facade `accent` (`#ffffff`, bounds = the whole crop);
   the compiler painted the accent over the wall, so the candidate rendered
   white. `observedAssemblyPatches` now skips a trim region
   (`accent`/`band`/`surround`/`plinth`) covering ≥60% of the crop, so the
   declared red brick stands while a real band still paints
   (`scripts/review/wall-colour-overpaint.test.ts`). case-08 (Rozengracht 251)
   declares `brick` with **no colour** and no trim, so it falls back to the
   neutral base `#d7d0c7`; a masked sampler measures `#594e48`
   (`src/canalRecall/facade/wallColourSample.ts`) but the field must come from
   the extraction. The sample is unreliable under shadow/occlusion (case-14's
   tree samples grey) and is a declared `needs-review` observation, never an
   accepted material. `scripts/review/check-reviewed-wall-colour.ts` pins both
   facts and writes `review-data/case-wall-colour.json`.

   *case-08's declared source colour is delivered into the study (2026-09-21,
   pass 10).* The review's "missing building color and white cornice" is now
   visible in the source-shape study: `wall-colour-corrections.json` declares
   case-08's whole-crop `upper-wall` brick `#594e48` (the masked-sample hex) and
   the thin top band (`accent`) as cream `#e8e8e8`, and
   `scripts/review/refresh-reviewed-wall-colour.ts` applies them to the packet's
   study only (packet `11305a4…` → `297054a…`). The stored extraction material
   is deliberately left colourless so the gap stays visible; the metric
   building-placement candidate and the live game render still fall back to the
   neutral base (a separate registry/release path). Named regression
   `scripts/review/check-reviewed-wall-colour-render.ts` (eighth lane of
   `check-reviewed-cases.ts`) pins the declared colours, the preserved
   extraction gap and idempotent re-application.

   *case-14's stored render is refreshed (2026-09-21, pass 7).* A full
   `build-facade-preview` rebuild is unsafe (some cases carry shape-study
   post-processing and delivered corrections outside that builder), so
   `scripts/review/refresh-reviewed-shape-study.ts` republished a targeted
   revision through `publishPreviewRevision`: case-14's full study now renders
   the declared red brick `#8b4513` with white accents instead of the white
   overpaint, and a prior/new packet diff shows `case-14.shapeStudy.full` is the
   only changed field. `scripts/review/check-reviewed-shape-study.ts` is the
   named regression and the refresh is idempotent. case-08's missing colour field
   is still open: the masked sampler measures `#594e48` but the extraction must
   supply it.

   *The reviewed-case regressions now have one command (2026-09-21, pass 8).*
   Every DEPTH lane is parked, so the six named checks were promoted into
   `scripts/review/check-reviewed-cases.ts`
   (`npx tsx scripts/review/check-reviewed-cases.ts`): contextual floors,
   retail ground assemblies, roof vertical, wall colour, framing and the case-14
   source-shape study, run in isolated child processes with a per-lane
   pass/fail summary and a non-zero exit on regression. No `package.json` entry
   — the branch's pre-existing `package.json` WIP must not be folded into a loop
   commit. BREADTH was re-checked and stays parked: the district acquisition job
   is done and apollobuurt/tuindorp geometry is complete, but the evidence stage
   fails on spend authorization and rendering still needs a forbidden release
   publish / `current.json` activation.
1. Prioritize roofs: human-review the existing dormer/gable corrections in
   cases 20 and 22, then the 22 other unreviewed outlines with source/roof geometry. Resolve
   case 26's source identity before attempting its roof. Turn concrete feedback
   into source-bound silhouette/component corrections and verify both viewers.
   Use [the roof handoff](../../scripts/review/ROOF_REVIEW_HANDOFF.md).
   The entrance-04 localization misses remain a following source-coordinate
   annotation task. Recover the two missing historical preview bindings and
   archive referenced evidence.

   *Roof vertical geometry is parked (2026-09-21, pass 3).* Measuring the four
   reviewed roofs found three distinct defects, none of them a one-pass fix.
   `selectCompatibleSourceRoof` mixes datums — it publishes `up - groundNAP`
   while `up` is the owner's scene-local axis (NAP − 0.65 m), so every published
   study-roof eave/ridge is 0.65 m too low and 674/7,395 selected buildings flip
   if corrected; that needs a versioned study-roof regeneration, not a silent
   edit, because `check-city-appearance-roofs.ts` pins the release counts.
   `case-01` Rozengracht 158 withholds its roof because the 3DBAG roof surface
   is near-flat (0.14 m relief); the source gable is absent from the source data,
   so only a silhouette correction can restore it. `case-05` Lauriergracht 67/69
   carries a source vertex 2.38 m above its own BAG ridge — the "roof too high
   into the sky" spike — and the live game massing uses raw 3DBAG surfaces, so
   the study-roof function is not the renderer to change. Evidence and the
   unblock options are in `.cache/reconstruction-loop-20260921/parked.json`;
   `scripts/review/check-reviewed-roof-vertical.ts` is the named regression that
   pins all three facts. Continue with the source-bound outline lane rather than
   the study-roof function.

   *case-27's missing roof is delivered; case-19 stays parked (2026-09-21,
   pass 9).* The "missing roof" group's one legible case is fixed. case-27
   De Clercqstraat 79 had no roof in its full source-shape study because the
   machine `upper-wall` box reached into the roof and no silhouette was applied.
   `roof-coverage-corrections.json` now carries a pixel-inspected case-27
   silhouette (left slope, ridge, both stacks, right edge at x=906), a dark
   roof field `#3f3f3d` and the two brick stacks, republished into the packet
   through the same coverage path `build-facade-preview` uses
   (`scripts/review/refresh-reviewed-roof-coverage.ts`, packet `1a969c0…` →
   `11305a4…`, idempotent). `scripts/review/check-reviewed-roof-coverage.ts` is
   the named regression (seventh lane of `check-reviewed-cases.ts`). Residuals:
   the full study's ground-floor shopfront is still missing (separate defect);
   case-19 Elandsgracht 69 has no defensible silhouette (foreground pole, two
   overhead wires and bare branches cross a low-resolution roof, and the left
   reading is ambiguous between its own roof and the neighbour's), so it is
   parked rather than annotated from a guess.

   *case-21's missing roof is delivered through the same source-bound lane
   (2026-09-21, pass 18).* The review's case-21 Lauriergracht 50 ("missing roof,
   missing ground floor window, first floor is all windows no door") showed a
   flat-topped brick rectangle in its full source-shape study while the source
   carries a **bell gable** with a cream crest and side scrolls.
   `roof-coverage-corrections.json` now declares a pixel-inspected 16-point bell
   outline plus three cream fields (pediment, left and right volutes);
   `refresh-reviewed-roof-coverage.ts` republished only case-21 (packet
   `ad09c342…` → `4181458d…`, idempotent). Deep diff: only case-21 changed, only
   `roofReview`/`shapeFeatures`/`shapeStudy`; the metric `building-placement`
   candidate is byte-identical. `check-reviewed-roof-coverage.ts` now pins both
   delivered cases. Residuals: the crop cuts the crest top and a cast shadow
   crosses the lower bell, so the outline is a **coarse** source-pixel
   approximation; the left-volute patch reads slightly detached at the step.
   case-21's ground-floor display glazing (portrait) and its metric roof/ground
   remain separately parked.

   *case-12's missing roof detail is delivered through the same lane (2026-09-21,
   pass 21).* The review's case-12 Rozengracht 160 ("mising roof detail, missing
   one whole floor of windows") is a **halsgevel** whose stored study drew flat
   brick to the crop top. `roof-coverage-corrections.json` now carries a
   measured left-neck outline (shoulders at y=160, flat crest top) and
   `refresh-reviewed-roof-coverage.ts` republished only case-12 (packet
   `9ddc545c…` → `7a261e5b…`, idempotent); deep diff: only case-12, only
   `roofReview` + `shapeStudy.full`, the pass-16 inferred row preserved and the
   metric candidate untouched. `check-reviewed-roof-coverage.ts` now pins three
   delivered cases. Residual: a foreground tree trunk covers the right neck, so
   the right outline is mirrored and the crest top is closed flat — a coarse
   approximation, not a measurement. Remaining roof reviews: case-05 (too high;
   parked on the raw-surface/vertical lane) and case-19 (no defensible source).

2. Extend the new reconstruction workbench and its existing notes service with
   region-level correction revisions and registration-tool links. Capture
   structured edits and preserve overrides.
3. Complete source → recipe → both-viewer delivery for 20–40 representative
   frontages on one route. Measure extraction in source pixels separately from
   3D placement; address roof/gable silhouette, balconies, entrance placement,
   temporal conflicts and the Moeders game sign-tile residency failure.
4. **Crop-top fix is small, not urgent.** `preflight:crops` (corrected metric)
   finds only 71/2,344 crops mostly sky (3%), 14 featureless, 3 blank. The crop
   top uses the BAG ridge height; using the matched 3DBAG eave (`wallTop.ts`)
   would reclaim ~71 crops. Worth doing as a versioned regeneration, but it is a
   minor lever, not the quarter-corpus one the first (buggy, top-band-only) metric
   claimed. Never overwrite the existing crops in place.
5. Treat **ground-level retail as its own lane**, not a footnote to residential
   openings. Extract shopfront assemblies — display window, entrance, fascia and
   awning — separately, with literal sign text and dated awning state, and
   measure storefront precision/recall on the frozen set. `storefrontAssembly.ts`,
   `retailCompiler.ts` and `retailPatches.ts` now group and compile them; the next
   step is to feed real `FacadeDescription` features through and render the patches.
   *Pass 2 (2026-09-21) fed the real reviewed ground features through.* The ground
   band's centre test was dropping tall ground openings, so case-02/05/11/29 now
   assemble storefronts with entrances and display glazing
   (`scripts/review/check-retail-ground-assembly.ts`). The lane is still not wired
   into the renderer. Remaining: case-21's portrait display glazing is excluded by
   the landscape-display rule.
   *case-05's full-study entrance is delivered (2026-09-21, pass 19).* The
   review's "no door" was the full source-shape study, whose 2023 extraction
   returned all three ground windows but no entrance. The dated full crop shows a
   central recessed entrance between the two ground-window banks (the clearer
   2025 ground crop confirms it); the leaf is ivy- and shadow-occluded, so only
   the measured recess position and the building's own ground-capture door colour
   are declared in `source-geometry-corrections.json`.
   `scripts/review/refresh-reviewed-source-geometry.ts` republished only case-05's
   `shapeFeatures.full` and `shapeStudy.full` (packet `4181458d…` → `9ddc545c…`,
   idempotent); named regression
   `scripts/review/check-reviewed-source-geometry.ts` (fourteenth lane of
   `check-reviewed-cases.ts`). The metric candidate and the ground-crop
   registration gate are unchanged; this is a source-space study delivery.
   *case-02's metric entrance is recovered (2026-09-21, pass 13).* The entrance
   and right window column were clipped by an **incomplete declared frame**
   (5.10 m surface on an 8.09 m frontage), not by the ground-crop gate; the
   coverage fix in the framing group above republished it and it now renders the
   full storefront (entrance + display glazing + awning).
   *case-09's blank candidate is recovered (2026-09-21, pass 11).* The review's
   "missing door" case was worse than reported: its metric candidate was a blank
   monolith because the release bound no wall surface and no 3DBAG wall at the
   frontage is a usable frame. `src/canalRecall/facade/registeredFrontage.ts` now
   builds a synthetic wall on the observation's own registered frontage (exactly
   coplanar with the crop plane) when no declared surface gives a frame;
   `scripts/review/refresh-reviewed-frontage.ts` republished only case-09's
   candidate (packet `297054a…` → `4d57571…`, idempotent). The recovered
   candidate renders the paired arched windows, gable window, ground band and the
   entrance + display glazing. Named regression
   `scripts/review/check-reviewed-frontage-fallback.ts` (ninth lane of
   `check-reviewed-cases.ts`); case-30 was recovered by the same fallback in pass
   12 (see the framing group above).
   *case-11's white upper windows are recoloured (2026-09-21, pass 14).* case-11
   De Clercqstraat 26's extraction declared `colour:"#ffffff"` for all twelve
   full-tier windows (the frame/curtain it sampled), so the compiler painted the
   glazing white and every upper window read as a blank pane. A near-white window
   colour (all channels ≥ 235) is now treated as undeclared and falls back to the
   neutral glass; door leaves are excluded (a white door is real). Only case-11
   and case-18 carry the gap. `scripts/review/refresh-reviewed-glazing.ts`
   republished only case-11's `patches` and `shapeStudy.full`
   (packet `9258d89…` → `168fc6d…`, idempotent), preserving the stored extraction
   gap; named regression `scripts/review/check-reviewed-glazing.ts` (eleventh
   lane). Residuals: case-18's packet artifacts are not refreshed, and the live
   game picks the guard up only when the pre-existing-WIP viewer bundle is
   rebuilt by the integrating agent.

   *case-18's stored render is refreshed too (2026-09-21, pass 15).* The
   occlusion group's case-18 (a heavily occluded building behind the station
   sign) declared `#ffffff` for both the glass and the frame of its four windows,
   so its stored render drew solid white arches. The glazing recolour is
   **partial** there: the glazing turns neutral glass while the white **frame**
   patches stay (a white frame is architecture; the source photograph shows dark
   glass in white frames). The refresh therefore grew a `--tier` filter and only
   `full` was recompiled — case-18's ground study carries a delivered
   raised-entrance correction that a plain `compileSourceShapePreview` does not
   reproduce (13 extra door patches plus an `omissions` note), so it is left
   byte-identical rather than silently dropped. Packet `168fc6d…` → `924bece7…`;
   deep diff: only case-18 changed, only `patches` and `shapeStudy.full`.
   `check-reviewed-glazing.ts` now asserts both delivered cases and the preserved
   ground correction. Residual: the building is still occluded (the review's
   "need to infer") — only a better-dated source can address that.

   *case-05's overlapping window frames are fixed in its source-shape study
   (2026-09-21, pass 17).* The review's "windows opverlapping too much" is
   measured: the extraction places the narrow window `b3` and the wide bay `b4`
   **1.9 px** apart, and the default `.14 m` frame border makes each frame cross
   the other. `frameClearancePx` is a new opt-in per-feature declaration (the
   measured same-row glazing gap); the compiler caps the frame to it and never
   past the nearest neighbour. `opening-frame-corrections.json` declares the six
   measured openings; `refresh-reviewed-opening-frames.ts` republished only
   case-05's `shapeFeatures.full` + `shapeStudy.full` (packet `cf5b0da4…` →
   `ad09c342…`), and `check-reviewed-opening-frames.ts` is the thirteenth lane.
   **Residual parked:** the declaration is study-only, so the metric
   `building-placement` candidate and the live game still draw the uncorrected
   `.14 m` frames. A shared compiler rule would change case-09/12/19/22/24/30
   studies and their delivered lanes, so it needs a versioned regeneration.
   Reuse the existing modules (`facadeEntranceAssemblies.ts`,
   `cityAppearanceMachineSigns.ts`, `retail-registration.ts`,
   `retail-source-corrections.ts`) and keep the unreviewed shopfront/literal-sign
   policy in HISTORY.md. Retail is the strongest recognisability cue and the most
   placement-sensitive: it sits at the base, where the bottom edge is most often
   occluded and where a boresight error hurts most.
6. **Scale and validate panorama boresight.** The anchor tool auto-selects
   panoramas (`build-pano-anchor-task.ts --auto=N`; 12 panos / 56 markers at
   `pano-anchor.html?task=expanded`) and `anchorRegistration.ts` converts marks
   into `correspondence-verified` evidence, now cross-validated. Remaining: mark
   the expanded set, then decide whether the prior-constrained auto-estimate
   (`estimate:pano-boresight`) can replace per-panorama anchoring. Today it is
   within ~1° when the GPS prior is right and prior-limited otherwise.
7. Extend the existing resumable coordinator with failure-specific repairs,
   bounded retries, independent evaluation and regression generation, using the
   new immutable offline reports as the starting point. Calibrate automatic
   field-level acceptance using
   held-out evidence; retain conservative output for unresolved cases.
8. Profile the complete scene on a named desktop and physical phone, then
   expand to diverse architectural districts with measured quality and review
   cost. The saved 9.12 MB building-buffer/texture figure excludes other scene
   memory and cannot establish full-device performance.

Resolved (2026-09-21, pass 1): the case20 doors expectation is no longer red —
`node --import tsx --test scripts/review/source-to-owner-candidate.test.ts` is 8/8
green and already asserts `agent-inspected` for `full:door-1`.

The existing unreviewed shopfront/literal-sign policy remains recorded in
HISTORY.md. Proposed delivery levels do not bypass current release gates.
Keep the missing twelve original image-numbered examples as an unresolved
historical issue while defining new work against identified evidence.


**11. Other cities: content, not plumbing.**
The ride is locked to Amsterdam (2026-10-22): the setup City row, the
Destination picker, the Tours picker and the briefing line are gone, and
`ride-locked-to-amsterdam.spec.ts` checks a stored other-city preference still
rides Amsterdam. The quiz and card gallery still read the other extracts; what
is left for them is content:
- 275 of Utrecht's 380 landmarks have no text, and Rotterdam and Den Haag
  have had no landmark-text pass at all;
- the teaching data is Amsterdam-only so far: street-name origins, the
  bridge register, building facts and monuments. Each came from an
  Amsterdam municipal API. Utrecht, Rotterdam and Den Haag publish their own
  open data, which needs a source per city before cards there can match.

**11c. Give Amsterdam and Utrecht real ledes.**
Amsterdam’s card-facing extracts are English in the publish gate
(`check:extract-english` after `enrich:english` in `refresh-city-extract.sh`).
Remaining thin blurbs are Wikidata description floors or rename refusals that
fell back to a description. Utrecht's backlog, measured 2026-09-30 with `trn`
(`npm run enrich:utrecht-english -- --translator=trn --dry-run`), is 11
distinct blurbs. All 11 are refused for translating the place's own name
(Eendenkooi, Verzetsmonument, Ridderhofstad Den Engh, …) and fall back to
English Wikidata descriptions, so none still reads Dutch. What remains is
thin ledes, not Dutch.

`street-knowledge.json` is now generated from streets/water
(`npm run build:street-knowledge`) — do not hand-edit it.

The shared translation cache is pruned against all Randstad extracts
(`--prune-stale` on `translate-extracts-to-english.ts`; 322 orphans removed,
1,422 kept). Remaining thin cards are mostly Wikidata description floors
(~400 distinct).

Expect some refusals: the pass rejects a translation that lost the feature's
own name. Those come back as `refused — translated the name itself` and fall
back to a Wikidata description when one exists.

**12. Clear all my data.**
Partial: **Reset knowledge…** is on the route briefing account row (and
confirms before wiping). It clears local + signed-in spaced-repetition memory
and fact-rotation history, leaves auth and Canal preferences. Still open: a
full “clear preferences / exploration / everything” path if we want that
separate from knowledge reset.

**15. Keep naming regression locations.**
Continue expanding named cul-de-sac and dead-end cases in
`scripts/check-canal-car.ts`. Ongoing, not a milestone: every geographic failure
reported from play should land here before it is called fixed. Bike-routing
coverage for pedestrian/cycleway corridors is pinned in
`scripts/check-city-extract.ts` (Zeedijk in, Kalverstraat out); still add the
street name from any future "can't bike here" report so a junction-level miss
does not hide behind the highway-class fix.

**11b. Optional Amsterdam extract refresh (not broken).**
Published Amsterdam is check-green (~47k routing ways, motorway/trunk classes,
`city-profile.json`, bridge crossings aligned, Potgieterstraat present). Last
structural rebuild 2026-08-31. A new `refresh:amsterdam` is worthwhile for
pipeline currency (dab-follow enrich, English rename-refusal handling) but will
churn encyclopedia blurbs — stage, diff coverage, publish only after review.
Do not treat this as a red routing bug.

**14. Storybook visual regressions.**
`storybook-visual.spec.ts` compares 40 Storybook states (cards, HUD, finish,
panels; desktop and phone at each story's own viewport) against committed
screenshots (2.3 MB), stable across repeated and parallel runs. Still open:
- the five desktop briefing screens, left out because their photo backdrop
  makes each baseline 1.5 MB;
- baselines are darwin-only, so a Linux CI would need its own set;
- the landmark-card baselines (`landmark-card*`, and HUD states showing a
  card) predate the close "×" added 2026-10-03 and need re-recording on a Mac
  (`--update-snapshots`); the cloud sessions run Linux and cannot.


---

## P3 — Bets worth a spike, on their own branch
- **OSM outlines with nothing standing (2026-10-30).** AHN4 and AHN5 both
  see bare ground under some OSM-only outlines, now drawn as 1 m slabs
  (`source: "low"` in `scripts/data/osm-guessed-heights.json`). Examples are
  a cleared lot (`w1343730490`), a paved yard (`w540078369`) and the
  Romneyloods site (`w531438245`). Check them and delete them in OSM. The
  3,179 outlines that keep a guess are mostly 2023+ new builds: re-run
  `scripts/measure-guessed-heights.ts` when an AHN flight after 2023 is out.
- **PARKED (user 2026-10-16: "way too much effort/tokens for now"): road
  paint and look from the orthophoto.** Surveyed roads draw no procedural
  paint (`streets.ts PAINT_ON_SURVEY = false`, HISTORY "No procedural
  paint on surveyed roads"). Parked: data-backed markings (orthophoto paint
  segmentation or OSM crossing/give_way/stop nodes) drawn whole, red cycle
  crossings through junctions, one asphalt tone across carriageway/parking
  seams, red only on cycle polygons, and a top-down comparison harness
  against the PDOK 8 cm orthophoto at six junctions. Only on the user's ask.

**17. Public transit mode.** Tram / metro / ferry as its own routing and
recall model, not a vehicle skin. *Large.* **GTFS-first** (OVapi → GVB). Plan:
[`TRANSIT_SPIKE.md`](TRANSIT_SPIKE.md). **Phases A–E + play polish shipped:**
tram+metro drive, termini pool, metro 52 pin, sibling/hub distractors,
active-line stop scope, transfers, two-leg planner + second-leg drive, surprise
pairing biased toward teachable transfers (~70%), second-leg plaque clear,
named Noord→Isolatorweg two-leg pin. **2026-09-06 playtest:** chase≠cockpit +
tilt slider; bold corridor overlay (metro dashed above buildings); orientation
grace before line/transfer asks; map idle settle on load. Still open: bus,
GTFS-RT, dedicated mesh, OSM tunnel tagging in extract, GTFS `transfers.txt`
merge when cached. Canal-belt teaching streets via `amsterdam-curation` +
`ensure:amsterdam-teaching-streets`. Pedestrian `bicycle=no` corridors
(Kalverstraat) playable with `bicycleRestricted`. Bike ferries (GVB IJ
F1–F9) are playable in bike mode (HISTORY 2026-10-09); open: no timetable or
waiting, router treats crossings as plain distance, terminal accesses are
projected (some 30–43 m, Sporenburg's over water), 33 m ferry overlaps the
iPhone thumbstick in chase view, no Storybook visual baseline.

**25. Large-letter postcard compositor (standalone).**
Craft board: [`LARGE_LETTER_CRAFT.md`](LARGE_LETTER_CRAFT.md). **Check loop:**
`test:large-letter-craft` → `render:large-letter-craft -- --round=N` (gallery +
pixel P0 on Jordaan: no top ink, cream ring ≤14px) → vision. Three themed
rounds + a fill bump (span ~64%H), then the Spoon Graphics recipe pass
(2026-10-03, HISTORY), then round 5 (2026-10-13: one photograph per run of
2–4 letters, measured soft filter for brick and busy photos, taller two-line
names). Remaining: tighter greeting nest, place props, a converging
(vanishing-point) block as an optional style (the recipe's own block is
parallel), the recipe colours for the non-default styles, and the export frame
drawn at 640×400 and scaled (softer outlines than the 1280 px photos).

**19. Structured Wikidata + city-hall advisor.** Assignments from mayors,
architects, opening dates — without another card competing with the corridor.

**23 / 24. Authentic retro rendering and the optional arcade layer.**
Parked; design notes at the end of `HISTORY.md`.

---

## Ongoing reliability work

Not milestones — standing obligations with live guards.

- `Canal CI` must stay green: `check:canal`, boot smoke, full Playwright.
  Deploys wait on that workflow. Local: `prepare` installs pre-commit (`lint`)
  and pre-push (`lint` + `test:e2e:smoke`).
- Name every reported geographic failure in `scripts/check-canal-car.ts` (or
  the reachability / city-extract harness) before calling it fixed. Bike
  corridor pins: Zeedijk in, Kalverstraat out (`check-city-extract`).
- Prefer city-qualified Wikipedia dab follows (`pickDisambiguationTarget`,
  score ≥45); keep `check:encyclopedia-disambiguation` green.
- Refine boat shoreline response and bridge traversal on more geometries.
- Keep rejecting distant or ambiguous home-address-to-waterway snaps.
- Audit route topology at docks, broad water polygons, bridges, and split OSM
  fragments.
- Keep `npm run check:map-recall` green (lint, Map Recall unit tests, trivia,
  postcard and neighbourhood text/story checks) alongside `check:canal`.
- P2: Firefox Android startup GPU loss, what is left after #106 and #109 (both
  in HISTORY). Unproven until Sentry stays quiet for Firefox Android; the GPU
  death never reproduced headless. Open: MapLibre recompiles its own ~9-16
  programs in one burst after a restore, which is outside our code, so revisit
  only if Sentry keeps showing it; MapLibre still renders at ~60 fps behind the
  briefing; the help and settings panels sit on a see-through backdrop, so they
  never pause the frame; desktop does not pause behind the briefing (pausing would
  move its 24-link warm-up and ~32 MB of uploads into Start, so it needs a warm-up
  that stays behind the card first).
- P0: Real-device pass for the 2026-10-23 phone/slow-machine work (HISTORY
  "Phone memory", "Landmarks stop piling up", "Slow machines step their render
  cost down"): ride 5+ minutes on a real iPhone and a low-end Android, and on
  an Intel/AMD laptop at 150 % scaling. Watch Sentry for the
  `graphics-failure` warnings (they carry GPU, heap and deviceMemory) and the
  governor's `render budget step` log. Nothing here has run on real hardware.
- P1: Phone memory, next levers (2026-10-23): after GC ~283 MB of JS heap and
  ~189 MB of ArrayBuffers 10 s into a ride (90 MB of ArrayBuffers already at
  ride start, before any ground cell: unattributed). Heap owners left: road
  graph ~41 MB, `osm-loader.js` ~21 MB, own ground 27 MB, road surface 16 MB —
  stream or pack roads per tile. Own-ground GL buffers ~57 MB: quantise.
  Per-frame allocation churn ~4 MB/s while riding (heap grows until GC):
  profile and pool. Measure with
  `PERF_PHONE_MEMORY=1 PHONE_HEAP=1 npx playwright test phone-memory --project=iphone`
  (`PHONE_KEEP_ARRAYS=1` for the old own-ground behaviour).
- P1: The shared frame never rebuilds its three.js renderer or resources after
  `webglcontextrestored` (only `threeBuildingsBrowser` and the facade recipe
  layer listen), so a phone that loses and regains its GPU keeps a blank 3D
  layer until reload; with `releaseArrays` the own ground cannot re-upload
  either. Rebuild on restore (own ground: drop and re-request resident cells).
- P1: Firebase App Check answers 403 in production (Sentry breadcrumb
  2026-10-23, Safari/Mac: `appCheck/throttled` for 24 h). Check the site key /
  registered domain for rideamsterdam.nl.
- P2: The render governor (`renderGovernor.ts`) is unit-tested and quiet on the
  M4; confirm on a real Intel/AMD laptop at 150 % scaling that it steps (and
  where it settles) and that the step is not visible as a pop mid-question.
- P2: The phone GPU budget (2026-10-23) is measured only on desktop Chromium
  with a Pixel 5 profile: coarse-pointer DPR 1.25 (`?dpr=`), MSAA off at
  ≤3 GB (`?msaa=`), 9 resident z14 building tiles (`?tileBudget=`,
  `status().budget`). Run the ride on a real iPhone and a low-end Android,
  check the reload notice and the `webglcontextlost` diagnostics in Sentry,
  then accept or tune the visual tradeoff.
- P2: MapLibre stays on 5.24.0 (last 5.x, April 2026) only because 6.x is a
  migration: ESM-only distribution, `map.transform` removed (used by
  `labels/labelOverlay.ts`), style-spec 25 and a changed
  `zoomLevelsToOverscale` default that shifts `queryRenderedFeatures`. 5.x has
  no fix for upstream #8607 (a dead GPU throws `Could not compile fragment
  shader: ` every frame); `src/canalRecall/mapGuard.ts` is the stopgap until we
  either migrate to ≥6.13.0 or finish the drop-MapLibre lane
  (`docs/research/drop-maplibre-20261010.md`) — the latter is the cheaper
  long-term path.

- P2: Landmark fronts (Bijenkorf, Beurs hall, Royal Palace, Concertgebouw, Tuschinski) and kits (Westerkerk, Zuiderkerk, Montelbaanstoren, Noorderkerk, Royal Palace dome, Waag, Beurs, Centraal, Rijksmuseum, Sint-Nicolaas, Munttoren, Krijtberg) are in the game. Oude Kerk, Nieuwe Kerk and NEMO (colour only; its skillion roof terrace is still flat) are done too. Next: Stopera, Carré, Stadsschouwburg, Stedelijk, Scheepvaartmuseum; Centraal's long front and Rijksmuseum's gate front as fronts (references: `build-pano-facade.ts --toward=lng,lat --max-panos=3`; the Rijksmuseum pick lands inside the passage, so choose the Museumplein wall with `--wall`); Beurs Damrak front; Anne Frank House needs a reference (Mapillary token via env `MAPILLARY_TOKEN`, never committed). Front ids must be the game tiles' ids.
- P2: Hand-modelled storefronts for notable businesses (Kema Vlees, 't Mandje, De Jaren, Winkel 43, Hoppe done). Next: Massimo Gelato branches (identify which shop in each panorama), Papeneiland, Café 't Smalle, Brouwerij Troost, Lastage/Vermeer etc. via their hotels; hotel facades (Amstel Hotel, Krasnapolsky, De L'Europe, Doelen, Pulitzer, Conservatorium). Reference: `build-pano-facade.ts --ids=<pand> --near=<poi lng,lat> --ppm=50 --min-standoff=2 --max-dist=40 --max-obl=60`.

- P2: Anne Frank House facade needs a source other than panoramas (Commons photos once the rate limit clears, with per-image licence/attribution); Sherlocked is not in the landmark data (which building was meant?).
- P2: Apply panorama JPEGs to landmark walls in the three layer (needs per-wall UV mapping) and ship Waag kit via KITS if kept.
