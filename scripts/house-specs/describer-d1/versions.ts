// D1-fix 2: prompt v4.2 against v4 on the same pands. Per shipped field (stage.ts STAGED: storeys, bays, bands, shop, basement,
// finish, and the staged classes of crown, head and cornice) accuracy or class precision with Wilson 95 % intervals on the
// pooled adjudicated truth (score.ts), plus the paired split (pands right in one read and wrong in the other). And the
// house-ground rows breakdown: every dwelling-ground storey miss by what the read and the truth say about the souterrain, the
// roof storey and the gable attic, to test the souterrain / bel-etage confusion.
//
//   node --import tsx scripts/house-specs/describer-d1/versions.ts --a answers-v4-crop --b answers-v42-crop [--ids cut-ids.txt] [--author-convention exclude|keep] [--out <json>]
import fs from 'node:fs';
import path from 'node:path';
import { groundKindOf, type DescriberAnswer } from '../../../src/canalRecall/houseSpec/describer.ts';
import { compare, readingOf, wilson, type Reading, type ScoreField } from '../../../src/canalRecall/houseSpec/describerScore.ts';
import { provenanceOf } from '../../../src/canalRecall/houseSpec/spec.ts';
import { loadAnswers, pooledTruth } from './score.ts';
import { handSpecFiles, loadTruth } from './truth.ts';
import { adjudicatedPands } from './adjudicate.ts';
import { CURVED } from './stage.ts';

/** Shipped fields scored as accuracy over every answered pand. */
export const SHIPPED_FIELDS: ScoreField[] = ['storeys', 'storeys±1', 'bays', 'bays±1', 'bands', 'bandKind', 'shop', 'basement', 'finish'];
/** Staged classes scored as precision (of the answers in the class, the share the truth agrees). */
export const STAGED_CLASSES: { field: ScoreField; label: string; is: (v: unknown) => boolean }[] = [
  { field: 'crown', label: 'crown cornice', is: v => v === 'cornice' },
  { field: 'crown', label: 'crown step', is: v => v === 'step' },
  { field: 'crown', label: 'crown neck/bell (curved)', is: v => CURVED.has(String(v)) },
  { field: 'head', label: 'head flat', is: v => v === 'flat' },
  { field: 'head', label: 'head segmental', is: v => v === 'segmental' },
  { field: 'cornice', label: 'cornice none', is: v => v === 'none' },
];

type Row = { label: string; k: number; n: number; acc: number; ci: [number, number] };
const row = (label: string, k: number, n: number): Row => ({ label, k, n, acc: +(k / Math.max(1, n)).toFixed(3), ci: wilson(k, n) });

/** Curved crowns score as one class: a neck read on a bell truth is right (stage.ts CURVED). */
function cellOk(field: ScoreField, a: unknown, b: unknown, ok: boolean): boolean {
  if (field === 'crown' && CURVED.has(String(a))) return Array.isArray(b) ? b.some(x => CURVED.has(String(x))) : CURVED.has(String(b));
  return ok;
}

export function fieldTable(A: Map<string, DescriberAnswer>, truth: Map<string, Reading>) {
  const out: Record<string, Row> = {}, right = new Map<string, Map<string, boolean>>();
  const tallies: Record<string, [number, number]> = {};
  for (const [id, a] of A) {
    const t = truth.get(id); if (!t) continue;
    const r = readingOf(a); if (r.scorable === false) continue;
    const m = new Map<string, boolean>(); right.set(id, m);
    for (const c of compare(r, t)) {
      if (SHIPPED_FIELDS.includes(c.field)) { const x = (tallies[c.field] ??= [0, 0]); x[1]++; if (c.ok) x[0]++; m.set(c.field, c.ok); }
      for (const s of STAGED_CLASSES) if (s.field === c.field && s.is(c.a)) { const ok = cellOk(c.field, c.a, c.b, c.ok); const x = (tallies[s.label] ??= [0, 0]); x[1]++; if (ok) x[0]++; m.set(s.label, ok); }
    }
  }
  for (const [k, [ok, n]] of Object.entries(tallies)) out[k] = row(k, ok, n);
  return { rows: out, right };
}

/** Truth souterrain / attic flags per pand: hand set v1 (pand fields) and author specs (fronts/0/souterrain or basement). */
export function truthFlags(root: string): Map<string, { souterrain?: boolean; atticInCrown?: boolean; entresol?: boolean }> {
  const out = new Map<string, { souterrain?: boolean; atticInCrown?: boolean; entresol?: boolean }>();
  for (const p of JSON.parse(fs.readFileSync(path.join(root, 'data/house-line/hand-set-v1.json'), 'utf8')).pands) {
    const f = p.fields ?? {};
    out.set(p.pandId, { souterrain: f.souterrain ?? false, atticInCrown: f.atticInCrown ?? false, entresol: f.entresol ?? false });
  }
  for (const { spec } of handSpecFiles(root)) {
    if (out.has(spec.pandId)) continue;
    const f: any = spec.design.fronts?.[0]; if (!f) continue;
    const own = (k: string) => ['author', 'reviewed'].includes(provenanceOf(spec, `fronts/0/${k}`)?.source ?? '');
    if (own('souterrain') || own('basement') || own('storeys')) out.set(spec.pandId, { souterrain: !!f.souterrain && f.basement !== 'none' });
  }
  return out;
}

export function groundBreakdown(A: Map<string, DescriberAnswer>, truth: Map<string, Map<string, Reading>>, flags: ReturnType<typeof truthFlags>, kind = 'dwelling') {
  const table: Record<string, number> = {};
  let n = 0, ok = 0;
  for (const [id, a] of A) {
    if (!a.readable || a.extent === 'multi' || !Number.isInteger(a.storeys) || groundKindOf(a) !== kind) continue;
    const sets = truth.get(id); const t = sets && pooledTruth(sets); if (!t || typeof t.storeys !== 'number') continue;
    n++;
    const d = (a.storeys as number) - t.storeys;
    if (!d) { ok++; continue; }
    const set = ['benchmark', 'hand-set', 'hand-spec'].find(s => (sets!.get(s) as Reading | undefined)?.storeys !== undefined);
    const tf = flags.get(id) ?? {};
    const sp = a.storeyParts;
    const readSout = sp?.souterrain === true || a.souterrain === true;
    const cause = d < 0
      ? (readSout && !tf.souterrain ? 'read a souterrain the truth counts as the ground storey (bel-etage confusion)'
        : ['mansard', 'roof-storey'].includes(String(sp?.roof)) ? 'read a roof storey the truth counts'
        : sp?.roof === 'gable-attic' ? 'read a gable attic the truth counts'
        : tf.souterrain ? 'truth souterrain, read none, still one short' : 'other under')
      : (tf.souterrain && !readSout ? 'counted the truth souterrain as a storey (bel-etage confusion)'
        : tf.atticInCrown ? 'counted the truth attic in the crown'
        : tf.entresol ? 'counted the truth entresol' : 'other over');
    const k = `${d < 0 ? 'under' : 'over'} ${Math.abs(d)} | ${cause} | truth ${set} | read souterrain ${readSout} / truth ${tf.souterrain ?? '?'} | read roof ${sp?.roof ?? '?'}`;
    table[k] = (table[k] ?? 0) + 1;
  }
  return { n, ok, exact: row(`${kind} rows exact`, ok, n), misses: Object.entries(table).sort((x, y) => y[1] - x[1]) };
}

function main() {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
  const D = path.join(ROOT, 'artifacts/describer-d1');
  const args = process.argv.slice(2), opt = (k: string) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : undefined);
  const dir = (d: string) => (path.isAbsolute(d) ? d : path.join(D, d));
  const a = opt('a') ?? 'answers-v4-crop', b = opt('b') ?? 'answers-v42-crop';
  const A = loadAnswers(dir(a)), B = loadAnswers(dir(b));
  const keep = new Set(opt('ids') === 'none' ? [...A.keys()] : fs.readFileSync(dir(opt('ids') ?? 'cut-ids.txt'), 'utf8').split(/\s+/).filter(Boolean));
  for (const M of [A, B]) for (const id of [...M.keys()]) if (!keep.has(id) || !(A.has(id) && B.has(id))) M.delete(id);
  // author-convention storey counts (truth.ts authorConvention) are excluded by default (ruling D1-fix 3); --author-convention keep
  const conv = (opt('author-convention') ?? 'exclude') as 'keep' | 'exclude';
  const sets = loadTruth(ROOT, adjudicatedPands(), { authorConvention: conv });
  const pooled = new Map<string, Reading>(); for (const [id, s] of sets) { const t = pooledTruth(s); if (t) pooled.set(id, t); }
  const ta = fieldTable(A, pooled), tb = fieldTable(B, pooled);
  const md = [`### ${a} vs ${b} on the same ${A.size} pands (pooled adjudicated truth; author-convention storeys: ${conv})`, '', `| field | ${a} | ${b} | change | ${a} right, ${b} wrong | reverse |`, '|---|---|---|---|---|---|'];
  const fields: Record<string, unknown> = {};
  for (const k of [...SHIPPED_FIELDS, ...STAGED_CLASSES.map(s => s.label)]) {
    const x = ta.rows[k], y = tb.rows[k]; if (!x && !y) continue;
    let ab = 0, ba = 0;
    for (const [id, m] of ta.right) { const n2 = tb.right.get(id); if (!n2 || !m.has(k) || !n2.has(k)) continue; if (m.get(k) && !n2.get(k)) ab++; if (!m.get(k) && n2.get(k)) ba++; }
    fields[k] = { a: x, b: y, aRightBWrong: ab, bRightAWrong: ba };
    const f = (r?: Row) => (r ? `${r.acc} (${r.k}/${r.n}) [${r.ci.join('-')}]` : '-');
    md.push(`| ${k} | ${f(x)} | ${f(y)} | ${x && y ? (y.acc - x.acc >= 0 ? '+' : '') + (y.acc - x.acc).toFixed(3) : ''} | ${ab} | ${ba} |`);
  }
  const flags = truthFlags(ROOT);
  const ground: Record<string, unknown> = {};
  for (const [name, M] of [[a, A], [b, B]] as const) {
    const g = groundBreakdown(M, sets, flags);
    ground[name] = g;
    md.push('', `#### ${name}: house-ground (dwelling) rows exact ${g.exact.acc} (${g.ok}/${g.n}) [${g.exact.ci.join('-')}]`, '', '| miss | pands |', '|---|---|', ...g.misses.map(([k, v]) => `| ${k} | ${v} |`));
  }
  fs.writeFileSync(opt('out') ?? path.join(D, 'versions-v4-v42.json'), `${JSON.stringify({ v: 1, a, b, authorConvention: conv, pands: A.size, fields, ground }, null, 1)}\n`);
  console.log(md.join('\n'));
}
if (import.meta.url === `file://${process.argv[1]}`) main();
