// D1-fix 2: per-row window heads scored per class. A describer answer's `heads` (one per row, ground first) against per-row truth:
//   benchmark  adjudicated benchmark-v1 labels whose windowHead is one class (flat / segmental / round; `mixed` says nothing per
//              row): every upper row carries it;
//   hand-spec  author specs whose windowHead or archedStoreys carries an author/reviewed receipt: archedStoreys rows round, the
//              windowHead kind on its `storeys` (default every upper row; relieving reads flat), every other upper row flat.
// A pand is scored only when the read's row count equals the truth's storeys (so row i is the same storey on both sides). Upper
// rows only. Per class: precision (of the rows read as that class, the share the truth agrees) and recall, Wilson 95 %, plus
// the number of pands behind each figure (rows of one house are not independent).
//
//   node --import tsx scripts/house-specs/describer-d1/heads.ts [--answers <dir>,<dir>...] [--out <json>]
import fs from 'node:fs';
import path from 'node:path';
import { provenanceOf } from '../../../src/canalRecall/houseSpec/spec.ts';
import { wilson } from '../../../src/canalRecall/houseSpec/describerScore.ts';
import { loadAnswers } from './score.ts';
import { handSpecFiles } from './truth.ts';
import { adjudicatedPands } from './adjudicate.ts';

export const ROW_CLASSES = ['flat', 'segmental', 'round'] as const;
type Cls = (typeof ROW_CLASSES)[number];
const cls = (h: string | undefined): Cls | undefined => (h === 'relieving' ? 'flat' : (ROW_CLASSES as readonly string[]).includes(h ?? '') ? h as Cls : undefined);

/** Per-row truth (index = storey, ground first; index 0 undefined) from a spec front with author head fields. */
export function specRowHeads(front: any, storeys: number, ownHead: boolean, ownArched: boolean): (Cls | undefined)[] | null {
  if (!ownHead && !ownArched) return null;
  const rows: (Cls | undefined)[] = Array.from({ length: storeys }, (_, s) => (s ? 'flat' : undefined));
  const h = ownHead ? front.windowHead : undefined;
  if (h?.kind) for (let s = 1; s < storeys; s++) if (!h.storeys || h.storeys.includes(s)) rows[s] = cls(h.kind);
  if (ownArched) for (const s of front.archedStoreys ?? []) if (s > 0 && s < storeys) rows[s] = 'round';
  if (front.windows === 'arched') for (let s = 1; s < storeys; s++) rows[s] = 'round';
  return rows;
}

export function truthRows(root: string): Map<string, (Cls | undefined)[]> {
  const out = new Map<string, (Cls | undefined)[]>();
  for (const p of adjudicatedPands()) {
    const L = p.labels; if (!p.readable || !L || !Number.isInteger(L.storeys) || L.oneFront === false) continue;
    const c = cls(L.windowHead); if (!c || L.windowHead === 'relieving') continue;
    out.set(String(p.pandId), Array.from({ length: L.storeys }, (_, s) => (s ? c : undefined)));
  }
  for (const { spec } of handSpecFiles(root)) {
    if (out.has(spec.pandId)) continue;
    const f: any = spec.design.fronts?.[0]; if (!f || (spec.design.fronts?.length ?? 0) > 1 || !Number.isInteger(f.storeys)) continue;
    const own = (k: string) => ['author', 'reviewed'].includes(provenanceOf(spec, `fronts/0/${k}`)?.source ?? '');
    const r = specRowHeads(f, f.storeys, own('windowHead'), own('archedStoreys') || (own('windows') && f.windows === 'arched'));
    if (r) out.set(spec.pandId, r);
  }
  return out;
}

export function scoreRows(answers: Map<string, { readable: boolean; heads: readonly string[] }>, truth: Map<string, (Cls | undefined)[]>) {
  const t: Record<string, { tp: number; read: number; truth: number; pands: Set<string>; truthPands: Set<string> }> = {};
  for (const c of ROW_CLASSES) t[c] = { tp: 0, read: 0, truth: 0, pands: new Set(), truthPands: new Set() };
  const confusion: Record<string, number> = {};
  let pands = 0;
  for (const [id, a] of answers) {
    const tr = truth.get(id); if (!tr || !a.readable || a.heads.length !== tr.length) continue;
    pands++;
    for (let s = 1; s < tr.length; s++) {
      const r = cls(a.heads[s]), g = tr[s]; if (!r || !g) continue;
      confusion[`${r}->${g}`] = (confusion[`${r}->${g}`] ?? 0) + 1;
      t[r].read++; t[r].pands.add(id); t[g].truth++; t[g].truthPands.add(id);
      if (r === g) t[r].tp++;
    }
  }
  const per = Object.fromEntries(ROW_CLASSES.map(c => [c, { rowsRead: t[c].read, pandsRead: t[c].pands.size, precision: t[c].read ? +(t[c].tp / t[c].read).toFixed(3) : null, precisionCI: wilson(t[c].tp, t[c].read),
    rowsTruth: t[c].truth, pandsTruth: t[c].truthPands.size, recall: t[c].truth ? +(t[c].tp / t[c].truth).toFixed(3) : null, recallCI: wilson(t[c].tp, t[c].truth) }]));
  return { pands, per, confusion };
}

function main() {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
  const D = path.join(ROOT, 'artifacts/describer-d1');
  const args = process.argv.slice(2), opt = (k: string) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : undefined);
  const dirs = (opt('answers') ?? 'answers-v4-crop,answers-v4-cut,answers-v42-crop,answers-v3,answers').split(',').filter(d => fs.existsSync(path.isAbsolute(d) ? d : path.join(D, d)));
  const truth = truthRows(ROOT);
  const truthRound = [...truth.values()].filter(r => r.includes('round')).length;
  const report: Record<string, unknown> = {}, md = [`Per-row truth: ${truth.size} pands (${truthRound} with a round row).`, ''];
  for (const d of dirs) {
    const r = scoreRows(loadAnswers(path.isAbsolute(d) ? d : path.join(D, d)) as any, truth);
    report[d] = r;
    md.push(`### ${d}: ${r.pands} pands with aligned rows`, '', '| class | rows read (pands) | precision | 95 % CI | rows in truth (pands) | recall |', '|---|---|---|---|---|---|',
      ...ROW_CLASSES.map(c => { const x = (r.per as any)[c]; return `| ${c} | ${x.rowsRead} (${x.pandsRead}) | ${x.precision ?? '-'} | ${x.precisionCI.join('-')} | ${x.rowsTruth} (${x.pandsTruth}) | ${x.recall ?? '-'} |`; }),
      '', `read->truth: ${JSON.stringify(r.confusion)}`, '');
  }
  fs.writeFileSync(opt('out') ?? path.join(D, 'heads-per-row.json'), `${JSON.stringify({ v: 1, truthPands: truth.size, truthRound, report }, null, 1)}\n`);
  console.log(md.join('\n'));
}
if (import.meta.url === `file://${process.argv[1]}`) main();
