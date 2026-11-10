// Hand set v1, gable rows (lane H5h round 3, #351): 40 more AB07 pands for the gable-type gate, which needs n >= 60 register-stated
// gables (the 60-pand set has 28). Drawn before reading, deterministic (seed 352): AB07 pands with a register gable, a good or
// fallback crop not labelled `bad`, not already in the hand set; round-robin over the register's gable group so no group dominates.
// Readers B2 and C2 (blind, fresh) read the gable only, from crown crops (sheets.ts --gable). 40, not 30: some crowns are not in view.
import fs from 'node:fs';
import path from 'node:path';
import type { Envelope } from '../describe.ts';
import { mulberry32 } from './select.ts';

export const HELP = `hand-set select-gable: the gable-only rows (docs/house-line.md §4c).

  node --import tsx scripts/house-specs/hand-set/select-gable.ts [--n 40] [--out data/house-line/hand-set-v1.gable-selection.json]`;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const groupOf = (g: string) => (g === 'raised-neck' ? 'neck' : g === 'spout' ? 'point' : g);

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) { console.log(HELP); return; }
  const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const n = Number(opt('n') ?? 40), out = opt('out') ?? path.join(ROOT, 'data/house-line/hand-set-v1.gable-selection.json');
  const dir = path.join(ROOT, 'scripts/house-specs/generated/AB07');
  const taken = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/house-line/hand-set-v1.json'), 'utf8')).pands.map((p: any) => p.pandId));
  const bad = new Set<string>();
  for (const f of ['AB07.json', 'AB07-picks.json']) for (const [id, l] of Object.entries<any>(JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/house-crops/labels', f), 'utf8')))) if (l.label === 'bad') bad.add(`${id}|${[...l.panoIds].sort().join()}`);
  const groups = new Map<string, { pandId: string; tier: string; registerGable: string; crop: string }[]>(); let pool = 0;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    const e: Envelope = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const t = e.crop?.tier, reg = (e.writers.register?.design?.fronts?.[0] as any)?.gable as string | undefined;
    if ((t !== 'good' && t !== 'fallback') || !reg || taken.has(e.pandId) || bad.has(`${e.pandId}|${[...e.crop!.panoIds].sort().join()}`)) continue;
    pool++; const g = groupOf(reg);
    (groups.get(g) ?? groups.set(g, []).get(g)!).push({ pandId: e.pandId, tier: t, registerGable: reg, crop: `source-data://pand-crops/${e.pandId}/${e.crop!.file}` });
  }
  const rnd = mulberry32(352);
  const queues = [...groups.keys()].sort().map(g => groups.get(g)!.map(c => ({ c, r: rnd() })).sort((a, b) => a.r - b.r).map(x => x.c));
  const picks: typeof queues[number] = [];
  while (picks.length < n && queues.some(q => q.length)) for (const q of queues) if (q.length && picks.length < n) picks.push(q.shift()!);
  fs.writeFileSync(out, JSON.stringify({ version: 1, seed: 352, buurt: 'AB07', pool, poolByGroup: Object.fromEntries([...groups].map(([g, l]) => [g, l.length])), picks }, null, 1) + '\n');
  const tally = picks.reduce((m: Record<string, number>, p) => ((m[groupOf(p.registerGable)] = (m[groupOf(p.registerGable)] ?? 0) + 1), m), {});
  console.log(`pool ${pool}; picked ${picks.length}`, tally, Object.fromEntries([...groups].map(([g, l]) => [g, l.length])));
}
if (process.argv[1]?.endsWith('hand-set/select-gable.ts')) main();
