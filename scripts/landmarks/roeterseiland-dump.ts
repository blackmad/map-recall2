import fs from 'node:fs';
import {largeSurfaceSet, panelEaves, bearingOfNormal} from '../../src/canalRecall/buildingRecipe/fitLarge';
import {buildHost} from '../../src/canalRecall/blockBuilding/panels';
import {MeshBuilder} from '../../src/canalRecall/blockBuilding/mesh';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts';

const facts: BuildingFacts = JSON.parse(fs.readFileSync('scripts/building-recipes/houses/roeterseiland-rec-a/facts.json', 'utf8'));
const {set, anchorRD} = largeSurfaceSet(facts);
const {panels} = buildHost(set, new MeshBuilder(), 'roof', 'wall', {deferWalls: true});
console.log('anchorRD', anchorRD, 'panels', panels.length);
const rows = panels.map(p => {
  const um = (p.uMin + p.uMax) / 2;
  return {i: p.index, b: Math.round(bearingOfNormal(p.n)), w: +(p.uMax - p.uMin).toFixed(1), eaves: +panelEaves(p).toFixed(1), g: +p.vMin.toFixed(1), top: +p.vMax.toFixed(1), party: +p.partyH.toFixed(1),
    x: +(p.o[0] + p.r[0] * um).toFixed(1), z: +(p.o[2] + p.r[2] * um).toFixed(1), s: p.walls.map(w => set.walls[w].surface)};
});
fs.writeFileSync(process.argv[2] ?? '/dev/stdout', JSON.stringify(rows));
for (const r of rows.filter(r => r.w >= 8).sort((a, b) => a.z - b.z)) console.log(`${r.i}\tb${r.b}\tw${r.w}\teaves${r.eaves}\tg${r.g}\ttop${r.top}\tparty${r.party}\tx${r.x}\tz${r.z}`);
