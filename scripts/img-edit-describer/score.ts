/**
 * Image-edit describer pilot: per-field accuracy of each condition's reads against the truth reads.
 *
 *   node --import tsx scripts/img-edit-describer/score.ts <work-dir>
 *
 * <work-dir>/key.json maps opaque image ids to {front, condition}; <work-dir>/reads/*.json are the describer answers
 * (id -> fields). Truth for a front is the read of its clear photo (condition `truth`). For every other condition and
 * field: answered share (coverage) and accuracy over the answered fields; integer fields also within +-1.
 * Fronts without a truth photo score agreement with the occluded read instead (`vs-occluded`).
 */
import fs from 'node:fs';
import path from 'node:path';

const FIELDS = ['storeys', 'roofStorey', 'bays', 'windowKind', 'windowHead', 'crown', 'wallColour', 'finish', 'whiteFrames', 'entrances', 'erkers', 'balconies', 'dormers', 'shopfront'] as const;
const INT = new Set(['storeys', 'bays', 'entrances', 'erkers', 'balconies', 'dormers']);
const NV = 'not-visible';

const dir = path.resolve(process.argv[2]);
const key: Record<string, { front: string; condition: string }> = JSON.parse(fs.readFileSync(path.join(dir, 'key.json'), 'utf8'));
const reads: Record<string, any> = {};
for (const f of fs.readdirSync(path.join(dir, 'reads'))) if (f.endsWith('.json')) Object.assign(reads, JSON.parse(fs.readFileSync(path.join(dir, 'reads', f), 'utf8')));

const byFront = new Map<string, Record<string, any>>();
for (const [id, k] of Object.entries(key)) {
  if (!reads[id]) { console.error(`missing read ${id} (${k.front} ${k.condition})`); continue; }
  const m = byFront.get(k.front) ?? {}; m[k.condition] = reads[id]; byFront.set(k.front, m);
}
type Tally = { n: number; answered: number; exact: number; near: number };
const tally = new Map<string, Tally>();
const add = (cond: string, field: string, a: any, t: any) => {
  const k = `${cond}|${field}`, x = tally.get(k) ?? { n: 0, answered: 0, exact: 0, near: 0 };
  x.n++;
  if (a !== NV && a !== undefined && a !== null) {
    x.answered++;
    if (String(a) === String(t)) { x.exact++; x.near++; }
    else if (INT.has(field) && Math.abs(Number(a) - Number(t)) <= 1) x.near++;
  }
  tally.set(k, x);
};
const perFront: any[] = [];
for (const [front, m] of byFront) {
  const base = m.truth ? 'truth' : 'occluded', truth = m[base];
  for (const [cond, r] of Object.entries(m)) {
    if (cond === base) continue;
    const label = m.truth ? cond : `${cond}~vs-occluded`;
    let ok = 0, of = 0;
    for (const f of FIELDS) {
      if (truth[f] === NV || truth[f] === undefined) continue;
      add(label, f, r[f], truth[f]); of++; if (String(r[f]) === String(truth[f])) ok++;
    }
    perFront.push({ front, condition: label, exact: ok, of });
  }
}
const conds = [...new Set([...tally.keys()].map(k => k.split('|')[0]))].sort();
const lines = ['| field | ' + conds.join(' | ') + ' |', '|---|' + conds.map(() => '---').join('|') + '|'];
const pct = (a: number, b: number) => b ? `${Math.round(100 * a / b)} %` : '-';
for (const f of [...FIELDS, 'ALL']) {
  const cells = conds.map(c => {
    const xs = f === 'ALL' ? FIELDS.map(g => tally.get(`${c}|${g}`)).filter(Boolean) as Tally[] : [tally.get(`${c}|${f}`)].filter(Boolean) as Tally[];
    const s = xs.reduce((a, x) => ({ n: a.n + x.n, answered: a.answered + x.answered, exact: a.exact + x.exact, near: a.near + x.near }), { n: 0, answered: 0, exact: 0, near: 0 });
    if (!s.n) return '-';
    return `${pct(s.exact, s.answered)} (${s.exact}/${s.answered}${INT.has(f) ? `, ±1 ${pct(s.near, s.answered)}` : ''}; cov ${pct(s.answered, s.n)})`;
  });
  lines.push(`| ${f} | ${cells.join(' | ')} |`);
}
const md = lines.join('\n');
fs.writeFileSync(path.join(dir, 'scores.md'), md + '\n');
fs.writeFileSync(path.join(dir, 'per-front.json'), JSON.stringify(perFront, null, 1));
console.log(md);
