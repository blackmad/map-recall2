/**
 * Regression check: every block-kit spec rebuilds to the byte-identical installed GLB, so kit changes must be opt-in.
 *
 *   node --import tsx scripts/haparandaweg/check-installed.ts [--update=<id,id>]   (ids listed in --update may differ)
 */
import fs from 'node:fs';
import { compose } from '../../src/canalRecall/blockBuilding/compose.ts';
import { loadSpec, shaper, writeGlb } from './build.ts';

const allowed = new Set((process.argv.find(a => a.startsWith('--update='))?.slice(9) ?? '').split(',').filter(Boolean));
let bad = 0;
for (const f of fs.readdirSync('scripts/haparandaweg/specs').filter(n => n.endsWith('.json')).sort()) {
  const id = f.replace(/\.json$/, ''), { spec, set } = loadSpec(id);
  const out = `artifacts/haparandaweg/${id}`;
  await writeGlb(compose(set, spec, { shaper }).mesh, spec.palette, id, out);
  const installed = `public/canal-drive/models/${id}.glb`;
  const same = fs.existsSync(installed) && Buffer.compare(fs.readFileSync(`${out}/model.min.glb`), fs.readFileSync(installed)) === 0;
  console.log(`${same ? 'identical' : allowed.has(id) ? 'DIFFERS (allowed)' : 'DIFFERS'}  ${id}`);
  if (!same && !allowed.has(id)) bad++;
}
if (bad) { console.error(`${bad} spec(s) no longer rebuild to the installed GLB`); process.exit(1); }
