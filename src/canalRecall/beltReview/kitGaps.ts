/**
 * Structured kit gaps (belt review R6, lane C, 2026-11-20): `review-data/belt-review/kit-gaps.json`, one entry per thing the
 * photo shows that the kit cannot draw, the houses it blocks, an example pin, and whether a lane is on it. New gaps go
 * here; docs/handoffs/kit-gaps.md stays as history. Stage 4 of the loop lists, per house, the description fields the kit
 * cannot draw (`kitCannotDraw`), so a pin on one of them is filed as a gap, not fixed by fitting the nearest option.
 *
 * Pure: no fs. scripts/belt-review/kit-gaps.ts harvests and writes the file; scripts/belt-review/describe.ts reads it.
 */
import { WINDOWS } from '../buildingRecipe/intent.ts';
import { drawableDesign, SPEC_GABLES, type SpecDesign } from '../houseSpec/spec.ts';
import type { DescField, DescFieldValue } from './description.ts';

export const KIT_GAP_STATUSES = ['open', 'in-progress', 'closed'] as const;
export type KitGapStatus = (typeof KIT_GAP_STATUSES)[number];

export interface KitGap {
  /** Stable id: `<component slug>-<8 hex of component + gap>` for harvested entries, a chosen slug for curated ones. */
  id: string;
  /** What the photo has that the kit cannot draw. */
  gap: string;
  /** The kit part (a window kind, a crown ornament, a roof form): the key the queue groups on. */
  component: string;
  /** 16-digit pand ids this gap keeps from matching its photo. */
  housesBlocked: string[];
  /** A pin or pose that shows it (`belt-review <face> pin <id>`, a pand id, a sheet path). */
  examplePin?: string;
  status: KitGapStatus;
  /** The lane, branch or commit that closed it (or is on it). */
  fixedBy?: string;
  /** `YYYY-MM-DD` the gap was first recorded. */
  since: string;
  /** Where it was recorded (a face intent, a spec's schemaLimits, kit-gaps.md section, a review pin). */
  refs?: string[];
  /** The description field it blocks (componentField), for stage 4. */
  field?: DescField | 'other';
}

export interface KitGapFile { version: 1; about: string; gaps: KitGap[] }

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Problems with a parsed kit-gaps.json (empty = valid). */
export function kitGapProblems(input: unknown): string[] {
  const f = input as KitGapFile, p: string[] = [];
  if (!f || typeof f !== 'object' || f.version !== 1 || !Array.isArray(f.gaps)) return ['kit-gaps.json is {version: 1, about, gaps: [...]}'];
  const ids = new Set<string>();
  f.gaps.forEach((g, i) => {
    const at = `gaps[${i}]${g?.id ? ` ${g.id}` : ''}`;
    if (typeof g?.id !== 'string' || !g.id) p.push(`${at}: id`);
    else if (ids.has(g.id)) p.push(`${at}: duplicate id`); else ids.add(g.id);
    if (typeof g?.gap !== 'string' || !g.gap.trim()) p.push(`${at}: gap text`);
    if (typeof g?.component !== 'string' || !g.component.trim()) p.push(`${at}: component`);
    if (!Array.isArray(g?.housesBlocked) || g.housesBlocked.some(h => !/^\d{16}$/.test(h))) p.push(`${at}: housesBlocked is a list of 16-digit pand ids`);
    if (!KIT_GAP_STATUSES.includes(g?.status)) p.push(`${at}: status ${KIT_GAP_STATUSES.join('|')}`);
    if (g?.status === 'closed' && !g.fixedBy) p.push(`${at}: a closed gap names fixedBy`);
    if (!DATE.test(g?.since ?? '')) p.push(`${at}: since YYYY-MM-DD`);
  });
  return p;
}
export function parseKitGaps(input: unknown): KitGapFile {
  const p = kitGapProblems(input);
  if (p.length) throw new Error(`invalid kit-gaps.json:\n - ${p.join('\n - ')}`);
  return input as KitGapFile;
}

/** The description field a kit component blocks (first match wins; `other` when none). */
const COMPONENT_FIELD: ReadonlyArray<[RegExp, DescField]> = [
  [/stoop|stair|flight|newel/i, 'stoop'],
  [/door|portal|entrance/i, 'door'],
  [/shop|pui|ground/i, 'ground'],
  [/cornice|entablature|frieze/i, 'cornice'],
  [/gable|crown|finial|scroll|pediment|parapet/i, 'crown'],
  [/dormer|roof|attic|mansard/i, 'roofStorey'],
  [/head|arch/i, 'heads'],
  [/surround|dressing|keystone|lintel/i, 'windowSurround'],
  [/window|glazing|sash|light/i, 'windows'],
  [/palette|wall|brick|colour|color|paint|stucco|stone|finish/i, 'wallColour'],
  [/storey/i, 'storeys'],
  [/bay/i, 'bays'],
];
export function componentField(component: string): DescField | 'other' {
  for (const [re, f] of COMPONENT_FIELD) if (re.test(component)) return f;
  return 'other';
}
/** The field a gap blocks: by its component, else (a legacy `facade` limit) by the words of the gap. */
export const gapField = (component: string, gap: string): DescField | 'other' => {
  const f = componentField(component);
  return f === 'other' || component === 'facade' ? (componentField(gap) === 'other' ? f : componentField(gap)) : f;
};

/** FNV-1a, 8 hex: a stable id suffix. */
export function hash8(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'gap';
export const harvestedGapId = (component: string, gap: string) => `${slug(component)}-${hash8(`${component}\u0000${gap}`)}`;

/** One harvested limit (a face schemaLimit or limitation, a spec's schemaLimits entry, a row limit, a read's gap). */
export interface LimitStatement { component: string; what: string; pands: string[]; ref: string; since: string }
/** Components that are notes about the evidence, not about the kit (registration, a reviewer's hold). */
export const NOT_KIT = /registration|reviewer hold|\bhold\b|measurement/i;

/**
 * Merge harvested limits into an existing gap list: an existing entry (same id) keeps its status, fixedBy, examplePin and
 * since, and gains the harvested houses and refs; a new statement becomes an `open` entry. Nothing is removed. Output is
 * sorted by id so a rerun is byte-stable.
 */
export function mergeKitGaps(existing: readonly KitGap[], harvested: readonly LimitStatement[]): KitGap[] {
  const byId = new Map(existing.map(g => [g.id, structuredClone(g)]));
  for (const h of harvested) {
    if (NOT_KIT.test(h.component)) continue;
    const id = harvestedGapId(h.component, h.what);
    const g = byId.get(id) ?? { id, gap: h.what, component: h.component, housesBlocked: [], status: 'open' as const, since: h.since, refs: [], field: gapField(h.component, h.what) };
    g.housesBlocked = [...new Set([...g.housesBlocked, ...h.pands])].sort();
    g.refs = [...new Set([...(g.refs ?? []), h.ref])].sort();
    if (h.since < g.since) g.since = h.since;
    byId.set(id, g);
  }
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The open (or in-progress) gaps that block a pand. */
export const gapsForPand = (gaps: readonly KitGap[], pandId: string): KitGap[] => gaps.filter(g => g.status !== 'closed' && g.housesBlocked.includes(pandId));

/** One description field the kit cannot draw as described. */
export interface CannotDraw { field: DescField | 'other'; value?: unknown; drawnAs?: unknown; why: string; gapId?: string }

/**
 * The description fields of one house the kit cannot draw: values outside the kit vocabulary (the spec-level reads that
 * drawableDesign maps to a stand-in or drops), and every open gap that names this pand.
 */
export function kitCannotDraw(pandId: string, fields: Partial<Record<DescField, DescFieldValue>>, gaps: readonly KitGap[]): CannotDraw[] {
  const out: CannotDraw[] = [];
  const v = (f: DescField) => fields[f]?.value;
  const front: Record<string, unknown> = {};
  if (typeof v('crown') === 'string') front.gable = v('crown');
  if (typeof v('heads') === 'string') front.windowHead = { kind: v('heads') };
  if (typeof v('windowSurround') === 'string') front.windowSurround = v('windowSurround');
  if (typeof v('cornice') === 'string') front.cornice = v('cornice');
  const d = v('dormers') as { count?: number; kind?: string } | undefined;
  if (d && typeof d === 'object' && ['plain', 'gabled', 'none'].includes(d.kind ?? '')) front.readDormers = d;
  const design: SpecDesign = { fronts: [front], ...(typeof v('wallFinish') === 'string' ? { palette: { wallMaterial: v('wallFinish') as never } } : {}) };
  const FIELD_OF: Record<string, DescField> = { gable: 'crown', windowHead: 'heads', windowSurround: 'windowSurround', cornice: 'cornice', readDormers: 'dormers', wallMaterial: 'wallFinish' };
  for (const ig of drawableDesign(design).ignored) {
    const key = ig.path.split('/').pop()!;
    out.push({ field: FIELD_OF[key] ?? 'other', value: ig.value, drawnAs: ig.drawnAs, why: ig.drawnAs === null ? 'held: no compiler draws this read yet' : `drawn as ${JSON.stringify(ig.drawnAs)}` });
  }
  const crown = v('crown');
  if (typeof crown === 'string' && !(SPEC_GABLES as readonly string[]).includes(crown)) out.push({ field: 'crown', value: crown, why: 'not a kit crown (a stand-in is drawn)' });
  const win = v('windows');
  if (typeof win === 'string' && !(WINDOWS as readonly string[]).includes(win) && !['tall-upper', 'cross'].includes(win)) out.push({ field: 'windows', value: win, why: 'not a kit window kind' });
  for (const g of gapsForPand(gaps, pandId)) out.push({ field: g.field ?? gapField(g.component, g.gap), why: `${g.component}: ${g.gap}`, gapId: g.id });
  return out;
}
