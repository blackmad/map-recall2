# City coverage programme: the eight avenues, and a month to "nearly 100 %" on the Max plan (2026-11-07)

The user asked (2026-11-06, Fable session, plan mode): explain how the city is
modelled (they guessed four avenues), plan a month to nearly 100 % coverage on
the Claude Max $200 plan with budget left for fixes, answer whether a zillion
GLBs scale and whether to move to more three.js, runtime or shader work, look
at textures for colour and feel, and say whether flat photo painting, custom
modelling, image generators, more reuse or more kit elements are the way. The
plan runs on opus, sonnet and haiku. Explainer artifact (private link, owner
only until shared): https://claude.ai/artifact/FnmJuK9Nw5MmcbypCQgbaQ

Surveyed on main 2c4f0729d; round 5 (cf0f9d02e) added 19 landmarks since, so
the census is ~600 rather than 581. Week-1 briefs:
`docs/handoffs/lane-census-refresh-20261107.md`,
`lane-chunks-meshopt-20261107.md`, `lane-profiles-citywide-20261107.md`,
`lane-palette-level-20261107.md`. Model routing change: `LANE-RULES.md` §Models.

## Context

The user asked for (1) an explanation of how the city is modelled (they guessed four
avenues), (2) a plan to reach nearly 100 % coverage in about a month on the Claude Max
$200 plan with budget left for fixes, (3) an answer on performance (do a zillion GLBs
scale; more three.js, runtime, or shaders?), (4) textures for colour/feel, (5) whether to
do more flat photo painting, whether custom modelling is a mistake, and whether image
generators / more reuse / more kit elements are the way. The plan must run on Opus,
Sonnet and Haiku.

Deliverables: this plan; the explainer artifact (link above); the week-1 lane briefs and
the LANE-RULES model-routing edit in §C.

---

## A. How the city is modelled today (the explainer)

Not four avenues: **eight building avenues plus the non-building layers**. There is a
per-buurt layer, but it is a compile-time parameter table, not runtime modelling.

| # | Avenue | What it is | Source of truth | What the browser gets | Pands drawn | Gate / review |
|---|---|---|---|---|---|---|
| 1 | **Bespoke landmark builders** | one imperative TS builder per icon | `scripts/landmarks/<id>-builder.ts` + spec/footprints/elevations/inventory JSON (334 builders), `manualCatalogue.json` (439 rows) | `models/<id>.glb` + `.lod1.glb` (443 + 386 files, 96 MB, meshopt, no textures, `materialSlot`+`tint` extras) | ~460 | `audit:glb`, inventory, `compare:facades`, `review:sheet` (photo / render / overlay / in-game) |
| 2 | **Large recipes** (`kind: large`) | typed facade *systems* cut into the 3DBAG LoD2.2 shell per wall group | `scripts/building-recipes/houses/<id>/intent.json` (163 large), kit in `src/canalRecall/blockBuilding/` | `models/ordinary-buildings/recipe-large-*.glb` (120) | ~99 | `largeGates.ts`, `likenessGate.ts` (measured colour / glazing / rhythm vs rectified crop), Opus strip verdict |
| 3 | **Hand-built ordinary GLBs** | one-off medium-fidelity blocks (~2 h each) | 38 GLBs by pand id | same loader as 1 | 37 | frozen since 10-13 |
| 4 | **Block-face type libraries** (pre-war street kit; Transvaal, Oud-West, Museumkwartier…) | measured house *types* per build-year family, auto-placed on faces, compiled to street chunks | `scripts/block-face/types/<district>/*.json` (89 types, 11 libraries), `faces/` (229 intents), `buurten/<buurt>-placement.json` (17 records: 4,700 surveyed, 651 placed) | `ordinary-buildings/chunks/*.glb` (143 chunks, 83 MB, **uncompressed**) | 750 | auto-place vetoes (year ±2, frontage ±0.4 m), edge-NCC strip likeness ≥ 0.15, gallery-size review beside the strip |
| 5 | **Building-type designs** (post-war estates: Nieuw-West, Noord, Zuidoost) | design specs instanced per pand | `src/canalRecall/buildingTypes/types/*.json` (119 specs), `instances.json` | `building-types/*.glb` (369 units, 12 MB) as `InstancedMesh` | **13,482** | design review; not in the census |
| 6 | **Landmark kits** (runtime, procedural) | per OSM building part: spire/dome/stage/material on the extrusion | `src/canalRecall/landmarkKits.ts`, `kit-pands.json` | built in the chunk worker, merged into cell chunks | ~440 | `test:landmark-kits`, kit viewer; 306 unreviewed |
| 7 | **Generic city** | era facade grammar on BAG footprints with 3DBAG heights/roof plans, **baked offline** by the world compiler | BAG/3DBAG/OSM + facts → `scripts/world/compile.ts` → `world-v1/cells/*.bin` (604 cells, 349k buildings, 11 MB) + `far/` prism shells (6.8 MB) | worker decodes a cell (~5 ms) → one merged mesh per tile chunk; city-look array texture; window SDF (off by default) | **~334k (98 %)** | bytes gate per cell, A/B strips, `budgets.json` |
| 7b | **Per-buurt profiles** (#102, 2026-10-29) — the "runtime per-buurt modelling" the user suspected | parameter table per buurt (brick palette distribution, painted share, white-accent / arched-head / tall-sash / dark-frame shares, crown mix, era mix) applied deterministically per generic pand | `src/canalRecall/buurtProfiles/buurt-profiles.json` (209 profiles for 256 buurten from 3,649 measured fronts; wijk / city fallback), `scripts/buurt-profiles/derive.ts` | folded into avenue 7's STYL | all generic pands in profiled buurten | 12-spot sheet; "modest colour gain, still more saturated than the photos" |
| 8 | **Non-building layers** | trees (311k), street furniture (135k, 9 GLBs), bridges (415), kiosks, houseboats (3,083), own ground / roads / rail, sculptures | extracts under `public/data/extracts/amsterdam/` | cells + a handful of GLBs | — | own specs |

**Precedence:** bespoke > chunk > large recipe > hand-built > building type > landmark
kit > generic; `models/covers.json` (698 models, 13,482 type pands) hides the generic
pand under a model, enforced by `check:covers`.

**Data flow in one line:** photos (data.amsterdam.nl panoramas rectified per wall by
`scripts/pand-reference/all-walls.ts`, PDOK orthophoto for roofs) → measurements
(`measure.ts`, `derive.ts`) → typed intents / types / builders → compile + gates →
GLB or cell stream → `covers.json` → one three.js frame (`frameHost.ts`, own engine
behind `?engine=own`, flip held on the user's Mac/iPhone rides).

**Coverage, honestly (coverage-v1 is from 10-17, census from 10-30; both stale):**

| Scope | Pands | Non-generic today |
|---|---|---|
| All tiles | ~338k | ~15.2k (4.5 %) |
| Inside the 518 buurten | 192,950 | ~8 % |
| Census "reviewed landmark" count | target 1,000 | 581 headline / 167 strict (11-06 live run) |
| Ride-visible large-tier queue | 317 candidates | buildable list **exhausted**: 124 kit-gap, 94 no-evidence, 45 not-in-tiles |
| Transvaalbuurt funnel (806 pands) | | 79 installed; 389 "no type fits", 151 failed likeness, 80 no photo |

**What a building costs (measured from the November transcripts; ~95 % is cache-read context):**

| Route | Model | Per accepted building |
|---|---|---|
| Bespoke landmark (rounds 1–4, +87 models in 5 days) | Opus | ~115 calls, ~22 M tokens |
| Block-face type lane (Transvaal r1–5, Museumkwartier) | Opus | ~20–24 calls, 3–5 M tokens per pand |
| Scripted block-face batch where a type already fits | Opus driver | ~1.4 turns per pand (cheapest) |
| Large-tier factory + strip review | Opus review | 19–29 turns per install; 0 of 253 inferred groups moved |
| Hand-modelled ordinary row (stopped by user 10-29) | Opus | ~3.3 M tokens per house |

Haiku is barely used: all 55 November lanes ran on Opus although LANE-RULES assigns
surveys, batches and installs to Haiku.

---

## B. Answers to the strategy questions

### B1. "Nearly 100 % coverage in a month" — only with a tiered definition

Per-pand kit modelling costs 3–5 M tokens a pand; the scripted batch costs ~1.4 turns a
pand but only where a type fits. 193k in-buurt pands is therefore out of reach by any
per-pand route, on any plan. **Coverage must mean: every pand a rider passes reads
right at ride distance**, delivered by three tiers at three costs:

| Tier | Definition | Mechanism | Cost per pand |
|---|---|---|---|
| T0 whole city | measured buurt/era look on every generic pand | profiles (7b) + measured per-pand colour in STYL | ~0 (scripts) |
| T1 ride ring | repeated rows drawn from a measured type of their buurt | type libraries (4) + building types (5), scripted placement | 1.4 turns where a type exists |
| T2 landmarks | reviewed model of every POI / ride-visible dominant building | bespoke (1), large recipe (2), kits (6) | 20–115 Opus calls |

T0 is where "100 %" comes from; T1 is where the *feel* of a street comes from; T2 is the
product identity (destinations, cards, quiz). The month's goal: T0 to 100 % of buurten
with evidence, T1 to the top ride buurten, T2 from 581 to ~700 reviewed.

### B2. Do a zillion GLBs scale? No, and the repo already decided that

Evidence: `digital-twin-direction-20261013.md` §2 ("Verdict: no"); loader fetches 2
GLBs at a time with ~8 draws each; 72 resident models max; Safari lost the GPU after 30
GLBs in 30 s (CANAL-RECALL-5); street chunks are 83 MB uncompressed; recipe tiles
(`tileBuildings/runtime.ts`, merged uniques + `InstancedMesh`) exist but are off
because fitted widths were never quantised (0 instancing repeats).

Direction: **compile-time geometry, runtime shader detail, GLB only for icons.**
- Bespoke GLBs stay the unit for landmarks (~450 now; ~800 is fine under residency).
- Everything kit-made (chunks, large recipes, building types) goes through the
  compiler into per-tile merged + instanced meshes (`kind: glb` conversion already
  designed). Runtime recipe compilation is rejected: slower than streaming 3.5 KB/pand
  and loses gates and goldens.
- Shaders already carry the generic city (facade cells, window SDF). The remaining
  wins are baking (SHEL step 3 removes 72 MB of post-warm-up uploads), fewer programs
  (32 → 24), and the windowSdf desktop flip once it measures ≤ +1 ms.
- "More three.js models" = more *units* instanced, not more files.

### B3. Textures for colour and feel: yes, as slots and measurements, not photo pixels

There are no image textures in any GLB; the city is one array texture of procedural
256 px cells plus one CC0 brick. The user's instinct is right that tone is off: #102's
own verdict is "fronts still more saturated than the muted photos". Cheap, scalable:
1. **Level the palette to the photos** (one Opus turn with Haiku measurement): a
   city-wide saturation/lightness map from the 3,649 measured fronts vs rendered walls.
2. **New slot layers** already requested in TODO: `timber`, `metalRoof`, warm-grey
   `roofTile`, dark painted brick, glazed-tile plinth; plus era-specific brick
   coursing and a ground-band soot/weathering gradient (procedural, 256 px).
3. **Per-pand measured colour at scale**: extend `derive.ts` from 3,649 fronts to every
   pand with a panorama thumbnail (scripts only; API-bound, not token-bound), written
   into STYL so a generic pand carries its own measured wall and frame tone.
4. KTX2 only if image textures ever ship; not needed for the above.

### B4. More flat photo painting? No (tested 10-14), but photo *measurement* at scale, yes

`texture-prototype-20261014.md`: posterised panorama atlases on the three complaint
houses lost 3 of 3 to the kit (billboard flatness, blurred windows at 8 px/m, seams
between panoramas of different years, inpainted ground band, 3–6× GPU memory, outside
the one-shader city look). The one thing it won (a colour split along a front) was
cheaper as a kit feature. Keep that verdict. What *does* scale from photos is numbers:
colour, glazing share, bays, bands, storey lines (B3.3, B6.1).

### B5. Is the custom modelling stupid? Partly, and the stupid part is already stopped

- Bespoke landmarks: not stupid. Reliable yield, the product's identity, ~22 M tokens
  each; affordable at tens per month, not thousands. Keep, but only for icons and
  ornamented fronts.
- Hand-modelling ordinary houses: stupid at 3.3 M tokens a house; stopped 10-29.
- Sending the large-tier factory at fronts the kit cannot express: 0 of 253; the
  skill's kill rules now prevent it. The factory is idle until kit gaps close.
- The real mistake was structural: Opus inside the per-building loop, and Haiku never
  spawned. Fixing *that* buys more than any new technique.

### B6. New techniques: which ones earn a lane

| Idea | Verdict | Why |
|---|---|---|
| Vision model measures rectified crops (bays, storeys, window kind, bands, colour) in a script, no LLM turn | **Yes, bounded spike** | Breaks the "no model counts windows" rule the right way: the detector is deterministic and free per building. Feeds `measure.ts`, auto-type drafting and the 389 "no type fits" funnel. The repo ranked it 4th in `research/amsterdam-open-sources-20261009.md` and never built it. |
| Auto-draft a type from a family cluster's median strip; Opus edits instead of authors | **Yes** | Type authoring is the Opus-heavy step in T1; a drafted JSON turns an authoring turn into a review turn. |
| Image generators making blueprint-like elevations to build from | **No** | Not evidence; acceptance is likeness to *the* photo; hallucinated ornament is worse than the plain box; provenance muddied. Revisit only for stylised far-tier impostors, which the far prisms already cover. |
| Per-buurt profiles extended to every parameter the generic grammar has (storey heights, shopfront share, crown kind, sash proportions) | **Yes** | T0 lever; profiles exist, the grammar has the knobs, derive.ts has the data. |
| Shopfront grammar from OSM shop tags + measured fascia colour on ground floors | **Yes, small** | Ride-level identity on exactly the storey the photos cannot texture. |
| Splats / TRELLIS / TripoSR | **Park** | statues only, licence and CUDA blockers, no change since 10-14. |

---

## C. The month (4 weeks + reserve), on Opus / Sonnet / Haiku

### C0. Budget rules (apply from day 1)

- **Calibrate, do not guess.** Anthropic no longer publishes Max 20x weekly figures
  (third-party estimates ~24–40 Opus h/week at the 2025 launch, raised since; the
  November run sustained ~400 M Opus tokens/day for five days). Day 1: read the usage
  page after the first two lanes and set the week's lane count from the %-per-lane it
  shows. **Content lanes stop at 75 % of the weekly cap; the last 25 % is the fix and
  integration reserve.** Integration never yields to content.
- **Model routing (edit `docs/handoffs/LANE-RULES.md` §Models):**
  - Haiku: surveys, crops, factory batches, auto-place, batch installs, bundles,
    covers, census, coverage rebuilds, meshopt conversions, report writing.
  - Sonnet (newly allowed, bounded): applying a spelled-out `fix`, writing a type JSON
    from measured numbers or a drafted median, implementing a perf step with a numeric
    acceptance in its brief, brief and doc writing.
  - Opus: strip review verdicts, type authoring from strips when the draft fails, kit
    components, look levelling, diagnosis, integration and pushes.
  - Set the model on every spawn (memory `lane-model-choice`); the hand-back records it.
- **Context discipline:** a lane is ≤ 60 turns; batches re-spawn fresh (cache reads
  scale with turns × context). Briefs ≤ 1 page; the queue / placement record is the
  handoff.
- **Weekly numbers on #68:** tokens per accepted building per route, census, T0/T1
  coverage shares, perf budgets. Kill rules from the skill apply to every lane.

### C1. Week 1 — refresh the truth, unblock the cheap tiers, fix the loader

| Lane | Model | Work | Acceptance |
|---|---|---|---|
| census-refresh | Haiku | `build:coverage`, `census --write`, factory queue refresh (merge `lane/landmark-factory-20261106`'s queue), ride-visible share metric published; ride-ring buurt ranking by `ride-visibility.ts` routes | one table on #68: pands by tier, by stadsdeel, by ride ring |
| chunks-meshopt | Haiku | meshopt + quantize the 143 chunk GLBs and 177 per-house GLBs (same toolchain as landmarks) | bytes before/after; A/B strip identical |
| profiles-citywide (T0) | Haiku run, Opus 1 turn | `derive.ts` over every buurt with ≥ 12 thumbnails; pooled wijk fallback for the rest; add storey-height / shopfront-share / crown-kind / sash fields where the grammar has knobs | 518/518 buurten with a profile or an evidenced fallback; 12-spot sheet |
| palette-level (B3.1) | Haiku measure, Opus 1 turn | rendered vs photo luma/saturation over the measured fronts; one global levelling in `look/palette.ts` | user strip before/after |
| decision issues | — | #125 (12k vs 16k tower budget), #112 (inferred installs): ask as `needs-david` with the cost of each answer | answered or defaulted |

### C2. Week 2 — T1 engine: types by script, Opus reviews

| Lane | Model | Work | Acceptance |
|---|---|---|---|
| vision-measure spike (B6.1) | Sonnet, 1 week cap | local open-vocabulary detector on the archived rectified crops → bays, storeys, window kind, bands; compare with `measure.ts` and the 761 block-face houses | agreement ≥ 85 % on bays/storeys on 200 fronts, else park with numbers |
| type-draft (B6.2) | Sonnet | cluster faces by family (existing survey), median strip → drafted type JSON with measured lines; Opus only edits | drafts for the top 5 ride buurten' families |
| buurt lanes ×3 (T1) | Haiku place/install, Opus review | top ride-ring buurten by ride-visibility that are pre-war rows (Da Costa, Helmersbuurt/Oud-West r2, Transvaal r6, De Pijp, Jordaan…): survey → draft → Opus strip → place → batch install | installed pands per lane, holds by reason, "kit cannot express" list |
| recipe-tiles-on | Sonnet impl, Haiku runs | quantise widths to 5 cm, recompile, `kind: glb` conversion of chunks into tiles, flip `?recipeTiles=1` | draws and heap ≤ baseline; Bilderdijkstraat strip identical |

### C3. Week 3 — kit gaps that release the landmark queue, bespoke round 6

| Lane | Model | Work | Acceptance |
|---|---|---|---|
| kit-gap ribbon-under-punched (28 pands, biggest by visibility) | Opus author, Haiku test/golden | component + test + byte-identical default | 3 held pands pass the likeness gate |
| kit-gap dark painted/clad (44 pands) | Opus | closer-crop / second-capture signal + `paint` family | 5 of 44 move |
| factory rerun | Haiku factory, Opus 2 review turns | triage → factory → 2 strips | installs ≥ 20 % of a strip, else stop |
| bespoke round 6 | Opus, 5 landmarks per lane, ≤ 60 turns | next 20 by ride visibility from the wide targets | sheets + in-game; cost per landmark ≤ 20 M |
| shopfront grammar (B6.5) | Sonnet | OSM shop tags + measured fascia colour into STYL ground floors | strip at 20–40 m on three shop streets |

### C4. Week 4 — perf gates, slot layers, second T1 pass, reserve

| Lane | Model | Work | Acceptance |
|---|---|---|---|
| SHEL step 3 | Sonnet impl, Haiku measure | publish baked coarse shells; remove runtime coarse builds | uploads ≥ 1 MB after warm-up 49 → ≤ 10; aerial draws toward 400 |
| slot layers (B3.2) | Opus 1 turn design, Haiku paint/test | timber, metalRoof, warm-grey roofTile, dark painted brick, glazed plinth, soot band | material-slot tests; 12-spot sheet |
| buurt lanes ×2 (T1 second pass) | as week 2 | the next ride buurten, using drafts + detector if the spike passed | |
| windowSdf desktop flip | Haiku measure | flip if ≤ +1 ms at the pinned poses | budgets.json |
| reserve | — | the 25 %: fixes from feedback/Sentry, re-levels, holds | |

### C5. Expected end-of-month numbers (state the arithmetic, then measure)

| Tier | Today | Month target | Basis |
|---|---|---|---|
| T0 profiled buurten | 256 / 518 | 518 / 518 | scripts only |
| T0 pands with measured own colour | 3,649 fronts | every pand with a thumbnail (tens of thousands) | API-bound |
| T1 kit pands (chunks + types) | 750 + 13,482 | +1,500–2,500 chunk pands in the ride ring | 5 buurt lanes × 300–500 at 1.4 turns where types fit; funnel today loses 48 % to "no type fits", which the drafts attack |
| T2 census | 581 | ~700 | 20–30 bespoke + released factory holds + kit reviews |
| Perf | uploads 49, programs 32, aerial draws 2,008 | ≤ 10, ≤ 28, ≤ 800 | SHEL 3 + recipe tiles |

If week-2 yield runs under half of this, widen T0 (cheap) and narrow T1, never the
other way round.

---

## D. Verification

- Every lane: `npm run lint`, the lane's named tests, `check:canal` at merge,
  `test:canal-game-structure` after each merge (memory `structure-gate-before-push`),
  covers rebuilt after any install (memory `covers-after-installs`), one Playwright run
  at a time via `/tmp/canal-pw.sh` with a private `PW_PORT`.
- Look changes: the 12-spot sheet plus one user strip (before/after) per flip; What's
  New note with screenshots in `blackmad/map-recall2-screenshots`.
- Perf: `scripts/perf-gate.mjs` → `tests/perf/budgets.json` before and after SHEL 3,
  recipe tiles and the windowSdf flip; no raised baselines.
- Coverage: `npm run build:coverage` and `npm run census -- --write` weekly; the table on
  #68 with tokens per accepted building per route.
- Budget: usage page read at every integration round; content lanes paused at 75 %.

## E. Done on 2026-11-07

Explainer artifact published; this plan, the LANE-RULES edit and the four week-1 briefs
on branch `plan/city-coverage-20261107`; link and summary posted on #68. The Opus
integrator session spawns the week-1 lanes from the briefs (models as written).

## F. Files the executor reads first

- `docs/plans/digital-twin-direction-20261013.md` (GLB verdict, target tile architecture)
- `docs/plans/thousand-buildings-20261023.md`, `docs/handoffs/LANE-RULES.md`,
  `.agents/skills/landmark-lane/SKILL.md` + `references/large-tier-sheet.md`
- `docs/buurt-generator-20261016.md` (Transvaal lessons), `docs/handoffs/kit-gaps.md`
- `docs/texture-prototype-20261014.md`, `docs/LOOK.md`, `src/canalRecall/look/cityLook.ts`
- `src/canalRecall/buurtProfiles/buurt-profiles.json`, `scripts/buurt-profiles/derive.ts`
- `scripts/world/compile.ts`, `src/canalRecall/world/cellFormat.ts`,
  `src/canalRecall/tileBuildings/runtime.ts`, `tests/perf/budgets.json`
- `scripts/building-recipes/ride-visibility.ts`, `docs/reports/landmark-targets-wide-20261102.json`
- `public/canal-drive/TODO.md` lines 46–79 and 587–591
