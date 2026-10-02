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

import { CELL_LAYER_COUNT, CELL_PX, paintAllCells } from './facadeCells.js';
import { buildChunk, wallTopHeightM, type Chunk, type MeshBuilding } from './threeBuildingMesh.js';
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
in float hidden;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
out vec2 vUv;
flat out float vLayer;
out vec3 vTint;
void main() {
  vUv = uv; vLayer = layer; vTint = tint.rgb;
  gl_Position = hidden > 0.5 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray cells;
in vec2 vUv;
flat in float vLayer;
in vec3 vTint;
out vec4 fragColor;
void main() {
  vec4 t = texture(cells, vec3(vUv, vLayer));
  fragColor = vec4(t.rgb * mix(vec3(1.0), vTint, t.a), 1.0);
}`;

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

export type ThreeBuildingStats = { chunks: number; buildings: number; walls: number; quads: number; vertices: number; geometryMB: number; textureMB: number; drawCalls: number; triangles: number; buildMs: number };

export class ThreeBuildings {
  readonly layer: any;
  private visible = true;
  private THREE: any;
  private scene: any;
  private material: any;
  private renderer: any;
  private camera: any;
  private readonly chunks = new Map<string, { source: Feature[]; mesh: any; chunk: Chunk; ranges: Map<string, { start: number; count: number }> }>();
  /** Ids hidden per reason (the answer building, signature models); a facade is hidden while any reason holds it. */
  private readonly hiddenBy = new Map<string, Set<string>>();
  private hidden = new Set<string>();
  private pending: Array<() => void> = [];
  private pumping = false;
  private lastBuildMs = 0;
  private transform: any = null;

  constructor(private readonly map: MapLike, private readonly maplibregl: MaplibreLike) {
    this.layer = this.makeLayer();
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    this.map.triggerRepaint();
  }

  /** The resident building set from the tile streamer; rebuilds only chunks whose features changed. */
  setFeatures(features: readonly Feature[]): void {
    const groups = new Map<string, Feature[]>();
    for (const feature of features) {
      const p = feature.properties;
      if (typeof p.facade !== 'string' || !p.facadeStyle) continue;
      const polygons = asPolygons(feature.geometry);
      if (!polygons.length) continue;
      const key = tileKeyOf(polygons);
      let list = groups.get(key);
      if (!list) groups.set(key, list = []);
      list.push(feature);
    }
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
    for (const { chunk } of this.chunks.values()) {
      buildings += chunk.buildingCount; walls += chunk.wallCount; quads += chunk.quadCount; vertices += chunk.vertexCount;
      bytes += chunk.positions.byteLength + chunk.uvs.byteLength + chunk.layers.byteLength + chunk.tints.byteLength + chunk.indices.byteLength + chunk.vertexCount;
    }
    const info = this.renderer?.info?.render;
    return {
      chunks: this.chunks.size, buildings, walls, quads, vertices,
      geometryMB: bytes / 1048576, textureMB: (CELL_PX * CELL_PX * 4 * CELL_LAYER_COUNT * 4) / 3 / 1048576,
      drawCalls: info?.calls ?? 0, triangles: info?.triangles ?? 0, buildMs: this.lastBuildMs,
    };
  }

  dispose(): void {
    for (const key of [...this.chunks.keys()]) this.dropChunk(key);
    this.material?.dispose();
    this.cellTexture?.dispose();
  }

  private cellTexture: any;

  private pump(): void {
    if (this.pumping || !this.pending.length || !this.THREE) return;
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

  private toMeshBuilding(feature: Feature): MeshBuilding | null {
    const p = feature.properties;
    const polygons = asPolygons(feature.geometry);
    const minHeightM = Number(p.minHeight) || 0;
    const heightM = wallTopHeightM(p);
    if (!polygons.length || !Number.isFinite(heightM)) return null;
    return {
      id: String(p.id ?? ''), polygons, heightM, minHeightM,
      style: (FACADE_STYLES as readonly string[]).includes(String(p.facadeStyle)) ? p.facadeStyle as FacadeStyle : 'c19',
      wallHex: typeof p.sideColour === 'string' ? p.sideColour : '#a4523b',
    };
  }

  private rebuild(key: string, source: Feature[]): void {
    if (!this.THREE) return;
    const t0 = performance.now();
    const buildings = source.map(f => this.toMeshBuilding(f)).filter((b): b is MeshBuilding => !!b);
    const chunk = buildChunk(buildings, ORIGIN);
    this.dropChunk(key);
    if (!chunk.vertexCount) { this.chunks.set(key, { source, mesh: null, chunk, ranges: new Map() }); return; }
    const THREE = this.THREE;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(chunk.positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(chunk.uvs, 2));
    geometry.setAttribute('layer', new THREE.BufferAttribute(chunk.layers, 1, false));
    geometry.setAttribute('tint', new THREE.BufferAttribute(chunk.tints, 4, true));
    geometry.setAttribute('hidden', new THREE.BufferAttribute(new Uint8Array(chunk.vertexCount), 1, false));
    geometry.setIndex(new THREE.BufferAttribute(chunk.indices, 1));
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.frustumCulled = false;
    const entry = { source, mesh, chunk, ranges: new Map(chunk.ranges.map(r => [r.id, { start: r.start, count: r.count }])) };
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
        const cells = paintAllCells();
        const texture = new THREE.DataArrayTexture(new Uint8Array(cells.buffer, cells.byteOffset, cells.byteLength), CELL_PX, CELL_PX, CELL_LAYER_COUNT);
        texture.format = THREE.RGBAFormat;
        texture.type = THREE.UnsignedByteType;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
        texture.anisotropy = owner.renderer.capabilities.getMaxAnisotropy();
        texture.needsUpdate = true;
        owner.cellTexture = texture;
        owner.material = new THREE.RawShaderMaterial({
          glslVersion: THREE.GLSL3, vertexShader: VERTEX, fragmentShader: FRAGMENT,
          uniforms: { cells: { value: texture } }, side: THREE.FrontSide,
        });
        const c = owner.maplibregl.MercatorCoordinate.fromLngLat([ORIGIN.lng, ORIGIN.lat], 0);
        const scale = c.meterInMercatorCoordinateUnits();
        owner.transform = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).scale(new THREE.Vector3(scale, -scale, scale));
        owner.pump();
      },
      render(_gl: WebGL2RenderingContext, args: any) {
        if (!owner.visible || !owner.scene || !owner.chunks.size || owner.map.getZoom() < MIN_ZOOM) return;
        owner.camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(owner.transform);
        owner.renderer.resetState();
        owner.renderer.render(owner.scene, owner.camera);
      },
      onRemove() { owner.dispose(); },
    };
  }
}
