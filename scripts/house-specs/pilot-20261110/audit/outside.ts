// Lane H7 r3: every opening part the geometry audit finds outside its wall (openingsWithinWalls).
import {loadMaterialSoup} from '../../../../scripts/landmarks/material-soup';
import {geometryAudit} from '../../../../src/canalRecall/landmarks/geometryAudit.ts';
const g = geometryAudit(await loadMaterialSoup(process.argv[2]));
const w = (g as any).withinWalls;
console.log('outside', w.outsideM2, 'parts', w.outside.length, 'of', w.judged);
for (const o of w.outside) console.log(o.materials.join('/').padEnd(16), 'min', o.min.map((v: number) => +v.toFixed(2)), 'max', o.max.map((v: number) => +v.toFixed(2)), 'face', o.faceM2, 'out', o.outsideM2, 'roof', o.roofM2 ?? 0, 'pierces', !!o.piercesRoof, 'bearing', Math.round(o.wallBearing), 'tris', o.triangles);
