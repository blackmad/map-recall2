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
| Building-type instances | `buildingTypes/runtime.ts` | yes | **not drawn yet** |
| Light rig, shadow box | `rendererShared/lightRig.ts`, `shadowFit.ts` | yes | used as is; shadow map + PCF re-implemented (`shadow.ts`) |
| Depth fade, draw limit | `look/depthFade.ts`, `engine/drawLimit.ts` | ranges yes, GLSL GPU | ranges used as is; the fog chunk re-implemented (`fog.ts`) |
| Sky | `look/sunny.ts` SKY.zenith clear colour | — | same clear colour |
| Camera | `ownMap/mapCamera.ts` cameraFrame, house-frames `pose.ts` frameFor | yes | used as is |
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

(filled in below after the browser frames)

## 4. Timing

(filled in below)

## 5. Command for lanes

```
node --import tsx scripts/house-frames/node-frame.ts <house:frames out dir>/<key>...   # likeness.node.png, pair.node.jpg
node --import tsx scripts/house-frames/node-frame.ts --aerial <lng>,<lat>,<zoom>,<pitch>,<bearing> --name <view> --out <dir>
```
