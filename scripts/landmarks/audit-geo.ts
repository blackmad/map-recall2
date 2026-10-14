/**
 * Debug helper for the geometry audit: lists opening issues (floating / overhang / buried) and the z-fight patches with positions.
 *   node --import tsx scripts/landmarks/audit-geo.ts --id=<id> [--top=15]
 */
import {geometryAudit} from '../../src/canalRecall/landmarks/geometryAudit';
import {loadMaterialSoup} from './material-soup';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const id = arg('id'), top = Number(arg('top', '15'));
const r = geometryAudit(await loadMaterialSoup(`public/canal-drive/models/${id}.glb`), {skipRhythm: true});
const f = (v: number[]) => v.map(x => x.toFixed(1)).join(', ');
for (const i of r.openings.issues.slice(0, top)) console.log(`${i.severity} ${i.kind} ${i.materials.join('+')} at (${f(i.centre)}) gap ${i.gap?.toFixed?.(2)} outside ${i.outside?.toFixed?.(2)}`);
for (const p of r.zfight.patches.filter(p => !p.near && !p.sameMaterial).slice(0, top)) console.log(`zfight ${p.area.toFixed(2)} m2 ${p.orientation} ${p.materials.join('/')} at (${f(p.centre)}) box ${f(p.min)} .. ${f(p.max)}`);
for (const p of r.zfight.patches.filter(p => p.tight && !p.sameMaterial).slice(0, top)) console.log(`tight ${p.area.toFixed(2)} m2 ${p.orientation} ${p.materials.join('/')} ${Math.round(p.gap * 1000)} mm at (${f(p.centre)})`);
console.log(r.counts);
