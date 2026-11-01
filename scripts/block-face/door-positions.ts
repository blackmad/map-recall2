/**
 * Door positions of a face's houses in the strip frame (#181): fit every house as the face draws it and project the
 * centre of its `door` opening onto the strip's u axis. Feeds scripts/block-face/door-depth.ts.
 *   node --import tsx scripts/block-face/door-positions.ts --face=helmers-209-253
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {houseIntents, validateBlockFace} from '../../src/canalRecall/blockFace/intent.ts';
import {fileTypeLoader} from '../../src/canalRecall/blockFace/typeLibrary.ts';
import {fitIntent} from '../../src/canalRecall/buildingRecipe/fit.ts';
import {FACES} from './intake.ts';

const face = process.argv.find(a => a.startsWith('--face='))!.slice(7), dir = path.join(FACES, face);
const discovery = JSON.parse(await fs.readFile(path.join(dir, 'discovery.json'), 'utf8'));
const intent = validateBlockFace(JSON.parse(await fs.readFile(path.join(dir, 'intent.json'), 'utf8')), discovery.members, fileTypeLoader());
const strip = JSON.parse(await fs.readFile(path.join(dir, 'strip.json'), 'utf8'));
const {midRD, uRD} = strip.frame;
const intents = houseIntents(intent, fileTypeLoader());
for (const [i, h] of intent.houses.entries()) {
  const facts = JSON.parse(await fs.readFile(path.join(dir, 'pands', h.pandId, 'facts.json'), 'utf8'));
  let fitted;
  try { fitted = fitIntent(intents[i], facts); } catch (e) { console.log(`${h.pandId.slice(-6)} fit failed: ${(e as Error).message.slice(0, 80)}`); continue; }
  const {recipe, anchorRD} = fitted;
  const span = strip.spans.find((s: any) => s.pandId === h.pandId);
  for (const el of recipe.elevations) {
    const door = el.openings.value.find(o => /(^|-)door(-m\d+)?$/.test(o.id) && o.kind === 'door');
    if (!door) continue;
    const ring = recipe.footprint.value[el.polygonIndex].outer, a = ring[el.edgeIndex], b = ring[el.endEdgeIndex ?? (el.edgeIndex + 1) % ring.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    const at = (s: number) => { const x = a[0] + ux * s, z = a[1] + uz * s; return (anchorRD[0] + x - midRD[0]) * uRD[0] + (anchorRD[1] - z - midRD[1]) * uRD[1]; };
    const x0 = at(door.leftM), x1 = at(door.leftM + door.widthM);
    if (process.argv.includes('--json')) { console.log(JSON.stringify({pand: h.pandId, front: el.id, x: [+Math.min(x0, x1).toFixed(2), +Math.max(x0, x1).toFixed(2)], h: door.heightM, bottom: door.bottomM, type: (h as any).type?.type, ground: (h as any).type?.ground ?? null})); continue; }
    console.log(`${h.pandId.slice(-6)} ${el.id} ${door.id}: x ${Math.min(x0, x1).toFixed(2)}..${Math.max(x0, x1).toFixed(2)} h ${door.heightM.toFixed(2)} bottom ${door.bottomM.toFixed(2)} (span ${span?.x0M}..${span?.x1M}) type ${(h as any).type?.type ?? '-'} ground ${JSON.stringify((h as any).type?.ground ?? '')}`);
  }
}
