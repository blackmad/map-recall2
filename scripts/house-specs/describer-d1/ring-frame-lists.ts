// Row frame lists for the D1 ring tranche (house:frames --list): one list per street row (tranche-ring.ts row = street x
// area), the staged fronts ordered along the street (projection on the row's principal axis), every `--every`th front
// (default 1; 2 still keeps each front in a 72 deg likeness frame beside its neighbour), each with the cut wall's outward
// bearing so pickWall takes the street front the describer read.
//
//   node --import tsx scripts/house-specs/describer-d1/ring-frame-lists.ts --candidates <ring-candidates.json> --staged <dir>
//     --cuts <cuts.json> --out <dir> [--every 1] [--rows "Ferdinand Bolstraat | Oude Pijp,..."]
import fs from 'node:fs';
import path from 'node:path';
import { wallOf } from './stage.ts';

export const slug = (key: string) => key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** Bearing (deg, clockwise from north) of an RD vector. */
export const bearingOf = (n: [number, number]) => ((Math.atan2(n[0], n[1]) * 180 / Math.PI) + 360) % 360;

/** Order points along their principal axis. */
export function alongOrder<T>(items: T[], at: (t: T) => [number, number]): T[] {
  if (items.length < 3) return items;
  const pts = items.map(at), mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), u = [Math.cos(th), Math.sin(th)];
  return items.map((t, i) => ({ t, k: (pts[i][0] - mx) * u[0] + (pts[i][1] - my) * u[1] })).sort((a, b) => a.k - b.k).map(x => x.t);
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const cand = JSON.parse(fs.readFileSync(opt('candidates')!, 'utf8')), staged = opt('staged')!, out = opt('out')!, every = Number(opt('every') ?? 1);
  const only = opt('rows')?.split(',').map(s => s.trim());
  const cuts = new Map<string, any>((JSON.parse(fs.readFileSync(opt('cuts')!, 'utf8')).rows as any[]).map(r => [r.pandId, r]));
  fs.mkdirSync(out, { recursive: true });
  const index: { key: string; slug: string; staged: number; framed: number }[] = [];
  for (const row of cand.rows.filter((r: any) => r.taken && (!only || only.includes(r.key)))) {
    const fronts = row.fronts.filter((f: any) => fs.existsSync(path.join(staged, `${f.id}.json`)) && cuts.has(f.id));
    const ordered = alongOrder(fronts, (f: any) => f.at as [number, number]);
    const list = ordered.filter((_: unknown, i: number) => i % every === 0).map((f: any) => {
      const w = wallOf(cuts.get(f.id));
      return { pandId: f.id, key: f.id, ...(w ? { bearing: Math.round(bearingOf(w.normal)) } : {}) };
    });
    if (!list.length) continue;
    const s = slug(row.key);
    fs.writeFileSync(path.join(out, `${s}.json`), `${JSON.stringify(list, null, 1)}\n`);
    fs.writeFileSync(path.join(out, `${s}.order.json`), `${JSON.stringify(ordered.map((f: any) => f.id))}\n`);
    index.push({ key: row.key, slug: s, staged: fronts.length, framed: list.length });
  }
  fs.writeFileSync(path.join(out, 'index.json'), `${JSON.stringify(index, null, 1)}\n`);
  for (const r of index) console.log(`${r.slug}: ${r.staged} staged, ${r.framed} framed`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
