// Courtyards on the own ground (pure; the extractor and the ground worker).
// docs/bgt-courtyards-20261014.md, ride review 2026-10-14 row J4.
//
// The inner gardens of a closed block drew as bare land (the sand `land`
// colour), so from a street corner a Jordaan block read as a public square.
// scripts/own-ground/add-bgt-courtyards.ts adds the BGT terrain polygons that
// lie inside a block interior to the published OSM cells as `courtyard`
// areas, each with the park surface it draws as:
//
//   begroeidterreindeel     lawn / shrub / bed / bark by its (plus) type
//   onbegroeidterreindeel   zand → sand, (half)verhard → gravel, verharding → paving,
//                           erf → by the share of vegetated pixels in the PDOK
//                           colour-infrared aerial (BGT does not say what a yard is)
//   ondersteunendwegdeel    as the two above (bermen and islands inside a block)
//
// "Inside a block interior" is a ray test: from the polygon's interior point,
// 16 rays out to 120 m; a ray is closed when it meets a building (BGT pand)
// before a street (OSM carriageway, cycleway or pedestrian way) or water (BGT
// waterdeel); at least 13 of 16 closed, so one gate or gap in a block wall is
// allowed but a front garden, a verge or a park is not.

import type { Vec2 } from './surface.js';
import { bgtParkSurface } from './parks.js';

/** What a courtyard area draws as: the park surface layers (parks.ts SURFACE_LAYER) minus paths, cycle paths and ponds. */
export type CourtyardSurface = 'lawn' | 'shrub' | 'bed' | 'bark' | 'gravel' | 'sand' | 'paving';
export const COURTYARD_SURFACES: readonly CourtyardSurface[] = ['lawn', 'shrub', 'bed', 'bark', 'gravel', 'sand', 'paving'];
/** Vegetated cover (the J4 regression's share). */
export const VEGETATED: ReadonlySet<CourtyardSurface> = new Set(['lawn', 'shrub', 'bed', 'bark']);

/** An `erf` (yard) at least this share vegetated (of its sunlit pixels) is lawn, at least BED_SHARE a planted bed, else paving. */
export const LAWN_SHARE = 0.5;
export const BED_SHARE = 0.25;
/** At least this many sunlit pixels, and this share of the yard sunlit, before the aerial is believed. */
export const MIN_LIT_PIXELS = 8;
export const MIN_LIT_SHARE = 0.2;

export interface BgtProps { fysiek_voorkomen?: string | null; plus_fysiek_voorkomen?: string | null; functie?: string | null }

/**
 * The courtyard surface of a BGT terrain polygon, or null (not drawn: the land stays).
 * `vegShare`: for an `erf`, the vegetated share of its sunlit aerial pixels (null: unknown, too few lit pixels).
 */
export function courtyardSurface(collection: string, p: BgtProps, vegShare: number | null = null): CourtyardSurface | null {
  const fv = (p.fysiek_voorkomen ?? '').toLowerCase();
  if (collection === 'begroeidterreindeel') {
    const s = bgtParkSurface(collection, p);
    return s === 'lawn' || s === 'shrub' || s === 'bed' || s === 'bark' ? s : null;
  }
  if (collection === 'onbegroeidterreindeel' || collection === 'ondersteunendwegdeel') {
    if (fv === 'erf') return vegShare === null ? null : vegShare >= LAWN_SHARE ? 'lawn' : vegShare >= BED_SHARE ? 'bed' : 'paving';
    if (fv === 'groenvoorziening') return courtyardSurface('begroeidterreindeel', p);
    if (fv === 'zand') return 'sand';
    if (fv === 'half verhard' || fv === 'onverhard') return 'gravel';
    if (fv === 'open verharding' || fv === 'gesloten verharding') return 'paving';
    return null;
  }
  return null;
}

// ------------------------------------------------------------------ the aerial

/**
 * Vegetated? One pixel of the PDOK colour-infrared ortho (bands as delivered: R = near infrared, G = red, B = green).
 * NDVI = (nir − red) / (nir + red); `null`: in shadow (the spring flight's low sun leaves narrow yards dark), unknown.
 */
export const NDVI_VEG = 0.12;
export const SHADOW_SUM = 150;
export function pixelVegetated(nir: number, red: number, green: number): boolean | null {
  if (nir + red + green < SHADOW_SUM) return null;
  return (nir - red) / Math.max(1, nir + red) >= NDVI_VEG;
}

/** The vegetated share of a polygon's sunlit pixels, or null when too few are lit. */
export function vegetatedShare(counts: { veg: number; bare: number; shadow: number }): number | null {
  const lit = counts.veg + counts.bare, all = lit + counts.shadow;
  if (lit < MIN_LIT_PIXELS || lit < MIN_LIT_SHARE * all) return null;
  return counts.veg / lit;
}

// ------------------------------------------------------------------ the block interior

export const RAYS = 16;
export const RAY_M = 120;
export const MIN_CLOSED = 13;

/** A segment that closes a ray (a building edge) or opens it (a street, a shore). */
export interface Segment { a: Vec2; b: Vec2; closes: boolean }

/** Bucketed segments for ray casting. */
export class SegmentIndex {
  private readonly cells = new Map<string, Segment[]>();
  constructor(segments: readonly Segment[], private readonly size = 20) {
    for (const s of segments) {
      const x0 = Math.floor(Math.min(s.a[0], s.b[0]) / size), x1 = Math.floor(Math.max(s.a[0], s.b[0]) / size);
      const y0 = Math.floor(Math.min(s.a[1], s.b[1]) / size), y1 = Math.floor(Math.max(s.a[1], s.b[1]) / size);
      for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
        const k = `${i},${j}`;
        const l = this.cells.get(k);
        if (l) l.push(s); else this.cells.set(k, [s]);
      }
    }
  }
  near(x: number, y: number, r: number): Segment[] {
    const out = new Set<Segment>(), s = this.size;
    for (let i = Math.floor((x - r) / s); i <= Math.floor((x + r) / s); i++) for (let j = Math.floor((y - r) / s); j <= Math.floor((y + r) / s); j++) for (const g of this.cells.get(`${i},${j}`) ?? []) out.add(g);
    return [...out];
  }
}

/** Distance along the ray (x, y) + t (dx, dy), t in [0, max], to the segment, or Infinity. */
function rayHit(x: number, y: number, dx: number, dy: number, s: Segment, max: number): number {
  const ex = s.b[0] - s.a[0], ey = s.b[1] - s.a[1], den = dx * ey - dy * ex;
  if (Math.abs(den) < 1e-12) return Infinity;
  const wx = s.a[0] - x, wy = s.a[1] - y;
  const t = (wx * ey - wy * ex) / den, u = (wx * dy - wy * dx) / den;
  return t >= 0 && t <= max && u >= 0 && u <= 1 ? t : Infinity;
}

/** How many of the RAYS rays from (x, y) meet a building before a street or water (or nothing within RAY_M). */
export function closedRays(index: SegmentIndex, x: number, y: number): number {
  const near = index.near(x, y, RAY_M);
  let closed = 0;
  for (let k = 0; k < RAYS; k++) {
    const a = (k + 0.5) * 2 * Math.PI / RAYS, dx = Math.cos(a), dy = Math.sin(a);
    let best = Infinity, closes = false;
    for (const s of near) { const t = rayHit(x, y, dx, dy, s, RAY_M); if (t < best) { best = t; closes = s.closes; } }
    if (closes) closed++;
  }
  return closed;
}

export const inBlockInterior = (index: SegmentIndex, x: number, y: number): boolean => closedRays(index, x, y) >= MIN_CLOSED;

/** OSM highway values whose centreline opens a ray (the street the block faces). Footways, paths and service ways do not: they run into hofjes and yards. */
export const OPENING_HIGHWAYS: ReadonlySet<string> = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'pedestrian', 'cycleway', 'road',
  'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']);

/** Segments of a polyline or ring (closing edge included for rings whose last point repeats the first). */
export function segmentsOf(pts: readonly Vec2[], closes: boolean): Segment[] {
  const out: Segment[] = [];
  for (let i = 1; i < pts.length; i++) out.push({ a: pts[i - 1], b: pts[i], closes });
  return out;
}
