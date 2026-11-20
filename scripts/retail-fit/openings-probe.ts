// Lane retail-fit: list the ground openings found on a model's glass (openings.ts), grouped by facing.
//   npx tsx scripts/retail-fit/openings-probe.ts <model-id|glb path>... [--anchor=lng,lat] (a surveyed model, north offset 0: also prints each opening's lng/lat)
import fs from 'node:fs';
import { loadGlb } from '../../src/canalRecall/glbRaster/load.ts';
import { glassOpenings } from '../../src/canalRecall/retailFit/openings.ts';
const anchor = process.argv.find(a => a.startsWith('--anchor='))?.slice(9).split(',').map(Number);
const R = 6371008.8, K = Math.PI / 180;
const lngLat = (x: number, z: number) => anchor ? `${(anchor[0] + x / (K * R * Math.cos(anchor[1] * K))).toFixed(7)},${(anchor[1] - z / (K * R)).toFixed(7)}` : '';
for (const id of process.argv.slice(2).filter(a => !a.startsWith('--'))) {
  const file = id.endsWith('.glb') ? id : `public/canal-drive/models/${id}.glb`;
  const g = await loadGlb(new Uint8Array(fs.readFileSync(file)));
  const slots = new Set(g.materials.map(m => `${m.name}:${m.extras?.materialSlot ?? ''}`));
  const glass = g.primitives.filter(p => { const m = g.materials[p.material]; return m.extras?.materialSlot === 'glass' || /glass|glaz|window/i.test(m.name ?? ''); });
  let sx = 0, sz = 0, n = 0; for (const p of g.primitives) for (let i = 0; i < p.positions.length; i += 3) { sx += p.positions[i]; sz += p.positions[i + 2]; n++; }
  const ops = glassOpenings(glass.map(p => ({ positions: p.positions, indices: p.indices })), [sx / n, sz / n]);
  const by = new Map<number, typeof ops>();
  for (const o of ops) { const k = Math.round(o.bearing / 5) * 5; by.set(k, [...(by.get(k) ?? []), o]); }
  console.log(`${id}: ${glass.length} glass prims, ${ops.length} openings; materials ${[...slots].slice(0, 12).join(' ')}`);
  for (const [b, l] of [...by].sort((p, q) => p[0] - q[0])) console.log(`  ${b}°  ${l.length}: ${l.map(o => `${o.head[0]}${o.widthM.toFixed(1)}x${o.crownM.toFixed(1)}@${o.sillM.toFixed(1)}${anchor ? `[${lngLat(o.base[0], o.base[2])}]` : ''}`).join(' ')}`);
}
