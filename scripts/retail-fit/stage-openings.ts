// Lane retail-fit: measure a model's ground openings once, from its GLB, and stage them in retail-fits.json, so the game
// and node frames draw fits without searching for glass (a city-look material swap or a merged street chunk hides the
// glass material at run time). For a street chunk each opening records its pand (the GLB's pandRanges) so the fit lifts
// with that pand. Openings are in the GLB's own frame (metres), rounded to 0.1 mm.
//   npx tsx scripts/retail-fit/stage-openings.ts --model=<id> [--glb=<path>] [--slot=glass] [--material=<name>,...]
//     [--maxSill=<m>] [--maxTop=<m>] (a host whose shop glass sits on a high plinth: Magna Plaza 2.9 / 7.5) [--dry]
import fs from 'node:fs';
import { loadGlb } from '../../src/canalRecall/glbRaster/load.ts';
import { glassOpenings, OPENING_FIND } from '../../src/canalRecall/retailFit/openings.ts';
import type { StoredOpening } from '../../src/canalRecall/retailFit/photoRead.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const model = arg('model')!;
const file = arg('glb') ?? `public/canal-drive/models/${model}.glb`;
const slot = arg('slot') ?? 'glass', names = arg('material')?.split(',');
const STAGED = 'src/canalRecall/retailFit/retail-fits.json';

const g = await loadGlb(new Uint8Array(fs.readFileSync(file)));
const glass = g.primitives.filter(p => { const m = g.materials[p.material]; return names ? names.includes(m.name) : m.extras?.materialSlot === slot; });
let sx = 0, sz = 0, n = 0;
for (const p of g.primitives) for (let i = 0; i < p.positions.length; i += 3) { sx += p.positions[i]; sz += p.positions[i + 2]; n++; }
const find = { ...OPENING_FIND, ...(arg('maxSill') ? { maxSillM: Number(arg('maxSill')) } : {}), ...(arg('maxTop') ? { maxTopM: Number(arg('maxTop')) } : {}) };
const ops = glassOpenings(glass.map(p => ({ positions: p.positions, indices: p.indices })), [sx / n, sz / n], find);

/** The pand of the glass triangle whose centroid is nearest the opening's centre (street chunks only). */
function pandOf(o: (typeof ops)[number]): number | undefined {
  let best: number | undefined, bd = 1.5;
  const cy = o.sillM + (o.crownM - o.sillM) / 2;
  for (const p of glass) {
    const ranges = (p as { extras?: { pandRanges?: [number, number, number][] } }).extras?.pandRanges;
    if (!ranges) continue;
    const P = p.positions, I = p.indices ?? Uint32Array.from({ length: P.length / 3 }, (_, i) => i);
    for (const [pand, first, count] of ranges) for (let t = first; t < first + count; t++) {
      let x = 0, y = 0, z = 0;
      for (let k = 0; k < 3; k++) { const v = I[t * 3 + k]; x += P[v * 3] / 3; y += P[v * 3 + 1] / 3; z += P[v * 3 + 2] / 3; }
      const d = Math.hypot(x - o.base[0], (y - cy) * 0.3, z - o.base[2]);
      if (d < bd) { bd = d; best = pand; }
    }
  }
  return best;
}
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
const stored: StoredOpening[] = ops.map(o => {
  const pand = pandOf(o);
  return { ...o, base: o.base.map(r4) as typeof o.base, n: o.n.map(r4) as typeof o.n, t: o.t.map(r4) as typeof o.t, widthM: r4(o.widthM), sillM: r4(o.sillM), springM: r4(o.springM), crownM: r4(o.crownM), bearing: r4(o.bearing), areaM2: r4(o.areaM2), ...(pand !== undefined ? { pand } : {}) };
});
const withPand = stored.filter(o => o.pand !== undefined).length;
console.log(`${model}: ${glass.length} glass primitives, ${stored.length} openings${withPand ? `, ${withPand} with a pand` : ''}`);
if (!process.argv.includes('--dry')) {
  const d = JSON.parse(fs.readFileSync(STAGED, 'utf8'));
  d.models[model] ??= { status: 'staged', review: 'openings staged; no reads yet', fits: [] };
  d.models[model].openings = stored;
  fs.writeFileSync(STAGED, JSON.stringify(d, null, 1) + '\n');
}
