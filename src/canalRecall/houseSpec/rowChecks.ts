/**
 * check:rows gates (lane P, house rows first, 2026-11-14). Pure checks over a row flattened to `RowCheckRow`: one
 * member per front, in street order, each carrying the series it belongs to, its solved design and what became of
 * every field the reader or the face intent stated. Lane D's `houseSpec/row/types.ts` RowRecord is flattened into
 * this shape by `scripts/house-specs/rows/check-rows.ts` (the one adapter), so the gates do not depend on D's layout.
 *
 * Gates (programme brief, lane P): a series resolves to one design apart from the per-house fields; the cornice step
 * inside a series is at most 0.2 m; no extra outside the allow-list on a member; no hash roof on a member; every read
 * field is drawn, settled by the series or reported "read, not drawn". Unstated never means dice (rule 2).
 */
import { ROW_FRONT_EXTRAS } from '../houseLine/rowFront.ts';

/** Fields that may differ inside one series: what is true of one house only (rule 1). Everything else is the series'. */
export const PER_HOUSE_FIELDS = ['groundUse', 'doorSide', 'doorIndex', 'paint', 'shopfront', 'basement', 'extent', 'number', 'pandId', 'dormerVariant', 'headVariant'] as const;
// headVariant: a front's heads set by a reviewed statement (row/check.ts emits it only for source `reviewed`).
/** Largest cornice step (m) between neighbours of one series. */
export const MAX_CORNICE_STEP_M = 0.2;
/** What became of a read field: drawn as stated, settled by series consensus, or printed as read, not drawn. */
export type FieldFate = 'drawn' | 'settled' | 'reported';
export type RoofSource = 'series' | 'record' | 'lid' | 'hash';

export interface RowCheckMember {
  /** BAG pand id, plus the front index when a pand holds two fronts (`0363100012236027#1`). */
  key: string;
  pandId: string;
  /** House numbers the front covers (a two-number pand has two fronts, each with its own number). */
  numbers: string[];
  series: string;
  /** The solved design as flat comparable fields (class fields as strings or numbers; metre fields as numbers). */
  design: Record<string, string | number | boolean | null>;
  corniceM: number | null;
  roof: { kind: string; source: RoofSource; dormers?: number; dormerKind?: string; gable?: string | null };
  extras: string[];
  /** Extras the type or the reader states (allowed beside ROW_FRONT_EXTRAS). */
  statedExtras?: string[];
  /** Every field that was read, and what became of it. */
  fields: Record<string, { fate: FieldFate; reason?: string }>;
  /** Anything staged for the front; false when it was withheld (scaffold, unreadable). */
  staged: boolean;
  /** The reader's note mentions scaffold or netting over the upper storeys. */
  scaffold?: boolean;
}
export interface RowCheckRow { row: string; members: RowCheckMember[] }
export interface Finding { gate: string; row: string; key: string; message: string }

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const modeOf = <T>(xs: T[]): T | undefined => {
  const m = new Map<string, { v: T; n: number }>();
  for (const x of xs) { const k = JSON.stringify(x); const e = m.get(k); if (e) e.n++; else m.set(k, { v: x, n: 1 }); }
  return [...m.values()].sort((a, b) => b.n - a.n)[0]?.v;
};

export function seriesOf(row: RowCheckRow): Map<string, RowCheckMember[]> {
  const out = new Map<string, RowCheckMember[]>();
  for (const m of row.members) (out.get(m.series) ?? out.set(m.series, []).get(m.series)!).push(m);
  return out;
}

/** Members of a series resolve to one design: every non-per-house field equals the series mode. */
export function checkOneDesign(row: RowCheckRow, perHouse: readonly string[] = PER_HOUSE_FIELDS): Finding[] {
  const out: Finding[] = [];
  for (const [series, ms] of seriesOf(row)) {
    if (ms.length < 2) continue;
    const fields = new Set(ms.flatMap(m => Object.keys(m.design)));
    for (const f of fields) {
      if (perHouse.includes(f)) continue;
      const mode = modeOf(ms.map(m => m.design[f] ?? null));
      for (const m of ms) if (!same(m.design[f] ?? null, mode)) out.push({ gate: 'one-design', row: row.row, key: m.key, message: `series ${series}: ${f} is ${JSON.stringify(m.design[f] ?? null)}, the series has ${JSON.stringify(mode)}` });
    }
  }
  return out;
}

/** The cornice step between neighbours of one series (street order) stays within MAX_CORNICE_STEP_M. */
export function checkCorniceStep(row: RowCheckRow, maxStepM = MAX_CORNICE_STEP_M): Finding[] {
  const out: Finding[] = [];
  const ms = row.members;
  for (let i = 1; i < ms.length; i++) {
    const a = ms[i - 1], b = ms[i];
    if (a.series !== b.series || a.corniceM == null || b.corniceM == null) continue;
    const step = Math.abs(a.corniceM - b.corniceM);
    if (step > maxStepM + 1e-9) out.push({ gate: 'cornice-step', row: row.row, key: b.key, message: `cornice ${b.corniceM.toFixed(2)} m against ${a.key} ${a.corniceM.toFixed(2)} m: step ${step.toFixed(2)} m > ${maxStepM} m inside series ${b.series}` });
  }
  return out;
}

/** No extra on a member outside ROW_FRONT_EXTRAS plus the extras its type or reading states. */
export function checkExtras(row: RowCheckRow, allow: readonly string[] = ROW_FRONT_EXTRAS): Finding[] {
  const out: Finding[] = [];
  for (const m of row.members) {
    const ok = new Set([...allow, ...(m.statedExtras ?? [])]);
    const bad = m.extras.filter(e => !ok.has(e));
    if (bad.length) out.push({ gate: 'extras', row: row.row, key: m.key, message: `extras outside the allow-list: ${bad.join(', ')}` });
  }
  return out;
}

/** A member's roof is the series' roof, its record's crown or a lid at its front top; never the hash roll. */
export function checkNoHashRoof(row: RowCheckRow): Finding[] {
  return row.members.filter(m => m.roof.source === 'hash').map(m => ({ gate: 'hash-roof', row: row.row, key: m.key, message: `roof ${m.roof.kind} comes from the hash roll, not the row` }));
}

/** Every read field is drawn, settled or reported with its reason (rule 3: no silent drops). */
export function checkFieldsAccounted(row: RowCheckRow): Finding[] {
  const out: Finding[] = [];
  for (const m of row.members) for (const [f, v] of Object.entries(m.fields)) {
    if (!v || !['drawn', 'settled', 'reported'].includes(v.fate)) out.push({ gate: 'read-fields', row: row.row, key: m.key, message: `read field ${f} has no fate (drawn, settled or reported)` });
    else if (v.fate === 'reported' && !v.reason) out.push({ gate: 'read-fields', row: row.row, key: m.key, message: `read field ${f} is reported "read, not drawn" without a reason` });
  }
  return out;
}

export function checkRow(row: RowCheckRow): Finding[] {
  return [...checkOneDesign(row), ...checkCorniceStep(row), ...checkExtras(row), ...checkNoHashRoof(row), ...checkFieldsAccounted(row)];
}

// ---- Named regressions (OSM / BAG pins from the 2026-11-14 rejection; programme brief, lane P) -------------------

export interface Regression { id: string; what: string; pands: string[]; check(rows: RowCheckRow[]): { status: 'pass' | 'fail' | 'no-records'; message: string } }
const find = (rows: RowCheckRow[], pandId: string) => rows.flatMap(r => r.members).filter(m => m.pandId === pandId || m.pandId.endsWith(pandId));

export const NAMED_REGRESSIONS: Regression[] = [
  { id: 'kinker-106-108-two-fronts', what: '0363100012236027 (Kinkerstraat 106-108, 8.8 m) is two fronts, not one six-bay front', pands: ['0363100012236027'],
    check: rows => { const ms = find(rows, '0363100012236027'); if (!ms.length) return { status: 'no-records', message: 'pand not in any record' };
      return ms.length === 2 ? { status: 'pass', message: 'two fronts' } : { status: 'fail', message: `${ms.length} front(s), expected 2` }; } },
  { id: 'kinker-100-104-identical', what: '159635, 152925 and 160809 (Kinkerstraat 104, 102, 100) resolve to one design and one roof', pands: ['0363100012159635', '0363100012152925', '0363100012160809'],
    check: rows => { const ms = ['0363100012159635', '0363100012152925', '0363100012160809'].flatMap(p => find(rows, p)); if (ms.length < 3) return { status: 'no-records', message: `${ms.length} of 3 pands in the records` };
      const d = new Set(ms.map(m => JSON.stringify([Object.fromEntries(Object.entries(m.design).filter(([k]) => !(PER_HOUSE_FIELDS as readonly string[]).includes(k))), m.corniceM, m.roof.kind, m.roof.dormers ?? 0, m.roof.dormerKind ?? null, m.roof.gable ?? null])));
      const sameSeries = new Set(ms.map(m => m.series)).size === 1;
      return d.size === 1 && sameSeries ? { status: 'pass', message: 'identical' } : { status: 'fail', message: `${d.size} distinct designs across ${new Set(ms.map(m => m.series)).size} series` }; } },
  { id: 'kinker-92-94-scaffold', what: '236213 (Kinkerstraat 92-94) was first read through scaffold netting: nothing is staged from a held read (a re-read from another capture year may draw)', pands: ['0363100012236213'],
    check: rows => { const ms = find(rows, '0363100012236213'); if (!ms.length) return { status: 'no-records', message: 'pand not in any record' };
      const bad = ms.filter(m => m.staged && m.scaffold && Object.values(m.fields).some(f => f.fate === 'drawn'));
      return bad.length ? { status: 'fail', message: 'a field read through scaffold is drawn' } : { status: 'pass', message: 'nothing drawn from the scaffold read' }; } },
  { id: 'wetering-169016-mansard', what: '0363100012169016 (Weteringschans) has a slate mansard with a dormer and no pointed gable', pands: ['0363100012169016'],
    check: rows => { const ms = find(rows, '0363100012169016'); if (!ms.length) return { status: 'no-records', message: 'pand not in any record' };
      const m = ms[0]; const ok = m.roof.kind === 'mansard' && (m.roof.dormers ?? 0) >= 1 && !m.roof.gable;
      return ok ? { status: 'pass', message: 'mansard with dormer, no gable' } : { status: 'fail', message: `roof ${m.roof.kind}, dormers ${m.roof.dormers ?? 0}, gable ${m.roof.gable ?? 'none'}` }; } },
];

export function runRegressions(rows: RowCheckRow[]) { return NAMED_REGRESSIONS.map(r => ({ id: r.id, what: r.what, ...r.check(rows) })); }
