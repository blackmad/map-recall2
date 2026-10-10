import { BuildingContextIndex } from './buildingContextIndex.js';
import { ChunkBuildQueue } from './chunkBuildQueue.js';
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
import { withMonumentGable } from './monumentGables.js';
import { decorateRoof, exceptLandmarks as exceptLandmarksOf, fitRect, localOuterRing, planRoof, type RoofPlan } from './roofMesh.js';
import { BAY_ENTRIES, BAY_LAYER_COUNT, FATIH_MASONRY_LAYER, bayLayer, bayLookFor, bayVariant } from './bayLook.js';
import { paintGlassBlockCell } from './glassBlockTexture.js';
import { bayTextures, type Look } from './bayTextures.js';
import { KITS, KIT_HIDE_IDS, KIT_MODELLED_IDS, KIT_PART_IDS, decorateKitRoof, kitGeometry, type KitPartGeometry, type PartInput } from './landmarkKits.js';
import { FRONT_LIST, FRONT_PART_IDS, decorateFront } from './landmarkFrontData.js';
import { frontKitGeometry, lookHex } from './landmarkFronts.js';
import { decorateShopfront, setShopfronts } from './shopfronts.js';
import { boatForLandmark, houseboatGeometry, houseboatsByTile, type Houseboat } from './houseboats.js';
import { buildKitChunk, type Chunk } from './threeBuildingMesh.js';
import { FALLBACK_REACH_M, SegmentGrid, streetSegments } from './streetFronts.js';
import { ORIGIN, ROOF_TONES, asPolygons, cellSetOf, type BuildingLook, type Feature } from './threeBuildingFeatures.js';
export { ORIGIN, ROOF_TONES, type BuildingLook };
import { FACADE_STYLES, type FacadeStyle } from './genericFacades.js';
import { validateStreetAppearanceCatalog, type StreetAppearanceCatalog, type StreetAppearanceProfile } from './streetAppearance.js';
import type { ChunkHostOpeningConfig } from './hostWallOpenings.js';
import { PROCEDURAL_RECIPE_LAYER_OFFSET } from './streetFacadeRendering.js';
import { buildingProjectionScale } from './buildingProjectionScale.js';
import { createFacadeDepthMaterial, createLitFacadeMaterial } from './rendererShared/litFacadeMaterial.js';

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
/** Facades show from this map zoom (the extrusion layer's own minzoom was 14). */
export const MIN_ZOOM = 14;

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
void main() {
  vUv = uv; vLayer = layer; vTint = tint.rgb; vAccent = accent.rgb; vShade = tint.a;
  // hidden: 0 drawn, 1 hidden, 2 the highlighted answer (drawn plain yellow).
  vHighlight = hidden > 1.5 ? 1.0 : 0.0;
  gl_Position = hidden > 0.5 && hidden < 1.5 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
in vec2 vUv;
flat in float vLayer;
in vec3 vTint;
in vec3 vAccent;
in float vShade;
flat in float vHighlight;
out vec4 fragColor;
void main() {
  // Screen-door coverage keeps depth writes correct while the city emerges from the overview.
  if (cityFade < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= cityFade) discard;
  if (vHighlight > 0.5) { fragColor = vec4(vec3(1.0, 0.824, 0.122) * vShade, 1.0); return; }
  vec3 p = vec3(vUv, vLayer);
  vec3 c = texture(cells, p).rgb;
  vec2 m = texture(masks, p).rg;
  c *= mix(vec3(1.0), vTint, m.r) * mix(vec3(1.0), vAccent, m.g);
  if (flatColour > 0.5) c = vTint;
  float shade = bands > 0.5 ? floor(vShade * bands + 0.5) / bands : vShade;
  fragColor = vec4(c * shade, 1.0);
}`;

const ROOF_LAYER_COUNT = 4;

const infoOf = (chunk: Chunk): ChunkInfo => ({
  buildingCount: chunk.buildingCount, wallCount: chunk.wallCount, quadCount: chunk.quadCount, vertexCount: chunk.vertexCount,
  bytes: chunk.positions.byteLength + chunk.uvs.byteLength + chunk.layers.byteLength + chunk.tints.byteLength + chunk.accents.byteLength + chunk.indices.byteLength + chunk.vertexCount,
});

/**
 * The bay drawings are drawn crisp for a standalone page; seen as whole streets
 * at game scale they read as noise. Soften them where it costs nothing a player
 * learns from: wall texture is pulled toward its mean (brick reads as colour,
 * not speckle) and the darkest glass is lifted so windows stop being black
 * holes. Frames, doors and stone keep their contrast, so the facade rhythm stays.
 */
export function calmBayLayers(colour: Uint8Array, mask: Uint8Array, layers: number, look: Look, size = CELL_PX): void {
  const px = size * size;
  const wallPull = look === 'photo' ? 0.7 : 0.35, glassLift = look === 'photo' ? 0.5 : 0.25;
  for (let layer = 0; layer < layers; layer++) {
    // Mean wall colour of this layer (mask.r is the wall tint weight).
    let sum = [0, 0, 0], n = 0;
    for (let i = 0; i < px; i++) {
      if (mask[(layer * px + i) * 2] > 200) { for (let c = 0; c < 3; c++) sum[c] += colour[(layer * px + i) * 4 + c]; n++; }
    }
    const mean = n ? sum.map(v => v / n) : [200, 200, 200];
    // Brick photos are dark; the tint multiplies them again. Lift wall pixels so the layer's mean is ~0.88 and the tint colour is what you see.
    const meanLum = (mean[0] + mean[1] + mean[2]) / 3;
    const lift = look === 'photo' && meanLum > 0 ? Math.min(2.4, 225 / meanLum) : 1;
    for (let i = 0; i < px; i++) {
      const at = (layer * px + i) * 4, wall = mask[(layer * px + i) * 2] / 255, accent = mask[(layer * px + i) * 2 + 1];
      if (wall > 0.5) {
        if (look === 'photo') {
          // Brick is relief evidence, not a second colour prior. Multiplying a
          // red photograph by surveyed brown/charcoal tint made every street
          // orange. Keep luminance variation and let vertex tint own the hue.
          const lum = (colour[at] + colour[at + 1] + colour[at + 2]) / 3;
          const neutral = Math.min(255, (lum + (meanLum - lum) * wallPull * wall) * (1 + (lift - 1) * wall));
          for (let c = 0; c < 3; c++) colour[at + c] = colour[at + c] * (1 - wall) + neutral * wall;
        } else {
          for (let c = 0; c < 3; c++) colour[at + c] = Math.min(255, (colour[at + c] + (mean[c] - colour[at + c]) * wallPull * wall) * (1 + (lift - 1) * wall));
        }
      } else if (accent < 128) {
        const lum = (colour[at] + colour[at + 1] + colour[at + 2]) / 3;
        if (lum < 90) { const k = glassLift * (1 - lum / 90); for (let c = 0; c < 3; c++) colour[at + c] += (150 - colour[at + c]) * k; }
      }
    }
  }
}


const tileKeyOf = (polygons: number[][][][], zoom = TILE_ZOOM): string => {
  const [lng, lat] = polygons[0]?.[0]?.[0] ?? [0, 0];
  const n = 2 ** zoom, rad = lat * Math.PI / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return `${x}/${y}`;
};


/** Landmarks keep their own form; kit-modelled parts and bodies pass through, the rest get a period fallback (roofMesh.ts). */
const exceptLandmarks = <T extends { properties: Record<string, unknown>; type: 'Feature'; geometry: unknown }>(decorate: (f: T) => T, ids: ReadonlySet<string>, listed?: ReadonlySet<string>) => exceptLandmarksOf(decorate, ids, KIT_MODELLED_IDS, listed);
export { decorateRoof, exceptLandmarks, decorateKitRoof, decorateFront, decorateShopfront, setShopfronts, KIT_HIDE_IDS, withMonumentGable };

const KIT_KEY = '__kit';
const BOAT_PREFIX = 'boats:';
/** Boat chunks build from the houseboat extract, not features: one shared empty source keeps them stable. */
const NO_SOURCE: Feature[] = [];
/** The chunk worker sits next to this bundle (three-buildings-worker.bundle.js). */
const WORKER_URL = typeof document !== 'undefined' ? ((document.currentScript as HTMLScriptElement | null)?.src ?? '').replace(/three-buildings\.bundle\.js(\?.*)?$/, 'three-buildings-worker.bundle.js$1') : '';
const KIT_HIDE_SET: ReadonlySet<string> = new Set(KIT_HIDE_IDS);


/** What stays after upload: counts only, never the typed arrays. */
type ChunkInfo = { buildingCount: number; wallCount: number; quadCount: number; vertexCount: number; bytes: number };

export type ThreeBuildingStats = { kitVertices: number; chunks: number; buildings: number; walls: number; quads: number; vertices: number; geometryMB: number; textureMB: number; drawCalls: number; triangles: number; buildMs: number };

/** The game's colour and tint-mask texture arrays for a look (also used by the gallery pages). */
export async function buildLookTextures(THREE: any, look: 'procedural' | Look, maxAnisotropy: number, size = CELL_PX): Promise<{ colour: any; mask: any }> {
  if (size !== CELL_PX && size !== CELL_PX / 2) throw new Error('Unsupported building texture size');
  const layers = (look === 'procedural' ? PROCEDURAL_RECIPE_LAYER_OFFSET + BAY_LAYER_COUNT : BAY_LAYER_COUNT + ROOF_LAYER_COUNT) + 1;
  if (layers > 256) throw new Error('Building texture array exceeds byte layer indices');
  const px = size * size, colour = new Uint8Array(px * 4 * layers), mask = new Uint8Array(px * 2 * layers);
  let batchStart = performance.now();
  const yieldBudget = async () => {
    if (performance.now() - batchStart < 6) return;
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    batchStart = performance.now();
  };
  // Native procedural painters store wall tint in alpha. Downsample one cell at
  // a time so the mobile path never allocates a second full-size city atlas.
  const copyCell = (cell: Uint8ClampedArray, layer: number) => {
    const factor = CELL_PX / size;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let red = 0, green = 0, blue = 0, tint = 0;
      for (let dy = 0; dy < factor; dy++) for (let dx = 0; dx < factor; dx++) {
        const at = ((y * factor + dy) * CELL_PX + x * factor + dx) * 4;
        red += cell[at]; green += cell[at + 1]; blue += cell[at + 2]; tint += cell[at + 3];
      }
      const at = layer * px + y * size + x, count = factor * factor;
      colour[at * 4] = Math.round(red / count); colour[at * 4 + 1] = Math.round(green / count); colour[at * 4 + 2] = Math.round(blue / count);
      colour[at * 4 + 3] = 255; mask[at * 2] = Math.round(tint / count);
    }
  };
  if (look === 'procedural') {
    for (const style of FACADE_STYLES) for (let variant = 0; variant < CELL_VARIANTS; variant++) for (const kind of CELL_KINDS) {
      copyCell(paintCell(style, kind, variant), cellLayer(style, kind, variant));
      await yieldBudget();
    }
  }
  const roofBase = look === 'procedural' ? CELL_LAYER_COUNT : BAY_LAYER_COUNT;
  copyCell(paintGlassBlockCell(),layers - 1);
  for (const [i, cell] of paintRoofLayers(look === 'cartoon').entries()) { copyCell(cell, roofBase + i); await yieldBudget(); }
  let brick: CanvasImageSource = document.createElement('canvas');
  if (look === 'photo') {
    const image = new Image(); image.src = new URL('materials/ambientcg/Bricks057/colour.jpg', document.baseURI).href;
    try { await image.decode(); brick = image; } catch { /* neutral drawn brick */ }
  }
  const scratch = document.createElement('canvas'); scratch.width = scratch.height = size;
  const ctx = scratch.getContext('2d', { willReadFrequently: true })!;
  for (const entry of BAY_ENTRIES) {
    if (entry.originalMasonry) {
      copyCell(paintFatihMasonryCell(), look === 'procedural' ? PROCEDURAL_RECIPE_LAYER_OFFSET + entry.layer : entry.layer);
      await yieldBudget();
      continue;
    }
    const bayLook = look === 'procedural' ? 'photo' : look;
    const painted = bayTextures(bayVariant(entry), brick, bayLook);
    const layer = look === 'procedural' ? PROCEDURAL_RECIPE_LAYER_OFFSET + entry.layer : entry.layer;
    for (const [source, isMask] of [[painted.colour, false], [painted.mask, true]] as const) {
      ctx.clearRect(0, 0, size, size); ctx.drawImage(source, 0, 0, size, size);
      const pixels = ctx.getImageData(0, 0, size, size).data;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const from = ((size - 1 - y) * size + x) * 4, at = layer * px + y * size + x;
        if (isMask) { mask[at * 2] = pixels[from]; mask[at * 2 + 1] = pixels[from + 1]; }
        else { colour[at * 4] = pixels[from]; colour[at * 4 + 1] = pixels[from + 1]; colour[at * 4 + 2] = pixels[from + 2]; colour[at * 4 + 3] = 255; }
      }
    }
    if (look !== 'procedural') calmBayLayers(colour.subarray(layer * px * 4, (layer + 1) * px * 4), mask.subarray(layer * px * 2, (layer + 1) * px * 2), 1, bayLook, size);
    await yieldBudget();
  }
  const array = (data: Uint8Array, format: any) => {
    const t = new THREE.DataArrayTexture(data, size, size, layers);
    t.format = format; t.type = THREE.UnsignedByteType;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.userData = { bytes: data.byteLength };
    t.onUpdate = () => { t.image.data = null; };
    t.generateMipmaps = true; t.anisotropy = maxAnisotropy; t.unpackAlignment = 1; t.needsUpdate = true;
    return t;
  };
  return { colour: array(colour, THREE.RGBAFormat), mask: array(mask, THREE.RGFormat) };
}

/** Own ground: a feature's base height (metres), undefined while its relief is not resident, null where there is none. */
export type GroundBaseFn = (feature: Feature) => number | null | undefined;
/** Per chunk: what each building was lifted by, and which still wait for their relief. */
type GroundLift = { applied: Map<string, number>; pending: Set<string>; features: Map<string, Feature> };

export class ThreeBuildings {
  readonly layer: any;
  private visible = true;
  private THREE: any;
  private scene: any;
  private material: any;
  private renderer: any;
  private camera: any;
  private readonly chunks = new Map<string, { source: Feature[]; mesh: any; info: ChunkInfo; ranges: Map<string, { start: number; count: number }>; lift?: GroundLift }>();
  /** Own ground (`?ownGround=1`): a building's base on the relief; undefined = not known yet, null = no relief there. */
  private groundBase: GroundBaseFn | null = null;
  /** Ids hidden per reason (the answer building, signature models); a facade is hidden while any reason holds it. */
  private readonly hiddenBy = new Map<string, Set<string>>();
  private hidden = new Set<string>();
  private highlighted = new Set<string>();
  private readonly pending = new ChunkBuildQueue();
  private workerBusy = false;
  private pumping = false;
  private lastBuildMs = 0;
  private transform: any = null;

  private look: BuildingLook;
  private requestedLook: BuildingLook;
  private readonly materials = new Map<BuildingLook, any>();
  private sourceGroups = new Map<string, Feature[]>();
  private contextGroups = new Map<string, Feature[]>();
  private textureSets = new Map<BuildingLook, Promise<{ colour: any; mask: any }>>();
  private lookToken = 0;
  private appearanceToken = 0;
  private envelopeLoadToken = 0;
  private surveyedEnvelopeTransport = EMPTY_ENVELOPE_TRANSPORT;
  private appearanceRevision = '';
  private appearanceProfiles: readonly StreetAppearanceProfile[] = [];
  private appearanceStreets: SegmentGrid | null = null;
  private appearanceLoaded = false;
  private worker: Worker | null | undefined;
  private readonly gens = new Map<string, number>();
  private readonly inflight = new Map<string, Feature[]>();
  private readonly inflightOptions = new Map<string, BuildOptions>();
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

  constructor(private readonly map: MapLike, private readonly maplibregl: MaplibreLike, look: BuildingLook = 'procedural') {
    this.look = this.requestedLook = look;
    this.layer = this.makeLayer();
  }

  /** Raycast the rendered mesh and resolve its vertex range to an exact
   * building ID. Shader-hidden replacement meshes must never intercept a
   * click on the manual model that replaced them. */
  inspectAtScreen(x: number, y: number, width: number, height: number): any {
    if (!this.visible || !this.ready || !this.camera || !this.THREE || !width || !height) return null;
    const T = this.THREE;
    const projection = this.camera.projectionMatrix;
    const inverse = projection.clone().invert();
    const nx = x / width * 2 - 1, ny = 1 - y / height * 2;
    const near = new T.Vector3(nx, ny, -1).applyMatrix4(inverse);
    const far = new T.Vector3(nx, ny, 1).applyMatrix4(inverse);
    const ray = new T.Raycaster(near, far.sub(near).normalize());
    let result: any = null;
    for (const [key, chunk] of this.chunks) {
      if (!chunk.mesh || !chunk.source.length) continue;
      chunk.mesh.updateWorldMatrix(true, true);
      const sphere = chunk.mesh.geometry.boundingSphere?.clone().applyMatrix4(chunk.mesh.matrixWorld);
      if (sphere && !ray.ray.intersectsSphere(sphere)) continue;
      let pickMesh = chunk.mesh, temporary: any = null;
      // Uploaded buffers are intentionally released on the CPU. Rebuild
      // only a ray-intersecting chunk, with its installed build inputs, and
      // discard it after the click rather than retaining city-wide buffers.
      if (!chunk.mesh.geometry.getAttribute('position')?.array || chunk.mesh.geometry.index && !chunk.mesh.geometry.index.array) {
        const installedLook = chunk.mesh.userData.installedLook as BuildingLook | undefined;
        if (!installedLook) continue;
        const rebuilt = key === KIT_KEY ? this.buildKits(chunk.source, installedLook)
          : buildTransportedEnvelopeChunk(chunk.source, {look:installedLook,mode:chunkMode(key),streets:chunk.mesh.userData.installedStreets,profiles:chunk.mesh.userData.installedProfiles ?? [],contextFeatures:chunk.mesh.userData.installedContextFeatures ?? [],hostOpenings:chunk.mesh.userData.installedHostOpenings ?? [],surveyedEnvelopeData:chunk.mesh.userData.installedSurveyedEnvelopeData ?? []}).chunk;
        if (rebuilt.vertexCount !== chunk.mesh.geometry.getAttribute('position').count
          || rebuilt.ranges.length !== chunk.ranges.size
          || rebuilt.ranges.some(range => {
            const drawn = chunk.ranges.get(range.id);
            return !drawn || drawn.start !== range.start || drawn.count !== range.count;
          })) continue;
        temporary = new T.BufferGeometry();
        temporary.setAttribute('position', new T.BufferAttribute(rebuilt.positions, 3));
        temporary.setIndex(new T.BufferAttribute(rebuilt.indices, 1));
        temporary.boundingSphere = chunk.mesh.geometry.boundingSphere;
        pickMesh = new T.Mesh(temporary, chunk.mesh.material);
        pickMesh.matrixAutoUpdate = false;
        pickMesh.matrixWorld.copy(chunk.mesh.matrixWorld);
      }
      try { for (const hit of ray.intersectObject(pickMesh, false)) {
        const vertex = hit.face?.a;
        if (vertex == null) continue;
        const hidden = chunk.mesh.geometry.getAttribute('hidden')?.getX(vertex);
        if (hidden > 0.5 && hidden < 1.5) continue;
        const pair = [...chunk.ranges].find(([, range]) => vertex >= range.start && vertex < range.start + range.count);
        if (!pair || this.hidden.has(pair[0])) continue;
        const feature = chunk.source.find(feature => String(feature.properties.id) === pair[0]);
        if (!feature) continue;
        const depth = hit.point.clone().applyMatrix4(projection).z;
        if (depth < -1 || depth > 1 || result && depth >= result.depth) continue;
        const p = feature.properties || {};
        const at = (this.map as any).unproject([x, y]);
        result = { id: pair[0], name: p.name || p['name:en'] || '',
          height: Number(p.height) || undefined, lngLat: [at.lng, at.lat], depth,
          footprint: feature.geometry,
          featureTarget: { source: 'osm-building-appearance', id: pair[0] } };
      } } finally { temporary?.dispose(); }
    }
    return result;
  }

  getLook(): BuildingLook { return this.requestedLook; }

  /** Keep every resident mesh paired with the atlas and palette it was built for. */
  private bindLookMaterial(look: BuildingLook, set: { colour: any; mask: any }): void {
    let material = this.materials.get(look);
    if (!material) {
      // The lit material's onBeforeCompile does not survive clone().
      material = this.lit ? this.newMaterial() : this.material.clone();
      this.materials.set(look, material);
    }
    material.uniforms.cells.value = set.colour;
    material.uniforms.masks.value = set.mask;
    material.uniforms.bands.value = look === 'cartoon' ? 3 : 0;
    material.uniforms.flatColour.value = look === 'untextured' ? 1 : 0;
    this.material = material;
    this.textureMB = (set.colour.userData.bytes + set.mask.userData.bytes) * 4 / 3 / 1048576;
  }

  /** Invalidate work at request time, before awaiting textures or pumping queued jobs. */
  private invalidateBuilds(): void {
    this.workerBusy = false;
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
    // Tile arrivals during texture loading may have queued jobs for the former look.
    this.invalidateBuilds();
    this.look = look;
    this.bindLookMaterial(look, set);
    this.ready = true;
    for (const [key, source] of this.sourceGroups) this.pending.push(key, () => this.rebuild(key, source));
    this.pump();
    this.map.triggerRepaint();
  }

  /** Build (once) the colour and tint-mask texture arrays for a look. */
  private texturesFor(look: 'procedural' | Look): Promise<{ colour: any; mask: any }> {
    let set = this.textureSets.get(look);
    if (!set) this.textureSets.set(look, set = this.buildTextures(look));
    return set;
  }

  private buildTextures(look: 'procedural' | Look): Promise<{ colour: any; mask: any }> {
    return buildLookTextures(this.THREE, look, Math.min(this.renderer.capabilities.getMaxAnisotropy(), this.detailZoom === 17 ? 4 : 16), this.detailZoom === 17 ? CELL_PX / 2 : CELL_PX);
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    this.refreshSurveyedRoofOwnership();
    this.map.triggerRepaint();
  }

  /** The resident building set from the tile streamer; rebuilds only chunks whose features changed. */
  setFeatures(features: readonly Feature[]): void {
    if (features !== this.lastFeatures) this.contextIndex = new BuildingContextIndex(features, f => this.boundsFor(f));
    const groups = new Map<string, Feature[]>();
    const kitParts: Feature[] = [];
    for (const feature of features) {
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
      let list = groups.get(key);
      if (!list) groups.set(key, list = []);
      list.push(feature);
      // The cheap shell remains available until the detailed mesh actually installs.
      if (detailed) { const k = `near:${near}`; let l = groups.get(k); if (!l) groups.set(k, l = []); l.push(feature); }
      if (detailed) { const k = EXTRAS_PREFIX + near; let l = groups.get(k); if (!l) groups.set(k, l = []); l.push(feature); }
    }
    if (kitParts.length) groups.set(KIT_KEY, kitParts);
    // Houseboats ride along with the resident building tiles, one chunk per tile.
    for (const feature of features) {
      const polygons = asPolygons(feature.geometry);
      if (!polygons.length) continue;
      const key = tileKeyOf(polygons);
      if (this.boatTiles.has(key)) groups.set(BOAT_PREFIX + key, NO_SOURCE);
    }
    this.lastFeatures = features;
    this.sourceGroups = groups;
    const same = (a: readonly Feature[] | undefined, b: readonly Feature[]) => !!a && a.length === b.length && a.every((f, i) => f === b[i]);
    for (const key of [...this.chunks.keys(), ...this.inflight.keys()]) if (!groups.has(key)) { this.dropChunk(key); this.inflight.delete(key); this.inflightOptions.delete(key); this.gens.set(key, (this.gens.get(key) ?? 0) + 1); }
    for(const key of this.contextGroups.keys()) if(!groups.has(key)) this.contextGroups.delete(key);
    const contexts = new Map<string, Feature[]>();
    for (const [key, list] of groups) {
      const contextKey = key.startsWith(EXTRAS_PREFIX) ? `near:${key.slice(EXTRAS_PREFIX.length)}` : key;
      let context = contexts.get(contextKey);
      if (!context) { context = key === KIT_KEY || key.startsWith(BOAT_PREFIX) ? [] : this.contextFor(list); contexts.set(contextKey, context); }
      const previousContext=this.contextGroups.get(key);
      this.contextGroups.set(key,context);
      const flying = this.inflight.get(key);
      if (same(previousContext,context) && (flying ? same(flying, list) : same(this.chunks.get(key)?.source, list))) continue;
      this.pending.push(key, () => this.rebuild(key, list));
    }
    this.pump();
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
    if (!this.visible || !this.ready || this.look !== this.requestedLook || this.map.getZoom() < MIN_ZOOM || !configs.length) return false;
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

  /** The answer building(s): drawn plain yellow in place, so MapLibre need not draw a stand-in prism. */
  setHighlighted(ids: Iterable<string | number>): void {
    const next = new Set([...ids].map(String));
    const changed = new Set<string>([...next, ...this.highlighted].filter(id => next.has(id) !== this.highlighted.has(id)));
    this.highlighted = next;
    if (!changed.size) return;
    for (const entry of this.chunks.values()) this.applyHidden(entry, changed);
    this.map.triggerRepaint();
  }

  setHidden(reason: string, ids: Iterable<string | number>): void {
    this.hiddenBy.set(reason, new Set([...ids].map(String)));
    const next = new Set<string>();
    for (const set of this.hiddenBy.values()) for (const id of set) next.add(id);
    const changed = new Set<string>([...next, ...this.hidden].filter(id => next.has(id) !== this.hidden.has(id)));
    this.hidden = next;
    if (!changed.size) return;
    for (const entry of this.chunks.values()) this.applyHidden(entry, changed);
    this.map.triggerRepaint();
  }

  stats(): ThreeBuildingStats {
    let buildings = 0, walls = 0, quads = 0, vertices = 0, bytes = 0;
    for (const { info } of this.chunks.values()) {
      buildings += info.buildingCount; walls += info.wallCount; quads += info.quadCount; vertices += info.vertexCount; bytes += info.bytes;
    }
    const info = this.renderer?.info?.render;
    return {
      kitVertices: this.chunks.get(KIT_KEY)?.info.vertexCount ?? 0, chunks: this.chunks.size, buildings, walls, quads, vertices,
      geometryMB: bytes / 1048576, textureMB: this.textureMB,
      drawCalls: info?.calls ?? 0, triangles: info?.triangles ?? 0, buildMs: this.lastBuildMs,
    };
  }

  dispose(): void {
    ++this.envelopeLoadToken;
    ++this.appearanceToken;
    this.appearanceLoaded = false;
    this.invalidateBuilds();
    this.worker?.terminate();
    this.worker = undefined;
    for (const key of [...this.chunks.keys()]) this.dropChunk(key);
    for (const material of new Set([this.material, ...this.materials.values()])) material?.dispose();
    this.materials.clear();
    for (const set of this.textureSets.values()) void set.then(t => { t.colour.dispose(); t.mask.dispose(); });
  }

  private textureMB = 0;

  private ready = false;

  private pump(): void {
    if (this.pumping || this.workerBusy || !this.pending.length || !this.THREE || !this.ready) return;
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
   */
  setDetailCentre(lng: number, lat: number): void {
    const n = 2 ** this.detailZoom, rad = lat * Math.PI / 180;
    const fx = ((lng + 180) / 360) * n, fy = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
    const x = Math.floor(fx), y = Math.floor(fy), dx = fx - x < 0.5 ? -1 : 1, dy = fy - y < 0.5 ? -1 : 1;
    const next = [`${x}/${y}`, `${x + dx}/${y}`, `${x}/${y + dy}`, `${x + dx}/${y + dy}`];
    if (next.length === this.detailTiles.size && next.every(k => this.detailTiles.has(k))) return;
    this.detailTiles = new Set(next);
    this.setFeatures(this.lastFeatures);
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
    for (const key of [...this.chunks.keys()]) if (key.startsWith(BOAT_PREFIX)) this.dropChunk(key);
    this.setFeatures(this.lastFeatures);
  }

  /**
   * Canal water height relative to the street (metres, ≤ 0). The opt-in
   * elevation layer (`?elevation=1`) sinks canal water below the quays; boats
   * follow it. Buildings, kits and trees stay at street level.
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
  private contextFor(source:readonly Feature[]):Feature[]{
    const ids=new Set(source.map(f=>String(f.properties.id)));
    return this.contextIndex?.neighbors(source, f => {
      const id=String(f.properties.id);return ids.has(id)||KIT_HIDE_SET.has(id)||this.boatIds.has(id);
    }) ?? [];
  }
  private rebuild(key: string, source: Feature[]): void {
    if (!this.THREE || this.look !== this.requestedLook || !this.currentSource(key, source)) return;
    const worker = this.chunkWorker();
    const gen = (this.gens.get(key) ?? 0) + 1;
    this.gens.set(key, gen);
    if (worker) {
      // Off the main thread; a reply for an older generation (the tile changed again, or the look) is dropped.
      this.inflight.set(key, source);
      const options = { surveyedEnvelopeData: this.surveyedEnvelopeTransport.envelopes, surveyedEnvelopeRevision: this.surveyedEnvelopeTransport.revision, look: this.look, streets: this.streetsFor(source), profiles: this.appearanceProfiles, contextFeatures: this.contextGroups.get(key) ?? this.contextFor(source), appearanceRevision: this.appearanceRevision, hostOpenings: this.openingsFor(key, source), hostOpeningRevision: this.openingRevision(key, source) };
      this.inflightOptions.set(key, options);
      this.workerBusy = true;
      worker.postMessage({ key, gen, ...options, features: source, mode: chunkMode(key),
        special: key === KIT_KEY ? 'kits' : key.startsWith(BOAT_PREFIX) ? 'boats' : undefined,
        boats: key.startsWith(BOAT_PREFIX) ? this.boatTiles.get(key.slice(BOAT_PREFIX.length)) ?? [] : undefined,
        layers: this.kitLayers() });
      return;
    }
    const t0 = performance.now();
    const options = { surveyedEnvelopeData: this.surveyedEnvelopeTransport.envelopes, surveyedEnvelopeRevision: this.surveyedEnvelopeTransport.revision, look: this.look, streets: this.streetsFor(source), profiles: this.appearanceProfiles, contextFeatures: this.contextGroups.get(key) ?? this.contextFor(source), appearanceRevision: this.appearanceRevision, hostOpenings: this.openingsFor(key, source), hostOpeningRevision: this.openingRevision(key, source) };
    const result = key === KIT_KEY ? {chunk:this.buildKits(source),boundParentIds:[]}
      : key.startsWith(BOAT_PREFIX) ? {chunk:this.buildBoats(key.slice(BOAT_PREFIX.length)),boundParentIds:[]}
      : buildTransportedEnvelopeChunk(source,{...options,mode:chunkMode(key)});
    this.install(key, source, result.chunk, performance.now() - t0, options, result.boundParentIds);
  }

  /** The chunk worker, started on first use; null where workers are unavailable (then chunks build inline). */
  private chunkWorker(): Worker | null {
    if (this.worker !== undefined) return this.worker;
    this.worker = null;
    if (typeof Worker === 'undefined' || !WORKER_URL) return null;
    try {
      const worker = new Worker(WORKER_URL);
      worker.onmessage = (event: MessageEvent<{ key: string; gen: number; chunk: Chunk; ms: number; appearanceRevision: string; hostOpeningRevision: string; surveyedEnvelopeRevision: string; boundParentIds: string[] }>) => {
        const { key, gen, chunk, ms } = event.data, source = this.inflight.get(key);
        this.workerBusy = false;
        if (this.gens.get(key) !== gen || !source) { this.pump(); return; }
        const options = this.inflightOptions.get(key);
        if (!options || event.data.appearanceRevision !== options.appearanceRevision || options.appearanceRevision !== this.appearanceRevision || event.data.surveyedEnvelopeRevision !== options.surveyedEnvelopeRevision || options.surveyedEnvelopeRevision !== this.surveyedEnvelopeTransport.revision || event.data.hostOpeningRevision !== options.hostOpeningRevision || options.hostOpeningRevision !== this.openingRevision(key, source)) { this.pump(); return; }
        this.inflight.delete(key);
        this.inflightOptions.delete(key);
        this.install(key, source, chunk, ms, options, event.data.boundParentIds);
        this.pump();
      };
      worker.onerror = (error) => {
        // Fall back to inline builds for good, and redo whatever was in flight.
        console.warn('three.js building worker failed; building chunks inline', error);
        this.worker = null; this.workerBusy = false; worker.terminate();
        for (const [key, source] of this.inflight) this.pending.push(key, () => this.rebuild(key, source));
        this.inflight.clear();
        this.inflightOptions.clear();
        this.pump();
      };
      this.worker = worker;
    } catch (error) {
      console.warn('three.js building worker unavailable; building chunks inline', error);
    }
    return this.worker;
  }

  /**
   * Stand every building on the own ground's relief: each building is lifted
   * by its footprint's lowest relief (the prototype's rule; nothing floats).
   * Chunks keep their CPU positions only while some building still waits for
   * its relief; call `refreshGroundBases()` when more relief is resident.
   */
  setGroundBase(fn: GroundBaseFn | null): void {
    this.groundBase = fn;
    this.refreshGroundBases();
  }

  /** Apply bases that became known since install (or since the last refresh). Returns buildings lifted. */
  refreshGroundBases(): number {
    if (!this.groundBase) return 0;
    let lifted = 0;
    for (const entry of this.chunks.values()) {
      const lift = entry.lift, attribute = entry.mesh?.geometry?.getAttribute('position');
      if (!lift || !lift.pending.size || !attribute?.array) continue;
      const n = this.applyGroundLift(attribute.array as Float32Array, entry.ranges, lift);
      if (!n) continue;
      lifted += n;
      attribute.needsUpdate = true;
      entry.mesh.geometry.computeBoundingSphere();
      // Settled: let the CPU copy go after the next upload.
      if (!lift.pending.size) attribute.onUpload(function (this: any) { this.array = null; });
    }
    if (lifted) { this.hiddenRevision++; this.map.triggerRepaint(); }
    return lifted;
  }

  private applyGroundLift(positions: Float32Array, ranges: Map<string, { start: number; count: number }>, lift: GroundLift): number {
    let n = 0;
    for (const id of [...lift.pending]) {
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
    return n;
  }

  private install(key: string, source: Feature[], chunk: Chunk, buildMs: number, options?: BuildOptions, boundParentIds: string[] = []): void {
    if (!this.THREE || this.look !== this.requestedLook || !this.currentSource(key, source)) return;
    if (options && (options.surveyedEnvelopeRevision !== this.surveyedEnvelopeTransport.revision || options.look !== this.look || options.appearanceRevision !== this.appearanceRevision || options.hostOpeningRevision !== this.openingRevision(key, source))) return;
    const context=this.contextGroups.get(key);
    if(options?.contextFeatures && context && (context.length!==options.contextFeatures.length || context.some((f,i)=>f!==options.contextFeatures![i]))) return;
    const t0 = performance.now() - buildMs;
    this.dropChunk(key);
    if (!chunk.vertexCount) { this.chunks.set(key, { source, mesh: null, info: infoOf(chunk), ranges: new Map() }); return; }
    const THREE = this.THREE;
    const geometry = new THREE.BufferGeometry();
    // The GPU holds the copy that draws; the CPU array is freed once uploaded
    // (the `hidden` flags stay: they are rewritten when the answer changes).
    // A lost context rebuilds from `source`, see onAdd.
    const release = (attribute: any) => { attribute.onUpload(function (this: any) { this.array = null; }); return attribute; };
    // Own ground: lift each building onto its relief before upload. Houseboats
    // follow the water level instead (mesh.position.z below).
    let lift: GroundLift | undefined;
    if (this.groundBase && !key.startsWith(BOAT_PREFIX)) {
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
    geometry.setIndex(release(new THREE.BufferAttribute(chunk.indices, 1)));
    // three.js uploads a new mesh, then computes its bounding sphere to sort it.
    // With `position` already freed that throws inside MapLibre's frame and the
    // whole map flashes once per new chunk, so measure while the array exists.
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, this.material);
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
    this.refreshSurveyedRoofOwnership();
    mesh.userData.coarse = key.startsWith(COARSE_PREFIX);
    this.refreshDetailOwnership();
    this.applyHidden(entry, new Set([...this.hidden, ...this.highlighted, ...this.installedDetailIds]));
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
      attribute.array.fill(this.hidden.has(id) || entry.mesh.userData.coarse && this.installedDetailIds.has(id) ? 1 : this.highlighted.has(id) ? 2 : 0, range.start, range.start + range.count);
      touched = true;
    }
    if (touched) { attribute.needsUpdate = true; this.hiddenRevision++; }
  }

  private dropChunk(key: string): void {
    const held = this.chunks.get(key);
    if (!held) return;
    if (held.mesh) { this.scene?.remove(held.mesh); held.mesh.geometry.dispose(); }
    this.chunks.delete(key);
    this.refreshSurveyedRoofOwnership();
    if (key.startsWith('near:')) this.refreshDetailOwnership();
  }

  private refreshSurveyedRoofOwnership(): void {
    const ids = new Set<string>();
    if (this.visible && this.ready && this.map.getZoom() > MIN_ZOOM) for (const entry of this.chunks.values()) if (entry.mesh)
      for (const id of entry.mesh.userData.boundParentIds ?? []) ids.add(id);
    const previous = this.map._surveyedEnvelopeRoofIds;
    if (previous && previous.length === ids.size && previous.every(id => ids.has(id))) return;
    this.map._surveyedEnvelopeRoofIds = [...ids];
    this.map._pyramidalRoofs?.setHiddenReason('surveyed-envelope', ids);
  }

  private refreshDetailOwnership(): void {
    const next = new Set<string>();
    for (const [key, entry] of this.chunks) if (key.startsWith('near:') && entry.mesh) for (const id of entry.ranges.keys()) next.add(id);
    const changed = new Set([...next, ...this.installedDetailIds].filter(id => next.has(id) !== this.installedDetailIds.has(id)));
    this.installedDetailIds = next;
    if (!changed.size) return;
    for (const [key, entry] of this.chunks) if (key.startsWith(COARSE_PREFIX)) this.applyHidden(entry, changed);
  }

  /** Set when the facades draw in the shared frame (`?sharedFrame=1`) instead of their own layer. */
  private sharedFrame: any = null;
  /** Lit material + sun shadows; only inside the shared frame (`?litFacades=0` keeps the unlit shader there). */
  private lit = false;
  private depthMaterial: any = null;
  /** Bumped whenever suppressed/answer walls change (they cast differently). */
  private hiddenRevision = 0;

  /** One set-up for both the legacy layer and the shared frame. */
  private setup(map: MapLike, renderer: any, camera: any, scene: any): void {
    const THREE = this.THREE;
    if (!this.appearanceLoaded) void this.loadStreetAppearance();
    this.camera = camera;
    this.scene = scene;
    this.renderer = renderer;
    // CPU copies are freed after upload, so a restored context needs fresh meshes.
    map.getCanvas().addEventListener('webglcontextrestored', () => {
      this.ready = false;
      this.textureSets.clear();
      for (const key of [...this.chunks.keys()]) this.dropChunk(key);
      for (const material of this.materials.values()) material.dispose();
      this.materials.clear();
      this.material.uniforms.cells.value = null;
      void this.setLook(this.requestedLook);
    });
    this.material = this.newMaterial();
    if (this.lit) this.depthMaterial = createFacadeDepthMaterial(THREE);
    this.materials.set(this.look, this.material);
    const initialLook = this.requestedLook, token = ++this.lookToken;
    void this.texturesFor(cellSetOf(initialLook)).then(set => {
      // A newer mode can finish before the initial atlas. Never overwrite it.
      if (token !== this.lookToken) return;
      this.look = initialLook;
      this.bindLookMaterial(initialLook, set);
      this.ready = true;
      this.invalidateBuilds();
      for (const [key, source] of this.sourceGroups) this.pending.push(key, () => this.rebuild(key, source));
      this.pump();
      this.map.triggerRepaint();
    });
    const c = this.maplibregl.MercatorCoordinate.fromLngLat([ORIGIN.lng, ORIGIN.lat], 0);
    const scale = c.meterInMercatorCoordinateUnits();
    this.transform = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).scale(new THREE.Vector3(...buildingProjectionScale(scale)));
  }

  private newMaterial(): any {
    const THREE = this.THREE;
    if (this.lit) {
      const material = createLitFacadeMaterial(THREE);
      material.uniforms.bands.value = this.look === 'cartoon' ? 3 : 0;
      material.uniforms.flatColour.value = this.look === 'untextured' ? 1 : 0;
      return material;
    }
    return new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: VERTEX, fragmentShader: FRAGMENT,
      uniforms: { cells: { value: null }, masks: { value: null }, bands: { value: this.look === 'cartoon' ? 3 : 0 }, flatColour: { value: this.look === 'untextured' ? 1 : 0 }, cityFade: { value: 1 } }, side: THREE.FrontSide,
    });
  }

  /** Per-frame state shared by both paths; false when nothing should draw. */
  private prepareFrame(): boolean {
    this.refreshSurveyedRoofOwnership();
    if (!this.visible || !this.ready || !this.scene || !this.chunks.size || this.map.getZoom() < MIN_ZOOM) return false;
    const fade = Math.max(0, Math.min(1, (this.map.getZoom() - MIN_ZOOM) / 1.6));
    for (const material of this.materials.values()) material.uniforms.cityFade.value = fade;
    return true;
  }

  /**
   * Draw in the page's shared three.js frame instead of an own custom layer:
   * one renderer, scene and light rig with the landmarks, trees and vehicles,
   * plus (unless `lit: false`) the lit facade material and sun shadows. Call
   * this instead of adding `layer` to the map.
   */
  attachToSharedFrame(frame: any, options: { lit?: boolean; order?: number } = {}): void {
    if (this.sharedFrame) return;
    const THREE = (window as any).CanalRecallThree?.THREE;
    if (!THREE) { console.warn('three-building-facades: shared three.js missing'); return; }
    this.THREE = THREE;
    this.sharedFrame = frame;
    this.lit = options.lit !== false;
    const root = new THREE.Group();
    root.name = 'three-building-facades';
    const camera = new THREE.Camera();
    frame.register('facades', {
      root,
      onAttach: (f: any) => this.setup(this.map, f.renderer, camera, root),
      mercatorFromLocal: () => this.transform?.elements,
      revision: () => this.hiddenRevision,
      beforeRender: (ctx: any) => {
        if (!this.prepareFrame()) return false;
        // Picking (inspectAtScreen) raycasts world-space meshes with this projection.
        camera.projectionMatrix.copy(ctx.clipFromWorld);
        return true;
      },
    }, { order: options.order ?? 0 });
  }

  /** Whether this layer draws through the shared frame. */
  get inSharedFrame(): boolean { return !!this.sharedFrame; }

  private makeLayer(): any {
    const owner = this;
    return {
      id: 'three-building-facades', type: 'custom', renderingMode: '3d',
      onAdd(map: MapLike, gl: WebGL2RenderingContext) {
        const THREE = (window as any).CanalRecallThree?.THREE;
        if (!THREE) { console.warn('three-building-facades: shared three.js missing'); return; }
        owner.THREE = THREE;
        const renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
        renderer.autoClear = false;
        owner.setup(map, renderer, new THREE.Camera(), new THREE.Scene());
      },
      render(_gl: WebGL2RenderingContext, args: any) {
        if (!owner.prepareFrame()) return;
        owner.camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(owner.transform);
        owner.renderer.resetState();
        owner.renderer.render(owner.scene, owner.camera);
      },
      onRemove() { owner.dispose(); },
    };
  }
}
