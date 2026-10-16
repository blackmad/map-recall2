/**
 * Rebuild the facts of an intaked face's bay pands on their facade line, after the intake (the intake's
 * `--bay-outline=auto` does the same at discovery). For every member whose front chain carries a bay
 * (blockFace/bayOutline.ts `frontBump`), the discovered facts move to `pands/<id>/facts-bay-outline.json` (provenance,
 * and the evidence auto-place reads the bay from) and `facts.json` becomes `chordOverFrontBump`'s rebuild. Idempotent:
 * a pand that already has `facts-bay-outline.json` is left alone, unless `--redo` rebuilds it from that file. The strip is
 * unchanged: the endpoints do not move, except where one stood on the bay (`FrontBump.lineRD`, Eemsstraat 30), which
 * moves to the party corner on the facade line a few centimetres along.
 *
 *   node --import tsx scripts/block-face/bay-outline.ts --face=boterdiep-36-66[,eems-6-78,...] [--redo]
 */
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {chordOverFrontBump, frontBump} from '../../src/canalRecall/blockFace/bayOutline.ts';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';
import {FACES} from './intake.ts';

const faces = process.argv.find(a => a.startsWith('--face='))?.slice(7).split(',');
if (!faces?.length) throw Error('--face=<id>[,<id>...]');
const redo = process.argv.includes('--redo');
for (const face of faces) {
  const members: string[] = JSON.parse(await fs.readFile(path.join(FACES, face, 'discovery.json'), 'utf8')).members;
  let rebuilt = 0;
  for (const id of members) {
    const dir = path.join(FACES, face, 'pands', id);
    const kept = existsSync(path.join(dir, 'facts-bay-outline.json'));
    if (kept && !redo) continue;
    const facts: BuildingFacts = JSON.parse(await fs.readFile(path.join(dir, kept ? 'facts-bay-outline.json' : 'facts.json'), 'utf8'));
    const next = chordOverFrontBump(facts);
    if (!next) continue;
    await fs.writeFile(path.join(dir, 'facts-bay-outline.json'), JSON.stringify(facts, null, 1) + '\n');
    await fs.writeFile(path.join(dir, 'facts.json'), JSON.stringify(next, null, 1) + '\n');
    console.log(`  ${face} ${id.slice(-6)}: bay ${JSON.stringify(frontBump(facts.fronts[0]))}; roof max ${facts.heights.roofMaxM} -> ${next.heights.roofMaxM} m`);
    rebuilt++;
  }
  console.log(`${face}: ${rebuilt} of ${members.length} pands rebuilt on the facade line`);
}
