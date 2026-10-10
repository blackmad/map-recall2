/**
 * Freeze the opening profiles the review measured into the node-test fixture for `blockFace/openingCount.ts`.
 *
 *   node --import tsx scripts/block-face/review.ts --face=<face>   (for each face below, after compile.ts)
 *   node --import tsx scripts/block-face/opening-fixtures.ts <face>[:<label>[:<pand6>]] ...
 *
 * Reads staging/block-face/<face>/review/facade-compare.json (opening boxes measured from the chunk GLB with glass only
 * and with glass + door/shutter panes, plus per-front storey bands) and writes
 * src/canalRecall/blockFace/fixtures/opening-profiles.json. A label stores the face under another key, e.g. a variant
 * face compiled from a temporary intent copy (the 177924 four-storey variant:
 *   x-wallen-45-storeys4:wallen-45-four-storeys:177924). A pand suffix keeps only that pand.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {STAGING, FACES} from './intake.ts';

const OUT = 'src/canalRecall/blockFace/fixtures/opening-profiles.json';
const profiles: Record<string, unknown> = JSON.parse(await fs.readFile(OUT, 'utf8').catch(() => '{}'));
for (const spec of process.argv.slice(2)) {
  const [face, label = face, only] = spec.split(':');
  const fc = JSON.parse(await fs.readFile(path.join(STAGING, face, 'review', 'facade-compare.json'), 'utf8'));
  const intent = JSON.parse(await fs.readFile(path.join(FACES, face, 'intent.json'), 'utf8'));
  for (const [i, f] of fc.entries()) {
    if (only && !f.pand.endsWith(only)) continue;
    const rhythm = intent.houses[i].rhythm;
    profiles[`${label}/${f.pand.slice(-6)}`] = {photoRows: rhythm.photoRows, ...(rhythm.photoGroundRows ? {photoGroundRows: rhythm.photoGroundRows} : {}),
      fronts: f.fronts, glazed: f.openings.glazed, all: f.openings.all};
  }
}
await fs.mkdir(path.dirname(OUT), {recursive: true});
await fs.writeFile(OUT, '{\n' + Object.entries(profiles).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n}\n');
console.log(`${OUT}: ${Object.keys(profiles).length} pands`);
