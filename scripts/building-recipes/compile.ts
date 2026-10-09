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
import {rdToLngLat} from '../../src/canalRecall/facade/rdNew.ts';
import {frontFrame, localToFrameMatrix, matchDesign, placementFor, ringToFrame, frameFootprintIoU, SHARE_DIMENSION_TOLERANCE_M, SHARE_MIN_FOOTPRINT_IOU, SHARE_MIN_FRONT_IOU, SHARE_FRONT_ZONE_M} from '../../src/canalRecall/buildingRecipe/instances.ts';

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
  const {gates, topology} = evaluateGates(tris, built.facts, built.fit, built.recipe.footprint.value.map(p => p.outer), built.anchorRD);
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
  return {report, built, glb, facts: built.facts, intent};
}

/**
 * Group houses that share one mesh: equal design (or its left-right mirror),
 * fitted width/eaves/crown/roof max within 0.3 m of the group master and a
 * footprint IoU >= 0.9 against the master's footprint seen in the frontage
 * frame. Each unique mesh is exported once in its frontage frame (origin =
 * frontage midpoint, +X along the front, +Z outward); houses become
 * {anchor, northOffsetDegrees, mirror} instances (see buildingRecipe/instances.ts).
 */
export async function shareMeshes(results: Awaited<ReturnType<typeof compileHouse>>[], options: {toleranceM?: number} = {}) {
  const tolerance = options.toleranceM ?? SHARE_DIMENSION_TOLERANCE_M;
  type R = typeof results[number];
  const frames = new Map(results.map(r => [r.report.id, frontFrame(r.facts.fronts[0] as any)]));
  const frameRings = (r: R) => r.facts.bagFootprintRD.map(ring => ringToFrame(ring, frames.get(r.report.id)!));
  const dims = (r: R) => [...r.report.fit.fronts.flatMap(f => [f.widthM, f.eavesM, f.crownTopM]), r.facts.heights.roofMaxM];
  const groups: {master: R; members: {r: R; match: 'same' | 'mirror'; iou: number; frontIou: number; maxDimDeltaM: number}[]}[] = [];
  const rejected: {id: string; master: string; reason: string}[] = [];
  for (const r of results) {
    let placed = false;
    for (const g of groups) {
      const match = matchDesign(g.master.intent, r.intent);
      if (!match) continue;
      const a = dims(g.master), b = dims(r);
      if (a.length !== b.length || a.some((v, i) => Math.abs(v - b[i]) > tolerance)) { rejected.push({id: r.report.id, master: g.master.report.id, reason: `dimensions differ by more than ${tolerance} m`}); continue; }
      const mirror = match === 'mirror', iou = frameFootprintIoU(frameRings(g.master), frameRings(r), mirror), frontIou = frameFootprintIoU(frameRings(g.master), frameRings(r), mirror, 0.1, SHARE_FRONT_ZONE_M);
      if (iou < SHARE_MIN_FOOTPRINT_IOU || frontIou < SHARE_MIN_FRONT_IOU) { rejected.push({id: r.report.id, master: g.master.report.id, reason: `footprint IoU ${iou.toFixed(2)} (front ${SHARE_FRONT_ZONE_M} m: ${frontIou.toFixed(2)}) below ${SHARE_MIN_FOOTPRINT_IOU} / ${SHARE_MIN_FRONT_IOU}`}); continue; }
      g.members.push({r, match, iou, frontIou, maxDimDeltaM: Math.max(...a.map((v, i) => Math.abs(v - b[i])))}); placed = true; break;
    }
    if (!placed) groups.push({master: r, members: [{r, match: 'same', iou: 1, frontIou: 1, maxDimDeltaM: 0}]});
  }
  const out = path.join(ARTIFACTS, 'shared');
  await fs.mkdir(out, {recursive: true});
  const instances = [], meshes = [];
  for (const g of groups) {
    const master = g.master, frame = frames.get(master.report.id)!;
    // Export the master's group re-expressed in its frontage frame (a proper rotation + translation).
    const m = localToFrameMatrix(frame, master.report.anchorRD);
    const wrapper = new T.Group();
    wrapper.matrixAutoUpdate = false; wrapper.matrix.set(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9], m[10], m[11], 0, 0, 0, 1);
    wrapper.add(master.built.group);
    const glb = await canalhouseGroupToGlb(master.report.id, wrapper, {metreUvs: true, slotFor: slotFor(master.intent)});
    const hash = createHash('sha256').update(glb.bytes).digest('hex'), file = `${master.report.id}.glb`;
    await fs.writeFile(path.join(out, file), glb.bytes);
    meshes.push({id: master.report.id, file, sha256: hash, triangles: glb.triangles, bytes: glb.bytes.length, houses: g.members.map(x => x.r.report.id)});
    for (const {r, match, iou, frontIou, maxDimDeltaM} of g.members) {
      const placement = placementFor(frames.get(r.report.id)!, match === 'mirror', p => { const ll = rdToLngLat({x: p[0], y: p[1]}); return [ll[0], ll[1]]; });
      instances.push({id: r.report.id, pandId: r.report.pandId, mesh: file, masterId: master.report.id, shared: g.members.length > 1, ...placement, footprintIoU: +iou.toFixed(3), frontZoneIoU: +frontIou.toFixed(3), maxDimDeltaM: +maxDimDeltaM.toFixed(2), triangles: glb.triangles});
    }
  }
  const summary = {houses: results.length, uniqueMeshes: groups.length, sharedGroups: groups.filter(g => g.members.length > 1).map(g => g.members.map(m => `${m.r.report.id}${m.match === 'mirror' ? ' (mirror)' : ''}`)), rejected, meshes, instances};
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
  if (ids.length > 1) { const s = await shareMeshes(results, {toleranceM: Number(process.argv.find(a => a.startsWith('--tolerance='))?.slice(12)) || undefined}); console.log(`shared meshes: ${s.uniqueMeshes} unique for ${s.houses} houses ${JSON.stringify(s.sharedGroups)}`); }
  if (process.argv.includes('--strict') && results.some(r => !r.report.passed)) process.exit(1);
}
