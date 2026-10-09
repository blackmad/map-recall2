import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import source from './landmarks/museum-amsterdam-noord-footprints.json';
import spec from './landmarks/museum-amsterdam-noord-spec.json';
await MeshoptDecoder.ready;
const path = process.argv[2] ?? 'public/canal-drive/models/museum-amsterdam-noord.glb';
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder}).read(path);
let tris = 0; const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (const node of doc.getRoot().listNodes()) { const m = node.getMesh(); if (!m) continue; const M = node.getWorldMatrix(); for (const p of m.listPrimitives()) {
  const pos = p.getAttribute('POSITION')!; tris += (p.getIndices()?.getCount() ?? pos.getCount()) / 3;
  for (let i = 0; i < pos.getCount(); i++) { const r = pos.getElement(i, [0, 0, 0]); const v = [M[0]*r[0]+M[4]*r[1]+M[8]*r[2]+M[12], M[1]*r[0]+M[5]*r[1]+M[9]*r[2]+M[13], M[2]*r[0]+M[6]*r[1]+M[10]*r[2]+M[14]]; for (let k = 0; k < 3; k++) { assert(Number.isFinite(v[k])); min[k] = Math.min(min[k], v[k]); max[k] = Math.max(max[k], v[k]); } }
} }
const d = source.pands[0]['3dbag'] as {b3_h_dak_max: number; b3_h_maaiveld: number};
const topAboveGround = d.b3_h_dak_max - d.b3_h_maaiveld;
assert(Math.abs(max[1] - topAboveGround) < .5, `top ${max[1]} vs 3DBAG max ${topAboveGround}`);
assert(min[1] > -.01 && min[1] < .05, 'sits on the ground');
const xs = source.pands[0].localRing.map(p => p[0]), zs = source.pands[0].localRing.map(p => p[1]);
const ov = .9; // roof overhang allowance
assert(min[0] > Math.min(...xs) - ov && max[0] < Math.max(...xs) + ov, 'x within footprint+overhang');
assert(min[2] > Math.min(...zs) - ov && max[2] < Math.max(...zs) + ov, 'z within footprint+overhang');
assert(tris < 25000);
assert.deepEqual(spec.suppressOsmIds, ['NL.IMBAG.Pand.0363100012158267']);
console.log(JSON.stringify({ok: true, tris, min, max, topAboveGround}));
