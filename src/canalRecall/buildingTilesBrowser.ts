/**
 * Stream the complete LoD1 city into a MapLibre GeoJSON source.
 *
 * The decision logic — which tiles a viewport needs, what to evict — is in
 * `buildingTileSource.ts` and is tested without a browser. This is the part
 * that talks to the network and to MapLibre, kept thin on purpose.
 *
 * Load order matters for the first turn: the tile under the camera must win
 * the bandwidth race against its neighbours. Starting every wanted fetch with
 * `Promise.all` shared the pipe evenly, so a fat corner tile often landed
 * before the centre and the player spawned into a hole. Fetches now run with
 * a small concurrency limit, nearest-first, and are aborted when the camera
 * leaves them behind (the Damrak default view must not keep downloading once
 * the route start jumps elsewhere).
 *
 * It is deliberately safe to run before the tiles exist. The complete city is
 * ~16 MB of gzipped tiles published into the versioned extract as a reviewed
 * decision, so until that happens the index is absent, `available` stays false,
 * and the caller keeps whatever source it already had. That is why the probe is
 * a single request for the index rather than an assumption.
 */

import {
  BuildingTileCache, BUILDING_TILE_ZOOM, planTiles, tileUrl,
  type BuildingFeature, type Bounds
} from './buildingTileSource.js';
import { tileFor, tileKey } from './slippyTiles.js';

type GeoJsonSource = { setData(data: unknown): void };
type MapLike = {
  getSource(id: string): GeoJsonSource | undefined;
  getBounds(): { getWest(): number; getSouth(): number; getEast(): number; getNorth(): number };
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
  on(event: string, handler: () => void): void;
};

/** How many building tiles may download at once. Two keeps the pipe busy
 *  without starving the camera tile the way an unbounded `Promise.all` did. */
export const BUILDING_TILE_LOAD_CONCURRENCY = 2;

/** Decompress a published `.geojson.gz` tile into a FeatureCollection. */
async function readGzippedGeoJson(response: Response): Promise<{ features?: BuildingFeature[] }> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const gzipped = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!gzipped) {
    return JSON.parse(new TextDecoder().decode(bytes)) as { features?: BuildingFeature[] };
  }
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('gzip building tiles need DecompressionStream');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(stream).text();
  return JSON.parse(text) as { features?: BuildingFeature[] };
}

export class BuildingTileStreamer {
  private readonly cache = new BuildingTileCache();
  /** Tiles that returned nothing. Remembered so a gap is not refetched forever. */
  private readonly empty = new Set<string>();
  /** In-flight fetches, keyed so a camera jump can abort the ones we no longer want. */
  private readonly controllers = new Map<string, AbortController>();
  /** Nearest-first remaining work for the current plan. */
  private queue: ReturnType<typeof planTiles>['load'] = [];
  private inFlight = 0;
  private onFirstBuildings?: () => void;
  private onFeatures?: (features: BuildingFeature[]) => void;
  private available = false;
  private disposed = false;
  /** Last camera signature we planned for — avoids re-planning every jumpTo frame. */
  private lastFollowSignature = '';
  /** Coalesce adopts into one setData per animation frame. Two tiles finishing
   *  in the same frame used to each deep-clone the resident set and hitch. */
  private flushDirty = false;
  private flushScheduled = false;
  /** Keep the pipe to one tile until the camera tile has landed, then open up. */
  private firstTileLanded = false;

  constructor(
    private readonly map: MapLike,
    private readonly sourceId: string,
    private readonly baseUrl: string,
    private readonly zoom = BUILDING_TILE_ZOOM
  ) {}

  /**
   * Is the complete city published? Resolves false when it is not, and the
   * caller should leave its existing source alone.
   *
   * This reads the index and checks that it *is* the index, rather than
   * trusting the status code. Both this project's dev server and most static
   * hosts answer an unknown path with the app's own `index.html` and a 200, so
   * `response.ok` on a HEAD request is true whether or not the city exists.
   * Believing it is not a cosmetic mistake: the caller would hide the basemap's
   * extrusion, every tile fetch would return HTML, every parse would fail, and
   * the player would drive through a city with no buildings in it at all.
   */
  async probe(): Promise<boolean> {
    this.available = false;
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/building-tiles/index-z${this.zoom}.json`);
      if (!response.ok) return false;
      const index = (await response.json()) as { zoom?: number; tileList?: unknown };
      this.available = index.zoom === this.zoom && Array.isArray(index.tileList) && index.tileList.length > 0;
    } catch {
      // A JSON parse error here is the expected shape of "not published":
      // the host handed back a page instead of the index.
      this.available = false;
    }
    return this.available;
  }

  /**
   * Follow the camera. Safe to call on every `moveend` and from the game
   * `sync` loop when the centre tile or zoom bucket changes.
   *
   * Does **not** load on attach by itself: the MapLibre style boots centred on
   * Damrak, and fetching that neighbourhood before the route start is known
   * steals the pipe from the tile under the player.
   *
   * `onFirstBuildings` fires once, when a tile has actually been parsed and
   * carried buildings. The caller uses it to hide the basemap's own extrusion,
   * which must not happen a moment earlier: hiding it on the strength of a
   * successful probe alone would leave an empty map if the tiles turned out to
   * be unreadable.
   *
   * `onFeatures` fires whenever the resident set changes, so procedural roofs
   * can track the same working set as the extrusions.
   */
  attach(onFirstBuildings?: () => void, onFeatures?: (features: BuildingFeature[]) => void): void {
    if (!this.available) return;
    this.onFirstBuildings = onFirstBuildings;
    this.onFeatures = onFeatures;
    this.map.on('moveend', () => this.followCamera());
  }

  /**
   * Re-plan when the camera's centre tile or half-step zoom changes.
   * Called from `vector-map.sync` so the first driving frame targets the
   * start point, not the style's default centre.
   */
  followCamera(): void {
    if (!this.available || this.disposed) return;
    const centre = this.map.getCenter();
    const tile = tileFor(centre.lng, centre.lat, this.zoom);
    const zoomBucket = Math.round(this.map.getZoom() * 2) / 2;
    const signature = `${tileKey(tile)}@${zoomBucket}`;
    if (signature === this.lastFollowSignature) return;
    this.lastFollowSignature = signature;
    this.update();
  }

  dispose(): void {
    this.disposed = true;
    for (const controller of this.controllers.values()) controller.abort();
    this.controllers.clear();
    this.queue = [];
  }

  private bounds(): Bounds {
    const bounds = this.map.getBounds();
    return { west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() };
  }

  private update(): void {
    if (!this.available || this.disposed) return;
    const plan = planTiles(this.bounds(), this.cache.heldKeys, { zoom: this.zoom });
    const wantedKeys = new Set(plan.wanted);

    let changed = false;
    for (const key of plan.evict) {
      this.cache.drop(key);
      changed = true;
    }

    // Drop in-flight work the camera no longer needs so a Damrak prefetch
    // cannot keep eating bandwidth after the start jump.
    for (const [key, controller] of this.controllers) {
      if (wantedKeys.has(key)) continue;
      controller.abort();
      this.controllers.delete(key);
    }

    const inFlightKeys = new Set(this.controllers.keys());
    this.queue = plan.load.filter((tile) => {
      const key = tileKey(tile);
      return !this.empty.has(key) && !this.cache.has(key) && !inFlightKeys.has(key);
    });

    if (changed) this.scheduleFlush();
    this.pump();
  }

  private pump(): void {
    const limit = this.firstTileLanded ? BUILDING_TILE_LOAD_CONCURRENCY : 1;
    while (
      !this.disposed
      && this.inFlight < limit
      && this.queue.length > 0
    ) {
      const tile = this.queue.shift();
      if (!tile) break;
      void this.fetchTile(tile);
    }
  }

  private async fetchTile(tile: ReturnType<typeof planTiles>['load'][number]): Promise<void> {
    const key = tileKey(tile);
    if (this.cache.has(key) || this.empty.has(key) || this.controllers.has(key)) return;

    const controller = new AbortController();
    this.controllers.set(key, controller);
    this.inFlight++;
    try {
      const response = await fetch(tileUrl(tile, this.baseUrl), { signal: controller.signal });
      if (!response.ok) {
        // Most of the 382 tiles cover water, parks or the edge of the
        // region. A missing one is ordinary, not an error worth retrying.
        this.empty.add(key);
        return;
      }
      const collection = await readGzippedGeoJson(response);
      if (controller.signal.aborted || this.disposed) return;
      // MapLibre's GeoJSON source tiles and may rewrite rings in place.
      // Pyramidal roofs need the original closed footprint, so keep our own
      // copy of coordinates before `setData`.
      const features: BuildingFeature[] = (collection.features ?? []).map((feature) => ({
        type: 'Feature',
        properties: { ...(feature.properties || {}) },
        geometry: feature.geometry && JSON.parse(JSON.stringify(feature.geometry)),
      }));
      this.cache.adopt(key, features);
      this.firstTileLanded = true;
      if (!this.disposed) this.scheduleFlush();
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      this.empty.add(key);
    } finally {
      this.controllers.delete(key);
      this.inFlight = Math.max(0, this.inFlight - 1);
      this.pump();
    }
  }

  /** Ask for a flush on the next animation frame; repeated calls coalesce. */
  private scheduleFlush(): void {
    this.flushDirty = true;
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    const run = () => {
      this.flushScheduled = false;
      if (!this.flushDirty || this.disposed) return;
      this.flushDirty = false;
      this.flush();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else queueMicrotask(run);
  }

  private flush(): void {
    const collection = this.cache.collection();
    this.onFeatures?.(collection.features);
    // Deep-clone for MapLibre: the GeoJSON source may rewrite rings in place.
    // Coalescing via scheduleFlush keeps this to once per frame during a burst.
    this.map.getSource(this.sourceId)?.setData(JSON.parse(JSON.stringify(collection)));
    if (collection.features.length > 0 && this.onFirstBuildings) {
      const announce = this.onFirstBuildings;
      this.onFirstBuildings = undefined;
      announce();
    }
  }

  /** For diagnostics: how much of the city is resident right now. */
  status(): { tiles: number; features: number; inFlight: number; available: boolean; queued: number } {
    return {
      tiles: this.cache.size,
      features: this.cache.collection().features.length,
      inFlight: this.inFlight,
      available: this.available,
      queued: this.queue.length,
    };
  }
}
