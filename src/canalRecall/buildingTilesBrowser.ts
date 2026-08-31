/**
 * Stream the complete LoD1 city into a MapLibre GeoJSON source.
 *
 * The decision logic — which tiles a viewport needs, what to evict — is in
 * `buildingTileSource.ts` and is tested without a browser. This is the part
 * that talks to the network and to MapLibre, kept thin on purpose.
 *
 * It is deliberately safe to run before the tiles exist. The complete city is
 * 15 MB of generated data that gets published into the versioned extract as a
 * reviewed decision, so until that happens the index is absent, `available`
 * stays false, and the caller keeps whatever source it already had. That is why
 * the probe is a single request for the index rather than an assumption.
 */

import {
  BuildingTileCache, BUILDING_TILE_ZOOM, planTiles, tileUrl,
  type BuildingFeature, type Bounds
} from './buildingTileSource.js';
import { tileKey } from './slippyTiles.js';

type GeoJsonSource = { setData(data: unknown): void };
type MapLike = {
  getSource(id: string): GeoJsonSource | undefined;
  getBounds(): { getWest(): number; getSouth(): number; getEast(): number; getNorth(): number };
  on(event: string, handler: () => void): void;
};

export class BuildingTileStreamer {
  private readonly cache = new BuildingTileCache();
  /** Tiles that returned nothing. Remembered so a gap is not refetched forever. */
  private readonly empty = new Set<string>();
  private inFlight = 0;
  private available = false;
  private disposed = false;

  constructor(
    private readonly map: MapLike,
    private readonly sourceId: string,
    private readonly baseUrl: string,
    private readonly zoom = BUILDING_TILE_ZOOM
  ) {}

  /**
   * Is the complete city published? Resolves false when it is not, and the
   * caller should leave its existing source alone.
   */
  async probe(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/building-tiles/index-z${this.zoom}.json`, { method: 'HEAD' });
      this.available = response.ok;
    } catch {
      this.available = false;
    }
    return this.available;
  }

  /** Follow the camera. Safe to call on every `moveend`. */
  attach(): void {
    if (!this.available) return;
    this.map.on('moveend', () => { void this.update(); });
    void this.update();
  }

  dispose(): void { this.disposed = true; }

  private bounds(): Bounds {
    const bounds = this.map.getBounds();
    return { west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() };
  }

  async update(): Promise<void> {
    if (!this.available || this.disposed) return;
    const plan = planTiles(this.bounds(), this.cache.heldKeys, { zoom: this.zoom });

    let changed = false;
    for (const key of plan.evict) { this.cache.drop(key); changed = true; }

    // Nearest tile first, so the ground under the camera fills in before its
    // corners. Requests run in parallel but the source is only rewritten when
    // one lands, which keeps a slow corner tile from holding up the centre.
    const wanted = plan.load.filter(tile => !this.empty.has(tileKey(tile)));
    await Promise.all(wanted.map(async tile => {
      const key = tileKey(tile);
      if (this.cache.has(key)) return;
      this.inFlight++;
      try {
        const response = await fetch(tileUrl(tile, this.baseUrl));
        if (!response.ok) {
          // Most of the 382 tiles cover water, parks or the edge of the
          // region. A missing one is ordinary, not an error worth retrying.
          this.empty.add(key);
          return;
        }
        const collection = (await response.json()) as { features?: BuildingFeature[] };
        this.cache.adopt(key, collection.features ?? []);
        if (!this.disposed) this.flush();
      } catch {
        this.empty.add(key);
      } finally {
        this.inFlight--;
      }
    }));

    if (changed && !this.disposed) this.flush();
  }

  private flush(): void {
    this.map.getSource(this.sourceId)?.setData(this.cache.collection());
  }

  /** For diagnostics: how much of the city is resident right now. */
  status(): { tiles: number; features: number; inFlight: number; available: boolean } {
    return {
      tiles: this.cache.size,
      features: this.cache.collection().features.length,
      inFlight: this.inFlight,
      available: this.available
    };
  }
}
