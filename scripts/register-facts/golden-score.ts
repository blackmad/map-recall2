// Per-field precision and recall of a register-facts parser against the hand-checked golden (fixtures/registerFacts.golden.json).
// Shared by registerFacts.test.ts and `npx tsx scripts/register-facts/golden-score.ts [parserModule]` (a module path
// exporting parseRegisterFacts; used to score an older parser for the before/after table).
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export type Score = Record<string, { p: number; r: number; n: number; tp: number; fp: number; fn: number }>;
export function scoreGolden(parse: (nr: string, text: string) => any): { records: number; pr: Score; misses: string[] } {
  const golden = JSON.parse(readFileSync('fixtures/registerFacts.golden.json', 'utf8')).records as any[];
  const snap = JSON.parse(gunzipSync(readFileSync('scripts/data/amsterdam-monument-register/records.json.gz')).toString('utf8'));
  const textOf = (g: any) => g.text ?? snap.rce.find((r: any) => r.monumentNumber === g.nr).descriptions.map((d: any) => d.text).join(' ');
  const score: Record<string, { tp: number; fp: number; fn: number }> = {};
  const add = (k: string, tp: number, fp: number, fn: number) => { const s = score[k] ??= { tp: 0, fp: 0, fn: 0 }; s.tp += tp; s.fp += fp; s.fn += fn; };
  const misses: string[] = [];
  for (const g of golden) {
    const f = parse(g.nr, textOf(g));
    const scalar = (k: string, got: unknown, want: unknown) => {
      const eq = JSON.stringify(got ?? null) === JSON.stringify(want ?? null);
      if (eq) { if (want != null) add(k, 1, 0, 0); return; }
      misses.push(`${g.nr} ${k}: got ${JSON.stringify(got ?? null)} want ${JSON.stringify(want)}`);
      add(k, 0, got != null ? 1 : 0, want != null ? 1 : 0);
    };
    scalar('date', f.facadeDate ? [f.facadeDate.from, f.facadeDate.to] : null, g.fd);
    if ('cd' in g) scalar('coreDate', f.coreDate ? [f.coreDate.from, f.coreDate.to] : null, g.cd);
    scalar('type', f.type?.key, g.type); scalar('gable', f.gable, g.gable); scalar('finish', f.finish, g.finish);
    if ('storeys' in g) scalar('storeys', f.storeys, g.storeys);
    if ('bands' in g) scalar('stoneBands', f.stoneBands ? true : null, g.bands ? true : null);
    for (const [k, got, want] of [['style', f.style ?? [], g.style], ['elements', f.elements.map((e: any) => e.key), g.el]] as const) {
      const G = new Set<string>(got), W = new Set<string>(want);
      const tp = [...G].filter(x => W.has(x)).length;
      add(k, tp, G.size - tp, W.size - tp);
      if (tp !== G.size || tp !== W.size) misses.push(`${g.nr} ${k}: got ${[...G]} want ${[...W]}`);
    }
  }
  const pr: Score = Object.fromEntries(Object.entries(score).map(([k, s]) => [k, { ...s, p: +(s.tp / Math.max(1, s.tp + s.fp)).toFixed(3), r: +(s.tp / Math.max(1, s.tp + s.fn)).toFixed(3), n: s.tp + s.fn }]));
  return { records: golden.length, pr, misses };
}

if (process.argv[1]?.endsWith('golden-score.ts')) {
  const mod = await import(process.argv[2] && !process.argv[2].startsWith('--') ? pathToFileURL(path.resolve(process.argv[2])).href : '../../src/canalRecall/facade/registerFacts.ts');
  const { records, pr, misses } = scoreGolden(mod.parseRegisterFacts);
  console.log(JSON.stringify({ records, pr: Object.fromEntries(Object.entries(pr).map(([k, v]) => [k, `P ${v.p} R ${v.r} n ${v.n}`])) }, null, 1));
  if (process.argv.includes('--misses')) console.log(misses.join('\n'));
}
