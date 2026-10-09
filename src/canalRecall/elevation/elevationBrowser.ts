// Browser adapter: the canal elevation layer (opt-in, `?elevation=1`).
//
// Pass order inside one MapLibre custom layer, inserted after the basemap's
// bridge roads and before the flat building fill / game overlays:
//   1. opening  — the water polygons at street level into the stencil (no colour);
//   2. sunken   — water plane, quay walls and every bridge part below z = 0,
//                 stencil-limited to the opening, depth-tested among themselves;
//   3. restore  — the opening again, writing far depth (and zero stencil) so
//                 2D layers drawn later are not hidden by the sunken depth;
//   4. upper    — bridge parts above z = 0 with normal depth, like buildings.
// A sunken point is visible exactly when its sight line passes through the
// water at street level, which is what the stencil encodes, at any pitch.
// MapLibre uses the stencil for tile clipping; the layer clears it and tells
// the painter its masks are gone (private field, guarded).
//
// Visual only: the rider's 2D position, routing and physics never read this.

import * as THREE from 'three';
import {
  SceneFrame, cellKey, cellsNear, lngLatToLocal, validateIndex,
  type BridgeExtract, type ElevationIndex, type LngLat, type WaterCell,
} from './elevationData.js';
import { quayWalls, waterSurface } from './canalGeometry.js';
import {
  DeckIndex, decodeFallback, isFlatMeasured, decodeProfile, fallbackDeckTop, fallbackDeckUnderside, measuredDeckMesh, surfacePose,
  type DeckProfile, type FallbackDeck,
} from './bridgeDeck.js';
import type { MeshData } from './meshBuilder.js';

export * from './elevationData.js';
export { surfacePose } from './bridgeDeck.js';

type MaplibreLike = { MercatorCoordinate: { fromLngLat(lngLat: [number, number], altitude: number): { x: number; y: number; z: number; meterInMercatorCoordinateUnits(): number } } };
type MapLike = {
  addLayer(layer: unknown, before?: string): void;
  getLayer(id: string): unknown;
  getStyle(): { layers?: { id: string; type: string }[] } | undefined;
  getPaintProperty(layer: string, name: string): unknown;
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
  getCanvas(): HTMLCanvasElement;
  triggerRepaint(): void;
  removeLayer(id: string): void;
  painter?: { currentStencilSource?: unknown; nextStencilID?: number };
};

export const LAYER_ID = 'canal-elevation';
const EXTRACT_DIR = 'elevation-v1';
const MIN_ZOOM = 14.5;
const RESIDENT_RADIUS_M = 1600;
const RESIDENCY_STEP_M = 200;
const MAX_RESIDENT_CELLS = 24;
/** Faces are wound counter-clockwise seen from their stated normal (meshBuilder). */
const FRONT = THREE.FrontSide;

/** `?elevation=1` / `window.__canalRecallElevation = true`; default off. */
export function elevationEnabled(search = typeof location !== 'undefined' ? location.search : '', global: unknown = typeof window !== 'undefined' ? (window as any).__canalRecallElevation : undefined): boolean {
  if (typeof global === 'boolean') return global;
  const value = new URLSearchParams(search).get('elevation');
  return value === '1' || value === 'true' || value === 'on';
}

/** Baked colours are sRGB; three expects linear vertex colours and encodes on output. */
function toLinear(colors: Float32Array): Float32Array {
  for (let i = 0; i < colors.length; i++) {
    const c = colors[i];
    colors[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  return colors;
}

function geometryOf(data: MeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(toLinear(data.colors), 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  return geometry;
}

function colourFromStyle(map: MapLike, layer: string, property: string, fallback: string): THREE.Color {
  try {
    const value = map.getLayer(layer) ? map.getPaintProperty(layer, property) : null;
    if (typeof value === 'string') return new THREE.Color(value.replace(/^hsla?\(([^,]+),([^,]+),([^,]+),[^)]+\)$/, 'hsl($1,$2,$3)'));
  } catch (_) { /* expression or unknown colour */ }
  return new THREE.Color(fallback);
}

interface ResidentCell {
  key: string;
  meshes: { scene: THREE.Scene; mesh: THREE.Mesh }[];
}

export interface ElevationStats {
  enabled: boolean;
  ready: boolean;
  cells: number;
  measuredDecks: number;
  fallbackDecks: number;
  triangles: number;
  freeboardM: number;
  lastRenderMs: number;
}

export class CanalElevation {
  readonly flatLayer: CanalElevation['layer'];
  readonly layer: { id: string; type: 'custom'; renderingMode: '3d'; onAdd: (map: unknown, gl: WebGL2RenderingContext) => void; onRemove: () => void; render: (gl: WebGL2RenderingContext, args: any) => void };
  enabled = true;
  ready = false;
  index: ElevationIndex | null = null;
  private root = '';
  private generation = 0;
  private frame: SceneFrame | null = null;
  private transform: THREE.Matrix4 | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly camera = new THREE.Camera();
  private readonly scenes = { opening: new THREE.Scene(), sunken: new THREE.Scene(), restore: new THREE.Scene(), upper: new THREE.Scene(), flat: new THREE.Scene() };
  private readonly materials: Record<string, THREE.Material>;
  private readonly cells = new Map<string, ResidentCell>();
  private readonly loading = new Set<string>();
  private readonly cellData = new Map<string, WaterCell>();
  private profilesByCell = new Map<string, DeckProfile[]>();
  private fallbackByCell = new Map<string, FallbackDeck[]>();
  private deckIndex: DeckIndex | null = null;
  private fallbackDecks: FallbackDeck[] = [];
  private residencyCentre: [number, number] | null = null;
  private lastRenderMs = 0;

  constructor(private readonly map: MapLike, private readonly maplibregl: MaplibreLike, options: { beforeId?: string } = {}) {
    const stencilEqual = { stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp, stencilWriteMask: 0 };
    const below = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];
    const above = [new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)];
    this.materials = {
      opening: new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false, side: THREE.DoubleSide, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp }),
      water: new THREE.MeshBasicMaterial({ color: 0x7fa6c4, side: THREE.DoubleSide, ...stencilEqual }),
      walls: new THREE.MeshBasicMaterial({ vertexColors: true, side: FRONT, ...stencilEqual }),
      deckBelow: new THREE.MeshBasicMaterial({ vertexColors: true, side: FRONT, clippingPlanes: below, ...stencilEqual }),
      restore: new THREE.ShaderMaterial({
        vertexShader: 'void main(){vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position=vec4(p.xy,p.w*0.99999,p.w);}',
        fragmentShader: 'void main(){gl_FragColor=vec4(0.0);}',
        colorWrite: false, depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth, side: THREE.DoubleSide,
        stencilWrite: true, stencilRef: 0, stencilFunc: THREE.AlwaysStencilFunc, stencilFail: THREE.ZeroStencilOp, stencilZFail: THREE.ZeroStencilOp, stencilZPass: THREE.ZeroStencilOp,
      }),
      deckAbove: new THREE.MeshBasicMaterial({ vertexColors: true, side: FRONT, clippingPlanes: above }),
      // A flat deck at street level never hides anything above ground, so it
      // writes no depth; it draws in its own layer under the basemap's bridge
      // roads, so road paint, the route and street highlights stay on it.
      deckFlatTop: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, depthWrite: false }),
      // Flat footprints are cut back out of the opening: the sunken pass must
      // not paint over the bridge roads drawn on them.
      openingCut: new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false, side: THREE.DoubleSide, stencilWrite: true, stencilRef: 0, stencilFunc: THREE.AlwaysStencilFunc, stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp }),
    };
    const owner = this;
    this.layer = {
      id: LAYER_ID, type: 'custom', renderingMode: '3d',
      onAdd(_map: unknown, gl: WebGL2RenderingContext) {
        owner.ensureRenderer(gl);
      },
      onRemove() {
        owner.generation++;
        owner.clearCells();
        for (const material of Object.values(owner.materials)) material.dispose();
        owner.renderer?.dispose();
        owner.renderer = null;
      },
      render(gl: WebGL2RenderingContext, args: any) {
        owner.draw(gl, args);
      },
    };
    const before = options.beforeId && map.getLayer(options.beforeId) ? options.beforeId
      : map.getLayer('building') ? 'building'
        : map.getStyle()?.layers?.find(layer => layer.type === 'symbol')?.id;
    map.addLayer(this.layer, before);
    this.flatLayer = {
      id: `${LAYER_ID}-flat-decks`, type: 'custom', renderingMode: '3d',
      onAdd(_map: unknown, gl: WebGL2RenderingContext) { owner.ensureRenderer(gl); },
      onRemove() { /* the main layer owns the renderer and meshes */ },
      render(_gl: WebGL2RenderingContext, args: any) { owner.drawFlat(args); },
    };
    const firstBridge = map.getStyle()?.layers?.find(layer => /^bridge_/.test(layer.id))?.id;
    map.addLayer(this.flatLayer, firstBridge ?? LAYER_ID);
    this.applyTheme();
  }

  private ensureRenderer(gl: WebGL2RenderingContext): void {
    if (this.renderer) return;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
    this.renderer.localClippingEnabled = true;
  }

  private visibleNow(): boolean {
    return this.enabled && this.ready && !!this.renderer && !!this.transform && this.map.getZoom() >= MIN_ZOOM;
  }

  private setCamera(args: any): void {
    this.camera.projectionMatrix.fromArray(args.defaultProjectionData?.mainMatrix ?? args).multiply(this.transform!);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
  }

  private drawFlat(args: any): void {
    if (!this.visibleNow() || !this.cells.size) return;
    this.setCamera(args);
    this.renderer!.resetState();
    this.renderer!.render(this.scenes.flat, this.camera);
  }

  /** Re-read water / road colours from the basemap style (after a theme change). */
  applyTheme(): void {
    const water = colourFromStyle(this.map, 'water', 'fill-color', '#8fb7d6');
    // The sunken surface reads as deeper and in shadow next to the street-level fill.
    (this.materials.water as THREE.MeshBasicMaterial).color.copy(water).multiplyScalar(0.72);
    this.map.triggerRepaint();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.map.triggerRepaint();
  }

  get freeboardM(): number {
    return this.index?.quayFreeboardM ?? 0;
  }

  /** Water surface height relative to the street (negative), or 0 before load / when off. */
  waterLevelM(): number {
    return this.enabled && this.ready ? -this.freeboardM : 0;
  }

  async load(root: string): Promise<void> {
    const generation = ++this.generation;
    this.root = root;
    this.ready = false;
    this.clearCells();
    this.cellData.clear();
    this.deckIndex = null;
    if (!root.endsWith('/amsterdam')) return;
    try {
      const base = `${root}/${EXTRACT_DIR}`;
      const [indexResponse, bridgeResponse] = await Promise.all([fetch(`${base}/index.json`), fetch(`${base}/bridges.json`)]);
      if (!indexResponse.ok || !bridgeResponse.ok) throw new Error(`canal elevation extract missing (${indexResponse.status}/${bridgeResponse.status})`);
      const index = validateIndex(await indexResponse.json());
      const bridges = await bridgeResponse.json() as BridgeExtract;
      if (generation !== this.generation) return;
      this.index = index;
      this.frame = new SceneFrame(index);
      const c = this.maplibregl.MercatorCoordinate.fromLngLat(index.origin, 0);
      const s = c.meterInMercatorCoordinateUnits();
      this.transform = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).scale(new THREE.Vector3(s, -s, s));
      const quant = index.quantization.xy;
      const toScene = (x: number, y: number) => this.frame!.fromLocal(x, y);
      // Near-flat measured decks join the flat footprints (drawn under the road paint).
      const humped = bridges.measured.filter(b => !isFlatMeasured(b));
      const flat = [...bridges.fallback, ...bridges.measured.filter(isFlatMeasured).map(b => ({ id: b.id, name: b.name, type: 'measured-flat', ring: b.outline }))];
      const profiles = humped.map(b => decodeProfile(b, quant, toScene));
      this.deckIndex = new DeckIndex(profiles);
      this.fallbackDecks = flat.map(b => decodeFallback(b, quant, toScene));
      const cellOf = (x: number, y: number) => cellKey(Math.floor(x / index.cellSizeM), Math.floor(y / index.cellSizeM));
      this.profilesByCell = new Map();
      humped.forEach((b, i) => {
        const key = cellOf(b.p[0] * quant, b.p[1] * quant);
        (this.profilesByCell.get(key) ?? this.profilesByCell.set(key, []).get(key)!).push(profiles[i]);
      });
      this.fallbackByCell = new Map();
      flat.forEach((b, i) => {
        const key = cellOf(b.ring[0] * quant, b.ring[1] * quant);
        (this.fallbackByCell.get(key) ?? this.fallbackByCell.set(key, []).get(key)!).push(this.fallbackDecks[i]);
      });
      this.ready = true;
      this.residencyCentre = null;
      this.updateResidency();
    } catch (error) {
      console.warn('Canal elevation unavailable; the flat map stays.', error);
    }
  }

  /** Deck height (m above street) under a point, honouring the viaduct heading rule. */
  deckHeightAt(lngLat: LngLat, angle?: number): number {
    if (!this.enabled || !this.ready || !this.deckIndex || !this.frame) return 0;
    const [x, y] = this.frame.fromLngLat(lngLat[0], lngLat[1]);
    const heading: [number, number] | undefined = Number.isFinite(angle) ? [Math.cos(angle!), -Math.sin(angle!)] : undefined;
    return this.deckIndex.heightAt(x, y, heading)?.height ?? 0;
  }

  /** Height and pitch for a vehicle with rear/front contacts (metres), facing the game's `angle`. */
  riderPose(lngLat: LngLat, angle: number, contacts?: [number, number]): { heightM: number; pitch: number } {
    if (!this.enabled || !this.ready || !this.deckIndex || !this.frame) return { heightM: 0, pitch: 0 };
    const [x, y] = this.frame.fromLngLat(lngLat[0], lngLat[1]);
    const heading: [number, number] = [Math.cos(angle), -Math.sin(angle)];
    const index = this.deckIndex;
    const pose = surfacePose((px, py) => index.heightAt(px, py, heading)?.height ?? 0, x, y, heading, contacts);
    return { heightM: pose.height, pitch: pose.pitch };
  }

  stats(): ElevationStats {
    let triangles = 0, measured = 0, fallback = 0;
    for (const cell of this.cells.values()) {
      for (const { mesh } of cell.meshes) triangles += (mesh.geometry.index?.count ?? 0) / 3;
      measured += this.profilesByCell.get(cell.key)?.length ?? 0;
      fallback += this.fallbackByCell.get(cell.key)?.length ?? 0;
    }
    return { enabled: this.enabled, ready: this.ready, cells: this.cells.size, measuredDecks: measured, fallbackDecks: fallback, triangles, freeboardM: this.freeboardM, lastRenderMs: this.lastRenderMs };
  }

  private updateResidency(): void {
    if (!this.ready || !this.index) return;
    const centre = this.map.getCenter();
    const [x, y] = lngLatToLocal(this.index, centre.lng, centre.lat);
    if (this.residencyCentre && Math.hypot(x - this.residencyCentre[0], y - this.residencyCentre[1]) < RESIDENCY_STEP_M) return;
    this.residencyCentre = [x, y];
    const wanted = cellsNear(this.index, x, y, RESIDENT_RADIUS_M)
      .map(key => { const [cx, cy] = key.split('_').map(Number); return { key, d: Math.hypot((cx + 0.5) * this.index!.cellSizeM - x, (cy + 0.5) * this.index!.cellSizeM - y) }; })
      .sort((a, b) => a.d - b.d).slice(0, MAX_RESIDENT_CELLS).map(c => c.key);
    const keep = new Set(wanted);
    for (const key of [...this.cells.keys()]) if (!keep.has(key)) this.dropCell(key);
    for (const key of wanted) if (!this.cells.has(key)) void this.loadCell(key);
  }

  private async loadCell(key: string): Promise<void> {
    if (this.loading.has(key) || !this.index) return;
    const generation = this.generation;
    let data = this.cellData.get(key);
    if (!data) {
      this.loading.add(key);
      try {
        const response = await fetch(`${this.root}/${EXTRACT_DIR}/cells/${key}.json`);
        if (!response.ok) throw new Error(`cell ${key}: ${response.status}`);
        data = await response.json() as WaterCell;
      } catch (error) {
        console.warn('Canal elevation cell unavailable', error);
        return;
      } finally {
        this.loading.delete(key);
      }
      if (generation !== this.generation) return;
      this.cellData.set(key, data);
    }
    if (this.cells.has(key) || !this.residencyCentre) return;
    this.installCell(key, data);
  }

  private installCell(key: string, data: WaterCell): void {
    const index = this.index!, frame = this.frame!;
    const quant = index.quantization.xy, freeboard = index.quayFreeboardM;
    const toScene = (x: number, y: number) => frame.fromLocal(x, y);
    const meshes: ResidentCell['meshes'] = [];
    const add = (scene: THREE.Scene, geometry: THREE.BufferGeometry, material: THREE.Material) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
      meshes.push({ scene, mesh });
      return mesh;
    };
    if (data.water.length) {
      const opening = geometryOf(waterSurface(data, index.cellSizeM, quant, 0, [1, 1, 1], toScene));
      add(this.scenes.opening, opening, this.materials.opening);
      add(this.scenes.restore, opening, this.materials.restore);
      add(this.scenes.sunken, geometryOf(waterSurface(data, index.cellSizeM, quant, -freeboard, [1, 1, 1], toScene)), this.materials.water);
    }
    if (data.shore.length) add(this.scenes.sunken, geometryOf(quayWalls(data, index.cellSizeM, quant, freeboard, toScene)), this.materials.walls);
    for (const profile of this.profilesByCell.get(key) ?? []) {
      const deck = geometryOf(measuredDeckMesh(profile, freeboard));
      add(this.scenes.sunken, deck, this.materials.deckBelow);
      add(this.scenes.upper, deck, this.materials.deckAbove);
    }
    for (const deck of this.fallbackByCell.get(key) ?? []) {
      add(this.scenes.sunken, geometryOf(fallbackDeckUnderside(deck)), this.materials.walls);
      const top = geometryOf(fallbackDeckTop(deck));
      add(this.scenes.flat, top, this.materials.deckFlatTop);
      add(this.scenes.opening, top, this.materials.openingCut).renderOrder = 1;
    }
    this.cells.set(key, { key, meshes });
    this.map.triggerRepaint();
  }

  private dropCell(key: string): void {
    const cell = this.cells.get(key);
    if (!cell) return;
    const geometries = new Set<THREE.BufferGeometry>();
    for (const { scene, mesh } of cell.meshes) { scene.remove(mesh); geometries.add(mesh.geometry); }
    for (const geometry of geometries) geometry.dispose();
    this.cells.delete(key);
  }

  private clearCells(): void {
    for (const key of [...this.cells.keys()]) this.dropCell(key);
  }

  private draw(gl: WebGL2RenderingContext, args: any): void {
    if (!this.visibleNow()) return;
    const renderer = this.renderer!;
    this.updateResidency();
    if (!this.cells.size) return;
    const t0 = performance.now();
    this.setCamera(args);
    const depthRange = gl.getParameter(gl.DEPTH_RANGE) as Float32Array;
    renderer.resetState();
    gl.stencilMask(0xff);
    gl.clearStencil(0);
    gl.clear(gl.STENCIL_BUFFER_BIT);
    renderer.render(this.scenes.opening, this.camera);
    renderer.render(this.scenes.sunken, this.camera);
    gl.depthRange(0, 1);
    renderer.render(this.scenes.restore, this.camera);
    gl.depthRange(depthRange[0], depthRange[1]);
    renderer.render(this.scenes.upper, this.camera);
    // MapLibre's tile clipping masks were in the stencil we just used.
    const painter = this.map.painter;
    if (painter && 'currentStencilSource' in painter) {
      painter.currentStencilSource = undefined;
      painter.nextStencilID = 1;
    }
    this.lastRenderMs = performance.now() - t0;
  }
}
