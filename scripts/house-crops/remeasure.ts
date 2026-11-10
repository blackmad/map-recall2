/**
 * H4c: recompute the washed-out flag (highlight clipping, measure.ts clippedShare) from the archived front.jpg of every
 * manifest entry, with no network and no panorama. Run after a change to what a pixel flag measures; then --rejudge.
 *
 *   node --import tsx scripts/house-crops/remeasure.ts --buurt AB07 --archive <source-data checkout>
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { manifestPath, type Manifest } from './manifest.ts';
import { clippedShare } from './measure.ts';
import { usability, THRESHOLDS } from './flags.ts';

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
if (process.argv[1]?.endsWith('house-crops/remeasure.ts')) {
  const code = arg('buurt'), root = arg('archive') ?? process.env.HOUSE_CROPS_ARCHIVE;
  if (!code || !root) { console.error('usage: remeasure.ts --buurt <code> --archive <dir>'); process.exit(2); }
  const m: Manifest = JSON.parse(await fs.readFile(manifestPath(code), 'utf8'));
  let n = 0;
  for (const [id, e] of Object.entries(m.pands)) {
    if (e.status !== 'ok' || !e.flags) continue;
    const d = jpeg.decode(await fs.readFile(path.join(root, 'pand-crops', id, 'front.jpg')), { useTArray: true });
    e.flags.washedBrightness ??= e.flags.washedOut;
    e.flags.washedOut = +clippedShare(d.data, null, d.width, d.height).toFixed(3);
    const u = usability(e.flags); e.usable = u.usable; e.reasons = u.reasons; n++;
  }
  m.thresholds = THRESHOLDS;
  await fs.writeFile(manifestPath(code), JSON.stringify(m, null, 1) + '\n');
  console.log(`remeasured washedOut (highlight clipping) on ${n} crops`);
}
