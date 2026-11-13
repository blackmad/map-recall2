// Twin copy guard (integrator ruling on step 1c): a front copies its twin only when the describer's `sameAs` names that side
// AND PR1's `similar` holds for the pair (built within 3 years, street-run width within 0.3 m, exposed height within 0.8 m;
// partyPairs.ts on PR1's probe records). Scores the guarded copy on the twin-v2 truth rows: precision and recall per side.
//
//   node --import tsx scripts/house-specs/describer-d1/twin-guard.ts [--probes <probe-cache.json>] [--out <json>]
import fs from 'node:fs';
import path from 'node:path';
import { similar, type Probe } from './partyPairs.ts';
import { wilson } from '../../../src/canalRecall/houseSpec/describerScore.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const D = path.join(ROOT, 'artifacts/describer-d1');
const args = process.argv.slice(2), opt = (k: string) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : undefined);
const probes: Record<string, Probe> = JSON.parse(fs.readFileSync(opt('probes') ?? '/Users/blackmad/Code/map-recall2-worktrees/structure-priors-20261113/artifacts/structure-priors/probe-cache.json', 'utf8'));
const truth = JSON.parse(fs.readFileSync(path.join(D, 'twins-v2.json'), 'utf8')).rows as any[];
const A = path.join(D, 'answers-twins-v2');

const tally = { plain: { tp: 0, fp: 0, fn: 0 }, guarded: { tp: 0, fp: 0, fn: 0 } };
const rows: unknown[] = [];
for (const r of truth) {
  const f = path.join(A, `${r.pandId}.json`);
  if (!fs.existsSync(f)) continue;
  const a = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const side of ['left', 'right'] as const) {
    const t = r[side];
    if (!t || t.twin === null || t.twin === undefined) continue;
    const said = a.sameAs === side || a.sameAs === 'both';
    const pa = probes[r.pandId], pb = probes[t.id];
    const sim = !!(pa && pb && similar(pa, pb));
    for (const [k, pred] of [['plain', said], ['guarded', said && sim]] as const) {
      if (pred && t.twin) tally[k].tp++; else if (pred && !t.twin) tally[k].fp++; else if (!pred && t.twin) tally[k].fn++;
    }
    rows.push({ pandId: r.pandId, side, neighbour: t.id, truth: t.twin, sameAs: said, similar: sim, probed: !!(pa && pb) });
  }
}
const stat = (x: { tp: number; fp: number; fn: number }) => ({ ...x, precision: +(x.tp / Math.max(1, x.tp + x.fp)).toFixed(3), precisionCI: wilson(x.tp, x.tp + x.fp),
  recall: +(x.tp / Math.max(1, x.tp + x.fn)).toFixed(3), recallCI: wilson(x.tp, x.tp + x.fn) });
const out = { v: 1, plain: stat(tally.plain), guarded: stat(tally.guarded), sides: rows.length, rows };
fs.writeFileSync(opt('out') ?? path.join(D, 'twin-guard.json'), `${JSON.stringify(out, null, 1)}\n`);
console.log(JSON.stringify({ plain: out.plain, guarded: out.guarded, sides: out.sides }, null, 1));
