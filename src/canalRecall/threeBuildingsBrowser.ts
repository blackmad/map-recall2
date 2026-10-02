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
import { FRONT_LIST, FRONT_PART_IDS, decorateFront } from './landmarkFrontData.js';
import { frontKitGeometry, lookHex } from './landmarkFronts.js';
import { decorateShopfront, setShopfronts } from './shopfronts.js';
import { houseboatGeometry, houseboatsByTile, type Houseboat } from './houseboats.js';
import { buildKitChunk, type Chunk } from './threeBuildingMesh.js';
import { ORIGIN, ROOF_TONES, asPolygons, buildFeatureChunk, cellSetOf, type BuildingLook, type Feature } from './threeBuildingFeatures.js';
export { ORIGIN, ROOF_TONES, type BuildingLook };
import { FACADE_STYLES, type FacadeStyle } from './genericFacades.js';

type MapLike = { getCanvas(): HTMLCanvasElement; triggerRepaint(): void; getZoom(): number };
type MaplibreLike = { MercatorCoordinate: { fromLngLat(lngLat: [number, number], altitude: number): { x: number; y: number; z: number; meterInMercatorCoordinateUnits(): number } } };

const TILE_ZOOM = 14;
/**
 * Near detail (LOD tier 1): facade extras are built only for the 2 x 2 z16 tiles (~600 m)
 * around the camera, as `extras:<z16 tile>` chunks; everything further has walls and roofs only.
 */
const DETAIL_ZOOM = 16;
const EXTRAS_PREFIX = 'extras:';
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
flat out float vHighlight;
void main() {
  vUv = uv; vLayer = layer; vTint = tint.rgb; vAccent = accent.rgb; vShade = tint.a;
  // hidden: 0 drawn, 1 hidden, 2 the highlighted answer (drawn plain yellow).
  vHighlight = hidden > 1.5 ? 1.0 : 0.0;
  gl_Position = hidden > 0.5 && hidden < 1.5 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
flat in float vHighlight;
out vec4 fragColor;
void main() {
  if (vHighlight > 0.5) { fragColor = vec4(vec3(1.0, 0.824, 0.122) * vShade, 1.0); return; }
  vec3 p = vec3(vUv, vLayer);
  vec3 c = texture(cells, p).rgb;
  vec2 m = texture(masks, p).rg;
  c *= mix(vec3(1.0), vTint, m.r) * mix(vec3(1.0), vAccent, m.g);
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


const tileKeyOf = (polygons: number[][][][], zoom = TILE_ZOOM): string => {
  const [lng, lat] = polygons[0]?.[0]?.[0] ?? [0, 0];
  const n = 2 ** zoom, rad = lat * Math.PI / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return `${x}/${y}`;
};


export { decorateRoof, exceptLandmarks, decorateKitRoof, decorateFront, decorateShopfront, setShopfronts, KIT_HIDE_IDS };

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
  private highlighted = new Set<string>();
  private pending: Array<() => void> = [];
  private pumping = false;
  private lastBuildMs = 0;
  private transform: any = null;

  private look: BuildingLook;
  private textureSets = new Map<BuildingLook, Promise<{ colour: any; mask: any }>>();
  private lookToken = 0;
  private worker: Worker | null | undefined;
  private readonly gens = new Map<string, number>();
  private readonly inflight = new Map<string, Feature[]>();
  private boatTiles = new Map<string, Houseboat[]>();
  private boatIds: ReadonlySet<string> = new Set();
  private lastFeatures: readonly Feature[] = [];
  private detailTiles = new Set<string>();

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
    const set = await this.texturesFor(cellSetOf(look));
    if (token !== this.lookToken) return;
    this.material.uniforms.cells.value = set.colour;
    this.material.uniforms.masks.value = set.mask;
    this.material.uniforms.bands.value = look === 'cartoon' ? 3 : 0;
    this.textureMB = (set.colour.userData.bytes + set.mask.userData.bytes) * 4 / 3 / 1048576;
    for (const [key, entry] of [...this.chunks]) this.pending.push(() => this.rebuild(key, entry.source));
    this.pump();
  }

  /** Build (once) the colour and tint-mask texture arrays for a look. */
  private texturesFor(look: 'procedural' | Look): Promise<{ colour: any; mask: any }> {
    let set = this.textureSets.get(look);
    if (!set) this.textureSets.set(look, set = this.buildTextures(look));
    return set;
  }

  private async buildTextures(look: 'procedural' | Look): Promise<{ colour: any; mask: any }> {
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
      const id = String(p.id ?? '');
      if (KIT_PART_IDS.has(id) || FRONT_PART_IDS.has(id)) kitParts.push(feature);
      // Every building draws here (bare walls when it has no facade), except the parts a kit
      // replaces and the few houseboats the tiles carry (the houseboat generator draws those).
      if (KIT_HIDE_SET.has(id) || this.boatIds.has(id)) continue;
      const polygons = asPolygons(feature.geometry);
      if (!polygons.length) continue;
      const key = tileKeyOf(polygons);
      let list = groups.get(key);
      if (!list) groups.set(key, list = []);
      list.push(feature);
      if (this.detailTiles.size) {
        const near = tileKeyOf(polygons, DETAIL_ZOOM);
        if (this.detailTiles.has(near)) { const k = EXTRAS_PREFIX + near; let l = groups.get(k); if (!l) groups.set(k, l = []); l.push(feature); }
      }
    }
    if (kitParts.length) groups.set(KIT_KEY, kitParts);
    // Houseboats ride along with the resident building tiles, one chunk per tile.
    for (const key of [...groups.keys()]) if (this.boatTiles.has(key)) groups.set(BOAT_PREFIX + key, NO_SOURCE);
    this.lastFeatures = features;
    const same = (a: readonly Feature[] | undefined, b: readonly Feature[]) => !!a && a.length === b.length && a.every((f, i) => f === b[i]);
    for (const key of [...this.chunks.keys(), ...this.inflight.keys()]) if (!groups.has(key)) { this.dropChunk(key); this.inflight.delete(key); this.gens.set(key, (this.gens.get(key) ?? 0) + 1); }
    for (const [key, list] of groups) {
      const flying = this.inflight.get(key);
      if (flying ? same(flying, list) : same(this.chunks.get(key)?.source, list)) continue;
      this.pending.push(() => this.rebuild(key, list));
    }
    this.pump();
  }

  /**
   * Hide these buildings' facades for one `reason`: the answer building draws
   * as a plain yellow extrusion instead, and signature-landmark models replace
   * their OSM footprint. Only the ids whose state changed touch the GPU.
   */
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
    const look = this.look;
    // Kits and fronts are authored in natural colours; each look recolours them like its neighbours.
    const geometry: KitPartGeometry[] = KITS.flatMap(kit => kitGeometry(kit, parts)).map(g => ({ ...g, tris: g.tris.map(t => ({ ...t, hex: lookHex(t.hex, look) })) }));
    for (const front of FRONT_LIST) {
      if (!front.ids.some(id => parts.has(id))) continue;
      const g = frontKitGeometry(front, ORIGIN, look), held = geometry.find(x => x.id === g.id);
      // One range per id: a front shares its first carrier's range (a kit roof on the Beurs hall), so hiding the answer hides both.
      if (held) held.tris.push(...g.tris); else geometry.push(g);
    }
    return buildKitChunk(geometry, this.kitLayers());
  }

  /**
   * The camera's position for near detail: the 2 x 2 block of z16 tiles nearest it gets facade
   * extras. Cheap to call every frame; regroups only when that block changes.
   */
  setDetailCentre(lng: number, lat: number): void {
    const n = 2 ** DETAIL_ZOOM, rad = lat * Math.PI / 180;
    const fx = ((lng + 180) / 360) * n, fy = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
    const x = Math.floor(fx), y = Math.floor(fy), dx = fx - x < 0.5 ? -1 : 1, dy = fy - y < 0.5 ? -1 : 1;
    const next = [`${x}/${y}`, `${x + dx}/${y}`, `${x}/${y + dy}`, `${x + dx}/${y + dy}`];
    if (next.length === this.detailTiles.size && next.every(k => this.detailTiles.has(k))) return;
    this.detailTiles = new Set(next);
    this.setFeatures(this.lastFeatures);
  }

  /** OSM houseboat footprints (Amsterdam extract); drawn by the houseboat generator in the resident tiles. */
  setHouseboats(boats: readonly Houseboat[]): void {
    this.boatTiles = houseboatsByTile(boats);
    this.boatIds = new Set(boats.map(b => b.id));
    for (const key of [...this.chunks.keys()]) if (key.startsWith(BOAT_PREFIX)) this.dropChunk(key);
    this.setFeatures(this.lastFeatures);
  }

  private buildBoats(tile: string): Chunk {
    const look = this.look;
    const geometry = (this.boatTiles.get(tile) ?? []).map(b => houseboatGeometry(b, ORIGIN)).filter((g): g is KitPartGeometry => !!g)
      .map(g => ({ ...g, tris: g.tris.map(t => ({ ...t, hex: lookHex(t.hex, look) })) }));
    return buildKitChunk(geometry, this.kitLayers());
  }

  private kitLayers() {
    const cells = cellSetOf(this.look), roofBase = cells === 'procedural' ? CELL_LAYER_COUNT : BAY_LAYER_COUNT;
    const plain = this.look === 'untextured' ? roofBase + 3 : cells === 'procedural' ? cellLayer('canal', 'plain', 0) : bayLayer('canal', 0, 'plain');
    return { plain, flat: roofBase + 3, slope: roofBase + 1 };
  }

  private rebuild(key: string, source: Feature[]): void {
    if (!this.THREE) return;
    if (key.startsWith(BOAT_PREFIX)) {
      const t0 = performance.now(), chunk = this.buildBoats(key.slice(BOAT_PREFIX.length));
      this.install(key, source, chunk, performance.now() - t0);
      return;
    }
    const worker = key === KIT_KEY ? null : this.chunkWorker();
    const gen = (this.gens.get(key) ?? 0) + 1;
    this.gens.set(key, gen);
    if (worker) {
      // Off the main thread; a reply for an older generation (the tile changed again, or the look) is dropped.
      this.inflight.set(key, source);
      worker.postMessage({ key, gen, look: this.look, features: source, mode: key.startsWith(EXTRAS_PREFIX) ? 'extras' : 'walls' });
      return;
    }
    const t0 = performance.now();
    const chunk = key === KIT_KEY ? this.buildKits(source) : buildFeatureChunk(source, this.look, key.startsWith(EXTRAS_PREFIX) ? 'extras' : 'walls');
    this.install(key, source, chunk, performance.now() - t0);
  }

  /** The chunk worker, started on first use; null where workers are unavailable (then chunks build inline). */
  private chunkWorker(): Worker | null {
    if (this.worker !== undefined) return this.worker;
    this.worker = null;
    if (typeof Worker === 'undefined' || !WORKER_URL) return null;
    try {
      const worker = new Worker(WORKER_URL);
      worker.onmessage = (event: MessageEvent<{ key: string; gen: number; chunk: Chunk; ms: number }>) => {
        const { key, gen, chunk, ms } = event.data, source = this.inflight.get(key);
        if (this.gens.get(key) !== gen || !source) return;
        this.inflight.delete(key);
        this.install(key, source, chunk, ms);
      };
      worker.onerror = (error) => {
        // Fall back to inline builds for good, and redo whatever was in flight.
        console.warn('three.js building worker failed; building chunks inline', error);
        this.worker = null; worker.terminate();
        for (const [key, source] of this.inflight) this.pending.push(() => this.rebuild(key, source));
        this.inflight.clear();
        this.pump();
      };
      this.worker = worker;
    } catch (error) {
      console.warn('three.js building worker unavailable; building chunks inline', error);
    }
    return this.worker;
  }

  private install(key: string, source: Feature[], chunk: Chunk, buildMs: number): void {
    if (!this.THREE) return;
    const t0 = performance.now() - buildMs;
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
    if (this.hidden.size || this.highlighted.size) this.applyHidden(entry, new Set([...this.hidden, ...this.highlighted]));
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
      attribute.array.fill(this.hidden.has(id) ? 1 : this.highlighted.has(id) ? 2 : 0, range.start, range.start + range.count);
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
          void owner.texturesFor(cellSetOf(owner.look)).then(set => {
            owner.material.uniforms.cells.value = set.colour; owner.material.uniforms.masks.value = set.mask;
            for (const [key, entry] of [...owner.chunks]) owner.pending.push(() => owner.rebuild(key, entry.source));
            owner.pump();
          });
        });
        owner.material = new THREE.RawShaderMaterial({
          glslVersion: THREE.GLSL3, vertexShader: VERTEX, fragmentShader: FRAGMENT,
          uniforms: { cells: { value: null }, masks: { value: null }, bands: { value: owner.look === 'cartoon' ? 3 : 0 } }, side: THREE.FrontSide,
        });
        void owner.texturesFor(cellSetOf(owner.look)).then(set => {
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
