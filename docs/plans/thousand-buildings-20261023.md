# 1000 reviewed buildings, per-buurt looks, three switches, roads (2026-10-23)

The user's ask: get to **1000 fully modelled landmark buildings** and
**per-buurt looks**, within the Claude Code Max plan for the month, with Opus
orchestrating and Haiku doing the mechanical work; say where the pipeline is
dumb; decide the three off-by-default building switches; fix the roads.

Decisions the user made on 2026-10-23:

- Budget is the Max plan. Opus turns are the scarce resource, Haiku is ~40×
  cheaper, scripts are free.
- **Counts toward 1000:** a named POI *or* a ride-visible dominant building,
  whose model passes the `audit:glb` hard gates *and* has a recorded
  photo-likeness review. Bespoke GLB, `kind: large` recipe or kit all count.
- The three switches may become defaults in the order **BAG tiles → recipe
  tiles → city look**, each after a desktop measurement and one before/after
  strip the user looks at.

Where we stand (census, 2026-10-23, `npm run census`): **386** buildings
count under that definition with the historical gallery reviews grandfathered
(327 bespoke landmarks, 12 hand-built ordinary models that are ride-visible,
47 large recipes that passed the likeness gate); **47** count under the strict
reading (this programme's reviews and the likeness gate only). 546 kit
buildings and 18 gates-only recipes are modelled and unreviewed.

## 1. Where the pipeline is dumb

| # | Dumb thing | Evidence | Fix |
|---|---|---|---|
| 1 | One GLB per building, fetched 2 at a time, ~8 draws each, no eviction | `signature-landmarks-source.js` `_requestModels`; 352 GLBs + 306 lod1 = 181 MB; "models still appear in view at speed" | S2 recipe tiles default + `kind: glb` conversion |
| 2 | Four hand-kept lists reconcile one building across four layers | 1,403 `suppressOsmIds`, 1,047 + 663 covers, 10,578 basemap hide ids | S1 BAG tiles default; covers becomes the only list |
| 3 | Every `build-manual-landmarks` run rebuilds all 355 builders, invalidating every lod1 hash | no content-hash skip | lane build-hash-skip |
| 4 | Every lane re-fetches panoramas per building; the per-pand crop batch planned on 10-13 never ran | `all-walls.ts` run by hand per pand | factory stage `crops` over the whole queue, once |
| 5 | Leaf lanes read 2,880 + 16,000 + 1,473 lines before working (40–80k tokens each) | START-HERE already warns | `LANE-RULES.md`, briefs ≤ 1 page, a machine-readable queue |
| 6 | The expensive model sits inside the per-building loop | handoffs; "~2 h per ordinary building" | factory compiles 20 unattended; Opus reviews one strip per turn; Haiku applies verdicts |
| 7 | Bespoke imperative builders for grid-fronted buildings the large kit expresses | 185 of 242 builders < 150 lines, 33k lines total | bespoke only for icons; everything grid-fronted is `kind: large` |
| 8 | Models counting windows from photos (noisy, costly) | "Haiku blind counts were too noisy" | `measure.ts` writes bays, glazing, shape, colour; no model counts |
| 9 | Slot instancing found 0 repeats: fitted widths differ by centimetres | HISTORY step 3 | quantise to 5 cm in the fitter (S2) |
| 10 | Parallel browser lanes thrash the machine (load 93) | memory | one headless renderer per batch; ≤ 2 browser jobs |
| 11 | 1,828 dominant candidates unnamed, so never POIs | all `name: null`; top 250 hold 92 % of ride visibility | lane identity |
| 12 | Per-buurt statistics exist (518 buurten, repetition, clusters) and nothing consumes them for look | `coverage-v1/buurten.json`; `DistrictStyle` never built | B1, B2, B3 |
| 13 | Roads: only BGT `wegdeel` fetched; OSM cycle ribbons, part-covered bands and far-ring bands still drawn over the polygons; paint from four rules | roads survey | R0–R4 |

**Just-in-time rendering:** yes for the look, no for recipes. The generic
tier is already built in the worker from a 7-int per-pand descriptor, so a
per-buurt style there costs nothing per building (B1). Compiling recipes in
the browser would be slower than streaming 3.5 KB/pand instanced tiles and
would lose gates, goldens and per-diff review; near-tier units stay compiled
offline (S2, B2).

## 2. The switches

- **BAG tiles** (`?bagTiles=1`): plumbing. Perf-neutral (map render 2.2 vs
  2.7 ms, same draws, same heap), `check:covers --strict` 0 hidden bugs. Left
  off only as "user's call". **Flip first.**
- **Recipe tiles** (`?recipeTiles=1`): architecture, invisible outside the
  pilot tiles. Bilderdijkstraat draws 301 → 144, heap −38 MB, iPhone 7.1 →
  6.7 ms. Debt: stale pilots, 2/15 chunks differ, instanced highlight unseen,
  0 instancing repeats. **Flip second**, after a recompile and a highlight
  check; it is the loader 1000 models need.
- **City look** (`?cityLook=1`): visual. 293/311 landmarks within 10 % of
  their brightness after the 10-13 review, zero frame cost, +5.5 MB
  textures. Levelled before the sunny look landed: under it the frame reads
  5–6 luma darker and a sun wall at 0.79. **Re-level, strip, then flip on
  the user's OK.**

## 3. The programme

Tools (all landed 2026-10-23, no LLM call in any of them):

| Command | What |
|---|---|
| `npm run factory:queue -- --write` | builds/refreshes `public/canal-drive/landmark-factory-queue.json`: pending POI buildings with pand ids, then ride-visible dominant buildings by `rideVisibility.score`; already-covered pands left out; authored recipes keep their house |
| `npm run factory -- --ids=20 --owner=<lane>` | per item: crops → facts (streets within 30 m) → draft (`draftLargeIntent`) → measure → compile + sheets; status and notes back into the queue |
| `npm run factory:strip -- --queue=… --status=compiled --limit=20 --out=artifacts/strips/<batch>` | pages of four contact sheets with a header line, plus `<batch>.json` with the verdict template |
| `npm run census -- --write` | the headline number and `public/canal-drive/landmark-census.json` |
| `node --import tsx scripts/building-recipes/install-large.ts --house=<id> --install` | after a `pass` |

Lanes, briefs in `docs/handoffs/lane-*-20261023.md`, rules in
`docs/handoffs/LANE-RULES.md`:

| Lane | Model | What | Counts toward |
|---|---|---|---|
| factory (F) | haiku batches, opus review turns | the queue through the factory, strips, verdicts, installs | 1000 |
| kits-review (K) | haiku strips, opus turns | the 546 kit buildings earn or lose their review | 1000 |
| identity (P) | script + haiku | names and sources for the top-600 dominant buildings | POI cards |
| bagtiles-default (S1) | haiku + one opus check | flip, bundles, ride-perf, strip | loader |
| recipe-tiles-default (S2) | opus + haiku | quantise widths, recompile, `kind: glb` conversion, flip | loader |
| citylook-relevel (S3) | opus | re-level against the sunny look, gallery review, user strip | look |
| district-style (B1) | opus + haiku | `DistrictStyle` per CBS buurt in the worker's generic tier | per-buurt look |
| buurt-designs (B2) | opus authoring, haiku placement | instanced designs for the high-repetition buurten | per-buurt look |
| buurt-autoplace (B3) | opus authoring, haiku runs | pre-war buurten through the type libraries | per-buurt look |
| roads-diagnose (R0) | opus | per-pixel source map at the complaint spots beside the orthophoto | roads |
| roads-gaps (R1) | haiku data | BGT islands, berms, squares into `roads-v1`; bare-land metric | roads |
| roads-lanes (R2+R3) | opus | OSM layers yield to the polygons; node-backed paint only; grey and red decided with the user | roads |
| build-hash-skip | haiku | `build-manual-landmarks` skips unchanged builders | integrator time |

Weekly shape: one Opus integrator session (merge, `check:canal`, covers,
LODs, census, HISTORY line, demo), ≤ 6 Opus review turns (one strip of 20 ≈
5 pages ≈ 40k tokens in, 3k out), ≤ 2 Opus authoring sessions; Haiku runs the
rest. Target ≤ 8 Opus hours a week. If the plan window trips, Haiku keeps
running and review turns are deferred, never the integrator session.

Arithmetic: 386 today; 65 pending POI buildings → ~50; the 557 ride-visible
dominant buildings → ~400 at 25 % no-evidence and 15 % second passes; kits
→ ~300 of 546 pass a strip; 1000 around week 6 of the programme. If yield
runs under 70 % in week 2, widen to rank 558–900 before touching anything
bespoke.

## 4. Verification

`npm run check:canal` at every merge; ride-perf (fixed route + places, run
alone) at S1, S2, S3 and after every 100 new models, draws and heap ≤ the
pre-flip row; `npm run census` climbs and every counted row has a sheet,
verdict, date and reviewer model; every installed factory house has
`measured.json` and a PASS/WARN likeness line; the user sees one strip per
flip, per buurt pilot and for roads. A weekly HISTORY line records Opus
hours, Haiku lanes, buildings reviewed and Opus minutes per reviewed building.

## 5. Risks

The census baseline grandfathers the historical gallery reviews; the strict
number is 47. Dominant candidates outside the 4 km POI radius stay unnamed
until the identity lane finds a source; they still count as ride-visible.
Haiku never judges likeness: a batch installed without a verdict is reverted.
S3 is gated on the user's strip and nothing downstream needs it. The schedule
assumes ~8 Opus hours a week; less stretches the factory, not the design.
