// Nested building footprints z-fight.
//
// The streamed extract sometimes describes one building twice: an OSM outline
// and the `building:part`s inside it, or a BAG pand and an OSM way drawn over
// it. Wherever the two share a wall, both extrusions put a face in the same
// plane and the renderer picks a different winner per pixel: the striping on
// Oosterdokskade and the Muziekgebouw (user reports 2026-09-28). About 4% of
// features in the city-centre tiles sit inside another with overlapping
// heights.
//
// Dropping either copy would lose geometry (a podium, a courtyard, a taller
// part). Instead the inner building's footprint is pulled in by a few tens of
// centimetres, which separates every shared wall, and when the two roofs are
// within a hair of each other the inner roof drops just below the outer one.
// At game scale neither change is visible.

import type { BuildingFeature } from './buildingTileSource.js';

type Position = [number, number];
type Ring = Position[];

export const NESTED_INSET_METRES = 0.35;
export const NESTED_ROOF_GAP_METRES = 0.3;
/** How far outside the outer footprint an inner vertex may sit and still count as inside. */
const EDGE_TOLERANCE_METRES = 0.6;
/** Share of the inner footprint's vertices that must lie inside the outer one. */
const CONTAINED_SHARE = 0.8;
const METRES_PER_DEGREE = 111_320;

type Entry = {
  feature: BuildingFeature;
  rings: Ring[];
  box: [number, number, number, number];
  base: number;
  top: number;
};

function outerRings(geometry: unknown): Ring[] {
  const shape = geometry as { type?: string; coordinates?: unknown } | null;
  if (!shape || !Array.isArray(shape.coordinates)) return [];
  if (shape.type === 'Polygon') return [(shape.coordinates as Ring[])[0]].filter(Boolean);
  if (shape.type === 'MultiPolygon') return (shape.coordinates as Ring[][]).map(polygon => polygon[0]).filter(Boolean);
  return [];
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function pointInRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function metresToRing(x: number, y: number, ring: Ring, kx: number): number {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = (ring[j][0] - x) * kx, ay = (ring[j][1] - y) * METRES_PER_DEGREE;
    const bx = (ring[i][0] - x) * kx, by = (ring[i][1] - y) * METRES_PER_DEGREE;
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + dx * t, ay + dy * t));
  }
  return best;
}

/** Is every footprint of `inner` (all but a few vertices) inside `outer`? */
function containedIn(inner: Entry, outer: Entry): boolean {
  let inside = 0, total = 0;
  for (const ring of inner.rings) {
    const kx = METRES_PER_DEGREE * Math.cos((ring[0]?.[1] ?? 52) * Math.PI / 180);
    for (const [x, y] of ring) {
      total++;
      if (outer.rings.some(o => pointInRing(x, y, o) || metresToRing(x, y, o, kx) <= EDGE_TOLERANCE_METRES)) inside++;
    }
  }
  return total > 0 && inside / total >= CONTAINED_SHARE;
}

function insetRing(ring: Ring, metres: number): Ring {
  const closed = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  const open = closed ? ring.slice(0, -1) : ring;
  if (open.length < 3) return ring;
  let cx = 0, cy = 0;
  for (const [x, y] of open) { cx += x; cy += y; }
  cx /= open.length; cy /= open.length;
  const kx = METRES_PER_DEGREE * Math.cos(cy * Math.PI / 180);
  const moved: Ring = open.map(([x, y]) => {
    const dx = (cx - x) * kx, dy = (cy - y) * METRES_PER_DEGREE;
    const distance = Math.hypot(dx, dy);
    if (distance < 1e-6) return [x, y];
    // Never pull a vertex more than a fifth of the way to the centre.
    const step = Math.min(metres, distance * 0.2) / distance;
    return [x + (cx - x) * step, y + (cy - y) * step];
  });
  return closed ? [...moved, moved[0]] : moved;
}

function insetGeometry(geometry: unknown, metres: number): unknown {
  const shape = geometry as { type: string; coordinates: Ring[] | Ring[][] };
  if (shape.type === 'Polygon') {
    const [outer, ...holes] = shape.coordinates as Ring[];
    return { ...shape, coordinates: [insetRing(outer, metres), ...holes] };
  }
  return {
    ...shape,
    coordinates: (shape.coordinates as Ring[][]).map(([outer, ...holes]) => [insetRing(outer, metres), ...holes]),
  };
}

/**
 * Separate buildings nested inside another building's footprint. Returns a new
 * array; features that are not nested are passed through untouched. Only the
 * copies this returns are changed; the input is not mutated.
 */
export function separateNestedBuildings(
  features: readonly BuildingFeature[],
  options: { insetMetres?: number; roofGapMetres?: number } = {},
): BuildingFeature[] {
  const insetMetres = options.insetMetres ?? NESTED_INSET_METRES;
  const roofGap = options.roofGapMetres ?? NESTED_ROOF_GAP_METRES;
  const entries: Array<Entry | null> = features.map(feature => {
    const rings = outerRings(feature.geometry).filter(ring => ring.length >= 4);
    if (!rings.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const ring of rings) for (const [x, y] of ring) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const base = numberOr(feature.properties?.minHeight, 0);
    const top = numberOr(feature.properties?.height, base + 5);
    return { feature, rings, box: [minX, minY, maxX, maxY], base, top };
  });

  // Grid of footprints so each one only meets its neighbours.
  const cell = 0.0005;
  const grid = new Map<string, number[]>();
  entries.forEach((entry, index) => {
    if (!entry) return;
    const [x0, y0, x1, y1] = entry.box;
    for (let gx = Math.floor(x0 / cell); gx <= Math.floor(x1 / cell); gx++) {
      for (let gy = Math.floor(y0 / cell); gy <= Math.floor(y1 / cell); gy++) {
        const key = `${gx},${gy}`;
        const bucket = grid.get(key);
        if (bucket) bucket.push(index); else grid.set(key, [index]);
      }
    }
  });

  const out = features.slice();
  const tolerance = EDGE_TOLERANCE_METRES / METRES_PER_DEGREE * 2;
  entries.forEach((inner, index) => {
    if (!inner) return;
    const [x0, y0, x1, y1] = inner.box;
    const seen = new Set<number>();
    let outer: Entry | null = null;
    for (let gx = Math.floor(x0 / cell); gx <= Math.floor(x1 / cell) && !outer; gx++) {
      for (let gy = Math.floor(y0 / cell); gy <= Math.floor(y1 / cell) && !outer; gy++) {
        for (const other of grid.get(`${gx},${gy}`) ?? []) {
          if (other === index || seen.has(other)) continue;
          seen.add(other);
          const candidate = entries[other]!;
          const [ox0, oy0, ox1, oy1] = candidate.box;
          if (x0 < ox0 - tolerance || y0 < oy0 - tolerance || x1 > ox1 + tolerance || y1 > oy1 + tolerance) continue;
          if (Math.min(inner.top, candidate.top) <= Math.max(inner.base, candidate.base)) continue;
          if (!containedIn(inner, candidate)) continue;
          // Two copies of one footprint: inset only one of them, the lower
          // (then the lower id), or both would shrink and still meet.
          const mutual = x0 <= ox0 + tolerance && y0 <= oy0 + tolerance && x1 >= ox1 - tolerance && y1 >= oy1 - tolerance
            && containedIn(candidate, inner);
          if (mutual) {
            const innerId = String(inner.feature.properties?.id ?? '');
            const otherId = String(candidate.feature.properties?.id ?? '');
            const innerYields = inner.top < candidate.top || (inner.top === candidate.top && innerId > otherId);
            if (!innerYields) continue;
          }
          outer = candidate;
        }
      }
    }
    if (!outer) return;
    const properties: Record<string, unknown> = { ...(inner.feature.properties ?? {}), nestedInset: true };
    if (Math.abs(inner.top - outer.top) < roofGap) {
      const lowered = outer.top - roofGap;
      if (lowered > inner.base + 0.5) properties.height = lowered;
    }
    out[index] = { ...inner.feature, properties, geometry: insetGeometry(inner.feature.geometry, insetMetres) };
  });
  return out;
}
