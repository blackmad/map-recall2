// Hand set v1 (lane H5h, #351): every number the hand set is for.
//   1. reader ceiling   reader A against the blind reader B on the 30 shared pands, per field
//   2. writers          H5's describe writers (scripts/house-specs/generated/AB07) and the merge against reader A, per field
//   3. old hand truth   the block-face / recipe intents agreement.ts used (handSpecs) against reader A
//   4. H9 review        H9's easy-houses review values against reader A
//   5. judge recall     the Jev crop judge (v1, v2) against "the describe crop is readable" from reader A (step 0b on this set)
// Field agreement: bays = axes (exact, and within 1), storeys (exact, within 1), gable, finish (palette.wallMaterial), pui,
// wall family (readers only: a writer hex is not mapped to a family word) and wall tone (reading brown/dark = dark;
// a writer hex is dark under HSL lightness HEX_DARK_L 0.38). Pure arithmetic over committed files.
import fs from 'node:fs';
import path from 'node:path';
import { rgbToHsl } from '../../../src/canalRecall/blockFace/wallColour.ts';
import { frontBays, specField, type HouseSpec } from '../../../src/canalRecall/houseSpec/spec.ts';
import { hexTone, toneOf, type HandPand, type HandSet, type WallFamily } from '../../../src/canalRecall/houseSpec/handSet.ts';
import { handSpecs } from '../agreement.ts';
import { auc, lowestThreshold, type Row as JRow } from '../../house-crops/recall-pass.ts';
import { quality, type JudgeRecord } from '../../house-crops/judge.ts';
import { JUDGE_GOOD } from '../../house-crops/flags.ts';
import type { Envelope } from '../describe.ts';

export const HELP = `hand-set score: reader ceiling, writers, old hand truth, H9 review and judge recall against hand set v1.

  node --import tsx scripts/house-specs/hand-set/score.ts [--out data/house-line/hand-set-v1.scores.json] [--min-confidence low|med|high]

--min-confidence drops hand readings below that confidence (default low = every stated value).`;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const D = path.join(ROOT, 'data/house-line');
export const FIELDS = ['bays', 'bays±1', 'storeys', 'storeys±1', 'gable', 'finish', 'pui', 'wallFamily', 'wallTone'] as const;
export type F = (typeof FIELDS)[number];
type V = string | number | null | undefined;
const RANK = { low: 0, med: 1, high: 2 } as const;

/** One pand's values in the common vocabulary. */
export function handValues(h: HandPand, min: keyof typeof RANK = 'low'): Record<F, V> {
  const g = <T,>(r: { value: T | null; confidence: keyof typeof RANK } | undefined) => (h.readable && r && r.value !== null && RANK[r.confidence] >= RANK[min] ? r.value : undefined);
  const wf = g(h.fields.wall) as WallFamily | undefined;
  return { bays: g(h.fields.axes), 'bays±1': g(h.fields.axes), storeys: g(h.fields.storeys), 'storeys±1': g(h.fields.storeys), gable: g(h.fields.gable), finish: g(h.fields.finish), pui: g(h.fields.pui), wallFamily: wf, wallTone: wf ? toneOf(wf) ?? undefined : undefined };
}
export function specValues(s: HouseSpec | null | undefined): Record<F, V> {
  if (!s) return Object.fromEntries(FIELDS.map(f => [f, undefined])) as Record<F, V>;
  const hex = specField(s, 'palette/brick') as string | undefined;
  const b = frontBays(s.design.fronts?.[0]); const st = specField(s, 'fronts/0/storeys') as number | undefined;
  return { bays: b, 'bays±1': b, storeys: st, 'storeys±1': st, gable: specField(s, 'fronts/0/gable') as V, finish: specField(s, 'palette/wallMaterial') as V, pui: specField(s, 'facts/pui') as V, wallFamily: undefined, wallTone: hex ? hexTone(hex) ?? undefined : undefined };
}
export const agree = (f: F, a: V, b: V) => (f.endsWith('±1') ? Math.abs(Number(a) - Number(b)) <= 1 : a === b);

export type Cell = { hand: number; stated: number; agree: number; precision: number | null; recall: number | null };
export function table(pairs: { hand: Record<F, V>; got: Record<F, V> }[]): Record<F, Cell> {
  const out = {} as Record<F, Cell>;
  for (const f of FIELDS) {
    let hand = 0, stated = 0, ag = 0;
    for (const p of pairs) { if (p.hand[f] === undefined) continue; hand++; if (p.got[f] === undefined) continue; stated++; if (agree(f, p.hand[f], p.got[f])) ag++; }
    out[f] = { hand, stated, agree: ag, precision: stated ? +(ag / stated).toFixed(3) : null, recall: hand ? +(ag / hand).toFixed(3) : null };
  }
  return out;
}
const fmt = (c: Cell) => `${c.agree}/${c.stated}${c.precision === null ? '' : ` = ${c.precision.toFixed(2)}`}`;

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) { console.log(HELP); return; }
  const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const min = (opt('min-confidence') ?? 'low') as keyof typeof RANK;
  const A: HandSet = JSON.parse(fs.readFileSync(path.join(D, 'hand-set-v1.json'), 'utf8'));
  const B: HandSet = JSON.parse(fs.readFileSync(path.join(D, 'hand-set-v1.reader-b.json'), 'utf8'));
  const a = new Map(A.pands.map(p => [p.pandId, p]));
  const out: Record<string, unknown> = { minConfidence: min };

  // 1. reader ceiling: agreement = both state the field and agree, over the pands where both state it
  const both = B.pands.map(b => ({ hand: handValues(a.get(b.pandId)!, min), got: handValues(b, min) }));
  const ceil = table(both);
  const readableAgree = B.pands.filter(b => b.readable === a.get(b.pandId)!.readable).length;
  console.log(`## 1. Reader ceiling (A vs blind B, ${B.pands.length} pands; readable agree ${readableAgree}/${B.pands.length})\n`);
  console.log('| field | both stated | agree | rate |\n|---|---|---|---|');
  for (const f of FIELDS) console.log(`| ${f} | ${ceil[f].stated} | ${ceil[f].agree} | ${ceil[f].precision ?? '-'} |`);
  const highBoth = table(B.pands.map(b => ({ hand: handValues(a.get(b.pandId)!, 'high'), got: handValues(b, 'high') })));
  console.log(`\nboth readers 'high': ` + FIELDS.map(f => `${f} ${fmt(highBoth[f])}`).join(', '));
  const diffs = B.pands.flatMap(b => { const x = handValues(a.get(b.pandId)!, min), y = handValues(b, min); return (['bays', 'storeys', 'gable', 'finish', 'wallFamily', 'pui'] as F[]).filter(f => x[f] !== undefined && y[f] !== undefined && x[f] !== y[f]).map(f => `${b.pandId.slice(-6)} ${f}: A ${x[f]} / B ${y[f]}`); });
  console.log(`\nreader disagreements (${diffs.length}):\n  ` + diffs.join('\n  '));
  out.readerCeiling = { pands: B.pands.length, readableAgree, all: ceil, bothHigh: highBoth, disagreements: diffs };

  // 2. writers against reader A on the AB07 pands
  const gen = path.join(ROOT, 'scripts/house-specs/generated/AB07');
  const ab = A.pands.filter(p => p.group === 'ab07');
  const envs = new Map(ab.map(p => [p.pandId, JSON.parse(fs.readFileSync(path.join(gen, `${p.pandId}.json`), 'utf8')) as Envelope]));
  const writers = ['register', 'bag', 'pixel', 'jev', 'merged'];
  const wt: Record<string, Record<F, Cell>> = {};
  for (const w of writers) wt[w] = table(ab.map(p => ({ hand: handValues(p, min), got: specValues(w === 'merged' ? envs.get(p.pandId)!.spec : envs.get(p.pandId)!.writers[w]) })));
  const goodTier = ab.filter(p => envs.get(p.pandId)!.crop?.tier === 'good');
  const mergedGood = table(goodTier.map(p => ({ hand: handValues(p, min), got: specValues(envs.get(p.pandId)!.spec) })));
  console.log(`\n## 2. Writers vs hand set (AB07, ${ab.length} pands, ${ab.filter(p => p.readable).length} readable; agree/stated = precision; reader ceiling last)\n`);
  console.log('| field | hand n | ' + writers.join(' | ') + ' | merged, good tier | reader ceiling |\n|---|---|' + writers.map(() => '---').join('|') + '|---|---|');
  for (const f of FIELDS) console.log(`| ${f} | ${wt.merged[f].hand} | ` + writers.map(w => fmt(wt[w][f])).join(' | ') + ` | ${fmt(mergedGood[f])} | ${ceil[f].precision ?? '-'} |`);
  // the measured pixel colour per read family (what a calibrated hex -> family map would have to learn)
  const fam: Record<string, number[][]> = {};
  for (const p of ab) { const hex = specField(envs.get(p.pandId)!.writers.pixel ?? ({ design: {}, provenance: {} } as any), 'palette/brick') as string | undefined; const f = p.readable ? p.fields.wall.value : null; if (!hex || !f) continue; const n = parseInt(hex.slice(1), 16); (fam[f] ??= []).push(rgbToHsl([(n >> 16) & 255, (n >> 8) & 255, n & 255])); }
  const med = (v: number[]) => { const s = [...v].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const famMed = Object.fromEntries(Object.entries(fam).map(([f, v]) => [f, { n: v.length, hue: Math.round(med(v.map(x => x[0]))), sat: +med(v.map(x => x[1])).toFixed(2), light: +med(v.map(x => x[2])).toFixed(2) }]));
  console.log('\npixel wall colour per read family (median HSL): ' + Object.entries(famMed).map(([f, m]) => `${f} n${m.n} h${m.hue} s${m.sat} l${m.light}`).join('; '));
  out.writers = { familyMedians: famMed, pands: ab.length, goodTierPands: goodTier.length, tables: wt, mergedGoodTier: mergedGood };

  // 3. the old hand truth (agreement.ts handSpecs: block-face and recipe intents) against reader A
  const old = handSpecs(new Set(A.pands.map(p => p.pandId)), ROOT);
  const kinds = [...new Set([...old.values()].map(h => h.handKind))];
  const ot: Record<string, Record<F, Cell>> = {};
  for (const k of kinds) ot[k] = table([...old.entries()].filter(([, h]) => h.handKind === k).map(([id, h]) => ({ hand: handValues(a.get(id)!, min), got: specValues(h) })));
  console.log(`\n## 3. Old hand truth vs hand set (${old.size} pands with an intent)\n`);
  for (const k of kinds) console.log(`- ${k} (${[...old.values()].filter(h => h.handKind === k).length}): ` + FIELDS.map(f => `${f} ${fmt(ot[k][f])}`).join(', '));
  out.oldHandTruth = ot;

  // 4. H9's review values against reader A
  const h9file = path.join(ROOT, 'data/house-line/easy-houses-20261110.review.json');
  if (fs.existsSync(h9file)) {
    const rev: Record<string, { bays?: number; storeys?: number; gable?: string }> = JSON.parse(fs.readFileSync(h9file, 'utf8')).review;
    const h9 = table(Object.entries(rev).filter(([id]) => a.has(id)).map(([id, r]) => ({ hand: handValues(a.get(id)!, min), got: { bays: r.bays, 'bays±1': r.bays, storeys: r.storeys, 'storeys±1': r.storeys, gable: r.gable, finish: undefined, pui: undefined, wallFamily: undefined, wallTone: undefined } })));
    console.log(`\n## 4. H9 easy-houses review vs hand set: bays ${fmt(h9.bays)} (±1 ${fmt(h9['bays±1'])}), storeys ${fmt(h9.storeys)} (±1 ${fmt(h9['storeys±1'])}), gable ${fmt(h9.gable)}`);
    out.h9Review = h9;
  }

  // 5. judge recall: is the describe crop a readable front? good = reader A read axes, storeys and gable from it at med/high
  const J = path.join(ROOT, 'scripts/house-crops/judge');
  const rd = (f: string) => { try { return JSON.parse(fs.readFileSync(path.join(J, f), 'utf8')); } catch { return {}; } };
  const v1: Record<string, JudgeRecord> = rd('AB07.json'), v2: Record<string, JudgeRecord> = rd('AB07.v2.json'), y1 = rd('AB07-years.json'), y2 = rd('AB07-years.v2.json');
  const same = (x: string[], y: string[]) => [...x].sort().join() === [...y].sort().join();
  const score = (store: Record<string, any>, years: Record<string, any>, e: Envelope): number | undefined => {
    const c = e.crop!; if (c.file === 'front.jpg') { const r = store[e.pandId]; return r && same(r.panoIds, c.panoIds) ? quality(r) : undefined; }
    const k = Object.keys(years).find(k => k.startsWith(`${e.pandId}/${c.year}/`) && same(k.split('/')[2].split('+'), c.panoIds)); return k ? quality(years[k]) : undefined;
  };
  const rows: (JRow & { pandId: string })[] = [];
  for (const p of ab) {
    const e = envs.get(p.pandId)!; const describeRef = `source-data://pand-crops/${p.pandId}/${e.crop!.file}`;
    const ok = (r: { value: unknown; confidence: string; ref: string }) => r.value !== null && r.confidence !== 'low' && r.ref === describeRef;
    const good = p.readable && ok(p.fields.axes) && ok(p.fields.storeys) && ok(p.fields.gable);
    const s1 = score(v1, y1, e), s2 = score(v2, y2, e);
    rows.push({ pandId: p.pandId, key: p.pandId, good, hard: true, s: { v1: s1 ?? NaN, v2: s2 ?? NaN } });
  }
  const r1 = rows.filter(r => Number.isFinite(r.s.v1)), r2 = rows.filter(r => Number.isFinite(r.s.v2));
  const at = (rs: typeof rows, k: string, t: number) => { const sel = rs.filter(r => r.s[k] >= t), tp = sel.filter(r => r.good).length, pos = rs.filter(r => r.good).length; return { picks: sel.length, precision: sel.length ? +(tp / sel.length).toFixed(3) : null, recall: pos ? +(tp / pos).toFixed(3) : null }; };
  const judge = { good: rows.filter(r => r.good).length, n: rows.length, v1: { scored: r1.length, auc: +auc(r1, 'v1').toFixed(3), atJudgeGood: at(r1, 'v1', JUDGE_GOOD), at04: at(r1, 'v1', 0.4), lowestT90: lowestThreshold(r1, 'v1') }, v2: { scored: r2.length, auc: r2.length ? +auc(r2, 'v2').toFixed(3) : null, at07: at(r2, 'v2', 0.7), lowestT90: lowestThreshold(r2, 'v2') } };
  console.log(`\n## 5. Judge recall on the describe crops (${rows.length} AB07 pands; ${judge.good} read as good from the describe crop)\n`);
  console.log(`v1: ${r1.length} scored, AUC ${judge.v1.auc}; at JUDGE_GOOD ${JUDGE_GOOD}: ${JSON.stringify(judge.v1.atJudgeGood)}; at 0.4: ${JSON.stringify(judge.v1.at04)}; lowest t with precision >= 0.9: ${judge.v1.lowestT90}`);
  console.log(`v2: ${r2.length} scored, AUC ${judge.v2.auc}; at 0.7: ${JSON.stringify(judge.v2.at07)}; lowest t with precision >= 0.9: ${judge.v2.lowestT90}`);
  out.judgeRecall = judge;

  const file = opt('out') ?? path.join(D, 'hand-set-v1.scores.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n'); console.log(`\n-> ${path.relative(ROOT, file)}`);
}
if (process.argv[1]?.endsWith('hand-set/score.ts')) main();
