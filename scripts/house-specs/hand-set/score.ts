// Hand set v1 (lane H5h, #351): every number the hand set is for.
//   1. reader ceiling   the two blind readers (B and C) on the 30 shared pands, per field; reader A against each for reference
//   2. writers          H5's describe writers (scripts/house-specs/generated/AB07) and the merge against reader A, with the gates
//                       (agreement.ts gateFor / MIN_N / verdict: blind ceiling - 0.1, Wilson 95 %; gable pooled with the gable-only rows B2 vs C2)
//   3. BAG storeys      the raw count and the offsets (-1 pitched crown, -1 souterrain) against reader A
//   4. old hand truth   the block-face / recipe intents agreement.ts used (handSpecs) against reader A
//   5. H9 review        H9's easy-houses review values against reader A
//   6. judge recall     the Jev crop judge (v1, v2) against "the describe crop is readable" from reader A (step 0b on this set)
// Never scored: an "unknown" value, an unreadable pand, a pand of extent multi (in reader A's set). Field agreement: bays = axes
// (exact; within 1 for reference), storeys (exact; within 1), gable, finish (palette.wallMaterial), pui, wall family (readers only: a
// writer hex is not mapped to a family word) and wall tone (reading brown/dark = dark; a writer hex is dark under HSL L HEX_DARK_L).
import fs from 'node:fs';
import path from 'node:path';
import { rgbToHsl } from '../../../src/canalRecall/blockFace/wallColour.ts';
import { frontBays, specField, type HouseSpec } from '../../../src/canalRecall/houseSpec/spec.ts';
import { STOREYS_DEFINITION, UNKNOWN, hexTone, toneOf, type GableRow, type GableRowSet, type HandPand, type HandSet, type WallFamily } from '../../../src/canalRecall/houseSpec/handSet.ts';
import { GATE_FIELDS, GATE_MARGIN, MIN_N, gateFor, handSpecs, verdict, wilson, type GateField } from '../agreement.ts';
import { auc, lowestThreshold, type Row as JRow } from '../../house-crops/recall-pass.ts';
import { quality, type JudgeRecord } from '../../house-crops/judge.ts';
import { JUDGE_GOOD } from '../../house-crops/flags.ts';
import { loadBag, type Envelope } from '../describe.ts';
import { bagStoreys } from '../../../src/canalRecall/houseSpec/writers/bag.ts';
import { crownInGeometry } from '../../../src/canalRecall/houseSpec/decorate.ts';

export const HELP = `hand-set score: reader ceiling, writer gates, BAG storeys, old hand truth, H9 review and judge recall against hand set v1.

  node --import tsx scripts/house-specs/hand-set/score.ts [--out data/house-line/hand-set-v1.scores.json] [--min-confidence low|med|high]
  (also: node --import tsx scripts/house-specs/agreement.ts --hand-set)

--min-confidence drops hand readings below that confidence (default low = every stated value).
Gates per field: blind reader ceiling - ${GATE_MARGIN} (gable n >= ${MIN_N.gable}); Wilson 95 % intervals; a writer fails
only when the top of its interval is below the gate, passes when the bottom is at or above it, else open.`;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const D = path.join(ROOT, 'data/house-line');
export const FIELDS = ['bays', 'bays±1', 'storeys', 'storeys±1', 'gable', 'finish', 'pui', 'wallFamily', 'wallTone'] as const;
export type F = (typeof FIELDS)[number];
const GATED: Record<GateField, F> = { bays: 'bays', storeys: 'storeys', gable: 'gable', finish: 'finish', pui: 'pui', wallTone: 'wallTone', wallFamily: 'wallFamily' };
type V = string | number | null | undefined;
const RANK = { low: 0, med: 1, high: 2 } as const;

/** One pand's values in the common vocabulary; unknown, unreadable and multi-front pands give undefined (never scored). */
export function handValues(h: HandPand, min: keyof typeof RANK = 'low', extent: 'single' | 'multi' = h.extent ?? 'single'): Record<F, V> {
  const g = <T,>(r: { value: T | typeof UNKNOWN | null; confidence: keyof typeof RANK } | undefined) => (h.readable && extent !== 'multi' && r && r.value !== null && r.value !== UNKNOWN && RANK[r.confidence] >= RANK[min] ? r.value as T : undefined);
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

export type Cell = { hand: number; stated: number; agree: number; precision: number | null; recall: number | null; ci?: [number, number] };
export function table(pairs: { hand: Record<F, V>; got: Record<F, V> }[]): Record<F, Cell> {
  const out = {} as Record<F, Cell>;
  for (const f of FIELDS) {
    let hand = 0, stated = 0, ag = 0;
    for (const p of pairs) { if (p.hand[f] === undefined) continue; hand++; if (p.got[f] === undefined) continue; stated++; if (agree(f, p.hand[f], p.got[f])) ag++; }
    out[f] = { hand, stated, agree: ag, precision: stated ? +(ag / stated).toFixed(3) : null, recall: hand ? +(ag / hand).toFixed(3) : null, ...(stated ? { ci: wilson(ag, stated) } : {}) };
  }
  return out;
}
const fmt = (c: Cell) => (c.stated ? `${c.agree}/${c.stated} = ${c.precision!.toFixed(2)}` : '-');
const fmtCi = (c: Cell) => (c.stated ? `${c.agree}/${c.stated} = ${c.precision!.toFixed(2)} [${c.ci![0].toFixed(2)}, ${c.ci![1].toFixed(2)}]` : '-');

export function scoreHandSet(o: { out?: string; min?: keyof typeof RANK } = {}) {
  const min = o.min ?? 'low';
  const load = (f: string): HandSet | null => (fs.existsSync(path.join(D, f)) ? JSON.parse(fs.readFileSync(path.join(D, f), 'utf8')) : null);
  const A = load('hand-set-v1.json')!, B = load('hand-set-v1.reader-b.json')!, C = load('hand-set-v1.reader-c.json');
  const a = new Map(A.pands.map(p => [p.pandId, p]));
  const ext = (id: string) => a.get(id)!.extent;
  const out: Record<string, unknown> = { minConfidence: min, storeysDefinition: STOREYS_DEFINITION };

  // 1. reader ceiling: over the pands both readers state (single extent in A's set, readable, not unknown)
  const pair = (X: HandSet, Y: HandSet) => { const y = new Map(Y.pands.map(p => [p.pandId, p])); return table(X.pands.filter(p => y.has(p.pandId)).map(p => ({ hand: handValues(p, min, ext(p.pandId)), got: handValues(y.get(p.pandId)!, min, ext(p.pandId)) }))); };
  const AB = pair(A, B), AC = C ? pair(A, C) : null, BC = C ? pair(B, C) : null;
  const ceilTable = BC ?? AB; const ceilName = BC ? 'B vs C (both blind)' : 'A vs B';
  const multiShared = B.pands.filter(p => ext(p.pandId) === 'multi').length;
  console.log(`## 1. Reader ceiling: ${ceilName}, ${B.pands.length} shared pands (${multiShared} multi-front left out)\n`);
  console.log('| field | B vs C (blind pair) | A vs B | A vs C |\n|---|---|---|---|');
  for (const f of FIELDS) console.log(`| ${f} | ${BC ? fmtCi(BC[f]) : '-'} | ${fmtCi(AB[f])} | ${AC ? fmtCi(AC[f]) : '-'} |`);
  const disagree = (X: HandSet, Y: HandSet) => { const y = new Map(Y.pands.map(p => [p.pandId, p])); return X.pands.filter(p => y.has(p.pandId)).flatMap(p => { const u = handValues(p, min, ext(p.pandId)), v = handValues(y.get(p.pandId)!, min, ext(p.pandId)); return (['bays', 'storeys', 'gable', 'finish', 'wallFamily', 'pui'] as F[]).filter(f => u[f] !== undefined && v[f] !== undefined && u[f] !== v[f]).map(f => `${p.pandId.slice(-6)} ${f}: ${u[f]} / ${v[f]}`); }); };
  if (C) console.log(`\nB vs C disagreements: ${disagree(B, C).join('; ') || 'none'}`);
  console.log(`A vs B disagreements: ${disagree(A, B).join('; ') || 'none'}`);
  if (C) console.log(`A vs C disagreements: ${disagree(A, C).join('; ') || 'none'}`);
  const ceiling: Record<string, number | null> = Object.fromEntries(FIELDS.map(f => [f, ceilTable[f].precision]));
  // gable-only rows (round 3): blind readers B2 and C2 on 40 crown crops; the gable ceiling pools them with B vs C
  const loadRows = (f: string): GableRowSet | null => (fs.existsSync(path.join(D, f)) ? JSON.parse(fs.readFileSync(path.join(D, f), 'utf8')) : null);
  const B2 = loadRows('hand-set-v1.gable-b2.json'), C2 = loadRows('hand-set-v1.gable-c2.json');
  const gv = (r: GableRow | undefined) => (r && r.gable.value !== UNKNOWN && RANK[r.gable.confidence] >= RANK[min] ? r.gable.value : undefined);
  let rowsPair = { stated: 0, agree: 0 }; const rowsDis: string[] = [];
  if (B2 && C2) { const c2 = new Map(C2.rows.map(r => [r.pandId, r])); for (const r of B2.rows) { const u = gv(r), v = gv(c2.get(r.pandId)); if (u === undefined || v === undefined) continue; rowsPair.stated++; if (u === v) rowsPair.agree++; else rowsDis.push(`${r.pandId.slice(-6)} ${u} / ${v}`); } }
  const gk = ceilTable.gable.agree + rowsPair.agree, gn = ceilTable.gable.stated + rowsPair.stated;
  const gablePooled = { agree: gk, stated: gn, precision: gn ? +(gk / gn).toFixed(3) : null, ci: wilson(gk, gn) };
  if (B2 && C2) { console.log(`\nGable-only rows, B2 vs C2: ${rowsPair.agree}/${rowsPair.stated} = ${(rowsPair.agree / rowsPair.stated).toFixed(2)} [${wilson(rowsPair.agree, rowsPair.stated).join(', ')}]; disagreements: ${rowsDis.join('; ')}`); console.log(`Gable ceiling pooled (B vs C + B2 vs C2): ${gk}/${gn} = ${gablePooled.precision} [${gablePooled.ci.join(', ')}]`); ceiling.gable = gablePooled.precision; }
  const gates = Object.fromEntries(GATE_FIELDS.map(g => [g, gateFor(ceiling[GATED[g]] as number)])) as Record<GateField, number>;
  console.log('\n| gated field | blind ceiling | gate (ceiling - 0.1) | min n |\n|---|---|---|---|');
  for (const g of GATE_FIELDS) console.log(`| ${g} | ${ceiling[GATED[g]] ?? '-'} | ${gates[g]} | ${MIN_N[g] ?? '-'} |`);
  out.readerCeiling = { ceiling: ceilName, pands: B.pands.length, multiLeftOut: multiShared, BC, AB, AC, gableRows: { B2C2: rowsPair, disagreements: rowsDis, pooled: gablePooled }, gates, disagreements: { BC: C ? disagree(B, C) : null, AB: disagree(A, B), AC: C ? disagree(A, C) : null } };

  // 2. writers against reader A on the AB07 pands, with the gates
  const gen = path.join(ROOT, 'scripts/house-specs/generated/AB07');
  const ab = A.pands.filter(p => p.group === 'ab07');
  const envs = new Map(ab.map(p => [p.pandId, JSON.parse(fs.readFileSync(path.join(gen, `${p.pandId}.json`), 'utf8')) as Envelope]));
  const writers = ['register', 'bag', 'pixel', 'jev', 'merged'];
  const wt: Record<string, Record<F, Cell>> = {};
  for (const w of writers) wt[w] = table(ab.map(p => ({ hand: handValues(p, min), got: specValues(w === 'merged' ? envs.get(p.pandId)!.spec : envs.get(p.pandId)!.writers[w]) })));
  const scored = ab.filter(p => p.readable && p.extent === 'single').length;
  console.log(`\n## 2. Writers vs hand set (AB07: ${ab.length} pands, ${scored} readable single-front)\n`);
  console.log('| field | gate | ' + writers.map(w => `${w}: agree/stated [Wilson 95 %] verdict`).join(' | ') + ' |\n|---|---|' + writers.map(() => '---').join('|') + '|');
  const verdicts: Record<string, Record<string, ReturnType<typeof verdict>>> = {};
  for (const g of GATE_FIELDS) {
    const f = GATED[g];
    console.log(`| ${f} | ${gates[g]} | ` + writers.map(w => { const c = wt[w][f]; const v = verdict(c.agree, c.stated, gates[g], MIN_N[g]); (verdicts[w] ??= {})[f] = v; return c.stated ? `${c.agree}/${c.stated} = ${c.precision!.toFixed(2)} [${v.lo.toFixed(2)}, ${v.hi.toFixed(2)}] **${v.verdict}**` : '-'; }).join(' | ') + ' |');
  }
  for (const f of ['bays±1', 'storeys±1'] as F[]) console.log(`| ${f} | (info) | ` + writers.map(w => fmt(wt[w][f])).join(' | ') + ' |');
  const fam: Record<string, number[][]> = {};
  for (const p of ab) { const px = envs.get(p.pandId)!.writers.pixel; const hex = px ? specField(px, 'palette/brick') as string | undefined : undefined; const f = handValues(p).wallFamily as string | undefined; if (!hex || !f) continue; const n = parseInt(hex.slice(1), 16); (fam[f] ??= []).push(rgbToHsl([(n >> 16) & 255, (n >> 8) & 255, n & 255])); }
  const med = (v: number[]) => { const s = [...v].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const famMed = Object.fromEntries(Object.entries(fam).map(([f, v]) => [f, { n: v.length, hue: Math.round(med(v.map(x => x[0]))), sat: +med(v.map(x => x[1])).toFixed(2), light: +med(v.map(x => x[2])).toFixed(2) }]));
  console.log('\npixel wall colour per read family (median HSL): ' + Object.entries(famMed).map(([f, m]) => `${f} n${m.n} h${m.hue} s${m.sat} l${m.light}`).join('; '));
  // the register's gable-type writer on the hand set's AB07 rows (reader A) plus the gable-only rows (B2 the record, C2 a check)
  const regGable = (id: string) => { const e = JSON.parse(fs.readFileSync(path.join(gen, `${id}.json`), 'utf8')) as Envelope; return e.writers.register ? specField(e.writers.register, 'fronts/0/gable') as string | undefined : undefined; };
  const gRow = (rows: GableRowSet | null) => { let k = 0, n = 0; const miss: string[] = []; for (const r of rows?.rows ?? []) { const h = gv(r), w = regGable(r.pandId); if (h === undefined || w === undefined) continue; n++; if (h === w) k++; else miss.push(`${r.pandId.slice(-6)} register ${w} / read ${h}`); } return { k, n, miss }; };
  const rb = gRow(B2), rc = gRow(C2), main = wt.register.gable;
  const regV = verdict(main.agree + rb.k, main.stated + rb.n, gates.gable, MIN_N.gable), regVc = verdict(main.agree + rc.k, main.stated + rc.n, gates.gable, MIN_N.gable);
  console.log(`\nregister gable-type writer (gate ${gates.gable}, n >= ${MIN_N.gable}): hand set ${main.agree}/${main.stated} + gable rows (B2) ${rb.k}/${rb.n} = ${main.agree + rb.k}/${main.stated + rb.n} = ${((main.agree + rb.k) / (main.stated + rb.n)).toFixed(2)} [${regV.lo}, ${regV.hi}] **${regV.verdict}**; with C2 as the row truth ${main.agree + rc.k}/${main.stated + rc.n} [${regVc.lo}, ${regVc.hi}] ${regVc.verdict}`);
  console.log(`register gable misses on the gable rows (B2): ${rb.miss.join('; ')}`);
  // round 4: the gated register gable (houseSpec/decorate.ts crownInGeometry): a raised register gable states the crown only
  // over a 3DBAG crown (ridge - eaves >= 2 m); a cornice always. With no ridge in the tile the runtime asks the roof planner,
  // which needs the footprint: counted here as held (not stated) and reported apart.
  const bagG = loadBag(); const geo = (id: string) => { const d = bagG.get(`NL.IMBAG.Pand.${id}`) ?? bagG.get(id); return d ? crownInGeometry({ eaves: d.eavesM ?? undefined, ridge: d.ridgeM ?? undefined }) : null; };
  const gatedRows = [...ab.map(p => ({ id: p.pandId, hand: handValues(p, min).gable as string | undefined })), ...(B2?.rows ?? []).map(r => ({ id: r.pandId, hand: gv(r) }))];
  let gk2 = 0, gn2 = 0, heldN = 0, nullN = 0, heldRight = 0; const gMiss: string[] = []; const byType: Record<string, { stated: number; agree: number }> = {};
  for (const r of gatedRows) {
    const w = regGable(r.id); if (r.hand === undefined || w === undefined) continue;
    const g = w === 'cornice' ? true : geo(r.id);
    if (g !== true) { heldN++; if (g === null) nullN++; if (r.hand !== w) heldRight++; continue; }
    gn2++; const t = (byType[w] ??= { stated: 0, agree: 0 }); t.stated++; if (r.hand === w) { gk2++; t.agree++; } else gMiss.push(`${r.id.slice(-6)} register ${w} / read ${r.hand}`);
  }
  const gV = verdict(gk2, gn2, gates.gable, MIN_N.gable);
  console.log(`gated register gable (round 4): states ${gn2} of ${gn2 + heldN}; ${gk2}/${gn2} = ${(gk2 / gn2).toFixed(2)} [${gV.lo}, ${gV.hi}] **${gV.verdict}** against gate ${gates.gable} (>= ${gates.gable} would make it the fallback writer); held ${heldN} (${nullN} with no ridge), of which the hand reading differs from the register on ${heldRight}`);
  console.log(`gated register gable misses: ${gMiss.join('; ')}`);
  console.log(`gated register gable by register type: ${Object.entries(byType).map(([k, v]) => `${k} ${v.agree}/${v.stated}`).join(', ')}`);
  (out as any).registerGableGated = { agree: gk2, stated: gn2, held: heldN, heldNoRidge: nullN, heldWhereRegisterWrong: heldRight, verdict: gV, byType, misses: gMiss };
  // Jev storeys (measurement only, jev-storeys.ts)
  const js = fs.existsSync(path.join(D, 'hand-set-v1.jev-storeys.json')) ? JSON.parse(fs.readFileSync(path.join(D, 'hand-set-v1.jev-storeys.json'), 'utf8')) : null;
  const jsV = (c: any) => (c ? { ...c, ...verdict(c.agree, c.stated, gates.storeys) } : null);
  if (js) for (const [name, c] of [['all crops', js.all], ['good-tier AB07 (what the Jev writer sees)', js.byTier['ab07-good']]] as const) { const v = jsV(c)!; console.log(`Jev storeys, ${name}: ${c.agree}/${c.stated} = ${c.precision} [${v.lo}, ${v.hi}] **${v.verdict}** (gate ${gates.storeys}), within 1 ${c.within1}/${c.stated}`); }
  out.writers = { pands: ab.length, scored, familyMedians: famMed, tables: wt, verdicts, registerGableType: { handSet: { agree: main.agree, stated: main.stated }, rowsB2: rb, rowsC2: rc, verdict: regV, verdictC2: regVc }, jevStoreys: js ? { all: jsV(js.all), good: jsV(js.byTier['ab07-good']) } : null };

  // 3. BAG storeys: raw (as the envelopes hold it) and the offsets of the ruling, recomputed from the bag-facts descriptor
  const bag = loadBag();
  const variants: Record<string, (p: HandPand, e: Envelope) => number | undefined> = {
    'raw (eaves / 3 m)': (p) => bagStoreys(bag.get(`NL.IMBAG.Pand.${p.pandId}`) ?? bag.get(p.pandId), {}),
    '-1 pitched crown': (p) => bagStoreys(bag.get(`NL.IMBAG.Pand.${p.pandId}`) ?? bag.get(p.pandId), { pitched: true }),
    '-1 souterrain (register stoop)': (p, e) => bagStoreys(bag.get(`NL.IMBAG.Pand.${p.pandId}`) ?? bag.get(p.pandId), { souterrain: e.writers.register ? specField(e.writers.register, 'fronts/0/basement') === 'stoop' : false }),
    '-1 pitched, -1 souterrain (register stoop): the writer': (p, e) => bagStoreys(bag.get(`NL.IMBAG.Pand.${p.pandId}`) ?? bag.get(p.pandId), { pitched: true, souterrain: e.writers.register ? specField(e.writers.register, 'fronts/0/basement') === 'stoop' : false }),
    '-1 pitched, -1 souterrain (hand flag; oracle, not deployable)': (p) => bagStoreys(bag.get(`NL.IMBAG.Pand.${p.pandId}`) ?? bag.get(p.pandId), { pitched: true, souterrain: !!p.fields.souterrain }),
  };
  const bagRows: Record<string, Cell & { verdict: string }> = {};
  console.log(`\n## 3. BAG storeys against reader A (gate ${gates.storeys}; 0.80 keeps BAG as the fallback writer)\n`);
  for (const [name, fn] of Object.entries(variants)) {
    const t = table(ab.map(p => { const h = handValues(p, min); const v = fn(p, envs.get(p.pandId)!); return { hand: h, got: { ...h, storeys: v, 'storeys±1': v } }; }));
    const v = verdict(t.storeys.agree, t.storeys.stated, gates.storeys);
    bagRows[name] = { ...t.storeys, verdict: v.verdict };
    const diff: Record<string, number> = {}; for (const p of ab) { const h = handValues(p, min).storeys as number | undefined, g = fn(p, envs.get(p.pandId)!); if (h !== undefined && g !== undefined) diff[g - h] = (diff[g - h] ?? 0) + 1; }
    console.log(`- ${name}: ${fmtCi(t.storeys)}, within 1 ${fmt(t['storeys±1'])}, writer - hand ${JSON.stringify(diff)}, gate verdict ${v.verdict}`);
  }
  out.bagStoreys = bagRows;

  // 4. the old hand truth (agreement.ts handSpecs: block-face and recipe intents) against reader A
  const old = handSpecs(new Set(A.pands.map(p => p.pandId)), ROOT);
  const kinds = [...new Set([...old.values()].map(h => h.handKind))];
  const ot: Record<string, Record<F, Cell>> = {};
  for (const k of kinds) ot[k] = table([...old.entries()].filter(([, h]) => h.handKind === k).map(([id, h]) => ({ hand: handValues(a.get(id)!, min), got: specValues(h) })));
  console.log(`\n## 4. Old hand truth vs hand set (${old.size} pands with an intent)\n`);
  for (const k of kinds) console.log(`- ${k} (${[...old.values()].filter(h => h.handKind === k).length}): ` + FIELDS.map(f => `${f} ${fmt(ot[k][f])}`).join(', '));
  out.oldHandTruth = ot;

  // 5. H9's review values against reader A
  const h9file = path.join(D, 'easy-houses-20261110.review.json');
  if (fs.existsSync(h9file)) {
    const rev: Record<string, { bays?: number; storeys?: number; gable?: string }> = JSON.parse(fs.readFileSync(h9file, 'utf8')).review;
    const h9 = table(Object.entries(rev).filter(([id]) => a.has(id)).map(([id, r]) => ({ hand: handValues(a.get(id)!, min), got: { bays: r.bays, 'bays±1': r.bays, storeys: r.storeys, 'storeys±1': r.storeys, gable: r.gable, finish: undefined, pui: undefined, wallFamily: undefined, wallTone: undefined } })));
    console.log(`\n## 5. H9 easy-houses review vs hand set: bays ${fmt(h9.bays)} (±1 ${fmt(h9['bays±1'])}), storeys ${fmt(h9.storeys)} (±1 ${fmt(h9['storeys±1'])}), gable ${fmt(h9.gable)}`);
    out.h9Review = h9;
  }

  // 6. judge recall: is the describe crop a readable front? good = reader A read axes, storeys and gable from it at med/high
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
    const ok = (r: { value: unknown; confidence: string; ref: string }) => r.value !== null && r.value !== UNKNOWN && r.confidence !== 'low' && r.ref === describeRef;
    const good = p.readable && ok(p.fields.axes) && ok(p.fields.storeys) && ok(p.fields.gable);
    rows.push({ pandId: p.pandId, key: p.pandId, good, hard: true, s: { v1: score(v1, y1, e) ?? NaN, v2: score(v2, y2, e) ?? NaN } });
  }
  const r1 = rows.filter(r => Number.isFinite(r.s.v1)), r2 = rows.filter(r => Number.isFinite(r.s.v2));
  const at = (rs: typeof rows, k: string, t: number) => { const sel = rs.filter(r => r.s[k] >= t), tp = sel.filter(r => r.good).length, pos = rs.filter(r => r.good).length; return { picks: sel.length, precision: sel.length ? +(tp / sel.length).toFixed(3) : null, recall: pos ? +(tp / pos).toFixed(3) : null }; };
  const judge = { good: rows.filter(r => r.good).length, n: rows.length, v1: { scored: r1.length, auc: +auc(r1, 'v1').toFixed(3), atJudgeGood: at(r1, 'v1', JUDGE_GOOD), at04: at(r1, 'v1', 0.4), lowestT90: lowestThreshold(r1, 'v1') }, v2: { scored: r2.length, auc: r2.length ? +auc(r2, 'v2').toFixed(3) : null, at07: at(r2, 'v2', 0.7), lowestT90: lowestThreshold(r2, 'v2') } };
  console.log(`\n## 6. Judge recall on the describe crops (${rows.length} AB07 pands; ${judge.good} read as good from the describe crop)\n`);
  console.log(`v1: ${r1.length} scored, AUC ${judge.v1.auc}; at JUDGE_GOOD ${JUDGE_GOOD}: ${JSON.stringify(judge.v1.atJudgeGood)}; at 0.4: ${JSON.stringify(judge.v1.at04)}; lowest t with precision >= 0.9: ${judge.v1.lowestT90}`);
  console.log(`v2: ${r2.length} scored, AUC ${judge.v2.auc}; at 0.7: ${JSON.stringify(judge.v2.at07)}; lowest t with precision >= 0.9: ${judge.v2.lowestT90}`);
  out.judgeRecall = judge;

  const file = o.out ?? path.join(D, 'hand-set-v1.scores.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n'); console.log(`\n-> ${path.relative(ROOT, file)}`);
  return out;
}

if (process.argv[1]?.endsWith('hand-set/score.ts')) {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) console.log(HELP);
  else { const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; }; scoreHandSet({ out: opt('out'), min: opt('min-confidence') as keyof typeof RANK | undefined }); }
}
