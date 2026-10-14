/**
 * Shell-repair diagnostics: the surfaces (local metres, the kit frame) within a radius of a point, the open pieces of
 * the bare host near it and the patches the repair adds there.
 *
 *   node --import tsx scripts/building-recipes/shell-debug.ts --house=<id> --at=x,z [--r=4] [--footprint=bag]
 */
import fs from 'node:fs';
import {largeSurfaceSet} from '../../src/canalRecall/buildingRecipe/fitLarge.ts';
import {hostTriangles, openPieces, prepareShell, stripRegion} from '../../src/canalRecall/buildingRecipe/shellRepair.ts';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const id = arg('house'), [x, z] = arg('at', '0,0').split(',').map(Number), R = Number(arg('r', '4'));
const facts: BuildingFacts = JSON.parse(fs.readFileSync(`scripts/building-recipes/houses/${id}/facts.json`, 'utf8'));
const f = (p: number[]) => `(${p.map(v => v.toFixed(2)).join(',')})`;
const near = (ring: number[][]) => ring.some(p => Math.hypot(p[0] - x, p[2] - z) < R);
const show = (label: string, ff: BuildingFacts) => {
  const {set} = largeSurfaceSet(ff);
  console.log(`--- ${label}`);
  set.walls.forEach(w => { if (near(w.rings[0])) console.log(`wall ${w.surface}${w.onFootprintEdge ? ' edge' : ''}: ${w.rings[0].map(f).join(' ')}`); });
  set.roofs.forEach((r, i) => { if (near(r.rings[0])) console.log(`roof ${i}: ${r.rings[0].map(f).join(' ')}`); });
  const host = hostTriangles(set.walls.map(w => w.rings), set.roofs.map(r => r.rings));
  for (const p of openPieces(host)) if (Math.hypot(p.a[0] - x, p.a[2] - z) < R) { console.log(`open ${f(p.a)} -> ${f(p.b)} owner ${host[p.owner].roofLike ? 'roof' : 'wall'}`); if (process.argv.includes('--strips')) { for (const r of stripRegion(p, host)) console.log(`   strip ${r.map(f).join(' ')}`); for (const r of stripRegion(p, host, true)) console.log(`   up ${r.map(f).join(' ')}`); } }
};
show('input', facts);
const r = prepareShell(facts, {repair: true, footprint: (arg('footprint') || 'lod22') as 'lod22' | 'bag'});
console.log(JSON.stringify({...r.report, patches: {...r.report.patches, wallSurfaces: r.report.patches.wallSurfaces.length}}));
show('repaired', r.facts);
