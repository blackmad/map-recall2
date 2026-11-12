import { kitFadeFlag } from './engine/popFade';
import { BuildingContextIndex } from './buildingContextIndex.js';
import { blendAtZoom, presenceOf, transitionOn } from './overviewTransition/blend.js';
import { footprintTone } from './overviewTransition/basemapOverview.js';
import { ChunkBuildQueue } from './engine/worldStreamer.js';
import { poolWorkerUrl, sharedWorkerPool, type WorkerPool } from './engine/workerPool.js';
import { FrameBudget } from './engine/worldStreamer.js';
import { farPartHidden, nearTileCells } from './engine/farHandover.js';
import { buildSpecialKits, buildSpecialBoats } from './buildingSpecialChunks.js';
import {buildTransportedEnvelopeChunk,diagnosticEnvelopeTransport,EMPTY_ENVELOPE_TRANSPORT,type EnvelopeTransport} from './surveyedEnvelopeTransport.js';
// Browser adapter: facade walls for the streamed city as one three.js custom
// layer inside MapLibre's GL context (spike, 2026-10-02). See
// `public/canal-drive/RENDERING_STACK_OPTIONS.md` for why.
//
// Replaces only the `fill-extrusion-pattern` facade layer. MapLibre still draws
// the cornice band, roofs, ground colour and everything else, and the walls
// share its depth buffer. The three bundle is the page's shared copy
// (`window.CanalRecallThree`), so this adds only this module's weight.
//
// What it buys over the pattern layer: mipmapped + anisotropic cell textures
// (no shimmer at a slant), no per-integer-zoom image swap, one tinted texture
// per style instead of one per style x colour, and walls laid out in whole bays
// and storeys so openings line up with the building.

import { CELL_LAYER_COUNT, CELL_PX, STYLE_DIMS, cellLayer, CELL_KINDS, CELL_VARIANTS, paintCell, paintFatihMasonryCell } from './facadeCells.js';
import { ROOF_CELL_M, paintRoofLayers } from './roofCells.js';
import { FACADE_TIER_GLSL, ROOF_LAYERS_OFF, ROOF_TIER_GLSL, cellTapsEnabled, cellTapsOptions, cellTapsUniform, facadeTierAnisoEnabled, facadeTierAnisoUniform, facadeTierUniform, roofTierUniform } from './roofTier.js';
import { pageCoarsePointer, pageTextureParams, pageTextureTier, texturePolicyFlag, type TextureParams } from './look/texturePolicy.js';
import { withMonumentGable } from './monumentGables.js';
import { withRegisterFacts, registerFactsEnabled, registerFactsFromExtract } from './facade/registerRecipe.js';
import { withHouseSpec, withHouseSpecCrown, houseSpecsEnabled, houseSpecEnricher } from './houseSpec/decorate.js';
import { decorateRoof, exceptLandmarks as exceptLandmarksOf, fitRect, localOuterRing, planRoof, type RoofPlan } from './roofMesh.js';
import { BAY_ENTRIES, BAY_LAYER_COUNT, FATIH_MASONRY_LAYER, bayLayer, bayLookFor, bayVariant } from './bayLook.js';
import { paintGlassBlockCell } from './glassBlockTexture.js';
import { bayTextures, releaseBayTextures, type Look } from './bayTextures.js';
import { KITS, KIT_HIDE_IDS, KIT_MODELLED_IDS, KIT_PART_IDS, decorateKitRoof, kitGeometry, type KitPartGeometry, type PartInput } from './landmarkKits.js';
import { FRONT_LIST, FRONT_PART_IDS, decorateFront } from './landmarkFrontData.js';
import { frontKitGeometry } from './landmarkFronts.js';
import { LOOK_VARIANTS, PHOTO_WALL_CELL_MEAN, lookHex } from './look/palette.js';
import { litFacadeWallGain } from './look/sunny.js';
import { decorateShopfront, setShopfronts } from './shopfronts.js';
import { boatForLandmark, houseboatGeometry, houseboatsByTile, type Houseboat } from './houseboats.js';
import { buildKitChunk, type Chunk } from './threeBuildingMesh.js';
import { FALLBACK_REACH_M, SegmentGrid, streetSegments } from './streetFronts.js';
import { buildPrismGrid, buildPrismIndex, pickPrismGrid, type PrismEntry, type PrismGrid } from './prismPick.js';
import { chunkKeyDistanceM } from './chunkKeyDistance.js';
import { ORIGIN, asPolygons, cellSetOf, type BuildingLook, type Feature } from './threeBuildingFeatures.js';
export { ORIGIN, type BuildingLook };
import { FACADE_STYLES, type FacadeStyle } from './genericFacades.js';
import { validateStreetAppearanceCatalog, type StreetAppearanceCatalog, type StreetAppearanceProfile } from './streetAppearance.js';
import type { ChunkHostOpeningConfig } from './hostWallOpenings.js';
import { PROCEDURAL_RECIPE_LAYER_OFFSET } from './streetFacadeRendering.js';
import { buildingProjectionScale } from './buildingProjectionScale.js';
import { createFacadeDepthMaterial, createLitFacadeMaterial } from './rendererShared/litFacadeMaterial.js';
import { HIDDEN, HIGHLIGHT_GLSL, attachHighlightPasses, detachHighlightPasses, footprintCentroid, highlightDefines, highlightRecipe, mPerDegLng, DESATURATE_RADIUS_M, type HighlightFocus, type LngLat } from './look/highlight.js';
import { ROOF_LAYER_COUNT, RESTORE_TEXTURE_SLICE_MS, TEXTURE_SLICE_MS, calmBayLayers, lookAtlasLayers, paintLookArrays, type LookAtlasArrays } from './look/paintLookAtlas.js';
import { loadLookAtlas, lookAtlasStamp, readCachedLookAtlas, storeCachedLookAtlas } from './look/lookAtlas.js';
import { SwapSlots, clearSlot, paintSlot, swapComplementEnabled } from './swapComplement.js';
import { buildingCell } from './world/cellGrid.js';
import { shellLayerHash } from './world/shellLayers.js';
import type { BakedEntry } from './engine/bakedCoarse.js';
import { SLOT_LAYER_COUNT, cityLookEnabled, createCityLookMaterial, createCityUniforms, getCityLook, loadCityBrick, paintSlotLayers } from './look/cityLook.js';
import { FacadeRecordTexture } from './look/facadeRecordTexture.js';
import type { FacadeRecordSet } from './world/facadeStreams.js';
import { boundingSphereOf } from './geometryBounds.js';
import { cutMesh, disposeTiles, growTileSpheres } from './rendererShared/tiledGeometry.js';
import { finishTiles, type PlannedTile } from './ownGround/cellTiles.js';
import { MotionEstimate, aheadRank, lookAheadEnabled } from './streamingLookAhead.js';
import { DETAIL_LEAD_M, DETAIL_LEAD_M_TOUCH, DETAIL_MAX_TILES, DETAIL_MAX_TILES_TOUCH, detailBlock, detailBlockFrozen, detailFreezeAerialEnabled, detailLingerEnabled, type DetailBlock } from './detailRing.js';
import { ROUTE_AHEAD_M, ROUTE_AHEAD_MAX_TILES, headingAheadTiles, routeAheadEnabled, routeAheadTiles, withAhead } from './engine/routeAhead.js';
import { worldCameraOf } from './engine/worldCameraOf.js';
import type { WorldCamera } from './engine/worldViewApi.js';
import { packMask } from './look/maskPacking.js';
import { BaseRefreshSlicer, lngLatDistanceM, type SliceItem } from './rendererShared/baseRefreshBudget.js';
import { cellDebugMode, windowSdfBandEnabled, windowSdfEnabled, WINDOW_SDF_LOD_BIAS } from './look/windowSdf.js';
import { arrayMips, arrayRolloffMips, cellLodBiasFlag, cellTierBandFlag, cellTierFromBand, cellMipOptions, cellMipsEnabled, cellRolloffEnabled, cellRolloffOptions, debugLevels, layerDigitRgb, LEVEL_DEBUG_RGB, type CellRolloffOptions, type RolloffArrayLevels } from './look/cellMips.js';
import { uploadArrayMips, type ArrayMipUploadResult } from './look/arrayMipUpload.js';
import { AtlasAerialSwitch, atlasAerialEnabled, atlasAerialMeasureOnly, chunkLodEstimate, focalPxOf } from './look/atlasAerial.js';
import { isAerialView } from './rendererShared/aerialView.js';

/** A query flag's raw value, or null (tolerates a page without URLSearchParams). */
function pageFlag(name: string): string | null {
  try { return typeof URLSearchParams === 'function' ? new URLSearchParams(globalThis.location?.search ?? '').get(name) : null; } catch { return null; }
}
import { createWindowTableTexture, layerWindowRects, windowTableData } from './look/windowTable.js';

type BuildOptions = { surveyedEnvelopeData: EnvelopeTransport["envelopes"]; surveyedEnvelopeRevision: string; look: BuildingLook; streets?: Float32Array; profiles: readonly StreetAppearanceProfile[]; contextFeatures?: readonly Feature[]; appearanceRevision: string; hostOpenings: readonly ChunkHostOpeningConfig[]; hostOpeningRevision: string };

type MapLike = { _surveyedEnvelopeRoofIds?: string[]; _pyramidalRoofs?: {setHiddenReason(reason:string,ids:Iterable<string>):void}; getCanvas(): HTMLCanvasElement; triggerRepaint(): void; getZoom(): number };
type MaplibreLike = { MercatorCoordinate: { fromLngLat(lngLat: [number, number], altitude: number): { x: number; y: number; z: number; meterInMercatorCoordinateUnits(): number } } };

const TILE_ZOOM = 14;
/**
 * Detailed walls, roofs and extras stay in the nearest 2 x 2 z16 tiles (z17 on touch
 * devices). The surrounding city uses simple footprint shells with courtyard lids.
 */
const DETAIL_ZOOM = 16;
const EXTRAS_PREFIX = 'extras:';
const COARSE_PREFIX = 'coarse:';
const chunkMode = (key: string): 'walls' | 'extras' | 'coarse' => key.startsWith(EXTRAS_PREFIX) ? 'extras' : key.startsWith(COARSE_PREFIX) ? 'coarse' : 'walls';
/**
 * Far chunks' facade level (CANAL-RECALL-7), chosen like the own ground's `detail` (gameGround.ts
 * `detailFlag`): a touch device (iPad, phone: `pointer: coarse`) builds the city away from the rider's
 * detailed block as a cheaper shell; a desktop builds every chunk at `full`, unchanged.
 * `?facadeDetail=full|touch` (or `window.__canalRecallFacadeDetail` before load) is the A/B.
 */
export type FacadeDetail = 'full' | 'touch';
function facadeDetailFlag(): FacadeDetail {
  const g = globalThis as { __canalRecallFacadeDetail?: string; matchMedia?: (query: string) => { matches: boolean }; location?: { search?: string } };
  const asked = g.__canalRecallFacadeDetail ?? (g.location?.search ? new URLSearchParams(g.location.search).get('facadeDetail') : null);
  if (asked === 'full' || asked === 'touch') return asked;
  return g.matchMedia?.('(pointer: coarse)')?.matches ? 'touch' : 'full';
}
/**
 * Facade chunk tiles per side (CANAL-RECALL-7, 2026-10-29): a merged chunk can draw as `n`×`n` child meshes over its
 * own buffers (rendererShared/tiledGeometry.ts) so three.js culls the tiles off screen, a building never split across
 * two; the shared frame picks whole or tiles per chunk and frame. The chunk mesh stays whole for picking, `hidden`
 * flags, highlight passes and fades. 3 on every device; `?facadeTiles=1..4` (or
 * `window.__canalRecallFacadeTiles` before load) overrides it, `?facadeTiles=1` draws one mesh per chunk as before.
 */
const FACADE_TILES = 3;
/** Chunks smaller than this stay one mesh (a draw call per tile costs more than the culling saves). */
const FACADE_TILE_MIN_TRIANGLES = 4000;
function facadeTilesFlag(): number {
  const g = globalThis as { __canalRecallFacadeTiles?: number | string; location?: { search?: string } };
  const asked = Number(g.__canalRecallFacadeTiles ?? (g.location?.search ? new URLSearchParams(g.location.search).get('facadeTiles') : NaN));
  return Number.isInteger(asked) && asked >= 1 && asked <= 4 ? asked : FACADE_TILES;
}
/** Facades show from this map zoom (the extrusion layer's own minzoom was 14). */
export const MIN_ZOOM = 14;
const TRANSITION = transitionOn();
/** The flat overview's footprint colour the buildings emerge from (sRGB 0..1). */
const CITY_FLAT = footprintTone().map(v => v / 255);

export const VERTEX = /* glsl */ `
in vec3 position;
in vec2 uv;
in float layer;
in vec4 tint;
in vec4 accent;
in float hidden;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
out vec2 vUv;
flat out float vLayer;
out vec3 vTint;
out vec3 vAccent;
out float vShade;
flat out float vHighlight;
${HIGHLIGHT_GLSL}
out float vDist;
void main() {
  vUv = uv; vLayer = layer; vTint = tint.rgb; vAccent = accent.rgb; vShade = tint.a;
  // hidden: 0 drawn, 1 hidden, 2 the highlighted answer (plain yellow, or its own look under ?highlight=a|b|c), 3 dimmed, 4 ghosted.
  vHighlight = hlState(hidden);
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vDist = length(viewPosition.xyz);
  gl_Position = hidden > 0.5 && hidden < 1.5 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewPosition;
}`;

export const FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray cells;
uniform sampler2DArray masks;
uniform float bands;
// Untextured: the vertex colour alone, no brick, tile or grain from any cell.
uniform float flatColour;
uniform float cityFade;
uniform float cityTone;
uniform vec3 cityFlat;
${ROOF_TIER_GLSL}
${FACADE_TIER_GLSL}
in vec2 vUv;
flat in float vLayer;
in vec3 vTint;
in vec3 vAccent;
in float vShade;
flat in float vHighlight;
in float vDist;
out vec4 fragColor;
${HIGHLIGHT_GLSL}
void main() {
  if (HL_GHOST(vHighlight)) discard;
  // Screen-door coverage keeps depth writes correct while the city emerges from the overview.
  if (cityFade < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= cityFade) discard;
  if (HL_PAINT(vHighlight)) { fragColor = vec4(vec3(1.0, 0.824, 0.122) * vShade, 1.0); return; }
  vec3 p = vec3(vUv, vLayer);
  vec3 c; vec2 m;
  cellTierSample(p, vDist, c, m);
  c = roofTierColour(c, vUv, vLayer, vDist);
  c *= mix(vec3(1.0), vTint, m.r) * mix(vec3(1.0), vAccent, m.g);
  if (flatColour > 0.5) c = vTint;
  c = hlDesat(c, vHighlight);
  float shade = bands > 0.5 ? floor(vShade * bands + 0.5) / bands : vShade;
  fragColor = vec4(c * shade, 1.0);
  if (cityTone < 1.0) fragColor.rgb = mix(cityFlat, fragColor.rgb, cityTone);
}`;


const infoOf = (chunk: Chunk): ChunkInfo => ({
  buildingCount: chunk.buildingCount, wallCount: chunk.wallCount, quadCount: chunk.quadCount, vertexCount: chunk.vertexCount,
  bytes: chunk.positions.byteLength + chunk.uvs.byteLength + chunk.layers.byteLength + chunk.tints.byteLength + chunk.accents.byteLength + chunk.indices.byteLength + chunk.vertexCount,
});

export { calmBayLayers, RESTORE_TEXTURE_SLICE_MS, paintLookArrays, lookAtlasLayers };
// Lane R3-A (#230): the owner view's classes, for tests/e2e/swap-zfight.spec.ts ZFIGHT_OWNER.
export { THIN_OWNER_CLASSES } from './look/thinFade.js';


// Per-ring memo of tile keys by zoom: setFeatures regroups the whole resident city (up to ~20k buildings) on every
// tile flush and every detail-centre move, and the tile maths plus key string per building per call were most of
// its own cost while riding (docs/perf-motion-stutter-20261016.md). Keyed by the first ring, which fixes the answer.
const tileKeyMemo = new WeakMap<object, Map<number, string>>();
const tileKeyOf = (polygons: number[][][][], zoom = TILE_ZOOM): string => {
  const ring = polygons[0]?.[0];
  if (!ring) return tileKeyAt(polygons, zoom);
  let byZoom = tileKeyMemo.get(ring);
  if (!byZoom) tileKeyMemo.set(ring, byZoom = new Map());
  let key = byZoom.get(zoom);
  if (key === undefined) byZoom.set(zoom, key = tileKeyAt(polygons, zoom));
  return key;
};
const tileKeyAt = (polygons: number[][][][], zoom: number): string => {
  const [lng, lat] = polygons[0]?.[0]?.[0] ?? [0, 0];
  const n = 2 ** zoom, rad = lat * Math.PI / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return `${x}/${y}`;
};


/** Landmarks keep their own form; kit-modelled parts and bodies pass through, the rest get a period fallback (roofMesh.ts). */
const exceptLandmarks = <T extends { properties: Record<string, unknown>; type: 'Feature'; geometry: unknown }>(decorate: (f: T) => T, ids: ReadonlySet<string>, listed?: ReadonlySet<string>) => exceptLandmarksOf(decorate, ids, KIT_MODELLED_IDS, listed);
export { decorateRoof, exceptLandmarks, decorateKitRoof, decorateFront, decorateShopfront, setShopfronts, KIT_HIDE_IDS, withMonumentGable, withRegisterFacts, registerFactsEnabled, registerFactsFromExtract, withHouseSpec, withHouseSpecCrown, houseSpecsEnabled, houseSpecEnricher };

const KIT_KEY = '__kit';
/** `?kitFade` under `?popFade` (lanes P2 #325, P3 #328): the kit chunk's rebuilds cross-fade like any other chunk's. Default on. */
const KIT_FADE = kitFadeFlag();
/** chunkRank: an uninstalled coarse shell builds before detail up to this much nearer (metres of ahead rank). */
const COARSE_HOLE_BONUS_M = 400;
const CHUNK_FADE = (() => {
  try {
    const g = globalThis as { __canalRecallChunkFade?: boolean; location?: { search?: string } };
    return g.__canalRecallChunkFade !== false && new URLSearchParams(g.location?.search ?? '').get('chunkFade') !== '0';
  } catch { return true; }
})();
/**
 * Swap cross-fades (lane E4, #217: the pop-in the player sees is detail switching on buildings already there). A
 * rebuilt chunk keeps its old mesh drawn, opaque, while the new one dissolves in over it, then dissolves the old one
 * out (it used to replace it in one frame, so faces it added or lost popped); a chunk that leaves (a detail tile the
 * block left, its extras) dissolves out over the coarse shells instead of vanishing; and the dissolve is
 * CHUNK_FADE_MS 700 (350 before). Both reuse the arriving chunk's material clone,
 * which shares the program (no link in the frame). `?swapFade=0` or `window.__canalRecallSwapFade = false` restores
 * the old swaps for A/B.
 */
const SWAP_FADE = (() => {
  try {
    const g = globalThis as { __canalRecallSwapFade?: boolean; location?: { search?: string } };
    return g.__canalRecallSwapFade !== false && new URLSearchParams(g.location?.search ?? '').get('swapFade') !== '0';
  } catch { return true; }
})();
/** Arriving chunks dissolve in over this long (fadeIn); `?chunkFade=0` or `window.__canalRecallChunkFade = false` turns it off. */
const CHUNK_FADE_MS = SWAP_FADE ? 700 : 350;
/**
 * Complementary dissolve (swapComplement.ts, lane R1-A #223): the mesh a dissolving chunk replaces (the coarse shells
 * under a detail chunk, a rebuilt chunk's old mesh) draws only where the newcomer does not, on the city look's
 * `swap` program variant. `?swapComplement=0` keeps both drawn over each other during the fade, as before.
 */
const SWAP_COMPLEMENT = CHUNK_FADE && swapComplementEnabled();
/**
 * Shell roofs (threeBuildingFeatures.ts shellRoofPlan, lane R1-A #223): coarse and touch shells stop their walls at
 * the eaves under the detail path's planned roof, low-poly, in its colour, so a detail chunk replacing them changes
 * extras and shading, not the roof. `?shellRoofs=0` or `window.__canalRecallShellRoofs = false` keeps the flat lids.
 */
const SHELL_ROOFS = (() => {
  try {
    const g = globalThis as { __canalRecallShellRoofs?: boolean; location?: { search?: string } };
    return g.__canalRecallShellRoofs !== false && new URLSearchParams(g.location?.search ?? '').get('shellRoofs') !== '0';
  } catch { return true; }
})();
/**
 * A clone of a city material whose `cityFade` (the screen-door dissolve) is its own, starting at `value`; it shares the
 * source's program (same defines and cache key: no compile, no link in the frame). Null when the material has no fade.
 */
function fadeClone(source: any, value: number, under?: { value: number }): any | null {
  if (!source?.uniforms?.cityFade || typeof source.onBeforeCompile !== 'function' || !source.customProgramCacheKey) return null;
  if (under && !source.uniforms.cityUnder) return null;
  const fade = { value };
  const clone = source.clone();
  // Material.copy does not carry `defines` (only ShaderMaterial's does), and three keys a program by them:
  // without this the clone compiled a program of its own, freed when the last fade ended and linked again
  // inside the frame of the next chunk's fade (2 of the iPhone ride's 4 in-frame links, lane D 2026-10-31).
  if (source.defines) clone.defines = source.defines;
  clone.uniforms = under ? { ...source.uniforms, cityFade: fade, cityUnder: under } : { ...source.uniforms, cityFade: fade };
  clone.onBeforeCompile = (shader: any, renderer: any) => { source.onBeforeCompile(shader, renderer); shader.uniforms.cityFade = fade; if (under) shader.uniforms.cityUnder = under; };
  clone.customProgramCacheKey = () => source.customProgramCacheKey();
  if (source.defaultAttributeValues) clone.defaultAttributeValues = source.defaultAttributeValues;
  return clone;
}
/** A record material of one mesh: the shared record program, its own record texture binding, `recBase` row and `wallUnit`. */
function facadeRecordClone(source: any, texture: any, row: number, wallUnit: number): any {
  const own = { facadeRecords: { value: texture }, recBase: { value: row }, wallUnit: { value: wallUnit } };
  const clone = source.clone();
  if (source.defines) clone.defines = source.defines;
  clone.uniforms = { ...source.uniforms, ...own };
  clone.onBeforeCompile = (shader: any, renderer: any) => { source.onBeforeCompile(shader, renderer); Object.assign(shader.uniforms, own); };
  clone.customProgramCacheKey = () => source.customProgramCacheKey();
  if (source.defaultAttributeValues) clone.defaultAttributeValues = source.defaultAttributeValues;
  clone.userData = { ...source.userData, facadeRecordUniforms: { ...source.userData.facadeRecordUniforms, ...own } };
  return clone;
}
/** What the far tier reads off the facade layer (ThreeBuildings.farShellHost). `cell`: the far cell asking (a drawn baked coarse cell hides it). */
export type FarShellHostView = { THREE: any; scene: any; material: any; look: string; fadeMaterial(value: number): any | null; coarseDrawn(tile: string, cell?: string): boolean; /** A drawn `near:` detail chunk lies in this world cell (lane R4-K: such a cell is not released to the far tier). */ nearInCell(cell: string): boolean };
/**
 * The baked coarse tier as the facade layer sees it (engine/bakedCoarse.ts, lane R4-A #243): it is told the resident
 * buildings' cells while grouping (`plan`), answers which cells it covers (their buildings build no runtime `coarse:`
 * chunk) and which it draws (the far tier hides those cells).
 */
export interface BakedCoarseGate { plan(cells: ReadonlySet<string>): void; covers(cell: string): boolean; drawn(cell: string): boolean; /** Covered, not drawn, release on (BakedCoarse.holdsFar, lane R4-K). */ holdsFar?(cell: string): boolean; /** The GL context was lost: the meshes' CPU arrays are gone, fetch again. */ contextLost?(): void }
/** What the baked coarse tier reads off the facade layer (ThreeBuildings.bakedCoarseHost). */
export type BakedCoarseHostView = { THREE: any; scene: any; material: any; look: string; layerHash: string; fadeMaterial(value: number, source?: any): any | null; /** F1 (#380): a cell's record material (BakedCoarseHost.recordMaterial). */ recordMaterial(key: string, records: FacadeRecordSet, wallUnit: number): any | null; freeRecords(key: string): void; swapSlots(): boolean; attach(entry: BakedEntry & { applied?: Map<string, number> }): void; detach(entry: BakedEntry): void; groundBase(id: string): number | null | undefined; regroup(): void; setGate(gate: BakedCoarseGate | null): void; /** Per drawn frame (the dissolves), from the render, not the game's sync. */ setFrame(fn: (() => void) | null): void };
const BOAT_PREFIX = 'boats:';
/** What setFeatures groups a feature by, memoised per feature object (ThreeBuildings.groupOf). */
interface FeatureGroupInfo { geometry: unknown; id: string; kit: boolean; tile: string | null; coarse: string | null; near: string; nearKey: string; extrasKey: string; /** world-v1 cell (first vertex), for the baked coarse gate. */ cell: string | null }
/** `?featureGroupCache=0` (or `window.__canalRecallFeatureGroupCache = false`): the uncached grouping loop. */
export function featureGroupCacheEnabled(): boolean {
  try {
    const g = globalThis as { __canalRecallFeatureGroupCache?: boolean; location?: { search?: string } };
    if (typeof g.__canalRecallFeatureGroupCache === 'boolean') return g.__canalRecallFeatureGroupCache;
    return new URLSearchParams(g.location?.search ?? '').get('featureGroupCache') !== '0';
  } catch { return true; }
}
/** Boat chunks build from the houseboat extract, not features: one shared empty source keeps them stable. */
const NO_SOURCE: Feature[] = [];
/** The chunk worker sits next to this bundle (three-buildings-worker.bundle.js). */
/** This bundle's script URL: its `?v=` deploy stamp versions the stored atlas (look/lookAtlas.ts). */
const BUNDLE_SRC = typeof document !== 'undefined' ? (document.currentScript as HTMLScriptElement | null)?.src ?? '' : '';
const WORKER_URL = typeof document !== 'undefined' ? poolWorkerUrl((document.currentScript as HTMLScriptElement | null)?.src ?? '') : '';
type ChunkReply = { key: string; gen: number; chunk: Chunk; ms: number; appearanceRevision: string; hostOpeningRevision: string; surveyedEnvelopeRevision: string; boundParentIds: string[]; /** The facade tiles' x/y partition, cut in the worker (cellTiles.ts planTiles) at `tiles` per side. */ tiles?: { n: number; plan: PlannedTile[] | null } };
/** Worker-cut tile plans of the chunks waiting to install (finished after the ground lift: cellTiles.ts finishTiles). */
const plannedTiles = new WeakMap<Chunk, { n: number; plan: PlannedTile[] | null }>();
const KIT_HIDE_SET: ReadonlySet<string> = new Set(KIT_HIDE_IDS);


/** What stays after upload: counts only, never the typed arrays. */
type ChunkInfo = { buildingCount: number; wallCount: number; quadCount: number; vertexCount: number; bytes: number };

export type ThreeBuildingStats = { kitVertices: number; chunks: number; buildings: number; walls: number; quads: number; vertices: number; geometryMB: number; textureMB: number; drawCalls: number; triangles: number; buildMs: number; detail: FacadeDetail };

/**
 * The game's colour and tint-mask texture arrays for a look (also used by the gallery pages).
 * `slotLayers` (`?cityLook=1`, look/cityLook.ts `paintSlotLayers`): the material-slot layers,
 * appended after the bay cells; `slotBase` is where they start. Without it the arrays are
 * exactly the bay cells, as before. Painting is look/paintLookAtlas.ts `paintLookArrays`.
 */
export async function buildLookTextures(THREE: any, look: 'procedural' | Look, maxAnisotropy: number, size = CELL_PX, options: { slotLayers?: boolean | { colour: Uint8Array; mask: Uint8Array }; sliceMs?: number | (() => number) } = {}): Promise<{ colour: any; mask: any; slotBase: number }> {
  return lookTexturesOf(THREE, await paintLookArrays(look, size, options), maxAnisotropy);
}

/** Texture arrays over painted (or pre-painted, look/lookAtlas.ts) atlas bytes; the CPU copy goes after upload. */
/** The roll-off chain in numbers: layers rolled off and from which level, by pitch source. */
function rolloffSummary(got: RolloffArrayLevels): { rolled: number; byLevel: Record<string, number>; bySource: Record<string, number> } {
  const byLevel: Record<string, number> = {}, bySource: Record<string, number> = {};
  let rolled = 0;
  for (const l of got.layers) { bySource[l.source] = (bySource[l.source] ?? 0) + 1; if (!l.from) continue; rolled++; byLevel[l.from] = (byLevel[l.from] ?? 0) + 1; }
  return { rolled, byLevel, bySource };
}

export function lookTexturesOf(THREE: any, atlas: LookAtlasArrays, maxAnisotropy: number): { colour: any; mask: any; slotBase: number } {
  const { size, total } = atlas;
  const array = (data: Uint8Array, format: any) => {
    const t = new THREE.DataArrayTexture(data, size, size, total);
    t.format = format; t.type = THREE.UnsignedByteType;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.userData = { bytes: data.byteLength };
    t.onUpdate = releaseTextureData;
    t.generateMipmaps = true; t.anisotropy = maxAnisotropy; t.unpackAlignment = 1; t.needsUpdate = true;
    return t;
  };
  // The accent goes up in the colour's alpha and the mask as R8 (look/maskPacking.ts); `?maskFormat=rg` keeps RG.
  const packed = packMask(atlas.colour, atlas.mask);
  return { colour: array(packed.colour, THREE.RGBAFormat), mask: array(packed.mask, packed.channels === 1 ? THREE.RedFormat : THREE.RGFormat), slotBase: atlas.layers };
}

/**
 * Drops a texture array's CPU copy after upload (three calls `onUpdate(texture)`).
 * Module-level on purpose: an arrow inside the builder kept the builder's scope,
 * and with it the full colour and mask arrays (~18 MB on a phone), alive.
 */
function releaseTextureData(texture: { image: { data: unknown } }): void { texture.image.data = null; }

/** Own ground: a feature's base height (metres), undefined while its relief is not resident, null where there is none. */
export type GroundBaseFn = (feature: Feature) => number | null | undefined;
/** Per chunk: what each building was lifted by, and which still wait for their relief. */
type GroundLift = { applied: Map<string, number>; pending: Set<string>; features: Map<string, Feature> };
/** The sliced re-base's per-call budget (refreshGroundBases); `done` is written back. */
export type GroundBaseBudget = { ms: number; centre: readonly [number, number]; restart?: boolean; done?: boolean };
/** A chunk's place for the sliced re-base order: its first building's first vertex ([lng, lat]). */
function chunkAnchor(lift: GroundLift): [number, number] | null {
  for (const feature of lift.features.values()) {
    const g: any = feature?.geometry;
    const p = g?.type === 'Polygon' ? g.coordinates?.[0]?.[0] : g?.type === 'MultiPolygon' ? g.coordinates?.[0]?.[0]?.[0] : null;
    if (p && Number.isFinite(p[0]) && Number.isFinite(p[1])) return [p[0], p[1]];
  }
  return null;
}

/**
 * Main-thread work per display frame for staging worker-built chunks (ground lift) before they
 * install. A z14 coarse chunk carries ~1–3k buildings, and lifting them all at once (each footprint
 * sampled on the relief) plus the bounding sphere was 90–140 ms in one message handler while riding
 * (docs/perf-motion-stutter-20261016.md). Staged, the old chunk keeps drawing until the new one swaps in.
 */
export const INSTALL_BUDGET_MS = 4;
/**
 * Chunk geometry the main thread installs (and the GPU then uploads) per frame, bytes of typed arrays
 * (engine/worldStreamer.ts FrameBudget, lane L4). The first chunk of a frame always installs, as before; small
 * chunks (kits, boats, a sparse tile's walls) may follow it in the same frame while they fit. `?uploadBudget=N`
 * (bytes; 0 = one chunk per frame, the old rule) overrides it for measurement.
 */
export const INSTALL_BUDGET_BYTES = 1 << 20;
function installBudgetBytes(): number {
  try { const v = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('uploadBudget') : null; if (v != null && v !== '' && Number.isFinite(Number(v))) return Math.max(0, Number(v)); } catch { /* no location */ }
  return INSTALL_BUDGET_BYTES;
}
const chunkBytes = (c: Chunk): number => [c.positions, c.uvs, c.layers, c.tints, c.accents, c.indices, c.thin].reduce((s, a) => s + (a?.byteLength ?? 0), 0);
type StagedInstall = { key: string; source: Feature[]; chunk: Chunk; ms: number; options: BuildOptions; boundParentIds: string[]; lift?: GroundLift; ranges?: Map<string, { start: number; count: number }> };


export class ThreeBuildings {
  private visible = true;
  private THREE: any;
  private scene: any;
  private material: any;
  private renderer: any;
  private camera: any;
  /** The view's zoom through the WorldCamera, not the CameraMap shim (P5 B6: getZoom was 82 calls/s). */
  private worldCamera: WorldCamera | null = null;
  private get view(): WorldCamera { return this.worldCamera ??= worldCameraOf(this.map); }
  private readonly chunks = new Map<string, { source: Feature[]; mesh: any; info: ChunkInfo; ranges: Map<string, { start: number; count: number }>; lift?: GroundLift }>();
  /** Click index per installed chunk, built on its first click (`prismPick.ts`). */
  private readonly pickIndex = new WeakMap<object, PrismEntry[]>();
  /** Its grid (`prismPick.ts` `buildPrismGrid`): a pick tests only the buildings in the cells its ray crosses. */
  private readonly pickGrid = new WeakMap<object, PrismGrid>();
  /** Own ground: the range of a chunk's applied lifts, keyed by its size and the hidden revision (bounds the grid walk). */
  private readonly liftBounds = new WeakMap<object, { key: string; min: number; max: number }>();
  /** Own ground (`?ownGround=1`): a building's base on the relief; undefined = not known yet, null = no relief there. */
  private groundBase: GroundBaseFn | null = null;
  /** Ids hidden per reason (the answer building, signature models); a facade is hidden while any reason holds it. */
  private readonly hiddenBy = new Map<string, Set<string>>();
  private hidden = new Set<string>();
  private highlighted = new Set<string>();
  private readonly pending = new ChunkBuildQueue();
  /** Pool worker -> the chunk key it is building. */
  private readonly busy = new Map<number, string>();
  private unsubscribePool: (() => void) | null = null;
  private pumping = false;
  private lastBuildMs = 0;
  private transform: any = null;

  private look: BuildingLook;
  private requestedLook: BuildingLook;
  private readonly materials = new Map<BuildingLook, any>();
  private sourceGroups = new Map<string, Feature[]>();
  private contextGroups = new Map<string, Feature[]>();
  private textureSets = new Map<BuildingLook, Promise<{ colour: any; mask: any; slotBase: number }>>();
  /** `?cityLook=1`: facades draw with the city look (look/cityLook.ts) and their array carries the slot layers. */
  private readonly cityLook = cityLookEnabled();
  /** Painting slice while something waits on the facades (hurryAtlas); undefined: the first-load slice. */
  private atlasSliceMs: number | undefined;
  /**
   * The settle hold is waiting on the facades (engine/settle.ts): paint the rest of the atlas in restore-sized slices.
   * Behind the loading screen nothing is riding, and at 6 ms slices the ~0.4 s paint stretched to ~3 s of wall time
   * against the boot's other tasks (cache-probe, 2026-11-01). Same pixels.
   */
  hurryAtlas(): void {
    if (!this.ready) this.atlasSliceMs = RESTORE_TEXTURE_SLICE_MS;
    // Installs, one budgeted drain per animation frame, also go on timers while the hold waits: frames came 0.3-0.9 s
    // apart behind the loading screen. Back to frames once nothing is left to install.
    if (this.staged.length || this.pending.length || this.inflight.size) this.installHurried = true;
  }
  private installHurried = false;
  /** Where the facade atlas came from (look/lookAtlas.ts): the pre-painted extract, or why it was painted. */
  atlasSource: { reason: string; ms: number; file: string; paintMs?: number } | null = null;
  private lookToken = 0;
  private appearanceToken = 0;
  private envelopeLoadToken = 0;
  private surveyedEnvelopeTransport = EMPTY_ENVELOPE_TRANSPORT;
  private appearanceRevision = '';
  private appearanceProfiles: readonly StreetAppearanceProfile[] = [];
  private appearanceStreets: SegmentGrid | null = null;
  private appearanceLoaded = false;
  private pool: WorkerPool | null | undefined;
  private readonly gens = new Map<string, number>();
  private readonly inflight = new Map<string, Feature[]>();
  private readonly inflightOptions = new Map<string, BuildOptions>();
  private readonly staged: StagedInstall[] = [];
  private stageScheduled = false;
  private hostWallOpenings: readonly ChunkHostOpeningConfig[] = [];
  private hostWallOpeningsRevision = '[]';
  private boatTiles = new Map<string, Houseboat[]>();
  private boatIds: ReadonlySet<string> = new Set();
  private boats: readonly Houseboat[] = [];
  private waterLevel = 0;
  private lastFeatures: readonly Feature[] = [];
  private contextIndex?: BuildingContextIndex<Feature>;
  private detailTiles = new Set<string>();
  private installedDetailIds = new Set<string>();
  private readonly detailZoom = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches ? 17 : DETAIL_ZOOM;
  /**
   * What the chunks away from the rider's detailed block draw (`facadeDetailFlag()` above): `touch`
   * gives them one quad per wall and their flat lid; `full` is the desktop build, unchanged.
   */
  private readonly detail: FacadeDetail;
  /** Facade chunk tiles per side (facadeTilesFlag). */
  private readonly facadeTiles = facadeTilesFlag();


  constructor(private readonly map: MapLike, private readonly maplibregl: MaplibreLike, look: BuildingLook = 'procedural', options: { detail?: FacadeDetail } = {}) {
    this.look = this.requestedLook = look;
    this.detail = options.detail ?? facadeDetailFlag();
    // Nearest-ahead chunk first (chunkRank); `?lookAhead=0` keeps request order.
    this.pending.setRank(key => this.lookAheadOn === false ? NaN : this.chunkRank(key));
  }

  /** Resolve the building under a screen point to an exact building ID.
   * Each chunk's buildings are tested as extruded footprints (`prismPick.ts`):
   * the drawn buffers are released on the CPU, and rebuilding a chunk's whole
   * facade layout per click cost ~2 s. Shader-hidden replacement meshes must
   * never intercept a click on the manual model that replaced them. */
  inspectAtScreen(x: number, y: number, width: number, height: number): any {
    if (!this.visible || !this.ready || !this.camera || !this.THREE || !width || !height) return null;
    const T = this.THREE;
    const projection = this.camera.projectionMatrix;
    const inverse = projection.clone().invert();
    const nx = x / width * 2 - 1, ny = 1 - y / height * 2;
    const near = new T.Vector3(nx, ny, -1).applyMatrix4(inverse);
    const far = new T.Vector3(nx, ny, 1).applyMatrix4(inverse);
    const ray = new T.Ray(near.clone(), far.clone().sub(near).normalize());
    const toLocal = new T.Matrix4();
    let result: any = null;
    // Baked coarse cells (lane R4-A #243) are picked from their resident features, in the chunk frame (the mesh sits at the cell origin).
    const baked = [...this.bakedEntries.values()].map(e => ({ key: `baked:${e.key}`, chunk: { mesh: e.mesh, source: this.bakedSources.get(e.key) ?? [], ranges: e.ranges, lift: e.applied ? { applied: e.applied } : undefined, offset: e.mesh.position } }));
    for (const [key, chunk] of [...this.chunks.entries(), ...baked.map(b => [b.key, b.chunk] as const)] as [string, { mesh: any; source: Feature[]; ranges: Map<string, { start: number; count: number }>; lift?: { applied: Map<string, number> }; offset?: any }][]) {
      // Extras (dormers, chimneys) belong to buildings their walls chunk already holds.
      if (!chunk.mesh || !chunk.source.length || key.startsWith(EXTRAS_PREFIX)) continue;
      chunk.mesh.updateWorldMatrix(true, false);
      const sphere = chunk.mesh.geometry.boundingSphere?.clone().applyMatrix4(chunk.mesh.matrixWorld);
      if (sphere && !ray.intersectsSphere(sphere)) continue;
      const memo: object = chunk.offset ? chunk.source : chunk; // a baked cell's entry is made per click; its source list is stable
      let index = this.pickIndex.get(memo);
      if (!index) this.pickIndex.set(memo, index = buildPrismIndex(chunk.source, ORIGIN));
      let grid = this.pickGrid.get(memo);
      if (!grid || grid.entries !== index) this.pickGrid.set(memo, grid = buildPrismGrid(index));
      toLocal.copy(chunk.mesh.matrixWorld).invert();
      const o = near.clone().applyMatrix4(toLocal), d = far.clone().applyMatrix4(toLocal).sub(o);
      // A baked cell's mesh may be scaled to its Int16 grid (the unit): pick in metres from the cell origin.
      const unit = chunk.offset ? chunk.mesh.scale.x || 1 : 1;
      if (chunk.offset) { o.multiplyScalar(unit); d.multiplyScalar(unit); o.x += chunk.offset.x; o.y += chunk.offset.y; o.z += chunk.offset.z; }
      const hiddenAttribute = chunk.mesh.geometry.getAttribute('hidden');
      const lift = chunk.lift?.applied;
      const bounds = this.liftRange(lift);
      const skip = (id: string) => {
        const range = chunk.ranges.get(id);
        if (!range || this.hidden.has(id)) return true;
        const hidden = hiddenAttribute?.getX(range.start);
        return hidden > 0.5 && hidden < 1.5;
      };
      const liftOf = (id: string) => lift?.get(id) ?? 0;
      const hit = pickPrismGrid(grid, [o.x, o.y, o.z], [d.x, d.y, d.z], liftOf, skip, bounds.min, bounds.max);
      if (!hit) continue;
      const point = o.clone().addScaledVector(d, hit.t);
      if (chunk.offset) { point.x -= chunk.offset.x; point.y -= chunk.offset.y; point.z -= chunk.offset.z; point.multiplyScalar(1 / unit); }
      point.applyMatrix4(chunk.mesh.matrixWorld);
      const depth = point.applyMatrix4(projection).z;
      if (depth < -1 || depth > 1 || result && depth >= result.depth) continue;
      const feature = chunk.source.find(feature => String(feature.properties.id) === hit.entry.id);
      if (!feature) continue;
      const p = feature.properties || {};
      const at = (this.map as any).unproject([x, y]);
      result = { id: hit.entry.id, name: p.name || p['name:en'] || '',
        height: Number(p.height) || undefined, lngLat: [at.lng, at.lat], depth,
        footprint: feature.geometry,
        featureTarget: { source: 'osm-building-appearance', id: hit.entry.id } };
    }
    return result;
  }

  /** Lowest and highest own-ground lift applied in a chunk (0, 0 without one). */
  private liftRange(applied: Map<string, number> | undefined): { min: number; max: number } {
    if (!applied?.size) return { min: 0, max: 0 };
    const key = `${applied.size}|${this.hiddenRevision}`;
    let bounds = this.liftBounds.get(applied);
    if (bounds?.key === key) return bounds;
    let min = 0, max = 0;
    for (const z of applied.values()) { if (z < min) min = z; if (z > max) max = z; }
    this.liftBounds.set(applied, bounds = { key, min, max });
    return bounds;
  }

  getLook(): BuildingLook { return this.requestedLook; }

  /** Keep every resident mesh paired with the atlas and palette it was built for. */
  private bindLookMaterial(look: BuildingLook, set: { colour: any; mask: any; slotBase: number }): void {
    let material = this.materials.get(look);
    if (!material) {
      // The lit material's onBeforeCompile does not survive clone(); city-look materials get their own uniforms.
      material = this.lit || this.cityLook ? this.newMaterial() : this.material.clone();
      this.materials.set(look, material);
    }
    const sw = this.atlasSwitches.get(set) ?? null;
    if (sw !== this.atlasAerial || (sw && this.atlasHalf !== (sw.bound !== sw.full))) {
      this.atlasAerial = sw; this.atlasHalf = !!sw && sw.bound !== sw.full;
      this.refreshCellTier();
    }
    material.uniforms.cells.value = set.colour;
    material.uniforms.masks.value = set.mask;
    material.uniforms.bands.value = LOOK_VARIANTS[look].shadeBands;
    material.uniforms.flatColour.value = LOOK_VARIANTS[look].flatColour ? 1 : 0;
    // Lit facades take the sunny look's wall exposure (look/sunny.ts litFacadeWallGain), in the city look too since its re-level (2026-10-30).
    if (material.uniforms.wallGain) material.uniforms.wallGain.value = litFacadeWallGain(LOOK_VARIANTS[look].litWallGain);
    this.material = material;
    this.textureMB = (set.colour.userData.bytes + set.mask.userData.bytes) * 4 / 3 / 1048576;
    if (this.cityLook) {
      // Slot meshes (recipe houses, landmarks, building types) follow the look's shading rules, and in the
      // shared frame (one renderer) sample this very array: one texture for every building.
      const city = getCityLook(this.THREE);
      city.uniforms.bands.value = LOOK_VARIANTS[look].shadeBands;
      city.uniforms.flatColour.value = LOOK_VARIANTS[look].flatColour ? 1 : 0;
      if (this.sharedFrame) city.bindAtlas(set);
    }
  }

  /** Invalidate work at request time, before awaiting textures or pumping queued jobs. */
  private invalidateBuilds(): void {
    for (const key of new Set([...this.gens.keys(), ...this.inflight.keys(), ...this.sourceGroups.keys()])) {
      this.gens.set(key, (this.gens.get(key) ?? 0) + 1);
    }
    this.inflight.clear();
    this.inflightOptions.clear();
    this.pending.clear();
  }

  /** Update every resident/in-flight chunk atomically with respect to profile revision. */
  setStreetAppearance(catalog: StreetAppearanceCatalog): void {
    const admitted = validateStreetAppearanceCatalog(catalog);
    if (this.appearanceRevision === admitted.revision) return;
    // Detach inputs from callers, including mutable recipe/evidence arrays.
    const detached = JSON.parse(JSON.stringify(admitted)) as StreetAppearanceCatalog;
    this.appearanceProfiles = detached.profiles;
    this.appearanceStreets = detached.streetFrontPaths?.length ? new SegmentGrid(streetSegments(detached.streetFrontPaths, ORIGIN)) : null;
    this.appearanceRevision = admitted.revision;
    this.invalidateBuilds();
    for (const [key, source] of this.sourceGroups) this.pending.push(key, () => this.rebuild(key, source));
    this.pump();
    this.map.triggerRepaint();
  }

  /** Explicit diagnostic opt-in only. No source IDs or URLs are enabled by default. */
  setDiagnosticSurveyedEnvelopes(payload: unknown): boolean {
    ++this.envelopeLoadToken;
    const next = diagnosticEnvelopeTransport(payload);
    this.surveyedEnvelopeTransport = next ?? EMPTY_ENVELOPE_TRANSPORT;
    this.invalidateBuilds();
    // Old source-owned tops cannot continue suppressing roofs after disabling/replacing their data.
    for (const [key, entry] of [...this.chunks]) if (entry.mesh?.userData.boundParentIds?.length) this.dropChunk(key);
    for (const [key, source] of this.sourceGroups) this.pending.push(key, () => this.rebuild(key, source));
    this.refreshSurveyedRoofOwnership();
    this.pump(); this.map.triggerRepaint();
    return !!next;
  }

  async loadDiagnosticSurveyedEnvelopes(url: string): Promise<boolean> {
    const token = ++this.envelopeLoadToken;
    try {
      const response = await fetch(url, {cache:'no-cache'});
      if (!response.ok) throw new Error(`Envelope request ${response.status}`);
      const payload = await response.json();
      return token === this.envelopeLoadToken && this.setDiagnosticSurveyedEnvelopes(payload);
    } catch {
      if (token === this.envelopeLoadToken) this.setDiagnosticSurveyedEnvelopes({schemaVersion:1,diagnosticOnly:true,envelopes:[]});
      return false;
    }
  }

  private async loadStreetAppearance(): Promise<void> {
    if (typeof document === 'undefined' || !document.baseURI) return;
    this.appearanceLoaded = true;
    const token = ++this.appearanceToken;
    try {
      const response = await fetch(new URL('../data/street-appearance/profiles.json', document.baseURI), { cache: 'no-cache' });
      if (!response.ok) return; // Existing period priors remain available offline.
      const catalog = await response.json();
      if (token === this.appearanceToken) this.setStreetAppearance(catalog);
    } catch (error) {
      console.warn('Street appearance unavailable; using period priors', error);
    }
  }

  /** Switch each chunk's geometry, vertex colors and material together after textures arrive. */
  async setLook(look: BuildingLook): Promise<void> {
    if (look === this.requestedLook && this.ready && this.material?.uniforms.cells.value) return;
    const token = ++this.lookToken;
    this.requestedLook = look;
    this.invalidateBuilds();
    if (!this.THREE) { this.look = look; return; } // onAdd picks up the latest request
    const set = await this.texturesFor(cellSetOf(look));
    if (token !== this.lookToken) return;
    // Tile arrivals during texture loading may have queued jobs for the former look. Jobs for this look (the first
    // load: the workers build the spawn's chunks while the atlas paints, #129 settle hold) are kept and install now.
    const same = this.look === look;
    if (!same) this.invalidateBuilds();
    this.look = look;
    this.bindLookMaterial(look, set);
    this.ready = true;
    this.atlasSliceMs = undefined;
    const staged = new Set(this.staged.map(s => s.key));
    for (const [key, source] of this.sourceGroups) {
      if (same && (this.inflight.has(key) || staged.has(key) || this.pending.has(key))) continue;
      this.pending.push(key, () => this.rebuild(key, source));
    }
    this.pump();
    this.scheduleStage();
    this.map.triggerRepaint();
  }

  /** Build (once) the colour and tint-mask texture arrays for a look. */
  private texturesFor(look: 'procedural' | Look): Promise<{ colour: any; mask: any; slotBase: number }> {
    let set = this.textureSets.get(look);
    if (!set) { this.textureSets.set(look, set = this.buildTextures(look, this.restoring ? RESTORE_TEXTURE_SLICE_MS : undefined)); this.restoring = false; }
    return set;
  }

  private async buildTextures(look: 'procedural' | Look, sliceMs?: number): Promise<{ colour: any; mask: any; slotBase: number }> {
    // Size and filtering from the one texture policy (look/texturePolicy.ts): desktop `high` 512 px cells at 16x,
    // everything else (and `?texturePolicy=0`) the 256 / 128 px cells at 16 / 4 they always were.
    const policy = this.texturePolicy();
    const size = policy.cellPx;
    // The slot layers join this array only in the shared frame, where slot meshes sample it (one renderer, one
    // upload). Legacy layers each own a renderer, so there slot meshes keep the city look's small slot-only array.
    const slots = !!(this.cityLook && this.sharedFrame), anisotropy = policy.anisotropy;
    // Pre-painted atlas (look/lookAtlas.ts): this browser's own bytes from an earlier visit, or (opt-in) the shipped
    // extract, instead of ~200 canvas cells painted on the main thread. Anything short of exact bytes paints as before.
    const { layers, total } = lookAtlasLayers(look, slots), started = performance.now(), stamp = lookAtlasStamp(BUNDLE_SRC);
    const cached = await readCachedLookAtlas(stamp, look, size, slots, layers, total);
    if (cached) { this.atlasSource = { reason: 'cache', ms: Math.round(performance.now() - started), file: '' }; return this.withColourMips(lookTexturesOf(this.THREE, cached, anisotropy), cached, sliceMs, look); }
    const load = await loadLookAtlas(new URL('../data/extracts/amsterdam', document.baseURI).href, look, size, slots, layers, total);
    this.atlasSource = { reason: load.reason, ms: Math.round(load.ms), file: load.file };
    if (load.atlas) return this.withColourMips(lookTexturesOf(this.THREE, load.atlas, anisotropy), load.atlas, sliceMs, look);
    const paintStarted = performance.now();
    const painted = await paintLookArrays(look, size, { slotLayers: slots, sliceMs: () => this.atlasSliceMs ?? sliceMs ?? TEXTURE_SLICE_MS });
    this.atlasSource.paintMs = Math.round(performance.now() - paintStarted);
    storeCachedLookAtlas(stamp, painted, look, slots);
    return this.withColourMips(lookTexturesOf(this.THREE, painted, anisotropy), painted, sliceMs, look);
  }

  /**
   * The facade colour array's own mip chain (look/cellMips.ts, lane R3-B #231). The array goes up as before, with GL's
   * mips, so nothing waits for this; the custom levels are built afterwards in frame-sized slices (~2 s of slices on
   * the 222-layer desktop atlas) and then replace levels 1..N in the same storage (look/arrayMipUpload.ts), so the
   * facades sharpen a moment after they appear. `?cellMips=0` keeps GL's mips. `cellMipsInfo` records the cost.
   */
  private withColourMips<T extends { colour: any; mask?: any }>(set: T, atlas: LookAtlasArrays, sliceMs?: number, look?: 'procedural' | Look): T {
    if (atlas.size & (atlas.size - 1)) return set;
    this.atlasAerialFor(set, atlas, look);
    if (!cellMipsEnabled()) return cellRolloffEnabled() ? this.withRolloffMips(set, atlas, sliceMs, look) : set;
    const texture = set.colour, colour = atlas.colour, mask = atlas.mask, { size, total } = atlas;
    const options = cellMipOptions(), keep = pageFlag('cellMipsKeep') === '1';
    void (async () => {
      const started = performance.now();
      // lookTexturesOf has packed the accent into the colour's alpha (in place): the levels carry what the shader reads.
      const { levels } = await arrayMips(colour, size, total, mask, 2, options, this.atlasSliceMs ?? sliceMs ?? TEXTURE_SLICE_MS);
      const info: NonNullable<ThreeBuildings['cellMipsInfo']> = { buildMs: Math.round(performance.now() - started), options, size, layers: total, levels: levels.length, upload: null };
      this.cellMipsInfo = info;
      // Three uploads the array on the first frame that draws it; wait for that (at most ~10 s of frames).
      for (let i = 0; i < 600 && !this.renderer?.properties?.get?.(texture)?.__webglTexture; i++) await new Promise(r => requestAnimationFrame(r));
      if (!this.renderer?.getContext?.()) return;
      info.upload = uploadArrayMips(this.renderer, texture, levels, size, total);
      // `?cellMipsKeep=1` (probes only): keep the CPU levels so setCellMipsMode can A/B them against GL's in one page.
      if (keep) this.cellMipsKept = { texture, levels, size, depth: total, colour, mask };
      this.map.triggerRepaint();
    })();
    return set;
  }
  /**
   * `?atlasAerial=1` (lane R4-J #254, look/atlasAerial.ts): the switch that swaps this pair for a half-size one while
   * the facade-density floor says no sample reads level 0. Made before the pair's first upload (it keeps level 0 in
   * Cache Storage for the restore); off with custom mips, the roll-off chain or footprint taps (they need level 0's
   * own chain or the tier scale they read).
   */
  private atlasAerialFor(set: { colour: any; mask?: any }, atlas: LookAtlasArrays, look?: 'procedural' | Look): void {
    if (!atlasAerialEnabled() || !this.THREE) return;
    const disabled = atlasAerialMeasureOnly() ? 'measure only' : cellMipsEnabled() || cellRolloffEnabled() ? 'custom mips' : this.tapsFor() ? 'footprint taps' : null;
    const sw = new AtlasAerialSwitch({
      THREE: this.THREE,
      renderer: () => this.renderer,
      bind: (pair, half) => {
        set.colour = pair.colour; set.mask = pair.mask;
        if (this.atlasAerial !== sw) return;
        this.atlasHalf = half;
        this.bindLookMaterial(this.look, set as any);
        this.refreshCellTier();
      },
      repaint: () => this.map.triggerRepaint(),
    }, { colour: set.colour, mask: set.mask }, atlas.size, atlas.total, disabled);
    this.atlasSwitches.set(set, sw);
    (globalThis as any).__canalRecallAtlasAerialSwitch = sw;
    void look;
  }
  private atlasSwitches = new WeakMap<object, AtlasAerialSwitch>();
  private atlasAerial: AtlasAerialSwitch | null = null;
  /** The half pair is bound: the facade tier's texel rates halve with textureSize (look/atlasAerial.ts). */
  private atlasHalf = false;
  private atlasFrame = 0;

  /** Every live material's facade tier band, after the bound pair changed size. */
  private refreshCellTier(): void {
    const value = this.cellTierValue();
    for (const material of new Set([this.material, ...this.materials.values()])) {
      const u = material?.uniforms?.cellTier;
      if (u && Array.isArray(u.value) && u.value[0] >= 0) u.value = value;
    }
  }

  /** The switch's frame: eye height and focal length from the frame matrices; the nearest chunk for the curve. */
  private tickAtlasAerial(ctx: any): void {
    const sw = this.atlasAerial, f = ctx?.frame, gl = this.renderer?.getContext?.();
    if (!sw || !f?.eye || !gl) return;
    const eyeM = f.eye[2] / f.unitsPerMetre, focalPx = focalPxOf(f.clipFromWorld, gl.drawingBufferHeight);
    const lodBias = Number(this.material?.uniforms?.cellLodBias?.value ?? 0) || 0;
    let chunkLod: number | null = null, aerial = false;
    if ((this.atlasFrame++ % 6) === 0 && this.THREE) {
      const eye = new this.THREE.Vector3(f.eye[0], f.eye[1], f.eye[2]).applyMatrix4(ctx.worldFromMercator);
      let nearest = Infinity;
      for (const e of [...this.chunks.values(), ...this.bakedEntries.values()] as any[]) {
        const mesh = e?.mesh;
        if (!mesh?.visible || !mesh.geometry?.boundingSphere) continue;
        const sphere = mesh.geometry.boundingSphere.clone().applyMatrix4(mesh.matrixWorld);
        nearest = Math.min(nearest, Math.max(0, sphere.center.distanceTo(eye) - sphere.radius));
      }
      chunkLod = Number.isFinite(nearest) ? chunkLodEstimate(nearest, focalPx, sw.size, lodBias) : null;
      const m = this.map as any;
      aerial = isAerialView(ctx.zoom, m.getPitch?.() ?? 0, m.getCenter?.()?.lat ?? 52.37);
    }
    sw.frame({ eyeM, focalPx, lodBias, t: performance.now(), aerial, chunkLod });
  }

  private cellMipsKept: { texture: any; levels: Uint8Array[]; size: number; depth: number; colour: Uint8Array; mask: Uint8Array; rolloff?: { maskTexture: any; maskLevels: Uint8Array[] | null; maskChannels: 1 | 2; maskBytes: Uint8Array | null; rects: ((layer: number) => readonly { x0: number; x1: number; y0: number; y1: number }[] | null) | undefined } } | null = null;

  /**
   * The roll-off chain (look/cellMips.ts arrayRolloffMips, lane R3-E #240): as withColourMips, after the first upload
   * and in frame-sized slices, levels 1..N of the colour array and of the tint mask array are replaced by GL's box
   * cascade with each layer's window grid blurred away at the levels where its pitch nears two texels. `?cellRolloff=0`
   * keeps GL's chain; `cellRolloffInfo` records the cost; `?cellMipsKeep=1` keeps the CPU levels for in-page A/B.
   */
  private withRolloffMips<T extends { colour: any; mask?: any }>(set: T, atlas: LookAtlasArrays, sliceMs?: number, look?: 'procedural' | Look): T {
    const texture = set.colour, maskTexture = set.mask ?? null, colour = atlas.colour, { size, total } = atlas;
    // The packed mask's bytes (R8, or RG with ?maskFormat=rg) before three's first upload releases them.
    const maskBytes: Uint8Array | null = maskTexture?.image?.data ?? null;
    const maskChannels: 1 | 2 = maskTexture?.format === this.THREE?.RGFormat ? 2 : 1;
    const keep = pageFlag('cellMipsKeep') === '1';
    let rects: ((layer: number) => readonly { x0: number; x1: number; y0: number; y1: number }[] | null) | undefined;
    try { const table = look ? layerWindowRects(look) : []; rects = (layer: number) => table[layer] ?? null; } catch { rects = undefined; }
    this.cellRolloffPending = true;
    void (async () => {
      const started = performance.now();
      const got = await arrayRolloffMips(colour, size, total, { options: cellRolloffOptions(), pitchMask: atlas.mask, pitchMaskChannels: 2, mask: maskBytes, maskChannels, rects, sliceMs: this.atlasSliceMs ?? sliceMs ?? TEXTURE_SLICE_MS });
      const info: NonNullable<ThreeBuildings['cellRolloffInfo']> = { buildMs: Math.round(performance.now() - started), options: cellRolloffOptions(), size, layers: total, levels: got.colour.length, upload: null, maskUpload: null, rolled: rolloffSummary(got), layerInfo: got.layers };
      this.cellRolloffInfo = info;
      for (let i = 0; i < 600 && !this.renderer?.properties?.get?.(texture)?.__webglTexture; i++) await new Promise(r => requestAnimationFrame(r));
      if (!this.renderer?.getContext?.()) return;
      info.upload = uploadArrayMips(this.renderer, texture, got.colour, size, total);
      if (got.mask && maskTexture) {
        for (let i = 0; i < 600 && !this.renderer?.properties?.get?.(maskTexture)?.__webglTexture; i++) await new Promise(r => requestAnimationFrame(r));
        info.maskUpload = uploadArrayMips(this.renderer, maskTexture, got.mask, size, total, got.maskChannels);
      }
      if (keep) this.cellMipsKept = { texture, levels: got.colour, size, depth: total, colour, mask: atlas.mask, rolloff: { maskTexture, maskLevels: got.mask, maskChannels, maskBytes, rects } };
      this.map.triggerRepaint();
    })().finally(() => { this.cellRolloffPending = false; });
    return set;
  }
  /** True while the roll-off chain is being built or waits for its upload (probes wait for it). */
  cellRolloffPending = false;
  /** What the roll-off chain cost and did (null: not built). */
  cellRolloffInfo: { buildMs: number; options: CellRolloffOptions; size: number; layers: number; levels: number; upload: ArrayMipUploadResult | null; maskUpload: ArrayMipUploadResult | null; rolled: ReturnType<typeof rolloffSummary>; layerInfo: RolloffArrayLevels['layers'] } | null = null;

  /**
   * Diagnosis (lane R3-E #240): every level of every layer one flat colour whose hue is a base-16 digit of the layer
   * index (look/cellMips.ts layerDigitRgb), the tint off, so two frames (digit 0, digit 1) name the layer at a pixel.
   * One way, as setCellMipDebug.
   */
  setCellLayerDebug(digit: 0 | 1): string {
    const t = this.material?.uniforms?.cells?.value, m = this.material?.uniforms?.masks?.value;
    const depth = t?.image?.depth, size = t?.image?.width;
    if (!t || !depth || !size) return 'none';
    const levels: Uint8Array[] = [];
    for (let s = size; s >= 1; s >>= 1) {
      const b = new Uint8Array(s * s * 4 * depth);
      for (let l = 0; l < depth; l++) { const [r, g, bl] = layerDigitRgb(l, digit); for (let i = l * s * s * 4; i < (l + 1) * s * s * 4; i += 4) { b[i] = r; b[i + 1] = g; b[i + 2] = bl; b[i + 3] = 255; } }
      levels.push(b);
    }
    const r = uploadArrayMips(this.renderer, t, levels, size, depth, 4, 0);
    const mc = m?.format === this.THREE?.RGFormat ? 2 : 1;
    if (m) uploadArrayMips(this.renderer, m, debugLevels(size, depth, mc, () => [0, 0]), size, depth, mc, 0);
    this.map.triggerRepaint();
    return r.mode;
  }

  /**
   * Probe hook (lane R3-E #240, diagnosis): the colour and mask arrays' sampler anisotropy set on the live GL texture
   * (three set it at upload; the arrays cannot be re-uploaded once their bytes are released). Returns the value set.
   */
  setCellTextureAnisotropy(n: number): number {
    const gl = this.renderer?.getContext?.(), ext = gl && (gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic'));
    if (!ext) return -1;
    const v = Math.max(1, Math.min(n, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    for (const t of [this.material?.uniforms?.cells?.value, this.material?.uniforms?.masks?.value]) {
      const handle = t && this.renderer?.properties?.get?.(t)?.__webglTexture;
      if (!handle) continue;
      this.renderer.state.bindTexture(gl.TEXTURE_2D_ARRAY, handle);
      gl.texParameterf(gl.TEXTURE_2D_ARRAY, ext.TEXTURE_MAX_ANISOTROPY_EXT, v);
    }
    this.map.triggerRepaint();
    return v;
  }

  /** Probe hook (lane R3-E): rebuild the kept roll-off levels with other options (`?cellMipsKeep=1`) and upload them; ms taken. */
  async setCellRolloffOptions(options: Partial<CellRolloffOptions>): Promise<number> {
    const kept = this.cellMipsKept;
    if (!kept?.rolloff) return -1;
    const started = performance.now(), r = kept.rolloff;
    const got = await arrayRolloffMips(kept.colour, kept.size, kept.depth, { options: { ...cellRolloffOptions(), ...options }, pitchMask: kept.mask, pitchMaskChannels: 2, mask: r.maskBytes, maskChannels: r.maskChannels, rects: r.rects, sliceMs: 0 });
    kept.levels = got.colour;
    uploadArrayMips(this.renderer, kept.texture, got.colour, kept.size, kept.depth);
    // Mask off: GL's chain for the mask array; on: the rolled-off levels.
    r.maskLevels = got.mask;
    this.setMaskMips(got.mask ? 'custom' : 'gl');
    if (this.cellRolloffInfo) { this.cellRolloffInfo.rolled = rolloffSummary(got); this.cellRolloffInfo.layerInfo = got.layers; }
    this.map.triggerRepaint();
    return Math.round(performance.now() - started);
  }

  private setMaskMips(mode: 'custom' | 'gl'): void {
    const r = this.cellMipsKept?.rolloff, gl = this.renderer?.getContext?.(), t = r?.maskTexture, handle = t && this.renderer?.properties?.get?.(t)?.__webglTexture;
    if (!gl || !handle) return;
    if (mode === 'custom' && r?.maskLevels) { uploadArrayMips(this.renderer, t, r.maskLevels, this.cellMipsKept!.size, this.cellMipsKept!.depth, r.maskChannels); return; }
    this.renderer.state.bindTexture(gl.TEXTURE_2D_ARRAY, handle);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  }

  /**
   * Diagnosis (lane R3-E #240): replace every level of the live colour array with a flat colour per level
   * (look/cellMips.ts LEVEL_DEBUG_RGB) and the tint mask with 0 (no tint), so a frame shows which mip level the
   * sampler reads. One way: reload the page to get the facades back.
   */
  setCellMipDebug(): string {
    const t = this.material?.uniforms?.cells?.value, m = this.material?.uniforms?.masks?.value;
    const depth = t?.image?.depth, size = t?.image?.width;
    if (!t || !depth || !size) return 'none';
    const r = uploadArrayMips(this.renderer, t, debugLevels(size, depth, 4, l => [...(LEVEL_DEBUG_RGB[l] ?? [255, 255, 255]), 255]), size, depth, 4, 0);
    if (m) uploadArrayMips(this.renderer, m, debugLevels(size, depth, m.format === this.THREE?.RGFormat ? 2 : 1, () => [0, 0]), size, depth, m.format === this.THREE?.RGFormat ? 2 : 1, 0);
    this.map.triggerRepaint();
    return r.mode;
  }

  /** Probe hook: rebuild the kept custom levels with other options (look/cellMips.ts) and upload them; ms taken. */
  async setCellMipOptions(options: Partial<ReturnType<typeof cellMipOptions>>): Promise<number> {
    const kept = this.cellMipsKept;
    if (!kept) return -1;
    const started = performance.now();
    const { levels } = await arrayMips(kept.colour, kept.size, kept.depth, kept.mask, 2, { ...cellMipOptions(), ...options }, 0);
    kept.levels = levels;
    uploadArrayMips(this.renderer, kept.texture, levels, kept.size, kept.depth);
    this.map.triggerRepaint();
    return Math.round(performance.now() - started);
  }

  /**
   * Probe hook (tests/e2e/crisp-textures `CRISP_MIX ...|mips=0`): regenerate the live colour array's levels 1..N with
   * GL's box mips, or put the custom ones back (needs `?cellMipsKeep=1`). Returns the mode now drawn.
   */
  setCellMipsMode(mode: 'custom' | 'gl'): string {
    const t = this.material?.uniforms?.cells?.value, gl = this.renderer?.getContext?.();
    const handle = t && this.renderer?.properties?.get?.(t)?.__webglTexture;
    if (!gl || !handle) return 'none';
    if (mode === 'gl') {
      this.renderer.state.bindTexture(gl.TEXTURE_2D_ARRAY, handle);
      gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    } else {
      const kept = this.cellMipsKept;
      if (!kept || kept.texture !== t) return 'gl';
      const r = uploadArrayMips(this.renderer, t, kept.levels, kept.size, kept.depth);
      if (r.mode !== 'custom') return 'gl';
    }
    if (this.cellMipsKept?.rolloff) this.setMaskMips(mode);
    this.map.triggerRepaint();
    return mode;
  }
  /** What the custom colour mips cost (null: GL mips). */
  cellMipsInfo: { buildMs: number; options: ReturnType<typeof cellMipOptions>; size: number; layers: number; levels: number; upload: ArrayMipUploadResult | null } | null = null;

  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    for (const entry of this.bakedEntries.values()) entry.mesh.visible = visible;
    this.refreshSurveyedRoofOwnership();
    this.map.triggerRepaint();
  }

  /** The resident building set from the tile streamer; rebuilds only chunks whose features changed. */
  setFeatures(features: readonly Feature[]): void {
    if (features !== this.lastFeatures) {
      // The index is built only if some group's context must be recomputed (contextFor).
      this.contextIndex = undefined;
      this.contextFeatures = features;
      this.contextChanges = this.changedBoxes(this.lastFeatures, features);
    } else this.contextChanges = [];
    const groups = new Map<string, Feature[]>();
    const kitParts: Feature[] = [];
    const gate = (this.groupCacheOn ??= featureGroupCacheEnabled()) ? null : this.bakedPlan(features);
    if (this.groupCacheOn) this.groupCached(features, groups, kitParts);
    else for (const feature of features) {
      const p = feature.properties;
      const id = String(p.id ?? '');
      if (KIT_PART_IDS.has(id) || FRONT_PART_IDS.has(id)) kitParts.push(feature);
      // Every building draws here (bare walls when it has no facade), except the parts a kit
      // replaces and the few houseboats the tiles carry (the houseboat generator draws those).
      if (KIT_HIDE_SET.has(id) || this.boatIds.has(id)) continue;
      const polygons = asPolygons(feature.geometry);
      if (!polygons.length) continue;
      const near = tileKeyOf(polygons, this.detailZoom);
      const detailed = this.detailTiles.has(near);
      const key = COARSE_PREFIX + tileKeyOf(polygons);
      const cell = gate ? buildingCell(feature.geometry as any) : null;
      if (gate && cell !== null && gate.covers(cell)) this.bakedSourceOf(cell).push(feature);
      else { let list = groups.get(key); if (!list) groups.set(key, list = []); list.push(feature); }
      // The cheap shell remains available until the detailed mesh actually installs.
      if (detailed) { const k = `near:${near}`; let l = groups.get(k); if (!l) groups.set(k, l = []); l.push(feature); }
      if (detailed) { const k = EXTRAS_PREFIX + near; let l = groups.get(k); if (!l) groups.set(k, l = []); l.push(feature); }
    }
    if (kitParts.length) groups.set(KIT_KEY, kitParts);
    // Houseboats ride along with the resident building tiles, one chunk per tile.
    if (this.groupCacheOn) { if (this.boatTiles.size) for (const feature of features) { const g = this.groupOf(feature); if (g.tile !== null && this.boatTiles.has(g.tile)) groups.set(BOAT_PREFIX + g.tile, NO_SOURCE); } }
    else for (const feature of features) {
      const polygons = asPolygons(feature.geometry);
      if (!polygons.length) continue;
      const key = tileKeyOf(polygons);
      if (this.boatTiles.has(key)) groups.set(BOAT_PREFIX + key, NO_SOURCE);
    }
    this.lastFeatures = features;
    this.sourceGroups = groups;
    const same = (a: readonly Feature[] | undefined, b: readonly Feature[]) => !!a && (a === b || (a.length === b.length && a.every((f, i) => f === b[i])));
    for (const key of [...this.chunks.keys(), ...this.inflight.keys()]) if (!groups.has(key)) { this.dropChunk(key, true); this.inflight.delete(key); this.inflightOptions.delete(key); this.gens.set(key, (this.gens.get(key) ?? 0) + 1); }
    for(const key of this.contextGroups.keys()) if(!groups.has(key)) this.contextGroups.delete(key);
    const contexts = new Map<string, Feature[]>();
    for (const [key, list] of groups) {
      const contextKey = key.startsWith(EXTRAS_PREFIX) ? `near:${key.slice(EXTRAS_PREFIX.length)}` : key;
      let context = contexts.get(contextKey);
      if (!context) { context = key === KIT_KEY || key.startsWith(BOAT_PREFIX) ? [] : this.cachedContextFor(contextKey, list); contexts.set(contextKey, context); }
      const previousContext=this.contextGroups.get(key);
      this.contextGroups.set(key,context);
      const flying = this.inflight.get(key);
      if (same(previousContext,context) && (flying ? same(flying, list) : same(this.chunks.get(key)?.source, list))) continue;
      this.pending.push(key, () => this.rebuild(key, list));
    }
    for (const k of [...this.contextCache.keys()]) if (!contexts.has(k)) this.contextCache.delete(k);
    this.pump();
  }

  /**
   * Feature grouping memo (lane E5, #218; `?featureGroupCache=0` off): a feature's id, kit role and tile keys are fixed,
   * so they are derived once per feature object instead of on every call. setFeatures runs over every resident
   * building (~36,000) on each tile flush and each detail-centre move; at ride start on the iPhone profile (4x) one call
   * was 40-107 ms, mostly this loop. The groups, their order and their lists are the same as the uncached loop's.
   */
  private groupCacheOn: boolean | undefined;
  private readonly groupInfo = new WeakMap<Feature, FeatureGroupInfo>();
  private groupOf(feature: Feature): FeatureGroupInfo {
    const held = this.groupInfo.get(feature);
    if (held && held.geometry === feature.geometry) return held;
    const id = String(feature.properties.id ?? '');
    const polygons = asPolygons(feature.geometry);
    const tile = polygons.length ? tileKeyOf(polygons) : null, near = polygons.length ? tileKeyOf(polygons, this.detailZoom) : '';
    const info: FeatureGroupInfo = { geometry: feature.geometry, id, kit: KIT_PART_IDS.has(id) || FRONT_PART_IDS.has(id), tile, coarse: tile === null ? null : COARSE_PREFIX + tile, near, nearKey: `near:${near}`, extrasKey: EXTRAS_PREFIX + near, cell: polygons.length ? buildingCell(feature.geometry as any) : null };
    this.groupInfo.set(feature, info);
    return info;
  }
  private groupCached(features: readonly Feature[], groups: Map<string, Feature[]>, kitParts: Feature[]): void {
    const push = (k: string, f: Feature) => { const l = groups.get(k); if (l) l.push(f); else groups.set(k, [f]); };
    const gate = this.bakedPlan(features);
    for (const feature of features) {
      const g = this.groupOf(feature);
      if (g.kit) kitParts.push(feature);
      if (KIT_HIDE_SET.has(g.id) || this.boatIds.has(g.id) || g.coarse === null) continue;
      // Baked coarse (lane R4-A #243): a building whose cell the baked tier covers builds no runtime coarse chunk.
      if (gate && g.cell !== null && gate.covers(g.cell)) this.bakedSourceOf(g.cell).push(feature);
      else push(g.coarse, feature);
      if (this.detailTiles.has(g.near)) { push(g.nearKey, feature); push(g.extrasKey, feature); }
    }
  }

  /**
   * The baked coarse tier (engine/bakedCoarse.ts, lane R4-A #243). Null: every building builds its runtime `coarse:`
   * chunk (`?bakedCoarse=0`, the live tile path, a look other than the baked one, a stale layer table, no SHEL).
   */
  private bakedGate: BakedCoarseGate | null = null;
  /** The resident features per baked cell (picking and the answer's footprint read them; the baked meshes have no source). */
  private bakedSources = new Map<string, Feature[]>();
  private bakedSourceOf(cell: string): Feature[] { let l = this.bakedSources.get(cell); if (!l) this.bakedSources.set(cell, l = []); return l; }
  /** Drawn baked cells, registered by the tier: hidden / ghosted / highlighted / detail / swap slots apply to them as to coarse chunks. */
  private readonly bakedEntries = new Map<string, BakedEntry & { applied?: Map<string, number> }>();
  /** Tell the gate the resident buildings' cells (it plans before the grouping asks what it covers). */
  private bakedPlan(features: readonly Feature[]): BakedCoarseGate | null {
    this.bakedSources = new Map();
    const gate = this.bakedGate;
    if (!gate || this.look !== 'photo') return null;
    const cells = new Set<string>();
    for (const feature of features) { const g = this.groupOf(feature); if (g.cell !== null && !KIT_HIDE_SET.has(g.id)) cells.add(g.cell); }
    gate.plan(cells);
    return gate;
  }
  /** The meshes the coarse per-building state applies to: coarse chunks and drawn baked cells. */
  private *coarseEntries(): Generator<{ mesh: any; ranges: Map<string, { start: number; count: number }> }> {
    for (const [key, entry] of this.chunks) if (key.startsWith(COARSE_PREFIX)) yield entry;
    yield* this.bakedEntries.values();
  }

  /**
   * The baked coarse tier's host: the facade scene and material, the layer table its shells must match, registration
   * of its meshes for the per-building state, the own-ground base by building id, and the gate. Null until set up.
   */
  bakedCoarseHost(): BakedCoarseHostView | null {
    if (!this.THREE || !this.scene || !this.material) return null;
    const material = this.material;
    return {
      THREE: this.THREE, scene: this.scene, material, look: this.look, layerHash: shellLayerHash(),
      fadeMaterial: (value: number, source?: any) => fadeClone(source ?? material, value),
      recordMaterial: (key: string, records: FacadeRecordSet, wallUnit: number) => this.recordMaterialFor(key, records, wallUnit),
      freeRecords: (key: string) => this.facadeRecords?.free(key),
      swapSlots: () => this.complement,
      attach: entry => {
        this.bakedEntries.set(entry.key, entry);
        entry.mesh.visible = this.visible;
        if (this.lit) { entry.mesh.receiveShadow = true; entry.mesh.customDepthMaterial = this.depthMaterial; }
        this.applyHidden(entry, new Set(entry.ranges.keys()));
        const slots = entry.mesh.geometry.getAttribute('swapSlot');
        if (slots?.array) { let touched = false; for (const [slot, ids] of this.swapSlots.active()) touched = paintSlot(slots.array, entry.ranges, ids, slot) || touched; if (touched) slots.needsUpdate = true; }
        if (this.firstShellTime === null) this.firstShellTime = performance.now();
        this.map.triggerRepaint();
      },
      detach: entry => { if (this.bakedEntries.get(entry.key) === entry) this.bakedEntries.delete(entry.key); },
      groundBase: (id: string) => {
        if (!this.groundBase) return null;
        const f = this.featureById(id);
        return f ? this.groundBase(f) : undefined;
      },
      regroup: () => this.setFeatures(this.lastFeatures),
      setGate: gate => { if (gate === this.bakedGate) return; this.bakedGate = gate; this.setFeatures(this.lastFeatures); },
      setFrame: fn => { this.bakedFrame = fn; },
    };
  }
  /**
   * F1 (#380, `?shaderFacades=1`): the record path. One record program per chunk material (the lit chunk variant plus
   * CITY_FACADE_RECORD, the chunk material's shared uniforms), one city-wide record texture, and per record mesh a
   * clone with its own `recBase` row and `wallUnit` (the program is shared; a clone is one material switch a mesh).
   */
  private facadeRecords: FacadeRecordTexture | null = null;
  private recordShared: { source: any; material: any } | null = null;
  private recordMaterialFor(key: string, records: FacadeRecordSet, wallUnit: number): any | null {
    const THREE = this.THREE, base = this.material, variant = base?.userData?.cityVariant;
    if (!THREE || !variant?.lit || variant.kind !== 'chunk') return null;
    let shared = this.recordShared;
    if (!shared || shared.source !== base) { shared?.material.dispose?.(); shared = this.recordShared = { source: base, material: createCityLookMaterial(THREE, { ...variant, records: true }, base.uniforms) }; }
    this.facadeRecords ??= new FacadeRecordTexture(THREE);
    const row = this.facadeRecords.alloc(key, records);
    return row == null ? null : facadeRecordClone(shared.material, this.facadeRecords.texture, row, wallUnit);
  }
  /** The baked tier's per-frame step (its dissolves), run with this layer's own fades in prepareFrame. */
  private bakedFrame: (() => void) | null = null;
  /** Resident feature by id (the baked tier's ground lift), indexed lazily per resident list. */
  private featureIndex: { list: readonly Feature[]; byId: Map<string, Feature> } | null = null;
  private featureById(id: string): Feature | undefined {
    if (this.featureIndex?.list !== this.lastFeatures) {
      const byId = new Map<string, Feature>();
      for (const f of this.lastFeatures) byId.set(String(f.properties.id ?? ''), f);
      this.featureIndex = { list: this.lastFeatures, byId };
    }
    return this.featureIndex.byId.get(id);
  }

  /**
   * Hide these buildings' facades for one `reason`: the answer building draws
   * as a plain yellow extrusion instead, and signature-landmark models replace
   * their OSM footprint. Only the ids whose state changed touch the GPU.
   */
  /** Exact host openings become active only after their additive model is available.
   * Source groups are also the context-loss cache; only affected wall/coarse
   * groups are invalidated. Extras, kits, boats and independent roofs retain ownership.
   */
  setHostWallOpenings(configs: readonly ChunkHostOpeningConfig[] = []): void {
    // Snapshot serializable input so callers cannot change a posted job in place.
    const next: ChunkHostOpeningConfig[] = JSON.parse(JSON.stringify(configs));
    const active = next.filter(c => c.enabled && c.additiveModelAvailable).sort((a, b) => a.hostIdentity.localeCompare(b.hostIdentity));
    if (new Set(active.map(c => c.hostIdentity)).size !== active.length) throw Error('One host wall opening per explicit identity required');
    const revision = JSON.stringify(active);
    if (revision === this.hostWallOpeningsRevision) return;
    this.hostWallOpeningsRevision = revision;
    const previous = this.hostWallOpenings;
    this.hostWallOpenings = active;
    for (const [key, source] of this.sourceGroups) {
      if (this.openingRevision(key, source, previous) === this.openingRevision(key, source)) continue;
      this.gens.set(key, (this.gens.get(key) ?? 0) + 1);
      this.inflight.delete(key);
      this.inflightOptions.delete(key);
      this.pending.push(key, () => this.rebuild(key, source));
    }
    this.pump();
  }

  /** Only expose an attached gate after every resident host shell has its exact cut.
   * Source validation failure, pending work, lost context and inactive modes withhold it. */
  hostWallOpeningsVisible(configs: readonly Pick<ChunkHostOpeningConfig, 'hostIdentity'>[]): boolean {
    if (!this.visible || !this.ready || this.look !== this.requestedLook || this.view.zoom() < MIN_ZOOM || !configs.length) return false;
    for (const config of configs) {
      if (!this.hostWallOpenings.some(c => c.hostIdentity === config.hostIdentity)) return false;
      let resident = false;
      for (const [key, source] of this.sourceGroups) {
        if (key === KIT_KEY || key.startsWith(BOAT_PREFIX) || key.startsWith(EXTRAS_PREFIX) || !source.some(f => String(f.properties.id) === config.hostIdentity)) continue;
        resident = true;
        const entry = this.chunks.get(key);
        if (!entry?.mesh || entry.mesh.userData.hostOpeningRevision !== this.openingRevision(key, source)
          || !entry.mesh.userData.hostOpeningIds?.includes(config.hostIdentity)) return false;
      }
      if (!resident) return false;
    }
    return true;
  }

  private openingsFor(key: string, source: readonly Feature[], configs = this.hostWallOpenings): readonly ChunkHostOpeningConfig[] {
    if (key === KIT_KEY || key.startsWith(BOAT_PREFIX) || key.startsWith(EXTRAS_PREFIX)) return [];
    const ids = new Set(source.map(f => String(f.properties.id)));
    // Reveals belong to this chunk's atlas. A declarative config cannot carry
    // a photo-layer index into a procedural or untextured look.
    const revealLayer = this.kitLayers().flat;
    return configs.filter(c => ids.has(c.hostIdentity)).map(c => ({ ...c, revealLayer }))
      .sort((a, b) => a.hostIdentity.localeCompare(b.hostIdentity));
  }

  private openingRevision(key: string, source: readonly Feature[], configs = this.hostWallOpenings): string {
    return JSON.stringify(this.openingsFor(key, source, configs));
  }

  /**
   * The answer building(s): drawn plain yellow in place, so MapLibre need not draw a stand-in prism. Under
   * `?highlight=a|b|c` (look/highlight.ts) they keep their look and get the style's passes; `focus` (the card's
   * point) dims the buildings within 60 m for style c.
   */
  setHighlighted(ids: Iterable<string | number>, focus?: HighlightFocus | null): void {
    const next = new Set([...ids].map(String));
    const changed = new Set<string>([...next, ...this.highlighted].filter(id => next.has(id) !== this.highlighted.has(id)));
    this.highlighted = next;
    this.highlightFocus = focus && next.size ? focus : null;
    const dimmed = new Set<string>();
    if (this.highlightRecipe.desaturate && this.highlightFocus) for (const entry of this.chunks.values()) for (const id of this.dimmedIn(entry)) dimmed.add(id);
    for (const id of [...dimmed, ...this.dimmed]) if (dimmed.has(id) !== this.dimmed.has(id)) changed.add(id);
    this.dimmed = dimmed;
    if (!changed.size) return;
    for (const entry of this.chunks.values()) { this.applyHidden(entry, changed); this.applyPasses(entry); }
    for (const entry of this.bakedEntries.values()) this.applyHidden(entry, changed);
    this.map.triggerRepaint();
  }

  private readonly highlightRecipe = highlightRecipe();
  private highlightFocus: HighlightFocus | null = null;
  private dimmed = new Set<string>();

  /** Buildings of a chunk within the desaturation radius of the focus (never the highlighted ones). */
  private dimmedIn(entry: { source: Feature[]; mesh: any }): string[] {
    const focus = this.highlightFocus?.lngLat;
    if (!focus || !entry.mesh || !entry.source.length) return [];
    const fx = (focus[0] - ORIGIN.lng) * mPerDegLng(ORIGIN.lat), fy = (focus[1] - ORIGIN.lat) * 110_540;
    let index = this.pickIndex.get(entry);
    if (!index) this.pickIndex.set(entry, index = buildPrismIndex(entry.source, ORIGIN));
    return index.filter(p => !this.highlighted.has(p.id) && Math.hypot((p.minX + p.maxX) / 2 - fx, (p.minY + p.maxY) / 2 - fy) <= DESATURATE_RADIUS_M).map(p => p.id);
  }

  /** Outline / rim passes on the chunk that holds a highlighted building (merged: only `hidden == 2` draws). */
  private applyPasses(entry: { source: Feature[]; mesh: any; ranges: Map<string, unknown> }): void {
    if (!entry.mesh || !this.THREE) return;
    const recipe = this.highlightRecipe;
    const lit = (recipe.outline || recipe.rim) ? [...this.highlighted].find(id => entry.ranges.has(id) && !this.hidden.has(id)) : undefined;
    if (!lit) { detachHighlightPasses(entry.mesh); return; }
    let index = this.pickIndex.get(entry);
    if (!index) this.pickIndex.set(entry, index = buildPrismIndex(entry.source, ORIGIN));
    const p = index.find(e => e.id === lit);
    const centre: [number, number, number] | null = p ? [(p.minX + p.maxX) / 2, (p.minY + p.maxY) / 2, (p.zMin + p.zMax) / 2] : null;
    attachHighlightPasses(this.THREE, entry.mesh, { merged: true, centre });
  }

  /** Footprint, centroid and roof height of the highlighted buildings (for the ground ring and beacon). */
  highlightFootprint(ids: Iterable<string | number>): HighlightFocus | null {
    const want = new Set([...ids].map(String));
    if (!want.size) return null;
    const polygons: LngLat[][][] = [];
    let heightM = 0;
    const seen = new Set<string>();
    for (const source of [...[...this.chunks.values()].map(e => e.source), ...this.bakedSources.values()]) for (const f of source) {
      const id = String(f.properties?.id);
      if (!want.has(id) || seen.has(id)) continue;
      seen.add(id);
      const g = f.geometry as { type?: string; coordinates?: any };
      if (g?.type === 'Polygon') polygons.push(g.coordinates);
      else if (g?.type === 'MultiPolygon') polygons.push(...g.coordinates);
      heightM = Math.max(heightM, Number(f.properties?.height) || 0);
    }
    const centre = footprintCentroid(polygons);
    return centre ? { lngLat: centre, ids: [...want], polygons, heightM: heightM || undefined } : null;
  }

  setHidden(reason: string, ids: Iterable<string | number>): void {
    this.hiddenBy.set(reason, new Set([...ids].map(String)));
    const next = new Set<string>();
    for (const set of this.hiddenBy.values()) for (const id of set) next.add(id);
    const changed = new Set<string>([...next, ...this.hidden].filter(id => next.has(id) !== this.hidden.has(id)));
    this.hidden = next;
    if (!changed.size) return;
    for (const entry of this.chunks.values()) { this.applyHidden(entry, changed); if ([...this.highlighted].some(id => changed.has(id))) this.applyPasses(entry); }
    for (const out of this.outgoing.values()) this.applyHidden(out, changed);
    for (const entry of this.bakedEntries.values()) this.applyHidden(entry, changed);
    this.map.triggerRepaint();
  }

  /**
   * Draw `ids` see-through (HIDDEN.ghost: a COVERED_BUILDING_OPACITY screen door) while `reason` holds them: the
   * building over the rider (engine/ownWorldView.ts rider cover). Hidden wins over ghosted, ghosted over highlighted.
   */
  setGhosted(reason: string, ids: Iterable<string | number>): void {
    this.ghostedBy.set(reason, new Set([...ids].map(String)));
    const next = new Set<string>();
    for (const set of this.ghostedBy.values()) for (const id of set) next.add(id);
    const changed = new Set<string>([...next, ...this.ghosted].filter(id => next.has(id) !== this.ghosted.has(id)));
    this.ghosted = next;
    if (!changed.size) return;
    for (const entry of this.chunks.values()) this.applyHidden(entry, changed);
    for (const entry of this.bakedEntries.values()) this.applyHidden(entry, changed);
    this.map.triggerRepaint();
  }
  private readonly ghostedBy = new Map<string, Set<string>>();
  private ghosted = new Set<string>();
  /** Ids drawn ghosted now (specs read it). */
  ghostedIds(): string[] { return [...this.ghosted]; }

  /**
   * Whether this layer draws the city under the rider yet: the coarse shell group of a z14 tile in `tiles`
   * (`x/y`) is installed (a rebuild in flight still draws the previous mesh). Until then the map keeps the
   * basemap's own extrusions, so a ride does not start in an empty city while the first shells build
   * (docs/perf-pop-in-20261016.md). Any one tile is enough: off-centre tiles arrive as they would without
   * the hold, so the hold never reveals the streamed city later than no hold.
   */
  drawsResidentCity(tiles: Iterable<string>): boolean {
    if (!this.visible || !this.ready) return false;
    for (const tile of tiles) if (this.chunks.get(`${COARSE_PREFIX}${tile}`)?.mesh) return true;
    // Baked coarse (lane R4-A #243): a drawn baked cell is the city under the rider (its tiles build no coarse chunk).
    return this.bakedEntries.size > 0;
  }

  /**
   * The far tier's host (engine/farShells.ts, lane R2-B #229): the facade scene (chunk metres), the chunk material
   * and a fading clone of it (one program), the drawn look, and whether a resident coarse shell is installed and done
   * dissolving in for a z14 tile (then the far tier hides that tile's prisms). Null until the layer is set up.
   */
  farShellHost(): FarShellHostView | null {
    if (!this.THREE || !this.scene || !this.material) return null;
    const held = this.farHost;
    if (held && held.material === this.material && held.scene === this.scene) { held.look = this.look; return held; }
    const material = this.material;
    return this.farHost = {
      THREE: this.THREE, scene: this.scene, material, look: this.look,
      fadeMaterial: (value: number) => fadeClone(material, value),
      // A resident tile draws its buildings as the coarse shell, or as detailed `near:` chunks of its z16 sub-tiles.
      // Baked coarse (lane R4-A #243): a far cell whose baked shell draws here hides every part of it.
      // Lane R4-K (#255): where the baked tier covers a cell it does not draw (released from the air, or arriving after a
      // return), the hand-over is per cell: the tile's coarse chunk holds none of its buildings, and a near chunk only
      // its own z16 tile's, so only a near chunk inside this cell keeps the part hidden (farPartHidden).
      coarseDrawn: (tile: string, cell?: string) => {
        const gate = this.bakedGate, bakedDrawn = cell !== undefined && !!gate?.drawn(cell);
        if (bakedDrawn) return true;
        if (cell !== undefined && gate?.holdsFar?.(cell)) return farPartHidden({ bakedDrawn, bakedHolds: true, coarseTile: false, nearTile: false, nearCell: this.nearDrawnIn(tile, cell) });
        const key = `${COARSE_PREFIX}${tile}`; return (!!this.chunks.get(key)?.mesh && !this.fading.has(key)) || this.nearDrawnIn(tile);
      },
      nearInCell: (cell: string) => { this.nearDrawnIn(''); return this.nearCells.has(cell); },
    };
  }
  private farHost: FarShellHostView | null = null;
  /** z14 tiles with an installed `near:` chunk, re-read at most every 200 ms (the far tier asks per part per frame). */
  private nearTilesAt = -Infinity;
  private nearTiles = new Map<string, Set<string>>();
  /** The world cells the drawn near chunks touch (lane R4-K). */
  private readonly nearCells = new Set<string>();
  /** A drawn near chunk in z14 tile `tile` (and, given `cell`, inside that world cell: farShells.ts nearTileCells). */
  private nearDrawnIn(tile: string, cell?: string): boolean {
    const now = performance.now();
    if (now - this.nearTilesAt > 200) {
      this.nearTilesAt = now;
      const keys: string[] = [];
      for (const [k, c] of this.chunks) if (k.startsWith('near:') && c?.mesh) keys.push(k.slice(5));
      this.nearTiles = nearTileCells(keys, this.detailZoom, TILE_ZOOM);
      this.nearCells.clear();
      for (const cells of this.nearTiles.values()) for (const c of cells) this.nearCells.add(c);
    }
    const cells = this.nearTiles.get(tile);
    return !!cells && (cell === undefined || cells.has(cell));
  }

  /** performance.now() of the first coarse shell installed with geometry, or null. */
  firstShellAt(): number | null { return this.firstShellTime; }
  private firstShellTime: number | null = null;

  /**
   * While the basemap's extrusions stand in for the city (vector-map holds them), shells install at once:
   * a dissolve under the opaque extrusions would only delay the handover.
   */
  setBasemapHeld(held: boolean): void { this.basemapHeld = held; }
  private basemapHeld = false;

  stats(): ThreeBuildingStats {
    let buildings = 0, walls = 0, quads = 0, vertices = 0, bytes = 0;
    for (const { info } of this.chunks.values()) {
      buildings += info.buildingCount; walls += info.wallCount; quads += info.quadCount; vertices += info.vertexCount; bytes += info.bytes;
    }
    const info = this.renderer?.info?.render;
    return {
      kitVertices: this.chunks.get(KIT_KEY)?.info.vertexCount ?? 0, chunks: this.chunks.size, buildings, walls, quads, vertices,
      geometryMB: bytes / 1048576, textureMB: this.textureMB,
      drawCalls: info?.calls ?? 0, triangles: info?.triangles ?? 0, buildMs: this.lastBuildMs, detail: this.detail,
    };
  }

  dispose(): void {
    ++this.envelopeLoadToken;
    ++this.appearanceToken;
    this.appearanceLoaded = false;
    this.invalidateBuilds();
    // Leave the shared pool (the other layers keep it); replies to builds in flight are then ignored.
    this.unsubscribePool?.();
    this.unsubscribePool = null;
    this.busy.clear();
    this.pool = undefined;
    for (const key of [...this.chunks.keys()]) this.dropChunk(key);
    this.dropLeaving();
    for (const material of new Set([this.material, ...this.materials.values()])) material?.dispose();
    this.materials.clear();
    for (const set of this.textureSets.values()) void set.then(t => { t.colour.dispose(); t.mask.dispose(); });
    // Slot meshes go back to the city look's own slot array before this one is freed.
    if (this.cityLook && this.sharedFrame && this.THREE) getCityLook(this.THREE).bindAtlas(null);
  }

  private textureMB = 0;

  private ready = false;

  private pump(): void {
    // Before the atlas is ready the chunks of the current look still build (geometry needs no texture); they wait in
    // `staged` and install once it is (drainStaged).
    if (this.pumping || !this.pending.length || !this.THREE || !(this.ready || this.look === this.requestedLook)) return;
    const pool = this.chunkPool();
    if (!this.ready && !pool) return; // an inline build installs at once: it waits for the atlas
    if (pool && this.idleWorker(pool) < 0) return;
    this.pumping = true;
    // One chunk per task: a z14 tile is ~10-30 ms of layout and fill, so
    // spreading them keeps a tile arrival from stalling a frame.
    setTimeout(() => {
      this.pumping = false;
      const job = this.pending.shift();
      if (job) job();
      this.pump();
    }, 0);
  }

  /** Landmark kits: build each kit from whichever of its OSM parts are resident. */
  private buildKits(source: Feature[], look: BuildingLook = this.look): Chunk {
    return buildSpecialKits(source, look, this.kitLayers(look));
  }

  /**
   * Detail follows the rider; touch devices use a smaller z17 neighbourhood.
   * Cheap to call every frame; regroups only when that block changes.
   * `aerial` (rendererShared/aerialView.ts, passed by the own engine): the block keeps its last plan from the air
   * (detailRing.ts detailBlockFrozen, lane R3-G #242; `?detailFreezeAerial=0` follows the subject as before).
   */
  setDetailCentre(lng: number, lat: number, aerial = false): void {
    const on = this.lookAheadOn ??= lookAheadEnabled();
    this.rider = [lng, lat];
    if (on) this.motion.update(lng, lat, performance.now());
    if (detailBlockFrozen(this.detailBlockState, aerial, this.detailFreezeOn ??= detailFreezeAerialEnabled())) return;
    // Look-ahead (default): the block leads the rider, flips sides with hysteresis and lets tiles it leaves linger
    // (detailRing.ts); `?lookAhead=0` is the old rider-centred block with a hard midline.
    const touch = this.detailZoom >= 17 && (this.detailLingerOn ??= detailLingerEnabled());
    const block = detailBlock([lng, lat], on ? this.motion.direction : null, this.detailZoom, this.detailBlockState, { legacy: !on, maxTiles: touch ? DETAIL_MAX_TILES_TOUCH : DETAIL_MAX_TILES, leadM: touch ? DETAIL_LEAD_M_TOUCH : DETAIL_LEAD_M });
    this.detailBlockState = block;
    // Route-ahead prefetch (engine/routeAhead.ts, lane E4): the tiles the next ROUTE_AHEAD_M of the planned route (or the
    // heading, off a route) crosses join the detailed set, so their detail is built before it is near; `?routeAhead=0` off.
    const aheadOn = this.routeAheadOn ??= on && routeAheadEnabled();
    const direction = this.motion.direction, aheadM = ROUTE_AHEAD_M[this.detailZoom] ?? 300;
    const ahead = !aheadOn ? null : routeAheadTiles(this.route, [lng, lat], this.detailZoom, aheadM, this.routeCursor) ?? (direction ? headingAheadTiles([lng, lat], direction, this.detailZoom, aheadM) : null);
    const next = withAhead(block.keys, ahead, ROUTE_AHEAD_MAX_TILES[this.detailZoom] ?? 2);
    if (next.length === this.detailTiles.size && next.every(k => this.detailTiles.has(k))) return;
    this.detailTiles = new Set(next);
    this.setFeatures(this.lastFeatures);
  }
  private rider: [number, number] | null = null;
  /** Detail (`near:`) chunks installed so far, for the aerial pan harness (scripts/aerial-pan.mjs `detailInstalls`). */
  detailInstalls = 0;
  private readonly motion = new MotionEstimate();
  private routeAheadOn: boolean | undefined;
  private detailLingerOn: boolean | undefined;
  private detailFreezeOn: boolean | undefined;
  /** The planned route (lng/lat), for the route-ahead prefetch; null in Free Ride. */
  private route: [number, number][] | null = null;
  private readonly routeCursor = { index: -1 };
  /** The planned route the rider follows (lng/lat), or null: its next stretch's tiles turn detailed early. */
  setRoute(coords: readonly (readonly [number, number])[] | null): void {
    this.route = coords && coords.length > 1 ? coords.map(c => [c[0], c[1]] as [number, number]) : null;
    this.routeCursor.index = -1;
  }
  private lookAheadOn: boolean | undefined;
  private detailBlockState: DetailBlock | null = null;
  /** Chunks dissolving in (fadeIn). */
  private readonly fading = new Map<string, { mesh: any; source: any; clone: any; start: number; slot?: number }>();
  /**
   * SWAP_FADE: the drawn mesh a rebuilt chunk replaces, kept opaque until the new one has dissolved in. SWAP_COMPLEMENT:
   * `under` is its material clone drawing only where the newcomer does not (cityUnder follows the newcomer's fade).
   */
  private readonly outgoing = new Map<string, { mesh: any; ranges: Map<string, { start: number; count: number }>; under?: { source: any; clone: any } }>();
  /** SWAP_FADE: meshes of chunks that left, dissolving out. */
  private readonly leaving = new Set<{ mesh: any; clone: any; start: number; slot?: number }>();
  /** SWAP_COMPLEMENT: the coarse shells' swap slots (one per detail chunk dissolving in or out over them). */
  private readonly swapSlots = new SwapSlots();
  private readonly swapUnder = { value: this.swapSlots.under };
  /** The overview's own fade (prepareFrame), which every chunk dissolve is scaled by. */
  private fadeGlobal = 1;

  /**
   * Build order: the chunk nearest the rider, ahead first (streamingLookAhead.ts aheadRank on the nearest point
   * of the chunk's tile); detailed extras after their facades, missing coarse shells before detail. Kits first
   * (small, and every landmark kit waits on them).
   */
  private chunkRank(key: string): number {
    const at = this.rider;
    if (key === KIT_KEY) return -Infinity;
    if (!at) return 0;
    let zoom = TILE_ZOOM, tile = key, extra = 0;
    if (key.startsWith(COARSE_PREFIX)) tile = key.slice(COARSE_PREFIX.length);
    else if (key.startsWith('near:')) { zoom = this.detailZoom; tile = key.slice(5); }
    else if (key.startsWith(EXTRAS_PREFIX)) { zoom = this.detailZoom; tile = key.slice(EXTRAS_PREFIX.length); extra = 60; }
    else if (key.startsWith(BOAT_PREFIX)) { tile = key.slice(BOAT_PREFIX.length); extra = 30; }
    else return 0;
    const [x, y] = tile.split('/').map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
    const n = 2 ** zoom, latOf = (t: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * t) / n))) * 180) / Math.PI;
    const west = (x / n) * 360 - 180, east = ((x + 1) / n) * 360 - 180, north = latOf(y), south = latOf(y + 1);
    const nearest: [number, number] = [Math.max(west, Math.min(east, at[0])), Math.max(south, Math.min(north, at[1]))];
    // A tile with no shell drawn yet is a hole in the city, detail only refines one: its coarse shell goes before
    // detail up to ~400 m nearer.
    const hole = key.startsWith(COARSE_PREFIX) && !this.chunks.has(key) ? COARSE_HOLE_BONUS_M : 0;
    return aheadRank(at, nearest, this.motion.direction) + extra - hole;
  }

  /**
   * The routing ways of the current network ({ highway, nodes: [{ lat, lon }] }): front doors
   * then go only on walls that face a street. Empty (boat and transit modes) keeps the old
   * rule, a door on any outer wall. Rebuilds the resident building chunks.
   */
  setStreets(ways: ReadonlyArray<{ highway?: string; nodes?: ReadonlyArray<{ lat: number; lon: number }> }>): void {
    const segs = streetSegments(ways.map(w => ({ highway: w.highway, points: (w.nodes ?? []).map(n => [n.lon, n.lat] as const) })), ORIGIN);
    this.streets = segs.length ? new SegmentGrid(segs, 200) : null;
    for (const [key, entry] of [...this.chunks]) if (key !== KIT_KEY && !key.startsWith(BOAT_PREFIX)) this.pending.push(key, () => this.rebuild(key, entry.source));
    this.pump();
  }

  private streets: SegmentGrid | null = null;

  /** The street segments within reach of a chunk's buildings, metres from ORIGIN, for the chunk builder. */
  private streetsFor(source: readonly Feature[]): Float32Array | undefined {
    // Architectural fronts use actual streets in every travel mode. A boat's
    // navigation ways are not a substitute for the streets around its houses.
    const grids = [this.streets, this.appearanceStreets].filter((grid): grid is SegmentGrid => !!grid);
    if (!grids.length) return undefined;
    const kx = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), ky = 110_540;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const f of source) for (const polygon of asPolygons(f.geometry)) for (const [lng, lat] of polygon[0] ?? []) {
      const x = (lng - ORIGIN.lng) * kx, y = (lat - ORIGIN.lat) * ky;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (!(minX <= maxX)) return undefined;
    const pad = FALLBACK_REACH_M, out: number[] = [];
    for (const grid of grids) {
      const segs = grid.segs;
      for (const i of grid.near(minX - pad, minY - pad, maxX + pad, maxY + pad)) out.push(segs[i * 4], segs[i * 4 + 1], segs[i * 4 + 2], segs[i * 4 + 3]);
    }
    return Float32Array.from(out);
  }

  /** OSM houseboat footprints (Amsterdam extract); drawn by the houseboat generator in the resident tiles. */
  setHouseboats(boats: readonly Houseboat[]): void {
    this.boats = boats;
    this.boatTiles = houseboatsByTile(boats);
    this.boatIds = new Set(boats.map(b => b.id));
    for (const entry of this.bakedEntries.values()) this.applyHidden(entry, new Set(entry.ranges.keys()));
    for (const key of [...this.chunks.keys()]) if (key.startsWith(BOAT_PREFIX)) this.dropChunk(key);
    this.setFeatures(this.lastFeatures);
  }

  /**
   * Canal water height relative to the street (metres, ≤ 0). The own ground
   * sinks canal water below the quays; boats follow it. Buildings, kits and trees stay at street level.
   */
  setWaterLevel(metres: number): void {
    this.waterLevel = Number.isFinite(metres) ? Math.min(0, metres) : 0;
    for (const [key, entry] of this.chunks) if (key.startsWith(BOAT_PREFIX) && entry.mesh) entry.mesh.position.z = this.waterLevel;
    this.map.triggerRepaint();
  }

  /** The drawn houseboat a landmark with no building is aboard, if any (see `boatForLandmark`). */
  boatForLandmark(lngLat: [number, number], type?: string): string | null {
    return boatForLandmark(this.boats, lngLat, type);
  }

  private buildBoats(tile: string): Chunk {
    return buildSpecialBoats(this.boatTiles.get(tile) ?? [], this.look, this.kitLayers());
  }

  private kitLayers(look: BuildingLook = this.look) {
    const cells = cellSetOf(look), roofBase = cells === 'procedural' ? CELL_LAYER_COUNT : BAY_LAYER_COUNT;
    const plain = this.look === 'untextured' ? roofBase + 3 : cells === 'procedural' ? cellLayer('canal', 'plain', 0) : bayLayer('canal', 0, 'plain');
    return { plain, flat: roofBase + 3, slope: roofBase + 1, fatihMasonry: look === 'photo' ? FATIH_MASONRY_LAYER : undefined };
  }

  private currentSource(key: string, source: readonly Feature[]): boolean {
    const latest = this.sourceGroups.get(key);
    return !!latest && latest.length === source.length && latest.every((f, i) => f === source[i]);
  }

  private readonly footprintBounds = new WeakMap<Feature, [number, number, number, number]>();
  private boundsFor(f:Feature):[number, number, number, number]{
    let box=this.footprintBounds.get(f);if(box)return box;
    const points=asPolygons(f.geometry).flat(2);
    box=[Infinity,Infinity,-Infinity,-Infinity];
    for(const [x,y] of points){box[0]=Math.min(box[0],x);box[1]=Math.min(box[1],y);box[2]=Math.max(box[2],x);box[3]=Math.max(box[3],y);}
    this.footprintBounds.set(f,box);return box;
  }
  // Include overlapping footprints in adjacent detail/tile batches as context,
  // without drawing them twice. Picking retains the same installed context.
  /**
   * Context of a group, reused when its own buildings are the same objects and no building that arrived,
   * left or was restyled since lies within the group's padded bounds (only those can join or leave its
   * neighbours; the relative order of the rest is unchanged). Recomputing every group's neighbours on every
   * tile flush and detail-centre move was 50–280 ms per call while riding (docs/perf-motion-stutter-20261016.md).
   */
  private contextCache = new Map<string, { source: readonly Feature[]; box: [number, number, number, number]; context: Feature[]; boats: ReadonlySet<string> }>();
  private contextFeatures: readonly Feature[] = [];
  private contextChanges: [number, number, number, number][] = [];
  private changedBoxes(previous: readonly Feature[], next: readonly Feature[]): [number, number, number, number][] {
    const before = new Set(previous), after = new Set(next), out: [number, number, number, number][] = [];
    for (const f of next) if (!before.has(f)) out.push(this.boundsFor(f));
    for (const f of previous) if (!after.has(f)) out.push(this.boundsFor(f));
    return out;
  }
  private cachedContextFor(cacheKey: string, source: readonly Feature[]): Feature[] {
    const held = this.contextCache.get(cacheKey);
    const PAD = 1e-6;
    if (held && held.boats === this.boatIds && held.source.length === source.length && held.source.every((f, i) => f === source[i])) {
      const [x0, y0, x1, y1] = held.box;
      if (!this.contextChanges.some(b => b[2] >= x0 - PAD && b[0] <= x1 + PAD && b[3] >= y0 - PAD && b[1] <= y1 + PAD)) return held.context;
    }
    const context = this.contextFor(source);
    const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const f of source) { const b = this.boundsFor(f); if (b[0] < box[0]) box[0] = b[0]; if (b[1] < box[1]) box[1] = b[1]; if (b[2] > box[2]) box[2] = b[2]; if (b[3] > box[3]) box[3] = b[3]; }
    this.contextCache.set(cacheKey, { source, box, context, boats: this.boatIds });
    return context;
  }
  private contextFor(source:readonly Feature[]):Feature[]{
    const ids=new Set(source.map(f=>String(f.properties.id)));
    this.contextIndex ??= new BuildingContextIndex(this.contextFeatures, f => this.boundsFor(f));
    return this.contextIndex?.neighbors(source, f => {
      const id=String(f.properties.id);return ids.has(id)||KIT_HIDE_SET.has(id)||this.boatIds.has(id);
    }) ?? [];
  }
  /**
   * The build mode for a chunk key (CANAL-RECALL-7). The detailed walls and their extras stay `walls` /
   * `extras`; on a `touch` device the z14 city shells between them are `shell`: one quad per wall and the
   * building's own flat lid, still in its window cell and wall tint. A chunk that becomes near rebuilds
   * at full through the usual `near:` path, so one key never holds two levels at once. Desktop (`full`)
   * keeps `coarse` and is byte-identical.
   */
  private modeFor(key: string): 'walls' | 'extras' | 'coarse' | 'shell' {
    const mode = chunkMode(key);
    return mode === 'coarse' && this.detail === 'touch' ? 'shell' : mode;
  }

  private rebuild(key: string, source: Feature[]): void {
    if (!this.THREE || this.look !== this.requestedLook || !this.currentSource(key, source)) return;
    const pool = this.chunkPool(), w = pool ? this.idleWorker(pool) : -1;
    if (!this.ready && !(pool && w >= 0)) { this.pending.push(key, () => this.rebuild(key, source)); return; } // inline only once the atlas is bound
    const gen = (this.gens.get(key) ?? 0) + 1;
    this.gens.set(key, gen);
    if (pool && w >= 0) {
      // Off the main thread; a reply for an older generation (the tile changed again, or the look) is dropped.
      this.inflight.set(key, source);
      const options = { surveyedEnvelopeData: this.surveyedEnvelopeTransport.envelopes, surveyedEnvelopeRevision: this.surveyedEnvelopeTransport.revision, look: this.look, streets: this.streetsFor(source), profiles: this.appearanceProfiles, contextFeatures: this.contextGroups.get(key) ?? this.contextFor(source), appearanceRevision: this.appearanceRevision, hostOpenings: this.openingsFor(key, source), hostOpeningRevision: this.openingRevision(key, source) };
      this.inflightOptions.set(key, options);
      this.busy.set(w, key);
      pool.post(w, { key, gen, ...options, features: source, mode: this.modeFor(key), ...(SHELL_ROOFS ? { shellRoofs: true } : {}),
        special: key === KIT_KEY ? 'kits' : key.startsWith(BOAT_PREFIX) ? 'boats' : undefined,
        boats: key.startsWith(BOAT_PREFIX) ? this.boatTiles.get(key.slice(BOAT_PREFIX.length)) ?? [] : undefined,
        layers: this.kitLayers(), tiles: this.facadeTiles, tileMin: FACADE_TILE_MIN_TRIANGLES });
      return;
    }
    const t0 = performance.now();
    const options = { surveyedEnvelopeData: this.surveyedEnvelopeTransport.envelopes, surveyedEnvelopeRevision: this.surveyedEnvelopeTransport.revision, look: this.look, streets: this.streetsFor(source), profiles: this.appearanceProfiles, contextFeatures: this.contextGroups.get(key) ?? this.contextFor(source), appearanceRevision: this.appearanceRevision, hostOpenings: this.openingsFor(key, source), hostOpeningRevision: this.openingRevision(key, source) };
    const result = key === KIT_KEY ? {chunk:this.buildKits(source),boundParentIds:[]}
      : key.startsWith(BOAT_PREFIX) ? {chunk:this.buildBoats(key.slice(BOAT_PREFIX.length)),boundParentIds:[]}
      : buildTransportedEnvelopeChunk(source,{...options,mode:this.modeFor(key),...(SHELL_ROOFS?{shellRoofs:true}:{})});
    this.install(key, source, result.chunk, performance.now() - t0, options, result.boundParentIds);
  }

  /**
   * The page's worker pool (engine/workerPool.ts), joined on first use; null where workers are unavailable (then
   * chunks build inline). Chunk builds go to idle pool workers, one at a time each, so up to `pool.live` build at once.
   */
  private chunkPool(): WorkerPool | null {
    if (this.pool !== undefined) return this.pool?.live ? this.pool : null;
    const pool = sharedWorkerPool(WORKER_URL);
    this.pool = pool;
    if (!pool) return null;
    this.unsubscribePool = pool.subscribe((data, w) => {
      const reply = data as ChunkReply | null;
      if (!reply || typeof reply !== 'object' || typeof reply.key !== 'string' || !reply.chunk) return false;
      this.onChunk(reply, w);
      return true;
    }, w => {
      // That worker's build is redone (another worker, or inline once none is left).
      const key = this.busy.get(w);
      this.busy.delete(w);
      if (key !== undefined) { const source = this.inflight.get(key); if (source) { this.inflight.delete(key); this.inflightOptions.delete(key); this.pending.push(key, () => this.rebuild(key, source)); } }
      if (!pool.live) console.warn('three.js building workers failed; building chunks inline');
      this.pump();
    });
    return pool.live ? pool : null;
  }

  /** Chunk builds at once across the pool: every live worker, or `?chunkBuilds=N` (1 = the old single chunk worker's pace). */
  private readonly chunkBuildCap = (() => {
    try { const n = Number(new URLSearchParams(typeof location !== 'undefined' ? location.search : '').get('chunkBuilds')); return Number.isInteger(n) && n >= 1 ? n : Infinity; } catch { return Infinity; }
  })();
  /** An idle live pool worker, or -1 (also while `chunkBuildCap` builds are in flight). */
  private idleWorker(pool: WorkerPool): number {
    if (this.busy.size >= this.chunkBuildCap) return -1;
    for (let w = 0; w < pool.size; w++) if (pool.alive(w) && !this.busy.has(w)) return w;
    return -1;
  }

  private onChunk(reply: ChunkReply, worker: number): void {
    const { key, gen, chunk, ms } = reply, source = this.inflight.get(key);
    if (this.busy.get(worker) === key) this.busy.delete(worker);
    if (this.gens.get(key) !== gen || !source) { this.pump(); return; }
    const options = this.inflightOptions.get(key);
    if (!options || reply.appearanceRevision !== options.appearanceRevision || options.appearanceRevision !== this.appearanceRevision || reply.surveyedEnvelopeRevision !== options.surveyedEnvelopeRevision || options.surveyedEnvelopeRevision !== this.surveyedEnvelopeTransport.revision || reply.hostOpeningRevision !== options.hostOpeningRevision || options.hostOpeningRevision !== this.openingRevision(key, source)) { this.pump(); return; }
    this.inflight.delete(key);
    this.inflightOptions.delete(key);
    if (reply.tiles) plannedTiles.set(chunk, reply.tiles);
    this.stage({ key, source, chunk, ms, options, boundParentIds: reply.boundParentIds });
    this.pump();
  }

  /**
   * Stand every building on the own ground's relief: each building is lifted
   * by its footprint's lowest relief (the prototype's rule; nothing floats).
   * Chunks keep their CPU positions only while some building still waits for
   * its relief; call `refreshGroundBases()` when more relief is resident.
   */
  setGroundBase(fn: GroundBaseFn | null): void {
    const had = !!this.groundBase;
    this.groundBase = fn;
    // Lane R4-A (#243): a chunk installed before the ground was known has no lift and no CPU positions left, so it
    // would stay at z 0 under lifted neighbours for good (the swap-zfight excess at s1-hoftuin: the slab's extras sat
    // 0.6 m off its detail chunk once the baked shells let the city start before the ground). Rebuild those once.
    if (fn && !had) {
      let queued = 0;
      for (const [key, entry] of this.chunks) if (entry.mesh && !entry.lift && key !== KIT_KEY && !key.startsWith(BOAT_PREFIX)) { this.pending.push(key, () => this.rebuild(key, entry.source)); queued++; }
      this.groundLateRebuilds += queued;
      if (queued) this.pump();
    }
    this.refreshGroundBases();
  }
  /** Chunks rebuilt because they were installed before the ground base was set (specs read it). */
  groundLateRebuilds = 0;

  /**
   * Apply bases that became known since install (or since the last refresh). Returns buildings lifted.
   *
   * With a `budget` (lane R3-F #241, the catch-up after an aerial view held the re-base): the chunks with pending
   * pands are worked nearest `budget.centre` first, `budget.ms` per call (rendererShared/baseRefreshBudget.ts); a
   * chunk cut at the deadline resumes on the next call, `budget.restart` starts again from the nearest, and
   * `budget.done` says whether the pass finished. Without one, every chunk at once, as before.
   */
  refreshGroundBases(budget?: GroundBaseBudget): number {
    if (!this.groundBase) { if (budget) budget.done = true; return 0; }
    if (budget) return this.refreshGroundBasesSliced(budget);
    let lifted = 0;
    for (const entry of this.chunks.values()) {
      const lift = entry.lift, attribute = entry.mesh?.geometry?.getAttribute('position');
      if (!lift || !lift.pending.size || !attribute?.array) continue;
      const n = this.applyGroundLift(attribute.array as Float32Array, entry.ranges, lift);
      if (!n) continue;
      lifted += n;
      this.settleGroundLift(entry, attribute, lift);
    }
    if (lifted) { this.hiddenRevision++; this.map.triggerRepaint(); }
    return lifted;
  }

  /** A chunk's positions changed: upload, re-measure, grow its tiles; free the CPU copy once nothing is pending. */
  private settleGroundLift(entry: { mesh: any }, attribute: any, lift: GroundLift): void {
    attribute.needsUpdate = true;
    entry.mesh.geometry.computeBoundingSphere();
    // Tiles were measured at install: grow them by the largest lift since (a few metres; conservative, never short).
    const range = this.liftRange(lift.applied);
    growTileSpheres(entry.mesh, Math.max(Math.abs(range.min), Math.abs(range.max)));
    // Settled: let the CPU copy go after the next upload.
    if (!lift.pending.size) attribute.onUpload(function (this: any) { this.array = null; });
  }

  private readonly baseSlicer = new BaseRefreshSlicer<string>();
  /** Per chunk in the sliced pass: the pands still to sample and how many were lifted so far (settled at the end). */
  private readonly baseSliceState = new Map<string, { todo: string[]; lifted: number }>();
  private refreshGroundBasesSliced(budget: GroundBaseBudget): number {
    if (budget.restart || !this.baseSlicer.active) {
      this.settlePartialLifts();
      const items: SliceItem<string>[] = [];
      for (const [key, entry] of this.chunks) {
        const lift = entry.lift;
        if (!lift || !lift.pending.size || !entry.mesh?.geometry?.getAttribute('position')?.array) continue;
        items.push({ key, distance: lngLatDistanceM(budget.centre, chunkAnchor(lift) ?? [Infinity, Infinity]) });
      }
      this.baseSlicer.start(items);
    }
    let lifted = 0;
    budget.done = this.baseSlicer.run(budget.ms, (key, deadline) => {
      const entry = this.chunks.get(key), lift = entry?.lift, attribute = entry?.mesh?.geometry?.getAttribute('position');
      if (!entry || !lift || !attribute?.array) { this.baseSliceState.delete(key); return true; }
      let state = this.baseSliceState.get(key);
      if (!state) { state = { todo: [...lift.pending], lifted: 0 }; this.baseSliceState.set(key, state); }
      // applyGroundLift walks `todo` in slices and drops it when the list is done.
      const walk: GroundLift & { todo?: string[] } = { applied: lift.applied, pending: lift.pending, features: lift.features, todo: state.todo };
      const n = state.todo.length ? this.applyGroundLift(attribute.array as Float32Array, entry.ranges, walk, deadline) : 0;
      state.lifted += n; lifted += n;
      if (walk.todo) return false;
      this.baseSliceState.delete(key);
      if (state.lifted) this.settleGroundLift(entry, attribute, lift);
      return true;
    });
    if (lifted) { this.hiddenRevision++; this.map.triggerRepaint(); }
    return lifted;
  }
  /** A restart abandons chunks cut mid-walk: upload what they lifted so far. */
  private settlePartialLifts(): void {
    for (const [key, state] of this.baseSliceState) {
      const entry = this.chunks.get(key), lift = entry?.lift, attribute = entry?.mesh?.geometry?.getAttribute('position');
      if (state.lifted && entry && lift && attribute?.array) this.settleGroundLift(entry, attribute, lift);
    }
    this.baseSliceState.clear();
  }

  /** Diagnostics for the own ground: buildings lifted, still waiting, base range, CPU copies kept. */
  groundLiftStats(): { chunks: number; lifted: number; pending: number; minBase: number | null; maxBase: number | null; keptMB: number } {
    let chunks = 0, lifted = 0, pending = 0, keptBytes = 0, minBase = Infinity, maxBase = -Infinity;
    for (const entry of this.chunks.values()) {
      if (!entry.lift) continue;
      chunks++;
      pending += entry.lift.pending.size;
      for (const z of entry.lift.applied.values()) { lifted++; minBase = Math.min(minBase, z); maxBase = Math.max(maxBase, z); }
      const array = entry.mesh?.geometry?.getAttribute('position')?.array;
      if (array) keptBytes += array.byteLength;
    }
    return { chunks, lifted, pending, minBase: Number.isFinite(minBase) ? +minBase.toFixed(2) : null, maxBase: Number.isFinite(maxBase) ? +maxBase.toFixed(2) : null, keptMB: +(keptBytes / 1048576).toFixed(1) };
  }

  private applyGroundLift(positions: Float32Array, ranges: Map<string, { start: number; count: number }>, lift: GroundLift & { todo?: string[] }, deadline = Infinity): number {
    let n = 0;
    // A staged lift walks its own list in slices; buildings whose relief is not resident stay pending.
    const ids = lift.todo ?? [...lift.pending];
    let k = 0;
    for (; k < ids.length; k++) {
      if ((k & 31) === 31 && performance.now() > deadline) break;
      const id = ids[k];
      const feature = lift.features.get(id);
      const base = feature ? this.groundBase!(feature) : null;
      if (base === undefined) continue;
      lift.pending.delete(id);
      const z = base ?? 0, delta = z - (lift.applied.get(id) ?? 0), range = ranges.get(id);
      if (!range || !delta) continue;
      for (let v = range.start; v < range.start + range.count; v++) positions[v * 3 + 2] += delta;
      lift.applied.set(id, z);
      n++;
    }
    if (lift.todo) { lift.todo.splice(0, k); if (!lift.todo.length) delete lift.todo; }
    return n;
  }

  /** Queue a worker-built chunk; its ground lift runs in budgeted slices, then it installs (one per frame). */
  private stage(job: StagedInstall): void {
    const i = this.staged.findIndex(s => s.key === job.key);
    if (i >= 0) this.staged.splice(i, 1);
    this.staged.push(job);
    this.scheduleStage();
  }

  private scheduleStage(): void {
    if (this.stageScheduled || !this.staged.length) return;
    this.stageScheduled = true;
    const run = () => { this.stageScheduled = false; this.drainStaged(); if (!this.staged.length && !this.pending.length && !this.inflight.size) this.installHurried = false; };
    if (this.installHurried || typeof requestAnimationFrame !== 'function') setTimeout(run, 0); else requestAnimationFrame(run);
  }

  private readonly uploadBudget = new FrameBudget(INSTALL_BUDGET_MS, installBudgetBytes());
  private drainStaged(): void {
    if (!this.ready) return; // setLook schedules the drain when the atlas is bound
    const deadline = performance.now() + INSTALL_BUDGET_MS;
    this.uploadBudget.begin();
    while (this.staged.length) {
      const job = this.staged[0];
      if (!this.THREE || this.look !== this.requestedLook || !this.currentSource(job.key, job.source)) { this.staged.shift(); continue; }
      if (this.groundBase && !job.key.startsWith(BOAT_PREFIX) && !job.lift) {
        const features = new Map<string, Feature>();
        for (const f of job.source) { const id = String((f.properties as any)?.id ?? (f as any).id ?? ''); if (id) features.set(id, f); }
        job.lift = { applied: new Map(), pending: new Set(job.chunk.ranges.map(r => r.id)), features };
        job.ranges = new Map(job.chunk.ranges.map(r => [r.id, { start: r.start, count: r.count }]));
        (job.lift as GroundLift & { todo?: string[] }).todo = [...job.lift.pending];
      }
      const lift = job.lift as (GroundLift & { todo?: string[] }) | undefined;
      if (lift?.todo?.length) {
        this.applyGroundLift(job.chunk.positions, job.ranges!, lift, deadline);
        if (lift.todo?.length) break; // out of budget: carry on next frame
      }
      // Installs per frame within the upload budget (the first always): the geometry upload follows at the next render.
      if (!this.uploadBudget.take(chunkBytes(job.chunk))) break;
      this.staged.shift();
      this.install(job.key, job.source, job.chunk, job.ms, job.options, job.boundParentIds, lift);
      if (performance.now() > deadline) break;
    }
    this.scheduleStage();
  }

  private install(key: string, source: Feature[], chunk: Chunk, buildMs: number, options?: BuildOptions, boundParentIds: string[] = [], staged?: GroundLift): void {
    if (!this.THREE || this.look !== this.requestedLook || !this.currentSource(key, source)) return;
    if (options && (options.surveyedEnvelopeRevision !== this.surveyedEnvelopeTransport.revision || options.look !== this.look || options.appearanceRevision !== this.appearanceRevision || options.hostOpeningRevision !== this.openingRevision(key, source))) return;
    const context=this.contextGroups.get(key);
    if(options?.contextFeatures && context && (context.length!==options.contextFeatures.length || context.some((f,i)=>f!==options.contextFeatures![i]))) return;
    const t0 = performance.now() - buildMs;
    const arriving = !this.chunks.get(key)?.mesh;
    // SWAP_FADE: a rebuilt chunk's drawn mesh stays (opaque) under the new one while it dissolves in; a rebuild of a
    // chunk still dissolving keeps the older, solid mesh and drops the half-faded one.
    const crossFade = SWAP_FADE && !arriving && this.fades(key);
    if (crossFade && !this.outgoing.has(key) && !this.fading.has(key)) {
      const held = this.chunks.get(key)!;
      this.outgoing.set(key, { mesh: held.mesh, ranges: held.ranges });
      this.chunks.delete(key);
    }
    this.dropChunk(key, false, crossFade);
    if (key.startsWith('near:')) this.detailInstalls++;
    if (!chunk.vertexCount) { this.dropOutgoing(key); this.chunks.set(key, { source, mesh: null, info: infoOf(chunk), ranges: new Map() }); if (key.startsWith('near:')) this.refreshDetailOwnership(); return; }
    const THREE = this.THREE;
    const geometry = new THREE.BufferGeometry();
    // The GPU holds the copy that draws; the CPU array is freed once uploaded
    // (the `hidden` flags stay: they are rewritten when the answer changes).
    // A lost context rebuilds from `source`, see onAdd.
    const release = (attribute: any) => { attribute.onUpload(function (this: any) { this.array = null; }); return attribute; };
    // Own ground: lift each building onto its relief before upload. Houseboats
    // follow the water level instead (mesh.position.z below).
    let lift: GroundLift | undefined = staged;
    if (!lift && this.groundBase && !key.startsWith(BOAT_PREFIX)) {
      const features = new Map<string, Feature>();
      for (const f of source) { const id = String((f.properties as any)?.id ?? (f as any).id ?? ''); if (id) features.set(id, f); }
      lift = { applied: new Map(), pending: new Set(chunk.ranges.map(r => r.id)), features };
      const ranges = new Map(chunk.ranges.map(r => [r.id, { start: r.start, count: r.count }]));
      this.applyGroundLift(chunk.positions, ranges, lift);
    }
    const positionAttribute = new THREE.BufferAttribute(chunk.positions, 3);
    geometry.setAttribute('position', lift?.pending.size ? positionAttribute : release(positionAttribute));
    geometry.setAttribute('uv', release(new THREE.BufferAttribute(chunk.uvs, 2)));
    geometry.setAttribute('layer', release(new THREE.BufferAttribute(chunk.layers, 1, false)));
    geometry.setAttribute('tint', release(new THREE.BufferAttribute(chunk.tints, 4, true)));
    geometry.setAttribute('accent', release(new THREE.BufferAttribute(chunk.accents, 4, true)));
    geometry.setAttribute('hidden', new THREE.BufferAttribute(new Uint8Array(chunk.vertexCount), 1, false));
    // Thin-element fade and owner class (look/thinFade.ts, lane R3-A #230): only when it matches this chunk's vertices
    // (a host-opening rebuild re-lays the arrays without it).
    if (chunk.thin && chunk.thin.length === chunk.vertexCount * 2) geometry.setAttribute('thin', release(new THREE.BufferAttribute(chunk.thin, 2, false)));
    // SWAP_COMPLEMENT: the shells' per-building swap slot (kept on the CPU like `hidden`), marked for swaps under way.
    if (this.complement && key.startsWith(COARSE_PREFIX)) {
      const slots = new Uint8Array(chunk.vertexCount), ranges = new Map(chunk.ranges.map(r => [r.id, { start: r.start, count: r.count }]));
      for (const [slot, ids] of this.swapSlots.active()) paintSlot(slots, ranges, ids, slot);
      geometry.setAttribute('swapSlot', new THREE.BufferAttribute(slots, 1, false));
    }
    geometry.setIndex(release(new THREE.BufferAttribute(chunk.indices, 1)));
    // three.js uploads a new mesh, then computes its bounding sphere to sort it.
    // With `position` already freed that throws inside MapLibre's frame and the
    // whole map flashes once per new chunk, so measure while the array exists.
    const sphere = boundingSphereOf(chunk.positions);
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(...sphere.center), sphere.radius);
    const mesh = new THREE.Mesh(geometry, this.material);
    // Culled tiles over the same buffers (FACADE_TILES), measured while the CPU arrays still exist; a building stays in one tile.
    // A worker-built chunk brings its tiles' partition (x/y only); the heights are read here, after the ground lift.
    const planned = plannedTiles.get(chunk);
    cutMesh(THREE, mesh, this.facadeTiles, FACADE_TILE_MIN_TRIANGLES, { groups: chunk.ranges, release: true, tiles: planned && planned.n === this.facadeTiles ? planned.plan && finishTiles(chunk.positions, planned.plan) : undefined });
    mesh.userData ??= {};
    mesh.userData.installedSurveyedEnvelopeData = options?.surveyedEnvelopeData;
    mesh.userData.boundParentIds = boundParentIds;
    mesh.userData.installedLook = options?.look ?? this.look;
    mesh.userData.installedStreets = options?.streets;
    mesh.userData.installedContextFeatures = options?.contextFeatures;
    mesh.userData.installedProfiles = options?.profiles;
    mesh.userData.installedHostOpenings = options?.hostOpenings;
    mesh.userData.hostOpeningRevision = options?.hostOpeningRevision;
    mesh.userData.hostOpeningIds = chunk.hostOpeningIds ?? [];
    mesh.userData.appearanceRevision = options?.appearanceRevision;
    mesh.userData.kinds = chunk.kinds;
    mesh.frustumCulled = true;
    if (this.lit) {
      // Coarse shells cover the whole city in a few huge meshes: drawing them
      // into the shadow map would cost the full city per frame for a box
      // that only spans the detailed tiles around the rider.
      mesh.castShadow = !key.startsWith(COARSE_PREFIX);
      mesh.receiveShadow = true;
      mesh.customDepthMaterial = this.depthMaterial;
    }
    if (key.startsWith(BOAT_PREFIX)) mesh.position.z = this.waterLevel;
    const entry = { source, mesh, info: infoOf(chunk), ranges: new Map(chunk.ranges.map(r => [r.id, { start: r.start, count: r.count }])), lift };
    this.chunks.set(key, entry);
    this.scene.add(mesh);
    if (arriving || crossFade) this.fadeIn(key, mesh);
    if (crossFade && !this.fading.has(key)) this.dropOutgoing(key);
    if (this.firstShellTime === null && key.startsWith(COARSE_PREFIX)) this.firstShellTime = performance.now();
    this.refreshSurveyedRoofOwnership();
    mesh.userData.coarse = key.startsWith(COARSE_PREFIX);
    this.refreshDetailOwnership();
    if (this.highlightRecipe.desaturate && this.highlightFocus) for (const id of this.dimmedIn(entry)) this.dimmed.add(id);
    this.applyHidden(entry, new Set([...this.hidden, ...this.ghosted, ...this.highlighted, ...this.installedDetailIds, ...this.dimmed]));
    this.applyPasses(entry);
    this.lastBuildMs = performance.now() - t0;
    this.map.triggerRepaint();
  }

  private applyHidden(entry: { mesh: any; ranges: Map<string, { start: number; count: number }> }, ids: Set<string>): void {
    if (!entry.mesh) return;
    const attribute = entry.mesh.geometry.getAttribute('hidden');
    let touched = false;
    for (const id of ids) {
      const range = entry.ranges.get(id);
      if (!range) continue;
      attribute.array.fill(this.hidden.has(id) || entry.mesh.userData.coarse && this.installedDetailIds.has(id) || entry.mesh.userData.bakedCoarse && this.boatIds.has(id) ? HIDDEN.hide : this.ghosted.has(id) ? HIDDEN.ghost : this.highlighted.has(id) ? HIDDEN.highlight : this.dimmed.has(id) ? HIDDEN.dim : HIDDEN.drawn, range.start, range.start + range.count);
      touched = true;
    }
    if (touched) { attribute.needsUpdate = true; this.hiddenRevision++; }
  }

  /**
   * A chunk that arrives where nothing of its own drew (not a rebuild of a drawn chunk) dissolves in over
   * CHUNK_FADE_MS with the overview's screen-door dither on a material clone that shares the program (no
   * compile); the mesh returns to the shared material when it ends. Detail (`near:`) replacing coarse shells
   * keeps the coarse buildings drawn until its dissolve ends (refreshDetailOwnership), so the swap is a
   * dissolve rather than a one-frame jump. `?chunkFade=0` installs at once, as before.
   */
  private fadeIn(key: string, mesh: any): void {
    if (!this.fades(key)) return;
    const source = mesh.material, clone = fadeClone(source, 0);
    if (!clone) return;
    mesh.material = clone;
    let slot: number | undefined;
    if (this.complement) {
      // A rebuilt chunk's old mesh yields where the new one draws.
      const out = this.outgoing.get(key);
      if (out && !out.under) {
        const under = fadeClone(out.mesh.material, this.fadeGlobal, { value: 0 });
        if (under) { out.under = { source: out.mesh.material, clone: under }; out.mesh.material = under; }
      }
      // Detail over the coarse shells: the shells' copies of its buildings yield where it draws.
      const ranges = this.chunks.get(key)?.ranges;
      if (key.startsWith('near:') && ranges?.size) slot = this.claimSwapSlot(new Set(ranges.keys()), 0);
    }
    this.fading.set(key, { mesh, source, clone, start: performance.now(), slot });
  }

  /** Whether the complementary dissolve runs (the flag, and a material with the city look's `swap` variant). */
  private get complement(): boolean { return SWAP_COMPLEMENT && !!this.material?.uniforms?.citySwapUnder; }

  /** A swap slot over the coarse shells for `ids` at coverage `value`; undefined when none is free. */
  private claimSwapSlot(ids: ReadonlySet<string>, value: number): number | undefined {
    const slot = this.swapSlots.claim(ids, value);
    if (slot < 0) return undefined;
    this.paintShells(ids, slot, true);
    return slot;
  }

  private releaseSwapSlot(slot: number | undefined): void {
    if (slot === undefined) return;
    const ids = this.swapSlots.release(slot);
    if (ids) this.paintShells(ids, slot, false);
  }

  private paintShells(ids: ReadonlySet<string>, slot: number, on: boolean): void {
    for (const entry of this.coarseEntries()) {
      if (!entry.mesh) continue;
      const attribute = entry.mesh.geometry.getAttribute('swapSlot');
      if (!attribute?.array) continue;
      if (on ? paintSlot(attribute.array, entry.ranges, ids, slot) : clearSlot(attribute.array, entry.ranges, ids, slot)) attribute.needsUpdate = true;
    }
  }

  /**
   * Whether chunks of `key` dissolve in and out now. The street-kit chunk (one mesh of every installed kit, rebuilt
   * whole as kits come and go) cross-fades too with `?kitFade` (default on since P3 #328) (engine/popFade.ts, lane P2 #325): its rebuilds were the
   * aerial pan's largest unfaded swap, 29 a minute beyond 1.2 km.
   */
  private fades(key: string): boolean { return CHUNK_FADE && (key !== KIT_KEY || KIT_FADE) && !this.basemapHeld; }

  /** SWAP_FADE: dissolve a leaving chunk's mesh out (removed when it has gone); false when its material cannot. */
  private fadeOut(mesh: any, ids?: ReadonlySet<string>): boolean {
    const clone = fadeClone(mesh.material, 1);
    if (!clone) return false;
    mesh.material = clone;
    // A detail chunk leaving: the shells it hid come back yielding where it still draws (none at first).
    const slot = ids?.size && this.complement ? this.claimSwapSlot(ids, this.fadeGlobal) : undefined;
    this.leaving.add({ mesh, clone, start: performance.now(), slot });
    return true;
  }

  /** The mesh a rebuilt chunk kept while its successor dissolved in: dissolve it out now, or drop it. */
  private retireOutgoing(key: string): void {
    const out = this.outgoing.get(key);
    if (!out) return;
    this.outgoing.delete(key);
    // Complementary: it has already dissolved out under its successor (it yields every pixel at the end).
    if (out.under) { out.under.clone.dispose(); this.disposeMesh(out.mesh); return; }
    if (!(this.fades(key) && this.fadeOut(out.mesh))) this.disposeMesh(out.mesh);
  }

  /** Drop the mesh a rebuilt chunk kept while its successor dissolved in. */
  private dropOutgoing(key: string): void {
    const out = this.outgoing.get(key);
    if (!out) return;
    this.outgoing.delete(key);
    out.under?.clone.dispose();
    this.disposeMesh(out.mesh);
  }

  private disposeMesh(mesh: any): void { this.scene?.remove(mesh); disposeTiles(mesh); mesh.geometry.dispose(); }

  /** Advance the arriving chunks' dissolve under the overview's own fade `global`; nothing runs when none fade. */
  private tickFades(global: number): void {
    this.fadeGlobal = global;
    if (!this.fading.size && !this.leaving.size) return;
    const now = performance.now();
    for (const [key, f] of this.fading) {
      const t = (now - f.start) / CHUNK_FADE_MS;
      if (t < 1) {
        const value = global * t;
        f.clone.uniforms.cityFade.value = value;
        // Complementary: the shells' slot and a rebuilt chunk's old mesh yield exactly where this one draws.
        if (f.slot !== undefined) this.swapSlots.set(f.slot, value);
        const under = this.outgoing.get(key)?.under?.clone.uniforms;
        if (under) { under.cityFade.value = global; under.cityUnder.value = value; }
        continue;
      }
      this.endFade(key);
    }
    for (const f of this.leaving) {
      const t = (now - f.start) / CHUNK_FADE_MS;
      if (t < 1) { f.clone.uniforms.cityFade.value = global * (1 - t); if (f.slot !== undefined) this.swapSlots.set(f.slot, global * (1 - t)); continue; }
      this.leaving.delete(f);
      this.releaseSwapSlot(f.slot);
      f.clone.dispose();
      this.disposeMesh(f.mesh);
    }
    this.map.triggerRepaint();
  }

  private endFade(key: string, refresh = true): void {
    const f = this.fading.get(key);
    if (!f) return;
    if (f.mesh.material === f.clone) f.mesh.material = f.source;
    f.clone.dispose();
    this.fading.delete(key);
    if (!refresh) {
      // Dropped mid-fade: its caller decides what happens to a mesh kept under it, which is solid again meanwhile.
      this.releaseSwapSlot(f.slot);
      const out = this.outgoing.get(key);
      if (out?.under) { if (out.mesh.material === out.under.clone) out.mesh.material = out.under.source; out.under.clone.dispose(); out.under = undefined; }
      return;
    }
    // A rebuilt chunk is solid now: the mesh it replaced dissolves out (only its faces the new one lacks still show).
    this.retireOutgoing(key);
    // The detail chunk is solid now: hide the coarse shells it replaces.
    if (key.startsWith('near:') && this.chunks.has(key)) this.refreshDetailOwnership();
    this.releaseSwapSlot(f.slot);
  }

  /**
   * Remove a chunk. `fadeOut` (a chunk that left the resident set, SWAP_FADE): its mesh dissolves out instead of
   * vanishing. `keepOutgoing` (a rebuild cross-fading): the mesh kept under the new one stays.
   */
  private dropChunk(key: string, fadeOut = false, keepOutgoing = false): void {
    this.endFade(key, false);
    if (!keepOutgoing) this.dropOutgoing(key);
    const held = this.chunks.get(key);
    if (!held) return;
    if (held.mesh && !(fadeOut && SWAP_FADE && this.fades(key) && this.fadeOut(held.mesh, key.startsWith('near:') ? new Set(held.ranges.keys()) : undefined))) this.disposeMesh(held.mesh);
    this.chunks.delete(key);
    this.refreshSurveyedRoofOwnership();
    if (key.startsWith('near:')) this.refreshDetailOwnership();
  }

  /** Every leaving mesh goes now (context loss: their buffers are gone). */
  private dropLeaving(): void {
    for (const f of this.leaving) { this.releaseSwapSlot(f.slot); f.clone.dispose(); this.disposeMesh(f.mesh); }
    this.leaving.clear();
  }

  private refreshSurveyedRoofOwnership(): void {
    const ids = new Set<string>();
    if (this.visible && this.ready && this.view.zoom() > MIN_ZOOM) for (const entry of this.chunks.values()) if (entry.mesh)
      for (const id of entry.mesh.userData.boundParentIds ?? []) ids.add(id);
    const previous = this.map._surveyedEnvelopeRoofIds;
    if (previous && previous.length === ids.size && previous.every(id => ids.has(id))) return;
    this.map._surveyedEnvelopeRoofIds = [...ids];
    this.map._pyramidalRoofs?.setHiddenReason('surveyed-envelope', ids);
  }

  private refreshDetailOwnership(): void {
    const next = new Set<string>();
    for (const [key, entry] of this.chunks) if (key.startsWith('near:') && entry.mesh && !this.fading.has(key)) for (const id of entry.ranges.keys()) next.add(id);
    // A rebuilt detail chunk's old mesh still draws, solid, while its successor dissolves in.
    for (const [key, out] of this.outgoing) if (key.startsWith('near:')) for (const id of out.ranges.keys()) next.add(id);
    const changed = new Set([...next, ...this.installedDetailIds].filter(id => next.has(id) !== this.installedDetailIds.has(id)));
    this.installedDetailIds = next;
    if (!changed.size) return;
    for (const entry of this.coarseEntries()) this.applyHidden(entry, changed);
  }

  /** Set when the facades draw in the shared frame (`?sharedFrame=1`) instead of their own layer. */
  private sharedFrame: any = null;
  /** Lit material + sun shadows; only inside the shared frame. */
  private lit = false;
  private depthMaterial: any = null;
  /** Bumped whenever suppressed/answer walls change (they cast differently). */
  private hiddenRevision = 0;

  /** The next texture build is a context restore's (RESTORE_TEXTURE_SLICE_MS). */
  private restoring = false;

  private rebuildAfterContextLoss(): void {
    this.ready = false;
    this.restoring = true;
    this.textureSets.clear();
    for (const key of [...this.chunks.keys()]) this.dropChunk(key);
    this.dropLeaving();
    this.bakedGate?.contextLost?.();
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear();
    this.material.uniforms.cells.value = null;
    void this.setLook(this.requestedLook);
  }

  /** One set-up for both the legacy layer and the shared frame. */
  private setup(map: MapLike, renderer: any, camera: any, scene: any): void {
    const THREE = this.THREE;
    if (!this.appearanceLoaded) void this.loadStreetAppearance();
    this.camera = camera;
    this.scene = scene;
    this.renderer = renderer;
    // CPU copies are freed after upload, so a restored context needs fresh meshes: the shared frame calls
    // rebuildAfterContextLoss once its new renderer exists (onContextRestored).
    this.material = this.newMaterial();
    if (this.lit) this.depthMaterial = createFacadeDepthMaterial(THREE);
    this.materials.set(this.look, this.material);
    const initialLook = this.requestedLook, token = ++this.lookToken;
    void this.texturesFor(cellSetOf(initialLook)).then(set => {
      // A newer mode can finish before the initial atlas. Never overwrite it.
      if (token !== this.lookToken) return;
      // The chunks of this look the workers built while the atlas painted (pump) are kept and install now (#129: the
      // facades were the settle hold's last check, and nothing built until the atlas was ready).
      const same = this.look === initialLook;
      this.look = initialLook;
      this.bindLookMaterial(initialLook, set);
      this.ready = true;
      if (!same) this.invalidateBuilds();
      const staged = new Set(this.staged.map(s => s.key));
      for (const [key, source] of this.sourceGroups) {
        if (same && (this.inflight.has(key) || staged.has(key) || this.pending.has(key))) continue;
        this.pending.push(key, () => this.rebuild(key, source));
      }
      this.pump();
      this.scheduleStage();
      this.map.triggerRepaint();
    });
    const c = this.maplibregl.MercatorCoordinate.fromLngLat([ORIGIN.lng, ORIGIN.lat], 0);
    const scale = c.meterInMercatorCoordinateUnits();
    this.transform = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).scale(new THREE.Vector3(...buildingProjectionScale(scale)));
  }

  /** The canvas pixel ratio MapLibre renders at (the facade tier's rates are per CSS pixel). */
  private pixelRatio(): number {
    if (this.cellTierRatio !== null) return this.cellTierRatio;
    const ratio = (this.map as { getPixelRatio?: () => number }).getPixelRatio?.();
    return typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  }

  /** The texture policy for this page and the facade arrays (look/texturePolicy.ts); read once per page (tier is fixed). */
  private texturePolicy(): TextureParams {
    if (this.texturePolicyCache) return this.texturePolicyCache;
    const gpuMax = this.renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;
    const params = pageTextureParams('facadeCells', gpuMax);
    // The legacy rule's touch test is this layer's own (detailZoom), so `?texturePolicy=0` stays exactly it.
    // Desktop high keeps the policy's facade anisotropy (HIGH_FACADE_ANISOTROPY, lane R3-E #240; `?texAniso=16` restores).
    const high = this.detailZoom !== 17 && pageTextureTier() === 'high' && !pageCoarsePointer() && texturePolicyFlag();
    const resolved = params.cellPx > CELL_PX ? params : { ...params, cellPx: this.detailZoom === 17 ? CELL_PX / 2 : CELL_PX, anisotropy: high ? params.anisotropy : Math.min(gpuMax, this.detailZoom === 17 ? 4 : 16), tierScale: 1 };
    // Cached once the renderer is known (its anisotropy ceiling is part of the answer).
    if (this.renderer) this.texturePolicyCache = resolved;
    return resolved;
  }
  private texturePolicyCache: TextureParams | null = null;
  /** Set by `setCellTierPixelRatio`; null: the map's own ratio. */
  private cellTierRatio: number | null = null;
  private cellTierValue(): [number, number] {
    const band = this.cellTierBand ?? cellTierBandFlag();
    // The half pair (look/atlasAerial.ts) reads half the texels per pixel through textureSize: the band follows.
    const scale = this.texturePolicy().tierScale * (this.atlasHalf ? 0.5 : 1);
    return band ? cellTierFromBand(band, this.pixelRatio(), scale) : facadeTierUniform(this.pixelRatio(), scale);
  }
  /** Probe override of the tier band (lane R3-E, `?cellTierBand=` in page): set by setCellTierBand. */
  private cellTierBand: [number, number] | null = null;
  /**
   * Probe hook (lane R3-E #240, the tier-band A/B in one page): the band at DPR 2 (null: back to the constants or the
   * page's `?cellTierBand=`), applied to every live material at the current ratio. Returns the uniform now set.
   */
  setCellTierBand(band: [number, number] | null): [number, number] {
    this.cellTierBand = band && band.length === 2 && band[1] > band[0] && band[0] > 0 ? [band[0], band[1]] : null;
    const value = this.cellTierValue();
    for (const material of new Set([this.material, ...this.materials.values()])) {
      const u = material?.uniforms?.cellTier;
      if (u && Array.isArray(u.value) && u.value[0] >= 0) u.value = value;
    }
    this.map.triggerRepaint();
    return value;
  }

  /**
   * The facade tier follows the canvas pixel ratio (lane R1-B #224): the governor steps it down (renderGovernor.ts) and
   * the tier caps it after the materials exist, and the uniform was only ever set at material creation. One setter,
   * called from the frame host's resize (engine/ownWorldView.ts), updates every live material (fade clones share the
   * uniform object). `?cellTierFollow=0` leaves the materials as created. Returns how many materials changed.
   */
  setCellTierPixelRatio(ratio: number): number {
    if (!(Number.isFinite(ratio) && ratio > 0)) return 0;
    this.cellTierRatio = ratio;
    const value = this.cellTierValue();
    let changed = 0;
    for (const material of new Set([this.material, ...this.materials.values()])) {
      const u = material?.uniforms?.cellTier;
      if (!u || !Array.isArray(u.value) || u.value[0] < 0) continue;
      if (u.value[0] === value[0] && u.value[1] === value[1]) continue;
      u.value = value; changed++;
    }
    if (changed) this.map.triggerRepaint();
    return changed;
  }

  /** The window table texture of a look's atlas (look/windowTable.ts), once per cell set; null when off or empty. */
  private windowTableFor(cells: 'procedural' | Look): any {
    if (!this.windowSdf) return null;
    if (!this.windowTables.has(cells)) {
      const data = windowTableData(cells);
      this.windowTables.set(cells, data.windows ? createWindowTableTexture(this.THREE, cells) : null);
    }
    return this.windowTables.get(cells);
  }
  private readonly windowTables = new Map<string, any>();
  /** `?windowSdf=0` off; touch devices (detail z17) follow WINDOW_SDF_TOUCH_DEFAULT. Read once the detail zoom is known. */
  private get windowSdf(): boolean { return this.windowSdfOn ??= windowSdfEnabled(this.detailZoom === 17); }
  private windowSdfOn: boolean | undefined;

  /** `?cellLodBias=` as asked; unasked, WINDOW_SDF_LOD_BIAS with the band-limited windows on, else none (no define). */
  private lodBiasFor(windows: boolean): number | null {
    return cellLodBiasFlag() ?? (windows && windowSdfBandEnabled() ? WINDOW_SDF_LOD_BIAS : null);
  }
  /**
   * The anisotropy-aware facade tier (roofTier.ts, lane R3-D #233): the anisotropy the cells texture got from the policy
   * (16 desktop, 4 coarse or low GPUs) with `?cellTierAniso=1`; null by default (no define, no uniform: the major-axis rule).
   */
  private anisoFor(): number | null { return facadeTierAnisoEnabled() ? this.texturePolicy().anisotropy : null; }
  /** The footprint prefilter of the cell sample (roofTier.ts CELL_TAPS, lane R4-D #246): `?cellTaps=1`; null by default (no define). */
  private tapsFor(): ReturnType<typeof cellTapsUniform> | null { return cellTapsEnabled() ? cellTapsUniform(cellTapsOptions(), this.texturePolicy().tierScale) : null; }

  private newMaterial(): any {
    const THREE = this.THREE;
    // The pantile and slate cells (the planned roofs' slope layers) coarsen with distance; every other layer is left alone.
    const roofBase = cellSetOf(this.look) === 'procedural' ? CELL_LAYER_COUNT : BAY_LAYER_COUNT;
    const roofLayers = this.look === 'untextured' ? ROOF_LAYERS_OFF : [roofBase, roofBase + 2];
    if (this.cityLook) {
      // One shader for every building mesh (look/cityLook.ts); chunks keep their own uniforms per look.
      const variant = LOOK_VARIANTS[this.look];
      const cellDebug = cellDebugMode();
      // Analytic windows (look/windowSdf.ts, lane R2-A #228): only for a look whose table has windows; the define,
      // the program key suffix and the table upload are all absent with `?windowSdf=0`.
      const windowTable = this.windowTableFor(cellSetOf(this.look));
      const lodBias = this.lodBiasFor(!!windowTable), aniso = this.anisoFor();
      const anisoUniform = aniso != null ? facadeTierAnisoUniform(aniso) : null;
      const taps = this.tapsFor();
      return createCityLookMaterial(THREE, { lit: this.lit, kind: 'chunk', side: THREE.FrontSide, ...(SWAP_COMPLEMENT ? { swap: true } : {}), ...(cellDebug ? { cellDebug } : {}), ...(windowTable ? { windows: true } : {}), ...(lodBias != null ? { lodBias: true } : {}), ...(anisoUniform ? { aniso: true } : {}), ...(taps ? { taps: true } : {}) }, createCityUniforms(THREE, {
        ...(SWAP_COMPLEMENT ? { citySwapUnder: this.swapUnder } : {}),
        ...(anisoUniform ? { cellAniso: { value: anisoUniform.cellAniso }, cellAnisoRule: { value: anisoUniform.cellAnisoRule } } : {}),
        ...(windowTable ? { windowTable: { value: windowTable } } : {}),
        ...(lodBias != null ? { cellLodBias: { value: lodBias } } : {}),
        ...(taps ? { cellTaps: { value: taps.cellTaps }, cellTapsSdf: { value: taps.cellTapsSdf } } : {}),
        bands: { value: variant.shadeBands }, flatColour: { value: variant.flatColour ? 1 : 0 }, wallGain: { value: litFacadeWallGain(variant.litWallGain) },
        roofLayers: { value: roofLayers }, roofTier: { value: roofTierUniform() }, cellTier: { value: this.cellTierValue() },
      }));
    }
    if (this.lit) {
      const windowTable = this.windowTableFor(cellSetOf(this.look));
      const material = createLitFacadeMaterial(THREE, { cityFlat: { value: CITY_FLAT }, roofLayers: { value: roofLayers }, roofTier: { value: roofTierUniform() }, cellTier: { value: this.cellTierValue() } }, { ...(windowTable ? { windowTable } : {}), lodBias: this.lodBiasFor(!!windowTable), aniso: this.anisoFor(), taps: this.tapsFor() });
      material.uniforms.bands.value = LOOK_VARIANTS[this.look].shadeBands;
      material.uniforms.flatColour.value = LOOK_VARIANTS[this.look].flatColour ? 1 : 0;
      if (material.uniforms.wallGain) material.uniforms.wallGain.value = litFacadeWallGain(LOOK_VARIANTS[this.look].litWallGain);
      return material;
    }
    const aniso = this.anisoFor(), anisoUniform = aniso != null ? facadeTierAnisoUniform(aniso) : null;
    return new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: VERTEX, fragmentShader: FRAGMENT, defines: { ...highlightDefines(), ...(anisoUniform ? { CELL_TIER_ANISO: '' } : {}) },
      uniforms: { cells: { value: null }, masks: { value: null }, bands: { value: LOOK_VARIANTS[this.look].shadeBands }, flatColour: { value: LOOK_VARIANTS[this.look].flatColour ? 1 : 0 }, cityFade: { value: 1 }, cityTone: { value: 1 }, cityFlat: { value: CITY_FLAT }, roofLayers: { value: roofLayers }, roofTier: { value: roofTierUniform() }, cellTier: { value: this.cellTierValue() }, ...(anisoUniform ? { cellAniso: { value: anisoUniform.cellAniso }, cellAnisoRule: { value: anisoUniform.cellAnisoRule } } : {}) }, side: THREE.FrontSide,
    });
  }

  /** Per-frame state shared by both paths; false when nothing should draw. */
  private prepareFrame(): boolean {
    this.refreshSurveyedRoofOwnership();
    // A view all drawn by baked cells (lane R4-A #243) may have no chunk of its own and still has to draw.
    if (!this.visible || !this.ready || !this.scene || (!this.chunks.size && !this.bakedEntries.size) || this.view.zoom() < MIN_ZOOM) return false;
    // One curve with the own ground and the shadows (overviewTransition/blend.ts); `?transition=0` keeps the old linear ramp.
    const zoom = this.view.zoom();
    // With the transition the buildings are present early (a short dither while they are still the footprint's
    // colour) and their colour comes in from the flat footprint tone over the whole window.
    const b = TRANSITION ? blendAtZoom(zoom) : 1;
    const fade = TRANSITION ? presenceOf(b) : Math.max(0, Math.min(1, (zoom - MIN_ZOOM) / 1.6));
    for (const material of this.materials.values()) {
      material.uniforms.cityFade.value = fade;
      if (material.uniforms.cityTone) material.uniforms.cityTone.value = b;
    }
    this.tickFades(fade);
    // Lane R4-A (#243): the baked cells' dissolves advance with the drawn frame. Stepped only from the game's sync,
    // they stalled whenever the sync did (a held camera, a paused game): every cell stayed at the start of its
    // dissolve, invisible, while its buildings were already out of the runtime coarse chunks (da-costakade-user).
    this.bakedFrame?.();
    return true;
  }

  /**
   * Draw in the page's shared three.js frame instead of an own custom layer:
   * one renderer, scene and light rig with the landmarks, trees and vehicles,
   * plus the lit facade material and sun shadows. The only way the facades draw.
   */
  attachToSharedFrame(frame: any, options: { order?: number } = {}): void {
    if (this.sharedFrame) return;
    const THREE = (window as any).CanalRecallThree?.THREE;
    if (!THREE) { console.warn('three-building-facades: shared three.js missing'); return; }
    this.THREE = THREE;
    this.sharedFrame = frame;
    this.lit = true;
    const root = new THREE.Group();
    root.name = 'three-building-facades';
    const camera = new THREE.Camera();
    frame.register('facades', {
      root,
      onAttach: (f: any) => this.setup(this.map, f.renderer, camera, root),
      onContextRestored: (f: any) => { this.renderer = f.renderer; this.rebuildAfterContextLoss(); },
      mercatorFromLocal: () => this.transform?.elements,
      revision: () => this.hiddenRevision,
      beforeRender: (ctx: any) => {
        if (!this.prepareFrame()) return false;
        if (this.atlasAerial) this.tickAtlasAerial(ctx);
        // Picking (inspectAtScreen) raycasts world-space meshes with this projection.
        camera.projectionMatrix.copy(ctx.clipFromWorld);
        return true;
      },
    }, { order: options.order ?? 0 });
  }

  /** Chunks still queued, building in the worker or staged for install; 0 when settled or not drawn at this zoom. */
  /**
   * Work the settle hold (engine/settle.ts 'facades') waits on: queued, building and staged chunks, plus the look's
   * atlas while it is requested but not yet bound (#129: `?engine=own` never races without facades; the chunks built
   * meanwhile install only once it is).
   */
  get loadingCount(): number {
    if (!this.visible || this.view.zoom() < MIN_ZOOM) return 0;
    return this.pending.length + this.inflight.size + this.staged.length + (!this.ready && this.textureSets.size ? 1 : 0);
  }

  /**
   * What the settle hold waits for (#129, 2026-11-01): the chunks still to build or install that the first racing
   * frame shows. Every detail-block chunk (`near:` / `extras:`, the block around the rider), the kits, and the z14
   * coarse shells and houseboat chunks whose tile comes within `ringM` of the rider; plus the atlas while it binds.
   * `loadingCount` also counts shells out to the far edge of the resident tiles (1.1-1.9 km), which the hold need not
   * wait for: they install while riding, as before.
   */
  loadingWithin(ringM: number): number {
    if (!this.visible || this.view.zoom() < MIN_ZOOM) return 0;
    const keys = [...this.pending.keys(), ...this.inflight.keys(), ...this.staged.map(job => job.key)];
    let n = !this.ready && this.textureSets.size ? 1 : 0;
    for (const key of new Set(keys)) if (chunkKeyDistanceM(key, this.rider, TILE_ZOOM) <= ringM) n++;
    return n;
  }

  /**
   * Which of this layer's tiers owns the ground at lng/lat (lane S1 #313, engine/startHold.ts census): `facade` when
   * the detail tile's `near:` chunk is installed, `coarse` when only the z14 runtime shell is, else `none`. `wanted`:
   * the detail tile is in the current detail block, so a coarse shell there will still be replaced.
   */
  tierAt(lng: number, lat: number): { owner: 'facade' | 'coarse' | 'none'; wanted: boolean } {
    const one = [[[[lng, lat]]]] as number[][][][];
    const near = tileKeyAt(one, this.detailZoom);
    if (this.chunks.get(`near:${near}`)?.mesh) return { owner: 'facade', wanted: true };
    const wanted = this.detailTiles.has(near);
    return { owner: this.chunks.get(COARSE_PREFIX + tileKeyAt(one, TILE_ZOOM))?.mesh ? 'coarse' : 'none', wanted };
  }

  /** Whether this layer draws through the shared frame. */
  get inSharedFrame(): boolean { return !!this.sharedFrame; }
}
