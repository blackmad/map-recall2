// Which measured decks the parapet runs (decks.ts parapetRuns) and the canal-mouth class (decks.ts canalMouth) touch,
// built as the near ring builds them. Lane marnix-bloemgracht-bridge 2026-10-16.
//
//   npx tsx scripts/own-ground/probe-parapet-runs.ts [--box=W,S,E,N] [--json=out.json]
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell } from '../../src/canalRecall/ownGround/groundCell.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const [W, S, E, N] = (flag('box') ?? '4.70,52.25,5.10,52.45').split(',').map(Number);
const store = new GroundStore(async path => {
  const file = join(ROOT, path);
  if (!existsSync(file)) throw new Error(`${path}: missing`);
  const bytes = readFileSync(file);
  return new Uint8Array(bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes);
});
await store.init();
const rows: { id: string; cell: string; lng: number; lat: number; kind: string; mouth: boolean; sides?: [[number, number], [number, number]]; span: [number, number] }[] = [];
let decks = 0;
for (const k of [...store.osmCells].filter(k => store.covers(k)).sort()) {
  const [x0, y0, x1, y1] = store.cellRect(k), [lng, lat] = fromLocal((x0 + x1) / 2, (y0 + y1) / 2);
  if (lng < W || lng > E || lat < S || lat > N) continue;
  await store.prepareCell(k);
  if (!store.decks(k).length) continue;
  const built = buildCell(await store.cellInput(k, 0));
  for (const d of built.stats.bridges.decks) {
    decks++;
    if (!d.mouth && !d.parapetSides) continue;
    const p = store.decks(k).find(q => q.profile.id === d.id)!.profile, m = p.x.length >> 1, ll = fromLocal(p.x[m], p.y[m]);
    rows.push({ id: d.id, cell: k, lng: ll[0], lat: ll[1], kind: d.kind, mouth: !!d.mouth, sides: d.parapetSides, span: p.deck });
  }
}
console.log(`measured decks built: ${decks}; parapet runs shortened: ${rows.filter(r => r.sides).length}; canal-mouth class: ${rows.filter(r => r.mouth).length}`);
for (const r of rows) {
  const cut = r.sides ? r.sides.map(([a, b]) => Math.max(0, a - r.span[0]) + Math.max(0, r.span[1] - b)) : [0, 0];
  console.log(`${r.id} ${r.kind}${r.mouth ? ' mouth' : ''} ${r.lng.toFixed(5)},${r.lat.toFixed(5)} span ${(r.span[1] - r.span[0]).toFixed(1)} m, parapet shortened L ${cut[0].toFixed(1)} R ${cut[1].toFixed(1)} m`);
}
if (flag('json')) writeFileSync(flag('json')!, JSON.stringify(rows, null, 1));
