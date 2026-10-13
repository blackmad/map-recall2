// Dump a way (local metres relative to a point), its bands, and the junction nodes it touches.
//
//   npx tsx scripts/own-ground/probe-way.ts <lng> <lat> <wayId>
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { prepareWays, resolvePriorSidewalks, junctionGeometry, type LocalWay } from '../../src/canalRecall/ownGround/streets.ts';

const ROOT = 'public/data/extracts/amsterdam';
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
await store.init();
const [lng, lat, id] = [Number(process.argv[2]), Number(process.argv[3]), Number(process.argv[4])];
const [x, y] = toLocal(lng, lat);
const input = await store.cellInput(store.cellAt(x, y), 0);
const seen = new Set<number>(), all: LocalWay[] = [];
for (const e of [input.osm, ...input.osmAround]) if (e) for (const w of prepareWays(e.ways, input.project)) if (!seen.has(w.id)) { seen.add(w.id); all.push(w); }
const ways = resolvePriorSidewalks(all);
const nodes = junctionGeometry(ways);
const w = ways.find(q => q.id === id)!;
console.log(JSON.stringify(w.tags), 'bands', w.section.bands.map(b => `${b.kind}:${b.surface}@${b.offset.toFixed(1)}w${b.width.toFixed(1)}`).join(' '));
console.log('points', w.points.map(p => `[${(p[0] - x).toFixed(1)},${(p[1] - y).toFixed(1)}]`).join(' '));
for (const p of w.points) for (const n of nodes.values()) if (Math.hypot(n.p[0] - p[0], n.p[1] - p[1]) < 0.2) console.log('node', `[${(n.p[0] - x).toFixed(1)},${(n.p[1] - y).toFixed(1)}]`, n.kind, 'arms', n.arms.map(a => `${a.way.id}/${a.way.tags.highway}/${a.way.tags.name ?? ''} trim ${a.trim.toFixed(1)} L${a.left.toFixed(1)} R${a.right.toFixed(1)}`));
