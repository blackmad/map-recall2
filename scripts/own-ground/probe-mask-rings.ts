// Which water-mask deck rings and road polygons cover points near a spot (lane fb-bridges-20261119, the Torensluis
// slit c16d3403): a strip the mask cuts between two deck rings shows the canal through a plein.
//
//   node --import tsx scripts/own-ground/probe-mask-rings.ts <lng,lat> 'dx,dy;dx,dy' [--opt=name=false,...]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { decodeRoadLine } from '../../src/canalRecall/ownGround/roadCells.ts';
import type { Vec2 } from '../../src/canalRecall/ownGround/surface.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const opts: Record<string, boolean> = { roads: true };
for (const kv of (flag('opt') ?? '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); opts[k] = v !== 'false'; }
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, opts);
await store.init();
const [lng, lat] = process.argv[2].split(',').map(Number), [cx, cy] = toLocal(lng, lat);
const key = store.cellAt(cx, cy);
await store.prepareCell(key);
const input = await store.cellInput(key, 0);
const inRing = (r: readonly Vec2[], x: number, y: number) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const wet = new Set(input.wetGround ?? []);
const kind = (r: readonly Vec2[], i: number) => (wet.has(r as Vec2[]) ? 'wetGround' : `deckRing#${i}`);
for (const spec of process.argv[3].split(';')) {
  const [dx, dy] = spec.split(',').map(Number), x = cx + dx, y = cy + dy;
  const rings = input.deckRingsAround.map((r, i) => (inRing(r, x, y) ? kind(r, i) : null)).filter(Boolean);
  const polys = (input.roads?.surfaces ?? []).map((s, i) => ({ s, i })).filter(({ s }) => s.r.length && inRing(decodeRoadLine(s.r[0]), x, y)).map(({ s, i }) => `road#${i} h${s.h} c=${s.c}${wet.has(decodeRoadLine(s.r[0])) ? '' : ''}`);
  console.log(`${dx},${dy}`, 'rings', JSON.stringify(rings), 'roads', JSON.stringify(polys), 'ground', store.surface.ground(x, y).toFixed(2));
}
