/** Appearance delivery on the existing city grid. Source geometry is never clipped.
 * Halo entries are references for adjacency/acquisition, never extra render owners.
 * This module does not promote observations or convert model proposals to truth.
 */
import { BUILDING_TILE_ZOOM, planTiles, type Bounds } from './buildingTileSource.js';
import { ringCentroid, polygonsOf, type FootprintGeometry } from './buildingGeometry.js';
import { tileFor, tileKey, tilesCovering } from './slippyTiles.js';

export type AppearanceBuilding<G = unknown> = {
  id: string;
  geometryRevision: string;
  footprint: FootprintGeometry; // Full geographic footprint, never viewport-clipped.
  geometry: G;
};
export type AppearanceObservation<O = unknown> = {
  id: string;
  buildingId: string;
  geometryRevision: string;
  evidenceKey: string;
  payload: O;
};
export type AppearanceTile<G = unknown, O = unknown> = {
  version: 1;
  key: string;
  owners: (AppearanceBuilding<G> & { observations: AppearanceObservation<O>[] })[];
  halo: { buildingId: string; geometryRevision: string; ownerTile: string }[];
};

/** Matches build-lod1-tiles.ts: first exterior centroid. Identity is the source
 * ID, not tile/order/centroid. A new geometry revision may move ownership. */
export function appearanceOwner(building: AppearanceBuilding, zoom = BUILDING_TILE_ZOOM): string {
  const polygons = polygonsOf(building.footprint);
  const ring = polygons[0]?.[0];
  if (!ring || ring.length < 4) throw new Error(`Missing closed footprint: ${building.id}`);
  for (const polygon of polygons) for (const points of polygon) {
    if (points.length < 4 || points[0][0] !== points[points.length - 1][0] || points[0][1] !== points[points.length - 1][1]) {
      throw new Error(`Unclosed footprint: ${building.id}`);
    }
    for (const [lng, lat] of points) {
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 85.0511) {
        throw new Error(`Non-geographic footprint: ${building.id}`);
      }
    }
  }
  return tileKey(tileFor(...ringCentroid(ring), zoom));
}

export function compileAppearanceTiles<G, O>(
  buildings: AppearanceBuilding<G>[], observations: AppearanceObservation<O>[],
  options: { zoom?: number; halo?: number } = {}
): { version: 1; zoom: number; tiles: AppearanceTile<G, O>[]; buildings: number; observations: number } {
  const zoom = options.zoom ?? BUILDING_TILE_ZOOM;
  const halo = options.halo ?? 1;
  if (!Number.isInteger(zoom) || zoom < 0 || zoom > 22 || !Number.isInteger(halo) || halo < 0 || halo > 2) {
    throw new Error('Invalid tile zoom or halo');
  }
  const byId = new Map<string, AppearanceBuilding<G>>();
  for (const building of buildings) {
    if (!building.id || !building.geometryRevision || byId.has(building.id)) throw new Error(`Invalid/duplicate building: ${building.id}`);
    byId.set(building.id, building);
  }
  const records = new Map<string, AppearanceObservation<O>[]>();
  const observationIds = new Set<string>();
  for (const record of observations) {
    const building = byId.get(record.buildingId);
    if (!record.id || observationIds.has(record.id)) throw new Error(`Invalid/duplicate observation: ${record.id}`);
    if (!building || record.geometryRevision !== building.geometryRevision || !record.evidenceKey) {
      throw new Error(`Unbound observation: ${record.id}`);
    }
    observationIds.add(record.id);
    const group = records.get(record.buildingId) ?? [];
    group.push(record); records.set(record.buildingId, group);
  }
  const tiles = new Map<string, AppearanceTile<G, O>>();
  const ensure = (key: string): AppearanceTile<G, O> => {
    let tile = tiles.get(key);
    if (!tile) { tile = { version: 1, key, owners: [], halo: [] }; tiles.set(key, tile); }
    return tile;
  };
  for (const building of [...buildings].sort((a, b) => a.id.localeCompare(b.id))) {
    const ownerTile = appearanceOwner(building, zoom);
    ensure(ownerTile).owners.push({ ...building, observations: (records.get(building.id) ?? []).sort((a, b) => a.id.localeCompare(b.id)) });
    const points = polygonsOf(building.footprint).flatMap(polygon => polygon[0]);
    const bounds = points.reduce((b, [lng, lat]) => ({
      west: Math.min(b.west, lng), east: Math.max(b.east, lng),
      south: Math.min(b.south, lat), north: Math.max(b.north, lat),
    }), { west: Infinity, east: -Infinity, south: Infinity, north: -Infinity });
    // Include the whole footprint plus halo, not only the owner's eight neighbours.
    for (const tile of tilesCovering(bounds, zoom, halo)) {
      const key = tileKey(tile);
      if (key !== ownerTile) ensure(key).halo.push({ buildingId: building.id, geometryRevision: building.geometryRevision, ownerTile });
    }
  }
  return { version: 1, zoom, tiles: [...tiles.values()].sort((a, b) => a.key.localeCompare(b.key)), buildings: buildings.length, observations: observations.length };
}

/** Return dependencies needed to render visible halo buildings. Callers feed
 * these back into their bounded nearest-first fetch queue, not Promise.all. */
export function appearanceOwnerDependencies(tiles: AppearanceTile[], resident: Iterable<string>): string[] {
  const held = new Set(resident);
  return [...new Set(tiles.flatMap(tile => tile.halo.map(ref => ref.ownerTile)))].filter(key => !held.has(key)).sort();
}

export const planAppearanceTiles = (bounds: Bounds, held: Iterable<string>, budget = 24) =>
  planTiles(bounds, held, { zoom: BUILDING_TILE_ZOOM, margin: 1, budget });

export type AppearanceLod = 'massing' | 'facade' | 'detail';
/** 15 m hysteresis prevents geometry churn while driving near a threshold. */
export function appearanceLod(distanceM: number, previous?: AppearanceLod): AppearanceLod {
  if (!Number.isFinite(distanceM) || distanceM < 0) throw new Error('Invalid camera distance');
  if (previous === 'detail' && distanceM <= 95) return 'detail';
  if (previous === 'massing' && distanceM >= 235) return 'massing';
  if (distanceM < (previous === 'facade' ? 65 : 80)) return 'detail';
  if (distanceM > (previous === 'facade' ? 265 : 250)) return 'massing';
  return 'facade';
}

/** Strict resident resource cap. The renderer owns resource creation and passes
 * a release callback disposing its GPU geometry/materials on replacement/eviction.
 * Protect required tiles; if all slots are protected, decline adoption rather
 * than briefly allocating an unbounded working set. Fetchers must check capacity
 * before constructing expensive render resources. */
export class AppearanceResourceCache<T> {
  private readonly entries = new Map<string, T>();
  constructor(readonly budget: number, private readonly release: (value: T, key: string) => void) {
    if (!Number.isInteger(budget) || budget < 1) throw new Error('Invalid resource budget');
  }
  get keys(): string[] { return [...this.entries.keys()]; }
  get size(): number { return this.entries.size; }
  get(key: string): T | undefined { return this.entries.get(key); }
  touch(key: string): void {
    if (!this.entries.has(key)) return;
    const entry = this.entries.get(key)!;
    this.entries.delete(key); this.entries.set(key, entry);
  }
  canAdopt(key: string, protectedKeys: ReadonlySet<string> = new Set()): boolean {
    return this.entries.has(key) || this.entries.size < this.budget || this.keys.some(k => !protectedKeys.has(k));
  }
  adopt(key: string, value: T, protectedKeys: ReadonlySet<string> = new Set()): boolean {
    if (this.entries.get(key) === value && this.entries.has(key)) { this.touch(key); return true; }
    if (!this.canAdopt(key, protectedKeys)) return false; // Caller still owns declined value.
    if (this.entries.has(key)) this.drop(key);
    else if (this.entries.size >= this.budget) this.drop(this.keys.find(k => !protectedKeys.has(k))!);
    this.entries.set(key, value);
    return true;
  }
  drop(key: string): void {
    if (!this.entries.has(key)) return;
    const value = this.entries.get(key)!;
    this.entries.delete(key);
    this.release(value, key);
  }
  clear(): void { for (const key of this.keys) this.drop(key); }
}
