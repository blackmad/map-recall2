// node --import tsx scripts/landmarks/list-holes.ts <id> [top] [pointsOfLoop] : the largest open boundary loops of a landmark GLB with their bounding boxes.
// With a third argument N, also prints the sampled boundary points that fall inside the box of the Nth-largest loop.
import {analyseSoup, DEFAULT_THRESHOLDS} from '../../src/canalRecall/landmarks/glbQuality';
import {loadSoup} from '../audit-glb-quality';

const id = process.argv[2];
const top = Number(process.argv[3] ?? 12);
const nth = process.argv[4] === undefined ? -1 : Number(process.argv[4]);
const r = analyseSoup(await loadSoup(`public/canal-drive/models/${id}.glb`), DEFAULT_THRESHOLDS);
console.log(id, 'loops', r.holes.loops, 'largest', r.holes.largestLoopPerimeter.toFixed(1), 'boundaryEdges', r.holes.boundaryEdges, 'undersideLoops', r.holes.undersideLoops);
const f = (v: number[]) => v.map(x => x.toFixed(1)).join(',');
const sorted = [...r.holes.details].sort((a, b) => b.perimeter - a.perimeter);
for (const d of sorted.slice(0, top)) console.log(`  ${d.perimeter.toFixed(1)} m  min ${f(d.min)}  max ${f(d.max)}  ${d.facesAbove ? 'faces above' : ''}`);
if (nth >= 0) {
  const d = sorted[nth];
  const pts = r.holes.points.filter(p => p[0] >= d.min[0] - 0.05 && p[0] <= d.max[0] + 0.05 && p[1] >= d.min[1] - 0.05 && p[1] <= d.max[1] + 0.05 && p[2] >= d.min[2] - 0.05 && p[2] <= d.max[2] + 0.05);
  console.log(`points in loop ${nth}: ${pts.length}`);
  for (const p of pts.slice(0, 80)) console.log('   ', f(p));
}
