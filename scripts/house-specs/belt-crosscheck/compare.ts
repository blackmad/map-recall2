/**
 * Belt cross-check (lane BX, 2026-11-13): compare independent describer v4.3 readings of the belt-20261113 fronts with the
 * installed specs on crown class, rows and bays, and write the review queue.
 *   node --import tsx scripts/house-specs/belt-crosscheck/compare.ts [--specs installed.json] [--answers dir] [--out dir]
 * Spec side: fronts/0 gable (crown), storeys, bays. Reader side: answer.crown, storeyParts.full, bays.
 * Queue rules: crown when the groups differ and the reader's group is one it is reliable for (cornice, step, curved);
 * rows when |diff| >= 2; bays on any disagreement. Reader confidence = the key is in `low`.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const argv = process.argv.slice(2);
const opt = (n: string, d: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const DIR = path.join(ROOT, 'artifacts/belt-crosscheck');
const specs = JSON.parse(fs.readFileSync(opt('specs', path.join(DIR, 'installed.json')), 'utf8'));
const addrs: Record<string, string> = JSON.parse(fs.readFileSync(path.join(DIR, 'addresses.json'), 'utf8'));
const answersDir = opt('answers', path.join(DIR, 'answers'));
const cuts = JSON.parse(fs.readFileSync(path.join(DIR, 'cuts/cuts.json'), 'utf8')).rows as { pandId: string }[];
const cutIds = new Set(cuts.map(r => r.pandId));

/** crown group: the classes the comparison is made in */
export const group = (c: string): string =>
  ({ cornice: 'cornice', mansard: 'cornice', 'pitched-eaves': 'eaves', step: 'step', bell: 'curved', neck: 'curved', 'raised-neck': 'curved',
    spout: 'curved', shouldered: 'curved', point: 'point', flat: 'flat' } as Record<string, string>)[c] ?? c;
const RELIABLE = new Set(['cornice', 'step', 'curved']);

type Row = { pand: string; address: string; field: 'crown' | 'rows' | 'bays'; spec: string | number; reader: string | number; confidence: 'low' | 'normal'; crop: string; readerModel: string; note?: string };
const queue: Row[] = [];
const stats = { specs: Object.keys(specs).length, withCut: 0, answered: 0, readable: 0, noCut: [] as string[],
  crown: { compared: 0, agree: 0, disagree: 0, queued: 0, unreliableReader: 0, notVisible: 0 }, rows: { compared: 0, exact: 0, off1: 0, off2plus: 0, notVisible: 0 }, bays: { compared: 0, agree: 0, disagree: 0, notVisible: 0 },
  crownConfusion: {} as Record<string, number>, rowsDiffHist: {} as Record<string, number> };
for (const [pand, s] of Object.entries<any>(specs)) {
  if (!cutIds.has(pand)) { stats.noCut.push(pand); continue; }
  stats.withCut++;
  const f = fs.existsSync(path.join(answersDir, `${pand}.json`)) ? JSON.parse(fs.readFileSync(path.join(answersDir, `${pand}.json`), 'utf8')) : null;
  if (!f) continue;
  stats.answered++;
  if (!f.readable) continue;
  stats.readable++;
  const fr = s.d.fronts[0], low: string[] = f.low ?? [];
  const base = { pand, address: addrs[pand] ?? fr.street ?? '', crop: `artifacts/belt-crosscheck/cuts/${pand}.jpg`, readerModel: f.reader ?? 'BX opus v4.3' };
  // crown
  const sc: string = fr.gable ?? 'none', rc: string = f.crown;
  if (rc === 'not-visible') stats.crown.notVisible++; else {
    stats.crown.compared++;
    const g = group(sc), rg = group(rc);
    if (g === rg) stats.crown.agree++; else {
      stats.crown.disagree++;
      const key = `spec ${sc} / reader ${rc}`; stats.crownConfusion[key] = (stats.crownConfusion[key] ?? 0) + 1;
      if (RELIABLE.has(rg)) { stats.crown.queued++; queue.push({ ...base, field: 'crown', spec: sc, reader: rc, confidence: low.includes('crown') ? 'low' : 'normal', note: f.cornice && f.cornice !== 'not-visible' ? `reader cornice ${f.cornice}; roof ${f.storeyParts?.roof}` : undefined }); }
      else stats.crown.unreliableReader++;
    }
  }
  // rows
  const sr: number = fr.storeys, rr = f.storeyParts?.full;
  if (typeof rr !== 'number') stats.rows.notVisible++; else if (typeof sr === 'number') {
    stats.rows.compared++;
    const d = Math.abs(sr - rr); stats.rowsDiffHist[(rr - sr > 0 ? '+' : '') + (rr - sr)] = (stats.rowsDiffHist[(rr - sr > 0 ? '+' : '') + (rr - sr)] ?? 0) + 1;
    if (d === 0) stats.rows.exact++; else if (d === 1) stats.rows.off1++; else {
      stats.rows.off2plus++;
      queue.push({ ...base, field: 'rows', spec: sr, reader: rr, confidence: low.includes('storeyParts.full') ? 'low' : 'normal', note: `souterrain ${f.storeyParts.souterrain}, roof ${f.storeyParts.roof}` });
    }
  }
  // bays
  const sb: number = fr.bays, rb = f.bays;
  if (typeof rb !== 'number') stats.bays.notVisible++; else if (typeof sb === 'number') {
    stats.bays.compared++;
    if (sb === rb) stats.bays.agree++; else {
      stats.bays.disagree++;
      queue.push({ ...base, field: 'bays', spec: sb, reader: rb, confidence: low.includes('bays') ? 'low' : 'normal', note: f.columns ? `reader columns ${JSON.stringify(f.columns)}` : undefined });
    }
  }
}
const out = opt('out', DIR);
fs.writeFileSync(path.join(out, 'queue.json'), JSON.stringify({ batch: 'belt-20261113', reader: 'D1 describer prompt v4.3, read by Claude opus (BX) from the panorama cuts', stats, queue }, null, 1) + '\n');
console.log(JSON.stringify(stats, null, 1)); console.log(queue.length, 'queue rows');
