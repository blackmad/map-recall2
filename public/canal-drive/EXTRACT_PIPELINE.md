# The city extract pipeline

How a city becomes something the game can teach, and the rules that keep the
published files describing one city rather than several.

The game never calls a third-party API while you play. Everything it needs is a
versioned extract under `public/data/extracts/<city>/`, built here.

## Running it

```bash
npm run refresh:amsterdam          # downloads Amsterdam from BBBike, rebuilds, publishes
npm run refresh:utrecht            # the same script, different arguments
bash scripts/refresh-city-extract.sh <id> <Name> <lat,lon> <BBBikeName> [local.osm.pbf]
```

Pass a local `.osm.pbf` as the fifth argument to skip the download — useful when
iterating, because the download is the slowest stage and the least interesting.

`refresh-amsterdam-extract.sh` is one `exec` into the general script. Amsterdam
gets no private path; if it did, it would drift.

Everything is built into a temporary directory and copied into
`public/data/extracts/<id>/` **only after every stage succeeds**. A transient
Wikimedia failure must not replace a working city with a half-enriched one.

## The stages

1. **Download and filter.** `osmium tags-filter` reduces the city PBF to the
   tags the game uses, then `osmium export` converts to GeoJSON. The filter list
   lives in `refresh-city-extract.sh`; adding a feature class means adding it
   both there and to `classify()`, or the extractor will look for tags that were
   filtered away.
2. **Extract.** `build-amsterdam-extract.ts` — despite the name, it takes a city
   as arguments — groups ways by name, scores them, and writes the partitions
   (`water`, `streets`, `bridges`, `squares`, `parks`, `landmarks`), the routing
   network, boundaries and orientation POIs.
3. **Appearance and trees.** `build-osm-building-appearance.ts`,
   `build-osm-trees.ts`.
4. **Enrichment.** Wikimedia images, Wikipedia ledes, the city profile, brand
   identities, then curated image overrides. All share one cached fetch
   (`scripts/lib/cached-json-fetch.ts`, cache in `.cache/`), so a re-run is
   nearly free and a transient failure is cheap.
5. **Bridge artifacts.** `build-bridge-crossings`, `build-bridge-railways`,
   `build-bridge-distractors`. **These must run in the same pass as the extract**
   — see "Bridges are a matched pair" below.
6. **Check, then publish.** `check-city-extract.ts` runs against the build
   directory; only then is anything copied into `public/`.

## Rules that are load-bearing

Each of these was learned by breaking it. They are enforced by checks, not by
memory — `npm run check:canal` runs them all.

### Connectivity is decided on raw geometry

Ways connect when they share an **identical vertex**. Proximity is deliberately
not used: joining ways that pass within ~33 m merged parallel roads and roads on
different levels.

That makes simplification dangerous. Douglas-Peucker deletes exactly the
vertices that carry connectivity — a junction node lying within the tolerance of
the line between its neighbours is dropped, and two ways that genuinely met
there stop sharing a coordinate. Measured on Amsterdam: simplifying before
connectivity destroyed 17,222 of 62,229 junction vertices and split the drivable
network into 5,624 components with 25,646 ways in the largest. Carrying geometry
raw and simplifying at publication with junctions pinned gives **99 components,
35,219 in the largest**.

So: geometry stays raw until the moment it is written, and
`simplifyPreservingJunctions` never drops a shared vertex. Coordinates are
quantised to ~11 cm first, which shrinks the largest file the game fetches and
makes vertex matching robust against float drift.

### Feature ids come from identity, never from order

`extract_${category}_${grouped.size}` made an id depend on how many features of
*any* category happened to be inserted before it, so adding one classification
renumbered every bridge in the city. Ids are a hash of the grouping key now.

This matters because other files are keyed on them. It does **not** affect
player progress: spaced-repetition review keys are the feature's name plus the
place it was answered, never its extract id.

### Bridges are a matched pair

`bridges.json` and `bridge-crossings.json` are keyed on bridge id and must be
built in the same run. Publishing `bridges.json` alone once renumbered every id
and orphaned the index — matched bridges fell from 257/300 to 28/300. Nothing
crashed, which is what made it dangerous: the runtime falls back to a synthetic
crossing with no waterway, so 229 bridges silently lost the water beneath them
and the water-before-bridge rule stopped applying city-wide.

`test:bridge-crossings` now asserts that no crossing-index entry names a bridge
that does not exist, and that most bridges resolve to a real crossing.

### A road is not a bridge

OSM tags the carried road as `name` and the structure as `bridge:name`. The
extractor prefers `bridge:name`, so Zuiderzeeweg and IJburglaan are published as
Schellingwouderbrug, Amsterdamschebrug, Zeeburgerbrug and Enneüs Heermabrug —
four structures over their own waters, rather than one question answered with a
road name.

### Coverage is pinned by name, not by count

`test:canal-car` names specific streets and junctions. Counts move for
legitimate reasons; a named street disappearing does not. This is what caught
the routing network halving, and it is the reason the driving harness cannot
replace it: **a sparser network scores *higher* in the harness**, because short
routes are easier to drive.

## The Randstad

```bash
npm run refresh:randstad     # all four, each publishing independently
```

BBBike publishes exactly four of the conurbation — Amsterdam, Rotterdam, Den
Haag and Utrecht — and those are what `refresh-randstad.sh` rebuilds. The
smaller Randstad cities (Leiden, Haarlem, Delft, Dordrecht, Almere, Amersfoort)
have no BBBike extract and would need a different source first.

Each city is independent: one failing does not stop the rest, and each publishes
only if its own build and checks pass.

A municipality is not always mapped under the name people call it — The Hague is
`'s-Gravenhage` in OSM — so the boundary lookup matches `name`, `name:nl`,
`name:en`, `official_name` or `alt_name`.

Built so far: **Amsterdam** (35,216 routing ways, 99 components) and **Utrecht**
(17,594 ways, 58 components). Rotterdam and Den Haag are wired up but have not
been run.

## Adding a city

The extractor is city-agnostic: bounds, centre, curation file, boundary-lookup
name and the `cityId` filed into review keys are all arguments, and the curation
file is optional.

What is not yet city-agnostic is the **runtime**. `osm-loader.js` hardcodes
`../data/extracts/amsterdam/${dataset}.json`, so a built city cannot be reached
from the game. See TODO item 11.

## What the checks cost

| command | what it protects |
| --- | --- |
| `npm run check:amsterdam-extract` | coverage counts and enrichment of the published city |
| `npm run test:canal-car` | named streets, junctions and bridge approaches |
| `npm run test:bridge-crossings` | per-crossing identity, and bridges/index alignment |
| `npm run test:bridge-railways` | railway lines are not asked as bridges |
| `npm run test:reachability` | the routing graph reaches what it claims to |
| `npx playwright test tests/e2e/driving-harness.spec.ts` | 120 real drives; drivability, not coverage |


## Building reconstruction workbench

### DINO proposals → fitted photo recipes (2026-09-06)

The photo lab defaults to `dino-fit-05`; `?run=dino-expansion-fit-02` shows six
additional strips, including Bloemstraat 3 and Koningsplein 12. Links retain
the previous appearance renderer and raw benchmark. The raw-box toggle overlays
original rectangles; the evidence panel explains each fit/recovery and lists
per-field colour, texture, bar and extent observations alongside unknown parts.

Acquire/cache the baseline semantic observations and DINO/SAM checkpoints using
the commands below. Retain DINO candidates at 0.20 and text threshold 0.20;
the compiler still treats 0.25 as its primary threshold. Recovery requires a real
low-score observation, aligned row and column peers, a bounded SAM mask and
supporting edges. Overlapping assemblies block recovery. Raw scores stay intact.

```bash
rtk proxy env HF_HUB_OFFLINE=1 HF_HUB_DISABLE_IMPLICIT_TOKEN=1 \
  <vision-python> scripts/facade-rebuild/benchmark-dino-sam.py \
  --input public/canal-drive/facade-photo-review/local/pilot-01 \
  --models .cache/facade-rebuild/models/catalog.json \
  --out public/canal-drive/facade-photo-review/local/<new-candidates-run> \
  --device mps --repeats 2 --box-threshold 0.20 --text-threshold 0.20
rtk proxy <vision-python> scripts/facade-rebuild/compile-dino-photo.py \
  --input public/canal-drive/facade-photo-review/local/pilot-01 \
  --benchmark public/canal-drive/facade-photo-review/local/<new-candidates-run> \
  --out public/canal-drive/facade-photo-review/local/<new-fitted-run>
rtk proxy <vision-python> scripts/facade-rebuild/check-opening-fit.py
rtk proxy npx tsx scripts/facade-rebuild/capture-fitted-photos.ts
rtk proxy <vision-python> scripts/facade-rebuild/evaluate-opening-fit.py \
  --runs public/canal-drive/facade-photo-review/local/dino-fit-05 \
         public/canal-drive/facade-photo-review/local/dino-expansion-fit-02 \
  --labels src/canalRecall/facade/fixtures/dino-sam-development.json \
           src/canalRecall/facade/fixtures/opening-fit-expansion.json \
  --out .cache/facade-rebuild/reports/<new-fit-evaluation>.json
```

`--no-fit` supplies a control with the same detector/appearance path. For new
unlabelled images, benchmark with `--all-inputs`; zero labels means accuracy is
unmeasured. `--target 'Herenstraat 40' --tile-retry` runs three overlapping crop
attempts, discards internally truncated detections and only adds proposals not
already covered by full-image detections. It never replaces a full-image box.
Observations retain source/script/model hashes; retries save new directories.

The fitter changes only listed windows, with complete-link grouping, a robust
soft loss and an image-edge gate. It does not equalise storey heights or narrow/
wide exceptions. SAM's raw masks remain separate from largest-component masks
and derived sampling masks; rejected mask evidence does not become colour.
An isolated opening with <5% support from the baseline semantic model is flagged
for review, even with a high DINO score. This is a disagreement rule, not proof
that a real unusual entrance is false. Unknown/rejected coverage stays visible.

Named checks cover the missing ground-floor window, headlight negative, door
nesting, unsupported fitting, bounds, asymmetric widths, unknown ontology fields
and appearance invalidation. The 16 original labelled frames remain matched;
Tiny finds 12/13 across two newly labelled buildings. The evaluator reports raw,
fitted and render-eligible scores separately because wall bounds/review decisions
can exclude a correct image detection. It gates count regressions and a mean
box-IoU drop larger than 0.02 per labelled case. Original per-building mean IoU
changes 0.8848→0.8802, 0.9254→0.9094, 0.9218→0.9205; new cases change
0.9443→0.9484 and 0.6965→0.6993. These small differences are not calibrated
geographic accuracy improvements. Four of the six added strips remain unlabelled.

`feature_ontology.py` separates part, attribute, value, units, evidence basis,
review state and pixel/mask references. Candidates cover opening extent/aspect,
wall/frame/opening camera colour, glazing lines and texture repeats. Opening
shape, sash/casement mechanism, door panels/colour, lintels, sills, cornices/eaves
and roof features remain unknown until separately isolated and evaluated.
Generic brick/trim used by the renderer never fills unknown evidence fields.

The larger-model comparison is at
`/canal-drive/facade-photo-review/local/dino-size-comparison-01/index.html`.
Acquire the pinned Base checkpoint with `download-vision-benchmarks.py --dino-base`
and use `--models .cache/facade-rebuild/models/catalog-base.json` in the same
benchmark command. `compare-dino-models.py --tiny <tiny-run> --base <base-run>
--out <new-comparison-directory>` scores the same labels. Base recovers the
dormer missed by Tiny and three crop retries: 13/13 versus 12/13, but at score
0.205 it remains a secondary-check/review candidate. Base's Koningsplein mean
box IoU is 0.917 versus Tiny's 0.944. Warm medians across six strips were 1.24 s
versus 0.334 s; shared-laptop timings vary, not controlled latency guarantees.
DINO-stage sampled driver memory was 5549 versus 4353 MiB; overall SAM-inclusive
runs both reached about 6214 MiB. No paid inference is needed.

### Current photo handoff runs

The [next-day workboard](TODO.md#next-day-handoff-for-sol-56--2026-09-06)
defines the implementation slice. All paths below are ignored local artifacts
under `public/canal-drive/facade-photo-review/local/`; preserve existing runs.
Open `/canal-drive/facade-photo-lab.html?run=<run>` on the local Vite server
(previously port 5187; verify it is running). The detector/reconstruction selector
preserves the source hash when that image exists in the destination run.

| Inputs | Tiny fitted | Base fitted | Day-two fitted | Optional inferred/image study |
| --- | --- | --- | --- | --- |
| `pilot-01` — H242, H219, K136 plus rejected bad source | `dino-fit-05` | `dino-base-pilot-fit-01` | `dino-base-pilot-day2-03` | `dino-base-pilot-study-02` |
| `expansion-01` — six additional strips including Bloemstraat 3 | `dino-expansion-fit-02` | `dino-base-expansion-fit-02` | `dino-base-expansion-day2-03` | `dino-tiny-expansion-study-02`, `dino-base-expansion-study-02` |

Completed detector/mask inputs are `dino-candidates-01` (Tiny pilot),
`dino-expansion-02` (Tiny expansion), `dino-base-pilot-01` and
`dino-base-expansion-01`. Check `report.json` completion and source-manifest hash
before reuse. Both catalogs/checkpoints already exist under
`.cache/facade-rebuild/models/`; Base needs no paid service.

`<vision-python>` on this machine is
`/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-building-twin/.venv-vision/bin/python`.
Use the environment and source strips read-only. To compile a new optional study
from an existing completed Base run (replace the output placeholder):

```bash
rtk proxy <vision-python> scripts/facade-rebuild/compile-dino-photo.py \
  --input public/canal-drive/facade-photo-review/local/pilot-01 \
  --benchmark public/canal-drive/facade-photo-review/local/dino-base-pilot-01 \
  --out public/canal-drive/facade-photo-review/local/<new-base-study-run> \
  --image-study --layout-hypotheses
```

`--image-study` uses source-image extent for an unplaced wall and preserves
provisional wall/ground disagreements as identity warnings. It does not establish
BAG ownership or metric registration. `--layout-hypotheses` retains measured boxes
and adds explicit inferred extents/peer references; appearance must continue to
sample only supported pixels. These flags are optional previews, not acceptance.
The day-two Base runs restore H219's garage through a separately bounded weak
peer while keeping the construction-hoarding negative out. They also separate
Bloemstraat's tall central glazing from its smaller side-window families and
retain partial source observations as non-rendered evidence. The image study can
show the left H219 column but still cannot certify its BAG ownership.

Reproduce the source-coverage, four-case evaluation and capture artifacts with:

```bash
rtk proxy npx tsx scripts/facade-rebuild/build-source-coverage.ts \
  --input=public/canal-drive/facade-photo-review/local/pilot-01/manifest.json \
  --out=.cache/facade-rebuild/reports/<new-source-coverage-directory>
rtk proxy <vision-python> scripts/facade-rebuild/evaluate-opening-fit.py \
  --runs public/canal-drive/facade-photo-review/local/dino-base-pilot-day2-03 \
         public/canal-drive/facade-photo-review/local/dino-base-expansion-day2-03 \
  --labels src/canalRecall/facade/fixtures/opening-day2-development.json \
  --out .cache/facade-rebuild/reports/<new-four-case-evaluation>.json
FACADE_BASE_URL=http://127.0.0.1:5187 \
  rtk proxy npx tsx scripts/facade-rebuild/capture-fitted-photos.ts
```

The checked artifacts from this slice are
`.cache/facade-rebuild/reports/day2-four-case-evaluation-02.json`,
`.cache/facade-rebuild/reports/source-coverage-day2-02/report.json` and
`.cache/facade-rebuild/reports/fitted-photos-2026-09-06T18-27-14.985Z/manifest.json`.
Use `/canal-drive/facade-photo-lab.html?run=dino-base-pilot-day2-03` and
`/canal-drive/facade-photo-lab.html?run=dino-base-expansion-day2-03` for review.
The H219 full-source diagnostic contains its gable, but horizontal wall ownership
is unresolved. H242 exposes souterrain evidence, while its published camera pose
is 6.23 m above 3DBAG ground and is rejected as a vertical-registration outlier.
No roof geometry was compiled from either diagnostic.
Keep source photographs in ignored caches under source policies.

### City-generated photo test strips

`build-panorama-test-strips.ts` creates a broader development set directly from
the cached Amsterdam registry, 3DBAG massing and municipal full-panorama catalog.
It selects without detector output or cross-view image agreement, and records the
exact camera pose, BAG wall, source/rectified hashes, sampling estimate and source
URL. The crop spans ground−1.2 m through ridge+1.0 m so roof and souterrain
coverage are present when the pose supports them. Selection balances construction
era, roof form, frontage width, height and use, then requires bounded standoff,
obliquity, line-of-sight obstruction, source resolution and camera height.

Metadata-qualified samples still admitted wrong walls, compound footprints and
fully occluded targets. Eleven failed predecessors and their exact reasons remain
in `src/canalRecall/facade/fixtures/panorama-variety-development.json`.
`city-variety-07` is the reviewed 12-strip set: ten wall-registered development
sources and two explicit compound-footprint ownership diagnostics. It includes
shopfronts, a wide garage wall, balconies, sparse cladding, dense arched glazing,
roof-visible facades, partial visibility and light-to-severe occlusion.

Raw-panorama registration review is mandatory before opening measurement. The
context builder projects the selected wall in green, the footprint at ground in
blue, the footprint at ridge in magenta and the 3DBAG eaves candidate in yellow.
Review the raw overlay beside its rectified strip; a plausible rectified image
does not establish that the crop belongs to the selected wall.

```bash
rtk proxy npx tsx scripts/facade-rebuild/build-panorama-test-strips.ts \
  --count=12 \
  --exclude-pand=<comma-separated rejected BAG ids> \
  --out=public/canal-drive/facade-photo-review/local/<new-source-run>
rtk proxy npx tsx scripts/facade-rebuild/build-panorama-registration-context.ts \
  --input=public/canal-drive/facade-photo-review/local/<new-source-run> \
  --out=.cache/facade-rebuild/reports/<new-registration-review>
rtk proxy npm run test:panorama-variety-review
rtk proxy env HF_HUB_OFFLINE=1 HF_HUB_DISABLE_IMPLICIT_TOKEN=1 \
  <vision-python> scripts/facade-rebuild/benchmark-dino-sam.py \
  --input public/canal-drive/facade-photo-review/local/city-variety-07 \
  --review src/canalRecall/facade/fixtures/panorama-variety-development.json \
  --models .cache/facade-rebuild/models/catalog-base.json \
  --out public/canal-drive/facade-photo-review/local/<new-variety-benchmark> \
  --device mps --repeats 1 --box-threshold 0.20 --text-threshold 0.20 --all-inputs
```

The completed `dino-base-city-variety-04` run contains 117 Base DINO proposals
and 117 cleaned SAM masks across the ten usable sources; two masks are flagged
for review. The runner verifies the fixture and manifest hashes, requires every
source to have a disposition, and excludes `diagnostic-only` by default. Pass
`--include-diagnostic` only for a separate ownership-diagnostic run. There are no
opening labels for this set yet, so these counts describe workload and failure
variety rather than recall, precision or accuracy. Do not use it to tune a rule
and then call the same images held-out evidence.

The reviewed strips can be converted into photo-compiler inputs without turning
their geometric wall envelope into semantic agreement:

```bash
rtk proxy <vision-python> scripts/facade-rebuild/prepare-panorama-photo-run.py \
  --input public/canal-drive/facade-photo-review/local/city-variety-07 \
  --review src/canalRecall/facade/fixtures/panorama-variety-development.json \
  --out public/canal-drive/facade-photo-review/local/<new-photo-seed>
rtk proxy <vision-python> scripts/facade-rebuild/compile-dino-photo.py \
  --input public/canal-drive/facade-photo-review/local/<new-photo-seed> \
  --benchmark public/canal-drive/facade-photo-review/local/dino-base-city-variety-04 \
  --out public/canal-drive/facade-photo-review/local/<new-photo-run> \
  --layout-hypotheses --grid-completion
rtk proxy npm run summarize:panorama-variety-photo
rtk proxy npm run capture:panorama-variety-photo
```

`city-variety-photo-seed-01` and the current `dino-base-city-variety-grid-03`
output yield six renderable sources and four abstentions from 117 detections.
Forty family-fit
adjustments were attempted and 15 applied; all 58 semantic checks abstain because
no independent per-pixel semantic mask exists. The registered wall envelope may
bound appearance sampling, but its wall colour and material remain inferred,
needs-review candidates because foreground and opening pixels can contaminate it.

For the labelled expansion examples, the mixed approach is reproducible as:

```bash
rtk proxy <vision-python> scripts/facade-rebuild/compile-dino-photo.py \
  --input public/canal-drive/facade-photo-review/local/expansion-01 \
  --benchmark public/canal-drive/facade-photo-review/local/dino-base-expansion-01 \
  --out public/canal-drive/facade-photo-review/local/<new-expansion-run> \
  --image-study --layout-hypotheses --grid-completion
rtk proxy <vision-python> scripts/facade-rebuild/compare-opening-approaches.py \
  --context-run public/canal-drive/facade-photo-review/local/dino-base-expansion-day2-03 \
  --ensemble-run public/canal-drive/facade-photo-review/local/dino-base-expansion-ensemble-01 \
  --final-run public/canal-drive/facade-photo-review/local/<new-expansion-run> \
  --labels src/canalRecall/facade/fixtures/dino-sam-development.json \
           src/canalRecall/facade/fixtures/opening-day2-development.json \
           src/canalRecall/facade/fixtures/opening-fit-expansion.json \
  --out .cache/facade-rebuild/reports/<new-approach-report>
FACADE_BASE_URL=http://127.0.0.1:3000 rtk proxy npm run capture:expansion-inference
rtk proxy npm run critique:facade-openings -- \
  --panels=.cache/facade-rebuild/reports/<opening-panels> \
  --out=.cache/facade-rebuild/reports/<new-critic-report> \
  --models=qwen2.5vl:7b,gemma3:4b
```

`dino-base-expansion-grid-03` adds only one empty-grid proposal, Bloemstraat
`grid-1`, and keeps it inferred with no detector, mask, colour or frame-detail
evidence. Herenstraat `dino-7` is a measured roof candidate recovered only when
DINO, its bounded SAM component, all four classical rectangle edges and at least
two lower facade windows agree. The staged comparison is in
`.cache/facade-rebuild/reports/opening-approach-comparison-03/`; labelled
Herenstraat recall reaches 4/4 at the roof-context stage, while Bloemstraat stays
21/21 and its explicit negative has zero render hits. The local multimodal critic
stores raw and schema-validated output, normalizes scores, rejects invented IDs
and never changes a run automatically.

### Local Grounding DINO / SAM benchmark (2026-09-06)

Open `/canal-drive/facade-photo-review/local/dino-sam-mps-03/index.html` for
the baseline, DINO boxes, SAM masks prompted by DINO, and SAM masks prompted by
reference rectangles. The photo lab links to this ignored local run. These are
development image measurements; no building registration or recipe is accepted.

The benchmark uses Grounding DINO Tiny and SAM 2.1 Hiera Tiny with pinned official
Hugging Face revisions. Acquisition is separate; inference never uploads images.
The current sibling `.venv-vision` supplies torch 2.14.0, transformers 5.15.1,
numpy, Pillow, scipy and OpenCV. Apple MPS runs both at float32 without custom
CUDA kernels. SAM's image model loads with no missing/unexpected/mismatched
weights despite the checkpoint's generic `sam2_video` configuration warning.

```bash
rtk proxy <vision-python> scripts/facade-rebuild/download-vision-benchmarks.py
rtk proxy env HF_HUB_OFFLINE=1 HF_HUB_DISABLE_IMPLICIT_TOKEN=1 \
  <vision-python> scripts/facade-rebuild/benchmark-dino-sam.py \
  --input public/canal-drive/facade-photo-review/local/pilot-01 \
  --models .cache/facade-rebuild/models/catalog.json \
  --out public/canal-drive/facade-photo-review/local/<new-benchmark-run> \
  --device mps --repeats 3 --box-threshold 0.25
```

On the M4 Pro / 48 GiB, warm mean inference including preprocessing and
postprocessing was 0.290 s/strip for DINO and 0.135 s/strip for SAM with 5–12
box prompts. The initial cold run took 4.10 s and 2.16 s respectively. Highest
sampled MPS driver allocation was 3328 MiB; process peak RSS was 1492 MiB in
the final run. Unified memory accounting overlaps: do not add these figures.
Driver samples include caches and do not establish exact peak GPU memory.

Sixteen approximately labelled outer frames across three already-seen strips
match at box IoU ≥0.5: baseline 9/16; DINO 16/16; raw SAM+DINO 13/16;
largest-component SAM+DINO 16/16. DINO's per-building mean box IoU is
0.887 / 0.917 / 0.923. Its threshold was tuned from 0.30 (13/16) to 0.25 on
these same development images. Unlabelled proposals are not evaluated as false
positives; this is not 100% precision or held-out accuracy. The named headlight
negative disappears. Pixel-mask ground truth is absent, so mask accuracy remains
unmeasured. SAM can produce remote fragments or connected leaks despite high
predicted scores; raw masks, cleaned derivatives and outside-prompt review flags
are preserved separately. Even reference prompts leave one frame below IoU .5.

`report.json` records source/label/script/weight hashes, model revisions,
per-repeat timing, raw proposals, masks and evaluations. The partial failed
`dino-sam-mps-02` export is not a completed result. This original benchmark is
retained as the pre-integration comparison; the DINO → fit → appearance workflow
above now supplies the photo lab's renderer.

### Photo extraction and correction pilot (2026-09-06)

Open `/canal-drive/facade-photo-lab.html` on the development server. The default
local run is now `dino-fit-05`; `?run=appearance-03` selects this earlier appearance
stage, and `?run=<directory-name>` selects another immutable run.
The original segmentation/correction demo is available with `?run=pilot-01`.
Keizersgracht 136 has a **Load saved correction example** button. Reset restores
the raw detections. The mask toggle and opening table expose the evidence;
pixel edits, omission and visible-region controls rebuild the preview. Export
includes the observation, correction log, recipe and mesh. Import accepts only
pixel corrections/visible rows tied to the same image and extraction hashes.

The first pilot has three real source strips (Herengracht 242, Herengracht 219,
Keizersgracht 136) and rejects the supplied Prinsengracht 285 missing-height
case. All matching/registration remains unreviewed. The mesh is an isolated
wall study, with no real-building aliases, georeferenced placement or inferred
roof. The lower edge of a reviewed crop is a display origin, not measured NAP.
The strip mapping accounts for 1.06 horizontal margin and the generator's
ground−0.8/top+0.5 extent; manifest rounding limits its precision.

Use a Python environment with numpy, Pillow, scipy and onnxruntime. The sibling
worktree's `.venv-vision/bin/python` currently provides these. Supply a local
Roboflow model-cache directory containing `weights.onnx`, `class_names.txt`
and `inference_config.json`; this command never downloads a model or uploads
images. The runner pins the actual weight hash, RGB normalization and model
metadata for the `amsterdam-facade/2` development baseline. Its project page
lists CC BY 4.0: <https://universe.roboflow.com/cmp-zosci/amsterdam-facade>.

```bash
rtk proxy <vision-python> scripts/facade-rebuild/extract-strip-features.py \
  --strips <building-twin-worktree>/.cache/facade-twin/strips-confident \
  --model-dir <local-model-cache-directory> \
  --files Herengracht-242__0363100012164991__2023-03-06.jpg \
          Herengracht-219__0363100012167629__2021-01-22.jpg \
          Keizersgracht-136__0363100012165026__2021-01-22.jpg \
          Prinsengracht-285__0363100012164996__2025-01-20.jpg \
  --out public/canal-drive/facade-photo-review/local/<new-run-name>
rtk proxy node scripts/build-3d-bundles.mjs
rtk npm run test:facade-photo-recipe
rtk proxy npx tsx scripts/facade-rebuild/capture-photo-pilot.ts
```

The capture script expects `pilot-01` and a server on port 5187 (override
`FACADE_BASE_URL`). It pins Keizersgracht 136's source bytes and demonstrates
explicit development corrections, saving before/mask/after renders, exported
evidence and a report under `.cache/facade-rebuild/reports/photo-pilot-<run>/`.
It also makes that correction example available beside the immutable raw run.
The script is not an automated critic and makes no held-out accuracy claim.

Raw semantic masks remain separate from local component grouping and edited
boxes. Grouping does not populate an invented grid. Tall merged windows and a
car false positive remain in the raw results, visibly correctable. Mask fill is
not confidence. Wall colour is camera RGB in an eroded building mask with
brightness trimming; it can still include shadows/occluders and is not intrinsic
surface colour. The photo compiler check joins `check:facade-rebuild` and hence
`check:canal`; model execution stays separate and offline. Photo browser tests
explicitly skip if the ignored local image run is absent.

For authored texture/window/trim experiments, open `facade-recipe-lab.html`.
It supports procedural running bond and the original CC0 ambientCG Bricks057
colour map at 1.05 m repeat, plus plain/sash/cross windows and cornice/gable trim.
Those switches are display choices, not extracted feature evidence.

The appearance stage reuses the cached semantic mask rather than running another
model. It refines boxes with image edges / supported gaps, proposes a detail
region from repeated openings, samples separate wall patches and per-window
frame/glass colours, and stores bright/dark line candidates for glazing bars.
The renderer batches per-opening colours and bars in the same merged surface
draws. Source patch selection and individual bar omission are versioned edits;
moving a box invalidates its old appearance measurements. Source and render now
share scale and vertical position in the orthographic comparison.

```bash
rtk proxy <vision-python> scripts/facade-rebuild/analyse-photo-appearance.py \
  --input public/canal-drive/facade-photo-review/local/pilot-01 \
  --out public/canal-drive/facade-photo-review/local/<new-appearance-run>
rtk proxy <vision-python> scripts/facade-rebuild/evaluate-photo-appearance.py \
  --before public/canal-drive/facade-photo-review/local/pilot-01 \
  --after public/canal-drive/facade-photo-review/local/appearance-03 \
  --out .cache/facade-rebuild/reports/appearance-03-evaluation.json
```

This stage additionally requires OpenCV. It hashes the input manifest, analyser
and source/mask bytes. Texture analysis records horizontal-repeat candidates in
specific source patches; the material family is inferred. Generic running bond,
brick dimensions, mortar variation and roughness are not recovered from these
small images. Dark-bar colours can differ from pale outer frames. Sash/casement
mechanisms remain unknown, and line candidates can be individually rejected.

The pinned **development** labels cover two Keizersgracht 136 window rectangles,
a headlight negative, two lit wall patches and bars in two windows. In the
current run, rectangle matches at IoU 0.5 improve 0/2 → 2/2, the merged-storey
and headlight proposals each go 1 → 0, and camera-colour ΔE76 to those labelled
patches goes 49.07 → 8.10. Bar candidates score 3 true positives / 1 false
positive / 0 misses across the two labelled windows. These narrow results do
not certify the entire facade, registration, reflectance or generalisation.
Remaining unequal window boxes require shared-parameter fitting before styling.

The current scope, audit and delivery gates are in
[`AMSTERDAM_FACADE_REBUILD_PLAN.md`](../../AMSTERDAM_FACADE_REBUILD_PLAN.md).
The commands below exist today; none implements the proposed complete iteration
loop. Run selected tools, not this entire section as one pipeline.

### Identity and registration

```sh
rtk npm run check:facade-rebuild       # offline trust, dimensions, coordinates and quarantine
rtk npm run build:facade-registration-browser
rtk proxy npx playwright test tests/e2e/facade-rebuild.spec.ts tests/e2e/complete-city.spec.ts --project=desktop
```

These check code/fixture structure, not real-world registration acceptance.
Raw allowlisted inputs and their hash manifest live in
`.cache/facade-rebuild/raw/v1/`; `rtk npm run facade-cache:migrate` depends on
an available source cache and is not necessary when the local cache exists.

`rtk npm run build:facade-registration-review` fetches current BAG identities
and writes `public/canal-drive/facade-registration-review/local/fixtures.json`.
The builder hashes the original panorama bytes and BAG identity, preserves
review history, and backs up the previous fixture export before rebuilding.
It currently attaches a panorama only to Herengracht 270. Start the game server
with `rtk npm run dev` (or `rtk proxy env PORT=5187 npm run dev` when port 3000
is occupied), then open `/canal-drive/facade-registration-review/index.html`.
Local imagery/reviews remain ignored; stage only permitted structured evidence.

The desk imports/exports schema-v2 review JSON. Acceptance binds to source
bytes/schema, identity, footprint/wall, pose/model, source quad and anchors.
The latest explicit decision wins; later rejection/uncertainty and changed
observations revoke approval. Older browser drafts merge decisions onto current
source data. A review of identity is separate from metric registration: pixel
marks alone supply no world coordinates, residuals or certified measurement.

`rtk npm run build:facade-external-identity-review` is optional network
acquisition. It writes attributed Commons candidates and advisory assessment
JSON into the ignored local directory; it does not approve registration.
`test:facade-external-identity` is included in the offline aggregate. Licenses
must match the explicit allowlist exactly. Assessments cite the current
observation and image hashes, distinct titles/files/originals, reviewer/time
and visible correspondences. Two files do not establish independent identity.
The committed assessments remain empty; discovery is not acceptance.

Six legacy consumers now fail with `QUARANTINED_STREET_INPUT` before cache,
model or export work: `facade-twin/measure-facades`, `facade-twin/build-block`,
`extract-facade-grammar-openrouter`, `build-facade-distillation-dataset`,
`build-facade-block-demo`, and `measure-facade-grammar-agreement`. Their formats
have no version-bound registration certificate, including when copied to a
new path. Raw-source camera/rectification diagnostics remain available; their
outputs cannot be passed off as certified measurements.

Massing adapters use `surface-heights-v2`: legacy `b3_h_dak_50p` and
`b3_h_dak_max` retain roof-surface names, `b3_h_nok` retains modelled-ridge
meaning, and eaves stay unknown without wall/roof boundary evidence. See the
[3DBAG attributes](https://docs.3dbag.nl/en/schema/attributes/) and
[layers](https://docs.3dbag.nl/en/schema/layers/). Unversioned cached adapter
heights are stale and must be re-adapted from raw records. Rectangle extents
remain available for fallback massing. Façade width comes from an explicitly
selected elevation reconstructed from the same registry footprint.

### Existing geometry and optional roof diagnostics

The published city index is
`public/data/extracts/amsterdam/building-tiles/index-z14.json`.
`rtk npm run test:building-ladder`, `rtk npm run test:building-composition`,
`rtk npm run test:pyramidal-roof` and `rtk npm run test:building-paint-inherit`
cover existing ownership/roof behaviours. `/canal-drive/building-compare.html`
now sends its initial camera update after attaching the streamer. Previously
it stayed at zero tiles until a camera gesture. The browser regression requires
resident tiles without any gesture.

To capture the Waag comparison and a seeded car-route spawn through a running
project server:

```sh
rtk npm run capture:facade-baseline -- --base-url=http://127.0.0.1:5187
```

This writes two PNGs and a manifest into a new ignored
`.cache/facade-rebuild/reports/baseline-<run>/` directory. The manifest pins the
city index, relevant browser bundles, viewport, camera, resident counts and
page errors. It does not measure hardware frame time or certify unique buildings.
The initial repaired comparison loaded 16 tiles / 63,765 features; the gameplay
spawn loaded 12 tiles / 42,028 features with 1,361 source features queryable and
the basemap extrusion hidden. Both initial captures had zero page errors. The later seeded car capture at
Kattenburgerstraat loaded 9 tiles / 37,827 features (583 queryable source features),
also with zero page errors; its manifest and PNGs are in
`.cache/facade-rebuild/reports/baseline-2026-09-05T11-21-14-296Z/`.

Roof observations use `.cache/roof-enrichment/`; `build:roof-observations`
accepts `--limit=500`, and `build:roof-review` writes a local review page.
These are optional experiments, not a blocker for façade geometry.

The RGB city demo can be rebuilt from the existing staged 3DBAG inventory:

```sh
rtk npm run select:rgb-city-demo -- --input=.cache/3dbag-appearance/amsterdam-buildings.staging.geojson
rtk npm run cache:building-surfaces -- --root=.cache/rgb-city-demo/panorama --building-ids=.cache/rgb-city-demo/building-ids.json --limit=20
rtk npm run measure:roof-planes -- --root=.cache/rgb-city-demo
rtk npm run cache:roof-point-cloud -- --root=.cache/rgb-city-demo --limit=20 --resolution=20cm
rtk npm run measure:roof-point-cloud -- --root=.cache/rgb-city-demo --resolution=20cm
rtk npm run build:rgb-city-demo -- --root=.cache/rgb-city-demo --coverage=.cache/3dbag-appearance/amsterdam-coverage.json
rtk npm run test:rgb-city-demo
```

This requires the named input inventory and can acquire substantial imagery/
point-cloud data. `/canal-drive/rgb-city-demo.html` displays machine proposals.
The historical 20-building experiment had 71/143 roof planes passing its
cross-source gate; those were not human-accepted colours. The photogrammetric
DSM is roof evidence, not a source of vertical façade colour. Neither these
results nor model agreement should be treated as independent ground truth.
