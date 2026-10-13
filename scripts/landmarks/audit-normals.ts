/**
 * Rank landmark GLBs by inward-facing geometry (geometryAudit.ts `auditNormals`), without the slow rest of audit:glb.
 *   node --import tsx scripts/landmarks/audit-normals.ts [--top=20] [--id=a,b] [--json=out.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import {auditNormals, NORMAL_WARN} from '../../src/canalRecall/landmarks/geometryAudit';
import {loadMaterialSoup} from './material-soup';

const ROOT = path.resolve(import.meta.dirname, '../..');
const MODELS = path.join(ROOT, 'public/canal-drive/models');
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const sig = JSON.parse(fs.readFileSync(path.join(MODELS, 'signature-landmarks.json'), 'utf8')).models as Record<string, {modelUrl: string}>;
const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/canalRecall/landmarks/manualCatalogue.json'), 'utf8')) as {id: string; modelUrl: string}[];
const all = new Map<string, string>();
for (const [id, m] of Object.entries(sig)) all.set(id, m.modelUrl);
for (const c of catalogue) all.set(c.id, c.modelUrl);
const only = arg('id')?.split(',');
const rows: {id: string; tris: number; inward: number; open: number; bad: number; inwardArea: number; worst: string}[] = [];
for (const [id, url] of all) {
  if (only && !only.includes(id)) continue;
  const file = path.join(MODELS, url.replace(/^\.\/models\//, ''));
  if (!fs.existsSync(file)) continue;
  try {
    const soup = await loadMaterialSoup(file);
    const r = auditNormals(soup);
    const inwardArea = r.materials.reduce((t, m) => t + m.inwardArea, 0);
    rows.push({id, tris: soup.indices.length / 3, inward: r.inwardShare, open: r.openShare, bad: r.badNormalShare, inwardArea,
      worst: r.materials.filter(m => m.inwardArea > 0 || m.badNormalShare > 0).sort((a, b) => b.inwardArea - a.inwardArea).slice(0, 3).map(m => `${m.name} ${(m.inwardShare * 100).toFixed(0)}%/${m.area.toFixed(0)}m2`).join(', ')});
  } catch (e) { console.error(id, String(e).slice(0, 120)); }
}
rows.sort((a, b) => b.inwardArea - a.inwardArea);
if (arg('json')) fs.writeFileSync(arg('json')!, JSON.stringify(rows, null, 1));
console.log(`${rows.length} models; ${rows.filter(r => r.inward >= NORMAL_WARN || r.bad >= NORMAL_WARN).length} at or above ${NORMAL_WARN * 100}%`);
console.log('| # | id | inward m2 | inward % | open shells % | bad vertex normals % | worst materials |\n|---|---|---|---|---|---|---|');
rows.slice(0, Number(arg('top') ?? 20)).forEach((r, i) => console.log(`| ${i + 1} | ${r.id} | ${r.inwardArea.toFixed(0)} | ${(r.inward * 100).toFixed(1)} | ${(r.open * 100).toFixed(0)} | ${(r.bad * 100).toFixed(1)} | ${r.worst} |`));
