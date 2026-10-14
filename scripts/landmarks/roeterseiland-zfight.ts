/** Lists the worst coplanar patches of the exported GLB. */
import {loadMaterialSoup} from './material-soup';
import {auditZFight} from '../../src/canalRecall/landmarks/geometryAudit';
const r: any = auditZFight(await loadMaterialSoup(process.argv[2] ?? 'public/canal-drive/models/roeterseiland-rec-a.glb'));
for (const p of r.patches.filter((p: any) => !p.near).slice(0, 200)) console.log(JSON.stringify(p));
