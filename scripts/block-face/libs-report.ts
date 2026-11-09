/**
 * Per-face tabulation of a dry-run batch report (block-face libs round 2, #113): for each face of a batch report
 * (scripts/block-face/batch/<name>.json) the pands that were vetoed before any comparison (no front on the strip, no
 * strip data, every type vetoed on year/frontage/crown/material), compared and held (best type under the score, the
 * likeness gate, the run rule), and placed, plus the face's would-place verdict. Reads auto-place.json from the
 * checkout the batch ran in.
 *
 *   node --import tsx scripts/block-face/libs-report.ts --batch=<report.json> [--root=<checkout>] [--title=<text>]
 *
 * Prints markdown: a totals table, a reason histogram and one row per face.
 */
import fs from 'node:fs';
import path from 'node:path';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);

export type Bucket = 'vetoed' | 'held' | 'placed';
export interface PandRow { stage?: string; status: string; reason?: string }

/** Where a pand of auto-place.json falls: vetoed before the comparison, compared and held, or placed. */
export function bucketOf(p: PandRow): Bucket {
  if (p.status !== 'held') return 'placed';
  if (p.stage === 'evidence') return 'vetoed';
  if (p.stage === 'match' && /^every type vetoed|^no types|^type has no match/.test(p.reason ?? '')) return 'vetoed';
  return 'held';
}

/** A short stable reason for a hold: the stage and the reason with numbers and ids collapsed. */
export function reasonKey(p: PandRow): string {
  const r = String(p.reason ?? '').replace(/\(best [^:]*: /, '(').replace(/[\d.]+/g, '#').replace(/\s+/g, ' ');
  return `${p.stage ?? '-'}: ${r.slice(0, 90)}`;
}

if (process.argv[1]?.endsWith('libs-report.ts')) {
  const batch = arg('batch'), root = arg('root') ?? '.';
  if (!batch) throw Error('--batch=<report.json> required');
  const rep = JSON.parse(fs.readFileSync(path.resolve(batch), 'utf8'));
  const tot = {faces: 0, pands: 0, vetoed: 0, held: 0, placed: 0, wouldPlace: 0, wouldPlacePands: 0};
  const hist = new Map<string, number>(), lines: string[] = [];
  const seen = new Set<string>();
  for (const r of rep.rows as any[]) {
    if (r.status === 'skipped') continue;
    const apFile = path.join(root, 'scripts/block-face/faces', r.face, 'auto-place.json');
    const ap = fs.existsSync(apFile) ? JSON.parse(fs.readFileSync(apFile, 'utf8')) : null;
    const would = String(r.status).startsWith('passed') || r.status === 'installed';
    let v = 0, h = 0, p = 0;
    if (!seen.has(r.face)) {
      seen.add(r.face); tot.faces++;
      for (const x of ap?.pands ?? []) { const b = bucketOf(x); if (b === 'vetoed') v++; else if (b === 'held') h++; else p++; if (b !== 'placed') hist.set(reasonKey(x), (hist.get(reasonKey(x)) ?? 0) + 1); }
      tot.pands += v + h + p; tot.vetoed += v; tot.held += h; tot.placed += p;
      if (!ap) lines.push(`| ${r.face} | ${r.street} | ${r.pands} | ? | ? | ? | ${r.status} | ${(r.reasons ?? []).join(' ; ').slice(0, 160)} |`);
    }
    if (ap || r.run !== r.face) lines.push(`| ${r.run} | ${r.street} | ${ap ? v + h + p : r.pands} | ${ap ? v : '-'} | ${ap ? h : '-'} | ${ap ? p : '-'} | ${would ? 'WOULD PLACE' : r.status === 'failed' ? 'held' : r.status}${r.nccMin != null ? ` (NCC ${r.nccMin})` : ''} | ${(r.reasons ?? []).join(' ; ').replace(/\|/g, '/').slice(0, 200)} |`);
    if (would) { tot.wouldPlace++; tot.wouldPlacePands += r.pands; }
  }
  console.log(`### ${arg('title') ?? rep.name}\n`);
  console.log(`faces ${tot.faces}; pands ${tot.pands}: vetoed-before-comparison ${tot.vetoed}, compared-and-held ${tot.held}, placed by auto-place ${tot.placed}; runs that would place ${tot.wouldPlace} (${tot.wouldPlacePands} pands)\n`);
  console.log('Hold reasons (pands):\n');
  for (const [k, n] of [...hist].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`- ${n} x ${k}`);
  console.log('\n| run | street | pands | vetoed | held | placed | outcome | reasons |\n|---|---|---|---|---|---|---|---|');
  console.log(lines.join('\n'));
}
