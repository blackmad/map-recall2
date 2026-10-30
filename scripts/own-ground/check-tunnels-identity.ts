// Byte-identity of the tunnel cuts away from tunnels: builds cells with the cuts on and off (GroundStore `tunnels`)
// and compares every layer buffer and the mask. Cells without a cut in reach must match exactly; cells with one
// report how many bytes changed.
//
//   npx tsx scripts/own-ground/check-tunnels-identity.ts [lng,lat ...]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell } from '../../src/canalRecall/ownGround/groundCell.ts';

const ROOT = 'public/data/extracts/amsterdam';
const fetchBytes = async (p: string) => { const b = readFileSync(join(ROOT, p)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
const places = process.argv.slice(2).map(a => a.split(',').map(Number) as [number, number]);
if (!places.length) places.push([4.8835, 52.3700], [4.8920, 52.3600], [4.9000, 52.3730], [4.91165, 52.37250], [4.94032, 52.35678]);
const on = new GroundStore(fetchBytes), off = new GroundStore(fetchBytes, { tunnels: false });
await on.init(); await off.init();
let bad = 0;
const flat = (o: unknown, path: string, out: Map<string, ArrayLike<number>>) => {
  if (!o || typeof o !== 'object') return;
  if (ArrayBuffer.isView(o)) { out.set(path, o as unknown as ArrayLike<number>); return; }
  for (const [k, v] of Object.entries(o)) flat(v, `${path}.${k}`, out);
};
for (const [lng, lat] of places) {
  const [x, y] = toLocal(lng, lat), key = on.cellAt(x, y);
  await on.prepareCell(key); await off.prepareCell(key);
  const a = buildCell(await on.cellInput(key, 0)), b = buildCell(await off.cellInput(key, 0));
  const ma = new Map<string, ArrayLike<number>>(), mb = new Map<string, ArrayLike<number>>();
  flat(a, 'cell', ma); flat(b, 'cell', mb);
  const near = (await on.cellInput(key, 0)).cuts?.length ?? 0;
  let diff = 0; const keys = new Set([...ma.keys(), ...mb.keys()]), changed: string[] = [];
  for (const k of keys) {
    const p = ma.get(k), q = mb.get(k);
    let d = !p || !q || p.length !== q.length ? Math.max(p?.length ?? 0, q?.length ?? 0) : 0;
    if (!d) for (let i = 0; i < p!.length; i++) if (p![i] !== q![i] && !(Number.isNaN(p![i]) && Number.isNaN(q![i]))) d++;
    if (d) { diff += d; changed.push(k); }
  }
  console.log(`${key} (${lng},${lat}): ${near} cut(s) in reach, ${diff} value(s) differ${changed.length ? ` in ${changed.slice(0, 6).join(', ')}` : ''}`);
  if (!near && diff) { bad++; console.log('  FAIL: no cut in reach, yet the cell changed'); }
}
console.log(bad ? `${bad} cell(s) not identical` : 'identity holds');
process.exit(bad ? 1 : 0);
