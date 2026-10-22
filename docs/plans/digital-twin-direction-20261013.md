# Canal Recall: where the digital-twin approach falls short, and what to change

## Context

Canal Recall is a low-poly digital twin of Amsterdam used as a geography-teaching
cycling game. The user asked for an assessment: where the approach falls short,
how to make more buildings faster at higher quality from reusable parts, how to
model ground/roads/bridges accurately, how to make the loop less interrupting,
how to make the look consistent, what to rebuild, and whether "every building as
a separate GLB" is right. Constraint (user, 2026-10-13): **open NL/Amsterdam data
only; no Google or Apple imagery.**

Method: three read-only surveys (buildings, ground/roads/bridges, gameplay/look)
plus one architecture review, all checked against code, TODO.md and HISTORY.md.

## The short version

1. The SF demos are not better data, they are a lit game frame over stolen
   photogrammetry. We already have the frame (behind flags) and better data.
2. Per-building GLBs are the wrong unit for the ~10k houses and ~1.8k large buildings; bespoke landmark builders (300+ today, no cap) stay first-class. The
   scalable unit is a recipe per BAG pand, compiled into per-tile meshes and
   instance tables. The one tier that already works this way (Nieuw-West
   building types) is off by default.
3. Ground is 80% done behind `?ownGround=1`; what blocks default-on is three
   small data tasks and one real-iPhone measurement, not rendering.
4. The game freezes the rider on every new street name. Spaced repetition never
   chooses questions. Fix the loop before adding more content.
5. The look is inconsistent because six palette systems and five light rigs
   coexist. One rig, one palette, one atlas, one written art direction.
6. The real bottleneck is human review per model (184/236 flagged, 12 held,
   565 branches, 114 worktrees, 135 docs). Every change below is chosen to make
   review per *diff* instead of per *model*.

---

## 1. How the SF reference gets its look, and why not to copy it

- sf.thijs.gg and the r/aigamedev robotaxi post are the same class: ripped
  Apple Maps flyover photogrammetry (or Google Photorealistic 3D Tiles)
  streamed as mesh/splat tiles into a WebGL frame. The HN thread on it:
  anonymous triangle soup, players walk over buildings "as if they were
  hills", 2 GB heap, highways wrong, likely a ToS violation. Pixels without
  semantics; useless at 1.7 m eye height.
- This repo already measured the legal twin (Google 3D Tiles at Prinsengracht,
  HISTORY ~8581): excellent at 192 m, unusable at 1.7 m, and no building ids,
  so no highlight or fact card. The user's open-data rule closes it for good.
- What those demos have that we lack is **lighting**: sun shadows, sky, fog,
  tone mapping, real water, ground textures with scale. The own-renderer spike
  (`docs/archive/research/own-renderer-spike-20261009.md`) showed the same buildings in
  a lit three.js frame read "like a game" at 2.6 ms CPU per throttled phone
  frame vs 7.1 ms for MapLibre's render. That frame exists (`?sharedFrame=1`)
  and is off.

## 2. Buildings

### Findings
- 16 distinct building pipelines. Base: 336,784 buildings in z14 tiles (15 MB;
  OSM-keyed, heights only, no 3DBAG roof data), extruded and dressed at
  runtime in a worker. Hero: 302 landmark GLBs + 258 LOD1 (60 MB) from ~276
  imperative builders (34k lines in `scripts/landmarks`), drawn one
  `THREE.Scene` per model with `getBounds()` per entry per frame, no frustum
  cull, no eviction (`signature-landmarks-source.js:436-443, 613-622`).
- Fast paths exist (recipe houses 33, block faces 22 chunks, ordinary one-offs
  38 at ~2 h each) but all end in "compile a GLB, install into a catalogue,
  review a contact sheet". Chunks: 127 KB raw per pand, 3 draws per pand,
  identical houses copied. Only `buildingTypes/` scales: 3,072 pands, 70 unit
  meshes, 3 MB, 1.5k → 35 draws, `InstancedMesh`, off by default.
- Drafting is cheap (8–33 s/house). **Review is the bottleneck.** Measured
  reuse is real: 67% of canal-belt houses share a coarse family; terrace
  streets 55–80% in runs of 3+; Nieuw-West 10 clusters cover 59% of large
  panden. Runtime instancing from `instances.json` is designed, not built.
- Suppression of covered footprints is a hand-kept list of 813 models
  (`suppressOsmIds`, `check:osm-under-models`), a whole problem class caused
  by OSM-keyed base tiles.

### Verdict on "a GLB per building"
**No.** A GLB is opaque: it cannot re-render when the component library or
lighting improves, cannot instance across twins, cannot change LOD without a
second file, and needs a human per model. Bespoke landmark GLBs (300+ today, no cap; user 2026-10-13) stay
first-class, referenced by key from the same tile system.

### Target architecture (R4)
Three tiers, one key (BAG pand id), one look, one runtime participant:

```
faces/*/intent.json, types/*.json,      build-time compiler                      runtime (shared frame)
landmark catalogue (kind: glb),   ──►  building-recipes/14/x/y.json  ──►  building-mesh/16/x/y.glb + units/<hash>.glb ──► TileBuildings (near):
~100 hand GLBs                          (per-pand recipe + fitted +         (merged uniques + EXT_mesh_gpu_instancing      InstancedMesh per unit,
                                         mid descriptor + covers[])          + pand table, meshopt)                        merged mesh, picking by pand
BAG/3DBAG facts (BAG-keyed base tiles) ─────────────────────────────────────────────────────────────────────────────────► shell (far) and mid facade
```

- **Data model.** Recipe tile per z14: one object per pand, `kind` ∈
  canal-house | type | large | kit | glb, with `intent` (or `sameAs` +
  overrides), compiler-written `fitted` and a ~40-byte `mid` descriptor
  (archetype, bays, storeys, wall, roof, gable, shop), `covers[]` of pand ids
  replacing `suppressOsmIds`. Pand without entry = generic. Faces/types stay
  the authoring unit; the tile is generated, never hand-edited.
- **Compiler** (`scripts/building-tiles/compile-recipes.ts`, new, build
  time, one process per z16 tile): reuse `blockFace/compile.ts` →
  `streetChunks/compileChunk.ts` unchanged; add **slot-level content-hash
  instancing** (body/crown/ground submeshes hashed separately; rears, party
  loops and signage never instance); `buildingTypes/generate.ts` and `glb`
  units go straight to the unit table with placement baked via
  `signaturePlacement.placementFor`; write via a generalised
  `buildingTypes/glb.ts writeInstancedGlb`; gates per pand
  (`buildingRecipe/gates.ts`, `geometryAudit.ts`, new "instanced ≡ merged"
  gate); **emit a review sheet only for pands whose triangle hash or gate
  numbers changed** (this is the answer to "re-review 800 models after a
  library change"; `fit-golden` already proves byte-identity).
- **Runtime.** `TileBuildings`, grown from `buildingTypes/runtime.ts` (440
  lines, already hysteresis + `pandForHit`): 2×2 z16 near tiles resident,
  refcounted units, one participant in `rendererShared`, three.js frustum
  culling per mesh. Replaces three loaders (landmark, chunk, types).
- **LOD.** Far: shell from facts (worker 'coarse'). Mid: today's cell-shader
  facade (`threeBuildingMesh.ts`, `roofMesh.ts`) driven by the descriptor;
  landmarks use their lod1 unit. Near: compiled tile; the mid range of each
  near pand gets `hidden=1` (attribute exists in both facade shaders), which
  deletes the suppression lists.
- **Picking/highlight.** One mechanism: `pandRanges` on merged meshes,
  `_PAND` on instances. `SIGNATURE_MODELS` stays the landmark list for
  destinations/quiz/cards and stops carrying render data.
- **Look.** `src/canalRecall/look/cityLook.ts` replaces three parallel systems
  (city `DataArrayTexture` cells, `recipeLook.ts`, `buildingTypes` merged
  shaders): one texture array whose layers are the slot table (brick
  variants, stucco, stone, frame, door, glass, pantile, slate, bitumen, flat
  greys, bay cells), vertex attributes `layer, tint, accent, hidden` on every
  building mesh, two shader variants (unlit baked / lit under `lightRig`).
  GLBs carry `materialSlot`+`tint` extras; `glbQuality.ts` hard-gates it for
  new exports; a one-time script infers slots for the 302 legacy landmarks.
  Then a landmark, a recipe house and a generic extrusion sample the same
  brick layer under the same sun. This also delivers TODO's "shared material
  textures" items.

### Migration (flag-gated; default path unchanged until each flip)

| # | Step | Flag | Effort |
|---|---|---|---|
| 0 | **Freeze**: no new per-house GLBs into `catalogue.json`; no new one-off ordinary builders; new landmark builders unrestricted but must export `materialSlot`; faces and types continue (they are recipe data). | — | now |
| 1 | BAG-keyed base tiles + facts sidecar (`build-bag-buildings.ts`, `bag3dTiles.ts` exist); `suppressOsmIds` → `covers`; `check:osm-under-models` becomes a join check. | `?bagTiles=1` | 1.5–2 wk |
| 2 | `cityLook.ts` slot table + array texture + shaders; port `recipeLook`, types shader, `litFacadeMaterial`; legacy slot inference + gate; `tests/e2e/building-look.spec.ts`. | `?cityLook=1` | 1.5 wk |
| 3 | Recipe tile compiler + `TileBuildings` near tier with content-hash instancing. Pilots: Bilderdijkstraat faces, Nieuw-West (instances.json is already a tile), 10 landmarks as `kind: glb`. Measure on desktop (iPhone 4× as secondary) before step 5. | `?recipeTiles=1` | 3–4 wk |
| 4 | Mid tier reads descriptors; near hides mid ranges; delete suppression lists; fold `largeBuildingTier.ts` overrides into `kind: large` (`fitLarge()` is specified in `docs/buildings-pipeline.md`). | same | 1–2 wk |
| 5 | Batch-convert 302 landmarks + 38 ordinary to `kind: glb` with baked placement, lod1 as mid unit; flip default; delete the drawing half of `signature-landmarks-source.js`. | flip | 2–3 wk |
| 6 | House-type library seeding + detector (`blockFace/houseType.ts` exists; Sol doc §4.2) toward the 67% canal-belt family coverage. | — | 2 wk seed, then content |
| 7 | Retire list below; rewrite `docs/buildings-pipeline.md`; drop flags. | — | 1 wk |

~12–15 engineering weeks; authoring continues throughout on the face/type path.

### Retire
`signature-landmarks-source.js` as a renderer; `sharedAssetCache` clone-per-
instance; `ordinaryChunks.ts` / `ordinaryModels.ts` as render specs;
`scripts/street-chunks/build.ts`; `building-recipes/install.ts` writing GLBs
into catalogues; per-model `build-landmark-lods.ts`; point-cloud facades,
facade registration, Blender "Sol" (pyc only), 3D Warehouse demo loader,
`cityAppearance*.ts` district releases and `blockBuilding/` renderers (keep
their colour measurements as descriptor inputs); `largeBuildingTier.ts` hand
overrides; `suppressOsmIds`/`basemapBuildingFilter`. **Keep** `landmarkKits.ts`:
it is already a parametric kit compiled in the worker and is the model for
`kind: kit`.

### Reuse (paths)
As-is: `src/canalRecall/blockFace/compile.ts`, `streetChunks/{compileChunk,party,ground,gltf}.ts`,
`buildingRecipe/{intent,fit,compile,instances,gates}.ts`, `blockFace/houseType.ts`,
`landmarks/{glbQuality,geometryAudit,signaturePlacement}.ts`, `rendererShared/*`.
Generalise: `buildingTypes/runtime.ts` → `TileBuildings`; `buildingTypes/glb.ts
writeInstancedGlb` → tile writer; `blockFace/instancing.ts` → content-hash
grouping; `threeBuildingFeatures.ts buildFeatureChunk` accepts descriptors.
Merge: `recipeLook.ts`, `bayTextures.ts` cells, `litFacadeMaterial.ts`,
`buildingTypes` `mergedShaders` → `cityLook.ts`.

## 3. Ground, roads, bridges (R3)

### Findings
- Default game is flat at z = 0 on a live third-party MapLibre basemap. Physics
  is 2D centreline corridors with per-class half-widths (`constants.js`
  `ROAD_WIDTHS`); `streets-routing.json` has no width/lanes/sidewalk tags;
  intersections are graph stitching.
- Three overlapping flag systems: `?elevation=1` (stencil hack inside
  MapLibre, land flat), `?sharedFrame=1`, `?ownGround=1` (AHN DTM heightfield
  city-wide, 294 cells, 29 MB gz, OSM cross-section bands, 729 measured decks
  joined to relief, route draped). Own-ground supersedes the other two.
- Default-on blockers (TODO 467–475): per-polder water levels (Osdorp land at
  −2.17 m under the −1.77 m plane), real-iPhone GPU, labels still MapLibre,
  widths are OSM priors (14% of ways tag width), hosting quota.
- Bridges: 729 measured, 891 unmeasured footprints (incl. 110 movable) drawn
  flat; 611 named bridge ways still get a street question; sweep 3,006
  crossings, 0 traps.

### Plan (all open data, CC0/CC BY)
1. **Per-polder water levels** from the waterschap `peilgebieden` dataset
   joined to elevation-v1 water polygons; `WATER_Z` becomes per cell. ~2 days.
2. **Width per way from BGT**: sample `wegdeel`/`voetpad`/`fietspad` width at
   each OSM way's midpoint offline (the cheap path in
   `docs/research/own-ground-20261009.md`), store one number per way in the
   OSM cells; `osmGround.crossSection` and `ROAD_WIDTHS` both read it so the
   corridor felt matches the road seen. 3–5 days. Full BGT polygons only for
   canal-belt junction discs, later.
3. **AHN DSM profiles for the 891 unmeasured bridges** with the existing
   `feat/measured-bridges` pipeline. 1–2 days compute + review.
4. **Real-iPhone GPU measurement** of `?ownGround=1&sharedFrame=1` (the gating
   test every doc asks for; nobody has run it). 1 day.
5. Default-on in the canal belt; delete `elevationBrowser.ts` stencil layer
   and the MapLibre ground fills inside the riding radius; then the
   drop-MapLibre branch continues as planned (3–4 wk).

## 4. Gameplay loop (R1)

### Findings
- **Every question freezes the vehicle** (`recallRuntime.ts:818` zeroes speed;
  `game.js:462-469` returns early each frame while `quizPromptName` is set). A
  route question fires for every new unlearned name after 0.65 s / 8 m. In the
  centre that is a stop every block. No TODO item covers this.
- Questions are **not chosen by spaced repetition**; they fire on whatever you
  ride onto. SRS only skips known names and shapes destination choice.
- Street-knowledge and drive-by cards are sticky; the plaque feedback line
  never times out and, via the one-card rule (`presentationRuntime.ts:432`),
  blocks cards until the next question. Pacing logic is spread over
  `teachingSurface.ts`, `driveByTrigger.ts`, `postcardPacing.ts`,
  `BRIDGE_QUIZ_COOLDOWN`, transit cooldowns.

### Plan
Principle: the ride is the lesson, the question is the check.
1. **Non-blocking route questions**: options in the bottom band while riding;
   keys 1–4 / tap; unanswered after ~12 s or on leaving the street = "passed",
   one-line reveal after leaving, scored as exposure. Freeze only in typed
   mode and on opt-in. Compact phone: same band, no dock card.
2. **SRS-driven question budget** (`game/questionBudget.ts`): ≤ N asks/min
   (default 2, a setting); priority due-review > new teaching-street names >
   rest; everything else revealed after passing (never before: the
   geographic-learning rule).
3. **One pacer** (`game/teachingPacer.ts`) absorbing the five cooldown
   systems; plaque feedback times out at 6 s.
4. **Cards auto-collapse** to a title line after 8 s; full text on the finish
   screen and in the encyclopedia; sticky only for user-clicked buildings.
5. Verify: Storybook states (desktop/phone/stacked), extended
   `check-bottom-hud-layout.ts`, e2e asserting ≤ N prompts/min and no
   speed-zeroing on the seeded route, `check-canal-answer-path` for "passed".
~1 week.

## 5. Look consistency (R2)

### Findings
- Six palette systems with three era schemes (`cityAppearancePalette.ts`
  <1925/<1965; `buildingAppearance.ts` 1800/1900/1945/1975/2000, no runtime
  consumer; `bayLook.ts`/`bayTextures.ts` 1860/1915/1945).
- Five light rigs: unlit baked shade (ordinary), hemi 1.15/sun 2.2/fill 0.55
  (landmarks), 3.2/4.2 (vehicles), 2.15/1.7 (trees), ambient 2.4 (detailed).
  Shared rig exists and is off. No sky, fog, shadows by default. Only GLBs
  with `materialSlot` follow the Building-look setting.
- No art-direction doc for 3D. The complaint history ("too drab", "New
  England", "Townscaper", "unlit against the shaded city", "really this
  dark?") is lighting and palette fragmentation, not modelling.

### Plan
1. Flip `SHARED_FRAME_DEFAULT` after the iPhone measurement; delete per-layer
   rigs in `signature-landmarks-source.js`, `player-vehicles-source.js`,
   `inventory-trees-source.js`, `artis-animals.js`,
   `detailed-buildings-source.js`. ~3 days.
2. One palette module (`look/palette.ts`, keep the 1860/1915/1945 scheme);
   delete `AMSTERDAM_ERAS`. ~2 days.
3. The shared atlas is step 2 of the buildings migration (`cityLook.ts`).
4. `docs/LOOK.md`: one page of art direction (sun angle, palette, saturation,
   outline rule, texture-by-distance, corridor readability). Gallery reviews
   cite it.
5. Verify: same block under five looks in Playwright; a landmark-vs-street
   luminance check for the "really this dark?" class.

## 6. Process (R5)

- Review per diff, not per model: the compiler's changed-pand sheets replace
  contact-sheet-per-model as the acceptance artefact.
- Put every failing check named in TODO (`check-building-look-transition`,
  `check-cinema-facade-surfaces`, `check-manual-landmarks`, `review-ride`)
  into `check:canal` or delete it.
- Triage the 114 worktrees / 565 branches to the branches named in TODO;
  compact the ~135 docs into `docs/buildings-pipeline.md`, `docs/elevation.md`,
  `docs/LOOK.md`, `docs/gameplay/loop.md` plus HISTORY.

## 7. Landmarks: new models, the queue, the existing GLBs (answers to 2026-10-13 questions)

**Do we have live lighting today?** No. By default each three.js layer has its
own fixed light rig (landmarks hemi/sun/fill, vehicles, trees, detailed
buildings all different), ordinary buildings use an unlit shader with a baked
fixed shade, and MapLibre extrusions use `setLight`. No shadows, sky or fog.
One real-time sun with shadows exists (`rendererShared/lightRig.ts`,
`?sharedFrame=1`) and is off; it costs ~+0.6 ms/frame on the iPhone oracle.
This is why "is this building really this dark?" cannot be answered per model:
the same wall colour renders differently in every layer.

**New landmark models.** The queue keeps running, but the authoring product
changes:
- **Bespoke builders continue, no cap** (user 2026-10-13: keep doing what we
  do with the 300+): `scripts/landmarks/*-builder.ts` and kits remain the
  tier that exports a GLB, for any landmark whose signature the component
  library cannot express, or simply because someone wants to build it. New
  rules only: tag every material with `materialSlot` + `tint` (0 of 190
  builders do today; `signature-landmarks-source.js:514-522` already honours
  it) and pass the `audit:glb` hard gates before install.
- **Everything else in the 420-item backlog (107 pending, ~80 review) and the
  1,828-candidate mid-sized `dominant-building-backlog`**: authored as
  `kind: large` recipes, or `kind: kit` for churches/halls (`landmarkKits.ts`).
  **These are not flat buildings.** Two things must not be confused:
  - Today's `largeBuildingTier.ts` *is* flat: period texture cells painted on
    the 3DBAG shell, "display priors". It survives only as the mid/far LOD.
  - A `kind: large` recipe keeps the 3DBAG LoD2.2 massing (real roof shapes,
    setbacks, towers as the lidar saw them) and, per wall, emits real
    geometry from `src/canalRecall/blockBuilding/compose.ts` on the exact
    3DBAG wall planes: recessed windows with reveals and sills, projecting
    piers, string courses and cornices, balconies with slabs/rails/cheeks at
    depth, entrance recesses and canopies, roof plant, stroke-font signage.
    Budget ≤12k tris (about a third of a bespoke landmark), 20–30 min to
    author. Specified in `docs/buildings-pipeline.md`, typed in `intent.ts`
    (`LargeBuildingIntent`), needs `fitLarge()` + dispatch in
    `compileBuilding`. What it cannot do: a signature feature with no
    component (pagoda roof, faceted glass skin, sculpture). Those go on the
    icon list, or the component is added once and every building with that
    feature gets it.
  - **Correction to the retire list**: keep `blockBuilding/compose.ts`,
    `panels.ts`, `spec.ts`, `gates.ts` as the `kind: large` facade-system
    compiler; retire only its standalone renderer path.
  The 25 elevation skeletons with photos (`scripts/landmarks/*-elevations.json`)
  are the first `large` inputs. Until `fitLarge()` lands (migration step 4),
  lanes draft the recipe JSON and park it; nothing is lost.
- Sculptures stay the separate splat/impostor track (TODO), untouched here.

**Fixing the held/offender queue from observations.** Yes, as its own lane,
but after the shared frame and `cityLook` are on, not before: a large share
of the recorded observations are lighting/material symptoms (too dark, bare,
flat, specular) that one rig and one atlas fix for all 302 at once, and the
"inferred wall reads as flat paint" class is exactly the shared-texture item.
Order:
1. Flip shared frame + palette (R2), re-shoot all 302 landmarks and 38
   ordinary at gallery-card size in one strip, triage against `docs/LOOK.md`.
2. Fix only hard-gate failures (holes, see-through, far-outside) and
   user-reported geometry (Krasnapolsky windows, Hotel de l'Europe rhythm,
   Pakhuis slits, DNB podium…) by editing the builder and re-exporting.
   Detached-part warnings stay warnings. The 12 held models follow the same
   gate; un-hold when they pass and the strip looks right.
3. Blank walls (167 of 247) are not per-model work: inferred walls take the
   atlas brick/stucco cell by BAG era with the "inferred" label kept.

**Convert the existing GLBs?** Yes, mechanically, no remodelling: migration
step 5 turns each catalogue entry into a `kind: glb` tile entry with baked
placement and `covers[]`, the lod1 sibling becomes its mid unit, and a one-time
script infers `materialSlot` from material name/colour so legacy models take
the shared look. Builders stay the source; the GLB is a build artefact. Only
the models in step 2 above get hand revisits.

### User direction (2026-10-13) folded in

**GLB cleanup pass (existing 302 landmarks + 38 ordinary).** Three measurable
goals, each already partly instrumented in `src/canalRecall/landmarks/geometryAudit.ts`
and `glbQuality.ts`:
1. *Windows attached to buildings*: `opening-floating` / `opening-buried`
   become hard fails for the pass (today they are warnings because recessed
   glazing is ambiguous); fix the known over-flags first (curved drums,
   glass curtain walls, the >20,000-cell sliver skip at `geometryAudit.ts:~199`)
   so the gate is trustworthy, then run `audit:glb --only-geometry` over all
   models and fix offenders in their builders. Known offenders listed in
   TODO 22–37 and 271–280 (worst 15: de-bijenkorf, oude-kerk, beta-boulders,
   fire-station-willem, mountain-network, centraal-station, rai-amsterdam,
   westerkerk, valley, lab111, vredeskerk, scheepvaarthuis, dominicuskerk,
   magna-plaza, madame-tussauds).
2. *More surfaces record materials/textures*: new audit metric
   `materialSlotCoverage` = share of visible surface area whose material
   carries `materialSlot` (+ `tint`); report per model, gate new exports at
   100%, drive legacy models up with the one-time inference script plus
   builder edits where inference is wrong. This is the same work that lets the
   shared atlas (cityLook) dress inferred walls as brick instead of flat paint.
3. *No obvious holes in roof or sides*: `holes`, `see-through`, `far-outside`
   stay hard fails; fix the hull-limited see-through test (cast through the
   bbox / from outside the footprint, TODO 392–394) so concave footprints stop
   flagging false holes; then clear the real ones (Gerard Dou Synagogue 7/30
   rays, Concertgebouw 151 open loops, Madame Tussauds roof junctions, Het
   Pakhuis rear-step gaps…).
Deliverable per batch: one gallery-size strip (before/after), the audit
diff, baseline lowered never raised. Batches of ~15 by audit rank.

**Sculpture splat track continues** as in TODO 328–335 / 360–366: 38 statues
tagged `treatment: sculpture`, De Dokwerker first (its hand model stays as
far LOD), Gaussian splat from Commons multi-angle photos + panorama crops
where 30–60 photos exist, baked 8–16-view impostor otherwise, splat only
within ~50 m, real-iPhone GPU check before any splat ships. Start from
`docs/landmark-splat-reference-pilot.md`. Rendered inside the shared frame
once it is on.

**New buildings and improved kits/generators keep going.** The step-0 freeze
is narrowed: it stops only *per-house GLBs installed into `catalogue.json`*
and *one-off ordinary builders*. Icon builders, `landmarkKits.ts`, the
building-types generator, block faces, house types and `large` recipes all
continue as lanes, because they are either the icon tier or recipe data that
the tile compiler consumes unchanged. New builders tag `materialSlot` from
now on.

**To-build list additions (user, 2026-10-13): police stations.** The 23
police stations already matched in staging (TODO 667, with 19 fire stations,
54 hospitals, 92 civic offices) go on the queue as a public-buildings lane:
`kind: large` recipes on 3DBAG massing with the police signature elements as
components (blue-and-white striped "POLITIE" fascia band, blue lamp, garage
doors, entrance canopy), the fire-station kit's glass-colour-per-row fix
shared with them. Add them to `landmark-backlog.json` via
`scripts/landmarks/build-poi-backlog.ts` with a `publicBuilding: police` tag
so `landmark-queue.html` can filter them; the Hendrik and Willem fire-station
lanes are the template for photo sourcing (Amsterdam panoramas, CC BY 4.0).

**Docs, code and gameplay cleanup at the integrator's discretion** (R1, R5,
retire list): proceed without further sign-off, with the usual rule of
periodic commits, TODO/HISTORY in the same change, and `check:canal` green.

### Photo and drawing sources to wire into the recipe lanes (user, 2026-10-13)

Verified 2026-10-09 in `docs/research/amsterdam-open-sources-20261009.md`; the
plan makes them inputs to `large` recipes, the GLB cleanup pass and icon
builders:

- **data.amsterdam.nl address/monument pages** (e.g.
  `data.amsterdam.nl/adressen/0363200000517868`): the pre-matched panorama
  per front is *not* in the API; the portal runs a `panorama/thumbnail/?lon&lat&radius`
  lookup around the point and gets back `pano_id` + aimed heading. Same
  lookup for every BAG pand is ~10k calls and cheap. The repo already has
  the rectifier (`scripts/pano-facades/build-pano-facade.ts`,
  `npm run pand-reference`); the ranked next step there is a **per-pand pano
  selector**: BAG pand → street-facing 3DBAG wall → best pano by angle and
  distance 8–25 m, newest year, second year for occlusion → rectified crop at
  1 px/cm, cached with pano_id/date/CC BY attribution. 2–3 days to batch all
  ~10k monuments; this is the feed every recipe lane drafts from. Also from
  the same API: `monumenten` (9,817 records with architect, year, function,
  BAG link), `bomen`, `civieleconstructies`, `puntenwolk/v2`, BAG.
- **Stadsarchief Beeldbank** (`archief.amsterdam/beeldbank`): OpenSearch RSS
  API (`/api/opensearch/?q=<address>`), ~300k images, address search works,
  no BAG filter; titles/dates/rights need the detail page; rights vary per
  record (mostly PD/CC0 for older material) and must be stored per image.
  Pre-1905 architectural drawings live partly here and partly in the
  **bouwdossiers** viewer, which has no API (manual research, tracked in
  `docs/references/construction-plan-requests.json`). Plan: a Beeldbank
  address-search script (1–2 days) feeding icon builders and `large` recipes
  as historical context; bouwdossiers stay manual for icons only until bulk
  terms are confirmed with the archive.
- **github.com/Amsterdam/panorama-textures** (MPL-2.0, archived 2020):
  projects a vertical wall quad into an equirectangular pano and writes a
  texture. Verdict stands: do not import; it is the same math as our
  rectifier and lacks heading/pitch/roll, occlusion and multi-view. Keep as
  an independent cross-check fixture only.
- Also catalogued there: Amsterdam-AI-Team `Urban_PointCloud_Processing`
  (facade point sets + labelled occluders), `Geolocalization_of_Street_Objects`
  (detector + multi-view triangulation template). Not needed for this plan.

Licence note carried forward: panoramas CC BY 4.0 (Gemeente Amsterdam), BAG
CC0, 3DBAG CC BY 4.0, RCE monuments CC0, Beeldbank per record.

## 8. Handing the plan to other models (opencode lanes)

Yes, with the CLAUDE.md lane rules (own worktree + branch per lane, exclusive
lane, unique port, integrator owns `game.js`/`index.html`/`package.json`/
bundles/TODO/HISTORY). Each lane gets a handoff doc in `docs/handoffs/` with
inputs, acceptance checks and the named regressions, and returns a SHA plus
check output. Suggested split by model strength:

| Lane | Model | Why |
|---|---|---|
| Gameplay pacer + non-blocking prompt (R1) | Sonnet | contained TS + Storybook + e2e, clear acceptance |
| Ground data: polder levels, BGT width per way, 891 bridge profiles (R3 1–3) | Sonnet | scripted data work with reports |
| Shared frame on, palette merge, `docs/LOOK.md` (R2) | Opus | cross-layer rendering judgement |
| BAG-keyed base tiles + `covers` (step 1) | Sonnet | extract builder, join checks |
| `cityLook.ts` atlas + shaders (step 2) | Opus | shader + visual regression |
| Tile compiler + `TileBuildings` (steps 3–4) | Opus | architecture-bearing |
| GLB → `kind: glb` batch conversion, slot inference (step 5) | Haiku/Sonnet | mechanical, gated by `audit:glb` |
| `large` recipe drafting from elevation skeletons | Sonnet | repo found Haiku blind counts too noisy |
| GLB cleanup pass: attached windows, material coverage, holes (§7) | Sonnet | audit-gated builder edits in batches of ~15; strips reviewed by human |
| Sculpture splats + impostors (§7) | Opus | new rendering path, GPU-gated |
| New icons, kits, building types, block faces, `large` recipes incl. police stations (§7) | Sonnet (Opus for new kit components) | ongoing content lanes |
| Docs compaction + code retire list (R5) | Sonnet | mechanical, guided by this plan |

Decision points: none blocking. Default flips (shared frame, own ground,
tiles) are gated on desktop measurements first (user 2026-10-13: desktop is
~10x as important; iPhone numbers come later and are recorded as pending). The
integrator also needs a human look at gallery-size strips before un-holding
(memory rule).

## 9. Housekeeping: worktrees, disk, killed work, source archive (user, 2026-10-13)

### Findings (measured 2026-10-13)
- Disk: 926 GB volume, **23 GB free (98%)**.
- `git worktree list`: 117 entries. 108 under `map-recall2/.claude/worktrees`
  (81.6 GB), 6 under `~/Code/map-recall2-worktrees`, 2 in `~/.claude/jobs/…/tmp`.
  Classes: 63 merged+clean, 44 merged+dirty, 8 unmerged+clean, 2 unmerged+dirty.
- What fills a worktree is **not `node_modules`** (57 real copies total only
  0.56 GB; 48 already symlinked; 0 `.venv`). It is untracked `artifacts/`
  (4–5.6 GB in the big ones) and `.cache/` (aerial tiles, 0.9–3.8 GB).
- Main checkout alone ~21 GB: `artifacts/` 5.6, `.cache` 3.8, `.git` 2.3,
  `storybook-static` 0.9, `dist` 0.8, `dist-canalrecall` 0.8, `node_modules` 0.6.
- **Python**: no per-worktree env exists; scripts use `uv run` with inline
  deps and uv's central cache. That cache is the hog: `~/.cache/uv` **64.6 GB**
  (`archive-v0` 50.9 GB in 1,779 entries, several at 1.4 GB each, i.e. many
  torch/vision wheel versions from the DINO/SAM work; `environments-v2` 11.2 GB).
  `~/.npm` 8.9 GB, pip cache 1.9 GB.
- `~/Code/map-recall2-worktrees` also holds **90 `canal-*` directories that are
  not registered worktrees**: 81 are loose review-image dumps (1 GB total) and
  9 are stray git checkouts from the 2026-10-08 recovery (`canal-box-release-
  recovery` 1.4 GB, `canal-box-source-recovery` 3.5 GB source-data clone with
  worktrees `canal-{nieuwespiegel555,prinsen211,prinsen215}-author*` and
  `canal-drafts34-source-publish` 2 GB; `canal-bank555-windowfix42` and
  `canal-kerk136-author-34` 0.46 GB each, 8–9 dirty files).
- **Main checkout is on a detached HEAD**, 3 commits ahead of `main`
  (American Hotel merge, Scheepvaartmuseum/Waag), 3 dirty bundle files, and
  reachable from no branch. `main` == `origin/main`. This must be fixed first.
- **Source archive** `~/Code/map-recall2-source-data` (15 GB, blob:none clone
  of github.com/blackmad/map-recall2-source-data): **1,264 uncommitted files**
  and 12 registered worktrees, 11 of them prunable `/private/tmp` paths.
  Siblings: `map-recall2-source-data-worktrees` (21 GB) and
  `map-recall2-source-data-wt` (13 GB) are **not git repos** (lost worktree
  registrations); `-elevation` (7 GB, clean worktree), `-marnixstraat` (2.3 GB),
  `-vinoly`, `-uva` are clean worktrees/clones.

### Killed in-progress work: keep or drop
Keep (commit WIP to its branch, review, merge via integrator):
- `feat/kit-only-churches-20261011`: 3 unmerged commits, hand-built GLBs for
  De Duif, Mozes en Aaronkerk, Oosterkerk (41 files) + untracked Obrechtkerk/
  Opstandingskerk footprints. Gallery-size review, then merge.
- `feat/da-costakade-13-20261013`: 1 commit (Da Costakade 13 landmark) + 7
  uncommitted catalogue/bundle files. Commit, review, merge.
- `big/ordinary-a2-20261013`: Jodenbreestraat 11 GLB + builder untracked,
  catalogue edited, 0 commits. Commit as WIP, review.
- `qa/detached-openings-sweep-20261013`: 2 commits (audit false-positive
  classes; Haparandaweg 8-338 rails) + uncommitted rebuilt GLB. Commit, merge.
- `fix/europe-window-grid-20261011` (1), `fix/felix-meritis-20261011` (1):
  clean, unmerged, small. Review sheets, merge.
- `rework/booking-hq-20261011` (3, held per TODO), `exp/photo-colors-20261011`
  (1, experiment), `render/drop-maplibre-step1-20261010` (8, long-lived by
  user decision): keep branches, remove worktrees only when idle.
- `fix/american-hotel-windows-20261011`: already in the detached HEAD; remove
  once `main` is fast-forwarded.
- Footprint-only leftovers (`big/ordinary-b2` Groenhoedenveem / Hoogte Kadijk
  400 / Shell campus hall; `landmarks/kit-churches2` Krijtberg / Noorderkerk):
  commit the `*-footprints.json` to a `wip/footprints-20261013` branch, drop
  the `_tmp*`/`_nl-*` scratch, remove worktrees.
Drop: `sol-comp` / `sol-lib` tmp worktrees (commits are on
`agent/sol-component-geometry` and `backup/wt-sol-building-library-20261009`);
the 44 merged-dirty worktrees whose dirt is `_tmp*`, `_nl-render*`,
`_before-*.glb` scratch (`fix/geometry-defects`, `rework/held-landmarks*`,
`fix/recipe-roof-towers` regenerated outputs, discovery lanes' version-json
churn). Rule: tracked diff → WIP commit on the branch first; untracked
`_`-prefixed → delete; untracked `*-footprints.json`/`*-research.json` → the
footprints branch.

### Plan (do first; everything else needs disk)
1. **Rescue main**: `git branch integrator/head-20261013 HEAD` in the main
   checkout, commit or discard the 3 dirty bundles after `check:canal`,
   fast-forward `main`, push. Then the main checkout returns to `main`.
2. **Salvage** the keep-list above (WIP commits only; merges go through the
   integrator worktree with gallery review).
3. **Triage tool** `scripts/worktrees/triage.sh` (the survey script,
   productised): prints path | branch | date | dirty | merged | nm | size;
   `--remove-merged-clean` runs `git worktree remove` on the 63 (≈40 GB);
   `--archive-dirty` does the WIP-commit/footprints/scratch rule then removes;
   always `git worktree prune`. Keep `integrator`, `source-archive`,
   `block-face`, `facade-compare`, `backlog-20261011`, the drop-maplibre lane.
4. **Caches**: `uv cache prune` then measure (expect tens of GB back); keep
   one pinned env for the DINO/SAM scripts; `npm cache verify`; delete
   `storybook-static`, `dist`, `dist-canalrecall` in the main checkout
   (regenerable, 2.5 GB); delete `artifacts/` in removed worktrees as part of
   removal (they are per-worktree outputs; anything worth keeping is already
   the archive's job).
5. **Share between worktrees**: `scripts/worktrees/new.sh <branch> [port]`
   does `git worktree add` + `ln -s` to the main checkout's `node_modules` and
   `.cache` (aerial tile cache is read-mostly and 3.8 GB), writes a
   `.worktree-port`; find what gave 48 agent worktrees their symlink today
   (likely a worktree-create hook in `.claude/settings*.json`) and extend it to
   `.cache`. Python needs nothing per worktree (uv central); document that.
   Playwright browsers are already shared (`~/Library/Caches/ms-playwright`).
6. **Strays in `~/Code/map-recall2-worktrees`**: the 81 review-image dumps go
   into `map-recall2-source-data/experiments/<lane>/` if `archive-index.json`
   does not already list them, then delete; the 9 recovery checkouts: confirm
   every commit is on a branch in the main repo or the source repo and dirty
   files are scratch, then delete (≈8 GB).
7. **Source archive**: commit the 1,264 pending files in
   `map-recall2-source-data` (that is the archive the user asked for), push;
   `git worktree prune` there; inspect `-worktrees` (21 GB) and `-wt` (13 GB):
   if their content hashes are in the archive history, delete; if not, commit
   from them first. Keep `-elevation` (raw AHN pulls). Update the memory note
   `source-archive-per-lane` with the result.
8. Record the outcome in HISTORY (what was removed, GB reclaimed) and add a
   TODO line for the recurring triage.

Expected reclaim: ~40 GB (merged-clean worktrees) + ~20–30 GB (merged-dirty)
+ tens of GB (uv cache) + ~8 GB (recovery checkouts) + 2.5 GB (build outputs),
before touching the two loose source-data directories.

## Recommended order

Integrator lane (sequential):
0. Housekeeping §9 (rescue main, salvage killed work, remove worktrees, prune
   caches, commit the source archive): 1–2 days, unblocks disk for everything.
1. Gameplay loop (R1, 1 wk): cheapest, most felt, no dependency.
2. Shared frame + iPhone measurement + one palette (R2 steps 1–2, 1 wk):
   unblocks ground, buildings and the GLB cleanup strip.
3. Ground data tasks → own-ground default-on (R3, 2–3 wk).
4. Buildings migration steps 0–3 (narrowed freeze now; BAG tiles, cityLook,
   tile compiler pilot), then 4–7.
5. Docs compaction and the retire list as each step lands (R5).

Content lanes (parallel, continuous, own worktrees): GLB cleanup batches;
new icons, kits, building types, block faces, `large` recipes (police
stations, fire stations, the 25 elevation skeletons); sculpture splats.

## Verification (end to end)
- `npm run check:canal` green on main at every merge; add the new e2e specs
  above to it.
- Ride-perf oracle (`tests/e2e/ride-perf.spec.ts`, iPhone 4×) at each flag
  flip; one real-iPhone session recorded in `docs/performance/`.
- Named regressions: BRU0166/BRU0044/BRU0067 (ground), Bilderdijkstraat faces
  and Osdorper Ban (tiles), seeded Anne Frank → Rijksmuseum ride (prompts/min).
- Gallery review at gallery-card size before un-holding (memory rule).
