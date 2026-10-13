/**
 * List the opening-audit issues (floating / overhang / buried assemblies) of the exported Hoofdbureau GLB with their boxes,
 * so a builder fix is a coordinate, not a hunt.
 *
 *   node --import tsx scripts/landmarks/hoofdbureau-elandsgracht-openings.ts [--glb=public/canal-drive/models/hoofdbureau-elandsgracht.glb]
 */
import {auditOpenings} from '../../src/canalRecall/landmarks/geometryAudit';
import {loadMaterialSoup} from './material-soup';

const glb = process.argv.find(a => a.startsWith('--glb='))?.slice(6) ?? 'public/canal-drive/models/hoofdbureau-elandsgracht.glb';
const {issues, assemblies} = auditOpenings(await loadMaterialSoup(glb));
console.log(`${assemblies} assemblies, ${issues.length} issues`);
const f = (v: number[]) => v.map(x => x.toFixed(2)).join(',');
for (const i of issues) console.log(`${i.severity} ${i.kind} ${i.materials.join('/')} min ${f(i.min)} max ${f(i.max)} outside ${i.outside.toFixed(2)} gap ${i.gap.toFixed(2)} buried ${i.buried.toFixed(2)} wall ${i.wallBearing?.toFixed(0)}`);
