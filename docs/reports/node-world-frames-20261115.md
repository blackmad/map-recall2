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

### Round 2 (this table): the city-look slot dress, the kit/front chunk and model suppression

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
