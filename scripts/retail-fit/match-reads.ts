// Lane retail-fit: how many of a model's hand reads land in an opening (fits.ts: the nearest free opening within 2.5 m,
// in read order), for the staged openings and for openings found afresh on a GLB's glass.
//   npx tsx scripts/retail-fit/match-reads.ts --model=<id> [--glb=<path>] [--maxSill=<m>] [--maxTop=<m>]
import fs from 'node:fs';
import { loadGlb } from '../../src/canalRecall/glbRaster/load.ts';
import { glassOpenings, OPENING_FIND, openingAt } from '../../src/canalRecall/retailFit/openings.ts';
import { surveyedNative } from '../../src/canalRecall/retailFit/overlay.ts';
import type { HostOpening } from '../../src/canalRecall/retailFit/types.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const model = arg('model')!, file = arg('glb') ?? `public/canal-drive/models/${model}.glb`;
const lm = JSON.parse(fs.readFileSync('public/canal-drive/models/signature-landmarks.json', 'utf8')).models[model];
const toNative = surveyedNative(lm.surveyed.anchor);
const staged = JSON.parse(fs.readFileSync('src/canalRecall/retailFit/retail-fits.json', 'utf8')).models[model];
const g = await loadGlb(new Uint8Array(fs.readFileSync(file)));
const glass = g.primitives.filter(p => g.materials[p.material].extras?.materialSlot === 'glass');
let sx = 0, sz = 0, n = 0;
for (const p of g.primitives) for (let i = 0; i < p.positions.length; i += 3) { sx += p.positions[i]; sz += p.positions[i + 2]; n++; }
const find = { ...OPENING_FIND, ...(arg('maxSill') ? { maxSillM: Number(arg('maxSill')) } : {}), ...(arg('maxTop') ? { maxTopM: Number(arg('maxTop')) } : {}) };
const fresh = glassOpenings(glass.map(p => ({ positions: p.positions, indices: p.indices })), [sx / n, sz / n], find);
function match(ops: readonly HostOpening[]) {
  const taken = new Set<string>(); const rows: string[] = [];
  for (const f of staged.fits) {
    const free = ops.filter(o => !taken.has(o.id)), [x, z] = toNative(f.at[0], f.at[1]), op = openingAt(free, x, z, 2.5);
    if (op) taken.add(op.id);
    const near = openingAt(ops, x, z, 50);
    rows.push(`${op ? 'hit ' : 'miss'} ${f.tenant.padEnd(34)} ${op ? `${op.id} sill ${op.sillM.toFixed(2)} crown ${op.crownM.toFixed(2)} w ${op.widthM.toFixed(2)}` : near ? `nearest ${Math.hypot(x - near.base[0], z - near.base[2]).toFixed(1)} m` : ''}`);
  }
  return { hits: taken.size, rows };
}
const before = match(staged.openings ?? []), after = match(fresh);
console.log(`${model}: ${staged.fits.length} reads; staged openings ${staged.openings?.length ?? 0} -> ${before.hits} hits; fresh (${glass.length} glass prims, sill<=${find.maxSillM}, top<=${find.maxTopM}) ${fresh.length} openings -> ${after.hits} hits`);
const sills = fresh.map(o => `${o.sillM.toFixed(2)}/${o.crownM.toFixed(2)}`); console.log('fresh sill/crown:', [...new Set(sills)].join(' '));
for (const r of after.rows) console.log(r);
