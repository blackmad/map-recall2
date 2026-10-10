import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {KHRMeshQuantization} from '@gltf-transform/extensions';
import {resolveIntent} from '../buildingRecipe/compile.ts';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {applyStreetChunks, chunkSpecFor, streetChunksEnabled} from '../landmarks/ordinaryChunks.ts';
import {compileChunk, groupBlockFaces, findContacts, trimPartyWalls, remainder, planGround, pandIndexForFace, readChunkExtras, buildChunkManifest} from './index.ts';
import type {Bucket, BucketMap, ChunkHouseInput, P2} from './types.ts';

const HOUSES = 'scripts/building-recipes/houses';
const raw = (id: string) => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const loadHouse = (id: string): ChunkHouseInput => ({id, intent: resolveIntent(raw(id), raw), facts: JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'))});

/** A vertical brick wall quad on the line z = 0 from x0..x1, y0..y1 (two triangles, facing +z). */
function wallQuad(x0: number, x1: number, y1: number): Bucket {
  const p = [[x0, 0, 0], [x1, 0, 0], [x1, y1, 0], [x0, 0, 0], [x1, y1, 0], [x0, y1, 0]];
  return {key: 'aa_brick', slot: 'brick', tint: '#aa0000', surface: 'wall', positions: p.flat(), normals: p.flatMap(() => [0, 0, 1]), uvs: p.flatMap(q => [q[0], q[1]])};
}
const house = (id: string, ...walls: Bucket[]) => ({id, buckets: new Map(walls.map((w, i) => [`${w.key}${i}`, w])) as BucketMap});
const area = (b: Bucket) => { let a = 0; for (let t = 0; t < b.positions.length / 9; t++) { const q = b.positions.slice(t * 9, t * 9 + 9); a += Math.abs((q[3] - q[0]) * (q[7] - q[1]) - (q[6] - q[0]) * (q[4] - q[1])) / 2; } return a; };

test('findContacts: two plots sharing a side meet along the overlap, in both directions', () => {
  const a: P2[] = [[0, 0], [10, 0], [10, 20], [0, 20]], b: P2[] = [[10, 0], [20, 0], [20, 20], [10, 20]];
  const contacts = findContacts([[a], [b]]);
  assert.equal(contacts.length, 2);
  for (const c of contacts) assert(Math.abs((c.s1 - c.s0) - 20) < 1e-6);
  assert.deepEqual(contacts.map(c => [c.a, c.b]).sort(), [[0, 1], [1, 0]]);
  // A cross street (4 m gap) is not a party wall.
  assert.equal(findContacts([[a], [b.map(([x, z]) => [x + 4, z] as P2)]]).length, 0);
});

test('party walls: the covered part is dropped, a lower neighbour leaves the exposed wall, no triangle is added', () => {
  // Plane z = 0 from x = 0..10. House A's wall is 10 m tall, house B's is 6 m.
  const contacts = [{a: 0, b: 1, ox: 0, oz: 0, dx: 1, dz: 0, s0: 0, s1: 10}, {a: 1, b: 0, ox: 0, oz: 0, dx: 1, dz: 0, s0: 0, s1: 10}];
  const A = house('A', wallQuad(0, 10, 10)), B = house('B', wallQuad(0, 10, 6));
  const reports = trimPartyWalls([A, B], contacts);
  const a = [...A.buckets.values()][0], b = [...B.buckets.values()][0];
  assert.equal(b.positions.length, 0, 'B stands entirely against taller A: its wall is gone');
  // Partly covered faces stay whole (cutting would add triangles; the covered part is inside B), so at least the 4 m above B remains.
  assert(area(a) >= 40 - 1e-6, `A keeps the 4 m exposed above B (got ${area(a)})`);
  assert(a.positions.length / 9 <= 2, 'never more triangles than the original quad');
  assert.equal(reports[0].a, 'A');
  assert(Math.abs(reports[0].removedAreaA - 60) < 0.1 && Math.abs(reports[0].exposedAreaA - 40) < 0.1, JSON.stringify(reports[0]));
});

test('remainder: what a lower neighbour does not cover is cut out exactly', () => {
  const tri: [P2, P2, P2] = [[0, 0], [10, 0], [0, 10]], cover: [P2, P2, P2][] = [[[0, 0], [10, 0], [10, 5]], [[0, 0], [10, 5], [0, 5]]];
  const pieces = remainder(tri, cover, 0, 10, [10]);
  const area2 = (p: P2[]) => Math.abs(p.reduce((a, q, i) => a + q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1], 0)) / 2;
  assert(Math.abs(pieces.reduce((a, p) => a + area2(p), 0) - 12.5) < 0.1, 'the triangle above y = 5 is left (3 mm margin)');
});

test('party walls: equal neighbours lose the whole pair, a wall off the party line is untouched', () => {
  const contacts = [{a: 0, b: 1, ox: 0, oz: 0, dx: 1, dz: 0, s0: 0, s1: 10}, {a: 1, b: 0, ox: 0, oz: 0, dx: 1, dz: 0, s0: 0, s1: 10}];
  const off = wallQuad(0, 10, 8); off.positions = off.positions.map((v, i) => i % 3 === 2 ? v + 3 : v);
  const A = house('A', wallQuad(0, 10, 8), off), B = house('B', wallQuad(0, 10, 8));
  trimPartyWalls([A, B], contacts);
  const [onLine, offLine] = [...A.buckets.values()];
  assert.equal(onLine.positions.length, 0);
  assert.equal(offLine.positions.length / 9, 2);
  assert.equal([...B.buckets.values()][0].positions.length, 0);
});

const facts = (ground: number, eaves: number): BuildingFacts => ({
  attributes: {b3_h_maaiveld: ground}, heights: {groundNAP: ground, roofMinM: 1, roofMaxM: eaves + 2, ridgeM: eaves + 2, dak50pM: eaves, dak70pM: eaves + 1},
  fronts: [{eavesM: eaves, topM: eaves + 2, topProfile: Array.from({length: 20}, (_, i) => ({alongM: i, heightM: i < 3 ? eaves : eaves + 1 + i * 0.1}))}],
}) as unknown as BuildingFacts;

test('planGround: one street level, near-equal eaves snap to one cornice line, real steps stay', () => {
  // Absolute eaves (ground + eaves): 15.2, 15.26, 15.18, then a 2.5 m step to 17.7.
  const f = [facts(0.93, 14.3), facts(0.66, 14.6), facts(0.48, 14.7), facts(0.56, 17.2)];
  const plan = planGround(f, [true, true, true]);
  assert.equal(plan.sharedNapM, 0.61);
  assert.deepEqual(plan.clusters, [[0, 1, 2]]);
  assert.equal(new Set(plan.eavesAfter.slice(0, 3)).size, 1, 'cornice line is shared');
  assert(plan.eavesAfter[3] - plan.eavesAfter[2] > 2, 'a real 2.5 m step is not flattened');
  assert.equal(plan.facts[0].heights.groundNAP, plan.sharedNapM);
  // No adjacency, no snapping; a ground shift beyond the cap is left alone.
  assert.deepEqual(planGround(f, [false, false, false]).clusters, []);
  assert.equal(planGround([facts(3, 14), facts(0.5, 14)], [true], 1).shiftsM[0], 0);
});

test('extras: pand index from a primitive range table', () => {
  const ranges = [[0, 0, 10], [1, 10, 5], [2, 15, 20]];
  assert.equal(pandIndexForFace(ranges, 0), 0);
  assert.equal(pandIndexForFace(ranges, 12), 1);
  assert.equal(pandIndexForFace(ranges, 34), 2);
  assert.equal(pandIndexForFace(ranges, 35), -1);
  assert.equal(pandIndexForFace(undefined, 3), -1);
  assert.equal(readChunkExtras({other: 1}), null);
});

test('?streetChunks flag parsing', () => {
  assert.equal(streetChunksEnabled('?streetChunks=1'), true);
  assert.equal(streetChunksEnabled('?a=b&streetChunks=true'), true);
  assert.equal(streetChunksEnabled('?streetChunks=0'), false);
  assert.equal(streetChunksEnabled(''), false);
});

// The real Bilderdijkstraat block face: 155417 .. 081118, seven houses along the west side.
const FACE = ['bilder-081118', 'bilder-087959', 'bilder-157650', 'bilder-156287', 'bilder-156286', 'bilder-155418', 'bilder-155417'];

test('Bilderdijkstraat: houses group into block faces that end at the gaps', () => {
  const faces = groupBlockFaces(['bilder-155417', 'bilder-155418', 'bilder-153622', 'bilder-152363', 'bilder-156732', 'bilder-157154'].map(loadHouse));
  const names = faces.map(f => f.map(h => h.id).sort());
  assert(names.some(n => n.join() === 'bilder-155417,bilder-155418'));
  assert(names.some(n => n.join() === 'bilder-152363,bilder-156732'));
  assert(names.some(n => n.join() === 'bilder-153622'), '153622 is 5 m from 152363: not the same face');
  assert(names.some(n => n.join() === 'bilder-157154'));
});

test('Bilderdijkstraat 081118-155417: one mesh, per-pand ranges partition it, metadata survives, nothing added by trimming', async () => {
  const result = await compileChunk(FACE.map(loadHouse), {name: 'bilder-test-x7'});
  const doc = await new NodeIO().registerExtensions([KHRMeshQuantization]).readBinary(result.glb);
  const meshes = doc.getRoot().listMeshes();
  assert.equal(meshes.length, 1, 'ONE mesh for the block face');
  const prims = meshes[0].listPrimitives();
  assert.equal(prims.length, result.report.primitives.chunk);
  assert(prims.length < result.report.primitives.individual / 2, `${prims.length} primitives vs ${result.report.primitives.individual} individually`);
  // Per-pand ranges tile each primitive exactly.
  const extras = readChunkExtras(doc.getRoot().listNodes()[0].getExtras());
  assert(extras, 'node extras carry the chunk table');
  assert.equal(extras.pands.length, 7);
  assert.deepEqual(extras.pands.map(p => p.buildingId), result.order.map(id => `NL.IMBAG.Pand.${loadHouse(id).intent.pandId}`));
  prims.forEach((prim, pi) => {
    const triangles = prim.getIndices()!.getCount() / 3, spans = extras.pands.flatMap(p => p.ranges.filter(r => r.primitive === pi)).sort((a, b) => a.firstTriangle - b.firstTriangle);
    let next = 0;
    for (const r of spans) { assert.equal(r.firstTriangle, next, 'ranges are contiguous'); next += r.triangleCount; }
    assert.equal(next, triangles, 'ranges cover the primitive');
    const table = (prim.getExtras() as {pandRanges: number[][]}).pandRanges;
    for (const r of spans) assert.equal(pandIndexForFace(table, r.firstTriangle), extras.pands.findIndex(p => p.ranges.includes(r)));
  });
  assert.equal(extras.pands.reduce((s, p) => s + p.triangles, 0), result.report.triangles.chunk);
  // Trimming never adds triangles; shared ground and cornice line are applied.
  assert(result.report.triangles.partyWallDropped >= 0);
  assert(result.report.partyWalls.some(p => p.removedAreaA > 50), 'long party walls were measured and dropped');
  assert.equal(result.report.eaves.after['bilder-156286'], result.report.eaves.after['bilder-155418']);
  assert(result.report.joints.every(j => j.sharedFrontVertex), 'neighbours share their front vertex: no gap can open');
  assert(result.report.joints.every(j => Math.abs(j.lateralGapM) < 0.25), `facade ends meet: ${result.report.joints.map(j => j.lateralGapM)}`);
  // Manifest + runtime spec.
  const manifest = buildChunkManifest([result], n => `./models/ordinary-buildings/chunks/chunk-${n}.glb`, '2026-10-09T00:00:00Z');
  const entry = manifest.chunks[0];
  assert.equal(entry.suppress.length, 7);
  assert.match(entry.modelUrl, /\?asset=[0-9a-f]{16}$/);
  const spec = chunkSpecFor(entry);
  assert.deepEqual(spec.suppressOsmIds, entry.suppress);
  assert.equal(spec.chunkPands?.length, 7);
  const applied = applyStreetChunks([{...spec, id: 'ordinary-0363100012155417'}, {...spec, id: 'other'}], manifest);
  assert.deepEqual(applied.models.map(m => m.id), ['other', entry.id], 'the per-house spec is replaced, others stay');
});

test('chunk: a face with a missing neighbour warns instead of pretending to be continuous', async () => {
  const result = await compileChunk(['bilder-153622', 'bilder-152363'].map(loadHouse), {name: 'gap'});
  assert(result.report.warnings.some(w => /share no party wall/.test(w)));
  assert.equal(result.report.partyWalls.length, 0);
});
