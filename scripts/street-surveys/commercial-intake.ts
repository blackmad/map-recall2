/**
 * Commercial-street survey, phase C: run block-face intake for every proposed face of a street index (see
 * commercial-faces.ts). A face whose seed was already discovered as a member of an earlier face is recorded as
 * `mergedInto` instead (discover.ts also counts pands without a BAG address on the street, so it can bridge proposals).
 *
 *   node --import tsx scripts/street-surveys/commercial-intake.ts --street=Kinkerstraat [--only=kinker-1-29,...] [--no-strip]
 */
import fs from 'node:fs/promises';
import {intake} from '../block-face/intake.ts';
import {streetFile} from './street-style.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const street = arg('street') ?? 'Kinkerstraat', only = arg('only')?.split(',');
const file = streetFile(street);
const doc = JSON.parse(await fs.readFile(file, 'utf8'));
const covered = new Map<string, string>();
for (const f of doc.faces) {
  if (only && !only.includes(f.id)) continue;
  const prior = covered.get(f.seed);
  if (prior) { f.mergedInto = prior; console.log(`${f.id}: seed ${f.seed.slice(-6)} already in ${prior}`); continue; }
  try {
    const {found} = await intake({face: f.id, street, seed: f.seed, strip: !process.argv.includes('--no-strip')});
    f.discovered = found.pands.map(p => p.pandId);
    delete f.intakeError;
    for (const id of f.discovered) covered.set(id, f.id);
  } catch (e) { f.intakeError = (e as Error).message.slice(0, 200); console.log(`${f.id}: INTAKE FAILED ${f.intakeError}`); }
  await fs.writeFile(file, JSON.stringify(doc, null, 1) + '\n');
}
await fs.writeFile(file, JSON.stringify(doc, null, 1) + '\n');
