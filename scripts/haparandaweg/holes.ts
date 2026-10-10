/** Print the open-boundary loops of a GLB: node --import tsx scripts/haparandaweg/holes.ts <file.glb> [minPerimeter=5] */
import { analyseSoup, DEFAULT_THRESHOLDS } from '../../src/canalRecall/landmarks/glbQuality.ts';
import { loadSoup } from '../audit-glb-quality.ts';

const rep = analyseSoup(await loadSoup(process.argv[2]), DEFAULT_THRESHOLDS);
const min = Number(process.argv[3] ?? 5);
console.log('loops', rep.holes.loops, 'largest', rep.holes.largestLoopPerimeter.toFixed(1));
for (const d of rep.holes.details.filter(d => d.perimeter >= min)) console.log(d.perimeter.toFixed(1), 'min', d.min.map(v => v.toFixed(1)).join(','), 'max', d.max.map(v => v.toFixed(1)).join(','), 'facesAbove', d.facesAbove);
