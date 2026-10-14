/**
 * Debug helper for the shell audit: prints the detached/cluster parts of a landmark GLB (area, gap, bbox).
 *   node --import tsx scripts/landmarks/audit-parts.ts --id=<id>
 */
import {auditFile} from '../audit-glb-quality';

const id = process.argv.find(a => a.startsWith('--id='))?.slice(5);
if (!id) throw new Error('--id required');
const r = await auditFile(`public/canal-drive/models/${id}.glb`);
for (const p of r.detached.parts) console.log(`tris ${p.triangles} area ${p.area.toFixed(1)} gap ${p.gap.toFixed(2)} y ${p.minY.toFixed(1)}..${p.maxY.toFixed(1)} centre ${p.centre.map(v => v.toFixed(1)).join(',')} hovering ${p.hovering}`);
for (const f of r.findings) console.log(f.severity, f.kind, f.message);
