/**
 * Describer scoring (lane D1, house plan P1 / P3a): per-field agreement between two description sets of the same pands. One side is a
 * set of describer answers (describer.ts); the other is either a truth set (benchmark labels, the hand set, hand specs: normalised to
 * a `Reading` by scripts/house-specs/describer-d1/truth.ts) or a second describer set (the P3a photo-vs-game comparison: both sides
 * are answers, `readingOf` on each). Pure: no files.
 *
 * A Reading field is a value or a list of acceptable values (a truth vocabulary coarser than the describer's, e.g. the benchmark's
 * `orange-red` accepts `orange` and `red`). Absent or `unknown` on either side = not scored for that pand.
 */
import { TALL_UPPER, UNKNOWN, upperHead, type DescriberAnswer } from './describer.ts';
import type { WindowKind } from '../buildingRecipe/intent.ts';

/** Every scored field. Counts are scored exact and within one (`bays±1`, `storeys±1`). */
export const SCORE_FIELDS = [
  'storeys', 'storeys±1', 'bays', 'bays±1',
  'windowGroup', 'windowFamily', 'windows', 'paneLayout', 'head', 'storeyHeads',
  'bands', 'bandKind', 'surrounds', 'windowSurround', 'sills',
  'doorBay', 'shop', 'basement', 'crown', 'cornice', 'wallFamily', 'pale', 'finish',
] as const;
export type ScoreField = (typeof SCORE_FIELDS)[number];
type Val = string | number | boolean;
export type Reading = Partial<Record<Exclude<ScoreField, 'storeys±1' | 'bays±1'>, Val | Val[]>> & { pandId: string; scorable?: boolean };

/** Window families, coarse enough for the benchmark's reading vocabulary (sash / T-window / casement / large-pane). A casement pair
 *  under a top light is the benchmark's T-window ("top light over two casements"), whatever the top light's bars. */
export function windowFamily(w: WindowKind | string): string {
  if (w === 't-window' || w === 'small-over-one' || w === 'casement-toplight' || w === 'casement-gridded-toplight' || w === 'casement-toplight-double' || w === 'casement-gridded-toplight-double' || w === 'casement-sidelights-toplight') return 'T-window';
  if (w.startsWith('sash') || w === 'six-pane') return 'sash';
  if (w === 'plain' || w === 'shop') return 'large-pane';
  if (w.startsWith('casement') || w === 'two-light' || w === 'cross' || w === 'cross-transom' || w === 'ladder') return 'casement';
  return 'other';
}
/** Window group (prompt v3): sash and T-window merged into `tall`; casement and large-pane as in windowFamily. */
export const windowGroup = (family: string): string => (family === 'sash' || family === 'T-window' || family === TALL_UPPER ? 'tall' : family);
/** Surround present: a dressing round the opening (frame, lintel, keystone), not a bare sill. */
export const hasSurround = (s: string): boolean => !['none', 'sill', UNKNOWN].includes(s);

/** An answer as a Reading (unknowns dropped; an unreadable answer reads nothing). */
export function readingOf(a: DescriberAnswer): Reading {
  const r: Reading = { pandId: a.pandId, scorable: a.readable && a.extent !== 'multi' };
  if (!a.readable) return r;
  const set = (k: keyof Reading, v: Val | undefined) => { if (v !== undefined && v !== UNKNOWN) (r as any)[k] = v; };
  set('storeys', a.storeys); set('bays', a.bays);
  if (a.windows === TALL_UPPER) set('windowGroup', 'tall');
  else if (a.windows !== UNKNOWN) { set('windows', a.windows); set('windowFamily', windowFamily(a.windows)); set('windowGroup', windowGroup(windowFamily(a.windows))); }
  const head = upperHead(a.heads);
  set('head', head === 'relieving' ? 'flat' : head);
  if (a.heads.length && !a.heads.includes(UNKNOWN)) set('storeyHeads', a.heads.join(','));
  if (a.bands !== UNKNOWN) { set('bands', a.bands !== 'none'); set('bandKind', a.bands); }
  if (a.windowSurround !== UNKNOWN) { set('surrounds', hasSurround(a.windowSurround)); set('windowSurround', a.windowSurround === 'none' && a.sills === 'stone' ? 'sill' : a.windowSurround); }
  set('sills', a.sills);
  const pane = (a as { paneLayout?: unknown }).paneLayout; // the zoomed window read (window-v1.md)
  if (typeof pane === 'string') set('paneLayout', pane);
  set('doorBay', a.doorBay);
  if (a.ground !== UNKNOWN) set('shop', a.ground === 'shopfront');
  if (a.basement !== UNKNOWN) set('basement', a.basement !== 'none' || !!a.souterrain);
  set('crown', a.crown); set('cornice', a.cornice); set('wallFamily', a.wallFamily); set('finish', a.finish);
  // prompt v4: pale yes/no in words (the hex comes from a wall sample); before v4, pale = a white or buff family
  const pale = (a as { pale?: unknown }).pale;
  if (typeof pale === 'boolean') set('pale', pale);
  else if (a.wallFamily !== UNKNOWN) set('pale', a.wallFamily === 'white' || a.wallFamily === 'buff');
  return r;
}

export type Cell = { field: ScoreField; a: Val; b: Val | Val[]; ok: boolean };

/** Compare reading `a` (a describer) with `b` (truth, or a second describer) field by field: the scored cells. */
export function compare(a: Reading, b: Reading, fields: readonly ScoreField[] = SCORE_FIELDS): Cell[] {
  const out: Cell[] = [];
  for (const f of fields) {
    const base = f.replace('±1', '') as keyof Reading;
    const va = a[base] as Val | Val[] | undefined, vb = b[base] as Val | Val[] | undefined;
    if (va === undefined || vb === undefined || va === UNKNOWN || vb === UNKNOWN || va === 'unknown' || vb === 'unknown' || Array.isArray(va)) continue;
    if (Array.isArray(vb) && !vb.length) continue;
    const ok = f.endsWith('±1') ? Math.abs(Number(va) - Number(vb)) <= 1 : Array.isArray(vb) ? vb.includes(va) : va === vb;
    out.push({ field: f, a: va, b: vb, ok });
  }
  return out;
}

/** Wilson 95 % interval (scripts/house-specs/agreement.ts uses the same formula). */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (!n) return [0, 1];
  const p = k / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), r = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [+Math.max(0, (c - r) / d).toFixed(3), +Math.min(1, (c + r) / d).toFixed(3)];
}

export type FieldScore = { field: ScoreField; k: number; n: number; acc: number | null; lo: number; hi: number; pass: boolean };
/** Accuracy per field over the cells of many pands; `pass` = accuracy >= `bar` (default 0.8, the step-2 bar). */
export function tabulate(cells: readonly Cell[], bar = 0.8, fields: readonly ScoreField[] = SCORE_FIELDS): FieldScore[] {
  return fields.map(field => {
    const xs = cells.filter(c => c.field === field), k = xs.filter(c => c.ok).length, n = xs.length;
    const [lo, hi] = wilson(k, n);
    return { field, k, n, acc: n ? +(k / n).toFixed(3) : null, lo, hi, pass: n > 0 && k / n >= bar };
  });
}

/** Confusion counts `a -> b` for one field (b a list prints as its first value + `|...`). */
export function confusion(cells: readonly Cell[], field: ScoreField): Record<string, Record<string, number>> {
  const m: Record<string, Record<string, number>> = {};
  for (const c of cells) if (c.field === field) {
    const b = Array.isArray(c.b) ? c.b.join('|') : String(c.b), a = String(c.a);
    (m[b] ??= {})[a] = (m[b][a] ?? 0) + 1;
  }
  return m;
}
