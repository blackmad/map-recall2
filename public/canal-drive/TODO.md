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
that ships them (the What's New page renders it). Tracking (user, 2026-10-24):
every question or action for the user is a GitHub issue labelled
`needs-david` and assigned to blackmad, never only a chat line; each lane is
an issue labelled `lane` (+ `programme`), commented with its hand-back and
closed when merged. Inbox:
https://github.com/blackmad/map-recall2/issues?q=is%3Aopen+label%3Aneeds-david

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
  round 4 done (#75, 14 buurten, ~4,900 houses). Open: Gein 3 all-timber
  and brick-canopy rows, Holendrecht S2/S4, Twiske porch canopies, K-buurt
  yellow-door/buff rows, mottled multi-tone brick (K-buurt reads flat),
  `building-types-runtime.spec` draw-call hook reads 0.
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
- **Drop MapLibre** — lives on its own long-lived branch
  `render/drop-maplibre-step1-20261010` (own worktree), merging main in;
  not merged to main until ready (user, 2026-10-10). (go; ~3–4 weeks after city-wide own ground;
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

## P0 — Red, or actively teaching something false
- **Phone: the camera zoom snaps when a question card closes (2026-10-22).**
  Seen in the teaser phone shot: the card hides and the view jumps to a
  different zoom in one frame as the d-pad returns. Ease the zoom/padding
  change instead of snapping. The start-of-ride overview flight also hitches
  as it hands over (about 0.4 s frozen, then a jump).
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
- *Open:* Houthaven islands' themes beyond Wiborg/Reval/Memel (image-quality plan not found); Amsterdam histories still missing for Westindische Buurt, IJselbuurt, Van Galenbuurt, Polder Meerzicht; Canal Recall difficulty is separate from the new Map Recall Easy/Medium/Hard (place clues are easy/medium only).

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
