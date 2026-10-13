/**
 * An in-memory join index over BAG-keyed base tiles: pand id -> footprint and
 * OSM aliases, OSM id -> pands, and a coarse spatial grid.
 *
 * Used by the covers builder and checker (build time) and by the unit tests;
 * the browser reads tiles through `buildingTilesBrowser` instead and never
 * needs the reverse maps.
 */
import { ringCentroid, type Ring } from './buildingLadder.js';
import { isPandId } from './bagTiles.js';

export type IndexedPand = { id: string; rings: Ring[]; centroid: [number, number]; osm: string[] };
type TileFeatureLike = { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } | null };

export type BagPandIndex = {
  pands: Map<string, IndexedPand>;
  /** Feature ids of OSM-only outlines (no pand under them) the tiles still draw. */
  osmOnly: Set<string>;
  osmToPands: Map<string, string[]>;
  cells: Map<string, IndexedPand[]>;
};

const CELL = 0.002;
const cellKey = (x: number, y: number): string => `${x}/${y}`;

export function outerRings(geometry: TileFeatureLike['geometry']): Ring[] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [(geometry.coordinates as Ring[])[0]];
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates as Ring[][]).map(polygon => polygon[0]);
  return [];
}

export function emptyIndex(): BagPandIndex {
  return { pands: new Map(), osmOnly: new Set(), osmToPands: new Map(), cells: new Map() };
}

export function addFeatures(index: BagPandIndex, features: readonly TileFeatureLike[]): void {
  for (const feature of features) {
    const id = String(feature.properties.id ?? '');
    if (!id) continue;
    if (!isPandId(id)) { index.osmOnly.add(id); continue; }
    const rings = outerRings(feature.geometry).filter(Boolean);
    if (!rings.length) continue;
    const prior = index.pands.get(id);
    if (prior) { prior.rings.push(...rings); continue; } // a MultiPolygon split over tiles never happens (centroid ownership), but be safe
    const osm = Array.isArray(feature.properties.osm) ? (feature.properties.osm as unknown[]).map(String) : [];
    const pand: IndexedPand = { id, rings, centroid: ringCentroid(rings[0]) as [number, number], osm };
    index.pands.set(id, pand);
    for (const alias of osm) {
      const list = index.osmToPands.get(alias);
      if (list) list.push(id); else index.osmToPands.set(alias, [id]);
    }
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const ring of rings) for (const [x, y] of ring) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
    for (let cx = Math.floor(w / CELL); cx <= Math.floor(e / CELL); cx++) {
      for (let cy = Math.floor(s / CELL); cy <= Math.floor(n / CELL); cy++) {
        const key = cellKey(cx, cy);
        const bucket = index.cells.get(key);
        if (bucket) bucket.push(pand); else index.cells.set(key, [pand]);
      }
    }
  }
}

/** Pands whose cells meet a lng/lat box (may include pands just outside; callers test). */
export function nearbyPands(index: BagPandIndex, bounds: { w: number; s: number; e: number; n: number }): IndexedPand[] {
  const found = new Set<IndexedPand>();
  for (let cx = Math.floor(bounds.w / CELL); cx <= Math.floor(bounds.e / CELL); cx++) {
    for (let cy = Math.floor(bounds.s / CELL); cy <= Math.floor(bounds.n / CELL); cy++) {
      for (const pand of index.cells.get(cellKey(cx, cy)) ?? []) found.add(pand);
    }
  }
  return [...found];
}

export type ResolvedSuppress = {
  /** Pand ids the list hides today because the id IS the tile feature id. */
  direct: string[];
  /** Pands reached only through an OSM alias: today these hide nothing, covers will hide them. */
  viaAlias: string[];
  /** Pands = direct + viaAlias. */
  pands: string[];
  /** Ids of OSM-only outlines the tiles draw (hidden today by exact id). */
  osmOnly: string[];
  /** Ids that match no tile feature and no alias (stale). */
  unresolved: string[];
};

export function resolveSuppressed(index: BagPandIndex, ids: Iterable<string>): ResolvedSuppress {
  const direct = new Set<string>(), viaAlias = new Set<string>(), osmOnly = new Set<string>(), unresolved = new Set<string>();
  for (const raw of ids) {
    const id = String(raw);
    if (index.pands.has(id)) { direct.add(id); continue; }
    if (index.osmOnly.has(id)) { osmOnly.add(id); continue; }
    const aliased = index.osmToPands.get(id);
    if (aliased?.length) { for (const pand of aliased) viaAlias.add(pand); continue; }
    unresolved.add(id);
  }
  for (const id of direct) viaAlias.delete(id);
  return {
    direct: [...direct], viaAlias: [...viaAlias], pands: [...direct, ...viaAlias],
    osmOnly: [...osmOnly], unresolved: [...unresolved],
  };
}
