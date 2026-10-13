// node --import tsx scripts/landmarks/big-holes.ts <id> : lists the open boundary loops of a built GLB (bounding box, perimeter, whether faces lie above).
import {auditFile} from '../audit-glb-quality';
const id = process.argv[2];
const r = await auditFile(`public/canal-drive/models/${id}.glb`);
const d = r.holes.details.slice().sort((a, b) => b.perimeter - a.perimeter);
for (const h of d.slice(0, 12)) console.log(`perim ${h.perimeter.toFixed(1)} min (${h.min.map(v => v.toFixed(1))}) max (${h.max.map(v => v.toFixed(1))}) facesAbove ${h.facesAbove}`);
console.log('loops', r.holes.loops, 'flat comps', r.holes.flatComponents, 'underside', r.holes.undersideLoops);
