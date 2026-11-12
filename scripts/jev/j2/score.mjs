/**
 * J2 scorer: node scripts/jev/j2/score.mjs  -> prints one table row per (family, question), writes <cache>/scores.json.
 * Columns: n, accuracy run1/run2, baseline (majority share), agree (run1==run2), hedged (p in 0.3..0.7), conf-acc (both runs agree, p>=0.8) with coverage, TP/FP/FN for yes/no.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {CACHE, arg} from './lib.mjs';
const R1 = arg('r1', 'r1'), R2 = arg('r2', 'r2'), OUT = arg('out', 'scores.json'); // J3: --r1=g-img-medium --r2=g-img-medium --out=scores-g-img.json scores a Gemini run
import {A, B} from './labels.mjs';
const sets = JSON.parse(await fs.readFile(path.join(CACHE, 'sets.json'), 'utf8'));
const J1 = JSON.parse(await fs.readFile('/Users/blackmad/Code/map-recall2/.cache/jev-facades/set.json', 'utf8'));
const idxA = Object.fromEntries(sets.A.map((p, i) => [p, A[i]])), idxB = Object.fromEntries(sets.B.map((p, i) => [p, B[i]]));
const lab = {...idxA, ...idxB}, j1 = Object.fromEntries(J1.map(c => [c.pandId, c.truth]));
const COLOUR = {nb: 'near_black_painted', db: 'dark_brown_brick', rb: 'red_brown_brick', ob: 'orange_brick', ps: 'pale_salmon_brick', ty: 'tan_yellow_brick', wp: 'white_plaster', gs: 'grey_stone'};
const HEAD = {f: 'flat', s: 'segmental', r: 'round', p: 'pointed'};
const yn = v => v == null ? null : (v === true || v === 'y') ? 'true' : 'false';
// truth(family, question, id) -> string | null
const truth = {
  colour: {wall_colour: id => COLOUR[idxA[id]?.colour] ?? null},
  head: {upper_head: id => HEAD[idxA[id]?.head] ?? null, arch_present: id => idxA[id] ? (idxA[id].head !== 'f' ? 'true' : 'false') : null},
  white: {bands: id => yn(idxA[id]?.bands), surrounds: id => yn(idxA[id]?.surround), cornice: id => yn(idxA[id]?.cornice)},
  occlusion: {van: id => yn(lab[id]?.van ?? (idxA[id] ? 'n' : null)), trunk: id => yn(lab[id]?.trunk ?? (idxA[id] ? 'n' : null)), branches: id => yn(lab[id]?.branches ?? (idxA[id] ? 'n' : null)), scaffold: id => yn(lab[id]?.scaffold ?? (idxA[id] ? 'n' : null)), boat: id => yn(lab[id]?.boat ?? (idxA[id] ? 'n' : null))},
  features: {stoop: id => yn(idxA[id]?.stoop ?? 'n'), balcony: id => yn(idxA[id]?.balcony ?? 'n')},
  dormer_basement: {dormer: id => yn(j1[id]?.dormer), basement: id => yn(j1[id]?.basementEntrance), stoop: id => yn(j1[id]?.basementEntrance)},
  white2: {bands: id => yn(idxA[id]?.bands), surrounds: id => yn(idxA[id]?.surround), balcony: id => yn(idxA[id]?.balcony ?? 'n')},
  colour_words: {wall_colour: id => COLOUR[idxA[id]?.colour] ?? null},
  gable_noref: {gable: id => j1[id]?.gable ?? null},
  gable_crown: {gable: id => j1[id]?.gable ?? null},
};
const pick = a => {
  if (a?.type === 'noul') return {c: a.noul >= 0.5 ? 'true' : 'false', p: Math.max(a.noul, 1 - a.noul), hedge: a.noul > 0.3 && a.noul < 0.7};
  if (a?.type === 'choice') { const pr = Object.entries(a.probabilities ?? {}), mx = Math.max(...pr.map(x => x[1])); return {c: a.choice, p: a.confidence ?? mx, hedge: mx > 0.3 && mx < 0.7, probs: a.probabilities}; }
  return null;
};
const load = async (fam, run) => { const d = path.join(CACHE, 'runs', fam, run); const o = {}; try { for (const f of await fs.readdir(d)) { const j = JSON.parse(await fs.readFile(path.join(d, f), 'utf8')); if (j.status === 200) o[j.id] = j; } } catch {} return o; };
const out = [];
for (const [fam, qs] of Object.entries(truth)) {
  const r1 = await load(fam, R1), r2 = await load(fam, R2), tokens = Object.values(r1).reduce((a, x) => a + x.tokens, 0) / Math.max(1, Object.keys(r1).length);
  for (const [q, tf] of Object.entries(qs)) {
    const rows = [];
    for (const id of Object.keys(r1)) { const t = tf(id), a = pick(r1[id].response.answers[q]), b = pick(r2[id]?.response.answers[q]); if (t != null && a && b) rows.push({id, t, a, b}); }
    if (!rows.length) continue;
    const n = rows.length, cnt = {}; rows.forEach(r => cnt[r.t] = (cnt[r.t] ?? 0) + 1);
    const acc = k => rows.filter(r => r[k].c === r.t).length / n, base = Math.max(...Object.values(cnt)) / n;
    const conf = rows.filter(r => r.a.c === r.b.c && Math.min(r.a.p, r.b.p) >= 0.8), cacc = conf.length ? conf.filter(r => r.a.c === r.t).length / conf.length : null;
    const pos = rows.filter(r => r.t === 'true'), tp = pos.filter(r => r.a.c === 'true').length, fp = rows.filter(r => r.t === 'false' && r.a.c === 'true').length;
    const wrong = rows.filter(r => r.a.c !== r.t && r.b.c !== r.t).sort((x, y) => y.a.p - x.a.p).slice(0, 10).map(r => ({id: r.id, truth: r.t, jev: r.a.c, p: +r.a.p.toFixed(2)}));
    out.push({family: fam, question: q, n, acc1: +acc('a').toFixed(3), acc2: +acc('b').toFixed(3), baseline: +base.toFixed(3), agree: +(rows.filter(r => r.a.c === r.b.c).length / n).toFixed(3), hedged: +(rows.filter(r => r.a.hedge).length / n).toFixed(3), confAcc: cacc == null ? null : +cacc.toFixed(3), confCov: +(conf.length / n).toFixed(3), wrongConf: (() => { const w = rows.filter(r => r.a.c !== r.t); return w.length ? +(w.reduce((a, r) => a + r.a.p, 0) / w.length).toFixed(3) : null; })(), nWrong: rows.filter(r => r.a.c !== r.t).length, positives: pos.length, tp, fp, tokens: Math.round(tokens), worst: wrong, counts: cnt});
  }
}
await fs.writeFile(path.join(CACHE, OUT), JSON.stringify(out, null, 1));
console.log('family/question | n | acc1/acc2 | base | agree | hedged | conf-acc@cov | pos TP FP');
for (const o of out) console.log(`${o.family}/${o.question} | ${o.n} | ${o.acc1}/${o.acc2} | ${o.baseline} | ${o.agree} | ${o.hedged} | ${o.confAcc}@${o.confCov} | ${o.positives} ${o.tp} ${o.fp}`);
