/**
 * Street template (lane C-completer round 2, reviewer ruling 2026-11-13): the dressings a described front did not state,
 * taken from the nearest reviewed house of the same build-year band on its street or the adjoining block. Shared by route A
 * (the generic path) and route C (complete.ts). Both use the same ladder: twin → describer reading (passing classes) →
 * STREET TEMPLATE → PR1 structure prior → family default.
 *
 * A template is a published HouseSpec whose fronts/0 fields come from a photo source (`author`, `reviewed`: hand specs;
 * `streetlevel-measured`: block faces), with its BAG year, street and centroid (street-templates.json, written by
 * scripts/house-line/route-c/street-templates.ts). It lends only its DRESSINGS: the window surround and its storeys, sills,
 * hoods (lintels), band kind and its parameters, the cornice, and the frame, band, stone and cornice colours.
 * Structure is NEVER taken from a template: rows (storeys), bays, crown/gable, souterrain, basement, roof storey and roof stay
 * with the reading, the prior or the family (`STRUCTURE_FIELDS` is the guard; a test pins it).
 *
 * Ranking (round 3 ruling, 2026-11-13): a template must match the house, not only be near it. Within TEMPLATE_RADIUS_M (300 m),
 * same build-year band always:
 *   1. `street`: the same street.
 *   2. `class+scale`: the same street class (streetClass.ts: OSM main or side) AND a similar scale: height within
 *      SCALE_HEIGHT_M (2 m) and front width within SCALE_WIDTH_M (1 m). Both sides are measured with the same instrument:
 *      height is the building tile's 3DBAG height (LoD1.2, the extruded block height), width the footprint's narrow side
 *      (footprintWidthM). bag-facts eaves were rejected: they disagree with the recipe facts' front eaves by 4–10 m on 4 of
 *      the 8 Weteringschans fronts (168042 6.3 m against 13.8 m).
 *   3. `scale`: another class (an adjoining side street for a main-street front) that passes the scale test: scale outranks
 *      class, so a side street never lends to a main-street front on proximity alone.
 * An unknown scale on either side fails the scale test. If no tier has a candidate there is NO template: the ladder falls to
 * the prior and the family, never to a poor template. Interwar and post-war bands never template (TEMPLATE_BANDS).
 * Variety guard: within the first non-empty tier, the pick is the pool (sorted by pand id) at a hash of the query's pand id,
 * so one house's dressings are not stamped down a whole street.
 *
 * Pure, no files: the table is a JSON import.
 */
import TABLE from './street-templates.json' with { type: 'json' };
import { familyOf } from './families.ts';
import { streetClassOf, type StreetClass } from './streetClass.ts';

/** Dressing paths a template may fill (spec field paths). */
export const DRESSING_FIELDS = [
  'fronts/0/windowSurround', 'fronts/0/surroundStoreys', 'fronts/0/windowSills', 'fronts/0/windowHoods',
  'fronts/0/bands', 'fronts/0/speklagen', 'fronts/0/bandLines', 'fronts/0/bandStoreys', 'fronts/0/bandHeights', 'fronts/0/cornice',
  'palette/frame', 'palette/band', 'palette/stone', 'palette/cornice',
] as const;
export type DressingPath = typeof DRESSING_FIELDS[number];
/** Never from a template (the ruling): structure stays with the reading, the prior or the family. */
export const STRUCTURE_FIELDS = [
  'fronts/0/storeys', 'fronts/0/bays', 'fronts/0/gable', 'fronts/0/souterrain', 'fronts/0/basement', 'fronts/0/atticWindows',
  'fronts/0/dormers', 'fronts/0/roofFront', 'fronts/0/storeyHeights', 'fronts/0/crownRise', 'roof/material', 'roof/form',
] as const;

export const TEMPLATE_RADIUS_M = 300;
/** Scale test: 3DBAG height within 2 m and front width within 1 m (round 3 ruling). */
export const SCALE_HEIGHT_M = 2, SCALE_WIDTH_M = 1;
/** Only these bands lend or receive a template (round 3: interwar and post-war are excluded from the rung). */
export const TEMPLATE_BANDS = ['before-1800', '1800-1879', '1880-1919'] as const;
export type TemplateTier = 'street' | 'class+scale' | 'scale';
export const TIER_ORDER: readonly TemplateTier[] = ['street', 'class+scale', 'scale'];

/** One template house: short pand id, centroid, BAG year, street, street class, building-tile 3DBAG height (h, m) and front
 *  width (w, m; the footprint's narrow side), the source of its fields, its dressings. */
export type TemplateRow = { p: string; x: number; y: number; yr: number | null; st: string; c?: StreetClass | null; h?: number | null; w?: number | null; src: string; f: Partial<Record<DressingPath, unknown>> };
export type TemplateTable = { v: number; rows: TemplateRow[] };
const table = TABLE as unknown as TemplateTable;

export interface TemplateQuery {
  pandId: string; lng: number; lat: number; year: number | null | undefined; street?: string | null;
  /** The house's scale on the table's instrument: building-tile 3DBAG height and footprint narrow side (m). Unknown fails the
   *  scale test (only the same-street tier can then match). */
  heightM?: number | null; widthM?: number | null;
  /** Default: streetClassOf(street). */
  streetClass?: StreetClass | null;
}
export interface TemplatePick {
  /** The template house (16-digit pand id). */
  pandId: string;
  street: string;
  distM: number;
  sameStreet: boolean;
  tier: TemplateTier;
  /** Templates in the pool the pick was drawn from (the variety guard's denominator). */
  pool: number;
  src: string;
  fields: Partial<Record<DressingPath, unknown>>;
}

const KX = 111_320 * Math.cos(52.37 * Math.PI / 180), KY = 110_540;
const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
/** FNV-1a, 32 bit: a stable hash of the pand id for the variety guard. */
export function pandHash(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
const short = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');

/** Whether two houses are of a similar scale: both heights and both widths known, within SCALE_HEIGHT_M and SCALE_WIDTH_M. */
export function scaleMatch(a: { heightM?: number | null; widthM?: number | null }, b: { h?: number | null; w?: number | null }): boolean {
  return a.heightM != null && a.widthM != null && b.h != null && b.w != null
    && Math.abs(a.heightM - b.h) <= SCALE_HEIGHT_M && Math.abs(a.widthM - b.w) <= SCALE_WIDTH_M;
}

export interface InReach { row: TemplateRow; distM: number; sameStreet: boolean; sameClass: boolean; scale: boolean; tier: TemplateTier | null }
/** Every template of the query's band within the radius (not the house itself), nearest first, with its tier (null: in reach
 *  but it does not qualify). */
export function templatesInReach(q: TemplateQuery, t: TemplateTable = table, radiusM = TEMPLATE_RADIUS_M): InReach[] {
  const band = familyOf(q.year);
  if (!(TEMPLATE_BANDS as readonly string[]).includes(band)) return [];
  const me = short(q.pandId), street = norm(q.street), cls = q.streetClass !== undefined ? q.streetClass : streetClassOf(q.street);
  const out: InReach[] = [];
  for (const row of t.rows) {
    if (row.p === me || familyOf(row.yr) !== band) continue;
    const dx = (row.x - q.lng) * KX, dy = (row.y - q.lat) * KY;
    if (Math.abs(dx) > radiusM || Math.abs(dy) > radiusM) continue;
    const distM = Math.hypot(dx, dy);
    if (distM > radiusM) continue;
    const sameStreet = !!street && norm(row.st) === street;
    const rowCls = row.c !== undefined ? row.c : streetClassOf(row.st);
    const sameClass = !!cls && rowCls === cls, scale = scaleMatch(q, row);
    out.push({ row, distM, sameStreet, sameClass, scale, tier: sameStreet ? 'street' : scale && sameClass ? 'class+scale' : scale ? 'scale' : null });
  }
  return out.sort((a, b) => a.distM - b.distM);
}

/** The street template for a front: the first non-empty tier, hashed pick; null when no template qualifies. */
export function streetTemplateFor(q: TemplateQuery, t: TemplateTable = table, radiusM = TEMPLATE_RADIUS_M): TemplatePick | null {
  const reach = templatesInReach(q, t, radiusM);
  for (const tier of TIER_ORDER) {
    const pool = reach.filter(r => r.tier === tier).sort((a, b) => (a.row.p < b.row.p ? -1 : 1));
    if (!pool.length) continue;
    const pick = pool[pandHash(short(q.pandId)) % pool.length];
    return { pandId: pick.row.p, street: pick.row.st, distM: +pick.distM.toFixed(1), sameStreet: pick.sameStreet, tier, pool: pool.length, src: pick.row.src, fields: pick.row.f };
  }
  return null;
}

const KXY = (lat: number) => [111_320 * Math.cos(lat * Math.PI / 180), 110_540];
/** A footprint's front width proxy: the narrow side of its minimum-area bounding rectangle (m), from a lng/lat ring. */
export function footprintWidthM(ring: number[][]): number | null {
  if (!ring || ring.length < 3) return null;
  const [kx, ky] = KXY(ring[0][1]), pts = ring.map(p => [p[0] * kx, p[1] * ky]);
  let best: [number, number] | null = null;
  for (let i = 0; i + 1 < pts.length; i++) {
    const ex = pts[i + 1][0] - pts[i][0], ey = pts[i + 1][1] - pts[i][1], L = Math.hypot(ex, ey);
    if (L < 1e-6) continue;
    const ux = ex / L, uy = ey / L;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const [x, y] of pts) { const a = x * ux + y * uy, b = -x * uy + y * ux; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
    const w = a1 - a0, h = b1 - b0;
    if (!best || w * h < best[0] * best[1]) best = [w, h];
  }
  return best ? Math.min(best[0], best[1]) : null;
}

export const STREET_TEMPLATE_TABLE = table;
