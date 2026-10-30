/** Decode time per staged cell in Node (desktop CPU): inflate + strict decode, and the tile assembly.
 *   node --import tsx scripts/world/measure-decode.ts [artifacts/world/staging] */
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { decodeCell } from '../../src/canalRecall/world/cellFormat.js';
const dir = path.resolve(process.argv[2] ?? 'artifacts/world/staging');
const files = fs.readdirSync(path.join(dir, 'cells')).filter(f => f.endsWith('.bin'));
for (const f of files.slice(0, 20)) decodeCell(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'cells', f)))); // warm the JIT
const rows: { f: string; n: number; gz: number; inflate: number; decode: number }[] = [];
for (const f of files) {
  const gz = fs.readFileSync(path.join(dir, 'cells', f));
  let t = performance.now(); const raw = zlib.gunzipSync(gz); const inflate = performance.now() - t;
  t = performance.now(); const cell = decodeCell(raw); const decode = performance.now() - t;
  rows.push({ f, n: cell.buildings.length, gz: gz.length, inflate, decode });
}
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const dec = rows.map(r => r.decode), inf = rows.map(r => r.inflate), per = rows.filter(r => r.n > 200).map(r => r.decode / r.n * 1000);
const big = rows.reduce((a, b) => (b.n > a.n ? b : a));
console.log(`| cells | median decode ms | p95 | max | median inflate ms | µs/building | largest cell (buildings, gz) decode ms |\n|---:|---:|---:|---:|---:|---:|---|`);
console.log(`| ${rows.length} | ${q(dec, .5).toFixed(2)} | ${q(dec, .95).toFixed(2)} | ${Math.max(...dec).toFixed(2)} | ${q(inf, .5).toFixed(2)} | ${q(per, .5).toFixed(1)} | ${big.f} (${big.n}, ${big.gz} B) ${big.decode.toFixed(2)} |`);
