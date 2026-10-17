/**
 * Print the visible coplanar / tight z-fight patches of one GLB (geometryAudit.ts `auditZFight`), largest first, including the
 * near band with --near. The survey (zfight-survey.ts) ranks models; this lists where inside one model the fights are.
 *
 *   node --import tsx scripts/landmarks/zfight-patches.ts --id=magna-plaza [--file=x.glb] [--near] [--top=30]
 */
import path from 'node:path';
import {auditZFight} from '../../src/canalRecall/landmarks/geometryAudit';
import {loadMaterialSoup} from './material-soup';

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const file = arg('file') ?? path.resolve(import.meta.dirname, `../../public/canal-drive/models/${arg('id')}.glb`);
const top = Number(arg('top') ?? 30), near = process.argv.includes('--near');
const z = auditZFight(await loadMaterialSoup(file));
const f = (v: number[]) => v.map(x => x.toFixed(1)).join(',');
console.log(`${path.basename(file)}: coplanar ${z.area.toFixed(2)} m2, tight ${z.tightArea.toFixed(2)} m2, near ${z.nearArea.toFixed(2)} m2`);
for (const p of z.patches.filter(p => !p.hidden && !p.sameMaterial && (near || !p.near || p.tight)).slice(0, top))
  console.log(`${p.area.toFixed(2).padStart(7)} m2 ${p.near ? (p.tight ? 'tight' : 'near ') : 'flat '} ${p.orientation.padEnd(9)} ${p.materials.join('/').padEnd(18)} gap ${(p.gap * 1000).toFixed(0).padStart(3)} mm n ${f(p.normal)} box ${f(p.min)} .. ${f(p.max)}`);
