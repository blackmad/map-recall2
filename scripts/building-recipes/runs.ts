/**
 * Curved fronts in a `kind: large` house: chains of 3DBAG wall panels linked end to end (block-kit run links, turn
 * under 50 degrees per joint), with their arc length, total turn and surfaces, so an intent can list a faceted curve
 * as one wall group with `curve: true`. Also prints the BAG LoD0 footprint arcs (runs of short, steadily turning
 * edges) and which panels lie along them, to tell a curve 3DBAG keeps from one it straightens.
 *
 *   node --import tsx scripts/building-recipes/runs.ts --house=<id> [--min-turn=10]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {largeSurfaceSet, bearingOfNormal} from '../../src/canalRecall/buildingRecipe/fitLarge.ts';
import {buildHost} from '../../src/canalRecall/blockBuilding/panels.ts';
import {MeshBuilder} from '../../src/canalRecall/blockBuilding/mesh.ts';
import {panelRuns} from '../../src/canalRecall/blockBuilding/curve.ts';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const id = arg('house'), minTurn = Number(arg('min-turn', '10'));
if (!id) throw Error('Use --house=<id>');
const facts: BuildingFacts = JSON.parse(await fs.readFile(path.join('scripts/building-recipes/houses', id, 'facts.json'), 'utf8'));
const {set, anchorRD} = largeSurfaceSet(facts);
const {panels} = buildHost(set, new MeshBuilder(), 'roof', 'wall', {deferWalls: true});
console.log(`${id}: ${panels.length} panels`);
for (const run of panelRuns(panels, () => true)) {
  if (run.panels.length < 3 || Math.abs(run.turnDeg) < minTurn) continue;
  console.log(`run ${run.lengthM.toFixed(1)} m, ${run.panels.length} panels, turn ${run.turnDeg.toFixed(0)} deg:`);
  for (const pi of run.panels) {
    const p = panels[pi];
    console.log(`  panel ${String(pi).padStart(4)} ${String(Math.round(bearingOfNormal(p.n))).padStart(4)} deg ${(p.uMax - p.uMin).toFixed(1).padStart(5)} m  top ${p.vMax.toFixed(1)}  ground ${p.vMin.toFixed(1)}  surfaces [${p.walls.map(w => set.walls[w].surface).join(', ')}]`);
  }
}
// BAG LoD0 arcs: three or more edges under 4 m turning less than 30 degrees each.
const [ax, ay] = anchorRD;
for (const ring of facts.bagFootprintRD) {
  let run: {i: number; L: number; brg: number}[] = [];
  const flush = () => {
    if (run.length < 3) return;
    const turn = ((run[run.length - 1].brg - run[0].brg + 540) % 360) - 180;
    if (Math.abs(turn) < minTurn) return;
    const pts = run.map(e => ring[e.i]).map(p => [p[0] - ax, ay - p[1]]);
    const near = panels.filter(p => pts.some(([x, z]) => { const u = (x - p.o[0]) * p.r[0] + (z - p.o[2]) * p.r[2], d = (x - p.o[0]) * p.n[0] + (z - p.o[2]) * p.n[2]; return Math.abs(d) < 0.6 && u > p.uMin - 0.3 && u < p.uMax + 0.3; }) && p.uMax - p.uMin > 1);
    console.log(`BAG arc: ${run.length} edges, ${run.reduce((s, e) => s + e.L, 0).toFixed(1)} m, turn ${turn.toFixed(0)} deg; 3DBAG panels along it: ${near.map(p => `${p.index} (${(p.uMax - p.uMin).toFixed(1)} m, ${Math.round(bearingOfNormal(p.n))} deg)`).join(', ') || 'none'}`);
  };
  for (let i = 0; i + 1 < ring.length; i++) {
    const a = ring[i], b = ring[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), brg = ((Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI + 360) % 360;
    const prev = run[run.length - 1];
    if (L < 4 && prev && Math.abs(((brg - prev.brg + 540) % 360) - 180) < 30) run.push({i, L, brg});
    else { flush(); run = L < 4 ? [{i, L, brg}] : []; }
  }
  flush();
}
