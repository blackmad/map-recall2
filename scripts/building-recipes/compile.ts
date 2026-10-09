/**
 * Compile intent + facts → GLB + gate report, for one or more houses.
 *
 *   node --import tsx scripts/building-recipes/compile.ts --house=bloemgracht-80[,bloemgracht-82...] [--strict]
 *
 * Writes artifacts/building-recipes/<id>/{model.glb,fitted-recipe.json,report.json}
 * and, for a batch, artifacts/building-recipes/shared/{instances.json,<key>.glb}
 * where identical intents with fitted dimensions within ±0.3 m share one mesh.
 * Never installs into the game catalogues.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {NodeIO} from '@gltf-transform/core';
import {KHRMeshQuantization} from '@gltf-transform/extensions';
import {canalhouseGroupToGlb} from '../canalhouse-recipes/export-glb.ts';
import {compileBuilding, resolveIntent, canonicalIntentKey} from '../../src/canalRecall/buildingRecipe/compile.ts';
import {evaluateGates, type Tri} from '../../src/canalRecall/buildingRecipe/gates.ts';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';
import type {CanalHouseIntent} from '../../src/canalRecall/buildingRecipe/intent.ts';

export const HOUSES = 'scripts/building-recipes/houses';
export const ARTIFACTS = 'artifacts/building-recipes';
const readJson = async (file: string) => JSON.parse(await fs.readFile(file, 'utf8'));

export function slotFor(intent: CanalHouseIntent) {
  const roofSlot = ['slate', 'zinc', 'bitumen', 'copper'].includes(intent.roof.material) ? 'slate' : 'roofTile';
  return (mesh: T.Mesh) => {
    const surface = mesh.userData.surface as string;
    if (surface === 'roof') return (mesh.material as T.MeshStandardMaterial).color.getHSL({h: 0, s: 0, l: 0}).l > 0.36 ? 'bitumen' : roofSlot;
    return ({wall: 'brick', stone: 'stone', trim: 'frame', joinery: 'frame', door: 'door', glass: 'glass'} as Record<string, string>)[surface] ?? 'brick';
  };
}

async function decodeTriangles(bytes: Uint8Array): Promise<Tri[]> {
  const doc = await new NodeIO().registerExtensions([KHRMeshQuantization]).readBinary(bytes);
  const tris: Tri[] = [];
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const p = prim.getAttribute('POSITION')!, idx = prim.getIndices(), mat = prim.getMaterial()!, surface = (mat.getExtras() as any).canalhouseSurface ?? 'wall';
    const count = idx ? idx.getCount() : p.getCount(), get = (k: number) => p.getElement(idx ? idx.getScalar(k) : k, []);
    for (let k = 0; k < count; k += 3) tris.push({a: get(k), b: get(k + 1), c: get(k + 2), surface, metallic: mat.getMetallicFactor()});
  }
  return tris;
}

export async function loadIntent(id: string): Promise<{raw: any; intent: CanalHouseIntent}> {
  const cache = new Map<string, any>();
  const load = (other: string) => { if (!cache.has(other)) throw Error(`sameAs ${other} must be loaded first`); return cache.get(other); };
  const raw = await readJson(path.join(HOUSES, id, 'intent.json'));
  // Preload the sameAs chain.
  for (let r = raw; r?.sameAs;) { const next = await readJson(path.join(HOUSES, r.sameAs, 'intent.json')); cache.set(r.sameAs, next); r = next; }
  return {raw, intent: resolveIntent(raw, load)};
}

export async function compileHouse(id: string) {
  const t0 = performance.now();
  const {raw, intent} = await loadIntent(id);
  const facts: BuildingFacts = await readJson(path.join(HOUSES, id, 'facts.json'));
  const built = compileBuilding(intent, facts);
  const t1 = performance.now();
  const glb = await canalhouseGroupToGlb(intent.id, built.group, {metreUvs: true, slotFor: slotFor(intent)});
  const tris = await decodeTriangles(glb.bytes);
  const {gates, topology} = evaluateGates(tris, facts, built.fit, built.recipe.footprint.value.map(p => p.outer), built.anchorRD);
  const out = path.join(ARTIFACTS, id);
  await fs.mkdir(out, {recursive: true});
  await fs.writeFile(path.join(out, 'model.glb'), glb.bytes);
  await fs.writeFile(path.join(out, 'fitted-recipe.json'), JSON.stringify({anchorRD: built.anchorRD, recipe: built.recipe}, null, 1) + '\n');
  const report = {id, pandId: intent.pandId, sameAs: raw.sameAs ?? null, intentKey: createHash('sha256').update(canonicalIntentKey(intent)).digest('hex').slice(0, 16),
    anchorRD: built.anchorRD, fit: built.fit, roofClasses: built.roofClasses, vergeTriangles: built.vergeTriangles,
    triangles: glb.triangles, bytes: glb.bytes.length, materials: glb.materials, sha256: createHash('sha256').update(glb.bytes).digest('hex'),
    gates, topology: {components: topology.components, floating: topology.floating, openEdges: topology.openEdges, openEdgeLengthM: +topology.openEdgeLengthM.toFixed(2)},
    passed: gates.every(g => g.pass), timings: {fitCompileMs: +(t1 - t0).toFixed(1), exportGateMs: +(performance.now() - t1).toFixed(1)}};
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 1) + '\n');
  return {report, built, glb, facts, intent};
}

/** Identical canonical intent + fitted width/eaves/crown within ±0.3 m → one shared mesh, per-house transforms. */
export async function shareMeshes(results: Awaited<ReturnType<typeof compileHouse>>[]) {
  const groups: {key: string; members: typeof results}[] = [];
  const dims = (r: typeof results[number]) => r.report.fit.fronts.flatMap(f => [f.widthM, f.eavesM, f.crownTopM]);
  for (const r of results) {
    const key = r.report.intentKey, g = groups.find(x => x.key === key && dims(x.members[0]).every((v, i) => Math.abs(v - (dims(r)[i] ?? Infinity)) <= 0.3));
    if (g) g.members.push(r); else groups.push({key, members: [r]});
  }
  const out = path.join(ARTIFACTS, 'shared');
  await fs.mkdir(out, {recursive: true});
  const frontFrame = (r: typeof results[number]) => {
    const f = r.facts.fronts[0], [a, b] = f.endpointsRD;
    return {left: a, angle: Math.atan2(b[1] - a[1], b[0] - a[0])};
  };
  const instances = [];
  for (const g of groups) {
    const master = g.members[0], mf = frontFrame(master), file = `${g.key}-${master.report.id}.glb`;
    if (g.members.length > 1) await fs.writeFile(path.join(out, file), master.glb.bytes);
    for (const m of g.members) {
      const f = frontFrame(m);
      // Master local frame (x east, z south from master anchor) → this house: rotate about Y, then translate so front-left corners coincide.
      const rotation = f.angle - mf.angle, leftLocal = [mf.left[0] - master.report.anchorRD[0], master.report.anchorRD[1] - mf.left[1]];
      const c = Math.cos(-rotation), s = Math.sin(-rotation), rotated = [c * leftLocal[0] - s * leftLocal[1], s * leftLocal[0] + c * leftLocal[1]];
      instances.push({id: m.report.id, mesh: g.members.length > 1 ? file : `${m.report.id}/model.glb`, shared: g.members.length > 1, masterId: master.report.id,
        placementRD: [f.left[0] - rotated[0], f.left[1] + rotated[1]], rotationYDeg: +(-rotation * 180 / Math.PI).toFixed(3), mirror: false});
    }
  }
  const summary = {houses: results.length, uniqueMeshes: groups.length, sharedGroups: groups.filter(g => g.members.length > 1).map(g => g.members.map(m => m.report.id)), instances};
  await fs.writeFile(path.join(out, 'instances.json'), JSON.stringify(summary, null, 1) + '\n');
  return summary;
}

if (process.argv[1]?.endsWith('building-recipes/compile.ts')) {
  const ids = (process.argv.find(a => a.startsWith('--house='))?.slice(8) ?? '').split(',').filter(Boolean);
  if (!ids.length) throw Error('Use --house=<id>[,<id>...]');
  const results = [];
  for (const id of ids) {
    const r = await compileHouse(id);
    results.push(r);
    const failed = r.report.gates.filter(g => !g.pass);
    console.log(`${id}: ${r.report.triangles} tris, ${r.report.bytes} B, ${r.report.timings.fitCompileMs + r.report.timings.exportGateMs} ms, gates ${failed.length ? 'FAIL ' + failed.map(g => `${g.id}=${JSON.stringify(g.value)}`).join('; ') : 'pass'}`);
  }
  if (ids.length > 1) { const s = await shareMeshes(results); console.log(`shared meshes: ${s.uniqueMeshes} unique for ${s.houses} houses ${JSON.stringify(s.sharedGroups)}`); }
  if (process.argv.includes('--strict') && results.some(r => !r.report.passed)) process.exit(1);
}
