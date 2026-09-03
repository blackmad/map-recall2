/**
 * Decide which building tiles the camera needs, and hold them.
 *
 * The complete LoD1 city is 382 z14 tiles. A driving camera is over one of
 * them and can see into its neighbours, so the renderer keeps a small working
 * set and swaps it as the car moves. This module is the decision half — which
 * tiles to fetch, which to drop, and what the resulting source should contain —
 * kept separate from fetching so it can be reasoned about without a network or
 * a map.
 *
 * Two things it must get right, both of which show up as visible defects:
 *
 * **Load a margin.** Features are placed in exactly one tile by centroid, so a
 * building near an edge has geometry that reaches into the next tile. Loading
 * only the tiles under the viewport leaves a fringe of missing buildings that
 * appear as the camera crosses a boundary. The margin is why `MARGIN_TILES`
 * exists and why it is not zero.
 *
 * **Do not thrash.** Driving along a tile boundary would otherwise load and
 * evict the same neighbour repeatedly. Eviction keeps a budget rather than
 * dropping everything outside the viewport, so a tile just left stays resident
 * until something else needs the room.
 */

import { tileKey, tilesCovering, type TileId } from './slippyTiles.js';

export type Bounds = { west: number; south: number; east: number; north: number };

/** The zoom the city is cut on. Measured: z13's worst 3x3 block is 6.0 MB gzipped, z14's is 2.4 MB. */
export const BUILDING_TILE_ZOOM = 14;

/** One ring of neighbours. Buildings reach across a boundary; one tile is enough for a footprint. */
export const MARGIN_TILES = 1;

/**
 * How many tiles stay resident. Nine cover the camera and its margin; the rest
 * of the budget is hysteresis, so driving along a boundary does not refetch the
 * tile behind the car every few seconds.
 */
export const DEFAULT_BUDGET = 24;

export type TilePlan = {
  /** Tiles the camera needs that are not held yet, nearest first. */
  load: TileId[];
  /** Keys to drop, furthest from the camera first, to stay inside the budget. */
  evict: string[];
};

const centreOf = (bounds: Bounds): [number, number] =>
  [(bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2];

/**
 * Squared distance from a tile to a point, in tile units.
 *
 * Tile coordinates rather than degrees, because at a fixed zoom they are
 * already square and comparable; converting back to metres to rank neighbours
 * would be arithmetic with no effect on the order.
 */
function tileDistance(tile: TileId, from: TileId): number {
  return (tile.x - from.x) ** 2 + (tile.y - from.y) ** 2;
}

/**
 * What to fetch and what to drop for a viewport.
 *
 * `held` is the set of tile keys currently in memory. The plan never evicts a
 * tile the camera still needs, even when the budget is exceeded — a budget
 * smaller than the visible set is a misconfiguration, and dropping visible
 * geometry to honour it would blink buildings out in front of the player.
 */
export function planTiles(
  bounds: Bounds,
  held: Iterable<string>,
  options: { zoom?: number; margin?: number; budget?: number } = {}
): TilePlan {
  const zoom = options.zoom ?? BUILDING_TILE_ZOOM;
  const margin = options.margin ?? MARGIN_TILES;
  const budget = options.budget ?? DEFAULT_BUDGET;

  const wanted = tilesCovering(bounds, zoom, margin);
  const wantedKeys = new Set(wanted.map(tileKey));
  const heldKeys = new Set(held);

  const [centreLng, centreLat] = centreOf(bounds);
  const centreTile = tilesCovering({ west: centreLng, south: centreLat, east: centreLng, north: centreLat }, zoom)[0];

  const load = wanted
    .filter(tile => !heldKeys.has(tileKey(tile)))
    .sort((a, b) => tileDistance(a, centreTile) - tileDistance(b, centreTile));

  // Evict only what the camera does not need, furthest first, and only enough
  // to get back inside the budget.
  const evictable = [...heldKeys]
    .filter(key => !wantedKeys.has(key))
    .map(key => {
      const [, x, y] = key.split('/').map(Number);
      return { key, distance: tileDistance({ z: zoom, x, y }, centreTile) };
    })
    .sort((a, b) => b.distance - a.distance);

  const overBudget = heldKeys.size + load.length - budget;
  const evict = overBudget > 0 ? evictable.slice(0, Math.min(overBudget, evictable.length)).map(entry => entry.key) : [];

  return { load, evict };
}

/** Where a tile lives, relative to the extract directory. */
export const tileUrl = (tile: TileId, base: string): string =>
  `${base.replace(/\/$/, '')}/building-tiles/${tile.z}/${tile.x}/${tile.y}.geojson.gz`;

export type BuildingFeature = { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown };

/**
 * The loaded tiles, as the one FeatureCollection MapLibre draws.
 *
 * Rebuilt on every change rather than diffed: the working set is a few tens of
 * thousands of features, MapLibre re-parses a GeoJSON source on `setData`
 * anyway, and a diffing scheme would be the kind of cleverness that goes wrong
 * silently when a tile fails to load.
 */
export class BuildingTileCache {
  private readonly tiles = new Map<string, BuildingFeature[]>();

  get heldKeys(): string[] { return [...this.tiles.keys()]; }
  get size(): number { return this.tiles.size; }
  has(key: string): boolean { return this.tiles.has(key); }

  adopt(key: string, features: BuildingFeature[]): void { this.tiles.set(key, features); }
  drop(key: string): void { this.tiles.delete(key); }

  collection(): { type: 'FeatureCollection'; features: BuildingFeature[] } {
    const features: BuildingFeature[] = [];
    for (const tile of this.tiles.values()) features.push(...tile);
    return { type: 'FeatureCollection', features };
  }
}
