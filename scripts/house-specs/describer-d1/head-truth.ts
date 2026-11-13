// D1-fix 3: per-row head truth on the 19th-century ring (integrator ruling). A fresh opus labeller, blind to every D1 read, labels
// the window head of each row of the outlined front on its describe cut; pands are taken in a seeded random order from the AH07
// cuts built 1850-1914 (ah07-probe.json years) until about 40 carry a round or segmental row. Then a v4.2 describer read of the
// same cuts is scored per row (round and segmental precision and recall, Wilson 95 %).
//
//   node --import tsx scripts/house-specs/describer-d1/head-truth.ts pool [--seed 13] [--shards 2]   write head-truth/pool-<k>.txt
//   echo '{"readable":true,"rows":["flat","segmental","round"]}' | ... head-truth.ts write <pandId> --reader "..."   one label
//   node --import tsx scripts/house-specs/describer-d1/head-truth.ts set        head-truth/set.json (labelled pands with a round/segmental row)
//   node --import tsx scripts/house-specs/describer-d1/head-truth.ts sheet --out <dir>   contact sheets: cut + label per row
//   node --import tsx scripts/house-specs/describer-d1/head-truth.ts score [--answers <dir>]   per-row score of a describer read
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { wilson } from '../../../src/canalRecall/houseSpec/describerScore.ts';
import { loadAnswers } from './score.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const D = path.join(ROOT, 'artifacts/describer-d1');
const OUT = path.join(D, 'head-truth');
const CUTS = path.join(D, 'cuts-ah07');
/** Row labels: the describer's head classes, `none` for a row with no window head to read (a door-only or shop ground). */
export const ROW_LABELS = ['flat', 'segmental', 'round', 'relieving', 'pointed', 'mixed', 'none', 'not-visible'] as const;
export type RowLabel = (typeof ROW_LABELS)[number];
export type HeadLabel = { v: 1; pandId: string; image: string; reader: string; readable: boolean; rows: RowLabel[]; notes?: string };

export function labelProblems(x: any): string[] {
  const p: string[] = [];
  if (typeof x?.readable !== 'boolean') p.push('readable: boolean');
  if (!Array.isArray(x?.rows)) p.push('rows: a list, ground row first, one label per row below the crown');
  else {
    if (x.readable && !x.rows.length) p.push('rows: a readable front has at least one row');
    if (!x.readable && x.rows.length) p.push('rows: [] when not readable');
    for (const r of x.rows) if (!ROW_LABELS.includes(r)) p.push(`rows: ${JSON.stringify(r)} not in ${ROW_LABELS.join('|')}`);
  }
  return p;
}
/** A labelled pand belongs to the set when an upper row is round or segmental. */
export const inSet = (l: Pick<HeadLabel, 'readable' | 'rows'>): boolean => l.readable && l.rows.slice(1).some(r => r === 'round' || r === 'segmental');

/** Seeded shuffle (mulberry32). */
export function shuffle<T>(xs: T[], seed: number): T[] {
  let a = seed >>> 0; const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = [...xs]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out;
}

/** Per-row precision and recall of describer heads against labels (pands whose row counts agree; upper rows). */
export function scoreHeads(answers: Map<string, { readable: boolean; heads: readonly string[] }>, labels: Map<string, HeadLabel>, classes = ['round', 'segmental', 'flat']) {
  const t: Record<string, { tp: number; read: number; truth: number }> = Object.fromEntries(classes.map(c => [c, { tp: 0, read: 0, truth: 0 }]));
  const conf: Record<string, number> = {};
  let pands = 0, misaligned = 0;
  for (const [id, l] of labels) {
    const a = answers.get(id); if (!a || !a.readable || !l.readable) continue;
    if (a.heads.length !== l.rows.length) { misaligned++; continue; }
    pands++;
    for (let s = 1; s < l.rows.length; s++) {
      const r = a.heads[s] === 'relieving' ? 'flat' : a.heads[s], g = l.rows[s] === 'relieving' ? 'flat' : l.rows[s];
      if (['not-visible', 'none', 'mixed'].includes(g) || r === 'not-visible') continue;
      conf[`${r}->${g}`] = (conf[`${r}->${g}`] ?? 0) + 1;
      if (t[r]) t[r].read++;
      if (t[g]) t[g].truth++;
      if (r === g && t[r]) t[r].tp++;
    }
  }
  const per = Object.fromEntries(classes.map(c => [c, { rowsRead: t[c].read, precision: t[c].read ? +(t[c].tp / t[c].read).toFixed(3) : null, precisionCI: wilson(t[c].tp, t[c].read),
    rowsTruth: t[c].truth, recall: t[c].truth ? +(t[c].tp / t[c].truth).toFixed(3) : null, recallCI: wilson(t[c].tp, t[c].truth) }]));
  return { pands, misaligned, per, confusion: conf };
}

const loadLabels = (): Map<string, HeadLabel> => {
  const dir = path.join(OUT, 'labels'), m = new Map<string, HeadLabel>();
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const l = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); m.set(l.pandId, l); }
  return m;
};

async function sheet(out: string) {
  const set: string[] = JSON.parse(fs.readFileSync(path.join(OUT, 'set.json'), 'utf8')).pands;
  const labels = loadLabels();
  fs.mkdirSync(out, { recursive: true });
  const W = 420, H = 480, TW = 200, per = 8;
  for (let p = 0; p * per < set.length; p++) {
    const ids = set.slice(p * per, (p + 1) * per), cols = 4, rowsN = Math.ceil(ids.length / cols);
    const comps: sharp.OverlayOptions[] = [];
    for (const [i, id] of ids.entries()) {
      const x = (i % cols) * (W + TW), y = Math.floor(i / cols) * H;
      const img = await sharp(path.join(CUTS, `${id}.jpg`)).resize(W, H, { fit: 'inside', background: '#fff' }).toBuffer();
      comps.push({ input: img, left: x, top: y });
      const l = labels.get(id)!;
      const lines = [id.slice(-6), ...l.rows.map((r, s) => `row ${s}${s === 0 ? ' (ground)' : ''}: ${r}`).reverse()];
      const svg = `<svg width="${TW}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#fff"/>${lines.map((t, k) => `<text x="8" y="${24 + k * 20}" font-family="Helvetica" font-size="${k ? 14 : 16}" font-weight="${k ? 400 : 700}" fill="${/: round$/.test(t) ? '#b00' : /: segmental$/.test(t) ? '#05a' : '#222'}">${t}</text>`).join('')}</svg>`;
      comps.push({ input: Buffer.from(svg), left: x + W, top: y });
    }
    const file = path.join(out, `head-truth-sheet-${p + 1}.jpg`);
    await sharp({ create: { width: cols * (W + TW), height: rowsN * H, channels: 3, background: '#ffffff' } }).composite(comps).jpeg({ quality: 82 }).toFile(file);
    console.log(file);
  }
}

async function main() {
  const [cmd, id] = process.argv.slice(2);
  const opt = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
  fs.mkdirSync(path.join(OUT, 'labels'), { recursive: true });
  if (cmd === 'pool') {
    const probe = JSON.parse(fs.readFileSync(path.join(D, 'ah07-probe.json'), 'utf8'));
    const cuts = fs.readdirSync(CUTS).filter(f => /^\d{16}\.jpg$/.test(f)).map(f => f.slice(0, 16)).sort();
    const pool = shuffle(cuts.filter(i => { const y = probe[i]?.year; return y && y >= 1850 && y <= 1914; }), Number(opt('seed') ?? 13));
    const k = Number(opt('shards') ?? 2);
    for (let s = 0; s < k; s++) fs.writeFileSync(path.join(OUT, `pool-${s}.txt`), `${pool.filter((_, i) => i % k === s).map(i => `${i} ${path.join(CUTS, `${i}.jpg`)}`).join('\n')}\n`);
    console.log(`pool: ${pool.length} cuts built 1850-1914, ${k} shards`);
  } else if (cmd === 'write') {
    const body = JSON.parse(fs.readFileSync(0, 'utf8').trim().replace(/^```(json)?|```$/g, ''));
    const p = labelProblems(body); if (!/^\d{16}$/.test(id ?? '')) p.push('pandId');
    if (p.length) { console.error(p.join('\n')); process.exit(1); }
    const l: HeadLabel = { v: 1, pandId: id, image: `artifacts/describer-d1/cuts-ah07/${id}.jpg`, reader: opt('reader') ?? 'head-truth', readable: body.readable, rows: body.rows, ...(body.notes ? { notes: body.notes } : {}) };
    fs.writeFileSync(path.join(OUT, 'labels', `${id}.json`), `${JSON.stringify(l, null, 1)}\n`);
    const n = [...loadLabels().values()].filter(inSet).length;
    console.log(`ok ${id}${inSet(l) ? ' (in set)' : ''}; set so far ${n}`);
  } else if (cmd === 'set') {
    const L = [...loadLabels().values()];
    const set = L.filter(inSet).map(l => l.pandId).sort();
    fs.writeFileSync(path.join(OUT, 'set.json'), `${JSON.stringify({ v: 1, about: 'AH07 cuts built 1850-1914, labelled per row by a fresh opus reader blind to D1; pands with a round or segmental upper row', labelled: L.length, pands: set }, null, 1)}\n`);
    fs.writeFileSync(path.join(OUT, 'set-ids.txt'), `${set.map(i => `${i} ${path.join(CUTS, `${i}.jpg`)}`).join('\n')}\n`);
    console.log(`labelled ${L.length}, in set ${set.length}`);
  } else if (cmd === 'sheet') await sheet(opt('out') ?? path.join(OUT, 'sheets'));
  else if (cmd === 'score') {
    const set = new Set<string>(JSON.parse(fs.readFileSync(path.join(OUT, 'set.json'), 'utf8')).pands);
    const labels = new Map([...loadLabels()].filter(([k]) => set.has(k)));
    const A = loadAnswers(opt('answers') ?? path.join(D, 'answers-v42-cut-heads'));
    const r = scoreHeads(A as any, labels);
    fs.writeFileSync(opt('out') ?? path.join(OUT, 'score.json'), `${JSON.stringify({ v: 1, set: set.size, ...r }, null, 1)}\n`);
    console.log(`set ${set.size}, scored ${r.pands} (row counts differ on ${r.misaligned})\n| class | rows read | precision | 95 % CI | rows labelled | recall | 95 % CI |\n|---|---|---|---|---|---|---|`);
    for (const [c, x] of Object.entries(r.per) as [string, any][]) console.log(`| ${c} | ${x.rowsRead} | ${x.precision ?? '-'} | ${x.precisionCI.join('-')} | ${x.rowsTruth} | ${x.recall ?? '-'} | ${x.recallCI.join('-')} |`);
    console.log(`read->label: ${JSON.stringify(r.confusion)}`);
  } else console.log('head-truth.ts pool | write <pandId> | set | sheet | score');
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
