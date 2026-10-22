# DeepSeek modeling lanes: landmarks and mid-tier buildings

Written 2026-10-19. This replaces `docs/archive/landmark-deepseek-handoff.md`, which
covered one building (Muiderpoort, since done) and predates the inventory
gate, the likeness gate and the z-fight gate.

This doc has two readers:

- **Part A, the operator** (a person or the integrating Claude session):
  how to set up, launch, watch and merge a DeepSeek lane.
- **Part B, the lane** (DeepSeek running inside one worktree): the rules,
  the work menu, the recipe for each track, and what to hand back.

Part C has copy-paste prompts, one per track.

---

## Part A: operator

### A1. What a lane is

One lane = one DeepSeek session, one git worktree, one branch, one dev-server
port, one bounded task (one building, or one small batch of named buildings).
The lane commits to its own branch and returns a commit SHA and a report. It
never merges, never pushes `main`, and never edits the integrator's files (see
B2).

Run at most **4 lanes that use a browser** at a time on this machine. Check
`uptime` first; if load is above ~30, wait.

### A2. Set up a lane worktree

Use `/usr/bin/git` everywhere. The zsh `git` wrapper is broken in tool shells.

```sh
cd /Users/blackmad/Code/map-recall2-worktrees/integrator
/usr/bin/git fetch origin
LANE=ds-<short-name>-20261019           # e.g. ds-oba-osdorp-20261019
/usr/bin/git worktree add -b lane/$LANE ../$LANE origin/main
cd ../$LANE
ln -s /Users/blackmad/Code/map-recall2/node_modules node_modules
[ -e .cache ] || ln -s /Users/blackmad/Code/map-recall2/.cache .cache
```

Give each lane a unique port from **4450–4499**. Write it in the prompt.

### A3. Launch

Run opencode **from inside the lane worktree**. The opencode MCP server runs
with its working directory in the main checkout, and
`~/.config/opencode/opencode.jsonc` sets `external_directory: ask`, so an MCP
job aimed at another directory can be auto-rejected.

```sh
cd /Users/blackmad/Code/map-recall2-worktrees/$LANE
nohup opencode run --auto -m opencode-go/deepseek-v4.1-flash \
  --title "$LANE" --format json \
  "$(cat /path/to/prompt.txt)" > artifacts/$LANE.log 2> artifacts/$LANE.err &
```

**Use Flash, not Pro.** The user's instruction on 2026-10-20: lanes run on
`opencode-go/deepseek-v4.1-flash` only. Pro burned the opencode-go plan limit
mid-run on 2026-10-19 and stopped every lane at once. Flash also accepts image
input (verified 2026-10-20), so it can run Track L; Pro cannot view images at all.

- `--auto` is required. Without it the lane stops on a permission prompt that
  has no TTY to draw it.
- Paste a prompt from Part C into `prompt.txt` and fill in its blanks.

### A4. Watch it (read this before deciding a lane is hung)

`opencode run` buffers stdout when you redirect it to a file. **A zero-byte
log means the lane is working.** The whole reply arrives when the process
exits.

Judge liveness by CPU, never by log size:

```sh
ps -eo pid,pcpu,etime,command | grep "opencode run" | grep -v grep
```

Look at `/usr/bin/git -C ../$LANE log --oneline origin/main..` to see its
commits as they land.

If the log or stderr says **"Go usage limit exceeded"**, the opencode-go plan
has hit its cap; every lane on the same plan stops at the same moment (this
happened to four Pro lanes at 21:32 on 2026-10-19). Don't wait for it. Relaunch
the worktree on Flash with the same prompt plus "continue from the existing
commits", or hand it to a Claude lane if Flash is also capped.

**Shell calls inside a lane.** The shell tool's default timeout is 120 s, which
is shorter than a survey, a build or a sheet run. Pass `timeout: 1800000`
explicitly for those, and never use `background: true` plus polling: the lane
can end its turn while waiting and lose the session (observed 2026-10-19).

### A5. Merge (integrator only)

When a lane reports done:

1. Read the report. Check that each claim has evidence: the file paths
   exist, the numbers match what you get when you re-run `audit:glb`, and the
   sheets exist.
2. **Look at the sheets yourself, at gallery size, from all four sides.**
   That means the per-wall `review:sheet` including its IN GAME column, and the
   inventory column for landmarks. Gates passing is not acceptance. If the
   lane says its model cannot view images, this visual review is entirely
   yours.
3. Merge into your integrator worktree with a normal `/usr/bin/git merge
   --no-ff lane/<name>`.
4. Integrator-owned rebuilds after any model install:
   - `npx tsx scripts/build-covers.ts`, then copy
     `artifacts/bag-tiles/covers.json` to `public/canal-drive/models/covers.json`
     and run `npm run check:covers`.
   - `npm run build:canal-signature-landmarks` (signature bundle) if the
     lane touched `suppressOsmIds` or `materialOverrides`.
   - `npm run build:landmark-lods` / `npm run check:landmark-lods` for a new
     or changed landmark GLB.
   - For mid-tier installs that change goldens: `npm run check:stale-installs`
     must stay at 0.
5. `npm run check:canal`, then push `main`, then check the CI result. A red
   CI silently skips the deploy.
6. Update `TODO.md` and `HISTORY.md` in the same change. HISTORY records which
   sheets you viewed, which faces are inferred, the inventory outcome and the
   gate results.
7. Archive sources. From the lane worktree, run
   `python3 scripts/landmarks/archive-model-sources.py --only <id> --verify --destination /Users/blackmad/Code/map-recall2-worktrees/source-archive`.
   Then commit and push that worktree. Gzip any file over 95 MB first.
8. Stop the lane's dev server by its port's PID, then remove the worktree.

---

## Part B: the lane (DeepSeek, read all of this)

### B1. Non-negotiable rules

1. **Work only in your worktree** (the directory you were started in). Never
   `cd` into another worktree or into `/Users/blackmad/Code/map-recall2`.
2. **Use `/usr/bin/git`**, never bare `git`.
3. **Never push, never merge, never touch `main`.** Commit to your branch only.
   No `git reset --hard`, `git stash`, `git clean`, `git checkout -- .` or
   force operations.
4. **Dev server:** start it with
   `(PORT=<your port> nohup npx tsx server.ts > artifacts/server.log 2>&1 &)`.
   Stop it with `kill $(lsof -t -iTCP:<your port> -sTCP:LISTEN)`. **Never**
   use `pkill`, `killall` or a pattern kill, because other lanes' servers
   match the same pattern.
5. **Browser runs go through the shared lock**: `bash /tmp/canal-pw.sh <command>`.
   This applies to Playwright, `review:sheet` without `--no-game`, and any
   headless Chrome. Use `--workers=1`. Run one heavy node job at a time. If
   `/tmp/canal-pw.sh` is missing, stop and report; do not write your own.
6. **Open data only.** Use Amsterdam panoramas (CC BY 4.0), BAG, 3DBAG,
   AHN, BGT, the RCE monument register, the Stadsarchief Beeldbank (rights
   per record), OSM, and Wikipedia/Wikimedia Commons (licence recorded).
   **Never** use Google or Apple imagery, Street View, Earth or 3D tiles.
   Never copy a third-party mesh or put photo textures on a model.
7. **Never describe a building from memory.** Every feature you model must
   come from a photo or a source you cite (URL or panorama id). If you could
   not see it, it is `inferred` and you say so.
8. **Never weaken a check.** Do not raise a baseline, loosen a threshold, add
   to an allowlist to get green, or set `LANDMARK_INVENTORY_GATE=warn` in
   anything you commit. If a gate fails and you cannot fix the model, say so
   in the report.
9. **Uncertainty is a hold, not a pass.** Anything you list as uncertain
   blocks the install. Report it plainly. Do not ship it "for now".
10. **Can you actually see images?** Before step 1, open one photo with your
    file-reading tool and describe it in one sentence. If your tooling cannot
    show you image content, write **"VISUAL REVIEW: NOT DONE (model cannot
    view images)"** at the top of your report. In that case, do only work
    whose acceptance rests on measured numbers (Track Z, and Track M with
    `measure.ts`), and never claim something "matches the photo".
    Flash can read images; Pro could not (2026-10-19). Track L is Flash-only.
11. **Stop when the task is done.** One building or one batch. Do not drift
    into unrelated fixes, refactors or other buildings.

### B2. Files you must NOT edit (the integrator owns them)

- `public/canal-drive/TODO.md`, `public/canal-drive/HISTORY.md`
- `package.json`, `package-lock.json`, any lockfile
- `public/canal-drive/game.js`, `public/canal-drive/index.html`
- Generated browser bundles: `public/canal-drive/js/*.bundle.js`
- `public/canal-drive/models/covers.json`
- Baselines and goldens, unless the task says to lower one entry after a
  fix: `scripts/landmarks/geometry-audit-baseline.json`,
  `scripts/building-recipes/fit-golden.json`, `large-mesh-golden.json`

If a check needs one of these regenerated, write the exact command in your
report and leave it to the integrator.

**Files you may edit**:

- Your own new builder, spec, footprint, brief and inventory files under
  `scripts/landmarks/`.
- Your houses under `scripts/building-recipes/houses/<id>/`.
- The kit modules your task needs (`src/canalRecall/blockBuilding/`,
  `src/canalRecall/landmarks/`, `scripts/landmarks/*` helpers), each with a
  test.
- Your entry in `src/canalRecall/landmarks/manualCatalogue.json`.
- One dispatcher line in `scripts/landmarks/build-manual-landmarks.ts`.
- The model outputs the build script writes for your id (GLB, lod1,
  `signature-landmarks.json`, `model-dates.json`, `modelAssetVersions.json`).

### B3. Orient (10 minutes, then start)

Read these, in this order, and only these:

1. `CLAUDE.md` (product principles, verification rules).
2. This doc.
3. For Track L: `docs/buildings-pipeline.md`, the sections "Bespoke
   landmark lane" and "Acceptance checklist", then
   `docs/landmark-building-recipe.md` §2–§7.
4. For Track M: `docs/buildings-pipeline.md` "Large tier", all subsections
   to "Known gaps".
5. One or two existing examples for your track (named in Part C). **Do not
   read every builder.** There are 300+.

Before you start, confirm the task is still open. Someone may already have
done it:

```sh
/usr/bin/git log --oneline origin/main -i --grep "<building name>" | head
grep -n "<id or pand>" src/canalRecall/landmarks/manualCatalogue.json | head
ls scripts/landmarks/ | grep -i "<id>"; ls scripts/building-recipes/houses | grep -i "<id>"
```

If it is already modeled, stop and report the overlap. Do not build a second
model on the same ground. `modelOverlap.test.ts` fails when two models cover
the same pand.

### B4. The work menu

Three tracks, ordered by how well each fits a lane that works mainly from
numbers. The operator assigns you **one** item.

#### Track Z: fix z-fighting in existing landmark builders (numeric, best fit)

What z-fighting is: two faces of different parts lie in the same plane (or
within 2–3 cm of it), so they flicker in the game. The survey is
`docs/zfight-survey-2026-10-17.md`: 247 of 351 landmarks are over the 0.5 m²
gate for new exports.

Assignable items:

- **Z1, shared helpers (do this first; one lane only).** Find the shared
  builder helpers in `scripts/landmarks/` (e.g. `cultural-builders.ts`,
  `house-geometry.ts`, `venue-builders.ts`, window/band/panel helpers) that
  place panels, bands, frames or roof glazing 2–3 cm proud of a wall or
  flush on it. Change them to stand ≥ 6 cm off (≥ 10 cm for roof sheets), cut
  a hole and inset, or merge the two faces into one face with a material
  split. Re-export every model that uses them, then re-survey. This should
  clear most of the 20–500 m² band.
- **Z2, the worst models by hand, one per lane, after Z1 has merged**:
  `bercylaan-801-855`, `jacob-bontiusplaats-9`, `jodenbreestraat-11`,
  `valley`, `frascati` (frascati's problem is a doubled brick wall face).
  Then down the survey table: `klimmuur-centraal`,
  `shell-technology-centre`, `academie-theater-dans`,
  `willem-de-zwijgerlaan-350`, `pllek`…

Done means: `zfight-m2` + `zfight-tight-m2` for the model is ≤ 0.5 m², or
lower than before with every remaining patch explained. The model must not
change visibly otherwise; compare before/after renders.

#### Track M: mid-tier (`kind: "large"` recipes), schools, libraries, civic, campus

These are grid-fronted buildings (modern blocks, schools, offices, halls,
libraries) built on the 3DBAG LoD2.2 shell, with a facade system per wall
group. The budget is ≤ 12k triangles. The candidates are listed in
`public/canal-drive/landmark-backlog.json` with `treatment: "review"` and a
"Large-tier recipe candidate" note. The source lists are
`scripts/landmarks/{libraries,schools,civic-offices,hospitals,police-stations}.json`.

Open items (as of 2026-10-19; verify with B3):

- **Libraries without a house yet**: OBA Osdorp, Banne, Buitenveldert, IJburg,
  Molenwijk, Ganzenhoef, Geuzenveld, Postjesweg, Reigersbos, Bijlmerplein, De
  Hallen, Next. Several have no usable panorama wall. If yours has none,
  report that and stop.
- **Schools**: Hogeschool van Amsterdam, Gerrit Rietveld Academie (needs a
  dimpled-metal skin and a perforated white screen component), Het 4e
  Gymnasium, Cygnus, Barlaeus, Vossius, Montessori Lyceum Amsterdam, the UvA
  Spui building; CREA (pand 0363100012164972).
- **Civic**: Stadsloket Centrum, Stadsloket Zuid (only once its pand is in the
  building tiles).
- **Re-fits listed on the board** (`TODO.md`, "P0 Large tier: the
  photo-likeness plan"): verify the 11 "re-fit cheap" verdicts; re-fit Metis
  and Oostpoort Montessori after the new measurement limits.
- **Held ordinary blocks (block kit, `category: "ordinary"` in
  `manualCatalogue.json`)**:
  - Haparandaweg 746–786: the photo shows a flat stone-framed grid with
    recessed glass balconies; the model has deep slab balconies.
  - Haparandaweg 952–1002: the windows read as a random patchwork; they
    should be a regular grid.
  - Haparandaweg 65, 650–706, 708–744 and 788–868: drafts that have never
    been reviewed. Compare each one against its photo, then fix it or
    recommend that it be deleted.
- **Blocked; do not assign**: AMC, VUmc, Antoni van Leeuwenhoek and BovenIJ
  are blocked on panoramas or BAG matching.
- **Overflow**: `public/canal-drive/dominant-building-backlog.json` has
  1,828 mid-sized pands, all `needs-identification-and-research`. Rank them
  by `rideVisibility.score`, then by footprint ÷ distance from the centre, and
  skip any that are already modeled.

Out of scope for Track M: an ornamented historic front (stepped or swung
gables, stone dressings, arcades, glass passage roofs). That is a Track L
building. Report it as such.

#### Track L: bespoke landmark builders (needs image viewing)

A hand-written TypeScript builder that exports a GLB for one landmark. The
budget is < 40,000 triangles and < 500 KB, with no textures.

Assignable items (verify each with B3):

- **Held landmarks that need a rework** (`status: "held"` in
  `manualCatalogue.json`; each entry's `heldReason` says why). Checked
  2026-10-19:
  - Levend Paardenmuseum: the gateway is detailed, but the long walls are
    plain 3DBAG massing with no windows.
  - Koningskerk: grey shell; the curved concrete grid hall is not modelled,
    and the tower placement is inferred.
  - Krasnapolsky: the user's review said "some incorrect windows". The
    red-brick middle section and the Dam-front rows have not been reworked,
    and three sides are blank 3DBAG.
  - Compagnietheater: faint wing windows, too brown.
  - Booking HQ: read its `heldReason` first.

  These are not held but have known faults: Gerard Dou Synagogue (side/rear
  walls open, 7/30 see-through rays) and the board's "Landmark polish from
  contact sheets" list.
- **Off limits.** Pathé de Munt is waiting on the user's review. Do not
  touch it. `wereldmuseum-amsterdam` is held on purpose, superseded by
  `tropenmuseum`. Do not revive it.
- Noorderkerk, Krijtberg and Muiderpoort are **done**. Their GLBs exist,
  even though older board text says otherwise.
- **Large-tier fronts too ornamented for the kit**: the 7 "ornamented fronts"
  from the large-tier triage (HISTORY "Large tier triaged"), e.g. Singel 457
  and OZ Achterburgwal 233's baroque gateway.
- **New landmarks from the backlog with `treatment: "building"` or
  `"complex"`**: Westergasfabriek campus (the Gashouder is already a separate
  model; keep it), World Trade Center Amsterdam (research files are in
  `scripts/landmarks/world-trade-center-amsterdam-*.json`).
- **Sculptures and memorials** (40 backlog items) are **not** this track.
  They go to the impostor/splat track (`docs/sculptures.md`).

### B5. Recipe: Track L (bespoke landmark)

Follow it in order. Each step names its output file. Don't skip a step
because the next one looks more interesting.

**Step 0: identity.** Find the destination in
`public/canal-drive/landmark-backlog.json` and the feature in
`public/data/extracts/amsterdam/landmarks.json`. Record the backlog id, the
canonical extract id, the BAG pand ids you will replace, the OSM ways you will
suppress, and at least one neighbour that must stay visible. Choose a model
id (kebab-case, e.g. `noorderkerk`).

**Step 1: brief (generated, not written by you).**

```sh
node --import tsx scripts/landmarks/landmark-brief.ts --pand=<16-digit BAG id> --id=<id> [--wiki=nl:<Title>] [--address="Street 1"]
```

This writes `scripts/landmarks/<id>-brief.md` (BAG/3DBAG facts, monument
register text, Wikipedia sections, one rectified crop per wall ≥ 4 m) and an
inventory skeleton, `scripts/landmarks/<id>-inventory.json`. The crops go to
`artifacts/landmark-briefs/<id>/` and are not committed. Read the brief.

**Step 2: signature inventory (before any geometry).** Fill in
`<id>-inventory.json` (schema: `src/canalRecall/landmarks/ornamentInventory.ts`).
For each photographed wall, list every feature a rider would notice from
1.7 m or on a gallery card: reliefs, sculpture, crests, gable stones,
lettering, signs, clocks, canopies, ironwork, towers, domes, colonnades,
unusual window shapes. For each item give its approximate size, the panorama
id it was seen in, and a `plan`:

- `modelled`
- `simplified`, with `how`
- `skipped`, with a reason from: `not-visible`, `too-small`, `temporary` or
  `gone`

"No component" and "the kit cannot express it" are **not** reasons; the
schema rejects them. A bespoke builder exists to model exactly those parts.
Fill `signature` with the most recognisable item ids, most recognisable
first. Mark every photographed wall `checked`.

**Step 3: rhythm spec.** For each visible wall, count from the photo: the
bays, which bays are identical, the windows per bay per storey, the symmetry
axis, the ground-floor type and the gable/roof line. Store it as
`scripts/landmarks/<id>-elevations.json` (format:
`docs/landmark-building-recipe.md` §7). Stepped, neck and bell gables are
symmetric. If yours comes out lopsided, you misread an occluded flank.

**Step 4: footprint and spec.** Write `scripts/landmarks/<id>-footprints.json`
from BAG/BGT outlines (record the source ids and URLs) and
`scripts/landmarks/<id>-spec.json`. Copy the structure of a recent example:
`europarking-marnixstraat-spec.json`. Keep courtyards, holes, underpasses
and passages open. Don't pad the footprint into a rectangle that hides a
neighbour.

**Step 5: builder.** Write `scripts/landmarks/<id>-builder.ts`. Recent
examples to copy conventions from (read one, not all):
`westerkerk-builder.ts` (church, plus the `renaissance-window.ts` kit
component), `europarking-marnixstraat-builder.ts` (with the new typed
component `src/canalRecall/landmarks/openDeckStack.ts` and its test), and
`noorderkerk-builder.ts`. Use `BuildingTools` from
`scripts/landmarks/cultural-builders.ts` and the shared palette. Rules:

- Metres, native scale 1, x east, z south, y up from the ground.
- Every material carries a `materialSlot` and a `tint`.
- Trim stands ≥ 5 cm off the wall (≥ 10 cm for roof sheets), or sits in a cut
  hole. **Never flush and never 2–3 cm proud.** That is z-fighting, and the
  new-export gate allows at most 0.5 m².
- Windows sit on a real wall, are exposed, and never cross a corner.
- Roofs face up and meet their supports. Nothing floats. Do not put a roof
  plane above a measured crown or parapet: the front decides the roof, and
  3DBAG roofs only count for rear wings.
- **If the photo shows something no helper can make, add a typed component
  with a unit test** (like `renaissance-window.ts` or `openDeckStack.ts`),
  with byte-identical output for every model that doesn't use it. Don't fit
  the nearest existing helper.

**Step 6: register and build.** Add the catalogue entry to
`src/canalRecall/landmarks/manualCatalogue.json`. Copy the field set of a
recent entry and keep the canonical `landmarkId`. Add one dispatcher line in
`scripts/landmarks/build-manual-landmarks.ts`; read the export signature,
don't guess the argument order. If this model replaces an older model on the
same ground, set the old entry to `status: "held"` with a `heldReason`, or
add it to `SHADOWED_BY_LANDMARK` in
`src/canalRecall/landmarks/ordinaryModels.ts`, in the same commit.

```sh
node --import tsx scripts/landmarks/build-manual-landmarks.ts --only=<id>
```

**Step 7: gates.** All of these must pass:

```sh
npm run lint
npm run audit:glb -- --id=<id>                 # hard gates + inventory + z-fight; fix, don't baseline
node --import tsx scripts/landmarks/zfight-patches.ts --id=<id> --top=20   # where the fights are
npm run check:landmark-inventory -- --id=<id>
npm run check:manual-landmarks
npm run compare:facades -- --id=<id>           # openings per storey vs your elevations spec
npm run check:osm-under-models
node --import tsx scripts/check-landmark-attachment.ts
npm run test:building-taxonomy                 # one model per ground
```

**Step 8: evidence sheets.**

```sh
(PORT=<port> nohup npx tsx server.ts > artifacts/server.log 2>&1 &)
bash /tmp/canal-pw.sh npm run review:sheet -- --id=<id> --inventory --port=<port>
kill $(lsof -t -iTCP:<port> -sTCP:LISTEN)
```

This produces, per wall: the photo, a camera-matched render, a 50 % overlay
and an IN GAME frame, plus a photo/render crop pair for each inventory item.
Then compare wall by wall and item by item, **not** by overall impression.
Fix the mismatches and rebuild. If you cannot view images, follow rule B1.10.

Also open `http://localhost:<port>/canal-drive/manual-landmarks.html?only=<id>`
and look at the gallery card from all four sides. Check that every part has a
building behind it: no floating screens or portals.

**Step 9: commit and report** (see B7).

### B6. Recipe: Track M (mid-tier `kind: "large"`)

**Step 0: identity and evidence.** Get the BAG pand id from the source list
(e.g. `scripts/landmarks/libraries.json`). Choose a house id (e.g.
`oba-osdorp`). Archive the wall crops; the likeness gate needs them:

```sh
export MAP_RECALL_SOURCE_DATA=/Users/blackmad/Code/map-recall2-worktrees/source-archive
node --import tsx scripts/pand-reference/all-walls.ts --pand=<pand> --archive --min-len=8 --max=12
```

If no street-facing wall has a usable panorama (trees, wrong side, too far),
**stop and report "no evidence"**. Do not build a house from a guess.

**Step 1: facts and walls.**

```sh
node --import tsx scripts/building-recipes/facts.ts --house=<id> --pand=<pand> --large
node --import tsx scripts/building-recipes/walls.ts --house=<id> [--detail]
```

`walls.ts` prints the table of 3DBAG wall surfaces (bearing, width, eaves,
top, ground, party) and writes a plan PNG. Decide which surfaces form which
wall group.

**Step 2: intent.** Write `scripts/building-recipes/houses/<id>/intent.json`
(`kind: "large"`). The schema table is in `docs/buildings-pipeline.md` "Large
tier → Schema". Start from a similar installed house: `oba-slotermeer`,
`stadsloket-noord`, `politie-van-leijenberghlaan` or `amsterdams-lyceum`.
Reference wall surfaces by index from `walls.ts`, never by coordinates. Put
one entry in `sources[]` per wall group, and put evidence in `notes[]`.

**Step 3: measure, then write the measurements in.**

```sh
node --import tsx scripts/building-recipes/measure.ts --house=<id>            # read-only first
node --import tsx scripts/building-recipes/measure.ts --house=<id> --write    # palette, window shape, bays, system
```

The measured colour, glazing fraction, window shape and bay rhythm are the
acceptance bar, not your impression. A field you deliberately keep by hand
goes in that group's `hand` list, with a note saying why.

**Step 4: compile and gate.**

```sh
node --import tsx scripts/building-recipes/large.ts --house=<id> --strict
npm run audit:glb -- --file=artifacts/building-recipes/<id>/model.glb
npm run test:large-tier
```

The contact sheet at `artifacts/building-recipes/<id>/` shows photo |
front-on | 3/4 for each group, with a **PASS / WARN / FAIL / NO EVIDENCE**
likeness line. Every street-facing group must be PASS, or WARN with a written
reason. A FAIL means fix the intent or extend the kit (step 5); it does not
mean ship.

**Step 5: extend the kit when the photo needs it.** If the photo shows
something no `system`/component can express (a colour split along a front,
glass columns, an arch shape, a canopy, a louvre screen, fins, a dimpled
metal skin), add the component or system in
`src/canalRecall/blockBuilding/` or `src/canalRecall/buildingRecipe/`. Add
a test, and keep the output for every other house byte-identical (run
`npm run test:building-recipes`; `fit-golden` must not move for other
houses). Fitting the nearest existing option is how batches 5–7 failed
review ("awful": a glazed hall drawn as punched windows in tan brick). **A
wrong kit is worse than the plain 3DBAG box.** "Do not install" is a valid
outcome.

**Step 6: install on your branch.**

```sh
MAP_RECALL_SOURCE_DATA=... node --import tsx scripts/building-recipes/install-large.ts --house=<id> --install
npm run check:stale-installs
```

`install-large` refuses a gate failure or a street-facing group that is FAIL
or NO EVIDENCE. Do not use `--allow-inferred` unless the operator's prompt
says so for that group.

**Step 7: commit and report** (see B7). Include in the report the list of
**what the kit still cannot express** for this building. That list feeds the
next kit pass.

### B7. Commit and report

Commit in coherent steps: kit component plus test, then the building. Each
message says what changed and the measured result. End every commit message
with this line:

```
Co-Authored-By: DeepSeek V4.1 Flash (opencode) <noreply@opencode.ai>
```

Before your final message, run `/usr/bin/git status`: the tree must be clean
except for untracked `artifacts/`. Then reply with **exactly** this template,
filled in:

```
LANE: <branch>    HEAD: <full SHA>    TRACK: Z|M|L    ITEM: <id / name>
VISUAL REVIEW: done | NOT DONE (model cannot view images)
OUTCOME: ready to install | held (why) | do not install (why) | blocked (why)

FILES: <new/changed files, one per line>
IDENTITY: pand ids replaced, OSM ways suppressed, neighbour kept visible
SOURCES: panorama ids + dates, URLs (Wikipedia/Commons/register/Beeldbank) with licence
NUMBERS: triangles, GLB KB, bounds (m); z-fight m2 before -> after; likeness per group (M)
GATES (command -> result, one per line, paste the summary line):
  npm run lint -> ...
  npm run audit:glb -- --id=<id> -> ...
  ...
INVENTORY (L): item -> modelled / simplified (how) / skipped (reason)
SHEETS: absolute paths to review:sheet / contact sheets / gallery shots
INFERRED: walls or parts with no photo evidence
KIT CANNOT YET EXPRESS: <list>
UNRESOLVED / UNCERTAIN: <list; each one is a hold>
INTEGRATOR TODO: commands you could not run because you don't own the file
                 (covers rebuild, bundle rebuild, baseline lowering, etc.)
```

Report failures as failures. "Gate X still fails at Y m²" is a useful
result. A report that rounds a FAIL up to PASS wastes the whole lane.

### B8. Mistakes earlier lanes made (don't repeat them)

- **Brief from memory.** The Hoofdbureau van Politie shipped without its
  carved Amsterdam-arms relief because the brief described it wrongly from
  memory, and the lane filed the sculpture under "cannot express". Fix:
  generate the brief, inventory every wall, including short end walls.
- **"Recognisable from its best side."** Nassaukerk had blank walls where the
  photo shows windows, and Het Pakhuis had five identical gabled bays drawn as
  scattered windows. Judge every wall, bay by bay.
- **Two models on one ground.** The Tropenmuseum's new entrance poked
  through the old `wereldmuseum-amsterdam` massing. Hold or shadow the old
  model in the same commit.
- **Fitting the nearest kit option.** Large-tier batches 5–7 were judged
  "awful": glazed halls drawn as punched brick, dark brick drawn as orange.
  Measure, and extend the kit.
- **Lopsided gables, 3DBAG roofs above a crown.** These are the user's most
  repeated corrections. Gables are symmetric, and the front decides the roof.
- **Too dark.** The user finds the city "dark/dour". Use measured tints from
  sunlit crops, and don't darken a colour to "feel" historic.
- **A pattern `pkill` of `tsx server.ts`** once took down four other lanes.
  Kill by port PID only.
- **Treating gates as acceptance.** `audit:glb` PASS plus an aerial strip let
  through a "door without a building" (Oudemanhuispoort). The sheets, at
  gallery size, are the acceptance.

---

## Part C: prompts (fill the `<…>` blanks, paste as the opencode message)

### C-Z: z-fight fix

```
You are a DeepSeek modeling lane in the Map Recall repo. Your worktree is the
current directory, on branch lane/<name>. Your dev-server port is <port>.

Read docs/deepseek-modeling-lanes.md Part B in full first, and obey B1 and B2
exactly. You are on Track Z, item <Z1 shared helpers | Z2: <model id>>.

Task: <Z1: find the shared builder helpers in scripts/landmarks/ that emit
flush or 2-3 cm proud panels/bands/frames/roof glazing; change them to >= 6 cm
(>= 10 cm roof) or a cut hole or one face with a material split; re-export every
model using them with build-manual-landmarks.ts; re-run
scripts/landmarks/zfight-survey.ts and report the before/after table for the top 50.>
<Z2: bring <model id> to <= 0.5 m2 zfight-m2 + zfight-tight-m2 (survey says
<N> m2, cause "<likely cause>"). Use zfight-patches.ts --id=<id> to locate
patches, fix them in scripts/landmarks/<builder>.ts, rebuild with
build-manual-landmarks.ts --only=<id>.>

The model must look the same apart from the flicker: render before and after
from the same camera (scripts/landmarks/geometry-audit-shots.ts) and list them.
Do not edit geometry-audit-baseline.json; list the --write-baseline command for
the integrator. Finish with the B7 report template.
```

### C-M: mid-tier building

```
You are a DeepSeek modeling lane in the Map Recall repo. Your worktree is the
current directory, on branch lane/<name>. Your dev-server port is <port>.

Read docs/deepseek-modeling-lanes.md Part B in full first, and obey B1 and B2
exactly. You are on Track M (kind: "large" recipe).

Building: <name>, BAG pand <16 digits>, house id <id>. Source list entry:
scripts/landmarks/<libraries|schools|civic-offices>.json. Closest installed
example to copy: scripts/building-recipes/houses/<example>/intent.json.

Follow B6 steps 0-7 in order. Start with B3's "is it still open" check and
step 0's evidence check: if there is no usable street-facing panorama, stop
and report "no evidence". Every street-facing wall group must reach likeness
PASS (or WARN with a written reason) from measure.ts numbers. When the photo
shows something the kit cannot say, add a typed, tested component with
byte-identical output for other houses rather than fitting the nearest
system. "Do not install" is an acceptable outcome. Finish with the B7 report
template, including KIT CANNOT YET EXPRESS.
```

### C-L: bespoke landmark

```
You are a DeepSeek modeling lane in the Map Recall repo. Your worktree is the
current directory, on branch lane/<name>. Your dev-server port is <port>.

Read docs/deepseek-modeling-lanes.md Part B in full first, and obey B1 and B2
exactly. Do the B1.10 image check before anything else; if you cannot view
images, stop after reporting that (Track L needs it).

Building: <name>. Backlog id <lm-...>, extract id <...>, BAG pand(s) <...>,
proposed model id <id>. <If a rework: current entry is held because
"<heldReason>"; the existing builder is scripts/landmarks/<file>.ts — rework
it, don't start a second model.>

Follow B5 steps 0-9 in order. The inventory (step 2) and elevations (step 3)
come before any geometry and are committed first. Never describe the
building from memory; cite a panorama id or URL for every feature. Budget
< 40k triangles, < 500 KB, no textures, every material with materialSlot and
tint, z-fight <= 0.5 m2. Finish with the B7 report template.
```
