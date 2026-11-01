/**
 * Door positions of a face's houses in the strip frame (#181): fit every house as the face draws it and project its
 * `door` opening onto the strip's u axis. Feeds scripts/block-face/door-depth.ts and door-reveal-sheet.ts.
 *   node --import tsx scripts/block-face/door-positions.ts --face=helmers-209-253 [--json]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {houseIntents, validateBlockFace} from '../../src/canalRecall/blockFace/intent.ts';
import {fileTypeLoader} from '../../src/canalRecall/blockFace/typeLibrary.ts';
import {fitIntent} from '../../src/canalRecall/buildingRecipe/fit.ts';
import {FACES} from './intake.ts';

export interface DoorPosition { pand: string; front: string; x: [number, number]; h: number; bottom: number; type?: string; ground: unknown; error?: string }

export async function doorPositions(face: string): Promise<DoorPosition[]> {
  const dir = path.join(FACES, face);
  const discovery = JSON.parse(await fs.readFile(path.join(dir, 'discovery.json'), 'utf8'));
  const intent = validateBlockFace(JSON.parse(await fs.readFile(path.join(dir, 'intent.json'), 'utf8')), discovery.members, fileTypeLoader());
  const strip = JSON.parse(await fs.readFile(path.join(dir, 'strip.json'), 'utf8'));
  const {midRD, uRD} = strip.frame;
  const intents = houseIntents(intent, fileTypeLoader()), out: DoorPosition[] = [];
  for (const [i, h] of intent.houses.entries()) {
    const facts = JSON.parse(await fs.readFile(path.join(dir, 'pands', h.pandId, 'facts.json'), 'utf8'));
    let fitted;
    try { fitted = fitIntent(intents[i], facts); } catch { continue; }
    const {recipe, anchorRD} = fitted;
    for (const el of recipe.elevations) {
      const door = el.openings.value.find(o => /(^|-)door(-m\d+)?$/.test(o.id) && o.kind === 'door');
      if (!door) continue;
      const ring = recipe.footprint.value[el.polygonIndex].outer, a = ring[el.edgeIndex], b = ring[el.endEdgeIndex ?? (el.edgeIndex + 1) % ring.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      // Recipe local frame: x east, z south (rdToRecipeLocal); the strip's u in RD.
      const at = (s: number) => { const x = a[0] + ux * s, z = a[1] + uz * s; return (anchorRD[0] + x - midRD[0]) * uRD[0] + (anchorRD[1] - z - midRD[1]) * uRD[1]; };
      const x0 = at(door.leftM), x1 = at(door.leftM + door.widthM);
      out.push({pand: h.pandId, front: el.id, x: [+Math.min(x0, x1).toFixed(2), +Math.max(x0, x1).toFixed(2)], h: door.heightM, bottom: door.bottomM, type: (h as any).type?.type, ground: (h as any).type?.ground ?? null});
    }
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const face = process.argv.find(a => a.startsWith('--face='))!.slice(7);
  for (const d of await doorPositions(face)) console.log(process.argv.includes('--json') ? JSON.stringify(d) : `${d.pand.slice(-6)} ${d.front}: x ${d.x[0]}..${d.x[1]} h ${d.h} bottom ${d.bottom} type ${d.type ?? '-'} ground ${JSON.stringify(d.ground)}`);
}
