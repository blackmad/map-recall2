// A character map of the topmost drawn ground layer around a point (lane fb-bridges-20261119): reads a deck's two-tone
// top, a water notch at an abutment or a slit in a deck without a browser. One character per `res` metres, north up.
//
//   node --import tsx scripts/own-ground/probe-top-map.ts <lng,lat> [--half=30] [--res=1] [--z] [--opt=name=false,...]
//   --hits=dx,dy;... lists the layers under offsets (east, north metres) and stops unless --map.
//   --z prints the top surface's height (decimetres over the lowest, mod 36 as 0-9a-z) instead of the layer.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, layersAt, type BuiltCell, type GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const opts: Record<string, boolean> = { roads: true };
for (const kv of (flag('opt') ?? '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); opts[k] = v !== 'false'; }
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, opts);
await store.init();
const [lng, lat] = process.argv[2].split(',').map(Number), [cx, cy] = toLocal(lng, lat);
const half = Number(flag('half') ?? 30), res = Number(flag('res') ?? 1), showZ = process.argv.includes('--z');
const keys = new Set<string>();
for (const dx of [-half, half]) for (const dy of [-half, half]) keys.add(store.cellAt(cx + dx, cy + dy));
const cells: { key: string; cell: BuiltCell; rect: readonly number[] }[] = [];
for (const k of keys) if (store.covers(k)) cells.push({ key: k, cell: buildCell(await store.cellInput(k, 0)), rect: store.cellRect(k) });
// --hits=dx,dy;dx,dy: every layer under those offsets (metres east, north of the point), topmost first.
for (const spec of (flag('hits') ?? '').split(';').filter(Boolean)) {
  const [dx, dy] = spec.split(',').map(Number), x = cx + dx, y = cy + dy;
  const c = cells.find(c => x >= c.rect[0] && x < c.rect[2] && y >= c.rect[1] && y < c.rect[3]);
  console.log(`hits ${dx},${dy}`, c ? JSON.stringify(layersAt(c.cell, x, y)) : 'no cell');
}
if (flag('hits') && !process.argv.includes('--map')) process.exit(0);
const CH: Partial<Record<GroundLayer, string>> = { land: '.', water: '~', quay: 'Q', deckTop: 'D', deckBody: 'B', asphalt: 'A', klinker: 'K', brick: 'b', cycle: 'c', paving: 'p', gravel: 'g', kerb: 'k', paint: '=', tram: 't', bollard: 'o', park: ',', lawn: ',', square: 's', parking: 'P', track: 'T', ballast: 'l' };
const rows: string[] = [];
const zs: number[][] = [];
for (let y = cy + half; y >= cy - half; y -= res) {
  let row = '';
  const zr: number[] = [];
  for (let x = cx - half; x <= cx + half; x += res) {
    const c = cells.find(c => x >= c.rect[0] && x < c.rect[2] && y >= c.rect[1] && y < c.rect[3]);
    const h = c ? layersAt(c.cell, x, y) : null;
    const topHit = h?.hits.find(t => !t.cut && t.layer !== 'water');
    const tag = Math.abs(x - cx) < res / 2 && Math.abs(y - cy) < res / 2 ? '@' : null;
    row += tag ?? (h?.top ? (CH[h.top] ?? '?') : ' ');
    zr.push(topHit ? topHit.z : NaN);
  }
  rows.push(row); zs.push(zr);
}
if (showZ) {
  const lo = Math.min(...zs.flat().filter(Number.isFinite));
  console.log(`z base ${lo.toFixed(2)} m, one char per 0.1 m (0-9a-z, mod 3.6 m)`);
  for (const zr of zs) console.log(zr.map(z => (Number.isFinite(z) ? Math.round((z - lo) * 10) % 36 : -1)).map(v => (v < 0 ? ' ' : v.toString(36))).join(''));
} else {
  console.log(`cells ${[...keys].join(' ')}; ${res} m per char, north up; ${Object.entries(CH).map(([k, v]) => `${v}=${k}`).join(' ')}`);
  for (const r of rows) console.log(r);
}
