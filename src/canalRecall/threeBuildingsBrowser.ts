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

import { CELL_LAYER_COUNT, CELL_PX, STYLE_DIMS, cellLayer, paintProceduralLayers } from './facadeCells.js';
import { ROOF_CELL_M, paintRoofLayers } from './roofCells.js';
import { decorateRoof, exceptLandmarks, fitRect, localOuterRing, planRoof, type RoofPlan } from './roofMesh.js';
import { BAY_ENTRIES, BAY_LAYER_COUNT, bayLayer, bayLookFor, bayVariant } from './bayLook.js';
import { bayTextures, type Look } from './bayTextures.js';
import { KITS, KIT_HIDE_IDS, KIT_PART_IDS, decorateKitRoof, kitGeometry, type KitPartGeometry, type PartInput } from './landmarkKits.js';
import { buildChunk, buildKitChunk, lookVariant, wallTopHeightM, type Chunk, type MeshBuilding } from './threeBuildingMesh.js';
import { FACADE_STYLES, type FacadeStyle } from './genericFacades.js';

type Feature = { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown };
type MapLike = { getCanvas(): HTMLCanvasElement; triggerRepaint(): void; getZoom(): number };
type MaplibreLike = { MercatorCoordinate: { fromLngLat(lngLat: [number, number], altitude: number): { x: number; y: number; z: number; meterInMercatorCoordinateUnits(): number } } };

/** One fixed origin for the whole city: float32 metres stay sub-millimetre within 10 km. */
export const ORIGIN = { lng: 4.9, lat: 52.37 };
const TILE_ZOOM = 14;
/** Facades show from this map zoom (the extrusion layer's own minzoom was 14). */
export const MIN_ZOOM = 14;

const VERTEX = /* glsl */ `
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
void main() {
  vUv = uv; vLayer = layer; vTint = tint.rgb; vAccent = accent.rgb; vShade = tint.a;
  gl_Position = hidden > 0.5 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray cells;
uniform sampler2DArray masks;
uniform float bands;
in vec2 vUv;
flat in float vLayer;
in vec3 vTint;
in vec3 vAccent;
in float vShade;
out vec4 fragColor;
void main() {
  vec3 p = vec3(vUv, vLayer);
  vec3 c = texture(cells, p).rgb;
  vec2 m = texture(masks, p).rg;
  c *= mix(vec3(1.0), vTint, m.r) * mix(vec3(1.0), vAccent, m.g);
  float shade = bands > 0.5 ? floor(vShade * bands + 0.5) / bands : vShade;
  fragColor = vec4(c * shade, 1.0);
}`;

const ROOF_LAYER_COUNT = 4;
const hashShop = (id: string) => { let h = 2166136261; for (const c of `${id}:shop`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296 < 0.3; };

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
export function calmBayLayers(colour: Uint8Array, mask: Uint8Array, layers: number, look: Look): void {
  const px = CELL_PX * CELL_PX;
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
        for (let c = 0; c < 3; c++) colour[at + c] = Math.min(255, (colour[at + c] + (mean[c] - colour[at + c]) * wallPull * wall) * (1 + (lift - 1) * wall));
      } else if (accent < 128) {
        const lum = (colour[at] + colour[at + 1] + colour[at + 2]) / 3;
        if (lum < 90) { const k = glassLift * (1 - lum / 90); for (let c = 0; c < 3; c++) colour[at + c] += (150 - colour[at + c]) * k; }
      }
    }
  }
}

const asPolygons = (geometry: unknown): number[][][][] => {
  const g = geometry as { type?: string; coordinates?: unknown } | null;
  if (!g || !g.coordinates) return [];
  return g.type === 'Polygon' ? [g.coordinates as number[][][]] : g.type === 'MultiPolygon' ? g.coordinates as number[][][][] : [];
};

const tileKeyOf = (polygons: number[][][][]): string => {
  const [lng, lat] = polygons[0]?.[0]?.[0] ?? [0, 0];
  const n = 2 ** TILE_ZOOM, rad = lat * Math.PI / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return `${x}/${y}`;
};

export type BuildingLook = 'procedural' | Look;

export { decorateRoof, exceptLandmarks, decorateKitRoof, KIT_HIDE_IDS };

const KIT_KEY = '__kit';

/** Roof colours per look: pantile and slate (a look's own tones, picked by the plan's `tone`). */
const ROOF_TONES: Record<BuildingLook, { tile: string[]; slate: string[] }> = {
  procedural: { tile: ['#b5543a', '#a8482f', '#c0603f', '#9c4a35'], slate: ['#4b525c', '#3f464f', '#5a6068'] },
  photo: { tile: ['#b5543a', '#a8482f', '#c0603f', '#9c4a35'], slate: ['#4b525c', '#3f464f', '#5a6068'] },
  storybook: { tile: ['#b9553a', '#a94a33', '#c46a45'], slate: ['#556070', '#4a5666', '#657282'] },
  cartoon: { tile: ['#e85a3c', '#f08a2b', '#d94a3a'], slate: ['#3f5f8f', '#2f4a78', '#4f7bb0'] },
};
const roofHexFor = (look: BuildingLook, plan: RoofPlan) => { const set = ROOF_TONES[look][plan.material]; return set[Math.min(set.length - 1, Math.floor(plan.tone * set.length))]; };

/** What stays after upload: counts only, never the typed arrays. */
type ChunkInfo = { buildingCount: number; wallCount: number; quadCount: number; vertexCount: number; bytes: number };

export type ThreeBuildingStats = { chunks: number; buildings: number; walls: number; quads: number; vertices: number; geometryMB: number; textureMB: number; drawCalls: number; triangles: number; buildMs: number };

export class ThreeBuildings {
  readonly layer: any;
  private visible = true;
  private THREE: any;
  private scene: any;
  private material: any;
  private renderer: any;
  private camera: any;
  private readonly chunks = new Map<string, { source: Feature[]; mesh: any; info: ChunkInfo; ranges: Map<string, { start: number; count: number }> }>();
  /** Ids hidden per reason (the answer building, signature models); a facade is hidden while any reason holds it. */
  private readonly hiddenBy = new Map<string, Set<string>>();
  private hidden = new Set<string>();
  private pending: Array<() => void> = [];
  private pumping = false;
  private lastBuildMs = 0;
  private transform: any = null;

  private look: BuildingLook;
  private textureSets = new Map<BuildingLook, Promise<{ colour: any; mask: any }>>();
  private lookToken = 0;

  constructor(private readonly map: MapLike, private readonly maplibregl: MaplibreLike, look: BuildingLook = 'procedural') {
    this.look = look;
    this.layer = this.makeLayer();
  }

  getLook(): BuildingLook { return this.look; }

  /** Switch the wall look at runtime: loads its textures, then rebuilds every chunk. */
  async setLook(look: BuildingLook): Promise<void> {
    if (look === this.look && this.material?.uniforms.cells.value) return;
    const token = ++this.lookToken;
    this.look = look;
    if (!this.THREE) return; // onAdd will pick the look up
    const set = await this.texturesFor(look);
    if (token !== this.lookToken) return;
    this.material.uniforms.cells.value = set.colour;
    this.material.uniforms.masks.value = set.mask;
    this.material.uniforms.bands.value = look === 'cartoon' ? 3 : 0;
    this.textureMB = (set.colour.userData.bytes + set.mask.userData.bytes) * 4 / 3 / 1048576;
    for (const [key, entry] of [...this.chunks]) this.pending.push(() => this.rebuild(key, entry.source));
    this.pump();
  }

  /** Build (once) the colour and tint-mask texture arrays for a look. */
  private texturesFor(look: BuildingLook): Promise<{ colour: any; mask: any }> {
    let set = this.textureSets.get(look);
    if (!set) this.textureSets.set(look, set = this.buildTextures(look));
    return set;
  }

  private async buildTextures(look: BuildingLook): Promise<{ colour: any; mask: any }> {
    const THREE = this.THREE;
    let layers: number, colour: Uint8Array, mask: Uint8Array;
    if (look === 'procedural') ({ layers, colour, mask } = paintProceduralLayers(paintRoofLayers(false)));
    else {
      let brick: CanvasImageSource = document.createElement('canvas');
      if (look === 'photo') {
        const image = new Image();
        image.src = new URL('materials/ambientcg/Bricks057/colour.jpg', document.baseURI).href;
        try { await image.decode(); brick = image; } catch { /* flat brick: the drawn detail still reads */ }
      }
      layers = BAY_LAYER_COUNT + ROOF_LAYER_COUNT;
      colour = new Uint8Array(CELL_PX * CELL_PX * 4 * layers); mask = new Uint8Array(CELL_PX * CELL_PX * 2 * layers);
      const scratch = document.createElement('canvas'); scratch.width = scratch.height = CELL_PX;
      const ctx = scratch.getContext('2d', { willReadFrequently: true })!;
      for (const entry of BAY_ENTRIES) {
        const { colour: c, mask: m } = bayTextures(bayVariant(entry), brick, look);
        for (const [source, isMask] of [[c, false], [m, true]] as const) {
          ctx.clearRect(0, 0, CELL_PX, CELL_PX);
          ctx.drawImage(source, 0, 0, CELL_PX, CELL_PX);
          const data = ctx.getImageData(0, 0, CELL_PX, CELL_PX).data;
          // Canvas rows run down from the top; layer rows run up from the ground.
          for (let y = 0; y < CELL_PX; y++) for (let x = 0; x < CELL_PX; x++) {
            const from = ((CELL_PX - 1 - y) * CELL_PX + x) * 4, px = y * CELL_PX + x;
            if (isMask) { mask[(entry.layer * CELL_PX * CELL_PX + px) * 2] = data[from]; mask[(entry.layer * CELL_PX * CELL_PX + px) * 2 + 1] = data[from + 1]; }
            else { const to = (entry.layer * CELL_PX * CELL_PX + px) * 4; colour[to] = data[from]; colour[to + 1] = data[from + 1]; colour[to + 2] = data[from + 2]; colour[to + 3] = 255; }
          }
        }
      }
    }
    if (look !== 'procedural') {
      // Roof cells sit after the bays; the bays are softened, the roofs are drawn as intended.
      paintRoofLayers(look === 'cartoon').forEach((cell, i) => {
        const layer = BAY_LAYER_COUNT + i;
        for (let px = 0; px < CELL_PX * CELL_PX; px++) {
          const at = (layer * CELL_PX * CELL_PX + px) * 4;
          colour[at] = cell[px * 4]; colour[at + 1] = cell[px * 4 + 1]; colour[at + 2] = cell[px * 4 + 2]; colour[at + 3] = 255;
          mask[(layer * CELL_PX * CELL_PX + px) * 2] = cell[px * 4 + 3];
        }
      });
      calmBayLayers(colour, mask, BAY_LAYER_COUNT, look);
    }
    const array = (data: Uint8Array, format: any) => {
      const t = new THREE.DataArrayTexture(data, CELL_PX, CELL_PX, layers);
      t.format = format; t.type = THREE.UnsignedByteType;
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
      t.userData = { bytes: data.byteLength };
      // Once on the GPU the CPU copy is dead weight; a restored context rebuilds the set.
      t.onUpdate = () => { t.image.data = null; };
      t.generateMipmaps = true; t.anisotropy = this.renderer.capabilities.getMaxAnisotropy(); t.unpackAlignment = 1; t.needsUpdate = true;
      return t;
    };
    return { colour: array(colour, THREE.RGBAFormat), mask: array(mask, THREE.RGFormat) };
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    this.map.triggerRepaint();
  }

  /** The resident building set from the tile streamer; rebuilds only chunks whose features changed. */
  setFeatures(features: readonly Feature[]): void {
    const groups = new Map<string, Feature[]>();
    const kitParts: Feature[] = [];
    for (const feature of features) {
      const p = feature.properties;
      if (KIT_PART_IDS.has(String(p.id ?? ''))) kitParts.push(feature);
      if (typeof p.facade !== 'string' || !p.facadeStyle) continue;
      const polygons = asPolygons(feature.geometry);
      if (!polygons.length) continue;
      const key = tileKeyOf(polygons);
      let list = groups.get(key);
      if (!list) groups.set(key, list = []);
      list.push(feature);
    }
    if (kitParts.length) groups.set(KIT_KEY, kitParts);
    for (const key of [...this.chunks.keys()]) if (!groups.has(key)) this.dropChunk(key);
    for (const [key, list] of groups) {
      const held = this.chunks.get(key);
      if (held && held.source.length === list.length && held.source.every((f, i) => f === list[i])) continue;
      this.pending.push(() => this.rebuild(key, list));
    }
    this.pump();
  }

  /**
   * Hide these buildings' facades for one `reason`: the answer building draws
   * as a plain yellow extrusion instead, and signature-landmark models replace
   * their OSM footprint. Only the ids whose state changed touch the GPU.
   */
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
      chunks: this.chunks.size, buildings, walls, quads, vertices,
      geometryMB: bytes / 1048576, textureMB: this.textureMB,
      drawCalls: info?.calls ?? 0, triangles: info?.triangles ?? 0, buildMs: this.lastBuildMs,
    };
  }

  dispose(): void {
    for (const key of [...this.chunks.keys()]) this.dropChunk(key);
    this.material?.dispose();
    for (const set of this.textureSets.values()) void set.then(t => { t.colour.dispose(); t.mask.dispose(); });
  }

  private textureMB = 0;

  private ready = false;

  private pump(): void {
    if (this.pumping || !this.pending.length || !this.THREE || !this.ready) return;
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
  private buildKits(source: Feature[]): Chunk {
    const kx = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), ky = 110_540;
    const parts = new Map<string, PartInput>();
    for (const f of source) {
      const polygons = asPolygons(f.geometry), outer = polygons[0]?.[0];
      if (!outer) continue;
      const id = String(f.properties.id);
      parts.set(id, { id, ring: outer.map(([lng, lat]) => [(lng - ORIGIN.lng) * kx, (lat - ORIGIN.lat) * ky] as [number, number]), minHeightM: Number(f.properties.minHeight) || 0, heightM: Number(f.properties.height) });
    }
    const geometry: KitPartGeometry[] = KITS.flatMap(kit => kitGeometry(kit, parts));
    const roofBase = this.look === 'procedural' ? CELL_LAYER_COUNT : BAY_LAYER_COUNT;
    const plain = this.look === 'procedural' ? cellLayer('canal', 'plain', 0) : bayLayer('canal', 0, 'plain');
    return buildKitChunk(geometry, { plain, flat: roofBase + 3, slope: roofBase + 1 });
  }

  private toMeshBuilding(feature: Feature): MeshBuilding | null {
    const p = feature.properties;
    const polygons = asPolygons(feature.geometry);
    const minHeightM = Number(p.minHeight) || 0;
    const heightM = wallTopHeightM(p);
    if (!polygons.length || !Number.isFinite(heightM)) return null;
    const id = String(p.id ?? '');
    let building: MeshBuilding;
    let plain: number, roofBase: number, layout: FacadeStyle;
    if (this.look !== 'procedural') {
      const year = p.constructionYear === null || p.constructionYear === undefined || !Number.isFinite(Number(p.constructionYear)) ? null : Number(p.constructionYear);
      const bay = bayLookFor(id, year, Number(p.height) || heightM, this.look);
      building = { id, polygons, heightM, minHeightM, style: bay.layout, wallHex: bay.wallHex, accentHex: bay.accentHex, layers: bay.layers };
      plain = bay.plain; roofBase = BAY_LAYER_COUNT; layout = bay.layout; building.plainLayer = bay.plain;
    } else {
      layout = (FACADE_STYLES as readonly string[]).includes(String(p.facadeStyle)) ? p.facadeStyle as FacadeStyle : 'c19';
      building = { id, polygons, heightM, minHeightM, style: layout, wallHex: typeof p.sideColour === 'string' ? p.sideColour : '#a4523b', shop: layout !== 'tower' && hashShop(id) };
      plain = cellLayer(layout, 'plain', lookVariant(id)); roofBase = CELL_LAYER_COUNT; building.plainLayer = plain;
    }
    if (p.roofPlanned) {
      const ring = localOuterRing(feature.geometry);
      const plan = ring ? planRoof(id, String(p.facadeStyle ?? ''), Number(p.height), minHeightM, fitRect(ring)) : null;
      if (plan) {
        const dims = STYLE_DIMS[layout];
        building.roof = { plan, roofHex: roofHexFor(this.look, plan), dims: { bayM: dims.bay, storeyM: dims.storey, cellM: ROOF_CELL_M },
          layers: { slope: roofBase + (plan.material === 'tile' ? 0 : 1), plain, dormer: roofBase + 2 } };
      }
    }
    return building;
  }

  private rebuild(key: string, source: Feature[]): void {
    if (!this.THREE) return;
    const t0 = performance.now();
    const chunk = key === KIT_KEY ? this.buildKits(source) : buildChunk(source.map(f => this.toMeshBuilding(f)).filter((b): b is MeshBuilding => !!b), ORIGIN);
    this.dropChunk(key);
    if (!chunk.vertexCount) { this.chunks.set(key, { source, mesh: null, info: infoOf(chunk), ranges: new Map() }); return; }
    const THREE = this.THREE;
    const geometry = new THREE.BufferGeometry();
    // The GPU holds the copy that draws; the CPU array is freed once uploaded
    // (the `hidden` flags stay: they are rewritten when the answer changes).
    // A lost context rebuilds from `source`, see onAdd.
    const release = (attribute: any) => { attribute.onUpload(function (this: any) { this.array = null; }); return attribute; };
    geometry.setAttribute('position', release(new THREE.BufferAttribute(chunk.positions, 3)));
    geometry.setAttribute('uv', release(new THREE.BufferAttribute(chunk.uvs, 2)));
    geometry.setAttribute('layer', release(new THREE.BufferAttribute(chunk.layers, 1, false)));
    geometry.setAttribute('tint', release(new THREE.BufferAttribute(chunk.tints, 4, true)));
    geometry.setAttribute('accent', release(new THREE.BufferAttribute(chunk.accents, 4, true)));
    geometry.setAttribute('hidden', new THREE.BufferAttribute(new Uint8Array(chunk.vertexCount), 1, false));
    geometry.setIndex(release(new THREE.BufferAttribute(chunk.indices, 1)));
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.frustumCulled = false;
    const entry = { source, mesh, info: infoOf(chunk), ranges: new Map(chunk.ranges.map(r => [r.id, { start: r.start, count: r.count }])) };
    this.chunks.set(key, entry);
    this.scene.add(mesh);
    if (this.hidden.size) this.applyHidden(entry, this.hidden);
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
      attribute.array.fill(this.hidden.has(id) ? 1 : 0, range.start, range.start + range.count);
      touched = true;
    }
    if (touched) attribute.needsUpdate = true;
  }

  private dropChunk(key: string): void {
    const held = this.chunks.get(key);
    if (!held) return;
    if (held.mesh) { this.scene?.remove(held.mesh); held.mesh.geometry.dispose(); }
    this.chunks.delete(key);
  }

  private makeLayer(): any {
    const owner = this;
    return {
      id: 'three-building-facades', type: 'custom', renderingMode: '3d',
      onAdd(map: MapLike, gl: WebGL2RenderingContext) {
        const THREE = (window as any).CanalRecallThree?.THREE;
        if (!THREE) { console.warn('three-building-facades: shared three.js missing'); return; }
        owner.THREE = THREE;
        owner.camera = new THREE.Camera();
        owner.scene = new THREE.Scene();
        owner.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
        owner.renderer.autoClear = false;
        // CPU copies are freed after upload, so a restored context needs fresh meshes.
        map.getCanvas().addEventListener('webglcontextrestored', () => {
          owner.textureSets.clear();
          void owner.texturesFor(owner.look).then(set => {
            owner.material.uniforms.cells.value = set.colour; owner.material.uniforms.masks.value = set.mask;
            for (const [key, entry] of [...owner.chunks]) owner.pending.push(() => owner.rebuild(key, entry.source));
            owner.pump();
          });
        });
        owner.material = new THREE.RawShaderMaterial({
          glslVersion: THREE.GLSL3, vertexShader: VERTEX, fragmentShader: FRAGMENT,
          uniforms: { cells: { value: null }, masks: { value: null }, bands: { value: owner.look === 'cartoon' ? 3 : 0 } }, side: THREE.FrontSide,
        });
        void owner.texturesFor(owner.look).then(set => {
          owner.material.uniforms.cells.value = set.colour;
          owner.material.uniforms.masks.value = set.mask;
          owner.textureMB = (set.colour.userData.bytes + set.mask.userData.bytes) * 4 / 3 / 1048576;
          owner.ready = true;
          owner.pump();
          owner.map.triggerRepaint();
        });
        const c = owner.maplibregl.MercatorCoordinate.fromLngLat([ORIGIN.lng, ORIGIN.lat], 0);
        const scale = c.meterInMercatorCoordinateUnits();
        owner.transform = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).scale(new THREE.Vector3(scale, -scale, scale));
      },
      render(_gl: WebGL2RenderingContext, args: any) {
        if (!owner.visible || !owner.ready || !owner.scene || !owner.chunks.size || owner.map.getZoom() < MIN_ZOOM) return;
        owner.camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(owner.transform);
        owner.renderer.resetState();
        owner.renderer.render(owner.scene, owner.camera);
      },
      onRemove() { owner.dispose(); },
    };
  }
}
