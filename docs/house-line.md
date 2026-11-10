# The house line

One pipeline from "look at a house" to "it is in the game": describe, preview, compare, stage, publish. This document
is the canonical reference; `CLAUDE.md` carries only the ten-line summary. Plan and rationale:
`docs/handoffs/house-line-plan-20261110.md` (approved by the user 2026-11-10, issue #337 onwards).

```
describe ──► preview ──► compare ──► stage ──► publish
(spec)       (PNG, 3 s)  (likeness)  (staging) (batch, integrator)
```

| Station | Lane | Status |
|---|---|---|
| §1 The record (HouseSpec) and the generic path | H1 | landed (this section) |
| §2 Preview in Node | H2 | stub |
| §3 Stage and publish | H3 | landed |
| §4 Describe at scale (crops → facts → spec) | H4, H5 | stub |
| §5 The kit-gap queue | H6 | stub |

## §1 The record: HouseSpec

### Why

Before the line, a house's facts lived in three record types (`facade/houseRecord.ts` `CanalHouse`, recipe intents in
`scripts/building-recipes/houses/<id>/intent.json`, block-face intents in `scripts/block-face/faces/<id>/intent.json`)
plus the monuments register (`facade/registerRecipe.ts`), and each render path read its own subset. A HouseSpec is the
one record per pand that every source writes into and every path can read.

### The fields (`src/canalRecall/houseSpec/spec.ts`)

```ts
interface HouseSpec {
  schemaVersion: 1;
  pandId: string;                       // 16 digits, no NL.IMBAG.Pand. prefix
  address?: string;
  design: DeepPartial<HouseDesign>;     // CanalHouseIntent minus identity: fronts[], roof, palette, notes
  facts?: { facadeYear?: number; elements?: string[]; pui?: 'shop' | 'residential' | 'warehouse' };
  provenance: Record<string, Prov>;     // keyed by field path
  schemaLimits?: { component: string; what: string }[];
  route?: 'generic' | 'recipe';         // derived by toRecipe.ts withRoute
}
type Prov = { source: SpecSource; confidence: number /* 0..1 */; ref: string; at: string | null /* YYYY-MM-DD */ };
```

- **Vocabulary.** `design` is the vocabulary recipes and block faces already speak (`buildingRecipe/intent.ts`
  `FrontIntent`, `RoofIntent`, `PaletteIntent`). Nothing new to learn; every field is optional.
- **`facts`** holds what a source states that the design has no field for: the year the street front dates to (drives
  the era palette), the register's elements as wall-extra component ids, the ground-floor kind a judge saw.
- **Field paths** (the unit of provenance and of the merge): one key of one front (`fronts/0/gable`), one key of the
  roof or palette (`roof/material`, `palette/brick`), `notes`, one key of `facts` (`facts/facadeYear`). Values below
  that level (a `windowHead` object, a per-storey `bays` list) are atomic: two sources never splice one window head.
- **Provenance** is keyed by field path; an ancestor key covers every field under it (`fronts/0`, or `` for the whole
  record, which is what an adapter for a single-source record writes). `resolveSpecs` writes one key per field.
- **`schemaLimits`**: what the photo shows that the kit cannot say, one `{component, what}` per kit part (the shape of
  `BlockFaceIntent.schemaLimits` on a1's belt lanes). `component` is the kit part (`gable ornament`, `ground storey`,
  `palette`); the kit-gap queue (§5) keys on it. Legacy `"component: what"` strings are read by `toSpecLimit`; a line with
  no component is filed under `facade`. Never fit the nearest option instead of recording the limit.
- **`route`**: `recipe` when `toRecipe(spec)` returns a `CanalHouseIntent` that `validateIntent` accepts (complete
  fronts, roof and palette, and at least one dated receipt that maps to an intent source kind), else `generic`.

### Trust order

`facade/evidence.ts` `SOURCE_STRENGTH`, weakest first:

`default` < `osm` < `3dbag` < `ahn` < `pdok-ortho` < **`vision-judge`** < `bag` < `monument-text` <
`streetlevel-measured` < `reviewed` (= **`author`**)

`vision-judge` (a Jev typed judgement of a street crop) was added 2026-11-10 between `pdok-ortho` and `bag`; `author`
(a hand-written spec) ranks as `reviewed`. `resolveSpecs(parts)` (`resolve.ts`) picks, per field, the strongest source,
then the higher confidence, then the newer evidence date (`resolveField`'s order); a full tie keeps the earlier part.
Nothing is invented: a field no part states stays absent.

### Sources today (`adapters.ts`)

| Adapter | Reads | Source | Ref |
|---|---|---|---|
| `fromRegisterFacts(facts, nr, pandId)` | `monument-facts.json`: gable, facade year, finish → `palette.wallMaterial` (stone → a schema limit), hoist beam, stoop, elements → `facts.elements` | `monument-text` (gable 0.8, year 0.7, a period 0.5) | `rce:<nr>` |
| `fromBlockFace(face, pandId)` | one house of a face via `houseIntents`; limits from `rhythm.schemaLimits`, face `schemaLimits` naming the pand (or naming no pand: face-wide), face `limitations` naming the pand | `streetlevel-measured` (0.85 authored, 0.6 auto-placed) | the face's `strip.json` |
| `fromRecipeIntent(intent)` | `kind: canal-house` only (large/landmark return null) | its strongest `sources[]` kind | `<intent path>#<source id>` |
| `fromHouseRecord(record)` | facade-twin `CanalHouse`: observed fields only; trap→step, hals→neck, verhoogde hals→raised-neck, klok→bell, tuit→spout, punt→point, lijst→cornice | each field's own receipt | its observation id |
| `fromJev(judgement)` | bays, pui, a *confident* gable, finish; answers under p 0.5 dropped | `vision-judge`, confidence = p | the crop |

Hand-written specs live in `scripts/house-specs/specs/<pandId>.json` (validated by `validateSpec`; use source `author`).

### How to add a source

1. Write a pure adapter in `adapters.ts` that returns a partial `HouseSpec`: set only the fields the source states,
   each with a receipt (`provenance[path]`, or `provenance['']` when one receipt covers the record).
2. If the source is a new kind of evidence, place it on `SOURCE_STRENGTH` with a comment saying why it ranks there.
3. Unit-test it on a real record from the repo (`adapters.test.ts`).
4. Read it in `scripts/house-specs/build-house-specs.ts` (one `add(...)` loop) and rerun `npm run house:specs`; the
   coverage report counts pands per source.

### The extract

`npm run house:specs` (`scripts/house-specs/build-house-specs.ts`, `--help`) resolves every pand with a source and
stages `public/data/extracts/amsterdam/staging/house-specs/14/<x>/<y>.json.gz`:
`{version: 1, buildings: {"NL.IMBAG.Pand.<id>": {d, x, s, l, r, v}}}` = resolved design, facts, winning source per
field, limits, route and the runtime view `v`. The coverage report goes to `staging/house-specs.coverage.json`.
`--publish` copies the staged tiles to `house-specs/14/` (integrator only, after reviewing the coverage diff).
`scripts/world/pipeline.ts tileInputs(t)` hashes `house-specs/14/<t>.json.gz`, so a spec edit recompiles only the cells
of its tile.

First run (2026-11-10): 7,224 pands (register 5,958; 280 block faces = 1,314 houses; 35 canal-house intents),
7,150 in 55 tiles, 300 kB gz; 1,296 recipe-route, 5,928 generic.

### The generic path reads it (flag `?houseSpecs=0`, `HOUSE_SPECS=0`)

- `houseSpec/decorate.ts houseSpecEnricher`, composed last in `gameTileEnricher.ts`, stamps the runtime view on each
  raw feature as `p.houseSpec` = `{gable, year, wallMaterial, wallHex, bays, src}`.
- `withHouseSpec` runs right after the register step (before `decorateFacade`): it moves `constructionYear` only on an
  era change (the register's rule), sets `registerFinish` from `wallMaterial`, and writes `specRecipe`
  `{bays, wallHex, period, crownShape}` when the spec has bays or a wall colour.
- `withHouseSpecCrown` runs after `withMonumentGable` (which would otherwise restore the register's gable): it sets
  `monumentGable` when the spec's gable source outranks `monument-text`, or when nothing named a gable.
- The view carries a street-measured gable to the roof planner only for a full-width step/neck/raised-neck/bell/
  spout/point crown on a roof that is not flat; a cornice or flat front, or a crown over some bays, stays in the record
  (the roof planner draws a monument gable as a canal house's whole roof; measured on the first full compile, cornice
  fronts gave 681 flat-roofed 1890s pands a pitched canal roof).
- `threeBuildingFeatures.ts meshBuildingFor` keeps `specRecipe` as `MeshBuilding.specRecipe` (not `.recipe`: that slot
  switches every wall to recipe openings and street-crown recolouring). A measured `wallHex` would be a sourced wall in
  the photo look, but it is **held** (`decorate.ts SPEC_WALLS_HELD`): strip colours are overcast readings and drew
  Kinkerstraat 244-332 darker than the generic palette. Release after a white-point pass and a panorama side-by-side. `streetFacadeRendering.ts frontageLayoutScale` fits a street run to the stated bays:
  cells = round(bays / window axes per cell), clamped to 0.7–1.5 of the style's bay. The generic cells carry two or
  three window axes, so an odd bay count on a two-axis cell rounds (a limit of the generic path, not of the spec).
- Byte-identical off: with `HOUSE_SPECS=0` the world compile is identical to origin/main (605 of 605 cell files).
  On: 85 of 604 cells differ, only in the 7,134 spec'd buildings (+31 kB gz). On the generic path (pands no installed
  model hides, `scripts/house-specs/measure-generic-effect.ts`): 403 carry bays, about 175 of them change cell count;
  29 change gable.
- The live paths compose the same steps: `public/canal-drive/js/vector-map.js` (the page's tile streamer) and
  `engine/ownWorldView.ts`, through the `CanalRecallThreeBuildings` globals (`houseSpecEnricher`, `withHouseSpec`,
  `withHouseSpecCrown`, `houseSpecsEnabled`). World-v1 cells carry the bake; `?houseSpecs=0` only affects `?world=live`.

### Which specs a world carries

`world:compile` writes the stamp into world-v1 `index.json` (`houseSpec/extractStamp.ts`, via
`pipeline.ts houseSpecsIndexStamp`): `"houseSpecs": "on"` plus
`"houseSpecsExtract": {"dir": "house-specs", "tiles": 55, "hash": "<sha256>"}`, or `"houseSpecs": "off"` alone. The hash
is sha256 over the sorted `path:sha256(bytes)` lines of `<dir>/14/**`, so it changes only when a spec tile's name or
content changes. Only `index.json` carries it. `tiles.json` and the cell `.bin` files are unchanged by the stamp.

### Rollback

**On the baked default world, `?houseSpecs=0` does nothing**: the specs are compiled into the world-v1 cells. To roll
back, recompile with `HOUSE_SPECS=0` (`HOUSE_SPECS=0 npm run world:compile -- --shell`; its `index.json` then says
`"houseSpecs": "off"`) and republish that world-v1, or republish the previous world-v1. `?houseSpecs=0` works only
with `?world=live`, where the live tile streamer runs the decorators in the browser.

### Where to look next

`spec.ts` (types, paths, validation), `resolve.ts` (merge), `toRecipe.ts` (recipe route), `adapters.ts` (sources),
`decorate.ts` (runtime), tests beside each (`npm run test:house-spec`).

## §2 Preview in Node

Stub (lane H2): `house:preview <pandId|spec.json> [--watch] [--photo]`.

## §3 Stage and publish

Lanes stage, the integrator publishes once per batch. Nothing a lane does under `house:stage` touches `public/`.

```
lane:        spec ──► house:preview ──► house:stage ──► artifacts/house-specs/staging/<pandId>.json
integrator:  house:publish  (one batch: merge → recipe route → compile touched cells → goldens → guard → check:canal → record)
```

### Layout

| Path | Written by | What |
|---|---|---|
| `artifacts/house-specs/staging/<pandId>.json` | `house:stage` | `{spec, stagedAt, by, note, receipt}`; one file per pand, restaged = replaced |
| `artifacts/house-specs/work/<batch>/{specs,intents}/` | `house:publish` | the batch's specs as plain files for `build-house-specs --extra-specs`; recipe-route intents (`toRecipe`) |
| `artifacts/house-specs/logs/<batch>-<step>.log`, `<batch>-nightly.log` | `house:publish`, `nightly.sh` | one log per step |
| `artifacts/house-specs/published/<batch>.json` | `house:publish` | what landed: specs, receipts, pand records, touched tiles and cells, cell files that changed, covers delta, installs, holds, the golden allow-list, per-step timings, wall time against the 15 min budget |
| `artifacts/house-specs/published/<batch>/<pandId>/{staged.json,measure.json,compare.png}` | `house:publish` | the staged files moved here, with the receipt files |
| `scripts/house-specs/specs/<pandId>.json` | `house:publish` (step 2) | the published specs, the durable source `build-house-specs` rebuilds the extract from (commit them) |
| `<map-recall2-source-data>/house-specs/<batch>/` | `house:publish --archive` | the published directory copied for the archive worktree; the integrator commits and pushes it |

### A receipt

The receipt is what proves the spec was looked at: the `measure.json` and `compare.png` that `house:preview` wrote for this spec
(`artifacts/house-preview/<pandId>/`), with their sha256 and the verdict word. `house:stage` refuses a spec with no preview
output, or with a `measure.json` older than the spec file (re-run the preview). `--no-receipt "<reason>"` stages without one and
records the reason (the preview cannot draw this house, or H2 is not merged); `house:publish` prints the count of each kind and
refuses a receipt whose files changed after staging.

### Commands and flags

`--help` of each script prints exactly this text (the `HELP` constant of the script).

```
house:stage: validate a HouseSpec, attach the preview receipt, write it to the staging directory.

  npm run house:stage -- <spec.json|pandId> [--note "..."] [--by <name>] [--preview-dir <dir>]
                                           [--no-receipt "<reason>"] [--stale-receipt]
  --help                                   this text

<spec.json|pandId>   a spec file, or a 16-digit pand id read from scripts/house-specs/specs/<pandId>.json
--note "..."         free text kept with the staged spec (shown in the publish table)
--by <name>          who staged it (default: git user.name, else $USER)
--preview-dir <dir>  where house:preview wrote this pand's measure.json and compare.png
                     (default artifacts/house-preview/<pandId>)
--no-receipt "<r>"   stage without a preview receipt; the reason is recorded and shown at publish (use it only when the
                     preview cannot draw this house, and say what stands in for it)
--stale-receipt      accept a measure.json older than the spec file (default: refused, the receipt must be of this spec)

Writes artifacts/house-specs/staging/<pandId>.json = {spec, stagedAt, by, note, receipt}. Lanes stop here: house:publish is
the integrator's (batch, covers, goldens, check:canal). A pand already staged is replaced.

house:publish: publish the staged HouseSpecs as one batch (the integrator's command; lanes stop at house:stage).

  npm run house:publish -- [--dry-run [--compile]] [--batch <name>] [--allow-extra <pandIds>]
                           [--world-out <dir>] [--full-bake] [--goldens] [--archive <dir>]
                           [--verbose] [--skip-check-canal "<reason>"] [--skip-suppression "<reason>"]
  --help                   this text

  --dry-run [--compile]     step 1 only (with --compile also a rehearsal of step 4 in a scratch copy of --world-out, compiled
                           against the staged extract; nothing under public/ changes): merge the staged specs into a STAGED extract (public/data/extracts/amsterdam/staging/
                           house-specs), print the per-pand field diff, the touched z14 tiles and the cells they rebuild, and
                           the commands a real run would use. Nothing is published, installed or compiled.
  --batch <name>           the batch name (default batch-YYYYMMDD-HHMM); names artifacts/house-specs/{published,logs}/<name>*
  --allow-extra <ids>      pand ids whose extract record may change although no staged spec names them (default: any such
                           change refuses the batch, it means a source drifted since the last publish)
  --world-out <dir>        the world:compile staging directory (default artifacts/world/staging); needs a previous
                           index.json there for --changed
  --full-bake              when the shell code changed since that compile (world:compile --shell --changed refuses), run a full
                           world:compile --shell instead of stopping
  --goldens                run the four goldens even for a generic-route-only batch (default: only when a spec has route recipe)
  --archive <dir>          the map-recall2-source-data checkout (default $MAP_RECALL_SOURCE_DATA): specs + receipts are copied
                           to <dir>/house-specs/<batch>/ (the integrator commits and pushes that worktree)
  --verbose                list every staged spec and every field of the diff (default: the first eight)
  --skip-check-canal "<r>" do not run check:canal (a rehearsal only; the reason is recorded in published/<batch>.json)
  --skip-suppression "<r>" do not run the suppression guard (same)

Steps, in order (each timed in published/<batch>.json; logs in artifacts/house-specs/logs/<batch>-<step>.log):
  1 merge      build-house-specs --extra-specs <batch dir>: staged tiles, diff vs the published extract, extra-pand refusal
  2 write      copy the specs to scripts/house-specs/specs/, build-house-specs --publish (the published extract changes here)
  3 recipe     only if a spec has route recipe: toRecipe -> houses/<id>/intent.json, facts, install.ts, build-covers,
               copy covers.json, check:covers (covers.json changes here)
  4 compile    world:compile --changed --shell (touched cells only; each tile hashes its own slice of covers.json); the cell
               files that changed must all belong to a touched tile
  5 goldens    fit-golden, large-mesh-hashes, roof-golden, block-kit-installed with --allow=<batch ids>; check:stale-installs
  6 suppress   the #341 audit (house:audit) for every pand the batch's covers newly hide, plus recipe-route pands: a street wall
               of 4 m or more left blank refuses the batch
  7 check      check:canal once
  8 record     published/<batch>.json, staged files moved to published/<batch>/, archive copy, the HISTORY/What's New paragraph,
               and the commands that copy the compiled world into public/data/extracts/amsterdam/world-v1
Exit code is non-zero on any gate failure; the working tree is left as it is for the integrator to inspect (git status).
```

### The batch rule

Lanes never publish. A lane's last step is `house:stage`; it returns the staged pand ids in its hand-back. The integrator runs one
`house:publish` for everything staged (`scripts/house-specs/nightly.sh` is that command with a log, for whenever the integrator
chooses; the repo installs no cron). One batch = one commit, one HISTORY entry, one What's New note (the command prints drafts).

### What each step does

1. **merge.** The staged specs are written as plain files and `build-house-specs --extra-specs` resolves them with every other source
   into the STAGED tiles (`public/data/extracts/amsterdam/staging/house-specs`). The staged tiles are diffed against the published
   ones, field by field, per pand. A record that changes although no staged spec names that pand refuses the batch (a source drifted
   since the last publish); `--allow-extra <ids>` accepts named ones. A staged pand that lies in no building tile also refuses.
   `--dry-run` stops here and prints the diff, the touched z14 tiles and the cells that list them. `--dry-run --compile` also
   rehearses step 4 in a scratch copy of the compile directory against the staged extract.
2. **write.** The specs are copied to `scripts/house-specs/specs/` and `build-house-specs --publish` replaces the published
   `house-specs/14`. This is the first step that changes `public/`.
3. **recipe route.** Only for specs that resolve to `route: 'recipe'`. The intent is `toRecipe(resolved spec)` under the id of the
   house directory that already carries the pand (its earlier sources are kept), else `spec-<pandId>`; `facts.ts` fills the facts of a new
   directory; `install.ts --house=<ids>` compiles and installs; then `build-covers`, the covers copy to `models/covers.json` and
   `check:covers`. **Stale installs:** a reinstall that fails its gates keeps the old GLB and writes `held-installs.json` with the
   reason `staged spec <date>` (`check:stale-installs` then passes with the hold explicit); a new house that fails stops the batch.
4. **compile.** `world:compile --changed --shell` into the compile directory. Every tile hashes its own inputs and its own slice of
   `covers.json` (below), so only the cells that list a touched tile rebuild. After the compile the cell, shell and far files that
   differ from the previous `index.json` are compared with the cells of the touched tiles; any file outside them fails the batch. If the shell code
   changed since the last compile the compiler refuses `--shell --changed`; the command then stops and says so, or with `--full-bake`
   runs a full `--shell` bake.
5. **goldens.** `fit-golden`, `large-mesh-hashes`, `block-face/roof-golden` and `haparandaweg/check-installed` run with
   `--allow=<ids>`: the batch's pand ids plus the house directories, block faces and block-kit specs that mention one. A change inside
   the list is re-recorded; a change outside it fails the batch and its ids are printed. `check:stale-installs` runs last. Skipped for
   a generic-route batch (no intent, face or kit spec changes); the per-cell compare of step 4 is the guard there. `--goldens` forces them.
6. **suppression guard.** For every pand the batch newly hides (the covers delta) and every recipe-route pand, the #341 audit
   (`scripts/house-audit/suppressed-faces.ts`, bare-slab test included) runs on this checkout; a street-facing BAG wall of 4 m or more
   on a named street left blank (no outward geometry, or a bare slab) refuses the batch and prints pand, street and wall length. A
   wall that only stops short of the eaves (a setback or gable) passes. The command calls the audit through the `SuppressionAudit`
   interface (`publishPlan.ts`): it shells out to the script and reads `walls[]` of its JSON. It fails closed when the script is not on the branch.
7. **check:canal**, once.
8. **record.** `published/<batch>.json`, the staged files moved to `published/<batch>/`, the archive copy, and printed drafts of the HISTORY
   line and the What's New note.

### Covers per tile (`src/canalRecall/world/tileCovers.ts`)

`covers.json` used to be a global compile input, so one install rebuilt the city. It reaches the world only through each cell's
`hide` list, so it is now hashed per tile: the slice of `covers.json` that names a building of the tile (`coversHides`, the hide entries
in compile order) is hashed beside the tile's own inputs and stored in `index.json` as `tileCovers`. The ids of each tile come from
`<out>.tile-ids.json` (beside the compile directory, not in it, so publishing the directory does not carry it), keyed by the sha256 of the tile
file and reused while the file is unchanged. A first run parses the tile files (about the cost of one full load). `--against`
compares hidden lists per cell: a cell's hide list is compared when the reference's slice of every tile it lists equals ours (a
reference compiled before this change is compared on the whole-file hash as before). `world:verify` also fails on a tile whose slice moved
since the compile (`staleCovers`). Not hashed: the order of models inside `covers.json` across tiles (a reorder with no content change is not
seen; run a full compile after one). `COVERS_FILE=<path>` points the compiler at another covers file (rehearsals, measurements).

### Measured (2026-11-10, lane H3, 14-core Mac with other lanes running: load average 10 to 40 during the runs)

What `world:compile` and the gates cost before the change and after it. A 50-spec batch is the 50 canal-belt pands of tiles
8412/5384, 8413/5382 to 8413/5386 (generic route, one `bays` field each, author source), staged with `house:stage`.

| Step | Before | After |
|---|---|---|
| `world:compile` full, no shell | 46 s | same cells (0 of 604 files differ) |
| `world:compile --shell` full | 262 s | 199 s and 262 s (load 15); cells, shells and far files byte-identical to before (0 differing of 604, 564, 604) |
| a **covers.json change** (one model, 2 pands in 2 tiles), `--changed --shell` | every cell: 604 cells, a full bake (~262 s) | 2 tiles changed, 12 cells rebuilt, **19 s**; 2 cell files differ, 11 shell and 10 far files |
| a 50-spec batch, `--changed --shell` (6 tiles) | 6 tiles (spec files were already per tile) | 24 cells rebuilt, 22 cell/shell/far files differ, **33.8 s** |
| `house:publish --dry-run --compile` for the 50 specs | n/a | **37 s** end to end (merge 1.8 s + compile 33.8 s) |
| `world:verify` on that rehearsal | n/a | 8 s: 295 tiles, 350,337 buildings, 0 differing, 0 stale, 0 staleCovers |
| `build-covers` / `check:covers` | 9 s / 1 s | same |
| `test:fit-golden` / `large-mesh-hashes` / `roof-golden` / `test:block-kit-installed` / `check:stale-installs` | 5 s / 13 s / 9 s / under 1 s / 1 s | same, now with `--allow` |
| #341 audit (`suppressed-faces.ts`, 2,636 walls) | n/a | 37 s |
| `check:canal` | did not finish: stopped by hand at 25.8 min, 158 checks had passed, inside `check:rail-street` (8.5 min at 99 % CPU when load averaged 20 to 40); the brief's "about 6 min" does not hold on a loaded machine | not part of the batch timing |

Gate arithmetic: merge 2 s + write 2 s + compile 34 s + verify 8 s is about a minute for the 50-spec batch, with the goldens skipped (generic
route) and no suppression change; a recipe batch adds the installs, `build-covers` (9 s) and four goldens (under 30 s) plus the audit (37 s). The
15 min budget is met by everything except `check:canal`, which alone took more than 15 min on this machine under this load; the integrator's
timing of a batch is therefore its `check:canal` timing plus about a minute, and `--skip-check-canal "<reason>"` exists for rehearsals only.

Decoded equivalence: the `--changed` rehearsal compiled into a scratch copy of the staging directory verifies against the default tile path
(`world:verify`, `HOUSE_SPECS_DIR=staging/house-specs`) with 0 differing tiles. Two full compiles with different specs do not match byte for byte
(604 of 604 cell files differ) because the shared string table is chosen from the cells' strings; a `--changed` run keeps the earlier table, which is
why only the rebuilt cells differ in the numbers above.

What was not run end to end: step 2 onwards of a real `house:publish` (writing `public/`, the recipe route's installs, the goldens'
re-recording through the publish command, the suppression guard through the audit, `check:canal` inside the command). Each piece ran on its
own: `--allow` against a deliberately altered golden for all four scripts (inside the list re-recorded to the exact original, outside it exit 1 with nothing
written); the audit against its real JSON (219 blank street walls of 4 m or more in the existing suppressed set; the guard only looks at a batch's own pands);
the compile and the verify as above. The first real batch is the integrator's and should be a small one.

### The integrator's checklist for a batch

1. `npm run house:publish -- --dry-run --compile` and read the diff, the receipts count and the cells it rebuilds. Unstage anything unexpected (delete its file in `artifacts/house-specs/staging/`).
2. `npm run house:publish` (or `scripts/house-specs/nightly.sh`). Exit non-zero = a gate failed; the message names it, the step log is in `artifacts/house-specs/logs/`, and the working tree is as the batch left it.
3. Copy the compiled world: `for d in cells shells far; do rsync -a --delete artifacts/world/staging/$d/ public/data/extracts/amsterdam/world-v1/$d/; done; cp artifacts/world/staging/{index.json,tiles.json,strings.bin} public/data/extracts/amsterdam/world-v1/`; then `npm run world:verify` (globalFresh true, 0 stale, 0 staleCovers, 0 differing) and `npm run test:world-format`.
4. Recipe batches: rebuild covers-dependent bundles and stamps, `npm run test:canal-game-structure`, re-publish landmark cards if an extract regenerated.
5. Commit specs, the published extract, world-v1 (and houses, GLBs, catalogue, covers, goldens for a recipe batch); push the archive worktree; paste the HISTORY and What's New drafts.


## §4 Describe at scale

Stub (lanes H4, H5): `house:crops`, `house:describe`, the writers in trust order.

## §5 The kit-gap queue

Stub (lane H6): `kit-gaps.ts` aggregates `schemaLimits` by `component`; the horizon rule.
