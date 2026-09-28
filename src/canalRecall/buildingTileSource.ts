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
  /** Every tile key the camera currently needs (held or not). */
  wanted: string[];
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
 *
 * `load` is sorted nearest-to-camera first. The browser streamer must honour
 * that order with a bounded concurrency — firing every fetch at once shares
 * the pipe evenly and the centre tile loses to fatter neighbours.
 */
export function planTiles(
  bounds: Bounds,
  held: Iterable<string>,
  options: { zoom?: number; margin?: number; budget?: number } = {}
): TilePlan {
  const zoom = options.zoom ?? BUILDING_TILE_ZOOM;
  const margin = options.margin ?? MARGIN_TILES;
  const budget = options.budget ?? DEFAULT_BUDGET;

  const wantedTiles = tilesCovering(bounds, zoom, margin);
  const wanted = wantedTiles.map(tileKey);
  const wantedKeys = new Set(wanted);
  const heldKeys = new Set(held);

  const [centreLng, centreLat] = centreOf(bounds);
  const centreTile = tilesCovering({ west: centreLng, south: centreLat, east: centreLng, north: centreLat }, zoom)[0];

  const load = wantedTiles
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

  return { load, evict, wanted };
}

/** Where a tile lives, relative to the extract directory. */
export const tileUrl = (tile: TileId, base: string): string =>
  `${base.replace(/\/$/, '')}/building-tiles/${tile.z}/${tile.x}/${tile.y}.geojson.gz`;

export type BuildingFeature = { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown };

/**
 * The loaded tiles, as the one FeatureCollection MapLibre draws.
 *
 * The collection is still the source of truth, but MapLibre is now fed diffs
 * (`planSourceDiff`): re-sending tens of thousands of features on every tile
 * arrival was a ~130 ms spike on a throttled phone. The diff works on whole
 * adopted tiles only, so a tile that fails to load is simply never adopted and
 * never appears in one; the streamer falls back to a full `setData` whenever
 * a diff cannot be applied.
 */
export class BuildingTileCache {
  private readonly tiles = new Map<string, BuildingFeature[]>();
  private list: BuildingFeature[] | null = null;

  get heldKeys(): string[] { return [...this.tiles.keys()]; }
  get size(): number { return this.tiles.size; }
  has(key: string): boolean { return this.tiles.has(key); }

  adopt(key: string, features: BuildingFeature[]): void { this.tiles.set(key, features); this.list = null; }
  drop(key: string): void { if (this.tiles.delete(key)) this.list = null; }

  /** The resident tiles by key, for diffing against what MapLibre holds. */
  entries(): ReadonlyMap<string, BuildingFeature[]> { return this.tiles; }

  /** Every resident feature. Concatenated once per change, not per call: the
   *  camera-clearance check asks for it every 8 m of travel. */
  collection(): { type: 'FeatureCollection'; features: BuildingFeature[] } {
    if (!this.list) {
      const features: BuildingFeature[] = [];
      for (const tile of this.tiles.values()) features.push(...tile);
      this.list = features;
    }
    return { type: 'FeatureCollection', features: this.list };
  }
}

export type SourceDiffPlan = {
  /** Promoted ids to remove from the GeoJSON source. */
  removeIds: string[];
  /** Tiles whose features must be added (whole tiles, in resident order). */
  addTiles: string[];
};

/**
 * What to send MapLibre to go from the tiles it holds to the resident tiles.
 *
 * `published` maps each tile MapLibre holds to the feature array it was sent,
 * so a tile evicted and re-fetched between flushes (a new array under the same
 * key) is replaced rather than assumed current. Ids come from `idOf`; building
 * ids are unique across the whole tile set (342 993 of 342 993 in the
 * Amsterdam extract), which is what makes removal by id safe.
 */
export function planSourceDiff(
  published: ReadonlyMap<string, readonly BuildingFeature[]>,
  resident: ReadonlyMap<string, readonly BuildingFeature[]>,
  idOf: (feature: BuildingFeature) => string,
): SourceDiffPlan {
  const removeIds: string[] = [];
  const addTiles: string[] = [];
  for (const [key, features] of published) {
    if (resident.get(key) === features) continue;
    for (const feature of features) removeIds.push(idOf(feature));
  }
  for (const [key, features] of resident) {
    if (published.get(key) !== features) addTiles.push(key);
  }
  return { removeIds, addTiles };
}

type Ring = ReadonlyArray<readonly [number, number]>;

function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function outerRings(geometry: unknown): Ring[] {
  const shape = geometry as { type?: string; coordinates?: unknown } | null;
  if (!shape || !Array.isArray(shape.coordinates)) return [];
  if (shape.type === 'Polygon') return [(shape.coordinates as Ring[])[0]].filter(Boolean);
  if (shape.type === 'MultiPolygon') return (shape.coordinates as Ring[][]).map(polygon => polygon[0]).filter(Boolean);
  return [];
}

/** Metres from a point to a ring's edges, in a local equirectangular frame. */
function metresToRing(lng: number, lat: number, ring: Ring): number {
  const kx = 111_320 * Math.cos(lat * Math.PI / 180), ky = 111_320;
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = (ring[j][0] - lng) * kx, ay = (ring[j][1] - lat) * ky;
    const bx = (ring[i][0] - lng) * kx, by = (ring[i][1] - lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + dx * t, ay + dy * t));
  }
  return best;
}

export type LandmarkBuildingQuery = {
  lng: number;
  lat: number;
  /** OSM way id, when the landmark itself is mapped as a building way. */
  wayId?: string | null;
  /** How far outside a footprint an entrance-node landmark may sit. */
  maxMetres?: number;
};

/**
 * The resident building a landmark card is about (user reports 2026-09-28,
 * "why don't I see that museum on my screen highlighted?"). In order:
 * - the landmark's own OSM way, when it is mapped as the building;
 * - the footprint containing its point (a node inside the building, e.g. Bimhuis);
 * - the nearest footprint within `maxMetres` (a node at the entrance, on
 *   the pavement, e.g. the Sexmuseum).
 * Only 11 of 420 landmark points fell inside a footprint, which is why the
 * other two steps exist.
 */
export function buildingForLandmark(
  features: readonly BuildingFeature[], query: LandmarkBuildingQuery,
  idOf: (feature: BuildingFeature) => string,
): string | null {
  const { lng, lat, wayId, maxMetres = 10 } = query;
  const padLng = maxMetres / (111_320 * Math.cos(lat * Math.PI / 180)), padLat = maxMetres / 111_320;
  let nearest: string | null = null, nearestMetres = maxMetres;
  for (const feature of features) {
    const id = idOf(feature);
    if (wayId && id === wayId) return id;
    for (const ring of outerRings(feature.geometry)) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [x, y] of ring) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      if (lng < minX - padLng || lng > maxX + padLng || lat < minY - padLat || lat > maxY + padLat) continue;
      if (pointInRing(lng, lat, ring)) {
        if (!wayId) return id || null;
        nearest = id; nearestMetres = 0;
        continue;
      }
      if (nearestMetres === 0) continue;
      const metres = metresToRing(lng, lat, ring);
      if (metres < nearestMetres) { nearest = id; nearestMetres = metres; }
    }
  }
  return nearest || null;
}
