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

**Blind judge (opus, sheets photo | A | B, order from the key's hash): 18 of 20 interchangeable.** The two that are not:
- 0363100012164843 (Nassaukade): browser accept, node reject. The node frame draws the walls as flat paint where the
  browser shows brick texture, and the near-black middle house comes out mid-grey. This is open.
- 0363100012180413 (Nieuwe Doelenstraat): both reject, but the neighbour in view is a different facade. The browser
  draws large dark panes, stone plaques and a cornice, close to the photo. The node frame draws the baked generic
  facade with quoins and a gable. The baked cell feature carries the same houseSpec, so the difference comes from a
  layer the node frame does not yet replicate. Open.

Two camera fixes made the numbers above. Before them, the median mean dE was about 17 and the edge IoU about 0.25:
- A clipped likeness pose is a tall frame (1440 x 1052…2700) whose top 900 rows are the picture (rule10Frames.ts
  cutWindow). The node frame now rasters only those rows by moving the principal point (`WorldCamera.cx/cy`, a
  byte-identical crop in `nodeFrame.test.ts`). Before, it drew the whole tall frame and the comparison squashed it.
- The eye stands on the rider's surface height, as in the game (riderSurfaceM). One residual case is open: at
  Rijnstraat (0363100012080338) an extra +0.7 m on the eye improves the match (mean dE 14.9 to 8.4, edge IoU 0.48
  to 0.61), while at Keizersgracht the same offset makes it worse. The game's car contact offsets may account for
  this.

Other differences that remain: no street furniture (lamps, bollards, hoist beams are partly GLB), no POI labels,
quay ramps and kerb details differ in places, water is a little greener, and far prisms beyond 1.5 km are not drawn.

## 4. Timing

The machine was under integration-gate load the whole time (load average 30 to 160), so wall times are inflated.
CPU time is the better single-core figure. Per likeness frame at 1440 x 900, dpr 2 (2880 x 1800), median over 19:
**cpu 15.5 s** (raster 11.0 s, of which visibility 4.4 s and resolve 6.4 s; shells 6.6 s; detail 4.3 s;
ground 2.8 s from the disk cache; a first visit builds ground cells at about 60 s once per area). The median wall time was 51 s
under load. The browser run took 688 s for 19 poses (two frames each, one page) at the same load, about 36 s per pose,
and it holds a Chromium slot and a dev server. The 10 s target is not met at dpr 2. At `--dpr 1` the raster stage
falls by about 4x.

## 5. Command for lanes

```
node --import tsx scripts/house-frames/node-frame.ts <house:frames out dir>/<key>...   # likeness.node.png, pair.node.jpg
node --import tsx scripts/house-frames/node-frame.ts --aerial <lng>,<lat>,<zoom>,<pitch>,<bearing> --name <view> --out <dir>
```
