/**
 * Cut a run face out of an intaken face (members' facts, uses, discovery, the strip cropped to the run) for hand
 * authoring: the same directory auto-place writes for a placed run.
 *   node --import tsx scripts/block-face/run-face.ts --face=<parent> --run=<run id> --pands=<pand6>,<pand6>,...
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {writeRunFace} from './auto-place.ts';
import {FACES} from './intake.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const parent = arg('face')!, run = arg('run')!, want = arg('pands')!.split(',');
const read = async (n: string) => JSON.parse(await fs.readFile(path.join(FACES, parent, `${n}.json`), 'utf8'));
const [strip, uses, discovery] = await Promise.all(['strip', 'uses', 'discovery'].map(read));
const ids: string[] = discovery.members.filter((m: string) => want.some(w => m.endsWith(w)));
if (ids.length !== want.length) throw Error(`pands not on ${parent}: ${want.filter(w => !ids.some(m => m.endsWith(w))).join(', ')}`);
await writeRunFace(parent, run, ids, strip, uses, discovery);
console.log(`${run}: ${ids.length} pands of ${parent}`);
