/**
 * What baked shells cost per cell (lane R2-B, #229): SHEL and SHL1 bytes (raw, gzip), triangles and bake time, from a
 * compiled world-v1 directory's cells (default: the published extract), without running the compiler.
 *   node --import tsx scripts/world/shell-bake-cost.ts [--dir=public/data/extracts/amsterdam/world-v1] [--cells=0_-1,-2_-4] [--all]
 */
import './useBrowserMath.js';
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { ROOT, EXTRACT } from './pipeline.js';
import { readCell, readGlobalStrings } from './cellFiles.js';
import { styledFeature, rawFeature, type Cell } from '../../src/canalRecall/world/cellFormat.js';
import { parseCellKey } from '../../src/canalRecall/world/cellGrid.js';
import { encodeShel, encodeShl1, farShellMesh } from '../../src/canalRecall/world/shellMesh.js';
import { bakeCellShell } from './shellBake.js';

const args = process.argv.slice(2);
const value = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const dir = path.resolve(value('dir') ?? path.join(EXTRACT, 'world-v1'));
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const cells: string[] = args.includes('--all') ? Object.keys(index.cells).sort() : (value('cells') ?? '0_-1,-2_-4,-4_0,-1_0,1_0,-1_-1').split(',');
const globals = readGlobalStrings(dir);
const cache = new Map<string, Cell>();
const cellAt = (k: string) => { let c = cache.get(k); if (!c && index.cells[k]) { c = readCell(dir, k, globals); cache.set(k, c); if (cache.size > 30) cache.delete(cache.keys().next().value!); } return c; };
const gz = (b: Uint8Array) => zlib.gzipSync(b, { level: 6 }).length;

async function main() {
  console.log('| cell | buildings | coarse tris | SHL1 tris | SHEL KB raw / gz | SHL1 KB raw / gz | bake ms | simplify ms |');
  console.log('|---|---|---|---|---|---|---|---|');
  const rows: { shel: number; far: number }[] = [];
  for (const key of cells) {
    const cell = cellAt(key); if (!cell) continue;
    const [i, j] = parseCellKey(key);
    const features = cell.buildings.map(b => styledFeature(b, rawFeature(b)) as any);
    const ext = new Set<string>(); for (const b of cell.buildings) for (const n of b.neighbours ?? []) if (typeof n === 'string') ext.add(n);
    // Neighbours in other cells: look them up in the 8 cells around.
    const context: any[] = [];
    if (ext.size) for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { if (!di && !dj) continue; const c = cellAt(`${i + di}_${j + dj}`); if (c) for (const b of c.buildings) if (ext.has(b.id)) context.push(styledFeature(b, rawFeature(b))); }
    const bake = bakeCellShell(i, j, features, context, ROOT);
    if (!bake) { console.log(`| ${key} | ${features.length} | 0 | | | | | |`); continue; }
    const s = encodeShel(bake.shel), f = encodeShl1(bake.far), sg = gz(s), fg = gz(f);
    rows.push({ shel: sg, far: fg });
    console.log(`| ${key} | ${features.length} | ${bake.coarseTriangles} | ${farShellMesh(bake.far).indices.length / 3} | ${(s.length / 1024).toFixed(0)} / ${(sg / 1024).toFixed(1)} | ${(f.length / 1024).toFixed(0)} / ${(fg / 1024).toFixed(1)} | ${bake.ms.toFixed(0)} | ${bake.farMs.toFixed(0)} |`);
  }
  const med = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  console.log(`cells ${rows.length}: SHEL gz median ${(med(rows.map(r => r.shel)) / 1024).toFixed(1)} KB total ${(rows.reduce((a, r) => a + r.shel, 0) / 1048576).toFixed(2)} MB; SHL1 gz median ${(med(rows.map(r => r.far)) / 1024).toFixed(1)} KB total ${(rows.reduce((a, r) => a + r.far, 0) / 1048576).toFixed(2)} MB`);
}
main().catch(e => { console.error(e); process.exit(1); });
