# Node world frames — inventory, renderer, fidelity (2026-11-15)

Lane `lane/node-world-frames-20261115`. Question from David: *why still so much browser usage — can we not
visualise the buildings offline?* Every acceptance frame (house:frames' rule-10 likeness frame and as-played
frame, the landmark rule-10 pairs, `ingame-capture` aerials) still goes through headless Chromium. This lane
renders those frames in Node, from the game's own data and its own builders, with no Chromium.

## 1. Inventory: which layers are pure JS, which need a browser

Everything that *decides geometry or colour* in the own engine is TypeScript that runs in Node. What needs a
browser is the GPU draw itself (three's WebGLRenderer and its shader programs), the DOM and the streaming
timing. The node frame keeps the first and replaces the second with a software rasteriser.

| Layer (own engine, `engine=own`) | Builder / data | Runs in Node? | Node frame |
|---|---|---|---|
| World cells (buildings, HIDE) | `world/worldCells.ts` WorldCellReader, `cellFormat.ts` | yes (fetch shim → fs) | used as is |
| Detail tier (z16 block) | `detailRing.ts` detailBlock, `threeBuildingFeatures.ts` buildFeatureChunk walls + extras, streets (roads-v2), appearance profiles | yes | used as is |
| Ground lift of buildings | `ownGround/placement.ts` frontBase, drapeRange; `engine/bakedCoarse.ts` liftRanges | yes | used as is |
| Facade atlas (cells, slot layers) | `look/paintLookAtlas.ts` paintLookArrays on canvas | yes with `@napi-rs/canvas` shims (`nodeFrame/shims.ts`) | painted once, cached (`.cache/node-frame/atlas-*.bin.gz`) |
| Facade material (lit city chunk) | `look/cityLook.ts` GLSL | **GPU** | re-implemented: `nodeFrame/chunkMaterial.ts` (tint/accent masks, wall gain, glaze sky tint, facade tier blend to the cell mean, trilinear + 16x aniso footprint) |
| Baked shells | `world-v1/shells` + `bakedCellArrays` | yes | used as is (exact arrays) |
| Far prisms (> shell reach) | `world-v1/far` + `farCellArrays` | yes | **not drawn yet** (beyond 1.5 km, under the draw-limit haze) |
| Own ground cells | `ownGround/groundStore.ts` + `groundCell.ts` buildCell | yes | used as is, cells cached on disk (`.cache/node-frame/ground`) |
| Ground materials | `OwnGround.makeMaterials` (canvas textures, colours, offsets) | yes on the canvas shims | used as is; shading re-implemented (`surfaceMaterial.ts`, three's MeshStandard without env map) |
| Ground water cut, polygon offsets | `groundMaterial.ts` CUT_GLSL, OFFSET ranks | **GPU** | re-implemented: per-sample cut and three's polygonOffset in `worldRaster.ts` |
| Installed GLB models | `landmarks/browser.ts` GAME_BUILDING_MODELS + `ordinaryChunks.ts` applyStreetChunks, `signaturePlacement.ts` placementFor, GLB via gltf-transform (`glbRaster/load.ts`) | yes | placed as `signature-landmarks-source.js _add`; Lambert + glass tint (`normaliseLandmarkMaterials`) |
| City-look slot materials on GLBs | `buildingRecipe/recipeLook.ts` (city look) | partly (cells paint on canvas; the shader is GPU) | **approximated** by the GLB's own Lambert colours |
| Building-type instances | `buildingTypes/runtime.ts`, `building-types/instances.json` | yes | placed per area (`models.ts typeInstanceMatrices`), their pands hidden |
| Light rig, shadow box | `rendererShared/lightRig.ts`, `shadowFit.ts` | yes | used as is; shadow map + PCF re-implemented (`shadow.ts`) |
| Depth fade, draw limit | `look/depthFade.ts`, `engine/drawLimit.ts` | ranges yes, GLSL GPU | ranges used as is; the fog chunk re-implemented (`fog.ts`) |
| Sky | `look/sunny.ts` SKY.zenith clear colour | — | same clear colour |
| Camera | `ownMap/mapCamera.ts` cameraFrame, house-frames `pose.ts` frameFor | yes | used as is; the eye stands on the rider's surface (`ownGround/surface.ts` riderPose over `surface.height`, as ownWorldView's riderSurfaceM); a clipped likeness pose (tall frame, top window) rasters only the window rows by moving the principal point |
| Trees | instanced, `trees3d` | yes (data) / GPU | off, as house:frames likeness frames (`trees3d=0`) |
| Street furniture, houseboats, boats, flat lines (cycle-track red), overlays | procedural, three meshes | yes (data) | **not drawn yet** |
| POI labels | DOM canvas | **browser** | not drawn (the likeness frame should not carry them) |
| Streaming, settle, worker pools | page timing | **browser** | not needed: the node frame builds what the settled page holds |

## 2. The renderer

`src/canalRecall/nodeFrame/` (typed, unit-tested in `nodeFrame.test.ts`):

- `worldRaster.ts` — a deferred visibility-buffer rasteriser: 4x MSAA depth + triangle ids at the standard sample
  pattern, each visible triangle shaded once per pixel (exact perspective-correct barycentrics by ray–plane), the
  sky for empty samples, blended draws far-to-near after. Per-draw frustum reject, per-row spans, polygonOffset
  (factor −k, units −2k in window depth), a per-sample cut (the ground's water mask) before the depth write.
- `scene.ts` — assembles one frame: ground cells → detail block (meshed, lifted) → shells (lifted, detail and HIDE
  ids dropped) → installed models → shadow map → raster.
- `scripts/house-frames/node-frame.ts` — the CLI (section 5).

## 3. Fidelity

19 house:frames poses (12 eyeball-benchmark belt pands, Rijnstraat, Sonderbuur (building types), five landmark
or installed-model poses) plus belt-keizersgracht, rendered by the browser
(`PW_PORT=4674 npm run house:frames -- --likeness --pands … --out artifacts/house-frames/fidelity`, main 85402ed99)
and by `node-frame.ts` on the same pose.json files. Measures from `node-frame-fidelity.ts`
(`src/canalRecall/nodeFrame/compare.ts`): CIE76 dE per pixel, the sky IoU, and the Sobel edge IoU (1 px dilation).
belt-keizersgracht's browser frame is from an older main (default-look-realism lane), so its row is indicative only.

### Round 3 (latest): house doors and street furniture

- **Doors.** The four worker inputs were tested one at a time on pand 0363100012169794 (Marnixstraat), counting the
  mesher's `door` triangles. Neighbours (`contextFeatures`) changed nothing. Host openings and surveyed envelopes only
  apply to configured hosts, and this house is neither. The streets were the cause. The routing extract stores
  `[lat, lng]`, but Node read the paths as `[lng, lat]`, so no routing way survived the box filter. The door rule then
  saw only the appearance catalogue's 153 front paths, which hold no street wall for this house, and gave it no door.
  With the order fixed there are 12,335 segments and the house gets one street door, as in the browser. The fix also
  moves every other street-facing choice (stoops, crowns). Regression test: `streetInputs` in `nodeFrame.test.ts`.
- **Street furniture** (`nodeFrame/furniture.ts`). The ride's lamps, containers, bike hoops, abris and columns: the z15
  extract tiles, `alignContainerRows` and `instancesOf`, and `rideModel` per kind. Each instance stands on the
  gameGround `surfaceBase` + `RIDE_BASE_LIFT_M`, turned by its yaw. Slot faces take the instance colour. The material
  is MeshStandard roughness 0.82, receives shadows and casts none. Drawn within 220 m of the rider. Turn it off with
  `--no-furniture` or `?furniture=0`. It costs about 7 ms to build, with 24–87 instances a pose.

| key | mean dE | p90 dE | >10 dE | sky IoU | edge IoU | cpu ms |
|---|---|---|---|---|---|---|
| 0363100012061842 | 7.36 | 13.407 | 0.247 | 0.985 | 0.752 | 10918 |
| 0363100012080338 | 14.917 | 42.177 | 0.391 | 0.968 | 0.478 | 14851 |
| 0363100012164843 | 9.695 | 22.913 | 0.338 | 0.984 | 0.466 | 13610 |
| 0363100012165023 | 4.418 | 21.833 | 0.127 | 0.324 | 0.328 | 13195 |
| 0363100012165078 | 12.397 | 38.466 | 0.374 | 0.96 | 0.51 | 14263 |
| 0363100012167483 | 10.459 | 31.553 | 0.421 | 0.91 | 0.559 | 16465 |
| 0363100012167627 | 8.595 | 25.299 | 0.32 | 0.979 | 0.472 | 15730 |
| 0363100012168136 | 7.291 | 20.426 | 0.342 | 0.983 | 0.578 | 16843 |
| 0363100012168578 | 5.652 | 18.453 | 0.167 | 0.997 | 0.652 | 16851 |
| 0363100012169116 | 6.95 | 14.308 | 0.316 | 0.997 | 0.712 | 28564 |
| 0363100012169781 | 7.979 | 13.167 | 0.393 | 0.987 | 0.849 | 8387 |
| 0363100012171023 | 6.941 | 18.485 | 0.272 | 0.996 | 0.594 | 14947 |
| 0363100012171218 | 9.615 | 30.641 | 0.278 | 0.944 | 0.653 | 43585 |
| 0363100012173447 | 5.365 | 13.824 | 0.243 | 0.988 | 0.746 | 18948 |
| 0363100012175318 | 6.727 | 14.07 | 0.319 | 0.993 | 0.657 | 17071 |
| 0363100012175320 | 9.654 | 38.066 | 0.301 | 0.995 | 0.363 | 12353 |
| 0363100012175321 | 6.714 | 14.07 | 0.325 | 0.995 | 0.699 | 13479 |
| 0363100012175358 | 7.283 | 14.726 | 0.36 | 0.995 | 0.681 | 15517 |
| 0363100012180413 | 15.881 | 47.871 | 0.451 | 0.876 | 0.106 | 24042 |
| belt-keizersgracht | 5.822 | 18.326 | 0.124 | 0.944 | 0.377 | 22092 |

Against round 2: 171218 went from 9.6 to 4.4 (edge IoU 0.65 to 0.93), 175320 from 9.7 to 3.2, 168578 from 5.6 to 3.3,
and 167483 from 9.4 to 6.8. No row got worse.

**Strict blind judge, round 3** (opus; doors, lamps, labels and camera all count): **13 of 20 interchangeable**,
up from 1 of 20 in round 2. The seven it rejects:
- **Camera shifts.** 080338, 164843, 165078, 168578 and belt-keizersgracht. 080338 is the known eye-height case. The
  round-2 shift measurement put 168578 at (0, 0), and 164843 and 165078 at a vertical offset of 5–6 px in 225.
  belt-keizersgracht's browser frame is from an older main.
- **Dark ramp wedges.** On 167483 and 169116 the browser shows dark wedge faces on the quay's kerb ramps where Node
  shows paving (`--probe`: `ground/…/klinker`). With the ground's polygon offsets off, Node shows the kerb sides, but
  small and light. So the browser stands the paving lower against the kerb. The ground-height difference between
  kerb and paving is open.
- **Water tone.** It differs on most canal sheets but was rated minor. The game has no environment map, so this is a
  tone or lighting difference; open.
- POI labels (Hotel Banks Mansion, café names) are not drawn by Node.

### Round 2: the city-look slot dress, the kit/front chunk and model suppression

Three layers the first round lacked, each traced with `--probe x,y` (which draw, or `detail/<pand>`, a pixel shows):

- **The city look on GLBs** (`slotMaterial.ts`). The game dresses every installed model (`look/cityLook.ts` `dress`,
  slots inferred from material name and colour). A dressed material draws the shared slot cell from the facade atlas,
  tinted, instead of its own flat colour. This gives the brick and the near-black wall at Nassaukade 164843,
  which were GLB street chunks, not the facade tier.
- **The KIT_KEY chunk** (`buildSpecialKits` over the in-view `KIT_PART_IDS` / `FRONT_PART_IDS`, with the browser's
  layer map). This chunk holds the measured fronts. Café de Jaren's front (cornice, plaques, big panes) at 180413
  comes from here. KIT_HIDE ids are dropped from the detail tier, as in the game.
- **Model suppression.** A model's `suppressOsmIds` hide those pands from the detail tier and shells (setHidden).

| key | mean dE | p90 dE | >10 dE | sky IoU | edge IoU | cpu ms |
|---|---|---|---|---|---|---|
| 0363100012061842 | 7.36 | 13.407 | 0.247 | 0.985 | 0.752 | 10918 |
| 0363100012080338 | 14.917 | 42.177 | 0.391 | 0.968 | 0.478 | 14851 |
| 0363100012164843 | 9.695 | 22.913 | 0.338 | 0.984 | 0.466 | 13610 |
| 0363100012165023 | 4.418 | 21.833 | 0.127 | 0.324 | 0.328 | 13195 |
| 0363100012165078 | 12.397 | 38.466 | 0.374 | 0.96 | 0.51 | 14263 |
| 0363100012167483 | 10.459 | 31.553 | 0.421 | 0.91 | 0.559 | 16465 |
| 0363100012167627 | 8.595 | 25.299 | 0.32 | 0.979 | 0.472 | 15730 |
| 0363100012168136 | 7.291 | 20.426 | 0.342 | 0.983 | 0.578 | 16843 |
| 0363100012168578 | 5.652 | 18.453 | 0.167 | 0.997 | 0.652 | 16851 |
| 0363100012169116 | 6.95 | 14.308 | 0.316 | 0.997 | 0.712 | 28564 |
| 0363100012169781 | 7.979 | 13.167 | 0.393 | 0.987 | 0.849 | 8387 |
| 0363100012171023 | 6.941 | 18.485 | 0.272 | 0.996 | 0.594 | 14947 |
| 0363100012171218 | 9.615 | 30.641 | 0.278 | 0.944 | 0.653 | 43585 |
| 0363100012173447 | 5.365 | 13.824 | 0.243 | 0.988 | 0.746 | 18948 |
| 0363100012175318 | 6.727 | 14.07 | 0.319 | 0.993 | 0.657 | 17071 |
| 0363100012175320 | 9.654 | 38.066 | 0.301 | 0.995 | 0.363 | 12353 |
| 0363100012175321 | 6.714 | 14.07 | 0.325 | 0.995 | 0.699 | 13479 |
| 0363100012175358 | 7.283 | 14.726 | 0.36 | 0.995 | 0.681 | 15517 |
| 0363100012180413 | 15.881 | 47.871 | 0.451 | 0.876 | 0.106 | 24042 |
| belt-keizersgracht | 5.822 | 18.326 | 0.124 | 0.944 | 0.377 | 22092 |

Against round 1: 180413 went from 15.9 to 1.7 mean dE (edge IoU 0.11 to 0.59), 164843 from 9.7 to 5.7, 061842 from
7.4 to 4.0, and 169781 from 8.0 to 3.6. The other rows are unchanged within 0.1.

**Blind judge, round 2 (opus, sheets photo | A | B, order from the key's hash, the round-1 prompt): 20 of 20
interchangeable** (6 accept, 14 reject on both). The two round-1 failures (164843, 180413) now match.

A second judge ran with a stricter prompt: doors, lamps, labels and any camera shift count. It rated 1 of 20
interchangeable. Its findings were checked:
- **Camera shift: mostly not real.** A best-shift search over browser vs node frames (360 x 225, ±40/±20 px) gives
  (0, 0) or a vertical shift of at most 2 px on 15 poses. The exceptions are 080338 (−20, −8; the open eye-height
  case below), 164843 (0, −6) and 165078 (0, −5): a small vertical eye difference. 180413, called "visibly shifted",
  measures (0, −1) with an MSE of 38.
- **Doors: real, and on the Node side.** On 10 of the 11 sheets where the judge named doors, the render without them is the Node one (the 11th is ambiguous). Example:
  the low house beside 169781 (pand 0363100012169794) has a framed door in the browser frame, and plain ground-floor
  windows in the Node frame, although `--probe` puts it in the Node detail tier (`buildFeatureChunk` walls + extras).
  So the door comes from an input that the Node chunk build does not pass to the mesher (threeBuildingMesh.ts `doorWalls`).
  The browser worker also passes `contextFeatures` (neighbours, `contextFor`), `hostOpenings` (`openingsFor`),
  surveyed envelopes and its own per-tile `streetsFor`. All four are untested suspects. Open.
- **Lamps, labels, hoist beams, water shade: known gaps** (street furniture, POI labels; see below).

Two camera fixes from round 1 still hold:
- A clipped likeness pose is a tall frame (1440 x 1052…2700) whose top 900 rows are the picture (rule10Frames.ts
  cutWindow). The node frame rasters only those rows by moving the principal point (`WorldCamera.cx/cy`, a
  byte-identical crop in `nodeFrame.test.ts`).
- The eye stands on the rider's surface height, as in the game (riderSurfaceM). One residual case is open: at
  Rijnstraat (0363100012080338) an extra +0.7 m on the eye improves the match (mean dE 14.9 to 8.4, edge IoU 0.48
  to 0.61), while at Keizersgracht the same offset makes it worse. The game's car contact offsets may account for
  this.

Other differences that remain: house doors (above), no street furniture (lamps, bollards; hoist beams partly), no POI
labels, quay ramps and kerb details differ in places, water is a little greener, and far prisms beyond 1.5 km are
not drawn. The shader window grid on `windowGrid` GLB walls is not drawn either.

## 4. Timing

The machine was under other lanes' load throughout (load average 15 to 40). Per likeness frame at 1440 x 900,
one batch of 19 poses in one process, median:

| dpr | buffer | wall | cpu | raster | detail chunk | max wall |
|---|---|---|---|---|---|---|
| 1 | 1440 x 900 | **9.0 s** | 8.9 s | 2.9 s | 2.3 s | 12.7 s |
| 2 | 2880 x 1800 | 14.6 s | 12.6 s | 7.5 s | 2.6 s | 19.5 s |

The whole dpr 1 batch ran in 181 s for 19 frames, 9.5 s each including startup. A single cold frame costs
about 12 to 14 s: the shell decode and the first atlas load (about 3 s) are paid once per process.
The browser needs about 36 s per pose for the same run, plus a Chromium slot and a dev server.

The speed work in this round:
- Per-group frustum culling: boxes of 256 triangles, cached per draw.
- An 8-slot cache of per-triangle ray constants in the resolve pass.
- Module caches for the cell readers and decoded shells, kept across a batch.

Profile at dpr 2, in self time: rasteriseWorld 2.3 s, slot shading 1.2 s, GC 1.1 s, atlas sampling 0.9 s, zlib 0.6 s.
The next cut would be caching the detail chunk (`buildFeatureChunk`, 2–3 s a frame) for poses that share a block.

## 5. Command for lanes

Use `--dpr 1` for speed. The default is dpr 2, which is what house:frames captures.

```
# No browser at all: house:frames prepares the poses and the photo cut (--likeness --prep-only), then Node renders them
node --import tsx scripts/house-frames/node-frame.ts --pands <id,id…> [--face … | --buurt … | --list …] --out <dir> --dpr 1
# On an existing house:frames out dir (or a --prep-only dir with prepared.json)
node --import tsx scripts/house-frames/node-frame.ts <house:frames out dir>/<key>...   # likeness.node.png, pair.node.jpg
# What a pixel shows (a draw name, or detail/<pand>)
node --import tsx scripts/house-frames/node-frame.ts <dir>/<key> --probe 200,780;100,700
node --import tsx scripts/house-frames/node-frame.ts --aerial <lng>,<lat>,<zoom>,<pitch>,<bearing> --name <view> --out <dir>
```

## Round 4: camera offset, kerb ramps, chunk pands (2026-11-15, after main 894631990)

**Camera offset.** The browser was probed on port 4674 with `__canalRecallKeepGroundArrays`. The probe read the
pose's eye, the zoom, the field of view, the pitch, `riderSurfaceM` and `layersAt` along the frame. Node's projection
(near plane, eye-height rounding, pixel centre) matched the browser's; neither cause was in the camera. There were
two causes in the world instead:
- **Bridge decks.** Cached ground cells skipped `store.prepareCell`, so the measured decks were never placed. The
  rider stood up to 0.8 m low, which shifted 165078 and 080338. Cached cells now call it, for LOD 0 cells only:
  preparing every cell cost about 15 s a frame. The ground cache key now hashes all of `src/canalRecall`, not only
  `ownGround/`. Rider heights now match the browser: 164843 −0.36, 169781 0.58, 165078 1.08, 167483 −0.53,
  080338 1.52.
- **Street chunks.** On models flagged `chunkPands` (Nassaukade, for example), the browser separates the pands and
  stands each one on the lowest relief under its own footing (`_applyChunkPandBases`). Node used one anchor base for
  the whole chunk. It now does the same as the browser, through `models.ts` `separateChunkPands` and
  `liftChunkPands`, reading the GLB `extras.pandRanges` (unit-tested).

Measured vertical shift (Node against the browser, rows 15–110):

| pose | before | after |
|---|---|---|
| 164843 | (0, −7) | (0, −1) |
| 165078 | 5–6 px (strict judge) | (0, 0) |
| 080338 | deck pose, rider low | (0, 0) |

On 164843, mean dE went from 5.69 to 3.50 and edge IoU from 0.48 to 0.68. Fidelity after the deck fix, with the
other poses unchanged: 061842 3.78/0.80, 080338 6.17/0.83, 165023 4.14/0.34, 165078 4.01/0.93, 167483 6.83/0.74,
167627 4.02/0.86, 168136 5.62/0.75, 168578 4.22/0.76, 169116 6.19/0.81, 169781 3.18/0.87, 171023 5.54/0.71,
171218 4.41/0.93, 173447 5.00/0.79, 175318 5.74/0.74, 175320 3.22/0.73, 175321 5.77/0.80, 175358 6.24/0.79,
180413 1.70/0.59.

**Kerb-ramp wedges (167483): open, narrowed.** `layersAt` was compared on a 247-point grid around the ramp (land
ignored), and 62 points differ. At 32 of them the browser's cell holds kerb faces about 2.5 cm over the klinker,
where Node's cell −1_−1 has only klinker. These were ruled out:
- a stale cache (fresh rebuild);
- neighbour cells;
- LOD 1;
- a cell built alone;
- every ground flag default (roads, deterministic, planShare, groundFixes, rampGaps, crossings);
- the water cut.

Two suspects remain: the worker's `compactCell` (the browser runs compact), and plan state the worker shares across
cells. The scratch probes are in `artifacts/node-frames/bprobe/` (not committed).

**Timing.** Under machine load 70–80 during this round, ground took 90–270 s for a fresh three-pose batch. That
figure is contention, not the renderer: the 9 s a frame measured at dpr 1 was taken on a quieter machine. It needs a
re-measure on a quiet machine.
