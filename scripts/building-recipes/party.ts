/**
 * Why a `kind: large` panel counts as a party wall: the three probes (15/50/85 % of its width, 0.4 m outside) and the
 * neighbour footprint each lands in, with that neighbour's height (block-kit buildHost `partyH`).
 *
 *   node --import tsx scripts/building-recipes/party.ts --house=<id> --panel=<index>[,<index>]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {largeSurfaceSet, bearingOfNormal} from '../../src/canalRecall/buildingRecipe/fitLarge.ts';
import {buildHost, pointInRing} from '../../src/canalRecall/blockBuilding/panels.ts';
import {MeshBuilder} from '../../src/canalRecall/blockBuilding/mesh.ts';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? '';
const id = arg('house'), want = arg('panel').split(',').filter(Boolean).map(Number);
const facts: BuildingFacts = JSON.parse(await fs.readFile(path.join('scripts/building-recipes/houses', id, 'facts.json'), 'utf8'));
const {set} = largeSurfaceSet(facts);
const {panels} = buildHost(set, new MeshBuilder(), 'roof', 'wall', {deferWalls: true});
for (const p of panels.filter(q => want.includes(q.index))) {
  console.log(`panel ${p.index}: ${(p.uMax - p.uMin).toFixed(1)} m at ${Math.round(bearingOfNormal(p.n))} deg, partyH ${p.partyH.toFixed(1)} m, surfaces [${p.walls.map(w => set.walls[w].surface).join(', ')}]`);
  for (const f of [0.15, 0.5, 0.85]) {
    const u = p.uMin + (p.uMax - p.uMin) * f, probe: [number, number] = [p.o[0] + p.r[0] * u + p.n[0] * 0.4, p.o[2] + p.r[2] * u + p.n[2] * 0.4];
    const hits = set.neighbours.filter(nb => pointInRing(probe, nb.ring));
    console.log(`  probe ${f}: ${hits.map(nb => `${nb.id} (${nb.height.toFixed(1)} m)`).join(', ') || 'street'}`);
  }
}
