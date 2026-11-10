/**
 * face-specs: write one HouseSpec file per house of block-face runs (the fromBlockFace adapter, the record
 * build-house-specs makes from the same intent), so a buurt lane can preview (resolved.ts) and `house:stage` them.
 *
 *   node --import tsx scripts/house-specs/face-specs.ts --faces=<run,run,...> --out=<dir> [--pands=<id,...>]
 *
 * Writes <out>/<pandId>.json (validated by validateSpec) and prints one line per spec: pand, address, type, route hint.
 * Nothing under public/ or scripts/house-specs/specs/ changes.
 */
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fromBlockFace} from '../../src/canalRecall/houseSpec/adapters.ts';
import {validateSpec} from '../../src/canalRecall/houseSpec/spec.ts';
import {validateBlockFace} from '../../src/canalRecall/blockFace/intent.ts';

const HELP = `face-specs: one HouseSpec per house of block-face runs (fromBlockFace), for resolved.ts and house:stage.

  node --import tsx scripts/house-specs/face-specs.ts --faces=<run,run,...> --out=<dir> [--pands=<id,...>]

  --faces   block-face run ids (scripts/block-face/faces/<id>/intent.json)
  --out     directory for <pandId>.json
  --pands   only these pands (16 digits or the last 6)
  --help    this text`;

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
if (process.argv.includes('--help') || !arg('faces') || !arg('out')) { console.log(HELP); process.exit(arg('faces') ? 1 : 0); }
const out = arg('out')!, only = arg('pands')?.split(',');
mkdirSync(out, {recursive: true});
for (const id of arg('faces')!.split(',')) {
  const dir = path.join('scripts/block-face/faces', id);
  const face = validateBlockFace(JSON.parse(readFileSync(path.join(dir, 'intent.json'), 'utf8')));
  for (const h of face.houses) {
    if (only && !only.some(p => h.pandId.endsWith(p))) continue;
    const spec = fromBlockFace(face, h.pandId, `${dir}/strip.json`);
    if (!spec) continue;
    writeFileSync(path.join(out, `${spec.pandId}.json`), JSON.stringify(validateSpec(spec), null, 1) + '\n');
    console.log(`${spec.pandId}\t${h.address}\t${id}\t${h.type?.type ?? 'design'}${h.type?.crown ? `/${h.type.crown}` : ''}${h.type?.mirror ? ' mirror' : ''}`);
  }
}
