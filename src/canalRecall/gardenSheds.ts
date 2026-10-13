/**
 * Garden sheds: the small back-garden pands (a quarter of the BAG, 108k of 347k footprints are under 25 m2).
 *
 * User 2026-10-13, Willem de Zwijgerlaan: "does every one of these houses have an auxiliary building?" Mostly yes:
 * BAG holds them as pands, 6 m2 boxes 2.2-2.6 m tall, and the city drew each as a full building in a random
 * bright side colour. A shed is a pand that is
 *   - small: under 25 m2, or under 40 m2 with eaves under 3.2 m, and
 *   - not street-facing: no street that can carry a front door (streetFronts.ts FRONT_HIGHWAYS) within 6 m of any
 *     footprint edge. A kiosk or a corner shop on a street is small too, but it stands on one.
 * and it is drawn as a low flat-roofed box in a muted weathered colour, no windows, at its own 3DBAG height (the
 * tile's `height` is the 3DBAG roof height; a shed with no height is 2.6 m, not the 5 m storey default), and not
 * at all below the near tier.
 *
 * Pure: the chunk builder gives it the streets it already has. Without streets nothing is classified.
 */

import type { SegmentGrid } from './streetFronts.js';

export const SHED_MAX_AREA_M2 = 25;
export const SHED_LOW_MAX_AREA_M2 = 40;
export const SHED_LOW_EAVES_M = 3.2;
/** A street this close to any footprint edge makes the pand street-facing. */
export const SHED_STREET_REACH_M = 6;
/** The height of a shed whose pand carries none (the generic default is 5 m, a storey and a half too much). */
export const SHED_DEFAULT_HEIGHT_M = 2.6;

/** Weathered timber, tarred board, grey render and moss green: nothing a wall palette would pick. */
export const SHED_WALL_HEXES: readonly string[] = ['#8a8274', '#7b7568', '#6f7a70', '#857a69', '#767a7c', '#8d8576'];
/** A tarred flat roof, darker than every wall above. */
export const SHED_LID_HEX = '#4d4f4f';

const M_PER_DEG_LAT = 110_540;

export type ShedFacts = { areaM2: number; eavesM: number | null | undefined };

/** Small enough to be a shed, whatever it stands next to. */
export function isShedSized({ areaM2, eavesM }: ShedFacts): boolean {
  if (!(areaM2 > 0)) return false;
  if (areaM2 < SHED_MAX_AREA_M2) return true;
  return areaM2 < SHED_LOW_MAX_AREA_M2 && typeof eavesM === 'number' && eavesM < SHED_LOW_EAVES_M;
}

/** Outer-ring area in square metres of a footprint given as [lng, lat] rings (first ring outer; holes ignored). */
export function ringAreaM2(ring: ReadonlyArray<readonly number[]>): number {
  if (ring.length < 4) return 0;
  const lat0 = ring[0][1], kx = 111_320 * Math.cos(lat0 * Math.PI / 180);
  let s = 0;
  for (let i = 0; i + 1 < ring.length; i++) {
    const ax = (ring[i][0] - ring[0][0]) * kx, ay = (ring[i][1] - lat0) * M_PER_DEG_LAT;
    const bx = (ring[i + 1][0] - ring[0][0]) * kx, by = (ring[i + 1][1] - lat0) * M_PER_DEG_LAT;
    s += ax * by - bx * ay;
  }
  return Math.abs(s) / 2;
}

const segSegDist = (a: [number, number], b: [number, number], c: [number, number], d: [number, number]): number => {
  const point = (p: [number, number], s: [number, number], t: [number, number]) => {
    const dx = t[0] - s[0], dy = t[1] - s[1], l2 = dx * dx + dy * dy, u = l2 ? Math.max(0, Math.min(1, ((p[0] - s[0]) * dx + (p[1] - s[1]) * dy) / l2)) : 0;
    return Math.hypot(p[0] - s[0] - u * dx, p[1] - s[1] - u * dy);
  };
  const cross = (p: [number, number], q: [number, number], r: [number, number]) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0;
  return Math.min(point(a, c, d), point(b, c, d), point(c, a, b), point(d, a, b));
};

/**
 * Is a street within `reach` metres of any footprint edge? `ring` is the outer ring in metres from the same origin
 * as the grid's segments.
 */
export function streetWithin(ring: ReadonlyArray<readonly [number, number]>, streets: SegmentGrid, reach = SHED_STREET_REACH_M): boolean {
  if (ring.length < 3) return false;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (const s of streets.near(x0 - reach, y0 - reach, x1 + reach, y1 + reach)) {
    const a: [number, number] = [streets.segs[s * 4], streets.segs[s * 4 + 1]], b: [number, number] = [streets.segs[s * 4 + 2], streets.segs[s * 4 + 3]];
    for (let i = 0; i < ring.length; i++) {
      const c = ring[i] as [number, number], d = ring[(i + 1) % ring.length] as [number, number];
      if (segSegDist(a, b, c, d) <= reach) return true;
    }
  }
  return false;
}

type ShedFeature = { properties: Record<string, unknown>; geometry: unknown };

/** The outer ring of a one-polygon feature as [lng, lat]; null for multipolygons and anything else. */
function outerRing(geometry: unknown): number[][] | null {
  const g = geometry as { type?: string; coordinates?: number[][][] | number[][][][] } | null;
  const polygon = g?.type === 'Polygon' ? g.coordinates as number[][][] : g?.type === 'MultiPolygon' && (g.coordinates as number[][][][]).length === 1 ? (g.coordinates as number[][][][])[0] : null;
  return polygon?.[0] && polygon[0].length >= 4 ? polygon[0] : null;
}

/** A tile feature's eaves: the 3DBAG eave when the tile carries it, the planned eave, else the roof height. */
export function eavesOf(properties: Record<string, unknown>): number | null {
  for (const key of ['eaves', 'roofEavesHeightM', 'height'] as const) {
    const v = properties[key];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

/**
 * Is this feature a garden shed? Needs the streets near it (flat segments in metres from `origin`, the chunk
 * builder's own); with none known it is never a shed, so a kiosk is never lost to a missing street file.
 * A building with a mapped facade, a shop, a landmark role or a min height is not a shed.
 */
export function isGardenShed(feature: ShedFeature, streets: SegmentGrid | null, origin: { lng: number; lat: number }): boolean {
  if (!streets) return false;
  const p = feature.properties;
  if (p.allotmentHouse || p.kitWall || p.kitRoof || p.frontCarrier || p.largeTier || p.monumentGable || p.shopSignature || p.shopChain) return false;
  if (Number(p.minHeight) > 0.5) return false;
  const ring = outerRing(feature.geometry);
  if (!ring) return false;
  if (!isShedSized({ areaM2: ringAreaM2(ring), eavesM: eavesOf(p) })) return false;
  const kx = 111_320 * Math.cos(origin.lat * Math.PI / 180);
  const local = ring.slice(0, -1).map(([lng, lat]) => [(lng - origin.lng) * kx, (lat - origin.lat) * M_PER_DEG_LAT] as [number, number]);
  return !streetWithin(local, streets);
}

const hash = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
};
export const shedWallHex = (id: string): string => SHED_WALL_HEXES[Math.floor(hash(`${id}:shed`) * SHED_WALL_HEXES.length)];

/** A shed's height: its own, or the shed default when the pand carries none (or a storey default). */
export const shedHeightM = (properties: Record<string, unknown>): number => {
  const h = Number(properties.height);
  return Number.isFinite(h) && h > 0 ? h : SHED_DEFAULT_HEIGHT_M;
};
