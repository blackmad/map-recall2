// Which survey polygons (roads-v1) cover each sample around a point, with the water and wet-ground/deck rings
// (lane fb-ground2-20261120): reads a hole between polygons (a ' ' with '~' under it) without a browser.
//   node --import tsx scripts/own-ground/probe-polys.ts <lng,lat> [--half=8] [--res=0.5]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { RoadIndex } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
import { pointInRing } from '../../src/canalRecall/ownGround/decks.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, { roads: true });
await store.init();
const [lng, lat] = process.argv[2].split(',').map(Number), [cx, cy] = toLocal(lng, lat);
const half = Number(flag('half') ?? 8), res = Number(flag('res') ?? 0.5);
const key = store.cellAt(cx, cy);
const input = await store.cellInput(key, 0);
const index = new RoadIndex([input.roads ?? null, ...(input.roadsAround ?? [])]);
const wet = (x: number, y: number) => input.waterAround.some(g => g.polygons.some(p => pointInRing(p[0], x, y) && !p.slice(1).some(h => pointInRing(h, x, y))));
const ids = new Map<number, string>();
const sym = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
for (let y = cy + half; y >= cy - half; y -= res) {
  let row = '', row2 = '';
  for (let x = cx - half; x <= cx + half; x += res) {
    const all = index.findAll(x, y);
    const k = all.length ? all[0] : -1;
    if (k >= 0 && !ids.has(k)) ids.set(k, sym[ids.size % sym.length]);
    const inWetRing = (input.wetGround ?? []).some(r => pointInRing(r, x, y)), inDeck = input.deckRingsAround.some(r => pointInRing(r, x, y));
    row += Math.abs(x - cx) < res / 2 && Math.abs(y - cy) < res / 2 ? '@' : k >= 0 ? ids.get(k)! : ' ';
    row2 += wet(x, y) ? (inWetRing ? 'w' : inDeck ? 'd' : '~') : '.';
  }
  console.log(row + '   ' + row2 + '   ' + (input.surface.ground(cx, y) - 0).toFixed(2));
}
for (const [k, s] of ids) { const r = index.records[k] as { h: number; c: string; k: string }; console.log(s, k, `h=${r.h} c=${index.drawClass(k)} k=${index.mesh(k)}`); }
