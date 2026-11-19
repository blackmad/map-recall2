// Where the topmost drawn ground layer changes with a ground fix flag (lane fb-bridges-20261119): the offsets (east,
// north metres from the point) whose top differs between the default build and `--opt=name=false`, as before→after.
//
//   node --import tsx scripts/own-ground/probe-top-diff.ts <lng,lat> --opt=name=false [--half=30] [--res=0.5]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, layersAt, type BuiltCell } from '../../src/canalRecall/ownGround/groundCell.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const off: Record<string, boolean> = {};
for (const kv of (flag('opt') ?? '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); off[k] = v !== 'false'; }
const [lng, lat] = process.argv[2].split(',').map(Number), [cx, cy] = toLocal(lng, lat);
const half = Number(flag('half') ?? 30), res = Number(flag('res') ?? 0.5);
async function tops(opts: Record<string, boolean>): Promise<string[]> {
  const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, { roads: true, ...opts });
  await store.init();
  const keys = new Set<string>();
  for (const dx of [-half, half]) for (const dy of [-half, half]) keys.add(store.cellAt(cx + dx, cy + dy));
  const cells: { cell: BuiltCell; rect: readonly number[] }[] = [];
  for (const k of keys) if (store.covers(k)) cells.push({ cell: buildCell(await store.cellInput(k, 0)), rect: store.cellRect(k) });
  const out: string[] = [];
  for (let y = cy + half; y >= cy - half; y -= res) for (let x = cx - half; x <= cx + half; x += res) {
    const c = cells.find(c => x >= c.rect[0] && x < c.rect[2] && y >= c.rect[1] && y < c.rect[3]);
    out.push((c && layersAt(c.cell, x, y).top) || '-');
  }
  return out;
}
const [after, before] = [await tops({}), await tops(off)];
const n = Math.round(2 * half / res) + 1, counts = new Map<string, { n: number; at: string[] }>();
for (let i = 0; i < after.length; i++) if (after[i] !== before[i]) {
  const dx = -half + (i % n) * res, dy = half - Math.floor(i / n) * res, k = `${before[i]}→${after[i]}`;
  const e = counts.get(k) ?? counts.set(k, { n: 0, at: [] }).get(k)!;
  e.n++; if (e.at.length < 12) e.at.push(`${dx},${dy}`);
}
for (const [k, e] of [...counts].sort((a, b) => b[1].n - a[1].n)) console.log(k, e.n, e.at.join(' '));
if (process.argv.includes('--tally')) { const t = (a: string[]) => { const m = new Map<string, number>(); for (const v of a) m.set(v, (m.get(v) ?? 0) + 1); return JSON.stringify(Object.fromEntries(m)); }; console.log('after', t(after)); console.log('before', t(before)); }
