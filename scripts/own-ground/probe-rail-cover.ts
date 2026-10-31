// What a camera straight above sees on the railway beds (rail-v1, issue #145): per spot, sample every rail way's bed
// (the centreline and both top edges) in the streamed cells and count the top layer. A bed buried by the land or a
// polygon drawn over it shows as a top that is not `ballast` / `track`.
//
//   npx tsx scripts/own-ground/probe-rail-cover.ts [lng,lat ...]   (default: the three issue #145 spots)
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, layersAt, type BuiltCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { RAIL_SECTION } from '../../src/canalRecall/ownGround/railTracks.ts';

const ROOT = 'public/data/extracts/amsterdam';
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, { roads: true });
await store.init();
const SPOTS = process.argv.length > 2 ? process.argv.slice(2) : ['4.919002,52.376640', '4.931068,52.374300', '4.903754,52.376897'];
for (const arg of SPOTS) {
  const [lng, lat] = arg.split(',').map(Number), [x, y] = toLocal(lng, lat);
  const cells = new Map<string, BuiltCell>();
  const keys = GroundStore.neighbours(store.cellAt(x, y)).filter(k => store.covers(k));
  for (const k of keys) cells.set(k, buildCell(await store.cellInput(k, 0)));
  const tops: Record<string, number> = {}, under: Record<string, number[]> = {};
  let n = 0;
  for (const k of keys) {
    const input = await store.cellInput(k, 0);
    for (const w of input.rails ?? []) {
      if (w.bridge) continue;
      for (let i = 0; i + 1 < w.points.length; i++) {
        const [ax, ay] = w.points[i], [bx, by] = w.points[i + 1], len = Math.hypot(bx - ax, by - ay);
        if (!len) continue;
        const nx = -(by - ay) / len, ny = (bx - ax) / len;
        for (let s = 1; s < len; s += 2) for (const off of [0, RAIL_SECTION.topHalf - 0.2, -(RAIL_SECTION.topHalf - 0.2)]) {
          const px = ax + (bx - ax) * s / len + nx * off, py = ay + (by - ay) * s / len + ny * off;
          if (Math.hypot(px - x, py - y) > 250) continue;
          const c = [...cells.values()].find(c => true && layersAt(c, px, py).top);
          const hits = [...cells.values()].flatMap(c => layersAt(c, px, py).hits).sort((p, q) => q.z - p.z);
          if (!hits.length) continue;
          n++;
          const top = hits[0].layer;
          tops[top] = (tops[top] ?? 0) + 1;
          const bed = hits.find(h => h.layer === 'ballast');
          if (top !== 'ballast' && top !== 'track' && bed) (under[top] ??= []).push(hits[0].z - bed.z);
          void c;
        }
      }
    }
  }
  const pct = Object.fromEntries(Object.entries(tops).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, `${(100 * v / n).toFixed(1)}%`]));
  const over = Object.fromEntries(Object.entries(under).map(([k, v]) => { v.sort((a, b) => a - b); return [k, { n: v.length, medianAboveBed: +v[v.length >> 1].toFixed(2), max: +v[v.length - 1].toFixed(2) }]; }));
  console.log(arg, `samples ${n}`, JSON.stringify(pct), 'over the bed:', JSON.stringify(over));
}
