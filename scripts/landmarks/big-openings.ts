// node --import tsx scripts/landmarks/big-openings.ts <id> [n=12] [kind] : lists the worst opening/trim problems and z-fight patches of a built GLB.
import {geometryAudit} from '../../src/canalRecall/landmarks/geometryAudit';
import {loadMaterialSoup} from './material-soup';
const id = process.argv[2], n = +(process.argv[3] ?? 12), kind = process.argv[4];
const r: any = geometryAudit(await loadMaterialSoup(`public/canal-drive/models/${id}.glb`), {skipRhythm: true});
const issues = ((r.openings?.issues ?? r.issues ?? []) as any[]).filter(i => !kind || i.kind === kind);
console.log('report keys', Object.keys(r).join(','), 'issues', issues.length);
for (const i of issues.slice(0, n)) console.log(i.kind, i.severity, 'gap', i.gap?.toFixed(2), 'out', i.outside, 'bur', i.buried, 'min', i.min.map((v: number) => +v.toFixed(1)).join(','), 'max', i.max.map((v: number) => +v.toFixed(1)).join(','), i.materials?.join('/'), 'wallBrg', i.wallBearing);
const z = r.zfight;
if (z) for (const p of (z.patches ?? []).filter((q: any) => !q.near).slice(0, n)) console.log('zfight', JSON.stringify(p).slice(0, 220));
