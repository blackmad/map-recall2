/**
 * AHN street-front heights for the belt look (lane D round 6): per belt pand the AHN4 DSM cells within FRONT_BAND_M of its
 * street front line (the generator's fronts.json) inside its footprint, over the median DTM ground around its row. The
 * round-5 judges' photo heights matched this band's p90 (Molenpad 174768: 9.6 m against "eaves about 9.5"; Keizersgracht
 * 179308: 18.2 against "about 18") where 3DBAG's eaves and height did not (7.2 and 14.07; 12.6 and 19.21).
 *
 * Writes a staging extract (default artifacts/buurt-generators/belt-ahn/fronts.json) and prints coverage; it never
 * publishes. Rasters are cached per request in .cache/bag-gaps-ahn (scripts/lib/ahnFootprint.ts), so a rerun is offline.
 *   node --import tsx scripts/belt-look/ahn-fronts.ts [--out=<file>] [--rows=<n>] [--jobs=<n>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { districtPands } from '../buurt-generators/generate.ts';
import { BELT_BUURTEN } from './generate.ts';
import { ahnCellsForRings } from '../lib/ahnFootprint.ts';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { pointInRing, type Ring } from '../../src/canalRecall/landmarks/osmUnderModels.ts';
import { frontBandHeights, type AhnFront } from '../../src/canalRecall/beltLook/ahnFront.ts';

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const out = arg('out') ?? 'artifacts/buurt-generators/belt-ahn/fronts.json', jobs = Number(arg('jobs') ?? 6);
const rowsFile = arg('rows-file') ?? 'artifacts/buurt-generators/belt/rows.json', frontsFile = arg('fronts') ?? 'artifacts/buurt-generators/belt/fronts.json';
const pands = new Map((districtPands({ buurten: BELT_BUURTEN } as never) as Array<{ id: string; ring: [number, number][] }>).map(p => [p.id.replace(/^NL\.IMBAG\.Pand\./, ''), p]));
const fronts = JSON.parse(fs.readFileSync(frontsFile, 'utf8')).fronts as Record<string, { a: [number, number]; b: [number, number] }>;
const rows = (JSON.parse(fs.readFileSync(rowsFile, 'utf8')).rows as Array<{ id: string; members: Array<{ pandId: string }> }>).slice(0, Number(arg('rows') ?? 1e9));
const prior: Record<string, AhnFront> = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')).fronts ?? {} : {};
const res: Record<string, AhnFront> = { ...prior };
let done = 0, failed = 0;
async function one(row: (typeof rows)[number]) {
  const ids = row.members.map(m => m.pandId).filter(id => pands.has(id) && fronts[id] && !res[id]);
  if (!ids.length) return;
  try {
    const rings = ids.map(id => pands.get(id)!.ring as unknown as Ring);
    const { roof, ground } = await ahnCellsForRings(rings, 'ahn4');
    for (const id of ids) {
      const ring = pands.get(id)!.ring.map(p => { const q = lngLatToRd([p[0], p[1]]); return [q.x, q.y]; }) as unknown as Ring;
      const cells = roof.filter(c => pointInRing([c[0], c[1]], ring));
      const f = fronts[id], A = lngLatToRd(f.a), B = lngLatToRd(f.b);
      const h = frontBandHeights(cells, ground, [A.x, A.y], [B.x, B.y]);
      if (h) res[id] = h;
    }
  } catch (e) { failed++; console.error(row.id, String(e).slice(0, 160)); }
  if (++done % 50 === 0) { console.error(`${done}/${rows.length} rows`); save(); }
}
function save() { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify({ source: 'AHN4 dsm_05m/dtm_05m (PDOK WCS, CC0)', bandM: 1.5, fronts: res })); }
const queue = [...rows];
await Promise.all(Array.from({ length: jobs }, async () => { for (let r = queue.shift(); r; r = queue.shift()) await one(r); }));
save();
const all = rows.flatMap(r => r.members.map(m => m.pandId));
console.log(JSON.stringify({ out, rows: rows.length, pands: all.length, measured: all.filter(id => res[id]).length, failedRows: failed }));
