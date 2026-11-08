// Slivers, same-class seams and kerb stubs per roads-v1 cell (engine round 5, lane R5-C2, issue #263).
//
//   npx tsx scripts/own-ground/probe-road-slivers.ts [--dir public/data/extracts/amsterdam/roads-v1] [--cells 0_0,-1_0] [--at lng,lat,radiusM]
//
// Per cell: polygons under 2 m² (tiny) or thinner than 0.4 m (thin, 2·area/perimeter), same-class same-h shared edges,
// kerb runs and segments under 1.5 m, kerb runs touching a sliver. `--at` restricts polygons and kerbs to a disc.
// Prints a table and a JSON total; roadSlivers.ts holds the rules.
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { decodeRoadCell, type RoadCell } from '../../src/canalRecall/ownGround/roadCells.ts';
import { sliverStats, type SliverStats, type Vec2 } from '../../src/canalRecall/ownGround/roadSlivers.ts';

const argOf = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const DIR = argOf('--dir') ?? 'public/data/extracts/amsterdam/roads-v1';
const manifest = JSON.parse(readFileSync(`${DIR}/cells.json`, 'utf8')) as { cells: string[] };
const keys = argOf('--cells')?.split(',') ?? manifest.cells;
const at = argOf('--at')?.split(',').map(Number) ?? null;
const centre = at ? toLocal(at[0], at[1]) : null;
const inDisc = (p: Vec2) => !centre || Math.hypot(p[0] - centre[0], p[1] - centre[1]) <= at![2];

const rows: (SliverStats & { key: string })[] = [];
for (const key of keys) {
  const f = `${DIR}/cells/${key}.json.gz`;
  if (!existsSync(f)) continue;
  const cell = decodeRoadCell(JSON.parse(gunzipSync(readFileSync(f)).toString()) as RoadCell);
  const polys = cell.surfaces.filter(s => !centre || s.rings[0].some(inDisc)).map(s => ({ c: s.c, k: s.k, h: s.h, rings: s.rings }));
  const kerbs = cell.kerbs.filter(k => !centre || k.some(inDisc));
  rows.push({ key, ...sliverStats(polys, kerbs) });
}
const total = rows.reduce((t, r) => { for (const [k, v] of Object.entries(r)) if (typeof v === 'number') (t as any)[k] = ((t as any)[k] ?? 0) + v; return t; }, {} as Record<string, number>);
if (rows.length <= 40) console.table(rows);
else console.table([...rows].sort((a, b) => b.slivers - a.slivers).slice(0, 15));
console.log(JSON.stringify({ dir: DIR, cells: rows.length, at, total: Object.fromEntries(Object.entries(total).map(([k, v]) => [k, Math.round(v * 10) / 10])), perCellMean: { slivers: +(total.slivers / Math.max(1, rows.length)).toFixed(1), kerbShort: +(total.kerbShort / Math.max(1, rows.length)).toFixed(1) } }));
