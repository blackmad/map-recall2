// Nested building footprints z-fight.
//
// The streamed extract often describes one building twice: an OSM outline and
// the `building:part`s inside it, or a BAG pand and an OSM way drawn over it.
// Wherever the two share a wall, both extrusions put a face in the same plane
// and the renderer picks a different winner per pixel: the striping on
// Oosterdokskade and the Muziekgebouw (user reports 2026-09-28).
//
// A first fix pulled the inner copy in by 0.35 m. At game distance that is
// inside the depth buffer's precision, so the walls still striped, and where
// the inner copy was a little taller it left a ledge round the top of the
// building (user report 2026-09-29). Now the redundant copy is dropped, as
// OSM renderers do: of two near-identical footprints only one is drawn, and
// an outline whose parts cover most of it gives way to the parts.

import type { BuildingFeature } from './buildingTileSource.js';

type Position = [number, number];
type Ring = Position[];

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

function ringArea(ring: Ring): number {
  const kx = METRES_PER_DEGREE * Math.cos((ring[0]?.[1] ?? 52) * Math.PI / 180);
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j][0] * kx) * (ring[i][1] * METRES_PER_DEGREE) - (ring[i][0] * kx) * (ring[j][1] * METRES_PER_DEGREE);
  }
  return Math.abs(area) / 2;
}

/** Of two footprints this alike in area, one is a copy of the other. */
export const TWIN_AREA_SHARE = 0.85;
/** An outline whose parts cover this much of it is replaced by the parts. */
export const PARTS_COVER_SHARE = 0.5;

/**
 * Drop the redundant copy of nested buildings. Returns a new array without
 * them; the input is not mutated and every other feature passes through as is.
 * - Twins: one footprint inside another of nearly the same area, overlapping
 *   in height. The lower is dropped (a tie keeps the smaller id).
 * - Outlines: a footprint that contains parts overlapping it in height, which
 *   together cover at least half of it. The outline is dropped.
 * A small part on a big building is left alone: its walls are inside the big
 * one except where it rises above it.
 */
export function dropNestedDuplicates(features: readonly BuildingFeature[]): BuildingFeature[] {
  const entries: Array<(Entry & { area: number; id: string }) | null> = features.map(feature => {
    const rings = outerRings(feature.geometry).filter(ring => ring.length >= 4);
    if (!rings.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const ring of rings) for (const [x, y] of ring) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const base = numberOr(feature.properties?.minHeight, 0);
    const top = numberOr(feature.properties?.height, base + 5);
    const area = rings.reduce((sum, ring) => sum + ringArea(ring), 0);
    return { feature, rings, box: [minX, minY, maxX, maxY], base, top, area, id: String(feature.properties?.id ?? '') };
  });
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
  const tolerance = EDGE_TOLERANCE_METRES / METRES_PER_DEGREE * 2;
  const dropped = new Set<number>();
  const partsArea = new Map<number, number>();
  entries.forEach((inner, index) => {
    if (!inner) return;
    const [x0, y0, x1, y1] = inner.box;
    const seen = new Set<number>();
    for (let gx = Math.floor(x0 / cell); gx <= Math.floor(x1 / cell); gx++) {
      for (let gy = Math.floor(y0 / cell); gy <= Math.floor(y1 / cell); gy++) {
        for (const other of grid.get(`${gx},${gy}`) ?? []) {
          if (other === index || seen.has(other)) continue;
          seen.add(other);
          const outer = entries[other]!;
          const [ox0, oy0, ox1, oy1] = outer.box;
          if (x0 < ox0 - tolerance || y0 < oy0 - tolerance || x1 > ox1 + tolerance || y1 > oy1 + tolerance) continue;
          if (inner.area > outer.area * 1.02) continue;
          if (Math.min(inner.top, outer.top) <= Math.max(inner.base, outer.base)) continue;
          if (!containedIn(inner, outer)) continue;
          if (inner.area >= TWIN_AREA_SHARE * outer.area) {
            // Twins meet twice, once from each side; decide once.
            const innerYields = inner.top < outer.top || (inner.top === outer.top && inner.id > outer.id);
            dropped.add(innerYields ? index : other);
          } else {
            partsArea.set(other, (partsArea.get(other) ?? 0) + inner.area);
          }
        }
      }
    }
  });
  for (const [index, area] of partsArea) {
    if (area >= PARTS_COVER_SHARE * entries[index]!.area) dropped.add(index);
  }
  return dropped.size ? features.filter((_, index) => !dropped.has(index)) : features.slice();
}
