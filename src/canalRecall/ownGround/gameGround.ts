// The own ground in the game's riding view (`?ownGround=1`, implies
// `?sharedFrame=1`). docs/research/own-ground-20261009.md, "what remains".
//
// - Streaming: elevation-v1 1 km cells around the rider, built in the ground
//   worker (groundWorker.ts), LOD 0 within NEAR_M of the rider's cell edge,
//   LOD 1 to RADIUS_M, evicted beyond; installed one cell per frame.
// - Drawn as one participant of the shared three.js frame (order −10, under
//   the facades), lit and shadowed by its rig.
// - Overlays are draped ribbons on the same surface: the route line, the
//   question street's highlight (centreline geometry only, never a name),
//   and the destination's ground ring.
// - The riding surface (relief + measured decks) is also sampled here on the
//   main thread for the rider's pose and for model bases (buildings, trees,
//   landmarks), with the same data and frame the worker builds from.
//
// Renderer-agnostic on purpose: nothing here calls MapLibre. The shared frame
// supplies the camera; `GroundHost` is the thin adapter the page implements
// (repaint, hiding the basemap's own ground). THREE is injected.

import { GroundStore, httpFetchBytes, toLocal, WATER_Z, type Rect } from './groundStore.js';
import { GROUND_LAYERS, type BuiltCell, type GroundLayer, type PackedMesh } from './groundCell.js';
import { groundParticipant, GROUND_ORDER } from './sharedFrameGround.js';
import { footprintBase } from './placement.js';
import { routeRibbon } from './streets.js';
import { disc, emptyMesh, merge, type MeshArrays } from './drape.js';
import { riderPose as surfaceRiderPose, type Vec2 } from './surface.js';

export interface GroundHost {
  /** Ask for another frame. */
  repaint(): void;
  /** Hide (true) or restore (false) the basemap's own ground fills and lines. */
  setBasemapGroundHidden(hidden: boolean): void;
}

export interface OwnGroundOptions {
  workerUrl: string;
  /** Resident radius from the rider to a cell's nearest edge, metres. */
  radiusM?: number;
  /** LOD 0 within this distance of a cell's nearest edge. */
  nearM?: number;
  /** Below this map zoom the ground is not drawn (overview, minimap: flat cartography). */
  minZoom?: number;
}

type LngLat = [number, number];

interface Resident { key: string; lod: 0 | 1; group: any; materials: any[]; textures: any[]; triangles: number; bytes: number }

const RADIUS_M = 1400;
const NEAR_M = 350;
const RESIDENCY_STEP_M = 60;

/** Which mask channel cuts a layer: R = water (land, parks), G = water minus decks (street bands). */
const CUT: Partial<Record<GroundLayer, 'r' | 'g'>> = {
  land: 'r', park: 'r', wood: 'r', square: 'r', parking: 'r',
  asphalt: 'g', klinker: 'g', cycle: 'g', paving: 'g', gravel: 'g', kerb: 'g', paint: 'g',
};
/** Polygon-offset rank of coplanar ground layers (later wins), as the prototype. */
const OFFSET: Partial<Record<GroundLayer, number>> = { park: 1, wood: 1, square: 1, parking: 1, klinker: 2, asphalt: 2, gravel: 3, cycle: 3, paving: 3, paint: 4 };

export class OwnGround {
  readonly root: any;
  store: GroundStore;
  enabled = true;
  ready = false;
  /** Bumped whenever more relief/decks are resident on the main thread (consumers re-query bases). */
  surfaceRevision = 0;
  private readonly THREE: any;
  private readonly frame: any;
  private readonly host: GroundHost;
  private readonly opts: Required<OwnGroundOptions>;
  private worker: Worker | null = null;
  private workerReady = false;
  private readonly base: Record<string, any> = {};
  private readonly resident = new Map<string, Resident>();
  private readonly pending = new Map<string, 0 | 1>();
  private readonly installQueue: BuiltCell[] = [];
  private readonly prepared = new Set<string>();
  private readonly preparing = new Set<string>();
  private gen = 0;
  private centre: Vec2 | null = null;
  private residencyAt: Vec2 | null = null;
  private zoom = 0;
  private unregister: (() => void) | null = null;
  private basemapHidden = false;
  private overlays: { route: any; casing: any; highlight: any; destination: any } = { route: null, casing: null, highlight: null, destination: null };
  private routeLine: Vec2[] | null = null;
  private highlightLines: Vec2[][] | null = null;
  private destination: Vec2 | null = null;
  private overlayRevision = -1;
  private overlayDirty = true;
  readonly stats = { cellsBuilt: 0, buildMs: [] as number[], installMs: [] as number[], errors: [] as string[], lastBuild: null as null | Record<string, unknown> };

  constructor(THREE: any, frame: any, host: GroundHost, options: OwnGroundOptions) {
    this.THREE = THREE;
    this.frame = frame;
    this.host = host;
    this.opts = { radiusM: RADIUS_M, nearM: NEAR_M, minZoom: 15, ...options };
    this.root = new THREE.Group();
    this.root.name = 'own-ground';
    this.store = new GroundStore(httpFetchBytes(''));
    this.makeMaterials();
  }

  // ------------------------------------------------------------------ lifecycle

  /** Load the extract indexes (absolute extract root URL) and start the worker. */
  async load(root: string): Promise<void> {
    this.dispose(false);
    this.store = new GroundStore(httpFetchBytes(root));
    this.ready = false;
    if (!/\/amsterdam\/?$/.test(root)) return;
    await this.store.init();
    try {
      this.worker = new Worker(this.opts.workerUrl);
      this.worker.onmessage = event => this.onWorker(event.data);
      this.worker.onerror = event => { this.stats.errors.push(`worker: ${event.message}`); };
      this.worker.postMessage({ type: 'init', root });
    } catch (error) {
      this.stats.errors.push(`worker unavailable: ${String(error)}`);
    }
    if (!this.unregister) {
      this.unregister = this.frame.register('own-ground', groundParticipant(this.root, {
        visible: (zoom: number) => this.beforeRender(zoom),
      }), { order: GROUND_ORDER });
    }
    this.ready = true;
    this.residencyAt = null;
    if (this.centre) this.updateResidency();
  }

  dispose(full = true): void {
    for (const key of [...this.resident.keys()]) this.drop(key);
    this.pending.clear();
    this.installQueue.length = 0;
    this.prepared.clear();
    this.worker?.terminate();
    this.worker = null;
    this.workerReady = false;
    this.gen++;
    if (full) { this.unregister?.(); this.unregister = null; this.setBasemapHidden(false); }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.setBasemapHidden(false);
    this.host.repaint();
  }

  /** The rider's position (lng/lat) and the map zoom; call once per camera sync. */
  update(lngLat: LngLat, zoom: number): void {
    this.zoom = zoom;
    this.centre = toLocal(lngLat[0], lngLat[1]);
    if (!this.ready) return;
    if (!this.residencyAt || Math.hypot(this.centre[0] - this.residencyAt[0], this.centre[1] - this.residencyAt[1]) >= RESIDENCY_STEP_M) this.updateResidency();
  }

  private visibleAtZoom(zoom: number): boolean { return this.enabled && this.ready && zoom >= this.opts.minZoom; }

  /** Per frame, from the shared frame's main pass. */
  private beforeRender(zoom: number): boolean {
    this.zoom = zoom;
    const visible = this.visibleAtZoom(zoom);
    // One cell per frame: geometry upload is the cost, not the build (that is in the worker).
    const next = this.installQueue.shift();
    if (next) { this.install(next); if (this.installQueue.length) this.host.repaint(); }
    if (visible && (this.overlayDirty || this.overlayRevision !== this.surfaceRevision)) this.rebuildOverlays();
    this.setBasemapHidden(visible && this.coversRider());
    return visible && this.resident.size > 0;
  }

  /** The rider's cell and its 8 neighbours are drawn: the basemap's ground underneath is redundant. */
  private coversRider(): boolean {
    if (!this.centre || !this.ready) return false;
    const key = this.store.cellAt(this.centre[0], this.centre[1]);
    return GroundStore.neighbours(key).every(k => this.resident.has(k) || !this.store.covers(k)) && this.resident.has(key);
  }

  private setBasemapHidden(hidden: boolean): void {
    if (hidden === this.basemapHidden) return;
    this.basemapHidden = hidden;
    this.host.setBasemapGroundHidden(hidden);
  }

  // ------------------------------------------------------------------ residency

  private rectDistance(r: Rect, p: Vec2): number {
    const dx = Math.max(r[0] - p[0], 0, p[0] - r[2]), dy = Math.max(r[1] - p[1], 0, p[1] - r[3]);
    return Math.hypot(dx, dy);
  }

  /** Cells wanted now, nearest first, with their LOD. */
  wantedCells(): { key: string; lod: 0 | 1; d: number }[] {
    if (!this.centre || !this.ready) return [];
    const [x, y] = this.centre, R = this.opts.radiusM, size = this.store.elevation.cellSizeM;
    const out: { key: string; lod: 0 | 1; d: number }[] = [];
    const span = Math.ceil(R / size) + 1;
    const [cx, cy] = this.store.cellAt(x, y).split('_').map(Number);
    for (let dy = -span; dy <= span; dy++) for (let dx = -span; dx <= span; dx++) {
      const key = `${cx + dx}_${cy + dy}`;
      if (!this.store.covers(key)) continue;
      const d = this.rectDistance(this.store.cellRect(key), this.centre);
      if (d > R) continue;
      out.push({ key, lod: d <= this.opts.nearM ? 0 : 1, d });
    }
    return out.sort((a, b) => a.d - b.d);
  }

  private updateResidency(): void {
    if (!this.centre) return;
    this.residencyAt = [this.centre[0], this.centre[1]];
    const wanted = this.wantedCells();
    const keep = new Set(wanted.map(w => w.key));
    for (const key of [...this.resident.keys()]) if (!keep.has(key)) this.drop(key);
    for (const key of [...this.pending.keys()]) if (!keep.has(key)) this.pending.delete(key);
    for (let i = this.installQueue.length - 1; i >= 0; i--) if (!keep.has(this.installQueue[i].key)) this.installQueue.splice(i, 1);
    for (const w of wanted) {
      // Main-thread surface for poses, bases and overlays: relief + decks of every wanted cell.
      this.prepareMain(w.key);
      const have = this.resident.get(w.key)?.lod, asked = this.pending.get(w.key);
      if (have === w.lod || asked === w.lod) continue;
      this.pending.set(w.key, w.lod);
      this.worker?.postMessage({ type: 'build', key: w.key, lod: w.lod, gen: this.gen });
    }
    // Relief far behind is dropped on both sides (decks keep their placed heights).
    const keepM = this.opts.radiusM + 2200;
    this.worker?.postMessage({ type: 'evict', x: this.centre[0], y: this.centre[1], keepM, keep: [...keep].flatMap(k => GroundStore.neighbours(k)) });
    if (this.store.evictRelief(this.centre[0], this.centre[1], keepM)) {
      for (const key of [...this.prepared]) if (!keep.has(key)) this.prepared.delete(key);
    }
    this.store.forgetCells(new Set([...keep].flatMap(k => GroundStore.neighbours(k))));
  }

  private prepareMain(key: string): void {
    if (this.prepared.has(key) || this.preparing.has(key)) return;
    this.preparing.add(key);
    this.store.prepareCell(key).then(() => {
      this.prepared.add(key);
      this.surfaceRevision++;
      this.host.repaint();
    }).catch(error => this.stats.errors.push(`prepare ${key}: ${String(error)}`)).finally(() => this.preparing.delete(key));
  }

  private onWorker(msg: any): void {
    if (msg.type === 'ready') { this.workerReady = true; return; }
    if (msg.type === 'error') { this.stats.errors.push(`${msg.key ?? ''}: ${msg.message}`.slice(0, 400)); if (msg.key) this.pending.delete(msg.key); return; }
    if (msg.type !== 'cell' || msg.gen !== this.gen) return;
    const cell = msg.cell as BuiltCell;
    if (this.pending.get(cell.key) !== cell.lod) return;
    this.pending.delete(cell.key);
    this.stats.cellsBuilt++;
    this.stats.buildMs.push(cell.stats.buildMs);
    this.stats.lastBuild = { key: cell.key, lod: cell.lod, ...cell.stats };
    this.installQueue.push(cell);
    this.host.repaint();
  }

  // ------------------------------------------------------------------ meshes

  private canvasTexture(size: number, metres: number, paint: (g: CanvasRenderingContext2D, s: number) => void): any {
    const THREE = this.THREE;
    const c = document.createElement('canvas'); c.width = c.height = size;
    paint(c.getContext('2d')!, size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4; t.repeat.set(1 / metres, 1 / metres);
    return t;
  }

  /** Base materials (as the prototype page); cut layers are cloned per cell with that cell's mask. */
  private makeMaterials(): void {
    const THREE = this.THREE;
    let seed = 99;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const noise = (g: CanvasRenderingContext2D, s: number, base: [number, number, number], spread: number, grain = 2) => {
      for (let y = 0; y < s; y += grain) for (let x = 0; x < s; x += grain) {
        const v = (rnd() - 0.5) * spread;
        g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`; g.fillRect(x, y, grain, grain);
      }
    };
    const pavers = (base: [number, number, number], joint: string, metres: number, w: number, h: number) => this.canvasTexture(512, metres, (g, s) => {
      g.fillStyle = joint; g.fillRect(0, 0, s, s);
      const pw = s * w / metres, ph = s * h / metres;
      for (let row = 0, y = 0; y < s; row++, y += ph) for (let x = row % 2 ? -pw / 2 : 0; x < s; x += pw) {
        const v = (rnd() - 0.5) * 26;
        g.fillStyle = `rgb(${base[0] + v},${base[1] + v * 0.9},${base[2] + v * 0.8})`;
        g.fillRect(x + 1.5, y + 1.5, pw - 3, ph - 3);
      }
    });
    const std = (o: Record<string, unknown>) => new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, ...o });
    const M: Record<string, any> = {
      land: std({ map: pavers([150, 142, 130], '#6f675d', 3, 0.3, 0.3) }),
      klinker: std({ map: pavers([128, 82, 66], '#5a463d', 2, 0.2, 0.1), roughness: 0.9 }),
      asphalt: std({ map: this.canvasTexture(256, 4, (g, s) => noise(g, s, [72, 74, 78], 18)) }),
      cycle: std({ map: this.canvasTexture(256, 4, (g, s) => noise(g, s, [146, 70, 62], 18)), roughness: 0.85 }),
      paving: std({ map: pavers([168, 160, 148], '#7d756a', 3, 0.3, 0.3) }),
      gravel: std({ map: this.canvasTexture(256, 4, (g, s) => noise(g, s, [170, 156, 128], 30, 2)) }),
      kerb: std({ color: '#9b958b', roughness: 0.9 }),
      paint: std({ color: '#f2f0ea', roughness: 0.6 }),
      park: std({ map: this.canvasTexture(256, 6, (g, s) => noise(g, s, [92, 122, 66], 30, 3)), roughness: 1 }),
      wood: std({ map: this.canvasTexture(256, 6, (g, s) => noise(g, s, [70, 96, 52], 34, 3)), roughness: 1 }),
      square: std({ map: pavers([176, 166, 150], '#857c70', 4, 0.6, 0.6) }),
      parking: std({ map: this.canvasTexture(256, 4, (g, s) => noise(g, s, [92, 92, 96], 16)) }),
      quay: std({ vertexColors: true }),
      deckBody: std({ vertexColors: true, roughness: 0.85 }),
      deckTop: std({ vertexColors: true, roughness: 0.85 }),
      water: std({ color: '#304b4d', roughness: 0.1, envMapIntensity: 2.2 }),
    };
    for (const [layer, k] of Object.entries(OFFSET)) Object.assign(M[layer], { polygonOffset: true, polygonOffsetFactor: -k!, polygonOffsetUnits: -2 * k! });
    // Overlays: the game's own route / active-street colours (vector-map.js), draped.
    const overlay = (color: string, k: number, o: Record<string, unknown> = {}) => new THREE.MeshBasicMaterial({ color, polygonOffset: true, polygonOffsetFactor: -k, polygonOffsetUnits: -2 * k, ...o });
    M.routeCasing = overlay('#03121c', 5, { transparent: true, opacity: 0.75, depthWrite: false });
    M.route = overlay('#38BDF8', 6, { transparent: true, opacity: 0.9, depthWrite: false });
    M.highlight = overlay('#38BDF8', 7, { transparent: true, opacity: 0.96, depthWrite: false });
    M.destination = overlay('#f97316', 7, { transparent: true, opacity: 0.85, depthWrite: false });
    Object.assign(this.base, M);
  }

  /** A clone of a base material that discards fragments over water by this cell's mask. */
  private cutMaterial(layer: GroundLayer, uniforms: Record<string, { value: unknown }>): any {
    const channel = CUT[layer]!;
    const m = this.base[layer].clone();
    m.onBeforeCompile = (shader: any) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vMaskXY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMaskXY = transformed.xy;');
      // Outside the mask's extent the ground is land (no cut).
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vMaskXY;\nuniform sampler2D waterMask;\nuniform vec2 maskOrigin;\nuniform vec2 maskSize;')
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n{ vec2 muv = (vMaskXY - maskOrigin) / maskSize; if (muv.x > 0.0 && muv.y > 0.0 && muv.x < 1.0 && muv.y < 1.0 && texture2D(waterMask, muv).${channel} < 0.5) discard; }`);
    };
    m.customProgramCacheKey = () => `ownGround-cut-${channel}-${layer}`;
    return m;
  }

  private geometry(p: PackedMesh): any {
    const THREE = this.THREE;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(p.normals, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(p.uvs, 2));
    if (p.colors) {
      // Vertex colours are authored in sRGB; three expects linear.
      const c = p.colors;
      for (let i = 0; i < c.length; i++) c[i] = Math.pow(c[i], 2.2);
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    g.setIndex(new THREE.BufferAttribute(p.indices, 1));
    g.computeBoundingSphere();
    return g;
  }

  private install(cell: BuiltCell): void {
    if (!this.wantedCells().some(w => w.key === cell.key && w.lod === cell.lod)) return;
    const t0 = performance.now();
    const THREE = this.THREE;
    this.drop(cell.key);
    const group = new THREE.Group();
    group.name = `own-ground/${cell.key}/lod${cell.lod}`;
    const materials: any[] = [], textures: any[] = [];
    let uniforms: Record<string, { value: unknown }> | null = null;
    if (cell.mask) {
      const tex = new THREE.DataTexture(cell.mask.texels, cell.mask.width, cell.mask.height, THREE.RGFormat, THREE.UnsignedByteType);
      tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.unpackAlignment = 2; tex.needsUpdate = true;
      textures.push(tex);
      uniforms = { waterMask: { value: tex }, maskOrigin: { value: new THREE.Vector2(cell.mask.x0, cell.mask.y0) }, maskSize: { value: new THREE.Vector2(cell.mask.width * cell.mask.res, cell.mask.height * cell.mask.res) } };
    }
    let triangles = 0, bytes = 0;
    for (const layer of GROUND_LAYERS) {
      const p = cell.layers[layer];
      if (!p) continue;
      let material = this.base[layer];
      if (uniforms && CUT[layer]) { material = this.cutMaterial(layer, uniforms); materials.push(material); }
      const mesh = new THREE.Mesh(this.geometry(p), material);
      mesh.name = layer;
      mesh.matrixAutoUpdate = false;
      mesh.receiveShadow = true;
      // Deck bodies and kerbs stand up; the rest is ground.
      mesh.castShadow = layer === 'deckBody';
      mesh.renderOrder = layer === 'water' || layer === 'quay' ? 0 : layer === 'land' ? 1 : 2;
      group.add(mesh);
      triangles += p.indices.length / 3;
      bytes += p.positions.byteLength * 2 + p.uvs.byteLength + p.indices.byteLength + (p.colors?.byteLength ?? 0);
    }
    group.matrixAutoUpdate = false;
    this.root.add(group);
    this.resident.set(cell.key, { key: cell.key, lod: cell.lod, group, materials, textures, triangles, bytes });
    this.stats.installMs.push(performance.now() - t0);
    this.frame.invalidateShadows?.();
    this.host.repaint();
  }

  private drop(key: string): void {
    const r = this.resident.get(key);
    if (!r) return;
    this.root.remove(r.group);
    r.group.traverse((o: any) => { if (o.isMesh) o.geometry.dispose(); });
    for (const m of r.materials) m.dispose();
    for (const t of r.textures) t.dispose();
    this.resident.delete(key);
  }

  // ------------------------------------------------------------------ surface queries

  /** Riding-surface height (scene z, metres above +1.37 NAP ≈ the old street level) under a lng/lat. */
  heightAt(lngLat: LngLat): number {
    if (!this.ready) return 0;
    const [x, y] = toLocal(lngLat[0], lngLat[1]);
    return this.store.surface.height(x, y);
  }

  /** Relief only (no decks) under a lng/lat, or undefined while it is not resident. */
  groundAt(lngLat: LngLat): number | undefined {
    if (!this.ready) return undefined;
    const [x, y] = toLocal(lngLat[0], lngLat[1]);
    return this.store.hasRelief(x, y) ? this.store.surface.ground(x, y) : undefined;
  }

  /**
   * A footprint's base (the prototype's rule: the lowest relief along it, so
   * nothing floats), or undefined while the relief there is not resident.
   */
  footprintBase(ring: readonly LngLat[]): number | null | undefined {
    if (!this.ready || ring.length < 3) return undefined;
    const local = ring.map(p => toLocal(p[0], p[1]));
    // Outside the relief extract: street level for good (null), not "later".
    if (!this.store.reliefCovered(local[0][0], local[0][1])) return null;
    if (!local.every(p => this.store.hasRelief(p[0], p[1]))) return undefined;
    return footprintBase(local, this.store.surface.ground).base;
  }

  /** A point model's base: the lowest relief in a square of `halfM` around it (landmarks: 3 m). */
  pointBase(lngLat: LngLat, halfM = 0): number | undefined {
    if (!this.ready) return undefined;
    const [x, y] = toLocal(lngLat[0], lngLat[1]);
    if (!this.store.reliefCovered(x, y)) return 0;
    if (!this.store.hasRelief(x, y)) return undefined;
    if (!halfM) return this.store.surface.ground(x, y);
    let z = Infinity;
    for (const dx of [-halfM, 0, halfM]) for (const dy of [-halfM, 0, halfM]) z = Math.min(z, this.store.surface.ground(x + dx, y + dy));
    return z;
  }

  // CanalElevation-compatible surface for vector-map.js's rider code.

  /** Height and pitch for a vehicle with rear/front contacts, facing the game's `angle` (east = 0, clockwise-negative north). */
  riderPose(lngLat: LngLat, angle: number, contacts?: [number, number]): { heightM: number; pitch: number } {
    if (!this.ready) return { heightM: 0, pitch: 0 };
    const [x, y] = toLocal(lngLat[0], lngLat[1]);
    const dir: Vec2 = [Math.cos(angle), -Math.sin(angle)];
    const wheelbase = contacts ? Math.abs(contacts[1] - contacts[0]) : 1.2;
    const mid = contacts ? (contacts[0] + contacts[1]) / 2 : 0;
    const pose = surfaceRiderPose(this.store.surface.height, x + dir[0] * mid, y + dir[1] * mid, dir, wheelbase || 1.2);
    return { heightM: pose.z, pitch: pose.pitch };
  }

  /** Canal water level (scene z). */
  waterLevelM(): number { return this.ready ? WATER_Z : 0; }
  applyTheme(): void { this.host.repaint(); }

  // ------------------------------------------------------------------ overlays

  /** The navigation route (lng/lat polyline), or null to hide it. */
  setRoute(line: readonly LngLat[] | null): void {
    this.routeLine = line && line.length > 1 ? line.map(p => toLocal(p[0], p[1])) : null;
    this.overlayDirty = true; this.host.repaint();
  }

  /**
   * The question street's centrelines (lng/lat), or null. Geometry only: the
   * ground never draws a street name, so this cannot reveal the answer's name.
   */
  setHighlight(lines: readonly (readonly LngLat[])[] | null): void {
    this.highlightLines = lines && lines.length ? lines.filter(l => l.length > 1).map(l => l.map(p => toLocal(p[0], p[1]))) : null;
    this.overlayDirty = true; this.host.repaint();
  }

  /** The destination's ground contact ring, or null. */
  setDestination(lngLat: LngLat | null): void {
    const next = lngLat ? toLocal(lngLat[0], lngLat[1]) : null;
    if (next && this.destination && Math.hypot(next[0] - this.destination[0], next[1] - this.destination[1]) < 0.1) return;
    this.destination = next;
    this.overlayDirty = true; this.host.repaint();
  }

  private rebuildOverlays(): void {
    this.overlayDirty = false;
    this.overlayRevision = this.surfaceRevision;
    const H = this.store.surface.height;
    const routeNear = this.routeLine ? this.clipToResident(this.routeLine) : [];
    this.setOverlay('casing', merge(routeNear.map(l => routeRibbon(l, H, 2.6, 0.06))), this.base.routeCasing, 3);
    this.setOverlay('route', merge(routeNear.map(l => routeRibbon(l, H, 1.6, 0.07))), this.base.route, 4);
    const lights = this.highlightLines ? this.highlightLines.flatMap(l => this.clipToResident(l)) : [];
    this.setOverlay('highlight', merge(lights.map(l => routeRibbon(l, H, 3.2, 0.075))), this.base.highlight, 5);
    let ring = emptyMesh();
    if (this.destination) {
      const m = emptyMesh();
      disc(m, this.destination, 3.2, H, 0.08, 28);
      ring = m;
    }
    this.setOverlay('destination', ring, this.base.destination, 6);
  }

  /** Polyline pieces within the resident radius (the rest is drawn when we get there). */
  private clipToResident(line: readonly Vec2[]): Vec2[][] {
    if (!this.centre) return [];
    const R = this.opts.radiusM + 200, [cx, cy] = this.centre, out: Vec2[][] = [];
    let cur: Vec2[] = [];
    for (const p of line) {
      if (Math.hypot(p[0] - cx, p[1] - cy) <= R) cur.push(p);
      else if (cur.length) { if (cur.length > 1) out.push(cur); cur = []; }
    }
    if (cur.length > 1) out.push(cur);
    return out;
  }

  private setOverlay(name: keyof OwnGround['overlays'], data: MeshArrays, material: any, order: number): void {
    const THREE = this.THREE;
    const old = this.overlays[name];
    if (old) { this.root.remove(old); old.geometry.dispose(); this.overlays[name] = null; }
    if (!data.indices.length) return;
    const positions = Float32Array.from(data.positions), indices = Uint32Array.from(data.indices);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material);
    mesh.name = `overlay:${name}`;
    mesh.renderOrder = 10 + order;
    mesh.matrixAutoUpdate = false;
    this.root.add(mesh);
    this.overlays[name] = mesh;
  }

  // ------------------------------------------------------------------ diagnostics

  status(): Record<string, unknown> {
    let triangles = 0, bytes = 0;
    const cells: Record<string, number> = {};
    for (const r of this.resident.values()) { triangles += r.triangles; bytes += r.bytes; cells[r.key] = r.lod; }
    const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[s.length >> 1].toFixed(1) : null; };
    return {
      enabled: this.enabled, ready: this.ready, workerReady: this.workerReady, visible: this.visibleAtZoom(this.zoom), basemapHidden: this.basemapHidden,
      cells, pending: Object.fromEntries(this.pending), queued: this.installQueue.length, triangles, geometryMB: +(bytes / 1048576).toFixed(1),
      reliefTiles: this.store.reliefTileCount, decks: this.ready ? this.store.surface.decks.length : 0, surfaceRevision: this.surfaceRevision,
      built: this.stats.cellsBuilt, buildMsMedian: median(this.stats.buildMs), installMsMedian: median(this.stats.installMs), lastBuild: this.stats.lastBuild,
      downloadedKB: Object.fromEntries(Object.entries(this.store.loadedBytes).map(([k, v]) => [k, Math.round(v / 1024)])),
      overlays: Object.fromEntries(Object.entries(this.overlays).map(([k, m]) => [k, m ? m.geometry.index.count / 3 : 0])),
      errors: this.stats.errors.slice(-5),
    };
  }
}
