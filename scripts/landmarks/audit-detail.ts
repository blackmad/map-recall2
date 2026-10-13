import fs from 'node:fs';
import {geometryAudit} from '../../src/canalRecall/landmarks/geometryAudit';
import {loadMaterialSoup} from './material-soup';
const id = process.argv[2];
const mode = process.argv[3] ?? '';
const specFile = `scripts/landmarks/${id}-elevations.json`;
const spec = fs.existsSync(specFile) ? JSON.parse(fs.readFileSync(specFile, 'utf8')) : null;
const r = geometryAudit(await loadMaterialSoup(`public/canal-drive/models/${id}.glb`), {facades: spec?.facades});
if (mode === '' || mode === 'r') {
  for (const f of r.rhythm) {
    console.log('##', f.name, 'openings', f.openings, 'mismatch', f.mismatched.length, 'missing', f.missing.length);
    for (const row of f.rows) console.log('  row y', row.y, 'n', row.count, 'medW', row.medianW, 'medH', row.medianH, 'odd', row.odd);
    for (const o of f.mismatched) console.log('   odd', JSON.stringify(o, (k, v) => (typeof v === 'number' ? +v.toFixed(2) : v)));
    for (const m of f.missing) console.log('   missing', JSON.stringify(m));
  }
}
const f2 = (v: number[]) => v.map(x => +x.toFixed(1)).join(',');
if (mode === 'z' || mode === 'all') {
  for (const p of r.zfight.patches.filter(p => !p.near && !p.hidden).slice(0, 30)) console.log('Z', p.area.toFixed(2), p.orientation, p.materials.join('/'), 'c', f2(p.centre), 'min', f2(p.min), 'max', f2(p.max));
}
if (mode === 'o' || mode === 'all') {
  for (const i of r.openings.issues.filter(i => i.severity === 'fail' || mode === 'all').slice(0, 40)) console.log('O', i.kind, i.severity, i.materials.join('+'), 'c', f2(i.centre), 'gap', i.gap?.toFixed(2), 'out', i.outside?.toFixed(2), 'bur', i.buried?.toFixed(2), 'n', i.wallNormal ? f2(i.wallNormal) : '', 'min', f2(i.min), 'max', f2(i.max));
}
