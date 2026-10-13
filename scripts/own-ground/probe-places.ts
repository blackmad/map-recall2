// What the own-ground cell data holds at a place: OSM ways (name, class, bridge, BGT width), areas, measured/flat decks, water level, relief.
//   npx tsx scripts/own-ground/probe-places.ts find <street name>...     # centroids of ways with that name
//   npx tsx scripts/own-ground/probe-places.ts at <lng,lat> [radiusM=40]
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';

const ROOT = 'public/data/extracts/amsterdam';
const store = new GroundStore(async path => { const f = join(ROOT, path); if (!existsSync(f)) throw new Error(path); const b = readFileSync(f); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
await store.init();
const [mode, ...rest] = process.argv.slice(2);
if (mode === 'find') {
  for (const k of store.osmCells) {
    const osm = await store.osmCell(k);
    for (const w of osm?.ways ?? []) if (rest.some(r => w.tags.name === r)) {
      const m = w.g[Math.floor(w.g.length / 2)];
      console.log(`${w.tags.name}\t${w.id}\t${w.tags.highway}\tbridge=${w.tags.bridge ?? ''}\t${m[0].toFixed(5)},${m[1].toFixed(5)}`);
    }
  }
}
if (mode === 'at') {
  const [lng, lat] = rest[0].split(',').map(Number), r = Number(rest[1] ?? 40);
  const [x, y] = toLocal(lng, lat), key = store.cellAt(x, y);
  for (const k of (await import('../../src/canalRecall/ownGround/groundStore.ts')).GroundStore.neighbours(key)) await store.prepareCell(k).catch(() => {});
  console.log(`cell ${key}, relief at point ${store.surface.height(x, y).toFixed(2)} m, water ${store.waterZ(x, y).toFixed(2)}`);
  const near = (g: [number, number][]) => g.some(p => { const [px, py] = toLocal(p[0], p[1]); return Math.hypot(px - x, py - y) < r; });
  for (const k of (await import('../../src/canalRecall/ownGround/groundStore.ts')).GroundStore.neighbours(key)) {
    const osm = await store.osmCell(k);
    for (const w of osm?.ways ?? []) if (near(w.g)) console.log(`way ${w.id} ${w.tags.highway} "${w.tags.name ?? ''}" bridge=${w.tags.bridge ?? ''} layer=${w.tags.layer ?? ''} width=${w.tags.width ?? ''} bw=${JSON.stringify((w as any).bw ?? null)} cycleway=${w.tags.cycleway ?? w.tags['cycleway:both'] ?? ''} sidewalk=${w.tags.sidewalk ?? ''}`);
    for (const a of osm?.areas ?? []) if (a.rings.some(near)) console.log(`area ${a.id} ${a.kind} ${a.name ?? ''}`);
    for (const d of store.decks(k)) { const p = d.profile; const i = Math.floor(p.x.length / 2); if (Math.hypot(p.x[i] - x, p.y[i] - y) < r * 2) console.log(`deck ${p.id} ${p.name} ${p.family} ends ${d.ends.map(v => v.toFixed(2))} cell ${k}`); }
  }
}
