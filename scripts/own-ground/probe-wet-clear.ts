// Lane F1b (2026-11-14, Torensluis #45 c16d3403): what lowering wetGround.ts WET_CLEAR_M would change city-wide. Per
// threshold, the BGT ground polygons that stand over mapped water as a deck (wetGroundRings), their count and area,
// and those a lower threshold adds (with a point to look at).
//
//   node --import tsx scripts/own-ground/probe-wet-clear.ts [--clear=2,1.8,1.6,1.5] [--cells=k,k] [--at=lng,lat]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, fromLocal, toLocal, WATER_Z } from '../../src/canalRecall/ownGround/groundStore.ts';
import { wetGroundRings } from '../../src/canalRecall/ownGround/wetGround.ts';
import { waterZAt } from '../../src/canalRecall/ownGround/water.ts';
import type { Vec2 } from '../../src/canalRecall/ownGround/surface.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const clears = (flag('clear') ?? '2,1.8,1.6,1.5').split(',').map(Number);
const st = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, { roads: true });
await st.init();
let keys = flag('cells')?.split(',') ?? [...st.osmCells].filter(k => st.covers(k)).sort();
if (flag('at')) { const [lng, lat] = flag('at')!.split(',').map(Number), [x, y] = toLocal(lng, lat); keys = [st.cellAt(x, y)]; }
const inRing = (r: readonly Vec2[], x: number, y: number) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const area = (r: readonly Vec2[]) => Math.abs(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const totals = clears.map(() => ({ rings: 0, m2: 0 })), added: string[] = [];
let n = 0;
for (const key of keys) {
  await st.prepareCell(key);
  const input = await st.cellInput(key, 0);
  if (!input.roads?.surfaces.length) continue;
  const geos = [input.water, ...input.waterAround].filter(g => !!g) as NonNullable<typeof input.water>[], polys = geos.flatMap(g => g.polygons);
  if (!polys.length) continue;
  let box: [number, number, number, number] | null = null;
  for (const poly of polys) for (const [x, y] of poly[0] ?? []) box = box ? [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)] : [x, y, x, y];
  const wet = (x: number, y: number) => polys.some(poly => inRing(poly[0], x, y) && !poly.slice(1).some(h => inRing(h, x, y)));
  const per = clears.map(c => wetGroundRings(input.roads!.surfaces, { wet, ground: (x, y) => st.surface.ground(x, y), waterZ: (x, y) => waterZAt(geos, x, y, WATER_Z), waterBox: box, clearM: c }));
  per.forEach((rings, i) => { totals[i].rings += rings.length; totals[i].m2 += rings.reduce((a, r) => a + area(r), 0); });
  const base = new Set(per[0].map(r => JSON.stringify(r[0])));
  per.forEach((rings, i) => { if (i) for (const r of rings) if (!base.has(JSON.stringify(r[0]))) { const c = r.reduce((a, p) => [a[0] + p[0] / r.length, a[1] + p[1] / r.length], [0, 0]); const [lng, lat] = fromLocal(c[0], c[1]); added.push(`clear ${clears[i]}: ${key} ${lng.toFixed(5)},${lat.toFixed(5)} ${area(r).toFixed(0)} m2`); } });
  if (++n % 25 === 0) console.error(`${n} cells`);
}
const uniq = [...new Set(added)];
for (const a of uniq) console.log(a);
console.log(JSON.stringify({ cells: n, totals: clears.map((c, i) => ({ clear: c, rings: totals[i].rings, m2: Math.round(totals[i].m2) })) }));
