/**
 * Facts for many Pand ids on one street, with per-house timing.
 *   node --import tsx scripts/building-recipes/batch-facts.ts --street=Bilderdijkstraat --prefix=bilder --pands=0363100012066694,...
 * House id = <prefix>-<last six numerals of the Pand id>.
 */
import {prepareFacts} from './facts.ts';

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const street = arg('street')!, prefix = arg('prefix')!, pands = (arg('pands') ?? '').split(',').filter(Boolean).map(p => p.length === 6 ? `0363100012${p}` : p);
if (!street || !prefix || !pands.length) throw Error('Use --street --prefix --pands');
const t0 = performance.now();
for (const pand of pands) {
  const id = `${prefix}-${pand.slice(-6)}`, t = performance.now();
  try {
    const {facts} = await prepareFacts(id, {pand, streets: [street], photo: false});
    const f = facts.fronts[0];
    console.log(JSON.stringify({id, seconds: +((performance.now() - t) / 1000).toFixed(2), widthM: +f.widthM.toFixed(2), eavesM: +f.eavesM.toFixed(2), topM: +f.topM.toFixed(2), uncertainty: f.uncertainty}));
  } catch (e) { console.log(JSON.stringify({id, error: String((e as Error).message).slice(0, 200)})); }
}
console.log(JSON.stringify({totalSeconds: +((performance.now() - t0) / 1000).toFixed(1), houses: pands.length}));
