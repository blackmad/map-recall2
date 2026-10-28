/**
 * Open pedestrian squares as rideable surface.
 *
 * The rideable surface is the union of street corridors around centrelines.
 * `osm-loader.js` drops every closed ring (they are area outlines, not
 * centrelines), so an open plaza is only rideable along the strips that its
 * crossing ways leave. On the Dam and the Leidseplein the bike was blocked in
 * the middle of open paving (feedback 636a57f4 and 638590e9, 2026-10-25).
 *
 * The source is `squares.json` (`place=square` / plaza polygons, 85 entries,
 * 70 with a closed ring). The routing extract's closed `highway=pedestrian`
 * rings are not used: a closed pedestrian way without `area=yes` is a loop
 * walk around a block, and the extract does not keep the `area` tag, so those
 * rings would open up building blocks and courtyards.
 *
 * A point counts as on the plaza when it is inside a ring and at least
 * `PLAZA_EDGE_INSET_METRES` from its edge. `place=square` outlines trace the
 * building line, so the inset keeps the bike's centre off the facades; the
 * corridor guard still owns the strips along the streets.
 */

import { PAVED_LINKS } from './pavedLinks.ts';

export interface PlazaPoint { x: number; y: number }

export interface PlazaFeature {
  name?: string;
  path?: Array<[number, number]>;
  paths?: Array<Array<[number, number]>>;
}

export interface Plaza {
  name: string;
  ring: PlazaPoint[];
  minX: number; minY: number; maxX: number; maxY: number;
}

export interface PlazaIndex {
  plazas: Plaza[];
  /** Edge inset in world units. */
  inset: number;
}

/** Half a bike length: the rider's centre stays this far off the outline. */
export const PLAZA_EDGE_INSET_METRES = 1.5;

/**
 * Smaller rings are slivers or mapping fragments (Dors 25 m², Geerdinkhof
 * 99 m²), not squares one rides across. The smallest kept is Menno Simons
 * Plein, 306 m².
 */
export const PLAZA_MIN_AREA_M2 = 250;

/**
 * Squares that are gardens rather than paving. Name endings are Dutch for
 * garden (plantsoen), churchyard (kerkhof), memorial and court (hof); the set
 * holds squares that are mostly lawn (Frederiksplein is a park around the
 * fountain; Museumplein's centre is a lawn; Cantaplein is 100% inside a
 * park-landscape polygon, measured 2026-10-26).
 */
export const GREEN_SQUARE_NAME = /(plantsoen|kerkhof|monument|hof)$/i;
export const GREEN_SQUARES: ReadonlySet<string> = new Set(['Frederiksplein', 'Museum Square', 'Museumplein', 'Cantaplein']);

const isClosedRing = (path: ReadonlyArray<[number, number]>): boolean => path.length > 3
  && path[0][0] === path[path.length - 1][0] && path[0][1] === path[path.length - 1][1];

/** Ring area in square metres for a `[lat, lon]` ring. */
export function ringAreaSquareMetres(path: ReadonlyArray<[number, number]>): number {
  const lat0 = path[0][0] * Math.PI / 180;
  const ky = 111_320;
  const kx = 111_320 * Math.cos(lat0);
  let twice = 0;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    twice += path[j][1] * kx * path[i][0] * ky - path[i][1] * kx * path[j][0] * ky;
  }
  return Math.abs(twice / 2);
}

export function isRideablePlaza(feature: PlazaFeature, path: ReadonlyArray<[number, number]>): boolean {
  const name = (feature.name || '').trim();
  if (GREEN_SQUARES.has(name) || GREEN_SQUARE_NAME.test(name)) return false;
  return isClosedRing(path) && ringAreaSquareMetres(path) >= PLAZA_MIN_AREA_M2;
}

/**
 * Project the rideable squares into world space. `project` takes `[lat, lon]`
 * and returns the same world point the road segments use. The curated paved
 * links (pavedLinks.ts) are indexed with them unless `links` says otherwise.
 */
export function buildPlazaIndex(
  features: readonly PlazaFeature[],
  project: (lat: number, lon: number) => PlazaPoint,
  worldUnitsPerMetre: number,
  links: readonly PlazaFeature[] = PAVED_LINKS,
): PlazaIndex {
  const plazas: Plaza[] = [];
  for (const feature of [...(features || []), ...links]) {
    const paths = feature.paths || (feature.path ? [feature.path] : []);
    for (const path of paths) {
      if (!path || !isRideablePlaza(feature, path)) continue;
      const ring = path.map(([lat, lon]) => project(lat, lon));
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of ring) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      plazas.push({ name: feature.name || '', ring, minX, minY, maxX, maxY });
    }
  }
  return { plazas, inset: PLAZA_EDGE_INSET_METRES * worldUnitsPerMetre };
}

function insideRing(ring: readonly PlazaPoint[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function edgeDistance(ring: readonly PlazaPoint[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2)) : 0;
    const d = Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
    if (d < best) best = d;
  }
  return best;
}

/** The rideable square under (x, y), or null. */
export function plazaAt(index: PlazaIndex | null | undefined, x: number, y: number): Plaza | null {
  if (!index) return null;
  for (const plaza of index.plazas) {
    if (x < plaza.minX || x > plaza.maxX || y < plaza.minY || y > plaza.maxY) continue;
    if (insideRing(plaza.ring, x, y) && edgeDistance(plaza.ring, x, y) >= index.inset) return plaza;
  }
  return null;
}

/**
 * The guard contact on a square: the nearest corridor's contact, reported as
 * on its centreline so the guard neither rolls back nor eases the heading.
 * Its point stays on the corridor, so an unwedge walk still heads for asphalt.
 */
export function plazaGuardContact<T extends { dist: number; width: number }>(
  contact: T | null,
  index: PlazaIndex | null | undefined,
  x: number,
  y: number,
): T | null {
  if (!contact || contact.dist <= contact.width) return contact;
  return plazaAt(index, x, y) ? { ...contact, dist: 0 } : contact;
}
