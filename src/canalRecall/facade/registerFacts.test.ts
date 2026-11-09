// Parser golden (#316): per-field precision and recall against hand-checked records (fixtures/registerFacts.golden.json).
// Gate from the brief: >= 0.9 for date, type, gable, finish; >= 0.8 for elements and style. Every disagreement is printed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseDate, parseRegisterFacts } from './registerFacts.ts';

test('dates: Roman quarters, ca., written centuries, parts', () => {
  assert.deepEqual([parseDate('XVIIIa')?.from, parseDate('XVIIIa')?.to], [1700, 1724]);
  assert.deepEqual([parseDate('XVIIc/d')?.from, parseDate('XVIIc/d')?.to], [1650, 1699]);
  assert.deepEqual([parseDate('XIX B')?.from, parseDate('XIX B')?.to], [1825, 1849]);
  assert.equal(parseDate('ca. 1680')?.confidence, 'approx');
  assert.deepEqual([parseDate('laat 19e eeuwse')?.from, parseDate('laat 19e eeuwse')?.to], [1875, 1899]);
  assert.deepEqual([parseDate('eind XVIII/begin XIX')?.from, parseDate('eind XVIII/begin XIX')?.to], [1775, 1824]);
  assert.deepEqual([parseDate('1921-1922')?.from, parseDate('1921-1922')?.to], [1921, 1922]);
});

test('never invents: an empty text has no facts', () => {
  const f = parseRegisterFacts('0', 'Pand.');
  assert.deepEqual([f.facadeDate, f.coreDate, f.gable, f.finish, f.style, f.storeys, f.basement, f.altered, f.elements.length], [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 0]);
});

test('golden: per-field precision and recall', () => {
  const golden = JSON.parse(readFileSync('fixtures/registerFacts.golden.json', 'utf8')).records as any[];
  const snap = JSON.parse(gunzipSync(readFileSync('scripts/data/amsterdam-monument-register/records.json.gz')).toString('utf8'));
  const textOf = (g: any) => g.text ?? snap.rce.find((r: any) => r.monumentNumber === g.nr).descriptions.map((d: any) => d.text).join(' ');
  const score: Record<string, { tp: number; fp: number; fn: number }> = {};
  const add = (k: string, tp: number, fp: number, fn: number) => { const s = score[k] ??= { tp: 0, fp: 0, fn: 0 }; s.tp += tp; s.fp += fp; s.fn += fn; };
  const misses: string[] = [];
  for (const g of golden) {
    const f = parseRegisterFacts(g.nr, textOf(g));
    const scalar = (k: string, got: unknown, want: unknown) => {
      const eq = JSON.stringify(got ?? null) === JSON.stringify(want ?? null);
      if (eq) { if (want != null) add(k, 1, 0, 0); return; }
      misses.push(`${g.nr} ${k}: got ${JSON.stringify(got ?? null)} want ${JSON.stringify(want)}`);
      add(k, 0, got != null ? 1 : 0, want != null ? 1 : 0);
    };
    scalar('date', f.facadeDate ? [f.facadeDate.from, f.facadeDate.to] : null, g.fd);
    scalar('type', f.type?.key, g.type); scalar('gable', f.gable, g.gable); scalar('finish', f.finish, g.finish);
    for (const [k, got, want] of [['style', f.style ?? [], g.style], ['elements', f.elements.map(e => e.key), g.el]] as const) {
      const G = new Set<string>(got), W = new Set<string>(want);
      const tp = [...G].filter(x => W.has(x)).length;
      add(k, tp, G.size - tp, W.size - tp);
      if (tp !== G.size || tp !== W.size) misses.push(`${g.nr} ${k}: got ${[...G]} want ${[...W]}`);
    }
  }
  const pr = Object.fromEntries(Object.entries(score).map(([k, s]) => [k, { p: +(s.tp / Math.max(1, s.tp + s.fp)).toFixed(3), r: +(s.tp / Math.max(1, s.tp + s.fn)).toFixed(3), n: s.tp + s.fn }]));
  console.log(JSON.stringify({ records: golden.length, pr }), '\n' + misses.join('\n'));
  for (const k of ['date', 'type', 'gable', 'finish']) { assert.ok(pr[k].p >= 0.9 && pr[k].r >= 0.9, `${k} ${JSON.stringify(pr[k])}`); }
  for (const k of ['elements', 'style']) { assert.ok(pr[k].p >= 0.8 && pr[k].r >= 0.8, `${k} ${JSON.stringify(pr[k])}`); }
});
