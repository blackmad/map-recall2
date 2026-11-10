/**
 * HouseSpec: the one record per house (house line station 1, docs/house-line.md §1).
 *
 * Before this record a house's facts lived in three record types (facade/houseRecord.ts `CanalHouse`, recipe intents
 * under scripts/building-recipes/houses, block-face intents under scripts/block-face/faces) plus the monuments
 * register (facade/registerRecipe.ts), and each render path read its own subset. A spec wraps the vocabulary the
 * recipes and block faces already speak (`HouseDesign` = `CanalHouseIntent` minus identity) and adds, per field, the
 * receipt: which source said it, how sure, where to look, when it was observed. Partial specs from several sources
 * merge field by field in resolve.ts (strongest source wins); nothing is invented, a field no source states stays
 * absent.
 *
 * Field granularity (the unit that provenance and the merge address): one key of one front (`fronts/0/gable`), one
 * key of the roof (`roof/material`) or of the palette (`palette/brick`), `notes`, and one key of `facts`
 * (`facts/facadeYear`). Values below that level (a front's `windowHead` object, a `bays` list) are atomic: two
 * sources never splice one window head together.
 */
import {
  GABLES, ROOF_MATERIALS, SWATCHES, WALL_MATERIALS,
  type FrontIntent, type GableIntent, type IntentSource,
} from '../buildingRecipe/intent.ts';
import type { HouseDesign } from '../blockFace/intent.ts';
import { SOURCE_STRENGTH, type FacadeSource } from '../facade/evidence.ts';

export type { HouseDesign };
/** Every source a spec field may name: the facade evidence ladder plus `author` (a hand-written spec, ranks as `reviewed`). */
export type SpecSource = FacadeSource | 'vision-judge' | 'author';
export const SPEC_SOURCES: readonly SpecSource[] = [...SOURCE_STRENGTH, 'author'];

/** The receipt for one field (or, keyed by an ancestor path, for every field below it). */
export type Prov = {
  source: SpecSource;
  /** 0…1. */
  confidence: number;
  /** Where to look: a repo path (`scripts/block-face/faces/<id>/strip.json`), `rce:<nr>`, an observation id. */
  ref: string;
  /** ISO date of the evidence (the photo, the record), `YYYY-MM-DD`; null when unknown. */
  at: string | null;
};

export type DeepPartial<T> = T extends readonly (infer U)[] ? DeepPartial<U>[] : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

/** What a source states about the house that the design vocabulary has no field for. */
export interface SpecFacts {
  /** The year the street front dates to (register facade date, a dated photo caption). Drives the era palette. */
  facadeYear?: number;
  /** Wall-extra component ids the source names (register elements via registerRecipe.ts ELEMENT_COMPONENTS). */
  elements?: string[];
  /** Ground floor kind as judged on a crop: a shop pui, a residential ground floor, a warehouse door. */
  pui?: 'shop' | 'residential' | 'warehouse';
}

export interface HouseSpec {
  schemaVersion: 1;
  /** BAG pand identificatie, 16 digits (no `NL.IMBAG.Pand.` prefix, as in the intents). */
  pandId: string;
  address?: string;
  /** The vocabulary recipes and block faces already speak, every field optional. */
  design: DeepPartial<HouseDesign>;
  facts?: SpecFacts;
  /** Keyed by field path (`fronts/0/gable`, `palette/brick`, `facts/facadeYear`); an ancestor key (`fronts/0`, or `` for
   *  the whole record) covers every field below it. resolve.ts writes one key per field. */
  provenance: Record<string, Prov>;
  /** What the kit cannot say about this house, one entry per kit component (the kit-gap queue keys on `component`).
   *  The shape of BlockFaceIntent.schemaLimits since a1's belt lanes (2026-11-10); legacy `"component: what"` strings are
   *  read through `toSpecLimit`. */
  schemaLimits?: SpecLimit[];
  /** Derived (toRecipe.ts `withRoute`): `recipe` when the spec is a complete, valid canal-house intent, else `generic`. */
  route?: 'generic' | 'recipe';
}

/** One kit limit: `component` names the kit part (a window kind, a crown ornament, a roof form), `what` says what the
 *  photo has that the kit cannot draw. */
export interface SpecLimit { component: string; what: string }

/** A limit in either form: the object as is, or a legacy `"component: what"` string (component = one to three words
 *  before the first colon; anything else is filed under `facade`). Null for an empty or malformed entry. */
export function toSpecLimit(entry: unknown): SpecLimit | null {
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    const { component, what } = entry as Record<string, unknown>;
    return typeof component === 'string' && component.trim() && typeof what === 'string' && what.trim() ? { component: component.trim(), what: what.trim() } : null;
  }
  if (typeof entry !== 'string' || !entry.trim()) return null;
  const t = entry.trim().replace(/^\d{6}:\s*/, ''); // face limitations are `<pand6>: <what>`
  const m = /^([a-z][\w-]*(?: [\w-]+){0,2}): (\S.*)$/is.exec(t);
  return m ? { component: m[1], what: m[2] } : { component: 'facade', what: t };
}
/** Deduplicate limits (same component and text), keeping first-seen order. */
export function uniqueLimits(limits: readonly SpecLimit[]): SpecLimit[] {
  const seen = new Set<string>(), out: SpecLimit[] = [];
  for (const l of limits) { const k = `${l.component}\u0000${l.what}`; if (!seen.has(k)) { seen.add(k); out.push(l); } }
  return out;
}

const STRENGTH = new Map<string, number>(SOURCE_STRENGTH.map((s, i) => [s, i]));
STRENGTH.set('author', STRENGTH.get('reviewed')!);
/** Rank of a source on the evidence ladder (`author` = `reviewed`); unknown sources rank below `default`. */
export const specStrength = (source: SpecSource): number => STRENGTH.get(source) ?? -1;
export const isStrongerSpecSource = (a: SpecSource, b: SpecSource): boolean => specStrength(a) > specStrength(b);

/** The design keys whose values are fields (atomic); `fronts` is indexed, `notes` is one field. */
const SECTIONS = ['roof', 'palette'] as const;

/** Every field of a spec as [path, value], in a stable order (fronts by index, then roof, palette, notes, facts). */
export function specFields(spec: Pick<HouseSpec, 'design' | 'facts'>): Array<[string, unknown]> {
  const out: Array<[string, unknown]> = [];
  const d = spec.design ?? {};
  (d.fronts ?? []).forEach((front, i) => {
    for (const [k, v] of Object.entries(front ?? {})) if (v !== undefined) out.push([`fronts/${i}/${k}`, v]);
  });
  for (const section of SECTIONS) for (const [k, v] of Object.entries((d as Record<string, unknown>)[section] ?? {})) if (v !== undefined) out.push([`${section}/${k}`, v]);
  if (d.notes !== undefined) out.push(['notes', d.notes]);
  for (const [k, v] of Object.entries(spec.facts ?? {})) if (v !== undefined) out.push([`facts/${k}`, v]);
  return out;
}

/** The field at `path`, or undefined. */
export function specField(spec: Pick<HouseSpec, 'design' | 'facts'>, path: string): unknown {
  const [head, a, b] = path.split('/');
  if (head === 'fronts') return (spec.design?.fronts?.[Number(a)] as Record<string, unknown> | undefined)?.[b];
  if (head === 'facts') return (spec.facts as Record<string, unknown> | undefined)?.[a];
  if (head === 'notes') return spec.design?.notes;
  return ((spec.design as Record<string, Record<string, unknown> | undefined>)?.[head])?.[a];
}

/** Set the field at `path` on a spec under construction (creates the front/section as needed). */
export function setSpecField(spec: Pick<HouseSpec, 'design' | 'facts'>, path: string, value: unknown): void {
  const [head, a, b] = path.split('/');
  const design = spec.design as Record<string, any>;
  if (head === 'fronts') {
    design.fronts ??= [];
    const i = Number(a);
    while (design.fronts.length <= i) design.fronts.push({});
    design.fronts[i][b] = value;
  } else if (head === 'facts') {
    (spec as { facts?: Record<string, unknown> }).facts ??= {};
    (spec.facts as Record<string, unknown>)[a] = value;
  } else if (head === 'notes') design.notes = value;
  else { design[head] ??= {}; design[head][a] = value; }
}

/** The receipt that covers `path`: its own key, else the nearest ancestor (`fronts/0`, `fronts`, ``). */
export function provenanceOf(spec: Pick<HouseSpec, 'provenance'>, path: string): Prov | undefined {
  const parts = path.split('/');
  for (let n = parts.length; n >= 0; n--) {
    const key = parts.slice(0, n).join('/');
    if (spec.provenance?.[key]) return spec.provenance[key];
  }
  return undefined;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const colourOk = (v: unknown) => typeof v === 'string' && (v in SWATCHES || /^#[0-9a-f]{6}$/i.test(v));
const countOk = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/** Problems with a spec (empty = valid). Checks shape, receipts and the enum/colour/count fields the runtime reads;
 *  the full intent rules apply only on the recipe route (toRecipe.ts runs validateIntent). */
export function specProblems(input: unknown): string[] {
  const spec = input as HouseSpec, p: string[] = [];
  if (!spec || typeof spec !== 'object') return ['a spec is an object'];
  if (spec.schemaVersion !== 1) p.push('schemaVersion must be 1');
  if (!/^\d{16}$/.test(spec.pandId ?? '')) p.push('pandId must be 16 digits (no NL.IMBAG.Pand. prefix)');
  if (!spec.design || typeof spec.design !== 'object' || Array.isArray(spec.design)) p.push('design must be an object');
  if (spec.design?.fronts !== undefined && !Array.isArray(spec.design.fronts)) p.push('design.fronts must be a list');
  if (!spec.provenance || typeof spec.provenance !== 'object') p.push('provenance must be an object keyed by field path');
  for (const [key, prov] of Object.entries(spec.provenance ?? {})) {
    if (!SPEC_SOURCES.includes(prov?.source)) p.push(`provenance[${key}].source: ${JSON.stringify(prov?.source)} not in ${SPEC_SOURCES.join('|')}`);
    if (!(typeof prov?.confidence === 'number' && prov.confidence >= 0 && prov.confidence <= 1)) p.push(`provenance[${key}].confidence must be 0..1`);
    if (typeof prov?.ref !== 'string' || !prov.ref) p.push(`provenance[${key}].ref must name where to look`);
    if (prov?.at !== null && !DATE.test(prov?.at ?? '')) p.push(`provenance[${key}].at must be YYYY-MM-DD or null`);
  }
  if (p.length) return p;
  for (const [path, value] of specFields(spec)) {
    if (!provenanceOf(spec, path)) p.push(`${path}: no provenance covers this field`);
    const key = path.split('/').pop();
    if (path.startsWith('fronts/')) {
      if (key === 'gable' && !GABLES.includes(value as GableIntent)) p.push(`${path}: ${JSON.stringify(value)} not in ${GABLES.join('|')}`);
      if (key === 'storeys' && !countOk(value, 1, 30)) p.push(`${path}: expected integer 1..30`);
      if (key === 'bays' && !(countOk(value, 1, 30) || (Array.isArray(value) && value.length && value.every(v => countOk(v, 0, 30))))) p.push(`${path}: an integer 1..30 or one per storey`);
      if (key === 'hoist' && typeof value !== 'boolean') p.push(`${path}: boolean`);
      if (key === 'share' && !(typeof value === 'number' && value > 0 && value <= 1)) p.push(`${path}: a share of the wall 0..1`);
      if (key === 'street' && !(typeof value === 'string' && value.length > 0)) p.push(`${path}: a street name`);
    } else if (path.startsWith('palette/')) {
      if (key === 'wallMaterial' ? !WALL_MATERIALS.includes(value as typeof WALL_MATERIALS[number]) : ['brick', 'frame', 'door', 'shutters', 'stone', 'band', 'cornice', 'sash', 'glass'].includes(key!) && !colourOk(value)) p.push(`${path}: ${JSON.stringify(value)} is not a ${key === 'wallMaterial' ? WALL_MATERIALS.join('|') : 'colour (#rrggbb or a swatch)'}`);
    } else if (path === 'roof/material' && !ROOF_MATERIALS.includes(value as typeof ROOF_MATERIALS[number])) p.push(`${path}: ${JSON.stringify(value)} not in ${ROOF_MATERIALS.join('|')}`);
    else if (path === 'facts/facadeYear' && !countOk(value, 1200, 2100)) p.push(`${path}: a year 1200..2100`);
    else if (path === 'facts/elements' && !(Array.isArray(value) && value.every(v => typeof v === 'string'))) p.push(`${path}: a list of component ids`);
    else if (path === 'facts/pui' && !['shop', 'residential', 'warehouse'].includes(value as string)) p.push(`${path}: shop|residential|warehouse`);
  }
  // Several fronts on one facade (one street, or no street stated): each states its `share` of the wall, left to right, and the
  // shares sum to 1 (+-0.02). One front per street needs no share. (H5h round 3: the multi-front pands of the hand set.)
  const facades = new Map<string, unknown[]>();
  (spec.design?.fronts ?? []).forEach(f => { const k = String((f as { street?: string } | undefined)?.street ?? ''); (facades.get(k) ?? facades.set(k, []).get(k)!).push((f as { share?: unknown } | undefined)?.share); });
  for (const [street, shares] of facades) {
    if (shares.length < 2) continue;
    const at = street ? `design.fronts on ${street}` : 'design.fronts';
    if (shares.some(v => typeof v !== 'number')) p.push(`${at}: ${shares.length} fronts on one facade each state share`);
    else if (Math.abs((shares as number[]).reduce((x, y) => x + y, 0) - 1) > 0.02) p.push(`${at}: shares sum to ${(shares as number[]).reduce((x, y) => x + y, 0).toFixed(2)}, not 1`);
  }
  if (spec.schemaLimits !== undefined && !Array.isArray(spec.schemaLimits)) p.push('schemaLimits must be a list of {component, what}');
  for (const l of spec.schemaLimits ?? []) if (typeof l !== 'object' || toSpecLimit(l) === null) p.push(`schemaLimits: ${JSON.stringify(l)} must be {component, what} (non-empty strings)`);
  if (spec.route !== undefined && spec.route !== 'generic' && spec.route !== 'recipe') p.push('route must be generic|recipe');
  return p;
}

/** Validate a parsed spec; throws one error listing every problem (the style of buildingRecipe/intent.ts validateIntent). */
export function validateSpec(input: unknown): HouseSpec {
  const problems = specProblems(input);
  if (problems.length) throw new Error(`Invalid house spec ${(input as HouseSpec)?.pandId ?? '?'}:\n - ${problems.join('\n - ')}`);
  return input as HouseSpec;
}

/** An empty spec for a pand (no fields, no receipts): the identity of `resolveSpecs`. */
export const emptySpec = (pandId: string, address?: string): HouseSpec => ({ schemaVersion: 1, pandId, ...(address ? { address } : {}), design: {}, provenance: {} });

/** The 16-digit pand id of a BAG id in any of its spellings (`NL.IMBAG.Pand.0363…`, `0363…`). */
export const pandDigits = (id: string): string => /(\d{16})$/.exec(String(id))?.[1] ?? String(id);

/** A front's window bay count above the ground storey (the axis grid when stated), or undefined. */
export function frontBays(front: DeepPartial<FrontIntent> | undefined): number | undefined {
  if (!front) return undefined;
  if (Number.isInteger(front.axisGrid)) return front.axisGrid;
  const b = front.bays as number | number[] | undefined;
  if (Array.isArray(b)) { const upper = b.length > 1 ? b.slice(1) : b; const m = Math.max(...upper.filter(v => Number.isInteger(v))); return m > 0 ? m : undefined; }
  return Number.isInteger(b) && (b as number) > 0 ? b as number : undefined;
}

export type { IntentSource };
