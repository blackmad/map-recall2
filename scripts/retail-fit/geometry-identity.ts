// Lane retail-fit: two GLBs carry the same geometry (a material retag): the sorted multiset of triangles (positions at
// 1e-5 m) matches, and per material the triangle counts, before vs after.
//   npx tsx scripts/retail-fit/geometry-identity.ts <before.glb> <after.glb>
import fs from 'node:fs';
import crypto from 'node:crypto';
import { loadGlb } from '../../src/canalRecall/glbRaster/load.ts';
async function tris(f: string) {
  const g = await loadGlb(new Uint8Array(fs.readFileSync(f)));
  const all: string[] = [], per = new Map<string, number>();
  for (const p of g.primitives) {
    const P = p.positions, I = p.indices ?? Uint32Array.from({ length: P.length / 3 }, (_, i) => i), name = g.materials[p.material].name;
    for (let t = 0; t < I.length; t += 3) {
      const v = [0, 1, 2].map(k => [0, 1, 2].map(c => P[I[t + k] * 3 + c].toFixed(5)).join(','));
      const r = v.indexOf([...v].sort()[0]); all.push([v[r], v[(r + 1) % 3], v[(r + 2) % 3]].join(';'));
      per.set(name, (per.get(name) ?? 0) + 1);
    }
  }
  all.sort();
  return { n: all.length, hash: crypto.createHash('sha256').update(all.join('\n')).digest('hex').slice(0, 16), per };
}
const [a, b] = await Promise.all(process.argv.slice(2, 4).map(tris));
console.log(`before ${a.n} tris ${a.hash}; after ${b.n} tris ${b.hash}; geometry ${a.hash === b.hash ? 'IDENTICAL' : 'DIFFERS'}`);
for (const k of new Set([...a.per.keys(), ...b.per.keys()])) if (a.per.get(k) !== b.per.get(k)) console.log(`  ${k}: ${a.per.get(k) ?? 0} -> ${b.per.get(k) ?? 0}`);
