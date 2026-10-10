/**
 * Copy a block-kit model's reference photos, measured crops, 3DBAG surfaces and review sheets into the private source pack.
 *   node --import tsx scripts/haparandaweg/archive-refs.ts --id=haparandaweg-952-1002 [--dest=/Users/blackmad/Code/map-recall2-source-data] [--main=/Users/blackmad/Code/map-recall2]
 * Writes <dest>/models/<id>/files/{front.jpg,front-alt.jpg,thumb.jpg,reference.json,wall-*.jpg,wall-*.json,3dbag-surfaces-<pand>.json,plan.png,review-sheet-20261010/...}.
 * Never commits anything; the integrator commits the pack.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadSpec } from './build.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const id = arg('id'), dest = arg('dest', '/Users/blackmad/Code/map-recall2-source-data'), main = arg('main', '/Users/blackmad/Code/map-recall2');
const { spec } = loadSpec(id);
const out = path.join(dest, 'models', id, 'files'), sheets = path.join(out, 'review-sheet-20261010');
fs.mkdirSync(sheets, { recursive: true });
const copy = (from: string, to: string) => { if (fs.existsSync(from) && fs.statSync(from).isFile()) { fs.copyFileSync(from, to); console.log('  ', to); } };
for (const dir of [`artifacts/haparandaweg/ref/${spec.pandId}`, `artifacts/haparandaweg/ref/NL.IMBAG.Pand.${spec.pandId}`]) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) copy(path.join(dir, f), path.join(out, f));
}
copy(`scripts/haparandaweg/data/${spec.pandId}.surfaces.json`, path.join(out, `3dbag-surfaces-${spec.pandId}.json`));
copy(`artifacts/haparandaweg/${id}/plan.png`, path.join(out, 'plan.png'));
copy(`${main}/artifacts/review/${id}/sheet.png`, path.join(sheets, 'sheet-before.png'));
copy(`artifacts/review/${id}-after/sheet.png`, path.join(sheets, 'sheet-after.png'));
copy(`artifacts/review/${id}-after/meta.json`, path.join(sheets, 'meta-after.json'));
