/** Lists the largest open boundary loops of the exported GLB. */
import {auditFile} from '../audit-glb-quality';
const r: any = await auditFile(process.argv[2] ?? 'public/canal-drive/models/roeterseiland-rec-a.glb');
for (const d of r.holes.details.slice(0, 8)) console.log(d.perimeter.toFixed(1), d.min.map((v: number) => v.toFixed(1)).join(','), '->', d.max.map((v: number) => v.toFixed(1)).join(','), d.facesAbove);
