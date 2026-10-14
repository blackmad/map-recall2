/**
 * Bare-shell survey for `kind: large` candidates: compiles each house's 3DBAG shell with every wall blank, as is, with
 * `shellRepair` and with `footprint: "bag"`, through the full kit, GLB export and large gates, and prints the open
 * edge, footprint IoU, ridge and triangle count of each (the dropped-pand table in docs/buildings-pipeline.md).
 *
 *   node --import tsx scripts/building-recipes/shell-survey.ts --house=<id>[,<id>...] [--modes=bare,repair,bag] [--json=out.json]
 *
 * Needs facts from `facts.ts --house=<id> --pand=<16 digits> --large`; the intent is synthetic (no intent.json needed).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {canalhouseGroupToGlb} from '../canalhouse-recipes/export-glb.ts';
import {compileLargeBuilding} from '../../src/canalRecall/buildingRecipe/largeCompile.ts';
import {largeShellFacts} from '../../src/canalRecall/buildingRecipe/fitLarge.ts';
import {evaluateLargeGates} from '../../src/canalRecall/buildingRecipe/largeGates.ts';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';
import type {LargeBuildingIntent} from '../../src/canalRecall/buildingRecipe/intent.ts';
import {decodeTriangles} from './compile.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ids = (arg('house') ?? '').split(',').filter(Boolean);
if (!ids.length) throw Error('Use --house=<id>[,<id>...]');

export async function bareShell(id: string, facts: BuildingFacts, opts: {shellRepair?: boolean; footprint?: 'bag'}) {
  const base = {schemaVersion: 1, kind: 'large', id, pandId: facts.pandId, address: id, sources: [{id: 's', kind: 'street-panorama', capturedAt: '2020-01-01'}],
    palette: {brick: '#8a5a44', frame: '#efece4', door: '#2a2a2a'}, otherWalls: 'blank', ...opts} as unknown as LargeBuildingIntent;
  const {facts: shellFacts} = largeShellFacts({...base, walls: []}, facts);
  const intent = {...base, walls: [{wallSurfaces: [shellFacts.wallsRD![0].surface], system: 'blank'}]} as LargeBuildingIntent;
  const t0 = performance.now();
  const built = compileLargeBuilding(intent, facts, {budget: 1e9});
  const glb = await canalhouseGroupToGlb(id, built.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 20_000_000});
  const {gates, topology} = evaluateLargeGates(await decodeTriangles(glb.bytes), built);
  const v = (gid: string) => gates.find(g => g.id === gid)?.value as any;
  return {ms: Math.round(performance.now() - t0), triangles: glb.triangles, openM: +topology.openEdgeLengthM.toFixed(1), iou: typeof v('footprint-vs-bag') === 'number' ? v('footprint-vs-bag') : v('footprint-vs-bag')?.iou,
    ridge: v('ridge-vs-3dbag'), repair: built.fit.shellRepair, failing: gates.filter(g => !g.pass && !g.id.startsWith('eaves') && !g.id.startsWith('storey')).map(g => g.id), samples: topology.openEdgeSamples.slice(0, 4)};
}

const rows: Record<string, unknown>[] = [];
for (const id of ids) {
  const facts: BuildingFacts = JSON.parse(await fs.readFile(path.join('scripts/building-recipes/houses', id, 'facts.json'), 'utf8'));
  const row: Record<string, unknown> = {id, pandId: facts.pandId};
  const modes = (arg('modes') ?? 'bare,repair,bag').split(',');
  for (const [name, opts] of ([['bare', {}], ['repair', {shellRepair: true}], ['bag', {footprint: 'bag'}]] as const).filter(([n]) => modes.includes(n))) {
    try { row[name] = await bareShell(id, facts, opts); } catch (e) { row[name] = {error: (e as Error).message.slice(0, 160)}; }
  }
  const s = (r: any) => !r ? '-' : r.error ? `ERR ${r.error.slice(0, 50)}` : `open ${String(r.openM).padStart(5)} m IoU ${r.iou} tris ${r.triangles}${r.failing.length ? ' FAIL ' + r.failing.join(',') : ''}`;
  console.log(`${id.padEnd(40)} bare: ${s(row.bare)} | repair: ${s(row.repair)} | bag: ${s(row.bag)}`);
  rows.push(row);
}
if (arg('json')) await fs.writeFile(arg('json')!, JSON.stringify(rows, null, 1) + '\n');
