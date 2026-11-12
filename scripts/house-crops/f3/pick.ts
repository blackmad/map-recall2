/**
 * F3 round 3: rank the thumbnail candidates on pixel flags only and name the pick. Reads <archive>/pand-crops/<id>/front.json (thumb phase),
 * writes {id: {chosen, order}} where `order` is every candidate file best first (hard-passing by pixel score, then the rest by today's default
 * order) so a failed gate can re-cut the next one. `--next <prev.json> --k <n> --ids <a,b>` writes the pick file of attempt n for those pands.
 *
 *   node --import tsx scripts/house-crops/f3/pick.ts --archive <dir> --out <pick.json>
 *   node --import tsx scripts/house-crops/f3/pick.ts --next <pick.json> --k 1 --ids a,b --out <pick1.json>
 */
import fs from 'node:fs';
import path from 'node:path';
import { rankedCandidates, defaultPick, type Tried } from './rank.ts';

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
export function orderOf(tried: Tried[]): string[] {
  const t = tried.filter(x => x.file && x.flags), ranked = rankedCandidates(t).map(x => x.file!), d = defaultPick(t)?.file;
  const rest = t.filter(x => !ranked.includes(x.file!)).sort((a, b) => (a.second ? 1 : 0) - (b.second ? 1 : 0)).map(x => x.file!);
  return [...new Set([...ranked, ...(d && !ranked.includes(d) ? [d] : []), ...rest])];
}
function main() {
  const out = arg('out'); if (!out) { console.error('usage: pick.ts --archive <dir> --out <f> | --next <f> --k <n> --ids a,b --out <f>'); process.exit(2); }
  const res: Record<string, { chosen: string | null; best: string | null; order: string[] }> = {};
  if (arg('next')) {
    const prev = JSON.parse(fs.readFileSync(arg('next')!, 'utf8')) as typeof res, k = Number(arg('k') ?? 1);
    for (const id of (arg('ids') ?? '').split(',').filter(Boolean)) { const o = prev[id]?.order ?? []; if (o[k]) res[id] = { chosen: o[k], best: o[k], order: o }; }
  } else {
    const archive = arg('archive')!;
    for (const id of fs.readdirSync(path.join(archive, 'pand-crops'))) {
      const f = path.join(archive, 'pand-crops', id, 'front.json'); if (!fs.existsSync(f)) continue;
      const fj = JSON.parse(fs.readFileSync(f, 'utf8')); if (!fj.thumbOnly) continue;
      const order = orderOf(fj.candidates as Tried[]); if (order.length) res[id] = { chosen: order[0], best: order[0], order };
    }
  }
  fs.writeFileSync(out, JSON.stringify(res));
  console.log(`${Object.keys(res).length} picks`);
}
if (process.argv[1]?.endsWith('f3/pick.ts')) main();
