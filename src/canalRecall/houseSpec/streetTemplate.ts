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
 * Choice: the templates of the same band within TEMPLATE_RADIUS_M, those on the same street first (else the adjoining
 * blocks: any street in reach). Variety guard: with two or more in the pool, the pick is the pool (sorted by pand id) at a
 * hash of the query's pand id, so one house's dressings are not stamped down a whole street.
 *
 * Pure, no files: the table is a JSON import.
 */
import TABLE from './street-templates.json' with { type: 'json' };
import { familyOf } from './families.ts';

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

export const TEMPLATE_RADIUS_M = 150;

/** One template house: short pand id, centroid, BAG year, street, the source of its fields, its dressings. */
export type TemplateRow = { p: string; x: number; y: number; yr: number | null; st: string; src: string; f: Partial<Record<DressingPath, unknown>> };
export type TemplateTable = { v: number; radiusM?: number; rows: TemplateRow[] };
const table = TABLE as unknown as TemplateTable;

export interface TemplateQuery { pandId: string; lng: number; lat: number; year: number | null | undefined; street?: string | null }
export interface TemplatePick {
  /** The template house (16-digit pand id). */
  pandId: string;
  street: string;
  distM: number;
  sameStreet: boolean;
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

/** Every template of the query's band in reach (not the house itself), nearest first, with its distance and street match. */
export function templatesInReach(q: TemplateQuery, t: TemplateTable = table, radiusM = TEMPLATE_RADIUS_M) {
  const band = familyOf(q.year);
  if (band === 'unknown') return [];
  const me = short(q.pandId), street = norm(q.street);
  const out: { row: TemplateRow; distM: number; sameStreet: boolean }[] = [];
  for (const row of t.rows) {
    if (row.p === me || familyOf(row.yr) !== band) continue;
    const dx = (row.x - q.lng) * KX, dy = (row.y - q.lat) * KY;
    if (Math.abs(dx) > radiusM || Math.abs(dy) > radiusM) continue;
    const distM = Math.hypot(dx, dy);
    if (distM <= radiusM) out.push({ row, distM, sameStreet: !!street && norm(row.st) === street });
  }
  return out.sort((a, b) => a.distM - b.distM);
}

/** The street template for a front, or null when no template of its band is within reach. */
export function streetTemplateFor(q: TemplateQuery, t: TemplateTable = table, radiusM = TEMPLATE_RADIUS_M): TemplatePick | null {
  const reach = templatesInReach(q, t, radiusM);
  if (!reach.length) return null;
  const same = reach.filter(r => r.sameStreet), pool = (same.length ? same : reach).slice().sort((a, b) => (a.row.p < b.row.p ? -1 : 1));
  const pick = pool[pandHash(short(q.pandId)) % pool.length];
  return { pandId: pick.row.p, street: pick.row.st, distM: +pick.distM.toFixed(1), sameStreet: pick.sameStreet, pool: pool.length, src: pick.row.src, fields: pick.row.f };
}

export const STREET_TEMPLATE_TABLE = table;
