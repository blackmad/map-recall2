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
 * - Slender parts: a footprint under SLENDER_THICKNESS_M thick, without a colour of
 *   its own, standing against a bigger host whose height range covers it
 *   (`isSlenderAgainstHost`). The slender part is dropped (`options.slender:
 *   false` keeps it, for audits that compare).
 * A small part on a big building is left alone: its walls are inside the big
 * one except where it rises above it.
 */
export function dropNestedDuplicates(features: readonly BuildingFeature[], options: { slender?: boolean } = {}): BuildingFeature[] {
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
  // Slender parts standing against a host (feedback fc427560, IJdok 2026-11-09): see `isSlenderAgainstHost`.
  if (options.slender !== false) entries.forEach((part, index) => {
    if (!part || dropped.has(index) || !slenderCandidate(part)) return;
    const [x0, y0, x1, y1] = part.box, pad = SLENDER_PROUD_M / METRES_PER_DEGREE * 2;
    const seen = new Set<number>();
    let host = false, touching = 0;
    for (let gx = Math.floor((x0 - pad) / cell); gx <= Math.floor((x1 + pad) / cell); gx++) {
      for (let gy = Math.floor((y0 - pad) / cell); gy <= Math.floor((y1 + pad) / cell); gy++) {
        for (const other of grid.get(`${gx},${gy}`) ?? []) {
          if (other === index || seen.has(other) || dropped.has(other)) continue;
          seen.add(other);
          const neighbour = entries[other]!;
          if (Math.min(part.top, neighbour.top) - Math.max(part.base, neighbour.base) <= SLENDER_HEIGHT_TOLERANCE_M) continue;
          if (!touchesWithin(part, neighbour, SLENDER_TOUCH_M)) continue;
          touching++;
          if (isSlenderAgainstHost(part, neighbour)) host = true;
        }
      }
    }
    // Touching a second building at the same height, it closes a gap (an infill between two houses): kept.
    if (host && touching === 1) dropped.add(index);
  });
  return dropped.size ? features.filter((_, index) => !dropped.has(index)) : features.slice();
}

/** Mean thickness 2A/P at or under which a footprint is a fin, a pier or a shallow oriel, not a building. */
export const SLENDER_THICKNESS_M = 1;
/** A slender part's vertices lie at most this far outside its host's footprint. */
export const SLENDER_PROUD_M = 1.5;
/** ... and at least one touches it (within this). */
export const SLENDER_TOUCH_M = 0.6;
/** The host's height range covers the slender part's within this. */
export const SLENDER_HEIGHT_TOLERANCE_M = 0.5;

function ringPerimeterMetres(ring: Ring): number {
  const kx = METRES_PER_DEGREE * Math.cos((ring[0]?.[1] ?? 52) * Math.PI / 180);
  let length = 0;
  for (let i = 1; i < ring.length; i++) length += Math.hypot((ring[i][0] - ring[i - 1][0]) * kx, (ring[i][1] - ring[i - 1][1]) * METRES_PER_DEGREE);
  return length;
}

/**
 * Candidates: a source footprint (OSM way/relation or BAG pand, not a piece the pipeline cut: those ids carry a
 * `:`), with no colour of its own, whose mean thickness is at most SLENDER_THICKNESS_M.
 */
function slenderCandidate(part: Entry & { area: number; id: string }): boolean {
  if (!part.id || part.id.includes(':')) return false;
  if (typeof part.feature.properties?.colour === 'string') return false;
  const perimeter = part.rings.reduce((sum, ring) => sum + ringPerimeterMetres(ring), 0);
  return perimeter > 0 && 2 * part.area / perimeter <= SLENDER_THICKNESS_M;
}

/**
 * A slender part (a fin, a pier, a shallow oriel under 1 m thick) beside a bigger host whose height range covers its
 * own, no more than SLENDER_PROUD_M proud of the host's footprint: the mesh draws it as one windowless slab in its
 * own look colour on the host's windowed facade, a stripe that reads as a rendering fault (the maroon strip at
 * IJdok, w1088847358: 4.8 x 0.46 m, 8-24 m, against w1088847356 0-24 m). It is dropped and the host's facade shows.
 * A part with a colour of its own (a mapper's glass oriel or bridge) is kept, and so is one that touches a second
 * building at the same height (it closes a gap in a row; dropping it would open a slot).
 */
function metresFrom(x: number, y: number, kx: number, other: Entry): number {
  return other.rings.some(o => pointInRing(x, y, o)) ? 0 : Math.min(...other.rings.map(o => metresToRing(x, y, o, kx)));
}

function touchesWithin(part: Entry, other: Entry, metres: number): boolean {
  return part.rings.some(ring => {
    const kx = METRES_PER_DEGREE * Math.cos((ring[0]?.[1] ?? 52) * Math.PI / 180);
    return ring.some(([x, y]) => metresFrom(x, y, kx, other) <= metres);
  });
}

function isSlenderAgainstHost(part: Entry & { area: number }, host: (Entry & { area: number }) | null): boolean {
  if (!host || host.area <= 2 * part.area) return false;
  if (host.base > part.base + SLENDER_HEIGHT_TOLERANCE_M || host.top < part.top - SLENDER_HEIGHT_TOLERANCE_M) return false;
  let touches = false;
  for (const ring of part.rings) {
    const kx = METRES_PER_DEGREE * Math.cos((ring[0]?.[1] ?? 52) * Math.PI / 180);
    for (const [x, y] of ring) {
      const metres = metresFrom(x, y, kx, host);
      if (metres > SLENDER_PROUD_M) return false;
      if (metres <= SLENDER_TOUCH_M) touches = true;
    }
  }
  return touches;
}
