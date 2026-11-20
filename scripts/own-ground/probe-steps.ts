// Steps in the top ground surface around a point (lane fb-ground2-20261120, 3b8ca68b): a crack seen at an angle is two
// surfaces that meet in plan but not in height; top-down layer probes miss it. Lists adjacent samples whose top
// heights differ by more than --min (m), with the layers on either side.
//   node --import tsx scripts/own-ground/probe-steps.ts <lng,lat> [--half=12] [--res=0.25] [--min=0.04] [--opt=name=false,...]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, layersAt, type BuiltCell } from '../../src/canalRecall/ownGround/groundCell.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const opts: Record<string, boolean> = { roads: true };
for (const kv of (flag('opt') ?? '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); opts[k] = v !== 'false'; }
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, opts);
await store.init();
const [lng, lat] = process.argv[2].split(',').map(Number), [cx, cy] = toLocal(lng, lat);
const half = Number(flag('half') ?? 12), res = Number(flag('res') ?? 0.25), min = Number(flag('min') ?? 0.04);
const keys = new Set<string>();
for (const dx of [-half, half]) for (const dy of [-half, half]) keys.add(store.cellAt(cx + dx, cy + dy));
const cells: { cell: BuiltCell; rect: readonly number[] }[] = [];
for (const k of keys) if (store.covers(k)) cells.push({ cell: buildCell(await store.cellInput(k, 0)), rect: store.cellRect(k) });
const top = (x: number, y: number) => {
  const c = cells.find(c => x >= c.rect[0] && x < c.rect[2] && y >= c.rect[1] && y < c.rect[3]);
  const h = c ? layersAt(c.cell, x, y) : null;
  const t = h?.hits.find(q => !q.cut && q.layer !== 'water');
  return t ? { layer: t.layer, z: t.z } : null;
};
const n = Math.round(2 * half / res);
const grid = Array.from({ length: n + 1 }, (_, j) => Array.from({ length: n + 1 }, (_, i) => top(cx - half + i * res, cy - half + j * res)));
let count = 0;
for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) for (const [di, dj] of [[1, 0], [0, 1]]) {
  if (i + di > n || j + dj > n) continue;
  const a = grid[j][i], b = grid[j + dj][i + di];
  if (!a || !b || Math.abs(a.z - b.z) <= min) continue;
  count++;
  if (!process.argv.includes('--quiet')) console.log(`${(-half + (i + di / 2) * res).toFixed(2)},${(-half + (j + dj / 2) * res).toFixed(2)} ${a.layer}@${a.z} | ${b.layer}@${b.z}`);
}
console.log(`steps > ${min} m: ${count}`);
