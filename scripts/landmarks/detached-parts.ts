// Usage: npx tsx scripts/landmarks/detached-parts.ts <id>
// Prints the detached parts the GLB audit reports (gap, area, centre in model metres) to locate them in a builder.
import path from 'node:path';
import {loadSoup} from '../audit-glb-quality';
import {analyseSoup} from '../../src/canalRecall/landmarks/glbQuality';

const id = process.argv[2];
const r = analyseSoup(await loadSoup(path.resolve(import.meta.dirname, `../../public/canal-drive/models/${id}.glb`)));
for (const p of r.detached.parts.filter(p => p.gap > 0.05)) console.log(p.area.toFixed(1), 'm2 gap', p.gap.toFixed(2), 'y', p.minY.toFixed(1), '-', p.maxY.toFixed(1), 'centre', p.centre.map(v => v.toFixed(1)).join(','));
