/**
 * Jev facade spike (lane J1, #326): score runs against the truth set.
 *
 *   node --import tsx scripts/jev/score.ts [--dir=.cache/jev-facades] [--runs=run1,run2] [--out=<staging json>]
 *
 * Per question: accuracy per run, hedged share (selected probability or noul in 0.3..0.7), drift between runs, and an
 * accept threshold tuned on this data (lowest confidence at which accepted answers are >= 95 % right, both runs agreeing).
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const arg = (n: string, d: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const DIR = path.resolve(arg('dir', '.cache/jev-facades')), RUNS = arg('runs', 'run1,run2').split(',');
const OUT = arg('out', 'public/data/extracts/amsterdam/staging/jev-facades-20261110/scores.json');
const PRICE = 0.042 / 1e6, WORDS = ['one', 'two', 'three', 'four', 'five'];
const set: any[] = JSON.parse(await fs.readFile(path.join(DIR, 'set.json'), 'utf8'));
const runs: Record<string, Record<string, any>> = {};
for (const r of RUNS) { runs[r] = {}; for (const c of set) runs[r][c.pandId] = JSON.parse(await fs.readFile(path.join(DIR, 'runs', r, `${c.pandId}.json`), 'utf8')); }

type Item = {pandId: string; truth: any; pred: any[]; conf: number[]; probs?: any[]};
/** One field: truth getter, prediction from an answer, and a confidence in 0..1 (selected prob, or noul distance from 0.5 scaled). */
const FIELDS: Record<string, {q: string; truth: (c: any) => any; pred: (a: any) => any; conf: (a: any) => number; hedge: (a: any) => boolean; eq?: (p: any, t: any) => boolean}> = {};
const choice = (q: string, truth: (c: any) => any, map: (x: string) => any = x => x, eq?: (p: any, t: any) => boolean) => (FIELDS[q] = {q, truth, pred: a => map(a.choice), conf: a => a.probabilities[a.choice], hedge: a => a.probabilities[a.choice] >= 0.3 && a.probabilities[a.choice] <= 0.7, eq});
const noul = (q: string, truth: (c: any) => any) => (FIELDS[q] = {q, truth, pred: a => a.noul >= 0.5, conf: a => Math.abs(a.noul - 0.5) * 2, hedge: a => a.noul >= 0.3 && a.noul <= 0.7});
choice('gable', c => c.truth.gable);
choice('finish', c => c.truth.finish);
noul('white_frames', c => c.truth.whiteFrames);
noul('stone_bands', c => c.truth.stoneBands);
noul('shopfront', c => c.truth.shopfront);
noul('basement_entrance', c => c.truth.basementEntrance);
noul('dormer', c => c.truth.dormer);
choice('bays_picture', c => c.truth.bays, x => +x);
choice('bays_word', c => c.truth.bays, x => WORDS.indexOf(x) + 1);
FIELDS['bays_picture±1'] = {...FIELDS.bays_picture, q: 'bays_picture', eq: (p, t) => Math.abs(p - t) <= 1};
FIELDS['bays_word±1'] = {...FIELDS.bays_word, q: 'bays_word', eq: (p, t) => Math.abs(p - t) <= 1};

// Door box: the door's bay from the intent, mapped into crop coordinates (crops widened into neighbours shift it).
const doorSpan = (c: any): [number, number] | null => {
  if (c.truth.doorBay === null || c.truth.doorBay === undefined || !c.truth.bays || !c.cropPx) return null;
  const cw = c.cropPx[1] - c.cropPx[0], x0 = (c.px[0] - c.cropPx[0]) / cw, w = (c.px[1] - c.px[0]) / cw / c.truth.bays;
  return [x0 + c.truth.doorBay * w, x0 + (c.truth.doorBay + 1) * w];
};
FIELDS.door_box = {q: 'door_box', truth: c => doorSpan(c), pred: a => (a.box.left + a.box.right) / 2, conf: a => a.confidence, hedge: a => a.confidence >= 0.3 && a.confidence <= 0.7,
  eq: (x, [l, r]) => x >= l - 0.5 * (r - l) && x <= r + 0.5 * (r - l)};

const results: Record<string, any> = {}, items: Record<string, Item[]> = {};
for (const [name, f] of Object.entries(FIELDS)) {
  const eq = f.eq ?? ((p: any, t: any) => p === t);
  const its: Item[] = set.filter(c => f.truth(c) !== null && f.truth(c) !== undefined).map(c => {
    const as = RUNS.map(r => runs[r][c.pandId].response.answers[f.q]);
    return {pandId: c.pandId, truth: f.truth(c), pred: as.map(f.pred), conf: as.map(f.conf), probs: as.map(a => a.probabilities ?? a.noul ?? a.box)};
  });
  items[name] = its;
  const n = its.length, acc = RUNS.map((_, k) => its.filter(i => eq(i.pred[k], i.truth)).length / (n || 1));
  const hedged = RUNS.map(r => set.filter(c => f.truth(c) !== null && f.truth(c) !== undefined).filter(c => f.hedge(runs[r][c.pandId].response.answers[f.q])).length / (n || 1));
  // Drift: a different answer between runs (boxes: the centre moved by more than a tenth of the width).
  const drift = its.filter(i => typeof i.pred[0] === 'number' && f.q === 'door_box' ? Math.abs(i.pred[0] - i.pred[1]) > 0.1 : JSON.stringify(i.pred[0]) !== JSON.stringify(i.pred[1])).length / (n || 1);
  // Accept rule: both runs agree and min confidence >= t. Pick the lowest t whose accepted answers are >= 95 % right
  // (with at least 5 accepted); report accepted share and accuracy, the rest goes to review.
  const agree = its.filter(i => JSON.stringify(i.pred[0]) === JSON.stringify(i.pred[1]));
  let rule: any = null;
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const acc_ = agree.filter(i => Math.min(...i.conf) >= t), right = acc_.filter(i => eq(i.pred[0], i.truth)).length;
    if (acc_.length >= 5 && right / acc_.length >= 0.95) { rule = {threshold: +t.toFixed(2), accepted: acc_.length, acceptedShare: +(acc_.length / n).toFixed(3), acceptedAccuracy: +(right / acc_.length).toFixed(3), review: n - acc_.length}; break; }
  }
  const base = n ? Math.max(...Object.values(its.reduce((m: any, i) => ((m[JSON.stringify(i.truth)] = (m[JSON.stringify(i.truth)] ?? 0) + 1), m), {})) as number[]) / n : 0;
  results[name] = {n, accuracy: acc.map(x => +x.toFixed(3)), majorityBaseline: +base.toFixed(3), hedgedShare: hedged.map(x => +x.toFixed(3)), drift: +drift.toFixed(3), acceptRule95: rule};
}
// Gable confusion (run1).
const confusion: Record<string, Record<string, number>> = {};
for (const i of items.gable) { (confusion[i.truth] ??= {})[i.pred[0]] = (confusion[i.truth][i.pred[0]] ?? 0) + 1; }
// Guards and crown box plausibility (no hand truth for the crown box: report where it lands).
const guard = (q: string) => RUNS.map(r => +(set.filter(c => runs[r][c.pandId].response.answers[q].noul >= 0.5).length / set.length).toFixed(3));
const crownTops = set.map(c => runs[RUNS[0]][c.pandId].response.answers.crown_box.box);
const crown = {presentShare: guard('crown_present'), topInUpperThird: +(crownTops.filter(b => b.top <= 0.33).length / set.length).toFixed(3), fullWidthShare: +(crownTops.filter(b => b.right - b.left >= 0.9).length / set.length).toFixed(3)};
// Cost and latency.
const all = RUNS.flatMap(r => set.map(c => runs[r][c.pandId]));
const lat = all.map(x => x.latencyMs).sort((a, b) => a - b), tok = all.map(x => x.response.usage.input_tokens);
const wall = RUNS.map(r => { const t = set.map(c => Date.parse(runs[r][c.pandId].at)); return (Math.max(...t) - Math.min(...t)) / 1000; });
const cost = {calls: all.length, inputTokensMean: Math.round(tok.reduce((a, b) => a + b) / tok.length), inputTokensMax: Math.max(...tok), usdPerCall: +(tok.reduce((a, b) => a + b) / tok.length * PRICE).toFixed(6), usdTotal: +(tok.reduce((a, b) => a + b) * PRICE).toFixed(4),
  latencyMs: {p50: lat[Math.floor(lat.length / 2)], p90: lat[Math.floor(lat.length * 0.9)], max: lat[lat.length - 1]}, wallSecondsPerRunAt4: wall.map(x => +x.toFixed(1))};
// Worst misses: wrong answers ranked by the confidence of the wrong answer (min over runs, so both runs were sure).
const misses: any[] = [];
for (const name of ['gable', 'finish', 'white_frames', 'stone_bands', 'shopfront', 'basement_entrance', 'dormer', 'bays_word±1']) {
  const eq = FIELDS[name].eq ?? ((p: any, t: any) => p === t);
  for (const i of items[name]) if (!eq(i.pred[0], i.truth) && !eq(i.pred[1], i.truth)) misses.push({field: name, pandId: i.pandId, truth: i.truth, pred: i.pred, conf: Math.min(...i.conf), address: set.find(c => c.pandId === i.pandId).address, face: set.find(c => c.pandId === i.pandId).face});
}
misses.sort((a, b) => b.conf - a.conf);
const out = {version: 1, lane: 'j1-jev-facades-20261110', model: 'jev-1.14.0', generated: new Date().toISOString().slice(0, 10), runs: RUNS, setSize: set.length,
  truthSources: {kit: set.filter(c => c.truth.gableSource === 'kit').length, register: set.filter(c => c.truth.gableSource === 'register').length},
  fields: results, gableConfusionRun1: confusion, guards: {door_present: guard('door_present'), crown_present: guard('crown_present')}, crownBox: crown, cost, worstMisses: misses.slice(0, 10), allMisses: misses.length};
await fs.mkdir(path.dirname(OUT), {recursive: true});
await fs.writeFile(OUT, JSON.stringify(out, null, 1) + '\n');
for (const [k, v] of Object.entries(results)) console.log(`${k.padEnd(18)} n=${String(v.n).padStart(2)} acc ${v.accuracy.join('/')} base ${v.majorityBaseline} hedged ${v.hedgedShare.join('/')} drift ${v.drift} accept95 ${v.acceptRule95 ? `t=${v.acceptRule95.threshold} ${v.acceptRule95.accepted}/${v.n} @${v.acceptRule95.acceptedAccuracy}` : 'none'}`);
console.log('gable confusion', JSON.stringify(confusion)); console.log('guards', JSON.stringify(out.guards), 'crown', JSON.stringify(crown)); console.log('cost', JSON.stringify(cost));
for (const m of out.worstMisses) console.log(`miss ${m.field} ${m.pandId} truth ${JSON.stringify(m.truth)} pred ${JSON.stringify(m.pred)} conf ${m.conf.toFixed(2)} ${m.address ?? m.face}`);
