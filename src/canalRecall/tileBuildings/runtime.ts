/**
 * TileBuildings: the near tier of the recipe tiles (`?recipeTiles=1`), grown from buildingTypes/runtime.ts.
 *
 * One participant in the shared frame (rendererShared/sharedFrame.ts; `?recipeTiles=1` implies `?sharedFrame=1`, as
 * `?ownGround=1` does). Its root space is Mercator; each resident z16 tile is a group whose matrix is
 * `mercatorFromTile` (tiles.ts), holding:
 *   - the tile's merged uniques: one Mesh per city-look variant, the one shared city-look material (look/cityLook.ts),
 *     `layer`/`tint` attributes from the file, a `hidden` attribute this runtime owns (1 hide, 2 highlight per pand);
 *   - one InstancedMesh per (unit, unit primitive) it uses, matrices = instance TRS × the unit node's transform,
 *     sharing the unit's geometry and material with every other tile (units are refcounted, freed at zero).
 * Residency: the 2×2 block of z16 tiles around the camera centre (tiles.ts `nearBlock`, hysteresis a quarter tile).
 * A tile counts as drawn only once its units are in; from then on its pands' covers are hidden in the mid/far layers
 * (host.setHidden → the facade layer's `hidden = 1`, which both facade shaders have) and the legacy specs it replaces
 * are withheld from the landmark loader (host.setReplacedSpecs) — no suppression lists.
 * Frustum culling is three.js's, per mesh (InstancedMesh bounds cover their instances).
 * Picking: `pandRanges` (geometry.userData, from primitive extras) on merged meshes, the instance's `_PAND` on instances.
 *
 * Pure helpers (tile selection, refcounts, ranges) are exported for node tests; THREE and the loader are injected.
 */
import {fullPandId} from '../bagTiles.ts';
import type {MeshIndex, MeshTileMeta} from './schema.ts';
import {mercatorFromTile, nearBlock, tileFrame, tileId, type TileKey} from './tiles.ts';

export const RECIPE_TILES_PARAM = 'recipeTiles';
/** `?recipeTiles=1` (or `window.__canalRecallRecipeTiles = true`). */
export function recipeTilesEnabled(search?: string): boolean {
  try {
    const g = globalThis as any;
    if (search === undefined && g.__canalRecallRecipeTiles === true) return true;
    return new URLSearchParams(search ?? g.location?.search ?? '').get(RECIPE_TILES_PARAM) === '1';
  } catch { return false; }
}

export interface IndexFile extends MeshIndex { specs?: Record<string, string> }

/** Tiles wanted near a point: the 2×2 block, restricted to tiles the index publishes. */
export function wantedTiles(index: IndexFile, at: {lng: number; lat: number}, previous: {x: number; y: number} | null): {block: {x: number; y: number}; tiles: string[]} {
  const b = nearBlock(at.lng, at.lat, 16, previous);
  return {block: {x: b.x, y: b.y}, tiles: b.tiles.map(tileId).filter(id => !!index.tiles[id])};
}

/** Reference-counted async resources (units shared by tiles). `release` frees at zero. */
export class RefCache<T> {
  private items = new Map<string, {refs: number; promise: Promise<T>; value?: T}>();
  constructor(private load: (key: string) => Promise<T>, private free: (value: T, key: string) => void) {}
  acquire(key: string): Promise<T> {
    let item = this.items.get(key);
    if (!item) {
      const entry: {refs: number; promise: Promise<T>; value?: T} = {refs: 0, promise: null as any};
      entry.promise = this.load(key).then(v => (entry.value = v));
      this.items.set(key, item = entry);
      item.promise.catch(() => this.items.delete(key));
    }
    item.refs++;
    return item.promise;
  }
  release(key: string): void {
    const item = this.items.get(key);
    if (!item) return;
    if (--item.refs > 0) return;
    this.items.delete(key);
    if (item.value !== undefined) this.free(item.value, key);
    else item.promise.then(v => this.free(v, key), () => {});
  }
  get size(): number { return this.items.size; }
  refs(key: string): number { return this.items.get(key)?.refs ?? 0; }
}

/** Pand index of a triangle of a merged mesh (`pandRanges` = [[pand, firstTriangle, count], ...]). */
export function pandOfFace(ranges: readonly (readonly number[])[] | undefined, faceIndex: number | undefined): number {
  if (!ranges || faceIndex === undefined) return -1;
  for (const [pand, first, count] of ranges) if (faceIndex >= first && faceIndex < first + count) return pand;
  return -1;
}

/** Per pand: the vertices its triangles use (welded per pand by the writer, so no vertex is shared between pands). */
export function pandVertices(index: ArrayLike<number>, ranges: readonly (readonly number[])[]): Map<number, Uint32Array> {
  const out = new Map<number, Uint32Array>();
  for (const [pand, first, count] of ranges) {
    const set = new Set<number>();
    for (let k = first * 3; k < (first + count) * 3; k++) set.add(index[k]);
    out.set(pand, Uint32Array.from([...set].sort((a, b) => a - b)));
  }
  return out;
}

/** Ids to hide in the mid/far layers for the drawn tiles. */
export function coverUnion(metas: Iterable<MeshTileMeta>): string[] {
  const out = new Set<string>();
  for (const m of metas) for (const list of m.covers) for (const id of list) out.add(id);
  return [...out].sort();
}

export interface TileBuildingsHost {
  THREE: any;
  /** The shared frame (rendererShared SharedFrame). */
  frame: any;
  /** Base URL of the published data (index.json, building-mesh/, units/). */
  baseUrl: string;
  /** GLTFLoader.loadAsync with the meshopt decoder set. */
  loadGltf(url: string): Promise<any>;
  getCentre(): {lng: number; lat: number} | null | undefined;
  /** Hide these ids in the mid/far layers (replace the previous set). False when the target is not there yet. */
  setHidden(ids: string[]): boolean | void;
  /** Landmark/chunk spec ids the near tier draws now (the landmark loader withholds them). */
  setReplacedSpecs?(ids: Set<string>): void;
  repaint(): void;
  /** Draw lit under the frame's rig (default true; the shared frame is lit). */
  lit?: boolean;
  /** The page's city look (look/cityLook.ts getCityLook(THREE)). */
  cityLook: any;
}

interface UnitMesh { geometry: any; material: any; local: any; triangles: number; city: boolean }
interface TileState {
  id: string; meta: MeshTileMeta; group: any; ready: boolean; disposed: boolean;
  merged: {mesh: any; ranges: number[][]; verts: Map<number, Uint32Array>}[];
  instanced: {unit: string; matrices: Float32Array; pands: Int32Array; meshes: any[]; stub: any}[];
  triangles: number;
}

const HIDE = 1, HIGHLIGHT = 2;

export class TileBuildings {
  readonly root: any;
  index: IndexFile | null = null;
  private tiles = new Map<string, TileState>();
  private block: {x: number; y: number} | null = null;
  private units: RefCache<UnitMesh[]>;
  private unregister: (() => void) | null = null;
  private clipFromWorld: any = null;
  private highlighted = new Set<string>();
  private lastHidden = '';
  private pendingHidden = false;
  private lastCheck = 0;
  private revisionN = 0;
  private loading = 0;
  readonly errors: string[] = [];

  constructor(private host: TileBuildingsHost) {
    const THREE = host.THREE;
    this.root = new THREE.Group();
    this.root.name = 'recipe-tiles';
    this.units = new RefCache(hash => this.loadUnit(hash), list => { for (const u of list) u.geometry.dispose(); });
  }

  /** Fetch the index and join the frame. */
  async start(order = 21): Promise<boolean> {
    const res = await fetch(new URL('index.json', this.host.baseUrl).href, {cache: 'no-cache'});
    if (!res.ok) throw Error(`recipe tiles index ${res.status}`);
    this.index = await res.json();
    this.unregister = this.host.frame.register('recipe-tiles', {
      root: this.root,
      beforeRender: (ctx: any) => { this.clipFromWorld = ctx.clipFromWorld; this.update(); return this.root.children.length > 0; },
      revision: () => this.revisionN,
    }, {order});
    this.update(true);
    return true;
  }

  /** Re-select tiles (cheap; throttled to 4 Hz unless forced). */
  update(force = false): void {
    if (!this.index) return;
    const now = performance.now();
    if (!force && now - this.lastCheck < 250) { if (this.pendingHidden) this.syncHidden(); return; }
    this.lastCheck = now;
    const c = this.host.getCentre();
    if (!c) return;
    const {block, tiles} = wantedTiles(this.index, c, this.block);
    this.block = block;
    const want = new Set(tiles);
    for (const id of want) if (!this.tiles.has(id)) this.loadTile(id);
    // Drop tiles that left the block only once every wanted tile is drawn (no hole while the new ones arrive).
    const allReady = [...want].every(id => this.tiles.get(id)?.ready);
    if (allReady) for (const [id, t] of this.tiles) if (!want.has(id)) this.dropTile(t);
    if (this.pendingHidden) this.syncHidden();
  }

  private async loadTile(id: string): Promise<void> {
    const THREE = this.host.THREE;
    const state: TileState = {id, meta: null as any, group: new THREE.Group(), ready: false, disposed: false, merged: [], instanced: [], triangles: 0};
    this.tiles.set(id, state);
    this.loading++;
    try {
      const gltf = await this.host.loadGltf(new URL(`building-mesh/${id}.glb`, this.host.baseUrl).href);
      if (state.disposed) return;
      state.meta = gltf.userData?.recipeTile;
      if (!state.meta) throw Error(`${id}: no recipeTile extras`);
      const [z, x, y] = state.meta.tile, frame = tileFrame({z, x, y} as TileKey);
      state.group.name = `recipe-tile/${id}`;
      state.group.matrixAutoUpdate = false;
      state.group.matrix.fromArray(mercatorFromTile(frame));
      gltf.scene.updateMatrixWorld(true);
      const look = this.host.cityLook, lit = this.host.lit !== false;
      const stubs: any[] = [];
      gltf.scene.traverse((o: any) => { if (o.isMesh) stubs.push(o); });
      for (const o of stubs) {
        if (o.isInstancedMesh) {
          const pandAttr = o.geometry.getAttribute('_PAND'), n = o.count, pands = new Int32Array(n), matrices = new Float32Array(n * 16);
          for (let i = 0; i < n; i++) pands[i] = Math.round(pandAttr.getX(i));
          const m = new THREE.Matrix4(), world = o.matrixWorld;
          for (let i = 0; i < n; i++) { o.getMatrixAt(i, m); m.premultiply(world); m.toArray(matrices, i * 16); }
          // The stub draws until the unit arrives.
          const stub = new THREE.InstancedMesh(o.geometry, o.material, n);
          for (let i = 0; i < n; i++) stub.setMatrixAt(i, m.fromArray(matrices, i * 16));
          stub.name = `stub/${o.userData.unit}`;
          state.group.add(stub);
          state.instanced.push({unit: o.userData.unit, matrices, pands, meshes: [], stub});
          continue;
        }
        const g = o.geometry;
        this.cityAttributes(g);
        const ranges: number[][] = g.userData?.pandRanges ?? [];
        g.setAttribute('hidden', new THREE.BufferAttribute(new Uint8Array(g.getAttribute('position').count), 1, false));
        const side = o.material?.side ?? THREE.FrontSide, uv = o.material?.userData?.cityLook?.uv ?? 'uv';
        const mesh = new THREE.Mesh(g, look.material({lit, kind: 'slot', uv, side}));
        mesh.name = `recipe-tile/${id}/uniques`;
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(o.matrixWorld);
        mesh.userData.recipeTile = {tile: id, ranges};
        this.host.frame.constructor.setShadows?.(mesh, true, true);
        state.group.add(mesh);
        state.merged.push({mesh, ranges, verts: pandVertices(g.index.array, ranges)});
        state.triangles += g.index.count / 3;
      }
      this.root.add(state.group);
      this.revisionN++;
      this.host.repaint();
      // Units (shared, refcounted).
      await Promise.all(state.instanced.map(async inst => {
        const unit = await this.units.acquire(inst.unit);
        if (state.disposed) { this.units.release(inst.unit); return; }
        for (const u of unit) {
          const mesh = new THREE.InstancedMesh(u.geometry, u.material, inst.pands.length), m = new THREE.Matrix4();
          for (let i = 0; i < inst.pands.length; i++) mesh.setMatrixAt(i, m.fromArray(inst.matrices, i * 16).multiply(u.local));
          mesh.name = `recipe-tile/${id}/unit/${inst.unit}`;
          mesh.userData.recipeTile = {tile: id, pands: inst.pands};
          mesh.computeBoundingSphere(); mesh.computeBoundingBox();
          this.host.frame.constructor.setShadows?.(mesh, true, true);
          state.group.add(mesh);
          inst.meshes.push(mesh);
          state.triangles += u.triangles * inst.pands.length;
        }
        state.group.remove(inst.stub);
        inst.stub.dispose?.();
      }));
      if (state.disposed) return;
      state.ready = true;
      this.applyHighlight(state);
      this.pendingHidden = true;
      this.revisionN++;
      this.host.repaint();
    } catch (error) {
      this.errors.push(String((error as Error)?.message ?? error));
      console.warn(`Recipe tile ${id} unavailable; the mid/far layers keep drawing it.`, error);
      this.tiles.delete(id);
      state.group.parent?.remove(state.group);
    } finally {
      this.loading--;
    }
  }

  /** GLTFLoader names unknown attributes in lower case: `_layer`/`_tint` → the city look's `layer`/`tint`. */
  private cityAttributes(g: any): void {
    for (const [from, to] of [['_layer', 'layer'], ['_tint', 'tint'], ['_LAYER', 'layer'], ['_TINT', 'tint']]) {
      const a = g.getAttribute(from);
      if (a) { g.setAttribute(to, a); g.deleteAttribute(from); }
    }
  }

  private async loadUnit(hash: string): Promise<UnitMesh[]> {
    const THREE = this.host.THREE, look = this.host.cityLook, lit = this.host.lit !== false;
    const gltf = await this.host.loadGltf(new URL(`units/${hash}.glb`, this.host.baseUrl).href);
    gltf.scene.updateMatrixWorld(true);
    const out: UnitMesh[] = [];
    gltf.scene.traverse((o: any) => {
      if (!o.isMesh) return;
      const city = !!o.material?.userData?.cityLook;
      if (city) this.cityAttributes(o.geometry);
      const material = city ? look.material({lit, kind: 'slot', uv: o.material.userData.cityLook.uv ?? 'uv', side: o.material.side}) : o.material;
      out.push({geometry: o.geometry, material, local: o.matrixWorld.clone(), triangles: (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3, city});
    });
    return out;
  }

  private dropTile(t: TileState): void {
    t.disposed = true;
    this.tiles.delete(t.id);
    t.group.parent?.remove(t.group);
    for (const m of t.merged) m.mesh.geometry.dispose();
    for (const inst of t.instanced) {
      for (const mesh of inst.meshes) mesh.dispose?.();
      inst.stub?.geometry?.dispose?.();
      if (inst.meshes.length) this.units.release(inst.unit);
    }
    this.pendingHidden = true;
    this.revisionN++;
  }

  /** Push covers and replaced specs of the drawn (ready) tiles to the host. */
  private syncHidden(): void {
    const ready = [...this.tiles.values()].filter(t => t.ready);
    const ids = coverUnion(ready.map(t => t.meta)), key = ids.join(',');
    if (key !== this.lastHidden) {
      if (this.host.setHidden(ids) === false) return; // retry next update
      this.lastHidden = key;
    }
    this.host.setReplacedSpecs?.(new Set(ready.flatMap(t => t.meta.specs)));
    this.pendingHidden = false;
  }

  /** Highlight (the quiz answer) by pand id: merged pands through `hidden = 2`, instances through a highlight copy. */
  setHighlighted(ids: Iterable<string | number>): void {
    this.highlighted = new Set([...ids].map(id => fullPandId(String(id))));
    for (const t of this.tiles.values()) if (t.ready) this.applyHighlight(t);
    this.host.repaint();
  }

  private applyHighlight(t: TileState): void {
    const THREE = this.host.THREE, look = this.host.cityLook;
    const on = (pand: number) => this.highlighted.has(fullPandId(t.meta.pands[pand])) || t.meta.covers[pand].some(id => this.highlighted.has(id));
    for (const m of t.merged) {
      const attr = m.mesh.geometry.getAttribute('hidden');
      let changed = false;
      for (const [pand, verts] of m.verts) {
        const v = on(pand) ? HIGHLIGHT : 0;
        if (attr.array[verts[0]] === v) continue;
        for (const i of verts) attr.array[i] = v;
        changed = true;
      }
      if (changed) attr.needsUpdate = true;
    }
    const zero = new THREE.Matrix4().makeScale(0, 0, 0), m4 = new THREE.Matrix4();
    for (const inst of t.instanced) for (const mesh of inst.meshes) {
      for (const h of mesh.userData.highlights ?? []) mesh.parent?.remove(h);
      mesh.userData.highlights = [];
      const saved: Map<number, any> = mesh.userData.saved ??= new Map();
      for (let i = 0; i < inst.pands.length; i++) {
        // The true matrix: saved while the instance is collapsed for its highlight copy.
        if (saved.has(i)) m4.copy(saved.get(i)); else mesh.getMatrixAt(i, m4);
        if (on(inst.pands[i])) {
          const copy = new THREE.Mesh(mesh.geometry, mesh.material?.userData?.cityVariant ? look.highlighted(mesh.material, true) : highlightMaterial(THREE, mesh.material));
          copy.matrixAutoUpdate = false; copy.matrix.copy(m4); copy.name = 'recipe-tile/highlight';
          mesh.parent.add(copy); mesh.userData.highlights.push(copy);
          saved.set(i, m4.clone());
          mesh.setMatrixAt(i, zero);
        } else if (saved.has(i)) {
          mesh.setMatrixAt(i, saved.get(i)); saved.delete(i);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** The pand under a screen point (CSS pixels of the map canvas), nearest first, or null. */
  inspectAtScreen(x: number, y: number, width: number, height: number): {id: string; name: string; depth: number; lngLat: [number, number]; recipeTile: string} | null {
    const THREE = this.host.THREE;
    if (!this.clipFromWorld || !width || !height || !this.root.children.length) return null;
    const nx = x / width * 2 - 1, ny = 1 - y / height * 2, inverse = this.clipFromWorld.clone().invert();
    const near = new THREE.Vector3(nx, ny, -1).applyMatrix4(inverse), far = new THREE.Vector3(nx, ny, 1).applyMatrix4(inverse);
    this.root.updateWorldMatrix(true, true);
    const ray = new THREE.Raycaster(near, far.sub(near).normalize());
    for (const hit of ray.intersectObject(this.root, true)) {
      const info = hit.object.userData?.recipeTile, t = info && this.tiles.get(info.tile);
      if (!t?.ready || !hit.object.visible) continue;
      const pand = info.ranges ? pandOfFace(info.ranges, hit.faceIndex) : info.pands?.[hit.instanceId ?? -1] ?? -1;
      if (pand < 0) continue;
      const depth = hit.point.clone().applyMatrix4(this.clipFromWorld).z;
      if (depth < -1 || depth > 1) continue;
      const key = t.meta.pands[pand];
      const merc = hit.point.clone().applyMatrix4(this.root.matrixWorld.clone().invert());
      const lngLat = mercToLngLat(merc.x, merc.y);
      return {id: /^\d{16}$/.test(key) ? fullPandId(key) : key, name: t.meta.names[pand] ?? key, depth, lngLat, recipeTile: t.id};
    }
    return null;
  }

  stats() {
    let draws = 0, triangles = 0, instances = 0;
    for (const t of this.tiles.values()) {
      triangles += t.triangles;
      for (const m of t.merged) if (m.mesh.visible) draws++;
      for (const i of t.instanced) { draws += i.meshes.length || 1; instances += i.pands.length; }
    }
    return {tiles: [...this.tiles.keys()].sort(), ready: [...this.tiles.values()].filter(t => t.ready).length, loading: this.loading, units: this.units.size,
      draws, triangles, instances, hidden: this.lastHidden ? this.lastHidden.split(',').length : 0, errors: this.errors.slice(-5)};
  }

  dispose(): void {
    for (const t of [...this.tiles.values()]) this.dropTile(t);
    this.host.setHidden([]);
    this.host.setReplacedSpecs?.(new Set());
    this.unregister?.();
  }
}

function mercToLngLat(x: number, y: number): [number, number] {
  const lng = x * 360 - 180, y2 = 180 - y * 360;
  return [lng, (360 / Math.PI) * Math.atan(Math.exp((y2 * Math.PI) / 180)) - 90];
}

const highlightCache = new WeakMap<any, any>();
function highlightMaterial(THREE: any, m: any): any {
  let h = highlightCache.get(m);
  if (!h) { h = new THREE.MeshLambertMaterial({color: 0xffd21f, emissive: 0x6b5400, side: m?.side ?? THREE.FrontSide}); highlightCache.set(m, h); }
  return h;
}
