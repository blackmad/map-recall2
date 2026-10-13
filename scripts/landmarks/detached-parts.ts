// Usage: npx tsx scripts/landmarks/detached-parts.ts <id>
// Prints where the GLB audit's detached parts and z-fight patches are (native model metres), to locate them in a builder.
import path from 'node:path';
import {loadSoup} from '../audit-glb-quality';
import {analyseSoup} from '../../src/canalRecall/landmarks/glbQuality';
import {geometryAudit} from '../../src/canalRecall/landmarks/geometryAudit';
import {loadMaterialSoup} from './material-soup';

const id = process.argv[2];
const file = path.resolve(import.meta.dirname, `../../public/canal-drive/models/${id}.glb`);
const r = analyseSoup(await loadSoup(file));
const f = (v: number[]) => v.map(x => x.toFixed(1)).join(',');
for (const p of r.detached.parts.filter(p => p.gap > 0.05)) console.log('detached', p.area.toFixed(1), 'm2 gap', p.gap.toFixed(2), 'y', p.minY.toFixed(1), '-', p.maxY.toFixed(1), 'centre', f(p.centre));
const g = geometryAudit(await loadMaterialSoup(file), {skipRhythm: true});
for (const p of g.zfight.patches) console.log(p.near ? 'zfight-near' : 'zfight', p.area.toFixed(2), 'm2', p.orientation, p.materials.join('/'), 'normal', f(p.normal), 'min', f(p.min), 'max', f(p.max));
