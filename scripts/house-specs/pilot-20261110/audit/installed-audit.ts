// Lane H7 r3: the GLB audit on a staged chunk as --install would write it (compressGlb: quantized + meshopt), without
// touching the manifest. The installed bytes moved two dormer panes onto another host wall (position quantization).
//   node --import tsx scripts/house-specs/pilot-20261110/audit/installed-audit.ts <face> <out-dir>
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {compressGlb} from '../../../../src/canalRecall/glb/compressGlb.ts';
const [face, out] = process.argv.slice(2);
await fs.mkdir(out, {recursive: true});
const file = path.join(out, `chunk-face-${face}.glb`);
await fs.writeFile(file, await compressGlb(new Uint8Array(await fs.readFile(`staging/block-face/${face}/chunk.glb`))));
try { console.log(execFileSync(process.execPath, ['--max-old-space-size=8192', '--import', 'tsx', 'scripts/audit-glb-quality.ts', `--file=${file}`], {encoding: 'utf8'})); }
catch (e: any) { console.log(String(e.stdout ?? '')); }
