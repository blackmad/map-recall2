// Every way deck the store places city-wide (wayDecks.ts): its water run, its deck span, the hole spans past the water
// (HOLE_M), and the rise of its deck between the approach ends. Lane bridge-decks-followups 2026-10-16.
//
//   node --import tsx scripts/own-ground/probe-way-decks.ts [--holes] [--json=out.json] [--cells=k,k]
//   … --why=id,id   why those OSM bridge ways got no deck (the last reason each was refused)
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { wayDeckWhy } from '../../src/canalRecall/ownGround/wayDecks.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
await store.init();
const keys = flag('cells')?.split(',') ?? [...store.osmCells].filter(k => store.covers(k)).sort();
const why = new Map<string, string[]>(), ids = new Set(flag('why')?.split(',').map(v => `OSM${v}`) ?? []);
wayDeckWhy.fn = (id, reason) => { if (ids.has(id)) (why.get(id) ?? why.set(id, []).get(id)!).push(reason); };
for (const k of keys) await store.prepareCell(k);
wayDeckWhy.fn = null;
for (const id of ids) console.log(`${id}: ${store.surface.decks.some(d => d.profile.id === id) ? 'has a deck' : (why.get(id) ?? ['never considered (outside the elevation cells or the cell pad)']).join('; ')}`);
const rows = store.surface.decks.filter(d => d.profile.family === 'way-deck').map(d => {
  const p = d.profile, m = p.x.length >> 1, [lng, lat] = fromLocal(p.x[m], p.y[m]);
  return { id: p.id, name: p.name, lng: +lng.toFixed(5), lat: +lat.toFixed(5), water: p.water!.map(v => +v.toFixed(1)), deck: p.deck.map(v => +v.toFixed(1)), under: p.under?.map(r => r.map(v => +v.toFixed(1))), ends: d.ends.map(v => +v.toFixed(2)), half: +p.halfWidth[0].toFixed(1) };
});
const holes = rows.filter(r => r.under);
console.log(`way decks ${rows.length}; with a hole past the water ${holes.length}`);
for (const r of process.argv.includes('--holes') ? holes : rows) console.log(`${r.id} "${r.name}" ${r.lng},${r.lat} half ${r.half} water ${r.water} deck ${r.deck}${r.under ? ` hole ${JSON.stringify(r.under)}` : ''} ends ${r.ends}`);
if (flag('json')) writeFileSync(flag('json')!, JSON.stringify(rows, null, 1));
