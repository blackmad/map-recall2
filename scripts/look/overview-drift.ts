/**
 * The descent's colour drift: each frame of an overview-transition sweep magnified to the last frame's zoom about
 * the view centre and compared with it, so what is left is how the same ground's colour differs between that zoom
 * and the city (resampling blur on edges included, the same for every run).
 *
 *   TRANSITION_SHOTS=<dir> PW_PORT=… npx playwright test tests/e2e/overview-transition.spec.ts --project=desktop
 *   node --import tsx scripts/look/overview-drift.ts <dir> [<dir2> …]
 *
 * Prints, per directory, the share of the view over ΔE76 20 and the Δ mean luma at each zoom against the last.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { jump, zoomWarp, VIEW_REGION, GROUND_REGION, type Frame } from '../../src/canalRecall/overviewTransition/frameMetrics.ts';

const load = async (f: string): Promise<Frame> => { const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, width: info.width, height: info.height, channels: 3 }; };
for (const dir of process.argv.slice(2)) {
  const files = fs.readdirSync(dir).filter(f => /-\d+\.\d\.png$/.test(f)).sort((a, b) => parseFloat(/(\d+\.\d)\.png$/.exec(a)![1]) - parseFloat(/(\d+\.\d)\.png$/.exec(b)![1]));
  const zOf = (f: string) => parseFloat(/(\d+\.\d)\.png$/.exec(f)![1]);
  const last = await load(path.join(dir, files.at(-1)!)), zl = zOf(files.at(-1)!);
  const rows: string[] = [];
  for (const f of files.slice(0, -1)) {
    if (Math.round(zOf(f) * 10) % 2) continue;
    const warped = zoomWarp(await load(path.join(dir, f)), 2 ** (zl - zOf(f)), last.width / 2, last.height / 2);
    const v = jump(warped, last, VIEW_REGION), g = jump(warped, last, GROUND_REGION);
    rows.push(`  z${zOf(f).toFixed(1)} vs z${zl.toFixed(1)}: view ΔE>20 ${(100 * v.overDE).toFixed(1)} %, Δ mean luma ${v.dMeanLuma.toFixed(1)}; ground ΔE>20 ${(100 * g.overDE).toFixed(1)} %`);
  }
  console.log(dir); console.log(rows.join('\n'));
}
