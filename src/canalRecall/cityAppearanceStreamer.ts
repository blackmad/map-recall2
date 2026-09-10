/** Host-ready city appearance transport. Uses the existing z14 city grid and
 * nearest-first planning, but gives GPU resources a hard resident budget.
 * This is not a publication gate: render adapters must apply the existing
 * field-level evidence policy; a transported proposal is not an approved fact.
 */
import { planTiles, type Bounds } from './buildingTileSource.js';
import { ringCentroid, polygonsOf } from './buildingGeometry.js';
import { tileKey, tilesCovering } from './slippyTiles.js';
import {
  AppearanceResourceCache, appearanceLod, appearanceOwner, type AppearanceTile, type AppearanceLod,
} from './cityAppearanceTiles.js';

export type AppearanceCamera = { bounds: Bounds; longitude: number; latitude: number };
export type AppearanceTileResource = {
  setLod(buildingId: string, lod: AppearanceLod): void;
  dispose(): void;
};
export type AppearanceStreamOptions<G, O> = {
  index: { version: number; zoom: number; tileList: string[] };
  loadTile(key: string, signal: AbortSignal): Promise<AppearanceTile<G, O>>;
  /** Only owners are passed: halo references never become duplicate meshes. */
  createResource(owners: AppearanceTile<G, O>['owners']): AppearanceTileResource;
  budget?: number;
  concurrency?: number;
  onError?: (key: string, error: unknown) => void;
  /** Multiplies camera distance before LOD selection; >1 reduces far-area detail. */
  lodDistanceMultiplier?: number;
};
type Entry<G, O> = { tile: AppearanceTile<G, O>; resource: AppearanceTileResource | null; lods: Map<string, AppearanceLod> };

export class CityAppearanceStreamer<G = unknown, O = unknown> {
  private readonly cache: AppearanceResourceCache<Entry<G, O>>;
  private readonly published: Set<string>;
  private readonly controllers = new Map<string, AbortController>();
  private readonly failed = new Set<string>();
  private readonly visibleDependencies = new Map<string, string[]>();
  private readonly waiters: (() => void)[] = [];
  private camera: AppearanceCamera | null = null;
  private wanted = new Set<string>();
  private queue: string[] = [];
  private inFlight = 0;
  private disposed = false;
  private constrained = false;
  private readonly concurrency: number;

  constructor(private readonly options: AppearanceStreamOptions<G, O>) {
    if (options.index.version !== 1 || !Number.isInteger(options.index.zoom) || options.index.zoom<0 || options.index.zoom>22 || !Array.isArray(options.index.tileList)) throw new Error('Unsupported appearance index');
    this.published = new Set(options.index.tileList);
    if (this.published.size !== options.index.tileList.length || [...this.published].some(key => !new RegExp(`^${options.index.zoom}/\\d+/\\d+$`).test(key))) throw new Error('Invalid appearance index keys');
    this.concurrency = options.concurrency ?? 2;
    if (!Number.isInteger(this.concurrency) || this.concurrency < 1 || this.concurrency > 8) throw new Error('Invalid appearance concurrency');
    if(!Number.isFinite(options.lodDistanceMultiplier??1)||(options.lodDistanceMultiplier??1)<.25||(options.lodDistanceMultiplier??1)>4)throw new Error('Invalid LOD distance multiplier');
    this.cache = new AppearanceResourceCache(options.budget ?? 24, entry => entry.resource?.dispose());
  }

  get status() {
    return { resident: this.cache.size, residentKeys: this.cache.keys, inFlight: this.inFlight, queued: this.queue.length, failed: [...this.failed], budgetConstrained: this.constrained, disposed: this.disposed };
  }

  update(camera: AppearanceCamera): void {
    if (this.disposed) return;
    const { bounds, longitude, latitude } = camera;
    if (![longitude, latitude, bounds.west, bounds.south, bounds.east, bounds.north].every(Number.isFinite)
      || bounds.east < bounds.west || bounds.north < bounds.south || Math.abs(longitude) > 180 || Math.abs(latitude) > 85.0511
      || bounds.west < -180 || bounds.east > 180 || bounds.south < -85.0511 || bounds.north > 85.0511) throw new Error('Invalid appearance camera');
    // Reject a world-size detailed viewport before enumerating millions of tiles.
    // The host must use its existing city massing layer at overview scale.
    if (bounds.east - bounds.west > 1 || bounds.north - bounds.south > 1) throw new Error('Appearance viewport needs massing-only overview');
    this.camera = structuredClone(camera);
    this.replan();
    this.refreshLods();
    this.pump();
  }

  /** Explicit retry avoids a failing tile being requested on every animation frame. */
  retryFailed(): void { this.failed.clear(); if (this.camera && !this.disposed) { this.replan(); this.pump(); } }

  private replan(): void {
    if (!this.camera) return;
    const { bounds } = this.camera;
    const base = planTiles(bounds, [], { zoom: this.options.index.zoom, margin: 1, budget: this.cache.budget }).load.map(tileKey).filter(key => this.published.has(key));
    const visible = tilesCovering(bounds, this.options.index.zoom).map(tileKey);
    // Read dependencies only from viewport tiles. Expanding every halo owner's
    // own halo recursively would eventually request the whole city.
    for (const key of this.visibleDependencies.keys()) if (!visible.includes(key)) this.visibleDependencies.delete(key);
    for (const key of visible) {
      const entry = this.cache.get(key);
      if (entry) this.visibleDependencies.set(key, entry.tile.halo.map(ref => ref.ownerTile));
    }
    // Retain discovered references even if a tiny budget evicts the reference
    // tile itself; forgetting them would ping-pong between it and its owner.
    const dependencies = visible.flatMap(key => this.visibleDependencies.get(key) ?? []).filter(key => this.published.has(key));
    const all = [...new Set([...dependencies, ...base])];
    this.constrained = all.length > this.cache.budget;
    this.wanted = new Set(all.slice(0, this.cache.budget));
    for (const [key, controller] of this.controllers) if (!this.wanted.has(key)) controller.abort();
    for (const key of this.wanted) this.cache.touch(key);
    this.queue = [...this.wanted].filter(key => !this.cache.get(key) && !this.controllers.has(key) && !this.failed.has(key));
  }

  private pump(): void {
    while (!this.disposed && this.inFlight < this.concurrency && this.queue.length) {
      const key = this.queue.shift()!;
      if (!this.cache.canAdopt(key, this.wanted)) continue;
      void this.fetch(key);
    }
    this.settle();
  }

  private validate(tile: AppearanceTile<G, O>, key: string): void {
    if (tile.version !== 1 || tile.key !== key || !Array.isArray(tile.owners) || !Array.isArray(tile.halo)) throw new Error('Mismatched appearance tile');
    const ids = new Set<string>(), observationIds = new Set<string>();
    for (const owner of tile.owners) {
      if (!owner.id || !owner.geometryRevision || ids.has(owner.id) || appearanceOwner(owner,this.options.index.zoom) !== key) throw new Error(`Invalid appearance owner: ${owner.id}`);
      ids.add(owner.id);
      for (const observation of owner.observations) {
        if (!observation.id || observationIds.has(observation.id) || observation.buildingId !== owner.id || observation.geometryRevision !== owner.geometryRevision || !observation.evidenceKey) throw new Error(`Unbound appearance observation: ${observation.id}`);
        observationIds.add(observation.id);
      }
    }
    const haloIds = new Set<string>();
    for (const ref of tile.halo) {
      if (!ref.buildingId || !ref.geometryRevision || ref.ownerTile === key || !this.published.has(ref.ownerTile) || ids.has(ref.buildingId) || haloIds.has(ref.buildingId)) throw new Error(`Invalid appearance halo: ${ref.buildingId}`);
      haloIds.add(ref.buildingId);
      const ownerTile = this.cache.get(ref.ownerTile)?.tile;
      if (ownerTile && !ownerTile.owners.some(owner => owner.id === ref.buildingId && owner.geometryRevision === ref.geometryRevision)) throw new Error(`Stale appearance halo: ${ref.buildingId}`);
    }
    for (const heldKey of this.cache.keys) {
      for (const ref of this.cache.get(heldKey)!.tile.halo) {
        if (ref.ownerTile === key && !tile.owners.some(owner => owner.id === ref.buildingId && owner.geometryRevision === ref.geometryRevision)) throw new Error(`Stale appearance owner: ${ref.buildingId}`);
      }
    }
  }

  private async fetch(key: string): Promise<void> {
    const controller = new AbortController();
    this.controllers.set(key, controller); this.inFlight++;
    try {
      const tile = await this.options.loadTile(key, controller.signal);
      if (this.disposed || controller.signal.aborted || !this.wanted.has(key)) return;
      this.validate(tile, key);
      if (!this.cache.canAdopt(key, this.wanted)) return;
      const entry: Entry<G, O> = { tile, resource: tile.owners.length ? this.options.createResource(tile.owners) : null, lods: new Map() };
      if (!this.cache.adopt(key, entry, this.wanted)) { entry.resource?.dispose(); return; }
      this.replan(); this.refreshLods();
    } catch (error) {
      if (!controller.signal.aborted && !this.disposed) { this.failed.add(key); this.options.onError?.(key, error); }
    } finally {
      if (this.controllers.get(key) === controller) this.controllers.delete(key);
      this.inFlight--;
      // A camera can leave and return while an aborted fetch is still settling.
      if (!this.disposed) this.replan();
      this.pump();
    }
  }

  private refreshLods(): void {
    if (!this.camera) return;
    const { longitude, latitude } = this.camera;
    const lonM = 111320 * Math.cos(latitude * Math.PI / 180);
    for (const key of this.cache.keys) {
      const entry = this.cache.get(key)!;
      for (const owner of entry.tile.owners) {
        const [lng, lat] = ringCentroid(polygonsOf(owner.footprint)[0][0]);
        const distance = Math.hypot((lng - longitude) * lonM, (lat - latitude) * 111320);
        const next = appearanceLod(distance*(this.options.lodDistanceMultiplier??1), entry.lods.get(owner.id));
        if (entry.lods.get(owner.id) !== next) { entry.resource?.setLod(owner.id, next); entry.lods.set(owner.id, next); }
      }
    }
  }

  /** Resolves when all requested work settles; useful for screenshots and tests. */
  whenIdle(): Promise<void> {
    if (this.inFlight === 0 && this.queue.length === 0) return Promise.resolve();
    return new Promise(resolve => this.waiters.push(resolve));
  }
  private settle(): void { if (this.inFlight === 0 && this.queue.length === 0) for (const resolve of this.waiters.splice(0)) resolve(); }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.queue = [];
    for (const controller of this.controllers.values()) controller.abort();
    this.cache.clear(); this.settle();
  }
}

/** Loader adapter for the compiler's .json.gz staging format. A manifest/index
 * must be verified by the caller before constructing the streamer. */
export function appearanceHttpLoader(baseUrl: string, fetcher: typeof fetch = fetch, expectedHashes?: Readonly<Record<string, string>>) {
  return async (key: string, signal: AbortSignal): Promise<AppearanceTile> => {
    if (!/^14\/\d+\/\d+$/.test(key)) throw new Error('Invalid appearance tile URL');
    const response = await fetcher(`${baseUrl.replace(/\/$/, '')}/${key}.json.gz`, { signal });
    if (!response.ok) throw new Error(`Appearance tile HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (expectedHashes) {
      const expected = expectedHashes[key];
      if (!expected || !/^[a-f0-9]{64}$/.test(expected)) throw new Error(`Missing appearance tile hash: ${key}`);
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const actual = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
      if (actual !== expected) throw new Error(`Appearance tile hash mismatch: ${key}`);
    }
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      return JSON.parse(await new Response(stream).text());
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  };
}
