/**
 * FOOT coordinate bytes under alternative grids and orders, for the grid decision (lane brief: report
 * 0.1 m and 0.5 m). Reads staged cells, re-encodes only the coordinate blocks.
 *   node --import tsx scripts/world/measure-grid.ts [artifacts/world/staging]
 */
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { decodeCell, Writer } from '../../src/canalRecall/world/cellFormat.js';
import { CELL_GRID } from '../../src/canalRecall/world/cellGrid.js';

const dir = path.resolve(process.argv[2] ?? 'artifacts/world/staging');
const files = fs.readdirSync(path.join(dir, 'cells')).filter(f => f.endsWith('.bin'));
const [ox, oy] = CELL_GRID.origin, [mx, my] = CELL_GRID.metresPerDegree;
type Variant = { name: string; q: (lng: number, lat: number) => [number, number]; order: 'source' | 'morton' };
const variants: Variant[] = [
  { name: '1e-7 deg (exact), source order', q: (a, b) => [Math.round(a * 1e7), Math.round(b * 1e7)], order: 'source' },
  { name: '1e-7 deg (exact), Morton order', q: (a, b) => [Math.round(a * 1e7), Math.round(b * 1e7)], order: 'morton' },
  { name: '0.1 m grid, Morton order', q: (a, b) => [Math.round((a - ox) * mx * 10), Math.round((b - oy) * my * 10)], order: 'morton' },
  { name: '0.5 m grid, Morton order', q: (a, b) => [Math.round((a - ox) * mx * 2), Math.round((b - oy) * my * 2)], order: 'morton' },
];
const morton = (x: number, y: number) => { let z = 0n; const X = BigInt(Math.max(0, x)), Y = BigInt(Math.max(0, y)); for (let i = 0n; i < 24n; i++) z |= ((X >> i) & 1n) << (2n * i) | ((Y >> i) & 1n) << (2n * i + 1n); return z; };
const totals = variants.map(() => ({ raw: 0, gz: 0 }));
let buildings = 0, vertices = 0;
for (const f of files) {
  const cell = decodeCell(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'cells', f))), f);
  buildings += cell.buildings.length;
  const polys = cell.buildings.map(b => b.geometry.type === 'Polygon' ? [b.geometry.coordinates] : b.geometry.coordinates);
  for (const p of polys) for (const rings of p) for (const r of rings) vertices += r.length - 1;
  variants.forEach((v, vi) => {
    let order = polys.map((_, i) => i);
    if (v.order === 'morton') { const keys = polys.map(p => { const [a, b] = p[0][0][0]; return morton(Math.round((a - ox) * mx), Math.round((b - oy) * my) + 100000); }); order.sort((a, b) => (keys[a] < keys[b] ? -1 : keys[a] > keys[b] ? 1 : a - b)); }
    const xs = new Writer(), ys = new Writer(), extra = new Writer(); let px = 0, py = 0;
    for (const i of order) { if (v.order === 'morton') extra.uvar(i); for (const rings of polys[i]) for (const ring of rings) for (let k = 0; k < ring.length - 1; k++) { const [x, y] = v.q(ring[k][0], ring[k][1]); xs.zvar(x - px); ys.zvar(y - py); px = x; py = y; } }
    const all = Buffer.concat([xs.done(), ys.done(), extra.done()]);
    totals[vi].raw += all.length; totals[vi].gz += zlib.gzipSync(all, { level: 6 }).length;
  });
}
console.log(`${files.length} cells, ${buildings} buildings, ${vertices} stored vertices`);
console.log('| coordinates | raw bytes | gz bytes | gz B/building |\n|---|---:|---:|---:|');
variants.forEach((v, i) => console.log(`| ${v.name} | ${totals[i].raw} | ${totals[i].gz} | ${(totals[i].gz / buildings).toFixed(1)} |`));
