/** Prints what the Tropenmuseum builder drew and what failed to cut: `node --import tsx scripts/landmarks/tropenmuseum-stats.ts`. */
import * as T from 'three';
import {compileTropenmuseum} from './tropenmuseum-builder';
const {built, stats} = compileTropenmuseum();
console.log(`openings drawn by hand ${stats.openings}; failed ${stats.failed.length}`);
for (const f of stats.failed) console.log('  FAILED', f);
for (const d of stats.drawn) console.log('  drawn', d);
console.log(`kit: ${JSON.stringify(built.stats)}`);
console.log(`block gates: ${JSON.stringify(built.blockGates).slice(0, 600)}`);
const per = new Map<string, number>();
let total = 0;
built.group.traverse(o => {
  if (!(o instanceof T.Mesh)) return;
  const g = o.geometry as T.BufferGeometry, n = (g.index ? g.index.count : g.getAttribute('position').count) / 3, key = `${o.userData.materialSlot}:${o.name}`;
  total += n; per.set(key, (per.get(key) ?? 0) + n);
});
console.log('triangles (kit + hand)', total, [...per].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k} ${v}`).join(' | '));
